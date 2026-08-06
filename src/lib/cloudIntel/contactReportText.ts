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

const W = 74;
const HR = "━".repeat(W);
const bar = (n: number | null, width = 10) =>
  n === null ? "—".repeat(width) : "█".repeat(Math.round((n / 100) * width)).padEnd(width, "░");

function banner(n: number, title: string): string[] {
  return [HR, `SECTION ${n} — ${title.toUpperCase()}`, HR, ""];
}

/**
 * Emits `prefix` verbatim — column alignment is part of the layout and must
 * never be tokenised — then wraps only `body`, indenting continuations to the
 * column where the body started.
 */
function field(prefix: string, body: string): string[] {
  const indent = prefix.length;
  const words = body.split(/\s+/).filter(Boolean);
  if (!words.length) return [prefix.trimEnd()];
  const lines: string[] = [];
  let cur = prefix;
  for (const w of words) {
    if (cur.length > indent && cur.length + 1 + w.length > W) {
      lines.push(cur);
      cur = " ".repeat(indent) + w;
    } else {
      cur = cur.length > indent ? `${cur} ${w}` : cur + w;
    }
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
  return field(lead, text.slice(lead.length)).map((l, i) =>
    i === 0 ? l : " ".repeat(Math.max(lead.length, indent)) + l.trimStart(),
  );
}



export function renderContactReport(r: ContactReport, contactName: string): string {
  const L: string[] = [];
  const stamp = new Date(r.generatedAt).toISOString().replace("T", " ").slice(0, 16);

  L.push("╔" + "═".repeat(W) + "╗");
  L.push("║  ASHERIN — CONTACT INTELLIGENCE REPORT".padEnd(W + 1) + "║");
  L.push("║  Classification: Personal / Eyes Only".padEnd(W + 1) + "║");
  L.push(`║  Subject: ${contactName}`.padEnd(W + 1) + "║");
  L.push(`║  Generated: ${stamp} UTC`.padEnd(W + 1) + "║");
  L.push(`║  Window: ${r.windowDays ?? "—"} days | ${r.messagesAnalyzed} messages analysed | confidence ${r.confidence}%`.padEnd(W + 1) + "║");
  L.push("╚" + "═".repeat(W) + "╝");
  L.push("");

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
      L.push(`  ${t.trait.padEnd(20)}  NOT SCORED — no supporting behaviour observed for any indicator.`);
      L.push("");
      continue;
    }
    L.push(`  ${t.trait.padEnd(20)} ${String(t.score).padStart(3)} / 100   ${bar(t.score)}   (${t.indicators} indicator${t.indicators === 1 ? "" : "s"})`);
    for (const e of t.evidence) L.push(...wrap(`      • ${e}`, 8));
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
  L.push(`  Health score .......... ${r.velocity.health === null ? "NOT SCORED — under the 4-message floor." : `${r.velocity.health} / 100   ${bar(r.velocity.health)}`}`);
  L.push(`  Warmth trend .......... ${r.velocity.trend === null ? "NOT OBSERVABLE" : `${r.velocity.trend >= 0 ? "▲ +" : "▼ "}${r.velocity.trend} per 1000 tokens, half-window over half-window`}`);
  L.push("");
  for (const m of r.velocity.rows) L.push(...row(m, 24));
  if (r.velocity.trajectory) { L.push(""); L.push(...wrap(`  TRAJECTORY: ${r.velocity.trajectory}`, 2)); }
  L.push("");

  L.push(...banner(7, "Intent classification (active threads)"));
  if (!r.threads.length) {
    L.push("  No threads with this contact inside the sweep window.");
  }
  for (const t of r.threads) {
    L.push(`  Thread: "${t.subject}" — last message ${new Date(t.lastMessage).toISOString().slice(0, 10)}`);
    L.push(`  ├─ Classification:   ${t.classification}${t.caution ? "  ⚠ CAUTION" : ""}`);
    L.push(`  ├─ Exchange:         ${t.messages} messages (${t.inbound} theirs / ${t.outbound} yours)${t.questionRatio !== null ? ` · Q:S ratio ${t.questionRatio}:1` : ""}`);
    L.push(...wrap(`  ├─ Signal:           ${t.signal}`, 23));
    L.push(...wrap(`  └─ Action:           ${t.action}`, 23));
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
    L.push(...wrap(`  ├─ Detection:    ${f.detection}`, 19));
    L.push(...wrap(`  ├─ Meaning:      ${f.meaning}`, 19));
    L.push(...wrap(`  ├─ Distinction:  ${f.distinction}`, 19));
    L.push(...wrap(`  └─ Action:       ${f.action}`, 19));
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
  r.summary.actions.forEach((a, i) => L.push(...wrap(`  [${i + 1}] ${a}`, 6)));
  L.push("");
  if (r.summary.projection) {
    L.push("  PROJECTION:");
    L.push(...wrap(`  ${r.summary.projection}`, 2));
    L.push("");
  }

  L.push(HR);
  L.push("  CHANNELS WITH NO DATA SOURCE");
  for (const c of r.unavailableChannels) L.push(...wrap(`  • ${c}`, 4));
  L.push("");
  L.push(`  Confidence: ${r.confidence}% | Data points: ${r.messagesAnalyzed} | Generated: ${stamp} UTC`);
  L.push(HR);
  L.push("  ASHERIN INTELLIGENCE / CONTACT REPORT v1.0");
  L.push("  LATTICE MODULE — CONTACT ANALYSIS ENGINE");
  L.push("  Eyes Only / Auto-generated from connected data sources");
  L.push("  #houseofasher  #zia");
  L.push(HR);

  return L.join("\n");
}
