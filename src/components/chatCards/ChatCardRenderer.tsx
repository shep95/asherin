// Dispatch layer for the Card Protocol. Given a parsed CardSegment, renders
// the correct card component. Central registry so adding a new card type is
// a one-line addition here + one entry in parseChatCards.KNOWN.

import GematriaResultCard from "@/components/gematria/GematriaResultCard";
import GematriaCompareCard from "@/components/chatCards/GematriaCompareCard";
import NumberLookupCard from "@/components/chatCards/NumberLookupCard";
import type { CardSegment, UnknownCardSegment } from "@/lib/chatCards/parseChatCards";
import { AlertCircle } from "lucide-react";

type Source = "chat:aureon" | "chat:asher";

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

  switch (segment.cardType) {
    case "gematria": {
      const phrase = String(segment.payload.phrase ?? "").slice(0, 200);
      if (!phrase.trim()) return null;
      return <GematriaResultCard phrase={phrase} source={source} />;
    }
    case "gematria-compare": {
      const raw = segment.payload.phrases;
      const phrases = Array.isArray(raw)
        ? raw.map((p) => String(p ?? "").slice(0, 200)).filter((p) => p.trim())
        : [];
      if (phrases.length < 2) return null;
      return <GematriaCompareCard phrases={phrases.slice(0, 4)} source={source} />;
    }
    case "number-lookup": {
      const value = Number(segment.payload.value);
      const cipherRaw = String(segment.payload.cipher ?? "ordinal");
      const cipher = ["ordinal", "reduction", "reverse", "chaldean"].includes(cipherRaw)
        ? (cipherRaw as "ordinal" | "reduction" | "reverse" | "chaldean")
        : "ordinal";
      if (!Number.isFinite(value) || value <= 0 || value > 10000) return null;
      return <NumberLookupCard value={value} cipher={cipher} source={source} />;
    }
    default:
      return null;
  }
}
