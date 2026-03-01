import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { lazy, Suspense } from "react";

// [Finding #9] Route-based code splitting for performance
const Index = lazy(() => import("./pages/Index"));
const Pricing = lazy(() => import("./pages/Pricing"));
const NotFound = lazy(() => import("./pages/NotFound"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const Founder = lazy(() => import("./pages/Founder"));
const PromptEngineering = lazy(() => import("./pages/PromptEngineering"));
const Features = lazy(() => import("./pages/Features"));
const Benchmarks = lazy(() => import("./pages/Benchmarks"));
const NDA = lazy(() => import("./pages/NDA"));
const EquityOwnership = lazy(() => import("./pages/EquityOwnership"));
const FeatureZophiel = lazy(() => import("./pages/FeatureZophiel"));
const FeatureNomad = lazy(() => import("./pages/FeatureNomad"));
const FeatureAsha = lazy(() => import("./pages/FeatureAsha"));
const FeatureBriefings = lazy(() => import("./pages/FeatureBriefings"));
const FeaturePersonas = lazy(() => import("./pages/FeaturePersonas"));
const FeatureZali = lazy(() => import("./pages/FeatureZali"));
const FeaturePredictive = lazy(() => import("./pages/FeaturePredictive"));
const FeatureElion = lazy(() => import("./pages/FeatureElion"));
const FeatureTracker = lazy(() => import("./pages/FeatureTracker"));
const FeatureImagineToCode = lazy(() => import("./pages/FeatureImagineToCode"));
const FeatureIde = lazy(() => import("./pages/FeatureIde"));
const FeatureImagineIntelligence = lazy(() => import("./pages/FeatureOracleLocus"));
const FeatureGoogleIntelligence = lazy(() => import("./pages/FeatureGoogleIntelligence"));
const FeatureSecurity = lazy(() => import("./pages/FeatureSecurity"));
const FeatureNotebooks = lazy(() => import("./pages/FeatureNotebooks"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const TrackPage = lazy(() => import("./pages/TrackPage"));
const ProjAureon = lazy(() => import("./pages/ProjAureon"));
import ProtectedRoute from "./components/ProtectedRoute";

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
          <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/founder" element={<Founder />} />
            <Route path="/prompt-engineering" element={<PromptEngineering />} />
            <Route path="/features" element={<Features />} />
            <Route path="/benchmarks" element={<Benchmarks />} />
            <Route path="/nda" element={<NDA />} />
            <Route path="/equity" element={<EquityOwnership />} />
            <Route path="/feature/zophiel" element={<FeatureZophiel />} />
            <Route path="/feature/nomad" element={<FeatureNomad />} />
            <Route path="/feature/asha" element={<FeatureAsha />} />
            <Route path="/feature/briefings" element={<FeatureBriefings />} />
            <Route path="/feature/personas" element={<FeaturePersonas />} />
            <Route path="/feature/zali" element={<FeatureZali />} />
            <Route path="/feature/predictive" element={<FeaturePredictive />} />
            <Route path="/feature/elion" element={<FeatureElion />} />
            <Route path="/feature/tracker" element={<FeatureTracker />} />
            <Route path="/feature/imagine-to-code" element={<FeatureImagineToCode />} />
            <Route path="/feature/ide" element={<FeatureIde />} />
            <Route path="/feature/imagine-intelligence" element={<FeatureImagineIntelligence />} />
            <Route path="/feature/google-intelligence" element={<FeatureGoogleIntelligence />} />
            <Route path="/feature/security" element={<FeatureSecurity />} />
            <Route path="/feature/notebooks" element={<FeatureNotebooks />} />
            <Route path="/i" element={<TrackPage />} />
            <Route path="/proj-aureon" element={<ProjAureon />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
      </SubscriptionProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
