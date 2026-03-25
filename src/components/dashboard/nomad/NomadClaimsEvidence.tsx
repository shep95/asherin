import { useState, useMemo } from "react";
import {
  FileText, Link2, Plus, AlertTriangle, Check, X, ChevronDown, ChevronUp,
  Shield, Search, Trash2, ExternalLink
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Source {
  id: string;
  url: string;
  title: string;
  reliability: number; // 0-100
  capturedAt: number;
}

interface Claim {
  id: string;
  text: string;
  status: "unsupported" | "supported" | "contested" | "refuted";
  sourceIds: string[];
  contradictions: string[];
  resolution?: "unresolved" | "resolved" | "false";
  createdAt: number;
}

interface NomadClaimsEvidenceProps {
  entities: { type: string; value: string; confidence: number }[];
  investigations: { query: string; findings: string; created_at: string }[];
}

const STORAGE_KEY = "nomad_claims_evidence";

function loadData(): { claims: Claim[]; sources: Source[] } {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"claims":[],"sources":[]}'); } catch { return { claims: [], sources: [] }; }
}
function saveData(data: { claims: Claim[]; sources: Source[] }) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

const STATUS_STYLES: Record<string, string> = {
  unsupported: "bg-red-500/15 text-red-400 border-red-500/20",
  supported: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  contested: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  refuted: "bg-red-500/25 text-red-300 border-red-500/30",
};

const RESOLUTION_STYLES: Record<string, string> = {
  unresolved: "text-amber-400",
  resolved: "text-emerald-400",
  false: "text-red-400",
};

const NomadClaimsEvidence = ({ entities, investigations }: NomadClaimsEvidenceProps) => {
  const [data, setData] = useState(loadData);
  const [addingClaim, setAddingClaim] = useState(false);
  const [addingSource, setAddingSource] = useState(false);
  const [claimText, setClaimText] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [linkingClaimId, setLinkingClaimId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [contradictionText, setContradictionText] = useState("");

  const save = (newData: typeof data) => { setData(newData); saveData(newData); };

  const addClaim = () => {
    if (!claimText.trim()) return;
    const claim: Claim = { id: crypto.randomUUID(), text: claimText.trim(), status: "unsupported", sourceIds: [], contradictions: [], createdAt: Date.now() };
    save({ ...data, claims: [...data.claims, claim] });
    setClaimText("");
    setAddingClaim(false);
  };

  const addSource = () => {
    if (!sourceUrl.trim()) return;
    const source: Source = { id: crypto.randomUUID(), url: sourceUrl.trim(), title: sourceTitle.trim() || sourceUrl.trim(), reliability: 50, capturedAt: Date.now() };
    save({ ...data, sources: [...data.sources, source] });
    setSourceUrl("");
    setSourceTitle("");
    setAddingSource(false);
  };

  const linkSource = (claimId: string, sourceId: string) => {
    const claims = data.claims.map(c => {
      if (c.id === claimId) {
        const newSourceIds = c.sourceIds.includes(sourceId) ? c.sourceIds.filter(s => s !== sourceId) : [...c.sourceIds, sourceId];
        const status = newSourceIds.length > 0 ? "supported" : "unsupported";
        return { ...c, sourceIds: newSourceIds, status: status as Claim["status"] };
      }
      return c;
    });
    save({ ...data, claims });
  };

  const addContradiction = (claimId: string) => {
    if (!contradictionText.trim()) return;
    const claims = data.claims.map(c =>
      c.id === claimId ? { ...c, contradictions: [...c.contradictions, contradictionText.trim()], status: "contested" as const } : c
    );
    save({ ...data, claims });
    setContradictionText("");
  };

  const setResolution = (claimId: string, resolution: "unresolved" | "resolved" | "false") => {
    const claims = data.claims.map(c => c.id === claimId ? { ...c, resolution } : c);
    save({ ...data, claims });
  };

  const removeClaim = (id: string) => save({ ...data, claims: data.claims.filter(c => c.id !== id) });
  const removeSource = (id: string) => save({ ...data, sources: data.sources.filter(s => s.id !== id) });

  // Source usage count
  const sourceUsage = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of data.claims) for (const s of c.sourceIds) map[s] = (map[s] || 0) + 1;
    return map;
  }, [data]);

  const unsupportedCount = data.claims.filter(c => c.status === "unsupported").length;
  const contestedCount = data.claims.filter(c => c.status === "contested").length;

  const filtered = search.trim()
    ? data.claims.filter(c => c.text.toLowerCase().includes(search.toLowerCase()))
    : data.claims;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/20">
        <div className="flex-1 flex items-center gap-2 rounded-xl border border-border/20 bg-card/30 px-3 py-1.5">
          <Search className="h-3.5 w-3.5 text-muted-foreground/40" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search claims..." className="flex-1 bg-transparent text-xs font-light text-foreground placeholder:text-muted-foreground/30 outline-none" />
        </div>
        {unsupportedCount > 0 && (
          <span className="px-2 py-1 rounded-lg text-[9px] bg-red-500/15 text-red-400">{unsupportedCount} unsupported</span>
        )}
        {contestedCount > 0 && (
          <span className="px-2 py-1 rounded-lg text-[9px] bg-amber-500/15 text-amber-400">{contestedCount} contested</span>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Claims */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] text-muted-foreground/40 uppercase tracking-wider">Claims ({data.claims.length})</h3>
              <button onClick={() => setAddingClaim(true)} className="flex items-center gap-1 text-[10px] text-foreground/50 hover:text-foreground transition-colors">
                <Plus className="h-3 w-3" /> Add Claim
              </button>
            </div>

            {addingClaim && (
              <div className="mb-3 rounded-xl border border-border/25 bg-foreground/[0.03] p-3 space-y-2">
                <input value={claimText} onChange={e => setClaimText(e.target.value)} onKeyDown={e => e.key === "Enter" && addClaim()} placeholder='e.g. "X controls Y through shell company Z"' className="w-full bg-transparent text-xs font-light text-foreground placeholder:text-muted-foreground/30 outline-none" autoFocus />
                <div className="flex gap-2">
                  <button onClick={addClaim} className="text-[10px] text-foreground">Save</button>
                  <button onClick={() => setAddingClaim(false)} className="text-[10px] text-muted-foreground/40">Cancel</button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {filtered.map(claim => {
                const isExp = expanded === claim.id;
                return (
                  <div key={claim.id} className={`rounded-xl border ${STATUS_STYLES[claim.status]} p-3`}>
                    <button onClick={() => setExpanded(isExp ? null : claim.id)} className="w-full flex items-center gap-2 text-left">
                      <span className="flex-1 text-xs font-light">{claim.text}</span>
                      <span className="text-[9px] uppercase tracking-wider shrink-0">{claim.status}</span>
                      {isExp ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                    {isExp && (
                      <div className="mt-3 pt-2 border-t border-current/10 space-y-2">
                        {/* Linked Sources */}
                        <div>
                          <p className="text-[9px] opacity-60 mb-1">Linked Sources ({claim.sourceIds.length})</p>
                          {claim.sourceIds.map(sid => {
                            const src = data.sources.find(s => s.id === sid);
                            return src ? (
                              <div key={sid} className="flex items-center gap-2 text-[10px] opacity-70">
                                <Link2 className="h-2.5 w-2.5" />
                                <span className="truncate">{src.title}</span>
                                <span className="text-[8px] opacity-40">used in {sourceUsage[sid] || 0} claims</span>
                              </div>
                            ) : null;
                          })}
                          <button onClick={() => setLinkingClaimId(linkingClaimId === claim.id ? null : claim.id)} className="text-[9px] opacity-50 hover:opacity-100 mt-1">
                            <Plus className="h-2.5 w-2.5 inline" /> Attach source
                          </button>
                          {linkingClaimId === claim.id && (
                            <div className="mt-1 space-y-1 pl-3">
                              {data.sources.map(s => (
                                <button key={s.id} onClick={() => linkSource(claim.id, s.id)} className={`block text-[10px] hover:opacity-100 ${claim.sourceIds.includes(s.id) ? "opacity-100" : "opacity-40"}`}>
                                  {claim.sourceIds.includes(s.id) ? "✓" : "○"} {s.title}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        {/* Contradictions */}
                        <div>
                          <p className="text-[9px] opacity-60 mb-1">Contradictions ({claim.contradictions.length})</p>
                          {claim.contradictions.map((c, i) => (
                            <div key={i} className="flex items-start gap-1.5 text-[10px] opacity-70 mb-0.5">
                              <AlertTriangle className="h-2.5 w-2.5 shrink-0 mt-0.5" />
                              <span>{c}</span>
                            </div>
                          ))}
                          <div className="flex gap-1 mt-1">
                            <input value={contradictionText} onChange={e => setContradictionText(e.target.value)} onKeyDown={e => e.key === "Enter" && addContradiction(claim.id)} placeholder="Add contradiction..." className="flex-1 bg-transparent text-[10px] outline-none border-b border-current/20 pb-0.5" />
                            <button onClick={() => addContradiction(claim.id)} className="text-[9px]">Add</button>
                          </div>
                        </div>
                        {/* Resolution */}
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] opacity-50">Resolution:</span>
                          {(["unresolved", "resolved", "false"] as const).map(r => (
                            <button key={r} onClick={() => setResolution(claim.id, r)} className={`text-[9px] px-1.5 py-0.5 rounded ${claim.resolution === r ? RESOLUTION_STYLES[r] : "opacity-30"}`}>{r}</button>
                          ))}
                          <button onClick={() => removeClaim(claim.id)} className="ml-auto text-[9px] opacity-30 hover:opacity-100"><Trash2 className="h-3 w-3" /></button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sources */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] text-muted-foreground/40 uppercase tracking-wider">Sources ({data.sources.length})</h3>
              <button onClick={() => setAddingSource(true)} className="flex items-center gap-1 text-[10px] text-foreground/50 hover:text-foreground transition-colors">
                <Plus className="h-3 w-3" /> Add Source
              </button>
            </div>

            {addingSource && (
              <div className="mb-3 rounded-xl border border-border/20 bg-card/20 p-3 space-y-2">
                <input value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="Source URL" className="w-full bg-transparent text-xs font-light text-foreground placeholder:text-muted-foreground/30 outline-none border-b border-border/20 pb-1" autoFocus />
                <input value={sourceTitle} onChange={e => setSourceTitle(e.target.value)} placeholder="Title (optional)" className="w-full bg-transparent text-xs font-light text-foreground placeholder:text-muted-foreground/30 outline-none border-b border-border/20 pb-1" />
                <div className="flex gap-2">
                  <button onClick={addSource} className="text-[10px] text-foreground">Save</button>
                  <button onClick={() => setAddingSource(false)} className="text-[10px] text-muted-foreground/40">Cancel</button>
                </div>
              </div>
            )}

            <div className="space-y-1">
              {data.sources.map(s => (
                <div key={s.id} className="flex items-center gap-2 rounded-lg border border-border/15 bg-card/10 px-3 py-2 group">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                  <span className="text-[11px] text-foreground/70 font-light truncate flex-1">{s.title}</span>
                  <span className="text-[9px] text-muted-foreground/30">props {sourceUsage[s.id] || 0} claims</span>
                  <button onClick={() => removeSource(s.id)} className="p-0.5 opacity-0 group-hover:opacity-100 text-muted-foreground/30 hover:text-destructive transition-all">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

export default NomadClaimsEvidence;
