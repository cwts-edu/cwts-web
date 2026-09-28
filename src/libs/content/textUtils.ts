/**
 * Converts natural multi-line plain text to formatted HTML for News excerpts:
 * - Single newline within a block becomes <br/> (single line break)
 * - Double newline (or multiple) separates paragraphs (<p>...</p>)
 */
export function textLinesToHtml(text: string): string {
  if (!text || !text.trim()) return "";
  const paragraphs = text.trim().split(/\r?\n\s*\r?\n/);
  return paragraphs
    .map((p) => {
      const lines = p
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      return `<p>${lines.join("<br/>")}</p>`;
    })
    .join("\n");
}

/**
 * Strips trailing markdown line-break backslashes (\) to convert markdown to natural plain text
 */
export function markdownToTextLines(md: string): string {
  if (!md) return "";
  return md
    .split(/\r?\n/)
    .map((line) => line.replace(/\\\s*$/, ""))
    .join("\n")
    .trim();
}
