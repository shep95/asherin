import { LIFECYCLE_LABEL, type ArtifactLifecycleStatus } from "@/lib/software/types";

/** Status is read from the record, never inferred from what a screen is doing. */
const TONE: Record<ArtifactLifecycleStatus, string> = {
  draft: "border-border/40 text-muted-foreground",
  building: "border-primary/40 text-primary",
  running: "border-primary/40 text-primary",
  testing: "border-primary/30 text-foreground/80",
  failed: "border-destructive/50 text-destructive",
  repairing: "border-destructive/30 text-foreground/80",
  validated: "border-primary/50 text-primary",
  installed: "border-primary/50 text-primary",
  update_available: "border-primary/30 text-foreground/80",
  validating_update: "border-primary/30 text-foreground/80",
  disabled: "border-border/30 text-muted-foreground",
  archived: "border-border/20 text-muted-foreground/70",
  published: "border-primary/60 text-primary",
};

const ArtifactStatusBadge = ({ status }: { status: ArtifactLifecycleStatus }) => (
  <span
    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] tracking-wide ${TONE[status]}`}
  >
    {LIFECYCLE_LABEL[status]}
  </span>
);

export default ArtifactStatusBadge;
