/**
 * CodeMirror extension that wraps each fenced/code block in a single parent element
 * so we can style it with one border (block appearance) and style inline code (pill) separately.
 * Uses BlockWrapper for one wrapper div per code block; no per-line borders.
 */

import { syntaxTree } from "@codemirror/language";
import { StateField } from "@codemirror/state";
import { BlockWrapper, EditorView } from "@codemirror/view";
import type { EditorState } from "@codemirror/state";

const CODE_BLOCK_NODES = new Set(["FencedCode", "CodeBlock"]);
const WRAPPER_CLASS = "code-block-wrapper";
const wrapper = BlockWrapper.create({
  tagName: "div",
  attributes: { class: WRAPPER_CLASS },
});

function getCodeBlockWrappers(state: EditorState): ReturnType<typeof BlockWrapper.set> {
  const tree = syntaxTree(state);
  const ranges: Array<{ from: number; to: number; value: InstanceType<typeof BlockWrapper> }> = [];

  tree.iterate({
    enter: (node) => {
      if (!CODE_BLOCK_NODES.has(node.name)) return;
      ranges.push({ from: node.from, to: node.to, value: wrapper });
    },
  });

  if (ranges.length === 0) return BlockWrapper.set([]);
  return BlockWrapper.set(ranges, true);
}

const codeBlockWrapperField = StateField.define<ReturnType<typeof BlockWrapper.set>>({
  create(state) {
    return getCodeBlockWrappers(state);
  },
  update(value, tr) {
    if (tr.docChanged) return getCodeBlockWrappers(tr.state);
    return value;
  },
});

/** One parent border per code block; use with EditorView.theme for .code-block-wrapper */
export const codeBlockLinePlugin = [
  codeBlockWrapperField,
  EditorView.blockWrappers.of((view) => view.state.field(codeBlockWrapperField)),
];
