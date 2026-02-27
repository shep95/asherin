import { useState, useMemo } from "react";
import { X, GitBranch, Copy, Check, Brain, Lightbulb, Link2, Layers } from "lucide-react";

interface MessageDiagramPanelProps {
  open: boolean;
  content: string;
  conversationHistory?: { role: string; content: string }[];
  onClose: () => void;
}

type DiagramType = "knowledge" | "concepts" | "causal" | "taxonomy";

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

/* ── Component ── */

const DIAGRAM_TYPES: { id: DiagramType; label: string; desc: string; icon: typeof Brain }[] = [
  { id: "knowledge", label: "Knowledge Graph", desc: "Concepts & relationships", icon: Brain },
  { id: "concepts", label: "Concept Map", desc: "Ideas & connections", icon: Lightbulb },
  { id: "causal", label: "Causal Chain", desc: "Cause & effect links", icon: Link2 },
  { id: "taxonomy", label: "Taxonomy", desc: "Categorized knowledge", icon: Layers },
];

const MessageDiagramPanel = ({ open, content, onClose }: MessageDiagramPanelProps) => {
  const [diagramType, setDiagramType] = useState<DiagramType>("knowledge");
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
