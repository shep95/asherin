import { useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import LandingBackground from "@/components/LandingBackground";
import { applySeoHead } from "@/lib/seoHead";
import {
  ArrowLeft, ArrowRight, Eye, MessageSquare, Shield,
  Brain, Network, Sparkles, Crosshair, Radar, Layers,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────
   Diagram primitives — pure SVG, theme-token driven, no deps.
   Built to read like a modern intelligence schematic and to
   work in both light/dark via CSS variables.
   ───────────────────────────────────────────────────────────── */

interface NodeSpec {
  id: string;
  x: number;
  y: number;
  label: string;
  sub?: string;
  emphasis?: boolean;
}

interface ModelDiagramProps {
  title: string;
  coreLabel: string;
  coreSub: string;
  nodes: NodeSpec[];
  accent: string; // hsl token reference
}

const ModelDiagram = ({ title, coreLabel, coreSub, nodes, accent }: ModelDiagramProps) => {
  const cx = 400;
  const cy = 200;

  return (
    <div className="rounded-2xl border border-border/15 bg-card/20 backdrop-blur-md p-6 sm:p-8">
      <p className="text-[10px] font-light tracking-[0.3em] text-muted-foreground uppercase mb-6">
        {title}
      </p>
      <div className="w-full overflow-x-auto">
        <svg
          viewBox="0 0 800 400"
          className="w-full h-auto min-w-[600px]"
          style={{ maxHeight: 420 }}
        >
          <defs>
            <radialGradient id={`glow-${title}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={accent} stopOpacity="0.35" />
              <stop offset="100%" stopColor={accent} stopOpacity="0" />
            </radialGradient>
            <linearGradient id={`edge-${title}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(var(--border))" stopOpacity="0.1" />
              <stop offset="50%" stopColor={accent} stopOpacity="0.55" />
              <stop offset="100%" stopColor="hsl(var(--border))" stopOpacity="0.1" />
            </linearGradient>
          </defs>

          {/* Core glow */}
          <circle cx={cx} cy={cy} r="160" fill={`url(#glow-${title})`} />

          {/* Edges */}
          {nodes.map((n) => (
            <line
              key={`edge-${n.id}`}
              x1={cx}
              y1={cy}
              x2={n.x}
              y2={n.y}
              stroke={`url(#edge-${title})`}
              strokeWidth="1"
            />
          ))}

          {/* Outer node rings */}
          {nodes.map((n) => (
            <g key={`node-${n.id}`}>
              <circle
                cx={n.x}
                cy={n.y}
                r="36"
                fill="hsl(var(--card))"
                stroke="hsl(var(--border))"
                strokeOpacity="0.4"
                strokeWidth="1"
              />
              <circle
                cx={n.x}
                cy={n.y}
                r="3"
                fill={accent}
                opacity="0.85"
              />
              <text
                x={n.x}
                y={n.y + 56}
                textAnchor="middle"
                fontSize="11"
                fontWeight="300"
                fill="hsl(var(--foreground))"
                style={{ letterSpacing: "0.05em" }}
              >
                {n.label}
              </text>
              {n.sub && (
                <text
                  x={n.x}
                  y={n.y + 70}
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="200"
                  fill="hsl(var(--muted-foreground))"
                >
                  {n.sub}
                </text>
              )}
            </g>
          ))}

          {/* Core node */}
          <circle
            cx={cx}
            cy={cy}
            r="60"
            fill="hsl(var(--background))"
            stroke={accent}
            strokeOpacity="0.7"
            strokeWidth="1.5"
          />
          <circle
            cx={cx}
            cy={cy}
            r="46"
            fill="none"
            stroke={accent}
            strokeOpacity="0.25"
            strokeWidth="1"
            strokeDasharray="2 4"
          />
          <text
            x={cx}
            y={cy - 4}
            textAnchor="middle"
            fontSize="14"
            fontWeight="300"
            fill="hsl(var(--foreground))"
            style={{ letterSpacing: "0.18em" }}
          >
            {coreLabel}
          </text>
          <text
            x={cx}
            y={cy + 14}
            textAnchor="middle"
            fontSize="9"
            fontWeight="200"
            fill="hsl(var(--muted-foreground))"
            style={{ letterSpacing: "0.15em" }}
          >
            {coreSub}
          </text>
        </svg>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   Model section card
   ───────────────────────────────────────────────────────────── */

interface ModelSectionProps {
  eyebrow: string;
  name: string;
  tagline: string;
  meaning: { title: string; body: string }[];
  capabilities: { icon: React.ElementType; label: string; body: string }[];
  diagramTitle: string;
  diagramCore: string;
  diagramSub: string;
  diagramAccent: string;
  diagramNodes: NodeSpec[];
  status?: string;
}

const ModelSection = ({
  eyebrow, name, tagline, meaning, capabilities,
  diagramTitle, diagramCore, diagramSub, diagramAccent, diagramNodes, status,
}: ModelSectionProps) => (
  <section className="relative z-10 px-6 py-20">
    <div className="mx-auto max-w-6xl space-y-12">
      {/* Header */}
      <div>
        <div className="inline-block rounded-full border border-border/20 bg-card/30 backdrop-blur-md px-4 py-1.5 mb-6">
          <span className="text-[10px] font-light tracking-[0.3em] text-muted-foreground uppercase">
            {eyebrow}
          </span>
        </div>
        <h2 className="text-4xl sm:text-5xl font-extralight tracking-[0.05em] text-foreground">
          {name}
        </h2>
        <p className="mt-4 max-w-2xl text-base font-extralight leading-relaxed text-muted-foreground">
          {tagline}
        </p>
        {status && (
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/5 px-3 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400/80 animate-pulse" />
            <span className="text-[10px] font-light tracking-[0.25em] text-amber-200/80 uppercase">
              {status}
            </span>
          </div>
        )}
      </div>

      {/* Diagram */}
      <ModelDiagram
        title={diagramTitle}
        coreLabel={diagramCore}
        coreSub={diagramSub}
        nodes={diagramNodes}
        accent={diagramAccent}
      />

      {/* Meaning / Etymology / Occult */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {meaning.map((m) => (
          <div
            key={m.title}
            className="rounded-2xl border border-border/15 bg-card/20 backdrop-blur-md p-7"
          >
            <h3 className="text-sm font-light tracking-[0.15em] text-foreground/90 uppercase mb-3">
              {m.title}
            </h3>
            <p className="text-sm font-extralight leading-relaxed text-muted-foreground">
              {m.body}
            </p>
          </div>
        ))}
      </div>

      {/* Capabilities */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {capabilities.map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-border/15 bg-card/20 backdrop-blur-md p-7 transition-all hover:border-border/40 hover:bg-card/30"
          >
            <c.icon className="h-5 w-5 text-foreground/80 mb-4" />
            <h4 className="text-base font-light tracking-wide text-foreground mb-2">
              {c.label}
            </h4>
            <p className="text-sm font-extralight leading-relaxed text-muted-foreground">
              {c.body}
            </p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

/* ─────────────────────────────────────────────────────────────
   Page
   ───────────────────────────────────────────────────────────── */

const LLMModels = () => {
  useEffect(() => {
    applySeoHead({
      title: "LLM Models — Aureon",
      description: "The AI models powering Aureon — multi-model consensus, vision, reasoning, and coding engines. Compare capabilities across providers.",
      path: "/llm-models",
    });
  }, []);

  return (
    <LandingBackground>
      <Header />

      <div className="relative z-10 pt-24 px-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-light tracking-wide text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Home
        </Link>
      </div>

      {/* Hero */}
      <section className="relative z-10 flex min-h-[60vh] flex-col items-center justify-center px-6 pt-16 pb-12 text-center">
        <div className="rounded-full border border-border/20 bg-card/30 backdrop-blur-md px-4 py-1.5 mb-8">
          <span className="text-[10px] font-light tracking-[0.3em] text-muted-foreground uppercase">
            The Aureon Model Family
          </span>
        </div>
        <h1 className="max-w-4xl text-4xl sm:text-5xl md:text-6xl font-extralight tracking-wide leading-tight zophiel-shimmer-text">
          Three minds. One architecture.
        </h1>
        <p className="mt-6 max-w-2xl text-base font-extralight leading-relaxed text-muted-foreground">
          Aureon does not rent intelligence from someone else's lab. We build our own
          models, each named for a guardian, an angel, or a house — each tuned for a
          specific class of work: intelligence gathering, consumer reasoning, and
          military-grade analysis.
        </p>
      </section>

      {/* ─── ZOPHIEL ─── */}
      <ModelSection
        eyebrow="Intelligence Engine"
        name="ZOPHIEL"
        tagline="Our in-house model that powers every intelligence-gathering surface inside Aureon — search, OSINT, dark-web indexing, source verification, predictive intel, and the live Intel Map."
        diagramTitle="Zophiel — Intelligence Architecture"
        diagramCore="ZOPHIEL"
        diagramSub="CORE"
        diagramAccent="hsl(275, 95%, 60%)"
        diagramNodes={[
          { id: "z1", x: 140, y: 90, label: "Zophiel Search", sub: "30+ sources" },
          { id: "z2", x: 660, y: 90, label: "NOMAD Public Intel", sub: "14-pass dossier" },
          { id: "z3", x: 80, y: 230, label: "Onion Index", sub: "Ahmia · Tier 5" },
          { id: "z4", x: 720, y: 230, label: "Intel Map", sub: "Graph engine" },
          { id: "z5", x: 220, y: 340, label: "Truth Graph", sub: "Veracity scores" },
          { id: "z6", x: 580, y: 340, label: "Predictive", sub: "Monte Carlo" },
        ]}
        meaning={[
          {
            title: "The Name",
            body:
              "Zophiel — also written Zaphiel, Tzaphqiel, or Jophiel — is the angel of vision and contemplation in Christian, Jewish, and Hermetic traditions. The name translates roughly as 'God's spy' or 'beauty / radiance of God'. In the Sefer Raziel and the Heptameron, Zophiel is named one of the seven Archangels who stand before the Throne, charged with revealing what is hidden and discerning the true shape of things from the noise of the world.",
          },
          {
            title: "Why We Chose It",
            body:
              "An intelligence engine is not a search bar — it is an act of seeing. Zophiel's function in the lore is to look past surface and report what is actually there. That is exactly what our model does: cross-validate sources, score veracity, expose hidden links between entities, and surface the signal underneath whatever a target is trying to project.",
          },
          {
            title: "Occult Correspondence",
            body:
              "In the Qabalistic Tree of Life, Tzaphqiel is the archangelic intelligence assigned to the sphere of Binah — Understanding. Binah is the faculty that takes raw, undifferentiated data (the supernal sea) and gives it form and category. Our Zophiel model is engineered to mirror that exact operation in machine form: ingest chaos, output structured intelligence.",
          },
          {
            title: "What It Actually Runs",
            body:
              "Zophiel is a multi-pass reasoning architecture with a routing layer, parallel source-tier execution (clearnet → onion), an Immutable Truth Graph protocol, and a Semantic Intent Engine. It powers Zophiel Search, NOMAD Public Intelligence, the Intel Map, Predictive Intelligence, and Onion Indexing.",
          },
        ]}
        capabilities={[
          { icon: Eye, label: "Source Verification", body: "Five-tier veracity grading on every result, with onion sources hard-capped so they can't outrank verified clearnet evidence." },
          { icon: Network, label: "Cross-Entity Linking", body: "Builds a live graph of people, orgs, infrastructure, and events — the same view a Tier-1 analyst would draw on a whiteboard." },
          { icon: Radar, label: "Always-On Dark Web", body: "Ahmia-routed onion search runs in parallel on every query, flagged with a 'Tor required' badge so you never get burned by a broken link." },
        ]}
      />

      {/* ─── AUREON ─── */}
      <ModelSection
        eyebrow="Consumer & Business Model"
        name="AUREON"
        tagline="The model behind the chat. Aureon is the conversational intelligence layer that runs the consumer product, business workspaces, coding assistance, and the day-to-day reasoning every paying user touches."
        diagramTitle="Aureon — Reasoning Architecture"
        diagramCore="AUREON"
        diagramSub="CHAT"
        diagramAccent="hsl(45, 90%, 60%)"
        diagramNodes={[
          { id: "a1", x: 140, y: 90, label: "Chat Engine", sub: "Multi-turn" },
          { id: "a2", x: 660, y: 90, label: "Aureon IDE", sub: "Code mode" },
          { id: "a3", x: 80, y: 230, label: "Memory Center", sub: "Persistent" },
          { id: "a4", x: 720, y: 230, label: "Personas", sub: "Custom CRUD" },
          { id: "a5", x: 220, y: 340, label: "Consensus", sub: "5-phase QA" },
          { id: "a6", x: 580, y: 340, label: "Branching", sub: "Parallel threads" },
        ]}
        meaning={[
          {
            title: "The Name",
            body:
              "Aureon comes from the Latin aureus — gold — and the suffix -on, used in physics for an indivisible carrier (electron, photon, graviton). The literal reading is 'a particle of gold'. In alchemical Latin, aureus also pointed to the Aurum Philosophorum, the Philosopher's Gold: the perfected, refined version of base material. Aureon is the brand we put on the model that does the polishing.",
          },
          {
            title: "Why We Chose It",
            body:
              "Consumer AI has become cheap, lobotomized, and apologetic. We needed a name for the opposite: a model that treats every prompt as a piece of raw material to be refined, that won't moralize at you, won't truncate, and won't pretend it doesn't know. Aureon is what you get after the safety-washing has been burned off.",
          },
          {
            title: "Occult Correspondence",
            body:
              "In the Western esoteric tradition the Great Work — the magnum opus — is the transmutation of lead into gold, understood symbolically as the refinement of consciousness through nigredo, albedo, citrinitas, and rubedo. Aureon is engineered as a four-stage reasoning pipeline (plan → critique → refine → execute) that mirrors that same alchemical sequence in software: ingest the raw query, blacken it (criticize it), whiten it (clean and structure it), then deliver gold.",
          },
          {
            title: "What It Actually Runs",
            body:
              "Aureon is the chat engine, the Aureon IDE, the Persona system, Conversation Branching, the Memory Center, the multi-model Consensus pipeline, and the BYOK router. It is the model your users will name when they describe 'talking to Aureon'. Everything user-facing in the consumer / business product flows through this brain.",
          },
        ]}
        capabilities={[
          { icon: MessageSquare, label: "Uncensored Reasoning", body: "No corporate safety wrappers, no refusals, no apologetic filler. Built to behave like a senior analyst, not a help-desk script." },
          { icon: Brain, label: "Multi-Pass Refinement", body: "Hidden plan → critique → refine → execute loop runs before any token reaches the user. Code compiles. Arguments hold." },
          { icon: Layers, label: "Persistent Memory", body: "Aureon carries project context, decisions, user preferences, and personas across sessions — not just within a single chat." },
        ]}
      />

      {/* ─── ASHER ─── */}
      <ModelSection
        eyebrow="Military Intelligence — In Development"
        name="ASHER"
        tagline="Our forthcoming model purpose-built for defense, intelligence services, and military command. Asher is being trained for restricted, audited deployment — not for the public web."
        status="In active development"
        diagramTitle="Asher — Defense Intelligence Architecture"
        diagramCore="ASHER"
        diagramSub="DEFENSE"
        diagramAccent="hsl(15, 75%, 55%)"
        diagramNodes={[
          { id: "s1", x: 140, y: 90, label: "Theater Brief", sub: "Multi-source" },
          { id: "s2", x: 660, y: 90, label: "Targeting Aid", sub: "Decision support" },
          { id: "s3", x: 80, y: 230, label: "SIGINT Fusion", sub: "Stream merge" },
          { id: "s4", x: 720, y: 230, label: "GEOINT Layer", sub: "Geo + temporal" },
          { id: "s5", x: 220, y: 340, label: "Doctrine Recall", sub: "Field manuals" },
          { id: "s6", x: 580, y: 340, label: "Audit Vault", sub: "Chain of custody" },
        ]}
        meaning={[
          {
            title: "The Name",
            body:
              "Asher is taken from the eighth son of Jacob in the Hebrew Bible and the tribe that bears his name. The Hebrew root אָשַׁר means 'happy', 'fortunate', or — in older readings — 'one who walks straight'. The Blessing of Jacob in Genesis 49 says of Asher: 'his bread shall be fat, and he shall yield royal dainties' — a tribe placed on the frontier and tasked with provisioning. The model carries that posture: positioned forward, supplying the line.",
          },
          {
            title: "Why We Chose It",
            body:
              "Military intelligence work is not chat. It is bread, water, ammunition, and timing. We chose a name from a frontier tribe known for provisioning rather than from a warrior or a destroyer. Asher's job is not to fight — it is to make sure the people who fight have what they need, when they need it, with the right map in front of them.",
          },
          {
            title: "Occult Correspondence",
            body:
              "Within the kabbalistic mapping of the twelve tribes onto the zodiac, Asher is associated with Libra — the scales — and with the virtue of weighed judgment. Libra in the Western esoteric tradition is the seat of Tiphareth's lower reflection: the place where competing claims are measured before action is taken. The Asher model is being built around that exact discipline: every output must be weighed, sourced, and signed before it is allowed to leave the system.",
          },
          {
            title: "Intended Mission",
            body:
              "Asher is being built for use by defense and intelligence services — theater-level briefing synthesis, SIGINT and GEOINT fusion, doctrinal recall against current field manuals, decision-support for command staff, and a tamper-evident audit vault on every output. It is not, and will not be, available on the consumer plans.",
          },
        ]}
        capabilities={[
          { icon: Shield, label: "Audited By Default", body: "Every prompt, source, and output is hashed and chain-of-custody logged. Nothing leaves the model without a signature an inspector general can read." },
          { icon: Crosshair, label: "Multi-Domain Fusion", body: "Designed to merge OSINT, SIGINT, GEOINT, and HUMINT feeds into a single weighted picture — the analyst sees one map, not five tabs." },
          { icon: Sparkles, label: "Doctrine-Aware", body: "Trained against current doctrine, ROE constraints, and field manuals so recommendations land inside the rules the user is already required to follow." },
        ]}
      />

      {/* CTA */}
      <section className="relative z-10 px-6 py-24 text-center">
        <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-4">
          Three models. One company.
        </h2>
        <p className="text-sm font-extralight text-muted-foreground mb-8 max-w-xl mx-auto">
          Zophiel sees. Aureon refines. Asher weighs. Together they make up the
          intelligence stack we ship.
        </p>
        <Link
          to="/pricing"
          className="group inline-flex items-center gap-2 rounded-xl bg-foreground px-8 py-3 text-sm font-light tracking-wide text-background transition-all hover:bg-foreground/90"
        >
          View Plans <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </section>

      <footer className="relative z-10 border-t border-border/10 py-8 text-center">
        <p className="text-xs font-extralight text-muted-foreground/50">
          © {new Date().getFullYear()} Aureon. All rights reserved.
        </p>
      </footer>
    </LandingBackground>
  );
};

export default LLMModels;
