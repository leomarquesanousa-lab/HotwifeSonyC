export function teaserStartIssue(
  start: number,
  duration: number | null | undefined,
) {
  if (duration == null || !Number.isFinite(duration) || duration <= 0)
    return "olderVideoNeedsMetadata";
  return !Number.isFinite(start) || start < 0 || start >= duration
    ? "invalidTeaserStart"
    : "";
}
