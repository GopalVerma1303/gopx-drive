import ExtendedWebView from "@/components/extended-webview";
import { getMarkdownEditorWebViewHtml } from "@/components/markdown-editor-webview-html";
import RNToWebViewMessenger from "@/lib/ipc/RNToWebViewMessenger";
import { useThemeColors } from "@/lib/use-theme-colors";
import { cn } from "@/lib/utils";
import { markdownEditorBundleJs } from "@/webviewBundles/generated/markdownEditorBundle.generated";
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";

interface EditorProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  className?: string;
}

export interface EditorRef {
  insertText: (text: string, cursorOffset?: number) => void;
  wrapSelection: (before: string, after: string, cursorOffset?: number) => void;
  focus: () => void;
  getSelection: () => { start: number; end: number };
}

type Theme = {
  dark: boolean;
  background: string;
  foreground: string;
  caret: string;
  selection: string;
  gutterForeground: string;
  lineHighlight: string;
  placeholder: string;
  padX: number;
  padTop: number;
  padBottom: number;
  fontSize: number;
  lineHeight: number;
};

export const Editor = forwardRef<EditorRef, EditorProps>(function Editor(
  { value, onChangeText, placeholder = "Start writing...", className },
  ref
) {
  const { colors, isDark } = useThemeColors();

  // Native WebView state (Joplin-style: local bundle + RPC)
  const webViewRef = useRef<any>(null);
  const messengerRef = useRef<RNToWebViewMessenger | null>(null);
  const [webViewReady, setWebViewReady] = useState(false);
  const [webViewReloadCounter, setWebViewReloadCounter] = useState(0);
  const nativeSelectionRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });
  const lastKnownEditorValueRef = useRef<string>(value);

  const latestValueRef = useRef(value);
  useEffect(() => {
    latestValueRef.current = value;
  }, [value]);

  const onChangeTextRef = useRef(onChangeText);
  useEffect(() => {
    onChangeTextRef.current = onChangeText;
  }, [onChangeText]);

  const editorTheme: Theme = useMemo(() => {
    const selection = isDark ? "rgba(250,250,250,0.18)" : "rgba(10,10,10,0.12)";
    return {
      dark: isDark,
      background: colors.muted,
      foreground: colors.foreground,
      caret: colors.foreground,
      selection,
      gutterForeground: colors.mutedForeground,
      lineHighlight: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
      placeholder: colors.mutedForeground,
      // Joplin-like padding (tight on native; web theme below adds its own padding)
      padX: 1,
      padTop: 10,
      padBottom: 1,
      fontSize: 17,
      lineHeight: 24,
    };
  }, [colors, isDark]);

  // Native: minimal HTML shell + inject local bundle.
  const webViewHtml = useMemo(() => getMarkdownEditorWebViewHtml(), []);
  const injectedJavaScript = useMemo(() => {
    // On Android, injected scripts may run multiple times. Guard bundle evaluation.
    return `
      if (!window.__GOPX_MARKDOWN_EDITOR_BUNDLE_EVAL__) {
        window.__GOPX_MARKDOWN_EDITOR_BUNDLE_EVAL__ = true;
        ${markdownEditorBundleJs}
      }
      true;
    `;
  }, []);

  if (!messengerRef.current) {
    messengerRef.current = new RNToWebViewMessenger(webViewRef);
  }

  useEffect(() => {
    const messenger = messengerRef.current!;

    messenger.setOnEvent((event) => {
      switch (event.type) {
        case "ready": {
          setWebViewReady(true);
          return;
        }
        case "selection": {
          const payload: any = event.payload;
          const start = typeof payload?.start === "number" ? payload.start : 0;
          const end = typeof payload?.end === "number" ? payload.end : start;
          nativeSelectionRef.current = { start, end };
          return;
        }
        case "change": {
          const payload: any = event.payload;
          const nextValue = typeof payload?.value === "string" ? payload.value : "";
          lastKnownEditorValueRef.current = nextValue;

          const sel = payload?.selection;
          if (sel && typeof sel?.start === "number" && typeof sel?.end === "number") {
            nativeSelectionRef.current = { start: sel.start, end: sel.end };
          }

          if (nextValue !== latestValueRef.current) {
            onChangeTextRef.current(nextValue);
          }
          return;
        }
        case "error": {
          setWebViewReady(false);
          setWebViewReloadCounter((c) => c + 1);
          return;
        }
        default:
          return;
      }
    });

    return () => messenger.setOnEvent(null);
  }, []);

  const handleWebViewMessage = useCallback((event: any) => {
    messengerRef.current?.onWebViewMessage(event);
  }, []);

  const onWebViewLoadEnd = useCallback(() => {
    const messenger = messengerRef.current;
    if (!messenger) return;

    messenger.onWebViewLoaded();
    void messenger
      .call("init", {
        value: latestValueRef.current,
        placeholder,
        theme: editorTheme,
      })
      .catch(() => {
        setWebViewReady(false);
        setWebViewReloadCounter((c) => c + 1);
      });
  }, [editorTheme, placeholder]);

  // Controlled updates (native): keep editor in sync without nuking selection.
  useEffect(() => {
    if (!webViewReady) return;
    if (value === lastKnownEditorValueRef.current) return;

    lastKnownEditorValueRef.current = value;
    void messengerRef.current?.call("setValue", value).catch(() => {
      setWebViewReady(false);
      setWebViewReloadCounter((c) => c + 1);
    });
  }, [value, webViewReady]);

  // Theme/placeholder updates (native)
  useEffect(() => {
    if (!webViewReady) return;

    void messengerRef.current?.call("setTheme", editorTheme).catch(() => {
      setWebViewReady(false);
      setWebViewReloadCounter((c) => c + 1);
    });
    void messengerRef.current?.call("setPlaceholder", placeholder).catch(() => {
      setWebViewReady(false);
      setWebViewReloadCounter((c) => c + 1);
    });
  }, [editorTheme, placeholder, webViewReady]);

  useImperativeHandle(ref, () => ({
    insertText: (text: string, cursorOffset?: number) => {
      // Native: WebView editor
      if (webViewReady) {
        void messengerRef.current?.call("insertText", text, cursorOffset).catch(() => {
          setWebViewReady(false);
          setWebViewReloadCounter((c) => c + 1);
        });
      }
    },

    wrapSelection: (before: string, after: string, cursorOffset?: number) => {
      // Native: WebView editor
      if (webViewReady) {
        void messengerRef.current?.call("wrapSelection", before, after, cursorOffset).catch(() => {
          setWebViewReady(false);
          setWebViewReloadCounter((c) => c + 1);
        });
      }
    },

    focus: () => {
      if (webViewReady) {
        void messengerRef.current?.call("focus").catch(() => {
          setWebViewReady(false);
          setWebViewReloadCounter((c) => c + 1);
        });
      }
    },

    getSelection: () => {
      return nativeSelectionRef.current;
    },
  }));

  return (
    <View className={cn("flex-1", className)} style={{ backgroundColor: editorTheme.background }}>
      <View style={{ flex: 1 }}>
        {!webViewReady && (
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ActivityIndicator color={colors.foreground} />
          </View>
        )}
        <ExtendedWebView
          key={`editor-webview-${webViewReloadCounter}`}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ref={webViewRef as any}
          webviewInstanceId={`Editor-${webViewReloadCounter}`}
          html={webViewHtml}
          injectedJavaScript={injectedJavaScript}
          onMessage={handleWebViewMessage as any}
          onLoadEnd={onWebViewLoadEnd}
          onError={() => {
            setWebViewReady(false);
            setWebViewReloadCounter((c) => c + 1);
          }}
          style={{ flex: 1, backgroundColor: editorTheme.background }}
        />
      </View>
    </View>
  );
});

