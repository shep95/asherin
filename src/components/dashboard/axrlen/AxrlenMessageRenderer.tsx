import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";

interface Props {
  content: string;
  isStreaming?: boolean;
}

/**
 * Parse status grid blocks from the content.
 * Looks for patterns like:
 *   | LABEL |
 *   | **VALUE** |
 *   | description |
 */
function parseStatusGrid(text: string): { before: string; grid: { label: string; value: string; desc: string }[]; after: string } | null {
  // Match markdown tables with 2+ columns that look like status grids
  const tableMatch = text.match(/\|[^\n]+\|\n\|[\s:|-]+\|\n(\|[^\n]+\|\n?)+/);
  if (!tableMatch) return null;
  return null; // Let markdown handle tables natively with enhanced styling
}

/**
 * Parse probability bars from content.
 * Looks for lines like: "Major infrastructure strikes tonight  31%"
 */
function parseProbabilityMatrix(text: string): { label: string; value: number }[] {
  const lines = text.split("\n");
  const items: { label: string; value: number }[] = [];
  for (const line of lines) {
    const match = line.match(/^[\|]?\s*(.+?)\s+(\d{1,3})%\s*[\|]?\s*$/);
    if (match && match[1].trim().length > 5 && !match[1].includes("---")) {
      items.push({ label: match[1].trim().replace(/\*\*/g, ""), value: parseInt(match[2]) });
    }
  }
  return items;
}

const probabilityColor = (v: number) => {
  if (v >= 70) return "bg-red-500/70";
  if (v >= 50) return "bg-amber-500/70";
  if (v >= 30) return "bg-emerald-500/60";
  return "bg-blue-500/50";
};

const probabilityTextColor = (v: number) => {
  if (v >= 70) return "text-red-400";
  if (v >= 50) return "text-amber-400";
  if (v >= 30) return "text-emerald-400";
  return "text-blue-400";
};

// Custom markdown components for Claude-like rendering
const markdownComponents = {
  h1({ children, ...props }: any) {
    return (
      <h1 className="text-[15px] font-medium tracking-wide text-foreground/90 mt-6 mb-2 pb-2 border-b border-border/10" {...props}>
        {children}
      </h1>
    );
  },
  h2({ children, ...props }: any) {
    const text = String(children || "");
    // Detect section headers like "📅 TODAY", "⚡ SITUATION", "🔮 NEXUS-PRIME", etc
    const isDateHeader = /^📅|^🗓/.test(text);
    const isCritical = /CRITICAL|MAXIMUM|ESCALATION|EMERGENCY/i.test(text);
    const isStructural = /NEXUS-PRIME|Structural|Ghost Chain/i.test(text);
    const isPrediction = /PREDICTION|PRIMARY|VERDICT/i.test(text);

    let headerColor = "text-foreground/80";
    if (isDateHeader) headerColor = "text-blue-400/90";
    if (isCritical) headerColor = "text-red-400/90";
    if (isStructural) headerColor = "text-amber-400/80";
    if (isPrediction) headerColor = "text-emerald-400/80";

    return (
      <h2 className={`text-[13px] font-medium tracking-wide ${headerColor} mt-5 mb-2`} {...props}>
        {children}
      </h2>
    );
  },
  h3({ children, ...props }: any) {
    const text = String(children || "");
    const isStructural = /NEXUS-PRIME|Structural|Ghost Chain|Sentiment/i.test(text);
    const isMilitary = /Military|Combat|Strike|War|Attack/i.test(text);
    const isPrediction = /Prediction|Probability|Outcome|Confidence/i.test(text);

    let color = "text-foreground/70";
    if (isStructural) color = "text-amber-400/70";
    if (isMilitary) color = "text-red-400/70";
    if (isPrediction) color = "text-emerald-400/70";

    return (
      <h3 className={`text-[12px] font-medium ${color} mt-4 mb-1.5`} {...props}>
        {children}
      </h3>
    );
  },
  p({ children, ...props }: any) {
    return (
      <p className="text-[12px] text-foreground/70 leading-[1.7] mb-2.5 font-light" {...props}>
        {children}
      </p>
    );
  },
  strong({ children, ...props }: any) {
    const text = String(children || "");
    // Color-code key terms
    if (/CRITICAL|MAXIMUM|STRUCK|DEFIANT|WARNING|EMERGENCY|GUARANTEED/i.test(text)) {
      return <strong className="text-red-400 font-semibold" {...props}>{children}</strong>;
    }
    if (/100x|50x|10x|MULTIPLIER|VEDHA|WAR WINDOW/i.test(text)) {
      return <strong className="text-amber-400 font-semibold" {...props}>{children}</strong>;
    }
    if (/\d+%/.test(text) && /confidence|probability/i.test(text)) {
      return <strong className="text-emerald-400 font-semibold" {...props}>{children}</strong>;
    }
    if (/\$\d/.test(text)) {
      return <strong className="text-amber-300 font-semibold" {...props}>{children}</strong>;
    }
    return <strong className="text-foreground/90 font-semibold" {...props}>{children}</strong>;
  },
  em({ children, ...props }: any) {
    return <em className="text-foreground/50 italic" {...props}>{children}</em>;
  },
  blockquote({ children, ...props }: any) {
    return (
      <blockquote className="border-l-2 border-amber-500/30 pl-3 my-3 text-foreground/55 italic text-[11px]" {...props}>
        {children}
      </blockquote>
    );
  },
  ul({ children, ...props }: any) {
    return <ul className="space-y-1.5 my-2 ml-1" {...props}>{children}</ul>;
  },
  li({ children, ...props }: any) {
    return (
      <li className="text-[12px] text-foreground/65 leading-[1.6] font-light flex items-start gap-2" {...props}>
        <span className="text-foreground/25 mt-1 shrink-0">•</span>
        <span>{children}</span>
      </li>
    );
  },
  hr({ ...props }: any) {
    return <hr className="border-border/10 my-4" {...props} />;
  },
  table({ children, ...props }: any) {
    return (
      <div className="my-3 rounded-xl border border-border/10 bg-foreground/[0.02] overflow-hidden">
        <table className="w-full text-[11px]" {...props}>{children}</table>
      </div>
    );
  },
  thead({ children, ...props }: any) {
    return <thead className="bg-foreground/[0.04]" {...props}>{children}</thead>;
  },
  th({ children, ...props }: any) {
    return (
      <th className="px-3 py-2 text-left text-[9px] uppercase tracking-wider text-muted-foreground/50 font-medium border-b border-border/10" {...props}>
        {children}
      </th>
    );
  },
  td({ children, ...props }: any) {
    const text = String(children || "");
    let color = "text-foreground/60";
    if (/^\d+%$/.test(text.trim())) {
      const num = parseInt(text);
      if (num >= 70) color = "text-red-400";
      else if (num >= 40) color = "text-amber-400";
      else color = "text-emerald-400";
    }
    if (/HIGH|CRITICAL|DEFIANT|STRUCK/i.test(text)) color = "text-red-400";
    if (/LOW|STABLE|IMPROVING/i.test(text)) color = "text-emerald-400";
    return (
      <td className={`px-3 py-2 ${color} border-b border-border/[0.05] font-light`} {...props}>
        {children}
      </td>
    );
  },
  code({ children, className, ...props }: any) {
    const isBlock = className?.includes("language-");
    if (isBlock) {
      return (
        <code className="text-[10px] text-foreground/70" {...props}>
          {children}
        </code>
      );
    }
    return (
      <code className="bg-foreground/[0.06] px-1.5 py-0.5 rounded text-[10px] text-amber-300/80" {...props}>
        {children}
      </code>
    );
  },
  pre({ children, ...props }: any) {
    return (
      <pre className="bg-foreground/[0.03] border border-border/[0.08] rounded-xl p-3 my-3 overflow-x-auto" {...props}>
        {children}
      </pre>
    );
  },
};

/**
 * Detects and renders inline status grids from structured content.
 * Matches patterns like "US Deadline\n8 PM ET TONIGHT\nHormuz ultimatum"
 */
function StatusGridSection({ content }: { content: string }) {
  // Match blocks that look like status cards: LABEL\nVALUE\ndescription separated by double newlines
  const gridPattern = /^([A-Z][A-Z\s]+)\n\*\*(.+?)\*\*\n(.+)$/gm;
  const cards: { label: string; value: string; desc: string }[] = [];
  let match;
  while ((match = gridPattern.exec(content)) !== null) {
    cards.push({ label: match[1].trim(), value: match[2].trim(), desc: match[3].trim() });
  }

  if (cards.length < 2) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-3">
      {cards.map((card, i) => {
        const isRed = /STRUCK|DEFIANT|CRITICAL|100x|DEAD/i.test(card.value);
        const isAmber = /\$\d|SURGE|MULTIPLIER|ELEVATED/i.test(card.value);
        const valueColor = isRed ? "text-red-400" : isAmber ? "text-amber-400" : "text-foreground/80";

        return (
          <div key={i} className="p-3 rounded-xl border border-border/[0.08] bg-foreground/[0.02]">
            <p className="text-[8px] uppercase tracking-wider text-muted-foreground/40">{card.label}</p>
            <p className={`text-sm font-medium mt-0.5 ${valueColor}`}>{card.value}</p>
            <p className="text-[9px] text-muted-foreground/40 mt-0.5">{card.desc}</p>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Renders probability matrix bars inline
 */
function ProbabilityBars({ items }: { items: { label: string; value: number }[] }) {
  if (items.length < 2) return null;

  return (
    <div className="my-4 p-4 rounded-xl border border-border/[0.08] bg-foreground/[0.02] space-y-2.5">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground/40 mb-3">72-HOUR PROBABILITY MATRIX</p>
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-[11px] text-foreground/60 font-light w-[55%] shrink-0">{item.label}</span>
          <div className="flex-1 h-2 rounded-full bg-foreground/[0.04] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${probabilityColor(item.value)}`}
              style={{ width: `${item.value}%` }}
            />
          </div>
          <span className={`text-[11px] font-medium w-[35px] text-right ${probabilityTextColor(item.value)}`}>
            {item.value}%
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Detects section blocks and wraps them in styled containers
 */
function SectionBlock({ children, type }: { children: React.ReactNode; type: "critical" | "structural" | "military" | "prediction" | "verdict" | "default" }) {
  const borderColors: Record<string, string> = {
    critical: "border-l-red-500/40",
    structural: "border-l-amber-500/30",
    military: "border-l-red-400/25",
    prediction: "border-l-emerald-500/30",
    verdict: "border-l-amber-500/40",
    default: "border-l-border/20",
  };

  return (
    <div className={`pl-3 border-l-2 ${borderColors[type]} my-3`}>
      {children}
    </div>
  );
}

const AxrlenMessageRenderer = ({ content, isStreaming }: Props) => {
  // Detect probability matrix sections and render them specially
  const probItems = useMemo(() => parseProbabilityMatrix(content), [content]);
  const hasProbMatrix = probItems.length >= 3;

  // Split content to inject probability bars
  const sections = useMemo(() => {
    if (!hasProbMatrix) return [{ type: "markdown" as const, content }];

    // Find the probability matrix section and split around it
    const lines = content.split("\n");
    let matrixStart = -1;
    let matrixEnd = -1;

    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/^[\|]?\s*(.+?)\s+(\d{1,3})%\s*[\|]?\s*$/);
      if (match && match[1].trim().length > 5 && !match[1].includes("---")) {
        if (matrixStart === -1) matrixStart = i;
        matrixEnd = i;
      } else if (matrixStart !== -1 && matrixEnd !== -1 && i - matrixEnd > 2) {
        break;
      }
    }

    // Also check for header line before matrix
    if (matrixStart > 0 && /probability|matrix/i.test(lines[matrixStart - 1])) {
      matrixStart--;
    }
    if (matrixStart > 0 && lines[matrixStart - 1]?.trim() === "") {
      matrixStart--;
    }

    if (matrixStart === -1) return [{ type: "markdown" as const, content }];

    const before = lines.slice(0, matrixStart).join("\n");
    const after = lines.slice(matrixEnd + 1).join("\n");

    return [
      { type: "markdown" as const, content: before },
      { type: "probability" as const, content: "" },
      { type: "markdown" as const, content: after },
    ];
  }, [content, hasProbMatrix]);

  return (
    <div className="axrlen-response space-y-0">
      {sections.map((section, i) => {
        if (section.type === "probability") {
          return <ProbabilityBars key={i} items={probItems} />;
        }
        return (
          <div key={i} className="prose-axrlen">
            <ReactMarkdown components={markdownComponents}>
              {section.content}
            </ReactMarkdown>
          </div>
        );
      })}
      {isStreaming && (
        <span className="inline-block w-0.5 h-4 bg-foreground/60 animate-pulse ml-0.5 align-text-bottom" />
      )}
    </div>
  );
};

export default AxrlenMessageRenderer;
