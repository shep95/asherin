// Live test — hits Zophiel and prints the fused bundle + LLM context.
// Run: deno test --allow-net --allow-env supabase/functions/_shared/jurisdictionalIntel_live_test.ts
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { classifyIntent, runJurisdictionalSearch, formatIntelContext } from "./jurisdictionalIntel.ts";

Deno.test("asher shepherd newton — cape coral florida", async () => {
  const msg = "who is asher shepherd newton who lives in cape coral flordia";
  const intent = classifyIntent(msg);
  console.log("\n=== INTENT ===");
  console.log(JSON.stringify(intent, null, 2));

  if (intent.kind === "none" || intent.needsClarification) {
    console.log("STOP — clarification required or non-intel.");
    return;
  }

  const bundle = await runJurisdictionalSearch(intent);
  console.log("\n=== BUCKET SUMMARY ===");
  console.log("Jurisdiction:", bundle.jurisdictionLabel);
  console.log("Registries:", bundle.registries.slice(0, 15));
  console.log("Total hits:", bundle.totalHits);
  for (const [b, hits] of Object.entries(bundle.buckets)) {
    console.log(`  ${b}: ${hits.length} hits`);
    for (const h of hits.slice(0, 3)) console.log(`    [${h.domain}] ${h.title.slice(0, 80)}`);
  }

  console.log("\n=== FORMATTED INTEL CONTEXT (what the LLM sees) ===\n");
  console.log(formatIntelContext(bundle));
});
