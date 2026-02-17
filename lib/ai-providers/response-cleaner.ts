/**
 * Shared response cleaning for AI providers.
 * Removes meta-commentary and ensures code blocks use ```<lang> format.
 */

/** Infer language/extension for code block content (e.g. "js", "ts", "python"). */
function inferCodeBlockLang(content: string): string {
  const head = content.slice(0, 400).trim();
  if (/\b(def |class |import |from .* import|#.*\.py\b)/m.test(head)) return "python";
  if (/\b(<?php|<\?=)/.test(head)) return "php";
  if (/\bfunc\s+\w+\s*\(/.test(head) || /\bpackage\s+\w+/.test(head)) return "go";
  if (/#include\s*[<"]/.test(head)) return "c";
  if (/\b(public|private|protected)\s+(static\s+)?\w+\s+[\w<>]+\s*\(/.test(head)) return "java";
  if (/\b(export\s+)?(default\s+)?(function|const|class)\s+\w+/.test(head)) return "ts";
  if (/\b(function|const|let|var)\s+\w+/.test(head) || /=>\s*[{(]/.test(head)) return "js";
  if (/\b(rb|ruby)\b|^\s*def\s+\w+/.test(head)) return "ruby";
  if (/\b(impl|fn|pub\s+fn|let\s+mut)\b/.test(head)) return "rust";
  if (/^\s*[{[]/.test(head) && /["{}\[\],:]/.test(head)) return "json";
  return "text";
}

/**
 * Cleans AI response: removes meta-commentary and ensures code blocks
 * are in the form ```<file ext/lang>\n...\n```.
 */
export function cleanResponse(text: string): string {
  let cleanedText = text.trim();

  const patternsToRemove = [
    /^Here's.*?:\s*/i,
    /^Here is.*?:\s*/i,
    /^I'll.*?:\s*/i,
    /^I can.*?:\s*/i,
    /^Sure.*?:\s*/i,
    /^Of course.*?:\s*/i,
    /^Certainly.*?:\s*/i,
    /^Let me.*?:\s*/i,
    /^I'll help.*?:\s*/i,
    /^I can help.*?:\s*/i,
    /^Here.*?:\s*/i,
    /\s*Let me know.*$/i,
    /\s*Is there anything else.*$/i,
    /\s*I hope this helps.*$/i,
    /\s*Hope this helps.*$/i,
    /\s*Does this help\?.*$/i,
    /\s*Let me know if.*$/i,
    /^#+\s+(.+)$/m,
    /^["'](.+)["']$/,
    /\s*\([^)]*here[^)]*\)/i,
    /\s*\([^)]*note[^)]*\)/i,
  ];

  for (const pattern of patternsToRemove) {
    cleanedText = cleanedText.replace(pattern, "$1").trim();
  }

  const headerOnlyPattern = /^(#+\s+)(.+)$/;
  const headerMatch = cleanedText.match(headerOnlyPattern);
  if (headerMatch && cleanedText.split("\n").length === 1) {
    cleanedText = headerMatch[2].trim();
  }

  if (cleanedText.match(/^#+\s+\w+$/)) {
    cleanedText = cleanedText.replace(/^#+\s+/, "").trim();
  }

  // Code blocks: keep as ```<lang>...```; only unwrap when clearly plain text
  if (cleanedText.startsWith("```") && cleanedText.endsWith("```")) {
    const lines = cleanedText.split("\n");
    const firstLine = lines[0].trim();
    const closingFence = lines[lines.length - 1].trim();
    const body = lines.slice(1, lines.length - 1).join("\n").trim();

    const hasLang = firstLine.length > 3 && /^```[\w+#-]+$/.test(firstLine);
    const looksLikeCode =
      body.length > 60 ||
      /\b(def|function|const|let|var|import|export|class|=>|{)\s/.test(body) ||
      /[;{}()[\]]/.test(body);

    if (hasLang) {
      // Already ```<lang> - keep as is
      cleanedText = cleanedText;
    } else if (lines.length <= 3 && !looksLikeCode) {
      // Short plain text in fences - unwrap
      cleanedText = body;
    } else {
      // Code without lang - ensure ```<lang>\n...\n```
      const lang = inferCodeBlockLang(body);
      cleanedText = `\`\`\`${lang}\n${body}\n\`\`\``;
    }
  }

  return cleanedText.trim();
}
