/**
 * CodeMirror extension that wraps fenced/code blocks and blockquotes in a single parent element
 * so we can style them with one border (block appearance), matching preview mode.
 * Uses BlockWrapper for one wrapper div per block; blockquotes get .blockquote-wrapper with left border.
 */

import { syntaxTree } from "@codemirror/language";
import { StateField } from "@codemirror/state";
import { BlockWrapper, EditorView } from "@codemirror/view";
import type { EditorState } from "@codemirror/state";

const CODE_BLOCK_NODES = new Set(["FencedCode", "CodeBlock"]);
const WRAPPER_CLASS = "code-block-wrapper";
const codeBlockWrapper = BlockWrapper.create({
  tagName: "div",
  attributes: { class: WRAPPER_CLASS },
});

const BLOCKQUOTE_WRAPPER_CLASS = "blockquote-wrapper";
const blockquoteWrapper = BlockWrapper.create({
  tagName: "div",
  attributes: { class: BLOCKQUOTE_WRAPPER_CLASS },
});

function getCodeBlockWrappers(state: EditorState): ReturnType<typeof BlockWrapper.set> {
  const tree = syntaxTree(state);
  const ranges: Array<{ from: number; to: number; value: InstanceType<typeof BlockWrapper> }> = [];

  tree.iterate({
    enter: (node) => {
      if (CODE_BLOCK_NODES.has(node.name)) {
        ranges.push({ from: node.from, to: node.to, value: codeBlockWrapper });
      } else if (node.name === "Blockquote") {
        ranges.push({ from: node.from, to: node.to, value: blockquoteWrapper });
      }
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

/** One parent border per code block and blockquote; use with EditorView.theme for .code-block-wrapper and .blockquote-wrapper */
export const codeBlockLinePlugin = [
  codeBlockWrapperField,
  EditorView.blockWrappers.of((view) => view.state.field(codeBlockWrapperField)),
];
