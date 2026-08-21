import { marked } from "marked";
import type { DegreeProgramItem } from "./schemas";

/**
 * Parses raw degree widget markdown/MDX body into structured program accordions and clean body/HTML.
 */
export function parseDegreesWidgetBody(rawBody: string): {
  programs: DegreeProgramItem[];
  cleanBody: string;
  cleanBodyHtml: string;
} {
  if (!rawBody) {
    return { programs: [], cleanBody: "", cleanBodyHtml: "" };
  }

  // 1. If content contains <AccordionItem ...>
  if (rawBody.includes("<AccordionItem")) {
    const accordionRegex = /<AccordionItem([^>]*)>([\s\S]*?)<\/AccordionItem>/gi;
    const programs: DegreeProgramItem[] = [];
    let itemMatch: RegExpExecArray | null;

    while ((itemMatch = accordionRegex.exec(rawBody)) !== null) {
      const attributes = itemMatch[1];
      const innerContent = itemMatch[2];
      const isOpen = /\bopen\b/i.test(attributes);

      let title = "";
      let programBody = innerContent;

      const summaryMatch = innerContent.match(/<h[1-6][^>]*slot=["']summary["'][^>]*>([\s\S]*?)<\/h[1-6]>/i);
      if (summaryMatch) {
        title = summaryMatch[1].trim();
        programBody = innerContent.replace(summaryMatch[0], "").trim();
      }

      if (!title) {
        const hMatch = innerContent.match(/^#+\s*(.*)$/m);
        if (hMatch) {
          title = hMatch[1].trim();
          programBody = innerContent.replace(hMatch[0], "").trim();
        } else {
          title = "Program Details";
        }
      }

      const cleanedProgramBody = programBody.replace(/^import\s+.*?;?\s*$/gm, "").trim();
      const bodyHtml = marked.parse(cleanedProgramBody) as string;

      programs.push({
        title,
        body: cleanedProgramBody,
        bodyHtml,
        open: isOpen || undefined,
      });
    }

    const cleanBody = rawBody
      .replace(/<AccordionItem[\s\S]*?<\/AccordionItem>/gi, "")
      .replace(/^import\s+.*?;?\s*$/gm, "")
      .trim();
    const cleanBodyHtml = cleanBody ? (marked.parse(cleanBody) as string) : "";

    return { programs, cleanBody, cleanBodyHtml };
  }

  // 2. Standard markdown file (e.g. doctor.md, certificate.md)
  const cleanBody = rawBody.replace(/^import\s+.*?;?\s*$/gm, "").trim();
  const cleanBodyHtml = cleanBody ? (marked.parse(cleanBody) as string) : "";

  return { programs: [], cleanBody, cleanBodyHtml };
}
