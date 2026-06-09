import { useState } from "react";
import { FileText, BookOpen, Layers } from "lucide-react";
import { lazy, Suspense } from "react";

const PdfGeneratorView = lazy(() => import("./PdfGeneratorView"));
const EBookGeneratorView = lazy(() => import("./ebook/EBookGeneratorView"));
const SlideshowGeneratorView = lazy(() => import("./SlideshowGeneratorView"));

type ExportType = "pdf" | "ebook" | "slideshow";

const OPTIONS: { id: ExportType; label: string; codename: string; blurb: string; icon: typeof FileText }[] = [
  { id: "pdf", label: "PDF Report", codename: "PDF Generator", blurb: "Single-document export with hero, sections, and citations.", icon: FileText },
  { id: "ebook", label: "Multi-chapter eBook", codename: "eBook Generator", blurb: "Long-form upload → chaptered eBook with cover and TOC.", icon: BookOpen },
  { id: "slideshow", label: "Slideshow Deck", codename: "Slideshow Generator", blurb: "Auto-paged presentation with cover + per-slide content.", icon: Layers },
];

/**
 * F-02 — Unified Document Export landing.
 * One front door for the three export surfaces (PDF / eBook / Slideshow) so users
 * pick "what to make" before they have to learn each tool's UI.
 */
export default function DocumentExportLanding() {
  const [active, setActive] = useState<ExportType | null>(null);

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border/20 px-6 pt-5 pb-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-base font-extralight tracking-[0.18em] uppercase text-foreground">Create a Document</h1>
            <p className="text-xs font-light text-muted-foreground/70 mt-0.5">PDF · eBook · Slideshow — pick the format, we'll route you in.</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-border/20 bg-card/40 p-1">
            {OPTIONS.map((o) => (
              <button
                key={o.id}
                onClick={() => setActive(o.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-light transition-colors ${
                  active === o.id ? "bg-foreground/10 text-foreground" : "text-muted-foreground/70 hover:text-foreground"
                }`}
              >
                <o.icon className="h-3.5 w-3.5" />
                {o.label.split(" ")[0]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {active === null ? (
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-4xl mx-auto grid sm:grid-cols-3 gap-4">
            {OPTIONS.map((o) => (
              <button
                key={o.id}
                onClick={() => setActive(o.id)}
                className="text-left p-5 rounded-xl border border-border/20 bg-card/40 hover:bg-card/60 hover:border-border/40 transition-all group"
              >
                <o.icon className="h-7 w-7 text-muted-foreground/70 group-hover:text-foreground transition-colors mb-3" />
                <h3 className="text-sm font-light text-foreground">{o.label}</h3>
                <p className="text-[10px] font-light tracking-wider uppercase text-muted-foreground/40 mt-0.5">{o.codename}</p>
                <p className="text-xs font-light text-muted-foreground/70 mt-2 leading-relaxed">{o.blurb}</p>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-hidden">
          <Suspense fallback={<div className="p-6 text-xs text-muted-foreground/60 animate-pulse">Loading…</div>}>
            {active === "pdf" && <PdfGeneratorView />}
            {active === "ebook" && <EBookGeneratorView />}
            {active === "slideshow" && <SlideshowGeneratorView />}
          </Suspense>
        </div>
      )}
    </div>
  );
}
