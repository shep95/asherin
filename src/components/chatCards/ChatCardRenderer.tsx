// Dispatch layer for the Card Protocol. Given a parsed CardSegment, renders
// the correct card component. Central registry so adding a new card type is
// one entry here + one entry in parseChatCards.KNOWN.

import GematriaResultCard from "@/components/gematria/GematriaResultCard";
import GematriaCompareCard from "@/components/chatCards/GematriaCompareCard";
import NumberLookupCard from "@/components/chatCards/NumberLookupCard";
import { SymbolicPassageCard, SymbolicSpineCard } from "@/components/chatCards/SymbolicCards";
import {
  InfoCard,
  EntityCard,
  TimelineCard,
  ComparisonCard,
  StatCard,
  QuoteCard,
  SourcesCard,
  ListCard,
  WarningCard,
} from "@/components/chatCards/UniversalCards";
import type { CardSegment, UnknownCardSegment } from "@/lib/chatCards/parseChatCards";
import { AlertCircle } from "lucide-react";

type Source = "chat:asherin" | "chat:asher";

interface Props {
  segment: CardSegment | UnknownCardSegment;
  source: Source;
}

export default function ChatCardRenderer({ segment, source }: Props) {
  if (segment.type === "card-unknown") {
    return (
      <div className="my-2 inline-flex items-center gap-2 rounded border border-border/30 bg-foreground/[0.02] px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
        <AlertCircle className="h-3 w-3" strokeWidth={1.5} />
        Unsupported card: {segment.rawType}
      </div>
    );
  }

  const { payload } = segment;

  switch (segment.cardType) {
    // ── gematria family ──────────────────────────────
    case "gematria": {
      const phrase = String(payload.phrase ?? "").slice(0, 200);
      if (!phrase.trim()) return null;
      return <GematriaResultCard phrase={phrase} source={source} />;
    }
    case "gematria-compare": {
      const raw = payload.phrases;
      const phrases = Array.isArray(raw)
        ? raw.map((p) => String(p ?? "").slice(0, 200)).filter((p) => p.trim())
        : [];
      if (phrases.length < 2) return null;
      return <GematriaCompareCard phrases={phrases.slice(0, 4)} source={source} />;
    }
    case "number-lookup": {
      const value = Number(payload.value);
      const cipherRaw = String(payload.cipher ?? "ordinal");
      const cipher = ["ordinal", "reduction", "reverse", "chaldean"].includes(cipherRaw)
        ? (cipherRaw as "ordinal" | "reduction" | "reverse" | "chaldean")
        : "ordinal";
      if (!Number.isFinite(value) || value <= 0 || value > 10000) return null;
      return <NumberLookupCard value={value} cipher={cipher} source={source} />;
    }
    // ── symbolic-exegesis family ─────────────────────
    case "symbolic":
      return <SymbolicPassageCard payload={payload} source={source} />;
    case "symbolic-spine":
      return <SymbolicSpineCard payload={payload} source={source} />;
    // ── universal shape cards ────────────────────────
    case "info":       return <InfoCard payload={payload} source={source} />;
    case "entity":     return <EntityCard payload={payload} source={source} />;
    case "timeline":   return <TimelineCard payload={payload} source={source} />;
    case "comparison": return <ComparisonCard payload={payload} source={source} />;
    case "stat":       return <StatCard payload={payload} source={source} />;
    case "quote":      return <QuoteCard payload={payload} source={source} />;
    case "sources":    return <SourcesCard payload={payload} source={source} />;
    case "list":       return <ListCard payload={payload} source={source} />;
    case "warning":    return <WarningCard payload={payload} source={source} />;
    default:
      return null;
  }
}
