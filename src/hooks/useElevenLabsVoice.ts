import { useConversation } from "@elevenlabs/react";
import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

type VoiceStatus = "idle" | "connecting" | "connected" | "error";

interface TranscriptEntry {
  role: "user" | "agent";
  text: string;
  timestamp: number;
}

interface UseElevenLabsVoiceOptions {
  agentId: string;
}

export function useElevenLabsVoice({ agentId }: UseElevenLabsVoiceOptions) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [currentText, setCurrentText] = useState("");
  const [transcriptLog, setTranscriptLog] = useState<TranscriptEntry[]>([]);
  const [userSpeechIndicator, setUserSpeechIndicator] = useState(false);
  const micStreamRef = useRef<MediaStream | null>(null);

  const conversation = useConversation({
    onConnect: () => {
      console.log("ElevenLabs voice connected");
      setStatus("connected");
      setError(null);
    },
    onDisconnect: () => {
      console.log("ElevenLabs voice disconnected");
      setStatus("idle");
      // Stop mic stream on disconnect
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    },
    onMessage: (message: any) => {
      console.log("ElevenLabs message:", message?.type, message);

      if (message?.type === "user_transcript") {
        const text = message?.user_transcription_event?.user_transcript;
        if (text) {
          setCurrentText(text);
          setUserSpeechIndicator(true);
          setTranscriptLog((prev) => [
            ...prev,
            { role: "user", text, timestamp: Date.now() },
          ]);
          // Reset indicator after a beat
          setTimeout(() => setUserSpeechIndicator(false), 1500);
        }
      }

      if (message?.type === "agent_response") {
        const text = message?.agent_response_event?.agent_response;
        if (text) {
          setCurrentText(text);
          setTranscriptLog((prev) => [
            ...prev,
            { role: "agent", text, timestamp: Date.now() },
          ]);
        }
      }
    },
    onError: (err) => {
      console.error("ElevenLabs voice error:", err);
      setError(typeof err === "string" ? err : "Voice connection error");
      setStatus("error");
    },
  });

  const connect = useCallback(async () => {
    setError(null);
    setStatus("connecting");
    setCurrentText("");
    setTranscriptLog([]);

    try {
      // 1. Acquire mic in click-handler context and KEEP the stream alive
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      micStreamRef.current = stream;

      // 2. Get a signed token
      const { data, error: fnError } = await supabase.functions.invoke(
        "elevenlabs-conversation-token",
        { body: { agentId } },
      );

      if (fnError || !data?.token) {
        stream.getTracks().forEach((t) => t.stop());
        throw new Error(fnError?.message || "Failed to get conversation token");
      }

      // 3. Start session with the token
      await conversation.startSession({
        conversationToken: data.token,
        overrides: {
          tts: {
            voiceId: "nju8YCEndVfEz7rGwcgK",
          },
        },
      });
    } catch (e: any) {
      console.error("Voice connect error:", e);
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
      if (e.name === "NotAllowedError") {
        setError("Microphone access denied. Check browser permissions.");
      } else {
        setError(e.message || "Failed to connect");
      }
      setStatus("error");
    }
  }, [agentId, conversation]);

  const disconnect = useCallback(async () => {
    await conversation.endSession();
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    setStatus("idle");
  }, [conversation]);

  const downloadTranscript = useCallback(() => {
    if (transcriptLog.length === 0) return;
    const lines = transcriptLog.map(
      (e) =>
        `[${new Date(e.timestamp).toLocaleTimeString()}] ${e.role === "user" ? "You" : "Asherin"}: ${e.text}`,
    );
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `asherin-transcript-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [transcriptLog]);

  return {
    status,
    isSpeaking: conversation.isSpeaking,
    currentText,
    transcriptLog,
    userSpeechIndicator,
    error,
    connect,
    disconnect,
    downloadTranscript,
    isConnected: status === "connected",
    getInputVolume: conversation.getInputVolume,
    getOutputVolume: conversation.getOutputVolume,
  };
}
