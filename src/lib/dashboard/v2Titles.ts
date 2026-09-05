// Recognition over recall: the v.2 page title is the same lowercase word the
// rail already uses. No product essays, no "Cloud Intelligence Mesh —
// Maximum Tier", no ◎ costume. If a room is not listed the shell falls back
// to the raw view id, which is still honest.

import type { DashboardView } from "@/components/dashboard/types";

export interface V2Title {
  title: string;
  subtitle?: string;
  /** canvas rooms own their scroll: whiteboard, maps, ide. */
  canvas?: boolean;
}

const TITLES: Partial<Record<string, V2Title>> = {
  library: { title: "library", subtitle: "files asherin can search." },
  projects: { title: "projects", subtitle: "a room that scopes chat, files and memory." },
  memory: { title: "memory", subtitle: "rules asherin carries. credentials are refused." },
  "guardian-vault": { title: "vault", subtitle: "locked storage, sessions and factors." },
  whiteboard: { title: "whiteboard", canvas: true },
  settings: { title: "settings", subtitle: "account, appearance, security." },
  subscription: { title: "subscription", subtitle: "asherin $18 · pro $79 · team $39 + $24 a seat." },
  connect: { title: "connect", subtitle: "what actually ran, and what it is bound to." },
  "api-keys": { title: "connect", subtitle: "what actually ran, and what it is bound to." },
  teams: { title: "team", subtitle: "people, seats and billing for one workspace." },

  "ghost-engine": { title: "asherinx.eng", subtitle: "public-index search. no tap." },
  ide: { title: "ide", canvas: true },
  "asherin-defender": { title: "asherin.defender", subtitle: "your own device, watched honestly." },
  "asherin-arvision": { title: "asherin.arvision", canvas: true },
  "asherin-eye": { title: "asherin.eye", canvas: true },
  google: { title: "google", subtitle: "your connected accounts, read on request." },
  search: { title: "search", subtitle: "sourced search with credibility tiers." },
  "knowledge-vault": { title: "knowledge", subtitle: "private files asherin can cite." },
  azplen: { title: "azplen", subtitle: "datasets, analysis and charts." },
  zerlal: { title: "asherin.cyber", subtitle: "passive domain and infrastructure context." },
   zahten: { title: "zahten", subtitle: "build and publish an agent." },
   briefing: { title: "briefings", subtitle: "scheduled reading, sourced." },
   notebooks: { title: "notebooks", subtitle: "saved analysis sessions." },
   "file-scrapper": { title: "file scrapper", subtitle: "pull text out of documents." },
  zali: { title: "zali", subtitle: "design exploration." },
  gematria: { title: "gematria" },
  "vedic-astrology": { title: "vedic" },
  "pdf-generator": { title: "pages", subtitle: "prompt a page. quiet file. you keep the pdf." },
  ebook: { title: "ebook" },
   slideshow: { title: "slides" },
   "pattern-analysis": { title: "patterns", subtitle: "recognition over a dataset." },
  snippets: { title: "snippets" },
  stats: { title: "stats", subtitle: "your own usage. nothing benchmarked." },
  audit: { title: "audit", subtitle: "access and activity log." },
  "bug-reports": { title: "bugs", subtitle: "what you reported, and its state." },
  community: { title: "community" },
};

export function v2TitleFor(view: DashboardView | string, fallback?: string): V2Title {
  const key = String(view);
  if (key.startsWith("agent:")) return { title: fallback?.toLowerCase() || "agent" };
  return TITLES[key] ?? { title: (fallback ?? key).toLowerCase() };
}
