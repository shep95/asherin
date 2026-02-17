import { useState, useEffect } from "react";
import { ExternalLink, Globe } from "lucide-react";

interface LinkPreviewProps {
  url: string;
}

interface PreviewData {
  title: string;
  description: string;
  image?: string;
  domain: string;
  favicon?: string;
}

const URL_REGEX = /https?:\/\/[^\s<]+/g;

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace("www.", ""); } catch { return url; }
}

// Cache previews in memory
const previewCache = new Map<string, PreviewData | null>();

const LinkPreviewCard = ({ url }: LinkPreviewProps) => {
  const [preview, setPreview] = useState<PreviewData | null>(previewCache.get(url) ?? null);
  const [loading, setLoading] = useState(!previewCache.has(url));
  const [faviconError, setFaviconError] = useState(false);

  useEffect(() => {
    if (previewCache.has(url)) {
      setPreview(previewCache.get(url) ?? null);
      setLoading(false);
      return;
    }

    // Simple metadata extraction using favicon and domain
    const domain = extractDomain(url);
    const data: PreviewData = {
      title: domain,
      description: url,
      domain,
      favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
    };

    // YouTube special handling
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) {
      data.title = "YouTube Video";
      data.image = `https://img.youtube.com/vi/${ytMatch[1]}/mqdefault.jpg`;
      data.description = "Watch on YouTube";
    }

    // Twitter/X special handling
    if (domain.includes("twitter.com") || domain.includes("x.com")) {
      data.title = "Post on X";
      data.description = "View the post on X (formerly Twitter)";
    }

    // GitHub special handling
    if (domain.includes("github.com")) {
      const parts = url.split("github.com/")[1]?.split("/");
      if (parts && parts.length >= 2) {
        data.title = `${parts[0]}/${parts[1]}`;
        data.description = "GitHub Repository";
      }
    }

    previewCache.set(url, data);
    setPreview(data);
    setLoading(false);
  }, [url]);

  if (loading) {
    return (
      <div className="mt-2 rounded-xl border border-border/20 bg-card/30 backdrop-blur-sm p-3 animate-pulse">
        <div className="h-4 w-32 bg-foreground/5 rounded" />
      </div>
    );
  }

  if (!preview) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 flex gap-3 rounded-xl border border-border/20 bg-card/30 backdrop-blur-sm p-3 hover:bg-card/50 transition-all group overflow-hidden"
    >
      {preview.image && (
        <img src={preview.image} alt="" className="w-20 h-14 rounded-lg object-cover shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {preview.favicon && !faviconError ? (
            <img
              src={preview.favicon}
              alt=""
              className="w-4 h-4 rounded-sm"
              onError={() => setFaviconError(true)}
            />
          ) : (
            <Globe className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
          )}
          <span className="text-[10px] text-muted-foreground/60">{preview.domain}</span>
        </div>
        <p className="text-xs font-light text-foreground truncate">{preview.title}</p>
        <p className="text-[10px] text-muted-foreground/50 truncate">{preview.description}</p>
      </div>
      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-foreground/50 transition-colors shrink-0 mt-1" />
    </a>
  );
};

// Extract URLs from text and render previews
export function renderLinkPreviews(text: string) {
  const urls = text.match(URL_REGEX);
  if (!urls || urls.length === 0) return null;
  // Dedupe
  const unique = [...new Set(urls)].slice(0, 3);
  return (
    <div className="space-y-1.5">
      {unique.map((url) => (
        <LinkPreviewCard key={url} url={url} />
      ))}
    </div>
  );
}

export default LinkPreviewCard;
