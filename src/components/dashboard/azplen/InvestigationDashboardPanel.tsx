import { useEffect, useMemo, useState } from "react";
import { FileText, Network, Users, AlertCircle, Activity, Lightbulb, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAzplenSession } from "./AzplenSessionContext";
import { useAzplenNav } from "./AzplenView";

interface DocRow { id: string; file_name: string; doc_type: string; status: string; created_at: string; }
interface EntityRow { entity_type: string; entity_value: string; confidence: number; created_at: string; document_id: string; }

const ENTITY_COLOR: Record<string, string> = {
  person: "bg-sky-300/15 text-sky-200 border-sky-300/30",
  org: "bg-amber-300/15 text-amber-200 border-amber-300/30",
  organization: "bg-amber-300/15 text-amber-200 border-amber-300/30",
  location: "bg-emerald-300/15 text-emerald-200 border-emerald-300/30",
  money: "bg-lime-300/15 text-lime-200 border-lime-300/30",
  date: "bg-violet-300/15 text-violet-200 border-violet-300/30",
  email: "bg-rose-300/15 text-rose-200 border-rose-300/30",
  phone: "bg-rose-300/15 text-rose-200 border-rose-300/30",
  url: "bg-cyan-300/15 text-cyan-200 border-cyan-300/30",
  unknown: "bg-foreground/[0.04] text-muted-foreground border-foreground/10",
};

/**
 * Investigation Dashboard — the operator's home tab.
 * Renders LIVE from asha_documents + asha_document_entities for the active session.
 * No mock data. If the session has nothing, the empty state guides the operator.
 */
const InvestigationDashboardPanel = () => {
  const { activeSession } = useAzplenSession();
  const { navigateToTab } = useAzplenNav();
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeSession) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data: docRows } = await supabase
        .from("asha_documents")
        .select("id, file_name, doc_type, status, created_at")
        .eq("session_id", activeSession.id)
        .order("created_at", { ascending: false })
        .limit(200);
      const docIds = (docRows ?? []).map((d) => d.id);
      let entRows: EntityRow[] = [];
      if (docIds.length) {
        const { data } = await supabase
          .from("asha_document_entities")
          .select("entity_type, entity_value, confidence, created_at, document_id")
          .in("document_id", docIds)
          .limit(2000);
        entRows = (data ?? []) as EntityRow[];
      }
      if (cancelled) return;
      setDocs((docRows ?? []) as DocRow[]);
      setEntities(entRows);
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [activeSession?.id]);

  // Aggregate live signals from the data
  const stats = useMemo(() => {
    const unique = new Set(entities.map((e) => `${e.entity_type}::${e.entity_value.toLowerCase()}`));
    return {
      documents: docs.length,
      entities: unique.size,
      ingesting: docs.filter((d) => d.status === "analyzing" || d.status === "uploading").length,
      lastUpdate: docs[0]?.created_at,
    };
  }, [docs, entities]);

  // Treemap-style heatmap of entity types
  const typeCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entities) m.set(e.entity_type, (m.get(e.entity_type) ?? 0) + 1);
    const total = entities.length || 1;
    return Array.from(m.entries())
      .map(([type, count]) => ({ type, count, pct: count / total }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 14);
  }, [entities]);

  // Top mentioned entities
  const topEntities = useMemo(() => {
    const m = new Map<string, { value: string; type: string; count: number; conf: number }>();
    for (const e of entities) {
      const k = `${e.entity_type}::${e.entity_value.toLowerCase()}`;
      const cur = m.get(k);
      if (cur) { cur.count += 1; cur.conf = Math.max(cur.conf, Number(e.confidence) || 0); }
      else m.set(k, { value: e.entity_value, type: e.entity_type, count: 1, conf: Number(e.confidence) || 0 });
    }
    return Array.from(m.values()).sort((a, b) => b.count - a.count).slice(0, 8);
  }, [entities]);

  // Activity timeline — group docs by day
  const timeline = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of docs) {
      const day = d.created_at.slice(0, 10);
      m.set(day, (m.get(day) ?? 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(-14);
  }, [docs]);
  const maxBar = Math.max(1, ...timeline.map(([, n]) => n));

  // Open questions = AI-style gaps surfaced from the live shape of data
  const openQuestions = useMemo(() => {
    const q: string[] = [];
    if (docs.length === 0) q.push("No documents ingested — define a collection plan to scope the investigation.");
    if (entities.length > 0 && typeCounts.find((t) => t.type === "person") === undefined)
      q.push("No PERSON entities extracted yet — corpus lacks human-actor attribution.");
    if (entities.length > 0 && typeCounts.find((t) => t.type === "org" || t.type === "organization") === undefined)
      q.push("No ORGANIZATION entities — corporate structure of the network is undefined.");
    const lowConf = entities.filter((e) => Number(e.confidence) > 0 && Number(e.confidence) < 0.5).length;
    if (lowConf > entities.length * 0.4 && entities.length > 20)
      q.push(`${lowConf} entities below 50% confidence — corpus needs corroborating sources.`);
    if (docs.length > 0 && entities.length === 0)
      q.push("Documents ingested but no entities extracted — run entity extraction in Documents tab.");
    if (q.length === 0 && docs.length > 0) q.push("No gaps detected. Move to Graph view to map relationships.");
    return q;
  }, [docs, entities, typeCounts]);

  if (!activeSession) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        Select or create an investigation session to begin.
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* STATUS STRIP */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatusCard icon={FileText} label="Documents" value={stats.documents} sub="ingested" />
        <StatusCard icon={Network} label="Entities" value={stats.entities} sub="unique extracted" />
        <StatusCard icon={Activity} label="Processing" value={stats.ingesting} sub="active jobs" warn={stats.ingesting > 0} />
        <StatusCard
          icon={AlertCircle}
          label="Open Threads"
          value={openQuestions.length}
          sub={stats.lastUpdate ? `last ${new Date(stats.lastUpdate).toLocaleDateString()}` : "no activity"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ENTITY HEATMAP TREEMAP */}
        <div className="lg:col-span-2 rounded-xl border border-foreground/10 bg-foreground/[0.02] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-light tracking-wide text-foreground">Entity Heatmap</h3>
              <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/60 mt-1">By extracted frequency</p>
            </div>
            <button
              onClick={() => navigateToTab("entities")}
              className="flex items-center gap-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
            >
              Resolve <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          {loading ? (
            <Skeleton h={180} />
          ) : typeCounts.length === 0 ? (
            <EmptyHint text="No entities extracted yet. Ingest documents and run extraction." />
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {typeCounts.map((t) => (
                <button
                  key={t.type}
                  onClick={() => navigateToTab("graph")}
                  className={`rounded-md border px-2 py-1.5 text-left transition-all hover:scale-[1.02] ${ENTITY_COLOR[t.type] ?? ENTITY_COLOR.unknown}`}
                  style={{ flexBasis: `${Math.max(80, Math.round(t.pct * 320))}px`, flexGrow: t.pct }}
                  title={`${t.count} extractions`}
                >
                  <div className="text-[9px] font-mono uppercase tracking-[0.18em] opacity-70">{t.type}</div>
                  <div className="text-sm font-extralight tabular-nums">{t.count}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* OPEN QUESTIONS */}
        <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="h-3.5 w-3.5 text-amber-300/80" />
            <h3 className="text-sm font-light tracking-wide text-foreground">Open Questions</h3>
          </div>
          {loading ? (
            <Skeleton h={140} />
          ) : (
            <ul className="space-y-2">
              {openQuestions.map((q, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
                  <span className="mt-0.5 text-amber-300/60">◇</span>
                  <span>{q}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => navigateToTab("plan")}
              className="text-[10px] uppercase tracking-[0.2em] text-amber-200/80 hover:text-amber-100 border border-amber-300/20 rounded-md px-2.5 py-1"
            >
              Collection Plan
            </button>
            <button
              onClick={() => navigateToTab("webintel")}
              className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground border border-foreground/10 rounded-md px-2.5 py-1"
            >
              Web Intel
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ACTIVITY TIMELINE */}
        <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-5">
          <h3 className="text-sm font-light tracking-wide text-foreground mb-1">Activity Timeline</h3>
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/60 mb-4">Documents ingested per day</p>
          {loading ? (
            <Skeleton h={120} />
          ) : timeline.length === 0 ? (
            <EmptyHint text="No activity yet." />
          ) : (
            <div className="flex items-end gap-1.5 h-32">
              {timeline.map(([day, n]) => (
                <div key={day} className="flex-1 flex flex-col items-center gap-1.5" title={`${day}: ${n} docs`}>
                  <div className="w-full flex-1 flex items-end">
                    <div
                      className="w-full rounded-t bg-gradient-to-t from-amber-400/40 to-amber-300/80"
                      style={{ height: `${(n / maxBar) * 100}%` }}
                    />
                  </div>
                  <div className="text-[8px] font-mono text-muted-foreground/50">{day.slice(5)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* TOP ENTITIES */}
        <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-light tracking-wide text-foreground">Top Mentioned</h3>
            <Users className="h-3.5 w-3.5 text-muted-foreground/50" />
          </div>
          {loading ? (
            <Skeleton h={140} />
          ) : topEntities.length === 0 ? (
            <EmptyHint text="No entities to rank." />
          ) : (
            <ul className="space-y-1.5">
              {topEntities.map((e) => (
                <li
                  key={`${e.type}-${e.value}`}
                  className="flex items-center justify-between gap-3 rounded-md border border-foreground/[0.06] bg-foreground/[0.02] px-3 py-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-[8px] font-mono uppercase tracking-[0.18em] rounded px-1.5 py-0.5 border ${ENTITY_COLOR[e.type] ?? ENTITY_COLOR.unknown}`}>
                      {e.type}
                    </span>
                    <span className="truncate text-xs text-foreground font-extralight">{e.value}</span>
                  </div>
                  <span className="text-[10px] font-mono tabular-nums text-muted-foreground">{e.count}×</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

const StatusCard = ({ icon: Icon, label, value, sub, warn }: { icon: React.ElementType; label: string; value: number; sub: string; warn?: boolean }) => (
  <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4">
    <div className="flex items-center justify-between mb-2">
      <span className="text-[9px] font-mono uppercase tracking-[0.22em] text-muted-foreground/60">{label}</span>
      <Icon className={`h-3.5 w-3.5 ${warn ? "text-amber-300" : "text-muted-foreground/50"}`} />
    </div>
    <div className="text-2xl font-extralight tabular-nums text-foreground">{value}</div>
    <div className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</div>
  </div>
);

const Skeleton = ({ h }: { h: number }) => (
  <div className="animate-pulse rounded-md bg-foreground/[0.04]" style={{ height: h }} />
);

const EmptyHint = ({ text }: { text: string }) => (
  <div className="text-xs text-muted-foreground/60 italic py-6 text-center">{text}</div>
);

export default InvestigationDashboardPanel;
