// Zaxin Falcon — ID Capture Panel
// --------------------------------
// End-to-end operator UX for Phase 1.5:
//   1. Consent gate (BIPA/DPPA)
//   2. Camera-driven PDF417 continuous scan (back of card)
//   3. One-shot MRZ decode from a captured frame (passports / foreign IDs)
//   4. Optional front OCR to cross-verify (tamper heuristic)
//   5. Hotlist match on SHA-256(DL#+DOB) — surfaces alert immediately
//   6. Driver↔vehicle temporal correlation (link to nearest plate sighting)
//   7. Session-scoped display — plaintext wiped on tab close.
//
// All decode runs on-device. No barcode, MRZ, or OCR data crosses the wire.

import { useCallback, useEffect, useRef, useState } from "react";
import { IdCard, ScanLine, Camera, ShieldAlert, ShieldCheck, Link2, Trash2, Plus, Users2 } from "lucide-react";
import FalconIdConsent, { hasIdConsent, revokeIdConsent } from "./FalconIdConsent";
import { decodeFromVideo, decodeFromImageData } from "@/lib/zaxin/falcon/id/pdf417";
import { parseAamva, identityHash, type AamvaFields } from "@/lib/zaxin/falcon/id/aamva";
import { parseMrz, type MrzFields } from "@/lib/zaxin/falcon/id/mrz";
import { ocrFrontOfCard } from "@/lib/zaxin/falcon/id/ocr";
import { verifyCrossFields, maskDocNumber, ageFromDob } from "@/lib/zaxin/falcon/id/verify";
import {
  addIdHotlistEntry, listIdHotlist, matchIdHashSync, removeIdHotlistEntry, warmIdHotlist,
  type IdHotlistEntry,
} from "@/lib/zaxin/falcon/id/idHotlist";
import { logIdSighting, subscribeIdSightings, type IdSighting } from "@/lib/zaxin/falcon/id/idSightings";

type Mode = "pdf417" | "mrz" | "ocr";
type Decoded = {
  mode: Mode;
  aamva?: AamvaFields;
  mrz?: MrzFields;
  ocrText?: string;
  frontOcrText?: string;
  idHash?: string;
  ts: number;
};

export default function FalconIdPanel() {
  const [consented, setConsented] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [mode, setMode] = useState<Mode>("pdf417");
  const [decoded, setDecoded] = useState<Decoded | null>(null);
  const [hotlist, setHotlist] = useState<IdHotlistEntry[]>([]);
  const [sightings, setSightings] = useState<IdSighting[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopDecodeRef = useRef<null | (() => void)>(null);

  useEffect(() => { setConsented(hasIdConsent()); }, []);

  useEffect(() => {
    warmIdHotlist().then(() => listIdHotlist().then(setHotlist));
    const unsub = subscribeIdSightings((all) => setSightings(all.slice(-40).reverse()));
    return () => { unsub(); };
  }, []);

  const stopCamera = useCallback(() => {
    try { stopDecodeRef.current?.(); } catch { /* */ }
    stopDecodeRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => { try { t.stop(); } catch { /* */ } });
      streamRef.current = null;
    }
    setScanning(false);
    setStatus("");
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const startCamera = useCallback(async () => {
    setErr(null); setStatus("Requesting camera…");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanning(true);
      setStatus(mode === "pdf417" ? "Scanning back of card for PDF417…" : "Camera ready. Tap Capture.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setScanning(false);
    }
  }, [mode]);

  // Auto-run continuous PDF417 scan when in pdf417 mode.
  useEffect(() => {
    if (!scanning || !videoRef.current) return;
    if (mode !== "pdf417") return;
    const video = videoRef.current;
    stopDecodeRef.current?.();
    stopDecodeRef.current = decodeFromVideo(
      video,
      async (text) => {
        const aamva = parseAamva(text);
        if (!aamva) return;
        const idHash = (await identityHash(aamva)) ?? undefined;
        const rec: Decoded = { mode: "pdf417", aamva, idHash, ts: Date.now() };
        setDecoded(rec);
        setStatus(`Decoded: ${aamva.fullName ?? "unknown"} (${aamva.jurisdiction ?? "?"})`);
        if (idHash) {
          logIdSighting({
            idHash, ts: Date.now(), source: "pdf417",
            fullName: aamva.fullName, dob: aamva.dob,
            documentNumber: aamva.licenseNumber, jurisdiction: aamva.jurisdiction,
          });
        }
      },
      (e) => { console.warn("[falcon-id-pdf417]", e); },
    );
    return () => { stopDecodeRef.current?.(); stopDecodeRef.current = null; };
  }, [scanning, mode]);

  const captureAndDecode = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    const c = document.createElement("canvas");
    c.width = video.videoWidth || 1280;
    c.height = video.videoHeight || 720;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, c.width, c.height);
    const img = ctx.getImageData(0, 0, c.width, c.height);

    setStatus("Decoding frame…");
    let rec: Decoded = { mode, ts: Date.now() };

    if (mode === "pdf417") {
      const text = decodeFromImageData(img);
      if (!text) { setErr("No PDF417 barcode found in this frame."); setStatus(""); return; }
      const aamva = parseAamva(text);
      if (!aamva) { setErr("Barcode decoded but is not AAMVA-format."); setStatus(""); return; }
      rec.aamva = aamva;
      rec.idHash = (await identityHash(aamva)) ?? undefined;
    } else if (mode === "mrz") {
      const text = await ocrFrontOfCard(c);
      const mrzLines = text.split(/\r?\n/).filter((l) => /^[A-Z0-9<]{28,}$/.test(l.replace(/\s+/g, "")));
      if (mrzLines.length < 2) { setErr("MRZ zone not recognized. Frame the machine-readable strip and retry."); setStatus(""); return; }
      const parsed = parseMrz(mrzLines);
      if (!parsed) { setErr("MRZ parse failed."); setStatus(""); return; }
      rec.mrz = parsed;
      rec.ocrText = text;
      if (parsed.documentNumber && parsed.dob) {
        const key = `${parsed.documentNumber.toUpperCase()}|${parsed.dob}`;
        const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
        rec.idHash = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
      }
    } else {
      const text = await ocrFrontOfCard(c);
      rec.ocrText = text;
    }

    setDecoded(rec);
    setStatus("Decoded.");
    setErr(null);

    if (rec.idHash) {
      const name = rec.aamva?.fullName ?? rec.mrz?.fullName;
      const dob = rec.aamva?.dob ?? rec.mrz?.dob;
      const docNum = rec.aamva?.licenseNumber ?? rec.mrz?.documentNumber;
      const juris = rec.aamva?.jurisdiction ?? rec.mrz?.issuingCountry;
      logIdSighting({
        idHash: rec.idHash, ts: rec.ts, source: rec.mode,
        fullName: name, dob, documentNumber: docNum, jurisdiction: juris,
      });
    }
  }, [mode]);

  const runFrontOcrVerify = useCallback(async () => {
    if (!decoded) return;
    const video = videoRef.current;
    if (!video) return;
    setStatus("Running front-of-card OCR for cross-verification…");
    const c = document.createElement("canvas");
    c.width = video.videoWidth || 1280;
    c.height = video.videoHeight || 720;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, c.width, c.height);
    const text = await ocrFrontOfCard(c);
    const auth = decoded.aamva
      ? { familyName: decoded.aamva.familyName, firstName: decoded.aamva.firstName, dob: decoded.aamva.dob, documentNumber: decoded.aamva.licenseNumber, expirationDate: decoded.aamva.expirationDate }
      : decoded.mrz
      ? { familyName: decoded.mrz.familyName, firstName: decoded.mrz.firstName, dob: decoded.mrz.dob, documentNumber: decoded.mrz.documentNumber, expirationDate: decoded.mrz.expirationDate }
      : {};
    const result = verifyCrossFields({ authoritative: auth, ocrText: text });
    setDecoded({ ...decoded, frontOcrText: text });
    setStatus(`Verify: ${result.status.toUpperCase()} · score ${(result.score * 100).toFixed(0)}%`);
  }, [decoded]);

  const clearSession = () => { setDecoded(null); setStatus(""); setErr(null); };

  const addToIdHotlist = async (reason: string, severity: IdHotlistEntry["severity"]) => {
    if (!decoded?.idHash) return;
    const label = `${decoded.aamva?.fullName ?? decoded.mrz?.fullName ?? "Unknown"} · ${maskDocNumber(decoded.aamva?.licenseNumber ?? decoded.mrz?.documentNumber)}`;
    try {
      await addIdHotlistEntry(decoded.idHash, label, reason, severity);
      setHotlist(await listIdHotlist());
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const removeHl = async (h: string) => {
    await removeIdHotlistEntry(h);
    setHotlist(await listIdHotlist());
  };

  const hotlistHit = decoded?.idHash ? matchIdHashSync(decoded.idHash) : null;

  if (!consented) {
    return <FalconIdConsent onGrant={() => setConsented(true)} />;
  }

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-white/[0.01] backdrop-blur-xl overflow-hidden">
      <div className="px-3 py-2 border-b border-white/[0.05] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <IdCard className="h-3.5 w-3.5 text-amber-300/80" strokeWidth={1.5} />
          <p className="text-[10px] font-light tracking-[0.3em] uppercase text-muted-foreground">
            Falcon ID · PDF417 · MRZ · Cross-Verify
          </p>
        </div>
        <button
          onClick={() => { revokeIdConsent(); setConsented(false); stopCamera(); }}
          className="text-[9px] tracking-[0.2em] uppercase text-muted-foreground hover:text-rose-300"
        >
          Revoke consent
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 p-3">
        {/* CAMERA + CONTROLS */}
        <section className="lg:col-span-2 min-w-0">
          <div className="relative rounded-lg overflow-hidden border border-white/[0.06] bg-black/60 aspect-video">
            <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
            {!scanning && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-[0.25em]">Camera idle</p>
              </div>
            )}
            {scanning && mode === "pdf417" && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute left-4 right-4 top-1/2 h-[2px] bg-amber-300/60 animate-pulse" />
                <div className="absolute top-2 left-2 text-[9px] tracking-[0.25em] uppercase text-amber-200/70">
                  Continuous PDF417
                </div>
              </div>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {(["pdf417", "mrz", "ocr"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`text-[10px] tracking-[0.2em] uppercase px-2 py-1 rounded border transition ${
                  mode === m ? "border-amber-300/40 text-amber-100 bg-amber-500/10" : "border-white/[0.08] text-foreground/60 hover:bg-white/[0.05]"
                }`}
              >
                {m === "pdf417" ? "Back · PDF417" : m === "mrz" ? "Passport · MRZ" : "Front · OCR"}
              </button>
            ))}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {!scanning ? (
              <button onClick={startCamera} className="text-[10px] tracking-[0.2em] uppercase px-2 py-1 rounded bg-amber-500/20 text-amber-100 border border-amber-300/40 hover:bg-amber-500/30 flex items-center gap-1">
                <Camera className="h-3 w-3" strokeWidth={1.5} /> Start Camera
              </button>
            ) : (
              <>
                <button onClick={stopCamera} className="text-[10px] tracking-[0.2em] uppercase px-2 py-1 rounded border border-white/[0.08] text-foreground/70 hover:bg-white/[0.05]">
                  Stop
                </button>
                {mode !== "pdf417" && (
                  <button onClick={captureAndDecode} className="text-[10px] tracking-[0.2em] uppercase px-2 py-1 rounded bg-amber-500/20 text-amber-100 border border-amber-300/40 hover:bg-amber-500/30 flex items-center gap-1">
                    <ScanLine className="h-3 w-3" strokeWidth={1.5} /> Capture & Decode
                  </button>
                )}
                {decoded && (
                  <button onClick={runFrontOcrVerify} className="text-[10px] tracking-[0.2em] uppercase px-2 py-1 rounded border border-white/[0.08] text-foreground/70 hover:bg-white/[0.05] flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" strokeWidth={1.5} /> Verify vs Front
                  </button>
                )}
              </>
            )}
            {decoded && (
              <button onClick={clearSession} className="text-[10px] tracking-[0.2em] uppercase px-2 py-1 rounded border border-white/[0.08] text-muted-foreground hover:text-rose-300">
                Clear
              </button>
            )}
          </div>

          {status && <p className="mt-2 text-[10px] text-amber-200/70">{status}</p>}
          {err && <p className="mt-1 text-[10px] text-rose-300/80">{err}</p>}
        </section>

        {/* DECODED CARD */}
        <section className="lg:col-span-3 min-w-0">
          {!decoded && (
            <div className="rounded-lg border border-dashed border-white/[0.08] p-4 h-full flex items-center justify-center">
              <p className="text-[10px] text-muted-foreground/60 italic text-center max-w-[36ch]">
                Point the camera at the back of a US driver license (PDF417) or the machine-readable zone of a passport (MRZ). Fields decode entirely on-device.
              </p>
            </div>
          )}

          {decoded && (
            <div className="rounded-lg border border-white/[0.06] bg-black/30 p-3 space-y-2">
              {hotlistHit && (
                <div className="rounded-md border border-rose-400/40 bg-rose-500/10 px-2 py-1.5 flex items-center gap-2">
                  <ShieldAlert className="h-3.5 w-3.5 text-rose-300 animate-pulse" strokeWidth={1.5} />
                  <div className="min-w-0">
                    <p className="text-[10px] tracking-[0.2em] uppercase text-rose-200">Hotlist Hit · {hotlistHit.severity}</p>
                    <p className="text-[11px] text-rose-100 truncate">{hotlistHit.label} — {hotlistHit.reason}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[10.5px]">
                <Field label="Name" value={decoded.aamva?.fullName ?? decoded.mrz?.fullName} />
                <Field label="DOB" value={decoded.aamva?.dob ?? decoded.mrz?.dob} suffix={ageFromDob(decoded.aamva?.dob ?? decoded.mrz?.dob) != null ? ` (age ${ageFromDob(decoded.aamva?.dob ?? decoded.mrz?.dob)})` : undefined} />
                <Field label="Sex" value={decoded.aamva?.sex ?? decoded.mrz?.sex} />
                <Field label="Doc #" value={maskDocNumber(decoded.aamva?.licenseNumber ?? decoded.mrz?.documentNumber)} />
                <Field label="Jurisdiction" value={decoded.aamva?.jurisdiction ?? decoded.mrz?.issuingCountry} />
                <Field label="Expires" value={decoded.aamva?.expirationDate ?? decoded.mrz?.expirationDate} />
                {decoded.aamva && (<>
                  <Field label="Address" value={[decoded.aamva.addressLine1, decoded.aamva.city, decoded.aamva.state, decoded.aamva.postalCode].filter(Boolean).join(", ")} span={3} />
                  <Field label="Class" value={decoded.aamva.vehicleClass} />
                  <Field label="Restrictions" value={decoded.aamva.restrictions} />
                  <Field label="Endorsements" value={decoded.aamva.endorsements} />
                  <Field label="DD" value={decoded.aamva.documentDiscriminator} />
                  <Field label="Real-ID" value={decoded.aamva.complianceType === "F" ? "Yes" : "—"} />
                  <Field label="Height / Weight" value={[decoded.aamva.heightIn ? `${decoded.aamva.heightIn}"` : null, decoded.aamva.weightLb ? `${decoded.aamva.weightLb} lb` : null].filter(Boolean).join(" · ") || undefined} />
                </>)}
                {decoded.mrz && (<>
                  <Field label="Nationality" value={decoded.mrz.nationality} />
                  <Field label="MRZ Format" value={decoded.mrz.format} />
                  <Field label="Checksums" value={decoded.mrz.valid ? "PASS" : `FAIL (${decoded.mrz.failedChecksums.join(", ")})`} tone={decoded.mrz.valid ? "ok" : "bad"} />
                </>)}
              </div>

              {decoded.frontOcrText && (
                <div className="border-t border-white/[0.05] pt-2">
                  <p className="text-[9px] tracking-[0.22em] uppercase text-muted-foreground mb-1">Front OCR (verification)</p>
                  <pre className="text-[9px] text-foreground/70 whitespace-pre-wrap max-h-24 overflow-auto">{decoded.frontOcrText}</pre>
                </div>
              )}

              {decoded.idHash && (
                <div className="border-t border-white/[0.05] pt-2 flex flex-wrap items-center gap-2">
                  <p className="text-[9px] text-muted-foreground">id·{decoded.idHash.slice(0, 12)}…</p>
                  <button
                    onClick={() => addToIdHotlist("Field flag", "watch")}
                    className="text-[9px] tracking-[0.2em] uppercase px-2 py-0.5 rounded border border-white/[0.08] text-foreground/70 hover:bg-white/[0.05] flex items-center gap-1"
                  >
                    <Plus className="h-2.5 w-2.5" strokeWidth={1.5} /> Watch
                  </button>
                  <button
                    onClick={() => addToIdHotlist("Field alert", "alert")}
                    className="text-[9px] tracking-[0.2em] uppercase px-2 py-0.5 rounded border border-amber-300/30 text-amber-200 hover:bg-amber-500/10 flex items-center gap-1"
                  >
                    <Plus className="h-2.5 w-2.5" strokeWidth={1.5} /> Alert
                  </button>
                  <button
                    onClick={() => addToIdHotlist("BOLO — critical", "critical")}
                    className="text-[9px] tracking-[0.2em] uppercase px-2 py-0.5 rounded border border-rose-400/30 text-rose-200 hover:bg-rose-500/10 flex items-center gap-1"
                  >
                    <Plus className="h-2.5 w-2.5" strokeWidth={1.5} /> BOLO
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* SIGHTINGS + HOTLIST + LINK GRAPH */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 border-t border-white/[0.05]">
        <section className="min-w-0">
          <p className="text-[9px] tracking-[0.25em] uppercase text-muted-foreground mb-1.5">ID Sightings ({sightings.length})</p>
          <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
            {sightings.length === 0 && <p className="text-[9px] text-muted-foreground/60 italic">No captures yet.</p>}
            {sightings.map((s, i) => (
              <div key={`${s.idHash}-${s.ts}-${i}`} className="text-[10px] px-2 py-1 rounded bg-white/[0.02] border border-white/[0.04]">
                <p className="text-foreground/90 truncate">{s.fullName ?? "unknown"} · <span className="text-muted-foreground">{s.jurisdiction ?? "?"}</span></p>
                <p className="text-[8px] text-muted-foreground">
                  {new Date(s.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })} · {s.source}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="min-w-0">
          <p className="text-[9px] tracking-[0.25em] uppercase text-muted-foreground mb-1.5 flex items-center gap-1.5">
            <Link2 className="h-3 w-3" strokeWidth={1.5} /> Driver ↔ Vehicle Links
          </p>
          <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
            {sightings.filter((s) => s.linkedPlate).length === 0 && (
              <p className="text-[9px] text-muted-foreground/60 italic">No ID capture within 30 s of a plate sighting yet.</p>
            )}
            {sightings.filter((s) => s.linkedPlate).map((s, i) => (
              <div key={`link-${s.idHash}-${i}`} className="text-[10px] px-2 py-1 rounded bg-white/[0.02] border border-white/[0.04]">
                <p className="text-foreground/90 truncate">{s.fullName ?? "unknown"} ⇋ <span className="font-mono">{s.linkedPlate}</span></p>
                <p className="text-[8px] text-muted-foreground">Δ {Math.abs((s.linkedPlateSightingTs ?? s.ts) - s.ts) / 1000}s</p>
              </div>
            ))}
          </div>
        </section>

        <section className="min-w-0">
          <p className="text-[9px] tracking-[0.25em] uppercase text-muted-foreground mb-1.5 flex items-center gap-1.5">
            <Users2 className="h-3 w-3" strokeWidth={1.5} /> ID Hotlist ({hotlist.length})
          </p>
          <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
            {hotlist.length === 0 && <p className="text-[9px] text-muted-foreground/60 italic">Empty. Hashes only persist.</p>}
            {hotlist.map((h) => (
              <div key={h.idHash} className="text-[10px] px-2 py-1 rounded bg-white/[0.02] border border-white/[0.04] flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-foreground/90 truncate">{h.label}</p>
                  <p className="text-[8px] text-muted-foreground truncate">{h.reason} · {h.severity}</p>
                </div>
                <button onClick={() => removeHl(h.idHash)} className="text-muted-foreground hover:text-rose-300">
                  <Trash2 className="h-3 w-3" strokeWidth={1.5} />
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({ label, value, suffix, span, tone }: { label: string; value?: string | null; suffix?: string; span?: number; tone?: "ok" | "bad" }) {
  const cls =
    tone === "ok" ? "text-emerald-200" :
    tone === "bad" ? "text-rose-200" :
    "text-foreground/90";
  return (
    <div className={span === 3 ? "col-span-2 md:col-span-3" : ""}>
      <p className="text-[8.5px] tracking-[0.22em] uppercase text-muted-foreground">{label}</p>
      <p className={`text-[11px] font-mono truncate ${cls}`}>{value || "—"}{suffix ?? ""}</p>
    </div>
  );
}
