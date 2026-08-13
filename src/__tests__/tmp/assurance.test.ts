import { describe, expect, it, beforeEach } from "vitest";
import { supabase } from "@/integrations/supabase/client";
import { readAssurance, listVerifiedFactors, clearUnverifiedFactors } from "@/lib/accountAssurance";

const mfa = supabase.auth.mfa as any;
let factors: any[] = [];
let unenrolled: string[] = [];

beforeEach(() => {
  unenrolled = [];
  mfa.listFactors = async () => ({
    data: {
      all: factors,
      totp: factors.filter((f) => f.factor_type === "totp"),
      phone: [],
      webauthn: factors.filter((f) => f.factor_type === "webauthn"),
    },
    error: null,
  });
  mfa.unenroll = async ({ factorId }: any) => {
    unenrolled.push(factorId);
    factors = factors.filter((f) => f.id !== factorId);
    return { data: {}, error: null };
  };
  mfa.getAuthenticatorAssuranceLevel = () => ({
    then: undefined,
  }) as any;
});

const setAal = (fn: () => any) => { mfa.getAuthenticatorAssuranceLevel = async () => fn(); };

describe("readAssurance", () => {
  it("A: no factors at all → no wall", async () => {
    factors = [];
    setAal(() => ({ data: { currentLevel: "aal1", nextLevel: "aal1" }, error: null }));
    const a = await readAssurance();
    expect(a.challengeRequired).toBe(false);
    expect(a.canRaise).toBe(false);
  });

  it("B: unverified leftover raises nextLevel → swept, no wall", async () => {
    factors = [{ id: "f-stale", status: "unverified", factor_type: "totp" }];
    let call = 0;
    setAal(() => {
      call++;
      return { data: { currentLevel: "aal1", nextLevel: call === 1 ? "aal2" : "aal1" }, error: null };
    });
    const a = await readAssurance();
    expect(unenrolled).toEqual(["f-stale"]);
    expect(a.challengeRequired).toBe(false);
    expect(await listVerifiedFactors()).toEqual([]);
  });

  it("C: verified TOTP at aal1 → wall stands", async () => {
    factors = [{ id: "f-ok", status: "verified", factor_type: "totp", created_at: "x" }];
    setAal(() => ({ data: { currentLevel: "aal1", nextLevel: "aal2" }, error: null }));
    const a = await readAssurance();
    expect(a.challengeRequired).toBe(true);
    expect(unenrolled).toEqual([]);
  });

  it("C2: verified TOTP after passing challenge (aal2) → no wall", async () => {
    factors = [{ id: "f-ok", status: "verified", factor_type: "totp" }];
    setAal(() => ({ data: { currentLevel: "aal2", nextLevel: "aal2" }, error: null }));
    expect((await readAssurance()).challengeRequired).toBe(false);
  });

  it("G: verified passkey counts as a factor", async () => {
    factors = [{ id: "pk", status: "verified", factor_type: "webauthn" }];
    setAal(() => ({ data: { currentLevel: "aal1", nextLevel: "aal2" }, error: null }));
    const a = await readAssurance();
    expect(a.challengeRequired).toBe(true);
    expect((await listVerifiedFactors())[0].type).toBe("webauthn");
  });

  it("F: network failure → UNKNOWN, login gate open", async () => {
    factors = [];
    setAal(() => { throw new Error("offline"); });
    const a = await readAssurance();
    expect(a.challengeRequired).toBe(false);
  });

  it("mixed: verified survives the sweep", async () => {
    factors = [
      { id: "v", status: "verified", factor_type: "totp" },
      { id: "u", status: "unverified", factor_type: "totp" },
    ];
    setAal(() => ({ data: { currentLevel: "aal1", nextLevel: "aal2" }, error: null }));
    const a = await readAssurance();
    expect(a.challengeRequired).toBe(true);
    await clearUnverifiedFactors();
    expect(unenrolled).toEqual(["u"]);
    expect((await listVerifiedFactors()).map((f) => f.id)).toEqual(["v"]);
  });
});
