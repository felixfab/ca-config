(function() {
  'use strict';

  var currentSort = 'recently-used';
  var currentGroup = 'day';
  var currentFilter = 'all';
  var collapsedGroups = {};
  var overlayEscapeHandler = null;
  var heatmapExpanded = false;
  var heatmapMode = 'activity';
  var heatmapDate = null;
  var heatmapRange = '6months';
  var heatmapColor = 'blue';
  var heatmapScrollPos = 0;
  var heatmapColsVisible = 26;
  var heatmapScrollStep = 4;

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

    var sortSelect = buildSelect('timeline-sort', [
      { v: 'recently-used', t: 'Recently Used' },
      { v: 'newest', t: 'Newest' },
      { v: 'most-used', t: 'Most Used' },
      { v: 'least-remaining', t: 'Least Remaining' }
    ], currentSort);
    toolbar.appendChild(sortSelect);

    var groupSelect = buildSelect('timeline-group', [
      { v: 'day', t: 'By Day' },
      { v: 'week', t: 'By Week' },
      { v: 'none', t: 'No Grouping' }
    ], currentGroup);
    toolbar.appendChild(groupSelect);

    var filterSelect = buildSelect('timeline-filter', [
      { v: 'all', t: 'All' },
      { v: 'active', t: 'Active' },
      { v: 'expiring', t: 'Expiring' },
      { v: 'inactive', t: 'Inactive' },
      { v: 'expired', t: 'Expired' },
      { v: 'global', t: 'Global' }
    ], currentFilter);
    toolbar.appendChild(filterSelect);
    panel.appendChild(toolbar);

    buildHeatmapSection(panel);

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

  function buildSelect(actions, opts, selectedValue) {
    var sel = window.__ca.shared.$create('select', { className: 'ca-sort-select', 'data-action': actions, 'aria-label': 'Select option' });
    for (var i = 0; i < opts.length; i++) {
      var opt = document.createElement('option');
      opt.value = opts[i].v;
      opt.textContent = opts[i].t;
      if (opts[i].v === selectedValue) opt.selected = true;
      sel.appendChild(opt);
    }
    return sel;
  }

  function buildHeatmapSection(panel) {
    var $create = window.__ca.shared.$create;

    var section = $create('div', { id: 'ca-timeline-heatmap', className: 'ca-timeline-heatmap' });

    var toggle = $create('div', { className: 'ca-timeline-heatmap-toggle', 'data-action': 'toggle-heatmap' });
    toggle.textContent = (heatmapExpanded ? '▾' : '▸') + ' Activity Heatmap';
    section.appendChild(toggle);

    var gridContainer = $create('div', { id: 'ca-timeline-heatmap-grid-container', className: 'ca-timeline-heatmap-grid-container' + (heatmapExpanded ? '' : ' collapsed') });
    section.appendChild(gridContainer);

    if (heatmapExpanded) {
      renderHeatmapGrid(gridContainer);
    }

    panel.appendChild(section);
  }

  function renderHeatmapGrid(container) {
    var $create = window.__ca.shared.$create;
    var heatmap = window.__ca.storage.getUsageHeatmap();

    while (container.firstChild) container.removeChild(container.firstChild);

    var now = new Date();
    var rangeDays = heatmapRange === '3months' ? 90 : heatmapRange === 'all' ? 365 : 180;
    var rawStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - rangeDays + 1);
    var startDow = rawStart.getUTCDay() || 7;
    var startDateUTC = Date.UTC(rawStart.getUTCFullYear(), rawStart.getUTCMonth(), rawStart.getUTCDate() - (startDow - 1));
    var todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

    var maxVal = 0;
    var dates = Object.keys(heatmap);
    for (var i = 0; i < dates.length; i++) {
      var ts = parseInt(dates[i], 10);
      if (ts >= startDateUTC) {
        maxVal = Math.max(maxVal, heatmap[dates[i]]);
      }
    }
    if (maxVal === 0) maxVal = 1;

    var controls = $create('div', { className: 'ca-timeline-heatmap-controls' });

    var modeToggle = $create('button', {
      className: 'ca-timeline-heatmap-mode-btn',
      'data-action': 'heatmap-mode',
      textContent: heatmapMode === 'activity' ? 'Mode: Usage' : 'Mode: Created'
    });
    controls.appendChild(modeToggle);

    var colorToggle = $create('button', {
      className: 'ca-timeline-heatmap-color-btn',
      'data-action': 'heatmap-color',
      textContent: heatmapColor === 'blue' ? 'Blue' : 'Green'
    });
    controls.appendChild(colorToggle);

    var rangeSelect = buildSelect('heatmap-range', [
      { v: '3months', t: '3 Months' },
      { v: '6months', t: '6 Months' },
      { v: 'all', t: 'All Time' }
    ], heatmapRange);
    rangeSelect.className = 'ca-timeline-heatmap-range';
    controls.appendChild(rangeSelect);

    if (heatmapDate) {
      var clearBtn = $create('button', { className: 'ca-timeline-heatmap-clear', 'data-action': 'clear-heatmap', textContent: 'Clear filter' });
      controls.appendChild(clearBtn);
    }

    container.appendChild(controls);

    var gridFrame = $create('div', { className: 'ca-timeline-heatmap-frame' });
    var grid = $create('div', { className: 'ca-timeline-heatmap-grid' });
    var headerRow = $create('div', { className: 'ca-timeline-heatmap-row' });
    var corner = $create('div', { className: 'ca-timeline-heatmap-label' });
    headerRow.appendChild(corner);

    var weekMs = 7 * 86400000;
    var totalCols = Math.max(1, Math.ceil((todayUTC - startDateUTC) / weekMs));
    var colStartDates = [];
    for (var c = totalCols - 1; c >= 0; c--) {
      var colTs = startDateUTC + c * weekMs;
      colStartDates.push(colTs);
    }

    if (heatmapScrollPos === 0 || heatmapScrollPos > totalCols - heatmapColsVisible) {
      heatmapScrollPos = Math.max(0, totalCols - heatmapColsVisible);
    }
    var visibleDates = colStartDates.slice(heatmapScrollPos, heatmapScrollPos + heatmapColsVisible);

    var currentMonth = '';
    for (var ci = 0; ci < visibleDates.length; ci++) {
      var colDate = new Date(visibleDates[ci]);
      var monthLabel = colDate.toLocaleDateString('en-US', { month: 'short' });
      var label = monthLabel !== currentMonth ? monthLabel : '';
      currentMonth = monthLabel;
      var colLabel = $create('div', { className: 'ca-timeline-heatmap-label', textContent: label });
      headerRow.appendChild(colLabel);
    }
    grid.appendChild(headerRow);

    var days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    for (var r = 0; r < 7; r++) {
      var row = $create('div', { className: 'ca-timeline-heatmap-row' });
      var dayLabel = $create('div', { className: 'ca-timeline-heatmap-label', textContent: days[r] });
      row.appendChild(dayLabel);

      for (var ci = 0; ci < visibleDates.length; ci++) {
        var cellTs = visibleDates[ci] + r * 86400000;
        var cellKey = cellTs;
        var val = heatmap[cellKey] || 0;
        var opacity = val > 0 ? Math.max(0.1, Math.min(1, val / maxVal)) : 0;

        var cellClass = 'ca-timeline-heatmap-cell';
        if (val > 0) cellClass += ' populated';
        if (heatmapDate && cellTs === heatmapDate.getTime()) cellClass += ' selected';
        if (cellTs === todayUTC) cellClass += ' today';

        var cell = $create('div', { className: cellClass, 'data-action': 'select-heatmap-day', 'data-date': String(cellTs) });
        var colorVar = heatmapColor === 'blue' ? 'var(--ca-accent)' : 'var(--ca-success)';
        if (val > 0) {
          cell.style.backgroundColor = colorVar;
          cell.style.opacity = String(opacity);
        }
        cell.title = new Date(cellTs).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ' \u00B7 ' + val + ' turns';
        row.appendChild(cell);
      }
      grid.appendChild(row);
    }

    gridFrame.appendChild(grid);
    container.appendChild(gridFrame);

    if (totalCols > heatmapColsVisible) {
      var scrollBar = $create('div', { className: 'ca-heatmap-scroll-bar' });

      var atLeft = heatmapScrollPos <= 0;
      var atRight = heatmapScrollPos >= totalCols - heatmapColsVisible;

      var leftBtn = $create('button', { className: 'ca-heatmap-scroll-btn', 'data-action': 'heatmap-scroll-left', 'data-amount': String(-heatmapScrollStep), 'aria-label': 'Scroll left' });
      if (atLeft) leftBtn.setAttribute('disabled', '');
      var leftSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      leftSvg.setAttribute('viewBox', '0 0 24 24');
      leftSvg.setAttribute('fill', 'none');
      leftSvg.setAttribute('stroke', 'currentColor');
      leftSvg.setAttribute('stroke-width', '2');
      leftSvg.setAttribute('width', '16');
      leftSvg.setAttribute('height', '16');
      var leftPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      leftPath.setAttribute('d', 'M15 18l-6-6 6-6');
      leftSvg.appendChild(leftPath);
      leftBtn.appendChild(leftSvg);
      scrollBar.appendChild(leftBtn);

      var rightBtn = $create('button', { className: 'ca-heatmap-scroll-btn', 'data-action': 'heatmap-scroll-right', 'data-amount': String(heatmapScrollStep), 'aria-label': 'Scroll right' });
      if (atRight) rightBtn.setAttribute('disabled', '');
      var rightSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      rightSvg.setAttribute('viewBox', '0 0 24 24');
      rightSvg.setAttribute('fill', 'none');
      rightSvg.setAttribute('stroke', 'currentColor');
      rightSvg.setAttribute('stroke-width', '2');
      rightSvg.setAttribute('width', '16');
      rightSvg.setAttribute('height', '16');
      var rightPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      rightPath.setAttribute('d', 'M9 18l6-6-6-6');
      rightSvg.appendChild(rightPath);
      rightBtn.appendChild(rightSvg);
      scrollBar.appendChild(rightBtn);

      container.appendChild(scrollBar);
    }

    var legend = $create('div', { className: 'ca-timeline-heatmap-legend' });
    legend.appendChild($create('span', { textContent: 'Less' }));
    for (var lv = 0; lv < 4; lv++) {
      var legCell = $create('div', { className: 'ca-timeline-heatmap-cell populated' });
      legCell.style.backgroundColor = colorVar;
      legCell.style.opacity = String((lv + 1) * 0.25);
      legend.appendChild(legCell);
    }
    legend.appendChild($create('span', { textContent: 'More' }));
    container.appendChild(legend);
  }

  function updateHeatmapSection() {
    var container = window.__ca.shared.$id('ca-timeline-heatmap-grid-container');
    if (!container || container.classList.contains('collapsed')) return;
    renderHeatmapGrid(container);
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

    if (heatmapDate) {
      anchors = anchors.filter(function(a) {
        if (heatmapMode === 'created') return false;
        var history = a.usageHistory;
        if (!history) return false;
        for (var hi = 0; hi < history.length; hi++) {
          var hd = new Date(history[hi]);
          var hKey = Date.UTC(hd.getUTCFullYear(), hd.getUTCMonth(), hd.getUTCDate());
          if (hKey === heatmapDate.getTime()) return true;
        }
        return false;
      });
    }

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
    updateHeatmapSection();
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
      } else if (action === 'toggle-heatmap') {
        heatmapExpanded = !heatmapExpanded;
        heatmapDate = null;
        heatmapScrollPos = 0;
        var toggle = window.__ca.shared.$one('.ca-timeline-heatmap-toggle');
        if (toggle) {
          toggle.textContent = (heatmapExpanded ? '▾' : '▸') + ' Activity Heatmap';
        }
        var gridContainer = window.__ca.shared.$id('ca-timeline-heatmap-grid-container');
        if (gridContainer) {
          gridContainer.className = 'ca-timeline-heatmap-grid-container' + (heatmapExpanded ? '' : ' collapsed');
          updateTimeline();
        }
      } else if (action === 'select-heatmap-day') {
        var date = parseInt(target.dataset.date, 10);
        if (heatmapDate && heatmapDate.getTime() === date) {
          heatmapDate = null;
        } else {
          heatmapDate = new Date(date);
        }
        updateTimeline();
      } else if (action === 'heatmap-mode') {
        heatmapMode = heatmapMode === 'activity' ? 'created' : 'activity';
        updateTimeline();
      } else if (action === 'heatmap-color') {
        heatmapColor = heatmapColor === 'blue' ? 'green' : 'blue';
        updateTimeline();
      } else if (action === 'heatmap-scroll-left' || action === 'heatmap-scroll-right') {
        var amount = parseInt(target.dataset.amount, 10);
        heatmapScrollPos = Math.max(0, heatmapScrollPos + amount);
        updateTimeline();
      } else if (action === 'clear-heatmap') {
        heatmapDate = null;
        updateTimeline();
      }
    });

    overlay.addEventListener('change', function(e) {
      var target = e.target.closest('[data-action]');
      if (!target) return;

      if (target.dataset.action === 'timeline-sort') {
        currentSort = target.value;
        heatmapScrollPos = 0;
        updateTimeline();
      } else if (target.dataset.action === 'timeline-group') {
        currentGroup = target.value;
        collapsedGroups = {};
        heatmapDate = null;
        heatmapScrollPos = 0;
        updateTimeline();
      } else if (target.dataset.action === 'timeline-filter') {
        currentFilter = target.value;
        heatmapDate = null;
        heatmapScrollPos = 0;
        updateTimeline();
      } else if (target.dataset.action === 'heatmap-range') {
        heatmapRange = target.value;
        heatmapScrollPos = 0;
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
