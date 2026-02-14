import type { Conversation } from "./types";

const STORAGE_KEY = "zialiel_offline_conversations";
const MAX_OFFLINE = 10;

export function saveConversationsOffline(conversations: Conversation[]) {
  try {
    const toSave = conversations.slice(0, MAX_OFFLINE).map((c) => ({
      ...c,
      createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
      messages: c.messages.map((m) => ({
        ...m,
        timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp,
      })),
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch {
    // Storage full or unavailable — silently fail
  }
}

export function loadConversationsOffline(): Conversation[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.map((c: any) => ({
      ...c,
      createdAt: new Date(c.createdAt),
      messages: c.messages.map((m: any) => ({
        ...m,
        timestamp: new Date(m.timestamp),
      })),
    }));
  } catch {
    return null;
  }
}
