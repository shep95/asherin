import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toDisplayUrl, signPath } from "@/lib/storageSignedUrl";
import { useToast } from "@/hooks/use-toast";
import { useFFmpeg } from "@/hooks/useFFmpeg";
import { useMediaBunny } from "@/hooks/useMediaBunny";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import MessageQueuePanel, { type QueueItem } from "@/components/dashboard/MessageQueuePanel";
import {
  Send, Upload, Film, History, Wand2, Download, GitBranch, ChevronRight,
  Loader2, Plus, Trash2, RotateCcw, X, Play, Pause, HelpCircle, Video, Pencil, Check,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────
interface VideoProject {
  id: string;
  name: string;
  template: string | null;
  created_at: string;
  updated_at: string;
}

interface VideoVersion {
  id: string;
  project_id: string;
  parent_id: string | null;
  version_number: number;
  prompt: string;
  video_url: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  style_preset: string | null;
  is_uploaded: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  videoUrl?: string;
  versionId?: string;
  clarifyQuestions?: string[];
  clarifyAnswered?: boolean;
}

const TEMPLATES = [
  { id: "color-grade", label: "Color Grade", icon: Film, desc: "Cinematic color grading" },
  { id: "retouch", label: "Retouch", icon: Wand2, desc: "Clean up & enhance" },
  { id: "creative", label: "Creative", icon: Wand2, desc: "Artistic transformations" },
  { id: "free-edit", label: "Free Edit", icon: Video, desc: "Start fresh" },
];

// ── Clarify Questions Card ────────────────────────────────────
const ClarifyQuestionsCard = ({
  questions, context, onSubmit,
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

const VibeVideoView = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const ffmpeg = useFFmpeg(false); // Only load FFmpeg when needed (for filter operations)
  const mediaBunny = useMediaBunny(); // GPU-accelerated engine for trim/speed/resize/crop/rotate

  const [projects, setProjects] = useState<VideoProject[]>([]);
  const [activeProject, setActiveProject] = useState<VideoProject | null>(null);
  const [versions, setVersions] = useState<VideoVersion[]>([]);
  const [activeVersion, setActiveVersion] = useState<VideoVersion | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [queuePaused, setQueuePaused] = useState(false);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [ffmpegProgress, setFfmpegProgress] = useState<number | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const renameProject = async (id: string, newName: string) => {
    if (!newName.trim()) return;
    await supabase.from("vibe_video_projects").update({ name: newName.trim() }).eq("id", id);
    setProjects((prev) => prev.map((p) => p.id === id ? { ...p, name: newName.trim() } : p));
    if (activeProject?.id === id) setActiveProject((prev) => prev ? { ...prev, name: newName.trim() } : prev);
    setRenamingId(null);
  };

  // ── Load projects ───────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    supabase
      .from("vibe_video_projects")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .then(({ data }) => { if (data) setProjects(data as VideoProject[]); });
  }, [user]);

  // ── Load versions ───────────────────────────────────────────
  useEffect(() => {
    if (!activeProject) { setVersions([]); setActiveVersion(null); return; }
    supabase
      .from("vibe_video_versions")
      .select("*")
      .eq("project_id", activeProject.id)
      .order("created_at", { ascending: true })
      .then(async ({ data }) => {
        if (data) {
          const raw = data as VideoVersion[];
          const v: VideoVersion[] = await Promise.all(
            raw.map(async (row) => ({
              ...row,
              video_url: await toDisplayUrl(row.video_url, "vibe-video"),
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
      .from("vibe_video_messages")
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

  const processAllQueue = async () => { setQueuePaused(false); };

  // ── Create project ──────────────────────────────────────────
  const createProject = async (template?: string) => {
    if (!user) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast({ title: "Error", description: "Please sign in again", variant: "destructive" }); return; }
    const name = template ? `${template.charAt(0).toUpperCase() + template.slice(1)} Project` : "New Video Project";
    const { data, error } = await supabase
      .from("vibe_video_projects")
      .insert({ user_id: session.user.id, name, template: template || null })
      .select().single();
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    const project = data as VideoProject;
    setProjects((prev) => [project, ...prev]);
    setActiveProject(project);
    setMessages([{
      id: crypto.randomUUID(), role: "assistant",
      content: "Welcome to Vibe Video! 🎬 Upload a video and describe your edit. I'll ask clarifying questions if I need more detail before processing it.",
    }]);
    setVersions([]);
    setActiveVersion(null);
  };

  const deleteProject = async (id: string) => {
    await supabase.from("vibe_video_projects").delete().eq("id", id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (activeProject?.id === id) {
      setActiveProject(null); setVersions([]); setActiveVersion(null); setMessages([]);
    }
  };

  // ── Upload video ────────────────────────────────────────────
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !activeProject) return;

    if (file.size > 2 * 1024 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum video size is 2GB.", variant: "destructive" });
      return;
    }

    const ext = file.name.split(".").pop() || "mp4";
    const path = `${user.id}/${activeProject.id}/${crypto.randomUUID()}.${ext}`;

    setUploadProgress(1);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const session = (await supabase.auth.getSession()).data.session;
      const authToken = session?.access_token || supabaseKey;

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable) {
            const pct = Math.max(1, Math.round((evt.loaded / evt.total) * 100));
            setUploadProgress(pct);
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setUploadProgress(100);
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.responseText}`));
          }
        };
        xhr.onerror = () => reject(new Error("Upload network error"));
        xhr.onabort = () => reject(new Error("Upload cancelled"));
        xhr.open("POST", `${supabaseUrl}/storage/v1/object/vibe-video/${path}`);
        xhr.setRequestHeader("Authorization", `Bearer ${authToken}`);
        xhr.setRequestHeader("apikey", supabaseKey);
        xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
        xhr.setRequestHeader("x-upsert", "false");
        xhr.send(file);
      });
    } catch (err: unknown) {
      setUploadProgress(null);
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast({ title: "Upload failed", description: msg, variant: "destructive" });
      e.target.value = "";
      return;
    }

    setUploadProgress(null);
    const signedUrl = (await signPath("vibe-video", path)) || "";
    const vNum = (activeVersion?.version_number || 0) + 1;

    const { data: version } = await supabase
      .from("vibe_video_versions")
      .insert({
        project_id: activeProject.id, user_id: user.id,
        parent_id: activeVersion?.id || null, version_number: vNum,
        prompt: "Uploaded video", video_url: path, is_uploaded: true,
      })
      .select().single();

    if (version) {
      const v = { ...(version as VideoVersion), video_url: signedUrl };
      setVersions((prev) => [...prev, v]);
      setActiveVersion(v);
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "user", content: `🎬 Uploaded: ${file.name}`, videoUrl: signedUrl },
        { id: crypto.randomUUID(), role: "assistant", content: "Video uploaded! Now describe your edit — I'll ask for specifics if needed before processing it." },
      ]);
    }
    e.target.value = "";
  };

  // ── Process a single message ────────────────────────────────
  const processMessage = async (instruction: string) => {
    if (!user || !activeProject) return;

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: instruction };
    setMessages((prev) => [...prev, userMsg]);

    await supabase.from("vibe_video_messages").insert({
      project_id: activeProject.id, user_id: user.id, role: "user", content: instruction,
    });

    setIsEditing(true);

    try {
      const chatHistory = messages.slice(-6).map((m) => ({ role: m.role, content: m.content }));
      const { data: analyzeData, error: analyzeErr } = await supabase.functions.invoke("vibe-video", {
        body: {
          action: "analyze",
          instruction,
          hasVideo: !!activeVersion,
          videoUrl: activeVersion?.video_url,
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
          id: crypto.randomUUID(), role: "assistant",
          content: replyText, clarifyQuestions: questions,
        };
        setMessages((prev) => [...prev, aMsg]);
        await supabase.from("vibe_video_messages").insert({
          project_id: activeProject.id, user_id: user.id, role: "assistant", content: replyText,
        });
        setIsEditing(false);
        return;
      }

      // ── AI says proceed — execute the edit with FFmpeg ─────
      if (responseType === "proceed" && activeVersion) {
        const refinedInstruction = analyzeData.instruction || instruction;
        const summary = analyzeData.summary || "";
        const ffmpegArgs: string[] = analyzeData.ffmpeg_args || [];
        const editType = analyzeData.edit_type || "filter";

        if (summary) {
          const infoMsg: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: `◈ ${summary}` };
          setMessages((prev) => [...prev, infoMsg]);
        }

        if (ffmpegArgs.length === 0) {
          const errMsg: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: "◇ Couldn't determine the exact command for this edit. Try being more specific." };
          setMessages((prev) => [...prev, errMsg]);
          setIsEditing(false);
          return;
        }

        // Determine which engine to use
        const useGPU = mediaBunny.canUseMediaBunny(editType);
        const engineLabel = useGPU ? "◈ MediaBunny (GPU-accelerated)" : "◎ FFmpeg (software)";

        const loadMsg: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: `◌ Loading ${engineLabel}…` };
        setMessages((prev) => [...prev, loadMsg]);

        let resultBlob: Blob;

        if (useGPU) {
          // ── GPU-accelerated path (MediaBunny / WebCodecs) ──
          try {
            setMessages((prev) =>
              prev.map((m) => m.id === loadMsg.id ? { ...m, content: `◈ Processing with GPU acceleration: "${editType}"… Near-instant for supported operations.` } : m)
            );
            setFfmpegProgress(0);
            const progressInterval = setInterval(() => {
              setFfmpegProgress(mediaBunny.progress);
            }, 100);

            resultBlob = await mediaBunny.processWithMediaBunny(activeVersion.video_url, editType, ffmpegArgs);
            clearInterval(progressInterval);
            setFfmpegProgress(null);
          } catch (gpuErr: any) {
            // Fallback to FFmpeg if MediaBunny fails
            console.warn("[MediaBunny] GPU processing failed, falling back to FFmpeg:", gpuErr.message);
            setMessages((prev) =>
              prev.map((m) => m.id === loadMsg.id ? { ...m, content: `◌ GPU engine failed, falling back to FFmpeg…` } : m)
            );

            try {
              await ffmpeg.load();
              setFfmpegProgress(0);
              const progressInterval = setInterval(() => {
                setFfmpegProgress(ffmpeg.progress);
              }, 200);
              resultBlob = await ffmpeg.processVideo(activeVersion.video_url, ffmpegArgs);
              clearInterval(progressInterval);
              setFfmpegProgress(null);
            } catch (ffmpegErr: any) {
              setFfmpegProgress(null);
              const errMsg: ChatMessage = {
                id: crypto.randomUUID(), role: "assistant",
                content: `◇ Processing failed: ${ffmpegErr.message}\n\nTip: Very large videos may exceed browser memory. Try trimming the video first.`,
              };
              setMessages((prev) => [...prev, errMsg]);
              setIsEditing(false);
              return;
            }
          }
        } else {
          // ── Software path (FFmpeg WASM) for filters/effects ──
          try {
            await ffmpeg.load();
          } catch {
            const errMsg: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: "◇ Failed to load the video engine. Try Chrome or Edge." };
            setMessages((prev) => [...prev, errMsg]);
            setIsEditing(false);
            return;
          }

          setMessages((prev) =>
            prev.map((m) => m.id === loadMsg.id ? { ...m, content: `🎬 Processing "${editType}" with FFmpeg… This runs in your browser.` } : m)
          );
          setFfmpegProgress(0);
          const progressInterval = setInterval(() => {
            setFfmpegProgress(ffmpeg.progress);
          }, 200);

          try {
            resultBlob = await ffmpeg.processVideo(activeVersion.video_url, ffmpegArgs);
            clearInterval(progressInterval);
            setFfmpegProgress(null);
          } catch (err: any) {
            clearInterval(progressInterval);
            setFfmpegProgress(null);
            const errMsg: ChatMessage = {
              id: crypto.randomUUID(), role: "assistant",
              content: `◇ Processing failed: ${err.message}\n\nTip: Very large videos may exceed browser memory. Try trimming the video first.`,
            };
            setMessages((prev) => [...prev, errMsg]);
            setIsEditing(false);
            return;
          }
        }

        // Upload processed video
        const ext = "mp4";
        const path = `${user!.id}/${activeProject!.id}/${crypto.randomUUID()}.${ext}`;

        setUploadProgress(1);
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const session = (await supabase.auth.getSession()).data.session;
        const authToken = session?.access_token || supabaseKey;

        try {
          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.upload.onprogress = (evt) => {
              if (evt.lengthComputable) {
                setUploadProgress(Math.max(1, Math.round((evt.loaded / evt.total) * 100)));
              }
            };
            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) { setUploadProgress(100); resolve(); }
              else reject(new Error(`Upload failed: ${xhr.status}`));
            };
            xhr.onerror = () => reject(new Error("Upload network error"));
            xhr.open("POST", `${supabaseUrl}/storage/v1/object/vibe-video/${path}`);
            xhr.setRequestHeader("Authorization", `Bearer ${authToken}`);
            xhr.setRequestHeader("apikey", supabaseKey);
            xhr.setRequestHeader("Content-Type", resultBlob.type || "video/mp4");
            xhr.setRequestHeader("x-upsert", "false");
            xhr.send(resultBlob);
          });
        } catch (uploadErr: any) {
          setUploadProgress(null);
          const errMsg: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: `◇ Upload failed: ${uploadErr.message}` };
          setMessages((prev) => [...prev, errMsg]);
          setIsEditing(false);
          return;
        }
        setUploadProgress(null);

        const { data: urlData } = supabase.storage.from("vibe-video").getPublicUrl(path);
        const vNum = (activeVersion?.version_number || 0) + 1;

        const { data: version } = await supabase
          .from("vibe_video_versions")
          .insert({
            project_id: activeProject!.id, user_id: user!.id,
            parent_id: activeVersion?.id || null, version_number: vNum,
            prompt: refinedInstruction, video_url: urlData.publicUrl, is_uploaded: false,
            metadata: { ffmpeg_args: ffmpegArgs, edit_type: editType, engine: useGPU ? "mediabunny" : "ffmpeg" },
          })
          .select().single();

        if (version) {
          const v = version as VideoVersion;
          setVersions((prev) => [...prev, v]);
          setActiveVersion(v);
        }

        const engineUsed = useGPU ? "◈ GPU-accelerated" : "◎ Software";
        const aMsg: ChatMessage = {
          id: crypto.randomUUID(), role: "assistant",
          content: `◉ Edit applied — Version ${vNum} created.\n\n**Edit:** ${summary || refinedInstruction}\n**Type:** ${editType}\n**Engine:** ${engineUsed}\n\nThe edited video is now playing.`,
          versionId: version?.id,
        };
        setMessages((prev) => [...prev, aMsg]);
        await supabase.from("vibe_video_messages").insert({
          project_id: activeProject!.id, user_id: user!.id, role: "assistant", content: aMsg.content, version_id: version?.id,
        });
        setIsEditing(false);
        return;
      }

      // ── Plain chat response (with fallback JSON parsing) ────
      let reply = analyzeData?.reply || analyzeData?.instruction || "";
      
      // Fallback: if reply contains raw JSON with action:clarify, parse it
      if (reply) {
        try {
          const jsonMatch = reply.match(/\{[\s\S]*"action"\s*:\s*"(?:clarify|proceed)"[\s\S]*\}/);
          if (jsonMatch) {
            const fallbackParsed = JSON.parse(jsonMatch[0]);
            if (fallbackParsed.action === "clarify" && fallbackParsed.questions) {
              const questions: string[] = fallbackParsed.questions;
              const ctx = fallbackParsed.context || "";
              const replyText = ctx
                ? `◎ ${ctx}\n\n${questions.map((q: string, i: number) => `${i + 1}. ${q}`).join("\n")}`
                : questions.map((q: string, i: number) => `${i + 1}. ${q}`).join("\n");
              const aMsg: ChatMessage = {
                id: crypto.randomUUID(), role: "assistant",
                content: replyText, clarifyQuestions: questions,
              };
              setMessages((prev) => [...prev, aMsg]);
              await supabase.from("vibe_video_messages").insert({
                project_id: activeProject.id, user_id: user.id, role: "assistant", content: replyText,
              });
              setIsEditing(false);
              return;
            }
          }
        } catch {}
      }
      
      if (!reply) reply = "I'm ready to help. Upload a video or describe your edit!";
      const aMsg: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: reply };
      setMessages((prev) => [...prev, aMsg]);
      await supabase.from("vibe_video_messages").insert({
        project_id: activeProject.id, user_id: user.id, role: "assistant", content: reply,
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setIsEditing(false);
  };

  // ── Send message ────────────────────────────────────────────
  const sendMessage = async () => {
    if (!input.trim() || !activeProject) return;
    const instruction = input.trim();
    setInput("");

    if (isEditing || isProcessingQueue) {
      setQueue((prev) => [...prev, { id: crypto.randomUUID(), content: instruction }]);
      return;
    }

    await processMessage(instruction);
  };

  const loadVersion = (v: VideoVersion) => setActiveVersion(v);

  const downloadVideo = async () => {
    if (!activeVersion) return;
    try {
      const res = await fetch(activeVersion.video_url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vibe-video-v${activeVersion.version_number}.mp4`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { toast({ title: "Download failed", variant: "destructive" }); }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  // ── Landing ─────────────────────────────────────────────────
  if (!activeProject) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:py-12 gap-8 overflow-y-auto">
        <div className="text-center space-y-3 max-w-lg">
          <div className="flex items-center justify-center gap-3">
            <div className="p-3 rounded-2xl bg-accent/10 border border-accent/20">
              <Film className="h-7 w-7 text-accent" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extralight tracking-[0.15em] text-foreground">VIBE VIDEO</h1>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1">
            <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" /></span>
            <span className="text-[10px] font-medium tracking-[0.15em] text-amber-400 uppercase">Beta Testing</span>
          </div>
          <p className="text-sm font-extralight text-muted-foreground max-w-md mx-auto leading-relaxed">
            Upload a video, describe your edits in plain language, and Aureon AI analyzes and guides the transformation. Every version is tracked.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 w-full max-w-md">
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

        {projects.length > 0 && (
          <div className="w-full max-w-md space-y-3">
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
                      <Film className="h-3.5 w-3.5 text-muted-foreground/50" />
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

        <p className="text-[9px] text-muted-foreground/30 tracking-wider pb-4">AI-Powered Video Intelligence • Created By ZANOEM Software</p>
      </div>
    );
  }

  // ── Editor Layout ───────────────────────────────────────────
  return (
    <div className="flex flex-1 flex-col lg:flex-row h-full overflow-hidden p-2 sm:p-3 gap-2 sm:gap-3 pb-4 sm:pb-5">
      {/* Video Preview Panel */}
      <div className="flex-1 flex flex-col min-h-0 rounded-2xl border border-border/20 bg-card/10 backdrop-blur-md overflow-hidden order-2 lg:order-1">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/10 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <Film className="h-4 w-4 text-accent shrink-0" />
            <span className="text-xs font-light tracking-wider text-foreground/70 hidden sm:inline">VIBE VIDEO</span>
            {activeVersion && (
              <span className="text-[10px] text-muted-foreground/50">
                v{activeVersion.version_number}
                {activeVersion.is_uploaded && " • Original"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {activeVersion && (
              <>
                <Button size="sm" variant="ghost" onClick={togglePlay} className="h-8 w-8 p-0 rounded-xl">
                  {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                </Button>
                <Button size="sm" variant="ghost" onClick={downloadVideo} className="h-8 text-[10px] gap-1 rounded-xl px-2.5">
                  <Download className="h-3 w-3" />
                  <span className="hidden sm:inline">Export</span>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Video Canvas */}
        <div className="flex-1 relative min-h-0 overflow-auto flex items-center justify-center bg-[hsl(var(--background))] p-4">
          {activeVersion ? (
            <video
              ref={videoRef}
              src={activeVersion.video_url}
              className="max-w-full max-h-full rounded-xl shadow-2xl shadow-black/30"
              controls
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
            />
          ) : (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="p-6 rounded-3xl border border-dashed border-border/30 bg-card/20">
                <Upload className="h-10 w-10 text-muted-foreground/30" />
              </div>
              <p className="text-sm font-extralight text-muted-foreground/50">Upload a video to start editing</p>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="gap-2 text-xs rounded-xl"
              >
                <Upload className="h-3.5 w-3.5" /> Choose Video
              </Button>
            </div>
          )}
          {uploadProgress !== null && (
            <div className="absolute inset-0 bg-background/70 backdrop-blur-sm flex items-center justify-center rounded-b-2xl z-10">
              <div className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-card/80 border border-border/20 backdrop-blur-md min-w-[280px]">
                <Upload className="h-8 w-8 text-accent animate-pulse" />
                <p className="text-sm font-light text-foreground/80">Uploading video…</p>
                <div className="w-full">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] text-muted-foreground">{uploadProgress}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent transition-all duration-300 ease-out"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
          {ffmpegProgress !== null && (
            <div className="absolute inset-0 bg-background/70 backdrop-blur-sm flex items-center justify-center rounded-b-2xl z-10">
              <div className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-card/80 border border-border/20 backdrop-blur-md min-w-[280px]">
                <Wand2 className="h-8 w-8 text-accent animate-pulse" />
                <p className="text-sm font-light text-foreground/80">Processing video edit…</p>
                <p className="text-[10px] text-muted-foreground/60">Running in your browser via FFmpeg</p>
                <div className="w-full">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] text-muted-foreground">{ffmpegProgress}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent transition-all duration-300 ease-out"
                      style={{ width: `${ffmpegProgress}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
          {isEditing && ffmpegProgress === null && (
            <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center rounded-b-2xl">
              <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-card/80 border border-border/20 backdrop-blur-md">
                <Loader2 className="h-8 w-8 animate-spin text-accent" />
                <p className="text-sm font-light text-foreground/70">Aureon is analyzing your request…</p>
                <p className="text-[10px] text-muted-foreground/50">This may take a moment</p>
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
                  className={`flex-shrink-0 rounded-xl border transition-all px-3 py-2 ${
                    activeVersion?.id === v.id
                      ? "border-accent ring-1 ring-accent/30 shadow-md shadow-accent/10 bg-accent/10"
                      : "border-border/20 hover:border-foreground/20 bg-card/30"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Film className="h-3 w-3 text-muted-foreground/50" />
                    <span className="text-[10px] text-foreground/70">v{v.version_number}</span>
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
                        setMessages((prev) =>
                          prev.map((m) => m.id === msg.id ? { ...m, clarifyAnswered: true } : m)
                        );
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
                      <span className="whitespace-pre-wrap">{msg.content}</span>
                      {msg.videoUrl && (
                        <video src={msg.videoUrl} className="mt-2 rounded-xl max-w-full max-h-32 border border-border/10" controls />
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
                  <span className="text-[10px] text-muted-foreground">Aureon is analyzing…</span>
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
                  <div className="p-2 rounded-lg bg-muted/30 shrink-0">
                    <Film className="h-4 w-4 text-muted-foreground/50" />
                  </div>
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
              accept="video/*"
              className="hidden"
              onChange={handleUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isEditing}
              className="p-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors disabled:opacity-40"
              title="Upload video"
            >
              <Upload className="h-4 w-4" />
            </button>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder={isEditing ? "Type to queue next edit…" : activeVersion ? "Describe your edit…" : "Upload a video first…"}
              className="flex-1 min-h-[40px] max-h-[120px] resize-none rounded-xl border-border/20 bg-card/30 text-xs font-light placeholder:text-muted-foreground/40"
              rows={1}
            />
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || !activeProject}
              size="sm"
              className="h-10 w-10 rounded-xl bg-accent hover:bg-accent/90 p-0 shrink-0"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VibeVideoView;
