// ChannelMessage — renders a hoa_messages body with first-class support for
// fenced code blocks (```lang … ```) while keeping regular prose in the same
// low-key whitespace-pre-wrap treatment the rest of the deck uses.
//
// Zero external markdown deps to keep the render path fast and the surface
// hostile to prompt-injection surprises. Only fenced code blocks get special
// treatment; bold/italic in `**…**` still ships through as plain text.

import { memo, useState } from "react";
import { Copy, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props { body: string; }

interface Segment { type: "text" | "code"; content: string; lang?: string; }

function split(body: string): Segment[] {
  const out: Segment[] = [];
  const re = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    if (m.index > last) out.push({ type: "text", content: body.slice(last, m.index) });
    out.push({ type: "code", lang: m[1] || "text", content: m[2].replace(/\n$/, "") });
    last = m.index + m[0].length;
  }
  if (last < body.length) out.push({ type: "text", content: body.slice(last) });
  return out.length ? out : [{ type: "text", content: body }];
}

const CodeBlock = ({ code, lang }: { code: string; lang: string }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };
  return (
    <div className="my-2 rounded-md border border-border/30 bg-black/50 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/20 bg-black/40">
        <span className="text-[9px] tracking-widest uppercase text-muted-foreground/70">{lang}</span>
        <button onClick={copy} aria-label="Copy code" className="ml-auto text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1">
          {copied ? <><Check className="h-3 w-3 text-emerald-400" /> copied</> : <><Copy className="h-3 w-3" /> copy</>}
        </button>
      </div>
      <pre className="px-3 py-2 text-[12px] font-mono text-foreground/90 overflow-x-auto whitespace-pre">{code}</pre>
    </div>
  );
};

const ChannelMessage = memo(function ChannelMessage({ body }: Props) {
  const segs = split(body);
  return (
    <div className="text-sm font-light text-foreground/90 leading-relaxed">
      {segs.map((s, i) =>
        s.type === "code"
          ? <CodeBlock key={i} code={s.content} lang={s.lang ?? "text"} />
          : (
            <div key={i} className="prose prose-invert prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-strong:text-foreground prose-a:text-sky-300">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{s.content}</ReactMarkdown>
            </div>
          )
      )}
    </div>
  );
});

export default ChannelMessage;
