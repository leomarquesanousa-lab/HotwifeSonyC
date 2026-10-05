import { videoMetadataSchema, type VideoMetadata } from "./video-metadata";

/** Reads the user's actual File without uploading or buffering it in JavaScript. */
export function readVideoMetadata(file: File): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);
    let settled = false;
    const cleanup = () => {
      window.clearTimeout(timeout);
      video.onloadedmetadata = null;
      video.onloadeddata = null;
      video.onerror = null;
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(objectUrl);
    };
    const fail = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("VIDEO_METADATA_READ_FAILED"));
    };
    const timeout = window.setTimeout(fail, 30_000);
    const capture = () => {
      if (settled) return;
      const parsed = videoMetadataSchema.safeParse({ durationSeconds: video.duration, width: video.videoWidth, height: video.videoHeight });
      if (!parsed.success) return; // Some decoders expose dimensions only on loadeddata.
      settled = true;
      cleanup();
      resolve(parsed.data);
    };
    video.preload = "metadata";
    video.muted = true;
    video.onloadedmetadata = capture;
    video.onloadeddata = capture;
    video.onerror = fail;
    try { video.src = objectUrl; video.load(); } catch { fail(); }
  });
}
