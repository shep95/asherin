import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Globe, RefreshCw, ExternalLink, Smartphone, Monitor, Tablet, Loader2, RotateCcw } from "lucide-react";
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

function stripModuleSyntax(src: string): { code: string; defaultExport: string | null; namedComponents: string[] } {
  let code = src;
  // Remove ES module imports (Babel standalone can't resolve them in-browser)
  code = code.replace(/^\s*import\s+[^;]*?from\s+['"][^'"]+['"];?\s*$/gm, "");
  code = code.replace(/^\s*import\s+['"][^'"]+['"];?\s*$/gm, "");
  // Capture default export name
  let defaultExport: string | null = null;
  const defFnMatch = code.match(/export\s+default\s+function\s+([A-Z][A-Za-z0-9_]*)/);
  const defClassMatch = code.match(/export\s+default\s+class\s+([A-Z][A-Za-z0-9_]*)/);
  const defIdentMatch = code.match(/export\s+default\s+([A-Z][A-Za-z0-9_]*)\s*;?/);
  if (defFnMatch) defaultExport = defFnMatch[1];
  else if (defClassMatch) defaultExport = defClassMatch[1];
  else if (defIdentMatch) defaultExport = defIdentMatch[1];
  // Strip export keywords (keep declarations in global scope)
  code = code.replace(/export\s+default\s+function\s+/g, "function ");
  code = code.replace(/export\s+default\s+class\s+/g, "class ");
  code = code.replace(/export\s+default\s+([A-Z][A-Za-z0-9_]*)\s*;?/g, "");
  code = code.replace(/export\s+(const|let|var|function|class)\s+/g, "$1 ");
  code = code.replace(/^\s*export\s+\{[^}]*\}\s*;?\s*$/gm, "");
  // Fallback: top-level component-like declarations
  const namedComponents: string[] = [];
  const rxFn = /(?:^|\n)\s*(?:export\s+)?(?:async\s+)?(?:function|const|let|var|class)\s+([A-Z][A-Za-z0-9_]*)/g;
  let m: RegExpExecArray | null;
  while ((m = rxFn.exec(code)) !== null) namedComponents.push(m[1]);
  const rxSrc = /(?:^|\n)\s*(?:export\s+(?:default\s+)?)?(?:async\s+)?(?:function|const|let|var|class)\s+([A-Z][A-Za-z0-9_]*)/g;
  while ((m = rxSrc.exec(src)) !== null) if (!namedComponents.includes(m[1])) namedComponents.push(m[1]);
  for (const name of namedComponents) {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    code = code.replace(new RegExp(`(^|\\n)(\\s*)(async\\s+)?function\\s+${esc}\\s*\\(`, "g"), `$1$2var ${name} = window.${name} = $3function ${name}(`);
    code = code.replace(new RegExp(`(^|\\n)(\\s*)class\\s+${esc}(\\s+extends\\s+)`, "g"), `$1$2var ${name} = window.${name} = class ${name}$3`);
    code = code.replace(new RegExp(`(^|\\n)(\\s*)class\\s+${esc}(\\s*[{])`, "g"), `$1$2var ${name} = window.${name} = class ${name}$3`);
    code = code.replace(new RegExp(`(^|\\n)(\\s*)(?:const|let|var)\\s+${esc}(?:\\s*:[^=]+)?\\s*=`, "g"), `$1$2var ${name} = window.${name} =`);
  }
  return { code, defaultExport, namedComponents };
}

function buildPreviewHtml(files: IdeFile[]): string {
  const flat = flattenFiles(files);
  const compileScriptTag = (name: string, source: string) => {
    const { code } = stripModuleSyntax(source);
    return `<script type="text/babel" data-presets="env,react,typescript">\n/* ${name} */\n${code.replace(/<\/script/gi, "<\\/script")}\n<\/script>`;
  };

  const htmlFile = flat.find(f => f.name.endsWith(".html"));
  const cssFiles = flat.filter(f => f.name.endsWith(".css"));
  const jsxFiles = flat.filter(f => f.name.match(/\.(tsx|jsx)$/));
  const jsFiles = flat.filter(f => f.name.match(/\.(m?js|ts)$/) && !f.name.match(/\.(tsx|jsx)$/));

  const allCss = cssFiles.map(f => f.content ?? "").join("\n");

  if (htmlFile?.content) {
    const injectedCss = allCss ? `<style>${allCss}</style>` : "";
    let content = htmlFile.content.replace("</head>", `${injectedCss}</head>`);
    let needsHtmlCompiler = false;
    let needsHtmlReact = false;
    for (const f of flat) {
      if (f === htmlFile) continue;
      if (/\.(tsx?|jsx?|mjs)$/.test(f.name)) {
        const compiled = compileScriptTag(f.name, f.content ?? "");
        const escapedName = f.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const scriptRef = new RegExp(`<script([^>]*)src=["'](?:\\./|/)?${escapedName}["']([^>]*)><\\/script>`, "g");
        if (scriptRef.test(content)) {
          content = content.replace(scriptRef, () => compiled);
          needsHtmlCompiler = true;
          if (/\.(tsx|jsx|js)$/.test(f.name) || /from ['"]react['"]/.test(f.content ?? "") || /React/.test(f.content ?? "")) needsHtmlReact = true;
        }
      }
    }
    if (needsHtmlCompiler && !/babel\.min\.js/.test(content)) {
      const runtime = `${needsHtmlReact ? `<script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"><\/script><script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"><\/script><script>try{var R=window.React||{};['useState','useEffect','useRef','useMemo','useCallback','useContext','useReducer','useLayoutEffect','createContext','forwardRef','memo','Fragment','Suspense','lazy','createElement'].forEach(function(k){if(R[k]&&typeof window[k]==='undefined')window[k]=R[k];});if(window.ReactDOM&&typeof window.createRoot==='undefined')window.createRoot=window.ReactDOM.createRoot;}catch(e){}</script>` : ""}<script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>`;
      content = content.includes("</head>") ? content.replace("</head>", `${runtime}</head>`) : runtime + content;
    }
    return content;
  }

  const hasReact = jsxFiles.length > 0 || flat.some(f => /from ['"]react['"]/.test(f.content ?? ""));

  if (jsxFiles.length === 0 && jsFiles.length === 0 && allCss.length === 0) {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><script src="https://cdn.tailwindcss.com"><\/script></head><body style="background:#0a0a0a;color:#888;font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;font-size:13px;opacity:0.5">Write code to see preview</body></html>`;
  }

  let mountTarget: string | null = null;
  const jsxBlocks = jsxFiles.map(f => {
    const raw = f.content ?? "";
    const { code, defaultExport, namedComponents } = stripModuleSyntax(raw);
    if (defaultExport) mountTarget = defaultExport;
    else if (namedComponents.length) mountTarget = namedComponents[namedComponents.length - 1];
    return `<script type="text/babel" data-presets="env,react,typescript">\n/* ${f.name} */\n${code}\n</script>`;
  }).join("\n");

  const jsBlocks = jsFiles.map(f => compileScriptTag(f.name, f.content ?? "")).join("\n");

  const userMountsItself = jsxFiles.concat(jsFiles).some(f => {
    const c = f.content ?? "";
    return /ReactDOM\.render\s*\(/.test(c) || /createRoot\s*\([^)]*\)\s*\.render\s*\(/.test(c);
  });

  const autoMount = (hasReact && mountTarget && !userMountsItself)
    ? `<script type="text/babel" data-presets="env,react,typescript">
try {
  const __el = document.getElementById('root') || document.getElementById('app');
  if (__el && typeof ${mountTarget} !== 'undefined') {
    if (ReactDOM.createRoot) { ReactDOM.createRoot(__el).render(React.createElement(${mountTarget})); }
    else { ReactDOM.render(React.createElement(${mountTarget}), __el); }
  } else if (!__el) {
    document.body.innerHTML = '<pre style="color:#f88;font-family:monospace;padding:1rem">Auto-mount failed: no #root or #app element.</pre>';
  } else {
    document.body.innerHTML = '<pre style="color:#f88;font-family:monospace;padding:1rem">Auto-mount failed: component "${mountTarget}" is not defined at runtime.</pre>';
  }
} catch (e) {
  document.body.innerHTML = '<pre style="color:#f88;font-family:monospace;padding:1rem;white-space:pre-wrap">Auto-mount error: ' + (e && e.message ? e.message : String(e)) + '</pre>';
}
<\/script>`
    : (hasReact && !userMountsItself
      ? `<script>document.body.insertAdjacentHTML('afterbegin','<pre style=\\'color:#888;font-family:monospace;padding:1rem\\'>No default export or top-level component detected. Add <code>export default MyComponent</code> to render in preview.</pre>')<\/script>`
      : "");

  const needsBabel = hasReact || jsxFiles.length > 0 || jsFiles.length > 0;
  const reactCdn = hasReact
    ? `<script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"><\/script>
<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"><\/script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>`
    : (needsBabel ? `<script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>` : "");

  // Shim hooks + Next.js / common framework imports as globals so stripped
  // `import { useState } from 'react'` / `import { useRouter } from 'next/router'`
  // don't leave undefined identifiers. Also surface runtime errors in the iframe body.
  const shim = hasReact ? `<script>
(function(){
  try {
    var R = window.React || {};
    ['useState','useEffect','useRef','useMemo','useCallback','useContext','useReducer','useLayoutEffect','createContext','forwardRef','memo','Fragment','Suspense','lazy','createElement'].forEach(function(k){ if (R[k] && typeof window[k]==='undefined') window[k]=R[k]; });
    if (window.ReactDOM && typeof window.createRoot==='undefined') window.createRoot = window.ReactDOM.createRoot;
    if (typeof window.useRouter==='undefined') window.useRouter = function(){ return { push:function(){}, replace:function(){}, back:function(){}, query:{}, pathname:'/', asPath:'/' }; };
    if (typeof window.dynamic==='undefined') window.dynamic = function(){ return function(){ return null; }; };
    if (typeof window.toast==='undefined') { var t=function(m){ console.log('[toast]',m); }; t.success=t; t.error=t; t.loading=t; t.dismiss=function(){}; window.toast=t; }
    if (typeof window.useAuth==='undefined') window.useAuth = function(){ return { user:null, loading:false, signIn:function(){}, signOut:function(){} }; };
  } catch(e){}
})();
(function(){
  function classify(msg){
    msg = String(msg||'');
    if (/Unexpected token/i.test(msg)) return { kind:'Syntax Error', why:'The code could not be parsed. A bracket, quote, or punctuation is missing or out of place, so the script never starts.' };
    if (/is not defined|ReferenceError/i.test(msg)) return { kind:'Reference Error', why:'A variable or function is being used before it exists. Likely a missing import, a typo, or an identifier not exposed to the preview.' };
    if (/Cannot read propert|undefined.*reading|null.*reading/i.test(msg)) return { kind:'Null/Undefined Access', why:'Code is reading a property from null/undefined. Add a guard or fix the data source.' };
    if (/is not a function/i.test(msg)) return { kind:'Type Error', why:'The value being called is not a function. Check imports or declaration order.' };
    if (/Failed to fetch|NetworkError|CORS/i.test(msg)) return { kind:'Network Error', why:'A request failed (network/CORS/sandbox). The preview iframe blocks most external calls.' };
    if (/Maximum update depth|infinite/i.test(msg)) return { kind:'Infinite Loop', why:'A component re-renders endlessly. Check effect dependencies or state updates during render.' };
    return { kind:'Runtime Error', why:'The script crashed at runtime.' };
  }
  function showPopup(msg, src){
    var info = classify(msg);
    var existing = document.getElementById('__ide_err_pop'); if (existing) existing.remove();
    var wrap = document.createElement('div');
    wrap.id = '__ide_err_pop';
    wrap.style.cssText='position:fixed;left:12px;bottom:12px;max-width:520px;z-index:2147483647;background:#1a0a0a;border:1px solid #ef4444;border-radius:10px;box-shadow:0 12px 40px rgba(0,0,0,.5);font-family:ui-monospace,monospace;color:#fecaca;font-size:12px;overflow:hidden';
    wrap.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:#2a0d0d;border-bottom:1px solid #ef444466"><div style="display:flex;align-items:center;gap:8px"><span style="width:8px;height:8px;border-radius:50%;background:#ef4444;display:inline-block;box-shadow:0 0 8px #ef4444"></span><strong style="color:#fca5a5">'+info.kind+'</strong></div><div><button id="__ide_err_dbg" style="background:#7f1d1d;color:#fff;border:0;border-radius:6px;padding:3px 8px;font-size:11px;cursor:pointer;margin-right:6px">Send to Bug Doctor</button><button id="__ide_err_x" style="background:transparent;color:#fca5a5;border:0;cursor:pointer;font-size:14px">×</button></div></div><div style="padding:10px"><div style="margin-bottom:6px;line-height:1.4">'+info.why+'</div><pre style="margin:0;padding:8px;background:#0f0505;border:1px solid #ef444433;border-radius:6px;white-space:pre-wrap;max-height:180px;overflow:auto;color:#fca5a5">'+(msg.replace(/[<>&]/g,function(c){return{'<':'&lt;','>':'&gt;','&':'&amp;'}[c];}))+'</pre>'+(src?'<div style="margin-top:6px;color:#fda4af;opacity:.8;font-size:11px">'+src+'</div>':'')+'</div>';
    document.body.appendChild(wrap);
    document.getElementById('__ide_err_x').onclick = function(){ wrap.remove(); };
    document.getElementById('__ide_err_dbg').onclick = function(){
      try { parent.postMessage({ __idePreviewError: true, kind: info.kind, why: info.why, message: msg, source: src }, '*'); } catch(e){}
      wrap.remove();
    };
    try { parent.postMessage({ __idePreviewErrorSilent: true, kind: info.kind, why: info.why, message: msg, source: src }, '*'); } catch(e){}
  }
  window.addEventListener('error', function(ev){
    var msg = (ev && ev.error && ev.error.stack) ? ev.error.stack : (ev && ev.message ? ev.message : String(ev));
    var src = ev && ev.filename ? (ev.filename+':'+(ev.lineno||'?')+':'+(ev.colno||'?')) : '';
    showPopup(msg, src);
  });
  window.addEventListener('unhandledrejection', function(ev){
    var r = ev && ev.reason; var msg = (r && r.stack) ? r.stack : (r && r.message ? r.message : String(r));
    showPopup('Unhandled promise rejection: '+msg, '');
  });
})();
<\/script>` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
  ${reactCdn}
  ${shim}
  <style>
    body { margin: 0; font-family: Inter, system-ui, sans-serif; background: #0a0a0a; color: #e5e5e5; }
    ${allCss}
  </style>
</head>
<body>
  <div id="root"></div>
  <div id="app"></div>
  ${jsxBlocks}
  ${jsBlocks}
  ${autoMount}
</body>
</html>`;
}

const IdePreviewPanel = ({ files }: Props) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [viewport, setViewport] = useState<ViewportSize>("desktop");
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState("about:blank");
  const [error, setError] = useState<string | null>(null);

  const memoizedHtml = useMemo(() => buildPreviewHtml(files), [files]);

  const refreshPreview = useCallback(() => {
    setLoading(true);
    setError(null);
    try {
      const blob = new Blob([memoizedHtml], { type: "text/html" });
      const blobUrl = URL.createObjectURL(blob);
      setUrl(blobUrl);
      return () => URL.revokeObjectURL(blobUrl);
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
      return undefined;
    }
  }, [memoizedHtml]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    const timer = setTimeout(() => {
      cleanup = refreshPreview();
    }, 800);
    return () => {
      clearTimeout(timer);
      cleanup?.();
    };
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
      <div className="flex items-center justify-between px-2 sm:px-3 py-1.5 bg-card/20 border-b border-border/20">
        <div className="flex items-center gap-2">
          <Globe className="h-3 w-3 text-accent/60 shrink-0" />
          <span className="text-[10px] font-light tracking-widest text-muted-foreground/50 uppercase hidden sm:inline">Preview</span>
          {loading && <Loader2 className="h-3 w-3 animate-spin text-accent/40" />}
        </div>
        <div className="flex items-center gap-1">
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
          <div className="w-px h-4 bg-border/20 mx-1 hidden sm:block" />
          <button onClick={() => refreshPreview()} className="p-1.5 rounded-md text-muted-foreground/40 hover:text-foreground transition-colors" title="Refresh">
            <RefreshCw className="h-3 w-3" />
          </button>
          <button onClick={openExternal} className="p-1.5 rounded-md text-muted-foreground/40 hover:text-foreground transition-colors hidden sm:block" title="Open in new tab">
            <ExternalLink className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="px-4 py-3 bg-destructive/10 border-b border-destructive/20 text-[11px] text-destructive font-light flex items-center gap-2">
          <span className="flex-1">{error}</span>
          <button onClick={() => refreshPreview()} className="shrink-0">
            <RotateCcw className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Iframe Container — centered and responsive */}
      <div className="flex-1 flex items-start justify-center overflow-auto bg-[hsl(var(--muted)/0.1)] p-1 sm:p-2">
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
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            title="Live Preview"
          />
        </div>
      </div>
    </div>
  );
};

export default IdePreviewPanel;
