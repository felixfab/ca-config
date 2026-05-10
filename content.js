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
      renderPanel();
      renderToast();
      setupSelectionObserver();
      setupPromptInterceptor();
      setupTurnDecrementObserver();
      setupPanelEvents();
      setupTriggerZoneHover();
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

  function renderPanel() {
    var theme = window.__ca.shared.detectTheme();
    var html = '<div id="ca-panel" class="ca-panel" theme="' + theme + '">' +
      '<div class="ca-panel-header">' +
      '<h2 class="ca-panel-title">Anchors</h2>' +
      '<button class="ca-panel-close" data-action="close-panel" aria-label="Close panel">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
      '<path d="M18 6L6 18M6 6l12 12"/>' +
      '</svg>' +
      '</button>' +
      '</div>' +
      '<div class="ca-panel-body">' +
      '<ul class="ca-anchor-list" id="ca-anchor-list"></ul>' +
      '</div>' +
      '<div class="ca-panel-footer">' +
      '<button class="ca-btn-clear" data-action="clear-expired">Clear Expired</button>' +
      '</div>' +
      '</div>';
    window.__ca.shared.$append(html);
    updateAnchorList();
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

  function updateAnchorList() {
    var list = window.__ca.shared.$id('ca-anchor-list');
    var anchors = window.__ca.storage.getAll();

    if (anchors.length === 0) {
      list.innerHTML = '<div class="ca-empty-state">' +
        '<svg viewBox="0 0 24 24" fill="currentColor">' +
        '<path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>' +
        '</svg>' +
        '<p>No anchors yet.<br/>Highlight text to create one.</p>' +
        '</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < anchors.length; i++) {
      var a = anchors[i];
      var isExpired = a.turnsRemaining === 0;
      var isExpiring = !isExpired && a.turnsRemaining <= 3;
      var itemClass = 'ca-anchor-item' + (a.active ? '' : ' inactive');

      html += '<li class="' + itemClass + '" data-id="' + window.__ca.shared.escAttr(a.id) + '">' +
        '<div class="ca-anchor-content">' +
        '<p class="ca-anchor-text">' + window.__ca.shared.esc(a.text) + '</p>' +
        '<div class="ca-anchor-meta">' +
        '<span class="ca-anchor-turns' + (isExpiring ? ' expiring' : '') + (isExpired ? ' expired' : '') + '">' +
        window.__ca.shared.esc(a.turnsRemaining) + '/' + window.__ca.shared.esc(a.turnsTotal) + '</span>' +
        '</div>' +
        '</div>' +
        '<div class="ca-anchor-actions">' +
        '<div class="ca-toggle ' + (a.active ? 'active' : '') + '" data-action="toggle-anchor" data-id="' + window.__ca.shared.escAttr(a.id) + '"></div>' +
        '<button class="ca-btn-icon" data-action="delete-anchor" data-id="' + window.__ca.shared.escAttr(a.id) + '" aria-label="Delete anchor">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
        '<path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>' +
        '</svg>' +
        '</button>' +
        '</div>' +
        '</li>';
    }
    list.innerHTML = html;
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
          updateAnchorList();
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

        var contextParts = [];
        for (var i = 0; i < activeAnchors.length; i++) {
          contextParts.push('[CONTEXT: ' + activeAnchors[i].text + ']');
        }
        var contextPrefix = contextParts.join(' ') + ' ';
        inputEl.textContent = contextPrefix + inputText;
      });

      inputEl.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          var activeAnchors = window.__ca.storage.getActive();
          if (activeAnchors.length === 0) return;

          var inputText = inputEl.textContent || '';
          if (inputText.length === 0) return;

          var contextParts = [];
          for (var i = 0; i < activeAnchors.length; i++) {
            contextParts.push('[CONTEXT: ' + activeAnchors[i].text + ']');
          }
          var contextPrefix = contextParts.join(' ') + ' ';
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
                  updateAnchorList();
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

  function setupPanelEvents() {
    var panel = window.__ca.shared.$id('ca-panel');
    if (!panel) return;

    panel.addEventListener('click', function(e) {
      var target = e.target.closest('[data-action]');
      if (!target) return;

      var action = target.dataset.action;
      var id = target.dataset.id;

      if (action === 'toggle-panel') {
        panel.classList.toggle('open');
      } else if (action === 'close-panel') {
        panel.classList.remove('open');
      } else if (action === 'toggle-anchor' && id) {
        window.__ca.storage.toggleAnchor(id);
        updateAnchorList();
      } else if (action === 'delete-anchor' && id) {
        window.__ca.storage.deleteAnchor(id);
        updateAnchorList();
      } else if (action === 'clear-expired') {
        window.__ca.storage.clearExpired();
        updateAnchorList();
      }
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

  document.addEventListener('DOMContentLoaded', function() {
    init();
  });

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    init();
  }
})();