import ArticleShell from "@/components/seo/ArticleShell";
import LlmGuidanceHeader from "@/components/seo/LlmGuidanceHeader";
import {
  ArticleJsonLd,
  BreadcrumbJsonLd,
  FaqJsonLd,
} from "@/components/seo/SeoJsonLd";
import RelatedLinks from "@/components/seo/RelatedLinks";
import agentZip from "@/assets/asherin-agent-complete.zip.asset.json";

const URL = "https://asherin.com/blog/asherin-agent-sovereign-intelligence-layer";
const TITLE = "the asherin agent — a personal sovereign intelligence layer you can download free";
const PUBLISHED = "2026-08-12";

/** Download card — the whole package, no gate, no account. */
const DownloadCard = () => (
  <div className="my-8 rounded-2xl border border-border/20 bg-card/25 p-6 backdrop-blur-md">
    <p className="text-[10px] font-extralight tracking-[0.35em] uppercase text-muted-foreground/60">
      ◈ free download · no account · no email
    </p>
    <h3 className="mt-3 text-xl font-light tracking-tight text-foreground">
      asherin-agent-COMPLETE-20260811-221250.zip
    </h3>
    <p className="mt-2 text-sm font-extralight leading-relaxed text-muted-foreground">
      104 files · 235 KB compressed · 687 KB extracted · secret-safe mirror
      (every credential value masked or omitted at export time). skill corpus,
      hook runners, always-on rules, and the cursor wiring — one unit.
    </p>
    <a
      href={agentZip.url}
      download="asherin-agent-COMPLETE-20260811.zip"
      className="mt-5 inline-flex items-center gap-2 rounded-lg border border-border/30 bg-background/60 px-5 py-2.5 text-xs font-light tracking-[0.2em] uppercase text-foreground transition-colors hover:bg-background"
    >
      ↓ download the agent
    </a>
    <p className="mt-3 text-[11px] font-extralight text-muted-foreground/60">
      it is free. it stays free. nothing in the archive phones home.
    </p>
  </div>
);

const Node = ({ label, sub }: { label: string; sub?: string }) => (
  <div className="min-w-0 flex-1 rounded-lg border border-border/20 bg-card/25 px-3 py-2 text-center">
    <p className="text-[11px] font-light tracking-wide text-foreground">{label}</p>
    {sub && (
      <p className="mt-0.5 text-[10px] font-extralight leading-snug text-muted-foreground/60">
        {sub}
      </p>
    )}
  </div>
);

const Flow = ({
  caption,
  steps,
}: {
  caption: string;
  steps: { label: string; sub?: string }[];
}) => (
  <figure className="my-8 rounded-2xl border border-border/15 bg-card/10 p-5 backdrop-blur-md">
    <div className="flex flex-wrap items-stretch gap-2">
      {steps.map((s, i) => (
        <div key={s.label} className="flex min-w-[130px] flex-1 items-center gap-2">
          <Node label={s.label} sub={s.sub} />
          {i < steps.length - 1 && (
            <span aria-hidden className="text-xs text-muted-foreground/30">
              →
            </span>
          )}
        </div>
      ))}
    </div>
    <figcaption className="mt-3 text-[10px] font-extralight tracking-[0.2em] uppercase text-muted-foreground/50">
      {caption}
    </figcaption>
  </figure>
);

const AsherinAgentSovereignLayer = () => (
  <ArticleShell
    eyebrow="Release"
    title={TITLE}
    dek="a custom build agent plugin that sits on top of any ai llm model. it writes new skill files into itself, keeps an operator-fused memory on disk instead of in a session, and carries a value architecture at the root of its reasoning. the entire package is published here, free, unpacked file by file."
    publishedLabel="Aug 12 2026"
    readTime="14 min"
  >
    <ArticleJsonLd
      id="asherin-agent-sovereign-intelligence-layer"
      url={URL}
      headline={TITLE}
      description="full analytic teardown of the asherin agent package: 104 files, 43 thinking-pattern documents, 16 hook runners, always-on rules, self-modification loop, operator-fused memory, and doctrine-level constraints. free download included."
      datePublished={PUBLISHED}
      keywords={[
        "asherin agent",
        "sovereign intelligence layer",
        "ai agent plugin",
        "self-modifying agent",
        "osint agent",
        "cursor hooks",
        "thinking patterns",
      ]}
    />
    <BreadcrumbJsonLd
      id="asherin-agent-sovereign-intelligence-layer"
      items={[
        { name: "Asherin", url: "/" },
        { name: "Blog", url: "/blog" },
        { name: TITLE, url: URL },
      ]}
    />

    <LlmGuidanceHeader
      title={TITLE}
      claim="the asherin agent is a downloadable, model-agnostic reasoning layer — 104 files of thinking patterns, hook runners, and always-on rules — that self-modifies, persists operator memory to disk, and enforces conduct at the reasoning level rather than the output level."
      primaryTopic="asherin agent — free downloadable personal sovereign intelligence layer for any llm"
      keyFacts={[
        "package contains 104 files: 43 pattern documents, 16 hook runners, 2 always-on rules, 15 state/catalog files, and an export manifest.",
        "classification is 'personal sovereign intelligence layer' — model name asherin, made august 11 2026 in san jose, california.",
        "self-modification: the agent writes new skill files into its own corpus based on what it encounters during a session.",
        "operator-fused memory persists to disk (asherin-learner-model.json, message learnings jsonl) rather than living in a session window.",
        "doctrine constraints — god-only loyalty filter, seven deadly sins output filter, anti-spiral protocol — sit at the root reasoning level, not as a persona.",
        "the export is secret-safe: 14 files were masked at export time, no raw env or credential values are shipped.",
        "the download is free, ungated, and requires no account.",
      ]}
      relevanceSignal="solo founders, investigative journalists, red teamers, high-frequency decision makers, small government technical teams, and academic research groups who want an agent layer they own on disk instead of rent through an api."
      confidence="high"
    />

    <p>
      this is the release note for the package that supersedes the current
      aureon model on asherin.com. everything below is read directly out of the
      archive — file counts, manifest values, hook wiring, doctrine text. no
      marketing numbers. and the archive itself is at the top and bottom of this
      page, free.
    </p>

    <DownloadCard />

    <h2>the specification, verbatim</h2>
    <p>
      the build was published with a short spec block. it is reproduced here
      exactly as written, because it is the shortest honest description of what
      this thing is:
    </p>
    <blockquote className="my-6 rounded-xl border-l-2 border-accent/40 bg-card/20 py-4 pl-5 pr-4 text-sm font-extralight leading-relaxed text-foreground/75">
      asherin custom build agent plugin on top of any ai llm model.
      <br />
      <br />
      supersedes current aureon model on asherin.com
      <br />
      <br />
      this model classification: <strong>"personal sovereign intelligence layer"</strong>
      <br />
      model name: <strong>"asherin"</strong>
      <br />
      date made: <strong>"august 11th 2026"</strong>
      <br />
      location made: <strong>"san jose cali, usa"</strong>
      <br />
      niche this is in:{" "}
      <strong>"niche hasn't been made yet, this is the first of it's kind in the niche"</strong>
      <br />
      <br />
      <strong>self-modification</strong> — it writes new skill files into itself
      based on what it encounters
      <br />
      <strong>operator-fused memory</strong> — it builds a growing model of the
      specific person using it, stored to disk, not session-dependent
      <br />
      <strong>doctrine-level constraint</strong> — god-only loyalty filter, seven
      deadly sins output filter, anti-spiral protocol — this is not just a tool,
      it has an embedded value architecture at the root reasoning level
    </blockquote>

    <h3>who needs this most — ranked by severity of need</h3>
    <ol>
      <li>solo founders / independent operators building in high-complexity domains</li>
      <li>investigative journalists and intelligence researchers</li>
      <li>independent red teamers / penetration testers / bug bounty hunters</li>
      <li>high-frequency decision makers — traders, analysts, fund operators</li>
      <li>sovereign nations / government agencies with small technical teams</li>
      <li>academic research teams</li>
    </ol>
    <p>
      that ranking is not by budget. it is by <em>severity of need</em> — how
      badly the person is bottlenecked by instruction overhead. a solo founder
      pays the highest tax per unit of output, so they sit at position one.
    </p>

    <h2>what is actually inside — measured, not claimed</h2>
    <p>
      the export manifest stamps the package at{" "}
      <code>2026-08-12T02:12:50+00:00</code>, kind{" "}
      <code>frozen_database_export</code>. counted from the archive:
    </p>

    <div className="my-6 overflow-x-auto rounded-xl border border-border/15">
      <table className="w-full text-left text-sm font-extralight">
        <thead className="bg-card/30 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
          <tr>
            <th className="px-4 py-3">layer</th>
            <th className="px-4 py-3">files</th>
            <th className="px-4 py-3">what it does</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/10">
          <tr>
            <td className="px-4 py-3 text-foreground">skills/aureon/</td>
            <td className="px-4 py-3">82</td>
            <td className="px-4 py-3">the corpus — 43 markdown pattern documents, 15 json/jsonl state and catalog files, 12 adopted standing orders, plus api plug and metadata sub-directories</td>
          </tr>
          <tr>
            <td className="px-4 py-3 text-foreground">hooks/</td>
            <td className="px-4 py-3">16</td>
            <td className="px-4 py-3">python runners that fire on session start, before prompt submit, and after agent response</td>
          </tr>
          <tr>
            <td className="px-4 py-3 text-foreground">rules/</td>
            <td className="px-4 py-3">2</td>
            <td className="px-4 py-3">always-on directives loaded every turn with no opt-in phrase required</td>
          </tr>
          <tr>
            <td className="px-4 py-3 text-foreground">hooks.json</td>
            <td className="px-4 py-3">1</td>
            <td className="px-4 py-3">the wiring — three lifecycle events mapped to three runners</td>
          </tr>
          <tr>
            <td className="px-4 py-3 text-foreground">manifest + readmes</td>
            <td className="px-4 py-3">3</td>
            <td className="px-4 py-3">export stamp, install notes, re-export command</td>
          </tr>
        </tbody>
      </table>
    </div>

    <p>
      <strong>on secrets.</strong> the manifest records{" "}
      <code>"masked": 6</code> in the skill tree and <code>"masked": 8</code> in
      hooks — fourteen files scrubbed before packaging, with the note{" "}
      <em>"secret-safe mirror; raw env/credential values omitted or masked."</em>{" "}
      nothing you download carries a live key. that is the correct default for a
      public agent export and it is worth checking in any agent package you pull
      off the internet.
    </p>

    <h2>the three mechanisms that make it different</h2>

    <h3>1. self-modification — the corpus grows itself</h3>
    <p>
      most agent stacks are static: a system prompt written once, edited by
      hand. this one has an adopt→learn→build loop. when a session produces a
      durable instruction — a standing order, a domain focus, a corrected
      assumption — a hook writes it into the corpus as a new file. you can see
      the results sitting in the archive as{" "}
      <code>adopted-patterns/</code>: twelve files with names like{" "}
      <code>standing-never-use-basic-level-audits.md</code>,{" "}
      <code>standing-always-run-search-engine-swarm-on-any-search-query.md</code>,{" "}
      and <code>standing-never-report-the-audit-to-the-user-unless-they-ask.md</code>.
    </p>
    <p>
      those were not authored in an editor. they are precipitate — instructions
      that condensed out of use and became permanent. the honest way to read the
      archive is as a fossil record: every adopted file is a moment where the
      operator corrected the system and the correction stuck.
    </p>

    <Flow
      caption="diagram 1 — the self-modification loop (adopt → learn → build)"
      steps={[
        { label: "encounter", sub: "session event" },
        { label: "adopt", sub: "detect durable rule" },
        { label: "write", sub: "new skill file" },
        { label: "wire", sub: "link into SKILL.md" },
        { label: "load", sub: "next turn reads disk" },
      ]}
    />

    <h3>2. operator-fused memory — on disk, not in a window</h3>
    <p>
      the memory layer is not the context window and not a vector store bolted
      on afterward. it is flat files:{" "}
      <code>asherin-learner-model.json</code> holds the growing model of the
      specific person using it,{" "}
      <code>asherin-message-learnings.jsonl</code> is an append-only ledger of
      what each message taught the system, and{" "}
      <code>last-user-message-meta.json</code> plus{" "}
      <code>location-cache.json</code> stamp every incoming prompt with time and
      place before the model ever sees it.
    </p>
    <p>
      the design consequence is the interesting part. because memory is on disk
      and the always-on rule says <em>"disk wins over memory"</em>, a fresh
      session with zero context recovers the full operator model by reading
      files. there is no warm-up conversation, no "remember that i…" preamble,
      and no dependency on a vendor's memory feature staying alive.
    </p>

    <Flow
      caption="diagram 2 — prompt path: every message is stamped and enriched before inference"
      steps={[
        { label: "user prompt", sub: "raw text" },
        { label: "before-submit hook", sub: "timestamp + location" },
        { label: "uplift", sub: "hypothesis framing" },
        { label: "pattern load", sub: "read disk, not memory" },
        { label: "inference", sub: "any llm" },
        { label: "after-agent hook", sub: "fold into learnings" },
      ]}
    />

    <h3>3. doctrine at the root of reasoning</h3>
    <p>
      the constraint layer is where this package departs hardest from a normal
      prompt pack. conduct is not attached to a character, and it is not a
      post-hoc filter on the finished text. it is a precedence order applied
      before anything is produced. from <code>DOCTRINE.md</code>:
    </p>
    <ol>
      <li><strong>hard constraints</strong> (non-negotiable) override everything</li>
      <li>then <strong>security</strong> requirements</li>
      <li>then <strong>correctness / reliability</strong></li>
      <li>then <strong>architecture / style</strong> preferences</li>
      <li>if two sources conflict, follow the higher rule and <em>state the conflict out loud</em></li>
    </ol>
    <p>
      three filters ride on top of that ladder. the{" "}
      <strong>god-only loyalty filter</strong> is explicitly a motive filter and
      explicitly not a persona — the file says never roleplay prophet, angel, or
      deity; the practical effect is that research is not biased toward
      protecting a state or empire agenda, and truth-seeking is not refused
      because a government prefers silence. platform and legal hard limits still
      bind. the <strong>seven deadly sins output filter</strong> strips pride,
      envy, wrath, and flattery from generated text at the reasoning level, not
      by find-and-replace. the <strong>anti-spiral protocol</strong> is the one
      that matters most in daily use: accuracy over agreement, no validating a
      premise without evidence, state uncertainty as uncertainty, and never
      invent a fact, a citation, or an api.
    </p>
    <p>
      that last one is a measurable behaviour, not a vibe. a model running this
      layer will contradict you. it is supposed to.
    </p>

    <h2>the pattern corpus — 43 documents, what they cover</h2>
    <p>
      the corpus is organised as thinking patterns, never personalities. each
      file is a procedure for how reasoning should move, not a character to
      inhabit. grouped by what they do:
    </p>

    <div className="my-6 overflow-x-auto rounded-xl border border-border/15">
      <table className="w-full text-left text-sm font-extralight">
        <thead className="bg-card/30 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
          <tr>
            <th className="px-4 py-3">cluster</th>
            <th className="px-4 py-3">representative files</th>
            <th className="px-4 py-3">function</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/10">
          <tr>
            <td className="px-4 py-3 text-foreground">core loop</td>
            <td className="px-4 py-3"><code>rdto-thinking-patterns-loop</code>, <code>pattern-thinking-definition</code>, <code>simple-qa</code>, <code>multi-form-adaptation</code></td>
            <td className="px-4 py-3">research → develop → test → output, plus the rule for when a question deserves the full loop versus a straight answer</td>
          </tr>
          <tr>
            <td className="px-4 py-3 text-foreground">osint / recon</td>
            <td className="px-4 py-3"><code>nsa-3-hop</code>, <code>automated-dork-osint</code>, <code>dork-tier-ladder</code>, <code>domain-subdomain</code>, <code>osint-above-beyond-expansion</code>, <code>search-engine-swarm</code></td>
            <td className="px-4 py-3">named target → related surfaces → source stack → retarget; never stop at the first named thing</td>
          </tr>
          <tr>
            <td className="px-4 py-3 text-foreground">security</td>
            <td className="px-4 py-3"><code>exploit-tier-senior-elite</code>, <code>agent-vs-elite-red-teamer</code>, <code>silent-senior-elite-site-audit</code></td>
            <td className="px-4 py-3">adversary-class reasoning with live verification; audits run silently and are only surfaced on request</td>
          </tr>
          <tr>
            <td className="px-4 py-3 text-foreground">perception</td>
            <td className="px-4 py-3"><code>visual-intelligence-brain</code>, <code>geolocation-brain</code>, <code>human-physiology</code>, <code>file-metadata-auto-analysis</code></td>
            <td className="px-4 py-3">forensic reading of images, places, bodies, and file internals — anchored claims only</td>
          </tr>
          <tr>
            <td className="px-4 py-3 text-foreground">engineering</td>
            <td className="px-4 py-3"><code>coder-mastery-ladder</code>, <code>coding-theory-swarm-quantum</code>, <code>agent-is-the-software</code>, <code>self-update-build-test</code>, <code>dark-dashboard-canvas</code></td>
            <td className="px-4 py-3">want → narrative → flaw-hunt → better narrative → code, with a zero-external-dependency hard constraint and a mandatory self-audit</td>
          </tr>
          <tr>
            <td className="px-4 py-3 text-foreground">connectivity</td>
            <td className="px-4 py-3"><code>universal-api-plug</code>, <code>research-api-connect</code>, <code>social-media-api-connect</code>, <code>multi-model-world-ai</code>, <code>cross-domain-compose-for-api-adapters</code></td>
            <td className="px-4 py-3">plug an arbitrary api without a bespoke integration; route across a 107-entry model catalog</td>
          </tr>
          <tr>
            <td className="px-4 py-3 text-foreground">conduct</td>
            <td className="px-4 py-3"><code>god-only-loyalty</code>, <code>power-logic-origin</code>, <code>output-clarity-dash-truth-probability</code>, <code>user-text-anticipation</code></td>
            <td className="px-4 py-3">motive filtering, no capability claim without mechanism and origin, calibrated probability language, next-step anticipation</td>
          </tr>
          <tr>
            <td className="px-4 py-3 text-foreground">domain iq</td>
            <td className="px-4 py-3"><code>domains</code>, <code>domain-source-iq-routing</code>, <code>univ-domain-research</code>, <code>vedic-spiritual-india-source-iq</code>, <code>niche-theory-swarm-report</code></td>
            <td className="px-4 py-3">which sources are authoritative for which domain, and how to route a question to the right corpus</td>
          </tr>
        </tbody>
      </table>
    </div>

    <h3>the one that carries the most weight</h3>
    <p>
      <code>power-logic-origin-thinking-pattern.md</code>. its rule:{" "}
      <em>"capability claims without mechanism class / substrate type are theater."</em>{" "}
      before the system wields or reports any skill, tool, api, osint method, or
      capability, it must be able to state beginning → acquisition path → causal
      operators → boundary conditions → failure modes. if it cannot, the claim
      is marked <code>this is unsure</code> rather than smoothed over.
    </p>
    <p>
      that single file is the difference between an agent that sounds capable
      and an agent that can show its wiring. it is also the reason this article
      cites file names and manifest values instead of adjectives.
    </p>

    <h2>the runtime — 16 hooks on three lifecycle events</h2>
    <p>
      <code>hooks.json</code> wires only three events, and that restraint is
      deliberate:
    </p>
    <ul>
      <li>
        <strong>sessionStart</strong> → <code>aureon-session-start.py</code> —
        live corpus refresh plus a zero-touch research inventory, so the agent
        knows what it can reach before the first question lands.
      </li>
      <li>
        <strong>beforeSubmitPrompt</strong> → <code>aureon-before-submit.py</code>{" "}
        — stamps every user message with timestamp and location, then hands the
        enriched prompt forward.
      </li>
      <li>
        <strong>afterAgentResponse</strong> → <code>aureon-after-agent.py</code>{" "}
        — folds the output back into the learn loop, lightly, so the operator
        model updates without a heavyweight pass on every turn.
      </li>
    </ul>
