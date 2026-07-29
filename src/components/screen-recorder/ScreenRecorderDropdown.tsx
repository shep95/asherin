import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Monitor, Mic, MicOff, Camera, CameraOff, Square, Download,
  ChevronDown, Circle, Pause, Play, Volume2, Clock,
  Maximize2, PictureInPicture2, MousePointer2, RotateCcw,
  Check, AlertCircle, GripVertical
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from "@/components/ui/dropdown-menu";

type RecordingState = "idle" | "recording" | "paused";
type RecordingMode = "screen" | "screen+cam" | "cam-only";
type CamShape = "rounded-rect" | "rounded";

interface DeviceInfo {
  deviceId: string;
  label: string;
}

const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
};

const ScreenRecorderDropdown = () => {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<RecordingState>("idle");
  const [mode, setMode] = useState<RecordingMode>("screen");
  const [elapsed, setElapsed] = useState(0);
  const [micEnabled, setMicEnabled] = useState(true);
  const [camShape, setCamShape] = useState<CamShape>("rounded-rect");
  const [showCursor, setShowCursor] = useState(true);
  const [countdown, setCountdown] = useState(0);
  const [countdownDelay, setCountdownDelay] = useState(3);
  const [quality, setQuality] = useState<"high" | "medium" | "low">("high");
  const [micLevel, setMicLevel] = useState(0);
  const [micWaveform, setMicWaveform] = useState<number[]>(new Array(32).fill(0));
  const [testingMic, setTestingMic] = useState(false);
  const [camPreviewing, setCamPreviewing] = useState(false);
  const [tab, setTab] = useState<"record" | "devices" | "settings">("record");
  const [permError, setPermError] = useState<string>("");

  // Floating cam overlay
  const [overlayPos, setOverlayPos] = useState({ x: 24, y: window.innerHeight - 220 });
  const draggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const floatingCamRef = useRef<HTMLVideoElement>(null);

  // Devices
  const [audioInputs, setAudioInputs] = useState<DeviceInfo[]>([]);
  const [videoInputs, setVideoInputs] = useState<DeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<DeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState("");
  const [selectedCam, setSelectedCam] = useState("");
  const [selectedSpeaker, setSelectedSpeaker] = useState("");

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const displayStreamRef = useRef<MediaStream | null>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const compositeStreamRef = useRef<MediaStream | null>(null);
  const compositeRafRef = useRef<{ cancel: () => void } | null>(null);
  const compositeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const micTestRef = useRef<{ stream: MediaStream; ctx: AudioContext; analyser: AnalyserNode; raf: number } | null>(null);
  const devCamPreviewRef = useRef<HTMLVideoElement>(null);
  const devCamStreamRef = useRef<MediaStream | null>(null);

  // Enumerate devices (only after permission granted)
  const refreshDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioInputs(devices.filter(d => d.kind === "audioinput" && d.deviceId).map(d => ({ deviceId: d.deviceId, label: d.label || `Microphone ${d.deviceId.slice(0, 6)}` })));
      setVideoInputs(devices.filter(d => d.kind === "videoinput" && d.deviceId).map(d => ({ deviceId: d.deviceId, label: d.label || `Camera ${d.deviceId.slice(0, 6)}` })));
      setAudioOutputs(devices.filter(d => d.kind === "audiooutput" && d.deviceId).map(d => ({ deviceId: d.deviceId, label: d.label || `Speaker ${d.deviceId.slice(0, 6)}` })));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (open) refreshDevices();
  }, [open, refreshDevices]);

  // Listen for device changes
  useEffect(() => {
    const handler = () => refreshDevices();
    navigator.mediaDevices?.addEventListener?.("devicechange", handler);
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", handler);
  }, [refreshDevices]);

  // ─────────── MIC TEST (gesture-bound) ───────────
  const startMicTest = useCallback(async () => {
    if (micTestRef.current) return;
    setPermError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedMic ? { deviceId: { exact: selectedMic } } : true,
      });
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      source.connect(analyser);
      const freqData = new Uint8Array(analyser.frequencyBinCount);
      const timeData = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteFrequencyData(freqData);
        analyser.getByteTimeDomainData(timeData);
        const avg = freqData.reduce((a, b) => a + b, 0) / freqData.length;
        setMicLevel(Math.min(100, Math.round((avg / 128) * 100)));
        const bars: number[] = [];
        const step = Math.floor(timeData.length / 32);
        for (let i = 0; i < 32; i++) {
          const val = Math.abs(timeData[i * step] - 128) / 128;
          bars.push(val);
        }
        setMicWaveform(bars);
        if (micTestRef.current) {
          micTestRef.current.raf = requestAnimationFrame(tick);
        }
      };
      micTestRef.current = { stream, ctx, analyser, raf: requestAnimationFrame(tick) };
      setTestingMic(true);
      // Refresh device labels now that permission is granted
      refreshDevices();
    } catch (err: any) {
      setPermError(err.name === "NotAllowedError" ? "Microphone access denied. Allow it in browser settings." : err.name === "NotFoundError" ? "No microphone found." : "Microphone error: " + err.message);
    }
  }, [selectedMic, refreshDevices]);

  const stopMicTest = useCallback(() => {
    if (!micTestRef.current) return;
    cancelAnimationFrame(micTestRef.current.raf);
    micTestRef.current.stream.getTracks().forEach(t => t.stop());
    micTestRef.current.ctx.close().catch(() => {});
    micTestRef.current = null;
    setTestingMic(false);
    setMicLevel(0);
    setMicWaveform(new Array(32).fill(0));
  }, []);

  // ─────────── CAM PREVIEW (gesture-bound) ───────────
  const startCamPreview = useCallback(async () => {
    setPermError("");
    try {
      // Stop existing if any
      devCamStreamRef.current?.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: selectedCam ? { deviceId: { exact: selectedCam } } : { width: 1280, height: 720 },
      });
      devCamStreamRef.current = stream;
      if (devCamPreviewRef.current) {
        devCamPreviewRef.current.srcObject = stream;
        devCamPreviewRef.current.play().catch(() => {});
      }
      setCamPreviewing(true);
      refreshDevices();
    } catch (err: any) {
      setPermError(err.name === "NotAllowedError" ? "Camera access denied. Allow it in browser settings." : err.name === "NotFoundError" ? "No camera found." : "Camera error: " + err.message);
    }
  }, [selectedCam, refreshDevices]);

  const stopCamPreview = useCallback(() => {
    devCamStreamRef.current?.getTracks().forEach(t => t.stop());
    devCamStreamRef.current = null;
    if (devCamPreviewRef.current) devCamPreviewRef.current.srcObject = null;
    setCamPreviewing(false);
  }, []);

  // Restart preview when device changes
  useEffect(() => {
    if (camPreviewing) {
      startCamPreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCam]);

  useEffect(() => {
    if (testingMic) {
      stopMicTest();
      setTimeout(() => startMicTest(), 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMic]);

  // Cleanup
  useEffect(() => () => {
    stopMicTest();
    stopCamPreview();
    displayStreamRef.current?.getTracks().forEach(t => t.stop());
    camStreamRef.current?.getTracks().forEach(t => t.stop());
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    if (compositeRafRef.current) compositeRafRef.current.cancel();
    if (timerRef.current) clearInterval(timerRef.current);
  }, [stopMicTest, stopCamPreview]);

  // Sync floating cam stream when recording with cam
  useEffect(() => {
    if (state === "recording" && (mode === "screen+cam") && camStreamRef.current && floatingCamRef.current) {
      floatingCamRef.current.srcObject = camStreamRef.current;
      floatingCamRef.current.play().catch(() => {});
    }
  }, [state, mode]);

  // Drag handlers for floating cam
  const onOverlayMouseDown = (e: React.MouseEvent) => {
    draggingRef.current = true;
    dragOffsetRef.current = { x: e.clientX - overlayPos.x, y: e.clientY - overlayPos.y };
    const onMove = (ev: MouseEvent) => {
      if (!draggingRef.current) return;
      const x = Math.max(8, Math.min(window.innerWidth - 200, ev.clientX - dragOffsetRef.current.x));
      const y = Math.max(8, Math.min(window.innerHeight - 200, ev.clientY - dragOffsetRef.current.y));
      setOverlayPos({ x, y });
    };
    const onUp = () => {
      draggingRef.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // ─────────── RECORDING ───────────
  const stopRecording = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    try { mediaRecorderRef.current?.stop(); } catch {}
  }, []);

  const startRecording = useCallback(async () => {
    setPermError("");
    stopMicTest();
    chunksRef.current = [];
    setElapsed(0);

    try {
      // ─── 1. Acquire all streams INSIDE gesture (no awaits before getUserMedia for cam) ───
      let displayStream: MediaStream | null = null;
      let camStream: MediaStream | null = null;
      let micStream: MediaStream | null = null;

      // Screen first (it shows browser picker — must be from gesture)
      if (mode !== "cam-only") {
        displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: showCursor ? "always" : "never", frameRate: 30 } as any,
          audio: true,
        });
        displayStreamRef.current = displayStream;
        displayStream.getVideoTracks()[0].addEventListener("ended", () => stopRecording());
      }

      // Camera
      if (mode === "screen+cam" || mode === "cam-only") {
        camStream = await navigator.mediaDevices.getUserMedia({
          video: selectedCam ? { deviceId: { exact: selectedCam }, width: 1280, height: 720 } : { width: 1280, height: 720 },
        });
        camStreamRef.current = camStream;
      }

      // Mic
      if (micEnabled) {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: selectedMic ? { deviceId: { exact: selectedMic }, echoCancellation: true, noiseSuppression: true } : { echoCancellation: true, noiseSuppression: true },
        });
        micStreamRef.current = micStream;
      }

      // ─── 2. Countdown (after permissions granted) ───
      if (countdownDelay > 0) {
        for (let i = countdownDelay; i > 0; i--) {
          setCountdown(i);
          await new Promise(r => setTimeout(r, 1000));
        }
        setCountdown(0);
      }

      // ─── 3. Build the final stream ───
      let finalVideoStream: MediaStream;

      if (mode === "screen+cam" && displayStream && camStream) {
        // Composite via canvas: screen as background + cam as floating overlay
        const screenTrack = displayStream.getVideoTracks()[0];
        const settings = screenTrack.getSettings();
        const w = settings.width || 1920;
        const h = settings.height || 1080;

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        compositeCanvasRef.current = canvas;
        const cctx = canvas.getContext("2d")!;

        const screenVideo = document.createElement("video");
        screenVideo.srcObject = displayStream;
        screenVideo.muted = true;
        screenVideo.playsInline = true;
        (screenVideo as any).disablePictureInPicture = true;
        await screenVideo.play();

        const camVideo = document.createElement("video");
        camVideo.srcObject = camStream;
        camVideo.muted = true;
        camVideo.playsInline = true;
        await camVideo.play();

        // Base size from screen short edge
        const baseSize = Math.round(Math.min(w, h) * 0.18);
        const camMargin = Math.round(baseSize * 0.15);

        let stopDraw = false;
        const draw = () => {
          if (stopDraw) return;
          cctx.drawImage(screenVideo, 0, 0, w, h);

          // Use camera's actual aspect ratio to prevent squishing
          const camVW = camVideo.videoWidth || 640;
          const camVH = camVideo.videoHeight || 480;
          const camAspect = camVW / camVH;

          // Destination box on canvas: square for circle, aspect-correct for rounded rect
          let destW: number;
          let destH: number;
          if (camShape === "rounded") {
            // Circle — keep square
            destW = baseSize;
            destH = baseSize;
          } else {
            // Rounded rect — preserve camera aspect ratio
            destW = Math.round(baseSize * 1.5);
            destH = Math.round(destW / camAspect);
          }

          const cx = w - destW - camMargin;
          const cy = h - destH - camMargin;

          // Source crop from camera (center-crop to match destination aspect)
          const destAspect = destW / destH;
          let srcW = camVW;
          let srcH = camVH;
          let srcX = 0;
          let srcY = 0;
          if (camAspect > destAspect) {
            // Camera wider than dest — crop sides
            srcW = camVH * destAspect;
            srcX = (camVW - srcW) / 2;
          } else if (camAspect < destAspect) {
            // Camera taller than dest — crop top/bottom
            srcH = camVW / destAspect;
            srcY = (camVH - srcH) / 2;
          }

          cctx.save();
          cctx.beginPath();
          if (camShape === "rounded") {
            cctx.arc(cx + destW / 2, cy + destH / 2, Math.min(destW, destH) / 2, 0, Math.PI * 2);
          } else {
            const r = Math.min(destW, destH) * 0.12;
            cctx.moveTo(cx + r, cy);
            cctx.arcTo(cx + destW, cy, cx + destW, cy + destH, r);
            cctx.arcTo(cx + destW, cy + destH, cx, cy + destH, r);
            cctx.arcTo(cx, cy + destH, cx, cy, r);
            cctx.arcTo(cx, cy, cx + destW, cy, r);
            cctx.closePath();
          }
          cctx.clip();
          // Mirror horizontally
          cctx.translate(cx + destW, cy);
          cctx.scale(-1, 1);
          cctx.drawImage(camVideo, srcX, srcY, srcW, srcH, 0, 0, destW, destH);
          cctx.restore();
        };

        // CRITICAL: requestVideoFrameCallback fires per actual video frame
        // and KEEPS FIRING when the tab is hidden — unlike requestAnimationFrame
        // which throttles to 1Hz on background tabs. This is what makes the
        // recording continue when you switch away to record another tab/window.
        const hasVFC = typeof (screenVideo as any).requestVideoFrameCallback === "function";
        if (hasVFC) {
          const onFrame = () => {
            if (stopDraw) return;
            draw();
            (screenVideo as any).requestVideoFrameCallback(onFrame);
          };
          (screenVideo as any).requestVideoFrameCallback(onFrame);
        } else {
          // Fallback: setInterval (also throttled in background but better than rAF)
          const id = window.setInterval(() => {
            if (stopDraw) { window.clearInterval(id); return; }
            draw();
          }, 1000 / 30);
        }
        // Track stop flag via the existing ref slot
        compositeRafRef.current = { cancel: () => { stopDraw = true; } } as any;

        finalVideoStream = canvas.captureStream(30);
      } else if (mode === "cam-only" && camStream) {
        finalVideoStream = camStream;
      } else if (displayStream) {
        finalVideoStream = displayStream;
      } else {
        throw new Error("No video source");
      }

      // ─── 4. Mix audio ───
      const audioCtx = new AudioContext();
      const dest = audioCtx.createMediaStreamDestination();
      let hasAudio = false;
      if (micStream && micStream.getAudioTracks().length) {
        audioCtx.createMediaStreamSource(micStream).connect(dest);
        hasAudio = true;
      }
      if (displayStream && displayStream.getAudioTracks().length) {
        audioCtx.createMediaStreamSource(displayStream).connect(dest);
        hasAudio = true;
      }

      const tracks: MediaStreamTrack[] = [
        ...finalVideoStream.getVideoTracks(),
        ...(hasAudio ? dest.stream.getAudioTracks() : []),
      ];
      const combinedStream = new MediaStream(tracks);
      compositeStreamRef.current = combinedStream;

      // ─── 5. MediaRecorder ───
      const qualityMap = { high: 8000000, medium: 4000000, low: 1500000 };
      const mimeCandidates = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
        "video/mp4",
      ];
      const mimeType = mimeCandidates.find(m => MediaRecorder.isTypeSupported(m)) || "";

      const recorder = new MediaRecorder(combinedStream, {
        ...(mimeType ? { mimeType } : {}),
        videoBitsPerSecond: qualityMap[quality],
      });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || "video/webm" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        const ext = (mimeType.includes("mp4") ? "mp4" : "webm");
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        a.download = `aureon-recording-${timestamp}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 5000);

        // Cleanup
        if (compositeRafRef.current) { compositeRafRef.current.cancel(); compositeRafRef.current = null; }
        displayStreamRef.current?.getTracks().forEach(t => t.stop());
        camStreamRef.current?.getTracks().forEach(t => t.stop());
        micStreamRef.current?.getTracks().forEach(t => t.stop());
        audioCtx.close().catch(() => {});
        displayStreamRef.current = null;
        camStreamRef.current = null;
        micStreamRef.current = null;
        compositeStreamRef.current = null;
        setState("idle");
        setElapsed(0);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      setState("recording");
      setOpen(false); // Close dropdown so user sees their content
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } catch (err: any) {
      const isCancel = err.name === "NotAllowedError" && /denied by (system|user)|permission denied/i.test(err.message || "");
      // Don't log user cancellations as errors — it's expected behavior
      if (!isCancel) console.error("Recording failed:", err);
      setPermError(
        err.name === "NotAllowedError"
          ? (isCancel
              ? "Recording cancelled — you closed the screen-share picker. Click Start to try again."
              : "Permission denied. Allow screen, camera, or microphone access in your browser settings.")
        : err.name === "NotFoundError" ? "Required device not found. Check your camera/microphone is connected."
        : err.name === "NotReadableError" ? "Device is busy — another app (Zoom, Meet, etc.) is using your camera or mic. Close it and retry."
        : err.name === "AbortError" ? "Recording was aborted. Try again."
        : `Recording failed: ${err.message || "Unknown error"}`
      );
      // Cleanup partial streams
      displayStreamRef.current?.getTracks().forEach(t => t.stop());
      camStreamRef.current?.getTracks().forEach(t => t.stop());
      micStreamRef.current?.getTracks().forEach(t => t.stop());
      displayStreamRef.current = null;
      camStreamRef.current = null;
      micStreamRef.current = null;
      setState("idle");
      setCountdown(0);
      setOpen(true); // Re-open dropdown so user sees the error message
    }
  }, [mode, micEnabled, selectedMic, selectedCam, showCursor, countdownDelay, quality, camShape, stopMicTest, stopRecording]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.pause();
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setState("paused");
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "paused") {
      mediaRecorderRef.current.resume();
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
      setState("recording");
    }
  }, []);

  const isRecording = state === "recording" || state === "paused";
  const showFloatingCam = isRecording && mode === "screen+cam" && camStreamRef.current;
  const showFloatingControls = isRecording;

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger className="px-4 py-2 sm:py-2.5 flex items-center gap-1.5 text-sm font-light tracking-wide text-muted-foreground transition-colors hover:text-foreground hover:bg-card/80 outline-none">
          {isRecording ? (
            <span className="flex items-center gap-1.5">
              <Circle className="h-2.5 w-2.5 fill-red-500 text-red-500 animate-pulse" />
              <span className="text-red-400 font-mono text-xs">{formatTime(elapsed)}</span>
            </span>
          ) : (
            <>
              <Monitor className="h-3.5 w-3.5" />
              Record
            </>
          )}
          <ChevronDown className="h-3 w-3" />
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          sideOffset={8}
          className="w-[340px] bg-card/95 backdrop-blur-xl border-border/30 p-0 rounded-2xl shadow-2xl animate-fade-in overflow-hidden"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {/* Tab bar */}
          <div className="flex border-b border-border/15">
            {(["record", "devices", "settings"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2.5 text-[10px] uppercase tracking-[0.15em] font-medium transition-colors ${
                  tab === t ? "text-foreground border-b border-foreground/50" : "text-muted-foreground/50 hover:text-muted-foreground"
                }`}
              >
                {t === "record" ? "Record" : t === "devices" ? "Devices" : "Settings"}
              </button>
            ))}
          </div>

          <div className="p-3 space-y-3 max-h-[70vh] overflow-y-auto scrollbar-hide">
            {permError && (
              <div className="flex items-start gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-[10px] text-red-300">
                <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
                <span>{permError}</span>
              </div>
            )}

            {/* ═══ RECORD TAB ═══ */}
            {tab === "record" && (
              <>
                {/* Mode */}
                <div className="space-y-1.5">
                  <p className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground/50 font-medium">Mode</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {([
                      { id: "screen" as const, icon: Monitor, label: "Screen" },
                      { id: "screen+cam" as const, icon: PictureInPicture2, label: "Screen + Cam" },
                      { id: "cam-only" as const, icon: Camera, label: "Camera" },
                    ]).map(m => (
                      <button
                        key={m.id}
                        onClick={() => setMode(m.id)}
                        disabled={isRecording}
                        className={`flex flex-col items-center gap-1 py-2.5 rounded-xl text-[10px] font-light transition-all ${
                          mode === m.id
                            ? "bg-foreground/10 text-foreground border border-foreground/20"
                            : "text-muted-foreground/60 hover:text-foreground/80 hover:bg-foreground/5 border border-transparent"
                        } disabled:opacity-40`}
                      >
                        <m.icon className="h-4 w-4" />
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quick toggles */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setMicEnabled(!micEnabled)}
                    disabled={isRecording}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-light transition-all border flex-1 justify-center ${
                      micEnabled
                        ? "bg-foreground/10 text-foreground border-foreground/20"
                        : "text-muted-foreground/50 border-border/15 hover:bg-foreground/5"
                    } disabled:opacity-40`}
                  >
                    {micEnabled ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
                    Mic
                  </button>
                  <button
                    onClick={() => setShowCursor(!showCursor)}
                    disabled={isRecording || mode === "cam-only"}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-light transition-all border flex-1 justify-center ${
                      showCursor
                        ? "bg-foreground/10 text-foreground border-foreground/20"
                        : "text-muted-foreground/50 border-border/15 hover:bg-foreground/5"
                    } disabled:opacity-40`}
                  >
                    <MousePointer2 className="h-3 w-3" />
                    Cursor
                  </button>
                </div>

                {/* Camera shape */}
                {(mode === "screen+cam" || mode === "cam-only") && (
                  <div className="space-y-1.5">
                    <p className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground/50 font-medium">Camera Shape</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        onClick={() => setCamShape("rounded-rect")}
                        disabled={isRecording}
                        className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-light transition-all border ${
                          camShape === "rounded-rect"
                            ? "bg-foreground/10 text-foreground border-foreground/20"
                            : "text-muted-foreground/50 border-border/15 hover:bg-foreground/5"
                        } disabled:opacity-40`}
                      >
                        <div className="w-4 h-3 rounded border border-current" />
                        Rounded Rect
                      </button>
                      <button
                        onClick={() => setCamShape("rounded")}
                        disabled={isRecording}
                        className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-light transition-all border ${
                          camShape === "rounded"
                            ? "bg-foreground/10 text-foreground border-foreground/20"
                            : "text-muted-foreground/50 border-border/15 hover:bg-foreground/5"
                        } disabled:opacity-40`}
                      >
                        <div className="w-3.5 h-3.5 rounded-full border border-current" />
                        Circle
                      </button>
                    </div>
                  </div>
                )}

                {/* Main action */}
                <div className="pt-1">
                  {state === "idle" ? (
                    <button
                      onClick={startRecording}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all text-sm font-light tracking-wide"
                    >
                      <Circle className="h-4 w-4 fill-red-500" />
                      Start Recording
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-center gap-2 py-1">
                        <Circle className="h-2 w-2 fill-red-500 text-red-500 animate-pulse" />
                        <span className="font-mono text-lg text-foreground/80 tracking-widest">{formatTime(elapsed)}</span>
                        {state === "paused" && <span className="text-[9px] uppercase tracking-wider text-amber-400">Paused</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        {state === "recording" ? (
                          <button onClick={pauseRecording} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/25 hover:bg-amber-500/25 transition-all text-xs font-light">
                            <Pause className="h-3.5 w-3.5" /> Pause
                          </button>
                        ) : (
                          <button onClick={resumeRecording} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25 transition-all text-xs font-light">
                            <Play className="h-3.5 w-3.5" /> Resume
                          </button>
                        )}
                        <button onClick={stopRecording} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-foreground/10 text-foreground border border-border/20 hover:bg-foreground/15 transition-all text-xs font-light">
                          <Square className="h-3.5 w-3.5 fill-foreground" /> Stop & Save
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <p className="text-[9px] text-muted-foreground/40 text-center leading-relaxed">
                  Saved directly to your device. Nothing uploaded. Works offline.
                </p>
              </>
            )}

            {/* ═══ DEVICES TAB ═══ */}
            {tab === "devices" && (
              <>
                {/* Camera Preview */}
                <div className="space-y-1.5">
                  <p className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground/50 font-medium flex items-center gap-1.5">
                    <Camera className="h-3 w-3" /> Camera Preview
                    {camPreviewing && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                  </p>
                  <div className="rounded-xl overflow-hidden border border-border/15 bg-black/80 relative">
                    <video
                      ref={devCamPreviewRef}
                      autoPlay muted playsInline
                      className={`w-full h-36 object-cover ${camPreviewing ? "" : "hidden"}`}
                      style={{ transform: "scaleX(-1)" }}
                    />
                    {!camPreviewing && (
                      <div className="w-full h-36 flex flex-col items-center justify-center gap-2">
                        <CameraOff className="h-5 w-5 text-muted-foreground/30" />
                        <button
                          onClick={startCamPreview}
                          className="text-[10px] px-3 py-1.5 rounded-lg bg-foreground/10 text-foreground hover:bg-foreground/15 transition-colors border border-border/20"
                        >
                          Enable Camera
                        </button>
                      </div>
                    )}
                    {camPreviewing && (
                      <>
                        <div className="absolute top-2 right-2">
                          <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full border border-emerald-500/30 font-medium tracking-wider">LIVE</span>
                        </div>
                        <button
                          onClick={stopCamPreview}
                          className="absolute top-2 left-2 text-[8px] bg-background/60 backdrop-blur text-foreground px-1.5 py-0.5 rounded-full border border-border/20 hover:bg-background/80"
                        >
                          Stop
                        </button>
                      </>
                    )}
                  </div>
                  <select
                    value={selectedCam}
                    onChange={e => setSelectedCam(e.target.value)}
                    className="w-full bg-foreground/5 border border-border/15 rounded-lg px-3 py-2 text-xs text-foreground font-light outline-none focus:border-foreground/30"
                  >
                    <option value="">System Default</option>
                    {videoInputs.map(d => (
                      <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
                    ))}
                  </select>
                </div>

                {/* Microphone */}
                <div className="space-y-1.5">
                  <p className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground/50 font-medium flex items-center gap-1.5">
                    <Mic className="h-3 w-3" /> Microphone
                    {testingMic && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                  </p>

                  <div className="rounded-xl border border-border/15 bg-foreground/[0.02] p-2.5 h-20 flex items-end gap-[2px]">
                    {micWaveform.map((val, i) => {
                      const height = testingMic ? Math.max(2, val * 56) : 2;
                      const isActive = val > 0.05;
                      return (
                        <div
                          key={i}
                          className="flex-1 rounded-full transition-all duration-75"
                          style={{
                            height: `${height}px`,
                            backgroundColor: isActive
                              ? `hsl(142, 71%, ${45 + val * 20}%, ${0.4 + val * 0.5})`
                              : "hsl(var(--foreground) / 0.08)",
                            minHeight: "2px",
                          }}
                        />
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-foreground/5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-75"
                        style={{
                          width: `${micLevel}%`,
                          backgroundColor: micLevel > 70 ? "hsl(0, 84%, 60%)" : micLevel > 30 ? "hsl(45, 93%, 47%)" : "hsl(142, 71%, 45%)",
                        }}
                      />
                    </div>
                    <span className="text-[9px] font-mono text-muted-foreground/50 w-8 text-right">{micLevel}%</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={testingMic ? stopMicTest : startMicTest}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-light transition-all border ${
                        testingMic
                          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
                          : "text-foreground bg-foreground/10 border-border/20 hover:bg-foreground/15"
                      }`}
                    >
                      {testingMic ? <Check className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                      {testingMic ? "Listening" : "Test Mic"}
                    </button>
                    <span className="text-[9px] text-muted-foreground/50">
                      {testingMic
                        ? micLevel > 10 ? "✓ Working — speak now" : "Waiting for sound..."
                        : "Click to test"}
                    </span>
                  </div>

                  <select
                    value={selectedMic}
                    onChange={e => setSelectedMic(e.target.value)}
                    className="w-full bg-foreground/5 border border-border/15 rounded-lg px-3 py-2 text-xs text-foreground font-light outline-none focus:border-foreground/30"
                  >
                    <option value="">System Default</option>
                    {audioInputs.map(d => (
                      <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
                    ))}
                  </select>
                </div>

                {/* Speaker */}
                <div className="space-y-1.5">
                  <p className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground/50 font-medium flex items-center gap-1.5">
                    <Volume2 className="h-3 w-3" /> Speaker
                  </p>
                  <select
                    value={selectedSpeaker}
                    onChange={e => setSelectedSpeaker(e.target.value)}
                    className="w-full bg-foreground/5 border border-border/15 rounded-lg px-3 py-2 text-xs text-foreground font-light outline-none focus:border-foreground/30"
                  >
                    <option value="">System Default</option>
                    {audioOutputs.map(d => (
                      <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={refreshDevices}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] text-muted-foreground/60 hover:text-foreground border border-border/15 hover:bg-foreground/5 transition-all font-light"
                >
                  <RotateCcw className="h-3 w-3" />
                  Refresh Devices
                </button>
              </>
            )}

            {/* ═══ SETTINGS TAB ═══ */}
            {tab === "settings" && (
              <>
                <div className="space-y-1.5">
                  <p className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground/50 font-medium flex items-center gap-1.5">
                    <Clock className="h-3 w-3" /> Countdown
                  </p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[0, 3, 5, 10].map(d => (
                      <button
                        key={d}
                        onClick={() => setCountdownDelay(d)}
                        className={`py-2 rounded-lg text-[10px] font-light transition-all border ${
                          countdownDelay === d
                            ? "bg-foreground/10 text-foreground border-foreground/20"
                            : "text-muted-foreground/50 border-border/15 hover:bg-foreground/5"
                        }`}
                      >
                        {d === 0 ? "Off" : `${d}s`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground/50 font-medium flex items-center gap-1.5">
                    <Maximize2 className="h-3 w-3" /> Quality
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(["high", "medium", "low"] as const).map(q => (
                      <button
                        key={q}
                        onClick={() => setQuality(q)}
                        className={`py-2 rounded-lg text-[10px] font-light capitalize transition-all border ${
                          quality === q
                            ? "bg-foreground/10 text-foreground border-foreground/20"
                            : "text-muted-foreground/50 border-border/15 hover:bg-foreground/5"
                        }`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                  <p className="text-[8px] text-muted-foreground/40">
                    {quality === "high" ? "8 Mbps · Best quality" : quality === "medium" ? "4 Mbps · Balanced" : "1.5 Mbps · Smallest files"}
                  </p>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-border/10">
                  <p className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground/50 font-medium">Features</p>
                  <div className="space-y-1 text-[10px] text-muted-foreground/60 font-light">
                    {[
                      "Record any tab, window, or full screen",
                      "System audio + microphone capture",
                      "Webcam baked into video (PiP)",
                      "Draggable floating webcam bubble",
                      "Pause & resume mid-recording",
                      "Configurable countdown",
                      "Quality presets (8 / 4 / 1.5 Mbps)",
                      "Cursor visibility toggle",
                      "Live mic + camera testing",
                      "Instant device download — zero upload",
                      "100% offline — no internet required",
                      "Crash-resilient 1s chunking",
                    ].map(f => (
                      <div key={f} className="flex items-center gap-2">
                        <Check className="h-3 w-3 text-emerald-400/70 shrink-0" /> {f}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ═══ COUNTDOWN OVERLAY ═══ */}
      {countdown > 0 && createPortal(
        <div className="fixed inset-0 z-[99998] flex items-center justify-center bg-background/80 backdrop-blur-sm pointer-events-none">
          <div className="flex flex-col items-center gap-3">
            <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Recording starts in</span>
            <span className="text-9xl font-extralight text-foreground animate-pulse">{countdown}</span>
          </div>
        </div>,
        document.body
      )}

      {/* ═══ FLOATING CAMERA BUBBLE ═══ */}
      {showFloatingCam && createPortal(
        <div
          style={{ position: "fixed", left: overlayPos.x, top: overlayPos.y, zIndex: 99999 }}
          className="group select-none"
        >
          <div
            className={`relative overflow-hidden border-2 border-red-500/60 shadow-2xl bg-black ${
              camShape === "rounded" ? "rounded-full w-40 h-40" : "rounded-2xl w-52 h-36"
            }`}
          >
            <video
              ref={floatingCamRef}
              autoPlay muted playsInline
              className="w-full h-full object-cover"
              style={{ transform: "scaleX(-1)" }}
            />
            {/* Drag handle */}
            <div
              onMouseDown={onOverlayMouseDown}
              className="absolute top-0 left-0 right-0 h-7 bg-gradient-to-b from-black/60 to-transparent flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-move"
            >
              <GripVertical className="h-4 w-4 text-white/70" />
            </div>
            {/* Recording dot */}
            <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 bg-black/60 backdrop-blur rounded-full">
              <Circle className="h-1.5 w-1.5 fill-red-500 text-red-500 animate-pulse" />
              <span className="text-[8px] text-white font-mono">{formatTime(elapsed)}</span>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ═══ FLOATING CONTROL BAR (when dropdown closed) ═══ */}
      {showFloatingControls && !open && createPortal(
        <div
          style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 99999 }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-card/95 backdrop-blur-xl border border-border/30 shadow-2xl"
        >
          <div className="flex items-center gap-1.5 pr-2 border-r border-border/20">
            <Circle className="h-2 w-2 fill-red-500 text-red-500 animate-pulse" />
            <span className="font-mono text-xs text-foreground tracking-widest">{formatTime(elapsed)}</span>
          </div>
          {state === "recording" ? (
            <button
              onClick={pauseRecording}
              title="Pause"
              className="p-1.5 rounded-full text-amber-400 hover:bg-amber-500/15 transition-colors"
            >
              <Pause className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={resumeRecording}
              title="Resume"
              className="p-1.5 rounded-full text-emerald-400 hover:bg-emerald-500/15 transition-colors"
            >
              <Play className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={stopRecording}
            title="Stop & Save"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors text-[10px] font-medium tracking-wide"
          >
            <Square className="h-3 w-3 fill-current" />
            Stop
          </button>
        </div>,
        document.body
      )}
    </>
  );
};

export default ScreenRecorderDropdown;
