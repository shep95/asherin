// runs one artifact in the sandbox frame and collects what it actually reports.
//
// Every observation here came from the frame. If the artifact cannot run, the
// hook reports why and collects nothing rather than inventing a result.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readSandboxMessage } from "@/lib/artifact/runtimes/browserSandbox";
import { buildPreview, readProbeReply, type ProbeReply } from "@/lib/software/preview";
import type { ArtifactCheck, ArtifactFile, RunObservation } from "@/lib/software/types";

export interface ArtifactSandbox {
  build: ReturnType<typeof buildPreview>;
  observations: RunObservation[];
  running: boolean;
  /** increments on each run so the frame remounts cleanly. */
  runKey: number;
  frameRef: React.MutableRefObject<HTMLIFrameElement | null>;
  start: () => void;
  stop: () => void;
  clear: () => void;
  /** the observations as they stand right now, free of render-time staleness. */
  snapshot: () => RunObservation[];
  /** asks the running frame the dom questions a set of checks needs answered. */
  probe: (checks: ArtifactCheck[], timeoutMs?: number) => Promise<ProbeReply[]>;
}

export function useArtifactSandbox(files: ArtifactFile[]): ArtifactSandbox {
  const build = useMemo(() => buildPreview(files), [files]);
  const [observations, setObservations] = useState<RunObservation[]>([]);
  const [runKey, setRunKey] = useState(0);
  const [running, setRunning] = useState(false);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const probeResolve = useRef<((r: ProbeReply[]) => void) | null>(null);
  const observationsRef = useRef<RunObservation[]>([]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const frame = frameRef.current;
      if (!frame || event.source !== frame.contentWindow) return;

      const probe = readProbeReply(event.data);
      if (probe) {
        probeResolve.current?.(probe);
        probeResolve.current = null;
        return;
      }
      const msg = readSandboxMessage(event.data);
      if (!msg) return;
      setObservations((prev) => {
        if (prev.length > 300) return prev;
        const next = [
          ...prev,
          { channel: msg.channel as RunObservation["channel"], level: msg.level, message: msg.message, at: new Date().toISOString() },
        ];
        observationsRef.current = next;
        return next;
      });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const start = useCallback(() => {
    if (!build.ok) return;
    setObservations([]);
    observationsRef.current = [];
    setRunKey((k) => k + 1);
    setRunning(true);
  }, [build.ok]);

  const stop = useCallback(() => setRunning(false), []);
  const clear = useCallback(() => {
    observationsRef.current = [];
    setObservations([]);
  }, []);
  const snapshot = useCallback(() => observationsRef.current, []);

  const probe = useCallback(async (checks: ArtifactCheck[], timeoutMs = 2000): Promise<ProbeReply[]> => {
    const frame = frameRef.current;
    const queries = checks
      .filter((c) => c.enabled && (c.kind === "dom_selector_exists" || c.kind === "dom_text_contains"))
      .map((c) => ({ id: c.id, kind: c.kind, value: c.expectation }));
    if (!queries.length) return [];
    if (!frame?.contentWindow) {
      return queries.map((q) => ({ checkId: q.id, ok: null, detail: "the artifact is not running" }));
    }
    return new Promise<ProbeReply[]>((resolve) => {
      const timer = window.setTimeout(() => {
        probeResolve.current = null;
        resolve(queries.map((q) => ({ checkId: q.id, ok: null, detail: "the artifact did not answer in time" })));
      }, timeoutMs);
      probeResolve.current = (r) => {
        window.clearTimeout(timer);
        resolve(r);
      };
      frame.contentWindow?.postMessage({ __probe: 1, queries }, "*");
    });
  }, []);

  return { build, observations, running, runKey, frameRef, start, stop, clear, snapshot, probe };
}
