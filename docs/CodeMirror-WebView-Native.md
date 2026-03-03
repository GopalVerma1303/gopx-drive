# CodeMirror in WebView on Native (Expo)

The note editor uses **CodeMirror 6** with markdown syntax highlighting on both web and native.

## Approach: Expo DOM components (`'use dom'`)

On **native** (iOS/Android), CodeMirror runs inside a WebView via [Expo DOM components](https://docs.expo.dev/guides/dom-components):

1. **`components/codemirror-editor/CodeMirrorDOM.tsx`**  
   Marked with `'use dom'` at the top. This file runs in a separate bundle inside a WebView. It uses the same CodeMirror 6 stack as web (`@codemirror/view`, `@codemirror/state`, `@codemirror/lang-markdown`, etc.) and exposes:
   - **Props:** `value`, `placeholder`, `onContentChange`, `onSelectionChange`, `backgroundColor`, `color`
   - **Ref (via `useDOMImperativeHandle`):** `focus()`, `setSelection(start, end)`

2. **Communication**
   - **Native → DOM:** Props are marshalled asynchronously (value, theme colors). When the user does undo/toolbar/etc., the native side updates `value` and the DOM component syncs it to the editor.
   - **DOM → Native:** Native actions (`onContentChange`, `onSelectionChange`) are async functions passed from the native side. When the user types or changes selection, the DOM component calls these and the native state updates.

3. **Preview toggle**  
   The DOM component does not expose `getValueAsync` (ref methods in Expo DOM cannot return values). Content is kept in sync on every change via `onContentChange`, so when switching to preview we use the current `content` state. The note screen uses `(editorRef.current?.getContentAsync?.() ?? Promise.resolve(content))` so it works with or without `getValueAsync`.

4. **When the DOM component fails**  
   Native editor is wrapped in an error boundary. If CodeMirror+WebView fails to load, the user sees the message "codemirror+webview is not working" so the issue is visible and can be fixed (no fallback to a plain TextInput).

## Requirements

- **Expo SDK 52+** (this project uses 54).
- **react-native-webview** (already installed).
- For Expo Router/Expo Web projects, **react-dom** and **react-native-web** are typically already present.

## Alternative: manual WebView + inline HTML

The repo also contains a manual WebView implementation that loads a pre-built HTML string (`editor-html.generated.ts`) with CodeMirror inlined. That approach can fail to load on some devices (bundle size, `originWhitelist` + inline HTML on Android). The Expo DOM approach avoids shipping a single huge HTML string and uses the same React/CodeMirror code as web.
