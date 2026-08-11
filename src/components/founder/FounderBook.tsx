import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Loader2, Minus, Plus } from "lucide-react";

/**
 * Scrollable, readable PDF reader for "The Book of Asher Aureon Elion".
 *
 * Performance contract:
 *  - pdf.js is dynamically imported only after the section enters the viewport
 *    (keeps ~1 MB of parser off the landing bundle).
 *  - Page canvases are rendered lazily via IntersectionObserver and released
 *    when far off-screen, so a 100+ page book never holds 100 bitmaps in RAM.
 *  - Page boxes are pre-sized from the PDF's own viewport before render, so
 *    scroll height is stable from the first paint (CLS < 0.1).
 */

type PdfDoc = {
  numPages: number;
  getPage: (n: number) => Promise<any>;
  destroy: () => Promise<void>;
};

const MAX_CANVAS_DPR = 2;
const BOOK_URL = "/the-book-that-answers-everything.pdf";

const FounderBook = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<PdfDoc | null>(null);
  const renderedRef = useRef<Map<number, { task: any }>>(new Map());

  const loadStartedRef = useRef<number>(-1);
  const [attempt, setAttempt] = useState(0);
  const [armed, setArmed] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<string>("");
  const [pageSizes, setPageSizes] = useState<{ w: number; h: number }[]>([]);
  const [scale, setScale] = useState(1);
  const [current, setCurrent] = useState(1);
  const [progress, setProgress] = useState(0);

  // ── Arm on first viewport entry ──────────────────────────────────────────
  useEffect(() => {
    const el = rootRef.current;
    if (!el || armed) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setArmed(true);
          io.disconnect();
        }
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [armed]);

  // ── Load the document ────────────────────────────────────────────────────
  useEffect(() => {
    // Ref guard, not a status guard: React 18 StrictMode mounts effects twice,
    // and a status-based guard would let the second pass see "loading" and
    // return forever after the first pass was torn down.
    if (!armed || loadStartedRef.current === attempt) return;
    loadStartedRef.current = attempt;
    let loadingTask: any = null;

    (async () => {
      setStatus("loading");
      try {
        // Legacy build: the modern bundle uses Map.getOrInsertComputed, which
        // throws on browsers older than a few months. The legacy build is the
        // same renderer with those APIs polyfilled.
        const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
        const workerUrl = (await import("pdfjs-dist/legacy/build/pdf.worker.mjs?url")).default;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

        loadingTask = pdfjs.getDocument({ url: BOOK_URL });
        loadingTask.onProgress = (p: { loaded: number; total: number }) => {
          if (p.total) setProgress(Math.min(99, Math.round((p.loaded / p.total) * 100)));
        };
        const doc: PdfDoc = await loadingTask.promise;
        docRef.current = doc;

        // Measure page 1 only and project it across the book: measuring every
        // page up-front serialises N worker round-trips and stalls first paint.
        // Each page corrects its own aspect ratio the moment it renders.
        const first = await doc.getPage(1);
        const vp = first.getViewport({ scale: 1 });
        first.cleanup?.();
        setPageSizes(Array.from({ length: doc.numPages }, () => ({ w: vp.width, h: vp.height })));
        setProgress(100);
        setStatus("ready");

      } catch (e) {
        setError(e instanceof Error ? e.message : "The book could not be opened.");
        setStatus("error");
      }
    })();

    return undefined;
  }, [armed, attempt]);

  // Tear down on unmount only.
  useEffect(
    () => () => {
      renderedRef.current.forEach((r) => r.task?.cancel?.());
      renderedRef.current.clear();
      docRef.current?.destroy?.().catch(() => undefined);
      docRef.current = null;
    },
    [],
  );

  const renderPage = useCallback(
    async (pageNum: number, canvas: HTMLCanvasElement, targetWidth: number) => {
      const doc = docRef.current;
      if (!doc || renderedRef.current.has(pageNum)) return;
      const entry = { task: null as any };
      renderedRef.current.set(pageNum, entry);
      try {
        const page = await doc.getPage(pageNum);
        const base = page.getViewport({ scale: 1 });
        // Correct this page's reserved box if it differs from the projection.
        const wrapper = canvas.parentElement as HTMLElement | null;
        if (wrapper) wrapper.style.aspectRatio = `${base.width} / ${base.height}`;
        const dpr = Math.min(window.devicePixelRatio || 1, MAX_CANVAS_DPR);
        const cssScale = targetWidth / base.width;
        const viewport = page.getViewport({ scale: cssScale * dpr });

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = "100%";
        canvas.style.height = "auto";
        const ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx) return;
        // pdf.js does not paint a page background; with alpha:false an unpainted
        // canvas is black, so the sheet must be primed white first.
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        entry.task = page.render({ canvasContext: ctx, viewport, background: "#ffffff" });
        await entry.task.promise;
      } catch {
        renderedRef.current.delete(pageNum);
      }
    },
    [],
  );

  // ── Lazy page rendering + active page tracking ───────────────────────────
  useEffect(() => {
    if (status !== "ready" || !pageSizes.length) return;
    const root = scrollRef.current;
    if (!root) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const el = e.target as HTMLDivElement;
          const n = Number(el.dataset.page);
          const canvas = el.querySelector("canvas") as HTMLCanvasElement | null;
          if (!canvas) continue;
          if (e.isIntersecting) {
            if (e.intersectionRatio > 0.35) setCurrent(n);
            void renderPage(n, canvas, el.clientWidth);
          }
        }
      },
      { root, rootMargin: "600px 0px", threshold: [0, 0.35] },
    );

    const nodes = root.querySelectorAll<HTMLDivElement>("[data-page]");
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [status, pageSizes, renderPage, scale]);

  // Re-render at the new zoom level: drop the cache, canvases repaint on scroll.
  const changeScale = (next: number) => {
    const clamped = Math.min(1.8, Math.max(0.7, Number(next.toFixed(2))));
    if (clamped === scale) return;
    renderedRef.current.forEach((r) => r.task?.cancel?.());
    renderedRef.current.clear();
    setScale(clamped);
    requestAnimationFrame(() => {
      scrollRef.current?.querySelectorAll<HTMLDivElement>("[data-page]").forEach((el) => {
        const canvas = el.querySelector("canvas") as HTMLCanvasElement | null;
        const n = Number(el.dataset.page);
        const r = el.getBoundingClientRect();
        if (canvas && r.bottom > -600 && r.top < window.innerHeight + 600) {
          void renderPage(n, canvas, el.clientWidth);
        }
      });
    });
  };

  return (
    <div ref={rootRef} className="mx-auto max-w-4xl">
      {/* Toolbar */}
      <div className="sticky top-16 z-20 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/20 bg-card/70 px-4 py-2.5 backdrop-blur-xl">
        <div className="text-[10px] font-mono uppercase tracking-[0.28em] text-foreground/55" aria-live="polite">
          {status === "ready" ? `Page ${current} / ${pageSizes.length}` : status === "loading" ? `Opening · ${progress}%` : "The Book"}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => changeScale(scale - 0.15)}
            disabled={status !== "ready" || scale <= 0.7}
            aria-label="Zoom out"
            className="rounded-lg p-2 text-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground disabled:opacity-30"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-10 text-center text-[10px] font-mono text-foreground/50">{Math.round(scale * 100)}%</span>
          <button
            type="button"
            onClick={() => changeScale(scale + 0.15)}
            disabled={status !== "ready" || scale >= 1.8}
            aria-label="Zoom in"
            className="rounded-lg p-2 text-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground disabled:opacity-30"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <a
            href={BOOK_URL}
            download="the-book-that-answers-everything.pdf"
            className="ml-1 inline-flex items-center gap-2 rounded-lg border border-border/25 px-3 py-1.5 text-[10px] font-light uppercase tracking-[0.22em] text-foreground/75 transition-colors hover:border-border/50 hover:text-foreground"
          >
            <Download className="h-3 w-3" /> Download
          </a>
        </div>
      </div>

      {/* Reader */}
      <div
        ref={scrollRef}
        tabIndex={0}
        role="document"
        aria-label="The Book of Asher Aureon Elion"
        className="h-[78vh] overflow-y-auto overscroll-contain rounded-2xl border border-border/20 bg-black/40 p-3 shadow-2xl shadow-black/40 sm:p-5"
        style={{ contain: "content" }}
      >
        {status === "loading" && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-foreground/55">
            <Loader2 className="h-5 w-5 animate-spin" />
            <p className="text-[11px] font-light uppercase tracking-[0.28em]">Opening the book · {progress}%</p>
          </div>
        )}

        {status === "idle" && (
          <div className="flex h-full items-center justify-center">
            <p className="text-[11px] font-light uppercase tracking-[0.28em] text-foreground/40">Scroll to open</p>
          </div>
        )}

        {status === "error" && (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-sm font-light text-foreground/70">{error}</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setStatus("idle");
                  setAttempt((a) => a + 1);
                }}
                className="rounded-lg border border-border/30 px-4 py-2 text-[10px] uppercase tracking-[0.22em] text-foreground/80 hover:text-foreground"
              >
                Try again
              </button>
              <a
                href={BOOK_URL}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-border/30 px-4 py-2 text-[10px] uppercase tracking-[0.22em] text-foreground/80 hover:text-foreground"
              >
                Open PDF
              </a>
            </div>
          </div>
        )}

        {status === "ready" &&
          pageSizes.map((s, i) => (
            <div
              key={i}
              data-page={i + 1}
              className="mx-auto mb-4 overflow-hidden rounded-lg bg-white/95 shadow-lg shadow-black/30"
              style={{ width: `${Math.min(100, 100 * scale)}%`, aspectRatio: `${s.w} / ${s.h}` }}
            >
              <canvas className="block h-auto w-full" aria-label={`Page ${i + 1}`} />
            </div>
          ))}
      </div>
    </div>
  );
};

export default FounderBook;
