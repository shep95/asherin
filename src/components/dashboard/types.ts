export interface FileAttachment {
  name: string;
  type: string;
  size: number;
  base64: string;
  previewUrl?: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  truthScore?: "high" | "medium" | "low";
  sources?: { title: string; url: string }[];
  attachments?: FileAttachment[];
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  pinned?: boolean;
  mode?: ChatMode;
  projectId?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  conversationIds: string[];
  files: string[];
  createdAt: Date;
}

export interface Persona {
  id: string;
  name: string;
  icon: string;
  description: string;
  systemPrompt: string;
  builtIn: boolean;
}

export interface MemoryEntry {
  id: string;
  content: string;
  category: string;
  createdAt: Date;
}

export interface SavedPrompt {
  id: string;
  title: string;
  content: string;
  tags: string[];
  starred: boolean;
  usageCount: number;
  createdAt: Date;
}

export type ChatMode = "research" | "chat" | "code" | "truth";
export type DashboardView = "chat" | "library" | "projects" | "memory" | "stats" | "settings" | "search" | "subscription" | "asha" | "nomad" | "briefing" | "snippets" | "teams" | "notebooks" | "geospatial" | "plugins" | "timeseries" | "audit" | "zali" | "community" | "predictive" | "security" | "elion" | "imagine-to-code" | "tracker" | "persona-store" | "google" | "ide" | "pdf-generator" | "pattern-analysis";
