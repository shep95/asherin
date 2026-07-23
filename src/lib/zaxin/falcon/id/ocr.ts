// Zaxin Falcon — Lazy Tesseract worker for front-of-card OCR
// -----------------------------------------------------------
// Reuses the same tesseract.js runtime as alpr.ts but with an English-only
// character whitelist tuned for name/DOB/DL# lift. Lazily loaded on first
// invocation so ID mode doesn't pay the ~4 s cold-start until the operator
// actually needs it.

import Tesseract, { createWorker, type Worker } from "tesseract.js";

let workerPromise: Promise<Worker> | null = null;

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const w = await createWorker("eng", 1, { logger: () => {} });
      await w.setParameters({
        tessedit_char_whitelist:
          "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,-/",
      });
      return w;
    })();
  }
  return workerPromise;
}

export async function ocrFrontOfCard(source: HTMLCanvasElement | HTMLImageElement | ImageData | Blob | string): Promise<string> {
  try {
    const w = await getWorker();
    const { data } = await w.recognize(source as Tesseract.ImageLike);
    return (data.text ?? "").trim();
  } catch (e) {
    console.warn("[falcon-id-ocr] recognize failed", e);
    return "";
  }
}

export async function terminateOcr(): Promise<void> {
  if (!workerPromise) return;
  try {
    const w = await workerPromise;
    await w.terminate();
  } catch { /* */ }
  workerPromise = null;
}
