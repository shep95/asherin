import React from "react";
import { Target, TrendingUp, AlertTriangle, MessageCircle, Users, Zap } from "lucide-react";
import { SalesIntelligence, StakeholderInfo } from "./types";

interface Props {
  intel: SalesIntelligence | undefined;
  isActive: boolean;
}

const CrossSalesIntelligence: React.FC<Props> = ({ intel, isActive }) => {
  if (!isActive || !intel) return null;

  const closingColor = intel.closingReadiness > 75 ? "text-emerald-400" : intel.closingReadiness > 50 ? "text-amber-400" : "text-red-400";
  const closingBg = intel.closingReadiness > 75 ? "bg-emerald-500/20" : intel.closingReadiness > 50 ? "bg-amber-500/20" : "bg-red-500/20";

  return (
    <div className="space-y-2">
      {/* Closing Readiness Score */}
      <div className={`px-3 py-2.5 rounded-xl ${closingBg} border border-white/5`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-accent" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Closing Readiness</span>
          </div>
          <span className={`text-lg font-bold ${closingColor}`}>{intel.closingReadiness}%</span>
        </div>
        <div className="mt-1.5 h-1.5 rounded-full bg-background/30 overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${
            intel.closingReadiness > 75 ? "bg-emerald-400" : intel.closingReadiness > 50 ? "bg-amber-400" : "bg-red-400"
          }`} style={{ width: `${intel.closingReadiness}%` }} />
        </div>
        {intel.closingReadiness > 75 && (
          <p className="text-[10px] text-emerald-300/70 mt-1.5">🔥 High buying signal cluster — move to close</p>
        )}
      </div>

      {/* Talk Ratio */}
      <div className="px-3 py-2 rounded-xl bg-muted/10 border border-border/20">
        <div className="flex items-center gap-2 mb-1.5">
          <MessageCircle className="h-3.5 w-3.5 text-muted-foreground/50" />
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50">Talk Ratio</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 rounded-full bg-background/30 overflow-hidden flex">
            <div className="h-full bg-blue-400/70 transition-all" style={{ width: `${intel.talkRatio.prospect}%` }} />
            <div className="h-full bg-accent/50 transition-all" style={{ width: `${intel.talkRatio.seller}%` }} />
          </div>
          <span className="text-[10px] text-muted-foreground/60 w-16 text-right">
            {intel.talkRatio.prospect}/{intel.talkRatio.seller}
          </span>
        </div>
        <div className="flex justify-between text-[9px] mt-0.5">
          <span className="text-blue-400/50">Prospect</span>
          <span className="text-accent/50">You</span>
        </div>
        {intel.talkRatio.seller > 50 && (
          <p className="text-[9px] text-amber-400/60 mt-1">⚠ Listen more — target 30/70</p>
        )}
      </div>

      {/* Next Best Action */}
      {intel.nextBestAction && (
        <div className="px-3 py-2 rounded-xl bg-accent/5 border border-accent/20">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="h-3.5 w-3.5 text-accent" />
            <span className="text-[10px] uppercase tracking-wider text-accent/60">Next Best Action</span>
          </div>
          <p className="text-xs text-foreground/80 font-extralight leading-relaxed">{intel.nextBestAction}</p>
        </div>
      )}

      {/* Buying Signals */}
      {intel.buyingSignals.length > 0 && (
        <div className="px-3 py-2 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
          <div className="flex items-center gap-2 mb-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-400/70" />
            <span className="text-[10px] uppercase tracking-wider text-emerald-400/50">Buying Signals ({intel.buyingSignals.length})</span>
          </div>
          <div className="space-y-0.5">
            {intel.buyingSignals.slice(0, 5).map((s, i) => (
              <p key={i} className="text-[10px] text-emerald-300/60 font-extralight flex items-center gap-1.5">
                <span className="text-emerald-400">✓</span> {s}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Objections */}
      {intel.objectionsDetected.length > 0 && (
        <div className="px-3 py-2 rounded-xl bg-amber-500/5 border border-amber-500/15">
          <div className="flex items-center gap-2 mb-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400/70" />
            <span className="text-[10px] uppercase tracking-wider text-amber-400/50">Objections ({intel.objectionsDetected.length})</span>
          </div>
          <div className="space-y-0.5">
            {intel.objectionsDetected.slice(0, 5).map((o, i) => (
              <p key={i} className="text-[10px] text-amber-300/60 font-extralight flex items-center gap-1.5">
                <span className="text-amber-400">⚠</span> {o}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Stakeholder Map */}
      {intel.stakeholderMap && intel.stakeholderMap.length > 0 && (
        <div className="px-3 py-2 rounded-xl bg-muted/5 border border-border/15">
          <div className="flex items-center gap-2 mb-1.5">
            <Users className="h-3.5 w-3.5 text-muted-foreground/50" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/40">Stakeholder Map</span>
          </div>
          <div className="space-y-1">
            {intel.stakeholderMap.map((s: StakeholderInfo, i: number) => (
              <div key={i} className="flex items-center justify-between text-[10px]">
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    s.sentiment === "positive" ? "bg-emerald-400" : s.sentiment === "negative" ? "bg-red-400" : "bg-amber-400"
                  }`} />
                  <span className="text-foreground/60">{s.name}</span>
                </div>
                <span className="text-muted-foreground/40 capitalize text-[9px]">{s.role.replace("_", " ")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rapport & Question Depth */}
      <div className="grid grid-cols-2 gap-1.5">
        <div className="px-2.5 py-2 rounded-xl bg-muted/5 border border-border/15 text-center">
          <p className="text-[9px] text-muted-foreground/40 uppercase">Rapport</p>
          <p className="text-sm font-bold text-foreground/70">{intel.rapportScore}%</p>
        </div>
        <div className="px-2.5 py-2 rounded-xl bg-muted/5 border border-border/15 text-center">
          <p className="text-[9px] text-muted-foreground/40 uppercase">Q Depth</p>
          <p className="text-sm font-bold text-foreground/70">{intel.questionDepth}/5</p>
        </div>
      </div>

      {/* Competitor Mentions */}
      {intel.competitorMentions && intel.competitorMentions.length > 0 && (
        <div className="px-3 py-1.5 rounded-xl bg-red-500/5 border border-red-500/10">
          <p className="text-[9px] text-red-400/50 uppercase mb-0.5">Competitors Mentioned</p>
          <p className="text-[10px] text-red-300/60">{intel.competitorMentions.join(", ")}</p>
        </div>
      )}
    </div>
  );
};

export default CrossSalesIntelligence;
