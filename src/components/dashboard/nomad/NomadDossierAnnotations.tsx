import { useState } from "react";
import { Check, X, AlertTriangle, MessageSquare, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Annotation {
  id?: string;
  finding_text: string;
  status: "VERIFIED" | "FALSE_POSITIVE" | "NEEDS_VERIFICATION";
  user_note: string;
  confidence_override?: number;
}

interface NomadDossierAnnotationsProps {
  investigationId?: string;
  userId?: string;
  content: string;
}

const STATUS_COLORS = {
  VERIFIED: "text-green-400 border-green-400/20 bg-green-400/5",
  FALSE_POSITIVE: "text-red-400 border-red-400/20 bg-red-400/5",
  NEEDS_VERIFICATION: "text-yellow-400 border-yellow-400/20 bg-yellow-400/5",
};

const STATUS_ICONS = {
  VERIFIED: Check,
  FALSE_POSITIVE: X,
  NEEDS_VERIFICATION: AlertTriangle,
};

const NomadDossierAnnotations = ({ investigationId, userId, content }: NomadDossierAnnotationsProps) => {
  const [expanded, setExpanded] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedText, setSelectedText] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<Annotation["status"]>("NEEDS_VERIFICATION");
  const { toast } = useToast();

  const handleAnnotate = async () => {
    if (!selectedText.trim() || !investigationId || !userId) return;

    const annotation: Annotation = {
      finding_text: selectedText,
      status,
      user_note: note,
    };

    try {
      await (supabase.from as any)("investigation_annotations").insert({
        investigation_id: investigationId,
        user_id: userId,
        finding_text: selectedText,
        status,
        user_note: note,
      });

      setAnnotations(prev => [...prev, annotation]);
      setSelectedText("");
      setNote("");
      toast({ title: "Annotation saved", description: `Finding marked as ${status}` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="rounded-xl border border-border/15 bg-card/15 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-extralight text-muted-foreground/60 hover:text-foreground transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <MessageSquare className="h-3 w-3" />
          Annotate Findings ({annotations.length})
        </div>
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 animate-fade-in">
          {annotations.length > 0 && (
            <div className="space-y-1">
              {annotations.map((ann, idx) => {
                const Icon = STATUS_ICONS[ann.status];
                return (
                  <div key={idx} className={`rounded-lg border px-2 py-1.5 ${STATUS_COLORS[ann.status]}`}>
                    <div className="flex items-start gap-1.5">
                      <Icon className="h-3 w-3 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[9px] font-extralight truncate">{ann.finding_text}</p>
                        {ann.user_note && <p className="text-[8px] font-extralight opacity-60 mt-0.5">{ann.user_note}</p>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="space-y-1.5">
            <input
              value={selectedText}
              onChange={e => setSelectedText(e.target.value)}
              placeholder="Paste or type the finding to annotate..."
              className="w-full rounded-lg border border-border/20 bg-card/20 px-2.5 py-1.5 text-[10px] font-extralight text-foreground placeholder:text-muted-foreground/30 outline-none focus:border-accent/30 transition-colors"
            />
            <div className="flex items-center gap-1">
              {(["VERIFIED", "FALSE_POSITIVE", "NEEDS_VERIFICATION"] as const).map(s => {
                const Icon = STATUS_ICONS[s];
                return (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[8px] font-extralight transition-colors ${
                      status === s ? STATUS_COLORS[s] + " border" : "text-muted-foreground/30 border border-transparent hover:text-muted-foreground/60"
                    }`}
                  >
                    <Icon className="h-2.5 w-2.5" />
                    {s.replace("_", " ")}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-1.5">
              <input
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Add a note..."
                className="flex-1 rounded-lg border border-border/20 bg-card/20 px-2.5 py-1 text-[9px] font-extralight text-foreground placeholder:text-muted-foreground/30 outline-none focus:border-accent/30 transition-colors"
              />
              <button
                onClick={handleAnnotate}
                disabled={!selectedText.trim()}
                className="rounded-lg bg-accent/15 border border-accent/25 px-2.5 py-1 text-[9px] font-extralight text-accent hover:bg-accent/25 disabled:opacity-30 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NomadDossierAnnotations;
