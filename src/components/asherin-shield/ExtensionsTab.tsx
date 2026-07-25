import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Puzzle, Loader2 } from "lucide-react";
import { probeExtensions, type ExtensionDetection } from "@/lib/asherinShield";

const Glass = ({ children, className = "" }: any) => (
  <div className={`rounded-2xl border border-border/35 bg-card/55 backdrop-blur-2xl shadow-[0_18px_55px_-25px_hsl(var(--foreground)/0.45)] ${className}`}>{children}</div>
);

export const ExtensionsTab = () => {
  const [list, setList] = useState<ExtensionDetection[]>([]);
  const [busy, setBusy] = useState(false);

  const run = async () => { setBusy(true); try { setList(await probeExtensions()); } finally { setBusy(false); } };

  const present = list.filter((x) => x.present);
  const wallets = present.filter((x) => /Wallet|MetaMask|Phantom|Rabby/i.test(x.name));

  return (
    <Glass className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2"><Puzzle className="h-4 w-4" /><h2 className="text-sm font-light tracking-wide">Browser Extension X-Ray</h2></div>
        <Button size="sm" onClick={run} disabled={busy} className="bg-foreground/90 text-background hover:bg-foreground">
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : null} Probe extensions
        </Button>
      </div>
      <p className="mb-4 text-xs font-light text-muted-foreground">
        Probes {20} known extensions via timing-attack on their <span className="font-mono">web_accessible_resources</span>. Detection works in any Chromium browser without permission. Results never leave your device.
      </p>

      {list.length === 0 && !busy && <div className="text-xs text-muted-foreground">Click Probe to scan.</div>}

      {list.length > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="rounded-xl border border-border/30 bg-background/30 p-3"><div className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground">Probed</div><div className="text-2xl font-extralight">{list.length}</div></div>
            <div className="rounded-xl border border-border/30 bg-background/30 p-3"><div className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground">Present</div><div className="text-2xl font-extralight text-emerald-300">{present.length}</div></div>
            <div className="rounded-xl border border-border/30 bg-background/30 p-3"><div className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground">Crypto wallets</div><div className="text-2xl font-extralight text-yellow-300">{wallets.length}</div></div>
            <div className="rounded-xl border border-border/30 bg-background/30 p-3"><div className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground">Risk</div><div className="text-sm font-light">{wallets.length > 0 ? "Wallet detectable by every site you visit" : "Low"}</div></div>
          </div>

          <div className="grid md:grid-cols-2 gap-2">
            {list.map((e) => (
              <div key={e.id} className={`flex items-center justify-between rounded-xl border px-4 py-2 ${e.present ? "border-emerald-400/30 bg-emerald-500/5" : "border-border/30 bg-background/30"}`}>
                <div>
                  <div className="text-sm font-light">{e.name}</div>
                  <div className="text-[10px] font-mono text-muted-foreground truncate">{e.id}</div>
                </div>
                <Badge variant="outline" className={`font-light text-[10px] ${e.present ? "border-emerald-400/40 text-emerald-300" : "border-border/40 text-muted-foreground"}`}>{e.present ? "INSTALLED" : "Not present"}</Badge>
              </div>
            ))}
          </div>
        </>
      )}
    </Glass>
  );
};
