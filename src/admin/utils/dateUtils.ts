/**
 * Safely formats a date value into YYYY-MM-DD string without throwing RangeError.
 */
export function formatSafeDate(raw: any, fallback = ""): string {
  if (!raw) return fallback;

  if (raw instanceof Date) {
    return isNaN(raw.getTime()) ? fallback : raw.toISOString().split("T")[0];
  }

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

  if (typeof raw === "number") {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split("T")[0];
    }
  }

  return fallback;
}
