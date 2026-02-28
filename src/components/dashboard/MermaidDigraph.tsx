import { useMemo } from "react";

interface MermaidDigraphProps {
  code: string;
}

interface ParsedNode {
  id: string;
  label: string;
  isCenter: boolean;
}

interface ParsedEdge {
  from: string;
  to: string;
  label?: string;
}

function parseMermaid(code: string): { nodes: ParsedNode[]; edges: ParsedEdge[] } {
  const nodes: ParsedNode[] = [];
  const edges: ParsedEdge[] = [];
  const nodeMap = new Map<string, string>();
  const incomingSet = new Set<string>();

  for (const line of code.split("\n")) {
    const trimmed = line.trim();

    // Round node: N1(("Label"))
    const roundNode = trimmed.match(/^(\w+)\(\("(.+?)"\)\)/);
    if (roundNode) {
      nodeMap.set(roundNode[1], roundNode[2]);
      continue;
    }

    // Square node: N1["Label"]
    const squareNode = trimmed.match(/^(\w+)\["(.+?)"\]/);
    if (squareNode) {
      nodeMap.set(squareNode[1], squareNode[2]);
      continue;
    }

    // Labeled edge: N1 -->|"label"| N2  or  N1 -->|label| N2
    const labeledEdge = trimmed.match(/^(\w+)\s*(?:-->|==>|---)\|"?(.+?)"?\|\s*(\w+)/);
    if (labeledEdge) {
      edges.push({ from: labeledEdge[1], to: labeledEdge[3], label: labeledEdge[2] });
      incomingSet.add(labeledEdge[3]);
      continue;
    }

    // Simple edge: N1 --> N2
    const simpleEdge = trimmed.match(/^(\w+)\s*(?:-->|==>|---)\s*(\w+)/);
    if (simpleEdge) {
      edges.push({ from: simpleEdge[1], to: simpleEdge[2] });
      incomingSet.add(simpleEdge[2]);
      continue;
    }

    // Inline node definitions on edge lines (re-parse for any missed)
    const inlineRound = trimmed.match(/(\w+)\(\("(.+?)"\)\)/g);
    if (inlineRound) {
      for (const m of inlineRound) {
        const match = m.match(/(\w+)\(\("(.+?)"\)\)/);
        if (match) nodeMap.set(match[1], match[2]);
      }
    }
    const inlineSquare = trimmed.match(/(\w+)\["(.+?)"\]/g);
    if (inlineSquare) {
      for (const m of inlineSquare) {
        const match = m.match(/(\w+)\["(.+?)"\]/);
        if (match) nodeMap.set(match[1], match[2]);
      }
    }
  }

  // Also extract node IDs from edges that weren't declared
  for (const e of edges) {
    if (!nodeMap.has(e.from)) nodeMap.set(e.from, e.from);
    if (!nodeMap.has(e.to)) nodeMap.set(e.to, e.to);
  }

  for (const [id, label] of nodeMap) {
    nodes.push({ id, label, isCenter: !incomingSet.has(id) });
  }

  return { nodes, edges };
}

const MermaidDigraph = ({ code }: MermaidDigraphProps) => {
  const { nodes, edges } = useMemo(() => parseMermaid(code), [code]);

  const centerNodes = nodes.filter(n => n.isCenter);
  const childNodes = nodes.filter(n => !n.isCenter);

  if (nodes.length === 0) return null;

  return (
    <div className="my-3 rounded-2xl border border-accent/20 bg-accent/5 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2 border-b border-accent/10 flex items-center gap-2">
        <svg className="h-3.5 w-3.5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="5" r="3" />
          <line x1="12" y1="8" x2="12" y2="14" />
          <circle cx="6" cy="19" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="12" y1="14" x2="6" y2="16" />
          <line x1="12" y1="14" x2="18" y2="16" />
        </svg>
        <span className="text-[10px] font-light text-accent tracking-wider uppercase">Entity Relationship Graph</span>
      </div>

      <div className="p-4">
        {/* Center / root nodes */}
        {centerNodes.length > 0 && (
          <div className="flex flex-wrap gap-2 justify-center mb-3">
            {centerNodes.map(node => (
              <div
                key={node.id}
                className="rounded-xl border border-accent/30 bg-accent/15 px-4 py-2.5 text-[12px] font-medium text-accent text-center max-w-[220px] shadow-sm shadow-accent/10"
              >
                {node.label}
              </div>
            ))}
          </div>
        )}

        {/* Connector line */}
        {centerNodes.length > 0 && childNodes.length > 0 && (
          <div className="flex justify-center mb-3">
            <div className="h-6 w-px bg-accent/25" />
          </div>
        )}

        {/* Child entity nodes */}
        {childNodes.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {childNodes.map(node => {
              const edge = edges.find(e => e.to === node.id);
              return (
                <div
                  key={node.id}
                  className="rounded-xl border border-border/20 bg-card/40 px-3 py-2.5 hover:border-accent/20 hover:bg-card/60 transition-all"
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
      </div>
    </div>
  );
};

export default MermaidDigraph;
