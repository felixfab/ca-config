(function() {
  'use strict';

  var searchDebounceTimer = null;
  var currentFilter = 'all';
  var currentSearch = '';
  var currentTab = 'anchors';
  var currentSort = 'newest';
  var selectedIds = [];
  var bulkMode = false;
  var panelLocked = false;
  var editorEscapeHandler = null;

  function init() {
    if (!window.__ca || !window.__ca.shared) {
      setTimeout(init, 100);
      return;
    }
    window.__ca.events.on('anchors:changed', function() {
      if (currentTab === 'anchors') updateAnchorList();
      updateBadge();
    });
    window.__ca.events.on('health:changed', function(state) {
      updateHealthDot(state);
    });
  }

  function updateHealthDot(state) {
    var dot = window.__ca.shared.$id('ca-health-dot');
    if (!dot) return;
    dot.className = 'ca-health-dot ' + state;
    dot.title = state === 'live' ? 'All systems connected' : state === 'degraded' ? 'Some features unavailable' : 'Gemini interface changed - update in progress';
  }

  function renderPanel() {
    var theme = window.__ca.shared.detectTheme();
    var html = '<div id="ca-panel" class="ca-panel" theme="' + theme + '">' +
      '<div class="ca-panel-header">' +
      '<h2 class="ca-panel-title">Anchors</h2>' +
       '<div class="ca-header-actions">' +
       '<span class="ca-health-dot offscreen" id="ca-health-dot" title="Checking..."></span>' +
      '<button class="ca-btn-icon ca-btn-timeline" data-action="open-timeline" aria-label="Open timeline">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>' +
      '</button>' +
      '<button class="ca-btn-icon ca-btn-lock" data-action="toggle-lock" aria-label="Lock panel">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>' +
      '</button>' +
      '<button class="ca-btn-icon ca-btn-bulk" data-action="toggle-bulk" aria-label="Bulk select">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12l2 2 4-4"/></svg>' +
      '</button>' +
      '<button class="ca-panel-close" data-action="close-panel" aria-label="Close panel">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
      '<path d="M18 6L6 18M6 6l12 12"/>' +
      '</svg>' +
      '</button>' +
      '</div>' +
      '</div>' +
      '<div class="ca-tabs">' +
      '<button class="ca-tab active" data-action="switch-tab" data-tab="anchors">Anchors</button>' +
      '<button class="ca-tab" data-action="switch-tab" data-tab="templates">Templates</button>' +
      '</div>' +
      '<div id="ca-tab-anchors" class="ca-tab-content active">' +
      '<div class="ca-panel-search">' +
      '<input type="text" class="ca-search-input" data-action="search" placeholder="Search anchors..." aria-label="Search anchors">' +
      '<select class="ca-filter-select" data-action="filter-status" aria-label="Filter by status">' +
      '<option value="all">All</option>' +
      '<option value="active">Active</option>' +
      '<option value="inactive">Inactive</option>' +
      '<option value="expired">Expired</option>' +
      '<option value="global">Global</option>' +
      '</select>' +
      '</div>' +
      '<div class="ca-toolbar">' +
      '<select class="ca-sort-select" data-action="sort-anchors" aria-label="Sort anchors">' +
      '<option value="newest">Newest</option>' +
      '<option value="most-used">Most Used</option>' +
      '<option value="recently-used">Recently Used</option>' +
      '</select>' +
      '<button class="ca-btn-inject-mode" data-action="cycle-inject-mode" aria-label="Cycle injection mode">' +
      '<span class="ca-inject-label">Prepend</span>' +
      '</button>' +
      '</div>' +
      '<div id="ca-bulk-bar" class="ca-bulk-bar hidden">' +
      '<span class="ca-bulk-count">0 selected</span>' +
      '<button class="ca-btn-bulk-action" data-action="bulk-toggle">Toggle</button>' +
      '<button class="ca-btn-bulk-action" data-action="bulk-extend">+5</button>' +
      '<button class="ca-btn-bulk-action ca-btn-danger" data-action="bulk-delete">Delete</button>' +
      '</div>' +
      '<div class="ca-panel-body">' +
      '<ul class="ca-anchor-list" id="ca-anchor-list"></ul>' +
      '</div>' +
      '<div class="ca-panel-footer">' +
      '<button class="ca-btn-footer" data-action="export-anchors" aria-label="Export anchors">Export</button>' +
      '<button class="ca-btn-footer" data-action="import-anchors" aria-label="Import anchors">Import</button>' +
      '<button class="ca-btn-clear" data-action="clear-expired">Clear Expired</button>' +
      '</div>' +
      '<input type="file" class="ca-import-input" data-action="import-file" accept=".json" aria-label="Import file">' +
      '</div>' +
      '<div id="ca-tab-templates" class="ca-tab-content">' +
      '<div class="ca-panel-body">' +
      '<ul class="ca-template-list" id="ca-template-list"></ul>' +
      '</div>' +
      '<div class="ca-panel-footer">' +
      '<button class="ca-btn-clear" data-action="add-template">+ New Template</button>' +
      '</div>' +
      '</div>' +
      '</div>';
    window.__ca.shared.$append(html);
    renderBadge();
    updateAnchorList();
    updateTemplateList();
    updateBadge();
    updateInjectModeLabel();
    if (window.__ca.state.health && window.__ca.state.health !== 'offline') {
      updateHealthDot(window.__ca.state.health);
    }
    setupPanelEvents();
  }

  function renderBadge() {
    var $create = window.__ca.shared.$create;
    var badge = $create('div', { id: 'ca-context-badge', className: 'ca-context-badge' });
    window.__ca.shared.$append(badge);
  }

  function renderConfirmDialog(message, onConfirm) {
    var $create = window.__ca.shared.$create;
    var esc = window.__ca.shared.esc;

    var overlay = $create('div', { id: 'ca-confirm-overlay', className: 'ca-confirm-overlay' });

    var dialog = $create('div', { className: 'ca-confirm-dialog' });
    var msgP = $create('p', { className: 'ca-confirm-message', textContent: esc(message) });
    dialog.appendChild(msgP);

    var actions = $create('div', { className: 'ca-confirm-actions' });
    var cancelBtn = $create('button', { className: 'ca-btn-cancel', 'data-action': 'confirm-cancel', textContent: 'Cancel' });
    var confirmBtn = $create('button', { className: 'ca-btn-danger', 'data-action': 'confirm-ok', textContent: 'Confirm' });
    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);
    dialog.appendChild(actions);

    overlay.appendChild(dialog);
    window.__ca.shared.$append(overlay);

    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) return removeConfirmDialog();
      var target = e.target.closest('[data-action]');
      if (!target) return;
      removeConfirmDialog();
      if (target.dataset.action === 'confirm-ok' && onConfirm) {
        onConfirm();
      }
    });

    overlay.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        removeConfirmDialog();
      }
    });

    cancelBtn.focus();
  }

  function removeConfirmDialog() {
    var overlay = window.__ca.shared.$id('ca-confirm-overlay');
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  }

  function renderTurnPopup(rect, onCreate) {
    var $create = window.__ca.shared.$create;

    var popup = $create('div', { id: 'ca-turn-popup', className: 'ca-turn-popup' });
    popup.style.left = rect.left + 'px';

    var turnTitle = $create('div', { className: 'ca-turn-popup-title', textContent: 'Turns' });
    popup.appendChild(turnTitle);

    var turnOptions = [1, 3, 5, 10, 25, 50];
    for (var i = 0; i < turnOptions.length; i++) {
      var tBtn = $create('button', { className: 'ca-turn-option', 'data-turns': String(turnOptions[i]), textContent: turnOptions[i] });
      popup.appendChild(tBtn);
    }

    var turnCustom = $create('input', { id: 'ca-turn-custom-val', className: 'ca-turn-custom', type: 'number', min: '1', placeholder: 'Custom' });
    popup.appendChild(turnCustom);

    var turnSetBtn = $create('button', { className: 'ca-turn-option ca-turn-custom-btn', textContent: 'Set' });
    popup.appendChild(turnSetBtn);

    var divider = $create('div', { className: 'ca-turn-popup-divider' });
    popup.appendChild(divider);

    var ttlTitle = $create('div', { className: 'ca-turn-popup-title', textContent: 'TTL (idle expiry)' });
    popup.appendChild(ttlTitle);

    var ttlOptions = [1, 6, 12, 24];
    for (var ti = 0; ti < ttlOptions.length; ti++) {
      var ttBtn = $create('button', { className: 'ca-turn-option', 'data-ttl': String(ttlOptions[ti]), textContent: ttlOptions[ti] + 'h' });
      popup.appendChild(ttBtn);
    }
    var ttlDays = [3, 7, 30];
    for (var td = 0; td < ttlDays.length; td++) {
      var tdLabel = ttlDays[td] === 7 ? '7d' : ttlDays[td] === 30 ? '30d' : '3d';
      var tdBtn = $create('button', { className: 'ca-turn-option', 'data-ttl': String(ttlDays[td] * 24), textContent: tdLabel });
      popup.appendChild(tdBtn);
    }

    var noTtlBtn = $create('button', { className: 'ca-turn-option ca-ttl-none', 'data-ttl': 'none', textContent: 'No TTL' });
    popup.appendChild(noTtlBtn);

    var ttlCustom = $create('input', { id: 'ca-ttl-custom-val', className: 'ca-turn-custom', type: 'number', min: '1', placeholder: 'Custom hrs' });
    popup.appendChild(ttlCustom);

    var ttlSetBtn = $create('button', { className: 'ca-turn-option ca-turn-custom-btn', textContent: 'Set' });
    popup.appendChild(ttlSetBtn);

    var createBtn = $create('button', { className: 'ca-turn-option ca-create-btn', textContent: 'Create' });
    popup.appendChild(createBtn);

    popup.style.visibility = 'hidden';
    popup.style.position = 'fixed';
    popup.style.top = '0';
    window.__ca.shared.$append(popup);

    var actualHeight = popup.getBoundingClientRect().height;
    popup.style.visibility = '';

    var popupTop = rect.bottom + 8;
    if (popupTop + actualHeight > window.innerHeight - 16) {
      var aboveTop = rect.top - actualHeight - 8;
      if (aboveTop >= 8) {
        popupTop = aboveTop;
      } else {
        popupTop = 8;
        popup.style.maxHeight = (window.innerHeight - 24) + 'px';
        popup.style.overflowY = 'auto';
      }
    }
    popup.style.top = popupTop + 'px';

    var selectedTurns = null;
    var selectedTTL = null;

    popup.addEventListener('click', function(e) {
      var target = e.target.closest('[data-turns]');
      if (target) {
        selectedTurns = parseInt(target.dataset.turns, 10);
        highlightTurnOption(popup, selectedTurns);
        return;
      }
      if (e.target === turnSetBtn) {
        var cVal = parseInt(turnCustom.value, 10);
        if (cVal > 0) {
          selectedTurns = cVal;
          highlightTurnOption(popup, cVal);
        }
        return;
      }
      var ttlTarget = e.target.closest('[data-ttl]');
      if (ttlTarget) {
        selectedTTL = ttlTarget.dataset.ttl === 'none' ? null : parseInt(ttlTarget.dataset.ttl, 10);
        highlightTTLOption(popup, selectedTTL);
        return;
      }
      if (e.target === ttlSetBtn) {
        var tVal = parseInt(ttlCustom.value, 10);
        if (tVal > 0) {
          selectedTTL = tVal;
          highlightTTLOption(popup, tVal);
        }
        return;
      }
      if (e.target === createBtn) {
        if (selectedTurns === null) selectedTurns = 10;
        onCreate(selectedTurns, selectedTTL);
        removeTurnPopup();
      }
    });

    var dismissHandler = function(e) {
      if (!popup.contains(e.target)) {
        removeTurnPopup();
      }
    };
    popup._dismissHandler = dismissHandler;
    window.__ca.ROOT.addEventListener('mousedown', dismissHandler);

    popup._docHandler = function(e) {
      if (e.target !== window.__ca.HOST) {
        removeTurnPopup();
      }
    };
    document.addEventListener('mousedown', popup._docHandler);
  }

  function highlightTurnOption(popup, value) {
    var buttons = popup.querySelectorAll('[data-turns]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].className = 'ca-turn-option';
    }
    var matched = popup.querySelector('[data-turns="' + value + '"]');
    if (matched) matched.className = 'ca-turn-option selected';
  }

  function highlightTTLOption(popup, value) {
    var buttons = popup.querySelectorAll('[data-ttl]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].className = 'ca-turn-option';
    }
    if (value === null) {
      var noneBtn = popup.querySelector('[data-ttl="none"]');
      if (noneBtn) noneBtn.className = 'ca-turn-option selected';
    } else {
      var valStr = String(value);
      var matched = popup.querySelector('[data-ttl="' + valStr + '"]');
      if (matched) matched.className = 'ca-turn-option selected';
    }
  }

  function removeTurnPopup() {
    var popup = window.__ca.shared.$id('ca-turn-popup');
    if (popup && popup.parentNode) {
      if (popup._dismissHandler) {
        window.__ca.ROOT.removeEventListener('mousedown', popup._dismissHandler);
      }
      if (popup._docHandler) {
        document.removeEventListener('mousedown', popup._docHandler);
      }
      popup.parentNode.removeChild(popup);
    }
  }

  function updateBadge() {
    var badge = window.__ca.shared.$id('ca-context-badge');
    if (!badge) return;
    var active = window.__ca.storage.getActive();
    if (active.length > 0) {
      badge.textContent = active.length + ' anchor' + (active.length > 1 ? 's' : '') + ' active';
      badge.className = 'ca-context-badge visible';
    } else {
      badge.className = 'ca-context-badge';
    }
  }

  function updateInjectModeLabel() {
    var label = window.__ca.shared.$one('.ca-inject-label');
    if (label) {
      var mode = window.__ca.storage.getInjectionMode();
      label.textContent = mode === 'append' ? 'Append' : 'Prepend';
    }
  }

  function getFilteredAnchors() {
    var anchors = window.__ca.storage.getSorted(currentSort);
    var filtered = anchors;

    if (currentFilter === 'active') {
      filtered = filtered.filter(function(a) { return a.active && a.turnsRemaining > 0; });
    } else if (currentFilter === 'inactive') {
      filtered = filtered.filter(function(a) { return !a.active || a.turnsRemaining === 0; });
    } else if (currentFilter === 'expired') {
      filtered = filtered.filter(function(a) { return a.turnsRemaining === 0; });
    } else if (currentFilter === 'global') {
      filtered = filtered.filter(function(a) { return a.global; });
    }

    if (currentSearch) {
      var term = currentSearch.toLowerCase();
      filtered = filtered.filter(function(a) {
        return a.text.toLowerCase().indexOf(term) !== -1 ||
          (a.sourceUrl && a.sourceUrl.toLowerCase().indexOf(term) !== -1) ||
          (a.tags && a.tags.some(function(t) { return t.toLowerCase().indexOf(term) !== -1; }));
      });
    }

    return filtered;
  }

  function buildAnchorItem(a) {
    var $create = window.__ca.shared.$create;
    var esc = window.__ca.shared.esc;

    var isExpired = a.turnsRemaining === 0;
    var isExpiring = !isExpired && a.turnsRemaining <= 3;
    var itemClass = 'ca-anchor-item' + (a.active ? '' : ' inactive');
    if (a.global) itemClass += ' global';

    var turnsClass = 'ca-anchor-turns' + (isExpiring ? ' expiring' : '') + (isExpired ? ' expired' : '');

    var li = $create('li', { className: itemClass, 'data-id': a.id });

    if (bulkMode) {
      var cb = $create('div', {
        className: 'ca-bulk-checkbox' + (selectedIds.indexOf(a.id) !== -1 ? ' checked' : ''),
        'data-action': 'bulk-select',
        'data-id': a.id
      });
      li.appendChild(cb);
    }

    var content = $create('div', { className: 'ca-anchor-content' });

    var textP = $create('p', {
      className: 'ca-anchor-text',
      textContent: esc(a.text),
      'data-action': 'expand-text',
      'data-id': a.id
    });
    content.appendChild(textP);

    var meta = $create('div', { className: 'ca-anchor-meta' });

    var turnsSpan = $create('span', { className: turnsClass, textContent: esc(a.turnsRemaining) + '/' + esc(a.turnsTotal) });
    meta.appendChild(turnsSpan);

    if (a.ttlHours !== null && a.ttlExpiresAt !== null) {
      var ttlRemaining = a.ttlExpiresAt - Date.now();
      if (ttlRemaining > 0) {
        var ttlClass = 'ca-ttl-pill' + (ttlRemaining < 3600000 ? ' warning' : '');
        var ttlText = ttlRemaining < 3600000 ? Math.ceil(ttlRemaining / 60000) + 'm' : Math.ceil(ttlRemaining / 3600000) + 'h';
        var ttlPill = $create('span', { className: ttlClass, textContent: '⏳ ' + ttlText });
        meta.appendChild(ttlPill);
      }
    }

    if (a.tags && a.tags.length > 0) {
      for (var t = 0; t < a.tags.length; t++) {
        var tagSpan = $create('span', { className: 'ca-tag', 'data-action': 'remove-tag', 'data-id': a.id, 'data-tag': a.tags[t], textContent: '#' + esc(a.tags[t]) });
        meta.appendChild(tagSpan);
      }
    }

    var globalBtn = $create('button', {
      className: 'ca-btn-global' + (a.global ? ' active' : ''),
      'data-action': 'toggle-global',
      'data-id': a.id,
      textContent: a.global ? 'Global' : 'Local'
    });
    meta.appendChild(globalBtn);

    var extendBtn = $create('button', { className: 'ca-btn-extend', 'data-action': 'extend-turns', 'data-id': a.id, textContent: '+5', 'aria-label': 'Extend turns' });
    meta.appendChild(extendBtn);

    var editBtn = $create('button', { className: 'ca-btn-edit', 'data-action': 'edit-anchor', 'data-id': a.id, 'aria-label': 'Edit anchor' });
    var editSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    editSvg.setAttribute('viewBox', '0 0 24 24');
    editSvg.setAttribute('fill', 'none');
    editSvg.setAttribute('stroke', 'currentColor');
    editSvg.setAttribute('stroke-width', '2');
    var editPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    editPath.setAttribute('d', 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7');
    var editPath2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    editPath2.setAttribute('d', 'M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z');
    editSvg.appendChild(editPath);
    editSvg.appendChild(editPath2);
    editBtn.appendChild(editSvg);
    meta.appendChild(editBtn);

    if (a.usageCount && a.usageCount > 0) {
      var usageSpan = $create('span', { className: 'ca-anchor-usage', textContent: esc(a.usageCount) + ' uses' });
      meta.appendChild(usageSpan);
    }

    content.appendChild(meta);

    var actions = $create('div', { className: 'ca-anchor-actions' });

    var toggleClass = 'ca-toggle ' + (a.active ? 'active' : '');
    var toggle = $create('div', { className: toggleClass, 'data-action': 'toggle-anchor', 'data-id': a.id });

    var deleteBtn = $create('button', { className: 'ca-btn-icon', 'data-action': 'delete-anchor', 'data-id': a.id, 'aria-label': 'Delete anchor' });
    var deleteSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    deleteSvg.setAttribute('viewBox', '0 0 24 24');
    deleteSvg.setAttribute('fill', 'none');
    deleteSvg.setAttribute('stroke', 'currentColor');
    deleteSvg.setAttribute('stroke-width', '2');
    var deletePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    deletePath.setAttribute('d', 'M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2');
    deleteSvg.appendChild(deletePath);
    deleteBtn.appendChild(deleteSvg);

    actions.appendChild(toggle);
    actions.appendChild(deleteBtn);

    li.appendChild(content);
    li.appendChild(actions);

    return li;
  }

  function buildEmptyState(message) {
    var $create = window.__ca.shared.$create;
    message = message || 'No anchors yet.\nHighlight text to create one.';

    var div = $create('div', { className: 'ca-empty-state' });

    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'currentColor');
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z');
    svg.appendChild(path);

    var p = $create('p', { textContent: message });

    div.appendChild(svg);
    div.appendChild(p);

    return div;
  }

  function buildTemplateItem(tpl) {
    var $create = window.__ca.shared.$create;
    var esc = window.__ca.shared.esc;

    var li = $create('li', { className: 'ca-template-item', 'data-id': tpl.id });

    var content = $create('div', { className: 'ca-template-content' });

    var nameH3 = $create('h3', { className: 'ca-tpl-name', textContent: esc(tpl.name) });
    content.appendChild(nameH3);

    var textP = $create('p', { className: 'ca-tpl-text', textContent: esc(tpl.text) });
    content.appendChild(textP);

    var meta = $create('div', { className: 'ca-tpl-meta' });
    if (tpl.usageCount && tpl.usageCount > 0) {
      var usageSpan = $create('span', { className: 'ca-anchor-usage', textContent: esc(tpl.usageCount) + ' activations' });
      meta.appendChild(usageSpan);
    }
    content.appendChild(meta);

    var actions = $create('div', { className: 'ca-template-actions' });

    var activateBtn = $create('button', { className: 'ca-btn-activate', 'data-action': 'activate-template', 'data-id': tpl.id, textContent: 'Activate' });
    actions.appendChild(activateBtn);

    var editBtn = $create('button', { className: 'ca-btn-edit', 'data-action': 'edit-template', 'data-id': tpl.id, 'aria-label': 'Edit template' });
    var editSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    editSvg.setAttribute('viewBox', '0 0 24 24');
    editSvg.setAttribute('fill', 'none');
    editSvg.setAttribute('stroke', 'currentColor');
    editSvg.setAttribute('stroke-width', '2');
    var editPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    editPath.setAttribute('d', 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7');
    var editPath2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    editPath2.setAttribute('d', 'M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z');
    editSvg.appendChild(editPath);
    editSvg.appendChild(editPath2);
    editBtn.appendChild(editSvg);
    actions.appendChild(editBtn);

    var deleteBtn = $create('button', { className: 'ca-btn-icon', 'data-action': 'delete-template', 'data-id': tpl.id, 'aria-label': 'Delete template' });
    var deleteSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    deleteSvg.setAttribute('viewBox', '0 0 24 24');
    deleteSvg.setAttribute('fill', 'none');
    deleteSvg.setAttribute('stroke', 'currentColor');
    deleteSvg.setAttribute('stroke-width', '2');
    var deletePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    deletePath.setAttribute('d', 'M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2');
    deleteSvg.appendChild(deletePath);
    deleteBtn.appendChild(deleteSvg);
    actions.appendChild(deleteBtn);

    li.appendChild(content);
    li.appendChild(actions);

    return li;
  }

  function updateAnchorList() {
    var list = window.__ca.shared.$id('ca-anchor-list');
    if (!list) return;

    var anchors = getFilteredAnchors();

    while (list.firstChild) {
      list.removeChild(list.firstChild);
    }

    if (anchors.length === 0) {
      list.appendChild(buildEmptyState());
      return;
    }

    for (var i = 0; i < anchors.length; i++) {
      list.appendChild(buildAnchorItem(anchors[i]));
    }
  }

  function updateTemplateList() {
    var list = window.__ca.shared.$id('ca-template-list');
    if (!list) return;

    var templates = window.__ca.storage.getTemplates();

    while (list.firstChild) {
      list.removeChild(list.firstChild);
    }

    if (templates.length === 0) {
      list.appendChild(buildEmptyState('No templates yet.\nClick "+ New Template" to create one.'));
      return;
    }

    for (var i = 0; i < templates.length; i++) {
      list.appendChild(buildTemplateItem(templates[i]));
    }
  }

  function updateBulkBar() {
    var bar = window.__ca.shared.$id('ca-bulk-bar');
    if (!bar) return;
    var count = window.__ca.shared.$one('.ca-bulk-count');
    if (count) count.textContent = selectedIds.length + ' selected';
    bar.className = 'ca-bulk-bar' + (bulkMode && selectedIds.length > 0 ? '' : ' hidden');
  }

  function switchTab(tabName) {
    currentTab = tabName;
    var panel = window.__ca.shared.$id('ca-panel');
    if (!panel) return;

    var tabs = panel.querySelectorAll('.ca-tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].className = 'ca-tab' + (tabs[i].dataset.tab === tabName ? ' active' : '');
    }

    var contents = panel.querySelectorAll('.ca-tab-content');
    for (var j = 0; j < contents.length; j++) {
      contents[j].className = 'ca-tab-content' + (contents[j].id === 'ca-tab-' + tabName ? ' active' : '');
    }

    if (tabName === 'anchors') {
      updateAnchorList();
    } else if (tabName === 'templates') {
      updateTemplateList();
    }
  }

  function renderEditorOverlay(editorType, data) {
    var $create = window.__ca.shared.$create;
    var esc = window.__ca.shared.esc;

    var overlay = $create('div', { id: 'ca-editor-overlay', className: 'ca-editor-overlay' });
    overlay._editorType = editorType;
    overlay._editorData = data;

    var panel = $create('div', { className: 'ca-editor-panel' });

    var header = $create('div', { className: 'ca-editor-header' });
    var title = $create('h2', { className: 'ca-editor-title', textContent: editorType === 'anchor' ? 'Edit Anchor' : 'Edit Template' });
    header.appendChild(title);

    var closeBtn = $create('button', { className: 'ca-panel-close', 'data-action': 'close-editor', 'aria-label': 'Close editor' });
    var closeSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    closeSvg.setAttribute('viewBox', '0 0 24 24');
    closeSvg.setAttribute('fill', 'none');
    closeSvg.setAttribute('stroke', 'currentColor');
    closeSvg.setAttribute('stroke-width', '2');
    var closePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    closePath.setAttribute('d', 'M18 6L6 18M6 6l12 12');
    closeSvg.appendChild(closePath);
    closeBtn.appendChild(closeSvg);
    header.appendChild(closeBtn);
    panel.appendChild(header);

    if (editorType === 'template') {
      var nameRow = $create('div', { className: 'ca-editor-name-row' });
      var nameInput = $create('input', { id: 'ca-editor-name', className: 'ca-editor-name', type: 'text', value: data.name, placeholder: 'Template name' });
      nameRow.appendChild(nameInput);
      panel.appendChild(nameRow);
    }

    var body = $create('div', { className: 'ca-editor-body' });
    var main = $create('div', { className: 'ca-editor-main' });

    var contentCol = $create('div', { className: 'ca-editor-content' });
    var textarea = $create('textarea', { id: 'ca-editor-textarea', className: 'ca-editor-textarea' });
    textarea.value = data.text;
    contentCol.appendChild(textarea);
    main.appendChild(contentCol);

    var sidebar = $create('div', { className: 'ca-editor-sidebar' });

    var sectionTags = $create('div', { id: 'ca-editor-tags', className: 'ca-editor-section' });
    var tagsTitle = $create('div', { className: 'ca-editor-section-title', textContent: 'Tags' });
    sectionTags.appendChild(tagsTitle);
    var tagInput = $create('input', { className: 'ca-editor-tag-input', 'data-action': 'add-editor-tag', type: 'text', placeholder: 'Add tag + Enter', 'data-id': data.id });
    sectionTags.appendChild(tagInput);
    var tagRow = $create('div', { className: 'ca-editor-tags' });
    if (data.tags && data.tags.length > 0) {
      for (var ti = 0; ti < data.tags.length; ti++) {
        var tChip = $create('span', { className: 'ca-tag', 'data-action': 'remove-editor-tag', 'data-id': data.id, 'data-tag': data.tags[ti], textContent: '#' + esc(data.tags[ti]) });
        tagRow.appendChild(tChip);
      }
    }
    sectionTags.appendChild(tagRow);
    sidebar.appendChild(sectionTags);

    if (editorType === 'anchor') {
      var sectionTurns = $create('div', { id: 'ca-editor-turns', className: 'ca-editor-section' });
      var turnsTitle = $create('div', { className: 'ca-editor-section-title', textContent: 'Turns' });
      sectionTurns.appendChild(turnsTitle);

      var turnsDisplay = $create('div', { className: 'ca-editor-turns-display' });
      var turnsText = $create('span', { className: 'ca-editor-turns-text', textContent: esc(data.turnsRemaining) + ' / ' + esc(data.turnsTotal) });
      turnsDisplay.appendChild(turnsText);

      var progress = $create('div', { className: 'ca-editor-progress' });
      var pct = data.turnsTotal > 0 ? (data.turnsRemaining / data.turnsTotal * 100) : 0;
      var fill = $create('div', { className: 'ca-editor-progress-fill' });
      fill.style.width = pct + '%';
      progress.appendChild(fill);
      turnsDisplay.appendChild(progress);
      sectionTurns.appendChild(turnsDisplay);

      var extendRow = $create('div', { className: 'ca-editor-extend-row' });
      var extendValues = [5, 10, 25];
      for (var ev = 0; ev < extendValues.length; ev++) {
        var eBtn = $create('button', { className: 'ca-turn-option', 'data-action': 'extend-editor-turns', 'data-id': data.id, 'data-amount': String(extendValues[ev]), textContent: '+' + extendValues[ev] });
        extendRow.appendChild(eBtn);
      }
      var resetBtn = $create('button', { className: 'ca-turn-option ca-editor-reset-btn', 'data-action': 'reset-editor-turns', 'data-id': data.id, textContent: 'Reset' });
      extendRow.appendChild(resetBtn);
      var customVal = $create('input', { id: 'ca-editor-extend-custom', className: 'ca-turn-custom', type: 'number', min: '1', placeholder: 'Custom' });
      extendRow.appendChild(customVal);
      var setBtn = $create('button', { className: 'ca-turn-option ca-turn-custom-btn', 'data-action': 'extend-editor-turns', 'data-id': data.id, 'data-amount': 'custom', textContent: 'Set' });
      extendRow.appendChild(setBtn);
      sectionTurns.appendChild(extendRow);
      sidebar.appendChild(sectionTurns);

      var sectionStatus = $create('div', { id: 'ca-editor-status', className: 'ca-editor-section' });
      var statusTitle = $create('div', { className: 'ca-editor-section-title', textContent: 'Status & Scope' });
      sectionStatus.appendChild(statusTitle);
      var toggleRow = $create('div', { className: 'ca-editor-toggle-row' });

      var statusBtn = $create('button', {
        className: 'ca-editor-status-btn' + (data.active ? ' active' : ''),
        'data-action': 'toggle-editor-active',
        'data-id': data.id,
        textContent: data.active ? '● Active' : '○ Inactive'
      });
      toggleRow.appendChild(statusBtn);

      var scopeBtn = $create('button', {
        className: 'ca-editor-scope-btn' + (data.global ? ' active' : ''),
        'data-action': 'toggle-editor-global',
        'data-id': data.id,
        textContent: data.global ? 'Global' : 'Local'
      });
      toggleRow.appendChild(scopeBtn);
      sectionStatus.appendChild(toggleRow);
      sidebar.appendChild(sectionStatus);

      var sectionTTLCtrl = $create('div', { id: 'ca-editor-ttl', className: 'ca-editor-section' });
      var ttlCtrlTitle = $create('div', { className: 'ca-editor-section-title', textContent: 'TTL (idle expiry)' });
      sectionTTLCtrl.appendChild(ttlCtrlTitle);

      var ttlDisplay = $create('div', { className: 'ca-editor-field' });
      var ttlLabel;
      if (data.ttlHours === null || data.ttlHours === undefined) {
        ttlLabel = $create('span', { className: 'ca-editor-field-label', textContent: 'No TTL set' });
      } else if (data.ttlExpiresAt && data.ttlExpiresAt > Date.now()) {
        var remainingH = Math.ceil((data.ttlExpiresAt - Date.now()) / 3600000);
        ttlLabel = $create('span', { className: 'ca-editor-field-label', textContent: '⏳ ' + remainingH + 'h remaining · Idle: ' + data.ttlHours + 'h' });
      } else {
        ttlLabel = $create('span', { className: 'ca-editor-field-label', textContent: 'Expired · Idle TTL: ' + data.ttlHours + 'h' });
      }
      ttlDisplay.appendChild(ttlLabel);
      sectionTTLCtrl.appendChild(ttlDisplay);

      var ttlRow = $create('div', { className: 'ca-editor-extend-row' });
      var ttlPresets = [1, 6, 24];
      for (var tti = 0; tti < ttlPresets.length; tti++) {
        var ttlPset = ttlPresets[tti];
        var ttlPBtn = $create('button', { className: 'ca-turn-option', 'data-action': 'extend-editor-ttl', 'data-id': data.id, 'data-amount': String(ttlPset), textContent: '+' + ttlPset + 'h' });
        ttlRow.appendChild(ttlPBtn);
      }
      var ttlResetBtn = $create('button', { className: 'ca-turn-option', 'data-action': 'reset-editor-ttl', 'data-id': data.id, textContent: 'Reset' });
      ttlRow.appendChild(ttlResetBtn);
      var ttlRemoveBtn = $create('button', { className: 'ca-turn-option ca-editor-ttl-remove', 'data-action': 'remove-editor-ttl', 'data-id': data.id, textContent: 'Remove' });
      ttlRow.appendChild(ttlRemoveBtn);
      sectionTTLCtrl.appendChild(ttlRow);
      sidebar.appendChild(sectionTTLCtrl);
    }

    var sectionUsage = $create('div', { id: 'ca-editor-usage', className: 'ca-editor-section' });
    var usageTitle = $create('div', { className: 'ca-editor-section-title', textContent: 'Usage' });
    sectionUsage.appendChild(usageTitle);
    var usageField = $create('div', { className: 'ca-editor-field' });
    var parts = [];
    if (data.usageCount) parts.push(esc(data.usageCount) + ' ' + (editorType === 'anchor' ? 'uses' : 'activations'));
    if (data.lastUsed) parts.push('Last: ' + esc(new Date(data.lastUsed).toLocaleDateString()));
    if (data.totalTurnsConsumed) parts.push(esc(data.totalTurnsConsumed) + ' turns consumed');
    var usageLabel = $create('span', { className: 'ca-editor-field-label' });
    usageLabel.textContent = parts.join(' · ') || 'No usage yet';
    usageField.appendChild(usageLabel);
    sectionUsage.appendChild(usageField);
    sidebar.appendChild(sectionUsage);

    if (editorType === 'anchor' && data.sourceUrl) {
      var sectionMeta = $create('div', { className: 'ca-editor-section' });
      var metaTitle = $create('div', { className: 'ca-editor-section-title', textContent: 'Meta' });
      sectionMeta.appendChild(metaTitle);
      var metaField = $create('div', { className: 'ca-editor-field' });
      var metaLabel = $create('span', { className: 'ca-editor-field-label', textContent: 'Source: ' + esc(data.sourceUrl) });
      metaField.appendChild(metaLabel);
      var metaDate = $create('span', { className: 'ca-editor-field-label', textContent: 'Created: ' + esc(new Date(data.createdAt).toLocaleDateString()) });
      metaField.appendChild(metaDate);
      sectionMeta.appendChild(metaField);
      sidebar.appendChild(sectionMeta);
    }

    main.appendChild(sidebar);
    body.appendChild(main);
    panel.appendChild(body);

    var footer = $create('div', { className: 'ca-editor-footer' });
    var deleteBtn = $create('button', { className: 'ca-btn-danger', 'data-action': editorType === 'anchor' ? 'delete-editor-anchor' : 'delete-editor-tpl', 'data-id': data.id, textContent: 'Delete' });
    footer.appendChild(deleteBtn);

    var spacer = $create('div', { style: { flex: '1' } });
    footer.appendChild(spacer);

    var cancelBtn = $create('button', { className: 'ca-btn-cancel', 'data-action': 'close-editor', textContent: 'Cancel' });
    footer.appendChild(cancelBtn);

    if (editorType === 'template') {
      var activateBtn = $create('button', { className: 'ca-btn-save', 'data-action': 'activate-editor-tpl', 'data-id': data.id, textContent: 'Activate' });
      footer.appendChild(activateBtn);
    }

    var saveBtn = $create('button', { className: 'ca-btn-save', 'data-action': 'save-editor', 'data-id': data.id, textContent: 'Save' });
    footer.appendChild(saveBtn);
    panel.appendChild(footer);

    overlay.appendChild(panel);
    window.__ca.shared.$append(overlay);

    editorEscapeHandler = function(e) {
      if (e.key === 'Escape') {
        removeEditorOverlay();
      }
    };
    document.addEventListener('keydown', editorEscapeHandler);

    overlay.addEventListener('click', function(e) {
      var target = e.target.closest('[data-action]');
      if (!target) return;
      handleEditorAction(target, data, editorType);
    });

    overlay.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        var target = e.target.closest('[data-action="add-editor-tag"]');
        if (target) {
          e.preventDefault();
          var tag = target.value.trim();
          if (tag && target.dataset.id) {
            window.__ca.storage.addTag(target.dataset.id, tag);
            target.value = '';
            refreshEditorSection('tags', target.dataset.id);
          }
        }
      }
    });

    var textareaEl = window.__ca.shared.$id('ca-editor-textarea');
    if (textareaEl) textareaEl.focus();
  }

  function refreshEditorSection(section, anchorId) {
    if (section === 'tags') {
      var anchor = window.__ca.storage.getAll().filter(function(a) { return a.id === anchorId; })[0];
      if (!anchor) return;
      var tagRow = window.__ca.shared.$one('.ca-editor-tags');
      if (!tagRow) return;
      while (tagRow.firstChild) tagRow.removeChild(tagRow.firstChild);
      if (anchor.tags && anchor.tags.length > 0) {
        for (var ti = 0; ti < anchor.tags.length; ti++) {
          var tChip = window.__ca.shared.$create('span', { className: 'ca-tag', 'data-action': 'remove-editor-tag', 'data-id': anchor.id, 'data-tag': anchor.tags[ti], textContent: '#' + window.__ca.shared.esc(anchor.tags[ti]) });
          tagRow.appendChild(tChip);
        }
      }
    }
    if (section === 'turns' || section === 'status' || section === 'all') {
      var anchorIdFromOverlay = window.__ca.shared.$one('.ca-editor-overlay');
      if (!anchorIdFromOverlay) return;
      anchorIdFromOverlay = anchorIdFromOverlay._editorData ? anchorIdFromOverlay._editorData.id : null;
      if (!anchorIdFromOverlay) return;
      var updated = window.__ca.storage.getAll().filter(function(a) { return a.id === anchorIdFromOverlay; })[0];
      if (!updated) return;

      var turnsText = window.__ca.shared.$one('.ca-editor-turns-text');
      if (turnsText) turnsText.textContent = updated.turnsRemaining + ' / ' + updated.turnsTotal;

      var fill = window.__ca.shared.$one('.ca-editor-progress-fill');
      if (fill) {
        var pct = updated.turnsTotal > 0 ? (updated.turnsRemaining / updated.turnsTotal * 100) : 0;
        fill.style.width = pct + '%';
      }

      var statusBtn = window.__ca.shared.$one('[data-action="toggle-editor-active"]');
      if (statusBtn) {
        statusBtn.textContent = updated.active ? '● Active' : '○ Inactive';
        statusBtn.className = 'ca-editor-status-btn' + (updated.active ? ' active' : '');
      }

      var scopeBtn = window.__ca.shared.$one('[data-action="toggle-editor-global"]');
      if (scopeBtn) {
        scopeBtn.textContent = updated.global ? 'Global' : 'Local';
        scopeBtn.className = 'ca-editor-scope-btn' + (updated.global ? ' active' : '');
      }

      var ttlLabel = window.__ca.shared.$one('#ca-editor-ttl .ca-editor-field-label');
      if (ttlLabel) {
        if (!updated.ttlHours) {
          ttlLabel.textContent = 'No TTL set';
        } else if (updated.ttlExpiresAt && updated.ttlExpiresAt > Date.now()) {
          var remH = Math.ceil((updated.ttlExpiresAt - Date.now()) / 3600000);
          ttlLabel.textContent = '⏳ ' + remH + 'h remaining · Idle: ' + updated.ttlHours + 'h';
        } else {
          ttlLabel.textContent = 'Expired · Idle TTL: ' + updated.ttlHours + 'h';
        }
      }
    }
    if (section === 'usage' || section === 'all') {
      var overlay = window.__ca.shared.$id('ca-editor-overlay');
      if (!overlay || !overlay._editorData) return;
      var uData = window.__ca.storage.getAll().filter(function(a) { return a.id === overlay._editorData.id; })[0];
      if (!uData) {
        uData = window.__ca.storage.getTemplates().filter(function(t) { return t.id === overlay._editorData.id; })[0];
      }
      if (!uData) return;
      var usageLabel = window.__ca.shared.$one('#ca-editor-usage .ca-editor-field-label');
      if (!usageLabel) return;
      var parts = [];
      if (uData.usageCount) parts.push(uData.usageCount + ' ' + (overlay._editorType === 'anchor' ? 'uses' : 'activations'));
      if (uData.lastUsed) parts.push('Last: ' + new Date(uData.lastUsed).toLocaleDateString());
      if (uData.totalTurnsConsumed) parts.push(uData.totalTurnsConsumed + ' turns consumed');
      usageLabel.textContent = parts.join(' · ') || 'No usage yet';
    }
  }

  function handleEditorAction(target, data, editorType) {
    var action = target.dataset.action;
    var id = target.dataset.id;

    if (action === 'close-editor') {
      removeEditorOverlay();
    } else if (action === 'save-editor' && id) {
      var textarea = window.__ca.shared.$id('ca-editor-textarea');
      var updates = {};
      if (textarea && textarea.value.trim()) updates.text = textarea.value.trim();
      if (editorType === 'template') {
        var nameInput = window.__ca.shared.$id('ca-editor-name');
        if (nameInput && nameInput.value.trim()) updates.name = nameInput.value.trim();
        window.__ca.storage.updateTemplate(id, updates);
        updateTemplateList();
      } else {
        window.__ca.storage.updateAnchor(id, updates);
        window.__ca.events.emit('anchors:changed');
      }
      removeEditorOverlay();
    } else if (action === 'delete-editor-anchor' && id) {
      removeEditorOverlay();
      renderConfirmDialog('Delete this anchor?', function() {
        window.__ca.storage.deleteAnchor(id);
        window.__ca.events.emit('anchors:changed');
      });
    } else if (action === 'delete-editor-tpl' && id) {
      removeEditorOverlay();
      renderConfirmDialog('Delete this template?', function() {
        window.__ca.storage.deleteTemplate(id);
        updateTemplateList();
      });
    } else if (action === 'activate-editor-tpl' && id) {
      window.__ca.storage.activateTemplate(id);
      window.__ca.events.emit('anchors:changed');
      removeEditorOverlay();
    } else if (action === 'extend-editor-turns' && id) {
      var amount = target.dataset.amount;
      if (amount === 'custom') {
        var customEl = window.__ca.shared.$id('ca-editor-extend-custom');
        amount = customEl ? parseInt(customEl.value, 10) : 0;
      } else {
        amount = parseInt(amount, 10);
      }
      if (amount > 0) {
        window.__ca.storage.extendTurns(id, amount);
        window.__ca.events.emit('anchors:changed');
        refreshEditorSection('all', id);
      }
    } else if (action === 'reset-editor-turns' && id) {
      window.__ca.storage.resetTurns(id);
      window.__ca.events.emit('anchors:changed');
      refreshEditorSection('all', id);
    } else if (action === 'add-editor-tag') {
      return;
    } else if (action === 'remove-editor-tag' && id) {
      var tag = target.dataset.tag;
      if (tag) {
        window.__ca.storage.removeTag(id, tag);
        window.__ca.events.emit('anchors:changed');
        refreshEditorSection('tags', id);
      }
    } else if (action === 'toggle-editor-active' && id) {
      window.__ca.storage.toggleAnchor(id);
      window.__ca.events.emit('anchors:changed');
      refreshEditorSection('status', id);
    } else if (action === 'toggle-editor-global' && id) {
      var anchor = window.__ca.storage.getAll().filter(function(a) { return a.id === id; })[0];
      if (anchor) {
        window.__ca.storage.setGlobal(id, !anchor.global);
        window.__ca.events.emit('anchors:changed');
        refreshEditorSection('status', id);
      }
    } else if (action === 'extend-editor-ttl' && id) {
      var ttlAmount = parseInt(target.dataset.amount, 10);
      if (ttlAmount > 0) {
        window.__ca.storage.extendTTL(id, ttlAmount);
        window.__ca.events.emit('anchors:changed');
        refreshEditorSection('all', id);
      }
    } else if (action === 'reset-editor-ttl' && id) {
      window.__ca.storage.resetTTL(id);
      window.__ca.events.emit('anchors:changed');
      refreshEditorSection('all', id);
    } else if (action === 'remove-editor-ttl' && id) {
      window.__ca.storage.setTTL(id, null);
      window.__ca.events.emit('anchors:changed');
      refreshEditorSection('all', id);
    }
  }

  function removeEditorOverlay() {
    var overlay = window.__ca.shared.$id('ca-editor-overlay');
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    if (editorEscapeHandler) {
      document.removeEventListener('keydown', editorEscapeHandler);
      editorEscapeHandler = null;
    }
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
      } else if (action === 'switch-tab') {
        switchTab(target.dataset.tab);
      } else if (action === 'toggle-anchor' && id) {
        window.__ca.storage.toggleAnchor(id);
        window.__ca.events.emit('anchors:changed');
      } else if (action === 'delete-anchor' && id) {
        renderConfirmDialog('Delete this anchor?', function() {
          window.__ca.storage.deleteAnchor(id);
          window.__ca.events.emit('anchors:changed');
        });
      } else if (action === 'clear-expired') {
        renderConfirmDialog('Clear all expired anchors?', function() {
          window.__ca.storage.clearExpired();
          window.__ca.events.emit('anchors:changed');
        });
      } else if (action === 'edit-anchor' && id) {
        var anchor = window.__ca.storage.getAll().filter(function(a) { return a.id === id; })[0];
        if (anchor) renderEditorOverlay('anchor', anchor);
      } else if (action === 'extend-turns' && id) {
        window.__ca.storage.extendTurns(id, 5);
        window.__ca.events.emit('anchors:changed');
      } else if (action === 'remove-tag' && id) {
        var tag = target.dataset.tag;
        if (tag) {
          window.__ca.storage.removeTag(id, tag);
          window.__ca.events.emit('anchors:changed');
        }
      } else if (action === 'expand-text' && id) {
        var textEl = target;
        textEl.classList.toggle('expanded');
      } else if (action === 'export-anchors') {
        exportAnchors();
      } else if (action === 'import-anchors') {
        var fileInput = window.__ca.shared.$one('.ca-import-input');
        if (fileInput) fileInput.click();
      } else if (action === 'activate-template' && id) {
        window.__ca.storage.activateTemplate(id);
        window.__ca.events.emit('anchors:changed');
      } else if (action === 'edit-template' && id) {
        var tpl = window.__ca.storage.getTemplates().filter(function(t) { return t.id === id; })[0];
        if (tpl) renderEditorOverlay('template', tpl);
      } else if (action === 'delete-template' && id) {
        renderConfirmDialog('Delete this template?', function() {
          window.__ca.storage.deleteTemplate(id);
          updateTemplateList();
        });
      } else if (action === 'add-template') {
        var tpl = window.__ca.storage.createTemplate('New Template', '', []);
        renderEditorOverlay('template', tpl);
      } else if (action === 'toggle-bulk') {
        bulkMode = !bulkMode;
        selectedIds = [];
        updateAnchorList();
        updateBulkBar();
        var btn = window.__ca.shared.$one('[data-action="toggle-bulk"]');
        if (btn) btn.className = 'ca-btn-icon ca-btn-bulk' + (bulkMode ? ' active' : '');
      } else if (action === 'bulk-select' && id) {
        var idx = selectedIds.indexOf(id);
        if (idx === -1) {
          selectedIds.push(id);
        } else {
          selectedIds.splice(idx, 1);
        }
        updateAnchorList();
        updateBulkBar();
      } else if (action === 'bulk-toggle') {
        if (selectedIds.length > 0) {
          window.__ca.storage.bulkToggle(selectedIds);
          window.__ca.events.emit('anchors:changed');
        }
      } else if (action === 'bulk-extend') {
        if (selectedIds.length > 0) {
          window.__ca.storage.bulkExtend(selectedIds, 5);
          window.__ca.events.emit('anchors:changed');
        }
      } else if (action === 'bulk-delete') {
        var count = selectedIds.length;
        renderConfirmDialog('Delete ' + count + ' selected anchor' + (count > 1 ? 's' : '') + '?', function() {
          window.__ca.storage.bulkDelete(selectedIds);
          selectedIds = [];
          window.__ca.events.emit('anchors:changed');
          updateBulkBar();
        });
      } else if (action === 'cycle-inject-mode') {
        var current = window.__ca.storage.getInjectionMode();
        var next = current === 'prepend' ? 'append' : 'prepend';
        window.__ca.storage.setInjectionMode(next);
        updateInjectModeLabel();
      } else if (action === 'toggle-global' && id) {
        var anchor = window.__ca.storage.getAll().filter(function(a) { return a.id === id; })[0];
        if (anchor) {
          window.__ca.storage.setGlobal(id, !anchor.global);
          window.__ca.events.emit('anchors:changed');
        }
      } else if (action === 'confirm-cancel') {
        removeConfirmDialog();
      } else if (action === 'confirm-ok') {
        removeConfirmDialog();
      } else if (action === 'open-timeline') {
        window.__ca.timeline.renderTimelineOverlay();
      } else if (action === 'toggle-lock') {
        panelLocked = !panelLocked;
        var lockBtn = window.__ca.shared.$one('.ca-btn-lock');
        if (lockBtn) {
          lockBtn.className = 'ca-btn-icon ca-btn-lock' + (panelLocked ? ' locked' : '');
          var lockSvg = lockBtn.querySelector('svg');
          if (lockSvg) {
            lockSvg.setAttribute('viewBox', '0 0 24 24');
            lockSvg.setAttribute('fill', 'none');
            lockSvg.setAttribute('stroke', 'currentColor');
            lockSvg.setAttribute('stroke-width', '2');
            while (lockSvg.firstChild) lockSvg.removeChild(lockSvg.firstChild);
            if (panelLocked) {
              var lockedRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
              lockedRect.setAttribute('x', '3');
              lockedRect.setAttribute('y', '11');
              lockedRect.setAttribute('width', '18');
              lockedRect.setAttribute('height', '11');
              lockedRect.setAttribute('rx', '2');
              lockedRect.setAttribute('fill', 'currentColor');
              var lockedPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
              lockedPath.setAttribute('d', 'M7 11V7a5 5 0 0110 0v4');
              lockSvg.appendChild(lockedRect);
              lockSvg.appendChild(lockedPath);
            } else {
              var openRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
              openRect.setAttribute('x', '3');
              openRect.setAttribute('y', '11');
              openRect.setAttribute('width', '18');
              openRect.setAttribute('height', '11');
              openRect.setAttribute('rx', '2');
              var openPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
              openPath.setAttribute('d', 'M7 11V7a5 5 0 0110 0v4');
              lockSvg.appendChild(openRect);
              lockSvg.appendChild(openPath);
            }
          }
        }
        if (panelLocked) {
          panel.classList.add('locked');
        } else {
          panel.classList.remove('locked');
        }
      }
    });

    panel.addEventListener('input', function(e) {
      var target = e.target.closest('[data-action]');
      if (!target) return;

      if (target.dataset.action === 'search') {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(function() {
          currentSearch = target.value.trim();
          updateAnchorList();
        }, 300);
      }
    });

    panel.addEventListener('change', function(e) {
      var target = e.target.closest('[data-action]');
      if (!target) return;

      if (target.dataset.action === 'filter-status') {
        currentFilter = target.value;
        updateAnchorList();
      } else if (target.dataset.action === 'import-file') {
        importAnchors(target);
      } else if (target.dataset.action === 'sort-anchors') {
        currentSort = target.value;
        updateAnchorList();
      }
    });

    panel.addEventListener('keydown', function(e) {
      var target = e.target.closest('[data-action]');
      if (!target) return;

      if (target.dataset.action === 'search' && e.key === 'Escape') {
        target.value = '';
        currentSearch = '';
        updateAnchorList();
        target.blur();
      }

      if (target.classList.contains('ca-tag-input-field') && e.key === 'Enter') {
        e.preventDefault();
        var id = target.dataset.id;
        var tag = target.value.trim();
        if (tag && id) {
          window.__ca.storage.addTag(id, tag);
          target.value = '';
          window.__ca.events.emit('anchors:changed');
        }
      }
    });
  }

  function exportAnchors() {
    var anchors = window.__ca.storage.getAll();
    var data = JSON.stringify(anchors, null, 2);
    var blob = new Blob([data], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'contextual-anchors-' + Date.now() + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function validateAnchorSchema(obj) {
    if (!obj || typeof obj !== 'object') return false;
    if (typeof obj.id !== 'string') return false;
    if (typeof obj.text !== 'string') return false;
    if (typeof obj.turnsTotal !== 'number') return false;
    if (typeof obj.turnsRemaining !== 'number') return false;
    if (typeof obj.active !== 'boolean') return false;
    if (typeof obj.createdAt !== 'number') return false;
    return true;
  }

  function importAnchors(fileInput) {
    var file = fileInput.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var data = JSON.parse(e.target.result);
        if (!Array.isArray(data)) {
          console.error('[CA] Import: invalid format, expected array');
          return;
        }

        var imported = 0;
        var skipped = 0;
        for (var i = 0; i < data.length; i++) {
          if (validateAnchorSchema(data[i])) {
            var existing = window.__ca.storage.getAll().filter(function(a) { return a.id === data[i].id; });
            if (existing.length === 0) {
              window.__ca.storage.createAnchor(data[i].text, data[i].sourceUrl, data[i].turnsTotal, data[i].global);
              imported++;
            } else {
              skipped++;
            }
          } else {
            skipped++;
          }
        }

        window.__ca.events.emit('anchors:changed');
        console.log('[CA] Import: ' + imported + ' imported, ' + skipped + ' skipped');
      } catch (err) {
        console.error('[CA] Import: parse error', err);
      }
    };
    reader.readAsText(file);
    fileInput.value = '';
  }

  window.__ca = window.__ca || {};
  window.__ca.panel = {
    init: init,
    renderPanel: renderPanel,
    updateAnchorList: updateAnchorList,
    updateBadge: updateBadge,
    renderTurnPopup: renderTurnPopup,
    removeTurnPopup: removeTurnPopup,
    renderEditorOverlay: renderEditorOverlay,
    renderConfirmDialog: renderConfirmDialog
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
