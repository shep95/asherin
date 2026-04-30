// Asher Code — starter project templates.
// Each template = a list of seed files. Live preview works for HTML/JS/React via srcdoc.

export interface AsherCodeTemplate {
  id: string;
  name: string;
  description: string;
  stack: string;
  language: string;
  files: { path: string; content: string; language: string }[];
}

export const ASHER_CODE_TEMPLATES: AsherCodeTemplate[] = [
  {
    id: "blank-html",
    name: "Blank HTML",
    description: "Single-file HTML page with inline JS + CSS. Live preview ready.",
    stack: "HTML / Vanilla JS",
    language: "html",
    files: [
      {
        path: "index.html",
        language: "html",
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Asher App</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0a0a0a; color: #e5e5e5; padding: 2rem; }
    h1 { font-weight: 200; letter-spacing: 0.1em; }
    button { background: #1a1a1a; color: #fff; border: 1px solid #333; padding: 0.5rem 1rem; cursor: pointer; }
    button:hover { background: #2a2a2a; }
  </style>
</head>
<body>
  <h1>ASHER APP</h1>
  <p>Hello, Operator.</p>
  <button onclick="alert('Engaged.')">Engage</button>
</body>
</html>`,
      },
    ],
  },
  {
    id: "intel-dashboard",
    name: "Intelligence Dashboard",
    description: "Single-file React (CDN) dashboard scaffold with threat indicators.",
    stack: "React (CDN)",
    language: "html",
    files: [
      {
        path: "index.html",
        language: "html",
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Intel Dashboard</title>
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>
    body { margin: 0; font-family: ui-monospace, monospace; background: #0a0a0a; color: #e5e5e5; }
    .grid { display: grid; grid-template-columns: 2fr 1fr; gap: 1rem; padding: 1rem; }
    .card { border: 1px solid #2a2a2a; border-radius: 8px; padding: 1rem; background: #111; }
    h1 { font-weight: 200; letter-spacing: 0.2em; padding: 1rem; border-bottom: 1px solid #1a1a1a; }
    .threat { display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px dashed #222; font-size: 12px; }
    .sev-high { color: #ef4444; } .sev-med { color: #f59e0b; } .sev-low { color: #10b981; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    const { useState } = React;
    const threats = [
      { id: 1, name: "Sector 7 — Anomalous traffic", sev: "high" },
      { id: 2, name: "GEOINT mismatch — Site Bravo", sev: "med" },
      { id: 3, name: "SIGINT chatter — uncorrelated", sev: "low" },
    ];
    function App() {
      return (
        <div>
          <h1>INTELLIGENCE DASHBOARD</h1>
          <div className="grid">
            <div className="card"><strong>MAP / OPERATIONAL OVERLAY</strong><p>(integrate map here)</p></div>
            <div className="card">
              <strong>THREAT FEED</strong>
              {threats.map(t => (
                <div key={t.id} className="threat">
                  <span>{t.name}</span>
                  <span className={"sev-" + t.sev}>{t.sev.toUpperCase()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }
    ReactDOM.createRoot(document.getElementById('root')).render(<App />);
  </script>
</body>
</html>`,
      },
    ],
  },
  {
    id: "automation-script",
    name: "Automation Script",
    description: "JavaScript automation with config — runs in console preview.",
    stack: "Vanilla JS",
    language: "javascript",
    files: [
      {
        path: "index.html",
        language: "html",
        content: `<!DOCTYPE html>
<html><head><title>Automation</title>
<style>body{font-family:ui-monospace,monospace;background:#0a0a0a;color:#0f0;padding:1rem;font-size:12px}
pre{white-space:pre-wrap}</style></head>
<body><pre id="out">// running...</pre>
<script src="script.js"></script></body></html>`,
      },
      {
        path: "script.js",
        language: "javascript",
        content: `// Asher Automation Script
const out = document.getElementById('out');
const log = (msg) => out.textContent += '\\n[' + new Date().toLocaleTimeString() + '] ' + msg;

const config = {
  targets: ['Sector 7', 'Site Bravo', 'Node 12'],
  intervalMs: 1500,
};

let i = 0;
log('Engine online. Targets: ' + config.targets.length);
const timer = setInterval(() => {
  if (i >= config.targets.length) { clearInterval(timer); log('Sweep complete.'); return; }
  log('Scanning: ' + config.targets[i]);
  i++;
}, config.intervalMs);`,
      },
    ],
  },
  {
    id: "react-component",
    name: "React Component (TSX)",
    description: "TypeScript React starter — integrate into Asher modules.",
    stack: "React + TypeScript",
    language: "typescript",
    files: [
      {
        path: "Component.tsx",
        language: "typescript",
        content: `import React, { useState } from "react";

interface Props {
  title?: string;
}

export default function AsherModule({ title = "Asher Module" }: Props) {
  const [count, setCount] = useState(0);
  return (
    <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-xl p-6">
      <h2 className="text-2xl font-extralight tracking-[0.2em]">{title}</h2>
      <p className="text-xs text-muted-foreground mt-2">Operator engagements: {count}</p>
      <button
        onClick={() => setCount(c => c + 1)}
        className="mt-4 rounded-lg border border-foreground/20 bg-foreground/10 px-4 py-2 text-xs uppercase tracking-[0.2em] hover:bg-foreground/20"
      >
        Engage
      </button>
    </div>
  );
}`,
      },
    ],
  },
  {
    id: "report-generator",
    name: "Report Generator",
    description: "Form-driven intel report builder with print-ready output.",
    stack: "HTML / JS",
    language: "html",
    files: [
      {
        path: "index.html",
        language: "html",
        content: `<!DOCTYPE html>
<html><head><title>Report Generator</title>
<style>
  body{font-family:ui-monospace,monospace;background:#0a0a0a;color:#e5e5e5;padding:2rem;max-width:900px;margin:auto}
  input,textarea,select{width:100%;background:#111;color:#fff;border:1px solid #333;padding:0.5rem;margin:0.25rem 0;font-family:inherit}
  button{background:#fff;color:#000;border:0;padding:0.6rem 1.2rem;cursor:pointer;letter-spacing:0.2em;font-weight:600}
  .out{margin-top:2rem;padding:1.5rem;border:1px solid #2a2a2a;background:#080808;white-space:pre-wrap;font-size:13px}
  h1{font-weight:200;letter-spacing:0.2em}
</style></head>
<body>
  <h1>INTELLIGENCE REPORT GENERATOR</h1>
  <input id="title" placeholder="Report title" />
  <select id="class"><option>UNCLASSIFIED</option><option>SECRET</option><option>TOP SECRET</option></select>
  <textarea id="body" rows="6" placeholder="Findings..."></textarea>
  <button onclick="gen()">GENERATE</button>
  <pre class="out" id="out"></pre>
  <script>
    function gen() {
      const t = document.getElementById('title').value || 'Untitled';
      const c = document.getElementById('class').value;
      const b = document.getElementById('body').value;
      const date = new Date().toISOString();
      document.getElementById('out').textContent =
        '═══════════════════════════════════════\\n' +
        '  ' + c + '\\n' +
        '  ' + t.toUpperCase() + '\\n' +
        '  ' + date + '\\n' +
        '═══════════════════════════════════════\\n\\n' +
        b + '\\n\\n— END OF REPORT —';
    }
  </script>
</body></html>`,
      },
    ],
  },
  {
    id: "data-analyzer",
    name: "Data Analyzer (Chart)",
    description: "CSV-paste analyzer with bar chart visualization.",
    stack: "HTML / Canvas",
    language: "html",
    files: [
      {
        path: "index.html",
        language: "html",
        content: `<!DOCTYPE html>
<html><head><title>Data Analyzer</title>
<style>
  body{font-family:ui-monospace,monospace;background:#0a0a0a;color:#e5e5e5;padding:1rem}
  textarea{width:100%;background:#111;color:#fff;border:1px solid #333;padding:0.5rem;font-family:inherit}
  canvas{background:#080808;border:1px solid #222;margin-top:1rem;display:block;width:100%;max-width:800px;height:300px}
  button{background:#fff;color:#000;border:0;padding:0.5rem 1rem;margin:0.5rem 0;cursor:pointer}
</style></head>
<body>
  <h2 style="font-weight:200;letter-spacing:0.2em">DATA ANALYZER</h2>
  <p style="font-size:12px;color:#888">Paste CSV: label,value</p>
  <textarea id="csv" rows="6">A,12
B,28
C,7
D,34
E,19</textarea>
  <button onclick="render()">ANALYZE</button>
  <canvas id="c" width="800" height="300"></canvas>
  <script>
    function render(){
      const rows = document.getElementById('csv').value.trim().split('\\n').map(r => r.split(','));
      const max = Math.max(...rows.map(r => +r[1]));
      const c = document.getElementById('c'); const ctx = c.getContext('2d');
      ctx.fillStyle = '#080808'; ctx.fillRect(0,0,c.width,c.height);
      const bw = c.width / rows.length - 8;
      rows.forEach((r, i) => {
        const h = (+r[1] / max) * (c.height - 40);
        ctx.fillStyle = '#10b981';
        ctx.fillRect(i * (bw + 8) + 4, c.height - h - 20, bw, h);
        ctx.fillStyle = '#aaa'; ctx.font = '11px monospace';
        ctx.fillText(r[0], i * (bw + 8) + 4, c.height - 6);
        ctx.fillText(r[1], i * (bw + 8) + 4, c.height - h - 24);
      });
    }
    render();
  </script>
</body></html>`,
      },
    ],
  },
];

export function getTemplate(id: string) {
  return ASHER_CODE_TEMPLATES.find((t) => t.id === id);
}
