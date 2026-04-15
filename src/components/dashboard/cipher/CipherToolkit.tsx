/**
 * CIPHER Toolkit Wrapper — Adds tabs for sub-tools (Regex, JWT, Email, Phishing)
 */
import { useState, lazy, Suspense } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const CipherMain = lazy(() => import("./CipherView"));
const RegexTester = lazy(() => import("./RegexTester"));
const JwtDebugger = lazy(() => import("./JwtDebugger"));
const EmailHeaderAnalyzer = lazy(() => import("./EmailHeaderAnalyzer"));
const PhishingScanner = lazy(() => import("./PhishingScanner"));

const Loading = () => <div className="flex-1 flex items-center justify-center"><span className="text-[10px] text-muted-foreground/30">Loading...</span></div>;

const CipherToolkit = () => {
  const [tab, setTab] = useState("ops");

  return (
    <div className="h-full flex flex-col">
      <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col">
        <div className="shrink-0 border-b border-border/[0.06] px-4">
          <TabsList className="h-8 bg-transparent gap-1">
            <TabsTrigger value="ops" className="text-[9px] h-6 data-[state=active]:bg-foreground/[0.06]">Operations</TabsTrigger>
            <TabsTrigger value="regex" className="text-[9px] h-6 data-[state=active]:bg-foreground/[0.06]">Regex</TabsTrigger>
            <TabsTrigger value="jwt" className="text-[9px] h-6 data-[state=active]:bg-foreground/[0.06]">JWT</TabsTrigger>
            <TabsTrigger value="email" className="text-[9px] h-6 data-[state=active]:bg-foreground/[0.06]">Email Headers</TabsTrigger>
            <TabsTrigger value="phishing" className="text-[9px] h-6 data-[state=active]:bg-foreground/[0.06]">Phishing Scanner</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="ops" className="flex-1 mt-0 overflow-hidden">
          <Suspense fallback={<Loading />}><CipherMain /></Suspense>
        </TabsContent>
        <TabsContent value="regex" className="flex-1 mt-0 overflow-hidden">
          <Suspense fallback={<Loading />}><RegexTester /></Suspense>
        </TabsContent>
        <TabsContent value="jwt" className="flex-1 mt-0 overflow-hidden">
          <Suspense fallback={<Loading />}><JwtDebugger /></Suspense>
        </TabsContent>
        <TabsContent value="email" className="flex-1 mt-0 overflow-hidden">
          <Suspense fallback={<Loading />}><EmailHeaderAnalyzer /></Suspense>
        </TabsContent>
        <TabsContent value="phishing" className="flex-1 mt-0 overflow-hidden">
          <Suspense fallback={<Loading />}><PhishingScanner /></Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CipherToolkit;
