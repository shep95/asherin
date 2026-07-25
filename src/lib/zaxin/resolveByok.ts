// Resolve a usable BYOK for the Zaxin module from any source:
// 1) Zophiel Intel Map BYOK (localStorage) — the legacy zaxin path.
// 2) The user's Settings → API Keys (Supabase user_api_keys + user_model_preferences).
//
// This lets the Zaxin panels accept the key the user already configured under
// Settings → API Keys, instead of forcing a separate Zophiel BYOK step.

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  getActiveIntelMapByok,
  saveIntelMapByok,
  setIntelMapByokEnabled,
  type IntelMapByok,
  type IntelMapByokProvider,
} from "@/lib/intelMapByok";

export type ZaxinByokSource = "intelmap" | "settings" | "none";

export interface ResolvedZaxinByok {
  byok: IntelMapByok | null;
  source: ZaxinByokSource;
  loading: boolean;
  /** Re-read from both sources. */
  refresh: () => Promise<void>;
  /** Persist a key inline from the Zaxin tab (mirrors Zophiel BYOK store + enables it). */
  saveInline: (cfg: IntelMapByok) => void;
}

const SUPPORTED: IntelMapByokProvider[] = [
  "google",
  "openai",
  "anthropic",
  "xai",
  "deepseek",
  "mistral",
  "perplexity",
];

export function useResolvedZaxinByok(): ResolvedZaxinByok {
  const [byok, setByok] = useState<IntelMapByok | null>(null);
  const [source, setSource] = useState<ZaxinByokSource>("none");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      // 1) Intel Map BYOK (localStorage) wins — user explicitly opted in.
      const intel = getActiveIntelMapByok();
      if (intel) {
        setByok(intel);
        setSource("intelmap");
        return;
      }

      // 2) Fallback: Settings → API Keys (Supabase).
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) {
        setByok(null);
        setSource("none");
        return;
      }

      const { data: pref } = await supabase
        .from("user_model_preferences")
        .select("active_provider, active_model")
        .eq("user_id", user.id)
        .maybeSingle();

      const provider = (pref as { active_provider?: string } | null)?.active_provider;
      const model = (pref as { active_model?: string } | null)?.active_model;

      if (!provider || provider === "default" || !model || !SUPPORTED.includes(provider as IntelMapByokProvider)) {
        // Try ANY active key as a last resort — pick the first one matching a supported provider.
        const { data: anyKeys } = await supabase
          .from("user_api_keys")
          .select("provider, api_key, is_active")
          .eq("user_id", user.id)
          .eq("is_active", true);
        const row = (anyKeys ?? []).find((k) =>
          SUPPORTED.includes((k as { provider: string }).provider as IntelMapByokProvider),
        ) as { provider: string; api_key: string } | undefined;
        if (row?.api_key) {
          const defaultModel =
            row.provider === "google" ? "gemini-2.5-flash" :
            row.provider === "openai" ? "gpt-4o-mini" :
            row.provider === "anthropic" ? "claude-haiku-4-5" :
            row.provider === "xai" ? "grok-2-vision-latest" :
            row.provider === "deepseek" ? "deepseek-chat" :
            row.provider === "mistral" ? "pixtral-large" :
            "sonar";
          setByok({ provider: row.provider as IntelMapByokProvider, model: defaultModel, apiKey: row.api_key });
          setSource("settings");
          return;
        }
        setByok(null);
        setSource("none");
        return;
      }

      const { data: keyRow } = await supabase
        .from("user_api_keys")
        .select("api_key")
        .eq("user_id", user.id)
        .eq("provider", provider)
        .eq("is_active", true)
        .maybeSingle();

      const apiKey = (keyRow as { api_key?: string } | null)?.api_key;
      if (!apiKey) {
        setByok(null);
        setSource("none");
        return;
      }

      setByok({ provider: provider as IntelMapByokProvider, model, apiKey });
      setSource("settings");
    } catch {
      setByok(null);
      setSource("none");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    // Pick up changes saved elsewhere (Settings → API Keys, Zophiel BYOK).
    const onStorage = () => { void refresh(); };
    window.addEventListener("storage", onStorage);
    window.addEventListener("asherin-byok-updated", onStorage as EventListener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("asherin-byok-updated", onStorage as EventListener);
    };
  }, [refresh]);

  const saveInline = useCallback((cfg: IntelMapByok) => {
    saveIntelMapByok(cfg);
    setIntelMapByokEnabled(true);
    setByok(cfg);
    setSource("intelmap");
    try { window.dispatchEvent(new Event("asherin-byok-updated")); } catch { /* noop */ }
  }, []);

  return { byok, source, loading, refresh, saveInline };
}
