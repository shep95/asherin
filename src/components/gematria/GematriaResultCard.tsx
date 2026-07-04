// Compact inline gematria card rendered inside chat assistant bubbles.
// Runs computeAll() locally, auto-persists via useGematria, and shows
// cross-corpus matches. Save failures surface a retry affordance so the
// chat never blocks on the DB.

import { useEffect, useMemo, useRef, useState } from "react";
import { Calculator, Check, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { computeAll, CIPHER_LABEL, normalize, type CipherKey } from "@/lib/gematria";
import { findBundledMatches } from "@/lib/gematriaCorpus";
import { useGematria } from "@/hooks/useGematria";

const CIPHERS: CipherKey[] = ["ordinal", "reduction", "reverse", "chaldean"];

interface Props {
  phrase: string;
  source?: "chat:aureon" | "chat:asher";
}

const MAX = 200;

export default function GematriaResultCard({ phrase, source }: Props) {
  const clean = (phrase || "").slice(0, MAX);
  const normalized = useMemo(() => normalize(clean), [clean]);
  const results = useMemo(() => (normalized ? computeAll(clean) : null), [clean, normalized]);
  const { save, matchesFor } = useGematria();
  const [saveState, setSaveState] = useState<"idle" | "saving" | "ok" | "error">("idle");
  const [expanded, setExpanded] = useState(false);
  const savedRef = useRef<string>("");

  useEffect(() => {
    if (!normalized || savedRef.current === normalized) return;
    savedRef.current = normalized;
    setSaveState("saving");
    save(clean).then((row) => {
      setSaveState(row ? "ok" : "error");
    }).catch(() => setSaveState("error"));
  }, [normalized, clean, save]);

  if (!normalized || !results) return null;

  const retry = () => {
    setSaveState("saving");
    save(clean).then((row) => setSaveState(row ? "ok" : "error"));
  };

  return (
    <div className="my-2 rounded-lg border border-border/30 bg-foreground/[0.02] overflow-hidden text-foreground">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/20">
        <Calculator className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Gematria</span>
        <span className="text-sm font-light truncate flex-1" title={clean}>"{clean}"</span>
        {saveState === "ok" && (
          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-500/80">
            <Check className="h-3 w-3" strokeWidth={2} /> Saved
          </span>
        )}
        {saveState === "saving" && (
          <span className="text-[10px] text-muted-foreground">Saving…</span>
        )}
        {saveState === "error" && (
          <button
            type="button"
            onClick={retry}
            className="inline-flex items-center gap-1 text-[10px] text-amber-500/90 hover:text-amber-400"
          >
            <AlertTriangle className="h-3 w-3" strokeWidth={2} /> Retry save
          </button>
        )}
      </div>
      <table className="w-full text-sm">
        <thead className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground bg-foreground/[0.02]">
          <tr>
            <th className="text-left px-3 py-1.5 font-normal">Cipher</th>
            <th className="text-right px-3 py-1.5 font-normal">Sum</th>
            <th className="text-right px-3 py-1.5 font-normal">Reduced</th>
            <th className="text-right px-3 py-1.5 font-normal">Matches</th>
          </tr>
        </thead>
        <tbody>
          {CIPHERS.map((c) => {
            const r = results[c];
            const personal = matchesFor(c, r.sum, normalized);
            const bundled = findBundledMatches(c, r.sum, normalized, 20);
            const combined = [
              ...bundled.map((b) => `${b.phrase} (${b.category})`),
              ...personal.map((p) => p.phrase),
            ];
            const total = combined.length;
            return (
              <tr key={c} className="border-t border-border/15">
                <td className="px-3 py-1.5 text-xs">{CIPHER_LABEL[c]}</td>
                <td className="px-3 py-1.5 text-right font-mono text-sm">{r.sum}</td>
                <td className="px-3 py-1.5 text-right font-mono text-xs text-muted-foreground">{r.reduced}</td>
                <td className="px-3 py-1.5 text-right font-mono text-xs text-muted-foreground">
                  {total > 0 ? (
                    <span title={combined.slice(0, 12).join(", ")}>{total}</span>
                  ) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-center gap-1 px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground border-t border-border/15"
      >
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {expanded ? "Hide breakdown" : "Per-letter breakdown"}
      </button>
      {expanded && (
        <div className="px-3 py-2 border-t border-border/15 space-y-2">
          {CIPHERS.map((c) => {
            const r = results[c];
            return (
              <div key={c}>
                <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">
                  {CIPHER_LABEL[c]}
                </div>
                <div className="flex flex-wrap gap-1">
                  {r.letters.map((l, i) => (
                    <span
                      key={i}
                      className="inline-flex flex-col items-center rounded border border-border/30 px-1.5 py-0.5 text-[10px] font-mono"
                    >
                      <span className="uppercase">{l.letter}</span>
                      <span className="text-muted-foreground">{l.value}</span>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
          {source && (
            <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/60 pt-1">
              Origin: {source}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
