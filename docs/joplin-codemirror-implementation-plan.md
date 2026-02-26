## Implementing Joplin’s CodeMirror Strategy in This App

This document maps the ideas from `research-joplin-codemirror-markdown-editor.md` onto this project and gives **concrete steps** to use **CodeMirror 6** for Markdown editing on both **web** and **native**.

The goal is to end up with:

- **One shared editor core** (analogous to Joplin’s `packages/editor`).
- **The same command layer** used by:
  - Web (Expo Router / `Platform.OS === "web"`).
  - Native (iOS/Android) via a WebView.

---

### 1. Map Joplin’s Structure to This Repo

From the current tree:

- Current markdown editor abstraction:
  - `components/markdown-editor/index.ts`
  - `components/markdown-editor/hooks/*`
  - `components/markdown-editor/utils/*`
- Note list & navigation:
  - `app/(app)/notes.tsx`
  - `app/(app)/note/[id].tsx`
- Shared logic:
  - `lib/*` (Supabase, toolbar preferences, markdown utils, etc.)

**Joplin → This project mapping:**

- **Joplin `packages/editor`**  
  → **`lib/editor` (new)**: shared CodeMirror 6 setup, editor commands, types.

- **Joplin `packages/editor/CodeMirror/editorCommands/editorCommands.ts`**  
  → **`lib/editor/editorCommands.ts` (new)**: all edit operations (bold, headings, lists, etc.) live here, not in screens.

- **Joplin `app-desktop` + hooks like `useEditorCommands.ts`**  
  → **`components/markdown-editor`** and screens like `app/(app)/note/[id].tsx` for web.

- **Joplin `app-mobile` (React Native + WebView)**  
  → **This app’s iOS/Android targets**, using a **WebView-powered editor screen**.

---

### 2. Create a Shared Editor Core (`lib/editor`)

Create a new module `lib/editor` to mirror Joplin’s `packages/editor` responsibility.

**Files to add:**

- `lib/editor/types.ts`
  - Define editor-facing types:
    - `EditorHandle` (minimal API the rest of the app uses).
    - `EditorCommandType` (string or enum of commands, e.g. `"ToggleBold"`, `"ToggleHeading1"`, `"InsertLink"`, etc.).
    - `EditorInitOptions` (initial text, readOnly, callbacks).

- `lib/editor/editorCommands.ts`
  - Implement a command layer similar to Joplin’s `editorCommands.ts`.
  - Responsibilities:
    - Receive `(view, state, dispatch, ...args)` from CodeMirror.
    - Perform structural markdown edits (toggle bold, headings, lists, checkbox lines, etc.).
    - Export a single function:
      - `execEditorCommand(view, type: EditorCommandType, args?: any)` that:
        - Switches on `type` and calls the right CodeMirror command.

- `lib/editor/createEditor.ts`
  - Function `createEditor(domElement: HTMLElement, options: EditorInitOptions): EditorHandle`.
  - Internally:
    - Builds a CodeMirror 6 `EditorView` with:
      - Basic extensions (keyboard shortcuts, history, line wrapping).
      - Markdown language support (`@codemirror/lang-markdown`), including fenced code blocks.
      - Theme that matches `THEME` / `useThemeColors`.
      - Wiring of `change` events → callback to your app (to save note content).
    - Stores a map from `EditorHandle` or `EditorView` to be used from `execEditorCommand`.

- `lib/editor/theme.ts` (optional but recommended)
  - Encapsulate CodeMirror-specific theming and map it to your design tokens (`THEME`, `useThemeColors`).

This module should:

- Know **CodeMirror 6** and **Markdown**.
- Know **nothing** about React Native, Expo Router, Supabase, or your UI components.

---

### 3. Wire the Web Editor to the Shared Core

For the **web** renderer (`Platform.OS === "web"`), we can call `createEditor` directly from React components.

**Steps:**

1. **Extend `components/markdown-editor/index.ts`**
   - Treat this as the main public editor component.
   - Inside it:
     - Render a `View` that contains an inner `div` only rendered on web:
       - Example: use `Platform.OS === "web"` to render a `div` with a `ref` (`editorRootRef`).
     - Use `useEffect` (web-only) to:
       - Call `createEditor(editorRootRef.current, { initialText, onChange, ... })`.
       - Store the returned `EditorHandle` in a ref.
     - Expose callbacks to the toolbar that map to `EditorCommandType` and call `editorHandle.execCommand(...)`.

2. **Connect `markdown-toolbar.tsx`**
   - Currently your toolbar already exists (`components/markdown-toolbar.tsx`).
   - Change it so that buttons don’t directly mutate text; instead they call a prop like `onCommand(EditorCommandType.ToggleBold)`.
   - In the parent (`components/markdown-editor/index.ts`), implement `onCommand` as:
     - `editorHandle.execCommand(cmd)` for web.
     - (Later) message to WebView for native.

3. **Note detail screen usage**
   - In `app/(app)/note/[id].tsx`, where you render your editor:
     - Replace any direct `TextInput`-style editor usage with the `MarkdownEditor` component.
     - Pass it:
       - `value` (note body),
       - `onChange` callback for saving,
       - configuration (readOnly, focus control, etc.).

Result: **web** uses CodeMirror 6 directly via `lib/editor/createEditor.ts`, but only through the `MarkdownEditor` abstraction.

---

### 4. Design a Cross-Platform Command API

To mirror Joplin’s “editor commands” concept, keep **all editing operations centralized** and platform-agnostic.

**Design:**

- `EditorCommandType` (in `lib/editor/types.ts`), e.g.:
  - `ToggleBold`
  - `ToggleItalic`
  - `ToggleHeading(level)`
  - `ToggleChecklist`
  - `InsertLink`
  - `ToggleCodeBlock`
  - etc.

- `execEditorCommand` in `lib/editor/editorCommands.ts`:
  - Given an `EditorView` and a command, performs the appropriate CodeMirror modification.
  - This is where you implement the markdown transforms.

- `EditorHandle` from `createEditor`:
  - Wraps `EditorView` and exposes:
    - `execCommand(type: EditorCommandType, args?: any): void`
    - `getValue(): string`
    - `setValue(text: string): void`
    - (Optional) selection helpers if needed.

Then:

- **Web**:
  - Toolbar → `EditorHandle.execCommand`.
- **Native**:
  - Toolbar → send `EditorCommandType` to WebView → JS in WebView calls the same `execEditorCommand`.

This is conceptually the same as Joplin’s `editorRef.current.execCommand(EditorCommandType.SomeCommand, ...)`.

---

### 5. Implement the Native Editor via WebView

On **iOS/Android**, CodeMirror 6 runs best inside a **WebView**. That mirrors Joplin’s approach.

#### 5.1. Create an HTML/JS Editor Shell

Add a minimal web-based editor shell that:

- Loads the same editor code used on web (`lib/editor/createEditor`, `lib/editor/editorCommands`).
- Exposes a small `window` API for:
  - Initializing the editor with text.
  - Executing commands.
  - Emitting change events back to React Native.

Implementation options (pick one):

- **Option A: Static HTML in assets**
  - Create `assets/editor/index.html` + `assets/editor/index.js`.
  - Build `index.js` using your bundler (e.g. Metro for web or a small Vite/Rollup build) that imports `createEditor` from `lib/editor`.
  - The HTML mounts CodeMirror into a `<div id="root"></div>` and attaches `window.EditorBridge = { init, execCommand }`.

- **Option B: Hosted editor**
  - Host the same editor bundle on a small static site (e.g. Vercel).
  - WebView loads `https://your-domain/editor.html?noteId=...`.
  - Message bridge stays the same; only URL differs.

#### 5.2. Add a Native Editor Screen Component

Create a new screen / component, e.g.:

- `components/EditorWebView.tsx` or `app/(app)/note/[id]/editor-webview.tsx`.

Responsibilities:

- Use `react-native-webview` (add dependency if not already present).
- Load the editor shell:
  - Either local file (`require('assets/editor/index.html')`) or remote URL.
- On mount:
  - Pass initial markdown content to the WebView (`postMessage` or `injectedJavaScript` to call `window.EditorBridge.init(content)`).
- Listen for `onMessage` events:
  - Expect messages like `{ type: 'change', text: '...' }`.
  - Call your existing note update logic (e.g. `updateNote` / local state).

#### 5.3. Command Bridge (Toolbar ↔ WebView)

Connect the existing toolbar (`markdown-toolbar.tsx`) to the WebView:

- On native platforms, instead of calling `EditorHandle.execCommand`, do:
  - `webviewRef.current?.postMessage(JSON.stringify({ type: 'execCommand', command: EditorCommandType.ToggleBold, args: null }))`.

- In the WebView JS (editor shell):
  - Listen for `message` events.
  - When you receive `{ type: 'execCommand', command, args }`:
    - Call `EditorBridge.execCommand(command, args)` which internally uses CodeMirror’s `EditorView` and `execEditorCommand`.

Result: the **same command IDs** and logic are used for web and native, only the transport differs (function call vs. `postMessage`).

---

### 6. Integrate with Existing Screens

Tie this into current navigation:

- `app/(app)/note/[id].tsx`:
  - Detect platform:
    - **Web**: render the `MarkdownEditor` that mounts CodeMirror directly.
    - **Native**: navigate/present an `EditorWebView` screen, or make `MarkdownEditor` internally choose between:
      - Web mode: CodeMirror in DOM.
      - Native mode: WebView editor.

- `app/(app)/notes.tsx`:
  - No changes needed, except ensuring note detail navigation goes to the new editor implementation.

This mimics Joplin’s separation:

- Shared editor logic in one place.
- Platform-specific shell/wiring living in each app (web/native).

---

### 7. Future: Plugin-Like Extensions (Optional)

If you later want a plugin-like system similar to Joplin’s `ContentScriptType.CodeMirrorPlugin`:

- Keep the **core editor** in `lib/editor`.
- Expose a hook or registration method:
  - `registerEditorExtension(extensionFactory)` that returns a CodeMirror extension.
- At startup, build the editor config as:
  - Base extensions + all registered extensions.
- On native, ensure the same extension list is used when bundling the editor shell.

This would let you add features (snippets, autocomplete, custom syntax highlighting) without touching `createEditor` each time.

---

### 8. Summary

- **Shared core**: Create `lib/editor` with `createEditor`, `editorCommands`, `EditorCommandType`, and `EditorHandle`.
- **Web**: `components/markdown-editor` uses `createEditor` directly; toolbar calls `EditorHandle.execCommand`.
- **Native**: Add a WebView-based editor shell that runs the same CodeMirror 6 code; toolbar sends commands over `postMessage` to the shell, which runs `execEditorCommand`.
- This mirrors **Joplin’s architecture**: one editor package, shared commands, desktop/web using direct API calls, and mobile using a WebView + command bridge.

