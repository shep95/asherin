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
  ExternalLink,
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
      // Photopea sends "done" when ready or after processing a command
      if (e.data === "done") {
        if (!photopeaReady) setPhotopeaReady(true);
        if (pendingSaveRef.current) {
          pendingSaveRef.current = false;
          // "done" after saveToOE means data was already sent
        }
        return;
      }

      // ArrayBuffer = exported image from Photopea (response to saveToOE)
      if (e.data instanceof ArrayBuffer) {
        handlePhotopeaExport(e.data);
        return;
      }

      // String messages from echoToOE
      if (typeof e.data === "string") {
        try {
          const parsed = JSON.parse(e.data);
          if (parsed.type === "save") {
            // Custom save triggered
            saveCurrentImage();
          }
        } catch {
          // Not JSON, ignore
        }
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [photopeaReady, activeProject, activeVersion, user]);

  // Send a script command to Photopea
  const sendToPhotopea = useCallback((script: string) => {
    if (!photopeaRef.current?.contentWindow) return;
    photopeaRef.current.contentWindow.postMessage(script, "*");
  }, []);

  // Send an ArrayBuffer (image file) to Photopea
  const sendFileToPhotopea = useCallback((buffer: ArrayBuffer) => {
    if (!photopeaRef.current?.contentWindow) return;
    photopeaRef.current.contentWindow.postMessage(buffer, "*");
  }, []);

  // Load an image URL into Photopea
  const loadImageInPhotopea = useCallback(async (imageUrl: string) => {
    if (!photopeaRef.current?.contentWindow) return;
    try {
      const response = await fetch(imageUrl);
      const buffer = await response.arrayBuffer();
      sendFileToPhotopea(buffer);
    } catch (err) {
      // Fallback: use app.open with URL
      sendToPhotopea(`app.open("${imageUrl}");`);
    }
  }, [sendFileToPhotopea, sendToPhotopea]);

  // Trigger Photopea to export the current document
  const saveCurrentImage = useCallback(() => {
    pendingSaveRef.current = true;
    sendToPhotopea('app.activeDocument.saveToOE("png");');
  }, [sendToPhotopea]);

  // Handle the exported ArrayBuffer from Photopea
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

  // Load projects
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

  // Load versions when project changes
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

  // Load chat messages when project changes
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

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // When activeVersion changes and Photopea is ready, load it
  useEffect(() => {
    if (activeVersion && photopeaReady) {
      loadImageInPhotopea(activeVersion.image_url);
    }
  }, [activeVersion?.id, photopeaReady]);

  // ── Photopea iframe URL builder ─────────────────────────────
  const buildPhotopeaUrl = useCallback((imageUrl?: string) => {
    const config: Record<string, unknown> = {
      environment: {
        customIO: {
          save: 'app.echoToOE(JSON.stringify({type:"save"}));',
        },
      },
    };
    if (imageUrl) {
      config.files = [imageUrl];
    }
    return `https://www.photopea.com#${encodeURIComponent(JSON.stringify(config))}`;
  }, []);

  // ── Create Project ──────────────────────────────────────────
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

    const welcome: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: `Welcome to Vibe Imager! 🎨 Upload an image to start editing in the built-in Photopea editor. I can also help you with AI-powered suggestions for edits, effects, and techniques.`,
    };
    setMessages([welcome]);
  };

  // ── Delete Project ──────────────────────────────────────────
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

  // ── Upload Image ────────────────────────────────────────────
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

      // Load into Photopea
      if (photopeaReady) {
        loadImageInPhotopea(urlData.publicUrl);
      }

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

  // ── Send Chat Message (AI assistant for editing tips) ───────
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
      const chatHistory = messages.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      }));
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

      // Check if AI suggests a Photopea script
      const scriptMatch = reply.match(/\[SCRIPT:\s*(.*?)\]/s);
      if (scriptMatch && photopeaReady) {
        sendToPhotopea(scriptMatch[1]);
      }

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

  // ── Load version into editor ────────────────────────────────
  const loadVersion = (v: VibeVersion) => {
    setActiveVersion(v);
    if (photopeaReady) {
      loadImageInPhotopea(v.image_url);
    }
  };

  // ── Download ────────────────────────────────────────────────
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

  // ── Quick Photopea Scripts ──────────────────────────────────
  const quickScripts = [
    { label: "🔄 Flip H", script: 'app.activeDocument.flipCanvas("horizontal");' },
    { label: "🔃 Flip V", script: 'app.activeDocument.flipCanvas("vertical");' },
    { label: "↩️ Rotate 90°", script: "app.activeDocument.rotateCanvas(90);" },
    { label: "🎨 Desaturate", script: 'app.activeDocument.activeLayer.adjustments.desaturate();' },
    { label: "✨ Auto Levels", script: 'app.activeDocument.activeLayer.adjustments.levels();' },
    { label: "📐 Flatten", script: "app.activeDocument.flattenImage();" },
  ];

  // ── Landing (no project) ────────────────────────────────────
  if (!activeProject) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-6 gap-8">
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2">
            <Wand2 className="h-8 w-8 text-accent" />
            <h1 className="text-2xl font-extralight tracking-[0.15em] text-foreground">VIBE IMAGER</h1>
          </div>
          <p className="text-sm font-extralight text-muted-foreground max-w-md">
            Upload images, edit with a full Photoshop-class editor powered by Photopea, iterate with AI assistance, and track every version.
          </p>
        </div>

        {/* Templates */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-lg">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => createProject(t.id)}
              className="flex flex-col items-center gap-2 rounded-xl border border-border/20 bg-card/30 backdrop-blur-md p-4 hover:bg-card/50 hover:border-accent/30 transition-all group"
            >
              <t.icon className="h-6 w-6 text-muted-foreground group-hover:text-accent transition-colors" />
              <span className="text-xs font-light text-foreground">{t.label}</span>
              <span className="text-[10px] text-muted-foreground/60">{t.desc}</span>
            </button>
          ))}
        </div>

        <Button onClick={() => createProject()} variant="outline" className="gap-2 text-xs font-light">
          <Plus className="h-3.5 w-3.5" /> Blank Project
        </Button>

        {/* Recent projects */}
        {projects.length > 0 && (
          <div className="w-full max-w-lg space-y-2">
            <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground/50 uppercase px-1">Recent Projects</p>
            <div className="space-y-1">
              {projects.slice(0, 6).map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-foreground/5 transition-colors group cursor-pointer"
                  onClick={() => setActiveProject(p)}
                >
                  <div className="flex items-center gap-2">
                    <ImagePlus className="h-3.5 w-3.5 text-muted-foreground/50" />
                    <span className="text-xs font-light text-foreground">{p.name}</span>
                    <span className="text-[10px] text-muted-foreground/40">
                      {new Date(p.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteProject(p.id); }}
                      className="p-1 hover:bg-destructive/10 rounded"
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

        <p className="text-[9px] text-muted-foreground/30 tracking-wider">Powered by Photopea • Created By ZALI Software</p>
      </div>
    );
  }

  // ── Main Editor Layout ──────────────────────────────────────
  return (
    <div className="flex flex-1 h-full overflow-hidden">
      {/* Chat Panel */}
      {!editorExpanded && (
        <div className="flex flex-col w-80 min-w-[280px] max-w-[360px] border-r border-border/20 bg-card/20 backdrop-blur-md">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-border/20">
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
                className={`p-1.5 rounded-lg transition-colors ${showHistory ? "bg-accent/20 text-accent" : "text-muted-foreground hover:text-foreground"}`}
                title="Version history"
              >
                <History className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Chat Messages */}
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-3">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-xs font-light ${
                      msg.role === "user"
                        ? "bg-accent/20 text-foreground"
                        : "bg-foreground/5 text-foreground/90"
                    }`}
                  >
                    {msg.content}
                    {msg.versionId && (
                      <button
                        onClick={() => {
                          const v = versions.find((ver) => ver.id === msg.versionId);
                          if (v) loadVersion(v);
                        }}
                        className="block mt-1.5 text-[9px] text-accent hover:underline"
                      >
                        Load in editor →
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {isChatting && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 bg-foreground/5 rounded-xl px-3 py-2">
                    <Loader2 className="h-3 w-3 animate-spin text-accent" />
                    <span className="text-[10px] text-muted-foreground">Thinking...</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          </ScrollArea>

          {/* Quick Photopea Scripts */}
          {photopeaReady && activeVersion && (
            <div className="px-3 py-2 border-t border-border/10 flex flex-wrap gap-1.5">
              {quickScripts.map((q) => (
                <button
                  key={q.label}
                  onClick={() => sendToPhotopea(q.script)}
                  className="text-[9px] px-2 py-1 rounded-md border border-border/20 text-muted-foreground hover:text-foreground hover:border-accent/30 transition-all"
                >
                  {q.label}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="p-3 border-t border-border/20">
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
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors disabled:opacity-40"
                title="Upload image"
              >
                <Upload className="h-4 w-4" />
              </button>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="Ask for editing tips, techniques…"
                className="flex-1 min-h-[36px] max-h-[100px] resize-none text-xs bg-transparent border-border/20 focus:border-accent/30"
                rows={1}
                disabled={isChatting}
              />
              <Button
                size="sm"
                onClick={sendMessage}
                disabled={!input.trim() || isChatting}
                className="h-9 w-9 p-0 bg-accent hover:bg-accent/80"
              >
                {isChatting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Photopea Editor */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/20 bg-card/10">
          <div className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-accent" />
            <span className="text-xs font-light tracking-wider text-foreground/70">VIBE IMAGER</span>
            {activeVersion && (
              <span className="text-[10px] text-muted-foreground/50 ml-2">
                v{activeVersion.version_number}
                {activeVersion.is_uploaded && " • Uploaded"}
              </span>
            )}
            {!photopeaReady && (
              <span className="text-[10px] text-muted-foreground/50 flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading editor…
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditorExpanded(!editorExpanded)}
              className="h-7 text-[10px] gap-1"
              title={editorExpanded ? "Show chat" : "Expand editor"}
            >
              {editorExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
            </Button>
            <Button
              size="sm"
              variant="default"
              onClick={saveCurrentImage}
              disabled={!photopeaReady || isSaving}
              className="h-7 text-[10px] gap-1 bg-accent hover:bg-accent/80"
            >
              {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Save Version
            </Button>
            {activeVersion && (
              <Button size="sm" variant="ghost" onClick={downloadImage} className="h-7 text-[10px] gap-1">
                <Download className="h-3 w-3" />
                Export
              </Button>
            )}
          </div>
        </div>

        {/* Photopea iframe */}
        <div className="flex-1 relative">
          <iframe
            ref={photopeaRef}
            src={buildPhotopeaUrl(activeVersion?.image_url)}
            className="absolute inset-0 w-full h-full border-0"
            allow="clipboard-read; clipboard-write"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-downloads"
          />
        </div>

        {/* Version Timeline */}
        {versions.length > 0 && (
          <div className="border-t border-border/20 bg-card/10 px-4 py-3">
            <div className="flex items-center gap-1 mb-2">
              <GitBranch className="h-3 w-3 text-muted-foreground/50" />
              <span className="text-[9px] tracking-wider text-muted-foreground/50 uppercase">Version History</span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {versions.map((v) => (
                <button
                  key={v.id}
                  onClick={() => loadVersion(v)}
                  className={`flex-shrink-0 rounded-lg border transition-all overflow-hidden ${
                    activeVersion?.id === v.id
                      ? "border-accent ring-1 ring-accent/30"
                      : "border-border/20 hover:border-foreground/20"
                  }`}
                >
                  <img
                    src={v.image_url}
                    alt={`v${v.version_number}`}
                    className="w-14 h-14 object-cover"
                  />
                  <div className="px-1.5 py-0.5 text-center">
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
        <div className="w-64 border-l border-border/20 bg-card/30 backdrop-blur-md flex flex-col">
          <div className="flex items-center justify-between p-3 border-b border-border/20">
            <span className="text-xs font-light text-foreground">Version History</span>
            <button onClick={() => setShowHistory(false)} className="p-1 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-2">
              {[...versions].reverse().map((v) => (
                <button
                  key={v.id}
                  onClick={() => loadVersion(v)}
                  className={`w-full rounded-lg border p-2 text-left transition-all ${
                    activeVersion?.id === v.id
                      ? "border-accent bg-accent/5"
                      : "border-border/20 hover:border-foreground/20"
                  }`}
                >
                  <img src={v.image_url} alt="" className="w-full h-28 object-cover rounded-md mb-2" />
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-foreground">v{v.version_number}</span>
                    <span className="text-[9px] text-muted-foreground/50">
                      {new Date(v.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-[9px] text-muted-foreground/60 truncate mt-0.5">{v.prompt}</p>
                  {v.parent_id && (
                    <div className="flex items-center gap-1 mt-1">
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
