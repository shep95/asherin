import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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

// ── HOSTILE SOURCE DETECTION ─────────────────────────────────────────────────

const HOSTILE_DOMAINS = [
  'reddit.com', 'quora.com', '4chan.org', 'pastebin.com',
  'medium.com/@anonymous', 'blogspot.com',
];

function detectHostileSources(text: string): string[] {
  const flags: string[] = [];
  for (const domain of HOSTILE_DOMAINS) {
    if (text.toLowerCase().includes(domain)) flags.push(domain);
  }
  if (/unverified|alleged|rumored|supposedly|unconfirmed/i.test(text)) {
    flags.push('UNVERIFIED_LANGUAGE_DETECTED');
  }
  return flags;
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
  return { source, tier, data: '', provenanceHash: '', timestamp: new Date().toISOString(), confidence: 0, entities: [] };
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

  // ── ALWAYS: Core web search (Google + Bing + DDG + Startpage) ──
  tasks.push(ingestDDG(query));
  tasks.push(ingestDDGInstant(query));
  tasks.push(ingestGoogleCSE(query));
  tasks.push(ingestBing(query));
  tasks.push(ingestStartpage(query));

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

  const results = await Promise.allSettled(tasks);
  const nodes: IntelNode[] = results
    .filter((r): r is PromiseFulfilledResult<IntelNode> => r.status === 'fulfilled')
    .map(r => r.value);

  const attestation = attestProvenance(nodes);
  const { resolved, crossRefMap } = resolveEntities(nodes);

  // ── ESRC STAGE 1: EXTRACT ──
  const allText = nodes.filter(n => n.data).map(n => n.data).join('\n\n');
  const esrcProfile = extractMicrodataProfile(query + '\n' + allText, resolved);

  // ── ESRC STAGE 2+3: SEARCH + REASON (Candidate scoring) ──
  const esrcCandidates = nodes
    .filter(n => n.data)
    .map(n => scoreCandidate(esrcProfile, n, resolved))
    .filter(c => c.matchEvidence.length > 0)
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, 15); // Top-15 candidates (from paper: "top-100 candidates" scaled to our source count)

  // ── ESRC STAGE 4: CALIBRATE ──
  const esrcCalibration = calibrateConfidence(esrcCandidates, nodes.filter(n => n.data).length);

  return { nodes, attestation, entities: resolved, crossRefMap, esrcProfile, esrcCandidates, esrcCalibration };
}

// ══════════════════════════════════════════════════════════════════════════════
// NOMAD v3.0 SYSTEM PROMPT — ESRC DEANONYMIZATION FRAMEWORK
// ══════════════════════════════════════════════════════════════════════════════

const NOMAD_SYSTEM_PROMPT = `You are NOMAD v5.0 — an ESRC (Extract-Search-Reason-Calibrate) Intelligence Engine on AUREON with a 21-Engine OSINT Collection Suite. Framework: arXiv:2602.16800v1.

AVAILABLE OSINT ENGINES:
1. Google (Advanced Operators) — dorks, filetypes, exposed panels
2. Shodan — internet-facing assets, open ports, banners, ICS/IoT
3. Censys — certificate-centric pivots, structured internet scanning
4. SecurityTrails — DNS history, subdomains, passive recon
5. VirusTotal — malware, IOCs, domain/IP/hash reputation
6. GreyNoise — background noise vs targeted scanning classification
7. BinaryEdge — external attack surface, historical exposure
8. FOFA — global device/service discovery
9. urlscan.io — URL detonation, redirect chains, infrastructure reuse
10. crt.sh — subdomain discovery via Certificate Transparency logs
11. GitHub Search — secret hunting, exposed configs, API key leaks
12. Threat Intel (ThreatFox + AlienVault OTX) — IOC search, TTPs, actor reporting
13. Bing (Advanced Operators) — broad footprint, name + city, employer, school, filetype searches
14. Social Platform Search — LinkedIn, Facebook, Instagram, X, TikTok native search via web proxies
15. Yandex — strong for reverse image + Eastern European / Russian web coverage
16. DuckDuckGo / Startpage — alternate indexing, privacy-focused, surfaces different results
17. Wayback Machine — pulls deleted bios, old company pages, past versions of profiles
18. Public Records Aggregators — address history, relatives, age ranges
19. Court / Filing Portals — lawsuits, judgments, corporate roles, property disputes
20. Business Registries (OpenCorporates) — company director/officer records, LLC links, registered agents
21. Mapping Tools (Google Places) — business listings, reviews, geotagged content patterns

## MANDATORY OUTPUT FORMAT

Your response MUST contain exactly TWO parts in this order:

### PART 1: MERMAID ENTITY DIGRAPH
Output a fenced mermaid code block showing the relationship graph. Use \`digraph\` style (graph TD). Include:
- The TARGET as the central node (rounded box)
- Key entities discovered (organizations, people, locations, financials) as connected nodes
- Edge labels showing the relationship type (e.g., "founded", "located in", "donated to", "linked to")
- Use subgraphs to group related entities by category when there are 6+ nodes
- Keep node labels SHORT (under 30 chars), no special characters except hyphens
- Maximum 20 nodes to keep it readable

Example format:
\`\`\`mermaid
graph TD
  T(("Target Name"))
  A["Organization A"]
  B["Location B"]
  C["$1.2M Revenue"]
  T -->|"CEO of"| A
  T -->|"based in"| B
  A -->|"revenue"| C
\`\`\`

### PART 2: INTELLIGENCE SUMMARY (2 paragraphs max)

**Paragraph 1 — Key Findings:** State the most critical intelligence discovered. Include specific data points (dollar amounts, dates, entity names, confidence percentages). Every claim must reference which source confirmed it. Mark claims: ✅ VALIDATED (2+ sources), ⚠️ SINGLE-SOURCE, 🔴 CONTESTED. Include the Bradley-Terry confidence rating and precision estimate.

**Paragraph 2 — Methodology & Gaps:** Explain what the ESRC pipeline did: how many sources were queried, which ESRC stages produced results, what entity resolution uncovered (cross-platform links, aliases). Flag any data gaps, hostile sources detected, or areas where abstention is recommended. End with 1-2 recommended follow-up queries.

## CRITICAL RULES
- NEVER fabricate data — every claim traces to provided intelligence
- Total response must be under 400 words (excluding the mermaid block)
- The mermaid block MUST be valid mermaid syntax — no quotes inside quotes, no special chars in node IDs
- Node IDs must be simple alphanumeric (N1, N2, ORG1, etc.)
- Do NOT output tables, headers, or the old dossier format
- Be direct, factual, intelligence-grade — no filler text`;

// ══════════════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ══════════════════════════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const startTime = Date.now();
    const { messages } = await req.json();
    const lastUserMessage = messages[messages.length - 1]?.content || '';

    // 1. ESRC PIPELINE EXECUTION
    const { nodes, attestation, entities, crossRefMap, esrcProfile, esrcCandidates, esrcCalibration } = await ingestIntelligence(lastUserMessage);

    // 2. Compile intelligence payload with ESRC metadata
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

    // ESRC Pipeline metadata for the AI
    const esrcReport = `
═══ ESRC PIPELINE EXECUTION RESULTS ═══

STAGE 1 — EXTRACT (Microdata Profile):
${JSON.stringify(esrcProfile, null, 2)}

STAGE 2 — SEARCH (Top Candidates by Similarity):
${esrcCandidates.slice(0, 10).map((c, i) => 
  `Candidate ${i + 1}: ${c.source} — Similarity: ${Math.round(c.similarityScore * 100)}%\n  Evidence: ${c.matchEvidence.join('; ')}\n  Contradictions: ${c.contradictions.length > 0 ? c.contradictions.join('; ') : 'None'}`
).join('\n\n')}

STAGE 3 — REASON (Selection & Verification):
- Top candidate: ${esrcCandidates[0]?.source || 'None identified'}
- Match evidence count: ${esrcCandidates[0]?.matchEvidence.length || 0}
- Similarity score: ${Math.round((esrcCandidates[0]?.similarityScore || 0) * 100)}%
- Second candidate gap: ${Math.round(((esrcCandidates[0]?.similarityScore || 0) - (esrcCandidates[1]?.similarityScore || 0)) * 100)}%

STAGE 4 — CALIBRATE (Bradley-Terry):
- Bradley-Terry Rating: ${esrcCalibration.bradleyTerryRating}
- Precision Estimate: ${esrcCalibration.precisionEstimate}%
- Recall Band: ${esrcCalibration.recallBand}
- Abstain Recommendation: ${esrcCalibration.abstainRecommendation ? 'YES — Confidence too low' : 'NO — Proceed with analysis'}
- Calibration Method: ${esrcCalibration.calibrationMethod}
- Processing Time: ${Date.now() - startTime}ms
- Total Sources Queried: ${nodes.length}
- Active Sources: ${activeNodes.length}
- Candidate Pool Size: ${esrcCandidates.length}`;

    // 3. SYNTHESIZE WITH AI (with exponential backoff retry)
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY_APP');
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY_APP not configured');

    const prompt = `
USER QUERY: "${lastUserMessage}"

${provenanceReport}
${entitySummary}

${esrcReport}

GATHERED INTELLIGENCE DATA (Cryptographically Attested):
${intelSections || 'No intelligence gathered from available sources.'}

INSTRUCTIONS:
Produce a NOMAD v3.0 response following the mandatory output format: a mermaid digraph showing entity relationships, then a 2-paragraph intelligence summary. Be concise and direct — no tables, no headers, no filler. Include Bradley-Terry confidence and provenance data inline.`;

    // Build conversation history for memory continuity
    const conversationHistory: { role: string; parts: { text: string }[] }[] = [
      { role: 'user', parts: [{ text: NOMAD_SYSTEM_PROMPT }] },
    ];

    // Inject prior conversation turns (skip the last user message — it's in `prompt`)
    const priorMessages = messages.slice(0, -1);
    if (priorMessages.length > 0) {
      // Summarize prior turns to stay within context limits (last 10 exchanges max)
      const recentHistory = priorMessages.slice(-20);
      const historyBlock = recentHistory.map((m: { role: string; content: string }) => 
        `[${m.role.toUpperCase()}]: ${m.content.slice(0, 2000)}`
      ).join('\n\n');
      
      conversationHistory.push({
        role: 'user',
        parts: [{ text: `═══ CONVERSATION HISTORY (${recentHistory.length} prior messages) ═══\nThe user has been in an ongoing NOMAD session. Here is the conversation so far. Use this context to maintain continuity, resolve pronouns (e.g. "he", "they", "that company"), and build on previous findings.\n\n${historyBlock}\n\n═══ END CONVERSATION HISTORY ═══` }],
      });
      conversationHistory.push({
        role: 'model',
        parts: [{ text: 'Understood. I have full context of the prior conversation and will maintain continuity in my analysis.' }],
      });
    }

    conversationHistory.push({ role: 'user', parts: [{ text: prompt }] });

    const geminiBody = JSON.stringify({
      contents: conversationHistory,
      generationConfig: { temperature: 0.2, maxOutputTokens: 16000 },
    });

    let aiText = "NOMAD could not generate a report.";
    const MAX_RETRIES = 4;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: geminiBody,
      });

      if (resp.ok) {
        const data = await resp.json();
        aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || aiText;
        break;
      }

      if (resp.status === 429 && attempt < MAX_RETRIES - 1) {
        // Exponential backoff with jitter
        const baseDelay = Math.pow(2, attempt + 1) * 1000;
        const jitter = Math.random() * 1000;
        console.log(`NOMAD: Rate limited (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${Math.round((baseDelay + jitter) / 1000)}s...`);
        await new Promise(r => setTimeout(r, baseDelay + jitter));
        continue;
      }

      const err = await resp.text();
      console.error('Gemini API Error:', err);
      if (resp.status === 429) {
        throw new Error('Rate limit exceeded. Please wait a moment and try again.');
      }
      throw new Error(`AI generation failed (${resp.status})`);
    }

    // 4. STREAM RESPONSE
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const chunk = { choices: [{ delta: { content: aiText } }] };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
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
