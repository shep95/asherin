// Auto-extracted from AIKeysSettings.tsx to avoid dragging the entire
// 856-LOC settings panel (React, supabase client, lucide icons, toast)
// into every chunk that only needs to read the provider catalog.
// Pure data — safe to import from anywhere with zero side-effects.

export interface ProviderConfig {
  id: string;
  name: string;
  icon: string;
  placeholder: string;
  helpUrl: string;
  helpText: string;
  /** Country of origin — drives the country filter in Settings. */
  country: string;
  models: { id: string; name: string; description: string }[];
  /** Platform-hosted provider — no user API key required. Aureon-managed. */
  isPlatform?: boolean;
  /** Optional note shown under platform providers (e.g. subscription gating). */
  platformNote?: string;
}

export const AI_PROVIDERS: ProviderConfig[] = [

  // ───────────────────────── UNITED STATES ─────────────────────────
  {
    id: "google",
    name: "Google AI (Gemini)",
    icon: "◈",
    country: "United States",
    placeholder: "AIzaSy...",
    helpUrl: "https://aistudio.google.com/app/apikey",
    helpText: "Get your API key from Google AI Studio",
    models: [
      { id: "gemini-3-pro-preview", name: "Gemini 3 Pro", description: "Newest — frontier reasoning, 1M context" },
      { id: "gemini-3-flash-preview", name: "Gemini 3 Flash", description: "Next-gen flash, balanced speed + capability" },
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", description: "Strong reasoning + multimodal" },
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "Fast, balanced performance" },
      { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", description: "Legacy — 2M context" },
      { id: "gemini-1.0-pro", name: "Gemini 1.0 Pro", description: "Oldest available — original Gemini API" },
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    icon: "◉",
    country: "United States",
    placeholder: "sk-...",
    helpUrl: "https://platform.openai.com/api-keys",
    helpText: "Get your API key from OpenAI Platform",
    models: [
      { id: "gpt-5.5", name: "GPT-5.5", description: "Newest flagship, frontier reasoning" },
      { id: "gpt-5", name: "GPT-5", description: "All-rounder, multimodal" },
      { id: "gpt-5-mini", name: "GPT-5 Mini", description: "Cost-efficient strong performance" },
      { id: "gpt-4.1", name: "GPT-4.1", description: "Best 4.x coding model" },
      { id: "gpt-4o", name: "GPT-4o", description: "Legacy omni multimodal" },
      { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", description: "Oldest available — classic ChatGPT API" },
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic (Claude)",
    icon: "◎",
    country: "United States",
    placeholder: "sk-ant-...",
    helpUrl: "https://console.anthropic.com/settings/keys",
    helpText: "Get your API key from Anthropic Console",
    models: [
      { id: "claude-opus-4-5", name: "Claude Opus 4.5", description: "Newest flagship, smartest Claude" },
      { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5", description: "Best agentic + coding, 1M context" },
      { id: "claude-haiku-4-5", name: "Claude Haiku 4.5", description: "Fastest 4.x" },
      { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet", description: "Legacy" },
      { id: "claude-2.1", name: "Claude 2.1", description: "Oldest available — 200K context legacy" },
    ],
  },
  {
    id: "xai",
    name: "xAI (Grok)",
    icon: "◌",
    country: "United States",
    placeholder: "xai-...",
    helpUrl: "https://console.x.ai/",
    helpText: "Get your API key from xAI Console",
    models: [
      { id: "grok-5", name: "Grok 5", description: "Newest frontier reasoning + real-time" },
      { id: "grok-4-1", name: "Grok 4.1", description: "Refined reasoning" },
      { id: "grok-3", name: "Grok 3", description: "Reliable mid-tier" },
      { id: "grok-2", name: "Grok 2", description: "Legacy" },
      { id: "grok-beta", name: "Grok Beta", description: "Oldest available — original Grok API" },
    ],
  },
  {
    id: "meta",
    name: "Meta AI (Llama)",
    icon: "◇",
    country: "United States",
    placeholder: "Your Llama API key...",
    helpUrl: "https://llama.developer.meta.com/",
    helpText: "Access via Llama API, Together, or Groq",
    models: [
      { id: "llama-4-behemoth", name: "Llama 4 Behemoth", description: "Newest 2T param frontier" },
      { id: "llama-4-maverick", name: "Llama 4 Maverick", description: "MoE flagship multimodal" },
      { id: "llama-3.3-70b", name: "Llama 3.3 70B", description: "Strong open-weight" },
      { id: "llama-3.1-405b", name: "Llama 3.1 405B", description: "Largest classic Llama" },
      { id: "llama-2-70b", name: "Llama 2 70B", description: "Oldest available — original open Llama API" },
    ],
  },
  {
    id: "perplexity",
    name: "Perplexity AI",
    icon: "◈",
    country: "United States",
    placeholder: "pplx-...",
    helpUrl: "https://www.perplexity.ai/settings/api",
    helpText: "Get your API key from Perplexity Settings",
    models: [
      { id: "sonar-pro", name: "Sonar Pro", description: "Newest multi-step search reasoning" },
      { id: "sonar-reasoning-pro", name: "Sonar Reasoning Pro", description: "R1-based reasoning + search" },
      { id: "sonar", name: "Sonar", description: "Fast search-grounded" },
      { id: "pplx-7b-online", name: "PPLX 7B Online", description: "Oldest available — legacy online model" },
    ],
  },
  {
    id: "venice",
    name: "Venice AI",
    icon: "◆",
    country: "United States",
    placeholder: "Your Venice API key...",
    helpUrl: "https://venice.ai/",
    helpText: "Uncensored, no-logging API",
    models: [
      { id: "venice-uncensored", name: "Venice Uncensored", description: "Newest uncensored flagship" },
      { id: "llama-3.1-405b", name: "Llama 3.1 405B", description: "Largest open uncensored" },
      { id: "dolphin-72b", name: "Dolphin 72B", description: "Zero-filter assistant" },
      { id: "llama-3-8b", name: "Llama 3 8B", description: "Oldest available on Venice" },
    ],
  },
  {
    id: "ibm",
    name: "IBM watsonx (Granite)",
    icon: "◰",
    country: "United States",
    placeholder: "Your watsonx API key...",
    helpUrl: "https://cloud.ibm.com/iam/apikeys",
    helpText: "Get your API key from IBM Cloud",
    models: [
      { id: "granite-3.1-8b-instruct", name: "Granite 3.1 8B", description: "Newest enterprise instruct" },
      { id: "granite-3.0-2b-instruct", name: "Granite 3.0 2B", description: "Compact enterprise" },
      { id: "granite-13b-chat-v2", name: "Granite 13B v2", description: "Oldest available — original Granite chat" },
    ],
  },
  {
    id: "amazon",
    name: "Amazon Bedrock (Nova)",
    icon: "◱",
    country: "United States",
    placeholder: "AWS access key...",
    helpUrl: "https://console.aws.amazon.com/bedrock/",
    helpText: "Configure access in AWS Bedrock console",
    models: [
      { id: "amazon.nova-pro-v1", name: "Nova Pro", description: "Newest multimodal flagship" },
      { id: "amazon.nova-lite-v1", name: "Nova Lite", description: "Fast cost-efficient multimodal" },
      { id: "amazon.nova-micro-v1", name: "Nova Micro", description: "Cheapest text-only" },
      { id: "amazon.titan-text-express-v1", name: "Titan Text Express", description: "Oldest available — original Titan API" },
    ],
  },
  {
    id: "nvidia",
    name: "NVIDIA NIM (Nemotron)",
    icon: "◲",
    country: "United States",
    placeholder: "nvapi-...",
    helpUrl: "https://build.nvidia.com/",
    helpText: "Get your API key from NVIDIA Build",
    models: [
      { id: "nemotron-4-340b-instruct", name: "Nemotron 4 340B", description: "Newest open frontier" },
      { id: "llama-3.1-nemotron-70b", name: "Llama 3.1 Nemotron 70B", description: "Tuned reasoning" },
      { id: "nemotron-3-8b-chat", name: "Nemotron 3 8B", description: "Oldest available — original Nemotron API" },
    ],
  },
  {
    id: "openrouter",
    name: "OpenRouter (OX Alpha)",
    icon: "◐",
    country: "United States",
    placeholder: "sk-or-v1-...",
    helpUrl: "https://openrouter.ai/keys",
    helpText: "One key, every routed model — includes the stealth OX Alpha release",
    models: [
      { id: "stealth/ox-alpha", name: "OX Alpha", description: "Newest stealth release routed via OpenRouter" },
      { id: "openai/gpt-5.5", name: "GPT-5.5 (routed)", description: "OpenAI flagship through OpenRouter" },
      { id: "anthropic/claude-opus-4.5", name: "Claude Opus 4.5 (routed)", description: "Anthropic flagship through OpenRouter" },
      { id: "google/gemini-3-pro-preview", name: "Gemini 3 Pro (routed)", description: "Google frontier through OpenRouter" },
      { id: "openai/gpt-4o-mini", name: "GPT-4o Mini (routed)", description: "Cheap fallback — oldest kept here" },
    ],
  },



  // ───────────────────────── UNITED KINGDOM ─────────────────────────
  {
    id: "stability",
    name: "Stability AI",
    icon: "◳",
    country: "United Kingdom",
    placeholder: "sk-...",
    helpUrl: "https://platform.stability.ai/account/keys",
    helpText: "Get your API key from Stability Platform",
    models: [
      { id: "stable-diffusion-3.5-large", name: "Stable Diffusion 3.5 Large", description: "Newest image flagship" },
      { id: "stable-image-ultra", name: "Stable Image Ultra", description: "Highest-fidelity render" },
      { id: "stable-diffusion-xl-1024", name: "SDXL 1.0", description: "Oldest available — classic SDXL API" },
    ],
  },
  {
    id: "reka",
    name: "Reka AI",
    icon: "◴",
    country: "United Kingdom",
    placeholder: "Your Reka API key...",
    helpUrl: "https://platform.reka.ai/",
    helpText: "Get your API key from Reka Platform",
    models: [
      { id: "reka-core", name: "Reka Core", description: "Newest multimodal flagship" },
      { id: "reka-flash", name: "Reka Flash", description: "Fast multimodal" },
      { id: "reka-edge", name: "Reka Edge", description: "Oldest available — original Reka API" },
    ],
  },

  // ───────────────────────── CANADA ─────────────────────────
  {
    id: "cohere",
    name: "Cohere (Command)",
    icon: "◵",
    country: "Canada",
    placeholder: "Your Cohere API key...",
    helpUrl: "https://dashboard.cohere.com/api-keys",
    helpText: "Get your API key from Cohere Dashboard",
    models: [
      { id: "command-a-03-2025", name: "Command A", description: "Newest agentic flagship, 256K context" },
      { id: "command-r-plus", name: "Command R+", description: "RAG-tuned production model" },
      { id: "command-r", name: "Command R", description: "Balanced RAG model" },
      { id: "command", name: "Command", description: "Oldest available — original Command API" },
    ],
  },

  // ───────────────────────── FRANCE ─────────────────────────
  {
    id: "mistral",
    name: "Mistral AI",
    icon: "◐",
    country: "France",
    placeholder: "Your Mistral API key...",
    helpUrl: "https://console.mistral.ai/api-keys/",
    helpText: "Get your API key from Mistral Console",
    models: [
      { id: "mistral-large-3", name: "Mistral Large 3", description: "Newest frontier flagship" },
      { id: "magistral-medium", name: "Magistral Medium", description: "Reasoning specialist" },
      { id: "codestral-25", name: "Codestral 25", description: "Latest dedicated code model" },
      { id: "ministral-8b", name: "Ministral 8B", description: "Fast edge model" },
      { id: "mistral-7b-instruct", name: "Mistral 7B Instruct", description: "Oldest available — original Mistral API" },
    ],
  },

  // ───────────────────────── INDIA ─────────────────────────
  {
    id: "sarvam",
    name: "Sarvam AI",
    icon: "◶",
    country: "India",
    placeholder: "Your Sarvam API key...",
    helpUrl: "https://dashboard.sarvam.ai/",
    helpText: "Get your API key from Sarvam Dashboard — Indic-tuned",
    models: [
      { id: "sarvam-m", name: "Sarvam-M", description: "Newest 24B Indic reasoning flagship" },
      { id: "sarvam-2b", name: "Sarvam-2B", description: "Compact bilingual Indic model" },
      { id: "sarvam-1", name: "Sarvam-1", description: "Oldest available — original Sarvam API" },
    ],
  },
  {
    id: "krutrim",
    name: "Krutrim (Ola)",
    icon: "◷",
    country: "India",
    placeholder: "Your Krutrim API key...",
    helpUrl: "https://cloud.olakrutrim.com/",
    helpText: "Get your API key from Ola Krutrim Cloud",
    models: [
      { id: "krutrim-2-instruct", name: "Krutrim-2 Instruct", description: "Newest 12B Indic multilingual" },
      { id: "krutrim-spectre-v2", name: "Krutrim Spectre v2", description: "Production chat" },
      { id: "krutrim-1", name: "Krutrim-1", description: "Oldest available — original Krutrim API" },
    ],
  },
  {
    id: "twoai",
    name: "TWO AI (SUTRA)",
    icon: "◸",
    country: "India",
    placeholder: "Your TWO AI API key...",
    helpUrl: "https://www.two.ai/sutra",
    helpText: "Get your API key from TWO AI / SUTRA",
    models: [
      { id: "sutra-v2", name: "SUTRA-V2", description: "Newest multilingual flagship (50+ langs)" },
      { id: "sutra-pro", name: "SUTRA Pro", description: "Strong multilingual chat" },
      { id: "sutra-light", name: "SUTRA Light", description: "Oldest available — original SUTRA API" },
    ],
  },

  // ───────────────────────── CHINA ─────────────────────────
  {
    id: "deepseek",
    name: "DeepSeek",
    icon: "◔",
    country: "China",
    placeholder: "sk-...",
    helpUrl: "https://platform.deepseek.com/",
    helpText: "Get your API key from DeepSeek Platform",
    models: [
      { id: "deepseek-v3.2", name: "DeepSeek V3.2", description: "Newest flagship chat" },
      { id: "deepseek-r1", name: "DeepSeek R1", description: "Frontier open reasoning" },
      { id: "deepseek-chat", name: "DeepSeek V3", description: "Stable production chat" },
      { id: "deepseek-coder-v2", name: "DeepSeek Coder V2", description: "Code-specialized MoE" },
      { id: "deepseek-llm-67b-chat", name: "DeepSeek LLM 67B", description: "Oldest available — original DeepSeek API" },
    ],
  },
  {
    id: "qwen",
    name: "Alibaba Qwen",
    icon: "◉",
    country: "China",
    placeholder: "sk-...",
    helpUrl: "https://dashscope.console.aliyun.com/apiKey",
    helpText: "Get your API key from Alibaba Cloud DashScope",
    models: [
      { id: "qwen3-max", name: "Qwen3 Max", description: "Newest trillion-param MoE flagship" },
      { id: "qwen3-235b-a22b", name: "Qwen3 235B", description: "Top open MoE reasoning" },
      { id: "qwen3-coder-plus", name: "Qwen3 Coder Plus", description: "Agentic coding specialist" },
      { id: "qwen-turbo", name: "Qwen Turbo", description: "Fast, low-cost tier" },
      { id: "qwen-7b-chat", name: "Qwen 7B Chat", description: "Oldest available — original Qwen API" },
    ],
  },
  {
    id: "zhipu",
    name: "Zhipu AI (GLM)",
    icon: "◍",
    country: "China",
    placeholder: "Your Zhipu API key...",
    helpUrl: "https://open.bigmodel.cn/usercenter/apikeys",
    helpText: "Get your API key from Zhipu BigModel",
    models: [
      { id: "glm-4.6", name: "GLM-4.6", description: "Newest flagship reasoning + coding" },
      { id: "glm-4.5", name: "GLM-4.5", description: "Strong agentic + tool use" },
      { id: "glm-4.5-air", name: "GLM-4.5 Air", description: "Fast, cost-efficient" },
      { id: "chatglm-6b", name: "ChatGLM 6B", description: "Oldest available — original ChatGLM API" },
    ],
  },
  {
    id: "moonshot",
    name: "Moonshot (Kimi)",
    icon: "◗",
    country: "China",
    placeholder: "sk-...",
    helpUrl: "https://platform.moonshot.cn/console/api-keys",
    helpText: "Get your API key from Moonshot Platform",
    models: [
      { id: "kimi-k2", name: "Kimi K2", description: "Newest trillion-param MoE flagship" },
      { id: "kimi-k2-turbo", name: "Kimi K2 Turbo", description: "High-speed K2 tier" },
      { id: "moonshot-v1-128k", name: "Moonshot v1 128K", description: "Long-context chat" },
      { id: "moonshot-v1-8k", name: "Moonshot v1 8K", description: "Oldest available — original Moonshot API" },
    ],
  },
  {
    id: "baidu",
    name: "Baidu ERNIE",
    icon: "◖",
    country: "China",
    placeholder: "Your Qianfan API key...",
    helpUrl: "https://qianfan.cloud.baidu.com/",
    helpText: "Get your API key from Baidu Qianfan",
    models: [
      { id: "ernie-5.0", name: "ERNIE 5.0", description: "Newest flagship multimodal" },
      { id: "ernie-4.5-turbo", name: "ERNIE 4.5 Turbo", description: "Fast reasoning tier" },
      { id: "ernie-x1", name: "ERNIE X1", description: "Deep reasoning specialist" },
      { id: "ernie-bot", name: "ERNIE Bot 1.0", description: "Oldest available — original ERNIE API" },
    ],
  },
  {
    id: "minimax",
    name: "MiniMax",
    icon: "◙",
    country: "China",
    placeholder: "Your MiniMax API key...",
    helpUrl: "https://www.minimaxi.com/user-center/basic-information/interface-key",
    helpText: "Get your API key from MiniMax",
    models: [
      { id: "minimax-m2", name: "MiniMax M2", description: "Newest agentic flagship" },
      { id: "abab7-chat-preview", name: "Abab 7 Chat", description: "Long-context chat" },
      { id: "abab5-chat", name: "Abab 5 Chat", description: "Oldest available — original MiniMax API" },
    ],
  },

  // ───────────────────────── BRAZIL ─────────────────────────
  {
    id: "maritaca",
    name: "Maritaca AI (Sabiá)",
    icon: "◹",
    country: "Brazil",
    placeholder: "Your Maritaca API key...",
    helpUrl: "https://plataforma.maritaca.ai/",
    helpText: "Get your API key from Maritaca Plataforma — Portuguese-tuned",
    models: [
      { id: "sabia-3", name: "Sabiá-3", description: "Newest Portuguese flagship" },
      { id: "sabia-2-medium", name: "Sabiá-2 Medium", description: "Balanced PT chat" },
      { id: "sabia-2-small", name: "Sabiá-2 Small", description: "Fast PT tier" },
      { id: "sabia-7b", name: "Sabiá-7B", description: "Oldest available — original Sabiá API" },
    ],
  },
  {
    id: "widelabs",
    name: "Widelabs (Amazônia)",
    icon: "◺",
    country: "Brazil",
    placeholder: "Your Widelabs API key...",
    helpUrl: "https://widelabs.com.br/",
    helpText: "Get your API key from Widelabs",
    models: [
      { id: "amazonia-ia-2", name: "Amazônia IA 2", description: "Newest Brazilian sovereign LLM" },
      { id: "amazonia-ia-1", name: "Amazônia IA 1", description: "Oldest available — original Amazônia API" },
    ],
  },

  // ───────────────────────── AUSTRALIA ─────────────────────────
  {
    id: "maincode",
    name: "Maincode (Matrix)",
    icon: "◿",
    country: "Australia",
    placeholder: "Your Maincode API key...",
    helpUrl: "https://maincode.com/",
    helpText: "Get your API key from Maincode — Australian sovereign AI",
    models: [
      { id: "matrix-1", name: "Matrix-1", description: "Newest Australian-built foundation model" },
      { id: "matrix-mini", name: "Matrix Mini", description: "Oldest available — original Matrix API" },
    ],
  },
  {
    id: "leonardo",
    name: "Leonardo AI",
    icon: "◊",
    country: "Australia",
    placeholder: "Your Leonardo API key...",
    helpUrl: "https://app.leonardo.ai/api",
    helpText: "Get your API key from Leonardo AI",
    models: [
      { id: "phoenix-1.0", name: "Phoenix 1.0", description: "Newest in-house image flagship" },
      { id: "leonardo-anime-xl", name: "Leonardo Anime XL", description: "Stylized art generator" },
      { id: "leonardo-diffusion", name: "Leonardo Diffusion", description: "Oldest available — original Leonardo API" },
    ],
  },

  // ───────────────────────── NIGERIA ─────────────────────────
  {
    id: "awarri",
    name: "Awarri (LAM-1)",
    icon: "◊",
    country: "Nigeria",
    placeholder: "Your Awarri API key...",
    helpUrl: "https://awarri.com/",
    helpText: "Get your API key from Awarri — Nigerian LLM",
    models: [
      { id: "lam-1", name: "LAM-1", description: "Newest large African model (Yoruba, Igbo, Hausa, English)" },
      { id: "lam-1-base", name: "LAM-1 Base", description: "Oldest available — base LAM API" },
    ],
  },
  {
    id: "lelapa",
    name: "Lelapa AI (Vulavula)",
    icon: "◊",
    country: "Nigeria",
    placeholder: "Your Lelapa API key...",
    helpUrl: "https://lelapa.ai/",
    helpText: "Get your API key from Lelapa AI — African languages",
    models: [
      { id: "vulavula", name: "Vulavula", description: "Newest African multilingual API" },
      { id: "inkuba-0.4b", name: "InkubaLM 0.4B", description: "Oldest available — original African open model" },
    ],
  },

  // ───────────────────────── PERU ─────────────────────────
  {
    id: "latamgpt",
    name: "Latam-GPT",
    icon: "◊",
    country: "Peru",
    placeholder: "Your Latam-GPT API key...",
    helpUrl: "https://www.latamgpt.org/",
    helpText: "Get your API key from the Latam-GPT consortium (Peru / LatAm)",
    models: [
      { id: "latam-gpt-1", name: "Latam-GPT 1", description: "Newest Spanish/Portuguese/Quechua flagship" },
      { id: "latam-gpt-base", name: "Latam-GPT Base", description: "Oldest available — base Latam-GPT API" },
    ],
  },
];
