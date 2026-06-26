import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Header from "@/components/Header";
import SiteFooter from "@/components/SiteFooter";
import {
  ArticleJsonLd,
  BreadcrumbJsonLd,
} from "@/components/seo/SeoJsonLd";
import { useEffect } from "react";

const URL = "https://aureonai.app/zaxin/theories";
const TITLE = "Zaxin Vision Theories — Seven AI Fusion Blueprints for Tactical BLE";
const DESC = "The seven AI integration theories that power Zaxin: RSSI-to-reticle projection, inverse-RSSI SLAM, visual-BLE fusion, AXRLEN threat narration, behavior fingerprinting, photogrammetric anchoring, and ultrasonic cross-check.";

type Theory = {
  id: string;
  title: string;
  thesis: string;
  body: string;
  workflow: string;
};

const THEORIES: Theory[] = [
  {
    id: "T1",
    title: "RSSI → Camera Reticle",
    thesis: "Project each BLE bearing onto the camera FOV as a reticle.",
    body: "The rear camera is treated as the world plane. Each contact's RSSI-derived bearing is projected onto a ~65° horizontal field of view. Pip x-position equals (Δbearing / FOV) × width; pip diameter scales inversely with distance. The result is a Ghost-Recon-style overlay built entirely from existing sensors — no extra hardware, no AR headset.",
    workflow: `BLE advert → RSSI buffer → bearing estimate
                         │
                         ▼
   camera FOV (65°) ─── projector ─── reticle (x,y,size)
                         │
                         ▼
                    HUD overlay`,
  },
  {
    id: "T2",
    title: "Inverse-RSSI SLAM",
    thesis: "Solve for bearing and range from 30s of motion + RSSI history.",
    body: "A 30-second buffer of (heading, RSSI) samples per device is fed to a tiny on-device Kalman filter or TF.js head. As the operator turns and walks, the system inverts the path-loss model to find the most-likely (bearing, range) pair that explains every sample. Confidence drives reticle thickness — thick = certain, thin = exploratory.",
    workflow: `(heading_t, rssi_t)  ── ring buffer (30s) ───┐
                                                          ▼
                                              Kalman / TF.js head
                                                          │
                                                 (bearing, range, σ)
                                                          │
                                                 reticle thickness`,
  },
  {
    id: "T3",
    title: "Visual ↔ BLE Fusion",
    thesis: "Bind BLE pips to MediaPipe detections when screen positions overlap.",
    body: "MediaPipe detects people, phones, watches, earbuds, and AirTag-shaped objects in the camera frame. When a detection's screen position overlaps a projected BLE reticle within tolerance, the system binds them — 'Pixel 8 at 4 m → person at center-frame.' IoU tracking persists the name across frames even if the BLE momentarily drops.",
    workflow: `camera frame ── MediaPipe ── object boxes
                                       │
                                       ▼
     BLE reticles ─── IoU match ─── bound pair
                                       │
                                       ▼
                            persistent label (3s decay)`,
  },
  {
    id: "T4",
    title: "AXRLEN Threat Narrator",
    thesis: "Every 5s, AXRLEN turns the contact picture into one Ghost-Recon line.",
    body: "Contacts, alerts, scenario, and fusion bindings are serialized and sent to AXRLEN (via the operator's BYOK key — Gemini or OpenAI). The model returns a single line: 'Clone-suspect AirPods at 8 o'clock, closing 1.2 m/s — likely tail.' Rendered as a HUD ticker. No platform key, no server fallback.",
    workflow: `{contacts, alerts, scenario, bindings}
              │
              ▼  (every 5s, BYOK Gemini/OpenAI)
        AXRLEN brief (≤1 line)
              │
              ▼
        HUD ticker (bottom-third)`,
  },
  {
    id: "T5",
    title: "Behavior Fingerprinting",
    thesis: "Classify device intent from RSSI time-series + manufacturer + UUIDs.",
    body: "A small in-browser classifier reads the last N seconds of RSSI plus the device's manufacturer ID and advertised service UUIDs. It outputs a label: stationary beacon, carried-on-person, or vehicle-mounted. The label drives the threat-tier color and the AXRLEN narrator's framing.",
    workflow: `rssi_series + mfr + uuids
              │
              ▼  (logistic / shallow TF.js)
   {stationary | carried | vehicle}
              │
              ▼
   threatTier color  +  narrator framing`,
  },
  {
    id: "T6",
    title: "Photogrammetric Anchor",
    thesis: "Anchor BLE pips to visual landmarks for AR persistence without ARKit.",
    body: "When the camera sees a stable landmark — door, car, signpost — co-located with a strong BLE pip, the contact is anchored to that visual feature. The pip stays pinned to the landmark even when the operator turns away, then re-acquires when the landmark returns to frame. True AR persistence without ARKit or ARCore.",
    workflow: `camera frame ── landmark detector ── feature anchor
                                                    │
                  strong BLE pip overlap? ──Y──▶ bind to anchor
                                                    │
                                              persist across turns`,
  },
  {
    id: "T7",
    title: "Ultrasonic Cross-Check",
    thesis: "Mic FFT detects 18–22 kHz pairing chirps to harden BLE fusion bindings.",
    body: "Many BLE peripherals emit 18–22 kHz chirps during pairing or proximity handshake. The microphone runs an FFT in the same window as new BLE adverts; a coincident pulse hardens the visual ↔ BLE fusion binding from 'probable' to 'confirmed'. Works even when the camera cannot see the device.",
    workflow: `microphone ── FFT (18-22 kHz) ── pulse detect
                                                  │
              new BLE advert in same window? ──Y──▶ harden binding
                                                  │
                                          confidence: probable → confirmed`,
  },
];

const ZaxinTheories = () => {
  useEffect(() => {
    document.title = TITLE;
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <ArticleJsonLd
        id="zaxin-theories"
        url={URL}
        headline={TITLE}
        description={DESC}
        datePublished="2026-06-26T00:00:00.000Z"
        keywords={[
          "Zaxin theories",
          "BLE AI fusion",
          "RSSI camera reticle",
          "inverse RSSI SLAM",
          "visual BLE fusion",
          "AXRLEN tactical brief",
          "behavior fingerprinting",
          "photogrammetric anchor",
          "ultrasonic cross-check",
        ]}
      />
      <BreadcrumbJsonLd
        id="zaxin-theories"
        items={[
          { name: "Aureon", url: "/" },
          { name: "Zaxin", url: "/dashboard/zaxin" },
          { name: "Theories", url: "/zaxin/theories" },
        ]}
      />
      <link rel="canonical" href={URL} />

      <main className="mx-auto max-w-4xl px-6 py-16">
        <Link
          to="/dashboard/zaxin"
          className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-foreground/60 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Zaxin
        </Link>

        <header className="mt-8 mb-10">
          <p className="text-[10px] tracking-[0.28em] uppercase text-[#c69a4a]">
            Zaxin · Vision Dossier
          </p>
          <h1 className="mt-3 text-4xl sm:text-5xl font-light tracking-tight">
            Zaxin Vision Theories
          </h1>
          <p className="mt-4 text-foreground/70 max-w-2xl leading-relaxed">
            Seven AI integration blueprints that fuse camera, BLE, audio,
            geolocation, and AXRLEN into a single tactical picture. Each
            theory ships as a deployable module inside the Aureon $399
            subscription — workflows below.
          </p>
        </header>

        <ol className="space-y-10">
          {THEORIES.map((t) => (
            <li
              key={t.id}
              className="rounded-lg border border-[#c69a4a]/15 bg-card/30 p-6"
            >
              <div className="flex items-baseline gap-3">
                <span className="text-[10px] tracking-[0.28em] uppercase text-[#c69a4a]/80">
                  {t.id}
                </span>
                <h2 className="text-xl text-[#e8c684] font-light">{t.title}</h2>
              </div>
              <p className="mt-2 text-sm text-foreground/85 italic">
                {t.thesis}
              </p>
              <p className="mt-4 text-sm leading-relaxed text-foreground/75">
                {t.body}
              </p>
              <pre className="mt-5 overflow-x-auto rounded-md border border-border/40 bg-black/40 p-4 text-[11px] leading-[1.55] font-mono text-foreground/80 whitespace-pre">
{t.workflow}
              </pre>
            </li>
          ))}
        </ol>

        <section className="mt-16 rounded-lg border border-[#c69a4a]/20 bg-card/30 p-6">
          <h2 className="text-lg text-[#e8c684] font-light">
            How the seven theories compose
          </h2>
          <pre className="mt-4 overflow-x-auto rounded-md border border-border/40 bg-black/40 p-4 text-[11px] leading-[1.55] font-mono text-foreground/80 whitespace-pre">
{`           ┌────────────────────────────────────────┐
           │           ZAXIN COMPOSED STACK         │
           ├────────────────────────────────────────┤
           │  T1  RSSI → reticle    (geometry)      │
           │  T2  Inverse-RSSI SLAM (uncertainty)   │
           │  T3  Visual ↔ BLE      (binding)       │
           │  T5  Behavior class    (intent)        │
           │  T6  Photogrammetric   (persistence)   │
           │  T7  Ultrasonic xchk   (confirmation)  │
           ├────────────────────────────────────────┤
           │  T4  AXRLEN narrator   (synthesis)     │
           └────────────────────────────────────────┘`}
          </pre>
          <p className="mt-4 text-sm text-foreground/75 leading-relaxed">
            T1–T3, T5–T7 produce the structured picture. T4 (AXRLEN) reads
            that picture and renders the one-line operator brief. The
            entire chain runs in-browser; AXRLEN calls go directly to the
            operator's BYOK key — no platform fallback.
          </p>
        </section>

        <div className="mt-12 flex flex-wrap gap-3 text-sm">
          <Link
            to="/blog/zaxin-tactical-ble-intelligence"
            className="rounded-md border border-[#c69a4a]/30 px-4 py-2 text-[#e8c684] hover:bg-[#c69a4a]/10 transition-colors"
          >
            Read the Zaxin product briefing →
          </Link>
          <Link
            to="/dashboard/zaxin"
            className="rounded-md border border-border/40 px-4 py-2 text-foreground/80 hover:bg-card/60 transition-colors"
          >
            Open Zaxin in the dashboard →
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
};

export default ZaxinTheories;
