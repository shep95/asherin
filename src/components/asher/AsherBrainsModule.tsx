// ASHER BRAINS — admin-only personality + knowledge file vault.
// Gated by passcode "HOS080825" in addition to the super-owner RLS check.
// Files uploaded here are injected into ASHER AI's system prompt at runtime.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Brain, Upload, Loader2, Trash2, ToggleLeft, ToggleRight, FileText,
  ShieldAlert, Lock, Search, Filter, Eye, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  AsherBrain,
  AsherBrainCategory,
  BRAIN_CATEGORIES,
  isSupportedBrainFile,
  readBrainFile,
} from "@/lib/asherBrains";
import { logAsherEvent } from "@/lib/asherAudit";

const ADMIN_EMAIL = "ashernewtonx@gmail.com";
const CONTRIBUTOR_EMAILS = ["ashernewtonx@gmail.com", "ekk447@gmail.com"];
const BRAINS_PASSCODE = "HOS080825";
const BRAINS_GATE_KEY = "asher_brains_unlocked";

const BrainsPasscodeGate = ({ onUnlock }: { onUnlock: () => void }) => {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code === BRAINS_PASSCODE) {
      try { sessionStorage.setItem(BRAINS_GATE_KEY, "1"); } catch {}
      logAsherEvent("module_open", { module: "asher_brains_unlocked" });
      onUnlock();
    } else {
      logAsherEvent("passcode_failure", { module: "asher_brains" });
      setError("ACCESS DENIED — Invalid brain vault code.");
      setCode("");
    }
  };

  return (
    <div className="flex h-full w-full items-center justify-center bg-background text-foreground px-6">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-xl p-8">
          <div className="flex items-center gap-2 mb-6">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-50" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
            <p className="text-xs font-light tracking-[0.3em] text-muted-foreground/70 uppercase">
              Sealed Vault
            </p>
          </div>
          <h1 className="text-2xl font-extralight tracking-[0.2em] text-foreground mb-2">ASHER BRAINS</h1>
          <p className="text-xs font-light tracking-[0.15em] text-muted-foreground/60 uppercase mb-8">
            Personality &amp; Knowledge Core — Clearance Required
          </p>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-light tracking-[0.2em] text-muted-foreground/70 uppercase mb-2">
                Vault Code
              </label>
              <input
                type="password"
                autoFocus
                value={code}
                onChange={(e) => { setCode(e.target.value); setError(""); }}
                placeholder="Enter brain vault code"
                className="w-full rounded-lg border border-border/30 bg-background/40 px-4 py-3 text-sm font-light tracking-wider text-foreground placeholder:text-muted-foreground/40 focus:border-foreground/40 focus:outline-none transition-colors"
              />
            </div>
            {error && (
              <div className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2">
                <ShieldAlert className="h-3.5 w-3.5 text-red-400" strokeWidth={1.5} />
                <p className="text-[11px] font-light tracking-wide text-red-300">{error}</p>
              </div>
            )}
            <button
              type="submit"
              className="w-full rounded-lg bg-foreground/90 px-4 py-3 text-xs font-light tracking-[0.2em] text-background hover:bg-foreground transition-colors uppercase"
            >
              Authenticate
            </button>
          </form>
        </div>
        <p className="mt-6 text-center text-[9px] font-light tracking-[0.25em] text-muted-foreground/30 uppercase">
          Every upload, toggle, and deletion is audit-logged
        </p>
      </div>
    </div>
  );
};

const BrainPreview = ({ brain, onClose }: { brain: AsherBrain; onClose: () => void }) => (
  <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-background/80 backdrop-blur-md p-6" onClick={onClose}>
    <div
      className="relative w-full max-w-3xl max-h-[80vh] flex flex-col rounded-2xl border border-border/30 bg-card/95 backdrop-blur-xl shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b border-border/20 px-5 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-3.5 w-3.5 text-foreground/70 shrink-0" strokeWidth={1.5} />
          <p className="text-[11px] font-light tracking-[0.2em] text-foreground uppercase truncate">{brain.name}</p>
          <span className="text-[8px] font-light tracking-[0.25em] text-red-400/70 uppercase shrink-0">
            {brain.category}
          </span>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-foreground/5">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <pre className="text-[11px] font-mono font-light text-foreground/80 whitespace-pre-wrap break-words leading-relaxed">
          {brain.content || "[empty]"}
        </pre>
      </div>
      <div className="border-t border-border/20 px-5 py-2 text-[9px] font-light tracking-[0.2em] text-muted-foreground/50 uppercase">
        {brain.file_name} · {(brain.content.length / 1000).toFixed(1)}k chars
      </div>
    </div>
  </div>
);

const AsherBrainsModule = () => {
  const { user } = useAuth();
  const isAdmin = user?.email === ADMIN_EMAIL;
  const canContribute = !!user?.email && CONTRIBUTOR_EMAILS.includes(user.email.toLowerCase());

  const [unlocked, setUnlocked] = useState<boolean>(() => {
    try { return sessionStorage.getItem(BRAINS_GATE_KEY) === "1"; } catch { return false; }
  });
  const [brains, setBrains] = useState<AsherBrain[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<AsherBrainCategory>("personality");
  const [filter, setFilter] = useState<AsherBrainCategory | "all">("all");
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<AsherBrain | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("asher_brains")
      .select("*")
      .order("category", { ascending: true })
      .order("created_at", { ascending: false });
    setBrains((data as AsherBrain[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { if (unlocked && canContribute) void refresh(); }, [unlocked, canContribute, refresh]);

  const [failed, setFailed] = useState<{ file: File; category: AsherBrainCategory; error: string }[]>([]);

  const sanitizeForPg = (s: string) =>
    s
      .replace(/\u0000/g, "")
      .replace(/\\u0000/g, "")
      // strip ALL backslash-u escape sequences postgres might try to interpret
      .replace(/\\u[dD][89aAbB][0-9a-fA-F]{2}/g, "")
      .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, "")
      .replace(/(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "$1")
      // remove other control chars except \n \r \t
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");

  const uploadOne = async (file: File, category: AsherBrainCategory, attempt = 1): Promise<{ ok: boolean; error?: string }> => {
    if (!isSupportedBrainFile(file.name)) return { ok: false, error: "unsupported format" };
    try {
      const rawText = await readBrainFile(file);
      let text = sanitizeForPg(rawText);
      // On retry, be more aggressive: keep only printable ASCII + newlines
      if (attempt > 1) {
        text = text.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
      }
      const name = file.name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " ");
      const filePath = `${user?.id ?? "admin"}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: uploadErr } = await supabase.storage.from("asher-brains").upload(filePath, file, { upsert: false });
      if (uploadErr) console.warn("brain file storage upload failed:", uploadErr.message);

      const { data: row, error } = await supabase
        .from("asher_brains")
        .insert({
          name,
          description: `Uploaded ${file.name}`,
          category,
          content: text,
          file_name: file.name,
          file_path: uploadErr ? null : filePath,
          file_size: file.size,
          uploaded_by: user?.id,
          is_active: true,
        })
        .select()
        .single();
      if (error) {
        if (attempt < 3) return uploadOne(file, category, attempt + 1);
        return { ok: false, error: error.message };
      }
      if (row) {
        setBrains((p) => [row as AsherBrain, ...p]);
        toast.success(`"${name}" → ${category.toUpperCase()}`);
        logAsherEvent("module_open", { module: "asher_brain_uploaded", category, size: file.size });
      }
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message || "read failed" };
    }
  };

  const upload = async (files: FileList | File[]) => {
    if (!canContribute) return;
    const arr = Array.from(files);
    if (!arr.length) return;
    setUploading(true);
    const newFailed: { file: File; category: AsherBrainCategory; error: string }[] = [];
    for (const file of arr) {
      const res = await uploadOne(file, uploadCategory);
      if (!res.ok) {
        newFailed.push({ file, category: uploadCategory, error: res.error || "unknown" });
        toast.error(`${file.name}: ${res.error}`);
      }
    }
    setFailed((prev) => [...prev, ...newFailed]);
    setUploading(false);
  };

  const retryFailed = async () => {
    if (!failed.length) return;
    setUploading(true);
    const stillFailed: typeof failed = [];
    for (const f of failed) {
      const res = await uploadOne(f.file, f.category);
      if (!res.ok) stillFailed.push({ ...f, error: res.error || "unknown" });
    }
    setFailed(stillFailed);
    if (stillFailed.length === 0) toast.success("All failed uploads recovered");
    else toast.error(`${stillFailed.length} still failed`);
    setUploading(false);
  };

  const toggle = async (b: AsherBrain) => {
    const next = !b.is_active;
    setBrains((p) => p.map((x) => (x.id === b.id ? { ...x, is_active: next } : x)));
    const { error } = await supabase.from("asher_brains").update({ is_active: next }).eq("id", b.id);
    if (error) {
      toast.error(error.message);
      setBrains((p) => p.map((x) => (x.id === b.id ? { ...x, is_active: b.is_active } : x)));
    }
  };

  const remove = async (b: AsherBrain) => {
    if (!isAdmin) {
      toast.error("Only the super owner can delete brains.");
      return;
    }
    if (!confirm(`Delete "${b.name}"? This cannot be undone.`)) return;
    setBrains((p) => p.filter((x) => x.id !== b.id));
    if (b.file_path) {
      await supabase.storage.from("asher-brains").remove([b.file_path]).catch(() => {});
    }
    const { error } = await supabase.from("asher_brains").delete().eq("id", b.id);
    if (error) {
      toast.error(error.message);
      void refresh();
    } else {
      toast.success("Brain purged");
      logAsherEvent("module_open", { module: "asher_brain_deleted", category: b.category });
    }
  };

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragging(true);
  }, []);
  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (dropRef.current && e.relatedTarget instanceof Node && dropRef.current.contains(e.relatedTarget)) return;
    setDragging(false);
  }, []);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragging(false);
    if (e.dataTransfer.files.length) void upload(e.dataTransfer.files);
  }, [uploadCategory, canContribute, user?.id]);

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = brains.filter((b) => {
      if (filter !== "all" && b.category !== filter) return false;
      if (q && !`${b.name} ${b.description} ${b.file_name}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const map: Record<string, AsherBrain[]> = {};
    for (const b of filtered) (map[b.category] ||= []).push(b);
    return map;
  }, [brains, filter, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: brains.length };
    for (const b of brains) c[b.category] = (c[b.category] || 0) + 1;
    return c;
  }, [brains]);

  if (!canContribute) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background px-6">
        <div className="max-w-md text-center">
          <Lock className="h-8 w-8 mx-auto text-muted-foreground/40 mb-4" strokeWidth={1.2} />
          <p className="text-sm font-light tracking-[0.2em] text-foreground uppercase mb-2">Restricted</p>
          <p className="text-[11px] font-light text-muted-foreground/60">
            ASHER BRAINS is reserved for authorized contributors.
          </p>
        </div>
      </div>
    );
  }

  if (!unlocked) return <BrainsPasscodeGate onUnlock={() => setUnlocked(true)} />;

  return (
    <div
      ref={dropRef}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className="relative flex h-full w-full flex-col bg-background text-foreground"
    >
      {/* Toolbar */}
      <div className="shrink-0 flex items-center justify-between border-b border-border/15 px-4 py-2.5 bg-card/30 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Brain className="h-3.5 w-3.5 text-foreground/70" strokeWidth={1.5} />
          <p className="text-[10px] font-light tracking-[0.3em] text-foreground/80 uppercase">
            ASHER BRAINS · Personality &amp; Knowledge Core
          </p>
          <span className="text-[9px] font-light tracking-[0.25em] text-emerald-400/70 uppercase">
            {brains.filter((b) => b.is_active).length} Active
          </span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={uploadCategory}
            onChange={(e) => setUploadCategory(e.target.value as AsherBrainCategory)}
            className="rounded-md border border-border/30 bg-background/40 px-2 py-1 text-[10px] font-light tracking-[0.15em] text-foreground uppercase focus:outline-none focus:border-foreground/40"
          >
            {BRAIN_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".txt,.md,.json,.csv,.pdf,.log,.yml,.yaml"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              if (e.target.files) void upload(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => !uploading && inputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 rounded-md border border-border/30 bg-foreground/5 px-2.5 py-1 text-[10px] font-light tracking-[0.15em] text-foreground uppercase hover:bg-foreground/10 disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            Upload
          </button>
          {failed.length > 0 && (
            <button
              onClick={retryFailed}
              disabled={uploading}
              className="flex items-center gap-1.5 rounded-md border border-amber-400/40 bg-amber-400/10 px-2.5 py-1 text-[10px] font-light tracking-[0.15em] text-amber-300 uppercase hover:bg-amber-400/20 disabled:opacity-50"
              title={failed.map((f) => `${f.file.name}: ${f.error}`).join("\n")}
            >
              {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
              Retry Failed ({failed.length})
            </button>
          )}
        </div>
      </div>

      {/* Filter strip */}
      <div className="shrink-0 flex items-center gap-2 border-b border-border/15 px-4 py-2 bg-background">
        <Filter className="h-3 w-3 text-muted-foreground/60" strokeWidth={1.5} />
        <button
          onClick={() => setFilter("all")}
          className={`rounded-md px-2 py-0.5 text-[10px] font-light tracking-[0.2em] uppercase transition-colors ${
            filter === "all" ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          All <span className="text-muted-foreground/50">({counts.all || 0})</span>
        </button>
        {BRAIN_CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setFilter(c.id)}
            className={`rounded-md px-2 py-0.5 text-[10px] font-light tracking-[0.2em] uppercase transition-colors ${
              filter === c.id ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {c.label} <span className="text-muted-foreground/50">({counts[c.id] || 0})</span>
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1.5 rounded-md border border-border/20 bg-background/40 px-2 py-1 w-64">
          <Search className="h-3 w-3 text-muted-foreground/60" strokeWidth={1.5} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search brains…"
            className="w-full bg-transparent text-[11px] font-light text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
          />
        </div>
      </div>

      {/* Drag overlay */}
      {dragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm pointer-events-none border-2 border-dashed border-foreground/30">
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-8 w-8 text-foreground animate-bounce" strokeWidth={1.2} />
            <p className="text-[11px] font-light tracking-[0.3em] text-foreground uppercase">
              Drop into → {uploadCategory.toUpperCase()}
            </p>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : brains.length === 0 ? (
          <button
            onClick={() => inputRef.current?.click()}
            className="block w-full max-w-2xl mx-auto rounded-xl border border-dashed border-border/30 bg-card/20 p-12 text-center hover:bg-card/30 transition-colors"
          >
            <Brain className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" strokeWidth={1.2} />
            <p className="text-xs font-light tracking-[0.2em] text-foreground uppercase mb-1">
              No brains uploaded yet
            </p>
            <p className="text-[10px] font-light text-muted-foreground/50">
              Click here or drag &amp; drop .txt / .md / .pdf / .json / .csv / .yaml files.
            </p>
            <p className="text-[9px] font-light tracking-[0.2em] text-muted-foreground/40 mt-3 uppercase">
              Active brains are injected into ASHER AI's system prompt
            </p>
          </button>
        ) : (
          <div className="max-w-5xl mx-auto space-y-6">
            {(filter === "all" ? BRAIN_CATEGORIES.map((c) => c.id) : [filter as AsherBrainCategory])
              .filter((cat) => (grouped[cat] || []).length > 0)
              .map((cat) => {
                const meta = BRAIN_CATEGORIES.find((c) => c.id === cat)!;
                const items = grouped[cat] || [];
                return (
                  <div key={cat}>
                    <div className="flex items-baseline justify-between border-b border-border/15 pb-1.5 mb-2">
                      <div className="flex items-baseline gap-2">
                        <p className="text-[10px] font-light tracking-[0.3em] text-foreground uppercase">{meta.label}</p>
                        <p className="text-[9px] font-light tracking-[0.2em] text-muted-foreground/50 uppercase">{meta.sub}</p>
                      </div>
                      <p className="text-[9px] font-light tracking-[0.2em] text-muted-foreground/50 uppercase">
                        {items.filter((b) => b.is_active).length} / {items.length} active
                      </p>
                    </div>
                    <div className="space-y-1">
                      {items.map((b) => (
                        <div
                          key={b.id}
                          className={`group flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-all ${
                            b.is_active
                              ? "border-emerald-500/20 bg-emerald-500/[0.03]"
                              : "border-border/10 bg-card/20"
                          }`}
                        >
                          <FileText
                            className={`h-3.5 w-3.5 shrink-0 ${b.is_active ? "text-emerald-400/80" : "text-muted-foreground/40"}`}
                            strokeWidth={1.5}
                          />
                          <div className="flex-1 min-w-0">
                            <p className={`text-[12px] font-light truncate ${b.is_active ? "text-foreground" : "text-muted-foreground/60"}`}>
                              {b.name}
                            </p>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="text-[9px] font-light tracking-[0.15em] text-muted-foreground/40 uppercase truncate">
                                {b.file_name}
                              </span>
                              <span className="text-[9px] font-light text-muted-foreground/40">
                                {(b.content.length / 1000).toFixed(1)}k chars
                              </span>
                              <span className="text-[9px] font-light text-muted-foreground/40">
                                {new Date(b.created_at).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => setPreview(b)}
                              title="Preview content"
                              className="p-1.5 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-foreground/5"
                            >
                              <Eye className="h-3.5 w-3.5" strokeWidth={1.5} />
                            </button>
                            <button
                              onClick={() => void toggle(b)}
                              title={b.is_active ? "Deactivate" : "Activate"}
                              className="p-1 rounded-md hover:bg-foreground/5"
                            >
                              {b.is_active
                                ? <ToggleRight className="h-4 w-4 text-emerald-400" strokeWidth={1.5} />
                                : <ToggleLeft className="h-4 w-4 text-muted-foreground/40" strokeWidth={1.5} />}
                            </button>
                            <button
                              onClick={() => void remove(b)}
                              title="Delete"
                              className="p-1.5 rounded-md text-muted-foreground/40 hover:text-red-400 hover:bg-red-500/5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {preview && <BrainPreview brain={preview} onClose={() => setPreview(null)} />}
    </div>
  );
};

export default AsherBrainsModule;
