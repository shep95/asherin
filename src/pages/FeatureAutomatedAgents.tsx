import FeaturePageShell from "@/components/landing/FeaturePageShell";
import { Bot, Clock, Zap, GitBranch, BarChart3, Bell, Layers, Eye, Activity } from "lucide-react";

const FeatureAutomatedAgents = () => (
  <FeaturePageShell
    documentTitle="Automated Agents — Scheduled Autonomous Tasks | Aureon"
    eyebrow="Autonomous Workflows"
    headline={<>Agents That Actually<br /><span className="text-muted-foreground">Show Up to Work.</span></>}
    subheadline="The Automated Agents add-on lets you create, schedule, and execute autonomous AI tasks. Trigger by time, event, or webhook — output to email, file, dashboard, or downstream system."
    tierLabel="Add-on — $200/mo"
    capabilities={[
      { icon: Bot, title: "Persistent Agent Definitions", description: "Each agent has a name, description, action chain, settings, trigger, and output config." },
      { icon: Clock, title: "Schedule by Time or Event", description: "Cron-style time triggers, webhook triggers, or event-driven activation." },
      { icon: Zap, title: "Multi-Step Action Chains", description: "Agents execute structured action sequences — search, analyze, summarize, deliver." },
      { icon: GitBranch, title: "Conditional Branching", description: "Branch the agent's action graph based on intermediate results." },
      { icon: BarChart3, title: "Run Counters & SLA", description: "Track total_runs, successful_runs, failed_runs with per-execution duration logging." },
      { icon: Bell, title: "Output Routing", description: "Email, file drop, webhook POST, dashboard widget, or chat message — pick the destination." },
      { icon: Layers, title: "Settings Per Agent", description: "Each agent stores its own settings JSON for inputs, prompts, and behavioral knobs." },
      { icon: Eye, title: "Execution History", description: "Per-agent execution log with results, errors, and duration for full forensics." },
      { icon: Activity, title: "Schedule Queue", description: "agent_schedule table drives the scheduler with status tracking per slot." },
    ]}
    useCases={[
      "Daily competitive intelligence reports delivered to inbox at 7am",
      "Continuous social listening with alerting on threshold breaches",
      "Automated weekly KPI rollups across multiple data sources",
      "Webhook-triggered enrichment pipelines (e.g., new lead → research dossier)",
      "Self-running market research and trend monitoring",
    ]}
    ctaTitle="Hire an AI. Skip the Onboarding."
    ctaSubtitle="Automated Agents is a $200/mo add-on for Aureon and Pro plans."
  />
);

export default FeatureAutomatedAgents;
