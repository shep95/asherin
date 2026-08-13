export interface AgentTrigger {
  type: "schedule" | "event" | "webhook" | "manual";
  schedule?: {
    frequency: "once" | "hourly" | "daily" | "weekly" | "monthly" | "custom";
    time?: string;
    dayOfWeek?: number;
    dayOfMonth?: number;
    timezone: string;
    cron?: string;
  };
  event?: {
    source: string;
    filters?: Record<string, unknown>;
  };
  webhook?: {
    url: string;
    secret: string;
  };
}

export interface AgentAction {
  type: string;
  config: Record<string, unknown>;
  order: number;
}

export interface AgentOutput {
  type: "email" | "sms" | "slack" | "webhook" | "database" | "file" | "discord" | "telegram" | "whatsapp";
  config: Record<string, unknown>;
}

export interface AgentSettings {
  retryOnFailure: boolean;
  maxRetries: number;
  notifyOnFailure: boolean;
  timeout: number;
  /** Pause the run before delivery and wait for an operator decision. */
  requireApproval?: boolean;
}

/** One executed step of a run, as written by the Zahten runtime. */
export interface AgentStepRecord {
  type: string;
  order: number;
  status: "success" | "failed" | "skipped";
  output: string;
  attempts: number;
  durationMs: number;
  error?: string;
  organ?: string;
}

export type AgentRunStatus =
  | "started" | "running" | "awaiting_approval" | "success" | "partial" | "failed";

export interface AutomatedAgent {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  trigger_config: AgentTrigger;
  actions: AgentAction[];
  output_type: string;
  output_config: AgentOutput;
  status: "active" | "paused" | "deleted";
  total_runs: number;
  successful_runs: number;
  failed_runs: number;
  last_run: string | null;
  next_run: string | null;
  settings: AgentSettings;
  created_at: string;
  updated_at: string;
}

export interface AgentExecution {
  id: string;
  agent_id: string;
  user_id: string;
  status: AgentRunStatus;
  duration: number | null;
  results: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
}

export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  trigger: Partial<AgentTrigger>;
  actions: AgentAction[];
  output: Partial<AgentOutput>;
  rating: number;
  usageCount: number;
}

export const AGENT_CATEGORIES = [
  { id: "communication", label: "Communication", icon: "📧" },
  { id: "data", label: "Data & Monitoring", icon: "📊" },
  { id: "content", label: "Content Generation", icon: "✍️" },
  { id: "tasks", label: "Task Automation", icon: "📅" },
  { id: "business", label: "Business", icon: "💰" },
  { id: "development", label: "Development", icon: "💻" },
  { id: "personal", label: "Personal", icon: "🧘" },
  { id: "aureon", label: "Aureon-Specific", icon: "🔮" },
  { id: "integration", label: "Integrations", icon: "🔗" },
  { id: "ai", label: "Advanced AI", icon: "🤖" },
] as const;

export const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: "daily-email-report",
    name: "Daily Email Report",
    description: "Send daily summaries via email at a scheduled time",
    icon: "📧",
    category: "communication",
    trigger: { type: "schedule", schedule: { frequency: "daily", time: "07:00", timezone: "America/New_York" } },
    actions: [{ type: "generate_report", config: { reportType: "daily_summary" }, order: 1 }],
    output: { type: "email" },
    rating: 4.9,
    usageCount: 2300,
  },
  {
    id: "sms-alerts",
    name: "SMS Alerts",
    description: "Get text message notifications for important events",
    icon: "📱",
    category: "communication",
    trigger: { type: "event", event: { source: "alert_trigger" } },
    actions: [{ type: "format_alert", config: {}, order: 1 }],
    output: { type: "sms" },
    rating: 4.8,
    usageCount: 1800,
  },
  {
    id: "slack-bot",
    name: "Slack Bot",
    description: "Post automated messages to your Slack channels",
    icon: "🔔",
    category: "communication",
    trigger: { type: "schedule", schedule: { frequency: "daily", time: "09:00", timezone: "America/New_York" } },
    actions: [{ type: "generate_content", config: { contentType: "team_summary" }, order: 1 }],
    output: { type: "slack" },
    rating: 4.7,
    usageCount: 1200,
  },
  {
    id: "weekly-report",
    name: "Weekly Analytics Report",
    description: "Generate and send comprehensive weekly analytics",
    icon: "📊",
    category: "data",
    trigger: { type: "schedule", schedule: { frequency: "weekly", time: "21:00", dayOfWeek: 0, timezone: "America/New_York" } },
    actions: [{ type: "generate_analytics", config: {}, order: 1 }, { type: "format_report", config: { format: "pdf" }, order: 2 }],
    output: { type: "email" },
    rating: 4.9,
    usageCount: 987,
  },
  {
    id: "web-scraper",
    name: "Web Scraping Monitor",
    description: "Monitor websites for changes and get alerts",
    icon: "🌐",
    category: "data",
    trigger: { type: "schedule", schedule: { frequency: "daily", time: "08:00", timezone: "America/New_York" } },
    actions: [{ type: "scrape_web", config: {}, order: 1 }, { type: "compare_changes", config: {}, order: 2 }],
    output: { type: "email" },
    rating: 4.6,
    usageCount: 650,
  },
  {
    id: "content-generator",
    name: "Daily Content Generator",
    description: "Auto-generate social media posts, blog content, and more",
    icon: "✍️",
    category: "content",
    trigger: { type: "schedule", schedule: { frequency: "daily", time: "08:00", timezone: "America/New_York" } },
    actions: [{ type: "generate_content", config: { contentType: "social_media", count: 5 }, order: 1 }],
    output: { type: "email" },
    rating: 4.7,
    usageCount: 890,
  },
  {
    id: "video-analysis",
    name: "Video Analysis Automator",
    description: "Auto-analyze uploaded videos with Video Intelligence",
    icon: "🎬",
    category: "aureon",
    trigger: { type: "event", event: { source: "video_upload" } },
    actions: [{ type: "analyze_video", config: {}, order: 1 }, { type: "generate_report", config: { reportType: "video_analysis" }, order: 2 }],
    output: { type: "email" },
    rating: 4.8,
    usageCount: 340,
  },
  {
    id: "image-batch",
    name: "Image Batch Processor",
    description: "Process images in bulk — resize, remove backgrounds, generate variations",
    icon: "📸",
    category: "content",
    trigger: { type: "event", event: { source: "image_upload" } },
    actions: [{ type: "process_image", config: { operations: ["resize", "optimize"] }, order: 1 }],
    output: { type: "file" },
    rating: 4.5,
    usageCount: 420,
  },
  {
    id: "customer-onboarding",
    name: "Customer Onboarding Sequence",
    description: "Send automated welcome email sequences to new customers",
    icon: "👥",
    category: "business",
    trigger: { type: "event", event: { source: "new_customer" } },
    actions: [
      { type: "send_email", config: { template: "welcome", delay: 0 }, order: 1 },
      { type: "send_email", config: { template: "getting_started", delay: 86400 }, order: 2 },
      { type: "send_email", config: { template: "tips", delay: 259200 }, order: 3 },
    ],
    output: { type: "email" },
    rating: 4.9,
    usageCount: 560,
  },
  {
    id: "stock-alerts",
    name: "Stock Price Alerts",
    description: "Monitor stock prices and get instant SMS alerts",
    icon: "📈",
    category: "data",
    trigger: { type: "schedule", schedule: { frequency: "custom", cron: "*/5 9-16 * * 1-5", timezone: "America/New_York" } },
    actions: [{ type: "check_stock_price", config: {}, order: 1 }],
    output: { type: "sms" },
    rating: 4.8,
    usageCount: 780,
  },
  {
    id: "code-deployment",
    name: "Auto Deployment",
    description: "Deploy to production when you push to main branch",
    icon: "🚀",
    category: "development",
    trigger: { type: "webhook" },
    actions: [{ type: "run_tests", config: {}, order: 1 }, { type: "deploy", config: {}, order: 2 }],
    output: { type: "slack" },
    rating: 4.6,
    usageCount: 310,
  },
  {
    id: "habit-tracker",
    name: "Habit Tracker",
    description: "Daily reminders and tracking for personal habits",
    icon: "🧘",
    category: "personal",
    trigger: { type: "schedule", schedule: { frequency: "daily", time: "07:00", timezone: "America/New_York" } },
    actions: [{ type: "send_reminder", config: {}, order: 1 }],
    output: { type: "sms" },
    rating: 4.7,
    usageCount: 670,
  },
];
