import { useState, useMemo } from "react";
import { AlertTriangle, Shield, Globe, Check, Link2, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface UrlAnalysis {
  original: string;
  defanged: string;
  protocol: string;
  hostname: string;
  path: string;
  params: Record<string, string>;
  risks: { label: string; severity: "high" | "medium" | "low" | "info"; detail: string }[];
  score: number;
}

const SUSPICIOUS_TLDS = [".tk", ".ml", ".ga", ".cf", ".gq", ".xyz", ".top", ".work", ".click", ".link", ".buzz", ".rest", ".icu"];
const SUSPICIOUS_KEYWORDS = ["login", "signin", "verify", "secure", "account", "update", "confirm", "password", "bank", "paypal", "apple", "microsoft", "google", "amazon"];
const HOMOGLYPHS: Record<string, string> = { "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "і": "i" };

function defang(url: string): string {
  return url.replace(/\./g, "[.]").replace(/https?:\/\//g, m => m.replace("://", "[://]"));
}

function analyzeUrl(raw: string): UrlAnalysis | null {
  try {
    const url = new URL(raw.startsWith("http") ? raw : "https://" + raw);
    const risks: UrlAnalysis["risks"] = [];
    let score = 0;

    // Check protocol
    if (url.protocol === "http:") { risks.push({ label: "No HTTPS", severity: "medium", detail: "URL uses unencrypted HTTP" }); score += 15; }

    // Check TLD
    const tld = "." + url.hostname.split(".").pop();
    if (SUSPICIOUS_TLDS.includes(tld)) { risks.push({ label: "Suspicious TLD", severity: "high", detail: `${tld} is commonly used in phishing` }); score += 25; }

    // Check length
    if (url.hostname.length > 30) { risks.push({ label: "Long hostname", severity: "medium", detail: `${url.hostname.length} characters — possible subdomain abuse` }); score += 10; }

    // Excessive subdomains
    const parts = url.hostname.split(".");
    if (parts.length > 4) { risks.push({ label: "Many subdomains", severity: "high", detail: `${parts.length} levels deep — subdomain phishing pattern` }); score += 20; }

    // IP address
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(url.hostname)) { risks.push({ label: "IP Address", severity: "high", detail: "URL points to raw IP — not a legitimate domain" }); score += 30; }

    // Suspicious keywords
    const urlLower = raw.toLowerCase();
    SUSPICIOUS_KEYWORDS.forEach(kw => {
      if (urlLower.includes(kw) && !url.hostname.includes(kw.slice(0, 4))) {
        risks.push({ label: `Keyword: ${kw}`, severity: "medium", detail: `Contains "${kw}" — possible credential harvesting` });
        score += 10;
      }
    });

    // Homoglyph detection
    const hostChars = url.hostname.split("");
    const homoglyphFound = hostChars.some(c => Object.keys(HOMOGLYPHS).includes(c));
    if (homoglyphFound) { risks.push({ label: "Homoglyph Attack", severity: "high", detail: "Domain contains Unicode look-alike characters (IDN homograph)" }); score += 35; }

    // @ sign in URL
    if (raw.includes("@")) { risks.push({ label: "@ in URL", severity: "high", detail: "URL contains @ — may redirect to attacker's server" }); score += 25; }

    // Data URI
    if (raw.startsWith("data:")) { risks.push({ label: "Data URI", severity: "high", detail: "Data URI scheme — possible phishing payload" }); score += 40; }

    // URL shortener
    const shorteners = ["bit.ly", "t.co", "goo.gl", "tinyurl.com", "ow.ly", "is.gd", "buff.ly"];
    if (shorteners.some(s => url.hostname.includes(s))) { risks.push({ label: "URL Shortener", severity: "medium", detail: "Shortened URL hides true destination" }); score += 15; }

    // Extract params
    const params: Record<string, string> = {};
    url.searchParams.forEach((v, k) => { params[k] = v; });

    if (risks.length === 0) { risks.push({ label: "No risks detected", severity: "info", detail: "URL appears clean, but always exercise caution" }); }

    return { original: raw, defanged: defang(raw), protocol: url.protocol, hostname: url.hostname, path: url.pathname, params, risks, score: Math.min(score, 100) };
  } catch { return null; }
}

const sevColor = (s: string) => {
  if (s === "high") return "text-red-400 border-red-500/30 bg-red-500/5";
  if (s === "medium") return "text-amber-400 border-amber-500/30 bg-amber-500/5";
  if (s === "low") return "text-blue-400 border-blue-500/30 bg-blue-500/5";
  return "text-muted-foreground/50 border-border/[0.08]";
};

const PhishingScanner = () => {
  const [url, setUrl] = useState("");
  const [history, setHistory] = useState<UrlAnalysis[]>([]);

  const analysis = useMemo(() => url.trim() ? analyzeUrl(url.trim()) : null, [url]);

  const handleScan = () => {
    if (analysis) {
      setHistory(prev => [analysis, ...prev.slice(0, 49)]);
      toast.success("URL analyzed");
    }
  };

  return (
    <div className="h-full flex flex-col bg-background/40">
      <div className="px-4 py-3 border-b border-border/[0.06] flex items-center gap-3">
        <Globe className="h-4 w-4 text-foreground/40" />
        <div>
          <h2 className="text-[11px] font-light tracking-[0.1em] text-foreground/80 uppercase">Phishing URL Scanner</h2>
          <p className="text-[8px] text-muted-foreground/30">Defang, analyze, and risk-score suspicious URLs</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="flex gap-2">
          <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="Paste suspicious URL here..."
            className="text-xs font-mono bg-card/30 border-border/[0.08]"
            onKeyDown={e => e.key === "Enter" && handleScan()} />
          <Button size="sm" onClick={handleScan} disabled={!analysis} className="text-[10px]">
            <Shield className="h-3 w-3 mr-1" /> Scan
          </Button>
        </div>

        {analysis && (
          <>
            {/* Score */}
            <div className="rounded-lg border border-border/[0.08] bg-card/20 p-4 flex items-center gap-4">
              <div className={`text-3xl font-light ${analysis.score > 50 ? "text-red-400" : analysis.score > 20 ? "text-amber-400" : "text-emerald-400"}`}>
                {analysis.score}
              </div>
              <div className="flex-1">
                <div className="text-[10px] text-foreground/60">Risk Score</div>
                <div className="w-full h-2 rounded-full bg-foreground/[0.04] mt-1">
                  <div className={`h-full rounded-full transition-all ${analysis.score > 50 ? "bg-red-500/60" : analysis.score > 20 ? "bg-amber-500/60" : "bg-emerald-500/60"}`}
                    style={{ width: `${analysis.score}%` }} />
                </div>
              </div>
            </div>

            {/* Defanged */}
            <div className="rounded-lg border border-border/[0.08] bg-card/20 p-3 flex items-center justify-between">
              <div>
                <div className="text-[8px] text-muted-foreground/30 uppercase">Defanged URL (safe to share)</div>
                <div className="text-[10px] font-mono text-emerald-400/70 mt-0.5 break-all">{analysis.defanged}</div>
              </div>
              <Button size="sm" variant="ghost" className="h-6 text-[8px]" onClick={() => { navigator.clipboard.writeText(analysis.defanged); toast.success("Copied"); }}>
                <Copy className="h-2.5 w-2.5" />
              </Button>
            </div>

            {/* URL breakdown */}
            <div className="grid grid-cols-3 gap-3">
              {[{ label: "Protocol", value: analysis.protocol }, { label: "Hostname", value: analysis.hostname }, { label: "Path", value: analysis.path }].map(item => (
                <div key={item.label} className="rounded-lg border border-border/[0.08] bg-card/20 p-3">
                  <div className="text-[8px] text-muted-foreground/30 uppercase">{item.label}</div>
                  <div className="text-[10px] text-foreground/60 font-mono truncate mt-0.5">{item.value || "/"}</div>
                </div>
              ))}
            </div>

            {/* Risks */}
            <div className="rounded-lg border border-border/[0.08] bg-card/20 p-3 space-y-2">
              <div className="text-[9px] text-muted-foreground/30 uppercase tracking-wider">Risk Indicators</div>
              {analysis.risks.map((r, i) => (
                <div key={i} className={`flex items-start gap-2 p-2 rounded border ${sevColor(r.severity)}`}>
                  {r.severity === "high" ? <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" /> : r.severity === "info" ? <Check className="h-3 w-3 mt-0.5 shrink-0" /> : <Shield className="h-3 w-3 mt-0.5 shrink-0" />}
                  <div>
                    <div className="text-[10px] font-medium">{r.label}</div>
                    <div className="text-[9px] opacity-60">{r.detail}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Query params */}
            {Object.keys(analysis.params).length > 0 && (
              <div className="rounded-lg border border-border/[0.08] bg-card/20 p-3">
                <div className="text-[9px] text-muted-foreground/30 uppercase tracking-wider mb-2">Query Parameters</div>
                <div className="divide-y divide-border/[0.04]">
                  {Object.entries(analysis.params).map(([k, v]) => (
                    <div key={k} className="flex gap-3 py-1.5 text-[10px] font-mono">
                      <span className="text-foreground/50 shrink-0">{k}</span>
                      <span className="text-foreground/30 break-all">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* History */}
        {history.length > 0 && (
          <div className="rounded-lg border border-border/[0.08] bg-card/20 p-3">
            <div className="text-[9px] text-muted-foreground/30 uppercase tracking-wider mb-2">Scan History</div>
            <div className="max-h-[200px] overflow-y-auto divide-y divide-border/[0.04]">
              {history.map((h, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 text-[10px] cursor-pointer hover:bg-foreground/[0.02]"
                  onClick={() => setUrl(h.original)}>
                  <span className="font-mono text-foreground/50 truncate max-w-[70%]">{h.defanged}</span>
                  <Badge variant="outline" className={`text-[8px] ${h.score > 50 ? "text-red-400" : h.score > 20 ? "text-amber-400" : "text-emerald-400"}`}>
                    {h.score}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PhishingScanner;
