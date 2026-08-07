import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Upload, FileText, Sparkles, MessageSquare, MapPin, Download, Loader2, Send,
  AlertTriangle, CheckCircle2, HelpCircle, Radar, Footprints, ExternalLink, RotateCcw, Plus, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useResolvedZaxinByok } from "@/lib/zaxin/resolveByok";
import { invokeWithByokRetry } from "@/lib/byokInvoke";
import { extractResumeText, ACCEPTED_RESUME_TYPES } from "@/lib/resume/extract";
import { normalizeResume, resumeToText, EMPTY_RESUME, type ResumeStructured } from "@/lib/resume/types";
import { analyzeResumePsychology, type PsychReport } from "@/lib/resume/psychologyEngine";
import { downloadResumePdf, resumePdfBase64 } from "@/lib/resume/pdf";
import { toast } from "sonner";

// ═══════════════════════════════════════════════════════════════════════════
// RESUME & JOBS — the operator's own document, read the way a hiring reader
// reads it, plus the fused local/web opening sweep and dispatch ledger.
// ═══════════════════════════════════════════════════════════════════════════

type Tab = "resume" | "ask" | "jobs";

interface ResumeRow {
  id: string; title: string; structured: unknown; raw_text: string;
  version: number; updated_at: string; source_filename: string | null;
}
interface GapRow { id: string; field_key: string; question: string; why: string | null; answer: string | null; status: string }
interface LeadRow {
  id: string; source: string; title: string; company: string | null; location: string | null;
  distance_miles: number | null; walkable: boolean; url: string | null; apply_email: string | null;
  description: string | null; match_score: number; match_reasons: unknown; status: string;
}
interface Settings {
  home_label: string | null; home_lat: number | null; home_lng: number | null;
  radius_miles: number; walk_radius_miles: number; keywords: string[];
  autonomous: boolean; enabled: boolean; last_run_at: string | null;
}

const DEFAULT_SETTINGS: Settings = {
  home_label: null, home_lat: null, home_lng: null,
  radius_miles: 5, walk_radius_miles: 1, keywords: [],
  autonomous: false, enabled: true, last_run_at: null,
};

const SEV_TONE: Record<string, string> = {
  critical: "border-destructive/40 text-destructive",
  high: "border-foreground/35 text-foreground",
  medium: "border-border/40 text-muted-foreground",
  low: "border-border/25 text-muted-foreground/70",
};

export default function ResumeWorkspace() {
  const { byok } = useResolvedZaxinByok();
  const [tab, setTab] = useState<Tab>("resume");

  const [row, setRow] = useState<ResumeRow | null>(null);
  const [draft, setDraft] = useState<ResumeStructured>(EMPTY_RESUME);
  const [gaps, setGaps] = useState<GapRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [changes, setChanges] = useState<{ where: string; before: string; after: string; why: string }[]>([]);
  const [dirty, setDirty] = useState(false);

  const [askInput, setAskInput] = useState("");
  const [thread, setThread] = useState<{ role: "user" | "assistant"; text: string }[]>([]);

  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [addressInput, setAddressInput] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [sweepSummary, setSweepSummary] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  const psych: PsychReport = useMemo(() => analyzeResumePsychology(draft), [draft]);

  // ── Load ─────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: r }, { data: s }, { data: l }] = await Promise.all([
        supabase.from("user_resumes").select("*").eq("is_active", true)
          .order("updated_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("job_sentinel_settings").select("*").maybeSingle(),
        supabase.from("job_leads").select("*").order("match_score", { ascending: false }).limit(80),
      ]);
      if (r) {
        setRow(r as ResumeRow);
        setDraft(normalizeResume((r as ResumeRow).structured));
        setDirty(false);
        const { data: g } = await supabase.from("resume_gaps")
          .select("*").eq("resume_id", (r as ResumeRow).id).eq("status", "open");
        setGaps((g ?? []) as GapRow[]);
      }
      if (s) setSettings({ ...DEFAULT_SETTINGS, ...(s as Partial<Settings>) });
      setLeads((l ?? []) as LeadRow[]);
    } catch (e) {
      toast.error(`Could not load your workspace: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // ── Upload → parse ───────────────────────────────────────────────────────
  const onFile = async (file: File) => {
    setBusy("Reading the file on this device…");
    try {
      const { text, method } = await extractResumeText(file);
      setBusy(`Parsing ${method.toUpperCase()} into structure…`);
      const res = await invokeWithByokRetry<{ resume: ResumeRow }>("resume-engine", {
        body: { action: "parse", rawText: text, filename: file.name, byok },
      });
      setRow(res.resume);
      setDraft(normalizeResume(res.resume.structured));
      setDirty(false);
      setGaps([]);
      toast.success("Resume imported and structured.");
    } catch (e) {
      toast.error((e as Error).message || "Import failed.");
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // ── Save local edits ─────────────────────────────────────────────────────
  const save = async () => {
    if (!row) return;
    setBusy("Saving…");
    try {
      await supabase.from("resume_versions").insert({
        resume_id: row.id, user_id: (await supabase.auth.getUser()).data.user!.id,
        version: row.version, structured: normalizeResume(row.structured) as never,
        raw_text: row.raw_text, note: "Manual edit snapshot",
      });
      const { data, error } = await supabase.from("user_resumes")
        .update({ structured: draft as never, raw_text: resumeToText(draft), version: row.version + 1 })
        .eq("id", row.id).select().single();
      if (error) throw new Error(error.message);
      setRow(data as ResumeRow);
      setDirty(false);
      toast.success("Saved.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(null); }
  };

  // ── Psychology rewrite ───────────────────────────────────────────────────
  const enhance = async (instruction?: string) => {
    if (!row) return;
    setBusy("Rewriting for the reader…");
    try {
      const answered = gaps.filter((g) => g.answer?.trim())
        .map((g) => ({ field_key: g.field_key, answer: g.answer }));
      const res = await invokeWithByokRetry<{
        resume: ResumeRow;
        changes: { where: string; before: string; after: string; why: string }[];
        questions: { field_key: string; question: string; why?: string }[];
      }>("resume-engine", {
        body: { action: "enhance", resumeId: row.id, instruction, answers: answered, byok },
      });
      setRow(res.resume);
      setDraft(normalizeResume(res.resume.structured));
      setChanges(res.changes || []);
      setDirty(false);
      const { data: g } = await supabase.from("resume_gaps")
        .select("*").eq("resume_id", row.id).eq("status", "open");
      setGaps((g ?? []) as GapRow[]);
      toast.success(`${res.changes?.length ?? 0} edits applied. Previous version kept.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(null); }
  };

  const rollback = async () => {
    if (!row) return;
    setBusy("Restoring previous version…");
    try {
      const { data: prev } = await supabase.from("resume_versions")
        .select("*").eq("resume_id", row.id).order("version", { ascending: false }).limit(1).maybeSingle();
      if (!prev) { toast.error("No earlier version stored."); return; }
      const restored = normalizeResume((prev as { structured: unknown }).structured);
      const { data } = await supabase.from("user_resumes")
        .update({ structured: restored as never, version: row.version + 1 }).eq("id", row.id).select().single();
      setRow(data as ResumeRow);
      setDraft(restored);
      setChanges([]);
      toast.success("Rolled back.");
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  };

  const answerGap = async (g: GapRow, answer: string) => {
    setGaps((prev) => prev.map((x) => (x.id === g.id ? { ...x, answer } : x)));
    await supabase.from("resume_gaps")
      .update({ answer, status: answer.trim() ? "answered" : "open", answered_at: new Date().toISOString() })
      .eq("id", g.id);
  };

  // ── Ask ──────────────────────────────────────────────────────────────────
  const ask = async () => {
    const q = askInput.trim();
    if (!q || !row) return;
    setAskInput("");
    setThread((t) => [...t, { role: "user", text: q }]);
    setBusy("Thinking…");
    try {
      const res = await invokeWithByokRetry<{ answer: string }>("resume-engine", {
        body: { action: "ask", resumeId: row.id, question: q, byok },
      });
      setThread((t) => [...t, { role: "assistant", text: res.answer }]);
    } catch (e) {
      setThread((t) => [...t, { role: "assistant", text: `Failed: ${(e as Error).message}` }]);
    } finally { setBusy(null); }
  };

  // ── Jobs ─────────────────────────────────────────────────────────────────
  const persistSettings = async (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    await supabase.from("job_sentinel_settings").upsert({
      user_id: auth.user.id,
      home_label: next.home_label, home_lat: next.home_lat, home_lng: next.home_lng,
      radius_miles: next.radius_miles, walk_radius_miles: next.walk_radius_miles,
      keywords: next.keywords, autonomous: next.autonomous, enabled: next.enabled,
    }, { onConflict: "user_id" });
  };

  const setHome = async () => {
    const q = addressInput.trim();
    if (q.length < 3) return;
    setBusy("Resolving that address…");
    try {
      const res = await invokeWithByokRetry<{ lat: number; lng: number; label: string }>("job-sentinel", {
        body: { action: "geocode", query: q },
      });
      await persistSettings({ home_lat: res.lat, home_lng: res.lng, home_label: res.label });
      setAddressInput("");
      toast.success(`Home set: ${res.label}`);
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  };

  const useDeviceLocation = () => {
    if (!navigator.geolocation) { toast.error("This browser exposes no location API."); return; }
    setBusy("Reading device location…");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await persistSettings({
          home_lat: pos.coords.latitude, home_lng: pos.coords.longitude,
          home_label: settings.home_label ?? `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`,
        });
        setBusy(null);
        toast.success("Location captured from this device.");
      },
      (err) => { setBusy(null); toast.error(`Location denied: ${err.message}`); },
      { enableHighAccuracy: true, timeout: 12_000 },
    );
  };

  const sweep = async () => {
    setBusy("Sweeping local employers and posted listings…");
    setSweepSummary(null);
    try {
      const res = await invokeWithByokRetry<{
        inserted: number; walkable: number; radiusMiles: number;
        layers: { local: { found: number; kept: number; ok: boolean }; web: { found: number; kept: number; ok: boolean; configured: boolean } };
      }>("job-sentinel", { body: { action: "discover" } });
      const { local, web } = res.layers;
      setSweepSummary(
        `Local register: ${local.found} employers inside ${res.radiusMiles} mi (${local.kept} kept)${local.ok ? "" : " — layer failed"}. ` +
        `Posted listings: ${web.found} found (${web.kept} kept)${web.configured ? "" : " — web search not configured"}. ` +
        `${res.inserted} new lead${res.inserted === 1 ? "" : "s"}, ${res.walkable} walkable.`,
      );
      const { data: l } = await supabase.from("job_leads").select("*").order("match_score", { ascending: false }).limit(80);
      setLeads((l ?? []) as LeadRow[]);
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  };

  const applyTo = async (lead: LeadRow) => {
    if (!row) { toast.error("Import a resume first."); return; }
    setBusy(`Tailoring for ${lead.company || lead.title}…`);
    try {
      const posting = [lead.title, lead.company, lead.location, lead.description, lead.url].filter(Boolean).join("\n");
      const tailored = await invokeWithByokRetry<{
        resume: ResumeStructured; coverLetter: string; matchScore: number; gaps: string[];
      }>("resume-engine", { body: { action: "tailor", resumeId: row.id, posting, byok } });

      const tailoredResume = normalizeResume(tailored.resume);
      setBusy("Dispatching…");
      const res = await invokeWithByokRetry<{ dispatched: boolean; mode?: string; reason?: string; error?: string }>(
        "job-sentinel",
        {
          body: {
            action: "apply", leadId: lead.id, resumeId: row.id,
            coverLetter: tailored.coverLetter,
            resumeText: resumeToText(tailoredResume),
            pdfBase64: resumePdfBase64(tailoredResume),
          },
        },
      );
      if (res.dispatched) toast.success(`Sent to ${lead.company || lead.title}.`);
      else if (res.reason === "no_apply_email") toast.info("No application address on this posting — package prepared, open the link to submit.");
      else if (res.reason === "autonomous_off") toast.info("Autonomous applying is off — saved as a Gmail draft for you to send.");
      else if (res.reason === "no_google_send_scope") toast.info("Connect a Google account with send access to dispatch automatically. Package prepared.");
      else toast.warning(res.error || "Prepared, not sent.");

      const { data: l } = await supabase.from("job_leads").select("*").order("match_score", { ascending: false }).limit(80);
      setLeads((l ?? []) as LeadRow[]);
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  };

  // ── Field helpers ────────────────────────────────────────────────────────
  const patch = (p: Partial<ResumeStructured>) => { setDraft((d) => ({ ...d, ...p })); setDirty(true); };

  const walkable = leads.filter((l) => l.walkable);

  // ═════════════════════════════════════════════════════════════════════════

  return (
    <div className="flex flex-col h-full">
      <header className="border-b border-border/20 px-6 pt-5 pb-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-base font-extralight tracking-[0.18em] uppercase text-foreground">Resume &amp; Jobs</h1>
            <p className="text-xs font-light text-muted-foreground/70 mt-0.5">
              Your document read the way a hiring reader reads it — then matched against what is actually hiring near you.
            </p>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-border/20 bg-card/40 p-1">
            {([["resume", "Resume", FileText], ["ask", "Ask", MessageSquare], ["jobs", "Jobs", Radar]] as const).map(([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-light transition-colors ${
                  tab === id ? "bg-foreground/10 text-foreground" : "text-muted-foreground/70 hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />{label}
              </button>
            ))}
          </div>
        </div>
        {busy && (
          <div className="flex items-center gap-2 mt-2 text-[11px] font-light text-muted-foreground/80" aria-live="polite">
            <Loader2 className="h-3 w-3 animate-spin" />{busy}
          </div>
        )}
      </header>

      <div className="flex-1 min-h-0 overflow-auto p-6">
        {loading ? (
          <div className="space-y-3 max-w-4xl mx-auto">
            {[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-xl bg-card/40 border border-border/20 animate-pulse" />)}
          </div>
        ) : tab === "resume" ? (
          <ResumeTab
            row={row} draft={draft} psych={psych} gaps={gaps} changes={changes} dirty={dirty}
            busy={Boolean(busy)} fileRef={fileRef} onFile={onFile} patch={patch}
            onSave={save} onEnhance={enhance} onRollback={rollback} onAnswerGap={answerGap}
          />
        ) : tab === "ask" ? (
          <AskTab
            hasResume={Boolean(row)} thread={thread} input={askInput}
            setInput={setAskInput} onSend={ask} busy={Boolean(busy)}
          />
        ) : (
          <JobsTab
            settings={settings} persistSettings={persistSettings}
            addressInput={addressInput} setAddressInput={setAddressInput}
            keywordInput={keywordInput} setKeywordInput={setKeywordInput}
            onSetHome={setHome} onUseDevice={useDeviceLocation} onSweep={sweep}
            leads={leads} walkable={walkable} onApply={applyTo}
            busy={Boolean(busy)} summary={sweepSummary} hasResume={Boolean(row)}
          />
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// RESUME TAB
// ═══════════════════════════════════════════════════════════════════════════

function ResumeTab(props: {
  row: ResumeRow | null; draft: ResumeStructured; psych: PsychReport; gaps: GapRow[];
  changes: { where: string; before: string; after: string; why: string }[];
  dirty: boolean; busy: boolean; fileRef: React.RefObject<HTMLInputElement>;
  onFile: (f: File) => void; patch: (p: Partial<ResumeStructured>) => void;
  onSave: () => void; onEnhance: (i?: string) => void; onRollback: () => void;
  onAnswerGap: (g: GapRow, a: string) => void;
}) {
  const { row, draft, psych, gaps, changes, dirty, busy, fileRef, onFile, patch, onSave, onEnhance, onRollback, onAnswerGap } = props;
  const [instruction, setInstruction] = useState("");

  if (!row) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <Upload className="h-8 w-8 mx-auto text-muted-foreground/50 mb-4" />
        <h2 className="text-sm font-light text-foreground">Start with the document you already have</h2>
        <p className="text-xs font-light text-muted-foreground/70 mt-2 leading-relaxed">
          PDF, DOCX, or plain text. The file is read on this device first — nothing is uploaded until it has produced usable text.
        </p>
        <input
          ref={fileRef} type="file" className="hidden"
          accept={[...ACCEPTED_RESUME_TYPES, ".pdf", ".docx", ".txt", ".md"].join(",")}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
        />
        <button
          onClick={() => fileRef.current?.click()} disabled={busy}
          className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border/30 bg-card/50 text-xs font-light text-foreground hover:bg-card/70 transition-colors disabled:opacity-40"
        >
          <Upload className="h-3.5 w-3.5" /> Upload resume
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Reader score */}
      <section className="rounded-xl border border-border/20 bg-card/40 p-5">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <p className="text-[10px] font-light tracking-[0.2em] uppercase text-muted-foreground/50">Reader-persuasion read</p>
            <div className="flex items-baseline gap-3 mt-1">
              <span className="text-3xl font-extralight text-foreground tabular-nums">{psych.score}</span>
              <span className="text-xs font-light uppercase tracking-wider text-muted-foreground/70">{psych.band}</span>
            </div>
            <p className="text-[11px] font-light text-muted-foreground/60 mt-1">
              {Math.round(psych.metrics.agencyRatio * 100)}% of bullets open on a verb of cause ·{" "}
              {Math.round(psych.metrics.quantifiedRatio * 100)}% carry a number · avg {psych.metrics.avgBulletWords} words/bullet
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => downloadResumePdf(draft, row.title)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/30 bg-card/50 text-xs font-light text-foreground hover:bg-card/70 transition-colors">
              <Download className="h-3.5 w-3.5" /> Export PDF
            </button>
            <button onClick={onRollback} disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/30 bg-card/50 text-xs font-light text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40">
              <RotateCcw className="h-3.5 w-3.5" /> Roll back
            </button>
            {dirty && (
              <button onClick={onSave} disabled={busy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-foreground/30 bg-foreground/10 text-xs font-light text-foreground hover:bg-foreground/15 transition-colors disabled:opacity-40">
                <CheckCircle2 className="h-3.5 w-3.5" /> Save edits
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <input
            value={instruction} onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !busy) { onEnhance(instruction || undefined); setInstruction(""); } }}
            placeholder="Optional instruction — e.g. 'aim this at operations roles, cut the retail years to two lines'"
            className="flex-1 rounded-lg border border-border/25 bg-background/40 px-3 py-2 text-xs font-light text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-border/50"
          />
          <button
            onClick={() => { onEnhance(instruction || undefined); setInstruction(""); }} disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-foreground/30 bg-foreground/10 text-xs font-light text-foreground hover:bg-foreground/15 transition-colors disabled:opacity-40 whitespace-nowrap"
          >
            <Sparkles className="h-3.5 w-3.5" /> Rewrite
          </button>
        </div>
      </section>

      {/* Gap questions */}
      {gaps.length > 0 && (
        <section className="rounded-xl border border-border/25 bg-card/40 p-5">
          <div className="flex items-center gap-2 mb-3">
            <HelpCircle className="h-4 w-4 text-muted-foreground/70" />
            <h3 className="text-xs font-light tracking-wider uppercase text-foreground">Only you can answer these</h3>
          </div>
          <p className="text-[11px] font-light text-muted-foreground/60 mb-3">
            Each one is a figure or fact the rewrite needed and refused to invent. Answer what you can, then rewrite again.
          </p>
          <div className="space-y-3">
            {gaps.map((g) => (
              <div key={g.id}>
                <p className="text-xs font-light text-foreground">{g.question}</p>
                {g.why && <p className="text-[10px] font-light text-muted-foreground/50 mt-0.5">{g.why}</p>}
                <input
                  defaultValue={g.answer ?? ""}
                  onBlur={(e) => onAnswerGap(g, e.target.value)}
                  placeholder="Your answer"
                  className="mt-1.5 w-full rounded-lg border border-border/25 bg-background/40 px-3 py-1.5 text-xs font-light text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-border/50"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Findings */}
      {psych.findings.length > 0 && (
        <section className="rounded-xl border border-border/20 bg-card/40 p-5">
          <h3 className="text-xs font-light tracking-wider uppercase text-foreground mb-3">What the reader's mind does with this</h3>
          <div className="space-y-3">
            {psych.findings.map((f) => (
              <div key={f.code} className={`border-l-2 pl-3 ${SEV_TONE[f.severity]}`}>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  <span className="text-xs font-light">{f.title}</span>
                  <span className="text-[9px] font-light tracking-wider uppercase opacity-50">{f.severity}</span>
                </div>
                <p className="text-[11px] font-light text-muted-foreground/70 mt-1 leading-relaxed">{f.effect}</p>
                {f.evidence.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {f.evidence.slice(0, 4).map((e, i) => (
                      <li key={i} className="text-[10px] font-light text-muted-foreground/50 truncate">“{e}”</li>
                    ))}
                  </ul>
                )}
                <p className="text-[11px] font-light text-foreground/80 mt-1">→ {f.fix}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Change log */}
      {changes.length > 0 && (
        <section className="rounded-xl border border-border/20 bg-card/40 p-5">
          <h3 className="text-xs font-light tracking-wider uppercase text-foreground mb-3">Edits applied ({changes.length})</h3>
          <div className="space-y-2.5">
            {changes.map((c, i) => (
              <div key={i} className="text-[11px] font-light">
                <p className="text-muted-foreground/50">{c.where}</p>
                <p className="text-muted-foreground/70 line-through">{c.before}</p>
                <p className="text-foreground">{c.after}</p>
                <p className="text-muted-foreground/50 italic">{c.why}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Editor */}
      <section className="rounded-xl border border-border/20 bg-card/40 p-5 space-y-4">
        <h3 className="text-xs font-light tracking-wider uppercase text-foreground">Document</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {(["name", "headline", "email", "phone", "location"] as const).map((k) => (
            <label key={k} className="block">
              <span className="text-[10px] font-light tracking-wider uppercase text-muted-foreground/50">{k}</span>
              <input
                value={draft[k]} onChange={(e) => patch({ [k]: e.target.value } as Partial<ResumeStructured>)}
                className="mt-1 w-full rounded-lg border border-border/25 bg-background/40 px-3 py-1.5 text-xs font-light text-foreground focus:outline-none focus:border-border/50"
              />
            </label>
          ))}
        </div>
        <label className="block">
          <span className="text-[10px] font-light tracking-wider uppercase text-muted-foreground/50">Summary</span>
          <textarea
            value={draft.summary} rows={3} onChange={(e) => patch({ summary: e.target.value })}
            className="mt-1 w-full rounded-lg border border-border/25 bg-background/40 px-3 py-2 text-xs font-light text-foreground focus:outline-none focus:border-border/50 resize-y"
          />
        </label>

        {draft.experience.map((exp, ei) => (
          <div key={ei} className="rounded-lg border border-border/20 p-3 space-y-2">
            <div className="grid sm:grid-cols-4 gap-2">
              {(["title", "company", "start", "end"] as const).map((k) => (
                <input
                  key={k} value={exp[k] ?? ""} placeholder={k}
                  onChange={(e) => {
                    const next = [...draft.experience];
                    next[ei] = { ...next[ei], [k]: e.target.value };
                    patch({ experience: next });
                  }}
                  className="rounded-lg border border-border/25 bg-background/40 px-2.5 py-1.5 text-xs font-light text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-border/50"
                />
              ))}
            </div>
            {exp.bullets.map((b, bi) => (
              <div key={bi} className="flex items-start gap-1.5">
                <span className="text-muted-foreground/40 text-xs mt-1.5">•</span>
                <textarea
                  value={b} rows={2}
                  onChange={(e) => {
                    const next = [...draft.experience];
                    const bullets = [...next[ei].bullets];
                    bullets[bi] = e.target.value;
                    next[ei] = { ...next[ei], bullets };
                    patch({ experience: next });
                  }}
                  className="flex-1 rounded-lg border border-border/25 bg-background/40 px-2.5 py-1.5 text-xs font-light text-foreground focus:outline-none focus:border-border/50 resize-y"
                />
                <button
                  onClick={() => {
                    const next = [...draft.experience];
                    next[ei] = { ...next[ei], bullets: next[ei].bullets.filter((_, i) => i !== bi) };
                    patch({ experience: next });
                  }}
                  aria-label="Remove bullet"
                  className="text-muted-foreground/40 hover:text-destructive transition-colors mt-1.5"
                ><X className="h-3 w-3" /></button>
              </div>
            ))}
            <button
              onClick={() => {
                const next = [...draft.experience];
                next[ei] = { ...next[ei], bullets: [...next[ei].bullets, ""] };
                patch({ experience: next });
              }}
              className="inline-flex items-center gap-1 text-[10px] font-light text-muted-foreground/60 hover:text-foreground transition-colors"
            ><Plus className="h-3 w-3" /> bullet</button>
          </div>
        ))}
        <button
          onClick={() => patch({ experience: [...draft.experience, { company: "", title: "", bullets: [] }] })}
          className="inline-flex items-center gap-1 text-[10px] font-light text-muted-foreground/60 hover:text-foreground transition-colors"
        ><Plus className="h-3 w-3" /> role</button>

        <label className="block">
          <span className="text-[10px] font-light tracking-wider uppercase text-muted-foreground/50">Skills (comma separated)</span>
          <input
            value={draft.skills.join(", ")}
            onChange={(e) => patch({ skills: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
            className="mt-1 w-full rounded-lg border border-border/25 bg-background/40 px-3 py-1.5 text-xs font-light text-foreground focus:outline-none focus:border-border/50"
          />
        </label>
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ASK TAB
// ═══════════════════════════════════════════════════════════════════════════

function AskTab(props: {
  hasResume: boolean;
  thread: { role: "user" | "assistant"; text: string }[];
  input: string; setInput: (v: string) => void; onSend: () => void; busy: boolean;
}) {
  const { hasResume, thread, input, setInput, onSend, busy } = props;
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [thread.length]);

  if (!hasResume) {
    return <p className="max-w-2xl mx-auto text-center text-xs font-light text-muted-foreground/70 py-16">
      Import a resume on the Resume tab first — there is nothing to ask about yet.
    </p>;
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-full">
      <div className="flex-1 space-y-3 min-h-[200px]">
        {thread.length === 0 && (
          <div className="text-xs font-light text-muted-foreground/60 space-y-1.5 py-6">
            <p className="text-foreground">Ask anything about your own document.</p>
            {[
              "Which bullet is weakest and why?",
              "Would a hiring manager in operations read me as senior or mid?",
              "Rewrite my summary to lead on the warehouse turnaround.",
              "What am I missing that keeps getting me filtered out?",
            ].map((s) => (
              <button key={s} onClick={() => setInput(s)} className="block text-left hover:text-foreground transition-colors">· {s}</button>
            ))}
          </div>
        )}
        {thread.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : ""}>
            <div className={`inline-block max-w-[85%] text-left rounded-xl px-3.5 py-2.5 text-xs font-light leading-relaxed whitespace-pre-wrap ${
              m.role === "user" ? "bg-foreground/10 text-foreground" : "bg-card/50 border border-border/20 text-foreground/90"
            }`}>{m.text}</div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="flex items-center gap-2 pt-4 sticky bottom-0 bg-background/80 backdrop-blur-sm">
        <input
          value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !busy) onSend(); }}
          placeholder="Ask about your resume…"
          className="flex-1 rounded-lg border border-border/25 bg-background/40 px-3 py-2 text-xs font-light text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-border/50"
        />
        <button onClick={onSend} disabled={busy || !input.trim()} aria-label="Send"
          className="p-2 rounded-lg border border-border/30 bg-card/50 text-foreground hover:bg-card/70 transition-colors disabled:opacity-30">
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// JOBS TAB
// ═══════════════════════════════════════════════════════════════════════════

function JobsTab(props: {
  settings: Settings; persistSettings: (p: Partial<Settings>) => void;
  addressInput: string; setAddressInput: (v: string) => void;
  keywordInput: string; setKeywordInput: (v: string) => void;
  onSetHome: () => void; onUseDevice: () => void; onSweep: () => void;
  leads: LeadRow[]; walkable: LeadRow[]; onApply: (l: LeadRow) => void;
  busy: boolean; summary: string | null; hasResume: boolean;
}) {
  const {
    settings, persistSettings, addressInput, setAddressInput, keywordInput, setKeywordInput,
    onSetHome, onUseDevice, onSweep, leads, walkable, onApply, busy, summary, hasResume,
  } = props;

  const hasHome = settings.home_lat !== null && settings.home_lng !== null;

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <section className="rounded-xl border border-border/20 bg-card/40 p-5 space-y-4">
        <h3 className="text-xs font-light tracking-wider uppercase text-foreground">Search perimeter</h3>

        <div className="flex items-center gap-2 flex-wrap">
          <input
            value={addressInput} onChange={(e) => setAddressInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onSetHome(); }}
            placeholder={settings.home_label || "Your address, or just city and postcode"}
            className="flex-1 min-w-[220px] rounded-lg border border-border/25 bg-background/40 px-3 py-2 text-xs font-light text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-border/50"
          />
          <button onClick={onSetHome} disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border/30 bg-card/50 text-xs font-light text-foreground hover:bg-card/70 transition-colors disabled:opacity-40">
            <MapPin className="h-3.5 w-3.5" /> Set
          </button>
          <button onClick={onUseDevice} disabled={busy}
            className="px-3 py-2 rounded-lg border border-border/30 bg-card/50 text-xs font-light text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40">
            Use this device
          </button>
        </div>
        {hasHome && <p className="text-[10px] font-light text-muted-foreground/50">Anchored at {settings.home_label}</p>}

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-[10px] font-light tracking-wider uppercase text-muted-foreground/50">
              Search radius — {settings.radius_miles} mi
            </span>
            <input
              type="range" min={0.5} max={25} step={0.5} value={settings.radius_miles}
              onChange={(e) => persistSettings({ radius_miles: Number(e.target.value) })}
              className="mt-2 w-full accent-foreground"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-light tracking-wider uppercase text-muted-foreground/50">
              Counts as walkable under — {settings.walk_radius_miles} mi
            </span>
            <input
              type="range" min={0.25} max={Math.max(1, settings.radius_miles)} step={0.25} value={settings.walk_radius_miles}
              onChange={(e) => persistSettings({ walk_radius_miles: Number(e.target.value) })}
              className="mt-2 w-full accent-foreground"
            />
          </label>
        </div>

        <div>
          <span className="text-[10px] font-light tracking-wider uppercase text-muted-foreground/50">Roles to look for</span>
          <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
            {settings.keywords.map((k) => (
              <span key={k} className="inline-flex items-center gap-1 rounded-lg border border-border/25 bg-foreground/[0.06] px-2 py-1 text-[10px] font-light text-foreground">
                {k}
                <button onClick={() => persistSettings({ keywords: settings.keywords.filter((x) => x !== k) })} aria-label={`Remove ${k}`}>
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
            <input
              value={keywordInput} onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && keywordInput.trim()) {
                  persistSettings({ keywords: [...new Set([...settings.keywords, keywordInput.trim()])].slice(0, 6) });
                  setKeywordInput("");
                }
              }}
              placeholder="add a role, press enter"
              className="rounded-lg border border-border/25 bg-background/40 px-2.5 py-1 text-[10px] font-light text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-border/50"
            />
          </div>
          {settings.keywords.length === 0 && (
            <p className="text-[10px] font-light text-muted-foreground/50 mt-1.5">
              Left empty, the sweep uses the job titles already on your resume.
            </p>
          )}
        </div>

        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox" checked={settings.autonomous}
            onChange={(e) => persistSettings({ autonomous: e.target.checked })}
            className="mt-0.5 accent-foreground"
          />
          <span>
            <span className="text-xs font-light text-foreground">Apply autonomously</span>
            <span className="block text-[10px] font-light text-muted-foreground/60 leading-relaxed">
              When a posting lists an application address, the tailored resume and letter are sent from your connected Google
              account without a second confirmation. Postings that only accept their own web form are always prepared, never
              submitted — a form filled blind under your name is a risk no automation should take. Off by default; everything
              lands as a Gmail draft instead.
            </span>
          </span>
        </label>

        <div className="flex items-center gap-2">
          <button onClick={onSweep} disabled={busy || !hasHome}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-foreground/30 bg-foreground/10 text-xs font-light text-foreground hover:bg-foreground/15 transition-colors disabled:opacity-40">
            <Radar className="h-3.5 w-3.5" /> Sweep for openings
          </button>
          {settings.last_run_at && (
            <span className="text-[10px] font-light text-muted-foreground/50">
              last swept {new Date(settings.last_run_at).toLocaleString()}
            </span>
          )}
        </div>
        {summary && <p className="text-[11px] font-light text-muted-foreground/70 leading-relaxed">{summary}</p>}
      </section>

      {walkable.length > 0 && (
        <section className="rounded-xl border border-border/25 bg-card/40 p-5">
          <div className="flex items-center gap-2 mb-1">
            <Footprints className="h-4 w-4 text-muted-foreground/70" />
            <h3 className="text-xs font-light tracking-wider uppercase text-foreground">
              {walkable.length} within walking distance
            </h3>
          </div>
          <p className="text-[10px] font-light text-muted-foreground/50">
            Sourced from the local business register, so these are employers standing near you — not confirmed vacancies.
          </p>
        </section>
      )}

      {leads.length === 0 ? (
        <p className="text-xs font-light text-muted-foreground/60 text-center py-10">
          {hasHome ? "No leads yet. Run a sweep." : "Set your location, then run a sweep."}
        </p>
      ) : (
        <div className="space-y-2.5">
          {leads.map((l) => (
            <article key={l.id} className="rounded-xl border border-border/20 bg-card/40 p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-xs font-light text-foreground truncate">{l.title}</h4>
                    <span className="text-[9px] font-light tracking-wider uppercase text-muted-foreground/40 border border-border/25 rounded px-1.5 py-0.5">
                      {l.source === "local" ? "local register" : "posted listing"}
                    </span>
                    {l.walkable && (
                      <span className="text-[9px] font-light tracking-wider uppercase text-foreground border border-foreground/30 rounded px-1.5 py-0.5">
                        walkable
                      </span>
                    )}
                    {l.status !== "new" && (
                      <span className="text-[9px] font-light tracking-wider uppercase text-muted-foreground/50">{l.status}</span>
                    )}
                  </div>
                  <p className="text-[11px] font-light text-muted-foreground/60 mt-0.5">
                    {[l.company, l.location, l.distance_miles !== null ? `${l.distance_miles} mi` : null].filter(Boolean).join(" · ")}
                  </p>
                  {l.description && (
                    <p className="text-[11px] font-light text-muted-foreground/60 mt-1 line-clamp-2 leading-relaxed">{l.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-lg font-extralight text-foreground tabular-nums">{l.match_score}</span>
                  {l.url && (
                    <a href={l.url} target="_blank" rel="noopener noreferrer" aria-label="Open listing"
                      className="p-1.5 rounded-lg border border-border/25 text-muted-foreground/70 hover:text-foreground transition-colors">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  <button onClick={() => onApply(l)} disabled={busy || !hasResume || l.status === "applied"}
                    className="px-3 py-1.5 rounded-lg border border-foreground/30 bg-foreground/10 text-[11px] font-light text-foreground hover:bg-foreground/15 transition-colors disabled:opacity-30">
                    {l.status === "applied" ? "Applied" : settings.autonomous ? "Tailor & send" : "Tailor & draft"}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
