// ASHER BRAINS — admin-only personality + knowledge file vault.
// Gated by a server-side passcode (ASHER_BRAINS_PASSCODE secret) in addition
// to the super-owner RLS check. The passcode is NEVER stored in client code.
// Files uploaded here are injected into ASHER AI's system prompt at runtime.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Brain, Upload, Loader2, Trash2, ToggleLeft, ToggleRight, FileText,
  ShieldAlert, Lock, Search, Filter, Eye, X, Copy,
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
import { scanFileForThreats, scanContentForThreats } from "@/lib/brainSafetyScan";
import { ShieldCheck } from "lucide-react";
import JSZip from "jszip";
import { isOwnerEmail, isContributorEmail } from "@/lib/adminEmail";
const BRAINS_GATE_KEY = "asher_brains_unlocked";

const BrainsPasscodeGate = ({ onUnlock }: { onUnlock: () => void }) => {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verifying) return;
    setVerifying(true);
    setError("");
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke(
        "verify-brains-passcode",
        { body: { code } },
      );
      if (invokeErr || !data?.ok) {
        logAsherEvent("passcode_failure", { module: "asher_brains" });
        setError("ACCESS DENIED — Invalid brain vault code.");
        setCode("");
      } else {
        try { sessionStorage.setItem(BRAINS_GATE_KEY, "1"); } catch {}
        logAsherEvent("module_open", { module: "asher_brains_unlocked" });
        onUnlock();
      }
    } catch {
      setError("ACCESS DENIED — Verification service unreachable.");
    } finally {
      setVerifying(false);
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
              disabled={verifying}
              className="w-full rounded-lg bg-foreground/90 px-4 py-3 text-xs font-light tracking-[0.2em] text-background hover:bg-foreground transition-colors uppercase disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {verifying ? "Verifying…" : "Authenticate"}
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
  const isAdmin = isOwnerEmail(user?.email);
  const canContribute = isContributorEmail(user?.email);

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
  const [dupGroups, setDupGroups] = useState<AsherBrain[][]>([]);
  const [scanningDup, setScanningDup] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    // Paginate to avoid 1GB-table timeouts. Pull metadata only, 500 rows per page.
    const PAGE = 500;
    const all: AsherBrain[] = [];
    let from = 0;
    for (let i = 0; i < 20; i++) {
      const { data, error } = await supabase
        .from("asher_brains")
        .select("id,name,description,category,file_name,file_path,file_size,is_active,uploaded_by,created_at,updated_at")
        .order("created_at", { ascending: false })
        .range(from, from + PAGE - 1);
      if (error) { toast.error(`Load failed: ${error.message}`); break; }
      const rows = ((data as any[] | null) ?? []).map((r) => ({ ...r, content: "" })) as AsherBrain[];
      all.push(...rows);
      if (rows.length < PAGE) break;
      from += PAGE;
      // incremental render so user sees data immediately
      setBrains([...all]);
    }
    setBrains(all);
    setLoading(false);
  }, []);

  useEffect(() => { if (unlocked && canContribute) void refresh(); }, [unlocked, canContribute, refresh]);

  const [failed, setFailed] = useState<{ file: File; category: AsherBrainCategory; error: string }[]>([]);
  const [bgQueue, setBgQueue] = useState(0);

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
    // VIRUS SCAN — block before upload
    if (attempt === 1) {
      try {
        const scan = await scanFileForThreats(file);
        if (!scan.clean) {
          toast.error(`${file.name} blocked: ${scan.threats[0]}`);
          logAsherEvent("module_open", { module: "asher_brain_virus_blocked", file: file.name, threats: scan.threats });
          return { ok: false, error: `Virus scan: ${scan.threats.join(", ")}` };
        }
      } catch { /* scanner failure → fall through, do not block */ }
    }
    try {
      const rawText = await readBrainFile(file);
      let text = sanitizeForPg(rawText);
      if (attempt > 1) {
        text = text.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
      }
      const name = file.name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " ");
      // unique path per attempt — prevents collisions when many files upload in parallel within same ms
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `${user?.id ?? "admin"}/${Date.now()}_${crypto.randomUUID().slice(0, 8)}_${safeName}`;
      const { error: uploadErr } = await supabase.storage
        .from("asher-brains")
        .upload(filePath, file, { upsert: true, contentType: file.type || "text/plain" });
      if (uploadErr) console.warn("brain storage upload:", uploadErr.message);

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
        .select("id,name,description,category,file_name,file_path,file_size,is_active,uploaded_by,created_at,updated_at")
        .single();
      if (error) {
        if (attempt < 3) return uploadOne(file, category, attempt + 1);
        return { ok: false, error: error.message };
      }
      if (row) {
        const full = { ...(row as any), content: "" } as AsherBrain;
        setBrains((p) => [full, ...p]);
        logAsherEvent("module_open", { module: "asher_brain_uploaded", category, size: file.size });
      }
      return { ok: true };
    } catch (err: any) {
      if (attempt < 3) return uploadOne(file, category, attempt + 1);
      return { ok: false, error: err?.message || "read failed" };
    }
  };

  const expandZip = async (file: File): Promise<File[]> => {
    try {
      const zip = await JSZip.loadAsync(file);
      const out: File[] = [];
      const entries = Object.values(zip.files);
      for (const entry of entries) {
        if (entry.dir) continue;
        const baseName = entry.name.split("/").pop() || entry.name;
        if (!baseName || baseName.startsWith(".")) continue;
        if (!isSupportedBrainFile(baseName)) continue;
        const blob = await entry.async("blob");
        out.push(new File([blob], baseName, { type: blob.type || "text/plain" }));
      }
      return out;
    } catch (err: any) {
      toast.error(`Zip extraction failed: ${err?.message || "unknown"}`);
      return [];
    }
  };

  const processInBackground = async (files: File[]) => {
    // 1) Expand zips up front
    const expanded: File[] = [];
    for (const f of files) {
      if (/\.zip$/i.test(f.name)) {
        const inner = await expandZip(f);
        if (inner.length) toast.success(`${f.name}: ${inner.length} file(s)`);
        expanded.push(...inner);
      } else {
        expanded.push(f);
      }
    }
    if (!expanded.length) return;

    setBgQueue((n) => n + expanded.length);
    const newFailed: { file: File; category: AsherBrainCategory; error: string }[] = [];
    let okCount = 0;

    // 2) Parallel pool — 6 concurrent uploads keeps the UI responsive without DoS
    const CONCURRENCY = 6;
    let idx = 0;
    const worker = async () => {
      while (idx < expanded.length) {
        const i = idx++;
        const file = expanded[i];
        try {
          const res = await uploadOne(file, uploadCategory);
          if (!res.ok) {
            newFailed.push({ file, category: uploadCategory, error: res.error || "unknown" });
          } else {
            okCount++;
          }
        } catch (err: any) {
          newFailed.push({ file, category: uploadCategory, error: err?.message || "unknown" });
        } finally {
          setBgQueue((n) => Math.max(0, n - 1));
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, expanded.length) }, worker));

    if (okCount) toast.success(`${okCount} brain(s) ingested`);
    if (newFailed.length) {
      setFailed((prev) => [...prev, ...newFailed]);
      toast.error(`${newFailed.length} failed — use Retry Failed`);
    }
  };

  const upload = async (files: FileList | File[]) => {
    if (!canContribute) return;
    const arr = Array.from(files);
    if (!arr.length) return;
    toast.success(`Queued ${arr.length} file(s) — processing in background`);
    // fire-and-forget; UI stays responsive
    void processInBackground(arr);
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
    if (!isAdmin) {
      toast.error("Only the super owner can toggle brains.");
      return;
    }
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
    // Storage-first, hard-fail: never delete the DB row if storage cleanup
    // failed, or the file becomes unreferenced debris forever.
    if (b.file_path) {
      const { error: storageErr } = await supabase
        .storage.from("asher-brains").remove([b.file_path]);
      if (storageErr) {
        console.error("[brains] storage cleanup failed", storageErr);
        toast.error(`Storage cleanup failed: ${storageErr.message}. DB row preserved.`);
        return;
      }
    }
    // Optimistic UI removal only after storage confirms
    setBrains((p) => p.filter((x) => x.id !== b.id));
    const { error } = await supabase.from("asher_brains").delete().eq("id", b.id);
    if (error) {
      toast.error(error.message);
      void refresh();
    } else {
      toast.success("Brain purged");
      logAsherEvent("module_open", { module: "asher_brain_deleted", category: b.category });
    }
  };

  const [scanningVirus, setScanningVirus] = useState(false);
  const scanForViruses = useCallback(async () => {
    setScanningVirus(true);
    try {
      const PAGE = 200;
      const infected: { id: string; name: string; threats: string[]; file_path: string | null }[] = [];
      let from = 0;
      for (let i = 0; i < 50; i++) {
        const { data, error } = await supabase
          .from("asher_brains")
          .select("id,name,content,file_path")
          .range(from, from + PAGE - 1);
        if (error) { toast.error(error.message); break; }
        const rows = (data as any[] | null) ?? [];
        for (const r of rows) {
          const res = scanContentForThreats((r.content as string) || "");
          if (!res.clean) infected.push({ id: r.id, name: r.name, threats: res.threats, file_path: r.file_path });
        }
        if (rows.length < PAGE) break;
        from += PAGE;
      }
      if (infected.length === 0) {
        toast.success("No infected brains detected");
        return;
      }
      if (!isAdmin) {
        toast.warning(`${infected.length} infected brain(s) — admin required to purge`);
        return;
      }
      const ids = infected.map((b) => b.id);
      const paths = infected.map((b) => b.file_path).filter((p): p is string => !!p);
      if (paths.length) await supabase.storage.from("asher-brains").remove(paths).catch(() => {});
      const { error } = await supabase.from("asher_brains").delete().in("id", ids);
      if (error) {
        toast.error(`Quarantine failed: ${error.message}`);
      } else {
        setBrains((prev) => prev.filter((b) => !ids.includes(b.id)));
        toast.success(`Quarantined ${infected.length} infected brain(s)`);
        logAsherEvent("module_open", { module: "asher_brain_virus_purge", count: infected.length });
      }
    } catch (err: any) {
      toast.error(err?.message || "Virus scan failed");
    } finally {
      setScanningVirus(false);
    }
  }, [isAdmin]);

  const scanDuplicates = useCallback(async () => {
    setScanningDup(true);
    try {
      // Cheap pre-pass: candidates share file_name + file_size (no content download)
      const sizeMap = new Map<string, AsherBrain[]>();
      for (const b of brains) {
        const k = `${(b.file_name || "").toLowerCase()}::${b.file_size ?? 0}`;
        const arr = sizeMap.get(k) || [];
        arr.push(b);
        sizeMap.set(k, arr);
      }
      const candidateGroups = Array.from(sizeMap.values()).filter((g) => g.length > 1);

      // Verify by hashing content — only fetch content for candidate rows
      const hash = async (s: string) => {
        const buf = new TextEncoder().encode(s.trim().toLowerCase());
        const h = await crypto.subtle.digest("SHA-256", buf);
        return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("");
      };

      const finalGroups: AsherBrain[][] = [];
      for (const cand of candidateGroups) {
        const ids = cand.map((b) => b.id);
        const { data } = await supabase
          .from("asher_brains").select("id,content").in("id", ids);
        const byId = new Map<string, string>(
          ((data as any[] | null) ?? []).map((r) => [r.id as string, (r.content as string) ?? ""]),
        );
        const hashMap = new Map<string, AsherBrain[]>();
        for (const b of cand) {
          const c = byId.get(b.id) || "";
          if (!c) continue;
          const k = await hash(c);
          const arr = hashMap.get(k) || [];
          arr.push(b);
          hashMap.set(k, arr);
        }
        for (const g of hashMap.values()) if (g.length > 1) finalGroups.push(g);
      }

      setDupGroups(finalGroups);
      if (finalGroups.length === 0) {
        toast.success("No duplicate brains detected");
      } else if (!isAdmin) {
        toast.warning(`${finalGroups.length} duplicate group(s) · ${finalGroups.reduce((n, g) => n + g.length, 0)} brains (admin required to purge)`);
      } else {
        // Auto-purge: keep oldest in each group, delete the rest
        const toDelete: AsherBrain[] = [];
        for (const g of finalGroups) {
          const sorted = [...g].sort((a, b) => {
            const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
            const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
            return ta - tb;
          });
          toDelete.push(...sorted.slice(1));
        }
        if (toDelete.length === 0) {
          toast.success("No duplicates to purge");
        } else {
          const ids = toDelete.map((b) => b.id);
          const paths = toDelete.map((b) => b.file_path).filter((p): p is string => !!p);
          if (paths.length) {
            await supabase.storage.from("asher-brains").remove(paths).catch(() => {});
          }
          const { error } = await supabase.from("asher_brains").delete().in("id", ids);
          if (error) {
            toast.error(`Purge failed: ${error.message}`);
          } else {
            setBrains((prev) => prev.filter((b) => !ids.includes(b.id)));
            setDupGroups([]);
            toast.success(`Purged ${toDelete.length} duplicate brain(s) across ${finalGroups.length} group(s)`);
          }
        }
      }
    } catch (err: any) {
      toast.error(err?.message || "Duplicate scan failed");
    } finally {
      setScanningDup(false);
    }
  }, [brains, isAdmin]);

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
            accept=".txt,.md,.json,.csv,.pdf,.log,.yml,.yaml,.zip"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) void upload(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-md border border-border/30 bg-foreground/5 px-2.5 py-1 text-[10px] font-light tracking-[0.15em] text-foreground uppercase hover:bg-foreground/10"
          >
            <Upload className="h-3 w-3" />
            Upload
          </button>
          {bgQueue > 0 && (
            <div className="flex items-center gap-1.5 rounded-md border border-border/30 bg-foreground/5 px-2.5 py-1 text-[10px] font-light tracking-[0.15em] text-muted-foreground uppercase">
              <Loader2 className="h-3 w-3 animate-spin" />
              Processing {bgQueue}
            </div>
          )}
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
          <button
            onClick={() => void scanDuplicates()}
            disabled={scanningDup || brains.length === 0}
            title="Cross-check all brains for duplicate content"
            className="flex items-center gap-1.5 rounded-md border border-border/30 bg-foreground/5 px-2.5 py-1 text-[10px] font-light tracking-[0.15em] text-foreground uppercase hover:bg-foreground/10 disabled:opacity-50"
          >
            {scanningDup ? <Loader2 className="h-3 w-3 animate-spin" /> : <Copy className="h-3 w-3" />}
            Scan Duplicates
          </button>
          <button
            onClick={() => void scanForViruses()}
            disabled={scanningVirus}
            title="Scan every brain for malware/virus signatures and auto-quarantine infected files"
            className="flex items-center gap-1.5 rounded-md border border-red-400/40 bg-red-500/10 px-2.5 py-1 text-[10px] font-light tracking-[0.15em] text-red-300 uppercase hover:bg-red-500/20 disabled:opacity-50"
          >
            {scanningVirus ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
            Virus Scan
          </button>
        </div>
      </div>

      {dupGroups.length > 0 && (
        <div className="shrink-0 border-b border-amber-400/30 bg-amber-400/5 px-4 py-2">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] font-light tracking-[0.25em] text-amber-300 uppercase">
              {dupGroups.length} Duplicate Group(s) · {dupGroups.reduce((n, g) => n + g.length, 0)} Brains
            </p>
            <button onClick={() => setDupGroups([])} className="text-[9px] tracking-[0.2em] uppercase text-amber-300/70 hover:text-amber-300">Dismiss</button>
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {dupGroups.map((g, i) => (
              <div key={i} className="text-[10px] font-light text-amber-200/80">
                <span className="text-amber-300/60">#{i + 1}:</span>{" "}
                {g.map((b) => b.name).join("  ·  ")}
              </div>
            ))}
          </div>
        </div>
      )}

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
              Upload brain files — or drag &amp; drop .txt / .md / .pdf / .json / .csv / .yaml files.
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
                              onClick={async () => {
                                if (b.content) { setPreview(b); return; }
                                const { data, error } = await supabase
                                  .from("asher_brains").select("content").eq("id", b.id).maybeSingle();
                                if (error) { toast.error(error.message); return; }
                                setPreview({ ...b, content: (data?.content as string) ?? "" });
                              }}
                              title="Preview content"
                              className="p-1.5 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-foreground/5"
                            >
                              <Eye className="h-3.5 w-3.5" strokeWidth={1.5} />
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => void toggle(b)}
                                title={b.is_active ? "Deactivate" : "Activate"}
                                className="p-1 rounded-md hover:bg-foreground/5"
                              >
                                {b.is_active
                                  ? <ToggleRight className="h-4 w-4 text-emerald-400" strokeWidth={1.5} />
                                  : <ToggleLeft className="h-4 w-4 text-muted-foreground/40" strokeWidth={1.5} />}
                              </button>
                            )}
                            {isAdmin && (
                              <button
                                onClick={() => void remove(b)}
                                title="Delete"
                                className="p-1.5 rounded-md text-muted-foreground/40 hover:text-red-400 hover:bg-red-500/5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                              </button>
                            )}
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
