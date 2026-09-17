// Venice AI models that accept image input, mirrored from the provider catalog
// in src/lib/aiProviders.ts (Venice's own `supportsVision` flag). Used to let a
// saved Venice key serve image/file uploads instead of being refused wholesale.

export const VENICE_VISION_MODELS: readonly string[] = [
  "gemini-3-6-flash","gemini-3-7-flash","gemini-3-8-flash","gemini-3-5-flash-lite",
  "z-ai-glm-5-3-flash","z-ai-glm-5v-turbo","venice-uncensored-1-2","venice-uncensored-role-play",
  "qwen-3-8-max","qwen-3-8-27b","qwen-3-8-flash","qwen-3-7-max","qwen-3-7-plus","qwen-3-6-plus",
  "qwen3-6-27b","qwen3-6-35b-a3b","qwen3-5-9b","qwen3-5-397b-a17b","qwen3-5-35b-a3b",
  "qwen3-vl-235b-a22b","google-gemma-4-26b-a4b-it","google-gemma-4-31b-it","gemma-4-uncensored",
  "google-gemma-3-27b-it","grok-4-3","grok-4-5","grok-4-6","grok-4-20","grok-4-20-multi-agent",
  "grok-build-0-1","mistral-small-3-2-24b-instruct","mistral-small-2603","gemini-3-1-pro-preview",
  "gemini-3-5-flash","gemini-3-flash-preview","claude-fable-5","claude-fable-5-1","claude-opus-5",
  "claude-opus-5-fast","claude-opus-4-8","claude-opus-4-8-fast","claude-opus-4-7","claude-opus-4-6",
  "claude-opus-4-5","claude-sonnet-5","claude-sonnet-4-6","claude-sonnet-4-5","kimi-k2-6",
  "kimi-k2-7-code","kimi-k2-5","kimi-k3","inkling","xiaomi-mimo-v2-5","deepseek-v4-1-flash",
  "seed-2-1-turbo","kimi-k3-fast-api","openai-gpt-53-codex","openai-gpt-54","openai-gpt-54-pro",
  "openai-gpt-54-mini","openai-gpt-55","openai-gpt-55-pro","openai-gpt-56-luna",
  "openai-gpt-56-luna-pro","openai-gpt-56-terra","openai-gpt-56-terra-pro","openai-gpt-56-sol",
  "openai-gpt-56-sol-pro","openai-gpt-6-astra","openai-gpt-6-astra-pro","openai-gpt-4o-2024-11-20",
  "openai-gpt-4o-mini-2024-07-18","minimax-m3-preview","e2ee-kimi-k3-p",
  "e2ee-qwen3-vl-30b-a3b-p","e2ee-glm-5-3-flash","e2ee-qwen3-8-27b","e2ee-kimi-k2-6",
];

// Sensible default when a Venice key is present but the selected model is text-only.
export const VENICE_DEFAULT_VISION_MODEL = "mistral-small-3-2-24b-instruct";

export function isVeniceVisionModel(model: string | null | undefined): boolean {
  return !!model && VENICE_VISION_MODELS.includes(String(model));
}
