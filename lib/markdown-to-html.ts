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
import rehypeKatex from "rehype-katex";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
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
  position?: {
    start: { line: number; column: number; offset?: number };
    end: { line: number; column: number; offset?: number };
  };
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

/**
 * Rehype plugin: turn ==text== into <mark>text</mark>
 * Applies to text nodes only.
 */
function rehypeMark() {
  return (tree: HastNode) => {
    visit(tree as any, "text", (node: HastNode, index: number | undefined, parent: HastNode | undefined) => {
      // Don't parse inside code blocks or already styled elements
      if (parent && (parent.tagName === "code" || parent.tagName === "pre" || parent.tagName === "a")) {
        return;
      }

      if (node.value && typeof node.value === "string") {
        const text = node.value;
        const MARK_REGEX = /==([^ \s](?:[^]*?[^ \s])?)==/g;

        if (!MARK_REGEX.test(text)) return;
        MARK_REGEX.lastIndex = 0;

        const newChildren: HastNode[] = [];
        let lastIndex = 0;
        let match;

        while ((match = MARK_REGEX.exec(text)) !== null) {
          const mText = match[1];
          const matchStart = match.index;

          if (matchStart > lastIndex) {
            newChildren.push({ type: "text", value: text.slice(lastIndex, matchStart) });
          }

          newChildren.push({
            type: "element",
            tagName: "mark",
            properties: {},
            children: [{ type: "text", value: mText }]
          });

          lastIndex = matchStart + match[0].length;
        }

        if (lastIndex < text.length) {
          newChildren.push({ type: "text", value: text.slice(lastIndex) });
        }

        if (parent && Array.isArray(parent.children) && typeof index === "number") {
          parent.children.splice(index, 1, ...newChildren);
          return index + newChildren.length;
        }
      }
    });
  };
}

/**
 * Rehype plugin: turn __text__ into <u>text</u>
 * Applies to text nodes only.
 */
function rehypeUnderline() {
  return (tree: HastNode) => {
    visit(tree as any, "text", (node: HastNode, index: number | undefined, parent: HastNode | undefined) => {
      // Don't parse inside code blocks or already styled elements
      if (parent && (parent.tagName === "code" || parent.tagName === "pre" || parent.tagName === "a")) {
        return;
      }

      if (node.value && typeof node.value === "string") {
        const text = node.value;
        const UNDERLINE_REGEX = /__(?=[^ \s])(?:[^]*?[^ \s])?__/g;

        if (!UNDERLINE_REGEX.test(text)) return;
        UNDERLINE_REGEX.lastIndex = 0;

        const newChildren: HastNode[] = [];
        let lastIndex = 0;
        let match;

        while ((match = UNDERLINE_REGEX.exec(text)) !== null) {
          const mText = match[0].slice(2, -2);
          const matchStart = match.index;

          if (matchStart > lastIndex) {
            newChildren.push({ type: "text", value: text.slice(lastIndex, matchStart) });
          }

          newChildren.push({
            type: "element",
            tagName: "u",
            properties: {},
            children: [{ type: "text", value: mText }]
          });

          lastIndex = matchStart + match[0].length;
        }

        if (lastIndex < text.length) {
          newChildren.push({ type: "text", value: text.slice(lastIndex) });
        }

        if (parent && Array.isArray(parent.children) && typeof index === "number") {
          parent.children.splice(index, 1, ...newChildren);
          return index + newChildren.length;
        }
      }
    });
  };
}

function getAlertIcon(type: string): HastNode {
  const children: HastNode[] = [];
  if (type === "note") {
    children.push({ type: "element", tagName: "circle", properties: { cx: "12", cy: "12", r: "10" } });
    children.push({ type: "element", tagName: "path", properties: { d: "M12 16v-4" } });
    children.push({ type: "element", tagName: "path", properties: { d: "M12 8h.01" } });
  } else if (type === "tip") {
    children.push({ type: "element", tagName: "path", properties: { d: "M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.9 1.2 1.5 1.5 2.5" } });
    children.push({ type: "element", tagName: "path", properties: { d: "M9 18h6" } });
    children.push({ type: "element", tagName: "path", properties: { d: "M10 22h4" } });
  } else if (type === "important") {
    children.push({ type: "element", tagName: "path", properties: { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" } });
    children.push({ type: "element", tagName: "path", properties: { d: "M12 7v2" } });
    children.push({ type: "element", tagName: "path", properties: { d: "M12 13h.01" } });
  } else if (type === "warning") {
    children.push({ type: "element", tagName: "path", properties: { d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" } });
    children.push({ type: "element", tagName: "path", properties: { d: "M12 9v4" } });
    children.push({ type: "element", tagName: "path", properties: { d: "M12 17h.01" } });
  } else if (type === "caution") {
    children.push({ type: "element", tagName: "polygon", properties: { points: "7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" } });
    children.push({ type: "element", tagName: "line", properties: { x1: "12", y1: "8", x2: "12", y2: "12" } });
    children.push({ type: "element", tagName: "line", properties: { x1: "12", y1: "16", x2: "12.01", y2: "16" } });
  }

  children.forEach(c => {
    c.properties = { stroke: "currentColor", strokeWidth: "2", fill: "none", strokeLinecap: "round", strokeLinejoin: "round", ...(c.properties || {}) };
  });

  return {
    type: "element",
    tagName: "svg",
    properties: { viewBox: "0 0 24 24", width: "16", height: "16", className: ["lucide"] },
    children
  };
}

/**
 * Rehype plugin: detect GitHub-style alerts `> [!NOTE]` and transform blockquotes into .markdown-alert divs.
 */
function rehypeAlerts() {
  return (tree: HastNode) => {
    visit(tree as any, "element", (node: HastNode) => {
      if (node.tagName !== "blockquote" || !node.children) return;

      const firstP = node.children.find((c) => c.type === "element" && c.tagName === "p");
      if (!firstP || !firstP.children || firstP.children.length === 0) return;

      const firstChild = firstP.children[0];
      if (firstChild.type !== "text" || !firstChild.value) return;

      const match = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i.exec(firstChild.value);
      if (!match) return;

      const alertType = match[1].toLowerCase();
      
      firstChild.value = firstChild.value.substring(match[0].length);

      const leadingSpaceMatch = /^\s+/.exec(firstChild.value);
      if (leadingSpaceMatch) {
         firstChild.value = firstChild.value.substring(leadingSpaceMatch[0].length);
      }

      // Automatically remove trailing <br> exactly if text was immediately followed by a newline (GFM blockquote norm)
      if (firstChild.value === "" && firstP.children[1]?.type === "element" && firstP.children[1].tagName === "br") {
        firstP.children.splice(1, 1);
        const next = firstP.children[1];
        if (next && next.type === "text" && next.value) {
           next.value = next.value.replace(/^\s+/, "");
        }
      }

      const titleText = alertType.charAt(0).toUpperCase() + alertType.slice(1);

      const titleNode: HastNode = {
         type: "element",
         tagName: "div",
         properties: { className: ["markdown-alert-title"] },
         children: [
            getAlertIcon(alertType),
            { type: "text", value: titleText }
         ]
      };

      node.tagName = "div";
      node.properties = {
         ...(node.properties || {}),
         className: ["markdown-alert", `markdown-alert-${alertType}`]
      };

      node.children.unshift(titleNode);
    });
  };
}

/**
 * Rehype plugin: attach source line index to task list item checkboxes.
 * GFM rendering: <li class="task-list-item"><input type="checkbox" ...> ...</li>
 * We look for the input and attach data-line-index from its owner <li>'s position.
 */
function rehypeTaskListItemSource() {
  return (tree: HastNode) => {
    visit(tree as any, "element", (node: HastNode) => {
      if (node.tagName === "li" && node.children) {
        // Find if this LI contains a checkbox (task list item). Check direct children and nested children.
        let checkbox: HastNode | undefined;
        const findCheckbox = (nodes: HastNode[]) => {
          for (const c of nodes) {
            if (c.type === 'element' && c.tagName === 'input' && c.properties?.type === 'checkbox') {
              checkbox = c;
              return true;
            }
            if (c.children && findCheckbox(c.children)) return true;
          }
          return false;
        };
        
        findCheckbox(node.children);
        
        if (checkbox && node.position) {
          // unist position lines are 1-based; we use 0-based index for toggling.
          const lineIndex = node.position.start.line - 1;
          checkbox.properties = {
            ...(checkbox.properties || {}),
            "data-line-index": String(lineIndex)
          };
        }
      }
    });
  };
}

const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames || []),
    "svg", "path", "circle", "polygon", "line", "mark", "u",
    "math", "semantics", "mrow", "msub", "msup", "mi", "mo", "mn", "mtext", "mspace", "mstyle", "mfrac", "mroot", "msqrt", "mtable", "mtr", "mtd", "annotation"
  ],
  attributes: {
    ...defaultSchema.attributes,
    svg: ["viewBox", "width", "height", "className", "fill", "stroke", "strokeWidth", "strokeLinecap", "strokeLinejoin"],
    path: ["d", "fill", "stroke", "strokeWidth", "strokeLinecap", "strokeLinejoin"],
    circle: ["cx", "cy", "r", "fill", "stroke", "strokeWidth", "strokeLinecap", "strokeLinejoin"],
    polygon: ["points", "fill", "stroke", "strokeWidth", "strokeLinecap", "strokeLinejoin"],
    line: ["x1", "y1", "x2", "y2", "fill", "stroke", "strokeWidth", "strokeLinecap", "strokeLinejoin"],
    code: [
      ...(defaultSchema.attributes?.code ?? []),
      ["className", "hljs", /^language-/],
    ],
    input: [
      "type",
      "checked",
      "disabled",
      "className",
      "data-line-index",
    ],
    span: [
      ...(defaultSchema.attributes?.span ?? []),
      ["className", /^hljs-/, /^katex-/, "mention-tag", "math", "math-inline", "math-display"],
    ],
    div: [
      ...(defaultSchema.attributes?.div || []),
      "className",
      "data-mermaid-source",
      ["className", "math", "math-display"],
    ],
    annotation: ["encoding"],
  },
};

let processor: ReturnType<typeof createProcessor> | null = null;

function createProcessor() {
  return (unified() as any)
    .use(remarkParse)
    .use(remarkMath)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: false })
    .use(rehypeMermaidBlocks)
    .use(rehypeMentions)
    .use(rehypeMark)
    .use(rehypeUnderline)
    .use(rehypeAlerts)
    .use(rehypeTaskListItemSource)
    .use(rehypeHighlight as any, { subset: false })
    .use(rehypeSanitize as any, sanitizeSchema)
    .use(rehypeKatex)
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
  // Escape double underscores so they remain as text nodes for rehypeUnderline to find.
  // This prevents remark-gfm from converting __abc__ into <strong>abc</strong>.
  const escapedMarkdown = markdown.replace(/__(?=[^ \s])((?:[^]*?[^ \s])?)__/g, '\\_\\_$1\\_\\_');
  
  // Strip <!-- comments --> so they do not appear in preview
  const strippedMarkdown = escapedMarkdown.replace(/<!--[\s\S]*?-->/g, '');

  const proc = getProcessor();
  const file = await proc.process(strippedMarkdown);
  return String(file);
}
