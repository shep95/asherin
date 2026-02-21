import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

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
}

export function useGoogleApi() {
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<GoogleAccount[]>([]);

  const callOAuth = useCallback(async (action: string, extra?: Record<string, any>) => {
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

  const connectGoogle = useCallback(async () => {
    setLoading(true);
    try {
      const data = await callOAuth("get_auth_url");
      if (data.url) {
        // Store return path
        sessionStorage.setItem("google_oauth_return", window.location.pathname);
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Failed to get auth URL:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [callOAuth]);

  const exchangeCode = useCallback(async (code: string) => {
    setLoading(true);
    try {
      const data = await callOAuth("exchange_code", {
        code,
        redirect_uri: `${window.location.origin}/dashboard`,
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

  const fetchGoogleData = useCallback(async (service: string, params?: Record<string, any>, accountId?: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");

    const res = await supabase.functions.invoke("google-data", {
      body: { service, params, account_id: accountId },
    });

    if (res.error) throw new Error(res.error.message);
    if (res.data?.error) throw new Error(res.data.error === "no_account" ? "No Google account connected" : res.data.message || res.data.error);
    return res.data;
  }, []);

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
