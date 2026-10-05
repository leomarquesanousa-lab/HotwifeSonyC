export function validTimeZone(value: unknown): string {
  if (typeof value !== "string") return "UTC";
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return value;
  } catch {
    return "UTC";
  }
}
export function wallTime(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const part = (name: string) => parts.find((p) => p.type === name)!.value;
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}
export function scheduledUtc(
  local: string,
  timeZone: string,
  now = Date.now(),
) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local))
    throw new Error("SCHEDULE_INVALID");
  const naive = Date.parse(local + ":00Z");
  if (
    !Number.isFinite(naive) ||
    new Date(naive).toISOString().slice(0, 16) !== local
  )
    throw new Error("SCHEDULE_INVALID");
  const candidates = new Set<number>();
  // Observe offsets on both sides of DST changes; never silently shift a nonexistent time.
  for (let hours = -36; hours <= 36; hours += 6) {
    const sample = naive + hours * 3600000;
    const offset =
      Date.parse(wallTime(new Date(sample), timeZone) + ":00Z") - sample;
    const candidate = naive - offset;
    if (wallTime(new Date(candidate), timeZone) === local)
      candidates.add(candidate);
  }
  if (candidates.size !== 1)
    throw new Error(
      candidates.size ? "SCHEDULE_AMBIGUOUS" : "SCHEDULE_INVALID",
    );
  const instant = [...candidates][0];
  if (instant <= now) throw new Error("SCHEDULE_IN_PAST");
  return new Date(instant).toISOString();
}
