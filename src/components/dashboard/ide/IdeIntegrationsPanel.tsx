import { useState } from "react";
import { Search, Check, Plus, ExternalLink, Shield, Database, Rocket, CreditCard, Mail, HardDrive, BarChart3, Bug, Brain, SearchIcon, FileText, ClipboardList, Lock, Key, Flame, Server, Zap, Globe, Leaf, CircleDot, Triangle, Train, Plane, Cloud, Citrus, Gamepad2, Send, Smartphone, Package, Image, Activity, TrendingUp, RefreshCw, ScanSearch, PenTool, Layers } from "lucide-react";

interface Integration {
  id: string;
  name: string;
  description: string;
  status: "connected" | "available";
  icon: React.ElementType;
  category: string;
}

const INTEGRATIONS: Integration[] = [
  // Auth
  { id: "supabase-auth", name: "Supabase Auth", description: "Email/Password, OAuth, MFA, RLS", status: "connected", icon: Lock, category: "auth" },
  { id: "clerk", name: "Clerk", description: "Pre-built UI, 20+ OAuth providers", status: "available", icon: Key, category: "auth" },
  { id: "auth0", name: "Auth0", description: "Enterprise SSO, SAML, LDAP", status: "available", icon: Shield, category: "auth" },
  { id: "firebase-auth", name: "Firebase Auth", description: "Google ecosystem, mobile-first", status: "available", icon: Flame, category: "auth" },
  // Database
  { id: "supabase-db", name: "Supabase (PostgreSQL)", description: "Real-time, RLS, Edge Functions", status: "connected", icon: Database, category: "database" },
  { id: "neon", name: "Neon", description: "Serverless Postgres, DB branching", status: "available", icon: Zap, category: "database" },
  { id: "planetscale", name: "PlanetScale", description: "MySQL, non-blocking schema changes", status: "available", icon: Globe, category: "database" },
  { id: "mongodb", name: "MongoDB Atlas", description: "Document DB, aggregation, search", status: "available", icon: Leaf, category: "database" },
  { id: "redis", name: "Upstash Redis", description: "Caching, rate limiting, pub/sub", status: "available", icon: CircleDot, category: "database" },
  // Hosting
  { id: "vercel", name: "Vercel", description: "Git deploy, Edge Functions, Analytics", status: "available", icon: Triangle, category: "hosting" },
  { id: "netlify", name: "Netlify", description: "Git deploy, forms, split testing", status: "available", icon: Globe, category: "hosting" },
  
  { id: "flyio", name: "Fly.io", description: "Global edge, Docker, low latency", status: "available", icon: Plane, category: "hosting" },
  { id: "cloudflare", name: "Cloudflare Pages", description: "275+ cities, Workers, D1, R2", status: "available", icon: Cloud, category: "hosting" },
  // Payments
  { id: "stripe", name: "Stripe", description: "Subscriptions, invoicing, fraud detection", status: "connected", icon: CreditCard, category: "payments" },
  { id: "lemonsqueezy", name: "Lemon Squeezy", description: "All-in-one, handles tax automatically", status: "available", icon: Citrus, category: "payments" },
  { id: "paddle", name: "Paddle", description: "Merchant of record, global tax", status: "available", icon: Gamepad2, category: "payments" },
  // Email
  { id: "resend", name: "Resend", description: "Transactional emails, React templates", status: "available", icon: Mail, category: "email" },
  { id: "sendgrid", name: "SendGrid", description: "Marketing + transactional email", status: "available", icon: Send, category: "email" },
  { id: "twilio", name: "Twilio", description: "SMS, WhatsApp, voice, video", status: "available", icon: Smartphone, category: "email" },
  // Storage
  { id: "supabase-storage", name: "Supabase Storage", description: "S3-compatible, CDN, image transforms", status: "connected", icon: Package, category: "storage" },
  { id: "cloudinary", name: "Cloudinary", description: "AI cropping, video transcoding, DAM", status: "available", icon: Image, category: "storage" },
  { id: "aws-s3", name: "AWS S3", description: "Enterprise object storage", status: "available", icon: Cloud, category: "storage" },
  // Analytics
  { id: "posthog", name: "PostHog", description: "Product analytics, session replay, A/B", status: "available", icon: Activity, category: "analytics" },
  { id: "mixpanel", name: "Mixpanel", description: "Event tracking, funnels, retention", status: "available", icon: BarChart3, category: "analytics" },
  { id: "plausible", name: "Plausible", description: "Privacy-focused, GDPR, cookie-less", status: "available", icon: TrendingUp, category: "analytics" },
  // Error tracking
  { id: "sentry", name: "Sentry", description: "Error tracking, stack traces, performance", status: "available", icon: Bug, category: "monitoring" },
  { id: "logrocket", name: "LogRocket", description: "Session replay, console, network", status: "available", icon: Rocket, category: "monitoring" },
  // AI
  { id: "openai", name: "OpenAI (GPT)", description: "GPT-4, DALL-E, Whisper, TTS", status: "available", icon: Brain, category: "ai" },
  { id: "anthropic", name: "Anthropic Claude", description: "200k context, vision, function calling", status: "available", icon: Brain, category: "ai" },
  { id: "replicate", name: "Replicate", description: "Run any AI model via API", status: "available", icon: RefreshCw, category: "ai" },
  // Search
  { id: "algolia", name: "Algolia", description: "Instant search, typo tolerance, geo", status: "available", icon: ScanSearch, category: "search" },
  { id: "meilisearch", name: "Meilisearch", description: "Open-source instant search", status: "available", icon: SearchIcon, category: "search" },
  // CMS
  { id: "sanity", name: "Sanity", description: "Structured content, real-time collab", status: "available", icon: PenTool, category: "cms" },
  { id: "strapi", name: "Strapi", description: "Open-source headless CMS", status: "available", icon: Layers, category: "cms" },
];

const CATEGORIES: { id: string; label: string; icon: React.ElementType }[] = [
  { id: "all", label: "All", icon: ClipboardList },
  { id: "auth", label: "Auth", icon: Shield },
  { id: "database", label: "Database", icon: Database },
  { id: "hosting", label: "Hosting", icon: Rocket },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "email", label: "Email", icon: Mail },
  { id: "storage", label: "Storage", icon: HardDrive },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "monitoring", label: "Monitoring", icon: Bug },
  { id: "ai", label: "AI", icon: Brain },
  { id: "search", label: "Search", icon: SearchIcon },
  { id: "cms", label: "CMS", icon: FileText },
];

const IdeIntegrationsPanel = () => {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  const filtered = INTEGRATIONS.filter(i => {
    if (category !== "all" && i.category !== category) return false;
    if (search && !i.name.toLowerCase().includes(search.toLowerCase()) && !i.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const connected = filtered.filter(i => i.status === "connected");
  const available = filtered.filter(i => i.status === "available");

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-2 py-2 border-b border-border/10">
        <div className="flex items-center gap-1.5 rounded-lg border border-border/20 bg-card/20 px-2 py-1">
          <Search className="h-3 w-3 text-muted-foreground/40 shrink-0" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search integrations..." className="flex-1 bg-transparent text-[10px] font-light text-foreground outline-none placeholder:text-muted-foreground/30" />
        </div>
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-1 px-2 py-1.5 border-b border-border/10">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-light transition-colors ${category === cat.id ? "bg-accent/20 text-accent" : "text-muted-foreground/40 hover:text-foreground hover:bg-foreground/5"}`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
        {connected.length > 0 && (
          <div>
            <p className="text-[9px] font-light text-muted-foreground/40 uppercase tracking-wider mb-1.5">Connected ({connected.length})</p>
            <div className="space-y-1">
              {connected.map(i => (
                <div key={i.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 group">
                  <i.icon className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-light text-foreground truncate">{i.name}</span>
                      <Check className="h-2.5 w-2.5 text-emerald-500 shrink-0" />
                    </div>
                    <p className="text-[8px] text-muted-foreground/40 truncate">{i.description}</p>
                  </div>
                  <button className="p-1 rounded text-muted-foreground/30 hover:text-foreground opacity-0 group-hover:opacity-100 transition-all" title="Configure">
                    <ExternalLink className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {available.length > 0 && (
          <div>
            <p className="text-[9px] font-light text-muted-foreground/40 uppercase tracking-wider mb-1.5">Available ({available.length})</p>
            <div className="space-y-1">
              {available.map(i => (
                <div key={i.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-border/10 hover:border-accent/20 hover:bg-accent/5 group transition-colors cursor-pointer">
                  <i.icon className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-light text-foreground truncate block">{i.name}</span>
                    <p className="text-[8px] text-muted-foreground/40 truncate">{i.description}</p>
                  </div>
                  <button className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-light text-accent bg-accent/10 hover:bg-accent/20 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                    <Plus className="h-2.5 w-2.5" /> Add
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {filtered.length === 0 && (
          <div className="text-center py-6">
            <p className="text-[10px] text-muted-foreground/40">No integrations found</p>
          </div>
        )}
      </div>

      <div className="px-2 py-1.5 border-t border-border/10 text-center">
        <p className="text-[8px] text-muted-foreground/30">{INTEGRATIONS.length} integrations available</p>
      </div>
    </div>
  );
};

export default IdeIntegrationsPanel;
