"use client";

import { getMarkdownThemeFromPalette, getPreviewCss } from "@/lib/markdown-theme";
import { useThemeColors } from "@/lib/use-theme-colors";
import * as Clipboard from "expo-clipboard";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import WebView from "react-native-webview";
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

/** Injected into WebView: wrap all tables in a horizontal scroll container so wide content can scroll on small screens. */
const WRAP_TABLES_SCRIPT = `
(function(){
  var container = document.getElementById('content');
  if (!container) return;
  var tables = container.querySelectorAll('table');
  for (var i = 0; i < tables.length; i++) {
    var table = tables[i];
    if (table.closest('.markdown-table-scroll')) continue;
    var wrapper = document.createElement('div');
    wrapper.className = 'markdown-table-scroll';
    if (table.parentNode) {
      table.parentNode.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    }
  }
})(); true;
`;

/** Injected into WebView: wrap images with alt text in a <figure> and add <figcaption> to show alt text as caption under image. */
const WRAP_IMAGES_SCRIPT = `
(function(){
  var container = document.getElementById('content');
  if (!container) return;
  var images = container.querySelectorAll('img[alt]');
  for (var i = 0; i < images.length; i++) {
    var img = images[i];
    var alt = (img.getAttribute('alt') || '').trim();
    if (!alt) continue;
    if (img.parentElement && img.parentElement.tagName.toLowerCase() === 'figure') continue;
    var figure = document.createElement('figure');
    figure.className = 'image-with-caption';
    var caption = document.createElement('figcaption');
    caption.textContent = alt;
    if (img.parentNode) {
      img.parentNode.insertBefore(figure, img);
      figure.appendChild(img);
      figure.appendChild(caption);
    }
  }
})(); true;
`;

/** Injected into WebView: after content is updated, ask Mermaid (if loaded) to render any diagrams. */
const RENDER_MERMAID_SCRIPT = `
(function(){
  try {
    if (window.mermaid && typeof window.mermaid.run === 'function') {
      window.mermaid.run({ querySelector: '.mermaid' });
    } else if (window.mermaid && typeof window.mermaid.init === 'function') {
      window.mermaid.init(undefined, document.querySelectorAll('.mermaid'));
    }
  } catch (e) {
    // Ignore failures so other markdown still renders.
  }
})(); true;
`;

/** Injected into WebView: wrap Mermaid diagrams in a .mermaid-block with joystick + copy controls, mirroring web behavior. */
const ENHANCE_MERMAID_SCRIPT = `
(function(){
  try {
    var container = document.getElementById('content');
    if (!container) return;
    var mermaids = container.querySelectorAll('.mermaid');
    if (!mermaids.length) return;

    var CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    var COPY_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
    var RESET_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9"/><polyline points="21 3 21 9 15 9"/></svg>';
    var ZOOM_IN_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
    var ZOOM_OUT_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="8" y1="11" x2="14" y2="11"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
    var ARROW_UP_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>';
    var ARROW_DOWN_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>';
    var ARROW_LEFT_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>';
    var ARROW_RIGHT_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';

    function makeButton(opts) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.innerHTML = opts.html;
      btn.setAttribute('aria-label', opts.ariaLabel);
      if (opts.extraClassName) btn.className = opts.extraClassName;
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        opts.onClick();
      });
      return btn;
    }

    mermaids.forEach(function(node) {
      if (node.parentElement && node.parentElement.classList.contains('mermaid-block')) return;

      var source = node.getAttribute('data-mermaid-source') || node.textContent || '';
      var wrapper = document.createElement('div');
      wrapper.className = 'mermaid-block';

      var controls = document.createElement('div');
      controls.className = 'mermaid-controls';

      var scale = 1;
      var offsetX = 0;
      var offsetY = 0;
      function applyTransform() {
        node.style.transformOrigin = 'center center';
        node.style.transform = 'translate(' + offsetX + 'px,' + offsetY + 'px) scale(' + scale + ')';
      }

      var PAN_STEP = 40;

      var upBtn = makeButton({
        html: ARROW_UP_SVG,
        ariaLabel: 'Pan up',
        onClick: function() { offsetY += PAN_STEP; applyTransform(); }
      });
      upBtn.style.gridArea = 'up';

      var downBtn = makeButton({
        html: ARROW_DOWN_SVG,
        ariaLabel: 'Pan down',
        onClick: function() { offsetY -= PAN_STEP; applyTransform(); }
      });
      downBtn.style.gridArea = 'down';

      var leftBtn = makeButton({
        html: ARROW_LEFT_SVG,
        ariaLabel: 'Pan left',
        onClick: function() { offsetX += PAN_STEP; applyTransform(); }
      });
      leftBtn.style.gridArea = 'left';

      var rightBtn = makeButton({
        html: ARROW_RIGHT_SVG,
        ariaLabel: 'Pan right',
        onClick: function() { offsetX -= PAN_STEP; applyTransform(); }
      });
      rightBtn.style.gridArea = 'right';

      var zoomInBtn = makeButton({
        html: ZOOM_IN_SVG,
        ariaLabel: 'Zoom in',
        onClick: function() { scale = Math.min(scale + 0.25, 3); applyTransform(); }
      });
      zoomInBtn.style.gridArea = 'zoomIn';

      var zoomOutBtn = makeButton({
        html: ZOOM_OUT_SVG,
        ariaLabel: 'Zoom out',
        onClick: function() { scale = Math.max(scale - 0.25, 0.5); applyTransform(); }
      });
      zoomOutBtn.style.gridArea = 'zoomOut';

      var resetBtn = makeButton({
        html: RESET_SVG,
        ariaLabel: 'Reset zoom',
        onClick: function() { scale = 1; offsetX = 0; offsetY = 0; applyTransform(); }
      });
      resetBtn.style.gridArea = 'reset';

      controls.appendChild(zoomInBtn);
      controls.appendChild(upBtn);
      controls.appendChild(leftBtn);
      controls.appendChild(resetBtn);
      controls.appendChild(rightBtn);
      controls.appendChild(zoomOutBtn);
      controls.appendChild(downBtn);

      var copyBtn = makeButton({
        html: COPY_SVG,
        ariaLabel: 'Copy mermaid source',
        extraClassName: 'mermaid-copy-btn',
        onClick: function() {
          if (!source) return;
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'copyCode', text: source, index: -1 }));
          } else if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(source).catch(function(){});
          }
          copyBtn.classList.add('copied');
          copyBtn.innerHTML = CHECK_SVG;
          setTimeout(function() {
            copyBtn.classList.remove('copied');
            copyBtn.innerHTML = COPY_SVG;
          }, 2000);
        }
      });

      var parent = node.parentNode;
      if (parent) {
        parent.insertBefore(wrapper, node);
        wrapper.appendChild(controls);
        wrapper.appendChild(node);
        wrapper.appendChild(copyBtn);
      }
      applyTransform();
    });
  } catch (e) {
    // Ignore errors to avoid breaking preview on native.
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
    const script = `(function(){
      try {
        var s=document.getElementById('preview-theme-override');
        if(!s){
          s=document.createElement('style');
          s.id='preview-theme-override';
          document.head.appendChild(s);
        }
        s.textContent=${JSON.stringify(css)};
        if(window.mermaid && typeof window.mermaid.initialize === 'function'){
          window.mermaid.initialize({
            startOnLoad: false,
            securityLevel: 'loose',
            theme: ${theme.isDark ? "'dark'" : "'default'"}
          });
        }
        ${RENDER_MERMAID_SCRIPT}
        ${ENHANCE_MERMAID_SCRIPT}
      } catch(e) {}
    })(); true;`;
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
          var run = function() { ${REPLACE_CHECKBOXES_SCRIPT} ${ADD_CODE_COPY_BUTTONS_SCRIPT} ${WRAP_TABLES_SCRIPT} ${WRAP_IMAGES_SCRIPT} ${RENDER_MERMAID_SCRIPT} ${ENHANCE_MERMAID_SCRIPT} };
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
