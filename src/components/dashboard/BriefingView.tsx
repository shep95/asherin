import { useState, useEffect, useCallback } from "react";
import { Newspaper, Plus, X, Clock, RefreshCw, Loader2, AlertTriangle, CheckCircle, Eye, Trash2, Settings2, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";

interface BriefingProfile {
  id?: string;
  industry: string;
  company_name: string;
  competitors: string[];
  key_markets: string[];
  technology_stack: string[];
  investment_interests: string[];
  tracked_people: string[];
  regulatory_bodies: string[];
  custom_topics: string[];
  delivery_time: string;
  enabled: boolean;
}

interface BriefingReport {
  id: string;
  title: string;
  content: string;
  sources_checked: number;
  critical_items: number;
  significant_items: number;
  monitoring_items: number;
  created_at: string;
}

const emptyProfile: BriefingProfile = {
  industry: "",
  company_name: "",
  competitors: [],
  key_markets: [],
  technology_stack: [],
  investment_interests: [],
  tracked_people: [],
  regulatory_bodies: [],
  custom_topics: [],
  delivery_time: "08:00",
  enabled: true,
};

const TagInput = ({ label, tags, onAdd, onRemove, placeholder }: { label: string; tags: string[]; onAdd: (v: string) => void; onRemove: (i: number) => void; placeholder: string }) => {
  const [input, setInput] = useState("");
  const handleKey = (e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === ",") && input.trim()) {
      e.preventDefault();
      onAdd(input.trim());
      setInput("");
    }
  };
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-light tracking-wide text-muted-foreground uppercase">{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {tags.map((t, i) => (
          <span key={i} className="inline-flex items-center gap-1 rounded-lg bg-foreground/10 px-2.5 py-1 text-[11px] text-foreground">
            {t}
            <button onClick={() => onRemove(i)} className="text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
          </span>
        ))}
      </div>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKey}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border/20 bg-card/20 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-accent/30"
      />
    </div>
  );
};

const BriefingView = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<BriefingProfile>(emptyProfile);
  const [reports, setReports] = useState<BriefingReport[]>([]);
  const [activeReport, setActiveReport] = useState<BriefingReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [profileRes, reportsRes] = await Promise.all([
      supabase.from("briefing_profiles").select("*").eq("user_id", user.id).single(),
      supabase.from("briefing_reports").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
    ]);
    if (profileRes.data) {
      setProfile({
        id: profileRes.data.id,
        industry: profileRes.data.industry || "",
        company_name: profileRes.data.company_name || "",
        competitors: profileRes.data.competitors || [],
        key_markets: profileRes.data.key_markets || [],
        technology_stack: profileRes.data.technology_stack || [],
        investment_interests: profileRes.data.investment_interests || [],
        tracked_people: profileRes.data.tracked_people || [],
        regulatory_bodies: profileRes.data.regulatory_bodies || [],
        custom_topics: profileRes.data.custom_topics || [],
        delivery_time: profileRes.data.delivery_time || "08:00",
        enabled: profileRes.data.enabled ?? true,
      });
      setHasProfile(true);
    } else {
      setShowSetup(true);
    }
    if (reportsRes.data) {
      setReports(reportsRes.data as BriefingReport[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const payload = {
      user_id: user.id,
      industry: profile.industry,
      company_name: profile.company_name,
      competitors: profile.competitors,
      key_markets: profile.key_markets,
      technology_stack: profile.technology_stack,
      investment_interests: profile.investment_interests,
      tracked_people: profile.tracked_people,
      regulatory_bodies: profile.regulatory_bodies,
      custom_topics: profile.custom_topics,
      delivery_time: profile.delivery_time,
      enabled: profile.enabled,
    };
    if (hasProfile) {
      await supabase.from("briefing_profiles").update(payload).eq("user_id", user.id);
    } else {
      await supabase.from("briefing_profiles").insert(payload);
      setHasProfile(true);
    }
    setSaving(false);
    setShowSetup(false);
    toast({ title: "Profile saved", description: "Your intelligence briefing profile has been updated." });
  };

  const generateBriefing = async () => {
    if (!user) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-briefing");
      if (error) throw error;
      if (data?.briefing) {
        toast({ title: "Briefing generated", description: `${data.sources_checked} sources analyzed.` });
        await loadData();
        if (data.report_id) {
          const newReport = reports.find(r => r.id === data.report_id) || {
            id: data.report_id,
            title: `Morning Brief — ${new Date().toLocaleDateString()}`,
            content: data.briefing,
            sources_checked: data.sources_checked,
            critical_items: 0,
            significant_items: 0,
            monitoring_items: 0,
            created_at: new Date().toISOString(),
          };
          setActiveReport(newReport as BriefingReport);
        }
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setGenerating(false);
  };

  const deleteReport = async (id: string) => {
    await supabase.from("briefing_reports").delete().eq("id", id);
    setReports(prev => prev.filter(r => r.id !== id));
    if (activeReport?.id === id) setActiveReport(null);
  };

  const addTag = (field: keyof BriefingProfile, value: string) => {
    setProfile(prev => ({ ...prev, [field]: [...(prev[field] as string[]), value] }));
  };

  const removeTag = (field: keyof BriefingProfile, index: number) => {
    setProfile(prev => ({ ...prev, [field]: (prev[field] as string[]).filter((_, i) => i !== index) }));
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
      </div>
    );
  }

  // Show active report
  if (activeReport) {
    return (
      <div className="flex flex-1 flex-col h-full">
        <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-border/20">
          <button onClick={() => setActiveReport(null)} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
            ← Back to Briefings
          </button>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>{activeReport.sources_checked} sources</span>
            <span>•</span>
            <span>{new Date(activeReport.created_at).toLocaleString()}</span>
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="max-w-3xl mx-auto p-6">
            <div className="prose prose-invert prose-sm max-w-none [&_h1]:text-lg [&_h1]:font-extralight [&_h1]:tracking-wide [&_h2]:text-sm [&_h2]:font-light [&_h2]:mt-6 [&_h2]:mb-3 [&_p]:text-xs [&_p]:font-extralight [&_p]:leading-relaxed [&_p]:text-foreground/80 [&_li]:text-xs [&_li]:font-extralight [&_a]:text-accent [&_a]:no-underline hover:[&_a]:underline [&_hr]:border-border/20">
              <ReactMarkdown>{activeReport.content}</ReactMarkdown>
            </div>
          </div>
        </ScrollArea>
      </div>
    );
  }

  // Setup / Onboarding
  if (showSetup || !hasProfile) {
    return (
      <div className="flex flex-1 flex-col h-full">
        <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-border/20">
          <div className="flex items-center gap-2">
            <Newspaper className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-light tracking-wide text-foreground">Intelligence Briefing — Setup</h2>
          </div>
          {hasProfile && (
            <button onClick={() => setShowSetup(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
          )}
        </div>
        <ScrollArea className="flex-1">
          <div className="max-w-2xl mx-auto p-6 space-y-5">
            <p className="text-xs font-extralight text-muted-foreground leading-relaxed">
              Configure your intelligence profile. Aureon will search across public sources daily to deliver a personalized briefing tailored to your business.
            </p>

            <div className="space-y-1.5">
              <label className="text-[11px] font-light tracking-wide text-muted-foreground uppercase">Your Company Name</label>
              <input value={profile.company_name} onChange={(e) => setProfile(p => ({ ...p, company_name: e.target.value }))} placeholder="e.g. Acme Corp"
                className="w-full rounded-lg border border-border/20 bg-card/20 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-accent/30" />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-light tracking-wide text-muted-foreground uppercase">Industry</label>
              <input value={profile.industry} onChange={(e) => setProfile(p => ({ ...p, industry: e.target.value }))} placeholder="e.g. AI/ML, Fintech, Healthcare"
                className="w-full rounded-lg border border-border/20 bg-card/20 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-accent/30" />
            </div>

            <TagInput label="Competitors (press Enter to add)" tags={profile.competitors} onAdd={(v) => addTag("competitors", v)} onRemove={(i) => removeTag("competitors", i)} placeholder="e.g. OpenAI, Anthropic" />
            <TagInput label="Key Markets" tags={profile.key_markets} onAdd={(v) => addTag("key_markets", v)} onRemove={(i) => removeTag("key_markets", i)} placeholder="e.g. North America, EU" />
            <TagInput label="Technology Stack" tags={profile.technology_stack} onAdd={(v) => addTag("technology_stack", v)} onRemove={(i) => removeTag("technology_stack", i)} placeholder="e.g. React, Python, AWS" />
            <TagInput label="Investment Interests" tags={profile.investment_interests} onAdd={(v) => addTag("investment_interests", v)} onRemove={(i) => removeTag("investment_interests", i)} placeholder="e.g. AI startups, Climate tech" />
            <TagInput label="People to Track" tags={profile.tracked_people} onAdd={(v) => addTag("tracked_people", v)} onRemove={(i) => removeTag("tracked_people", i)} placeholder="e.g. Sam Altman, Elon Musk" />
            <TagInput label="Regulatory Bodies" tags={profile.regulatory_bodies} onAdd={(v) => addTag("regulatory_bodies", v)} onRemove={(i) => removeTag("regulatory_bodies", i)} placeholder="e.g. FTC, SEC, EU AI Act" />
            <TagInput label="Custom Topics" tags={profile.custom_topics} onAdd={(v) => addTag("custom_topics", v)} onRemove={(i) => removeTag("custom_topics", i)} placeholder="e.g. Quantum computing, Space tech" />

            <div className="space-y-1.5">
              <label className="text-[11px] font-light tracking-wide text-muted-foreground uppercase">Preferred Delivery Time</label>
              <input type="time" value={profile.delivery_time} onChange={(e) => setProfile(p => ({ ...p, delivery_time: e.target.value }))}
                className="rounded-lg border border-border/20 bg-card/20 px-3 py-2 text-xs text-foreground outline-none focus:border-accent/30" />
            </div>

            <button onClick={saveProfile} disabled={saving || !profile.industry}
              className="w-full rounded-xl bg-accent text-accent-foreground py-3 text-xs font-light tracking-wide hover:bg-accent/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
              {hasProfile ? "Update Profile" : "Save & Activate Briefings"}
            </button>
          </div>
        </ScrollArea>
      </div>
    );
  }

  // Main view - list of reports
  return (
    <div className="flex flex-1 flex-col h-full">
      <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-border/20">
        <div className="flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-light tracking-wide text-foreground">Intelligence Briefings</h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSetup(true)} className="rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors" title="Edit profile">
            <Settings2 className="h-4 w-4" />
          </button>
          <button onClick={generateBriefing} disabled={generating}
            className="flex items-center gap-2 rounded-xl bg-accent text-accent-foreground px-4 py-2 text-xs font-light hover:bg-accent/90 transition-all disabled:opacity-50">
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {generating ? "Generating…" : "Generate Now"}
          </button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="max-w-3xl mx-auto p-6 space-y-4">
          {/* Profile summary */}
          <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-light text-foreground">Tracking Profile</p>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                Daily at {profile.delivery_time}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {profile.company_name && <span className="rounded-lg bg-accent/10 border border-accent/20 px-2 py-0.5 text-[10px] text-accent">{profile.company_name}</span>}
              {profile.industry && <span className="rounded-lg bg-foreground/5 px-2 py-0.5 text-[10px] text-muted-foreground">{profile.industry}</span>}
              {profile.competitors.map((c, i) => <span key={i} className="rounded-lg bg-foreground/5 px-2 py-0.5 text-[10px] text-muted-foreground">{c}</span>)}
              {profile.custom_topics.map((c, i) => <span key={i} className="rounded-lg bg-foreground/5 px-2 py-0.5 text-[10px] text-muted-foreground">{c}</span>)}
            </div>
          </div>

          {/* Reports list */}
          {reports.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <Newspaper className="h-10 w-10 text-muted-foreground/30 mx-auto" />
              <p className="text-sm font-extralight text-muted-foreground">No briefings generated yet.</p>
              <p className="text-xs font-extralight text-muted-foreground/60">Click "Generate Now" to create your first intelligence briefing.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {reports.map((report) => (
                <div key={report.id}
                  className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4 hover:bg-foreground/5 transition-colors cursor-pointer group"
                  onClick={() => setActiveReport(report)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-light text-foreground">{report.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {report.sources_checked} sources • {new Date(report.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {report.critical_items > 0 && (
                        <span className="flex items-center gap-1 text-[10px] text-destructive">
                          <AlertTriangle className="h-3 w-3" />
                          {report.critical_items}
                        </span>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); deleteReport(report.id); }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-destructive transition-all">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default BriefingView;
