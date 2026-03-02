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
      console.log("ElevenLabs message:", message?.type);
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
      // Request microphone permission first (must be in click handler)
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      // Stop the test stream immediately — SDK will create its own
      stream.getTracks().forEach(t => t.stop());

      // Get a signed token from the edge function for authenticated WebRTC
      const { data, error: fnError } = await supabase.functions.invoke(
        "elevenlabs-conversation-token",
        { body: { agentId } }
      );

      if (fnError || !data?.token) {
        throw new Error(fnError?.message || "Failed to get conversation token");
      }

      // Start session with conversationToken (authenticated, reliable WebRTC)
      await conversation.startSession({
        conversationToken: data.token,
        connectionType: "webrtc",
      });
    } catch (e: any) {
      console.error("Voice connect error:", e);
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
