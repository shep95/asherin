// asherin.sentinel — the passive bluetooth bridge.
//
// A browser cannot see a real bluetooth address. It hands out a per-session
// handle that rotates, which means the one question an owner most needs
// answered — "does my own device broadcast a permanent address?" — is
// unanswerable from a tab. This process can answer it, because an OS scanner
// hands over the packet as it arrived.
//
// The boundaries this bridge holds, in code and not only in copy:
//   • scan only. it never calls connect(), never reads a characteristic, never
//     pairs, never writes. an advertisement is a public broadcast; reading it
//     is observation, not access.
//   • it binds to 127.0.0.1 only, so nothing off this machine can reach it.
//   • it accepts connections from the operator's own dashboard origins only.
//   • when the platform scanner is missing it says so plainly rather than
//     emitting an empty roster that reads like an empty room.

const http = require("node:http");
const crypto = require("node:crypto");

const PORT = 8769;
const HOST = "127.0.0.1";
const ALLOWED_ORIGINS = [
  /^https:\/\/([a-z0-9-]+\.)*asherin\.com$/i,
  /^https:\/\/([a-z0-9-]+\.)*lovable\.app$/i,
  /^https:\/\/([a-z0-9-]+\.)*lovableproject\.com$/i,
  /^http:\/\/localhost(:\d+)?$/i,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/i,
];

let noble = null;
let nobleError = null;
try {
  // Optional: the bridge is useful only where a platform scanner exists, and a
  // missing module must degrade to an honest message, never to a crash.
  noble = require("@abandonware/noble");
} catch (e) {
  nobleError =
    "no platform bluetooth scanner is installed. run `npm install @abandonware/noble` inside the companion folder, then restart. on linux the process also needs cap_net_raw.";
}

const clients = new Set();
let scanning = false;

function frame(payload) {
  const data = Buffer.from(JSON.stringify(payload));
  const len = data.length;
  let header;
  if (len < 126) header = Buffer.from([0x81, len]);
  else if (len < 65536) header = Buffer.from([0x81, 126, (len >> 8) & 0xff, len & 0xff]);
  else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, data]);
}

function broadcast(payload) {
  const buf = frame(payload);
  for (const socket of clients) {
    try {
      socket.write(buf);
    } catch {
      clients.delete(socket);
    }
  }
}

function readClientFrames(socket, onText) {
  let buffer = Buffer.alloc(0);
  socket.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    // Minimal client-frame parser: control frames and short masked text only,
    // which is all the dashboard ever sends.
    while (buffer.length >= 2) {
      const opcode = buffer[0] & 0x0f;
      const masked = (buffer[1] & 0x80) !== 0;
      let len = buffer[1] & 0x7f;
      let offset = 2;
      if (len === 126) {
        if (buffer.length < 4) return;
        len = buffer.readUInt16BE(2);
        offset = 4;
      } else if (len === 127) {
        return; // oversized: the dashboard never sends one
      }
      const maskLen = masked ? 4 : 0;
      if (buffer.length < offset + maskLen + len) return;
      const mask = masked ? buffer.subarray(offset, offset + 4) : null;
      const body = buffer.subarray(offset + maskLen, offset + maskLen + len);
      if (mask) for (let i = 0; i < body.length; i++) body[i] ^= mask[i % 4];
      buffer = buffer.subarray(offset + maskLen + len);
      if (opcode === 0x8) {
        socket.end();
        return;
      }
      if (opcode === 0x1) onText(body.toString("utf8"));
    }
  });
}

function toPacket(peripheral) {
  const a = peripheral.advertisement || {};
  const manufacturerData = {};
  if (a.manufacturerData && a.manufacturerData.length >= 2) {
    const companyId = a.manufacturerData.readUInt16LE(0);
    manufacturerData[companyId] = Array.from(a.manufacturerData.subarray(2, 32));
  }
  const serviceData = {};
  for (const entry of a.serviceData || []) {
    serviceData[String(entry.uuid)] = Array.from(entry.data.subarray(0, 32));
  }
  return {
    // `address` is "unknown" on macOS, where the OS deliberately hides the MAC
    // and hands out a per-host uuid instead. Saying so beats printing a uuid as
    // though it were hardware.
    address: peripheral.address && peripheral.address !== "" ? peripheral.address : peripheral.uuid,
    addressIsHardware: Boolean(peripheral.address && peripheral.address !== "" && peripheral.addressType !== "unknown"),
    addressType: peripheral.addressType || "unknown",
    name: a.localName || null,
    rssi: typeof peripheral.rssi === "number" ? peripheral.rssi : null,
    txPower: typeof a.txPowerLevel === "number" ? a.txPowerLevel : null,
    serviceUuids: Array.isArray(a.serviceUuids) ? a.serviceUuids : [],
    manufacturerData,
    serviceData,
    appearance: null,
    deviceClass: null,
    at: Date.now(),
  };
}

function startScan() {
  if (!noble) {
    broadcast({ type: "error", message: nobleError });
    return;
  }
  if (scanning) return;
  scanning = true;
  const begin = () => {
    // allowDuplicates: true — collapsing repeats would erase the per-second
    // record this whole feature exists to keep.
    noble.startScanning([], true, (err) => {
      if (err) broadcast({ type: "error", message: `scan refused by the platform: ${err.message}` });
    });
  };
  if (noble.state === "poweredOn") begin();
  else noble.once("stateChange", (state) => (state === "poweredOn" ? begin() : broadcast({ type: "error", message: `bluetooth adapter is ${state}` })));
}

function stopScan() {
  if (!noble || !scanning) return;
  scanning = false;
  try {
    noble.stopScanning();
  } catch {
    /* adapter already down */
  }
}

if (noble) {
  noble.on("discover", (peripheral) => {
    if (!clients.size) return;
    broadcast({ type: "advert", packet: toPacket(peripheral) });
  });
}

function start() {
  const server = http.createServer((_req, res) => {
    res.writeHead(426, { "Content-Type": "text/plain" });
    res.end("asherin sentinel ble bridge — websocket only");
  });

  server.on("upgrade", (req, socket) => {
    const origin = req.headers.origin || "";
    if (origin && !ALLOWED_ORIGINS.some((re) => re.test(origin))) {
      socket.end("HTTP/1.1 403 Forbidden\r\n\r\n");
      return;
    }
    const key = req.headers["sec-websocket-key"];
    if (!key) {
      socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
      return;
    }
    const accept = crypto
      .createHash("sha1")
      .update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
      .digest("base64");
    socket.write(
      `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`,
    );
    socket.setNoDelay(true);
    clients.add(socket);

    if (nobleError) socket.write(frame({ type: "error", message: nobleError }));

    readClientFrames(socket, (text) => {
      let msg;
      try {
        msg = JSON.parse(text);
      } catch {
        return;
      }
      if (msg.action === "scan-start") startScan();
      if (msg.action === "scan-stop") stopScan();
    });

    const drop = () => {
      clients.delete(socket);
      if (!clients.size) stopScan();
    };
    socket.on("close", drop);
    socket.on("error", drop);
  });

  server.listen(PORT, HOST, () => {
    console.log(`[sentinel] ble bridge listening on ws://${HOST}:${PORT}${noble ? "" : " (no scanner installed)"}`);
  });

  return () => {
    stopScan();
    for (const s of clients) s.end();
    server.close();
  };
}

module.exports = { start, available: () => Boolean(noble), reason: () => nobleError };
