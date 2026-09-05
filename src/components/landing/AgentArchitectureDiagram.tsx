import { LucideIcon } from "lucide-react";

interface ArchNode {
  id: string;
  label: string;
  sublabel?: string;
  type: "input" | "agent" | "engine" | "output" | "layer";
  icon?: LucideIcon;
  accent?: string;
}

interface ArchLayer {
  label: string;
  nodes: ArchNode[];
}

interface AgentArchitectureDiagramProps {
  title?: string;
  subtitle?: string;
  layers: ArchLayer[];
  features?: string[];
}

// Connector arrow between layers
const Arrow = ({ accent = "border-border/30" }: { accent?: string }) => (
  <div className="flex justify-center items-center py-1">
    <div className={`flex flex-col items-center gap-0`}>
      <div className="w-px h-4 bg-border/30" />
      <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="text-muted-foreground/30">
        <path d="M5 6L0 0h10L5 6z" fill="currentColor" />
      </svg>
    </div>
  </div>
);

const NodeCard = ({ node }: { node: ArchNode }) => {
  const Icon = node.icon;
  const accentClass = node.accent ?? "border-border/20";

  const baseClass =
    node.type === "input"
      ? "bg-card/30 border-border/20"
      : node.type === "engine"
      ? "bg-card/40 border-accent/20"
      : node.type === "output"
      ? "bg-card/30 border-emerald-500/20"
      : "bg-card/20 border-border/15";

  return (
    <div
      className={`rounded-xl border ${baseClass} backdrop-blur-sm px-3 py-2.5 flex items-start gap-2.5 flex-1 min-w-0 transition-all hover:border-border/40 hover:bg-card/40`}
    >
      {Icon && (
        <div className="mt-0.5 shrink-0 rounded-md bg-card/60 border border-border/20 p-1.5">
          <Icon className={`h-3 w-3 ${node.accent ? node.accent : "text-muted-foreground/60"}`} />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-[10px] font-light tracking-wider text-foreground truncate">{node.label}</p>
        {node.sublabel && (
          <p className="text-[9px] font-extralight text-muted-foreground/50 leading-tight mt-0.5 line-clamp-2">
            {node.sublabel}
          </p>
        )}
      </div>
    </div>
  );
};

const AgentArchitectureDiagram = ({
  title = "Agent Architecture",
  subtitle,
  layers,
  features,
}: AgentArchitectureDiagramProps) => {
  return (
    <section className="relative z-10 px-6 py-24">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/20 bg-card/30 backdrop-blur-md px-3 py-1 mb-4">
            <div className="h-1.5 w-1.5 rounded-full bg-accent/60" />
            <span className="text-[9px] font-light tracking-[0.25em] text-muted-foreground/60 uppercase">
              Intelligence Architecture
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-3">
            {title}
          </h2>
          {subtitle && (
            <p className="text-sm font-extralight text-muted-foreground max-w-2xl">
              {subtitle}
            </p>
          )}
        </div>

        {/* Diagram */}
        <div className="rounded-2xl border border-border/15 bg-card/10 backdrop-blur-md p-6 sm:p-8">
          {/* Classification badge */}
          <div className="flex justify-between items-center mb-6">
            <span className="text-[9px] font-light tracking-[0.3em] text-muted-foreground/30 uppercase">
              ASHERIN · PROPRIETARY ARCHITECTURE
            </span>
            <span className="text-[9px] font-light tracking-[0.2em] text-muted-foreground/30 uppercase">
              CLASSIFIED
            </span>
          </div>

          <div className="space-y-2">
            {layers.map((layer, li) => (
              <div key={li}>
                {/* Layer label */}
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-[9px] font-light tracking-[0.2em] text-muted-foreground/40 uppercase whitespace-nowrap">
                    {String(li + 1).padStart(2, "0")} · {layer.label}
                  </span>
                  <div className="flex-1 h-px bg-border/10" />
                </div>

                {/* Nodes row */}
                <div className="flex flex-wrap gap-2">
                  {layer.nodes.map((node) => (
                    <NodeCard key={node.id} node={node} />
                  ))}
                </div>

                {/* Arrow connector (not on last layer) */}
                {li < layers.length - 1 && <Arrow />}
              </div>
            ))}
          </div>

          {/* Bottom bar */}
          <div className="mt-6 pt-4 border-t border-border/10 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-emerald-500/50" />
              <span className="text-[9px] text-muted-foreground/40">All systems operational</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-accent/50" />
              <span className="text-[9px] text-muted-foreground/40">End-to-end encrypted</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-neutral-400/50" />
              <span className="text-[9px] text-muted-foreground/40">Zero data retention</span>
            </div>
          </div>
        </div>

        {/* Feature tags (optional) */}
        {features && features.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {features.map((f) => (
              <span
                key={f}
                className="text-[9px] font-light tracking-wider text-muted-foreground/40 border border-border/15 rounded-full px-3 py-1 uppercase"
              >
                {f}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default AgentArchitectureDiagram;
