import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toDisplayUrl, signPath } from "@/lib/storageSignedUrl";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import MessageQueuePanel, { type QueueItem } from "@/components/dashboard/MessageQueuePanel";
import {
  Send,
  Upload,
  ImagePlus,
  History,
  Wand2,
  Download,
  GitBranch,
  ChevronRight,
  Loader2,
  Plus,
  Trash2,
  RotateCcw,
  X,
  ZoomIn,
  ZoomOut,
  HelpCircle,
  Pencil,
  Check,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────
interface VibeProject {
  id: string;
  name: string;
  template: string | null;
  created_at: string;
  updated_at: string;
}

interface VibeVersion {
  id: string;
  project_id: string;
  parent_id: string | null;
  version_number: number;
  prompt: string;
  image_url: string;
  style_preset: string | null;
  is_uploaded: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  versionId?: string;
  clarifyQuestions?: string[];
  clarifyAnswered?: boolean;
}

const TEMPLATES = [
  { id: "photo-edit", label: "Photo Edit", icon: ImagePlus, desc: "Upload & edit photos" },
  { id: "retouch", label: "Retouch", icon: Wand2, desc: "Enhance & retouch" },
  { id: "creative", label: "Creative", icon: Wand2, desc: "Artistic transformations" },
  { id: "free-edit", label: "Free Edit", icon: Wand2, desc: "Start fresh" },
];

// ── Clarify Questions Card ────────────────────────────────────
const ClarifyQuestionsCard = ({
  questions,
  context,
  onSubmit,
}: {
  questions: string[];
  context: string;
  onSubmit: (answers: string[]) => void;
}) => {
  const [answers, setAnswers] = useState<string[]>(questions.map(() => ""));
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const updateAnswer = (i: number, val: string) => {
    setAnswers((prev) => prev.map((a, idx) => (idx === i ? val : a)));
  };

  const allAnswered = answers.every((a) => a.trim().length > 0);

  // Extract context text before numbered questions
  const contextLine = context.split("\n")[0]?.replace(/^[◎◈]\s*/, "") || "";

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.5 text-accent/80">
        <HelpCircle className="h-3.5 w-3.5" />
        <span className="text-[10px] font-medium tracking-wide uppercase">Aureon Needs More Detail</span>
      </div>
      {contextLine && (
        <p className="text-[10px] text-foreground/60 leading-relaxed">{contextLine}</p>
      )}
      <div className="space-y-1.5">
        {questions.map((q, i) => (
          <div key={i} className="rounded-xl border border-border/20 bg-background/40 overflow-hidden">
            <button
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-foreground/5 transition-colors"
            >
              <span className="text-[10px] text-foreground/80 flex-1 pr-2">{q}</span>
              <ChevronRight
                className={`h-3 w-3 text-muted-foreground/50 transition-transform shrink-0 ${openIndex === i ? "rotate-90" : ""}`}
              />
            </button>
            {openIndex === i && (
              <div className="px-3 pb-2.5">
                <input
                  value={answers[i]}
                  onChange={(e) => updateAnswer(i, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (i < questions.length - 1) setOpenIndex(i + 1);
                      else if (allAnswered) onSubmit(answers);
                    }
                  }}
                  placeholder="Type your answer…"
                  autoFocus
                  className="w-full bg-card/50 border border-border/20 rounded-lg px-2.5 py-1.5 text-[10px] text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-accent/30 transition-colors"
                />
                {answers[i].trim() && i < questions.length - 1 && (
                  <button
                    onClick={() => setOpenIndex(i + 1)}
                    className="text-[9px] text-accent/70 hover:text-accent mt-1 transition-colors"
                  >
                    Next →
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <button
        onClick={() => onSubmit(answers)}
        disabled={!allAnswered}
        className="w-full rounded-xl bg-accent/15 hover:bg-accent/25 text-accent text-[10px] font-medium py-2 transition-colors disabled:opacity-30 disabled:cursor-not-allowed border border-accent/10"
      >
        Submit Answers
      </button>
    </div>
  );
};

const VibeImagerView = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [projects, setProjects] = useState<VibeProject[]>([]);
  const [activeProject, setActiveProject] = useState<VibeProject | null>(null);
  const [versions, setVersions] = useState<VibeVersion[]>([]);
  const [activeVersion, setActiveVersion] = useState<VibeVersion | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [imageZoom, setImageZoom] = useState(100);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [queuePaused, setQueuePaused] = useState(false);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const renameProject = async (id: string, newName: string) => {
    if (!newName.trim()) return;
    await supabase.from("vibe_imager_projects").update({ name: newName.trim() }).eq("id", id);
    setProjects((prev) => prev.map((p) => p.id === id ? { ...p, name: newName.trim() } : p));
    if (activeProject?.id === id) setActiveProject((prev) => prev ? { ...prev, name: newName.trim() } : prev);
    setRenamingId(null);
  };

  // ── Load projects ───────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    supabase
      .from("vibe_imager_projects")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .then(({ data }) => { if (data) setProjects(data as VibeProject[]); });
  }, [user]);

  // ── Load versions ───────────────────────────────────────────
  useEffect(() => {
    if (!activeProject) { setVersions([]); setActiveVersion(null); return; }
    supabase
      .from("vibe_imager_versions")
      .select("*")
      .eq("project_id", activeProject.id)
      .order("created_at", { ascending: true })
      .then(async ({ data }) => {
        if (data) {
          const raw = data as VibeVersion[];
          // Rewrite stored image_url -> short-lived signed URL for private bucket.
          const v: VibeVersion[] = await Promise.all(
            raw.map(async (row) => ({
              ...row,
              image_url: await toDisplayUrl(row.image_url, "vibe-imager"),
            })),
          );
          setVersions(v);
          if (v.length > 0) setActiveVersion(v[v.length - 1]);
        }
      });
  }, [activeProject]);

  // ── Load messages ───────────────────────────────────────────
  useEffect(() => {
    if (!activeProject) { setMessages([]); return; }
    supabase
      .from("vibe_imager_messages")
      .select("*")
      .eq("project_id", activeProject.id)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) {
          setMessages(data.map((m: any) => ({
            id: m.id, role: m.role, content: m.content, versionId: m.version_id,
          })));
        }
      });
  }, [activeProject]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Queue processing ────────────────────────────────────────
  useEffect(() => {
    if (queue.length === 0 || isEditing || queuePaused || isProcessingQueue) return;
    processNextInQueue();
  }, [queue, isEditing, queuePaused, isProcessingQueue]);

  const processNextInQueue = async () => {
    if (queue.length === 0 || isProcessingQueue) return;
    setIsProcessingQueue(true);
    const next = queue[0];
    setQueue((prev) => prev.slice(1));
    await processMessage(next.content);
    setIsProcessingQueue(false);
  };

  const processAllQueue = async () => {
    setQueuePaused(false);
  };

  // ── Create project ──────────────────────────────────────────
  const createProject = async (template?: string) => {
    if (!user) return;
    // Ensure we have a fresh session before insert
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast({ title: "Error", description: "Please sign in again", variant: "destructive" }); return; }
    const name = template ? `${template.charAt(0).toUpperCase() + template.slice(1)} Project` : "New Project";
    const { data, error } = await supabase
      .from("vibe_imager_projects")
      .insert({ user_id: session.user.id, name, template: template || null })
      .select().single();
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    const project = data as VibeProject;
    setProjects((prev) => [project, ...prev]);
    setActiveProject(project);
    setMessages([{
      id: crypto.randomUUID(), role: "assistant",
      content: "Welcome to Vibe Imager. Upload an image and describe your edit. I'll ask clarifying questions if I need more detail before transforming it.",
    }]);
    setVersions([]);
    setActiveVersion(null);
  };

  const deleteProject = async (id: string) => {
    await supabase.from("vibe_imager_projects").delete().eq("id", id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (activeProject?.id === id) {
      setActiveProject(null); setVersions([]); setActiveVersion(null); setMessages([]);
    }
  };

  // ── Upload image ────────────────────────────────────────────
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !activeProject) return;

    const ext = file.name.split(".").pop() || "png";
    const path = `${user.id}/${activeProject.id}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from("vibe-imager")
      .upload(path, file, { contentType: file.type });
    if (uploadErr) {
      toast({ title: "Upload failed", description: uploadErr.message, variant: "destructive" });
      return;
    }
    // Bucket is private — sign for immediate display, store the storage path
    // so the row stays valid across sessions (re-signed on each load).
    const signedUrl = (await signPath("vibe-imager", path)) || "";
    const vNum = (activeVersion?.version_number || 0) + 1;

    const { data: version } = await supabase
      .from("vibe_imager_versions")
      .insert({
        project_id: activeProject.id, user_id: user.id,
        parent_id: activeVersion?.id || null, version_number: vNum,
        prompt: "Uploaded image", image_url: path, is_uploaded: true,
      })
      .select().single();

    if (version) {
      const v = version as VibeVersion;
      setVersions((prev) => [...prev, v]);
      setActiveVersion(v);
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "user", content: `◈ Uploaded: ${file.name}`, imageUrl: urlData.publicUrl },
        { id: crypto.randomUUID(), role: "assistant", content: "Image uploaded! Now describe your edit — I'll ask for specifics if needed before applying it." },
      ]);
    }
    e.target.value = "";
  };

  // ── Process a single message (core logic) ───────────────────
  const processMessage = async (instruction: string) => {
    if (!user || !activeProject) return;

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: instruction };
    setMessages((prev) => [...prev, userMsg]);

    await supabase.from("vibe_imager_messages").insert({
      project_id: activeProject.id, user_id: user.id, role: "user", content: instruction,
    });

    setIsEditing(true);

    try {
      // Step 1: Ask Aureon to analyze the request
      const chatHistory = messages.slice(-6).map((m) => ({ role: m.role, content: m.content }));
      const { data: analyzeData, error: analyzeErr } = await supabase.functions.invoke("vibe-imager", {
        body: {
          action: "analyze",
          instruction,
          hasImage: !!activeVersion,
          chatHistory,
        },
      });
      if (analyzeErr) throw analyzeErr;

      const responseType = analyzeData?.type;

      // ── AI needs clarification ──────────────────────────────
      if (responseType === "clarify") {
        const questions: string[] = analyzeData.questions || [];
        const context = analyzeData.context || "";
        const replyText = context
          ? `◎ ${context}\n\n${questions.map((q: string, i: number) => `${i + 1}. ${q}`).join("\n")}`
          : questions.map((q: string, i: number) => `${i + 1}. ${q}`).join("\n");

        const aMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: replyText,
          clarifyQuestions: questions,
        };
        setMessages((prev) => [...prev, aMsg]);
        await supabase.from("vibe_imager_messages").insert({
          project_id: activeProject.id, user_id: user.id, role: "assistant", content: replyText,
        });
        setIsEditing(false);
        return;
      }

      // ── AI says proceed — execute the edit ──────────────────
      if (responseType === "proceed" && activeVersion) {
        const refinedInstruction = analyzeData.instruction || instruction;
        const summary = analyzeData.summary || "";

        if (summary) {
          const infoMsg: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: `◈ ${summary} Applying now…` };
          setMessages((prev) => [...prev, infoMsg]);
        }

        const { data: editData, error: editErr } = await supabase.functions.invoke("vibe-imager", {
          body: {
            action: "edit",
            instruction: refinedInstruction,
            imageUrl: activeVersion.image_url,
            projectId: activeProject.id,
          },
        });
        if (editErr) throw editErr;

        const reply = editData?.reply || "Done!";
        const editedUrl = editData?.editedImageUrl;

        if (editedUrl) {
          const vNum = (activeVersion?.version_number || 0) + 1;
          const { data: version } = await supabase
            .from("vibe_imager_versions")
            .insert({
              project_id: activeProject.id, user_id: user.id,
              parent_id: activeVersion?.id || null, version_number: vNum,
              prompt: refinedInstruction, image_url: editedUrl, is_uploaded: false,
              metadata: { source: "ai-edit" },
            })
            .select().single();

          if (version) {
            const v = version as VibeVersion;
            setVersions((prev) => [...prev, v]);
            setActiveVersion(v);
            const aMsg: ChatMessage = {
              id: crypto.randomUUID(), role: "assistant",
              content: `◉ ${reply}`, imageUrl: editedUrl, versionId: v.id,
            };
            setMessages((prev) => [...prev, aMsg]);
            await supabase.from("vibe_imager_messages").insert({
              project_id: activeProject.id, user_id: user.id,
              role: "assistant", content: aMsg.content, version_id: v.id,
            });
          }
        } else {
          const aMsg: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: reply };
          setMessages((prev) => [...prev, aMsg]);
          await supabase.from("vibe_imager_messages").insert({
            project_id: activeProject.id, user_id: user.id, role: "assistant", content: reply,
          });
        }
        setIsEditing(false);
        return;
      }

      // ── Plain chat response ─────────────────────────────────
      const reply = analyzeData?.reply || analyzeData?.instruction || "I'm ready to help. Upload an image or describe your edit!";
      const aMsg: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: reply };
      setMessages((prev) => [...prev, aMsg]);
      await supabase.from("vibe_imager_messages").insert({
        project_id: activeProject.id, user_id: user.id, role: "assistant", content: reply,
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setIsEditing(false);
  };

  // ── Send message (with queue support) ───────────────────────
  const sendMessage = async () => {
    if (!input.trim() || !activeProject) return;
    const instruction = input.trim();
    setInput("");

    // If AI is currently processing, queue the message
    if (isEditing || isProcessingQueue) {
      setQueue((prev) => [...prev, { id: crypto.randomUUID(), content: instruction }]);
      return;
    }

    await processMessage(instruction);
  };

  // ── Quick answer a clarifying question ──────────────────────
  const handleQuickAnswer = (question: string) => {
    setInput(question);
  };

  const loadVersion = (v: VibeVersion) => setActiveVersion(v);

  const downloadImage = async () => {
    if (!activeVersion) return;
    try {
      const res = await fetch(activeVersion.image_url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vibe-v${activeVersion.version_number}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { toast({ title: "Download failed", variant: "destructive" }); }
  };

  // ── Landing ─────────────────────────────────────────────────
  if (!activeProject) {
    return (
      <div className="relative flex flex-1 flex-col items-center justify-start px-4 py-10 sm:py-16 gap-10 overflow-y-auto">
        {/* Ambient backdrop */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[420px] w-[720px] rounded-full bg-accent/10 blur-3xl" />
          <div className="absolute top-40 left-10 h-64 w-64 rounded-full bg-foreground/5 blur-3xl" />
          <div className="absolute top-20 right-10 h-72 w-72 rounded-full bg-accent/5 blur-3xl" />
        </div>

        {/* Hero */}
        <div className="relative text-center space-y-5 max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/30 bg-card/40 backdrop-blur-md px-3 py-1">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
            </span>
            <span className="text-[9px] font-medium tracking-[0.25em] text-muted-foreground uppercase">Beta · Image Studio</span>
          </div>
          <div className="flex items-center justify-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl bg-accent/20 blur-xl" />
              <div className="relative p-3.5 rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/30 backdrop-blur-md">
                <Wand2 className="h-7 w-7 text-accent" />
              </div>
            </div>
            <h1 className="text-3xl sm:text-5xl font-extralight tracking-[0.18em] bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text text-transparent">
              VIBE IMAGER
            </h1>
          </div>
          <p className="text-sm sm:text-[15px] font-extralight text-muted-foreground/90 max-w-lg mx-auto leading-relaxed">
            Drop an image. Describe the change. Aureon transforms it — every edit branched and versioned.
          </p>
        </div>

        {/* Template grid */}
        <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-3xl">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => createProject(t.id)}
              className="relative flex flex-col items-start gap-3 rounded-2xl border border-border/30 bg-gradient-to-br from-card/60 to-card/20 backdrop-blur-md p-4 hover:border-accent/40 hover:from-card/80 hover:to-accent/5 transition-all duration-300 group overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-accent/0 to-accent/0 group-hover:from-accent/5 group-hover:to-transparent transition-all" />
              <div className="relative p-2 rounded-xl bg-foreground/5 border border-border/20 group-hover:bg-accent/10 group-hover:border-accent/30 transition-colors">
                <t.icon className="h-4 w-4 text-muted-foreground group-hover:text-accent transition-colors" />
              </div>
              <div className="relative space-y-0.5">
                <div className="text-xs font-light tracking-wide text-foreground">{t.label}</div>
                <div className="text-[10px] text-muted-foreground/60 leading-tight">{t.desc}</div>
              </div>
              <ChevronRight className="absolute top-3 right-3 h-3 w-3 text-muted-foreground/30 group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
            </button>
          ))}
        </div>

        <div className="relative flex items-center gap-3 text-[10px] uppercase tracking-[0.3em] text-muted-foreground/40">
          <span className="h-px w-10 bg-border/40" />
          <span>or</span>
          <span className="h-px w-10 bg-border/40" />
        </div>

        <Button onClick={() => createProject()} variant="outline" className="relative gap-2 text-xs font-light rounded-xl px-6 h-10 border-border/40 hover:border-accent/40 hover:bg-accent/5">
          <Plus className="h-3.5 w-3.5" /> Start Blank Project
        </Button>

        {projects.length > 0 && (
          <div className="relative w-full max-w-3xl space-y-3">
            <p className="text-[10px] font-light tracking-[0.2em] text-muted-foreground/50 uppercase px-1">Recent Projects</p>
            <div className="space-y-1 rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-2">
              {projects.slice(0, 6).map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-xl px-3.5 py-2.5 hover:bg-foreground/5 transition-colors group cursor-pointer"
                  onClick={() => renamingId === p.id ? null : setActiveProject(p)}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="p-1.5 rounded-lg bg-muted/30 shrink-0">
                      <ImagePlus className="h-3.5 w-3.5 text-muted-foreground/50" />
                    </div>
                    {renamingId === p.id ? (
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") renameProject(p.id, renameValue); if (e.key === "Escape") setRenamingId(null); }}
                        onBlur={() => renameProject(p.id, renameValue)}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 bg-transparent text-xs font-light text-foreground outline-none border-b border-accent/30"
                      />
                    ) : (
                      <span className="text-xs font-light text-foreground truncate">{p.name}</span>
                    )}
                    <span className="text-[10px] text-muted-foreground/40 shrink-0">
                      {new Date(p.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); setRenamingId(p.id); setRenameValue(p.name); }} className="p-1.5 hover:bg-foreground/10 rounded-lg transition-colors">
                      <Pencil className="h-3 w-3 text-muted-foreground/60" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); deleteProject(p.id); }} className="p-1.5 hover:bg-destructive/10 rounded-lg transition-colors">
                      <Trash2 className="h-3 w-3 text-destructive/60" />
                    </button>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-[9px] text-muted-foreground/30 tracking-wider pb-4">AI-Powered Image Editing • Created By ZANOEM Software</p>
      </div>
    );
  }

  // ── Get last assistant message's clarify questions ───────────
  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant");
  const lastClarifyQuestions = lastAssistantMsg?.clarifyQuestions;

  // ── Editor Layout ───────────────────────────────────────────
  return (
    <div className="flex flex-1 flex-col lg:flex-row h-full overflow-hidden p-2 sm:p-3 gap-2 sm:gap-3 pb-4 sm:pb-5">
      {/* Image Preview Panel */}
      <div className="flex-1 flex flex-col min-h-0 rounded-2xl border border-border/20 bg-card/10 backdrop-blur-md overflow-hidden order-2 lg:order-1">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/10 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <Wand2 className="h-4 w-4 text-accent shrink-0" />
            <span className="text-xs font-light tracking-wider text-foreground/70 hidden sm:inline">VIBE IMAGER</span>
            {activeVersion && (
              <span className="text-[10px] text-muted-foreground/50">
                v{activeVersion.version_number}
                {activeVersion.is_uploaded && " • Original"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => setImageZoom(Math.max(25, imageZoom - 25))} className="h-8 w-8 p-0 rounded-xl" disabled={!activeVersion}>
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <span className="text-[10px] text-muted-foreground/50 w-10 text-center">{imageZoom}%</span>
            <Button size="sm" variant="ghost" onClick={() => setImageZoom(Math.min(300, imageZoom + 25))} className="h-8 w-8 p-0 rounded-xl" disabled={!activeVersion}>
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            {activeVersion && (
              <Button size="sm" variant="ghost" onClick={downloadImage} className="h-8 text-[10px] gap-1 rounded-xl px-2.5">
                <Download className="h-3 w-3" />
                <span className="hidden sm:inline">Export</span>
              </Button>
            )}
          </div>
        </div>

        {/* Image Canvas */}
        <div className="flex-1 relative min-h-0 overflow-auto flex items-center justify-center bg-[hsl(var(--background))] p-4">
          {activeVersion ? (
            <img
              src={activeVersion.image_url}
              alt={`Version ${activeVersion.version_number}`}
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl shadow-black/30 transition-transform duration-200"
              style={{ transform: `scale(${imageZoom / 100})`, transformOrigin: "center" }}
            />
          ) : (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="p-6 rounded-3xl border border-dashed border-border/30 bg-card/20">
                <Upload className="h-10 w-10 text-muted-foreground/30" />
              </div>
              <p className="text-sm font-extralight text-muted-foreground/50">Upload an image to start editing</p>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="gap-2 text-xs rounded-xl"
              >
                <Upload className="h-3.5 w-3.5" /> Choose Image
              </Button>
            </div>
          )}
          {isEditing && (
            <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center rounded-b-2xl">
              <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-card/80 border border-border/20 backdrop-blur-md">
                <Loader2 className="h-8 w-8 animate-spin text-accent" />
                <p className="text-sm font-light text-foreground/70">Aureon is analyzing your request…</p>
                <p className="text-[10px] text-muted-foreground/50">This may take a few seconds</p>
              </div>
            </div>
          )}
        </div>

        {/* Version Timeline */}
        {versions.length > 1 && (
          <div className="border-t border-border/10 bg-card/20 px-4 py-3 shrink-0">
            <div className="flex items-center gap-1.5 mb-2">
              <GitBranch className="h-3 w-3 text-muted-foreground/50" />
              <span className="text-[9px] tracking-[0.15em] text-muted-foreground/50 uppercase">Versions</span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {versions.map((v) => (
                <button
                  key={v.id}
                  onClick={() => loadVersion(v)}
                  className={`flex-shrink-0 rounded-xl border transition-all overflow-hidden ${
                    activeVersion?.id === v.id
                      ? "border-accent ring-1 ring-accent/30 shadow-md shadow-accent/10"
                      : "border-border/20 hover:border-foreground/20"
                  }`}
                >
                  <img src={v.image_url} alt={`v${v.version_number}`} className="w-14 h-14 object-cover" />
                  <div className="px-1.5 py-1 text-center">
                    <span className="text-[8px] text-muted-foreground">v{v.version_number}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Chat Panel */}
      <div className="flex flex-col w-full lg:w-96 lg:min-w-[320px] lg:max-w-[420px] h-[45vh] lg:h-auto rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md overflow-hidden shrink-0 order-1 lg:order-2">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/10 shrink-0">
          <button
            onClick={() => { setActiveProject(null); setQueue([]); }}
            className="flex items-center gap-1.5 text-xs font-light text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            Projects
          </button>
          {renamingId === activeProject.id ? (
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") renameProject(activeProject.id, renameValue); if (e.key === "Escape") setRenamingId(null); }}
              onBlur={() => renameProject(activeProject.id, renameValue)}
              className="text-[10px] font-light tracking-wider text-foreground/70 bg-transparent outline-none border-b border-accent/30 max-w-[140px]"
            />
          ) : (
            <button
              onClick={() => { setRenamingId(activeProject.id); setRenameValue(activeProject.name); }}
              className="text-[10px] font-light tracking-wider text-foreground/70 truncate max-w-[140px] hover:text-foreground transition-colors flex items-center gap-1 group/name"
              title="Click to rename"
            >
              {activeProject.name}
              <Pencil className="h-2.5 w-2.5 opacity-0 group-hover/name:opacity-60 transition-opacity" />
            </button>
          )}
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`p-2 rounded-xl transition-colors ${showHistory ? "bg-accent/20 text-accent" : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"}`}
          >
            <History className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-3 sm:p-4 space-y-3">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-xs font-light leading-relaxed ${
                    msg.role === "user"
                      ? "bg-accent/15 text-foreground rounded-br-md"
                      : "bg-foreground/5 text-foreground/90 rounded-bl-md"
                  }`}
                >
                  {msg.clarifyQuestions && !msg.clarifyAnswered ? (
                    <ClarifyQuestionsCard
                      questions={msg.clarifyQuestions}
                      context={msg.content}
                      onSubmit={(answers) => {
                        // Mark this message as answered
                        setMessages((prev) =>
                          prev.map((m) => m.id === msg.id ? { ...m, clarifyAnswered: true } : m)
                        );
                        // Send combined answers as a single message
                        const combined = answers
                          .map((a, i) => `${msg.clarifyQuestions![i]}\n→ ${a}`)
                          .join("\n\n");
                        processMessage(combined);
                      }}
                    />
                  ) : msg.clarifyQuestions && msg.clarifyAnswered ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-accent/60 mb-1">
                        <HelpCircle className="h-3 w-3" />
                        <span className="text-[10px] tracking-wide">Questions answered ✓</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground/50 whitespace-pre-line">{msg.content}</p>
                    </div>
                  ) : (
                    <>
                      {msg.content}
                      {msg.imageUrl && (
                        <img src={msg.imageUrl} alt="" className="mt-2 rounded-xl max-w-full max-h-40 object-cover border border-border/10" />
                      )}
                      {msg.versionId && (
                        <button
                          onClick={() => {
                            const v = versions.find((ver) => ver.id === msg.versionId);
                            if (v) loadVersion(v);
                          }}
                          className="block mt-2 text-[10px] text-accent hover:underline"
                        >
                          View this version →
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
            {isEditing && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 bg-foreground/5 rounded-2xl px-3.5 py-2.5">
                  <Loader2 className="h-3 w-3 animate-spin text-accent" />
                  <span className="text-[10px] text-muted-foreground">Aureon is thinking…</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </ScrollArea>

        {/* Version History Drawer */}
        {showHistory && versions.length > 0 && (
          <div className="border-t border-border/10 max-h-[200px] overflow-y-auto">
            <div className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] tracking-[0.15em] text-muted-foreground/50 uppercase">History</span>
                <button onClick={() => setShowHistory(false)} className="p-1 text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              </div>
              {[...versions].reverse().map((v) => (
                <button
                  key={v.id}
                  onClick={() => { loadVersion(v); setShowHistory(false); }}
                  className={`w-full flex items-center gap-3 rounded-xl p-2 text-left transition-all ${
                    activeVersion?.id === v.id ? "bg-accent/10 border border-accent/20" : "hover:bg-foreground/5 border border-transparent"
                  }`}
                >
                  <img src={v.image_url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium text-foreground">v{v.version_number}</span>
                      <span className="text-[9px] text-muted-foreground/50">
                        {new Date(v.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-[9px] text-muted-foreground/60 truncate">{v.prompt}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message Queue */}
        <MessageQueuePanel
          items={queue}
          onRemove={(id) => setQueue((prev) => prev.filter((q) => q.id !== id))}
          onClear={() => setQueue([])}
          onProcessNow={processAllQueue}
          paused={queuePaused}
          onTogglePause={() => setQueuePaused((p) => !p)}
        />

        {/* Input */}
        <div className="p-3 sm:p-4 border-t border-border/10 shrink-0">
          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isEditing}
              className="p-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors disabled:opacity-40"
              title="Upload image"
            >
              <Upload className="h-4 w-4" />
            </button>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder={isEditing ? "Type to queue next edit…" : activeVersion ? "Describe your edit…" : "Upload an image first…"}
              className="flex-1 min-h-[40px] max-h-[100px] resize-none text-xs bg-transparent border-border/20 focus:border-accent/30 rounded-xl"
              rows={1}
            />
            <Button
              size="sm"
              onClick={sendMessage}
              disabled={!input.trim()}
              className="h-10 w-10 p-0 rounded-xl bg-accent hover:bg-accent/80"
            >
              {isEditing ? <Plus className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
            </Button>
          </div>
          {isEditing && input.trim() && (
            <p className="text-[9px] text-muted-foreground/50 mt-1.5 text-center">Press send to add to queue</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default VibeImagerView;
