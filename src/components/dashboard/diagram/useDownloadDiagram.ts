import { useCallback } from "react";

export function useDownloadDiagram(containerRef: React.RefObject<HTMLDivElement | null>) {
  const downloadScreenshot = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;

    try {
      // Use html2canvas dynamically
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(el, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const link = document.createElement("a");
      link.download = `asherin-diagram-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {
      // Fallback: capture via SVG foreignObject
      fallbackCapture(el);
    }
  }, [containerRef]);

  return { downloadScreenshot };
}

function fallbackCapture(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("width", String(rect.width));
  svg.setAttribute("height", String(rect.height));

  const fo = document.createElementNS(svgNS, "foreignObject");
  fo.setAttribute("width", "100%");
  fo.setAttribute("height", "100%");
  
  const clone = el.cloneNode(true) as HTMLElement;
  clone.style.margin = "0";
  fo.appendChild(clone);
  svg.appendChild(fo);

  const data = new XMLSerializer().serializeToString(svg);
  const blob = new Blob([data], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.download = `asherin-diagram-${Date.now()}.svg`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}
