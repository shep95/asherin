import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Eye, ShieldCheck } from "lucide-react";
import {
  enableFingerprintSpoofer, disableFingerprintSpoofer, isSpoofActive,
  enableTrackerBlocker, disableTrackerBlocker, isTrackerHookActive,
} from "@/lib/aureonShield";
import { toast } from "sonner";

const Glass = ({ children, className = "" }: any) => (
  <div className={`rounded-2xl border border-border/35 bg-card/55 backdrop-blur-2xl shadow-[0_18px_55px_-25px_hsl(var(--foreground)/0.45)] ${className}`}>{children}</div>
);

export const HardeningTab = () => {
  const [spoof, setSpoof] = useState(isSpoofActive());
  const [block, setBlock] = useState(isTrackerHookActive());

  const onSpoof = (v: boolean) => {
    if (v) { enableFingerprintSpoofer(); toast.success("Fingerprint cloaked — canvas, WebGL, audio, plugins, battery, memory all randomised on this tab"); }
    else { disableFingerprintSpoofer(); toast.info("Fingerprint cloak removed"); }
    setSpoof(v);
  };
  const onBlock = (v: boolean) => {
    if (v) { enableTrackerBlocker(); toast.success("Tracker blocker armed — 50+ networks intercepted"); }
    else { disableTrackerBlocker(); toast.info("Tracker blocker disarmed"); }
    setBlock(v);
  };

  return (
    <Glass className="p-6">
      <div className="mb-4 flex items-center gap-2"><ShieldCheck className="h-4 w-4" /><h2 className="text-sm font-light tracking-wide">Live Browser Hardening</h2></div>
      <p className="mb-4 text-xs font-light text-muted-foreground">
        Each toggle installs a real prototype override on this tab. No reload. No extension. Reverts when toggled off.
      </p>

      <div className="space-y-3">
        {[
          { k: "spoof", on: spoof, set: onSpoof, title: "Fingerprint Cloak", desc: "Randomises Canvas + WebGL vendor/renderer + AudioContext + plugins + battery + deviceMemory + hardwareConcurrency. Defeats Cloudflare/Akamai/Iovation profiling.", badge: "Browser-native" },
          { k: "block", on: block, set: onBlock, title: "Tracker Kill Switch", desc: "Hooks fetch + XMLHttpRequest + sendBeacon. Blocks Google Analytics, Meta Pixel, Doubleclick, Hotjar, Segment, Mixpanel, Sentry telemetry, and 40+ more networks.", badge: "Blocks 50+" },
        ].map((r) => (
          <div key={r.k} className="flex items-start justify-between gap-4 rounded-xl border border-border/30 bg-background/30 p-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-light text-foreground">{r.title}</span>
                <Badge variant="outline" className="border-border/40 text-[9px] font-light">{r.badge}</Badge>
                {r.on && <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30 text-[9px] font-light">ARMED</Badge>}
              </div>
              <p className="mt-1 text-xs font-light text-muted-foreground leading-relaxed">{r.desc}</p>
            </div>
            <Switch checked={r.on} onCheckedChange={r.set} />
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-border/30 bg-background/30 p-4">
        <Eye className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
        <p className="text-[11px] font-light text-muted-foreground leading-relaxed">
          These overrides are scoped to this tab only. Other tabs/apps still leak. To harden every connection, also enable the Tunnel and run the native client.
        </p>
      </div>
    </Glass>
  );
};
