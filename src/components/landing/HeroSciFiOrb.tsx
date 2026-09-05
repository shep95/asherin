import { useEffect, useMemo, useRef } from "react";

/**
 * HeroConstellation — ambient neural mesh: nodes drift slowly and connect
 * with faint lines when close, occasional amber pulses travel along edges.
 * Monochrome + amber accent, desktop only, canvas-based for smoothness.
 */
export default function HeroConstellation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>();

  const NODE_COUNT = 46;

  const seed = useMemo(
    () =>
      Array.from({ length: NODE_COUNT }, (_, i) => ({
        x: Math.random(),
        y: Math.random(),
        vx: (Math.random() - 0.5) * 0.00025,
        vy: (Math.random() - 0.5) * 0.00025,
        r: Math.random() * 1.2 + 0.6,
        pulse: Math.random() * Math.PI * 2,
        hot: i % 9 === 0,
      })),
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = 0;
    let H = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const nodes = seed.map((n) => ({ ...n }));
    const LINK_DIST = 150;

    let t0 = performance.now();

    const render = (now: number) => {
      const dt = Math.min(now - t0, 48);
      t0 = now;
      ctx.clearRect(0, 0, W, H);

      // Update
      for (const n of nodes) {
        n.x += n.vx * dt;
        n.y += n.vy * dt;
        if (n.x < 0.02 || n.x > 0.98) n.vx *= -1;
        if (n.y < 0.02 || n.y > 0.98) n.vy *= -1;
        n.pulse += dt * 0.0018;
      }

      // Edges
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        const ax = a.x * W;
        const ay = a.y * H;
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const bx = b.x * W;
          const by = b.y * H;
          const dx = ax - bx;
          const dy = ay - by;
          const d = Math.hypot(dx, dy);
          if (d < LINK_DIST) {
            const alpha = (1 - d / LINK_DIST) * 0.35;
            const amber = a.hot || b.hot;
            ctx.strokeStyle = amber
              ? `rgba(163,163,163,${alpha * 0.9})`
              : `rgba(255,255,255,${alpha * 0.55})`;
            ctx.lineWidth = amber ? 0.6 : 0.4;
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
            ctx.stroke();
          }
        }
      }

      // Nodes
      for (const n of nodes) {
        const px = n.x * W;
        const py = n.y * H;
        const p = 0.55 + Math.sin(n.pulse) * 0.35;

        if (n.hot) {
          // amber glow
          const g = ctx.createRadialGradient(px, py, 0, px, py, 14);
          g.addColorStop(0, `rgba(163,163,163,${0.55 * p})`);
          g.addColorStop(1, "rgba(163,163,163,0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(px, py, 14, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = `rgba(200,200,200,${0.85 * p})`;
          ctx.beginPath();
          ctx.arc(px, py, n.r + 0.6, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = `rgba(255,255,255,${0.5 * p})`;
          ctx.beginPath();
          ctx.arc(px, py, n.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      rafRef.current = requestAnimationFrame(render);
    };
    rafRef.current = requestAnimationFrame(render);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [seed]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none hidden lg:block absolute top-1/2 right-0 xl:right-6 -translate-y-1/2 w-[520px] xl:w-[620px] h-[520px] xl:h-[620px] select-none"
    >
      <div
        className="absolute inset-0 opacity-40 blur-3xl"
        style={{
          background:
            "hsl(0 0% 100% / 0.04)",
        }}
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        style={{
          maskImage:
            "radial-gradient(ellipse at center, black 55%, transparent 88%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at center, black 55%, transparent 88%)",
        }}
      />
    </div>
  );
}
