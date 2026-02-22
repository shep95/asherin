import { useState, useRef, useEffect, useCallback } from "react";
import { Globe, RefreshCw, ExternalLink, Smartphone, Monitor, Tablet, Loader2 } from "lucide-react";
import type { IdeFile } from "./IdeFileTree";

interface Props {
  files: IdeFile[];
}

type ViewportSize = "desktop" | "tablet" | "mobile";

const VIEWPORT_MAP: Record<ViewportSize, { w: string; label: string }> = {
  desktop: { w: "100%", label: "Desktop" },
  tablet: { w: "768px", label: "Tablet" },
  mobile: { w: "375px", label: "Mobile" },
};

function flattenFiles(files: IdeFile[]): IdeFile[] {
  const result: IdeFile[] = [];
  for (const f of files) {
    if (f.type === "file") result.push(f);
    if (f.children) result.push(...flattenFiles(f.children));
  }
  return result;
}

function buildPreviewHtml(files: IdeFile[]): string {
  const flat = flattenFiles(files);

  // Find HTML file or generate one
  const htmlFile = flat.find(f => f.name.endsWith(".html"));
  const cssFiles = flat.filter(f => f.name.endsWith(".css"));
  const tsxFiles = flat.filter(f => f.name.match(/\.(tsx|jsx|ts|js)$/));

  // Collect CSS
  const allCss = cssFiles.map(f => f.content ?? "").join("\n");

  // Build component preview from TSX/JSX
  let componentPreview = "";
  for (const file of tsxFiles) {
    const content = file.content ?? "";
    // Extract JSX return blocks for preview
    const returnMatch = content.match(/return\s*\(\s*([\s\S]*?)\s*\);/);
    if (returnMatch) {
      componentPreview += `<!-- ${file.name} -->\n${returnMatch[1]}\n`;
    }
  }

  if (htmlFile?.content) {
    // Inject CSS into existing HTML
    const injectedCss = allCss ? `<style>${allCss}</style>` : "";
    return htmlFile.content.replace("</head>", `${injectedCss}</head>`);
  }

  // Generate a full HTML document
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { margin: 0; font-family: Inter, system-ui, sans-serif; background: #0a0a0a; color: #e5e5e5; }
    ${allCss}
  </style>
</head>
<body>
  <div id="root">
    ${componentPreview || `<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;opacity:0.4;font-size:14px;">Write code to see preview</div>`}
  </div>
</body>
</html>`;
}

const IdePreviewPanel = ({ files }: Props) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [viewport, setViewport] = useState<ViewportSize>("desktop");
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState("about:blank");

  const refreshPreview = useCallback(() => {
    setLoading(true);
    const html = buildPreviewHtml(files);
    const blob = new Blob([html], { type: "text/html" });
    const blobUrl = URL.createObjectURL(blob);
    setUrl(blobUrl);
    // Cleanup old blob URLs
    return () => URL.revokeObjectURL(blobUrl);
  }, [files]);

  // Auto-refresh on file changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      refreshPreview();
    }, 800);
    return () => clearTimeout(timer);
  }, [refreshPreview]);

  const handleIframeLoad = () => setLoading(false);

  const openExternal = () => {
    const html = buildPreviewHtml(files);
    const blob = new Blob([html], { type: "text/html" });
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, "_blank");
  };

  return (
    <div className="flex flex-col h-full bg-background/50">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-card/20 border-b border-border/20">
        <div className="flex items-center gap-2">
          <Globe className="h-3 w-3 text-accent/60" />
          <span className="text-[10px] font-light tracking-widest text-muted-foreground/50 uppercase">Preview</span>
          {loading && <Loader2 className="h-3 w-3 animate-spin text-accent/40" />}
        </div>
        <div className="flex items-center gap-1">
          {/* Viewport Switcher */}
          {(["desktop", "tablet", "mobile"] as ViewportSize[]).map(v => {
            const Icon = v === "desktop" ? Monitor : v === "tablet" ? Tablet : Smartphone;
            return (
              <button
                key={v}
                onClick={() => setViewport(v)}
                className={`p-1.5 rounded-md transition-colors ${viewport === v ? "bg-accent/20 text-accent" : "text-muted-foreground/40 hover:text-foreground"}`}
                title={VIEWPORT_MAP[v].label}
              >
                <Icon className="h-3 w-3" />
              </button>
            );
          })}
          <div className="w-px h-4 bg-border/20 mx-1" />
          <button onClick={refreshPreview} className="p-1.5 rounded-md text-muted-foreground/40 hover:text-foreground transition-colors" title="Refresh">
            <RefreshCw className="h-3 w-3" />
          </button>
          <button onClick={openExternal} className="p-1.5 rounded-md text-muted-foreground/40 hover:text-foreground transition-colors" title="Open in new tab">
            <ExternalLink className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Iframe Container */}
      <div className="flex-1 flex items-start justify-center overflow-auto bg-[hsl(var(--muted)/0.1)] p-2">
        <div
          className="bg-background border border-border/20 rounded-md overflow-hidden shadow-lg transition-all duration-300"
          style={{
            width: VIEWPORT_MAP[viewport].w,
            maxWidth: "100%",
            height: "100%",
          }}
        >
          <iframe
            ref={iframeRef}
            src={url}
            onLoad={handleIframeLoad}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin"
            title="Live Preview"
          />
        </div>
      </div>
    </div>
  );
};

export default IdePreviewPanel;
