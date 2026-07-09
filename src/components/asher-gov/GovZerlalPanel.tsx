// GovZerlalPanel — Sovereign ZERLAL target-loader wrapper.
//
// NARRATIVE / WORKFLOW TAXONOMY
// -----------------------------
// 1. TARGET INGEST (workflow entry)
//    - Operator supplies a code corpus by one of three sovereign paths:
//        a) PASTE     — inline textarea, treated as a single virtual file.
//        b) UPLOAD    — File[] drop, each entry becomes a {path,content}.
//        c) CHANNEL   — pull latest N transmissions from the active
//                       sovereign channel that carry ```code fences```
//                       or file-like content; each becomes a virtual file.
// 2. GATE (security)
//    - Empty corpus is refused up-front (prevents the "Open a project
//      first" toast storm that made the deck ZERLAL surface inert).
//    - projectId is scoped per-server (`gov::<serverId>`) so results
//      persist independently per country and never bleed across servers.
// 3. EXECUTION (delegation)
//    - Renders the underlying <AsherCodeZerlal> with the assembled
//      files. All 15 panels then invoke `asher-code-ai` LIVE via Gemini
//      (no simulation). Each panel is idempotent — re-runs overwrite.
// 4. AUDIT (observability)
//    - Every ingest action is written to the sovereign audit ledger via
//      onAudit("ZERLAL_TARGET_LOAD", <source>, <detail>) so operators
//      can see what corpus fed a given classified finding.
// 5. FLAWS FIXED
//    - Prior mount passed files=[] → every scan aborted. Fixed.
//    - Prior projectId collided across servers. Now server-scoped.
//    - Channel ingest is size-capped (per-file 60KB, total 20 files)
//      to keep prompt payload sane and dodge gateway 413s.

import { useMemo, useRef, useState } from "react";
import { FileCode2, Upload, MessageSquare, Trash2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import AsherCodeZerlal from "@/components/asher/AsherCodeZerlal";

export interface ChannelMessage {
  id: string;
  body: string | null;
  created_at: string;
  operator_handle?: string | null;
}

interface Props {
  serverId: string | null;
  serverName?: string | null;
  channelName?: string | null;
  channelMessages: ChannelMessage[];
  operator: string;
  onAudit: (action: string, target: string, detail?: string) => void;
}

type VFile = { path: string; content: string };

const MAX_FILE_BYTES = 60_000;
const MAX_FILES = 40;

function extractCodeFromMessage(m: ChannelMessage): VFile[] {
  const body = m.body ?? "";
  if (!body.trim()) return [];
  const files: VFile[] = [];
  const fenceRe = /```([a-zA-Z0-9_.-]*)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  let idx = 0;
  while ((match = fenceRe.exec(body)) !== null) {
    const lang = match[1] || "txt";
    const content = match[2].slice(0, MAX_FILE_BYTES);
    files.push({
      path: `channel/${m.id.slice(0, 8)}_${idx}.${lang || "txt"}`,
      content,
    });
    idx++;
  }
  // If no code fences, still ingest the message as prose evidence.
  if (files.length === 0 && body.length > 40) {
    files.push({
      path: `channel/${m.id.slice(0, 8)}_note.md`,
      content: body.slice(0, MAX_FILE_BYTES),
    });
  }
  return files;
}

export default function GovZerlalPanel({
  serverId, serverName, channelName, channelMessages, operator, onAudit,
}: Props) {
  const [files, setFiles] = useState<VFile[]>([]);
  const [paste, setPaste] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const projectId = useMemo(
    () => `gov::${serverId ?? "no-server"}`,
    [serverId]
  );

  function addFiles(next: VFile[], source: string) {
    if (!next.length) return;
    setFiles(prev => {
      const merged = [...prev];
      for (const f of next) {
        if (merged.length >= MAX_FILES) break;
        // dedupe by path — later ingest of same path overwrites
        const i = merged.findIndex(p => p.path === f.path);
        if (i >= 0) merged[i] = f;
        else merged.push(f);
      }
      return merged;
    });
    onAudit("ZERLAL_TARGET_LOAD", source, `${next.length} file(s)`);
    toast.success(`Loaded ${next.length} file(s) from ${source}`);
  }

  function handlePaste() {
    const trimmed = paste.trim();
    if (!trimmed) { toast.error("Nothing to paste"); return; }
    addFiles(
      [{ path: `paste/inline_${Date.now()}.txt`, content: trimmed.slice(0, MAX_FILE_BYTES) }],
      "paste"
    );
    setPaste("");
  }

  async function handleUpload(list: FileList | null) {
    if (!list || !list.length) return;
    const arr = Array.from(list).slice(0, MAX_FILES);
    const read: VFile[] = [];
    for (const f of arr) {
      try {
        const content = (await f.text()).slice(0, MAX_FILE_BYTES);
        read.push({ path: f.name, content });
      } catch { /* skip binary */ }
    }
    addFiles(read, "upload");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleChannelPull() {
    if (!channelMessages.length) {
      toast.error("No transmissions in active channel");
      return;
    }
    const collected: VFile[] = [];
    for (const m of channelMessages.slice(-30).reverse()) {
      for (const f of extractCodeFromMessage(m)) {
        collected.push(f);
        if (collected.length >= MAX_FILES) break;
      }
      if (collected.length >= MAX_FILES) break;
    }
    if (!collected.length) { toast.error("No code artifacts found in channel"); return; }
    addFiles(collected, `channel:${channelName ?? "?"}`);
  }

  function clearAll() {
    setFiles([]);
    onAudit("ZERLAL_TARGET_CLEAR", projectId);
  }

  return (
    <div className="flex h-full w-full flex-col bg-background">
      {/* TARGET LOADER */}
      <div className="border-b border-border/20 bg-black/25 px-4 py-3 space-y-2">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground/70">
          <ShieldAlert className="h-3 w-3" />
          Sovereign Target · {serverName ?? "no server"} · {files.length}/{MAX_FILES} files
        </div>

        <div className="flex flex-wrap items-stretch gap-2">
          <div className="flex flex-1 min-w-[240px] items-stretch gap-2">
            <textarea
              value={paste}
              onChange={e => setPaste(e.target.value)}
              placeholder="Paste source, config, or artifact here…"
              className="flex-1 h-10 resize-none bg-card/30 border border-border/25 rounded px-2 py-1.5 text-[11px] font-mono focus:outline-none focus:border-foreground/40"
            />
            <button
              onClick={handlePaste}
              className="px-3 rounded border border-border/25 bg-card/40 hover:border-foreground/40 text-[10px] uppercase tracking-[0.2em]"
            >
              <FileCode2 className="h-3 w-3 inline mr-1" /> Add
            </button>
          </div>

          <label className="cursor-pointer inline-flex items-center gap-1 px-3 rounded border border-border/25 bg-card/40 hover:border-foreground/40 text-[10px] uppercase tracking-[0.2em]">
            <Upload className="h-3 w-3" /> Upload
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={e => handleUpload(e.target.files)}
            />
          </label>

          <button
            onClick={handleChannelPull}
            disabled={!channelMessages.length}
            className="inline-flex items-center gap-1 px-3 rounded border border-border/25 bg-card/40 hover:border-foreground/40 disabled:opacity-40 text-[10px] uppercase tracking-[0.2em]"
          >
            <MessageSquare className="h-3 w-3" /> Pull Channel
          </button>

          {files.length > 0 && (
            <button
              onClick={clearAll}
              className="inline-flex items-center gap-1 px-3 rounded border border-red-400/30 text-red-300/80 hover:border-red-400/60 text-[10px] uppercase tracking-[0.2em]"
            >
              <Trash2 className="h-3 w-3" /> Clear
            </button>
          )}
        </div>

        {files.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {files.slice(0, 12).map(f => (
              <span key={f.path} className="text-[9px] px-1.5 py-0.5 rounded border border-border/25 bg-card/30 text-muted-foreground/80 font-mono">
                {f.path} · {f.content.length}b
              </span>
            ))}
            {files.length > 12 && (
              <span className="text-[9px] text-muted-foreground/60">+{files.length - 12} more</span>
            )}
          </div>
        )}
      </div>

      {/* ZERLAL PANELS */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {files.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center px-6">
            <div className="max-w-md space-y-2">
              <ShieldAlert className="h-5 w-5 mx-auto text-muted-foreground/60" />
              <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground/70">
                Load a sovereign target
              </p>
              <p className="text-[10px] text-muted-foreground/50 leading-relaxed">
                ZERLAL's 15 intelligence panels (exploit-chain, APT attribution, kill-chain,
                quantum readiness, supply-chain, secret exposure, CVE intel, compliance, and more)
                run LIVE against the corpus you provide. Paste code, upload files, or pull the
                active channel to begin. Findings are scoped to <span className="font-mono">{projectId}</span>.
              </p>
            </div>
          </div>
        ) : (
          <AsherCodeZerlal projectId={projectId} files={files} />
        )}
      </div>
    </div>
  );
}
