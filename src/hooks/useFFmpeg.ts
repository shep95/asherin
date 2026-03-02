import { useState, useRef, useCallback, useEffect } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

interface FFmpegState {
  loaded: boolean;
  loading: boolean;
  processing: boolean;
  progress: number;
  error: string | null;
}

export function useFFmpeg(autoLoad = false) {
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const [state, setState] = useState<FFmpegState>({
    loaded: false,
    loading: false,
    processing: false,
    progress: 0,
    error: null,
  });

  const load = useCallback(async () => {
    if (ffmpegRef.current && state.loaded) return;
    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      const ffmpeg = new FFmpeg();

      ffmpeg.on("progress", ({ progress }) => {
        setState((s) => ({ ...s, progress: Math.round(progress * 100) }));
      });

      ffmpeg.on("log", ({ message }) => {
        console.log("[FFmpeg]", message);
      });

      // Use multi-threaded core for 2-4x speed boost
      await ffmpeg.load({
        coreURL: "https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/esm/ffmpeg-core.js",
        wasmURL: "https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/esm/ffmpeg-core.wasm",
        workerURL: "https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/esm/ffmpeg-core.worker.js",
      });

      ffmpegRef.current = ffmpeg;
      setState((s) => ({ ...s, loaded: true, loading: false }));
    } catch (err) {
      // Fallback to single-threaded if multi-thread fails (SharedArrayBuffer not available)
      try {
        const ffmpeg = new FFmpeg();
        ffmpeg.on("progress", ({ progress }) => {
          setState((s) => ({ ...s, progress: Math.round(progress * 100) }));
        });
        ffmpeg.on("log", ({ message }) => {
          console.log("[FFmpeg]", message);
        });
        await ffmpeg.load({
          coreURL: "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js",
          wasmURL: "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm",
        });
        ffmpegRef.current = ffmpeg;
        setState((s) => ({ ...s, loaded: true, loading: false }));
        console.log("[FFmpeg] Fell back to single-threaded core");
      } catch (fallbackErr) {
        const msg = fallbackErr instanceof Error ? fallbackErr.message : "Failed to load FFmpeg";
        setState((s) => ({ ...s, loading: false, error: msg }));
        throw fallbackErr;
      }
    }
  }, [state.loaded]);

  // Auto-preload FFmpeg in background so it's ready when user submits an edit
  useEffect(() => {
    if (autoLoad && !state.loaded && !state.loading) {
      load().catch(() => {
        // Silent fail on preload — will retry when user actually edits
      });
    }
  }, [autoLoad, state.loaded, state.loading, load]);

  const processVideo = useCallback(
    async (videoUrl: string, ffmpegArgs: string[]): Promise<Blob> => {
      const ffmpeg = ffmpegRef.current;
      if (!ffmpeg) throw new Error("FFmpeg not loaded");

      setState((s) => ({ ...s, processing: true, progress: 0, error: null }));

      try {
        // Fetch source video
        const videoData = await fetchFile(videoUrl);
        await ffmpeg.writeFile("input.mp4", videoData);

        // Determine output extension
        const outputExt = ffmpegArgs[ffmpegArgs.length - 1]?.split(".").pop() || "mp4";
        const outputFile = `output.${outputExt}`;

        // Execute FFmpeg command
        await ffmpeg.exec(ffmpegArgs);

        // Read output
        const data = await ffmpeg.readFile(outputFile);
        const uint8 = data instanceof Uint8Array ? data : new TextEncoder().encode(data as string);
        const arrayBuffer = uint8.slice().buffer as ArrayBuffer;
        const blob = new Blob([arrayBuffer], {
          type: outputExt === "mp3" ? "audio/mpeg" : "video/mp4",
        });

        // Cleanup virtual FS
        try {
          await ffmpeg.deleteFile("input.mp4");
          await ffmpeg.deleteFile(outputFile);
        } catch {
          // ignore cleanup errors
        }

        setState((s) => ({ ...s, processing: false, progress: 100 }));
        return blob;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "FFmpeg processing failed";
        setState((s) => ({ ...s, processing: false, error: msg }));
        throw err;
      }
    },
    []
  );

  return {
    ...state,
    load,
    processVideo,
  };
}
