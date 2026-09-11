/**
 * Dynamic Email Obfuscation Utility
 *
 * Automatically converts standard <a href="mailto:..."> links into bot-safe HTML
 * that cannot be read by web crawlers/scrapers, while client-side JavaScript
 * restores full interactivity on page load.
 */

/**
 * Transforms all standard mailto: links in HTML into bot-safe obfuscated spans
 */
export function obfuscateMailtoLinks(html: string): string {
  if (!html || !html.includes("mailto:")) return html;

  return html.replace(
    /<a\s+([^>]*?)href=["']mailto:([^"']+)["']([^>]*?)>(.*?)<\/a>/gi,
    (_match, preAttrs, email, postAttrs, linkText) => {
      const trimmedEmail = email.trim();
      const trimmedText = linkText.trim();

      const encodedHref = Buffer.from(`mailto:${trimmedEmail}`).toString("base64");
      const encodedText = Buffer.from(trimmedText).toString("base64");

      // Extract any class attributes from preAttrs or postAttrs
      const classMatch = `${preAttrs} ${postAttrs}`.match(/class=["']([^"']+)["']/i);
      const existingClass = classMatch ? classMatch[1] : "";
      const fullClass = `cwts-email ${existingClass}`.trim();

      // Masked placeholder shown before JS runs
      const maskedPreview = trimmedEmail.includes("@")
        ? `${trimmedEmail.split("@")[0].slice(0, 3)}...@${trimmedEmail.split("@")[1]}`
        : "[email protected]";

      return `<span class="${fullClass}" data-eo="${encodedHref}" data-et="${encodedText}" title="Click to reveal email">${maskedPreview}</span>`;
    }
  );
}

/**
 * Client-side vanilla JS script that decodes obfuscated emails into real <a> links
 */
export const EMAIL_DECODER_SCRIPT = `
(function() {
  function revealEmails() {
    document.querySelectorAll('.cwts-email[data-eo]').forEach(function(el) {
      try {
        var href = atob(el.getAttribute('data-eo'));
        var textAttr = el.getAttribute('data-et');
        var text = textAttr ? atob(textAttr) : href.replace(/^mailto:/, '');
        var a = document.createElement('a');
        a.href = href;
        a.textContent = text;
        var cleanClass = (el.className || '').replace(/\\bcwts-email\\b/, '').trim();
        if (cleanClass) a.className = cleanClass;
        el.replaceWith(a);
      } catch (e) {
        console.warn('Email decoding error', e);
      }
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', revealEmails);
  } else {
    revealEmails();
  }
})();
`;
