(function() {
  'use strict';

  function createRoot() {
    try {
      var root = document.createElement('div');
      root.id = 'ca-root';
      root.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:2147483647;';
      document.documentElement.appendChild(root);

      var shadow = root.attachShadow({ mode: 'closed' });

      var style = document.createElement('style');
      style.textContent = '@import url("' + chrome.runtime.getURL('anchor.css') + '");';
      shadow.appendChild(style);

      window.__ca = window.__ca || {};
      window.__ca.ROOT = shadow;
      window.__ca.state = { theme: 'dark', panelOpen: false, anchors: [] };

      function esc(str) {
        if (str == null) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
      }

      function escAttr(val) {
        if (val == null) return '';
        return String(val).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      }

      function $id(id) { return shadow.getElementById(id); }
      function $one(sel) { return shadow.querySelector(sel); }
      function $append(el) {
        if (typeof el === 'string') {
          var temp = document.createElement('div');
          temp.innerHTML = el;
          while (temp.firstChild) shadow.appendChild(temp.firstChild);
        } else {
          shadow.appendChild(el);
        }
      }

      function detectTheme() {
        if (document.body && document.body.classList.contains('dark-theme')) return 'dark';
        if (document.body && document.body.classList.contains('light-theme')) return 'light';
        return 'dark';
      }

      window.__ca.shared = { esc: esc, escAttr: escAttr, $id: $id, $one: $one, $append: $append, detectTheme: detectTheme };
    } catch(e) {
      console.error('[CA] ERROR:', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createRoot);
  } else {
    createRoot();
  }
})();