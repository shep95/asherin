import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Droplets, Feather, Shield, Package, Check, X, Loader2 } from "lucide-react";
import hoodieModels from "@/assets/hoodies/hoodie-models.jpg";
import hoodieFolded from "@/assets/hoodies/hoodie-folded.jpg";
import hoodieFemale from "@/assets/hoodies/hoodie-female.jpg";
import hoodieSpace from "@/assets/hoodies/hoodie-space.jpg";
import hoodieDetail from "@/assets/hoodies/hoodie-detail.jpg";

const STORAGE_KEY = "aureon_hoodie_voted";

export default function Hoodies() {
  const [yes, setYes] = useState(0);
  const [no, setNo] = useState(0);
  const [voted, setVoted] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Hoodies — Aureon Limited Drop";
    try { setVoted(localStorage.getItem(STORAGE_KEY)); } catch { /* ignore */ }
    (async () => {
      const { data, error } = await supabase.functions.invoke("hoodie-vote", { method: "GET" });
      if (!error && data) { setYes(Number(data.yes) || 0); setNo(Number(data.no) || 0); }
    })();
  }, []);

  const total = yes + no;
  const yesPct = total ? Math.round((yes / total) * 100) : 0;
  const noPct = total ? 100 - yesPct : 0;
  const leading = yes === no ? "tied" : yes > no ? "yes" : "no";

  const cast = async (vote: "yes" | "no") => {
    if (voted || busy) return;
    setBusy(true); setErr(null);
    try {
      const { data, error } = await supabase.functions.invoke("hoodie-vote", { body: { vote } });
      if (error) throw error;
      if (data?.alreadyVoted) setErr("You've already voted from this network.");
      setYes(Number(data?.yes) || 0);
      setNo(Number(data?.no) || 0);
      try { localStorage.setItem(STORAGE_KEY, vote); } catch { /* ignore */ }
      setVoted(vote);
    } catch (e: any) {
      setErr(e?.message || "Vote failed");
    } finally { setBusy(false); }
  };

  const gallery = [
    { src: hoodieModels, alt: "Aureon waterproof hoodie front and detail views on model" },
    { src: hoodieFemale, alt: "Aureon waterproof hoodie styled on female model" },
    { src: hoodieFolded, alt: "Aureon hoodie folded with embroidered triangle logo" },
    { src: hoodieSpace, alt: "Aureon hoodie floating above earth from orbit" },
  ];

  const features = [
    { icon: Droplets, label: "Water Resistant" },
    { icon: Feather, label: "Lightweight Comfort" },
    { icon: Shield, label: "Adjustable Hood" },
    { icon: Package, label: "Packable Design" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground relative">
      <Header />

      <main className="relative z-10 px-4 sm:px-6 pt-28 sm:pt-32 pb-24 max-w-6xl mx-auto">
        {/* HERO */}
        <section className="text-center mb-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/30 bg-card/40 backdrop-blur-md px-3 py-1 mb-6">
            <span className="text-[9px] font-light tracking-[0.3em] text-muted-foreground/70 uppercase">
              Concept · Limited Drop
            </span>
          </div>
          <h1 className="text-4xl sm:text-6xl font-extralight tracking-wide zophiel-shimmer-text mb-4">
            BALANCE IS POWER. WEAR IT.
          </h1>
          <p className="max-w-2xl mx-auto text-sm sm:text-base font-extralight text-muted-foreground leading-relaxed">
            The Aureon waterproof anorak hoodie — engineered light, built to weather anything,
            stamped with the triangle. This is a concept piece. Your vote decides if it ships.
          </p>
        </section>

        {/* HERO IMAGE */}
        <section className="mb-16 rounded-3xl overflow-hidden border border-border/20 bg-card/20 backdrop-blur-md">
          <img src={hoodieDetail} alt="Aureon hoodie full presentation board" className="w-full h-auto" loading="eager" />
        </section>

        {/* GALLERY */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-16">
          {gallery.map((g) => (
            <div key={g.src} className="rounded-2xl overflow-hidden border border-border/20 bg-card/20 backdrop-blur-md">
              <img src={g.src} alt={g.alt} loading="lazy" className="w-full h-auto object-cover" />
            </div>
          ))}
        </section>

        {/* DESCRIPTION */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-6 sm:p-8">
            <h2 className="text-xs font-light tracking-[0.25em] text-accent/80 uppercase mb-4">The Piece</h2>
            <p className="text-sm font-extralight leading-relaxed text-muted-foreground mb-3">
              A premium half-zip anorak built from water-resistant ripstop. Drawstring hood, kangaroo pouch,
              elastic cuffs and adjustable hem. Embroidered Aureon triangle on the chest, Champion mark on the sleeve.
            </p>
            <p className="text-sm font-extralight leading-relaxed text-muted-foreground">
              Designed to pack down small, throw in a bag, and wear from a downpour straight into a meeting.
              Matte black only. No prints, no noise — just the mark.
            </p>
          </div>
          <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-6 sm:p-8 grid grid-cols-2 gap-4">
            {features.map((f) => (
              <div key={f.label} className="flex items-center gap-3 rounded-xl border border-border/15 bg-background/30 p-3">
                <f.icon className="h-4 w-4 text-accent/80" />
                <span className="text-xs font-light tracking-wide text-foreground/90">{f.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* VOTE */}
        <section className="rounded-3xl border border-border/30 bg-card/30 backdrop-blur-xl p-6 sm:p-10">
          <div className="text-center mb-6">
            <div className="text-[10px] font-light tracking-[0.3em] text-accent/70 uppercase mb-2">Decide The Drop</div>
            <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-2">
              Should we make these?
            </h2>
            <p className="text-xs font-extralight text-muted-foreground">
              One vote per network. {total} {total === 1 ? "vote" : "votes"} so far ·{" "}
              <span className="text-foreground/90">{leading === "tied" ? "Tied" : `${leading.toUpperCase()} leading`}</span>
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <button
              onClick={() => cast("yes")}
              disabled={!!voted || busy}
              className={`group relative overflow-hidden rounded-2xl border p-6 transition-all ${
                voted === "yes"
                  ? "border-emerald-400/50 bg-emerald-500/10"
                  : "border-border/30 bg-background/40 hover:border-emerald-400/40 hover:bg-emerald-500/5"
              } disabled:cursor-not-allowed`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-emerald-400" />
                  <span className="text-sm font-light tracking-wide text-foreground">Yes, make it</span>
                </div>
                <span className="text-2xl font-extralight text-emerald-400">{yesPct}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-background/60 overflow-hidden">
                <div className="h-full bg-emerald-400/70 transition-all duration-700" style={{ width: `${yesPct}%` }} />
              </div>
              <div className="mt-2 text-[10px] font-mono tracking-wider text-muted-foreground">{yes} votes</div>
            </button>

            <button
              onClick={() => cast("no")}
              disabled={!!voted || busy}
              className={`group relative overflow-hidden rounded-2xl border p-6 transition-all ${
                voted === "no"
                  ? "border-red-400/50 bg-red-500/10"
                  : "border-border/30 bg-background/40 hover:border-red-400/40 hover:bg-red-500/5"
              } disabled:cursor-not-allowed`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <X className="h-5 w-5 text-red-400" />
                  <span className="text-sm font-light tracking-wide text-foreground">No, skip it</span>
                </div>
                <span className="text-2xl font-extralight text-red-400">{noPct}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-background/60 overflow-hidden">
                <div className="h-full bg-red-400/70 transition-all duration-700" style={{ width: `${noPct}%` }} />
              </div>
              <div className="mt-2 text-[10px] font-mono tracking-wider text-muted-foreground">{no} votes</div>
            </button>
          </div>

          <div className="text-center text-xs font-extralight text-muted-foreground min-h-[1.25rem]">
            {busy && <span className="inline-flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Submitting…</span>}
            {!busy && voted && <span className="text-foreground/80">Vote recorded. Thank you.</span>}
            {!busy && err && <span className="text-red-400">{err}</span>}
          </div>
        </section>
      </main>
    </div>
  );
}
