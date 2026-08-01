// MapFocusPin — the golden "target acquired" pin the AI (or the search bar)
// drops when it resolves an address / building / place, plus the modern
// rectangle detail card that floats above it.
//
// Design notes:
//  · Rendered as a plain HTML child of <MapContainer>, positioned by projecting
//    the target LatLng to a container point. Position is written straight to
//    `style.transform` inside the Leaflet move listener — no React re-render per
//    frame, so panning stays at 60fps.
//  · The card flips below the pin when the pin sits near the top edge, and
//    clamps horizontally so it can never render off-canvas.
//  · Wrapper is pointer-events:none; only the card itself is interactive, so the
//    pin never swallows map clicks.

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import { X, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";

export interface FocusPinRow {
  label: string;
  value: string;
}

export interface FocusPinTarget {
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
  badge?: string;
}

interface Props {
  target: FocusPinTarget;
  rows: FocusPinRow[];
  loading?: boolean;
  onClose: () => void;
}

const CARD_W = 280;

const MapFocusPin = ({ target, rows, loading, onClose }: Props) => {
  const map = useMap();
  const wrapRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const place = () => {
      const el = wrapRef.current;
      const card = cardRef.current;
      if (!el) return;
      const p = map.latLngToContainerPoint([target.lat, target.lng]);
      el.style.transform = `translate3d(${Math.round(p.x)}px, ${Math.round(p.y)}px, 0)`;
      if (card) {
        const size = map.getSize();
        const cardH = card.offsetHeight || 160;
        // Flip below the pin when there is not enough headroom above it.
        const below = p.y - cardH - 46 < 8;
        card.style.bottom = below ? "auto" : "42px";
        card.style.top = below ? "18px" : "auto";
        // Horizontal clamp: keep the whole card inside the viewport.
        const half = CARD_W / 2;
        const minX = -p.x + 10;
        const maxX = size.x - p.x - CARD_W - 10;
        const offset = Math.max(minX, Math.min(-half, maxX));
        card.style.left = `${Math.round(offset)}px`;
      }
    };

    place();
    map.on("move zoom zoomanim viewreset resize", place);
    return () => {
      map.off("move zoom zoomanim viewreset resize", place);
    };
  }, [map, target.lat, target.lng, rows.length, loading]);

  const copyCoords = () => {
    const txt = `${target.lat.toFixed(6)}, ${target.lng.toFixed(6)}`;
    navigator.clipboard?.writeText(txt).then(
      () => toast.success("Coordinates copied"),
      () => toast.error("Clipboard unavailable"),
    );
  };

  return (
    <div
      ref={wrapRef}
      className="absolute left-0 top-0 z-[900]"
      style={{ pointerEvents: "none", willChange: "transform" }}
      aria-hidden={false}
    >
      {/* Pulse halo */}
      <span
        className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full motion-reduce:animate-none animate-ping"
        style={{
          width: 34,
          height: 34,
          background: "radial-gradient(circle, rgba(251,191,36,0.45) 0%, rgba(251,191,36,0) 70%)",
        }}
      />
      {/* Golden pin */}
      <svg
        width="28"
        height="38"
        viewBox="0 0 28 38"
        className="absolute"
        style={{ transform: "translate(-14px, -38px)", filter: "drop-shadow(0 4px 10px rgba(0,0,0,.65))" }}
        role="img"
        aria-label={`Target pin: ${target.title}`}
      >
        <defs>
          <linearGradient id="asher-gold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="45%" stopColor="#f5c542" />
            <stop offset="100%" stopColor="#b8860b" />
          </linearGradient>
        </defs>
        <path
          d="M14 1c-6.9 0-12.5 5.5-12.5 12.3C1.5 22.4 14 37 14 37s12.5-14.6 12.5-23.7C26.5 6.5 20.9 1 14 1z"
          fill="url(#asher-gold)"
          stroke="rgba(9,9,11,.85)"
          strokeWidth="1.5"
        />
        <circle cx="14" cy="13" r="4.6" fill="rgba(9,9,11,.88)" />
      </svg>

      {/* Detail card */}
      <div
        ref={cardRef}
        className="absolute w-[280px] overflow-hidden rounded-xl border border-[#f5c542]/35 bg-card/95 backdrop-blur-md shadow-[0_18px_50px_-12px_rgba(0,0,0,.85)]"
        style={{ pointerEvents: "auto", bottom: 42, left: -CARD_W / 2 }}
        role="dialog"
        aria-label={`Details for ${target.title}`}
      >
        <div className="flex items-start gap-2 border-b border-[#f5c542]/20 bg-[#f5c542]/[0.07] px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-medium leading-tight text-foreground">{target.title}</p>
            {target.subtitle && (
              <p className="mt-0.5 line-clamp-2 text-[10px] font-light leading-snug text-muted-foreground">
                {target.subtitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Dismiss target card"
            className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#f5c542]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {target.badge && (
          <div className="px-3 pt-2">
            <span className="inline-block rounded-full border border-[#f5c542]/35 px-2 py-[1px] text-[9px] uppercase tracking-[0.18em] text-[#f5c542]">
              {target.badge}
            </span>
          </div>
        )}

        <div className="space-y-1 px-3 py-2" aria-live="polite">
          {rows.length === 0 && loading && (
            <div className="flex items-center gap-1.5 py-1 text-[10px] font-light text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin motion-reduce:animate-none" />
              Resolving site detail…
            </div>
          )}
          {rows.length === 0 && !loading && (
            <p className="py-1 text-[10px] font-light text-muted-foreground">
              No structured detail available for this point.
            </p>
          )}
          {rows.map((r) => (
            <div key={r.label} className="flex items-baseline gap-2">
              <span className="w-[70px] shrink-0 text-[9px] uppercase tracking-[0.14em] text-muted-foreground/60">
                {r.label}
              </span>
              <span className="min-w-0 flex-1 break-words text-[11px] font-light text-foreground/90">{r.value}</span>
            </div>
          ))}
          {rows.length > 0 && loading && (
            <div className="flex items-center gap-1.5 pt-0.5 text-[9px] font-light text-muted-foreground/70">
              <Loader2 className="h-2.5 w-2.5 animate-spin motion-reduce:animate-none" />
              streaming further detail…
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border/40 px-3 py-1.5">
          <span className="font-mono text-[9px] text-muted-foreground/70">
            {target.lat.toFixed(6)}, {target.lng.toFixed(6)}
          </span>
          <button
            onClick={copyCoords}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#f5c542]"
          >
            <Copy className="h-2.5 w-2.5" /> Copy
          </button>
        </div>
      </div>
    </div>
  );
};

export default MapFocusPin;
