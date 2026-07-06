// Dossier Rail — Terminator T-800 / Iron Man HUD styled scrolling data column.
// Renders top-N priority contacts as a right-side rail with type, IFF tag,
// privacy grade, and one-tap IFF cycle. Runs alongside the AR camera view.

import { memo, useEffect, useState } from "react";
import type { Contact } from "./core/types";
import { fingerprint, priorityScore, type Fingerprint } from "./core/bleFingerprint";
import { iffStore, IFF_COLOR, IFF_GLYPH, type Iff } from "./core/iffStore";

const IFF_CYCLE: Iff[] = ["unknown", "friend", "neutral", "suspect", "hostile"];
const next = (t: Iff): Iff => IFF_CYCLE[(IFF_CYCLE.indexOf(t) + 1) % IFF_CYCLE.length];

interface Props {
  contacts: Contact[];
  arOn: boolean;
}

const DossierRail = memo(function DossierRail({ contacts, arOn }: Props) {
  const [tick, setTick] = useState(0);
  useEffect(() => iffStore.subscribe(() => setTick((n) => n + 1)), []);
  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 1500);
    return () => clearInterval(t);
  }, []);
  void tick;

  if (!arOn) return null;

  const ranked = contacts
    .map((c) => ({ c, fp: fingerprint(c), score: 0 }))
    .map((x) => ({ ...x, score: priorityScore(x.c, x.fp) }))
    .filter((x) => x.score > 0 || x.fp.family !== "unknown")
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  if (!ranked.length) return null;

  return (
    <div
      className="absolute right-1 top-14 max-h-[64%] w-[190px] overflow-hidden pointer-events-none"
      style={{ zIndex: 5 }}
    >
      <div className="flex items-center justify-between mb-1 px-1.5">
        <span className="text-[8px] font-mono tracking-[0.22em] uppercase text-[#e8c684]/85">Dossier</span>
        <span className="text-[7px] font-mono text-foreground/45">TOP {ranked.length}</span>
      </div>
      <div className="space-y-1.5">
        {ranked.map(({ c, fp, score }) => (
          <DossierCard key={c.id} c={c} fp={fp} score={score} />
        ))}
      </div>
    </div>
  );
});

function DossierCard({ c, fp, score }: { c: Contact; fp: Fingerprint; score: number }) {
  const [iff, setIff] = useState<Iff>(() => iffStore.get(c.id));
  useEffect(() => setIff(iffStore.get(c.id)), [c.id]);
  const cycle = () => {
    const n = next(iff);
    iffStore.set(c.id, n);
    setIff(n);
  };
  const color = IFF_COLOR[iff];
  const gradeTone =
    fp.privacyGrade === "F" ? "text-rose-300/95 border-rose-300/50" :
    fp.privacyGrade === "D" ? "text-orange-200/95 border-orange-300/40" :
    fp.privacyGrade === "C" ? "text-amber-200/90 border-amber-300/40" :
    fp.privacyGrade === "B" ? "text-sky-200/90 border-sky-300/40" :
    "text-emerald-200/95 border-emerald-300/50";
  const ageS = Math.max(0, Math.round((Date.now() - c.lastSeen) / 1000));
  return (
    <div
      className="rounded-md bg-black/70 backdrop-blur-sm border overflow-hidden pointer-events-auto animate-fade-in"
      style={{ borderColor: color }}
    >
      <div className="flex items-center gap-1 px-1.5 py-1 border-b border-white/[0.06]">
        <button
          onClick={cycle}
          title={`IFF: ${iff} (click to cycle)`}
          className="text-[10px] leading-none font-mono px-1 py-0.5 rounded-sm border transition hover:scale-105"
          style={{ color, borderColor: color }}
        >
          {IFF_GLYPH[iff]}
        </button>
        <div className="flex-1 truncate text-[9px] font-mono tracking-[0.06em] text-[#f0d59a]">
          {fp.familyLabel}
        </div>
        <div className={`text-[7px] font-mono px-1 rounded-sm border ${gradeTone}`} title={`Privacy: ${fp.privacy.join(", ")}`}>
          {fp.privacyGrade}
        </div>
      </div>
      <div className="px-1.5 py-1 space-y-[2px]">
        <div className="flex items-center justify-between text-[8px] font-mono text-foreground/70">
          <span className="truncate max-w-[110px]">{c.displayName}</span>
          <span className="text-[#e8c684]/70">P{score}</span>
        </div>
        <div className="flex items-center justify-between text-[8px] font-mono text-foreground/55">
          <span>{c.rssi != null ? `${c.rssi} dBm` : "no rssi"}</span>
          <span>{c.distanceLabel || "—"}</span>
          <span>{ageS}s</span>
        </div>
        {fp.isTracker || fp.isSurveillance ? (
          <div className={`text-[7px] font-mono tracking-[0.18em] uppercase px-1 py-[1px] rounded-sm inline-block ${
            fp.isSurveillance ? "bg-rose-500/25 text-rose-100 border border-rose-300/50" :
            "bg-orange-500/25 text-orange-100 border border-orange-300/50"
          }`}>
            {fp.isSurveillance ? "⚠ surveillance" : "◎ tracker"}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default DossierRail;
