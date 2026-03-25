import { useMemo } from "react";

interface MermaidDigraphProps {
  code: string;
}

interface ParsedNode {
  id: string;
  label: string;
  isCenter: boolean;
  subgraph?: string;
}

interface ParsedEdge {
  from: string;
  to: string;
  label?: string;
}

function parseMermaid(code: string): { nodes: ParsedNode[]; edges: ParsedEdge[]; subgraphs: string[] } {
  const nodes: ParsedNode[] = [];
  const edges: ParsedEdge[] = [];
  const nodeMap = new Map<string, string>();
  const incomingSet = new Set<string>();
  const subgraphMap = new Map<string, string>();
  const subgraphOrder: string[] = [];

  let currentSubgraph: string | null = null;

  for (const line of code.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || /^graph\s+(TD|LR|TB|BT|RL)\s*$/.test(trimmed)) continue;
    // Skip mermaid styling directives
    if (/^(style\s+\w+|linkStyle\s+\d+|classDef\s+|class\s+)/.test(trimmed)) continue;

    const sgMatch = trimmed.match(/^subgraph\s+(.+)/);
    if (sgMatch) {
      currentSubgraph = sgMatch[1].trim().replace(/^["']|["']$/g, '');
      if (!subgraphOrder.includes(currentSubgraph)) subgraphOrder.push(currentSubgraph);
      continue;
    }
    if (/^\s*end\s*$/.test(trimmed)) { currentSubgraph = null; continue; }

    const markSg = (id: string) => { if (currentSubgraph && !subgraphMap.has(id)) subgraphMap.set(id, currentSubgraph); };

    // Edge with quoted label: A -- "label" --> B
    const quotedEdge = trimmed.match(/^(\w+)\s*--\s*"(.+?)"\s*-->\s*(\w+)/);
    if (quotedEdge) {
      edges.push({ from: quotedEdge[1], to: quotedEdge[3], label: quotedEdge[2] });
      incomingSet.add(quotedEdge[3]);
      markSg(quotedEdge[1]); markSg(quotedEdge[3]);
      // Extract inline nodes from this line
      extractInlineNodes(trimmed, nodeMap);
      continue;
    }

    // Labeled edge: A -->|label| B
    const labeledEdge = trimmed.match(/^(\w+)\s*(?:-->|==>|---?)\|"?(.+?)"?\|\s*(\w+)/);
    if (labeledEdge) {
      edges.push({ from: labeledEdge[1], to: labeledEdge[3], label: labeledEdge[2] });
      incomingSet.add(labeledEdge[3]);
      markSg(labeledEdge[1]); markSg(labeledEdge[3]);
      extractInlineNodes(trimmed, nodeMap);
      continue;
    }

    // Simple edge: A --> B
    const simpleEdge = trimmed.match(/^(\w+)\s*(?:-->|==>|---?)\s*(\w+)/);
    if (simpleEdge) {
      edges.push({ from: simpleEdge[1], to: simpleEdge[2] });
      incomingSet.add(simpleEdge[2]);
      markSg(simpleEdge[1]); markSg(simpleEdge[2]);
      extractInlineNodes(trimmed, nodeMap);
      continue;
    }

    // Standalone node declarations
    const roundNode = trimmed.match(/^(\w+)\(?\("(.+?)"\)?\)?$/);
    if (roundNode) { nodeMap.set(roundNode[1], roundNode[2]); markSg(roundNode[1]); continue; }
    const squareNode = trimmed.match(/^(\w+)\["(.+?)"\]$/);
    if (squareNode) { nodeMap.set(squareNode[1], squareNode[2]); markSg(squareNode[1]); continue; }
  }

  for (const e of edges) {
    if (!nodeMap.has(e.from)) nodeMap.set(e.from, e.from);
    if (!nodeMap.has(e.to)) nodeMap.set(e.to, e.to);
  }

  for (const [id, label] of nodeMap) {
    nodes.push({ id, label, isCenter: !incomingSet.has(id), subgraph: subgraphMap.get(id) });
  }

  return { nodes, edges, subgraphs: subgraphOrder };
}

function extractInlineNodes(line: string, nodeMap: Map<string, string>) {
  // Paren nodes: WO_Aroda(Wendy A Owens)
  const parenNodes = line.match(/(\w+)\(([^)"]+)\)/g);
  if (parenNodes) for (const m of parenNodes) {
    const match = m.match(/(\w+)\(([^)"]+)\)/);
    if (match && !match[2].startsWith('"')) nodeMap.set(match[1], match[2]);
  }
  // Bracket nodes: LOC_Aroda[Aroda, VA]
  const bracketNodes = line.match(/(\w+)\[([^\]]+)\]/g);
  if (bracketNodes) for (const m of bracketNodes) {
    const match = m.match(/(\w+)\[([^\]]+)\]/);
    if (match) nodeMap.set(match[1], match[2]);
  }
  // Brace nodes: DOB1{12/01/1960}
  const braceNodes = line.match(/(\w+)\{([^}]+)\}/g);
  if (braceNodes) for (const m of braceNodes) {
    const match = m.match(/(\w+)\{([^}]+)\}/);
    if (match) nodeMap.set(match[1], match[2]);
  }
  // Double-paren: N1(("Label"))
  const dblParen = line.match(/(\w+)\(\("(.+?)"\)\)/g);
  if (dblParen) for (const m of dblParen) {
    const match = m.match(/(\w+)\(\("(.+?)"\)\)/);
    if (match) nodeMap.set(match[1], match[2]);
  }
}

const MermaidDigraph = ({ code }: MermaidDigraphProps) => {
  const { nodes, edges, subgraphs } = useMemo(() => parseMermaid(code), [code]);

  if (nodes.length === 0) return null;

  const hasSubgraphs = subgraphs.length > 0;

  // Group nodes by subgraph
  const groupedNodes = hasSubgraphs
    ? subgraphs.map(sg => ({
        label: sg,
        nodes: nodes.filter(n => n.subgraph === sg),
      }))
    : [];
  const ungroupedNodes = nodes.filter(n => !n.subgraph);

  return (
    <div className="my-3 rounded-2xl border border-border/20 bg-card/30 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2 border-b border-border/10 flex items-center gap-2">
        <svg className="h-3.5 w-3.5 text-foreground/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="5" r="3" />
          <line x1="12" y1="8" x2="12" y2="14" />
          <circle cx="6" cy="19" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="12" y1="14" x2="6" y2="16" />
          <line x1="12" y1="14" x2="18" y2="16" />
        </svg>
        <span className="text-[10px] font-light text-foreground/50 tracking-wider uppercase">Entity Relationship Graph</span>
      </div>

      <div className="p-4 space-y-4">
        {/* Subgraph groups */}
        {groupedNodes.map(group => (
          <div key={group.label} className="rounded-xl border border-border/15 bg-foreground/[0.02] p-3">
            <div className="text-[10px] font-medium text-foreground/60 uppercase tracking-wider mb-2.5 px-1">
              {group.label}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {group.nodes.map(node => {
                const edge = edges.find(e => e.to === node.id || e.from === node.id);
                return (
                  <div key={node.id} className="rounded-xl border border-border/15 bg-card/40 px-3 py-2.5 hover:border-foreground/15 hover:bg-card/60 transition-all">
                    {edge?.label && (
                      <div className="text-[9px] text-foreground/40 font-light mb-1 uppercase tracking-wider">
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
          </div>
        ))}

        {/* Ungrouped center nodes */}
        {ungroupedNodes.filter(n => n.isCenter).length > 0 && (
          <div className="flex flex-wrap gap-2 justify-center">
            {ungroupedNodes.filter(n => n.isCenter).map(node => (
              <div key={node.id} className="rounded-xl border border-foreground/20 bg-foreground/[0.06] px-4 py-2.5 text-[12px] font-medium text-foreground/90 text-center max-w-[220px] shadow-sm">
                {node.label}
              </div>
            ))}
          </div>
        )}

        {/* Connector */}
        {ungroupedNodes.filter(n => n.isCenter).length > 0 && ungroupedNodes.filter(n => !n.isCenter).length > 0 && (
          <div className="flex justify-center">
            <div className="h-6 w-px bg-foreground/15" />
          </div>
        )}

        {/* Ungrouped child nodes */}
        {ungroupedNodes.filter(n => !n.isCenter).length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {ungroupedNodes.filter(n => !n.isCenter).map(node => {
              const edge = edges.find(e => e.to === node.id);
              return (
                <div key={node.id} className="rounded-xl border border-border/15 bg-card/40 px-3 py-2.5 hover:border-foreground/15 hover:bg-card/60 transition-all">
                  {edge?.label && (
                    <div className="text-[9px] text-foreground/40 font-light mb-1 uppercase tracking-wider">
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
