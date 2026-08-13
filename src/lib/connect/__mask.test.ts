import { expect, test } from "vitest";
import { maskQuote } from "@/lib/connect/emitPull";
test("masks", () => {
  expect(maskQuote("token=sk-ABCDEFGHIJKLMNOPQRSTUV12345")).toContain("[redacted]");
  expect(maskQuote("mail asher.newton@gmail.com now")).toBe("mail a***@g***.com now");
  expect(maskQuote("call +1 415 555 0199")).toContain("***199");
  expect(maskQuote("1600 Amphitheatre Pkwy")).toBe("1600 Amphitheatre Pkwy");
});
