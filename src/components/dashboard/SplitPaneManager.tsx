import { useState, useCallback } from "react";
import { X, Columns2, Columns3, Grid2x2, GripVertical } from "lucide-react";
import type { Conversation, ChatMode, Message, FileAttachment } from "./types";
import type { ResponseDepth } from "./DepthSelector";
import type { SelectedModel } from "./MultiModelSelector";
import type { QueueItem } from "./MessageQueuePanel";
import type { FeedbackType } from "./CalibrationFeedback";
import type { MessageStatus } from "@/lib/messageQueue";
import ChatView from "./ChatView";

export interface SplitPane {
  id: string;
  conversationId: string;
}

interface SplitPaneManagerProps {
  panes: SplitPane[];
  conversations: Conversation[];
  onRemovePane: (paneId: string) => void;
  onSendMessage: (content: string, convId: string, attachments?: FileAttachment[]) => void;
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  depth: ResponseDepth;
  onDepthChange: (depth: ResponseDepth) => void;
  isStreaming?: boolean;
  suggestions?: string[];
  onCalibrationFeedback?: (messageId: string, feedback: FeedbackType) => void;
  onStopStreaming?: () => void;
  focusMode?: boolean;
  messageStatuses?: Record<string, MessageStatus>;
  queueItems?: QueueItem[];
  onRemoveFromQueue?: (id: string) => void;
  onClearQueue?: () => void;
  onProcessQueueNow?: () => void;
  queuePaused?: boolean;
  onToggleQueuePause?: () => void;
  personaSystemPrompt?: string | null;
  consensusEnabled?: boolean;
  onConsensusToggle?: (enabled: boolean) => void;
  consensusModels?: SelectedModel[];
  onConsensusModelsChange?: (models: SelectedModel[]) => void;
  storedProviders?: string[];
  activeBrainId?: string | null;
  onBrainChange?: (brainId: string | null) => void;
  // Drop zone
  onDropConversation: (convId: string) => void;
  isDraggingConvo: boolean;
}

const SplitPaneManager = ({
  panes,
  conversations,
  onRemovePane,
  onSendMessage,
  mode,
  onModeChange,
  depth,
  onDepthChange,
  isStreaming,
  suggestions,
  onCalibrationFeedback,
  onStopStreaming,
  focusMode,
  messageStatuses,
  queueItems,
  onRemoveFromQueue,
  onClearQueue,
  onProcessQueueNow,
  queuePaused,
  onToggleQueuePause,
  personaSystemPrompt,
  consensusEnabled,
  onConsensusToggle,
  consensusModels,
  onConsensusModelsChange,
  storedProviders,
  activeBrainId,
  onBrainChange,
  onDropConversation,
  isDraggingConvo,
}: SplitPaneManagerProps) => {
  const [dragOverDrop, setDragOverDrop] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDragOverDrop(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverDrop(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOverDrop(false);
    const convId = e.dataTransfer.getData("text/aureon-conversation-id");
    if (convId) onDropConversation(convId);
  }, [onDropConversation]);

  const gridClass = panes.length <= 2
    ? "grid-cols-2"
    : panes.length === 3
      ? "grid-cols-3"
      : "grid-cols-2 grid-rows-2";

  return (
    <div className="flex flex-1 min-w-0 min-h-0 h-full">
      <div className={`grid ${gridClass} flex-1 gap-0.5`}>
        {panes.map((pane) => {
          const conv = conversations.find(c => c.id === pane.conversationId);
          if (!conv) return null;
          return (
            <div key={pane.id} className="relative flex flex-col min-w-0 min-h-0 overflow-hidden border-r border-border/10 last:border-r-0">
              {/* Pane close header */}
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/15 bg-card/30 backdrop-blur-sm shrink-0">
                <span className="text-[10px] font-light text-muted-foreground/60 truncate max-w-[200px]">
                  {conv.title}
                </span>
                <button
                  onClick={() => onRemovePane(pane.id)}
                  className="p-0.5 rounded text-muted-foreground/40 hover:text-foreground transition-colors"
                  title="Close pane"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">
                <ChatView
                  conversation={conv}
                  onSendMessage={(content, attachments) => onSendMessage(content, pane.conversationId, attachments)}
                  mode={mode}
                  onModeChange={onModeChange}
                  depth={depth}
                  onDepthChange={onDepthChange}
                  isStreaming={isStreaming}
                  suggestions={[]}
                  onCalibrationFeedback={onCalibrationFeedback}
                  onStopStreaming={onStopStreaming}
                  focusMode={focusMode}
                  messageStatuses={messageStatuses}
                  queueItems={[]}
                  personaSystemPrompt={personaSystemPrompt}
                  storedProviders={storedProviders}
                  activeBrainId={activeBrainId}
                  onBrainChange={onBrainChange}
                />
              </div>
            </div>
          );
        })}

        {/* Drop zone for adding new panes (visible when dragging + under limit) */}
        {isDraggingConvo && panes.length < 4 && (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex items-center justify-center border-2 border-dashed rounded-xl m-2 transition-all ${
              dragOverDrop
                ? "border-foreground/40 bg-foreground/5"
                : "border-border/30 bg-card/10"
            }`}
          >
            <div className="text-center space-y-2">
              <Grid2x2 className={`h-6 w-6 mx-auto transition-colors ${
                dragOverDrop ? "text-foreground/60" : "text-muted-foreground/30"
              }`} />
              <p className={`text-[10px] font-light transition-colors ${
                dragOverDrop ? "text-foreground/60" : "text-muted-foreground/30"
              }`}>
                Drop here to add pane
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SplitPaneManager;
