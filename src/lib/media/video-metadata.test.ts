import test from "node:test";
import assert from "node:assert/strict";
import { missingVideoMetadataFields, verifiedVideoFileSize, videoMetadataSchema } from "./video-metadata";
import { readVideoMetadata } from "./read-video-metadata";

test("measured fractional duration respects existing Int storage and strict teaser limit", () => {
  assert.deepEqual(videoMetadataSchema.parse({ durationSeconds: 30.01, width: 3840, height: 2160 }), { durationSeconds: 31, width: 3840, height: 2160 });
  assert.equal(videoMetadataSchema.parse({ durationSeconds: 0.25, width: 1920, height: 1080 }).durationSeconds, 1);
  for (const value of [null, undefined, 0, -1, Infinity, NaN, "60"]) {
    assert.equal(videoMetadataSchema.safeParse({ durationSeconds: value, width: 1920, height: 1080 }).success, false);
  }
  for (const value of [null, 0, -1, 1920.5, Infinity, 2_147_483_648]) {
    assert.equal(videoMetadataSchema.safeParse({ durationSeconds: 60, width: value, height: 1080 }).success, false);
  }
});

test("legacy missing fields are identified without inventing measurements", () => {
  assert.deepEqual(missingVideoMetadataFields({ durationSeconds: null, width: null, height: null, fileSize: "1384190108" }), ["durationSeconds", "width", "height"]);
  assert.deepEqual(missingVideoMetadataFields({ durationSeconds: 60, width: 1920, height: 1080, fileSize: BigInt(100) }), []);
  assert.deepEqual(missingVideoMetadataFields({ durationSeconds: 60, width: 1920, height: 1080, fileSize: 0 }), ["fileSize"]);
});

test("R2 size must match the original File before completion can persist readiness", () => {
  assert.equal(verifiedVideoFileSize(12345, BigInt(12345)), BigInt(12345));
  for (const value of [undefined, 0, -1, 12344, 12345.5, NaN, Infinity]) {
    assert.throws(() => verifiedVideoFileSize(value, BigInt(12345)), /MEDIA_SIZE_MISMATCH/);
  }
});

test("browser extraction reads actual element metadata and releases its object URL", async () => {
  const savedDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const savedWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  let revoked = 0;
  let loads = 0;
  let mode: "success" | "error" | "timeout" = "success";
  let onTimeout: () => void = () => {};
  let cleared = 0;
  const video = {
    duration: 42.3, videoWidth: 1280, videoHeight: 720,
    preload: "", muted: false, src: "",
    onloadedmetadata: null as (() => void) | null,
    onloadeddata: null as (() => void) | null,
    onerror: null as (() => void) | null,
    removeAttribute: () => { video.src = ""; },
    load: () => {
      loads++;
      if (video.src) queueMicrotask(() => mode === "success" ? video.onloadedmetadata?.() : mode === "error" ? video.onerror?.() : onTimeout());
    },
  };
  try {
    Object.defineProperty(globalThis, "document", { configurable: true, value: { createElement: () => video } });
    Object.defineProperty(globalThis, "window", { configurable: true, value: { setTimeout: (callback: () => void) => { onTimeout = callback; return 1; }, clearTimeout: () => { cleared++; } } });
    URL.createObjectURL = () => "blob:fixture";
    URL.revokeObjectURL = () => { revoked++; };
    const file = new File(["fixture"], "video.mp4", { type: "video/mp4" });
    assert.deepEqual(await readVideoMetadata(file), { durationSeconds: 43, width: 1280, height: 720 });
    assert.equal(video.src, "");
    mode = "error";
    await assert.rejects(readVideoMetadata(file), /VIDEO_METADATA_READ_FAILED/);
    mode = "timeout";
    await assert.rejects(readVideoMetadata(file), /VIDEO_METADATA_READ_FAILED/);
    assert.equal(revoked, 3);
    assert.equal(cleared, 3);
    assert.equal(loads, 6);
  } finally {
    if (savedDocument) Object.defineProperty(globalThis, "document", savedDocument); else Reflect.deleteProperty(globalThis, "document");
    if (savedWindow) Object.defineProperty(globalThis, "window", savedWindow); else Reflect.deleteProperty(globalThis, "window");
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  }
});
