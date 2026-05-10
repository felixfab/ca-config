(function(root) {
  'use strict';

  var CACHE_KEY = '__ca_anchors_cache';
  var TEMPLATE_KEY = '__ca_templates_cache';
  var WRITE_DELAY = 500;
  var DEBOUNCE_TIMER = null;
  var templateDebounceTimer = null;

  var cache = [];
  var templateCache = [];

  function generateId() {
    return 'anchor_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  function getStorageKey() {
    return CACHE_KEY;
  }

  function loadFromStorage(callback) {
    chrome.storage.local.get([getStorageKey(), TEMPLATE_KEY], function(data) {
      var anchors = data[getStorageKey()] || [];
      var templates = data[TEMPLATE_KEY] || [];
      cache = anchors;
      templateCache = templates;
      if (callback) callback(anchors);
    });
  }

  function saveToStorage(anchors, callback) {
    clearTimeout(DEBOUNCE_TIMER);
    DEBOUNCE_TIMER = setTimeout(function() {
      var obj = {};
      obj[getStorageKey()] = anchors;
      obj[TEMPLATE_KEY] = templateCache;
      chrome.storage.local.set(obj, function() {
        if (callback) callback();
      });
    }, WRITE_DELAY);
  }

  function saveTemplates(callback) {
    clearTimeout(templateDebounceTimer);
    templateDebounceTimer = setTimeout(function() {
      var obj = {};
      obj[TEMPLATE_KEY] = templateCache;
      chrome.storage.local.set(obj, function() {
        if (callback) callback();
      });
    }, WRITE_DELAY);
  }

  function createAnchor(text, sourceUrl, turnsTotal) {
    turnsTotal = (turnsTotal === undefined || turnsTotal === null) ? 10 : turnsTotal;
    var anchor = {
      id: generateId(),
      text: text,
      sourceUrl: sourceUrl || (typeof window !== 'undefined' ? window.location.href : ''),
      createdAt: Date.now(),
      turnsTotal: turnsTotal,
      turnsRemaining: turnsTotal,
      active: turnsTotal > 0,
      order: Date.now()
    };

    cache.push(anchor);
    saveToStorage(cache);
    return anchor;
  }

  function getAll() {
    return cache.slice();
  }

  function getActive() {
    return cache
      .filter(function(a) { return a.active && a.turnsRemaining > 0; })
      .sort(function(a, b) { return b.order - a.order; });
  }

  function updateAnchor(id, updates) {
    for (var i = 0; i < cache.length; i++) {
      if (cache[i].id === id) {
        for (var key in updates) {
          if (updates.hasOwnProperty(key)) {
            cache[i][key] = updates[key];
          }
        }
        break;
      }
    }
    saveToStorage(cache);
  }

  function deleteAnchor(id) {
    for (var i = 0; i < cache.length; i++) {
      if (cache[i].id === id) {
        cache.splice(i, 1);
        break;
      }
    }
    saveToStorage(cache);
  }

  function toggleAnchor(id) {
    for (var i = 0; i < cache.length; i++) {
      if (cache[i].id === id) {
        cache[i].active = !cache[i].active;
        break;
      }
    }
    saveToStorage(cache);
  }

  function extendTurns(id, additionalTurns) {
    additionalTurns = additionalTurns || 5;
    for (var i = 0; i < cache.length; i++) {
      if (cache[i].id === id) {
        cache[i].turnsRemaining += additionalTurns;
        cache[i].turnsTotal += additionalTurns;
        if (cache[i].turnsRemaining > 0) {
          cache[i].active = true;
        }
        break;
      }
    }
    saveToStorage(cache);
  }

  function addTag(id, tag) {
    for (var i = 0; i < cache.length; i++) {
      if (cache[i].id === id) {
        if (!cache[i].tags) cache[i].tags = [];
        if (cache[i].tags.indexOf(tag) === -1) {
          cache[i].tags.push(tag);
        }
        break;
      }
    }
    saveToStorage(cache);
  }

  function removeTag(id, tag) {
    for (var i = 0; i < cache.length; i++) {
      if (cache[i].id === id && cache[i].tags) {
        var idx = cache[i].tags.indexOf(tag);
        if (idx !== -1) {
          cache[i].tags.splice(idx, 1);
        }
        break;
      }
    }
    saveToStorage(cache);
  }

  function generateTemplateId() {
    return 'tpl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  function createTemplate(name, text, tags) {
    var tpl = {
      id: generateTemplateId(),
      name: name,
      text: text,
      tags: tags || [],
      createdAt: Date.now(),
      usageCount: 0
    };
    templateCache.push(tpl);
    saveTemplates();
    return tpl;
  }

  function getTemplates() {
    return templateCache.slice().sort(function(a, b) { return b.createdAt - a.createdAt; });
  }

  function deleteTemplate(id) {
    for (var i = 0; i < templateCache.length; i++) {
      if (templateCache[i].id === id) {
        templateCache.splice(i, 1);
        break;
      }
    }
    saveTemplates();
  }

  function updateTemplate(id, updates) {
    for (var i = 0; i < templateCache.length; i++) {
      if (templateCache[i].id === id) {
        for (var key in updates) {
          if (updates.hasOwnProperty(key)) {
            templateCache[i][key] = updates[key];
          }
        }
        break;
      }
    }
    saveTemplates();
  }

  function activateTemplate(id) {
    for (var i = 0; i < templateCache.length; i++) {
      if (templateCache[i].id === id) {
        var tpl = templateCache[i];
        tpl.usageCount = (tpl.usageCount || 0) + 1;
        saveTemplates();
        var sourceUrl = (typeof window !== 'undefined' && window.location) ? window.location.href : '';
        return createAnchor(tpl.text, sourceUrl, 10);
      }
    }
    return null;
  }

  function decrementTurnsForActive() {
    var changed = false;
    for (var i = 0; i < cache.length; i++) {
      if (cache[i].active && cache[i].turnsRemaining > 0) {
        cache[i].turnsRemaining--;
        cache[i].usageCount = (cache[i].usageCount || 0) + 1;
        cache[i].lastUsed = Date.now();
        cache[i].totalTurnsConsumed = (cache[i].totalTurnsConsumed || 0) + 1;
        changed = true;
        if (cache[i].turnsRemaining === 0) {
          cache[i].active = false;
        }
      }
    }
    if (changed) {
      saveToStorage(cache);
    }
  }

  function clearExpired() {
    var original = cache.length;
    cache = cache.filter(function(a) {
      return a.turnsRemaining > 0;
    });
    if (cache.length !== original) {
      saveToStorage(cache);
    }
  }

  function init(callback) {
    loadFromStorage(function(anchors) {
      if (callback) callback();
    });
  }

  function resetForTesting() {
    cache = [];
    templateCache = [];
    clearTimeout(DEBOUNCE_TIMER);
    clearTimeout(templateDebounceTimer);
    DEBOUNCE_TIMER = null;
    templateDebounceTimer = null;
  }

  var Storage = {
    init: init,
    createAnchor: createAnchor,
    getAll: getAll,
    getActive: getActive,
    updateAnchor: updateAnchor,
    deleteAnchor: deleteAnchor,
    toggleAnchor: toggleAnchor,
    extendTurns: extendTurns,
    addTag: addTag,
    removeTag: removeTag,
    decrementTurnsForActive: decrementTurnsForActive,
    clearExpired: clearExpired,
    createTemplate: createTemplate,
    getTemplates: getTemplates,
    deleteTemplate: deleteTemplate,
    updateTemplate: updateTemplate,
    activateTemplate: activateTemplate,
    resetForTesting: resetForTesting,
    _setCache: function(c) { cache = c; },
    _getCache: function() { return cache; },
    _setTemplateCache: function(c) { templateCache = c; },
    _getTemplateCache: function() { return templateCache; }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Storage;
  } else if (typeof window !== 'undefined') {
    window.__ca = window.__ca || {};
    window.__ca.storage = Storage;
  } else if (typeof root !== 'undefined') {
    root.__ca = root.__ca || {};
    root.__ca.storage = Storage;
  }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : null));