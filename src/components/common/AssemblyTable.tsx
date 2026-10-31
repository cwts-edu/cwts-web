import React from "react";
import type { AssemblyColumn, AssemblyRow } from "../../libs/content/schemas";

export interface AssemblyTableProps {
  columns: AssemblyColumn[];
  rows: AssemblyRow[];
  className?: string;
  isDark?: boolean;
}

interface GroupedColumn {
  name: string;
  subColumns: AssemblyColumn[];
}

export const AssemblyTable: React.FC<AssemblyTableProps> = ({
  columns = [],
  rows = [],
  className = "",
  isDark = false,
}) => {
  // Group columns by display name to merge sub-columns (e.g. video icon + copyright notes under "視頻/錄音")
  const groupedColumns: GroupedColumn[] = React.useMemo(() => {
    const groups: GroupedColumn[] = [];
    const groupMap = new Map<string, GroupedColumn>();

    for (const col of columns) {
      const trimmedName = col.name?.trim() || "";
      if (!trimmedName) continue;

      let group = groupMap.get(trimmedName);
      if (!group) {
        group = { name: trimmedName, subColumns: [] };
        groupMap.set(trimmedName, group);
        groups.push(group);
      }
      group.subColumns.push(col);
    }
    return groups;
  }, [columns]);

  if (groupedColumns.length === 0 && rows.length === 0) {
    return (
      <div className="p-6 text-center text-xs text-slate-400 italic bg-slate-900/40 rounded-xl border border-slate-800">
        No table data available.
      </div>
    );
  }

  return (
    <div className={`overflow-x-auto my-4 ${className}`}>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className={isDark ? "border-b border-slate-700 bg-slate-900/80" : "border-b border-gray-300 bg-gray-50/50"}>
            {groupedColumns.map((group, idx) => (
              <th
                key={idx}
                className={`py-2 px-3 text-sm font-bold tracking-wider ${
                  isDark ? "text-slate-200" : "text-darkblue"
                }`}
              >
                {group.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={isDark ? "divide-y divide-slate-800" : "divide-y divide-gray-200"}>
          {rows.map((row, rowIdx) => (
            <tr
              key={rowIdx}
              className={
                isDark
                  ? "hover:bg-slate-800/40 transition-colors"
                  : "hover:bg-gray-50/80 transition-colors"
              }
            >
              {groupedColumns.map((group, colIdx) => (
                <td
                  key={colIdx}
                  className={`py-2.5 px-3 text-sm align-middle ${
                    isDark ? "text-slate-300" : "text-gray-800"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {group.subColumns.map((subCol) => {
                      const cellValue = subCol.id in row ? row[subCol.id] : (row[subCol.name] ?? "");
                      const trimmed = typeof cellValue === "string" ? cellValue.trim() : String(cellValue || "");
                      if (!trimmed) return null;

                      const isUrl = trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("/");

                      if (subCol.type === "video" && isUrl) {
                        return (
                          <a
                            key={subCol.id}
                            href={trimmed}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center hover:opacity-80 transition transform hover:scale-110"
                            title="觀看視頻 / Watch Video"
                          >
                            <img
                              className={`inline h-5 w-5 align-middle ${
                                isDark ? "brightness-0 invert opacity-90 hover:opacity-100" : ""
                              }`}
                              src="/images/icons/video.svg"
                              alt="video"
                            />
                          </a>
                        );
                      }

                      if (subCol.type === "audio" && isUrl) {
                        return (
                          <a
                            key={subCol.id}
                            href={trimmed}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center hover:opacity-80 transition transform hover:scale-110"
                            title="收聽錄音 / Listen Audio"
                          >
                            <img
                              className={`inline h-5 w-5 align-middle ${
                                isDark ? "brightness-0 invert opacity-90 hover:opacity-100" : ""
                              }`}
                              src="/images/icons/speaker.svg"
                              alt="audio"
                            />
                          </a>
                        );
                      }

                      if (isUrl) {
                        return (
                          <a
                            key={subCol.id}
                            href={trimmed}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-purple-600 dark:text-purple-400 hover:underline break-all"
                          >
                            {trimmed}
                          </a>
                        );
                      }

                      return <span key={subCol.id}>{trimmed}</span>;
                    })}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AssemblyTable;
