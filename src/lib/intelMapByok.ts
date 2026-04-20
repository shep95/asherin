/**
 * BYOK (Bring Your Own Key) for the Zophiel Intel Map.
 *
 * Stored ONLY in localStorage on the user's device. Never persisted to our DB.
 * When active, the IntelMap edge function bypasses our Gemini key and the
 * concurrency queue entirely — the user's own key + chosen model do the work.
 */

export type IntelMapByokProvider =
  | "google"
  | "openai"
  | "anthropic"
  | "xai"
  | "deepseek"
  | "mistral"
  | "perplexity";

export interface IntelMapByok {
  provider: IntelMapByokProvider;
  model: string;
  apiKey: string;
}

export interface IntelMapProviderSpec {
  id: IntelMapByokProvider;
  name: string;
  placeholder: string;
  helpUrl: string;
  helpText: string;
  models: { id: string; name: string }[];
  /** Free-form model id input also allowed (true = show "custom model" input) */
  allowCustomModel?: boolean;
}

export const INTEL_MAP_PROVIDERS: IntelMapProviderSpec[] = [
  {
    id: "google",
    name: "Google AI (Gemini)",
    placeholder: "AIzaSy...",
    helpUrl: "https://aistudio.google.com/app/apikey",
    helpText: "Get a free key from Google AI Studio.",
    models: [
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash (recommended)" },
      { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite (cheapest)" },
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro (best quality)" },
      { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash" },
      { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro" },
    ],
    allowCustomModel: true,
  },
  {
    id: "openai",
    name: "OpenAI",
    placeholder: "sk-...",
    helpUrl: "https://platform.openai.com/api-keys",
    helpText: "Create a key in OpenAI Platform → API keys.",
    models: [
      { id: "gpt-4o-mini", name: "GPT-4o mini (recommended)" },
      { id: "gpt-4o", name: "GPT-4o" },
      { id: "gpt-4.1-mini", name: "GPT-4.1 mini" },
      { id: "gpt-4.1", name: "GPT-4.1" },
    ],
    allowCustomModel: true,
  },
  {
    id: "anthropic",
    name: "Anthropic (Claude)",
    placeholder: "sk-ant-...",
    helpUrl: "https://console.anthropic.com/settings/keys",
    helpText: "Create a key in the Anthropic Console.",
    models: [
      { id: "claude-3-5-sonnet-latest", name: "Claude 3.5 Sonnet (recommended)" },
      { id: "claude-3-5-haiku-latest", name: "Claude 3.5 Haiku (fastest)" },
      { id: "claude-opus-4-20250514", name: "Claude Opus 4" },
      { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4" },
    ],
    allowCustomModel: true,
  },
  {
    id: "xai",
    name: "xAI (Grok)",
    placeholder: "xai-...",
    helpUrl: "https://console.x.ai/",
    helpText: "Create a key in the xAI Console.",
    models: [
      { id: "grok-2-latest", name: "Grok 2 (recommended)" },
      { id: "grok-beta", name: "Grok Beta" },
    ],
    allowCustomModel: true,
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    placeholder: "sk-...",
    helpUrl: "https://platform.deepseek.com/api_keys",
    helpText: "Create a key on platform.deepseek.com.",
    models: [
      { id: "deepseek-chat", name: "DeepSeek V3 Chat (recommended)" },
      { id: "deepseek-reasoner", name: "DeepSeek R1 Reasoner" },
    ],
    allowCustomModel: true,
  },
  {
    id: "mistral",
    name: "Mistral AI",
    placeholder: "Your Mistral API key...",
    helpUrl: "https://console.mistral.ai/api-keys/",
    helpText: "Create a key in the Mistral Console.",
    models: [
      { id: "mistral-large-latest", name: "Mistral Large (recommended)" },
      { id: "mistral-small-latest", name: "Mistral Small" },
      { id: "open-mistral-nemo", name: "Mistral Nemo" },
    ],
    allowCustomModel: true,
  },
  {
    id: "perplexity",
    name: "Perplexity AI",
    placeholder: "pplx-...",
    helpUrl: "https://www.perplexity.ai/settings/api",
    helpText: "Create a key in Perplexity Settings → API.",
    models: [
      { id: "sonar", name: "Sonar (recommended)" },
      { id: "sonar-pro", name: "Sonar Pro" },
      { id: "sonar-reasoning", name: "Sonar Reasoning" },
    ],
    allowCustomModel: true,
  },
];

const STORAGE_KEY = "aureon_intelmap_byok_v1";
const ENABLED_KEY = "aureon_intelmap_byok_enabled_v1";

export function getIntelMapByok(): IntelMapByok | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.provider || !parsed?.model || !parsed?.apiKey) return null;
    return parsed as IntelMapByok;
  } catch {
    return null;
  }
}

export function saveIntelMapByok(cfg: IntelMapByok) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

export function clearIntelMapByok() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(ENABLED_KEY);
}

export function isIntelMapByokEnabled(): boolean {
  return localStorage.getItem(ENABLED_KEY) === "1" && !!getIntelMapByok();
}

export function setIntelMapByokEnabled(enabled: boolean) {
  if (enabled) localStorage.setItem(ENABLED_KEY, "1");
  else localStorage.removeItem(ENABLED_KEY);
}

/** The active config to send to the edge function (null if BYOK disabled or missing). */
export function getActiveIntelMapByok(): IntelMapByok | null {
  if (!isIntelMapByokEnabled()) return null;
  return getIntelMapByok();
}

export function getProviderSpec(id: IntelMapByokProvider): IntelMapProviderSpec | undefined {
  return INTEL_MAP_PROVIDERS.find((p) => p.id === id);
}
