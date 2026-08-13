import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const auth = { user: { id: "u1", email: "op@example.com" }, loading: false, mfaRequired: false, refreshAssurance: vi.fn(), signOut: vi.fn() };
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));

import ProtectedRoute from "@/components/ProtectedRoute";

const mfa = supabase.auth.mfa as any;
let factors: any[] = [];
let unenrolled: string[] = [];
beforeEach(() => {
  unenrolled = [];
  mfa.listFactors = async () => ({ data: { all: factors, totp: factors.filter(f=>f.factor_type==="totp") }, error: null });
  mfa.unenroll = async ({ factorId }: any) => { unenrolled.push(factorId); factors = factors.filter(f=>f.id!==factorId); return { error: null }; };
});

const Dash = () => <div>DASHBOARD MOUNTED</div>;

describe("login gate", () => {
  it("no MFA → dashboard, MfaChallenge never mounts", async () => {
    auth.mfaRequired = false;
    render(<MemoryRouter><ProtectedRoute><Dash /></ProtectedRoute></MemoryRouter>);
    expect(screen.getByText("DASHBOARD MOUNTED")).toBeTruthy();
    expect(screen.queryByText(/second factor/i)).toBeNull();
  });

  it("stale wall + zero verified → sweeps and releases, no support dead-end", async () => {
    auth.mfaRequired = true;
    factors = [{ id: "stale", status: "unverified", factor_type: "totp" }];
    auth.refreshAssurance = vi.fn(async () => { auth.mfaRequired = false; });
    const { rerender } = render(<MemoryRouter><ProtectedRoute><Dash /></ProtectedRoute></MemoryRouter>);
    await waitFor(() => expect(auth.refreshAssurance).toHaveBeenCalled());
    expect(unenrolled).toEqual(["stale"]);
    expect(screen.queryByText(/contact\s+support/i)).toBeNull();
    rerender(<MemoryRouter><ProtectedRoute><Dash /></ProtectedRoute></MemoryRouter>);
    await waitFor(() => expect(screen.getByText("DASHBOARD MOUNTED")).toBeTruthy());
  });

  it("verified TOTP + aal1 → wall with code form, dashboard hidden", async () => {
    auth.mfaRequired = true;
    factors = [{ id: "good", status: "verified", factor_type: "totp" }];
    render(<MemoryRouter><ProtectedRoute><Dash /></ProtectedRoute></MemoryRouter>);
    await waitFor(() => expect(screen.getByLabelText(/Six digit/i)).toBeTruthy());
    expect(screen.queryByText("DASHBOARD MOUNTED")).toBeNull();
    expect(screen.getByText(/Sign out/i)).toBeTruthy();
    expect(unenrolled).toEqual([]);
  });
});
