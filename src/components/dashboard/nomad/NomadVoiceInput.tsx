import { useState, useRef, useCallback } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";

interface NomadVoiceInputProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

const NomadVoiceInput = ({ onTranscript, disabled }: NomadVoiceInputProps) => {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const recognitionRef = useRef<any>(null);

  const toggle = useCallback(() => {
    if (recording) {
      recognitionRef.current?.stop();
      setRecording(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      onTranscript("[Voice input not supported in this browser]");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = () => setRecording(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onTranscript(transcript);
      setRecording(false);
    };
    recognition.onerror = () => setRecording(false);
    recognition.onend = () => setRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
  }, [recording, onTranscript]);

  return (
    <button
      onClick={toggle}
      disabled={disabled || processing}
      className={`flex items-center justify-center rounded-xl p-2 transition-all ${
        recording
          ? "text-destructive bg-destructive/10 animate-pulse"
          : "text-muted-foreground/50 hover:text-muted-foreground"
      } disabled:opacity-30`}
      title={recording ? "Stop recording" : "Voice input"}
    >
      {processing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : recording ? (
        <MicOff className="h-4 w-4" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </button>
  );
};

export default NomadVoiceInput;
