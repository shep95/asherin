import { useState } from "react";
import { Loader2, Eye, Table2 } from "lucide-react";
import { streamChat } from "@/lib/ai";

interface DetailRecord {
  id: string;
  [key: string]: string | number | null;
}

interface PatternDetail {
  columns: { key: string; label: string }[];
  records: DetailRecord[];
  summary: string;
}

interface DeepDiveProps {
  /** What kind of data to generate */
  category: string;
  /** Context for the AI to generate realistic data */
  context: string;
  /** Specific column instructions */
  columnHint?: string;
  /** Button label */
  label?: string;
}

const fmtVal = (v: string | number | null) => {
  if (v == null) return "—";
  if (typeof v === "number" && Math.abs(v) > 1000) {
    if (Math.abs(v) >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
    if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
    if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
    if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
    return `$${v.toLocaleString()}`;
  }
  return String(v);
};

const ZeeionDeepDive = ({ category, context, columnHint, label }: DeepDiveProps) => {
  const [detail, setDetail] = useState<PatternDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    let aiContent = "";
    try {
      const savedByok = localStorage.getItem("aureon_byok_active");
      localStorage.removeItem("aureon_byok_active");

      const colInstruction = columnHint || `columns: record_id, description, amount, department, date, status, risk_level. Generate 12-18 detailed records.`;

      await streamChat({
        messages: [{
          role: "user",
          content: `You are Aureon's forensic AI generating DETAILED itemized data.\n\nCategory: ${category}\nContext: ${context}\n\n${colInstruction}\n\nReturn ONLY a JSON object (no markdown):\n{\n  "columns": [{"key": "column_name", "label": "Display Label"}, ...],\n  "records": [{"id": "REC-001", "column_name": "value", ...}, ...],\n  "summary": "Brief summary of findings"\n}\n\nMake data realistic. Each record MUST have an "id" field with official-looking IDs. Include realistic dates in 2025-2026. Make amounts vary realistically. Generate 12-20 records.`
        }],
        mode: "research",
        onDelta: (chunk) => { aiContent += chunk; },
        onDone: () => {},
      });

      if (savedByok) localStorage.setItem("aureon_byok_active", savedByok);

      const clean = aiContent.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
      const jsonMatch = clean.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        setDetail(JSON.parse(jsonMatch[0]));
      }
    } catch (e) {
      console.error("Deep dive failed:", e);
    }
    setLoading(false);
  };

  if (detail) {
    return (
      <div className="mt-3">
        <div className="flex items-center gap-2 mb-2">
          <Table2 className="h-3 w-3 text-foreground/40" />
          <p className="text-[8px] uppercase tracking-[0.15em] text-foreground/50">Itemized Records ({detail.records.length})</p>
        </div>
        {detail.summary && (
          <p className="text-[9px] text-foreground/40 font-light mb-2 italic">{detail.summary}</p>
        )}
        <div className="overflow-x-auto rounded-lg border border-border/[0.08]">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border/[0.08] bg-foreground/[0.03]">
                {detail.columns.map(col => (
                  <th key={col.key} className="px-2.5 py-1.5 text-[7px] uppercase tracking-[0.15em] text-muted-foreground/40 font-medium whitespace-nowrap">{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {detail.records.map((rec, ri) => (
                <tr key={rec.id || ri} className="border-b border-border/[0.04] hover:bg-foreground/[0.03] transition-colors">
                  {detail.columns.map(col => {
                    const val = rec[col.key];
                    const isRisk = typeof val === "string" && /high|critical|flagged|suspicious|over.?budget|rejected|fraud|ghost|inactive/i.test(val);
                    const isGood = typeof val === "string" && /verified|resolved|low|clean|approved|active|compliant|on.?track/i.test(val);
                    return (
                      <td key={col.key} className={`px-2.5 py-1.5 text-[9px] font-light whitespace-nowrap ${isRisk ? "text-red-400/70" : isGood ? "text-emerald-400/70" : "text-foreground/55"}`}>
                        {fmtVal(val)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); generate(); }}
      disabled={loading}
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-foreground/[0.05] border border-border/[0.08] text-[9px] text-foreground/50 hover:bg-foreground/[0.08] transition-all disabled:opacity-40 mt-2"
    >
      {loading ? (
        <><Loader2 className="h-3 w-3 animate-spin" /> Generating detailed records...</>
      ) : (
        <><Eye className="h-3 w-3" /> {label || "Deep Dive — Show Itemized Records"}</>
      )}
    </button>
  );
};

export default ZeeionDeepDive;
