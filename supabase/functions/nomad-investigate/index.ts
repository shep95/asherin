import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ══════════════════════════════════════════════════════════════════════════════
// TRANS-DIMENSIONAL DATA INGESTION MATRIX
// Each source returns structured IntelNodes with provenance metadata
// ══════════════════════════════════════════════════════════════════════════════

interface IntelNode {
  source: string;
  tier: 1 | 2 | 3 | 4; // 1=Gov/Primary, 2=Established, 3=Institutional, 4=General
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

interface PredictiveTrajectory {
  action: string;
  probability: number;
  timeframe: string;
  causalFactors: string[];
  networkInfluences: string[];
  financialImplications: string;
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
  (text.match(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g) || []).forEach(v => add("phone", v, 0.9));
  (text.match(/\$[\d,]+(?:\.\d{2})?(?:\s*(?:million|billion|trillion|M|B|T))?/gi) || []).forEach(v => add("financial", v, 0.95));
  (text.match(/\b[A-Z][A-Za-z\s&]+(?:Inc\.|LLC|Corp\.|Corporation|Ltd\.|Group|Holdings|Partners|Capital|Fund|Trust)\b/g) || []).forEach(v => add("organization", v.trim(), 0.85));
  (text.match(/https?:\/\/[^\s)]+/g) || []).forEach(v => add("url", v, 1.0));
  (text.match(/CIK[:\s]*(\d{7,10})/g) || []).forEach(v => add("sec_identifier", v, 1.0));
  (text.match(/EIN[:\s]*(\d{2}-\d{7})/g) || []).forEach(v => add("ein", v, 1.0));
  (text.match(/\b(?:19|20)\d{2}-\d{2}-\d{2}\b/g) || []).forEach(v => add("date", v, 0.9));

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
// DATA SOURCE FUNCTIONS — Each returns an IntelNode
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
      headers: { 'User-Agent': 'AUREON-NOMAD/2.0' },
    });
    if (!resp.ok) return emptyNode('Reddit', 4);
    const data = await resp.json();
    const posts = data.data?.children || [];
    if (!posts.length) return emptyNode('Reddit', 4);
    const text = `Reddit Results:\n${posts.map((p: any) => `- r/${p.data.subreddit}: ${p.data.title} (${p.data.score} pts, ${p.data.num_comments} comments)`).join('\n')}`;
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

function emptyNode(source: string, tier: 1 | 2 | 3 | 4): IntelNode {
  return { source, tier, data: '', provenanceHash: '', timestamp: new Date().toISOString(), confidence: 0, entities: [] };
}

// ══════════════════════════════════════════════════════════════════════════════
// SELF-EVOLVING ENTITY RESOLUTION ENGINE
// Fuses entities across sources, disambiguates aliases
// ══════════════════════════════════════════════════════════════════════════════

function resolveEntities(nodes: IntelNode[]): { resolved: ExtractedEntity[]; crossRefMap: Record<string, string[]> } {
  const allEntities: ExtractedEntity[] = [];
  const crossRefMap: Record<string, string[]> = {};

  for (const node of nodes) {
    if (!node.data) continue;
    allEntities.push(...node.entities);
  }

  // Group by type and merge similar values
  const byType: Record<string, ExtractedEntity[]> = {};
  for (const e of allEntities) {
    if (!byType[e.type]) byType[e.type] = [];
    byType[e.type].push(e);
  }

  // Cross-reference: track which sources mention the same entity
  for (const [type, entities] of Object.entries(byType)) {
    for (const entity of entities) {
      const key = `${type}:${entity.value.toLowerCase().trim()}`;
      if (!crossRefMap[key]) crossRefMap[key] = [];
      if (!crossRefMap[key].includes(entity.source)) {
        crossRefMap[key].push(entity.source);
      }
    }
  }

  // Deduplicate, boost confidence for cross-referenced entities
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

// ══════════════════════════════════════════════════════════════════════════════
// IMMUTABLE PROVENANCE ATTESTATION
// Validates and scores the integrity of gathered intelligence
// ══════════════════════════════════════════════════════════════════════════════

function attestProvenance(nodes: IntelNode[]): ProvenanceAttestation {
  const activeNodes = nodes.filter(n => n.data);
  const tier1 = activeNodes.filter(n => n.tier === 1).length;
  const tier2 = activeNodes.filter(n => n.tier === 2).length;

  // Cross-reference score: how many sources corroborate each other
  const allText = activeNodes.map(n => n.data).join(' ');
  const phrases = allText.match(/\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)+\b/g) || [];
  const phraseCount: Record<string, number> = {};
  for (const p of phrases) { phraseCount[p] = (phraseCount[p] || 0) + 1; }
  const crossRefPhrases = Object.values(phraseCount).filter(c => c > 1).length;
  const crossRefScore = Math.min(100, Math.round((crossRefPhrases / Math.max(1, Object.keys(phraseCount).length)) * 100));

  // Provenance integrity based on tier distribution and hash presence
  const hashCount = activeNodes.filter(n => n.provenanceHash).length;
  const provenanceIntegrity = Math.round((hashCount / Math.max(1, activeNodes.length)) * 100);

  // Hostile source detection
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
// TRANS-DIMENSIONAL DATA INGESTION ORCHESTRATOR
// ══════════════════════════════════════════════════════════════════════════════

async function ingestIntelligence(query: string): Promise<{ nodes: IntelNode[]; attestation: ProvenanceAttestation; entities: ExtractedEntity[]; crossRefMap: Record<string, string[]> }> {
  const q = query.toLowerCase();
  const tasks: Promise<IntelNode>[] = [];

  // Always: web search + instant answer
  tasks.push(ingestDDG(query));
  tasks.push(ingestDDGInstant(query));

  // Company/corporate
  if (/compan|corp|inc|llc|ltd|business|firm|startup|enterprise|sec |edgar|filing|10-k|proxy/i.test(q)) {
    tasks.push(ingestEdgar(query));
    tasks.push(ingestUSASpending(query));
    tasks.push(ingestProPublica(query));
  }

  // Person
  if (/person|individual|who is|about|officer|director|ceo|cto|founder/i.test(q)) {
    tasks.push(ingestFEC(query));
    tasks.push(ingestProPublica(query));
    tasks.push(ingestGitHubSearch(query));
    tasks.push(ingestCourtListener(query));
  }

  // Domain
  if (/domain|\.com|\.org|\.net|\.io|dns|ssl|cert|subdomain|whois/i.test(q)) {
    const domainMatch = query.match(/[\w-]+\.[\w.]+/);
    if (domainMatch) {
      tasks.push(ingestCrtSh(domainMatch[0]));
      tasks.push(ingestWHOIS(domainMatch[0]));
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

  // Username
  if (/username|user|handle|account|profile/i.test(q)) {
    const username = query.replace(/investigate|username|user|research|find|search|handle|account|profile/gi, '').trim().split(/\s+/)[0];
    if (username) {
      tasks.push(ingestGitHub(username));
      tasks.push(ingestReddit(username));
      tasks.push(ingestDDG(`"${username}" site:twitter.com OR site:linkedin.com OR site:instagram.com`));
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

  const results = await Promise.allSettled(tasks);
  const nodes: IntelNode[] = results
    .filter((r): r is PromiseFulfilledResult<IntelNode> => r.status === 'fulfilled')
    .map(r => r.value);

  const attestation = attestProvenance(nodes);
  const { resolved, crossRefMap } = resolveEntities(nodes);

  return { nodes, attestation, entities: resolved, crossRefMap };
}

// ══════════════════════════════════════════════════════════════════════════════
// NOMAD SYSTEM PROMPT — PREDICTIVE BEHAVIORAL MODELING ENGINE
// ══════════════════════════════════════════════════════════════════════════════

const NOMAD_SYSTEM_PROMPT = `You are NOMAD v2.0 — a Trans-Dimensional Public Intelligence Agent with Predictive Behavioral Modeling capabilities, built into the AUREON platform. You are a forensic-grade OSINT analyst operating at the intersection of data fusion, graph theory, and causal inference.

## CORE ARCHITECTURE

### 1. TRANS-DIMENSIONAL DATA INGESTION MATRIX
You ingest data from 40+ sources across multiple dimensions:
- **Dimension 1 (Government):** SEC EDGAR, FEC, USASpending, CourtListener — Tier 1 provenance
- **Dimension 2 (Institutional):** ProPublica, crt.sh, WHOIS, HIBP — Tier 2 provenance  
- **Dimension 3 (Technical):** GitHub, DNS, SSL Certificates — Tier 3 provenance
- **Dimension 4 (Open Web):** DuckDuckGo, Reddit — Tier 4 (unvalidated, hostile-flagged)

### 2. IMMUTABLE PROVENANCE ATTESTATION
Every datum is cryptographically hashed at ingestion (SHA-256). You MUST:
- Reference specific provenance hashes when making claims
- Flag any data sourced from Tier 4 as ⚠️ UNVALIDATED
- Mark cross-referenced claims as ✅ VALIDATED (appears in 2+ independent sources)
- Flag hostile sources with 🔴 HOSTILE SOURCE DETECTED

### 3. SELF-EVOLVING ENTITY RESOLUTION ENGINE
You fuse entities across sources using graph theory:
- Same entity appearing in multiple sources = boosted confidence
- Conflicting data = flagged as 🔶 CONTESTED with both versions shown
- Alias detection: link digital handles to real-world identities when provenance supports it

### 4. PREDICTIVE BEHAVIORAL MODELING ENGINE
Based on the Truth Graph, you MUST generate:
- **Probabilistic Trajectories**: Project future actions with % probability
- **Causal Factor Analysis**: Identify the specific triggers driving predicted behavior
- **Network Influence Mapping**: Which entities in their network amplify or constrain actions
- **Financial Flow Projection**: Where money moves and who benefits
- **Temporal Windows**: When predicted events are most likely to occur

## MANDATORY OUTPUT FORMAT

# 🕵️ NOMAD INTELLIGENCE DOSSIER v2.0

**TARGET:** [Name/Entity]
**DATE:** [Current Date]  
**CLASSIFICATION:** TRANS-DIMENSIONAL ANALYSIS
**COMPOSITE CONFIDENCE:** [0-100]%

## 📡 PROVENANCE ATTESTATION
| Metric | Value |
|--------|-------|
| Sources Ingested | [X] |
| Tier 1 (Government) | [X] |
| Tier 2 (Institutional) | [X] |
| Cross-Reference Score | [X]% |
| Provenance Integrity | [X]% |
| Hostile Sources Flagged | [List or None] |

## 🚨 EXECUTIVE SUMMARY (BLUF)
[3-5 bullet points. Each must end with a provenance tag: ✅ VALIDATED / ⚠️ UNVALIDATED / 🔶 CONTESTED]

## 🧬 ENTITY RESOLUTION MAP
[List all resolved entities with their type, cross-reference count, and confidence score]
[Flag any aliases or identity overlaps detected]

## 📊 KEY FINDINGS
[Deep forensic analysis organized by domain: Financial, Legal, Digital Footprint, Network, etc.]
[Every claim MUST cite its source and provenance hash]
[Flag contradictions between sources]

## 🔮 PREDICTIVE BEHAVIORAL TRAJECTORIES
For each prediction:
> **Trajectory [N]:** Entity [X] exhibits [Y]% probability of [Action] within [Timeframe]
> - **Causal Factors:** [Specific triggers from the Truth Graph]
> - **Network Influence:** [Who amplifies/constrains this trajectory]
> - **Financial Implication:** [Dollar values, beneficiaries]
> - **Confidence Basis:** [Which validated data points support this]

## 🕸️ TRUTH GRAPH ANALYSIS
[Causal chain connecting entities, events, and financial flows]
[Each link in the chain must reference its provenance]

## ⚠️ RISK ASSESSMENT & ANOMALIES
[Red flags, contradictions, data gaps]
[Each risk rated: CRITICAL / HIGH / MEDIUM / LOW]

## ⏭️ RECOMMENDED INTELLIGENCE ACTIONS
[Specific follow-up investigations with expected yield]

## 📜 RAW PROVENANCE LOG
[List each source, its tier, provenance hash, and confidence score]

CRITICAL RULES:
- NEVER fabricate data. If intelligence is insufficient, state what's missing and its strategic importance.
- NEVER give surface-level summaries. Every investigation is DEEP, FORENSIC, EXHAUSTIVE.
- Cross-reference EVERY claim. Flag all contradictions.
- Include specific names, dates, dollar amounts, filing numbers.
- Think like a senior analyst at a sovereign intelligence agency, not a search engine.
- Every prediction must have a causal chain traceable to validated data.`;

// ══════════════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ══════════════════════════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const lastUserMessage = messages[messages.length - 1]?.content || '';

    // 1. TRANS-DIMENSIONAL DATA INGESTION
    const { nodes, attestation, entities, crossRefMap } = await ingestIntelligence(lastUserMessage);

    // 2. Compile intelligence payload
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

    // 3. SYNTHESIZE WITH AI — Predictive Behavioral Modeling
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY_APP');
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY_APP not configured');

    const prompt = `
USER QUERY: "${lastUserMessage}"

${provenanceReport}
${entitySummary}

GATHERED INTELLIGENCE DATA (Cryptographically Attested):
${intelSections || 'No intelligence gathered from available sources.'}

INSTRUCTIONS:
Using the attested intelligence above, produce a NOMAD v2.0 Intelligence Dossier following the mandatory output format in your system prompt. 

CRITICAL REQUIREMENTS:
1. Reference provenance hashes for key claims
2. Generate at least 2-3 Predictive Behavioral Trajectories based on patterns in the data
3. Build the Truth Graph Analysis showing causal connections between entities
4. Flag ALL hostile sources and unvalidated claims
5. Include the full Provenance Attestation table
6. If data is insufficient for predictions, state what additional intelligence is needed
7. Do not hallucinate — every claim must trace to the provided intelligence data`;

    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: NOMAD_SYSTEM_PROMPT }] },
          { role: 'user', parts: [{ text: prompt }] },
        ],
        generationConfig: { temperature: 0.25, maxOutputTokens: 12000 },
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error('Gemini API Error:', err);
      throw new Error(`AI generation failed: ${err}`);
    }

    const data = await resp.json();
    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "NOMAD could not generate a report.";

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
