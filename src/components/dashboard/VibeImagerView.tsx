import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  Save,
  X,
  Maximize2,
  Minimize2,
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
  versionId?: string;
}

const TEMPLATES = [
  { id: "photo-edit", label: "Photo Edit", icon: ImagePlus, desc: "Upload & edit photos" },
  { id: "design", label: "Design", icon: Wand2, desc: "Create graphics & layouts" },
  { id: "retouch", label: "Retouch", icon: Wand2, desc: "Retouch & enhance" },
  { id: "composite", label: "Composite", icon: Wand2, desc: "Combine multiple images" },
  { id: "social", label: "Social Media", icon: Wand2, desc: "Social media graphics" },
  { id: "free-edit", label: "Free Edit", icon: Wand2, desc: "Open editor blank" },
];

const VibeImagerView = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  // State
  const [projects, setProjects] = useState<VibeProject[]>([]);
  const [activeProject, setActiveProject] = useState<VibeProject | null>(null);
  const [versions, setVersions] = useState<VibeVersion[]>([]);
  const [activeVersion, setActiveVersion] = useState<VibeVersion | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [photopeaReady, setPhotopeaReady] = useState(false);
  const [editorExpanded, setEditorExpanded] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photopeaRef = useRef<HTMLIFrameElement>(null);
  const pendingSaveRef = useRef(false);

  // ── Photopea Communication ──────────────────────────────────
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data === "done") {
        if (!photopeaReady) setPhotopeaReady(true);
        if (pendingSaveRef.current) pendingSaveRef.current = false;
        return;
      }
      if (e.data instanceof ArrayBuffer) {
        handlePhotopeaExport(e.data);
        return;
      }
      if (typeof e.data === "string") {
        try {
          const parsed = JSON.parse(e.data);
          if (parsed.type === "save") saveCurrentImage();
        } catch { /* ignore */ }
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [photopeaReady, activeProject, activeVersion, user]);

  const sendToPhotopea = useCallback((script: string) => {
    if (!photopeaRef.current?.contentWindow) return;
    photopeaRef.current.contentWindow.postMessage(script, "*");
  }, []);

  const sendFileToPhotopea = useCallback((buffer: ArrayBuffer) => {
    if (!photopeaRef.current?.contentWindow) return;
    photopeaRef.current.contentWindow.postMessage(buffer, "*");
  }, []);

  const loadImageInPhotopea = useCallback(async (imageUrl: string) => {
    if (!photopeaRef.current?.contentWindow) return;
    try {
      const response = await fetch(imageUrl);
      const buffer = await response.arrayBuffer();
      sendFileToPhotopea(buffer);
    } catch {
      sendToPhotopea(`app.open("${imageUrl}");`);
    }
  }, [sendFileToPhotopea, sendToPhotopea]);

  const saveCurrentImage = useCallback(() => {
    pendingSaveRef.current = true;
    sendToPhotopea('app.activeDocument.saveToOE("png");');
  }, [sendToPhotopea]);

  const handlePhotopeaExport = useCallback(async (buffer: ArrayBuffer) => {
    if (!user || !activeProject) return;
    setIsSaving(true);
    try {
      const bytes = new Uint8Array(buffer);
      const fileName = `${user.id}/${activeProject.id}/${crypto.randomUUID()}.png`;
      const { error: uploadErr } = await supabase.storage
        .from("vibe-imager")
        .upload(fileName, bytes, { contentType: "image/png", upsert: false });
      if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);
      const { data: urlData } = supabase.storage.from("vibe-imager").getPublicUrl(fileName);
      const versionNumber = (activeVersion?.version_number || 0) + 1;
      const { data: version, error: versionErr } = await supabase
        .from("vibe_imager_versions")
        .insert({
          project_id: activeProject.id,
          user_id: user.id,
          parent_id: activeVersion?.id || null,
          version_number: versionNumber,
          prompt: "Edited in Photopea",
          image_url: urlData.publicUrl,
          is_uploaded: false,
          metadata: { source: "photopea" },
        })
        .select()
        .single();
      if (versionErr) throw new Error(versionErr.message);
      const v = version as VibeVersion;
      setVersions((prev) => [...prev, v]);
      setActiveVersion(v);
      const saveMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `✅ Saved as v${versionNumber}. Your edits are versioned — you can always go back.`,
        versionId: v.id,
      };
      setMessages((prev) => [...prev, saveMsg]);
      await supabase.from("vibe_imager_messages").insert({
        project_id: activeProject.id,
        user_id: user.id,
        role: "assistant",
        content: saveMsg.content,
        version_id: v.id,
      });
      toast({ title: "Saved", description: `Version ${versionNumber} saved` });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    }
    setIsSaving(false);
  }, [user, activeProject, activeVersion, toast]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("vibe_imager_projects")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });
      if (data) setProjects(data as VibeProject[]);
    };
    load();
  }, [user]);

  useEffect(() => {
    if (!activeProject) { setVersions([]); setActiveVersion(null); return; }
    const load = async () => {
      const { data } = await supabase
        .from("vibe_imager_versions")
        .select("*")
        .eq("project_id", activeProject.id)
        .order("created_at", { ascending: true });
      if (data) {
        const v = data as VibeVersion[];
        setVersions(v);
        if (v.length > 0) setActiveVersion(v[v.length - 1]);
      }
    };
    load();
  }, [activeProject]);

  useEffect(() => {
    if (!activeProject) { setMessages([]); return; }
    const load = async () => {
      const { data } = await supabase
        .from("vibe_imager_messages")
        .select("*")
        .eq("project_id", activeProject.id)
        .order("created_at", { ascending: true });
      if (data) {
        setMessages(data.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          versionId: m.version_id,
        })));
      }
    };
    load();
  }, [activeProject]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (activeVersion && photopeaReady) loadImageInPhotopea(activeVersion.image_url);
  }, [activeVersion?.id, photopeaReady]);

  const buildPhotopeaUrl = useCallback((imageUrl?: string) => {
    const config: Record<string, unknown> = {
      environment: {
        customIO: {
          save: 'app.echoToOE(JSON.stringify({type:"save"}));',
        },
      },
    };
    if (imageUrl) config.files = [imageUrl];
    return `https://www.photopea.com#${encodeURIComponent(JSON.stringify(config))}`;
  }, []);

  const createProject = async (template?: string) => {
    if (!user) return;
    const name = template
      ? `${template.charAt(0).toUpperCase() + template.slice(1)} Project`
      : "New Project";
    const { data, error } = await supabase
      .from("vibe_imager_projects")
      .insert({ user_id: user.id, name, template: template || null })
      .select()
      .single();
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    const project = data as VibeProject;
    setProjects((prev) => [project, ...prev]);
    setActiveProject(project);
    setMessages([]);
    setVersions([]);
    setActiveVersion(null);
    setPhotopeaReady(false);
    setMessages([{
      id: crypto.randomUUID(),
      role: "assistant",
      content: `Welcome to Vibe Imager! 🎨 Upload an image to start editing in the built-in Photopea editor. I can also help you with AI-powered suggestions for edits, effects, and techniques.`,
    }]);
  };

  const deleteProject = async (id: string) => {
    await supabase.from("vibe_imager_projects").delete().eq("id", id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (activeProject?.id === id) {
      setActiveProject(null);
      setVersions([]);
      setActiveVersion(null);
      setMessages([]);
    }
  };

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
    const { data: urlData } = supabase.storage.from("vibe-imager").getPublicUrl(path);
    const { data: version } = await supabase
      .from("vibe_imager_versions")
      .insert({
        project_id: activeProject.id,
        user_id: user.id,
        parent_id: activeVersion?.id || null,
        version_number: (activeVersion?.version_number || 0) + 1,
        prompt: "Uploaded image",
        image_url: urlData.publicUrl,
        is_uploaded: true,
      })
      .select()
      .single();
    if (version) {
      const v = version as VibeVersion;
      setVersions((prev) => [...prev, v]);
      setActiveVersion(v);
      if (photopeaReady) loadImageInPhotopea(urlData.publicUrl);
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "user", content: `📷 Uploaded: ${file.name}` },
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Image loaded in the editor! Edit directly in Photopea, then click **💾 Save Version** to create a new version. Ask me for editing tips anytime.",
          versionId: v.id,
        },
      ]);
    }
    e.target.value = "";
  };

  const sendMessage = async () => {
    if (!input.trim() || !user || !activeProject || isChatting) return;
    const content = input.trim();
    setInput("");
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content };
    setMessages((prev) => [...prev, userMsg]);
    await supabase.from("vibe_imager_messages").insert({
      project_id: activeProject.id,
      user_id: user.id,
      role: "user",
      content,
    });
    setIsChatting(true);
    try {
      const chatHistory = messages.slice(-10).map((m) => ({ role: m.role, content: m.content }));
      chatHistory.push({ role: "user", content });
      const { data: chatData, error: chatErr } = await supabase.functions.invoke("vibe-imager", {
        body: {
          action: "chat",
          messages: chatHistory,
          projectId: activeProject.id,
          currentImageUrl: activeVersion?.image_url || null,
        },
      });
      if (chatErr) throw chatErr;
      const reply = chatData?.reply || "I can help you with editing tips! Try asking about specific techniques.";
      const scriptMatch = reply.match(/\[SCRIPT:\s*(.*?)\]/s);
      if (scriptMatch && photopeaReady) sendToPhotopea(scriptMatch[1]);
      const cleanReply = reply.replace(/\[SCRIPT:.*?\]/s, "").trim();
      const assistantMsg: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: cleanReply };
      setMessages((prev) => [...prev, assistantMsg]);
      await supabase.from("vibe_imager_messages").insert({
        project_id: activeProject.id,
        user_id: user.id,
        role: "assistant",
        content: cleanReply,
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setIsChatting(false);
  };

  const loadVersion = (v: VibeVersion) => {
    setActiveVersion(v);
    if (photopeaReady) loadImageInPhotopea(v.image_url);
  };

  const downloadImage = async () => {
    if (!activeVersion) return;
    try {
      const res = await fetch(activeVersion.image_url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vibe-imager-v${activeVersion.version_number}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { toast({ title: "Download failed", variant: "destructive" }); }
  };

  const quickScripts = [
    { label: "🔄 Flip H", script: 'app.activeDocument.flipCanvas("horizontal");' },
    { label: "🔃 Flip V", script: 'app.activeDocument.flipCanvas("vertical");' },
    { label: "↩️ Rotate", script: "app.activeDocument.rotateCanvas(90);" },
    { label: "🎨 Desat", script: 'app.activeDocument.activeLayer.adjustments.desaturate();' },
    { label: "✨ Levels", script: 'app.activeDocument.activeLayer.adjustments.levels();' },
    { label: "📐 Flatten", script: "app.activeDocument.flattenImage();" },
  ];

  // ── Landing (no project) ────────────────────────────────────
  if (!activeProject) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:py-12 gap-8 overflow-y-auto">
        <div className="text-center space-y-3 max-w-lg">
          <div className="flex items-center justify-center gap-3">
            <div className="p-3 rounded-2xl bg-accent/10 border border-accent/20">
              <Wand2 className="h-7 w-7 text-accent" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extralight tracking-[0.15em] text-foreground">VIBE IMAGER</h1>
          </div>
          <p className="text-sm font-extralight text-muted-foreground max-w-md mx-auto leading-relaxed">
            Upload images, edit with a full Photoshop-class editor powered by Photopea, iterate with AI assistance, and track every version.
          </p>
        </div>

        {/* Templates */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full max-w-lg">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => createProject(t.id)}
              className="flex flex-col items-center gap-2.5 rounded-2xl border border-border/30 bg-card/40 backdrop-blur-md p-5 hover:bg-card/60 hover:border-accent/30 hover:shadow-lg hover:shadow-accent/5 transition-all duration-200 group"
            >
              <div className="p-2.5 rounded-xl bg-muted/50 group-hover:bg-accent/10 transition-colors">
                <t.icon className="h-5 w-5 text-muted-foreground group-hover:text-accent transition-colors" />
              </div>
              <span className="text-xs font-light text-foreground">{t.label}</span>
              <span className="text-[10px] text-muted-foreground/60 leading-tight text-center">{t.desc}</span>
            </button>
          ))}
        </div>

        <Button onClick={() => createProject()} variant="outline" className="gap-2 text-xs font-light rounded-xl px-5 h-10">
          <Plus className="h-3.5 w-3.5" /> Blank Project
        </Button>

        {/* Recent projects */}
        {projects.length > 0 && (
          <div className="w-full max-w-lg space-y-3">
            <p className="text-[10px] font-light tracking-[0.2em] text-muted-foreground/50 uppercase px-1">Recent Projects</p>
            <div className="space-y-1 rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-2">
              {projects.slice(0, 6).map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-xl px-3.5 py-2.5 hover:bg-foreground/5 transition-colors group cursor-pointer"
                  onClick={() => setActiveProject(p)}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-1.5 rounded-lg bg-muted/30">
                      <ImagePlus className="h-3.5 w-3.5 text-muted-foreground/50" />
                    </div>
                    <span className="text-xs font-light text-foreground truncate">{p.name}</span>
                    <span className="text-[10px] text-muted-foreground/40 shrink-0">
                      {new Date(p.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteProject(p.id); }}
                      className="p-1.5 hover:bg-destructive/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="h-3 w-3 text-destructive/60" />
                    </button>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-[9px] text-muted-foreground/30 tracking-wider pb-4">Powered by Photopea • Created By ZALI Software</p>
      </div>
    );
  }

  // ── Main Editor Layout ──────────────────────────────────────
  return (
    <div className="flex flex-1 flex-col lg:flex-row h-full overflow-hidden p-2 sm:p-3 gap-2 sm:gap-3">
      {/* Chat Panel */}
      {!editorExpanded && (
        <div className="flex flex-col w-full lg:w-80 lg:min-w-[280px] lg:max-w-[360px] h-[40vh] lg:h-auto rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md overflow-hidden shrink-0">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/10">
            <button
              onClick={() => { setActiveProject(null); setPhotopeaReady(false); }}
              className="flex items-center gap-1.5 text-xs font-light text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Projects
            </button>
            <span className="text-[10px] font-light tracking-wider text-foreground/70 truncate max-w-[140px]">
              {activeProject.name}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={`p-2 rounded-xl transition-colors ${showHistory ? "bg-accent/20 text-accent" : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"}`}
                title="Version history"
              >
                <History className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Chat Messages */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-3 sm:p-4 space-y-3">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs font-light leading-relaxed ${
                      msg.role === "user"
                        ? "bg-accent/15 text-foreground rounded-br-md"
                        : "bg-foreground/5 text-foreground/90 rounded-bl-md"
                    }`}
                  >
                    {msg.content}
                    {msg.versionId && (
                      <button
                        onClick={() => {
                          const v = versions.find((ver) => ver.id === msg.versionId);
                          if (v) loadVersion(v);
                        }}
                        className="block mt-2 text-[10px] text-accent hover:underline"
                      >
                        Load in editor →
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {isChatting && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 bg-foreground/5 rounded-2xl px-3.5 py-2.5">
                    <Loader2 className="h-3 w-3 animate-spin text-accent" />
                    <span className="text-[10px] text-muted-foreground">Thinking...</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          </ScrollArea>

          {/* Quick Scripts */}
          {photopeaReady && activeVersion && (
            <div className="px-3 sm:px-4 py-2.5 border-t border-border/10 flex flex-wrap gap-1.5">
              {quickScripts.map((q) => (
                <button
                  key={q.label}
                  onClick={() => sendToPhotopea(q.script)}
                  className="text-[9px] px-2.5 py-1.5 rounded-xl border border-border/20 text-muted-foreground hover:text-foreground hover:border-accent/30 hover:bg-accent/5 transition-all"
                >
                  {q.label}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="p-3 sm:p-4 border-t border-border/10">
            <div className="flex items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.psd,.svg,.pdf,.ai,.eps,.xcf,.sketch"
                className="hidden"
                onChange={handleUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isSaving}
                className="p-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors disabled:opacity-40"
                title="Upload image"
              >
                <Upload className="h-4 w-4" />
              </button>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="Ask for editing tips…"
                className="flex-1 min-h-[40px] max-h-[100px] resize-none text-xs bg-transparent border-border/20 focus:border-accent/30 rounded-xl"
                rows={1}
                disabled={isChatting}
              />
              <Button
                size="sm"
                onClick={sendMessage}
                disabled={!input.trim() || isChatting}
                className="h-10 w-10 p-0 rounded-xl bg-accent hover:bg-accent/80"
              >
                {isChatting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Editor + Version Timeline */}
      <div className="flex-1 flex flex-col min-h-0 rounded-2xl border border-border/20 bg-card/10 backdrop-blur-md overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/10 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <Wand2 className="h-4 w-4 text-accent shrink-0" />
            <span className="text-xs font-light tracking-wider text-foreground/70 hidden sm:inline">VIBE IMAGER</span>
            {activeVersion && (
              <span className="text-[10px] text-muted-foreground/50">
                v{activeVersion.version_number}
                {activeVersion.is_uploaded && " • Uploaded"}
              </span>
            )}
            {!photopeaReady && (
              <span className="text-[10px] text-muted-foreground/50 flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading…
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditorExpanded(!editorExpanded)}
              className="h-8 w-8 p-0 rounded-xl lg:flex hidden"
              title={editorExpanded ? "Show chat" : "Expand editor"}
            >
              {editorExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Button>
            <Button
              size="sm"
              variant="default"
              onClick={saveCurrentImage}
              disabled={!photopeaReady || isSaving}
              className="h-8 text-[10px] gap-1.5 bg-accent hover:bg-accent/80 rounded-xl px-3"
            >
              {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              <span className="hidden sm:inline">Save Version</span>
              <span className="sm:hidden">Save</span>
            </Button>
            {activeVersion && (
              <Button size="sm" variant="ghost" onClick={downloadImage} className="h-8 text-[10px] gap-1 rounded-xl px-2.5">
                <Download className="h-3 w-3" />
                <span className="hidden sm:inline">Export</span>
              </Button>
            )}
          </div>
        </div>

        {/* Photopea iframe */}
        <div className="flex-1 relative min-h-0">
          <iframe
            ref={photopeaRef}
            src={buildPhotopeaUrl(activeVersion?.image_url)}
            className="absolute inset-0 w-full h-full border-0 rounded-b-2xl"
            allow="clipboard-read; clipboard-write"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-downloads"
          />
        </div>

        {/* Version Timeline */}
        {versions.length > 0 && (
          <div className="border-t border-border/10 bg-card/20 px-4 py-3 shrink-0">
            <div className="flex items-center gap-1.5 mb-2">
              <GitBranch className="h-3 w-3 text-muted-foreground/50" />
              <span className="text-[9px] tracking-[0.15em] text-muted-foreground/50 uppercase">Versions</span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
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
                  <img
                    src={v.image_url}
                    alt={`v${v.version_number}`}
                    className="w-14 h-14 object-cover"
                  />
                  <div className="px-1.5 py-1 text-center">
                    <span className="text-[8px] text-muted-foreground">v{v.version_number}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* History Panel (overlay) */}
      {showHistory && !editorExpanded && (
        <div className="w-full lg:w-64 h-[40vh] lg:h-auto rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md flex flex-col overflow-hidden shrink-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/10">
            <span className="text-xs font-light text-foreground">Version History</span>
            <button onClick={() => setShowHistory(false)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-3 space-y-2">
              {[...versions].reverse().map((v) => (
                <button
                  key={v.id}
                  onClick={() => loadVersion(v)}
                  className={`w-full rounded-xl border p-2.5 text-left transition-all ${
                    activeVersion?.id === v.id
                      ? "border-accent bg-accent/5 shadow-sm shadow-accent/10"
                      : "border-border/20 hover:border-foreground/20 hover:bg-foreground/[0.02]"
                  }`}
                >
                  <img src={v.image_url} alt="" className="w-full h-28 object-cover rounded-lg mb-2" />
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-foreground">v{v.version_number}</span>
                    <span className="text-[9px] text-muted-foreground/50">
                      {new Date(v.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-[9px] text-muted-foreground/60 truncate mt-0.5">{v.prompt}</p>
                  {v.parent_id && (
                    <div className="flex items-center gap-1 mt-1.5">
                      <GitBranch className="h-2.5 w-2.5 text-muted-foreground/30" />
                      <span className="text-[8px] text-muted-foreground/30">
                        from v{versions.find((p) => p.id === v.parent_id)?.version_number || "?"}
                      </span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
};

export default VibeImagerView;
