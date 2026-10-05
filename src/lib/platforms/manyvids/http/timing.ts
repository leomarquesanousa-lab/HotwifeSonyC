// Temporary diagnostics: accept only fixed stage names and numeric transfer metadata.
type Stage = "EXECUTOR" | "SESSION_REFRESH" | "SESSION_INIT" | "TAGS" | "SOURCE_FETCH" | "UPLOADER_CREATE" | "UPLOAD_SIGN" | "VIDEO_TRANSFER" | "UPLOADER_COMPLETE" | "UNIFIED_MEDIA_REGISTER" | "TEASER_CREATE" | "TEASER_POLL" | "TEASER_READY" | "THUMBNAIL" | "SAVE" | "TRANSCODING_WAIT" | "FINAL_CONFIRMATION" | "FINALIZE" | "PERFORMERS";
type Details = { partNumber?: number; fileSizeBytes?: number; bytes?: number };

export class ManyVidsTiming {
  private readonly startedAt: number;
  private readonly runId = crypto.randomUUID();
  constructor(private readonly now = () => performance.now()) { this.startedAt = now(); }

  start(stage: Stage, details: Details = {}) {
    const startedAt = this.now();
    const emit = (event: "start" | "end", success?: boolean) => {
      const now = this.now();
      const durationMs = now - startedAt;
      // Never let diagnostic output change the publication result.
      try {
        console.info("MANYVIDS_STAGE", {
          runId: this.runId, timestamp: new Date().toISOString(),
          stage: ["EXECUTOR", "SOURCE_FETCH", "VIDEO_TRANSFER", "TEASER_POLL"].includes(stage) ? `${stage}_${event.toUpperCase()}` : stage,
          event, elapsedMs: Math.round(now - this.startedAt),
          ...(event === "end" ? { durationMs: Math.round(durationMs), success } : {}),
          partNumber: details.partNumber, fileSizeBytes: details.fileSizeBytes, bytes: details.bytes,
          ...(stage === "VIDEO_TRANSFER" && event === "end" && success && details.bytes !== undefined ? {
            throughputMBps: durationMs > 0 ? Number((details.bytes / 1_000_000 / (durationMs / 1000)).toFixed(3)) : null,
          } : {}),
        });
      } catch { /* Timing must remain observational. */ }
    };
    emit("start");
    return (success: boolean) => emit("end", success);
  }

  async measure<T>(stage: Stage, operation: () => Promise<T>, details?: Details): Promise<T> {
    const end = this.start(stage, details);
    let success = false;
    try { const result = await operation(); success = true; return result; }
    finally { end(success); }
  }
}
