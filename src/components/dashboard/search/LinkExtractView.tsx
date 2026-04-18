import { useState, useCallback } from "react";
import { Crosshair, Loader2, Globe, Copy, Check, ExternalLink, Link2, Sparkles, Shield, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";

const URL_REGEX = /^https?:\/\/[^\s]+$/i;

const LinkExtractView = () => {
  const [url, setUrl] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const normalizeUrl = (raw: string): string => {
    const trimmed = raw.trim();
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  };

  const handleExtract = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    const target = normalizeUrl(url);
    if (!target || !URL_REGEX.test(target)) {
      setError("Enter a valid URL or domain (e.g. example.com)");
      return;
    }

    setExtracting(true);
    setError(null);
    setResult(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke("elion-execute", {
        body: {
          moduleId: "deepdive-8",
          moduleName: "Blueprint Extract",
          category: "deepdive",
          query: target,
          ghostMode: false,
        },
      });

      if (invokeError) throw new Error(invokeError.message || String(invokeError));
      if (!data) throw new Error("No response from intelligence engine");
      if (data.error) throw new Error(data.error);

      const output = typeof data === "string" ? data : data?.output || data?.result || JSON.stringify(data, null, 2);
      if (!output || output === "No output generated.") throw new Error("Engine returned empty analysis");
      setResult(output);
    } catch (err: any) {
      setError(err.message || "Failed to extract intelligence from this URL");
    } finally {
      setExtracting(false);
    }
  }, [url]);

  const handleCopy = useCallback(() => {
    if (!result) return;
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result]);

  const displayDomain = (() => {
    try { return new URL(normalizeUrl(url)).hostname.replace(/^www\./, ""); }
    catch { return ""; }
  })();

  return (
    <div className="w-full animate-fade-in space-y-4">
      {/* Hero / Intro card */}
      <div className="rounded-2xl border border-accent/20 bg-gradient-to-br from-accent/[0.04] via-card/30 to-card/10 backdrop-blur-xl px-5 py-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-9 w-9 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center shrink-0">
            <Crosshair className="h-4 w-4 text-accent" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-light tracking-wide text-foreground">Link Intelligence Extract</h2>
            <p className="text-[10px] font-extralight text-muted-foreground/70">
              Drop any URL. Pull tech stack, fingerprints, blueprints, and architecture intel.
            </p>
          </div>
          <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-2 py-0.5 text-[9px] font-light tracking-[0.15em] text-emerald-200/70 uppercase shrink-0">
            <Sparkles className="h-2.5 w-2.5" /> Free
          </span>
        </div>

        {/* Input form */}
        <form onSubmit={handleExtract} className="mt-3">
          <div className="flex items-center gap-2 rounded-xl border border-border/30 bg-background/40 backdrop-blur-md px-3 py-2 focus-within:border-accent/40 transition-colors">
            <Link2 className="h-4 w-4 text-muted-foreground/50 shrink-0" />
            <input
              type="text"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setError(null); }}
              placeholder="https://example.com or example.com"
              className="flex-1 bg-transparent text-sm font-light text-foreground placeholder:text-muted-foreground/40 outline-none"
              disabled={extracting}
            />
            <button
              type="submit"
              disabled={extracting || !url.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent/20 hover:bg-accent/30 disabled:opacity-30 disabled:cursor-not-allowed px-3 py-1.5 text-[11px] font-medium tracking-wide text-accent transition-colors"
            >
              {extracting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  EXTRACTING
                </>
              ) : (
                <>
                  <Crosshair className="h-3.5 w-3.5" />
                  EXTRACT
                </>
              )}
            </button>
          </div>
          {error && (
            <p className="mt-2 text-[10px] font-light text-red-400/80">{error}</p>
          )}
        </form>

        {/* Capability strip */}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] font-extralight tracking-[0.12em] text-muted-foreground/40 uppercase">
          <span className="inline-flex items-center gap-1"><Shield className="h-2.5 w-2.5" /> Tech stack</span>
          <span className="h-1 w-1 rounded-full bg-muted-foreground/20" />
          <span className="inline-flex items-center gap-1"><Globe className="h-2.5 w-2.5" /> Fingerprints</span>
          <span className="h-1 w-1 rounded-full bg-muted-foreground/20" />
          <span className="inline-flex items-center gap-1"><Zap className="h-2.5 w-2.5" /> Architecture</span>
          <span className="h-1 w-1 rounded-full bg-muted-foreground/20" />
          <span>Headers · Frameworks · CDNs</span>
        </div>
      </div>

      {/* Loading state */}
      {extracting && !result && (
        <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-sm px-5 py-12 flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
          <p className="text-[10px] font-extralight tracking-[0.2em] text-muted-foreground/60 uppercase">
            Running Blueprint Extract on {displayDomain || "target"}…
          </p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-sm overflow-hidden animate-fade-in">
          {/* Header bar */}
          <div className="flex items-center gap-2 border-b border-border/10 px-4 py-2.5">
            <Crosshair className="h-3 w-3 text-accent" />
            <span className="text-[10px] font-semibold tracking-[0.2em] text-accent/80 uppercase">
              Intel Report
            </span>
            {displayDomain && (
              <span className="text-[10px] font-light text-muted-foreground/60 truncate">· {displayDomain}</span>
            )}
            <div className="ml-auto flex items-center gap-1">
              <button
                onClick={handleCopy}
                className="p-1.5 rounded-lg hover:bg-foreground/5 transition text-muted-foreground/50 hover:text-foreground/80"
                title="Copy report"
              >
                {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              </button>
              <a
                href={normalizeUrl(url)}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg hover:bg-foreground/5 transition text-muted-foreground/50 hover:text-foreground/80"
                title="Visit URL"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          {/* Markdown content */}
          <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
            <div className="prose prose-sm prose-invert max-w-none text-xs leading-relaxed
              [&_p]:mb-2 [&_p]:last:mb-0
              [&_code]:bg-black/30 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[11px]
              [&_pre]:bg-black/40 [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:text-[11px]
              [&_ul]:space-y-1 [&_li]:text-xs
              [&_h1]:text-sm [&_h1]:font-light [&_h1]:tracking-wide [&_h1]:text-foreground [&_h1]:mb-2
              [&_h2]:text-xs [&_h2]:font-light [&_h2]:tracking-wide [&_h2]:text-foreground [&_h2]:mb-1.5 [&_h2]:mt-3
              [&_h3]:text-xs [&_h3]:font-light [&_h3]:text-accent/80 [&_h3]:mb-1
              [&_table]:text-[11px] [&_th]:px-2 [&_th]:py-1 [&_td]:px-2 [&_td]:py-1
              [&_table]:border-border/20 [&_th]:border-border/20 [&_td]:border-border/20
              [&_hr]:border-border/20 [&_a]:text-accent/80 [&_a]:no-underline hover:[&_a]:underline">
              <ReactMarkdown>{result}</ReactMarkdown>
            </div>
          </div>
        </div>
      )}

      {/* Empty state when no result and not loading */}
      {!result && !extracting && !error && (
        <div className="rounded-2xl border border-dashed border-border/20 bg-card/10 px-5 py-10 text-center">
          <p className="text-[11px] font-extralight tracking-wide text-muted-foreground/50">
            Enter a URL above to extract its intelligence blueprint.
          </p>
        </div>
      )}
    </div>
  );
};

export default LinkExtractView;
