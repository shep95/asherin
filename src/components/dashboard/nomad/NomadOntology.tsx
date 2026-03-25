import { useState, useMemo } from "react";
import { Layers, Plus, Link2, Eye, Trash2, User, Building2, MapPin, Cpu, FileText, DollarSign, Truck, Box, Search } from "lucide-react";

interface NomadOntologyProps {
  entities: { type: string; value: string; confidence: number; source?: string }[];
  investigations: { query: string; findings: string; created_at: string; entities_found: any[] }[];
}

interface OntologyNode {
  id: string;
  type: string;
  value: string;
  confidence: number;
  links: { targetId: string; label: string }[];
}

const typeIcons: Record<string, React.ElementType> = {
  person: User, email: User, phone: User, handle: User,
  organization: Building2, company: Building2, supplier: Building2,
  location: MapPin, us_location: MapPin, coordinates: MapPin,
  vehicle: Truck, ip_address: Cpu, url: Cpu,
  money: DollarSign, transaction: DollarSign, transaction_id: FileText,
};

const typeColors: Record<string, string> = {
  person: "border-foreground/15 bg-accent/8", email: "border-foreground/15 bg-accent/8",
  organization: "border-emerald-500/30 bg-emerald-500/8", company: "border-emerald-500/30 bg-emerald-500/8",
  location: "border-rose-500/30 bg-rose-500/8", us_location: "border-rose-500/30 bg-rose-500/8",
  vehicle: "border-sky-500/30 bg-sky-500/8",
  money: "border-amber-500/30 bg-amber-500/8", transaction: "border-amber-500/30 bg-amber-500/8",
  ip_address: "border-purple-500/30 bg-purple-500/8", url: "border-purple-500/30 bg-purple-500/8",
};

const NomadOntology = ({ entities, investigations }: NomadOntologyProps) => {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [customLinks, setCustomLinks] = useState<{ from: string; to: string; label: string }[]>([]);
  const [linkingFrom, setLinkingFrom] = useState<string | null>(null);

  // Build ontology nodes with auto-discovered relationships
  const nodes = useMemo(() => {
    const nodeMap: Record<string, OntologyNode> = {};

    for (const e of entities) {
      const id = `${e.type}:${e.value}`;
      if (!nodeMap[id]) {
        nodeMap[id] = { id, type: e.type, value: e.value, confidence: e.confidence, links: [] };
      }
    }

    // Auto-link entities that co-appear in investigations
    for (const inv of investigations) {
      const invEntities = (inv.entities_found || []).map((e: any) => `${e.type}:${e.value}`);
      for (let i = 0; i < invEntities.length; i++) {
        for (let j = i + 1; j < invEntities.length; j++) {
          const a = invEntities[i], b = invEntities[j];
          if (nodeMap[a] && nodeMap[b]) {
            if (!nodeMap[a].links.find(l => l.targetId === b)) {
              nodeMap[a].links.push({ targetId: b, label: "co-occurs" });
            }
          }
        }
      }
    }

    // Apply custom links
    for (const cl of customLinks) {
      if (nodeMap[cl.from]) {
        nodeMap[cl.from].links.push({ targetId: cl.to, label: cl.label });
      }
    }

    return Object.values(nodeMap);
  }, [entities, investigations, customLinks]);

  const filtered = search
    ? nodes.filter(n => n.value.toLowerCase().includes(search.toLowerCase()) || n.type.includes(search.toLowerCase()))
    : nodes;

  const selected = nodes.find(n => n.id === selectedId);
  const selectedLinks = selected ? selected.links.map(l => ({ ...l, target: nodes.find(n => n.id === l.targetId) })).filter(l => l.target) : [];

  // Group by type
  const grouped = useMemo(() => {
    const g: Record<string, OntologyNode[]> = {};
    for (const n of filtered) {
      if (!g[n.type]) g[n.type] = [];
      g[n.type].push(n);
    }
    return g;
  }, [filtered]);

  const handleLink = (targetId: string) => {
    if (!linkingFrom) return;
    setCustomLinks(prev => [...prev, { from: linkingFrom, to: targetId, label: "relates to" }]);
    setLinkingFrom(null);
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-foreground" />
          <h2 className="text-lg font-extralight tracking-wide text-foreground">Ontology Engine</h2>
        </div>
        <p className="text-xs font-extralight text-muted-foreground mt-1">
          Every entity is a living digital object — people, vehicles, transactions, phones — all linked automatically.
        </p>
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search ontology…" className="w-full bg-card/20 border border-border/20 rounded-xl px-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-foreground/15 transition-colors" />

      {/* Stats bar */}
      <div className="flex gap-2 flex-wrap">
        {Object.entries(grouped).map(([type, items]) => {
          const Icon = typeIcons[type] || Box;
          return (
            <div key={type} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${typeColors[type] || "border-border/20 bg-card/20"} text-[10px] text-foreground/70`}>
              <Icon className="h-3 w-3" /> {items.length} {type}
            </div>
          );
        })}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border/20 bg-card/20 text-[10px] text-muted-foreground">
          <Link2 className="h-3 w-3" /> {nodes.reduce((a, n) => a + n.links.length, 0)} links
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Entity grid */}
        <div className="lg:col-span-2">
          {Object.keys(grouped).length === 0 ? (
            <div className="flex flex-col items-center py-12">
              <Layers className="h-10 w-10 text-muted-foreground/15 mb-3" />
              <p className="text-xs text-muted-foreground/40">Run investigations to populate the ontology</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(grouped).map(([type, items]) => (
                <div key={type}>
                  <p className="text-[9px] text-muted-foreground/40 uppercase tracking-wider mb-2">{type}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {items.map(node => {
                      const Icon = typeIcons[node.type] || Box;
                      const colors = typeColors[node.type] || "border-border/15 bg-card/20";
                      const isSelected = selectedId === node.id;
                      return (
                        <button
                          key={node.id}
                          onClick={() => {
                            if (linkingFrom && linkingFrom !== node.id) { handleLink(node.id); return; }
                            setSelectedId(isSelected ? null : node.id);
                          }}
                          className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all ${isSelected ? `${colors} ring-1 ring-accent/20` : `border-border/12 bg-card/15 hover:bg-card/30`}`}
                        >
                          <div className="flex items-center gap-2">
                            <Icon className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-light text-foreground/90 truncate">{node.value}</p>
                              <p className="text-[8px] text-muted-foreground/40">{node.links.length} link{node.links.length !== 1 ? "s" : ""} · {Math.round(node.confidence * 100)}%</p>
                            </div>
                            {linkingFrom && linkingFrom !== node.id && (
                              <span className="text-[8px] text-foreground px-1.5 py-0.5 bg-foreground/[0.06] rounded">Link</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail sidebar */}
        <div className="rounded-xl border border-border/15 bg-card/20 p-4">
          {selected ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-light text-foreground truncate">{selected.value}</h3>
                <button onClick={() => setLinkingFrom(selected.id)} className="p-1 text-muted-foreground/50 hover:text-foreground transition-colors" title="Link to entity">
                  <Link2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="space-y-1.5 text-[10px]">
                <div className="flex justify-between"><span className="text-muted-foreground/50">Type</span><span className="text-foreground/80">{selected.type}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground/50">Confidence</span><span className="text-foreground/80">{Math.round(selected.confidence * 100)}%</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground/50">Links</span><span className="text-foreground/80">{selected.links.length}</span></div>
              </div>
              {selectedLinks.length > 0 && (
                <div>
                  <p className="text-[9px] text-muted-foreground/40 uppercase tracking-wider mb-1.5">Relationships</p>
                  {selectedLinks.map((l, i) => (
                    <div key={i} className="flex items-center gap-2 text-[10px] py-1 border-b border-border/10 last:border-0">
                      <span className="text-foreground/50">{l.label}</span>
                      <span className="text-foreground/70 truncate">{l.target?.value}</span>
                    </div>
                  ))}
                </div>
              )}
              {linkingFrom === selected.id && (
                <p className="text-[9px] text-foreground animate-pulse">Click a target entity to link →</p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-32">
              <Eye className="h-6 w-6 text-muted-foreground/15 mb-2" />
              <p className="text-[10px] text-muted-foreground/40">Select an entity to inspect</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NomadOntology;
