import { useState, useEffect } from "react";
import { Search, Tag, Building2, User, MapPin, DollarSign, Calendar, Loader2, Download, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAshaSession } from "./AshaSessionContext";
import { formatDistanceToNow } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Entity {
  id: string;
  entity_type: string;
  entity_value: string;
  entity_label: string | null;
  confidence: number | null;
  context: string | null;
  document_id: string;
  document_name: string;
  created_at: string;
}

const entityIcons: Record<string, any> = {
  person: User,
  organization: Building2,
  party: Building2,
  location: MapPin,
  amount: DollarSign,
  date: Calendar,
  product: Tag,
};

const entityColors: Record<string, string> = {
  person: "text-pink-400 bg-pink-500/10",
  organization: "text-blue-400 bg-blue-500/10",
  party: "text-blue-400 bg-blue-500/10",
  location: "text-green-400 bg-green-500/10",
  amount: "text-amber-400 bg-amber-500/10",
  date: "text-purple-400 bg-purple-500/10",
  product: "text-cyan-400 bg-cyan-500/10",
};

const EntitiesPanel = () => {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [filteredEntities, setFilteredEntities] = useState<Entity[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"confidence" | "date" | "type">("confidence");
  const [minConfidence, setMinConfidence] = useState(0);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { user } = useAuth();
  const { activeSession } = useAshaSession();

  useEffect(() => {
    if (!user || !activeSession) return;
    loadEntities();
  }, [user, activeSession]);

  const loadEntities = async () => {
    if (!user || !activeSession) return;
    setLoading(true);

    const { data: docs } = await supabase
      .from('asha_documents')
      .select('id, file_name')
      .eq('user_id', user.id)
      .eq('session_id', activeSession.id);

    if (!docs || docs.length === 0) {
      setEntities([]);
      setFilteredEntities([]);
      setLoading(false);
      return;
    }

    const docIds = docs.map(d => d.id);

    const { data: entityData } = await supabase
      .from('asha_document_entities')
      .select('*')
      .in('document_id', docIds)
      .eq('user_id', user.id)
      .order('confidence', { ascending: false });

    if (entityData) {
      const enriched: Entity[] = entityData.map(e => ({
        ...e,
        confidence: e.confidence ?? 0,
        document_name: docs.find(d => d.id === e.document_id)?.file_name || 'Unknown',
      }));
      setEntities(enriched);
      setFilteredEntities(enriched);
    }

    setLoading(false);
  };

  // Real-time subscription
  useEffect(() => {
    if (!activeSession) return;
    const channel = supabase
      .channel(`entities-panel-${activeSession.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'asha_document_entities' }, () => {
        loadEntities();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeSession, user]);

  // Filter and sort
  useEffect(() => {
    let filtered = entities;

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(e =>
        e.entity_value.toLowerCase().includes(q) ||
        (e.entity_label || '').toLowerCase().includes(q) ||
        (e.context || '').toLowerCase().includes(q)
      );
    }

    if (selectedTypes.size > 0) {
      filtered = filtered.filter(e => selectedTypes.has(e.entity_type));
    }

    filtered = filtered.filter(e => (e.confidence ?? 0) >= minConfidence);

    const sorted = [...filtered];
    if (sortBy === 'confidence') {
      sorted.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
    } else if (sortBy === 'date') {
      sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (sortBy === 'type') {
      sorted.sort((a, b) => a.entity_type.localeCompare(b.entity_type));
    }

    setFilteredEntities(sorted);
  }, [entities, search, selectedTypes, minConfidence, sortBy]);

  const uniqueTypes = Array.from(new Set(entities.map(e => e.entity_type)));

  const toggleType = (type: string) => {
    setSelectedTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const copyValue = async (id: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const exportCSV = () => {
    const csv = [
      ['Entity', 'Type', 'Confidence', 'Context', 'Document'].join(','),
      ...filteredEntities.map(e => [
        `"${(e.entity_value || '').replace(/"/g, '""')}"`,
        e.entity_type,
        ((e.confidence ?? 0) * 100).toFixed(0) + '%',
        `"${(e.context || '').replace(/"/g, '""')}"`,
        `"${e.document_name.replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `entities_${activeSession?.name}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-5 w-5 animate-spin text-accent" />
      </div>
    );
  }

  if (entities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Tag className="h-12 w-12 text-muted-foreground/20" />
        <p className="text-sm font-light text-foreground">No entities extracted yet</p>
        <p className="text-xs text-muted-foreground/50 text-center max-w-sm">
          Upload documents in the Doc Intel tab to extract people, companies, locations, and other entities automatically.
        </p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col">
        {/* Header with filters */}
        <div className="flex-shrink-0 p-4 border-b border-border/20 space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-border/20 bg-card/20 px-3 py-1.5 flex-1 w-full sm:max-w-md">
              <Search className="h-3.5 w-3.5 text-muted-foreground/50" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search entities..."
                className="flex-1 bg-transparent text-xs font-light text-foreground placeholder:text-muted-foreground/40 outline-none"
              />
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={exportCSV}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/20 bg-card/30 hover:bg-card/50 transition-colors text-xs text-foreground"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Export CSV</span>
                </button>
              </TooltipTrigger>
              <TooltipContent><p>Export filtered entities to CSV</p></TooltipContent>
            </Tooltip>
          </div>

          {/* Type filters */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Filter:</span>
            {uniqueTypes.map(type => {
              const Icon = entityIcons[type] || Tag;
              const isSelected = selectedTypes.has(type);
              return (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] transition-colors ${
                    isSelected
                      ? entityColors[type] || 'text-accent bg-accent/10'
                      : 'text-muted-foreground/60 bg-card/20 hover:bg-card/40'
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {type}
                  <span className="text-muted-foreground/40">
                    ({entities.filter(e => e.entity_type === type).length})
                  </span>
                </button>
              );
            })}
          </div>

          {/* Confidence slider */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider whitespace-nowrap">
              Min Confidence:
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={minConfidence}
              onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
              className="flex-1 max-w-xs accent-accent"
            />
            <span className="text-xs text-foreground font-mono">
              {(minConfidence * 100).toFixed(0)}%
            </span>
          </div>

          {/* Sort + count */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Sort:</span>
              {(['confidence', 'date', 'type'] as const).map(sort => (
                <button
                  key={sort}
                  onClick={() => setSortBy(sort)}
                  className={`px-2 py-1 rounded-lg text-[10px] capitalize transition-colors ${
                    sortBy === sort
                      ? 'text-accent bg-accent/10'
                      : 'text-muted-foreground/60 hover:text-foreground hover:bg-card/20'
                  }`}
                >
                  {sort}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-muted-foreground/50">
              {filteredEntities.length} of {entities.length}
            </span>
          </div>
        </div>

        {/* Entity list */}
        <div className="flex-1 min-h-0 overflow-auto p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredEntities.map((entity) => {
              const Icon = entityIcons[entity.entity_type] || Tag;
              const colorClass = entityColors[entity.entity_type] || 'text-accent bg-accent/10';

              return (
                <div
                  key={entity.id}
                  className="p-3 rounded-lg border border-border/10 bg-card/30 hover:bg-card/50 transition-colors space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className={`flex items-center gap-1.5 ${colorClass} px-2 py-0.5 rounded text-[10px] font-medium`}>
                      <Icon className="h-3 w-3" />
                      {entity.entity_type}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground/60 font-mono">
                        {((entity.confidence ?? 0) * 100).toFixed(0)}%
                      </span>
                      <button
                        onClick={() => copyValue(entity.id, entity.entity_value)}
                        className="p-1 hover:bg-card/50 rounded transition-colors"
                      >
                        {copiedId === entity.id ? (
                          <Check className="h-3 w-3 text-emerald-400" />
                        ) : (
                          <Copy className="h-3 w-3 text-muted-foreground/40 hover:text-foreground" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-foreground">{entity.entity_value}</p>
                    {entity.entity_label && entity.entity_label !== entity.entity_value && (
                      <p className="text-xs text-muted-foreground/70 mt-0.5">{entity.entity_label}</p>
                    )}
                  </div>

                  {entity.context && (
                    <p className="text-[10px] text-muted-foreground/60 italic line-clamp-2">
                      "{entity.context}"
                    </p>
                  )}

                  <div className="pt-2 border-t border-border/10 flex items-center justify-between">
                    <p className="text-[10px] text-muted-foreground/50 truncate flex-1">
                      {entity.document_name}
                    </p>
                    <p className="text-[10px] text-muted-foreground/40 ml-2 whitespace-nowrap">
                      {formatDistanceToNow(new Date(entity.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default EntitiesPanel;
