// Zaxin Falcon — PDF417 decoder wrapper
// -------------------------------------
// Uses @zxing/library's MultiFormatReader restricted to PDF417 so we don't
// waste CPU trying every 1D symbology. Two entry points:
//   * decodeFromImageData()  — one-shot from a captured frame (canvas)
//   * decodeFromVideo()      — continuous scan from a <video> element
//
// The @zxing/browser BrowserPDF417Reader was previously exported, but recent
// versions only expose BrowserMultiFormatReader. We configure hints locally.

import {
  BarcodeFormat, DecodeHintType, MultiFormatReader, RGBLuminanceSource,
  BinaryBitmap, HybridBinarizer, NotFoundException,
} from "@zxing/library";
import { BrowserMultiFormatReader } from "@zxing/browser";

function makeReader(): MultiFormatReader {
  const reader = new MultiFormatReader();
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.PDF_417]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  reader.setHints(hints);
  return reader;
}

/** Decode a single frame worth of pixel data — returns raw barcode text or null. */
export function decodeFromImageData(img: ImageData): string | null {
  const reader = makeReader();
  // RGBLuminanceSource wants ARGB packed ints; build from the RGBA buffer.
  const { width, height, data } = img;
  const argb = new Int32Array(width * height);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    argb[j] = (0xff << 24) | (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
  }
  try {
    const luminance = new RGBLuminanceSource(argb, width, height);
    const bitmap = new BinaryBitmap(new HybridBinarizer(luminance));
    const result = reader.decode(bitmap);
    return result.getText();
  } catch (e) {
    if (e instanceof NotFoundException) return null;
    console.warn("[falcon-pdf417] decode error", e);
    return null;
  }
}

/** Continuous scan a <video> element. Returns a stop() function. */
export function decodeFromVideo(
  video: HTMLVideoElement,
  onResult: (text: string) => void,
  onError?: (err: unknown) => void,
): () => void {
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.PDF_417]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  const reader = new BrowserMultiFormatReader(hints);

  let stopped = false;
  let controls: { stop: () => void } | null = null;

  reader
    .decodeFromVideoElement(video, (result, err) => {
      if (stopped) return;
      if (result) onResult(result.getText());
      if (err && err.name && err.name !== "NotFoundException" && onError) onError(err);
    })
    .then((c) => { controls = c; if (stopped) c.stop(); })
    .catch((err) => { if (onError) onError(err); });

  return () => {
    stopped = true;
    try { controls?.stop(); } catch { /* */ }
  };
}
