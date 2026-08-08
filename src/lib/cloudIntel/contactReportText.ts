// ═══════════════════════════════════════════════════════════════════════════
// Contact Intelligence Report — plaintext renderer.
//
// Produces the operator-facing export: fixed 76-column box rule, section
// banners, and — critically — an explicit "not observable" line wherever the
// engine returned null. A report that silently omits its gaps reads as more
// complete than it is, which is the single most dangerous property an
// intelligence document can have.
// ═══════════════════════════════════════════════════════════════════════════

import type { ContactReport, Metric } from "./contactReport";
import type { OsintAnnex } from "./contactOsint";

const W = 74;
const HR = "━".repeat(W);
const bar = (n: number | null, width = 10) =>
  n === null ? "—".repeat(width) : "█".repeat(Math.round((n / 100) * width)).padEnd(width, "░");

function banner(n: number, title: string): string[] {
  return [HR, `SECTION ${n} — ${title.toUpperCase()}`, HR, ""];
}

/**
 * Emits `prefix` verbatim — column alignment is layout, not content, so it is
 * never tokenised — then wraps `body` at the box width, hanging continuation
 * lines at `contIndent` (defaults to the column where the body began).
 *
 * The continuation indent must be applied while measuring, not afterwards:
 * re-indenting finished lines pushes them past the box width, which is what
 * produced ragged over-length prose in the risk and thread blocks.
 */
function field(prefix: string, body: string, contIndent?: number): string[] {
  const indent = Math.min(contIndent ?? prefix.length, W - 20);
  const words = body.split(/\s+/).filter(Boolean);
  if (!words.length) return [prefix.trimEnd()];
  const lines: string[] = [];
  let cur = prefix;
  let atStart = true;
  for (const w of words) {
    if (!atStart && cur.length + 1 + w.length > W) {
      lines.push(cur);
      cur = " ".repeat(indent) + w;
    } else {
      cur = atStart ? cur + w : `${cur} ${w}`;
    }
    atStart = false;
  }
  lines.push(cur);
  return lines;
}

/** Renders a metric as a labelled row, or as its stated reason for absence. */
function row(m: Metric, pad = 22): string[] {
  const prefix = `  ${m.label}`.padEnd(pad, " ") + ": ";
  const out =
    m.value === null
      ? field(prefix, `NOT OBSERVABLE — ${m.unavailable ?? "no reason recorded."}`)
      : field(prefix, m.value);
  // The interpretation hangs beneath the value, visually subordinate to it,
  // so a reader scanning figures can skip the prose without losing alignment.
  if (m.value !== null && m.read) out.push(...field(" ".repeat(pad - 4) + "↳ ", m.read));
  return out;
}

/** Wraps a free-prose block at the box width under a fixed left margin. */
function wrap(text: string, indent: number): string[] {
  const lead = text.match(/^ */)?.[0] ?? "";
  return field(lead, text.slice(lead.length), indent);
}




/**
 * BLUF — Bottom Line Up Front. A reader who stops after twelve lines must
 * still leave with the judgments; burying them under ten sections of method
 * is how reports get skimmed and misread. Likelihood and confidence are
 * printed as separate columns because they answer different questions: how
 * probable the statement is, versus how good the evidence behind it is.
 */
function blufBlock(a: OsintAnnex): string[] {
  const L: string[] = [];
  L.push(HR);
  L.push("BLUF — BOTTOM LINE UP FRONT");
  L.push(HR);
  L.push("");

  if (a.status !== "ready") {
    L.push(...wrap(`  OPEN-SOURCE COLLECTION DID NOT COMPLETE — ${a.blocker ?? "no reason recorded."}`, 2));
    L.push("");
    L.push(...wrap("  Everything below this line is derived from your own correspondence only. Treat the absence of public findings as an unfilled collection requirement, not as a clean record.", 2));
    L.push("");
    return L;
  }

  if (!a.keyJudgments.length) {
    L.push("  No judgment met the evidentiary floor for publication.");
    L.push("");
    return L;
  }

  a.keyJudgments.forEach((j, i) => {
    L.push(...field(`  KJ-${String(i + 1).padStart(2, "0")}  `, `We assess it is ${j.likelihood.toUpperCase()} that ${j.text}`, 8));
    L.push(...field("        Confidence: ", `${j.confidence} — ${j.basis}`, 8));
    L.push("");
  });

  L.push(...wrap(`  Collection confidence ${a.collectionConfidence}% · ${a.metrics.documentsParsed} documents parsed across ${a.metrics.queriesRun} queries · ${a.metrics.independentDomains} independent domains · ${a.metrics.authoritativeSources} authoritative sources · jurisdiction ${a.jurisdiction}.`, 2));
  L.push("");
  return L;
}

/** Open-source identity, every value carried with its Admiralty credibility. */
function osintSections(a: OsintAnnex, startAt: number): string[] {
  const L: string[] = [];
  let n = startAt;

  L.push(...banner(n++, "Open-source identity (ICD 206 sourced)"));
  if (a.status !== "ready") {
    L.push(...wrap(`  NOT COLLECTED — ${a.blocker ?? "collection did not run."}`, 2));
    L.push("");
  } else if (!a.facts.length) {
    L.push(...wrap("  NO IDENTITY FIELD SURVIVED MATCHING. Documents were collected but none could be tied to this subject with enough specificity to publish. A common name with a low personal footprint produces exactly this signature.", 2));
    L.push("");
  } else {
    L.push("  Credibility scale: 1 confirmed · 2 probably true · 3 possibly true");
    L.push("                     4 doubtful · 5 improbable · 6 cannot be judged");
    L.push("");
    for (const f of a.facts) {
      L.push(...field(`  ${f.field.toUpperCase()}${f.band === "candidate" ? " [CANDIDATE — UNVERIFIED]" : ""} — `, f.value, 4));
      L.push(...field("    ├─ Credibility: ", `${f.credibility} — ${f.credibilityNote}`, 8));
      L.push(...field("    └─ Sources:     ", f.sources.map((s) => s.domain).join(", ") || "none recorded", 8));
      L.push("");
    }
  }

  L.push(...banner(n++, "Association ring"));
  if (!a.associations.length) {
    L.push("  No public association survived corroboration.");
    L.push("");
  } else {
    for (const s of a.associations) {
      L.push(...field(`  [HOP ${s.hop}] `, `${s.label} — ${s.kind}${s.via ? ` (via ${s.via})` : ""}`, 10));
      L.push(...field("          ", `${s.independentDomains} independent domain${s.independentDomains === 1 ? "" : "s"} · ${s.sources.map((x) => x.domain).join(", ") || "no domain recorded"}`, 10));
    }
    L.push("");
  }
  if (a.crossLinks.length) {
    L.push("  THIRD-RING CROSS-LINKS (entities reachable by two separate paths):");
    for (const c of a.crossLinks.slice(0, 12)) {
      L.push(...field("    • ", `${c.node} — via ${c.viaA} and ${c.viaB} (strength ${c.strength})`, 6));
    }
    L.push("");
  }

  // Circulation is a separate finding from identity: knowing WHO the contact
  // is says nothing about WHERE their address or number is already carried.
  L.push(...banner(n++, "Identifier exposure (confirmed sightings)"));
  if (!a.identifierSweeps.length) {
    L.push("  No hard identifier on this contact record was swept.");
    L.push("");
  } else {
    for (const sw of a.identifierSweeps) {
      L.push(...field(`  ${sw.identifier} — `, `${sw.kind}`, 4));
      if (sw.blocker) {
        L.push(...field("    └─ ", sw.blocker, 8));
        L.push("");
        continue;
      }
      L.push(...field("    ├─ Confirmed:  ",
        `${sw.confirmed} sighting${sw.confirmed === 1 ? "" : "s"} across ${sw.surfaces} surface${sw.surfaces === 1 ? "" : "s"}`, 8));
      L.push(...field("    ├─ Window:     ",
        `${sw.firstSeen?.slice(0, 10) ?? "undated"} → ${sw.lastSeen?.slice(0, 10) ?? "undated"}`, 8));
      if (sw.exposed.length) {
        L.push(...field("    ├─ CIRCULATED: ",
          `${sw.exposed.map((e) => `${e.host} (${e.surfaceClass})`).join(", ")} — treat this identifier as publicly circulated`, 8));
      }
      L.push(...field("    └─ Surfaces:   ",
        sw.top.map((t) => `${t.host} ×${t.sightings}`).join(", ") || "none", 8));
      L.push("");
    }
    L.push(...wrap("  A sighting means the engine opened the page and found the identifier on it. Candidates that could not be confirmed are excluded, so absence here is absence of proof, not proof of absence.", 2));
    L.push("");
  }

  // Reasoned exposure is a third finding class: the sweep reports where the
  // identifier IS, the doctrine reports where the subject's shape says it
  // SHOULD be, and then tests that claim. Untested reasoning is not published.
  L.push(...banner(n++, "Reasoned exposure (55-domain dork doctrine)"));
  {
    const d = a.dork;
    if (!d) {
      L.push("  Doctrine leg not run for this subject.");
      L.push("");
    } else {
      L.push(...field("  Battery:  ",
        `${d.theoriesGenerated} theories generated · ${d.theoriesTested} tested · ${d.totalHits} indexed hits · ${Math.round(d.elapsedMs / 1000)}s`, 12));
      L.push("");
      if (d.blocker) {
        L.push(...wrap(`  ${d.blocker}`, 2));
        L.push("");
      }
      if (d.topExposures.length) {
        L.push("  CONFIRMED EXPOSURE THEORIES (query → what it returned):");
        L.push("");
        for (const t of d.topExposures) {
          L.push(...field(`  [${String(t.yieldScore).padStart(3)}] ${t.category.replace(/_/g, " ").toUpperCase()} — `, t.query, 8));
          L.push(...field("        Rationale: ", t.why, 8));
          if (t.markers.length) {
            L.push(...field("        Markers:   ", t.markers.join(", "), 8));
          }
          for (const h of t.hits) {
            L.push(...field("          • ", `${h.title || h.host} — ${h.url}`, 12));
          }
          L.push("");
        }
      }
      if (d.novel.length) {
        L.push(...wrap("  NOVEL CROSS-DOMAIN THEORIES — constructed by intersecting exposure domains rather than recalled from a known dork list. These are first-run queries; their yield is stated, not assumed.", 2));
        L.push("");
        for (const t of d.novel) {
          L.push(...field(`  [${String(t.yieldScore).padStart(3)}] `, t.query, 8));
          L.push(...field("        ", `${t.why} — ${t.hits} hit${t.hits === 1 ? "" : "s"}`, 8));
        }
        L.push("");
      }
      if (d.defensiveGuidance) {
        L.push("  SELF-AUDIT POSTURE:");
        L.push(...wrap(`  ${d.defensiveGuidance.replace(/[#*`]/g, "").replace(/\s+/g, " ").trim().slice(0, 900)}`, 2));
        L.push("");
      }
    }
  }



  L.push(...banner(n++, "Source register (Admiralty reliability)"));
  if (!a.sources.length) {
    L.push("  No source was retained.");
    L.push("");
  } else {
    L.push("  Reliability scale: A completely reliable · B usually reliable");
    L.push("                     C fairly reliable · D not usually reliable");
    L.push("                     E unreliable · F reliability cannot be judged");
    L.push("");
    a.sources.forEach((s, i) => {
      L.push(...field(`  [${String(i + 1).padStart(2, "0")}] (${s.reliability}) `, s.title || s.domain, 8));
      L.push(...field("       ", `${s.url}`, 7));
      L.push(...field("       ", `${s.bucket} · ${s.reliabilityNote}`, 7));
    });
    L.push("");
  }

  L.push(...banner(n++, "Intelligence gaps & collection requirements"));
  const gaps = a.status === "ready" ? a.gaps : [a.blocker ?? "Open-source collection did not run."];
  if (!gaps.length) {
    L.push("  No gap was recorded by the collection engine. This is itself a weak");
    L.push("  signal — treat any unlisted field as uncollected rather than clean.");
  }
  for (const g of gaps) L.push(...field("  ○ ", g, 4));
  L.push("");
  if (a.reverse) {
    L.push(...field("  REVERSE PASS: ", `${a.reverse.identifier} → ${a.reverse.hits} hits, ${a.reverse.factsAdded} facts added${a.reverse.timedOut ? " (timed out)" : ""}${a.reverse.error ? ` (${a.reverse.error})` : ""}`, 4));
    L.push("");
  }
  L.push(...wrap("  ANALYTIC CAVEAT: open-source findings describe what is publicly asserted about the subject, not what is true of them. Nothing here is verified against a primary identity document, and a name collision remains the standing failure mode of every field above.", 2));
  L.push("");

  L.push(...confidenceMatrix(a, n++));
  L.push(...alternativeHypotheses(a, n++));
  L.push(...priorityRequirements(a, n++));

  return L;
}

/**
 * ICD 203 requires analytic confidence to be auditable, not asserted. The
 * matrix publishes the four inputs that actually move it — source diversity,
 * corroboration depth, authoritative anchoring, and collection completeness —
 * so a reader can disagree with the grade on stated grounds rather than tone.
 */
function confidenceMatrix(a: OsintAnnex, n: number): string[] {
  const L = banner(n, "Analytic confidence matrix (ICD 203)");
  if (a.status !== "ready") {
    L.push(...wrap("  NOT SCORED — collection did not complete, so no dimension has a denominator. Treat the whole open-source annex as an unmet requirement.", 2));
    L.push("");
    return L;
  }

  const m = a.metrics;
  const corroborated = a.facts.filter((f) => f.credibility <= 2).length;
  const candidate = a.facts.filter((f) => f.band === "candidate").length;
  // Each dimension is scored 0-100 from an observed count against the
  // threshold at which that dimension stops constraining the judgment.
  const cap = (x: number) => Math.max(0, Math.min(100, Math.round(x)));
  const dims: Array<{ label: string; score: number; read: string }> = [
    {
      label: "Source diversity",
      score: cap((m.independentDomains / 6) * 100),
      read: `${m.independentDomains} independent domain${m.independentDomains === 1 ? "" : "s"} in the retained set; six is the point at which single-publisher echo stops dominating.`,
    },
    {
      label: "Corroboration depth",
      score: a.facts.length ? cap((corroborated / a.facts.length) * 100) : 0,
      read: `${corroborated} of ${a.facts.length || 0} published field${a.facts.length === 1 ? "" : "s"} reach Admiralty credibility 1–2; the remainder are single-domain assertions.`,
    },
    {
      label: "Authoritative anchoring",
      score: cap((m.authoritativeSources / 3) * 100),
      read: `${m.authoritativeSources} registry-class source${m.authoritativeSources === 1 ? "" : "s"} (court, corporate, licensing). Zero here means nothing is anchored to a system of record.`,
    },
    {
      label: "Collection completeness",
      score: cap(a.collectionConfidence),
      read: `${m.documentsParsed} document${m.documentsParsed === 1 ? "" : "s"} parsed across ${m.queriesRun} queries; ${a.gaps.length} gap${a.gaps.length === 1 ? "" : "s"} remain open.`,
    },
    {
      label: "Deception tolerance",
      score: candidate === 0 ? 80 : cap(80 - candidate * 15),
      read: candidate === 0
        ? "No self-published or unverifiable field carried a judgment. Denial-and-deception indicators considered; none observed."
        : `${candidate} field${candidate === 1 ? " is" : "s are"} candidate-band — self-asserted or single-surface, and therefore forgeable by the subject. Deception considered and NOT excluded.`,
    },
  ];

  for (const d of dims) {
    L.push(...field(`  ${d.label.padEnd(24)} `, `${String(d.score).padStart(3)} / 100   ${bar(d.score)}`));
    L.push(...field("      ↳ ", d.read, 8));
    L.push("");
  }

  const overall = Math.round(dims.reduce((s, d) => s + d.score, 0) / dims.length);
  const grade = overall >= 70 ? "HIGH" : overall >= 40 ? "MODERATE" : "LOW";
  L.push(...wrap(`  OVERALL ANALYTIC CONFIDENCE: ${grade} (${overall}/100). This grade constrains every judgment in the BLUF — a judgment cannot be more confident than the evidence base that carries it.`, 2));
  L.push("");
  return L;
}

/**
 * Heuer's ACH in its publishable form: for every judgment, the competing
 * explanation is stated and either rejected on evidence or left standing. A
 * judgment with no stated alternative is an assumption wearing a confidence
 * label, which is the failure mode this section exists to prevent.
 */
function alternativeHypotheses(a: OsintAnnex, n: number): string[] {
  const L = banner(n, "Alternative hypotheses considered (ACH)");
  if (a.status !== "ready" || !a.keyJudgments.length) {
    L.push(...wrap("  No judgment was published, so no competing explanation required adjudication.", 2));
    L.push("");
    return L;
  }

  const thin = a.metrics.independentDomains < 2;
  a.keyJudgments.forEach((j, i) => {
    L.push(...field(`  KJ-${String(i + 1).padStart(2, "0")} — `, j.text, 4));
    L.push(...field("    H1 (adopted):  ", `${j.likelihood} · ${j.confidence} — ${j.basis}`, 8));
    L.push(...field(
      "    H2 (rejected): ",
      "The surfaces describe a different person sharing the subject's name, and matching pulled an unrelated footprint into this dossier.",
      8,
    ));
    L.push(...field(
      "    Adjudication:  ",
      thin
        ? "NOT REJECTED. Fewer than two independent domains carry this subject, which is exactly the signature a name collision produces. H2 remains live — do not act on H1 alone."
        : `Rejected on corroboration: ${a.metrics.independentDomains} independent domains converge on the same identifier set, and a collision would not reproduce that convergence.`,
      8,
    ));
    L.push("");
  });

  L.push(...wrap("  A third hypothesis is standing for every subject and is never rejected: the public record is incomplete by design, and the absence of a finding is a property of indexing, not of the subject's conduct.", 2));
  L.push("");
  return L;
}

/**
 * Gaps become a collection plan only when they are ranked by what they would
 * change. Each requirement names the judgment it would move, so the reader
 * knows which unanswered question is load-bearing and which is housekeeping.
 */
function priorityRequirements(a: OsintAnnex, n: number): string[] {
  const L = banner(n, "Priority intelligence requirements");
  const reqs: Array<{ pri: string; ask: string; moves: string }> = [];

  if (a.status !== "ready") {
    reqs.push({
      pri: "PIR-1",
      ask: "Re-run open-source collection against this subject.",
      moves: "Every judgment — the annex currently has no evidence base at all.",
    });
  } else {
    if (a.metrics.authoritativeSources === 0) {
      reqs.push({
        pri: "PIR-1",
        ask: "Obtain one registry-class record (court docket, corporate filing, professional licence) tying the subject's name to a jurisdiction.",
        moves: "Every identity field, from candidate band to confirmed. This is the single highest-leverage unmet requirement.",
      });
    }
    if (a.metrics.independentDomains < 2) {
      reqs.push({
        pri: `PIR-${reqs.length + 1}`,
        ask: "Collect a second independent publisher carrying the same identifier set.",
        moves: "H2 (name collision), which cannot currently be rejected on evidence.",
      });
    }
    const unswept = !a.identifierSweeps.length;
    if (unswept) {
      reqs.push({
        pri: `PIR-${reqs.length + 1}`,
        ask: "Add a hard identifier (email or phone) to the contact record and re-sweep.",
        moves: "The circulation finding — without an identifier there is nothing to confirm sightings against.",
      });
    }
    if (a.dork?.blocker) {
      reqs.push({
        pri: `PIR-${reqs.length + 1}`,
        ask: "Re-run the doctrine battery once the reasoning engine is reachable.",
        moves: "Reasoned exposure — the report currently states where the subject IS, not where their shape says they should be.",
      });
    }
    for (const g of a.gaps.slice(0, 4)) {
      reqs.push({ pri: `PIR-${reqs.length + 1}`, ask: g, moves: "Collection completeness in the confidence matrix." });
    }
  }

  if (!reqs.length) {
    L.push(...wrap("  No load-bearing requirement is outstanding. Every published judgment is carried by corroborated, registry-anchored sourcing.", 2));
    L.push("");
    return L;
  }

  for (const r of reqs) {
    L.push(...field(`  ${r.pri}  `, r.ask, 8));
    L.push(...field("        Would move: ", r.moves, 8));
    L.push("");
  }
  return L;
}


export function renderContactReport(r: ContactReport, contactName: string, annex?: OsintAnnex | null): string {

  const L: string[] = [];
  const stamp = new Date(r.generatedAt).toISOString().replace("T", " ").slice(0, 16);

  L.push("╔" + "═".repeat(W) + "╗");
  L.push("║  ASHERIN — CONTACT INTELLIGENCE REPORT".padEnd(W + 1) + "║");
  L.push("║  Classification: Personal / Eyes Only".padEnd(W + 1) + "║");
  L.push("║  Handling: Do not forward. Derived from your own accounts and".padEnd(W + 1) + "║");
  L.push("║            open sources. Not a consumer report; not for use in".padEnd(W + 1) + "║");
  L.push("║            hiring, credit, housing or insurance decisions.".padEnd(W + 1) + "║");
  L.push("║  Standards: Judgments per ICD 203; sourcing per ICD 206 with".padEnd(W + 1) + "║");
  L.push("║            Admiralty reliability/credibility grading. Competing".padEnd(W + 1) + "║");
  L.push("║            hypotheses adjudicated per ACH; indicators of denial".padEnd(W + 1) + "║");
  L.push("║            and deception considered and scored, not assumed away.".padEnd(W + 1) + "║");
  L.push(`║  Subject: ${contactName}`.padEnd(W + 1) + "║");
  L.push(`║  Generated: ${stamp} UTC`.padEnd(W + 1) + "║");
  L.push(`║  Window: ${r.windowDays ?? "—"} days | ${r.messagesAnalyzed} messages analysed | confidence ${r.confidence}%`.padEnd(W + 1) + "║");
  L.push("╚" + "═".repeat(W) + "╝");
  L.push("");

  if (annex) L.push(...blufBlock(annex));


  if (r.insufficient) {
    L.push("⚠ INSUFFICIENT CORPUS");
    L.push(...wrap(`  ${r.insufficient}`, 2));
    L.push("");
    L.push("  Sections below are rendered from what does exist. Every figure the");
    L.push("  corpus cannot support is printed as NOT OBSERVABLE with its reason.");
    L.push("");
  }

  L.push(...banner(1, "Identity map"));
  for (const m of r.identity) L.push(...row(m));
  L.push("");

  L.push(...banner(2, "Behavioural metadata profile"));
  for (const g of r.behavioral) {
    L.push(`  ${g.group.toUpperCase()}`);
    for (const m of g.rows) L.push(...row(m, 24));
    L.push("");
  }

  L.push(...banner(3, "Linguistic fingerprint"));
  for (const g of r.linguistic) {
    L.push(`  ${g.group.toUpperCase()}`);
    for (const m of g.rows) L.push(...row(m, 24));
    L.push("");
  }

  L.push(...banner(4, "Psychological profile (OCEAN markers)"));
  for (const t of r.ocean) {
    if (t.score === null) {
        L.push(...field(`  ${t.trait.padEnd(20)}  `, "NOT SCORED — no supporting behaviour observed for any indicator."));
      L.push("");
      continue;
    }
    L.push(...field(`  ${t.trait.padEnd(20)} `, `${String(t.score).padStart(3)} / 100   ${bar(t.score)}   (${t.indicators} indicator${t.indicators === 1 ? "" : "s"})`));
    for (const e of t.evidence) L.push(...field("      • ", e, 8));
    L.push("");
  }
  if (r.oceanSummary) { L.push(...wrap(`  ${r.oceanSummary}`, 2)); L.push(""); }

  L.push(...banner(5, "Power dynamic map"));
  for (const m of r.power.rows) L.push(...row(m, 24));
  L.push("");
  if (r.power.assessment) {
    L.push("  FRAME ASSESSMENT:");
    L.push(...wrap(`  ${r.power.assessment}`, 2));
  } else {
    L.push("  FRAME ASSESSMENT: NOT OBSERVABLE — fewer than two power measures have");
    L.push("  enough traffic behind them to support a reading.");
  }
  L.push("");

  L.push(...banner(6, "Relationship velocity"));
  L.push(
    ...field(
      "  Health score .......... ",
      r.velocity.health === null ? "NOT SCORED — under the 4-message floor." : `${r.velocity.health} / 100   ${bar(r.velocity.health)}`,
    ),
  );
  L.push(
    ...field(
      "  Warmth trend .......... ",
      r.velocity.trend === null
        ? "NOT OBSERVABLE"
        : `${r.velocity.trend >= 0 ? "▲ +" : "▼ "}${r.velocity.trend} per 1000 tokens, half-window over half-window`,
    ),
  );

  L.push("");
  for (const m of r.velocity.rows) L.push(...row(m, 24));
  if (r.velocity.trajectory) { L.push(""); L.push(...wrap(`  TRAJECTORY: ${r.velocity.trajectory}`, 2)); }
  L.push("");

  L.push(...banner(7, "Intent classification (active threads)"));
  if (!r.threads.length) {
    L.push("  No threads with this contact inside the sweep window.");
  }
  for (const t of r.threads) {
    L.push(...field('  Thread: ', `"${t.subject}" — last message ${new Date(t.lastMessage).toISOString().slice(0, 10)}`, 4));
    L.push(...field("  ├─ Classification:   ", `${t.classification}${t.caution ? "  ⚠ CAUTION" : ""}`));
    L.push(...field("  ├─ Exchange:         ", `${t.messages} messages (${t.inbound} theirs / ${t.outbound} yours)${t.questionRatio !== null ? ` · Q:S ratio ${t.questionRatio}:1` : ""}`));
    L.push(...field("  ├─ Signal:           ", t.signal, 8));
    L.push(...field("  └─ Action:           ", t.action, 8));
    L.push("");
  }

  L.push(...banner(8, "Optimal engagement protocol"));
  for (const m of r.engagement) L.push(...row(m, 24));
  L.push("");

  L.push(...banner(9, "Risk flags"));
  if (!r.risks.length) {
    L.push("  No flags raised. No extraction imbalance, no praise-then-ask sequencing,");
    L.push("  no systematic minimisation, no drift beyond rhythm, no warmth spike");
    L.push("  preceding transactional volume. Absence here means the detectors ran");
    L.push("  and returned nothing — not that they were skipped.");
  }
  for (const f of r.risks) {
    L.push(`  ⚠ ${f.title.toUpperCase()} (${f.severity})`);
    L.push(...field("  ├─ Detection:    ", f.detection, 7));
    L.push(...field("  ├─ Meaning:      ", f.meaning, 7));
    L.push(...field("  ├─ Distinction:  ", f.distinction, 7));
    L.push(...field("  └─ Action:       ", f.action, 7));
    L.push("");
  }
  L.push("");

  L.push(...banner(10, "Executive summary & next actions"));
  L.push("  WHO THIS PERSON IS:");
  L.push(...wrap(`  ${r.summary.who}`, 2));
  L.push("");
  L.push("  YOUR POSITION:");
  L.push(...wrap(`  ${r.summary.position}`, 2));
  L.push("");
  L.push("  IMMEDIATE ACTIONS:");
  r.summary.actions.forEach((a, i) => L.push(...field(`  [${i + 1}] `, a, 6)));
  L.push("");
  if (r.summary.projection) {
    L.push("  PROJECTION:");
    L.push(...wrap(`  ${r.summary.projection}`, 2));
    L.push("");
  }

  if (annex) L.push(...osintSections(annex, 11));

  L.push(HR);
  L.push("  CHANNELS WITH NO DATA SOURCE");
  for (const c of r.unavailableChannels) L.push(...field("  • ", c, 4));
  L.push("");
  L.push(`  Confidence: ${r.confidence}% | Data points: ${r.messagesAnalyzed} | Generated: ${stamp} UTC`);
  if (annex) {
    L.push(
      `  Open-source: ${annex.status.toUpperCase()} | ${annex.metrics.documentsParsed} documents | ` +
      `${annex.sources.length} sources retained | collection confidence ${annex.collectionConfidence}%`,
    );
  }
  L.push(HR);
  L.push("  ASHERIN INTELLIGENCE / CONTACT REPORT v2.0 (OSINT-FUSED)");
  L.push("  LATTICE MODULE — CONTACT ANALYSIS ENGINE + ZOPHIEL COLLECTION");
  L.push("  Eyes Only / Auto-generated from connected data sources");
  L.push("  #houseofasher  #zia");

  L.push(HR);

  return L.join("\n");
}
