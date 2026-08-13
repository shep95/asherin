import { useState } from "react";
import DashboardSidebarV2 from "@/components/dashboard/DashboardSidebarV2";
import type { Conversation, DashboardView } from "@/components/dashboard/types";

const convos = [
  { id: "a", title: "port of long beach cargo delay", messages: [], createdAt: Date.now(), updatedAt: Date.now(), pinned: true },
  { id: "b", title: "who owns 4210 wilshire blvd", messages: [], createdAt: Date.now(), updatedAt: Date.now() - 90000000 },
] as unknown as Conversation[];

export default function UiProbe() {
  const [view, setView] = useState<DashboardView>("chat");
  const [open, setOpen] = useState(true);
  return (
    <div className="flex h-dvh w-full bg-background">
      <DashboardSidebarV2
        conversations={convos}
        activeConversationId="a"
        activeView={view}
        onSelectConversation={() => {}}
        onNewConversation={() => {}}
        onDeleteConversation={() => {}}
        onArchiveConversation={() => {}}
        onRenameConversation={() => {}}
        onTogglePin={() => {}}
        onViewChange={setView}
        sidebarOpen={open}
        onToggleSidebar={() => setOpen(!open)}
        publishedAgents={[]}
      />
      <main className="flex-1 p-8 text-sm text-muted-foreground">view: {view}</main>
    </div>
  );
}
