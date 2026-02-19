import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import Index from "./pages/Index";
import Pricing from "./pages/Pricing";
import NotFound from "./pages/NotFound";
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Founder from "./pages/Founder";
import PromptEngineering from "./pages/PromptEngineering";
import Features from "./pages/Features";
import Benchmarks from "./pages/Benchmarks";
import NDA from "./pages/NDA";
import EquityOwnership from "./pages/EquityOwnership";
import FeatureZophiel from "./pages/FeatureZophiel";
import FeatureNomad from "./pages/FeatureNomad";
import FeatureAsha from "./pages/FeatureAsha";
import FeatureBriefings from "./pages/FeatureBriefings";
import FeaturePersonas from "./pages/FeaturePersonas";
import FeatureZali from "./pages/FeatureZali";
import FeaturePredictive from "./pages/FeaturePredictive";
import FeatureElion from "./pages/FeatureElion";
import Dashboard from "./pages/Dashboard";
import ProtectedRoute from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <SubscriptionProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
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
        </BrowserRouter>
      </TooltipProvider>
      </SubscriptionProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
