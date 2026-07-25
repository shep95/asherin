// First-run onboarding — 3 steps. Lightweight, dismissible, never re-shows.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, ArrowRight, Sparkles } from "lucide-react";
import {
  INTENT_GROUPS,
  INTENT_GROUP_BLURB,
  NAV_INTENTS,
  type IntentGroup,
  type NavIntent,
  trackRecentIntent,
} from "@/lib/navIntents";

const FLAG = "asherin_onboarded_v1";

const EXAMPLE_PROMPTS: Record<IntentGroup, string> = {
  Create: "Write a 4-slide pitch deck for a coffee subscription startup.",
  Analyze: "Look at the CSV I just uploaded and tell me which months drove revenue.",
  Investigate: "Pull a 5-bullet OSINT brief on the company 'OpenAI'.",
  Build: "Scaffold a Node script that watches a folder and uploads new files to S3.",
  Workspace: "Save this conversation to a project called 'Q1 Research'.",
  Account: "Show me what I have used this month.",
};

interface Props {
  /** Force open regardless of localStorage flag — used for "Replay tour" button. */
  forceOpen?: boolean;
  onClose?: () => void;
}

export default function OnboardingModal({ forceOpen = false, onClose }: Props) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [pickedGroup, setPickedGroup] = useState<IntentGroup | null>(null);

  useEffect(() => {
    if (forceOpen) { setOpen(true); setStep(0); return; }
    try {
      const seen = localStorage.getItem(FLAG);
      if (!seen) setOpen(true);
    } catch { /* ignore */ }
  }, [forceOpen]);

  const dismiss = () => {
    try { localStorage.setItem(FLAG, "1"); } catch {}
    setOpen(false);
    onClose?.();
  };

  if (!open) return null;

  const groupTools: NavIntent[] = pickedGroup
    ? NAV_INTENTS.filter((i) => i.group === pickedGroup && !i.adminOnly).slice(0, 3)
    : [];

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-background/85 backdrop-blur-md">
      <div className="relative w-full max-w-xl mx-4 rounded-2xl border border-border bg-card shadow-2xl p-6">
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground p-1 rounded"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2 mb-1 text-muted-foreground/70 text-[11px] tracking-wider uppercase">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Welcome · Step {step + 1} of 3</span>
        </div>

        {step === 0 && (
          <>
            <h2 className="text-xl font-light text-foreground mb-1">What do you mostly want to do?</h2>
            <p className="text-sm text-muted-foreground mb-4">Pick one — we'll show you the right tools.</p>
            <div className="grid grid-cols-2 gap-2">
              {INTENT_GROUPS.filter((g) => g !== "Account").map((g) => (
                <button
                  key={g}
                  onClick={() => { setPickedGroup(g); setStep(1); }}
                  className="text-left rounded-xl border border-border/40 bg-card/40 hover:bg-card/70 hover:border-border p-3 transition-all"
                >
                  <div className="text-sm font-medium text-foreground">{g}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{INTENT_GROUP_BLURB[g]}</div>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 1 && pickedGroup && (
          <>
            <h2 className="text-xl font-light text-foreground mb-1">Here are the tools for {pickedGroup}</h2>
            <p className="text-sm text-muted-foreground mb-4">Tap one to open it, or skip ahead.</p>
            <div className="space-y-2">
              {groupTools.map((t) => (
                <button
                  key={t.view ?? t.route}
                  onClick={() => {
                    const key = (t.view ?? t.route)!;
                    trackRecentIntent(key);
                    try { localStorage.setItem(FLAG, "1"); } catch {}
                    setOpen(false);
                    navigate(t.route ? t.route : (t.view === "chat" ? "/dashboard" : `/dashboard/${t.view}`));
                  }}
                  className="w-full text-left rounded-xl border border-border/40 bg-card/40 hover:bg-card/70 hover:border-border p-3 transition-all flex items-center justify-between gap-2"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground truncate">{t.label}</span>
                    {(t.codename || t.blurb) && (
                      <span className="block text-xs text-muted-foreground truncate">
                        {t.codename}{t.codename && t.blurb ? " · " : ""}{t.blurb}
                      </span>
                    )}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />
                </button>
              ))}
            </div>
            <button
              onClick={() => setStep(2)}
              className="mt-4 text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
            >
              Skip — try an example instead →
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-xl font-light text-foreground mb-1">Try this</h2>
            <p className="text-sm text-muted-foreground mb-4">
              You can also press <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px]">/</kbd> any time to jump to any tool.
            </p>
            <div className="rounded-xl border border-border/40 bg-card/40 p-3 text-sm font-light text-foreground">
              {EXAMPLE_PROMPTS[pickedGroup ?? "Create"]}
            </div>
            <button
              onClick={() => {
                // Pre-fill the chat composer.
                try {
                  sessionStorage.setItem(
                    "asherin_prefill_prompt",
                    EXAMPLE_PROMPTS[pickedGroup ?? "Create"],
                  );
                } catch {}
                try { localStorage.setItem(FLAG, "1"); } catch {}
                setOpen(false);
                navigate("/dashboard");
                window.dispatchEvent(new CustomEvent("asherin-onboarding-prefill"));
              }}
              className="mt-4 w-full rounded-xl bg-foreground text-background py-2.5 text-sm font-medium hover:opacity-90 transition"
            >
              Try this in chat →
            </button>
            <button
              onClick={dismiss}
              className="mt-2 w-full text-xs text-muted-foreground hover:text-foreground"
            >
              I'll explore on my own
            </button>
          </>
        )}
      </div>
    </div>
  );
}
