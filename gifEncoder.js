import { GIFEncoder, quantize, applyPalette } from "./node_modules/gifenc/dist/gifenc.esm.js";

const MAX_COLORS = 256;
const PALETTE_FORMAT = "rgba4444";
const MIN_FRAME_DELAY_MS = 20;

function ensureFrameDelay(delay, fallback) {
  const numeric = Number.isFinite(delay) ? delay : fallback;
  const clamped = Math.max(MIN_FRAME_DELAY_MS, Math.round(numeric));
  return clamped;
}

function hasTransparency(frameData) {
  for (let i = 3; i < frameData.length; i += 4) {
    if (frameData[i] < 255) {
      return true;
    }
  }
  return false;
}

function buildPalette(frameData) {
  const usesAlpha = hasTransparency(frameData);
  return quantize(frameData, MAX_COLORS, {
    format: PALETTE_FORMAT,
    clearAlpha: usesAlpha,
    clearAlphaThreshold: 0,
    clearAlphaColor: 0x00,
    oneBitAlpha: usesAlpha ? 128 : false,
  });
}

function findTransparentIndex(palette) {
  if (!Array.isArray(palette)) return -1;
  for (let i = 0; i < palette.length; i += 1) {
    const entry = palette[i];
    if (!entry || entry.length < 4) continue;
    if (entry[3] <= 0) {
      return i;
    }
  }
  return -1;
}

function validateFrame(frame, width, height) {
  if (!frame || !(frame.data instanceof Uint8Array || frame.data instanceof Uint8ClampedArray)) {
    throw new Error("GIF frame data must be a Uint8Array or Uint8ClampedArray");
  }
  const expectedLength = width * height * 4;
  if (frame.data.length !== expectedLength) {
    throw new Error(`GIF frame data has incorrect size. Expected ${expectedLength} bytes but received ${frame.data.length}.`);
  }
}

export function encodeGif({ width, height, frames, loop = true }) {
  if (!width || !height) {
    throw new Error("GIF encoder requires explicit width and height");
  }
  if (!Array.isArray(frames) || frames.length === 0) {
    throw new Error("GIF encoder needs at least one frame");
  }

  const encoder = GIFEncoder();
  const defaultDelay = ensureFrameDelay(frames[0].delayMs ?? 100, 100);

  frames.forEach((frame, index) => {
    validateFrame(frame, width, height);

    const palette = buildPalette(frame.data);
    const indexedPixels = applyPalette(frame.data, palette, PALETTE_FORMAT);
    const transparentIndex = findTransparentIndex(palette);
    const frameDelay = ensureFrameDelay(frame.delayMs, defaultDelay);

    const options = {
      palette,
      delay: frameDelay,
      dispose: 2,
    };

    if (index === 0) {
      options.repeat = loop ? 0 : -1;
    }

    if (transparentIndex !== -1) {
      options.transparent = true;
      options.transparentIndex = transparentIndex;
    }

    encoder.writeFrame(indexedPixels, width, height, options);
  });

  encoder.finish();
  return encoder.bytes();
}
