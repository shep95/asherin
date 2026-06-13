import { useEffect, useState } from "react";
import { ShieldCheck, ChevronDown } from "lucide-react";
import type { AzplenClassification } from "./types";
import { useAzplenSession } from "./AzplenSessionContext";

const LEVELS: AzplenClassification[] = ["UNCLASS", "CUI", "CONFIDENTIAL", "SECRET", "TOP SECRET", "TS/SCI"];

const STYLE: Record<AzplenClassification, string> = {
  "UNCLASS": "border-emerald-300/40 text-emerald-200 bg-emerald-300/[0.06]",
  "CUI": "border-yellow-300/40 text-yellow-200 bg-yellow-300/[0.06]",
  "CONFIDENTIAL": "border-orange-300/40 text-orange-200 bg-orange-300/[0.06]",
  "SECRET": "border-red-400/40 text-red-200 bg-red-400/[0.08]",
  "TOP SECRET": "border-red-500/60 text-red-100 bg-red-500/[0.10]",
  "TS/SCI": "border-red-600/70 text-red-50 bg-red-600/[0.14]",
};

const storageKey = (sid: string) => `azplen:classification:${sid}`;

/**
 * Classification badge for the session header. Persists per-session.
 * Visual only — RLS-level enforcement is on the roadmap.
 */
const ClassificationBadge = () => {
  const { activeSession } = useAzplenSession();
  const [level, setLevel] = useState<AzplenClassification>("UNCLASS");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!activeSession) return;
    try {
      const raw = localStorage.getItem(storageKey(activeSession.id));
      if (raw && (LEVELS as string[]).includes(raw)) setLevel(raw as AzplenClassification);
      else setLevel("UNCLASS");
    } catch { setLevel("UNCLASS"); }
  }, [activeSession?.id]);

  const update = (next: AzplenClassification) => {
    setLevel(next);
    setOpen(false);
    if (activeSession) {
      try { localStorage.setItem(storageKey(activeSession.id), next); } catch {}
    }
  };

  if (!activeSession) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[9px] font-mono uppercase tracking-[0.22em] transition hover:scale-[1.02] ${STYLE[level]}`}
        title="Session classification (visual; enforcement pending)"
      >
        <ShieldCheck className="h-3 w-3" />
        {level}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 min-w-[140px] rounded-lg border border-foreground/15 bg-background/95 backdrop-blur-xl p-1 shadow-2xl">
            {LEVELS.map((l) => (
              <button
                key={l}
                onClick={() => update(l)}
                className={`w-full text-left px-2 py-1.5 rounded text-[10px] font-mono uppercase tracking-[0.2em] hover:bg-foreground/[0.06] ${level === l ? "text-foreground" : "text-muted-foreground"}`}
              >
                {l}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default ClassificationBadge;
