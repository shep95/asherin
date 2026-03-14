import { useState } from "react";
import { FileText, Mail, ClipboardList, Code2, Table2, FileJson, CheckSquare, Presentation, ScrollText, X } from "lucide-react";

interface OutputFormatMenuProps {
  content: string;
  onClose?: () => void;
}

type FormatId = "doc" | "email" | "prd" | "spec" | "slides" | "patch" | "json" | "csv" | "checklist";

const formats: { id: FormatId; label: string; icon: React.ElementType; ext: string; mime: string }[] = [
  { id: "doc", label: "Document", icon: FileText, ext: "md", mime: "text/markdown" },
  { id: "email", label: "Email Draft", icon: Mail, ext: "txt", mime: "text/plain" },
  { id: "prd", label: "PRD", icon: ScrollText, ext: "md", mime: "text/markdown" },
  { id: "spec", label: "Spec", icon: ClipboardList, ext: "md", mime: "text/markdown" },
  { id: "slides", label: "Slide Outline", icon: Presentation, ext: "md", mime: "text/markdown" },
  { id: "patch", label: "Code Patch", icon: Code2, ext: "patch", mime: "text/plain" },
  { id: "json", label: "JSON", icon: FileJson, ext: "json", mime: "application/json" },
  { id: "csv", label: "CSV", icon: Table2, ext: "csv", mime: "text/csv" },
  { id: "checklist", label: "Checklist", icon: CheckSquare, ext: "md", mime: "text/markdown" },
];

function convertContent(content: string, format: FormatId): string {
  const lines = content.split("\n").filter(l => l.trim());
  switch (format) {
    case "email": {
      const subject = lines[0]?.replace(/^#+\s*/, "") || "Subject";
      const body = lines.slice(1).join("\n");
      return `Subject: ${subject}\n\nHi,\n\n${body}\n\nBest regards`;
    }
    case "prd":
      return `# Product Requirements Document\n\n## Overview\n${lines[0] || ""}\n\n## Requirements\n${lines.slice(1).map((l, i) => `${i + 1}. ${l.replace(/^[-*]\s*/, "")}`).join("\n")}\n\n## Success Metrics\n- TBD\n\n## Timeline\n- TBD`;
    case "spec":
      return `# Technical Specification\n\n## Summary\n${lines[0] || ""}\n\n## Details\n${lines.slice(1).join("\n")}\n\n## Dependencies\n- TBD\n\n## Testing\n- TBD`;
    case "slides":
      return lines.map((l, i) => `---\n## Slide ${i + 1}\n${l.replace(/^[-*#]\s*/, "")}\n`).join("\n");
    case "patch":
      return `--- a/content\n+++ b/content\n@@ -0,0 +1,${lines.length} @@\n${lines.map(l => `+${l}`).join("\n")}`;
    case "json":
      try {
        const sections = content.split(/\n(?=#+\s)/).filter(Boolean);
        const obj = sections.reduce((acc, s, i) => {
          const title = s.match(/^#+\s*(.+)/)?.[1] || `section_${i}`;
          acc[title.toLowerCase().replace(/\s+/g, "_")] = s.replace(/^#+\s*.+\n?/, "").trim();
          return acc;
        }, {} as Record<string, string>);
        return JSON.stringify(Object.keys(obj).length ? obj : { content }, null, 2);
      } catch { return JSON.stringify({ content }, null, 2); }
    case "csv": {
      const rows = lines.map(l => l.replace(/^[-*]\s*/, "").split(/[:|–—]\s*/).map(c => `"${c.trim().replace(/"/g, '""')}"`).join(","));
      return rows.join("\n");
    }
    case "checklist":
      return lines.map(l => `- [ ] ${l.replace(/^[-*#\d.)\]]\s*/, "")}`).join("\n");
    default:
      return content;
  }
}

const OutputFormatMenu = ({ content, onClose }: OutputFormatMenuProps) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleExport = (format: typeof formats[number]) => {
    const converted = convertContent(content, format.id);
    const blob = new Blob([converted], { type: format.mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aureon-export.${format.ext}`;
    a.click();
    URL.revokeObjectURL(url);
    onClose?.();
  };

  const handleCopy = (format: typeof formats[number]) => {
    const converted = convertContent(content, format.id);
    navigator.clipboard.writeText(converted);
    onClose?.();
  };

  return (
    <div className="absolute bottom-full left-0 mb-2 w-56 rounded-xl border border-border/30 bg-card/95 backdrop-blur-xl shadow-2xl z-50 overflow-hidden animate-scale-in">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/20">
        <span className="text-[10px] font-light text-muted-foreground/60 uppercase tracking-wider">Export As</span>
        {onClose && (
          <button onClick={onClose} className="p-0.5 text-muted-foreground/40 hover:text-foreground transition-colors">
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      <div className="py-1 max-h-[280px] overflow-y-auto">
        {formats.map(f => (
          <div
            key={f.id}
            onMouseEnter={() => setHoveredId(f.id)}
            onMouseLeave={() => setHoveredId(null)}
            className="flex items-center justify-between px-3 py-2 hover:bg-foreground/5 transition-colors group"
          >
            <button
              onClick={() => handleExport(f)}
              className="flex items-center gap-2.5 flex-1 text-left"
            >
              <f.icon className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
              <span className="text-[11px] font-light text-muted-foreground group-hover:text-foreground transition-colors">{f.label}</span>
            </button>
            {hoveredId === f.id && (
              <button
                onClick={() => handleCopy(f)}
                className="text-[9px] text-muted-foreground/40 hover:text-foreground transition-colors px-1.5 py-0.5 rounded border border-border/20"
              >
                Copy
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default OutputFormatMenu;
