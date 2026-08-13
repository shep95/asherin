import { useState } from "react";
import IdeCodeEditor from "@/components/dashboard/ide/IdeCodeEditor";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import type { IdeFile } from "@/components/dashboard/ide/IdeFileTree";

const file: IdeFile = { id: "f1", name: "app.ts", type: "file", content: "export const x = 1;\n" } as IdeFile;

export default function IdeProbe() {
  const { toast } = useToast();
  const [canWrite, setCanWrite] = useState(false);
  return (
    <div className="h-dvh flex flex-col bg-background">
      <button data-testid="mode" onClick={() => setCanWrite(!canWrite)} className="p-2 text-xs text-foreground">
        mode: {canWrite ? "agent" : "chat"}
      </button>
      <div className="flex-1">
        <IdeCodeEditor
          openFiles={[file]}
          activeFileId="f1"
          onSelectTab={() => {}}
          onCloseTab={() => {}}
          onContentChange={() => {}}
          canWrite={canWrite}
          onWriteBlocked={(reason) => toast({ title: "Chat mode is read-only", description: reason })}
        />
      </div>
      <Toaster />
    </div>
  );
}
