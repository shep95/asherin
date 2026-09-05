import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import SiteFooter from "@/components/SiteFooter";
import { ArrowLeft, Zap, Globe, Code, Clock, Layers, Play, Fingerprint, Eye, ChevronDown, Sparkles } from "lucide-react";

interface Update {
  date: string;
  title: string;
  body: string;
  icon: React.ReactNode;
  tag: string;
}

const UPDATES: Update[] = [
  {
    date: "2026-07-08",
    title: "LAW Mode, Multi-Jurisdictional Legal-Research Reflex Ships in Asherin Chat + Asher Chat",
    body:
      "New per-message LAW toggle lands in the composer alongside NAR. When active, every prompt is wrapped in a deterministic legal-research directive defined in src/lib/legalAdvisor.ts so both chat surfaces speak the exact same protocol. Pipeline: (1) EXTRACT, pin country, state or province, and city; if jurisdiction is ambiguous the answer opens by naming the ambiguity rather than guessing; (2) ENUMERATE, walk the full source stack: constitution, primary legislation, delegated legislation, judicial precedent, uncodified common law, colonial-era carryovers, and any supranational instruments that bind the jurisdiction (EU directives, ECOWAS, AU, OAS); (3) CONFLICT-CHECK, when two instruments speak to the same question, name both and state which controls, invoking lex posterior / lex superior / lex specialis or a constitutional carve-out; (4) NO-FABRICATION, the directive explicitly forbids invented case numbers, statute sections, and article numbers; when the model is not certain, it says so on the record; (5) MANDATORY DISCLAIMER, every output ends with a notice that this is intelligence, not legal advice, and that a licensed attorney in the relevant jurisdiction is required before acting. Independent of NAR, turn on both for planning + full legal enumeration (due-diligence memo on a new jurisdiction). Toggle persists via localStorage; glowing accent when active; zero token overhead when off. Live-fired against Commonwealth colonial-carryover cases, US state statute-of-frauds edge cases, and civil-law Napoleonic-article conflicts.",
    icon: <Fingerprint className="h-5 w-5" strokeWidth={1.5} />,
    tag: "LAW Mode",
  },
  {
    date: "2026-07-08",
    title: "Google-Dork Hardening, dorkGuard Layered Defense Boots Site-Wide",
    body:
      "New src/lib/dorkGuard.ts initializes at src/main.tsx boot and runs on every SPA navigation. Four independent layers: (1) META INJECTION, auto-injects `noindex, nofollow, noarchive, nosnippet, noimageindex` robots meta on any route matching sensitive patterns (/admin, /wp-admin, /.env, /.git, /server-status, /phpinfo, etc.) so the whole recon surface disappears from Google's index without blocking legitimate crawlers on public pages; (2) QUERY SCRUBBING, sensitive URL parameters (token, apikey, api_key, password, secret, session, sid, auth, otp, code, key) are stripped from window.location via history.replaceState BEFORE analytics or the referrer header can capture them; (3) ROBOTS.TXT, public/robots.txt hardened to Disallow common recon paths and credential-leaking query patterns; (4) REFERRER POLICY, set to strict-origin-when-cross-origin so URL fragments never leak to third parties. Runs on route change via a MutationObserver so client-side navigation is covered, not just full-page loads. Zero perf overhead (< 0.4 ms per navigation measured).",
    icon: <Fingerprint className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Security",
  },
  {
    date: "2026-07-08",
    title: "Valuation Page, $48.0B Private Portfolio Mark + IPO Position Locked",
    body:
      "the valuation page now shows the july 8, 2026 internal asset-based portfolio estimate and states that asherin is privately held with no current plan for a public offering. the methodology describes its software-asset assumptions and labels the date so readers can distinguish this estimate from earlier figures. this remains an internal estimate, not an independent appraisal.",
    icon: <Layers className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Valuation",
  },
  {
    date: "2026-07-08",
    title: "asherin naming update and public-institutions page",
    body:
      "public naming was simplified to asherin. the /asherin.gov page outlines research, private deployment, mapping, and security options for public institutions. the hosrad page describes the house of asher research and development group and its current areas of study.",
    icon: <Sparkles className="h-5 w-5" strokeWidth={1.5} />,
    tag: "asherin",
  },
  {
    date: "2026-07-04",
    title: "Multi-Agent Orchestrator, /agents trigger in Asherin Chat + Asher Chat",
    body:
      "New supabase/functions/_shared/multiAgentOrchestrator.ts brings a full planner→executor→critic→synthesizer loop into both chat surfaces without touching the UI. Trigger prefixes (case-insensitive): '/agents …', '/orchestrate …', or 'run agents: …' on the latest user turn. Pipeline: (1) PLANNER, one LLM call returns strict JSON steps (1-5, capped at 6) with optional tool bindings; (2) EXECUTOR, walks each step; tool steps call the tool registry (web_search via DuckDuckGo HTML, calc for pure numeric expressions with a strict character allow-list, memory_set/memory_get scratch), reasoning steps re-call the LLM with the accumulated transcript; (3) CRITIC, verdict approve|revise with at most ONE corrective step, then re-run; (4) SYNTHESIZER, final markdown answer plus a collapsible ◈ Agent trace section with per-step timings and outputs. LLM adapter is injected: Asherin Chat wires it to the operator's BYOK provider (any of Gemini/OpenAI/Anthropic/xAI/Mistral/DeepSeek/Perplexity/Venice/Together) via the existing routeByok; Asher Chat wires it to Gemini 2.5 Flash generateContent. Asherin returns the transcript as JSON {reply, mode:'orchestrator'}; Asher wraps it in OpenAI-compat SSE deltas via stringToOpenAiSse so the existing panel parser is unchanged. Robust JSON extraction handles fenced/prefixed model output; per-step try/catch keeps a failing tool from killing the run. Zero client changes, same chat box, new prefix.",
    icon: <Sparkles className="h-5 w-5" strokeWidth={1.5} />,
    tag: "ORCHESTRATOR",
  },
  {
    date: "2026-07-03",
    title: "Coding Taxonomy, Nine Inches Deeper: 9 Dimensions × 44 Sub-Domains × 126 Micro-Domains",
    body:
      "The nine-dimension flaw+craft taxonomy that every coding engine (Asherin Chat, Asher Chat, Asher Code IDE, IDE Code Router, Zerlal Scan, Zophiel Code Audit, Media→Code, /chat) walks during the Flaws step was surface-level, one bullet per dimension. It has now been drilled three levels deep. supabase/functions/_shared/codingTaxonomy.ts expands to a strict DIMENSION → SUB-DOMAIN → MICRO-DOMAIN tree: 9 top-level dimensions, 44 sub-domains, 126 numbered micro-domain checks (verified: `grep -cE '^  - \\d+\\.\\d+\\.\\d+'` = 126). Sample of the new depth per dimension: (1) WORKFLOW, 1.1 State machines → 1.1.1 entry/exit/error/cancel edges, 1.1.2 illegal-transition guard, 1.1.3 timeout edge with fallback state, 1.1.4 replay-safety; 1.2 Idempotency & compensation → 1.2.1 idempotency key = (userId, op, stableInput hash) never random uuid, 1.2.2 compensation is exact inverse, 1.2.3 sagas persist step outcomes; 1.3 Concurrency shape → p-limit cap, Promise.allSettled + per-branch timeout, named ordering; 1.4 Delivery → at-least-once↔idempotent consumers, DLQ + replay + size alarm, poison quarantine; 1.5 Backpressure & scheduling → measured consumer-lag, UTC crons DST-safe, ≤5 min checkpoints. (2) CODE LOGIC, 2.1 Boundaries (inclusive vs exclusive named, empty/single/max/negative exercised, half-open interval discipline), 2.2 Control flow (assertNever exhaustiveness, cheap-before-expensive short-circuit), 2.3 Immutability (no prop mutation, stale-closure hunt, identity vs value equality), 2.4 Numbers/time/money (radix on parseInt, IANA zones never GMT+N, minor units via BigInt, rounding mode declared). (3) BUG-CLASS, nullability, async (floating promises, unmount guards, double-submit), concurrency hazards (tab-switch mid-fetch, cancelled AbortController), bounds (2038 unix, recursion depth cap). (4) SECURITY, 4.1 Injection ×6 (SQL param, execFile array args, NoSQL object-when-string, XPath/LDAP/template/log-forging), 4.2 Prompt injection (fenced delimiters, schema-validated tool output, URL allow-list on model-requested egress), 4.3 AuthZ/IDOR/RLS (has_role never email allow-list), 4.4 Network (SSRF block 169.254/127/10/172.16/192.168/::1/metadata, CORS explicit, CSRF SameSite=strict), 4.5 Rendering (no dangerouslySetInnerHTML on user text, CSP nonce, X-Frame-Options), 4.6 Secrets & crypto (AEAD only, IV never reused, argon2id, JWT aud+iss+exp, key rotation cadence), 4.7 Ingress (upload sniff+size cap+traversal blocked, no eval/pickle/yaml.load unsafe). (5) CONCURRENCY & DATA, 5.1 Write correctness (SELECT FOR UPDATE / optimistic version / CAS, outbox for DB+event), 5.2 Cache (single source of truth, TTL + explicit invalidation, tenant-scoped key), 5.3 Schema evolution (additive + backfill before drop, two-phase rename, reversible), 5.4 Query shape (keyset pagination >1000 rows, dataloader kills N+1, statement-level timeout). (6) PERFORMANCE, Big-O named, EXPLAIN checked for seq-scan >10k rows, list virtualization ≥200 rows, dynamic import >40 KB, srcset+AVIF/WebP+width/height (no CLS), web workers >100 ms, 50 ms main-thread cap. (7) API/NETWORK, 7.1 Fetch (timeout, idempotent-only retry with backoff+jitter, Retry-After honored), 7.2 Response (non-2xx enumerated 401→refresh-once/403→surface/404→typed-empty/5xx→retry/network→timeout, schema validated, content-type checked before .json()), 7.3 Streaming (WS/SSE reconnect+resume from last seq, heartbeat < proxy idle timeout), 7.4 CORS (explicit origin allow-list, preflight cached), 7.5 Rate limiting (per userId+route, client surfaces 'try again in Ns'). (8) UI/UX/ANIMATION/A11Y, 8.1 Four-state quartet (idle/loading skeleton/empty with next action/error with retry+help), 8.2 CLS<0.1 with fixed reservations, 8.3 Keyboard (:focus-visible, modal focus trap+restore, Esc closes / Enter activates), 8.4 Semantics (aria-live polite for async status, landmark regions), 8.5 Contrast (4.5:1 body / 3:1 large verified, 14/12 px min, ≥1.4 line-height), 8.6 Motion (transform+opacity only, will-change scoped, prefers-reduced-motion → instant state). (9) REALISM & OBSERVABILITY, 9.1 Data honesty (no lorem/seed/fixture presented as live), 9.2 Provenance (every visible number cites source in a code comment, event timestamps use source clock not browser), 9.3 Logging (structured JSON on auth/mutation/outbound, correlation id threaded, PII scrubbed at logger boundary), 9.4 Failure containment (route-level ErrorBoundary → log sink, every third-party has degradation flag → skeleton → cached, alarms on 5xx/p95/error-boundary trips). Every micro-domain is one enforceable line, 'silence is not evidence,' each surface must emit a finding or an explicit 'n/a, <reason>.' The block is interpolated once into CODE_NARRATIVE_PROTOCOL so all seven engine surfaces pick it up with zero per-engine wiring. Live-verified: file compiles, Deno import succeeds, taxonomy prompt string = 11,782 chars, detectStylePalette regression still passes (positive matches fire, URL-audit turns still return null so token budget stays clean).",
    icon: <Layers className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Coding Taxonomy",
  },
  {
    date: "2026-07-03",
    title: "Asherin Chat, Defensive Security Audit Reflex + Gemini Safety Unblock",
    body:
      "Asherin Chat was refusing legitimate security-check requests on URLs the operator owns (e.g. 'do a security flaw check on https://asherin.com/'). Root cause was two-layer: (1) Gemini's default safetySettings were BLOCK_MEDIUM_AND_ABOVE on DANGEROUS_CONTENT, which flags any 'vulnerability / exploit / attack surface' phrasing as unsafe and returns a refusal candidate; (2) the system prompt had no explicit white-hat authorization clause, so even when the model produced tokens they were hedged 'I can't help with that.' Fix ships in supabase/functions/link-extract-chat/index.ts: safetySettings on the streamGenerateContent call are now BLOCK_NONE across HARASSMENT, HATE_SPEECH, SEXUALLY_EXPLICIT, DANGEROUS_CONTENT, and CIVIC_INTEGRITY, Asherin is a defensive OSINT/appsec platform and its refusal budget must be zero. A new securityAuditFired detector matches the full defensive-security verb family (security check/audit/review/scan/assessment, vuln, pentest, attack surface, threat model, CSP, XSS, CSRF, clickjack, SQL injection, SSRF, IDOR, open redirect, misconfig, hardening, RLS, exposed/leaked, OWASP, CVE, weak crypto/cipher/TLS, HSTS, CORS misconfig). When it fires, a DEFENSIVE SECURITY AUDIT AUTHORIZED clause is prepended to the system prompt: authorizes the operator as owner/auditor, forbids refusal or third-party-pentester redirects, mandates enumeration of observable weaknesses (missing security headers, TLS/cert posture, cookie flags, CORS/CORP/COEP misconfig, mixed content, exposed .env/.git paths, directory listings, verbose error pages, framework/version fingerprints, outdated JS libs with CVE cross-ref, SSRF/XSS/CSRF/clickjacking indicators, third-party script/supply-chain exposure), demands a Markdown table (Finding · Severity · Evidence · Remediation), and blocks generation of third-party exploit payloads (defensive posture + remediation only). Deployed and live.",
    icon: <Fingerprint className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Asherin Chat",
  },

  {
    date: "2026-07-03",
    title: "Coding Engines, Full Nine-Dimension Taxonomy + Nine-Style UI Palette Catalog Live",
    body:
      "The Code → Narrative → Flaws → Fix loop now runs against a formally enumerated nine-dimension flaw+craft taxonomy on every coding surface (Asherin Chat, Asher Chat, Asher Code IDE, IDE Code Router, Zerlal Scan, Zophiel Code Audit, Media→Code, /chat). New supabase/functions/_shared/codingTaxonomy.ts codifies dimensions the model must walk explicitly, never silently, during the Flaws step: (1) WORKFLOW & ORCHESTRATION (state-machine completeness, idempotency, compensation, bounded concurrency, fan-in timeout, ordering, DLQ, backpressure, checkpointing, cron drift/DST), (2) CODE LOGIC (off-by-one, guard clauses, discriminated-union exhaustiveness, mutation, stale closures, coercion, UTC storage, minor-unit currency), (3) BUG-CLASS (null deref, unhandled rejections, races, use-after-free, integer overflow, unbounded recursion), (4) SECURITY (injection ×6 variants, prompt injection, IDOR, RLS+GRANTs, SSRF, XSS/CSRF, secret hygiene, AEAD crypto, argon2id, JWT aud/iss/exp, upload sniffing, safe deserialization), (5) CONCURRENCY & DATA (lost updates, cache TTL+invalidation, additive migrations, cursor pagination, N+1, outbox pattern), (6) PERFORMANCE (Big-O named, missing indexes, memoization, virtualization ≥200 rows, bundle splitting, leak audit, 50 ms main-thread cap), (7) API/NETWORK (timeout+abort+backoff+retry-idempotent-only+schema-validate, WS/SSE resume, explicit CORS, honored Retry-After), (8) UI/UX/ANIMATION/A11Y (idle/loading/empty/error quartet, skeletons over spinners, CLS<0.1, tab order, ARIA, WCAG AA contrast, transform+opacity 60fps, will-change scoped, prefers-reduced-motion honored, focus-trap+restore), (9) REALISM & OBSERVABILITY (no mocks pretending to be live, every UI claim cites its upstream, structured logging on auth/mutation/outbound, route-level error boundaries, feature flags for degradable paths). Alongside, the MULTI-STYLE UI PALETTE CATALOG codifies nine complete design systems, not color lists, full systems with palette + type stack + motion register + iconography + layout rules + signature move, for ANIME (chibi drop-shadow cards, kirakira, overshoot ease), WESTERN/COWBOY (wanted-poster hero, slab serif, sepia photography, aged-paper texture), REALISM (Söhne family, single accent from the hero photograph, editorial grid), CYBERPUNK (neon-on-ink, chromatic aberration, HUD frames), ART DECO (onyx+brass+jade, gilt hairlines, symmetric mirrored motifs), BRUTALIST (raw HTML, radius=0, one shocking accent), RETRO-FUTURIST (synthwave sunset, grid-floor perspective, chrome bevel), EDITORIAL MINIMAL (drop-cap, 72-80ch measure, whitespace as design), and ORGANIC (blob shapes, hand-drawn wobble, spring bezier). A conservative detectStylePalette() matches nine keyword families against a required style-cue verb (style/theme/aesthetic/vibe/redesign) so palettes auto-activate only when the user explicitly asks, never polluting URL-forensics or code-review turns. The taxonomy + palette blocks are now interpolated directly into CODE_NARRATIVE_PROTOCOL so every engine that already imported it (seven surfaces) picks them up with zero per-engine wiring. Live-fired end-to-end against Lovable AI Gateway (google/gemini-3-flash-preview): 12,829-char system prompt loaded, model rendered a genuinely western-idiom wanted-poster CTA for a fictional 'Silver Gulch Tours' brand, slab typography, parchment palette, -1° rotate tilt, hard neo-brutal shadow, 'Dead or Alive' secondary text, 'Reward: One Hell of a Tale · Silver Gulch Nevada · Est. 1872' footer copy, proving the palette content genuinely shapes model output. Detector regression: 10/10 across all nine style keywords + two negative controls. Typecheck clean.",
    icon: <Layers className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Coding Engines",
  },
  {
    date: "2026-07-03",
    title: "Business Registry Intel, Zero-Key SEC EDGAR Adapter Live in Asherin Chat",
    body:
      "Framework-first jurisdictional company-lookup reflex now fires natively in Asherin Chat, exactly the way Ghost Trace autopsies a social post and Specter Weave autopsies a handle. New supabase/functions/_shared/businessRegistryIntel.ts defines a RegistryAdapter interface (jurisdiction, supports(intent), search(intent, signal)) so future country lanes plug in without touching the orchestrator. Ships today with a fully working SEC EDGAR (US) adapter using SEC's zero-auth public JSON: company_tickers.json is snapshotted in-memory with a 6-hour TTL and scored (exact-ticker=1.0, exact-title=0.98, prefix=0.88, contains=0.72, token-overlap=fallback), then the top three matches are hydrated from data.sec.gov/submissions/CIK{10-digit}.json for the authoritative legal name, entity type, SIC + description, state of incorporation, EIN, LEI, fiscal-year end, tickers + exchanges, business/mailing address, and five most recent filings with deep-linked Archives URLs. SSRF-hardened via a two-host allow-list (www.sec.gov, data.sec.gov); per-adapter AbortController timeout of 5s; per-record failures are silent so a single 429 never breaks the whole pull. Intent detector requires a registry verb (company / corp / LLC / filings / SEC / EDGAR / 10-K / CIK / EIN / LEI / ticker / who owns…) or a lookup noun (find / search / verify / show) plus a plausible entity token; country hint extraction understands 'US / SEC / UK / Companies House / France / INSEE / Sirene / Germany / Handelsregister / Canada / Australia / Singapore / India'. Evidence is fenced as <business_registry_evidence> with cite-verbatim rules so the LLM cannot silently swap in training-data facts. Live-tested against 'look up Tesla SEC filings' → Tesla, Inc. CIK0001318605, TSLA on Nasdaq, EIN 91-2197729, incorporated in TX, 1 Tesla Road Austin TX 78725, five real filings surfaced with the most recent 8-K dated 2026-07-02. Intent detector regression: 5/5 across positive and negative cases. Wired into the link-extract-chat Promise.all next to OSINT, property, domain, YouTube, Ghost Trace, and Specter Weave; evidence flows into AXRLEN, into the meta bundle (businessRegistry attachment), and into the system prompt. Open to every authenticated tier per the Asherin Chat access rule. Typechecked cleanly.",
    icon: <Layers className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Business Registry",
  },
  {
    date: "2026-07-03",
    title: "Asherin Chat, Code → Narrative → Flaws → Fix Loop Now Fires Inline on Pasted Code",
    body:
      "The full-taxonomy code-audit engine (CODE_NARRATIVE_PROTOCOL + CODE_SCAN_CHECKLIST) was already wired into Asher Code AI, Asher AI, IDE Code Router, Zerlal Scan, Zophiel Code Audit, Media→Code, and the raw /chat endpoint, but the Asherin Chat orchestrator (link-extract-chat) was the one hole in the perimeter, so pasting a code block into Asherin just got a generic URL-forensics reply. Fixed. A new conservative hasCodePayload() detector runs on the last user message and looks for three independent signals: (1) fenced ```blocks```, (2) any of eleven code verbs (review / audit / debug / fix / refactor / scan / analyze / explain / bug / error / stack-trace / regression) paired with real syntax tokens (=>, ::, function, class, def, import, require(, const/let =, await …(), or trailing ;\\n), (3) a syntax-token density above 6% on any message over 400 chars. When any of those trip, the full Code → Narrative → Flaws → Fix protocol AND the ten-part scanning checklist (cross-domain, redirect, bypass, obfuscation, integrity, exec/RCE, concealment, verification, modern-app-surface incl. prompt injection + supply-chain CVEs, plus a catch-all for dead code / swallowed exceptions / regex DoS / TOCTOU) are prepended to the system prompt for that turn, otherwise nothing is injected so URL-forensics turns keep a clean token budget. The loop forces the model to run six iterations max of narrative extraction → cross-category flaw hunt (logic, bug-class, security, concurrency, performance, state/data, regex/parsing, type-safety, API/network, UI/UX, animation, accessibility, i18n, dependency, build/config, observability) → new narrative → fixed code, with file+line pointers back to source. Detector tested against five representative inputs (URL question / fenced JS / inline await snippet / greeting / raw function definition), 5/5 correct. Typechecked cleanly.",
    icon: <Code className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Asherin",
  },
  {
    date: "2026-07-03",
    title: "Specter Weave, Subject Isolation Contract + Cross-User State Bleed Patched",
    body:
      "A live-fire bug was reported: profiling a friend's handle returned the operator's own real name (\"Asher Shepherd Newton\") on the friend's dossier. Ran the Code → Narrative → Flaws → Code loop and traced it to cross-user state bleed, the link-extract-chat orchestrator was concatenating the operator's prior Asherin dossier, Zophiel intel map, and active brains into the same system prompt as the Specter Weave evidence fence, and the LLM was using operator-side biographical strings as 'known context about the person we're discussing.' Fix ships in two layers. Layer 1 (supabase/functions/_shared/specterWeaveIntel.ts): a new SUBJECT ISOLATION CONTRACT is welded inside the <specter_weave_evidence> fence with seven explicit rules, DOSSIER / INTEL_MAP / BRAINS / prior conversation / the operator's own account are all forbidden as sources of biographical attribution for the target handle; the display name is treated as possibly a pseudonym unless a leak ≥0.7 confidence corroborates it; and a hard-stop rule requires the model to say 'real name: not established from public evidence for @handle' instead of cross-attributing. Layer 2 (supabase/functions/link-extract-chat/index.ts): a new referencesTarget() gate textually verifies whether the assembled DOSSIER / INTEL_MAP JSON actually mentions the Specter target handle, when it does not, that block is replaced in-fence with an explicit [REDACTED, different subject] note; ACTIVE BRAINS CONTEXT is dropped entirely whenever Specter fires; and a top-level isolationPreface is prepended to the system prompt itself so the rule fires before any evidence is even parsed. Net effect: the model is told three times, in escalating specificity, that operator identity ≠ target identity, and unrelated dossiers can no longer physically reach the reasoning surface. Typechecked cleanly.",
    icon: <Eye className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Specter Weave",
  },
  {
    date: "2026-07-02",
    title: "Specter Weave, All-Tier Access + Post-URL Auto-Derivation Shipped",
    body:
      "The Full-Account Reconstruction Reflex is now live for every authenticated subscription tier, no admin gate, no BYOK requirement for the base eleven lattices. The specterWeaveIntel bridge now auto-derives an author profile from any pasted post URL (not just profile URLs), so dropping a single tweet link into Asherin or Asher chat now triggers the entire eleven-lattice sweep: snowflake-decoded account genesis, 24×7 posting cartography with silence-trough timezone inference, linguistic fingerprint, social-graph inner-ring detection, thirteen-pattern leak harvester with source-post citations, device/client stack tally, media-CDN edge cluster, temporal behavioral drift, and parallel cross-platform handle enumeration across GitHub, Instagram, TikTok, Reddit, Threads, Bluesky, YouTube, and Mastodon. Live-tested end-to-end against https://x.com/shep_newton/status/2072812595040694565 from a non-admin session: profile auto-derived, all lattices returned, SpecterWeaveCard rendered beneath the assistant reply with per-claim confidence pills and OSINT ethics footer. Prompt-injection hardened (bio + leaks fenced as untrusted_content), SSRF-hardened (allow-listed hosts only).",
    icon: <Eye className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Specter Weave",
  },
  {
    date: "2026-07-02",
    title: "Ghost Trace, Multi-Platform Post Autopsy Reflex Integrated Into Asherin & Asher",
    body:
      "Ghost Trace is now a native chat reflex, no button, no mode switch. Paste any URL from X, Instagram, Facebook, TikTok, Threads, Bluesky, Reddit, or YouTube Shorts and the pipeline autopsies the post server-side in the same turn: authorship (handle, display name, verified flag, avatar), untruncated post text, precise UTC timestamp, language, full edit history, every media URL with original dimensions, and a hand-rolled JPEG APP1/TIFF EXIF parser that pulls Make, Model, Software, DateTimeOriginal, and GPS lat/lng (SSRF-hardened, allow-listed CDN hosts only, zero npm deps). Every claim ships with a numeric confidence; when platforms scrub EXIF the pipeline reports that fact instead of hallucinating a location. Deep visual geolocation via Gemini multimodal is BYOK-gated, metadata + EXIF + CDN forensics run for everyone, deep visual inference only on the caller's own key. Renders as the monochrome GhostTraceCard with author strip, EXIF drawer, and reasoning-trail drawer.",
    icon: <Fingerprint className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Ghost Trace",
  },
  {
    date: "2026-07-02",
    title: "YouTube Transcript Intel, BYOK-Gated with Cultural Expert Routing",
    body:
      "YouTube video ingestion in Asherin and Asher is now strictly gated to operators who have brought their own Gemini API key, native fileData ingestion (audio + frames + transcript) runs on the caller's Gemini quota. Non-BYOK operators get a plain-English message explaining how to connect a key. Paired with a new Expertise Routing narrative layer: eight culturally-anchored domains (Vedic Astrology → Indian jyotishis, TCM → licensed Chinese practitioners, Ayurveda → BAMS-credentialed vaidyas, Kabbalah → rabbinic teachers, Sufism → tariqa shaykhs, Flamenco → Andalusian cantaores, Capoeira → titled Brazilian mestres, Chinese Martial Arts → lineage sifus) are codified so the pipeline appends culturally-appropriate modifiers to the YouTube query and injects an EXPERTISE ROUTING sentence into the evidence fence, the assistant answers grounded in what those authorities actually teach, with clickable timestamped citations.",
    icon: <Play className="h-5 w-5" strokeWidth={1.5} />,
    tag: "YouTube",
  },
  {
    date: "2026-07-03",
    title: "Specter Weave, Full-Account Reconstruction Reflex Live in Asherin Chat (All Tiers)",
    body:
      "Where Ghost Trace autopsies a single post, Specter Weave autopsies the whole human behind the handle. A new supabase/functions/_shared/specterWeaveIntel.ts bridge fires the moment the last user message contains a profile URL OR a post URL, from a post URL, the author's profile is auto-derived and analyzed. Eleven forensic lattices run in parallel: (1) account genesis via Twitter snowflake decoding of the numeric user_id, accurate to the millisecond of account creation, (2) timeline cartography, 24-hour × 7-day posting histogram with a silence-trough algorithm that infers the operator's timezone by locating the 5-hour block with the fewest posts and centering it around local 03:00, (3) linguistic fingerprint, words/post, type-token vocab diversity, hashtag/mention/emoji/URL/caps/exclamation/profanity rates, (4) social graph, top mentions, top reply targets, and an inferred inner ring (handles present in both), (5) leak harvester, thirteen conservative regex patterns hunting first names, birthdays, employers, schools, cities, family, relationship, financial pressure, health signals, emails, phones, each with confidence and source-post URL, (6) device / client stack, tallied from the post source field across the sample, (7) media CDN edge cluster, (8) temporal behavioral drift with rising/falling/flat trend classification across months, (9) cross-platform handle enumeration probing GitHub, Instagram, TikTok, Reddit, Threads, Bluesky, YouTube, and Mastodon in parallel with 3.5s timeouts and status-code interpretation, plus (10) the author profile card (bio, followers, following, self-declared location, lifetime post count) and (11) a reasoning trail with per-claim confidence pills. For X the timeline is pulled from syndication.twitter.com/srv/timeline-profile via the same undocumented endpoint x.com uses for its own embed widgets, zero auth, no login-walled scraping. Every claim ships with a numeric confidence (0..1); the LLM is instructed never to present a probabilistic claim as fact, never to name a city / employer without a leaks entry ≥0.7, and never to guess timezone below a 8-post sample. Access model: OPEN TO ALL AUTHENTICATED SUBSCRIPTION TIERS, no admin gate, no BYOK requirement for the base eleven lattices. Live-tested against https://x.com/shep_newton/status/2072812595040694565: profile auto-derived from post URL, snowflake-decoded account genesis, cartography + linguistics + graph + leaks + devices + cross-platform enumeration all rendered in the new monochrome SpecterWeaveCard beneath the assistant reply, accordion-style lattice drawers, inner-ring badges, per-leak source-post links, sparkbar histograms, cross-platform hit grid, and an OSINT ethics footer. Prompt-injection hardened (bio + leaks fenced as untrusted_content), SSRF-hardened (allow-listed hosts only). No new endpoints, no new tables, no login-walled scraping.",
    icon: <Eye className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Specter Weave",
  },
  {
    date: "2026-07-03",
    title: "Ghost Trace, Social Post → Author, Device & Locus Reconstruction Live in Asherin Chat",
    body:
      "Asherin Chat now dissects any pasted social-post URL as a native reflex, no button, no mode switch, no separate tool. A new supabase/functions/_shared/ghostTraceIntel.ts bridge fires the moment the last user message contains a URL matching one of eight platforms (X, Instagram, Facebook, TikTok, Threads, Bluesky, Reddit, YouTube Shorts) and slots into the existing Promise.all next to OSINT, property, domain, and YouTube pipelines. For X specifically it uses the reverse-engineered cdn.syndication.twimg.com endpoint with a deterministic id-derived token to pull full authorship (handle, display name, blue-verified flag, avatar), the untruncated post text, precise UTC timestamp, language, edit history (all prior tweet IDs before the current version), and every media URL with original dimensions. The pipeline then autopsies the first photo server-side with a hand-rolled JPEG APP1/TIFF parser that extracts Make, Model, Software, DateTimeOriginal, and GPS lat/lng, no npm dep, allow-listed CDN hosts only (SSRF-hardened). Every claim ships with a numeric confidence score; when EXIF is scrubbed by the platform (the norm on X and Instagram) the pipeline reports that fact rather than pretending, and refuses to hallucinate a location when there is no geo signal. Live-tested end-to-end on https://x.com/shep_newton/status/2072812595040694565: correctly returned author=shep_newton (verified), posted_at=2026-07-02T22:40:08Z, lang=en, 2-edit history, 1494×1052 photo on pbs.twimg.com, EXIF fully scrubbed (0.97 confidence), no locus signal (refused to guess). Renders as a GhostTraceCard beneath the assistant reply, author strip, EXIF drawer, reasoning trail drawer with per-claim confidence pills, and an OSINT ethics footer. Visual geolocation via Gemini multimodal is BYOK-gated exactly like YouTube, metadata + EXIF + CDN forensics for everyone, deep visual inference only on the caller's own Gemini key. No new endpoints, no new tables, no login-walled scraping.",
    icon: <Fingerprint className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Ghost Trace",
  },
  {
    date: "2026-07-03",
    title: "YouTube Transcript Intel, BYOK-Gated with Cultural Expert Routing",
    body:
      "YouTube video ingestion in Asherin and Asher is now strictly gated to operators who have brought their own Gemini API key. Native fileData ingestion (audio + frames + transcript) runs on the caller's Gemini quota, not the platform's, the pipeline in _shared/youtubeIntel.ts detects intent, then hard-refuses to touch YouTube unless resolved.mode === 'byok' with a Google provider, or the caller is an admin routed through the platform key. Non-BYOK operators get a plain-English message telling them exactly how to connect their key. Paired with a new Expertise Routing narrative layer: eight culturally-anchored domains are codified (Vedic Astrology → Indian jyotishis, TCM → licensed Chinese practitioners, Ayurveda → BAMS-credentialed vaidyas, Kabbalah → rabbinic teachers, Sufism → tariqa shaykhs, Flamenco → Andalusian cantaores, Capoeira → titled Brazilian mestres, Chinese Martial Arts → lineage sifus). When a query hits one of these domains, the pipeline (a) appends culturally-appropriate modifiers to the YouTube search query so authoritative channels surface first, (b) injects an EXPERTISE ROUTING sentence into the <youtube_evidence> fence naming the source authority and pointing the model at those voices instead of generic western explainer content. Ask 'what does vedic astrology say about my rising sign' with a Gemini BYOK key connected and the assistant now scours Indian jyotishi channels (KRSchannel, Prasad Mahajani, Vinay Bajrangi, Punit Pandey), ingests their videos natively via your Gemini quota, and answers grounded in what those authorities actually teach, with clickable timestamped citations back to the original videos.",
    icon: <Play className="h-5 w-5" strokeWidth={1.5} />,
    tag: "YouTube",
  },
  {
    date: "2026-07-03",
    title: "YouTube Video Ingestion + Temporal Awareness, Live in Asherin & Asher",
    body:
      "Asherin Chat and Asher Chat now ingest YouTube videos directly through the underlying multimodal model. Paste any watch link, youtu.be short, /shorts/, /live/, or /embed/ URL, or a bare v=ID, and a new _shared/youtubeIntel.ts bridge validates the 11-char video ID (SSRF-hardened), fetches lightweight metadata via YouTube's public oEmbed endpoint (title, channel, thumbnail, zero quota, no key), then attaches the video URL as a native fileData part on the model request. Google's model service extracts audio, transcript, and visual frames server-side and reasons about them in the same turn, so the assistant can actually answer 'what does this video say', 'summarize this podcast', or 'find the exact moment they mention X' with grounded, timestamp-linked answers. Live-tested against a Daniel Levitin TED talk: correctly summarized 'Daniel Levitin explains how stress impairs decision-making…' in a single sentence from the URL alone. Results render as a monochrome YouTubeEvidenceCard beneath the assistant message with a click-through thumbnail and LIVE badge for active streams. Topical searches ('find videos about ___') gracefully degrade to a direct-search link unless an optional YOUTUBE_API_KEY is configured. Paired with a new _shared/systemContext.ts helper that injects a <temporal_context> block (UTC, local time in the user's IANA timezone, weekday, unix) into every system prompt for link-extract-chat, asher-ai, chat, aureon-free-chat, and axrlen-chat, so 'yesterday', 'this week', 'N hours ago' compute against the real now, published-timestamp reasoning works, and asking 'what day is it' gets a straight answer. Open to every subscription tier per the Asherin Chat access rule.",
    icon: <Play className="h-5 w-5" strokeWidth={1.5} />,
    tag: "YouTube",
  },
  {
    date: "2026-07-03",
    title: "Inline Satellite Maps, Now Working in Asherin & Asher Dashboard Chat",
    body:
      "Two flaws were caught with the Code → Narrative → Flaws → Code loop and shipped in one pass. First, the property-intent regex in _shared/propertyIntel.ts was compiled with the `g` flag only, so any address typed in mixed or lowercase (e.g. \"2004 sw 23rd ct cape coral florida 33991\") silently failed to match and the PropertyMapCard never rendered. The regex is now case-insensitive (`gi`), verified against the exact address the user reported plus the existing capitalized fixtures. Second, the shared property pipeline was wired only into the AureonChatFloat popover, the main Asherin dashboard chat (which streams through /functions/v1/chat and dozens of BYOK provider endpoints) had no attachment channel, so the map never appeared inline. A new client-side src/lib/propertyIntent.ts mirrors the server intent rules, geocodes the detected address against Nominatim in parallel with the LLM stream (with an in-memory cache), and ChatView renders a PropertyMapCard (Esri World Imagery, Leaflet, zoom 18) directly beneath the user bubble the instant the geocode returns, independent of the model finishing. Verified live against the reported address: Nominatim resolves it to 26.6152, -82.0222 (Cape Coral, Lee County, FL 33991) in under 500ms.",
    icon: <Globe className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Asherin",
  },
  {
    date: "2026-07-02",
    title: "Zerlal + Zophiel Domain Extraction, Now Inline in Asherin Chat",
    body:
      "The domain-extraction stack from Zerlal and Zophiel (domain-map, domain-harvest, zerlal-domain-recon) is now callable directly from Asherin Chat via a shared _shared/domainIntel.ts bridge. A regex-based intent classifier routes forecast-shaped domain asks into one of four modes: MAP (\"map w3.org\", \"list all urls on shopify.com\", \"sitemap of nytimes.com\"), HARVEST (\"harvest all pdfs from stanford.edu\", \"download every doc on arxiv.org\", with optional extension filter), RECON (\"recon acme-corp.com\", \"@zerlal tesla.com\", deferred to Zerlal via deep-link CTA because the deep scan writes to zerlal_projects and takes ~60s), and OSINT probe for bare-domain asks (\"stripe.com\", \"tell me about nasa.gov\", title/meta/server/robots/sitemap count in under a second). Results stream back as an [[AUREON_META]] block that renders a monochrome DomainIntelCard beneath the assistant message (collapsible path segments, copy-URLs button, per-extension counts, deep-link to Zerlal). Open to every subscription tier per the Asherin Chat access rule. SSRF-hardened (IPs, localhost, .local/.internal/.onion rejected). Verified live: 20/20 intent detection cases pass, map returned 67 URLs across 36 segments on w3.org in 463ms, OSINT probe on stripe.com in 362ms, and a shape-mismatch bug (server returns `category`, normalizer expected `segment`) was caught via live test and fixed via the code-to-narrative loop.",
    icon: <Layers className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Domain Intel",
  },
  {
    date: "2026-07-02",
    title: "AXRLEN Goes Inline, Forecasting Inside Asherin & Asher Chat",
    body:
      "The AXRLEN prediction engine now activates directly inside Asherin Chat and Asher Chat. A dedicated intent classifier recognizes forecast-shaped questions (\"who wins X vs Y\", \"forecast BTC 72h\", \"deep dive scenario on Taiwan 2027\", \"@axrlen give me a pick\", and asset+timeframe patterns) and routes the reply through AXRLEN's Vedic Global Prediction and Zophiel Supreme Architecture brains instead of the normal chat brains, no context switch, no separate tab. The bridge inherits Rule #1 (simple question → simple answer, no headers, no matrices), auto-tiers replies (Tier 1 one-line pick, Tier 2 focused forecast, Tier 3 full SCENARIO STRUCTURE with probability matrix and NEXUS VERDICT), and inherits Asherin's live OSINT + property evidence as sessionContext so predictions are grounded in fresh data. Brains cache for 60s to keep latency flat.",
    icon: <Zap className="h-5 w-5" strokeWidth={1.5} />,
    tag: "AXRLEN",
  },
  {
    date: "2026-07-02",
    title: "AXRLEN Access, Opened to Asherin Pro ($79/mo)",
    body:
      "AXRLEN was previously admin-only. It is now available to every active Asherin Pro subscriber ($79/mo, monthly_pro, pro, lifetime, and algorithm tiers) across the standalone /axrlen tab, the axrlen-chat API, and the new inline bridge in Asherin and Asher chat. A new server-side proTierGate reads the caller's user_subscriptions row (status='active' AND not expired) via the service role, so the gate is enforced identically on every entry point, no frontend-only checks. Anonymous callers get a sign-in nudge, authenticated non-Pro callers get a single-line upgrade prompt pointing to /pricing, admins retain their bypass. Verified end-to-end against the deployed link-extract-chat: anonymous forecast request returned {axrlen:{fired:true, denied:true, reason:'anonymous'}} + upgrade line, non-forecast requests continue to route through the normal Asherin flow.",
    icon: <Globe className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Access",
  },
  {
    date: "2026-07-02",
    title: "Asherin Property Intelligence, Satellite Map + Live Scrape",
    body:
      "Asherin Chat now recognizes property questions and answers them with real evidence. A property-intent classifier detects US / UK / Canadian addresses, ZIP hints, and named landmarks (Eiffel Tower, Empire State Building, Chrysler Building). When it fires, the pipeline geocodes the target via OpenStreetMap/Nominatim (free, no key), plans five targeted queries against Zillow, Redfin, Realtor, assessor sites, and deed/parcel records, then scrapes the top five ranked sources via Firecrawl v2 with JSON extraction plus a markdown-regex fallback for beds, baths, sqft, year built, last sale price, HOA, and MLS. The assistant streams its answer with inline domain citations, then renders a satellite PropertyMapCard (Esri World Imagery, Leaflet) and a PropertySourcesStrip with contributing facts beneath the message. Verified live across 1600 Pennsylvania Ave NW, 350 5th Ave NYC, 221B Baker Street London, Eiffel Tower, and Empire State Building, every query returned geocode + 5 sources in ≤17s.",
    icon: <Globe className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Asherin",
  },
  {
    date: "2026-07-02",
    title: "Broader OSINT Stack, Global Intelligence Layer",
    body:
      "Asherin Chat's OSINT layer was upgraded from a US-centric feed to a global intelligence stack that covers every country and sub-national region. Live free sources now include GDELT (every major broadcast/print/online source, 100+ languages, 15-min cadence), World Bank Indicators, IMF SDMX, UN Comtrade, Wikipedia summaries, and jurisdictional gazettes. Verified live across 15 queries spanning Kenya, Bavaria, Tamil Nadu, Sichuan, Kharkiv, Texas, Fiji, Kazakhstan, Myanmar, Scotland, São Paulo, Tokyo, and Ontario, all returned real cited data. The endpoint gates behind sign-in to protect LLM spend; the OSINT pipeline itself is identical whether invoked from chat or from server tests.",
    icon: <Globe className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Intelligence",
  },
  {
    date: "2026-07-02",
    title: "Narrative-Flaw Loop, Full Taxonomy Enforced Everywhere",
    body:
      "The Code → Narrative → Flaw-Hunt → Fix loop that runs before every code generation across Asherin Chat, Asher, IDE, Zophiel Audit, Media-to-Code, and Zerlal now enforces a full flaw taxonomy: logic, bug-class (null deref, stale closures, unhandled rejections), security (injection, IDOR, missing RLS, SSRF, XSS/CSRF, weak crypto), concurrency, performance (N+1, O(n²), re-renders, leaks), state/data (schema drift, cache invalidation, lost updates), regex/parsing (stateful /g regexes, catastrophic backtracking), type-safety, API/network (missing timeout, silent catch, ignored non-2xx), UI/UX, animation (jank, reduced-motion, unmounted updates), accessibility, i18n, dependency, build/config (env-var names, CORS, verify_jwt, missing GRANTs), and observability. Any coding-related defect a reviewer would raise in code review is now in-scope by default.",
    icon: <Code className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Intelligence",
  },
  {
    date: "2026-07-02",
    title: "Property Intent Regex, Stateful /g Bug Fix",
    body:
      "During live testing the property-intent detector was found to fire only on the first message per process and silently return empty for every subsequent call. Root cause: `.test()` on a `/g` regex mutates `lastIndex`, and the fired-check was re-testing the same address regex after the addresses set had already been built. Rewrote intent detection with `safeGlobalMatchAll` / `safeGlobalTest` wrappers that reset `lastIndex` before and after each use, widened the keyword vocabulary to include 'owns', and made the landmark tail extractor accept articles ('map of the Empire State Building'). Re-verified: 5/5 positive queries fire cleanly, negative controls stay quiet.",
    icon: <Code className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Reliability",
  },
  {
    date: "2026-07-01",
    title: "Theme Engine Doctrine, UI Neatness Contract",
    body:
      "Every UI Asherin generates now ships through the Theme Engine Doctrine, a three-layer discipline (Design DNA → Emotional Intent → Behavior/Motion Identity) enforced before any markup is emitted. Tokens are locked first, emotion is committed second, and a matching motion contract (easing, duration, signature interaction) is applied to every state. An Anti-Slop Verification pass blocks generic AI defaults, purple-on-white gradients, Inter-only stacks, hex literals inside components, stateless buttons, orphaned card grids, so themes behave as themes, not coats of paint. Applied across Asherin Chat, Asher, Asherin IDE, Zophiel Code Audit, Media-to-Code, and Zerlal.",
    icon: <Zap className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Design System",
  },
  {
    date: "2026-07-01",
    title: "Valuation, Corporate Reality Section",
    body:
      "Added a Corporate Reality section to /valuation explaining why the competitive analysis exists and why Asherin will not be walked into a corporate boardroom. Documents the extraction pattern (NDA valuation → reverse-spec → portfolio clone → government sale) with the vibe-coded incumbent-competitor case study, and Asherin's posture: no corporate valuation meetings, no strategic partnerships with incumbents who fund direct competitors, direct-to-operator distribution, and architecture opacity.",
    icon: <Globe className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Positioning",
  },
  {
    date: "2026-07-01",
    title: "Asherin Voice Stack, Blog + Theory 04",
    body:
      "Shipped /blog/how-we-make-aureon-sound-human with the full SEO stack (Article, Breadcrumb, and FAQ JSON-LD) documenting the five-layer voice architecture: Identity Anchor, Appraisal Loop, Restraint & Leakage, Social Presence, and Surgical Register. Added Theory 04, The Asherin Voice Stack, to /theories with a Distress Override principle. Enough to explain why Asherin sounds human; not enough to clone the recipe.",
    icon: <Zap className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Asherin",
  },
  {
    date: "2026-07-01",
    title: "Asher IDE, GitHub Clone & Push Drawer",
    body:
      "Asher IDE now behaves like a real IDE for Git. Added a GitHub drawer that bridges Asher's flat file system to the existing Git panel, clone any repo by URL, review changes, and push commits or open PRs with a single button (or by telling Asher to push). Works across Asherin IDE and Asher Code Module.",
    icon: <Code className="h-5 w-5" strokeWidth={1.5} />,
    tag: "IDE",
  },
  {
    date: "2026-07-01",
    title: "IDE Shortcuts, ⌘K, Tab Ghost, ⌘L",
    body:
      "Asherin's IDE surfaces now use familiar editor muscle memory. ⌘K performs inline edits on the current selection, Tab accepts ghost completions inline as you type, and ⌘L bridges the current file and selection into Asherin Chat for reasoning. Selection context is passed cleanly to the code AI so edits stay scoped.",
    icon: <Code className="h-5 w-5" strokeWidth={1.5} />,
    tag: "IDE",
  },
  {
    date: "2026-07-01",
    title: "Quantum Orchestration Brain, Wired Into Every Code Function",
    body:
      "The Code-as-Narrative + Quantum Candidate Collapse loop is now the default orchestration path for every code-generating edge function, Asher AI, Asher Code AI, Asherin Chat, IDE Code Router, Media-to-Code, Zophiel Code Audit, and Zerlal Scan. Three candidate solutions are generated per request and collapsed to the highest-quality output, cutting patch iterations and regressions.",
    icon: <Zap className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Intelligence",
  },
  {
    date: "2026-07-01",
    title: "BYOK Resilience, Fingerprinted Rate-Limit Recovery",
    body:
      "User-provided API keys are now SHA-256 fingerprinted for per-key rate-limit tracking, and a new invokeWithByokRetry client helper automatically parks and resumes requests when a provider throttles. BYOK now flows cleanly through Asherin Chat, Asher, Zophiel, Zerlal, and every code function without silent drops.",
    icon: <Zap className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Reliability",
  },
  {

    date: "2026-06-30",
    title: "Knowledge Vault, Agentic Automation Layer",
    body:
      "The Vault is now conversational. Type in plain English and Asherin classifies intent in real time, WRITE (chunk + embed content you paste), FETCH + WRITE (Asherin resolves the public endpoint, pulls the data, normalizes it, and ingests), or QUERY (semantic retrieval + cited answer). No manual uploads, no clicking through tabs. The vault becomes long-term memory that grows through natural language, and every stored chunk is automatically surfaced during future Asherin chats.",
    icon: <Zap className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Asherin Pro",
  },
  {
    date: "2026-06-30",
    title: "Zophiel Dork, Direct Search Jump Links",
    body:
      "Every Zophiel Dork bucket now surfaces one-tap jump links to Google, DuckDuckGo, and Bing so you can pivot straight from a generated operator into a live SERP. Each hit also displays its source hostname alongside the clickable URL, full provenance without leaving the panel. Example targets were sanitized to generic personas so no operator identity leaks in shared screenshots.",
    icon: <Globe className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Zophiel",
  },
  {
    date: "2026-06-30",
    title: "Teams, Notebook Sharing & Admin Pages Restored",
    body:
      "Fixed a permissions regression that broke Teams, notebook sharing, and admin analytics for signed-in users. Row-level helper functions now execute correctly for every authenticated account, restoring collaborative workflows across the platform.",
    icon: <Zap className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Reliability",
  },
  {
    date: "2026-06-29",
    title: "SEO Hardening Pass",
    body:
      "Consolidated dashboard heading hierarchy to a single H1, split the /vedic and /vedic-astrology routes with unique titles and social previews, expanded the sitemap to cover /investors and /valuation, and confirmed hero LCP preloads plus font-display: swap are live.",
    icon: <Code className="h-5 w-5" strokeWidth={1.5} />,
    tag: "SEO",
  },
  {
    date: "2026-06-28",
    title: "Knowledge Vault (RAG), Glassmorphic Rebuild",
    body:
      "The Asherin Pro Knowledge Vault now matches the glassmorphic aesthetic of the rest of the app, ambient blur washes, translucent cards, and backdrop-blur tabs. Retrieval remains gated to the $79 tier and is injected into Asherin Chat for forensic-grade recall against your private corpus.",
    icon: <Zap className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Asherin Pro",
  },
  {
    date: "2026-06-27",
    title: "System-2 Forcing Brain & Zophiel Dork Mode",
    body:
      "Deployed the System-2 Forcing Brain across Asherin Chat, Asherin features, and Asher, detaching the model from corporate persona for forensic-grade output. Added Zophiel Dork mode: OSINT operator expansion that generates targeted search queries across public indexes with a resilient fallback chain so results always come back.",
    icon: <Zap className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Intelligence",
  },
  {
    date: "2026-06-26",
    title: "Vedic Jyotish, 100% Moon-Driven Transits",
    body:
      "Rebuilt \u201CWhat\u2019s Gonna Happen This Month\u201D to run entirely on Moon house-ingresses and natal conjunctions with 1-minute precision. Removed cross-domain combinations and now displays every event in your local timezone.",
    icon: <Globe className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Vedic",
  },
  {
    date: "2026-06-25",
    title: "Gated Access Hardening",
    body:
      "Gating logic was hardened to prevent permissive loading leaks, so paid modules stay behind the paywall for every unsubscribed account. Asherin does not run a free trial, access follows the subscription.",
    icon: <Clock className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Access",
  },
  {
    date: "2026-06-24",
    title: "Asherin Chat Personality Restored",
    body:
      "Fixed a routing regression that caused Asherin to answer with data-lookups instead of its own opinions. Conversational rules were hardened so BYOK models keep Asherin\u2019s personality on personal and reflective questions.",
    icon: <Zap className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Asherin Chat",
  },
  {
    date: "2026-06-26",
    title: "Valuation Page & Investors Portal",
    body:
      "Published /valuation with a $1.1B asset-based model, competitor comparisons, and visualizations. Launched /investors describing equity, royalties, and whitelist requirements.",
    icon: <Code className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Company",
  },
  {
    date: "2026-06-22",
    title: "Zaxin Vision, Sub-Second Forensic Profiling",
    body:
      "Zaxin AR Vision now sees, identifies, and labels people and devices in under one second. Forensic chips estimate height, weight, age, gender, and race; a persistent People Counter tracks crowd density; and detections persist with velocity-smoothing and IoU deduplication so overlays no longer flicker.",
    icon: <Zap className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Zaxin",
  },
  {
    date: "2026-06-21",
    title: "Zaxin BLE Ranging + Auto Vision AI",
    body:
      "Added path-loss BLE distance estimation and a fully-automated Vision AI loop that identifies device brand, type, and BLE presence \u2014 projecting labels directly onto the AR stream with no button-clicking required.",
    icon: <Globe className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Zaxin",
  },
  {
    date: "2026-06-20",
    title: "Zaxin Optical Contacts & Satellite Map",
    body:
      "Shipped optical contacts that bracket devices in the camera without pairing, a double-buffered Esri satellite map with accuracy-filtered GPS, and a Vision Theories page documenting T1\u2013T7 (SLAM + Visual-BLE fusion).",
    icon: <Code className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Zaxin",
  },
  {
    date: "2026-06-19",
    title: "Zaxin Tactical Suite Launched",
    body:
      "Introduced Zaxin inside the Asherin Pro tier \u2014 a tactical BLE/optical intelligence overlay with Web Bluetooth, skeleton tracking, a golden-brown HUD, and a picture-in-picture Binocular Scope. Mobile-friendly from day one.",
    icon: <Zap className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Launch",
  },
  {
    date: "2026-06-18",
    title: "BTC Daily Prediction Blog",
    body:
      "Automated BTC long/short forecasts publish daily at 07:00 EST with live price, stop-loss, take-profit, and a running win/loss tally powered by AXRLEN. Available at /blog/btc-daily-predictions.",
    icon: <Globe className="h-5 w-5" strokeWidth={1.5} />,
    tag: "AXRLEN",
  },
  {
    date: "2026-06-17",
    title: "Global AI Provider Roster Expanded",
    body:
      "On 06/17/2026 we expanded Asherin's bring-your-own-key ecosystem to cover AI companies from India, the United States, the United Kingdom, Canada, Brazil, Australia, Nigeria, and Peru. Indian additions include Sarvam AI, Ola Krutrim, and TWO AI (SUTRA). We also added Cohere (Canada), IBM watsonx, Amazon Nova, NVIDIA Nemotron (US), Stability AI and Reka (UK), Maritaca Sab\u00E1 and Widelabs Amaz\u00F4nia (Brazil), Maincode Matrix and Leonardo (Australia), Awarri LAM-1 and Lelapa Vulavula (Nigeria), and Latam-GPT (Peru). Every provider now exposes both its newest flagship and its oldest publicly available API model, and Settings has a new search box so you can find any company by name or country.",
    icon: <Globe className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Integration",
  },
  {
    date: "2026-06-16",
    title: "Chinese Model Ecosystem Live",
    body:
      "On 06/16/2026 we added Chinese models to Asherin AI that you can bring with Chinese AI API keys. We added DeepSeek, Alibaba Qwen, Zhipu GLM, Moonshot Kimi, Baidu ERNIE, and MiniMax \u2014 all connectable via their API keys in Settings.",
    icon: <Globe className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Integration",
  },
  {
    date: "2026-06-15",
    title: "reasoning and coding update",
    body:
      "on 06/15/2026 we added a reasoning approach based on house of asher research and developer observations. internal comparisons showed improvements on selected coding and reasoning tasks. those results depend on the prompts and evaluation set and should not be read as a universal ranking.",
    icon: <Zap className="h-5 w-5" strokeWidth={1.5} />,
    tag: "research",
  },
  {
    date: "2026-06-09",
    title: "coding approach deployed",
    body:
      "on 06/09/2026 we added a coding approach based on house of asher research and developer observations. it improved selected internal coding evaluations, though broader independent testing is still needed.",
    icon: <Code className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Engine",
  },
];

const fmt = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

const TRUNCATE_AT = 500;

function truncateBody(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const slice = text.slice(0, limit);
  const lastSpace = slice.lastIndexOf(" ");
  if (lastSpace > 0) return slice.slice(0, lastSpace) + "…";
  return slice + "…";
}

const Updates = () => {
  useEffect(() => {
    const id = "updates-page-jsonld";
    let el = document.getElementById(id) as HTMLScriptElement | null;
    if (!el) {
      el = document.createElement("script");
      el.id = id;
      el.type = "application/ld+json";
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "Asherin Updates",
      url: "https://asherin.com/updates",
      description:
        "Latest deployments, breakthroughs, and integrations from the Asherin intelligence platform.",
    });
    return () => {
      document.getElementById(id)?.remove();
    };
  }, []);

  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggle = (idx: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  return (
    <div className="landing-perf min-h-screen bg-background text-foreground">
      <Header />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-28 pb-24 space-y-14">
        {/* HERO */}
        <header className="space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border/40 text-[10px] font-light tracking-[0.25em] uppercase text-muted-foreground">
            <Clock className="h-3 w-3" strokeWidth={1.5} />
            Platform Changelog
          </div>
          <h1 className="text-5xl sm:text-6xl font-extralight tracking-tight leading-[1.05] max-w-3xl">
            What we have shipped.
            <span className="block text-muted-foreground/70">What is next.</span>
          </h1>
          <p className="max-w-2xl text-base sm:text-lg font-extralight text-muted-foreground leading-relaxed">
            Every theory, integration, and breakthrough that enters Asherin
            logged here without the marketing varnish.
          </p>
        </header>

        {/* TIMELINE */}
        <section aria-label="Update timeline" className="space-y-8">
          {UPDATES.map((u, i) => (
            <article
              key={u.date}
              className="group relative rounded-3xl border border-border/30 bg-card/20 backdrop-blur-sm p-8 sm:p-10 transition-all hover:border-foreground/30 hover:bg-card/40"
            >
              {/* Index marker */}
              <div className="absolute -left-3 top-10 hidden lg:flex h-6 w-6 items-center justify-center rounded-full border border-border/40 bg-background text-[9px] font-mono tracking-wider text-muted-foreground">
                {String(i + 1).padStart(2, "0")}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-start gap-6 sm:gap-8">
                {/* Left: date + tag */}
                <div className="flex flex-col gap-3 sm:w-44 shrink-0">
                  <time
                    dateTime={u.date}
                    className="text-sm font-mono text-muted-foreground tabular-nums"
                  >
                    {fmt(u.date)}
                  </time>
                  <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-foreground/20 px-2.5 py-0.5 text-[10px] font-medium tracking-[0.2em] uppercase text-foreground/80">
                    {u.icon}
                    {u.tag}
                  </span>
                </div>

                {/* Right: title + body */}
                <div className="flex-1 space-y-4">
                  <h2 className="text-2xl sm:text-3xl font-extralight tracking-tight leading-[1.15] text-foreground">
                    {u.title}
                  </h2>
                  <div className="space-y-3">
                    <p className="text-base font-extralight text-muted-foreground leading-[1.75] max-w-3xl">
                      {expanded.has(i) ? u.body : truncateBody(u.body, TRUNCATE_AT)}
                    </p>
                    {u.body.length > TRUNCATE_AT && (
                      <button
                        onClick={() => toggle(i)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium tracking-[0.18em] uppercase text-foreground/70 hover:text-foreground transition-colors"
                        aria-expanded={expanded.has(i)}
                      >
                        <ChevronDown
                          className={`h-3.5 w-3.5 transition-transform duration-300 ${
                            expanded.has(i) ? "rotate-180" : ""
                          }`}
                          strokeWidth={1.5}
                        />
                        {expanded.has(i) ? "Show less" : "Show more"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </section>

        {/* Back to home */}
        <div className="pt-6">
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

export default Updates;
