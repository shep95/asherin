import { useState } from "react";
import { FileText, Table, Code, BarChart3, ClipboardList } from "lucide-react";

interface NomadOutputFormatProps {
  content: string;
  entities: { type: string; value: string; confidence: number }[];
}

type Format = "markdown" | "table" | "json" | "csv" | "briefing";

const formats: { id: Format; icon: React.ElementType; label: string }[] = [
  { id: "markdown", icon: FileText, label: "Markdown" },
  { id: "table", icon: Table, label: "Table" },
  { id: "json", icon: Code, label: "JSON" },
  { id: "csv", icon: BarChart3, label: "CSV" },
  { id: "briefing", icon: ClipboardList, label: "Briefing" },
];

function convertContent(content: string, entities: { type: string; value: string; confidence: number }[], format: Format): string {
  switch (format) {
    case "markdown":
      return content;
    case "table":
      return `| Type | Value | Confidence |\n|------|-------|------------|\n${entities.map(e => `| ${e.type} | ${e.value} | ${(e.confidence * 100).toFixed(0)}% |`).join("\n")}`;
    case "json":
      return JSON.stringify({ findings: content.slice(0, 2000), entities, exported_at: new Date().toISOString() }, null, 2);
    case "csv":
      return `type,value,confidence\n${entities.map(e => `"${e.type}","${e.value}",${e.confidence}`).join("\n")}`;
    case "briefing":
      return `INTELLIGENCE BRIEFING\n${"=".repeat(40)}\nDate: ${new Date().toISOString()}\nEntities: ${entities.length}\n${"=".repeat(40)}\n\nBOTTOM LINE UP FRONT:\n${content.slice(0, 500)}\n\nKEY ENTITIES:\n${entities.slice(0, 10).map(e => `- [${e.type.toUpperCase()}] ${e.value} (${(e.confidence * 100).toFixed(0)}%)`).join("\n")}`;
    default:
      return content;
  }
}

const NomadOutputFormat = ({ content, entities }: NomadOutputFormatProps) => {
  const [open, setOpen] = useState(false);

  const handleExport = (format: Format) => {
    const output = convertContent(content, entities, format);
    const ext = format === "json" ? "json" : format === "csv" ? "csv" : "md";
    const mime = format === "json" ? "application/json" : format === "csv" ? "text/csv" : "text/markdown";
    const blob = new Blob([output], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nomad-export-${new Date().toISOString().slice(0, 10)}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-[10px] font-light text-muted-foreground/50 hover:text-muted-foreground transition-colors"
      >
        <FileText className="h-3 w-3" />
        Format
      </button>
      {open && (
        <div className="absolute bottom-full right-0 mb-1 z-50 rounded-xl border border-border/30 bg-card/95 backdrop-blur-xl shadow-xl overflow-hidden animate-fade-in">
          {formats.map(f => (
            <button
              key={f.id}
              onClick={() => handleExport(f.id)}
              className="w-full flex items-center gap-2 px-4 py-2 text-[10px] font-extralight text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
            >
              <f.icon className="h-3 w-3" />
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default NomadOutputFormat;
