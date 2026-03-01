"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import WebView from "react-native-webview";
import * as Clipboard from "expo-clipboard";
import { getMarkdownThemeFromPalette, getPreviewCss } from "@/lib/markdown-theme";
import { useThemeColors } from "@/lib/use-theme-colors";
import { getPreviewFullHtml } from "./getPreviewHtml";

/** Injected into WebView: replace native checkboxes with custom ones; on tap toggle visual and postMessage so React can update markdown. */
const REPLACE_CHECKBOXES_SCRIPT = `
(function(){
  var container = document.getElementById('content');
  if(!container) return;
  var inputs = container.querySelectorAll('input[type="checkbox"]');
  var svg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
  for(var i=0;i<inputs.length;i++){
    var input=inputs[i];
    var checked=input.hasAttribute('checked');
    var li=input.closest('li');
    if(li&&!li.classList.contains('task-list-item')) li.classList.add('task-list-item');
    var wrap=document.createElement('span');
    wrap.className='markdown-preview-checkbox-wrapper';
    var box=document.createElement('button');
    box.type='button';
    box.setAttribute('role','checkbox');
    box.setAttribute('aria-checked',checked);
    box.setAttribute('aria-label','Task list checkbox');
    box.setAttribute('data-task-index',String(i));
    box.className=checked?'md-preview-checkbox checked':'md-preview-checkbox';
    box.innerHTML=checked?svg:'';
    box.onclick=(function(idx){
      return function(e){
        e.preventDefault();
        e.stopPropagation();
        var c=this.getAttribute('aria-checked')==='true';
        c=!c;
        this.setAttribute('aria-checked',c);
        this.classList.toggle('checked',c);
        this.innerHTML=c?svg:'';
        if(window.ReactNativeWebView&&window.ReactNativeWebView.postMessage){
          window.ReactNativeWebView.postMessage(JSON.stringify({type:'toggleCheckbox',taskIndex:idx}));
        }
      };
    })(i);
    wrap.appendChild(box);
    input.parentNode.replaceChild(wrap,input);
  }
})(); true;
`;

/** Injected into WebView: add copy button; on tap postMessage to RN so native clipboard is used (navigator.clipboard not reliable in WebView on mobile). */
const ADD_CODE_COPY_BUTTONS_SCRIPT = `
(function(){
  var container = document.getElementById('content');
  if(!container) return;
  var COPY_CLASS = 'code-copy-btn';
  var SCROLL_CLASS = 'code-block-scroll';
  var COPY_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
  var CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
  var pres = container.querySelectorAll('pre');
  for(var i=0;i<pres.length;i++){
    var pre = pres[i];
    if(pre.querySelector('.'+COPY_CLASS)) continue;
    var codeEl = pre.querySelector('code');
    var text = (codeEl ? codeEl.innerText : pre.innerText || '').trim();
    var scrollWrap = document.createElement('div');
    scrollWrap.className = SCROLL_CLASS;
    while(pre.firstChild){ scrollWrap.appendChild(pre.firstChild); }
    pre.appendChild(scrollWrap);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = COPY_CLASS;
    btn.setAttribute('aria-label','Copy code');
    btn.setAttribute('data-copy-index', String(i));
    btn.innerHTML = COPY_SVG;
    btn.onclick = (function(txt, idx){
      return function(){
        if(window.ReactNativeWebView && window.ReactNativeWebView.postMessage){
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'copyCode', text: txt, index: idx }));
        } else if(typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText){
          navigator.clipboard.writeText(txt).then(function(){
            var b = document.querySelector('.code-copy-btn[data-copy-index="'+idx+'"]');
            if(b){ b.classList.add('copied'); b.innerHTML = CHECK_SVG; setTimeout(function(){ b.classList.remove('copied'); b.innerHTML = COPY_SVG; }, 2000); }
          });
        }
      };
    })(text, i);
    pre.insertBefore(btn, scrollWrap);
  }
})(); true;
`;

interface MarkdownPreviewWebViewProps {
  html: string;
  contentContainerStyle?: object;
  /** Called with task index when user toggles a checkbox in the WebView. Parent should update markdown. */
  onCheckboxToggle?: (taskIndex: number) => void;
}

export function MarkdownPreviewWebView({ html, contentContainerStyle, onCheckboxToggle }: MarkdownPreviewWebViewProps) {
  const webViewRef = useRef<WebView>(null);
  const [loaded, setLoaded] = useState(false);
  const onCheckboxToggleRef = useRef(onCheckboxToggle);
  onCheckboxToggleRef.current = onCheckboxToggle;
  const { colors, isDark } = useThemeColors();
  const theme = getMarkdownThemeFromPalette(colors, isDark);

  // Use stable empty shell so WebView doesn't reload when html changes; we update content via inject only.
  const initialHtml = useRef<string | null>(null);
  if (initialHtml.current === null) {
    initialHtml.current = getPreviewFullHtml("", theme);
  }
  const sourceHtml = initialHtml.current;

  // When theme changes, inject full preview CSS from single source of truth so preview colors update without full reload
  useEffect(() => {
    if (!loaded || Platform.OS === "web") return;
    const css = getPreviewCss(theme);
    const script = `(function(){var s=document.getElementById('preview-theme-override');if(!s){s=document.createElement('style');s.id='preview-theme-override';document.head.appendChild(s);}s.textContent=${JSON.stringify(css)};})(); true;`;
    webViewRef.current?.injectJavaScript(script);
  }, [
    loaded,
    theme.foreground,
    theme.muted,
    theme.mutedForeground,
    theme.ring,
    theme.background,
    theme.link,
    theme.linkUrl,
    theme.codeBackground,
    theme.blockquoteBorder,
    theme.isDark,
  ]);

  const injectContent = useCallback(
    (bodyHtml: string) => {
      if (Platform.OS === "web") return;
      const escaped = JSON.stringify(bodyHtml || "");
      // Set content then replace checkboxes at staggered delays so DOM is ready (WebView can be slow)
      const script = `(function(){
        var html = ${escaped};
        var el = document.getElementById('content');
        if(el) {
          el.innerHTML = html;
          var run = function() { ${REPLACE_CHECKBOXES_SCRIPT} ${ADD_CODE_COPY_BUTTONS_SCRIPT} };
          setTimeout(run, 0);
          setTimeout(run, 80);
          setTimeout(run, 250);
        }
      })(); true;`;
      webViewRef.current?.injectJavaScript(script);
    },
    []
  );

  useEffect(() => {
    if (!loaded) return;
    injectContent(html || "");
  }, [loaded, html, injectContent]);

  const onLoadEnd = useCallback(() => {
    setLoaded(true);
    injectContent(html || "");
  }, [html, injectContent]);

  const showCopyCheckmarkScript = useCallback((index: number) => {
    const CHECK_SVG =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    const COPY_SVG =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
    const checkSvg = JSON.stringify(CHECK_SVG);
    const copySvg = JSON.stringify(COPY_SVG);
    return `(function(){ var idx = ${index}; var cs = ${checkSvg}; var cp = ${copySvg}; function run(){ var el = document.getElementById("content"); if(!el) return; var btns = el.querySelectorAll(".code-copy-btn"); var btn = btns[idx]; if(btn){ btn.classList.add("copied"); btn.innerHTML = cs; setTimeout(function(){ btn.classList.remove("copied"); btn.innerHTML = cp; }, 2000); } } if(typeof requestAnimationFrame !== "undefined") requestAnimationFrame(run); else setTimeout(run, 50); })(); true;`;
  }, []);

  const handleMessage = useCallback(
    async (event: { nativeEvent: { data: string } }) => {
      try {
        const data = JSON.parse(event.nativeEvent.data) as {
          type?: string;
          taskIndex?: number;
          text?: string;
          index?: number;
        };
        if (data?.type === "toggleCheckbox" && typeof data.taskIndex === "number") {
          onCheckboxToggleRef.current?.(data.taskIndex);
          return;
        }
        if (data?.type === "copyCode" && typeof data.text === "string") {
          await Clipboard.setStringAsync(data.text);
          const index = typeof data.index === "number" ? data.index : 0;
          webViewRef.current?.injectJavaScript(showCopyCheckmarkScript(index));
        }
      } catch {
        // ignore non-JSON or invalid messages
      }
    },
    [showCopyCheckmarkScript]
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.muted }, contentContainerStyle]}>
      <WebView
        ref={webViewRef}
        source={{ html: sourceHtml }}
        onLoadEnd={onLoadEnd}
        onMessage={handleMessage}
        style={[styles.webview, { backgroundColor: "transparent" }]}
        scrollEnabled={true}
        nestedScrollEnabled={true}
        showsVerticalScrollIndicator
        originWhitelist={["*"]}
        javaScriptEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: "100%", height: "100%", minHeight: 200 },
  webview: { flex: 1, width: "100%", height: "100%" },
});
