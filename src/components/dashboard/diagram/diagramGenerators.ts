/* ── Knowledge extraction & diagram generation helpers ── */

export interface KnowledgeData {
  facts: string[];
  concepts: string[];
  relationships: { from: string; to: string; label: string }[];
  categories: Record<string, string[]>;
}

export function extractKnowledge(content: string): KnowledgeData {
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

  const termMatches = content.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g) || [];
  const uniqueTerms = [...new Set(termMatches)].slice(0, 8);
  uniqueTerms.forEach(t => { if (!concepts.includes(t)) concepts.push(t); });

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

export function sanitize(s: string): string {
  return s.replace(/["\[\](){}|<>#&;]/g, "").replace(/\n/g, " ").trim();
}

export function generateKnowledgeGraph(content: string): string {
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

  const cats = Object.entries(categories).slice(0, 6);
  for (const [cat, items] of cats) {
    const catNode = getNode(cat);
    if (!catNode) continue;
    for (const item of items.slice(0, 4)) {
      const itemNode = getNode(item);
      if (itemNode) edges.push(`  ${catNode} --> ${itemNode}`);
    }
  }

  for (const rel of relationships.slice(0, 8)) {
    const from = getNode(rel.from);
    const to = getNode(rel.to);
    if (from && to) edges.push(`  ${from} -->|${sanitize(rel.label)}| ${to}`);
  }

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

export function generateConceptMap(content: string): string {
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

export function generateCausalDiagram(content: string): string {
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

export function generateTaxonomy(content: string): string {
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

/* ── Custom diagram from user additions ── */
export function generateCustomDiagram(
  baseContent: string,
  additions: string[],
  diagramType: string
): string {
  const combined = baseContent + "\n" + additions.map(a => `- ${a}`).join("\n");
  switch (diagramType) {
    case "knowledge": return generateKnowledgeGraph(combined);
    case "concepts": return generateConceptMap(combined);
    case "causal": return generateCausalDiagram(combined);
    case "taxonomy": return generateTaxonomy(combined);
    default: return generateKnowledgeGraph(combined);
  }
}
