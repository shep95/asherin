export interface NoteItem {
  id: string;
  content: string;
  createdAt: number;
}

export interface NoteBranch {
  id: string;
  name: string;
  notes: NoteItem[];
  collapsed: boolean;
}

export interface NotepadData {
  branches: NoteBranch[];
  unsorted: NoteItem[];
}

export interface NotepadChatMessage {
  role: "user" | "assistant";
  content: string;
}

export const NOTEPAD_KEY = "asherin_notepad_tree";
export const POS_KEY = "asherin_notepad_pos";

export function genId(): string {
  return crypto.randomUUID?.() || Math.random().toString(36).slice(2, 10);
}

export function loadNotepadData(convId: string): NotepadData {
  try {
    const all = JSON.parse(localStorage.getItem(NOTEPAD_KEY) || "{}");
    return all[convId] || { branches: [], unsorted: [] };
  } catch {
    return { branches: [], unsorted: [] };
  }
}

export function saveNotepadData(convId: string, data: NotepadData) {
  try {
    const all = JSON.parse(localStorage.getItem(NOTEPAD_KEY) || "{}");
    all[convId] = data;
    localStorage.setItem(NOTEPAD_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}

export interface PosSize {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function loadPos(): PosSize {
  try {
    return JSON.parse(localStorage.getItem(POS_KEY) || "null") ?? { x: 80, y: 80, w: 440, h: 480 };
  } catch {
    return { x: 80, y: 80, w: 440, h: 480 };
  }
}

export function savePos(p: PosSize) {
  localStorage.setItem(POS_KEY, JSON.stringify(p));
}
