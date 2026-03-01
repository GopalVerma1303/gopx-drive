"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import WebView from "react-native-webview";
import { getMarkdownThemeFromPalette, getPreviewCss } from "@/lib/markdown-theme";
import { useThemeColors } from "@/lib/use-theme-colors";
import { getPreviewFullHtml } from "./getPreviewHtml";

/** Injected into WebView: replace native checkboxes with custom ones that toggle completed/not completed on tap. */
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
    box.className=checked?'md-preview-checkbox checked':'md-preview-checkbox';
    box.innerHTML=checked?svg:'';
    box.onclick=function(e){
      e.preventDefault();
      e.stopPropagation();
      var c=this.getAttribute('aria-checked')==='true';
      c=!c;
      this.setAttribute('aria-checked',c);
      this.classList.toggle('checked',c);
      this.innerHTML=c?svg:'';
    };
    wrap.appendChild(box);
    input.parentNode.replaceChild(wrap,input);
  }
})(); true;
`;

/** Injected into WebView: add copy button; wrap code in scroll div so button stays fixed and does not scroll with code. */
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
    btn.innerHTML = COPY_SVG;
    btn.onclick = (function(txt, b){
      return function(){
        if(typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText){
          navigator.clipboard.writeText(txt).then(function(){
            b.classList.add('copied');
            b.innerHTML = CHECK_SVG;
            setTimeout(function(){ b.classList.remove('copied'); b.innerHTML = COPY_SVG; }, 2000);
          });
        }
      };
    })(text, btn);
    pre.insertBefore(btn, scrollWrap);
  }
})(); true;
`;

interface MarkdownPreviewWebViewProps {
  html: string;
  contentContainerStyle?: object;
}

export function MarkdownPreviewWebView({ html, contentContainerStyle }: MarkdownPreviewWebViewProps) {
  const webViewRef = useRef<WebView>(null);
  const [loaded, setLoaded] = useState(false);
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

  return (
    <View style={[styles.container, { backgroundColor: theme.muted }, contentContainerStyle]}>
      <WebView
        ref={webViewRef}
        source={{ html: sourceHtml }}
        onLoadEnd={onLoadEnd}
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
