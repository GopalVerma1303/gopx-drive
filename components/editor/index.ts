import { Platform } from 'react-native';

// Import both versions
import * as WebEditor from './CodeMirrorEditor.web';
import * as NativeEditor from './CodeMirrorEditor';

// Import the type (same in both files)
import type { CodeMirrorEditorRef } from './CodeMirrorEditor';

// Conditionally re-export based on platform
const Editor = Platform.OS === 'web' ? WebEditor : NativeEditor;

export const CodeMirrorEditor = Editor.CodeMirrorEditor;
export type { CodeMirrorEditorRef };

// Export MarkdownPreview for mobile
export { MarkdownPreview } from './MarkdownPreview';
