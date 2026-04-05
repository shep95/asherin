import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SOURCES = {
  usa_spending: "https://api.usaspending.gov/api/v2",
  treasury: "https://api.fiscaldata.treasury.gov/services/api/fiscal_service",
  world_bank: "https://api.worldbank.org/v2",
  imf_dm: "https://www.imf.org/external/datamapper/api/v1",
  uk_ckan: "https://ckan.publishing.service.gov.uk/api/3/action",
  fr_data: "https://www.data.gouv.fr/api/1",
  ca_ckan: "https://open.canada.ca/data/api/3/action",
};

// ISO3 → ISO2 mapping for IMF DataMapper (uses ISO3)
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
        const data = await fetchJson(`${SOURCES.treasury}/v2/accounting/od/debt_to_penny?sort=-record_date&page[size]=30&format=json`);
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
        const data = await fetchJson(`${SOURCES.treasury}/v1/accounting/mts/mts_table_4?sort=-record_date&page[size]=50&format=json`);
        if (!data) {
          const fb = await fetchJson(`${SOURCES.treasury}/v2/accounting/od/statement_net_cost?sort=-record_date&page[size]=30&format=json`);
          result = { country: "USA", source: "US Treasury Fiscal Data", revenue: fb?.data || [] };
        } else {
          result = { country: "USA", source: "US Treasury Fiscal Data", revenue: data.data || [] };
        }
        break;
      }

      // ── World Bank Indicators (any country) ──
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

      // ══════════════════════════════════════════════════════════
      // NEW: IMF DataMapper — real 2023-2025 fiscal data for ALL countries
      // ══════════════════════════════════════════════════════════
      case "imf_fiscal": {
        const cc = params?.countryCode || "US";
        const iso3 = ISO2_TO_ISO3[cc] || cc;
        const imfIndicators = [
          "GGXWDG_NGDP",       // Gross govt debt (% GDP)
          "GGR_G01_GDP_PT",    // Govt revenue (% GDP)
          "GGXCNL_NGDP",       // Net lending/borrowing (fiscal balance)
          "NGDP_RPCH",         // Real GDP growth
          "PCPIPCH",           // Inflation
          "LUR",               // Unemployment
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

      // ══════════════════════════════════════════════════════════
      // NEW: UK Government datasets (CKAN)
      // ══════════════════════════════════════════════════════════
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

      // ══════════════════════════════════════════════════════════
      // NEW: France data.gouv.fr
      // ══════════════════════════════════════════════════════════
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

      // ══════════════════════════════════════════════════════════
      // NEW: Canada Open Government
      // ══════════════════════════════════════════════════════════
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

      // ══════════════════════════════════════════════════════════
      // NEW: Comprehensive country fiscal profile (aggregates all sources)
      // ══════════════════════════════════════════════════════════
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

        // Also get USA spending if US
        let usaAgencies: any[] = [];
        if (cc === "US") {
          const usaData = await fetchJson(`${SOURCES.usa_spending}/references/toptier_agencies/`);
          if (usaData?.results) {
            usaAgencies = usaData.results
              .filter((a: any) => a.budget_authority_amount > 0)
              .sort((a: any, b: any) => b.budget_authority_amount - a.budget_authority_amount)
              .slice(0, 15)
              .map((a: any) => ({ name: a.agency_name, abbreviation: a.abbreviation, budgetAuthority: a.budget_authority_amount }));
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
          sources: ["World Bank Open Data", "IMF World Economic Outlook", ...(cc === "US" ? ["USASpending.gov", "US Treasury"] : [])],
          worldBank: wbIndicators,
          imf,
          usaAgencies,
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
