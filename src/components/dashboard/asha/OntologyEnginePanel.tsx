import { useState, useEffect, useMemo } from "react";
import { Network, Search, Plus, Link2, Eye, Loader2, Layers, Box, Truck, FileText, User, Building2, DollarSign, MapPin, Cpu, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAshaSession } from "./AshaSessionContext";
import { supabase } from "@/integrations/supabase/client";

interface OntologyEntity {
  id: string;
  type: "person" | "machine" | "contract" | "invoice" | "supplier" | "facility" | "product" | "vehicle" | "location" | "custom";
  name: string;
  attributes: Record<string, string>;
  createdAt: string;
}

interface OntologyRelation {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
}

const ENTITY_TYPES: { type: OntologyEntity["type"]; icon: React.ElementType; label: string; color: string }[] = [
  { type: "person", icon: User, label: "Person", color: "border-accent/30 bg-accent/8 text-accent" },
  { type: "machine", icon: Cpu, label: "Machine", color: "border-purple-500/30 bg-purple-500/8 text-purple-400" },
  { type: "contract", icon: FileText, label: "Contract", color: "border-cyan-500/30 bg-cyan-500/8 text-cyan-400" },
  { type: "invoice", icon: DollarSign, label: "Invoice", color: "border-amber-500/30 bg-amber-500/8 text-amber-400" },
  { type: "supplier", icon: Building2, label: "Supplier", color: "border-emerald-500/30 bg-emerald-500/8 text-emerald-400" },
  { type: "facility", icon: Building2, label: "Facility", color: "border-pink-500/30 bg-pink-500/8 text-pink-400" },
  { type: "product", icon: Box, label: "Product", color: "border-orange-500/30 bg-orange-500/8 text-orange-400" },
  { type: "vehicle", icon: Truck, label: "Vehicle", color: "border-sky-500/30 bg-sky-500/8 text-sky-400" },
  { type: "location", icon: MapPin, label: "Location", color: "border-rose-500/30 bg-rose-500/8 text-rose-400" },
  { type: "custom", icon: Layers, label: "Custom", color: "border-foreground/20 bg-foreground/5 text-foreground" },
];

const OntologyEnginePanel = () => {
  const { user } = useAuth();
  const { activeSession } = useAshaSession();
  const [entities, setEntities] = useState<OntologyEntity[]>([]);
  const [relations, setRelations] = useState<OntologyRelation[]>([]);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newType, setNewType] = useState<OntologyEntity["type"]>("person");
  const [newName, setNewName] = useState("");
  const [newAttrs, setNewAttrs] = useState<{ key: string; value: string }[]>([{ key: "", value: "" }]);
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [linkingFrom, setLinkingFrom] = useState<string | null>(null);
  const [linkLabel, setLinkLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [autoImporting, setAutoImporting] = useState(false);

  // Auto-import entities from ASHA datasets
  useEffect(() => {
    if (!user || !activeSession) { setLoading(false); return; }
    const load = async () => {
      // Load entities from asha_document_entities
      const { data: docEntities } = await supabase
        .from("asha_document_entities")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (docEntities && docEntities.length > 0) {
        const mapped: OntologyEntity[] = docEntities.map(e => ({
          id: e.id,
          type: mapEntityType(e.entity_type),
          name: e.entity_value,
          attributes: { source: "document", type: e.entity_type, confidence: String(e.confidence || 0), context: e.context || "" },
          createdAt: e.created_at,
        }));
        setEntities(prev => {
          const existing = new Set(prev.map(p => p.name));
          return [...prev, ...mapped.filter(m => !existing.has(m.name))];
        });
      }
      setLoading(false);
    };
    load();
  }, [user, activeSession]);

  const autoImportFromDatasets = async () => {
    if (!user || !activeSession) return;
    setAutoImporting(true);
    const { data: datasets } = await supabase.from("asha_datasets").select("*").eq("user_id", user.id).eq("session_id", activeSession.id).eq("status", "ready");
    if (datasets) {
      for (const ds of datasets) {
        const schema = (ds.schema as any[]) || [];
        // Create entity for each dataset as a "data source"
        const dsEntity: OntologyEntity = {
          id: `ds-${ds.id}`,
          type: "custom",
          name: ds.file_name,
          attributes: { rows: String(ds.row_count || 0), columns: String(ds.col_count || 0), quality: `${ds.quality_score || 0}%`, type: ds.file_type },
          createdAt: ds.created_at,
        };
        setEntities(prev => {
          if (prev.find(p => p.id === dsEntity.id)) return prev;
          return [...prev, dsEntity];
        });

        // Extract column names as sub-entities
        schema.slice(0, 5).forEach((col: any, i: number) => {
          if (col.isPII) {
            const colEntity: OntologyEntity = {
              id: `col-${ds.id}-${i}`,
              type: "person",
              name: `PII: ${col.name}`,
              attributes: { dataType: col.type, dataset: ds.file_name },
              createdAt: ds.created_at,
            };
            setEntities(prev => {
              if (prev.find(p => p.id === colEntity.id)) return prev;
              return [...prev, colEntity];
            });
            setRelations(prev => [...prev, { id: crypto.randomUUID(), sourceId: dsEntity.id, targetId: colEntity.id, label: "contains PII" }]);
          }
        });
      }
    }
    setAutoImporting(false);
  };

  const createEntity = () => {
    if (!newName.trim()) return;
    const entity: OntologyEntity = {
      id: crypto.randomUUID(),
      type: newType,
      name: newName.trim(),
      attributes: Object.fromEntries(newAttrs.filter(a => a.key.trim()).map(a => [a.key.trim(), a.value.trim()])),
      createdAt: new Date().toISOString(),
    };
    setEntities(prev => [...prev, entity]);
    setNewName("");
    setNewAttrs([{ key: "", value: "" }]);
    setShowCreate(false);
  };

  const createLink = (targetId: string) => {
    if (!linkingFrom || !linkLabel.trim()) return;
    setRelations(prev => [...prev, { id: crypto.randomUUID(), sourceId: linkingFrom, targetId, label: linkLabel.trim() }]);
    setLinkingFrom(null);
    setLinkLabel("");
  };

  const deleteEntity = (id: string) => {
    setEntities(prev => prev.filter(e => e.id !== id));
    setRelations(prev => prev.filter(r => r.sourceId !== id && r.targetId !== id));
    if (selectedEntity === id) setSelectedEntity(null);
  };

  const filtered = useMemo(() => {
    if (!search) return entities;
    const q = search.toLowerCase();
    return entities.filter(e => e.name.toLowerCase().includes(q) || e.type.includes(q));
  }, [entities, search]);

  const selectedData = entities.find(e => e.id === selectedEntity);
  const entityRelations = relations.filter(r => r.sourceId === selectedEntity || r.targetId === selectedEntity);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-accent" /></div>;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Network className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-extralight tracking-wide text-foreground">Ontology Engine</h2>
          </div>
          <p className="text-xs font-extralight text-muted-foreground mt-1">Map real-world objects as digital entities with relationships — your living digital twin.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={autoImportFromDatasets} disabled={autoImporting} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border/20 text-muted-foreground text-xs hover:text-foreground hover:bg-foreground/5 transition-colors disabled:opacity-30">
            {autoImporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Layers className="h-3 w-3" />}
            Auto-Import
          </button>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-accent/10 text-accent text-xs hover:bg-accent/20 transition-colors">
            <Plus className="h-3.5 w-3.5" /> New Entity
          </button>
        </div>
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search entities…" className="w-full bg-card/20 border border-border/20 rounded-xl px-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-accent/30 transition-colors" />

      {/* Stats */}
      <div className="flex gap-3 flex-wrap">
        {ENTITY_TYPES.map(et => {
          const count = entities.filter(e => e.type === et.type).length;
          if (count === 0) return null;
          const Icon = et.icon;
          return (
            <div key={et.type} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${et.color} text-[10px]`}>
              <Icon className="h-3 w-3" /> {count} {et.label}{count !== 1 ? "s" : ""}
            </div>
          );
        })}
        {relations.length > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border/20 bg-card/20 text-[10px] text-muted-foreground">
            <Link2 className="h-3 w-3" /> {relations.length} links
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Entity list */}
        <div className="lg:col-span-2 space-y-2">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center py-12">
              <Network className="h-10 w-10 text-muted-foreground/15 mb-3" />
              <p className="text-xs text-muted-foreground/40">No entities yet. Create or auto-import to begin mapping.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filtered.map(entity => {
                const et = ENTITY_TYPES.find(t => t.type === entity.type) || ENTITY_TYPES[ENTITY_TYPES.length - 1];
                const Icon = et.icon;
                const relCount = relations.filter(r => r.sourceId === entity.id || r.targetId === entity.id).length;
                const isSelected = selectedEntity === entity.id;
                return (
                  <button key={entity.id} onClick={() => setSelectedEntity(isSelected ? null : entity.id)} className={`w-full text-left px-3 py-3 rounded-xl border transition-all ${isSelected ? `${et.color} ring-1 ring-accent/20` : "border-border/15 bg-card/20 hover:bg-card/40"}`}>
                    <div className="flex items-center gap-2.5">
                      <div className={`p-1.5 rounded-lg ${et.color}`}><Icon className="h-3.5 w-3.5" /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-light text-foreground truncate">{entity.name}</p>
                        <p className="text-[9px] text-muted-foreground/50">{et.label} · {relCount} link{relCount !== 1 ? "s" : ""}</p>
                      </div>
                      {linkingFrom && linkingFrom !== entity.id && (
                        <button onClick={(e) => { e.stopPropagation(); createLink(entity.id); }} className="px-2 py-0.5 rounded bg-accent/10 text-accent text-[9px] hover:bg-accent/20">Link</button>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div className="rounded-xl border border-border/15 bg-card/20 p-4">
          {selectedData ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-light text-foreground">{selectedData.name}</h3>
                <div className="flex gap-1">
                  <button onClick={() => { setLinkingFrom(selectedData.id); setLinkLabel("relates to"); }} className="p-1 text-muted-foreground/50 hover:text-accent transition-colors" title="Link to another entity">
                    <Link2 className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => deleteEntity(selectedData.id)} className="p-1 text-muted-foreground/50 hover:text-destructive transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {linkingFrom === selectedData.id && (
                <div className="flex items-center gap-2">
                  <input value={linkLabel} onChange={e => setLinkLabel(e.target.value)} placeholder="Relationship label…" className="flex-1 bg-card/40 border border-accent/20 rounded-lg px-2 py-1 text-[10px] text-foreground outline-none" />
                  <p className="text-[9px] text-accent">Click target entity →</p>
                </div>
              )}
              <div className="space-y-1.5">
                {Object.entries(selectedData.attributes).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground/50">{k}</span>
                    <span className="text-foreground/80 text-right max-w-[60%] truncate">{v}</span>
                  </div>
                ))}
              </div>
              {entityRelations.length > 0 && (
                <div>
                  <p className="text-[10px] text-muted-foreground/40 uppercase tracking-wider mb-2">Relationships</p>
                  {entityRelations.map(r => {
                    const other = r.sourceId === selectedData.id ? entities.find(e => e.id === r.targetId) : entities.find(e => e.id === r.sourceId);
                    return (
                      <div key={r.id} className="flex items-center gap-2 text-[10px] py-1 border-b border-border/10 last:border-0">
                        <span className="text-accent/60">{r.label}</span>
                        <span className="text-foreground/70">{other?.name || "Unknown"}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-32">
              <Eye className="h-6 w-6 text-muted-foreground/15 mb-2" />
              <p className="text-[10px] text-muted-foreground/40">Select an entity to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
          <div className="bg-card rounded-2xl border border-border/20 p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-light text-foreground mb-4">Create Entity</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-5 gap-1.5">
                {ENTITY_TYPES.map(et => {
                  const Icon = et.icon;
                  return (
                    <button key={et.type} onClick={() => setNewType(et.type)} className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all text-[8px] ${newType === et.type ? et.color : "border-border/15 text-muted-foreground/50 hover:border-border/30"}`}>
                      <Icon className="h-3.5 w-3.5" />
                      {et.label}
                    </button>
                  );
                })}
              </div>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Entity name…" className="w-full bg-card/40 border border-border/20 rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none" />
              <div className="space-y-1.5">
                <p className="text-[10px] text-muted-foreground/40">Attributes</p>
                {newAttrs.map((attr, i) => (
                  <div key={i} className="flex gap-2">
                    <input value={attr.key} onChange={e => { const u = [...newAttrs]; u[i].key = e.target.value; setNewAttrs(u); }} placeholder="Key" className="flex-1 bg-card/40 border border-border/15 rounded-lg px-2 py-1.5 text-[10px] text-foreground outline-none" />
                    <input value={attr.value} onChange={e => { const u = [...newAttrs]; u[i].value = e.target.value; setNewAttrs(u); }} placeholder="Value" className="flex-1 bg-card/40 border border-border/15 rounded-lg px-2 py-1.5 text-[10px] text-foreground outline-none" />
                  </div>
                ))}
                <button onClick={() => setNewAttrs(prev => [...prev, { key: "", value: "" }])} className="text-[9px] text-accent hover:text-accent/80 transition-colors">+ Add attribute</button>
              </div>
              <button onClick={createEntity} disabled={!newName.trim()} className="w-full py-2 rounded-xl bg-accent/10 text-accent text-xs hover:bg-accent/20 transition-colors disabled:opacity-30">Create Entity</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function mapEntityType(raw: string): OntologyEntity["type"] {
  const lower = raw.toLowerCase();
  if (lower.includes("person") || lower.includes("name")) return "person";
  if (lower.includes("org") || lower.includes("company")) return "supplier";
  if (lower.includes("location") || lower.includes("address")) return "location";
  if (lower.includes("vehicle")) return "vehicle";
  if (lower.includes("money") || lower.includes("invoice")) return "invoice";
  if (lower.includes("contract")) return "contract";
  return "custom";
}

export default OntologyEnginePanel;
