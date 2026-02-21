import { useState } from "react";
import {
  Mail, Calendar, HardDrive, Image, Youtube, MapPin, Users,
  Search, Activity, Globe, Shield, RefreshCw, Network, Zap,
  Heart, CreditCard, Briefcase, Brain, Lock, CheckCircle2,
  Eye, TrendingUp, BarChart3, ChevronRight, Clock,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import MultiAccountManager from "./MultiAccountManager";
import LocationProphet from "./modules/LocationProphet";
import EmailAssistant from "./modules/EmailAssistant";
import SubscriptionOracle from "./modules/SubscriptionOracle";
import HealthGuardian from "./modules/HealthGuardian";
import CalendarWizard from "./modules/CalendarWizard";
import ContactIntelligence from "./modules/ContactIntelligence";
import CareerPredictor from "./modules/CareerPredictor";
import AITwin from "./modules/AITwin";

type GoogleModule = "overview" | "location" | "email" | "subscriptions" | "health" | "calendar" | "contacts" | "career" | "twin" | "gmail" | "drive" | "photos" | "youtube" | "search" | "fit" | "chrome" | "connected";

interface ModuleDef {
  id: GoogleModule;
  label: string;
  icon: React.ElementType;
  description: string;
}

const nexusModules: ModuleDef[] = [
  { id: "twin", label: "AI Twin", icon: Brain, description: "Your complete digital replica — predicts decisions, automates life" },
  { id: "location", label: "Location Prophet", icon: MapPin, description: "Predicts where you'll be next week with 95% accuracy" },
  { id: "email", label: "Email Assistant", icon: Mail, description: "Writes emails in YOUR voice, auto-prioritizes inbox" },
  { id: "subscriptions", label: "Subscription Oracle", icon: CreditCard, description: "Tracks every payment, predicts charges, finds waste" },
  { id: "health", label: "Health Guardian", icon: Heart, description: "Detects health anomalies, predicts illness, tracks cycles" },
  { id: "calendar", label: "Calendar Wizard", icon: Calendar, description: "Auto-schedules based on energy levels & patterns" },
  { id: "contacts", label: "Contact Intel", icon: Users, description: "Relationship scoring, social graph, fade detection" },
  { id: "career", label: "Career Predictor", icon: Briefcase, description: "Predicts job changes, salary, and career trajectory" },
];

const dataModules: ModuleDef[] = [
  { id: "gmail", label: "Gmail", icon: Mail, description: "Raw email data feed" },
  { id: "drive", label: "Drive", icon: HardDrive, description: "File storage intelligence" },
  { id: "photos", label: "Photos", icon: Image, description: "Visual intelligence" },
  { id: "youtube", label: "YouTube", icon: Youtube, description: "Watch patterns" },
  { id: "search", label: "Search History", icon: Search, description: "Interest profiling" },
  { id: "fit", label: "Fitness", icon: Activity, description: "Biometric data" },
  { id: "chrome", label: "Chrome", icon: Globe, description: "Browsing intelligence" },
  { id: "connected", label: "Connected Apps", icon: Network, description: "OAuth audit" },
];

const GoogleIntelligenceView = () => {
  const [activeModule, setActiveModule] = useState<GoogleModule>("overview");
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = () => {
    setIsConnecting(true);
    setTimeout(() => setIsConnecting(false), 2000);
  };

  const renderModule = () => {
    switch (activeModule) {
      case "location": return <LocationProphet />;
      case "email": case "gmail": return <EmailAssistant />;
      case "subscriptions": return <SubscriptionOracle />;
      case "health": case "fit": return <HealthGuardian />;
      case "calendar": return <CalendarWizard />;
      case "contacts": return <ContactIntelligence />;
      case "career": return <CareerPredictor />;
      case "twin": return <AITwin />;
      default: return null;
    }
  };

  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border/20 bg-card/20 backdrop-blur-md px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground/10">
              <Shield className="h-5 w-5 text-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-extralight tracking-wide text-foreground">Google Intelligence · Nexus</h1>
              <p className="text-xs font-extralight text-muted-foreground">Full-spectrum intelligence — AI digital twin powered by your Google data</p>
            </div>
          </div>
          <button onClick={handleConnect} disabled={isConnecting} className="flex items-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-light tracking-wide text-background transition-all hover:bg-foreground/90 disabled:opacity-50">
            {isConnecting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            {isConnecting ? "Connecting…" : "Connect Google"}
          </button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          <Tabs value={activeModule} onValueChange={(v) => setActiveModule(v as GoogleModule)}>
            <TabsList className="h-auto flex-wrap gap-1 bg-transparent p-0 justify-start">
              <TabsTrigger value="overview" className="rounded-xl px-3 py-2 text-xs font-light data-[state=active]:bg-foreground/10 data-[state=active]:text-foreground">Overview</TabsTrigger>
              {nexusModules.map((m) => (
                <TabsTrigger key={m.id} value={m.id} className="rounded-xl px-3 py-2 text-xs font-light data-[state=active]:bg-foreground/10 data-[state=active]:text-foreground">
                  <m.icon className="h-3.5 w-3.5 mr-1.5" />{m.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Overview */}
            <TabsContent value="overview" className="mt-6 space-y-6">
              <MultiAccountManager />

              {/* Nexus Modules Grid */}
              <div className="space-y-3">
                <h2 className="text-sm font-light tracking-wide text-foreground">Intelligence Modules</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {nexusModules.map((m) => (
                    <button key={m.id} onClick={() => setActiveModule(m.id)} className="flex items-start gap-4 rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5 text-left hover:bg-foreground/5 transition-all group">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-foreground/5">
                        <m.icon className="h-5 w-5 text-foreground/70" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <span className="text-sm font-light tracking-wide text-foreground">{m.label}</span>
                        <p className="text-xs font-extralight leading-relaxed text-muted-foreground">{m.description}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-foreground/50 transition-colors mt-1" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Data Source Modules */}
              <div className="space-y-3">
                <h2 className="text-sm font-light tracking-wide text-foreground">Data Sources</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {dataModules.map((m) => (
                    <button key={m.id} onClick={() => setActiveModule(m.id)} className="flex items-center gap-2 rounded-xl border border-border/20 bg-card/20 px-3 py-2.5 text-xs font-light text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-all">
                      <m.icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Capabilities */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { icon: Eye, title: "Entity Resolution", desc: "Cross-platform identity correlation across all Google services" },
                  { icon: Network, title: "Social Graph", desc: "Complete relationship maps from communication & meeting patterns" },
                  { icon: TrendingUp, title: "Behavioral Analysis", desc: "Temporal patterns, habits, routines, and digital footprint profiling" },
                  { icon: MapPin, title: "Geospatial Intelligence", desc: "Location history, frequent places, travel routes & predictions" },
                  { icon: Shield, title: "Security Audit", desc: "Connected app permissions, OAuth scope analysis & risk scoring" },
                  { icon: BarChart3, title: "Continuous Monitoring", desc: "Real-time intelligence updates via persistent refresh tokens" },
                ].map((c) => (
                  <div key={c.title} className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-5 space-y-3">
                    <div className="flex items-center gap-2.5">
                      <c.icon className="h-4 w-4 text-foreground/70" />
                      <span className="text-sm font-light tracking-wide text-foreground">{c.title}</span>
                    </div>
                    <p className="text-xs font-extralight leading-relaxed text-muted-foreground">{c.desc}</p>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Module Tabs */}
            {nexusModules.map((m) => (
              <TabsContent key={m.id} value={m.id} className="mt-6">
                {renderModule()}
              </TabsContent>
            ))}
            {dataModules.map((m) => (
              <TabsContent key={m.id} value={m.id} className="mt-6">
                {renderModule() || (
                  <div className="rounded-2xl border border-dashed border-border/30 bg-card/10 p-10 text-center space-y-3">
                    <m.icon className="h-10 w-10 text-muted-foreground/20 mx-auto" />
                    <p className="text-sm font-extralight text-muted-foreground/50">Connect Google to begin {m.label.toLowerCase()} intelligence</p>
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </ScrollArea>
    </div>
  );
};

export default GoogleIntelligenceView;
