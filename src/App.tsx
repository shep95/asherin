import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import ByokRequiredDialog from "@/components/ByokRequiredDialog";
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
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));

const FeatureZophiel = lazy(() => import("./pages/FeatureZophiel"));
const FeatureNomad = lazy(() => import("./pages/FeatureNomad"));
const FeatureNomadCyber = lazy(() => import("./pages/FeatureNomadCyber"));
const FeatureAzplen = lazy(() => import("./pages/FeatureAzplen"));
const FeatureBriefings = lazy(() => import("./pages/FeatureBriefings"));
const FeaturePersonas = lazy(() => import("./pages/FeaturePersonas"));
const FeatureZali = lazy(() => import("./pages/FeatureZali"));
const FeatureZahten = lazy(() => import("./pages/FeatureZahten"));
const FeaturePredictive = lazy(() => import("./pages/FeaturePredictive"));

const FeatureImagineToCode = lazy(() => import("./pages/FeatureImagineToCode"));
const FeatureIde = lazy(() => import("./pages/FeatureIde"));
const FeatureImagineIntelligence = lazy(() => import("./pages/FeatureOracleLocus"));
const LLMModels = lazy(() => import("./pages/LLMModels"));
const FeatureNotebooks = lazy(() => import("./pages/FeatureNotebooks"));
const FeatureVibeImager = lazy(() => import("./pages/FeatureVibeImager"));
const FeatureVibeVideo = lazy(() => import("./pages/FeatureVibeVideo"));
const FeatureVideoIntelligence = lazy(() => import("./pages/FeatureVideoIntelligence"));
const FeatureBYOK = lazy(() => import("./pages/FeatureBYOK"));
const FeatureZerlal = lazy(() => import("./pages/FeatureZerlal"));
const FeatureZeeion = lazy(() => import("./pages/FeatureZeeion"));
const FeatureAziion = lazy(() => import("./pages/FeatureAziion"));
const FeatureAxrlen = lazy(() => import("./pages/FeatureAxrlen"));
const FeatureCross = lazy(() => import("./pages/FeatureCross"));

const FeatureZaplen = lazy(() => import("./pages/FeatureZaplen"));
const FeatureCipher = lazy(() => import("./pages/FeatureCipher"));
const FeaturePatternAnalysis = lazy(() => import("./pages/FeaturePatternAnalysis"));
const FeatureReverseEngineer = lazy(() => import("./pages/FeatureReverseEngineer"));
const FeatureFileScrapper = lazy(() => import("./pages/FeatureFileScrapper"));
const FeatureEbook = lazy(() => import("./pages/FeatureEbook"));
const FeaturePluginMarketplace = lazy(() => import("./pages/FeaturePluginMarketplace"));
const FeatureCodingLaws = lazy(() => import("./pages/FeatureCodingLaws"));
const FeatureAutomatedAgents = lazy(() => import("./pages/FeatureAutomatedAgents"));
const FeatureMemoryCenter = lazy(() => import("./pages/FeatureMemoryCenter"));
const FeatureBrains = lazy(() => import("./pages/FeatureBrains"));
const FeatureLibrary = lazy(() => import("./pages/FeatureLibrary"));
const FeatureWhiteboardPage = lazy(() => import("./pages/FeatureWhiteboard"));
const FeatureVedic = lazy(() => import("./pages/FeatureVedic"));
const VedicAstrology = lazy(() => import("./pages/VedicAstrology"));
const ZophielFree = lazy(() => import("./pages/ZophielFree"));
const AxrlenFree = lazy(() => import("./pages/AxrlenFree"));
const WW3 = lazy(() => import("./pages/WW3"));
const HouseOfAsherVentures = lazy(() => import("./pages/HouseOfAsherVentures"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const TrackPage = lazy(() => import("./pages/TrackPage"));
const ProjAureon = lazy(() => import("./pages/ProjAureon"));
const Whiteboard = lazy(() => import("./pages/Whiteboard"));
const EliteSuite = lazy(() => import("./pages/EliteSuite"));
const Asher = lazy(() => import("./pages/Asher"));
const AsherDashboard = lazy(() => import("./pages/AsherDashboard"));
const Forums = lazy(() => import("./pages/Forums"));
const AvaPicks = lazy(() => import("./pages/AvaPicks"));
const OpenVpn = lazy(() => import("./pages/OpenVpn"));
const Analytics = lazy(() => import("./pages/Analytics"));
import ProtectedRoute from "./components/ProtectedRoute";
import CommandPalette from "./components/CommandPalette";
import AureonDomainGate from "./components/AureonDomainGate";
import RouteSessionTracker from "./components/RouteSessionTracker";
import RouteSeo from "./components/RouteSeo";
import AureonEngineToggle from "./components/AureonEngineToggle";
import DonationBanner from "./components/DonationBanner";

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
          <DonationBanner />
          
          
          <Suspense fallback={<PageLoader />}>
          <main>
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
            <Route path="/feature/zophiel" element={<FeatureZophiel />} />
            <Route path="/feature/nomad" element={<FeatureNomad />} />
            <Route path="/feature/nomad-cyber" element={<FeatureNomadCyber />} />
            <Route path="/feature/azplen" element={<FeatureAzplen />} />
            <Route path="/feature/briefings" element={<FeatureBriefings />} />
            <Route path="/feature/personas" element={<FeaturePersonas />} />
            <Route path="/feature/zali" element={<FeatureZali />} />
            <Route path="/feature/zahten" element={<FeatureZahten />} />
            <Route path="/feature/predictive" element={<FeaturePredictive />} />
            
            <Route path="/feature/imagine-to-code" element={<FeatureImagineToCode />} />
            <Route path="/feature/ide" element={<FeatureIde />} />
            <Route path="/feature/imagine-intelligence" element={<FeatureImagineIntelligence />} />
            <Route path="/llm-models" element={<LLMModels />} />
            <Route path="/feature/notebooks" element={<FeatureNotebooks />} />
            <Route path="/feature/vibe-imager" element={<FeatureVibeImager />} />
            <Route path="/feature/vibe-video" element={<FeatureVibeVideo />} />
            <Route path="/feature/video-intelligence" element={<FeatureVideoIntelligence />} />
            <Route path="/feature/byok" element={<FeatureBYOK />} />
            <Route path="/feature/zerlal" element={<FeatureZerlal />} />
            <Route path="/feature/zeeion" element={<FeatureZeeion />} />
            <Route path="/feature/aziion" element={<FeatureAziion />} />
            <Route path="/feature/axrlen" element={<FeatureAxrlen />} />
            <Route path="/feature/cross" element={<FeatureCross />} />
            
            <Route path="/feature/zaplen" element={<FeatureZaplen />} />
            <Route path="/feature/cipher" element={<FeatureCipher />} />
            <Route path="/feature/pattern-analysis" element={<FeaturePatternAnalysis />} />
            <Route path="/feature/reverse-engineer" element={<FeatureReverseEngineer />} />
            <Route path="/feature/file-scrapper" element={<FeatureFileScrapper />} />
            <Route path="/feature/ebook" element={<FeatureEbook />} />
            <Route path="/feature/plugin-marketplace" element={<FeaturePluginMarketplace />} />
            <Route path="/feature/coding-laws" element={<FeatureCodingLaws />} />
            <Route path="/feature/automated-agents" element={<FeatureAutomatedAgents />} />
            <Route path="/feature/memory-center" element={<FeatureMemoryCenter />} />
            <Route path="/feature/brains" element={<FeatureBrains />} />
            <Route path="/feature/library" element={<FeatureLibrary />} />
            <Route path="/feature/whiteboard-info" element={<FeatureWhiteboardPage />} />
            <Route path="/feature/vedic" element={<FeatureVedic />} />
            <Route path="/vedic-astrology" element={<VedicAstrology />} />
            <Route path="/vedic" element={<VedicAstrology />} />
            <Route path="/zophiel" element={<ZophielFree />} />
            <Route path="/search" element={<ZophielFree />} />
            <Route path="/axrlen" element={<AxrlenFree />} />
            <Route path="/i" element={<TrackPage />} />
            <Route path="/ww3" element={<WW3 />} />
            <Route path="/houseofasher-ventures" element={<HouseOfAsherVentures />} />
            <Route path="/proj-aureon" element={<ProjAureon />} />
            <Route path="/whiteboard" element={<Whiteboard />} />
            <Route path="/elite" element={<ProtectedRoute><EliteSuite /></ProtectedRoute>} />
            <Route path="/asher" element={<Asher />} />
            <Route path="/forums" element={<Forums />} />
            <Route path="/avapicks" element={<AvaPicks />} />
            <Route path="/openvpn" element={<OpenVpn />} />
            <Route path="/asher-dashboard" element={<ProtectedRoute><AsherDashboard /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
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
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="/unsubscribe" element={<Unsubscribe />} />
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
