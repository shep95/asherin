import { useState, useMemo } from "react";
import {
  User, Building2, Globe, AtSign, Phone, MapPin, Fingerprint, CreditCard,
  Search, Merge, Split, Eye, ChevronDown, ChevronUp, Shield, Clock,
  Link2, Edit3, Check, X, AlertTriangle, Plus, Hash, Star
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Entity {
  type: string;
  value: string;
  confidence: number;
  source?: string;
}

interface EntityCard {
  id: string;
  primaryValue: string;
  type: string;
  aliases: string[];
  identifiers: { label: string; value: string }[];
  confidence: number;
  notes: { text: string; label: "observation" | "inference" | "speculation" | "tasking"; timestamp: number }[];
  linkedEvidence: string[];
  mergedFrom?: string[];
  timeline: { event: string; timestamp: string }[];
}

interface NomadEntityWorkbenchProps {
  entities: Entity[];
  crossRefMap: Record<string, string[]>;
  investigations: { query: string; findings: string; created_at: string; entities_found: any[] }[];
}

const STORAGE_KEY = "nomad_entity_cards";

function loadCards(): Record<string, EntityCard> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
}
function saveCards(cards: Record<string, EntityCard>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  person: User, email: AtSign, phone: Phone, organization: Building2,
  url: Globe, handle: Fingerprint, location: MapPin, us_location: MapPin,
  money: CreditCard, transaction: CreditCard, ip_address: Globe,
  vehicle: Hash, coordinates: MapPin,
};

const EPISTEMIC_COLORS: Record<string, string> = {
  observation: "bg-foreground/[0.1] text-accent",
  inference: "bg-blue-500/20 text-blue-400",
  speculation: "bg-amber-500/20 text-amber-400",
  tasking: "bg-emerald-500/20 text-emerald-400",
};

const NomadEntityWorkbench = ({ entities, crossRefMap, investigations }: NomadEntityWorkbenchProps) => {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [mergeMode, setMergeMode] = useState(false);
  const [mergeSelection, setMergeSelection] = useState<string[]>([]);
  const [addingNote, setAddingNote] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [noteLabel, setNoteLabel] = useState<"observation" | "inference" | "speculation" | "tasking">("observation");
  const [addingAlias, setAddingAlias] = useState<string | null>(null);
  const [aliasText, setAliasText] = useState("");

  // Build entity cards from raw entities + persisted data
  const cards = useMemo(() => {
    const persisted = loadCards();
    const cardMap: Record<string, EntityCard> = {};

    for (const e of entities) {
      const id = `${e.type}:${e.value}`;
      if (persisted[id]) {
        cardMap[id] = { ...persisted[id], confidence: e.confidence };
      } else {
        // Auto-build timeline from investigations
        const timeline: { event: string; timestamp: string }[] = [];
        for (const inv of investigations) {
          const found = (inv.entities_found || []).some(
            (ie: any) => ie.type === e.type && ie.value === e.value
          );
          if (found) {
            timeline.push({ event: `Discovered in: "${inv.query.slice(0, 60)}"`, timestamp: inv.created_at });
          }
        }

        // Auto-build identifiers
        const identifiers: { label: string; value: string }[] = [{ label: "Type", value: e.type }];
        if (e.source) identifiers.push({ label: "Source", value: e.source });

        // Cross-references
        const crossRefs = crossRefMap[`${e.type}:${e.value.toLowerCase().trim()}`] || [];

        cardMap[id] = {
          id,
          primaryValue: e.value,
          type: e.type,
          aliases: [],
          identifiers,
          confidence: e.confidence,
          notes: [],
          linkedEvidence: crossRefs,
          timeline,
        };
      }
    }
    return cardMap;
  }, [entities, crossRefMap, investigations]);

  const filtered = useMemo(() => {
    const all = Object.values(cards);
    if (!search.trim()) return all;
    const q = search.toLowerCase();
    return all.filter(c =>
      c.primaryValue.toLowerCase().includes(q) ||
      c.type.includes(q) ||
      c.aliases.some(a => a.toLowerCase().includes(q))
    );
  }, [cards, search]);

  const addAlias = (cardId: string) => {
    if (!aliasText.trim()) return;
    const all = loadCards();
    const existing = all[cardId] || cards[cardId];
    if (existing) {
      existing.aliases = [...(existing.aliases || []), aliasText.trim()];
      all[cardId] = existing;
      saveCards(all);
    }
    setAliasText("");
    setAddingAlias(null);
  };

  const addNote = (cardId: string) => {
    if (!noteText.trim()) return;
    const all = loadCards();
    const existing = all[cardId] || cards[cardId];
    if (existing) {
      existing.notes = [...(existing.notes || []), { text: noteText.trim(), label: noteLabel, timestamp: Date.now() }];
      all[cardId] = existing;
      saveCards(all);
    }
    setNoteText("");
    setAddingNote(null);
  };

  const handleMerge = () => {
    if (mergeSelection.length < 2) return;
    const all = loadCards();
    const primary = cards[mergeSelection[0]];
    const merged: EntityCard = {
      ...primary,
      aliases: [...primary.aliases],
      notes: [...primary.notes],
      linkedEvidence: [...primary.linkedEvidence],
      mergedFrom: mergeSelection.slice(1),
    };
    for (let i = 1; i < mergeSelection.length; i++) {
      const other = cards[mergeSelection[i]];
      if (other) {
        merged.aliases.push(other.primaryValue, ...other.aliases);
        merged.notes.push(...other.notes);
        merged.linkedEvidence.push(...other.linkedEvidence);
      }
    }
    merged.aliases = [...new Set(merged.aliases)];
    merged.linkedEvidence = [...new Set(merged.linkedEvidence)];
    all[merged.id] = merged;
    saveCards(all);
    setMergeMode(false);
    setMergeSelection([]);
  };

  const Icon = (type: string) => TYPE_ICONS[type] || Hash;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/20">
        <div className="flex-1 flex items-center gap-2 rounded-xl border border-border/20 bg-card/30 px-3 py-1.5">
          <Search className="h-3.5 w-3.5 text-muted-foreground/40" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search entities, aliases..."
            className="flex-1 bg-transparent text-xs font-light text-foreground placeholder:text-muted-foreground/30 outline-none"
          />
        </div>
        <button
          onClick={() => { setMergeMode(!mergeMode); setMergeSelection([]); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-light transition-colors ${
            mergeMode ? "bg-foreground/[0.1] text-accent border border-foreground/15" : "text-muted-foreground/50 border border-border/20 hover:text-foreground"
          }`}
        >
          <Merge className="h-3 w-3" />
          {mergeMode ? `Merge (${mergeSelection.length})` : "Merge"}
        </button>
        {mergeMode && mergeSelection.length >= 2 && (
          <button onClick={handleMerge} className="px-3 py-1.5 rounded-xl text-[10px] bg-foreground/[0.1] text-accent border border-foreground/15">
            Execute Merge
          </button>
        )}
        <span className="text-[10px] text-muted-foreground/40">{filtered.length} entities</span>
      </div>

      {/* Entity Cards */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {filtered.length === 0 && (
            <div className="text-center py-12">
              <User className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground/40 font-light">No entities yet. Run an investigation to discover entities.</p>
            </div>
          )}
          {filtered.map(card => {
            const IconComp = Icon(card.type);
            const isExpanded = expanded === card.id;
            return (
              <div
                key={card.id}
                className={`rounded-2xl border backdrop-blur-sm transition-all ${
                  mergeMode && mergeSelection.includes(card.id)
                    ? "border-accent/40 bg-foreground/[0.03]"
                    : "border-border/20 bg-card/20 hover:border-border/40"
                }`}
              >
                <button
                  onClick={() => {
                    if (mergeMode) {
                      setMergeSelection(prev =>
                        prev.includes(card.id) ? prev.filter(s => s !== card.id) : [...prev, card.id]
                      );
                    } else {
                      setExpanded(isExpanded ? null : card.id);
                    }
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left"
                >
                  {mergeMode && (
                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      mergeSelection.includes(card.id) ? "border-accent bg-foreground/[0.1]" : "border-border/30"
                    }`}>
                      {mergeSelection.includes(card.id) && <Check className="h-2.5 w-2.5 text-accent" />}
                    </div>
                  )}
                  <IconComp className="h-4 w-4 text-foreground/50 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-light text-foreground truncate">{card.primaryValue}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] text-muted-foreground/40 uppercase">{card.type}</span>
                      {card.aliases.length > 0 && (
                        <span className="text-[9px] text-muted-foreground/30">+{card.aliases.length} aliases</span>
                      )}
                      {card.mergedFrom && (
                        <span className="text-[9px] text-foreground/50">merged</span>
                      )}
                    </div>
                  </div>
                  {/* Confidence */}
                  <div className={`px-2 py-0.5 rounded-full text-[9px] font-light ${
                    card.confidence >= 0.9 ? "bg-emerald-500/20 text-emerald-400"
                    : card.confidence >= 0.7 ? "bg-amber-500/20 text-amber-400"
                    : "bg-red-500/20 text-red-400"
                  }`}>
                    {Math.round(card.confidence * 100)}%
                  </div>
                  {!mergeMode && (isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/30" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/30" />)}
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-border/10 space-y-3">
                    {/* Aliases */}
                    <div>
                      <p className="text-[9px] text-muted-foreground/40 uppercase tracking-wider mb-1">Aliases</p>
                      <div className="flex flex-wrap gap-1">
                        {card.aliases.map((a, i) => (
                          <span key={i} className="px-2 py-0.5 rounded-lg text-[10px] bg-foreground/5 text-muted-foreground/60">{a}</span>
                        ))}
                        {addingAlias === card.id ? (
                          <div className="flex items-center gap-1">
                            <input value={aliasText} onChange={e => setAliasText(e.target.value)} onKeyDown={e => e.key === "Enter" && addAlias(card.id)} placeholder="New alias" className="bg-transparent text-[10px] text-foreground outline-none w-24 border-b border-border/30" autoFocus />
                            <button onClick={() => addAlias(card.id)} className="text-foreground"><Check className="h-3 w-3" /></button>
                            <button onClick={() => setAddingAlias(null)} className="text-muted-foreground/30"><X className="h-3 w-3" /></button>
                          </div>
                        ) : (
                          <button onClick={() => setAddingAlias(card.id)} className="px-2 py-0.5 rounded-lg text-[10px] text-muted-foreground/30 border border-dashed border-border/20 hover:text-foreground">
                            <Plus className="h-2.5 w-2.5 inline mr-0.5" />Add
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Identifiers */}
                    <div>
                      <p className="text-[9px] text-muted-foreground/40 uppercase tracking-wider mb-1">Identifiers</p>
                      <div className="space-y-1">
                        {card.identifiers.map((id, i) => (
                          <div key={i} className="flex items-center gap-2 text-[10px]">
                            <span className="text-muted-foreground/40 w-16">{id.label}</span>
                            <span className="text-foreground/70 font-mono">{id.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Timeline */}
                    {card.timeline.length > 0 && (
                      <div>
                        <p className="text-[9px] text-muted-foreground/40 uppercase tracking-wider mb-1">Timeline</p>
                        <div className="space-y-1 pl-3 border-l border-border/20">
                          {card.timeline.map((t, i) => (
                            <div key={i} className="flex items-center gap-2 text-[10px]">
                              <Clock className="h-2.5 w-2.5 text-muted-foreground/30 shrink-0" />
                              <span className="text-muted-foreground/50">{new Date(t.timestamp).toLocaleString()}</span>
                              <span className="text-foreground/60 truncate">{t.event}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Evidence Links */}
                    {card.linkedEvidence.length > 0 && (
                      <div>
                        <p className="text-[9px] text-muted-foreground/40 uppercase tracking-wider mb-1">Linked Evidence ({card.linkedEvidence.length})</p>
                        <div className="flex flex-wrap gap-1">
                          {card.linkedEvidence.map((ev, i) => (
                            <span key={i} className="px-2 py-0.5 rounded-lg text-[9px] bg-foreground/[0.06] text-foreground/50 font-mono">{ev.slice(0, 8)}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Analyst Notes (Epistemic Labels) */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[9px] text-muted-foreground/40 uppercase tracking-wider">Analyst Notes</p>
                        <button onClick={() => setAddingNote(addingNote === card.id ? null : card.id)} className="text-[9px] text-muted-foreground/40 hover:text-foreground">
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      {card.notes.map((n, i) => (
                        <div key={i} className="flex items-start gap-2 mb-1">
                          <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider shrink-0 ${EPISTEMIC_COLORS[n.label]}`}>{n.label}</span>
                          <p className="text-[10px] text-foreground/60 font-light">{n.text}</p>
                        </div>
                      ))}
                      {addingNote === card.id && (
                        <div className="mt-2 space-y-1.5">
                          <div className="flex gap-1">
                            {(["observation", "inference", "speculation", "tasking"] as const).map(l => (
                              <button key={l} onClick={() => setNoteLabel(l)} className={`px-2 py-0.5 rounded text-[9px] transition-colors ${noteLabel === l ? EPISTEMIC_COLORS[l] : "text-muted-foreground/30 border border-border/20"}`}>{l}</button>
                            ))}
                          </div>
                          <div className="flex gap-1">
                            <input value={noteText} onChange={e => setNoteText(e.target.value)} onKeyDown={e => e.key === "Enter" && addNote(card.id)} placeholder="Add analyst note..." className="flex-1 bg-transparent text-[10px] text-foreground outline-none border-b border-border/20 pb-1" autoFocus />
                            <button onClick={() => addNote(card.id)} className="text-accent text-[10px]">Save</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};

export default NomadEntityWorkbench;
