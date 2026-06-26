// Hop brain — cooperative-scanner mesh.
// Pragmatic browser path:
//   • BroadcastChannel("zaxin-hops") synchronises tabs/windows on the same
//     origin (multiple browser instances on one laptop, or PWA + tab).
//   • Manual JSON snapshot export/import covers cross-device hops without
//     pretending we have peer-to-peer over hostile networks.

import type { HopReport } from "./types";

const CHANNEL = "zaxin-hops";

export class HopBrain {
  private ch: BroadcastChannel | null = null;
  private onReport: ((r: HopReport) => void) | null = null;
  private timer: number | null = null;
  private produce: (() => HopReport) | null = null;

  start(produce: () => HopReport, onReport: (r: HopReport) => void) {
    this.produce = produce;
    this.onReport = onReport;
    if (typeof BroadcastChannel === "undefined") return;
    this.ch = new BroadcastChannel(CHANNEL);
    this.ch.onmessage = (ev) => {
      const data = ev.data as HopReport | undefined;
      if (!data?.nodeId) return;
      // ignore our own reports
      const local = produce();
      if (data.nodeId === local.nodeId) return;
      onReport(data);
    };
    this.timer = window.setInterval(() => this.broadcast(), 5_000);
    this.broadcast();
  }

  broadcast() {
    if (!this.ch || !this.produce) return;
    try { this.ch.postMessage(this.produce()); } catch { /* */ }
  }

  stop() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    this.ch?.close(); this.ch = null;
  }

  exportSnapshotBlob(): string {
    if (!this.produce) return "";
    return JSON.stringify(this.produce(), null, 2);
  }

  importSnapshot(json: string) {
    const r = JSON.parse(json) as HopReport;
    if (!r.nodeId || !Array.isArray(r.contacts)) throw new Error("Invalid hop snapshot.");
    this.onReport?.(r);
  }
}
