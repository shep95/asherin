import { useState } from "react";
import { Shield, FolderSearch, FileWarning, FileText, Plug, Settings, Users, Bell, Plus, Search } from "lucide-react";
import type { ZerlalScreen } from "./types";

interface ZerlalNavProps {
  activeScreen: ZerlalScreen;
  onNavigate: (screen: ZerlalScreen) => void;
  criticalCount: number;
}

const navItems: { id: ZerlalScreen; label: string; icon: React.ElementType }[] = [
  { id: "dashboard", label: "Dashboard", icon: Shield },
  { id: "project", label: "Projects", icon: FolderSearch },
  { id: "finding", label: "Findings", icon: FileWarning },
  { id: "reports", label: "Reports", icon: FileText },
  { id: "integrations", label: "Integrations", icon: Plug },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "team", label: "Team", icon: Users },
];

const ZerlalNav = ({ activeScreen, onNavigate, criticalCount }: ZerlalNavProps) => {
  return (
    <div className="w-52 shrink-0 border-r border-border/[0.06] bg-background/60 backdrop-blur-md flex flex-col">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-border/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-foreground/[0.04] border border-border/[0.08] flex items-center justify-center">
            <Shield className="h-4 w-4 text-foreground/60" />
          </div>
          <div>
            <span className="text-[11px] font-light tracking-[0.15em] text-foreground/90 uppercase">Zerlal</span>
            <p className="text-[8px] text-muted-foreground/30 tracking-[0.2em] uppercase">Vulnerability Intel</p>
          </div>
        </div>
      </div>

      {/* Nav Items */}
      <div className="flex-1 py-3 px-2 space-y-0.5">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[11px] tracking-wide transition-all ${
              activeScreen === item.id
                ? "bg-foreground/[0.06] text-foreground/90"
                : "text-muted-foreground/50 hover:text-foreground/70 hover:bg-foreground/[0.02]"
            }`}
          >
            <item.icon className="h-3.5 w-3.5" />
            <span>{item.label}</span>
            {item.id === "finding" && criticalCount > 0 && (
              <span className="ml-auto text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full font-medium">
                {criticalCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Bottom */}
      <div className="px-3 py-3 border-t border-border/[0.06]">
        <div className="text-[9px] text-muted-foreground/25 tracking-wider uppercase text-center">
          Powered by AUREON
        </div>
      </div>
    </div>
  );
};

export default ZerlalNav;
