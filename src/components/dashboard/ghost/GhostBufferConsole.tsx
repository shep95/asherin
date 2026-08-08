import { useCallback, useEffect, useRef, useState } from "react";
import {
  Loader2, RefreshCw, Trash2, Search, FileText, Lock, Download, X, ExternalLink, Archive,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { BufferSession, ContentHit, Selector } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// GHOST ENGINE — Buffer console
//
// Two panes over one shelf:
//   SESSIONS  — what is currently retained, with its measurements and its clock.
//   SELECTION — dictionary / regex soft selection across those retained bodies.
//
// Payload text is rendered as text nodes only. Nothing captured is ever fed to
// dangerouslySetInnerHTML, so a hostile page cannot execute inside the console.
// ─────────────────────────────────────────────────────────────────────────────

const kb = (n: number) => (n >= 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** Remaining life of a session, phrased for a human watching a countdown. */
function remaining(expiresAt: string): { label: string; expired: boolean } {
  const ms = Date.parse(expiresAt) - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return { label: "expired", expired: true };
  const m = Math.floor(ms / 60000);
  return { label: m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m left` : `${m}m left`, expired: false };
}

interface Payload {
  session: BufferSession & { content_text: string };
  download: string | null;
}

type Pane = "sessions" | "selection";

const GhostBufferConsole = () => {
  const [pane, setPane] = useState<Pane>("sessions");
  const [sessions, setSessions] = useState<BufferSession[] | null>(null);
  const [listing, setListing] = useState(false);
  const [purging, setPurging] = useState(false);

  const [terms, setTerms] = useState("");
  const [regex, setRegex] = useState("");
  const [mode, setMode] = useState<"any" | "all">("any");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [hostFilter, setHostFilter] = useState("");
  const [encryptedOnly, setEncryptedOnly] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [hits, setHits] = useState<ContentHit[] | null>(null);
  const [scanned, setScanned] = useState(0);

  const [payload, setPayload] = useState<Payload | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  // A countdown that never ticks is a lie. One interval drives every clock in
  // the pane; it is torn down with the component.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const call = useCallback(async <T,>(body: Record<string, unknown>): Promise<T | null> => {
    const { data, error } = await supabase.functions.invoke("ghost-engine", { body });
    if (error) {
      const detail = "context" in error && error.context ? await error.context.text().catch(() => "") : "";
      let message = detail.slice(0, 300) || error.message;
      try { const j = JSON.parse(detail); if (j?.error) message = j.error; } catch { /* plain text */ }
      toast({ title: "Buffer request failed", description: message, variant: "destructive" });
      return null;
    }
    if ((data as { error?: string })?.error) {
      toast({ title: "Rejected", description: (data as { error: string }).error, variant: "destructive" });
      return null;
    }
    return data as T;
  }, []);

  const refresh = useCallback(async () => {
    if (listing) return;
    setListing(true);
    const res = await call<{ sessions: BufferSession[] }>({ action: "buffer" });
    if (alive.current) {
      if (res) setSessions(res.sessions || []);
      setListing(false);
    }
  }, [call, listing]);

  useEffect(() => { void refresh(); /* first paint loads the shelf */ }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const purge = useCallback(async () => {
    if (purging) return;
    setPurging(true);
    const res = await call<{ purged: number }>({ action: "purge" });
    if (alive.current) {
      if (res) {
        setSessions([]);
        setHits(null);
        setPayload(null);
        toast({ title: "Buffer purged", description: `${res.purged} session${res.purged === 1 ? "" : "s"} destroyed.` });
      }
      setPurging(false);
    }
  }, [call, purging]);

  const runSelection = useCallback(async () => {
    const dictionary = terms.split(/[,\n]/).map((t) => t.trim()).filter(Boolean);
    if (!dictionary.length && !regex.trim()) {
      toast({ title: "Nothing selected", description: "Provide dictionary terms, a pattern, or both." });
      return;
    }
    setSelecting(true);
    const selector: Selector = {
      dictionary, mode, caseSensitive,
      regex: regex.trim() || undefined,
      host: hostFilter.trim() || undefined,
      encryptedOnly: encryptedOnly || undefined,
    };
    const res = await call<{ hits: ContentHit[]; scanned: number }>({ action: "content", selector, limit: 50 });
    if (alive.current) {
      if (res) { setHits(res.hits || []); setScanned(res.scanned || 0); }
      setSelecting(false);
    }
  }, [call, terms, regex, mode, caseSensitive, hostFilter, encryptedOnly]);

  const open = useCallback(async (sessionId: string) => {
    setOpening(sessionId);
    const res = await call<Payload>({ action: "payload", sessionId });
    if (alive.current) {
      if (res) setPayload(res);
      setOpening(null);
    }
  }, [call]);

  useEffect(() => {
    if (!payload) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPayload(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [payload]);

  const totalBytes = (sessions || []).reduce((a, s) => a + (s.content_bytes || 0), 0);

  return (
    <div>
      {/* ── Pane switch + shelf actions ─────────────────────────────── */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(["sessions", "selection"] as Pane[]).map((p) => (
          <button
            key={p}
            onClick={() => setPane(p)}
            aria-current={pane === p}
            className={`rounded-md px-2.5 py-1.5 text-[11px] capitalize transition-colors ${
              pane === p ? "bg-foreground/8 text-foreground" : "text-muted-foreground/55 hover:text-foreground/80"
            }`}
          >
            {p === "sessions" ? "Retained sessions" : "Soft selection"}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 text-[10px] text-muted-foreground/50">
          {sessions && <span>{sessions.length} on shelf · {kb(totalBytes)}</span>}
          <button
            onClick={refresh}
            disabled={listing}
            className="flex items-center gap-1 rounded border border-border/20 px-2 py-1 transition-colors hover:text-foreground disabled:opacity-40"
          >
            {listing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Refresh
          </button>
          <button
            onClick={purge}
            disabled={purging || !sessions?.length}
            className="flex items-center gap-1 rounded border border-border/20 px-2 py-1 transition-colors hover:text-foreground disabled:opacity-40"
          >
            {purging ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />} Purge
          </button>
        </div>
      </div>

      {/* ── Sessions ─────────────────────────────────────────────────── */}
      {pane === "sessions" && (
        <div className="space-y-2" aria-live="polite">
          {sessions === null && listing && Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg border border-border/10 bg-foreground/[0.02]" />
          ))}

          {sessions?.length === 0 && (
            <div className="rounded-lg border border-border/12 px-4 py-8 text-center">
              <Archive className="mx-auto mb-3 h-6 w-6 text-foreground/20" />
              <p className="text-xs text-muted-foreground/70">The shelf is empty.</p>
              <p className="mx-auto mt-2 max-w-md text-[11px] leading-relaxed text-muted-foreground/45">
                Run a sweep with <span className="text-foreground/70">Retain bodies</span> armed. The engine will keep each
                session's payload for a bounded window so it can be reopened and searched, then destroy it on schedule.
              </p>
            </div>
          )}

          {sessions?.map((s) => {
            const life = remaining(s.expires_at);
            return (
              <button
                key={s.session_id}
                onClick={() => open(s.session_id)}
                disabled={opening === s.session_id}
                className="w-full rounded-lg border border-border/12 bg-foreground/[0.015] px-3 py-2.5 text-left transition-colors hover:border-foreground/25 disabled:opacity-50"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-xs text-foreground/90">{s.host || s.url}</span>
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground/40">
                    {opening === s.session_id ? "opening…" : life.label}
                  </span>
                </div>
                <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground/40">{s.url}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground/55">
                  <span>{s.source_type}</span>
                  <span>{kb(s.content_bytes)}</span>
                  <span>{s.text_chars.toLocaleString()} chars{s.truncated ? " (truncated)" : ""}</span>
                  {s.language_tag && <span>lang {s.language_tag}</span>}
                  <span>H {s.entropy.toFixed(2)}</span>
                  {s.is_encrypted && (
                    <span className="flex items-center gap-1 text-foreground/80"><Lock className="h-2.5 w-2.5" /> opaque</span>
                  )}
                  {s.emails.length > 0 && <span>{s.emails.length} addr</span>}
                  {s.filenames.length > 0 && <span>{s.filenames.length} files</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Soft selection ───────────────────────────────────────────── */}
      {pane === "selection" && (
        <div>
          <form
            onSubmit={(e) => { e.preventDefault(); void runSelection(); }}
            className="mb-4 space-y-2 rounded-lg border border-border/15 bg-foreground/[0.015] p-3"
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground/45">Dictionary</span>
                <input
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  placeholder="comma separated terms"
                  className="w-full rounded-md border border-border/20 bg-transparent px-2 py-1.5 text-xs text-foreground outline-none focus:border-foreground/30 placeholder:text-muted-foreground/35"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground/45">Pattern</span>
                <input
                  value={regex}
                  onChange={(e) => setRegex(e.target.value)}
                  placeholder="regex, e.g. \b[A-Z]{3,6}INT\b"
                  spellCheck={false}
                  className="w-full rounded-md border border-border/20 bg-transparent px-2 py-1.5 font-mono text-xs text-foreground outline-none focus:border-foreground/30 placeholder:text-muted-foreground/35"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground/60">
              <div className="flex items-center gap-1">
                {(["any", "all"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    aria-pressed={mode === m}
                    className={`rounded border px-2 py-0.5 uppercase tracking-wider transition-colors ${
                      mode === m ? "border-foreground/35 text-foreground" : "border-border/20 hover:text-foreground/80"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)} className="accent-foreground/70" />
                Case sensitive
              </label>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={encryptedOnly} onChange={(e) => setEncryptedOnly(e.target.checked)} className="accent-foreground/70" />
                Opaque only
              </label>
              <input
                value={hostFilter}
                onChange={(e) => setHostFilter(e.target.value)}
                placeholder="host filter"
                className="w-32 rounded border border-border/20 bg-transparent px-2 py-0.5 text-[10px] outline-none focus:border-foreground/30"
              />
              <button
                type="submit"
                disabled={selecting}
                className="ml-auto flex items-center gap-1.5 rounded-md border border-border/25 px-3 py-1.5 text-xs text-foreground/80 transition-colors hover:bg-foreground/5 disabled:opacity-35"
              >
                {selecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                Select
              </button>
            </div>
          </form>

          {hits === null && (
            <p className="text-xs text-muted-foreground/45">
              Selection runs over retained bodies only — the card catalog narrows first, then the shelf is opened.
            </p>
          )}

          {hits?.length === 0 && (
            <p className="text-xs text-muted-foreground/45">
              No payload in the buffer matched. {scanned} session{scanned === 1 ? "" : "s"} scanned.
            </p>
          )}

          <div className="space-y-2" aria-live="polite">
            {hits?.map((h) => (
              <div key={h.session_id} className="rounded-lg border border-border/12 bg-foreground/[0.015] px-3 py-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-xs text-foreground/90">{h.host}</span>
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground/40">{h.matches} hit{h.matches === 1 ? "" : "s"}</span>
                </div>
                <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground/40">{h.url}</p>
                {h.terms.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {h.terms.map((t) => (
                      <span key={t} className="rounded border border-border/20 px-1.5 py-0.5 text-[10px] text-foreground/75">{t}</span>
                    ))}
                  </div>
                )}
                <div className="mt-2 space-y-1">
                  {h.snippets.slice(0, 4).map((s, i) => (
                    <p key={i} className="rounded bg-foreground/[0.03] px-2 py-1 text-[11px] leading-relaxed text-muted-foreground/75">
                      {s.text}
                    </p>
                  ))}
                </div>
                <button
                  onClick={() => open(h.session_id)}
                  className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground/55 transition-colors hover:text-foreground"
                >
                  <FileText className="h-3 w-3" /> Open payload
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Payload drawer ───────────────────────────────────────────── */}
      {payload && (
        <>
          <div className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm" onClick={() => setPayload(null)} aria-hidden />
          <div
            role="dialog"
            aria-label="Buffered payload"
            className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-border/20 bg-card/95 shadow-2xl backdrop-blur-xl sm:max-w-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-border/15 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-xs text-foreground/90">{payload.session.host}</p>
                <p className="truncate font-mono text-[10px] text-muted-foreground/45">{payload.session.url}</p>
              </div>
              <button onClick={() => setPayload(null)} aria-label="Close payload" className="rounded p-1 text-muted-foreground/60 hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border/10 px-4 py-2 text-[10px] text-muted-foreground/55">
              <span>{payload.session.source_type}</span>
              <span>{kb(payload.session.content_bytes)}</span>
              <span>H {payload.session.entropy.toFixed(2)}</span>
              <span>{remaining(payload.session.expires_at).label}</span>
              <a
                href={payload.session.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="flex items-center gap-1 transition-colors hover:text-foreground"
              >
                <ExternalLink className="h-3 w-3" /> Source
              </a>
              {payload.download && (
                <a
                  href={payload.download}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 transition-colors hover:text-foreground"
                >
                  <Download className="h-3 w-3" /> Raw bytes
                </a>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3">
              {payload.session.content_text ? (
                <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-foreground/80">
                  {payload.session.content_text}
                </pre>
              ) : (
                <p className="mt-8 text-center text-xs text-muted-foreground/50">
                  No recoverable text. The body is {payload.session.is_encrypted ? "opaque — encrypted or compressed beyond extraction" : "binary"}.
                  {payload.download ? " Download the raw bytes to examine it." : ""}
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default GhostBufferConsole;
