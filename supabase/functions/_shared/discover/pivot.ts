// pivot chain executor. bounded depth, bounded fanout, cycle-guarded.

export type IdentifierKind = "email" | "phone" | "username" | "name" | "domain" | "url";

export interface PivotNode {
  id: string;
  parentId: string | null;
  identifier: string;
  kind: IdentifierKind;
  depth: number;
}

export interface PivotOptions {
  maxDepth: number;
  maxNodes: number;
  maxFanoutPerNode: number;
}

export const DEFAULT_PIVOT: PivotOptions = { maxDepth: 3, maxNodes: 40, maxFanoutPerNode: 8 };

function keyOf(kind: IdentifierKind, id: string): string {
  return `${kind}:${id.trim().toLowerCase()}`;
}

/**
 * Expand a seed identifier through a resolver that returns new identifiers
 * discovered for a node. Returns a graph with cycle guard, depth cap and
 * total-node cap. The resolver must be pure with respect to input; it is
 * called once per unique node.
 */
export async function expandPivot(
  seed: { identifier: string; kind: IdentifierKind },
  resolver: (node: PivotNode) => Promise<Array<{ identifier: string; kind: IdentifierKind }>>,
  opts: Partial<PivotOptions> = {},
): Promise<PivotNode[]> {
  const cfg = { ...DEFAULT_PIVOT, ...opts };
  const root: PivotNode = { id: "n0", parentId: null, identifier: seed.identifier, kind: seed.kind, depth: 0 };
  const nodes: PivotNode[] = [root];
  const seen = new Set<string>([keyOf(seed.kind, seed.identifier)]);
  const queue: PivotNode[] = [root];
  let counter = 1;
  while (queue.length && nodes.length < cfg.maxNodes) {
    const node = queue.shift()!;
    if (node.depth >= cfg.maxDepth) continue;
    let discovered: Array<{ identifier: string; kind: IdentifierKind }> = [];
    try {
      discovered = await resolver(node);
    } catch {
      discovered = [];
    }
    let taken = 0;
    for (const d of discovered) {
      if (taken >= cfg.maxFanoutPerNode) break;
      if (nodes.length >= cfg.maxNodes) break;
      const id = d.identifier.trim();
      if (!id) continue;
      const key = keyOf(d.kind, id);
      if (seen.has(key)) continue;
      seen.add(key);
      const child: PivotNode = {
        id: `n${counter++}`,
        parentId: node.id,
        identifier: id,
        kind: d.kind,
        depth: node.depth + 1,
      };
      nodes.push(child);
      queue.push(child);
      taken++;
    }
  }
  return nodes;
}
