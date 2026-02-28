# RCA: Android code editor – keyboard/cursor dismiss on tap

## Symptom
On Android: user taps the editor to type → keyboard appears → cursor and keyboard immediately dismiss → user cannot type.

## Root causes

### 1. WebView source switch after first paint (primary)
- **What:** We rendered the WebView with `source={{ html: EDITOR_SHELL_HTML, baseUrl: "about:blank" }}` (because `fileSourceUri` was null on first render). Then an async effect wrote the HTML to a file and called `setFileSourceUri(uri)`. That re-rendered the component and the WebView received a new `source={{ uri: fileSourceUri }}`.
- **Why it breaks:** Changing the `source` prop causes the WebView to reload. The reload happens at an arbitrary time (often right after the user taps and the keyboard starts to open). The reload destroys the focused input and dismisses the keyboard.
- **Fix:** On Android, do not show the WebView until we have a single, stable source. If we use file: wait for the file to be ready, then render the WebView only with `source={{ uri }}` (never switch from inline to file). If file write fails, use inline only and render once with that. No source prop change after the WebView is mounted.

### 2. injectedJavaScript with file:// runs before DOM is ready (Android)
- **What:** With `source={{ uri: "file://..." }}`, the `injectedJavaScript` prop can run before the document’s DOM is ready (or run multiple times). The editor bundle uses `document.getElementById("root")` and creates CodeMirror there. If the script runs before `#root` exists, the editor is not created correctly; if it runs multiple times, behaviour is undefined and focus can be lost.
- **Fix:** When loading from file on Android, do not put the editor bundle in `injectedJavaScript`. Inject it once in `onLoadEnd` so it runs after the page (and DOM) has loaded. Create the editor only after load.

### 3. Parent re-renders and ScrollView (already mitigated)
- **What:** Parent `setState` on every keystroke (or wrapping the WebView in a ScrollView) can cause re-renders or layout changes that trigger focus loss on Android.
- **Fix (already in place):** No `setState` while typing on Android (content in ref; debounced “dirty” for save). Editor not wrapped in ScrollView; WebView handles scrolling.

## Implementation summary (EditorWebView)

1. **Android, stable source**
   - Write shell HTML to cache file in an effect. Do not render the WebView until we have either a file URI or a fallback.
   - If file write succeeds: render WebView once with `source={{ uri: fileSourceUri }}` only.
   - If file write fails: set `androidUseInlineFallback` and render once with `source={{ html, baseUrl }}`.
   - Never change `source` after the WebView is shown.

2. **Android, file: inject editor in onLoadEnd**
   - When `source` is file URI: `injectedJavaScript=""` and `onLoadEnd` calls `injectJavaScript(bundleScript)` so the editor is created once after DOM is ready.

3. **Android, inline fallback / iOS**
   - Keep previous behaviour: `injectedJavaScript={bundleScript}`, no `onLoadEnd` injection.

4. **Placeholder while “not ready”**
   - On Android, if we neither have a file URI nor inline fallback yet, render a placeholder `View` with the same container style (no layout jump) and `collapsable={false}`.

5. **collapsable={false}**
   - Set on the WebView container so Android does not collapse it during layout (reduces focus/layout glitches).

## Native Android fix (keyboard closes immediately)

**Root cause:** On Android, the default IME (input method) connection for WebView causes the soft keyboard to open then immediately close when focusing `contenteditable`/inputs. The system treats the WebView’s input connection in a way that drops focus.

**Fix (from [react-native-webview#1783](https://github.com/react-native-webview/react-native-webview/issues/1783)):** Override `onCreateInputConnection` in the WebView so that:
- `outAttrs.inputType = InputType.TYPE_NULL` – keyboard emulates keypresses instead of standard IME.
- `outAttrs.imeOptions = EditorInfo.IME_ACTION_DONE`.

This is applied via **patch-package** in `patches/react-native-webview+13.15.0.patch` (edits `RNCWebView.java`). After `npm install`, `postinstall` runs `patch-package` and reapplies the patch.

## Files to rebuild
- `components/EditorWebView.tsx` – stable source + onLoadEnd injection for Android file load.
- `patches/react-native-webview+13.15.0.patch` – native Android WebView input connection fix.
- Rebuild the Android app after changing native/config or the patch so the fix is applied.
