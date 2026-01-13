/**
 * Strips markdown syntax from text for preview purposes
 */
export function stripMarkdown(text: string): string {
  if (!text) return "";
  
  return text
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, "")
    // Remove inline code
    .replace(/`[^`]*`/g, "")
    // Remove headers
    .replace(/^#{1,6}\s+/gm, "")
    // Remove bold/italic
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    // Remove links but keep text
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    // Remove images
    .replace(/!\[([^\]]*)\]\([^\)]+\)/g, "")
    // Remove blockquotes
    .replace(/^>\s+/gm, "")
    // Remove list markers
    .replace(/^[\s]*[-*+]\s+/gm, "")
    .replace(/^[\s]*\d+\.\s+/gm, "")
    // Remove horizontal rules
    .replace(/^---$/gm, "")
    .replace(/^___$/gm, "")
    // Clean up extra whitespace
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
