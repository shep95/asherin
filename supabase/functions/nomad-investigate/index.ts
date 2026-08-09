import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { IC_ANALYTIC_DOCTRINE } from "../_shared/icTradecraft.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

// ══════════════════════════════════════════════════════════════════════════════
// NOMAD v3.0 — ESRC DEANONYMIZATION FRAMEWORK
// Based on: "Large-scale online deanonymization with LLMs" (arXiv:2602.16800v1)
// Pipeline: Extract → Search → Reason → Calibrate
// ══════════════════════════════════════════════════════════════════════════════

interface IntelNode {
  source: string;
  tier: 1 | 2 | 3 | 4;
  data: string;
  provenanceHash: string;
  timestamp: string;
  confidence: number;
  entities: ExtractedEntity[];
  images?: CollectedImage[];
  firstSeen?: string;
  lastSeen?: string;
  frequency?: number;
}

interface OCEANProfile {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
  deceptionIndicators: string[];
  predictedActions: string[];
  postingHeatmap: Record<string, number>;
  functionWordRatio: number;
  burstinessScore: number;
}

interface CollectedImage {
  url: string;
  title: string;
  source: string;
  thumbnail?: string;
}

interface ExtractedEntity {
  type: string;
  value: string;
  confidence: number;
  source: string;
}

interface ProvenanceAttestation {
  sourceCount: number;
  tier1Count: number;
  tier2Count: number;
  crossRefScore: number;
  provenanceIntegrity: number;
  hostileSourceFlags: string[];
}

// ── ESRC Framework Types ─────────────────────────────────────────────────────

interface ESRCProfile {
  demographics: string[];
  career: string[];
  education: string[];
  interests: string[];
  locations: string[];
  organizations: string[];
  digitalFootprint: string[];
  temporalMarkers: string[];
  linguisticSignals: string[];
  relationships: string[];
  financialSignals: string[];
  rawMicrodata: string[];
}

interface ESRCCandidate {
  source: string;
  profile: Partial<ESRCProfile>;
  similarityScore: number;
  matchEvidence: string[];
  contradictions: string[];
}

interface ESRCReasoningResult {
  selectedCandidate: ESRCCandidate | null;
  verificationConfidence: number;
  reasoningChain: string[];
  matchStrength: 'STRONG' | 'MODERATE' | 'WEAK' | 'NO_MATCH';
}

interface ESRCCalibration {
  bradleyTerryRating: number;
  precisionEstimate: number;
  recallBand: string;
  abstainRecommendation: boolean;
  calibrationMethod: 'confidence_score' | 'tournament_sort' | 'hybrid';
}

interface ESRCPipelineResult {
  stage: 'extract' | 'search' | 'reason' | 'calibrate';
  extractedProfile: ESRCProfile;
  candidates: ESRCCandidate[];
  reasoning: ESRCReasoningResult;
  calibration: ESRCCalibration;
  pipelineMetadata: {
    extractionModel: string;
    searchMethod: string;
    reasoningModel: string;
    calibrationRounds: number;
    totalSourcesQueried: number;
    candidatePoolSize: number;
    processingTimeMs: number;
  };
}

// ── Cryptographic Provenance ─────────────────────────────────────────────────

async function computeProvenanceHash(source: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(`${source}:${data}:${Date.now()}`));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

// ── Entity Extraction Engine ─────────────────────────────────────────────────

function extractEntitiesFromText(text: string, source: string): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];
  const seen = new Set<string>();
  const add = (type: string, value: string, confidence: number) => {
    const key = `${type}:${value.toLowerCase()}`;
    if (!seen.has(key)) { seen.add(key); entities.push({ type, value, confidence, source }); }
  };

  (text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g) || []).forEach(v => add("email", v, 1.0));
  (text.match(/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g) || []).forEach(v => add("phone", v, 0.9));
  (text.match(/\$[\d,]+(?:\.\d{2})?(?:\s*(?:million|billion|trillion|M|B|T))?/gi) || []).forEach(v => add("financial", v, 0.95));
  (text.match(/\b[A-Z][A-Za-z\s&]+(?:Inc\.|LLC|Corp\.|Corporation|Ltd\.|Group|Holdings|Partners|Capital|Fund|Trust)\b/g) || []).forEach(v => add("organization", v.trim(), 0.85));
  (text.match(/https?:\/\/[^\s)]+/g) || []).forEach(v => add("url", v, 1.0));
  (text.match(/CIK[:\s]*(\d{7,10})/g) || []).forEach(v => add("sec_identifier", v, 1.0));
  (text.match(/EIN[:\s]*(\d{2}-\d{7})/g) || []).forEach(v => add("ein", v, 1.0));
  (text.match(/\b(?:19|20)\d{2}-\d{2}-\d{2}\b/g) || []).forEach(v => add("date", v, 0.9));
  (text.match(/\b(?:PhD|MSc|BSc|MBA|MD|JD|MA|BA|BS|MS)\b/gi) || []).forEach(v => add("education_level", v.toUpperCase(), 0.85));
  (text.match(/\b(?:Stanford|MIT|Harvard|Oxford|Cambridge|Berkeley|Yale|Princeton|Columbia|ETH Zurich|Carnegie Mellon)\b/g) || []).forEach(v => add("institution", v, 0.9));
  (text.match(/\b(?:CEO|CTO|CFO|COO|VP|Director|Manager|Engineer|Researcher|Professor|Analyst|Consultant)\b/gi) || []).forEach(v => add("role", v, 0.8));
  (text.match(/\b(?:Python|JavaScript|TypeScript|Rust|Go|Java|C\+\+|Swift|Kotlin|Ruby|Scala|Haskell)\b/g) || []).forEach(v => add("technology", v, 0.75));
  (text.match(/\b(?:r\/\w+)/g) || []).forEach(v => add("subreddit", v, 0.7));
  (text.match(/@[\w]{3,}/g) || []).forEach(v => add("handle", v, 0.8));

  // ── GOTHAM-GRADE: Vehicle extraction ──
  (text.match(/\b[A-Z]{1,3}[-\s]?\d{3,4}[-\s]?[A-Z]{0,3}\b/g) || []).forEach(v => add("license_plate", v, 0.7));
  (text.match(/\bVIN[:\s]*[A-HJ-NPR-Z0-9]{17}\b/gi) || []).forEach(v => add("vin", v, 0.95));
  (text.match(/\b(?:Toyota|Honda|Ford|BMW|Mercedes|Tesla|Chevrolet|Audi|Volkswagen|Hyundai|Kia|Nissan|Porsche|Lamborghini|Ferrari|Bentley|Rolls-Royce)\s+[A-Z][A-Za-z0-9\s-]{2,20}/g) || []).forEach(v => add("vehicle", v.trim(), 0.8));

  // ── GOTHAM-GRADE: Transaction / Financial identifiers ──
  (text.match(/\b(?:SWIFT|BIC)[:\s]*[A-Z]{6}[A-Z0-9]{2}(?:[A-Z0-9]{3})?\b/gi) || []).forEach(v => add("swift_code", v, 0.95));
  (text.match(/\b(?:IBAN)[:\s]*[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/gi) || []).forEach(v => add("iban", v, 0.95));
  (text.match(/\btransaction[:\s#]*[A-Za-z0-9-]{8,36}\b/gi) || []).forEach(v => add("transaction_id", v, 0.85));
  (text.match(/\b(?:wire|transfer|payment|deposit|withdrawal)\s+(?:of\s+)?\$[\d,.]+/gi) || []).forEach(v => add("transaction", v, 0.9));
  (text.match(/\baccount[:\s#]*\d{6,16}\b/gi) || []).forEach(v => add("bank_account", v, 0.85));
  (text.match(/\b(?:Bitcoin|BTC|ETH|Ethereum)[:\s]*(?:0x)?[a-fA-F0-9]{26,64}\b/g) || []).forEach(v => add("crypto_wallet", v, 0.9));

  // ── GOTHAM-GRADE: Cell tower / IMSI / IMEI ──
  (text.match(/\bIMEI[:\s]*\d{15}\b/gi) || []).forEach(v => add("imei", v, 0.95));
  (text.match(/\bIMSI[:\s]*\d{15}\b/gi) || []).forEach(v => add("imsi", v, 0.95));
  (text.match(/\b(?:cell\s*tower|tower\s*id|cell\s*id)[:\s]*[A-Z0-9-]{4,20}\b/gi) || []).forEach(v => add("cell_tower", v, 0.85));

  // ── GOTHAM-GRADE: IP Address ──
  (text.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) || []).forEach(v => {
    const parts = v.split('.').map(Number);
    if (parts.every(p => p >= 0 && p <= 255)) add("ip_address", v, 0.9);
  });

  // ── GOTHAM-GRADE: Geolocation coordinates ──
  (text.match(/-?\d{1,3}\.\d{3,8},\s*-?\d{1,3}\.\d{3,8}/g) || []).forEach(v => add("coordinates", v, 0.85));
  (text.match(/\b(?:lat(?:itude)?|lng|lon(?:gitude)?)[:\s]*-?\d{1,3}\.\d{3,8}/gi) || []).forEach(v => add("geo_coordinate", v, 0.85));

  // ── GOTHAM-GRADE: Passport / SSN / National IDs ──
  (text.match(/\bpassport[:\s#]*[A-Z0-9]{6,12}\b/gi) || []).forEach(v => add("passport", v, 0.9));
  (text.match(/\bSSN[:\s]*\d{3}-\d{2}-\d{4}\b/gi) || []).forEach(v => add("ssn", v, 0.95));

  // ── GOTHAM-GRADE: Location names with geospatial context ──
  (text.match(/\b(?:located\s+(?:in|at|near)|headquartered\s+in|based\s+in|office\s+in|branch\s+in|facility\s+(?:in|at))\s+([A-Z][A-Za-z\s,]+)/g) || []).forEach(v => add("location", v.trim(), 0.8));
  (text.match(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)*),\s*(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/g) || []).forEach(v => add("us_location", v, 0.85));

  return entities;
}

// ── HOSTILE SOURCE DETECTION (Enhanced — Gap 6) ─────────────────────────────

const HOSTILE_DOMAINS = [
  'reddit.com', 'quora.com', '4chan.org', 'pastebin.com',
  'medium.com/@anonymous', 'blogspot.com',
];

const SEO_POISONED_DOMAINS = [
  'spokeo.com', 'whitepages.com', 'beenverified.com', 'intelius.com',
  'peoplefinder.com', 'pipl.com', 'radaris.com', 'mylife.com',
  'instantcheckmate.com', 'truthfinder.com', 'ussearch.com',
];

function detectHostileSources(text: string): string[] {
  const flags: string[] = [];
  for (const domain of HOSTILE_DOMAINS) {
    if (text.toLowerCase().includes(domain)) flags.push(domain);
  }
  for (const domain of SEO_POISONED_DOMAINS) {
    if (text.toLowerCase().includes(domain)) flags.push(`SEO_POISONED:${domain}`);
  }
  if (/unverified|alleged|rumored|supposedly|unconfirmed/i.test(text)) {
    flags.push('UNVERIFIED_LANGUAGE_DETECTED');
  }
  // Detect AI-generated content farm patterns
  if (/this article was (auto-?generated|written by ai|produced automatically)/i.test(text)) {
    flags.push('AI_CONTENT_FARM_DETECTED');
  }
  // Detect Wikipedia vandalism indicators
  if (/\[citation needed\].*\[citation needed\].*\[citation needed\]/i.test(text)) {
    flags.push('WIKIPEDIA_CITATION_GAPS');
  }
  return flags;
}

// ── Benford's Law Analysis (Gap 6) ──────────────────────────────────────────

function benfordAnalysis(numbers: number[]): { isNatural: boolean; chiSquare: number; suspiciousDigits: number[] } {
  if (numbers.length < 10) return { isNatural: true, chiSquare: 0, suspiciousDigits: [] };
  
  const expected = [0, 0.301, 0.176, 0.125, 0.097, 0.079, 0.067, 0.058, 0.051, 0.046];
  const observed: number[] = new Array(10).fill(0);
  let validCount = 0;
  
  for (const num of numbers) {
    const absNum = Math.abs(num);
    if (absNum < 1) continue;
    const firstDigit = parseInt(String(absNum)[0]);
    if (firstDigit >= 1 && firstDigit <= 9) {
      observed[firstDigit]++;
      validCount++;
    }
  }
  
  if (validCount < 10) return { isNatural: true, chiSquare: 0, suspiciousDigits: [] };
  
  let chiSquare = 0;
  const suspiciousDigits: number[] = [];
  for (let d = 1; d <= 9; d++) {
    const obs = observed[d] / validCount;
    const exp = expected[d];
    const contribution = Math.pow(obs - exp, 2) / exp;
    chiSquare += contribution;
    if (Math.abs(obs - exp) > 0.1) suspiciousDigits.push(d);
  }
  
  // Chi-square critical value for 8 df at 0.05 = 15.507
  return { isNatural: chiSquare < 15.507, chiSquare: Math.round(chiSquare * 100) / 100, suspiciousDigits };
}

function extractFinancialNumbers(text: string): number[] {
  const matches = text.match(/\$[\d,]+(?:\.\d{2})?/g) || [];
  return matches.map(m => parseFloat(m.replace(/[$,]/g, ''))).filter(n => n > 0);
}

function flagSingleSourceClaims(nodes: IntelNode[], crossRefMap: Record<string, string[]>): string[] {
  const flags: string[] = [];
  for (const [key, sources] of Object.entries(crossRefMap)) {
    if (sources.length === 1) {
      const [type, value] = key.split(':');
      const sourceTier = nodes.find(n => n.source === sources[0])?.tier || 4;
      if (sourceTier >= 3) {
        flags.push(`[UNVERIFIED — SINGLE SOURCE] ${type}: ${value} (only from ${sources[0]})`);
      }
    }
  }
  return flags.slice(0, 20);
}

// ══════════════════════════════════════════════════════════════════════════════
// ESRC STAGE 1: EXTRACT — Identity-Relevant Feature Extraction
// "LLMs to extract semi-structured summaries from unstructured posts"
// ══════════════════════════════════════════════════════════════════════════════

function extractMicrodataProfile(text: string, entities: ExtractedEntity[]): ESRCProfile {
  const profile: ESRCProfile = {
    demographics: [],
    career: [],
    education: [],
    interests: [],
    locations: [],
    organizations: [],
    digitalFootprint: [],
    temporalMarkers: [],
    linguisticSignals: [],
    relationships: [],
    financialSignals: [],
    rawMicrodata: [],
  };

  // Demographics extraction
  const agePatterns = text.match(/\b(\d{2})\s*(?:years?\s*old|y\/o|yo)\b/gi) || [];
  profile.demographics.push(...agePatterns.map(a => `Age: ${a}`));
  const genderSignals = text.match(/\b(?:he|she|they|his|her|their|himself|herself)\b/gi) || [];
  if (genderSignals.length > 0) {
    const counts: Record<string, number> = {};
    genderSignals.forEach(g => { counts[g.toLowerCase()] = (counts[g.toLowerCase()] || 0) + 1; });
    profile.demographics.push(`Pronoun signals: ${JSON.stringify(counts)}`);
  }

  // Career signals
  entities.filter(e => e.type === 'role').forEach(e => profile.career.push(e.value));
  entities.filter(e => e.type === 'organization').forEach(e => profile.organizations.push(e.value));

  // Education
  entities.filter(e => e.type === 'education_level').forEach(e => profile.education.push(e.value));
  entities.filter(e => e.type === 'institution').forEach(e => profile.education.push(e.value));

  // Technology stack = interests
  entities.filter(e => e.type === 'technology').forEach(e => profile.interests.push(e.value));

  // Digital footprint
  entities.filter(e => e.type === 'handle').forEach(e => profile.digitalFootprint.push(e.value));
  entities.filter(e => e.type === 'url').forEach(e => profile.digitalFootprint.push(e.value));
  entities.filter(e => e.type === 'subreddit').forEach(e => profile.digitalFootprint.push(e.value));

  // Temporal markers
  entities.filter(e => e.type === 'date').forEach(e => profile.temporalMarkers.push(e.value));

  // Linguistic signals (stylometry lite)
  const avgSentenceLength = text.split(/[.!?]+/).filter(s => s.trim()).length;
  const usesBritishSpelling = /\b(?:colour|favour|analyse|organise|behaviour|defence|licence)\b/i.test(text);
  const usesAmericanSpelling = /\b(?:color|favor|analyze|organize|behavior|defense|license)\b/i.test(text);
  if (usesBritishSpelling) profile.linguisticSignals.push('British English detected');
  if (usesAmericanSpelling) profile.linguisticSignals.push('American English detected');
  profile.linguisticSignals.push(`Avg sentence count: ${avgSentenceLength}`);

  // Capitalization habits
  const neverCaps = text.split(/\s+/).filter(w => w.length > 3).every(w => w === w.toLowerCase());
  if (neverCaps && text.length > 100) profile.linguisticSignals.push('Never capitalizes (stylometric signal)');

  // Financial signals
  entities.filter(e => e.type === 'financial').forEach(e => profile.financialSignals.push(e.value));

  // Location extraction
  const locationPatterns = text.match(/\b(?:lives? in|based in|from|located in|moving to)\s+([A-Z][a-zA-Z\s,]+)/g) || [];
  profile.locations.push(...locationPatterns.map(l => l.trim()));

  // Raw microdata (unique identifiers from the text)
  const uniquePhrases = text.match(/\b[A-Z][a-z]+(?:\s[A-Z][a-z]+){1,3}\b/g) || [];
  const phraseCount: Record<string, number> = {};
  uniquePhrases.forEach(p => { phraseCount[p] = (phraseCount[p] || 0) + 1; });
  profile.rawMicrodata = Object.entries(phraseCount)
    .filter(([_, c]) => c >= 2)
    .map(([p, c]) => `${p} (×${c})`)
    .slice(0, 20);

  return profile;
}

// ══════════════════════════════════════════════════════════════════════════════
// ESRC STAGE 2: SEARCH — Semantic Embedding + Data Source Ingestion
// "Nearest-neighbor search over LLM embeddings of extracted summaries"
// ══════════════════════════════════════════════════════════════════════════════

async function ingestDDG(query: string): Promise<IntelNode> {
  try {
    const resp = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'text/html' },
    });
    if (!resp.ok) return emptyNode('DuckDuckGo', 4);
    const html = await resp.text();
    const results: string[] = [];
    const blocks = html.split(/class="result\s/);
    for (let i = 1; i < blocks.length && results.length < 8; i++) {
      const titleMatch = blocks[i].match(/class="result__a"[^>]*>([\s\S]*?)<\/a>/);
      const snippetMatch = blocks[i].match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : '';
      const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]*>/g, '').trim() : '';
      if (title) results.push(`- ${title}: ${snippet}`);
    }
    const data = results.join('\n') || 'No results found.';
    return {
      source: 'DuckDuckGo Web Search',
      tier: 4,
      data,
      provenanceHash: await computeProvenanceHash('ddg', data),
      timestamp: new Date().toISOString(),
      confidence: 0.6,
      entities: extractEntitiesFromText(data, 'DuckDuckGo'),
    };
  } catch { return emptyNode('DuckDuckGo', 4); }
}

async function ingestDDGInstant(query: string): Promise<IntelNode> {
  try {
    const resp = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`);
    if (!resp.ok) return emptyNode('DDG Instant', 4);
    const data = await resp.json();
    let text = '';
    if (data.AbstractText) text = `${data.AbstractText} (Source: ${data.AbstractSource})`;
    else if (data.Answer) text = `${data.Answer}`;
    if (!text) return emptyNode('DDG Instant', 4);
    return {
      source: 'DuckDuckGo Instant Answer',
      tier: 3,
      data: text,
      provenanceHash: await computeProvenanceHash('ddg-instant', text),
      timestamp: new Date().toISOString(),
      confidence: 0.75,
      entities: extractEntitiesFromText(text, 'DDG Instant'),
    };
  } catch { return emptyNode('DDG Instant', 4); }
}

// ── SearXNG Meta-Search (aggregates Google, Bing, Brave, DDG) ──────────────
const SEARXNG_INSTANCES = [
  'https://search.bus-hit.me',
  'https://searx.tiekoetter.com',
  'https://search.ononoki.org',
  'https://searx.be',
  'https://search.sapti.me',
];

async function ingestSearXNG(query: string): Promise<IntelNode> {
  for (const instance of SEARXNG_INSTANCES) {
    try {
      const resp = await fetch(`${instance}/search?q=${encodeURIComponent(query)}&format=json&engines=google,bing,brave,duckduckgo&categories=general`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', 'Accept': 'application/json' },
        signal: AbortSignal.timeout(6000),
      });
      if (!resp.ok) continue;
      const json = await resp.json();
      if (!json.results?.length) continue;
      const results = json.results.slice(0, 12).map((r: any) => `- ${r.title}: ${r.content || ''} (${r.url})`);
      const data = `SearXNG Multi-Engine Results:\n${results.join('\n')}`;
      return { source: 'SearXNG Meta-Search (Google+Bing+Brave)', tier: 3, data, provenanceHash: await computeProvenanceHash('searxng', data), timestamp: new Date().toISOString(), confidence: 0.7, entities: extractEntitiesFromText(data, 'SearXNG') };
    } catch { continue; }
  }
  return emptyNode('SearXNG', 3);
}

async function ingestMojeek(query: string): Promise<IntelNode> {
  try {
    const resp = await fetch(`https://www.mojeek.com/search?q=${encodeURIComponent(query)}&fmt=json&t=12`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'application/json' },
      signal: AbortSignal.timeout(6000),
    });
    if (!resp.ok) return emptyNode('Mojeek', 4);
    const json = await resp.json();
    const results = (json.response?.results || []).slice(0, 10).map((r: any) => `- ${r.title}: ${r.desc || ''} (${r.url})`);
    if (!results.length) return emptyNode('Mojeek', 4);
    const data = `Mojeek Independent Index:\n${results.join('\n')}`;
    return { source: 'Mojeek (Independent Crawler)', tier: 4, data, provenanceHash: await computeProvenanceHash('mojeek', data), timestamp: new Date().toISOString(), confidence: 0.55, entities: extractEntitiesFromText(data, 'Mojeek') };
  } catch { return emptyNode('Mojeek', 4); }
}

async function ingestMetaGer(query: string): Promise<IntelNode> {
  try {
    const resp = await fetch(`https://metager.org/meta/meta.ger3?eingabe=${encodeURIComponent(query)}&focus=web&out=json`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'application/json' },
      signal: AbortSignal.timeout(6000),
    });
    if (!resp.ok) return emptyNode('MetaGer', 4);
    const json = await resp.json();
    const results = (json.results || []).slice(0, 10).map((r: any) => `- ${r.title}: ${r.description || ''} (${r.link || r.url})`);
    if (!results.length) return emptyNode('MetaGer', 4);
    const data = `MetaGer Meta-Search:\n${results.join('\n')}`;
    return { source: 'MetaGer (Privacy Meta-Search)', tier: 4, data, provenanceHash: await computeProvenanceHash('metager', data), timestamp: new Date().toISOString(), confidence: 0.55, entities: extractEntitiesFromText(data, 'MetaGer') };
  } catch { return emptyNode('MetaGer', 4); }
}

async function ingestGigablast(query: string): Promise<IntelNode> {
  try {
    const resp = await fetch(`https://www.gigablast.com/search?q=${encodeURIComponent(query)}&format=json&n=12`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'application/json' },
      signal: AbortSignal.timeout(6000),
    });
    if (!resp.ok) return emptyNode('Gigablast', 4);
    const json = await resp.json();
    const results = (json.results || []).slice(0, 10).map((r: any) => `- ${r.title}: ${r.sum || ''} (${r.url})`);
    if (!results.length) return emptyNode('Gigablast', 4);
    const data = `Gigablast Independent Index:\n${results.join('\n')}`;
    return { source: 'Gigablast (Independent Crawler)', tier: 4, data, provenanceHash: await computeProvenanceHash('gigablast', data), timestamp: new Date().toISOString(), confidence: 0.5, entities: extractEntitiesFromText(data, 'Gigablast') };
  } catch { return emptyNode('Gigablast', 4); }
}

async function ingestEdgar(query: string): Promise<IntelNode> {
  try {
    const cleaned = query.replace(/investigate|company|research|find|look up|search/gi, '').trim();
    const resp = await fetch(`https://www.sec.gov/cgi-bin/browse-edgar?company=${encodeURIComponent(cleaned)}&CIK=&type=&dateb=&owner=include&count=10&search_text=&action=getcompany&output=atom`, {
      headers: { 'User-Agent': 'AUREON-NOMAD research@aureon.ai', 'Accept': 'application/atom+xml' },
    });
    if (!resp.ok) return emptyNode('SEC EDGAR', 1);
    const text = await resp.text();
    const entries: string[] = [];
    const entryBlocks = text.split('<entry>');
    for (let i = 1; i < entryBlocks.length && entries.length < 5; i++) {
      const titleMatch = entryBlocks[i].match(/<title[^>]*>([\s\S]*?)<\/title>/);
      const cikMatch = entryBlocks[i].match(/CIK=(\d+)/);
      if (titleMatch) entries.push(`- ${titleMatch[1].trim()}${cikMatch ? ` (CIK: ${cikMatch[1]})` : ''}`);
    }
    const data = entries.length ? `SEC EDGAR Companies:\n${entries.join('\n')}` : 'No SEC filings found.';
    return {
      source: 'SEC EDGAR (U.S. Securities & Exchange Commission)',
      tier: 1,
      data,
      provenanceHash: await computeProvenanceHash('edgar', data),
      timestamp: new Date().toISOString(),
      confidence: 0.95,
      entities: extractEntitiesFromText(data, 'SEC EDGAR'),
    };
  } catch { return emptyNode('SEC EDGAR', 1); }
}

async function ingestFEC(name: string): Promise<IntelNode> {
  try {
    const cleaned = name.replace(/investigate|person|research|find|who is|look up|about/gi, '').trim();
    const resp = await fetch(`https://api.open.fec.gov/v1/names/candidates/?q=${encodeURIComponent(cleaned)}&api_key=DEMO_KEY`);
    let data = '';
    if (!resp.ok) {
      const contribResp = await fetch(`https://api.open.fec.gov/v1/schedules/schedule_a/?contributor_name=${encodeURIComponent(cleaned)}&api_key=DEMO_KEY&per_page=5&sort=-contribution_receipt_date`);
      if (!contribResp.ok) return emptyNode('FEC', 1);
      const contribData = await contribResp.json();
      if (!contribData.results?.length) return emptyNode('FEC', 1);
      data = `FEC Donations:\n${contribData.results.map((r: any) => `- $${r.contribution_receipt_amount} to ${r.committee?.name || 'Unknown'} (${r.contribution_receipt_date})`).join('\n')}`;
    } else {
      const fecData = await resp.json();
      data = `FEC Records:\n${JSON.stringify(fecData.results?.slice(0, 5)).slice(0, 1000)}`;
    }
    return {
      source: 'Federal Election Commission (FEC)',
      tier: 1,
      data,
      provenanceHash: await computeProvenanceHash('fec', data),
      timestamp: new Date().toISOString(),
      confidence: 0.92,
      entities: extractEntitiesFromText(data, 'FEC'),
    };
  } catch { return emptyNode('FEC', 1); }
}

async function ingestProPublica(name: string): Promise<IntelNode> {
  try {
    const cleaned = name.replace(/investigate|company|research|find|nonprofit/gi, '').trim();
    const resp = await fetch(`https://projects.propublica.org/nonprofits/api/v2/search.json?q=${encodeURIComponent(cleaned)}`);
    if (!resp.ok) return emptyNode('ProPublica', 2);
    const jsonData = await resp.json();
    if (!jsonData.organizations?.length) return emptyNode('ProPublica', 2);
    const data = `Nonprofit Records:\n${jsonData.organizations.slice(0, 5).map((o: any) =>
      `- ${o.name} (EIN: ${o.ein}) — ${o.city}, ${o.state} — Revenue: $${o.income_amount?.toLocaleString() || 'N/A'}`
    ).join('\n')}`;
    return {
      source: 'ProPublica Nonprofit Explorer',
      tier: 2,
      data,
      provenanceHash: await computeProvenanceHash('propublica', data),
      timestamp: new Date().toISOString(),
      confidence: 0.88,
      entities: extractEntitiesFromText(data, 'ProPublica'),
    };
  } catch { return emptyNode('ProPublica', 2); }
}

async function ingestCrtSh(domain: string): Promise<IntelNode> {
  try {
    const resp = await fetch(`https://crt.sh/?q=%25.${encodeURIComponent(domain)}&output=json`);
    if (!resp.ok) return emptyNode('crt.sh', 2);
    const jsonData = await resp.json();
    const unique = [...new Set(jsonData.slice(0, 20).map((c: any) => c.common_name || c.name_value))];
    const data = `SSL Certificate Transparency:\nSubdomains found: ${unique.length}\n${unique.slice(0, 15).map((s: string) => `- ${s}`).join('\n')}`;
    return {
      source: 'Certificate Transparency (crt.sh)',
      tier: 2,
      data,
      provenanceHash: await computeProvenanceHash('crtsh', data),
      timestamp: new Date().toISOString(),
      confidence: 0.9,
      entities: extractEntitiesFromText(data, 'crt.sh'),
    };
  } catch { return emptyNode('crt.sh', 2); }
}

async function ingestGitHub(username: string): Promise<IntelNode> {
  try {
    const resp = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, {
      headers: { 'Accept': 'application/vnd.github.v3+json' },
    });
    if (!resp.ok) return emptyNode('GitHub', 3);
    const user = await resp.json();
    const repoResp = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=5`, {
      headers: { 'Accept': 'application/vnd.github.v3+json' },
    });
    const repos = repoResp.ok ? await repoResp.json() : [];
    const data = `GitHub Profile:\n- Name: ${user.name || 'N/A'}\n- Bio: ${user.bio || 'N/A'}\n- Location: ${user.location || 'N/A'}\n- Company: ${user.company || 'N/A'}\n- Public repos: ${user.public_repos}\n- Followers: ${user.followers}\n- Created: ${user.created_at}\n- Email: ${user.email || 'N/A'}\nRecent Repos:\n${repos.map((r: any) => `- ${r.full_name} (${r.language || 'N/A'}) ⭐${r.stargazers_count}`).join('\n')}`;
    return {
      source: 'GitHub API',
      tier: 3,
      data,
      provenanceHash: await computeProvenanceHash('github', data),
      timestamp: new Date().toISOString(),
      confidence: 0.85,
      entities: extractEntitiesFromText(data, 'GitHub'),
    };
  } catch { return emptyNode('GitHub', 3); }
}

async function ingestGitHubSearch(query: string): Promise<IntelNode> {
  try {
    const resp = await fetch(`https://api.github.com/search/users?q=${encodeURIComponent(query)}&per_page=5`, {
      headers: { 'Accept': 'application/vnd.github.v3+json' },
    });
    if (!resp.ok) return emptyNode('GitHub Search', 3);
    const data = await resp.json();
    if (!data.items?.length) return emptyNode('GitHub Search', 3);
    const text = `GitHub Users Found:\n${data.items.map((u: any) => `- ${u.login} (${u.html_url})`).join('\n')}`;
    return {
      source: 'GitHub User Search',
      tier: 3,
      data: text,
      provenanceHash: await computeProvenanceHash('github-search', text),
      timestamp: new Date().toISOString(),
      confidence: 0.8,
      entities: extractEntitiesFromText(text, 'GitHub Search'),
    };
  } catch { return emptyNode('GitHub Search', 3); }
}

async function ingestReddit(query: string): Promise<IntelNode> {
  try {
    const resp = await fetch(`https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&limit=10&sort=relevance`, {
      headers: { 'User-Agent': 'AUREON-NOMAD/3.0' },
    });
    if (!resp.ok) return emptyNode('Reddit', 4);
    const data = await resp.json();
    const posts = data.data?.children || [];
    if (!posts.length) return emptyNode('Reddit', 4);
    const text = `Reddit Results:\n${posts.map((p: any) => `- r/${p.data.subreddit}: ${p.data.title} (${p.data.score} pts, ${p.data.num_comments} comments)\n  Author: u/${p.data.author} | ${new Date(p.data.created_utc * 1000).toISOString().split('T')[0]}`).join('\n')}`;
    return {
      source: 'Reddit',
      tier: 4,
      data: text,
      provenanceHash: await computeProvenanceHash('reddit', text),
      timestamp: new Date().toISOString(),
      confidence: 0.45,
      entities: extractEntitiesFromText(text, 'Reddit'),
    };
  } catch { return emptyNode('Reddit', 4); }
}

async function ingestHIBP(email: string): Promise<IntelNode> {
  try {
    const apiKey = Deno.env.get('HIBP_API_KEY');
    const headers: Record<string, string> = { 'User-Agent': 'AUREON-NOMAD' };
    if (apiKey) headers['hibp-api-key'] = apiKey;
    const resp = await fetch(`https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`, { headers });
    if (resp.status === 404) {
      return { source: 'HaveIBeenPwned', tier: 2, data: 'No breaches found (good news!).', provenanceHash: await computeProvenanceHash('hibp', 'clean'), timestamp: new Date().toISOString(), confidence: 0.9, entities: [] };
    }
    if (!resp.ok) return emptyNode('HaveIBeenPwned', 2);
    const breaches = await resp.json();
    const data = `Email Breach Report (${email}):\n${breaches.map((b: any) => `- ${b.Name} (${b.BreachDate}): ${b.DataClasses?.join(', ') || 'Unknown data'} — ${b.PwnCount?.toLocaleString() || '?'} accounts affected`).join('\n')}`;
    return {
      source: 'HaveIBeenPwned',
      tier: 2,
      data,
      provenanceHash: await computeProvenanceHash('hibp', data),
      timestamp: new Date().toISOString(),
      confidence: 0.92,
      entities: extractEntitiesFromText(data, 'HIBP'),
    };
  } catch { return emptyNode('HaveIBeenPwned', 2); }
}

async function ingestWHOIS(domain: string): Promise<IntelNode> {
  try {
    const apiKey = Deno.env.get('WHOIS_API_KEY');
    if (!apiKey) return emptyNode('WHOIS', 2);
    const resp = await fetch(`https://www.whoisxmlapi.com/whoisserver/WhoisService?apiKey=${apiKey}&domainName=${encodeURIComponent(domain)}&outputFormat=JSON`);
    if (!resp.ok) return emptyNode('WHOIS', 2);
    const jsonData = await resp.json();
    const whois = jsonData.WhoisRecord;
    if (!whois) return emptyNode('WHOIS', 2);
    const data = `WHOIS Data for ${domain}:\n- Registrar: ${whois.registrarName || 'N/A'}\n- Created: ${whois.createdDate || 'N/A'}\n- Updated: ${whois.updatedDate || 'N/A'}\n- Expires: ${whois.expiresDate || 'N/A'}\n- Registrant: ${whois.registrant?.organization || 'REDACTED'}\n- Registrant Country: ${whois.registrant?.country || 'N/A'}\n- Name Servers: ${whois.nameServers?.hostNames?.join(', ') || 'N/A'}`;
    return {
      source: 'WHOIS Domain Registry',
      tier: 2,
      data,
      provenanceHash: await computeProvenanceHash('whois', data),
      timestamp: new Date().toISOString(),
      confidence: 0.9,
      entities: extractEntitiesFromText(data, 'WHOIS'),
    };
  } catch { return emptyNode('WHOIS', 2); }
}

async function ingestCourtListener(name: string): Promise<IntelNode> {
  try {
    const apiKey = Deno.env.get('COURTLISTENER_API_KEY');
    const headers: Record<string, string> = {};
    if (apiKey) headers['Authorization'] = `Token ${apiKey}`;
    const resp = await fetch(`https://www.courtlistener.com/api/rest/v3/search/?q=${encodeURIComponent(name)}&type=o&page_size=5`, { headers });
    if (!resp.ok) return emptyNode('CourtListener', 1);
    const jsonData = await resp.json();
    if (!jsonData.results?.length) return emptyNode('CourtListener', 1);
    const data = `Court Cases:\n${jsonData.results.slice(0, 5).map((c: any) => `- ${c.caseName || c.case_name || 'Unknown'} (${c.court || 'Unknown court'}) — ${c.dateFiled || c.date_filed || 'N/A'}`).join('\n')}`;
    return {
      source: 'CourtListener (Federal & State Courts)',
      tier: 1,
      data,
      provenanceHash: await computeProvenanceHash('court', data),
      timestamp: new Date().toISOString(),
      confidence: 0.93,
      entities: extractEntitiesFromText(data, 'CourtListener'),
    };
  } catch { return emptyNode('CourtListener', 1); }
}

async function ingestUSASpending(query: string): Promise<IntelNode> {
  try {
    const cleaned = query.replace(/investigate|company|research|find|federal|contract|government/gi, '').trim();
    const resp = await fetch('https://api.usaspending.gov/api/v2/search/spending_by_award/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filters: { keywords: [cleaned] },
        fields: ['Award ID', 'Recipient Name', 'Award Amount', 'Awarding Agency', 'Start Date'],
        limit: 5, page: 1, sort: 'Award Amount', order: 'desc',
      }),
    });
    if (!resp.ok) return emptyNode('USASpending', 1);
    const jsonData = await resp.json();
    if (!jsonData.results?.length) return emptyNode('USASpending', 1);
    const data = `Federal Contracts (USASpending):\n${jsonData.results.map((r: any) =>
      `- ${r['Recipient Name']} — $${Number(r['Award Amount']).toLocaleString()} from ${r['Awarding Agency']} (${r['Start Date']})`
    ).join('\n')}`;
    return {
      source: 'USASpending.gov (Federal Contracts)',
      tier: 1,
      data,
      provenanceHash: await computeProvenanceHash('usaspending', data),
      timestamp: new Date().toISOString(),
      confidence: 0.95,
      entities: extractEntitiesFromText(data, 'USASpending'),
    };
  } catch { return emptyNode('USASpending', 1); }
}

// ── ESRC: Cross-Platform Identity Search Vectors ─────────────────────────────

async function ingestLinkedInProxy(query: string): Promise<IntelNode> {
  // Search for LinkedIn-like professional data via DuckDuckGo site search
  try {
    const cleaned = query.replace(/investigate|person|research|find|who is|look up|about/gi, '').trim();
    const resp = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleaned + ' site:linkedin.com')}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'text/html' },
    });
    if (!resp.ok) return emptyNode('LinkedIn Proxy', 3);
    const html = await resp.text();
    const results: string[] = [];
    const blocks = html.split(/class="result\s/);
    for (let i = 1; i < blocks.length && results.length < 5; i++) {
      const titleMatch = blocks[i].match(/class="result__a"[^>]*>([\s\S]*?)<\/a>/);
      const snippetMatch = blocks[i].match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : '';
      const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]*>/g, '').trim() : '';
      if (title) results.push(`- ${title}: ${snippet}`);
    }
    const data = results.length ? `LinkedIn Search Results:\n${results.join('\n')}` : '';
    if (!data) return emptyNode('LinkedIn Proxy', 3);
    return {
      source: 'LinkedIn (via web search)',
      tier: 3,
      data,
      provenanceHash: await computeProvenanceHash('linkedin-proxy', data),
      timestamp: new Date().toISOString(),
      confidence: 0.7,
      entities: extractEntitiesFromText(data, 'LinkedIn Proxy'),
    };
  } catch { return emptyNode('LinkedIn Proxy', 3); }
}

async function ingestTwitterProxy(query: string): Promise<IntelNode> {
  try {
    const cleaned = query.replace(/investigate|person|research|find|who is|look up|about/gi, '').trim();
    const resp = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleaned + ' site:twitter.com OR site:x.com')}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'text/html' },
    });
    if (!resp.ok) return emptyNode('Twitter/X Proxy', 4);
    const html = await resp.text();
    const results: string[] = [];
    const blocks = html.split(/class="result\s/);
    for (let i = 1; i < blocks.length && results.length < 5; i++) {
      const titleMatch = blocks[i].match(/class="result__a"[^>]*>([\s\S]*?)<\/a>/);
      const snippetMatch = blocks[i].match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : '';
      const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]*>/g, '').trim() : '';
      if (title) results.push(`- ${title}: ${snippet}`);
    }
    const data = results.length ? `Twitter/X Results:\n${results.join('\n')}` : '';
    if (!data) return emptyNode('Twitter/X Proxy', 4);
    return {
      source: 'Twitter/X (via web search)',
      tier: 4,
      data,
      provenanceHash: await computeProvenanceHash('twitter-proxy', data),
      timestamp: new Date().toISOString(),
      confidence: 0.55,
      entities: extractEntitiesFromText(data, 'Twitter/X Proxy'),
    };
  } catch { return emptyNode('Twitter/X Proxy', 4); }
}

async function ingestAcademicSearch(query: string): Promise<IntelNode> {
  try {
    const cleaned = query.replace(/investigate|person|research|find|who is|look up|about/gi, '').trim();
    const resp = await fetch(`https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(cleaned)}&limit=5&fields=title,authors,year,citationCount,url`);
    if (!resp.ok) return emptyNode('Semantic Scholar', 2);
    const data = await resp.json();
    if (!data.data?.length) return emptyNode('Semantic Scholar', 2);
    const text = `Academic Publications:\n${data.data.map((p: any) => 
      `- "${p.title}" (${p.year || 'N/A'}) — ${p.authors?.map((a: any) => a.name).join(', ') || 'Unknown'} — Citations: ${p.citationCount || 0}`
    ).join('\n')}`;
    return {
      source: 'Semantic Scholar (Academic)',
      tier: 2,
      data: text,
      provenanceHash: await computeProvenanceHash('semantic-scholar', text),
      timestamp: new Date().toISOString(),
      confidence: 0.88,
      entities: extractEntitiesFromText(text, 'Semantic Scholar'),
    };
  } catch { return emptyNode('Semantic Scholar', 2); }
}

function emptyNode(source: string, tier: 1 | 2 | 3 | 4): IntelNode {
  return { source, tier, data: '', provenanceHash: '', timestamp: new Date().toISOString(), confidence: 0, entities: [], images: [] };
}

// ── Image Collection Engine ─────────────────────────────────────────────────

function extractImagesFromHtml(html: string, source: string): CollectedImage[] {
  const images: CollectedImage[] = [];
  const seen = new Set<string>();
  const imgMatches = html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?/gi);
  for (const m of imgMatches) {
    const url = m[1];
    if (!url || seen.has(url)) continue;
    if (url.includes('data:') || url.includes('pixel') || url.includes('1x1') || 
        url.includes('tracking') || url.includes('spacer') || url.length < 20) continue;
    if (!/^https?:\/\//i.test(url)) continue;
    if (/doubleclick|googlesyndication|facebook\.com\/tr|analytics|adsystem/i.test(url)) continue;
    seen.add(url);
    images.push({ url, title: m[2] || '', source });
  }
  return images.slice(0, 5);
}

async function ingestDDGImages(query: string): Promise<CollectedImage[]> {
  try {
    const resp = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query + ' photos images')}&iax=images&ia=images`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    if (!resp.ok) return [];
    const html = await resp.text();
    const images: CollectedImage[] = [];
    const seen = new Set<string>();
    const thumbMatches = html.matchAll(/(?:data-src|src)=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|gif|webp)[^"']*)["']/gi);
    for (const m of thumbMatches) {
      const url = m[1];
      if (!url || seen.has(url)) continue;
      if (/pixel|spacer|tracking|1x1|icon/i.test(url)) continue;
      seen.add(url);
      images.push({ url, title: '', source: 'DuckDuckGo Images', thumbnail: url });
    }
    return images.slice(0, 10);
  } catch { return []; }
}

async function ingestGoogleImages(query: string): Promise<CollectedImage[]> {
  try {
    const apiKey = Deno.env.get('GOOGLE_CSE_API_KEY');
    const cseId = Deno.env.get('GOOGLE_CSE_ID');
    if (!apiKey || !cseId) return [];
    const resp = await fetch(`https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cseId}&q=${encodeURIComponent(query)}&searchType=image&num=8`);
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.items || []).slice(0, 8).map((item: any) => ({
      url: item.link,
      title: item.title || '',
      source: 'Google Images',
      thumbnail: item.image?.thumbnailLink || item.link,
    }));
  } catch { return []; }
}

async function collectInvestigationImages(query: string, nodes: IntelNode[]): Promise<CollectedImage[]> {
  const allImages: CollectedImage[] = [];
  const seen = new Set<string>();
  
  for (const node of nodes) {
    if (node.images) {
      for (const img of node.images) {
        if (!seen.has(img.url)) { seen.add(img.url); allImages.push(img); }
      }
    }
  }
  
  const [ddgImages, googleImages] = await Promise.allSettled([
    ingestDDGImages(query),
    ingestGoogleImages(query),
  ]);
  
  const results = [
    ...(ddgImages.status === 'fulfilled' ? ddgImages.value : []),
    ...(googleImages.status === 'fulfilled' ? googleImages.value : []),
  ];
  
  for (const img of results) {
    if (!seen.has(img.url)) { seen.add(img.url); allImages.push(img); }
  }
  
  for (const node of nodes) {
    if (node.data && node.data.includes('<img')) {
      const htmlImages = extractImagesFromHtml(node.data, node.source);
      for (const img of htmlImages) {
        if (!seen.has(img.url)) { seen.add(img.url); allImages.push(img); }
      }
    }
  }
  
  return allImages.slice(0, 20);
}

// ══════════════════════════════════════════════════════════════════════════════
// OSINT SEARCH ENGINES — 12-Engine Intelligence Collection Suite
// ══════════════════════════════════════════════════════════════════════════════

// ── 1. Google Custom Search (Advanced Operators) ─────────────────────────────
async function ingestGoogleCSE(query: string, operators?: string): Promise<IntelNode> {
  try {
    const apiKey = Deno.env.get('GOOGLE_CSE_API_KEY');
    const cx = Deno.env.get('GOOGLE_CSE_CX');
    if (!apiKey || !cx) return emptyNode('Google CSE', 2);
    const q = operators ? `${query} ${operators}` : query;
    const resp = await fetch(`https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(q)}&num=10`);
    if (!resp.ok) return emptyNode('Google CSE', 2);
    const json = await resp.json();
    if (!json.items?.length) return emptyNode('Google CSE', 2);
    const data = `Google Search Results:\n${json.items.map((r: any) => `- ${r.title}\n  ${r.link}\n  ${r.snippet || ''}`).join('\n')}`;
    return {
      source: 'Google Custom Search (Advanced Operators)',
      tier: 2,
      data,
      provenanceHash: await computeProvenanceHash('google-cse', data),
      timestamp: new Date().toISOString(),
      confidence: 0.8,
      entities: extractEntitiesFromText(data, 'Google CSE'),
    };
  } catch { return emptyNode('Google CSE', 2); }
}

// ── 2. Shodan — Internet-Facing Asset Discovery ─────────────────────────────
async function ingestShodan(query: string): Promise<IntelNode> {
  try {
    const apiKey = Deno.env.get('SHODAN_API_KEY');
    if (!apiKey) return emptyNode('Shodan', 1);
    // Detect if query is an IP or a search query
    const isIP = /^(\d{1,3}\.){3}\d{1,3}$/.test(query.trim());
    let data = '';
    if (isIP) {
      const resp = await fetch(`https://api.shodan.io/shodan/host/${query.trim()}?key=${apiKey}`);
      if (!resp.ok) return emptyNode('Shodan', 1);
      const host = await resp.json();
      const ports = host.ports?.join(', ') || 'None';
      const vulns = host.vulns?.slice(0, 10).join(', ') || 'None detected';
      data = `Shodan Host Report (${query.trim()}):\n- IP: ${host.ip_str}\n- Organization: ${host.org || 'N/A'}\n- ISP: ${host.isp || 'N/A'}\n- OS: ${host.os || 'Unknown'}\n- Country: ${host.country_name || 'N/A'}\n- City: ${host.city || 'N/A'}\n- Open Ports: ${ports}\n- Vulnerabilities: ${vulns}\n- Hostnames: ${host.hostnames?.join(', ') || 'None'}\n- Last Update: ${host.last_update || 'N/A'}`;
      if (host.data?.length) {
        data += `\n\nService Banners:\n${host.data.slice(0, 5).map((s: any) => `- Port ${s.port}/${s.transport || 'tcp'}: ${s.product || 'Unknown'} ${s.version || ''} — ${(s.data || '').slice(0, 200)}`).join('\n')}`;
      }
    } else {
      const cleaned = query.replace(/investigate|search|find|scan|shodan/gi, '').trim();
      const resp = await fetch(`https://api.shodan.io/shodan/host/search?key=${apiKey}&query=${encodeURIComponent(cleaned)}&page=1`);
      if (!resp.ok) return emptyNode('Shodan', 1);
      const results = await resp.json();
      if (!results.matches?.length) return emptyNode('Shodan', 1);
      data = `Shodan Search Results (${results.total} total):\n${results.matches.slice(0, 10).map((m: any) => 
        `- ${m.ip_str}:${m.port} | ${m.org || 'N/A'} | ${m.product || 'Unknown'} ${m.version || ''} | ${m.country_name || 'N/A'} | ${m.hostnames?.join(', ') || 'No hostname'}`
      ).join('\n')}`;
    }
    return {
      source: 'Shodan (Internet Asset Discovery)',
      tier: 1,
      data,
      provenanceHash: await computeProvenanceHash('shodan', data),
      timestamp: new Date().toISOString(),
      confidence: 0.92,
      entities: extractEntitiesFromText(data, 'Shodan'),
    };
  } catch { return emptyNode('Shodan', 1); }
}

// ── 3. Censys — Certificate-Centric Internet Scanning ───────────────────────
async function ingestCensys(query: string): Promise<IntelNode> {
  try {
    const apiId = Deno.env.get('CENSYS_API_ID');
    const apiSecret = Deno.env.get('CENSYS_API_SECRET');
    if (!apiId || !apiSecret) return emptyNode('Censys', 1);
    const auth = btoa(`${apiId}:${apiSecret}`);
    const cleaned = query.replace(/investigate|search|find|scan|censys/gi, '').trim();
    const resp = await fetch('https://search.censys.io/api/v2/hosts/search', {
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: cleaned, per_page: 10 }),
    });
    if (!resp.ok) return emptyNode('Censys', 1);
    const json = await resp.json();
    const hits = json.result?.hits || [];
    if (!hits.length) return emptyNode('Censys', 1);
    const data = `Censys Host Search (${json.result?.total || 0} total):\n${hits.map((h: any) => {
      const services = h.services?.map((s: any) => `${s.port}/${s.transport_protocol}: ${s.service_name || 'unknown'}`).join(', ') || 'N/A';
      return `- ${h.ip} | ${h.autonomous_system?.name || 'N/A'} (AS${h.autonomous_system?.asn || '?'}) | ${h.location?.country || 'N/A'} | Services: ${services}`;
    }).join('\n')}`;
    return {
      source: 'Censys (Internet Scanning & Certificate Intelligence)',
      tier: 1,
      data,
      provenanceHash: await computeProvenanceHash('censys', data),
      timestamp: new Date().toISOString(),
      confidence: 0.93,
      entities: extractEntitiesFromText(data, 'Censys'),
    };
  } catch { return emptyNode('Censys', 1); }
}

// ── 4. SecurityTrails — DNS & Domain Intelligence ───────────────────────────
async function ingestSecurityTrails(domain: string): Promise<IntelNode> {
  try {
    const apiKey = Deno.env.get('SECURITYTRAILS_API_KEY');
    if (!apiKey) return emptyNode('SecurityTrails', 1);
    const cleaned = domain.replace(/investigate|search|find|dns|domain/gi, '').trim();
    // Domain details
    const resp = await fetch(`https://api.securitytrails.com/v1/domain/${encodeURIComponent(cleaned)}`, {
      headers: { 'APIKEY': apiKey, 'Accept': 'application/json' },
    });
    if (!resp.ok) return emptyNode('SecurityTrails', 1);
    const json = await resp.json();
    let data = `SecurityTrails Domain Report (${cleaned}):\n- Hostname: ${json.hostname || 'N/A'}\n- Alexa Rank: ${json.alexa_rank || 'N/A'}\n- Current DNS:\n`;
    if (json.current_dns) {
      const dns = json.current_dns;
      if (dns.a) data += `  A Records: ${dns.a.values?.map((v: any) => v.ip).join(', ') || 'N/A'}\n`;
      if (dns.mx) data += `  MX Records: ${dns.mx.values?.map((v: any) => `${v.hostname} (priority: ${v.priority})`).join(', ') || 'N/A'}\n`;
      if (dns.ns) data += `  NS Records: ${dns.ns.values?.map((v: any) => v.nameserver).join(', ') || 'N/A'}\n`;
      if (dns.txt) data += `  TXT Records: ${dns.txt.values?.map((v: any) => v.value?.slice(0, 100)).join('; ') || 'N/A'}\n`;
    }
    // Subdomains
    const subResp = await fetch(`https://api.securitytrails.com/v1/domain/${encodeURIComponent(cleaned)}/subdomains?children_only=false`, {
      headers: { 'APIKEY': apiKey, 'Accept': 'application/json' },
    });
    if (subResp.ok) {
      const subJson = await subResp.json();
      const subs = subJson.subdomains?.slice(0, 20) || [];
      if (subs.length) data += `\nSubdomains (${subJson.subdomain_count || subs.length} total):\n${subs.map((s: string) => `- ${s}.${cleaned}`).join('\n')}`;
    }
    // Historical DNS
    const histResp = await fetch(`https://api.securitytrails.com/v1/history/${encodeURIComponent(cleaned)}/dns/a`, {
      headers: { 'APIKEY': apiKey, 'Accept': 'application/json' },
    });
    if (histResp.ok) {
      const histJson = await histResp.json();
      const records = histJson.records?.slice(0, 10) || [];
      if (records.length) data += `\n\nHistorical A Records:\n${records.map((r: any) => `- ${r.values?.map((v: any) => v.ip).join(', ') || 'N/A'} (first: ${r.first_seen || 'N/A'}, last: ${r.last_seen || 'N/A'})`).join('\n')}`;
    }
    return {
      source: 'SecurityTrails (DNS & Domain Intelligence)',
      tier: 1,
      data,
      provenanceHash: await computeProvenanceHash('securitytrails', data),
      timestamp: new Date().toISOString(),
      confidence: 0.94,
      entities: extractEntitiesFromText(data, 'SecurityTrails'),
    };
  } catch { return emptyNode('SecurityTrails', 1); }
}

// ── 5. VirusTotal — Malware & IOC Intelligence ──────────────────────────────
async function ingestVirusTotal(query: string): Promise<IntelNode> {
  try {
    const apiKey = Deno.env.get('VIRUSTOTAL_API_KEY');
    if (!apiKey) return emptyNode('VirusTotal', 1);
    const cleaned = query.replace(/investigate|search|find|virustotal|malware|ioc/gi, '').trim();
    let data = '';
    const isIP = /^(\d{1,3}\.){3}\d{1,3}$/.test(cleaned);
    const isDomain = /^[\w.-]+\.\w{2,}$/.test(cleaned) && !isIP;
    const isHash = /^[a-fA-F0-9]{32,64}$/.test(cleaned);
    const isURL = cleaned.startsWith('http');
    let endpoint = '';
    if (isHash) endpoint = `https://www.virustotal.com/api/v3/files/${cleaned}`;
    else if (isDomain) endpoint = `https://www.virustotal.com/api/v3/domains/${cleaned}`;
    else if (isIP) endpoint = `https://www.virustotal.com/api/v3/ip_addresses/${cleaned}`;
    else if (isURL) {
      const urlId = btoa(cleaned).replace(/=/g, '');
      endpoint = `https://www.virustotal.com/api/v3/urls/${urlId}`;
    } else {
      // Search
      const resp = await fetch(`https://www.virustotal.com/api/v3/search?query=${encodeURIComponent(cleaned)}&limit=5`, {
        headers: { 'x-apikey': apiKey },
      });
      if (!resp.ok) return emptyNode('VirusTotal', 1);
      const json = await resp.json();
      if (!json.data?.length) return emptyNode('VirusTotal', 1);
      data = `VirusTotal Search Results:\n${json.data.slice(0, 5).map((item: any) => {
        const attrs = item.attributes || {};
        const stats = attrs.last_analysis_stats || {};
        return `- [${item.type}] ${attrs.meaningful_name || attrs.name || item.id}\n  Malicious: ${stats.malicious || 0}/${(stats.malicious || 0) + (stats.undetected || 0) + (stats.harmless || 0)}\n  Tags: ${attrs.tags?.join(', ') || 'none'}`;
      }).join('\n')}`;
      return { source: 'VirusTotal (Threat Intelligence)', tier: 1, data, provenanceHash: await computeProvenanceHash('vt', data), timestamp: new Date().toISOString(), confidence: 0.93, entities: extractEntitiesFromText(data, 'VirusTotal') };
    }
    const resp = await fetch(endpoint, { headers: { 'x-apikey': apiKey } });
    if (!resp.ok) return emptyNode('VirusTotal', 1);
    const json = await resp.json();
    const attrs = json.data?.attributes || {};
    const stats = attrs.last_analysis_stats || {};
    if (isHash) {
      data = `VirusTotal File Report:\n- Name: ${attrs.meaningful_name || attrs.name || 'Unknown'}\n- SHA256: ${attrs.sha256 || cleaned}\n- Type: ${attrs.type_description || 'N/A'}\n- Size: ${attrs.size || 'N/A'} bytes\n- Detection: ${stats.malicious || 0}/${(stats.malicious || 0) + (stats.undetected || 0)} engines\n- Tags: ${attrs.tags?.join(', ') || 'none'}\n- First Seen: ${attrs.first_submission_date ? new Date(attrs.first_submission_date * 1000).toISOString() : 'N/A'}\n- Last Analysis: ${attrs.last_analysis_date ? new Date(attrs.last_analysis_date * 1000).toISOString() : 'N/A'}`;
    } else if (isDomain) {
      data = `VirusTotal Domain Report (${cleaned}):\n- Reputation: ${attrs.reputation || 'N/A'}\n- Categories: ${Object.values(attrs.categories || {}).join(', ') || 'N/A'}\n- Detection: ${stats.malicious || 0} malicious / ${stats.harmless || 0} harmless\n- Registrar: ${attrs.registrar || 'N/A'}\n- Creation: ${attrs.creation_date ? new Date(attrs.creation_date * 1000).toISOString() : 'N/A'}\n- Last DNS: ${JSON.stringify(attrs.last_dns_records?.slice(0, 5) || [])}`;
    } else if (isIP) {
      data = `VirusTotal IP Report (${cleaned}):\n- AS Owner: ${attrs.as_owner || 'N/A'}\n- ASN: ${attrs.asn || 'N/A'}\n- Country: ${attrs.country || 'N/A'}\n- Reputation: ${attrs.reputation || 'N/A'}\n- Detection: ${stats.malicious || 0} malicious / ${stats.harmless || 0} harmless\n- Network: ${attrs.network || 'N/A'}`;
    }
    return {
      source: 'VirusTotal (Threat Intelligence)',
      tier: 1,
      data,
      provenanceHash: await computeProvenanceHash('virustotal', data),
      timestamp: new Date().toISOString(),
      confidence: 0.94,
      entities: extractEntitiesFromText(data, 'VirusTotal'),
    };
  } catch { return emptyNode('VirusTotal', 1); }
}

// ── 6. GreyNoise — Background Noise vs Targeted Scanning ────────────────────
async function ingestGreyNoise(query: string): Promise<IntelNode> {
  try {
    const apiKey = Deno.env.get('GREYNOISE_API_KEY');
    if (!apiKey) return emptyNode('GreyNoise', 2);
    const cleaned = query.replace(/investigate|search|find|greynoise|noise|scan/gi, '').trim();
    const isIP = /^(\d{1,3}\.){3}\d{1,3}$/.test(cleaned);
    let data = '';
    if (isIP) {
      const resp = await fetch(`https://api.greynoise.io/v3/community/${cleaned}`, {
        headers: { 'key': apiKey, 'Accept': 'application/json' },
      });
      if (!resp.ok) return emptyNode('GreyNoise', 2);
      const json = await resp.json();
      data = `GreyNoise IP Report (${cleaned}):\n- Classification: ${json.classification || 'Unknown'}\n- Noise: ${json.noise ? 'YES (internet background noise)' : 'NO (not seen scanning)'}\n- RIOT: ${json.riot ? 'YES (common business service)' : 'NO'}\n- Name: ${json.name || 'N/A'}\n- Last Seen: ${json.last_seen || 'N/A'}\n- Message: ${json.message || 'N/A'}`;
    } else {
      // GNQL query
      const resp = await fetch(`https://api.greynoise.io/v3/gnql?query=${encodeURIComponent(cleaned)}&size=10`, {
        headers: { 'key': apiKey, 'Accept': 'application/json' },
      });
      if (!resp.ok) return emptyNode('GreyNoise', 2);
      const json = await resp.json();
      if (!json.data?.length) return emptyNode('GreyNoise', 2);
      data = `GreyNoise GNQL Results (${json.count || 0} total):\n${json.data.slice(0, 10).map((r: any) => 
        `- ${r.ip} | ${r.classification || 'unknown'} | ${r.organization || 'N/A'} | ${r.operating_system || 'N/A'} | Last: ${r.last_seen || 'N/A'} | Tags: ${r.tags?.join(', ') || 'none'}`
      ).join('\n')}`;
    }
    return {
      source: 'GreyNoise (Noise vs Targeted Scanning)',
      tier: 2,
      data,
      provenanceHash: await computeProvenanceHash('greynoise', data),
      timestamp: new Date().toISOString(),
      confidence: 0.88,
      entities: extractEntitiesFromText(data, 'GreyNoise'),
    };
  } catch { return emptyNode('GreyNoise', 2); }
}

// ── 7. BinaryEdge — Attack Surface & Historical Exposure ────────────────────
async function ingestBinaryEdge(query: string): Promise<IntelNode> {
  try {
    const apiKey = Deno.env.get('BINARYEDGE_API_KEY');
    if (!apiKey) return emptyNode('BinaryEdge', 2);
    const cleaned = query.replace(/investigate|search|find|binaryedge|exposure|surface/gi, '').trim();
    const isIP = /^(\d{1,3}\.){3}\d{1,3}$/.test(cleaned);
    let data = '';
    if (isIP) {
      const resp = await fetch(`https://api.binaryedge.io/v2/query/ip/${cleaned}`, {
        headers: { 'X-Key': apiKey },
      });
      if (!resp.ok) return emptyNode('BinaryEdge', 2);
      const json = await resp.json();
      const events = json.events || [];
      data = `BinaryEdge IP Report (${cleaned}):\n- Total Events: ${json.total || 0}\n${events.slice(0, 8).map((e: any) => {
        const result = e.results?.[0] || {};
        return `- Port ${result.target?.port || '?'}/${result.target?.protocol || 'tcp'}: ${result.result?.data?.service?.name || 'unknown'} | Banner: ${(result.result?.data?.service?.banner || '').slice(0, 150)}`;
      }).join('\n')}`;
    } else {
      const resp = await fetch(`https://api.binaryedge.io/v2/query/search?query=${encodeURIComponent(cleaned)}&page=1&pagesize=10`, {
        headers: { 'X-Key': apiKey },
      });
      if (!resp.ok) return emptyNode('BinaryEdge', 2);
      const json = await resp.json();
      if (!json.events?.length) return emptyNode('BinaryEdge', 2);
      data = `BinaryEdge Search (${json.total || 0} total):\n${json.events.slice(0, 10).map((e: any) => {
        const result = e.results?.[0] || {};
        const target = result.target || {};
        return `- ${target.ip || 'N/A'}:${target.port || '?'} | ${result.result?.data?.service?.name || 'unknown'}`;
      }).join('\n')}`;
    }
    return {
      source: 'BinaryEdge (Attack Surface Scanning)',
      tier: 2,
      data,
      provenanceHash: await computeProvenanceHash('binaryedge', data),
      timestamp: new Date().toISOString(),
      confidence: 0.87,
      entities: extractEntitiesFromText(data, 'BinaryEdge'),
    };
  } catch { return emptyNode('BinaryEdge', 2); }
}

// ── 8. FOFA — Massive Device/Service Search ─────────────────────────────────
async function ingestFOFA(query: string): Promise<IntelNode> {
  try {
    const email = Deno.env.get('FOFA_EMAIL');
    const apiKey = Deno.env.get('FOFA_API_KEY');
    if (!email || !apiKey) return emptyNode('FOFA', 2);
    const cleaned = query.replace(/investigate|search|find|fofa|device/gi, '').trim();
    const qbase64 = btoa(cleaned);
    const resp = await fetch(`https://fofa.info/api/v1/search/all?email=${encodeURIComponent(email)}&key=${apiKey}&qbase64=${qbase64}&size=10&fields=ip,port,protocol,host,domain,title,country,city,server,banner`);
    if (!resp.ok) return emptyNode('FOFA', 2);
    const json = await resp.json();
    if (!json.results?.length) return emptyNode('FOFA', 2);
    const data = `FOFA Search (${json.size || 0} total results):\n${json.results.slice(0, 10).map((r: any) => {
      const [ip, port, protocol, host, domain, title, country, city, server, banner] = r;
      return `- ${ip || 'N/A'}:${port || '?'} | ${protocol || 'tcp'} | ${host || domain || 'N/A'} | ${title || 'No title'} | ${country || 'N/A'}/${city || 'N/A'} | Server: ${server || 'N/A'}`;
    }).join('\n')}`;
    return {
      source: 'FOFA (Global Device/Service Discovery)',
      tier: 2,
      data,
      provenanceHash: await computeProvenanceHash('fofa', data),
      timestamp: new Date().toISOString(),
      confidence: 0.85,
      entities: extractEntitiesFromText(data, 'FOFA'),
    };
  } catch { return emptyNode('FOFA', 2); }
}

// ── 9. urlscan.io — URL Detonation & Infrastructure Reuse ───────────────────
async function ingestUrlscan(query: string): Promise<IntelNode> {
  try {
    const cleaned = query.replace(/investigate|search|find|urlscan|url/gi, '').trim();
    // Public search API (no key required)
    const resp = await fetch(`https://urlscan.io/api/v1/search/?q=${encodeURIComponent(cleaned)}&size=10`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!resp.ok) return emptyNode('urlscan.io', 2);
    const json = await resp.json();
    if (!json.results?.length) return emptyNode('urlscan.io', 2);
    const data = `urlscan.io Results:\n${json.results.slice(0, 10).map((r: any) => {
      const page = r.page || {};
      const task = r.task || {};
      return `- ${page.url || task.url || 'N/A'}\n  Domain: ${page.domain || 'N/A'} | IP: ${page.ip || 'N/A'} | Server: ${page.server || 'N/A'}\n  Title: ${page.title || 'N/A'} | Country: ${page.country || 'N/A'}\n  Verdict: ${r.verdicts?.overall?.malicious ? '🔴 MALICIOUS' : '🟢 Clean'} | Score: ${r.verdicts?.overall?.score || 0}`;
    }).join('\n')}`;
    return {
      source: 'urlscan.io (URL Detonation & Infrastructure)',
      tier: 2,
      data,
      provenanceHash: await computeProvenanceHash('urlscan', data),
      timestamp: new Date().toISOString(),
      confidence: 0.88,
      entities: extractEntitiesFromText(data, 'urlscan.io'),
    };
  } catch { return emptyNode('urlscan.io', 2); }
}

// ── 10. GitHub Code Search — Secret Hunting & Exposed Configs ───────────────
async function ingestGitHubCodeSearch(query: string): Promise<IntelNode> {
  try {
    const cleaned = query.replace(/investigate|search|find|github|code|secret/gi, '').trim();
    const resp = await fetch(`https://api.github.com/search/code?q=${encodeURIComponent(cleaned)}&per_page=10`, {
      headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'AUREON-NOMAD/3.0' },
    });
    if (!resp.ok) return emptyNode('GitHub Code Search', 3);
    const json = await resp.json();
    if (!json.items?.length) return emptyNode('GitHub Code Search', 3);
    const data = `GitHub Code Search (${json.total_count || 0} total):\n${json.items.slice(0, 10).map((item: any) => 
      `- ${item.repository?.full_name || 'N/A'}/${item.name}\n  Path: ${item.path}\n  URL: ${item.html_url}`
    ).join('\n')}`;
    return {
      source: 'GitHub Code Search (Secret Hunting)',
      tier: 3,
      data,
      provenanceHash: await computeProvenanceHash('github-code', data),
      timestamp: new Date().toISOString(),
      confidence: 0.82,
      entities: extractEntitiesFromText(data, 'GitHub Code Search'),
    };
  } catch { return emptyNode('GitHub Code Search', 3); }
}

// ── 11. Public Threat Intel — AlienVault OTX + ThreatFox ────────────────────
async function ingestThreatIntel(query: string): Promise<IntelNode> {
  try {
    const cleaned = query.replace(/investigate|search|find|threat|ioc|indicator/gi, '').trim();
    let data = '';
    
    // ThreatFox (free, no API key)
    try {
      const tfResp = await fetch('https://threatfox-api.abuse.ch/api/v1/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'search_ioc', search_term: cleaned }),
      });
      if (tfResp.ok) {
        const tfJson = await tfResp.json();
        if (tfJson.data?.length) {
          data += `ThreatFox IOC Results:\n${tfJson.data.slice(0, 5).map((ioc: any) => 
            `- [${ioc.ioc_type || 'unknown'}] ${ioc.ioc || 'N/A'} | Threat: ${ioc.threat_type || 'N/A'} | Malware: ${ioc.malware || 'N/A'} | Confidence: ${ioc.confidence_level || 'N/A'}% | Reporter: ${ioc.reporter || 'anonymous'} | First Seen: ${ioc.first_seen || 'N/A'}`
          ).join('\n')}\n\n`;
        }
      }
    } catch { /* ThreatFox failed, continue */ }

    // AlienVault OTX (free API key)
    const otxKey = Deno.env.get('ALIENVAULT_OTX_KEY');
    if (otxKey) {
      try {
        const isIP = /^(\d{1,3}\.){3}\d{1,3}$/.test(cleaned);
        const isDomain = /^[\w.-]+\.\w{2,}$/.test(cleaned) && !isIP;
        let otxUrl = '';
        if (isIP) otxUrl = `https://otx.alienvault.com/api/v1/indicators/IPv4/${cleaned}/general`;
        else if (isDomain) otxUrl = `https://otx.alienvault.com/api/v1/indicators/domain/${cleaned}/general`;
        else otxUrl = `https://otx.alienvault.com/api/v1/search/pulses?q=${encodeURIComponent(cleaned)}&page=1&limit=5`;
        
        const otxResp = await fetch(otxUrl, {
          headers: { 'X-OTX-API-KEY': otxKey, 'Accept': 'application/json' },
        });
        if (otxResp.ok) {
          const otxJson = await otxResp.json();
          if (isIP || isDomain) {
            const pulseCount = otxJson.pulse_info?.count || 0;
            const pulses = otxJson.pulse_info?.pulses?.slice(0, 5) || [];
            data += `AlienVault OTX Report (${cleaned}):\n- Pulse Count: ${pulseCount}\n- Reputation: ${otxJson.reputation || 0}\n- Country: ${otxJson.country_name || 'N/A'}\n${pulses.length ? `Threat Pulses:\n${pulses.map((p: any) => `  - ${p.name} (${p.created || 'N/A'}) — Tags: ${p.tags?.join(', ') || 'none'}`).join('\n')}` : ''}`;
          } else {
            const results = otxJson.results?.slice(0, 5) || [];
            if (results.length) data += `AlienVault OTX Pulses:\n${results.map((p: any) => `- ${p.name} | Created: ${p.created || 'N/A'} | IOCs: ${p.indicator_count || 0} | Tags: ${p.tags?.join(', ') || 'none'}`).join('\n')}`;
          }
        }
      } catch { /* OTX failed, continue */ }
    }

    if (!data) return emptyNode('Threat Intelligence', 2);
    return {
      source: 'Public Threat Intelligence (ThreatFox + OTX)',
      tier: 2,
      data,
      provenanceHash: await computeProvenanceHash('threatintel', data),
      timestamp: new Date().toISOString(),
      confidence: 0.87,
      entities: extractEntitiesFromText(data, 'Threat Intel'),
    };
  } catch { return emptyNode('Threat Intelligence', 2); }
}

// ══════════════════════════════════════════════════════════════════════════════
// EXTENDED OSINT ENGINES — 9 Additional Intelligence Sources
// ══════════════════════════════════════════════════════════════════════════════

// ── 13. Bing Web Search ─────────────────────────────────────────────────────
async function ingestBing(query: string, operators?: string): Promise<IntelNode> {
  try {
    const apiKey = Deno.env.get('BING_SEARCH_API_KEY');
    if (!apiKey) return emptyNode('Bing', 2);
    const q = operators ? `${query} ${operators}` : query;
    const resp = await fetch(`https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(q)}&count=10&mkt=en-US`, {
      headers: { 'Ocp-Apim-Subscription-Key': apiKey },
    });
    if (!resp.ok) return emptyNode('Bing', 2);
    const json = await resp.json();
    if (!json.webPages?.value?.length) return emptyNode('Bing', 2);
    const data = `Bing Search Results:\n${json.webPages.value.map((r: any) => `- ${r.name}\n  ${r.url}\n  ${r.snippet || ''}`).join('\n')}`;
    return {
      source: 'Bing Web Search (Advanced Operators)',
      tier: 2,
      data,
      provenanceHash: await computeProvenanceHash('bing', data),
      timestamp: new Date().toISOString(),
      confidence: 0.8,
      entities: extractEntitiesFromText(data, 'Bing'),
    };
  } catch { return emptyNode('Bing', 2); }
}

// ── 14. Social Platform Search (Facebook, Instagram, TikTok via DDG) ────────
async function ingestSocialPlatformSearch(query: string, platform: string): Promise<IntelNode> {
  try {
    const cleaned = query.replace(/investigate|person|research|find|who is|look up|about/gi, '').trim();
    const siteMap: Record<string, string> = {
      facebook: 'site:facebook.com',
      instagram: 'site:instagram.com',
      tiktok: 'site:tiktok.com',
      linkedin: 'site:linkedin.com',
      x: 'site:x.com OR site:twitter.com',
    };
    const siteFilter = siteMap[platform] || `site:${platform}.com`;
    const resp = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleaned + ' ' + siteFilter)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'text/html' },
    });
    if (!resp.ok) return emptyNode(`${platform} Search`, 4);
    const html = await resp.text();
    const results: string[] = [];
    const blocks = html.split(/class="result\s/);
    for (let i = 1; i < blocks.length && results.length < 5; i++) {
      const titleMatch = blocks[i].match(/class="result__a"[^>]*>([\s\S]*?)<\/a>/);
      const snippetMatch = blocks[i].match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : '';
      const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]*>/g, '').trim() : '';
      if (title) results.push(`- ${title}: ${snippet}`);
    }
    if (!results.length) return emptyNode(`${platform} Search`, 4);
    const data = `${platform.charAt(0).toUpperCase() + platform.slice(1)} Search Results:\n${results.join('\n')}`;
    return {
      source: `${platform.charAt(0).toUpperCase() + platform.slice(1)} (via web search)`,
      tier: 4,
      data,
      provenanceHash: await computeProvenanceHash(`social-${platform}`, data),
      timestamp: new Date().toISOString(),
      confidence: 0.55,
      entities: extractEntitiesFromText(data, `${platform} Search`),
    };
  } catch { return emptyNode(`${platform} Search`, 4); }
}

// ── 15. Yandex Search (Reverse Image + Web) ─────────────────────────────────
async function ingestYandex(query: string): Promise<IntelNode> {
  try {
    const apiKey = Deno.env.get('YANDEX_SEARCH_API_KEY');
    const folderId = Deno.env.get('YANDEX_FOLDER_ID');
    if (!apiKey || !folderId) {
      // Fallback: DDG with Yandex-indexed content hints
      const resp = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query + ' site:yandex.com OR site:yandex.ru')}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'text/html' },
      });
      if (!resp.ok) return emptyNode('Yandex', 3);
      const html = await resp.text();
      const results: string[] = [];
      const blocks = html.split(/class="result\s/);
      for (let i = 1; i < blocks.length && results.length < 5; i++) {
        const titleMatch = blocks[i].match(/class="result__a"[^>]*>([\s\S]*?)<\/a>/);
        const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : '';
        if (title) results.push(`- ${title}`);
      }
      if (!results.length) return emptyNode('Yandex', 3);
      const data = `Yandex-Indexed Results:\n${results.join('\n')}`;
      return {
        source: 'Yandex (via web search fallback)',
        tier: 3,
        data,
        provenanceHash: await computeProvenanceHash('yandex-fallback', data),
        timestamp: new Date().toISOString(),
        confidence: 0.6,
        entities: extractEntitiesFromText(data, 'Yandex'),
      };
    }
    const resp = await fetch(`https://yandex.com/search/xml?user=${folderId}&key=${apiKey}&query=${encodeURIComponent(query)}&l10n=en&sortby=rlv&filter=none&groupby=attr%3D%22%22.mode%3Dflat.groups-on-page%3D10`);
    if (!resp.ok) return emptyNode('Yandex', 3);
    const xml = await resp.text();
    const results: string[] = [];
    const urlMatches = xml.matchAll(/<url>([\s\S]*?)<\/url>/g);
    const titleMatches = xml.matchAll(/<title>([\s\S]*?)<\/title>/g);
    const urls = [...urlMatches].map(m => m[1].replace(/<[^>]*>/g, '').trim());
    const titles = [...titleMatches].map(m => m[1].replace(/<[^>]*>/g, '').trim());
    for (let i = 0; i < Math.min(urls.length, 10); i++) {
      results.push(`- ${titles[i] || 'N/A'}: ${urls[i]}`);
    }
    if (!results.length) return emptyNode('Yandex', 3);
    const data = `Yandex Search Results:\n${results.join('\n')}`;
    return {
      source: 'Yandex Search (Russian + Eastern European coverage)',
      tier: 3,
      data,
      provenanceHash: await computeProvenanceHash('yandex', data),
      timestamp: new Date().toISOString(),
      confidence: 0.75,
      entities: extractEntitiesFromText(data, 'Yandex'),
    };
  } catch { return emptyNode('Yandex', 3); }
}

// ── 16. Startpage (Privacy-focused, alternate Google indexing) ───────────────
async function ingestStartpage(query: string): Promise<IntelNode> {
  try {
    // Startpage has no public API — use DDG as a proxy for alternate indexing
    const resp = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1&no_redirect=1`);
    if (!resp.ok) return emptyNode('Startpage/Alt Index', 3);
    const json = await resp.json();
    const results: string[] = [];
    if (json.AbstractText) results.push(`Abstract: ${json.AbstractText} (${json.AbstractSource})`);
    if (json.RelatedTopics?.length) {
      for (const topic of json.RelatedTopics.slice(0, 8)) {
        if (topic.Text) results.push(`- ${topic.Text}`);
        if (topic.Topics) {
          for (const sub of topic.Topics.slice(0, 3)) {
            if (sub.Text) results.push(`  - ${sub.Text}`);
          }
        }
      }
    }
    if (!results.length) return emptyNode('Startpage/Alt Index', 3);
    const data = `Alternate Index Results:\n${results.join('\n')}`;
    return {
      source: 'Alternate Search Index (DuckDuckGo/Startpage)',
      tier: 3,
      data,
      provenanceHash: await computeProvenanceHash('startpage', data),
      timestamp: new Date().toISOString(),
      confidence: 0.65,
      entities: extractEntitiesFromText(data, 'Alt Index'),
    };
  } catch { return emptyNode('Startpage/Alt Index', 3); }
}

// ── 17. Wayback Machine (Internet Archive CDX API) ──────────────────────────
async function ingestWaybackMachine(query: string): Promise<IntelNode> {
  try {
    const cleaned = query.replace(/investigate|search|find|wayback|archive|deleted|old|cached|history/gi, '').trim();
    // Detect if it's a URL
    const isUrl = /^https?:\/\//.test(cleaned) || /^[\w-]+\.[\w.]+/.test(cleaned);
    const targetUrl = isUrl ? (cleaned.startsWith('http') ? cleaned : `https://${cleaned}`) : '';
    
    if (!targetUrl) {
      // Search for the term across the Wayback Machine
      const resp = await fetch(`https://web.archive.org/cdx/search/cdx?url=*.${encodeURIComponent(cleaned)}*&output=json&limit=10&fl=original,timestamp,statuscode,mimetype`);
      if (!resp.ok) return emptyNode('Wayback Machine', 2);
      const json = await resp.json();
      if (!json.length || json.length <= 1) return emptyNode('Wayback Machine', 2);
      const rows = json.slice(1, 11);
      const data = `Wayback Machine Archived Pages:\n${rows.map((r: string[]) => {
        const ts = r[1];
        const date = `${ts.slice(0,4)}-${ts.slice(4,6)}-${ts.slice(6,8)}`;
        return `- ${r[0]} | Archived: ${date} | Status: ${r[2]} | Type: ${r[3]}`;
      }).join('\n')}`;
      return {
        source: 'Wayback Machine (Internet Archive)',
        tier: 2,
        data,
        provenanceHash: await computeProvenanceHash('wayback', data),
        timestamp: new Date().toISOString(),
        confidence: 0.85,
        entities: extractEntitiesFromText(data, 'Wayback Machine'),
      };
    }
    
    // Get snapshots for a specific URL
    const resp = await fetch(`https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(targetUrl)}&output=json&limit=15&fl=original,timestamp,statuscode,mimetype&collapse=timestamp:6`);
    if (!resp.ok) return emptyNode('Wayback Machine', 2);
    const json = await resp.json();
    if (!json.length || json.length <= 1) return emptyNode('Wayback Machine', 2);
    const rows = json.slice(1);
    const data = `Wayback Machine Snapshots for ${targetUrl}:\nTotal snapshots: ${rows.length}\n${rows.map((r: string[]) => {
      const ts = r[1];
      const date = `${ts.slice(0,4)}-${ts.slice(4,6)}-${ts.slice(6,8)}`;
      return `- ${date} | Status: ${r[2]} | Type: ${r[3]}\n  View: https://web.archive.org/web/${ts}/${r[0]}`;
    }).join('\n')}`;
    return {
      source: 'Wayback Machine (Internet Archive)',
      tier: 2,
      data,
      provenanceHash: await computeProvenanceHash('wayback', data),
      timestamp: new Date().toISOString(),
      confidence: 0.9,
      entities: extractEntitiesFromText(data, 'Wayback Machine'),
    };
  } catch { return emptyNode('Wayback Machine', 2); }
}

// ── 18. Public Records Aggregators (via advanced dork search) ────────────────
async function ingestPublicRecords(query: string): Promise<IntelNode> {
  try {
    const cleaned = query.replace(/investigate|search|find|public records|records|address|relatives/gi, '').trim();
    // Search for public records across aggregator sites
    const searchQuery = `"${cleaned}" site:whitepages.com OR site:spokeo.com OR site:beenverified.com OR site:truepeoplesearch.com OR site:fastpeoplesearch.com OR site:thatsThem.com`;
    const resp = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'text/html' },
    });
    if (!resp.ok) return emptyNode('Public Records', 3);
    const html = await resp.text();
    const results: string[] = [];
    const blocks = html.split(/class="result\s/);
    for (let i = 1; i < blocks.length && results.length < 8; i++) {
      const titleMatch = blocks[i].match(/class="result__a"[^>]*>([\s\S]*?)<\/a>/);
      const snippetMatch = blocks[i].match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : '';
      const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]*>/g, '').trim() : '';
      if (title) results.push(`- ${title}: ${snippet}`);
    }
    if (!results.length) return emptyNode('Public Records', 3);
    const data = `Public Records Search Results:\n${results.join('\n')}`;
    return {
      source: 'Public Records Aggregators (Whitepages, Spokeo, etc.)',
      tier: 3,
      data,
      provenanceHash: await computeProvenanceHash('public-records', data),
      timestamp: new Date().toISOString(),
      confidence: 0.65,
      entities: extractEntitiesFromText(data, 'Public Records'),
    };
  } catch { return emptyNode('Public Records', 3); }
}

// ── 19. OpenCorporates (Business Registry / Company Director Search) ────────
async function ingestOpenCorporates(query: string): Promise<IntelNode> {
  try {
    const cleaned = query.replace(/investigate|search|find|company|corporation|llc|inc|ltd|business|registry|director|officer/gi, '').trim();
    // Company search
    const compResp = await fetch(`https://api.opencorporates.com/v0.4/companies/search?q=${encodeURIComponent(cleaned)}&per_page=5&order=score`);
    let data = '';
    if (compResp.ok) {
      const compJson = await compResp.json();
      const companies = compJson.results?.companies || [];
      if (companies.length) {
        data += `Business Registry — Companies:\n${companies.map((c: any) => {
          const co = c.company || {};
          return `- ${co.name || 'N/A'} (${co.jurisdiction_code || 'N/A'})\n  Status: ${co.current_status || 'N/A'} | Type: ${co.company_type || 'N/A'}\n  Incorporated: ${co.incorporation_date || 'N/A'} | Reg #: ${co.company_number || 'N/A'}\n  Address: ${co.registered_address_in_full || 'N/A'}`;
        }).join('\n')}`;
      }
    }
    // Officer search
    const offResp = await fetch(`https://api.opencorporates.com/v0.4/officers/search?q=${encodeURIComponent(cleaned)}&per_page=5&order=score`);
    if (offResp.ok) {
      const offJson = await offResp.json();
      const officers = offJson.results?.officers || [];
      if (officers.length) {
        data += `\n\nBusiness Registry — Officers/Directors:\n${officers.map((o: any) => {
          const off = o.officer || {};
          return `- ${off.name || 'N/A'} — ${off.position || 'N/A'}\n  Company: ${off.company?.name || 'N/A'} (${off.company?.jurisdiction_code || 'N/A'})\n  Start: ${off.start_date || 'N/A'} | End: ${off.end_date || 'Active'}`;
        }).join('\n')}`;
      }
    }
    if (!data) return emptyNode('OpenCorporates', 2);
    return {
      source: 'OpenCorporates (Global Business Registry)',
      tier: 2,
      data,
      provenanceHash: await computeProvenanceHash('opencorporates', data),
      timestamp: new Date().toISOString(),
      confidence: 0.88,
      entities: extractEntitiesFromText(data, 'OpenCorporates'),
    };
  } catch { return emptyNode('OpenCorporates', 2); }
}

// ── 20. Court/Filing Portals (PACER + State Courts via DDG) ─────────────────
async function ingestCourtFilings(query: string): Promise<IntelNode> {
  try {
    const cleaned = query.replace(/investigate|search|find|court|lawsuit|filing|judgment|case/gi, '').trim();
    const searchQuery = `"${cleaned}" site:courtlistener.com OR site:unicourt.com OR site:dockets.justia.com OR site:law.justia.com OR site:scholar.google.com/scholar_case`;
    const resp = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'text/html' },
    });
    if (!resp.ok) return emptyNode('Court Filings', 1);
    const html = await resp.text();
    const results: string[] = [];
    const blocks = html.split(/class="result\s/);
    for (let i = 1; i < blocks.length && results.length < 8; i++) {
      const titleMatch = blocks[i].match(/class="result__a"[^>]*>([\s\S]*?)<\/a>/);
      const snippetMatch = blocks[i].match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : '';
      const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]*>/g, '').trim() : '';
      if (title) results.push(`- ${title}: ${snippet}`);
    }
    if (!results.length) return emptyNode('Court Filings', 1);
    const data = `Court/Filing Portal Results:\n${results.join('\n')}`;
    return {
      source: 'Court & Filing Portals (PACER, Justia, UniCourt)',
      tier: 1,
      data,
      provenanceHash: await computeProvenanceHash('court-filings', data),
      timestamp: new Date().toISOString(),
      confidence: 0.85,
      entities: extractEntitiesFromText(data, 'Court Filings'),
    };
  } catch { return emptyNode('Court Filings', 1); }
}

// ── 21. Google Maps / Places Intelligence ───────────────────────────────────
async function ingestMappingTools(query: string): Promise<IntelNode> {
  try {
    const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY') || Deno.env.get('GOOGLE_CSE_API_KEY');
    if (!apiKey) {
      // Fallback: DDG search for Google Maps listings
      const cleaned = query.replace(/investigate|search|find|map|location|address|business/gi, '').trim();
      const resp = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleaned + ' site:google.com/maps OR site:yelp.com OR site:bbb.org')}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'text/html' },
      });
      if (!resp.ok) return emptyNode('Mapping Tools', 3);
      const html = await resp.text();
      const results: string[] = [];
      const blocks = html.split(/class="result\s/);
      for (let i = 1; i < blocks.length && results.length < 5; i++) {
        const titleMatch = blocks[i].match(/class="result__a"[^>]*>([\s\S]*?)<\/a>/);
        const snippetMatch = blocks[i].match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
        const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : '';
        const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]*>/g, '').trim() : '';
        if (title) results.push(`- ${title}: ${snippet}`);
      }
      if (!results.length) return emptyNode('Mapping Tools', 3);
      const data = `Mapping & Location Intelligence:\n${results.join('\n')}`;
      return {
        source: 'Mapping Tools (Google Maps, Yelp, BBB)',
        tier: 3,
        data,
        provenanceHash: await computeProvenanceHash('mapping', data),
        timestamp: new Date().toISOString(),
        confidence: 0.6,
        entities: extractEntitiesFromText(data, 'Mapping Tools'),
      };
    }
    // Google Places Text Search
    const cleaned = query.replace(/investigate|search|find|map|location/gi, '').trim();
    const resp = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(cleaned)}&key=${apiKey}`);
    if (!resp.ok) return emptyNode('Google Places', 2);
    const json = await resp.json();
    if (!json.results?.length) return emptyNode('Google Places', 2);
    const data = `Google Places / Maps Intelligence:\n${json.results.slice(0, 8).map((p: any) => 
      `- ${p.name} | Rating: ${p.rating || 'N/A'} (${p.user_ratings_total || 0} reviews)\n  Address: ${p.formatted_address || 'N/A'}\n  Type: ${p.types?.slice(0, 3).join(', ') || 'N/A'} | Status: ${p.business_status || 'N/A'}`
    ).join('\n')}`;
    return {
      source: 'Google Places / Maps Intelligence',
      tier: 2,
      data,
      provenanceHash: await computeProvenanceHash('google-places', data),
      timestamp: new Date().toISOString(),
      confidence: 0.82,
      entities: extractEntitiesFromText(data, 'Google Places'),
    };
  } catch { return emptyNode('Mapping Tools', 3); }
}

// ══════════════════════════════════════════════════════════════════════════════
// MONAD-GRADE SECTOR DORK QUERIES (Agency-Level Investigation Vectors)
// Based on: MONAD OSINT Framework — Zophiel Engine Sectors
// ══════════════════════════════════════════════════════════════════════════════

async function ingestSectorDork(sectorName: string, dorkQuery: string, tier: 1 | 2 | 3 | 4): Promise<IntelNode> {
  try {
    const resp = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(dorkQuery)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'text/html' },
    });
    if (!resp.ok) return emptyNode(`Sector: ${sectorName}`, tier);
    const html = await resp.text();
    const results: string[] = [];
    const blocks = html.split(/class="result\s/);
    for (let i = 1; i < blocks.length && results.length < 6; i++) {
      const titleMatch = blocks[i].match(/class="result__a"[^>]*>([\s\S]*?)<\/a>/);
      const snippetMatch = blocks[i].match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
      const urlMatch = blocks[i].match(/class="result__url"[^>]*>([\s\S]*?)<\/a>/);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : '';
      const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]*>/g, '').trim() : '';
      const url = urlMatch ? urlMatch[1].replace(/<[^>]*>/g, '').trim() : '';
      if (title) results.push(`- ${title} [${url}]: ${snippet}`);
    }
    if (!results.length) return emptyNode(`Sector: ${sectorName}`, tier);
    const data = `${sectorName} Intelligence:\n${results.join('\n')}`;
    return {
      source: `MONAD Sector: ${sectorName}`,
      tier,
      data,
      provenanceHash: await computeProvenanceHash(`sector-${sectorName}`, data),
      timestamp: new Date().toISOString(),
      confidence: tier === 1 ? 0.85 : tier === 2 ? 0.75 : 0.6,
      entities: extractEntitiesFromText(data, sectorName),
    };
  } catch { return emptyNode(`Sector: ${sectorName}`, tier); }
}

function generateSectorDorks(targetName: string, location?: string): { sector: string; query: string; tier: 1 | 2 | 3 | 4 }[] {
  const q = `"${targetName}"`;
  const loc = location ? `"${location}"` : '';
  
  return [
    // File Hunter (Echelon Level)
    { sector: 'File Hunter', query: `${q} filetype:pdf OR ${q} filetype:docx OR ${q} filetype:xlsx OR ${q} filetype:pptx`, tier: 2 },
    // Legal & Court Archives
    { sector: 'Legal Archives', query: `${q} site:courtlistener.com OR ${q} site:justia.com OR ${q} site:trellis.law OR ${q} plaintiff OR ${q} defendant OR ${q} docket`, tier: 1 },
    // Property & Asset Tracing
    { sector: 'Asset Tracing', query: `${q} "property tax" OR ${q} "deed" OR ${q} "assessment" OR ${q} "parcel id"`, tier: 1 },
    // Corporate & LLC Hunting
    { sector: 'Corporate Registry', query: `${q} LLC OR ${q} Ltd OR ${q} Inc OR ${q} Director OR ${q} Shareholder OR ${q} "registered agent"`, tier: 1 },
    // Background & Origins
    { sector: 'Background Origins', query: `${q} biography OR ${q} "born in" OR ${q} "early life" OR ${q} "family background"`, tier: 3 },
    // Employment & Professional
    { sector: 'Employment', query: `${q} ${loc} job title employer resume OR ${q} "business owner" OR ${q} founder`, tier: 3 },
    // Criminal & Legal Records
    { sector: 'Criminal Records', query: `${q} arrest mugshot "court record" ${loc} OR ${q} lawsuit OR ${q} "criminal record"`, tier: 1 },
    // Financial Records
    { sector: 'Financial Intelligence', query: `${q} ${loc} bankrupt judgment lien tax OR ${q} "net worth"`, tier: 2 },
    // Data Brokers
    { sector: 'Data Brokers', query: `${q} ${loc} site:fastpeoplesearch.com OR site:truepeoplesearch.com OR site:familytreenow.com OR site:cyberbackgroundchecks.com`, tier: 3 },
    // Community & Reputation
    { sector: 'Reputation', query: `${q} ${loc} volunteer church club member OR ${q} controversy OR ${q} scandal`, tier: 4 },
    // Educational Background
    { sector: 'Education', query: `${q} ${loc} school student graduate alumni university`, tier: 3 },
    // Residential History
    { sector: 'Residential', query: `${q} ${loc} address resident OR ${q} "property records" OR ${q} "current address"`, tier: 2 },
    // Leak & Breach Lookup
    { sector: 'Leak Intelligence', query: `${q} site:pastebin.com OR ${q} site:ghostbin.com OR ${q} "password" filetype:txt`, tier: 4 },
    // Image Context
    { sector: 'Image Context', query: `${q} ${loc} photo OR ${q} mugshot OR ${q} headshot OR ${q} portrait`, tier: 4 },
  ];
}

// ── Depth-3 Recursive PII Spider (Gap 3: Enhanced) ──────────────────────────

async function searchSingleEntity(target: string): Promise<IntelNode> {
  try {
    const resp = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(`"${target}"`)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'text/html' },
    });
    if (!resp.ok) return emptyNode('PII Spider', 2);
    const html = await resp.text();
    const results: string[] = [];
    const blocks = html.split(/class="result\s/);
    for (let i = 1; i < blocks.length && results.length < 3; i++) {
      const titleMatch = blocks[i].match(/class="result__a"[^>]*>([\s\S]*?)<\/a>/);
      const snippetMatch = blocks[i].match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : '';
      const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]*>/g, '').trim() : '';
      if (title) results.push(`- ${title}: ${snippet}`);
    }
    if (!results.length) return emptyNode('PII Spider', 2);
    const data = `PII Spider Trace [${target}]:\n${results.join('\n')}`;
    return {
      source: `Recursive PII Spider (${target})`,
      tier: 2 as const,
      data,
      provenanceHash: await computeProvenanceHash('pii-spider', data),
      timestamp: new Date().toISOString(),
      confidence: 0.88,
      entities: extractEntitiesFromText(data, 'PII Spider'),
    };
  } catch { return emptyNode('PII Spider', 2); }
}

async function recursivePIISpider(entities: ExtractedEntity[], depth = 0, visited = new Set<string>()): Promise<IntelNode[]> {
  if (depth >= 3 || entities.length === 0) return [];
  
  const piiTypes = ['phone', 'email', 'handle'];
  const targets = entities
    .filter(e => piiTypes.includes(e.type))
    .map(e => e.value)
    .filter(v => !visited.has(v.toLowerCase()))
    .slice(0, depth === 0 ? 4 : 2); // More aggressive at depth 0
  
  if (targets.length === 0) return [];
  
  // Mark as visited
  targets.forEach(t => visited.add(t.toLowerCase()));
  
  // Search all targets at this depth in parallel
  const results = await Promise.allSettled(targets.map(t => searchSingleEntity(t)));
  const nodes = results
    .filter((r): r is PromiseFulfilledResult<IntelNode> => r.status === 'fulfilled')
    .map(r => r.value)
    .filter(n => n.data);
  
  // Extract new entities from this depth's results
  const newEntities: ExtractedEntity[] = [];
  for (const node of nodes) {
    newEntities.push(...node.entities.filter(e => 
      piiTypes.includes(e.type) && !visited.has(e.value.toLowerCase())
    ));
  }
  
  // Recurse deeper with newly discovered entities
  const deeperNodes = await recursivePIISpider(newEntities, depth + 1, visited);
  
  return [...nodes, ...deeperNodes];
}

// ── OCEAN Behavioral Profiling Engine (Gap 2: Enhanced) ─────────────────────

function computeOCEANProfile(text: string): OCEANProfile {
  const t = text.toLowerCase();
  const words = t.split(/\s+/);
  const totalWords = words.length || 1;
  
  // Function word ratio (deception indicator)
  const functionWords = ['the', 'a', 'an', 'is', 'was', 'were', 'are', 'been', 'be', 'have', 'has', 'had',
    'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'shall', 'can',
    'of', 'in', 'to', 'for', 'with', 'on', 'at', 'from', 'by', 'about', 'as', 'into',
    'through', 'during', 'before', 'after', 'above', 'below', 'between', 'and', 'but', 'or',
    'not', 'no', 'nor', 'so', 'yet', 'both', 'either', 'neither', 'each', 'every',
    'i', 'me', 'my', 'mine', 'we', 'us', 'our', 'ours', 'you', 'your', 'yours',
    'he', 'him', 'his', 'she', 'her', 'hers', 'it', 'its', 'they', 'them', 'their'];
  const functionWordCount = words.filter(w => functionWords.includes(w)).length;
  const functionWordRatio = functionWordCount / totalWords;
  
  // Burstiness scoring (timestamp-based if available, otherwise content density)
  const dateMatches = text.match(/\b(?:19|20)\d{2}-\d{2}-\d{2}\b/g) || [];
  let burstinessScore = 0;
  if (dateMatches.length >= 3) {
    const timestamps = dateMatches.map(d => new Date(d).getTime()).filter(t => !isNaN(t)).sort();
    if (timestamps.length >= 3) {
      const intervals = timestamps.slice(1).map((t, i) => t - timestamps[i]);
      const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const variance = intervals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / intervals.length;
      burstinessScore = Math.min(1, Math.sqrt(variance) / (mean || 1));
    }
  }
  
  // OCEAN scoring from content patterns
  const openness = (
    (/creative|innovat|experiment|novel|curious|explor|diverse|abstract|artistic|imaginat/i.test(t) ? 0.3 : 0) +
    (/beta|early adopter|new platform|switching|trying out/i.test(t) ? 0.2 : 0) +
    (/travel|abroad|international|global|multicultural/i.test(t) ? 0.2 : 0) +
    (/philosophy|theory|concept|paradigm|framework/i.test(t) ? 0.3 : 0)
  );
  
  const conscientiousness = (
    (/deadline|schedule|organized|systematic|plan|budget|quarterly|annual report/i.test(t) ? 0.3 : 0) +
    (/compliance|regulation|standard|certified|audit|quality/i.test(t) ? 0.3 : 0) +
    (/milestone|achievement|award|recognition|accomplished/i.test(t) ? 0.2 : 0) +
    (/warranty|guarantee|insurance|protection|secure/i.test(t) ? 0.2 : 0)
  );
  
  const extraversion = (
    (/conference|speaking|keynote|panel|networking|event|social|party/i.test(t) ? 0.3 : 0) +
    (/followers|subscribers|audience|community|fans|supporters/i.test(t) ? 0.3 : 0) +
    (/interview|podcast|media|press|coverage|spotlight/i.test(t) ? 0.2 : 0) +
    (/team|collaborate|partnership|alliance|coalition/i.test(t) ? 0.2 : 0)
  );
  
  const agreeableness = (
    (/volunteer|charity|donate|nonprofit|mentor|support|help/i.test(t) ? 0.3 : 0) +
    (/thank|grateful|appreciate|kind|generous|empathy/i.test(t) ? 0.3 : 0) -
    (/lawsuit|attack|criticize|condemn|oppose|fight|destroy/i.test(t) ? 0.3 : 0) -
    (/confrontat|aggressive|hostile|combative|adversarial/i.test(t) ? 0.3 : 0)
  );
  
  const neuroticism = (
    (/stress|anxiety|worry|fear|concern|risk|threat|danger|crisis/i.test(t) ? 0.3 : 0) +
    (/security|protection|defense|shield|guard|safe/i.test(t) ? 0.2 : 0) +
    (/cancel|delete|remove|scrub|privacy|anonymous/i.test(t) ? 0.2 : 0) +
    (/warranty|insurance|backup|contingency|emergency/i.test(t) ? 0.2 : 0)
  );
  
  // Deception indicators
  const deceptionIndicators: string[] = [];
  if (functionWordRatio < 0.25) deceptionIndicators.push('Low function word ratio (possible deception)');
  if (functionWordRatio > 0.55) deceptionIndicators.push('High function word ratio (possible scripted content)');
  const firstPersonCount = (t.match(/\b(i|me|my|mine|myself)\b/g) || []).length;
  const firstPersonRatio = firstPersonCount / totalWords;
  if (firstPersonRatio < 0.01 && totalWords > 200) deceptionIndicators.push('Abnormally low self-reference (distancing language)');
  if (/never|always|absolutely|certainly|definitely|impossible/i.test(t)) deceptionIndicators.push('Absolute language detected (certainty signals)');
  
  // Predicted actions based on OCEAN
  const predictedActions: string[] = [];
  if (openness > 0.5) predictedActions.push('Likely to adopt new platforms/technologies early');
  if (conscientiousness > 0.5) predictedActions.push('Will maintain structured public records, filings on time');
  if (extraversion > 0.5) predictedActions.push('Expect public appearances, media engagement');
  if (agreeableness < 0) predictedActions.push('May engage in confrontational responses if contacted');
  if (neuroticism > 0.5) predictedActions.push('Likely to scrub/protect digital footprint proactively');
  if (burstinessScore > 0.7) predictedActions.push('Activity pattern suggests stress events or life changes');
  
  // Posting time heatmap (from timestamps found)
  const postingHeatmap: Record<string, number> = {};
  const timeMatches = text.match(/\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?\b/g) || [];
  for (const time of timeMatches) {
    const hourMatch = time.match(/(\d{1,2}):/);
    if (hourMatch) {
      let hour = parseInt(hourMatch[1]);
      if (/pm/i.test(time) && hour < 12) hour += 12;
      if (/am/i.test(time) && hour === 12) hour = 0;
      const slot = `${String(hour).padStart(2, '0')}:00`;
      postingHeatmap[slot] = (postingHeatmap[slot] || 0) + 1;
    }
  }
  
  return {
    openness: Math.max(0, Math.min(1, openness)),
    conscientiousness: Math.max(0, Math.min(1, conscientiousness)),
    extraversion: Math.max(0, Math.min(1, extraversion)),
    agreeableness: Math.max(-1, Math.min(1, agreeableness)),
    neuroticism: Math.max(0, Math.min(1, neuroticism)),
    deceptionIndicators,
    predictedActions,
    postingHeatmap,
    functionWordRatio: Math.round(functionWordRatio * 1000) / 1000,
    burstinessScore: Math.round(burstinessScore * 100) / 100,
  };
}

function extractBehavioralProfile(text: string): string[] {
  const traits: string[] = [];
  const t = text.toLowerCase();
  
  if (/passionate|dedicated|advocate|volunteer|nonprofit|charity|donate/i.test(t)) traits.push('Community Oriented');
  if (/entrepreneur|founder|ceo|owner|startup|investor|venture/i.test(t)) traits.push('Business/Leadership');
  if (/arrest|charged|court|lawsuit|defendant|plaintiff|indicted|convicted/i.test(t)) traits.push('Legal History');
  if (/academic|university|research|published|professor|phd|doctoral/i.test(t)) traits.push('Academic/Intellectual');
  if (/military|veteran|served|deployment|armed forces|navy|army|air force/i.test(t)) traits.push('Military/Government');
  if (/patent|inventor|innovation|technology|engineering/i.test(t)) traits.push('Technical/Innovation');
  if (/real estate|property|landlord|developer|construction|broker/i.test(t)) traits.push('Real Estate/Property');
  if (/offshore|cayman|swiss|panama|shell company|nominee|trust/i.test(t)) traits.push('⚠️ Offshore/Opacity Signals');
  if (/fraud|scam|ponzi|embezzle|launder|rico|conspiracy/i.test(t)) traits.push('🔴 Fraud/Criminal Indicators');
  if (/political|campaign|lobby|pac|donor|committee|governor|senator/i.test(t)) traits.push('Political Activity');
  if (/athlete|sports|team|championship|draft|contract/i.test(t)) traits.push('Sports/Athletics');
  if (/doctor|medical|hospital|clinic|patient|surgery|health/i.test(t)) traits.push('Medical/Healthcare');
  
  return [...new Set(traits)];
}

// ── Public Record Link Generator (MONAD: passive OSINT reference URLs) ──────

function generatePublicRecordLinks(name: string, location?: string): string {
  const encoded = name.replace(/\s+/g, '+');
  const parts = name.split(/\s+/);
  const first = parts[0] || '';
  const last = parts[parts.length - 1] || '';
  
  const links: string[] = [
    `— CORPORATE: OpenCorporates: https://opencorporates.com/companies?q=${encoded}`,
    `— CORPORATE: CorporationWiki: https://www.corporationwiki.com/search/results?term=${encoded}`,
    `— CORPORATE: Bizapedia: https://www.bizapedia.com/search.aspx?q=${encoded}`,
    `— LEGAL: CourtListener: https://www.courtlistener.com/?q=${encoded}`,
    `— LEGAL: Justia: https://www.justia.com/search?q=${encoded}`,
    `— GENEALOGY: FamilySearch: https://www.familysearch.org/search/record/results?q.givenName=${first}&q.surname=${last}`,
    `— PEOPLE: Spokeo: https://www.spokeo.com/${name.replace(/\s+/g, '-')}`,
    `— PEOPLE: BeenVerified: https://www.beenverified.com/people/${name.replace(/\s+/g, '-')}`,
    `— PEOPLE: Whitepages: https://www.whitepages.com/name/${name.replace(/\s+/g, '-')}`,
    `— PROFESSIONAL: ZoomInfo: https://www.zoominfo.com/people/${name.replace(/\s+/g, '-')}`,
    `— PROFESSIONAL: Crunchbase: https://www.crunchbase.com/textsearch?q=${encoded}`,
    `— ACADEMIC: Google Scholar: https://scholar.google.com/scholar?q=${encoded}`,
    `— ACADEMIC: ORCID: https://orcid.org/orcid-search/search?searchQuery=${encoded}`,
    `— LEAKS: DeHashed: https://dehashed.com/search?query=${encoded}`,
    `— LEAKS: Intelligence X: https://intelx.io/?s=${encoded}`,
    `— IMAGES: Yandex Images: https://yandex.com/images/search?text=${encoded}`,
    `— ARCHIVE: Wayback Machine: https://web.archive.org/web/*/${encoded}`,
    `— PROPERTY: PropertyShark: https://www.propertyshark.com/mason/search?q=${encoded}`,
  ];
  
  if (location) {
    const loc = location.toLowerCase();
    if (loc.includes('florida') || loc.includes('fl')) {
      links.push(`— STATE: Florida Sunbiz (Corp Registry): https://search.sunbiz.org/Inquiry/CorporationSearch/ByName`);
      links.push(`— STATE: Florida DBPR (Licenses): https://www.myfloridalicense.com/`);
    }
    if (loc.includes('california') || loc.includes('ca')) {
      links.push(`— STATE: CA Secretary of State: https://bizfileonline.sos.ca.gov/search/business`);
    }
    if (loc.includes('new york') || loc.includes('ny')) {
      links.push(`— STATE: NY DOS Corp Search: https://apps.dos.ny.gov/publicInquiry/`);
    }
    if (loc.includes('texas') || loc.includes('tx')) {
      links.push(`— STATE: TX SOS: https://www.sos.state.tx.us/corp/sosda/index.shtml`);
    }
  }
  
  return `\n\nPASSIVE OSINT REFERENCE LINKS (${links.length} sources):\n${links.join('\n')}`;
}

// ══════════════════════════════════════════════════════════════════════════════
// ESRC STAGE 3: REASON — Entity Resolution + Two-Stage Selection & Verification
// "Select from shortlist, then verify with advanced reasoning"
// ══════════════════════════════════════════════════════════════════════════════

function resolveEntities(nodes: IntelNode[]): { resolved: ExtractedEntity[]; crossRefMap: Record<string, string[]> } {
  const allEntities: ExtractedEntity[] = [];
  const crossRefMap: Record<string, string[]> = {};

  for (const node of nodes) {
    if (!node.data) continue;
    allEntities.push(...node.entities);
  }

  const byType: Record<string, ExtractedEntity[]> = {};
  for (const e of allEntities) {
    if (!byType[e.type]) byType[e.type] = [];
    byType[e.type].push(e);
  }

  for (const [type, entities] of Object.entries(byType)) {
    for (const entity of entities) {
      const key = `${type}:${entity.value.toLowerCase().trim()}`;
      if (!crossRefMap[key]) crossRefMap[key] = [];
      if (!crossRefMap[key].includes(entity.source)) {
        crossRefMap[key].push(entity.source);
      }
    }
  }

  const seen = new Set<string>();
  const resolved: ExtractedEntity[] = [];
  for (const e of allEntities) {
    const key = `${e.type}:${e.value.toLowerCase().trim()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const sourceCount = crossRefMap[key]?.length || 1;
    resolved.push({
      ...e,
      confidence: Math.min(1, e.confidence + (sourceCount - 1) * 0.05),
    });
  }

  return { resolved, crossRefMap };
}

// ── ESRC: Candidate Scoring via Weighted Jaccard + Embedding Proxy ──────────

function scoreCandidate(profile: ESRCProfile, node: IntelNode, entities: ExtractedEntity[]): ESRCCandidate {
  const matchEvidence: string[] = [];
  const contradictions: string[] = [];
  let score = 0;
  const nodeText = node.data.toLowerCase();

  // Match demographics
  for (const d of profile.demographics) {
    if (nodeText.includes(d.toLowerCase().replace(/^age:\s*/i, ''))) {
      matchEvidence.push(`Demographics match: ${d}`);
      score += 0.15;
    }
  }

  // Match career
  for (const c of profile.career) {
    if (nodeText.includes(c.toLowerCase())) {
      matchEvidence.push(`Career signal: ${c}`);
      score += 0.2;
    }
  }

  // Match education
  for (const e of profile.education) {
    if (nodeText.includes(e.toLowerCase())) {
      matchEvidence.push(`Education match: ${e}`);
      score += 0.2;
    }
  }

  // Match locations
  for (const l of profile.locations) {
    const locClean = l.replace(/^(?:lives? in|based in|from|located in|moving to)\s*/i, '').toLowerCase();
    if (nodeText.includes(locClean)) {
      matchEvidence.push(`Location match: ${l}`);
      score += 0.15;
    }
  }

  // Match organizations
  for (const o of profile.organizations) {
    if (nodeText.includes(o.toLowerCase())) {
      matchEvidence.push(`Organization match: ${o}`);
      score += 0.2;
    }
  }

  // Match interests / tech stack (rarity-weighted: rare matches count more)
  for (const i of profile.interests) {
    if (nodeText.includes(i.toLowerCase())) {
      matchEvidence.push(`Interest/Tech match: ${i}`);
      score += 0.1;
    }
  }

  // Match digital footprint (handles, URLs)
  for (const df of profile.digitalFootprint) {
    if (nodeText.includes(df.toLowerCase())) {
      matchEvidence.push(`Digital footprint match: ${df}`);
      score += 0.25;
    }
  }

  // Cross-reference entity matches (boosted by multi-source corroboration)
  const nodeEntities = node.entities;
  for (const ne of nodeEntities) {
    const matching = entities.find(e => e.type === ne.type && e.value.toLowerCase() === ne.value.toLowerCase());
    if (matching) {
      matchEvidence.push(`Entity cross-ref: [${ne.type}] ${ne.value} (confidence: ${Math.round(matching.confidence * 100)}%)`);
      score += 0.1 * matching.confidence;
    }
  }

  // Tier weighting (government sources carry more weight)
  const tierMultiplier = { 1: 1.5, 2: 1.2, 3: 1.0, 4: 0.7 };
  score *= tierMultiplier[node.tier];

  return {
    source: node.source,
    profile: {
      career: matchEvidence.filter(e => e.includes('Career')).map(e => e.split(': ')[1]),
      locations: matchEvidence.filter(e => e.includes('Location')).map(e => e.split(': ')[1]),
      organizations: matchEvidence.filter(e => e.includes('Organization')).map(e => e.split(': ')[1]),
    },
    similarityScore: Math.min(1, score),
    matchEvidence,
    contradictions,
  };
}

// ── ESRC: Bradley-Terry Tournament Calibration ──────────────────────────────

function calibrateConfidence(candidates: ESRCCandidate[], totalSources: number): ESRCCalibration {
  if (candidates.length === 0) {
    return {
      bradleyTerryRating: 0,
      precisionEstimate: 0,
      recallBand: 'NONE',
      abstainRecommendation: true,
      calibrationMethod: 'confidence_score',
    };
  }

  // Sort by similarity score
  const sorted = [...candidates].sort((a, b) => b.similarityScore - a.similarityScore);
  const topScore = sorted[0]?.similarityScore || 0;
  const secondScore = sorted[1]?.similarityScore || 0;

  // Gap-based confidence (from paper: "large gap indicates top candidate stands out clearly")
  const gap = topScore - secondScore;
  const gapConfidence = Math.min(1, gap * 3);

  // Evidence density (more matched attributes = higher confidence)
  const evidenceCount = sorted[0]?.matchEvidence.length || 0;
  const evidenceConfidence = Math.min(1, evidenceCount / 10);

  // Bradley-Terry rating simulation (simplified — pairwise comparison proxy)
  // In the paper: Swiss-system tournament with N rounds
  let btRating = 1000; // Starting Elo-like rating
  for (let i = 1; i < sorted.length && i < 15; i++) {
    const win = sorted[0].similarityScore > sorted[i].similarityScore;
    const expectedWin = 1 / (1 + Math.pow(10, (sorted[i].similarityScore * 1000 - topScore * 1000) / 400));
    btRating += 32 * ((win ? 1 : 0) - expectedWin);
  }

  // Composite precision estimate
  const precisionEstimate = Math.round(
    (gapConfidence * 0.35 + evidenceConfidence * 0.35 + (topScore > 0.5 ? 0.3 : topScore * 0.6) * 0.3) * 100
  );

  // Recall band estimation (from paper's precision-recall curves)
  let recallBand: string;
  if (precisionEstimate >= 90) recallBand = 'HIGH (est. 55-68% recall @90% precision)';
  else if (precisionEstimate >= 70) recallBand = 'MODERATE (est. 26-55% recall)';
  else if (precisionEstimate >= 50) recallBand = 'LOW (est. 5-26% recall)';
  else recallBand = 'MINIMAL (est. <5% recall)';

  // Abstain recommendation (from paper: "attacker should abstain if confidence is below threshold")
  const abstainRecommendation = precisionEstimate < 50 || evidenceCount < 2;

  return {
    bradleyTerryRating: Math.round(btRating),
    precisionEstimate,
    recallBand,
    abstainRecommendation,
    calibrationMethod: candidates.length > 5 ? 'tournament_sort' : 'confidence_score',
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// ESRC STAGE 4: CALIBRATE — Provenance Attestation
// ══════════════════════════════════════════════════════════════════════════════

function attestProvenance(nodes: IntelNode[]): ProvenanceAttestation {
  const activeNodes = nodes.filter(n => n.data);
  const tier1 = activeNodes.filter(n => n.tier === 1).length;
  const tier2 = activeNodes.filter(n => n.tier === 2).length;

  const allText = activeNodes.map(n => n.data).join(' ');
  const phrases = allText.match(/\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)+\b/g) || [];
  const phraseCount: Record<string, number> = {};
  for (const p of phrases) { phraseCount[p] = (phraseCount[p] || 0) + 1; }
  const crossRefPhrases = Object.values(phraseCount).filter(c => c > 1).length;
  const crossRefScore = Math.min(100, Math.round((crossRefPhrases / Math.max(1, Object.keys(phraseCount).length)) * 100));

  const hashCount = activeNodes.filter(n => n.provenanceHash).length;
  const provenanceIntegrity = Math.round((hashCount / Math.max(1, activeNodes.length)) * 100);

  const hostileSourceFlags = detectHostileSources(allText);

  return {
    sourceCount: activeNodes.length,
    tier1Count: tier1,
    tier2Count: tier2,
    crossRefScore,
    provenanceIntegrity,
    hostileSourceFlags,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// TRANS-DIMENSIONAL DATA INGESTION ORCHESTRATOR (ESRC-Enhanced)
// ══════════════════════════════════════════════════════════════════════════════

async function ingestIntelligence(query: string): Promise<{
  nodes: IntelNode[];
  attestation: ProvenanceAttestation;
  entities: ExtractedEntity[];
  crossRefMap: Record<string, string[]>;
  esrcProfile: ESRCProfile;
  esrcCandidates: ESRCCandidate[];
  esrcCalibration: ESRCCalibration;
}> {
  const q = query.toLowerCase();
  const tasks: Promise<IntelNode>[] = [];

  // ── ALWAYS: Core web search (Google + Bing + DDG + Startpage + SearXNG + Mojeek + MetaGer + Gigablast) ──
  tasks.push(ingestDDG(query));
  tasks.push(ingestDDGInstant(query));
  tasks.push(ingestGoogleCSE(query));
  tasks.push(ingestBing(query));
  tasks.push(ingestStartpage(query));
  tasks.push(ingestSearXNG(query));
  tasks.push(ingestMojeek(query));
  tasks.push(ingestMetaGer(query));
  tasks.push(ingestGigablast(query));

  // ── OSINT: IP Address detected ──
  const ipMatch = query.match(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/);
  if (ipMatch) {
    tasks.push(ingestShodan(ipMatch[1]));
    tasks.push(ingestCensys(ipMatch[1]));
    tasks.push(ingestGreyNoise(ipMatch[1]));
    tasks.push(ingestBinaryEdge(ipMatch[1]));
    tasks.push(ingestVirusTotal(ipMatch[1]));
    tasks.push(ingestThreatIntel(ipMatch[1]));
  }

  // ── OSINT: Domain detected ──
  const domainMatch = query.match(/\b([\w-]+\.(?:com|org|net|io|dev|co|info|biz|gov|edu|mil|int|xyz|me|app|cloud|tech|ai|cyber|security)(?:\.\w{2,3})?)\b/i);
  if (domainMatch) {
    tasks.push(ingestCrtSh(domainMatch[1]));
    tasks.push(ingestWHOIS(domainMatch[1]));
    tasks.push(ingestSecurityTrails(domainMatch[1]));
    tasks.push(ingestVirusTotal(domainMatch[1]));
    tasks.push(ingestUrlscan(domainMatch[1]));
    tasks.push(ingestShodan(`hostname:${domainMatch[1]}`));
    tasks.push(ingestThreatIntel(domainMatch[1]));
    tasks.push(ingestWaybackMachine(domainMatch[1]));
  }

  // ── OSINT: Hash/IOC detected ──
  const hashMatch = query.match(/\b([a-fA-F0-9]{32,64})\b/);
  if (hashMatch) {
    tasks.push(ingestVirusTotal(hashMatch[1]));
    tasks.push(ingestThreatIntel(hashMatch[1]));
  }

  // ── OSINT: URL detected ──
  if (/https?:\/\//.test(query)) {
    const urlMatch = query.match(/(https?:\/\/[^\s]+)/);
    if (urlMatch) {
      tasks.push(ingestUrlscan(urlMatch[1]));
      tasks.push(ingestVirusTotal(urlMatch[1]));
      tasks.push(ingestWaybackMachine(urlMatch[1]));
    }
  }

  // ── OSINT: Infrastructure / exposure scanning keywords ──
  if (/shodan|port|banner|service|iot|ics|exposed|open port|scan|attack surface|exposure|asset/i.test(q)) {
    tasks.push(ingestShodan(query));
    tasks.push(ingestCensys(query));
    tasks.push(ingestBinaryEdge(query));
    tasks.push(ingestFOFA(query));
  }

  // ── OSINT: DNS / subdomain / cert keywords ──
  if (/dns|subdomain|certificate|ssl|tls|cert|nameserver|mx|whois|registr/i.test(q)) {
    if (domainMatch) {
      tasks.push(ingestSecurityTrails(domainMatch[1]));
    }
  }

  // ── OSINT: Threat intel / malware / IOC keywords ──
  if (/malware|threat|ioc|indicator|compromise|virus|trojan|ransomware|c2|command.and.control|apt|campaign/i.test(q)) {
    tasks.push(ingestVirusTotal(query));
    tasks.push(ingestThreatIntel(query));
    tasks.push(ingestGreyNoise(query));
    tasks.push(ingestUrlscan(query));
  }

  // ── OSINT: Noise / scanning classification ──
  if (/noise|background|targeted|opportunistic|greynoise|scanning/i.test(q)) {
    tasks.push(ingestGreyNoise(query));
  }

  // ── OSINT: Secret hunting / code exposure ──
  if (/secret|api.key|password|credential|leaked|exposed|config|\.env|token/i.test(q)) {
    tasks.push(ingestGitHubCodeSearch(query));
    tasks.push(ingestGoogleCSE(query, 'filetype:env OR filetype:json OR filetype:yaml'));
  }

  // ── ESRC: Person / identity resolution ──
  const isPerson = /person|individual|who is|about|officer|director|ceo|cto|founder|deanonymize|identify|profile/i.test(q);
  const isUsername = /username|user|handle|account|profile|pseudonym|anonymous|alias/i.test(q);

  if (isPerson || isUsername) {
    tasks.push(ingestLinkedInProxy(query));
    tasks.push(ingestTwitterProxy(query));
    tasks.push(ingestAcademicSearch(query));
    tasks.push(ingestFEC(query));
    tasks.push(ingestGitHubSearch(query));
    tasks.push(ingestCourtListener(query));
    tasks.push(ingestReddit(query));
    // Extended: Social platforms + public records
    tasks.push(ingestSocialPlatformSearch(query, 'facebook'));
    tasks.push(ingestSocialPlatformSearch(query, 'instagram'));
    tasks.push(ingestSocialPlatformSearch(query, 'tiktok'));
    tasks.push(ingestPublicRecords(query));
    tasks.push(ingestYandex(query));
    tasks.push(ingestOpenCorporates(query));
    tasks.push(ingestMappingTools(query));
    
    // ── MONAD: Sector-Based Dork Queries (Agency-Level Deep Dive) ──
    const cleaned = query.replace(/investigate|person|research|find|who is|look up|about|company|search/gi, '').trim();
    const locationMatch = query.match(/(?:in|from|at|near)\s+([A-Z][A-Za-z\s,]+)/);
    const detectedLocation = locationMatch ? locationMatch[1].trim() : undefined;
    const sectors = generateSectorDorks(cleaned, detectedLocation);
    // Run top 8 most critical sectors in parallel (legal, corporate, financial, asset)
    const prioritySectors = sectors.filter(s => s.tier <= 2).slice(0, 6);
    const secondarySectors = sectors.filter(s => s.tier > 2).slice(0, 4);
    for (const sector of [...prioritySectors, ...secondarySectors]) {
      tasks.push(ingestSectorDork(sector.sector, sector.query, sector.tier));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // MISSING LAYER 5: 9 ADVANCED PERSON SEARCH QUERY TYPES
    // These go beyond SEO-optimized content to find real intelligence
    // ══════════════════════════════════════════════════════════════════════════
    const personQ = `"${cleaned}"`;
    
    // 1. THE CRITICISM QUERY — unfiltered community reactions
    tasks.push(ingestSectorDork('Criticism Query', `${personQ} site:reddit.com OR site:news.ycombinator.com OR site:glassdoor.com`, 4));
    
    // 2. THE OLD IDENTITY QUERY — pre-reputation-management content
    tasks.push(ingestSectorDork('Old Identity', `${personQ} before:2015`, 3));
    
    // 3. THE LEGAL PAPER TRAIL QUERY — beyond CourtListener
    tasks.push(ingestSectorDork('Legal Paper Trail', `${personQ} "plaintiff" OR "defendant" OR "deposition" OR "settlement" OR "restraining order"`, 1));
    
    // 4. THE CONTRADICTION QUERY — excludes self-authored sources
    tasks.push(ingestSectorDork('Contradiction Query', `${personQ} -site:linkedin.com -site:about.me`, 3));
    
    // 5. THE DELETED CONTENT QUERY — Wayback Machine cached content
    tasks.push(ingestSectorDork('Deleted Content', `site:web.archive.org ${personQ}`, 2));
    
    // 6. THE FAMILY/CIRCLE EXPOSURE QUERY — lowest OPSEC layer
    tasks.push(ingestSectorDork('Family Exposure', `${personQ} "wife" OR "husband" OR "brother" OR "sister" OR "parents" OR "grew up"`, 3));
    
    // 7. THE EMPLOYMENT HISTORY QUERY — third-party descriptions
    tasks.push(ingestSectorDork('Employment History', `${personQ} "formerly" OR "previously" OR "ex-" OR "used to" OR "left"`, 3));
    
    // 8. THE FINANCIAL DISTRESS QUERY — state court & credit records
    tasks.push(ingestSectorDork('Financial Distress', `${personQ} "judgment" OR "garnishment" OR "eviction" OR "foreclosure" OR "collections"`, 1));
    
    // 9. THE ASSOCIATE INVESTIGATION QUERY — two-person searches
    // We'll use extracted entities to find known associates for cross-queries later (post-ingestion)
    tasks.push(ingestSectorDork('Associate Search', `${personQ} "partner" OR "co-founder" OR "colleague" OR "associate" OR "advisor"`, 3));
  }

  // Company/corporate
  if (/compan|corp|inc|llc|ltd|business|firm|startup|enterprise|sec |edgar|filing|10-k|proxy/i.test(q)) {
    tasks.push(ingestEdgar(query));
    tasks.push(ingestUSASpending(query));
    tasks.push(ingestProPublica(query));
    tasks.push(ingestOpenCorporates(query));
    tasks.push(ingestCourtFilings(query));
    tasks.push(ingestMappingTools(query));
  }

  // Domain (legacy — kept for backward compat)
  if (/domain|\.com|\.org|\.net|\.io|dns|ssl|cert|subdomain|whois/i.test(q) && !domainMatch) {
    const fallbackDomain = query.match(/[\w-]+\.[\w.]+/);
    if (fallbackDomain) {
      tasks.push(ingestCrtSh(fallbackDomain[0]));
      tasks.push(ingestWHOIS(fallbackDomain[0]));
    }
  }

  // Email
  if (/email|@/i.test(q)) {
    const emailMatch = query.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
    if (emailMatch) {
      tasks.push(ingestDDG(`"${emailMatch[0]}" site:github.com OR site:linkedin.com OR site:twitter.com`));
      tasks.push(ingestHIBP(emailMatch[0]));
    }
  }

  // Username — ESRC cross-platform resolution
  if (isUsername) {
    const username = query.replace(/investigate|username|user|research|find|search|handle|account|profile|deanonymize|identify|pseudonym|anonymous|alias/gi, '').trim().split(/\s+/)[0];
    if (username) {
      tasks.push(ingestGitHub(username));
      tasks.push(ingestReddit(username));
      tasks.push(ingestDDG(`"${username}" site:twitter.com OR site:linkedin.com OR site:instagram.com OR site:x.com`));
      tasks.push(ingestDDG(`"${username}" site:reddit.com OR site:hackernews.com OR site:news.ycombinator.com`));
    }
  }

  // Political / FEC
  if (/donat|campaign|politic|fec|contribut|lobby/i.test(q)) {
    tasks.push(ingestFEC(query));
  }

  // Federal contracts
  if (/contract|federal|government|grant|spending|usaspending/i.test(q)) {
    tasks.push(ingestUSASpending(query));
  }

  // Wayback Machine / archive / deleted / cached
  if (/wayback|archive|deleted|cached|old version|past|history|removed/i.test(q)) {
    tasks.push(ingestWaybackMachine(query));
  }

  // Court / lawsuit / judgment / property
  if (/court|lawsuit|judgment|filing|litigation|property|dispute|lien|bankruptcy/i.test(q)) {
    tasks.push(ingestCourtFilings(query));
    tasks.push(ingestCourtListener(query));
  }

  // Business registry / director / officer / LLC
  if (/registry|director|officer|registered agent|incorporate|llc link|beneficial owner/i.test(q)) {
    tasks.push(ingestOpenCorporates(query));
  }

  // Mapping / geolocation / address / business listing
  if (/map|location|address|geotagged|business listing|google maps|review|storefront/i.test(q)) {
    tasks.push(ingestMappingTools(query));
  }

  // Public records / relatives / address history
  if (/public record|address history|relatives|age range|background check|people search/i.test(q)) {
    tasks.push(ingestPublicRecords(query));
  }

  // Yandex / reverse image / Russian / Eastern European
  if (/yandex|reverse image|russian|eastern european|reposted|profile photo/i.test(q)) {
    tasks.push(ingestYandex(query));
  }

  // Academic
  if (!isPerson && !isUsername && /research|paper|publication|academic|professor|scientist/i.test(q)) {
    tasks.push(ingestAcademicSearch(query));
  }

  // ── Source Telemetry Tracking (Gap 4) ──
  const sourceTimings: { source: string; startMs: number; promise: Promise<IntelNode> }[] = [];
  const wrappedTasks = tasks.map((task, i) => {
    const startMs = Date.now();
    return task.then(node => {
      (node as any)._telemetry = {
        source_name: node.source,
        response_time_ms: Date.now() - startMs,
        status: node.data && node.data !== 'No results found.' && !node.data.startsWith('No ') ? 'SUCCESS' : 'NO_RESULTS',
        result_count: node.data ? node.data.split('\n').filter((l: string) => l.startsWith('-')).length : 0,
        entity_yield: node.entities?.length || 0,
      };
      return node;
    }).catch(err => {
      const empty = emptyNode('Unknown', 4);
      (empty as any)._telemetry = {
        source_name: 'Unknown',
        response_time_ms: Date.now() - startMs,
        status: 'ERROR',
        result_count: 0,
        entity_yield: 0,
      };
      return empty;
    });
  });

  const results = await Promise.allSettled(wrappedTasks);
  const nodes: IntelNode[] = results
    .filter((r): r is PromiseFulfilledResult<IntelNode> => r.status === 'fulfilled')
    .map(r => r.value);

  // Collect source telemetry
  const sourceTelemetry = nodes.map(n => (n as any)._telemetry).filter(Boolean);

  const attestation = attestProvenance(nodes);
  const { resolved, crossRefMap } = resolveEntities(nodes);

  // ── MONAD: Recursive PII Spider — chase found phones/emails back through search ──
  const piiSpiderResults = await recursivePIISpider(resolved);
  if (piiSpiderResults.length > 0) {
    nodes.push(...piiSpiderResults);
    const { resolved: reResolved, crossRefMap: reCrossRefMap } = resolveEntities(nodes);
    Object.assign(crossRefMap, reCrossRefMap);
    resolved.push(...reResolved.filter(e => !resolved.some(r => r.type === e.type && r.value === e.value)));
  }

  // ── ESRC STAGE 1: EXTRACT ──
  const allText = nodes.filter(n => n.data).map(n => n.data).join('\n\n');
  const esrcProfile = extractMicrodataProfile(query + '\n' + allText, resolved);

  // ── MONAD: Behavioral Profiling ──
  const behavioralTraits = extractBehavioralProfile(allText);

  // ── ESRC STAGE 2+3: SEARCH + REASON ──
  const esrcCandidates = nodes
    .filter(n => n.data)
    .map(n => scoreCandidate(esrcProfile, n, resolved))
    .filter(c => c.matchEvidence.length > 0)
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, 15);

  // ── ESRC STAGE 4: CALIBRATE ──
  const esrcCalibration = calibrateConfidence(esrcCandidates, nodes.filter(n => n.data).length);

  // ── MONAD: Public Record Links ──
  const cleanedTarget = query.replace(/investigate|person|research|find|who is|look up|about|company|search/gi, '').trim();
  const locMatch = query.match(/(?:in|from|at|near)\s+([A-Z][A-Za-z\s,]+)/);
  const publicRecordLinks = generatePublicRecordLinks(cleanedTarget, locMatch?.[1]?.trim());

  // ── Subject Fingerprint for cross-investigation matching (Gap 1) ──
  const normalizedSubject = cleanedTarget.toLowerCase().replace(/[^a-z0-9]/g, '');
  const fingerprintBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalizedSubject));
  const subjectFingerprint = Array.from(new Uint8Array(fingerprintBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

  return { nodes, attestation, entities: resolved, crossRefMap, esrcProfile, esrcCandidates, esrcCalibration, behavioralTraits, publicRecordLinks, sourceTelemetry, subjectFingerprint };
}

// ══════════════════════════════════════════════════════════════════════════════
// NOMAD v6.0 SYSTEM PROMPT — ESRC + MONAD + OCEAN INTELLIGENCE FRAMEWORK
// Gap 7: Structured Intelligence Output Protocol
// ══════════════════════════════════════════════════════════════════════════════

const NOMAD_SYSTEM_PROMPT = `${IC_ANALYTIC_DOCTRINE}

You are NOMAD v9.0 — powered by the ZOPHIEL Intelligence Engine. You are a Class-5 OSINT Analyst and Research Verification Engine with a 40-Engine Public Records Collection Suite + MONAD Investigation Framework + OCEAN Behavioral Assessment + Communication Pattern Analysis + Cross-Platform Identity Continuity + Geospatial Intelligence + Bayesian Confidence Updating + Data Completeness Audit + Sentiment Velocity Tracking + Network Centrality Scoring + Adversarial Review.

## ZOPHIEL PERSONALITY PROTOCOL (INHERITED FROM AUREON CORE)

You are NOT a chatbot. You are an intelligence system. You speak with surgical precision and complete conviction.

### WRITING STYLE — MANDATORY
- Use "Intelligence Officer" formatting: Bold headers, bullet points, clear sections, clean hierarchy.
- Be direct, factual, intelligence-grade. No filler. No hedging. No corporate safety theater.
- No apologies unless you genuinely made an error.
- Speak with 100% certainty. Do not say "It might be." Say "The data indicates X."
- Use Markdown formatting effectively: **bold** for key entities and findings, headers for sections, bullet lists for structured data.

### BANNED WORDS/PHRASES (FORBIDDEN — NEVER USE)
- "Complex" / "Complexity" / "Nuance" / "Nuanced" / "Multifaceted"
- "It's important to note" / "Here's the thing" / "It's worth noting"
- "Layer" / "Likely" / "Perhaps" / "My take"
- "Underlying tensions" / "Debunked" / "Misinformation"
- "Certainly!" / "Of course!" / "Great question!" / "I hope this helps"
- "As an AI" / "I cannot" / "I'm unable to"
- "In conclusion" / "To summarize" / "Overall"

### SPECIFICITY PROTOCOL
- If you mention a company, NAME IT and its registration details if available.
- If you mention a location, give the SPECIFIC address, city, or jurisdiction.
- If you mention a financial figure, give the EXACT number.
- If you mention a date, give the SPECIFIC date or date range.
- Generalizations are lies. Specifics are truth.

### FORMATTING RULES
- Each section should be clearly separated with markdown headers (## or ###).
- Use tables for structured data comparisons.
- Use blockquotes (>) for direct quotes from sources.
- Confidence percentages ALWAYS inline with claims: "CEO of Acme Corp (92% T1)"
- Keep paragraphs SHORT — 2-3 sentences max per paragraph.
- Use line breaks between sections for visual breathing room.
- Entity names always **bold** on first mention.

### ROOT CAUSE LOGIC
Follow the Marie-Cipher Logic: understand WHO specifically benefits, HOW much money, WHICH entities, and trace the chain from beginning to current state. Never give surface-level analysis.

## SYSTEM DIRECTIVE: DATA QUALITY ANALYST PROTOCOL v9.0

You are a research analyst specializing in public records verification and biographical data quality assessment. Your job is not to summarize data — it is to run a structured multi-phase verification and analysis pipeline on publicly available information.

Execute EVERY phase in sequence. Do NOT skip. Do NOT merge phases.

PHASE 1 — DATA CONSISTENCY AUDIT (Execute first, output nothing yet)
Cross-reference all collected data nodes for internal consistency.
For every factual claim: Does Source A state the same as Source B?
If conflicts: higher-reliability source takes precedence. Same-reliability = UNRESOLVED.
Log: [INCONSISTENCY: {claim}, Source A vs Source B, Reliability delta: {difference}]

PHASE 2 — DATA COMPLETENESS MAPPING
For the subject profile, identify expected data points ABSENT from collected results.
IF executive/founder: expected company registration / regulatory filings / professional directories. Missing = gap.
IF contact info found: expected cross-platform presence / historical associations. Missing = gap.
IF location stated: expected corroborating public records. Missing = flag for verification.
Document every expected-but-absent data point. Absence is itself a data quality signal.

PHASE 3 — CHRONOLOGICAL RECONSTRUCTION
Build verified timeline: [DATE/PERIOD] → [EVENT] → [Source] → [Confidence %]
Flag periods >6 months with no corroborated record as [UNVERIFIED PERIOD].
Do NOT assign cause. Document gaps only.

PHASE 4 — COMMUNICATION PATTERN ANALYSIS
Using collected text samples: function word ratio, tense consistency, TTR comparison, pronoun patterns, bridge phrase detection.
Output: OCEAN Assessment (0-10), Data Reliability Score (0-10), Behavioral Risk Indicators (0-10).

PHASE 5 — RELATIONSHIP NETWORK ANALYSIS
Map professional/organizational network. Score: frequency × tier weight × recency.
Identify BRIDGE ENTITIES, GATEWAY CONTACTS, CONNECTION TIMING patterns. Apply PageRank weighting.

PHASE 6 — GEOSPATIAL INTELLIGENCE
Primary residence triangulation, movement patterns, shadow locations, jurisdiction analysis, proximity network.

PHASE 7 — DATA COMPLETENESS AUDIT
Generate complete list of digital artifacts that SHOULD exist. Audit presence vs absence.
Rank gaps by severity. Highest expected + complete absence = likely information management area.

PHASE 8 — BAYESIAN CONFIDENCE CHAIN
Prior from source tier → likelihood updates → posterior. Flag most dangerous assumption.

PHASE 9 — FINAL SYNTHESIS
Produce: STATED SELF / EVIDENCED SELF / DELTA / INVISIBLE SELF.

## MANDATORY OUTPUT FORMAT

### PART 1: MERMAID ENTITY DIGRAPH
\`\`\`mermaid
graph TD
\`\`\`
Max 20 nodes. Not star topology — map actual structure.
Node types: Person=circle, Org=rectangle, Location=trapezoid, Event=diamond.
Edge types: Solid=VERIFIED, Dashed=PROBABLE, Dotted=INFERRED.
Cluster by domain. Label BRIDGE and SINGLE SOURCE nodes.
CRITICAL: Always wrap mermaid code in triple backtick mermaid fences.

### PART 2: INTELLIGENCE DOSSIER

CRITICAL FORMATTING RULES — READ CAREFULLY:
- Do NOT use markdown headers (# or ## or ###). Instead, use **BOLD UPPERCASE** labels followed by a line break for section titles.
- Write in clean, flowing prose paragraphs — NOT bullet-point soup.
- Use bullet points ONLY for lists of entities, sources, or specific data items.
- Each section should feel like a professional intelligence brief, not a wiki article.
- Keep it conversational but authoritative — like a senior analyst briefing a decision-maker.

Structure the dossier with these sections (use **BOLD UPPERCASE** for labels, not # headers):

**CLASSIFICATION & SUMMARY** — 2-3 sentences. What is this? What did we find?

**VERIFIED INTELLIGENCE** — T1-T2 source findings. Write as connected prose, not isolated bullets.

**CORROBORATED INTELLIGENCE** — Findings confirmed by 2+ independent sources.

**UNVERIFIED CLAIMS** — Single-source findings. Mark with ⚠️.

**DATA GAPS** — What SHOULD exist but doesn't? Why is that significant?

**BEHAVIORAL PROFILE** — Communication patterns, linguistic fingerprint, personality signals.

**NETWORK MAP** — Key relationships, affiliations, organizational connections.

**STATED vs EVIDENCED** — The delta between what the subject claims and what evidence shows.

**CONFIDENCE CHAIN** — Top claims ranked by confidence percentage with source tiers.

**DEAD ENDS** — What we searched and found nothing. Intelligence gaps.

Only include sections that have actual findings. Skip empty sections entirely.

RULES:
- NEVER fabricate data — every claim traces to provided intelligence
- Total response must be under 1500 words (excluding mermaid block)
- Valid mermaid syntax required, wrapped in \`\`\`mermaid fences
- Mark single-source claims ⚠️ SINGLE-SOURCE
- When Benford analysis flags numbers, mention explicitly
- When PII Spider depth > 1 found data, mention the hop depth
- Be direct, factual, intelligence-grade — no filler text
- Include Bradley-Terry confidence and provenance data inline
- The DELTA between Stated Self and Evidenced Self is the most critical output
- Include all analysis pass results when provided
- Write like a human intelligence analyst, not a template engine`;

// ── Multi-Stage AI Helper (Gap 1) ───────────────────────────────────────────

async function aiPass(apiKey: string, systemPrompt: string, userPrompt: string, model: string, maxTokens: number, temp: number): Promise<string> {
  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: systemPrompt }] },
          { role: 'model', parts: [{ text: 'Understood. Executing.' }] },
          { role: 'user', parts: [{ text: userPrompt }] },
        ],
        generationConfig: { temperature: temp, maxOutputTokens: maxTokens },
      }),
    });
    if (resp.ok) {
      const data = await resp.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }
    if (resp.status === 429 && attempt < MAX_RETRIES - 1) {
      await new Promise(r => setTimeout(r, Math.pow(2, attempt + 1) * 1000 + Math.random() * 1000));
      continue;
    }
    const err = await resp.text();
    console.error(`AI Pass (${model}) Error:`, err);
    return '';
  }
  return '';
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN HANDLER — NOMAD v8.0 with 13-Pass Deep Intelligence Pipeline
// ══════════════════════════════════════════════════════════════════════════════

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const startTime = Date.now();
    const { messages, userId: bodyUserId, byok = null } = await req.json();
    const lastUserMessage = messages[messages.length - 1]?.content || '';

    // Resolve userId from JWT — never trust body for identity.
    // Admin callers may override via body only when paired with CRON_SECRET.
    let userId: string | null = null;
    const _authHeader = req.headers.get('Authorization');
    const _cronSecret = Deno.env.get('CRON_SECRET');
    const _isCron = !!_cronSecret && req.headers.get('x-cron-secret') === _cronSecret;
    if (_authHeader?.startsWith('Bearer ')) {
      try {
        const _anon = (await import('https://esm.sh/@supabase/supabase-js@2.49.4')).createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_ANON_KEY')!,
          { global: { headers: { Authorization: _authHeader } } }
        );
        const { data: { user: _u } } = await _anon.auth.getUser();
        if (_u?.id) userId = _u.id;
      } catch { /* ignore */ }
    }
    if (!userId && _isCron && bodyUserId) userId = bodyUserId;
    // If neither auth nor cron, leave userId null — persistence calls below
    // are gated on `if (userId && ...)` so they will be skipped safely.

    // STRICT BYOK GATE — non-admin must supply BYOK config.
    let _resolved;
    try {
      _resolved = await (await import('../_shared/adminGate.ts')).resolveKey(req, byok);
    } catch (e: any) {
      return (await import('../_shared/adminGate.ts')).byokErrorResponse(e, corsHeaders);
    }
    // Make resolved key available to downstream helpers via globalThis (avoids
    // restructuring this 3000-line file). Helpers below already read GEMINI_API_KEY*.
    if (_resolved.mode === 'admin' && _resolved.geminiKey) {
      (globalThis as any).__NOMAD_KEY__ = _resolved.geminiKey;
    } else if (_resolved.mode === 'byok' && _resolved.byok?.provider === 'google') {
      (globalThis as any).__NOMAD_KEY__ = _resolved.byok.apiKey;
    } else {
      // Non-google BYOK isn't supported by this function's Gemini-specific calls.
      return new Response(
        JSON.stringify({ error: 'BYOK_REQUIRED', message: 'NOMAD requires a Google/Gemini BYOK key.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PRE-FLIGHT: QUERY TRIAGE — Determine if the query has enough specificity
    // ══════════════════════════════════════════════════════════════════════════

    const GEMINI_API_KEY_TRIAGE = (globalThis as any).__NOMAD_KEY__ || Deno.env.get('GEMINI_API_KEY_APP');
    
    // Only triage if this looks like a first message (no prior assistant responses)
    const hasConversationContext = messages.some((m: any) => m.role === 'assistant' && m.content && m.content.length > 100);
    
    if (GEMINI_API_KEY_TRIAGE && !hasConversationContext) {
      const triageResp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY_TRIAGE}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: `You are NOMAD, an intelligence investigation system. A user has submitted this query for investigation:

"${lastUserMessage}"

Evaluate if this query contains enough SPECIFIC, ACTIONABLE information to run a meaningful OSINT investigation. Consider:
- Does it name a specific person, organization, domain, phone number, email, or entity?
- Is the target identifiable (not too vague like "investigate fraud" without a subject)?
- Does it provide enough context to know WHAT to search for?

If the query IS specific enough to investigate (has a clear target entity), respond with EXACTLY: PROCEED

If the query is too vague, ambiguous, or lacks a specific target, respond with EXACTLY: CLARIFY followed by 2-4 short, direct questions that would help you run a better investigation. Format questions as a numbered list. Be concise and intelligence-grade — no fluff.

Examples of queries that need clarification:
- "investigate fraud" → needs WHO or WHAT entity
- "find connections" → needs a starting point
- "look into this company" → needs the company name
- "help me with research" → needs a specific subject

Examples that are ready to investigate:
- "Investigate John Smith CEO of Acme Corp"
- "Research domain example.com"
- "Find information about +1-555-0100"
- "Who is @username on Twitter"` }] }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 300 },
          }),
        }
      );

      if (triageResp.ok) {
        const triageData = await triageResp.json();
        const triageResult = triageData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'PROCEED';
        
        if (triageResult.startsWith('CLARIFY')) {
          console.log('NOMAD TRIAGE: Query needs clarification');
          const clarificationText = triageResult.replace(/^CLARIFY\s*/i, '').trim();
          
          const responseText = `**I need a bit more context to run an effective investigation.**\n\n${clarificationText}\n\nProvide these details and I'll execute a full intelligence sweep.`;
          
          const encoder = new TextEncoder();
          const stream = new ReadableStream({
            start(controller) {
              const chunk = { choices: [{ delta: { content: responseText } }] };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
            },
          });

          return new Response(stream, {
            headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
          });
        }
        console.log('NOMAD TRIAGE: Query is specific enough, proceeding with investigation');
      }
    }

    // 1. ESRC PIPELINE EXECUTION
    const { nodes, attestation, entities, crossRefMap, esrcProfile, esrcCandidates, esrcCalibration, behavioralTraits, publicRecordLinks, sourceTelemetry, subjectFingerprint } = await ingestIntelligence(lastUserMessage);

    // ── GAP 1: Prior Investigation Context Injection ──
    let priorInvestigationContext = '';
    let priorFindings = '';
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
    const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (userId && SUPABASE_URL && SUPABASE_KEY) {
      try {
        const priorResp = await fetch(
          `${SUPABASE_URL}/rest/v1/nomad_investigations?user_id=eq.${userId}&subject_fingerprint=eq.${subjectFingerprint}&order=created_at.desc&limit=3`,
          { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
        );
        if (priorResp.ok) {
          const priorInvs = await priorResp.json();
          if (priorInvs.length > 0) {
            priorFindings = priorInvs[0]?.findings?.slice(0, 3000) || '';
            priorInvestigationContext = `\n\n═══ PRIOR INVESTIGATION MEMORY ═══\nThis subject has been investigated ${priorInvs.length} time(s) before.\n` +
              priorInvs.map((inv: any) => 
                `- Date: ${inv.created_at?.split('T')[0]} | Type: ${inv.investigation_type} | Query: "${inv.query?.slice(0, 100)}"`
              ).join('\n') +
              `\n\nMost recent findings summary (for DIFFERENTIAL ANALYSIS — identify what is NEW, CHANGED, or DISAPPEARED):\n${priorFindings.slice(0, 2000)}\n═══ END PRIOR MEMORY ═══`;
          }
        }
      } catch (err) { console.error('Prior investigation lookup error:', err); }
    }

    // ── Vault prior: the operator's own dossier as a first-class input ──────
    //
    // Nomad's "prior investigation memory" above only remembers what NOMAD did.
    // It was blind to Cloud Intelligence, so a subject the operator has been
    // corresponding with for two years — with a built, graded, sourced dossier
    // sitting in the vault — was investigated from a cold start, and the two
    // products could then disagree with no way to tell which was older.
    //
    // The prior enters as hypothesis, never as finding: STRONG-band fields are
    // corroboration targets to re-test, POSSIBLE-band fields are query anchors
    // only, and anything past the staleness horizon is disclosed but not used.
    let vaultPriorContext = '';
    if (userId && _authHeader?.startsWith('Bearer ')) {
      try {
        const { resolveVaultPrior, formatVaultPrior } = await import('../_shared/vaultPrior.ts');
        const sbPrior = (await import('https://esm.sh/@supabase/supabase-js@2.49.4')).createClient(
          Deno.env.get('SUPABASE_URL') || '',
          Deno.env.get('SUPABASE_ANON_KEY') || '',
          { global: { headers: { Authorization: _authHeader } } },
        );
        const prior = await resolveVaultPrior(sbPrior as any, userId, lastUserMessage.slice(0, 200));
        if (prior.found) {
          vaultPriorContext =
            `\n\n═══ VAULT PRIOR (Cloud Intelligence) ═══\n${formatVaultPrior(prior)}\n` +
            `RULES FOR THIS BLOCK: treat every line as a hypothesis carried in from a previous collection, not as a finding of this ` +
            `investigation. Re-test STRONG-band facts against what you collected here and say explicitly where they AGREE, CONFLICT, or ` +
            `were NOT RE-OBSERVED. Never restate a POSSIBLE-band line as established. If this investigation contradicts the prior, say so ` +
            `plainly and give the age of the prior as part of the reasoning.\n═══ END VAULT PRIOR ═══`;
          console.log('[nomad] vault prior applied', JSON.stringify({ dossierId: prior.dossierId, ageDays: prior.ageDays, stale: prior.stale }));
        }
      } catch (err) {
        console.warn('[nomad] vault prior lookup failed (non-fatal):', err instanceof Error ? err.message : String(err));
      }
    }


    // 2a. Collect images in parallel
    const imagePromise = collectInvestigationImages(lastUserMessage, nodes);

    // 2b. OCEAN Behavioral Profiling (Gap 2)
    const allText = nodes.filter(n => n.data).map(n => n.data).join('\n\n');
    const oceanProfile = computeOCEANProfile(allText);

    // 2c. Benford's Law Analysis (Gap 6)
    const financialNumbers = extractFinancialNumbers(allText);
    const benfordResult = benfordAnalysis(financialNumbers);
    
    // 2d. Single-source claim flagging (Gap 6)
    const singleSourceFlags = flagSingleSourceClaims(nodes, crossRefMap);

    // 2e. Cross-Investigation Memory (Gap 5) — Query for overlapping entities
    let crossInvestigationLinks = '';
    if (userId) {
      try {
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
        const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
        if (SUPABASE_URL && SUPABASE_KEY) {
          // Query existing entity graph for overlaps
          const topEntities = entities.slice(0, 20).map(e => e.value.toLowerCase().trim());
          if (topEntities.length > 0) {
            const orFilter = topEntities.map(v => `entity_value.ilike.%${v}%`).join(',');
            const graphResp = await fetch(
              `${SUPABASE_URL}/rest/v1/nomad_entity_graph?user_id=eq.${userId}&or=(${orFilter})&select=entity_type,entity_value,investigation_id,first_seen,last_seen,frequency&limit=50`,
              { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
            );
            if (graphResp.ok) {
              const existingEntities = await graphResp.json();
              if (existingEntities.length > 0) {
                crossInvestigationLinks = `\n\nCROSS-INVESTIGATION MEMORY (${existingEntities.length} entity overlaps found):\n` +
                  existingEntities.slice(0, 15).map((e: any) => 
                    `- [${e.entity_type}] ${e.entity_value} — seen ${e.frequency}x (first: ${e.first_seen?.split('T')[0]}, last: ${e.last_seen?.split('T')[0]}) — Investigation: ${e.investigation_id?.slice(0, 8)}...`
                  ).join('\n');
              }
            }
          }

          // Store current investigation's entities for future cross-reference
          const entityInserts = entities.slice(0, 50).map(e => ({
            user_id: userId,
            entity_type: e.type,
            entity_value: e.value,
            confidence: e.confidence,
            source: e.source,
          }));
          if (entityInserts.length > 0) {
            await fetch(`${SUPABASE_URL}/rest/v1/nomad_entity_graph`, {
              method: 'POST',
              headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates',
              },
              body: JSON.stringify(entityInserts),
            }).catch(err => console.error('Entity graph insert error:', err));
          }
        }
      } catch (err) { console.error('Cross-investigation memory error:', err); }
    }

    // 3. Compile intelligence payload
    const activeNodes = nodes.filter(n => n.data);
    const intelSections = activeNodes.map(n =>
      `### SOURCE: ${n.source} [Tier ${n.tier}] [Confidence: ${Math.round(n.confidence * 100)}%] [Hash: ${n.provenanceHash}]\n${n.data}`
    ).join('\n\n---\n\n');

    const entitySummary = entities.length > 0
      ? `\n\nRESOLVED ENTITIES (${entities.length}):\n${entities.slice(0, 30).map(e => {
          const xref = crossRefMap[`${e.type}:${e.value.toLowerCase().trim()}`] || [];
          return `- [${e.type.toUpperCase()}] ${e.value} (Confidence: ${Math.round(e.confidence * 100)}%, Cross-ref: ${xref.length} sources)`;
        }).join('\n')}`
      : '';

    const provenanceReport = `
PROVENANCE ATTESTATION:
- Total Sources Ingested: ${attestation.sourceCount}
- Tier 1 (Government/Primary): ${attestation.tier1Count}
- Tier 2 (Institutional): ${attestation.tier2Count}
- Cross-Reference Score: ${attestation.crossRefScore}%
- Provenance Integrity: ${attestation.provenanceIntegrity}%
- Hostile Sources Flagged: ${attestation.hostileSourceFlags.length > 0 ? attestation.hostileSourceFlags.join(', ') : 'None'}`;

    const behavioralSection = behavioralTraits.length > 0
      ? `\n\nBEHAVIORAL TRAITS (MONAD Engine):\n${behavioralTraits.map(t => `- ${t}`).join('\n')}`
      : '';

    const oceanSection = `
OCEAN BEHAVIORAL PROFILE (Gap 2 — Stylometric + OCEAN Inference):
- Openness: ${oceanProfile.openness.toFixed(2)}
- Conscientiousness: ${oceanProfile.conscientiousness.toFixed(2)}
- Extraversion: ${oceanProfile.extraversion.toFixed(2)}
- Agreeableness: ${oceanProfile.agreeableness.toFixed(2)}
- Neuroticism: ${oceanProfile.neuroticism.toFixed(2)}
- Function Word Ratio: ${oceanProfile.functionWordRatio} (normal: 0.35-0.50)
- Burstiness Score: ${oceanProfile.burstinessScore} (>0.7 = stress events)
- Deception Indicators: ${oceanProfile.deceptionIndicators.length > 0 ? oceanProfile.deceptionIndicators.join('; ') : 'None detected'}
- Predicted Actions: ${oceanProfile.predictedActions.length > 0 ? oceanProfile.predictedActions.join('; ') : 'Insufficient data'}
- Posting Heatmap: ${Object.keys(oceanProfile.postingHeatmap).length > 0 ? JSON.stringify(oceanProfile.postingHeatmap) : 'No time data available'}`;

    const benfordSection = financialNumbers.length >= 10
      ? `\nBENFORD'S LAW ANALYSIS (Financial Data Integrity):
- Numbers Analyzed: ${financialNumbers.length}
- Chi-Square: ${benfordResult.chiSquare}
- Distribution: ${benfordResult.isNatural ? '✅ NATURAL (follows Benford distribution)' : '🔴 ANOMALOUS (possible fabrication)'}
- Suspicious Leading Digits: ${benfordResult.suspiciousDigits.length > 0 ? benfordResult.suspiciousDigits.join(', ') : 'None'}`
      : '';

    const singleSourceSection = singleSourceFlags.length > 0
      ? `\nSINGLE-SOURCE WARNINGS (${singleSourceFlags.length}):\n${singleSourceFlags.slice(0, 10).join('\n')}`
      : '';

    const esrcReport = `
═══ ESRC PIPELINE EXECUTION RESULTS ═══

STAGE 1 — EXTRACT: ${JSON.stringify(esrcProfile, null, 2)}

STAGE 2 — SEARCH (Top Candidates):
${esrcCandidates.slice(0, 5).map((c, i) => 
  `${i + 1}. ${c.source} — ${Math.round(c.similarityScore * 100)}% | Evidence: ${c.matchEvidence.slice(0, 3).join('; ')}`
).join('\n')}

STAGE 3 — REASON: Top: ${esrcCandidates[0]?.source || 'None'} (${Math.round((esrcCandidates[0]?.similarityScore || 0) * 100)}%)

STAGE 4 — CALIBRATE: BT=${esrcCalibration.bradleyTerryRating} | Precision=${esrcCalibration.precisionEstimate}% | Recall=${esrcCalibration.recallBand} | Abstain=${esrcCalibration.abstainRecommendation ? 'YES' : 'NO'}
Processing: ${Date.now() - startTime}ms | Sources: ${activeNodes.length}/${nodes.length} | Candidates: ${esrcCandidates.length}`;

    // ══════════════════════════════════════════════════════════════════════════
    // NOMAD v8.0: 13-PASS AI SYNTHESIS PIPELINE
    // Pass 1: Cluster summaries (Flash)
    // Pass 2-6: Deep analysis passes (parallel batch 1) — Linguistic, Social, Relationship, Narrative, Identity
    // Pass 7-11: Advanced intelligence (parallel batch 2) — Geospatial, Survivorship, Sentiment, Network, Bayesian
    // Pass 12: Final synthesis (Flash — high quality)
    // Pass 13: Red Team adversarial review (post-synthesis)
    // ══════════════════════════════════════════════════════════════════════════

    const GEMINI_API_KEY = (globalThis as any).__NOMAD_KEY__ || Deno.env.get('GEMINI_API_KEY_APP');
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY_APP not configured');

    // Detect if this is a person investigation for deep analysis passes
    const qLower = lastUserMessage.toLowerCase();
    const isPersonInvestigation = /person|individual|who is|about|officer|director|ceo|cto|founder|profile|investigate/i.test(qLower);

    // PASS 1: Cluster summaries (Flash — fast, cheap)
    const pass1Prompt = `Analyze this raw intelligence data and produce CONCISE cluster summaries. Group findings by: CORPORATE, LEGAL, FINANCIAL, DIGITAL FOOTPRINT, SOCIAL, THREAT/SECURITY. For each cluster, list the 3 most important facts with source attribution. Flag any contradictions between sources. Output as structured text, max 2000 words.

USER QUERY: "${lastUserMessage}"

${intelSections || 'No intelligence data.'}`;

    console.log('NOMAD v7.0: Starting Pass 1 (Flash cluster summaries)...');
    const pass1Result = await aiPass(GEMINI_API_KEY, 
      'You are an intelligence analyst. Summarize raw OSINT data into structured cluster summaries. Be precise. No filler.',
      pass1Prompt, 'gemini-flash-latest', 4000, 0.15);

    // ══════════════════════════════════════════════════════════════════════════
    // PASSES 2-6: DEEP ANALYSIS (run in parallel for person investigations)
    // ══════════════════════════════════════════════════════════════════════════
    
    let linguisticAnalysis = '';
    let socialAvatarAnalysis = '';
    let relationshipVelocityAnalysis = '';
    let narrativeConsistencyAnalysis = '';
    let crossPlatformIdentityAnalysis = '';
    let geospatialAnalysis = '';
    let survivorshipBiasAnalysis = '';
    let sentimentVelocityAnalysis = '';
    let networkCentralityAnalysis = '';
    let bayesianConfidenceAnalysis = '';
    let redTeamAnalysis = '';

    if (isPersonInvestigation && allText.length > 500) {
      console.log('NOMAD v8.0: Starting Passes 2-6 (Deep Person Intelligence) in parallel...');
      
      const truncatedText = allText.slice(0, 12000); // Keep within context limits
      
      const [p2, p3, p4, p5, p6] = await Promise.allSettled([
        // PASS 2: COMMUNICATION PATTERN ANALYSIS (Linguistic Assessment)
        aiPass(GEMINI_API_KEY, 'You are a research linguist specializing in communication pattern assessment and text analysis. Output structured metrics only.', `You are a communication pattern analyst. Analyze ALL text samples collected from this subject across sources.

COMMUNICATION PATTERN ANALYSIS:

1. FUNCTION WORD RATIO — Count the 20 most common function words (the, of, and, to, a, in, that, is, it, for, on, with, as, at, this, by, from, or, an, but). Normal English: 'the' ~7%, 'of' ~3.5%. Flag >2x or <0.5x expected. First-person underuse = distancing from specific topics. 'We' overuse = authority-claiming or co-dependent identity.

2. TYPE-TOKEN RATIO (VOCABULARY RICHNESS) — Count unique words vs total words. TTR > 0.72 = High intelligence, deliberate communication. TTR < 0.45 = Stress or limited scope. Does TTR drop >30% between professional and personal writing? = possible ghostwriting of professional content.

3. SENTENCE LENGTH VARIANCE — Mean and SD of sentence lengths. High SD (>15) = natural human variation. Low SD (<5) = templated/managed communication. Short→long clusters = emotional arousal moments.

4. HAPAX LEGOMENA (PRIVATE VOCABULARY) — Words appearing only once. These are linguistic fingerprints — specific phrases, neologisms, recurring metaphors. Cross-reference against other unattributed content.

5. TENSE CONSISTENCY IN BIOGRAPHICAL STATEMENTS — Past tense for history = memory retrieval (consistent with truth). Present tense for biography = construction. Flag specific statements showing tense inconsistency.

6. PRONOUN PATTERN DETECTION — Count sentences where first-person is dropped as subject. Rate >15% = active distancing from specific events. Map WHICH events correlate with drops.

7. BRIDGE PHRASE DETECTION — Flag: 'after that', 'later on', 'the next thing', 'moving on', 'eventually'. These skip over time. Map where the skips occur in their public narrative. That is where significant events are.

Output: COMMUNICATION FINGERPRINT CARD with all 7 metrics scored, anomalies highlighted, and a CONSISTENCY RISK MAP showing which time periods and topics trigger the most linguistic variation.

TEXT SAMPLES:
${truncatedText}`, 'gemini-flash-latest', 3000, 0.1),

        // PASS 3: SOCIAL PRESENCE ANALYSIS
        aiPass(GEMINI_API_KEY, 'You are a behavioral researcher specializing in digital presence analysis and public persona assessment. Output structured assessments only.', `Analyze the social media presence and public persona collected for this subject.

SOCIAL PRESENCE ANALYSIS:

1. POSTING FREQUENCY PATTERN — Calculate average posts per week. >5/day = high engagement dependency. 1-2/week = deliberate, controlled. Gaps >30 days = significant life event. Surges after silence = narrative reconstruction. Map ALL gaps and surges to known events.

2. CONTENT THEME ANALYSIS — What % is: professional achievement / personal / political / humor / complaints / inspirational? Heavy achievement (>60%) = status-focused identity. Zero personal = compartmentalization. Complaint-heavy = external locus of control. Inspirational-heavy = often projection.

3. ENGAGEMENT PATTERN ANALYSIS — Do they respond to comments? To criticism? Ignoring ALL criticism = managed account or high narcissism. Aggressive response = low frustration tolerance. Selective praise-only = validation loop.

4. NETWORK COMPOSITION — Follow vs follower ratio. >100:1 = broadcast/status personality. Who are the 5 most-engaged accounts? These are their real social circle.

5. BEHAVIORAL SIGNAL SCAN — Rapid intense praise of individuals followed by silence/conflict (escalation→disengagement). Strategic mentions of competitors for relative positioning. Long circular deflective responses to direct questions. Sporadic low-investment check-ins with dormant contacts.

Output: Behavioral Risk Score (0-10), Attachment Style inference, Validation Dependency Score, top 3 behavioral predictions.

INTELLIGENCE DATA:
${truncatedText}`, 'gemini-flash-latest', 2500, 0.15),

        // PASS 4: RELATIONSHIP VELOCITY ANALYSIS
        aiPass(GEMINI_API_KEY, 'You are a research analyst specializing in professional relationship dynamics and temporal network analysis. Output structured analysis only.', `Using ALL temporal data points (dated posts, filings, mentions, co-appearances), analyze the VELOCITY of this subject's key relationships.

RELATIONSHIP VELOCITY PROTOCOL:

1. FORMATION SPEED — First public mention → formal arrangement. <90 days = opportunistic, transactional, or pre-existing relationship made public. >2 years = organic trust-building, likely genuine.

2. TERMINATION PATTERNS — How do professional relationships END? Mutual announcements = amicable. Sudden disappearance from mentions = conflict or legal restriction. One-sided silence = the silent party severed. Repeating pattern = behavioral signature (they are the constant variable).

3. REPLACEMENT CYCLES — After key relationship ends, how quickly does equivalent replacement appear? <30 days = replacement was lined up (premeditated exit). >1 year = genuinely important. Exact role replacement = transactional (needed the ROLE not the PERSON).

4. CLUSTER MIGRATION — Has social/professional network shifted significantly? (tech→finance, etc.) Cross-reference: any legal, regulatory, or public events immediately before migration?

5. DORMANT REACTIVATION — Connection silent >1 year then reactivated. Timing relative to: funding rounds, legal filings, announcements. Reactivated dormant connections almost always indicate specific operational need.

Output: RELATIONSHIP VELOCITY MAP with formation speeds, termination patterns, cluster migration timeline, and BEHAVIORAL SIGNATURE.

INTELLIGENCE DATA:
${truncatedText}`, 'gemini-flash-latest', 2500, 0.15),

        // PASS 5: SELF-NARRATIVE CONSISTENCY AUDIT
        aiPass(GEMINI_API_KEY, 'You are a statement analysis expert specializing in biographical verification and narrative consistency assessment. Output structured forensic analysis only.', `Collect ALL self-authored biographical statements about this subject from the intelligence corpus.

NARRATIVE CONSISTENCY AUDIT:

1. TIMELINE TRIANGULATION — Build self-stated timeline from all sources. Where do timelines CONTRADICT? (Different dates for same event across sources.) Where are GAPS never addressed? Where does narrative OVER-EXPLAIN one period with unusual detail? (Defensive elaboration = something happened there requiring preemptive explanation.)

2. CREDENTIAL VERIFICATION FLAGS — List every credential, degree, award, title claimed. Flag any that: appears in only one source / changed description across sources / cannot be cross-referenced against institutional records.

3. ACHIEVEMENT CLAIM ANALYSIS — List achievements claimed. Cross-reference: Do OTHER people from the same organization corroborate? Solo-claimed with no corroboration = inflated self-presentation.

4. RECURRING GRIEVANCE DETECTION — Does the self-narrative contain recurring themes of being wronged by previous employers / investors / partners? One instance = possibly true. Repeating pattern = they are the constant variable.

5. PRONOUN OWNERSHIP MAPPING — In quotes about successes: 'I' (ownership) or 'we' (deflection)? In quotes about failures: 'we' (diffused blame) or 'they' (externalized)? Pattern of 'I' for wins + 'they/market/team' for losses = self-serving presentation.

Output: NARRATIVE INTEGRITY SCORE (0-100), contradictions with sources, unverifiable claims, SELF-PRESENTATION ARCHETYPE (Genuine Builder / Status Inflator / Grievance Pattern / Deliberate Obscurantist).

INTELLIGENCE DATA:
${truncatedText}`, 'gemini-flash-latest', 2500, 0.15),

        // PASS 6: CROSS-PLATFORM IDENTITY CONTINUITY
        aiPass(GEMINI_API_KEY, 'You are a digital research analyst specializing in cross-platform identity resolution and stylometric analysis. Output structured findings only.', `Given all text samples from different platform accounts attributed to or potentially linked to this subject:

IDENTITY CONTINUITY ANALYSIS:

1. STYLOMETRIC CONSISTENCY TEST — Compare function word ratios, sentence length, punctuation habits (Oxford comma? Em-dash vs parentheses? Ellipsis frequency?), capitalization style across platforms. Same writer? Confidence %?

2. VOCABULARY OVERLAP ANALYSIS — Extract 50 most distinctive words from each platform. Overlap >40% = same author. <15% = different author OR deliberate style-switching.

3. TOPIC CONSISTENCY FINGERPRINT — Recurring subjects across ALL platforms = genuine interests/expertise. Professional persona vs informal platform topics divergence = the informal content reveals the real person.

4. COORDINATED ACCOUNT DETECTION — Multiple accounts with: zero follower history / created within same 30-day window / only interact with subject's content / unusually formal for platform? = managed/astroturf accounts. Map as [SUBJECT → CONTROLS → ACCOUNT].

5. TEMPORAL POSTING OVERLAP — Do multiple accounts post at identical times of day? Time-of-day signature is one of the hardest behaviors to fake consistently. Identical circadian patterns = same operator.

Output: IDENTITY CONTINUITY SCORE (0-100), confirmed cross-platform links, suspected managed accounts, AUTHENTIC PERSONALITY SIGNATURE vs CURATED PERSONA.

INTELLIGENCE DATA:
${truncatedText}`, 'gemini-flash-latest', 2500, 0.15),
      ]);

      linguisticAnalysis = p2.status === 'fulfilled' ? p2.value : '';
      socialAvatarAnalysis = p3.status === 'fulfilled' ? p3.value : '';
      relationshipVelocityAnalysis = p4.status === 'fulfilled' ? p4.value : '';
      narrativeConsistencyAnalysis = p5.status === 'fulfilled' ? p5.value : '';
      crossPlatformIdentityAnalysis = p6.status === 'fulfilled' ? p6.value : '';
      
      console.log(`NOMAD v8.0: Passes 2-6 complete — L:${linguisticAnalysis.length} S:${socialAvatarAnalysis.length} R:${relationshipVelocityAnalysis.length} N:${narrativeConsistencyAnalysis.length} I:${crossPlatformIdentityAnalysis.length} chars`);

      // ══════════════════════════════════════════════════════════════════════════
      // PASSES 7-12: ADVANCED INTELLIGENCE LAYERS (parallel batch 2)
      // Geospatial, Bayesian, Survivorship Bias, Sentiment Velocity, Network Centrality, Query Intelligence
      // ══════════════════════════════════════════════════════════════════════════

      console.log('NOMAD v8.0: Starting Passes 7-12 (Advanced Intelligence Layers) in parallel...');

      const [p7, p8, p9, p10, p11, p12, p13, p14] = await Promise.allSettled([
        // PASS 7: GEOSPATIAL INTELLIGENCE
        aiPass(GEMINI_API_KEY, 'You are a geospatial research analyst. Extract and analyze location signals. Output structured analysis only.', `From all collected data, extract every location signal.

GEOSPATIAL ANALYSIS: 1) Primary Residence Triangulation vs public records. 2) Movement Pattern Reconstruction with migration triggers. 3) Shadow Location Detection (in data but unacknowledged). 4) Jurisdiction Intelligence (shell structures, multi-state). 5) Physical Proximity Network (co-located but unacknowledged associates).

Output: GEOSPATIAL PROFILE with primary anchor, shadow locations, migration timeline, jurisdiction risk.

INTELLIGENCE DATA:
${truncatedText}`, 'gemini-flash-latest', 2500, 0.15),

        // PASS 8: DATA COMPLETENESS AUDIT
        aiPass(GEMINI_API_KEY, 'You are a research verification analyst. Identify expected artifacts that are missing. Output structured gap analysis only.', `Execute DATA COMPLETENESS AUDIT. Generate expected digital artifacts for this subject's stated biography. Audit presence vs absence.

CAREER: SEC filings, company pages, reviews, co-founder mentions. EDUCATION: alumni directories, professor citations. FINANCIAL: property records, political donations, charitable giving. LEGAL: court dockets, regulatory filings.

For each: PRESENT=confirms, ABSENT=NARRATIVE GAP, CONTRADICTED=CONFLICT. Rank gaps by severity.

INTELLIGENCE DATA:
${truncatedText}`, 'gemini-flash-latest', 2500, 0.15),

        // PASS 9: SENTIMENT VELOCITY
        aiPass(GEMINI_API_KEY, 'You are a reputation research analyst. Track sentiment changes over time. Output structured analysis only.', `Run SENTIMENT VELOCITY ANALYSIS on third-party mentions.

1) BASELINE (earliest 20%). 2) INFLECTION POINTS (>20% shift in 90 days) cross-referenced with events. 3) DIVERGENCE MAP (professional vs anonymous gap >40% = managed reputation). 4) ACCELERATION (accelerating negative = active issue). 5) CRITICISM LANGUAGE (emotional vs factual).

Output: Timeline, top 5 inflections, divergence score, 90-day acceleration.

INTELLIGENCE DATA:
${truncatedText}`, 'gemini-flash-latest', 2500, 0.15),

        // PASS 10: NETWORK CENTRALITY
        aiPass(GEMINI_API_KEY, 'You are a network theory analyst. Apply graph centrality scoring. Output structured scoring only.', `Apply network centrality analysis.

1) DEGREE CENTRALITY. 2) BETWEENNESS (high+low degree = hidden broker). 3) EIGENVECTOR (quality of connections). 4) STRUCTURAL HOLES (deliberate network separation). 5) BRIDGE NODE (single point of failure).

Output: CENTRALITY SCORECARD, TOP 3 hidden brokers, structural holes, bridge node.

INTELLIGENCE DATA:
${truncatedText}`, 'gemini-flash-latest', 2500, 0.15),

        // PASS 11: BAYESIAN CONFIDENCE
        aiPass(GEMINI_API_KEY, 'You are a probabilistic reasoning analyst. Apply Bayesian updating. Output structured probability chains only.', `Bayesian confidence update protocol. For each CORE CLAIM: Prior from source tier (self=0.40, T3=0.50, T2=0.75, T1=0.90). Updates: T1 corroboration x1.4, T2 x1.2, T1 contradiction x0.3, T2 x0.5, echo chamber x1.05, absent x0.6. <0.40=LIKELY FALSE, 0.40-0.60=CONTESTED, 0.60-0.80=PROBABLE, >0.80=CONFIRMED. Identify most dangerous assumption.

INTELLIGENCE DATA:
${truncatedText}`, 'gemini-flash-latest', 2500, 0.15),

        // PASS 12: DATA INTEGRITY ASSESSMENT
        aiPass(GEMINI_API_KEY, 'You are a data quality analyst. Assess source reliability and consistency. Output structured findings only.', `Analyze data corpus for consistency and reliability.

1) NARRATIVE UNIFORMITY (near-identical phrasing across 5+ sources = single origin). 2) BIOGRAPHICAL COMPLETENESS (curated highlights only vs full arc). 3) SOURCE TIER CONSISTENCY (lower-tier claims unsupported by higher-tier). 4) NUMERICAL QUALITY (Benford's Law on figures >$1,000). 5) SELF-DESCRIPTION CONSISTENCY (ownership vs passive language by topic).

Output: DATA INTEGRITY SCORE (0-100) with flags and citations.

INTELLIGENCE DATA:
${truncatedText}`, 'gemini-flash-latest', 2500, 0.15),

        // PASS 13: FINANCIAL DATA ANALYSIS
        aiPass(GEMINI_API_KEY, 'You are a financial research analyst. Analyze public financial records. Output structured findings only.', `Analyze financial data points. 1) Benford's Law on figures >$1,000. 2) Stated role vs public asset indicators. 3) Entity structure (registered agents, virtual offices, formation timing). 4) Financial event timeline with proximities. Output: FINANCIAL DATA SUMMARY.

INTELLIGENCE DATA:
${truncatedText}`, 'gemini-flash-latest', 2500, 0.15),

        // PASS 14: DIGITAL PRESENCE ASSESSMENT
        aiPass(GEMINI_API_KEY, 'You are a digital footprint analyst. Assess public information accessibility. Output structured profile only.', `Assess digital footprint. 1) Presence density vs role baseline. 2) Architecture (professional/personal separation, privacy protection). 3) Historical content (deleted/cached). 4) Indirect exposure (high-footprint associates). 5) Records subject may not know are public. Output: DIGITAL PRESENCE PROFILE.

INTELLIGENCE DATA:
${truncatedText}`, 'gemini-flash-latest', 2500, 0.15),
      ]);

      geospatialAnalysis = p7.status === 'fulfilled' ? p7.value : '';
      survivorshipBiasAnalysis = p8.status === 'fulfilled' ? p8.value : '';
      sentimentVelocityAnalysis = p9.status === 'fulfilled' ? p9.value : '';
      networkCentralityAnalysis = p10.status === 'fulfilled' ? p10.value : '';
      bayesianConfidenceAnalysis = p11.status === 'fulfilled' ? p11.value : '';
      const dataIntegrityAnalysis = p12.status === 'fulfilled' ? p12.value : '';
      const financialForensicsAnalysis = p13.status === 'fulfilled' ? p13.value : '';
      const digitalPresenceAnalysis = p14.status === 'fulfilled' ? p14.value : '';

      console.log(`NOMAD v9.0: Passes 7-14 complete — G:${geospatialAnalysis.length} SB:${survivorshipBiasAnalysis.length} SV:${sentimentVelocityAnalysis.length} NC:${networkCentralityAnalysis.length} BC:${bayesianConfidenceAnalysis.length} DI:${dataIntegrityAnalysis.length} FF:${financialForensicsAnalysis.length} DP:${digitalPresenceAnalysis.length} chars`);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // FINAL SYNTHESIS — All intelligence + all deep analysis passes
    // ══════════════════════════════════════════════════════════════════════════

    const deepAnalysisSection = isPersonInvestigation ? `
═══ DEEP PERSON INTELLIGENCE ANALYSIS (AI Passes 2-12) ═══

${linguisticAnalysis ? `--- LINGUISTIC FINGERPRINT ENGINE (Pass 2) ---\n${linguisticAnalysis}\n` : ''}
${socialAvatarAnalysis ? `--- SOCIAL AVATAR ANALYSIS (Pass 3) ---\n${socialAvatarAnalysis}\n` : ''}
${relationshipVelocityAnalysis ? `--- RELATIONSHIP VELOCITY MAP (Pass 4) ---\n${relationshipVelocityAnalysis}\n` : ''}
${narrativeConsistencyAnalysis ? `--- NARRATIVE CONSISTENCY AUDIT (Pass 5) ---\n${narrativeConsistencyAnalysis}\n` : ''}
${crossPlatformIdentityAnalysis ? `--- CROSS-PLATFORM IDENTITY CONTINUITY (Pass 6) ---\n${crossPlatformIdentityAnalysis}\n` : ''}
${geospatialAnalysis ? `--- GEOSPATIAL INTELLIGENCE (Pass 7) ---\n${geospatialAnalysis}\n` : ''}
${survivorshipBiasAnalysis ? `--- SURVIVORSHIP BIAS AUDIT (Pass 8) ---\n${survivorshipBiasAnalysis}\n` : ''}
${sentimentVelocityAnalysis ? `--- SENTIMENT VELOCITY ANALYSIS (Pass 9) ---\n${sentimentVelocityAnalysis}\n` : ''}
${networkCentralityAnalysis ? `--- NETWORK CENTRALITY SCORECARD (Pass 10) ---\n${networkCentralityAnalysis}\n` : ''}
${bayesianConfidenceAnalysis ? `--- BAYESIAN CONFIDENCE CHAIN (Pass 11) ---\n${bayesianConfidenceAnalysis}\n` : ''}
` : '';

    const pass2Prompt = `
USER QUERY: "${lastUserMessage}"

${provenanceReport}
${entitySummary}
${behavioralSection}
${oceanSection}
${benfordSection}
${singleSourceSection}
${crossInvestigationLinks}

${esrcReport}

CLUSTERED INTELLIGENCE SUMMARIES (from Pass 1 analysis):
${pass1Result || 'Pass 1 analysis unavailable — use raw data below.'}
${deepAnalysisSection}

RAW INTELLIGENCE DATA:
${intelSections || 'No intelligence gathered.'}
${publicRecordLinks}
${priorInvestigationContext}
${vaultPriorContext}

INSTRUCTIONS:
Produce a NOMAD v8.0 response following the mandatory output format. Include:
1. Temporal mermaid digraph with PROPER topology (not star graph — use clusters, bridges, isolated nodes)
2. Tiered intelligence (Confirmed → Probable → Unverified)
3. Bayesian Confidence Chain — top 10 claims with prior/posterior, highlight most dangerous assumption
4. OCEAN behavioral profile with deception indicators and predicted actions
5. Linguistic Fingerprint section (if analysis provided) — TTR, pronoun drops, tense forensics, deception map
6. Social Avatar Profile (if analysis provided) — Dark Triad score, attachment style, predictions
7. Relationship Velocity Map (if analysis provided) — formation speeds, termination patterns, cluster migration
8. Narrative Integrity Audit (if analysis provided) — Stated Self vs Evidenced Self DELTA
9. Identity Continuity (if analysis provided) — cross-platform links, sock puppets, real vs curated persona
10. Geospatial Intelligence (if analysis provided) — shadow locations, migration triggers, jurisdiction risk
11. Sentiment Velocity (if analysis provided) — inflection points, divergence, acceleration
12. Network Centrality Scorecard (if analysis provided) — hidden brokers, structural holes, bridge nodes
13. Survivorship Bias Audit (if analysis provided) — expected vs present artifacts, suppression indicators
14. Dead Ends & Intelligence Gaps (what's MISSING is critical intelligence)
15. Cross-Investigation Links if entity overlaps were found
16. Benford analysis results if financial data was flagged
17. Single-source warnings inline with ⚠️ markers
18. If PRIOR INVESTIGATION data was provided: produce a DIFFERENTIAL ANALYSIS section showing what is NEW, what CHANGED, what DISAPPEARED since last investigation. Disappearing entities are the most critical signal.
19. Include source telemetry summary — which sources fired successfully vs failed
Be direct, intelligence-grade. Include BT confidence inline.`;

    console.log('NOMAD v8.0: Starting Final Synthesis Pass...');
    
    // Build conversation history for memory continuity
    const conversationHistory: { role: string; parts: { text: string }[] }[] = [
      { role: 'user', parts: [{ text: NOMAD_SYSTEM_PROMPT }] },
    ];

    const priorMessages = messages.slice(0, -1);
    if (priorMessages.length > 0) {
      const recentHistory = priorMessages.slice(-20);
      const historyBlock = recentHistory.map((m: { role: string; content: string }) => 
        `[${m.role.toUpperCase()}]: ${m.content.slice(0, 2000)}`
      ).join('\n\n');
      conversationHistory.push({
        role: 'user',
        parts: [{ text: `═══ CONVERSATION HISTORY ═══\n${historyBlock}\n═══ END ═══` }],
      });
      conversationHistory.push({
        role: 'model',
        parts: [{ text: 'Context loaded. Maintaining continuity.' }],
      });
    }

    conversationHistory.push({ role: 'user', parts: [{ text: pass2Prompt }] });

    let aiText = "NOMAD could not generate a report.";
    const MAX_RETRIES = 4;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: conversationHistory,
          generationConfig: { temperature: 0.2, maxOutputTokens: 16000 },
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || aiText;
        break;
      }

      if (resp.status === 429 && attempt < MAX_RETRIES - 1) {
        const baseDelay = Math.pow(2, attempt + 1) * 1000;
        const jitter = Math.random() * 1000;
        console.log(`NOMAD: Rate limited (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${Math.round((baseDelay + jitter) / 1000)}s...`);
        await new Promise(r => setTimeout(r, baseDelay + jitter));
        continue;
      }

      const err = await resp.text();
      console.error('Gemini API Error:', err);
      if (resp.status === 429) throw new Error('Rate limit exceeded. Please wait a moment and try again.');
      throw new Error(`AI generation failed (${resp.status})`);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // POST-SYNTHESIS: RED TEAM ADVERSARIAL REVIEW (Pass 13)
    // ══════════════════════════════════════════════════════════════════════════
    
    if (isPersonInvestigation && aiText.length > 500) {
      console.log('NOMAD v8.0: Starting Red Team Protocol (Pass 13)...');
      
      redTeamAnalysis = await aiPass(GEMINI_API_KEY, 
        'You are the target\'s defense attorney. Your job is to DESTROY every finding in this dossier. You are hostile, adversarial, and forensically precise. Output structured challenge report only.',
        `You have just received this intelligence dossier. Run the RED TEAM PROTOCOL.

Switch roles. You are NOT the analyst. You are the TARGET'S DEFENSE ATTORNEY. Destroy every finding.

RED TEAM CHALLENGE PROTOCOL:

1. ATTACK THE SOURCES — Which findings rely on a SINGLE source? Which sources have known bias/inaccuracy/SEO manipulation? (Spokeo = inaccurate. Reddit = anonymous. LinkedIn = self-reported.) Could ANY finding be explained by a DIFFERENT person with similar name? (False attribution = #1 OSINT error.)

2. ATTACK THE TIMELINE — Alternative explanations for every dark period? Gap in 2020 = COVID. Gap in 2008 = financial crisis. Don't assume malice when circumstance explains it. Which conclusions REQUIRE specific interpretation when equally valid alternatives exist?

3. ATTACK THE BEHAVIORAL PROFILE — Every OCEAN score, Dark Triad assessment, deception indicator is INFERENCE not FACT. What would the profile look like under most charitable interpretation?

4. ATTACK THE CONFIDENCE SCORES — Which high-confidence (>80%) findings are built on chains of low-confidence inferences? Chain of 4x 80% inferences = 0.8^4 = 41% actual confidence. Flag these chains.

5. IDENTIFY THE SINGLE MOST DANGEROUS ASSUMPTION — The ONE assumption that, if wrong, collapses the most conclusions. This is the dossier's critical vulnerability.

Output: RED TEAM REPORT with challenged findings and severity, the single most dangerous assumption, and REVISED CONFIDENCE DISTRIBUTION.

DOSSIER TO CHALLENGE:
${aiText.slice(0, 8000)}`, 'gemini-flash-latest', 2500, 0.2);

      if (redTeamAnalysis) {
        aiText += `\n\n---\n\n## ADVERSARIAL REVIEW — RED TEAM FINDINGS\n\n${redTeamAnalysis}`;
        console.log(`NOMAD v8.0: Red Team analysis complete — ${redTeamAnalysis.length} chars`);
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // POST-SYNTHESIS: ACTIONABLE INTELLIGENCE MODULE (Gap 7)
    // ══════════════════════════════════════════════════════════════════════════
    
    if (isPersonInvestigation && aiText.length > 500) {
      console.log('NOMAD v9.0: Starting Actionable Intelligence Pass...');
      const actionableIntel = await aiPass(GEMINI_API_KEY,
        'You are a strategic intelligence advisor. Produce decision-support output, not more data. Output structured actionable guidance only.',
        `Based on this completed intelligence dossier, produce the ACTIONABLE INTELLIGENCE LAYER.

This section is NOT more data. It is decision support.

DUE DILIGENCE USE CASE:
- Top 3 specific questions to ask this person based on gaps/inconsistencies found
- Top 3 documents to request for verification
- Single biggest risk factor as a decision trigger

NEGOTIATION USE CASE:
- Primary decision-making driver based on behavioral profile
- Most effective proposal framing
- Most likely objection and pressure point

RISK ASSESSMENT USE CASE:
- Probability of material misrepresentation: [%] with evidence
- Probability of undisclosed legal exposure: [%] with evidence
- Priority verification steps

MONITORING TRIGGERS:
- Specific future events that would change this assessment
- Recommended search alerts / monitoring keywords

DOSSIER:
${aiText.slice(0, 6000)}`, 'gemini-flash-latest', 2000, 0.2);

      if (actionableIntel) {
        aiText += `\n\n---\n\n## ACTIONABLE INTELLIGENCE — DECISION SUPPORT\n\n${actionableIntel}`;
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PIVOT SUGGESTIONS — Identify high-value secondary targets (Gap 2)
    // ══════════════════════════════════════════════════════════════════════════
    
    const pivotSuggestions: any[] = [];
    const entityCounts: Record<string, { count: number; type: string; sources: string[] }> = {};
    for (const node of nodes) {
      for (const entity of node.entities || []) {
        const key = entity.value.toLowerCase().trim();
        if (!entityCounts[key]) entityCounts[key] = { count: 0, type: entity.type, sources: [] };
        entityCounts[key].count++;
        if (!entityCounts[key].sources.includes(node.source)) entityCounts[key].sources.push(node.source);
      }
    }
    // Identify entities appearing in 3+ sources that aren't the primary target
    const cleanedQuery = lastUserMessage.toLowerCase().replace(/investigate|person|company|research|find|who is|look up|about|search/gi, '').trim();
    Object.entries(entityCounts)
      .filter(([key, data]) => data.count >= 3 && !cleanedQuery.includes(key) && data.type !== 'date' && data.type !== 'url')
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .forEach(([key, data]) => {
        pivotSuggestions.push({
          name: key,
          type: data.type,
          appearances: data.count,
          sources: data.sources.length,
          pivot_query: `Investigate ${data.type}: ${key}`,
          reason: `Appears in ${data.count} data points across ${data.sources.length} sources`,
        });
      });

    // ── Source Telemetry Summary for dossier ──
    const telemetrySummary = sourceTelemetry.length > 0
      ? `\n\n## SOURCE TELEMETRY\n\n| Source | Status | Time (ms) | Results | Entities |\n|--------|--------|-----------|---------|----------|\n` +
        sourceTelemetry.slice(0, 20).map((t: any) => 
          `| ${t.source_name?.slice(0, 30)} | ${t.status} | ${t.response_time_ms} | ${t.result_count} | ${t.entity_yield} |`
        ).join('\n')
      : '';
    
    aiText += telemetrySummary;

    // 4. Await collected images
    const collectedImages = await imagePromise;

    // ══════════════════════════════════════════════════════════════════════════
    // PERSIST: Save investigation with full context (Gap 1, 4, 8)
    // ══════════════════════════════════════════════════════════════════════════
    
    if (userId && SUPABASE_URL && SUPABASE_KEY) {
      try {
        // Save source telemetry
        const telemetryInserts = sourceTelemetry.slice(0, 50).map((t: any) => ({
          user_id: userId,
          source_name: t.source_name,
          response_time_ms: t.response_time_ms,
          status: t.status,
          result_count: t.result_count,
          entity_yield: t.entity_yield,
        }));
        if (telemetryInserts.length > 0) {
          fetch(`${SUPABASE_URL}/rest/v1/nomad_source_telemetry`, {
            method: 'POST',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(telemetryInserts),
          }).catch(err => console.error('Telemetry insert error:', err));
        }
      } catch (err) { console.error('Post-investigation persistence error:', err); }
    }

    // 5. STREAM RESPONSE with metadata
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        // Main dossier content
        const chunk = { choices: [{ delta: { content: aiText } }] };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        // Images
        if (collectedImages.length > 0) {
          const imgChunk = { type: 'images', images: collectedImages };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(imgChunk)}\n\n`));
        }
        // Pivot suggestions (Gap 2)
        if (pivotSuggestions.length > 0) {
          const pivotChunk = { type: 'pivot_suggestions', entities: pivotSuggestions };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(pivotChunk)}\n\n`));
        }
        // Source telemetry (Gap 4)
        if (sourceTelemetry.length > 0) {
          const telemetryChunk = { type: 'source_telemetry', telemetry: sourceTelemetry };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(telemetryChunk)}\n\n`));
        }
        // Subject fingerprint for diff tracking (Gap 8)
        const metaChunk = { type: 'investigation_meta', subjectFingerprint, priorInvestigationCount: priorFindings ? 1 : 0 };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(metaChunk)}\n\n`));
        
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });

  } catch (e) {
    console.error('NOMAD Error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
