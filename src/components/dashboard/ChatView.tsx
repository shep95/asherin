import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Eye, Lock, Copy, Check, ArrowRight, Download, Brain, FileText, GitBranch, ExternalLink, Phone, Zap, Layers, StickyNote, Package, RefreshCw, PanelRight, Blocks, ClipboardList, Share2, Target, AlertTriangle, Gavel, Shield, Palette, Gauge } from "lucide-react";
import OutputFormatMenu from "./OutputFormatMenu";
import DiffView from "./DiffView";
import CitationFootnote from "./CitationFootnote";
import ChatErrorBanner from "./ChatErrorBanner";
import ArtifactCanvas from "./ArtifactCanvas";
import ReusableBlocks from "./ReusableBlocks";
import AnswerControls from "./AnswerControls";
import StructuredInputForms from "./StructuredInputForms";
import ShareWithRedaction from "./ShareWithRedaction";
import TokenCostIndicator from "./TokenCostIndicator";
import GoalLockHeader from "./GoalLockHeader";
import AssumptionTracker from "./AssumptionTracker";
import DecisionLog from "./DecisionLog";
import OutputQAToggles from "./OutputQAToggles";
import DeterminismSlider from "./DeterminismSlider";
import VerificationWorkflow from "./VerificationWorkflow";
import MessageStatusControls from "./MessageStatusControls";
import ThreadReceipt from "./ThreadReceipt";
import PersonalStyleProfile from "./PersonalStyleProfile";
import QualityOfServiceControls, { type QoSMode } from "./QualityOfServiceControls";
import MessageNote from "./MessageNote";
import FloatingNotepad from "./FloatingNotepad";
import ChatSearchBar from "./ChatSearchBar";
import MessageQueuePanel, { type QueueItem } from "./MessageQueuePanel";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useAccess } from "@/hooks/useAccess";
import type { FileAttachment } from "./types";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "react-router-dom";
import type { Conversation, ChatMode, Message } from "./types";
import MessageStatusIndicator from "./MessageStatusIndicator";
import CodeFilePreview from "./CodeFilePreview";
import type { ResponseDepth } from "./DepthSelector";
import ModeSelector from "./ModeSelector";
import DepthSelector from "./DepthSelector";
import ContextHealthIndicator from "./ContextHealthIndicator";
import TruthScore from "./TruthScore";
import FollowUpSuggestions from "./FollowUpSuggestions";
import DecodeView from "./DecodeView";
import ChainOfThoughtPanel from "./ChainOfThoughtPanel";
import CalibrationFeedback from "./CalibrationFeedback";
import type { FeedbackType } from "./CalibrationFeedback";
import AdaptiveInputBar from "./AdaptiveInputBar";
import ScrollIntelligence from "./ScrollIntelligence";
import SmartSelectionMenu from "./SmartSelectionMenu";
import TypingIndicator from "./TypingIndicator";
import { renderLinkPreviews } from "./LinkPreview";
import MessageDiagramPanel from "./MessageDiagramPanel";
import ReasoningToggle, { type ReasoningMode } from "./ReasoningToggle";
import VoiceCallOverlay from "./VoiceCallOverlay";
import NeuralThinkingModal from "./NeuralThinkingModal";
import { useElevenLabsVoice } from "@/hooks/useElevenLabsVoice";
import MultiModelSelector, { type SelectedModel } from "./MultiModelSelector";
import ConsensusMessage from "./ConsensusMessage";
import BrainsManager from "./BrainsManager";
import ConversationApiToggles from "./ConversationApiToggles";

interface ChatViewProps {
  conversation: Conversation;
  onSendMessage: (content: string, attachments?: FileAttachment[]) => void;
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  depth: ResponseDepth;
  onDepthChange: (depth: ResponseDepth) => void;
  isStreaming?: boolean;
  suggestions?: string[];
  onCalibrationFeedback?: (messageId: string, feedback: FeedbackType) => void;
  onStopStreaming?: () => void;
  focusMode?: boolean;
  messageStatuses?: Record<string, import("@/lib/messageQueue").MessageStatus>;
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
}

// Copy button for messages
function MessageCopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 text-[10px] font-light text-muted-foreground/50 hover:text-muted-foreground transition-colors"
      title="Copy message"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// Subscription-gated input wrapper
function SubscriptionGatedInput(props: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop?: () => void;
  onQuickAction?: (action: string, content: string) => void;
  isStreaming: boolean;
  conversationId?: string;
  attachments?: FileAttachment[];
  onAttachmentsChange?: (files: FileAttachment[]) => void;
}) {
  const { subscribed, loading } = useSubscription();
  if (loading) {
    return <AdaptiveInputBar {...props} disabled />;
  }
  if (!subscribed) {
    return (
      <div className="border-t border-border/20 bg-card/30 backdrop-blur-md px-2 sm:px-4 py-3 sm:py-4">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 rounded-xl border border-accent/20 bg-accent/5 px-4 sm:px-5 py-3 sm:py-3.5">
          <div className="flex items-center gap-3">
            <Lock className="h-4 w-4 text-accent shrink-0" />
            <p className="text-xs font-light text-foreground">Subscribe to start messaging Aureon.</p>
          </div>
          <a href="/dashboard" onClick={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent("aureon:navigate", { detail: "subscription" })); }}
            className="group flex items-center gap-1.5 rounded-lg bg-accent text-accent-foreground px-4 py-2 text-xs font-light hover:bg-accent/90 transition-all shrink-0">
            View Plans
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </a>
        </div>
      </div>
    );
  }
  return <AdaptiveInputBar {...props} disabled={false} />;
}

// Helper to parse user messages for code blocks and render as file preview cards
const CODE_BLOCK_RE = /```(\w+)?\n([\s\S]*?)```/g;

function UserMessageContent({ content }: { content: string }) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const regex = new RegExp(CODE_BLOCK_RE);
  let key = 0;

  while ((match = regex.exec(content)) !== null) {
    // Text before the code block
    if (match.index > lastIndex) {
      parts.push(<span key={key++} className="whitespace-pre-wrap">{content.slice(lastIndex, match.index)}</span>);
    }
    parts.push(<CodeFilePreview key={key++} code={match[2].trimEnd()} language={match[1]} />);
    lastIndex = match.index + match[0].length;
  }

  // Remaining text after last code block
  if (lastIndex < content.length) {
    parts.push(<span key={key++} className="whitespace-pre-wrap">{content.slice(lastIndex)}</span>);
  }

  // No code blocks found — check if entire content looks like code
  if (parts.length === 0) {
    const trimmed = content.trim();
    const looksLikeCode = trimmed.split("\n").length >= 3 && (
      /[{};()=>]/.test(trimmed) && /^(import|export|const|let|var|function|def |class |#include|package |fn |pub )/.test(trimmed)
    );
    if (looksLikeCode) {
      return <CodeFilePreview code={trimmed} />;
    }
    return <span className="whitespace-pre-wrap">{content}</span>;
  }

  return <>{parts}</>;
}

// Custom markdown components with copy button on code blocks
function CodeBlockCopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="absolute top-2 right-2 p-1.5 rounded-md bg-foreground/10 hover:bg-foreground/20 text-muted-foreground hover:text-foreground transition-colors"
      title="Copy code"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

// Valid internal routes for the app
const VALID_INTERNAL_PATHS = new Set([
  "/", "/pricing", "/features", "/founder", "/benchmarks", "/dashboard",
  "/terms", "/privacy", "/nda", "/equity", "/prompt-engineering",
  "/feature/zophiel", "/feature/nomad", "/feature/asha", "/feature/briefings",
  "/feature/personas", "/feature/zali", "/feature/predictive", "/feature/elion",
  "/feature/tracker", "/feature/imagine-to-code", "/feature/ide",
  "/feature/imagine-intelligence", "/feature/google-intelligence",
  "/feature/security", "/feature/notebooks", "/feature/vibe-imager",
  "/feature/vibe-video", "/feature/video-intelligence",
]);

function isInternalLink(href: string): string | null {
  try {
    const url = new URL(href);
    const isAureonDomain = url.hostname === "aureon.app" || url.hostname === "www.aureon.app" || url.hostname.endsWith(".lovable.app");
    if (isAureonDomain && VALID_INTERNAL_PATHS.has(url.pathname)) {
      return url.pathname;
    }
  } catch {
    // relative path
    if (href.startsWith("/") && VALID_INTERNAL_PATHS.has(href)) {
      return href;
    }
  }
  return null;
}

function MarkdownLink({ href, children, navigate }: { href?: string; children?: React.ReactNode; navigate: ReturnType<typeof useNavigate> }) {
  if (!href) return <>{children}</>;

  const internalPath = isInternalLink(href);

  if (internalPath) {
    return (
      <button
        onClick={() => navigate(internalPath)}
        className="text-accent hover:text-accent/80 underline underline-offset-2 decoration-accent/40 hover:decoration-accent/70 transition-colors cursor-pointer inline-flex items-center gap-1"
      >
        {children}
      </button>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent hover:text-accent/80 underline underline-offset-2 decoration-accent/40 hover:decoration-accent/70 transition-colors inline-flex items-center gap-1"
    >
      {children}
      <ExternalLink className="h-3 w-3 shrink-0 opacity-50" />
    </a>
  );
}

const createMarkdownComponents = (navigate: ReturnType<typeof useNavigate>) => ({
  pre({ children, ...props }: any) {
    let codeText = "";
    const extractText = (node: any): string => {
      if (typeof node === "string") return node;
      if (node?.props?.children) {
        if (Array.isArray(node.props.children)) return node.props.children.map(extractText).join("");
        return extractText(node.props.children);
      }
      return "";
    };
    codeText = extractText(children);
    return (
      <div className="relative group overflow-hidden">
        <pre className="overflow-x-auto" {...props}>{children}</pre>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <CodeBlockCopyButton code={codeText} />
        </div>
      </div>
    );
  },
  a({ href, children }: any) {
    return <MarkdownLink href={href} navigate={navigate}>{children}</MarkdownLink>;
  },
});

const ChatView = ({ conversation, onSendMessage, mode, onModeChange, depth, onDepthChange, isStreaming, suggestions = [], onCalibrationFeedback, onStopStreaming, focusMode, messageStatuses = {}, queueItems = [], onRemoveFromQueue, onClearQueue, onProcessQueueNow, queuePaused, onToggleQueuePause, personaSystemPrompt, consensusEnabled = false, onConsensusToggle, consensusModels = [], onConsensusModelsChange, storedProviders = [], activeBrainId, onBrainChange }: ChatViewProps) => {
  const navigate = useNavigate();
  const { hasPro } = useAccess();
  const markdownComponents = useMemo(() => createMarkdownComponents(navigate), [navigate]);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [decodeId, setDecodeId] = useState<string | null>(null);
  const [cotId, setCotId] = useState<string | null>(null);
  const [diagramId, setDiagramId] = useState<string | null>(null);
  const [neuralId, setNeuralId] = useState<string | null>(null);
  const [reasoningMode, setReasoningMode] = useState<ReasoningMode>("deep");
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);
  const [searchActive, setSearchActive] = useState(false);
  const [notepadOpen, setNotepadOpen] = useState(false);
  const [formatMenuId, setFormatMenuId] = useState<string | null>(null);
  const [diffState, setDiffState] = useState<{ msgId: string; before: string } | null>(null);
  const [showDiffId, setShowDiffId] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [artifactOpen, setArtifactOpen] = useState(false);
  const [artifactContent, setArtifactContent] = useState("");
  const [previousResponses, setPreviousResponses] = useState<Record<string, string>>({});
  const [blocksOpen, setBlocksOpen] = useState(false);
  const [blockSaveContent, setBlockSaveContent] = useState<string | undefined>();
  const [structuredOpen, setStructuredOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [assumptionsOpen, setAssumptionsOpen] = useState(false);
  const [decisionsOpen, setDecisionsOpen] = useState(false);
  const [qaTogglesOpen, setQaTogglesOpen] = useState(false);
  const [styleProfileOpen, setStyleProfileOpen] = useState(false);
  const [determinism, setDeterminism] = useState(33);
  const [qosMode, setQosMode] = useState<QoSMode>("fast");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Scroll to highlighted message
  useEffect(() => {
    if (highlightedMsgId && messageRefs.current[highlightedMsgId]) {
      messageRefs.current[highlightedMsgId]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightedMsgId]);

  const elevenLabsVoice = useElevenLabsVoice({
    agentId: "agent_1701kjqvrqkpfwat79br17vqbdms",
  });

  const handleSend = () => {
    if (!input.trim() && attachments.length === 0) return;
    onSendMessage(input.trim(), attachments.length > 0 ? attachments : undefined);
    setInput("");
    setAttachments([]);
  };

  const downloadConversation = () => {
    if (!conversation.messages.length) return;
    const lines = conversation.messages.map(m =>
      `**${m.role === "user" ? "You" : "Aureon"}** (${m.timestamp ? new Date(m.timestamp).toLocaleString() : ""}):\n${m.content}`
    );
    const md = `# ${conversation.title}\n\n${lines.join("\n\n---\n\n")}`;
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${conversation.title.replace(/[^a-zA-Z0-9 -]/g, "")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleQuickAction = useCallback((action: string, content: string) => {
    const prompts: Record<string, string> = {
      debug: `Debug this code:\n\`\`\`\n${content}\n\`\`\``,
      explain: `Explain this code line by line:\n\`\`\`\n${content}\n\`\`\``,
      optimize: `Optimize this code:\n\`\`\`\n${content}\n\`\`\``,
      test: `Write tests for this code:\n\`\`\`\n${content}\n\`\`\``,
      summarize: `Summarize the content at: ${content}`,
      "fact-check": `Fact check: ${content}`,
      extract: `Extract key data from: ${content}`,
    };
    const prompt = prompts[action] ?? `${action}: ${content}`;
    onSendMessage(prompt);
    setInput("");
  }, [onSendMessage]);

  const handleSelectionAction = useCallback((action: string, text: string) => {
    if (action === "copy") {
      navigator.clipboard.writeText(text);
      return;
    }
    const prompts: Record<string, string> = {
      expand: `Expand on this: "${text}"`,
      rewrite: `Rewrite this differently: "${text}"`,
      "fact-check": `Fact check this claim: "${text}"`,
      ask: `Tell me more about: "${text}"`,
      explain: `Explain this code:\n\`\`\`\n${text}\n\`\`\``,
      debug: `Debug this code:\n\`\`\`\n${text}\n\`\`\``,
    };
    onSendMessage(prompts[action] ?? `${action}: "${text}"`);
  }, [onSendMessage]);

  const lastMsg = conversation.messages[conversation.messages.length - 1];
  const showSuggestions = lastMsg?.role === "assistant" && !isStreaming && suggestions.length > 0;

    return (
    <div className="flex flex-1 min-w-0 h-full relative overflow-hidden">
      {/* Main chat column */}
      <div className={`flex flex-1 flex-col min-w-0 h-full overflow-hidden ${artifactOpen ? "max-w-[60%]" : ""}`}>
      {/* Floating Notepad */}
      <FloatingNotepad open={notepadOpen} onClose={() => setNotepadOpen(false)} conversationId={conversation.id} />
      {/* Voice Call Overlay */}
      <VoiceCallOverlay
        isConnected={elevenLabsVoice.isConnected}
        isConnecting={elevenLabsVoice.status === "connecting"}
        isSpeaking={elevenLabsVoice.isSpeaking}
        currentText={elevenLabsVoice.currentText}
        transcriptLog={elevenLabsVoice.transcriptLog}
        userSpeechIndicator={elevenLabsVoice.userSpeechIndicator}
        error={elevenLabsVoice.error}
        onDisconnect={elevenLabsVoice.disconnect}
        onDownloadTranscript={elevenLabsVoice.downloadTranscript}
        getInputVolume={elevenLabsVoice.getInputVolume}
        getOutputVolume={elevenLabsVoice.getOutputVolume}
      />

      {/* Top bar — hidden in focus mode */}
      {!focusMode && (
        <div className="flex items-center px-2 sm:px-4 pt-2 sm:pt-4 pb-2 gap-2 sm:gap-3 shrink-0">
          <ModeSelector active={mode} onChange={onModeChange} />
          <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto scrollbar-hide min-w-0 flex-1 py-1">
            {hasPro ? (
              <button
                onClick={elevenLabsVoice.isConnected ? elevenLabsVoice.disconnect : elevenLabsVoice.connect}
                className={`p-1.5 rounded-md transition-colors ${
                  elevenLabsVoice.isConnected
                    ? "text-accent bg-accent/10 hover:bg-accent/20"
                    : "text-muted-foreground/50 hover:text-foreground"
                }`}
                title={elevenLabsVoice.isConnected ? "End voice call" : "Start voice call"}
              >
                <Phone className="h-4 w-4" />
              </button>
            ) : (
              <button
                disabled
                className="p-1.5 rounded-md text-muted-foreground/30 cursor-not-allowed"
                title="Voice calls require Pro ($740/mo)"
              >
                <Phone className="h-4 w-4" />
              </button>
            )}
            {conversation.messages.length > 0 && (
              <button onClick={downloadConversation} className="p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground transition-colors" title="Download conversation">
                <Download className="h-4 w-4" />
              </button>
             )}
            <button
              onClick={() => setNotepadOpen(!notepadOpen)}
              className={`p-1.5 rounded-md transition-colors ${notepadOpen ? "text-amber-500/70 bg-amber-500/10" : "text-muted-foreground/50 hover:text-foreground"}`}
              title="Notepad"
            >
              <StickyNote className="h-4 w-4" />
            </button>
            {onBrainChange && (
              <BrainsManager activeBrainId={activeBrainId ?? null} onBrainChange={onBrainChange} />
            )}
            <ConversationApiToggles conversationId={conversation.id} storedProviders={storedProviders} />
             <ChatSearchBar
               messages={conversation.messages}
               onHighlightMessage={setHighlightedMsgId}
               onSearchActive={setSearchActive}
             />
            <ContextHealthIndicator messageCount={conversation.messages.length} />
            <ReasoningToggle mode={reasoningMode} onChange={setReasoningMode} />
            <DepthSelector active={depth} onChange={onDepthChange} />
            <DeterminismSlider value={determinism} onChange={setDeterminism} />
            <QualityOfServiceControls mode={qosMode} onChange={setQosMode} />
            {/* Assumption Tracker */}
              <div className="relative shrink-0">
              <button
                onClick={() => setAssumptionsOpen(!assumptionsOpen)}
                className={`p-1.5 rounded-md transition-colors ${assumptionsOpen ? "text-amber-500/70 bg-amber-500/10" : "text-muted-foreground/50 hover:text-foreground"}`}
                title="Assumptions"
              >
                <AlertTriangle className="h-4 w-4" />
              </button>
              <AssumptionTracker
                conversationId={conversation.id}
                open={assumptionsOpen}
                onClose={() => setAssumptionsOpen(false)}
                onRequestReAnswer={(assumptions) => {
                  const active = assumptions.filter(a => a.active).map(a => a.text);
                  const inactive = assumptions.filter(a => !a.active).map(a => a.text);
                  let prompt = "Re-evaluate your last answer with these updated assumptions:\n";
                  if (active.length) prompt += `\nActive assumptions:\n${active.map(a => `- ${a}`).join("\n")}`;
                  if (inactive.length) prompt += `\nRemoved assumptions:\n${inactive.map(a => `- ~~${a}~~`).join("\n")}`;
                  onSendMessage(prompt);
                  setAssumptionsOpen(false);
                }}
              />
            </div>
            {/* Decision Log */}
              <div className="relative shrink-0">
              <button
                onClick={() => setDecisionsOpen(!decisionsOpen)}
                className={`p-1.5 rounded-md transition-colors ${decisionsOpen ? "text-accent bg-accent/10" : "text-muted-foreground/50 hover:text-foreground"}`}
                title="Decision Log"
              >
                <Gavel className="h-4 w-4" />
              </button>
              <DecisionLog conversationId={conversation.id} open={decisionsOpen} onClose={() => setDecisionsOpen(false)} />
            </div>
            {/* Output QA Toggles */}
              <div className="relative shrink-0">
              <button
                onClick={() => setQaTogglesOpen(!qaTogglesOpen)}
                className={`p-1.5 rounded-md transition-colors ${qaTogglesOpen ? "text-accent bg-accent/10" : "text-muted-foreground/50 hover:text-foreground"}`}
                title="Output QA Controls"
              >
                <Shield className="h-4 w-4" />
              </button>
              <OutputQAToggles conversationId={conversation.id} open={qaTogglesOpen} onClose={() => setQaTogglesOpen(false)} />
            </div>
            {/* Personal Style Profile */}
              <div className="relative shrink-0">
              <button
                onClick={() => setStyleProfileOpen(!styleProfileOpen)}
                className={`p-1.5 rounded-md transition-colors ${styleProfileOpen ? "text-accent bg-accent/10" : "text-muted-foreground/50 hover:text-foreground"}`}
                title="Writing Style"
              >
                <Palette className="h-4 w-4" />
              </button>
              <PersonalStyleProfile open={styleProfileOpen} onClose={() => setStyleProfileOpen(false)} />
            </div>
            {onConsensusToggle && onConsensusModelsChange && (
              <MultiModelSelector
                enabled={consensusEnabled}
                onToggle={onConsensusToggle}
                selectedModels={consensusModels}
                onModelsChange={onConsensusModelsChange}
                storedProviders={storedProviders}
              />
            )}
          </div>
        </div>
      )}

      {/* Goal Lock Header */}
      <GoalLockHeader conversationId={conversation.id} />

      {/* Messages */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-2 sm:px-4 pb-4 relative min-h-0">
        {conversation.messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center max-w-md animate-fade-in">
               <h1 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-3">
                How can I help?
              </h1>
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Lock className="h-3 w-3 text-emerald-500/70" />
                <span className="text-xs font-extralight text-emerald-500/70">End-to-end encrypted</span>
              </div>
              <p className="text-sm font-extralight text-muted-foreground">
                Your messages are encrypted before leaving your device.
              </p>
            </div>
          </div>
        ) : (
          <div ref={messagesRef} className="relative mx-auto max-w-3xl space-y-3 sm:space-y-4 py-4">
            {/* Error banner */}
            {chatError && (
              <ChatErrorBanner
                error={chatError}
                onRetry={() => {
                  setChatError(null);
                  const lastUserMsg = [...conversation.messages].reverse().find(m => m.role === "user");
                  if (lastUserMsg) onSendMessage(lastUserMsg.content);
                }}
                onFallback={() => setChatError(null)}
                onDismiss={() => setChatError(null)}
              />
            )}
            <SmartSelectionMenu containerRef={messagesRef} onAction={handleSelectionAction} />
            {conversation.messages.map((msg, idx) => (
              <div
                key={msg.id}
                ref={(el) => { messageRefs.current[msg.id] = el; }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-slide-up transition-all duration-300 ${highlightedMsgId === msg.id ? "ring-1 ring-accent/50 rounded-2xl bg-accent/5" : ""}`}
                style={{ animationDelay: `${Math.min(idx * 30, 150)}ms`, animationFillMode: "backwards" }}
              >
                <div className="max-w-[95%] sm:max-w-[80%]">
                  <div
                    className={`rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 text-[13px] sm:text-sm font-light leading-relaxed transition-all ${
                      msg.role === "user"
                        ? "bg-foreground/15 text-foreground backdrop-blur-sm border border-border/20"
                        : "bg-card/50 text-foreground backdrop-blur-md border border-border/20"
                    }`}
                  >
                    {msg.role === "assistant" && !msg.content && isStreaming && msg === lastMsg ? (
                      <TypingIndicator mode="thinking" />
                    ) : msg.role === "assistant" && msg.consensusData ? (
                      <ConsensusMessage data={msg.consensusData} />
                    ) : msg.role === "assistant" ? (
                      <div className="prose prose-sm prose-invert max-w-none overflow-hidden [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:my-0.5 [&_code]:text-accent [&_code]:bg-secondary/50 [&_code]:px-1 [&_code]:rounded [&_pre]:bg-secondary/50 [&_pre]:rounded-lg [&_pre]:p-3 [&_blockquote]:border-accent/50 [&_blockquote]:text-muted-foreground [&_strong]:text-foreground [&_hr]:border-border/30">
                        <ReactMarkdown components={markdownComponents}>{msg.content}</ReactMarkdown>
                        {isStreaming && msg === lastMsg && (
                          <span className="inline-block w-0.5 h-4 bg-foreground/60 animate-pulse ml-0.5 align-text-bottom" />
                        )}
                        {renderLinkPreviews(msg.content)}
                      </div>
                    ) : (
                      <>
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-2">
                            {msg.attachments.map((att, aidx) => (
                              <div key={aidx} className="rounded-lg overflow-hidden border border-border/20">
                                {att.type.startsWith("image/") && att.previewUrl ? (
                                  <img src={att.previewUrl} alt={att.name} className="max-w-[200px] max-h-[150px] object-cover rounded-lg" />
                                ) : (
                                  <div className="flex items-center gap-2 px-3 py-2 bg-secondary/30 text-xs text-muted-foreground">
                                    <FileText className="h-4 w-4" />
                                    <span className="truncate max-w-[150px]">{att.name}</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        <UserMessageContent content={msg.content} />
                        {renderLinkPreviews(msg.content)}
                      </>
                    )}
                  </div>
                  {/* Action bar for both message types */}
                  {msg.content && !isStreaming && (
                    <div className="flex items-center gap-1.5 sm:gap-2 mt-1.5 px-1 flex-wrap animate-fade-in">
                      {msg.role === "user" && (
                        <MessageStatusIndicator status={messageStatuses[msg.id]} />
                      )}
                      <MessageCopyButton text={msg.content} />
                      <MessageNote messageId={msg.id} />
                      <MessageStatusControls messageId={msg.id} />
                      {msg.role === "assistant" && (
                        <>
                          <TruthScore score={msg.truthScore ?? "medium"} sources={msg.sources} />
                          <button
                            onClick={() => setCotId(cotId === msg.id ? null : msg.id)}
                            className="flex items-center gap-1 text-[10px] font-light text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                          >
                            <Brain className="h-3 w-3" />
                            Show Work
                          </button>
                          <button
                            onClick={() => setDecodeId(decodeId === msg.id ? null : msg.id)}
                            className="flex items-center gap-1 text-[10px] font-light text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                          >
                            <Eye className="h-3 w-3" />
                            Decode
                          </button>
                          <button
                            onClick={() => setDiagramId(diagramId === msg.id ? null : msg.id)}
                            className="flex items-center gap-1 text-[10px] font-light text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                          >
                            <GitBranch className="h-3 w-3" />
                            Diagram
                          </button>
                          <button
                            onClick={() => setNeuralId(msg.id)}
                            className="flex items-center gap-1 text-[10px] font-light text-accent/50 hover:text-accent transition-colors"
                          >
                            <Zap className="h-3 w-3" />
                            Show Thinking
                          </button>
                          {/* Export As */}
                          <div className="relative">
                            <button
                              onClick={() => setFormatMenuId(formatMenuId === msg.id ? null : msg.id)}
                              className="flex items-center gap-1 text-[10px] font-light text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                            >
                              <Package className="h-3 w-3" />
                              Export As
                            </button>
                            {formatMenuId === msg.id && (
                              <OutputFormatMenu content={msg.content} onClose={() => setFormatMenuId(null)} />
                            )}
                          </div>
                          {/* Regenerate with diff tracking */}
                          <button
                            onClick={() => {
                              setPreviousResponses(prev => ({ ...prev, [msg.id]: msg.content }));
                              // Find the user message before this one to regenerate
                              const userMsg = conversation.messages.slice(0, conversation.messages.indexOf(msg)).reverse().find(m => m.role === "user");
                              if (userMsg) onSendMessage(userMsg.content);
                            }}
                            className="flex items-center gap-1 text-[10px] font-light text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                          >
                            <RefreshCw className="h-3 w-3" />
                            Regenerate
                          </button>
                          {/* Show diff if previous version exists */}
                          {previousResponses[msg.id] && previousResponses[msg.id] !== msg.content && (
                            <button
                              onClick={() => setShowDiffId(showDiffId === msg.id ? null : msg.id)}
                              className="flex items-center gap-1 text-[10px] font-light text-amber-500/60 hover:text-amber-500 transition-colors"
                            >
                              <GitBranch className="h-3 w-3" />
                              View Diff
                            </button>
                          )}
                          {/* Open in Canvas */}
                          <button
                            onClick={() => { setArtifactContent(msg.content); setArtifactOpen(true); }}
                            className="flex items-center gap-1 text-[10px] font-light text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                          >
                            <PanelRight className="h-3 w-3" />
                          Canvas
                          </button>
                          {/* Save as Block */}
                          <button
                            onClick={() => { setBlockSaveContent(msg.content); setBlocksOpen(true); }}
                            className="flex items-center gap-1 text-[10px] font-light text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                          >
                            <Blocks className="h-3 w-3" />
                            Save Block
                          </button>
                          {/* Share with Redaction */}
                          <button
                            onClick={() => setShareOpen(true)}
                            className="flex items-center gap-1 text-[10px] font-light text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                          >
                            <Share2 className="h-3 w-3" />
                            Share
                          </button>
                          <CalibrationFeedback
                            messageId={msg.id}
                            onFeedback={onCalibrationFeedback ?? (() => {})}
                          />
                          {/* Answer Controls */}
                          <AnswerControls
                            onAction={(action) => {
                              const prompts: Record<string, string> = {
                                "shorter": `Make this response shorter and more concise:\n\n${msg.content.slice(0, 500)}`,
                                "longer": `Expand on this response with more detail:\n\n${msg.content.slice(0, 500)}`,
                                "examples": `Add practical examples to this response:\n\n${msg.content.slice(0, 500)}`,
                                "edge-cases": `Add edge cases and exceptions to consider:\n\n${msg.content.slice(0, 500)}`,
                                "sources": `Add sources and references to support this:\n\n${msg.content.slice(0, 500)}`,
                                "deliverable": `Turn this into a polished, professional deliverable with clear headings, structure, and action items:\n\n${msg.content}`,
                              };
                              if (prompts[action]) onSendMessage(prompts[action]);
                            }}
                          />
                          {/* Token cost indicator */}
                          <TokenCostIndicator
                            tokenCount={Math.round(msg.content.length / 4)}
                            usedSearch={msg.sources && msg.sources.length > 0}
                            usedFiles={msg.attachments && msg.attachments.length > 0}
                          />
                          {/* Verification Workflow */}
                          <VerificationWorkflow
                            content={msg.content}
                            onVerify={(prompt) => onSendMessage(prompt)}
                          />
                          {/* Thread Receipt */}
                          <ThreadReceipt
                            memoriesUsed={0}
                            filesUsed={msg.attachments?.map(a => a.name)}
                            timestamp={msg.timestamp}
                          />
                        </>
                      )}
                    </div>
                  )}
                  {msg.role === "assistant" && cotId === msg.id && (
                    <ChainOfThoughtPanel
                      open={true}
                      content={msg.content}
                      query={conversation.messages.find((m, i) => i < conversation.messages.indexOf(msg) && m.role === "user")?.content}
                    />
                  )}
                  {msg.role === "assistant" && decodeId === msg.id && <DecodeView open={true} content={msg.content} />}
                  {msg.role === "assistant" && diagramId === msg.id && (
                    <MessageDiagramPanel
                      open={true}
                      content={msg.content}
                      onClose={() => setDiagramId(null)}
                    />
                  )}
                  {msg.role === "assistant" && neuralId === msg.id && (
                    <NeuralThinkingModal
                      open={true}
                      query={conversation.messages.find((m, i) => i < conversation.messages.indexOf(msg) && m.role === "user")?.content || ""}
                      response={msg.content}
                      onClose={() => setNeuralId(null)}
                    />
                  )}
                  {/* Diff view for regenerated responses */}
                  {msg.role === "assistant" && showDiffId === msg.id && previousResponses[msg.id] && (
                    <DiffView
                      before={previousResponses[msg.id]}
                      after={msg.content}
                      open={true}
                      onClose={() => setShowDiffId(null)}
                    />
                  )}
                  {/* Citation footnotes */}
                  {msg.role === "assistant" && msg.sources && msg.sources.length > 0 && (
                    <CitationFootnote
                      sources={msg.sources.map((s, i) => ({
                        ...s,
                        tier: i === 0 ? "primary" as const : i < 3 ? "secondary" as const : "tertiary" as const,
                        credibility: Math.max(40, 95 - i * 12),
                      }))}
                    />
                  )}
                </div>
              </div>
            ))}
            {showSuggestions && (
              <FollowUpSuggestions suggestions={suggestions} onSelect={(s) => onSendMessage(s)} />
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
        <ScrollIntelligence
          containerRef={scrollContainerRef}
          isStreaming={!!isStreaming}
          messagesEndRef={messagesEndRef}
        />
      </div>

      {/* Message Queue Panel */}
      <MessageQueuePanel
        items={queueItems}
        onRemove={onRemoveFromQueue ?? (() => {})}
        onClear={onClearQueue ?? (() => {})}
        onProcessNow={onProcessQueueNow}
        paused={queuePaused}
        onTogglePause={onToggleQueuePause}
      />

      {/* Toolbar: Blocks + Structured Input */}
      <div className="relative flex items-center gap-2 px-2 sm:px-4 py-1.5 border-t border-border/10 shrink-0 overflow-x-auto scrollbar-hide">
        <div className="relative">
          <button
            onClick={() => setBlocksOpen(!blocksOpen)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-light text-muted-foreground/50 hover:text-foreground hover:bg-foreground/5 transition-colors"
          >
            <Blocks className="h-3 w-3" />
            Blocks
          </button>
          <ReusableBlocks
            open={blocksOpen}
            onClose={() => { setBlocksOpen(false); setBlockSaveContent(undefined); }}
            onInsert={(content) => setInput(prev => prev + content)}
            contentToSave={blockSaveContent}
          />
        </div>
        <div className="relative">
          <button
            onClick={() => setStructuredOpen(!structuredOpen)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-light text-muted-foreground/50 hover:text-foreground hover:bg-foreground/5 transition-colors"
          >
            <ClipboardList className="h-3 w-3" />
            Forms
          </button>
          <StructuredInputForms
            open={structuredOpen}
            onClose={() => setStructuredOpen(false)}
            onSubmit={(prompt) => onSendMessage(prompt)}
          />
        </div>
      </div>

      {/* Adaptive Input — gated behind subscription */}
      <SubscriptionGatedInput
        value={input}
        onChange={setInput}
        onSend={handleSend}
        onStop={onStopStreaming}
        onQuickAction={handleQuickAction}
        isStreaming={!!isStreaming}
        conversationId={conversation.id}
        attachments={attachments}
        onAttachmentsChange={setAttachments}
      />

      {/* Share with Redaction modal */}
      <ShareWithRedaction
        messages={conversation.messages}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
      />
      </div>
      {/* Artifact Canvas - right panel */}
      {artifactOpen && (
        <ArtifactCanvas
          open={artifactOpen}
          onClose={() => setArtifactOpen(false)}
          initialContent={artifactContent}
        />
      )}
    </div>
  );
};

export default ChatView;
