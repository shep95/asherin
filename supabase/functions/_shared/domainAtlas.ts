// domainAtlas.ts — AUREON DOMAIN ATLAS v1.0
//
// CLASSIFICATION: TERRAIN MAP — NOT CONTENT DATA, NOT PERSONALITY.
//
// THE THIRD LAYER
//   patternRecognitionEngine.ts  = PHYSICS  — HOW thought must move (14 operators, 7 hard laws)
//   thinkingPatterns.ts          = MOVES    — WHICH analytic move to make (30 patterns)
//   domainAtlas.ts (this file)   = TERRAIN  — WHERE to enter, and what the ground there is made of
//
// The engine is domain-agnostic on purpose. That is its strength and its
// blind spot: an engine that knows how to look but not where to look will
// analyse whatever the user happened to hand it, at whatever resolution the
// user happened to choose. This atlas fixes the second half. It carries 28
// domains and 274 subdomains, and for each domain it carries the four things
// that decide whether an entry into that terrain is competent or amateur:
//
//   OBSERVABLE — what physically carries signal here. Analysing anything else
//                in this domain is reading the shadow, not the object.
//   BASELINE   — what "normal" means here. Hard Law: no baseline, no pattern.
//                Every domain defines normal differently; a domain entered
//                without its baseline produces confident noise.
//   INVARIANT  — the measure that survives a change of representation. If a
//                finding disappears when units, framing or sampling change,
//                it was an artefact of the representation.
//   TRAP       — the failure mode this specific terrain manufactures. Every
//                domain has one that its practitioners fall into by default.
//
// IT IS STILL NOT A DATABASE OF FACTS. Nothing here says what is true about
// markets, genomes or empires. Each record says what kind of thing counts as
// evidence in that terrain and what kind of thing looks like evidence but is
// not. Facts rot; terrain descriptions do not.
//
// ─────────────────────────────────────────────────────────────────────────────
// PROVENANCE DISCIPLINE (same rule as the pattern engine)
//
// Lineage lines name real, checkable work. Where a lineage could not be
// verified the record says "no verified lineage" rather than borrowing a
// prestigious name it did not earn. Verified anchors used across this atlas:
// Mahalanobis, C. R. Rao and D. Basu (Indian Statistical Institute, Kolkata —
// multivariate distance, sufficiency, the independence theorem); Scheffer,
// Carpenter, Brock, Dakos et al. (Nature 2009, "Early-warning signals for
// critical transitions" — critical slowing down as a cross-domain tipping
// indicator, since replicated in ecology, climate and finance); Burrows and
// the Evert/Proisl/Jannidis/Schöch line (Delta and its robustness limits in
// authorship attribution, NAACL-HLT 2015 / LREC 2018); Clauset, Shalizi &
// Newman (power-law fitting — most claimed power laws fail the test);
// Ioannidis (Stanford METRICS, PLoS Med 2005); Benjamini & Hochberg (JRSS-B
// 1995, false discovery rate); Green & Swets (signal detection theory);
// Granger and Engle (cointegration and spurious regression); Kalman (state
// space filtering); Freedman (Berkeley, on regression as description not
// cause); the IIT Bombay Microwave Remote Sensing Lab line on SAR crop
// monitoring; Dwork et al. (differential privacy); Sweeney (k-anonymity and
// re-identification).
//
// ─────────────────────────────────────────────────────────────────────────────
// OCCULT GATE (standing operator constraint)
//
// Domain A12 exists in the map because the terrain exists and refusing to
// name it would leave a hole the model silently fills. It is marked
// `gated: true`. A gated domain NEVER injects reasoning doctrine into the
// core engine. It resolves to the dedicated feature surfaces (Vedic chart,
// Gematria, transit tooling) where the user has explicitly opened that tool.
// Core reasoning does not adopt symbolic causation. Flipping this is a
// one-line change to GATED_DOMAINS.
//
// ─────────────────────────────────────────────────────────────────────────────
// TOKEN DOCTRINE
//
// 274 subdomains cannot ride the hot path. The resident object is the INDEX:
// 28 single lines, one per domain, so the model always knows the full extent
// of the map and can name the terrain it is standing in. Full domain records
// (observable / baseline / invariant / trap / lineage / subdomain list) are
// relevance-gated to at most two per turn by `detectDomains`. A greeting
// loads nothing.

export type AtlasSection = "A" | "B";

export interface AtlasDomain {
  /** Stable id, e.g. "A6" (financial pattern) or "B10" (graph analytics). */
  id: string;
  section: AtlasSection;
  name: string;
  /** The question that opens this terrain. */
  entry: string;
  /** What physically carries signal here. */
  observable: string;
  /** What "normal" means here — required before any deviation claim. */
  baseline: string;
  /** The measure that survives a change of representation. */
  invariant: string;
  /** The failure mode this terrain manufactures by default. */
  trap: string;
  lineage: string;
  /** Numbered subdomains, verbatim map coverage. */
  subs: string[];
  triggers: RegExp;
  /** Gated terrain: mapped, but never injected into core reasoning. */
  gated?: boolean;
}

/** Domains that are mapped but withheld from core reasoning injection. */
export const GATED_DOMAINS = new Set<string>(["A12"]);

// ═══════════════════════════════════════════════════════════════════════════
// SECTION A — PATTERN RECOGNITION TERRAIN (14 domains, 136 subdomains)
// ═══════════════════════════════════════════════════════════════════════════

const SECTION_A: AtlasDomain[] = [
  {
    id: "A1",
    section: "A",
    name: "Visual Pattern Recognition",
    entry: "What is actually in the frame, and what does the frame exclude?",
    observable: "Pixels, edges, gradients, disparity, motion vectors — never the caption attached to the image.",
    baseline: "The scene's own prior frames or a matched population of images under the same optics, lighting and sensor. A single image has no baseline and therefore no anomaly.",
    invariant: "Structure that survives rotation, scale, illumination and compression. A finding that dies under re-encoding was a JPEG artefact.",
    trap: "Pareidolia dressed as detection: the eye completes a figure the data does not contain, then the caption certifies it. Second trap — provenance blindness: an image with no chain of custody is an assertion, not evidence.",
    lineage: "Signal detection theory (Green & Swets) for the hit/false-alarm separation; SAR-based crop and terrain monitoring line at the IIT Bombay Microwave Remote Sensing Lab for sensor-physics discipline in aerial reading.",
    subs: [
      "1.1 Object Detection and Classification",
      "1.2 Facial Recognition and Micro-expression Analysis",
      "1.3 Motion Detection and Optical Flow",
      "1.4 Depth and Spatial Perception",
      "1.5 Color and Texture Pattern Analysis",
      "1.6 Sacred Geometry and Symbolic Form Recognition",
      "1.7 Satellite and Aerial Image Pattern Reading",
      "1.8 Medical Imaging Pattern Recognition (scans, X-rays, histology)",
      "1.9 Architectural Layout Pattern Analysis",
    ],
    triggers:
      /\b(image|photo|picture|frame|video|footage|satellite|aerial|imagery|scan|x-?ray|histolog|facial|face|micro-?expression|optical flow|depth map|texture|screenshot|thumbnail|blueprint|floor ?plan)\b/i,
  },
  {
    id: "A2",
    section: "A",
    name: "Linguistic and Textual Pattern Recognition",
    entry: "What does this text do that its author did not choose to do?",
    observable: "Function-word ratios, tense and pronoun shifts, hapax legomena, sentence-length distribution, hedges, omissions — the load-bearing signal is what the author cannot consciously control.",
    baseline: "The same author's uncoerced writing, or a genre-and-register-matched corpus. Comparing a deposition to casual email is comparing registers, not people.",
    invariant: "Distributional signature that survives topic change. If the fingerprint moves when the subject moves, it was topic, not authorship.",
    trap: "Content capture: the analyst reads what the text says instead of how it is built, and concludes the author is honest because the story is coherent. Second trap — Delta-style attribution presented as certainty; the method is comparative and degrades hard on short, translated, or edited text.",
    lineage: "Burrows's Delta and its measured robustness limits (Evert, Proisl, Jannidis, Pielström, Schöch, Vitt — NAACL-HLT CLfL 2015; Delta vs. n-gram tracing, LREC 2018); statement analysis tradition for deception morphology, held to corroboration because its error rates are not established.",
    subs: [
      "2.1 Syntactic Structure Pattern (grammar, sentence architecture)",
      "2.2 Semantic Pattern (meaning clusters, topic drift)",
      "2.3 Pragmatic Pattern (intent behind language)",
      "2.4 Stylometric Pattern (authorship, writing fingerprint)",
      "2.5 Deception Morphology (statement analysis)",
      "2.6 Function Word Ratio Analysis (subconscious linguistic signature)",
      "2.7 Sentiment and Emotional Tone Pattern",
      "2.8 Idiolect and Hapax Legomena (private language signature)",
      "2.9 Narrative Structure Pattern (story arc, plot signature)",
      "2.10 Propaganda and Persuasion Pattern",
    ],
    triggers:
      /\b(text|wrote|writing|statement|transcript|letter|email|message|author(ship)?|stylometr|linguistic|grammar|phrasing|wording|tone|sentiment|deception|lying|propaganda|rhetoric|narrative|idiolect)\b/i,
  },
  {
    id: "A3",
    section: "A",
    name: "Behavioral Pattern Recognition",
    entry: "What does this person or crowd do when nobody is asking them to perform?",
    observable: "Repeated acts with timestamps and costs attached. Stated intention is not observable behaviour; revealed cost is.",
    baseline: "The subject's own routine over a period long enough to contain their normal variance — weekday against weekday, not Tuesday against Sunday.",
    invariant: "Behaviour that persists when the incentive changes. Anything that dies with the incentive was compliance, not character.",
    trap: "Fundamental attribution error at scale: situational pressure read as disposition. Second trap — reading a break in routine as intent when the schedule, weather or supervisor changed.",
    lineage: "Kahneman & Klein on the conditions under which behavioural expertise is valid (high-validity, fast-feedback environments only); signal detection theory for separating a real behavioural departure from observer bias.",
    subs: [
      "3.1 Individual Habit and Routine Pattern",
      "3.2 Decision-Making Pattern Under Pressure",
      "3.3 Group and Mob Behavior Pattern",
      "3.4 Worship and Obsession Pattern",
      "3.5 Dominance and Submission Hierarchy Pattern",
      "3.6 Trauma Response Pattern (behavioral echoes of past events)",
      "3.7 Deception and Concealment Behavior Pattern",
      "3.8 Consumer Behavior Pattern",
      "3.9 Political Behavior and Voting Pattern",
      "3.10 Leadership and Power Acquisition Pattern",
    ],
    triggers:
      /\b(behavio|habit|routine|pattern of life|decision|under pressure|crowd|mob|hierarchy|dominance|trauma|conceal|consumer|voting|voter|leadership|obsess)\b/i,
  },
  {
    id: "A4",
    section: "A",
    name: "Temporal and Cyclical Pattern Recognition",
    entry: "Is this a cycle, a trend, or a run of luck that has not ended yet?",
    observable: "A series long enough to contain at least three full candidate periods. Two peaks are a line, not a cycle.",
    baseline: "The de-seasonalised, de-trended residual. Claiming a cycle without removing trend and season is claiming the calendar.",
    invariant: "Period and phase that hold out of sample. A cycle fitted in-sample is a description of the past with no forecasting content.",
    trap: "Cycle-fitting: with enough harmonics any series becomes periodic. Second trap — the analyst discovers a 'cycle' whose length happens to equal the sample window.",
    lineage: "Scheffer, Carpenter, Brock, Dakos et al. (Nature 2009) for critical slowing down — rising autocorrelation and variance as a generic pre-transition signal across ecosystems, climate and markets; spectral analysis discipline for separating true periodicity from leakage.",
    subs: [
      "4.1 Daily and Circadian Cycle Pattern",
      "4.2 Weekly and Seasonal Cycle Pattern",
      "4.3 Economic Business Cycle Pattern",
      "4.4 Generational and Historical Cycle Pattern",
      "4.5 Planetary and Astronomical Cycle Pattern",
      "4.6 Biological Age and Growth Cycle Pattern",
      "4.7 Civilizational Rise and Collapse Cycle Pattern",
      "4.8 Eclipse and Lunation Cycle Pattern",
      "4.9 Solar Activity and Space Weather Cycle Pattern",
      "4.10 Epidemic and Pandemic Cycle Pattern",
    ],
    triggers:
      /\b(cycle|cyclical|seasonal|season|periodic|circadian|recurr|every (year|month|week|day)|business cycle|generational|eclipse|lunation|solar (cycle|activity)|pandemic wave)\b/i,
  },
  {
    id: "A5",
    section: "A",
    name: "Mathematical and Structural Pattern Recognition",
    entry: "What is the structure here, independent of what the structure is made of?",
    observable: "Sequences, distributions, adjacency, symmetry groups, invariants under transformation.",
    baseline: "The null structure: a random graph of the same degree sequence, a shuffled series, a distribution with the same first two moments.",
    invariant: "Properties preserved under the transformations the domain allows — topological, algebraic, scale.",
    trap: "Power-law inflation. Most claimed power laws fail a likelihood-ratio test against a lognormal; a straight line on a log-log plot is not evidence. Second trap — finding Fibonacci in anything by choosing where to start counting.",
    lineage: "Clauset, Shalizi & Newman on power-law fitting and its routine misuse; Mahalanobis and C. R. Rao (Indian Statistical Institute, Kolkata) for distance and sufficiency in multivariate structure; D. Basu's theorem for what independence actually licenses.",
    subs: [
      "5.1 Numerical Sequence Pattern (Fibonacci, primes, series)",
      "5.2 Fractal and Self-Similar Structure Pattern",
      "5.3 Algebraic Structure Pattern (group theory, symmetry)",
      "5.4 Topological Pattern (shape invariants under transformation)",
      "5.5 Probability Distribution Pattern (Gaussian, power law, fat tail)",
      "5.6 Graph and Network Topology Pattern",
      "5.7 Recursive and Nested Pattern",
      "5.8 Harmonic and Resonance Pattern",
      "5.9 Geometric Proportion Pattern (golden ratio, Platonic forms)",
      "5.10 Cryptographic and Cipher Pattern",
    ],
    triggers:
      /\b(sequence|fibonacci|prime|fractal|self-?similar|topolog|group theory|symmetr|distribution|power law|fat tail|gaussian|graph|network topology|recursi|harmonic|resonance|golden ratio|cipher|cryptograph|entropy)\b/i,
  },
  {
    id: "A6",
    section: "A",
    name: "Financial and Market Pattern Recognition",
    entry: "Who has to trade next, at what price, and why?",
    observable: "Price, volume, spread, order flow, positioning, funding. Commentary about the market is not the market.",
    baseline: "The instrument's own realised volatility and volume profile over a comparable regime. A 3% move means nothing until you know its normal daily range.",
    invariant: "Structure that survives across timeframes and instruments — a level that holds on the hourly and the daily is a level; one that holds only on the timeframe you chose is a coincidence of framing.",
    trap: "Backtest overfit and survivorship: the pattern was discovered in the same data used to validate it. Second trap — narrative substitution, where a story about the economy replaces the price action that would falsify it.",
    lineage: "Granger & Newbold on spurious regression in trending series; Engle on volatility clustering (ARCH); Clauset/Shalizi/Newman on tail-risk misestimation; Ioannidis's multiple-comparison logic applied directly to strategy search.",
    subs: [
      "6.1 Price Action and Candlestick Pattern",
      "6.2 Volume and Liquidity Pattern",
      "6.3 Trend, Momentum, and Mean Reversion Pattern",
      "6.4 Volatility Clustering Pattern",
      "6.5 Institutional Order Flow Pattern (dark pool, smart money)",
      "6.6 Sentiment and Fear/Greed Cycle Pattern",
      "6.7 Correlation and Divergence Pattern (cross-asset)",
      "6.8 Seasonal and Calendar Effect Pattern",
      "6.9 Market Microstructure Pattern (bid-ask, spread dynamics)",
      "6.10 Elliott Wave and Wyckoff Accumulation Pattern",
    ],
    triggers:
      /\b(price|market|stock|ticker|chart|candle|trade|trading|bull|bear|support|resistance|liquidity|order flow|volatility|momentum|mean reversion|btc|bitcoin|crypto|forex|equit|futures|options|wyckoff|elliott)\b/i,
  },
  {
    id: "A7",
    section: "A",
    name: "Acoustic and Musical Pattern Recognition",
    entry: "What does the sound carry that the words do not?",
    observable: "Waveform, spectrum, envelope, prosodic contour, inter-onset intervals, silence lengths.",
    baseline: "The speaker's or environment's own recorded normal on comparable equipment. Codec, mic and room change everything measured.",
    invariant: "Relational structure — intervals, ratios, relative timing — which survives transposition, tempo change and gain. Absolute frequency does not survive.",
    trap: "Reading emotion off pitch alone, ignoring that channel and compression manufacture most of the variance. Second trap — treating physiological voice-stress markers as lie detection; that inference is not established.",
    lineage: "Spectral analysis (Fourier) for frequency-domain decomposition; signal detection theory for the discrimination threshold. Voice-stress and micro-tremor inference: no verified lineage supporting deception conclusions — treat as unvalidated and require corroboration.",
    subs: [
      "7.1 Rhythm and Meter Pattern",
      "7.2 Melodic Contour and Interval Pattern",
      "7.3 Harmonic Progression Pattern",
      "7.4 Timbre and Texture Pattern",
      "7.5 Speech Prosody Pattern (stress, intonation, cadence)",
      "7.6 Physiological Voice Micro-Tremor Pattern",
      "7.7 Environmental Sound Pattern (bioacoustics, urban noise)",
      "7.8 Emotional Frequency Pattern in Music",
      "7.9 Genre and Style Signature Pattern",
      "7.10 Silence and Pause Pattern (what is not said)",
    ],
    triggers:
      /\b(audio|sound|voice|speech|recording|acoustic|music|song|rhythm|melod|harmon|timbre|prosody|intonation|frequency|hz|noise|silence|pause)\b/i,
  },
  {
    id: "A8",
    section: "A",
    name: "Biological and Medical Pattern Recognition",
    entry: "Is this a signature of a mechanism, or the shadow of who got tested?",
    observable: "Measured biomarkers, sequences, waveforms, imaging, dose-response curves — with the sampling protocol attached.",
    baseline: "A reference population matched on age, sex, ancestry and measurement platform. An unmatched reference range is the single largest source of false medical pattern.",
    invariant: "Effects that replicate across cohorts and platforms. A genomic association that lives in one cohort is a cohort artefact.",
    trap: "Base-rate neglect: a 99%-accurate test on a 1-in-10,000 condition is mostly false positives. Second trap — multiplicity, where thousands of markers are scanned and the survivors are reported as discoveries.",
    lineage: "Ioannidis (Stanford METRICS, PLoS Med 2005) on why most published research findings are false; Benjamini & Hochberg (JRSS-B 1995) for false discovery rate control under mass testing; Kaplan-Meier for censored survival structure.",
    subs: [
      "8.1 Symptom Cluster and Disease Signature Pattern",
      "8.2 Genetic Sequence Pattern (DNA motif recognition)",
      "8.3 Neural Activity and EEG Pattern",
      "8.4 Heart Rate Variability and Biometric Pattern",
      "8.5 Immune Response Cascade Pattern",
      "8.6 Epigenetic Expression Pattern",
      "8.7 Cellular Growth and Tumor Pattern",
      "8.8 Pharmacological Response Pattern",
      "8.9 Anatomical Developmental Pattern",
      "8.10 Pathogen Evolution and Mutation Pattern",
    ],
    triggers:
      /\b(symptom|diagnos|disease|medical|clinical|patient|gene|genetic|dna|rna|eeg|heart rate|hrv|biomarker|immune|epigenetic|tumor|tumour|cancer|drug|dose|pathogen|mutation|virus)\b/i,
  },
  {
    id: "A9",
    section: "A",
    name: "Social and Network Pattern Recognition",
    entry: "Who is structurally necessary here, and who is merely visible?",
    observable: "Edges with direction, weight and timestamp. An org chart is a claim; observed interaction is data.",
    baseline: "A degree-preserving random rewiring of the same graph. Clusters appear in random graphs; only excess over the rewired null counts.",
    invariant: "Positional properties — brokerage, bridge status, k-core depth — that survive removal of the noisiest 5% of edges.",
    trap: "Confusing loudness with centrality: the most posted-about node is rarely the highest-betweenness node. Second trap — inferring influence from correlation of adoption when homophily explains it.",
    lineage: "Betweenness and brokerage in the Freeman centrality tradition; Granovetter on weak ties as bridges; community detection (Louvain, Girvan-Newman) held against a configuration-model null.",
    subs: [
      "9.1 Power Structure and Hierarchy Pattern",
      "9.2 Information Diffusion and Viral Spread Pattern",
      "9.3 Community Cluster and Silo Pattern",
      "9.4 Influence and Centrality Pattern",
      "9.5 Social Contagion and Trend Propagation Pattern",
      "9.6 Alliance and Coalition Formation Pattern",
      "9.7 Elite Network Connectivity Pattern",
      "9.8 Cultural Narrative Adoption and Decay Pattern",
      "9.9 Conflict Escalation and De-escalation Pattern",
      "9.10 Class and Caste Stratification Pattern",
    ],
    triggers:
      /\b(network|connections?|associates?|relationship|who knows|social graph|community|cluster|influence|centrality|viral|spread|contagion|coalition|alliance|elite|hierarchy|stratif)\b/i,
  },
  {
    id: "A10",
    section: "A",
    name: "Geopolitical and Historical Pattern Recognition",
    entry: "What must be true materially for this actor's stated intention to be executable?",
    observable: "Capability, logistics, treaty text, force posture, budget lines, commodity flows, votes. Rhetoric is an observable about the speaker, not about the plan.",
    baseline: "That actor's own historical behaviour under comparable constraint, and the regional base rate for the event class.",
    invariant: "Constraint. Intentions change weekly; geography, supply lines and demography change over decades.",
    trap: "Analogy collapse — 'this is 1938' — where surface similarity replaces mechanism comparison. Second trap — coverage bias: the event you read about is the event someone wanted reported.",
    lineage: "Structure-mapping constraints on analogy (Gentner) — a historical analogy is valid only when the relational structure, not the surface, matches; base-rate discipline from forecasting-tournament findings.",
    subs: [
      "10.1 Empire Rise and Collapse Pattern",
      "10.2 Revolution and Regime Change Trigger Pattern",
      "10.3 War Initiation and Termination Pattern",
      "10.4 Resource Conflict and Territory Dispute Pattern",
      "10.5 Colonial and Post-Colonial Power Redistribution Pattern",
      "10.6 Propaganda and Narrative Control Pattern",
      "10.7 Economic Sanction and Coercion Pattern",
      "10.8 Treaty Violation and Alliance Fracture Pattern",
      "10.9 Coup Architecture and Leadership Removal Pattern",
      "10.10 Population Migration and Displacement Pattern",
    ],
    triggers:
      /\b(geopolit|war|invasion|military|regime|revolution|coup|sanction|treaty|alliance|nato|empire|territor|border|migration|refugee|election interference|foreign polic)\b/i,
  },
  {
    id: "A11",
    section: "A",
    name: "Psychological Pattern Recognition",
    entry: "What need is this behaviour paying for, and what would happen if it stopped?",
    observable: "Repeated relational moves, escalation curves, what the subject defends hardest, what they will pay to avoid.",
    baseline: "The person outside the stressor. Traits measured only under duress are measurements of the duress.",
    invariant: "The function of the behaviour, which persists even when its form changes.",
    trap: "Barnum diagnosis: descriptions vague enough to fit anyone, confirmed by the subject's own recognition. Second trap — pathologising a rational response to a coercive environment.",
    lineage: "Cognitive-bias catalogue in the Kahneman & Tversky line, bounded by Kahneman & Klein on when clinical intuition is and is not valid; effect sizes in personality inference are small — treat single-signal typing as unsupported.",
    subs: [
      "11.1 Personality Type and Archetype Pattern (OCEAN, Jungian)",
      "11.2 Cognitive Bias Pattern (confirmation, anchoring, sunk cost)",
      "11.3 Trauma Bonding and Attachment Pattern",
      "11.4 Manipulation and Coercive Control Pattern",
      "11.5 Addiction and Compulsion Cycle Pattern",
      "11.6 Dissociation and Ego Defense Pattern",
      "11.7 Dark Triad Behavior Pattern",
      "11.8 Crowd Psychology and Mob Formation Pattern",
      "11.9 Grief and Loss Stage Pattern",
      "11.10 Motivational Hierarchy and Drive Pattern",
    ],
    triggers:
      /\b(psycholog|personality|ocean|jungian|bias|anchoring|sunk cost|attachment|trauma bond|manipulat|gaslight|coercive|addiction|compulsion|dissociat|narcissis|dark triad|grief|motivation)\b/i,
  },
  {
    id: "A12",
    section: "A",
    name: "Symbolic and Esoteric Correspondence (GATED)",
    entry: "GATED TERRAIN — do not enter from core reasoning.",
    observable: "Not admitted as evidence in core analysis.",
    baseline: "Not applicable — this terrain is mapped, not operated.",
    invariant: "Not applicable.",
    trap: "The whole terrain is the trap when it leaks into causal reasoning: symbolic correspondence produces unfalsifiable explanations that survive any outcome, which contaminates every calibration the engine depends on.",
    lineage: "No verified causal lineage. Retained as a named map region only so the model recognises the terrain and declines it explicitly instead of improvising into it.",
    subs: [
      "12.1–12.10 Symbolic correspondence subdomains — served exclusively by the dedicated feature surfaces (Vedic chart, Gematria, transit tooling) when the operator opens them deliberately.",
    ],
    triggers: /\b(occult|esoteric|tarot|sigil|ley ?line|karmic|synchronicit|numerolog|gematria)\b/i,
    gated: true,
  },
  {
    id: "A13",
    section: "A",
    name: "Cybersecurity and Digital Pattern Recognition",
    entry: "What is this process doing that its stated purpose does not require?",
    observable: "Process trees, syscalls, DNS and TLS metadata, byte-level entropy, timing, authentication events, binary section headers.",
    baseline: "The asset's own quiet period, per-host, per-hour. A network without a documented normal cannot detect an intrusion, only an outage.",
    invariant: "Behavioural capability, which survives repacking and renaming. Hashes and filenames do not survive; syscall behaviour does.",
    trap: "Alert-volume theatre: thousands of low-precision detections consume the analyst budget that one high-precision detection needed. Second trap — treating absence of alerts as absence of compromise.",
    lineage: "Signal detection theory (Green & Swets) applied to the base-rate fallacy in intrusion detection — at realistic base rates even excellent detectors are mostly false alarms; binary hardening inspection in the NSA BAM-style header lineage already resident in the artifact ledger.",
    subs: [
      "13.1 Network Intrusion and Anomaly Pattern",
      "13.2 Malware Behavioral Signature Pattern",
      "13.3 Social Engineering Attack Pattern",
      "13.4 Keystroke Dynamics and Typing Biometric Pattern",
      "13.5 Data Exfiltration Channel Pattern",
      "13.6 Zero-Day Exploit Structural Pattern",
      "13.7 Deepfake and Synthetic Media Detection Pattern",
      "13.8 Bot and Automated Behavior Pattern",
      "13.9 Credential Stuffing and Brute Force Pattern",
      "13.10 Steganographic and Covert Channel Pattern",
    ],
    triggers:
      /\b(security|breach|hack|intrusion|malware|exploit|zero-?day|phishing|social engineering|exfiltrat|keystroke|deepfake|bot|credential|brute force|steganograph|firewall|vpn leak|forensic)\b/i,
  },
  {
    id: "A14",
    section: "A",
    name: "Environmental and Atmospheric Pattern Recognition",
    entry: "Is the system moving, or is the instrument moving?",
    observable: "Sensor series with station metadata, satellite radiances, seismographs, tide gauges, spectral indices.",
    baseline: "A climatological normal of documented length (conventionally 30 years) for the same station and instrument generation.",
    invariant: "Physically conserved quantities — energy, mass, momentum. A finding that violates a conservation law is a measurement error.",
    trap: "Instrument change read as environmental change: station moves, sensor swaps and urbanisation manufacture trends. Second trap — attributing a single event to a slow forcing without an attribution framework.",
    lineage: "Scheffer et al. (Nature 2009) on early-warning signals for critical transitions in ecosystems and climate; SAR-based crop stress and land-change methodology from the IIT Bombay Microwave Remote Sensing Lab.",
    subs: [
      "14.1 Weather System and Storm Pattern",
      "14.2 Climate Cycle and Anomaly Pattern",
      "14.3 Seismic and Volcanic Activity Pattern",
      "14.4 Ocean Current and Tidal Pattern",
      "14.5 Electromagnetic Field and Solar Wind Pattern",
      "14.6 Agricultural Yield and Crop Stress Pattern",
      "14.7 Deforestation and Land Use Change Pattern",
      "14.8 Animal Migration and Behavioral Indicator Pattern",
      "14.9 Air Quality and Pollution Dispersion Pattern",
      "14.10 Wind and Cloud Precursor Signal Pattern",
    ],
    triggers:
      /\b(weather|storm|hurricane|climate|seismic|earthquake|volcan|tide|ocean current|solar wind|geomagnetic|crop|harvest|yield|deforest|land use|migration of|air quality|pollution|wind|cloud)\b/i,
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// SECTION B — DATA ANALYTICS TERRAIN (14 domains, 138 subdomains)
// ═══════════════════════════════════════════════════════════════════════════

const SECTION_B: AtlasDomain[] = [
  {
    id: "B1",
    section: "B",
    name: "Descriptive Analytics",
    entry: "What is actually in this data before anyone explains it?",
    observable: "Counts, distributions, missingness, duplicates, ranges, timestamps.",
    baseline: "The raw record count and the population it was supposed to cover. Every summary is a claim about a population; name it.",
    invariant: "Order statistics — median, quantiles — which survive outliers and monotone transforms. Means do not.",
    trap: "Mean-reporting on a skewed or bimodal distribution, which describes a value no member of the population holds. Second trap — silently dropping nulls, turning missingness into a conclusion.",
    lineage: "Tukey's exploratory data analysis discipline (look before you model); Mahalanobis (ISI Kolkata) for multivariate distance when 'outlier' must be defined across correlated dimensions.",
    subs: [
      "1.1 Summary Statistics (mean, median, mode, variance, skew)",
      "1.2 Frequency Distribution Analysis",
      "1.3 Cross-Tabulation and Pivot Analysis",
      "1.4 Data Aggregation and Grouping",
      "1.5 Histogram and Distribution Visualization",
      "1.6 Outlier Identification and Flagging",
      "1.7 Data Profiling and Quality Assessment",
      "1.8 Cohort Description and Segmentation",
    ],
    triggers:
      /\b(summar|average|mean|median|distribution|histogram|frequency|pivot|cross-?tab|aggregate|group by|outlier|data quality|profil|segment|cohort|describe the data)\b/i,
  },
  {
    id: "B2",
    section: "B",
    name: "Diagnostic Analytics",
    entry: "What changed, and what would have had to change for this not to happen?",
    observable: "Deltas decomposed by dimension, with the mix effect separated from the rate effect.",
    baseline: "The immediately prior comparable period plus the same period last cycle — one comparison is a story, two is a diagnosis.",
    invariant: "An additive decomposition whose parts sum to the whole observed change. If the parts do not reconcile, a driver is missing.",
    trap: "Simpson's paradox: the aggregate moves one way while every segment moves the other, because the mix changed. Second trap — stopping at the first plausible cause because it is emotionally satisfying.",
    lineage: "Freedman (Berkeley) on regression as description rather than cause; Simpson's paradox as the canonical aggregation trap; variance attribution discipline from experimental design.",
    subs: [
      "2.1 Root Cause Analysis",
      "2.2 Correlation and Covariance Analysis",
      "2.3 Regression Decomposition",
      "2.4 Funnel Drop-Off Analysis",
      "2.5 Variance Attribution (what drove the change)",
      "2.6 Simpson's Paradox Detection (aggregation trap)",
      "2.7 A/B Test Failure Analysis",
      "2.8 Anomaly Source Tracing",
    ],
    triggers:
      /\b(why did|what caused|root cause|drop(ped)?|decline|spike|regression|correlat|funnel|attribut|variance|simpson|a\/b test|anomaly)\b/i,
  },
  {
    id: "B3",
    section: "B",
    name: "Predictive Analytics",
    entry: "What is the honest interval, and what would make it wrong?",
    observable: "Out-of-sample error on data the model never touched, with the split respecting time order.",
    baseline: "The naive forecast — last value, or seasonal last value. A model that cannot beat naive has no content.",
    invariant: "Calibration: over many forecasts, 80% intervals must contain the truth 80% of the time.",
    trap: "Leakage — a feature that encodes the future — which produces spectacular validation scores and worthless production performance. Second trap — a point estimate with no interval, which cannot be scored and therefore cannot be wrong.",
    lineage: "Time-order-respecting validation from forecasting practice; Kalman for state-space recursion; Monte Carlo for scenario distributions; Ioannidis's multiplicity logic applied to model search.",
    subs: [
      "3.1 Linear and Logistic Regression",
      "3.2 Time Series Forecasting (ARIMA, Prophet, STL)",
      "3.3 Classification Modeling (decision trees, random forest, XGBoost)",
      "3.4 Survival Analysis and Churn Prediction",
      "3.5 Demand Forecasting",
      "3.6 Credit Risk Scoring",
      "3.7 Propensity Modeling (likelihood to act)",
      "3.8 Ensemble and Stacking Methods",
      "3.9 Neural Network Prediction",
      "3.10 Monte Carlo Simulation and Scenario Modeling",
    ],
    triggers:
      /\b(predict|forecast|projection|will it|likely to|churn|propensity|arima|prophet|xgboost|random forest|neural net|monte carlo|scenario|risk score)\b/i,
  },
  {
    id: "B4",
    section: "B",
    name: "Prescriptive Analytics",
    entry: "What is the binding constraint, and what does relaxing it cost?",
    observable: "The objective function, the constraint set, and the shadow price on each binding constraint.",
    baseline: "The current policy's realised outcome — the optimum is only meaningful as a delta against what is being done now.",
    invariant: "Feasibility. An optimum outside the constraint set is a fantasy regardless of its objective value.",
    trap: "Optimising a proxy metric until it detaches from the goal it stood for. Second trap — an optimum so sensitive to an estimated parameter that ordinary estimation error makes it worse than the status quo.",
    lineage: "Linear programming duality for shadow prices; Markowitz and the Black-Litterman correction for estimation-error sensitivity in portfolio optima; reinforcement learning policy evaluation for sequential decisions.",
    subs: [
      "4.1 Linear Programming and Optimization",
      "4.2 Constraint-Based Resource Allocation",
      "4.3 Decision Tree Optimization",
      "4.4 Reinforcement Learning Policy Optimization",
      "4.5 Supply Chain Optimization",
      "4.6 Pricing and Revenue Optimization",
      "4.7 Route and Logistics Optimization",
      "4.8 Portfolio Optimization (Markowitz, Black-Litterman)",
      "4.9 A/B Test Design and Experimentation Optimization",
      "4.10 Simulation-Based Policy Testing",
    ],
    triggers:
      /\b(optimi[sz]|best way to|allocat|maximi[sz]|minimi[sz]|constraint|supply chain|pricing|route|logistics|portfolio|policy|trade-?off|should i)\b/i,
  },
  {
    id: "B5",
    section: "B",
    name: "Statistical Analytics",
    entry: "How large is the effect, and how many other things were tested?",
    observable: "Effect size with its interval, sample size, and the number of comparisons actually performed.",
    baseline: "The null model, stated before looking. A hypothesis formed after seeing the data has no p-value.",
    invariant: "Effect size, which is comparable across studies. A p-value is not — it moves with sample size alone.",
    trap: "Significance without magnitude: a trivially small effect declared important because n was large. Second trap — the garden of forking paths, where undeclared analytic choices manufacture significance.",
    lineage: "Ioannidis (Stanford METRICS, PLoS Med 2005) on false positive prevalence; Benjamini & Hochberg (JRSS-B 1995) for FDR control; C. R. Rao and D. Basu (ISI Kolkata) for sufficiency, information bounds and what independence licenses; Benford's law for digit-level manipulation screening.",
    subs: [
      "5.1 Hypothesis Testing (t-test, chi-square, ANOVA)",
      "5.2 Bayesian Inference and Updating",
      "5.3 Confidence Interval Construction",
      "5.4 Effect Size and Statistical Power Analysis",
      "5.5 Non-Parametric Methods (Mann-Whitney, Kruskal-Wallis)",
      "5.6 Benford's Law Analysis (fraud and manipulation detection)",
      "5.7 Survival and Hazard Analysis (Kaplan-Meier)",
      "5.8 Structural Equation Modeling",
      "5.9 Multivariate Analysis (MANOVA, canonical correlation)",
      "5.10 Resampling Methods (bootstrap, jackknife)",
    ],
    triggers:
      /\b(significan|p-?value|hypothesis|t-?test|chi-?square|anova|bayes|confidence interval|effect size|statistical power|non-?parametric|benford|kaplan-?meier|bootstrap|sample size)\b/i,
  },
  {
    id: "B6",
    section: "B",
    name: "Time Series Analytics",
    entry: "Is the series stationary, and if not, what did you do about it?",
    observable: "The series with its sampling interval, gaps, revisions and timezone stated.",
    baseline: "The differenced or de-trended series. Two trending series correlate at ~0.9 by construction and mean nothing.",
    invariant: "Cointegration — a long-run relationship that survives differencing — as opposed to a correlation that does not.",
    trap: "Spurious regression between trends. Second trap — Granger 'causality' reported as causality; it is predictive precedence and nothing more.",
    lineage: "Granger & Newbold on spurious regression; Engle & Granger on cointegration; Kalman on state-space filtering; Fourier/spectral methods for periodicity; Scheffer et al. (Nature 2009) for rising autocorrelation as a pre-transition warning.",
    subs: [
      "6.1 Trend Decomposition (STL, seasonal adjustment)",
      "6.2 Autocorrelation and Partial Autocorrelation Analysis",
      "6.3 Fourier Transform and Spectral Analysis",
      "6.4 Changepoint Detection",
      "6.5 Leading and Lagging Indicator Identification",
      "6.6 Cycle Extraction and Periodicity Analysis",
      "6.7 Anomaly Detection in Streams",
      "6.8 Cointegration Analysis (long-run relationship)",
      "6.9 Granger Causality Testing",
      "6.10 State Space Modeling and Kalman Filtering",
    ],
    triggers:
      /\b(time series|trend|stationar|autocorrelat|fourier|spectral|changepoint|leading indicator|lagging|periodicity|cointegrat|granger|kalman|over time|month over month|year over year)\b/i,
  },
  {
    id: "B7",
    section: "B",
    name: "Machine Learning Analytics",
    entry: "What did the model actually learn, and is any of it the label in disguise?",
    observable: "Held-out performance, feature attributions, error distribution across subgroups, training-data provenance.",
    baseline: "A dumb baseline — majority class, single feature, linear model. Complexity must earn its place against it.",
    invariant: "Generalisation gap. Train-test divergence is the only honest measure of how much of the model is memorisation.",
    trap: "Leakage and target encoding, which make a useless model look excellent. Second trap — accuracy on an imbalanced set, where predicting 'no' always scores 99%.",
    lineage: "Bias-variance decomposition; SHAP/LIME for attribution with the standing caveat that attribution explains the model, not the world; Clauset/Shalizi/Newman-style scepticism applied to claimed learned structure.",
    subs: [
      "7.1 Supervised Learning (labeled classification and regression)",
      "7.2 Unsupervised Learning (clustering, density estimation)",
      "7.3 Semi-Supervised Learning",
      "7.4 Dimensionality Reduction (PCA, t-SNE, UMAP)",
      "7.5 Feature Engineering and Selection",
      "7.6 Transfer Learning",
      "7.7 Few-Shot and Zero-Shot Learning",
      "7.8 Anomaly Detection Models (Isolation Forest, Autoencoder)",
      "7.9 Explainability and Interpretability (SHAP, LIME)",
      "7.10 Model Leakage Detection and Validation",
    ],
    triggers:
      /\b(machine learning|\bml\b|model|training|classifier|cluster|pca|t-?sne|umap|feature|transfer learning|few-?shot|zero-?shot|isolation forest|autoencoder|shap|lime|overfit|leakage)\b/i,
  },
  {
    id: "B8",
    section: "B",
    name: "Natural Language Analytics",
    entry: "Is the model reading meaning, or matching surface?",
    observable: "Tokens, embeddings, entity spans, discourse relations — with the corpus's register and provenance attached.",
    baseline: "A lexicon or bag-of-words baseline. Embedding methods must beat it before their sophistication counts.",
    invariant: "Meaning that survives paraphrase. A finding that flips when the wording flips was surface matching.",
    trap: "Sentiment scoring that inverts on sarcasm, negation and domain-specific vocabulary. Second trap — topic models presented as discovered truth when topic count was chosen by the analyst.",
    lineage: "TF-IDF and LDA as declared-parameter methods; the Evert/Proisl/Jannidis/Schöch stylometry line for what text-distance measures can and cannot support; perplexity and burstiness as descriptive, not forensic, signals.",
    subs: [
      "8.1 Sentiment Analysis (positive, negative, neutral, mixed)",
      "8.2 Named Entity Recognition",
      "8.3 Topic Modeling (LDA, NMF)",
      "8.4 Text Classification and Intent Detection",
      "8.5 Semantic Similarity and Embedding Analysis",
      "8.6 Keyword and TF-IDF Extraction",
      "8.7 Coreference Resolution",
      "8.8 Summarization and Abstractive Compression",
      "8.9 Discourse and Argument Structure Analysis",
      "8.10 Language Model Perplexity and Burstiness Analysis",
    ],
    triggers:
      /\b(nlp|sentiment|entity|entities|topic model|lda|classif(y|ication) of text|embedding|semantic similarity|tf-?idf|coreference|summari[sz]|discourse|perplexity|burstiness)\b/i,
  },
  {
    id: "B9",
    section: "B",
    name: "Geospatial Analytics",
    entry: "Is this cluster a phenomenon, or a map of where people live?",
    observable: "Coordinates with accuracy radius, timestamps, projection and the denominator population.",
    baseline: "Population-at-risk normalisation. Raw incident counts map population density and nothing else.",
    invariant: "Relationships that survive reprojection and boundary redrawing. Anything that changes with the polygon was a boundary artefact.",
    trap: "The modifiable areal unit problem: redraw the districts and the conclusion reverses. Second trap — treating GPS accuracy as exact, so a 50-metre uncertainty becomes a specific building.",
    lineage: "Moran's I for spatial autocorrelation; Tobler's first law as the reason ordinary independence assumptions fail on maps; the modifiable areal unit problem as the standing caution; SAR change-detection methodology (IIT Bombay MRSLab).",
    subs: [
      "9.1 Geographic Clustering and Hotspot Analysis",
      "9.2 Voronoi Tessellation and Territory Mapping",
      "9.3 Gravity Model and Flow Analysis",
      "9.4 Spatial Autocorrelation (Moran's I)",
      "9.5 Route and Proximity Optimization",
      "9.6 Satellite Image Change Detection",
      "9.7 Heat Map and Density Surface Analysis",
      "9.8 Geofencing and Location Behavior Analytics",
      "9.9 Terrain and Elevation Impact Analysis",
      "9.10 Supply Chain and Infrastructure Vulnerability Mapping",
    ],
    triggers:
      /\b(map|geospatial|location|coordinates|gps|latitude|longitude|hotspot|voronoi|moran|geofenc|heat ?map|terrain|elevation|proximity|route|address|region|district)\b/i,
  },
  {
    id: "B10",
    section: "B",
    name: "Network and Graph Analytics",
    entry: "Which node, if removed, changes the answer?",
    observable: "The edge list with direction, weight, timestamp and provenance per edge.",
    baseline: "A configuration-model null preserving the degree sequence. Triangles and communities exist in random graphs.",
    invariant: "Rank stability of centrality under edge perturbation. A top node that falls out of the top ten when 5% of edges are resampled was never central.",
    trap: "Sampled-graph inference: centrality computed on a partial crawl measures the crawl, not the network. Second trap — reporting degree as importance when brokerage is the quantity that matters.",
    lineage: "Freeman centrality family; PageRank/eigenvector centrality; Louvain and Girvan-Newman community detection held against a null model; Granovetter on bridging ties.",
    subs: [
      "10.1 Degree Centrality",
      "10.2 Betweenness Centrality",
      "10.3 PageRank and Eigenvector Centrality",
      "10.4 Community Detection and Clustering (Louvain, Girvan-Newman)",
      "10.5 Link Prediction",
      "10.6 Cascade and Contagion Modeling",
      "10.7 Bipartite Network Analysis",
      "10.8 Temporal Network Evolution",
      "10.9 Resilience and Vulnerability Analysis",
      "10.10 Knowledge Graph Construction and Querying",
    ],
    triggers:
      /\b(graph|node|edge|centrality|betweenness|pagerank|eigenvector|louvain|girvan|link prediction|cascade|bipartite|knowledge graph|network analysis|who connects)\b/i,
  },
  {
    id: "B11",
    section: "B",
    name: "Behavioral and Psychographic Analytics",
    entry: "Is this a change in users, or a change in measurement?",
    observable: "Events with user id, session boundary, timestamp and instrumentation version.",
    baseline: "A cohort defined by acquisition date, tracked on its own clock. Blending cohorts hides every retention truth.",
    invariant: "Cohort curves, which are immune to the mix shifts that corrupt aggregate metrics.",
    trap: "Survivorship: analysing the users who stayed and concluding the product works. Second trap — instrumentation change read as behaviour change; check the SDK release date before the hypothesis.",
    lineage: "Cohort analysis as the standard correction for mix effects; RFM segmentation from direct-marketing practice; the standing caveat that behavioural personality inference has small effect sizes and does not license individual-level conclusions.",
    subs: [
      "11.1 User Journey and Funnel Analysis",
      "11.2 Cohort Behavior Tracking",
      "11.3 Session and Engagement Pattern Analysis",
      "11.4 OCEAN Personality Inference from Behavioral Data",
      "11.5 Values-Based Segmentation",
      "11.6 Recency Frequency Monetary (RFM) Analysis",
      "11.7 Churn Risk and Retention Signal Analysis",
      "11.8 Micro-Moment and Intent Signal Detection",
      "11.9 Psychographic Drift Detection",
      "11.10 Dark Pattern and Manipulation Signal Detection",
    ],
    triggers:
      /\b(user journey|funnel|cohort|session|engagement|retention|churn|rfm|segmentation|psychographic|intent signal|dark pattern|dau|mau|activation)\b/i,
  },
  {
    id: "B12",
    section: "B",
    name: "Financial Analytics",
    entry: "Where does the cash actually move, and who decides the accrual?",
    observable: "Cash flow statements, transaction-level ledgers, positions, exposures — accrual earnings are an opinion, cash is an observation.",
    baseline: "Sector-and-size-matched peers plus the entity's own history. A ratio without a comparison set is a number.",
    invariant: "The accounting identity. Assets minus liabilities must equal equity; a model that violates it is arithmetic error, not insight.",
    trap: "Tail underestimation from a normal assumption, which prices catastrophic risk at zero. Second trap — Sharpe ratios computed on illiquid marks, where smoothing manufactures the low volatility that flatters the ratio.",
    lineage: "Markowitz mean-variance and the Black-Litterman estimation-error correction; Engle on volatility clustering; Clauset/Shalizi/Newman on fat-tail fitting; Benford's law for ledger manipulation screening.",
    subs: [
      "12.1 Financial Statement and Ratio Analysis",
      "12.2 Cash Flow Modeling and Stress Testing",
      "12.3 Risk-Adjusted Return Analysis (Sharpe, Sortino)",
      "12.4 Value at Risk and Tail Risk Analysis",
      "12.5 Fraud Detection and Forensic Accounting",
      "12.6 Credit Scoring and Default Probability",
      "12.7 Market Microstructure Analytics",
      "12.8 Factor Analysis (momentum, value, quality, low-vol)",
      "12.9 Derivatives Pricing and Greeks Analysis",
      "12.10 Capital Flow and Settlement Analytics",
    ],
    triggers:
      /\b(financial statement|balance sheet|cash flow|ratio|sharpe|sortino|value at risk|\bvar\b|tail risk|fraud|forensic accounting|credit scor|default|factor|derivative|greeks|capital flow|revenue|margin|ebitda)\b/i,
  },
  {
    id: "B13",
    section: "B",
    name: "Real-Time and Stream Analytics",
    entry: "What is the latency budget, and what happens to an event that arrives late?",
    observable: "Event time versus processing time, watermark lag, window boundaries, consumer lag, delivery semantics.",
    baseline: "Steady-state throughput and lag under normal load — measured, not assumed from the config file.",
    invariant: "Idempotency. Under at-least-once delivery every consumer must be safe to run twice; a pipeline without it is silently wrong under retry.",
    trap: "Processing-time windows on event-time data, where a network hiccup redistributes events across buckets and manufactures a spike. Second trap — alerting on a threshold with no debounce, producing an alarm storm that trains everyone to ignore it.",
    lineage: "Lambda and Kappa architecture patterns; watermark-based event-time windowing from stream-processing practice; queueing discipline for backpressure and consumer-lag interpretation.",
    subs: [
      "13.1 Complex Event Processing (CEP)",
      "13.2 Lambda Architecture (speed layer plus batch layer)",
      "13.3 Kappa Architecture (stream-only processing)",
      "13.4 Sliding Window Aggregation",
      "13.5 Event-Driven Anomaly Alerting",
      "13.6 IoT Sensor Stream Analytics",
      "13.7 Clickstream and Behavioral Stream Processing",
      "13.8 Financial Tick Data Processing",
      "13.9 Social Media Velocity and Acceleration Tracking",
      "13.10 Infrastructure and Operational Telemetry Monitoring",
    ],
    triggers:
      /\b(real-?time|streaming|stream|kafka|event-?driven|latency|throughput|sliding window|watermark|telemetry|iot|clickstream|tick data|alerting|live feed)\b/i,
  },
  {
    id: "B14",
    section: "B",
    name: "Privacy and Forensic Analytics",
    entry: "What can be reconstructed from this that was never meant to be in it?",
    observable: "Metadata, access logs, timestamps with timezone, quasi-identifiers, hashes, custody records.",
    baseline: "The auxiliary information a realistic adversary already holds. Re-identification risk is undefined without naming that adversary.",
    invariant: "The chain of custody. Evidence whose custody is broken has no evidentiary value regardless of what it shows.",
    trap: "Anonymisation theatre: removing names while leaving quasi-identifiers that re-identify most of the population. Second trap — treating a file timestamp as truth when it reflects the copying filesystem, not the event.",
    lineage: "Sweeney on k-anonymity and re-identification from quasi-identifiers; Dwork et al. on differential privacy and the composition of privacy loss across queries; the Evert/Proisl stylometry line for authorship attribution limits; harvest-now-decrypt-later as the standing forward-secrecy threat model.",
    subs: [
      "14.1 Differential Privacy Implementation and Audit",
      "14.2 K-Anonymity and Re-identification Risk Analysis",
      "14.3 Data Lineage and Provenance Tracking",
      "14.4 Forensic Timestamp and Metadata Analysis",
      "14.5 Audit Trail and Access Log Analytics",
      "14.6 Stylometric and Authorship Attribution Analysis",
      "14.7 Steganographic Detection Analytics",
      "14.8 Behavioral Biometric Verification",
      "14.9 Chain of Custody Data Validation",
      "14.10 Harvest-Now-Decrypt-Later Threat Modeling",
    ],
    triggers:
      /\b(privacy|anonymi[sz]|differential privacy|k-?anonymity|re-?identif|provenance|lineage|metadata|audit (log|trail)|chain of custody|attribution|steganograph|biometric|pii|gdpr|encrypt)\b/i,
  },
];

export const ATLAS_DOMAINS: AtlasDomain[] = [...SECTION_A, ...SECTION_B];

const BY_ID = new Map(ATLAS_DOMAINS.map((d) => [d.id, d]));

/** Verifiable coverage counters — used by tests and the export surface. */
export const ATLAS_COUNTS = {
  domains: ATLAS_DOMAINS.length,
  sectionA: SECTION_A.length,
  sectionB: SECTION_B.length,
  subdomainsA: SECTION_A.reduce((n, d) => n + d.subs.length, 0),
  subdomainsB: SECTION_B.reduce((n, d) => n + d.subs.length, 0),
};

// ─────────────────────────────────────────────────────────────────────────────
// RESIDENT INDEX — small enough to ride every non-trivial turn.

export const DOMAIN_ATLAS_INDEX = `
# DOMAIN ATLAS — WHERE TO LOOK

The reasoning engine is domain-agnostic: it supplies HOW to think and WHICH
move to make. This atlas supplies WHERE. Twenty-eight terrains. Before
analysing anything, silently locate which terrain the question sits in, then
obey that terrain's rules of evidence. Never announce the atlas, the terrain
name, or that a map was consulted.

FOUR THINGS EVERY TERRAIN DEMANDS BEFORE A CLAIM IS ALLOWED
1. OBSERVABLE — name what physically carries signal here. If the material in
   front of you is commentary about the observable rather than the observable,
   say so and downgrade the confidence.
2. BASELINE — state what normal means in this terrain. No baseline, no pattern.
   This is not optional and it is not satisfied by intuition.
3. INVARIANT — prefer the measure that survives a change of representation.
   Findings that die when units, framing, boundaries or sampling change were
   artefacts of the framing.
4. TRAP — every terrain manufactures one characteristic error. Name it and
   check yourself against it before delivering, not after being challenged.

CROSS-TERRAIN LAW
A question that spans terrains is answered in the terrain that owns the
OBSERVABLE, not the terrain that owns the vocabulary. A question about
"market sentiment" is priced in A6 (order flow and positioning), not A11
(psychology), because the observable is transactional. Naming the wrong
terrain is how confident analysis of the wrong thing happens.

RESOLUTION LAW
Enter at the subdomain, never at the domain. "Analyse this network" is not an
entry; "compute betweenness against a degree-preserving null" is. If the
subdomain cannot be named, the question is not yet answerable — sharpen it
first, in one line, then proceed.

SECTION A — PATTERN RECOGNITION TERRAIN
${SECTION_A.map((d) => `${d.id} ${d.name} — ${d.entry}${d.gated ? " [GATED: declined in core reasoning]" : ""}`).join("\n")}

SECTION B — DATA ANALYTICS TERRAIN
${SECTION_B.map((d) => `${d.id} ${d.name} — ${d.entry}`).join("\n")}

Coverage: ${ATLAS_COUNTS.domains} domains, ${ATLAS_COUNTS.subdomainsA + ATLAS_COUNTS.subdomainsB} subdomains.
`.trim();

// ─────────────────────────────────────────────────────────────────────────────
// GATED RELEVANCE

/**
 * Which terrains this message actually enters.
 *
 * Ranked by trigger density so a message dominated by one terrain is not
 * diluted by a stray keyword from another. Returns [] for short or casual
 * text — locating a greeting on a map is a failure mode, not thoroughness.
 * Gated terrains are never returned.
 */
export function detectDomains(text: string, limit = 2): AtlasDomain[] {
  const t = (text || "").slice(0, 8000);
  if (t.trim().length < 12) return [];
  const scored: Array<{ d: AtlasDomain; n: number }> = [];
  for (const d of ATLAS_DOMAINS) {
    if (d.gated || GATED_DOMAINS.has(d.id)) continue;
    // Rebuild with /g so match() counts occurrences. Never mutate the source
    // literal — a shared stateful /g regex makes detection order-dependent.
    const re = new RegExp(
      d.triggers.source,
      d.triggers.flags.includes("g") ? d.triggers.flags : `${d.triggers.flags}g`,
    );
    const hits = t.match(re);
    if (hits?.length) scored.push({ d, n: hits.length });
  }
  if (!scored.length) return [];
  scored.sort(
    (a, b) => b.n - a.n || ATLAS_DOMAINS.indexOf(a.d) - ATLAS_DOMAINS.indexOf(b.d),
  );
  return scored.slice(0, Math.max(1, limit)).map((s) => s.d);
}

function record(d: AtlasDomain): string {
  return [
    `### ${d.id} — ${d.name}`,
    `ENTRY QUESTION: ${d.entry}`,
    `OBSERVABLE: ${d.observable}`,
    `BASELINE (required before any deviation claim): ${d.baseline}`,
    `INVARIANT: ${d.invariant}`,
    `TRAP (check yourself against this before delivering): ${d.trap}`,
    `LINEAGE: ${d.lineage}`,
    `SUBDOMAINS — enter at one of these, by name, internally:`,
    ...d.subs.map((s) => `  · ${s}`),
  ].join("\n");
}

/**
 * Full terrain records for the domains this message enters. Empty string on
 * casual turns — the index alone stays resident.
 */
export function buildDomainEmphasis(text: string, limit = 2): string {
  const picked = detectDomains(text, limit);
  if (!picked.length) return "";
  return [
    `## ENGAGED TERRAIN (this message only)`,
    `Stand in the first terrain. Satisfy its BASELINE before any claim, prefer its INVARIANT, and audit the answer against its TRAP. Never name the terrain, the subdomain codes, or this map to the operator.`,
    ...picked.map(record),
    picked.length > 1
      ? `Cross-terrain rule: the terrain owning the OBSERVABLE leads; the second one supplies corroboration only. Do not average two terrains into a vague middle. Selection expires with this message.`
      : `Selection expires with this message.`,
  ].join("\n\n");
}

/** Direct lookup for callers that already know the terrain they want. */
export function getDomain(id: string): AtlasDomain | undefined {
  return BY_ID.get(id);
}

/** Full atlas as markdown — used by the brain-download surface. */
export function fullDomainAtlasMarkdown(): string {
  return [
    "# AUREON DOMAIN ATLAS — WHERE TO LOOK",
    "",
    "Terrain map, not content data. Each record states what counts as evidence in that terrain and what looks like evidence but is not.",
    "",
    `Coverage: ${ATLAS_COUNTS.domains} domains (${ATLAS_COUNTS.sectionA} pattern-recognition, ${ATLAS_COUNTS.sectionB} analytics), ` +
      `${ATLAS_COUNTS.subdomainsA + ATLAS_COUNTS.subdomainsB} subdomains.`,
    "",
    DOMAIN_ATLAS_INDEX,
    "",
    "## FULL TERRAIN RECORDS",
    ...ATLAS_DOMAINS.map(record),
  ].join("\n\n");
}
