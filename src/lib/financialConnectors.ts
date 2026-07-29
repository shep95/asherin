/**
 * AUREON FINANCIAL MCP CONNECTOR REGISTRY
 * Derived from Anthropic's financial-services-plugins MCP integrations.
 * These are the live financial data provider endpoints that can be wired into
 * Zeeion, AZIION, and Lavba for real-time market data.
 */

export interface MCPConnector {
  id: string;
  name: string;
  provider: string;
  description: string;
  url: string;
  category: "financial-data" | "research" | "analytics" | "medical" | "enterprise" | "productivity";
  requiresKey: boolean;
  capabilities: string[];
  logo?: string;
  status: "available" | "connected" | "coming_soon";
}

// ── FINANCIAL DATA PROVIDERS ────────────────────────────────────────────

export const FINANCIAL_CONNECTORS: MCPConnector[] = [
  {
    id: "daloopa",
    name: "Daloopa",
    provider: "Daloopa",
    description: "AI-powered financial data extraction from SEC filings, earnings transcripts, and financial documents",
    url: "https://mcp.daloopa.com/server/mcp",
    category: "financial-data",
    requiresKey: true,
    capabilities: ["SEC filings", "earnings data", "financial extraction", "company fundamentals"],
    status: "available",
  },
  {
    id: "morningstar",
    name: "Morningstar",
    provider: "Morningstar",
    description: "Investment research, fund analysis, stock ratings, and portfolio analytics",
    url: "https://mcp.morningstar.com/mcp",
    category: "financial-data",
    requiresKey: true,
    capabilities: ["stock ratings", "fund analysis", "portfolio analytics", "sector research"],
    status: "available",
  },
  {
    id: "spglobal",
    name: "S&P Global (Kensho)",
    provider: "S&P Global",
    description: "Capital IQ data — company tearsheets, earnings previews, funding digests, M&A intelligence",
    url: "https://kfinance.kensho.com/integrations/mcp",
    category: "financial-data",
    requiresKey: true,
    capabilities: ["company profiles", "earnings analysis", "M&A data", "credit ratings"],
    status: "available",
  },
  {
    id: "factset",
    name: "FactSet",
    provider: "FactSet",
    description: "Comprehensive financial data, analytics, and market intelligence",
    url: "https://mcp.factset.com/mcp",
    category: "financial-data",
    requiresKey: true,
    capabilities: ["market data", "financial analytics", "portfolio analysis", "risk management"],
    status: "available",
  },
  {
    id: "moodys",
    name: "Moody's",
    provider: "Moody's",
    description: "Credit ratings, risk assessment, and economic research data",
    url: "https://api.moodys.com/genai-ready-data/m1/mcp",
    category: "financial-data",
    requiresKey: true,
    capabilities: ["credit ratings", "risk assessment", "economic research", "default probabilities"],
    status: "available",
  },
  {
    id: "mtnewswires",
    name: "MT Newswires",
    provider: "MT Newswires",
    description: "Real-time financial news, market moving headlines, and economic data releases",
    url: "https://vast-mcp.blueskyapi.com/mtnewswires",
    category: "financial-data",
    requiresKey: true,
    capabilities: ["real-time news", "market alerts", "economic releases", "earnings calendars"],
    status: "available",
  },
  {
    id: "aiera",
    name: "Aiera",
    provider: "Aiera",
    description: "AI-powered earnings call analysis, event transcripts, and corporate event intelligence",
    url: "https://mcp-pub.aiera.com",
    category: "financial-data",
    requiresKey: true,
    capabilities: ["earnings calls", "event transcripts", "sentiment analysis", "corporate events"],
    status: "available",
  },
  {
    id: "lseg",
    name: "LSEG (Refinitiv)",
    provider: "London Stock Exchange Group",
    description: "Bond pricing, yield curves, FX analytics, options valuation, and macro dashboards",
    url: "https://api.analytics.lseg.com/lfa/mcp",
    category: "financial-data",
    requiresKey: true,
    capabilities: ["bond pricing", "yield curves", "FX analytics", "options valuation", "macro data"],
    status: "available",
  },
  {
    id: "pitchbook",
    name: "PitchBook",
    provider: "PitchBook",
    description: "Private equity, venture capital, and M&A data — deal flow, valuations, fund performance",
    url: "https://premium.mcp.pitchbook.com/mcp",
    category: "financial-data",
    requiresKey: true,
    capabilities: ["PE/VC data", "deal flow", "fund performance", "company valuations"],
    status: "available",
  },
  {
    id: "chronograph",
    name: "Chronograph",
    provider: "Chronograph",
    description: "Private equity portfolio monitoring, performance analytics, and LP reporting",
    url: "https://ai.chronograph.pe/mcp",
    category: "financial-data",
    requiresKey: true,
    capabilities: ["portfolio monitoring", "PE analytics", "LP reporting", "cash flow analysis"],
    status: "available",
  },
];

// ── MEDICAL/BIO RESEARCH CONNECTORS ─────────────────────────────────────

export const BIO_CONNECTORS: MCPConnector[] = [
  {
    id: "pubmed",
    name: "PubMed",
    provider: "NCBI / NLM",
    description: "Search biomedical literature — 37M+ citations from MEDLINE and life sciences journals",
    url: "https://pubmed.mcp.claude.com/mcp",
    category: "medical",
    requiresKey: false,
    capabilities: ["literature search", "citation analysis", "MeSH terms", "clinical evidence"],
    status: "available",
  },
  {
    id: "cms-coverage",
    name: "CMS Coverage Database",
    provider: "CMS / DeepSense",
    description: "Access US Medicare/Medicaid coverage determinations and policy decisions",
    url: "https://mcp.deepsense.ai/cms_coverage/mcp",
    category: "medical",
    requiresKey: false,
    capabilities: ["coverage decisions", "Medicare policy", "medical necessity", "coding guidelines"],
    status: "available",
  },
  {
    id: "npi-registry",
    name: "NPI Registry",
    provider: "CMS / DeepSense",
    description: "US National Provider Identifier lookup — verify healthcare providers and organizations",
    url: "https://mcp.deepsense.ai/npi_registry/mcp",
    category: "medical",
    requiresKey: false,
    capabilities: ["provider lookup", "NPI verification", "organization search", "specialty filtering"],
    status: "available",
  },
];

// ── ENTERPRISE CONNECTORS ───────────────────────────────────────────────

export const ENTERPRISE_CONNECTORS: MCPConnector[] = [
  {
    id: "egnyte",
    name: "Egnyte",
    provider: "Egnyte",
    description: "Enterprise file storage, document management, and governance",
    url: "https://mcp-server.egnyte.com/mcp",
    category: "enterprise",
    requiresKey: true,
    capabilities: ["document management", "file storage", "governance", "compliance"],
    status: "available",
  },
];

// ── ALL CONNECTORS ──────────────────────────────────────────────────────

export const ALL_CONNECTORS: MCPConnector[] = [
  ...FINANCIAL_CONNECTORS,
  ...BIO_CONNECTORS,
  ...ENTERPRISE_CONNECTORS,
];

/**
 * Get connectors by category.
 */
export function getConnectorsByCategory(category: MCPConnector["category"]): MCPConnector[] {
  return ALL_CONNECTORS.filter(c => c.category === category);
}

/**
 * Get a specific connector by ID.
 */
export function getConnectorById(id: string): MCPConnector | undefined {
  return ALL_CONNECTORS.find(c => c.id === id);
}

/**
 * Get all available connectors grouped by category.
 */
export function getConnectorsGrouped(): Record<string, MCPConnector[]> {
  const grouped: Record<string, MCPConnector[]> = {};
  for (const connector of ALL_CONNECTORS) {
    if (!grouped[connector.category]) grouped[connector.category] = [];
    grouped[connector.category].push(connector);
  }
  return grouped;
}
