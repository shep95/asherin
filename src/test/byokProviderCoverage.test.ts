import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// A saved key is only useful if EVERY surface can call it. Chat had its own
// provider table while the shared tool router had a shorter one, so keys for
// providers outside the short list worked in chat and failed everywhere else.
// These tests keep the two lists from drifting apart again.

const router = readFileSync("supabase/functions/_shared/zophielByokRouter.ts", "utf8");
const chat = readFileSync("supabase/functions/chat/index.ts", "utf8");
const keys = readFileSync("supabase/functions/_shared/keyResolution.ts", "utf8");

function routerProviders(): string[] {
  const block = router.split("OPENAI_COMPAT_BASE: Readonly")[1]?.split("};")[0] ?? "";
  return [...block.matchAll(/^\s{2}([a-z0-9]+):\s*\{/gm)].map((m) => m[1]);
}

function chatProviders(): string[] {
  const block = chat.split("PROVIDER_ENDPOINTS: Record")[1]?.split("\n    };")[0] ?? "";
  return [...block.matchAll(/^\s{6}([a-z0-9]+):\s*\{/gm)].map((m) => m[1]);
}

describe("byok provider coverage", () => {
  it("every chat provider is reachable by the shared tool router", () => {
    const inRouter = new Set([...routerProviders(), "google", "anthropic"]);
    const missing = chatProviders().filter((p) => !inRouter.has(p));
    expect(missing).toEqual([]);
  });

  it("every callable provider has a default model and an env entry", () => {
    for (const p of [...routerProviders(), "google", "anthropic"]) {
      expect(keys, `DEFAULT_MODEL missing ${p}`).toMatch(new RegExp(`\\n\\s*${p}:\\s*"`));
      expect(keys, `PROVIDER_ENV missing ${p}`).toMatch(new RegExp(`\\n\\s*${p}:\\s*\\[`));
    }
  });

  it("the router still exposes its callability check", () => {
    expect(router).toContain("export function isCallableByokProvider");
  });
});
