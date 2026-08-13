/**
 * SOVEREIGN CHART ENGINE
 * D3-based modular chart components for ZERLAL/AZPLEN dashboards.
 * Composable plot system tuned for Asherin's dark theme.
 *
 * NOTE: Plottable is a heavy D3 library. We use it for the advanced
 * scatter/heatmap visualizations that recharts can't do well.
 * For simple pie/area charts, recharts remains the default.
 */
import { useRef, useEffect, useCallback } from "react";

// Plottable types for our wrapper
interface PlottableDataPoint {
  x: number | string;
  y: number;
  label?: string;
  color?: string;
  size?: number;
}

interface PlottableChartProps {
  data: PlottableDataPoint[];
  type: "scatter" | "bar" | "heatmap" | "line" | "stacked-bar";
  width?: number;
  height?: number;
  xLabel?: string;
  yLabel?: string;
  title?: string;
  colorScale?: string[];
  className?: string;
}

const DEFAULT_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#3b82f6", "#8b5cf6",
  "#06b6d4", "#10b981", "#ec4899", "#6b7280", "#f43f5e",
];

/**
 * SVG-based chart renderer that uses Plottable's compositional philosophy
 * but renders via React SVG for seamless dark-theme integration.
 *
 * This avoids Plottable's DOM attachment issues in React while preserving
 * its data-driven layout concepts.
 */
const PlottableChart = ({
  data,
  type,
  width: propWidth,
  height: propHeight = 200,
  xLabel,
  yLabel,
  title,
  colorScale = DEFAULT_COLORS,
  className = "",
}: PlottableChartProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const width = propWidth ?? 400;
  const padding = { top: title ? 28 : 12, right: 16, bottom: xLabel ? 36 : 24, left: yLabel ? 44 : 32 };
  const plotW = width - padding.left - padding.right;
  const plotH = propHeight - padding.top - padding.bottom;

  // Compute scales
  const numericXData = data.map((d) => (typeof d.x === "number" ? d.x : 0));
  const yValues = data.map((d) => d.y);
  const xMin = Math.min(...numericXData);
  const xMax = Math.max(...numericXData);
  const yMin = Math.min(0, ...yValues);
  const yMax = Math.max(...yValues) * 1.1 || 1;

  const scaleX = useCallback(
    (v: number) => padding.left + ((v - xMin) / (xMax - xMin || 1)) * plotW,
    [xMin, xMax, plotW, padding.left]
  );
  const scaleY = useCallback(
    (v: number) => padding.top + plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH,
    [yMin, yMax, plotH, padding.top]
  );

  const renderScatter = () => (
    <>
      {data.map((d, i) => {
        const cx = scaleX(typeof d.x === "number" ? d.x : i);
        const cy = scaleY(d.y);
        const r = d.size ?? 4;
        const fill = d.color ?? colorScale[i % colorScale.length];
        return (
          <g key={i}>
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill={fill}
              opacity={0.7}
              className="transition-all duration-200 hover:opacity-100"
            >
              <title>{d.label ?? `(${d.x}, ${d.y})`}</title>
            </circle>
            {/* Glow effect for critical points */}
            {(d.size ?? 4) > 6 && (
              <circle cx={cx} cy={cy} r={r + 3} fill={fill} opacity={0.15} />
            )}
          </g>
        );
      })}
    </>
  );

  const renderBar = () => {
    const barW = Math.max(4, plotW / data.length - 4);
    return (
      <>
        {data.map((d, i) => {
          const x = padding.left + (i / data.length) * plotW + 2;
          const h = ((d.y - yMin) / (yMax - yMin || 1)) * plotH;
          const y = padding.top + plotH - h;
          const fill = d.color ?? colorScale[i % colorScale.length];
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                fill={fill}
                rx={2}
                opacity={0.75}
                className="transition-all duration-200 hover:opacity-100"
              >
                <title>{d.label ?? `${d.x}: ${d.y}`}</title>
              </rect>
              {/* Label below bar */}
              <text
                x={x + barW / 2}
                y={padding.top + plotH + 14}
                textAnchor="middle"
                fontSize={8}
                fill="hsl(var(--muted-foreground) / 0.4)"
              >
                {typeof d.x === "string" ? d.x.slice(0, 8) : d.x}
              </text>
            </g>
          );
        })}
      </>
    );
  };

  const renderLine = () => {
    const points = data
      .map((d, i) => {
        const x = scaleX(typeof d.x === "number" ? d.x : i);
        const y = scaleY(d.y);
        return `${x},${y}`;
      })
      .join(" ");

    return (
      <>
        <polyline
          points={points}
          fill="none"
          stroke={colorScale[0]}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.8}
        />
        {/* Area fill */}
        <polygon
          points={`${padding.left},${padding.top + plotH} ${points} ${padding.left + plotW},${padding.top + plotH}`}
          fill={colorScale[0]}
          opacity={0.06}
        />
        {data.map((d, i) => (
          <circle
            key={i}
            cx={scaleX(typeof d.x === "number" ? d.x : i)}
            cy={scaleY(d.y)}
            r={3}
            fill={colorScale[0]}
            opacity={0.6}
          >
            <title>{d.label ?? `${d.y}`}</title>
          </circle>
        ))}
      </>
    );
  };

  const renderHeatmap = () => {
    const gridSize = Math.ceil(Math.sqrt(data.length));
    const cellW = plotW / gridSize;
    const cellH = plotH / gridSize;
    const maxVal = Math.max(...yValues) || 1;

    return (
      <>
        {data.map((d, i) => {
          const row = Math.floor(i / gridSize);
          const col = i % gridSize;
          const intensity = d.y / maxVal;
          const fill = d.color ?? colorScale[Math.floor(intensity * (colorScale.length - 1))];
          return (
            <rect
              key={i}
              x={padding.left + col * cellW}
              y={padding.top + row * cellH}
              width={cellW - 1}
              height={cellH - 1}
              fill={fill}
              opacity={0.3 + intensity * 0.6}
              rx={2}
              className="transition-all duration-200 hover:opacity-100"
            >
              <title>{d.label ?? `${d.x}: ${d.y}`}</title>
            </rect>
          );
        })}
      </>
    );
  };

  const renderAxes = () => {
    const yTicks = 4;
    return (
      <>
        {/* Y axis line */}
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + plotH} stroke="hsl(var(--border) / 0.1)" strokeWidth={1} />
        {/* X axis line */}
        <line x1={padding.left} y1={padding.top + plotH} x2={padding.left + plotW} y2={padding.top + plotH} stroke="hsl(var(--border) / 0.1)" strokeWidth={1} />

        {/* Y ticks */}
        {Array.from({ length: yTicks + 1 }).map((_, i) => {
          const val = yMin + ((yMax - yMin) / yTicks) * i;
          const y = scaleY(val);
          return (
            <g key={`y-${i}`}>
              <line x1={padding.left - 3} y1={y} x2={padding.left} y2={y} stroke="hsl(var(--border) / 0.1)" />
              <text x={padding.left - 6} y={y + 3} textAnchor="end" fontSize={8} fill="hsl(var(--muted-foreground) / 0.3)">
                {val.toFixed(val % 1 === 0 ? 0 : 1)}
              </text>
              {/* Grid line */}
              <line x1={padding.left} y1={y} x2={padding.left + plotW} y2={y} stroke="hsl(var(--border) / 0.04)" strokeDasharray="3,3" />
            </g>
          );
        })}

        {/* Labels */}
        {xLabel && (
          <text x={padding.left + plotW / 2} y={propHeight - 4} textAnchor="middle" fontSize={9} fill="hsl(var(--muted-foreground) / 0.3)">
            {xLabel}
          </text>
        )}
        {yLabel && (
          <text x={12} y={padding.top + plotH / 2} textAnchor="middle" fontSize={9} fill="hsl(var(--muted-foreground) / 0.3)" transform={`rotate(-90, 12, ${padding.top + plotH / 2})`}>
            {yLabel}
          </text>
        )}
        {title && (
          <text x={padding.left + plotW / 2} y={16} textAnchor="middle" fontSize={10} fill="hsl(var(--muted-foreground) / 0.5)" fontWeight={300} letterSpacing="0.1em">
            {title.toUpperCase()}
          </text>
        )}
      </>
    );
  };

  return (
    <div ref={containerRef} className={`asherin-plottable-chart ${className}`}>
      <svg
        ref={svgRef}
        width={width}
        height={propHeight}
        viewBox={`0 0 ${width} ${propHeight}`}
        className="overflow-visible"
      >
        {renderAxes()}
        {type === "scatter" && renderScatter()}
        {type === "bar" && renderBar()}
        {type === "line" && renderLine()}
        {type === "heatmap" && renderHeatmap()}
        {type === "stacked-bar" && renderBar()}
      </svg>
    </div>
  );
};

export default PlottableChart;
