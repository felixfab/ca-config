(function() {
  'use strict';

  var SELECTORS = {
    input: 'div[role="textbox"][aria-label="Enter a prompt for Gemini"]',
    sendButton: 'button[aria-label="Send message"]',
    chatHistory: '#chat-history'
  };

  var lastUserMessageIndex = -1;
  var selectionButton = null;
  var toast = null;
  var inputSetup = false;

  function init() {
    if (!window.__ca || !window.__ca.shared) {
      setTimeout(init, 100);
      return;
    }
    window.__ca.storage.init(function() {
      renderTriggerZone();
      renderToast();
      window.__ca.panel.renderPanel();
      setupSelectionObserver();
      setupPromptInterceptor();
      setupTurnDecrementObserver();
      setupTriggerZoneHover();
      setupKeyboardShortcuts();
    });
  }

  function renderTriggerZone() {
    var html = '<div class="ca-trigger-zone" data-action="toggle-panel">' +
      '<div class="ca-trigger-icon">' +
      '<svg viewBox="0 0 24 24"><path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>' +
      '</div>' +
      '</div>';
    window.__ca.shared.$append(html);
  }

  function renderToast() {
    var html = '<div id="ca-toast" class="ca-toast"></div>';
    window.__ca.shared.$append(html);
    toast = window.__ca.shared.$id('ca-toast');
  }

  function showToast(message, type) {
    type = type || '';
    toast.textContent = message;
    toast.className = 'ca-toast visible ' + type;
    setTimeout(function() {
      toast.className = 'ca-toast';
    }, 2000);
  }

  function buildContextPrefix(activeAnchors) {
    var contextParts = [];
    for (var i = 0; i < activeAnchors.length; i++) {
      contextParts.push('[CONTEXT: ' + activeAnchors[i].text + ']');
    }
    return contextParts.join(' ') + ' ';
  }

  function setupSelectionObserver() {
    document.addEventListener('mouseup', function(e) {
      var selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        return;
      }

      var text = selection.toString().trim();
      if (text.length === 0) {
        return;
      }

      var range = selection.getRangeAt(0);
      var rect = range.getBoundingClientRect();
      var selectedText = selection.toString().trim();

      removeSelectionButton();

      var btn = document.createElement('div');
      btn.className = 'ca-selection-button';
      btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>';
      btn.style.cssText = 'position:fixed;left:' + (rect.right + 8) + 'px;top:' + (rect.top + rect.height / 2 - 16) + 'px;z-index:2147483646;background:#4285f4;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.3);cursor:pointer;pointer-events:auto;';

      btn.addEventListener('click', function(evt) {
        evt.preventDefault();
        evt.stopPropagation();
        if (selectedText.length > 0) {
          window.__ca.storage.createAnchor(selectedText, window.location.href, 10);
          btn.innerHTML = '<svg viewBox="0 0 24 24" fill="white"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
          btn.style.background = '#81c995';
          showToast('Anchor saved', 'success');
          window.__ca.events.emit('anchors:changed');
          setTimeout(function() {
            removeSelectionButton();
          }, 1000);
        }
      });

      document.body.appendChild(btn);
      selectionButton = btn;
    });

    document.addEventListener('mousedown', function(e) {
      if (selectionButton && !selectionButton.contains(e.target)) {
        removeSelectionButton();
      }
    });
  }

  function removeSelectionButton() {
    if (selectionButton && selectionButton.parentNode) {
      selectionButton.parentNode.removeChild(selectionButton);
      selectionButton = null;
    }
  }

  function setupPromptInterceptor() {
    function trySetup() {
      var inputEl = document.querySelector(SELECTORS.input);
      var sendBtn = document.querySelector(SELECTORS.sendButton);

      if (!inputEl || !sendBtn) {
        setTimeout(trySetup, 500);
        return;
      }

      if (inputSetup) return;
      inputSetup = true;

      sendBtn.addEventListener('click', function() {
        var activeAnchors = window.__ca.storage.getActive();
        if (activeAnchors.length === 0) return;

        var inputText = inputEl.textContent || '';
        if (inputText.length === 0) return;

        var contextPrefix = buildContextPrefix(activeAnchors);
        inputEl.textContent = contextPrefix + inputText;
      });

      inputEl.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          var activeAnchors = window.__ca.storage.getActive();
          if (activeAnchors.length === 0) return;

          var inputText = inputEl.textContent || '';
          if (inputText.length === 0) return;

          var contextPrefix = buildContextPrefix(activeAnchors);
          inputEl.textContent = contextPrefix + inputText;
        }
      });
    }

    trySetup();
  }

  function setupTurnDecrementObserver() {
    var chatHistory = document.querySelector(SELECTORS.chatHistory);
    if (!chatHistory) return;

    var processedMessages = new Set();

    var observer = new MutationObserver(function(mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var mutation = mutations[i];
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (var j = 0; j < mutation.addedNodes.length; j++) {
            var node = mutation.addedNodes[j];
            if (node.nodeType === Node.ELEMENT_NODE) {
              var msgId = node.querySelector && node.querySelector('[data-test-id="message"]');
              if (msgId && !processedMessages.has(msgId)) {
                processedMessages.add(msgId);
                var userMsg = node.querySelector && node.querySelector('.user-profile-picture, [data-test-id="user-input"]');
                if (userMsg || node.textContent.includes('Enter a prompt')) {
                  window.__ca.storage.decrementTurnsForActive();
                  window.__ca.events.emit('anchors:changed');
                }
              }
            }
          }
        }
      }
    });

    observer.observe(chatHistory, {
      childList: true,
      subtree: true
    });
  }

  function setupTriggerZoneHover() {
    var trigger = window.__ca.shared.$one('.ca-trigger-zone');
    var panel = window.__ca.shared.$id('ca-panel');
    if (!trigger || !panel) return;

    var showTimeout = null;
    var hideTimeout = null;

    trigger.addEventListener('mouseenter', function() {
      clearTimeout(hideTimeout);
      showTimeout = setTimeout(function() {
        panel.classList.add('open');
      }, 100);
    });

    trigger.addEventListener('mouseleave', function() {
      clearTimeout(showTimeout);
      hideTimeout = setTimeout(function() {
        panel.classList.remove('open');
      }, 300);
    });

    panel.addEventListener('mouseenter', function() {
      clearTimeout(hideTimeout);
    });

    panel.addEventListener('mouseleave', function() {
      hideTimeout = setTimeout(function() {
        panel.classList.remove('open');
      }, 300);
    });
  }

  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
      var panel = window.__ca.shared.$id('ca-panel');

      if (e.key === 'Escape') {
        if (panel) panel.classList.remove('open');
      }

      if (e.altKey && e.key === 'a') {
        e.preventDefault();
        navigator.clipboard.readText().then(function(text) {
          if (text && text.trim()) {
            window.__ca.storage.createAnchor(text.trim(), window.location.href, 10);
            showToast('Anchor created from clipboard', 'success');
            window.__ca.events.emit('anchors:changed');
          }
        }).catch(function() {
          showToast('Clipboard access denied', 'error');
        });
      }

      if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        var activeEl = document.activeElement;
        var isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);
        if (!isInput) {
          e.preventDefault();
          var searchInput = window.__ca.shared.$one('.ca-search-input');
          if (searchInput) searchInput.focus();
        }
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function() {
    init();
  });

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    init();
  }
})();