import type { AssemblyColumn, AssemblyRow } from "./schemas";
import { csvParse } from "d3-dsv";

/**
 * Parses a column header string that may contain a type suffix (e.g. "視頻/錄音.video")
 */
export function parseColumnHeader(rawHeader: string, index: number): AssemblyColumn {
  const lastDotIndex = rawHeader.lastIndexOf(".");
  if (lastDotIndex !== -1) {
    const baseName = rawHeader.substring(0, lastDotIndex).trim();
    const typeStr = rawHeader.substring(lastDotIndex + 1).toLowerCase().trim();
    if (typeStr === "video" || typeStr === "audio") {
      return {
        id: `col_${index}_${typeStr}`,
        name: baseName || rawHeader,
        type: typeStr as "video" | "audio",
      };
    }
  }
  return {
    id: `col_${index}`,
    name: rawHeader.trim(),
    type: "text",
  };
}

/**
 * Parses raw CSV content into structured AssemblyColumn[] and AssemblyRow[]
 */
export function parseAssemblyCsv(csvContent: string): {
  columns: AssemblyColumn[];
  rows: AssemblyRow[];
} {
  const parsed = csvParse(csvContent);
  if (!parsed.columns || parsed.columns.length === 0) {
    return { columns: [], rows: [] };
  }

  const columns: AssemblyColumn[] = parsed.columns.map((colName, idx) =>
    parseColumnHeader(colName, idx)
  );

  const rows: AssemblyRow[] = parsed.map((row) => {
    const cleanRow: AssemblyRow = {};
    parsed.columns.forEach((rawColName, idx) => {
      const col = columns[idx];
      const val = row[rawColName];
      cleanRow[col.id] = val !== undefined && val !== null ? String(val).trim() : "";
    });
    return cleanRow;
  });

  return { columns, rows };
}

/**
 * Pre-renders semantic HTML table string for bodyHtml
 */
export function renderAssemblyTableHtml(
  columns: AssemblyColumn[],
  rows: AssemblyRow[]
): string {
  // Group columns by display name
  const groupMap = new Map<string, AssemblyColumn[]>();
  for (const col of columns) {
    const trimmed = col.name?.trim() || "";
    if (!trimmed) continue;
    let list = groupMap.get(trimmed);
    if (!list) {
      list = [];
      groupMap.set(trimmed, list);
    }
    list.push(col);
  }

  const groupNames = Array.from(groupMap.keys());
  if (groupNames.length === 0 && rows.length === 0) {
    return "";
  }

  const theadHtml = `<thead><tr>${groupNames
    .map((name) => `<th class="py-2 px-3 text-sm font-bold tracking-wider text-darkblue">${escapeHtml(name)}</th>`)
    .join("")}</tr></thead>`;

  const tbodyHtml = `<tbody>${rows
    .map((row) => {
      const cellsHtml = groupNames
        .map((groupName) => {
          const subCols = groupMap.get(groupName) || [];
          const itemsHtml = subCols
            .map((subCol) => {
              const cellVal = subCol.id in row ? row[subCol.id] : (row[subCol.name] ?? "");
              const trimmed = typeof cellVal === "string" ? cellVal.trim() : String(cellVal || "");
              if (!trimmed) return "";

              const isUrl = trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("/");

              if (subCol.type === "video" && isUrl) {
                return `<a href="${escapeAttr(trimmed)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center hover:opacity-80 transition mr-2" title="觀看視頻 / Watch Video"><img class="inline h-5 w-5 align-middle" src="/images/icons/video.svg" alt="video" /></a>`;
              }
              if (subCol.type === "audio" && isUrl) {
                return `<a href="${escapeAttr(trimmed)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center hover:opacity-80 transition mr-2" title="收聽錄音 / Listen Audio"><img class="inline h-5 w-5 align-middle" src="/images/icons/speaker.svg" alt="audio" /></a>`;
              }
              if (isUrl) {
                return `<a href="${escapeAttr(trimmed)}" target="_blank" rel="noopener noreferrer" class="text-purple-600 dark:text-purple-400 hover:underline break-all">${escapeHtml(trimmed)}</a>`;
              }
              return `<span>${escapeHtml(trimmed)}</span>`;
            })
            .filter(Boolean)
            .join(" ");

          return `<td class="py-2.5 px-3 text-sm text-gray-800 align-middle"><div class="flex flex-wrap items-center gap-2">${itemsHtml}</div></td>`;
        })
        .join("");
      return `<tr class="hover:bg-gray-50/80 transition-colors">${cellsHtml}</tr>`;
    })
    .join("")}</tbody>`;

  return `<div class="overflow-x-auto my-4"><table class="w-full text-left border-collapse">${theadHtml}${tbodyHtml}</table></div>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(str: string): string {
  return str.replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

/**
 * Formats a default title from semester identifier
 * e.g. "upcoming" -> "2026 秋季早會崇拜講員安排："
 * e.g. "2026-H2" -> "【過往週會(視頻/錄音) – 2026 秋季】"
 * e.g. "2026-H1" -> "【過往週會(視頻/錄音) – 2026 春季】"
 */
export function getDefaultSemesterTitle(semester: string, isUpcoming = false): string {
  if (isUpcoming || semester.toLowerCase() === "upcoming") {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const season = currentMonth >= 7 ? "秋季" : "春季";
    return `${currentYear} ${season}早會崇拜講員安排：`;
  }

  const match = semester.match(/^(\d{4})-H([12])$/i);
  if (match) {
    const year = match[1];
    const half = match[2];
    const season = half === "1" ? "春季" : "秋季";
    return `【過往週會(視頻/錄音) – ${year} ${season}】`;
  }

  return `【過往週會(視頻/錄音) – ${semester}】`;
}

const HISTORICAL_SEMESTER_ORDERS: Record<string, number> = {
  "2021-h1": 1,
  "2021-h2": 2,
  "2022-h1": 3,
  "2022-h2": 4,
  "2023-h1": 5,
  "2023-h2": 6,
  "2024-h1": 7,
  "2024-h2": 8,
  "2025-h1": 9,
  "2025-h2": 10,
  "2026-h1": 11,
  "2026-h2": 12,
};

/**
 * Computes default order from bottom to top (1, 2, 3... N, upcoming: 9999)
 */
export function calculateSemesterOrder(semester: string, isUpcoming = false): number {
  if (isUpcoming || semester.toLowerCase() === "upcoming") return 9999;
  const lower = semester.trim().toLowerCase();
  if (lower in HISTORICAL_SEMESTER_ORDERS) {
    return HISTORICAL_SEMESTER_ORDERS[lower];
  }
  const match = semester.match(/^(\d{4})[-_\s]?H([12])$/i);
  if (match) {
    const year = parseInt(match[1], 10);
    const half = parseInt(match[2], 10);
    return (year - 2020) * 2 + (half === 2 ? 2 : 1);
  }
  return 100;
}

/**
 * Universal comparator: upcoming on top, then descending by order (larger order = newer = top)
 */
export function sortAssemblyTables<T>(items: T[]): T[] {
  return [...items].sort((a: any, b: any) => {
    const aData = a?.draftData || a?.data || a;
    const bData = b?.draftData || b?.data || b;

    // 1. isUpcoming always on top
    const aUpcoming = Boolean(
      aData?.isUpcoming ||
        aData?.semester?.toLowerCase() === "upcoming" ||
        a?.id?.toLowerCase() === "upcoming"
    );
    const bUpcoming = Boolean(
      bData?.isUpcoming ||
        bData?.semester?.toLowerCase() === "upcoming" ||
        b?.id?.toLowerCase() === "upcoming"
    );
    if (aUpcoming && !bUpcoming) return -1;
    if (!aUpcoming && bUpcoming) return 1;

    // 2. Sort descending by order (larger order appears on top)
    const aOrder =
      typeof aData?.order === "number" && aData.order > 0
        ? aData.order
        : calculateSemesterOrder(aData?.semester || a?.id || "");
    const bOrder =
      typeof bData?.order === "number" && bData.order > 0
        ? bData.order
        : calculateSemesterOrder(bData?.semester || b?.id || "");

    if (aOrder !== bOrder) {
      return bOrder - aOrder;
    }

    return (bData?.semester || b?.id || "").localeCompare(aData?.semester || a?.id || "");
  });
}
