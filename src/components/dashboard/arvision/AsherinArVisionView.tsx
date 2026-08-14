// @ts-nocheck
// asherin.arvision — transferred from asherin organ HUD
// source: skills/aureon/arvision/operator-arvision.html + aureon-arvision-intel.py
// identity: localStorage this-box only. packet: download fallback. rf: web-bluetooth pick.
// never: Clearview, DMV owner, A2DP sniff, private NVR, thermal fake.

import { useEffect, useRef } from "react";
import { emitPull } from "@/lib/connect/emitPull";

const HUD_CSS = '\n  .arv-root { position:absolute; inset:0; width:100%; height:100%; overflow:hidden; background:#000; color-scheme:dark; }\n\n  .arv-root {\n    --bg: #07080a;\n    --ink: #f5f7fb;\n    --mute: rgba(245,247,251,.58);\n    --line: rgba(255,255,255,.14);\n    --accent: #9ec9ff;\n    --ok: #7ee0c6;\n    --warn: #e8c56b;\n    --r: 28px;\n  }\n  .arv-root, .arv-root * { box-sizing: border-box; }\n  .arv-root * { scrollbar-width: none !important; -ms-overflow-style: none !important; }\n  .arv-root *::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }\n  .arv-root {\n    margin: 0; height: 100%; background: var(--bg); color: var(--ink);\n    font-family: "Segoe UI Variable Display", "Segoe UI Variable Text", "Segoe UI", ui-sans-serif, system-ui, sans-serif;\n    letter-spacing: -.018em; color-scheme: dark; overflow: hidden;\n  }\n  #stage { position: absolute; inset: 0; background: #000; }\n  #cam, #hud {\n    position: absolute; inset: 0; width: 100%; height: 100%;\n    object-fit: cover;\n  }\n  #cam.mirror { transform: scaleX(-1); }\n  #hud { pointer-events: none; }\n  .glass {\n    background: linear-gradient(180deg, rgba(28,32,42,.58), rgba(12,14,18,.42));\n    backdrop-filter: blur(32px) saturate(1.55);\n    -webkit-backdrop-filter: blur(32px) saturate(1.55);\n    border: 1px solid var(--line);\n    border-radius: var(--r);\n  }\n  .misb {\n    position: absolute; top: 16px; left: 16px; z-index: 8;\n    padding: 12px 16px; pointer-events: auto; min-width: 220px;\n    font: 500 12px/1.45 inherit; color: var(--ink);\n  }\n  .misb b { color: var(--accent); font-weight: 600; }\n  .misb .m { color: var(--mute); font-size: 11px; }\n  .compass {\n    position: absolute; top: 16px; right: 16px; z-index: 8;\n    width: 88px; height: 88px; border-radius: 50%; padding: 0; cursor: pointer;\n    background: linear-gradient(180deg, rgba(28,32,42,.58), rgba(12,14,18,.42));\n    border: 1px solid var(--line);\n  }\n  .compass svg { width: 100%; height: 100%; }\n  .compass.dim { opacity: .45; }\n  .layers {\n    position: absolute; top: 16px; left: 50%; transform: translateX(-50%);\n    z-index: 8; display: flex; gap: 8px; flex-wrap: wrap; justify-content: center;\n    width: min(720px, calc(100% - 260px)); pointer-events: auto;\n  }\n  .tog {\n    border: 0; border-radius: 999px; padding: 8px 12px; cursor: pointer;\n    color: var(--ink); font: 600 12px/1 inherit; background: rgba(16,18,24,.48);\n    backdrop-filter: blur(24px);\n  }\n  .tog.on { background: rgba(158,201,255,.92); color: #0b1018; }\n  .sheet {\n    position: absolute; right: 16px; top: 116px; bottom: 110px; z-index: 8;\n    width: min(280px, 32vw); padding: 16px; overflow: auto; pointer-events: auto;\n  }\n  .sheet h2 { margin: 0 0 10px; font: 600 13px/1.2 inherit; letter-spacing: -.02em; }\n  .sheet .row { display: flex; justify-content: space-between; gap: 10px; font-size: 12px; padding: 6px 0; border-bottom: 1px solid var(--line); }\n  .sheet .k { color: var(--mute); }\n  .sheet .v { text-align: right; }\n  .sheet .list { margin-top: 10px; font-size: 12px; color: var(--mute); line-height: 1.45; }\n  .talk {\n    position: absolute; left: 50%; bottom: 18px; transform: translateX(-50%);\n    z-index: 9; display: flex; gap: 8px; align-items: center; flex-wrap: wrap;\n    padding: 10px 12px; width: min(980px, calc(100% - 36px)); justify-content: center;\n  }\n  .talk button {\n    border: 0; border-radius: 999px; padding: 10px 16px; cursor: pointer;\n    background: rgba(158,201,255,.92); color: #0b1018; font: 600 13px/1 inherit;\n  }\n  .talk button.ghost { background: rgba(255,255,255,.08); color: var(--ink); }\n  #gate {\n    position: absolute; inset: 0; z-index: 20; display: grid; place-items: center;\n    background: rgba(7,8,10,.72); backdrop-filter: blur(18px);\n  }\n  #gate[hidden] { display: none; }\n  #gate .card { padding: 28px 32px; max-width: 420px; text-align: center; }\n  #gate p { color: var(--mute); font-size: 14px; line-height: 1.5; }\n  #gate button {\n    border: 0; border-radius: 999px; padding: 12px 20px; cursor: pointer;\n    background: rgba(158,201,255,.92); color: #0b1018; font: 600 14px inherit;\n  }\n  #note {\n    position: absolute; left: 16px; bottom: 110px; z-index: 8;\n    padding: 10px 14px; font-size: 12px; color: var(--mute); max-width: 320px;\n    pointer-events: none;\n  }\n';
const HUD_BODY = '<div id="stage">\n  <video id="cam" playsinline autoplay muted></video>\n  <canvas id="hud"></canvas>\n</div>\n<div class="glass misb" id="misb"></div>\n<button type="button" class="compass dim" id="compass" title="device compass">\n  <svg viewBox="0 0 88 88" aria-hidden="true">\n    <circle cx="44" cy="44" r="40" fill="none" stroke="rgba(255,255,255,.2)" stroke-width="1"/>\n    <g id="rose" transform="rotate(0 44 44)">\n      <polygon points="44,10 48,44 44,40 40,44" fill="#fff"/>\n      <text x="44" y="22" text-anchor="middle" fill="#9ec9ff" font-size="9" font-family="inherit">N</text>\n    </g>\n    <rect x="42" y="6" width="4" height="10" rx="2" fill="#7ee0c6"/>\n  </svg>\n</button>\n<div class="layers" id="layers"></div>\n<div class="glass sheet" id="sheet"></div>\n<div class="glass talk" id="talk"></div>\n<div id="note"></div>\n<div id="gate">\n  <div class="glass card">\n    <p>allow the camera. you should see yourself with AR overlays.</p>\n    <button type="button" id="allow">open camera</button>\n  </div>\n</div>\n<canvas id="work" hidden></canvas>';

function bootArvision(wrap, root, emitPull) {
  let dead = false;
  const offs = [];
  const $ = (id) => wrap.querySelector("#" + id);
  const cam = $("cam");
  const hud = $("hud");
  const ctx = hud.getContext("2d");
  const work = $("work");
  const wctx = work.getContext("2d", { willReadFrequently: true });
  const layersEl = $("layers");
  const sheetEl = $("sheet");
  const talkEl = $("talk");
  const misbEl = $("misb");
  const noteEl = $("note");
  const rose = $("rose");
  const compassBtn = $("compass");

  const layers = {
    reticle: true,
    grid: false,
    horizon: true,
    peaking: false,
    motion: true,
    mesh: true,
    objects: true,
    pose: true,
    rf: true,
    identity: true,
    classify: true,
  };

  const S = {
    stream: null,
    devices: [],
    deviceId: null,
    facing: "user",
    mirror: true,
    torch: false,
    frozen: false,
    freezeBitmap: null,
    heading: null,
    headingSrc: "none",
    beta: null,
    gamma: null,
    lat: null,
    lon: null,
    acc: null,
    geoSrc: "none",
    fps: 0,
    frames: 0,
    fpsT: performance.now(),
    lastGray: null,
    motion: 0,
    luma: 0,
    contrast: 0,
    edges: 0,
    hist: new Array(8).fill(0),
    objects: [],
    faces: 0,
    poseOn: false,
    blend: "",
    barcodes: [],
    ocr: "",
    obstruction: [],
    models: { face: null, pose: null, obj: null, cls: null, status: "loading" },
    hfov: null,
    rec: null,
    recChunks: [],
    rf: { tracks: [], wifi: [], engine: "", n: 0 },
    rfPick: 0,
    identity: { enrolled: false, status: "unenrolled", label: null, cosine: null },
    enrollBank: [],
    classes: [],
    intel: null,
    lastIntel: 0,
    lastOcr: 0,
    lastLm: null,
    lastAhash: "",
    clsTick: 0,
  };

  function layerChips() {
    layersEl.innerHTML = "";
    Object.keys(layers).forEach((k) => {
      const b = document.createElement("button");
      b.className = "tog" + (layers[k] ? " on" : "");
      b.textContent = k;
      b.onclick = () => { layers[k] = !layers[k]; layerChips(); };
      layersEl.appendChild(b);
    });
  }

  function talkBtns() {
    const spec = [
      ["freeze", "ghost", freeze],
      ["packet", "", savePacket],
      ["reverse", "ghost", reverseSearch],
      ["ocr", "ghost", runOcr],
      ["flip cam", "ghost", flipCam],
      ["mirror", "ghost", () => { S.mirror = !S.mirror; applyMirror(); }],
      ["torch", "ghost", toggleTorch],
      ["record", "ghost", toggleRec],
      ["probe rf", "", probeStrongest],
      ["enroll me", "", enrollMe],
      ["intel", "", runIntel],
    ];
    talkEl.innerHTML = "";
    spec.forEach(([label, cls, fn]) => {
      const b = document.createElement("button");
      b.className = cls;
      b.textContent = label;
      b.type = "button";
      b.onclick = fn;
      talkEl.appendChild(b);
    });
  }

  function selfieMirror() {
    return !!(S.mirror && S.facing === "user");
  }

  function applyMirror() {
    cam.classList.toggle("mirror", selfieMirror());
    hud.classList.remove("mirror");
  }

  function note(t) { noteEl.textContent = t || ""; }

  async function listCams() {
    const all = await navigator.mediaDevices.enumerateDevices();
    S.devices = all.filter((d) => d.kind === "videoinput");
  }

  async function startCam(deviceId) {
    if (S.stream) S.stream.getTracks().forEach((t) => t.stop());
    const video = deviceId
      ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
      : { facingMode: S.facing, width: { ideal: 1280 }, height: { ideal: 720 } };
    S.stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
    cam.srcObject = S.stream;
    await cam.play();
    await listCams();
    const track = S.stream.getVideoTracks()[0];
    S.deviceId = track.getSettings().deviceId || deviceId;
    const s = track.getSettings();
    if (s.facingMode) S.facing = s.facingMode;
    if (s.width && s.focalLength) {
      S.hfov = (2 * Math.atan((s.width / 2) / s.focalLength) * 180 / Math.PI);
    } else if (s.width && s.height) {
      S.hfov = 54;
    }
    applyMirror();
    $("gate").hidden = true;
    note("");
    try { emitPull({ organ: "arvision", capability: "camera-open", fromSurface: "asherin-arvision", status: "ok", quote: S.facing }); } catch (_) {}
  }

  async function flipCam() {
    await listCams();
    if (S.devices.length < 2) { note("only one camera"); return; }
    const ids = S.devices.map((d) => d.deviceId);
    const i = Math.max(0, ids.indexOf(S.deviceId));
    const next = ids[(i + 1) % ids.length];
    S.facing = S.facing === "user" ? "environment" : "user";
    S.mirror = S.facing === "user";
    await startCam(next);
  }

  async function toggleTorch() {
    const track = S.stream && S.stream.getVideoTracks()[0];
    if (!track) return;
    const caps = track.getCapabilities && track.getCapabilities();
    if (!caps || !caps.torch) { note("torch not on this camera"); return; }
    S.torch = !S.torch;
    try { await track.applyConstraints({ advanced: [{ torch: S.torch }] }); }
    catch { note("torch refused"); S.torch = false; }
  }

  function freeze() {
    S.frozen = !S.frozen;
    if (S.frozen) {
      const c = document.createElement("canvas");
      c.width = cam.videoWidth || 1280;
      c.height = cam.videoHeight || 720;
      c.getContext("2d").drawImage(cam, 0, 0);
      S.freezeBitmap = c;
      scanBarcodes(c);
      note("frozen — packet / reverse / ocr");
      runOcr().then(() => runIntel());
    } else {
      S.freezeBitmap = null;
      S.ocr = "";
      note("");
    }
  }

  function stillCanvas() {
    if (S.frozen && S.freezeBitmap) return S.freezeBitmap;
    const c = document.createElement("canvas");
    c.width = cam.videoWidth || 1280;
    c.height = cam.videoHeight || 720;
    c.getContext("2d").drawImage(cam, 0, 0);
    return c;
  }

  function reverseSearch() {
    const c = stillCanvas();
    c.toBlob((blob) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "arvision-still.png";
      a.click();
      window.open("https://yandex.com/images/", "_blank", "noopener");
      window.open("https://www.google.com/search?tbm=isch&q=upload", "_blank", "noopener");
      window.open("https://tineye.com/", "_blank", "noopener");
      note("still saved — drop it into the reverse tabs (InVID workflow)");
    }, "image/png");
  }

  async function runOcr() {
    note("ocr…");
    try {
      if (!window.Tesseract) {
        await loadScript("https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js");
      }
      const c = stillCanvas();
      const Tess = window.Tesseract;
      const { data } = await Tess.recognize(c, "eng", { logger: () => {} });
      S.ocr = (data && data.text || "").trim().slice(0, 400);
      note(S.ocr ? "ocr ready" : "ocr empty");
      runIntel();
    } catch (e) {
      S.ocr = "";
      note("ocr CANNOT_RESOLVE");
    }
  }

  async function scanBarcodes(src) {
    S.barcodes = [];
    if (!("BarcodeDetector" in window)) return;
    try {
      const det = new BarcodeDetector({ formats: ["qr_code", "aztec", "data_matrix", "pdf417", "code_128", "ean_13"] });
      const hits = await det.detect(src);
      S.barcodes = (hits || []).map((h) => h.rawValue).filter(Boolean).slice(0, 6);
    } catch (_) {}
  }

  function lmEmbed(lm) {
    const pts = [];
    for (let i = 0; i < lm.length; i += 4) {
      pts.push(lm[i].x, lm[i].y);
    }
    let s = 0;
    for (const v of pts) s += v * v;
    const n = Math.sqrt(s) || 1;
    return pts.map((v) => v / n);
  }

  function cosine(a, b) {
    const n = Math.min(a.length, b.length);
    let d = 0;
    for (let i = 0; i < n; i++) d += a[i] * b[i];
    return d;
  }

  function faceAhash(src, lm) {
    if (!lm || !lm.length) return "";
    let minx = 1, miny = 1, maxx = 0, maxy = 0;
    lm.forEach((p) => {
      minx = Math.min(minx, p.x); miny = Math.min(miny, p.y);
      maxx = Math.max(maxx, p.x); maxy = Math.max(maxy, p.y);
    });
    const [vw, vh] = videoSize(src);
    const sx = minx * vw, sy = miny * vh, sw = Math.max(8, (maxx - minx) * vw), sh = Math.max(8, (maxy - miny) * vh);
    work.width = 8; work.height = 8;
    wctx.drawImage(src, sx, sy, sw, sh, 0, 0, 8, 8);
    const img = wctx.getImageData(0, 0, 8, 8).data;
    const ys = [];
    for (let i = 0; i < img.length; i += 4) ys.push(img[i] * 0.299 + img[i + 1] * 0.587 + img[i + 2] * 0.114);
    const mean = ys.reduce((a, b) => a + b, 0) / ys.length;
    let bits = 0n;
    ys.forEach((y, i) => { if (y >= mean) bits |= (1n << BigInt(i)); });
    return bits.toString(16).padStart(16, "0");
  }

  function matchLocal(embed, ahash) {
    const bank = S.enrollBank || [];
    if (!bank.length) return { match: false, status: "unenrolled", cosine: null };
    let best = -1, bestH = 64;
    bank.forEach((s) => {
      const c = cosine(embed, s.embed || []);
      if (c > best) best = c;
      if (ahash && s.ahash && ahash.length === s.ahash.length) {
        try {
          const h = (BigInt("0x" + ahash) ^ BigInt("0x" + s.ahash)).toString(2).split("1").length - 1;
          if (h < bestH) bestH = h;
        } catch (_) {}
      }
    });
    const hit = best >= 0.992 && (bestH <= 16 || !ahash);
    return { match: hit, status: hit ? "operator" : "unknown-local", cosine: best, hamming: bestH };
  }

  const IDKEY = "asherin-arvision-identity";
  async function loadIdentity() {
    try {
      const j = JSON.parse(localStorage.getItem(IDKEY) || "{}");
      S.enrollBank = j.samples || [];
      S.identity.enrolled = !!(j.samples && j.samples.length);
      S.identity.label = j.label || "operator";
      if (!S.identity.enrolled) S.identity.status = "unenrolled";
    } catch (_) {}
  }

  async function enrollMe() {
    if (!S.lastLm) { note("no face to enroll — look at the camera"); return; }
    const embed = lmEmbed(S.lastLm);
    const ahash = S.lastAhash || "";
    note("enrolling you on this box…");
    try {
      const prev = JSON.parse(localStorage.getItem(IDKEY) || "{}");
      const samples = [...(prev.samples || []), { embed, ahash, ts: new Date().toISOString() }].slice(-6);
      localStorage.setItem(IDKEY, JSON.stringify({
        label: "operator", samples, enrolled_at: prev.enrolled_at || new Date().toISOString(),
        product: "asher.arvision", scope: "this-box-operator-only",
      }));
      await loadIdentity();
      S.identity.status = "operator";
      S.identity.match = true;
      note("enrolled · local only · " + samples.length + " sample" + (samples.length > 1 ? "s" : ""));
    } catch { note("enroll miss"); }
  }

  const MAKES = { tesla:"TESLA", honda:"HONDA", toyota:"TOYOTA", ford:"FORD", chevrolet:"CHEVROLET", chevy:"CHEVROLET", bmw:"BMW", mercedes:"MERCEDES-BENZ", benz:"MERCEDES-BENZ", audi:"AUDI", volkswagen:"VOLKSWAGEN", vw:"VOLKSWAGEN", hyundai:"HYUNDAI", kia:"KIA", nissan:"NISSAN", mazda:"MAZDA", subaru:"SUBARU", lexus:"LEXUS", jeep:"JEEP", ram:"RAM", gmc:"GMC", dodge:"DODGE", volvo:"VOLVO", porsche:"PORSCHE", rivian:"RIVIAN", lucid:"LUCID", genesis:"GENESIS", acura:"ACURA", infiniti:"INFINITI", cadillac:"CADILLAC", lincoln:"LINCOLN", buick:"BUICK", chrysler:"CHRYSLER", mitsubishi:"MITSUBISHI", jaguar:"JAGUAR", mini:"MINI", fiat:"FIAT", polestar:"POLESTAR", ferrari:"FERRARI", hummer:"GMC" };
  const PLATE_STOP = new Set(["THE","AND","FOR","YOU","ARE","NOT","THIS","THAT","WITH","FROM","HAVE","YOUR","WILL","WHAT","WHEN","WHERE","BEEN","WERE","THEY","HTTP","HTTPS","WWW","COM","OCR","NULL","TRUE","FALSE","FACE","POSE"]);
  async function runIntel() {
    const now = performance.now();
    if (now - S.lastIntel < 2500 && S.intel) return;
    S.lastIntel = now;
    note("frame intel…");
    try {
      const ocr = String(S.ocr || "");
      const blob = (ocr + " " + (S.barcodes || []).join(" ")).toUpperCase();
      const objects = (S.objects || []).map((o) => String(o.name || "").toLowerCase());
      const classes = (S.classes || []).map((c) => String(c.name || "").toLowerCase());
      const vins = [];
      const vinRe = /\b([A-HJ-NPR-Z0-9]{17})\b/g;
      let vm;
      while ((vm = vinRe.exec(blob))) {
        const v = vm[1];
        if (/\d/.test(v) && /[A-Z]/.test(v) && vins.indexOf(v) < 0) vins.push(v);
      }
      const plates = [];
      const plateRe = /\b([A-Z]{1,3}[-\s]?\d{2,4}[-\s]?[A-Z]{0,3}|\d{1,3}[-\s]?[A-Z]{2,3}[-\s]?\d{1,4}|[A-Z]{2}[-\s]?\d{2}[-\s]?[A-Z]{2}|[A-Z]{3}[-\s]?\d{3,4})\b/g;
      let pm;
      while ((pm = plateRe.exec(blob))) {
        const p = pm[1].replace(/[-\s]/g, "");
        if (p.length < 5 || p.length > 8 || PLATE_STOP.has(p) || p === p.replace(/\D/g,"") || p === p.replace(/\d/g,"")) continue;
        if (vins.indexOf(p) < 0 && plates.indexOf(p) < 0) plates.push(p);
      }
      const makes = [];
      const hay = (ocr + " " + classes.join(" ") + " " + objects.join(" ")).toLowerCase();
      Object.keys(MAKES).forEach((tok) => {
        if (new RegExp("\\b" + tok + "\\b").test(hay) && makes.indexOf(MAKES[tok]) < 0) makes.push(MAKES[tok]);
      });
      const vinRows = [];
      for (const vin of vins.slice(0, 2)) {
        try {
          const r = await fetch("https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/" + encodeURIComponent(vin) + "?format=json");
          const j = await r.json();
          const row = (j.Results && j.Results[0]) || {};
          const keep = {};
          ["Make","Model","ModelYear","VehicleType","BodyClass","PlantCountry","FuelTypePrimary"].forEach((k) => {
            if (row[k] && row[k] !== "Not Applicable") keep[k] = row[k];
          });
          vinRows.push({ ok: true, vin, decode: keep, source: "NHTSA vPIC", this_is_unsure: !keep.Make });
          if (keep.Make && makes.indexOf(String(keep.Make).toUpperCase()) < 0) makes.push(String(keep.Make).toUpperCase());
        } catch (_) {
          vinRows.push({ ok: false, vin, this_is_unsure: true });
        }
      }
      const plateHits = [];
      for (const p of plates.slice(0, 3)) {
        let rdw = { skipped: true };
        if (p.length === 6) {
          try {
            const rr = await fetch("https://opendata.rdw.nl/resource/m9d7-ebf2.json?kenteken=" + encodeURIComponent(p));
            const rows = await rr.json();
            rdw = rows && rows[0] ? { ok: true, hit: true, vehicle: rows[0], owner: "CANNOT_RESOLVE", source: "RDW opendata NL" } : { ok: false, hit: false, source: "RDW opendata NL" };
          } catch (_) { rdw = { ok: false }; }
        }
        plateHits.push({ plate: p, rdw, owner: "CANNOT_RESOLVE" });
      }
      const carIn = ["car","truck","bus","motorcycle","vehicle","sports car","minivan","jeep","convertible"].some((n) => objects.indexOf(n) >= 0 || classes.indexOf(n) >= 0);
      const vinOk = vinRows.find((row) => row.ok && row.decode && row.decode.Make);
      let guess = null, unsure = true, models = [];
      if (vinOk) {
        const d = vinOk.decode;
        models = d.Model ? [d.Model] : [];
        guess = [d.Make, d.Model, d.ModelYear].filter(Boolean).join(" ");
        unsure = false;
      } else if (makes[0]) {
        guess = makes[0];
      }
      S.intel = {
        ok: true, product: "asher.arvision", organ: "frame-intel",
        car: { in_frame: carIn, guess, makes, models, this_is_unsure: unsure, source: vinOk ? "NHTSA vPIC VIN" : "ocr-badge + class" },
        plates: plateHits, vins: vinRows, public_cameras: { cameras: [], private_feed: "CANNOT_RESOLVE" },
      };
      const plate = plateHits[0] && plateHits[0].plate;
      note(guess || plate ? ("intel · " + [guess, plate].filter(Boolean).join(" · ")) : "intel stored · public index only");
    } catch { note("intel miss"); }
  }

  function maybeAutoIntel() {
    const names = (S.objects || []).map((o) => String(o.name || "").toLowerCase());
    const vehicle = names.some((n) => ["car", "truck", "bus", "motorcycle"].includes(n));
    const now = performance.now();
    if (vehicle && now - S.lastOcr > 14000 && !S.frozen) {
      S.lastOcr = now;
      runOcr();
    }
  }

  function toggleRec() {
    if (S.rec) {
      S.rec.stop();
      S.rec = null;
      return;
    }
    if (!S.stream) return;
    S.recChunks = [];
    const rec = new MediaRecorder(S.stream, { mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm" });
    rec.ondataavailable = (e) => { if (e.data.size) S.recChunks.push(e.data); };
    rec.onstop = () => {
      const blob = new Blob(S.recChunks, { type: "video/webm" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "arvision.webm";
      a.click();
      note("clip saved");
    };
    rec.start();
    S.rec = rec;
    note("recording");
  }

  async function savePacket() {
    const c = stillCanvas();
    const still = c.toDataURL("image/jpeg", 0.72);
    const packet = {
      product: "asher.arvision",
      ts: new Date().toISOString(),
      schema: "ASHERIN VISUAL INTELLIGENCE REPORT",
      A_ENVIRONMENTAL_GRID: {
        sensor_lat: S.lat, sensor_lon: S.lon, sensor_acc_m: S.acc, geo_src: S.geoSrc,
        heading_deg: S.heading, heading_src: S.headingSrc, beta: S.beta, gamma: S.gamma,
        hfov_deg: S.hfov, resolution: [cam.videoWidth, cam.videoHeight], fps: S.fps,
        facing: S.facing, note: "device GNSS is sensor position — not scene geocode unless votes exist",
      },
      B_PRIMARY_ANALYSIS: {
        luma: S.luma, contrast: S.contrast, motion: S.motion, edge_density: S.edges,
        faces: S.faces, objects: S.objects, barcodes: S.barcodes, ocr: S.ocr, blendshapes: S.blend,
      },
      C_SITUATIONAL_INTELLIGENCE: {
        obstruction: S.obstruction,
        scene_location: S.ocr ? "signage votes present — confirm before lock" : "CANNOT_RESOLVE",
        this_is_unsure: true,
      },
      D_ANOMALY_REPORT: { motion_spike: S.motion > 0.18, dark: S.luma < 0.12, blown: S.luma > 0.88 },
      E_OBSTRUCTION_LOG: S.obstruction,
      OVERALL_CONFIDENCE: S.faces || S.objects.length ? "medium" : "low",
      misb_analog: misbFields(),
      identity: S.identity,
      classes: S.classes,
      frame_intel: S.intel,
      still_jpeg: still,
    };
    try {
      const r = await fetch("/api/packet", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(packet) });
      const j = await r.json();
      note(j.ok ? "packet saved in asherin" : "packet miss");
    } catch {
      const a = document.createElement("a");
      a.href = "data:application/json," + encodeURIComponent(JSON.stringify(packet));
      a.download = "arvision-packet.json";
      a.click();
      note("packet downloaded (api miss)");
    }
  }

  function misbFields() {
    return {
      unix: Date.now() * 1000,
      zulu: new Date().toISOString(),
      SensorLatitude: S.lat,
      SensorLongitude: S.lon,
      PlatformHeading: S.heading,
      PlatformPitch: S.beta,
      PlatformRoll: S.gamma,
      HorizontalFOV: S.hfov,
      FrameCenter: "CANNOT_RESOLVE unless outdoor GNSS+horizon+signage",
      analog: true,
      standard: "MISB ST 0601 field names — device IMU/GNSS analog, not airborne KLV",
    };
  }

  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s);
    });
  }

  async function loadModels() {
    try {
      const mod = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm");
      const vision = await mod.FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
      );
      const base = { delegate: "GPU" };
      try {
        S.models.face = await mod.FaceLandmarker.createFromOptions(vision, {
          baseOptions: { ...base, modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task" },
          runningMode: "VIDEO", numFaces: 2, outputFaceBlendshapes: true,
        });
      } catch {
        S.models.face = await mod.FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task", delegate: "CPU" },
          runningMode: "VIDEO", numFaces: 2, outputFaceBlendshapes: true,
        });
      }
      try {
        S.models.pose = await mod.PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task", delegate: "GPU" },
          runningMode: "VIDEO", numPoses: 1,
        });
      } catch (_) {}
      try {
        S.models.obj = await mod.ObjectDetector.createFromOptions(vision, {
          baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite", delegate: "GPU" },
          runningMode: "VIDEO", scoreThreshold: 0.45, maxResults: 8,
        });
      } catch (_) {}
      try {
        S.models.cls = await mod.ImageClassifier.createFromOptions(vision, {
          baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/image_classifier/efficientnet_lite0/float32/1/efficientnet_lite0.tflite", delegate: "GPU" },
          runningMode: "VIDEO", maxResults: 5, scoreThreshold: 0.18,
        });
      } catch (_) {}
      S.models.connectors = {
        faceOval: mod.FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,
        leftEye: mod.FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
        rightEye: mod.FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
        lips: mod.FaceLandmarker.FACE_LANDMARKS_LIPS,
        pose: mod.PoseLandmarker.POSE_CONNECTIONS,
      };
      S.models.status = "live";
    } catch (e) {
      S.models.status = "native-only";
      note("models blocked — native intel still on");
    }
  }

  function nativeIntel(src) {
    const w = 160, h = 90;
    work.width = w; work.height = h;
    wctx.drawImage(src, 0, 0, w, h);
    const img = wctx.getImageData(0, 0, w, h).data;
    let sum = 0, sum2 = 0, edge = 0;
    const hist = new Array(8).fill(0);
    const gray = new Float32Array(w * h);
    for (let i = 0, p = 0; i < img.length; i += 4, p++) {
      const y = (img[i] * 0.299 + img[i + 1] * 0.587 + img[i + 2] * 0.114) / 255;
      gray[p] = y;
      sum += y; sum2 += y * y;
      hist[Math.min(7, (y * 8) | 0)]++;
    }
    const n = w * h;
    S.luma = sum / n;
    S.contrast = Math.sqrt(Math.max(0, sum2 / n - S.luma * S.luma));
    S.hist = hist.map((v) => v / n);
    if (S.lastGray && S.lastGray.length === gray.length) {
      let sad = 0;
      for (let i = 0; i < gray.length; i++) sad += Math.abs(gray[i] - S.lastGray[i]);
      S.motion = sad / n;
    }
    S.lastGray = gray;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const gx = gray[i + 1] - gray[i - 1];
        const gy = gray[i + w] - gray[i - w];
        if (Math.abs(gx) + Math.abs(gy) > 0.35) edge++;
      }
    }
    S.edges = edge / n;
    const obs = [];
    if (S.luma < 0.12) obs.push("dark");
    if (S.luma > 0.88) obs.push("blown highlights");
    if (S.motion > 0.22) obs.push("motion blur risk");
    if (S.edges < 0.01) obs.push("low edge / defocus or empty");
    if (S.frozen) obs.push("frozen still");
    S.obstruction = obs;
  }

  function coverMap(nx, ny, vw, vh, cw, ch) {
    let x, y;
    if (!vw || !vh) { x = nx * cw; y = ny * ch; }
    else {
      const va = vw / vh, ca = cw / ch;
      let scale, ox, oy;
      if (ca > va) { scale = ch / vh; ox = (cw - vw * scale) / 2; oy = 0; }
      else { scale = cw / vw; ox = 0; oy = (ch - vh * scale) / 2; }
      x = ox + nx * vw * scale;
      y = oy + ny * vh * scale;
    }
    if (selfieMirror()) x = cw - x;
    return [x, y];
  }

  function videoSize(src) {
    return [src.videoWidth || src.width || 1280, src.videoHeight || src.height || 720];
  }

  function drawConnect(landmarks, conns, color, W, H, vw, vh) {
    if (!conns || !landmarks) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (const c of conns) {
      const a = landmarks[c.start]; const b = landmarks[c.end];
      if (!a || !b) continue;
      const p = coverMap(a.x, a.y, vw, vh, W, H);
      const q = coverMap(b.x, b.y, vw, vh, W, H);
      ctx.moveTo(p[0], p[1]);
      ctx.lineTo(q[0], q[1]);
    }
    ctx.stroke();
  }

  function loop() {
    const src = S.frozen && S.freezeBitmap ? S.freezeBitmap : cam;
    if (dead) return;
    const rw = Math.max(1, root.clientWidth || wrap.clientWidth || innerWidth);
    const rh = Math.max(1, root.clientHeight || wrap.clientHeight || innerHeight);
    const W = hud.width = rw * devicePixelRatio;
    const H = hud.height = rh * devicePixelRatio;
    hud.style.width = rw + "px";
    hud.style.height = rh + "px";
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    const w = rw, h = rh;
    ctx.clearRect(0, 0, w, h);

    if (src && (src.readyState >= 2 || src.width)) nativeIntel(src);

    const now = performance.now();
    S.frames++;
    if (now - S.fpsT > 500) {
      S.fps = Math.round(S.frames * 1000 / (now - S.fpsT));
      S.frames = 0; S.fpsT = now;
    }

    if (layers.grid) {
      ctx.strokeStyle = "rgba(158,201,255,.18)";
      ctx.lineWidth = 1;
      for (let i = 1; i < 3; i++) {
        ctx.beginPath(); ctx.moveTo(w * i / 3, 0); ctx.lineTo(w * i / 3, h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, h * i / 3); ctx.lineTo(w, h * i / 3); ctx.stroke();
      }
    }

    if (layers.reticle) {
      ctx.strokeStyle = "rgba(245,247,251,.55)";
      ctx.lineWidth = 1.25;
      const cx = w / 2, cy = h / 2, r = 18;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - 36, cy); ctx.lineTo(cx - 8, cy);
      ctx.moveTo(cx + 8, cy); ctx.lineTo(cx + 36, cy);
      ctx.moveTo(cx, cy - 36); ctx.lineTo(cx, cy - 8);
      ctx.moveTo(cx, cy + 8); ctx.lineTo(cx, cy + 36); ctx.stroke();
    }

    if (layers.horizon && S.beta != null) {
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate((-S.gamma || 0) * Math.PI / 180);
      const y = (S.beta / 90) * (h * 0.35);
      ctx.strokeStyle = "rgba(126,224,198,.7)";
      ctx.beginPath(); ctx.moveTo(-w, y); ctx.lineTo(w, y); ctx.stroke();
      ctx.restore();
    }

    if (layers.peaking && S.lastGray) {
      ctx.fillStyle = "rgba(158,201,255,.28)";
      const pw = work.width, ph = work.height;
      for (let y = 1; y < ph - 1; y += 2) {
        for (let x = 1; x < pw - 1; x += 2) {
          const i = y * pw + x;
          const gx = S.lastGray[i + 1] - S.lastGray[i - 1];
          const gy = S.lastGray[i + pw] - S.lastGray[i - pw];
          if (Math.abs(gx) + Math.abs(gy) > 0.45) {
            const px = x / pw * w;
            ctx.fillRect(selfieMirror() ? w - px - 3 : px, y / ph * h, 3, 3);
          }
        }
      }
    }

    if (layers.motion && S.motion > 0.04) {
      ctx.fillStyle = "rgba(232,197,107,.12)";
      ctx.fillRect(0, 0, w, 6);
    }

    const ts = now;
    S.objects = [];
    S.faces = 0;
    S.poseOn = false;
    S.blend = "";

    const [vw, vh] = videoSize(src);
    const canDetect = src && (src.videoWidth || src.width) && !S.frozen;
    if (S.models.face && layers.mesh && canDetect) {
      try {
        const res = S.models.face.detectForVideo(src, ts);
        const lms = res.faceLandmarks || [];
        S.faces = lms.length;
        const C = S.models.connectors || {};
        lms.forEach((lm, fi) => {
          drawConnect(lm, C.faceOval, "rgba(158,201,255,.85)", w, h, vw, vh);
          drawConnect(lm, C.leftEye, "rgba(126,224,198,.9)", w, h, vw, vh);
          drawConnect(lm, C.rightEye, "rgba(126,224,198,.9)", w, h, vw, vh);
          drawConnect(lm, C.lips, "rgba(245,247,251,.7)", w, h, vw, vh);
          if (fi === 0) {
            S.lastLm = lm;
            if (S.frames % 8 === 0) S.lastAhash = faceAhash(src, lm);
            const embed = lmEmbed(lm);
            const hit = matchLocal(embed, S.lastAhash);
            S.identity.status = hit.status;
            S.identity.match = hit.match;
            S.identity.cosine = hit.cosine;
            if (layers.identity) {
              const top = lm.reduce((a, p) => p.y < a.y ? p : a, lm[0]);
              const p = coverMap(top.x, top.y, vw, vh, w, h);
              const tag = hit.match ? "YOU · operator" : (hit.status === "unenrolled" ? "face · not enrolled" : "unknown · local only");
              ctx.fillStyle = "rgba(11,16,24,.72)";
              ctx.fillRect(p[0] - 4, p[1] - 22, 150, 16);
              ctx.fillStyle = hit.match ? "#7ee0c6" : "#f5f7fb";
              ctx.font = "11px Segoe UI, sans-serif";
              ctx.fillText(tag, p[0], p[1] - 10);
            }
          }
        });
        const bs = res.faceBlendshapes && res.faceBlendshapes[0] && res.faceBlendshapes[0].categories;
        if (bs) {
          const top = bs.filter((c) => c.score > 0.45).sort((a, b) => b.score - a.score).slice(0, 3);
          S.blend = top.map((c) => c.categoryName.replace("faceBlendshapes_", "") + " " + c.score.toFixed(2)).join(" · ");
        }
      } catch (_) {}
    }

    if (S.models.pose && layers.pose && canDetect) {
      try {
        const res = S.models.pose.detectForVideo(src, ts + 1);
        const lms = res.landmarks || [];
        if (lms[0]) {
          S.poseOn = true;
          drawConnect(lms[0], (S.models.connectors || {}).pose, "rgba(158,201,255,.55)", w, h, vw, vh);
        }
      } catch (_) {}
    }

    if (S.models.obj && layers.objects && canDetect) {
      try {
        const res = S.models.obj.detectForVideo(src, ts + 2);
        const dets = res.detections || [];
        S.objects = dets.map((d) => {
          const cat = (d.categories && d.categories[0]) || {};
          const bb = d.boundingBox || {};
          const p = coverMap(bb.originX / vw, bb.originY / vh, vw, vh, w, h);
          const q = coverMap((bb.originX + bb.width) / vw, (bb.originY + bb.height) / vh, vw, vh, w, h);
          const bx = Math.min(p[0], q[0]), by = Math.min(p[1], q[1]);
          const bw = Math.abs(q[0] - p[0]), bh = Math.abs(q[1] - p[1]);
          ctx.strokeStyle = "rgba(158,201,255,.8)";
          ctx.strokeRect(bx, by, bw, bh);
          ctx.fillStyle = "rgba(11,16,24,.72)";
          const label = (cat.categoryName || "?") + " " + Math.round((cat.score || 0) * 100) + "%";
          ctx.fillRect(bx, by - 16, Math.min(160, bw), 16);
          ctx.fillStyle = "#f5f7fb";
          ctx.font = "11px Segoe UI, sans-serif";
          ctx.fillText(label, bx + 4, by - 4);
          return { name: cat.categoryName, score: cat.score, x: bx, y: by, w: bw, h: bh };
        });
        drawHonest(S.objects, w, h);
      } catch (_) {}
    }

    if (S.models.cls && layers.classify && canDetect) {
      S.clsTick++;
      if (S.clsTick % 10 === 0) {
        try {
          const cres = S.models.cls.classifyForVideo(src, ts + 3);
          const cats = (cres.classifications && cres.classifications[0] && cres.classifications[0].categories) || [];
          S.classes = cats.slice(0, 5).map((c) => ({ name: c.categoryName, score: c.score }));
        } catch (_) {}
      }
    }

    maybeAutoIntel();

    if (layers.rf) drawRf(w, h);
    drawIntelChips(w, h);

    if (S.barcodes.length) {
      ctx.fillStyle = "rgba(126,224,198,.9)";
      ctx.font = "12px Segoe UI, sans-serif";
      ctx.fillText("id " + S.barcodes[0].slice(0, 48), 24, h - 24);
    }

    paintMisb();
    paintSheet();
    requestAnimationFrame(loop);
  }

  function paintMisb() {
    const lat = S.lat != null ? S.lat.toFixed(5) : "CANNOT_RESOLVE";
    const lon = S.lon != null ? S.lon.toFixed(5) : "CANNOT_RESOLVE";
    const hdg = S.heading != null ? Math.round(S.heading) + "°" : "no mag";
    misbEl.innerHTML = `<b>${new Date().toISOString().slice(11, 19)}Z</b>
      <div>${lat} · ${lon}</div>
      <div class="m">hdg ${hdg} · fov ${S.hfov ? Math.round(S.hfov) + "° analog" : "—"} · ${S.fps} fps · ${S.models.status}</div>
      <div class="m">ST 0601 analog · sensor ≠ scene · rf ${S.rf.n || 0}</div>`;
  }

  function paintSheet() {
    const obj = S.objects.map((o) => o.name).filter(Boolean).slice(0, 6).join(", ") || "none";
    sheetEl.innerHTML = `<h2>live intel</h2>
      <div class="row"><span class="k">luma</span><span class="v">${S.luma.toFixed(2)}</span></div>
      <div class="row"><span class="k">contrast</span><span class="v">${S.contrast.toFixed(2)}</span></div>
      <div class="row"><span class="k">motion</span><span class="v">${S.motion.toFixed(3)}</span></div>
      <div class="row"><span class="k">edges</span><span class="v">${S.edges.toFixed(3)}</span></div>
      <div class="row"><span class="k">faces</span><span class="v">${S.faces}</span></div>
      <div class="row"><span class="k">pose</span><span class="v">${S.poseOn ? "on" : "off"}</span></div>
      <div class="row"><span class="k">who</span><span class="v">${esc(S.identity.status || "—")}</span></div>
      <div class="row"><span class="k">objects</span><span class="v">${obj}</span></div>
      <div class="row"><span class="k">what</span><span class="v">${esc((S.classes || []).slice(0, 3).map((c) => c.name).join(", ") || "classifier…")}</span></div>
      <div class="row"><span class="k">car</span><span class="v">${esc((S.intel && S.intel.car && (S.intel.car.guess || (S.intel.car.in_frame ? "in frame · unsure") : "none")) || "none")}</span></div>
      <div class="row"><span class="k">plate</span><span class="v">${esc((S.intel && S.intel.plates && S.intel.plates[0] && S.intel.plates[0].plate) || "none")}</span></div>
      <div class="row"><span class="k">ids</span><span class="v">${S.barcodes[0] ? S.barcodes[0].slice(0, 18) : "none"}</span></div>
      <div class="list">${S.blend || ""}</div>
      <div class="list">${(S.obstruction.join(" · ") || "clear") }</div>
      <div class="list">${S.ocr ? S.ocr.slice(0, 180) : "ocr on freeze / auto on car"}</div>
      <div class="list">scene geocode: CANNOT_RESOLVE until ≥3 visual votes</div>
      <div class="list">headphones music: CANNOT_RESOLVE unless MCS GATT · A2DP intercept refused</div>
      <div class="list">laptop screen: CANNOT_RESOLVE · no implant</div>
      <div class="list">private camera feed: CANNOT_RESOLVE · public DOT only</div>
      ${(S.intel && S.intel.public_cameras && S.intel.public_cameras.cameras || []).slice(0, 3).map((c) =>
        `<div class="list">public cam · ${esc((c.name || "").slice(0, 40))}</div>`
      ).join("")}
      <div class="list">rf engine ${S.rf.engine || "…"} · ${S.rf.n} emitters</div>
      ${(S.rf.tracks || []).slice(0, 8).map((t) =>
        `<div class="row"><span class="k">${esc(t.mode === "rf_occluded" ? "ghost" : t.mode)}</span><span class="v">${esc((t.name || t.class || t.id || "").slice(0, 22))} ${t.rssi || ""}</span></div>`
      ).join("")}
      ${(S.rf.wifi || []).slice(0, 3).map((w) =>
        `<div class="list">${esc(w.ssid || "ssid")} · ${(w.auth || "").slice(0, 16)}</div>`
      ).join("")}`;
  }

  function esc(s) {
    return String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  function drawHonest(objs) {
    const map = {
      laptop: "laptop screen: CANNOT_RESOLVE",
      tv: "private feed: CANNOT_RESOLVE",
      "cell phone": "their camera: CANNOT_RESOLVE",
      keyboard: "typed text: CANNOT_RESOLVE",
    };
    (objs || []).forEach((o) => {
      const msg = map[String(o.name || "").toLowerCase()];
      if (!msg || !o.w) return;
      ctx.fillStyle = "rgba(232,197,107,.92)";
      ctx.font = "10px Segoe UI, sans-serif";
      ctx.fillText(msg, o.x + 4, o.y + o.h + 14);
    });
  }

  function drawIntelChips(w, h) {
    const car = S.intel && S.intel.car && S.intel.car.guess;
    const plate = S.intel && S.intel.plates && S.intel.plates[0];
    const vin = S.intel && S.intel.vins && S.intel.vins[0] && S.intel.vins[0].decode;
    let y = h - 96;
    const chip = (txt, ok) => {
      ctx.fillStyle = ok ? "rgba(8,14,12,.7)" : "rgba(18,14,8,.7)";
      ctx.fillRect(24, y, Math.min(420, 18 + txt.length * 7.2), 20);
      ctx.fillStyle = ok ? "#7ee0c6" : "#e8c56b";
      ctx.font = "11px Segoe UI, sans-serif";
      ctx.fillText(txt, 32, y + 14);
      y -= 24;
    };
    if (vin && (vin.Make || vin.Model)) chip("VIN · " + [vin.Make, vin.Model, vin.ModelYear].filter(Boolean).join(" "), true);
    if (plate && plate.plate) chip("plate · " + plate.plate + " · owner CANNOT_RESOLVE", false);
    if (car) chip("car · " + car + (S.intel.car.this_is_unsure ? " · unsure" : ""), !S.intel.car.this_is_unsure);
    (S.classes || []).slice(0, 2).forEach((c) => chip("class · " + c.name, false));
  }

  const TECH = new Set(["cell phone", "laptop", "tv", "remote", "keyboard", "mouse", "clock", "microwave"]);

  function drawRf(w, h) {
    const tracks = S.rf.tracks || [];
    const fused = tracks.filter((t) => t.mode === "fused_in_frame" || t.mode === "fused_on_person" || t.mode === "in_front_or_on_body");
    const ghost = tracks.filter((t) => t.mode === "rf_occluded");
    const techBoxes = (S.objects || []).filter((o) => TECH.has(String(o.name || "").toLowerCase()) && o.w);
    fused.slice(0, 5).forEach((t, i) => {
      const box = techBoxes[i] || techBoxes[0];
      let x = w * 0.62, y = 90 + i * 70, bw = 210, bh = 58;
      if (box) { x = box.x; y = box.y + box.h + 4; bw = Math.max(180, box.w); }
      paintEmitter(x, y, bw, 58, t, false);
    });
    ghost.slice(0, 6).forEach((t, i) => {
      const x = 16;
      const y = 108 + i * 66;
      paintEmitter(x, y, 236, 58, t, true);
    });
  }

  function paintEmitter(x, y, bw, bh, t, ghost) {
    ctx.save();
    ctx.strokeStyle = ghost ? "rgba(232,197,107,.85)" : "rgba(126,224,198,.9)";
    ctx.setLineDash(ghost ? [5, 4] : []);
    ctx.lineWidth = 1.4;
    ctx.strokeRect(x, y, bw, bh);
    ctx.fillStyle = ghost ? "rgba(18,14,8,.55)" : "rgba(8,14,12,.55)";
    ctx.fillRect(x, y, bw, bh);
    ctx.setLineDash([]);
    ctx.fillStyle = "#f5f7fb";
    ctx.font = "600 12px Segoe UI, sans-serif";
    const title = (t.name || t.class || "emitter").slice(0, 26);
    ctx.fillText(title, x + 8, y + 16);
    ctx.font = "11px Segoe UI, sans-serif";
    ctx.fillStyle = "rgba(245,247,251,.7)";
    const rng = (t.range && t.range.band) || "";
    ctx.fillText((t.class || "") + " · " + (t.rssi != null ? t.rssi + " dBm" : "no rssi"), x + 8, y + 32);
    const g = t.gatt || {};
    const media = (g.media && g.media.track_title && g.media.track_title !== "CANNOT_RESOLVE") ? g.media.track_title : "";
    const gtxt = media || g.manufacturer || g.model || (t.manufacturer && t.manufacturer[0]) || t.probe || "";
    const extra = t.class === "audio" && !media ? "music CANNOT_RESOLVE" : (ghost ? "RF ONLY · structure analog · " : "IN FRAME · ");
    ctx.fillText(extra + String(gtxt).slice(0, 28), x + 8, y + 48);
    ctx.restore();
  }

  async function pollRf() {
    if (!S.rf.engine) S.rf.engine = "browser";
  }

  async function probeStrongest() {
    const bt = navigator.bluetooth;
    if (!bt || !bt.requestDevice) { note("bluetooth picker not in this browser — companion for live ads"); return; }
    note("pick a bluetooth device…");
    try {
      const dev = await bt.requestDevice({ acceptAllDevices: true, optionalServices: ["battery_service", "device_information", "generic_access"] });
      S.rf.tracks = [{ id: dev.id, name: dev.name || "bt", class: "bluetooth", mode: "in_front_or_on_body", probe: "picked" }];
      S.rf.n = 1;
      S.rf.engine = "web-bluetooth";
      note("bt pick · " + (dev.name || "unnamed"));
    } catch (e) { note("bt pick miss"); }
  }

  function sensors() {
    if (navigator.geolocation) {
      navigator.geolocation.watchPosition((p) => {
        S.lat = p.coords.latitude; S.lon = p.coords.longitude;
        S.acc = p.coords.accuracy; S.geoSrc = "gnss";
      }, () => { S.geoSrc = "denied"; }, { enableHighAccuracy: true, maximumAge: 2000 });
    }
    const onOri = (e) => {
      const abs = e.webkitCompassHeading;
      if (typeof abs === "number" && !Number.isNaN(abs)) {
        S.heading = abs; S.headingSrc = "webkitCompassHeading";
      } else if (e.absolute && typeof e.alpha === "number") {
        S.heading = (360 - e.alpha) % 360; S.headingSrc = "absolute-alpha";
      } else if (typeof e.alpha === "number") {
        S.heading = (360 - e.alpha) % 360; S.headingSrc = "alpha-unsure";
      }
      S.beta = e.beta; S.gamma = e.gamma;
      const dim = S.headingSrc === "none" || S.headingSrc === "alpha-unsure";
      compassBtn.classList.toggle("dim", dim);
      if (S.heading != null) rose.setAttribute("transform", `rotate(${-S.heading} 44 44)`);
    };
    window.addEventListener("deviceorientationabsolute", onOri, true);
    window.addEventListener("deviceorientation", onOri, true);
    offs.push(function () {
      window.removeEventListener("deviceorientationabsolute", onOri, true);
      window.removeEventListener("deviceorientation", onOri, true);
    });
    if (typeof DeviceOrientationEvent !== "undefined" && DeviceOrientationEvent.requestPermission) {
      compassBtn.onclick = async () => {
        try { await DeviceOrientationEvent.requestPermission(); } catch (_) {}
      };
    }
  }

  $("allow").onclick = () => startCam().catch((e) => { note(String(e.message || e)); });
  layerChips();
  talkBtns();
  sensors();
  startCam().catch(() => {});
  loadModels();
  loadIdentity();
  const rfTimer = setInterval(pollRf, 450);
  pollRf();
  requestAnimationFrame(loop);
  return function cleanup() {
    dead = true;
    clearInterval(rfTimer);
    if (S.stream) S.stream.getTracks().forEach((t) => t.stop());
    offs.forEach((fn) => fn());
  };

}

const AsherinArVisionView = () => {
  const rootRef = useRef(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.innerHTML = "";
    const style = document.createElement("style");
    style.setAttribute("data-arvision-hud", "1");
    style.textContent = HUD_CSS;
    const wrap = document.createElement("div");
    wrap.className = "arv-root";
    wrap.innerHTML = HUD_BODY;
    root.appendChild(style);
    root.appendChild(wrap);
    const cleanup = bootArvision(wrap, root, emitPull) || (() => {});
    return () => {
      try { cleanup(); } catch (_) {}
      root.innerHTML = "";
    };
  }, []);
  return (
    <div
      ref={rootRef}
      className="absolute inset-0 h-full min-h-[100%] w-full overflow-hidden bg-black"
    />
  );
};

export default AsherinArVisionView;
