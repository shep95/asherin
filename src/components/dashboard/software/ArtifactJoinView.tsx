// Accepting an invitation, or opening a share link.
//
// The token in the address is the only thing that opens anything, and it is
// checked on the server against the signed-in account. Nothing is granted here
// in the browser.

import { useCallback, useEffect, useState } from "react";
import { Loader2, ShieldCheck, ShieldX } from "lucide-react";
import { acceptInvitation, redeemShareLink } from "@/lib/software/sharing";
import { useSoftwareRegistry } from "@/contexts/SoftwareContext";

const ArtifactJoinView = ({
  kind,
  token,
  onOpen,
  onBack,
}: {
  kind: "invite" | "join";
  token: string | undefined;
  onOpen: (artifactId: string) => void;
  onBack: () => void;
}) => {
  const { refresh } = useSoftwareRegistry();
  const [state, setState] = useState<"working" | "done" | "failed">("working");
  const [message, setMessage] = useState("checking this link");
  const [artifactId, setArtifactId] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (!token) {
      setState("failed");
      setMessage("this link is incomplete");
      return;
    }
    setState("working");
    setMessage("checking this link");
    try {
      const id = kind === "invite" ? await acceptInvitation(token) : await redeemShareLink(token);
      setArtifactId(id);
      setState("done");
      setMessage(kind === "invite" ? "invitation accepted" : "access granted through this link");
      await refresh();
    } catch (e) {
      setState("failed");
      setMessage(
        e instanceof Error
          ? e.message
          : "this link could not be used — it may have been revoked, expired, or meant for another account",
      );
    }
  }, [kind, token, refresh]);

  useEffect(() => {
    void run();
  }, [run]);

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-border/20 bg-card/20 p-6 backdrop-blur-sm">
        <div className="mb-3 flex items-center gap-2 text-sm text-foreground">
          {state === "working" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
          {state === "done" && <ShieldCheck className="h-4 w-4 text-primary" />}
          {state === "failed" && <ShieldX className="h-4 w-4 text-destructive" />}
          {kind === "invite" ? "invitation" : "shared link"}
        </div>
        <p className="text-xs text-muted-foreground">{message}</p>
        <div className="mt-5 flex gap-2">
          {state === "done" && artifactId && (
            <button
              onClick={() => onOpen(artifactId)}
              className="rounded-lg border border-primary/40 px-3 py-1.5 text-xs text-primary hover:bg-primary/10"
            >
              open it
            </button>
          )}
          {state === "failed" && (
            <button onClick={() => void run()} className="rounded-lg border border-border/25 px-3 py-1.5 text-xs text-foreground/80 hover:bg-foreground/5">
              try again
            </button>
          )}
          <button onClick={onBack} className="rounded-lg border border-border/25 px-3 py-1.5 text-xs text-foreground/70 hover:bg-foreground/5">
            back
          </button>
        </div>
      </div>
    </div>
  );
};

export default ArtifactJoinView;
