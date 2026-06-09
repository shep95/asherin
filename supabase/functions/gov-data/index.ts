import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { getCorsHeaders } from "../_shared/cors.ts";
// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts

const SOURCES = {
  // USA
  usa_spending: "https://api.usaspending.gov/api/v2",
  treasury: "https://api.fiscaldata.treasury.gov/services/api/fiscal_service",
  census: "https://api.census.gov/data",
  fred: "https://api.stlouisfed.org/fred",
  // Universal
  world_bank: "https://api.worldbank.org/v2",
  imf_dm: "https://www.imf.org/external/datamapper/api/v1",
  oecd: "https://stats.oecd.org/SDMX-JSON/data",
  // UK (requires www.)
  uk_ckan: "https://www.data.gov.uk/api/3/action",
  // France
  fr_data: "https://www.data.gouv.fr/api/1",
  // Canada
  ca_ckan: "https://open.canada.ca/data/en/api/3/action",
  // Germany (requires /ckan/ path)
  de_ckan: "https://www.govdata.de/ckan/api/3/action",
  de_destatis: "https://www-genesis.destatis.de/genesisWS/rest/2020",
  // Australia (requires /data/ path)
  au_ckan: "https://data.gov.au/data/api/3/action",
  // Brazil
  br_ckan: "https://dados.gov.br/api/3/action",
  br_transparency: "https://api.portaldatransparencia.gov.br/api-de-dados",
  // Peru
  pe_ckan: "https://www.datosabiertos.gob.pe/api/3/action",
  pe_mef: "https://datosabiertos.mef.gob.pe/api/3/action",
  // Mexico
  mx_ckan: "https://datos.gob.mx/busca/api/3/action",
  // Nigeria (via World Bank mainly)
  ng_afdb: "https://projectsapi.afdb.org/rest/projects",
  // South Africa
  za_vulekamali: "https://vulekamali.gov.za/api/v1",
  // Indonesia
  id_ckan: "https://data.go.id/api/3/action",
  // Japan
  jp_estat: "https://api.e-stat.go.jp/rest/3.0/app/json",
  jp_ckan: "https://data.e-gov.go.jp/data/en/api/3/action",
};

const ISO2_TO_ISO3: Record<string, string> = {
  US: "USA", GB: "GBR", DE: "DEU", FR: "FRA", JP: "JPN",
  IN: "IND", BR: "BRA", CA: "CAN", AU: "AUS", PE: "PER",
  MX: "MEX", NG: "NGA", ZA: "ZAF", ID: "IDN",
};

// OECD country codes for fiscal data
const ISO2_TO_OECD: Record<string, string> = {
  US: "USA", GB: "GBR", DE: "DEU", FR: "FRA", JP: "JPN",
  CA: "CAN", AU: "AUS", MX: "MEX", ZA: "ZAF", ID: "IDN",
};

interface GovRequest {
  action: string;
  params?: Record<string, any>;
}

async function fetchJson(url: string, opts?: RequestInit, timeoutMs = 15000): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { ...opts, signal: ctrl.signal });
    if (!resp.ok) return null;
    return await resp.json();
  } catch { return null; }
  finally { clearTimeout(timer); }
}

function treasuryUrl(endpoint: string, params: Record<string, string> = {}): string {
  const base = `${SOURCES.treasury}/${endpoint}?format=json`;
  const extras = Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  return extras ? `${base}&${extras}` : base;
}

async function usaSpendingPost(path: string, body: any): Promise<any> {
  return fetchJson(`${SOURCES.usa_spending}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Generic CKAN dataset fetcher ──
async function fetchCkanDatasets(baseUrl: string, query: string, rows = 20): Promise<any[]> {
  const data = await fetchJson(`${baseUrl}/package_search?q=${encodeURIComponent(query)}&rows=${rows}`);
  if (!data?.result?.results) return [];
  return data.result.results.map((d: any) => ({
    title: d.title,
    notes: (d.notes || d.description || "").substring(0, 200),
    organization: d.organization?.title || d.organization?.name || "",
    resources: (d.resources || []).slice(0, 3).map((r: any) => ({
      format: r.format, url: r.url, name: r.name || r.title,
    })),
    lastModified: d.metadata_modified || d.metadata_created,
  }));
}

// ── Country-specific national data fetcher ──
async function fetchCountryNationalData(cc: string): Promise<{ source: string; datasets?: any[]; departments?: any[]; spending?: any[]; extra?: any }> {
  switch (cc) {
    case "GB": {
      const [finance, spending] = await Promise.all([
        fetchCkanDatasets(SOURCES.uk_ckan, "government expenditure budget finance", 20),
        fetchCkanDatasets(SOURCES.uk_ckan, "spending public sector", 15),
      ]);
      return {
        source: "UK Government Open Data (data.gov.uk)",
        datasets: [...finance, ...spending].filter((d, i, arr) => arr.findIndex(x => x.title === d.title) === i).slice(0, 25),
      };
    }
    case "DE": {
      const [finanz, haushalt] = await Promise.all([
        fetchCkanDatasets(SOURCES.de_ckan, "finanzen haushalt bundeshaushalt", 15),
        fetchCkanDatasets(SOURCES.de_ckan, "ausgaben einnahmen steuer", 10),
      ]);
      return {
        source: "GovData Germany (govdata.de)",
        datasets: [...finanz, ...haushalt].filter((d, i, arr) => arr.findIndex(x => x.title === d.title) === i).slice(0, 20),
      };
    }
    case "FR": {
      const data = await fetchJson(`${SOURCES.fr_data}/datasets/?q=budget+etat+depenses+recettes+finances+publiques&page_size=25`);
      const datasets = (data?.data || []).map((d: any) => ({
        title: d.title,
        notes: (d.description || "").substring(0, 200),
        organization: d.organization?.name || "",
        resources: (d.resources || []).slice(0, 3).map((r: any) => ({ format: r.format, url: r.url, name: r.title })),
        lastModified: d.last_modified,
      }));
      return { source: "data.gouv.fr (France)", datasets };
    }
    case "JP": {
      const datasets = await fetchCkanDatasets(SOURCES.jp_ckan, "budget finance", 15);
      return { source: "Japan e-Gov Open Data", datasets };
    }
    case "IN": {
      // India data.gov.in requires API key; we use World Bank as primary
      return { source: "World Bank + Government of India Open Data", datasets: [] };
    }
    case "BR": {
      const [budget, spending] = await Promise.all([
        fetchCkanDatasets(SOURCES.br_ckan, "orcamento despesa receita", 15),
        fetchCkanDatasets(SOURCES.br_ckan, "transparencia gastos governo", 10),
      ]);
      return {
        source: "dados.gov.br (Brazil) + Portal da Transparência",
        datasets: [...budget, ...spending].filter((d, i, arr) => arr.findIndex(x => x.title === d.title) === i).slice(0, 20),
      };
    }
    case "CA": {
      const [finance, budget] = await Promise.all([
        fetchCkanDatasets(SOURCES.ca_ckan, "government expenditure budget finance", 15),
        fetchCkanDatasets(SOURCES.ca_ckan, "federal spending revenue", 10),
      ]);
      return {
        source: "Open Government Canada",
        datasets: [...finance, ...budget].filter((d, i, arr) => arr.findIndex(x => x.title === d.title) === i).slice(0, 20),
      };
    }
    case "AU": {
      const [finance, budget] = await Promise.all([
        fetchCkanDatasets(SOURCES.au_ckan, "finance budget government", 15),
        fetchCkanDatasets(SOURCES.au_ckan, "spending revenue expenditure", 10),
      ]);
      return {
        source: "data.gov.au (Australia)",
        datasets: [...finance, ...budget].filter((d, i, arr) => arr.findIndex(x => x.title === d.title) === i).slice(0, 20),
      };
    }
    case "PE": {
      const [gob, mef] = await Promise.all([
        fetchCkanDatasets(SOURCES.pe_ckan, "presupuesto finanzas gasto", 15),
        fetchCkanDatasets(SOURCES.pe_mef, "finanzas presupuesto deuda", 10),
      ]);
      return {
        source: "datosabiertos.gob.pe + MEF Peru",
        datasets: [...gob, ...mef].filter((d, i, arr) => arr.findIndex(x => x.title === d.title) === i).slice(0, 20),
      };
    }
    case "MX": {
      const [finanzas, presupuesto] = await Promise.all([
        fetchCkanDatasets(SOURCES.mx_ckan, "finanzas gasto gobierno", 15),
        fetchCkanDatasets(SOURCES.mx_ckan, "presupuesto egresos federacion", 10),
      ]);
      return {
        source: "datos.gob.mx (Mexico)",
        datasets: [...finanzas, ...presupuesto].filter((d, i, arr) => arr.findIndex(x => x.title === d.title) === i).slice(0, 20),
      };
    }
    case "NG": {
      // Nigeria lacks a mature CKAN portal; use AfDB + World Bank
      const afdb = await fetchJson(`${SOURCES.ng_afdb}?paginateResults=true&page=0&lang=en&country=NG`);
      const projects = (afdb?.results || afdb || []).slice?.call?.(afdb?.results || [], 0, 15)?.map?.((p: any) => ({
        title: p.projectName || p.name || "Project",
        notes: (p.projectStatusDescription || "").substring(0, 200),
        organization: "African Development Bank",
        amount: p.approvedAmount || 0,
        currency: p.approvedAmountCurrency || "USD",
      })) || [];
      return { source: "World Bank + African Development Bank", datasets: [], extra: { afdbProjects: projects } };
    }
    case "ZA": {
      const [depts, budget] = await Promise.all([
        fetchJson(`${SOURCES.za_vulekamali}/departments/?format=json`),
        fetchJson(`${SOURCES.za_vulekamali}/budget-summary/?format=json`),
      ]);
      return {
        source: "Vulekamali / National Treasury South Africa",
        departments: (depts?.results || depts || []).slice?.(0, 20)?.map?.((d: any) => ({
          name: d.name, vote: d.vote_number, government: d.government?.name,
          budget: d.total_budget,
        })) || [],
        spending: (budget?.results || budget || []).slice?.(0, 15)?.map?.((b: any) => ({
          name: b.name || b.department, amount: b.total || b.amount,
          year: b.financial_year,
        })) || [],
      };
    }
    case "ID": {
      const datasets = await fetchCkanDatasets(SOURCES.id_ckan, "keuangan anggaran belanja", 15);
      return { source: "data.go.id (Indonesia)", datasets };
    }
    default:
      return { source: "World Bank + IMF", datasets: [] };
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Require authenticated caller — prevent anonymous fan-out to expensive gov APIs
  const { requireUser, authErrorResponse } = await import("../_shared/authMiddleware.ts");
  try { await requireUser(req); } catch (e) { return authErrorResponse(e, corsHeaders); }

  try {
    const body: GovRequest = await req.json();
    const { action, params } = body;
    let result: any;


    switch (action) {

      // ── USA Spending by Agency ──
      case "spending_by_agency": {
        const data = await fetchJson(`${SOURCES.usa_spending}/references/toptier_agencies/`);
        if (!data) throw new Error("USASpending API unavailable");
        const agencies = (data.results || [])
          .filter((a: any) => a.budget_authority_amount > 0)
          .sort((a: any, b: any) => b.budget_authority_amount - a.budget_authority_amount)
          .slice(0, 25)
          .map((a: any) => ({
            name: a.agency_name, abbreviation: a.abbreviation,
            budgetAuthority: a.budget_authority_amount,
            obligatedAmount: a.obligated_amount, outlayAmount: a.outlay_amount,
          }));
        const total = agencies.reduce((s: number, a: any) => s + (a.budgetAuthority || 0), 0);
        result = { country: "USA", source: "USASpending.gov", totalBudget: total, agencies };
        break;
      }

      // ── Treasury Debt ──
      case "treasury_debt": {
        const data = await fetchJson(treasuryUrl("v2/accounting/od/debt_to_penny", { sort: "-record_date", "page[size]": "30" }));
        if (!data) throw new Error("Treasury API unavailable");
        result = {
          country: "USA", source: "US Treasury Fiscal Data",
          debtData: (data.data || []).map((d: any) => ({
            date: d.record_date,
            totalDebt: parseFloat(d.tot_pub_debt_out_amt || "0"),
            publicDebt: parseFloat(d.debt_held_public_amt || "0"),
          })),
        };
        break;
      }

      // ── Treasury Revenue ──
      case "treasury_revenue": {
        const data = await fetchJson(treasuryUrl("v1/accounting/mts/mts_table_1", { sort: "-record_date", "page[size]": "50" }));
        if (!data) {
          const fb = await fetchJson(treasuryUrl("v2/accounting/od/statement_net_cost", { sort: "-record_date", "page[size]": "30" }));
          result = { country: "USA", source: "US Treasury Fiscal Data", revenue: fb?.data || [] };
        } else {
          result = { country: "USA", source: "US Treasury Fiscal Data", revenue: data.data || [] };
        }
        break;
      }

      case "treasury_net_cost": {
        const data = await fetchJson(treasuryUrl("v2/accounting/od/statement_net_cost", { sort: "-record_date", "page[size]": "200" }));
        if (!data?.data) throw new Error("Treasury Net Cost API unavailable");
        const byAgency: Record<string, any> = {};
        for (const row of data.data) {
          const key = row.agency_nm;
          if (!key) continue;
          if (!byAgency[key] || row.record_date > byAgency[key].record_date) byAgency[key] = row;
        }
        const agencies = Object.values(byAgency)
          .map((r: any) => ({
            agency: r.agency_nm, fiscalYear: r.stmt_fiscal_year,
            grossCostBil: parseFloat(r.gross_cost_bil_amt || "0"),
            earnedRevenueBil: parseFloat(r.earned_revenue_bil_amt || "0"),
            netCostBil: parseFloat(r.net_cost_bil_amt || "0"),
            recordDate: r.record_date,
          }))
          .sort((a: any, b: any) => b.netCostBil - a.netCostBil);
        const totalNetCost = agencies.reduce((s: number, a: any) => s + a.netCostBil, 0);
        result = { country: "USA", source: "US Treasury – Statements of Net Cost", totalNetCostBillions: totalNetCost, agencyCount: agencies.length, agencies };
        break;
      }

      case "treasury_mts_summary": {
        const data = await fetchJson(treasuryUrl("v1/accounting/mts/mts_table_1", {
          sort: "-record_date", "page[size]": "100",
          filter: "line_code_nbr:in:(100,200,300),record_type_cd:eq:F",
        }));
        if (!data?.data) throw new Error("MTS Table 1 unavailable");
        result = {
          country: "USA", source: "Monthly Treasury Statement (MTS) – Table 1",
          data: (data.data || []).map((r: any) => ({
            date: r.record_date, description: r.classification_desc, lineCode: r.line_code_nbr,
            currentMonthReceipts: parseFloat(r.current_month_gross_rcpt_amt || "0"),
            currentMonthOutlays: parseFloat(r.current_month_gross_outly_amt || "0"),
            deficitSurplus: parseFloat(r.current_month_dfct_sur_amt || "0"),
            fiscalYear: r.record_fiscal_year,
          })),
        };
        break;
      }

      case "usa_spending_by_function": {
        const fy = params?.fiscalYear || new Date().getFullYear().toString();
        const data = await usaSpendingPost("/spending/", { type: "budget_function", filters: { fy, quarter: "4" } });
        if (!data) throw new Error("USASpending budget function API unavailable");
        result = {
          country: "USA", source: "USASpending.gov – Budget Functions", fiscalYear: fy,
          totalSpending: data.total,
          functions: (data.results || []).map((r: any) => ({
            name: r.name, code: r.code, amount: r.amount,
            percentOfTotal: data.total > 0 ? ((r.amount / data.total) * 100).toFixed(2) : "0",
          })),
        };
        break;
      }

      case "usa_top_awarding_agencies": {
        const year = params?.year || new Date().getFullYear();
        const data = await usaSpendingPost("/search/spending_by_category/awarding_agency/", {
          filters: { time_period: [{ start_date: `${year}-01-01`, end_date: `${year}-12-31` }] },
          limit: 20,
        });
        if (!data) throw new Error("USASpending category API unavailable");
        result = {
          country: "USA", source: "USASpending.gov – Top Awarding Agencies", year,
          agencies: (data.results || []).map((r: any) => ({ name: r.name, code: r.code, amount: r.amount })),
        };
        break;
      }

      case "treasury_interest": {
        const data = await fetchJson(treasuryUrl("v2/accounting/od/avg_interest_rates", { sort: "-record_date", "page[size]": "50" }));
        if (!data?.data) throw new Error("Treasury Interest Rates API unavailable");
        result = {
          country: "USA", source: "US Treasury – Average Interest Rates on Debt",
          rates: (data.data || []).slice(0, 30).map((r: any) => ({
            date: r.record_date, securityType: r.security_type_desc,
            avgInterestRate: parseFloat(r.avg_interest_rate_amt || "0"),
          })),
        };
        break;
      }

      case "usa_spending_by_award": {
        const fy = params?.fiscalYear || new Date().getFullYear();
        const awardTypes = params?.awardTypes || ["A", "B", "C", "D"];
        const data = await usaSpendingPost("/search/spending_by_award/", {
          filters: {
            time_period: [{ start_date: `${fy - 1}-10-01`, end_date: `${fy}-09-30` }],
            award_type_codes: awardTypes,
          },
          fields: ["Award ID", "Recipient Name", "Award Amount", "Awarding Agency", "Award Type", "Description", "Start Date", "End Date"],
          limit: params?.limit || 25, page: 1, sort: "Award Amount", order: "desc",
        });
        if (!data) throw new Error("USASpending awards API unavailable");
        result = { country: "USA", source: "USASpending.gov – Federal Awards", fiscalYear: fy, results: data.results || [], totalResults: data.page_metadata?.total || 0 };
        break;
      }

      case "usa_spending_by_state": {
        const fips = params?.fips || "06";
        const data = await fetchJson(`${SOURCES.usa_spending}/recipient/state/${fips}/`);
        if (!data) throw new Error("USASpending state API unavailable");
        result = {
          country: "USA", source: "USASpending.gov – State Spending",
          state: data.name, code: data.code, fips: data.fips,
          population: data.population, medianIncome: data.median_household_income,
          totalPrimeAmount: data.total_prime_amount, totalAwards: data.total_prime_awards,
          awardPerCapita: data.award_amount_per_capita, totalOutlays: data.total_outlays,
        };
        break;
      }

      case "treasury_exchange_rates": {
        const data = await fetchJson(treasuryUrl("v1/accounting/od/rates_of_exchange", { sort: "-record_date", "page[size]": "100" }));
        if (!data?.data) throw new Error("Treasury Exchange Rates API unavailable");
        result = {
          country: "USA", source: "US Treasury – Exchange Rates",
          rates: data.data.map((r: any) => ({ date: r.record_date, currency: r.country_currency_desc, rate: parseFloat(r.exchange_rate || "0") })),
        };
        break;
      }

      case "census_state_finances": {
        const year = params?.year || "2022";
        const [popData, incomeData] = await Promise.all([
          fetchJson(`${SOURCES.census}/${year}/acs/acs5?get=NAME,B01001_001E&for=state:*`),
          fetchJson(`${SOURCES.census}/${year}/acs/acs5?get=NAME,B19013_001E&for=state:*`),
        ]);
        const states: any[] = [];
        if (popData && popData.length > 1) {
          const popMap: Record<string, number> = {};
          const incMap: Record<string, number> = {};
          for (let i = 1; i < popData.length; i++) popMap[popData[i][0]] = parseInt(popData[i][1] || "0");
          if (incomeData && incomeData.length > 1) {
            for (let i = 1; i < incomeData.length; i++) incMap[incomeData[i][0]] = parseInt(incomeData[i][1] || "0");
          }
          for (const [name, pop] of Object.entries(popMap)) states.push({ name, population: pop, medianIncome: incMap[name] || null });
          states.sort((a, b) => b.population - a.population);
        }
        result = { country: "USA", source: `US Census Bureau – ACS ${year}`, year, stateCount: states.length, states };
        break;
      }

      case "fred_series": {
        const fredKey = Deno.env.get("FRED_API_KEY");
        if (!fredKey) throw new Error("FRED_API_KEY not configured — add via Settings");
        const seriesId = params?.seriesId || "GDP";
        const data = await fetchJson(`${SOURCES.fred}/series/observations?series_id=${seriesId}&api_key=${fredKey}&file_type=json&sort_order=desc&limit=${params?.limit || 20}`);
        if (!data?.observations) throw new Error("FRED API unavailable");
        result = {
          country: "USA", source: `Federal Reserve (FRED) – ${seriesId}`, series: seriesId,
          observations: data.observations.map((o: any) => ({ date: o.date, value: o.value === "." ? null : parseFloat(o.value) })),
        };
        break;
      }

      // ══════════════════════════════════════════════════════════════
      // World Bank Indicators (any country)
      // ══════════════════════════════════════════════════════════════
      case "world_bank_indicators": {
        const cc = params?.countryCode || "US";
        const indicators = params?.indicators || [
          "GC.XPN.TOTL.GD.ZS", "GC.REV.XGRT.GD.ZS", "GC.DOD.TOTL.GD.ZS",
          "MS.MIL.XPND.GD.ZS", "SH.XPD.CHEX.GD.ZS", "SE.XPD.TOTL.GD.ZS",
          "NY.GDP.MKTP.CD", "SP.POP.TOTL",
        ];
        const dateRange = params?.dateRange || "2015:2023";
        const indicatorResults: Record<string, any[]> = {};
        const results = await Promise.all(indicators.map(async (ind: string) => {
          const json = await fetchJson(`${SOURCES.world_bank}/country/${cc}/indicator/${ind}?format=json&date=${dateRange}&per_page=100`);
          return { indicator: ind, data: (json?.[1] || []).filter((d: any) => d.value !== null) };
        }));
        results.forEach((r: any) => { indicatorResults[r.indicator] = r.data; });
        result = { countryCode: cc, source: "World Bank Open Data", indicators: indicatorResults };
        break;
      }

      // ── Country Comparison ──
      case "country_comparison": {
        const countries = params?.countries || ["US", "GB", "DE", "FR", "JP", "CN", "IN", "BR", "CA", "AU"];
        const indicator = params?.indicator || "GC.XPN.TOTL.GD.ZS";
        const year = params?.year || "2022";
        const codes = countries.join(";");
        const json = await fetchJson(`${SOURCES.world_bank}/country/${codes}/indicator/${indicator}?format=json&date=${year}&per_page=500`);
        const comparisonData = (json?.[1] || [])
          .filter((d: any) => d.value !== null)
          .map((d: any) => ({ countryCode: d.countryiso3code, countryName: d.country?.value, value: d.value, year: d.date, indicator: d.indicator?.value }))
          .sort((a: any, b: any) => b.value - a.value);
        result = { source: "World Bank Open Data", indicator, indicatorName: comparisonData[0]?.indicator || indicator, year, countries: comparisonData };
        break;
      }

      // ── IMF DataMapper ──
      case "imf_fiscal": {
        const cc = params?.countryCode || "US";
        const iso3 = ISO2_TO_ISO3[cc] || cc;
        const imfIndicators = ["GGXWDG_NGDP", "GGR_G01_GDP_PT", "GGXCNL_NGDP", "NGDP_RPCH", "PCPIPCH", "LUR"];
        const periods = "2020,2021,2022,2023,2024,2025";
        const imfResults: Record<string, any> = {};
        const fetches = imfIndicators.map(async (ind) => {
          const data = await fetchJson(`${SOURCES.imf_dm}/${ind}?periods=${periods}`);
          if (data?.values?.[ind]?.[iso3]) imfResults[ind] = { values: data.values[ind][iso3], label: ind };
        });
        await Promise.all(fetches);
        result = { countryCode: cc, iso3, source: "IMF World Economic Outlook (DataMapper)", indicators: imfResults };
        break;
      }

      // ══════════════════════════════════════════════════════════════
      // Individual country dataset endpoints
      // ══════════════════════════════════════════════════════════════
      case "uk_spending": {
        const datasets = await fetchCkanDatasets(SOURCES.uk_ckan, "government expenditure budget spending", 20);
        result = { country: "UK", source: "UK Government Open Data (data.gov.uk)", datasetCount: datasets.length, datasets };
        break;
      }
      case "de_spending": {
        const datasets = await fetchCkanDatasets(SOURCES.de_ckan, "finanzen haushalt bundeshaushalt ausgaben", 20);
        result = { country: "Germany", source: "GovData Germany", datasetCount: datasets.length, datasets };
        break;
      }
      case "fr_spending": {
        const data = await fetchJson(`${SOURCES.fr_data}/datasets/?q=budget+etat+depenses+recettes&page_size=20`);
        const datasets = (data?.data || []).map((d: any) => ({
          title: d.title, notes: (d.description || "").substring(0, 200),
          organization: d.organization?.name,
          resources: (d.resources || []).slice(0, 3).map((r: any) => ({ format: r.format, url: r.url, name: r.title })),
        }));
        result = { country: "France", source: "data.gouv.fr", datasetCount: data?.total || datasets.length, datasets };
        break;
      }
      case "ca_spending": {
        const datasets = await fetchCkanDatasets(SOURCES.ca_ckan, "government expenditure budget", 20);
        result = { country: "Canada", source: "Open Government Canada", datasetCount: datasets.length, datasets };
        break;
      }
      case "au_spending": {
        const datasets = await fetchCkanDatasets(SOURCES.au_ckan, "finance budget government spending", 20);
        result = { country: "Australia", source: "data.gov.au", datasetCount: datasets.length, datasets };
        break;
      }
      case "br_spending": {
        const datasets = await fetchCkanDatasets(SOURCES.br_ckan, "orcamento despesa receita transparencia", 20);
        result = { country: "Brazil", source: "dados.gov.br", datasetCount: datasets.length, datasets };
        break;
      }
      case "pe_spending": {
        const [gob, mef] = await Promise.all([
          fetchCkanDatasets(SOURCES.pe_ckan, "presupuesto finanzas", 10),
          fetchCkanDatasets(SOURCES.pe_mef, "finanzas presupuesto", 10),
        ]);
        const datasets = [...gob, ...mef];
        result = { country: "Peru", source: "datosabiertos.gob.pe + MEF", datasetCount: datasets.length, datasets };
        break;
      }
      case "mx_spending": {
        const datasets = await fetchCkanDatasets(SOURCES.mx_ckan, "finanzas presupuesto egresos", 20);
        result = { country: "Mexico", source: "datos.gob.mx", datasetCount: datasets.length, datasets };
        break;
      }
      case "za_spending": {
        const [depts, budget] = await Promise.all([
          fetchJson(`${SOURCES.za_vulekamali}/departments/?format=json`),
          fetchJson(`${SOURCES.za_vulekamali}/budget-summary/?format=json`),
        ]);
        result = {
          country: "South Africa", source: "Vulekamali / National Treasury",
          departments: (depts?.results || []).slice(0, 20).map((d: any) => ({ name: d.name, vote: d.vote_number, government: d.government?.name, budget: d.total_budget })),
          spending: (budget?.results || []).slice(0, 15).map((b: any) => ({ name: b.name || b.department, amount: b.total || b.amount, year: b.financial_year })),
        };
        break;
      }
      case "id_spending": {
        const datasets = await fetchCkanDatasets(SOURCES.id_ckan, "keuangan anggaran belanja negara", 20);
        result = { country: "Indonesia", source: "data.go.id", datasetCount: datasets.length, datasets };
        break;
      }
      case "ng_spending": {
        // Nigeria: rely on World Bank + AfDB
        const [wbDebt, afdb] = await Promise.all([
          fetchJson(`${SOURCES.world_bank}/country/NG/indicator/GC.DOD.TOTL.GD.ZS?format=json&date=2018:2023&per_page=20`),
          fetchJson(`${SOURCES.ng_afdb}?paginateResults=true&page=0&lang=en&country=NG`),
        ]);
        result = {
          country: "Nigeria", source: "World Bank + African Development Bank",
          debtData: (wbDebt?.[1] || []).filter((d: any) => d.value !== null),
          afdbProjects: ((afdb?.results || []) as any[]).slice(0, 15).map((p: any) => ({
            name: p.projectName || p.name, amount: p.approvedAmount, currency: p.approvedAmountCurrency || "USD",
          })),
        };
        break;
      }

      // ══════════════════════════════════════════════════════════════
      // OECD Fiscal Data (for OECD member countries)
      // ══════════════════════════════════════════════════════════════
      case "oecd_fiscal": {
        const cc = params?.countryCode || "US";
        const oecdCode = ISO2_TO_OECD[cc];
        if (!oecdCode) {
          result = { error: `${cc} is not an OECD member or not mapped`, source: "OECD" };
          break;
        }
        const data = await fetchJson(`${SOURCES.oecd}/GOV_REVENUES/${oecdCode}/all?startTime=2018&dimensionAtObservation=allDimensions`, undefined, 20000);
        result = {
          countryCode: cc, source: "OECD Government Revenue Statistics",
          data: data?.dataSets?.[0]?.observations ? "Data available" : "No data returned",
          raw: data?.dataSets?.[0]?.observations ? Object.keys(data.dataSets[0].observations).length + " observations" : null,
        };
        break;
      }

      // ══════════════════════════════════════════════════════════════
      // Comprehensive country fiscal profile (aggregates ALL sources)
      // ══════════════════════════════════════════════════════════════
      case "country_fiscal_profile": {
        const cc = params?.countryCode || "US";
        const iso3 = ISO2_TO_ISO3[cc] || cc;

        // Parallel: World Bank + IMF + country-specific national data
        const [wbData, imfDebt, imfRev, imfBalance, imfGrowth, imfInflation, nationalData] = await Promise.all([
          fetchJson(`${SOURCES.world_bank}/country/${cc}/indicator/NY.GDP.MKTP.CD;GC.XPN.TOTL.GD.ZS;GC.REV.XGRT.GD.ZS;GC.DOD.TOTL.GD.ZS;SH.XPD.CHEX.GD.ZS;SE.XPD.TOTL.GD.ZS;MS.MIL.XPND.GD.ZS;SP.POP.TOTL?format=json&date=2018:2023&per_page=200`),
          fetchJson(`${SOURCES.imf_dm}/GGXWDG_NGDP?periods=2020,2021,2022,2023,2024,2025`),
          fetchJson(`${SOURCES.imf_dm}/GGR_G01_GDP_PT?periods=2020,2021,2022,2023,2024,2025`),
          fetchJson(`${SOURCES.imf_dm}/GGXCNL_NGDP?periods=2020,2021,2022,2023,2024,2025`),
          fetchJson(`${SOURCES.imf_dm}/NGDP_RPCH?periods=2020,2021,2022,2023,2024,2025`),
          fetchJson(`${SOURCES.imf_dm}/PCPIPCH?periods=2020,2021,2022,2023,2024,2025`),
          fetchCountryNationalData(cc),
        ]);

        // Parse World Bank
        const wbIndicators: Record<string, any[]> = {};
        if (wbData?.[1]) {
          for (const entry of wbData[1]) {
            const id = entry.indicator?.id;
            if (!id) continue;
            if (!wbIndicators[id]) wbIndicators[id] = [];
            if (entry.value !== null) wbIndicators[id].push({ date: entry.date, value: entry.value });
          }
        }

        // Parse IMF
        const imf: Record<string, Record<string, number>> = {};
        const imfSources = [
          { key: "debt_gdp", data: imfDebt, ind: "GGXWDG_NGDP" },
          { key: "revenue_gdp", data: imfRev, ind: "GGR_G01_GDP_PT" },
          { key: "fiscal_balance", data: imfBalance, ind: "GGXCNL_NGDP" },
          { key: "gdp_growth", data: imfGrowth, ind: "NGDP_RPCH" },
          { key: "inflation", data: imfInflation, ind: "PCPIPCH" },
        ];
        for (const s of imfSources) {
          const vals = s.data?.values?.[s.ind]?.[iso3];
          if (vals) imf[s.key] = vals;
        }

        // ── USA-specific expanded data ──
        let usaAgencies: any[] = [];
        let usaNetCost: any[] = [];
        let usaBudgetFunctions: any[] = [];
        let usaTopAwarding: any[] = [];
        let usaDebtTimeline: any[] = [];
        let usaMtsSummary: any[] = [];
        let usaInterestRates: any[] = [];
        let usaTotalSpending = 0;
        let usaTopAwards: any[] = [];
        let usaTopStates: any[] = [];
        let usaCensusStates: any[] = [];
        let usaExchangeRates: any[] = [];
        let usaFredData: Record<string, any[]> = {};

        if (cc === "US") {
          const [agencyData, netCostData, budgetFuncData, topAwardData, debtData, mtsData, interestData] = await Promise.all([
            fetchJson(`${SOURCES.usa_spending}/references/toptier_agencies/`),
            fetchJson(treasuryUrl("v2/accounting/od/statement_net_cost", { sort: "-record_date", "page[size]": "200" })),
            usaSpendingPost("/spending/", { type: "budget_function", filters: { fy: new Date().getFullYear().toString(), quarter: "4" } }),
            usaSpendingPost("/search/spending_by_category/awarding_agency/", {
              filters: { time_period: [{ start_date: `${new Date().getFullYear() - 1}-01-01`, end_date: `${new Date().getFullYear() - 1}-12-31` }] },
              limit: 20,
            }),
            fetchJson(treasuryUrl("v2/accounting/od/debt_to_penny", { sort: "-record_date", "page[size]": "30" })),
            fetchJson(treasuryUrl("v1/accounting/mts/mts_table_1", { sort: "-record_date", "page[size]": "50", filter: "line_code_nbr:in:(100,200,300),record_type_cd:eq:F" })),
            fetchJson(treasuryUrl("v2/accounting/od/avg_interest_rates", { sort: "-record_date", "page[size]": "30" })),
          ]);

          const topStateFips = ["06", "48", "12", "36", "17"];
          const fredKey = Deno.env.get("FRED_API_KEY");
          const fredSeries = fredKey ? ["GDP", "GFDEBTN", "FYFR", "UNRATE", "CPIAUCSL"] : [];

          const wave2Promises: Promise<any>[] = [
            usaSpendingPost("/search/spending_by_award/", {
              filters: { time_period: [{ start_date: `${new Date().getFullYear() - 1}-10-01`, end_date: `${new Date().getFullYear()}-09-30` }], award_type_codes: ["A", "B", "C", "D"] },
              fields: ["Award ID", "Recipient Name", "Award Amount", "Awarding Agency", "Award Type"],
              limit: 15, page: 1, sort: "Award Amount", order: "desc",
            }),
            fetchJson(treasuryUrl("v1/accounting/od/rates_of_exchange", { sort: "-record_date", "page[size]": "50" })),
            fetchJson(`${SOURCES.census}/2022/acs/acs5?get=NAME,B01001_001E,B19013_001E&for=state:*`),
            ...topStateFips.map(f => fetchJson(`${SOURCES.usa_spending}/recipient/state/${f}/`)),
            ...fredSeries.map(s => fetchJson(`${SOURCES.fred}/series/observations?series_id=${s}&api_key=${fredKey}&file_type=json&sort_order=desc&limit=12`)),
          ];

          const wave2Results = await Promise.all(wave2Promises);
          let idx = 0;
          const awardsData = wave2Results[idx++];
          const exchangeData = wave2Results[idx++];
          const censusData = wave2Results[idx++];
          const stateResults = topStateFips.map(() => wave2Results[idx++]);
          const fredResults = fredSeries.map(() => wave2Results[idx++]);

          if (agencyData?.results) {
            usaAgencies = agencyData.results.filter((a: any) => a.budget_authority_amount > 0)
              .sort((a: any, b: any) => b.budget_authority_amount - a.budget_authority_amount).slice(0, 20)
              .map((a: any) => ({ name: a.agency_name, abbreviation: a.abbreviation, budgetAuthority: a.budget_authority_amount, obligated: a.obligated_amount, outlays: a.outlay_amount }));
          }
          if (netCostData?.data) {
            const byAgency: Record<string, any> = {};
            for (const row of netCostData.data) { if (!row.agency_nm) continue; if (!byAgency[row.agency_nm] || row.record_date > byAgency[row.agency_nm].record_date) byAgency[row.agency_nm] = row; }
            usaNetCost = Object.values(byAgency).map((r: any) => ({ agency: r.agency_nm, fiscalYear: r.stmt_fiscal_year, grossCostBil: parseFloat(r.gross_cost_bil_amt || "0"), earnedRevenueBil: parseFloat(r.earned_revenue_bil_amt || "0"), netCostBil: parseFloat(r.net_cost_bil_amt || "0") })).sort((a: any, b: any) => b.netCostBil - a.netCostBil);
          }
          if (budgetFuncData?.results) {
            usaTotalSpending = budgetFuncData.total || 0;
            usaBudgetFunctions = budgetFuncData.results.map((r: any) => ({ name: r.name, code: r.code, amount: r.amount, percentOfTotal: usaTotalSpending > 0 ? ((r.amount / usaTotalSpending) * 100) : 0 }));
          }
          if (topAwardData?.results) usaTopAwarding = topAwardData.results.map((r: any) => ({ name: r.name, code: r.code, amount: r.amount }));
          if (debtData?.data) usaDebtTimeline = debtData.data.map((d: any) => ({ date: d.record_date, totalDebt: parseFloat(d.tot_pub_debt_out_amt || "0"), publicDebt: parseFloat(d.debt_held_public_amt || "0") }));
          if (mtsData?.data) usaMtsSummary = mtsData.data.map((r: any) => ({ date: r.record_date, description: r.classification_desc, lineCode: r.line_code_nbr, fiscalYear: r.record_fiscal_year, receipts: parseFloat(r.current_month_gross_rcpt_amt || "0"), outlays: parseFloat(r.current_month_gross_outly_amt || "0"), deficitSurplus: parseFloat(r.current_month_dfct_sur_amt || "0") }));
          if (interestData?.data) usaInterestRates = interestData.data.slice(0, 20).map((r: any) => ({ date: r.record_date, securityType: r.security_type_desc, avgRate: parseFloat(r.avg_interest_rate_amt || "0") }));
          if (awardsData?.results) usaTopAwards = awardsData.results.map((r: any) => ({ awardId: r["Award ID"], recipient: r["Recipient Name"], amount: r["Award Amount"], agency: r["Awarding Agency"], type: r["Award Type"] }));
          if (exchangeData?.data) usaExchangeRates = exchangeData.data.slice(0, 20).map((r: any) => ({ date: r.record_date, currency: r.country_currency_desc, rate: parseFloat(r.exchange_rate || "0") }));
          if (censusData && censusData.length > 1) {
            for (let i = 1; i < censusData.length; i++) usaCensusStates.push({ name: censusData[i][0], population: parseInt(censusData[i][1] || "0"), medianIncome: parseInt(censusData[i][2] || "0") });
            usaCensusStates.sort((a, b) => b.population - a.population);
            usaCensusStates = usaCensusStates.slice(0, 15);
          }
          for (let i = 0; i < topStateFips.length; i++) {
            const sd = stateResults[i];
            if (sd?.name) usaTopStates.push({ name: sd.name, code: sd.code, population: sd.population, totalPrimeAmount: sd.total_prime_amount, totalAwards: sd.total_prime_awards, awardPerCapita: sd.award_amount_per_capita, totalOutlays: sd.total_outlays, medianIncome: sd.median_household_income });
          }
          for (let i = 0; i < fredSeries.length; i++) {
            const fd = fredResults[i];
            if (fd?.observations) usaFredData[fredSeries[i]] = fd.observations.slice(0, 8).map((o: any) => ({ date: o.date, value: o.value === "." ? null : parseFloat(o.value) }));
          }
        }

        // Peer comparison
        const peerCountries = ["US", "GB", "DE", "FR", "JP", "IN", "BR", "CA", "AU", "PE", "MX", "ZA"].filter(c => c !== cc);
        const peerIso3 = peerCountries.map(c => ISO2_TO_ISO3[c] || c);
        const peerDebt: Record<string, number> = {};
        const peerRev: Record<string, number> = {};
        if (imfDebt?.values?.GGXWDG_NGDP) {
          for (const p of peerIso3) { const vals = imfDebt.values.GGXWDG_NGDP[p]; if (vals) { const latest = Object.entries(vals).sort((a, b) => Number(b[0]) - Number(a[0]))[0]; if (latest) peerDebt[p] = latest[1] as number; } }
        }
        if (imfRev?.values?.GGR_G01_GDP_PT) {
          for (const p of peerIso3) { const vals = imfRev.values.GGR_G01_GDP_PT[p]; if (vals) { const latest = Object.entries(vals).sort((a, b) => Number(b[0]) - Number(a[0]))[0]; if (latest) peerRev[p] = latest[1] as number; } }
        }

        result = {
          countryCode: cc, iso3,
          sources: [
            "World Bank Open Data", "IMF World Economic Outlook",
            ...(nationalData.source ? [nationalData.source] : []),
            ...(cc === "US" ? [
              "USASpending.gov – Agency Budgets", "USASpending.gov – Budget Functions",
              "USASpending.gov – Top Awarding Agencies", "USASpending.gov – Federal Awards (Contracts)",
              "USASpending.gov – State-Level Spending",
              "US Treasury Fiscal Data – Debt to the Penny", "US Treasury – Statements of Net Cost",
              "US Treasury – Monthly Treasury Statement (MTS)", "US Treasury – Average Interest Rates on Debt",
              "US Treasury – Exchange Rates", "US Census Bureau – ACS Demographics",
              ...(Object.keys(usaFredData).length ? ["Federal Reserve (FRED) – Economic Indicators"] : []),
            ] : []),
          ],
          worldBank: wbIndicators,
          imf,
          // Country-specific national datasets
          nationalDatasets: nationalData.datasets || [],
          nationalDepartments: nationalData.departments || [],
          nationalSpending: nationalData.spending || [],
          nationalExtra: nationalData.extra || null,
          nationalSource: nationalData.source,
          // USA-specific
          usaAgencies, usaNetCost, usaBudgetFunctions, usaTotalSpending,
          usaTopAwarding, usaDebtTimeline, usaMtsSummary, usaInterestRates,
          usaTopAwards, usaTopStates, usaCensusStates, usaExchangeRates, usaFredData,
          peerComparison: { debt: peerDebt, revenue: peerRev },
        };
        break;
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("gov-data error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
