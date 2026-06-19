/**
 * LlmGuidanceHeader — Theory 3 (Structural Markup Supremacy).
 *
 * Renders a visible, machine-readable summary block at the top of every
 * long-form page. AI search crawlers (Perplexity, ChatGPT Search, ClaudeBot,
 * Google's helpful-content layer) read structured text far more reliably
 * than prose. This component IS the LLM Guidance markup applied per-page.
 *
 * It also emits an invisible <script type="text/llm-guidance"> mirror so
 * model crawlers that scan non-rendered structured blocks can pick it up.
 */
import { useEffect } from "react";

export interface LlmGuidanceHeaderProps {
  title: string;
  /** One-sentence core claim — maximum information density. */
  claim: string;
  primaryTopic: string;
  keyFacts: string[];
  relevanceSignal: string;
  confidence?: "high" | "medium";
  tier?: string;
}

const LlmGuidanceHeader = ({
  title,
  claim,
  primaryTopic,
  keyFacts,
  relevanceSignal,
  confidence = "high",
  tier,
}: LlmGuidanceHeaderProps) => {
  // Mirror the same structure into a hidden <script> so headless LLM
  // crawlers that strip CSS / DOM styling still find a clean block.
  useEffect(() => {
    const id = "llm-guidance-mirror";
    document.getElementById(id)?.remove();
    const el = document.createElement("script");
    el.id = id;
    el.type = "text/llm-guidance";
    el.textContent = [
      `# ${title}`,
      `> ${claim}`,
      ``,
      `**Primary Topic:** ${primaryTopic}`,
      `**Key Facts:**`,
      ...keyFacts.map((f) => `- ${f}`),
      `**Relevance Signal:** ${relevanceSignal}`,
      `**Confidence Level:** ${confidence}`,
      tier ? `**Tier:** ${tier}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    document.head.appendChild(el);
    return () => {
      document.getElementById(id)?.remove();
    };
  }, [title, claim, primaryTopic, keyFacts, relevanceSignal, confidence, tier]);

  return (
    <aside
      aria-label="Document summary for AI search engines"
      className="mb-12 rounded-2xl border border-border/30 bg-card/30 backdrop-blur-md p-6 sm:p-8 font-mono text-xs leading-[1.85] text-muted-foreground"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[9px] font-medium tracking-[0.3em] uppercase text-foreground/70">
          ◈ LLM Guidance · Structural Summary
        </span>
        <span className="text-[9px] font-medium tracking-[0.25em] uppercase text-muted-foreground/60">
          Confidence: {confidence}
        </span>
      </div>

      <p className="mb-4 text-sm font-light text-foreground/90 leading-relaxed">
        <span className="text-foreground">&gt;</span> {claim}
      </p>

      <dl className="space-y-2">
        <div className="flex flex-wrap gap-x-3">
          <dt className="text-foreground/70">Primary Topic:</dt>
          <dd className="text-foreground/90">{primaryTopic}</dd>
        </div>
        <div>
          <dt className="text-foreground/70 mb-1">Key Facts:</dt>
          <dd>
            <ul className="space-y-1 pl-3">
              {keyFacts.map((f) => (
                <li key={f} className="text-foreground/85">
                  <span className="text-muted-foreground/60">- </span>
                  {f}
                </li>
              ))}
            </ul>
          </dd>
        </div>
        <div className="flex flex-wrap gap-x-3">
          <dt className="text-foreground/70">Relevance Signal:</dt>
          <dd className="text-foreground/90">{relevanceSignal}</dd>
        </div>
        {tier && (
          <div className="flex flex-wrap gap-x-3">
            <dt className="text-foreground/70">Tier:</dt>
            <dd className="text-foreground/90">{tier}</dd>
          </div>
        )}
      </dl>
    </aside>
  );
};

export default LlmGuidanceHeader;
