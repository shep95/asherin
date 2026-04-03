import React from "react";
import {
  TrendingUp, Code, Palette, Calculator, PenTool, Search,
  Heart, GraduationCap, Music, Gamepad2, Mail, Monitor,
  Target, Users, Scale, Headphones, Handshake
} from "lucide-react";
import { AnalysisMode, MODE_CONFIG } from "./types";

const ICONS: Record<string, React.FC<{ className?: string }>> = {
  TrendingUp, Code, Palette, Calculator, PenTool, Search,
  Heart, GraduationCap, Music, Gamepad2, Mail, Monitor,
  Target, Users, Scale, Headphones, Handshake,
};

interface Props {
  currentMode: AnalysisMode;
  onModeChange: (mode: AnalysisMode) => void;
  compact?: boolean;
}

const CATEGORIES = ["Finance", "Business", "Engineering", "Creative", "Professional", "Analysis", "Productivity", "General"] as const;

const CrossModeSelector: React.FC<Props> = ({ currentMode, onModeChange, compact }) => {
  const modes = Object.entries(MODE_CONFIG) as [AnalysisMode, typeof MODE_CONFIG[AnalysisMode]][];

  if (compact) {
    return (
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-1">
        {modes.map(([key, cfg]) => {
          const Icon = ICONS[cfg.icon] || Monitor;
          const active = currentMode === key;
          return (
            <button
              key={key}
              onClick={() => onModeChange(key)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] whitespace-nowrap transition-all ${
                active
                  ? `bg-accent/10 border border-accent/30 ${cfg.color}`
                  : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/10"
              }`}
              title={cfg.description}
            >
              <Icon className="h-3.5 w-3.5 flex-shrink-0" />
              {cfg.label}
            </button>
          );
        })}
      </div>
    );
  }

  // Group by category
  const grouped = CATEGORIES.map(cat => ({
    category: cat,
    items: modes.filter(([, cfg]) => cfg.category === cat),
  })).filter(g => g.items.length > 0);

  return (
    <div className="space-y-3">
      {grouped.map(group => (
        <div key={group.category}>
          <p className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground/30 mb-1.5">{group.category}</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-1.5">
            {group.items.map(([key, cfg]) => {
              const Icon = ICONS[cfg.icon] || Monitor;
              const active = currentMode === key;
              return (
                <button
                  key={key}
                  onClick={() => onModeChange(key)}
                  className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl transition-all text-center ${
                    active
                      ? `bg-accent/10 border border-accent/30 ${cfg.color}`
                      : "border border-border/20 text-muted-foreground/40 hover:text-muted-foreground hover:border-border/40 hover:bg-muted/5"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-[10px] font-medium">{cfg.label}</span>
                  <span className="text-[8px] opacity-60 leading-tight hidden sm:block">{cfg.description.split(",")[0]}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default CrossModeSelector;
