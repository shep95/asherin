import { Link, useLocation } from "react-router-dom";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Header from "@/components/Header";
import SiteFooter from "@/components/SiteFooter";
import LandingBackground from "@/components/LandingBackground";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { streamChat } from "@/lib/ai";
import { isInternalProEmail } from "@/lib/adminEmail";
import { applySeoHead } from "@/lib/seoHead";
const wallpaperAureon = "/wallpapers/wallpaper-aureon.webp";

/**
 * ASHERIN 404 — "Lost in Orbit"
 * A monochrome, Aureon-themed not-found page with an offline
 * Chrome-dino-style mini game: a futuristic dino in a space suit
 * jumping rogue asteroids and broken satellites, with Saturn looming
 * in the background. Funny flavor text included.
 */

type Obstacle = { x: number; w: number; h: number; kind: "asteroid" | "satellite" | "alien" };

const GROUND_Y = 170;
const GRAVITY = 0.6;
const JUMP_V = -11.5;

const QUIPS = [
  "houston, we lost the page.",
  "this URL drifted past saturn.",
  "the page got sucked into a black hole.",
  "even asherin can't find this one.",
  "404: page achieved escape velocity.",
];

const NotFound = () => {
  const location = useLocation();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    return Number(localStorage.getItem("aureon_404_best") || 0);
  });
  const [running, setRunning] = useState(false);
  const [dead, setDead] = useState(false);
  const [quip] = useState(() => QUIPS[Math.floor(Math.random() * QUIPS.length)]);

  const stateRef = useRef({
    dinoY: GROUND_Y,
    vy: 0,
    obstacles: [] as Obstacle[],
    speed: 6,
    frame: 0,
    score: 0,
    running: false,
    dead: false,
    saturnRot: 0,
    stars: [] as { x: number; y: number; r: number; tw: number }[],
    soul: null as null | {
      x: number;
      y: number;
      vy: number;
      vx: number;
      life: number;
      particles: { x: number; y: number; vx: number; vy: number; r: number; life: number }[];
    },
  });

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
    applySeoHead({
      title: "not found | asherin",
      description:
        "This isn't a page on asherin. Click to return — or play the offline space-dino game while you're here.",
      path: location.pathname,
    });
    // Dork-hardening: every 404 must be de-indexable so recon probes for
    // /wp-admin, /.env, /phpmyadmin etc. never leave a cache footprint.
    let robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const prev = robots?.getAttribute("content") ?? null;
    if (!robots) {
      robots = document.createElement("meta");
      robots.setAttribute("name", "robots");
      document.head.appendChild(robots);
    }
    robots.setAttribute("content", "noindex, nofollow, noarchive, nosnippet, noimageindex");
    return () => {
      if (prev === null) robots?.remove();
      else robots?.setAttribute("content", prev);
    };
  }, [location.pathname]);

  const reset = useCallback(() => {
    const s = stateRef.current;
    s.dinoY = GROUND_Y;
    s.vy = 0;
    s.obstacles = [];
    s.speed = 6;
    s.frame = 0;
    s.score = 0;
    s.dead = false;
    s.running = true;
    s.soul = null;

    setScore(0);
    setDead(false);
    setRunning(true);
  }, []);

  const jump = useCallback(() => {
    const s = stateRef.current;
    if (!s.running) {
      reset();
      return;
    }
    if (s.dinoY >= GROUND_Y) {
      s.vy = JUMP_V;
    }
  }, [reset]);

  // Init stars once
  useEffect(() => {
    const s = stateRef.current;
    s.stars = Array.from({ length: 80 }, () => ({
      x: Math.random() * 800,
      y: Math.random() * 160,
      r: Math.random() * 1.4 + 0.2,
      tw: Math.random() * Math.PI * 2,
    }));
  }, []);

  // Input
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        jump();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [jump]);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const W = canvas.width;
    const H = canvas.height;

    const drawSaturn = (rot: number) => {
      ctx.save();
      ctx.translate(W - 130, 90);
      ctx.rotate(-0.35);
      // planet
      const grad = ctx.createRadialGradient(-20, -20, 10, 0, 0, 70);
      grad.addColorStop(0, "#3a3a3a");
      grad.addColorStop(1, "#0a0a0a");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, 60, 0, Math.PI * 2);
      ctx.fill();
      // rings
      ctx.strokeStyle = "rgba(220,220,220,0.55)";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.ellipse(0, 0, 95, 18, rot * 0.001, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(160,160,160,0.35)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, 110, 22, rot * 0.001, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    };

    const drawStars = (frame: number) => {
      const s = stateRef.current;
      for (const st of s.stars) {
        const a = 0.4 + Math.sin(frame * 0.03 + st.tw) * 0.4;
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const drawGround = () => {
      ctx.strokeStyle = "#888";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, GROUND_Y + 28);
      ctx.lineTo(W, GROUND_Y + 28);
      ctx.stroke();
      // craters / dashes
      ctx.fillStyle = "#555";
      const offset = (stateRef.current.frame * stateRef.current.speed) % 40;
      for (let x = -offset; x < W; x += 40) {
        ctx.fillRect(x, GROUND_Y + 32, 14, 2);
      }
    };

    const drawDino = (y: number, frame: number) => {
      ctx.save();
      ctx.translate(70, y);
      // shadow
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.beginPath();
      ctx.ellipse(14, 30, 20, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      // body (space suit) — white/grey blocky dino
      ctx.fillStyle = "#e8e8e8";
      ctx.fillRect(0, 0, 28, 26); // body
      ctx.fillRect(20, -14, 22, 20); // head
      ctx.fillRect(38, -10, 6, 6); // snout

      // helmet visor
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(26, -10, 12, 8);
      ctx.fillStyle = "rgba(180,220,255,0.6)";
      ctx.fillRect(27, -9, 4, 3);

      // antenna
      ctx.strokeStyle = "#bbb";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(32, -14);
      ctx.lineTo(34, -22);
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(34, -23, 1.8, 0, Math.PI * 2);
      ctx.fill();

      // backpack jets
      ctx.fillStyle = "#9a9a9a";
      ctx.fillRect(-6, 2, 8, 16);
      ctx.fillStyle = "#ff7a3d";
      const flame = frame % 6 < 3 ? 6 : 4;
      ctx.fillRect(-10, 8, 4, flame);

      // legs — animate when on ground
      ctx.fillStyle = "#e8e8e8";
      const onGround = y >= GROUND_Y;
      const step = onGround && frame % 12 < 6 ? 0 : 4;
      ctx.fillRect(4, 26, 6, 8 - step);
      ctx.fillRect(16, 26, 6, 4 + step);

      // tail
      ctx.fillRect(-4, 6, 6, 10);

      ctx.restore();
    };

    const drawObstacle = (o: Obstacle) => {
      ctx.save();
      ctx.translate(o.x, GROUND_Y + 28 - o.h);
      if (o.kind === "asteroid") {
        ctx.fillStyle = "#6b6b6b";
        ctx.beginPath();
        ctx.arc(o.w / 2, o.h / 2, o.w / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#3a3a3a";
        ctx.beginPath();
        ctx.arc(o.w / 2 - 4, o.h / 2 - 3, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(o.w / 2 + 3, o.h / 2 + 4, 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (o.kind === "satellite") {
        ctx.fillStyle = "#c8c8c8";
        ctx.fillRect(o.w / 2 - 6, 4, 12, o.h - 8);
        ctx.fillStyle = "#7aa7d9";
        ctx.fillRect(0, o.h / 2 - 4, o.w / 2 - 6, 8);
        ctx.fillRect(o.w / 2 + 6, o.h / 2 - 4, o.w / 2 - 6, 8);
        ctx.fillStyle = "#fff";
        ctx.fillRect(o.w / 2 - 2, 0, 4, 6);
      } else {
        // alien UFO — flies a bit higher
        ctx.fillStyle = "#9a9a9a";
        ctx.beginPath();
        ctx.ellipse(o.w / 2, o.h / 2, o.w / 2, o.h / 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(180,220,255,0.7)";
        ctx.beginPath();
        ctx.arc(o.w / 2, o.h / 2 - 4, o.w / 4, Math.PI, 0);
        ctx.fill();
      }
      ctx.restore();
    };

    const spawn = () => {
      const s = stateRef.current;
      const r = Math.random();
      if (r < 0.55) {
        s.obstacles.push({ x: W + 20, w: 26, h: 26, kind: "asteroid" });
      } else if (r < 0.85) {
        s.obstacles.push({ x: W + 20, w: 34, h: 36, kind: "satellite" });
      } else {
        s.obstacles.push({ x: W + 20, w: 40, h: 22, kind: "alien" });
      }
    };

    const tick = () => {
      const s = stateRef.current;
      ctx.clearRect(0, 0, W, H);

      // background
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#050507");
      bg.addColorStop(1, "#101014");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      drawStars(s.frame);
      s.saturnRot += 1;
      drawSaturn(s.saturnRot);
      drawGround();

      if (s.running && !s.dead) {
        s.frame++;
        s.score = Math.floor(s.frame / 6);
        s.speed = 6 + Math.min(8, s.frame / 600);

        // physics
        s.vy += GRAVITY;
        s.dinoY = Math.min(GROUND_Y, s.dinoY + s.vy);
        if (s.dinoY === GROUND_Y) s.vy = 0;

        // spawn
        const last = s.obstacles[s.obstacles.length - 1];
        const gap = 220 + Math.random() * 220;
        if (!last || W - last.x > gap) spawn();

        // move + cull
        for (const o of s.obstacles) o.x -= s.speed;
        s.obstacles = s.obstacles.filter((o) => o.x + o.w > -10);

        // collision (AABB on a tight dino box)
        const dinoBox = { x: 64, y: s.dinoY - 16, w: 40, h: 46 };
        for (const o of s.obstacles) {
          const oy = GROUND_Y + 28 - o.h;
          if (
            dinoBox.x < o.x + o.w - 4 &&
            dinoBox.x + dinoBox.w > o.x + 4 &&
            dinoBox.y < oy + o.h - 4 &&
            dinoBox.y + dinoBox.h > oy + 4
          ) {
            s.dead = true;
            s.running = false;
            // Spawn ascending soul from dino position
            s.soul = {
              x: 84,
              y: s.dinoY - 4,
              vy: -0.6,
              vx: 0,
              life: 0,
              particles: Array.from({ length: 14 }, () => ({
                x: 84 + (Math.random() - 0.5) * 16,
                y: s.dinoY + (Math.random() - 0.5) * 16,
                vx: (Math.random() - 0.5) * 0.6,
                vy: -Math.random() * 1.2 - 0.3,
                r: Math.random() * 1.6 + 0.4,
                life: 0,
              })),
            };
            setDead(true);
            setRunning(false);
            setScore(s.score);
            setBest((b) => {
              const nb = Math.max(b, s.score);
              localStorage.setItem("aureon_404_best", String(nb));
              return nb;
            });
            break;
          }
        }
      }

      for (const o of stateRef.current.obstacles) drawObstacle(o);
      // Hide dino once soul has risen far enough
      const soul = stateRef.current.soul;
      if (!soul || soul.life < 30) {
        drawDino(stateRef.current.dinoY, stateRef.current.frame);
      }

      // Animate & draw ascending soul
      if (soul) {
        soul.life++;
        soul.y += soul.vy;
        soul.vy -= 0.008; // gentle acceleration upward
        soul.x += Math.sin(soul.life * 0.08) * 0.4;

        // particle trail
        for (const p of soul.particles) {
          p.life++;
          p.x += p.vx;
          p.y += p.vy;
          p.vy -= 0.01;
          const a = Math.max(0, 1 - p.life / 120);
          ctx.fillStyle = `rgba(200,230,255,${a * 0.8})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }

        // ghost body — translucent dino silhouette rising
        const alpha = Math.max(0, 1 - soul.life / 220);
        ctx.save();
        ctx.globalAlpha = alpha * 0.85;
        // glow halo
        const halo = ctx.createRadialGradient(soul.x, soul.y, 2, soul.x, soul.y, 28);
        halo.addColorStop(0, "rgba(220,240,255,0.9)");
        halo.addColorStop(1, "rgba(220,240,255,0)");
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(soul.x, soul.y, 28, 0, Math.PI * 2);
        ctx.fill();
        // little ghost
        ctx.fillStyle = "rgba(240,250,255,0.95)";
        ctx.beginPath();
        ctx.arc(soul.x, soul.y - 4, 9, Math.PI, 0);
        ctx.lineTo(soul.x + 9, soul.y + 8);
        const wob = Math.sin(soul.life * 0.4) * 2;
        ctx.lineTo(soul.x + 5, soul.y + 6 + wob);
        ctx.lineTo(soul.x, soul.y + 8 - wob);
        ctx.lineTo(soul.x - 5, soul.y + 6 + wob);
        ctx.lineTo(soul.x - 9, soul.y + 8);
        ctx.closePath();
        ctx.fill();
        // eyes
        ctx.fillStyle = "rgba(20,30,50,0.8)";
        ctx.fillRect(soul.x - 4, soul.y - 4, 2, 3);
        ctx.fillRect(soul.x + 2, soul.y - 4, 2, 3);
        ctx.restore();
      }

      // HUD
      ctx.fillStyle = "#e8e8e8";
      ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textAlign = "right";
      ctx.fillText(
        `SCORE ${String(stateRef.current.score).padStart(5, "0")}   BEST ${String(best).padStart(5, "0")}`,
        W - 16,
        24,
      );
      ctx.textAlign = "left";

      if (!stateRef.current.running) {
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#fff";
        ctx.font = "600 18px ui-sans-serif, system-ui";
        ctx.textAlign = "center";
        ctx.fillText(
          stateRef.current.dead ? "MISSION FAILED — your dino bonked an asteroid." : "OFFLINE SPACE-DINO",
          W / 2,
          H / 2 - 8,
        );
        ctx.font = "12px ui-monospace, monospace";
        ctx.fillText("press SPACE / ↑ / tap to launch", W / 2, H / 2 + 14);
        ctx.textAlign = "left";
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [best]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050507] text-zinc-200">
      {/* Asherin wallpaper */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${wallpaperAureon})`, zIndex: 0 }}
      />
      <div aria-hidden className="pointer-events-none fixed inset-0 bg-black/70" style={{ zIndex: 1 }} />
      {/* ambient grid + glow */}

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.7) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full"
        style={{ background: "radial-gradient(closest-side, rgba(255,255,255,0.08), transparent)" }}
      />

      <main className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 py-16">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs uppercase tracking-[0.2em] text-zinc-400 backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" />
          asherin · signal lost
        </div>

        <p className="text-center font-semibold tracking-tight" aria-hidden="true">
          <span className="block text-[88px] leading-none text-white sm:text-[128px]">404</span>
        </p>
        <h1 className="mt-3 text-center text-lg font-semibold tracking-tight text-zinc-300 sm:text-xl">
          not found | asherin
        </h1>
        <p className="mt-2 max-w-md text-center text-sm text-zinc-500">this isn't a page on asherin.</p>

        <p className="mt-3 max-w-md text-center text-sm text-zinc-500">
          {quip} meanwhile, our intern (a dino in a space suit) is dodging asteroids near saturn. give him a hand.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href="/"
            className="group inline-flex items-center gap-2 rounded-md border border-white/15 bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-zinc-200"
          >
            click here to go back to asherin
            <span className="transition group-hover:translate-x-0.5">→</span>
          </a>
          <button
            onClick={jump}
            className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/[0.03] px-5 py-2.5 text-sm text-zinc-200 transition hover:bg-white/[0.07]"
          >
            {running ? "jump" : dead ? "respawn dino" : "launch dino"}
          </button>
        </div>

        {/* Game */}
        <div
          className="mt-10 w-full max-w-3xl overflow-hidden rounded-xl border border-white/10 bg-black/40 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)] backdrop-blur"
          onClick={jump}
          onTouchStart={(e) => {
            e.preventDefault();
            jump();
          }}
          role="button"
          aria-label="Offline space-dino game. Tap or press space to jump."
        >
          <canvas ref={canvasRef} width={800} height={240} className="block h-auto w-full select-none" />
        </div>

        <div className="mt-4 flex items-center gap-4 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
          <span>space / ↑ to jump</span>
          <span className="h-1 w-1 rounded-full bg-zinc-700" />
          <span>tap canvas on mobile</span>
          <span className="h-1 w-1 rounded-full bg-zinc-700" />
          <span>#houseofasher</span>
        </div>
      </main>
    </div>
  );
};

export default NotFound;

type Daily = {
  day: string;
  visitors: number;
  pageviews: number;
  bounce_rate: number | null;
  avg_session_seconds: number | null;
};
type Dim = { kind: string; label: string; hits: number; source: string };
type Live = {
  kind: string;
  path: string;
  dest: string | null;
  referrer_host: string | null;
  country: string | null;
  region: string | null;
};

function forecastVisitors(days: Daily[]): { next: { day: string; visitors: number }[]; note: string } {
  const last = days.slice(-14);
  if (last.length < 4) {
    return { next: [], note: "need more days before a trend is honest." };
  }
  const ys = last.map((d) => Number(d.visitors) || 0);
  const n = ys.length;
  const xMean = (n - 1) / 2;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (ys[i] - yMean);
    den += (i - xMean) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const lastDay = last[last.length - 1].day.slice(0, 10);
  const out: { day: string; visitors: number }[] = [];
  for (let i = 1; i <= 7; i++) {
    const dt = new Date(lastDay + "T00:00:00Z");
    dt.setUTCDate(dt.getUTCDate() + i);
    const v = Math.max(0, Math.round(ys[n - 1] + slope * i));
    out.push({ day: dt.toISOString().slice(0, 10), visitors: v });
  }
  return {
    next: out,
    note: "linear trend from the last 14 days. this is a trend, not a promise.",
  };
}

function Bars({ rows, max }: { rows: { label: string; hits: number }[]; max: number }) {
  const m = Math.max(1, max);
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-extralight text-foreground/90">{r.label}</span>
            <span className="shrink-0 font-mono text-[11px] text-foreground/50">{r.hits.toLocaleString()}</span>
          </div>
          <div className="mt-1 h-[2px] w-full bg-foreground/10">
            <div className="h-full bg-foreground/70" style={{ width: `${Math.max(2, (r.hits / m) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Card({ title, children, hint }: { title: string; children: React.ReactNode; hint?: string }) {
  return (
    <section className="rounded-2xl border border-border/20 bg-card/25 backdrop-blur-md px-6 py-5">
      <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-foreground/40">{title}</p>
      {hint ? <p className="mt-1 text-xs font-extralight text-muted-foreground">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function SiteTraffic() {
  const { user } = useAuth();
  const [daily, setDaily] = useState<Daily[]>([]);
  const [dims, setDims] = useState<Dim[]>([]);
  const [live, setLive] = useState<Live[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState("");
  const [asking, setAsking] = useState(false);

  const cosmeticAdmin = isInternalProEmail(user?.email);

  useEffect(() => {
    document.title = "asherin.traffic";
    let cancelled = false;
    (async () => {
      setBusy(true);
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const [dRes, dimRes, liveRes] = await Promise.all([
        supabase
          .from("site_traffic_daily" as never)
          .select("day,visitors,pageviews,bounce_rate,avg_session_seconds")
          .order("day", { ascending: true }),
        supabase
          .from("site_traffic_dim" as never)
          .select("kind,label,hits,source")
          .order("hits", { ascending: false }),
        supabase
          .from("site_traffic_events" as never)
          .select("kind,path,dest,referrer_host,country,region")
          .gte("occurred_at", weekAgo)
          .limit(4000),
      ]);
      if (cancelled) return;
      if (dRes.error || dimRes.error) {
        setErr("this page is for admins.");
        setBusy(false);
        return;
      }
      setDaily((dRes.data as Daily[]) || []);
      setDims((dimRes.data as Dim[]) || []);
      setLive((liveRes.data as Live[]) || []);
      setErr(null);
      setBusy(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const totals = useMemo(() => {
    const visitors = daily.reduce((a, d) => a + (Number(d.visitors) || 0), 0);
    const pageviews = daily.reduce((a, d) => a + (Number(d.pageviews) || 0), 0);
    const last = daily.slice(-14);
    const bounce = last.length === 0 ? null : last.reduce((a, d) => a + (Number(d.bounce_rate) || 0), 0) / last.length;
    return { visitors, pageviews, bounce };
  }, [daily]);

  const fc = useMemo(() => forecastVisitors(daily), [daily]);
  const of = (kind: string) => dims.filter((d) => d.kind === kind);
  const pages = of("page");
  const sources = of("source");
  const countries = of("country");
  const regions = of("region");
  const outbound = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of live) {
      if (e.kind !== "outbound" || !e.dest) continue;
      m.set(e.dest, (m.get(e.dest) || 0) + 1);
    }
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([label, hits]) => ({ label, hits }));
  }, [live]);
  const spark = daily.slice(-28);
  const sparkMax = Math.max(1, ...spark.map((d) => Number(d.visitors) || 0));

  const ask = async () => {
    const text = q.trim();
    if (!text || asking) return;
    setAsking(true);
    setAnswer("");
    try {
      await streamChat({
        messages: [
          {
            role: "user",
            content: `[site traffic desk] ${text}`,
          },
        ],
        mode: "research",
        onDelta: (t) => setAnswer((prev) => prev + t),
        onDone: () => setAsking(false),
      });
    } catch (e) {
      setAnswer(e instanceof Error ? e.message : "ask failed.");
      setAsking(false);
    }
  };

  return (
    <LandingBackground>
      <Header />
      <section className="relative z-10 px-6 pt-32 pb-20">
        <div className="mx-auto w-full max-w-3xl">
          <nav className="mb-8 flex flex-wrap items-center gap-2 text-xs font-extralight tracking-[0.22em] uppercase text-muted-foreground">
            <Link to="/" className="hover:text-foreground transition-colors">
              asherin
            </Link>
            <span aria-hidden className="text-border">
              /
            </span>
            <span className="text-foreground/70 normal-case tracking-normal">traffic</span>
          </nav>

          <p className="text-[10px] font-extralight tracking-[0.4em] uppercase text-accent/80 mb-4">
            internal Â· admins
          </p>
          <h1 className="font-display text-4xl sm:text-5xl font-light tracking-[-0.025em] leading-[1.05] text-foreground">
            asherin.traffic
          </h1>
          <p className="mt-6 max-w-xl text-base font-extralight leading-relaxed text-muted-foreground">
            which pages get seen, where clicks go next, where people arrived from, and which country â then the region
            of that country when we have it.
          </p>
          <p className="mt-3 max-w-xl text-sm font-extralight leading-relayed text-muted-foreground/80">
            historic is the published-site count from 1 may 2026 through 16 aug 2026. that set has country, not region.
            region below is a smaller signed-in sample. live clicks start after this page is on. no names. no emails. no
            ips.
          </p>

          {busy ? (
            <p className="mt-12 text-sm font-extralight tracking-[0.2em] text-muted-foreground animate-pulse">
              asherin
            </p>
          ) : err ? (
            <p className="mt-12 text-sm font-extralight text-muted-foreground">{err}</p>
          ) : (
            <>
              <div className="mt-12 grid grid-cols-3 gap-3">
                {[
                  { k: "visitors", v: totals.visitors.toLocaleString() },
                  { k: "pageviews", v: totals.pageviews.toLocaleString() },
                  { k: "bounce Â· 14d", v: totals.bounce == null ? "â" : `${Math.round(totals.bounce)}%` },
                ].map((s) => (
                  <div key={s.k} className="rounded-2xl border border-border/20 bg-card/25 backdrop-blur-md px-4 py-4">
                    <p className="font-mono text-[10px] tracking-[0.28em] uppercase text-foreground/40">{s.k}</p>
                    <p className="mt-2 text-2xl font-light tracking-tight text-foreground">{s.v}</p>
                  </div>
                ))}
              </div>

              <Card title="last 28 days" hint="visitors per day">
                <div className="flex h-16 items-end gap-[3px]">
                  {spark.map((d) => (
                    <div
                      key={d.day}
                      className="flex-1 rounded-sm bg-foreground/70"
                      style={{ height: `${Math.max(6, ((Number(d.visitors) || 0) / sparkMax) * 100)}%` }}
                      title={`${d.day.slice(0, 10)} Â· ${d.visitors}`}
                    />
                  ))}
                </div>
              </Card>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Card title="pages" hint="historic published-site count">
                  <Bars rows={pages} max={pages[0]?.hits || 1} />
                </Card>
                <Card title="from where" hint="referrer / source">
                  <Bars rows={sources} max={sources[0]?.hits || 1} />
                </Card>
                <Card title="country" hint="historic. in = india, us = united states.">
                  <Bars rows={countries} max={countries[0]?.hits || 1} />
                </Card>
                <Card
                  title="region of that country"
                  hint="signed-in sessions only. historic public count has no region."
                >
                  {regions.length === 0 ? (
                    <p className="text-sm font-extralight text-muted-foreground">this is unsure: no region yet.</p>
                  ) : (
                    <Bars rows={regions} max={regions[0]?.hits || 1} />
                  )}
                </Card>
              </div>

              <div className="mt-4">
                <Card
                  title="where clicks go"
                  hint="live outbound since this page existed. empty until people click off-site."
                >
                  {outbound.length === 0 ? (
                    <p className="text-sm font-extralight text-muted-foreground">none yet. this is not fake data.</p>
                  ) : (
                    <Bars rows={outbound} max={outbound[0]?.hits || 1} />
                  )}
                </Card>
              </div>

              <div className="mt-4">
                <Card title="next 7 days" hint={fc.note}>
                  {fc.next.length === 0 ? (
                    <p className="text-sm font-extralight text-muted-foreground">{fc.note}</p>
                  ) : (
                    <ul className="space-y-1 text-sm font-extralight">
                      {fc.next.map((d) => (
                        <li key={d.day} className="flex justify-between text-foreground/80">
                          <span>{d.day}</span>
                          <span className="font-mono text-[11px] text-foreground/50">{d.visitors} visitors</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>

              <div className="mt-8 rounded-2xl border border-border/20 bg-card/25 backdrop-blur-md px-6 py-5">
                <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-foreground/40">ask asherin</p>
                <p className="mt-1 text-xs font-extralight text-muted-foreground">
                  same asherin.com ai. it can read these counts, predict from the trend, and answer questions.{" "}
                  {cosmeticAdmin
                    ? "your seat is on the admin list."
                    : "it only answers this desk if your seat is admin."}
                </p>
                <textarea
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  rows={3}
                  className="mt-4 w-full rounded-lg border border-border/30 bg-background/40 px-3 py-2 text-sm font-light text-foreground"
                  placeholder="which page is winning, and what happens next week?"
                  aria-label="ask asherin about traffic"
                />
                <button
                  type="button"
                  onClick={ask}
                  disabled={asking || !q.trim()}
                  className="mt-3 rounded-lg bg-foreground px-4 py-2 text-sm font-light text-background disabled:opacity-50"
                >
                  {asking ? "thinkingâ¦" : "ask"}
                </button>
                {answer ? (
                  <div className="mt-4 whitespace-pre-wrap text-sm font-extralight leading-relaxed text-foreground/80">
                    {answer}
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>
      </section>
      <SiteFooter />
    </LandingBackground>
  );
}
