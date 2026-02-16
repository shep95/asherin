import { useState } from "react";
import { GitBranch, Eye, ArrowRight, Database, Filter, Calculator, FileOutput, Clock, AlertTriangle, ChevronRight } from "lucide-react";

interface LineageNode {
  id: string;
  type: "source" | "transform" | "aggregate" | "filter" | "output";
  label: string;
  description: string;
  timestamp?: string;
  valuesBefore?: string;
  valuesAfter?: string;
}

interface LineageChain {
  id: string;
  metricName: string;
  currentValue: string;
  chain: LineageNode[];
  downstreamCount: number;
}

const DEMO_CHAINS: LineageChain[] = [
  {
    id: "l1", metricName: "Monthly Revenue", currentValue: "$847,293", downstreamCount: 7,
    chain: [
      { id: "n1", type: "source", label: "Stripe API", description: "Raw transaction data imported", timestamp: "Mar 19 2026, 03:00 AM", valuesBefore: "Raw: 12,847 transactions" },
      { id: "n2", type: "filter", label: "Exclude Test Accounts", description: "Rule 4: Remove accounts with @test.com emails", valuesAfter: "11,923 transactions (924 excluded)" },
      { id: "n3", type: "transform", label: "Currency Normalization", description: "All amounts converted to USD at daily exchange rates", valuesAfter: "Base currency: USD" },
      { id: "n4", type: "aggregate", label: "Monthly Summation", description: "Sum of all transaction amounts for March 2026", valuesAfter: "$847,293.00" },
      { id: "n5", type: "output", label: "Dashboard Widget", description: "Revenue card on executive dashboard", timestamp: "Mar 19 2026, 03:02 AM" },
    ],
  },
  {
    id: "l2", metricName: "Customer Churn Rate", currentValue: "4.7%", downstreamCount: 3,
    chain: [
      { id: "n6", type: "source", label: "CRM Database", description: "Customer status records", timestamp: "Mar 18 2026, 11:00 PM" },
      { id: "n7", type: "filter", label: "Active → Cancelled", description: "Filtered customers who changed status from active to cancelled in the last 30 days" },
      { id: "n8", type: "aggregate", label: "Percentage Calculation", description: "Cancelled / Total Active at period start × 100", valuesAfter: "47 cancelled / 1,000 active = 4.7%" },
      { id: "n9", type: "output", label: "Churn Alert System", description: "Triggers alert when >5%", timestamp: "Mar 19 2026, 00:15 AM" },
    ],
  },
  {
    id: "l3", metricName: "Average Deal Size", currentValue: "$23,450", downstreamCount: 5,
    chain: [
      { id: "n10", type: "source", label: "Salesforce Export", description: "Closed-won opportunities", timestamp: "Mar 17 2026, 06:00 PM" },
      { id: "n11", type: "filter", label: "Remove Outliers", description: "Excluded deals > 3 standard deviations from mean", valuesAfter: "847 deals (12 outliers removed)" },
      { id: "n12", type: "transform", label: "Annualized Value", description: "Multi-year contracts divided by contract length", valuesAfter: "Annualized values applied" },
      { id: "n13", type: "aggregate", label: "Mean Calculation", description: "Sum of annualized values / count of deals", valuesAfter: "$23,450.00" },
      { id: "n14", type: "output", label: "Sales Dashboard + 2 Reports", description: "Used in executive summary and board deck", timestamp: "Mar 18 2026, 09:00 AM" },
    ],
  },
];

const nodeIcons: Record<string, React.ElementType> = {
  source: Database, transform: Calculator, aggregate: Calculator, filter: Filter, output: FileOutput,
};

const nodeColors: Record<string, string> = {
  source: "border-accent/30 bg-accent/10 text-accent",
  transform: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  aggregate: "border-purple-500/30 bg-purple-500/10 text-purple-400",
  filter: "border-cyan-500/30 bg-cyan-500/10 text-cyan-400",
  output: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
};

const DataLineagePanel = () => {
  const [expandedChain, setExpandedChain] = useState<string | null>(DEMO_CHAINS[0].id);
  const [search, setSearch] = useState("");

  const filtered = search
    ? DEMO_CHAINS.filter(c => c.metricName.toLowerCase().includes(search.toLowerCase()))
    : DEMO_CHAINS;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <GitBranch className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-extralight tracking-wide text-foreground">Data Lineage</h2>
        </div>
        <p className="text-xs font-extralight text-muted-foreground mt-1">
          Click any metric to trace its complete history — from raw source to final value.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search metrics…"
          className="flex-1 bg-card/20 border border-border/20 rounded-xl px-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none" />
      </div>

      <div className="space-y-3">
        {filtered.map(chain => {
          const isOpen = expandedChain === chain.id;
          return (
            <div key={chain.id} className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm overflow-hidden">
              <button onClick={() => setExpandedChain(isOpen ? null : chain.id)}
                className="w-full flex items-center gap-4 p-4 hover:bg-foreground/5 transition-colors text-left">
                <Eye className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-light text-foreground">{chain.metricName}</p>
                  <p className="text-[10px] text-muted-foreground/50 mt-0.5">{chain.chain.length} steps · {chain.downstreamCount} downstream dependencies</p>
                </div>
                <span className="text-lg font-extralight text-foreground tabular-nums">{chain.currentValue}</span>
                <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`} />
              </button>

              {isOpen && (
                <div className="border-t border-border/20 p-4">
                  {/* Lineage chain */}
                  <div className="relative space-y-0">
                    {chain.chain.map((node, idx) => {
                      const Icon = nodeIcons[node.type] || Database;
                      const colors = nodeColors[node.type] || "";
                      const isLast = idx === chain.chain.length - 1;
                      return (
                        <div key={node.id} className="relative flex gap-4">
                          {/* Vertical line */}
                          {!isLast && (
                            <div className="absolute left-[15px] top-[32px] bottom-0 w-px bg-border/20" />
                          )}
                          {/* Node */}
                          <div className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${colors}`}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="flex-1 pb-5">
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-light text-foreground">{node.label}</p>
                              <span className="text-[9px] text-muted-foreground/40 uppercase">{node.type}</span>
                            </div>
                            <p className="text-[10px] font-extralight text-muted-foreground mt-0.5">{node.description}</p>
                            {node.timestamp && (
                              <div className="flex items-center gap-1 mt-1 text-[9px] text-muted-foreground/40">
                                <Clock className="h-2.5 w-2.5" /> {node.timestamp}
                              </div>
                            )}
                            {node.valuesAfter && (
                              <p className="text-[10px] text-accent/70 mt-1 font-mono">{node.valuesAfter}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Impact analysis */}
                  <div className="mt-4 rounded-lg border border-amber-500/15 bg-amber-500/5 p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[10px] font-light text-foreground">Impact Analysis</p>
                        <p className="text-[10px] font-extralight text-muted-foreground mt-0.5">
                          Changing any step in this chain affects <span className="text-foreground">{chain.downstreamCount} dashboards and reports</span> downstream.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DataLineagePanel;
