import { useCallback, useRef, useState } from "react";
import { streamChat } from "@/lib/ai";

type Paper = "cream" | "white" | "night";
type Face = "cormorant" | "fraunces" | "newsreader" | "instrument" | "jost";
type Size = "letter" | "a4" | "book";

type PageDoc = {
  title: string;
  lede: string;
  body: string;
  paper: Paper;
  font: Face;
  size: Size;
};

type Chip = { label: string; p: string };
type Bubble = {
  role: "me" | "ai";
  text?: string;
  thought?: string;
  rec?: string;
  chips?: Chip[];
};

const PAGES_BRAIN =
  "you are the mouth for asherin.pages. job: a custom-styled pdf from scratch (type, grid, margins). not chat-with-pdf. not html2canvas. reply with one short thought paragraph, then one recommend sentence, then a fenced json block tagged page with keys title, lede, body, paper (cream|white|night), font (cormorant|fraunces|newsreader|instrument|jost), size (letter|a4|book). optional chips as a json array tagged chips of {label,p}. quiet file is default. never wallpaper mall. never stamp a font name on the letter.";

const PAPER: Record<Paper, { bg: string; ink: string }> = {
  cream: { bg: "#f3eee4", ink: "#1c1915" },
  white: { bg: "#fafafa", ink: "#161616" },
  night: { bg: "#12110f", ink: "#efe8d8" },
};

const FACE: Record<Face, string> = {
  cormorant: '"Cormorant Garamond", Georgia, serif',
  fraunces: "Fraunces, Georgia, serif",
  newsreader: "Newsreader, Georgia, serif",
  instrument: '"Instrument Serif", Georgia, serif',
  jost: "Jost, Inter, sans-serif",
};

const ASPECT: Record<Size, string> = {
  letter: "8.5 / 11",
  a4: "210 / 297",
  book: "6 / 9",
};

const emptyDoc = (): PageDoc => ({
  title: "",
  lede: "",
  body: "",
  paper: "cream",
  font: "cormorant",
  size: "letter",
});

function parseFence(src: string, tag: string): string | null {
  const re = new RegExp("```" + tag + "\\s*([\\s\\S]*?)```", "i");
  const m = src.match(re);
  return m ? m[1].trim() : null;
}

function parseReply(src: string, prev: PageDoc): { thought: string; rec: string; doc: PageDoc; chips: Chip[] } {
  let doc = { ...prev };
  const raw = parseFence(src, "page") || parseFence(src, "json");
  if (raw) {
    try {
      const j = JSON.parse(raw) as Partial<PageDoc>;
      if (j.title) doc.title = String(j.title).slice(0, 120);
      if (j.lede) doc.lede = String(j.lede).slice(0, 400);
      if (j.body) doc.body = String(j.body);
      if (j.paper === "cream" || j.paper === "white" || j.paper === "night") doc.paper = j.paper;
      if (j.font && j.font in FACE) doc.font = j.font;
      if (j.size === "letter" || j.size === "a4" || j.size === "book") doc.size = j.size;
    } catch {
      /* keep prev */
    }
  }
  let chips: Chip[] = [];
  const chipRaw = parseFence(src, "chips");
  if (chipRaw) {
    try {
      const arr = JSON.parse(chipRaw) as Chip[];
      if (Array.isArray(arr)) chips = arr.filter((c) => c?.label && c?.p).slice(0, 4);
    } catch {
      chips = [];
    }
  }
  const stripped = src.replace(/```[\s\S]*?```/g, "").trim();
  const parts = stripped.split(/\n+/).filter(Boolean);
  const thought = parts[0] || "the page is type on a grid. quiet file is default.";
  const rec = parts[1] || "say how it looks if it feels wrong.";
  return { thought, rec, doc, chips };
}

function pdfEscape(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrap(s: string, width: number) {
  const words = s.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? cur + " " + w : w;
    if (next.length > width) {
      if (cur) lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

function buildQuietPdf(doc: PageDoc) {
  const title = doc.title || "untitled";
  const lines = [...wrap(title, 42), "", ...wrap(doc.lede || "", 72), "", ...wrap(doc.body || "", 72)];
  const commands: string[] = ["BT", "/F1 18 Tf", "72 720 Td"];
  lines.forEach((ln, i) => {
    const size = i === 0 ? 18 : 11;
    if (i === 0) commands.push(`/F1 ${size} Tf`);
    if (i === 1) commands.push("/F1 11 Tf");
    commands.push(`(${pdfEscape(ln)}) Tj`, "0 -16 Td");
  });
  commands.push("ET");
  const stream = commands.join("\n");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>",
  ];
  let body = "%PDF-1.4\n";
  const offs = [0];
  objs.forEach((o, i) => {
    offs.push(body.length);
    body += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const start = body.length;
  body += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objs.length; i++) body += `${String(offs[i]).padStart(10, "0")} 00000 n \n`;
  body += `trailer << /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return new Blob([body], { type: "application/pdf" });
}

export default function PdfGeneratorView() {
  const [doc, setDoc] = useState<PageDoc>(emptyDoc);
  const [msgs, setMsgs] = useState<Bubble[]>([
    {
      role: "ai",
      thought: "a page is type on a grid. pictures are plates. fonts live in the file. quiet file is default.",
      rec: "say what the page is. then say how it looks if it feels wrong.",
      chips: [
        {
          label: "create · cream letter",
          p: "a cream letter. quiet serif. title: look a little closer. a page that starts blank — not a website printed. type sits on a grid. margins hold.",
        },
        { label: "find a font", p: "find a heavier serif like cormorant. use fraunces for the title." },
      ],
    },
  ]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const ink = PAPER[doc.paper];

  const send = useCallback(
    async (text: string) => {
      const t = text.trim();
      if (!t || busy) return;
      setDraft("");
      setMsgs((m) => [...m, { role: "me", text: t }]);
      setBusy(true);
      let acc = "";
      try {
        await streamChat({
          messages: [{ role: "user", content: t }],
          mode: "chat",
          brainContext: { prompt: PAGES_BRAIN, fileContents: [] },
          onDelta: (chunk) => {
            acc += chunk;
          },
          onDone: () => {},
        });
        const parsed = parseReply(acc, doc);
        setDoc(parsed.doc);
        setMsgs((m) => [...m, { role: "ai", thought: parsed.thought, rec: parsed.rec, chips: parsed.chips }]);
      } catch (e) {
        setMsgs((m) => [
          ...m,
          {
            role: "ai",
            thought: "the mouth missed this pass.",
            rec: e instanceof Error ? e.message : "say it again, or connect a key in connect.",
          },
        ]);
      }
      setBusy(false);
      box.current?.focus();
    },
    [busy, doc],
  );

  const download = () => {
    const blob = buildQuietPdf(doc);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "page.pdf";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border/15 px-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-light tracking-[0.04em] text-foreground">pages</h1>
          <p className="truncate text-[11px] font-extralight text-muted-foreground/70">
            prompt a page. quiet file. you keep the pdf.
          </p>
        </div>
        <span className="hidden text-[10px] tracking-[0.14em] text-muted-foreground/75 sm:inline">quiet file</span>
        <button
          type="button"
          onClick={download}
          disabled={!doc.title && !doc.body}
          className="rounded-[10px] bg-accent px-3 py-1.5 text-xs text-accent-foreground disabled:opacity-40"
        >
          compile pdf →
        </button>
      </header>
      <section className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(180px,48dvh)_minmax(0,1fr)] lg:grid-cols-[minmax(280px,34%)_minmax(0,1fr)] lg:grid-rows-1">
        <div className="order-2 flex min-h-0 min-w-0 flex-col border-t border-border/15 lg:order-1 lg:border-r lg:border-t-0">
          <div className="min-h-0 flex-1 space-y-3 overflow-auto p-3">
            {msgs.map((m, i) =>
              m.role === "me" ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[92%] rounded-2xl border border-border/20 bg-foreground/15 px-3.5 py-2.5 text-[13px] font-light leading-relaxed">
                    {m.text}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex justify-start">
                  <div className="max-w-[92%] rounded-2xl border border-border/20 bg-background/90 px-3.5 py-2.5 text-[13px] font-light leading-relaxed">
                    {m.thought && (
                      <details className="mb-2 border-b border-border/18 pb-2" open={i === msgs.length - 1}>
                        <summary className="cursor-pointer text-[10px] tracking-[0.16em] text-muted-foreground/70">
                          thought
                        </summary>
                        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{m.thought}</p>
                      </details>
                    )}
                    <p>{m.rec}</p>
                    {!!m.chips?.length && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {m.chips.map((c) => (
                          <button
                            key={c.label}
                            type="button"
                            className="rounded-full border border-border/28 bg-card/45 px-2.5 py-1.5 text-[11px] text-muted-foreground"
                            onClick={() => send(c.p)}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ),
            )}
            {busy && <p className="text-[11px] tracking-wide text-muted-foreground/60">setting type…</p>}
          </div>
          <form
            className="flex shrink-0 items-end gap-2 border-t border-border/15 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              send(draft);
            }}
          >
            <textarea
              ref={box}
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="make a page. find a font. or rewrite a line."
              className="min-h-[44px] flex-1 resize-none rounded-xl border border-border/20 bg-card/30 px-3 py-2 text-sm font-light outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(draft);
                }
              }}
            />
            <button type="submit" className="rounded-xl bg-foreground px-3 py-2 text-sm text-background">
              →
            </button>
          </form>
        </div>
        <div className="order-1 flex min-h-0 min-w-0 items-center justify-center p-3 lg:order-2 lg:p-4">
          <article
            className="h-full max-h-full w-auto max-w-full shadow-2xl"
            style={{
              aspectRatio: ASPECT[doc.size],
              background: ink.bg,
              color: ink.ink,
              fontFamily: FACE[doc.font],
              padding: "11% 12% 12%",
            }}
          >
            {doc.title || doc.body ? (
              <>
                <h2 className="text-[clamp(22px,4.2cqw,34px)] font-normal leading-[1.08] tracking-[-0.015em] lowercase">
                  {doc.title}
                </h2>
                {doc.lede ? (
                  <p className="mt-[4%] text-[clamp(11px,1.6cqw,13px)] italic leading-relaxed opacity-70">{doc.lede}</p>
                ) : null}
                {doc.body ? (
                  <p className="mt-[5%] max-w-[28em] text-[clamp(11px,1.5cqw,12.5px)] leading-[1.65]">{doc.body}</p>
                ) : null}
              </>
            ) : (
              <p className="grid h-full place-items-center text-[13px] tracking-wide opacity-30">
                say what the page is
              </p>
            )}
          </article>
        </div>
      </section>
    </div>
  );
}
