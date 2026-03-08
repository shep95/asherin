import { useState, useMemo } from "react";
import { X, GitBranch, Copy, Check, Brain, Lightbulb, Link2, Layers, Zap } from "lucide-react";

interface MessageDiagramPanelProps {
  open: boolean;
  content: string;
  conversationHistory?: { role: string; content: string }[];
  onClose: () => void;
}

type DiagramType = "knowledge" | "concepts" | "causal" | "taxonomy" | "neural";

/* ── Knowledge extraction helpers ── */

function extractKnowledge(content: string) {
  const facts: string[] = [];
  const concepts: string[] = [];
  const relationships: { from: string; to: string; label: string }[] = [];
  const categories: Record<string, string[]> = {};

  const lines = content.split("\n").filter(l => l.trim());
  let currentHeading = "General";

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,3}\s+(.+)/);
    if (headingMatch) {
      currentHeading = headingMatch[1].replace(/\*/g, "").trim().slice(0, 40);
      concepts.push(currentHeading);
      if (!categories[currentHeading]) categories[currentHeading] = [];
      continue;
    }

    const bulletMatch = line.match(/^[-*]\s+\*?\*?(.+?)\*?\*?\s*$/);
    const numberedMatch = line.match(/^\d+[\.)]\s+(.+)/);
    const factText = bulletMatch?.[1] || numberedMatch?.[1];

    if (factText) {
      const clean = factText.replace(/\*/g, "").replace(/\[.*?\]\(.*?\)/g, "").trim();
      if (clean.length > 8 && clean.length < 120) {
        facts.push(clean);
        if (!categories[currentHeading]) categories[currentHeading] = [];
        categories[currentHeading].push(clean.slice(0, 60));
      }
    }

    // Extract cause-effect patterns
    const causalPatterns = [
      /(.{10,50})\s+(?:leads to|causes|results in|enables|triggers|creates)\s+(.{10,50})/i,
      /(.{10,50})\s+(?:because|due to|since)\s+(.{10,50})/i,
      /(?:if|when)\s+(.{10,50}),?\s+(?:then)?\s*(.{10,50})/i,
    ];
    for (const pat of causalPatterns) {
      const m = line.match(pat);
      if (m) {
        relationships.push({
          from: m[1].replace(/\*/g, "").trim().slice(0, 40),
          to: m[2].replace(/\*/g, "").trim().slice(0, 40),
          label: "leads to",
        });
      }
    }
  }

  // Extract key terms (capitalized multi-word phrases)
  const termMatches = content.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g) || [];
  const uniqueTerms = [...new Set(termMatches)].slice(0, 8);
  uniqueTerms.forEach(t => { if (!concepts.includes(t)) concepts.push(t); });

  // Extract definitions/explanations
  const defPatterns = content.match(/\*\*(.+?)\*\*\s*[-:]\s*(.+?)(?:\.|$)/gm) || [];
  defPatterns.slice(0, 6).forEach(d => {
    const m = d.match(/\*\*(.+?)\*\*\s*[-:]\s*(.+)/);
    if (m) {
      relationships.push({
        from: m[1].trim().slice(0, 35),
        to: m[2].replace(/\*/g, "").trim().slice(0, 50),
        label: "means",
      });
    }
  });

  return { facts, concepts, relationships, categories };
}

function sanitize(s: string): string {
  return s.replace(/["\[\](){}|<>#&;]/g, "").replace(/\n/g, " ").trim();
}

/* ── Diagram generators ── */

function generateKnowledgeGraph(content: string): string {
  const { concepts, relationships, categories } = extractKnowledge(content);
  const nodes: string[] = [];
  const edges: string[] = [];
  let idx = 0;
  const nodeMap: Record<string, string> = {};

  const getNode = (label: string) => {
    const clean = sanitize(label).slice(0, 45);
    if (!clean) return null;
    if (!nodeMap[clean]) {
      nodeMap[clean] = `N${idx++}`;
      nodes.push(`  ${nodeMap[clean]}["${clean}"]`);
    }
    return nodeMap[clean];
  };

  // Add concept nodes from categories
  const cats = Object.entries(categories).slice(0, 6);
  for (const [cat, items] of cats) {
    const catNode = getNode(cat);
    if (!catNode) continue;
    for (const item of items.slice(0, 4)) {
      const itemNode = getNode(item);
      if (itemNode) edges.push(`  ${catNode} --> ${itemNode}`);
    }
  }

  // Add relationship edges
  for (const rel of relationships.slice(0, 8)) {
    const from = getNode(rel.from);
    const to = getNode(rel.to);
    if (from && to) edges.push(`  ${from} -->|${sanitize(rel.label)}| ${to}`);
  }

  // Fallback: use concepts as star graph
  if (nodes.length < 3 && concepts.length > 0) {
    const center = getNode(concepts[0] || "Knowledge");
    for (const c of concepts.slice(1, 8)) {
      const n = getNode(c);
      if (center && n) edges.push(`  ${center} --> ${n}`);
    }
  }

  if (nodes.length === 0) return `graph TD\n  C["No knowledge nodes extracted"]`;
  return `graph TD\n${nodes.join("\n")}\n${edges.join("\n")}`;
}

function generateConceptMap(content: string): string {
  const { concepts, facts, categories } = extractKnowledge(content);
  const center = sanitize(concepts[0] || "Core Knowledge");
  const nodes: string[] = [`  C(("${center.slice(0, 30)}"))`];
  const edges: string[] = [];
  let idx = 0;

  const cats = Object.keys(categories).slice(0, 6);
  if (cats.length > 1) {
    for (const cat of cats) {
      const clean = sanitize(cat).slice(0, 35);
      if (!clean || clean === center.slice(0, 30)) continue;
      const nid = `B${idx++}`;
      nodes.push(`  ${nid}["${clean}"]`);
      edges.push(`  C --- ${nid}`);
      const items = (categories[cat] || []).slice(0, 3);
      items.forEach((item, j) => {
        const iid = `L${idx}_${j}`;
        const cleanItem = sanitize(item).slice(0, 40);
        if (cleanItem) {
          nodes.push(`  ${iid}["${cleanItem}"]`);
          edges.push(`  ${nid} --- ${iid}`);
        }
      });
    }
  } else {
    // Flat: use facts as branches
    facts.slice(0, 8).forEach((f, i) => {
      const clean = sanitize(f).slice(0, 50);
      if (clean) {
        nodes.push(`  F${i}["${clean}"]`);
        edges.push(`  C --- F${i}`);
      }
    });
  }

  if (edges.length === 0) return `graph TD\n  C["No concepts extracted"]`;
  return `graph TD\n${nodes.join("\n")}\n${edges.join("\n")}`;
}

function generateCausalDiagram(content: string): string {
  const { relationships, facts } = extractKnowledge(content);
  const nodes: string[] = [];
  const edges: string[] = [];
  let idx = 0;
  const nodeMap: Record<string, string> = {};

  const getNode = (label: string) => {
    const clean = sanitize(label).slice(0, 45);
    if (!clean) return null;
    if (!nodeMap[clean]) {
      nodeMap[clean] = `N${idx++}`;
      nodes.push(`  ${nodeMap[clean]}["${clean}"]`);
    }
    return nodeMap[clean];
  };

  for (const rel of relationships.slice(0, 10)) {
    const from = getNode(rel.from);
    const to = getNode(rel.to);
    if (from && to) edges.push(`  ${from} ==>|${sanitize(rel.label)}| ${to}`);
  }

  // Fallback: chain key facts as logical sequence
  if (edges.length < 2) {
    const keyFacts = facts.filter(f => f.length > 15).slice(0, 8);
    keyFacts.forEach((f, i) => {
      const n = getNode(f.slice(0, 50));
      if (n && i > 0) {
        const prev = `N${i - 1}`;
        edges.push(`  ${prev} ==> ${n}`);
      }
    });
  }

  if (nodes.length === 0) return `graph TD\n  C["No causal links detected"]`;
  return `graph TD\n${nodes.join("\n")}\n${edges.join("\n")}`;
}

function generateTaxonomy(content: string): string {
  const { categories, concepts } = extractKnowledge(content);
  const root = sanitize(concepts[0] || "Knowledge Base").slice(0, 30);
  const nodes: string[] = [`  R["${root}"]`];
  const edges: string[] = [];
  let idx = 0;

  const cats = Object.entries(categories).slice(0, 6);
  for (const [cat, items] of cats) {
    const clean = sanitize(cat).slice(0, 35);
    if (!clean || clean === root) continue;
    const cid = `C${idx++}`;
    nodes.push(`  ${cid}["${clean}"]`);
    edges.push(`  R --> ${cid}`);
    items.slice(0, 4).forEach((item, j) => {
      const iclean = sanitize(item).slice(0, 40);
      if (iclean) {
        const iid = `I${idx}_${j}`;
        nodes.push(`  ${iid}["${iclean}"]`);
        edges.push(`  ${cid} --> ${iid}`);
      }
    });
  }

  if (edges.length === 0) return `graph TD\n  R["No taxonomy structure found"]`;
  return `graph TD\n${nodes.join("\n")}\n${edges.join("\n")}`;
}

/* ── Neural Timeline extraction ── */

interface NeuronNode {
  id: string;
  label: string;
  type: "input" | "process" | "insight" | "output";
  detail?: string;
  connections: string[];
  fireDelay: number; // 0-1 fraction for animation stagger
}

function extractNeuralTimeline(content: string): NeuronNode[] {
  const nodes: NeuronNode[] = [];
  const lines = content.split("\n").filter(l => l.trim());
  let idx = 0;

  // Phase 1: Input Recognition — extract the question/topic
  const firstLine = lines[0]?.replace(/[#*]/g, "").trim().slice(0, 60);
  if (firstLine) {
    nodes.push({ id: `n${idx}`, label: "Input Received", type: "input", detail: firstLine, connections: [], fireDelay: 0 });
    idx++;
  }

  // Phase 2: Parse headings as major processing nodes
  const headings: string[] = [];
  const bulletsByHeading: Record<string, string[]> = {};
  let currentH = "";
  for (const line of lines) {
    const hMatch = line.match(/^#{1,3}\s+(.+)/);
    if (hMatch) {
      currentH = hMatch[1].replace(/\*/g, "").trim().slice(0, 50);
      headings.push(currentH);
      bulletsByHeading[currentH] = [];
      continue;
    }
    const bMatch = line.match(/^[-*]\s+(.+)/);
    if (bMatch && currentH) {
      bulletsByHeading[currentH]?.push(bMatch[1].replace(/\*/g, "").trim().slice(0, 60));
    }
  }

  // Phase 3: Build processing chain
  if (headings.length > 0) {
    // Context retrieval node
    nodes.push({ id: `n${idx}`, label: "Context Retrieval", type: "process", detail: `Scanning ${headings.length} knowledge domains`, connections: [nodes[0]?.id].filter(Boolean), fireDelay: 0.1 });
    idx++;

    headings.slice(0, 6).forEach((h, i) => {
      const bullets = bulletsByHeading[h] || [];
      nodes.push({
        id: `n${idx}`,
        label: h,
        type: "process",
        detail: bullets[0] || `Processing ${h}`,
        connections: [`n${idx - 1}`],
        fireDelay: 0.15 + i * 0.1,
      });
      idx++;

      // Sub-insights from bullets
      bullets.slice(1, 3).forEach((b) => {
        nodes.push({
          id: `n${idx}`,
          label: b.slice(0, 40),
          type: "insight",
          connections: [`n${idx - 1}`],
          fireDelay: 0.2 + i * 0.1,
        });
        idx++;
      });
    });
  } else {
    // Flat content — extract sentences as reasoning steps
    const sentences = content.replace(/\n/g, " ").match(/[^.!?]+[.!?]+/g) || [];
    nodes.push({ id: `n${idx}`, label: "Pattern Analysis", type: "process", detail: `Analyzing ${sentences.length} data points`, connections: [nodes[0]?.id].filter(Boolean), fireDelay: 0.1 });
    idx++;

    sentences.slice(0, 8).forEach((s, i) => {
      const clean = s.replace(/\*/g, "").trim().slice(0, 50);
      if (clean.length > 10) {
        nodes.push({
          id: `n${idx}`,
          label: clean,
          type: i < sentences.length / 2 ? "process" : "insight",
          connections: [`n${idx - 1}`],
          fireDelay: 0.15 + i * 0.08,
        });
        idx++;
      }
    });
  }

  // Phase 4: Synthesis + Output
  nodes.push({ id: `n${idx}`, label: "Reasoning Synthesis", type: "process", detail: "Cross-referencing all pathways", connections: nodes.filter(n => n.type === "insight").slice(-3).map(n => n.id), fireDelay: 0.85 });
  idx++;
  nodes.push({ id: `n${idx}`, label: "Response Generated", type: "output", detail: `${content.length} chars · ${lines.length} lines`, connections: [`n${idx - 1}`], fireDelay: 1.0 });

  return nodes;
}

/* ── Neural Timeline Visual Component ── */

const NeuralTimelineView = ({ content }: { content: string }) => {
  const neurons = useMemo(() => extractNeuralTimeline(content), [content]);

  const typeStyles: Record<string, { bg: string; border: string; dot: string; label: string }> = {
    input: { bg: "bg-accent/10", border: "border-accent/30", dot: "bg-accent", label: "INPUT" },
    process: { bg: "bg-card/50", border: "border-border/25", dot: "bg-muted-foreground/50", label: "PROCESS" },
    insight: { bg: "bg-primary/8", border: "border-primary/20", dot: "bg-primary/60", label: "INSIGHT" },
    output: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", dot: "bg-emerald-500", label: "OUTPUT" },
  };

  if (neurons.length === 0) {
    return <div className="text-center text-[11px] text-muted-foreground/40 py-6">No reasoning structure detected</div>;
  }

  return (
    <div className="relative">
      {/* Timeline spine */}
      <div className="absolute left-[18px] top-0 bottom-0 w-px bg-gradient-to-b from-accent/40 via-border/20 to-emerald-500/40" />

      <div className="space-y-1.5">
        {neurons.map((neuron, i) => {
          const style = typeStyles[neuron.type] || typeStyles.process;
          return (
            <div
              key={neuron.id}
              className="flex items-start gap-3 pl-1 animate-fade-in"
              style={{ animationDelay: `${neuron.fireDelay * 600}ms`, animationFillMode: "both" }}
            >
              {/* Neuron dot + pulse */}
              <div className="relative shrink-0 mt-2.5">
                <div className={`h-3 w-3 rounded-full ${style.dot} z-10 relative`} />
                <div
                  className={`absolute inset-0 h-3 w-3 rounded-full ${style.dot} animate-ping opacity-30`}
                  style={{ animationDelay: `${neuron.fireDelay * 800}ms`, animationDuration: "1.5s", animationIterationCount: "1" }}
                />
                {/* Connection lines to parent */}
                {neuron.connections.length > 1 && (
                  <div className="absolute -left-1 top-1.5 w-2 h-px bg-accent/20" />
                )}
              </div>

              {/* Neuron card */}
              <div className={`flex-1 rounded-xl border ${style.border} ${style.bg} px-3 py-2 transition-all hover:border-accent/30 hover:bg-card/60 group`}>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[8px] font-medium tracking-[0.2em] text-muted-foreground/40 uppercase">{style.label}</span>
                  <span className="text-[8px] text-muted-foreground/25">{Math.round(neuron.fireDelay * 100)}ms</span>
                </div>
                <p className="text-[11px] font-light text-foreground/90 leading-relaxed">{neuron.label}</p>
                {neuron.detail && (
                  <p className="text-[9px] font-extralight text-muted-foreground/50 mt-0.5 leading-relaxed">{neuron.detail}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary bar */}
      <div className="mt-4 pt-3 border-t border-border/10 flex flex-wrap items-center gap-3">
        {Object.entries(typeStyles).map(([key, style]) => {
          const count = neurons.filter(n => n.type === key).length;
          if (count === 0) return null;
          return (
            <div key={key} className="flex items-center gap-1.5">
              <div className={`h-2 w-2 rounded-full ${style.dot}`} />
              <span className="text-[9px] text-muted-foreground/40">{count} {style.label.toLowerCase()}{count !== 1 ? "s" : ""}</span>
            </div>
          );
        })}
        <span className="text-[9px] text-muted-foreground/30 ml-auto">{neurons.length} neurons fired</span>
      </div>
    </div>
  );
};

/* ── Component ── */

const DIAGRAM_TYPES: { id: DiagramType; label: string; desc: string; icon: typeof Brain }[] = [
  { id: "neural", label: "Neural Timeline", desc: "Brain thinking & reasoning pathway", icon: Zap },
  { id: "knowledge", label: "Knowledge Graph", desc: "Concepts & relationships", icon: Brain },
  { id: "concepts", label: "Concept Map", desc: "Ideas & connections", icon: Lightbulb },
  { id: "causal", label: "Causal Chain", desc: "Cause & effect links", icon: Link2 },
  { id: "taxonomy", label: "Taxonomy", desc: "Categorized knowledge", icon: Layers },
];

const MessageDiagramPanel = ({ open, content, onClose }: MessageDiagramPanelProps) => {
  const [diagramType, setDiagramType] = useState<DiagramType>("neural");
  const [copied, setCopied] = useState(false);

  const mermaidCode = useMemo(() => {
    switch (diagramType) {
      case "knowledge": return generateKnowledgeGraph(content);
      case "concepts": return generateConceptMap(content);
      case "causal": return generateCausalDiagram(content);
      case "taxonomy": return generateTaxonomy(content);
      default: return generateKnowledgeGraph(content);
    }
  }, [content, diagramType]);

  const handleCopy = () => {
    navigator.clipboard.writeText(mermaidCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!open) return null;

  // Parse mermaid into visual nodes + edges
  const parsedNodes: { id: string; label: string }[] = [];
  const parsedEdges: { from: string; to: string; label?: string }[] = [];

  for (const line of mermaidCode.split("\n")) {
    const roundNode = line.match(/^\s+(\w+)\(\("(.+?)"\)\)/);
    if (roundNode) { parsedNodes.push({ id: roundNode[1], label: roundNode[2] }); continue; }
    const squareNode = line.match(/^\s+(\w+)\["(.+?)"\]/);
    if (squareNode) parsedNodes.push({ id: squareNode[1], label: squareNode[2] });
    const labeledEdge = line.match(/^\s+(\w+)\s*(?:-->|==>|---)\|(.+?)\|\s*(\w+)/);
    if (labeledEdge) { parsedEdges.push({ from: labeledEdge[1], to: labeledEdge[3], label: labeledEdge[2] }); continue; }
    const simpleEdge = line.match(/^\s+(\w+)\s*(?:-->|==>|---)\s*(\w+)/);
    if (simpleEdge) parsedEdges.push({ from: simpleEdge[1], to: simpleEdge[2] });
  }

  // Identify root/center nodes (no incoming edges)
  const incomingSet = new Set(parsedEdges.map(e => e.to));
  const rootNodes = parsedNodes.filter(n => !incomingSet.has(n.id));
  const childNodes = parsedNodes.filter(n => incomingSet.has(n.id));

  return (
    <div className="mt-3 rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/15">
        <div className="flex items-center gap-2">
          <Brain className="h-3.5 w-3.5 text-accent" />
          <span className="text-[11px] font-light text-foreground tracking-wide">Knowledge Diagram</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={handleCopy} className="p-1 rounded-md text-muted-foreground/50 hover:text-foreground transition-colors" title="Copy Mermaid code">
            {copied ? <Check className="h-3 w-3 text-accent" /> : <Copy className="h-3 w-3" />}
          </button>
          <button onClick={onClose} className="p-1 rounded-md text-muted-foreground/50 hover:text-foreground transition-colors">
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Type selector */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-border/10 overflow-x-auto">
        {DIAGRAM_TYPES.map(dt => {
          const Icon = dt.icon;
          return (
            <button
              key={dt.id}
              onClick={() => setDiagramType(dt.id)}
              title={dt.desc}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-light transition-all whitespace-nowrap ${
                diagramType === dt.id
                  ? "bg-accent/15 text-accent border border-accent/20"
                  : "text-muted-foreground/50 hover:text-foreground hover:bg-foreground/5"
              }`}
            >
              <Icon className="h-3 w-3" />
              {dt.label}
            </button>
          );
        })}
      </div>

      {/* Visual Knowledge Diagram */}
      <div className="p-4 overflow-x-auto">
        {/* Root / center nodes */}
        {rootNodes.length > 0 && (
          <div className="flex flex-wrap gap-2 justify-center mb-3">
            {rootNodes.map(node => (
              <div
                key={node.id}
                className="rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-[11px] font-medium text-accent text-center max-w-[200px]"
              >
                {node.label}
              </div>
            ))}
          </div>
        )}

        {/* Connection indicators */}
        {rootNodes.length > 0 && childNodes.length > 0 && (
          <div className="flex justify-center mb-3">
            <div className="h-5 w-px bg-accent/30" />
          </div>
        )}

        {/* Child knowledge nodes */}
        {childNodes.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {childNodes.map(node => {
              const edge = parsedEdges.find(e => e.to === node.id);
              return (
                <div
                  key={node.id}
                  className="rounded-xl border border-border/20 bg-card/50 px-3 py-2.5 hover:border-accent/20 hover:bg-card/70 transition-all group"
                >
                  {edge?.label && (
                    <div className="text-[9px] text-accent/60 font-light mb-1 uppercase tracking-wider">
                      {edge.label}
                    </div>
                  )}
                  <div className="text-[11px] font-light text-foreground/90 leading-relaxed">
                    {node.label}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {parsedNodes.length === 0 && (
          <div className="text-center text-[11px] text-muted-foreground/40 py-6">
            No knowledge structure detected in this message
          </div>
        )}
      </div>

      {/* Mermaid source */}
      <details className="border-t border-border/10">
        <summary className="px-4 py-2 text-[9px] font-extralight text-muted-foreground/40 cursor-pointer hover:text-muted-foreground transition-colors">
          View Mermaid Source
        </summary>
        <pre className="px-4 pb-3 text-[10px] font-mono text-muted-foreground/60 overflow-x-auto whitespace-pre leading-relaxed">
          {mermaidCode}
        </pre>
      </details>
    </div>
  );
};

export default MessageDiagramPanel;
