import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Upload, Image as ImageIcon, Video, Sparkles, Send, Copy, Check, Undo2,
  RotateCcw, AlertTriangle, Loader2, Wand2, Link as LinkIcon, FileCode2,
  ChevronRight, X, Crop, Eye,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// ── Types ─────────────────────────────────────────────────────────────────
type MediaType = "image" | "video";
interface Controls {
  width: number;        // %
  radius: number;       // px
  opacity: number;      // 0..100
  fit: "cover" | "contain" | "fill" | "scale-down";
  shadow: number;       // 0..40
  rotate: number;       // deg
  cropTop: number;      // %
  cropBottom: number;   // %
  cropLeft: number;     // %
  cropRight: number;    // %
}
interface EditTurn { id: string; role: "user" | "ai"; text: string; codeBefore?: string; codeAfter?: string; }
interface HistoryEntry { instruction: string; summary: string; }

// ── Config ────────────────────────────────────────────────────────────────
const MAX_INLINE_BYTES = 8 * 1024 * 1024;     // 8MB inline base64
const MAX_HOSTED_BYTES = 25 * 1024 * 1024;    // 25MB hosted upload
const ACCEPTED_IMAGE = ["image/jpeg","image/png","image/webp","image/gif","image/avif","image/svg+xml"];
const ACCEPTED_VIDEO = ["video/mp4","video/webm","video/quicktime","video/ogg"];

const DEFAULT_CONTROLS: Controls = {
  width: 100, radius: 0, opacity: 100, fit: "cover", shadow: 0, rotate: 0,
  cropTop: 0, cropBottom: 0, cropLeft: 0, cropRight: 0,
};

// ── Code generator ────────────────────────────────────────────────────────
function generateEmbedCode(mediaType: MediaType, src: string, c: Controls, autoplay = true): string {
  const clipPath = (c.cropTop || c.cropBottom || c.cropLeft || c.cropRight)
    ? `clip-path: inset(${c.cropTop}% ${c.cropRight}% ${c.cropBottom}% ${c.cropLeft}%);`
    : "";
  const shadow = c.shadow > 0 ? `box-shadow: 0 ${Math.round(c.shadow / 2)}px ${c.shadow * 2}px rgba(0,0,0,0.${Math.min(99, c.shadow * 2).toString().padStart(2,'0')});` : "";
  const rotate = c.rotate ? `transform: rotate(${c.rotate}deg);` : "";
  const tag = mediaType === "image"
    ? `<img src="${src}" alt="" loading="lazy" />`
    : `<video src="${src}"${autoplay ? " autoplay muted loop playsinline" : " controls playsinline"}></video>`;
  return `<div class="m2c-wrap">
  <style>
    .m2c-wrap{display:inline-block;max-width:100%;width:${c.width}%;line-height:0;overflow:hidden;border-radius:${c.radius}px;opacity:${(c.opacity/100).toFixed(2)};${shadow}${rotate}}
    .m2c-wrap img,.m2c-wrap video{display:block;width:100%;height:auto;object-fit:${c.fit};${clipPath}}
  </style>
  ${tag}
</div>`;
}

// ── File helpers ──────────────────────────────────────────────────────────
function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("File read failed"));
    r.readAsDataURL(file);
  });
}

// ── Component ─────────────────────────────────────────────────────────────
const AsherMediaToCodeModule = () => {
  const { toast } = useToast();
  const [mediaType, setMediaType] = useState<MediaType | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [objectUrl, setObjectUrl] = useState<string>("");
  const [dataUri, setDataUri] = useState<string>("");
  const [hostedUrl, setHostedUrl] = useState<string>("");
  const [outputMode, setOutputMode] = useState<"inline" | "hosted">("inline");
  const [controls, setControls] = useState<Controls>(DEFAULT_CONTROLS);
  const [videoReady, setVideoReady] = useState(false);
  const [hosting, setHosting] = useState(false);

  // AI chat
  const [chat, setChat] = useState<EditTurn[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [instruction, setInstruction] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiCode, setAiCode] = useState<string>("");        // AI-overridden code (if any)
  const [aiCodeStack, setAiCodeStack] = useState<string[]>([]); // for undo

  // UI
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Cleanup blob URL
  useEffect(() => {
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [objectUrl]);

  // ── Active source for code ───────────────────────────────────────────────
  const codeSrc = outputMode === "hosted" && hostedUrl ? hostedUrl : dataUri;
  const generatedCode = useMemo(
    () => (mediaType && codeSrc ? generateEmbedCode(mediaType, codeSrc, controls) : ""),
    [mediaType, codeSrc, controls],
  );
  // AI code substitutes placeholder {{MEDIA_SRC}} so AI never needs the heavy base64.
  const finalCode = useMemo(() => {
    if (!aiCode) return generatedCode;
    return aiCode.split("{{MEDIA_SRC}}").join(codeSrc);
  }, [aiCode, generatedCode, codeSrc]);

  // ── Validation + upload ──────────────────────────────────────────────────
  const handleFile = useCallback(async (f: File) => {
    setError("");
    const isImg = ACCEPTED_IMAGE.includes(f.type);
    const isVid = ACCEPTED_VIDEO.includes(f.type);
    if (!isImg && !isVid) {
      setError(`Unsupported file type: ${f.type || "unknown"}. Accepted: JPG, PNG, WebP, GIF, AVIF, SVG, MP4, WebM, MOV, OGG.`);
      return;
    }
    if (f.size > MAX_HOSTED_BYTES) {
      setError(`File too large (${(f.size/1024/1024).toFixed(1)}MB). Max 25MB.`);
      return;
    }
    const mt: MediaType = isImg ? "image" : "video";
    try {
      const uri = await fileToDataUri(f);
      // Probe load — if file is corrupted this catches it before render
      await new Promise<void>((resolve, reject) => {
        if (isImg) {
          const im = new Image();
          im.onload = () => resolve();
          im.onerror = () => reject(new Error("Image decode failed — file may be corrupted."));
          im.src = uri;
        } else {
          const vv = document.createElement("video");
          vv.preload = "metadata";
          vv.onloadedmetadata = () => resolve();
          vv.onerror = () => reject(new Error("Video decode failed — codec may be unsupported by this browser."));
          vv.src = uri;
        }
      });
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      const obj = URL.createObjectURL(f);
      setFile(f);
      setMediaType(mt);
      setObjectUrl(obj);
      setDataUri(uri);
      setControls(DEFAULT_CONTROLS);
      setAiCode("");
      setAiCodeStack([]);
      setChat([]);
      setHistory([]);
      setHostedUrl("");
      // Force inline mode if file too heavy for inline
      if (f.size > MAX_INLINE_BYTES) setOutputMode("hosted");
      else setOutputMode("inline");
      setVideoReady(isImg);
    } catch (err: any) {
      setError(err?.message || "Failed to load file.");
    }
  }, [objectUrl]);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (f) handleFile(f);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files?.[0]; if (f) handleFile(f);
  };

  // ── Hosted upload (lazy, only when user switches mode) ───────────────────
  const ensureHosted = useCallback(async () => {
    if (hostedUrl || !dataUri || !file) return;
    if (file.size > MAX_HOSTED_BYTES) {
      setError("File exceeds 25MB hosted limit."); return;
    }
    setHosting(true);
    try {
      const { data, error } = await supabase.functions.invoke("media-to-code", {
        body: { action: "host", dataUri, filename: file.name },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setHostedUrl(data.url);
      toast({ title: "Hosted URL ready", description: "Code now references a 30-day signed URL." });
    } catch (e: any) {
      setError(e?.message || "Hosting failed.");
      setOutputMode("inline");
    } finally { setHosting(false); }
  }, [dataUri, file, hostedUrl, toast]);

  useEffect(() => {
    if (outputMode === "hosted" && !hostedUrl && dataUri) ensureHosted();
  }, [outputMode, hostedUrl, dataUri, ensureHosted]);

  // ── AI edit ──────────────────────────────────────────────────────────────
  const sendAi = useCallback(async () => {
    const text = instruction.trim();
    if (!text || aiBusy || !mediaType) return;
    setAiBusy(true); setError("");
    // Use placeholder so AI never deals with multi-MB data URI
    const codeForAi = (aiCode || generatedCode).replace(codeSrc, "{{MEDIA_SRC}}");
    const turnId = Math.random().toString(36).slice(2, 9);
    setChat((c) => [...c, { id: turnId, role: "user", text }]);
    setInstruction("");
    const prevCode = aiCode;
    try {
      const { data, error } = await supabase.functions.invoke("media-to-code", {
        body: { action: "edit", instruction: text, currentCode: codeForAi, mediaType, history },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.clarify) {
        setChat((c) => [...c, { id: turnId + "r", role: "ai", text: data.clarify }]);
        return;
      }
      if (data?.code) {
        // Safety: ensure media src wasn't stripped — if AI dropped placeholder, restore from prev
        if (!data.code.includes("{{MEDIA_SRC}}") && !data.code.includes(codeSrc)) {
          throw new Error("AI dropped the media source. Reverting — try a more specific instruction.");
        }
        if (prevCode) setAiCodeStack((s) => [...s, prevCode]);
        else setAiCodeStack((s) => [...s, generatedCode.replace(codeSrc, "{{MEDIA_SRC}}")]);
        setAiCode(data.code);
        setHistory((h) => [...h, { instruction: text, summary: data.summary || text }]);
        setChat((c) => [...c, {
          id: turnId + "r", role: "ai",
          text: (data.summary || "Code updated.") + (data.notes ? `\n\n${data.notes}` : ""),
          codeBefore: prevCode || generatedCode, codeAfter: data.code,
        }]);
      } else {
        throw new Error("AI returned no code.");
      }
    } catch (e: any) {
      setError(e?.message || "AI edit failed. Last working code preserved.");
      setChat((c) => [...c, { id: turnId + "r", role: "ai", text: "Edit failed — kept previous code." }]);
    } finally { setAiBusy(false); }
  }, [instruction, aiBusy, mediaType, aiCode, generatedCode, codeSrc, history]);

  const undoAi = () => {
    if (!aiCodeStack.length) { setAiCode(""); return; }
    const stack = [...aiCodeStack];
    const prev = stack.pop()!;
    setAiCodeStack(stack);
    setAiCode(prev);
  };
  const resetAll = () => {
    setAiCode(""); setAiCodeStack([]); setChat([]); setHistory([]);
    setControls(DEFAULT_CONTROLS);
  };

  const copy = async () => {
    if (!finalCode) return;
    try {
      await navigator.clipboard.writeText(finalCode);
      setCopied(true); setTimeout(() => setCopied(false), 1800);
      toast({ title: "Copied", description: `${finalCode.length.toLocaleString()} chars in clipboard.` });
    } catch { setError("Clipboard blocked by browser."); }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="h-full w-full overflow-hidden bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border/15 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-foreground/10 to-transparent blur-md" />
            <Wand2 className="relative h-4 w-4 text-foreground" strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="text-sm font-extralight tracking-[0.3em] uppercase">Media → Code</h1>
            <p className="text-[9px] font-light tracking-[0.25em] text-muted-foreground/60 uppercase mt-0.5">
              Visual-to-Embed Pipeline · AI Co-Editor
            </p>
          </div>
        </div>
        {file && (
          <button onClick={resetAll}
            className="flex items-center gap-1.5 text-[10px] font-light tracking-[0.2em] uppercase text-muted-foreground/60 hover:text-foreground transition-colors">
            <RotateCcw className="h-3 w-3" /> Reset
          </button>
        )}
      </header>

      {error && (
        <div className="px-6 py-2 border-b border-destructive/30 bg-destructive/5 flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
          <span className="text-[11px] font-light text-destructive flex-1">{error}</span>
          <button onClick={() => setError("")} className="text-destructive/60 hover:text-destructive"><X className="h-3 w-3" /></button>
        </div>
      )}

      {!file ? (
        // ── Upload Zone ────────────────────────────────────────────────────
        <div className="flex-1 flex items-center justify-center p-8">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className={`relative w-full max-w-2xl aspect-[16/9] rounded-2xl border border-dashed cursor-pointer transition-all ${
              dragOver ? "border-foreground/40 bg-foreground/[0.04]" : "border-border/30 hover:border-border/60 hover:bg-foreground/[0.02]"
            }`}
          >
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center">
              <div className="flex gap-3">
                <ImageIcon className="h-6 w-6 text-muted-foreground/40" strokeWidth={1.2} />
                <Video className="h-6 w-6 text-muted-foreground/40" strokeWidth={1.2} />
              </div>
              <div>
                <p className="text-sm font-light text-foreground">Drop an image or video</p>
                <p className="text-[10px] font-light tracking-[0.2em] uppercase text-muted-foreground/50 mt-2">
                  or click to browse · max 25MB
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2">
                {["JPG","PNG","WebP","GIF","SVG","MP4","WebM","MOV"].map((x) => (
                  <span key={x} className="text-[8px] font-light tracking-[0.15em] uppercase text-muted-foreground/40 px-1.5 py-0.5 border border-border/15 rounded">{x}</span>
                ))}
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept={[...ACCEPTED_IMAGE, ...ACCEPTED_VIDEO].join(",")}
              onChange={onPick}
              className="hidden"
            />
          </div>
        </div>
      ) : (
        // ── Workbench ──────────────────────────────────────────────────────
        <div className="flex-1 grid grid-cols-12 overflow-hidden">
          {/* Preview */}
          <section className="col-span-5 border-r border-border/15 overflow-auto p-6 flex flex-col">
            <h2 className="text-[10px] font-light tracking-[0.3em] uppercase text-muted-foreground/60 mb-3 flex items-center gap-2">
              <Eye className="h-3 w-3" /> Live Preview
            </h2>
            <div className="flex-1 flex items-center justify-center rounded-xl border border-border/15 bg-foreground/[0.015] p-4 min-h-[280px] overflow-hidden">
              <div dangerouslySetInnerHTML={{ __html: finalCode }} />
            </div>
            {mediaType === "video" && (
              <div className="mt-3 rounded-lg border border-border/15 p-3 bg-foreground/[0.02]">
                <p className="text-[9px] font-light tracking-[0.25em] uppercase text-muted-foreground/60 mb-2">Source Video</p>
                <video
                  ref={videoRef} src={objectUrl} controls playsInline
                  onLoadedData={() => setVideoReady(true)}
                  className="w-full rounded max-h-40 bg-black"
                />
                {!videoReady && (
                  <p className="text-[10px] text-muted-foreground/50 mt-1 flex items-center gap-1.5">
                    <Loader2 className="h-2.5 w-2.5 animate-spin" /> Buffering...
                  </p>
                )}
              </div>
            )}
          </section>

          {/* Controls */}
          <section className="col-span-3 border-r border-border/15 overflow-auto p-5 space-y-5">
            <div>
              <h2 className="text-[10px] font-light tracking-[0.3em] uppercase text-muted-foreground/60 mb-3 flex items-center gap-2">
                <Crop className="h-3 w-3" /> Controls
              </h2>
              <div className="space-y-4">
                <Slider label="Width" value={controls.width} min={10} max={100} suffix="%" onChange={(v) => setControls({ ...controls, width: v })} />
                <Slider label="Radius" value={controls.radius} min={0} max={200} suffix="px" onChange={(v) => setControls({ ...controls, radius: v })} />
                <Slider label="Opacity" value={controls.opacity} min={10} max={100} suffix="%" onChange={(v) => setControls({ ...controls, opacity: v })} />
                <Slider label="Shadow" value={controls.shadow} min={0} max={40} onChange={(v) => setControls({ ...controls, shadow: v })} />
                <Slider label="Rotate" value={controls.rotate} min={-180} max={180} suffix="°" onChange={(v) => setControls({ ...controls, rotate: v })} />
                <div>
                  <label className="text-[9px] font-light tracking-[0.25em] uppercase text-muted-foreground/60">Object Fit</label>
                  <div className="grid grid-cols-4 gap-1 mt-1.5">
                    {(["cover","contain","fill","scale-down"] as const).map((f) => (
                      <button key={f} onClick={() => setControls({ ...controls, fit: f })}
                        className={`text-[9px] font-light tracking-wider py-1 rounded border transition-colors ${
                          controls.fit === f ? "border-foreground/40 bg-foreground/10 text-foreground" : "border-border/20 text-muted-foreground/60 hover:text-foreground"
                        }`}>{f}</button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Slider label="Crop ↑" value={controls.cropTop} min={0} max={45} suffix="%" onChange={(v) => setControls({ ...controls, cropTop: v })} />
                  <Slider label="Crop ↓" value={controls.cropBottom} min={0} max={45} suffix="%" onChange={(v) => setControls({ ...controls, cropBottom: v })} />
                  <Slider label="Crop ←" value={controls.cropLeft} min={0} max={45} suffix="%" onChange={(v) => setControls({ ...controls, cropLeft: v })} />
                  <Slider label="Crop →" value={controls.cropRight} min={0} max={45} suffix="%" onChange={(v) => setControls({ ...controls, cropRight: v })} />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-border/15">
              <h2 className="text-[10px] font-light tracking-[0.3em] uppercase text-muted-foreground/60 mb-3">Output Mode</h2>
              <div className="grid grid-cols-2 gap-1.5">
                <button onClick={() => setOutputMode("inline")}
                  className={`flex flex-col items-start gap-1 p-2.5 rounded border transition-colors ${
                    outputMode === "inline" ? "border-foreground/40 bg-foreground/10" : "border-border/20 hover:bg-foreground/[0.03]"
                  }`}>
                  <div className="flex items-center gap-1.5"><FileCode2 className="h-3 w-3" /><span className="text-[10px] font-light tracking-wider">Inline</span></div>
                  <span className="text-[8px] text-muted-foreground/50 tracking-wider">base64 · works anywhere</span>
                </button>
                <button onClick={() => setOutputMode("hosted")} disabled={!!file && file.size > MAX_HOSTED_BYTES}
                  className={`flex flex-col items-start gap-1 p-2.5 rounded border transition-colors disabled:opacity-30 ${
                    outputMode === "hosted" ? "border-foreground/40 bg-foreground/10" : "border-border/20 hover:bg-foreground/[0.03]"
                  }`}>
                  <div className="flex items-center gap-1.5"><LinkIcon className="h-3 w-3" /><span className="text-[10px] font-light tracking-wider">Hosted</span></div>
                  <span className="text-[8px] text-muted-foreground/50 tracking-wider">URL · 30-day signed</span>
                </button>
              </div>
              {hosting && (
                <p className="text-[9px] text-muted-foreground/60 mt-2 flex items-center gap-1.5"><Loader2 className="h-2.5 w-2.5 animate-spin" /> Uploading…</p>
              )}
              {file && (
                <p className="text-[8px] text-muted-foreground/40 mt-2 tracking-wider uppercase">
                  {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB · {mediaType}
                </p>
              )}
            </div>
          </section>

          {/* Code + AI */}
          <section className="col-span-4 flex flex-col overflow-hidden">
            <div className="border-b border-border/15 p-4 flex items-center justify-between">
              <h2 className="text-[10px] font-light tracking-[0.3em] uppercase text-muted-foreground/60">Embed Code</h2>
              <div className="flex items-center gap-1">
                {aiCode && (
                  <button onClick={undoAi} title="Undo AI edit"
                    className="p-1.5 rounded hover:bg-foreground/5 text-muted-foreground hover:text-foreground transition-colors">
                    <Undo2 className="h-3 w-3" />
                  </button>
                )}
                <button onClick={copy}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-border/30 hover:bg-foreground/5 transition-colors">
                  {copied ? <Check className="h-3 w-3 text-foreground" /> : <Copy className="h-3 w-3" />}
                  <span className="text-[10px] font-light tracking-wider">{copied ? "Copied" : "Copy"}</span>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 font-mono text-[10px] leading-relaxed text-muted-foreground bg-foreground/[0.015] whitespace-pre-wrap break-all">
              {finalCode || "—"}
            </div>

            {/* AI Chat */}
            <div className="border-t border-border/15 p-4 max-h-[40%] overflow-auto space-y-2">
              <h3 className="text-[10px] font-light tracking-[0.3em] uppercase text-muted-foreground/60 flex items-center gap-2 mb-2">
                <Sparkles className="h-3 w-3" /> AI Co-Editor
                {history.length > 0 && <span className="text-[8px] text-muted-foreground/40">· {history.length} edits</span>}
              </h3>
              {chat.length === 0 && (
                <div className="text-[10px] text-muted-foreground/50 font-light italic space-y-1">
                  <p>Examples:</p>
                  <p className="text-muted-foreground/40">"make it a circle with a soft shadow"</p>
                  <p className="text-muted-foreground/40">"add a hover scale animation"</p>
                  <p className="text-muted-foreground/40">"make it responsive for mobile"</p>
                </div>
              )}
              {chat.map((t) => (
                <div key={t.id} className={`text-[10px] leading-relaxed ${t.role === "user" ? "text-foreground" : "text-muted-foreground"}`}>
                  <span className="text-[8px] tracking-[0.2em] uppercase text-muted-foreground/40 mr-2">{t.role === "user" ? "You" : "AI"}</span>
                  {t.text}
                </div>
              ))}
              {aiBusy && <div className="text-[10px] text-muted-foreground/50 flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Thinking…</div>}
            </div>
            <div className="border-t border-border/15 p-3 flex items-center gap-2">
              <input
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !aiBusy) sendAi(); }}
                placeholder="Type an instruction…"
                disabled={aiBusy}
                className="flex-1 bg-transparent border border-border/30 rounded-lg px-3 py-2 text-[11px] font-light placeholder:text-muted-foreground/40 focus:outline-none focus:border-foreground/40"
              />
              <button
                onClick={sendAi} disabled={aiBusy || !instruction.trim()}
                className="p-2 rounded-lg border border-border/30 hover:bg-foreground/5 disabled:opacity-30 transition-colors"
              >
                {aiBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

// ── Slider primitive ──────────────────────────────────────────────────────
const Slider = ({ label, value, min, max, suffix = "", onChange }: {
  label: string; value: number; min: number; max: number; suffix?: string; onChange: (v: number) => void;
}) => (
  <div>
    <div className="flex items-center justify-between mb-1">
      <label className="text-[9px] font-light tracking-[0.25em] uppercase text-muted-foreground/60">{label}</label>
      <span className="text-[9px] font-mono text-muted-foreground">{value}{suffix}</span>
    </div>
    <input
      type="range" min={min} max={max} value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full h-1 bg-foreground/10 rounded-full appearance-none cursor-pointer accent-foreground"
    />
  </div>
);

export default AsherMediaToCodeModule;
