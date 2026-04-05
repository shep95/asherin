import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Free government APIs that require no API key
const SOURCES = {
  usa_spending: "https://api.usaspending.gov/api/v2",
  treasury: "https://api.fiscaldata.treasury.gov/services/api/fiscal_service",
  world_bank: "https://api.worldbank.org/v2",
  imf: "http://dataservices.imf.org/REST/SDMX_JSON.svc",
};

interface GovRequest {
  action: "spending_by_agency" | "spending_by_category" | "treasury_debt" | "treasury_revenue" | "world_bank_indicators" | "country_comparison";
  params?: Record<string, any>;
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
        const fy = params?.fiscalYear || "2024";
        const resp = await fetch(`${SOURCES.usa_spending}/budget_functions/list_budget_functions/`, {
          method: "GET",
        });
        // Use the agency endpoint instead
        const agencyResp = await fetch(`${SOURCES.usa_spending}/references/toptier_agencies/`, {
          method: "GET",
        });
        if (!agencyResp.ok) throw new Error(`USASpending API error: ${agencyResp.status}`);
        const agencyData = await agencyResp.json();
        
        // Get top agencies with budgets
        const agencies = (agencyData.results || [])
          .filter((a: any) => a.budget_authority_amount > 0)
          .sort((a: any, b: any) => b.budget_authority_amount - a.budget_authority_amount)
          .slice(0, 25)
          .map((a: any) => ({
            name: a.agency_name,
            abbreviation: a.abbreviation,
            budgetAuthority: a.budget_authority_amount,
            obligatedAmount: a.obligated_amount,
            outlayAmount: a.outlay_amount,
            congressionalJustificationUrl: a.congressional_justification_url,
          }));

        const total = agencies.reduce((s: number, a: any) => s + (a.budgetAuthority || 0), 0);
        result = { country: "USA", source: "USASpending.gov", totalBudget: total, agencies, fiscalYear: fy };
        break;
      }

      // ── USA Spending by Category ──
      case "spending_by_category": {
        const fy = params?.fiscalYear || "2024";
        const resp = await fetch(`${SOURCES.usa_spending}/spending/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "budget_function",
            filters: { fy: fy, quarter: "4" },
          }),
        });
        if (!resp.ok) {
          // Fallback: use agency data grouped by function
          const agencyResp = await fetch(`${SOURCES.usa_spending}/references/toptier_agencies/`);
          const agencyData = await agencyResp.json();
          result = {
            country: "USA",
            source: "USASpending.gov",
            categories: (agencyData.results || []).slice(0, 15).map((a: any) => ({
              name: a.agency_name,
              amount: a.budget_authority_amount || 0,
            })),
          };
        } else {
          const data = await resp.json();
          result = { country: "USA", source: "USASpending.gov", categories: data.results || [] };
        }
        break;
      }

      // ── Treasury Debt ──
      case "treasury_debt": {
        const resp = await fetch(
          `${SOURCES.treasury}/v2/accounting/od/debt_to_penny?sort=-record_date&page[size]=30&format=json`
        );
        if (!resp.ok) throw new Error(`Treasury API error: ${resp.status}`);
        const data = await resp.json();
        result = {
          country: "USA",
          source: "US Treasury Fiscal Data",
          debtData: (data.data || []).map((d: any) => ({
            date: d.record_date,
            totalDebt: parseFloat(d.tot_pub_debt_out_amt || "0"),
            intragov: parseFloat(d.intragov_hold_amt || "0"),
            publicDebt: parseFloat(d.debt_held_public_amt || "0"),
          })),
        };
        break;
      }

      // ── Treasury Revenue ──
      case "treasury_revenue": {
        const resp = await fetch(
          `${SOURCES.treasury}/v1/accounting/mts/mts_table_4?sort=-record_date&page[size]=50&format=json`
        );
        if (!resp.ok) {
          // Fallback endpoint
          const fallback = await fetch(
            `${SOURCES.treasury}/v2/accounting/od/statement_net_cost?sort=-record_date&page[size]=30&format=json`
          );
          if (!fallback.ok) throw new Error(`Treasury Revenue API error`);
          const fData = await fallback.json();
          result = { country: "USA", source: "US Treasury Fiscal Data", revenue: fData.data || [] };
        } else {
          const data = await resp.json();
          result = { country: "USA", source: "US Treasury Fiscal Data", revenue: data.data || [] };
        }
        break;
      }

      // ── World Bank Indicators (works for ANY country) ──
      case "world_bank_indicators": {
        const countryCode = params?.countryCode || "US";
        const indicators = params?.indicators || [
          "GC.XPN.TOTL.GD.ZS",  // Expense (% of GDP)
          "GC.REV.XGRT.GD.ZS",  // Revenue (% of GDP)
          "GC.DOD.TOTL.GD.ZS",  // Central govt debt (% of GDP)
          "MS.MIL.XPND.GD.ZS",  // Military expenditure (% of GDP)
          "SH.XPD.CHEX.GD.ZS",  // Health expenditure (% of GDP)
          "SE.XPD.TOTL.GD.ZS",  // Education expenditure (% of GDP)
          "NY.GDP.MKTP.CD",      // GDP current USD
          "SP.POP.TOTL",         // Population
        ];

        const indicatorResults: Record<string, any[]> = {};
        const dateRange = params?.dateRange || "2015:2023";

        // Fetch all indicators in parallel
        const fetches = indicators.map(async (ind: string) => {
          try {
            const resp = await fetch(
              `${SOURCES.world_bank}/country/${countryCode}/indicator/${ind}?format=json&date=${dateRange}&per_page=100`
            );
            if (!resp.ok) return { indicator: ind, data: [] };
            const json = await resp.json();
            return { indicator: ind, data: (json[1] || []).filter((d: any) => d.value !== null) };
          } catch {
            return { indicator: ind, data: [] };
          }
        });

        const results = await Promise.all(fetches);
        results.forEach((r: any) => { indicatorResults[r.indicator] = r.data; });

        result = {
          countryCode,
          source: "World Bank Open Data",
          indicators: indicatorResults,
        };
        break;
      }

      // ── Country Comparison ──
      case "country_comparison": {
        const countries = params?.countries || ["US", "GB", "DE", "FR", "JP", "CN", "IN", "BR", "CA", "AU"];
        const indicator = params?.indicator || "GC.XPN.TOTL.GD.ZS";
        const year = params?.year || "2022";

        // Fetch the indicator for all countries at once
        const codes = countries.join(";");
        const resp = await fetch(
          `${SOURCES.world_bank}/country/${codes}/indicator/${indicator}?format=json&date=${year}&per_page=500`
        );
        
        let comparisonData: any[] = [];
        if (resp.ok) {
          const json = await resp.json();
          comparisonData = (json[1] || [])
            .filter((d: any) => d.value !== null)
            .map((d: any) => ({
              countryCode: d.countryiso3code,
              countryName: d.country?.value,
              value: d.value,
              year: d.date,
              indicator: d.indicator?.value,
            }))
            .sort((a: any, b: any) => b.value - a.value);
        }

        result = {
          source: "World Bank Open Data",
          indicator,
          indicatorName: comparisonData[0]?.indicator || indicator,
          year,
          countries: comparisonData,
        };
        break;
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
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
