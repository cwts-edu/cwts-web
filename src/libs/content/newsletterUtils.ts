/**
 * Newsletter Utility Functions
 * Supports parsing filenames, generating standard paths, titles, and grouping by year and issue/epoch.
 */

export const ISSUE_LETTERS = ["A", "B", "C", "D", "E", "F"] as const;
export type IssueLetter = (typeof ISSUE_LETTERS)[number];

export function letterToIssue(letter: string): number {
  const upper = letter.toUpperCase();
  const idx = ISSUE_LETTERS.indexOf(upper as IssueLetter);
  return idx >= 0 ? idx + 1 : 1;
}

export function issueToLetter(issue: number): IssueLetter {
  const idx = Math.max(1, Math.min(issue, ISSUE_LETTERS.length)) - 1;
  return ISSUE_LETTERS[idx] || "A";
}

export interface ParsedNewsletterInfo {
  id: string;
  year: number;
  issue: number;
  issueLetter: IssueLetter;
  title: string;
  pdfPath: string;
  coverImage: string;
}

/**
 * Parses a newsletter filename or document ID (e.g. "newsletter-2026B.pdf", "newsletter-2026B", "2026-B")
 */
export function parseNewsletterFilename(filenameOrId: string): ParsedNewsletterInfo | null {
  const clean = filenameOrId.replace(/\.pdf(\.cover\.png)?$/i, "").trim();

  // Pattern 1: newsletter-2026B
  const matchA = clean.match(/(?:newsletter[-_]?)?(\d{4})([A-Fa-f])/i);
  if (matchA) {
    const year = parseInt(matchA[1], 10);
    const letter = matchA[2].toUpperCase() as IssueLetter;
    const issue = letterToIssue(letter);
    return {
      id: `newsletter-${year}${letter}`,
      year,
      issue,
      issueLetter: letter,
      title: formatNewsletterTitle(year, issue),
      pdfPath: formatNewsletterPdfPath(year, issue),
      coverImage: formatNewsletterCoverPath(year, issue),
    };
  }

  // Pattern 2: newsletter-2026-2 or 2026-2
  const matchB = clean.match(/(?:newsletter[-_]?)?(\d{4})[-_](\d+)/i);
  if (matchB) {
    const year = parseInt(matchB[1], 10);
    const issue = parseInt(matchB[2], 10);
    const letter = issueToLetter(issue);
    return {
      id: `newsletter-${year}${letter}`,
      year,
      issue,
      issueLetter: letter,
      title: formatNewsletterTitle(year, issue),
      pdfPath: formatNewsletterPdfPath(year, issue),
      coverImage: formatNewsletterCoverPath(year, issue),
    };
  }

  return null;
}

export function formatNewsletterTitle(year: number, issue: number): string {
  return `${year}第${issue}期`;
}

export function formatNewsletterPdfPath(year: number, issue: number): string {
  const letter = issueToLetter(issue);
  return `/docs/newsletter/newsletter-${year}${letter}.pdf`;
}

export function formatNewsletterCoverPath(year: number, issue: number): string {
  const letter = issueToLetter(issue);
  return `/docs/newsletter/newsletter-${year}${letter}.pdf.cover.png`;
}

export interface YearGroup<T> {
  year: number;
  issues: T[];
}

/**
 * Universal comparator: sort years descending (newest year on top), then issues descending or ascending
 */
export function sortNewsletters<T>(
  items: T[],
  issueOrder: "asc" | "desc" = "asc"
): T[] {
  return [...items].sort((a: any, b: any) => {
    const aData = a?.draftData || a?.data || a;
    const bData = b?.draftData || b?.data || b;

    const yearA = typeof aData?.year === "number" ? aData.year : 0;
    const yearB = typeof bData?.year === "number" ? bData.year : 0;

    if (yearA !== yearB) {
      return yearB - yearA; // Newest year first
    }

    const issueA = typeof aData?.issue === "number" ? aData.issue : 0;
    const issueB = typeof bData?.issue === "number" ? bData.issue : 0;

    return issueOrder === "asc" ? issueA - issueB : issueB - issueA;
  });
}

/**
 * Groups newsletter items by Year, with years in descending order and issues in ascending order (1, 2, 3, 4)
 */
export function groupNewslettersByYear<T>(items: T[]): YearGroup<T>[] {
  const sorted = sortNewsletters(items, "asc");
  const groupsMap = new Map<number, T[]>();

  for (const item of sorted) {
    const data = (item as any)?.draftData || (item as any)?.data || item;
    const year = typeof data?.year === "number" ? data.year : 0;
    if (!groupsMap.has(year)) {
      groupsMap.set(year, []);
    }
    groupsMap.get(year)!.push(item);
  }

  const result: YearGroup<T>[] = [];
  const years = Array.from(groupsMap.keys()).sort((a, b) => b - a);

  for (const year of years) {
    result.push({
      year,
      issues: groupsMap.get(year)!,
    });
  }

  return result;
}
