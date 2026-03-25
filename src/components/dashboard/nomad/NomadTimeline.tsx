import { useMemo } from "react";
import { Clock, Globe, CreditCard, User, Phone, MapPin, Building2, AtSign, Hash } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TimelineEvent {
  timestamp: string;
  entityType: string;
  entityValue: string;
  action: string;
  source: string;
  confidence: number;
}

interface NomadTimelineProps {
  investigations: {
    query: string;
    findings: string;
    created_at: string;
    entities_found: { type: string; value: string; confidence: number }[];
    sources_checked: string[];
  }[];
  sessionEntities: { type: string; value: string; confidence: number; source?: string }[];
}

const EVENT_ICONS: Record<string, any> = {
  email: AtSign, phone: Phone, organization: Building2, financial: CreditCard,
  transaction: CreditCard, location: MapPin, us_location: MapPin, coordinates: MapPin,
  person: User, url: Globe, handle: User, vehicle: Hash,
};

function extractTimelineEvents(
  investigations: NomadTimelineProps["investigations"],
  sessionEntities: NomadTimelineProps["sessionEntities"]
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // Events from investigations
  for (const inv of investigations) {
    const ts = inv.created_at;
    // Each entity found in an investigation is an event
    for (const entity of (inv.entities_found || [])) {
      events.push({
        timestamp: ts,
        entityType: entity.type,
        entityValue: entity.value,
        action: `Discovered via "${inv.query.slice(0, 50)}"`,
        source: inv.sources_checked?.[0] || "NOMAD",
        confidence: entity.confidence,
      });
    }
  }

  // Events from session entities (current session)
  for (const entity of sessionEntities) {
    events.push({
      timestamp: new Date().toISOString(),
      entityType: entity.type,
      entityValue: entity.value,
      action: "Identified in current session",
      source: entity.source || "Session",
      confidence: entity.confidence,
    });
  }

  // Extract dates mentioned in findings text → create contextual timeline events
  for (const inv of investigations) {
    const dateMatches = inv.findings.match(/(?:on|in|since|as of|dated?)\s+((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2})/gi) || [];
    for (const match of dateMatches.slice(0, 10)) {
      const dateStr = match.replace(/^(?:on|in|since|as of|dated?)\s+/i, "");
      const contextIdx = inv.findings.indexOf(match);
      const context = inv.findings.slice(Math.max(0, contextIdx - 30), contextIdx + match.length + 80).trim();
      events.push({
        timestamp: inv.created_at,
        entityType: "date_reference",
        entityValue: dateStr,
        action: context.slice(0, 100),
        source: "Text Analysis",
        confidence: 0.7,
      });
    }
  }

  // Sort by timestamp (newest first)
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return events;
}

const NomadTimeline = ({ investigations, sessionEntities }: NomadTimelineProps) => {
  const events = useMemo(
    () => extractTimelineEvents(investigations, sessionEntities),
    [investigations, sessionEntities]
  );

  // Group events by date
  const grouped = useMemo(() => {
    const map: Record<string, TimelineEvent[]> = {};
    for (const ev of events) {
      const dateKey = new Date(ev.timestamp).toLocaleDateString("en-US", {
        year: "numeric", month: "short", day: "numeric"
      });
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(ev);
    }
    return map;
  }, [events]);

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-20">
        <Clock className="h-10 w-10 text-muted-foreground/30 mb-4" />
        <p className="text-sm font-extralight text-muted-foreground">No timeline events yet.</p>
        <p className="text-[10px] font-extralight text-muted-foreground/50 mt-1">Investigate targets to build a chronological timeline.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="max-w-2xl mx-auto px-6 py-6">
        {Object.entries(grouped).map(([dateKey, dayEvents]) => (
          <div key={dateKey} className="mb-8">
            {/* Date header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 bg-border/20" />
              <span className="text-[10px] font-extralight tracking-wider text-muted-foreground/60 uppercase shrink-0">
                {dateKey}
              </span>
              <div className="h-px flex-1 bg-border/20" />
            </div>

            {/* Timeline events */}
            <div className="relative pl-8">
              {/* Vertical line */}
              <div className="absolute left-3 top-0 bottom-0 w-px bg-border/20" />

              {dayEvents.map((event, idx) => {
                const Icon = EVENT_ICONS[event.entityType] || Hash;
                const time = new Date(event.timestamp).toLocaleTimeString("en-US", {
                  hour: "2-digit", minute: "2-digit"
                });

                return (
                  <div key={idx} className="relative mb-4 animate-fade-in" style={{ animationDelay: `${idx * 30}ms` }}>
                    {/* Dot on timeline */}
                    <div className="absolute -left-5 top-3 h-2.5 w-2.5 rounded-full bg-foreground/[0.15] border border-foreground/20/60" />

                    <div className="rounded-2xl border border-border/20 bg-card/20 hover:bg-card/30 transition-colors p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="h-7 w-7 rounded-lg bg-card/40 flex items-center justify-center shrink-0 mt-0.5">
                            <Icon className="h-3.5 w-3.5 text-foreground/60" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-light text-foreground truncate">{event.entityValue}</p>
                            <p className="text-[10px] font-extralight text-muted-foreground/70 mt-0.5 leading-relaxed">
                              {event.action}
                            </p>
                            <div className="flex items-center gap-3 mt-1.5">
                              <span className="text-[9px] font-extralight text-muted-foreground/40 uppercase tracking-wider">
                                {event.entityType.replace(/_/g, " ")}
                              </span>
                              <span className="text-[9px] font-extralight text-muted-foreground/30">
                                {event.source}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[9px] font-extralight text-muted-foreground/40">{time}</span>
                          <div className="mt-1">
                            <span className={`text-[8px] font-extralight px-1.5 py-0.5 rounded-full ${
                              event.confidence >= 0.9 ? "bg-emerald-500/10 text-emerald-400"
                                : event.confidence >= 0.7 ? "bg-amber-500/10 text-amber-400"
                                : "bg-muted/20 text-muted-foreground/50"
                            }`}>
                              {Math.round(event.confidence * 100)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
};

export default NomadTimeline;
