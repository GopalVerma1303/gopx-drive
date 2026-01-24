## Purpose

This file is a **command/spec for any AI code writer** to implement a **Joplin-style CodeMirror 6 editor in a React Native WebView** in this repo.

Target repo: `gopx-drive` (Expo + React Native).

You must replicate the **architecture and patterns** Joplin uses (WebView shell + locally injected JS bundle + RN↔︎WebView RPC bridge + CodeMirror 6 editor control API), adapted to the existing editor entrypoints in this repo:

- `components/markdown-editor.tsx`
- `components/markdown-editor-webview-html.ts`

Do **not** use remote CDNs for CodeMirror (no `esm.sh`, `unpkg`, etc). The editor must work **offline**.

---

## Copy/paste prompt (for AI implementers)

Implement Joplin’s mobile CodeMirror architecture in this repository.

### Goal

Replace the current native WebView editor (which loads CM6 from `esm.sh`) with a Joplin-style setup:

- WebView loads a minimal HTML shell.
- A **locally bundled** JS “editor bundle” is injected (no network).
- RN and the WebView communicate via a **request/response RPC bridge** (not ad-hoc messages).
- RN holds an `EditorControl` that can `setValue`, `getSelection`, `select`, `insertText`, `execCommand`, `focus`, and emits events for change/selection/scroll/errors.

Preserve the public API of `MarkdownEditorRef` in `components/markdown-editor.tsx` and keep the web path (`Platform.OS === "web"`) working.

### References (architecture to match)

Use these Joplin files as the blueprint (do not copy blindly; adapt):

- Markdown editor RN wrapper: `packages/app-mobile/components/NoteEditor/MarkdownEditor.tsx`
- WebView setup hook: `packages/app-mobile/contentScripts/markdownEditorBundle/useWebViewSetup.ts`
- WebView content script entry: `packages/app-mobile/contentScripts/markdownEditorBundle/contentScript.ts`
- CodeMirror 6 editor implementation: `packages/editor/CodeMirror/createEditor.ts`
- WebView wrapper: `packages/app-mobile/components/ExtendedWebView/index.tsx`

---

## Current state (what exists today in this repo)

- `components/markdown-editor.tsx` uses a WebView on native:
  - `source={{ html: getMarkdownEditorWebViewHtml() }}`
  - ad-hoc messages: `"ready"`, `"init"`, `"change"`, `"selection"`, `"error"`, `"setValue"`, `"setTheme"`, `"setPlaceholder"`, `"insertText"`, `"wrapSelection"`, `"focus"`
- `components/markdown-editor-webview-html.ts` currently imports CodeMirror 6 modules from `https://esm.sh/...` (must be removed).

---

## Required outcome (definition of done)

- **No CDN usage** from the WebView editor (search must find zero occurrences of `esm.sh`, `unpkg`, etc in the WebView path).
- CodeMirror 6 is bundled locally and injected into the WebView.
- Messaging is RPC-style (request id + response) with typed methods.
- Native editor still supports:
  - `insertText(text, cursorOffset?)`
  - `wrapSelection(before, after, cursorOffset?)`
  - `focus()`
  - `getSelection() -> { start, end }`
  - controlled value updates from RN (`value` prop) without cursor jumps
  - theme updates (dark/light and spacing)
  - graceful fallback to plain editor on fatal WebView errors
- `Platform.OS === "web"` continues to use the existing web CodeMirror implementation.

---

## Implementation plan (do these steps in order)

### 1) Add an RPC messenger (RN↔︎WebView)

Create a small RPC layer modeled after Joplin:

- **New files**
  - `lib/ipc/RNToWebViewMessenger.ts`
  - `lib/ipc/WebViewToRNMessenger.ts`
  - `lib/ipc/types.ts`

**Protocol shape (minimum)**

- Requests from RN → WebView:
  - `{ kind: "rpc", id: string, method: string, args: unknown[] }`
- Responses WebView → RN:
  - `{ kind: "rpc:result", id: string, result: unknown }`
  - `{ kind: "rpc:error", id: string, error: { message: string, stack?: string } }`
- Events WebView → RN (no response):
  - `{ kind: "event", type: "change" | "selection" | "scroll" | "ready" | "log" | "error", payload: any }`

**Rules**

- Always JSON serialize messages.
- The RN messenger must queue outbound calls until the WebView is marked “ready/loaded”.
- Include robust error handling and timeouts (fail fast and trigger fallback).

### 2) Bundle CodeMirror + “editor glue” locally (no network)

Create a dedicated “webview bundle” entry file that exports a global like Joplin:

- **New folder**: `webviewBundles/markdownEditorBundle/`
  - `webviewBundles/markdownEditorBundle/index.ts` (entry)
  - `webviewBundles/markdownEditorBundle/contentScript.ts` (editor glue: create editor, wire events, register RPC)

**Bundle requirements**

- Output must be a single JS string (or local file) that can be executed inside the WebView.
- It must set a global, e.g.:
  - `window.markdownEditorBundle = { createMainEditor, createEditorWithParent, setUpLogger? }`
- Do not depend on Node APIs at runtime.

**Build wiring (choose one)**

- Option A (recommended): add a Node script that runs `esbuild` and generates:
  - `webviewBundles/generated/markdownEditorBundle.generated.ts` exporting:
    - `export const markdownEditorBundleJs = "..."`;
- Option B: bundle to `assets/markdownEditorBundle.js` and load it via `baseUrl`/file access.

Add `package.json` scripts (names can vary):

- `build:webview-bundles`
- `watch:webview-bundles`

### 3) Replace `components/markdown-editor-webview-html.ts` with a minimal shell

Update `getMarkdownEditorWebViewHtml()` to return **only**:

- `<div class="CodeMirrorRoot"></div>` (or existing root)
- minimal CSS resets
- **no `type="module"` imports**
- a tiny boot script that posts `{ kind: "event", type: "ready" }` when DOM is available

All CodeMirror logic must move into the injected bundle from step 2.

### 4) Create a WebView wrapper (Joplin-style) OR enhance current WebView usage

Joplin writes HTML to a local file and loads `file://...` to allow consistent base URLs and cache-busting.

Implement one of:

- **Option A (closer to Joplin)**: create `components/ExtendedWebView.tsx` that:
  - writes HTML to a file (use `expo-file-system` on Expo)
  - loads `file://...?.r=<random>` to force reload
  - provides `injectJS(js)` with try/catch and always returns `true;`
  - reloads WebView on crash (`onRenderProcessGone` / `onContentProcessDidTerminate`)
- **Option B (minimal)**: keep `source={{ html }}` but still implement:
  - safe `injectJS`
  - crash reload handling
  - a reliable “onLoadEnd → inject after load” flow

### 5) Refactor native `components/markdown-editor.tsx` to use the new architecture

Keep the public API (`MarkdownEditorRef`) unchanged, but change internals:

- On native (non-web):
  - Load the minimal HTML shell.
  - Inject the generated bundle JS string.
  - After load, call `window.markdownEditorBundle.createMainEditor(...)`.
  - Create an `editorControl` object (like Joplin’s `EditorControl`) that proxies calls via RPC:
    - `setValue`, `getSelection`, `select`, `insertText`, `wrapSelection`, `focus`, `execCommand` (optional)
  - Convert existing ad-hoc message handlers into:
    - RPC results routing
    - event routing for `change`, `selection`, `error`

**Backwards-compat**

- During transition, you may keep supporting the old message shapes (`{ type: "change" ... }`) but the final desired protocol is RPC + event.

### 6) Implement the WebView “content script” side (editor glue)

In the bundle’s `contentScript.ts`:

- Create the CodeMirror 6 editor (use `@codemirror/*` packages).
- Wire events:
  - doc changes → emit `{ kind:"event", type:"change", payload:{ value } }`
  - selection changes → emit `{ kind:"event", type:"selection", payload:{ start, end } }`
  - scroll changes → emit `{ kind:"event", type:"scroll", payload:{ fraction } }`
- Register RPC methods:
  - `setValue(value)`
  - `getSelection()`
  - `select(start, end)`
  - `insertText(text, cursorOffset?)`
  - `wrapSelection(before, after, cursorOffset?)`
  - `focus()`
  - (optional) `updateSettings(theme/settings object)`

Follow Joplin’s safety patterns:

- guard against multiple initialization (Android can run injected JS more than once)
- only create the editor if the parent element exists
- set `window.onerror`/`unhandledrejection` to forward errors to RN

### 7) Theme + CSS

- Keep your current theme variables (background/foreground/selection/padding/font size).
- Update theme via an RPC call (`updateSettings` / `setTheme`) instead of raw messages.
- Ensure the WebView background matches `editorTheme.background` to avoid flashes.

---

## Acceptance checklist for the implementer

- [ ] `components/markdown-editor-webview-html.ts` contains **no** remote imports.
- [ ] A generated/bundled JS file exists locally for WebView injection.
- [ ] Native editor uses RPC bridge to control CodeMirror.
- [ ] `insertText`, `wrapSelection`, `focus`, `getSelection` work on iOS + Android.
- [ ] Controlled updates (`value` prop changes) do not reset cursor/selection.
- [ ] Errors in WebView trigger fallback (`forcePlainEditor`) and do not crash the app.

---

## Notes / gotchas (from Joplin’s approach)

- Android WebView can execute injected JS multiple times; always guard initialization.
- If you allow plugins later, prefer a file-based `file://` load so assets resolve consistently.
- Consider disabling CodeMirror’s EditContext on Android if you hit input issues (Joplin does this in `packages/editor/CodeMirror/createEditor.ts`).
