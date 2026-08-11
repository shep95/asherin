import { describe, it, expect } from "vitest";
import { detectDorkIntent } from "@/lib/dorkIntent";
const fires = (s:string)=>detectDorkIntent(s);
describe("implicit dork detection", () => {
  const yes = [
    "239-555-0134",
    "jane.doe@proton.me",
    "@ghostwriter_77",
    "Jane Doe Cape Coral Florida",
    "is this number 239-555-0134 a scam",
    "whats Jane Doe's address in Cape Coral",
    "any arrest records for @ghostwriter_77",
    "who owns acme.io",
    "is jane.doe@proton.me legit?",
    "acme.io",
  ];
  const no = [
    "can you fix index.ts for me",
    "send an email to john@acme.com with the invoice",
    "summarize https://example.com/article for me",
    "explain what a dork is",
    "npm install failed with error code 1 in package.json",
    "how are you today",
  ];
  it("fires on implicit turns", () => {
    for (const t of yes) expect([t, fires(t).fire, fires(t).reason]).toEqual([t, true, expect.any(String)]);
  });
  it("stays silent on non-intel turns", () => {
    for (const t of no) expect([t, fires(t).fire]).toEqual([t, false]);
  });
});
