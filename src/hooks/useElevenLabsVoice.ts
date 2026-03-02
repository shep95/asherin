import { useConversation } from "@elevenlabs/react";
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

type VoiceStatus = "idle" | "connecting" | "connected" | "error";

interface UseElevenLabsVoiceOptions {
  agentId: string;
}

export function useElevenLabsVoice({ agentId }: UseElevenLabsVoiceOptions) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");

  const conversation = useConversation({
    onConnect: () => {
      console.log("ElevenLabs voice connected");
      setStatus("connected");
      setError(null);
    },
    onDisconnect: () => {
      console.log("ElevenLabs voice disconnected");
      setStatus("idle");
    },
    onMessage: (message: any) => {
      if (message?.type === "agent_response") {
        const text = message?.agent_response_event?.agent_response;
        if (text) setTranscript(text);
      }
      if (message?.type === "user_transcript") {
        const text = message?.user_transcription_event?.user_transcript;
        if (text) setTranscript(text);
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
    setTranscript("");

    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Get signed URL from edge function
      const { data, error: fnError } = await supabase.functions.invoke(
        "elevenlabs-conversation-token",
        { body: { agentId } }
      );

      if (fnError || !data?.token) {
        throw new Error(fnError?.message || data?.error || "Failed to get voice session");
      }

      await conversation.startSession({
        conversationToken: data.token,
      });
    } catch (e: any) {
      console.error("Voice connect error:", e);
      setError(e.message || "Failed to connect");
      setStatus("error");
    }
  }, [agentId, conversation]);

  const disconnect = useCallback(async () => {
    await conversation.endSession();
    setStatus("idle");
    setTranscript("");
  }, [conversation]);

  return {
    status,
    isSpeaking: conversation.isSpeaking,
    transcript,
    error,
    connect,
    disconnect,
    isConnected: status === "connected",
  };
}
