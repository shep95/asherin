import { useState } from "react";
import { ExternalLink, Globe } from "lucide-react";

interface NomadLinkPreviewProps {
  url: string;
}

const NomadLinkPreview = ({ url }: NomadLinkPreviewProps) => {
  const [hovered, setHovered] = useState(false);
  const domain = url.replace(/https?:\/\/(?:www\.)?/, "").split("/")[0];

  return (
    <span
      className="relative inline-flex items-center gap-1"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-accent/70 hover:text-accent transition-colors inline-flex items-center gap-0.5 text-[10px] font-extralight"
      >
        <Globe className="h-3 w-3" />
        {domain}
        <ExternalLink className="h-2.5 w-2.5" />
      </a>
      {hovered && (
        <div className="absolute bottom-full left-0 mb-2 z-50 w-56 animate-fade-in">
          <div className="rounded-xl border border-border/30 bg-card/95 backdrop-blur-xl p-3 shadow-xl">
            <p className="text-[10px] font-extralight text-foreground truncate">{domain}</p>
            <p className="text-[9px] font-extralight text-muted-foreground/60 truncate mt-0.5">{url}</p>
          </div>
        </div>
      )}
    </span>
  );
};

export default NomadLinkPreview;
