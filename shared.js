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
      window.__ca.HOST = root;
      window.__ca.state = { theme: 'dark', panelOpen: false, anchors: [] };

      var eventListeners = {};

      function eventOn(event, fn) {
        if (!eventListeners[event]) eventListeners[event] = [];
        eventListeners[event].push(fn);
      }

      function eventOff(event, fn) {
        if (!eventListeners[event]) return;
        if (!fn) {
          eventListeners[event] = [];
          return;
        }
        eventListeners[event] = eventListeners[event].filter(function(l) { return l !== fn; });
      }

      function eventEmit(event, data) {
        if (!eventListeners[event]) return;
        for (var i = 0; i < eventListeners[event].length; i++) {
          eventListeners[event][i](data);
        }
      }

      window.__ca.events = { on: eventOn, off: eventOff, emit: eventEmit };

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

      function $create(tag, attrs, children) {
        var el = document.createElement(tag);
        if (attrs) {
          for (var key in attrs) {
            if (attrs.hasOwnProperty(key)) {
              if (key === 'className') {
                el.className = attrs[key];
              } else if (key === 'textContent') {
                el.textContent = attrs[key];
              } else if (key === 'style' && typeof attrs[key] === 'object') {
                Object.assign(el.style, attrs[key]);
              } else if (key.indexOf('on') === 0) {
                el.addEventListener(key.substring(2).toLowerCase(), attrs[key]);
              } else {
                el.setAttribute(key, attrs[key]);
              }
            }
          }
        }
        if (children) {
          for (var i = 0; i < children.length; i++) {
            if (children[i]) {
              if (typeof children[i] === 'string') {
                el.appendChild(document.createTextNode(children[i]));
              } else {
                el.appendChild(children[i]);
              }
            }
          }
        }
        return el;
      }

      function $append(el) {
        if (typeof el === 'string') {
          var parser = new DOMParser();
          var doc = parser.parseFromString(el, 'text/html');
          var body = doc.body;
          while (body.firstChild) shadow.appendChild(body.firstChild);
        } else {
          shadow.appendChild(el);
        }
      }

      function detectTheme() {
        if (document.body && document.body.classList.contains('dark-theme')) return 'dark';
        if (document.body && document.body.classList.contains('light-theme')) return 'light';
        return 'dark';
      }

      window.__ca.shared = { esc: esc, escAttr: escAttr, $id: $id, $one: $one, $create: $create, $append: $append, detectTheme: detectTheme };
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