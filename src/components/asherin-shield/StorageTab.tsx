import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { HardDrive, Trash2, RefreshCw } from "lucide-react";
import { storageSweep, nukeStorage, type StorageReport } from "@/lib/asherinShield";
import { toast } from "sonner";

const Glass = ({ children, className = "" }: any) => (
  <div className={`rounded-2xl border border-border/35 bg-card/55 backdrop-blur-2xl shadow-[0_18px_55px_-25px_hsl(var(--foreground)/0.45)] ${className}`}>{children}</div>
);

export const StorageTab = () => {
  const [r, setR] = useState<StorageReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [opts, setOpts] = useState({ cookies: true, ls: true, ss: true, idb: true, caches: true, sw: false });

  const refresh = async () => { setBusy(true); try { setR(await storageSweep()); } finally { setBusy(false); } };
  useEffect(() => { refresh(); }, []);

  const nuke = async () => {
    if (!confirm("Wipe selected storage on THIS origin? You will be logged out of Asherin if you check service workers.")) return;
    setBusy(true);
    try {
      const wiped = await nukeStorage(opts);
      toast.success(`Wiped: ${wiped.join(", ")}`);
      await refresh();
    } finally { setBusy(false); }
  };

  return (
    <Glass className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2"><HardDrive className="h-4 w-4" /><h2 className="text-sm font-light tracking-wide">Storage Forensic Sweep</h2></div>
        <Button size="sm" variant="outline" className="border-border/40 bg-card/40" onClick={refresh} disabled={busy}><RefreshCw className="h-3 w-3" /> Re-scan</Button>
      </div>

      {r && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
            {[
              { k: "Cookies", v: r.cookies.length },
              { k: "LocalStorage", v: r.localStorage.length },
              { k: "SessionStorage", v: r.sessionStorage.length },
              { k: "IndexedDB", v: r.indexedDB.length },
              { k: "Cache APIs", v: r.caches.length },
              { k: "Service Workers", v: r.serviceWorkers },
            ].map((x) => (
              <div key={x.k} className="rounded-xl border border-border/30 bg-background/30 p-3">
                <div className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground">{x.k}</div>
                <div className="mt-1 text-2xl font-extralight">{x.v}</div>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div className="rounded-xl border border-border/30 bg-background/30 p-3 max-h-48 overflow-y-auto">
              <div className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground mb-2">Cookies</div>
              {r.cookies.length === 0 ? <div className="text-xs text-muted-foreground">None</div> :
                r.cookies.map((c) => <div key={c.name} className="text-[11px] font-mono text-foreground/80 truncate">{c.name}={c.value.slice(0, 24)}{c.value.length > 24 ? "…" : ""}</div>)}
            </div>
            <div className="rounded-xl border border-border/30 bg-background/30 p-3 max-h-48 overflow-y-auto">
              <div className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground mb-2">LocalStorage / IndexedDB / Caches</div>
              {[...r.localStorage.map((x) => `LS · ${x.key} (${x.size} bytes)`),
                ...r.indexedDB.map((x) => `IDB · ${x}`),
                ...r.caches.map((x) => `Cache · ${x}`),
              ].map((s, i) => <div key={i} className="text-[11px] font-mono text-foreground/80 truncate">{s}</div>)}
            </div>
          </div>

          <div className="rounded-xl border border-red-400/30 bg-red-500/5 p-4">
            <div className="text-xs font-light text-red-300 mb-3">Surgical wipe — choose layers, then nuke</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
              {(["cookies","ls","ss","idb","caches","sw"] as const).map((k) => (
                <label key={k} className="flex items-center gap-2 text-xs">
                  <Checkbox checked={opts[k]} onCheckedChange={(v) => setOpts((s) => ({ ...s, [k]: !!v }))} />
                  {k === "cookies" ? "Cookies" : k === "ls" ? "LocalStorage" : k === "ss" ? "SessionStorage" : k === "idb" ? "IndexedDB" : k === "caches" ? "Cache API" : "Service Workers"}
                </label>
              ))}
            </div>
            <Button onClick={nuke} disabled={busy} className="bg-red-500/80 hover:bg-red-500 text-background"><Trash2 className="h-4 w-4" /> Wipe selected</Button>
          </div>
        </>
      )}
    </Glass>
  );
};
