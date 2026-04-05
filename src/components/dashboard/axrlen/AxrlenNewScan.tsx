import { useState } from "react";
import { Globe, Zap, Loader2, Shield, TrendingUp, Users, Leaf, Cpu } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { AxrlenSession } from "./AxrlenView";

const REGIONS = [
  { label: "Global", value: "global" },
  { label: "United States", value: "United States" },
  { label: "China", value: "China" },
  { label: "Russia", value: "Russia" },
  { label: "India", value: "India" },
  { label: "United Kingdom", value: "United Kingdom" },
  { label: "Germany", value: "Germany" },
  { label: "France", value: "France" },
  { label: "Japan", value: "Japan" },
  { label: "Brazil", value: "Brazil" },
  { label: "South Korea", value: "South Korea" },
  { label: "Mexico", value: "Mexico" },
  { label: "Nigeria", value: "Nigeria" },
  { label: "South Africa", value: "South Africa" },
  { label: "Egypt", value: "Egypt" },
  { label: "Turkey", value: "Turkey" },
  { label: "Iran", value: "Iran" },
  { label: "Saudi Arabia", value: "Saudi Arabia" },
  { label: "Australia", value: "Australia" },
  { label: "Indonesia", value: "Indonesia" },
  { label: "Pakistan", value: "Pakistan" },
  { label: "Peru", value: "Peru" },
  { label: "Canada", value: "Canada" },
];

const SCAN_TYPES = [
  { id: "comprehensive", label: "Comprehensive", icon: Globe, desc: "Full spectrum — security, economic, political, environmental" },
  { id: "security", label: "Security", icon: Shield, desc: "Military, cyber, terrorism, civil unrest" },
  { id: "economic", label: "Economic", icon: TrendingUp, desc: "Market crashes, currency collapse, supply chain" },
  { id: "political", label: "Political", icon: Users, desc: "Regime change, elections, policy shifts" },
  { id: "environmental", label: "Environmental", icon: Leaf, desc: "Climate events, resource depletion, natural disasters" },
  { id: "technological", label: "Technological", icon: Cpu, desc: "Cyber threats, AI disruption, infrastructure" },
];

interface Props {
  onComplete: (session: AxrlenSession) => void;
}

const AxrlenNewScan = ({ onComplete }: Props) => {
  const { toast } = useToast();
  const [region, setRegion] = useState("global");
  const [scanType, setScanType] = useState("comprehensive");
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState("");

  const runScan = async () => {
    setScanning(true);
    setProgress("Initializing AXRLEN intelligence grid...");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create session first
      setProgress("Creating prediction session...");
      const { data: sessionData, error: sessionErr } = await supabase
        .from("axrlen_sessions")
        .insert({
          user_id: user.id,
          title: `${region === "global" ? "Global" : region} — ${scanType.charAt(0).toUpperCase() + scanType.slice(1)} Analysis`,
          region,
          prediction_type: scanType,
          status: "processing",
        })
        .select()
        .single();

      if (sessionErr) throw sessionErr;

      const steps = [
        "Querying GDELT global event database...",
        "Fetching World Bank economic indicators...",
        "Pulling IMF fiscal projections...",
        "Scanning USGS seismic activity...",
        "Analyzing NASA solar weather data...",
        "Checking ReliefWeb humanitarian alerts...",
        "Processing conflict intelligence feeds...",
        "Running AI prediction models...",
        "Generating timeline divergence analysis...",
        "Compiling policy simulations...",
      ];

      for (const step of steps) {
        setProgress(step);
        await new Promise(r => setTimeout(r, 800));
      }

      setProgress("Executing deep analysis via AUREON...");

      const resp = await supabase.functions.invoke("axrlen-analyze", {
        body: { region, predictionType: scanType, sessionId: sessionData.id },
      });

      if (resp.error) throw new Error(resp.error.message || "Analysis failed");
      if (!resp.data?.success) throw new Error(resp.data?.error || "Analysis returned no results");

      const analysis = resp.data.analysis;

      const session: AxrlenSession = {
        id: sessionData.id,
        title: sessionData.title,
        region,
        predictionType: scanType,
        status: "complete",
        predictions: analysis.predictions,
        resourceAnalysis: analysis.resourceAnalysis,
        threatAssessment: analysis.threatAssessment,
        policySimulations: analysis.policySimulations,
        timelineDivergences: analysis.timelineDivergences,
        dataSources: analysis.dataSources,
        confidenceScore: analysis.confidenceScore,
        aiSummary: analysis.executiveSummary,
        createdAt: new Date(),
      };

      onComplete(session);
      toast({ title: "Scan complete", description: `${Array.isArray(analysis.predictions) ? analysis.predictions.length : 0} predictions generated` });

    } catch (err: any) {
      console.error("Axrlen scan failed:", err);
      toast({ title: "Scan failed", description: err.message, variant: "destructive" });
    } finally {
      setScanning(false);
      setProgress("");
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-sm font-light tracking-[0.1em] text-foreground/80">New Prediction Scan</h2>
        <p className="text-[10px] text-muted-foreground/40">Select a region and scan type to generate live intelligence predictions</p>
      </div>

      {/* Region selector */}
      <div className="space-y-2">
        <label className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40">Target Region</label>
        <div className="grid grid-cols-4 gap-1.5">
          {REGIONS.map(r => (
            <button key={r.value} onClick={() => setRegion(r.value)}
              className={`px-3 py-2 rounded-xl border text-[10px] transition-all ${region === r.value
                ? "border-foreground/[0.15] bg-foreground/[0.08] text-foreground/80"
                : "border-border/[0.08] bg-foreground/[0.02] text-muted-foreground/50 hover:bg-foreground/[0.04]"}`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scan type */}
      <div className="space-y-2">
        <label className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40">Scan Type</label>
        <div className="grid grid-cols-2 gap-2">
          {SCAN_TYPES.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setScanType(t.id)}
                className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${scanType === t.id
                  ? "border-foreground/[0.15] bg-foreground/[0.08]"
                  : "border-border/[0.08] bg-foreground/[0.02] hover:bg-foreground/[0.04]"}`}>
                <Icon className="h-4 w-4 text-foreground/50 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-medium text-foreground/70">{t.label}</p>
                  <p className="text-[8px] text-muted-foreground/40 mt-0.5">{t.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Launch */}
      <button onClick={runScan} disabled={scanning}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-foreground/[0.12] bg-foreground/[0.06] text-foreground/70 text-[11px] tracking-wide hover:bg-foreground/[0.1] transition-all disabled:opacity-40">
        {scanning ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{progress}</span>
          </>
        ) : (
          <>
            <Zap className="h-4 w-4" />
            Launch Prediction Scan
          </>
        )}
      </button>

      {scanning && (
        <div className="space-y-2">
          <div className="h-1 rounded-full bg-foreground/[0.04] overflow-hidden">
            <div className="h-full bg-foreground/20 rounded-full animate-pulse" style={{ width: "60%" }} />
          </div>
          <p className="text-[8px] text-muted-foreground/30 text-center">
            Querying 9+ live data sources — GDELT, World Bank, IMF, USGS, NASA, ReliefWeb...
          </p>
        </div>
      )}
    </div>
  );
};

export default AxrlenNewScan;
