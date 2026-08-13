import { useState, Suspense } from "react";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import Whiteboard from "@/components/whiteboard/Whiteboard";

// DEV-ONLY layout harness: same shell geometry as Dashboard.tsx.
export default function WbLab() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative z-10 flex h-dvh">
      <DashboardSidebar
        conversations={[]}
        activeConversationId=""
        activeView="whiteboard"
        onSelectConversation={() => {}}
        onNewConversation={() => {}}
        onDeleteConversation={() => {}}
        onArchiveConversation={() => {}}
        onRenameConversation={() => {}}
        onTogglePin={() => {}}
        onViewChange={() => {}}
        sidebarOpen={open}
        onToggleSidebar={() => setOpen((v) => !v)}
      />
      <main className="flex-1 min-w-0 overflow-hidden">
        <div className="h-full w-full min-h-0">
          <Suspense fallback={null}><Whiteboard /></Suspense>
        </div>
      </main>
    </div>
  );
}
