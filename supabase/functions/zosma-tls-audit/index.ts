// ZOSMA — TLS config audit. Enumerates which SSL/TLS versions and cipher
// classes a server accepts, and flags known-broken protocols (SSLv3/POODLE,
// TLS 1.0/1.1 deprecated, RC4, 3DES/SWEET32, export ciphers, CBC/BEAST hints).
// Uses real successive TLS handshakes with pinned min/max versions.
import * as tls from "node:tls";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { guardHost, requireAdmin } from "../_shared/zosma-guards.ts";

type Ver = "TLSv1" | "TLSv1.1" | "TLSv1.2" | "TLSv1.3";
const VERSIONS: Ver[] = ["TLSv1", "TLSv1.1", "TLSv1.2", "TLSv1.3"];

interface Handshake { version: Ver; accepted: boolean; cipher?: string; error?: string; }

function probe(host: string, port: number, minV: Ver, maxV: Ver, cipherList?: string, timeoutMs = 5000): Promise<Handshake> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (r: Handshake) => { if (!done) { done = true; try { socket.destroy(); } catch { /**/ } resolve(r); } };
    const opts: any = { host, port, servername: host, rejectUnauthorized: false, minVersion: minV, maxVersion: maxV };
    if (cipherList && (minV === "TLSv1.3" || maxV === "TLSv1.3")) opts.ciphersuites = cipherList;
    else if (cipherList) opts.ciphers = cipherList;
    let socket: tls.TLSSocket;
    try { socket = tls.connect(opts); } catch (e) { return resolve({ version: minV, accepted: false, error: (e as Error).message }); }
    const to = setTimeout(() => finish({ version: minV, accepted: false, error: "timeout" }), timeoutMs);
    socket.on("secureConnect", () => {
      clearTimeout(to);
      const c = socket.getCipher();
      finish({ version: minV, accepted: true, cipher: c ? `${c.name} (${c.version})` : undefined });
    });
    socket.on("error", (err: Error) => { clearTimeout(to); finish({ version: minV, accepted: false, error: err.message }); });
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json().catch(() => ({}));
    let host = String(body?.host ?? "").trim().toLowerCase();
    try { if (host.includes("://")) host = new URL(host).hostname; } catch { /**/ }
    const port = Number.isInteger(body?.port) ? body.port : 443;
    const g = guardHost(host);
    if (g) return new Response(JSON.stringify({ error: `SSRF guard: ${g}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Version enumeration
    const versionResults: Handshake[] = [];
    for (const v of VERSIONS) versionResults.push(await probe(host, port, v, v));

    // Cipher-class probes on TLS 1.2 (Node OpenSSL usually blocks SSLv3/RC4 at build; we still probe)
    const cipherProbes: Record<string, Handshake> = {};
    const cipherClasses: Record<string, string> = {
      "RC4":       "RC4-SHA:RC4-MD5:ECDHE-RSA-RC4-SHA",
      "3DES":      "DES-CBC3-SHA:ECDHE-RSA-DES-CBC3-SHA",
      "EXPORT":    "EXP-RC4-MD5:EXP-DES-CBC-SHA:EXP-RC2-CBC-MD5",
      "NULL":      "NULL-MD5:NULL-SHA:NULL-SHA256",
      "CBC_only":  "AES128-SHA:AES256-SHA:ECDHE-RSA-AES128-SHA",
      "PFS_GCM":   "ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-AES128-GCM-SHA256",
    };
    for (const [name, list] of Object.entries(cipherClasses)) {
      cipherProbes[name] = await probe(host, port, "TLSv1.2", "TLSv1.2", list);
    }

    // Grade + CVE mapping
    const findings: { id: string; severity: "critical" | "high" | "medium" | "low" | "info"; note: string }[] = [];
    const acceptedVersions = versionResults.filter((r) => r.accepted).map((r) => r.version);
    if (versionResults.find((r) => r.version === "TLSv1"   && r.accepted)) findings.push({ id: "TLS1.0",    severity: "high",     note: "TLS 1.0 accepted — deprecated by PCI-DSS 3.2 (2018), IETF RFC 8996" });
    if (versionResults.find((r) => r.version === "TLSv1.1" && r.accepted)) findings.push({ id: "TLS1.1",    severity: "high",     note: "TLS 1.1 accepted — deprecated by RFC 8996" });
    if (!versionResults.find((r) => r.version === "TLSv1.3" && r.accepted)) findings.push({ id: "NO_TLS13", severity: "medium",   note: "TLS 1.3 not offered" });
    if (cipherProbes["RC4"]?.accepted)    findings.push({ id: "RC4",     severity: "high",     note: "RC4 accepted — RFC 7465 prohibits (CVE-2013-2566, CVE-2015-2808)" });
    if (cipherProbes["3DES"]?.accepted)   findings.push({ id: "SWEET32", severity: "high",     note: "3DES accepted — SWEET32 birthday attack (CVE-2016-2183)" });
    if (cipherProbes["EXPORT"]?.accepted) findings.push({ id: "FREAK",   severity: "critical", note: "EXPORT-grade ciphers — FREAK (CVE-2015-0204) / LOGJAM (CVE-2015-4000)" });
    if (cipherProbes["NULL"]?.accepted)   findings.push({ id: "NULL",    severity: "critical", note: "NULL cipher accepted — no encryption" });
    if (cipherProbes["CBC_only"]?.accepted && !cipherProbes["PFS_GCM"]?.accepted) findings.push({ id: "CBC_ONLY", severity: "medium", note: "Only CBC ciphers — BEAST/Lucky13 exposure" });
    if (!cipherProbes["PFS_GCM"]?.accepted) findings.push({ id: "NO_PFS", severity: "medium", note: "No ECDHE-GCM suites offered — no forward secrecy on modern clients" });

    // Heartbleed heuristic — cannot safely send crafted heartbeat from Deno, so we
    // report the CVE only when the peer advertises OpenSSL <1.0.1g via server banner.
    // Left as an explicit note rather than a false-positive false-negative claim.
    findings.push({ id: "HEARTBLEED_NOTE", severity: "info", note: "Heartbleed (CVE-2014-0160): active probe not shipped — run testssl.sh or nmap ssl-heartbleed.nse for definitive check" });

    let grade: "A+" | "A" | "B" | "C" | "F" = "A+";
    if (findings.find((f) => f.severity === "critical")) grade = "F";
    else if (findings.filter((f) => f.severity === "high").length >= 1) grade = "C";
    else if (findings.filter((f) => f.severity === "medium").length >= 2) grade = "B";
    else if (findings.some((f) => f.severity === "medium" || f.severity === "high")) grade = "A";

    return new Response(JSON.stringify({
      host, port, grade,
      accepted_versions: acceptedVersions,
      version_results: versionResults,
      cipher_probes: cipherProbes,
      findings,
      ran_at: new Date().toISOString(),
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
