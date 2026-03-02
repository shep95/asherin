import { useState, useRef, useCallback, useEffect } from "react";

type VoiceStatus = "idle" | "connecting" | "connected" | "error";

interface UseGeminiVoiceOptions {
  systemInstruction?: string;
  voiceName?: string;
}

// PCM audio utilities
function float32ToPcm16Base64(float32: Float32Array): string {
  const pcm16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(pcm16.buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function resampleTo16k(audioBuffer: AudioBuffer): Float32Array {
  const inputRate = audioBuffer.sampleRate;
  const inputData = audioBuffer.getChannelData(0);
  const outputRate = 16000;
  const ratio = inputRate / outputRate;
  const outputLength = Math.ceil(inputData.length / ratio);
  const output = new Float32Array(outputLength);
  for (let i = 0; i < outputLength; i++) {
    const srcIdx = i * ratio;
    const idx = Math.floor(srcIdx);
    const frac = srcIdx - idx;
    output[i] = idx + 1 < inputData.length
      ? inputData[idx] * (1 - frac) + inputData[idx + 1] * frac
      : inputData[idx];
  }
  return output;
}

function pcm16Base64ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const pcm16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(pcm16.length);
  for (let i = 0; i < pcm16.length; i++) {
    float32[i] = pcm16[i] / 32768;
  }
  return float32;
}

export function useGeminiVoice(options: UseGeminiVoiceOptions = {}) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const playbackQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);
  const setupCompleteRef = useRef(false);

  // Play audio queue
  const playNextChunk = useCallback(() => {
    if (playbackQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setIsSpeaking(false);
      return;
    }
    isPlayingRef.current = true;
    setIsSpeaking(true);

    const chunk = playbackQueueRef.current.shift()!;
    const ctx = playbackCtxRef.current;
    if (!ctx) return;

    const buffer = ctx.createBuffer(1, chunk.length, 24000);
    buffer.getChannelData(0).set(chunk);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => playNextChunk();
    source.start();
  }, []);

  const queueAudio = useCallback((base64: string) => {
    const float32 = pcm16Base64ToFloat32(base64);
    playbackQueueRef.current.push(float32);
    if (!isPlayingRef.current) {
      playNextChunk();
    }
  }, [playNextChunk]);

  const connect = useCallback(async () => {
    setError(null);
    setStatus("connecting");
    setTranscript("");
    setupCompleteRef.current = false;

    try {
      // Get WebSocket URL from edge function
      const tokenResp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gemini-voice-token`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );

      if (!tokenResp.ok) {
        throw new Error("Failed to get voice session token");
      }

      const { wsUrl, model } = await tokenResp.json();

      // Request microphone
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;

      // Create audio contexts
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = audioCtx;
      playbackCtxRef.current = new AudioContext({ sampleRate: 24000 });

      // Connect WebSocket
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      // Timeout if connection doesn't establish within 15s
      const connectTimeout = setTimeout(() => {
        if (!setupCompleteRef.current) {
          console.error("Voice connection timed out");
          setError("Connection timed out. Please try again.");
          setStatus("error");
          ws.close();
          cleanup();
        }
      }, 15000);

      ws.onopen = () => {
        console.log("WS opened, sending setup...");
        const setupMsg: any = {
          setup: {
            model: `models/${model}`,
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: options.voiceName || "Aoede",
                  },
                },
              },
            },
          },
        };

        if (options.systemInstruction) {
          setupMsg.setup.systemInstruction = {
            parts: [{ text: options.systemInstruction }],
          };
        }

        ws.send(JSON.stringify(setupMsg));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          console.log("WS message received:", JSON.stringify(msg).slice(0, 300));

          // Setup complete
          if (msg.setupComplete) {
            console.log("Gemini voice setup complete");
            clearTimeout(connectTimeout);
            setupCompleteRef.current = true;
            setStatus("connected");
            startAudioCapture(audioCtx, stream, ws);
            return;
          }

          // Server content (audio or text)
          if (msg.serverContent) {
            const parts = msg.serverContent.modelTurn?.parts;
            if (parts) {
              for (const part of parts) {
                if (part.inlineData?.mimeType?.startsWith("audio/")) {
                  queueAudio(part.inlineData.data);
                }
                if (part.text) {
                  setTranscript((prev) => prev + part.text);
                }
              }
            }
          }
        } catch (e) {
          console.error("WS message parse error:", e);
        }
      };

      ws.onerror = (ev) => {
        console.error("WS error event:", ev);
        setError("Voice connection error");
        setStatus("error");
      };

      ws.onclose = (ev) => {
        console.log("WS closed — code:", ev.code, "reason:", ev.reason, "wasClean:", ev.wasClean);
        if (!setupCompleteRef.current) {
          setError(`Connection closed (code ${ev.code}). Check API key or model.`);
          setStatus("error");
        } else {
          setStatus("idle");
        }
        cleanup();
      };
    } catch (e: any) {
      console.error("Voice connect error:", e);
      setError(e.message || "Failed to connect");
      setStatus("error");
      cleanup();
    }
  }, [options.systemInstruction, options.voiceName, queueAudio]);

  function startAudioCapture(audioCtx: AudioContext, stream: MediaStream, ws: WebSocket) {
    const source = audioCtx.createMediaStreamSource(stream);
    // 4096 samples at 16kHz = 256ms chunks
    const processor = audioCtx.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;

    processor.onaudioprocess = (e) => {
      if (ws.readyState !== WebSocket.OPEN || !setupCompleteRef.current) return;

      const inputData = e.inputBuffer.getChannelData(0);
      // Resample if needed
      const pcmData = e.inputBuffer.sampleRate !== 16000
        ? resampleTo16k(e.inputBuffer)
        : new Float32Array(inputData);

      const base64 = float32ToPcm16Base64(pcmData);

      ws.send(
        JSON.stringify({
          realtimeInput: {
            mediaChunks: [
              {
                mimeType: "audio/pcm;rate=16000",
                data: base64,
              },
            ],
          },
        })
      );
    };

    source.connect(processor);
    processor.connect(audioCtx.destination);
  }

  function cleanup() {
    // Stop mic
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    // Close processor
    processorRef.current?.disconnect();
    processorRef.current = null;

    // Close audio contexts
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    playbackCtxRef.current?.close().catch(() => {});
    playbackCtxRef.current = null;

    // Clear playback queue
    playbackQueueRef.current = [];
    isPlayingRef.current = false;
    setIsSpeaking(false);
  }

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    cleanup();
    setStatus("idle");
    setTranscript("");
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      wsRef.current?.close();
      cleanup();
    };
  }, []);

  return {
    status,
    isSpeaking,
    transcript,
    error,
    connect,
    disconnect,
    isConnected: status === "connected",
  };
}
