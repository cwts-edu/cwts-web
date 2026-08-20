/**
 * Safely formats a date value into YYYY-MM-DD string without throwing RangeError.
 * Supports JS Date, ISO string, timestamp number, and Firestore Timestamp objects.
 */
export function formatSafeDate(raw: any, fallback = ""): string {
  if (!raw) return fallback;

  // 1. Firestore Timestamp object with .toDate() method
  if (typeof raw === "object" && typeof raw.toDate === "function") {
    try {
      const d = raw.toDate();
      return isNaN(d.getTime()) ? fallback : d.toISOString().split("T")[0];
    } catch {}
  }

  // 2. Firestore Timestamp raw object { seconds, nanoseconds } or { _seconds, _nanoseconds }
  if (
    typeof raw === "object" &&
    (typeof raw.seconds === "number" || typeof raw._seconds === "number")
  ) {
    const sec = typeof raw.seconds === "number" ? raw.seconds : raw._seconds;
    const d = new Date(sec * 1000);
    return isNaN(d.getTime()) ? fallback : d.toISOString().split("T")[0];
  }

  // 3. JS Date instance
  if (raw instanceof Date) {
    return isNaN(raw.getTime()) ? fallback : raw.toISOString().split("T")[0];
  }

  // 4. String format
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return fallback;

    // If it's already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }

    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split("T")[0];
    }

    // Attempt simple split if ISO format with time
    if (trimmed.includes("T")) {
      return trimmed.split("T")[0];
    }
    return trimmed;
  }

  // 5. Unix timestamp number in milliseconds or seconds
  if (typeof raw === "number") {
    // If seconds (e.g. 10 digits), convert to ms
    const ms = raw < 1e11 ? raw * 1000 : raw;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split("T")[0];
    }
  }

  return fallback;
}
