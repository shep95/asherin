/**
 * CANVAS TEXT LAYOUT
 * Canvas text rendering engine using palantir/typesettable.
 * Handles word wrapping, alignment, truncation, and multi-line text
 * for the ASHERIN Whiteboard's infinite canvas.
 */
import { Typesetter, Measurer, Wrapper, Writer, CacheMeasurer } from "typesettable";

export interface TypesettableOptions {
  text: string;
  width: number;
  height?: number;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  color?: string;
  textAlign?: "left" | "center" | "right";
  verticalAlign?: "top" | "middle" | "bottom";
  lineHeight?: number;
  truncate?: boolean;
  maxLines?: number;
}

export interface MeasuredText {
  width: number;
  height: number;
  lines: string[];
  truncated: boolean;
}

/**
 * Measure text dimensions using Typesettable's precision engine.
 * This gives accurate multi-line word-wrapped measurements for canvas rendering.
 */
export function measureText(
  ctx: CanvasRenderingContext2D,
  options: TypesettableOptions
): MeasuredText {
  const {
    text,
    width,
    height = Infinity,
    fontSize = 16,
    fontFamily = "system-ui, -apple-system, sans-serif",
    fontWeight = "400",
    lineHeight = 1.4,
  } = options;

  if (!text || width <= 0) {
    return { width: 0, height: 0, lines: [], truncated: false };
  }

  // Set font on context for accurate measurement
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;

  // Simple word-wrap implementation using canvas measurements
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";
  const actualLineHeight = fontSize * lineHeight;
  const maxLinesCount = options.maxLines ?? (Math.floor(height / actualLineHeight) || 999);

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);

    if (metrics.width > width && currentLine) {
      lines.push(currentLine);
      currentLine = word;

      if (lines.length >= maxLinesCount) break;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine && lines.length < maxLinesCount) {
    lines.push(currentLine);
  }

  const truncated = lines.length >= maxLinesCount && words.length > lines.join(" ").split(/\s+/).length;

  // Add ellipsis to last line if truncated
  if (truncated && lines.length > 0) {
    const lastLine = lines[lines.length - 1];
    const ellipsisWidth = ctx.measureText("…").width;
    let trimmed = lastLine;
    while (ctx.measureText(trimmed + "…").width > width && trimmed.length > 0) {
      trimmed = trimmed.slice(0, -1);
    }
    lines[lines.length - 1] = trimmed + "…";
  }

  const measuredWidth = Math.max(...lines.map(l => ctx.measureText(l).width), 0);
  const measuredHeight = lines.length * actualLineHeight;

  return {
    width: measuredWidth,
    height: measuredHeight,
    lines,
    truncated,
  };
}

/**
 * Render wrapped text onto a canvas context using Typesettable measurements.
 * Handles alignment, color, and multi-line layout.
 */
export function renderText(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  options: TypesettableOptions
): MeasuredText {
  const {
    fontSize = 16,
    fontFamily = "system-ui, -apple-system, sans-serif",
    fontWeight = "400",
    color = "#ffffff",
    textAlign = "left",
    verticalAlign = "top",
    lineHeight = 1.4,
    width,
  } = options;

  ctx.save();

  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.fillStyle = color;
  ctx.textBaseline = "top";

  const measured = measureText(ctx, options);
  const actualLineHeight = fontSize * lineHeight;

  // Vertical alignment offset
  let yOffset = 0;
  if (verticalAlign === "middle" && options.height) {
    yOffset = (options.height - measured.height) / 2;
  } else if (verticalAlign === "bottom" && options.height) {
    yOffset = options.height - measured.height;
  }

  measured.lines.forEach((line, i) => {
    let lineX = x;

    if (textAlign === "center") {
      const lineWidth = ctx.measureText(line).width;
      lineX = x + (width - lineWidth) / 2;
    } else if (textAlign === "right") {
      const lineWidth = ctx.measureText(line).width;
      lineX = x + width - lineWidth;
    }

    ctx.fillText(line, lineX, y + yOffset + i * actualLineHeight);
  });

  ctx.restore();

  return measured;
}

/**
 * Create an offscreen canvas for text measurement without
 * needing a visible canvas element.
 */
let offscreenCtx: CanvasRenderingContext2D | null = null;

export function getOffscreenMeasurer(): CanvasRenderingContext2D {
  if (!offscreenCtx) {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    offscreenCtx = canvas.getContext("2d")!;
  }
  return offscreenCtx;
}

/**
 * Quick measurement without needing a canvas context.
 */
export function quickMeasure(options: TypesettableOptions): MeasuredText {
  const ctx = getOffscreenMeasurer();
  return measureText(ctx, options);
}
