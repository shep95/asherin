import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders } from "../_shared/cors.ts";
// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts

const ADMIN_EMAIL = "ashernewtonx@gmail.com";
const ADMIN_EMAILS: ReadonlySet<string> = new Set(["ashernewtonx@gmail.com","28numberofmoney@gmail.com"]);
const isAuthorizedAdminEmail = (e?: string | null): boolean => !!e && ADMIN_EMAILS.has(String(e).toLowerCase());
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY_APP");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GITHUB_API = "https://api.github.com";

// Fetch live file content from GitHub — ensures analysis always uses latest code
async function fetchFileFromGitHub(path: string, token: string, owner: string, repo: string, branch: string): Promise<string | null> {
  try {
    const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.content) return null;
    return atob(data.content);
  } catch {
    return null;
  }
}

// Complete codebase manifest — every file domain-mapped for autonomous analysis
const CODEBASE_FILES = [
  // ── Frontend: Pages ──
  { path: "src/App.tsx", domain: "Frontend", desc: "Root app with routing" },
  { path: "src/pages/Dashboard.tsx", domain: "Frontend", desc: "Main dashboard orchestrator with 30+ views" },
  { path: "src/pages/Index.tsx", domain: "Frontend", desc: "Landing page" },
  { path: "src/pages/Pricing.tsx", domain: "Frontend", desc: "Pricing tiers page" },
  { path: "src/pages/Features.tsx", domain: "Frontend", desc: "Feature showcase page" },
  { path: "src/pages/Founder.tsx", domain: "Frontend", desc: "Founder profile page" },
  { path: "src/pages/Benchmarks.tsx", domain: "Frontend", desc: "Performance benchmarks" },
  { path: "src/pages/FeatureAzplen.tsx", domain: "Frontend", desc: "Azplen marketing page" },
  
  { path: "src/pages/FeatureIde.tsx", domain: "Frontend", desc: "IDE marketing page" },
  { path: "src/pages/FeatureNomad.tsx", domain: "Frontend", desc: "Nomad marketing page" },
  { path: "src/pages/FeatureZali.tsx", domain: "Frontend", desc: "Zali marketing page" },
  { path: "src/pages/FeatureZophiel.tsx", domain: "Frontend", desc: "Zophiel marketing page" },
  { path: "src/pages/FeaturePersonas.tsx", domain: "Frontend", desc: "Personas marketing page" },
  { path: "src/pages/FeaturePredictive.tsx", domain: "Frontend", desc: "Predictive intel marketing page" },
  { path: "src/pages/FeatureTracker.tsx", domain: "Frontend", desc: "Tracker marketing page" },
  { path: "src/pages/FeatureBriefings.tsx", domain: "Frontend", desc: "Briefings marketing page" },
  { path: "src/pages/FeatureImagineToCode.tsx", domain: "Frontend", desc: "Imagine-to-code marketing page" },
  { path: "src/pages/EquityOwnership.tsx", domain: "Frontend", desc: "Equity ownership page" },
  { path: "src/pages/NDA.tsx", domain: "Frontend", desc: "NDA page" },
  { path: "src/pages/PromptEngineering.tsx", domain: "Frontend", desc: "Prompt engineering page" },
  { path: "src/pages/ProjAureon.tsx", domain: "Frontend", desc: "Project Aureon page" },
  { path: "src/pages/TrackPage.tsx", domain: "Frontend", desc: "Track page" },
  { path: "src/pages/PrivacyPolicy.tsx", domain: "Frontend", desc: "Privacy policy" },
  { path: "src/pages/TermsOfService.tsx", domain: "Frontend", desc: "Terms of service" },
  { path: "src/pages/NotFound.tsx", domain: "Frontend", desc: "404 page" },
  // ── Frontend: Dashboard Components ──
  { path: "src/components/dashboard/ChatView.tsx", domain: "Frontend", desc: "Main chat interface with E2E encryption" },
  { path: "src/components/dashboard/DashboardSidebar.tsx", domain: "Frontend", desc: "Sidebar nav with access control" },
  { path: "src/components/dashboard/AdaptiveInputBar.tsx", domain: "Frontend", desc: "Adaptive input bar with attachments" },
  { path: "src/components/dashboard/BriefingView.tsx", domain: "Frontend", desc: "Intelligence briefings dashboard" },
  { path: "src/components/dashboard/CalibrationFeedback.tsx", domain: "Frontend", desc: "AI calibration feedback system" },
  { path: "src/components/dashboard/ChainOfThoughtPanel.tsx", domain: "Frontend", desc: "Show Work reasoning panel" },
  { path: "src/components/dashboard/CodeSnippetsView.tsx", domain: "Frontend", desc: "Code snippets library" },
  { path: "src/components/dashboard/CommandPalette.tsx", domain: "Frontend", desc: "CMD+K command palette" },
  { path: "src/components/dashboard/DecodeView.tsx", domain: "Frontend", desc: "Decode deep analysis view" },
  { path: "src/components/dashboard/DepthSelector.tsx", domain: "Frontend", desc: "Response depth selector" },
  { path: "src/components/dashboard/FocusMode.tsx", domain: "Frontend", desc: "Distraction-free focus mode" },
  { path: "src/components/dashboard/FollowUpSuggestions.tsx", domain: "Frontend", desc: "AI follow-up suggestions" },
  { path: "src/components/dashboard/GeospatialView.tsx", domain: "Data", desc: "Geospatial visualization" },
  { path: "src/components/dashboard/ImagineToCodeView.tsx", domain: "Frontend", desc: "Pixel art to code generator" },
  { path: "src/components/dashboard/LibraryView.tsx", domain: "Frontend", desc: "File library manager" },
  { path: "src/components/dashboard/MemoryCenterView.tsx", domain: "Frontend", desc: "Memory center UI" },
  { path: "src/components/dashboard/ModeSelector.tsx", domain: "Frontend", desc: "Chat mode selector" },
  { path: "src/components/dashboard/NotebooksView.tsx", domain: "Frontend", desc: "Intelligence notebooks" },
  { path: "src/components/dashboard/NotificationInbox.tsx", domain: "Frontend", desc: "Notification inbox" },
  { path: "src/components/dashboard/OracleLocusView.tsx", domain: "Intelligence", desc: "Oracle Locus prediction view" },
  { path: "src/components/dashboard/PatternAnalysisView.tsx", domain: "Data", desc: "Pattern analysis dashboard" },
  { path: "src/components/dashboard/PdfGeneratorView.tsx", domain: "Frontend", desc: "PDF generator" },
  { path: "src/components/dashboard/PersonaStoreView.tsx", domain: "Frontend", desc: "Persona marketplace" },
  { path: "src/components/dashboard/PluginMarketplaceView.tsx", domain: "Frontend", desc: "Plugin marketplace" },
  { path: "src/components/dashboard/PredictiveIntelligenceView.tsx", domain: "Intelligence", desc: "Predictive intelligence dashboard" },
  { path: "src/components/dashboard/ProjectsView.tsx", domain: "Frontend", desc: "Projects manager" },
  { path: "src/components/dashboard/SecurityDashboardView.tsx", domain: "Security", desc: "8-system security command center" },
  { path: "src/components/dashboard/SelfAccessLearningView.tsx", domain: "AI/ML", desc: "Self-access autonomous learning" },
  { path: "src/components/dashboard/SelfLearningLoopView.tsx", domain: "AI/ML", desc: "Self-learning loop with brains" },
  { path: "src/components/dashboard/SettingsView.tsx", domain: "Frontend", desc: "User settings panel" },
  { path: "src/components/dashboard/SlideshowGeneratorView.tsx", domain: "Frontend", desc: "Slideshow generator" },
  { path: "src/components/dashboard/StatsView.tsx", domain: "Frontend", desc: "Usage statistics" },
  { path: "src/components/dashboard/SubscriptionView.tsx", domain: "Frontend", desc: "Subscription management" },
  { path: "src/components/dashboard/TeamsView.tsx", domain: "Frontend", desc: "Team collaboration" },
  { path: "src/components/dashboard/TimeSeriesView.tsx", domain: "Data", desc: "Time series analysis" },
  { path: "src/components/dashboard/TrackerView.tsx", domain: "Frontend", desc: "Smart tracker" },
  { path: "src/components/dashboard/ZophielEngineView.tsx", domain: "Intelligence", desc: "Zophiel deep search engine" },
  // ── Azplen Data Intelligence ──
  { path: "src/components/dashboard/azplen/AzplenView.tsx", domain: "Data", desc: "Azplen data intelligence hub" },
  { path: "src/components/dashboard/azplen/AzplenSessionContext.tsx", domain: "Data", desc: "Azplen session state management" },
  { path: "src/components/dashboard/azplen/QueryBar.tsx", domain: "Data", desc: "Azplen query bar with AI chat" },
  { path: "src/components/dashboard/azplen/IngestPanel.tsx", domain: "Data", desc: "Data ingestion pipeline" },
  { path: "src/components/dashboard/azplen/FilesPanel.tsx", domain: "Data", desc: "Hierarchical file management" },
  { path: "src/components/dashboard/azplen/DataTablePanel.tsx", domain: "Data", desc: "Data table visualization" },
  { path: "src/components/dashboard/azplen/InsightsPanel.tsx", domain: "Data", desc: "AI-generated insights" },
  { path: "src/components/dashboard/azplen/EntitiesPanel.tsx", domain: "Data", desc: "Entity extraction panel" },
  { path: "src/components/dashboard/azplen/EntityResolutionPanel.tsx", domain: "Data", desc: "Entity resolution matching" },
  { path: "src/components/dashboard/azplen/GraphViewPanel.tsx", domain: "Data", desc: "Graph visualization" },
  { path: "src/components/dashboard/azplen/ReportsPanel.tsx", domain: "Data", desc: "Report generation" },
  { path: "src/components/dashboard/azplen/WorkflowPanel.tsx", domain: "Data", desc: "Workflow automation" },
  { path: "src/components/dashboard/azplen/MonitoringPanel.tsx", domain: "Data", desc: "Data health monitoring" },
  { path: "src/components/dashboard/azplen/PredictionsPanel.tsx", domain: "Data", desc: "Azplen predictions" },
  { path: "src/components/dashboard/azplen/ScenarioSimulatorPanel.tsx", domain: "Data", desc: "Scenario simulation" },
  { path: "src/components/dashboard/azplen/ThreatModelingPanel.tsx", domain: "Data", desc: "Threat modeling engine" },
  { path: "src/components/dashboard/azplen/WebIntelligencePanel.tsx", domain: "Data", desc: "Web intelligence scraping" },
  { path: "src/components/dashboard/azplen/DocumentIntelligencePanel.tsx", domain: "Data", desc: "Document intelligence OCR" },
  { path: "src/components/dashboard/azplen/DataLineagePanel.tsx", domain: "Data", desc: "Data lineage tracking" },
  { path: "src/components/dashboard/azplen/BranchPanel.tsx", domain: "Data", desc: "Data version branching" },
  { path: "src/components/dashboard/azplen/CatalogPanel.tsx", domain: "Data", desc: "Data catalog" },
  { path: "src/components/dashboard/azplen/DashboardBuilderPanel.tsx", domain: "Data", desc: "Custom dashboard builder" },
  // ── ZALI Engineering Design ──
  { path: "src/components/dashboard/zali/ZaliView.tsx", domain: "Design", desc: "ZALI engineering design lab" },
  { path: "src/components/dashboard/zali/ZaliWorkspace.tsx", domain: "Design", desc: "ZALI 3D workspace" },
  { path: "src/components/dashboard/zali/ZaliChatPanel.tsx", domain: "Design", desc: "ZALI AI chat" },
  { path: "src/components/dashboard/zali/Zali3DModel.tsx", domain: "Design", desc: "3D model renderer" },
  { path: "src/components/dashboard/zali/ZaliSpecsPanel.tsx", domain: "Design", desc: "Engineering specs" },
  { path: "src/components/dashboard/zali/ZaliMaterialsView.tsx", domain: "Design", desc: "Materials intelligence" },
  { path: "src/components/dashboard/zali/ZaliAgentsPanel.tsx", domain: "Design", desc: "ZALI autonomous agents" },
  { path: "src/components/dashboard/zali/ZaliResearchPanel.tsx", domain: "Design", desc: "Research intelligence" },
  { path: "src/components/dashboard/zali/ZaliCodeOutputPanel.tsx", domain: "Design", desc: "Code output panel" },
  { path: "src/components/dashboard/zali/SimulationEnginePanel.tsx", domain: "Design", desc: "Physics simulation" },
  { path: "src/components/dashboard/zali/OptimizationPanel.tsx", domain: "Design", desc: "Design optimization" },
  { path: "src/components/dashboard/zali/GodModePanel.tsx", domain: "Design", desc: "God mode advanced controls" },
  { path: "src/components/dashboard/zali/CommunityView.tsx", domain: "Design", desc: "ZALI community" },
  { path: "src/components/dashboard/zali/ComponentLibraryPanel.tsx", domain: "Design", desc: "Component library" },
  { path: "src/components/dashboard/zali/MaterialIntelligencePanel.tsx", domain: "Design", desc: "Material AI analysis" },
  { path: "src/components/dashboard/zali/ManufacturingVerifyPanel.tsx", domain: "Design", desc: "Manufacturing verification" },
  // ── Intelligence: Nomad, Google ──
  { path: "src/components/dashboard/NomadView.tsx", domain: "Intelligence", desc: "OSINT investigation agent" },
  { path: "src/components/dashboard/google/GoogleIntelligenceView.tsx", domain: "Intelligence", desc: "Google data intelligence" },
  { path: "src/components/dashboard/google/MultiAccountManager.tsx", domain: "Intelligence", desc: "Multi-account management" },
  { path: "src/components/dashboard/google/NexusChatPanel.tsx", domain: "Intelligence", desc: "Nexus AI chat panel" },
  { path: "src/components/dashboard/google/modules/ScenarioEngine.tsx", domain: "Intelligence", desc: "Scenario prediction engine" },
  { path: "src/components/dashboard/google/modules/SecurityIntelligence.tsx", domain: "Security", desc: "Google security intelligence" },
  { path: "src/components/dashboard/google/modules/LifePredictions.tsx", domain: "Intelligence", desc: "Life predictions engine" },
  // ── IDE ──
  { path: "src/components/dashboard/ide/AureonIdeView.tsx", domain: "IDE", desc: "Full IDE with file tree and terminal" },
  { path: "src/components/dashboard/ide/IdeCodeEditor.tsx", domain: "IDE", desc: "Code editor with syntax highlighting" },
  { path: "src/components/dashboard/ide/IdeFileTree.tsx", domain: "IDE", desc: "File tree navigator" },
  { path: "src/components/dashboard/ide/IdeTerminal.tsx", domain: "IDE", desc: "Integrated terminal emulator" },
  { path: "src/components/dashboard/ide/IdeChatPanel.tsx", domain: "IDE", desc: "IDE AI chat panel" },
  { path: "src/components/dashboard/ide/IdePreviewPanel.tsx", domain: "IDE", desc: "Live preview panel" },
  { path: "src/components/dashboard/ide/IdeGitPanel.tsx", domain: "IDE", desc: "Git integration panel" },
  { path: "src/components/dashboard/ide/IdeSearchPanel.tsx", domain: "IDE", desc: "Code search panel" },
  { path: "src/components/dashboard/ide/IdeSessionManager.tsx", domain: "IDE", desc: "Session persistence manager" },
  // ── Search Engine ──
  { path: "src/components/dashboard/search/DeepSearchPanel.tsx", domain: "Intelligence", desc: "Deep search panel" },
  { path: "src/components/dashboard/search/SearchResultCard.tsx", domain: "Intelligence", desc: "Search result card" },
  { path: "src/components/dashboard/search/FilterSidebar.tsx", domain: "Intelligence", desc: "Search filter sidebar" },
  { path: "src/components/dashboard/search/PagePreviewPanel.tsx", domain: "Intelligence", desc: "Page preview panel" },
  // ── Security ──
  { path: "src/contexts/AuthContext.tsx", domain: "Security", desc: "Auth state management" },
  { path: "src/components/ProtectedRoute.tsx", domain: "Security", desc: "Route protection wrapper" },
  { path: "src/lib/encryption.ts", domain: "Security", desc: "AES-256-GCM client-side encryption" },
  { path: "src/lib/file-security.ts", domain: "Security", desc: "File validation and sanitization" },
  // ── Backend: Core Libraries ──
  { path: "src/contexts/SubscriptionContext.tsx", domain: "Backend", desc: "Subscription tier gating" },
  { path: "src/lib/ai.ts", domain: "AI/ML", desc: "Streaming AI chat client" },
  { path: "src/lib/messageQueue.ts", domain: "Backend", desc: "Offline message queue with retry" },
  { path: "src/integrations/supabase/client.ts", domain: "Backend", desc: "Supabase client config" },
  { path: "src/hooks/useGoogleApi.ts", domain: "Backend", desc: "Google API integration hook" },
  { path: "src/hooks/useGitHub.ts", domain: "Backend", desc: "GitHub integration hook" },
  { path: "src/hooks/useKeyboardShortcuts.ts", domain: "Frontend", desc: "Keyboard shortcuts manager" },
  { path: "src/components/dashboard/offlineStorage.ts", domain: "Backend", desc: "IndexedDB offline storage" },
  // ── Backend: Edge Functions ──
  { path: "supabase/functions/chat/index.ts", domain: "Backend", desc: "AI chat edge function with Zophiel protocol" },
  { path: "supabase/functions/security-gateway/index.ts", domain: "Security", desc: "WAF and security gateway" },
  { path: "supabase/functions/self-learning-loop/index.ts", domain: "AI/ML", desc: "Multi-language self-learning loop with brains" },
  { path: "supabase/functions/self-access-learning/index.ts", domain: "AI/ML", desc: "Self-access autonomous codebase analysis" },
  { path: "supabase/functions/asha-analyze/index.ts", domain: "Data", desc: "Azplen dataset analysis" },
  { path: "supabase/functions/asha-query/index.ts", domain: "Data", desc: "Azplen AI query engine" },
  { path: "supabase/functions/asha-report/index.ts", domain: "Data", desc: "Azplen report generation" },
  { path: "supabase/functions/asha-doc-intel/index.ts", domain: "Data", desc: "Azplen document intelligence" },
  { path: "supabase/functions/asha-extract/index.ts", domain: "Data", desc: "Azplen entity extraction" },
  { path: "supabase/functions/asha-scrape/index.ts", domain: "Data", desc: "Azplen web scraping" },
  { path: "supabase/functions/asha-monitor/index.ts", domain: "Data", desc: "Azplen health monitoring" },
  { path: "supabase/functions/zali-analyze/index.ts", domain: "Design", desc: "ZALI engineering analysis" },
  { path: "supabase/functions/zali-chat/index.ts", domain: "Design", desc: "ZALI AI chat engine" },
  { path: "supabase/functions/nomad-investigate/index.ts", domain: "Intelligence", desc: "NOMAD investigation engine" },
  
  { path: "supabase/functions/generate-predictions/index.ts", domain: "AI/ML", desc: "Predictive intelligence" },
  { path: "supabase/functions/generate-briefing/index.ts", domain: "Intelligence", desc: "Intelligence briefing generator" },
  { path: "supabase/functions/briefing-cron/index.ts", domain: "Backend", desc: "Briefing cron scheduler" },
  { path: "supabase/functions/briefing-onboard/index.ts", domain: "Backend", desc: "Briefing onboarding" },
  { path: "supabase/functions/zophiel-search/index.ts", domain: "Intelligence", desc: "Zophiel search engine" },
  { path: "supabase/functions/zophiel-deep-search/index.ts", domain: "Intelligence", desc: "Zophiel deep search" },
  { path: "supabase/functions/zophiel-preview/index.ts", domain: "Intelligence", desc: "Zophiel page preview" },
  { path: "supabase/functions/ddg-search/index.ts", domain: "Backend", desc: "DuckDuckGo search proxy" },
  { path: "supabase/functions/oracle-locus/index.ts", domain: "Intelligence", desc: "Oracle Locus prediction" },
  { path: "supabase/functions/create-checkout/index.ts", domain: "Backend", desc: "Stripe checkout session" },
  { path: "supabase/functions/check-subscription/index.ts", domain: "Backend", desc: "Subscription verification" },
  { path: "supabase/functions/customer-portal/index.ts", domain: "Backend", desc: "Stripe customer portal" },
  { path: "supabase/functions/plugin-checkout/index.ts", domain: "Backend", desc: "Plugin purchase checkout" },
  { path: "supabase/functions/plugin-execute/index.ts", domain: "Backend", desc: "Plugin execution engine" },
  { path: "supabase/functions/export-data/index.ts", domain: "Backend", desc: "Data export handler" },
  { path: "supabase/functions/delete-account/index.ts", domain: "Backend", desc: "Account deletion handler" },
  { path: "supabase/functions/send-email-notification/index.ts", domain: "Backend", desc: "Email notification sender" },
  { path: "supabase/functions/notebook-execute/index.ts", domain: "Backend", desc: "Notebook code execution" },
  { path: "supabase/functions/suggest/index.ts", domain: "AI/ML", desc: "Follow-up suggestion engine" },
  { path: "supabase/functions/google-oauth/index.ts", domain: "Backend", desc: "Google OAuth handler" },
  { path: "supabase/functions/google-data/index.ts", domain: "Backend", desc: "Google data sync" },
  { path: "supabase/functions/github-api/index.ts", domain: "Backend", desc: "GitHub API proxy" },
  { path: "supabase/functions/tracker-pair/index.ts", domain: "Backend", desc: "Tracker pairing engine" },
  // ── Landing Components ──
  { path: "src/components/landing/AgentArchitectureDiagram.tsx", domain: "Frontend", desc: "Agent architecture diagram" },
  { path: "src/components/landing/DashboardPreview.tsx", domain: "Frontend", desc: "Dashboard preview component" },
  { path: "src/components/LandingBackground.tsx", domain: "Frontend", desc: "Landing page background" },
  { path: "src/components/Header.tsx", domain: "Frontend", desc: "Global header navigation" },
  { path: "src/components/WallpaperSwitcher.tsx", domain: "Frontend", desc: "Wallpaper switcher" },
];

const ANALYSIS_AGENTS = [
  { name: "Debugging Agent", focus: "Identify bugs, logic errors, null pointer risks, race conditions, and crash vectors. Trace data flow and find where variables could be undefined." },
  { name: "Optimization Agent", focus: "Find performance bottlenecks: O(n²) loops, unnecessary re-renders, memory leaks, bundle size issues, redundant API calls, missing memoization." },
  { name: "Security Agent", focus: "Red-team the architecture: find injection vectors, auth bypasses, XSS risks, insecure defaults, missing input validation, exposed secrets, CORS misconfigs." },
  { name: "Architecture Agent", focus: "Assess coupling, cohesion, separation of concerns, component size (god-components), circular dependencies, scalability limits, and maintainability." },
  { name: "Design Agent", focus: "Evaluate UI/UX patterns: accessibility gaps, responsive breakpoints, inconsistent theming, missing loading/error states, poor component composition." },
  { name: "Logic Flaw Agent", focus: "Hunt for logical flaws at every scale: incorrect conditional branches, off-by-one errors, inverted boolean checks, impossible states, default-case omissions, stale closures, filter/map chains that silently drop data, fallthrough switches, enum/union exhaustiveness gaps, comparison operators that should be strict, timezone/locale-naive date logic, edge cases where arrays are empty or objects are missing keys, memoization dependencies that are wrong or incomplete, and any scenario where the code 'works' in the happy path but breaks under real-world variance. Trace every if/else, ternary, and optional chain to verify it handles null, undefined, empty string, 0, NaN, and negative values correctly." },
  { name: "Workflow Flaw Agent", focus: "Analyze end-to-end user workflows and multi-step feature flows for breakdowns: onboarding sequences that skip steps, form submissions that lose data on error, navigation flows that leave orphaned state, undo/redo paths that corrupt data, multi-panel dashboards where one panel's action doesn't update another, subscription upgrades/downgrades that leave stale UI, file upload pipelines that don't handle partial failures, search-then-act flows where context is lost between steps, session/auth expiration mid-workflow that causes silent data loss, real-time sync conflicts, import/export round-trip data corruption, and any cross-feature interaction where Feature A's state change should propagate to Feature B but doesn't. Check that loading→success→error→retry state machines are complete and that every user-facing action has proper feedback (toast, spinner, disabled state)." },
  { name: "UI Logic Flaw Agent", focus: "Hunt for UI-layer logic flaws where the visual state diverges from the data state: components that render stale props after a parent re-fetch, conditional renders that flash wrong content before settling, disabled buttons that can still be triggered via keyboard/enter, modals that don't trap focus or allow background scroll, dropdowns/popovers that stay open after navigation, lists that don't handle empty/loading/error states causing blank screens, pagination that resets filters on page change, tabs that lose unsaved form data on switch, search inputs that fire requests on every keystroke without debounce, infinite scroll that duplicates items or skips pages, drag-and-drop that leaves ghost elements, toggle switches whose visual state doesn't match the persisted value after optimistic update failure, responsive breakpoints where elements overlap or disappear, z-index wars where tooltips render behind modals, scroll position that jumps after dynamic content loads, clipboard copy buttons that silently fail without feedback, file inputs that accept wrong MIME types, date pickers that allow impossible ranges, number inputs that accept NaN/Infinity, select components that show stale options after data refresh, and any scenario where what the user SEES doesn't match what the database STORES." },
  { name: "Cross-Module Recommendation Agent", focus: "Identify features, patterns, and capabilities in one module that would significantly benefit another module if integrated or shared. Examples: Aureon Chat's Chain-of-Thought transparency could enhance ZALI's engineering analysis output; AZPLEN's entity extraction pipeline could power Aureon Chat's automatic knowledge graph; the IDE's code editor could embed ZALI's material specs viewer; NOMAD's OSINT investigation results could feed into Predictive Intelligence as signal sources; AZPLEN's data lineage tracking could give the IDE's git panel deeper context; Zophiel's deep search could be embedded in AZPLEN's query bar; the Security Dashboard's threat intel could auto-generate briefings; the IDE's terminal output could feed the Self-Learning Loop as training data; Google Intelligence's life predictions could integrate with the Tracker for personal KPI monitoring; ZALI's simulation engine could use AZPLEN's datasets as input parameters. For each recommendation, specify the SOURCE module (where the capability exists), the TARGET module (where it should be applied), the specific feature/pattern to transfer, the integration approach, and the expected user impact. Think about data flow, shared components, unified APIs, and cross-module state management. Return findings with finding_type 'recommendation'." },
];

// Maximum findings cap per analysis run
const MAX_FINDINGS_PER_RUN = 100;

async function callAI(systemPrompt: string, userPrompt: string): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY_APP not configured");
  const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Gemini API error ${resp.status}: ${t}`);
  }
  const data = await resp.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // ── Strict BYOK gate — admin uses platform key, others must BYOK ──
  if (req.method !== 'OPTIONS') {
    try {
      const _b = await req.clone().json().catch(() => ({} as any));
      const _byok = (_b && typeof _b === 'object') ? (_b as any).byok : undefined;
      const _gate = await import('../_shared/adminGate.ts');
      await _gate.resolveKey(req, _byok);
    } catch (_e) {
      const _gate = await import('../_shared/adminGate.ts');
      return _gate.byokErrorResponse(_e, corsHeaders);
    }
  }

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const supabaseAnon = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") || "");
    let authenticatedUser: any = null;

    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabaseAnon.auth.getUser(token);
      if (user && isAuthorizedAdminEmail(user.email)) {
        authenticatedUser = user;
      }
    }

    // For cron/automated calls: look up admin user ID from profiles
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    let adminUserId: string | null = authenticatedUser?.id || null;

    if (!adminUserId) {
      // Automated cron call — resolve admin user ID from auth.users
      const { data: adminUsers } = await supabase.auth.admin.listUsers();
      const admin = adminUsers?.users?.find((u: any) => isAuthorizedAdminEmail(u.email));
      if (!admin) {
        return new Response(JSON.stringify({ error: "Admin not found" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      adminUserId = admin.id;
    }

    const body = await req.json();
    const { action, scope } = body;

    if (action === "analyze") {
      const startTime = Date.now();

      // Use resolved admin user ID
      const userId = adminUserId;
      if (!userId) throw new Error("No admin user");

      // Create run
      const { data: run } = await supabase
        .from("self_access_runs")
        .insert({ user_id: userId, status: "running", scan_scope: scope || "full" })
        .select().single();
      if (!run) throw new Error("Failed to create run");

      // Filter files by scope
      let files = CODEBASE_FILES;
      if (scope === "frontend") files = files.filter(f => f.domain === "Frontend" || f.domain === "Design");
      else if (scope === "backend") files = files.filter(f => f.domain === "Backend" || f.domain === "Data" || f.domain === "AI/ML");
      else if (scope === "security") files = files.filter(f => f.domain === "Security");

      // Pick random subset per run (max 25 files for deeper coverage)
      const selectedFiles = [...files].sort(() => Math.random() - 0.5).slice(0, 25);

      // Attempt to fetch LIVE code from GitHub for each file
      let githubConn: { github_token: string; repo_owner: string; repo_name: string; branch: string } | null = null;
      const { data: connRows } = await supabase
        .from("github_connections")
        .select("github_token, repo_owner, repo_name, branch")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1);
      if (connRows && connRows.length > 0) githubConn = connRows[0];

      // Fetch actual code content in parallel (with 8KB cap per file to stay within token limits)
      const MAX_FILE_CHARS = 8000;
      const fileContents: Record<string, string> = {};
      if (githubConn) {
        const fetchPromises = selectedFiles.map(async (f) => {
          const content = await fetchFileFromGitHub(f.path, githubConn!.github_token, githubConn!.repo_owner, githubConn!.repo_name, githubConn!.branch);
          if (content) {
            fileContents[f.path] = content.length > MAX_FILE_CHARS
              ? content.slice(0, MAX_FILE_CHARS) + "\n// ... [TRUNCATED — full file is " + content.length + " chars]"
              : content;
          }
        });
        await Promise.all(fetchPromises);
      }

      const hasLiveCode = Object.keys(fileContents).length > 0;

      // Run ALL agents across all selected files for maximum coverage (up to 100 findings)
      const selectedAgents = ANALYSIS_AGENTS;
      const allFindings: any[] = [];

      for (const agent of selectedAgents) {
        // Build file context — include REAL code when available
        const fileBlocks = selectedFiles.map(f => {
          if (fileContents[f.path]) {
            return `── ${f.path} (${f.domain}: ${f.desc}) ──\n\`\`\`\n${fileContents[f.path]}\n\`\`\``;
          }
          return `── ${f.path} (${f.domain}: ${f.desc}) ── [code not available — analyze based on file context]`;
        }).join("\n\n");

        const systemPrompt = `You are the ${agent.name} in AUREON's Self-Access Learning system — an autonomous intelligence that analyzes its own codebase.
Your focus: ${agent.focus}

CRITICAL RULES:
- You are analyzing a REAL production codebase (React + TypeScript + Supabase + Tailwind).
- ${hasLiveCode ? "You have been given the ACTUAL LIVE SOURCE CODE pulled from GitHub seconds ago. Analyze the REAL code, not hypothetical patterns." : "Analyze based on file paths and architecture knowledge."}
- Generate ACTIONABLE findings with REAL fixes. Not theoretical — production-grade.
- For each finding, provide the EXACT code change needed.
- Never auto-apply. You produce recommendations for the human creator.
- Return ONLY valid JSON array, no markdown.

Each finding must be:
{
  "file_path": "exact/path/to/file",
  "finding_type": "bug"|"optimization"|"security"|"architecture"|"design"|"logic"|"workflow"|"recommendation",
  "severity": "critical"|"high"|"medium"|"low",
  "title": "Short descriptive title",
  "finding": "What you found — the specific issue with line references if possible",
  "reasoning": "Deep analysis of WHY this is a problem, tracing through the code logic",
  "recommendation": "What should be done to fix it",
  "reason_needs_fix": "Impact if left unfixed — production consequences",
  "output_code": "The exact code snippet or diff to apply as the fix"
}`;

        const userPrompt = `Analyze these files from the AUREON AI intelligence platform codebase. Generate 8-12 high-quality findings:

${fileBlocks}

Context: This is a production AI platform with chat, data intelligence (AZPLEN), engineering design (ZALI), OSINT (NOMAD), predictive intel, IDE, security command center, and self-learning capabilities. It uses React 18, Supabase edge functions, Tailwind CSS, and the Lovable AI gateway.

${hasLiveCode ? "You have the REAL source code above. Reference specific line numbers, variable names, and actual logic paths in your findings." : "Focus on REAL issues you'd find in a codebase of this complexity."}`;

        try {
          const raw = await callAI(systemPrompt, userPrompt);
          // Robust JSON extraction: strip markdown, find the JSON array
          let cleaned = raw.replace(/```json\n?/gi, "").replace(/```\n?/g, "").trim();
          // Find the first '[' and last ']' to extract just the JSON array
          const arrStart = cleaned.indexOf("[");
          const arrEnd = cleaned.lastIndexOf("]");
          if (arrStart !== -1 && arrEnd > arrStart) {
            cleaned = cleaned.slice(arrStart, arrEnd + 1);
          }
          const findings = JSON.parse(cleaned);
          if (Array.isArray(findings)) {
            allFindings.push(...findings.map((f: any) => ({
              ...f,
              user_id: userId,
              run_id: run.id,
            })));
          }
        } catch (e) {
          console.error(`Agent ${agent.name} parse error:`, e);
        }
      }

      // Cap findings at MAX_FINDINGS_PER_RUN and store
      const cappedFindings = allFindings.slice(0, MAX_FINDINGS_PER_RUN);
      if (cappedFindings.length > 0) {
        // Insert in batches of 25 to avoid payload limits
        for (let i = 0; i < cappedFindings.length; i += 25) {
          await supabase.from("self_access_findings").insert(cappedFindings.slice(i, i + 25));
        }
      }

      const duration = Date.now() - startTime;
      await supabase.from("self_access_runs").update({
        status: "completed",
        files_analyzed: selectedFiles.length,
        findings_count: cappedFindings.length,
        duration_ms: duration,
        completed_at: new Date().toISOString(),
      }).eq("id", run.id);

      return new Response(JSON.stringify({
        success: true, runId: run.id, findings: cappedFindings.length, duration,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "get-runs") {
      const { data } = await supabase
        .from("self_access_runs").select("*")
        .order("created_at", { ascending: false }).limit(50);
      return new Response(JSON.stringify({ runs: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get-findings") {
      const { runId, status: filterStatus } = body;
      let query = supabase.from("self_access_findings").select("*")
        .order("created_at", { ascending: false }).limit(1000);
      if (runId) query = query.eq("run_id", runId);
      if (filterStatus) query = query.eq("status", filterStatus);
      const { data } = await query;
      return new Response(JSON.stringify({ findings: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update-finding") {
      const { findingId, status: newStatus } = body;
      await supabase.from("self_access_findings").update({ status: newStatus }).eq("id", findingId);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("self-access-learning error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
