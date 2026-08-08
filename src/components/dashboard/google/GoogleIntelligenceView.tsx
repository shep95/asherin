import { useState } from "react";
import {
  Mail, Calendar, HardDrive, Image, Youtube, MapPin, Users,
  Search, Activity, Globe, Shield, RefreshCw, Network, Zap,
  Heart, CreditCard, Briefcase, Brain, Lock,
  Eye, TrendingUp, BarChart3, Clock,
  FileText, Sparkles, Database, ScrollText, ShieldAlert, Radar, MessageSquare, Video,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import NexusChatPanel from "./NexusChatPanel";
import MultiAccountManager from "./MultiAccountManager";
import LocationProphet from "./modules/LocationProphet";
import EmailAssistant from "./modules/EmailAssistant";
import SubscriptionOracle from "./modules/SubscriptionOracle";
import HealthGuardian from "./modules/HealthGuardian";
import CalendarWizard from "./modules/CalendarWizard";
import ContactIntelligence from "./modules/ContactIntelligence";
import CareerPredictor from "./modules/CareerPredictor";
import AITwin from "./modules/AITwin";
import ProductivityIntelligence from "./modules/ProductivityIntelligence";
import ContentIntelligence from "./modules/ContentIntelligence";
import LifePredictions from "./modules/LifePredictions";
import AutomationSuite from "./modules/AutomationSuite";
import SecurityIntelligence from "./modules/SecurityIntelligence";
import ScenarioEngine from "./modules/ScenarioEngine";
import ConnectedAppsView from "./modules/ConnectedAppsView";
import YouTubeDataView from "./modules/YouTubeDataView";
import SearchHistoryView from "./modules/SearchHistoryView";
import ChromeDataView from "./modules/ChromeDataView";
import GoogleMeshPanel from "./modules/GoogleMeshPanel";
import SubstrateExplorer from "./modules/SubstrateExplorer";
import ContactVaultPane from "./modules/ContactVaultPane";
import RideshareGuardian from "./modules/RideshareGuardian";
import BluetoothSentinel from "./modules/BluetoothSentinel";
import PhoneMessages from "./modules/PhoneMessages";
import MeetVault from "./modules/MeetVault";
import { GOOGLE_REDIRECT_URI } from "@/lib/googleRedirect";

type GoogleModule =
  | "overview" | "substrate" | "mesh" | "dossiers" | "location" | "email" | "subscriptions" | "health"
  | "calendar" | "contacts" | "career" | "twin" | "productivity" | "content" | "predictions"
  | "automation" | "security" | "guardian" | "sentinel" | "messages" | "meet" | "scenarios" | "gmail" | "drive" | "photos" | "youtube"
  | "search" | "fit" | "chrome" | "connected";

/** A directorate is an analytic function, not a product category. */
type Directorate = "COLLECTION" | "ANALYSIS" | "FORECAST" | "COUNTERINTEL";

interface ModuleDef {
  id: GoogleModule;
  label: string;
  /** Operational codename shown above the plain-language label. */
  codename: string;
  icon: React.ElementType;
  /** What the desk is chartered to produce — a mandate, not a sales line. */
  mandate: string;
  directorate: Directorate;
}

const DIRECTORATE_ORDER: Directorate[] = ["COLLECTION", "ANALYSIS", "FORECAST", "COUNTERINTEL"];

const DIRECTORATE_BLURB: Record<Directorate, string> = {
  COLLECTION: "Ingest and fuse raw account traffic into one addressable ledger",
  ANALYSIS: "Resolve entities, score relationships and read behavioural pattern",
  FORECAST: "Project forward from measured cadence — movement, spend, trajectory",
  COUNTERINTEL: "Exposure surface, credential threat chains and permission audit",
};

const nexusModules: ModuleDef[] = [
  { id: "substrate", codename: "SUBSTRATE", label: "Intelligence Substrate", icon: Database, mandate: "Every connected surface harvested into one searchable ledger with findings, briefs and exportable reports", directorate: "COLLECTION" },
  { id: "mesh", codename: "MESH", label: "Account Mesh", icon: Network, mandate: "Voiceprint, place cartography, attention ledger and drafting — composes, never transmits", directorate: "COLLECTION" },
  { id: "email", codename: "COURIER", label: "Correspondence Desk", icon: Mail, mandate: "Inbound triage, thread priority and reply drafting in the operator's own register", directorate: "COLLECTION" },
  { id: "messages", codename: "SIGNAL", label: "Phone Message Intelligence", icon: MessageSquare, mandate: "Google Voice texts, MMS and voicemail mirrored from the mailbox plus on-device Android SMS — folded per correspondent, joined to the address book and read for intent, obligation and pressure", directorate: "COLLECTION" },
  { id: "meet", codename: "VAULT", label: "Meet Vault", icon: Video, mandate: "Every Google Meet reconstructed from calendar records, conference records and the Drive recordings folder — playable in place, downloadable, with transcripts bound to the meeting they belong to", directorate: "COLLECTION" },
  { id: "content", codename: "ARCHIVE", label: "Document & Media Intel", icon: FileText, mandate: "Document intelligence, image content read and file custody mapping", directorate: "COLLECTION" },

  { id: "contacts", codename: "LATTICE", label: "Contact Intelligence", icon: Users, mandate: "Correspondent fusion, reciprocity scoring, psycholinguistic profile and fade detection", directorate: "ANALYSIS" },
  { id: "dossiers", codename: "SENTINEL", label: "Correspondent Dossiers", icon: ScrollText, mandate: "Standing deep-intelligence report on every person who has ever mailed, called or shared a card with you — historical backfill plus automatic build on each new inbound contact", directorate: "ANALYSIS" },
  { id: "twin", codename: "EFFIGY", label: "Behavioural Twin", icon: Brain, mandate: "A model of the operator's decision pattern, built from observed choices only", directorate: "ANALYSIS" },
  { id: "productivity", codename: "CADENCE", label: "Attention Ledger", icon: BarChart3, mandate: "Focus blocks, context-switch cost and collaboration load across the working week", directorate: "ANALYSIS" },
  { id: "health", codename: "VITALS", label: "Physiological Signals", icon: Heart, mandate: "Biometric drift and anomaly flags against the operator's own rolling baseline", directorate: "ANALYSIS" },
  { id: "subscriptions", codename: "LEDGER", label: "Recurring Spend", icon: CreditCard, mandate: "Every recurring charge surfaced with cadence, drift and dormant-service waste", directorate: "ANALYSIS" },

  { id: "location", codename: "WAYPOINT", label: "Movement Forecast", icon: MapPin, mandate: "Place cartography and next-position projection from measured travel cadence", directorate: "FORECAST" },
  { id: "calendar", codename: "HORIZON", label: "Schedule Engine", icon: Calendar, mandate: "Commitment extraction and placement against observed energy and load curves", directorate: "FORECAST" },
  { id: "career", codename: "ASCENT", label: "Trajectory Analysis", icon: Briefcase, mandate: "Role movement, compensation band and professional trajectory indicators", directorate: "FORECAST" },
  { id: "predictions", codename: "AUGUR", label: "Life Projection", icon: Sparkles, mandate: "Travel, relocation, relationship and purchase signals with stated confidence", directorate: "FORECAST" },
  { id: "scenarios", codename: "WARGAME", label: "Scenario Engine", icon: Activity, mandate: "Counterfactual simulation across career, finance and health decision branches", directorate: "FORECAST" },

  { id: "guardian", codename: "GUARDIAN", label: "Rideshare & Message Guardian", icon: ShieldAlert, mandate: "Background assessment of the assigned rideshare driver before boarding, plus forensic read of pasted phone-message threads — pushed to device and email", directorate: "COUNTERINTEL" },
  { id: "sentinel", codename: "SENTINEL", label: "Bluetooth & Area Sentinel", icon: Radar, mandate: "Logs nearby Bluetooth radios, flags the ones recurring across separate times and places as a following pattern, and warns on entry into areas with reported crime or documented group activity — pushed to device and email", directorate: "COUNTERINTEL" },
  { id: "security", codename: "BULWARK", label: "Exposure & Threat", icon: Shield, mandate: "Breach exposure, phishing pressure, credential threat chaining and file audit", directorate: "COUNTERINTEL" },
  { id: "automation", codename: "RELAY", label: "Standing Orders", icon: Zap, mandate: "Conditional handling rules — triage, scheduling and location triggers", directorate: "COUNTERINTEL" },
];

interface FeedDef { id: GoogleModule; label: string; icon: React.ElementType; note: string }

const dataModules: FeedDef[] = [
  { id: "gmail", label: "Mail", icon: Mail, note: "Message corpus" },
  { id: "drive", label: "Drive", icon: HardDrive, note: "File custody" },
  { id: "photos", label: "Photos", icon: Image, note: "Image content" },
  { id: "youtube", label: "YouTube", icon: Youtube, note: "Watch pattern" },
  { id: "search", label: "Query Log", icon: Search, note: "Interest profile" },
  { id: "fit", label: "Fitness", icon: Activity, note: "Biometric feed" },
  { id: "chrome", label: "Browser", icon: Globe, note: "Navigation trace" },
  { id: "connected", label: "OAuth Grants", icon: Network, note: "Permission audit" },
];

const CAPABILITIES = [
  { icon: Eye, title: "Entity Resolution", desc: "One human, many identifiers — addresses, handles and numbers folded into a single resolved record" },
  { icon: Network, title: "Relationship Lattice", desc: "Contact graph inferred from correspondence volume, reciprocity and shared calendar presence" },
  { icon: TrendingUp, title: "Behavioural Baseline", desc: "A 168-cell weekly histogram per subject; anomalies are measured against it, never asserted" },
  { icon: MapPin, title: "Place Cartography", desc: "Frequented locations, routes and dwell time reconstructed from location history" },
  { icon: Shield, title: "Permission Audit", desc: "Third-party OAuth grants enumerated with scope breadth and revocation posture" },
  { icon: Clock, title: "Standing Collection", desc: "Foreground sweeps while open, scheduled server sweeps while closed — the ledger stays current" },
];

const GoogleIntelligenceView = () => {
  const [activeModule, setActiveModule] = useState<GoogleModule>("overview");
  const [isConnecting, setIsConnecting] = useState(false);

  const activeLabel = activeModule === "overview"
    ? "Station Overview"
    : nexusModules.find((m) => m.id === activeModule)?.label
      ?? dataModules.find((m) => m.id === activeModule)?.label
      ?? activeModule;

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await supabase.functions.invoke("google-oauth", {
        // One canonical, Google-registered redirect for every origin; the
        // launching origin travels in `state` so the popup can relay the code.
        body: {
          action: "get_auth_url",
          redirect_uri: GOOGLE_REDIRECT_URI,
          origin: window.location.origin,
        },
      });
      if (res.data?.url) {
        const { openGoogleConsent } = await import("@/lib/googleConsent");
        await openGoogleConsent(res.data.url);
      }
    } catch (err) {
      console.error("[cloud-mesh] authorize failed:", err);
    } finally {
      setIsConnecting(false);
    }
  };

  const renderModule = () => {
    switch (activeModule) {
      case "substrate": return <SubstrateExplorer />;
      case "mesh": return <GoogleMeshPanel />;
      case "dossiers": return <ContactVaultPane />;
      case "location": return <LocationProphet />;
      case "email": case "gmail": return <EmailAssistant />;
      case "subscriptions": return <SubscriptionOracle />;
      case "health": case "fit": return <HealthGuardian />;
      case "calendar": return <CalendarWizard />;
      case "contacts": return <ContactIntelligence />;
      case "career": return <CareerPredictor />;
      case "twin": return <AITwin />;
      case "productivity": return <ProductivityIntelligence />;
      case "content": case "drive": case "photos": return <ContentIntelligence />;
      case "predictions": return <LifePredictions />;
      case "automation": return <AutomationSuite />;
      case "security": return <SecurityIntelligence />;
      case "guardian": return <RideshareGuardian />;
      case "sentinel": return <BluetoothSentinel />;
      case "messages": return <PhoneMessages />;
      case "meet": return <MeetVault />;
      case "scenarios": return <ScenarioEngine />;
      case "connected": return <ConnectedAppsView />;
      case "youtube": return <YouTubeDataView />;
      case "search": return <SearchHistoryView />;
      case "chrome": return <ChromeDataView />;
      default: return null;
    }
  };

  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden">
      {/* ── Station header ─────────────────────────────────────────────── */}
      <header className="flex-shrink-0 border-b border-border/20 bg-card/20 backdrop-blur-md">
        {/* Classification rule — sets the register before any content reads. */}
        <div className="flex items-center justify-between gap-4 border-b border-border/10 px-6 py-1.5">
          <span className="font-mono text-[9px] uppercase tracking-[0.32em] text-muted-foreground/50">
            Restricted · Operator Eyes Only · Maximum Tier
          </span>
          <span className="hidden sm:inline font-mono text-[9px] uppercase tracking-[0.32em] text-muted-foreground/40">
            Held on device · Never resold
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/30 bg-foreground/[0.04]">
              <span className="text-sm text-foreground/70" aria-hidden="true">◈</span>
            </div>
            <div className="space-y-0.5">
              <h1 className="text-base font-extralight tracking-[0.18em] uppercase text-foreground">
                Cloud Intelligence Mesh
              </h1>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">
                Asherin Station · {nexusModules.length} desks · {dataModules.length} feeds
              </p>
            </div>
          </div>

          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="flex items-center gap-2 rounded-lg border border-border/40 bg-foreground/[0.06] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-foreground transition-colors hover:bg-foreground/[0.12] disabled:opacity-50 focus-visible:outline focus-visible:outline-1 focus-visible:outline-foreground/40"
          >
            {isConnecting
              ? <RefreshCw className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
              : <Lock className="h-3.5 w-3.5" />}
            {isConnecting ? "Authorizing" : "Authorize Account"}
          </button>
        </div>
      </header>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-8">
          <Tabs value={activeModule} onValueChange={(v) => setActiveModule(v as GoogleModule)}>
            {/* Desk selector — hairline underline, no filled pills. */}
            <TabsList className="h-auto flex-wrap gap-x-1 gap-y-1 bg-transparent p-0 justify-start border-b border-border/20 w-full rounded-none pb-0">
              <TabsTrigger
                value="overview"
                className="rounded-none border-b border-transparent px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70 data-[state=active]:border-foreground/60 data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                Overview
              </TabsTrigger>
              {nexusModules.map((m) => (
                <TabsTrigger
                  key={m.id}
                  value={m.id}
                  title={m.label}
                  className="rounded-none border-b border-transparent px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70 data-[state=active]:border-foreground/60 data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  {m.codename}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* ── Overview ─────────────────────────────────────────────── */}
            <TabsContent value="overview" className="mt-6 space-y-8">
              <MultiAccountManager />

              {/* Desk directory, grouped by analytic function. */}
              {DIRECTORATE_ORDER.map((dir) => {
                const desks = nexusModules.filter((m) => m.directorate === dir);
                if (!desks.length) return null;
                return (
                  <section key={dir} className="space-y-3">
                    <div className="flex items-baseline gap-3 border-b border-border/15 pb-2">
                      <h2 className="font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/80">{dir}</h2>
                      <p className="text-[11px] font-extralight text-muted-foreground/60 leading-relaxed">
                        {DIRECTORATE_BLURB[dir]}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-border/15 rounded-lg overflow-hidden border border-border/15">
                      {desks.map((m, i) => (
                        <button
                          key={m.id}
                          onClick={() => setActiveModule(m.id)}
                          className="group flex items-start gap-4 bg-card/30 p-4 text-left transition-colors hover:bg-foreground/[0.05] focus-visible:outline focus-visible:outline-1 focus-visible:outline-foreground/40"
                        >
                          <span className="font-mono text-[10px] tabular-nums text-muted-foreground/35 pt-0.5 w-5 shrink-0">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <m.icon className="h-4 w-4 shrink-0 text-foreground/45 mt-0.5 group-hover:text-foreground/75 transition-colors" />
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-baseline gap-x-2">
                              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-foreground">{m.codename}</span>
                              <span className="text-[11px] font-extralight text-muted-foreground/70">{m.label}</span>
                            </div>
                            <p className="text-xs font-extralight leading-relaxed text-muted-foreground">{m.mandate}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>
                );
              })}

              {/* Raw feeds. */}
              <section className="space-y-3">
                <div className="flex items-baseline gap-3 border-b border-border/15 pb-2">
                  <h2 className="font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/80">FEEDS</h2>
                  <p className="text-[11px] font-extralight text-muted-foreground/60">Raw collection surfaces behind the desks</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-px bg-border/15 rounded-lg overflow-hidden border border-border/15">
                  {dataModules.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setActiveModule(m.id)}
                      className="flex items-center gap-2.5 bg-card/30 px-3 py-3 text-left transition-colors hover:bg-foreground/[0.05] focus-visible:outline focus-visible:outline-1 focus-visible:outline-foreground/40"
                    >
                      <m.icon className="h-3.5 w-3.5 shrink-0 text-foreground/45" />
                      <span className="min-w-0">
                        <span className="block truncate font-mono text-[10px] uppercase tracking-[0.14em] text-foreground">{m.label}</span>
                        <span className="block truncate text-[10px] font-extralight text-muted-foreground/60">{m.note}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              {/* Standing capabilities — method, stated plainly. */}
              <section className="space-y-3">
                <div className="flex items-baseline gap-3 border-b border-border/15 pb-2">
                  <h2 className="font-mono text-[10px] uppercase tracking-[0.28em] text-foreground/80">METHOD</h2>
                  <p className="text-[11px] font-extralight text-muted-foreground/60">How the station reaches a conclusion</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {CAPABILITIES.map((c) => (
                    <div key={c.title} className="rounded-lg border border-border/20 bg-card/25 backdrop-blur-md p-4 space-y-2.5">
                      <div className="flex items-center gap-2.5">
                        <c.icon className="h-3.5 w-3.5 text-foreground/50" />
                        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground">{c.title}</span>
                      </div>
                      <p className="text-xs font-extralight leading-relaxed text-muted-foreground">{c.desc}</p>
                    </div>
                  ))}
                </div>
              </section>
            </TabsContent>

            {/* ── Desk panels ──────────────────────────────────────────── */}
            {nexusModules.map((m) => (
              <TabsContent key={m.id} value={m.id} className="mt-6 space-y-4">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border/15 pb-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-foreground">{m.codename}</span>
                  <span className="text-[11px] font-extralight text-muted-foreground/70">{m.label}</span>
                  <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40">{m.directorate}</span>
                </div>
                {renderModule()}
              </TabsContent>
            ))}

            {dataModules.map((m) => (
              <TabsContent key={m.id} value={m.id} className="mt-6 space-y-4">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border/15 pb-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-foreground">{m.label}</span>
                  <span className="text-[11px] font-extralight text-muted-foreground/70">{m.note}</span>
                  <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40">FEED</span>
                </div>
                {renderModule() || (
                  <div className="rounded-lg border border-dashed border-border/25 bg-card/10 p-10 text-center space-y-3">
                    <m.icon className="h-8 w-8 text-muted-foreground/20 mx-auto" />
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">
                      Feed unauthorized — no collection on this surface
                    </p>
                    <button
                      onClick={handleConnect}
                      className="font-mono text-[10px] uppercase tracking-[0.2em] text-foreground/70 underline underline-offset-4 hover:text-foreground transition-colors"
                    >
                      Authorize account
                    </button>
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>

          {/* Station analyst — reads whichever desk is open. */}
          <NexusChatPanel activeModule={activeModule} moduleLabel={activeLabel} />
        </div>
      </ScrollArea>
    </div>
  );
};

export default GoogleIntelligenceView;
