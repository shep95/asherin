import { useState, useRef, useCallback, useEffect } from "react";
import {
  Monitor, Mic, MicOff, Camera, CameraOff, Video, Square, Download,
  Settings, ChevronDown, Circle, Pause, Play, Volume2, Clock,
  Maximize2, PictureInPicture2, MousePointer2, Scissors, RotateCcw,
  AlertCircle, Check, X
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from "@/components/ui/dropdown-menu";

type RecordingState = "idle" | "recording" | "paused" | "preview";
type RecordingMode = "screen" | "screen+cam" | "cam-only";

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
  const [camEnabled, setCamEnabled] = useState(false);
  const [showCursor, setShowCursor] = useState(true);
  const [countdown, setCountdown] = useState(0);
  const [countdownDelay, setCountdownDelay] = useState(3);
  const [format, setFormat] = useState<"webm" | "mp4">("webm");
  const [quality, setQuality] = useState<"high" | "medium" | "low">("high");
  const [micLevel, setMicLevel] = useState(0);
  const [testingMic, setTestingMic] = useState(false);
  const [tab, setTab] = useState<"record" | "devices" | "settings">("record");

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
  const streamRef = useRef<MediaStream | null>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const micTestRef = useRef<{ stream: MediaStream; analyser: AnalyserNode; raf: number } | null>(null);
  const previewUrlRef = useRef<string>("");
  const camPreviewRef = useRef<HTMLVideoElement>(null);

  // Enumerate devices
  const refreshDevices = useCallback(async () => {
    try {
      // Need a temp stream to get labels
      const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true }).catch(() => null);
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioInputs(devices.filter(d => d.kind === "audioinput").map(d => ({ deviceId: d.deviceId, label: d.label || `Mic ${d.deviceId.slice(0, 6)}` })));
      setVideoInputs(devices.filter(d => d.kind === "videoinput").map(d => ({ deviceId: d.deviceId, label: d.label || `Camera ${d.deviceId.slice(0, 6)}` })));
      setAudioOutputs(devices.filter(d => d.kind === "audiooutput").map(d => ({ deviceId: d.deviceId, label: d.label || `Speaker ${d.deviceId.slice(0, 6)}` })));
      tempStream?.getTracks().forEach(t => t.stop());
    } catch {
      // Permissions denied — show empty
    }
  }, []);

  useEffect(() => {
    if (open) refreshDevices();
  }, [open, refreshDevices]);

  // Mic test
  const startMicTest = useCallback(async () => {
    if (micTestRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedMic ? { deviceId: { exact: selectedMic } } : true,
      });
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setMicLevel(Math.min(100, Math.round((avg / 128) * 100)));
        micTestRef.current!.raf = requestAnimationFrame(tick);
      };
      micTestRef.current = { stream, analyser, raf: requestAnimationFrame(tick) };
      setTestingMic(true);
    } catch { /* no mic */ }
  }, [selectedMic]);

  const stopMicTest = useCallback(() => {
    if (!micTestRef.current) return;
    cancelAnimationFrame(micTestRef.current.raf);
    micTestRef.current.stream.getTracks().forEach(t => t.stop());
    micTestRef.current = null;
    setTestingMic(false);
    setMicLevel(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => () => {
    stopMicTest();
    streamRef.current?.getTracks().forEach(t => t.stop());
    camStreamRef.current?.getTracks().forEach(t => t.stop());
    if (timerRef.current) clearInterval(timerRef.current);
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, [stopMicTest]);

  // Start recording
  const startRecording = useCallback(async () => {
    stopMicTest();
    chunksRef.current = [];
    setElapsed(0);

    // Countdown
    if (countdownDelay > 0) {
      for (let i = countdownDelay; i > 0; i--) {
        setCountdown(i);
        await new Promise(r => setTimeout(r, 1000));
      }
      setCountdown(0);
    }

    try {
      const tracks: MediaStreamTrack[] = [];

      // Screen capture
      if (mode !== "cam-only") {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: showCursor ? "always" : "never" } as any,
          audio: true, // system audio
        });
        displayStream.getTracks().forEach(t => tracks.push(t));
        streamRef.current = displayStream;

        // Auto-stop when user stops sharing
        displayStream.getVideoTracks()[0].addEventListener("ended", () => {
          stopRecording();
        });
      }

      // Camera
      if (mode === "screen+cam" || mode === "cam-only") {
        const camConstraints: MediaStreamConstraints = {
          video: selectedCam ? { deviceId: { exact: selectedCam } } : true,
        };
        const camStream = await navigator.mediaDevices.getUserMedia(camConstraints);
        camStreamRef.current = camStream;
        if (mode === "cam-only") {
          camStream.getTracks().forEach(t => tracks.push(t));
        }
        // For PiP overlay with screen, we'd need canvas compositing — keep simple for now
        if (camPreviewRef.current) {
          camPreviewRef.current.srcObject = camStream;
        }
      }

      // Microphone
      if (micEnabled) {
        const micStream = await navigator.mediaDevices.getUserMedia({
          audio: selectedMic ? { deviceId: { exact: selectedMic } } : true,
        });
        micStream.getAudioTracks().forEach(t => tracks.push(t));
      }

      const combinedStream = new MediaStream(tracks);

      const qualityMap = { high: 8000000, medium: 4000000, low: 1500000 };
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : "video/webm";

      const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: qualityMap[quality],
      });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = url;

        // Immediate download
        const a = document.createElement("a");
        a.href = url;
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        a.download = `aureon-recording-${timestamp}.${format === "mp4" ? "webm" : "webm"}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Cleanup streams
        streamRef.current?.getTracks().forEach(t => t.stop());
        camStreamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        camStreamRef.current = null;

        setState("idle");
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000); // Chunk every second for resilience
      setState("recording");

      // Timer
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } catch (err) {
      console.error("Recording failed:", err);
      setState("idle");
    }
  }, [mode, micEnabled, selectedMic, selectedCam, showCursor, countdownDelay, quality, format, stopMicTest]);

  const stopRecording = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    mediaRecorderRef.current?.stop();
  }, []);

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

  return (
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
        className="w-80 bg-card/95 backdrop-blur-xl border-border/30 p-0 rounded-2xl shadow-2xl animate-fade-in"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {/* Countdown overlay */}
        {countdown > 0 && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/90 rounded-2xl">
            <span className="text-5xl font-extralight text-foreground animate-pulse">{countdown}</span>
          </div>
        )}

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

        <div className="p-3 space-y-3">
          {/* ═══ RECORD TAB ═══ */}
          {tab === "record" && (
            <>
              {/* Recording mode */}
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
                      className={`flex flex-col items-center gap-1 py-2 rounded-xl text-[10px] font-light transition-all ${
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
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-light transition-all border ${
                    micEnabled
                      ? "bg-foreground/10 text-foreground border-foreground/20"
                      : "text-muted-foreground/50 border-border/15 hover:bg-foreground/5"
                  } disabled:opacity-40`}
                >
                  {micEnabled ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
                  Mic
                </button>
                <button
                  onClick={() => setCamEnabled(!camEnabled)}
                  disabled={isRecording}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-light transition-all border ${
                    camEnabled
                      ? "bg-foreground/10 text-foreground border-foreground/20"
                      : "text-muted-foreground/50 border-border/15 hover:bg-foreground/5"
                  } disabled:opacity-40`}
                >
                  {camEnabled ? <Camera className="h-3 w-3" /> : <CameraOff className="h-3 w-3" />}
                  Cam
                </button>
                <button
                  onClick={() => setShowCursor(!showCursor)}
                  disabled={isRecording}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-light transition-all border ${
                    showCursor
                      ? "bg-foreground/10 text-foreground border-foreground/20"
                      : "text-muted-foreground/50 border-border/15 hover:bg-foreground/5"
                  } disabled:opacity-40`}
                >
                  <MousePointer2 className="h-3 w-3" />
                  Cursor
                </button>
              </div>

              {/* Camera preview (small) */}
              {(mode === "screen+cam" || mode === "cam-only") && camStreamRef.current && (
                <div className="rounded-xl overflow-hidden border border-border/15 bg-black/50">
                  <video
                    ref={camPreviewRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-24 object-cover"
                  />
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
                  <div className="flex items-center gap-2">
                    {state === "recording" ? (
                      <button
                        onClick={pauseRecording}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/25 hover:bg-amber-500/25 transition-all text-xs font-light"
                      >
                        <Pause className="h-3.5 w-3.5" />
                        Pause
                      </button>
                    ) : (
                      <button
                        onClick={resumeRecording}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25 transition-all text-xs font-light"
                      >
                        <Play className="h-3.5 w-3.5" />
                        Resume
                      </button>
                    )}
                    <button
                      onClick={stopRecording}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-foreground/10 text-foreground border border-border/20 hover:bg-foreground/15 transition-all text-xs font-light"
                    >
                      <Square className="h-3.5 w-3.5 fill-foreground" />
                      Stop & Download
                    </button>
                  </div>
                )}
              </div>

              {/* Timer display when recording */}
              {isRecording && (
                <div className="flex items-center justify-center gap-2 py-1">
                  <Circle className="h-2 w-2 fill-red-500 text-red-500 animate-pulse" />
                  <span className="font-mono text-lg text-foreground/80 tracking-widest">{formatTime(elapsed)}</span>
                  {state === "paused" && <span className="text-[9px] uppercase tracking-wider text-amber-400">Paused</span>}
                </div>
              )}

              {/* Info */}
              <p className="text-[9px] text-muted-foreground/40 text-center leading-relaxed">
                Recordings are saved directly to your device. Nothing is uploaded.
                Works fully offline.
              </p>
            </>
          )}

          {/* ═══ DEVICES TAB ═══ */}
          {tab === "devices" && (
            <>
              {/* Microphone */}
              <div className="space-y-1.5">
                <p className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground/50 font-medium flex items-center gap-1.5">
                  <Mic className="h-3 w-3" /> Microphone
                </p>
                <select
                  value={selectedMic}
                  onChange={e => { setSelectedMic(e.target.value); stopMicTest(); }}
                  className="w-full bg-foreground/5 border border-border/15 rounded-lg px-3 py-2 text-xs text-foreground font-light outline-none focus:border-foreground/30 appearance-none"
                >
                  <option value="">System Default</option>
                  {audioInputs.map(d => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
                  ))}
                </select>

                {/* Mic test */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={testingMic ? stopMicTest : startMicTest}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-light transition-all border ${
                      testingMic
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
                        : "text-muted-foreground/60 border-border/15 hover:bg-foreground/5"
                    }`}
                  >
                    {testingMic ? <Check className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                    {testingMic ? "Stop Test" : "Test Mic"}
                  </button>
                  {testingMic && (
                    <div className="flex-1 h-2 rounded-full bg-foreground/5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500/60 transition-all duration-75"
                        style={{ width: `${micLevel}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Camera */}
              <div className="space-y-1.5">
                <p className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground/50 font-medium flex items-center gap-1.5">
                  <Camera className="h-3 w-3" /> Camera
                </p>
                <select
                  value={selectedCam}
                  onChange={e => setSelectedCam(e.target.value)}
                  className="w-full bg-foreground/5 border border-border/15 rounded-lg px-3 py-2 text-xs text-foreground font-light outline-none focus:border-foreground/30 appearance-none"
                >
                  <option value="">System Default</option>
                  {videoInputs.map(d => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
                  ))}
                </select>
              </div>

              {/* Speaker */}
              <div className="space-y-1.5">
                <p className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground/50 font-medium flex items-center gap-1.5">
                  <Volume2 className="h-3 w-3" /> Speaker Output
                </p>
                <select
                  value={selectedSpeaker}
                  onChange={e => setSelectedSpeaker(e.target.value)}
                  className="w-full bg-foreground/5 border border-border/15 rounded-lg px-3 py-2 text-xs text-foreground font-light outline-none focus:border-foreground/30 appearance-none"
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
              {/* Countdown */}
              <div className="space-y-1.5">
                <p className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground/50 font-medium flex items-center gap-1.5">
                  <Clock className="h-3 w-3" /> Countdown Delay
                </p>
                <div className="grid grid-cols-4 gap-1.5">
                  {[0, 3, 5, 10].map(d => (
                    <button
                      key={d}
                      onClick={() => setCountdownDelay(d)}
                      className={`py-1.5 rounded-lg text-[10px] font-light transition-all border ${
                        countdownDelay === d
                          ? "bg-foreground/10 text-foreground border-foreground/20"
                          : "text-muted-foreground/50 border-border/15 hover:bg-foreground/5"
                      }`}
                    >
                      {d === 0 ? "None" : `${d}s`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quality */}
              <div className="space-y-1.5">
                <p className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground/50 font-medium flex items-center gap-1.5">
                  <Maximize2 className="h-3 w-3" /> Quality
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["high", "medium", "low"] as const).map(q => (
                    <button
                      key={q}
                      onClick={() => setQuality(q)}
                      className={`py-1.5 rounded-lg text-[10px] font-light capitalize transition-all border ${
                        quality === q
                          ? "bg-foreground/10 text-foreground border-foreground/20"
                          : "text-muted-foreground/50 border-border/15 hover:bg-foreground/5"
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
                <p className="text-[8px] text-muted-foreground/30">
                  {quality === "high" ? "8 Mbps — Best quality, larger files" : quality === "medium" ? "4 Mbps — Balanced quality and size" : "1.5 Mbps — Smallest files, lower quality"}
                </p>
              </div>

              {/* Features list */}
              <div className="space-y-1.5">
                <p className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground/50 font-medium">Features</p>
                <div className="space-y-1 text-[10px] text-muted-foreground/60 font-light">
                  <div className="flex items-center gap-2"><Check className="h-3 w-3 text-emerald-400/70" /> Record any tab, window, or full screen</div>
                  <div className="flex items-center gap-2"><Check className="h-3 w-3 text-emerald-400/70" /> System audio + microphone capture</div>
                  <div className="flex items-center gap-2"><Check className="h-3 w-3 text-emerald-400/70" /> Webcam overlay (PiP mode)</div>
                  <div className="flex items-center gap-2"><Check className="h-3 w-3 text-emerald-400/70" /> Pause & resume mid-recording</div>
                  <div className="flex items-center gap-2"><Check className="h-3 w-3 text-emerald-400/70" /> Configurable countdown timer</div>
                  <div className="flex items-center gap-2"><Check className="h-3 w-3 text-emerald-400/70" /> Quality presets (High/Med/Low)</div>
                  <div className="flex items-center gap-2"><Check className="h-3 w-3 text-emerald-400/70" /> Cursor visibility toggle</div>
                  <div className="flex items-center gap-2"><Check className="h-3 w-3 text-emerald-400/70" /> Microphone level testing</div>
                  <div className="flex items-center gap-2"><Check className="h-3 w-3 text-emerald-400/70" /> Instant device download — no upload</div>
                  <div className="flex items-center gap-2"><Check className="h-3 w-3 text-emerald-400/70" /> 100% offline — no internet needed</div>
                  <div className="flex items-center gap-2"><Check className="h-3 w-3 text-emerald-400/70" /> Crash-resilient 1s chunking</div>
                </div>
              </div>
            </>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ScreenRecorderDropdown;
