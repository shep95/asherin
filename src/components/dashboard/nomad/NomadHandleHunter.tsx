import { useState, useRef, useEffect } from "react";
import {
  Fingerprint, Search, Globe, Copy, Check, ChevronDown, Plus,
  Languages, Send, Loader2, AlertTriangle, Shield, X
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";

interface PlatformResult {
  platform: string;
  url: string;
  confidence: number;
  falsePositiveRisk: "low" | "medium" | "high";
  reasoning?: string;
}

interface HandleSearch {
  id: string;
  handle: string;
  results: PlatformResult[];
  rawAnalysis: string;
  timestamp: number;
}

interface NameVariant {
  original: string;
  variants: string[];
  script: string;
}

interface NomadHandleHunterProps {
  entities: { type: string; value: string; confidence: number }[];
}

const PLATFORMS = [
  "Twitter/X", "GitHub", "LinkedIn", "Reddit", "Instagram", "TikTok",
  "Telegram", "Discord", "YouTube", "Medium", "Keybase", "HackerNews",
  "Stack Overflow", "Mastodon", "Pinterest", "Tumblr", "BitBucket", "GitLab",
];

function parsePlatformResults(content: string, handle: string): PlatformResult[] {
  const results: PlatformResult[] = [];
  const lines = content.split("\n");

  for (const platform of PLATFORMS) {
    const platformLower = platform.toLowerCase().replace(/[^a-z]/g, "");
    let confidence = 0;
    let risk: "low" | "medium" | "high" = "medium";
    let reasoning = "";
    let url = "";

    // Search for platform mention in the AI response
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      if (line.includes(platform.toLowerCase()) || line.includes(platformLower)) {
        // Extract confidence percentage
        const confMatch = lines[i].match(/(\d{1,3})\s*%/);
        if (confMatch) confidence = parseInt(confMatch[1]);

        // Extract risk level
        if (/\bhigh\s*(?:risk|false\s*positive)/i.test(lines[i])) risk = "high";
        else if (/\blow\s*(?:risk|false\s*positive)/i.test(lines[i])) risk = "low";
        else if (/\bmedium\s*(?:risk|false\s*positive)/i.test(lines[i])) risk = "medium";

        // Extract URL
        const urlMatch = lines[i].match(/https?:\/\/[^\s)]+/);
        if (urlMatch) url = urlMatch[0];

        // Get reasoning from surrounding text
        reasoning = lines[i].replace(/^[-*•\d.)\s]+/, "").trim();
        break;
      }
    }

    // Build URL if not found
    if (!url) {
      const domainMap: Record<string, string> = {
        "Twitter/X": `https://x.com/${handle}`,
        "GitHub": `https://github.com/${handle}`,
        "LinkedIn": `https://linkedin.com/in/${handle}`,
        "Reddit": `https://reddit.com/user/${handle}`,
        "Instagram": `https://instagram.com/${handle}`,
        "TikTok": `https://tiktok.com/@${handle}`,
        "Telegram": `https://t.me/${handle}`,
        "Discord": `https://discord.com/users/${handle}`,
        "YouTube": `https://youtube.com/@${handle}`,
        "Medium": `https://medium.com/@${handle}`,
        "Keybase": `https://keybase.io/${handle}`,
        "HackerNews": `https://news.ycombinator.com/user?id=${handle}`,
        "Stack Overflow": `https://stackoverflow.com/users?q=${handle}`,
        "Mastodon": `https://mastodon.social/@${handle}`,
        "Pinterest": `https://pinterest.com/${handle}`,
        "Tumblr": `https://${handle}.tumblr.com`,
        "BitBucket": `https://bitbucket.org/${handle}`,
        "GitLab": `https://gitlab.com/${handle}`,
      };
      url = domainMap[platform] || `https://${platformLower}.com/${handle}`;
    }

    results.push({ platform, url, confidence: confidence || 30, falsePositiveRisk: risk, reasoning });
  }

  return results.sort((a, b) => b.confidence - a.confidence);
}

const NomadHandleHunter = ({ entities }: NomadHandleHunterProps) => {
  const { user } = useAuth();
  const [tab, setTab] = useState<"hunt" | "translate" | "variants">("hunt");
  const [handle, setHandle] = useState("");
  const [searches, setSearches] = useState<HandleSearch[]>([]);
  const [loading, setLoading] = useState(false);
  const [translateText, setTranslateText] = useState("");
  const [translatedResult, setTranslatedResult] = useState("");
  const [translating, setTranslating] = useState(false);
  const [variantName, setVariantName] = useState("");
  const [variants, setVariants] = useState<NameVariant[]>([]);
  const [generatingVariants, setGeneratingVariants] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedSearch, setExpandedSearch] = useState<string | null>(null);

  const huntHandle = async () => {
    if (!handle.trim() || loading) return;
    setLoading(true);
    const cleanHandle = handle.trim().replace(/^@/, "");

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nomad-investigate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: [
              {
                role: "user",
                content: `HANDLE PIVOT ANALYSIS for username: "${cleanHandle}"

For each of these platforms, assess the likelihood this handle exists and belongs to the same person: ${PLATFORMS.join(", ")}.

For each platform, provide:
1. The likely profile URL
2. A confidence score (0-100%)
3. False positive risk (low/medium/high)
4. Brief reasoning

Also note any patterns: handle reuse across platforms, naming conventions, and potential sock puppets.
Format each platform on its own line with the confidence percentage clearly visible.`,
              },
            ],
          }),
        }
      );

      if (!resp.ok) throw new Error(`Request failed (${resp.status})`);

      // Read streaming response
      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) fullContent += content;
          } catch { break; }
        }
      }

      // Parse AI response into structured results
      const results = parsePlatformResults(fullContent, cleanHandle);

      const search: HandleSearch = {
        id: crypto.randomUUID(),
        handle: cleanHandle,
        results,
        rawAnalysis: fullContent,
        timestamp: Date.now(),
      };
      setSearches(prev => [search, ...prev]);
      setExpandedSearch(search.id);
    } catch (e) {
      console.error("Handle hunt error:", e);
    } finally {
      setLoading(false);
    }
  };

  const translate = async () => {
    if (!translateText.trim() || translating) return;
    setTranslating(true);
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nomad-investigate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: [
              { role: "user", content: `Translate the following text into English. Also provide transliteration if the source language uses a non-Latin script. Identify the source language.\n\nText: "${translateText}"` },
            ],
          }),
        }
      );

      if (!resp.ok) throw new Error("Translation failed");

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) fullContent += content;
          } catch { break; }
        }
      }

      setTranslatedResult(fullContent);
    } catch (e) {
      setTranslatedResult(`Error: ${e instanceof Error ? e.message : "Unknown"}`);
    } finally {
      setTranslating(false);
    }
  };

  const generateVariants = async () => {
    if (!variantName.trim() || generatingVariants) return;
    setGeneratingVariants(true);
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nomad-investigate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: [
              { role: "user", content: `Generate name variants for "${variantName}" across multiple scripts and transliteration systems:
1. Arabic script variants (with diacritical marks)
2. Russian/Cyrillic variants
3. Chinese simplified and traditional
4. Common Latin transliterations
5. Username-style variants (no spaces, common substitutions)
6. Phonetic equivalents

List all variants clearly.` },
            ],
          }),
        }
      );

      if (!resp.ok) throw new Error("Variant generation failed");

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) fullContent += content;
          } catch { break; }
        }
      }

      setVariants(prev => [...prev, { original: variantName, variants: fullContent.split("\n").filter((l: string) => l.trim()), script: "multi" }]);
    } catch (e) {
      console.error("Variant generation error:", e);
    } finally {
      setGeneratingVariants(false);
    }
  };

  const copyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleEntities = entities.filter(e => e.type === "handle" || e.type === "email");

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-4 py-2 border-b border-border/20">
        {([
          { id: "hunt" as const, label: "Handle Hunter", icon: Fingerprint },
          { id: "translate" as const, label: "Multi-lingual", icon: Languages },
          { id: "variants" as const, label: "Name Variants", icon: Globe },
        ]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-light transition-colors ${tab === t.id ? "bg-foreground/10 text-foreground" : "text-muted-foreground/40 hover:text-muted-foreground/60"}`}>
            <t.icon className="h-3 w-3" /> {t.label}
          </button>
        ))}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4">
          {tab === "hunt" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 rounded-xl border border-border/20 bg-card/30 px-3 py-2">
                  <Fingerprint className="h-3.5 w-3.5 text-muted-foreground/40" />
                  <input value={handle} onChange={e => setHandle(e.target.value)} onKeyDown={e => e.key === "Enter" && huntHandle()} placeholder="Enter handle/username (e.g. johndoe)" className="flex-1 bg-transparent text-xs font-light text-foreground placeholder:text-muted-foreground/30 outline-none" />
                </div>
                <button onClick={huntHandle} disabled={!handle.trim() || loading} className="p-2.5 rounded-xl bg-accent/20 text-accent hover:bg-accent/30 transition-colors disabled:opacity-30">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </button>
              </div>

              {handleEntities.length > 0 && (
                <div>
                  <p className="text-[9px] text-muted-foreground/40 uppercase tracking-wider mb-1">From Investigations</p>
                  <div className="flex flex-wrap gap-1">
                    {handleEntities.slice(0, 10).map((e, i) => (
                      <button key={i} onClick={() => setHandle(e.value)} className="px-2 py-1 rounded-lg text-[10px] border border-border/20 text-muted-foreground/50 hover:text-foreground transition-colors">
                        {e.value}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {searches.map(s => (
                <div key={s.id} className="rounded-xl border border-border/20 bg-card/10 p-4 space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Fingerprint className="h-4 w-4 text-accent/50" />
                    <span className="text-xs font-light text-foreground">@{s.handle}</span>
                    <span className="text-[9px] text-muted-foreground/30 ml-auto">{new Date(s.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {s.results.map((r, i) => (
                      <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg border border-border/10 bg-card/5 px-3 py-1.5 hover:bg-card/20 transition-colors">
                        <Globe className="h-3 w-3 text-muted-foreground/30 shrink-0" />
                        <span className="text-[10px] text-foreground/60 flex-1 truncate">{r.platform}</span>
                        <span className={`text-[8px] px-1.5 py-0.5 rounded ${
                          r.falsePositiveRisk === "low" ? "bg-emerald-500/15 text-emerald-400"
                          : r.falsePositiveRisk === "medium" ? "bg-amber-500/15 text-amber-400"
                          : "bg-red-500/15 text-red-400"
                        }`}>{r.confidence}%</span>
                      </a>
                    ))}
                  </div>
                  {/* Show raw AI analysis */}
                  <button
                    onClick={() => setExpandedSearch(expandedSearch === s.id ? null : s.id)}
                    className="text-[9px] text-muted-foreground/40 hover:text-muted-foreground mt-2"
                  >
                    {expandedSearch === s.id ? "Hide analysis" : "Show full analysis"}
                  </button>
                  {expandedSearch === s.id && s.rawAnalysis && (
                    <div className="rounded-lg border border-border/10 bg-card/10 p-3 mt-2 prose prose-sm prose-invert max-w-none text-xs font-light">
                      <ReactMarkdown>{s.rawAnalysis}</ReactMarkdown>
                    </div>
                  )}
                </div>
              ))}

              {searches.length === 0 && !loading && (
                <div className="text-center py-8">
                  <Fingerprint className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-[11px] text-muted-foreground/40 font-light">Enter a username to pivot across 18+ platforms with AI-powered confidence scoring.</p>
                </div>
              )}
            </div>
          )}

          {tab === "translate" && (
            <div className="space-y-4">
              <h3 className="text-sm font-light text-foreground">Multi-lingual OSINT</h3>
              <p className="text-[10px] text-muted-foreground/40">Inline translate + transliteration for cross-language investigation.</p>
              <div className="flex items-end gap-2">
                <textarea value={translateText} onChange={e => setTranslateText(e.target.value)} placeholder="Paste text in any language..." rows={3} className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/30 outline-none rounded-xl border border-border/20 p-3 resize-none" />
                <button onClick={translate} disabled={!translateText.trim() || translating} className="p-2.5 rounded-xl bg-accent/20 text-accent hover:bg-accent/30 transition-colors disabled:opacity-30">
                  {translating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
                </button>
              </div>
              {translatedResult && (
                <div className="rounded-xl border border-border/20 bg-card/20 p-4">
                  <div className="prose prose-sm prose-invert max-w-none text-xs font-light">
                    <ReactMarkdown>{translatedResult}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "variants" && (
            <div className="space-y-4">
              <h3 className="text-sm font-light text-foreground">Name Variant Generator</h3>
              <p className="text-[10px] text-muted-foreground/40">Generate name variants across Arabic, Russian, Chinese scripts with saved variant sets per case.</p>
              <div className="flex items-center gap-2">
                <input value={variantName} onChange={e => setVariantName(e.target.value)} onKeyDown={e => e.key === "Enter" && generateVariants()} placeholder="Enter a name (e.g. Mohammad Ali)" className="flex-1 bg-transparent text-xs text-foreground outline-none rounded-xl border border-border/20 px-3 py-2.5" />
                <button onClick={generateVariants} disabled={!variantName.trim() || generatingVariants} className="p-2.5 rounded-xl bg-accent/20 text-accent hover:bg-accent/30 transition-colors disabled:opacity-30">
                  {generatingVariants ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>

              {variants.map((v, i) => (
                <div key={i} className="rounded-xl border border-border/20 bg-card/10 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Globe className="h-4 w-4 text-accent/50" />
                    <span className="text-xs font-light text-foreground">{v.original}</span>
                    <button onClick={() => copyText(String(i), v.variants.join("\n"))} className="ml-auto text-[9px] text-muted-foreground/30 hover:text-foreground">
                      {copiedId === String(i) ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                  <div className="space-y-0.5">
                    {v.variants.slice(0, 20).map((vr, j) => (
                      <p key={j} className="text-[10px] text-foreground/60 font-light">{vr}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default NomadHandleHunter;
