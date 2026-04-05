import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SOURCES = {
  usa_spending: "https://api.usaspending.gov/api/v2",
  treasury: "https://api.fiscaldata.treasury.gov/services/api/fiscal_service",
  census: "https://api.census.gov/data",
  fred: "https://api.stlouisfed.org/fred",
  world_bank: "https://api.worldbank.org/v2",
  imf_dm: "https://www.imf.org/external/datamapper/api/v1",
  uk_ckan: "https://ckan.publishing.service.gov.uk/api/3/action",
  fr_data: "https://www.data.gouv.fr/api/1",
  ca_ckan: "https://open.canada.ca/data/api/3/action",
};

const ISO2_TO_ISO3: Record<string, string> = {
  US: "USA", GB: "GBR", DE: "DEU", FR: "FRA", JP: "JPN",
  IN: "IND", BR: "BRA", CA: "CAN", AU: "AUS", PE: "PER",
  MX: "MEX", NG: "NGA", ZA: "ZAF", ID: "IDN",
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

// ── Treasury Fiscal Data helpers (URL-encode brackets for page[size]) ──
function treasuryUrl(endpoint: string, params: Record<string, string> = {}): string {
  const base = `${SOURCES.treasury}/${endpoint}?format=json`;
  const extras = Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  return extras ? `${base}&${extras}` : base;
}

// ── USASpending POST helper ──
async function usaSpendingPost(path: string, body: any): Promise<any> {
  return fetchJson(`${SOURCES.usa_spending}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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

      // ── Treasury Revenue (Monthly Treasury Statement Table 1) ──
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

      // ══════════════════════════════════════════════════════════════
      // NEW: Treasury — Statements of Net Cost (by agency)
      // https://fiscaldata.treasury.gov/datasets/u-s-government-financial-report/statements-of-net-cost
      // ══════════════════════════════════════════════════════════════
      case "treasury_net_cost": {
        const data = await fetchJson(treasuryUrl("v2/accounting/od/statement_net_cost", {
          sort: "-record_date", "page[size]": "200",
        }));
        if (!data?.data) throw new Error("Treasury Net Cost API unavailable");
        // Group by agency and get latest fiscal year
        const byAgency: Record<string, any> = {};
        for (const row of data.data) {
          const key = row.agency_nm;
          if (!key) continue;
          if (!byAgency[key] || row.record_date > byAgency[key].record_date) {
            byAgency[key] = row;
          }
        }
        const agencies = Object.values(byAgency)
          .map((r: any) => ({
            agency: r.agency_nm,
            fiscalYear: r.stmt_fiscal_year,
            grossCostBil: parseFloat(r.gross_cost_bil_amt || "0"),
            earnedRevenueBil: parseFloat(r.earned_revenue_bil_amt || "0"),
            netCostBil: parseFloat(r.net_cost_bil_amt || "0"),
            recordDate: r.record_date,
          }))
          .sort((a: any, b: any) => b.netCostBil - a.netCostBil);
        const totalNetCost = agencies.reduce((s: number, a: any) => s + a.netCostBil, 0);
        result = {
          country: "USA", source: "US Treasury – Statements of Net Cost (Financial Report)",
          totalNetCostBillions: totalNetCost, agencyCount: agencies.length, agencies,
        };
        break;
      }

      // ══════════════════════════════════════════════════════════════
      // NEW: Monthly Treasury Statement — Receipts & Outlays (Table 1)
      // Summary-level federal receipts, outlays, and deficit/surplus
      // ══════════════════════════════════════════════════════════════
      case "treasury_mts_summary": {
        // Get summary lines (line_code_nbr 100=receipts, 200=outlays, 300=deficit)
        const data = await fetchJson(treasuryUrl("v1/accounting/mts/mts_table_1", {
          sort: "-record_date",
          "page[size]": "100",
          filter: "line_code_nbr:in:(100,200,300),record_type_cd:eq:F",
        }));
        if (!data?.data) throw new Error("MTS Table 1 unavailable");
        const summaries = (data.data || []).map((r: any) => ({
          date: r.record_date,
          description: r.classification_desc,
          lineCode: r.line_code_nbr,
          currentMonthReceipts: parseFloat(r.current_month_gross_rcpt_amt || "0"),
          currentMonthOutlays: parseFloat(r.current_month_gross_outly_amt || "0"),
          deficitSurplus: parseFloat(r.current_month_dfct_sur_amt || "0"),
          fiscalYear: r.record_fiscal_year,
        }));
        result = { country: "USA", source: "Monthly Treasury Statement (MTS) – Table 1", data: summaries };
        break;
      }

      // ══════════════════════════════════════════════════════════════
      // NEW: USASpending — Spending by Budget Function
      // Federal spending broken down by function (Defense, Medicare, etc.)
      // ══════════════════════════════════════════════════════════════
      case "usa_spending_by_function": {
        const fy = params?.fiscalYear || new Date().getFullYear().toString();
        const data = await usaSpendingPost("/spending/", {
          type: "budget_function",
          filters: { fy, quarter: "4" },
        });
        if (!data) throw new Error("USASpending budget function API unavailable");
        result = {
          country: "USA", source: "USASpending.gov – Budget Functions",
          fiscalYear: fy, totalSpending: data.total,
          functions: (data.results || []).map((r: any) => ({
            name: r.name, code: r.code, amount: r.amount,
            percentOfTotal: data.total > 0 ? ((r.amount / data.total) * 100).toFixed(2) : "0",
          })),
        };
        break;
      }

      // ══════════════════════════════════════════════════════════════
      // NEW: USASpending — Top Awarding Agencies (contract/grant recipients)
      // ══════════════════════════════════════════════════════════════
      case "usa_top_awarding_agencies": {
        const year = params?.year || new Date().getFullYear();
        const data = await usaSpendingPost("/search/spending_by_category/awarding_agency/", {
          filters: {
            time_period: [{ start_date: `${year}-01-01`, end_date: `${year}-12-31` }],
          },
          limit: 20,
        });
        if (!data) throw new Error("USASpending category API unavailable");
        result = {
          country: "USA", source: "USASpending.gov – Top Awarding Agencies",
          year,
          agencies: (data.results || []).map((r: any) => ({
            name: r.name, code: r.code, amount: r.amount,
          })),
        };
        break;
      }

      // ══════════════════════════════════════════════════════════════
      // NEW: Treasury — Interest on Debt (critical for waste analysis)
      // ══════════════════════════════════════════════════════════════
      case "treasury_interest": {
        const data = await fetchJson(treasuryUrl("v2/accounting/od/avg_interest_rates", {
          sort: "-record_date", "page[size]": "50",
        }));
        if (!data?.data) throw new Error("Treasury Interest Rates API unavailable");
        result = {
          country: "USA", source: "US Treasury – Average Interest Rates on Debt",
          rates: (data.data || []).slice(0, 30).map((r: any) => ({
            date: r.record_date,
            securityType: r.security_type_desc,
            avgInterestRate: parseFloat(r.avg_interest_rate_amt || "0"),
          })),
        };
        break;
      }

      // ══════════════════════════════════════════════════════════════
      // USASpending — Spending by Award (contracts/grants search)
      // ══════════════════════════════════════════════════════════════
      case "usa_spending_by_award": {
        const fy = params?.fiscalYear || new Date().getFullYear();
        const awardTypes = params?.awardTypes || ["A", "B", "C", "D"];
        const data = await usaSpendingPost("/search/spending_by_award/", {
          filters: {
            time_period: [{ start_date: `${fy - 1}-10-01`, end_date: `${fy}-09-30` }],
            award_type_codes: awardTypes,
          },
          fields: ["Award ID", "Recipient Name", "Award Amount", "Awarding Agency", "Award Type", "Description", "Start Date", "End Date"],
          limit: params?.limit || 25,
          page: 1,
          sort: "Award Amount",
          order: "desc",
        });
        if (!data) throw new Error("USASpending awards API unavailable");
        result = {
          country: "USA", source: "USASpending.gov – Federal Awards",
          fiscalYear: fy,
          results: data.results || [],
          totalResults: data.page_metadata?.total || 0,
        };
        break;
      }

      // ══════════════════════════════════════════════════════════════
      // USASpending — Spending by State
      // ══════════════════════════════════════════════════════════════
      case "usa_spending_by_state": {
        const fips = params?.fips || "06"; // California default
        const data = await fetchJson(`${SOURCES.usa_spending}/recipient/state/${fips}/`);
        if (!data) throw new Error("USASpending state API unavailable");
        result = {
          country: "USA", source: "USASpending.gov – State Spending",
          state: data.name, code: data.code, fips: data.fips,
          population: data.population, medianIncome: data.median_household_income,
          totalPrimeAmount: data.total_prime_amount,
          totalAwards: data.total_prime_awards,
          awardPerCapita: data.award_amount_per_capita,
          totalOutlays: data.total_outlays,
        };
        break;
      }

      // ══════════════════════════════════════════════════════════════
      // USASpending — Exchange Rates (Treasury)
      // ══════════════════════════════════════════════════════════════
      case "treasury_exchange_rates": {
        const data = await fetchJson(treasuryUrl("v1/accounting/od/rates_of_exchange", {
          sort: "-record_date", "page[size]": "100",
        }));
        if (!data?.data) throw new Error("Treasury Exchange Rates API unavailable");
        result = {
          country: "USA", source: "US Treasury – Exchange Rates",
          rates: data.data.map((r: any) => ({
            date: r.record_date,
            currency: r.country_currency_desc,
            rate: parseFloat(r.exchange_rate || "0"),
          })),
        };
        break;
      }

      // ══════════════════════════════════════════════════════════════
      // Census Bureau — State Government Finances & Demographics
      // ══════════════════════════════════════════════════════════════
      case "census_state_finances": {
        // Census ACS — no API key required for basic queries
        const year = params?.year || "2022";
        const [popData, incomeData] = await Promise.all([
          fetchJson(`${SOURCES.census}/${year}/acs/acs5?get=NAME,B01001_001E&for=state:*`),
          fetchJson(`${SOURCES.census}/${year}/acs/acs5?get=NAME,B19013_001E&for=state:*`),
        ]);
        const states: any[] = [];
        if (popData && popData.length > 1) {
          const popMap: Record<string, number> = {};
          const incMap: Record<string, number> = {};
          for (let i = 1; i < popData.length; i++) {
            popMap[popData[i][0]] = parseInt(popData[i][1] || "0");
          }
          if (incomeData && incomeData.length > 1) {
            for (let i = 1; i < incomeData.length; i++) {
              incMap[incomeData[i][0]] = parseInt(incomeData[i][1] || "0");
            }
          }
          for (const [name, pop] of Object.entries(popMap)) {
            states.push({ name, population: pop, medianIncome: incMap[name] || null });
          }
          states.sort((a, b) => b.population - a.population);
        }
        result = {
          country: "USA", source: `US Census Bureau – ACS ${year}`,
          year, stateCount: states.length, states,
        };
        break;
      }

      // ══════════════════════════════════════════════════════════════
      // FRED — Federal Reserve Economic Data
      // ══════════════════════════════════════════════════════════════
      case "fred_series": {
        const fredKey = Deno.env.get("FRED_API_KEY");
        if (!fredKey) throw new Error("FRED_API_KEY not configured — add via Settings");
        const seriesId = params?.seriesId || "GDP";
        const data = await fetchJson(
          `${SOURCES.fred}/series/observations?series_id=${seriesId}&api_key=${fredKey}&file_type=json&sort_order=desc&limit=${params?.limit || 20}`
        );
        if (!data?.observations) throw new Error("FRED API unavailable");
        result = {
          country: "USA", source: `Federal Reserve (FRED) – ${seriesId}`,
          series: seriesId,
          observations: data.observations.map((o: any) => ({
            date: o.date, value: o.value === "." ? null : parseFloat(o.value),
          })),
        };
        break;
      }
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
        const imfIndicators = [
          "GGXWDG_NGDP", "GGR_G01_GDP_PT", "GGXCNL_NGDP", "NGDP_RPCH", "PCPIPCH", "LUR",
        ];
        const periods = "2020,2021,2022,2023,2024,2025";
        const imfResults: Record<string, any> = {};
        const fetches = imfIndicators.map(async (ind) => {
          const data = await fetchJson(`${SOURCES.imf_dm}/${ind}?periods=${periods}`);
          if (data?.values?.[ind]?.[iso3]) {
            imfResults[ind] = { values: data.values[ind][iso3], label: ind };
          }
        });
        await Promise.all(fetches);
        result = { countryCode: cc, iso3, source: "IMF World Economic Outlook (DataMapper)", indicators: imfResults };
        break;
      }

      // ── UK, France, Canada datasets ──
      case "uk_spending": {
        const data = await fetchJson(`${SOURCES.uk_ckan}/package_search?q=government+expenditure+budget+spending&rows=20`);
        if (!data?.result) throw new Error("UK CKAN unavailable");
        const datasets = (data.result.results || []).map((d: any) => ({
          title: d.title, notes: d.notes?.substring(0, 200),
          organization: d.organization?.title,
          resources: (d.resources || []).slice(0, 3).map((r: any) => ({ format: r.format, url: r.url, name: r.name })),
        }));
        result = { country: "UK", source: "UK Government Open Data (data.gov.uk)", datasetCount: data.result.count, datasets };
        break;
      }

      case "fr_spending": {
        const data = await fetchJson(`${SOURCES.fr_data}/datasets/?q=budget+etat+depenses+recettes&page_size=20`);
        if (!data) throw new Error("France data.gouv.fr unavailable");
        const datasets = (data.data || []).map((d: any) => ({
          title: d.title, description: d.description?.substring(0, 200),
          organization: d.organization?.name,
          resources: (d.resources || []).slice(0, 3).map((r: any) => ({ format: r.format, url: r.url, title: r.title })),
        }));
        result = { country: "France", source: "data.gouv.fr", datasetCount: data.total, datasets };
        break;
      }

      case "ca_spending": {
        const data = await fetchJson(`${SOURCES.ca_ckan}/package_search?q=government+expenditure+budget&rows=20`);
        if (!data?.result) throw new Error("Canada CKAN unavailable");
        const datasets = (data.result.results || []).map((d: any) => ({
          title: d.title, notes: d.notes?.substring(0, 200),
          organization: d.organization?.title,
          resources: (d.resources || []).slice(0, 3).map((r: any) => ({ format: r.format, url: r.url, name: r.name })),
        }));
        result = { country: "Canada", source: "Open Government Canada", datasetCount: data.result.count, datasets };
        break;
      }

      // ══════════════════════════════════════════════════════════════
      // Comprehensive country fiscal profile (aggregates ALL sources)
      // ══════════════════════════════════════════════════════════════
      case "country_fiscal_profile": {
        const cc = params?.countryCode || "US";
        const iso3 = ISO2_TO_ISO3[cc] || cc;

        // Parallel: World Bank + IMF + country-specific
        const [wbData, imfDebt, imfRev, imfBalance, imfGrowth, imfInflation] = await Promise.all([
          fetchJson(`${SOURCES.world_bank}/country/${cc}/indicator/NY.GDP.MKTP.CD;GC.XPN.TOTL.GD.ZS;GC.REV.XGRT.GD.ZS;GC.DOD.TOTL.GD.ZS;SH.XPD.CHEX.GD.ZS;SE.XPD.TOTL.GD.ZS;MS.MIL.XPND.GD.ZS;SP.POP.TOTL?format=json&date=2018:2023&per_page=200`),
          fetchJson(`${SOURCES.imf_dm}/GGXWDG_NGDP?periods=2020,2021,2022,2023,2024,2025`),
          fetchJson(`${SOURCES.imf_dm}/GGR_G01_GDP_PT?periods=2020,2021,2022,2023,2024,2025`),
          fetchJson(`${SOURCES.imf_dm}/GGXCNL_NGDP?periods=2020,2021,2022,2023,2024,2025`),
          fetchJson(`${SOURCES.imf_dm}/NGDP_RPCH?periods=2020,2021,2022,2023,2024,2025`),
          fetchJson(`${SOURCES.imf_dm}/PCPIPCH?periods=2020,2021,2022,2023,2024,2025`),
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

        // ── USA-specific: pull expanded Treasury + USASpending data ──
        let usaAgencies: any[] = [];
        let usaNetCost: any[] = [];
        let usaBudgetFunctions: any[] = [];
        let usaTopAwarding: any[] = [];
        let usaDebtTimeline: any[] = [];
        let usaMtsSummary: any[] = [];
        let usaInterestRates: any[] = [];
        let usaTotalSpending = 0;

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

          // Agencies
          if (agencyData?.results) {
            usaAgencies = agencyData.results
              .filter((a: any) => a.budget_authority_amount > 0)
              .sort((a: any, b: any) => b.budget_authority_amount - a.budget_authority_amount)
              .slice(0, 20)
              .map((a: any) => ({ name: a.agency_name, abbreviation: a.abbreviation, budgetAuthority: a.budget_authority_amount, obligated: a.obligated_amount, outlays: a.outlay_amount }));
          }

          // Statements of Net Cost (agency-level costs from Financial Report)
          if (netCostData?.data) {
            const byAgency: Record<string, any> = {};
            for (const row of netCostData.data) {
              if (!row.agency_nm) continue;
              if (!byAgency[row.agency_nm] || row.record_date > byAgency[row.agency_nm].record_date) {
                byAgency[row.agency_nm] = row;
              }
            }
            usaNetCost = Object.values(byAgency)
              .map((r: any) => ({
                agency: r.agency_nm, fiscalYear: r.stmt_fiscal_year,
                grossCostBil: parseFloat(r.gross_cost_bil_amt || "0"),
                earnedRevenueBil: parseFloat(r.earned_revenue_bil_amt || "0"),
                netCostBil: parseFloat(r.net_cost_bil_amt || "0"),
              }))
              .sort((a: any, b: any) => b.netCostBil - a.netCostBil);
          }

          // Budget functions (Defense, Medicare, Social Security, etc.)
          if (budgetFuncData?.results) {
            usaTotalSpending = budgetFuncData.total || 0;
            usaBudgetFunctions = budgetFuncData.results.map((r: any) => ({
              name: r.name, code: r.code, amount: r.amount,
              percentOfTotal: usaTotalSpending > 0 ? ((r.amount / usaTotalSpending) * 100) : 0,
            }));
          }

          // Top awarding agencies
          if (topAwardData?.results) {
            usaTopAwarding = topAwardData.results.map((r: any) => ({
              name: r.name, code: r.code, amount: r.amount,
            }));
          }

          // Debt timeline
          if (debtData?.data) {
            usaDebtTimeline = debtData.data.map((d: any) => ({
              date: d.record_date,
              totalDebt: parseFloat(d.tot_pub_debt_out_amt || "0"),
              publicDebt: parseFloat(d.debt_held_public_amt || "0"),
            }));
          }

          // MTS summary (receipts, outlays, deficit)
          if (mtsData?.data) {
            usaMtsSummary = mtsData.data.map((r: any) => ({
              date: r.record_date, description: r.classification_desc,
              lineCode: r.line_code_nbr, fiscalYear: r.record_fiscal_year,
              receipts: parseFloat(r.current_month_gross_rcpt_amt || "0"),
              outlays: parseFloat(r.current_month_gross_outly_amt || "0"),
              deficitSurplus: parseFloat(r.current_month_dfct_sur_amt || "0"),
            }));
          }

          // Interest rates on debt
          if (interestData?.data) {
            usaInterestRates = interestData.data.slice(0, 20).map((r: any) => ({
              date: r.record_date,
              securityType: r.security_type_desc,
              avgRate: parseFloat(r.avg_interest_rate_amt || "0"),
            }));
          }
        }

        // Get peer comparison for context
        const peerCountries = ["US", "GB", "DE", "FR", "JP", "IN", "BR", "CA", "AU", "PE", "MX", "ZA"].filter(c => c !== cc);
        const peerIso3 = peerCountries.map(c => ISO2_TO_ISO3[c] || c);
        const peerDebt: Record<string, number> = {};
        const peerRev: Record<string, number> = {};
        if (imfDebt?.values?.GGXWDG_NGDP) {
          for (const p of peerIso3) {
            const vals = imfDebt.values.GGXWDG_NGDP[p];
            if (vals) { const latest = Object.entries(vals).sort((a, b) => Number(b[0]) - Number(a[0]))[0]; if (latest) peerDebt[p] = latest[1] as number; }
          }
        }
        if (imfRev?.values?.GGR_G01_GDP_PT) {
          for (const p of peerIso3) {
            const vals = imfRev.values.GGR_G01_GDP_PT[p];
            if (vals) { const latest = Object.entries(vals).sort((a, b) => Number(b[0]) - Number(a[0]))[0]; if (latest) peerRev[p] = latest[1] as number; }
          }
        }

        result = {
          countryCode: cc,
          iso3,
          sources: [
            "World Bank Open Data", "IMF World Economic Outlook",
            ...(cc === "US" ? [
              "USASpending.gov",
              "US Treasury Fiscal Data – Debt to the Penny",
              "US Treasury – Statements of Net Cost (Financial Report)",
              "US Treasury – Monthly Treasury Statement (MTS)",
              "US Treasury – Average Interest Rates on Debt",
              "USASpending.gov – Budget Functions",
              "USASpending.gov – Top Awarding Agencies",
            ] : []),
          ],
          worldBank: wbIndicators,
          imf,
          // USA-specific expanded data
          usaAgencies,
          usaNetCost,
          usaBudgetFunctions,
          usaTotalSpending,
          usaTopAwarding,
          usaDebtTimeline,
          usaMtsSummary,
          usaInterestRates,
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
