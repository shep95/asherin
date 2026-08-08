import { useState, useEffect, useCallback, useRef, useMemo, forwardRef, useImperativeHandle } from "react";
import { Send, Loader2, Square, Bug, Zap, TestTubes, FileText, Link, Search, BarChart3, ImageIcon, Code, Lock, X, WifiOff, Paperclip, Mic, MicOff, ClipboardPaste, FileUp, Image as ImageLucide, Video, FileIcon, Files, BookOpen, Scale } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { saveDraft, getDraft, deleteDraft } from "@/lib/messageQueue";
import SmartAutocomplete, { trackPhrase } from "./SmartAutocomplete";
import VoiceRecordingOrb from "./VoiceRecordingOrb";
import SlashCommandPalette from "./SlashCommandPalette";
import { parseSlashCommand, type SlashCommand } from "@/lib/slashCommands";
import { expandPromptToNarrative, loadNarrativeMode, saveNarrativeMode } from "@/lib/promptToNarrative";
import { expandPromptToLegal } from "@/lib/legalAdvisor";
import {
  classifyMessage,
  shouldAutoArmLegal,
  buildRoutingHint,
  loadLawSwitch,
  saveLawSwitch,
  cycleLawSwitch,
  type LawSwitch,
} from "@/lib/adaptiveIntent";
import { setModelPromptOverride } from "@/lib/promptOverrideMap";

import type { FileAttachment } from "./types";

const LONG_PASTE_THRESHOLD = 500; // chars

const BORDER_COLOR_THEMES: Record<string, { main: string; shimmer: string; glow: string }> = {
  default: {
    main: "conic-gradient(from 0deg, hsl(275 95% 43%/0.2), hsl(275 80% 65%), hsl(0 0% 75%/0.7), hsl(275 95% 50%), hsl(0 0% 85%/0.5), hsl(260 70% 60%), hsl(275 95% 43%/0.2))",
    shimmer: "conic-gradient(from 180deg, transparent 0%, hsl(0 0% 92%/0.6) 20%, transparent 35%, hsl(275 60% 75%/0.5) 55%, transparent 70%, hsl(0 0% 80%/0.4) 85%, transparent 100%)",
    glow: "hsl(275 95% 43%)",
  },
  gold: {
    main: "conic-gradient(from 0deg, hsl(43 80% 35%/0.2), hsl(43 90% 55%), hsl(35 95% 70%/0.7), hsl(48 85% 60%), hsl(40 80% 50%/0.5), hsl(43 80% 35%/0.2))",
    shimmer: "conic-gradient(from 180deg, transparent 0%, hsl(43 90% 70%/0.6) 20%, transparent 35%, hsl(35 80% 60%/0.5) 55%, transparent 70%, hsl(48 85% 55%/0.4) 85%, transparent 100%)",
    glow: "hsl(43 90% 50%)",
  },
  silver: {
    main: "conic-gradient(from 0deg, hsl(0 0% 45%/0.2), hsl(0 0% 70%), hsl(0 0% 85%/0.7), hsl(210 5% 65%), hsl(0 0% 55%/0.5), hsl(0 0% 45%/0.2))",
    shimmer: "conic-gradient(from 180deg, transparent 0%, hsl(0 0% 92%/0.7) 20%, transparent 35%, hsl(210 5% 75%/0.5) 55%, transparent 70%, hsl(0 0% 80%/0.5) 85%, transparent 100%)",
    glow: "hsl(0 0% 70%)",
  },
  bronze: {
    main: "conic-gradient(from 0deg, hsl(25 60% 35%/0.2), hsl(30 70% 50%), hsl(20 65% 60%/0.7), hsl(35 55% 45%), hsl(28 60% 40%/0.5), hsl(25 60% 35%/0.2))",
    shimmer: "conic-gradient(from 180deg, transparent 0%, hsl(30 65% 60%/0.6) 20%, transparent 35%, hsl(25 55% 50%/0.5) 55%, transparent 70%, hsl(35 60% 55%/0.4) 85%, transparent 100%)",
    glow: "hsl(30 70% 45%)",
  },
  blue: {
    main: "conic-gradient(from 0deg, hsl(220 90% 40%/0.2), hsl(210 85% 55%), hsl(200 80% 65%/0.7), hsl(225 90% 50%), hsl(215 85% 45%/0.5), hsl(220 90% 40%/0.2))",
    shimmer: "conic-gradient(from 180deg, transparent 0%, hsl(210 80% 70%/0.6) 20%, transparent 35%, hsl(220 85% 60%/0.5) 55%, transparent 70%, hsl(200 80% 65%/0.4) 85%, transparent 100%)",
    glow: "hsl(220 90% 50%)",
  },
  neon: {
    main: "conic-gradient(from 0deg, hsl(150 100% 45%/0.3), hsl(180 100% 50%), hsl(280 100% 60%/0.7), hsl(320 100% 50%), hsl(60 100% 50%/0.5), hsl(150 100% 45%/0.3))",
    shimmer: "conic-gradient(from 180deg, transparent 0%, hsl(180 100% 60%/0.6) 20%, transparent 35%, hsl(320 100% 55%/0.5) 55%, transparent 70%, hsl(60 100% 55%/0.4) 85%, transparent 100%)",
    glow: "hsl(150 100% 50%)",
  },
  rose: {
    main: "conic-gradient(from 0deg, hsl(340 80% 45%/0.2), hsl(350 85% 60%), hsl(330 75% 65%/0.7), hsl(345 90% 55%), hsl(335 80% 50%/0.5), hsl(340 80% 45%/0.2))",
    shimmer: "conic-gradient(from 180deg, transparent 0%, hsl(350 80% 70%/0.6) 20%, transparent 35%, hsl(340 75% 60%/0.5) 55%, transparent 70%, hsl(330 80% 65%/0.4) 85%, transparent 100%)",
    glow: "hsl(345 85% 55%)",
  },
  ember: {
    main: "conic-gradient(from 0deg, hsl(15 90% 40%/0.2), hsl(25 95% 55%), hsl(40 90% 60%/0.7), hsl(10 85% 45%), hsl(0 80% 40%/0.5), hsl(15 90% 40%/0.2))",
    shimmer: "conic-gradient(from 180deg, transparent 0%, hsl(25 90% 60%/0.6) 20%, transparent 35%, hsl(10 85% 50%/0.5) 55%, transparent 70%, hsl(40 85% 55%/0.4) 85%, transparent 100%)",
    glow: "hsl(20 90% 45%)",
  },
  ice: {
    main: "conic-gradient(from 0deg, hsl(195 90% 45%/0.2), hsl(185 85% 60%), hsl(200 80% 70%/0.7), hsl(190 90% 55%), hsl(210 75% 50%/0.5), hsl(195 90% 45%/0.2))",
    shimmer: "conic-gradient(from 180deg, transparent 0%, hsl(195 85% 70%/0.6) 20%, transparent 35%, hsl(185 80% 60%/0.5) 55%, transparent 70%, hsl(200 80% 65%/0.4) 85%, transparent 100%)",
    glow: "hsl(195 90% 50%)",
  },
  emerald: {
    main: "conic-gradient(from 0deg, hsl(155 80% 30%/0.2), hsl(160 75% 45%), hsl(150 70% 55%/0.7), hsl(165 80% 40%), hsl(145 75% 35%/0.5), hsl(155 80% 30%/0.2))",
    shimmer: "conic-gradient(from 180deg, transparent 0%, hsl(160 70% 55%/0.6) 20%, transparent 35%, hsl(150 75% 45%/0.5) 55%, transparent 70%, hsl(155 70% 50%/0.4) 85%, transparent 100%)",
    glow: "hsl(155 80% 40%)",
  },
  phantom: {
    main: "conic-gradient(from 0deg, hsl(0 0% 15%/0.3), hsl(0 0% 30%), hsl(0 0% 50%/0.7), hsl(0 0% 25%), hsl(0 0% 40%/0.5), hsl(0 0% 15%/0.3))",
    shimmer: "conic-gradient(from 180deg, transparent 0%, hsl(0 0% 50%/0.5) 20%, transparent 35%, hsl(0 0% 35%/0.4) 55%, transparent 70%, hsl(0 0% 45%/0.3) 85%, transparent 100%)",
    glow: "hsl(0 0% 35%)",
  },
  rainbow: {
    main: "conic-gradient(from 0deg, hsl(0 85% 55%), hsl(60 85% 55%), hsl(120 85% 45%), hsl(180 85% 50%), hsl(240 85% 55%), hsl(300 85% 55%), hsl(0 85% 55%))",
    shimmer: "conic-gradient(from 180deg, transparent 0%, hsl(60 80% 65%/0.5) 15%, transparent 30%, hsl(180 80% 55%/0.4) 50%, transparent 65%, hsl(300 80% 60%/0.4) 80%, transparent 100%)",
    glow: "hsl(180 80% 50%)",
  },
  crimson: {
    main: "conic-gradient(from 0deg, hsl(0 75% 35%/0.2), hsl(355 80% 50%), hsl(5 70% 55%/0.7), hsl(350 85% 45%), hsl(0 75% 40%/0.5), hsl(0 75% 35%/0.2))",
    shimmer: "conic-gradient(from 180deg, transparent 0%, hsl(355 75% 60%/0.6) 20%, transparent 35%, hsl(0 70% 50%/0.5) 55%, transparent 70%, hsl(5 75% 55%/0.4) 85%, transparent 100%)",
    glow: "hsl(355 80% 45%)",
  },
  amethyst: {
    main: "conic-gradient(from 0deg, hsl(290 60% 35%/0.2), hsl(285 65% 50%), hsl(295 55% 60%/0.7), hsl(280 70% 45%), hsl(300 60% 40%/0.5), hsl(290 60% 35%/0.2))",
    shimmer: "conic-gradient(from 180deg, transparent 0%, hsl(285 60% 60%/0.6) 20%, transparent 35%, hsl(295 55% 50%/0.5) 55%, transparent 70%, hsl(280 65% 55%/0.4) 85%, transparent 100%)",
    glow: "hsl(285 65% 45%)",
  },
  arctic: {
    main: "conic-gradient(from 0deg, hsl(210 40% 50%/0.2), hsl(200 50% 65%), hsl(190 45% 75%/0.7), hsl(215 55% 60%), hsl(205 40% 55%/0.5), hsl(210 40% 50%/0.2))",
    shimmer: "conic-gradient(from 180deg, transparent 0%, hsl(200 45% 75%/0.6) 20%, transparent 35%, hsl(210 50% 65%/0.5) 55%, transparent 70%, hsl(190 40% 70%/0.4) 85%, transparent 100%)",
    glow: "hsl(205 50% 60%)",
  },
  sunset: {
    main: "conic-gradient(from 0deg, hsl(15 85% 45%/0.2), hsl(30 90% 55%), hsl(45 85% 60%/0.7), hsl(350 80% 50%), hsl(10 90% 45%/0.5), hsl(15 85% 45%/0.2))",
    shimmer: "conic-gradient(from 180deg, transparent 0%, hsl(30 85% 65%/0.6) 20%, transparent 35%, hsl(350 80% 55%/0.5) 55%, transparent 70%, hsl(45 80% 55%/0.4) 85%, transparent 100%)",
    glow: "hsl(25 90% 50%)",
  },
  // Wallpaper-matched themes
  "wp-raven": { main: "conic-gradient(from 0deg, hsl(230 30% 20%/0.3), hsl(225 35% 35%), hsl(220 25% 50%/0.7), hsl(235 30% 30%), hsl(210 25% 40%/0.5), hsl(230 30% 20%/0.3))", shimmer: "conic-gradient(from 180deg, transparent 0%, hsl(225 30% 45%/0.5) 20%, transparent 35%, hsl(220 25% 40%/0.4) 55%, transparent 70%, hsl(230 30% 50%/0.3) 85%, transparent 100%)", glow: "hsl(225 35% 35%)" },
  "wp-eclipse": { main: "conic-gradient(from 0deg, hsl(35 80% 40%/0.2), hsl(25 85% 50%), hsl(45 75% 55%/0.7), hsl(15 80% 45%), hsl(40 70% 40%/0.5), hsl(35 80% 40%/0.2))", shimmer: "conic-gradient(from 180deg, transparent 0%, hsl(35 80% 60%/0.6) 20%, transparent 35%, hsl(25 75% 50%/0.5) 55%, transparent 70%, hsl(45 70% 55%/0.4) 85%, transparent 100%)", glow: "hsl(30 85% 50%)" },
  "wp-glitch": { main: "conic-gradient(from 0deg, hsl(160 100% 40%/0.3), hsl(320 100% 50%), hsl(180 90% 50%/0.7), hsl(280 100% 55%), hsl(120 100% 45%/0.5), hsl(160 100% 40%/0.3))", shimmer: "conic-gradient(from 180deg, transparent 0%, hsl(320 100% 55%/0.6) 20%, transparent 35%, hsl(160 100% 50%/0.5) 55%, transparent 70%, hsl(280 90% 55%/0.4) 85%, transparent 100%)", glow: "hsl(160 100% 45%)" },
  "wp-aureon": { main: "conic-gradient(from 0deg, hsl(270 90% 40%/0.2), hsl(280 85% 55%), hsl(260 80% 65%/0.7), hsl(275 95% 50%), hsl(290 75% 45%/0.5), hsl(270 90% 40%/0.2))", shimmer: "conic-gradient(from 180deg, transparent 0%, hsl(280 80% 65%/0.6) 20%, transparent 35%, hsl(260 85% 55%/0.5) 55%, transparent 70%, hsl(275 80% 60%/0.4) 85%, transparent 100%)", glow: "hsl(275 90% 50%)" },
  "wp-seraph": { main: "conic-gradient(from 0deg, hsl(40 70% 50%/0.2), hsl(45 80% 65%), hsl(35 75% 70%/0.7), hsl(50 85% 60%), hsl(30 70% 55%/0.5), hsl(40 70% 50%/0.2))", shimmer: "conic-gradient(from 180deg, transparent 0%, hsl(45 75% 70%/0.6) 20%, transparent 35%, hsl(40 80% 60%/0.5) 55%, transparent 70%, hsl(50 75% 65%/0.4) 85%, transparent 100%)", glow: "hsl(45 80% 60%)" },
  "wp-prophet": { main: "conic-gradient(from 0deg, hsl(210 60% 25%/0.2), hsl(200 55% 40%), hsl(220 50% 50%/0.7), hsl(215 60% 35%), hsl(205 55% 30%/0.5), hsl(210 60% 25%/0.2))", shimmer: "conic-gradient(from 180deg, transparent 0%, hsl(200 50% 50%/0.5) 20%, transparent 35%, hsl(215 55% 40%/0.4) 55%, transparent 70%, hsl(210 50% 45%/0.3) 85%, transparent 100%)", glow: "hsl(210 60% 35%)" },
  "wp-nexus": { main: "conic-gradient(from 0deg, hsl(180 70% 35%/0.2), hsl(170 65% 45%), hsl(190 60% 55%/0.7), hsl(175 70% 40%), hsl(185 65% 35%/0.5), hsl(180 70% 35%/0.2))", shimmer: "conic-gradient(from 180deg, transparent 0%, hsl(175 65% 55%/0.6) 20%, transparent 35%, hsl(180 60% 45%/0.5) 55%, transparent 70%, hsl(185 65% 50%/0.4) 85%, transparent 100%)", glow: "hsl(180 70% 42%)" },
  "wp-sentinel": { main: "conic-gradient(from 0deg, hsl(200 75% 30%/0.2), hsl(205 70% 42%), hsl(195 65% 52%/0.7), hsl(210 75% 38%), hsl(200 70% 35%/0.5), hsl(200 75% 30%/0.2))", shimmer: "conic-gradient(from 180deg, transparent 0%, hsl(205 65% 52%/0.6) 20%, transparent 35%, hsl(195 70% 42%/0.5) 55%, transparent 70%, hsl(210 60% 48%/0.4) 85%, transparent 100%)", glow: "hsl(205 70% 40%)" },
  "wp-inferno": { main: "conic-gradient(from 0deg, hsl(5 90% 35%/0.2), hsl(15 95% 50%), hsl(30 90% 55%/0.7), hsl(0 85% 40%), hsl(10 90% 45%/0.5), hsl(5 90% 35%/0.2))", shimmer: "conic-gradient(from 180deg, transparent 0%, hsl(15 90% 55%/0.6) 20%, transparent 35%, hsl(0 85% 45%/0.5) 55%, transparent 70%, hsl(30 85% 50%/0.4) 85%, transparent 100%)", glow: "hsl(10 95% 45%)" },
  "wp-sorrow": { main: "conic-gradient(from 0deg, hsl(220 30% 30%/0.2), hsl(215 35% 42%), hsl(225 25% 50%/0.7), hsl(210 30% 38%), hsl(220 25% 35%/0.5), hsl(220 30% 30%/0.2))", shimmer: "conic-gradient(from 180deg, transparent 0%, hsl(215 30% 50%/0.5) 20%, transparent 35%, hsl(220 25% 42%/0.4) 55%, transparent 70%, hsl(225 30% 48%/0.3) 85%, transparent 100%)", glow: "hsl(215 35% 40%)" },
  "wp-silhouette": { main: "conic-gradient(from 0deg, hsl(0 0% 10%/0.3), hsl(0 0% 22%), hsl(0 0% 38%/0.7), hsl(0 0% 18%), hsl(0 0% 28%/0.5), hsl(0 0% 10%/0.3))", shimmer: "conic-gradient(from 180deg, transparent 0%, hsl(0 0% 40%/0.5) 20%, transparent 35%, hsl(0 0% 28%/0.4) 55%, transparent 70%, hsl(0 0% 35%/0.3) 85%, transparent 100%)", glow: "hsl(0 0% 25%)" },
  "wp-abyss": { main: "conic-gradient(from 0deg, hsl(240 50% 20%/0.3), hsl(235 55% 30%), hsl(245 45% 40%/0.7), hsl(230 50% 25%), hsl(240 45% 32%/0.5), hsl(240 50% 20%/0.3))", shimmer: "conic-gradient(from 180deg, transparent 0%, hsl(235 50% 40%/0.5) 20%, transparent 35%, hsl(240 45% 30%/0.4) 55%, transparent 70%, hsl(245 50% 35%/0.3) 85%, transparent 100%)", glow: "hsl(238 55% 30%)" },
};

type InputIntent = "text" | "code" | "url" | "image" | "file";

export interface AdaptiveInputBarHandle {
  insertText: (text: string) => void;
}

interface AdaptiveInputBarProps {
  onSendMessage: (content: string, attachments?: FileAttachment[]) => void;
  onStop?: () => void;
  onQuickAction?: (action: string, content: string) => void;
  isStreaming: boolean;
  disabled?: boolean;
  conversationId?: string;
}

function detectIntent(text: string): InputIntent {
  const trimmed = text.trim();
  // URL detection
  if (/^https?:\/\/\S+$/i.test(trimmed)) return "url";
  // Code detection (multi-line with brackets/semicolons or language markers)
  if (
    (trimmed.includes("\n") && (trimmed.includes("{") || trimmed.includes("=>") || trimmed.includes("import ") || trimmed.includes("def ") || trimmed.includes("function "))) ||
    trimmed.startsWith("```")
  ) return "code";
  return "text";
}

const quickActions: Record<InputIntent, { id: string; icon: React.ElementType; label: string }[]> = {
  text: [],
  code: [
    { id: "debug", icon: Bug, label: "Debug" },
    { id: "explain", icon: FileText, label: "Explain" },
    { id: "optimize", icon: Zap, label: "Optimize" },
    { id: "test", icon: TestTubes, label: "Add Tests" },
  ],
  url: [
    { id: "summarize", icon: FileText, label: "Summarize" },
    { id: "fact-check", icon: Search, label: "Fact Check" },
    { id: "extract", icon: BarChart3, label: "Extract Data" },
  ],
  image: [
    { id: "describe", icon: FileText, label: "Describe" },
    { id: "extract-text", icon: FileText, label: "Extract Text" },
    { id: "analyze", icon: Search, label: "Analyze" },
  ],
  file: [
    { id: "summarize", icon: FileText, label: "Summarize" },
    { id: "extract", icon: BarChart3, label: "Key Points" },
  ],
};

const AdaptiveInputBar = forwardRef<AdaptiveInputBarHandle, AdaptiveInputBarProps>(({ onSendMessage, onStop, onQuickAction, isStreaming, disabled, conversationId }, ref) => {
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [longPasteText, setLongPasteText] = useState<string | null>(null);
  const onAttachmentsChange = setAttachments;
  const onChange = setValue;

  useImperativeHandle(ref, () => ({
    insertText: (text: string) => setValue(prev => prev + text),
  }), []);
  const [intent, setIntent] = useState<InputIntent>("text");
  const [draftSaved, setDraftSaved] = useState<string | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isMobile, setIsMobile] = useState(() =>
    /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    window.innerWidth < 768
  );
  useEffect(() => {
    const onResize = () => setIsMobile(
      /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      window.innerWidth < 768
    );
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [borderColorKey, setBorderColorKey] = useState(() => localStorage.getItem("aureon_send_border_color") || "default");
  const [btnShape, setBtnShape] = useState(() => localStorage.getItem("aureon_send_btn_shape") || "circle");
  // NAR mode — narrative expansion of prompts before send. Persisted per browser.
  const [narrativeMode, setNarrativeMode] = useState<boolean>(() => loadNarrativeMode());
  const toggleNarrative = useCallback(() => {
    setNarrativeMode(prev => { const next = !prev; saveNarrativeMode(next); return next; });
  }, []);
  // LAW switch — tri-state. AUTO (default) arms the legal-advisor directive only
  // on messages that actually read as legal questions and stands down on the very
  // next non-legal message. ON forces it, OFF suppresses it entirely.
  const [lawSwitch, setLawSwitch] = useState<LawSwitch>(() => loadLawSwitch());
  const toggleLegal = useCallback(() => {
    setLawSwitch(prev => { const next = cycleLawSwitch(prev); saveLawSwitch(next); return next; });
  }, []);
  // Live read of the current draft — drives the AUTO badge without touching send.
  const reading = useMemo(() => classifyMessage(value), [value]);
  const autoLegalArmed = lawSwitch === "auto" && shouldAutoArmLegal(reading);
  const legalActive = lawSwitch === "on" || autoLegalArmed;

  useEffect(() => {
    const handler = () => {
      setBorderColorKey(localStorage.getItem("aureon_send_border_color") || "default");
      setBtnShape(localStorage.getItem("aureon_send_btn_shape") || "circle");
    };
    window.addEventListener("aureon-border-color-change", handler);
    return () => window.removeEventListener("aureon-border-color-change", handler);
  }, []);

  const borderTheme = BORDER_COLOR_THEMES[borderColorKey] || BORDER_COLOR_THEMES.default;

  useEffect(() => {
    setIntent(detectIntent(value));
  }, [value]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 128) + "px";
  }, [value]);

  // Online/offline tracking
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  // Load draft on mount / conversation change
  useEffect(() => {
    const key = conversationId || "global";
    getDraft(key).then(draft => {
      if (draft && draft.content && !value) {
        onChange(draft.content);
        setDraftSaved(`Restored from ${new Date(draft.updatedAt).toLocaleTimeString()}`);
        setTimeout(() => setDraftSaved(null), 3000);
      }
    }).catch(() => {});
  }, [conversationId]);

  // Auto-save draft every 500ms
  useEffect(() => {
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    if (!value.trim()) {
      setDraftSaved(null);
      return;
    }
    draftTimerRef.current = setTimeout(() => {
      const key = conversationId || "global";
      saveDraft({ id: key, content: value, updatedAt: Date.now() }).then(() => {
        setDraftSaved("Draft saved");
        setTimeout(() => setDraftSaved(null), 2000);
      }).catch(() => {});
    }, 500);
    return () => { if (draftTimerRef.current) clearTimeout(draftTimerRef.current); };
  }, [value, conversationId]);

  // Accept autocomplete suggestion
  const acceptSuggestion = useCallback(() => {
    const lower = value.toLowerCase();
    const allPhrases = [...(JSON.parse(localStorage.getItem("aureon_user_phrases") || "[]") as string[]),
      "Analyze this dataset", "Write a report about", "Summarize this document", "Explain how",
      "Compare and contrast", "Create a plan for", "Debug this code", "Optimize this function"];
    const match = allPhrases.find(p => p.toLowerCase().startsWith(lower) && p.toLowerCase() !== lower);
    if (match) onChange(match);
  }, [value, onChange]);

  // Clear draft on send
  const handleSend = () => {
    if (!value.trim() && attachments.length === 0) return;
    const key = conversationId || "global";
    deleteDraft(key).catch(() => {});
    setDraftSaved(null);
    trackPhrase(value.trim());
    // Per-message adaptation. The visible/stored user message stays raw; only the
    // MODEL payload carries the directive + routing hint, so the transcript never
    // echoes prompt scaffolding back at the operator.
    const raw = value.trim();
    const send = classifyMessage(raw);
    const armLegal = lawSwitch === "on" || (lawSwitch === "auto" && shouldAutoArmLegal(send));
    let outbound = raw;
    // LAW takes precedence over NAR (legal directive is more specific), but NAR is
    // now skipped for smalltalk so "thanks" is never expanded into a narrative.
    if (armLegal) outbound = expandPromptToLegal(raw).transformed;
    else if (narrativeMode && !send.smalltalk) outbound = expandPromptToNarrative(raw).transformed;
    const hint = buildRoutingHint(send);
    if (hint) outbound = `${hint}\n\n${outbound}`;
    if (outbound !== raw) setModelPromptOverride(raw, outbound);

    onSendMessage(raw, attachments.length > 0 ? attachments : undefined);
    setValue("");
    setAttachments([]);

  };

  // Handle paste from clipboard (images)
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    // Detect long-text paste first so we still surface the Safe Paste UI even
    // in contexts that don't support attachments.
    const textData = e.clipboardData?.getData("text/plain") || "";
    if (textData.length > LONG_PASTE_THRESHOLD) {
      e.preventDefault();
      setLongPasteText(textData);
      return;
    }

    if (!onAttachmentsChange) return;
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageItems: DataTransferItem[] = [];
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) imageItems.push(item);
    }
    if (imageItems.length === 0) return;

    e.preventDefault();
    const maxSize = 20 * 1024 * 1024;
    const maxSlots = Math.max(0, 3 - attachments.length);

    imageItems.slice(0, maxSlots).forEach(async (item) => {
      const file = item.getAsFile();
      if (!file || file.size > maxSize || file.size === 0) return;
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            const commaIdx = result.indexOf(",");
            resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
          };
          reader.onerror = () => reject(new Error("Failed to read file"));
          reader.readAsDataURL(file);
        });
        const previewUrl = URL.createObjectURL(file);
        const name = file.name || `pasted-image-${Date.now()}.png`;
        onAttachmentsChange([...attachments, { name, type: file.type, size: file.size, base64, previewUrl }]);
      } catch (err) {
        console.error("Failed to paste image:", err);
      }
    });
  }, [attachments, onAttachmentsChange]);

  const handleLongPasteInline = () => {
    if (longPasteText) {
      onChange(value + longPasteText);
      setLongPasteText(null);
    }
  };

  const handleLongPasteAsFile = () => {
    if (longPasteText && onAttachmentsChange) {
      const blob = new Blob([longPasteText], { type: "text/plain" });
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const commaIdx = result.indexOf(",");
        const base64 = commaIdx >= 0 ? result.slice(commaIdx + 1) : result;
        const name = `pasted-text-${Date.now()}.txt`;
        onAttachmentsChange([...attachments, { name, type: "text/plain", size: blob.size, base64 }]);
        setLongPasteText(null);
      };
      reader.readAsDataURL(blob);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Tab" || (e.key === "ArrowRight" && textareaRef.current && textareaRef.current.selectionStart === value.length)) {
      const lower = value.toLowerCase();
      if (lower.length >= 3) {
        e.preventDefault();
        acceptSuggestion();
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey && !isMobile) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearDraft = () => {
    const key = conversationId || "global";
    onChange("");
    deleteDraft(key).catch(() => {});
    setDraftSaved(null);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !onAttachmentsChange) return;

    const maxSize = 20 * 1024 * 1024; // 20MB
    const newAttachments: FileAttachment[] = [];
    const maxSlots = Math.max(0, 10 - attachments.length);

    const filesToProcess: File[] = [];

    // Check for ZIP files and extract them
    for (const file of Array.from(files).slice(0, maxSlots)) {
      if (file.size > maxSize) {
        console.warn(`File "${file.name}" skipped: exceeds 20MB limit`);
        continue;
      }
      if (file.size === 0) {
        console.warn(`File "${file.name}" skipped: empty file`);
        continue;
      }

      const ext = file.name.toLowerCase().split(".").pop();
      if (ext === "zip") {
        // Auto-extract ZIP files
        try {
          const JSZip = (await import("jszip")).default;
          const zip = await JSZip.loadAsync(file);
          const entries = Object.entries(zip.files);
          for (const [path, entry] of entries) {
            if (entry.dir || path.startsWith("__MACOSX") || path.startsWith(".")) continue;
            const blob = await entry.async("blob");
            if (blob.size === 0 || blob.size > maxSize) continue;
            const fileName = path.split("/").pop() || path;
            const extracted = new File([blob], fileName, { type: blob.type || "application/octet-stream" });
            filesToProcess.push(extracted);
          }
        } catch (err) {
          console.error(`Failed to extract ZIP "${file.name}":`, err);
          // Fall back to attaching the ZIP itself
          filesToProcess.push(file);
        }
      } else {
        filesToProcess.push(file);
      }
    }

    for (const file of filesToProcess.slice(0, Math.max(0, 10 - attachments.length))) {
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            const commaIdx = result.indexOf(",");
            resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
          };
          reader.onerror = () => reject(new Error("Failed to read file"));
          reader.readAsDataURL(file);
        });

        const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
        newAttachments.push({ name: file.name, type: file.type || "application/octet-stream", size: file.size, base64, previewUrl });
      } catch (err) {
        console.error(`Failed to read file "${file.name}":`, err);
      }
    }

    if (newAttachments.length > 0) {
      onAttachmentsChange([...attachments, ...newAttachments]);
    }
    // Reset input so re-selecting the same file triggers onChange again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (idx: number) => {
    if (!onAttachmentsChange) return;
    const updated = attachments.filter((_, i) => i !== idx);
    onAttachmentsChange(updated);
  };

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 },
      });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        setRecordingTime(0);

        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        if (blob.size === 0 || !onAttachmentsChange) return;

        const ext = mimeType.includes("webm") ? "webm" : "m4a";
        const fileName = `voice-message-${Date.now()}.${ext}`;

        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            const commaIdx = result.indexOf(",");
            resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
          };
          reader.onerror = () => reject(new Error("Failed to read audio"));
          reader.readAsDataURL(blob);
        });

        onAttachmentsChange([...attachments, { name: fileName, type: mimeType, size: blob.size, base64 }]);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch (err: any) {
      console.error("Mic error:", err);
    }
  }, [attachments, onAttachmentsChange]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  const actions = quickActions[intent];

  return (
    <div className="px-2 sm:px-4 pb-3 sm:pb-4 lg:pb-6">
      <div className="mx-auto max-w-3xl min-w-0">
        {/* Quick action pills */}
        {actions.length > 0 && value.trim() && (
          <div className="flex items-center gap-1.5 mb-2 animate-fade-in">
            {intent === "code" && <Code className="h-3 w-3 text-accent mr-1" />}
            {intent === "url" && <Link className="h-3 w-3 text-accent mr-1" />}
            {actions.map((a) => (
              <button
                key={a.id}
                onClick={() => onQuickAction?.(a.id, value)}
                className="flex items-center gap-1.5 rounded-lg border border-border/20 bg-card/40 backdrop-blur-sm px-2.5 py-1 text-[11px] font-light text-muted-foreground hover:bg-foreground/10 hover:text-foreground transition-all hover:scale-[1.02]"
              >
                <a.icon className="h-3 w-3" />
                {a.label}
              </button>
            ))}
          </div>
        )}

        {/* Attachment previews */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2 animate-fade-in">
            {attachments.map((file, idx) => (
              <div key={idx} className="relative group flex items-center gap-2 rounded-lg border border-border/30 bg-secondary/30 px-2.5 py-1.5 text-xs">
                {file.previewUrl ? (
                  <img src={file.previewUrl} alt={file.name} className="h-8 w-8 rounded object-cover" />
                ) : (
                  <FileText className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-muted-foreground truncate max-w-[120px]">{file.name}</span>
                <button
                  onClick={() => removeAttachment(idx)}
                  className="ml-1 p-0.5 rounded-full hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className={`flex flex-wrap items-end gap-2 sm:gap-3 rounded-2xl border ${online ? "border-border/30" : "border-amber-500/30"} bg-card/40 backdrop-blur-xl p-2 sm:p-3 transition-all min-w-0`}>
          {/* Attach button — categorized tabs (Photos / Videos / Documents / Files) */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <Popover>
            <PopoverTrigger asChild>
              <button
                disabled={disabled || isStreaming || isRecording}
                className="shrink-0 p-2 rounded-xl text-muted-foreground/60 hover:text-foreground hover:bg-foreground/5 transition-all disabled:opacity-30"
                title="Attach files, images, videos, or documents"
              >
                <Paperclip className="h-4 w-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              side="top"
              sideOffset={8}
              className="w-64 p-2 bg-card/95 backdrop-blur-xl border-border/40 rounded-2xl"
            >
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { label: "Photos", icon: ImageLucide, accept: "image/*" },
                  { label: "Videos", icon: Video, accept: "video/*" },
                  { label: "Documents", icon: FileIcon, accept: ".pdf,.doc,.docx,.txt,.md,.csv,.json,.xml,.xlsx,.xls,.ppt,.pptx,.rtf" },
                  { label: "All Files", icon: Files, accept: "*/*" },
                ].map(({ label, icon: Icon, accept }) => (
                  <button
                    key={label}
                    onClick={() => {
                      const el = fileInputRef.current;
                      if (!el) return;
                      el.setAttribute("accept", accept);
                      el.click();
                      // close popover by blurring
                      (document.activeElement as HTMLElement | null)?.blur();
                    }}
                    className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border border-border/30 bg-background/40 hover:bg-foreground/5 hover:border-border/60 transition-all text-xs font-light text-foreground"
                  >
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground/60 text-center mt-2 px-1">
                Up to 20MB per file · 10 files max
              </p>
            </PopoverContent>
          </Popover>

          {/* Voice record — orb when active, mic icon when idle */}
          {isRecording ? (
            <VoiceRecordingOrb
              size={32}
              isActive
              onClick={stopRecording}
              seconds={recordingTime}
            />
          ) : (
            <button
              onClick={startRecording}
              disabled={disabled || isStreaming}
              className="shrink-0 p-2 rounded-xl text-muted-foreground/60 hover:text-foreground hover:bg-foreground/5 transition-all disabled:opacity-30"
              title="Record voice message"
            >
              <Mic className="h-4 w-4" />
            </button>
          )}

          <div className="relative min-w-0 order-[-1] w-full sm:order-none sm:w-auto sm:flex-1">
            <SlashCommandPalette
              input={value}
              visible={value.startsWith("/") && !value.includes("\n")}
              onSelect={(cmd: SlashCommand) => {
                const args = value.slice(cmd.command.length).trim();
                if (args) {
                  const transformed = cmd.skillPrompt(args);
                  onSendMessage(transformed, attachments.length > 0 ? attachments : undefined);
                  setValue("");
                  setAttachments([]);
                } else {
                  setValue(cmd.command + " ");
                }
              }}
            />
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={online ? "Message Aureon… (try /comps, /scan, /legal)" : "Offline — messages will queue…"}
              rows={1}
              className="w-full resize-none bg-transparent text-sm font-light text-foreground placeholder:text-muted-foreground/50 outline-none max-h-32"
            />
            {value && !value.includes("\n") && !value.startsWith("/") && (
              <div className="absolute top-0 left-0 pointer-events-none text-sm font-light whitespace-pre overflow-hidden" style={{ color: "transparent" }}>
                {value}<SmartAutocomplete value={value} onAccept={acceptSuggestion} />
              </div>
            )}
          </div>
          {/* NAR — narrative-expansion mode. When on, every send is wrapped in a
              narrative frame instructing the model to reason as narrative first.
              Persisted in localStorage; visible glow when active. */}
          <button
            onClick={toggleNarrative}
            title={narrativeMode
              ? "NAR mode ON — prompts are expanded into a narrative frame before send. Click to disable."
              : "NAR mode OFF — prompts are sent verbatim. Click to enable narrative expansion."}
            aria-pressed={narrativeMode}
            className={`shrink-0 flex items-center gap-1 h-8 px-2 rounded-lg text-[10px] font-medium tracking-[0.2em] uppercase transition-all border ${
              narrativeMode
                ? "border-amber-400/60 bg-amber-400/10 text-amber-300 shadow-[0_0_12px_hsl(45_100%_60%/0.25)]"
                : "border-border/30 bg-background/30 text-muted-foreground/60 hover:text-foreground hover:border-border/60"
            }`}
          >
            <BookOpen className="h-3 w-3" strokeWidth={1.6} />
            NAR
          </button>
          {/* LAW — tri-state legal posture. AUTO detects legal questions per
              message and stands down automatically; ON forces; OFF suppresses. */}
          <button
            onClick={toggleLegal}
            title={
              lawSwitch === "on"
                ? "LAW: ALWAYS ON — every message is wrapped in the deep legal-research directive. Click for OFF."
                : lawSwitch === "off"
                  ? "LAW: OFF — legal posture never engages, even for legal questions. Click for AUTO."
                  : autoLegalArmed
                    ? "LAW: AUTO — this message reads as a legal question, so jurisdiction-aware legal research is armed for it. Click for ALWAYS ON."
                    : "LAW: AUTO — legal research engages by itself when you ask a legal question. Click for ALWAYS ON."
            }
            aria-pressed={legalActive}
            aria-label={`Legal posture: ${lawSwitch}${autoLegalArmed ? " (armed for this message)" : ""}`}
            className={`shrink-0 flex items-center gap-1 h-8 px-2 rounded-lg text-[10px] font-medium tracking-[0.2em] uppercase transition-all border ${
              legalActive
                ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-300 shadow-[0_0_12px_hsl(150_80%_50%/0.25)]"
                : lawSwitch === "off"
                  ? "border-border/20 bg-background/20 text-muted-foreground/35 hover:text-foreground/70"
                  : "border-border/30 bg-background/30 text-muted-foreground/60 hover:text-foreground hover:border-border/60"
            }`}
          >
            <Scale className="h-3 w-3" strokeWidth={1.6} />
            {lawSwitch === "on" ? "LAW" : lawSwitch === "off" ? "LAW·OFF" : autoLegalArmed ? "LAW·ON" : "LAW·AUTO"}
          </button>

          {value.trim() && (
            <button onClick={clearDraft} className="shrink-0 p-1 text-muted-foreground/40 hover:text-muted-foreground transition-colors" title="Clear draft">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          {isStreaming ? (
            <button
              onClick={onStop}
              className="shrink-0 rounded-xl bg-destructive p-2.5 text-destructive-foreground transition-all hover:bg-destructive/90 active:scale-95"
              title="Stop generating"
            >
              <Square className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={(!value.trim() && attachments.length === 0) || disabled}
              className={`shrink-0 relative ${btnShape === "square" ? "rounded-xl" : "rounded-full"} w-10 h-10 flex items-center justify-center group disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 hover:scale-[1.04] transition-transform`}
              data-no-ripple
            >
              <span className={`absolute inset-0 ${btnShape === "square" ? "rounded-xl" : "rounded-full"} animate-[sendBorderSpin_3s_linear_infinite]`}
                style={{ background: borderTheme.main }}
              />
              <span className={`absolute inset-0 ${btnShape === "square" ? "rounded-xl" : "rounded-full"} animate-[sendBorderSpin_5s_linear_infinite_reverse] opacity-30`}
                style={{ background: borderTheme.shimmer }}
              />
              <span className={`absolute inset-[2px] ${btnShape === "square" ? "rounded-[10px]" : "rounded-full"} bg-background z-[1]`}
                style={{
                  boxShadow: `inset 0 1px 4px ${borderTheme.glow}14, 0 0 12px ${borderTheme.glow}10`,
                }}
              />
              <span className={`absolute inset-[-3px] ${btnShape === "square" ? "rounded-2xl" : "rounded-full"} opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-0`}
                style={{
                  background: `radial-gradient(circle, ${borderTheme.glow}26 0%, transparent 70%)`,
                }}
              />
              <Send className="h-4 w-4 text-foreground/70 z-[2] relative group-hover:text-foreground/90 transition-colors" />
            </button>
          )}
        </div>
        <div className="mt-2 flex items-center justify-center gap-1.5">
          {!online && <WifiOff className="h-3 w-3 text-amber-400/70" />}
          <Lock className="h-3 w-3 text-emerald-500/50" />
          <p className="text-xs font-extralight text-muted-foreground/50">
            {!online ? "Offline · messages queued" : "End-to-end encrypted"}{draftSaved ? ` · ${draftSaved}` : ""} · Aureon may make mistakes
          </p>
        </div>
      </div>

      {/* Long paste modal */}
      {longPasteText && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/60 backdrop-blur-sm animate-fade-in">
          <div className="w-[420px] rounded-2xl border border-border/30 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/20">
              <ClipboardPaste className="h-4 w-4 text-accent" />
              <span className="text-sm font-light text-foreground">Large Clipboard Content</span>
              <button onClick={() => setLongPasteText(null)} className="ml-auto p-1 rounded text-muted-foreground/50 hover:text-foreground transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="px-4 py-3">
              <p className="text-[11px] text-muted-foreground/60 mb-2">
                {longPasteText.length.toLocaleString()} characters detected. How would you like to handle this?
              </p>
              <div className="rounded-lg border border-border/20 bg-background/30 p-2 max-h-[120px] overflow-y-auto">
                <p className="text-[10px] text-muted-foreground/40 font-mono whitespace-pre-wrap break-all line-clamp-6">
                  {longPasteText.slice(0, 600)}{longPasteText.length > 600 ? "…" : ""}
                </p>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-border/20 flex items-center gap-2">
              <button
                onClick={handleLongPasteAsFile}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-light bg-accent/15 text-accent hover:bg-accent/25 transition-colors border border-accent/20"
              >
                <FileUp className="h-3.5 w-3.5" />
                Attach as file
              </button>
              <button
                onClick={handleLongPasteInline}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-light bg-foreground/5 text-foreground/70 hover:bg-foreground/10 transition-colors border border-border/20"
              >
                <ClipboardPaste className="h-3.5 w-3.5" />
                Paste inline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

AdaptiveInputBar.displayName = "AdaptiveInputBar";

export default AdaptiveInputBar;
