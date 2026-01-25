import { markdownLanguage } from '@codemirror/lang-markdown';

// GitHub Flavored Markdown (GFM) parser configuration for CodeMirror 6.
//
// NOTE: `@codemirror/lang-markdown` already ships a `markdownLanguage` that supports:
// - GFM (tables/task lists/strikethrough/autolinks)
// - subscript/superscript
// - emoji syntax
//
// Keep this shared between:
// - Web editor (`components/editor.web.tsx`)
// - Native WebView bundle (`webviewBundles/markdownEditorBundle/contentScript.ts`)
export const gfmMarkdownLanguage = markdownLanguage;

