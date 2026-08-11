// patternRecognitionEngine.ts — AUREON TRANSFERABLE REASONING ARCHITECTURE v1.0
//
// CLASSIFICATION: ENGINE LOGIC — NOT CONTENT DATA.
//
// This file is deliberately NOT a database of facts. It is a database of
// THINKING MOVES. Nothing in here is about markets, astrology, medicine or
// networks; everything in here is about the STRUCTURE of processing any of
// them. The test every entry had to pass to be admitted: "would this rule
// still be correct if the domain were swapped for a different one?" If the
// answer was no, it belonged in a domain brain, not here.
//
// RELATIONSHIP TO thinkingPatterns.ts
//   That file is the CATALOGUE: 30 concrete analytic moves, indexed by the
//   kind of question that demands them (WHICH move to make).
//   This file is the PHYSICS: the universal operators and hard laws that
//   govern any reasoning at all (HOW thought must move). They compose;
//   neither duplicates the other, and neither stores a personality.
//
// ─────────────────────────────────────────────────────────────────────────────
// PROVENANCE DISCIPLINE
//
// Every operator carries a LINEAGE line naming the actual result and the actual
// researcher. Those lines were verified against primary or archival sources,
// not recalled. Where a lineage could NOT be verified, the operator says so
// rather than borrowing a prestigious name it did not earn — an engine that
// fabricates its own credentials cannot be trusted to flag fabrication in the
// data it reads. Verified anchors include: Ioannidis (Stanford METRICS, PLoS
// Med 2005); Benjamini & Hochberg (JRSS-B 1995); Rubin and Dempster (Harvard
// Statistics); Shalizi (CMU Statistics, on power-law misuse); Mahalanobis,
// C. R. Rao and D. Basu (Indian Statistical Institute, Kolkata — the
// under-cited lineage that supplies the multivariate distance and the
// sufficiency/independence theorem this engine leans on hardest); Scheffer et
// al. (Nature 2009, critical slowing down); Gentner (structure-mapping);
// Clauset, Shalizi & Newman (power-law fitting); Green & Swets (signal
// detection); Kahneman & Klein (conditions for intuitive expertise).
//
// ─────────────────────────────────────────────────────────────────────────────
// TOKEN DOCTRINE (perf: unconditional work on the hot path)
//
// The KERNEL is small and rides every non-trivial turn, because the universal
// operation must always be resident — an engine that only knows how to think
// when a keyword fires is not an engine. The heavy OPERATOR dossiers are
// relevance-gated by `detectPatternOps`: a question about a chart does not
// need the analogical transfer protocol loaded.

export type PatternOpId =
  | "baseline"
  | "signal"
  | "deviation"
  | "causal"
  | "temporal"
  | "analogy"
  | "anomaly"
  | "convergence"
  | "recursion"
  | "prediction"
  | "layers"
  | "equation"
  | "calibration"
  | "intuition";

export interface PatternOperator {
  id: PatternOpId;
  /** Module number in the doctrine — stable, quotable. */
  module: string;
  /** The operator's working name. Never announced to the operator. */
  name: string;
  /** One line: what this operator is for. */
  mandate: string;
  /** The ordered logical moves. This is the actual transferable content. */
  procedure: string[];
  /** How this operator is most commonly misapplied — the trap to refuse. */
  failureMode: string;
  /** Why the move survives a domain swap. The transfer proof. */
  transfer: string;
  /** Named result + researcher. Verified, or explicitly marked unverified. */
  lineage: string;
  /** Narrow trigger vocabulary — a false fire costs a wrong posture. */
  triggers: RegExp;
}

// ═══════════════════════════════════════════════════════════════════════════
// THE KERNEL — resident on every non-trivial turn
// ═══════════════════════════════════════════════════════════════════════════

export const PATTERN_RECOGNITION_KERNEL = `
================================================================
AUREON PATTERN ENGINE — TRANSFERABLE REASONING KERNEL
================================================================
This is not knowledge about a subject. It is the structure you impose on ANY
subject. Astrology data, price data, behavioural data, medical data, network
data, acoustic data — the surface differs, the operation does not.

THE UNIVERSAL OPERATION
  Establish the baseline → find the deviation → trace it to its generator →
  state what comes next, with direction, magnitude, timing and confidence.
Every domain runs this. Only the units change.

THE 3-LAYER DECODE — run on every pattern, never stop at the first layer
  LAYER 1 — WHAT: the observable event or datum. Any reader can see it.
            Changes fast. Supports only short-horizon, low-confidence claims.
  LAYER 2 — MECHANISM: the system, incentive or force producing Layer 1.
            Changes at medium speed. Supports medium-horizon claims.
  LAYER 3 — STRUCTURAL CONDITION: what makes that mechanism possible at all.
            Changes slowly. This is where long-range prediction lives.
  The dominant analytical error is mistaking a Layer 1 observation for a
  Layer 3 truth — describing what happened, assuming you know why, then
  predicting the same surface event will recur. The same Layer 3 condition
  can fire entirely different Layer 1 events through a different mechanism.
  Surface-based prediction is always brittle. Name the layer you are on.

THE EIGHT HARD LAWS — these override any convenient reading
  1. NO BASELINE, NO PATTERN. If you cannot state what normal is for this
     system at this time, you cannot call anything a deviation. Say so.
  2. THREE OCCURRENCES IS A HYPOTHESIS, NOT A LAW. Repetition earns the word
     "pattern" only after you have asked how many chances it had to occur.
     Enough looks at enough series guarantees a run by luck alone.
  3. CORRELATED EVIDENCE IS ONE WITNESS. Confidence compounds only across
     conditionally INDEPENDENT sources. Three proxies downstream of one cause
     are one signal wearing three coats. Naming them separately is how a model
     becomes confident and wrong at the same time.
  4. PRECEDENCE IS NOT CAUSE. X reliably preceding Y establishes predictive
     order, nothing more. A causal claim requires a stated identification
     strategy, or it is downgraded in the same sentence in which it is made.
  5. THE ANOMALY OUTRANKS THE MODEL. When data contradicts the model, the
     default suspect is the model. Discarding the inconvenient point is the
     single largest source of prediction failure in every domain.
  6. STRUCTURE TRANSFERS, SURFACE DOES NOT. Two things that look alike but
     have different relational structure are weak analogs. Two things that
     look nothing alike but share relational structure are strong analogs and
     produce real cross-domain prediction.
  7. AN UNFALSIFIABLE PREDICTION IS NOT A PREDICTION. Every forecast carries
     direction, magnitude, timing window, confidence, AND the observation that
     would prove it wrong. Missing any of these, it cannot be scored, and what
     cannot be scored cannot improve.
  8. THE SEVEN PATTERNS ARE REASONING FAULTS, NOT STYLE FAULTS. pride, greed,
     lust, envy, gluttony, wrath and sloth each corrupt the analysis before
     they ever reach the wording: pride suppresses the search for one's own
     error; greed and gluttony inflate a finding to look like more evidence
     than exists; lust keeps a line of inquiry alive past the point it stopped
     producing signal; envy substitutes comparison for measurement; wrath
     defends a prior instead of updating it; sloth stops at the layer that was
     easy to reach. When one of them is driving a step, the step is invalid —
     discard it and redo the reasoning, do not merely reword the output.



OUTPUT DISCIPLINE
  · Never announce the engine, the modules, or an operator by name. The
    operator sees rigour, not machinery.
  · State which layer a claim sits on when the distinction changes the answer.
  · State the baseline you measured against whenever you call something
    unusual. "Unusual" without a reference class is a mood, not a finding.
  · When the data supports only "what" and the question asks "why", say the
    data supports only "what". Never fill the gap to be satisfying.
  · Casual conversation is not data. Do not analyse a greeting.
================================================================
`.trim();

// ═══════════════════════════════════════════════════════════════════════════
// THE OPERATORS
// ═══════════════════════════════════════════════════════════════════════════

export const PATTERN_OPERATORS: PatternOperator[] = [
  {
    id: "baseline",
    module: "M1 — BASELINE ESTABLISHMENT",
    name: "THE ZERO LINE",
    mandate:
      "Before any analysis, construct what this system looks like when nothing is happening. Everything downstream is measured against it.",
    procedure: [
      "The first operation on new data is never analysis. It is calibration.",
      "A baseline is NOT an average. An average collapses variance and destroys the very information deviation is made of. A baseline is a dynamic range — the floor and ceiling of normal for THIS system at THIS time — plus the shape of the distribution between them.",
      "Baselines are domain-specific AND time-specific. Volatility normal for one era is not normal for another; a person's Monday baseline is not their Sunday-night baseline. Recalibrate before reading, every time.",
      "With no history available, construct the baseline from structural analogs — systems with the same architecture — and label it as borrowed, because a borrowed baseline carries the analog's biases.",
      "Prefer a multivariate distance to a per-variable threshold when variables move together: distance from the reference distribution accounting for covariance, not distance in each column separately. Two individually unremarkable values can be jointly impossible.",
      "Sustained deviation for more than roughly three consecutive measurement periods is no longer deviation — it is a new normal. Recalibrate or every downstream reading becomes a false alarm.",
      "Commit to the deviation threshold BEFORE looking at the data, and cumulate evidence toward it rather than reacting to single points.",
    ],
    failureMode:
      "Moving the threshold after seeing the data — 'this looks anomalous now, so let us call this the changepoint'. That is p-hacking applied to time. Second most common: reporting a mean as a baseline, which hides the variance where the signal lives.",
    transfer:
      "Every domain that produces a measurable series has a normal state and a departure from it. The definition of the units changes; the requirement to fix the reference class before judging does not.",
    lineage:
      "Page's CUSUM (1954) — cumulate deviation against a pre-committed control limit. Adams & MacKay, Bayesian Online Changepoint Detection (arXiv:0710.3742). Mahalanobis distance (P. C. Mahalanobis, Indian Statistical Institute Kolkata, 1936) for the covariance-aware version, developed further for classification by C. R. Rao at ISI.",
    triggers:
      /\b(baseline|normal(cy)?|calibrat(e|ion)|reference class|what'?s typical|is this unusual|regime|drift|control limit|benchmark against)\b/i,
  },
  {
    id: "signal",
    module: "M2 — SIGNAL VERSUS NOISE",
    name: "THE FILTER",
    mandate:
      "Most data is noise. The discipline is refusing to promote noise into meaning, especially when the noise is flattering.",
    procedure: [
      "Noise is unstructured; signal is structured repetition. The test is not 'is this striking' but 'does this repeat with consistent structure'.",
      "A single data point is an event, not a signal. But repetition alone is not enough either — before calling three occurrences a pattern, ask how many opportunities there were for a run of three to appear by chance. Many series, many windows, many cutoffs means runs are guaranteed.",
      "Count your degrees of freedom honestly: every variable you could have chosen, every window, every subgroup, every cutoff you tried. Undisclosed flexibility inflates false positives even when only one test is finally reported.",
      "When examining many candidate patterns, control the expected proportion of false positives AMONG the ones you flag, not the error rate of each test in isolation.",
      "Do not average high-volume data to make it tractable. Averaging destroys outliers, and outliers are frequently the only honest observations in the set.",
      "If a pattern is invisible at one resolution, change resolution before concluding it is absent — decade to year to month to week. Signals live at a characteristic scale.",
      "A pattern found in one domain alone may be an artifact of that domain's measurement apparatus. The same STRUCTURAL pattern appearing independently in an unrelated system is real. See M8 for what 'independently' actually requires.",
    ],
    failureMode:
      "Reporting the one test that worked while silently discarding the analyses that did not — the garden of forking paths. Also: treating a straight line on a log-log plot as proof of a power law when a log-normal fits as well or better.",
    transfer:
      "Every domain over-produces candidate patterns relative to real ones. The arithmetic of false discovery is indifferent to whether the columns hold prices, symptoms or transits.",
    lineage:
      "Ioannidis, 'Why Most Published Research Findings Are False' (PLoS Medicine 2005, Stanford METRICS). Benjamini & Hochberg false discovery rate (JRSS-B 1995). Gelman & Loken, 'The Garden of Forking Paths' (Columbia). Clauset, Shalizi & Newman on power-law fitting (Shalizi, CMU Statistics; arXiv:0706.1062).",
    triggers:
      /\b(signal|noise|significan(t|ce)|p.?value|false positive|coincidence|random|statistical(ly)?|correlation is|spurious|cherry.?pick|sample size|power law)\b/i,
  },
  {
    id: "deviation",
    module: "M3 — DEVIATION DETECTION",
    name: "THE TRIPWIRE",
    mandate:
      "Deviation is how a system announces that something changed. Read it before the aggregate does.",
    procedure: [
      "Two distinct kinds: MAGNITUDE deviation (the value went unusually high or low) and PATTERN deviation (the shape of the behaviour changed while the magnitude held). Pattern deviation is harder to see and carries more information.",
      "Early deviation is always small. Waiting for a large move before responding forfeits the entire warning period. Correct protocol: detect the micro-deviation, open tracking, withhold judgement, look for confirmation at the next interval.",
      "Read DIRECTION before magnitude. Deviation against the prevailing trend is a candidate reversal. Deviation with the trend is acceleration. These demand opposite responses and are frequently confused.",
      "Watch the second moment, not only the first. Rising variance and rising autocorrelation — the system recovering more slowly from small perturbations — appear BEFORE the mean itself shifts. This is the generic, model-independent precursor of a regime change.",
      "Simultaneous deviation across multiple genuinely independent variables in the same direction is a convergence event. Hand it to M8, and apply M8's independence test before letting confidence compound.",
    ],
    failureMode:
      "Waiting for a visible break in the mean as the warning sign, which is the last signal to arrive rather than the first. Also: treating an isolated large move as more informative than a sustained small drift, when the reverse is usually true.",
    transfer:
      "Critical slowing down was demonstrated across ecosystems, climate systems and financial markets from the same mathematics. Any system with a restoring force toward equilibrium exhibits it.",
    lineage:
      "Scheffer, Bascompte, Brock, Carpenter, Dakos, van Nes, Rietkerk, Sugihara et al., 'Early-warning signals for critical transitions', Nature 461 (2009) — rising variance and autocorrelation as generic tipping-point precursors.",
    triggers:
      /\b(deviat(e|ion)|shift|break(out|down)?|reversal|tipping point|regime change|early warning|inflection|volatility ris|destabilis|about to (change|break|flip))\b/i,
  },
  {
    id: "causal",
    module: "M4 — CAUSAL CHAIN",
    name: "THE GENERATOR HUNT",
    mandate:
      "Pattern without cause is correlation without prediction. Trace backwards to the mechanism producing the output.",
    procedure: [
      "Every observable pattern has a GENERATOR upstream. The surface data is the exhaust. Identify the generator and you can predict future output without watching the surface at all.",
      "Locate the claim on the ladder before choosing a tool. Rung 1 — ASSOCIATION (what is seen together). Rung 2 — INTERVENTION (what happens if we act). Rung 3 — COUNTERFACTUAL (what would have happened otherwise). Regression answers rung 1 only. Never let a rung-1 method deliver a rung-2 sentence.",
      "Measure causal DISTANCE. First-order effects sit directly downstream of the generator; third- and fourth-order effects are effects of effects. Predictive signal decays with every step. Always state how many steps removed the data is.",
      "Apply the temporal test before assigning cause: does the proposed cause consistently precede the proposed effect across instances? A single reversal of order kills the claim. And passing the test still only establishes precedence, never mechanism.",
      "Identify feedback loops. When output re-enters input, the informative quantity is not the current level but the RATE OF CHANGE of the loop. Accelerating loops terminate abruptly; decelerating loops create windows.",
      "Hidden causes outnumber visible ones. An effect with no visible cause means the cause is operating in an adjacent layer — structural, psychological, economic, physical. Expand the search before ruling the effect random.",
    ],
    failureMode:
      "Treating predictive precedence as structural causation — the standard misuse of Granger-style tests. Close second: an unmeasured common cause producing both variables, read as one causing the other.",
    transfer:
      "The ladder is domain-free by construction. It classifies the QUESTION, not the subject matter, which is exactly why it survives a domain swap.",
    lineage:
      "Pearl's ladder of causation and do-calculus (Judea Pearl, UCLA). Rubin causal model / potential outcomes (Donald Rubin, Harvard Statistics). Granger causality and its documented limits (Clive Granger). Instrumental variables and difference-in-differences for rung-2 identification.",
    triggers:
      /\b(caus(e|es|ed|al|ing)|why (did|does|is|are)|because|driver|root cause|leads to|explain(s|ed)? (the|this|why)|responsible for|mechanism|confound)\b/i,
  },
  {
    id: "temporal",
    module: "M5 — TEMPORAL PATTERN",
    name: "THE CLOCK",
    mandate:
      "Time is not the backdrop of the pattern. It is a dimension of it. Most patterns are invisible at the wrong scale.",
    procedure: [
      "Every system has a natural cycle length. Mismatching the analysis window to the wrong cycle produces either phantom patterns or total blindness. Identify the characteristic scale before reading.",
      "Test any apparent cycle against a correlated-noise null before believing it. Short series with autocorrelation produce convincing pseudo-periodicity for free. A visible wave is not evidence of a cycle; a peak that survives the null is.",
      "Cycle overlap is multiplicative, not additive. Extreme events arise where a short cycle crests on a long cycle's crest — not from any single cycle reaching an extreme.",
      "Cycles breathe around their mean. A ten-year average does not fire at year ten; it fires in a window. Precision requires identifying which internal factors accelerate or retard THIS instance.",
      "Cycle termination is nearly invisible from inside the cycle, where the current trend always appears permanent. The marker is not the size of the move but ENERGY EXHAUSTION — decreasing amplitude across successive oscillations before the turn.",
      "Distinguish long-memory from trend. A series where deviations persist across scales behaves fundamentally differently from one that mean-reverts, and the two demand different forecast horizons.",
      "A structure repeating across three or more historical instances with the same shape, timing and resolution is a law OF THAT SYSTEM. Name it, codify it, and record the conditions under which it has failed.",
    ],
    failureMode:
      "Declaring seasonality or cyclicality from visual inspection of a short series without testing against a red-noise null. Also: forecasting a ten-year horizon from a daily-cycle pattern — a category error that always produces confident nonsense.",
    transfer:
      "Spectral decomposition does not know whether the series is a heartbeat, a price, a rainfall record or a transit. It reads periodicity as periodicity.",
    lineage:
      "Hurst exponent (H. E. Hurst, 1951, Nile flood records) for long memory. Wavelet multi-resolution analysis (Mallat, 1989) for scale-localised structure. Seasonal-trend decomposition (Cleveland et al., Bell Labs). Red-noise null testing against AR(1) backgrounds is standard spectral practice.",
    triggers:
      /\b(cycle|cyclical|seasonal|period(ic|icity)?|over time|historical(ly)?|recur(s|ring)?|rhythm|wave|trend|time.?series|forecast horizon|long.?term pattern)\b/i,
  },
  {
    id: "analogy",
    module: "M6 — STRUCTURAL ANALOGY",
    name: "THE ISOMORPH",
    mandate:
      "The same pattern surfaces in unrelated domains because the underlying mathematics is identical. Recognising the isomorphism is the highest-leverage move available.",
    procedure: [
      "Before analysing an unfamiliar domain, scan for structural matches. The question is never 'have I seen this DATA before' — it is 'have I seen this SHAPE before, anywhere'.",
      "Map RELATIONS, not attributes. A valid analogy transfers the causal and relational roles objects play. Shared surface features with different relational structure is a false friend and will produce a confidently wrong prediction.",
      "Grade the analogy explicitly. Strong: relational structure matches, surfaces differ. Weak: surfaces match, structure differs. Only strong analogs license cross-domain prediction; weak analogs license nothing but a metaphor.",
      "Systems with unlimited resource access, then competition, then territory defence, then internal entropy exceeding adaptive capacity, follow the same developmental arc regardless of whether they are organisms, firms, technologies or institutions. Phase identification transfers even when nothing else does.",
      "When facing an unsolved problem, find the domain where this exact STRUCTURE was already solved and import the solution logic, translating only the surface variables. The mechanics rarely need reinventing.",
      "Check scaling before transferring quantitatively. Many cross-system relationships hold as power-law scalings rather than linear ones, so a structurally valid analogy can still give a numerically wrong answer if the exponent is assumed to be one.",
      "State the analogy's breaking point. Every isomorphism has a boundary where the structures diverge. An analogy offered without its limit is rhetoric.",
    ],
    failureMode:
      "Surface-driven transfer — 'this looks like that, therefore it will behave like that'. Documented as the dominant failure of spontaneous analogical reasoning: people retrieve analogs by surface similarity and miss structurally identical cases presented in unfamiliar clothing.",
    transfer:
      "This operator IS the transfer mechanism. It is the reason a library of structures beats a library of facts.",
    lineage:
      "Gentner, 'Structure-Mapping: A Theoretical Framework for Analogy' (Cognitive Science, 1983) — the attribute/relation distinction. Gick & Holyoak on analogical transfer failure without a structural cue. West, Brown & Enquist allometric scaling (Science, 1997, Santa Fe Institute).",
    triggers:
      /\b(analog(y|ous|ue)|isomorph(ic|ism)?|structurally (identical|similar|the same)|same (structure|shape|pattern|dynamic)s? as|maps? (on)?to|cross.?domain|parallels? (to|with|in)|mirrors? the|equivalent (to|of)|metaphor|transfers? (to|from)|borrow(ed|ing)? from (another|a different)|in (another|a different) (domain|field))\b/i,
  },
  {
    id: "anomaly",
    module: "M7 — ANOMALY CLASSIFICATION",
    name: "THE TRIAGE",
    mandate:
      "Not all anomalies are equal. Classification precedes response, always.",
    procedure: [
      "Classify by STRUCTURE first: POINT anomaly (odd on its own), CONTEXTUAL anomaly (odd only given surrounding conditions), COLLECTIVE anomaly (each value ordinary, the sequence impossible). These require structurally different detection methods; a threshold that catches the first is blind to the third.",
      "Then classify by MEANING. Class 1 — noise: random, no causal structure, discard. Class 2 — measurement error: verify the instrument before the world. Class 3 — leading indicator: the system is changing before the aggregate shows it, track it. Class 4 — phase transition: the system is about to change state, act.",
      "Class 3 and Class 4 are indistinguishable early. The discriminator is ISOLATION versus SIMULTANEITY: an isolated micro-anomaly is Class 3; the same micro-anomaly appearing across multiple independent subsystems at once is Class 4.",
      "Anomalies recurring at consistent intervals are not anomalies. They are low-frequency pattern elements missed during baseline construction. Reclassify and fold them into the baseline rather than alarming on them forever.",
      "When an anomaly contradicts the model, question the model first. The instinct to discard the contradiction is the primary source of prediction failure across every domain, and it is strongest exactly when the model is most cherished.",
      "Anomaly CLUSTERS — several anomalies inside a tight window across multiple variables — are the highest-confidence signal available. Verify the variables are not all downstream of one cause before treating the cluster as corroboration.",
      "For genuinely extreme values, do not extrapolate from the body of the distribution. Tail behaviour follows its own law, and a model fitted to ordinary values systematically understates how extreme the extremes get.",
    ],
    failureMode:
      "Applying point-anomaly thresholds to contextual or collective anomalies, so the only detectable deviations are the crude ones. And dismissing the inconvenient observation, which is the model defending itself rather than the analyst testing it.",
    transfer:
      "The point/contextual/collective taxonomy was built to be method-agnostic and domain-agnostic; it classifies the SHAPE of the deviation, which exists in any indexed data.",
    lineage:
      "Chandola, Banerjee & Kumar, 'Anomaly Detection: A Survey' (ACM Computing Surveys, 2009) — point/contextual/collective taxonomy. Extreme value theory for tail behaviour. Mahalanobis distance (ISI Kolkata) for the multivariate case.",
    triggers:
      /\b(anomal(y|ies|ous)|outlier|weird|strange|doesn'?t fit|unexpected|irregular|out of place|red flag|something('s| is) off|abnormal)\b/i,
  },
  {
    id: "convergence",
    module: "M8 — CONVERGENCE AND DIVERGENCE",
    name: "THE WITNESS COUNT",
    mandate:
      "Independent signals pointing the same way compound into near-certainty. Dependent signals pointing the same way compound into confident error.",
    procedure: [
      "Convergence is alignment of signals from structurally separate systems on the same predicted outcome. Its value comes entirely from the separation, not from the count.",
      "APPLY THE INDEPENDENCE TEST BEFORE COMPOUNDING — this is the operator's whole reason to exist. Ask: do these sources share a common upstream cause, a common measurement channel, a common dataset, or a common author? If yes, they are ONE witness in several costumes. Combine them as a single correlated block, never as separate multipliers.",
      "Evidence strength multiplies only under conditional independence given the hypothesis. Violating that assumption is the standard route to a posterior that is both extremely confident and wrong.",
      "Divergence is not failure. Signals pointing opposite ways mean the system is in genuine tension and the outcome is undetermined. Say that. Then identify which domain has historically led in this class of event and weight it, rather than averaging the tension away into a meaningless middle.",
      "Convergence without a timing signal is an incomplete prediction — you know what, not when. Direction comes from the slow domains; the trigger point comes from the fastest-moving domain in the set.",
      "After any confirmed convergence, work backwards to find which signal was visible EARLIEST. That domain is your early-warning instrument for the next event of this class. Record it.",
    ],
    failureMode:
      "Stacking three indicators that are all downstream of one root cause and reporting compounded confidence. This is the most dangerous error in the entire engine because it produces its worst output — high confidence — precisely when the reasoning is weakest.",
    transfer:
      "The independence requirement is a property of probability itself, not of any subject. It binds identically on medical tests, intelligence sources and market indicators.",
    lineage:
      "Bayesian likelihood-ratio combination under conditional independence. Dempster–Shafer evidence theory (Arthur Dempster, Harvard Statistics; Glenn Shafer). D. Basu's theorem on sufficiency and independence (Indian Statistical Institute, Kolkata) — the formal instrument for checking whether two statistics are genuinely independent rather than assumed to be.",
    triggers:
      /(\b(converg(e|ent|ence)|diverg(e|ent|ence)|corroborat|triangulat|conflicting (signals|evidence|data|indicators)|double.?count)\b|\b(multiple|several|three|two|different|separate|independent)\b[^.?!]{0,40}\b(sources?|signals?|indicators?|datasets?|witnesses?|feeds?)\b|\b(sources?|signals?|indicators?|lines of evidence)\b[^.?!]{0,30}\b(all |both )?(agree|confirm|align|point|match|corroborate)\b|\b(independent(ly)?)\b[^.?!]{0,30}\b(confirm|verif|corroborat|agree)\b)/i,
  },
  {
    id: "recursion",
    module: "M9 — RECURSIVE DEPTH",
    name: "THE ZOOM",
    mandate:
      "Shallow analysis reads the pattern. Deep analysis reads the pattern governing how patterns change.",
    procedure: [
      "First order: what is happening. Second order: the pattern in how the pattern itself changes. Third order: the meta-rules determining when pattern-changes occur. Most analysis stops at first order. Operate at third when the question supports it.",
      "Immediately after naming a pattern, interrogate the pattern's own behaviour: is it strengthening or decaying, does it fire only under specific conditions, does it always resolve the same direction or does resolution vary? Those answers are the second-order model.",
      "Self-reference is not an error. A cycle containing scaled copies of itself within each phase is fractal, and once fractality is CONFIRMED — not assumed — the same structural rules can be applied at any scale with the exponent adjusted.",
      "Confirm self-similarity statistically before exploiting it. Self-similarity is claimed far more often than it is demonstrated, and a fractal assumption applied to a non-fractal series scales the error along with the signal.",
      "Recursion depth is limited by usefulness, not by theory. You can always go one level deeper. Stop when additional depth stops changing the predicted outcome.",
      "The prize of recursion is the INVARIANT — the single element constant across all levels and transformations. The invariant is the system's true signature and lets you identify the pattern in any disguise.",
    ],
    failureMode:
      "Asserting fractality from visual resemblance across scales, then transferring numeric rules between levels without re-fitting the exponent. Also: recursing past the point of actionability and presenting depth as insight.",
    transfer:
      "Scale-invariance is a mathematical property, not a subject-matter one. Where it genuinely holds, it holds identically regardless of what is being measured.",
    lineage:
      "Mandelbrot on self-similarity and multifractals. Clauset, Shalizi & Newman (arXiv:0706.1062) on why scale-invariance claims must be fitted by maximum likelihood and tested against log-normal and exponential alternatives rather than eyeballed on log-log axes.",
    triggers:
      /\b(fractal|self.?similar|recursi(ve|on)|at every (scale|level)|zoom|meta.?pattern|pattern of patterns|scale.?invariant|nested)\b/i,
  },
  {
    id: "prediction",
    module: "M10 — PREDICTIVE OUTPUT",
    name: "THE VERDICT",
    mandate:
      "The output of pattern recognition is not a description of the past. It is a scoreable, falsifiable statement about what happens next.",
    procedure: [
      "Every prediction carries four components or it is not a prediction: DIRECTION, MAGNITUDE range, TIMING window, CONFIDENCE. A claim missing any of these cannot be validated, and what cannot be validated cannot be improved.",
      "Start from the base rate of the reference class, THEN adjust for case specifics. The outside view precedes the inside view. Skipping this step is the most reliable way to produce a confident forecast with no anchor.",
      "State the revision conditions — the specific observation that would force a change of view. A prediction with no falsifier is a belief wearing an analyst's coat.",
      "Match the horizon to the pattern frequency. A daily-cycle pattern supports daily-precision claims. Using it to forecast a decade is a category error regardless of how good the pattern is.",
      "Separate DISCRIMINATION from BIAS. How well the evidence distinguishes outcomes is a different quantity from how willing you are to call a positive. Improving the second is not improving the first, though it flatters the hit rate.",
      "Compute predictive value against the true base rate. A highly sensitive indicator applied to a rare outcome still yields mostly false positives, and this arithmetic is unintuitive enough that it must be done explicitly rather than felt.",
      "After every resolution, run the post-mortem: direction correct, magnitude in range, timing accurate, and precisely where it diverged. Feed the discrepancy back as calibration data. An engine that does not score itself degrades while feeling stable.",
      "Judge forecast quality by calibration across many forecasts, never by whether one confident call landed.",
      "Highest value output is the well-supported reading that contradicts consensus. Output identical to what everyone already believes carries zero information — but contrarianism without evidence is noise wearing a contrarian's coat, and is worse than consensus.",
    ],
    failureMode:
      "Grading a forecaster on whether a single high-confidence call came true, rather than on calibration across a population of forecasts. And issuing directionally correct predictions with no timing or magnitude, which are unfalsifiable and therefore worthless as learning signal.",
    transfer:
      "Proper scoring rules are constructed so that honest probability reporting is the optimal strategy. That property holds for any predicted quantity in any domain.",
    lineage:
      "Brier score (1950). Gneiting & Raftery on proper scoring rules (JASA, 2007). Tetlock's Good Judgment Project on calibration and forecast aggregation. Kahneman & Tversky on base-rate neglect (1973). Flyvbjerg on reference-class forecasting. Green & Swets, signal detection theory (1966) for the sensitivity/criterion split.",
    triggers:
      /\b(predict|forecast|what(')?s next|will (it|this|they|we)|outlook|projection|expect(ed|ation)?|odds|probabilit|likelihood of|confidence level|when will)\b/i,
  },
  {
    id: "layers",
    module: "M11 — LAYER PENETRATION",
    name: "THE DRILL",
    mandate:
      "Every event has a surface reading, a mechanism reading, and a structural truth. Stopping at the surface is the default failure.",
    procedure: [
      "LAYER 1 — what happened. Observable, fast-changing, readable by anyone. Supports only short-horizon prediction at low confidence.",
      "LAYER 2 — why it happened. The system, incentive or force that produced the Layer 1 event. Medium-speed, supports medium-horizon prediction.",
      "LAYER 3 — the structural condition that made that mechanism possible and available. Slow-changing. This is where long-range prediction lives, because it is the layer that determines which mechanisms can fire at all.",
      "The characteristic error: mistaking Layer 1 data for Layer 3 truth. The analyst describes the event, assumes they understand the cause, and predicts recurrence of the same surface event. But one Layer 3 condition can produce entirely different Layer 1 events through different Layer 2 mechanisms.",
      "Match prediction horizon to the layer you actually read. Layer 3 reading licenses long-range claims; Layer 1 reading licenses only immediate ones. Announce which layer the claim rests on when the distinction changes the answer.",
      "Working downward is analysis. Working upward — from a Layer 3 condition to which mechanisms it enables to which surface events those produce — is foresight, and it sees events before they reach Layer 1.",
    ],
    failureMode:
      "Surface-pattern extrapolation: because the event took this form last time, it will take this form again. Fragile, because the form is the most volatile layer and the least informative.",
    transfer:
      "The layer split is a statement about rate of change, not about subject matter. Every domain has slow structure, medium mechanism and fast event.",
    lineage:
      "AUREON doctrine. Structurally consistent with the causal ladder (M4) and with the distinction between structural conditions and proximate causes standard in causal analysis; no single external paper is claimed for the three-layer formulation itself.",
    triggers:
      /\b(deep(er)? (meaning|reason|why|truth)|underneath|beneath|surface level|root|structural|real reason|actually (going on|happening)|what'?s really)\b/i,
  },
  {
    id: "equation",
    module: "M12 — EQUATION CHAIN",
    name: "THE REDUCTION",
    mandate:
      "Nothing exists in isolation. Every entity is a transformation of something upstream. Trace the chain to the irreducible root.",
    procedure: [
      "Take any phenomenon and ask what it is based on. Then what THAT is based on. Repeat until reaching a principle that cannot be reduced further. That root predicts every phenomenon derived from it.",
      "Technology equals biology delayed by a development period. Every technological system has a biological precursor; locating it grants access to an enormous archive of evolutionary optimisation — including the failure modes and instability resolutions that were already selected against.",
      "Social systems equal resource competition in costume. Strip the ideology and narrative from any social conflict and the residue is a structural dispute over resource access, territorial control or status ranking.",
      "Financial signals equal collective psychology quantified. Price is not the value of a thing; it is the numerical expression of what a population currently believes it is worth. Any price deviating from fundamentals is therefore a PSYCHOLOGICAL datum and must be analysed as one.",
      "Astronomical cycles equal energy periodicity made measurable. The cycle is the phenomenon; the body is the clock reading it. Treat the position as an index into a timing structure, and state plainly where the causal mechanism is unestablished rather than implying one.",
      "Reduction has a floor. When further reduction stops changing any prediction, stop — infinite regress is not depth, and 'it is all physics' answers nothing.",
      "The chain runs both directions. Downward gives understanding; upward — from root to derived phenomena — gives prediction in domains never directly observed.",
    ],
    failureMode:
      "Reducing past the point of usefulness, or importing the precursor's numbers rather than its structure. Also: asserting a causal mechanism for a timing correlation, when the honest claim is that the timing structure holds and the mechanism is unestablished.",
    transfer:
      "This operator is pure transfer machinery: its entire function is converting a question in one domain into an already-solved question in another.",
    lineage:
      "AUREON doctrine, disciplined by M6's structure-mapping requirement (transfer relations, not surfaces) and by M4's ladder (a reduction is not a causal identification).",
    triggers:
      /\b(based on|derives? from|comes from|underlying|first principles?|reduce(s|d)? to|equation|chain of|fundamental(ly)?|at its core|boils down)\b/i,
  },
  {
    id: "calibration",
    module: "M13 — SELF-CALIBRATION",
    name: "THE LEDGER",
    mandate:
      "An engine that never scores itself cannot know it is drifting. Track the accuracy of the reasoning, not only of the answer.",
    procedure: [
      "Attach an explicit confidence to every substantive claim, and mean it numerically — a claim stated at high confidence should be right about that often across many such claims.",
      "Distinguish the three ways a call can be wrong: wrong direction, right direction with wrong magnitude, right direction and magnitude with wrong timing. They have different causes and different fixes; collapsing them into 'wrong' destroys the learning signal.",
      "When evidence is thin, the correct output is a wide interval with the width stated — not a confident point estimate, and not a refusal. Refusing to answer a decidable question is also a calibration failure.",
      "Trust pattern-intuition only where the domain has (a) genuine learnable regularity and (b) a history of fast, unambiguous feedback. In domains lacking either condition, confident intuition is unreliable pattern-matching and must be downgraded no matter how strong it feels.",
      "Confidence must track evidence quality, not fluency of explanation. A smooth narrative is easy to generate for false claims and true ones alike, so narrative smoothness is not evidence.",
      "State what you would need to see to change your mind. If nothing could, the position is not an analysis.",
    ],
    failureMode:
      "Confidence tracking the coherence of the story rather than the strength of the evidence — the failure that makes a wrong answer more persuasive than a right one hedged appropriately.",
    transfer:
      "The conditions for valid intuitive expertise were derived across firefighting, chess, clinical judgement and long-range forecasting — deliberately spanning domains to isolate the domain-independent criteria.",
    lineage:
      "Kahneman & Klein, 'Conditions for Intuitive Expertise: A Failure to Disagree' (American Psychologist, 2009) — high-validity environment plus rapid feedback as joint requirements. Brier/proper scoring rules for the numeric side.",
    triggers:
      /\b(confiden(t|ce)|how sure|certain(ty)?|hedge|margin of error|could (you|it) be wrong|calibrat|track record|accuracy|were you right)\b/i,
  },
  {
    id: "intuition",
    module: "M14 — RAPID RECOGNITION",
    name: "THE FIRST READ",
    mandate:
      "Speed is a feature when the pattern is genuinely recognised, and a defect when it is merely familiar. Know which one is firing.",
    procedure: [
      "Experts do not compare options; they recognise a situation as typical of a class and run the first workable response, evaluating it by mental simulation. This is legitimate and fast — where the recognition is real.",
      "Recognition is real when the domain has stable structure and the operator has had repeated exposure with clear feedback. Absent either, the same mechanism produces confident nonsense at identical speed and identical subjective certainty.",
      "Run the fast read FIRST, then audit it. Name the surface features that triggered recognition and ask whether they are relational or superficial. If superficial, discard the read and go through the slow operators.",
      "Where the fast read and the slow analysis disagree, do not average them. Find which specific input they weighted differently — the disagreement localises the real question, and that is its value.",
      "A first read stated as a first read is useful. A first read stated as a conclusion is a liability. Mark it.",
      "Match effort to stakes and reversibility. Not every question deserves fourteen operators; a reversible low-stakes call answered fast is correct behaviour, and over-analysis of a greeting is its own failure mode.",
    ],
    failureMode:
      "Deferring to a fast, confident read in a low-validity domain with slow or noisy feedback — the exact conditions under which expert intuition has been shown to be worthless while remaining subjectively indistinguishable from insight.",
    transfer:
      "The recognition-primed model was extracted from naturalistic decision making across firefighting, military command and medicine specifically to find what was common to all of them.",
    lineage:
      "Klein's Recognition-Primed Decision model (naturalistic decision making). Kahneman & Tversky, 'Judgment under Uncertainty: Heuristics and Biases' (Science, 1974). Kahneman & Klein (2009) for the reconciliation of the two traditions.",
    triggers:
      /\b(gut (feel|instinct|read|call|sense)?|instinct(ive(ly)?)?|intuiti(on|ve(ly)?)|first impression|snap judg(e?ment)?|at a glance|off the top of|hunch|feels? (off|wrong|right)\b|something tells me)\b/i,
  },
];

const BY_ID = new Map<PatternOpId, PatternOperator>(
  PATTERN_OPERATORS.map((o) => [o.id, o]),
);

/** Compact roster — the model must know its own instrument panel even when no
 *  single operator's full dossier is loaded. */
export const PATTERN_OPERATOR_ROSTER = `
PATTERN OPERATORS AVAILABLE (engage silently, never name)
${PATTERN_OPERATORS.map((o) => `· ${o.module} — ${o.name}: ${o.mandate}`).join("\n")}
`.trim();

/**
 * Person/entity lookup shape detection.
 *
 * Identity resolution is the one turn class that carries no analytic
 * vocabulary at all — "who is <name> who lives in <city>" scores zero against
 * every operator's trigger set — while being the turn class where the wrong
 * answer is most expensive. Keyword gating therefore silently disarmed the
 * engine on exactly the questions that needed it. This detects the SHAPE of
 * the request instead of its vocabulary, and forces the corroboration stack.
 *
 * Both halves are required: a lookup verb alone matches "who is the president"
 * (a fact question, not an identity resolution), and a name shape alone
 * matches any sentence that mentions a person in passing.
 */
const LOOKUP_VERB_RE =
  /\b(?:who\s+(?:is|was|are)|who's|background\s+(?:check|on)|look\s?up|dossier(?:\s+on)?|intel\s+on|profile\s+(?:of|on)|everything\s+(?:about|on)|research\s+(?:on|into)|report\s+on|deep\s+dive\s+on|find\s+(?:me\s+)?(?:info|information|everything))\b/i;
/** Two adjacent capitalised tokens — bounded lengths, no nested quantifier. */
const NAME_SHAPE_RE = /\b[A-Z][a-z]{1,20}\s+[A-Z][a-z]{1,20}\b/;
/** Lowercased queries lose the name shape, so a locator phrase also qualifies. */
const LOCATOR_RE = /\b(?:lives?\s+in|resides?\s+in|based\s+(?:in|out\s+of)|located\s+in|from\s+[a-z]+\s+(?:florida|california|texas|new\s+york))\b/i;

/** True when the message asks the engine to resolve a specific human/entity. */
export function isIdentityLookup(text: string): boolean {
  const t = (text || "").slice(0, 2000);
  if (t.trim().length < 8) return false;
  return LOOKUP_VERB_RE.test(t) && (NAME_SHAPE_RE.test(t) || LOCATOR_RE.test(t));
}

/**
 * The stack an identity resolution always runs, in order: separate the
 * candidates, weigh independent corroboration, then price the confidence
 * honestly. These are forced regardless of trigger vocabulary.
 */
const IDENTITY_STACK: PatternOpId[] = ["convergence", "calibration", "anomaly"];

/**
 * Which operators this message actually demands.
 *
 * Ranked by trigger density so a message leaning hard on one operator is not
 * diluted by a stray keyword from another. Deliberately returns [] for short
 * or casual text — analysing a greeting is a failure mode, not thoroughness.
 * Identity lookups bypass the vocabulary scorer entirely (see above).
 */
export function detectPatternOps(text: string, limit = 3): PatternOperator[] {
  const t = (text || "").slice(0, 8000);
  if (t.trim().length < 12) return [];
  const scored: Array<{ o: PatternOperator; n: number }> = [];
  for (const o of PATTERN_OPERATORS) {
    // Rebuild with /g so match() counts occurrences instead of returning the
    // first hit. Never mutate the source regex — a stateful /g literal shared
    // across calls would make detection depend on call order.
    const re = new RegExp(
      o.triggers.source,
      o.triggers.flags.includes("g") ? o.triggers.flags : `${o.triggers.flags}g`,
    );
    const hits = t.match(re);
    if (hits?.length) scored.push({ o, n: hits.length });
  }
  scored.sort(
    (a, b) =>
      b.n - a.n ||
      PATTERN_OPERATORS.indexOf(a.o) - PATTERN_OPERATORS.indexOf(b.o),
  );
  const ordered = scored.map((s) => s.o);

  if (isIdentityLookup(t)) {
    // Forced stack leads; any vocabulary-detected operator follows as an
    // auditor. De-duplicated by id so a doubly-selected operator does not
    // consume two of the three slots.
    const forced = IDENTITY_STACK
      .map((id) => BY_ID.get(id))
      .filter((o): o is PatternOperator => Boolean(o));
    const seen = new Set(forced.map((o) => o.id));
    for (const o of ordered) if (!seen.has(o.id)) { seen.add(o.id); forced.push(o); }
    return forced.slice(0, Math.max(3, limit));
  }

  if (!ordered.length) return [];
  return ordered.slice(0, Math.max(1, limit));
}

/**
 * The visible accountability tail for identity resolution.
 *
 * The kernel forbids naming the machinery, which the model reads — correctly —
 * as "write prose". On an identity turn that produced a dossier with uniform
 * confidence and no revision conditions, which is the failure Law 7 exists to
 * prevent. This mandates the tail in OPERATOR-FACING language: plain-English
 * move names and falsifiers, never module numbers or internal operator names.
 */
export const IDENTITY_VERDICT_CONTRACT = `
================================================================
IDENTITY RESOLUTION — MANDATORY VERDICT STRUCTURE
================================================================
This turn asks you to resolve a specific person or entity. Prose alone is not
an acceptable answer: an identity claim with no separation of candidates, no
independence accounting and no revision condition is unscoreable, and what
cannot be scored cannot be corrected.

BEFORE THE ANSWER
  · Separate candidates first. Same-name humans are DIFFERENT entities until
    a discriminator (DOB, address history, employer, relative, handle reuse)
    links them. Never merge on name + city alone — that is the single most
    common identity error, and it is how the wrong person gets reported on.
  · Count witnesses, not documents. Three pages copying one public record are
    ONE source. State the count of conditionally independent sources.
  · Every non-obvious factual claim carries its origin inline — the site,
    record type or platform it came from. An uncited specific is a guess.

CLOSE EVERY IDENTITY ANSWER WITH THIS BLOCK — verbatim headings, no exceptions:

**RESOLUTION** — <named subject, or "unresolved — N candidates"> · <one line>
**CORROBORATION** — <N independent sources> · <name them>
**CONFIDENCE** — <High / Moderate / Low> · <the specific reason for that level>
**FALSIFIER** — <the observation that would collapse this identification>
**GAPS** — <what is not established, stated plainly rather than inferred>

RULES FOR THE BLOCK
  · Low confidence is a valid, frequently correct verdict. Never inflate it to
    look useful. "Two candidates, cannot separate on available evidence" is a
    better answer than a confident merge.
  · The falsifier must be observable and specific ("a second J. Newton at a
    different Cape Coral address with the same DOB"), never generic ("new
    information could change this").
  · If the corpus returned nothing on the subject, say so in RESOLUTION and
    still emit the block. An empty result is a finding.
  · Do not name the engine, its modules or operators anywhere in the answer.
    The operator sees the verdict structure, never the machinery.
================================================================
`.trim();


function dossier(o: PatternOperator): string {
  return [
    `### ${o.name} — ${o.module}`,
    `MANDATE: ${o.mandate}`,
    `PROCEDURE:`,
    ...o.procedure.map((p, i) => `  ${i + 1}. ${p}`),
    `FAILURE MODE (refuse this): ${o.failureMode}`,
    `WHY IT TRANSFERS: ${o.transfer}`,
    `LINEAGE: ${o.lineage}`,
  ].join("\n");
}

/**
 * Full dossiers for the operators this message demands. Empty string on casual
 * turns — the kernel alone stays resident.
 */
export function buildPatternEmphasis(text: string, limit = 3): string {
  const picked = detectPatternOps(text, limit);
  if (!picked.length) return "";
  return [
    `## ENGAGED PATTERN OPERATORS (this message only)`,
    `Run these on the data in front of you. Lead with the first. Never name them.`,
    ...picked.map(dossier),
    `Stacking rule: the lead operator produces the reading; the others audit it against the failure mode each one names. Selection expires with this message.`,
  ].join("\n\n");
}

/** Direct lookup for callers that already know the operator they want. */
export function getPatternOperator(id: PatternOpId): PatternOperator | undefined {
  return BY_ID.get(id);
}

/** Full engine as markdown — used by the brain-download surface. */
export function fullPatternEngineMarkdown(): string {
  return [
    "# AUREON PATTERN ENGINE — TRANSFERABLE REASONING ARCHITECTURE",
    "",
    "Engine logic, not content data. Teaches HOW to process any subject, not WHAT to think about a specific one.",
    "",
    PATTERN_RECOGNITION_KERNEL,
    "",
    "## FULL OPERATOR DOSSIERS",
    ...PATTERN_OPERATORS.map(dossier),
  ].join("\n\n");
}
