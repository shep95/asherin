import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import ByokRequiredDialog from "@/components/ByokRequiredDialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import React, { Suspense } from "react";
import RootErrorBoundary from "@/components/RootErrorBoundary";
import { lazyWithRetry as lazy } from "@/lib/lazyWithRetry";

const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const Founder = lazy(() => import("./pages/Founder"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Asher = lazy(() => import("./pages/Asher"));
const AsherDashboard = lazy(() => import("./pages/AsherDashboard"));
const Forums = lazy(() => import("./pages/Forums"));
const Benchmark = lazy(() => import("./pages/Benchmark"));
const Software = lazy(() => import("./pages/Software"));
const WhiteboardPage = lazy(() => import("./pages/WhiteboardPage"));
const BlogComparison = lazy(() => import("./pages/BlogComparison"));
const BlogVeniceIntegration = lazy(() => import("./pages/BlogVeniceIntegration"));
const BlogUncensoredAi = lazy(() => import("./pages/BlogUncensoredAi"));
const Blog = lazy(() => import("./pages/Blog"));
const Updates = lazy(() => import("./pages/Updates"));
const HouseOfAsherTheories = lazy(() => import("./pages/HouseOfAsherTheories"));
const Hosrad = lazy(() => import("./pages/Hosrad"));
const Investors = lazy(() => import("./pages/Investors"));
const Valuation = lazy(() => import("./pages/Valuation"));
const Sources = lazy(() => import("./pages/Sources"));
const Ziaassets = lazy(() => import("./pages/Ziaassets"));
const AsherinGov = lazy(() => import("./pages/AsherinGov"));
const AsherinGovDashboard = lazy(() => import("./pages/AsherinGovDashboard"));
const SymbolsOfTheBible = lazy(() => import("./pages/SymbolsOfTheBible"));
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
const BlogPredictionWorldCup2026GroupMatches0622 = lazy(() => import("./pages/blog/PredictionWorldCup2026GroupMatches0622"));
const BlogPredictionWorldCup2026GroupMatches0623 = lazy(() => import("./pages/blog/PredictionWorldCup2026GroupMatches0623"));
const BlogPredictionWorldCup2026GroupMatches0624 = lazy(() => import("./pages/blog/PredictionWorldCup2026GroupMatches0624"));
const BlogPredictionWorldCup2026GroupMatches0625 = lazy(() => import("./pages/blog/PredictionWorldCup2026GroupMatches0625"));
const BlogPredictionPeru2026KeikoFujimori = lazy(() => import("./pages/blog/PredictionPeru2026KeikoFujimori"));
const BlogPredictionRussiaUkraineWar2026Endgame = lazy(() => import("./pages/blog/PredictionRussiaUkraineWar2026Endgame"));
const BlogPredictionChinaTaiwan2026Flashpoint = lazy(() => import("./pages/blog/PredictionChinaTaiwan2026Flashpoint"));
const BlogPredictionIsraelIran2026ShadowWar = lazy(() => import("./pages/blog/PredictionIsraelIran2026ShadowWar"));
const BlogTheCryptoDumpOctober2026 = lazy(() => import("./pages/blog/TheCryptoDumpOctober2026"));
const BlogPredictionBtcDaily = lazy(() => import("./pages/blog/PredictionBtcDaily"));
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
const ZaxinTheories = lazy(() => import("./pages/zaxin/ZaxinTheories"));
const BlogEliteCorporationsAlgorithmsVsAxrlen = lazy(() => import("./pages/blog/EliteCorporationsAlgorithmsVsAxrlen"));
const FeatureZophiel = lazy(() => import("./pages/feature/FeatureZophiel"));
const FeatureZerlal = lazy(() => import("./pages/feature/FeatureZerlal"));
const FeatureAxrlen = lazy(() => import("./pages/feature/FeatureAxrlen"));
const FeatureByok = lazy(() => import("./pages/feature/FeatureByok"));
const Pricing = lazy(() => import("./pages/Pricing"));
const BlogAureonPricingExplained = lazy(() => import("./pages/blog/AureonPricingExplained"));
const BlogAiVulnerabilityScanningExplained = lazy(
  () => import("./pages/blog/AiVulnerabilityScanningExplained"),
);
const BlogVulnerabilityChainingExplained = lazy(
  () => import("./pages/blog/VulnerabilityChainingExplained"),
);
const BlogHowAiPredictiveForecastingWorks = lazy(
  () => import("./pages/blog/HowAiPredictiveForecastingWorks"),
);
const BlogHowAureonUsesCseoResearch = lazy(
  () => import("./pages/blog/HowAureonUsesCseoResearch"),
);
const BlogHowWeMakeAureonSoundHuman = lazy(
  () => import("./pages/blog/HowWeMakeAureonSoundHuman"),
);
const BlogHowToBreakAnyEncryptionTheory = lazy(
  () => import("./pages/blog/HowToBreakAnyEncryptionTheory"),
);
const GlossaryZeroDayConfidenceScoring = lazy(
  () => import("./pages/glossary/ZeroDayConfidenceScoring"),
);
const GlossaryPredictiveIntelligenceAi = lazy(
  () => import("./pages/glossary/PredictiveIntelligenceAi"),
);
const GlossaryOperatorStack = lazy(() => import("./pages/glossary/OperatorStack"));
const GlossaryConversationalSeo = lazy(() => import("./pages/glossary/ConversationalSeo"));

import ProtectedRoute from "./components/ProtectedRoute";
import CommandPalette from "./components/CommandPalette";
import RouteSessionTracker from "./components/RouteSessionTracker";
import AutoTripMount from "./components/AutoTripMount";
import SentinelDaemon from "./components/dashboard/SentinelDaemon";
import RouteSeo from "./components/RouteSeo";
// DonationBanner removed — Aureon now runs on a monthly subscription model.

const PageLoader = () => (
  <div className="flex h-screen w-full items-center justify-center bg-background">
    <div className="text-sm font-extralight tracking-[0.2em] text-muted-foreground animate-pulse">
      AUREON
    </div>
  </div>
);

const queryClient = new QueryClient();

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
          <ByokRequiredDialog />
          {/* Donation banner removed — subscription model is now displayed on /pricing and the dashboard. */}
          
          
          <RouteBoundary>
          <Suspense fallback={<PageLoader />}>
          <main>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/ziaassets" element={<Ziaassets />} />
            <Route path="/ZIAASSETS" element={<Ziaassets />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/founder" element={<Founder />} />
            <Route path="/asher" element={<Asher />} />
            <Route path="/forums" element={<Forums />} />
            <Route path="/benchmark" element={<Benchmark />} />
            <Route path="/software" element={<Software />} />
            <Route path="/whiteboard" element={<WhiteboardPage />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/comparison" element={<BlogComparison />} />
            <Route path="/blog/venice-integration" element={<BlogVeniceIntegration />} />
            <Route path="/blog/uncensored-ai-text-generator-guide" element={<BlogUncensoredAi />} />
            <Route path="/blog/what-is-ai-osint" element={<BlogWhatIsAiOsint />} />
            <Route path="/blog/sovereign-ai-platforms" element={<BlogSovereignAiPlatforms />} />
            <Route path="/blog/ai-without-restrictions" element={<BlogAiWithoutRestrictions />} />
            <Route path="/blog/predictions/world-cup-2026-group-matches-0622" element={<BlogPredictionWorldCup2026GroupMatches0622 />} />
            <Route path="/blog/predictions/world-cup-2026-group-matches-0623" element={<BlogPredictionWorldCup2026GroupMatches0623 />} />
            <Route path="/blog/predictions/world-cup-2026-group-matches-0624" element={<BlogPredictionWorldCup2026GroupMatches0624 />} />
            <Route path="/blog/predictions/world-cup-2026-group-matches-0625" element={<BlogPredictionWorldCup2026GroupMatches0625 />} />
            <Route path="/blog/predictions/peru-2026-keiko-fujimori" element={<BlogPredictionPeru2026KeikoFujimori />} />
            <Route path="/blog/predictions/russia-ukraine-war-2026-endgame" element={<BlogPredictionRussiaUkraineWar2026Endgame />} />
            <Route path="/blog/predictions/china-taiwan-2026-flashpoint" element={<BlogPredictionChinaTaiwan2026Flashpoint />} />
            <Route path="/blog/predictions/israel-iran-2026-shadow-war" element={<BlogPredictionIsraelIran2026ShadowWar />} />
            <Route path="/blog/the-crypto-dump-october-2026" element={<BlogTheCryptoDumpOctober2026 />} />
            <Route path="/blog/elite-corporations-algorithms-vs-axrlen" element={<BlogEliteCorporationsAlgorithmsVsAxrlen />} />
            <Route path="/blog/btc-daily-predictions" element={<BlogPredictionBtcDaily />} />
            <Route path="/blog/the-truth-and-reality-of-wars" element={<BlogTheTruthAndRealityOfWars />} />
            <Route path="/blog/zaxin-tactical-ble-intelligence" element={<BlogZaxinTacticalBleIntelligence />} />
            <Route path="/blog/code-narrative-quantum-collapse" element={<BlogCodeNarrativeQuantumCollapse />} />
            <Route path="/blog/aureon-legal-advisor-multi-jurisdictional" element={<BlogAureonLegalAdvisor />} />
            <Route path="/blog/asherin-engine-deep-time" element={<BlogAsherinEngineDeepTime />} />
            <Route path="/blog/cloud-intelligence-suite" element={<BlogCloudIntelligenceSuite />} />
            <Route path="/blog/asherin-maps-find-my" element={<BlogAsherinMapsFindMy />} />
            <Route path="/blog/transit-guardian" element={<BlogTransitGuardian />} />
            <Route path="/blog/bulwark-counter-surveillance" element={<BlogBulwarkCounterSurveillance />} />
            <Route path="/blog/autonomous-intelligence-loop" element={<BlogAutonomousIntelligenceLoop />} />
            {/* Legacy pre-rename slugs — keep bookmarks, shared links and indexed
                results alive instead of falling through to the 404 catch-all. */}
            <Route path="/blog/asherin-legal-advisor-multi-jurisdictional" element={<Navigate to="/blog/aureon-legal-advisor-multi-jurisdictional" replace />} />
            <Route path="/blog/asherin-pricing-explained" element={<Navigate to="/blog/aureon-pricing-explained" replace />} />
            <Route path="/blog/how-asherin-uses-c-seo-research" element={<Navigate to="/blog/how-aureon-uses-c-seo-research" replace />} />
            <Route path="/blog/how-we-make-asherin-sound-human" element={<Navigate to="/blog/how-we-make-aureon-sound-human" replace />} />
            <Route path="/zaxin/theories" element={<ZaxinTheories />} />
            <Route path="/updates" element={<Updates />} />
            <Route path="/investors" element={<Investors />} />
            <Route path="/valuation" element={<Valuation />} />
            <Route path="/sources" element={<Sources />} />
            <Route path="/asherin.gov" element={<AsherinGov />} />
            <Route path="/asherin-gov" element={<AsherinGov />} />
            <Route path="/asherin.gov/dashboard" element={<AsherinGovDashboard />} />
            <Route path="/asherin-gov/dashboard" element={<AsherinGovDashboard />} />


            <Route path="/houseofasher/theories" element={<HouseOfAsherTheories />} />
            <Route path="/hosrad" element={<Hosrad />} />
            <Route path="/symbols-of-the-bible" element={<SymbolsOfTheBible />} />
            <Route path="/HOSRAD" element={<Hosrad />} />
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
            <Route
              path="/blog/how-aureon-uses-c-seo-research"
              element={<BlogHowAureonUsesCseoResearch />}
            />
            <Route
              path="/blog/how-we-make-aureon-sound-human"
              element={<BlogHowWeMakeAureonSoundHuman />}
            />
            <Route
              path="/blog/how-to-break-any-encryption-theory"
              element={<BlogHowToBreakAnyEncryptionTheory />}
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
    </AuthProvider>
  </QueryClientProvider>
);

export default App;