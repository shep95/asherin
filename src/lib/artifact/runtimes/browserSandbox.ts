// browser sandbox runtime.
//
// Honest boundary: this executes CLIENT-SIDE code only, inside a cross-origin
// iframe with no same-origin access, no credentials, and network denied by
// default via CSP. There is no npm install, no server process, no native build
// and no other language runtime. Anything beyond that is unavailable, and the
// caller is told why.

import type { ArtifactFile, ObservationChannel } from "../types";

export const SANDBOX_LIMITS = [
  "client-side only — no server, no shell, no native build",
  "no package installation — dependencies must be inlined or dropped",
  "network denied by default inside the frame",
  "no access to your session, cookies or credentials",
];

/** allow-scripts only. same-origin is deliberately NOT granted, so the frame
 *  cannot read this app's storage or session. */
export const SANDBOX_ATTR = "allow-scripts";

const CSP = "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:;";

export interface SandboxBuild {
  ok: boolean;
  srcDoc: string;
  /** reasons the build could not be produced. */
  errors: string[];
  /** dependencies that had to be refused. */
  refusedDependencies: string[];
}

/** the observation bridge. Every report the app shows about a running artifact
 *  comes from this script, so it must be present in both document shapes. */
const BRIDGE = `<script>
window.onerror=function(m,s,l,c){parent.postMessage({__artifact:1,channel:"runtime_error",level:"error",message:String(m)+" ("+l+":"+c+")"},"*");};
window.addEventListener("unhandledrejection",function(e){parent.postMessage({__artifact:1,channel:"runtime_error",level:"error",message:"unhandled rejection: "+String(e.reason)},"*");});
(function(){var f=console.log,g=console.error,w=console.warn;
function send(level){return function(){try{parent.postMessage({__artifact:1,channel:"console",level:level,message:Array.prototype.map.call(arguments,function(a){return typeof a==="object"?JSON.stringify(a):String(a)}).join(" ")},"*")}catch(e){}}}
console.log=function(){send("info").apply(null,arguments);f.apply(console,arguments)};
console.warn=function(){send("warn").apply(null,arguments);w.apply(console,arguments)};
console.error=function(){send("error").apply(null,arguments);g.apply(console,arguments)};})();
</script>`;

const RENDER_PING = `<script>
requestAnimationFrame(function(){var r=document.getElementById("root");parent.postMessage({__artifact:1,channel:"render",level:"info",message:"first frame painted, root has "+(r?r.childElementCount:0)+" child element(s)"},"*")});
</script>`;

const BARE_IMPORT = /^\s*import\s+[^'"]*['"]([^./][^'"]*)['"]/gm;

export function buildSrcDoc(files: ArtifactFile[], opts: { allowNetwork?: boolean } = {}): SandboxBuild {
  const errors: string[] = [];
  const refused: string[] = [];
  if (!files.length) return { ok: false, srcDoc: "", errors: ["the artifact has no files to run"], refusedDependencies: [] };

  const html = files.find((f) => f.path.endsWith(".html")) ?? null;
  const scripts = files.filter((f) => /\.(m?jsx?|tsx?)$/.test(f.path));
  const styles = files.filter((f) => f.path.endsWith(".css"));

  for (const s of scripts) {
    for (const m of s.content.matchAll(BARE_IMPORT)) {
      if (!refused.includes(m[1])) refused.push(m[1]);
    }
  }
  if (refused.length) {
    errors.push(`the sandbox installs nothing, so these imports cannot resolve: ${refused.join(", ")}`);
  }

  const csp = opts.allowNetwork ? CSP.replace("default-src 'none'", "default-src 'none'; connect-src https:") : CSP;

  if (html) {
    // The frame has no file server, so a relative <script src> or stylesheet
    // link would silently never load. Local references are inlined from the
    // artifact's own files instead; anything not in the artifact is reported
    // as missing rather than left as a blank page.
    const missing: string[] = [];
    let doc = html.content;

    doc = doc.replace(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>\s*<\/script>/gi, (whole, src: string) => {
      if (/^(https?:)?\/\//.test(src)) {
        missing.push(src);
        return `<!-- remote script refused: ${src} -->`;
      }
      const file = findFile(files, src);
      if (!file) {
        missing.push(src);
        return `<!-- missing file: ${src} -->`;
      }
      return `<script>try{\n${stripImports(file.content)}\n}catch(e){parent.postMessage({__artifact:1,channel:"runtime_error",level:"error",message:String(e&&e.message||e)},"*")}</script>`;
    });

    doc = doc.replace(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi, (whole, href: string) => {
      const file = findFile(files, href);
      if (!file) return `<!-- missing file: ${href} -->`;
      return `<style>${file.content}</style>`;
    });

    if (missing.length) {
      errors.push(`these references cannot load inside the sandbox: ${missing.join(", ")}`);
    }

    const head = `\n<meta http-equiv="Content-Security-Policy" content="${csp}">\n${BRIDGE}`;
    doc = /<head(\s[^>]*)?>/i.test(doc)
      ? doc.replace(/<head(\s[^>]*)?>/i, (m) => `${m}${head}`)
      : `<!doctype html><html><head>${head}</head><body>${doc}</body></html>`;
    doc = /<\/body>/i.test(doc) ? doc.replace(/<\/body>/i, `${RENDER_PING}\n</body>`) : `${doc}${RENDER_PING}`;

    return { ok: errors.length === 0, srcDoc: doc, errors, refusedDependencies: refused };
  }

  const usesReact = scripts.some((s) => /\breact\b/i.test(s.content) || /<[A-Z]/.test(s.content));
  if (usesReact) {
    errors.push("react artifacts need the react runtime, which is not bundled into the sandbox — the artifact must be plain dom javascript");
  }

  const doc = `<!doctype html>
<html><head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<style>html,body{margin:0;height:100%;background:#0a0a0b;color:#e7e5e4;font-family:ui-sans-serif,system-ui,sans-serif}</style>
${styles.map((s) => `<style>${s.content}</style>`).join("\n")}
${BRIDGE}
</head><body>
<div id="root"></div>
${scripts.map((s) => `<script>try{\n${stripImports(s.content)}\n}catch(e){parent.postMessage({__artifact:1,channel:"runtime_error",level:"error",message:String(e&&e.message||e)},"*")}</script>`).join("\n")}
${RENDER_PING}
</body></html>`;

  return { ok: errors.length === 0, srcDoc: doc, errors, refusedDependencies: refused };
}

/** resolves a relative reference against the artifact's own files. */
function findFile(files: ArtifactFile[], ref: string): ArtifactFile | null {
  const clean = ref.replace(/^\.\//, "").replace(/^\//, "").split("?")[0];
  return files.find((f) => f.path === clean) ?? files.find((f) => f.path.endsWith(`/${clean}`)) ?? null;
}

function stripImports(code: string): string {
  return code
    .replace(/^\s*import\s[^\n]*;?\s*$/gm, "")
    .replace(/^\s*export\s+default\s+/gm, "")
    .replace(/^\s*export\s+/gm, "");
}

export interface SandboxMessage {
  channel: ObservationChannel;
  level: "info" | "warn" | "error";
  message: string;
  source: string;
}

/** parse a postMessage payload from the frame. returns null for anything else. */
export function readSandboxMessage(data: unknown): SandboxMessage | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (d.__artifact !== 1) return null;
  const channel = d.channel;
  if (channel !== "runtime_error" && channel !== "console" && channel !== "render" && channel !== "performance") return null;
  const level = d.level === "error" || d.level === "warn" ? d.level : "info";
  return { channel, level, message: String(d.message ?? ""), source: "sandbox frame" };
}
