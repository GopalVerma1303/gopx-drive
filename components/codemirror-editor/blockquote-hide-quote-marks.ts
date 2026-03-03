/**
 * Hides the ">" (QuoteMark) on continuation lines of a blockquote so only the first line
 * shows ">", matching preview mode. Uses replace decorations with a zero-width widget.
 */

import { syntaxTree } from "@codemirror/language";
import { StateField, type EditorState } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, WidgetType } from "@codemirror/view";

class HiddenQuoteMarkWidget extends WidgetType {
  toDOM() {
    const span = document.createElement("span");
    span.style.display = "inline-block";
    span.style.width = "0";
    span.style.overflow = "hidden";
    span.setAttribute("aria-hidden", "true");
    return span;
  }
}

const hiddenQuoteWidget = new HiddenQuoteMarkWidget();

function getBlockquoteHideQuoteDecorations(state: EditorState): DecorationSet {
  const tree = syntaxTree(state);
  const decos: Array<{ from: number; to: number; decoration: Decoration }> = [];

  tree.iterate({
    enter: (node) => {
      if (node.name !== "Blockquote") return;
      const blockFrom = node.from;
      const blockTo = node.to;
      const firstLine = state.doc.lineAt(blockFrom);
      // Hide QuoteMark on any line after the first line of this blockquote
      tree.iterate({
        from: blockFrom,
        to: blockTo,
        enter: (n) => {
          if (n.name === "QuoteMark" && n.from >= firstLine.to) {
            decos.push({
              from: n.from,
              to: n.to,
              decoration: Decoration.replace({
                widget: hiddenQuoteWidget,
                side: 1,
              }),
            });
          }
        },
      });
    },
  });

  if (decos.length === 0) return Decoration.none;
  return Decoration.set(
    decos.map((d) => ({ from: d.from, to: d.to, value: d.decoration })),
    true
  );
}

const blockquoteHideQuoteMarkField = StateField.define<DecorationSet>({
  create(state) {
    return getBlockquoteHideQuoteDecorations(state);
  },
  update(value, tr) {
    if (tr.docChanged) return getBlockquoteHideQuoteDecorations(tr.state);
    return value.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

/** Hides ">" on blockquote continuation lines so only the first line shows ">". */
export const blockquoteHideQuoteMarks = [blockquoteHideQuoteMarkField];
