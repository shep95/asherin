// shepherd — the seed layer.
//
// A natural language query is not a search string here. It is parsed once into
// typed tokens at provisional weight and then discarded: the rest of the engine
// only ever sees the seed token map.

import { SEED_WEIGHT } from "./engine";
import type { GeoPrecision, Token, TokenType } from "./types";

const US_STATES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO",
  connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID",
  illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA",
  maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN",
  mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR",
  pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC", "south dakota": "SD",
  tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT", virginia: "VA", washington: "WA",
  "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
};

const STOP = new Set([
  "who", "is", "the", "a", "an", "and", "or", "of", "in", "on", "at", "to", "for", "from",
  "about", "with", "that", "this", "there", "lives", "live", "living", "resides", "residing",
  "named", "called", "find", "search", "look", "up", "please", "info", "information", "guy",
  "man", "woman", "person", "he", "she", "they", "old", "year", "years", "age", "aged", "born",
  "known", "as", "aka", "his", "her", "their", "county", "city", "state", "street", "some",
]);

const NAME_STOP = new Set([...STOP, ...Object.keys(US_STATES)]);

let seq = 0;
function tid(type: TokenType): string {
  seq += 1;
  return `seed-${type}-${seq}`;
}

function mk(
  type: TokenType,
  value: string,
  key: string,
  extra: Partial<Token> = {},
): Token {
  return {
    id: tid(type),
    type,
    value,
    key,
    originTier: null,
    originSourceId: "analyst",
    originSourceName: "analyst assertion",
    parents: [],
    weight: SEED_WEIGHT,
    corroborations: [],
    conflicts: [],
    layer: 0,
    ...extra,
  };
}

export interface SeedMap {
  tokens: Token[];
  names: Token[];
  geo: Token[];
  ages: Token[];
  handles: Token[];
  keywords: Token[];
  /** Ranked highest-discriminating first — drives the disambiguation prompt. */
  discriminators: string[];
  warnings: string[];
}

const GEO_RANK: Record<GeoPrecision, number> = { street: 4, city: 3, county: 2, state: 1 };

export function parseSeed(raw: string): SeedMap {
  const text = raw.trim();
  const lower = text.toLowerCase();
  const tokens: Token[] = [];
  const warnings: string[] = [];
  const consumed: Array<[number, number]> = [];
  const take = (i: number, len: number) => consumed.push([i, i + len]);
  const isTaken = (i: number) =>
    consumed.some(([a, b]) => i >= a && i < b);

  // ── emails and handles ────────────────────────────────────────────────
  for (const m of text.matchAll(/[\w.+-]+@[\w-]+\.[\w.]+/g)) {
    tokens.push(mk("email", m[0], m[0].toLowerCase()));
    take(m.index ?? 0, m[0].length);
  }
  for (const m of text.matchAll(/(?:^|\s)@([A-Za-z0-9_.]{3,30})/g)) {
    tokens.push(mk("handle", m[1], m[1].toLowerCase()));
    take(m.index ?? 0, m[0].length);
  }
  for (const m of text.matchAll(/\+?\d{0,2}[\s.(-]*\d{3}[\s.)-]*\d{3}[\s.-]*\d{4}\b/g)) {
    const digits = m[0].replace(/\D/g, "");
    if (digits.length >= 10) {
      tokens.push(mk("phone", m[0].trim(), digits.slice(-10)));
      take(m.index ?? 0, m[0].length);
    }
  }

  // ── age / birth-year range ────────────────────────────────────────────
  const nowYear = new Date().getUTCFullYear();
  const ageMatch =
    lower.match(/~\s*(\d{1,2})\b/) ||
    lower.match(/\b(?:age|aged)\s*(\d{1,2})\b/) ||
    lower.match(/\b(\d{1,2})\s*(?:years? old|yo)\b/) ||
    lower.match(/\b(?:early|mid|late)\s*(\d{2})s\b/);
  const bornMatch = lower.match(/\bborn\s*(?:in\s*)?(\d{4})\b/);
  if (bornMatch) {
    const y = Number(bornMatch[1]);
    tokens.push(mk("age", `DOB ${y}`, `dob:${y}-${y}`, { note: "stated birth year, unverified" }));
  } else if (ageMatch) {
    const age = Number(ageMatch[1]);
    if (age >= 1 && age <= 110) {
      const hi = nowYear - age + 1;
      const lo = nowYear - age - 1;
      tokens.push(
        mk("age", `DOB ${lo}–${hi}`, `dob:${lo}-${hi}`, {
          note: "approximate range, used to filter records — never as a confirmed data point",
        }),
      );
    }
  }

  // ── geography ─────────────────────────────────────────────────────────
  const geoSeen = new Set<string>();
  const pushGeo = (value: string, precision: GeoPrecision) => {
    const key = `${precision}:${value.toLowerCase()}`;
    if (geoSeen.has(key)) return;
    geoSeen.add(key);
    tokens.push(mk("geo", value, key, { precision }));
  };

  for (const m of lower.matchAll(/\b([a-z][a-z\s'-]{2,24}?)\s+county\b/g)) {
    pushGeo(titleCase(`${m[1].trim()} county`), "county");
    take(m.index ?? 0, m[0].length);
  }
  for (const [name] of Object.entries(US_STATES)) {
    const i = lower.indexOf(name);
    if (i >= 0 && /\b/.test(lower[i] ?? "")) {
      const before = lower[i - 1];
      const after = lower[i + name.length];
      if ((before === undefined || /[^a-z]/.test(before)) && (after === undefined || /[^a-z]/.test(after))) {
        pushGeo(titleCase(name), "state");
        take(i, name.length);
      }
    }
  }
  // "<city>, FL" or "in <city> florida"
  for (const m of text.matchAll(/\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2}),?\s+(?:FL|CA|NY|TX|GA|NC|OH|PA|WA|AZ|CO|VA|NJ|MA|MI|IL)\b/g)) {
    pushGeo(m[1], "city");
    take(m.index ?? 0, m[1].length);
  }
  const inCity = lower.match(/\b(?:in|from|near)\s+([a-z][a-z]+(?:\s+[a-z]+){0,2})\s+(?:florida|california|texas|new york|georgia|nevada|arizona|ohio)\b/);
  if (inCity) pushGeo(titleCase(inCity[1]), "city");

  // ── names ─────────────────────────────────────────────────────────────
  const words = Array.from(text.matchAll(/[A-Za-z][A-Za-z'’-]+/g));
  const nameRuns: string[][] = [];
  let run: string[] = [];
  for (const w of words) {
    const word = w[0];
    const idx = w.index ?? 0;
    const looksName = /^[A-Z]/.test(word) || /^[a-z]+$/.test(word);
    const banned = NAME_STOP.has(word.toLowerCase()) || isTaken(idx);
    if (!banned && looksName && word.length > 1) run.push(word);
    else {
      if (run.length) nameRuns.push(run);
      run = [];
    }
  }
  if (run.length) nameRuns.push(run);

  const fullRuns = nameRuns.filter((r) => r.length >= 2).sort((a, b) => b.length - a.length);
  const names: Token[] = [];
  if (fullRuns.length) {
    const full = fullRuns[0].map(titleCase).join(" ");
    const fullTok = mk("name", full, full.toLowerCase());
    names.push(fullTok);
    tokens.push(fullTok);
    if (fullRuns[0].length >= 3) {
      const partial = `${titleCase(fullRuns[0][0])} ${titleCase(fullRuns[0][fullRuns[0].length - 1])}`;
      const partTok = mk("partial-name", partial, partial.toLowerCase(), {
        note: "partial match of the full name token — probability of identity high, not certain",
        parents: [fullTok.id],
      });
      names.push(partTok);
      tokens.push(partTok);
    }
  } else {
    warnings.push("no multi-word name token was extracted. the anchor gate cannot fire on a single given name alone.");
  }

  // ── residual keywords ─────────────────────────────────────────────────
  const usedWords = new Set(
    tokens.flatMap((t) => t.value.toLowerCase().split(/[\s,]+/)),
  );
  const kwSeen = new Set<string>();
  for (const w of words) {
    const word = w[0].toLowerCase();
    if (word.length < 4) continue;
    if (STOP.has(word) || usedWords.has(word) || kwSeen.has(word)) continue;
    if (US_STATES[word]) continue;
    kwSeen.add(word);
  }
  const keywords = Array.from(kwSeen)
    .slice(0, 8)
    .map((k) => mk("keyword", k, k));
  tokens.push(...keywords);

  const geo = tokens.filter((t) => t.type === "geo");
  const bestGeo = [...geo].sort(
    (a, b) => GEO_RANK[(b.precision ?? "state")] - GEO_RANK[(a.precision ?? "state")],
  )[0];

  const discriminators: string[] = [];
  if (!geo.some((g) => g.precision === "street")) discriminators.push("a specific street address");
  if (!geo.some((g) => g.precision === "city")) discriminators.push("a city name");
  if (!tokens.some((t) => t.type === "phone")) discriminators.push("a phone number or area code");
  if (!tokens.some((t) => t.type === "handle" || t.type === "email"))
    discriminators.push("a known platform handle or email");
  if (!tokens.some((t) => t.type === "org")) discriminators.push("an employer or school");
  if (!geo.some((g) => g.precision === "county")) discriminators.push("a county");
  if (!tokens.some((t) => t.type === "age")) discriminators.push("an approximate age or birth year");

  if (bestGeo?.precision === "state")
    warnings.push(
      "the strongest geography token is state-level. two people can share a state — expect the anchor gate to enter split identity state.",
    );

  return {
    tokens,
    names,
    geo,
    ages: tokens.filter((t) => t.type === "age"),
    handles: tokens.filter((t) => t.type === "handle" || t.type === "email"),
    keywords,
    discriminators,
    warnings,
  };
}

export function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

export function strongestGeo(seed: SeedMap): Token | undefined {
  return [...seed.geo].sort(
    (a, b) => GEO_RANK[(b.precision ?? "state")] - GEO_RANK[(a.precision ?? "state")],
  )[0];
}
