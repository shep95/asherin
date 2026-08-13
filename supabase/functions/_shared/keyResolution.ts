// Single resolution order for every keyed call on the platform.
//
//   1. the signed-in user's BYOK row (public.user_api_keys, service-role read,
//      never exposed to the browser),
//   2. the platform secret of the same name via Deno.env,
//   3. a keyless public API (handled by the caller),
//   4. honest offline — the caller says "<provider> offline" and never fakes.
//
// Nothing in this module logs, returns, or echoes key material. Presence is
// reported as a boolean; the value itself only ever leaves through the return
// of an explicit resolve* call inside an edge function.

export type KeySource = "byok" | "platform" | "none";

/** provider id (as stored in user_api_keys.provider) → platform secret NAMES. */
export const PROVIDER_ENV: Readonly<Record<string, readonly string[]>> = {
  google: ["GEMINI_API_KEY", "GEMINI_API_KEY_APP"],
  gemini: ["GEMINI_API_KEY", "GEMINI_API_KEY_APP"],
  openai: ["OPENAI_API_KEY"],
  anthropic: ["ANTHROPIC_API_KEY"],
  groq: ["GROQ_API_KEY"],
  openrouter: ["OPENROUTER_API_KEY"],
  xai: ["XAI_API_KEY"],
  mistral: ["MISTRAL_API_KEY"],
  together: ["TOGETHER_API_KEY"],
  deepseek: ["DEEPSEEK_API_KEY"],
  huggingface: ["HF_TOKEN"],
  venice: ["VENICE_API_KEY"],
  perplexity: ["PERPLEXITY_API_KEY"],
};

/** Non-model secrets. Same order rule: absent name → keyless or offline. */
export const AUX_ENV = {
  brave: "BRAVE_SEARCH_API_KEY",
  serper: "SERPER_API_KEY",
  bing: "BING_API_KEY",
  github: "GITHUB_TOKEN",
  kernelUrl: "ASHERIN_KERNEL_URL",
  kernelToken: "ASHERIN_KERNEL_TOKEN",
  youtube: "YOUTUBE_API_KEY",
  telegram: "TELEGRAM_BOT_TOKEN",
  discord: "DISCORD_BOT_TOKEN",
  twitter: "TWITTER_BEARER_TOKEN",
  redditId: "REDDIT_CLIENT_ID",
  redditSecret: "REDDIT_CLIENT_SECRET",
  messageCrypto: "MESSAGE_CRYPTO_SECRET",
} as const;

export type AuxName = keyof typeof AUX_ENV;

/** Default chat model per provider, used when the user saved a key but no model. */
export const DEFAULT_MODEL: Readonly<Record<string, string>> = {
  google: "gemini-flash-latest",
  gemini: "gemini-flash-latest",
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-sonnet-latest",
  xai: "grok-2-latest",
  groq: "llama-3.3-70b-versatile",
  openrouter: "openai/gpt-4o-mini",
  mistral: "mistral-large-latest",
  together: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  deepseek: "deepseek-chat",
  venice: "mistral-31-24b",
  perplexity: "sonar",
};

/** Order the model resolver walks when the user expressed no preference. */
export const MODEL_PRIORITY: readonly string[] = [
  "google",
  "openai",
  "anthropic",
  "xai",
  "groq",
  "openrouter",
  "mistral",
  "together",
  "deepseek",
  "venice",
];

const env = (name: string): string => (Deno.env.get(name) || "").trim();

/** Step 2 only: the platform secret for a provider, or "" when unset. */
export function platformKeyFor(provider: string): string {
  for (const name of PROVIDER_ENV[provider.toLowerCase()] || []) {
    const v = env(name);
    if (v) return v;
  }
  return "";
}

/** Presence booleans for every platform model secret. Never any value. */
export function platformProviderStatus(): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const provider of Object.keys(PROVIDER_ENV)) {
    if (provider === "gemini") continue; // alias of google
    out[provider] = platformKeyFor(provider).length > 0;
  }
  return out;
}

/** Presence booleans for the auxiliary (non-model) secrets. Never any value. */
export function auxStatus(): Record<AuxName, boolean> {
  const out = {} as Record<AuxName, boolean>;
  for (const [k, name] of Object.entries(AUX_ENV) as [AuxName, string][]) {
    out[k] = env(name).length > 0;
  }
  return out;
}

/** Step 3/4 helper: an aux secret when present, else "" so the caller degrades. */
export function auxKey(name: AuxName): string {
  return env(AUX_ENV[name]);
}

export interface ResolvedKey {
  provider: string;
  model: string;
  apiKey: string;
  source: KeySource;
}

type MinimalClient = {
  from: (t: string) => any;
};

/** Step 1: the user's own saved key for one provider (service-role read). */
export async function userByokKey(
  adminSb: MinimalClient,
  userId: string,
  provider: string,
): Promise<string> {
  try {
    const { data } = await adminSb
      .from("user_api_keys")
      .select("api_key")
      .eq("user_id", userId)
      .eq("provider", provider)
      .eq("is_active", true)
      .maybeSingle();
    return String(data?.api_key || "").trim();
  } catch {
    return "";
  }
}

/** Presence booleans for the user's BYOK locker. Never any value. */
export async function userByokStatus(
  adminSb: MinimalClient,
  userId: string,
): Promise<Record<string, boolean>> {
  const out: Record<string, boolean> = {};
  try {
    const { data } = await adminSb
      .from("user_api_keys")
      .select("provider, api_key, is_active")
      .eq("user_id", userId);
    for (const row of (data || []) as Array<Record<string, unknown>>) {
      if (row.is_active === false) continue;
      const p = String(row.provider || "");
      if (p) out[p] = String(row.api_key || "").trim().length > 0;
    }
  } catch {
    /* locker unreadable → report nothing rather than guess */
  }
  return out;
}

/**
 * Full order for a model call: user BYOK → platform secret → null.
 * `preferred` is tried first (the user's saved model preference), then the
 * standard priority list. Returns null when nothing is bound — the caller must
 * then go keyless or state that the provider is offline.
 */
export async function resolveModelKey(
  adminSb: MinimalClient | null,
  userId: string | null,
  opts: { preferred?: string | null; preferredModel?: string | null; allow?: readonly string[] } = {},
): Promise<ResolvedKey | null> {
  const allow = opts.allow && opts.allow.length ? opts.allow : MODEL_PRIORITY;
  const order = [
    ...(opts.preferred && allow.includes(opts.preferred) ? [opts.preferred] : []),
    ...allow.filter((p) => p !== opts.preferred),
  ];

  // 1 — the signed-in user's locker.
  if (adminSb && userId) {
    for (const provider of order) {
      const apiKey = await userByokKey(adminSb, userId, provider);
      if (apiKey) {
        const model =
          (provider === opts.preferred && opts.preferredModel) ||
          DEFAULT_MODEL[provider] ||
          "";
        if (model) return { provider, model, apiKey, source: "byok" };
      }
    }
  }

  // 2 — platform secret of the same name.
  for (const provider of order) {
    const apiKey = platformKeyFor(provider);
    if (apiKey) {
      const model = DEFAULT_MODEL[provider] || "";
      if (model) return { provider, model, apiKey, source: "platform" };
    }
  }

  // 3/4 — caller's problem: keyless path, or honest offline.
  return null;
}

/** Uniform offline sentence so no surface invents a result. */
export function offlineNote(subject: string): string {
  return `${subject} offline — no key bound for it (user BYOK or platform secret). No result was fabricated.`;
}
