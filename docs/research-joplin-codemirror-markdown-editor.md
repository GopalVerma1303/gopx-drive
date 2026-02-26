# Research: How Joplin Uses CodeMirror as Its Markdown Editor (Web & Mobile)

This document summarizes how [Joplin](https://github.com/laurent22/joplin) uses **CodeMirror** for its markdown note-taking editor across **desktop (web-based)** and **mobile** applications.

---

## 1. Overview

- **Joplin** is an open-source note-taking app (53k+ GitHub stars) that stores notes in **Markdown**.
- The **markdown editor** is built on **CodeMirror 6** (since Joplin 3.1.x; earlier versions used CodeMirror 5).
- The same editor logic is **shared** between desktop and mobile via a dedicated `packages/editor` package; mobile runs the editor inside a **WebView**, while desktop uses it in a normal browser/Electron context.

---

## 2. CodeMirror Version and Adoption

| Aspect | Details |
|--------|---------|
| **Current editor** | CodeMirror 6 |
| **Default since** | Joplin 3.1.x (desktop); earlier betas could be enabled in Settings > General |
| **Legacy** | CodeMirror 5 was the previous editor; Joplin still has a **CodeMirror 5 emulation layer** for backward compatibility with some plugins |
| **Plugin docs** | Joplin recommends new plugins target **CodeMirror 6**; CM5 support is for older Joplin versions only |

---

## 3. Repository and Package Layout

Joplin is a **monorepo** (Lerna + Yarn workspaces). Editor-related code lives under:

```
packages/
├── editor/                    # Shared editor package (used by desktop & mobile)
│   ├── CodeMirror/            # CodeMirror 6 integration
│   │   ├── CodeMirror5Emulation/
│   │   ├── editorCommands/    # Shared editor commands (see below)
│   │   ├── extensions/
│   │   ├── pluginApi/
│   │   ├── vendor/
│   │   ├── CodeMirrorControl.ts
│   │   ├── createEditor.ts
│   │   ├── configFromSettings.ts
│   │   ├── theme.ts
│   │   └── ...
│   ├── ProseMirror/            # Alternative/legacy editor path
│   ├── SelectionFormatting.ts
│   ├── events.ts
│   └── types.ts
├── app-desktop/               # Electron desktop app (uses editor in browser context)
├── app-mobile/                # React Native app (uses editor in WebView)
├── renderer/                  # Markdown → HTML rendering (e.g. markdown-it, KaTeX, Mermaid)
└── ...
```

- **`packages/editor`** holds the core editor logic and CodeMirror setup.
- **Desktop** uses this via the normal DOM (e.g. in `NoteBody/CodeMirror/v6/useEditorCommands.ts`).
- **Mobile** loads the same editor bundle inside a **WebView**, so the CodeMirror instance runs in the WebView’s JavaScript context.

---

## 4. Shared Editor Commands (Web + Mobile)

Editor behavior is unified through **editor commands**:

| Location | Role |
|----------|------|
| `packages/editor/CodeMirror/editorCommands/editorCommands.ts` | **Single source of truth** for CodeMirror commands; shared by **both mobile and desktop** |
| `packages/app-mobile/components/screens/Note/commands` | **Note screen commands** that run in the main React Native context (not inside the editor WebView) |

**On mobile:**

- **CodeMirror commands** run **inside the editor WebView**, so they have direct access to the CodeMirror API.
- The host app communicates with the WebView (e.g. via `editor.execCommand`) to trigger these commands.

**On desktop:**

- The note editor uses hooks like `useEditorCommands.ts` (e.g. under `NoteBody/CodeMirror/v6/`) which register command handlers.
- To keep behavior aligned with mobile, new commands are implemented in `packages/editor` and invoked via:
  - `editorRef.current.execCommand(EditorCommandType.SomeCommand, ...args)`

So: **one command set** in `packages/editor/CodeMirror/editorCommands/`, used on **desktop (direct ref)** and **mobile (via WebView + execCommand)**.

---

## 5. How the Editor Is Used on Each Platform

### 5.1 Desktop (Electron / Web)

- The desktop app (Electron) embeds the shared editor in a normal web view.
- CodeMirror 6 is created and configured via `packages/editor` (e.g. `createEditor.ts`, `CodeMirrorControl.ts`).
- Commands are wired through `useEditorCommands.ts` and call into `editorRef.current.execCommand(...)` so the same command IDs and behavior are used as on mobile.
- Plugins can extend the editor via **CodeMirror 6 content scripts** (see below).

### 5.2 Mobile (React Native)

- The note editor runs inside a **WebView**.
- The **same editor bundle** (from `packages/editor`) is loaded in that WebView, so the same CodeMirror 6 instance and command set run as on desktop.
- The React Native app does **not** have direct access to CodeMirror; it sends messages (e.g. `editor.execCommand`) into the WebView, which then runs the command in `editorCommands.ts`.
- Toolbar or UI actions on mobile are implemented as **note screen commands** (React Native) that ultimately call into the WebView’s editor commands.

This design gives:

- **One codebase** for the markdown editor and its commands.
- **Same behavior** on desktop and mobile.
- **Pluggable** editor extensions (CodeMirror 6 plugins) that work in both environments because they run inside the same editor runtime (browser on desktop, WebView on mobile).

---

## 6. CodeMirror 6 Plugin System (Joplin’s Use)

Joplin exposes the CodeMirror 6 editor to **plugins** via a **content script** API:

1. **Content script type**: `ContentScriptType.CodeMirrorPlugin`
2. **Registration**: Plugins register a script (e.g. `contentScript.ts` → built to `contentScript.js`) in `plugin.config.json` under `extraScripts`, and register it with:
   - `joplin.contentScripts.register(ContentScriptType.CodeMirrorPlugin, contentScriptId, './contentScript.js')`
3. **Extension injection**: The content script receives a **CodeMirror wrapper** and adds CM6 extensions:
   - `codeMirrorWrapper.addExtension(someExtension())`
   - Example extensions: `lineNumbers()`, `highlightActiveLine()` from `@codemirror/view`
4. **Avoiding duplicate CodeMirror**: Plugins must **not** bundle their own copy of CodeMirror (e.g. `@codemirror/view`, `@codemirror/state`). Joplin’s generator provides a **webpack config** that marks these as externals so the plugin uses the app’s single CodeMirror instance. Bundling a second copy breaks `instanceof` and extension checks.
5. **Main script ↔ content script**: Settings and other app state live in the main plugin script; the content script gets them via `context.postMessage('getSettings')` and `joplin.contentScripts.onMessage`. Alternatively, plugins can register **editor commands** and reconfigure extensions (e.g. via Compartment) when settings change.

Plugins written this way work on **both mobile and desktop** because they run inside the same CodeMirror 6 environment (desktop: main window; mobile: WebView).

---

## 7. Key Technical Details

### 7.1 Creating the Editor

- **Entry points**: `packages/editor/CodeMirror/createEditor.ts`, `CodeMirrorControl.ts`.
- **Configuration**: Options and theme are derived from app settings (e.g. `configFromSettings.ts`, `theme.ts`).
- **CodeMirror 5 emulation**: The `CodeMirror5Emulation` folder and compatibility layer allow older plugins written for CM5 to still run; new plugins should target CM6.

### 7.2 Markdown and Rendering

- **Editing**: Raw markdown is edited in CodeMirror (plain text with optional syntax highlighting).
- **Rendering**: A separate pipeline (e.g. in `packages/renderer`) converts markdown to HTML (CommonMark + plugins: KaTeX, Mermaid, tables, etc.). So the **editor** is CodeMirror (source text); the **preview** is rendered HTML.
- Joplin follows **CommonMark** plus extensions (see official Markdown guide in the repo).

### 7.3 Plugin Build Requirements

- Use the **latest webpack config** from Joplin’s generator so CodeMirror packages are externalized.
- Install `@codemirror/view` (and any other CM packages) as **dev dependencies** for types only; they must not be bundled.
- If the app and plugin load different copies of `@codemirror/state`, extensions can fail with errors like: “Unrecognized extension value… This sometimes happens because multiple instances of @codemirror/state are loaded.”

---

## 8. Summary Table

| Topic | Web (Desktop) | Mobile |
|--------|----------------|--------|
| **Runtime** | Browser (Electron) | WebView (React Native) |
| **Editor package** | `packages/editor` | Same `packages/editor` |
| **CodeMirror version** | CodeMirror 6 | CodeMirror 6 |
| **Editor commands** | `editorCommands.ts` via `editorRef.current.execCommand(...)` | Same `editorCommands.ts` via WebView message → `execCommand` |
| **Plugin content scripts** | Loaded in main window | Loaded in editor WebView |
| **Shared logic** | Yes | Yes (same bundle in WebView) |

---

## 9. References

- **Joplin repo**: [github.com/laurent22/joplin](https://github.com/laurent22/joplin)
- **Creating a Markdown editor plugin (CodeMirror 6)**: [joplinapp.org/help/api/tutorials/cm6_plugin](https://joplinapp.org/help/api/tutorials/cm6_plugin/)
- **Editor commands spec**: [joplinapp.org/help/dev/spec/editor_commands](https://joplinapp.org/help/dev/spec/editor_commands)
- **CodeMirror 6**: [codemirror.net](https://codemirror.net/)
- **Joplin Markdown guide**: `readme/apps/markdown.md` in the repo (CommonMark, KaTeX, Mermaid, etc.)
- **Example CM6 plugin in repo**: `packages/app-cli/tests/support/plugins/codemirror6`
- **Example CM5+CM6 dual plugin**: `packages/app-cli/tests/support/plugins/codemirror5-and-codemirror6`

---

*Document generated from public Joplin documentation and repository structure. Last updated: February 2025.*
