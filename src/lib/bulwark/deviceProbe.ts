// ═══════════════════════════════════════════════════════════════════════════
// BULWARK — DEVICE POSTURE PROBE (client-side, deterministic)
// ---------------------------------------------------------------------------
// Everything here runs in the operator's own tab and never leaves it. The probe
// measures how legible this browser is to a passive observer: fingerprint
// entropy, leakage surfaces, resident tracker storage, and persistence hooks.
//
// It is honest about its limits. A browser cannot see kernel-level implants, so
// the report says what it inspected and what it could not.
// ═══════════════════════════════════════════════════════════════════════════

export type ProbeVerdict = "exposed" | "attention" | "hardened" | "unknown";

export interface ProbeCheck {
  id: string;
  label: string;
  verdict: ProbeVerdict;
  /** What was actually observed — never a guess. */
  observed: string;
  /** Why it matters to an observer. */
  reading: string;
  countermeasure?: string;
}

export interface DeviceReport {
  checks: ProbeCheck[];
  /** 0–100: how legible this device is to a passive observer. Higher = worse. */
  legibility: number;
  scannedAt: string;
  /** Surfaces a browser fundamentally cannot inspect. Stated, not hidden. */
  blindSpots: string[];
}

const TRACKER_KEY = /(_ga|_gid|_fbp|_fbc|amplitude|mixpanel|hotjar|segment|intercom|fullstory|clarity|heap|optimizely|braze|onesignal|__utm|hubspot|klaviyo|posthog)/i;

const WEIGHT: Record<ProbeVerdict, number> = { exposed: 18, attention: 8, hardened: 0, unknown: 2 };

const ok = (v: unknown) => v !== undefined && v !== null;

/** Canvas + WebGL entropy — the two highest-yield fingerprint surfaces. */
function fingerprintCheck(): ProbeCheck {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 200; canvas.height = 40;
    const ctx = canvas.getContext("2d");
    let canvasEntropy = false;
    if (ctx) {
      ctx.textBaseline = "top";
      ctx.font = "14px 'Arial'";
      ctx.fillStyle = "#f60";
      ctx.fillRect(0, 0, 100, 20);
      ctx.fillStyle = "#069";
      ctx.fillText("bulwark::probe", 2, 15);
      const a = canvas.toDataURL();
      // A hardened browser randomises or blanks the readback between reads.
      ctx.fillText("bulwark::probe", 2, 15);
      canvasEntropy = a === canvas.toDataURL() && a.length > 1000;
    }

    const gl = document.createElement("canvas").getContext("webgl");
    const dbg = gl?.getExtension("WEBGL_debug_renderer_info");
    const renderer = dbg && gl ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) ?? "") : "";

    const exposedSurfaces = [canvasEntropy && "canvas readback stable", renderer && `GPU: ${renderer}`]
      .filter(Boolean) as string[];

    if (!exposedSurfaces.length) {
      return {
        id: "fingerprint", label: "Fingerprint entropy", verdict: "hardened",
        observed: "Canvas readback is randomised and the GPU string is masked.",
        reading: "Passive fingerprinting cannot pin this browser to a stable identifier from these surfaces.",
      };
    }
    return {
      id: "fingerprint", label: "Fingerprint entropy", verdict: "exposed",
      observed: exposedSurfaces.join(" · "),
      reading: "Canvas and GPU readbacks are stable and unique enough to re-identify this browser across sites with no cookie at all. This is the mechanism that survives clearing history.",
      countermeasure: "Use a browser that randomises canvas readback and masks the GPU string, or run the sensitive session in a hardened profile.",
    };
  } catch {
    return {
      id: "fingerprint", label: "Fingerprint entropy", verdict: "unknown",
      observed: "Probe blocked by the browser.",
      reading: "The surfaces could not be measured — which itself suggests active hardening.",
    };
  }
}

/** WebRTC discloses local interface addresses regardless of any VPN tunnel. */
async function webrtcCheck(): Promise<ProbeCheck> {
  const base: ProbeCheck = {
    id: "webrtc", label: "WebRTC address leakage", verdict: "unknown",
    observed: "", reading: "",
  };
  try {
    if (typeof RTCPeerConnection === "undefined") {
      return { ...base, verdict: "hardened", observed: "WebRTC unavailable.", reading: "No host-candidate surface to leak local addressing." };
    }
    const pc = new RTCPeerConnection({ iceServers: [] });
    pc.createDataChannel("bulwark");
    const found = new Set<string>();
    const done = new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 1200);
      pc.onicecandidate = (e) => {
        if (!e.candidate) { clearTimeout(timer); resolve(); return; }
        const m = e.candidate.candidate.match(/([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9:]{10,})/i);
        if (m) found.add(m[1]);
      };
    });
    await pc.createOffer().then((o) => pc.setLocalDescription(o)).catch(() => {});
    await done;
    pc.close();

    const routable = [...found].filter((a) => !/^(0\.|127\.|169\.254\.)/.test(a) && !/^[0-9a-f]{4}:/i.test(a));
    if (!routable.length) {
      return { ...base, verdict: "hardened", observed: "No host candidates disclosed.", reading: "WebRTC is not exposing local interface addressing to page script." };
    }
    return {
      ...base, verdict: "exposed",
      observed: `${routable.length} interface candidate(s) disclosed to page script.`,
      reading: "Any page can read these without permission. On a VPN this is the classic de-anonymisation path: the tunnel hides the public route while WebRTC hands over the real local topology.",
      countermeasure: "Disable non-proxied UDP or block WebRTC entirely on the profile used for sensitive work.",
    };
  } catch {
    return { ...base, verdict: "unknown", observed: "Probe failed.", reading: "WebRTC surface could not be measured." };
  }
}

function storageCheck(): ProbeCheck {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && TRACKER_KEY.test(k)) keys.push(k);
    }
    const cookieHits = document.cookie.split(";").map((c) => c.split("=")[0].trim()).filter((c) => TRACKER_KEY.test(c));
    const total = keys.length + cookieHits.length;
    if (!total) {
      return {
        id: "storage", label: "Resident tracker storage", verdict: "hardened",
        observed: "No known analytics or ad-identity keys resident on this origin.",
        reading: "Nothing on this origin is carrying a persistent commercial identity for you.",
      };
    }
    return {
      id: "storage", label: "Resident tracker storage", verdict: total > 4 ? "exposed" : "attention",
      observed: `${total} tracker identifier(s): ${[...keys, ...cookieHits].slice(0, 6).join(", ")}`,
      reading: "These are durable identity anchors. Each one lets a network correlate this session with prior sessions and, through data partnerships, with sessions on other properties.",
      countermeasure: "Clear site data for this origin and block third-party storage; the identifiers regenerate only if the scripts are still permitted to run.",
    };
  } catch {
    return { id: "storage", label: "Resident tracker storage", verdict: "unknown", observed: "Storage unreadable.", reading: "Storage partitioning or privacy mode prevented inspection." };
  }
}

async function persistenceCheck(): Promise<ProbeCheck> {
  try {
    const regs = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistrations() : [];
    const foreign = regs.filter((r) => {
      const scope = r.scope ?? "";
      return !scope.startsWith(location.origin);
    });
    if (!regs.length) {
      return { id: "persistence", label: "Background persistence", verdict: "hardened", observed: "No service workers registered.", reading: "Nothing is holding a background execution context on this origin." };
    }
    return {
      id: "persistence", label: "Background persistence", verdict: foreign.length ? "exposed" : "attention",
      observed: `${regs.length} service worker(s) registered${foreign.length ? `, ${foreign.length} outside this origin` : ""}.`,
      reading: "A service worker runs after the tab closes and can intercept every request the origin makes. It is the browser's persistence primitive — legitimate for offline apps, ideal for a passive collector.",
      countermeasure: "Unregister anything you did not install. A worker whose scope you cannot account for should be removed before any other remediation.",
    };
  } catch {
    return { id: "persistence", label: "Background persistence", verdict: "unknown", observed: "Registration list unreadable.", reading: "The worker registry could not be enumerated." };
  }
}

function networkCheck(): ProbeCheck {
  const conn = (navigator as unknown as { connection?: { effectiveType?: string; type?: string } }).connection;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  const locale = navigator.language ?? "";
  // A timezone/locale split is the single cheapest way an observer detects a
  // proxied or misconfigured session — it also detects the operator's own VPN.
  const region = tz.split("/")[0];
  const mismatch = !!tz && !!locale && (
    (region === "America" && /^(en-GB|de|fr|ru|zh|ja)/.test(locale)) ||
    (region === "Europe" && /^en-US/.test(locale))
  );
  return {
    id: "network", label: "Network and locale coherence", verdict: mismatch ? "attention" : "hardened",
    observed: `Timezone ${tz || "unknown"} · locale ${locale || "unknown"}${conn?.effectiveType ? ` · link ${conn.effectiveType}` : ""}`,
    reading: mismatch
      ? "Timezone and locale disagree. Any origin can read both, so this pairing marks the session as proxied or relocated — the exact anomaly a fraud or monitoring system escalates on."
      : "Timezone and locale are coherent; this session does not stand out on the cheapest correlation check.",
    countermeasure: mismatch ? "Align the browser locale with the exit region, or accept that the session is flagged as relocated." : undefined,
  };
}

function signalsCheck(): ProbeCheck {
  const dnt = (navigator as unknown as { doNotTrack?: string }).doNotTrack;
  const gpc = (navigator as unknown as { globalPrivacyControl?: boolean }).globalPrivacyControl;
  const honoured = gpc === true;
  return {
    id: "signals", label: "Legal opt-out signalling", verdict: honoured ? "hardened" : "attention",
    observed: `Global Privacy Control ${gpc === true ? "on" : "off"} · Do Not Track ${ok(dnt) ? dnt : "unset"}`,
    reading: honoured
      ? "Global Privacy Control is asserted. In several jurisdictions this is a legally binding sale/share opt-out, which converts a preference into a compliance obligation."
      : "No binding opt-out is being asserted. Do Not Track carries no legal weight anywhere; Global Privacy Control does, and it is off.",
    countermeasure: honoured ? undefined : "Enable Global Privacy Control in the browser's privacy settings — it is the only signal with statutory teeth.",
  };
}

function hardwareCheck(): ProbeCheck {
  const n = navigator as unknown as { hardwareConcurrency?: number; deviceMemory?: number; maxTouchPoints?: number };
  const parts = [
    ok(n.hardwareConcurrency) && `${n.hardwareConcurrency} cores`,
    ok(n.deviceMemory) && `${n.deviceMemory} GB memory class`,
    ok(n.maxTouchPoints) && `${n.maxTouchPoints} touch points`,
    `${screen.width}×${screen.height}@${window.devicePixelRatio}`,
  ].filter(Boolean) as string[];
  return {
    id: "hardware", label: "Hardware disclosure", verdict: parts.length >= 4 ? "attention" : "hardened",
    observed: parts.join(" · "),
    reading: "Each attribute is low-entropy alone. Combined with the fingerprint surfaces above they form a device class narrow enough to re-identify across profiles and private windows.",
    countermeasure: "Nothing to remediate directly — reduce the value of the combination by hardening the higher-entropy surfaces above.",
  };
}

export async function runDeviceProbe(): Promise<DeviceReport> {
  // Independent probes, bounded in parallel — the WebRTC one is the only slow
  // path and it self-terminates at 1.2s.
  const [webrtc, persistence] = await Promise.all([webrtcCheck(), persistenceCheck()]);
  const checks: ProbeCheck[] = [
    fingerprintCheck(), webrtc, storageCheck(), persistence,
    networkCheck(), signalsCheck(), hardwareCheck(),
  ];
  const legibility = Math.min(100, checks.reduce((s, c) => s + WEIGHT[c.verdict], 0));
  return {
    checks,
    legibility,
    scannedAt: new Date().toISOString(),
    blindSpots: [
      "Kernel, firmware, and baseband implants are invisible to page script.",
      "Network-path interception (upstream taps, transparent proxies) cannot be observed from inside a tab.",
      "Installed native software and other browser profiles are out of scope by design.",
    ],
  };
}
