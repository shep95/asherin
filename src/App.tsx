import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import ByokRequiredDialog from "@/components/ByokRequiredDialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { lazy, Suspense } from "react";

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

// SEO content cluster (Theories 8-14): glossary, satellites, predictions, feature spines.
const GlossaryIndex = lazy(() => import("./pages/glossary/GlossaryIndex"));
const GlossarySovereignAi = lazy(() => import("./pages/glossary/SovereignAi"));
const GlossaryUncensoredAi = lazy(() => import("./pages/glossary/UncensoredAi"));
const GlossaryByokAi = lazy(() => import("./pages/glossary/ByokAi"));
const GlossaryDigitalGnostic = lazy(() => import("./pages/glossary/DigitalGnostic"));
const BlogWhatIsAiOsint = lazy(() => import("./pages/blog/WhatIsAiOsint"));
const BlogSovereignAiPlatforms = lazy(() => import("./pages/blog/SovereignAiPlatforms"));
const BlogAiWithoutRestrictions = lazy(() => import("./pages/blog/AiWithoutRestrictions"));
const BlogPredictionAiRegulationQ42026 = lazy(
  () => import("./pages/blog/PredictionAiRegulationQ42026"),
);
const FeatureZophiel = lazy(() => import("./pages/feature/FeatureZophiel"));

import ProtectedRoute from "./components/ProtectedRoute";
import CommandPalette from "./components/CommandPalette";
import RouteSessionTracker from "./components/RouteSessionTracker";
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
          <RouteSeo />
          <ByokRequiredDialog />
          {/* Donation banner removed — subscription model is now displayed on /pricing and the dashboard. */}
          
          
          <Suspense fallback={<PageLoader />}>
          <main>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/terms" element={<TermsOfService />} />
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
            <Route
              path="/blog/predictions/ai-regulation-q4-2026"
              element={<BlogPredictionAiRegulationQ42026 />}
            />
            <Route path="/updates" element={<Updates />} />
            <Route path="/houseofasher/theories" element={<HouseOfAsherTheories />} />
            <Route path="/glossary" element={<GlossaryIndex />} />
            <Route path="/glossary/sovereign-ai" element={<GlossarySovereignAi />} />
            <Route path="/glossary/uncensored-ai" element={<GlossaryUncensoredAi />} />
            <Route path="/glossary/byok-ai" element={<GlossaryByokAi />} />
            <Route path="/glossary/digital-gnostic" element={<GlossaryDigitalGnostic />} />
            <Route path="/feature/zophiel" element={<FeatureZophiel />} />
            <Route
              path="/asher-dashboard"
              element={
                <ProtectedRoute>
                  <AsherDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/:view"
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
        </BrowserRouter>
      </TooltipProvider>
      </SubscriptionProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;