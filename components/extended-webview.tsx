import * as React from "react";

import * as FileSystem from "expo-file-system";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Platform, StyleProp, ViewStyle } from "react-native";
import { WebView } from "react-native-webview";
import type { WebViewErrorEvent, WebViewMessageEvent, WebViewSource } from "react-native-webview/lib/WebViewTypes";

export type ExtendedWebViewRef = {
  postMessage: (message: string) => void;
  injectJavaScript: (js: string) => void;
};

type Props = {
  webviewInstanceId: string;
  html: string;
  injectedJavaScript: string;
  onMessage: (event: WebViewMessageEvent) => void;
  onLoadEnd?: () => void;
  onError?: (event: WebViewErrorEvent) => void;
  scrollEnabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

// Joplin-style WebView wrapper:
// - writes HTML to a local file (stable base URL)
// - loads file://...?.r=<cachebust> to force refresh
// - exposes postMessage + injectJavaScript to parent
const ExtendedWebView = forwardRef<ExtendedWebViewRef, Props>(function ExtendedWebView(props, ref) {
  const innerRef = useRef<WebView>(null);
  const [source, setSource] = useState<WebViewSource | undefined>(undefined);

  useImperativeHandle(ref, () => ({
    postMessage: (message: string) => {
      innerRef.current?.postMessage(message);
    },
    injectJavaScript: (js: string) => {
      // Always return true to avoid RN WebView "silent failures"
      innerRef.current?.injectJavaScript?.(`${js}\ntrue;`);
    },
  }));

  const baseDirectory = useMemo(() => {
    // cacheDirectory is preferred for temp HTML.
    return FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? null;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function writeHtmlAndSetSource() {
      if (!props.html) {
        setSource(undefined);
        return;
      }

      // If we can't write to disk for some reason, fall back to HTML string.
      if (!baseDirectory) {
        setSource({ html: props.html });
        return;
      }

      const fileUri = `${baseDirectory}${props.webviewInstanceId}.html`;
      await FileSystem.writeAsStringAsync(fileUri, props.html, { encoding: FileSystem.EncodingType.UTF8 });
      if (cancelled) return;

      const cacheBust = Math.round(Math.random() * 100000000);

      // baseUrl helps relative asset resolution if you ever add local assets.
      // (Matches Joplin's "file load + baseUrl" approach.)
      setSource({
        // @ts-expect-error baseUrl supported by react-native-webview source
        uri: `${fileUri}?r=${cacheBust}`,
        // @ts-expect-error baseUrl supported by react-native-webview source
        baseUrl: baseDirectory,
      } as any);
    }

    writeHtmlAndSetSource().catch(() => {
      if (!cancelled) setSource({ html: props.html });
    });

    return () => {
      cancelled = true;
    };
  }, [props.html, props.webviewInstanceId, baseDirectory]);

  const originWhitelist = useMemo(() => ["file://*", "about:blank", "about:srcdoc"], []);

  // When using file:// sources, iOS requires an explicit allowingReadAccessToURL.
  const allowingReadAccessToURL = baseDirectory ?? undefined;

  return (
    <WebView
      ref={innerRef}
      scrollEnabled={props.scrollEnabled ?? true}
      source={source ? source : { html: props.html }}
      originWhitelist={originWhitelist}
      allowingReadAccessToURL={allowingReadAccessToURL}
      allowFileAccess
      allowFileAccessFromFileURLs
      allowUniversalAccessFromFileURLs={Platform.OS === "android"}
      javaScriptEnabled
      domStorageEnabled
      keyboardDisplayRequiresUserAction={false}
      setSupportMultipleWindows={false}
      injectedJavaScript={props.injectedJavaScript}
      onMessage={props.onMessage}
      onLoadEnd={props.onLoadEnd}
      onError={props.onError}
      style={props.style}
    />
  );
});

export default ExtendedWebView;

