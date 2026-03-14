import { useState, useMemo } from "react";
import { GitBranch, Eye, ChevronRight, Link2, Database, Clock, User, MapPin, Building2 } from "lucide-react";

interface NomadLineageProps {
  entities: { type: string; value: string; confidence: number; source?: string }[];
  investigations: { query: string; findings: string; created_at: string; entities_found: any[]; sources_checked: string[] }[];
}

interface LineageNode {
  id: string;
  entityValue: string;
  entityType: string;
  appearances: { investigationQuery: string; timestamp: string; confidence: number }[];
  derivedFrom: string[];
}

const typeIcons: Record<string, React.ElementType> = {
  person: User,
  email: User,
  phone: User,
  location: MapPin,
  us_location: MapPin,
  organization: Building2,
  company: Building2,
  default: Database,
};

const NomadLineage = ({ entities, investigations }: NomadLineageProps) => {
  const [expandedNode, setExpandedNode] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const lineageNodes = useMemo(() => {
    const nodes: Record<string, LineageNode> = {};

    for (const inv of investigations) {
      const invEntities = inv.entities_found || [];
      for (const e of invEntities) {
        const key = `${e.type}:${e.value}`;
        if (!nodes[key]) {
          nodes[key] = {
            id: key,
            entityValue: e.value,
            entityType: e.type,
            appearances: [],
            derivedFrom: [],
          };
        }
        nodes[key].appearances.push({
          investigationQuery: inv.query,
          timestamp: inv.created_at,
          confidence: e.confidence,
        });
      }

      // Build derivation chains: entities in the same investigation are related
      const entityKeys = invEntities.map((e: any) => `${e.type}:${e.value}`);
      for (const key of entityKeys) {
        if (nodes[key]) {
          const others = entityKeys.filter((k: string) => k !== key);
          nodes[key].derivedFrom = [...new Set([...nodes[key].derivedFrom, ...others])];
        }
      }
    }

    return Object.values(nodes);
  }, [investigations]);

  const filtered = search
    ? lineageNodes.filter(n => n.entityValue.toLowerCase().includes(search.toLowerCase()) || n.entityType.includes(search.toLowerCase()))
    : lineageNodes;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <GitBranch className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-extralight tracking-wide text-foreground">Data Lineage</h2>
        </div>
        <p className="text-xs font-extralight text-muted-foreground mt-1">
          Trace every entity back to its source investigation. See who modified it and when.
        </p>
      </div>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search entities…"
        className="w-full bg-card/20 border border-border/20 rounded-xl px-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-accent/30 transition-colors"
      />

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center py-12">
          <GitBranch className="h-10 w-10 text-muted-foreground/15 mb-3" />
          <p className="text-xs text-muted-foreground/40">
            {entities.length === 0 ? "Run investigations to build entity lineage" : "No matching entities"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(node => {
            const Icon = typeIcons[node.entityType] || typeIcons.default;
            const isOpen = expandedNode === node.id;
            return (
              <div key={node.id} className="rounded-xl border border-border/15 bg-card/20 overflow-hidden">
                <button
                  onClick={() => setExpandedNode(isOpen ? null : node.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-foreground/5 transition-colors"
                >
                  <Icon className="h-4 w-4 text-accent/60 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-light text-foreground truncate">{node.entityValue}</p>
                    <p className="text-[9px] text-muted-foreground/50">{node.entityType} · {node.appearances.length} appearance{node.appearances.length !== 1 ? "s" : ""} · {node.derivedFrom.length} linked</p>
                  </div>
                  <ChevronRight className={`h-3 w-3 text-muted-foreground/30 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 space-y-3 border-t border-border/10 pt-3 animate-fade-in">
                    {/* Provenance chain */}
                    <div>
                      <p className="text-[9px] text-muted-foreground/40 uppercase tracking-wider mb-2">Provenance Chain</p>
                      <div className="relative pl-4">
                        <div className="absolute left-[7px] top-0 bottom-0 w-px bg-accent/20" />
                        {node.appearances.map((app, i) => (
                          <div key={i} className="flex items-start gap-3 mb-2 relative">
                            <div className="h-2 w-2 rounded-full bg-accent/40 mt-1.5 z-10 shrink-0" />
                            <div>
                              <p className="text-[10px] font-light text-foreground/80">{app.investigationQuery}</p>
                              <div className="flex gap-2 mt-0.5">
                                <span className="text-[8px] text-muted-foreground/40">
                                  <Clock className="h-2.5 w-2.5 inline mr-0.5" />
                                  {new Date(app.timestamp).toLocaleString()}
                                </span>
                                <span className="text-[8px] text-accent/50">{Math.round(app.confidence * 100)}% confidence</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Linked entities */}
                    {node.derivedFrom.length > 0 && (
                      <div>
                        <p className="text-[9px] text-muted-foreground/40 uppercase tracking-wider mb-1.5">Co-occurring Entities</p>
                        <div className="flex flex-wrap gap-1.5">
                          {node.derivedFrom.slice(0, 8).map(d => {
                            const [type, ...val] = d.split(":");
                            return (
                              <span key={d} className="inline-flex items-center gap-1 text-[9px] bg-card/50 border border-border/15 px-2 py-0.5 rounded-full text-foreground/70">
                                <Link2 className="h-2.5 w-2.5 text-accent/40" />
                                {val.join(":")}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NomadLineage;
