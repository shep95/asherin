import { useEffect, useState } from "react";

/**
 * HeroSciFiOrb — decorative sci-fi HUD for the empty hero space (desktop only).
 * Monochrome + amber accent to match landing theme. No external assets, pure SVG/CSS.
 */
export default function HeroSciFiOrb() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) % 1000), 1200);
    return () => clearInterval(id);
  }, []);

  const lat = (34.7 + Math.sin(tick / 7) * 0.4).toFixed(4);
  const lon = (-118.2 + Math.cos(tick / 9) * 0.4).toFixed(4);
  const signal = 62 + ((tick * 7) % 33);
  const nodes = 28 + ((tick * 3) % 9);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none hidden lg:block absolute top-1/2 right-2 xl:right-10 -translate-y-1/2 w-[420px] xl:w-[520px] h-[420px] xl:h-[520px] select-none"
    >
      {/* Ambient amber glow */}
      <div
        className="absolute inset-0 rounded-full opacity-30 blur-3xl"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(251,191,36,0.22), rgba(0,0,0,0) 60%)",
        }}
      />

      {/* Corner brackets */}
      {[
        "top-0 left-0 border-t border-l",
        "top-0 right-0 border-t border-r",
        "bottom-0 left-0 border-b border-l",
        "bottom-0 right-0 border-b border-r",
      ].map((c, i) => (
        <span
          key={i}
          className={`absolute h-6 w-6 ${c} border-foreground/25`}
        />
      ))}

      {/* Meta readouts */}
      <div className="absolute top-2 left-8 font-mono text-[9px] tracking-[0.35em] uppercase text-muted-foreground/60">
        TGT · <span className="text-amber-400/80">LOCKED</span>
      </div>
      <div className="absolute top-2 right-8 font-mono text-[9px] tracking-[0.35em] uppercase text-muted-foreground/60">
        FRAME · {String(tick % 999).padStart(3, "0")}
      </div>
      <div className="absolute bottom-2 left-8 font-mono text-[9px] tracking-[0.3em] uppercase text-muted-foreground/60">
        {lat}° N · {lon}° W
      </div>
      <div className="absolute bottom-2 right-8 font-mono text-[9px] tracking-[0.3em] uppercase text-muted-foreground/60">
        SIG {signal}% · NODES {nodes}
      </div>

      {/* Reticle SVG */}
      <svg
        viewBox="0 0 520 520"
        className="absolute inset-0 h-full w-full"
        fill="none"
      >
        <defs>
          <radialGradient id="orbCore" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(251,191,36,0.18)" />
            <stop offset="55%" stopColor="rgba(255,255,255,0.03)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
          <linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(251,191,36,0)" />
            <stop offset="100%" stopColor="rgba(251,191,36,0.55)" />
          </linearGradient>
        </defs>

        {/* Core disc */}
        <circle cx="260" cy="260" r="180" fill="url(#orbCore)" />

        {/* Static concentric rings */}
        {[210, 168, 128, 92, 58].map((r, i) => (
          <circle
            key={r}
            cx="260"
            cy="260"
            r={r}
            stroke="rgba(255,255,255,0.09)"
            strokeWidth={i === 0 ? 0.8 : 0.5}
            strokeDasharray={i === 1 ? "2 6" : undefined}
          />
        ))}

        {/* Dashed outer ring — counter-rotating */}
        <g style={{ transformOrigin: "260px 260px", animation: "sciSpinSlow 60s linear infinite" }}>
          <circle
            cx="260"
            cy="260"
            r="240"
            stroke="rgba(255,255,255,0.14)"
            strokeWidth="0.6"
            strokeDasharray="1 5"
          />
          {/* Ticks */}
          {Array.from({ length: 60 }).map((_, i) => {
            const a = (i * Math.PI * 2) / 60;
            const x1 = 260 + Math.cos(a) * 232;
            const y1 = 260 + Math.sin(a) * 232;
            const x2 = 260 + Math.cos(a) * (i % 5 === 0 ? 220 : 226);
            const y2 = 260 + Math.sin(a) * (i % 5 === 0 ? 220 : 226);
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="rgba(255,255,255,0.22)"
                strokeWidth={i % 5 === 0 ? 1 : 0.5}
              />
            );
          })}
        </g>

        {/* Sweep radar arc */}
        <g style={{ transformOrigin: "260px 260px", animation: "sciSpin 6s linear infinite" }}>
          <path
            d="M260 260 L260 50 A210 210 0 0 1 448 200 Z"
            fill="url(#sweep)"
            opacity="0.55"
          />
          <line
            x1="260"
            y1="260"
            x2="260"
            y2="50"
            stroke="rgba(251,191,36,0.75)"
            strokeWidth="1"
          />
        </g>

        {/* Crosshair */}
        <line x1="260" y1="20" x2="260" y2="80" stroke="rgba(255,255,255,0.35)" strokeWidth="0.7" />
        <line x1="260" y1="440" x2="260" y2="500" stroke="rgba(255,255,255,0.35)" strokeWidth="0.7" />
        <line x1="20" y1="260" x2="80" y2="260" stroke="rgba(255,255,255,0.35)" strokeWidth="0.7" />
        <line x1="440" y1="260" x2="500" y2="260" stroke="rgba(255,255,255,0.35)" strokeWidth="0.7" />

        {/* Contact pings */}
        {[
          { x: 340, y: 190, r: 3 },
          { x: 190, y: 300, r: 2.4 },
          { x: 320, y: 340, r: 2.6 },
          { x: 220, y: 210, r: 2 },
        ].map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={p.r} fill="rgba(251,191,36,0.9)" />
            <circle
              cx={p.x}
              cy={p.y}
              r={p.r}
              fill="none"
              stroke="rgba(251,191,36,0.5)"
              strokeWidth="0.6"
              style={{ animation: `sciPing 2.6s ${i * 0.4}s ease-out infinite`, transformOrigin: `${p.x}px ${p.y}px` }}
            />
          </g>
        ))}

        {/* Center marker */}
        <circle cx="260" cy="260" r="4" fill="rgba(251,191,36,0.95)" />
        <circle cx="260" cy="260" r="10" fill="none" stroke="rgba(251,191,36,0.5)" strokeWidth="0.7" />
      </svg>

      <style>{`
        @keyframes sciSpin { to { transform: rotate(360deg); } }
        @keyframes sciSpinSlow { to { transform: rotate(-360deg); } }
        @keyframes sciPing {
          0% { transform: scale(1); opacity: 0.9; }
          100% { transform: scale(6); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
