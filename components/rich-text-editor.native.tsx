import { MarkdownEditor, type MarkdownEditorRef } from "@/components/markdown-editor";
import React, { forwardRef } from "react";
import type { RichTextEditorProps, RichTextEditorRef } from "./rich-text-editor.types";

export const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>(
  function RichTextEditor(props, ref) {
    return <MarkdownEditor {...props} ref={ref as unknown as React.Ref<MarkdownEditorRef>} />;
  }
);

