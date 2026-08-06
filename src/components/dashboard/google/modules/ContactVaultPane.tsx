import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2, RefreshCw, AlertTriangle, Play, ChevronRight, Trash2, Download,
  Link2, ShieldQuestion, Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

/**
 * CONTACT VAULT — automated correspondent intelligence.
 *
 * Hop 1  people who actually write to you (metadata-derived, machine senders removed)
 * Hop 2  people the hop-1 sweep exposed, held as dormant stubs until promoted
 * Hop 3  nodes reachable from two different hop-1 subjects — closed triangles
 *
 * The sweep is resumable: enqueue writes the queue, process drains it in
 * time-bounded batches, and both are idempotent, so a lost tab never
 * duplicates or loses work.
 */

type Row = {
  id: string;
  subject_name: string;
  subject_email: string | null;
  hop: number;
  via: string | null;
  status: string;
  relationship: any;
  summary: string | null;
  confidence: number;
  priority: number;
  error_message: string | null;
  built_at: string | null;
  updated_at: string;
};

type CrossLink = { label: string; kind: string; viaA: string; viaB: string; extraVia: string[]; strength: number };

async function callVault<T = any>(action: string, extra: Record<string, unknown> = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Sign in first.");
  const { data, error } = await supabase.functions.invoke("mesh-vault", { body: { action, ...extra } });
  if (error) {
    let detail = error.message;
    try { detail = (await (error as any).context?.text?.()) ?? detail; } catch { /* keep */ }
    throw new Error(detail);
  }
  if ((data as any)?.error) throw new Error((data as any).message || (data as any).error);
  return data as T;
}

const STATUS_TONE: Record<string, string> = {
  ready: "border-foreground/30 text-foreground",
  queued: "border-border/30 text-muted-foreground/70",
  building: "border-foreground/20 text-foreground/70",
  linked: "border-border/20 text-muted-foreground/60",
  failed: "border-destructive/40 text-destructive",
  skipped: "border-border/20 text-muted-foreground/40",
};

const Badge = ({ children, tone = "" }: { children: React.ReactNode; tone?: string }) => (
  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-extralight ${tone || "border-border/25 text-muted-foreground/70"}`}>
    {children}
  </span>
);

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-2xl border border-border/30 bg-card/20 p-5 space-y-4">{children}</div>
);

/** Plain-text intelligence artifact, House of Asher house style. */
function renderReport(row: Row, doc: any): string {
  const W = 78;
  const rule = (c = "─") => c.repeat(W);
  const L: string[] = [];
  L.push(rule("═"));
  L.push("HOUSE OF ASHER — MESH CONTACT DOSSIER".padStart(Math.floor((W + 37) / 2)));
  L.push(rule("═"));
  L.push(`SUBJECT      : ${row.subject_name}`);
  if (row.subject_email) L.push(`ADDRESS      : ${row.subject_email}`);
  L.push(`HOP          : ${row.hop}${row.via ? ` (via ${row.via})` : ""}`);
  L.push(`CONFIDENCE   : ${row.confidence}/100`);
  L.push(`BUILT        : ${row.built_at ?? "—"}`);
  if (doc?.jurisdiction) L.push(`JURISDICTION : ${doc.jurisdiction}`);
  L.push(rule());

  const rel = row.relationship ?? {};
  if (rel.email) {
    L.push("SECTION 1 — RELATIONSHIP TO YOU");
    L.push(`  Tier              : ${rel.tier}`);
    L.push(`  Messages          : ${(rel.received ?? 0) + (rel.sent ?? 0)} (in ${rel.received ?? 0} / out ${rel.sent ?? 0})`);
    L.push(`  Reciprocity       : ${rel.reciprocity}`);
    L.push(`  Median reply      : ${rel.medianReplyMinutes ?? "—"} min`);
    L.push(`  First / last seen : ${(rel.firstSeen ?? "").slice(0, 10)} → ${(rel.lastSeen ?? "").slice(0, 10)}`);
    L.push(`  Dormant           : ${rel.dormantDays ?? "—"} days`);
    L.push(rule());
  }

  L.push("SECTION 2 — RESOLVED IDENTITY");
  const identity = doc?.identity ?? {};
  if (!Object.keys(identity).length) L.push("  No fields resolved above the identity threshold.");
  for (const [label, facts] of Object.entries(identity) as Array<[string, any[]]>) {
    L.push(`  ${label}:`);
    for (const f of facts) {
      L.push(`    - ${f.value}  [${f.confidence}, ${f.independentDomains} domain(s)${f.authoritative ? ", authoritative" : ""}]`);
      for (const s of (f.sources ?? []).slice(0, 2)) L.push(`        ${s.url}`);
    }
  }
  L.push(rule());

  L.push("SECTION 3 — HOP 1 (DIRECT ASSOCIATES)");
  if (!doc?.hop1?.length) L.push("  none");
  for (const n of doc?.hop1 ?? []) L.push(`  - [${n.kind}] ${n.label}  (${n.confidence}, ${n.independentDomains} domain(s))`);
  L.push(rule());

  L.push("SECTION 4 — HOP 2 (ASSOCIATES OF ASSOCIATES)");
  if (!doc?.hop2?.length) L.push("  none");
  for (const n of doc?.hop2 ?? []) L.push(`  - [${n.kind}] ${n.label}${n.via ? `  via ${n.via}` : ""}  (${n.confidence})`);
  L.push(rule());

  L.push("SECTION 5 — HOP 3 (CLOSED TRIANGLES)");
  if (!doc?.hop3?.length) L.push("  n/a — no node was reachable by two independent paths.");
  for (const c of doc?.hop3 ?? []) L.push(`  - ${c.node}  ← ${c.viaA} + ${c.viaB}  (strength ${c.strength})`);
  L.push(rule());

  L.push("SECTION 6 — COLLECTION METRICS");
  const m = doc?.metrics ?? {};
  L.push(`  Documents parsed  : ${m.documentsParsed ?? 0}`);
  L.push(`  Hits / queries    : ${m.totalHits ?? 0} / ${m.queriesRun ?? 0}`);
  L.push(`  Independent domains: ${m.independentDomains ?? 0} (authoritative ${m.authoritativeSources ?? 0})`);
  L.push(`  Identity rejects  : ${m.rejectedIdentityHits ?? 0}`);
  L.push(`  Sweep time        : ${Math.round((m.elapsedMs ?? 0) / 1000)}s`);
  L.push(rule());

  L.push("SECTION 7 — NAMED GAPS");
  if (!doc?.gaps?.length) L.push("  none declared");
  for (const g of doc?.gaps ?? []) L.push(`  - ${g}`);
  L.push(rule());

  L.push("SECTION 8 — SOURCES");
  (doc?.sources ?? []).forEach((s: any, i: number) => L.push(`  [${i + 1}] (${s.bucket}) ${s.domain} — ${s.url}`));
  L.push(rule("═"));
  L.push("#houseofasher #zia");
  L.push("Derived from open sources and your own mail metadata. Verify before acting.");
  L.push(rule("═"));
  return L.join("\n");
}

const ContactVaultPane = () => {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [crossLinks, setCrossLinks] = useState<CrossLink[]>([]);
  const [status, setStatus] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<{ row: Row; doc: any } | null>(null);
  const [hint, setHint] = useState("");
  const [autoDrain, setAutoDrain] = useState(false);

  const load = useCallback(async () => {
    try {
      setErr(null);
      const [list, st] = await Promise.all([
        callVault<{ dossiers: Row[]; crossLinks: CrossLink[] }>("vault_list"),
        callVault("vault_status"),
      ]);
      setRows(list.dossiers ?? []);
      setCrossLinks(list.crossLinks ?? []);
      setStatus(st);
    } catch (e) {
      setErr((e as Error).message);
      setRows([]);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Resumable drain: one batch per tick, stops on empty queue or on error.
  useEffect(() => {
    if (!autoDrain) return;
    let cancelled = false;
    (async () => {
      while (!cancelled) {
        try {
          const r = await callVault<{ done: boolean; remaining: number; built: number }>("vault_process", {
            batch: 1, location_hint: hint,
          });
          if (cancelled) return;
          await load();
          if (r.done || r.remaining === 0) { toast.success("Vault sweep complete."); break; }
        } catch (e) {
          if (!cancelled) toast.error((e as Error).message.slice(0, 200));
          break;
        }
      }
      if (!cancelled) setAutoDrain(false);
    })();
    return () => { cancelled = true; };
  }, [autoDrain, hint, load]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try { await fn(); }
    catch (e) { toast.error((e as Error).message.slice(0, 220)); }
    finally { setBusy(null); }
  };

  const grouped = useMemo(() => ({
    hop1: (rows ?? []).filter((r) => r.hop === 1),
    hop2: (rows ?? []).filter((r) => r.hop === 2),
  }), [rows]);

  const openDossier = (row: Row) =>
    run(`open:${row.id}`, async () => {
      const r = await callVault<{ dossier: any }>("vault_get", { id: row.id });
      setOpen({ row: r.dossier, doc: r.dossier.dossier ?? {} });
    });

  const download = (row: Row, doc: any) => {
    const text = renderReport(row, doc);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `HOA_DOSSIER_${row.subject_name.replace(/\s+/g, "_").toUpperCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const queued = status?.census?.queued ?? 0;

  return (
    <div className="space-y-4">
      <Shell>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h4 className="text-xs font-light tracking-wide text-foreground">Contact Vault</h4>
            <p className="text-[11px] font-extralight text-muted-foreground/70 mt-1 max-w-xl">
              Everyone who actually corresponds with you becomes a standing dossier, expanded
              along three bounded hops. Metadata in, sourced intelligence out — no message
              bodies are stored.
            </p>
          </div>
          <Button variant="ghost" size="sm" className="text-xs font-extralight" onClick={() => void load()}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
          </Button>
        </div>

        {err && (
          <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-extralight text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" /> {err}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {[
            ["Hop 1", status?.hops?.["1"] ?? 0],
            ["Hop 2", status?.hops?.["2"] ?? 0],
            ["Ready", status?.census?.ready ?? 0],
            ["Queued", queued],
            ["Failed", status?.census?.failed ?? 0],
          ].map(([l, v]) => (
            <div key={String(l)} className="rounded-xl border border-border/20 bg-background/30 px-3 py-2">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-extralight">{l}</div>
              <div className="text-sm font-light text-foreground mt-0.5">{String(v)}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={hint} onChange={(e) => setHint(e.target.value)}
            placeholder="Jurisdiction hint (optional) — e.g. Cape Coral Florida"
            className="h-8 max-w-xs text-xs font-extralight"
          />
          <Button
            size="sm" variant="outline" className="text-xs font-extralight"
            disabled={busy === "enq" || autoDrain}
            onClick={() => run("enq", async () => {
              const r = await callVault<any>("vault_enqueue", { days: 365, max: 25 });
              toast.success(`${r.queued} subject(s) queued from ${r.messagesAnalyzed} messages.`);
              await load();
            })}
          >
            {busy === "enq" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Users className="h-3.5 w-3.5 mr-1.5" />}
            Scan correspondence
          </Button>
          <Button
            size="sm" variant="outline" className="text-xs font-extralight"
            disabled={autoDrain || queued === 0}
            onClick={() => setAutoDrain(true)}
          >
            {autoDrain ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
            {autoDrain ? "Sweeping…" : `Build dossiers (${queued})`}
          </Button>
          {autoDrain && (
            <Button size="sm" variant="ghost" className="text-xs font-extralight" onClick={() => setAutoDrain(false)}>
              Stop
            </Button>
          )}
        </div>
      </Shell>

      {/* Hop-3 cross-links across the whole vault */}
      {crossLinks.length > 0 && (
        <Shell>
          <h4 className="text-xs font-light tracking-wide text-foreground flex items-center gap-1.5">
            <Link2 className="h-3.5 w-3.5" /> Hop 3 — closed triangles in your network
          </h4>
          <div className="space-y-1.5">
            {crossLinks.slice(0, 12).map((c) => (
              <div key={c.label} className="rounded-xl border border-border/20 bg-background/30 px-3 py-2 text-xs font-extralight">
                <span className="text-foreground">{c.label}</span>
                <span className="text-muted-foreground/60"> — reachable via {c.viaA} + {c.viaB}
                  {c.extraVia.length ? ` +${c.extraVia.length} more` : ""} · strength {c.strength}</span>
              </div>
            ))}
          </div>
        </Shell>
      )}

      {/* Index */}
      <Shell>
        {rows === null && <div className="h-24 rounded-xl bg-foreground/[0.03] animate-pulse" aria-live="polite" />}
        {rows !== null && rows.length === 0 && !err && (
          <div className="text-xs font-extralight text-muted-foreground/70">
            The vault is empty. Run <span className="text-foreground">Scan correspondence</span> to
            rank the humans in your mail, then build their dossiers.
          </div>
        )}

        {(["hop1", "hop2"] as const).map((k) =>
          grouped[k].length ? (
            <div key={k} className="space-y-1.5">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-extralight">
                {k === "hop1" ? "Hop 1 — your correspondents" : "Hop 2 — surfaced by the sweep"}
              </div>
              {grouped[k].map((r) => (
                <div key={r.id} className="rounded-xl border border-border/20 bg-background/30 px-3 py-2 flex items-center gap-3">
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => (r.status === "ready" ? void openDossier(r) : toast.info(
                      r.status === "linked" ? "Promote this node to sweep it." : `Status: ${r.status}`,
                    ))}
                  >
                    <div className="text-xs font-light text-foreground truncate">
                      {r.subject_name}
                      {r.subject_email && <span className="text-muted-foreground/50"> · {r.subject_email}</span>}
                    </div>
                    <div className="text-[10px] font-extralight text-muted-foreground/60 truncate">
                      {r.summary ?? (r.via ? `via ${r.via}` : r.error_message ?? "awaiting sweep")}
                    </div>
                  </button>
                  <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
                  {r.status === "ready" && <Badge>{r.confidence}/100</Badge>}
                  {r.status === "linked" && (
                    <Button
                      size="sm" variant="ghost" className="h-7 text-[10px] font-extralight"
                      onClick={() => run(`pr:${r.id}`, async () => { await callVault("vault_promote", { id: r.id }); await load(); })}
                    >
                      <ShieldQuestion className="h-3 w-3 mr-1" /> Sweep
                    </Button>
                  )}
                  {r.status === "failed" && (
                    <Button
                      size="sm" variant="ghost" className="h-7 text-[10px] font-extralight"
                      onClick={() => run(`rf:${r.id}`, async () => { await callVault("vault_refresh", { id: r.id }); await load(); })}
                    >
                      Retry
                    </Button>
                  )}
                  <Button
                    size="sm" variant="ghost" className="h-7 w-7 p-0"
                    aria-label={`Remove ${r.subject_name}`}
                    onClick={() => run(`rm:${r.id}`, async () => { await callVault("vault_remove", { id: r.id }); await load(); })}
                  >
                    <Trash2 className="h-3 w-3 text-muted-foreground/50" />
                  </Button>
                  {r.status === "ready" && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />}
                </div>
              ))}
            </div>
          ) : null,
        )}
      </Shell>

      {/* Detail */}
      {open && (
        <Shell>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-light text-foreground">{open.row.subject_name}</h4>
              <div className="text-[10px] font-extralight text-muted-foreground/60">
                Hop {open.row.hop} · confidence {open.row.confidence}/100 · {open.doc?.jurisdiction || "jurisdiction unresolved"}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="text-xs font-extralight" onClick={() => download(open.row, open.doc)}>
                <Download className="h-3.5 w-3.5 mr-1.5" /> .txt report
              </Button>
              <Button size="sm" variant="ghost" className="text-xs font-extralight" onClick={() => setOpen(null)}>Close</Button>
            </div>
          </div>

          {Object.entries(open.doc?.identity ?? {}).map(([label, facts]: [string, any]) => (
            <div key={label} className="space-y-1">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-extralight">{label}</div>
              {facts.map((f: any, i: number) => (
                <div key={i} className="rounded-xl border border-border/20 bg-background/30 px-3 py-1.5 text-xs font-extralight">
                  <span className="text-foreground">{f.value}</span>
                  <span className="text-muted-foreground/50"> · {f.confidence} · {f.independentDomains} domain(s){f.authoritative ? " · authoritative" : ""}</span>
                </div>
              ))}
            </div>
          ))}

          {(["hop1", "hop2"] as const).map((k) => (
            (open.doc?.[k]?.length ?? 0) > 0 && (
              <div key={k} className="space-y-1">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-extralight">
                  {k === "hop1" ? "Hop 1 associates" : "Hop 2 associates"}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {open.doc[k].map((n: any, i: number) => (
                    <Badge key={i}>{n.label} · {n.kind}{n.via ? ` · via ${n.via}` : ""}</Badge>
                  ))}
                </div>
              </div>
            )
          ))}

          {(open.doc?.gaps?.length ?? 0) > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-extralight">Named gaps</div>
              {open.doc.gaps.map((g: string, i: number) => (
                <div key={i} className="text-[11px] font-extralight text-muted-foreground/70">— {g}</div>
              ))}
            </div>
          )}

          {(open.doc?.sources?.length ?? 0) > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-extralight">
                Sources ({open.doc.sources.length})
              </div>
              <div className="max-h-48 overflow-auto space-y-1 pr-1">
                {open.doc.sources.map((s: any, i: number) => (
                  <a
                    key={i} href={s.url} target="_blank" rel="noreferrer noopener"
                    className="block text-[11px] font-extralight text-muted-foreground/70 hover:text-foreground truncate"
                  >
                    [{i + 1}] ({s.bucket}) {s.domain} — {s.title || s.url}
                  </a>
                ))}
              </div>
            </div>
          )}
        </Shell>
      )}
    </div>
  );
};

export default ContactVaultPane;
