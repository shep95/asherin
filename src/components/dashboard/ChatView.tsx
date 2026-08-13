import { useState, useRef, useEffect, useCallback, useMemo, forwardRef, Suspense } from "react";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { Link } from "react-router-dom";

import { Eye, Lock, Copy, Check, Download, Brain, FileText, GitBranch, ExternalLink, Phone, Zap, Layers, StickyNote, Package, RefreshCw, PanelRight, Blocks, ClipboardList, Share2, Target, AlertTriangle, Gavel, Shield, Palette, Gauge, MoreHorizontal, X, ZoomIn } from "lucide-react";
import ConversationBranches, { getActiveBranch, getBranches, getMessageBranch, setActiveBranchStorage, tagMessageBranch } from "./ConversationBranches";
import OutputFormatMenu from "./OutputFormatMenu";
import DiffView from "./DiffView";
import CitationFootnote from "./CitationFootnote";
import ChatErrorBanner from "./ChatErrorBanner";
const ArtifactCanvas = lazyWithRetry(() => import("./ArtifactCanvas"));
const ReusableBlocks = lazyWithRetry(() => import("./ReusableBlocks"));
import AnswerControls from "./AnswerControls";
const StructuredInputForms = lazyWithRetry(() => import("./StructuredInputForms"));
const ShareWithRedaction = lazyWithRetry(() => import("./ShareWithRedaction"));
import TokenCostIndicator from "./TokenCostIndicator";
import GoalLockHeader from "./GoalLockHeader";
import AssumptionTracker from "./AssumptionTracker";
import DecisionLog from "./DecisionLog";
import OutputQAToggles from "./OutputQAToggles";
import DeterminismSlider from "./DeterminismSlider";
import VerificationWorkflow from "./VerificationWorkflow";
import MessageStatusControls from "./MessageStatusControls";
import ThreadReceipt from "./ThreadReceipt";
const PersonalStyleProfile = lazyWithRetry(() => import("./PersonalStyleProfile"));
import QualityOfServiceControls, { type QoSMode } from "./QualityOfServiceControls";
import MessageNote from "./MessageNote";
const FloatingNotepad = lazyWithRetry(() => import("./FloatingNotepad"));
import ChatSearchBar from "./ChatSearchBar";
import MessageQueuePanel, { type QueueItem } from "./MessageQueuePanel";
import { useAccess } from "@/hooks/useAccess";
import type { FileAttachment } from "./types";
import ReactMarkdown from "react-markdown";
import { parseChatCards } from "@/lib/chatCards/parseChatCards";
import ChatCardRenderer from "@/components/chatCards/ChatCardRenderer";
import { INTEL_SELECT_EVENT } from "@/components/chatCards/CandidatesCard";
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
const DecodeView = lazyWithRetry(() => import("./DecodeView"));
const ChainOfThoughtPanel = lazyWithRetry(() => import("./ChainOfThoughtPanel"));
import CalibrationFeedback from "./CalibrationFeedback";
import type { FeedbackType } from "./CalibrationFeedback";
import AdaptiveInputBar from "./AdaptiveInputBar";
import ScrollIntelligence from "./ScrollIntelligence";
import StickyQuestionHeader from "./StickyQuestionHeader";
import SmartSelectionMenu from "./SmartSelectionMenu";
import TypingIndicator from "./TypingIndicator";
import ThinkingPanel, { ThinkingPanelOrDots } from "./ThinkingPanel";
import PropertyMapCard, { type PropertyMapCardData } from "@/components/dashboard/property/PropertyMapCard";
import { detectAddresses, geocodeAddress } from "@/lib/propertyIntent";
import { renderLinkPreviews } from "./LinkPreview";
const MessageDiagramPanel = lazyWithRetry(() => import("./MessageDiagramPanel"));
import ReasoningToggle, { type ReasoningMode } from "./ReasoningToggle";
const VoiceCallOverlay = lazyWithRetry(() => import("./VoiceCallOverlay"));
const NeuralThinkingModal = lazyWithRetry(() => import("./NeuralThinkingModal"));
import { useElevenLabsVoice } from "@/hooks/useElevenLabsVoice";
const MultiModelSelector = lazyWithRetry(() => import("./MultiModelSelector"));
import type { SelectedModel } from "./MultiModelSelector";
const ConsensusMessage = lazyWithRetry(() => import("./ConsensusMessage"));
const BrainsManager = lazyWithRetry(() => import("./BrainsManager"));
import ConversationApiToggles from "./ConversationApiToggles";
import NumberedFormatToggle from "./NumberedFormatToggle";
import TradingProofButton from "./TradingProofButton";

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
import type { AdaptiveInputBarHandle } from "./AdaptiveInputBar";
import IntelReportCard from "./chat/IntelReportCard";
import { wantsIntelReportFile } from "@/lib/intelligenceReport";



const SubscriptionGatedInput = forwardRef<AdaptiveInputBarHandle, {
  onSendMessage: (content: string, attachments?: FileAttachment[]) => void;
  onStop?: () => void;
  onQuickAction?: (action: string, content: string) => void;
  isStreaming: boolean;
  conversationId?: string;
}>((props, ref) => {
  // Free dashboard users are allowed to message through Aureon Algorithm.
  // The backend owns the 10 messages / 2 hours quota and only blocks after it is exhausted.
  return <AdaptiveInputBar ref={ref} {...props} disabled={false} />;
});

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
  "/terms", "/privacy", "/nda", "/prompt-engineering",
  "/feature/zophiel", "/feature/nomad", "/feature/azplen", "/feature/briefings",
  "/feature/personas", "/feature/zali", "/feature/predictive", "/feature/elion",
  "/feature/tracker", "/feature/ide",
  "/feature/imagine-intelligence", "/feature/google-intelligence",
  "/feature/security", "/feature/notebooks",
  "/feature/video-intelligence",
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
  table({ children, ...props }: any) {
    return (
      <div className="my-3 overflow-x-auto rounded-lg border border-border/20">
        <table className="w-full text-[12px] sm:text-[13px]" {...props}>{children}</table>
      </div>
    );
  },
  thead({ children, ...props }: any) {
    return <thead className="bg-foreground/5 border-b border-border/20" {...props}>{children}</thead>;
  },
  th({ children, ...props }: any) {
    return <th className="px-3 py-2 text-left font-medium text-foreground/80 text-[11px] uppercase tracking-wider" {...props}>{children}</th>;
  },
  td({ children, ...props }: any) {
    return <td className="px-3 py-2 border-t border-border/10 text-muted-foreground" {...props}>{children}</td>;
  },
  tr({ children, ...props }: any) {
    return <tr className="hover:bg-foreground/[0.02] transition-colors" {...props}>{children}</tr>;
  },
  h1({ children, ...props }: any) {
    return <h1 className="text-lg font-semibold text-foreground mt-4 mb-2 pb-1 border-b border-border/20" {...props}>{children}</h1>;
  },
  h2({ children, ...props }: any) {
    return <h2 className="text-base font-semibold text-foreground mt-3 mb-1.5" {...props}>{children}</h2>;
  },
  h3({ children, ...props }: any) {
    return <h3 className="text-sm font-medium text-foreground/90 mt-2 mb-1" {...props}>{children}</h3>;
  },
  h4({ children, ...props }: any) {
    return <h4 className="text-[13px] font-medium text-foreground/80 mt-2 mb-1" {...props}>{children}</h4>;
  },
  ul({ children, ...props }: any) {
    return <ul className="list-disc list-inside space-y-0.5 text-muted-foreground" {...props}>{children}</ul>;
  },
  ol({ children, ...props }: any) {
    return <ol className="list-decimal list-inside space-y-0.5 text-muted-foreground" {...props}>{children}</ol>;
  },
  li({ children, ...props }: any) {
    return <li className="text-[13px] leading-relaxed" {...props}>{children}</li>;
  },
  blockquote({ children, ...props }: any) {
    return (
      <blockquote className="border-l-2 border-accent/40 pl-3 py-1 my-2 text-muted-foreground/80 italic text-[13px]" {...props}>
        {children}
      </blockquote>
    );
  },
  hr({ ...props }: any) {
    return <hr className="my-3 border-border/20" {...props} />;
  },
  img({ src, alt, ...props }: any) {
    const hasAlt = typeof alt === "string" && alt.trim().length > 0;
    return (
      <span className="relative inline-block group cursor-pointer" onClick={() => (window as any).__aureonLightbox?.(src)}>
        <img
          src={src}
          alt={hasAlt ? alt : ""}
          role={hasAlt ? undefined : "presentation"}
          className="rounded-xl border border-border/20 max-w-full my-3 shadow-lg transition-transform hover:scale-[1.02]"
          style={{ maxHeight: "500px", objectFit: "contain" }}
          loading="lazy"
          {...props}
        />
        <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded-xl">
          <ZoomIn className="h-6 w-6 text-white drop-shadow-lg" />
        </span>
      </span>
    );
  },
});

const ChatView = ({ conversation, onSendMessage, mode, onModeChange, depth, onDepthChange, isStreaming, suggestions = [], onCalibrationFeedback, onStopStreaming, focusMode, messageStatuses = {}, queueItems = [], onRemoveFromQueue, onClearQueue, onProcessQueueNow, queuePaused, onToggleQueuePause, consensusEnabled = false, onConsensusToggle, consensusModels = [], onConsensusModelsChange, storedProviders = [], activeBrainId, onBrainChange }: ChatViewProps) => {
  const navigate = useNavigate();
  const { hasPro } = useAccess();
  const markdownComponents = useMemo(() => createMarkdownComponents(navigate), [navigate]);
  const inputBarRef = useRef<AdaptiveInputBarHandle>(null);
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
  const [artifactKey, setArtifactKey] = useState<string | undefined>(undefined);
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
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);

  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [activeBranch, setActiveBranch] = useState<string>(() => getActiveBranch(conversation.id));
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Reset branch when conversation changes and recover from invalid/deleted branch ids
  useEffect(() => {
    const availableBranches = getBranches(conversation.id);
    const storedBranch = getActiveBranch(conversation.id);
    const branchExists = availableBranches.some((branch) => branch.id === storedBranch);
    const nextBranch = branchExists ? storedBranch : "main";

    if (!branchExists) {
      setActiveBranchStorage(conversation.id, nextBranch);
    }

    setActiveBranch(nextBranch);
  }, [conversation.id]);

  // Filter messages by active branch
  const branchMessages = useMemo(() => {
    return conversation.messages.filter(m => {
      const mb = getMessageBranch(m.id);
      if (activeBranch === "main") {
        return mb === "main";
      }
      return mb === activeBranch;
    });
  }, [conversation.messages, activeBranch]);

  // Auto-scroll to bottom when conversation changes (opening a conversation)
  useEffect(() => {
    if (conversation.messages.length > 0) {
      // Small delay to let DOM render
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
      });
    }
  }, [conversation.id]);

  // Scroll to highlighted message (with retries — the target may not be mounted yet
  // when a cross-conversation jump arrives while messages are still hydrating).
  useEffect(() => {
    if (!highlightedMsgId) return;
    let attempts = 0;
    const tryScroll = () => {
      const el = messageRefs.current[highlightedMsgId];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      if (attempts++ < 20) window.setTimeout(tryScroll, 120);
    };
    tryScroll();
  }, [highlightedMsgId, branchMessages.length]);

  // ── Inline property/address satellite maps ────────────────────────────────
  // When ANY message (user prompt OR Aureon's assistant reply) mentions a real
  // address, geocode it via Nominatim on the client and render a PropertyMapCard
  // beneath that bubble. For assistant messages we wait until streaming has
  // finished for that message so we don't fire geocodes on partial tokens.
  const [propertyMaps, setPropertyMaps] = useState<Record<string, PropertyMapCardData>>({});
  // Geocode attempts are tracked separately from results. Without this, a
  // message whose address fails to resolve is never written into propertyMaps,
  // so the effect re-fires on every render and hammers the geocoder forever.
  const geocodeAttempted = useRef<Set<string>>(new Set());
  const lastMsgId = branchMessages[branchMessages.length - 1]?.id;
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const m of branchMessages) {
        if (!m.content) continue;
        if (propertyMaps[m.id]) continue;
        if (geocodeAttempted.current.has(m.id)) continue;
        // Skip the currently-streaming assistant message to avoid partial-text geocodes.
        if (m.role === "assistant" && isStreaming && m.id === lastMsgId) continue;
        const [hit] = detectAddresses(m.content);
        if (!hit) continue;
        geocodeAttempted.current.add(m.id);
        const g = await geocodeAddress(hit.raw);
        if (cancelled || !g) continue;
        setPropertyMaps((prev) =>
          prev[m.id]
            ? prev
            : { ...prev, [m.id]: { address: hit.raw, formatted: g.formatted, lat: g.lat, lng: g.lng, category: g.category } },
        );
      }
    })();
    return () => { cancelled = true; };
  }, [branchMessages, propertyMaps, isStreaming, lastMsgId]);



  // Listen for cross-component jump signals (e.g. from the sidebar hover preview)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || detail.conversationId !== conversation.id) return;
      setHighlightedMsgId(detail.messageId);
    };
    window.addEventListener("aureon:jump-to-message", handler as EventListener);
    return () => window.removeEventListener("aureon:jump-to-message", handler as EventListener);
  }, [conversation.id]);

  // Wire lightbox for markdown images
  useEffect(() => {
    (window as any).__aureonLightbox = (src: string) => setLightboxSrc(src);
    return () => { delete (window as any).__aureonLightbox; };
  }, []);

  const elevenLabsVoice = useElevenLabsVoice({
    agentId: "agent_1701kjqvrqkpfwat79br17vqbdms",
  });

  // Identity-resolution rack: confirming a candidate sends the server-authored
  // confirmation prompt as a normal turn, so the enrichment sweep re-runs
  // anchored to one person. Guarded against re-entry while a stream is live.
  useEffect(() => {
    const onIntelSelect = (e: Event) => {
      const prompt = (e as CustomEvent<{ prompt?: string }>).detail?.prompt;
      if (!prompt || isStreaming) return;
      onSendMessage(prompt.slice(0, 2000));
    };
    window.addEventListener(INTEL_SELECT_EVENT, onIntelSelect as EventListener);
    return () => window.removeEventListener(INTEL_SELECT_EVENT, onIntelSelect as EventListener);
  }, [onSendMessage, isStreaming]);

  // handleSend is now inside AdaptiveInputBar

  const downloadConversation = () => {
    if (!branchMessages.length) return;
    const lines = branchMessages.map(m =>
      // Speaker label is the product name the operator sees: asherin.
      `**${m.role === "user" ? "You" : "asherin"}** (${m.timestamp ? new Date(m.timestamp).toLocaleString() : ""}):\n${m.content}`
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

  const lastMsg = branchMessages[branchMessages.length - 1];
  const showSuggestions = lastMsg?.role === "assistant" && !isStreaming && suggestions.length > 0;

    return (
    <div className="flex flex-1 min-w-0 h-full relative overflow-hidden">
      {/* Main chat column */}
      <div className="flex flex-1 flex-col min-w-0 h-full overflow-hidden">
      {/* Floating Notepad — mount only when open */}
      {notepadOpen && (
        <Suspense fallback={null}>
          <FloatingNotepad open={notepadOpen} onClose={() => setNotepadOpen(false)} conversationId={conversation.id} />
        </Suspense>
      )}
      {/* Voice Call Overlay — mount only when active */}
      {(elevenLabsVoice.isConnected || elevenLabsVoice.status === "connecting") && (
        <Suspense fallback={null}>
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
        </Suspense>
      )}

      {/* Top bar — hidden in focus mode */}
      {!focusMode && (
        <div className="flex items-center px-2 sm:px-4 pt-2 sm:pt-4 pb-2 gap-1.5 sm:gap-3 shrink-0 flex-wrap sm:flex-nowrap">
          <ModeSelector active={mode} onChange={onModeChange} />
          <ConversationBranches conversationId={conversation.id} activeBranch={activeBranch} onBranchChange={setActiveBranch} />
          {/* Primary icons — always visible */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {hasPro ? (
              <button
                onClick={elevenLabsVoice.isConnected ? elevenLabsVoice.disconnect : elevenLabsVoice.connect}
                className={`shrink-0 p-1.5 rounded-md transition-colors ${
                  elevenLabsVoice.isConnected
                    ? "text-accent bg-accent/10 hover:bg-accent/20"
                    : "text-muted-foreground/50 hover:text-foreground"
                }`}
                title={elevenLabsVoice.isConnected ? "End voice call" : "Start voice call"}
              >
                <Phone className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
            ) : (
              <button
                disabled
                className="shrink-0 p-1.5 rounded-md text-muted-foreground/30 cursor-not-allowed"
                title="Voice calls require Pro ($740 one-time)"
              >
                <Phone className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
            )}
            {branchMessages.length > 0 && (
              <button onClick={downloadConversation} className="shrink-0 p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground transition-colors" title="Download conversation">
                <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
            )}
            <button
              onClick={() => setNotepadOpen(!notepadOpen)}
              className={`shrink-0 p-1.5 rounded-md transition-colors ${notepadOpen ? "text-amber-500/70 bg-amber-500/10" : "text-muted-foreground/50 hover:text-foreground"}`}
              title="Notepad"
            >
              <StickyNote className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </button>
            <ChatSearchBar
              messages={branchMessages}
              onHighlightMessage={setHighlightedMsgId}
              onSearchActive={setSearchActive}
            />
          </div>

          {/* U-05 Adjust panel — single collapsed entry point for the 9 advanced
              chat controls. Keeps the toolbar clean; users opt into the depth
              only when they want it. Mode + Context Health stay visible inline. */}
          <div className="hidden sm:flex items-center gap-2 min-w-0 py-1 shrink-0">
            <ContextHealthIndicator messageCount={branchMessages.length} />
            <div className="relative shrink-0">
              <button
                onClick={() => setAdjustOpen(!adjustOpen)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-light transition-colors ${
                  adjustOpen ? "bg-foreground/10 text-foreground" : "text-muted-foreground/70 hover:text-foreground hover:bg-foreground/5"
                }`}
                title="Adjust mode, depth, reasoning, QA, style…"
              >
                <Gauge className="h-3.5 w-3.5" />
                <span>Adjust</span>
              </button>
              {adjustOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setAdjustOpen(false)} />
                  <div className="absolute left-0 top-full mt-1.5 z-50 w-[340px] rounded-xl border border-border/30 bg-card/95 backdrop-blur-xl shadow-2xl p-3 space-y-3 animate-fade-in">
                    <p className="text-[9px] font-light tracking-[0.18em] text-muted-foreground/50 uppercase">Response Controls</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <ReasoningToggle mode={reasoningMode} onChange={setReasoningMode} />
                      <DepthSelector active={depth} onChange={onDepthChange} />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <DeterminismSlider value={determinism} onChange={setDeterminism} />
                      <QualityOfServiceControls mode={qosMode} onChange={setQosMode} />
                    </div>
                    <div className="pt-2 border-t border-border/20">
                      <p className="text-[9px] font-light tracking-[0.18em] text-muted-foreground/50 uppercase pb-2">Tracking & QA</p>
                      <div className="grid grid-cols-2 gap-1">
                        <button
                          onClick={() => { setAssumptionsOpen(true); setAdjustOpen(false); }}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-light text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
                        >
                          <AlertTriangle className="h-3.5 w-3.5" /> Assumptions
                        </button>
                        <button
                          onClick={() => { setDecisionsOpen(true); setAdjustOpen(false); }}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-light text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
                        >
                          <Gavel className="h-3.5 w-3.5" /> Decision Log
                        </button>
                        <button
                          onClick={() => { setQaTogglesOpen(true); setAdjustOpen(false); }}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-light text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
                        >
                          <Shield className="h-3.5 w-3.5" /> Output QA
                        </button>
                        <button
                          onClick={() => { setStyleProfileOpen(true); setAdjustOpen(false); }}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-light text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
                        >
                          <Palette className="h-3.5 w-3.5" /> Writing Style
                        </button>
                      </div>
                    </div>
                    {onConsensusToggle && onConsensusModelsChange && (
                      <div className="pt-2 border-t border-border/20">
                        <p className="text-[9px] font-light tracking-[0.18em] text-muted-foreground/50 uppercase pb-2">Consensus</p>
                        <Suspense fallback={null}>
                          <MultiModelSelector
                            enabled={consensusEnabled}
                            onToggle={onConsensusToggle}
                            selectedModels={consensusModels}
                            onModelsChange={onConsensusModelsChange}
                            storedProviders={storedProviders}
                          />
                        </Suspense>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Detached panel anchors — keep popovers mounted so their state
                survives Adjust-close without losing in-flight edits. */}
            <div className="relative shrink-0">
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
              <DecisionLog conversationId={conversation.id} open={decisionsOpen} onClose={() => setDecisionsOpen(false)} />
              <OutputQAToggles conversationId={conversation.id} open={qaTogglesOpen} onClose={() => setQaTogglesOpen(false)} />
              {styleProfileOpen && (
                <Suspense fallback={null}>
                  <PersonalStyleProfile open={styleProfileOpen} onClose={() => setStyleProfileOpen(false)} />
                </Suspense>
              )}
            </div>
          </div>


          {/* Mobile overflow menu — visible only on mobile */}
          <div className="relative sm:hidden shrink-0">
            <button
              onClick={() => setMobileToolsOpen(!mobileToolsOpen)}
              className={`p-1.5 rounded-md transition-colors ${mobileToolsOpen ? "bg-foreground/10 text-foreground" : "text-muted-foreground/50 hover:text-foreground"}`}
              title="More tools"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {mobileToolsOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 w-[280px] rounded-xl border border-border/20 bg-card/95 backdrop-blur-xl shadow-2xl p-2 space-y-1 animate-fade-in">
                <p className="text-[9px] font-light tracking-wider text-muted-foreground/40 uppercase px-2 pb-1">Tools</p>

                {/* Reasoning */}
                <div className="px-2 py-1.5">
                  <ReasoningToggle mode={reasoningMode} onChange={setReasoningMode} />
                </div>

                {/* Depth */}
                <div className="px-2 py-1.5">
                  <DepthSelector active={depth} onChange={onDepthChange} />
                </div>

                {/* Context Health */}
                <div className="px-2 py-1.5 flex items-center">
                  <ContextHealthIndicator messageCount={branchMessages.length} />
                </div>

                {/* Toggleable items */}
                <button
                  onClick={() => { setAssumptionsOpen(!assumptionsOpen); setMobileToolsOpen(false); }}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-light text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
                >
                  <AlertTriangle className="h-3.5 w-3.5" /> Assumptions
                </button>
                <button
                  onClick={() => { setDecisionsOpen(!decisionsOpen); setMobileToolsOpen(false); }}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-light text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
                >
                  <Gavel className="h-3.5 w-3.5" /> Decision Log
                </button>
                <button
                  onClick={() => { setQaTogglesOpen(!qaTogglesOpen); setMobileToolsOpen(false); }}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-light text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
                >
                  <Shield className="h-3.5 w-3.5" /> Output QA
                </button>
                <button
                  onClick={() => { setStyleProfileOpen(!styleProfileOpen); setMobileToolsOpen(false); }}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-light text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
                >
                  <Palette className="h-3.5 w-3.5" /> Writing Style
                </button>
              </div>
            )}
          </div>

          {onBrainChange && (
            <Suspense fallback={null}>
              <BrainsManager activeBrainId={activeBrainId ?? null} onBrainChange={onBrainChange} />
            </Suspense>
          )}
          <NumberedFormatToggle scopeId={conversation.id} />
          <ConversationApiToggles conversationId={conversation.id} storedProviders={storedProviders} />
        </div>
      )}

      {/* Mobile popover panels for tools triggered from overflow menu */}
      <div className="sm:hidden">
        {assumptionsOpen && (
          <div className="px-2 pb-2">
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
        )}
        {decisionsOpen && (
          <div className="px-2 pb-2">
            <DecisionLog conversationId={conversation.id} open={decisionsOpen} onClose={() => setDecisionsOpen(false)} />
          </div>
        )}
        {qaTogglesOpen && (
          <div className="px-2 pb-2">
            <OutputQAToggles conversationId={conversation.id} open={qaTogglesOpen} onClose={() => setQaTogglesOpen(false)} />
          </div>
        )}
        {styleProfileOpen && (
          <div className="px-2 pb-2">
            <Suspense fallback={null}>
              <PersonalStyleProfile open={styleProfileOpen} onClose={() => setStyleProfileOpen(false)} />
            </Suspense>
          </div>
        )}
      </div>

      {/* Goal Lock Header */}
      <GoalLockHeader conversationId={conversation.id} />

      {/* Messages */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-2 sm:px-4 pb-4 relative min-h-0">
        <StickyQuestionHeader
          scrollContainerRef={scrollContainerRef}
          messageRefs={messageRefs}
          messages={branchMessages}
          onJump={(id) => setHighlightedMsgId(id)}
        />
        {branchMessages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center max-w-md animate-fade-in">
               <h1 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-3">
                <Link
                  to="/dashboard/settings"
                  aria-label="How can I help? Open settings"
                  title="Open settings"
                  className="rounded-md px-1 outline-none transition-colors duration-200 hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none"
                >
                  How can I help?
                </Link>
              </h1>

              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Lock className="h-3 w-3 text-emerald-500/70" />
                <span className="text-xs font-extralight text-emerald-500/70">Account-synced encryption</span>
              </div>
              <p className="text-sm font-extralight text-muted-foreground">
                Conversations are stored encrypted at rest under a key bound to your account, so they open on every device you sign in from.
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
                  const lastUserMsg = [...branchMessages].reverse().find(m => m.role === "user");
                  if (lastUserMsg) onSendMessage(lastUserMsg.content);
                }}
                onFallback={() => setChatError(null)}
                onDismiss={() => setChatError(null)}
              />
            )}
            <SmartSelectionMenu containerRef={messagesRef} onAction={handleSelectionAction} />
            {branchMessages.map((msg, idx) => (
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
                        : "bg-background/90 text-foreground backdrop-blur-md border border-border/20"
                    }`}
                  >
                    {msg.role === "assistant" && !msg.content && isStreaming && msg === lastMsg ? (
                      <ThinkingPanelOrDots messageId={msg.id} />
                    ) : msg.role === "assistant" && msg.consensusData ? (
                      <Suspense fallback={null}>
                        <ConsensusMessage data={msg.consensusData} />
                      </Suspense>
                    ) : msg.role === "assistant" ? (
                      <>
                      <ThinkingPanel messageId={msg.id} />
                      <div className="prose prose-sm prose-invert max-w-none overflow-hidden [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:my-0.5 [&_code]:text-accent [&_code]:bg-secondary/50 [&_code]:px-1 [&_code]:rounded [&_pre]:bg-secondary/50 [&_pre]:rounded-lg [&_pre]:p-3 [&_blockquote]:border-accent/50 [&_blockquote]:text-muted-foreground [&_strong]:text-foreground [&_hr]:border-border/30">
                        {parseChatCards(msg.content).map((seg, i) =>
                          seg.type === "card" || seg.type === "card-unknown" ? (
                            <ChatCardRenderer key={`c-${i}`} segment={seg} source="chat:aureon" />
                          ) : (
                            <ReactMarkdown key={`t-${i}`} components={markdownComponents}>{seg.value}</ReactMarkdown>
                          )
                        )}
                        {isStreaming && msg === lastMsg && (
                          <span className="inline-block w-0.5 h-4 bg-foreground/60 animate-pulse ml-0.5 align-text-bottom" />
                        )}
                        {renderLinkPreviews(msg.content)}
                      </div>
                      </>
                    ) : (
                      <>
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-2">
                            {msg.attachments.map((att, aidx) => (
                              <div key={aidx} className="rounded-lg overflow-hidden border border-border/20">
                                {att.type.startsWith("image/") && att.previewUrl ? (
                                  <span className="relative group cursor-pointer block" onClick={() => setLightboxSrc(att.previewUrl!)}>
                                    <img src={att.previewUrl} alt={att.name} className="max-w-[200px] max-h-[150px] object-cover rounded-lg transition-transform hover:scale-[1.02]" />
                                    <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded-lg">
                                      <ZoomIn className="h-5 w-5 text-white drop-shadow-lg" />
                                    </span>
                                  </span>
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
                  {/* Inline satellite map for any address in the message */}
                  {propertyMaps[msg.id] && (
                    <div className="mt-2 max-w-[560px]">
                      <PropertyMapCard data={propertyMaps[msg.id]} />
                    </div>
                  )}
                  {/* Timestamp */}
                  {msg.timestamp && (
                    <div className={`text-[9px] font-extralight text-muted-foreground/40 mt-1 px-1 ${msg.role === "user" ? "text-right" : "text-left"}`}>
                      {(() => {
                        const ts = new Date(msg.timestamp);
                        const now = new Date();
                        const isToday = ts.toDateString() === now.toDateString();
                        const yesterday = new Date(now);
                        yesterday.setDate(yesterday.getDate() - 1);
                        const isYesterday = ts.toDateString() === yesterday.toDateString();
                        const time = ts.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
                        if (isToday) return time;
                        if (isYesterday) return `Yesterday ${time}`;
                        return `${ts.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
                      })()}
                    </div>
                  )}
                  {/* Action bar for both message types */}
                  {msg.content && !isStreaming && (
                    <div className="flex items-center gap-1.5 sm:gap-2 mt-1 px-1 flex-wrap animate-fade-in">
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
                              const userMsg = branchMessages.slice(0, branchMessages.indexOf(msg)).reverse().find(m => m.role === "user");
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
                            onClick={() => { setArtifactContent(msg.content); setArtifactKey(`${conversation.id}::${msg.id}`); setArtifactOpen(true); }}
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
                          {/* Trading Proof — show annotated chart with visual reasoning */}
                          <TradingProofButton
                            message={msg}
                            allMessages={branchMessages}
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
                    <Suspense fallback={null}>
                      <ChainOfThoughtPanel
                        open={true}
                        content={msg.content}
                        query={branchMessages.find((m, i) => i < branchMessages.indexOf(msg) && m.role === "user")?.content}
                      />
                    </Suspense>
                  )}
                  {msg.role === "assistant" && decodeId === msg.id && (
                    <Suspense fallback={null}>
                      <DecodeView open={true} content={msg.content} />
                    </Suspense>
                  )}
                  {msg.role === "assistant" && diagramId === msg.id && (
                    <Suspense fallback={null}>
                      <MessageDiagramPanel
                        open={true}
                        content={msg.content}
                        onClose={() => setDiagramId(null)}
                      />
                    </Suspense>
                  )}
                  {msg.role === "assistant" && neuralId === msg.id && (
                    <Suspense fallback={null}>
                      <NeuralThinkingModal
                        open={true}
                        query={branchMessages.find((m, i) => i < branchMessages.indexOf(msg) && m.role === "user")?.content || ""}
                        response={msg.content}
                        onClose={() => setNeuralId(null)}
                      />
                    </Suspense>
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
                  {/* Branded intelligence report artifact — only when the operator
                      asked for the product as a file, and only once the answer
                      has finished streaming so the .txt is never half-written. */}
                  {msg.role === "assistant" && !!msg.content && !(isStreaming && msg === lastMsg) &&
                    wantsIntelReportFile(branchMessages[idx - 1]?.role === "user" ? branchMessages[idx - 1].content : "") && (
                      <IntelReportCard
                        content={msg.content}
                        request={branchMessages[idx - 1]?.content}
                        conversationTitle={conversation.title}
                        timestamp={msg.timestamp}
                        sources={msg.sources}
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
          {blocksOpen && (
            <Suspense fallback={null}>
              <ReusableBlocks
                open={blocksOpen}
                onClose={() => { setBlocksOpen(false); setBlockSaveContent(undefined); }}
                onInsert={(content) => inputBarRef.current?.insertText(content)}
                contentToSave={blockSaveContent}
              />
            </Suspense>
          )}
        </div>
        <div className="relative">
          <button
            onClick={() => setStructuredOpen(!structuredOpen)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-light text-muted-foreground/50 hover:text-foreground hover:bg-foreground/5 transition-colors"
          >
            <ClipboardList className="h-3 w-3" />
            Forms
          </button>
          {structuredOpen && (
            <Suspense fallback={null}>
              <StructuredInputForms
                open={structuredOpen}
                onClose={() => setStructuredOpen(false)}
                onSubmit={(prompt) => onSendMessage(prompt)}
              />
            </Suspense>
          )}
        </div>
      </div>

      {/* Adaptive Input — gated behind subscription */}
      <SubscriptionGatedInput
        ref={inputBarRef}
        onSendMessage={onSendMessage}
        onStop={onStopStreaming}
        onQuickAction={handleQuickAction}
        isStreaming={!!isStreaming}
        conversationId={conversation.id}
      />

      {/* Share with Redaction modal — mount only when open */}
      {shareOpen && (
        <Suspense fallback={null}>
          <ShareWithRedaction
            messages={branchMessages}
            open={shareOpen}
            onClose={() => setShareOpen(false)}
          />
        </Suspense>
      )}
      </div>
      {/* Artifact Canvas - right panel */}
      {artifactOpen && (
        <Suspense fallback={null}>
          <ArtifactCanvas
            open={artifactOpen}
            onClose={() => setArtifactOpen(false)}
            initialContent={artifactContent}
            persistKey={artifactKey}
          />
        </Suspense>
      )}

      {/* Image Lightbox */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-fade-in cursor-zoom-out"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setLightboxSrc(null); }}
            className="absolute top-4 right-4 p-2 rounded-full bg-foreground/10 hover:bg-foreground/20 text-white transition-colors z-10"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={lightboxSrc}
            alt="Expanded view"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl shadow-2xl border border-border/10 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

export default ChatView;
