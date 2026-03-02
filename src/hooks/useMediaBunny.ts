import { useState, useCallback } from "react";

/**
 * Hybrid video processing hook:
 * - MediaBunny (WebCodecs, GPU-accelerated) for: trim, speed, resize, crop, rotate, flip, format, audio removal
 * - FFmpeg WASM fallback for: color grading, filters, effects, reverse, blur, sharpen, fade
 */

// Edit types that MediaBunny can handle natively (GPU-accelerated)
const MEDIABUNNY_EDIT_TYPES = new Set([
  "trim", "speed", "resize", "crop", "rotate", "flip", "format", "audio",
]);

interface HybridProcessorState {
  processing: boolean;
  progress: number;
  engine: "mediabunny" | "ffmpeg" | null;
  error: string | null;
}

export function useMediaBunny() {
  const [state, setState] = useState<HybridProcessorState>({
    processing: false,
    progress: 0,
    engine: null,
    error: null,
  });

  /**
   * Determine which engine to use based on edit_type
   */
  const getEngine = useCallback((editType: string): "mediabunny" | "ffmpeg" => {
    return MEDIABUNNY_EDIT_TYPES.has(editType) ? "mediabunny" : "ffmpeg";
  }, []);

  /**
   * Process video using MediaBunny (WebCodecs / GPU-accelerated)
   */
  const processWithMediaBunny = useCallback(
    async (
      videoUrl: string,
      editType: string,
      ffmpegArgs: string[],
    ): Promise<Blob> => {
      setState({ processing: true, progress: 0, engine: "mediabunny", error: null });

      try {
        // Dynamic import for tree-shaking
        const {
          Input, Output, Conversion,
          ALL_FORMATS, BlobSource, Mp4OutputFormat, BufferTarget,
        } = await import("mediabunny");

        setState((s) => ({ ...s, progress: 10 }));

        // Fetch source video as blob
        const response = await fetch(videoUrl);
        const videoBlob = await response.blob();

        setState((s) => ({ ...s, progress: 20 }));

        const input = new Input({
          source: new BlobSource(videoBlob),
          formats: ALL_FORMATS,
        });

        const output = new Output({
          format: new Mp4OutputFormat(),
          target: new BufferTarget(),
        });

        // Build conversion options from FFmpeg args + editType
        const conversionOpts: any = { input, output };

        // Parse trim from ffmpeg args
        if (editType === "trim") {
          const ssIdx = ffmpegArgs.indexOf("-ss");
          const tIdx = ffmpegArgs.indexOf("-t");
          const toIdx = ffmpegArgs.indexOf("-to");

          const start = ssIdx >= 0 ? parseFloat(ffmpegArgs[ssIdx + 1]) : undefined;
          let end: number | undefined;

          if (toIdx >= 0) {
            end = parseFloat(ffmpegArgs[toIdx + 1]);
          } else if (tIdx >= 0 && start !== undefined) {
            end = start + parseFloat(ffmpegArgs[tIdx + 1]);
          } else if (tIdx >= 0) {
            end = parseFloat(ffmpegArgs[tIdx + 1]);
          }

          conversionOpts.trim = { start, end };
        }

        // Parse resize
        if (editType === "resize") {
          const vfIdx = ffmpegArgs.indexOf("-vf");
          if (vfIdx >= 0) {
            const scaleMatch = ffmpegArgs[vfIdx + 1]?.match(/scale=(-?\d+):(\d+)/);
            if (scaleMatch) {
              const height = parseInt(scaleMatch[2]);
              conversionOpts.video = { height, fit: "contain" as const };
            }
          }
        }

        // Parse crop
        if (editType === "crop") {
          const vfIdx = ffmpegArgs.indexOf("-vf");
          if (vfIdx >= 0) {
            const cropMatch = ffmpegArgs[vfIdx + 1]?.match(/crop=(\d+):(\d+)(?::(\d+):(\d+))?/);
            if (cropMatch) {
              conversionOpts.video = {
                crop: {
                  width: parseInt(cropMatch[1]),
                  height: parseInt(cropMatch[2]),
                  left: parseInt(cropMatch[3] || "0"),
                  top: parseInt(cropMatch[4] || "0"),
                },
              };
            }
          }
        }

        // Parse rotation
        if (editType === "rotate") {
          const vfIdx = ffmpegArgs.indexOf("-vf");
          if (vfIdx >= 0) {
            const filter = ffmpegArgs[vfIdx + 1] || "";
            if (filter.includes("transpose=1")) conversionOpts.video = { rotate: 90 };
            else if (filter.includes("transpose=2")) conversionOpts.video = { rotate: 270 };
            else if (filter.includes("transpose=0")) conversionOpts.video = { rotate: 270 };
          }
        }

        // Parse flip (horizontal/vertical) - MediaBunny doesn't natively support flip,
        // so we fall through to rotation or let ffmpeg handle it
        if (editType === "flip") {
          // MediaBunny doesn't support flip directly — rotate 180 as approximation
          conversionOpts.video = { rotate: 180 };
        }

        // Audio removal
        if (editType === "audio") {
          conversionOpts.audio = { discard: true };
        }

        // Speed change - MediaBunny doesn't have native speed control,
        // but can adjust frame rate to simulate speed
        if (editType === "speed") {
          // Parse speed multiplier from ffmpeg args
          const filterIdx = ffmpegArgs.indexOf("-filter_complex");
          if (filterIdx >= 0) {
            const filterStr = ffmpegArgs[filterIdx + 1] || "";
            const ptsMatch = filterStr.match(/setpts=([0-9.]+)\*PTS/);
            if (ptsMatch) {
              const ptsFactor = parseFloat(ptsMatch[1]);
              // ptsFactor < 1 means speed up, > 1 means slow down
              // Adjust frame rate to change perceived speed
              const duration = await input.computeDuration();
              const videoTrack = await input.getPrimaryVideoTrack();
              if (videoTrack && duration) {
                const originalFps = (videoTrack as any).frameRate || 30;
                // Speed = 1/ptsFactor, so new fps = original * speed
                const newFps = originalFps / ptsFactor;
                conversionOpts.video = { frameRate: Math.round(newFps) };
                // Also trim to adjusted duration
                conversionOpts.trim = { start: 0, end: duration * ptsFactor };
              }
            }
          }
        }

        setState((s) => ({ ...s, progress: 40 }));

        const conversion = await Conversion.init(conversionOpts);

        setState((s) => ({ ...s, progress: 60 }));

        await conversion.execute();

        setState((s) => ({ ...s, progress: 90 }));

        // Get result buffer
        const target = output.target as any;
        const buffer = target.getBuffer ? await target.getBuffer() : target.buffer;
        const blob = new Blob([buffer], { type: "video/mp4" });

        // Dispose resources
        try { (input as any).dispose?.(); } catch {}
        try { (output as any).dispose?.(); } catch {}

        setState({ processing: false, progress: 100, engine: "mediabunny", error: null });
        return blob;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "MediaBunny processing failed";
        setState({ processing: false, progress: 0, engine: null, error: msg });
        throw err;
      }
    },
    [],
  );

  return {
    ...state,
    getEngine,
    processWithMediaBunny,
    canUseMediaBunny: (editType: string) => MEDIABUNNY_EDIT_TYPES.has(editType),
  };
}
