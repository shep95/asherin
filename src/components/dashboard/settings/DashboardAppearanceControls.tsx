import { useEffect, useState } from "react";
import { Check, Image as ImageIcon, Paintbrush } from "lucide-react";
import {
  CURATED_SWATCHES,
  MAX_DIM,
  isLightBackground,
  isValidHex,
  normalizeHex,
  type DashboardAppearance,
  type DashboardBgMode,
} from "@/lib/dashboardAppearance";

interface Props {
  appearance: DashboardAppearance;
  /** Applies immediately (local + broadcast) and persists for signed-in operators. */
  onChange: (patch: Partial<DashboardAppearance>) => void;
  /** Label of the photo the operator returns to when they leave colour mode. */
  wallpaperLabel: string;
}

/**
 * Appearance controls for the workspace surface: photograph or flat colour.
 * Everything here is free — only the photo upload add-on is paid, and that
 * lives in the wallpaper block below.
 */
const DashboardAppearanceControls = ({ appearance, onChange, wallpaperLabel }: Props) => {
  const [hexDraft, setHexDraft] = useState(appearance.color);
  const [hexError, setHexError] = useState<string | null>(null);

  // The field mirrors the live colour unless the operator is mid-edit on an
  // invalid value — otherwise a swatch click would leave a stale hex on screen.
  useEffect(() => {
    setHexDraft(appearance.color);
    setHexError(null);
  }, [appearance.color]);

  const commitHex = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      setHexError("enter a hex value");
      return;
    }
    const hex = normalizeHex(trimmed);
    if (!hex) {
      setHexError("use #RGB or #RRGGBB");
      return;
    }
    setHexError(null);
    onChange({ mode: "color", color: hex });
  };

  const setMode = (mode: DashboardBgMode) => {
    if (mode === appearance.mode) return;
    onChange({ mode });
  };

  const light = isLightBackground(appearance.color);

  return (
    <div className="space-y-4">
      {/* Segmented control */}
      <div
        role="tablist"
        aria-label="Dashboard background mode"
        className="inline-flex w-full sm:w-auto rounded-xl border border-border/20 bg-background/40 p-1"
      >
        {([
          { mode: "wallpaper" as const, label: "Wallpaper", Icon: ImageIcon },
          { mode: "color" as const, label: "Color", Icon: Paintbrush },
        ]).map(({ mode, label, Icon }) => {
          const active = appearance.mode === mode;
          return (
            <button
              key={mode}
              role="tab"
              aria-selected={active}
              onClick={() => setMode(mode)}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-light transition-all ${
                active
                  ? "bg-foreground/10 text-foreground shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.15)]"
                  : "text-muted-foreground/60 hover:text-foreground/80"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          );
        })}
      </div>

      {appearance.mode === "color" ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,320px)]">
          {/* Swatches + hex */}
          <div className="space-y-4 order-2 lg:order-1">
            <div>
              <p className="text-[9px] text-muted-foreground/40 uppercase tracking-wider mb-2">Cinematic</p>
              <div className="flex flex-wrap gap-2.5">
                {CURATED_SWATCHES.map((sw) => {
                  const active = appearance.color === sw.hex.toUpperCase();
                  return (
                    <button
                      key={sw.key}
                      title={sw.label}
                      aria-label={sw.label}
                      aria-pressed={active}
                      onClick={() => onChange({ mode: "color", color: sw.hex })}
                      className={`h-9 w-9 rounded-full border transition-all flex items-center justify-center ${
                        active
                          ? "border-foreground/70 ring-2 ring-foreground/20 scale-105"
                          : "border-border/30 hover:border-foreground/40"
                      }`}
                      style={{ backgroundColor: sw.hex }}
                    >
                      {active && (
                        <Check
                          className="h-3.5 w-3.5"
                          style={{ color: isLightBackground(sw.hex) ? "#111" : "#fff" }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[9px] text-muted-foreground/40 uppercase tracking-wider">Custom</p>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="color"
                  aria-label="Pick a background color"
                  value={appearance.color}
                  onChange={(e) => onChange({ mode: "color", color: e.target.value })}
                  className="h-9 w-11 shrink-0 cursor-pointer rounded-lg border border-border/30 bg-transparent p-1"
                />
                <input
                  type="text"
                  inputMode="text"
                  spellCheck={false}
                  maxLength={7}
                  aria-label="Background hex"
                  value={hexDraft}
                  onChange={(e) => {
                    const v = e.target.value;
                    setHexDraft(v);
                    // Real time: only a complete 6-digit hex applies mid-typing.
                    // Applying a 3-digit prefix would rewrite the draft to its
                    // expanded form under the operator's cursor ("#121214"
                    // collapsing into "#112211"). Short form commits on blur.
                    if (v.length === 7 && isValidHex(v)) {
                      setHexError(null);
                      onChange({ mode: "color", color: v });
                    }
                  }}
                  onBlur={(e) => commitHex(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitHex((e.target as HTMLInputElement).value);
                  }}
                  placeholder="#0B0B0D"
                  className="min-w-0 flex-1 sm:w-32 sm:flex-none rounded-lg border border-border/30 bg-background/40 px-3 py-2 text-xs font-mono text-foreground outline-none focus:border-foreground/40"
                />
              </div>
              {hexError && <p className="text-[10px] text-destructive/80">{hexError}</p>}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[9px] text-muted-foreground/40 uppercase tracking-wider">Dim veil</p>
                <span className="text-[10px] font-mono text-muted-foreground/60">{appearance.dim}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={MAX_DIM}
                step={1}
                aria-label="Dim veil"
                value={appearance.dim}
                onChange={(e) => onChange({ dim: Number(e.target.value) })}
                className="w-full accent-foreground/70"
              />
              <p className="text-[10px] text-muted-foreground/40 leading-relaxed">
                {light
                  ? "a light background gets a readable scrim so asherin's type stays legible."
                  : "a thin veil over the color so chat cards keep an edge."}
              </p>
            </div>

            <button
              onClick={() => onChange({ mode: "wallpaper" })}
              className="text-[11px] font-light text-muted-foreground/70 hover:text-foreground underline underline-offset-4 transition-colors"
            >
              Use wallpaper again ({wallpaperLabel})
            </button>
          </div>

          {/* Live preview — the actual color, not a stock thumbnail */}
          <div className="order-1 lg:order-2">
            <p className="text-[9px] text-muted-foreground/40 uppercase tracking-wider mb-2">Preview</p>
            <div
              data-appearance-preview
              className="relative rounded-xl border border-border/20 overflow-hidden aspect-[16/10]"
              style={{ backgroundColor: appearance.color }}
            >
              <div
                className="absolute inset-0"
                style={{
                  backgroundColor: light ? "hsl(0 0% 0% / 0.62)" : "hsl(0 0% 0% / 1)",
                  opacity: light ? 1 : appearance.dim / 100,
                }}
              />
              <div className="absolute inset-0 p-3 flex gap-2">
                <div className="w-1/4 rounded-lg border border-border/15 bg-card/20 backdrop-blur-sm" />
                <div className="flex-1 flex flex-col justify-end gap-2">
                  <div className="rounded-lg border border-border/15 bg-card/20 backdrop-blur-sm p-2">
                    <div className="h-1.5 w-2/3 rounded-full bg-foreground/25" />
                    <div className="mt-1.5 h-1.5 w-1/3 rounded-full bg-foreground/15" />
                  </div>
                  <div className="rounded-full border border-border/15 bg-card/20 backdrop-blur-sm h-6" />
                </div>
              </div>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground/40 font-mono">{appearance.color}</p>
          </div>
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground/40 leading-relaxed">
          the workspace sits on a photograph. pick one below, or switch to Color for a flat surface.
        </p>
      )}
    </div>
  );
};

export default DashboardAppearanceControls;
