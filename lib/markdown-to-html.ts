/**
 * Converts markdown to sanitized HTML using unified/remark/rehype.
 * Used by MarkdownPreview for both web (dangerouslySetInnerHTML) and native (WebView).
 * Code blocks get syntax highlighting via rehype-highlight (highlight.js).
 * Caller should apply linkify to the markdown before passing if desired.
 *
 * This module also adds **support for Mermaid diagrams**:
 * fenced code blocks with language `mermaid` are converted into
 * `<div class="mermaid">...</div>` so downstream preview layers
 * (web DOM + WebView) can render them using the Mermaid runtime.
 */

import rehypeHighlight from "rehype-highlight";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { visit } from "unist-util-visit";

type HastNode = {
  type?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
  value?: string;
};

/**
 * Rehype plugin: turn <pre><code class="language-mermaid">…</code></pre>
 * into <div class="mermaid">…</div> so Mermaid can render it.
 *
 * This runs on the HTML (HAST) tree after remarkRehype, which is the
 * natural place to work with HTML tags.
 */
function rehypeMermaidBlocks() {
  return (tree: HastNode) => {
    const visit = (node: HastNode, _index: number, parent: HastNode | null) => {
      if (node.type === "element" && node.tagName === "pre" && node.children) {
        const children = node.children;
        const codeChild = children.find(
          (c) => c.type === "element" && c.tagName === "code"
        ) as HastNode | undefined;

        if (codeChild && codeChild.properties) {
          const className = codeChild.properties.className as
            | string
            | string[]
            | undefined;
          const classes =
            typeof className === "string"
              ? className.split(/\s+/)
              : Array.isArray(className)
              ? className
              : [];
          const isMermaid = classes.includes("language-mermaid");

          if (isMermaid) {
            // Extract raw text content from the code node.
            let raw = "";
            if (codeChild.children) {
              raw = codeChild.children
                .map((c) => (c.type === "text" ? c.value ?? "" : ""))
                .join("");
            }

            const lines = raw.split(/\r?\n/);
            const firstNonEmpty = (lines.find((l) => l.trim().length > 0) ?? "").trim();
            const headerLower = firstNonEmpty.toLowerCase();
            // Diagram types that provide their own top-level header and should NOT
            // get a default "graph TD" injected in front.
            const explicitTypes = [
              "graph",
              "flowchart",
              "sequencediagram",
              "classdiagram",
              "statediagram",
              "erdiagram",
              "journey",
              "gantt",
              "pie",
              "gitgraph",
              "c4context",
              "c4container",
              "c4component",
              "c4dynamic",
              "c4deployment",
            ];
            const hasExplicitHeader = explicitTypes.some((t) =>
              headerLower.startsWith(t)
            );

            // If the user omitted the `graph TD` header (e.g. just wrote edges),
            // inject a sensible default so common shorthand still renders.
            if (!hasExplicitHeader && raw.trim().length > 0) {
              raw = `graph TD\n${raw}`;
            }

            const mermaidNode: HastNode = {
              type: "element",
              tagName: "div",
              properties: {
                className: ["mermaid"],
                // Preserve the original diagram source so preview UIs
                // can offer a "copy mermaid" control even after render.
                "data-mermaid-source": raw,
              },
              children: [
                {
                  type: "text",
                  value: raw,
                },
              ],
            };

            if (parent && Array.isArray(parent.children)) {
              const idx = parent.children.indexOf(node);
              if (idx !== -1) {
                parent.children[idx] = mermaidNode;
              }
            }
            return;
          }
        }
      }

      if (node.children && Array.isArray(node.children)) {
        node.children.forEach((child, idx) => visit(child, idx, node));
      }
    };

    visit(tree, 0, null);
  };
}

/**
 * Rehype plugin: turn @tags into <span class="mention-tag">@tag</span>
 * Applies to text nodes only.
 */
function rehypeMentions() {
  return (tree: HastNode) => {
    visit(tree as any, "text", (node: HastNode, index: number | undefined, parent: HastNode | undefined) => {
      // Don't parse inside code blocks or already styled elements
      if (parent && (parent.tagName === "code" || parent.tagName === "pre" || parent.tagName === "a")) {
        return;
      }

      if (node.value && typeof node.value === "string") {
        const text = node.value;
        const MENTION_REGEX = /(^|\s)(@[\w-]+)(?=\b|\s|$)/g;

        if (!MENTION_REGEX.test(text)) return;
        MENTION_REGEX.lastIndex = 0; // Reset regex

        const newChildren: HastNode[] = [];
        let lastIndex = 0;
        let match;

        while ((match = MENTION_REGEX.exec(text)) !== null) {
          const mSpace = match[1]; // Space or empty
          const mTag = match[2]; // @tag
          
          const matchStart = match.index + mSpace.length;
          
          if (matchStart > lastIndex) {
            newChildren.push({ type: "text", value: text.slice(lastIndex, matchStart) });
          }

          newChildren.push({
            type: "element",
            tagName: "span",
            properties: { className: ["mention-tag"] },
            children: [{ type: "text", value: mTag }]
          });

          lastIndex = matchStart + mTag.length;
        }

        if (lastIndex < text.length) {
          newChildren.push({ type: "text", value: text.slice(lastIndex) });
        }

        if (parent && Array.isArray(parent.children) && typeof index === "number") {
          parent.children.splice(index, 1, ...newChildren);
          // Return the new index to continue parsing safely (skipped newly added nodes)
          return index + newChildren.length;
        }
      }
    });
  };
}

/** Sanitize schema that allows highlight.js classes and mermaid containers. */
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [
      ...(defaultSchema.attributes?.code ?? []),
      ["className", "hljs", /^language-/],
    ],
    span: [
      ...(defaultSchema.attributes?.span ?? []),
      ["className", /^hljs-/, "mention-tag"],
    ],
    div: [
      ...(defaultSchema.attributes?.div ?? []),
      // Allow <div class="mermaid" data-mermaid-source="...">…</div> wrappers for diagrams.
      ["className", "mermaid"],
      ["data-mermaid-source"],
    ],
  },
};

let processor: ReturnType<typeof createProcessor> | null = null;

function createProcessor() {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: false })
    .use(rehypeMermaidBlocks)
    .use(rehypeMentions)
    .use(rehypeHighlight as any, { subset: false })
    .use(rehypeSanitize as any, sanitizeSchema)
    .use(rehypeStringify);
}

function getProcessor() {
  if (!processor) processor = createProcessor();
  return processor;
}

/**
 * Convert markdown string to sanitized HTML.
 */
export async function markdownToHtml(markdown: string): Promise<string> {
  if (!markdown || !markdown.trim()) return "";
  const proc = getProcessor();
  const file = await proc.process(markdown);
  return String(file);
}
