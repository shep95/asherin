import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import ByokRequiredDialog from "@/components/ByokRequiredDialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, Link, useParams } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { StepUpProvider } from "@/components/auth/StepUpProvider";

import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import React, { Suspense, useState } from "react";
import RootErrorBoundary from "@/components/RootErrorBoundary";
import { lazyWithRetry as lazy } from "@/lib/lazyWithRetry";
import Header from "@/components/Header";
import LandingBackground from "@/components/LandingBackground";
import SiteFooter from "@/components/SiteFooter";

const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const SecurityPolicy = lazy(() => import("./pages/SecurityPolicy"));
const Founder = lazy(() => import("./pages/Founder"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Asher = lazy(() => import("./pages/Asher"));
const AsherDashboard = lazy(() => import("./pages/AsherDashboard"));
const Forums = lazy(() => import("./pages/Forums"));
const Software = lazy(() => import("./pages/Software"));
function ForHub() {
  const { slug } = useParams();
  const [q, setQ] = useState("asherin");
  const [hits, setHits] = useState<{ title: string; url: string; via: string }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const desks = [
    {
      slug: "research",
      h1: "people who already chat with a model",
      description:
        "you already talk to a model. this seat keeps sources next to the answer — public-index search, a map, a vault, memory.",
    },
    {
      slug: "journalists",
      h1: "journalists",
      description: "sourced chat and a logged-out public-index look. first click is look, not a paywall.",
    },
    {
      slug: "companies",
      h1: "companies",
      description:
        "one seat for a desk: chat, public-index search, a map, a vault, memory. $18 / month. $79 / month pro.",
    },
    {
      slug: "investigators",
      h1: "private investigators",
      description: "public-index look first. wikipedia + wayback. this is not a dork battery.",
    },
    {
      slug: "analysts",
      h1: "data analytics people",
      description: "same seat as the other four desks. bring your own key and the software is free.",
    },
  ];
  const runLook = async () => {
    setBusy(true);
    try {
      const s = q.trim().slice(0, 80);
      const out: { title: string; url: string; via: string }[] = [];
      const seen = new Set<string>();
      if (s) {
        try {
          const cdxRes = await fetch(
            "https://web.archive.org/cdx/search/cdx?output=json&fl=original,timestamp,statuscode&filter=statuscode:200&limit=5&url=" +
              encodeURIComponent(s),
          );
          if (cdxRes.ok) {
            const j = (await cdxRes.json()) as string[][];
            if (Array.isArray(j)) {
              for (const rec of j.slice(1, 6)) {
                const original = rec[0];
                if (!original || seen.has(original)) continue;
                seen.add(original);
                out.push({
                  title: original,
                  url: "https://web.archive.org/web/" + (rec[1] || "") + "/" + original,
                  via: "wayback",
                });
              }
            }
          }
        } catch {
          /* index quiet */
        }
        try {
          const wikiRes = await fetch(
            "https://en.wikipedia.org/w/api.php?action=opensearch&limit=5&namespace=0&format=json&origin=*&search=" +
              encodeURIComponent(s),
          );
          if (wikiRes.status === 200) {
            const j = (await wikiRes.json()) as [string, string[], string[], string[]];
            const titles = j[1] || [];
            const urls = j[3] || [];
            for (let i = 0; i < titles.length; i++) {
              if (!urls[i] || seen.has(urls[i])) continue;
              seen.add(urls[i]);
              out.push({ title: titles[i], url: urls[i], via: "wikipedia" });
            }
          }
        } catch {
          /* index quiet */
        }
      }
      setHits(out);
    } catch {
      setHits([]);
    } finally {
      setBusy(false);
    }
  };
  if (typeof document !== "undefined") document.title = "who asherin is for";
  return (
    <LandingBackground>
      <Header />
      <section className="relative z-10 flex min-h-[88vh] flex-col justify-center px-6 pt-32 pb-20">
        <div className="mx-auto w-full max-w-3xl">
          <h1 className="font-display text-4xl sm:text-5xl font-light tracking-[-0.025em] leading-[1.05] text-foreground">
            who asherin is for
          </h1>
          <p className="mt-6 max-w-xl text-base font-extralight leading-relaxed text-muted-foreground">
            five desks. same seat: sourced chat, public-index search, a map, a vault, memory. $18 / month. $79 / month
            pro. bring your own key and the software is free.
          </p>
          <p className="mt-4 max-w-xl text-base font-extralight leading-relaxed text-muted-foreground">
            this page is the look, not a spa-empty homepage. people who already chat with a model, journalists,
            companies, private investigators, and data analytics people share one seat. the first click is look —
            wikipedia + wayback — not a paywall.
          </p>
          <div className="mt-10 rounded-2xl border border-border/20 bg-card/25 backdrop-blur-md px-6 py-5">
            <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-foreground/40">one public-index look</p>
            <p className="mt-2 text-sm font-extralight leading-relaxed text-muted-foreground">
              no signup. wikipedia + wayback. this is not a dork battery.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full rounded-lg border border-border/30 bg-background/40 px-3 py-2 text-sm font-light text-foreground"
                aria-label="public index query"
              />
              <button
                type="button"
                onClick={runLook}
                disabled={busy}
                className="shrink-0 rounded-lg bg-foreground px-4 py-2 text-sm font-light text-background disabled:opacity-50"
              >
                {busy ? "looking…" : "look"}
              </button>
            </div>
            {hits && (
              <ul className="mt-4 space-y-2">
                {hits.length === 0 ? (
                  <li className="text-sm font-extralight text-muted-foreground">
                    no public-index hit. this is unsure if the index was quiet.
                  </li>
                ) : (
                  hits.map((h) => (
                    <li key={h.url} className="text-sm font-extralight">
                      <a
                        href={h.url}
                        className="text-foreground underline-offset-2 hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {h.title}
                      </a>
                      <span className="ml-2 text-[10px] uppercase tracking-wider text-foreground/40">{h.via}</span>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
          <ul className="mt-12 space-y-4">
            {desks.map((a) => (
              <li key={a.slug}>
                <Link
                  to={"/for/" + a.slug}
                  className={`block rounded-2xl border bg-card/25 backdrop-blur-md px-6 py-5 transition-colors hover:border-foreground/25 ${
                    slug === a.slug ? "border-foreground/40" : "border-border/20"
                  }`}
                >
                  <p className="text-base font-light tracking-tight text-foreground">{a.h1}</p>
                  <p className="mt-2 text-sm font-extralight leading-relaxed text-muted-foreground">{a.description}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <SiteFooter />
    </LandingBackground>
  );
}

const WhiteboardPage = lazy(() => import("./pages/WhiteboardPage"));
const BlogVeniceIntegration = lazy(() => import("./pages/BlogVeniceIntegration"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogAsherFoldMemory = lazy(() => import("./pages/blog/AsherFoldMemory"));
const SiteTraffic = lazy(() => import("./pages/NotFound").then((m) => ({ default: m.SiteTraffic })));
const BlogPaidSeatFreeDoor = lazy(() => import("./pages/Blog").then((m) => ({ default: m.PaidSeatFreeDoor })));
const Updates = lazy(() => import("./pages/Updates"));
const Sources = lazy(() => import("./pages/Sources"));
const Ziaassets = lazy(() => import("./pages/Ziaassets"));
const IntelligenceReport = lazy(() => import("./pages/IntelligenceReport"));

// SEO content cluster (Theories 8-14): glossary, satellites, predictions, feature spines.
const GlossaryIndex = lazy(() => import("./pages/glossary/GlossaryIndex"));
const GlossarySovereignAi = lazy(() => import("./pages/glossary/SovereignAi"));
const GlossaryUncensoredAi = lazy(() => import("./pages/glossary/UncensoredAi"));
const GlossaryByokAi = lazy(() => import("./pages/glossary/ByokAi"));
const GlossaryDigitalGnostic = lazy(() => import("./pages/glossary/DigitalGnostic"));
const BlogWhatIsAiOsint = lazy(() => import("./pages/blog/WhatIsAiOsint"));
const BlogSovereignAiPlatforms = lazy(() => import("./pages/blog/SovereignAiPlatforms"));
const BlogAiWithoutRestrictions = lazy(() => import("./pages/blog/AiWithoutRestrictions"));
const BlogTheTruthAndRealityOfWars = lazy(() => import("./pages/blog/TheTruthAndRealityOfWars"));
const BlogZaxinTacticalBleIntelligence = lazy(() => import("./pages/blog/ZaxinTacticalBleIntelligence"));
const BlogCodeNarrativeQuantumCollapse = lazy(() => import("./pages/blog/CodeNarrativeQuantumCollapse"));
const BlogAureonLegalAdvisor = lazy(() => import("./pages/blog/AureonLegalAdvisor"));
const BlogAsherinEngineDeepTime = lazy(() => import("./pages/blog/AsherinEngineDeepTime"));
const BlogCloudIntelligenceSuite = lazy(() => import("./pages/blog/CloudIntelligenceSuite"));
const BlogAsherinMapsFindMy = lazy(() => import("./pages/blog/AsherinMapsFindMy"));
const BlogTransitGuardian = lazy(() => import("./pages/blog/TransitGuardian"));
const BlogBulwarkCounterSurveillance = lazy(() => import("./pages/blog/BulwarkCounterSurveillance"));
const BlogAutonomousIntelligenceLoop = lazy(() => import("./pages/blog/AutonomousIntelligenceLoop"));
const BlogEliteCorporationsAlgorithmsVsAxrlen = lazy(() => import("./pages/blog/EliteCorporationsAlgorithmsVsAxrlen"));
const FeatureZophiel = lazy(() => import("./pages/feature/FeatureZophiel"));
const FeatureZerlal = lazy(() => import("./pages/feature/FeatureZerlal"));
const FeatureAxrlen = lazy(() => import("./pages/feature/FeatureAxrlen"));
const FeatureByok = lazy(() => import("./pages/feature/FeatureByok"));
const Pricing = lazy(() => import("./pages/Pricing"));
const BlogAureonPricingExplained = lazy(() => import("./pages/blog/AureonPricingExplained"));
const BlogAiVulnerabilityScanningExplained = lazy(() => import("./pages/blog/AiVulnerabilityScanningExplained"));
const BlogVulnerabilityChainingExplained = lazy(() => import("./pages/blog/VulnerabilityChainingExplained"));
const BlogHowAiPredictiveForecastingWorks = lazy(() => import("./pages/blog/HowAiPredictiveForecastingWorks"));
const BlogHowAureonUsesCseoResearch = lazy(() => import("./pages/blog/HowAureonUsesCseoResearch"));
const BlogHowWeMakeAureonSoundHuman = lazy(() => import("./pages/blog/HowWeMakeAureonSoundHuman"));
const BlogAiStackForIndianStartups = lazy(() => import("./pages/blog/AiStackForIndianStartups"));
const BlogAsherinAgentSovereignLayer = lazy(() => import("./pages/blog/AsherinAgentSovereignLayer"));
const BlogPersonalitiesToThinkingPatterns = lazy(() => import("./pages/blog/PersonalitiesToThinkingPatterns"));
const GlossaryZeroDayConfidenceScoring = lazy(() => import("./pages/glossary/ZeroDayConfidenceScoring"));
const GlossaryPredictiveIntelligenceAi = lazy(() => import("./pages/glossary/PredictiveIntelligenceAi"));
const GlossaryOperatorStack = lazy(() => import("./pages/glossary/OperatorStack"));
const GlossaryConversationalSeo = lazy(() => import("./pages/glossary/ConversationalSeo"));

import ProtectedRoute from "./components/ProtectedRoute";
import CommandPalette from "./components/CommandPalette";
import RouteSessionTracker from "./components/RouteSessionTracker";
import AutoTripMount from "./components/AutoTripMount";
import SentinelDaemon from "./components/dashboard/SentinelDaemon";
import RouteSeo from "./components/RouteSeo";
import HumbleTypography from "./components/HumbleTypography";
// DonationBanner removed — Aureon now runs on a monthly subscription model.

const PageLoader = () => (
  <div className="flex h-screen w-full items-center justify-center bg-background">
    <div className="text-sm font-extralight tracking-[0.2em] text-muted-foreground animate-pulse">asherin</div>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A tab return must never blank a mounted surface. Focus refetches are
      // what made the chat column flash a loading state every time the
      // operator came back; data still refreshes on mount and on demand.
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

/**
 * Route-scoped recovery. A throw inside any page module used to unmount the
 * whole React root (blank/black screen); now it is contained to the routed
 * view and clears itself as soon as the pathname changes.
 */
const RouteBoundary = ({ children }: { children: React.ReactNode }) => {
  const { pathname } = useLocation();
  return (
    <RootErrorBoundary scope="route" resetKey={pathname}>
      {children}
    </RootErrorBoundary>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <StepUpProvider>
        <SubscriptionProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <CommandPalette />
              <RouteSessionTracker />
              <AutoTripMount />
              <SentinelDaemon />
              <RouteSeo />
              <HumbleTypography />
              <ByokRequiredDialog />
              {/* Donation banner removed — subscription model is now displayed on /pricing and the dashboard. */}

              <RouteBoundary>
                <Suspense fallback={<PageLoader />}>
                  <main>
                    <Routes>
                      <Route path="/" element={<Index />} />
                      {/* /auth is the sign-in surface every gated route falls back to. */}
                      <Route path="/auth" element={<Index />} />
                      <Route path="/terms" element={<TermsOfService />} />
                      <Route
                        path="/ziaassets"
                        element={
                          <ProtectedRoute>
                            <Ziaassets />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/ZIAASSETS"
                        element={
                          <ProtectedRoute>
                            <Ziaassets />
                          </ProtectedRoute>
                        }
                      />
                      <Route path="/privacy" element={<PrivacyPolicy />} />
                      <Route path="/security-policy" element={<SecurityPolicy />} />
                      <Route path="/founder" element={<Founder />} />
                      <Route path="/asher" element={<Asher />} />
                      <Route path="/forums" element={<Forums />} />
                      {/* Retired: the page scored Asherin against named third-party products
                using numbers nobody measured. Old links land on the catalog. */}
                      <Route path="/benchmark" element={<Navigate to="/software" replace />} />
                      <Route path="/software" element={<Software />} />
                      <Route path="/for" element={<ForHub />} />
                      <Route path="/for/:slug" element={<ForHub />} />
                      <Route
                        path="/whiteboard"
                        element={
                          <ProtectedRoute>
                            <WhiteboardPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route path="/blog" element={<Blog />} />
                      <Route path="/blog/paid-seat-free-door" element={<BlogPaidSeatFreeDoor />} />
                      <Route path="/blog/asher-fold-memory" element={<BlogAsherFoldMemory />} />
                      <Route path="/blog/comparison" element={<Navigate to="/software" replace />} />
                      <Route path="/blog/venice-integration" element={<BlogVeniceIntegration />} />
                      <Route
                        path="/blog/uncensored-ai-text-generator-guide"
                        element={<Navigate to="/blog" replace />}
                      />
                      <Route path="/blog/what-is-ai-osint" element={<BlogWhatIsAiOsint />} />
                      <Route path="/blog/sovereign-ai-platforms" element={<BlogSovereignAiPlatforms />} />
                      <Route path="/blog/ai-without-restrictions" element={<BlogAiWithoutRestrictions />} />
                      <Route
                        path="/blog/predictions/world-cup-2026-group-matches-0622"
                        element={<Navigate to="/blog" replace />}
                      />
                      <Route
                        path="/blog/predictions/world-cup-2026-group-matches-0623"
                        element={<Navigate to="/blog" replace />}
                      />
                      <Route
                        path="/blog/predictions/world-cup-2026-group-matches-0624"
                        element={<Navigate to="/blog" replace />}
                      />
                      <Route
                        path="/blog/predictions/world-cup-2026-group-matches-0625"
                        element={<Navigate to="/blog" replace />}
                      />
                      <Route
                        path="/blog/predictions/peru-2026-keiko-fujimori"
                        element={<Navigate to="/blog" replace />}
                      />
                      <Route
                        path="/blog/predictions/russia-ukraine-war-2026-endgame"
                        element={<Navigate to="/blog" replace />}
                      />
                      <Route
                        path="/blog/predictions/china-taiwan-2026-flashpoint"
                        element={<Navigate to="/blog" replace />}
                      />
                      <Route
                        path="/blog/predictions/israel-iran-2026-shadow-war"
                        element={<Navigate to="/blog" replace />}
                      />
                      <Route path="/blog/the-crypto-dump-october-2026" element={<Navigate to="/blog" replace />} />
                      <Route
                        path="/blog/elite-corporations-algorithms-vs-axrlen"
                        element={<BlogEliteCorporationsAlgorithmsVsAxrlen />}
                      />
                      <Route path="/blog/btc-daily-predictions" element={<Navigate to="/blog" replace />} />
                      <Route path="/blog/the-truth-and-reality-of-wars" element={<BlogTheTruthAndRealityOfWars />} />
                      <Route
                        path="/blog/zaxin-tactical-ble-intelligence"
                        element={<BlogZaxinTacticalBleIntelligence />}
                      />
                      <Route
                        path="/blog/code-narrative-quantum-collapse"
                        element={<BlogCodeNarrativeQuantumCollapse />}
                      />
                      <Route
                        path="/blog/aureon-legal-advisor-multi-jurisdictional"
                        element={<BlogAureonLegalAdvisor />}
                      />
                      <Route path="/blog/asherin-engine-deep-time" element={<BlogAsherinEngineDeepTime />} />
                      <Route path="/blog/cloud-intelligence-suite" element={<BlogCloudIntelligenceSuite />} />
                      <Route path="/blog/asherin-maps-find-my" element={<BlogAsherinMapsFindMy />} />
                      <Route path="/blog/transit-guardian" element={<BlogTransitGuardian />} />
                      <Route path="/blog/bulwark-counter-surveillance" element={<BlogBulwarkCounterSurveillance />} />
                      <Route path="/blog/autonomous-intelligence-loop" element={<BlogAutonomousIntelligenceLoop />} />
                      {/* Legacy pre-rename slugs — keep bookmarks, shared links and indexed
                results alive instead of falling through to the 404 catch-all. */}
                      <Route
                        path="/blog/asherin-legal-advisor-multi-jurisdictional"
                        element={<Navigate to="/blog/aureon-legal-advisor-multi-jurisdictional" replace />}
                      />
                      <Route
                        path="/blog/asherin-pricing-explained"
                        element={<Navigate to="/blog/aureon-pricing-explained" replace />}
                      />
                      <Route
                        path="/blog/how-asherin-uses-c-seo-research"
                        element={<Navigate to="/blog/how-aureon-uses-c-seo-research" replace />}
                      />
                      <Route
                        path="/blog/how-we-make-asherin-sound-human"
                        element={<Navigate to="/blog/how-we-make-aureon-sound-human" replace />}
                      />
                      {/* Honest-surface redirects. /features was a duplicate catalogue —
                /software is the single catalogue of record. Zophiel is not a
                public no-account engine; it lives inside the signed-in
                dashboard, so /zophiel points at the real surface. */}
                      <Route path="/features" element={<Navigate to="/software" replace />} />
                      <Route path="/zophiel" element={<Navigate to="/dashboard/search" replace />} />
                      <Route path="/search" element={<Navigate to="/dashboard/search" replace />} />
                      {/* Retired surfaces. These pages no longer exist; /software is the
                single live catalogue, so the dropped routes point there rather
                than serving a stale clone or falling into the 404 catch-all. */}
                      <Route path="/zaxin/theories" element={<Navigate to="/software" replace />} />
                      <Route path="/updates" element={<Updates />} />
                      <Route path="/investors" element={<Navigate to="/software" replace />} />
                      <Route path="/valuation" element={<Navigate to="/software" replace />} />
                      <Route path="/sources" element={<Sources />} />
                      <Route path="/asherin.gov" element={<Navigate to="/software" replace />} />
                      <Route path="/asherin-gov" element={<Navigate to="/software" replace />} />
                      {/* Gov dashboard clones were operator surfaces, not public pages —
                they are gated behind sign-in rather than shown to visitors. */}
                      <Route
                        path="/asherin.gov/dashboard"
                        element={<Navigate to="/auth?next=%2Fdashboard" replace />}
                      />
                      <Route
                        path="/asherin-gov/dashboard"
                        element={<Navigate to="/auth?next=%2Fdashboard" replace />}
                      />
                      <Route path="/asherin.gov/*" element={<Navigate to="/software" replace />} />
                      <Route path="/asherin-gov/*" element={<Navigate to="/software" replace />} />
                      <Route path="/houseofasher/theories" element={<Navigate to="/software" replace />} />
                      <Route path="/hosrad" element={<Navigate to="/software" replace />} />
                      <Route path="/symbols-of-the-bible" element={<Navigate to="/software" replace />} />
                      <Route path="/HOSRAD" element={<Navigate to="/software" replace />} />
                      <Route path="/glossary" element={<GlossaryIndex />} />
                      <Route path="/glossary/sovereign-ai" element={<GlossarySovereignAi />} />
                      <Route path="/glossary/uncensored-ai" element={<GlossaryUncensoredAi />} />
                      <Route path="/glossary/byok-ai" element={<GlossaryByokAi />} />
                      <Route path="/glossary/digital-gnostic" element={<GlossaryDigitalGnostic />} />
                      <Route path="/feature/zophiel" element={<FeatureZophiel />} />
                      <Route path="/feature/zerlal" element={<FeatureZerlal />} />
                      <Route path="/feature/axrlen" element={<FeatureAxrlen />} />
                      <Route path="/feature/byok" element={<FeatureByok />} />
                      <Route
                        path="/glossary/zero-day-confidence-scoring"
                        element={<GlossaryZeroDayConfidenceScoring />}
                      />
                      <Route
                        path="/glossary/predictive-intelligence-ai"
                        element={<GlossaryPredictiveIntelligenceAi />}
                      />
                      <Route path="/glossary/operator-stack" element={<GlossaryOperatorStack />} />
                      <Route path="/glossary/conversational-seo" element={<GlossaryConversationalSeo />} />
                      <Route path="/pricing" element={<Pricing />} />
                      <Route path="/blog/aureon-pricing-explained" element={<BlogAureonPricingExplained />} />
                      <Route
                        path="/blog/ai-vulnerability-scanning-explained"
                        element={<BlogAiVulnerabilityScanningExplained />}
                      />
                      <Route
                        path="/blog/vulnerability-chaining-explained"
                        element={<BlogVulnerabilityChainingExplained />}
                      />
                      <Route
                        path="/blog/how-ai-predictive-forecasting-works"
                        element={<BlogHowAiPredictiveForecastingWorks />}
                      />
                      <Route path="/blog/how-aureon-uses-c-seo-research" element={<BlogHowAureonUsesCseoResearch />} />
                      <Route path="/blog/how-we-make-aureon-sound-human" element={<BlogHowWeMakeAureonSoundHuman />} />
                      <Route path="/blog/ai-stack-for-indian-startups" element={<BlogAiStackForIndianStartups />} />
                      <Route
                        path="/blog/asherin-agent-sovereign-intelligence-layer"
                        element={<BlogAsherinAgentSovereignLayer />}
                      />
                      <Route
                        path="/blog/personalities-are-not-thinking-patterns"
                        element={<BlogPersonalitiesToThinkingPatterns />}
                      />
                      <Route
                        path="/blog/how-to-break-any-encryption-theory"
                        element={<Navigate to="/blog" replace />}
                      />
                      <Route
                        path="/report/:id"
                        element={
                          <ProtectedRoute>
                            <IntelligenceReport />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/asher-dashboard"
                        element={
                          <ProtectedRoute>
                            <AsherDashboard />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/internal/traffic"
                        element={
                          <ProtectedRoute>
                            <SiteTraffic />
                          </ProtectedRoute>
                        }
                      />
                      {/* Retired dashboard modules — deep links collapse onto chat. */}
                      {[
                        "nomad",
                        "cipher",
                        "plugins",
                        "video-intelligence",
                        "vibe-video",
                        "cross",
                        "bulwark",
                        "geo-audit",
                        "media2code",
                        "elion",
                        "tracker",
                        "predictive",
                        "lavba",
                        "zaplen",
                        "self-learning",
                        "self-access",
                        "imagine-intelligence",
                        "security",
                        "persona-store",
                        "stats",
                      ].map((retired) => (
                        <Route
                          key={retired}
                          path={`/dashboard/${retired}`}
                          element={<Navigate to="/dashboard" replace />}
                        />
                      ))}
                      <Route
                        path="/dashboard/:view?"
                        element={
                          <ProtectedRoute>
                            <Dashboard />
                          </ProtectedRoute>
                        }
                      />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </main>
                </Suspense>
              </RouteBoundary>
            </BrowserRouter>
          </TooltipProvider>
        </SubscriptionProvider>
      </StepUpProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
