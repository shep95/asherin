import { GEO_CONTENT } from "../../src/lib/geo/geoContent";
for (const p of ["/pricing", "/glossary/byok-ai", "/sources"]) {
  const g: any = GEO_CONTENT[p];
  const text = [g.answer, ...(g.procedure?.steps ?? []), ...(g.faqs ?? []).flatMap((f: any) => [f.q, f.a]),
    ...(g.corroboration ?? []).map((c: any) => c.confirms), ...(g.revisions ?? []).map((r: any) => r.note)].join(" ");
  const t = text.toLowerCase().replace(/[^a-z0-9$%.\s-]/g, " ").split(/\s+/).filter(Boolean);
  const m = new Map<string, number>();
  for (let i = 0; i + 2 < t.length; i++) { const k = t.slice(i, i + 3).join(" "); m.set(k, (m.get(k) ?? 0) + 1); }
  console.log(`\n=== ${p} (${t.length} tokens, ${m.size} trigrams)`);
  console.log([...m.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${n}x ${k}`).join("\n"));
}
