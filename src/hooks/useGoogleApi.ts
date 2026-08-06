import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface GoogleAccount {
  id: string;
  google_email: string;
  display_name: string | null;
  avatar_url: string | null;
  status: string;
  scopes: string[];
  last_sync_at: string | null;
  data_points_count: number;
  is_primary: boolean;
  consent_tier?: number | null;
}

export function useGoogleApi() {
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<GoogleAccount[]>([]);

  // [Finding #3] — Token refresh promise lock to prevent race conditions
  const refreshPromiseRef = useRef<Promise<void> | null>(null);

  const callOAuth = useCallback(async (action: string, extra?: Record<string, any>) => {
    // Serialize token-refresh calls
    if (action === "refresh_token") {
      if (refreshPromiseRef.current) return refreshPromiseRef.current;
      const promise = (async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated");
        const res = await supabase.functions.invoke("google-oauth", {
          body: { action, ...extra },
        });
        if (res.error) throw new Error(res.error.message);
        return res.data;
      })();
      refreshPromiseRef.current = promise.finally(() => { refreshPromiseRef.current = null; }) as any;
      return refreshPromiseRef.current;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");

    const res = await supabase.functions.invoke("google-oauth", {
      body: { action, ...extra },
    });

    if (res.error) throw new Error(res.error.message);
    return res.data;
  }, []);

  const fetchAccounts = useCallback(async () => {
    try {
      const data = await callOAuth("list_accounts");
      setAccounts(data.accounts || []);
      return data.accounts || [];
    } catch (err) {
      console.error("Failed to fetch accounts:", err);
      return [];
    }
  }, [callOAuth]);

  // [Finding #1/#5] Store state for CSRF validation on callback
  const connectGoogle = useCallback(async (tier: number = 3) => {
    setLoading(true);
    try {
      const data = await callOAuth("get_auth_url", {
        redirect_uri: `${window.location.origin}/dashboard`,
        tier,
      });
      if (data.url) {
        // Store state for validation on return
        if (data.state) sessionStorage.setItem("google_oauth_state", data.state);
        sessionStorage.setItem("google_oauth_return", window.location.pathname);
        // Google will not render consent inside a frame; this escapes it.
        const { openGoogleConsent } = await import("@/lib/googleConsent");
        const result = await openGoogleConsent(data.url);
        if (result.status === "connected") {
          toast.success(`Connected ${result.email || "Google account"}.`);
          await fetchAccounts();
        } else if (result.status === "failed") {
          toast.error(`Failed to connect: ${result.message}`);
        }
        return result;
      }
    } catch (err) {
      console.error("Failed to get auth URL:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [callOAuth, fetchAccounts]);

  // [Finding #1/#5] Pass state for CSRF validation
  const exchangeCode = useCallback(async (code: string, state?: string) => {
    setLoading(true);
    try {
      const data = await callOAuth("exchange_code", {
        code,
        redirect_uri: `${window.location.origin}/dashboard`,
        state,
      });
      await fetchAccounts();
      return data;
    } catch (err) {
      console.error("Failed to exchange code:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [callOAuth, fetchAccounts]);

  const disconnectAccount = useCallback(async (accountId: string) => {
    await callOAuth("disconnect", { account_id: accountId });
    await fetchAccounts();
  }, [callOAuth, fetchAccounts]);

  const fetchGoogleData = useCallback(async (service: string, params?: Record<string, any>, accountId?: string, aggregate = true) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");

    const res = await supabase.functions.invoke("google-data", {
      body: { service, params, account_id: accountId, aggregate: accountId ? false : aggregate },
    });

    if (res.error) throw new Error(res.error.message);
    if (res.data?.error) throw new Error(res.data.error === "no_account" ? "No Google account connected" : res.data.message || res.data.error);
    return res.data;
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const isConnected = accounts.some((a) => a.status === "connected");

  return {
    loading,
    accounts,
    isConnected,
    connectGoogle,
    exchangeCode,
    disconnectAccount,
    fetchAccounts,
    fetchGoogleData,
  };
}
