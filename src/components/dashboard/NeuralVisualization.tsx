import { useEffect, useRef } from "react";

interface NeuralVisualizationProps {
  isThinking: boolean;
  className?: string;
}

/* ── Brain region definition ── */
interface BrainRegion {
  id: string;
  label: string;
  shortLabel: string;
  // Position as fraction of canvas (0-1)
  cx: number;
  cy: number;
  rx: number; // ellipse radii as fraction
  ry: number;
  role: string; // what this region does for the AI
  activation: number;
  targetActivation: number;
  phase: number; // firing phase offset
}

interface Synapse {
  from: string;
  to: string;
  strength: number;
}

/* ── Regions modeled after the human brain (lateral view) ── */
function createBrainRegions(): BrainRegion[] {
  return [
    // Frontal / Prefrontal — reasoning, planning
    { id: "prefrontal", label: "Prefrontal Cortex", shortLabel: "PREFRONTAL", cx: 0.18, cy: 0.28, rx: 0.10, ry: 0.12, role: "Reasoning & Planning", activation: 0, targetActivation: 0, phase: 0 },
    // Broca's Area — language production
    { id: "broca", label: "Broca's Area", shortLabel: "BROCA", cx: 0.22, cy: 0.52, rx: 0.06, ry: 0.07, role: "Language Production", activation: 0, targetActivation: 0, phase: 0.4 },
    // Motor Cortex
    { id: "motor", label: "Motor Cortex", shortLabel: "MOTOR", cx: 0.35, cy: 0.15, rx: 0.07, ry: 0.06, role: "Action Output", activation: 0, targetActivation: 0, phase: 0.2 },
    // Parietal — integration, attention
    { id: "parietal", label: "Parietal Lobe", shortLabel: "PARIETAL", cx: 0.50, cy: 0.18, rx: 0.10, ry: 0.10, role: "Attention & Integration", activation: 0, targetActivation: 0, phase: 0.6 },
    // Wernicke's — language comprehension
    { id: "wernicke", label: "Wernicke's Area", shortLabel: "WERNICKE", cx: 0.55, cy: 0.42, rx: 0.07, ry: 0.07, role: "Language Comprehension", activation: 0, targetActivation: 0, phase: 0.3 },
    // Temporal — memory, auditory
    { id: "temporal", label: "Temporal Lobe", shortLabel: "TEMPORAL", cx: 0.40, cy: 0.62, rx: 0.10, ry: 0.09, role: "Memory & Pattern Recognition", activation: 0, targetActivation: 0, phase: 0.5 },
    // Occipital — visual processing
    { id: "occipital", label: "Occipital Lobe", shortLabel: "OCCIPITAL", cx: 0.72, cy: 0.25, rx: 0.09, ry: 0.10, role: "Visual Processing", activation: 0, targetActivation: 0, phase: 0.8 },
    // Cerebellum — coordination, fine-tuning
    { id: "cerebellum", label: "Cerebellum", shortLabel: "CEREBELLUM", cx: 0.78, cy: 0.58, rx: 0.09, ry: 0.11, role: "Calibration & Fine-Tuning", activation: 0, targetActivation: 0, phase: 0.7 },
    // Hippocampus — deep memory
    { id: "hippocampus", label: "Hippocampus", shortLabel: "HIPPOCAMPUS", cx: 0.48, cy: 0.50, rx: 0.06, ry: 0.05, role: "Context Memory", activation: 0, targetActivation: 0, phase: 0.1 },
    // Thalamus — relay center
    { id: "thalamus", label: "Thalamus", shortLabel: "THALAMUS", cx: 0.44, cy: 0.38, rx: 0.05, ry: 0.05, role: "Signal Relay", activation: 0, targetActivation: 0, phase: 0.15 },
    // Amygdala — emotional weighting / salience
    { id: "amygdala", label: "Amygdala", shortLabel: "AMYGDALA", cx: 0.35, cy: 0.52, rx: 0.04, ry: 0.04, role: "Salience & Priority", activation: 0, targetActivation: 0, phase: 0.9 },
  ];
}

/* ── Neural pathways between regions ── */
const SYNAPSES: { from: string; to: string }[] = [
  // Input path: Wernicke → Thalamus → Prefrontal
  { from: "wernicke", to: "thalamus" },
  { from: "thalamus", to: "prefrontal" },
  // Reasoning loop: Prefrontal ↔ Parietal
  { from: "prefrontal", to: "parietal" },
  { from: "parietal", to: "prefrontal" },
  // Memory access: Prefrontal → Hippocampus → Temporal
  { from: "prefrontal", to: "hippocampus" },
  { from: "hippocampus", to: "temporal" },
  { from: "temporal", to: "hippocampus" },
  // Language output: Prefrontal → Broca
  { from: "prefrontal", to: "broca" },
  // Visual: Occipital → Parietal
  { from: "occipital", to: "parietal" },
  // Emotional weighting
  { from: "amygdala", to: "prefrontal" },
  { from: "thalamus", to: "amygdala" },
  // Calibration
  { from: "cerebellum", to: "motor" },
  { from: "parietal", to: "cerebellum" },
  // Cross-links
  { from: "wernicke", to: "broca" },
  { from: "temporal", to: "wernicke" },
  { from: "motor", to: "broca" },
  { from: "thalamus", to: "occipital" },
];

/* ── Thinking sequence: which regions fire in order ── */
const THINKING_SEQUENCE = [
  ["wernicke", "thalamus"],             // Step 1: Comprehend input
  ["prefrontal", "parietal", "amygdala"], // Step 2: Reason & prioritize
  ["hippocampus", "temporal"],           // Step 3: Memory retrieval
  ["prefrontal", "occipital"],           // Step 4: Deep analysis
  ["broca", "motor", "cerebellum"],      // Step 5: Generate output
];

const NeuralVisualization = ({ isThinking, className = "" }: NeuralVisualizationProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const regionsRef = useRef<BrainRegion[]>(createBrainRegions());
  const animFrameRef = useRef<number>(0);
  const tickRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const regions = regionsRef.current;

    const draw = () => {
      tickRef.current++;
      const tick = tickRef.current;
      ctx.clearRect(0, 0, w, h);

      // ── Draw brain outline (stylized lateral silhouette) ──
      ctx.beginPath();
      ctx.moveTo(w * 0.12, h * 0.45);
      ctx.bezierCurveTo(w * 0.08, h * 0.20, w * 0.20, h * 0.03, w * 0.40, h * 0.05);
      ctx.bezierCurveTo(w * 0.55, h * 0.02, w * 0.70, h * 0.06, w * 0.80, h * 0.15);
      ctx.bezierCurveTo(w * 0.90, h * 0.25, w * 0.88, h * 0.45, w * 0.85, h * 0.55);
      ctx.bezierCurveTo(w * 0.82, h * 0.72, w * 0.70, h * 0.78, w * 0.60, h * 0.75);
      ctx.bezierCurveTo(w * 0.45, h * 0.80, w * 0.30, h * 0.78, w * 0.20, h * 0.68);
      ctx.bezierCurveTo(w * 0.14, h * 0.62, w * 0.10, h * 0.55, w * 0.12, h * 0.45);
      ctx.closePath();
      ctx.strokeStyle = "hsla(0, 0%, 100%, 0.08)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Central sulcus line
      ctx.beginPath();
      ctx.moveTo(w * 0.38, h * 0.06);
      ctx.bezierCurveTo(w * 0.36, h * 0.30, w * 0.34, h * 0.50, w * 0.32, h * 0.70);
      ctx.strokeStyle = "hsla(0, 0%, 100%, 0.05)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Lateral sulcus
      ctx.beginPath();
      ctx.moveTo(w * 0.25, h * 0.50);
      ctx.bezierCurveTo(w * 0.35, h * 0.45, w * 0.50, h * 0.40, w * 0.60, h * 0.38);
      ctx.strokeStyle = "hsla(0, 0%, 100%, 0.05)";
      ctx.stroke();

      // ── Update activations ──
      if (isThinking) {
        // Determine which sequence step is active
        const cycleLen = THINKING_SEQUENCE.length * 30; // 30 frames per step
        const seqIdx = Math.floor((tick % cycleLen) / 30);
        const activeIds = THINKING_SEQUENCE[seqIdx] || [];

        regions.forEach((r) => {
          if (activeIds.includes(r.id)) {
            r.targetActivation = 0.7 + Math.sin(tick * 0.05 + r.phase * 10) * 0.3;
          } else {
            r.targetActivation *= 0.92;
          }
          r.activation += (r.targetActivation - r.activation) * 0.1;
        });
      } else {
        // Freeze: decay to resting state
        regions.forEach((r) => {
          r.targetActivation *= 0.96;
          r.activation += (r.targetActivation - r.activation) * 0.05;
        });
      }

      // ── Draw synaptic pathways ──
      SYNAPSES.forEach(({ from, to }) => {
        const rFrom = regions.find(r => r.id === from)!;
        const rTo = regions.find(r => r.id === to)!;
        const strength = Math.min(rFrom.activation, rTo.activation);

        const x1 = rFrom.cx * w, y1 = rFrom.cy * h;
        const x2 = rTo.cx * w, y2 = rTo.cy * h;

        // Curved pathway
        const midX = (x1 + x2) / 2 + (y2 - y1) * 0.15;
        const midY = (y1 + y2) / 2 - (x2 - x1) * 0.15;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(midX, midY, x2, y2);

        if (strength > 0.1) {
          ctx.strokeStyle = `hsla(275, 80%, 65%, ${strength * 0.6})`;
          ctx.lineWidth = strength * 2.5;

          // Animated pulse particle along path
          if (isThinking && strength > 0.3) {
            const t = ((tick * 0.02 + rFrom.phase) % 1);
            const px = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * midX + t * t * x2;
            const py = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * midY + t * t * y2;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(px, py, 2 + strength * 2, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(275, 90%, 75%, ${strength * 0.8})`;
            ctx.fill();
          } else {
            ctx.stroke();
          }
        } else {
          ctx.strokeStyle = "hsla(0, 0%, 100%, 0.04)";
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      });

      // ── Draw brain regions ──
      regions.forEach((r) => {
        const cx = r.cx * w;
        const cy = r.cy * h;
        const rx = r.rx * w;
        const ry = r.ry * h;
        const a = r.activation;

        // Outer glow when active
        if (a > 0.3) {
          ctx.beginPath();
          ctx.ellipse(cx, cy, rx + 4, ry + 4, 0, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(275, 80%, 60%, ${a * 0.12})`;
          ctx.fill();
        }

        // Region fill
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fillStyle = a > 0.2
          ? `hsla(275, 70%, 55%, ${0.05 + a * 0.2})`
          : "hsla(0, 0%, 100%, 0.02)";
        ctx.fill();

        // Region border
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.strokeStyle = a > 0.3
          ? `hsla(275, 80%, 65%, ${0.3 + a * 0.5})`
          : "hsla(0, 0%, 100%, 0.08)";
        ctx.lineWidth = a > 0.3 ? 1.5 : 0.8;
        ctx.stroke();

        // Center neuron dot
        const dotR = 2 + a * 3;
        ctx.beginPath();
        ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
        ctx.fillStyle = a > 0.3
          ? `hsla(275, 90%, 75%, ${0.5 + a * 0.5})`
          : "hsla(0, 0%, 100%, 0.15)";
        ctx.fill();

        // Label
        ctx.font = `${a > 0.3 ? "bold " : ""}7px system-ui`;
        ctx.fillStyle = a > 0.3
          ? `hsla(0, 0%, 100%, ${0.5 + a * 0.4})`
          : "hsla(0, 0%, 100%, 0.2)";
        ctx.textAlign = "center";
        ctx.fillText(r.shortLabel, cx, cy + ry + 10);

        // Role subtitle when active
        if (a > 0.4) {
          ctx.font = "6px system-ui";
          ctx.fillStyle = `hsla(275, 70%, 75%, ${a * 0.5})`;
          ctx.fillText(r.role, cx, cy + ry + 19);
        }
      });

      // ── Title: current thinking phase ──
      if (isThinking) {
        const cycleLen = THINKING_SEQUENCE.length * 30;
        const seqIdx = Math.floor((tick % cycleLen) / 30);
        const phaseLabels = ["Comprehending Input", "Reasoning & Analysis", "Memory Retrieval", "Deep Processing", "Generating Response"];
        ctx.font = "8px system-ui";
        ctx.fillStyle = "hsla(275, 80%, 75%, 0.5)";
        ctx.textAlign = "right";
        ctx.fillText(`▸ ${phaseLabels[seqIdx] || ""}`, w - 10, h - 10);
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isThinking]);

  return (
    <canvas
      ref={canvasRef}
      className={`w-full rounded-xl ${className}`}
      style={{ height: 280 }}
    />
  );
};

export default NeuralVisualization;
