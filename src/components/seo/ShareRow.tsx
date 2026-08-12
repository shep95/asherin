/**
 * ShareRow — copy-link plus network hand-offs for a public article.
 *
 * The canonical URL is passed in rather than read from `window.location` so a
 * share from the preview host never leaks a preview link into someone else's
 * feed. Clipboard writes fall back to a hidden textarea on browsers that gate
 * `navigator.clipboard` behind a secure-context check.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Link2, Share2 } from "lucide-react";

interface Props {
  url: string;
  title: string;
  className?: string;
}

const ShareRow = ({ url, title, className = "" }: Props) => {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const flagCopied = useCallback(() => {
    setCopied(true);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 2000);
  }, []);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      flagCopied();
    } catch {
      const el = document.createElement("textarea");
      el.value = url;
      el.setAttribute("readonly", "");
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      try {
        document.execCommand("copy");
        flagCopied();
      } catch {
        /* clipboard unavailable — the link stays visible for manual copy */
      }
      document.body.removeChild(el);
    }
  }, [url, flagCopied]);

  const nativeShare = useCallback(async () => {
    if (!navigator.share) return copy();
    try {
      await navigator.share({ title, url });
    } catch {
      /* user dismissed the sheet */
    }
  }, [title, url, copy]);

  const q = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  const targets = [
    { label: "X", href: `https://twitter.com/intent/tweet?url=${q}&text=${t}` },
    { label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${q}` },
    { label: "Reddit", href: `https://www.reddit.com/submit?url=${q}&title=${t}` },
    { label: "WhatsApp", href: `https://api.whatsapp.com/send?text=${t}%20${q}` },
    { label: "Telegram", href: `https://t.me/share/url?url=${q}&text=${t}` },
    { label: "Email", href: `mailto:?subject=${t}&body=${q}` },
  ];

  return (
    <div className={`rounded-2xl border border-border/20 bg-card/15 p-5 backdrop-blur-md ${className}`}>
      <p className="text-[10px] font-extralight tracking-[0.35em] uppercase text-muted-foreground/60">
        ◈ share this page
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg border border-border/20 bg-background/50 px-3 py-2 text-[11px] font-light text-muted-foreground">
          {url}
        </code>
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? "Link copied to clipboard" : "Copy link to clipboard"}
          className="inline-flex items-center gap-2 rounded-lg border border-border/30 bg-background/60 px-4 py-2 text-[11px] font-light tracking-[0.2em] uppercase text-foreground transition-colors hover:bg-background focus-visible:outline focus-visible:outline-1 focus-visible:outline-foreground/40"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
          {copied ? "copied" : "copy link"}
        </button>
        <button
          type="button"
          onClick={nativeShare}
          aria-label="Share this page"
          className="inline-flex items-center gap-2 rounded-lg border border-border/30 bg-background/60 px-4 py-2 text-[11px] font-light tracking-[0.2em] uppercase text-foreground transition-colors hover:bg-background focus-visible:outline focus-visible:outline-1 focus-visible:outline-foreground/40"
        >
          <Share2 className="h-3.5 w-3.5" />
          share
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {targets.map((tg) => (
          <a
            key={tg.label}
            href={tg.href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="rounded-lg border border-border/20 bg-background/40 px-3 py-1.5 text-[10px] font-light tracking-[0.2em] uppercase text-muted-foreground transition-colors hover:border-border/40 hover:text-foreground focus-visible:outline focus-visible:outline-1 focus-visible:outline-foreground/40"
          >
            {tg.label}
          </a>
        ))}
      </div>

      <p aria-live="polite" className="sr-only">
        {copied ? "Link copied to clipboard" : ""}
      </p>
    </div>
  );
};

export default ShareRow;
