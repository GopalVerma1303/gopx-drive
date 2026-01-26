# CodeMirror Editor Implementation

This directory contains the CodeMirror + React Native WebView implementation, following patterns from Joplin's mobile app.

## Architecture

The implementation follows Joplin's architecture:

1. **ExtendedWebView**: Wraps `react-native-webview` and handles HTML file creation
2. **CodeMirrorEditor**: React component that sets up the WebView with CodeMirror
3. **Content Scripts**: JavaScript that runs in the WebView to create the editor
4. **Messaging**: Bidirectional communication between React Native and WebView

## Current Implementation

Currently, the implementation uses a simple textarea-based editor as a placeholder. To use the full CodeMirror 6:

1. Bundle CodeMirror 6 modules into a single JavaScript file
2. Replace the `codemirrorBundle` string in `CodeMirrorEditor.tsx` with the bundled code
3. Update the `editorApi.init()` function to use actual CodeMirror 6

## Files

- `ExtendedWebView.tsx`: WebView wrapper component
- `CodeMirrorEditor.tsx`: Main editor component
- `types.ts`: TypeScript types
- `messaging.ts`: Communication layer
- `contentScript.ts`: TypeScript version (not currently used)
- `codemirror-bundle.js`: JavaScript bundle (placeholder)

## Usage

```tsx
import { CodeMirrorEditor, CodeMirrorEditorRef } from '@/components/editor/CodeMirrorEditor';

const editorRef = useRef<CodeMirrorEditorRef>(null);

<CodeMirrorEditor
  ref={editorRef}
  value={content}
  onChangeText={setContent}
  placeholder="Start writing..."
  isPreview={false}
/>
```

## Next Steps

1. **Bundle CodeMirror 6**: Use webpack/esbuild to bundle CodeMirror modules
2. **Add Syntax Highlighting**: Implement markdown syntax highlighting
3. **Add Extensions**: Add CodeMirror extensions for better editing experience
4. **Improve Undo/Redo**: Implement proper undo/redo using CodeMirror's history extension
5. **Add Search**: Implement search functionality using CodeMirror's search extension

## Dependencies

- `react-native-webview`: WebView component
- `@codemirror/*`: CodeMirror 6 packages (installed but not yet used in bundle)
- `expo-file-system`: For file system operations
