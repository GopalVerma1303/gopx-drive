import * as FileSystem from 'expo-file-system';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { NativeSyntheticEvent, Platform, StyleProp, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewErrorEvent } from 'react-native-webview/lib/RNCWebViewNativeComponent';
import type { WebViewSource } from 'react-native-webview/lib/WebViewTypes';

export interface WebViewControl {
  injectJS(script: string): void;
  postMessage(message: unknown): void;
}

export type OnMessageEvent = { nativeEvent: { data: string } };
export type OnMessageCallback = (event: OnMessageEvent) => void;
export type OnErrorCallback = (event: NativeSyntheticEvent<WebViewErrorEvent>) => void;
export type OnLoadCallback = () => void;

export interface ExtendedWebViewProps {
  webviewInstanceId: string;
  testID?: string;
  scrollEnabled?: boolean;
  allowFileAccessFromJs?: boolean;
  mixedContentMode?: 'never' | 'always';
  html: string;
  css?: string;
  injectedJavaScript: string;
  style?: StyleProp<ViewStyle>;
  onMessage: OnMessageCallback;
  onError?: OnErrorCallback;
  onLoadStart?: OnLoadCallback;
  onLoadEnd?: OnLoadCallback;
  baseDirectory?: string;
}

// CSS injection utility (similar to Joplin's useCss hook)
const webViewCssClassName = 'extended-webview-css';

const applyCssJs = (css: string): string => `
(function() {
  const styleId = ${JSON.stringify(webViewCssClassName)};
  const oldStyle = document.getElementById(styleId);
  if (oldStyle) {
    oldStyle.remove();
  }
  const style = document.createElement('style');
  style.setAttribute('id', styleId);
  style.appendChild(document.createTextNode(${JSON.stringify(css)}));
  document.head.appendChild(style);
})();
true;
`;

const ExtendedWebView = forwardRef<WebViewControl, ExtendedWebViewProps>(
  (props, ref) => {
    const webviewRef = useRef<WebView>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [source, setSource] = useState<WebViewSource | undefined>(undefined);
    const [isIframeReady, setIsIframeReady] = useState(false);

    // Web-specific: Handle iframe message communication
    useEffect(() => {
      if (Platform.OS !== 'web') return;

      const handleMessage = (event: MessageEvent) => {
        // Only accept messages from our iframe
        if (event.source !== iframeRef.current?.contentWindow) return;

        // Handle ReactNativeWebView.postMessage compatibility
        if (typeof event.data === 'string') {
          try {
            props.onMessage({
              nativeEvent: { data: event.data },
            });
          } catch (error) {
            console.error('Error handling iframe message:', error);
          }
        }
      };

      window.addEventListener('message', handleMessage);
      return () => {
        window.removeEventListener('message', handleMessage);
      };
    }, [props.onMessage]);

    useImperativeHandle(
      ref,
      (): WebViewControl => {
        return {
          injectJS(js: string) {
            if (Platform.OS === 'web') {
              // Web: Execute in iframe context
              const iframe = iframeRef.current;
              if (!iframe || !iframe.contentWindow) {
                throw new Error(
                  `ExtendedWebView(${props.webviewInstanceId}): Trying to call injectJS on an iframe that isn't loaded.`
                );
              }

              try {
                // Execute script in iframe context by injecting a script element
                const doc = iframe.contentDocument;
                if (doc) {
                  const script = doc.createElement('script');
                  script.textContent = `
                    try {
                      ${js}
                    } catch(e) {
                      (window.logMessage || console.error)('Error in injected JS:' + e, e);
                      throw e;
                    };
                  `;
                  doc.head.appendChild(script);
                  doc.head.removeChild(script);
                }
              } catch (error) {
                console.error('Error executing script in iframe:', error);
                throw error;
              }
            } else {
              // Native: Use WebView injectJavaScript (following Joplin's pattern)
              if (!webviewRef.current) {
                throw new Error(
                  `ExtendedWebView(${props.webviewInstanceId}): Trying to call injectJavaScript on a WebView that isn't loaded.`
                );
              }

              // .injectJavaScript can be undefined when testing
              if (!webviewRef.current.injectJavaScript) return;

              webviewRef.current.injectJavaScript(`
                try {
                  ${js}
                } catch(e) {
                  (window.logMessage || console.error)('Error in injected JS:' + e, e);
                  throw e;
                };
                true;
              `);
            }
          },
          postMessage(message: unknown) {
            if (Platform.OS === 'web') {
              // Web: Post message to iframe
              const iframe = iframeRef.current;
              if (iframe?.contentWindow) {
                iframe.contentWindow.postMessage(JSON.stringify(message), '*');
              }
            } else {
              // Native: Use WebView postMessage (following Joplin's pattern)
              if (webviewRef.current) {
                webviewRef.current.postMessage(JSON.stringify(message));
              }
            }
          },
        };
      },
      [props.webviewInstanceId]
    );

    // Get cache directory properly - cacheDirectory exists at runtime but may not be in TypeScript definitions
    const getCacheDirectory = (): string => {
      if (Platform.OS === 'web') return '';
      try {
        // @ts-expect-error - cacheDirectory exists at runtime in expo-file-system
        return FileSystem.cacheDirectory || '';
      } catch {
        return '';
      }
    };
    const baseDirectory = props.baseDirectory ?? getCacheDirectory();
    const baseUrl = `file://${baseDirectory}`;

    useEffect(() => {
      let cancelled = false;

      async function createHtmlFile() {
        if (Platform.OS === 'web') {
          // On web, use data URI directly
          if (props.html) {
            setSource({
              html: props.html,
              baseUrl,
            });
          }
          return;
        }

        if (!baseDirectory) {
          console.warn('No base directory available for WebView HTML');
          // Fallback to data URI
          if (props.html) {
            setSource({
              html: props.html,
              baseUrl,
            });
          }
          return;
        }

        const tempFile = `${baseDirectory}${props.webviewInstanceId}.html`;

        try {
          // Ensure directory exists
          const dirInfo = await FileSystem.getInfoAsync(baseDirectory);
          if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(baseDirectory, { intermediates: true });
          }

          // Write HTML file (following Joplin's pattern)
          await FileSystem.writeAsStringAsync(tempFile, props.html);

          if (cancelled) return;

          // Add cache busting query parameter (following Joplin's pattern)
          // Now that we are sending back a file instead of an HTML string, we're always sending back the
          // same file. So we add a cache busting query parameter to it, to make sure that the WebView re-renders.
          const newSource: WebViewSource = {
            uri: `file://${tempFile}?r=${Math.round(Math.random() * 100000000)}`,
            baseUrl,
          };
          setSource(newSource);
        } catch (error) {
          console.error('Error creating HTML file for WebView:', error);
          // Fallback: use data URI
          if (props.html) {
            setSource({
              html: props.html,
              baseUrl,
            });
          }
        }
      }

      if (props.html && props.html.length > 0) {
        void createHtmlFile();
      } else {
        // When the source is falsy, we set it to { uri: undefined } to avoid various crashes and errors
        // (following Joplin's pattern)
        setSource({ uri: undefined } as any);
      }

      return () => {
        cancelled = true;
      };
    }, [props.html, props.webviewInstanceId, baseDirectory, baseUrl]);

    const onError = useCallback((event: NativeSyntheticEvent<WebViewErrorEvent>) => {
      console.error('WebView error:', event.nativeEvent.description);
      props.onError?.(event);
    }, [props]);

    const [reloadCounter, setReloadCounter] = useState(0);
    const refreshWebViewAfterCrash = useCallback(() => {
      // Reload the WebView on crash (following Joplin's pattern)
      // See https://github.com/react-native-webview/react-native-webview/issues/3524
      console.warn('Content process lost. Reloading the webview...');
      setTimeout(() => {
        setReloadCounter((counter) => counter + 1);
        // Restart after a brief delay to mitigate the case where the crash is due to
        // an out-of-memory or content script bug.
      }, 250);
    }, []);

    // Inject CSS if provided (following Joplin's useCss pattern)
    const cssInjectedJs = useMemo(() => {
      if (!props.css) return '';
      return applyCssJs(props.css);
    }, [props.css]);

    // Inject CSS dynamically when it changes (for native platform)
    useEffect(() => {
      if (Platform.OS !== 'web' && props.css && webviewRef.current?.injectJavaScript) {
        webviewRef.current.injectJavaScript(applyCssJs(props.css));
      }
    }, [props.css]);

    const injectedJavaScript = props.injectedJavaScript + cssInjectedJs;

    // Web platform: Prepare HTML with CSS and JavaScript injections
    const fullHtml = useMemo(() => {
      if (Platform.OS !== 'web' || !props.html) return '';

      // Build injection script
      const injectionScript = `
        ${props.css ? `<style>${props.css}</style>` : ''}
        <script>
          // Polyfill for ReactNativeWebView.postMessage
          window.ReactNativeWebView = {
            postMessage: function(data) {
              window.parent.postMessage(data, '*');
            }
          };
          
          // Execute injected JavaScript after DOM is ready
          (function() {
            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', function() {
                try {
                  ${injectedJavaScript}
                } catch(e) {
                  console.error('Error in injected JavaScript:', e);
                }
              });
            } else {
              try {
                ${injectedJavaScript}
              } catch(e) {
                console.error('Error in injected JavaScript:', e);
              }
            }
          })();
        </script>`;

      // Try to inject before </head>, otherwise before </body>, otherwise append
      if (props.html.includes('</head>')) {
        return props.html.replace('</head>', `${injectionScript}</head>`);
      } else if (props.html.includes('</body>')) {
        return props.html.replace('</body>', `${injectionScript}</body>`);
      } else {
        // No head or body tags, prepend injection
        return `${injectionScript}${props.html}`;
      }
    }, [props.html, props.css, injectedJavaScript]);

    // Web platform: Use iframe instead of WebView
    if (Platform.OS === 'web') {
      const handleIframeLoad = useCallback(() => {
        setIsIframeReady(true);
        props.onLoadEnd?.();
      }, [props.onLoadEnd]);

      const handleIframeError = useCallback(() => {
        if (props.onError) {
          // Create a mock error event for compatibility
          props.onError({
            nativeEvent: {
              description: 'Iframe load error',
            },
          } as NativeSyntheticEvent<WebViewErrorEvent>);
        }
      }, [props.onError]);

      return (
        <iframe
          ref={iframeRef}
          key={`iframe-${reloadCounter}`}
          srcDoc={fullHtml}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            backgroundColor: 'transparent',
            ...(props.style as any),
          }}
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          sandbox="allow-scripts allow-same-origin"
          data-testid={props.testID}
        />
      );
    }

    // Native platform: Use WebView (following Joplin's pattern)
    // - `setSupportMultipleWindows` must be `true` for security reasons:
    //   https://github.com/react-native-webview/react-native-webview/releases/tag/v11.0.0
    // - When the source is falsy, we set it to `{ uri: undefined }` to avoid various crashes and errors:
    //   https://github.com/react-native-webview/react-native-webview/issues/2920
    //   https://github.com/react-native-webview/react-native-webview/issues/2995
    // - `decelerationRate='normal'` is necessary on iOS for a native-like inertial scroll
    //   (the default deaccelerates too quickly).
    return (
      <WebView
        key={`webview-${reloadCounter}`}
        ref={webviewRef}
        style={[
          {
            backgroundColor: 'transparent',
          },
          props.style,
        ]}
        decelerationRate={Platform.OS === 'ios' ? 'normal' : undefined}
        scrollEnabled={props.scrollEnabled}
        source={source ? source : ({ uri: undefined } as any)}
        setSupportMultipleWindows={true}
        hideKeyboardAccessoryView={true}
        allowingReadAccessToURL={baseUrl}
        originWhitelist={['file://*', 'about:srcdoc', './*', 'http://*', 'https://*']}
        mixedContentMode={props.mixedContentMode}
        allowFileAccess={true}
        allowFileAccessFromFileURLs={props.allowFileAccessFromJs}
        webviewDebuggingEnabled={__DEV__}
        injectedJavaScript={injectedJavaScript}
        onMessage={props.onMessage}
        onError={props.onError ?? onError}
        onLoadEnd={props.onLoadEnd}
        onContentProcessDidTerminate={refreshWebViewAfterCrash}
        onRenderProcessGone={refreshWebViewAfterCrash}
      />
    );
  }
);

ExtendedWebView.displayName = 'ExtendedWebView';

export default ExtendedWebView;
