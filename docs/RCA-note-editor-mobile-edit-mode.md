# RCA: Note editor not appearing in edit mode on mobile

## Symptom
The note editor does not appear when in edit mode on native (iOS/Android)—no editor, no placeholder.

## Root cause: WebView not loading (not height)

**Cause:** The CodeMirror WebView editor was not loading at all on mobile. The user saw nothing (no placeholder, no editor). This points to the WebView or its content failing to load, not a layout/height issue. Possible reasons:

- **Generated HTML not available in native bundle** – `editor-html.generated.ts` may not be included or may be too large for Metro on native.
- **WebView inline HTML** – Some devices or WebView configs block or fail on `source={{ html: ... }}`.
- **Script error inside WebView** – The inlined CodeMirror bundle may throw in the WebView JS context (e.g. missing globals, security), so the editor never inits and the view stays blank.

**Current approach:** Native uses **CodeMirrorDOM** (CodeMirror in Expo DOM/WebView) only. There is no fallback to a plain TextInput. If the DOM component fails to load, an error boundary shows "codemirror+webview is not working" so the issue is visible and must be fixed. Web continues to use CodeMirror (CodeMirrorWeb) with markdown highlighting.

### Optional: layout minHeight (kept)

A `minHeight` on the native edit-mode ScrollView content was added so that if/when the WebView is used again, the editor area has a defined height. This does not fix the “not loading” issue but avoids zero-height when the WebView does load.

### 2. **Default mode: existing notes open in preview**

**Cause:** Initial state is `isPreview = useState(!openInEditMode)` with `openInEditMode = isNewNote || editParam === "1"`. For an **existing note** opened without `?edit=1`, `openInEditMode` is false, so the screen starts in **preview**. The editor is not mounted until the user switches to edit (e.g. via header toggle).

**Impact:** If the user expects to land in edit mode when opening a note, they only see preview until they toggle. This is UX, not a layout bug.

**Optional change:** Open in edit mode by default on mobile (e.g. when `Platform.OS !== "web"`) or when navigating from the notes list with an “edit” intent.

### 3. **WebView / bundle (secondary)**

- **Generated HTML:** `CodeMirrorWebView` uses `CODEMIRROR_EDITOR_HTML` from `editor-html.generated.ts`. If that file is missing or the build step wasn’t run, `source={{ html: undefined }}` can lead to a blank WebView. Ensure `node scripts/build-codemirror-editor.js` (or `npm run build:codemirror-editor`) has been run.
- **WebView native module:** If `react-native-webview` is not installed or linked correctly, the WebView component may not render. Verify the dependency and native build.

## Verification

1. **Layout:** On device/simulator, open a note, switch to edit mode (preview toggle). The editor area should have visible height and the WebView (CodeMirror) should be visible.
2. **Default mode:** Open an existing note from the list (no `?edit=1`). Confirm it opens in preview; toggle to edit and confirm the editor appears.
3. **New note:** Create a new note; it should open in edit mode and the editor should be visible.

## Files changed

- **Native editor:** `components/markdown-editor.tsx` – Native uses CodeMirrorDOM only; error boundary shows "codemirror+webview is not working" if it fails. No CodeMirrorNativeInput fallback.
- `app/(app)/note/[id].tsx`: Added `minHeight` on the native edit-mode `ScrollView` content so the editor area has a defined height.
