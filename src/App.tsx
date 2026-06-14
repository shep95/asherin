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
const Blog = lazy(() => import("./pages/Blog"));

import ProtectedRoute from "./components/ProtectedRoute";
import CommandPalette from "./components/CommandPalette";
import RouteSessionTracker from "./components/RouteSessionTracker";
import RouteSeo from "./components/RouteSeo";
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