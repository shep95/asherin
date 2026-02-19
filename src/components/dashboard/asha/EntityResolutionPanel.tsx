import { useState, useEffect } from "react";
import { Fingerprint, Link2, CheckCircle2, X, Search, Users, Building2, CreditCard, FileText, Loader2, Merge } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAshaSession } from "./AshaSessionContext";

interface EntityMatch {
  id: string;
  entityA: Record<string, unknown>;
  entityB: Record<string, unknown>;
  confidence: number;
  matchFields: string[];
  status: "pending" | "approved" | "rejected";
  entityType: string;
}

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  person: Users, company: Building2, transaction: CreditCard, product: FileText,
};

const EntityResolutionPanel = () => {
  const [matches, setMatches] = useState<EntityMatch[]>([]);
  const [filterType, setFilterType] = useState("");
  const [filterConfidence, setFilterConfidence] = useState<"all" | "high" | "medium" | "low">("all");
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { activeSession } = useAshaSession();

  useEffect(() => {
    if (!user || !activeSession) return;
    const load = async () => {
      const { data } = await supabase.from("asha_entity_matches").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      if (data) {
        setMatches(data.map((d: any) => ({
          id: d.id, entityA: d.entity_a, entityB: d.entity_b, confidence: d.confidence,
          matchFields: d.match_fields || [], status: d.status, entityType: d.entity_type,
        })));
      }
      setLoading(false);
    };
    load();
  }, [user, activeSession]);

  const handleAction = async (id: string, action: "approved" | "rejected") => {
    await supabase.from("asha_entity_matches").update({ status: action }).eq("id", id);
    setMatches(prev => prev.map(m => m.id === id ? { ...m, status: action } : m));
  };

  const runScan = async () => {
    if (!user) return;
    setIsScanning(true);
    try {
      const { data: datasets } = await supabase.from("asha_datasets").select("id, file_name, schema, storage_path").eq("user_id", user.id).eq("status", "ready").eq("session_id", activeSession?.id);
      if (!datasets || datasets.length < 2) { setIsScanning(false); return; }

      const { data: session } = await supabase.auth.getSession();
      const schemaInfo = datasets.map((d: any) => `${d.file_name}: ${(d.schema || []).map((c: any) => `${c.name}(${c.type})`).join(", ")}`).join("\n");
      const samples: string[] = [];
      for (const ds of datasets.slice(0, 3)) {
        if (ds.storage_path) {
          const { data: fileData } = await supabase.storage.from("asha-data").download(ds.storage_path);
          if (fileData) { const text = await fileData.text(); samples.push(`[${ds.file_name}]\n${text.split("\n").slice(0, 15).join("\n")}`); }
        }
      }

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asha-query`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.session?.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ query: `[ENTITY RESOLUTION] Find matching entities across datasets. Schemas:\n${schemaInfo}\n\nSample Data:\n${samples.join("\n\n")}\n\nReturn ONLY JSON array: [{"entityType":"person|company|transaction","entityA":{"source":"file","label":"id","fields":{"k":"v"}},"entityB":{"source":"file","label":"id","fields":{"k":"v"}},"confidence":0-100,"matchFields":["Field (type)"]}]`, sessionId: activeSession?.id }),
      });
      if (res.ok) {
        const result = await res.json();
        const jsonMatch = (result.response || "").match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          for (const match of JSON.parse(jsonMatch[0])) {
            const { data: ins } = await supabase.from("asha_entity_matches").insert({
              user_id: user.id, entity_type: match.entityType || "unknown", entity_a: match.entityA, entity_b: match.entityB,
              confidence: match.confidence || 50, match_fields: match.matchFields || [], status: match.confidence >= 95 ? "approved" : "pending",
            }).select().single();
            if (ins) setMatches(prev => [{ id: ins.id, entityA: ins.entity_a as any, entityB: ins.entity_b as any, confidence: ins.confidence, matchFields: ins.match_fields || [], status: ins.status as any, entityType: ins.entity_type }, ...prev]);
          }
        }
      }
    } catch (e) { console.error("Entity scan error:", e); }
    finally { setIsScanning(false); }
  };

  const filtered = matches.filter(m => {
    if (filterType && m.entityType !== filterType) return false;
    if (filterConfidence === "high" && m.confidence < 85) return false;
    if (filterConfidence === "medium" && (m.confidence < 60 || m.confidence >= 85)) return false;
    if (filterConfidence === "low" && m.confidence >= 60) return false;
    return true;
  });

  const stats = { total: matches.length, autoMerged: matches.filter(m => m.confidence >= 95).length, pending: matches.filter(m => m.status === "pending").length, approved: matches.filter(m => m.status === "approved").length };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-accent" /></div>;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2"><Fingerprint className="h-5 w-5 text-accent" /><h2 className="text-lg font-extralight tracking-wide text-foreground">Entity Resolution</h2></div>
          <p className="text-xs font-extralight text-muted-foreground mt-1">ASHA scans your datasets and finds matching entities using AI.</p>
        </div>
        <button onClick={runScan} disabled={isScanning} className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-4 py-2 text-xs font-light text-accent hover:bg-accent/20 transition-colors disabled:opacity-50">
          {isScanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          {isScanning ? "Scanning…" : "Run Entity Scan"}
        </button>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[{ label: "Found", value: stats.total, color: "text-foreground" }, { label: "Auto-Merged", value: stats.autoMerged, color: "text-emerald-400" }, { label: "Pending", value: stats.pending, color: "text-amber-400" }, { label: "Approved", value: stats.approved, color: "text-accent" }].map(s => (
          <div key={s.label} className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-3">
            <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">{s.label}</p>
            <p className={`text-2xl font-extralight mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="bg-card/30 border border-border/20 rounded-lg px-2 py-1.5 text-[10px] text-foreground outline-none">
          <option value="">All Types</option><option value="person">Person</option><option value="company">Company</option><option value="transaction">Transaction</option>
        </select>
        <div className="flex gap-1">
          {(["all", "high", "medium", "low"] as const).map(level => (
            <button key={level} onClick={() => setFilterConfidence(level)} className={`rounded-lg px-2.5 py-1 text-[10px] font-light transition-colors ${filterConfidence === level ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:bg-foreground/5"}`}>
              {level === "all" ? "All" : level === "high" ? "≥85%" : level === "medium" ? "60-84%" : "<60%"}
            </button>
          ))}
        </div>
        <span className="text-[10px] text-muted-foreground/40 ml-auto">{filtered.length} matches</span>
      </div>
      <div className="space-y-3">
        {filtered.map(match => {
          const Icon = typeIcons[match.entityType] || Users;
          const isExpanded = expandedMatch === match.id;
          const aLabel = (match.entityA as any)?.label || "Entity A";
          const bLabel = (match.entityB as any)?.label || "Entity B";
          const aFields = (match.entityA as any)?.fields || match.entityA || {};
          const bFields = (match.entityB as any)?.fields || match.entityB || {};
          return (
            <div key={match.id} className={`rounded-xl border backdrop-blur-sm overflow-hidden transition-colors ${match.status === "approved" ? "border-emerald-500/20 bg-emerald-500/5" : match.status === "rejected" ? "border-destructive/20 bg-destructive/5 opacity-50" : "border-border/20 bg-card/20"}`}>
              <div className="flex items-center gap-4 p-4 cursor-pointer" onClick={() => setExpandedMatch(isExpanded ? null : match.id)}>
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2"><span className="text-xs font-light text-foreground truncate">{aLabel}</span><Link2 className="h-3 w-3 text-muted-foreground/40 shrink-0" /><span className="text-xs font-light text-foreground truncate">{bLabel}</span></div>
                </div>
                <div className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${match.confidence >= 90 ? "bg-emerald-500/15 text-emerald-400" : match.confidence >= 70 ? "bg-amber-500/15 text-amber-400" : "bg-destructive/15 text-destructive"}`}>{match.confidence}%</div>
                {match.status === "approved" && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                {match.status === "rejected" && <X className="h-4 w-4 text-destructive" />}
              </div>
              {isExpanded && (
                <div className="border-t border-border/20 p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {[aFields, bFields].map((fields, idx) => (
                      <div key={idx} className="rounded-lg border border-border/15 bg-card/30 p-3 space-y-2">
                        {Object.entries(fields).map(([key, val]) => (
                          <div key={key} className="flex items-center gap-2 text-[11px]">
                            <span className="text-muted-foreground/60 w-20 shrink-0">{key}:</span>
                            <span className="font-light text-foreground">{String(val)}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                  {match.matchFields.length > 0 && <div className="flex flex-wrap gap-2">{match.matchFields.map(f => <span key={f} className="rounded-full bg-accent/10 border border-accent/20 px-2 py-0.5 text-[10px] text-accent">{f}</span>)}</div>}
                  {match.status === "pending" && (
                    <div className="flex items-center gap-2">
                      <button onClick={e => { e.stopPropagation(); handleAction(match.id, "approved"); }} className="flex items-center gap-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/20 px-3 py-1.5 text-[11px] text-emerald-400 hover:bg-emerald-500/25 transition-colors"><Merge className="h-3 w-3" /> Merge</button>
                      <button onClick={e => { e.stopPropagation(); handleAction(match.id, "rejected"); }} className="flex items-center gap-1.5 rounded-lg border border-border/20 px-3 py-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"><X className="h-3 w-3" /> Reject</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && <div className="text-center py-12"><Fingerprint className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" /><p className="text-xs text-muted-foreground/40 font-extralight">No matches found. Upload 2+ datasets and run a scan.</p></div>}
      </div>
    </div>
  );
};

export default EntityResolutionPanel;
