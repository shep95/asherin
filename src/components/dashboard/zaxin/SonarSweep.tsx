// Sonar Sweep — Splinter Cell / Ghost Recon inspired radial pulse overlay.
// Emits a ring pulse every 2.5 s that grows from centre to edge; contact
// bearings are drawn as spokes that brighten when the pulse crosses them.
// Pure canvas — no per-frame React re-render.

import { memo, useEffect, useRef } from "react";
import type { Contact } from "./core/types";

interface Props {
  contacts: Contact[];
  heading: number | null;
  fov: number;
  arOn: boolean;
  active: boolean;
}

const PULSE_PERIOD_MS = 2500;

const SonarSweep = memo(function SonarSweep({ contacts, heading, fov, arOn, active }: Props) {
  const cvsRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef(0);
  const contactsRef = useRef<Contact[]>(contacts);
  const headingRef = useRef<number | null>(heading);
  contactsRef.current = contacts;
  headingRef.current = heading;

  useEffect(() => {
    if (!arOn || !active) return;
    const cvs = cvsRef.current;
    const wrap = wrapRef.current;
    if (!cvs || !wrap) return;
    const ctx = cvs.getContext("2d")!;
    const start = performance.now();

    const draw = () => {
      const rect = wrap.getBoundingClientRect();
      const W = Math.max(1, Math.floor(rect.width));
      const H = Math.max(1, Math.floor(rect.height));
      if (cvs.width !== W) cvs.width = W;
      if (cvs.height !== H) cvs.height = H;
      ctx.clearRect(0, 0, W, H);

      const now = performance.now();
      const phase = ((now - start) % PULSE_PERIOD_MS) / PULSE_PERIOD_MS; // 0..1
      const cx = W / 2, cy = H / 2;
      const maxR = Math.hypot(cx, cy);
      const pulseR = phase * maxR;

      // Pulse ring
      ctx.save();
      ctx.strokeStyle = `rgba(232,198,132,${(1 - phase) * 0.55})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, pulseR, 0, Math.PI * 2);
      ctx.stroke();

      // Faint reference rings at 25/50/75%
      ctx.strokeStyle = "rgba(232,198,132,0.10)";
      ctx.lineWidth = 0.75;
      for (const f of [0.25, 0.5, 0.75]) {
        ctx.beginPath(); ctx.arc(cx, cy, maxR * f, 0, Math.PI * 2); ctx.stroke();
      }

      // Contact spokes — only meaningful if we have a heading
      const h = headingRef.current;
      if (h != null) {
        for (const c of contactsRef.current) {
          if (c.bearing == null) continue;
          let delta = c.bearing - h;
          while (delta > 180) delta -= 360;
          while (delta < -180) delta += 360;
          if (Math.abs(delta) > fov / 2) continue;
          // Estimate distance ratio (0=near, 1=far) — bounded RSSI mapping.
          const rssi = c.rssi ?? -85;
          const distNorm = Math.max(0.05, Math.min(0.95, (Math.abs(rssi) - 40) / 60));
          const r = distNorm * maxR * 0.85;
          const angle = (delta / (fov / 2)) * (Math.PI / 3); // spread over ~120° visual
          const px = cx + r * Math.sin(angle);
          const py = cy - r * Math.cos(angle);
          // Spoke
          ctx.strokeStyle = "rgba(232,198,132,0.28)";
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke();
          // Blob — brightens when pulse crosses its radius
          const proximity = 1 - Math.min(1, Math.abs(pulseR - r) / (maxR * 0.08));
          const alpha = 0.35 + proximity * 0.6;
          ctx.fillStyle = `rgba(232,198,132,${alpha})`;
          ctx.beginPath(); ctx.arc(px, py, 3 + proximity * 3, 0, Math.PI * 2); ctx.fill();
          if (proximity > 0.7) {
            ctx.strokeStyle = `rgba(255,240,200,${proximity})`;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(px, py, 6 + proximity * 4, 0, Math.PI * 2); ctx.stroke();
          }
        }
      }
      ctx.restore();
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [arOn, active, fov]);

  if (!arOn || !active) return null;
  return (
    <div ref={wrapRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 3 }}>
      <canvas ref={cvsRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
});

export default SonarSweep;
