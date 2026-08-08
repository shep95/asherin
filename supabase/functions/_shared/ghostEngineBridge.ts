// ─────────────────────────────────────────────────────────────────────────────
// GHOST ENGINE ↔ ASHERIN CHAT BRIDGE
//
// Gives Asherin/Asher chat a metadata substrate to reason over: when the
// operator's question is structurally about provenance, infrastructure,
// authorship, timestamps or device origin, chat pulls a Ghost sweep and folds
// the shell into context. Content is never pulled — only the metadata.
//
// Pro-only. Callers must pass the caller's own request so the tier gate runs
// against their JWT, never a service identity.
// ─────────────────────────────────────────────────────────────────────────────

import { extractGhostRecord, isPublicHttpUrl, pool, type GhostRecord } from "./ghostMetadata.ts";
import { buildIndex, type GhostIndex } from "./ghostIndex.ts";
import { resolveAxrlenAccess } from "./proTierGate.ts";

/** Structural-provenance intent. Deliberately narrow — the sweep costs time. */
const TRIGGERS = [
  /\b(metadata|meta-?data)\b/i,
  /\bexif\b/i,
  /\bprovenance\b/i,
  /\bwho (?:made|created|authored|published|owns)\b/i,
  /\b(when|what time) was .{0,40}(created|taken|published|modified)\b/i,
  /\b(hosting|host(?:ed)? on|server stack|infrastructure|which cdn|asn|name ?servers?)\b/i,
  /\b(is|was) .{0,40}(faked|forged|doctored|manipulated|authentic)\b/i,
  /\bghost engine\b/i,
  /\b(headers?|dns|tls|hsts|redirect chain)\b/i,
];

export function needsGhostSweep(text: string): boolean {
  const t = (text || "").slice(0, 500);
  return TRIGGERS.some((re) => re.test(t));
}

/** Pull the first public URL out of free text, if the operator supplied one. */
export function urlFromText(text: string): string | null {
  const m = (text || "").match(/\b(?:https?:\/\/)?[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(?:\/[^\s<>"')]*)?/i);
  if (!m) return null;
  const raw = /^https?:\/\//i.test(m[0]) ? m[0] : `https://${m[0]}`;
  return isPublicHttpUrl(raw);
}

export interface GhostBundle {
  index: GhostIndex;
  target: string;
  elapsedMs: number;
}

/**
 * Run a bounded Ghost sweep for chat. Returns null when the caller is not Pro,
 * when no public target can be resolved, or when the sweep yields nothing —
 * chat then proceeds without the substrate rather than failing.
 */
export async function runGhostForChat(req: Request, text: string): Promise<GhostBundle | null> {
  const access = await resolveAxrlenAccess(req);
  if (!access.granted) return null;

  const target = urlFromText(text);
  if (!target) return null;

  const started = Date.now();
  const origin = new URL(target).origin;
  const targets = [...new Set([target, `${origin}/`, `${origin}/robots.txt`, `${origin}/sitemap.xml`])];
  const records = (await pool(targets, 4, extractGhostRecord)) as GhostRecord[];
  if (!records.length) return null;

  return { index: buildIndex(records), target, elapsedMs: Date.now() - started };
}

/** Render the shell as compact, model-legible context. */
export function formatGhostContext(bundle: GhostBundle | null): string {
  if (!bundle) return "";
  const { index, target } = bundle;
  const primary = index.records[0];
  if (!primary) return "";

  const lines: string[] = [
    "\n\n## GHOST ENGINE — METADATA SHELL (no content was read)",
    `Target: ${target}`,
    `Coverage: ${index.coverage.indexed} probes, ${index.coverage.withContainer} with container metadata, ${index.coverage.failed} unreachable.`,
    "",
    "### Transport & origin",
    `- Status: ${primary.status ?? "unreachable"} · ${primary.response_ms ?? "?"}ms · ${primary.source_type}`,
    `- Server: ${primary.server ?? "undisclosed"} · TLS: ${primary.tls ? "yes" : "no"} · HSTS: ${primary.hsts ? "yes" : "no"} · CSP: ${primary.csp ? "yes" : "no"}`,
    `- Origin IP: ${primary.network_origin_ip ?? "unresolved"}${primary.asn ? ` (${primary.asn})` : ""}${primary.geo_label ? ` — ${primary.geo_label}` : ""}`,
    `- Name servers: ${primary.dns.ns.slice(0, 3).join(", ") || "none observed"}`,
    `- Mail exchangers: ${primary.dns.mx.slice(0, 3).join(", ") || "none observed"}`,
    primary.redirect_chain.length ? `- Redirect chain: ${primary.redirect_chain.join(" → ")}` : "",
    "",
    "### Container shell",
    `- Author: ${primary.author ?? "not embedded"} · Device: ${primary.device_id ?? "not embedded"} · Software: ${primary.software ?? "not embedded"}`,
    `- Created: ${primary.created_at ?? "unknown"} · Modified: ${primary.modified_at ?? "unknown"}`,
    primary.geo_lat != null
      ? `- Coordinate (${primary.geo_source}): ${primary.geo_lat.toFixed(4)}, ${primary.geo_lng?.toFixed(4)}`
      : "- Coordinate: none embedded",
  ].filter(Boolean);

  if (index.anomalies.length) {
    lines.push("", "### Anomalies");
    for (const a of index.anomalies.slice(0, 8)) {
      lines.push(`- [${a.severity.toUpperCase()}] ${a.title} — ${a.detail}`);
    }
  }
  if (index.keystones.length) {
    lines.push("", "### Keystone dimensions");
    for (const k of index.keystones.slice(0, 5)) lines.push(`- ${k.kind}: ${k.label}`);
  }

  lines.push(
    "",
    "RULES: Treat the above as observed metadata, not inference. State plainly when a field is absent — absence is itself a finding. Never claim the content of the resource was read.",
  );
  return lines.join("\n");
}
