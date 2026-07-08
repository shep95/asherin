import { useState } from "react";
import { Brain, Clock, Shield, Scale, MessageSquare, Search, X, Download } from "lucide-react";
import TemporalPanel from "./TemporalPanel";
import CredibilityPanel from "./CredibilityPanel";
import FactCheckPanel from "./FactCheckPanel";
import NarrativePanel from "./NarrativePanel";
import InvestigativePanel from "./InvestigativePanel";
import { downloadIntelligenceReport } from "./buildIntelligenceReportText";
import type { SearchResult } from "../types";

type Tab = "temporal" | "credibility" | "factcheck" | "narrative" | "investigative";

const TABS: { id: Tab; label: string; icon: any; desc: string }[] = [
  { id: "temporal", label: "Timeline", icon: Clock, desc: "How the story evolved" },
  { id: "credibility", label: "Credibility", icon: Shield, desc: "Source bias & trust" },
  { id: "factcheck", label: "Fact-Check", icon: Scale, desc: "Verify & cross-reference" },
  { id: "narrative", label: "Narrative", icon: MessageSquare, desc: "Frames & sentiment" },
  { id: "investigative", label: "Investigate", icon: Search, desc: "Gaps & next steps" },
];

interface Props {
  query: string;
  results: SearchResult[];
  onClose: () => void;
  onRunQuery?: (q: string) => void;
}

export default function IntelligenceSuitePanel({ query, results, onClose, onRunQuery }: Props) {
  const [tab, setTab] = useState<Tab>("temporal");

  return (
    <div className="h-full flex flex-col bg-background/95 backdrop-blur-xl">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border/20 px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Brain className="h-4 w-4 text-accent shrink-0" />
          <div className="min-w-0">
            <h2 className="text-xs font-medium tracking-[0.15em] uppercase text-foreground">Intelligence Suite</h2>
            <p className="text-[10px] text-muted-foreground/60 truncate">{query}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-foreground/5 transition-colors shrink-0">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 border-b border-border/20 px-2 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`group flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-light tracking-wide border-b-2 transition-all whitespace-nowrap ${
                  active
                    ? "border-accent text-accent"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                title={t.desc}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {tab === "temporal" && <TemporalPanel query={query} results={results} />}
        {tab === "credibility" && <CredibilityPanel query={query} results={results} />}
        {tab === "factcheck" && <FactCheckPanel query={query} results={results} />}
        {tab === "narrative" && <NarrativePanel query={query} results={results} />}
        {tab === "investigative" && (
          <InvestigativePanel query={query} results={results} onRunQuery={onRunQuery} />
        )}
      </div>
    </div>
  );
}
