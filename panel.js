(function() {
  'use strict';

  var searchDebounceTimer = null;
  var currentFilter = 'all';
  var currentSearch = '';
  var editingId = null;
  var currentTab = 'anchors';
  var editingTemplateId = null;
  var currentSort = 'newest';
  var selectedIds = [];
  var bulkMode = false;

  function init() {
    if (!window.__ca || !window.__ca.shared) {
      setTimeout(init, 100);
      return;
    }
    window.__ca.events.on('anchors:changed', function() {
      if (currentTab === 'anchors') updateAnchorList();
      updateBadge();
    });
  }

  function renderPanel() {
    var theme = window.__ca.shared.detectTheme();
    var html = '<div id="ca-panel" class="ca-panel" theme="' + theme + '">' +
      '<div class="ca-panel-header">' +
      '<h2 class="ca-panel-title">Anchors</h2>' +
      '<div class="ca-header-actions">' +
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
      var target = e.target.closest('[data-action]');
      if (!target) return;
      removeConfirmDialog();
      if (target.dataset.action === 'confirm-ok' && onConfirm) {
        onConfirm();
      }
    });
  }

  function removeConfirmDialog() {
    var overlay = window.__ca.shared.$id('ca-confirm-overlay');
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  }

  function renderTurnPopup(rect, onSelect) {
    var $create = window.__ca.shared.$create;

    var popup = $create('div', { id: 'ca-turn-popup', className: 'ca-turn-popup' });
    popup.style.left = rect.left + 'px';
    popup.style.top = (rect.bottom + 8) + 'px';

    var title = $create('div', { className: 'ca-turn-popup-title', textContent: 'Turns' });
    popup.appendChild(title);

    var options = [1, 3, 5, 10, 25, 50];
    for (var i = 0; i < options.length; i++) {
      var btn = $create('button', { className: 'ca-turn-option', 'data-turns': String(options[i]), textContent: options[i] });
      popup.appendChild(btn);
    }

    var customInput = $create('input', { className: 'ca-turn-custom', type: 'number', min: '1', placeholder: 'Custom' });
    popup.appendChild(customInput);

    var customBtn = $create('button', { className: 'ca-turn-option ca-turn-custom-btn', textContent: 'Set' });
    popup.appendChild(customBtn);

    window.__ca.shared.$append(popup);

    popup.addEventListener('click', function(e) {
      var target = e.target.closest('[data-turns]');
      if (target) {
        onSelect(parseInt(target.dataset.turns, 10));
        removeTurnPopup();
        return;
      }
      if (e.target === customBtn) {
        var val = parseInt(customInput.value, 10);
        if (val > 0) {
          onSelect(val);
          removeTurnPopup();
        }
      }
    });

    var dismissHandler = function(e) {
      if (!popup.contains(e.target)) {
        removeTurnPopup();
      }
    };
    popup._dismissHandler = dismissHandler;
    window.__ca.ROOT.addEventListener('mousedown', dismissHandler);
  }

  function removeTurnPopup() {
    var popup = window.__ca.shared.$id('ca-turn-popup');
    if (popup && popup.parentNode) {
      if (popup._dismissHandler) {
        window.__ca.ROOT.removeEventListener('mousedown', popup._dismissHandler);
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

    if (editingId === a.id) {
      var textarea = $create('textarea', { className: 'ca-edit-textarea', 'data-id': a.id });
      textarea.value = a.text;
      content.appendChild(textarea);

      var tagInput = $create('input', { className: 'ca-tag-input-field', 'data-id': a.id, placeholder: 'Add tag + Enter', type: 'text' });
      content.appendChild(tagInput);

      var editActions = $create('div', { className: 'ca-edit-actions' });
      var saveBtn = $create('button', { className: 'ca-btn-save', 'data-action': 'save-edit', 'data-id': a.id, textContent: 'Save' });
      var cancelBtn = $create('button', { className: 'ca-btn-cancel', 'data-action': 'cancel-edit', textContent: 'Cancel' });
      editActions.appendChild(saveBtn);
      editActions.appendChild(cancelBtn);
      content.appendChild(editActions);
    } else {
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
    }

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

    if (editingTemplateId === tpl.id) {
      var nameInput = $create('input', { className: 'ca-tpl-name-input', 'data-id': tpl.id, value: tpl.name, placeholder: 'Template name' });
      content.appendChild(nameInput);

      var textarea = $create('textarea', { className: 'ca-edit-textarea', 'data-id': tpl.id });
      textarea.value = tpl.text;
      content.appendChild(textarea);

      var editActions = $create('div', { className: 'ca-edit-actions' });
      var saveBtn = $create('button', { className: 'ca-btn-save', 'data-action': 'save-tpl-edit', 'data-id': tpl.id, textContent: 'Save' });
      var cancelBtn = $create('button', { className: 'ca-btn-cancel', 'data-action': 'cancel-tpl-edit', textContent: 'Cancel' });
      editActions.appendChild(saveBtn);
      editActions.appendChild(cancelBtn);
      content.appendChild(editActions);
    } else {
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
    }

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
        editingId = id;
        updateAnchorList();
        var textarea = window.__ca.shared.$one('.ca-edit-textarea[data-id="' + id + '"]');
        if (textarea) textarea.focus();
      } else if (action === 'save-edit' && id) {
        var textarea = window.__ca.shared.$one('.ca-edit-textarea[data-id="' + id + '"]');
        if (textarea && textarea.value.trim()) {
          window.__ca.storage.updateAnchor(id, { text: textarea.value.trim() });
          window.__ca.events.emit('anchors:changed');
        }
        editingId = null;
      } else if (action === 'cancel-edit') {
        editingId = null;
        updateAnchorList();
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
        editingTemplateId = id;
        updateTemplateList();
        var nameInput = window.__ca.shared.$one('.ca-tpl-name-input[data-id="' + id + '"]');
        if (nameInput) nameInput.focus();
      } else if (action === 'save-tpl-edit' && id) {
        var nameInput = window.__ca.shared.$one('.ca-tpl-name-input[data-id="' + id + '"]');
        var textarea = window.__ca.shared.$one('.ca-edit-textarea[data-id="' + id + '"]');
        if (nameInput && textarea && nameInput.value.trim() && textarea.value.trim()) {
          window.__ca.storage.updateTemplate(id, { name: nameInput.value.trim(), text: textarea.value.trim() });
          updateTemplateList();
        }
        editingTemplateId = null;
      } else if (action === 'cancel-tpl-edit') {
        editingTemplateId = null;
        updateTemplateList();
      } else if (action === 'delete-template' && id) {
        renderConfirmDialog('Delete this template?', function() {
          window.__ca.storage.deleteTemplate(id);
          updateTemplateList();
        });
      } else if (action === 'add-template') {
        var tpl = window.__ca.storage.createTemplate('New Template', '', []);
        editingTemplateId = tpl.id;
        updateTemplateList();
        var nameInput = window.__ca.shared.$one('.ca-tpl-name-input[data-id="' + tpl.id + '"]');
        if (nameInput) nameInput.focus();
      } else if (action === 'toggle-bulk') {
        bulkMode = !bulkMode;
        selectedIds = [];
        updateAnchorList();
        updateBulkBar();
        var btn = window.__ca.shared.$one('.ca-btn-bulk');
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
    removeTurnPopup: removeTurnPopup
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
