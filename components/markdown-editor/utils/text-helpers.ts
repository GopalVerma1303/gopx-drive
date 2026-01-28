/**
 * Text manipulation helper functions
 */

/**
 * Linkify bare URLs/emails/phone numbers in preview without touching the underlying editor value.
 * Examples:
 * - https://example.com  -> <https://example.com>
 * - www.example.com      -> [www.example.com](https://www.example.com)
 * - foo@bar.com          -> [foo@bar.com](mailto:foo@bar.com)
 * - +919876543210        -> [919876543210](tel:+919876543210)
 * - 9876543210           -> [9876543210](tel:+919876543210)
 *
 * Skips fenced code blocks (```), indented code blocks, inline code (`code`),
 * and existing markdown link syntaxes so we don't double-wrap.
 */
export const linkifyMarkdown = (markdown: string): string => {
  // Email regex: matches standard email format
  const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
  // Phone number regex: matches various formats including:
  // - International: +1234567890, +1 234 567 8900
  // - US formats: (123) 456-7890, 123-456-7890, 123.456.7890, 1234567890
  // - With optional country code: +1-123-456-7890
  const PHONE_RE = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b|\+\d{1,3}[-.\s]?\d{1,14}\b/gi;
  const URL_RE = /\b(?:https?:\/\/|www\.|mailto:|tel:)[^\s<>()]+/gi;

  const linkifyPlainText = (text: string): string => {
    const placeholders: string[] = [];
    const tokenFor = (idx: number) => `\u0000${idx}\u0000`;
    const mask = (re: RegExp, input: string) =>
      input.replace(re, (m) => {
        const idx = placeholders.push(m) - 1;
        return tokenFor(idx);
      });
    const unmask = (input: string) =>
      input.replace(/\u0000(\d+)\u0000/g, (_m, n) => placeholders[Number(n)] ?? _m);

    // Protect existing markdown link constructs so we don't double-linkify.
    let masked = text;
    masked = mask(/!\[[^\]]*\]\([^)]+\)/g, masked);      // images
    masked = mask(/\[[^\]]+\]\([^)]+\)/g, masked);       // inline links
    masked = mask(/\[[^\]]+\]\[[^\]]*\]/g, masked);      // reference links
    masked = mask(/<[^>\s]+>/g, masked);                 // autolinks / html-ish

    const stripTrailingPunctuation = (raw: string) => {
      let core = raw;
      let trailing = "";
      while (core.length > 0 && /[)\].,!?;:'"]/.test(core[core.length - 1])) {
        trailing = core[core.length - 1] + trailing;
        core = core.slice(0, -1);
      }
      return { core, trailing };
    };

    // Normalize phone number: remove formatting characters and add country code if needed
    const normalizePhoneNumber = (phone: string): string => {
      // Remove all non-digit characters except +
      let cleaned = phone.replace(/[^\d+]/g, '');

      // If it already starts with +, keep it as is (international format)
      if (cleaned.startsWith('+')) {
        return cleaned;
      }

      // Remove leading 0 (trunk prefix) if present
      if (cleaned.startsWith('0') && cleaned.length > 10) {
        cleaned = cleaned.substring(1);
      }

      // If it's 10 digits, assume Indian number and add +91
      if (cleaned.length === 10) {
        return `+91${cleaned}`;
      }

      // If it's 12 digits and starts with 91, add +
      if (cleaned.length === 12 && cleaned.startsWith('91')) {
        return `+${cleaned}`;
      }

      // For other cases, add +91 prefix (default to India)
      return cleaned.length > 0 ? `+91${cleaned}` : phone;
    };

    // Phone numbers first (before emails) to avoid conflicts
    masked = masked.replace(PHONE_RE, (raw) => {
      const { core, trailing } = stripTrailingPunctuation(raw);
      if (!core) return raw;
      const normalizedPhone = normalizePhoneNumber(core);
      // Use markdown link syntax to show original text but link to tel: URL
      return `[${core}](tel:${normalizedPhone})${trailing}`;
    });

    // Emails second so we don't partially match inside mailto:foo@bar.com
    masked = masked.replace(EMAIL_RE, (raw) => {
      const { core, trailing } = stripTrailingPunctuation(raw);
      if (!core) return raw;
      // Use markdown link syntax to show original text but link to mailto: URL
      return `[${core}](mailto:${core})${trailing}`;
    });

    masked = masked.replace(URL_RE, (raw) => {
      const { core, trailing } = stripTrailingPunctuation(raw);
      if (!core) return raw;

      if (core.toLowerCase().startsWith("www.")) {
        const href = `https://${core}`;
        return `[${core}](${href})${trailing}`;
      }

      // For scheme URLs, autolink form is compact and widely supported by markdown parsers.
      return `<${core}>${trailing}`;
    });

    return unmask(masked);
  };

  const lines = markdown.split("\n");
  let inFence = false;

  const out = lines.map((line) => {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      return line;
    }
    if (inFence) return line;
    if (/^(?:\t| {4})/.test(line)) return line; // indented code block

    // Naive inline-code protection: split on backticks and only linkify even segments.
    const parts = line.split("`");
    for (let i = 0; i < parts.length; i += 2) {
      parts[i] = linkifyPlainText(parts[i] ?? "");
    }
    return parts.join("`");
  });

  return out.join("\n");
};

/**
 * Normalize text for comparison (remove markdown formatting artifacts)
 */
export const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Strip markdown link syntax for matching.
 * This prevents URL-heavy markdown like `[Google](https://google.com)` from breaking
 * checkbox line matching (children render as "Google", but the source includes the URL).
 */
export const stripLinksForMatching = (text: string): string => {
  return text
    // Images: ![alt](url) -> alt
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '$1')
    // Inline links: [text](url "title") -> text
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    // Reference links: [text][id] or [text][] -> text
    .replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1')
    // Autolinks: <https://example.com> -> https://example.com
    .replace(/<((?:https?:\/\/|mailto:)[^>\s]+)>/g, '$1');
};
