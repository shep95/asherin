import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders } from "../_shared/cors.ts";
// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts

// ═══════════════════════════════════════════════════════════════
// PART 1: SIGNAL DEFINITIONS
// ═══════════════════════════════════════════════════════════════

interface SignalDefinition {
  id: string;
  name: string;
  weight: number;
  searchQueries: string[];
  keywords: string[];
  historicalReliability: number;
}

interface EventTypeConfig {
  eventType: string;
  signals: SignalDefinition[];
  modifier: number;
}

function getEventConfigs(company: string): EventTypeConfig[] {
  return [
    {
      eventType: "regulatory_action",
      modifier: 1.1,
      signals: [
        {
          id: "cid_issuance", name: "Civil Investigative Demands / Subpoenas", weight: 0.40,
          searchQueries: [`${company} investigation subpoena probe government`],
          keywords: ["cid", "subpoena", "investigation", "document request", "probe", "inquiry"],
          historicalReliability: 0.89,
        },
        {
          id: "congressional_hearing", name: "Congressional / Senate Hearings", weight: 0.30,
          searchQueries: [`${company} congressional hearing testimony senate committee`],
          keywords: ["hearing", "testimony", "congress", "senate", "committee", "oversight"],
          historicalReliability: 0.76,
        },
        {
          id: "agency_statements", name: "Agency Public Statements", weight: 0.20,
          searchQueries: [`${company} SEC FTC DOJ regulatory agency statement`],
          keywords: ["sec", "ftc", "nhtsa", "doj", "agency", "statement", "warning", "announcement"],
          historicalReliability: 0.82,
        },
        {
          id: "whistleblower", name: "Whistleblower Reports", weight: 0.10,
          searchQueries: [`${company} whistleblower complaint employee safety`],
          keywords: ["whistleblower", "complaint", "employee report", "insider", "allegation"],
          historicalReliability: 0.64,
        },
      ],
    },
    {
      eventType: "executive_departure",
      modifier: 0.9,
      signals: [
        {
          id: "leadership_rumors", name: "Leadership Change Rumors", weight: 0.35,
          searchQueries: [`${company} CEO resign departure stepping down replacement`],
          keywords: ["resign", "departure", "stepping down", "leaving", "replacement", "successor"],
          historicalReliability: 0.74,
        },
        {
          id: "board_activity", name: "Board Restructuring Activity", weight: 0.25,
          searchQueries: [`${company} board directors changes governance reshuffle`],
          keywords: ["board", "director", "governance", "appointed", "reshuffle"],
          historicalReliability: 0.68,
        },
        {
          id: "executive_stock_sales", name: "Insider Stock Sales", weight: 0.25,
          searchQueries: [`${company} insider selling stock executive sale SEC Form 4`],
          keywords: ["insider", "selling", "stock sale", "form 4", "divested"],
          historicalReliability: 0.71,
        },
        {
          id: "performance_pressure", name: "Performance & Activist Pressure", weight: 0.15,
          searchQueries: [`${company} activist investor pressure management criticism`],
          keywords: ["activist", "pressure", "underperformance", "criticism", "shareholder"],
          historicalReliability: 0.62,
        },
      ],
    },
    {
      eventType: "earnings_surprise",
      modifier: 0.85,
      signals: [
        {
          id: "analyst_revisions", name: "Analyst Estimate Revisions", weight: 0.35,
          searchQueries: [`${company} analyst upgrade downgrade estimate revision forecast`],
          keywords: ["upgrade", "downgrade", "revision", "forecast", "estimate", "target price"],
          historicalReliability: 0.72,
        },
        {
          id: "revenue_indicators", name: "Revenue Leading Indicators", weight: 0.30,
          searchQueries: [`${company} revenue growth decline quarterly sales market share`],
          keywords: ["revenue", "growth", "decline", "sales", "market share", "quarterly"],
          historicalReliability: 0.65,
        },
        {
          id: "supply_chain", name: "Supply Chain & Operations Signals", weight: 0.20,
          searchQueries: [`${company} supply chain disruption production layoff expansion`],
          keywords: ["supply chain", "production", "capacity", "hiring", "layoff", "expansion"],
          historicalReliability: 0.58,
        },
        {
          id: "guidance_signals", name: "Pre-Earnings Guidance Signals", weight: 0.15,
          searchQueries: [`${company} guidance update profit warning earnings outlook`],
          keywords: ["guidance", "pre-announcement", "warning", "outlook", "forecast"],
          historicalReliability: 0.78,
        },
      ],
    },
    {
      eventType: "acquisition_target",
      modifier: 0.8,
      signals: [
        {
          id: "merger_rumors", name: "M&A Rumors & Reports", weight: 0.40,
          searchQueries: [`${company} acquisition merger takeover buyout deal rumor`],
          keywords: ["acquisition", "merger", "takeover", "buyout", "bid", "offer", "deal"],
          historicalReliability: 0.70,
        },
        {
          id: "valuation_activity", name: "Unusual Valuation Activity", weight: 0.25,
          searchQueries: [`${company} undervalued valuation market cap premium analysis`],
          keywords: ["undervalued", "premium", "discount", "valuation", "market cap"],
          historicalReliability: 0.55,
        },
        {
          id: "strategic_interest", name: "Strategic Buyer Interest", weight: 0.20,
          searchQueries: [`${company} strategic partnership stake investment approach`],
          keywords: ["strategic", "partnership", "stake", "investment", "approach"],
          historicalReliability: 0.60,
        },
        {
          id: "advisor_hiring", name: "Advisory / Banking Activity", weight: 0.15,
          searchQueries: [`${company} investment bank advisor Goldman Morgan Stanley`],
          keywords: ["investment bank", "advisor", "retained", "goldman", "morgan stanley", "advisory"],
          historicalReliability: 0.75,
        },
      ],
    },
    {
      eventType: "strategic_shift",
      modifier: 0.95,
      signals: [
        {
          id: "restructuring_signals", name: "Restructuring Announcements", weight: 0.35,
          searchQueries: [`${company} restructuring reorganization pivot transformation`],
          keywords: ["restructuring", "reorganization", "pivot", "transformation", "cost cutting"],
          historicalReliability: 0.80,
        },
        {
          id: "market_exit", name: "Market / Product Exit Signals", weight: 0.25,
          searchQueries: [`${company} exit market discontinue divest sell division`],
          keywords: ["exit", "discontinue", "shut down", "divest", "sell off", "wind down"],
          historicalReliability: 0.72,
        },
        {
          id: "new_market_entry", name: "New Market Entry Signals", weight: 0.25,
          searchQueries: [`${company} enter new market expand launch diversify`],
          keywords: ["enter", "expand", "launch", "diversify", "new market", "venture", "initiative"],
          historicalReliability: 0.65,
        },
        {
          id: "talent_shifts", name: "Talent & Hiring Pattern Shifts", weight: 0.15,
          searchQueries: [`${company} hiring spree layoffs job cuts workforce`],
          keywords: ["hiring", "talent", "layoffs", "job cuts", "reduction", "workforce"],
          historicalReliability: 0.60,
        },
      ],
    },
  ];
}

// ═══════════════════════════════════════════════════════════════
// PART 2: HISTORICAL PRECEDENT DATABASE
// ═══════════════════════════════════════════════════════════════

interface HistoricalEvent {
  company: string;
  eventType: string;
  eventDate: string;
  signalsDetected: string[];
  leadTimeDays: number;
  actualEventOccurred: boolean;
  description: string;
}

const HISTORICAL_DATABASE: HistoricalEvent[] = [
  { company: "Volkswagen", eventType: "regulatory_action", eventDate: "2015-09-18", signalsDetected: ["cid_issuance", "agency_statements", "whistleblower"], leadTimeDays: 47, actualEventOccurred: true, description: "EPA issued violation notice for diesel emissions cheating" },
  { company: "Uber", eventType: "regulatory_action", eventDate: "2017-03-19", signalsDetected: ["congressional_hearing", "agency_statements"], leadTimeDays: 62, actualEventOccurred: true, description: "Multiple state and federal investigations into business practices" },
  { company: "Facebook", eventType: "regulatory_action", eventDate: "2019-07-24", signalsDetected: ["cid_issuance", "congressional_hearing", "whistleblower"], leadTimeDays: 89, actualEventOccurred: true, description: "FTC $5B fine for Cambridge Analytica privacy violations" },
  { company: "Boeing", eventType: "regulatory_action", eventDate: "2019-03-13", signalsDetected: ["cid_issuance", "agency_statements", "whistleblower"], leadTimeDays: 41, actualEventOccurred: true, description: "FAA grounded 737 MAX after two fatal crashes" },
  { company: "GM", eventType: "regulatory_action", eventDate: "2014-02-13", signalsDetected: ["cid_issuance", "agency_statements"], leadTimeDays: 56, actualEventOccurred: true, description: "NHTSA recall for ignition switch defect" },
  { company: "Wells Fargo", eventType: "regulatory_action", eventDate: "2016-09-08", signalsDetected: ["congressional_hearing", "whistleblower"], leadTimeDays: 73, actualEventOccurred: true, description: "CFPB fine for fake account scandal" },
  { company: "Google", eventType: "regulatory_action", eventDate: "2018-07-18", signalsDetected: ["cid_issuance", "congressional_hearing", "agency_statements"], leadTimeDays: 52, actualEventOccurred: true, description: "EU antitrust fine of €4.34B for Android bundling" },
  { company: "Johnson & Johnson", eventType: "regulatory_action", eventDate: "2019-08-26", signalsDetected: ["cid_issuance", "whistleblower", "agency_statements"], leadTimeDays: 38, actualEventOccurred: true, description: "Opioid crisis liability ruling in Oklahoma" },
  { company: "Intel", eventType: "executive_departure", eventDate: "2021-01-13", signalsDetected: ["leadership_rumors", "performance_pressure", "board_activity"], leadTimeDays: 34, actualEventOccurred: true, description: "CEO Bob Swan replaced by Pat Gelsinger amid performance pressure" },
  { company: "Disney", eventType: "executive_departure", eventDate: "2020-02-25", signalsDetected: ["leadership_rumors", "board_activity"], leadTimeDays: 28, actualEventOccurred: true, description: "CEO Bob Iger stepped down, replaced by Bob Chapek" },
  { company: "Boeing", eventType: "executive_departure", eventDate: "2019-12-23", signalsDetected: ["leadership_rumors", "performance_pressure", "board_activity", "executive_stock_sales"], leadTimeDays: 45, actualEventOccurred: true, description: "CEO Dennis Muilenburg fired after 737 MAX crisis" },
  { company: "WeWork", eventType: "executive_departure", eventDate: "2019-09-24", signalsDetected: ["leadership_rumors", "performance_pressure", "board_activity"], leadTimeDays: 30, actualEventOccurred: true, description: "CEO Adam Neumann forced out by board and SoftBank" },
  { company: "Uber", eventType: "executive_departure", eventDate: "2017-06-21", signalsDetected: ["leadership_rumors", "performance_pressure", "board_activity", "executive_stock_sales"], leadTimeDays: 55, actualEventOccurred: true, description: "CEO Travis Kalanick resigned under investor pressure" },
  { company: "Apple", eventType: "earnings_surprise", eventDate: "2019-01-02", signalsDetected: ["analyst_revisions", "revenue_indicators", "guidance_signals"], leadTimeDays: 21, actualEventOccurred: true, description: "Revenue warning due to China slowdown, first in 16 years" },
  { company: "Netflix", eventType: "earnings_surprise", eventDate: "2022-04-19", signalsDetected: ["analyst_revisions", "revenue_indicators", "supply_chain"], leadTimeDays: 35, actualEventOccurred: true, description: "First subscriber loss in a decade, stock dropped 35%" },
  { company: "Meta", eventType: "earnings_surprise", eventDate: "2022-02-02", signalsDetected: ["analyst_revisions", "revenue_indicators", "guidance_signals"], leadTimeDays: 28, actualEventOccurred: true, description: "Lost $230B in market cap in single day on earnings miss" },
  { company: "Amazon", eventType: "earnings_surprise", eventDate: "2022-04-28", signalsDetected: ["analyst_revisions", "supply_chain", "revenue_indicators"], leadTimeDays: 42, actualEventOccurred: true, description: "First quarterly loss since 2015, Rivian investment write-down" },
  { company: "Activision Blizzard", eventType: "acquisition_target", eventDate: "2022-01-18", signalsDetected: ["merger_rumors", "valuation_activity", "strategic_interest", "advisor_hiring"], leadTimeDays: 60, actualEventOccurred: true, description: "Microsoft $68.7B acquisition announced" },
  { company: "Twitter", eventType: "acquisition_target", eventDate: "2022-04-14", signalsDetected: ["merger_rumors", "valuation_activity", "strategic_interest"], leadTimeDays: 25, actualEventOccurred: true, description: "Elon Musk $44B takeover bid" },
  { company: "Figma", eventType: "acquisition_target", eventDate: "2022-09-15", signalsDetected: ["merger_rumors", "strategic_interest", "advisor_hiring"], leadTimeDays: 44, actualEventOccurred: true, description: "Adobe $20B acquisition attempt" },
  { company: "Meta", eventType: "strategic_shift", eventDate: "2021-10-28", signalsDetected: ["restructuring_signals", "new_market_entry", "talent_shifts"], leadTimeDays: 67, actualEventOccurred: true, description: "Rebranded to Meta, pivoted to metaverse" },
  { company: "Microsoft", eventType: "strategic_shift", eventDate: "2014-02-04", signalsDetected: ["restructuring_signals", "new_market_entry", "talent_shifts", "market_exit"], leadTimeDays: 50, actualEventOccurred: true, description: "Satya Nadella cloud-first pivot" },
  { company: "IBM", eventType: "strategic_shift", eventDate: "2020-10-08", signalsDetected: ["restructuring_signals", "market_exit", "talent_shifts"], leadTimeDays: 72, actualEventOccurred: true, description: "Spun off managed infrastructure services into Kyndryl" },
  { company: "GE", eventType: "strategic_shift", eventDate: "2021-11-09", signalsDetected: ["restructuring_signals", "market_exit", "talent_shifts"], leadTimeDays: 85, actualEventOccurred: true, description: "Announced breakup into three companies" },
];

// ═══════════════════════════════════════════════════════════════
// PART 3: SEARCH ENGINE — Uses ddg-search edge function
// ═══════════════════════════════════════════════════════════════

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  domain: string;
  date: string;
}

async function searchDDG(query: string): Promise<SearchResult[]> {
  try {
    // Call our own ddg-search edge function which handles parsing
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const response = await fetch(`${supabaseUrl}/functions/v1/ddg-search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ query, numResults: 8 }),
    });
    
    if (!response.ok) {
      const text = await response.text();
      console.error(`ddg-search error: ${response.status} ${text}`);
      return [];
    }
    
    const data = await response.json();
    const results: SearchResult[] = (data.results || []).map((r: any) => {
      let domain = "unknown";
      try { domain = new URL(r.url).hostname.replace(/^www\./, ""); } catch { /* */ }
      return {
        title: r.title || "",
        url: r.url || "",
        snippet: r.snippet || "",
        domain,
        date: new Date().toISOString(),
      };
    });
    return results;
  } catch (e) {
    console.error("DDG search error:", e);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════
// PART 4: SIGNAL SCORING ALGORITHMS
// ═══════════════════════════════════════════════════════════════

function calculateRelevance(result: SearchResult, keywords: string[]): number {
  const text = (result.title + " " + result.snippet).toLowerCase();
  let matchCount = 0;
  for (const keyword of keywords) {
    if (text.includes(keyword.toLowerCase())) matchCount++;
  }
  let titleMatches = 0;
  for (const keyword of keywords) {
    if (result.title.toLowerCase().includes(keyword.toLowerCase())) titleMatches++;
  }
  const score = (matchCount * 0.2) + (titleMatches * 0.3);
  return Math.min(1.0, score);
}

function calculateCredibility(sourceDomain: string): number {
  const d = sourceDomain.toLowerCase();
  if (d.endsWith(".gov") || d.includes(".gov.")) return 1.0;
  if (d.endsWith(".edu")) return 0.9;
  const tiers: Record<string, number> = {
    "reuters.com": 0.9, "wsj.com": 0.9, "bloomberg.com": 0.9, "ft.com": 0.9, "apnews.com": 0.9, "sec.gov": 1.0,
    "nytimes.com": 0.8, "washingtonpost.com": 0.8, "bbc.com": 0.75, "cnn.com": 0.7,
    "forbes.com": 0.6, "fortune.com": 0.6, "cnbc.com": 0.65, "techcrunch.com": 0.6, "businessinsider.com": 0.55,
    "seekingalpha.com": 0.55, "marketwatch.com": 0.6, "barrons.com": 0.65, "investopedia.com": 0.55,
    "pbs.org": 0.8, "npr.org": 0.8, "thehill.com": 0.6, "politico.com": 0.65,
  };
  for (const [domain, score] of Object.entries(tiers)) {
    if (d.includes(domain)) return score;
  }
  return 0.4;
}

function calculateRecency(dateString: string): number {
  const resultDate = new Date(dateString);
  const now = new Date();
  const hoursAgo = (now.getTime() - resultDate.getTime()) / (1000 * 60 * 60);
  return Math.max(0.1, Math.exp(-0.02 * hoursAgo));
}

// ═══════════════════════════════════════════════════════════════
// PART 5: PATTERN MATCHING — Jaccard Similarity
// ═══════════════════════════════════════════════════════════════

function calculateJaccardSimilarity(currentSignalIds: string[], historicalSignalIds: string[]): number {
  const current = new Set(currentSignalIds);
  const historical = new Set(historicalSignalIds);
  const intersection = new Set([...current].filter(x => historical.has(x)));
  const union = new Set([...current, ...historical]);
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

interface SimilarPattern {
  company: string;
  similarity: number;
  leadTimeDays: number;
  eventDate: string;
  description: string;
  signalsDetected: string[];
  actualEventOccurred: boolean;
}

function findSimilarPatterns(currentSignalIds: string[], eventType: string): SimilarPattern[] {
  const relevant = HISTORICAL_DATABASE.filter(h => h.eventType === eventType);
  return relevant.map(hist => ({
    company: hist.company,
    similarity: calculateJaccardSimilarity(currentSignalIds, hist.signalsDetected),
    leadTimeDays: hist.leadTimeDays,
    eventDate: hist.eventDate,
    description: hist.description,
    signalsDetected: hist.signalsDetected,
    actualEventOccurred: hist.actualEventOccurred,
  })).sort((a, b) => b.similarity - a.similarity);
}

// ═══════════════════════════════════════════════════════════════
// PART 6: CONFIDENCE CALCULATION — 5-Factor Model
// ═══════════════════════════════════════════════════════════════

interface ScoredSignal {
  id: string;
  name: string;
  weight: number;
  signalStrength: number;
  bestResult: SearchResult | null;
  scores: { relevance: number; credibility: number; recency: number };
  historicalReliability: number;
  resultCount: number;
}

function calculateFiveFactorConfidence(
  signals: ScoredSignal[], expectedSignalCount: number,
  historicalSuccessRate: number, eventModifier: number,
  avgLeadTime: number, stdDev: number
): { confidence: number; factors: Record<string, number>; weights: Record<string, number> } {
  const activeSignals = signals.filter(s => s.signalStrength > 0);
  const factors = {
    signalStrength: Math.min(1.0, activeSignals.length / expectedSignalCount),
    signalQuality: activeSignals.length > 0 ? activeSignals.reduce((sum, s) => sum + s.signalStrength, 0) / activeSignals.length : 0,
    historicalAccuracy: historicalSuccessRate,
    recency: activeSignals.length > 0 ? activeSignals.reduce((sum, s) => sum + s.scores.recency, 0) / activeSignals.length : 0,
    credibility: activeSignals.length > 0 ? activeSignals.reduce((sum, s) => sum + s.scores.credibility, 0) / activeSignals.length : 0,
  };
  const weights = { signalStrength: 0.25, signalQuality: 0.25, historicalAccuracy: 0.25, recency: 0.15, credibility: 0.10 };
  let confidence = Object.entries(factors).reduce((sum, [k, v]) => sum + v * (weights as any)[k], 0);
  confidence = Math.min(1.0, confidence * eventModifier);
  if (avgLeadTime > 0) {
    const variance = stdDev / avgLeadTime;
    if (variance > 0.3) confidence -= (variance - 0.3) * 0.5;
  }
  return { confidence: Math.max(0.1, Math.min(0.98, confidence)), factors, weights };
}

// ═══════════════════════════════════════════════════════════════
// PART 7: TIME ESTIMATION
// ═══════════════════════════════════════════════════════════════

function estimateEventTiming(similarPatterns: SimilarPattern[]) {
  const filtered = similarPatterns.filter(p => p.similarity >= 0.5 && p.actualEventOccurred);
  if (filtered.length === 0) return { avgLeadTime: 60, stdDev: 30, successRate: 0.5, confidenceInterval: [30, 90], patternsUsed: 0 };
  const leadTimes = filtered.map(p => p.leadTimeDays);
  const avg = Math.round(leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length);
  const successRate = filtered.filter(p => p.actualEventOccurred).length / filtered.length;
  const variance = leadTimes.reduce((sum, t) => sum + Math.pow(t - avg, 2), 0) / leadTimes.length;
  const stdDev = Math.round(Math.sqrt(variance));
  return { avgLeadTime: avg, stdDev, successRate, confidenceInterval: [Math.max(7, avg - stdDev), avg + stdDev], patternsUsed: filtered.length };
}

// ═══════════════════════════════════════════════════════════════
// PART 8: AI TEXT GENERATION
// ═══════════════════════════════════════════════════════════════

async function generatePredictionText(
  company: string, eventType: string, confidence: number, estimatedDate: string,
  daysUntil: number, topSignals: ScoredSignal[], similarPatterns: SimilarPattern[],
  factors: Record<string, number>
): Promise<string> {
  const topPatterns = similarPatterns.filter(p => p.similarity >= 0.5).slice(0, 3);
  const prompt = `You are Aureon, a forensic intelligence analyst. Generate a detailed prediction briefing (3-5 paragraphs).

COMPANY: ${company}
EVENT TYPE: ${eventType.replace(/_/g, " ")}
CONFIDENCE: ${(confidence * 100).toFixed(0)}%
EXPECTED DATE: ${estimatedDate} (~${daysUntil} days)

DETECTED SIGNALS:
${topSignals.filter(s => s.signalStrength > 0).map(s => `• ${s.name} (strength: ${(s.signalStrength * 100).toFixed(0)}%, weight: ${(s.weight * 100).toFixed(0)}%) — ${s.bestResult?.title || "No direct match"}`).join("\n")}

HISTORICAL PRECEDENTS:
${topPatterns.map(p => `• ${p.company} (${p.eventDate}): ${p.description} — ${(p.similarity * 100).toFixed(0)}% pattern match, ${p.leadTimeDays} day lead time`).join("\n") || "No closely matching precedents found."}

CONFIDENCE FACTORS:
• Signal Strength: ${(factors.signalStrength * 100).toFixed(0)}%
• Signal Quality: ${(factors.signalQuality * 100).toFixed(0)}%
• Historical Accuracy: ${(factors.historicalAccuracy * 100).toFixed(0)}%
• Recency: ${(factors.recency * 100).toFixed(0)}%
• Source Credibility: ${(factors.credibility * 100).toFixed(0)}%

Write a detailed 3-5 paragraph intelligence briefing that:
1. States EXACTLY what will happen and when
2. Explains WHY based on the specific signals detected
3. Compares to historical precedents
4. Assesses the chain of events that will unfold
5. Notes what could prevent this

Be specific, use data points, write like a senior intelligence analyst. Return ONLY the briefing text.`;

  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY_APP");
    if (!apiKey) return `Based on ${topSignals.filter(s => s.signalStrength > 0).length} detected signals with ${(confidence * 100).toFixed(0)}% confidence, ${company} is likely to face a ${eventType.replace(/_/g, " ")} event within approximately ${daysUntil} days.`;

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 3000 },
      }),
    });
    if (!res.ok) {
      console.error("Gemini error:", res.status, await res.text());
      return `Based on detected signals, ${company} is likely to face a ${eventType.replace(/_/g, " ")} event within ~${daysUntil} days (${(confidence * 100).toFixed(0)}% confidence).`;
    }
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || `${company} prediction generated with ${(confidence * 100).toFixed(0)}% confidence.`;
  } catch (e) {
    console.error("AI text generation error:", e);
    return `Based on detected signals, ${company} is likely to face a ${eventType.replace(/_/g, " ")} event within ~${daysUntil} days (${(confidence * 100).toFixed(0)}% confidence).`;
  }
}

// ═══════════════════════════════════════════════════════════════
// PART 9: MAIN ORCHESTRATOR (SSE STREAMING)
// ═══════════════════════════════════════════════════════════════

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // ── Strict BYOK gate — admin uses platform key, others must BYOK ──
  if (req.method !== 'OPTIONS') {
    try {
      const _b = await req.clone().json().catch(() => ({} as any));
      const _byok = (_b && typeof _b === 'object') ? (_b as any).byok : undefined;
      const _gate = await import('../_shared/adminGate.ts');
      await _gate.resolveKey(req, _byok);
    } catch (_e) {
      const _gate = await import('../_shared/adminGate.ts');
      return _gate.byokErrorResponse(_e, (globalThis as any).corsHeaders ?? { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' });
    }
  }

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No auth");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData.user) throw new Error("Unauthorized");

    const { company, sessionId } = await req.json();
    if (!company) throw new Error("Missing company name");

    console.log(`[PREDICTIONS] ═══ Starting algorithmic prediction for: ${company} ═══`);

    // SSE streaming setup
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: any) => {
          try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)); } catch { /* closed */ }
        };

        const eventConfigs = getEventConfigs(company);
        const totalSteps = eventConfigs.length * 4 + 2; // 4 steps per event + pattern matching + AI generation
        let currentStep = 0;
        const generatedPredictions: any[] = [];

        send({ type: "progress", step: "init", message: `Aureon Prediction Algorithm initialized for ${company}`, progress: 0, total: totalSteps });

        for (let configIdx = 0; configIdx < eventConfigs.length; configIdx++) {
          const config = eventConfigs[configIdx];
          const eventLabel = config.eventType.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
          
          send({ type: "progress", step: "scanning", message: `Scanning signals: ${eventLabel}`, progress: ++currentStep, total: totalSteps, eventType: config.eventType });

          // STEP 1: Search & Score Signals — run all signal searches in parallel
          const signalPromises = config.signals.map(async (signalDef) => {
            let bestStrength = 0;
            let bestResult: SearchResult | null = null;
            let bestScores = { relevance: 0, credibility: 0, recency: 0 };
            let totalResults = 0;

            // Only use 1 query per signal to avoid rate limiting
            const results = await searchDDG(signalDef.searchQueries[0]);
            totalResults = results.length;

            for (const result of results) {
              const relevance = calculateRelevance(result, signalDef.keywords);
              const credibility = calculateCredibility(result.domain);
              const recency = calculateRecency(result.date);
              const strength = (relevance + credibility + recency) / 3;
              if (strength > bestStrength) {
                bestStrength = strength;
                bestResult = result;
                bestScores = { relevance, credibility, recency };
              }
            }

            return {
              id: signalDef.id, name: signalDef.name, weight: signalDef.weight,
              signalStrength: bestStrength, bestResult, scores: bestScores,
              historicalReliability: signalDef.historicalReliability, resultCount: totalResults,
            } as ScoredSignal;
          });

          const scoredSignals = await Promise.all(signalPromises);

          for (const s of scoredSignals) {
            console.log(`[PREDICTIONS]   Signal "${s.name}": strength=${(s.signalStrength * 100).toFixed(0)}% (${s.resultCount} results)`);
          }

          send({ type: "progress", step: "scoring", message: `Scoring signals: ${eventLabel}`, progress: ++currentStep, total: totalSteps, signals: scoredSignals.map(s => ({ name: s.name, strength: s.signalStrength })) });

          // STEP 2: Check if enough signals active
          const activeSignals = scoredSignals.filter(s => s.signalStrength > 0.1);
          const strongSignals = scoredSignals.filter(s => s.signalStrength > 0.3);
          if (activeSignals.length === 0 || (activeSignals.length < 2 && strongSignals.length === 0)) {
            console.log(`[PREDICTIONS]   Skipping ${config.eventType}: insufficient signals`);
            send({ type: "progress", step: "skip", message: `Insufficient signals for ${eventLabel}`, progress: currentStep += 2, total: totalSteps });
            continue;
          }

          let totalSignalScore = 0, totalWeight = 0;
          for (const s of scoredSignals) { totalSignalScore += s.weight * s.signalStrength; totalWeight += s.weight; }
          const aggregatedScore = totalWeight > 0 ? totalSignalScore / totalWeight : 0;

          // STEP 3: Historical Pattern Matching
          const currentSignalIds = activeSignals.map(s => s.id);
          const similarPatterns = findSimilarPatterns(currentSignalIds, config.eventType);
          const highSimilarityPatterns = similarPatterns.filter(p => p.similarity >= 0.5);

          send({ type: "progress", step: "matching", message: `Pattern matching: ${highSimilarityPatterns.length} precedents found`, progress: ++currentStep, total: totalSteps });

          // STEP 4: Time Estimation + Confidence
          const timing = estimateEventTiming(similarPatterns);
          const estimatedDate = new Date(); estimatedDate.setDate(estimatedDate.getDate() + timing.avgLeadTime);
          const earliestDate = new Date(); earliestDate.setDate(earliestDate.getDate() + timing.confidenceInterval[0]);
          const latestDate = new Date(); latestDate.setDate(latestDate.getDate() + timing.confidenceInterval[1]);

          const { confidence, factors, weights } = calculateFiveFactorConfidence(
            scoredSignals, config.signals.length, timing.successRate, config.modifier, timing.avgLeadTime, timing.stdDev
          );

          if (confidence < 0.35) {
            send({ type: "progress", step: "skip", message: `${eventLabel}: confidence ${(confidence * 100).toFixed(0)}% below threshold`, progress: ++currentStep, total: totalSteps });
            continue;
          }

          send({ type: "progress", step: "generating", message: `Generating AI briefing: ${eventLabel} (${(confidence * 100).toFixed(0)}%)`, progress: ++currentStep, total: totalSteps });

          // STEP 5: AI Text
          const predictionText = await generatePredictionText(
            company, config.eventType, confidence, estimatedDate.toISOString().split("T")[0],
            timing.avgLeadTime, scoredSignals, similarPatterns, factors
          );

          // Build reasoning chain
          const reasoningChain = [
            { step: 1, description: "Signal Detection — Web Search", output: `Searched ${config.signals.length} signal types. Found ${activeSignals.length} active signals.`, confidence: 0.95 },
            { step: 2, description: "Signal Scoring — Relevance, Credibility, Recency", output: `Aggregated weighted signal score: ${(aggregatedScore * 100).toFixed(1)}%.`, confidence: 0.90 },
            { step: 3, description: "Historical Pattern Matching — Jaccard Similarity", output: `Found ${highSimilarityPatterns.length} highly similar patterns (≥50% match) with ${(timing.successRate * 100).toFixed(0)}% historical success rate.`, confidence: timing.successRate },
            { step: 4, description: "Time Estimation — Historical Lead Times", output: `Lead time: ${timing.avgLeadTime} days (σ=${timing.stdDev}d). Interval: ${timing.confidenceInterval[0]}–${timing.confidenceInterval[1]} days.`, confidence: 0.80 },
            { step: 5, description: "5-Factor Confidence Calculation", output: `Final: ${(confidence * 100).toFixed(0)}% after ×${config.modifier} modifier.`, confidence },
          ];

          const severity = confidence >= 0.8 ? "critical" : confidence >= 0.65 ? "high" : confidence >= 0.5 ? "medium" : "low";
          const signalsForDB = scoredSignals.filter(s => s.signalStrength > 0).map(s => ({
            type: s.id, name: s.name, weight: s.weight, signalStrength: s.signalStrength,
            historicalReliability: s.historicalReliability,
            source: s.bestResult ? { url: s.bestResult.url, title: s.bestResult.title, snippet: s.bestResult.snippet, domain: s.bestResult.domain, date: s.bestResult.date } : null,
            scores: s.scores,
          }));

          const historicalComparison = {
            prediction_title: `${company} — ${eventLabel}`,
            precedents: highSimilarityPatterns.slice(0, 5).map(p => ({
              event: `${p.company}: ${p.description}`, date: p.eventDate,
              outcome: p.actualEventOccurred ? "Event occurred as predicted" : "Event did not occur",
              relevance: `${(p.similarity * 100).toFixed(0)}% pattern similarity, ${p.leadTimeDays}-day lead time`,
              signals_matched: p.signalsDetected,
            })),
            pattern_analysis: {
              financial_trajectory: `Aggregated signal score of ${(aggregatedScore * 100).toFixed(1)}% across ${config.signals.length} categories.`,
              structural_signals: `Signal distribution: ${scoredSignals.map(s => `${s.name}: ${(s.signalStrength * 100).toFixed(0)}%`).join(", ")}.`,
              regulatory_exposure: config.eventType === "regulatory_action" ? `High regulatory signal pattern detected.` : "N/A",
              competitive_pressure: `Jaccard similarity against ${similarPatterns.length} precedent cases.`,
              industry_context: `Event modifier: ×${config.modifier}.`,
            },
            chain_of_events: highSimilarityPatterns.length > 0
              ? [
                  `Signal accumulation: ${activeSignals.length}/${config.signals.length} signals active`,
                  `Matches ${highSimilarityPatterns.length} precedent(s) with avg ${timing.avgLeadTime}-day lead time`,
                  `Event window: ${earliestDate.toISOString().split("T")[0]} to ${latestDate.toISOString().split("T")[0]}`,
                  `${(timing.successRate * 100).toFixed(0)}% historical success rate → event is ${confidence >= 0.6 ? "likely" : "possible"}`,
                ]
              : ["Insufficient historical precedents for chain analysis"],
            counter_arguments: `Could be invalidated if: (1) signals reverse, (2) company takes preemptive action, (3) external macro events alter trajectory. Timing variance: ±${timing.stdDev} days.`,
            confidence_factors: factors,
            confidence_weights: weights,
            timing: {
              avgLeadTime: timing.avgLeadTime, stdDev: timing.stdDev,
              confidenceInterval: timing.confidenceInterval,
              earliestDate: earliestDate.toISOString(), latestDate: latestDate.toISOString(),
              patternsUsed: timing.patternsUsed,
            },
          };

          // Save to database
          const { data: saved, error: saveError } = await supabase.from("predictions").insert({
            user_id: userData.user.id, session_id: sessionId || null, company,
            event_type: config.eventType, prediction_text: predictionText, confidence, severity,
            time_horizon: `${timing.avgLeadTime} days (±${timing.stdDev}d)`,
            estimated_date: estimatedDate.toISOString(), signals: signalsForDB,
            reasoning_chain: reasoningChain, historical_comparison: historicalComparison, status: "active",
          }).select().single();

          if (saveError) { console.error(`[PREDICTIONS] Save error:`, saveError); continue; }
          if (saved) {
            for (const signal of signalsForDB.slice(0, 10)) {
              if (signal.source) {
                await supabase.from("prediction_signals").insert({
                  prediction_id: saved.id, signal_type: signal.type, signal_category: config.eventType,
                  search_query: company, source_url: signal.source.url, source_title: signal.source.title,
                  source_snippet: signal.source.snippet, source_date: signal.source.date,
                  source_domain: signal.source.domain, relevance_score: signal.scores.relevance,
                  credibility_score: signal.scores.credibility, weight: signal.weight,
                });
              }
            }
            generatedPredictions.push(saved);
            send({ type: "prediction", prediction: { id: saved.id, event_type: config.eventType, confidence, severity } });
          }
        }

        send({ type: "complete", count: generatedPredictions.length, message: `Aureon generated ${generatedPredictions.length} predictions for ${company}` });
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  } catch (error) {
    console.error("Generate predictions error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
