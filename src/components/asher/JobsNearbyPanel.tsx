// JobsNearbyPanel — hiring intelligence for Asherin Maps.
//
// Answers "find restaurant jobs near this address that are hiring" with a live
// open-web board sweep, geocoded to map pins. Every posting keeps its source
// URL; nothing is synthesised.

import { useEffect, useRef, useState } from "react";
import { Briefcase, X, Loader2, ExternalLink, MapPin, Navigation } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getActiveIntelMapByok } from "@/lib/intelMapByok";
import { fmtDistance, type Units } from "@/lib/asher/directions";

export interface JobPosting {
  title: string;
  employer: string;
  address?: string;
  lat?: number;
  lng?: number;
  distanceM?: number;
  pay?: string;
  employmentType?: string;
  posted?: string;
  applyUrl?: string;
  source: string;
  snippet?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  center: { lat: number; lng: number };
  units: Units;
  onResults: (jobs: JobPosting[]) => void;
  onFocus: (j: JobPosting) => void;
  onRoute: (j: JobPosting) => void;
}

const PRESETS = ["Restaurant", "Warehouse", "Driver", "Retail", "Security", "Nursing"];

const JobsNearbyPanel = ({ open, onClose, center, units, onResults, onFocus, onRoute }: Props) => {
  const [role, setRole] = useState("");
  const [radiusMi, setRadiusMi] = useState(10);
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locality, setLocality] = useState<string | null>(null);
  const liveRef = useRef(true);

  const run = async (r: string) => {
    const q = r.trim();
    if (!q) { setError("Name the role you're hunting for."); return; }
    setBusy(true);
    setError(null);
    try {
      const byok = getActiveIntelMapByok();
      const { data, error: err } = await supabase.functions.invoke("asher-jobs-nearby", {
        body: { role: q, lat: center.lat, lng: center.lng, radiusMi, ...(byok ? { byok: byok.apiKey } : {}) },
      });
      if (!liveRef.current) return;
      if (err) throw new Error(err.message);
      if (!data?.success) throw new Error(data?.error || "Sweep failed");
      const list: JobPosting[] = Array.isArray(data.jobs) ? data.jobs : [];
      setJobs(list);
      setLocality(data.locality || null);
      onResults(list);
      if (!list.length) setError(data.note || "No live postings surfaced for that role here.");
    } catch (e: any) {
      setError(e?.message || "Job sweep failed.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="flex max-h-[calc(100vh-8rem)] w-[340px] flex-col overflow-hidden rounded-xl border border-[#c98b3a]/25 bg-card/95 backdrop-blur-xl shadow-[0_18px_50px_-12px_rgba(0,0,0,.85)]">
      <div className="flex items-center gap-2 border-b border-border/15 px-3 py-2.5">
        <Briefcase className="h-4 w-4 text-[#c98b3a]" strokeWidth={1.6} />
        <p className="flex-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Hiring nearby</p>
        <button onClick={onClose} aria-label="Close hiring search" className="rounded p-0.5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-2 border-b border-border/15 px-3 py-2.5">
        <input
          value={role}
          onChange={(e) => setRole(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run(role)}
          placeholder="Role — e.g. line cook, forklift, barista"
          className="w-full rounded-md border border-border/25 bg-background/60 px-2 py-1.5 text-[11px] font-light text-foreground outline-none focus:border-[#c98b3a]/50"
        />
        <div className="flex flex-wrap gap-1">
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => { setRole(p); run(p); }}
              className="rounded-full border border-border/25 px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground"
            >
              {p}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={radiusMi}
            onChange={(e) => setRadiusMi(Number(e.target.value))}
            aria-label="Search radius in miles"
            className="rounded border border-border/25 bg-background/60 px-1.5 py-1 text-[10px] text-muted-foreground outline-none"
          >
            {[5, 10, 25, 50].map((r) => <option key={r} value={r}>{r} mi</option>)}
          </select>
          <button
            onClick={() => run(role)}
            disabled={busy}
            className="ml-auto flex items-center gap-1.5 rounded-md border border-[#c98b3a]/40 bg-[#c98b3a]/10 px-2.5 py-1 text-[10px] text-[#e0a955] hover:bg-[#c98b3a]/20 disabled:opacity-50"
          >
            {busy ? <><Loader2 className="h-3 w-3 animate-spin motion-reduce:animate-none" />Sweeping boards…</> : "Find hiring"}
          </button>
        </div>
        {locality && <p className="text-[9px] text-muted-foreground/70">Anchored on {locality}</p>}
      </div>

      <div className="flex-1 overflow-y-auto">
        {busy && !jobs.length && (
          <div className="space-y-2 p-3" aria-hidden>
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-md bg-foreground/5 motion-reduce:animate-none" />)}
          </div>
        )}
        {error && <p role="alert" className="px-3 py-3 text-[10px] leading-snug text-amber-400">{error}</p>}

        {jobs.map((j, i) => (
          <div key={`${j.applyUrl || j.employer}-${i}`} className="border-b border-border/10 px-3 py-2 hover:bg-foreground/5">
            <button onClick={() => onFocus(j)} disabled={j.lat === undefined} className="w-full text-left disabled:cursor-default">
              <p className="text-[12px] font-medium leading-snug text-foreground">{j.title}</p>
              <p className="text-[10px] font-light text-muted-foreground">
                {j.employer}
                {j.distanceM !== undefined ? ` · ${fmtDistance(j.distanceM, units)}` : " · location not published"}
              </p>
              {j.address && <p className="mt-0.5 flex items-start gap-1 text-[10px] font-light text-muted-foreground/80"><MapPin className="mt-0.5 h-2.5 w-2.5 shrink-0" />{j.address}</p>}
            </button>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {j.pay && <span className="rounded-full border border-emerald-500/30 px-1.5 py-0.5 text-[9px] text-emerald-400">{j.pay}</span>}
              {j.employmentType && <span className="text-[9px] text-muted-foreground/80">{j.employmentType}</span>}
              {j.posted && <span className="text-[9px] text-muted-foreground/60">{j.posted}</span>}
              {j.applyUrl && (
                <a href={j.applyUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[9px] text-[#c98b3a] hover:text-[#e0a955]">
                  <ExternalLink className="h-2.5 w-2.5" />Apply · {j.source}
                </a>
              )}
              {j.lat !== undefined && (
                <button onClick={() => onRoute(j)} className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-foreground">
                  <Navigation className="h-2.5 w-2.5" />Directions
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="border-t border-border/15 px-3 py-1.5 text-[9px] leading-snug text-muted-foreground/60">
        Live board sweep across the major aggregators and employer career pages. Postings carry their source; unpinned rows had no geocodable address.
      </p>
    </div>
  );
};

export default JobsNearbyPanel;
