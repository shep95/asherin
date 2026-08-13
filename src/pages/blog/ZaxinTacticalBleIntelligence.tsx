import ArticleShell from "@/components/seo/ArticleShell";
import {
  ArticleJsonLd,
  BreadcrumbJsonLd,
  FaqJsonLd,
} from "@/components/seo/SeoJsonLd";

const URL = "https://asherin.com/blog/zaxin-tactical-ble-intelligence";
const TITLE = "Zaxin — Tactical BLE Intelligence, AR HUD & Satellite Recon Inside Asherin";
const PUBLISHED = "2026-06-26T00:00:00.000Z";

const Box = ({ children }: { children: React.ReactNode }) => (
  <pre className="not-prose my-8 overflow-x-auto rounded-lg border border-border/40 bg-card/40 p-5 text-[12px] leading-[1.55] font-mono text-foreground/85 whitespace-pre">
    {children}
  </pre>
);

const ZaxinTacticalBleIntelligence = () => (
  <ArticleShell
    eyebrow="Product Briefing · Zaxin · Asherin $79 Tier"
    title="Zaxin — Tactical BLE Intelligence inside Asherin"
    dek="Zaxin is the Web-Bluetooth tactical layer bundled with the Asherin $79 subscription: a five-brain stack that pairs nearby devices, plots them on real satellite imagery, and overlays them on the camera feed as a Ghost-Recon-style HUD. This is the field briefing — workflows, diagrams, and the seven AI fusion theories that power it."
    publishedLabel="Jun 26 2026"
    readTime="11 min"
  >
    <ArticleJsonLd
      id="zaxin-tactical-ble-intelligence"
      url={URL}
      headline={TITLE}
      description="Zaxin is a Web-Bluetooth tactical intelligence suite inside Asherin: five-brain architecture, AR HUD, satellite map, and AXRLEN-powered briefs from your own BYOK key."
      datePublished={PUBLISHED}
      keywords={[
        "Zaxin",
        "Web Bluetooth tactical",
        "BLE intelligence",
        "AR HUD compass",
        "Ghost Recon HUD",
        "satellite recon map",
        "Asherin $79 subscription",
        "AXRLEN tactical brief",
        "BYOK Gemini OpenAI",
      ]}
    />
    <BreadcrumbJsonLd
      id="zaxin-tactical-ble-intelligence"
      items={[
        { name: "Asherin", url: "/" },
        { name: "Blog", url: "/blog" },
        { name: "Zaxin — Tactical BLE Intelligence", url: "/blog/zaxin-tactical-ble-intelligence" },
      ]}
    />
    <FaqJsonLd
      id="zaxin-tactical-ble-intelligence-faq"
      items={[
        {
          q: "What is Zaxin?",
          a: "Zaxin is the Web-Bluetooth tactical layer bundled with the Asherin $79 subscription. It pairs nearby BLE devices, plots them on real Esri satellite imagery, and overlays them on the camera feed as a Ghost-Recon-style HUD. AI briefs run on the operator's own BYOK key.",
        },
        {
          q: "Why does Zaxin require a tap to pair each device?",
          a: "Web Bluetooth mandates an OS-level chooser per device by design — no browser-side app can bypass it. Zaxin runs a rapid-fire loop instead: tap + Add Device once, accept, and the chooser immediately re-opens for the next device until you close it.",
        },
        {
          q: "Does Zaxin need a Google Maps API key?",
          a: "No. The satellite overhead panel uses Esri World Imagery tiles, which require no API key. Browser geolocation centers the view; compass heading and RSSI distance estimates place contacts as amber pips around the operator.",
        },
        {
          q: "How does the AXRLEN tactical brief stay private?",
          a: "Briefs run directly from the browser against the operator's own API key, configured in Dashboard → Zophiel Engine → BYOK. No platform key is used and no contact data is logged server-side.",
        },
      ]}
    />
    <h2>1. What Zaxin actually is</h2>
    <p>
      Zaxin is the tactical Bluetooth layer bundled with the Asherin{" "}
      <strong>$79 subscription tier</strong>. It runs entirely in the
      browser, uses the Web-Bluetooth API for pairing, MediaPipe for body
      and face tracking, the device's geolocation and compass for spatial
      orientation, and Esri World Imagery for the satellite overhead.
      Nothing is server-side except the contacts your peers explicitly
      share through the hop-mesh.
    </p>

    <h2>2. The five-brain architecture</h2>
    <Box>{`┌──────────────────────────────────────────────────────────────┐
│                ZAXIN — FIVE-BRAIN STACK                      │
├──────────────────────────────────────────────────────────────┤
│  B1  SCANNER    Web Bluetooth requestDevice / GATT pairing   │
│  B2  NAMING     Manufacturer + UUID → human-readable label   │
│  B3  INTEL      RSSI → distance, behavior, threat tier       │
│  B4  TACTICAL   HUD overlay · compass · reticles · PiP scope │
│  B5  HOP-MESH   Peer share of contacts over WebRTC channels  │
└──────────────────────────────────────────────────────────────┘`}</Box>
    <p>
      Each brain is isolated. If hop-mesh disconnects, scanner and tactical
      keep operating. If the camera blacks out, the watchdog restarts it
      without dropping the BLE picture.
    </p>

    <h2>3. The pair-to-plot workflow</h2>
    <Box>{`OPERATOR                BROWSER (Zaxin)            EXTERNAL
   │                         │                          │
   │  tap "+ Add Device" ───▶│                          │
   │                         │  requestDevice()  ──────▶│  OS chooser
   │  accept device ────────────────────────────────────│
   │                         │◀── GATT connect ─────────│  peripheral
   │                         │                          │
   │                         │  Naming brain  ─▶ label  │
   │                         │  Intel brain   ─▶ RSSI→m │
   │                         │                          │
   │                         │  Satellite tile fetch ──▶│  Esri ArcGIS
   │                         │◀── tile PNG ─────────────│
   │                         │                          │
   │  see amber pip on map ◀─│  plot pip at (lat,lon)   │
   │  see reticle in HUD  ◀──│  project bearing → FOV   │
   │                         │  rapid-fire loop reopens │
   │                         │  chooser for next device │
   ▼                         ▼                          ▼`}</Box>

    <h2>4. Satellite recon — why Esri, not Google</h2>
    <p>
      Esri's World Imagery service serves global high-resolution overhead
      tiles without an API key for non-commercial in-app rendering. That
      means Zaxin works the moment you load the dashboard — no key dance,
      no billing risk. Zoom range is z10–z20, contacts are placed by real
      bearing and RSSI-derived distance, and the compass heading rotates
      the pip ring around the operator dot.
    </p>

    <h2>5. AR HUD — the camera-as-world plane</h2>
    <Box>{`            ┌─────────────────────────────────┐
            │   FRONT CAMERA (PiP scope)      │
            │  ┌───────────┐                  │
            │  │  ▲ 273°   │                  │
            │  │  N  E  S  │   ◉  reticle     │
            │  └───────────┘                  │
            │                                 │
            │  Pixel 8 · 4m · 8 o'clock       │
            │  AirPods · 1.2m · center        │
            │  Unknown beacon · 11m · 2 o'c   │
            │                                 │
            │   REAR CAMERA (world plane)     │
            └─────────────────────────────────┘`}</Box>
    <p>
      Each BLE contact is projected onto a ~65° FOV: the horizontal pixel
      position is <code>(Δbearing / FOV) × width</code>, the pip diameter
      scales inversely with estimated distance, and MediaPipe's body
      skeleton binds the pip to whichever person is centered in frame.
      Theory T3 (Visual ↔ BLE Fusion) drives the binding logic.
    </p>

    <h2>6. AXRLEN tactical brief — BYOK only</h2>
    <p>
      Briefs use <strong>your own API key</strong>, configured in{" "}
      <em>Dashboard → Zophiel Engine → BYOK</em>. Google Gemini and OpenAI
      are wired for in-browser calls today. The prompt is fixed to a
      four-line Ghost-Recon format: situational summary, highest-priority
      threat, recommended action, confidence band. No platform key
      fallback. No server logging.
    </p>

    <h2>7. The seven AI fusion theories</h2>
    <p>
      The full theory dossier — RSSI→reticle projection, inverse-RSSI
      SLAM, visual-BLE fusion, AXRLEN threat narration, behavior
      fingerprinting, photogrammetric anchoring, and ultrasonic
      cross-check — lives on the Zaxin theories page:
    </p>
    <p>
      → <a href="/zaxin/theories" className="underline">Read the Zaxin Vision Theories</a>
    </p>

    <h2>8. Where Zaxin fits in the Asherin stack</h2>
    <Box>{`ASHERIN ($199 / $79 / $740 / Lifetime)
    │
    ├── Zophiel Engine     ── intelligence & BYOK keys
    ├── AXRLEN             ── predictive forecasting
    ├── ZERLAL             ── vulnerability scanning
    └── ZAXIN ($79 tier)  ── tactical BLE + AR HUD + satellite recon
                                │
                                └── BYOK brief → operator's own key only`}</Box>

    <h2>9. FAQ</h2>
    <h3>Why can't Zaxin auto-pair without a tap?</h3>
    <p>
      Web Bluetooth mandates a per-device OS chooser confirmed by a
      human gesture. No browser-side app — including Apple's or Google's
      own — can bypass it. Zaxin's rapid-fire loop is the closest legal
      approximation: tap once, accept, the chooser immediately re-opens
      for the next device.
    </p>
    <h3>Does Zaxin store my contacts?</h3>
    <p>
      Local-only in browser memory. Hop-mesh sharing is opt-in and
      ephemeral — peers see contacts only while connected.
    </p>
    <h3>Which tier includes Zaxin?</h3>
    <p>
      Asherin $79/mo and Lifetime tiers include the full Zaxin suite.
      Lower tiers see the panel but cannot start a scan.
    </p>
  </ArticleShell>
);

export default ZaxinTacticalBleIntelligence;
