import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Send,
  Upload,
  ImagePlus,
  History,
  Wand2,
  Paintbrush,
  Sparkles,
  Download,
  GitBranch,
  ChevronRight,
  Loader2,
  Plus,
  Trash2,
  Eye,
  RotateCcw,
  Palette,
  Camera,
  Type,
  Eraser,
  Layers,
  ZoomIn,
  X,
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

const STYLE_PRESETS = [
  { value: "none", label: "No Style" },
  { value: "photorealistic", label: "Photorealistic" },
  { value: "artistic", label: "Fine Art" },
  { value: "anime", label: "Anime" },
  { value: "minimalist", label: "Minimalist" },
  { value: "cinematic", label: "Cinematic" },
  { value: "watercolor", label: "Watercolor" },
  { value: "3d-render", label: "3D Render" },
  { value: "sketch", label: "Sketch" },
];

const TEMPLATES = [
  { id: "logo", label: "Logo", icon: Sparkles, desc: "Brand logo design" },
  { id: "social", label: "Social Post", icon: Camera, desc: "Social media graphics" },
  { id: "avatar", label: "Avatar", icon: Paintbrush, desc: "Profile picture" },
  { id: "product", label: "Product", icon: Layers, desc: "Product mockup" },
  { id: "hero", label: "Hero Image", icon: ImagePlus, desc: "Website banner" },
  { id: "editor", label: "Free Edit", icon: Wand2, desc: "Upload & edit anything" },
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [isChatting, setIsChatting] = useState(false);
  const [stylePreset, setStylePreset] = useState("none");
  const [showHistory, setShowHistory] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [compareVersion, setCompareVersion] = useState<VibeVersion | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

    // Add welcome message
    const welcome: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: template
        ? `Welcome to Vibe Imager! 🎨 I see you've chosen the **${template}** template. Describe what you'd like to create and I'll bring it to life. What's your vision?`
        : `Welcome to Vibe Imager! 🎨 Describe your vision or upload an image to start editing. I'll help you iterate until it's perfect.`,
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
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "user", content: "📷 Uploaded an image" },
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Got your image! Now tell me what you'd like to change. I can edit, enhance, restyle, or transform it.",
          versionId: v.id,
        },
      ]);
    }
    e.target.value = "";
  };

  // ── Send Message (Chat + Generate/Edit) ─────────────────────
  const sendMessage = async () => {
    if (!input.trim() || !user || !activeProject || isGenerating) return;
    const content = input.trim();
    setInput("");

    // Add user message
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content };
    setMessages((prev) => [...prev, userMsg]);

    // Save user message to DB
    await supabase.from("vibe_imager_messages").insert({
      project_id: activeProject.id,
      user_id: user.id,
      role: "user",
      content,
    });

    // First, chat to get context/suggestions
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
      const reply = chatData?.reply || "";
      setIsChatting(false);

      // Check if AI wants to generate or edit
      const generateMatch = reply.match(/\[GENERATE:\s*(.*?)\]/s);
      const editMatch = reply.match(/\[EDIT:\s*(.*?)\]/s);
      const cleanReply = reply
        .replace(/\[GENERATE:.*?\]/s, "")
        .replace(/\[EDIT:.*?\]/s, "")
        .trim();

      if (cleanReply) {
        const assistantMsg: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: cleanReply };
        setMessages((prev) => [...prev, assistantMsg]);
        await supabase.from("vibe_imager_messages").insert({
          project_id: activeProject.id,
          user_id: user.id,
          role: "assistant",
          content: cleanReply,
        });
      }

      // Execute generation/edit if triggered
      if (generateMatch || editMatch) {
        setIsGenerating(true);
        const genMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: generateMatch ? "🎨 Generating your image..." : "✏️ Editing your image...",
        };
        setMessages((prev) => [...prev, genMsg]);

        try {
          let result;
          if (generateMatch) {
            const { data, error } = await supabase.functions.invoke("vibe-imager", {
              body: {
                action: "generate",
                prompt: generateMatch[1],
                projectId: activeProject.id,
                parentVersionId: activeVersion?.id || null,
                stylePreset,
              },
            });
            if (error) throw error;
            result = data;
          } else if (editMatch && activeVersion) {
            const { data, error } = await supabase.functions.invoke("vibe-imager", {
              body: {
                action: "edit",
                instruction: editMatch[1],
                imageUrl: activeVersion.image_url,
                projectId: activeProject.id,
                parentVersionId: activeVersion.id,
              },
            });
            if (error) throw error;
            result = data;
          }

          if (result?.version) {
            const newVersion = result.version as VibeVersion;
            setVersions((prev) => [...prev, newVersion]);
            setActiveVersion(newVersion);

            // Replace generating message with result
            setMessages((prev) =>
              prev.map((m) =>
                m.id === genMsg.id
                  ? { ...m, content: "✅ Done! Here's your image. What do you think? Tell me if you'd like any changes.", versionId: newVersion.id }
                  : m
              )
            );

            await supabase.from("vibe_imager_messages").insert({
              project_id: activeProject.id,
              user_id: user.id,
              role: "assistant",
              content: "Image generated successfully",
              version_id: newVersion.id,
            });
          }
        } catch (genErr: any) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === genMsg.id ? { ...m, content: `❌ ${genErr.message || "Generation failed. Try again."}` } : m
            )
          );
        }
        setIsGenerating(false);
      } else if (!activeVersion && !generateMatch) {
        // No image yet and AI didn't trigger generation — auto-generate
        setIsGenerating(true);
        const genMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "🎨 Generating your image...",
        };
        setMessages((prev) => [...prev, genMsg]);

        try {
          const { data, error } = await supabase.functions.invoke("vibe-imager", {
            body: {
              action: "generate",
              prompt: content,
              projectId: activeProject.id,
              parentVersionId: null,
              stylePreset,
            },
          });
          if (error) throw error;

          if (data?.version) {
            const newVersion = data.version as VibeVersion;
            setVersions((prev) => [...prev, newVersion]);
            setActiveVersion(newVersion);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === genMsg.id
                  ? { ...m, content: "✅ Here's your first version! What would you like to change?", versionId: newVersion.id }
                  : m
              )
            );
          }
        } catch (genErr: any) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === genMsg.id ? { ...m, content: `❌ ${genErr.message || "Failed."}` } : m
            )
          );
        }
        setIsGenerating(false);
      }
    } catch (err: any) {
      setIsChatting(false);
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  // ── Quick Actions ───────────────────────────────────────────
  const quickEdit = async (instruction: string) => {
    if (!activeVersion || !activeProject || !user || isGenerating) return;
    setIsGenerating(true);
    const genMsg: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: `✏️ ${instruction}...` };
    setMessages((prev) => [...prev, genMsg]);

    try {
      const { data, error } = await supabase.functions.invoke("vibe-imager", {
        body: {
          action: "edit",
          instruction,
          imageUrl: activeVersion.image_url,
          projectId: activeProject.id,
          parentVersionId: activeVersion.id,
        },
      });
      if (error) throw error;

      if (data?.version) {
        const v = data.version as VibeVersion;
        setVersions((prev) => [...prev, v]);
        setActiveVersion(v);
        setMessages((prev) =>
          prev.map((m) => (m.id === genMsg.id ? { ...m, content: "✅ Applied! How does it look?", versionId: v.id } : m))
        );
      }
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) => (m.id === genMsg.id ? { ...m, content: `❌ ${err.message}` } : m))
      );
    }
    setIsGenerating(false);
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
            Describe your vision, see it live. Iterate through conversation. Version control for images.
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

        {/* Quick start */}
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

        <p className="text-[9px] text-muted-foreground/30 tracking-wider">Beta: Created By ZALI Software</p>
      </div>
    );
  }

  // ── Main Editor Layout ──────────────────────────────────────
  return (
    <div className="flex flex-1 h-full overflow-hidden">
      {/* Chat Panel */}
      <div className="flex flex-col w-80 min-w-[280px] max-w-[360px] border-r border-border/20 bg-card/20 backdrop-blur-md">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border/20">
          <button
            onClick={() => setActiveProject(null)}
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

        {/* Style Selector */}
        <div className="px-3 py-2 border-b border-border/10">
          <Select value={stylePreset} onValueChange={setStylePreset}>
            <SelectTrigger className="h-7 text-[10px] bg-transparent border-border/20">
              <Palette className="h-3 w-3 mr-1.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STYLE_PRESETS.map((s) => (
                <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
                        if (v) setActiveVersion(v);
                      }}
                      className="block mt-1.5 text-[9px] text-accent hover:underline"
                    >
                      View image →
                    </button>
                  )}
                </div>
              </div>
            ))}
            {(isChatting || isGenerating) && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 bg-foreground/5 rounded-xl px-3 py-2">
                  <Loader2 className="h-3 w-3 animate-spin text-accent" />
                  <span className="text-[10px] text-muted-foreground">
                    {isGenerating ? "Creating image..." : "Thinking..."}
                  </span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </ScrollArea>

        {/* Quick Actions */}
        {activeVersion && (
          <div className="px-3 py-2 border-t border-border/10 flex flex-wrap gap-1.5">
            {[
              { label: "🎨 Restyle", action: "Apply a completely different artistic style" },
              { label: "🌈 Recolor", action: "Change the color palette dramatically" },
              { label: "➕ Add element", action: "Add an interesting new element to the composition" },
              { label: "🗑️ Simplify", action: "Remove clutter and simplify the composition" },
              { label: "✨ Enhance", action: "Enhance the quality, add more detail and depth" },
              { label: "🌙 Dark mode", action: "Convert to a dark, moody atmosphere" },
            ].map((q) => (
              <button
                key={q.label}
                onClick={() => quickEdit(q.action)}
                disabled={isGenerating}
                className="text-[9px] px-2 py-1 rounded-md border border-border/20 text-muted-foreground hover:text-foreground hover:border-accent/30 transition-all disabled:opacity-40"
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
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isGenerating}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors disabled:opacity-40"
              title="Upload image"
            >
              <Upload className="h-4 w-4" />
            </button>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder={activeVersion ? "Describe changes…" : "Describe what you want to create…"}
              className="flex-1 min-h-[36px] max-h-[100px] resize-none text-xs bg-transparent border-border/20 focus:border-accent/30"
              rows={1}
              disabled={isGenerating}
            />
            <Button
              size="sm"
              onClick={sendMessage}
              disabled={!input.trim() || isGenerating}
              className="h-9 w-9 p-0 bg-accent hover:bg-accent/80"
            >
              {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Canvas / Image Display */}
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
          </div>
          <div className="flex items-center gap-1.5">
            {activeVersion && versions.length > 1 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setShowCompare(!showCompare); if (!showCompare && versions.length > 1) setCompareVersion(versions[versions.length - 2]); }}
                className="h-7 text-[10px] gap-1"
              >
                <Eye className="h-3 w-3" />
                Compare
              </Button>
            )}
            {activeVersion && (
              <Button size="sm" variant="ghost" onClick={downloadImage} className="h-7 text-[10px] gap-1">
                <Download className="h-3 w-3" />
                Export
              </Button>
            )}
          </div>
        </div>

        {/* Image Area */}
        <div className="flex-1 flex items-center justify-center p-6 overflow-auto">
          {activeVersion ? (
            <div className={`flex gap-4 ${showCompare ? "items-start" : "items-center justify-center"}`}>
              {showCompare && compareVersion && (
                <div className="flex flex-col items-center gap-2">
                  <span className="text-[9px] text-muted-foreground/50">v{compareVersion.version_number}</span>
                  <img
                    src={compareVersion.image_url}
                    alt={`Version ${compareVersion.version_number}`}
                    className="max-w-[400px] max-h-[500px] rounded-xl border border-border/20 shadow-lg object-contain"
                  />
                </div>
              )}
              <div className="flex flex-col items-center gap-2">
                {showCompare && <span className="text-[9px] text-accent">v{activeVersion.version_number} (current)</span>}
                <img
                  src={activeVersion.image_url}
                  alt={`Version ${activeVersion.version_number}`}
                  className="max-w-[600px] max-h-[600px] rounded-xl border border-border/20 shadow-2xl object-contain"
                />
                {activeVersion.prompt && (
                  <p className="text-[10px] text-muted-foreground/40 max-w-md text-center truncate">
                    {activeVersion.prompt}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <ImagePlus className="h-16 w-16 text-muted-foreground/20 mx-auto" />
              <p className="text-sm font-extralight text-muted-foreground/50">
                Describe your vision in the chat to generate your first image
              </p>
            </div>
          )}
        </div>

        {/* Version Timeline */}
        {versions.length > 0 && (
          <div className="border-t border-border/20 bg-card/10 px-4 py-3">
            <div className="flex items-center gap-1 mb-2">
              <GitBranch className="h-3 w-3 text-muted-foreground/50" />
              <span className="text-[9px] tracking-wider text-muted-foreground/50 uppercase">Version History</span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {versions.map((v, i) => (
                <button
                  key={v.id}
                  onClick={() => setActiveVersion(v)}
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
      {showHistory && (
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
                  onClick={() => setActiveVersion(v)}
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
