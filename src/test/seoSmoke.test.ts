/**
 * SEO smoke test — crawl surface, run against the built `dist/` served the way
 * the host serves it (static file first, then the rules in public/_redirects,
 * then a real 404).
 *
 * Build first: `npm run build`. The test skips with a loud message if dist is
 * missing, because a green run against a stale tree would be worse than none.
 */

import { createServer, type Server } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const DIST = join(process.cwd(), "dist");
const HAS_DIST = existsSync(join(DIST, "index.html"));

type Rule = { from: string; to: string; status: number };

function loadRedirects(): Rule[] {
  const file = join(DIST, "_redirects");
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => l.split(/\s+/))
    .filter((p) => p.length >= 3)
    .map(([from, to, status]) => ({ from, to, status: Number(status) }));
}

function matches(pattern: string, path: string) {
  if (pattern.endsWith("/*")) return path.startsWith(pattern.slice(0, -1));
  if (pattern.endsWith("*")) return path.startsWith(pattern.slice(0, -1));
  return pattern === path;
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".png": "image/png",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

function resolveFile(path: string): string | null {
  const clean = decodeURIComponent(path.split("?")[0]);
  if (clean.includes("..")) return null;
  const direct = join(DIST, clean);
  if (existsSync(direct) && statSync(direct).isFile()) return direct;
  const asDir = join(DIST, clean, "index.html");
  if (existsSync(asDir)) return asDir;
  return null;
}

let server: Server;
let origin = "";
const rules = HAS_DIST ? loadRedirects() : [];

beforeAll(async () => {
  if (!HAS_DIST) return;
  server = createServer((req, res) => {
    const path = (req.url ?? "/").split("?")[0];
    let file = resolveFile(path);
    let status = 200;

    if (!file) {
      const rule = rules.find((r) => matches(r.from, path));
      if (rule) {
        status = rule.status;
        file = resolveFile(rule.to);
      }
      if (!file) {
        res.writeHead(404, { "content-type": "text/plain" });
        res.end("not found");
        return;
      }
    }
    res.writeHead(status, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
    res.end(readFileSync(file));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const addr = server.address();
  origin = typeof addr === "object" && addr ? `http://127.0.0.1:${addr.port}` : "";
}, 30_000);

afterAll(() => server?.close());

const get = (path: string) => fetch(`${origin}${path}`);

describe.skipIf(!HAS_DIST)("seo smoke", () => {
  it("1. homepage title and description match the visible page", async () => {
    const res = await get("/");
    expect(res.status).toBe(200);
    const html = await res.text();
    const title = /<title>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "";
    expect(title.toLowerCase()).toContain("asherin");
    expect(title).not.toContain("Private AI Intelligence Platform for Analysts");
    expect(html).toContain("look a little closer");
    expect(html).not.toMatch(/Aureon/);
  });

  it("2. /pricing states $18 and $79, never $399 as the current Pro price", async () => {
    const res = await get("/pricing");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toMatch(/<title>[^<]*Pricing[^<]*asherin[^<]*<\/title>/i);
    expect(html).toContain("$18");
    expect(html).toContain("$79");
    expect(html).not.toContain("$399");
  });

  it("3. an unknown URL returns HTTP 404, not a homepage clone", async () => {
    const res = await get("/this-missing-seo-9f3");
    expect(res.status).toBe(404);
    const html = await res.text();
    expect(html).not.toContain("look a little closer");
  });

  it("4. /og-image.png is a real PNG under 1MB", async () => {
    const res = await get("/og-image.png");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.subarray(0, 4).toString("hex")).toBe("89504e47");
    expect(buf.length).toBeLessThan(1_000_000);
  });

  it("5. robots.txt is short, honest and asherin-branded", async () => {
    const res = await get("/robots.txt");
    expect(res.status).toBe(200);
    const txt = await res.text();
    expect(txt).toContain("Sitemap: https://asherin.com/sitemap.xml");
    expect(txt).toContain("Disallow: /dashboard");
    expect(txt).not.toMatch(/Aureon/i);
    expect(txt).not.toContain("Disallow: /whiteboard");
    expect(txt).not.toContain("wp-admin");
  });

  it("6. every sitemap URL resolves 200, with no dashboard and no theory copy", async () => {
    const res = await get("/sitemap.xml");
    expect(res.status).toBe(200);
    const xml = await res.text();
    expect(xml).not.toContain("Theory 10");
    expect(xml).not.toContain("/dashboard");
    expect(xml).not.toContain("<priority>");
    expect(xml).not.toContain("<changefreq>");

    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs.length).toBeGreaterThan(10);
    const broken: string[] = [];
    for (const loc of locs) {
      const path = loc.replace("https://asherin.com", "") || "/";
      const r = await get(path);
      if (r.status !== 200) broken.push(`${path} → ${r.status}`);
    }
    expect(broken).toEqual([]);
  }, 60_000);

  it("7. llms.txt is asherin, $79, no costume numbers", async () => {
    const res = await get("/llms.txt");
    expect(res.status).toBe(200);
    const txt = await res.text();
    expect(txt.trimStart().startsWith("# asherin")).toBe(true);
    expect(txt).not.toMatch(/Aureon/i);
    expect(txt).toContain("$79");
    expect(txt).not.toContain("$399");
    expect(txt).not.toMatch(/14 second/i);
    expect(txt).not.toMatch(/30-source/i);
    expect(txt).not.toMatch(/NOMAD/);
  });

  it("8. /pricing carries its own canonical, not the homepage's", async () => {
    const html = await (await get("/pricing")).text();
    const canonicals = [...html.matchAll(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/g)].map(
      (m) => m[1],
    );
    expect(canonicals).toEqual(["https://asherin.com/pricing"]);
  });

  it("9. no clipped crawler-only markup in prerendered HTML", async () => {
    for (const path of ["/", "/pricing", "/software", "/glossary/sovereign-ai"]) {
      const html = await (await get(path)).text();
      expect(html, path).not.toContain("data-geo-static");
      expect(html, path).not.toContain("clip-path:inset(50%)");
      expect(html, path).not.toContain("Compared with named alternatives");
    }
  });

  it("10. JSON-LD parses and offers are 18.00 and 79.00", async () => {
    const html = await (await get("/")).text();
    const blocks = [
      ...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g),
    ].map((m) => JSON.parse(m[1].replace(/\\u003c/g, "<")));
    expect(blocks.length).toBeGreaterThan(0);

    const nodes = blocks.flatMap((b) => (b["@graph"] as Record<string, unknown>[]) ?? [b]);
    const app = nodes.find((n) => n["@type"] === "SoftwareApplication") as
      | { offers: { price: string }[] }
      | undefined;
    expect(app).toBeTruthy();
    expect(app!.offers.map((o) => o.price).sort()).toEqual(["18.00", "79.00"]);

    const asText = JSON.stringify(nodes);
    expect(asText).not.toMatch(/Aureon/i);
    expect(asText).not.toContain("FAQPage");
  });
});
