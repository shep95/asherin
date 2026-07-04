// ZOSMA — Batch cert sweep. Feed up to 50 hosts, get graded rows.
// Grades each cert on: expiry, weak key size, SHA-1 signature, self-signed,
// missing SAN, wildcard sprawl.
import * as tls from "node:tls";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { guardHost, requireAdmin } from "../_shared/zosma-guards.ts";

interface Row {
  host: string;
  ok: boolean;
  grade: "A" | "B" | "C" | "D" | "F" | "ERR";
  issues: string[];
  issuer: string | null;
  subject: string | null;
  valid_to: string | null;
  days_left: number | null;
  bit_length: number | null;
  pubkey_algo: string | null;
  sig_algo: string | null;
  san_count: number;
  self_signed: boolean;
  error?: string;
}

function inspect(host: string, port = 443, timeoutMs = 6000): Promise<Row> {
  return new Promise((resolve) => {
    let done = false;
    const base: Row = {
      host, ok: false, grade: "ERR", issues: [], issuer: null, subject: null,
      valid_to: null, days_left: null, bit_length: null, pubkey_algo: null,
      sig_algo: null, san_count: 0, self_signed: false,
    };
    const finish = (r: Row) => { if (!done) { done = true; try { socket.destroy(); } catch { /**/ } resolve(r); } };
    const socket = tls.connect({ host, port, servername: host, rejectUnauthorized: false });
    const to = setTimeout(() => finish({ ...base, error: `timeout ${timeoutMs}ms` }), timeoutMs);
    socket.on("secureConnect", () => {
      clearTimeout(to);
      const cert: any = socket.getPeerCertificate(true);
      if (!cert || Object.keys(cert).length === 0) return finish({ ...base, error: "empty cert" });
      const issues: string[] = [];
      const subject = cert.subject ? Object.entries(cert.subject).map(([k, v]) => `${k}=${v}`).join(", ") : null;
      const issuer = cert.issuer ? Object.entries(cert.issuer).map(([k, v]) => `${k}=${v}`).join(", ") : null;
      const self_signed = !!(subject && issuer && subject === issuer);
      const modulus_hex = typeof cert.modulus === "string" ? cert.modulus : null;
      const bits = typeof cert.bits === "number" ? cert.bits : (modulus_hex ? modulus_hex.length * 4 : null);
      const pubkey_algo = modulus_hex ? "RSA" : (cert.asn1Curve || cert.nistCurve) ? "EC" : "OTHER";
      const sig_algo: string | null = cert.sigalg ?? cert.signatureAlgorithm ?? null;
      const san = cert.subjectaltname ?? "";
      const san_count = san ? san.split(",").length : 0;
      const valid_to = cert.valid_to ?? null;
      const days_left = valid_to ? Math.floor((new Date(valid_to).getTime() - Date.now()) / 86400000) : null;

      if (days_left !== null && days_left < 0) issues.push(`EXPIRED (${Math.abs(days_left)}d ago)`);
      else if (days_left !== null && days_left < 14) issues.push(`expires in ${days_left}d`);
      if (self_signed) issues.push("self-signed");
      if (pubkey_algo === "RSA" && bits && bits < 2048) issues.push(`weak RSA ${bits}b`);
      if (pubkey_algo === "EC" && bits && bits < 224) issues.push(`weak EC ${bits}b`);
      if (sig_algo && /sha1|md5/i.test(sig_algo)) issues.push(`deprecated ${sig_algo}`);
      if (san_count === 0) issues.push("no SAN");
      if (san && (san.match(/\*/g) || []).length > 3) issues.push("wildcard sprawl");

      let grade: Row["grade"] = "A";
      if (issues.some((i) => /EXPIRED|self-signed|weak RSA|md5|sha1/i.test(i))) grade = "F";
      else if (issues.some((i) => /weak EC|expires in/i.test(i))) grade = "D";
      else if (issues.length >= 2) grade = "C";
      else if (issues.length === 1) grade = "B";

      finish({
        host, ok: true, grade, issues, issuer, subject, valid_to, days_left,
        bit_length: bits, pubkey_algo, sig_algo, san_count, self_signed,
      });
    });
    socket.on("error", (err: Error) => { clearTimeout(to); finish({ ...base, error: err.message }); });
  });
}

async function runWithConcurrency<T>(items: string[], limit: number, fn: (h: string) => Promise<T>): Promise<T[]> {
  const out: T[] = new Array(items.length);
  let idx = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (idx < items.length) {
      const my = idx++;
      out[my] = await fn(items[my]);
    }
  });
  await Promise.all(workers);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json().catch(() => ({}));
    const hosts: string[] = Array.isArray(body?.hosts) ? body.hosts : [];
    if (hosts.length === 0) return new Response(JSON.stringify({ error: "hosts[] required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (hosts.length > 50) return new Response(JSON.stringify({ error: "max 50 hosts" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const clean: string[] = [];
    const rejected: { host: string; reason: string }[] = [];
    for (const raw of hosts) {
      let h = String(raw).trim().toLowerCase();
      try { if (h.includes("://")) h = new URL(h).hostname; } catch { /**/ }
      const g = guardHost(h);
      if (g) rejected.push({ host: h, reason: g });
      else clean.push(h);
    }
    const rows = await runWithConcurrency(clean, 8, (h) => inspect(h));
    return new Response(JSON.stringify({ rows, rejected, ran_at: new Date().toISOString() }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
