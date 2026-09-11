// Keeps what a chat turn produced as a real, owned application.
//
// Nothing is kept silently: the person presses this, and only the files the
// answer actually produced are written. The result is the same artifact record
// the software workspace opens — one identity, one history, no second app.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Boxes, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { createArtifact, createVersion } from "@/lib/software/store";
import { saveFile } from "@/lib/software/files";
import { hashContent } from "@/lib/software/workspace";
import type { ArtifactFile as EngineFile } from "@/lib/artifact/types";

const KeepAsApplication = ({
  files,
  title,
  request,
}: {
  files: EngineFile[];
  title: string;
  request: string;
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [kept, setKept] = useState<string | null>(null);

  if (!files.length) return null;

  if (!user) {
    return (
      <p className="text-[10px] text-muted-foreground/70">
        sign in to keep this as an application you own.
      </p>
    );
  }

  const keep = async () => {
    setBusy(true);
    try {
      const artifact = await createArtifact({
        userId: user.id,
        displayName: title.slice(0, 80) || "untitled application",
        description: request.slice(0, 400),
        type: "application",
      });
      const sourceRef: Record<string, string> = {};
      for (const f of files) {
        await saveFile({ artifactId: artifact.id, userId: user.id, path: f.path, content: f.content, origin: "ai" });
        sourceRef[f.path] = hashContent(f.content);
      }
      await createVersion({
        artifactId: artifact.id,
        userId: user.id,
        changeSummary: "kept from a chat turn",
        label: "from chat",
        sourceRef: { files: sourceRef },
        checkpoint: true,
      });
      setKept(artifact.id);
      toast.success("kept — it now has its own workspace and history");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "it could not be kept");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      {kept ? (
        <button
          type="button"
          onClick={() => navigate(`/dashboard/software/${kept}/build`)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 px-2.5 py-1 text-[10px] text-primary hover:bg-primary/10"
        >
          <Boxes className="h-3 w-3" strokeWidth={1.5} /> open its workspace
        </button>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => void keep()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/30 px-2.5 py-1 text-[10px] text-muted-foreground disabled:opacity-40 hover:text-foreground"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Boxes className="h-3 w-3" strokeWidth={1.5} />} keep as
          an application
        </button>
      )}
      <span className="text-[10px] text-muted-foreground/60">
        {files.length} file{files.length === 1 ? "" : "s"} — nothing is installed until you say so
      </span>
    </div>
  );
};

export default KeepAsApplication;
