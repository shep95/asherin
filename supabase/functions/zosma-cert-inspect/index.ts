// ZOSMA — TLS certificate inspector.
// Fetches the peer certificate for an operator-supplied https URL, extracts
// (N, e, bit-length, subject, issuer, validity, SAN, sig algo) and returns it.
// No decryption, no traffic interception — read-only public-cert introspection,
// the same data any browser shows in the padlock dialog.
//
// SSRF-hardened: rejects private, loopback, link-local, and metadata targets.

import * as tls from "node:tls";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

interface CertReport {
  ok: boolean;
  host: string;
  port: number;
  subject: string | null;
  issuer: string | null;
  valid_from: string | null;
  valid_to: string | null;
  subjectaltname: string | null;
  fingerprint256: string | null;
  sig_algo: string | null;
  pubkey_algo: "RSA" | "EC" | "OTHER" | null;
  bit_length: number | null;
  modulus_hex: string | null;
  exponent_hex: string | null;
  error?: string;
}

const PRIVATE_HOST_RE =
  /^(?:localhost|.*\.local|.*\.internal|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.|::1|fe80:|fc00:|metadata\.google\.internal)/i;

function guardHost(host: string): string | null {
  const h = host.trim().toLowerCase();
  if (!h) return "empty host";
  if (PRIVATE_HOST_RE.test(h)) return "private/loopback/metadata target refused";
  if (!/^[a-z0-9.\-:_\[\]]+$/i.test(h)) return "hostname contains illegal characters";
  return null;
}

async function fetchPeerCert(host: string, port: number, timeoutMs = 8000): Promise<CertReport> {
  return await new Promise<CertReport>((resolve) => {
    let done = false;
    const finish = (r: CertReport) => { if (!done) { done = true; try { socket.destroy(); } catch { /* ignore */ } resolve(r); } };

    const socket = tls.connect({
      host,
      port,
      servername: host,
      // We want the cert regardless of chain validity — SSRF is prevented by hostname guard above.
      rejectUnauthorized: false,
      ALPNProtocols: ["h2", "http/1.1"],
    });

    const to = setTimeout(() => finish({
      ok: false, host, port,
      subject: null, issuer: null, valid_from: null, valid_to: null,
      subjectaltname: null, fingerprint256: null, sig_algo: null,
      pubkey_algo: null, bit_length: null, modulus_hex: null, exponent_hex: null,
      error: `TLS handshake timed out after ${timeoutMs}ms`,
    }), timeoutMs);

    socket.on("secureConnect", () => {
      clearTimeout(to);
      const cert: any = socket.getPeerCertificate(true);
      if (!cert || Object.keys(cert).length === 0) {
        return finish({
          ok: false, host, port,
          subject: null, issuer: null, valid_from: null, valid_to: null,
          subjectaltname: null, fingerprint256: null, sig_algo: null,
          pubkey_algo: null, bit_length: null, modulus_hex: null, exponent_hex: null,
          error: "peer returned empty certificate",
        });
      }
      const subject = cert.subject ? Object.entries(cert.subject).map(([k, v]) => `${k}=${v}`).join(", ") : null;
      const issuer  = cert.issuer  ? Object.entries(cert.issuer ).map(([k, v]) => `${k}=${v}`).join(", ") : null;
      // Node/Deno expose RSA modulus + exponent directly. EC keys don't have modulus.
      const modulus_hex = typeof cert.modulus === "string" ? cert.modulus.toLowerCase() : null;
      const exponent_hex = typeof cert.exponent === "string" ? cert.exponent.replace(/^0x/, "").toLowerCase() : null;
      const bits = typeof cert.bits === "number" ? cert.bits : (modulus_hex ? modulus_hex.length * 4 : null);
      const pubkey_algo: CertReport["pubkey_algo"] =
        modulus_hex ? "RSA" : (cert.asn1Curve || cert.nistCurve) ? "EC" : "OTHER";

      finish({
        ok: true, host, port,
        subject, issuer,
        valid_from: cert.valid_from ?? null,
        valid_to: cert.valid_to ?? null,
        subjectaltname: cert.subjectaltname ?? null,
        fingerprint256: cert.fingerprint256 ?? null,
        sig_algo: cert.sigalg ?? cert.signatureAlgorithm ?? null,
        pubkey_algo,
        bit_length: bits,
        modulus_hex,
        exponent_hex,
      });
    });

    socket.on("error", (err: Error) => {
      clearTimeout(to);
      finish({
        ok: false, host, port,
        subject: null, issuer: null, valid_from: null, valid_to: null,
        subjectaltname: null, fingerprint256: null, sig_algo: null,
        pubkey_algo: null, bit_length: null, modulus_hex: null, exponent_hex: null,
        error: `TLS error: ${err.message}`,
      });
    });
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // AuthN — must be a signed-in Lovable user, and admin-only for cert inspection.
    const authHeader = req.headers.get("authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "unauthenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const ADMINS = new Set(["ashernewtonx@gmail.com", "shepherdnewtonx@gmail.com"]);
    if (!user.email || !ADMINS.has(user.email.toLowerCase())) {
      return new Response(JSON.stringify({ error: "forbidden — cert inspection is admin-gated" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const rawUrl = typeof body?.url === "string" ? body.url.trim() : "";
    if (!rawUrl) {
      return new Response(JSON.stringify({ error: "url required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    let u: URL;
    try { u = new URL(rawUrl); } catch {
      return new Response(JSON.stringify({ error: "invalid url" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (u.protocol !== "https:" && u.protocol !== "http:") {
      return new Response(JSON.stringify({ error: "only http/https urls supported" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const guard = guardHost(u.hostname);
    if (guard) {
      return new Response(JSON.stringify({ error: `SSRF guard: ${guard}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const port = u.port ? Number(u.port) : 443;
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return new Response(JSON.stringify({ error: "invalid port" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const report = await fetchPeerCert(u.hostname, port);
    return new Response(JSON.stringify(report), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
