/**
 * PLATE-ANCHORED IDENTITY PIVOT — thickening a first-name-only dossier.
 *
 * NARRATIVE
 * Uber discloses a driver's first name and the car. A first name is not an
 * identity: "Marcus in Chicago" indexes thousands of humans, so the identity
 * collector has nothing to bind to and every sweep lands on THIN. The car,
 * however, is a *singleton*. A plate is unique inside its issuing state, and it
 * is the one field the rider can read with their own eyes. So the collection
 * must invert: anchor on the plate, harvest whatever the open web says that
 * plate belongs to (for-hire/TNC vehicle permit registers, insurance and
 * VIN-decode aggregators, tow/impound and citation notices, complaint boards,
 * incident news), lift SURNAMES out of that material, recombine them with the
 * disclosed first name, and only then run the expensive jurisdictional identity
 * collection against the resulting FULL names.
 *
 * The recombination is a probability problem, not a lookup. Each candidate
 * "First Last" carries a weight computed from evidence that is actually
 * present — plate co-occurrence, vehicle agreement, city agreement, for-hire
 * vocabulary, source authority, independent-domain corroboration — against a
 * prior that punishes common given names. The result is a posterior over
 * candidates plus an explicit "none of these" residual mass, because the honest
 * answer for most rides is still "we did not resolve this person".
 *
 * Nothing here escalates a verdict on its own. It produces weighted candidates;
 * the doctrine in rideshareGuardian.ts remains the authority, and the identity
 * floor still clamps an unbound match to THIN.
 */

import { placeSearch, type WebHit } from "./bleSentinel.ts";
import type { RideInput } from "./rideshareGuardian.ts";

// ── Utilities ──────────────────────────────────────────────────────────────

/** Hard per-branch timeout: a hung source must cost seconds, not the sweep. */
export async function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: number | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<T>((resolve) => { timer = setTimeout(() => resolve(fallback), ms) as unknown as number; }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

/** Normalised plate: comparison must survive "7ABC123" vs "7ABC 123" vs "7abc-123". */
export const normPlate = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

/**
 * Given-name ambiguity prior. These are the highest-frequency US given names;
 * a match on one of them, without a plate anchor, is close to no evidence at
 * all. The list is deliberately short — it is a penalty heuristic, not a census.
 */
const COMMON_GIVEN = new Set([
  "james", "john", "robert", "michael", "william", "david", "richard", "joseph", "thomas", "charles",
  "christopher", "daniel", "matthew", "anthony", "mark", "donald", "steven", "paul", "andrew", "joshua",
  "kenneth", "kevin", "brian", "george", "timothy", "ronald", "jason", "edward", "jeffrey", "ryan",
  "jacob", "gary", "nicholas", "eric", "jonathan", "stephen", "larry", "justin", "scott", "brandon",
  "mary", "patricia", "jennifer", "linda", "elizabeth", "barbara", "susan", "jessica", "sarah", "karen",
  "lisa", "nancy", "betty", "margaret", "sandra", "ashley", "kimberly", "emily", "donna", "michelle",
  "maria", "jose", "juan", "carlos", "luis", "ahmed", "mohamed", "mohammed", "ali", "omar", "wei", "li",
]);

/** Tokens that are never a human surname when lifted out of page text. */
const NOT_SURNAME = new Set([
  "uber", "lyft", "driver", "drivers", "vehicle", "vehicles", "plate", "plates", "license", "licence",
  "registration", "record", "records", "county", "state", "city", "police", "department", "court",
  "insurance", "report", "reports", "search", "results", "public", "records", "trip", "ride", "rides",
  "toyota", "honda", "nissan", "ford", "chevrolet", "hyundai", "kia", "tesla", "bmw", "mercedes",
  "camry", "corolla", "civic", "accord", "altima", "sentra", "elantra", "sonata", "prius", "model",
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "january", "february",
  "march", "april", "june", "july", "august", "september", "october", "november", "december",
  "north", "south", "east", "west", "new", "san", "los", "las", "the", "and", "for", "llc", "inc",
]);

const AUTHORITY_RE = /(\.gov|\.us\/|courts?\.|\bdmv\b|\btnc\b|taxi|for-hire|forhire|limousine|livery|county|city of|sheriff|police)/i;
const FORHIRE_RE = /\b(uber|lyft|rideshare|ride-?share|tnc|for-?hire|livery|chauffeur|taxi|limousine|driver)\b/i;

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); } catch { return url; }
}

// ── Plate-anchored collection ──────────────────────────────────────────────

export interface PlateEvidence {
  hits: WebHit[];
  queries: string[];
  vehicleFacts: string[];
  note: string;
}

/**
 * Sweep the open web for the plate itself. Every query is plate-first so a hit
 * is, by construction, about this car and not about a namesake.
 */
export async function platePivot(ride: RideInput, budgetMs = 16_000): Promise<PlateEvidence> {
  const plateRaw = (ride.plate || "").trim();
  if (!plateRaw) {
    return { hits: [], queries: [], vehicleFacts: [], note: "No plate captured — the vehicle pivot could not run." };
  }
  const plate = plateRaw.toUpperCase();
  const compact = normPlate(plate);
  const where = ride.city ? ` ${ride.city}` : "";
  const veh = ride.vehicle ? ` ${ride.vehicle}` : "";

  // Ordered by how often each source names a human next to a plate.
  const queries = [
    `"${plate}" OR "${compact}" license plate registered owner${where}`,
    `"${plate}"${where} TNC for-hire vehicle permit rideshare license holder`,
    `"${plate}" vehicle registration VIN${veh} record lookup`,
    `"${plate}"${where} citation tow impound parking ticket notice`,
    `"${plate}"${where} uber lyft driver complaint review incident`,
    `"${plate}"${where} accident crash news report driver`,
  ];

  const started = Date.now();
  const settled = await Promise.allSettled(
    queries.map((q) =>
      withTimeout(placeSearch(q, 6, Math.max(4000, budgetMs - 2000)), budgetMs, [] as WebHit[])
    ),
  );

  const seen = new Set<string>();
  const hits: WebHit[] = [];
  for (const r of settled) {
    if (r.status !== "fulfilled") continue;
    for (const h of r.value) {
      if (seen.has(h.url)) continue;
      seen.add(h.url);
      hits.push(h);
    }
  }

  // Vehicle facts are worth keeping even when no human surfaces: a plate that
  // decodes to a different make than the car at the kerb is a WATCH on its own.
  const vehicleFacts: string[] = [];
  const blob = hits.map((h) => `${h.title} ${h.snippet}`).join(" ");
  const year = blob.match(/\b(19[89]\d|20[0-4]\d)\s+(?:[A-Z][a-z]+)/)?.[0];
  if (year) vehicleFacts.push(`Year/make token seen alongside plate: ${year}`);
  const vin = blob.match(/\b[A-HJ-NPR-Z0-9]{17}\b/)?.[0];
  if (vin) vehicleFacts.push(`VIN-shaped token: ${vin}`);
  const stateReg = blob.match(/\b(registered in|plate state|issued by)\s+([A-Z][a-zA-Z ]{3,20})/)?.[0];
  if (stateReg) vehicleFacts.push(stateReg);

  return {
    hits,
    queries,
    vehicleFacts,
    note: hits.length
      ? `Plate pivot ${plate}: ${hits.length} plate-anchored documents across ${new Set(hits.map((h) => hostOf(h.url))).size} domains in ${Date.now() - started}ms.`
      : `Plate pivot ${plate}: searched, nothing plate-anchored surfaced. Registration data is not open-web in most states.`,
  };
}

// ── Candidate extraction ───────────────────────────────────────────────────

export interface WeightedCandidate {
  name: string;
  first: string;
  last: string;
  posterior: number;      // 0-1, normalised across candidates + residual
  logit: number;
  plate_anchored: boolean;
  sources: string[];      // distinct domains
  evidence: string[];     // the exact snippets that produced the weight
  reasons: string[];      // human-readable weight breakdown
}

interface RawMatch {
  last: string;
  urls: Set<string>;
  snippets: string[];
  plateAnchored: boolean;
  authority: boolean;
  forHire: boolean;
  cityMatch: boolean;
  vehicleMatch: boolean;
}

/**
 * Lift "First Last" occurrences of THIS driver's given name out of the
 * collected text. Only the disclosed first name may seed a candidate — a page
 * that never says the first name cannot name this driver.
 */
export function extractCandidates(
  first: string,
  hits: WebHit[],
  ride: RideInput,
): Map<string, RawMatch> {
  const out = new Map<string, RawMatch>();
  const firstLc = first.trim().toLowerCase();
  if (!firstLc || /\s/.test(firstLc)) return out; // seeded on a single given name only
  const plate = normPlate(ride.plate || "");
  const cityLc = (ride.city || "").toLowerCase();
  const vehTokens = (ride.vehicle || "").toLowerCase().split(/\s+/).filter((t) => t.length > 2);

  // Escaped, non-global: a stateful /g regex reused across hits silently skips matches.
  const esc = firstLc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const nameRe = new RegExp(`\\b${esc}\\.?\\s+([A-Z][a-zA-Z'’\\-]{2,20})\\b`, "gi");

  for (const h of hits) {
    const text = `${h.title} ${h.snippet}`;
    const textLc = text.toLowerCase();
    nameRe.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = nameRe.exec(text)) !== null) {
      const lastRaw = m[1];
      const lastLc = lastRaw.toLowerCase();
      if (NOT_SURNAME.has(lastLc) || lastLc === firstLc) continue;
      if (!/^[A-Z]/.test(lastRaw)) continue; // sentence noise, not a surname
      const key = lastLc;
      const rec = out.get(key) ?? {
        last: lastRaw,
        urls: new Set<string>(),
        snippets: [],
        plateAnchored: false,
        authority: false,
        forHire: false,
        cityMatch: false,
        vehicleMatch: false,
      };
      rec.urls.add(hostOf(h.url));
      if (rec.snippets.length < 4) rec.snippets.push(`${h.snippet.slice(0, 220)} — ${h.url}`);
      if (plate && normPlate(text).includes(plate)) rec.plateAnchored = true;
      if (AUTHORITY_RE.test(h.url) || AUTHORITY_RE.test(text)) rec.authority = true;
      if (FORHIRE_RE.test(text)) rec.forHire = true;
      if (cityLc && textLc.includes(cityLc)) rec.cityMatch = true;
      if (vehTokens.some((t) => textLc.includes(t))) rec.vehicleMatch = true;
      out.set(key, rec);
    }
  }
  return out;
}

/**
 * Bayesian-flavoured scoring in log-odds space. Weights are stated, bounded and
 * auditable; every one of them is reported back to the reader as a reason, so a
 * high posterior can be argued with rather than trusted blindly.
 */
export function scoreCandidates(
  first: string,
  matches: Map<string, RawMatch>,
  ride: RideInput,
): { candidates: WeightedCandidate[]; residual: number } {
  const commonName = COMMON_GIVEN.has(first.trim().toLowerCase());
  // Prior: a lone given name in a metro is a needle in ~10^3-10^4 people.
  const basePrior = commonName ? -3.4 : -2.4;

  const scored: WeightedCandidate[] = [];
  for (const rec of matches.values()) {
    let logit = basePrior;
    const reasons: string[] = [
      `prior ${basePrior.toFixed(1)} (${commonName ? "high-frequency" : "less common"} given name)`,
    ];

    if (rec.plateAnchored) { logit += 3.2; reasons.push("+3.2 named on a page that carries this exact plate"); }
    if (rec.authority) { logit += 1.5; reasons.push("+1.5 official / registry-class source"); }
    if (rec.forHire) { logit += 1.4; reasons.push("+1.4 for-hire vocabulary present (TNC/rideshare/livery)"); }
    if (rec.cityMatch) { logit += 1.0; reasons.push("+1.0 pickup city co-occurs"); }
    if (rec.vehicleMatch) { logit += 1.2; reasons.push("+1.2 vehicle make/model co-occurs"); }

    const corroboration = Math.min(3, rec.urls.size - 1);
    if (corroboration > 0) {
      const add = 0.8 * corroboration;
      logit += add;
      reasons.push(`+${add.toFixed(1)} corroborated across ${rec.urls.size} independent domains`);
    }
    if (!rec.plateAnchored && commonName) {
      logit -= 0.8;
      reasons.push("-0.8 common given name with no plate anchor");
    }
    if (!ride.city) { logit -= 0.4; reasons.push("-0.4 no city to constrain jurisdiction"); }

    // Ceiling. Open-web recombination cannot certify a human, and a stack of
    // correlated signals off the same story must not compound into certainty —
    // that is how an innocent namesake acquires someone else's record.
    const CEILING = 2.2; // ≈ 91% after the residual mass is applied
    if (logit > CEILING) {
      reasons.push(`capped at ${CEILING} — open-source recombination cannot exceed ~91% binding`);
      logit = CEILING;
    }


    scored.push({
      name: `${first} ${rec.last}`,
      first,
      last: rec.last,
      logit,
      posterior: sigmoid(logit),
      plate_anchored: rec.plateAnchored,
      sources: [...rec.urls],
      evidence: rec.snippets,
      reasons,
    });
  }

  // Normalise into a proper distribution WITH a "none of these" mass, so five
  // weak candidates cannot sum to certainty.
  const NONE_MASS = 0.9; // unresolved is the default hypothesis
  const weights = scored.map((c) => Math.exp(c.logit));
  const total = weights.reduce((a, b) => a + b, 0) + NONE_MASS;
  scored.forEach((c, i) => { c.posterior = weights[i] / total; });
  scored.sort((a, b) => b.posterior - a.posterior);

  return { candidates: scored.slice(0, 6), residual: NONE_MASS / total };
}

/** One evidence block for the model, plus the machine-readable weights. */
export function formatPlateBlock(ev: PlateEvidence, weighted: WeightedCandidate[], residual: number): string {
  const lines: string[] = ["### Plate-anchored vehicle pivot", ev.note];
  if (ev.vehicleFacts.length) lines.push("", "Vehicle facts observed:", ...ev.vehicleFacts.map((f) => `- ${f}`));
  if (ev.hits.length) {
    lines.push("", "Plate-anchored documents:");
    for (const h of ev.hits.slice(0, 14)) {
      lines.push(`- ${h.title || h.url}\n  ${h.snippet.slice(0, 300)}\n  source: ${h.url}`);
    }
  }
  lines.push("", "### Probabilistic identity reconstruction (first name + plate pivot)");
  if (!weighted.length) {
    lines.push("No surname candidate could be recombined with the disclosed first name. Identity remains unresolved.");
  } else {
    lines.push(`Unresolved ("none of these") mass: ${(residual * 100).toFixed(0)}%.`);
    for (const c of weighted) {
      lines.push(
        `- ${c.name} — posterior ${(c.posterior * 100).toFixed(0)}%${c.plate_anchored ? " (PLATE-ANCHORED)" : ""}`,
        `  weights: ${c.reasons.join("; ")}`,
        `  domains: ${c.sources.join(", ")}`,
      );
      for (const e of c.evidence) lines.push(`  evidence: ${e}`);
    }
    lines.push(
      "",
      "These posteriors are the ONLY basis on which a surname may be attributed to this driver.",
      "A candidate under 0.55 must not carry an adverse record forward.",
    );
  }
  return lines.join("\n");
}

/**
 * Full pivot, registry-first.
 *
 * Order is the whole correction. The regulator's licensing register is keyed on
 * the plate and names the licensee outright, so it is queried before a single
 * web search is spent. When it answers, the probabilistic recombination is not
 * merely deprioritised — it is skipped, because a scored guess printed beside a
 * government record only invites the reader to average the two. When no
 * regulator covers the jurisdiction, the old weighted pivot runs as the
 * explicit fallback it always should have been.
 */
export async function plateAnchoredIdentity(
  ride: RideInput,
  budgetMs = 16_000,
): Promise<{
  block: string;
  evidence: PlateEvidence;
  candidates: WeightedCandidate[];
  residual: number;
  bestFullName: string | null;
  registry: RegistryResult;
}> {
  const registry = await resolveFromRegistries(
    { plate: ride.plate, city: ride.city, driver_name: ride.driver_name, vehicle: ride.vehicle },
    Math.min(12_000, Math.max(6_000, Math.floor(budgetMs * 0.5))),
  );

  const emptyEvidence: PlateEvidence = {
    hits: [],
    queries: [],
    vehicleFacts: [],
    note: "Web plate pivot skipped — the licensing register already bound this plate to a named licensee.",
  };

  // Registry-bound: authoritative, deterministic, done.
  if (registry.best_name && registry.confidence >= 0.55) {
    return {
      block: registry.block,
      evidence: emptyEvidence,
      candidates: [{
        name: registry.best_name,
        first: registry.best_name.split(/\s+/)[0],
        last: registry.best_name.split(/\s+/).slice(1).join(" "),
        posterior: registry.confidence,
        logit: 3,
        plate_anchored: true,
        sources: [registry.records[0]?.source ?? "regulator registry"],
        evidence: registry.records.map((r) => `${r.raw_name} — ${r.license_type ?? "licence"} ${r.license_number ?? ""} (${r.source_url})`),
        reasons: ["government for-hire licensing register keyed on this exact plate"],
      }],
      residual: 1 - registry.confidence,
      bestFullName: registry.best_name,
      registry,
    };
  }

  const registryBlock = registry.block;
  const evidence = await platePivot(ride, Math.max(6_000, budgetMs - 4_000));
  const firstToken = (ride.driver_name || "").trim().split(/\s+/)[0] || "";
  const hasSurname = (ride.driver_name || "").trim().split(/\s+/).length > 1;

  if (!firstToken || hasSurname || !evidence.hits.length) {
    return {
      block: `${registryBlock}\n\n${formatPlateBlock(evidence, [], 1)}`,
      evidence,
      candidates: [],
      residual: 1,
      bestFullName: null,
      registry,
    };
  }

  const matches = extractCandidates(firstToken, evidence.hits, ride);
  const { candidates, residual } = scoreCandidates(firstToken, matches, ride);
  const best = candidates[0];
  return {
    block: `${registryBlock}\n\n${formatPlateBlock(evidence, candidates, residual)}`,
    evidence,
    candidates,
    residual,
    // Only a candidate that clears the identity floor is allowed to re-seed the
    // expensive identity collection; below it we would be researching a stranger.
    bestFullName: best && best.posterior >= 0.55 ? best.name : null,
    registry,
  };
}

/**
 * UNBOUND FALLBACK — what can still be said when no surname was recovered.
 *
 * The jurisdictional identity collector requires a bindable person; a bare
 * given name would only return strangers. Open-web search, however, can still
 * speak about the CAR and about the pickup context, and those are rider-safety
 * facts that need no identity at all. This keeps a THIN dossier from being an
 * empty one.
 */
export async function unboundContextSweep(ride: RideInput, budgetMs = 14_000): Promise<string> {
  const first = (ride.driver_name || "").trim().split(/\s+/)[0] || "";
  const city = ride.city || "";
  const veh = ride.vehicle || "";
  const plan: Array<[string, string]> = [];
  if (first && city) {
    plan.push(["Driver-name reputation (unbound)", `"${first}" uber OR lyft driver ${city} complaint review incident passenger`]);
  }
  if (veh && city) {
    plan.push(["Vehicle-class incidents", `${veh} rideshare driver ${city} incident report police`]);
  }
  if (city) {
    plan.push(["Local rideshare safety pattern", `${city} uber lyft driver impersonation fake driver warning recent`]);
    plan.push(["Pickup-point risk", `${ride.pickup_label || city} rideshare pickup crime safety report`]);
  }
  if (!plan.length) return "### Unbound context sweep\n(no city or vehicle captured — nothing to anchor an open-web sweep on)";

  const results = await Promise.allSettled(
    plan.map(([, q]) => withTimeout(placeSearch(q, 5, budgetMs - 1500), budgetMs, [] as WebHit[])),
  );
  const blocks: string[] = [];
  results.forEach((r, i) => {
    const [heading] = plan[i];
    if (r.status !== "fulfilled" || !r.value.length) {
      blocks.push(`### ${heading}\n(searched — nothing surfaced)`);
      return;
    }
    blocks.push(
      `### ${heading}\n` +
        r.value.map((h) => `- ${h.title || h.url}\n  ${h.snippet.slice(0, 300)}\n  source: ${h.url}`).join("\n"),
    );
  });
  blocks.push(
    "NOTE: none of the above is bound to this driver as a person. It is context about the vehicle, the pickup and the locality only, and must not be reported as the driver's record.",
  );
  return blocks.join("\n\n");
}
