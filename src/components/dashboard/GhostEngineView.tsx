import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Ghost, Loader2, Search, Fingerprint, AlertTriangle, Network, Clock, Layers,
  Download, Archive, ChevronDown, Sparkle, History, X, Crosshair, Filter,
  Paperclip, Hourglass,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { exportJSON } from "@/lib/exportEngine";
import GhostRecordPanel from "./ghost/GhostRecordPanel";
import GhostGraph from "./ghost/GhostGraph";
import GhostBufferConsole from "./ghost/GhostBufferConsole";
import GhostSearchResults from "./ghost/GhostSearchResults";
import GhostHistoryRail from "./ghost/GhostHistoryRail";
import { OriginPanel, type OriginTrace } from "./ghost/OriginPanel";
import { IdentifierSweepPanel, type IdentifierSweepReport } from "./ghost/IdentifierSweepPanel";
import { DeepTimePanel, type TimeMachineReport } from "./ghost/DeepTimePanel";
import {
  projectRecords, suggestFromIndex,
  type GhostHistoryRun, type GhostSearchResponse, type GhostSearchResult, type SearchScope,
} from "./ghost/searchFormat";
import {
  resolveRoute, MODE_LABEL, MODE_BLURB,
  type GhostMode, type GhostRoute,
} from "./ghost/modeRouting";
import { SEVERITY_STYLE, type GhostRecord } from "./ghost/types";



// ─────────────────────────────────────────────────────────────────────────────
// ASHERIN GHOST ENGINE
//
// One box, one Enter, a ranked list. That is the whole front door. Underneath,
// the same two layers as always: plug-ins carve labels out of every session
// into a card catalog, and — when bodies are retained — the payloads sit on a
// self-expiring shelf that dictionary and pattern selection can reopen.
//
// The operator does not choose a layer. They ask; the engine consults both and
// merges the answer. The forensic tabs (shells, entities, graph, timeline,
// anomalies, facets, buffer) live behind a disclosure for when the list is not
// enough.
// ─────────────────────────────────────────────────────────────────────────────

type Tab = "records" | "entities" | "graph" | "timeline" | "anomalies" | "facets" | "buffer";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "records", label: "Shells", icon: Layers },
  { id: "entities", label: "Entities", icon: Fingerprint },
  { id: "graph", label: "Graph", icon: Network },
  { id: "timeline", label: "Timeline", icon: Clock },
  { id: "anomalies", label: "Anomalies", icon: AlertTriangle },
  { id: "facets", label: "Facets", icon: Ghost },
  { id: "buffer", label: "Buffer", icon: Archive },
];

const SCOPES: { id: SearchScope; label: string; hint: string }[] = [
  { id: "all", label: "All", hint: "Sweep the open index and search retained bodies" },
  { id: "web", label: "Web", hint: "Metadata sweep only — never opens a body" },
  { id: "buffer", label: "Buffer", hint: "Soft selection over bodies already on the shelf" },
];

/** ORIGIN and DEEP TIME are not scopes — they are different questions, so they
 *  get their own verbs rather than being folded into the intercept scope knob.
 *  AUTO is the fifth position on that dial: it reads the input and picks the
 *  verb, out loud, with the choice one click from being overruled. */
const MODE_KEY = "ghost_engine_mode";


const CAPTURE_KEY = "ghost_engine_capture";
const FILTER_KEY = "ghost_engine_filter";
const SCOPE_KEY = "ghost_engine_scope";
const RECENT_KEY = "ghost_engine_recent";
const RAIL_KEY = "ghost_engine_rail";


const STARTERS = [
  "asherin.com",
  "encrypted documents pdf producer",
  "site:gov.uk annual report filetype:pdf",
  "exif gps camera model",
];

const fmt = (iso: string | null) => (iso ? `${iso.replace("T", " ").slice(0, 16)}Z` : "—");

const GhostEngineView = () => {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<GhostSearchResponse | null>(null);
  const [scope, setScope] = useState<SearchScope>(
    () => (localStorage.getItem(SCOPE_KEY) as SearchScope) || "all",
  );
  const [tab, setTab] = useState<Tab>("records");
  const [details, setDetails] = useState(false);
  const [selected, setSelected] = useState<GhostRecord | null>(null);
  // Retention defaults ON. A metadata hit the operator cannot reopen and read
  // is a card catalog with no library behind it — the shelf is the point.
  const [capture, setCapture] = useState<boolean>(() => localStorage.getItem(CAPTURE_KEY) !== "0");
  // Zophiel web filter — suppress reference corpora, content farms, commerce
  // listings, search containers and mirrored duplicates before ranking.
  const [noiseFilter, setNoiseFilter] = useState<boolean>(() => localStorage.getItem(FILTER_KEY) !== "0");
  const [bufferNonce, setBufferNonce] = useState(0);
  // The HISTORY rail is a sibling surface, not a dropdown: it refetches when a
  // run completes, and it can push an archived run back into the result pane.
  const [historyNonce, setHistoryNonce] = useState(0);
  const [railOpen, setRailOpen] = useState<boolean>(
    () => localStorage.getItem(RAIL_KEY) !== "0",
  );
  const [replay, setReplay] = useState<GhostHistoryRun | null>(null);
  const [suggestOpen, setSuggestOpen] = useState(false);
  // INTERCEPT sweeps a selector. ORIGIN traces one artefact — a link or a file
  // the operator holds — back to the act of authorship behind it. DEEP TIME
  // reaches past the live web into the capture archives. IDENTIFIER confirms an
  // address or number page by page.
  //
  // The verb used to be a setting the operator had to get right BEFORE typing,
  // and getting it wrong was silent: a PDF URL pasted under INTERCEPT ran a
  // keyword sweep on a URL string and returned nothing, with no indication that
  // the wrong engine had been asked. AUTO reads the input, states the verb it
  // inferred and why, and leaves the override one click away. A deliberate
  // override sticks — the classifier never quietly takes the wheel back.
  const [route, setRoute] = useState<GhostRoute>(() => {
    const saved = localStorage.getItem(MODE_KEY);
    return saved === "origin" || saved === "deeptime" || saved === "identifier" ||
      saved === "intercept" || saved === "auto"
      ? saved
      : "auto";
  });
  const pickRoute = useCallback((r: GhostRoute) => {
    setRoute(r);
    localStorage.setItem(MODE_KEY, r);
  }, []);
  // Routing for what is currently in the box — drives the banner and the
  // placeholder. The RUN path re-derives from its own argument, because a
  // suggestion click fires with a selector the input state has not caught yet.
  const routing = useMemo(() => resolveRoute(route, query), [route, query]);
  const mode: GhostMode = routing.mode;
  const [origin, setOrigin] = useState<OriginTrace | null>(null);
  const [deepTime, setDeepTime] = useState<TimeMachineReport | null>(null);
  const [sweep, setSweep] = useState<IdentifierSweepReport | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);


  const [recent, setRecent] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]").slice(0, 8); } catch { return []; }
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const run = useCallback(async (
    raw: string,
    scopeOverride?: SearchScope,
    modeOverride?: GhostMode,
  ) => {
    const q = raw.trim();
    if (!q || loading) return;
    const useScope = scopeOverride ?? scope;
    // Re-derive the verb from the string actually being run. A suggestion or a
    // pivot fires with a selector the input state has not received yet, and
    // routing off stale state is how a pivoted URL got keyword-swept.
    const mode: GhostMode = modeOverride ?? resolveRoute(route, q).mode;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = setTimeout(() => controller.abort(), 180_000);

    setLoading(true);
    setSuggestOpen(false);
    setSelected(null);
    setReplay(null);
    try {
      // ── ORIGIN path ──────────────────────────────────────────────────────
      if (mode === "origin") {
        setOrigin(null);
        const { data: res, error } = await supabase.functions.invoke("ghost-engine", {
          body: { action: "origin", query: q },
        });
        if (controller.signal.aborted) return;
        if (error) {
          const detail = "context" in error && error.context ? await error.context.text().catch(() => "") : "";
          toast({
            title: /403|Pro/.test(detail) ? "Origin trace is an Asherin Pro surface" : "Trace failed",
            description: detail.slice(0, 240) || error.message,
            variant: "destructive",
          });
          return;
        }
        const trace = (res as { trace?: OriginTrace })?.trace ?? null;
        setOrigin(trace);
        setData(null);
        if (trace?.errors.length) {
          toast({ title: "Trace incomplete", description: trace.errors[0] });
        }
        setRecent((prev) => {
          const next = [q, ...prev.filter((r) => r !== q)].slice(0, 8);
          localStorage.setItem(RECENT_KEY, JSON.stringify(next));
          return next;
        });
        return;
      }

      // ── IDENTIFIER path ──────────────────────────────────────────────────
      // The engine opens every candidate itself and only counts a page once
      // the identifier is actually on it, so this leg is slower than intercept
      // by design — the wait buys confirmation instead of a list of maybes.
      if (mode === "identifier") {
        setSweep(null);
        const { data: res, error } = await supabase.functions.invoke("ghost-engine", {
          body: { action: "identifier", query: q },
        });
        if (controller.signal.aborted) return;
        if (error) {
          const detail = "context" in error && error.context ? await error.context.text().catch(() => "") : "";
          toast({
            title: /403|Pro/.test(detail) ? "Identifier sweep is an Asherin Pro surface" : "Sweep failed",
            description: detail.slice(0, 240) || error.message,
            variant: "destructive",
          });
          return;
        }
        const report = (res as { report?: IdentifierSweepReport })?.report ?? null;
        setSweep(report);
        setData(null);
        setRecent((prev) => {
          const next = [q, ...prev.filter((r) => r !== q)].slice(0, 8);
          localStorage.setItem(RECENT_KEY, JSON.stringify(next));
          return next;
        });
        return;
      }

      // ── DEEP TIME path ───────────────────────────────────────────────────
      // Hosts the live intercept already tied to this selector are carried in,
      // because a capture index cannot be asked about a person — only about a
      // URL. Handing it the hosts is what makes a name reachable at all.
      if (mode === "deeptime") {
        setDeepTime(null);
        const carried = Array.from(new Set([
          ...(data?.index?.records ?? []).map((r) => r.host).filter(Boolean),
          ...(origin?.selectors?.hosts ?? []),
        ])).slice(0, 8);
        const { data: res, error } = await supabase.functions.invoke("ghost-engine", {
          body: { action: "timeline", query: q, hosts: carried },
        });
        if (controller.signal.aborted) return;
        if (error) {
          const detail = "context" in error && error.context ? await error.context.text().catch(() => "") : "";
          toast({
            title: /403|Pro/.test(detail) ? "Deep time is an Asherin Pro surface" : "Reach-back failed",
            description: detail.slice(0, 240) || error.message,
            variant: "destructive",
          });
          return;
        }
        setDeepTime((res as { report?: TimeMachineReport })?.report ?? null);
        setRecent((prev) => {
          const next = [q, ...prev.filter((r) => r !== q)].slice(0, 8);
          localStorage.setItem(RECENT_KEY, JSON.stringify(next));
          return next;
        });
        return;
      }



      const { data: res, error } = await supabase.functions.invoke("ghost-engine", {
        // No client-side aperture. The probe budget is the engine's to spend;
        // sending 12 was what capped a full-spectrum lookup at a page of links.
        body: { action: "search", scope: useScope, query: q, capture, noiseFilter },
      });

      if (controller.signal.aborted) return;

      if (error) {
        const detail = "context" in error && error.context ? await error.context.text().catch(() => "") : "";
        const denied = /403|Pro/.test(detail) || /403/.test(error.message);
        toast({
          title: denied ? "Asherin Engine is an Asherin Pro surface" : "Search failed",
          description: denied
            ? "Metadata indexing and the payload buffer are included with the $399 plan and its 6-month term."
            : detail.slice(0, 240) || error.message,
          variant: "destructive",
        });
        return;
      }

      const payload = res as GhostSearchResponse;
      setData(payload);
      setDetails(false);
      setTab(payload.index?.anomalies.length ? "anomalies" : "records");
      // A completed run is a new history row; the rail must reflect it.
      setHistoryNonce((n) => n + 1);
      if (payload.error) toast({ title: "No targets resolved", description: payload.error });

      if (payload.buffer) {
        setBufferNonce((n) => n + 1);
        toast({
          title: payload.buffer.captured
            ? `${payload.buffer.captured} session${payload.buffer.captured === 1 ? "" : "s"} buffered`
            : "Nothing retained",
          description: payload.buffer.captured
            ? `Bodies are searchable for ~${payload.buffer.ttlMinutes} minutes, then destroyed.`
            : payload.buffer.errors[0] || "No target returned a retainable body.",
        });
      }

      setRecent((prev) => {
        const next = [q, ...prev.filter((r) => r !== q)].slice(0, 8);
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
        return next;
      });
    } catch (e) {
      if (!controller.signal.aborted) {
        toast({ title: "Search failed", description: (e as Error).message, variant: "destructive" });
      } else {
        toast({ title: "Search timed out", description: "The fan-out exceeded 180 seconds.", variant: "destructive" });
      }
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }, [loading, capture, scope, route, noiseFilter, data, origin]);

  /**
   * ORIGIN for a file the operator holds. Read as bytes in the browser, sent as
   * base64, carved server-side by the same extractor a link trace uses — so an
   * emailed PDF and a hosted one produce the identical dossier, minus the
   * transport layer the emailed one never had.
   */
  const MAX_UPLOAD = 12 * 1024 * 1024;
  const onUpload = useCallback(async (file: File) => {
    if (uploading || loading) return;
    if (file.size > MAX_UPLOAD) {
      toast({
        title: "File too large",
        description: `${(file.size / 1048576).toFixed(1)} MB exceeds the 12 MB inspection window.`,
        variant: "destructive",
      });
      return;
    }
    setUploading(true);
    setOrigin(null);
    // An attached file has no URL, so ORIGIN is the only verb that can read it.
    pickRoute("origin");
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      // Chunked conversion — String.fromCharCode on a multi-MB spread blows the
      // call stack, which is how a large upload silently became a blank panel.
      let bin = "";
      for (let i = 0; i < buf.length; i += 0x8000) {
        bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      }
      const { data: res, error } = await supabase.functions.invoke("ghost-engine", {
        body: {
          action: "upload",
          file: { filename: file.name, contentType: file.type, base64: btoa(bin) },
        },
      });
      if (error) {
        const detail = "context" in error && error.context ? await error.context.text().catch(() => "") : "";
        toast({
          title: /403|Pro/.test(detail) ? "Origin trace is an Asherin Pro surface" : "Inspection failed",
          description: detail.slice(0, 240) || error.message,
          variant: "destructive",
        });
        return;
      }
      const trace = (res as { trace?: OriginTrace })?.trace ?? null;
      setOrigin(trace);
      setData(null);
      setQuery(file.name);
      if (trace?.errors.length) toast({ title: "Inspection incomplete", description: trace.errors[0] });
    } catch (e) {
      toast({ title: "Inspection failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [uploading, loading]);



  const index = data?.index ?? null;

  // The projection is authoritative when the backend supplies it; otherwise it
  // is rebuilt locally so an older response still renders a list. An archived
  // run opened from the HISTORY rail overrides both — the operator is reading
  // what the engine saw *then*, and the banner says so.
  const results: GhostSearchResult[] = useMemo(() => {
    if (replay) return replay.results ?? [];
    if (data?.results?.length) return data.results;
    return index ? projectRecords(index) : [];
  }, [replay, data, index]);


  const suggestions = useMemo(() => {
    if (data?.suggestions?.length) return data.suggestions;
    return index ? suggestFromIndex(index) : [];
  }, [data, index]);

  const recordById = useMemo(
    () => new Map((index?.records ?? []).map((r) => [r.entity_id, r])),
    [index],
  );

  const counts = useMemo(() => ({
    records: index?.records.length ?? 0,
    entities: index?.cards.length ?? 0,
    graph: index?.graph.nodes.length ?? 0,
    timeline: index?.timeline.length ?? 0,
    anomalies: index?.anomalies.length ?? 0,
    facets: index?.facets.length ?? 0,
    buffer: undefined,
  }), [index]) as Record<Tab, number | undefined>;

  const typeahead = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = [...recent, ...suggestions];
    const seen = new Set<string>();
    return pool
      .filter((s) => {
        const k = s.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return !q || (k.includes(q) && k !== q);
      })
      .slice(0, 7);
  }, [query, recent, suggestions]);

  const setScopePersist = (s: SearchScope) => {
    setScope(s);
    localStorage.setItem(SCOPE_KEY, s);
    if (query.trim() && data) run(query, s);
  };

  const toggleRail = () => setRailOpen((o) => {
    localStorage.setItem(RAIL_KEY, o ? "0" : "1");
    return !o;
  });

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── HISTORY rail — the persistent half of the dual sidebar ────── */}
      {railOpen && (
        <aside className="hidden w-64 shrink-0 border-r border-border/15 bg-foreground/[0.015] lg:flex lg:flex-col">
          <GhostHistoryRail
            nonce={historyNonce}
            activeKey={data?.identity?.key}
            onReplay={(q) => { setQuery(q); void run(q); }}
            onOpenRun={(r) => { setReplay(r); setQuery(r.query); }}
          />
        </aside>
      )}

      <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
      {/* ── Search bar ───────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-border/15 px-5 py-4">
        <div className="mx-auto max-w-3xl">
          <div className="mb-3 flex items-center gap-2">
            <Ghost className="h-4 w-4 text-foreground/70" />
            <h1 className="text-sm font-normal tracking-wide text-foreground">Asherin Engine</h1>
            <span className="rounded border border-border/25 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.15em] text-muted-foreground/50">
              {capture ? "Metadata + buffer" : "Metadata only"}
            </span>
            <button
              onClick={toggleRail}
              aria-pressed={railOpen}
              className="ml-auto hidden items-center gap-1.5 rounded border border-border/20 px-2 py-1 text-[10px] text-muted-foreground/60 transition-colors hover:text-foreground lg:flex"
            >
              <History className="h-3 w-3" />
              {railOpen ? "Hide history" : "History"}
            </button>
          </div>


          <div className="relative">
            <form
              onSubmit={(e) => { e.preventDefault(); run(query); }}
              className="flex items-center gap-2 rounded-full border border-border/20 bg-foreground/[0.03] px-4 py-2.5 focus-within:border-foreground/30"
            >
              <Search className="h-4 w-4 shrink-0 text-muted-foreground/45" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setSuggestOpen(true); }}
                onFocus={() => setSuggestOpen(true)}
                onBlur={() => setTimeout(() => setSuggestOpen(false), 120)}
                onKeyDown={(e) => { if (e.key === "Escape") setSuggestOpen(false); }}
                placeholder={
                  mode === "origin"
                    ? "Paste a link — or attach a file — to trace where it was made…"
                    : mode === "deeptime"
                      ? "Reach back: a name, an email, a domain — 1996 to today…"
                      : mode === "identifier"
                        ? "Paste an email address or a phone number…"
                        : "Search a domain, a name, a phrase, a pattern…"
                }
                aria-label={
                  mode === "origin" ? "Asherin Engine origin trace"
                    : mode === "deeptime" ? "Asherin Engine archive reach-back"
                      : mode === "identifier" ? "Asherin Engine identifier sweep"
                        : "Asherin Engine search"
                }
                autoComplete="off"
                className="flex-1 bg-transparent text-sm font-light text-foreground outline-none placeholder:text-muted-foreground/35"
              />
              {/* A document that arrived by mail can never be traced by link —
                  the attach path is the only way its provenance is reachable. */}
              {mode === "origin" && (
                <>
                  <input
                    ref={fileRef}
                    type="file"
                    className="sr-only"
                    accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff,.heic,.docx,.xlsx,.pptx,.html,.htm,application/pdf,image/*"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) void onUpload(f); }}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading || loading}
                    title="Inspect a document you hold — metadata, authoring clock, lineage, and every selector inside it"
                    className="flex shrink-0 items-center gap-1.5 rounded-full border border-border/25 px-2.5 py-1 text-[10.5px] text-muted-foreground/60 transition-colors hover:border-foreground/35 hover:text-foreground disabled:opacity-40"
                  >
                    {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />}
                    {uploading ? "Reading" : "Attach"}
                  </button>
                </>
              )}
              {mode === "intercept" && (
                <button
                  type="button"
                  role="switch"
                  aria-checked={capture}
                  onClick={() => setCapture((c) => { localStorage.setItem(CAPTURE_KEY, c ? "0" : "1"); return !c; })}
                  title="Retain each session body in a self-expiring buffer so it can be reopened and searched"
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] transition-colors ${
                    capture
                      ? "border-foreground/40 bg-foreground/8 text-foreground"
                      : "border-border/25 text-muted-foreground/55 hover:text-foreground/80"
                  }`}
                >
                  <Archive className="h-3 w-3" />
                  Retain
                </button>
              )}
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-border/25 px-3 py-1 text-xs text-foreground/80 transition-colors hover:bg-foreground/5 disabled:opacity-35"
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                {loading
                  ? (mode === "origin" ? "Tracing" : mode === "deeptime" ? "Reaching back" : mode === "identifier" ? "Confirming" : "Searching")
                  : (mode === "origin" ? "Trace" : mode === "deeptime" ? "Reach back" : mode === "identifier" ? "Sweep" : "Search")}
              </button>

            </form>

            {suggestOpen && typeahead.length > 0 && (
              <ul className="absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl border border-border/20 bg-card shadow-xl">
                {typeahead.map((s) => (
                  <li key={s}>
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { setQuery(s); run(s); }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-[12px] text-muted-foreground/75 transition-colors hover:bg-foreground/5 hover:text-foreground"
                    >
                      {s.includes(":") ? <Sparkle className="h-3 w-3 opacity-50" /> : <Clock className="h-3 w-3 opacity-50" />}
                      <span className="truncate">{s}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Verb first, then scope. ORIGIN hides the scope knob because a
              provenance trace consults neither the index nor the buffer. */}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <div className="mr-1 flex items-center gap-1 rounded-full border border-border/20 p-0.5">
              {([
                { id: "intercept" as const, label: "Intercept", hint: "Sweep a selector across the open index" },
                { id: "origin" as const, label: "Origin", hint: "Trace one link or attached file back to when, where and on what it was made" },
                { id: "deeptime" as const, label: "Deep time", hint: "Reach into the capture archives — every year from 1996 to today" },
                { id: "identifier" as const, label: "Identifier", hint: "Paste an email or phone number — every surface it is confirmed on, with first and last seen" },
              ]).map((m) => (
                <button
                  key={m.id}
                  onClick={() => pickRoute(m.id)}
                  title={m.hint}
                  aria-pressed={mode === m.id}
                  className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] transition-colors ${
                    mode === m.id ? "bg-foreground/10 text-foreground" : "text-muted-foreground/55 hover:text-foreground/85"
                  }`}
                >
                  {m.id === "origin" ? <Crosshair className="h-3 w-3" />
                    : m.id === "deeptime" ? <Hourglass className="h-3 w-3" />
                      : m.id === "identifier" ? <Fingerprint className="h-3 w-3" />
                        : <Search className="h-3 w-3" />}
                  {m.label}
                </button>

              ))}
            </div>
            {mode === "intercept" && SCOPES.map((s) => (
              <button
                key={s.id}
                onClick={() => setScopePersist(s.id)}
                title={s.hint}
                aria-pressed={scope === s.id}
                className={`rounded-full px-3 py-1 text-[11px] transition-colors ${
                  scope === s.id
                    ? "bg-foreground/10 text-foreground"
                    : "text-muted-foreground/55 hover:text-foreground/85"
                }`}
              >
                {s.label}
              </button>
            ))}
            {mode === "intercept" && (
              <button
                type="button"
                role="switch"
                aria-checked={noiseFilter}
                onClick={() => setNoiseFilter((f) => {
                  localStorage.setItem(FILTER_KEY, f ? "0" : "1");
                  return !f;
                })}
                title="Zophiel web filter — cut encyclopedia pages, content farms, shop listings, search containers and mirrored duplicates before ranking"
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                  noiseFilter
                    ? "border-foreground/35 bg-foreground/8 text-foreground"
                    : "border-border/20 text-muted-foreground/55 hover:text-foreground/85"
                }`}
              >
                <Filter className="h-3 w-3" />
                {noiseFilter ? "Filtered" : "Raw"}
              </button>
            )}
            {mode === "intercept" && data?.harvest?.filter?.applied && data.harvest.filter.dropped > 0 && (
              <span
                className="text-[10px] text-muted-foreground/45"
                title={Object.entries(data.harvest.filter.reasons)
                  .map(([r, n]) => `${n} × ${r}`).join("\n")}
              >
                {data.harvest.filter.dropped} noise link{data.harvest.filter.dropped === 1 ? "" : "s"} cut
              </span>
            )}
            {mode === "intercept" && index && (
              <button
                onClick={() => exportJSON(
                  `ghost-search-${Date.now()}`,
                  index.records.map((r) => ({
                    title: r.host || r.url,
                    url: r.url,
                    snippet: `${r.status ?? "unreachable"} · ${r.source_type}`,
                    metadata: r as unknown as Record<string, unknown>,
                  })),
                  { query: data?.query, mode: data?.mode, scope, coverage: index.coverage },
                )}
                className="ml-auto flex items-center gap-1 rounded border border-border/20 px-2 py-1 text-[10px] text-muted-foreground/55 transition-colors hover:text-foreground"
              >
                <Download className="h-3 w-3" /> Export
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 py-6">
        <div className="mx-auto max-w-3xl">
          {mode === "origin" && !loading && !uploading && origin && (
            <OriginPanel
              trace={origin}
              onPivot={(sel) => { pickRoute("intercept"); setQuery(sel); void run(sel, undefined, "intercept"); }}
            />
          )}

          {mode === "origin" && (loading || uploading) && (
            <div className="mt-14 text-center text-sm font-light text-muted-foreground/60">
              <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin opacity-50" />
              {uploading ? "Carving the container…" : "Tracing…"}
            </div>
          )}

          {mode === "origin" && !loading && !uploading && !origin && (
            <div className="mt-14 text-center">
              <Crosshair className="mx-auto mb-4 h-8 w-8 text-foreground/20" />
              <p className="text-sm font-light text-muted-foreground/70">Give the engine one link — or one file. It gives you the act of authorship.</p>
              <p className="mx-auto mt-3 max-w-xl text-xs leading-relaxed text-muted-foreground/45">
                A PDF carries the wall clock of the machine that wrote it, the UTC offset that machine was set to,
                the software that produced it, the account that saved it, and — when a camera or scanner touched it —
                the coordinates where the sensor stood. Origin recovers those fields, resolves the offset against
                daylight saving for that exact date, reverse-geocodes any real coordinate to a building and street,
                and converts everything into your own local time. Use <span className="text-foreground/70">Attach</span>{" "}
                for a document you already hold; every email, phone number, name and address inside it comes back as a
                one-click pivot.
              </p>
            </div>
          )}

          {/* IDENTIFIER — the register of confirmed sightings. */}
          {mode === "identifier" && !loading && sweep && <IdentifierSweepPanel report={sweep} />}

          {mode === "identifier" && loading && (
            <div className="flex flex-col items-center gap-3 py-16" role="status" aria-live="polite">
              <Loader2 className="h-5 w-5 animate-spin text-foreground/40" aria-hidden />
              <p className="text-[12px] font-light text-muted-foreground/60">
                Opening each candidate and confirming the identifier is on the page…
              </p>
            </div>
          )}

          {mode === "identifier" && !loading && !sweep && (
            <div className="py-16 text-center">
              <Fingerprint className="mx-auto mb-4 h-7 w-7 text-foreground/15" aria-hidden />
              <p className="text-[13px] font-light text-muted-foreground/65">
                Paste an email address or a phone number.
              </p>
              <p className="mx-auto mt-2 max-w-lg text-[11px] leading-relaxed text-muted-foreground/45">
                The engine expands it into every written form — obfuscated, encoded, dashed,
                dotted — fans the forms across paste sites, breach indexes, record brokers,
                document surfaces and code hosts, then opens each candidate and only counts it
                once the identifier is actually on the page. You get a deduplicated list of
                surfaces with first-seen and last-seen dates and the sentence it appears in.
              </p>
            </div>
          )}

          {mode === "deeptime" && !loading && deepTime && <DeepTimePanel report={deepTime} />}

          {mode === "deeptime" && loading && (
            <div className="mt-14 text-center text-sm font-light text-muted-foreground/60">
              <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin opacity-50" />
              Walking the capture indexes…
            </div>
          )}

          {mode === "deeptime" && !loading && !deepTime && (
            <div className="mt-14 text-center">
              <Hourglass className="mx-auto mb-4 h-8 w-8 text-foreground/20" />
              <p className="text-sm font-light text-muted-foreground/70">The live web is the smaller half of the record.</p>
              <p className="mx-auto mt-3 max-w-xl text-xs leading-relaxed text-muted-foreground/45">
                Most of what was ever published about a person, a family or a company is no longer served by anyone —
                the page was deleted, the host expired, the forum closed. It survives in capture archives. Deep time
                walks the Wayback index, the Common Crawl index and the full-text corpora from 1996 forward, and
                returns a per-year ladder where every row keeps the dated capture that proves it.
              </p>
            </div>
          )}


          {mode === "intercept" && !data && !replay && !loading && (
            <div className="mt-14 text-center">
              <Ghost className="mx-auto mb-4 h-8 w-8 text-foreground/20" />
              <p className="text-sm font-light text-muted-foreground/70">Ask the catalog. Then pull the book.</p>
              <p className="mx-auto mt-3 max-w-xl text-xs leading-relaxed text-muted-foreground/45">
                Type anything. Every session the engine touches is carved into searchable labels — hosts, ASNs,
                addresses, filenames, HTTP query terms, EXIF devices, document producers, timestamps — and your words
                match those labels. Arm <span className="text-foreground/70">Retain</span> and the bodies behind the
                hits are held on a self-expiring shelf, so dictionary and pattern selection can open them before they
                age out.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-1.5">
                {(recent.length ? recent : STARTERS).map((s) => (
                  <button
                    key={s}
                    onClick={() => { setQuery(s); run(s); }}
                    className="rounded-full border border-border/15 px-3 py-1 text-[11px] text-muted-foreground/60 transition-colors hover:border-foreground/30 hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
              <button
                onClick={() => { setDetails(true); setTab("buffer"); }}
                className="mx-auto mt-6 flex items-center gap-1.5 rounded-md border border-border/20 px-3 py-1.5 text-[11px] text-muted-foreground/60 transition-colors hover:text-foreground"
              >
                <Archive className="h-3 w-3" /> Open buffer console
              </button>
            </div>
          )}

          {loading && (
            <div className="space-y-5" aria-live="polite">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-2.5 w-1/3 animate-pulse rounded bg-foreground/[0.06]" />
                  <div className="h-4 w-2/3 animate-pulse rounded bg-foreground/[0.06]" />
                  <div className="h-2.5 w-full animate-pulse rounded bg-foreground/[0.04]" />
                </div>
              ))}
            </div>
          )}

          {mode === "intercept" && !loading && (data || replay) && (
            <>
              {/* An archived run is not a live one; the surface must never
                  let the operator confuse the two. */}
              {replay && (
                <div className="mb-5 flex items-start gap-2 rounded-lg border border-border/20 bg-foreground/[0.04] px-3 py-2">
                  <History className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground/60" />
                  <div className="min-w-0 flex-1 text-[11px] leading-relaxed text-muted-foreground/70">
                    <span className="text-foreground/85">Archived intercept</span> — “{replay.query}”, run{" "}
                    {new Date(replay.created_at).toLocaleString()}. {replay.probed} shells probed of{" "}
                    {replay.leads_found} leads. This is what the engine saw then, not now.
                  </div>
                  <button
                    onClick={() => void run(replay.query)}
                    className="shrink-0 rounded border border-border/25 px-2 py-1 text-[10px] text-foreground/75 transition-colors hover:bg-foreground/5"
                  >
                    Re-intercept
                  </button>
                  <button
                    onClick={() => setReplay(null)}
                    aria-label="Close archived run"
                    className="shrink-0 rounded p-1 text-muted-foreground/45 transition-colors hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}

              {/* Harvest telemetry — the aperture, stated plainly. */}
              {!replay && data?.harvest && (
                <p className="mb-4 text-[10.5px] text-muted-foreground/45">
                  {data.identity ? `${data.identity.kind} selector · ` : ""}
                  {data.harvest.legs} discovery leg{data.harvest.legs === 1 ? "" : "s"} ·{" "}
                  {data.harvest.leads} lead{data.harvest.leads === 1 ? "" : "s"} harvested ·{" "}
                  {data.harvest.probed} probed · {data.harvest.unprobed} surfaced unprobed
                </p>
              )}

              {results.length > 0 ? (
                <GhostSearchResults
                  results={results}
                  suggestions={replay ? [] : suggestions}
                  elapsedMs={replay ? replay.elapsed_ms : (data?.elapsedMs ?? 0)}
                  scanned={replay ? replay.probed : data?.scanned}
                  onOpenRecord={(id) => { const r = recordById.get(id); if (r) setSelected(r); }}
                  onSuggest={(s) => { setQuery(s); run(s); }}
                />
              ) : (
                <p className="py-10 text-center text-xs text-muted-foreground/55">
                  {replay
                    ? "That archived run recorded no results."
                    : data?.error || (scope === "buffer"
                      ? "No retained body contains those terms. Run a search with Retain armed first."
                      : "No public target resolved for that query.")}
                </p>
              )}


              {/* ── Forensic depth, folded away until asked for ───────── */}
              <div className="mt-10 border-t border-border/10 pt-4">
                <button
                  onClick={() => setDetails((d) => !d)}
                  aria-expanded={details}
                  className="flex items-center gap-1.5 text-[11px] text-muted-foreground/55 transition-colors hover:text-foreground"
                >
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${details ? "rotate-180" : ""}`} />
                  {details ? "Hide" : "Show"} forensic index
                  <span className="text-muted-foreground/35">
                    · {counts.records} shells · {counts.anomalies} anomalies · {counts.graph} nodes
                  </span>
                </button>

                {details && (
                  <div className="mt-4">
                    {index && (
                      <div className="mb-3 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground/45">
                        <span>{data.mode === "target" ? "Direct probe" : "Discovery sweep"}</span>
                        <span>{index.coverage.indexed} shells</span>
                        <span>{index.coverage.withContainer} with container metadata</span>
                        <span>{index.coverage.withGeo} geotagged</span>
                        <span>{index.coverage.failed} unreachable</span>
                      </div>
                    )}

                    <div className="mb-4 flex flex-wrap gap-1 border-b border-border/10 pb-2">
                      {TABS.map(({ id, label, icon: Icon }) => {
                        const disabled = !index && id !== "buffer";
                        return (
                          <button
                            key={id}
                            onClick={() => setTab(id)}
                            disabled={disabled}
                            aria-current={tab === id}
                            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] transition-colors disabled:opacity-30 ${
                              tab === id ? "bg-foreground/8 text-foreground" : "text-muted-foreground/55 hover:text-foreground/80"
                            }`}
                          >
                            <Icon className="h-3 w-3" />
                            {label}
                            {counts[id] !== undefined && <span className="text-muted-foreground/35">{counts[id]}</span>}
                          </button>
                        );
                      })}
                    </div>

                    {tab === "buffer" && <GhostBufferConsole key={bufferNonce} />}

                    {index && tab === "records" && (
                      <div className="space-y-2">
                        {index.records.map((r) => (
                          <button
                            key={r.entity_id}
                            onClick={() => setSelected(r)}
                            className="w-full rounded-lg border border-border/12 bg-foreground/[0.015] px-3 py-2.5 text-left transition-colors hover:border-foreground/25"
                          >
                            <div className="flex items-baseline justify-between gap-3">
                              <span className="truncate text-xs text-foreground/90">{r.host || r.url}</span>
                              <span className="shrink-0 font-mono text-[10px] text-muted-foreground/40">
                                {r.status ?? "×"} · {r.response_ms ?? "?"}ms
                              </span>
                            </div>
                            <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground/40">{r.url}</p>
                            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground/55">
                              <span>{r.source_type}</span>
                              {r.server && <span>{r.server}</span>}
                              {r.asn && <span>{r.asn}</span>}
                              {r.author && <span>author: {r.author}</span>}
                              {r.device_id && <span>device: {r.device_id}</span>}
                              {r.created_at && <span>created {fmt(r.created_at)}</span>}
                              {r.geo_source === "exif" && <span className="text-foreground/80">EXIF GPS</span>}
                              {!r.tls && <span className="text-foreground/80">no TLS</span>}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {index && tab === "entities" && (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {index.cards.length === 0 && <p className="text-xs text-muted-foreground/45">No repeating identity dimension surfaced in this corpus.</p>}
                        {index.cards.map((c) => (
                          <div key={`${c.kind}:${c.key}`} className="rounded-lg border border-border/12 bg-foreground/[0.015] p-3">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="truncate text-xs text-foreground/90">{c.key}</span>
                              <span className="shrink-0 text-[9px] uppercase tracking-wider text-muted-foreground/45">{c.kind}</span>
                            </div>
                            <div className="mt-2 space-y-0.5 text-[10px] text-muted-foreground/60">
                              <p>{c.documents} document{c.documents === 1 ? "" : "s"} · first {fmt(c.first_seen)} · last {fmt(c.last_seen)}</p>
                              {c.activity_window && <p>Activity band: {c.activity_window}</p>}
                              {c.devices.length > 0 && <p>Devices: {c.devices.join(", ")}</p>}
                              {c.software.length > 0 && <p>Software: {c.software.join(", ")}</p>}
                              {c.geo_clusters.length > 0 && (
                                <p>Geo clusters: {c.geo_clusters.map((g) => g.label || `${g.lat.toFixed(2)},${g.lng.toFixed(2)}`).join(" · ")}</p>
                              )}
                              {c.hosts.length > 0 && <p className="truncate">Hosts: {c.hosts.join(", ")}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {index && tab === "graph" && (
                      <div className="rounded-lg border border-border/12 bg-foreground/[0.015] p-3">
                        <GhostGraph
                          nodes={index.graph.nodes}
                          edges={index.graph.edges}
                          onSelect={(n) => { const r = recordById.get(n.id); if (r) setSelected(r); }}
                        />
                        {index.keystones.length > 0 && (
                          <div className="mt-3 border-t border-border/10 pt-3">
                            <p className="mb-1.5 text-[10px] uppercase tracking-[0.15em] text-muted-foreground/45">Keystone dimensions</p>
                            <div className="flex flex-wrap gap-1.5">
                              {index.keystones.map((k) => (
                                <span key={k.id} className="rounded border border-border/20 px-2 py-0.5 text-[10px] text-foreground/75">
                                  {k.kind}: {k.label}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {index && tab === "timeline" && (
                      <ol className="relative space-y-2 border-l border-border/15 pl-4">
                        {index.timeline.length === 0 && <p className="text-xs text-muted-foreground/45">No timestamps survived publication in this corpus.</p>}
                        {index.timeline.map((e, i) => (
                          <li key={i} className="relative">
                            <span className="absolute -left-[21px] top-2 h-1.5 w-1.5 rounded-full bg-foreground/45" />
                            <button
                              onClick={() => { const r = recordById.get(e.entity_id); if (r) setSelected(r); }}
                              className="w-full rounded-md px-2 py-1.5 text-left transition-colors hover:bg-foreground/5"
                            >
                              <span className="font-mono text-[10px] text-muted-foreground/50">{fmt(e.at)}</span>
                              <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground/40">{e.kind}</span>
                              <p className="truncate text-xs text-foreground/85">{e.label}</p>
                              <p className="truncate text-[10px] text-muted-foreground/40">{e.host}</p>
                            </button>
                          </li>
                        ))}
                      </ol>
                    )}

                    {index && tab === "anomalies" && (
                      <div className="space-y-2">
                        {index.anomalies.length === 0 && (
                          <p className="text-xs text-muted-foreground/45">
                            No contradictions in the shell. Absence of anomalies is not absence of activity — it usually means the
                            publisher strips metadata on upload.
                          </p>
                        )}
                        {index.anomalies.map((a, i) => (
                          <button
                            key={i}
                            onClick={() => { const r = a.entity_id ? recordById.get(a.entity_id) : null; if (r) setSelected(r); }}
                            className={`w-full rounded-lg border-l-2 border-y border-r border-y-border/10 border-r-border/10 bg-foreground/[0.015] px-3 py-2 text-left transition-colors hover:bg-foreground/[0.04] ${SEVERITY_STYLE[a.severity]}`}
                          >
                            <div className="flex items-baseline gap-2">
                              <span className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground/45">{a.severity}</span>
                              <span className="text-xs">{a.title}</span>
                            </div>
                            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground/65">{a.detail}</p>
                          </button>
                        ))}
                      </div>
                    )}

                    {index && tab === "facets" && (
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        {index.facets.map((f) => (
                          <button
                            key={`${f.field}:${f.value}`}
                            onClick={() => { const q = `${f.field}:${f.value}`; setQuery(q); run(q); }}
                            className="flex items-baseline justify-between gap-3 rounded-md border border-border/10 px-2.5 py-1.5 text-left transition-colors hover:border-foreground/25"
                          >
                            <div className="min-w-0">
                              <span className="text-[9px] uppercase tracking-wider text-muted-foreground/40">{f.field}</span>
                              <p className="truncate font-mono text-[11px] text-foreground/80">{f.value}</p>
                            </div>
                            <span className="shrink-0 text-[11px] text-muted-foreground/50">{f.count}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Buffer console is reachable before any search — the shelf outlives it. */}
          {!data && !loading && details && (
            <div className="mt-6">
              <GhostBufferConsole key={bufferNonce} />
            </div>
          )}
        </div>
      </div>
      </div>

      {selected && <GhostRecordPanel record={selected} onClose={() => setSelected(null)} />}
    </div>
  );

};

export default GhostEngineView;
