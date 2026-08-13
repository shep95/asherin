// Server-side HTTP dialogue helper: retry + exponential backoff + jitter for
// edge functions, with typed error shapes for non-2xx responses.

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

export interface DialogueOpts {
  retries?: number;
  baseMs?: number;
  maxMs?: number;
  signal?: AbortSignal;
}

export async function dialogueFetch(input: string | URL, init: RequestInit = {}, opts: DialogueOpts = {}): Promise<Response> {
  const { retries = 4, baseMs = 300, maxMs = 8_000, signal } = opts;
  let attempt = 0;
  while (true) {
    try {
      const res = await fetch(input, { ...init, signal: signal ?? init.signal });
      if (res.ok || !RETRYABLE_STATUS.has(res.status) || attempt >= retries) return res;
    } catch (err) {
      if (!(err instanceof TypeError) || attempt >= retries) throw err;
    }
    const delay = Math.min(maxMs, baseMs * 2 ** attempt) * (0.5 + Math.random());
    await new Promise((r) => setTimeout(r, delay));
    attempt++;
  }
}

export class RemoteException extends Error {
  constructor(public errorCode: string, public errorName: string, public status: number, public params: Record<string, unknown> = {}) {
    super(`${errorName} [${status}] ${errorCode}`);
  }
}

export async function unwrapJsonOrThrow<T>(res: Response): Promise<T> {
  const text = await res.text();
  let body: any = null; try { body = text ? JSON.parse(text) : null; } catch { /* */ }
  if (!res.ok) throw new RemoteException(body?.errorCode ?? "UNKNOWN", body?.errorName ?? "RemoteError", res.status, body?.parameters ?? { raw: text.slice(0, 500) });
  return body as T;
}
