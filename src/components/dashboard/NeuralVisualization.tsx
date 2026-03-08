import { useEffect, useRef, useCallback } from "react";

interface NeuralVisualizationProps {
  isThinking: boolean;
  className?: string;
}

interface Neuron {
  x: number;
  y: number;
  layer: number;
  activation: number;
  targetActivation: number;
}

const NeuralVisualization = ({ isThinking, className = "" }: NeuralVisualizationProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const neuronsRef = useRef<Neuron[]>([]);
  const animFrameRef = useRef<number>(0);
  const initRef = useRef(false);

  const initNetwork = useCallback((width: number, height: number) => {
    const neurons: Neuron[] = [];
    const layerSizes = [6, 10, 10, 8, 4];
    const layerCount = layerSizes.length;

    layerSizes.forEach((size, layerIdx) => {
      const x = ((layerIdx + 1) / (layerCount + 1)) * width;
      for (let i = 0; i < size; i++) {
        const y = ((i + 1) / (size + 1)) * height;
        neurons.push({
          x,
          y,
          layer: layerIdx,
          activation: 0,
          targetActivation: 0,
        });
      }
    });

    neuronsRef.current = neurons;
    initRef.current = true;
  }, []);

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

    if (!initRef.current) initNetwork(w, h);

    const neurons = neuronsRef.current;
    const layerSizes = [6, 10, 10, 8, 4];

    // Build layer index ranges
    const layerRanges: [number, number][] = [];
    let offset = 0;
    layerSizes.forEach((size) => {
      layerRanges.push([offset, offset + size]);
      offset += size;
    });

    let tick = 0;

    const draw = () => {
      tick++;
      ctx.clearRect(0, 0, w, h);

      // Update activations
      if (isThinking) {
        neurons.forEach((n) => {
          if (tick % 3 === 0 && Math.random() > 0.7) {
            n.targetActivation = Math.random();
          }
          n.activation += (n.targetActivation - n.activation) * 0.12;
          n.targetActivation *= 0.97;
        });
      } else {
        neurons.forEach((n) => {
          n.activation *= 0.95;
          n.targetActivation *= 0.95;
        });
      }

      // Draw connections
      for (let l = 0; l < layerRanges.length - 1; l++) {
        const [fromStart, fromEnd] = layerRanges[l];
        const [toStart, toEnd] = layerRanges[l + 1];

        for (let i = fromStart; i < fromEnd; i++) {
          for (let j = toStart; j < toEnd; j++) {
            const a = neurons[i];
            const b = neurons[j];
            const strength = Math.min(a.activation, b.activation);

            if (strength > 0.05) {
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.strokeStyle = `hsla(0, 0%, 100%, ${strength * 0.7})`;
              ctx.lineWidth = strength * 2.5;
              ctx.stroke();
            } else {
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.strokeStyle = `hsla(0, 0%, 100%, 0.12)`;
              ctx.lineWidth = 0.5;
              ctx.stroke();
            }
          }
        }
      }

      // Draw neurons
      neurons.forEach((n) => {
        const radius = 4 + n.activation * 4;

        // Glow
        if (n.activation > 0.3) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, radius + 6, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(0, 0%, 100%, ${n.activation * 0.25})`;
          ctx.fill();
        }

        // Core
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = n.activation > 0.3
          ? `hsla(var(--accent), ${0.4 + n.activation * 0.6})`
          : `hsla(var(--muted-foreground), 0.15)`;
        ctx.fill();

        // Border
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = n.activation > 0.3
          ? `hsla(var(--accent), ${0.5 + n.activation * 0.5})`
          : `hsla(var(--border), 0.2)`;
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // Layer labels
      const labels = ["INPUT", "HIDDEN 1", "HIDDEN 2", "HIDDEN 3", "OUTPUT"];
      layerRanges.forEach(([start], idx) => {
        const n = neurons[start];
        if (n) {
          ctx.font = "9px system-ui";
          ctx.fillStyle = `hsla(var(--muted-foreground), 0.3)`;
          ctx.textAlign = "center";
          ctx.fillText(labels[idx] || "", n.x, h - 8);
        }
      });

      animFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isThinking, initNetwork]);

  return (
    <canvas
      ref={canvasRef}
      className={`w-full rounded-xl ${className}`}
      style={{ height: 220 }}
    />
  );
};

export default NeuralVisualization;
