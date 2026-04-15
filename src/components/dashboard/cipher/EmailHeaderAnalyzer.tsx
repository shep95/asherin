import { useState, useMemo } from "react";
import { Mail, AlertTriangle, Check, Shield, Globe, Clock, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface HeaderField { key: string; value: string; }
interface HopInfo { from: string; by: string; date: string; delay: string; }
interface SecurityCheck { name: string; status: "pass" | "fail" | "neutral" | "none"; detail: string; }

function parseHeaders(raw: string): HeaderField[] {
  const fields: HeaderField[] = [];
  const lines = raw.split("\n");
  let current = "";
  for (const line of lines) {
    if (/^\s/.test(line) && current) {
      current += " " + line.trim();
    } else {
      if (current) {
        const idx = current.indexOf(":");
        if (idx > 0) fields.push({ key: current.slice(0, idx).trim(), value: current.slice(idx + 1).trim() });
      }
      current = line;
    }
  }
  if (current) {
    const idx = current.indexOf(":");
    if (idx > 0) fields.push({ key: current.slice(0, idx).trim(), value: current.slice(idx + 1).trim() });
  }
  return fields;
}

function extractHops(fields: HeaderField[]): HopInfo[] {
  return fields.filter(f => f.key.toLowerCase() === "received").map(f => {
    const fromM = f.value.match(/from\s+([^\s(]+)/i);
    const byM = f.value.match(/by\s+([^\s(]+)/i);
    const dateM = f.value.match(/;\s*(.+)$/);
    return { from: fromM?.[1] || "unknown", by: byM?.[1] || "unknown", date: dateM?.[1]?.trim() || "", delay: "" };
  }).reverse();
}

function checkSecurity(fields: HeaderField[]): SecurityCheck[] {
  const checks: SecurityCheck[] = [];
  const authResults = fields.find(f => f.key.toLowerCase() === "authentication-results")?.value || "";
  
  const spf = authResults.match(/spf=(\w+)/i);
  checks.push({ name: "SPF", status: spf ? (spf[1] === "pass" ? "pass" : "fail") : "none", detail: spf ? `spf=${spf[1]}` : "No SPF record found" });

  const dkim = authResults.match(/dkim=(\w+)/i);
  checks.push({ name: "DKIM", status: dkim ? (dkim[1] === "pass" ? "pass" : "fail") : "none", detail: dkim ? `dkim=${dkim[1]}` : "No DKIM signature" });

  const dmarc = authResults.match(/dmarc=(\w+)/i);
  checks.push({ name: "DMARC", status: dmarc ? (dmarc[1] === "pass" ? "pass" : "fail") : "none", detail: dmarc ? `dmarc=${dmarc[1]}` : "No DMARC policy" });

  const tls = fields.some(f => f.value.toLowerCase().includes("tls") || f.value.toLowerCase().includes("esmtps"));
  checks.push({ name: "TLS", status: tls ? "pass" : "neutral", detail: tls ? "Encrypted in transit" : "No TLS detected" });

  const replyTo = fields.find(f => f.key.toLowerCase() === "reply-to")?.value;
  const from = fields.find(f => f.key.toLowerCase() === "from")?.value;
  if (replyTo && from) {
    const fromDomain = from.match(/@([^>]+)/)?.[1]?.trim();
    const replyDomain = replyTo.match(/@([^>]+)/)?.[1]?.trim();
    checks.push({ name: "Reply-To Match", status: fromDomain === replyDomain ? "pass" : "fail", detail: replyDomain !== fromDomain ? `Reply-To domain (${replyDomain}) differs from From (${fromDomain})` : "Domains match" });
  }

  return checks;
}

const statusColor = (s: string) => {
  if (s === "pass") return "text-emerald-400 border-emerald-500/30";
  if (s === "fail") return "text-red-400 border-red-500/30";
  return "text-amber-400/60 border-amber-500/20";
};

const SAMPLE = `From: sender@example.com
To: recipient@example.com
Subject: Test Email
Date: Mon, 15 Apr 2026 10:30:00 +0000
Received: from mail.example.com (mail.example.com [203.0.113.1]) by mx.recipient.com with ESMTPS; Mon, 15 Apr 2026 10:30:00 +0000
Received: from internal.example.com (10.0.0.1) by mail.example.com; Mon, 15 Apr 2026 10:29:58 +0000
Authentication-Results: mx.recipient.com; spf=pass smtp.mailfrom=example.com; dkim=pass header.d=example.com; dmarc=pass
DKIM-Signature: v=1; a=rsa-sha256; d=example.com; s=selector1;
X-Mailer: Microsoft Outlook 16.0
Reply-To: sender@example.com`;

const EmailHeaderAnalyzer = () => {
  const [raw, setRaw] = useState("");
  const fields = useMemo(() => parseHeaders(raw), [raw]);
  const hops = useMemo(() => extractHops(fields), [fields]);
  const security = useMemo(() => checkSecurity(fields), [fields]);

  const subject = fields.find(f => f.key.toLowerCase() === "subject")?.value;
  const from = fields.find(f => f.key.toLowerCase() === "from")?.value;
  const to = fields.find(f => f.key.toLowerCase() === "to")?.value;

  return (
    <div className="h-full flex flex-col bg-background/40">
      <div className="px-4 py-3 border-b border-border/[0.06] flex items-center gap-3">
        <Mail className="h-4 w-4 text-foreground/40" />
        <div>
          <h2 className="text-[11px] font-light tracking-[0.1em] text-foreground/80 uppercase">Email Header Analyzer</h2>
          <p className="text-[8px] text-muted-foreground/30">Detect spoofing, verify SPF/DKIM/DMARC, trace mail hops</p>
        </div>
        <Button size="sm" variant="ghost" className="ml-auto text-[9px] h-6" onClick={() => setRaw(SAMPLE)}>Load Sample</Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <Textarea value={raw} onChange={e => setRaw(e.target.value)} placeholder="Paste raw email headers here..."
          className="min-h-[140px] text-xs font-mono bg-card/30 border-border/[0.08]" />

        {fields.length > 0 && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              {[{ label: "From", value: from }, { label: "To", value: to }, { label: "Subject", value: subject }].map(item => (
                <div key={item.label} className="rounded-lg border border-border/[0.08] bg-card/20 p-3">
                  <div className="text-[8px] text-muted-foreground/30 uppercase">{item.label}</div>
                  <div className="text-[10px] text-foreground/70 truncate mt-0.5">{item.value || "—"}</div>
                </div>
              ))}
            </div>

            {/* Security checks */}
            <div className="rounded-lg border border-border/[0.08] bg-card/20 p-3 space-y-2">
              <div className="text-[9px] text-muted-foreground/30 uppercase tracking-wider flex items-center gap-2">
                <Shield className="h-3 w-3" /> Security Checks
              </div>
              <div className="grid grid-cols-2 gap-2">
                {security.map(c => (
                  <div key={c.name} className="flex items-center gap-2 text-[10px]">
                    <Badge variant="outline" className={`text-[8px] h-5 ${statusColor(c.status)}`}>
                      {c.status === "pass" ? <Check className="h-2.5 w-2.5 mr-0.5" /> : c.status === "fail" ? <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> : null}
                      {c.name}
                    </Badge>
                    <span className="text-muted-foreground/40 truncate">{c.detail}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Mail hops */}
            {hops.length > 0 && (
              <div className="rounded-lg border border-border/[0.08] bg-card/20 p-3 space-y-2">
                <div className="text-[9px] text-muted-foreground/30 uppercase tracking-wider flex items-center gap-2">
                  <Globe className="h-3 w-3" /> Mail Route ({hops.length} hops)
                </div>
                <div className="space-y-1">
                  {hops.map((hop, i) => (
                    <div key={i} className="flex items-center gap-3 text-[10px] py-1.5 border-b border-border/[0.04] last:border-0">
                      <Badge variant="outline" className="text-[8px] h-4 bg-foreground/[0.03] min-w-[20px] justify-center">{i + 1}</Badge>
                      <Server className="h-3 w-3 text-muted-foreground/20" />
                      <div className="flex-1">
                        <span className="text-foreground/60 font-mono">{hop.from}</span>
                        <span className="text-muted-foreground/30 mx-1.5">→</span>
                        <span className="text-foreground/60 font-mono">{hop.by}</span>
                      </div>
                      <span className="text-muted-foreground/25 text-[9px]">{hop.date}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* All headers */}
            <div className="rounded-lg border border-border/[0.08] bg-card/20 p-3">
              <div className="text-[9px] text-muted-foreground/30 uppercase tracking-wider mb-2">All Headers ({fields.length})</div>
              <div className="max-h-[300px] overflow-y-auto divide-y divide-border/[0.04]">
                {fields.map((f, i) => (
                  <div key={i} className="flex gap-3 py-1.5 text-[10px]">
                    <span className="text-foreground/50 font-mono shrink-0 w-[180px] truncate">{f.key}</span>
                    <span className="text-foreground/30 font-mono break-all">{f.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default EmailHeaderAnalyzer;
