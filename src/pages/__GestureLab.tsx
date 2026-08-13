import { useState } from "react";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";

// DEV-ONLY harness for verifying the drawer gesture. Not routed in production.
export default function GestureLab() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex h-dvh w-full bg-background">
      <DashboardSidebar
        conversations={[]}
        activeConversationId=""
        activeView="chat"
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
      <main className="flex-1" data-open={open ? "1" : "0"} />
    </div>
  );
}
