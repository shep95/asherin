import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Server, Loader2, Download, FileText } from "lucide-react";
import { testDoh, type DohResult, readAudit, clearAudit, type AuditEntry } from "@/lib/aureonShield";

const Glass = ({ children, className = "" }: any) => (
  <div className={`rounded-2xl border border-border/35 bg-card/55 backdrop-blur-2xl shadow-[0_18px_55px_-25px_hsl(var(--foreground)/0.45)] ${className}`}>{children}</div>
);

export const DohAuditTab = () => {
  const [host, setHost] = useState("cloudflare.com");
  const [doh, setDoh] = useState<DohResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [audit, setAudit] = useState<AuditEntry[]>(readAudit());

  useEffect(() => {
    const h = () => setAudit(readAudit());
    window.addEventListener("asherin:audit", h);
    return () => window.removeEventListener("asherin:audit", h);
  }, []);

  const run = async () => { setBusy(true); try { setDoh(await testDoh(host)); } finally { setBusy(false); } };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), audit, doh }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `aureon-shield-audit-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Glass className="p-6">
        <div className="mb-4 flex items-center gap-2"><Server className="h-4 w-4" /><h2 className="text-sm font-light tracking-wide">DNS-over-HTTPS Resolver Test</h2></div>
        <p className="mb-3 text-xs font-light text-muted-foreground">Live latency & answer comparison across Cloudflare, Google, Quad9, AdGuard. If results differ, your ISP is intercepting DNS.</p>
        <div className="flex gap-2 mb-3">
          <Input value={host} onChange={(e) => setHost(e.target.value)} className="bg-background/40 border-border/40" placeholder="hostname to resolve" />
          <Button onClick={run} disabled={busy} className="bg-foreground/90 text-background hover:bg-foreground">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Test
          </Button>
        </div>
        <div className="space-y-2">
          {doh.map((d) => (
            <div key={d.resolver} className="flex items-center justify-between rounded-xl border border-border/30 bg-background/30 px-4 py-2">
              <div>
                <div className="text-sm font-light">{d.resolver}</div>
                <div className="text-[10px] font-mono text-muted-foreground">{d.answer || "—"}</div>
              </div>
              <div className={`text-xs font-mono ${d.ok ? "text-emerald-300" : "text-red-400"}`}>{d.ok ? `${d.ms} ms` : "FAIL"}</div>
            </div>
          ))}
        </div>
      </Glass>

      <Glass className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2"><FileText className="h-4 w-4" /><h2 className="text-sm font-light tracking-wide">Public Audit Log</h2></div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="border-border/40 bg-card/40" onClick={exportJson}><Download className="h-3 w-3" /> Export</Button>
            <Button size="sm" variant="outline" className="border-border/40 bg-card/40" onClick={clearAudit}>Clear</Button>
          </div>
        </div>
        <p className="mb-3 text-xs font-light text-muted-foreground">Every defensive action is logged here, viewable & exportable. The opposite of paid VPNs that hide their internal logs.</p>
        <div className="rounded-xl border border-border/30 bg-background/30 max-h-72 overflow-y-auto">
          {audit.length === 0 ? <div className="px-4 py-6 text-xs text-muted-foreground text-center">No events yet.</div> :
            audit.slice().reverse().map((e, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2 border-b border-border/20 text-[11px]">
                <span className="font-mono text-muted-foreground/70 shrink-0">{new Date(e.ts).toLocaleTimeString()}</span>
                <span className="font-mono text-emerald-300 w-24 shrink-0">{e.kind}</span>
                <span className="text-foreground/80 truncate">{e.detail}</span>
              </div>
            ))}
        </div>
      </Glass>
    </div>
  );
};
