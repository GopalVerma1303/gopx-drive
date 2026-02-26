# Joplin React Native Mobile App: CodeMirror Editor Architecture (In-Depth)

This document describes how [Joplin’s React Native mobile app](https://github.com/laurent22/joplin/tree/dev/packages/app-mobile) uses the shared **CodeMirror 6**-based markdown editor inside a **WebView**, based on the current `dev` branch structure and code.

---

## 1. Repository and Package Layout

| Path | Role |
|------|------|
| `packages/app-mobile/` | React Native app (Expo, iOS/Android). |
| `packages/app-mobile/components/NoteEditor/` | Note editor UI: Markdown vs Rich Text, toolbar, search, link dialog. |
| `packages/app-mobile/components/NoteEditor/MarkdownEditor.tsx` | **Mobile markdown editor**: WebView + injected editor bundle. |
| `packages/app-mobile/components/ExtendedWebView/` | Wrapper around `react-native-webview` that loads **file-based** HTML. |
| `packages/app-mobile/contentScripts/markdownEditorBundle/` | Hook and types for setting up the WebView and the **pre-bundled** editor script. |
| `packages/app-mobile/components/screens/Note/` | Note screen: title, body, toolbar; holds `editorRef` and calls undo/redo/insertText. |
| `packages/editor/` | Shared **@joplin/editor** package: CodeMirror 6 setup, commands, types, events. |

**Key dependency (from app-mobile `package.json`):**

- `"@joplin/editor": "~3.6"` — shared editor API and types.
- `"react-native-webview": "13.16.0"` — WebView used for the editor.

---

## 2. How the Editor Is Loaded: No CDN, Pre-Bundled Script

On mobile, the editor does **not** load CodeMirror from a CDN (e.g. `esm.sh`) inside the WebView. It uses a **pre-bundled** script that is injected into the WebView.

### 2.1 Build Step: `buildInjectedJs`

- **Scripts (app-mobile):** `"buildInjectedJs": "gulp buildInjectedJs"`, `"watchInjectedJs": "gulp watchInjectedJs"`.
- The **markdownEditorBundle** (and other contentScript bundles) are built by Gulp. The output is registered so the app can inject it at runtime via `shim.injectedJs('markdownEditorBundle')`.
- So at runtime the WebView receives a single blob of JavaScript that already contains the editor (CodeMirror + `@joplin/editor` integration). There is **no** `import('https://esm.sh/...')` in the mobile flow.

### 2.2 Why This Matters on Android

- Loading ES modules from a CDN inside inline HTML with `baseUrl: "about:blank"` often fails on Android (MIME, origin, or security restrictions).
- Joplin avoids that by:
  1. Building the editor into a single injected script.
  2. Loading the WebView from a **file://** URL (see below), not from inline HTML with an opaque origin.

---

## 3. ExtendedWebView: File-Based HTML, Not Inline

**Location:** `packages/app-mobile/components/ExtendedWebView/index.tsx`

ExtendedWebView does **not** use `source={{ html: "...", baseUrl: "about:blank" }}`.

### 3.1 Flow

1. **Input:** `html` (string), `webviewInstanceId`, optional `css`, `injectedJavaScript`, `onMessage`, etc.
2. **Write to disk:** The component writes `props.html` to a **temp file** in the resource directory:
   - `tempFile = ${baseDirectory}/${webviewInstanceId}.html`
   - `baseDirectory` defaults to `Setting.value('resourceDir')`.
3. **Load via file://:** The WebView source is set to:
   - `uri: "file://" + tempFile + "?r=" + random()` (cache busting),
   - `baseUrl: "file://" + baseDirectory`.
4. **Result:** The WebView has a **real origin** (`file://...`), so same-origin script execution and (if needed) relative resource loading behave correctly. No opaque/origin-less context.

### 3.2 ExtendedWebView API (Ref)

- **injectJS(script: string):** Runs script in the WebView (wrapped in try/catch, must end with `true;`).
- **postMessage(message):** Sends a JSON-serializable message to the WebView (implementation may use `injectJS` or the WebView’s postMessage API depending on version).

### 3.3 Props (Summary)

- `webviewInstanceId`, `html`, `css`, `injectedJavaScript`, `onMessage`, `onError`, `onLoadStart`, `onLoadEnd`.
- `scrollEnabled`, `mixedContentMode`, `allowFileAccessFromJs`, `baseDirectory`.

---

## 4. MarkdownEditor.tsx: Composing HTML, CSS, and Injected JS

**Location:** `packages/app-mobile/components/NoteEditor/MarkdownEditor.tsx`

### 4.1 Structure

- **useHtml():** Returns a static HTML string that includes:
  - A root element (e.g. a div with class `CodeMirror` or similar) where the editor will be mounted.
  - No script tags that load CodeMirror from the network; the editor is created by **injected** JS.
- **useCss(themeId):** Returns CSS string (theme variables, body, scrollbars, etc.) from the app theme.
- **useWebViewSetup(...):** Returns:
  - **pageSetup.js:** The **initial** injected script (run when the page loads). This script ensures `window.markdownEditorBundle` exists by running `shim.injectedJs('markdownEditorBundle')` and assigns it to `window.markdownEditorBundle`.
  - **webViewEventHandlers:** `onLoadEnd`, `onMessage`.
  - **api:** The object that is assigned to `props.editorRef.current` and used by the Note screen (undo, redo, insertText, execCommand, etc.).

### 4.2 When the Editor Is Actually Created

- **On load (onLoadEnd):** The WebView runs a **second** injected script (built in `useWebViewSetup` as `afterLoadFinishedJs`). That script:
  - Checks for a parent element (e.g. by class `CodeMirror`).
  - If found, calls `window.markdownEditorBundle.createMainEditor(editorOptions)` with options (initialText, settings, noteId, etc.).
  - Optionally runs `cm.jumpToHash(...)`, `cm.select(...)`, `cm.setSearchState(...)` for initial state.
- So the **editor instance** is created **after** the file-based HTML has loaded and the pre-bundled `markdownEditorBundle` has been injected and run. No CDN fetch in the WebView.

### 4.3 Assignment of the Ref

- `props.editorRef.current = editorWebViewSetup.api.mainEditor` (from the hook’s return value). The Note screen and NoteEditor then call `editorRef.current.undo()`, `editorRef.current.insertText(...)`, etc. Those calls go through the **RN ↔ WebView messenger** to the editor running inside the WebView.

---

## 5. useWebViewSetup: Bridge and Messenger

**Location:** `packages/app-mobile/contentScripts/markdownEditorBundle/useWebViewSetup.ts`

### 5.1 Responsibilities

- Build the **initial** injected JS that defines `window.markdownEditorBundle` (via `shim.injectedJs('markdownEditorBundle')`).
- Build the **after-load** JS that calls `markdownEditorBundle.createMainEditor(editorOptions)` and sets initial selection/hash/search.
- Provide **webViewEventHandlers**: `onLoadEnd` (inject after-load script), `onMessage` (handle messages from WebView).
- Expose an **api** that implements the “main editor” interface (undo, redo, insertText, execCommand, updateBody, etc.) by talking to the WebView via **RNToWebViewMessenger**.

### 5.2 RNToWebViewMessenger

- **Bidirectional IPC** between React Native and the WebView.
- **Local API (RN side):** e.g. `onEditorEvent`, `logMessage`, `onPasteFile`, `onLocalize`, `onResolveImageSrc`. The WebView script calls into these via messages.
- **Remote API (exposed as editorRef):** The “main editor” API (undo, redo, insertText, execCommand, setSearchState, etc.). Implemented by sending messages from RN to WebView; the WebView runs the corresponding CodeMirror / editor commands and may send events back (e.g. change, selection, undo/redo depth).

### 5.3 Editor Options Passed to createMainEditor

- Include at least: `parentElementOrClassName`, `initialText`, `initialNoteId`, `settings` (theme, font, readOnly, etc.). These come from `editorOptions` built in NoteEditor (theme, font size, language, etc.).

---

## 6. Note Screen and NoteEditor: How the Ref Is Used

**Location:** `packages/app-mobile/components/screens/Note/Note.tsx`, `packages/app-mobile/components/NoteEditor/NoteEditor.tsx`

### 6.1 Note Screen

- Holds **editorRef** (e.g. `this.editorRef = React.createRef()`).
- Renders **NoteEditor** and passes a ref that NoteEditor forwards to the editor control (the object returned by `useEditorControl` in NoteEditor.tsx).
- When the user uses the beta (CodeMirror) editor:
  - **Undo/Redo:** `this.editorRef.current.undo()`, `this.editorRef.current.redo()`.
  - **Insert text (e.g. from dialog):** `this.editorRef.current.insertText(text)`.
  - **Focus:** `this.editorRef.current` is passed to a focus helper.
  - **Hide keyboard:** `this.editorRef.current.hideKeyboard()` (implemented in NoteEditor by injecting `document.activeElement?.blur();`).
- Listens to **@joplin/editor events** (e.g. ChangeEvent, SelectionRangeChangeEvent, UndoRedoDepthChangeEvent) to update note body, selection, and undo/redo button state.

### 6.2 NoteEditor (EditorType.Markdown)

- Uses **MarkdownEditor** when `props.mode === EditorType.Markdown`.
- **useEditorControl(editorRef, webviewRef, ...)** builds the **EditorControl** object that is exposed via the ref. That control:
  - **execCommand(command):** forwards to `editorRef.current.execCommand(command)` (which goes to the WebView).
  - **undo / redo:** `editorRef.current.undo()`, `editorRef.current.redo()`.
  - **insertText:** `editorRef.current.insertText(text)`.
  - **updateBody:** `editorRef.current.updateBody(newBody)`.
  - **focus:** `editorRef.current.execCommand(EditorCommandType.Focus)`.
  - **hideKeyboard:** uses `webviewRef.current.injectJS('document.activeElement?.blur();')`.
  - Plus search, link dialog, selection, scroll, etc.
- So the **same** EditorCommandType and command set from `@joplin/editor` are used; only the transport is “ref → messenger → WebView” instead of direct DOM.

---

## 7. Shared Editor Package (@joplin/editor)

- **packages/editor** defines:
  - **EditorCommandType** (e.g. ToggleBolded, ToggleItalicized, IndentMore, Undo, Redo, Focus).
  - **Events** (ChangeEvent, SelectionRangeChangeEvent, UndoRedoDepthChangeEvent, etc.).
  - **EditorControl / MainProcessApi**-style interfaces used by both desktop and mobile.
- On **desktop**, the editor runs in the main window; the ref is a direct handle to the CodeMirror/editor instance.
- On **mobile**, the ref is the object returned by the messenger’s remote API; every call is serialized and sent to the WebView, where the **same** CodeMirror and editor command logic run inside the injected bundle.

---

## 8. Summary Table: Joplin Mobile vs Typical “Inline HTML + CDN” Approach

| Aspect | Joplin app-mobile | Inline HTML + CDN (e.g. esm.sh) |
|--------|-------------------|----------------------------------|
| **HTML source** | Written to a **file**; WebView loads `file://...` | `source={{ html: "...", baseUrl: "about:blank" }}` |
| **Origin** | `file://` (concrete) | Opaque / origin-less |
| **CodeMirror load** | **Pre-bundled** script injected via `shim.injectedJs('markdownEditorBundle')` | Often dynamic `import('https://esm.sh/...')` in the page |
| **Android** | Usually works: same-origin script, no CDN in WebView | Often fails: MIME, CORS, or security on module scripts |
| **Offline** | Editor works offline after install (bundle is local) | Depends on CDN and cache |

---

## 9. Takeaways for Implementing a CodeMirror Editor in RN

1. **Pre-bundle the editor** for mobile (e.g. Gulp/Webpack build that outputs a single script). Inject that script into the WebView; do not rely on dynamic `import()` from a CDN inside the WebView on Android.
2. **Prefer loading the WebView from a file** (write HTML to temp dir, load `file://...`) so the WebView has a well-defined origin. If you must use inline HTML, be aware of Android limitations with external script loading.
3. **Single ref / control object** on the RN side that mirrors the desktop editor API (undo, redo, insertText, execCommand, etc.) and forwards to the WebView via postMessage/injectJS.
4. **Bidirectional messaging:** WebView → RN for events (change, selection, undo/redo depth); RN → WebView for commands and body/settings updates.
5. **Reuse the same command and event types** (e.g. EditorCommandType, events from @joplin/editor) so desktop and mobile stay in sync and one code path can drive both.

---

## 10. References

- **Joplin app-mobile (dev):** [github.com/laurent22/joplin/tree/dev/packages/app-mobile](https://github.com/laurent22/joplin/tree/dev/packages/app-mobile)
- **ExtendedWebView:** `packages/app-mobile/components/ExtendedWebView/`
- **NoteEditor / MarkdownEditor:** `packages/app-mobile/components/NoteEditor/`
- **markdownEditorBundle:** `packages/app-mobile/contentScripts/markdownEditorBundle/`
- **Note screen:** `packages/app-mobile/components/screens/Note/Note.tsx`
- **Joplin CodeMirror plugin tutorial:** [Creating a Markdown editor plugin (CodeMirror 6)](https://joplinapp.org/help/api/tutorials/cm6_plugin)

---

## 11. Applied in this app (gopx-drive)

This app now follows the same approach:

- **Pre-bundled editor:** `assets/editor/editorEntry.ts` is bundled with esbuild via `npm run build:editor`. Output is `assets/editor/editorBundle.generated.ts` (exported string). No CDN in the WebView.
- **Loading strategy:** We use **inline HTML** (`source={{ html: EDITOR_SHELL_HTML, baseUrl: "about:blank" }}`) rather than file-based loading. On Android, `injectedJavaScript` often does **not** run when the WebView source is a `file://` URI (see [react-native-webview#656](https://github.com/react-native-webview/react-native-webview/issues/656), [#3365](https://github.com/react-native-webview/react-native-webview/issues/3365)). So we keep the pre-bundled editor (no CDN) but load via inline HTML so the injected bundle runs reliably.
- **Minimal HTML:** `EDITOR_SHELL_HTML` in `assets/editor/editorShellHtml.ts` contains only structure and styles; the editor is created by the injected bundle.
- **Injected script:** `injectedJavaScript={EDITOR_BUNDLE + '\ntrue;'}` runs the pre-bundled CodeMirror + bridge in the WebView. Same message protocol (init, setValue, execCommand, change, selectionChange, bridgeReady).
- **Build:** Run `npm run build:editor` after changing `editorEntry.ts`; the generated file is committed so the app works without running the build on every clone.
