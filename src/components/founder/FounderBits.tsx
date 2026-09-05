import { Clock } from "lucide-react";

/**
 * Tiny reading-time chip — commits the visitor to a defined investment.
 */
export const ReadingTime = ({ minutes }: { minutes: number }) => (
  <span className="inline-flex items-center gap-1.5 text-[10px] font-mono tracking-[0.28em] uppercase text-foreground/45">
    <Clock className="h-2.5 w-2.5" strokeWidth={1.5} />
    {minutes} min read
  </span>
);

/**
 * Decorative full-width section divider.
 * Variant 'plain' = single thin line.
 * Variant 'diamond' = thin line broken by a small centered glyph.
 */
export const SectionDivider = ({
  variant = "plain",
  glyph = "◆",
}: {
  variant?: "plain" | "diamond";
  glyph?: string;
}) => {
  if (variant === "plain") {
    return (
      <div aria-hidden className="mx-auto max-w-5xl px-6">
        <div className="h-px w-full bg-foreground/15" />
      </div>
    );
  }
  return (
    <div aria-hidden className="mx-auto max-w-5xl px-6 flex items-center gap-4">
      <div className="h-px flex-1 bg-foreground/15" />
      <span className="text-foreground/35 text-xs tracking-[0.4em]">{glyph}</span>
      <div className="h-px flex-1 bg-foreground/15" />
    </div>
  );
};
