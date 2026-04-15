import { useState, useMemo } from "react";
import { Code2, Copy, AlertTriangle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const PRESETS = [
  { label: "Email", pattern: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}" },
  { label: "IPv4", pattern: "\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b" },
  { label: "IPv6", pattern: "([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}" },
  { label: "URL", pattern: "https?://[^\\s/$.?#].[^\\s]*" },
  { label: "Phone", pattern: "\\+?\\d{1,4}[-.\\s]?\\(?\\d{1,4}\\)?[-.\\s]?\\d{1,9}" },
  { label: "MD5", pattern: "\\b[a-fA-F0-9]{32}\\b" },
  { label: "SHA256", pattern: "\\b[a-fA-F0-9]{64}\\b" },
  { label: "CVE", pattern: "CVE-\\d{4}-\\d{4,}" },
];

const RegexTester = () => {
  const [pattern, setPattern] = useState("");
  const [flags, setFlags] = useState("gi");
  const [testStr, setTestStr] = useState("");
  const [replaceMode, setReplaceMode] = useState(false);
  const [replaceWith, setReplaceWith] = useState("");

  const result = useMemo(() => {
    if (!pattern || !testStr) return { matches: [], error: null, replaced: "" };
    try {
      const re = new RegExp(pattern, flags);
      const matches: { text: string; index: number; groups: string[] }[] = [];
      let m: RegExpExecArray | null;
      const reClone = new RegExp(pattern, flags);
      let safety = 0;
      while ((m = reClone.exec(testStr)) !== null && safety < 5000) {
        matches.push({ text: m[0], index: m.index, groups: m.slice(1) });
        if (!flags.includes("g")) break;
        if (m[0].length === 0) reClone.lastIndex++;
        safety++;
      }
      const replaced = replaceMode ? testStr.replace(re, replaceWith) : "";
      return { matches, error: null, replaced };
    } catch (e: any) {
      return { matches: [], error: e.message, replaced: "" };
    }
  }, [pattern, flags, testStr, replaceMode, replaceWith]);

  const highlightedText = useMemo(() => {
    if (!pattern || !testStr || result.error) return null;
    try {
      const re = new RegExp(pattern, flags.includes("g") ? flags : flags + "g");
      const parts: { text: string; match: boolean }[] = [];
      let last = 0;
      let m: RegExpExecArray | null;
      let safety = 0;
      while ((m = re.exec(testStr)) !== null && safety < 5000) {
        if (m.index > last) parts.push({ text: testStr.slice(last, m.index), match: false });
        parts.push({ text: m[0], match: true });
        last = m.index + m[0].length;
        if (m[0].length === 0) re.lastIndex++;
        safety++;
      }
      if (last < testStr.length) parts.push({ text: testStr.slice(last), match: false });
      return parts;
    } catch {
      return null;
    }
  }, [pattern, flags, testStr, result.error]);

  return (
    <div className="h-full flex flex-col bg-background/40">
      <div className="px-4 py-3 border-b border-border/[0.06] flex items-center gap-3">
        <Code2 className="h-4 w-4 text-foreground/40" />
        <div>
          <h2 className="text-[11px] font-light tracking-[0.1em] text-foreground/80 uppercase">Regex Tester</h2>
          <p className="text-[8px] text-muted-foreground/30">Visual regex builder with match highlighting</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Presets */}
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map(p => (
            <button key={p.label} onClick={() => setPattern(p.pattern)}
              className="px-2 py-1 rounded text-[9px] bg-foreground/[0.04] border border-border/[0.08] text-muted-foreground/50 hover:text-foreground/70 hover:bg-foreground/[0.06] transition-colors">
              {p.label}
            </button>
          ))}
        </div>

        {/* Pattern input */}
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-1 bg-card/30 border border-border/[0.08] rounded-lg px-3">
            <span className="text-foreground/30 text-xs font-mono">/</span>
            <Input value={pattern} onChange={e => setPattern(e.target.value)} placeholder="Enter regex pattern..."
              className="border-0 bg-transparent text-xs font-mono focus-visible:ring-0 h-8" />
            <span className="text-foreground/30 text-xs font-mono">/</span>
            <Input value={flags} onChange={e => setFlags(e.target.value)} className="border-0 bg-transparent text-xs font-mono focus-visible:ring-0 w-12 h-8" />
          </div>
          <Button size="sm" variant={replaceMode ? "default" : "ghost"} onClick={() => setReplaceMode(!replaceMode)} className="text-[9px] h-8">
            Replace
          </Button>
        </div>

        {result.error && (
          <div className="flex items-center gap-2 text-red-400 text-[10px] bg-red-500/5 border border-red-500/10 rounded-lg px-3 py-2">
            <AlertTriangle className="h-3 w-3" /> {result.error}
          </div>
        )}

        {replaceMode && (
          <Input value={replaceWith} onChange={e => setReplaceWith(e.target.value)} placeholder="Replace with..."
            className="text-xs font-mono bg-card/30 border-border/[0.08]" />
        )}

        {/* Test string */}
        <Textarea value={testStr} onChange={e => setTestStr(e.target.value)} placeholder="Paste test string here..."
          className="min-h-[120px] text-xs font-mono bg-card/30 border-border/[0.08]" />

        {/* Highlighted preview */}
        {highlightedText && highlightedText.length > 0 && (
          <div className="rounded-lg border border-border/[0.08] bg-card/20 p-3">
            <div className="text-[9px] text-muted-foreground/30 uppercase tracking-wider mb-2">Highlighted Matches</div>
            <div className="text-xs font-mono whitespace-pre-wrap break-all leading-relaxed">
              {highlightedText.map((p, i) =>
                p.match
                  ? <span key={i} className="bg-emerald-500/20 text-emerald-400 rounded px-0.5">{p.text}</span>
                  : <span key={i} className="text-foreground/50">{p.text}</span>
              )}
            </div>
          </div>
        )}

        {/* Match results */}
        {result.matches.length > 0 && (
          <div className="rounded-lg border border-border/[0.08] bg-card/20 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-muted-foreground/30 uppercase tracking-wider">
                {result.matches.length} Match{result.matches.length !== 1 ? "es" : ""}
              </span>
              <Button size="sm" variant="ghost" className="h-5 text-[8px]" onClick={() => {
                navigator.clipboard.writeText(result.matches.map(m => m.text).join("\n"));
                toast.success("Matches copied");
              }}><Copy className="h-2.5 w-2.5 mr-1" />Copy All</Button>
            </div>
            <div className="max-h-[200px] overflow-y-auto space-y-1">
              {result.matches.slice(0, 200).map((m, i) => (
                <div key={i} className="flex items-center gap-3 text-[10px] font-mono py-1 border-b border-border/[0.04] last:border-0">
                  <Badge variant="outline" className="text-[8px] h-4 bg-foreground/[0.03]">{i}</Badge>
                  <span className="text-emerald-400/80">{m.text}</span>
                  <span className="text-muted-foreground/20 ml-auto">idx:{m.index}</span>
                  {m.groups.length > 0 && <span className="text-amber-400/40">groups: {m.groups.join(", ")}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Replace output */}
        {replaceMode && result.replaced && (
          <div className="rounded-lg border border-border/[0.08] bg-card/20 p-3">
            <div className="text-[9px] text-muted-foreground/30 uppercase tracking-wider mb-2">Replace Result</div>
            <pre className="text-xs font-mono text-foreground/60 whitespace-pre-wrap">{result.replaced}</pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default RegexTester;
