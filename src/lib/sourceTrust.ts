// Source Trust Scoring — domain-based credibility heuristic (no AI)
const HIGH_TRUST = new Set([
  "reuters.com", "apnews.com", "bbc.com", "bbc.co.uk", "nytimes.com",
  "wsj.com", "ft.com", "bloomberg.com", "economist.com", "nature.com",
  "science.org", "nasa.gov", "noaa.gov", "cdc.gov", "who.int",
  "europa.eu", "un.org", "imf.org", "worldbank.org", "oecd.org",
  "sec.gov", "federalreserve.gov", "treasury.gov", "justice.gov",
  "github.com", "arxiv.org", "ieee.org", "acm.org",
]);

const MEDIUM_TRUST = new Set([
  "wikipedia.org", "theguardian.com", "washingtonpost.com", "cnn.com",
  "npr.org", "axios.com", "politico.com", "cnbc.com", "forbes.com",
  "wired.com", "techcrunch.com", "theverge.com", "arstechnica.com",
]);

const LOW_TRUST_TLDS = [".info", ".biz", ".click", ".xyz"];

export interface TrustScore {
  score: number; // 0–100
  tier: "high" | "medium" | "low" | "unknown";
  factors: string[];
  isHttps: boolean;
}

export function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function scoreSource(url: string): TrustScore {
  const factors: string[] = [];
  let score = 50;
  const isHttps = url.startsWith("https://");
  if (isHttps) { score += 5; factors.push("HTTPS"); } else factors.push("Not HTTPS");

  const domain = getDomain(url).toLowerCase();
  let tier: TrustScore["tier"] = "unknown";

  if (HIGH_TRUST.has(domain)) { score = 92; tier = "high"; factors.push("Established source"); }
  else if (MEDIUM_TRUST.has(domain)) { score = 72; tier = "medium"; factors.push("Mainstream source"); }
  else if (domain.endsWith(".gov") || domain.endsWith(".edu") || domain.endsWith(".mil")) {
    score = 90; tier = "high"; factors.push("Institutional domain");
  } else if (LOW_TRUST_TLDS.some((tld) => domain.endsWith(tld))) {
    score = 30; tier = "low"; factors.push("Low-trust TLD");
  } else if (domain.split(".").length >= 2) {
    score = 55; tier = "medium"; factors.push("Standard domain");
  }

  return { score: Math.max(0, Math.min(100, score)), tier, factors, isHttps };
}

// Near-duplicate detection via title shingles
function shingles(text: string, k = 4): Set<string> {
  const tokens = text.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/).filter(Boolean);
  const set = new Set<string>();
  for (let i = 0; i <= tokens.length - k; i++) set.add(tokens.slice(i, i + k).join(" "));
  return set;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  const inter = new Set([...a].filter((x) => b.has(x)));
  const union = new Set([...a, ...b]);
  return union.size === 0 ? 0 : inter.size / union.size;
}

export function dedupeResults<T extends { title: string; url?: string }>(
  results: T[],
  threshold = 0.55
): { unique: T[]; duplicateGroups: T[][] } {
  const sigs = results.map((r) => shingles(r.title));
  const groups: number[][] = [];
  const claimed = new Set<number>();
  for (let i = 0; i < results.length; i++) {
    if (claimed.has(i)) continue;
    const g = [i];
    claimed.add(i);
    for (let j = i + 1; j < results.length; j++) {
      if (claimed.has(j)) continue;
      if (jaccard(sigs[i], sigs[j]) >= threshold) { g.push(j); claimed.add(j); }
    }
    groups.push(g);
  }
  return {
    unique: groups.map((g) => results[g[0]]),
    duplicateGroups: groups.filter((g) => g.length > 1).map((g) => g.map((i) => results[i])),
  };
}
