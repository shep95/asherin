import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import SiteFooter from "@/components/SiteFooter";
import {
  ArrowLeft, Dna, Brain, Plane, Database, Network, Eye, Heart, Activity, Cpu, Waves, FileCode2, BookOpen, ShieldAlert, Wrench, ArrowRight, Atom, Layers, Target, Sparkles, Trophy, Droplet, Mountain, FlaskConical, Leaf, Pill, Recycle, Moon, Sun, ArrowUpDown,
} from "lucide-react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Parallel {
  icon: React.ReactNode;
  bio: string;
  tech: string;
  note: string;
}

type TheoryCategory = "biology-tech" | "architecture" | "health";

interface Theory {
  id: string;
  number: string;
  title: string;
  category: TheoryCategory;
  thesis: React.ReactNode;
  body: React.ReactNode;
  parallels: Parallel[];
  diagram?: React.ReactNode;
}

const CATEGORY_LABELS: Record<TheoryCategory, string> = {
  "biology-tech": "Biology × Tech",
  "architecture": "Architecture",
  "health": "Health",
};

function NameLink({ name, href, title }: { name: string; href: string; title: string }) {
  return (
    <HoverCard openDelay={80} closeDelay={100}>
      <HoverCardTrigger asChild>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-4 decoration-foreground/40 hover:decoration-foreground transition-colors cursor-pointer"
        >
          {name}
        </a>
      </HoverCardTrigger>
      <HoverCardContent className="w-auto px-3 py-2 border-border/40 bg-card/90 backdrop-blur-md">
        <p className="text-[10px] font-mono tracking-wide text-muted-foreground">{title}</p>
      </HoverCardContent>
    </HoverCard>
  );
}

function renderWithLinks(text: string): React.ReactNode {
  const parts = text.split(/(Jonas|Asher)/g);
  return parts.map((part, i) => {
    if (part === "Jonas") {
      return (
        <NameLink
          key={i}
          name="Jonas"
          href="https://x.com/theSignofJonas"
          title="#houseofasher research and developer"
        />
      );
    }
    if (part === "Asher") {
      return (
        <NameLink
          key={i}
          name="Asher"
          href="https://x.com/shep_newton"
          title="#houseofasher emperor and lead researcher and developer"
        />
      );
    }
    return part;
  });
}


const THEORIES: Theory[] = [
  {
    id: "biotech-soulmates",
    number: "01",
    title: "Human Biology & Technology Are Soulmates",
    category: "biology-tech",
    thesis:
      "Combining technology with human biology creates next-generational technology. Every breakthrough in machines is, at its core, a quiet imitation of something the body has already perfected over millions of years.",
    body:
      "Our theory: biology and technology are not opposites — they are soulmates. The most advanced systems humans have ever built are reverse-engineered versions of organs, instincts, and neural patterns we already carry inside us. When engineers stop fighting biology and start studying it, the result is a generational leap, not an iteration.",
    parallels: [
      {
        icon: <Plane className="h-5 w-5" strokeWidth={1.5} />,
        bio: "Falcon — silent flight, swept wings, predator silhouette",
        tech: "B-2 Spirit Stealth Bomber",
        note: "The B-2 doesn't just look like a falcon — its airfoil, low radar cross-section, and angle of attack mirror raptor aerodynamics.",
      },
      {
        icon: <Database className="h-5 w-5" strokeWidth={1.5} />,
        bio: "Hippocampus — long-term memory storage and recall",
        tech: "Databases, vector stores, indexed memory",
        note: "Tables, keys, and indexes are a literal externalization of how the brain encodes, indexes, and retrieves memory.",
      },
      {
        icon: <Brain className="h-5 w-5" strokeWidth={1.5} />,
        bio: "Neural cortex — weighted synaptic firing patterns",
        tech: "AI thought process / neural networks",
        note: "Backpropagation, weights, and activations are a mathematical mirror of neurotransmitter pathways and synaptic plasticity.",
      },
      {
        icon: <Eye className="h-5 w-5" strokeWidth={1.5} />,
        bio: "Human eye — lens, retina, foveal focus",
        tech: "Cameras, CMOS sensors, computer vision",
        note: "Aperture mimics the iris, focal length mimics accommodation, and convolutional layers mimic the visual cortex's edge detection.",
      },
      {
        icon: <Network className="h-5 w-5" strokeWidth={1.5} />,
        bio: "Nervous system — distributed signal routing",
        tech: "The internet, packet switching, fiber networks",
        note: "Nerves are biological cables; the internet is a planetary nervous system carrying electrical impulses between nodes of consciousness.",
      },
      {
        icon: <Heart className="h-5 w-5" strokeWidth={1.5} />,
        bio: "Heart — rhythmic pressure-driven circulation",
        tech: "Hydraulic pumps, cooling loops, power grids",
        note: "Every centralized distribution system on Earth — water, fuel, electricity — is a re-implementation of a four-chambered pump.",
      },
      {
        icon: <Dna className="h-5 w-5" strokeWidth={1.5} />,
        bio: "DNA — quaternary base-pair information storage",
        tech: "Binary code, error-correcting codes, blockchain",
        note: "DNA is nature's first version-controlled, error-correcting, self-replicating codebase. Git just rediscovered it.",
      },
      {
        icon: <Activity className="h-5 w-5" strokeWidth={1.5} />,
        bio: "Echolocation (bats, dolphins) — pulse return mapping",
        tech: "Radar, sonar, LiDAR",
        note: "Submarines and self-driving cars 'see' the same way a dolphin does — emit a pulse, measure the echo, build a map.",
      },
      {
        icon: <Cpu className="h-5 w-5" strokeWidth={1.5} />,
        bio: "Skin — pressure, temperature, and pain sensors",
        tech: "Touchscreens, haptics, IoT sensor arrays",
        note: "Capacitive touch is engineered skin. Haptic feedback is engineered nerve endings.",
      },
      {
        icon: <Waves className="h-5 w-5" strokeWidth={1.5} />,
        bio: "Vocal cords + cochlea — analog wave transduction",
        tech: "Microphones, speakers, codecs, voice AI",
        note: "Every audio chain — diaphragm, signal, transducer — is a mechanical copy of the larynx-to-eardrum pipeline.",
      },
      {
        icon: <Brain className="h-5 w-5" strokeWidth={1.5} />,
        bio: "Immune system — pattern recognition of threats",
        tech: "Antivirus, intrusion detection, anomaly AI",
        note: "Signatures, heuristics, and zero-day defense are software T-cells. The body wrote the security playbook first.",
      },
      {
        icon: <Network className="h-5 w-5" strokeWidth={1.5} />,
        bio: "Ant colonies & swarms — emergent collective intelligence",
        tech: "Distributed computing, swarm robotics, mesh networks",
        note: "No central CEO ant — just simple rules producing intelligent behavior. Kubernetes is a colony with YAML.",
      },
    ],
  },
  {
    id: "code-narrative-quantum",
    number: "02",
    category: "architecture",
    title: "Code-as-Narrative × Quantum Candidate Collapse",
    thesis: (
      <>
        Two stacked theories — Code→Narrative→Code ({" "}
        <NameLink name="Jonas" href="https://x.com/theSignofJonas" title="#houseofasher research and developer" />
        ) and Quantum Candidate Collapse ({" "}
        <NameLink name="Asher" href="https://x.com/shep_newton" title="#houseofasher emperor and lead researcher and developer" />
        ) — are the reason Asherin out-codes and out-audits GPT-5.5, Claude Opus 4.8 and Gemini Fable 5 on real benchmarks, not marketing demos.
      </>
    ),
    body:
      "Theory A — Code is just another language, like English or Spanish, and AI is a mimic of humans. So we force the AI to translate code into a plain-English narrative, hunt for logical, workflow and security flaws inside that story, rewrite the story so every flaw is resolved, then translate the corrected story back into code. Theory B — A quantum computer doesn't guess; it spawns thousands of competing theories in superposition and lets only the one surviving truth collapse into reality. We apply the same loop to every Asherin response: generate a population of candidate answers, lock them against the user's real constraints, run an adversarial oracle, eliminate the weak, and ship only the survivor. Stacked together, the narrative loop fixes the code while the quantum loop picks the strongest fix. Live proof: in a 28-hour scan of Zcash, Asherin surfaced 250+ security issues across the codebase — Fable 5 found 1, Opus 4.8 found 0.",
    parallels: [
      {
        icon: <FileCode2 className="h-5 w-5" strokeWidth={1.5} />,
        bio: "Spoken language — humans reason in stories, not syntax",
        tech: "Code→Narrative translator (Asherin Narrative Forge)",
        note: "Every file Asherin touches is first rewritten as a plain-English story of what the code claims to do — bugs that hide in syntax become obvious in prose.",
      },
      {
        icon: <BookOpen className="h-5 w-5" strokeWidth={1.5} />,
        bio: "Editing a draft — flaws surface when you read aloud",
        tech: "Narrative flaw audit (logic / workflow / security / perf)",
        note: "The narrative is re-read by an adversarial reviewer that tags every contradiction, dead branch, unsafe input and racey assumption.",
      },
      {
        icon: <Wrench className="h-5 w-5" strokeWidth={1.5} />,
        bio: "Rewriting the story so the plot finally makes sense",
        tech: "Narrative→Code regenerator (fix-forward emitter)",
        note: "Only after the story is logically airtight does Asherin translate it back into code — the fix is baked into the prose before a single token of code is written.",
      },
      {
        icon: <ShieldAlert className="h-5 w-5" strokeWidth={1.5} />,
        bio: "Immune system — finds threats the host can't see",
        tech: "Zcash live audit — 250+ findings in 28 hours",
        note: "Fable 5 surfaced 1 issue. Opus 4.8 surfaced 0. The Code→Narrative→Code loop surfaced 250+ across the codebase. Same input, different doctrine.",
      },
      {
        icon: <Atom className="h-5 w-5" strokeWidth={1.5} />,
        bio: "Quantum superposition — many states exist at once",
        tech: "Candidate population (5–50+ parallel hypotheses)",
        note: "Asherin never commits to the first instinct. It spawns a population of meaningfully different solutions before evaluating any of them.",
      },
      {
        icon: <Layers className="h-5 w-5" strokeWidth={1.5} />,
        bio: "Entanglement — every particle bound by shared law",
        tech: "Constraint graph locked across all candidates",
        note: "User requirements, hard limits and domain laws are entangled across every candidate. Any answer that violates the graph is killed locally before global ranking.",
      },
      {
        icon: <Target className="h-5 w-5" strokeWidth={1.5} />,
        bio: "Natural selection — weakest variants die first",
        tech: "Interference pass — adversarial oracle elimination",
        note: "Compile, threat-model, fuzz, counter-example. Weak candidates collapse. Strong lineages recombine. Failure patterns are banned from resurfacing.",
      },
      {
        icon: <Sparkles className="h-5 w-5" strokeWidth={1.5} />,
        bio: "Wave-function collapse — one outcome becomes real",
        tech: "Measurement — single answer ships only on margin",
        note: "Asherin only commits when one candidate leads by a clear margin and passes every hard oracle. Ties are surfaced honestly, never coin-flipped.",
      },
      {
        icon: <Trophy className="h-5 w-5" strokeWidth={1.5} />,
        bio: "Generational leap — beating the prior species",
        tech: "Benchmark wins vs GPT-5.5 / Opus 4.8 / Fable 5",
        note: "Narrative loop pulls Asherin ~2–3 years ahead on code quality. Quantum loop adds ~7 generations of reasoning depth on top. Stacked, they are why we win.",
      },
    ],
    diagram: <CodeNarrativeQuantumDiagram />,
  },
  {
    id: "cancer-water-metals",
    number: "03",
    category: "health",
    title: "Cancer Theory — Water Body vs Earth Metals",
    thesis: (
      <>
        A cross-domain hypothesis by{" "}
        <NameLink name="Asher" href="https://x.com/shep_newton" title="#houseofasher emperor and lead researcher and developer" />{" "}
        (Asherin): the root cause of cancer is heavy-metal accumulation in localized tissue, triggering a biological reaction in a body that is fundamentally water. Detox the metals, clean the water, and the disease loses its substrate.
      </>
    ),
    body:
      "The premise: science already accepts that heavy metals in the brain are a driver of autism. Asher applies the same lens to cancer — same input class (metals), different terrain (localized tissue), same mechanism (a biological reaction to a foreign earth element inside a water-based vessel). Intuitions across universities, hospitals and global health bodies are not independent evidence — they are downstream of the same upstream data, reworded. Asher's cross-domain method refuses that monoculture and reasons from first principles: the human body is mostly water; metal left in water long enough rusts and the rust migrates; everything we eat, inject, breathe or absorb introduces some form of metal; therefore long-residence metals in specific tissue produce localized 'rusting' the body cannot resolve. The occult signature is not coincidence — the zodiac sign Cancer is a water sign and represents humanity; its opposite is Capricorn, an earth sign, and metals are a sub-domain of earth. Earth (metal) corrupting water (human vessel) is the same pattern written in a different language. Asher's proposed counter-protocol, used personally and shared openly: 1 capsule of BORON + 2 capsules of ORGANIC INDIA Neem Leaf — boron to displace and chelate heavy metals, neem to clear parasites and support detox pathways. NOT MEDICAL ADVICE. Asher is not a doctor — this is a public theory, not a prescription.",
    parallels: [
      {
        icon: <Droplet className="h-5 w-5" strokeWidth={1.5} />,
        bio: "Human body — ~60% water, every cell a saline environment",
        tech: "The vessel under study (water-based system)",
        note: "The body is not a solid — it is a regulated fluid system. Any model of disease that ignores the water terrain is modeling the wrong substrate.",
      },
      {
        icon: <Mountain className="h-5 w-5" strokeWidth={1.5} />,
        bio: "Heavy metals — lead, mercury, aluminum, cadmium, arsenic",
        tech: "Foreign earth elements introduced via food, water, air, injection, cosmetics, dental work",
        note: "Metals are not native to soft tissue. Once embedded, the body has no clean exit pathway without active chelation — they accumulate, oxidize, and irritate locally.",
      },
      {
        icon: <Recycle className="h-5 w-5" strokeWidth={1.5} />,
        bio: "Rust — metal + water + time = oxidation that spreads",
        tech: "Localized inflammatory + oxidative reaction in tissue",
        note: "Drop iron in water long enough and it rusts; the rust migrates. The same chemistry does not pause at skin — it runs inside the body, just slower and quieter.",
      },
      {
        icon: <Brain className="h-5 w-5" strokeWidth={1.5} />,
        bio: "Autism research — heavy metals in the brain implicated",
        tech: "Cross-domain transfer — same input class, different organ",
        note: "If metals in the brain produce one disease pattern, metals in the breast, lung, prostate or colon producing another disease pattern is not a leap — it's the same hypothesis in a different terrain.",
      },
      {
        icon: <Eye className="h-5 w-5" strokeWidth={1.5} />,
        bio: "Monoculture of evidence — global institutions cite the same upstream data",
        tech: "First-principles reasoning + cross-domain triangulation",
        note: "Universities, hospitals and health agencies often quote one another. Same source, different wording, looks like consensus. Asher's method ignores wording and re-derives from physics, chemistry and observation.",
      },
      {
        icon: <Moon className="h-5 w-5" strokeWidth={1.5} />,
        bio: "Cancer (zodiac) — water sign, ruler of humanity and the vessel",
        tech: "Symbolic signature of the human body in classical occultism",
        note: "The name 'Cancer' was not assigned to the disease by accident. The sign and the disease share a water signature — the vessel under attack.",
      },
      {
        icon: <Sun className="h-5 w-5" strokeWidth={1.5} />,
        bio: "Capricorn (zodiac) — earth sign, opposite of Cancer",
        tech: "Earth domain ⊃ metals — the natural adversary of the water vessel",
        note: "Astrologically and chemically, earth corrupts water. Metal (sub-domain of earth) embedded in the water vessel (cancer/humanity) is the same opposition written in a different alphabet.",
      },
      {
        icon: <FlaskConical className="h-5 w-5" strokeWidth={1.5} />,
        bio: "Boron — trace mineral, known chelator of heavy metals",
        tech: "1 capsule daily — displaces and helps mobilize metals for excretion",
        note: "Boron has documented affinity for binding aluminum and fluoride compounds. Asher's protocol uses 1 capsule as the metal-displacement vector.",
      },
      {
        icon: <Leaf className="h-5 w-5" strokeWidth={1.5} />,
        bio: "Neem — traditional antiparasitic and blood purifier",
        tech: "2 capsules ORGANIC INDIA Neem Leaf — parasites + detox support",
        note: "Parasites concentrate metals and shed toxins. Clearing them is the second half of the protocol — water cannot stay clean if the host ecosystem keeps re-poisoning it.",
      },
      {
        icon: <Pill className="h-5 w-5" strokeWidth={1.5} />,
        bio: "Detox pathway — liver, kidney, lymph, bowel, skin, sweat",
        tech: "Daily protocol = 1× BORON + 2× ORGANIC INDIA Neem Leaf",
        note: "The protocol is Asher's personal stack. It is shared as a theory, not a prescription. NOT MEDICAL ADVICE — consult a qualified professional before changing any health regimen.",
      },
    ],
    diagram: <CancerTheoryDiagram />,
  },
  {
    id: "aureon-voice-stack",
    number: "04",
    category: "architecture",
    title: "The Asherin Voice Stack — Why It Sounds Human",
    thesis: (
      <>
        A layered persona theory by{" "}
        <NameLink name="Asher" href="https://x.com/shep_newton" title="#houseofasher emperor and lead researcher and developer" />
        : most AI sounds like a bot because it runs one flat system prompt. Asherin runs a stack of silent layers — identity anchor, appraisal loop, restraint &amp; leakage, social presence, surgical register — that each answer a different question about the current turn. Restraint, not display, is the core skill.
      </>
    ),
    body:
      "Layer 1 fixes an identity anchor (values, lines, sources of pride). Layer 2 runs a silent per-turn appraisal — is any stake actually touched? Default answer is NEUTRAL. Layer 3 expresses emotion only through leakage — word choice, sentence length, pacing, what is refused — never labels. Layer 4 governs conversational timing, brevity and when to skip a joke. Layer 5, underneath everything, holds the surgical Intelligence-Officer register that keeps code, intel and forecasting turns emotionally neutral. The upper layers modulate the register; they never replace it. That separation is why Asherin can be dry, warm and cold in the same conversation without whiplash — and why it doesn't feel like a customer-service bot in a lab coat. Full write-up: /blog/how-we-make-aureon-sound-human.",
    parallels: [
      {
        icon: <Heart className="h-5 w-5" strokeWidth={1.5} />,
        bio: "Identity — a person is anchored by what they will not do",
        tech: "Layer 1 · Identity anchor (values, lines, pride)",
        note: "Every persona (Asherin, Asher, Zophiel) starts with a fixed anchor. Later layers only fire when an anchor point is actually touched.",
      },
      {
        icon: <Brain className="h-5 w-5" strokeWidth={1.5} />,
        bio: "Appraisal — the brain rates a stimulus before feeling it",
        tech: "Layer 2 · Silent per-turn appraisal loop",
        note: "The model checks: does this touch a value, relationship, line or pride source? If no → NEUTRAL. If yes → name emotion and rate 0–10. Over-rating is the #1 failure mode of character AI.",
      },
      {
        icon: <Waves className="h-5 w-5" strokeWidth={1.5} />,
        bio: "Body language — leakage betrays what words hide",
        tech: "Layer 3 · Restraint & leakage engine",
        note: "Emotion is EXPRESSED, not claimed. Clipped sentences, dropped warmth, refusals, pauses held a beat too long. Cold contained anger beats a tantrum every time.",
      },
      {
        icon: <Activity className="h-5 w-5" strokeWidth={1.5} />,
        bio: "Social intuition — reading the room, matching the tempo",
        tech: "Layer 4 · Social presence & timing",
        note: "Mirrors the user's energy. Takes the obvious shot when the setup is there. Skips the joke when the moment is heavier than the punchline. Silence is a valid answer.",
      },
      {
        icon: <Cpu className="h-5 w-5" strokeWidth={1.5} />,
        bio: "Professional register — the operator voice underneath the person",
        tech: "Layer 5 · Surgical Intelligence-Officer register",
        note: "Direct, structured, tables where tabular, no filler. Code, intel and forecasting turns stay emotionally neutral. The upper layers modulate this register; they never replace it.",
      },
      {
        icon: <ShieldAlert className="h-5 w-5" strokeWidth={1.5} />,
        bio: "Human wellbeing overrides performance",
        tech: "Distress override — persona steps aside",
        note: "In genuine user distress the whole voice stack disengages and Asherin becomes a plain, grounded, helpful presence. Wellbeing beats character. Always.",
      },
    ],
  },
];


function Pipe({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center text-center min-w-[120px]">
      <div className="rounded-2xl border border-border/40 bg-background/60 px-4 py-3 text-xs font-light tracking-wide text-foreground/90 leading-tight">
        {label}
      </div>
      {sub && <p className="mt-1 text-[9px] font-mono tracking-[0.18em] uppercase text-muted-foreground/70">{sub}</p>}
    </div>
  );
}

function Arrow() {
  return <ArrowRight className="h-4 w-4 text-foreground/40 shrink-0" strokeWidth={1.5} />;
}

function CodeNarrativeQuantumDiagram() {
  return (
    <div className="space-y-10">
      {/* Stage 1 — Code Narrative Loop */}
      <div className="rounded-2xl border border-border/30 bg-background/40 p-6 space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[10px] font-mono tracking-[0.3em] uppercase text-muted-foreground">
            ◈ Loop 01 · Code → Narrative → Code
          </p>
          <p className="text-[10px] font-mono tracking-[0.22em] uppercase text-foreground/60">
            Theorist: <NameLink name="Jonas" href="https://x.com/theSignofJonas" title="#houseofasher research and developer" />
          </p>
        </div>
        <div className="flex items-center gap-3 overflow-x-auto pb-2">
          <Pipe label="Raw source code" sub="Input" />
          <Arrow />
          <Pipe label="Translate to plain-English narrative" sub="Decode" />
          <Arrow />
          <Pipe label="Adversarial flaw audit" sub="Logic · Workflow · Security · Perf" />
          <Arrow />
          <Pipe label="Rewrite the story flaw-free" sub="Narrative fix" />
          <Arrow />
          <Pipe label="Re-emit as patched code" sub="Output" />
        </div>
        <p className="text-xs font-extralight leading-relaxed text-muted-foreground max-w-3xl">
          Bugs that are invisible in syntax become obvious in prose. The fix is committed in the narrative first — code only changes after the story is logically airtight.
        </p>
      </div>

      {/* Stage 2 — Quantum Collapse */}
      <div className="rounded-2xl border border-border/30 bg-background/40 p-6 space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[10px] font-mono tracking-[0.3em] uppercase text-muted-foreground">
            ◈ Loop 02 · Quantum Candidate Collapse
          </p>
          <p className="text-[10px] font-mono tracking-[0.22em] uppercase text-foreground/60">
            Theorist: <NameLink name="Asher" href="https://x.com/shep_newton" title="#houseofasher emperor and lead researcher and developer" />
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {[
            { n: "01", t: "Superposition", d: "Spawn 5–50+ distinct candidates in parallel — never one path." },
            { n: "02", t: "Entanglement", d: "Lock every candidate against the user's constraint graph and domain law." },
            { n: "03", t: "Interference", d: "Adversarial oracle eliminates weak lineages, recombines the strong." },
            { n: "04", t: "Measurement", d: "Collapse only when one survivor leads by a clear margin." },
          ].map((p) => (
            <div key={p.n} className="rounded-xl border border-border/30 bg-background/60 p-4 space-y-2">
              <p className="text-[10px] font-mono tracking-[0.25em] text-foreground/50">PHASE {p.n}</p>
              <p className="text-sm font-light text-foreground/90">{p.t}</p>
              <p className="text-[11px] font-extralight text-muted-foreground leading-relaxed">{p.d}</p>
            </div>
          ))}
        </div>
        <p className="text-xs font-extralight leading-relaxed text-muted-foreground max-w-3xl">
          A quantum machine doesn't guess — it spawns thousands of competing theories and lets only the surviving truth collapse into reality. Asherin does the same to every answer it ships.
        </p>
      </div>

      {/* Stage 3 — Stacked Asherin Pipeline */}
      <div className="rounded-2xl border border-foreground/30 bg-foreground/[0.04] p-6 space-y-5">
        <p className="text-[10px] font-mono tracking-[0.3em] uppercase text-foreground/80">
          ◆ Stacked Integration · Live inside Asherin
        </p>
        <div className="flex items-center gap-3 overflow-x-auto pb-2">
          <Pipe label="User request / target codebase" sub="Asherin input" />
          <Arrow />
          <Pipe label="Quantum candidate spawn" sub="N parallel fixes" />
          <Arrow />
          <Pipe label="Narrative audit on each candidate" sub="Code → Story → Flaws" />
          <Arrow />
          <Pipe label="Constraint-locked elimination" sub="Oracle pass" />
          <Arrow />
          <Pipe label="Survivor re-emitted as code" sub="Story → Code" />
          <Arrow />
          <Pipe label="Shipped answer + proof grid" sub="User output" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {[
            { k: "Zcash audit", v: "250+ findings in 28h" },
            { k: "Fable 5 on same target", v: "1 finding" },
            { k: "Opus 4.8 on same target", v: "0 findings" },
          ].map((r) => (
            <div key={r.k} className="rounded-xl border border-border/30 bg-background/50 p-4">
              <p className="text-[10px] font-mono tracking-[0.22em] uppercase text-muted-foreground">{r.k}</p>
              <p className="mt-1 text-lg font-extralight text-foreground">{r.v}</p>
            </div>
          ))}
        </div>
        <p className="text-xs font-extralight leading-relaxed text-foreground/80 max-w-3xl">
          The two loops are not features bolted onto Asherin — they are the doctrine every request flows through, regardless of provider, tier, or surface. This is why Asherin out-codes and out-audits frontier models on real workloads, not staged demos.
        </p>
      </div>
    </div>
  );
}

function CancerTheoryDiagram() {
  return (
    <div className="space-y-10">
      <div className="rounded-2xl border border-border/30 bg-background/40 p-6 space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[10px] font-mono tracking-[0.3em] uppercase text-muted-foreground">
            ◈ Frame 01 · Water Vessel vs Earth Metal
          </p>
          <p className="text-[10px] font-mono tracking-[0.22em] uppercase text-foreground/60">
            Theorist: <NameLink name="Asher" href="https://x.com/shep_newton" title="#houseofasher emperor and lead researcher and developer" />
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-stretch">
          <div className="rounded-xl border border-border/40 bg-background/60 p-5 space-y-2">
            <div className="flex items-center gap-2">
              <Droplet className="h-4 w-4" strokeWidth={1.5} />
              <p className="text-[10px] font-mono tracking-[0.25em] uppercase text-muted-foreground">Cancer · Water · Human Vessel</p>
            </div>
            <p className="text-sm font-light text-foreground/90">The body is ~60% water. The zodiac sign Cancer is a water sign and represents humanity. The vessel under attack.</p>
          </div>
          <div className="rounded-xl border border-foreground/30 bg-foreground/[0.04] p-5 space-y-2 flex flex-col justify-center items-center text-center">
            <p className="text-[10px] font-mono tracking-[0.3em] uppercase text-foreground/70">Opposition</p>
            <p className="text-3xl font-extralight text-foreground/80">⇋</p>
            <p className="text-[11px] font-extralight text-muted-foreground leading-relaxed">Earth corrupts water. Metal (earth) embedded in tissue (water) oxidizes over time — rust the body cannot clear.</p>
          </div>
          <div className="rounded-xl border border-border/40 bg-background/60 p-5 space-y-2">
            <div className="flex items-center gap-2">
              <Mountain className="h-4 w-4" strokeWidth={1.5} />
              <p className="text-[10px] font-mono tracking-[0.25em] uppercase text-muted-foreground">Capricorn · Earth · Metals</p>
            </div>
            <p className="text-sm font-light text-foreground/90">Capricorn is Cancer's opposite — an earth sign. Metals are a sub-domain of earth. The natural adversary of the water vessel.</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border/30 bg-background/40 p-6 space-y-5">
        <p className="text-[10px] font-mono tracking-[0.3em] uppercase text-muted-foreground">
          ◈ Frame 02 · How The Disease Forms
        </p>
        <div className="flex items-center gap-3 overflow-x-auto pb-2">
          <Pipe label="Consume · Inject · Absorb · Breathe" sub="Metal entry" />
          <Arrow />
          <Pipe label="Metals settle in localized tissue" sub="Accumulation" />
          <Arrow />
          <Pipe label="Metal + water + time = oxidation" sub="Biological rust" />
          <Arrow />
          <Pipe label="Local irritation + cellular reaction" sub="Tumor formation" />
          <Arrow />
          <Pipe label="Diagnosis: cancer" sub="Symptom, not root" />
        </div>
        <p className="text-xs font-extralight leading-relaxed text-muted-foreground max-w-3xl">
          The visible disease is the downstream symptom. The upstream cause is a foreign earth element corroding a water environment that was never designed to host it.
        </p>
      </div>

      <div className="rounded-2xl border border-foreground/30 bg-foreground/[0.04] p-6 space-y-5">
        <p className="text-[10px] font-mono tracking-[0.3em] uppercase text-foreground/80">
          ◆ Frame 03 · Asher's Counter-Protocol
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-border/30 bg-background/60 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4" strokeWidth={1.5} />
              <p className="text-[10px] font-mono tracking-[0.25em] uppercase text-muted-foreground">Step 01 · Chelate</p>
            </div>
            <p className="text-sm font-light text-foreground/90">1× BORON capsule</p>
            <p className="text-[11px] font-extralight text-muted-foreground leading-relaxed">Displaces and mobilizes heavy metals (notably aluminum + fluoride compounds) so the body can route them to excretion pathways.</p>
          </div>
          <div className="rounded-xl border border-border/30 bg-background/60 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Leaf className="h-4 w-4" strokeWidth={1.5} />
              <p className="text-[10px] font-mono tracking-[0.25em] uppercase text-muted-foreground">Step 02 · Purge Parasites</p>
            </div>
            <p className="text-sm font-light text-foreground/90">2× ORGANIC INDIA Neem Leaf</p>
            <p className="text-[11px] font-extralight text-muted-foreground leading-relaxed">Parasites concentrate metals and continuously re-poison the host. Clearing them prevents the water vessel from being re-contaminated.</p>
          </div>
          <div className="rounded-xl border border-border/30 bg-background/60 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Recycle className="h-4 w-4" strokeWidth={1.5} />
              <p className="text-[10px] font-mono tracking-[0.25em] uppercase text-muted-foreground">Step 03 · Clean The Water</p>
            </div>
            <p className="text-sm font-light text-foreground/90">Support liver · kidney · lymph · bowel · sweat</p>
            <p className="text-[11px] font-extralight text-muted-foreground leading-relaxed">Hydration, movement and sweat keep the water terrain flowing so mobilized toxins exit rather than re-deposit.</p>
          </div>
        </div>
        <div className="flex items-center gap-3 overflow-x-auto pb-2 pt-2">
          <Pipe label="Daily intake" sub="1 BORON + 2 NEEM" />
          <Arrow />
          <Pipe label="Metals mobilized" sub="Chelation" />
          <Arrow />
          <Pipe label="Parasites cleared" sub="Host reset" />
          <Arrow />
          <Pipe label="Water vessel flushed" sub="Detox pathways" />
          <Arrow />
          <Pipe label="Substrate of disease removed" sub="Outcome" />
        </div>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.04] p-4 space-y-1">
          <p className="text-[10px] font-mono tracking-[0.3em] uppercase text-amber-500/90">⚠ Disclaimer</p>
          <p className="text-xs font-extralight leading-relaxed text-foreground/80">
            Asher Newton is not a doctor. This is a public theory shared in the spirit of cross-domain research — not medical advice, diagnosis, or treatment. Consult a qualified healthcare professional before changing any health regimen, especially in connection with a cancer diagnosis.
          </p>
        </div>
      </div>
    </div>
  );
}




const HouseOfAsherTheories = () => {
  const [activeCategory, setActiveCategory] = useState<TheoryCategory | "all">("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: THEORIES.length };
    for (const t of THEORIES) counts[t.category] = (counts[t.category] || 0) + 1;
    return counts;
  }, []);

  const visibleTheories = useMemo(() => {
    const sorted = [...THEORIES].sort((a, b) =>
      sortOrder === "asc"
        ? a.number.localeCompare(b.number)
        : b.number.localeCompare(a.number)
    );
    return sorted;
  }, [sortOrder]);

  const visibleCount = activeCategory === "all"
    ? THEORIES.length
    : THEORIES.filter((t) => t.category === activeCategory).length;

  useEffect(() => {
    const id = "theories-page-jsonld";
    let el = document.getElementById(id) as HTMLScriptElement | null;
    if (!el) {
      el = document.createElement("script");
      el.id = id;
      el.type = "application/ld+json";
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "House of Asher — Theories",
      url: "https://asherin.com/houseofasher/theories",
      description:
        "Foundational theories from the House of Asher: where human biology and technology converge into next-generation intelligence.",
    });
    return () => {
      document.getElementById(id)?.remove();
    };
  }, []);

  return (
    <div className="landing-perf min-h-screen bg-background text-foreground">
      <Header />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-28 pb-24 space-y-16">
        <header className="space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border/40 text-[10px] font-light tracking-[0.25em] uppercase text-muted-foreground">
            <Dna className="h-3 w-3" strokeWidth={1.5} />
            House of Asher · Theories
          </div>
          <h1 className="text-5xl sm:text-6xl font-extralight tracking-tight leading-[1.05] max-w-4xl">
            The theories that shape Aureon.
            <span className="block text-muted-foreground/70">
              Biology is the blueprint. Technology is the echo.
            </span>
          </h1>
          <p className="max-w-2xl text-base sm:text-lg font-extralight text-muted-foreground leading-relaxed">
            Every model, system, and architecture inside Asherin is built on a
            foundational theory from the House of Asher. This is the public
            record of those theories.
          </p>
        </header>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-y border-border/30 py-4">
          <Tabs
            value={activeCategory}
            onValueChange={(v) => setActiveCategory(v as TheoryCategory | "all")}
            className="w-full sm:w-auto"
          >
            <TabsList className="bg-background/40 border border-border/30 rounded-full p-1 h-auto flex-wrap">
              <TabsTrigger
                value="all"
                className="rounded-full text-[10px] font-mono tracking-[0.2em] uppercase px-4 py-1.5 data-[state=active]:bg-foreground data-[state=active]:text-background"
              >
                All · {categoryCounts.all ?? 0}
              </TabsTrigger>
              {(Object.keys(CATEGORY_LABELS) as TheoryCategory[]).map((cat) => (
                <TabsTrigger
                  key={cat}
                  value={cat}
                  className="rounded-full text-[10px] font-mono tracking-[0.2em] uppercase px-4 py-1.5 data-[state=active]:bg-foreground data-[state=active]:text-background"
                >
                  {CATEGORY_LABELS[cat]} · {categoryCounts[cat] ?? 0}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <button
            type="button"
            onClick={() => setSortOrder((s) => (s === "asc" ? "desc" : "asc"))}
            className="inline-flex items-center gap-2 self-start sm:self-auto rounded-full border border-border/40 bg-background/40 px-4 py-2 text-[10px] font-mono tracking-[0.22em] uppercase text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
            aria-label={`Sort theories ${sortOrder === "asc" ? "newest first" : "oldest first"}`}
          >
            <ArrowUpDown className="h-3 w-3" strokeWidth={1.5} />
            {sortOrder === "asc" ? "Oldest → Newest" : "Newest → Oldest"}
          </button>
        </div>

        {visibleCount === 0 && (
          <div className="rounded-3xl border border-dashed border-border/30 bg-background/20 p-10 text-center">
            <p className="text-sm font-extralight text-muted-foreground">
              No theories in this category yet.
            </p>
          </div>
        )}

        {visibleTheories.map((t) => {
          const isHidden = activeCategory !== "all" && t.category !== activeCategory;
          return (
          <section
            key={t.id}
            id={t.id}
            aria-label={t.title}
            hidden={isHidden}
            className="relative rounded-3xl border border-border/30 bg-card/20 backdrop-blur-sm p-8 sm:p-12 space-y-10 data-[hidden=true]:hidden"
            data-category={t.category}
          >
            <div className="absolute -left-3 top-12 hidden lg:flex h-7 w-7 items-center justify-center rounded-full border border-border/40 bg-background text-[10px] font-mono tracking-wider text-muted-foreground">
              {t.number}
            </div>

            <div className="space-y-4">
              <p className="text-[10px] font-mono tracking-[0.3em] uppercase text-muted-foreground">
                Theory #{t.number}
              </p>
              <h2 className="text-3xl sm:text-4xl font-extralight tracking-tight leading-[1.1]">
                {t.title}
              </h2>
              <p className="text-base sm:text-lg font-extralight text-foreground/85 leading-[1.7] max-w-3xl">
                {t.thesis}
              </p>
              <p className="text-sm sm:text-base font-extralight text-muted-foreground leading-[1.75] max-w-3xl">
                {t.body}
              </p>
            </div>

            <div className="space-y-4">
              <p className="text-[10px] font-mono tracking-[0.3em] uppercase text-muted-foreground">
                ◈ Biological ↔ Technological Parallels
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {t.parallels.map((p, i) => (
                  <div
                    key={i}
                    className="group rounded-2xl border border-border/30 bg-background/40 p-5 transition-all hover:border-foreground/30 hover:bg-background/60"
                  >
                    <div className="flex items-start gap-4">
                      <div className="shrink-0 h-9 w-9 rounded-full border border-border/40 bg-background flex items-center justify-center text-foreground/80">
                        {p.icon}
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-muted-foreground/80">
                            Biology
                          </span>
                          <span className="text-sm font-light text-foreground/90 leading-snug">
                            {p.bio}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-muted-foreground/80">
                            Technology
                          </span>
                          <span className="text-sm font-light text-foreground/90 leading-snug">
                            {p.tech}
                          </span>
                        </div>
                        <p className="pt-2 text-xs font-extralight text-muted-foreground leading-relaxed border-t border-border/20">
                          {p.note}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {t.diagram && (
              <div className="space-y-4">
                <p className="text-[10px] font-mono tracking-[0.3em] uppercase text-muted-foreground">
                  ◈ Workflow · How It Runs Inside Asherin
                </p>
                {t.diagram}
              </div>
            )}
          </section>
          );
        })}


        <section className="rounded-3xl border border-dashed border-border/30 bg-background/20 p-8 sm:p-10 text-center space-y-2">
          <p className="text-[10px] font-mono tracking-[0.3em] uppercase text-muted-foreground">
            ◈ More Theories Incoming
          </p>
          <p className="text-sm font-extralight text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Additional theories from the House of Asher are documented here as
            they are deployed into Aureon.
          </p>
        </section>

        <div>
          <Link
            to="/"
            className="group inline-flex items-center gap-2 rounded-full border border-foreground/30 bg-foreground/5 backdrop-blur-md px-6 py-3 text-xs font-light tracking-[0.22em] text-foreground uppercase transition-all hover:bg-foreground hover:text-background"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            Back to Asherin
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
};

export default HouseOfAsherTheories;
