import { useRef, useState, MouseEvent, ReactNode } from "react";

interface Props {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "md" | "lg" | "xl";
  className?: string;
  ariaLabel?: string;
}

/**
 * CTA button with cursor-tracking spotlight + subtle magnetic pull.
 * GPU-only transforms; respects reduced motion via media query.
 *
 * UX-law sizing (Fitts's Law): use size="xl" for the page's PRIMARY action so
 * the click target is large and easy to acquire, especially on mobile thumb-zone.
 */
const MagneticSpotlightButton = ({
  children,
  onClick,
  href,
  variant = "primary",
  size = "md",
  className = "",
  ariaLabel,
}: Props) => {
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
    const dx = ((x - r.width / 2) / r.width) * 16;
    const dy = ((y - r.height / 2) / r.height) * 16;
    setTilt({ x: dx, y: dy });
  };

  const reset = () => setTilt({ x: 0, y: 0 });

  const baseClass =
    variant === "primary"
      ? "bg-foreground text-background border-foreground/20 shadow-[0_8px_30px_-8px_rgba(255,255,255,0.25)] hover:shadow-[0_12px_40px_-8px_rgba(255,255,255,0.35)]"
      : variant === "ghost"
      ? "bg-transparent text-foreground/80 border-transparent hover:text-foreground"
      : "bg-card/40 text-foreground border-border/40 backdrop-blur-md";

  const sizeClass =
    size === "xl"
      ? "px-9 py-5 text-base min-h-[60px] min-w-[220px]"
      : size === "lg"
      ? "px-8 py-4 text-sm min-h-[52px]"
      : "px-7 py-3 text-sm min-h-[44px]";

  const style: React.CSSProperties = {
    transform: `translate3d(${tilt.x}px, ${tilt.y}px, 0)`,
    transition: "transform 200ms cubic-bezier(.2,.7,.3,1), box-shadow 250ms",
    ["--mx" as never]: `${pos.x}%`,
    ["--my" as never]: `${pos.y}%`,
  };

  const inner = (
    <span className="relative z-10 inline-flex items-center gap-2 motion-safe:transition-transform">
      {children}
    </span>
  );

  const cls = `group relative inline-flex items-center justify-center overflow-hidden rounded-xl border font-light tracking-[0.18em] uppercase select-none ${baseClass} ${sizeClass} ${className}`;

  if (href) {
    return (
      <a
        href={href}
        aria-label={ariaLabel}
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
      aria-label={ariaLabel}
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

