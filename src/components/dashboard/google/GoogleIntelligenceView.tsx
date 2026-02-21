import { useState } from "react";
import {
  Mail, Calendar, HardDrive, Image, Youtube, MapPin, Users,
  Search, Activity, Globe, Shield, RefreshCw, CheckCircle2,
  AlertTriangle, TrendingUp, Clock, FileText, BarChart3,
  Network, Eye, Lock, Smartphone, ChevronRight, Zap,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type GoogleModule = "overview" | "gmail" | "calendar" | "drive" | "photos" | "youtube" | "maps" | "contacts" | "search" | "fit" | "chrome" | "connected";

interface ModuleDef {
  id: GoogleModule;
  label: string;
  icon: React.ElementType;
  description: string;
  status: "connected" | "pending" | "disconnected";
  stats?: { label: string; value: string }[];
}

const modules: ModuleDef[] = [
  { id: "gmail", label: "Gmail", icon: Mail, description: "Email intelligence — communication patterns, contact graphs, sentiment analysis", status: "pending", stats: [{ label: "Emails Analyzed", value: "—" }, { label: "Top Contacts", value: "—" }, { label: "Response Time", value: "—" }] },
  { id: "calendar", label: "Calendar", icon: Calendar, description: "Schedule intelligence — meeting patterns, busy hours, attendee networks", status: "pending", stats: [{ label: "Events", value: "—" }, { label: "Avg Meetings/Day", value: "—" }, { label: "Top Partners", value: "—" }] },
  { id: "drive", label: "Drive", icon: HardDrive, description: "File forensics — storage analysis, sharing patterns, document intelligence", status: "pending", stats: [{ label: "Total Files", value: "—" }, { label: "Storage Used", value: "—" }, { label: "Shared Files", value: "—" }] },
  { id: "photos", label: "Photos", icon: Image, description: "Visual intelligence — location mapping, face detection, timeline analysis", status: "pending", stats: [{ label: "Photos", value: "—" }, { label: "Locations", value: "—" }, { label: "Faces Detected", value: "—" }] },
  { id: "youtube", label: "YouTube", icon: Youtube, description: "Activity intelligence — watch history, subscriptions, engagement patterns", status: "pending", stats: [{ label: "Watch History", value: "—" }, { label: "Subscriptions", value: "—" }, { label: "Categories", value: "—" }] },
  { id: "maps", label: "Maps & Location", icon: MapPin, description: "Location history — movement patterns, frequent places, travel analysis", status: "pending", stats: [{ label: "Locations", value: "—" }, { label: "Countries", value: "—" }, { label: "Total Distance", value: "—" }] },
  { id: "contacts", label: "Contacts", icon: Users, description: "Social graph — relationship mapping, communication frequency, network analysis", status: "pending", stats: [{ label: "Contacts", value: "—" }, { label: "Organizations", value: "—" }, { label: "Clusters", value: "—" }] },
  { id: "search", label: "Search History", icon: Search, description: "Interest profiling — search patterns, trending topics, behavioral analysis", status: "pending", stats: [{ label: "Searches", value: "—" }, { label: "Top Topics", value: "—" }, { label: "Avg/Day", value: "—" }] },
  { id: "fit", label: "Health & Fitness", icon: Activity, description: "Biometric intelligence — activity, sleep, heart rate, body composition", status: "pending", stats: [{ label: "Steps/Day", value: "—" }, { label: "Active Days", value: "—" }, { label: "Avg HR", value: "—" }] },
  { id: "chrome", label: "Chrome History", icon: Globe, description: "Browsing intelligence — site categories, time allocation, interest mapping", status: "pending", stats: [{ label: "Sites Visited", value: "—" }, { label: "Top Domains", value: "—" }, { label: "Browsing Hours", value: "—" }] },
  { id: "connected", label: "Connected Apps", icon: Network, description: "Third-party OAuth — all apps connected via Google, cross-platform correlation", status: "pending", stats: [{ label: "Connected Apps", value: "—" }, { label: "Permissions", value: "—" }, { label: "Risk Level", value: "—" }] },
];

const GoogleIntelligenceView = () => {
  const [activeModule, setActiveModule] = useState<GoogleModule>("overview");
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = () => {
    setIsConnecting(true);
    setTimeout(() => setIsConnecting(false), 2000);
  };

  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border/20 bg-card/20 backdrop-blur-md px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground/10">
                <Shield className="h-5 w-5 text-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-extralight tracking-wide text-foreground">Google Intelligence</h1>
                <p className="text-xs font-extralight text-muted-foreground">Unified intelligence hub — full-spectrum Google account analysis</p>
              </div>
            </div>
          </div>
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="flex items-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-light tracking-wide text-background transition-all hover:bg-foreground/90 disabled:opacity-50"
          >
            {isConnecting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            {isConnecting ? "Connecting…" : "Connect Google Account"}
          </button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          {/* Module Selector Tabs */}
          <Tabs value={activeModule} onValueChange={(v) => setActiveModule(v as GoogleModule)}>
            <TabsList className="h-auto flex-wrap gap-1 bg-transparent p-0 justify-start">
              <TabsTrigger value="overview" className="rounded-xl px-3 py-2 text-xs font-light data-[state=active]:bg-foreground/10 data-[state=active]:text-foreground">
                Overview
              </TabsTrigger>
              {modules.map((m) => (
                <TabsTrigger key={m.id} value={m.id} className="rounded-xl px-3 py-2 text-xs font-light data-[state=active]:bg-foreground/10 data-[state=active]:text-foreground">
                  <m.icon className="h-3.5 w-3.5 mr-1.5" />
                  {m.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="mt-6 space-y-6">
              {/* Architecture Diagram */}
              <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-6">
                <h2 className="text-sm font-light tracking-wide text-foreground mb-4">Intelligence Architecture</h2>
                <div className="flex items-center justify-center py-6">
                  <div className="flex flex-col items-center gap-4 w-full max-w-3xl">
                    <div className="flex items-center gap-3 rounded-xl border border-foreground/20 bg-foreground/5 px-6 py-3">
                      <Lock className="h-5 w-5 text-foreground" />
                      <span className="text-sm font-light text-foreground tracking-wide">Google OAuth Hub</span>
                    </div>
                    <div className="w-px h-6 bg-border/40" />
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 w-full">
                      {modules.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => setActiveModule(m.id)}
                          className="flex items-center gap-2 rounded-xl border border-border/20 bg-card/20 px-3 py-2.5 text-xs font-light text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-all"
                        >
                          <m.icon className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{m.label}</span>
                          <StatusDot status={m.status} />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Capabilities Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <CapabilityCard
                  icon={Eye}
                  title="Entity Resolution"
                  description="Cross-platform identity correlation — link the same person across Gmail, Contacts, Calendar, and connected apps."
                />
                <CapabilityCard
                  icon={Network}
                  title="Social Graph"
                  description="Build complete relationship maps from communication patterns, meeting attendees, and shared files."
                />
                <CapabilityCard
                  icon={TrendingUp}
                  title="Behavioral Analysis"
                  description="Temporal patterns, communication habits, location routines, and digital footprint profiling."
                />
                <CapabilityCard
                  icon={MapPin}
                  title="Geospatial Intelligence"
                  description="Location history mapping, frequent places, travel routes, and geo-tagged photo analysis."
                />
                <CapabilityCard
                  icon={Shield}
                  title="Security Audit"
                  description="Connected app permissions, OAuth scope analysis, data exposure assessment, and risk scoring."
                />
                <CapabilityCard
                  icon={BarChart3}
                  title="Continuous Monitoring"
                  description="Real-time intelligence updates via refresh tokens — Apollo-style persistent data collection."
                />
              </div>

              {/* Module Cards */}
              <div className="space-y-3">
                <h2 className="text-sm font-light tracking-wide text-foreground">Intelligence Modules</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {modules.map((m) => (
                    <ModuleCard key={m.id} module={m} onClick={() => setActiveModule(m.id)} />
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Individual Module Tabs */}
            {modules.map((m) => (
              <TabsContent key={m.id} value={m.id} className="mt-6">
                <ModuleDetailView module={m} />
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </ScrollArea>
    </div>
  );
};

const StatusDot = ({ status }: { status: string }) => (
  <span className={`ml-auto h-1.5 w-1.5 rounded-full shrink-0 ${
    status === "connected" ? "bg-emerald-500" : status === "pending" ? "bg-amber-500/60" : "bg-muted-foreground/30"
  }`} />
);

const CapabilityCard = ({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) => (
  <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-5 space-y-3">
    <div className="flex items-center gap-2.5">
      <Icon className="h-4 w-4 text-foreground/70" />
      <span className="text-sm font-light tracking-wide text-foreground">{title}</span>
    </div>
    <p className="text-xs font-extralight leading-relaxed text-muted-foreground">{description}</p>
  </div>
);

const ModuleCard = ({ module, onClick }: { module: ModuleDef; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="flex items-start gap-4 rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5 text-left hover:bg-foreground/5 transition-all group"
  >
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-foreground/5">
      <module.icon className="h-5 w-5 text-foreground/70" />
    </div>
    <div className="flex-1 min-w-0 space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-sm font-light tracking-wide text-foreground">{module.label}</span>
        <StatusDot status={module.status} />
      </div>
      <p className="text-xs font-extralight leading-relaxed text-muted-foreground">{module.description}</p>
      {module.stats && (
        <div className="flex gap-4 pt-1">
          {module.stats.map((s) => (
            <div key={s.label} className="text-[10px]">
              <span className="text-muted-foreground/50">{s.label}: </span>
              <span className="text-muted-foreground">{s.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
    <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-foreground/50 transition-colors mt-1" />
  </button>
);

const ModuleDetailView = ({ module }: { module: ModuleDef }) => {
  const scopeMap: Record<string, string[]> = {
    gmail: ["gmail.readonly", "gmail.metadata"],
    calendar: ["calendar.readonly", "calendar.events.readonly"],
    drive: ["drive.readonly", "drive.metadata.readonly"],
    photos: ["photoslibrary.readonly"],
    youtube: ["youtube.readonly"],
    maps: ["maps.readonly"],
    contacts: ["contacts.readonly"],
    search: ["myactivity (web)"],
    fit: ["fitness.activity.read", "fitness.location.read", "fitness.body.read"],
    chrome: ["chrome.readonly (extension)"],
    connected: ["OAuth introspection"],
  };

  const featureMap: Record<string, string[]> = {
    gmail: ["Communication graph analysis", "Sentiment analysis on threads", "Contact frequency mapping", "Response time analytics", "Email volume patterns", "Attachment intelligence", "Label/category distribution", "Phishing & spam detection"],
    calendar: ["Meeting density heatmap", "Attendee network graph", "Free/busy hour analysis", "Location pattern tracking", "Work-life balance scoring", "Recurring event analysis", "Schedule prediction", "Travel time estimation"],
    drive: ["File type distribution", "Sharing permission audit", "Collaboration network", "Storage optimization", "Document content analysis", "Version history tracking", "Security risk assessment", "Organization structure mapping"],
    photos: ["Location-based clustering", "Face recognition & grouping", "Timeline visualization", "Camera/device analysis", "AI label detection", "Travel route reconstruction", "Photo frequency patterns", "Metadata extraction"],
    youtube: ["Watch history categorization", "Interest profiling", "Subscription analysis", "Engagement metrics", "Content recommendation patterns", "Watch time distribution", "Channel affinity mapping", "Ad interaction tracking"],
    maps: ["Movement pattern analysis", "Frequent location detection", "Travel history mapping", "Commute analysis", "Place category tagging", "Dwell time analytics", "Route optimization", "Geographic clustering"],
    contacts: ["Relationship strength scoring", "Organization mapping", "Communication frequency", "Contact completeness audit", "Duplicate detection", "Social circle clustering", "VIP identification", "Network centrality analysis"],
    search: ["Topic interest profiling", "Temporal search patterns", "Query complexity analysis", "Intent classification", "Trending interest detection", "Knowledge graph building", "Behavioral prediction", "Information need mapping"],
    fit: ["Activity level tracking", "Sleep pattern analysis", "Heart rate variability", "Calorie burn estimation", "Workout classification", "Health trend detection", "Stress level inference", "Body composition tracking"],
    chrome: ["Site category analysis", "Time allocation mapping", "Productivity scoring", "Interest fingerprinting", "Tab behavior patterns", "Extension usage audit", "Privacy exposure scoring", "Dark pattern detection"],
    connected: ["OAuth scope inventory", "Permission risk scoring", "Data exposure mapping", "App category analysis", "Unused app detection", "Cross-platform correlation", "Token expiry monitoring", "Privilege escalation audit"],
  };

  const scopes = scopeMap[module.id] || [];
  const features = featureMap[module.id] || [];

  return (
    <div className="space-y-6">
      {/* Module Header */}
      <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-foreground/5">
            <module.icon className="h-6 w-6 text-foreground/70" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-extralight tracking-wide text-foreground">{module.label} Intelligence</h2>
              <span className="flex items-center gap-1.5 rounded-lg bg-accent/10 px-2.5 py-1 text-[10px] font-light text-accent">
                <Clock className="h-3 w-3" />
                Awaiting Connection
              </span>
            </div>
            <p className="text-sm font-extralight leading-relaxed text-muted-foreground">{module.description}</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      {module.stats && (
        <div className="grid grid-cols-3 gap-3">
          {module.stats.map((s) => (
            <div key={s.label} className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-4 text-center">
              <p className="text-xl font-extralight text-foreground">{s.value}</p>
              <p className="text-[10px] font-light text-muted-foreground/60 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Required Scopes */}
        <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5 space-y-3">
          <h3 className="text-xs font-light tracking-wide text-foreground flex items-center gap-2">
            <Lock className="h-3.5 w-3.5" />
            Required OAuth Scopes
          </h3>
          <div className="space-y-1.5">
            {scopes.map((scope) => (
              <div key={scope} className="flex items-center gap-2 rounded-lg bg-foreground/5 px-3 py-2">
                <code className="text-[10px] font-light text-muted-foreground break-all">{scope}</code>
              </div>
            ))}
          </div>
        </div>

        {/* Intelligence Features */}
        <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5 space-y-3">
          <h3 className="text-xs font-light tracking-wide text-foreground flex items-center gap-2">
            <Zap className="h-3.5 w-3.5" />
            Intelligence Capabilities
          </h3>
          <div className="space-y-1">
            {features.map((feat) => (
              <div key={feat} className="flex items-center gap-2 py-1.5">
                <CheckCircle2 className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                <span className="text-xs font-extralight text-muted-foreground">{feat}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Data Preview Placeholder */}
      <div className="rounded-2xl border border-dashed border-border/30 bg-card/10 p-10 text-center space-y-3">
        <module.icon className="h-10 w-10 text-muted-foreground/20 mx-auto" />
        <p className="text-sm font-extralight text-muted-foreground/50">Connect your Google account to begin {module.label.toLowerCase()} intelligence collection</p>
        <p className="text-[10px] font-extralight text-muted-foreground/30">Data will be processed locally and encrypted at rest</p>
      </div>
    </div>
  );
};

export default GoogleIntelligenceView;
