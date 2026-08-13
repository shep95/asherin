import { useState, useEffect, useCallback } from "react";
import {
  Bot, Plus, Play, Pause, Trash2, Clock, CheckCircle2, XCircle, 
  ChevronDown, ChevronRight, Settings2, Activity, Zap, Search,
  LayoutGrid, List, Loader2, Eye, FileText, Star, Store,
  Mail, MessageSquare, Webhook, Database, FileOutput,
  RefreshCw, AlertTriangle, Power,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { AutomatedAgent, AgentExecution, AgentTemplate } from "./types";
import { AGENT_TEMPLATES, AGENT_CATEGORIES } from "./types";

const OUTPUT_ICONS: Record<string, React.ElementType> = {
  email: Mail,
  sms: MessageSquare,
  slack: MessageSquare,
  webhook: Webhook,
  database: Database,
  file: FileOutput,
  discord: MessageSquare,
  telegram: MessageSquare,
  whatsapp: MessageSquare,
};

const formatTimeAgo = (dateStr: string | null) => {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

const AgentsView = () => {
  const { user } = useAuth();
  const { subscribed } = useSubscription();
  const { toast } = useToast();
  const [agents, setAgents] = useState<AutomatedAgent[]>([]);
  const [executions, setExecutions] = useState<Record<string, AgentExecution[]>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AutomatedAgent | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [logsAgent, setLogsAgent] = useState<AutomatedAgent | null>(null);
  const [logsData, setLogsData] = useState<AgentExecution[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [templateCategory, setTemplateCategory] = useState("all");
  
  // Create form state
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPrompt, setNewPrompt] = useState("");
  const [newTriggerType, setNewTriggerType] = useState("schedule");
  const [newFrequency, setNewFrequency] = useState("daily");
  const [newTime, setNewTime] = useState("07:00");
  const [newOutputType, setNewOutputType] = useState("email");
  const [newOutputEmail, setNewOutputEmail] = useState("");
  const [newOutputPhone, setNewOutputPhone] = useState("");
  const [newOutputSlackChannel, setNewOutputSlackChannel] = useState("");
  const [newOutputWebhookUrl, setNewOutputWebhookUrl] = useState("");
  const [newOutputDiscordWebhook, setNewOutputDiscordWebhook] = useState("");
  const [newOutputTelegramChatId, setNewOutputTelegramChatId] = useState("");
  const [creating, setCreating] = useState(false);
  const [newRetryOnFailure, setNewRetryOnFailure] = useState(true);
  const [newMaxRetries, setNewMaxRetries] = useState(3);
  const [newRequireApproval, setNewRequireApproval] = useState(false);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  const loadAgents = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("automated_agents")
      .select("*")
      .eq("user_id", user.id)
      .neq("status", "deleted")
      .order("created_at", { ascending: false });
    if (data) setAgents(data as unknown as AutomatedAgent[]);
    if (error) console.error("Error loading agents:", error);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadAgents(); }, [loadAgents]);

  const loadExecutions = useCallback(async (agentId: string) => {
    if (!user) return;
    setLogsLoading(true);
    const { data } = await supabase
      .from("agent_executions")
      .select("*")
      .eq("agent_id", agentId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setLogsData(data as unknown as AgentExecution[]);
    setLogsLoading(false);
  }, [user]);

  const toggleAgentStatus = async (agent: AutomatedAgent) => {
    const newStatus = agent.status === "active" ? "paused" : "active";
    await supabase.from("automated_agents").update({ status: newStatus }).eq("id", agent.id);
    setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, status: newStatus } : a));
    toast({ title: newStatus === "active" ? "Agent activated" : "Agent paused" });
  };

  const deleteAgent = async (id: string) => {
    await supabase.from("automated_agents").update({ status: "deleted" }).eq("id", id);
    setAgents(prev => prev.filter(a => a.id !== id));
    toast({ title: "Agent deleted" });
  };

  const [runningAgentId, setRunningAgentId] = useState<string | null>(null);

  const runAgentNow = async (agent: AutomatedAgent) => {
    setRunningAgentId(agent.id);
    try {
      const { data, error } = await supabase.functions.invoke("agent-execute", {
        body: { agentId: agent.id },
      });
      if (error) throw error;
      const status = String(data?.status ?? "success");
      if (status === "awaiting_approval") {
        toast({ title: "Held for approval", description: `${agent.name} produced its output and is waiting on your decision before delivery.` });
      } else if (status === "failed") {
        const firstError = (data?.steps ?? []).find((st: any) => st.status === "failed")?.error;
        toast({ title: "Run failed", description: firstError || `${agent.name} did not complete.`, variant: "destructive" });
      } else if (status === "partial") {
        const skipped = (data?.steps ?? []).filter((st: any) => st.status !== "success").map((st: any) => st.type);
        toast({ title: "Ran with gaps", description: `${agent.name} finished, but these steps did not run: ${skipped.join(", ") || "unknown"}.` });
      } else {
        const deliveryInfo = data?.delivery?.success
          ? ` — delivered via ${data?.delivery?.to || data?.delivery?.channel || agent.output_type}`
          : "";
        toast({ title: "Agent executed", description: `${agent.name} ran clean${deliveryInfo}` });
      }
      loadAgents();
      if (logsAgent?.id === agent.id) loadExecutions(agent.id);
    } catch (err) {
      toast({ title: "Execution failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    }
    setRunningAgentId(null);
  };

  // Human-in-the-loop decision. Approve resumes the paused run from its
  // checkpoint and delivers; hold marks the run failed and sends nothing.
  const decideRun = async (exec: AgentExecution, approve: boolean) => {
    setDecidingId(exec.id);
    try {
      const { data, error } = await supabase.functions.invoke("agent-execute", {
        body: { agentId: exec.agent_id, executionId: exec.id, approve },
      });
      if (error) throw error;
      toast({
        title: approve ? "Delivery approved" : "Run held",
        description: approve
          ? `Run resumed and finished ${String(data?.status ?? "")}.`
          : "Nothing was sent. The run is recorded as failed.",
        variant: approve ? undefined : "destructive",
      });
      await loadExecutions(exec.agent_id);
      loadAgents();
    } catch (err) {
      toast({ title: "Decision failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    }
    setDecidingId(null);
  };

  const createAgent = async () => {
    if (!user || !newName.trim()) return;
    setCreating(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast({ title: "Session expired", description: "Please sign in again", variant: "destructive" });
      setCreating(false);
      return;
    }
    try {
      const triggerConfig = {
        type: newTriggerType,
        schedule: newTriggerType === "schedule" ? {
          frequency: newFrequency,
          time: newTime,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        } : undefined,
      };
      const actions = [{
        type: "ai_generate",
        config: { prompt: newPrompt || `Execute: ${newDescription || newName}` },
        order: 1,
      }];
      const outputConfig = {
        type: newOutputType,
        config: {
          ...(newOutputType === "email" && { email: newOutputEmail || user.email }),
          ...(newOutputType === "sms" && { phone_number: newOutputPhone }),
          ...(newOutputType === "slack" && { channel: newOutputSlackChannel }),
          ...(newOutputType === "webhook" && { url: newOutputWebhookUrl }),
          ...(newOutputType === "discord" && { webhook_url: newOutputDiscordWebhook }),
          ...(newOutputType === "telegram" && { chat_id: newOutputTelegramChatId }),
          ...(newOutputType === "whatsapp" && { phone_number: newOutputPhone }),
        },
      };

      const { data, error } = await supabase.from("automated_agents").insert({
        user_id: session.user.id,
        name: newName.trim(),
        description: newDescription.trim() || null,
        trigger_type: newTriggerType,
        trigger_config: triggerConfig,
        actions,
        output_type: newOutputType,
        output_config: outputConfig,
        status: "active",
        settings: {
          retryOnFailure: newRetryOnFailure,
          maxRetries: newMaxRetries,
          notifyOnFailure: true,
          timeout: 30,
          requireApproval: newRequireApproval,
        },
      }).select().single();

      if (error) throw error;
      setAgents(prev => [data as unknown as AutomatedAgent, ...prev]);
      setShowCreate(false);
      setNewName("");
      setNewDescription("");
      setNewPrompt("");
      setNewOutputEmail("");
      setNewOutputPhone("");
      setNewOutputSlackChannel("");
      setNewOutputWebhookUrl("");
      setNewOutputDiscordWebhook("");
      setNewOutputTelegramChatId("");
      toast({ title: "Agent created", description: `${newName} is now active` });
    } catch (err) {
      toast({ title: "Error creating agent", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    }
    setCreating(false);
  };

  const createFromTemplate = (template: AgentTemplate) => {
    setNewName(template.name);
    setNewDescription(template.description);
    setNewTriggerType(template.trigger.type || "schedule");
    if (template.trigger.schedule) {
      setNewFrequency(template.trigger.schedule.frequency || "daily");
      setNewTime(template.trigger.schedule.time || "07:00");
    }
    setNewOutputType(template.output.type || "email");
    setShowCreate(true);
    setActiveTab("dashboard");
  };

  const activeAgents = agents.filter(a => a.status === "active");
  const pausedAgents = agents.filter(a => a.status === "paused");

  const filteredTemplates = AGENT_TEMPLATES.filter(t => {
    if (templateCategory !== "all" && t.category !== templateCategory) return false;
    if (searchQuery && !t.name.toLowerCase().includes(searchQuery.toLowerCase()) && !t.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const totalRuns = agents.reduce((sum, a) => sum + a.total_runs, 0);
  const totalSuccess = agents.reduce((sum, a) => sum + a.successful_runs, 0);
  const successRate = totalRuns > 0 ? Math.round((totalSuccess / totalRuns) * 100) : 100;

  return (
    <ScrollArea className="h-full">
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-accent/10 p-2.5">
              <Bot className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h2 className="text-lg font-extralight tracking-wide text-foreground">Automated Agents</h2>
              <p className="text-[10px] text-muted-foreground/60 tracking-wider">Tell me what to do, I'll do it forever</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-xl bg-accent text-accent-foreground px-4 py-2.5 text-xs font-light tracking-wide hover:bg-accent/90 transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            Create Agent
          </button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Active Agents", value: activeAgents.length, icon: Zap, color: "text-emerald-400" },
            { label: "Total Runs", value: totalRuns.toLocaleString(), icon: Activity, color: "text-blue-400" },
            { label: "Success Rate", value: `${successRate}%`, icon: CheckCircle2, color: "text-cyan-400" },
            { label: "Paused", value: pausedAgents.length, icon: Pause, color: "text-amber-400" },
          ].map(stat => (
            <div key={stat.label} className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-3 sm:p-4">
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className={`h-3.5 w-3.5 ${stat.color}`} />
                <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">{stat.label}</span>
              </div>
              <p className="text-xl font-extralight text-foreground">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-card/20 border border-border/20">
            <TabsTrigger value="dashboard" className="text-xs">My Agents</TabsTrigger>
            <TabsTrigger value="marketplace" className="text-xs">Marketplace</TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-4 mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : agents.length === 0 ? (
              <div className="text-center py-20 space-y-4">
                <Bot className="h-12 w-12 text-muted-foreground/30 mx-auto" />
                <div>
                  <p className="text-sm font-light text-foreground">No agents yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Create your first automated agent or pick a template from the marketplace</p>
                </div>
                <div className="flex gap-3 justify-center">
                  <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-xl bg-accent text-accent-foreground px-4 py-2 text-xs hover:bg-accent/90 transition-all">
                    <Plus className="h-3 w-3" /> Create Agent
                  </button>
                  <button onClick={() => setActiveTab("marketplace")} className="flex items-center gap-2 rounded-xl border border-border/30 bg-card/20 px-4 py-2 text-xs text-foreground hover:bg-card/40 transition-all">
                    <Store className="h-3 w-3" /> Browse Templates
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* View toggle */}
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground/60">
                    {activeAgents.length} active · {pausedAgents.length} paused
                  </p>
                  <div className="flex gap-1 rounded-lg border border-border/20 bg-card/20 p-0.5">
                    <button onClick={() => setViewMode("grid")} className={`p-1.5 rounded-md transition-colors ${viewMode === "grid" ? "bg-foreground/10" : ""}`}>
                      <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    <button onClick={() => setViewMode("list")} className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-foreground/10" : ""}`}>
                      <List className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </div>
                </div>

                {/* Active Agents */}
                {activeAgents.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground/50 uppercase">Active Agents ({activeAgents.length})</p>
                    <div className={viewMode === "grid" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" : "space-y-2"}>
                      {activeAgents.map(agent => (
                        <AgentCard
                          key={agent.id}
                          agent={agent}
                          viewMode={viewMode}
                          isRunning={runningAgentId === agent.id}
                          onToggle={() => toggleAgentStatus(agent)}
                          onDelete={() => deleteAgent(agent.id)}
                          onRunNow={() => runAgentNow(agent)}
                          onViewLogs={() => { setLogsAgent(agent); setShowLogs(true); loadExecutions(agent.id); }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Paused Agents */}
                {pausedAgents.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground/50 uppercase">Paused Agents ({pausedAgents.length})</p>
                    <div className={viewMode === "grid" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" : "space-y-2"}>
                      {pausedAgents.map(agent => (
                        <AgentCard
                          key={agent.id}
                          agent={agent}
                          viewMode={viewMode}
                          isRunning={runningAgentId === agent.id}
                          onToggle={() => toggleAgentStatus(agent)}
                          onDelete={() => deleteAgent(agent.id)}
                          onRunNow={() => runAgentNow(agent)}
                          onViewLogs={() => { setLogsAgent(agent); setShowLogs(true); loadExecutions(agent.id); }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* Marketplace Tab */}
          <TabsContent value="marketplace" className="space-y-4 mt-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex items-center gap-2 flex-1 rounded-xl border border-border/20 bg-card/20 px-3 py-2">
                <Search className="h-3.5 w-3.5 text-muted-foreground/50" />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search templates..."
                  className="flex-1 bg-transparent text-xs font-light text-foreground placeholder:text-muted-foreground/40 outline-none"
                />
              </div>
            </div>

            {/* Category Filter */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setTemplateCategory("all")}
                className={`rounded-lg px-3 py-1.5 text-[10px] font-light transition-colors ${templateCategory === "all" ? "bg-accent text-accent-foreground" : "border border-border/20 bg-card/20 text-muted-foreground hover:bg-card/40"}`}
              >
                All
              </button>
              {AGENT_CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setTemplateCategory(cat.id)}
                  className={`rounded-lg px-3 py-1.5 text-[10px] font-light transition-colors ${templateCategory === cat.id ? "bg-accent text-accent-foreground" : "border border-border/20 bg-card/20 text-muted-foreground hover:bg-card/40"}`}
                >
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>

            {/* Templates Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredTemplates.map(template => (
                <div
                  key={template.id}
                  className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4 hover:bg-card/40 transition-colors group"
                >
                  <div className="text-2xl mb-3">{template.icon}</div>
                  <h4 className="text-xs font-light text-foreground mb-1">{template.name}</h4>
                  <p className="text-[10px] text-muted-foreground/60 leading-relaxed mb-3">{template.description}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                      <span className="text-[10px] text-muted-foreground">{template.rating}</span>
                      <span className="text-[10px] text-muted-foreground/40">({template.usageCount.toLocaleString()})</span>
                    </div>
                    <button
                      onClick={() => createFromTemplate(template)}
                      className="flex items-center gap-1 rounded-lg bg-foreground/10 px-3 py-1.5 text-[10px] font-light text-foreground hover:bg-foreground/15 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Plus className="h-3 w-3" />
                      Use
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Create Agent Dialog */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="sm:max-w-lg bg-card border-border/30 backdrop-blur-xl">
            <DialogHeader>
              <DialogTitle className="text-sm font-light tracking-wide text-foreground flex items-center gap-2">
                <Bot className="h-4 w-4 text-accent" />
                Create New Agent
              </DialogTitle>
              <DialogDescription className="text-[10px] text-muted-foreground/60">
                Describe what you want the agent to do. It will run automatically based on your configuration.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Agent Name</label>
                <input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="e.g., Daily Email Report"
                  className="w-full rounded-lg border border-border/20 bg-card/20 px-3 py-2 text-xs font-light text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-accent/30"
                />
              </div>

              {/* Description / Prompt */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">What should this agent do?</label>
                <textarea
                  value={newPrompt || newDescription}
                  onChange={e => { setNewPrompt(e.target.value); setNewDescription(e.target.value); }}
                  placeholder='e.g., "Send me an email every morning at 7am with my daily astrology prediction"'
                  rows={3}
                  className="w-full rounded-lg border border-border/20 bg-card/20 px-3 py-2 text-xs font-light text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-accent/30 resize-none"
                />
              </div>

              {/* Trigger Type */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Trigger</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: "schedule", label: "Schedule", icon: Clock },
                    { id: "event", label: "Event", icon: Zap },
                    { id: "webhook", label: "Webhook", icon: Webhook },
                    { id: "manual", label: "Manual", icon: Play },
                  ].map(t => (
                    <button
                      key={t.id}
                      onClick={() => setNewTriggerType(t.id)}
                      className={`flex flex-col items-center gap-1 rounded-lg p-2 text-[10px] transition-colors ${newTriggerType === t.id ? "bg-accent/20 text-accent border border-accent/30" : "border border-border/20 bg-card/20 text-muted-foreground hover:bg-card/40"}`}
                    >
                      <t.icon className="h-3.5 w-3.5" />
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Schedule config */}
              {newTriggerType === "schedule" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Frequency</label>
                    <select
                      value={newFrequency}
                      onChange={e => setNewFrequency(e.target.value)}
                      className="w-full rounded-lg border border-border/20 bg-card/20 px-3 py-2 text-xs font-light text-foreground outline-none"
                    >
                      <option value="hourly">Hourly</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Time</label>
                    <input
                      type="time"
                      value={newTime}
                      onChange={e => setNewTime(e.target.value)}
                      className="w-full rounded-lg border border-border/20 bg-card/20 px-3 py-2 text-xs font-light text-foreground outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Output Type */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Output</label>
                <div className="flex flex-wrap gap-2">
                  {["email", "sms", "slack", "webhook", "discord", "telegram", "whatsapp", "database"].map(type => (
                    <button
                      key={type}
                      onClick={() => setNewOutputType(type)}
                      className={`rounded-lg px-3 py-1.5 text-[10px] capitalize transition-colors ${newOutputType === type ? "bg-accent/20 text-accent border border-accent/30" : "border border-border/20 bg-card/20 text-muted-foreground hover:bg-card/40"}`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Output config fields */}
              {newOutputType === "email" && (
                <div className="space-y-1.5">
                  <label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Send to email</label>
                  <input
                    value={newOutputEmail}
                    onChange={e => setNewOutputEmail(e.target.value)}
                    placeholder={user?.email || "your@email.com"}
                    className="w-full rounded-lg border border-border/20 bg-card/20 px-3 py-2 text-xs font-light text-foreground placeholder:text-muted-foreground/40 outline-none"
                  />
                </div>
              )}

              {newOutputType === "sms" && (
                <div className="space-y-1.5">
                  <label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Phone Number (E.164 format)</label>
                  <input
                    value={newOutputPhone}
                    onChange={e => setNewOutputPhone(e.target.value)}
                    placeholder="+15551234567"
                    className="w-full rounded-lg border border-border/20 bg-card/20 px-3 py-2 text-xs font-light text-foreground placeholder:text-muted-foreground/40 outline-none"
                  />
                  <p className="text-[9px] text-muted-foreground/40">Requires Twilio connection. Include country code.</p>
                </div>
              )}

              {newOutputType === "slack" && (
                <div className="space-y-1.5">
                  <label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Slack Channel</label>
                  <input
                    value={newOutputSlackChannel}
                    onChange={e => setNewOutputSlackChannel(e.target.value)}
                    placeholder="#general or C1234567890"
                    className="w-full rounded-lg border border-border/20 bg-card/20 px-3 py-2 text-xs font-light text-foreground placeholder:text-muted-foreground/40 outline-none"
                  />
                  <p className="text-[9px] text-muted-foreground/40">Requires Slack connection. Use channel name or ID.</p>
                </div>
              )}

              {newOutputType === "webhook" && (
                <div className="space-y-1.5">
                  <label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Webhook URL</label>
                  <input
                    value={newOutputWebhookUrl}
                    onChange={e => setNewOutputWebhookUrl(e.target.value)}
                    placeholder="https://your-api.com/webhook"
                    className="w-full rounded-lg border border-border/20 bg-card/20 px-3 py-2 text-xs font-light text-foreground placeholder:text-muted-foreground/40 outline-none"
                  />
                  <p className="text-[9px] text-muted-foreground/40">POST request with JSON payload. Optional HMAC signing.</p>
                </div>
              )}

              {newOutputType === "discord" && (
                <div className="space-y-1.5">
                  <label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Discord Webhook URL</label>
                  <input
                    value={newOutputDiscordWebhook}
                    onChange={e => setNewOutputDiscordWebhook(e.target.value)}
                    placeholder="https://discord.com/api/webhooks/..."
                    className="w-full rounded-lg border border-border/20 bg-card/20 px-3 py-2 text-xs font-light text-foreground placeholder:text-muted-foreground/40 outline-none"
                  />
                  <p className="text-[9px] text-muted-foreground/40">Create a webhook in Discord: Channel Settings → Integrations → Webhooks.</p>
                </div>
              )}

              {newOutputType === "telegram" && (
                <div className="space-y-1.5">
                  <label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Telegram Chat ID</label>
                  <input
                    value={newOutputTelegramChatId}
                    onChange={e => setNewOutputTelegramChatId(e.target.value)}
                    placeholder="-1001234567890 or @channelname"
                    className="w-full rounded-lg border border-border/20 bg-card/20 px-3 py-2 text-xs font-light text-foreground placeholder:text-muted-foreground/40 outline-none"
                  />
                  <p className="text-[9px] text-muted-foreground/40">Requires Telegram connection. Use @userinfobot to find your chat ID.</p>
                </div>
              )}

              {newOutputType === "whatsapp" && (
                <div className="space-y-1.5">
                  <label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">WhatsApp Phone Number</label>
                  <input
                    value={newOutputPhone}
                    onChange={e => setNewOutputPhone(e.target.value)}
                    placeholder="+15551234567"
                    className="w-full rounded-lg border border-border/20 bg-card/20 px-3 py-2 text-xs font-light text-foreground placeholder:text-muted-foreground/40 outline-none"
                  />
                  <p className="text-[9px] text-muted-foreground/40">Requires Twilio + WhatsApp Business. Include country code.</p>
                </div>
              )}

              {newOutputType === "database" && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-muted-foreground/60">Output will be stored in the database audit log. No external delivery needed.</p>
                </div>
              )}
            </div>

            <div className="space-y-2 rounded-lg border border-border/20 bg-card/10 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Run policy</p>
              <label className="flex items-center gap-2 text-xs font-light text-foreground/80">
                <input type="checkbox" checked={newRetryOnFailure} onChange={e => setNewRetryOnFailure(e.target.checked)} className="accent-accent" />
                Retry a failed step with exponential backoff
              </label>
              {newRetryOnFailure && (
                <label className="flex items-center gap-2 text-xs font-light text-muted-foreground/80">
                  Max retries
                  <input
                    type="number" min={0} max={5} value={newMaxRetries}
                    onChange={e => setNewMaxRetries(Math.max(0, Math.min(5, Number(e.target.value) || 0)))}
                    className="w-14 rounded-md border border-border/20 bg-card/20 px-2 py-1 text-xs outline-none"
                  />
                </label>
              )}
              <label className="flex items-center gap-2 text-xs font-light text-foreground/80">
                <input type="checkbox" checked={newRequireApproval} onChange={e => setNewRequireApproval(e.target.checked)} className="accent-accent" />
                Hold for my approval before delivery
              </label>
              <p className="text-[9px] text-muted-foreground/40">
                Permanent errors (bad credentials, missing recipient) are not retried. A step with no runner bound is reported as skipped, never as success.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowCreate(false)}
                className="rounded-lg border border-border/30 bg-card/20 px-4 py-2 text-xs font-light text-muted-foreground hover:bg-card/40 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createAgent}
                disabled={!newName.trim() || creating}
                className="flex items-center gap-2 rounded-lg bg-accent text-accent-foreground px-4 py-2 text-xs font-light hover:bg-accent/90 transition-all disabled:opacity-50"
              >
                {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                Create Agent
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Logs Dialog */}
        <Dialog open={showLogs} onOpenChange={setShowLogs}>
          <DialogContent className="sm:max-w-2xl bg-card border-border/30 backdrop-blur-xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="text-sm font-light tracking-wide text-foreground flex items-center gap-2">
                <FileText className="h-4 w-4 text-accent" />
                {logsAgent?.name} — Execution Logs
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh]">
              {logsLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : logsData.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-xs text-muted-foreground/60">No executions yet</p>
                </div>
              ) : (
                <div className="space-y-2 p-1">
                  {logsData.map(exec => {
                    const results = exec.results as any;
                    const outputPreview = results?.output || results?.actions?.map((a: any) => a.output).join('\n').substring(0, 500);
                    return (
                      <div key={exec.id} className="rounded-lg border border-border/10 bg-card/10 p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {exec.status === "success" ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                            ) : exec.status === "failed" ? (
                              <XCircle className="h-3.5 w-3.5 text-red-400" />
                            ) : exec.status === "partial" ? (
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                            ) : exec.status === "awaiting_approval" ? (
                              <Pause className="h-3.5 w-3.5 text-sky-400" />
                            ) : (
                              <Loader2 className="h-3.5 w-3.5 text-amber-400 animate-spin" />
                            )}
                            <span className={`text-xs font-light capitalize ${exec.status === "failed" ? "text-red-400" : exec.status === "partial" ? "text-amber-400" : "text-foreground"}`}>
                              {exec.status.replace(/_/g, " ")}
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground/50">{new Date(exec.created_at).toLocaleString()}</span>
                        </div>
                        {exec.duration && (
                          <p className="text-[10px] text-muted-foreground/60">Duration: {(exec.duration / 1000).toFixed(1)}s</p>
                        )}
                        {exec.error && (
                          <p className="text-[10px] text-red-400/80 mt-1">{exec.error}</p>
                        )}
                        {Array.isArray(results?.actions) && results.actions.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {results.actions.map((st: any, i: number) => (
                              <div key={i} className="flex items-center gap-2 text-[10px]">
                                <span className={
                                  st.status === "success" ? "text-emerald-400"
                                    : st.status === "failed" ? "text-red-400" : "text-amber-400"
                                }>
                                  {st.status === "success" ? "✓" : st.status === "failed" ? "✕" : "–"}
                                </span>
                                <span className="text-foreground/80">{st.type}</span>
                                {st.organ && <span className="text-muted-foreground/50">via {st.organ}</span>}
                                {st.attempts > 1 && <span className="text-amber-400/80">{st.attempts} attempts</span>}
                                {typeof st.durationMs === "number" && st.durationMs > 0 && (
                                  <span className="text-muted-foreground/40">{(st.durationMs / 1000).toFixed(1)}s</span>
                                )}
                                {st.error && <span className="truncate text-red-400/70">{st.error}</span>}
                                {st.status === "skipped" && !st.error && (
                                  <span className="truncate text-muted-foreground/50">{st.output}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {outputPreview && (
                          <div className="mt-2 rounded-md border border-border/10 bg-background/30 p-2 max-h-40 overflow-y-auto">
                            <p className="text-[10px] text-muted-foreground/70 whitespace-pre-wrap leading-relaxed">{outputPreview}</p>
                          </div>
                        )}
                        {exec.status === "awaiting_approval" && (
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-[10px] text-sky-400/80">Nothing has been sent yet.</span>
                            <button
                              onClick={() => decideRun(exec, true)}
                              disabled={decidingId === exec.id}
                              className="rounded-md border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-[10px] text-emerald-300 hover:bg-emerald-400/20 disabled:opacity-50"
                            >
                              {decidingId === exec.id ? "Working…" : "Approve & deliver"}
                            </button>
                            <button
                              onClick={() => decideRun(exec, false)}
                              disabled={decidingId === exec.id}
                              className="rounded-md border border-red-400/30 bg-red-400/10 px-2 py-1 text-[10px] text-red-300 hover:bg-red-400/20 disabled:opacity-50"
                            >
                              Hold
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>
    </ScrollArea>
  );
};

// Agent Card Component
const AgentCard = ({
  agent, viewMode, isRunning, onToggle, onDelete, onRunNow, onViewLogs,
}: {
  agent: AutomatedAgent;
  viewMode: "grid" | "list";
  isRunning?: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onRunNow: () => void;
  onViewLogs: () => void;
}) => {
  const isActive = agent.status === "active";
  const OutputIcon = OUTPUT_ICONS[agent.output_type] || Mail;
  const successRate = agent.total_runs > 0 ? Math.round((agent.successful_runs / agent.total_runs) * 100) : 100;
  const triggerLabel = agent.trigger_type === "schedule"
    ? `${(agent.trigger_config as any)?.schedule?.frequency || "daily"} at ${(agent.trigger_config as any)?.schedule?.time || "07:00"}`
    : agent.trigger_type;

  if (viewMode === "list") {
    return (
      <div className="flex items-center gap-4 rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-3 hover:bg-card/30 transition-colors">
        <div className={`rounded-lg p-2 ${isActive ? "bg-emerald-400/10" : "bg-amber-400/10"}`}>
          <OutputIcon className={`h-4 w-4 ${isActive ? "text-emerald-400" : "text-amber-400"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-xs font-light text-foreground truncate">{agent.name}</p>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${isActive ? "bg-emerald-400/10 text-emerald-400" : "bg-amber-400/10 text-amber-400"}`}>
              {isActive ? "Active" : "Paused"}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground/50 capitalize">{triggerLabel} · {agent.total_runs} runs · {successRate}% success</p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onRunNow} disabled={isRunning} className="p-1.5 rounded-lg hover:bg-foreground/10 transition-colors disabled:opacity-50" title="Run now">
            {isRunning ? <Loader2 className="h-3 w-3 text-accent animate-spin" /> : <Play className="h-3 w-3 text-muted-foreground" />}
          </button>
          <button onClick={onViewLogs} className="p-1.5 rounded-lg hover:bg-foreground/10 transition-colors" title="View logs">
            <FileText className="h-3 w-3 text-muted-foreground" />
          </button>
          <button onClick={onToggle} className="p-1.5 rounded-lg hover:bg-foreground/10 transition-colors" title={isActive ? "Pause" : "Resume"}>
            {isActive ? <Pause className="h-3 w-3 text-muted-foreground" /> : <Power className="h-3 w-3 text-muted-foreground" />}
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors" title="Delete">
            <Trash2 className="h-3 w-3 text-red-400/60" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4 hover:bg-card/30 transition-colors group">
      <div className="flex items-start justify-between mb-3">
        <div className={`rounded-lg p-2 ${isActive ? "bg-emerald-400/10" : "bg-amber-400/10"}`}>
          <OutputIcon className={`h-4 w-4 ${isActive ? "text-emerald-400" : "text-amber-400"}`} />
        </div>
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${isActive ? "bg-emerald-400/10 text-emerald-400" : "bg-amber-400/10 text-amber-400"}`}>
          {isActive ? "🟢 Active" : "⏸ Paused"}
        </span>
      </div>

      <h4 className="text-xs font-light text-foreground mb-1">{agent.name}</h4>
      {agent.description && (
        <p className="text-[10px] text-muted-foreground/50 mb-3 line-clamp-2">{agent.description}</p>
      )}

      <div className="space-y-1 mb-3">
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
          <Clock className="h-3 w-3" />
          <span className="capitalize">{triggerLabel}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
          <Activity className="h-3 w-3" />
          <span>Last run: {formatTimeAgo(agent.last_run)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
          <CheckCircle2 className="h-3 w-3" />
          <span>{agent.total_runs} runs · {successRate}% success</span>
        </div>
      </div>

      <div className="flex items-center gap-1 pt-2 border-t border-border/10">
        <button onClick={onRunNow} disabled={isRunning} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] text-muted-foreground hover:bg-foreground/10 transition-colors disabled:opacity-50" title="Run now">
          {isRunning ? <Loader2 className="h-3 w-3 animate-spin text-accent" /> : <Play className="h-3 w-3" />} {isRunning ? "Running..." : "Run"}
        </button>
        <button onClick={onViewLogs} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] text-muted-foreground hover:bg-foreground/10 transition-colors" title="View logs">
          <FileText className="h-3 w-3" /> Logs
        </button>
        <div className="flex-1" />
        <button onClick={onToggle} className="p-1.5 rounded-lg hover:bg-foreground/10 transition-colors">
          {isActive ? <Pause className="h-3 w-3 text-muted-foreground" /> : <Power className="h-3 w-3 text-muted-foreground" />}
        </button>
        <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors">
          <Trash2 className="h-3 w-3 text-red-400/60" />
        </button>
      </div>
    </div>
  );
};

export default AgentsView;
