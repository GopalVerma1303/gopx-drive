import type { PreviewThemeColors } from "./preview-styles";
import { getPreviewCss } from "./preview-styles";

/**
 * Build full HTML document for WebView. Uses theme colors and wraps body in .markdown-preview.
 *
 * Also wires in Mermaid via CDN so that `<div class="mermaid">` blocks produced
 * by the markdown pipeline can be rendered as diagrams inside the WebView.
 * The actual rendering is triggered after content injection from
 * `MarkdownPreviewWebView` so the HTML is always up to date.
 */
export function getPreviewFullHtml(bodyHtml: string, colors: PreviewThemeColors): string {
  const css = getPreviewCss(colors);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <style>
    html, body { margin: 0; padding: 0; height: 100%; background-color: transparent; }
    ${css}
  </style>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.css" crossorigin="anonymous">
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.js" crossorigin="anonymous"></script>
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/contrib/auto-render.min.js" crossorigin="anonymous"></script>
  <!-- Mermaid runtime for native WebView; diagrams are rendered on-demand after content injection. -->
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <script>
    (function() {
      try {
        if (window.mermaid) {
          window.mermaid.initialize({
            startOnLoad: false,
            securityLevel: "loose",
            theme: ${colors.isDark ? '"dark"' : '"default"'}
          });
        }
      } catch (e) {}
    })();

    (function() {
      var _q = "", _idx = 0, _obs = null, _t = null, _busy = false, _last = -1;

      function report(c) {
        if (_last !== c) {
          _last = c;
          if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({type:'searchCount', count:c}));
        }
      }

      function highlight(el, queryChanged, qOverride, idxOverride) {
        if (!el || _busy) return;
        _busy = true;
        
        var q = (qOverride !== undefined) ? qOverride : _q;
        var idx = (idxOverride !== undefined) ? idxOverride : _idx;
        
        try {
          var spans = el.querySelectorAll('span.search-highlight');
          
          // Smart Navigation
          if (!queryChanged && q && spans.length > 0) {
            for (var i = 0; i < spans.length; i++) {
              var s = spans[i];
              var isActive = (i === idx);
              var cls = isActive ? 'search-highlight active' : 'search-highlight';
              if (s.className !== cls) s.className = cls;
              if (isActive && el.id === 'content') s.scrollIntoView({ behavior: 'auto', block: 'center' });
            }
            report(spans.length);
            return;
          }

          // Full Highlight
          for (var i = 0; i < spans.length; i++) {
            var s = spans[i];
            var t = document.createTextNode(s.textContent);
            if (s.parentNode) s.parentNode.replaceChild(t, s);
          }
          el.normalize();

          if (!q) {
            report(0);
            return;
          }

          var matches = [], walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
          var n, lq = q.toLowerCase();
          while(n = walker.nextNode()) {
            var p = n.parentNode;
            if (p && /(style|script|button|svg|code)/i.test(p.tagName)) continue;
            var txt = n.textContent, ltxt = txt.toLowerCase(), start = 0, hit;
            while((hit = ltxt.indexOf(lq, start)) !== -1) {
              matches.push({ node: n, index: hit });
              start = hit + lq.length;
            }
          }

          for (var i = matches.length - 1; i >= 0; i--) {
            var m = matches[i], node = m.node, text = node.textContent;
            var b = text.substring(0, m.index), mid = text.substring(m.index, m.index + q.length), a = text.substring(m.index + q.length);
            var span = document.createElement('span');
            span.className = (i === idx) ? 'search-highlight active' : 'search-highlight';
            span.textContent = mid;
            node.textContent = b;
            var next = document.createTextNode(a);
            node.parentNode.insertBefore(next, node.nextSibling);
            node.parentNode.insertBefore(span, next);
            if (i === idx && el.id === 'content') span.scrollIntoView({ behavior: 'auto', block: 'center' });
          }
          report(matches.length);
        } finally {
          _busy = false;
        }
      }

      window.searchNote = function(q, i) {
        var queryChanged = (_q !== (q || ""));
        _q = q || "";
        _idx = i || 0;
        var el = document.getElementById('content');
        if (el) {
          if (_obs) _obs.disconnect();
          highlight(el, queryChanged);
          if (_obs) _obs.observe(el, { childList: true, subtree: true, characterData: true });
        }
      };

      var init = function() {
        var el = document.getElementById('content');
        if (el && !_obs) {
          _obs = new MutationObserver(function(mutations) {
            var isOurSpan = mutations.some(function(m) { 
               return (m.target.classList && m.target.classList.contains('search-highlight')) || 
                      (m.target.parentNode && m.target.parentNode.classList && m.target.parentNode.classList.contains('search-highlight'));
            });
            if (isOurSpan) return;
            
            clearTimeout(_t);
            _t = setTimeout(function() {
               if (_obs) _obs.disconnect();
               highlight(el, true);
               if (_obs) _obs.observe(el, { childList: true, subtree: true, characterData: true });
            }, 50);
          });
          _obs.observe(el, { childList: true, subtree: true, characterData: true });
        }
      };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
      else init();
      
      // Export for use in pre-rendering
      window.__highlightElement = highlight;
    })();
  </script>
</head>
<body>
  <div id="content" class="markdown-preview" style="width:100%;min-height:100%;margin:0;">${bodyHtml}</div>
</body>
</html>`;
}
