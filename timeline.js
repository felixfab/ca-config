(function() {
  'use strict';

  var currentSort = 'recently-used';
  var currentGroup = 'day';
  var currentFilter = 'all';
  var collapsedGroups = {};
  var overlayEscapeHandler = null;

  function init() {
    if (!window.__ca || !window.__ca.events) {
      setTimeout(init, 100);
      return;
    }
    window.__ca.events.on('anchors:changed', function() {
      var overlay = window.__ca.shared.$id('ca-timeline-overlay');
      if (overlay) updateTimeline();
    });
  }

  function renderTimelineOverlay() {
    removeTimelineOverlay();

    var $create = window.__ca.shared.$create;
    var esc = window.__ca.shared.esc;

    var overlay = $create('div', { id: 'ca-timeline-overlay', className: 'ca-timeline-overlay' });

    var panel = $create('div', { className: 'ca-timeline-panel' });

    var header = $create('div', { className: 'ca-timeline-header' });
    var title = $create('h2', { className: 'ca-editor-title', textContent: 'Anchor Timeline' });
    header.appendChild(title);

    var closeBtn = $create('button', { className: 'ca-panel-close', 'data-action': 'close-timeline', 'aria-label': 'Close timeline' });
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

    var toolbar = $create('div', { className: 'ca-timeline-toolbar' });

    var sortSelect = $create('select', { className: 'ca-sort-select', 'data-action': 'timeline-sort', 'aria-label': 'Sort anchors' });
    var sortOpts = [
      { v: 'recently-used', t: 'Recently Used' },
      { v: 'newest', t: 'Newest' },
      { v: 'most-used', t: 'Most Used' },
      { v: 'least-remaining', t: 'Least Remaining' }
    ];
    for (var si = 0; si < sortOpts.length; si++) {
      var opt = document.createElement('option');
      opt.value = sortOpts[si].v;
      opt.textContent = sortOpts[si].t;
      if (sortOpts[si].v === currentSort) opt.selected = true;
      sortSelect.appendChild(opt);
    }
    toolbar.appendChild(sortSelect);

    var groupSelect = $create('select', { className: 'ca-sort-select', 'data-action': 'timeline-group', 'aria-label': 'Group anchors' });
    var groupOpts = [
      { v: 'day', t: 'By Day' },
      { v: 'week', t: 'By Week' },
      { v: 'none', t: 'No Grouping' }
    ];
    for (var gi = 0; gi < groupOpts.length; gi++) {
      var gOpt = document.createElement('option');
      gOpt.value = groupOpts[gi].v;
      gOpt.textContent = groupOpts[gi].t;
      if (groupOpts[gi].v === currentGroup) gOpt.selected = true;
      groupSelect.appendChild(gOpt);
    }
    toolbar.appendChild(groupSelect);

    var filterSelect = $create('select', { className: 'ca-sort-select', 'data-action': 'timeline-filter', 'aria-label': 'Filter anchors' });
    var filterOpts = [
      { v: 'all', t: 'All' },
      { v: 'active', t: 'Active' },
      { v: 'expiring', t: 'Expiring' },
      { v: 'inactive', t: 'Inactive' },
      { v: 'expired', t: 'Expired' },
      { v: 'global', t: 'Global' }
    ];
    for (var fi = 0; fi < filterOpts.length; fi++) {
      var fOpt = document.createElement('option');
      fOpt.value = filterOpts[fi].v;
      fOpt.textContent = filterOpts[fi].t;
      if (filterOpts[fi].v === currentFilter) fOpt.selected = true;
      filterSelect.appendChild(fOpt);
    }
    toolbar.appendChild(filterSelect);
    panel.appendChild(toolbar);

    var body = $create('div', { className: 'ca-timeline-body', id: 'ca-timeline-body' });
    panel.appendChild(body);

    var stats = $create('div', { className: 'ca-timeline-stats', id: 'ca-timeline-stats' });
    panel.appendChild(stats);

    overlay.appendChild(panel);
    window.__ca.shared.$append(overlay);

    setupTimelineEvents(overlay);

    overlayEscapeHandler = function(e) {
      if (e.key === 'Escape') removeTimelineOverlay();
    };
    document.addEventListener('keydown', overlayEscapeHandler);

    updateTimeline();
  }

  function removeTimelineOverlay() {
    var overlay = window.__ca.shared.$id('ca-timeline-overlay');
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    if (overlayEscapeHandler) {
      document.removeEventListener('keydown', overlayEscapeHandler);
      overlayEscapeHandler = null;
    }
  }

  function updateTimeline() {
    var anchors = window.__ca.storage.getAll();

    if (currentFilter === 'active') {
      anchors = anchors.filter(function(a) { return a.active && a.turnsRemaining > 0; });
    } else if (currentFilter === 'expiring') {
      anchors = anchors.filter(function(a) { return a.active && a.turnsRemaining > 0 && a.turnsRemaining <= 3; });
    } else if (currentFilter === 'inactive') {
      anchors = anchors.filter(function(a) { return !a.active; });
    } else if (currentFilter === 'expired') {
      anchors = anchors.filter(function(a) { return a.turnsRemaining === 0; });
    } else if (currentFilter === 'global') {
      anchors = anchors.filter(function(a) { return a.global; });
    }

    if (currentSort === 'newest') {
      anchors.sort(function(a, b) { return b.order - a.order; });
    } else if (currentSort === 'most-used') {
      anchors.sort(function(a, b) { return (b.usageCount || 0) - (a.usageCount || 0); });
    } else if (currentSort === 'least-remaining') {
      anchors.sort(function(a, b) { return a.turnsRemaining - b.turnsRemaining; });
    } else {
      anchors.sort(function(a, b) { return (b.lastUsed || b.createdAt) - (a.lastUsed || b.createdAt); });
    }

    var groups = {};
    if (currentGroup === 'none') {
      groups['All'] = anchors;
    } else if (currentGroup === 'day') {
      groupByDay(anchors, groups);
    } else if (currentGroup === 'week') {
      groupByWeek(anchors, groups);
    }

    var body = window.__ca.shared.$id('ca-timeline-body');
    if (!body) return;
    while (body.firstChild) body.removeChild(body.firstChild);

    if (currentGroup === 'day') {
      renderGroup(body, 'Today', groups['Today']);
      renderGroup(body, 'Yesterday', groups['Yesterday']);
      renderGroup(body, 'This Week', groups['This Week']);
      renderGroup(body, 'Last Week', groups['Last Week']);
      renderGroup(body, 'Older', groups['Older']);
    } else if (currentGroup === 'week') {
      var weekKeys = Object.keys(groups).sort().reverse();
      for (var wk = 0; wk < weekKeys.length; wk++) {
        renderGroup(body, weekKeys[wk], groups[weekKeys[wk]]);
      }
    } else {
      renderGroup(body, '', groups['All']);
    }

    updateStatsBar();
  }

  function groupByDay(anchors, groups) {
    var now = new Date();
    var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    var yesterdayStart = todayStart - 86400000;
    var dayOfWeek = now.getDay() || 7;
    var weekStart = todayStart - (dayOfWeek - 1) * 86400000;
    var lastWeekStart = weekStart - 7 * 86400000;

    for (var i = 0; i < anchors.length; i++) {
      var a = anchors[i];
      var ts = a.lastUsed || a.createdAt;
      var dateDay = new Date(new Date(ts).getFullYear(), new Date(ts).getMonth(), new Date(ts).getDate()).getTime();

      if (dateDay >= todayStart) {
        addToGroup(groups, 'Today', a);
      } else if (dateDay >= yesterdayStart) {
        addToGroup(groups, 'Yesterday', a);
      } else if (dateDay >= weekStart) {
        addToGroup(groups, 'This Week', a);
      } else if (dateDay >= lastWeekStart) {
        addToGroup(groups, 'Last Week', a);
      } else {
        addToGroup(groups, 'Older', a);
      }
    }
  }

  function groupByWeek(anchors, groups) {
    for (var i = 0; i < anchors.length; i++) {
      var a = anchors[i];
      var ts = a.lastUsed || a.createdAt;
      var d = new Date(ts);
      var dow = d.getDay() || 7;
      var monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow + 1);
      var key = monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      addToGroup(groups, key, a);
    }
  }

  function addToGroup(groups, key, anchor) {
    if (!groups[key]) groups[key] = [];
    groups[key].push(anchor);
  }

  function renderGroup(body, label, anchors) {
    if (!anchors || anchors.length === 0) return;

    var $create = window.__ca.shared.$create;
    var esc = window.__ca.shared.esc;

    var group = $create('div', { className: 'ca-timeline-group' });

    if (label) {
      var isCollapsed = collapsedGroups[label] === true;
      var isOlder = label === 'Older';
      var collapsedDefault = isOlder;

      if (collapsedGroups[label] === undefined && collapsedDefault) {
        collapsedGroups[label] = true;
        isCollapsed = true;
      }

      var hdr = $create('div', { className: 'ca-timeline-group-hdr', 'data-action': 'toggle-timeline-group', 'data-group': label });
      hdr.textContent = label + ' (' + anchors.length + ')' + (isCollapsed ? ' ▸' : ' ▾');
      group.appendChild(hdr);

      if (isCollapsed) {
        body.appendChild(group);
        return;
      }
    }

    for (var i = 0; i < anchors.length; i++) {
      group.appendChild(buildTimelineCard(anchors[i]));
    }

    body.appendChild(group);
  }

  function buildTimelineCard(a) {
    var $create = window.__ca.shared.$create;
    var esc = window.__ca.shared.esc;

    var isExpired = a.turnsRemaining === 0;
    var isExpiring = !isExpired && a.turnsRemaining <= 3;
    var pct = a.turnsTotal > 0 ? (a.turnsRemaining / a.turnsTotal * 100) : 0;

    var card = $create('div', { className: 'ca-timeline-card', 'data-action': 'open-timeline-anchor', 'data-id': a.id });

    var topRow = $create('div', { className: 'ca-timeline-card-top' });

    var statusClass = 'ca-timeline-card-status' + (isExpired ? ' expired' : (isExpiring ? ' expiring' : ''));
    var statusDot = $create('span', { className: statusClass, textContent: isExpired ? '○' : '●' });
    topRow.appendChild(statusDot);

    if (a.global) {
      var globalChip = $create('span', { className: 'ca-timeline-global-chip', textContent: 'Global' });
      topRow.appendChild(globalChip);
    }

    var title = $create('span', { className: 'ca-timeline-card-title', textContent: esc(a.text) });
    topRow.appendChild(title);

    var turnsPill = $create('span', {
      className: 'ca-timeline-turns-pill' + (isExpired ? ' expired' : (isExpiring ? ' expiring' : '')),
      textContent: esc(a.turnsRemaining) + '/' + esc(a.turnsTotal) + (isExpired ? ' EXPIRED' : (isExpiring ? ' EXPIRING' : ''))
    });
    topRow.appendChild(turnsPill);

    card.appendChild(topRow);

    var bar = $create('div', { className: 'ca-timeline-card-bar' });
    var fill = $create('div', { className: 'ca-timeline-card-fill' + (isExpired ? ' expired' : (isExpiring ? ' expiring' : '')) });
    fill.style.width = pct + '%';
    bar.appendChild(fill);
    card.appendChild(bar);

    var metaRow = $create('div', { className: 'ca-timeline-card-meta' });

    if (a.tags && a.tags.length > 0) {
      var maxTags = Math.min(3, a.tags.length);
      for (var t = 0; t < maxTags; t++) {
        var tagSpan = $create('span', { className: 'ca-timeline-tag', textContent: '#' + esc(a.tags[t]) });
        metaRow.appendChild(tagSpan);
      }
      if (a.tags.length > 3) {
        var moreTag = $create('span', { className: 'ca-timeline-tag', textContent: '+' + (a.tags.length - 3) + ' more' });
        metaRow.appendChild(moreTag);
      }
    }

    if (a.sourceUrl) {
      var domain = a.sourceUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      var sourceSpan = $create('span', { textContent: esc(domain) });
      metaRow.appendChild(sourceSpan);
    }

    var usageParts = [];
    if (a.usageCount) usageParts.push(esc(a.usageCount) + ' uses');
    if (a.lastUsed) usageParts.push('last: ' + relativeTime(a.lastUsed));
    else usageParts.push('unused');
    var usageSpan = $create('span', { textContent: usageParts.join(' · ') });
    metaRow.appendChild(usageSpan);

    card.appendChild(metaRow);

    return card;
  }

  function relativeTime(timestamp) {
    var diff = Date.now() - timestamp;
    var minutes = Math.floor(diff / 60000);
    var hours = Math.floor(diff / 3600000);
    var days = Math.floor(diff / 86400000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return minutes + 'm ago';
    if (hours < 24) return hours + 'h ago';
    if (days < 30) return days + 'd ago';
    return Math.floor(days / 30) + 'mo ago';
  }

  function updateStatsBar() {
    var all = window.__ca.storage.getAll();
    var activeCount = all.filter(function(a) { return a.active && a.turnsRemaining > 0; }).length;
    var expiredCount = all.filter(function(a) { return a.turnsRemaining === 0; }).length;
    var consumed = all.reduce(function(sum, a) { return sum + (a.totalTurnsConsumed || 0); }, 0);

    var stats = window.__ca.shared.$id('ca-timeline-stats');
    if (!stats) return;
    stats.textContent = all.length + ' total \u00B7 ' + activeCount + ' active \u00B7 ' + expiredCount + ' expired \u00B7 ' + consumed + ' turns consumed';
  }

  function setupTimelineEvents(overlay) {
    overlay.addEventListener('click', function(e) {
      var target = e.target.closest('[data-action]');
      if (!target) return;

      var action = target.dataset.action;

      if (action === 'close-timeline') {
        removeTimelineOverlay();
      } else if (action === 'open-timeline-anchor') {
        var id = target.closest('[data-id]').dataset.id;
        var anchor = window.__ca.storage.getAll().filter(function(a) { return a.id === id; })[0];
        if (anchor) {
          window.__ca.panel.renderEditorOverlay('anchor', anchor);
        }
      } else if (action === 'toggle-timeline-group') {
        var group = target.dataset.group;
        if (group) {
          if (collapsedGroups[group]) {
            delete collapsedGroups[group];
          } else {
            collapsedGroups[group] = true;
          }
          updateTimeline();
        }
      }
    });

    overlay.addEventListener('change', function(e) {
      var target = e.target.closest('[data-action]');
      if (!target) return;

      if (target.dataset.action === 'timeline-sort') {
        currentSort = target.value;
        updateTimeline();
      } else if (target.dataset.action === 'timeline-group') {
        currentGroup = target.value;
        collapsedGroups = {};
        updateTimeline();
      } else if (target.dataset.action === 'timeline-filter') {
        currentFilter = target.value;
        updateTimeline();
      }
    });
  }

  window.__ca = window.__ca || {};
  window.__ca.timeline = {
    renderTimelineOverlay: renderTimelineOverlay,
    removeTimelineOverlay: removeTimelineOverlay,
    updateTimeline: updateTimeline
  };

  init();
})();
