# Joplin CodeMirror Integration - Key Files Reference

## File Structure & Responsibilities

### React Native Layer (Mobile App)

#### 1. `components/NoteEditor/NoteEditor.tsx`
**Role**: Main editor component that orchestrates everything
- Manages editor state (selection, formatting, search)
- Handles editor events from WebView
- Provides `EditorControl` API to parent components
- Chooses between `MarkdownEditor` and `RichTextEditor`

**Key Exports**:
- `EditorControl` interface with methods like `insertText()`, `undo()`, `focus()`, etc.

#### 2. `components/NoteEditor/MarkdownEditor.tsx`
**Role**: Sets up WebView for markdown editing
- Generates HTML with `<div class="CodeMirror"></div>`
- Injects `markdownEditorBundle` JavaScript
- Applies CSS theming
- Handles WebView messages and errors

**Key Code**:
```typescript
const html = useHtml(); // Returns HTML with CodeMirror div
const injectedJavaScript = `...${editorWebViewSetup.pageSetup.js}...`;
```

#### 3. `components/ExtendedWebView/index.tsx`
**Role**: Wrapper around `react-native-webview`
- Writes HTML to file system (required for `file://` protocol)
- Provides `injectJS()` and `postMessage()` methods
- Handles WebView crashes and reloads
- Injects CSS dynamically

**Key Methods**:
- `injectJS(script: string)`: Execute JavaScript in WebView
- `postMessage(message: any)`: Send message to WebView

### WebView Content Scripts

#### 4. `contentScripts/markdownEditorBundle/useWebViewSetup.ts`
**Role**: React hook that sets up editor in WebView
- Loads JavaScript bundle
- Creates editor after WebView loads
- Sets up bidirectional messaging
- Manages initial state (selection, scroll, search)

**Key Pattern**:
```typescript
const afterLoadFinishedJs = useRef(() => `
  window.cm = markdownEditorBundle.createMainEditor(...);
`);
```

#### 5. `contentScripts/markdownEditorBundle/contentScript.ts`
**Role**: JavaScript that runs inside WebView
- Creates CodeMirror editor instances
- Sets up event handlers
- Manages messaging with React Native

**Key Functions**:
- `createMainEditor(props)`: Creates main editor
- `createEditorWithParent(props)`: Creates editor with parent element

### Editor Package

#### 6. `packages/editor/CodeMirror/createEditor.ts`
**Role**: Core CodeMirror 6 integration
- Creates `EditorView` instance
- Configures CodeMirror extensions
- Sets up keyboard shortcuts
- Handles events (change, selection, scroll)

**Key CodeMirror 6 Usage**:
```typescript
import { EditorView, EditorState } from '@codemirror/view';
const editor = new EditorView({
  state: EditorState.create({ extensions: [...], doc: initialText }),
  parent: parentElement,
});
```

## Communication Flow

### React Native → WebView

**Method**: `webviewRef.current.injectJS(script)`

**Examples**:
```typescript
// Update content
injectJS(`cm.updateBody(${JSON.stringify(newText)});`);

// Execute command
injectJS(`cm.execCommand('focus');`);

// Update settings
injectJS(`cm.updateSettings(${JSON.stringify(settings)});`);
```

### WebView → React Native

**Method**: `window.ReactNativeWebView.postMessage(JSON.stringify(data))`

**Examples**:
```typescript
// Send editor event
postMessage(JSON.stringify({
  type: 'editorEvent',
  event: { kind: 'Change', value: text }
}));

// Send error
postMessage('error: ' + errorMessage);
```

## Key Dependencies

```json
{
  "@joplin/editor": "~3.6",              // Editor package
  "react-native-webview": "13.16.0",    // WebView component
  "@codemirror/state": "...",           // CodeMirror state
  "@codemirror/view": "...",            // CodeMirror UI
  "@codemirror/commands": "...",        // Commands
  "@codemirror/search": "...",          // Search
  "@codemirror/language": "..."         // Syntax highlighting
}
```

## Setup Sequence

1. **NoteEditor** renders **MarkdownEditor**
2. **MarkdownEditor** creates HTML and JavaScript
3. **ExtendedWebView** writes HTML to file system
4. **WebView** loads HTML from `file://` URI
5. **Injected JavaScript** runs and loads `markdownEditorBundle`
6. **markdownEditorBundle** calls `createMainEditor()`
7. **createEditor()** creates CodeMirror instance
8. **Editor** sends events back via `postMessage`
9. **React Native** receives events and updates state

## Important Patterns

### 1. HTML File Storage
```typescript
// Write to file system
const tempFile = `${baseDirectory}/${webviewInstanceId}.html`;
await writeFile(tempFile, html, 'utf8');

// Load with cache busting
const source = {
  uri: `file://${tempFile}?r=${Math.random()}`,
  baseUrl: `file://${baseDirectory}`
};
```

### 2. JavaScript Bundle Injection
```typescript
// Store bundle globally to avoid re-injection
if (typeof window.markdownEditorBundle === 'undefined') {
  ${shim.injectedJs('markdownEditorBundle')};
  window.markdownEditorBundle = markdownEditorBundle;
}
```

### 3. Editor Creation After Load
```typescript
onLoadEnd={() => {
  webviewRef.current?.injectJS(`
    if (!window.cm) {
      window.cm = markdownEditorBundle.createMainEditor(...);
    }
  `);
}}
```

### 4. Bidirectional Messaging
```typescript
// React Native side
const messenger = new RNToWebViewMessenger('markdownEditor', webviewRef, {
  async onEditorEvent(event) {
    // Handle event
  }
});

// WebView side
const messenger = new WebViewToRNMessenger('markdownEditor', {
  get mainEditor() {
    return window.cm;
  }
});
```

## Common Tasks

### Adding a New Editor Command

1. **Editor Package**: Add command in `packages/editor/CodeMirror/editorCommands/`
2. **Editor Control**: Expose in `EditorControl` interface
3. **NoteEditor**: Add method that calls `editorRef.current.execCommand()`
4. **WebView**: Command is already available via CodeMirror

### Handling Editor Events

1. **createEditor.ts**: Fire event in event handler
2. **contentScript.ts**: Forward to `messenger.remoteApi.onEditorEvent()`
3. **useWebViewSetup.ts**: Forward to `onEditorEvent` callback
4. **NoteEditor.tsx**: Handle in `onEditorEvent` prop

### Updating Editor Settings

1. **NoteEditor**: Call `editorControl.updateSettings(newSettings)`
2. **Editor Control**: Calls `editorRef.current.updateSettings()`
3. **WebView**: Injects JS to call `cm.updateSettings()`
4. **CodeMirror**: Updates via `dynamicConfig.reconfigure()`

## Debugging Tips

1. **Enable WebView Debugging**: Set `webviewDebuggingEnabled={true}`
2. **Check Console**: Use Safari/Chrome DevTools to inspect WebView
3. **Log Messages**: Use `window.ReactNativeWebView.postMessage('log: ...')`
4. **Error Handling**: Errors are sent via `postMessage` with 'error:' prefix
