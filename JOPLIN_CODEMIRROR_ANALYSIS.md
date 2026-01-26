# Joplin's CodeMirror + React Native WebView Integration Analysis

## Overview

Joplin uses **CodeMirror 6** (via `@codemirror/*` packages) inside a **React Native WebView** to provide a rich text editing experience on mobile. This architecture allows them to leverage the full power of CodeMirror's web-based editor while running it in a native mobile app.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    React Native Layer                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              NoteEditor Component                      │  │
│  │  - Manages editor state                               │  │
│  │  - Handles events from WebView                        │  │
│  │  - Provides editor control API                        │  │
│  └──────────────────────────────────────────────────────┘  │
│                         │                                     │
│                         ▼                                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         MarkdownEditor / RichTextEditor               │  │
│  │  - Creates HTML for WebView                          │  │
│  │  - Sets up injected JavaScript                        │  │
│  │  - Handles WebView events                            │  │
│  └──────────────────────────────────────────────────────┘  │
│                         │                                     │
│                         ▼                                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            ExtendedWebView Component                  │  │
│  │  - Wraps react-native-webview                        │  │
│  │  - Writes HTML to file system                        │  │
│  │  - Provides injectJS/postMessage API                 │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    WebView (Browser Context)                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              HTML Document                            │  │
│  │  <div class="CodeMirror"></div>                       │  │
│  └──────────────────────────────────────────────────────┘  │
│                         │                                     │
│                         ▼                                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Injected JavaScript Bundle                    │  │
│  │  - markdownEditorBundle (contentScript)              │  │
│  │  - Creates CodeMirror editor instance                │  │
│  │  - Sets up event handlers                            │  │
│  └──────────────────────────────────────────────────────┘  │
│                         │                                     │
│                         ▼                                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         @joplin/editor Package                       │  │
│  │  - createEditor() function                          │  │
│  │  - Uses @codemirror/state, @codemirror/view         │  │
│  │  - Configures extensions                            │  │
│  └──────────────────────────────────────────────────────┘  │
│                         │                                     │
│                         ▼                                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            CodeMirror 6 Editor                        │  │
│  │  - Full-featured editor                              │  │
│  │  - Syntax highlighting                                │  │
│  │  - Undo/redo                                         │  │
│  │  - Search/replace                                    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. ExtendedWebView Component

**Location**: `components/ExtendedWebView/index.tsx`

**Purpose**: Wraps `react-native-webview` and provides a clean API for loading HTML and injecting JavaScript.

**Key Features**:
- Writes HTML to a temporary file on the file system (required for `file://` protocol)
- Provides `injectJS()` method for executing JavaScript in the WebView context
- Provides `postMessage()` for bidirectional communication
- Handles WebView crashes and reloads
- Supports CSS injection via `useCss` hook

**Important Implementation Details**:
```typescript
// HTML is written to file system because WebView needs file:// protocol
const tempFile = `${baseDirectory}/${props.webviewInstanceId}.html`;
await shim.fsDriver().writeFile(tempFile, props.html, 'utf8');

// Cache busting query parameter to force re-render
const newSource = {
  uri: `file://${tempFile}?r=${Math.round(Math.random() * 100000000)}`,
  baseUrl, // For loading images/resources
};
```

### 2. MarkdownEditor Component

**Location**: `components/NoteEditor/MarkdownEditor.tsx`

**Purpose**: Sets up the WebView with HTML and JavaScript for the markdown editor.

**Key Responsibilities**:
- Generates HTML with a `<div class="CodeMirror"></div>` container
- Injects the `markdownEditorBundle` JavaScript
- Sets up CSS theming
- Handles messages from WebView
- Uses `useWebViewSetup` hook to configure the editor

**HTML Structure**:
```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  </head>
  <body>
    <div class="CodeMirror" style="height:100%;" autocapitalize="on"></div>
  </body>
</html>
```

### 3. useWebViewSetup Hook

**Location**: `contentScripts/markdownEditorBundle/useWebViewSetup.ts`

**Purpose**: Orchestrates the setup of CodeMirror in the WebView.

**Key Features**:
- Loads the `markdownEditorBundle` JavaScript bundle
- Creates the editor after WebView loads
- Sets up bidirectional communication via `RNToWebViewMessenger`
- Handles initial selection, scroll position, and search state
- Manages plugin integration

**Communication Pattern**:
```typescript
// React Native → WebView: injectJS()
webviewRef.current.injectJS(`
  window.cm = markdownEditorBundle.createMainEditor(${JSON.stringify(editorOptions)});
`);

// WebView → React Native: postMessage()
window.ReactNativeWebView.postMessage(JSON.stringify(message));
```

### 4. contentScript.ts (markdownEditorBundle)

**Location**: `contentScripts/markdownEditorBundle/contentScript.ts`

**Purpose**: The JavaScript that runs inside the WebView to create and manage the CodeMirror editor.

**Key Functions**:
- `createMainEditor()`: Creates the main editor instance
- `createEditorWithParent()`: Creates editor with a specific parent element
- Sets up event handlers and messaging

**Editor Creation**:
```typescript
import { createEditor } from '@joplin/editor/CodeMirror';

const control = createEditor(parentElement, {
  initialText,
  initialNoteId,
  settings,
  onEvent: (event) => {
    void messenger.remoteApi.onEditorEvent(event);
  },
  // ... other callbacks
});
```

### 5. @joplin/editor Package

**Location**: `packages/editor/CodeMirror/createEditor.ts`

**Purpose**: Core CodeMirror 6 integration using `@codemirror/*` packages.

**Key Features**:
- Uses CodeMirror 6's modular architecture
- Configures extensions for markdown editing
- Sets up keyboard shortcuts
- Handles undo/redo, search, formatting
- Custom extensions for Joplin-specific features

**CodeMirror 6 Setup**:
```typescript
import { EditorView, EditorState } from '@codemirror/view';
import { history } from '@codemirror/commands';

const editor = new EditorView({
  state: EditorState.create({
    extensions: [
      history(),
      EditorView.lineWrapping,
      // ... many more extensions
    ],
    doc: initialText,
  }),
  parent: parentElement,
});
```

## Communication Flow

### React Native → WebView

1. **Initial Setup**: HTML and JavaScript are injected when WebView loads
2. **Runtime Commands**: Use `webviewRef.current.injectJS(script)` to execute JavaScript
3. **Settings Updates**: Inject JavaScript to update editor settings
4. **Content Updates**: Inject JavaScript to update editor content

**Example**:
```typescript
// Update editor content
webviewRef.current.injectJS(`
  cm.updateBody(${JSON.stringify(newContent)});
`);
```

### WebView → React Native

1. **Events**: Editor events (change, selection, scroll) are sent via `postMessage`
2. **Messages**: All communication uses `window.ReactNativeWebView.postMessage()`
3. **Error Handling**: Errors are caught and sent to React Native

**Example**:
```typescript
// In WebView
window.ReactNativeWebView.postMessage(JSON.stringify({
  type: 'editorEvent',
  event: { kind: 'Change', value: newText }
}));

// In React Native
onMessage={(event) => {
  const data = JSON.parse(event.nativeEvent.data);
  // Handle event
}}
```

## Key Implementation Patterns

### 1. HTML File System Storage

**Why**: React Native WebView requires `file://` protocol for local HTML files.

**How**:
- Write HTML to a temporary file in the app's resource directory
- Load it via `file://` URI with cache-busting query parameter
- Use `baseUrl` to resolve relative resource paths (images, etc.)

### 2. JavaScript Bundle Injection

**Why**: CodeMirror and editor logic need to run in the WebView context.

**How**:
- Bundle JavaScript using build tools (gulp/webpack)
- Inject via `injectedJavaScript` prop (runs on every load)
- Store bundle in `window.markdownEditorBundle` to avoid re-injection
- Use `injectJS()` for runtime commands

### 3. Bidirectional Messaging

**Why**: Need real-time communication between React Native and WebView.

**How**:
- Use `RNToWebViewMessenger` and `WebViewToRNMessenger` classes
- Serialize messages as JSON
- Handle async operations with promises
- Type-safe APIs on both sides

### 4. Editor Control API

**Why**: React Native components need to control the editor.

**How**:
- Expose a control object with methods like `insertText()`, `undo()`, `focus()`
- Control object uses `injectJS()` to execute commands
- Editor exposes methods that can be called from injected JavaScript

## Dependencies

### Core Packages

```json
{
  "@joplin/editor": "~3.6",           // CodeMirror wrapper
  "react-native-webview": "13.16.0",  // WebView component
  "@codemirror/state": "...",         // CodeMirror state management
  "@codemirror/view": "...",          // CodeMirror UI
  "@codemirror/commands": "...",      // CodeMirror commands
  "@codemirror/search": "...",        // CodeMirror search
  "@codemirror/language": "..."       // CodeMirror syntax highlighting
}
```

## Important Considerations

### 1. Performance

- **Large Documents**: CodeMirror handles large documents well, but initial load can be slow
- **Memory**: WebView has its own memory space; large documents consume significant memory
- **Scrolling**: Uses native scrolling for better performance on mobile

### 2. Platform Differences

- **iOS**: Uses WKWebView (WebKit)
- **Android**: Uses WebView (Chromium-based)
- **Web**: Uses iframe (for development/testing)

### 3. Security

- **File Access**: `allowFileAccessFromFileURLs` must be enabled for local resources
- **Origin Whitelist**: Configured to allow `file://` protocol
- **Content Security**: WebView runs in isolated context

### 4. Mobile-Specific Features

- **Keyboard**: `hideKeyboardAccessoryView` hides iOS keyboard toolbar
- **Scrolling**: `decelerationRate='normal'` for native-like scroll feel
- **Focus**: Custom focus handling for better mobile UX
- **Touch Events**: CodeMirror handles touch events natively

### 5. Error Handling

- **WebView Crashes**: Detected via `onContentProcessDidTerminate` and `onRenderProcessGone`
- **JavaScript Errors**: Caught and sent to React Native via `postMessage`
- **Load Errors**: Handled via `onError` callback

## Advantages of This Architecture

1. **Full CodeMirror Features**: Access to all CodeMirror 6 capabilities
2. **Rich Editing**: Syntax highlighting, search, undo/redo, etc.
3. **Extensibility**: Easy to add plugins and extensions
4. **Cross-Platform**: Same editor code for iOS, Android, and Web
5. **Maintainability**: Editor logic separated from React Native code

## Disadvantages

1. **Complexity**: More complex than native text input
2. **Performance**: WebView has overhead compared to native components
3. **Memory**: WebView uses significant memory
4. **Debugging**: Harder to debug WebView JavaScript
5. **File System**: Requires file system access for HTML

## Summary

Joplin's implementation is a sophisticated integration of CodeMirror 6 with React Native WebView. The key insight is:

1. **WebView as Container**: WebView provides a browser-like environment for CodeMirror
2. **File System for HTML**: HTML must be written to file system for `file://` protocol
3. **JavaScript Injection**: Editor logic is injected as JavaScript bundles
4. **Bidirectional Messaging**: `postMessage` and `injectJS` enable communication
5. **Modular Architecture**: Clean separation between React Native layer and editor layer

This architecture allows Joplin to provide a desktop-quality editing experience on mobile devices while maintaining code reuse across platforms.
