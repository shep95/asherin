// ASHER ARCHIVES — Knowledge Harvester (admin-only widget).
// Scrapes IA + live web for a domain, synthesizes a dumbed-down .txt via
// Gemini, and writes it into asher_brains (feeds ASHER + AUREON).
import { useState } from "react";
import { Loader2, Database, Download, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { isOwnerEmail } from "@/lib/adminEmail";
const PRESETS: { label: string; domain: string; category: string; years: number }[] = [
  { label: "Modern Cybersecurity",        domain: "modern cybersecurity threats exploits CVE zero-day", category: "general", years: 4 },
  { label: "Modern Coding Knowledge",     domain: "modern software engineering languages frameworks best practices", category: "coding", years: 4 },
  { label: "Historic Warfare Strategies", domain: "historic warfare strategies doctrines battles", category: "general", years: 30 },
  { label: "AI / ML Frontier",            domain: "artificial intelligence machine learning transformers LLM research", category: "general", years: 4 },
  { label: "OSINT Tradecraft",            domain: "open source intelligence OSINT tradecraft tools investigations", category: "map", years: 6 },
  { label: "Software Protection",         domain: "anti-reverse-engineering obfuscation anti-debugging DRM packers", category: "coding", years: 8 },
  { label: "Crypto / Blockchain",         domain: "cryptography blockchain protocols zero-knowledge MPC", category: "general", years: 4 },
];

const CATEGORIES = ["general", "map", "coding", "personality", "azplen", "zali"];

export const ArchivesHarvesterPanel = () => {
  const { user } = useAuth();
  const isAdmin = isOwnerEmail(user?.email);

  const [domain, setDomain] = useState("");
  const [category, setCategory] = useState("general");
  const [years, setYears] = useState(4);
  const [running, setRunning] = useState(false);
  const [last, setLast] = useState<{ name: string; file: string; bytes: number; content: string } | null>(null);

  if (!isAdmin) return null;

  const run = async (preset?: typeof PRESETS[number]) => {
    const d = preset?.domain ?? domain.trim();
    const c = preset?.category ?? category;
    const y = preset?.years ?? years;
    if (!d || d.length < 3) { toast.error("Enter a domain (≥3 chars)"); return; }

    setRunning(true);
    setLast(null);
    const t = toast.loading(`Harvesting "${d}" (last ${y}y)…`);
    try {
      const { data, error } = await supabase.functions.invoke("asher-archives-harvest", {
        body: { domain: d, category: c, yearsBack: y },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "harvest failed");
      setLast({ name: data.brain.name, file: data.file_name, bytes: data.synthesized_chars, content: data.content });
      toast.success(`Brain installed → ${data.brain.name}`, { id: t });
    } catch (e) {
      toast.error(`Harvest failed: ${e instanceof Error ? e.message : String(e)}`, { id: t });
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
          Knowledge Harvester · Admin
        </h3>
        <span className="ml-auto text-[9px] tracking-[0.2em] uppercase text-muted-foreground/60">
          IA + Live Web → ASHER / AUREON brain
        </span>
      </div>

      <p className="text-[10px] font-light text-muted-foreground/80 leading-relaxed">
        Scrapes Internet Archive + live web for the domain, synthesizes a plain-English knowledge dump, saves it as a .txt and installs it as an active brain row consumed by ASHER and AUREON.
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
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder='Custom domain — e.g. "kernel exploitation 2020-2026"'
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
          type="number" min={1} max={40} value={years}
          onChange={(e) => setYears(Number(e.target.value) || 4)}
          className="col-span-1 bg-background/40 border border-border/25 rounded px-2 py-1.5 text-[11px] text-center"
          title="Years back"
        />
        <button
          onClick={() => run()}
          disabled={running}
          className="col-span-2 bg-foreground/90 text-background text-[10px] uppercase tracking-[0.2em] rounded px-3 py-1.5 hover:bg-foreground transition disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Database className="h-3 w-3" />}
          {running ? "Harvesting" : "Harvest"}
        </button>
      </div>

      {last && (
        <div className="border-t border-border/15 pt-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-light tracking-wide text-foreground/80">
              ✓ Installed: <span className="text-foreground">{last.name}</span>
              <span className="text-muted-foreground/60 ml-2">({(last.bytes / 1024).toFixed(1)} KB)</span>
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

export default ArchivesHarvesterPanel;
