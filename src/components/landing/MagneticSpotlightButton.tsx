import { useRef, useState, MouseEvent, ReactNode } from "react";

interface Props {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: "primary" | "secondary";
  className?: string;
}

/**
 * CTA button with cursor-tracking spotlight + subtle magnetic pull.
 * GPU-only transforms; respects reduced motion via media query.
 */
const MagneticSpotlightButton = ({ children, onClick, href, variant = "primary", className = "" }: Props) => {
  const ref = useRef<HTMLButtonElement | HTMLAnchorElement | null>(null);
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const handleMove = (e: MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    setPos({ x: (x / r.width) * 100, y: (y / r.height) * 100 });
    // magnetic pull (max 8px)
    const dx = ((x - r.width / 2) / r.width) * 16;
    const dy = ((y - r.height / 2) / r.height) * 16;
    setTilt({ x: dx, y: dy });
  };

  const reset = () => setTilt({ x: 0, y: 0 });

  const baseClass =
    variant === "primary"
      ? "bg-foreground text-background border-foreground/20"
      : "bg-card/40 text-foreground border-border/40 backdrop-blur-md";

  const spotlight =
    variant === "primary"
      ? "radial-gradient(140px circle at var(--mx) var(--my), rgba(255,255,255,0.18), transparent 60%)"
      : "radial-gradient(140px circle at var(--mx) var(--my), rgba(255,255,255,0.08), transparent 60%)";

  const style: React.CSSProperties = {
    transform: `translate3d(${tilt.x}px, ${tilt.y}px, 0)`,
    transition: "transform 200ms cubic-bezier(.2,.7,.3,1)",
    ["--mx" as never]: `${pos.x}%`,
    ["--my" as never]: `${pos.y}%`,
    backgroundImage: spotlight,
  };

  const inner = (
    <span className="relative z-10 inline-flex items-center gap-2 motion-safe:transition-transform">
      {children}
    </span>
  );

  const cls = `group relative inline-flex items-center justify-center overflow-hidden rounded-xl border px-7 py-3 text-sm font-light tracking-[0.18em] uppercase select-none ${baseClass} ${className}`;

  if (href) {
    return (
      <a
        href={href}
        ref={ref as React.RefObject<HTMLAnchorElement>}
        onMouseMove={handleMove}
        onMouseLeave={reset}
        style={style}
        className={cls}
      >
        {inner}
      </a>
    );
  }

  return (
    <button
      ref={ref as React.RefObject<HTMLButtonElement>}
      onMouseMove={handleMove}
      onMouseLeave={reset}
      onClick={onClick}
      style={style}
      className={cls}
    >
      {inner}
    </button>
  );
};

export default MagneticSpotlightButton;
