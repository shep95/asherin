// ASHER SCRIBD — Knowledge Harvester (admin-only widget).
// Scrapes scribd.com for a topic, synthesizes a plain-English .txt knowledge
// dump via Gemini, and writes it into asher_brains (feeds ASHER + AUREON).
// Mirrors ArchivesHarvesterPanel — same UX, same brain pipeline.
import { useState } from "react";
import { Loader2, BookOpen, Download, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { isOwnerEmail } from "@/lib/adminEmail";
import { getActiveIntelMapByok } from "@/lib/intelMapByok";

const PRESETS: { label: string; topic: string; category: string }[] = [
  { label: "Military Doctrine",      topic: "military doctrine strategy field manuals", category: "general" },
  { label: "Intelligence Tradecraft", topic: "intelligence tradecraft OSINT CIA NSA declassified", category: "map" },
  { label: "Cybersecurity",          topic: "cybersecurity exploits vulnerabilities CVE", category: "general" },
  { label: "Legal / Court Filings",  topic: "court filings legal briefs case law", category: "general" },
  { label: "Academic Papers",        topic: "academic research papers thesis dissertation", category: "general" },
  { label: "Government Reports",     topic: "government reports policy white papers", category: "general" },
  { label: "Engineering Manuals",    topic: "engineering manuals technical specifications standards", category: "coding" },
  { label: "Financial Disclosures",  topic: "financial disclosures SEC filings annual reports", category: "general" },
];

const CATEGORIES = ["general", "map", "coding", "personality", "azplen", "zali"];

const ScribdPanel = () => {
  const { user } = useAuth();
  const isAdmin = isOwnerEmail(user?.email);

  const [topic, setTopic] = useState("");
  const [category, setCategory] = useState("general");
  const [maxSources, setMaxSources] = useState(25);
  const [running, setRunning] = useState(false);
  const [last, setLast] = useState<{ name: string; file: string; bytes: number; content: string; sources: number; textDocs: number } | null>(null);

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-border/20 bg-card/40 backdrop-blur-md p-6 text-center">
        <BookOpen className="h-5 w-5 mx-auto mb-2 text-muted-foreground/40" />
        <p className="text-[11px] font-light tracking-wide text-muted-foreground/70">
          Scribd Harvester is admin-only — it writes directly into the ASHER + AUREON brain memory.
        </p>
      </div>
    );
  }

  const run = async (preset?: typeof PRESETS[number]) => {
    const t = preset?.topic ?? topic.trim();
    const c = preset?.category ?? category;
    if (!t || t.length < 3) { toast.error("Enter a topic (≥3 chars)"); return; }

    setRunning(true);
    setLast(null);
    const toastId = toast.loading(`Harvesting scribd.com for "${t}"…`);
    try {
      const byok = getActiveIntelMapByok();
      const { data, error } = await supabase.functions.invoke("asher-scribd-harvest", {
        body: { topic: t, category: c, maxSources, ...(byok ? { byok } : {}) },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "harvest failed");
      setLast({
        name: data.brain.name,
        file: data.file_name,
        bytes: data.synthesized_chars,
        content: data.content,
        sources: data.sources_used,
        textDocs: data.documents_with_text ?? 0,
      });
      toast.success(`Brain installed → ${data.brain.name}  (found ${data.sources_used} docs · ${data.documents_with_text} with text)`, { id: toastId });
    } catch (e) {
      toast.error(`Harvest failed: ${e instanceof Error ? e.message : String(e)}`, { id: toastId });
    } finally {
      setRunning(false);
    }
  };

  const downloadTxt = () => {
    if (!last) return;
    const blob = new Blob([last.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = last.file; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="border border-border/20 bg-card/40 backdrop-blur-md rounded-md p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-foreground/70" strokeWidth={1.4} />
        <h3 className="text-[10px] font-light tracking-[0.25em] uppercase text-foreground/80">
          Scribd Harvester · Admin
        </h3>
        <span className="ml-auto text-[9px] tracking-[0.2em] uppercase text-muted-foreground/60">
          scribd.com → ASHER / AUREON brain
        </span>
      </div>

      <p className="text-[10px] font-light text-muted-foreground/80 leading-relaxed">
        Discovers scribd.com documents for the topic, pulls their titles + descriptions + visible text, synthesizes a plain-English knowledge dump, and installs it as an active brain row consumed by ASHER and AUREON.
      </p>

      {/* Presets */}
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            disabled={running}
            onClick={() => run(p)}
            className="text-[9px] uppercase tracking-[0.18em] px-2 py-1 rounded border border-border/25 hover:border-foreground/50 hover:bg-foreground/5 transition disabled:opacity-40"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom */}
      <div className="grid grid-cols-12 gap-2">
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder='Custom topic — e.g. "drone warfare 2020-2026"'
          className="col-span-7 bg-background/40 border border-border/25 rounded px-2 py-1.5 text-[11px] font-light placeholder:text-muted-foreground/40 focus:border-foreground/50 focus:outline-none"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="col-span-2 bg-background/40 border border-border/25 rounded px-2 py-1.5 text-[10px] uppercase tracking-wider"
        >
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input
          type="number" min={5} max={50} value={maxSources}
          onChange={(e) => setMaxSources(Number(e.target.value) || 25)}
          className="col-span-1 bg-background/40 border border-border/25 rounded px-2 py-1.5 text-[11px] text-center"
          title="Max scribd documents to pull"
        />
        <button
          onClick={() => run()}
          disabled={running}
          className="col-span-2 bg-foreground/90 text-background text-[10px] uppercase tracking-[0.2em] rounded px-3 py-1.5 hover:bg-foreground transition disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <BookOpen className="h-3 w-3" />}
          {running ? "Harvesting" : "Harvest"}
        </button>
      </div>

      {last && (
        <div className="border-t border-border/15 pt-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-light tracking-wide text-foreground/80">
              ✓ Installed: <span className="text-foreground">{last.name}</span>
              <span className="text-muted-foreground/60 ml-2">({(last.bytes / 1024).toFixed(1)} KB · {last.textDocs}/{last.sources} text documents)</span>
            </div>
            <button
              onClick={downloadTxt}
              className="text-[9px] uppercase tracking-[0.2em] px-2 py-1 rounded border border-border/25 hover:border-foreground/50 transition flex items-center gap-1"
            >
              <Download className="h-3 w-3" /> .txt
            </button>
          </div>
          <pre className="text-[10px] font-light leading-relaxed text-muted-foreground/80 max-h-48 overflow-auto bg-background/30 border border-border/15 rounded p-2 whitespace-pre-wrap">
            {last.content.slice(0, 1500)}{last.content.length > 1500 ? "\n…" : ""}
          </pre>
        </div>
      )}
    </div>
  );
};

export default ScribdPanel;
