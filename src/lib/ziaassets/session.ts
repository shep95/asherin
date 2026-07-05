// ZIAASSETS session key store. Held only in memory; cleared on tab close/lock.
import { deriveKey } from "./crypto";

let sessionKey: CryptoKey | null = null;
let sessionRank: string | null = null;
let sessionMemberId: string | null = null;
const listeners = new Set<() => void>();

export function subscribeSession(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function emit() { listeners.forEach((l) => l()); }

export function getSessionKey(): CryptoKey | null { return sessionKey; }
export function getSessionRank(): string | null { return sessionRank; }
export function getSessionMemberId(): string | null { return sessionMemberId; }
export function isUnlocked(): boolean { return sessionKey !== null; }

export async function unlock(passphrase: string, keySalt: string, rank: string, memberId?: string) {
  sessionKey = await deriveKey(passphrase, keySalt);
  sessionRank = rank;
  sessionMemberId = memberId ?? null;
  emit();
}

export function lock() {
  sessionKey = null;
  sessionRank = null;
  sessionMemberId = null;
  emit();
}

// Auto-lock on tab hidden for 10 minutes, or on beforeunload immediately.
if (typeof window !== "undefined") {
  let hiddenTimer: number | null = null;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      hiddenTimer = window.setTimeout(() => lock(), 10 * 60 * 1000);
    } else if (hiddenTimer) {
      clearTimeout(hiddenTimer);
      hiddenTimer = null;
    }
  });
  window.addEventListener("beforeunload", () => lock());
}
