import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, Save, FileDown } from "lucide-react";
import { useAzplenSession } from "./AzplenSessionContext";

interface CanvasNode {
  id: string;
  label: string;
  type: string;
  x: number;
  y: number;
  note?: string;
}
interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  label: string;
}

const TYPE_COLORS: Record<string, string> = {
  person: "border-sky-300/40 bg-sky-300/[0.06] text-sky-100",
  org: "border-amber-300/40 bg-amber-300/[0.06] text-amber-100",
  location: "border-emerald-300/40 bg-emerald-300/[0.06] text-emerald-100",
  money: "border-lime-300/40 bg-lime-300/[0.06] text-lime-100",
  event: "border-violet-300/40 bg-violet-300/[0.06] text-violet-100",
  other: "border-foreground/20 bg-foreground/[0.04] text-foreground",
};

const storageKey = (sid: string) => `azplen:canvas:${sid}`;

/**
 * Canvas — investigation workspace. The operator drags nodes around to build
 * a visual argument structure (entities + relationships + annotations).
 * Persisted per-session in localStorage; survives reloads.
 */
const CanvasPanel = () => {
  const { activeSession } = useAzplenSession();
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [edges, setEdges] = useState<CanvasEdge[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [edgeFrom, setEdgeFrom] = useState<string | null>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);

  // Load persisted canvas
  useEffect(() => {
    if (!activeSession) return;
    try {
      const raw = localStorage.getItem(storageKey(activeSession.id));
      if (raw) {
        const parsed = JSON.parse(raw);
        setNodes(parsed.nodes ?? []);
        setEdges(parsed.edges ?? []);
      } else {
        setNodes([]);
        setEdges([]);
      }
    } catch {
      setNodes([]);
      setEdges([]);
    }
  }, [activeSession?.id]);

  // Persist
  useEffect(() => {
    if (!activeSession) return;
    const h = window.setTimeout(() => {
      try {
        localStorage.setItem(storageKey(activeSession.id), JSON.stringify({ nodes, edges }));
      } catch {}
    }, 300);
    return () => window.clearTimeout(h);
  }, [nodes, edges, activeSession?.id]);

  const addNode = useCallback((type: string) => {
    const label = window.prompt(`New ${type} label`)?.trim();
    if (!label) return;
    const rect = surfaceRef.current?.getBoundingClientRect();
    const x = (rect?.width ?? 800) / 2 - 60 + Math.random() * 80 - 40;
    const y = (rect?.height ?? 500) / 2 - 30 + Math.random() * 80 - 40;
    setNodes((prev) => [...prev, { id: crypto.randomUUID(), label, type, x, y }]);
  }, []);

  const onPointerDownNode = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    if (edgeFrom && edgeFrom !== id) {
      const label = window.prompt("Relationship label", "linked to")?.trim() || "linked to";
      setEdges((prev) => [...prev, { id: crypto.randomUUID(), source: edgeFrom, target: id, label }]);
      setEdgeFrom(null);
      return;
    }
    setSelectedId(id);
    const node = nodes.find((n) => n.id === id);
    if (!node) return;
    const rect = surfaceRef.current!.getBoundingClientRect();
    dragRef.current = { id, offsetX: e.clientX - rect.left - node.x, offsetY: e.clientY - rect.top - node.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const rect = surfaceRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left - dragRef.current.offsetX;
    const y = e.clientY - rect.top - dragRef.current.offsetY;
    setNodes((prev) => prev.map((n) => (n.id === dragRef.current!.id ? { ...n, x, y } : n)));
  };
  const onPointerUp = () => { dragRef.current = null; };

  const deleteSelected = () => {
    if (!selectedId) return;
    setNodes((prev) => prev.filter((n) => n.id !== selectedId));
    setEdges((prev) => prev.filter((e) => e.source !== selectedId && e.target !== selectedId));
    setSelectedId(null);
  };

  const annotateSelected = () => {
    if (!selectedId) return;
    const cur = nodes.find((n) => n.id === selectedId);
    const note = window.prompt("Annotation / evidence note", cur?.note ?? "")?.trim();
    if (note === undefined) return;
    setNodes((prev) => prev.map((n) => (n.id === selectedId ? { ...n, note } : n)));
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ nodes, edges }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `canvas-${activeSession?.name ?? "session"}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const edgePaths = useMemo(() => {
    return edges.map((e) => {
      const s = nodes.find((n) => n.id === e.source);
      const t = nodes.find((n) => n.id === e.target);
      if (!s || !t) return null;
      const sx = s.x + 80, sy = s.y + 24, tx = t.x + 80, ty = t.y + 24;
      const mx = (sx + tx) / 2, my = (sy + ty) / 2;
      return { id: e.id, d: `M ${sx} ${sy} Q ${mx} ${my - 30} ${tx} ${ty}`, label: e.label, mx, my };
    }).filter(Boolean) as { id: string; d: string; label: string; mx: number; my: number }[];
  }, [edges, nodes]);

  if (!activeSession) {
    return <div className="flex h-full items-center justify-center text-muted-foreground text-sm">Select a session to use the Canvas.</div>;
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex-shrink-0 flex flex-wrap items-center gap-2 border-b border-foreground/10 bg-foreground/[0.02] px-4 py-3">
        <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/60 mr-2">Add</span>
        {Object.keys(TYPE_COLORS).map((t) => (
          <button key={t} onClick={() => addNode(t)} className={`rounded-md border px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] hover:scale-[1.03] transition ${TYPE_COLORS[t]}`}>
            <Plus className="inline h-3 w-3 mr-1" />{t}
          </button>
        ))}
        <div className="mx-2 h-4 w-px bg-foreground/10" />
        <button
          onClick={() => setEdgeFrom(selectedId)}
          disabled={!selectedId}
          className="text-[10px] uppercase tracking-[0.2em] border border-foreground/10 rounded-md px-2.5 py-1 text-muted-foreground hover:text-foreground disabled:opacity-40"
        >
          {edgeFrom ? "Click target node…" : "Connect →"}
        </button>
        <button onClick={annotateSelected} disabled={!selectedId} className="text-[10px] uppercase tracking-[0.2em] border border-foreground/10 rounded-md px-2.5 py-1 text-muted-foreground hover:text-foreground disabled:opacity-40">
          Annotate
        </button>
        <button onClick={deleteSelected} disabled={!selectedId} className="text-[10px] uppercase tracking-[0.2em] border border-rose-300/20 text-rose-200/80 rounded-md px-2.5 py-1 hover:bg-rose-300/[0.06] disabled:opacity-40">
          <Trash2 className="inline h-3 w-3 mr-1" />Delete
        </button>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={exportJson} className="text-[10px] uppercase tracking-[0.2em] border border-foreground/10 rounded-md px-2.5 py-1 text-muted-foreground hover:text-foreground">
            <FileDown className="inline h-3 w-3 mr-1" />Export
          </button>
          <span className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-300/80">
            <Save className="h-3 w-3" /> AUTOSAVED
          </span>
        </div>
      </div>

      {/* Surface */}
      <div
        ref={surfaceRef}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onClick={() => { setSelectedId(null); setEdgeFrom(null); }}
        className="relative flex-1 overflow-hidden bg-[radial-gradient(circle_at_25%_25%,hsl(var(--foreground)/0.03)_1px,transparent_1px)] [background-size:24px_24px]"
      >
        {/* Edges */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {edgePaths.map((p) => (
            <g key={p.id}>
              <path d={p.d} stroke="hsl(var(--foreground) / 0.35)" strokeWidth={1} fill="none" />
              <text x={p.mx} y={p.my - 6} fontSize={10} fill="hsl(var(--muted-foreground))" textAnchor="middle">{p.label}</text>
            </g>
          ))}
        </svg>

        {/* Nodes */}
        {nodes.map((n) => (
          <div
            key={n.id}
            onPointerDown={(e) => onPointerDownNode(e, n.id)}
            onClick={(e) => e.stopPropagation()}
            style={{ left: n.x, top: n.y }}
            className={`absolute select-none rounded-lg border px-3 py-2 backdrop-blur-md cursor-grab active:cursor-grabbing transition ${
              selectedId === n.id ? "ring-2 ring-amber-300/60" : ""
            } ${TYPE_COLORS[n.type] ?? TYPE_COLORS.other}`}
          >
            <div className="text-[8px] font-mono uppercase tracking-[0.22em] opacity-60">{n.type}</div>
            <div className="text-xs font-extralight max-w-[160px] truncate">{n.label}</div>
            {n.note && <div className="text-[9px] mt-1 opacity-70 italic max-w-[160px] line-clamp-2">▸ {n.note}</div>}
          </div>
        ))}

        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center text-muted-foreground/50">
              <div className="text-xs font-mono uppercase tracking-[0.25em] mb-2">Empty Workspace</div>
              <div className="text-sm font-extralight">Add nodes from the toolbar to build your argument structure</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CanvasPanel;
