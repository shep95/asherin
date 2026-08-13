// ─────────────────────────────────────────────────────────────────────────────
// asherinx.eng — public-index search. no tap.
//
// First paint is one box. Nothing else. The engine classifies the query, asks
// a pack of public indexes in parallel, and groups what came back by field
// site. Sites that refused, timed out or hold nothing are listed under the
// results as skips with their reason — an empty index is an empty answer, not
// a silence dressed up as intelligence.
//
// Depth ($79 pro / team) widens the fan-out and unlocks the delegated carves:
// origin (provenance of one artefact), identifier (selector sweep) and the
// short retention buffer. Base ($18) gets the matched pack whole.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ChevronDown, Loader2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useIsV2 } from "@/lib/dashboardUiContext";
import { emitPull } from "@/lib/emitPull";

type Action = "query" | "classify" | "extract" | "origin" | "identifier" | "fold" | "buffer";

interface Hit {
  site: string;
  title: string;
  url: string;
  snippet?: string;
  genesis?: string[];
}

interface SiteOutcome {
  site: string;
  status: "ok" | "empty" | "skip" | "fail";
  reason?: string;
  hits: Hit[];
  took_ms: number;
}

interface QueryPayload {
  query: string;
  classification: { selector: string; domain: string; kind: string };
  hits: Hit[];
  sites: SiteOutcome[];
  unsure: string[];
  took_ms: number;
  grouped: Record<string, Hit[]>;
  depth: "basic" | "full";
}

const ACTIONS: { id: Action; label: string; hint: string; pro?: boolean }[] = [
  { id: "query", label: "query", hint: "ask the public indexes" },
  { id: "classify", label: "classify", hint: "which pack this lands in" },
  { id: "extract", label: "extract", hint: "read one public url" },
  { id: "fold", label: "fold", hint: "compact the answer into a digest" },
  { id: "origin", label: "origin", hint: "provenance of one artefact", pro: true },
  { id: "identifier", label: "identifier", hint: "sweep one selector", pro: true },
  { id: "buffer", label: "buffer", hint: "your short retention shelf", pro: true },
];

const SITE_LABEL: Record<string, string> = {
  wayback: "wayback machine", wikipedia: "wikipedia", ddg_instant: "duckduckgo",
  hn: "hacker news", github: "github", nvd: "nvd", cisa_kev: "cisa kev",
  openalex: "openalex", arxiv: "arxiv", crossref: "crossref", gdelt: "gdelt",
  urlscan: "urlscan", wikidata: "wikidata", courtlistener: "courtlistener",
  sec_efts: "sec edgar", pypi: "pypi", npm: "npm", pubmed: "pubmed",
};

const PLACEHOLDER: Record<Action, string> = {
  query: "ask the public record",
  classify: "type a query to see which pack it lands in",
  extract: "https://…",
  fold: "a query to fold",
  origin: "https://… link to an artefact",
  identifier: "an email, handle, phone or domain",
  buffer: "press run to list your shelf",
};

const AsherinxEngView = () => {
  const isV2 = useIsV2();
  const { toast } = useToast();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [action, setAction] = useState<Action>("query");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<QueryPayload | null>(null);
  const [raw, setRaw] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [openSites, setOpenSites] = useState<Record<string, boolean>>({});
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    return () => abortRef.current?.abort();
  }, []);

  const run = useCallback(async () => {
    const text = q.trim();
    if (action !== "buffer" && !text) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setBusy(true);
    setError(null);
    if (action === "query" || action === "fold") setResult(null);
    setRaw(null);

    const started = Date.now();
    try {
      const { data, error: fnError } = await supabase.functions.invoke("asherinx-engine", {
        body: {
          action,
          query: text,
          url: action === "extract" || action === "origin" ? text : undefined,
        },
      });
      if (ctrl.signal.aborted) return;
      if (fnError) throw new Error(fnError.message || "the engine did not answer.");
      if ((data as { error?: string })?.error) throw new Error(String((data as { error: string }).error));

      if (action === "query") {
        const payload = data as QueryPayload;
        setResult(payload);
        setOpenSites(Object.fromEntries(Object.keys(payload.grouped || {}).map((s) => [s, true])));
      } else {
        setRaw(data);
        if (action === "fold" && (data as { result?: QueryPayload })?.result) {
          setResult((data as { result: QueryPayload }).result);
        }
      }

      // Connect trace: the room reports what it actually ran, masked to the
      // verb and the shape of the ask — never the operator's full query body.
      void emitPull({
        organ: "asherinx-eng",
        capability: action,
        quote_masked: text ? `${text.slice(0, 48)}${text.length > 48 ? "…" : ""}` : action,
        latency_ms: Date.now() - started,
        ok: true,
      });
    } catch (e) {
      if (ctrl.signal.aborted) return;
      const msg = e instanceof Error ? e.message : "the engine did not answer.";
      setError(msg);
      void emitPull({ organ: "asherinx-eng", capability: action, ok: false, quote_masked: msg.slice(0, 64) });
      toast({ title: "asherinx.eng", description: msg, variant: "destructive" });
    } finally {
      if (!ctrl.signal.aborted) setBusy(false);
    }
  }, [action, q, toast]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void run();
    }
  };

  const siteOrder = useMemo(
    () => (result ? Object.keys(result.grouped || {}) : []),
    [result],
  );
  const skipped = useMemo(
    () => (result?.sites ?? []).filter((s) => s.status !== "ok"),
    [result],
  );

  const firstPaint = !result && !raw && !error && !busy;

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col px-4 py-6 sm:px-6">
      {!isV2 && (
        <div className="mb-6">
          <h1 className="text-lg font-extralight lowercase tracking-wide text-foreground">asherinx.eng</h1>
          <p className="mt-1 text-xs font-extralight text-muted-foreground/70">public-index search. no tap.</p>
        </div>
      )}

      {/* ── the box ─────────────────────────────────────────────────────── */}
      <div className={firstPaint ? "flex flex-1 flex-col justify-center" : ""}>
        <div className="rounded-2xl border border-border/20 bg-card/30 p-2">
          <textarea
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            placeholder={PLACEHOLDER[action]}
            className="w-full resize-none bg-transparent px-3 py-2 text-sm font-extralight text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
          />
          <div className="flex items-center justify-between gap-2 px-2 pb-1">
            <p className="truncate text-[11px] font-extralight text-muted-foreground/50">
              {ACTIONS.find((a) => a.id === action)?.hint}
            </p>
            <button
              onClick={() => void run()}
              disabled={busy || (action !== "buffer" && !q.trim())}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border/25 bg-card/50 px-3 py-1.5 text-xs font-light text-foreground transition-colors hover:bg-foreground/5 disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
              run
            </button>
          </div>
        </div>

        {/* verbs — quiet, no tool mall */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {ACTIONS.map((a) => (
            <button
              key={a.id}
              onClick={() => setAction(a.id)}
              title={a.hint}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-extralight lowercase transition-colors ${
                action === a.id
                  ? "border-border/40 bg-foreground/10 text-foreground"
                  : "border-border/15 text-muted-foreground/60 hover:text-foreground"
              }`}
            >
              {a.label}{a.pro ? " ·" : ""}
            </button>
          ))}
        </div>
        {firstPaint && (
          <p className="mt-4 text-center text-[11px] font-extralight text-muted-foreground/40">
            eighteen public indexes, asked in parallel. no wire, no dumps, no tap.
          </p>
        )}
      </div>

      {/* ── answer ──────────────────────────────────────────────────────── */}
      {error && (
        <p className="mt-6 rounded-xl border border-border/20 bg-card/20 px-4 py-3 text-xs font-extralight text-muted-foreground">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-6 min-h-0 flex-1 overflow-auto pb-8">
          <p className="mb-3 text-[11px] font-extralight text-muted-foreground/50">
            {result.classification?.domain} pack · {result.hits.length} results from{" "}
            {siteOrder.length} of {result.sites.length} indexes · {Math.round(result.took_ms / 100) / 10}s
            {result.depth === "basic" ? " · basic depth" : ""}
          </p>

          {siteOrder.map((site) => {
            const hits = result.grouped[site] ?? [];
            const open = openSites[site] !== false;
            return (
              <section key={site} className="mb-4 rounded-xl border border-border/15 bg-card/20">
                <button
                  onClick={() => setOpenSites((s) => ({ ...s, [site]: !open }))}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left"
                >
                  <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground/50 transition-transform ${open ? "" : "-rotate-90"}`} />
                  <span className="text-xs font-light lowercase text-foreground">{SITE_LABEL[site] ?? site}</span>
                  <span className="text-[11px] font-extralight text-muted-foreground/40">{hits.length}</span>
                </button>
                {open && (
                  <ul className="space-y-1 px-4 pb-3">
                    {hits.map((h, i) => (
                      <li key={`${site}-${i}`} className="rounded-lg px-2 py-2 transition-colors hover:bg-foreground/5">
                        <a
                          href={h.url}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="inline-flex items-start gap-1.5 text-xs font-light text-foreground hover:underline"
                        >
                          <span className="min-w-0">{h.title}</span>
                          <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/40" />
                        </a>
                        {h.snippet && (
                          <p className="mt-0.5 text-[11px] font-extralight leading-relaxed text-muted-foreground/60">{h.snippet}</p>
                        )}
                        {!!h.genesis?.length && (
                          <p className="mt-1 flex flex-wrap gap-1">
                            {h.genesis.map((g) => (
                              <span key={g} className="rounded border border-border/15 px-1.5 py-0.5 text-[10px] font-extralight text-muted-foreground/50">
                                {g}
                              </span>
                            ))}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}

          {!!skipped.length && (
            <div className="mt-2 rounded-xl border border-dashed border-border/15 px-4 py-3">
              <p className="mb-1.5 text-[11px] font-extralight text-muted-foreground/50">not answered</p>
              <ul className="space-y-0.5">
                {skipped.map((s) => (
                  <li key={s.site} className="text-[11px] font-extralight text-muted-foreground/40">
                    {SITE_LABEL[s.site] ?? s.site} — {s.reason ?? s.status}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {raw !== null && action !== "query" && (
        <pre className="mt-6 max-h-[60vh] overflow-auto rounded-xl border border-border/15 bg-card/20 p-4 text-[11px] font-extralight leading-relaxed text-muted-foreground">
          {JSON.stringify(raw, null, 2)}
        </pre>
      )}
    </div>
  );
};

export default AsherinxEngView;
