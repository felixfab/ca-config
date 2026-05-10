(function(root) {
  'use strict';

  var CACHE_KEY = '__ca_anchors_cache';
  var TEMPLATE_KEY = '__ca_templates_cache';
  var SETTINGS_KEY = '__ca_settings';
  var WRITE_DELAY = 500;
  var DEBOUNCE_TIMER = null;
  var templateDebounceTimer = null;

  var cache = [];
  var templateCache = [];
  var settings = { injectionMode: 'prepend' };

  function generateId() {
    return 'anchor_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  function getStorageKey() {
    return CACHE_KEY;
  }

  function loadFromStorage(callback) {
    chrome.storage.local.get([getStorageKey(), TEMPLATE_KEY, SETTINGS_KEY], function(data) {
      var anchors = data[getStorageKey()] || [];
      var templates = data[TEMPLATE_KEY] || [];
      var savedSettings = data[SETTINGS_KEY] || {};
      cache = anchors;
      templateCache = templates;
      settings = Object.assign(settings, savedSettings);
      if (callback) callback(anchors);
    });
  }

  function saveToStorage(anchors, callback) {
    clearTimeout(DEBOUNCE_TIMER);
    DEBOUNCE_TIMER = setTimeout(function() {
      var obj = {};
      obj[getStorageKey()] = anchors;
      obj[TEMPLATE_KEY] = templateCache;
      obj[SETTINGS_KEY] = settings;
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
      obj[SETTINGS_KEY] = settings;
      chrome.storage.local.set(obj, function() {
        if (callback) callback();
      });
    }, WRITE_DELAY);
  }

  function saveSettings(callback) {
    clearTimeout(DEBOUNCE_TIMER);
    DEBOUNCE_TIMER = setTimeout(function() {
      var obj = {};
      obj[SETTINGS_KEY] = settings;
      chrome.storage.local.set(obj, function() {
        if (callback) callback();
      });
    }, WRITE_DELAY);
  }

  function createAnchor(text, sourceUrl, turnsTotal, isGlobal) {
    turnsTotal = (turnsTotal === undefined || turnsTotal === null) ? 10 : turnsTotal;
    var anchor = {
      id: generateId(),
      text: text,
      sourceUrl: sourceUrl || (typeof window !== 'undefined' ? window.location.href : ''),
      createdAt: Date.now(),
      turnsTotal: turnsTotal,
      turnsRemaining: turnsTotal,
      originalTurns: turnsTotal,
      active: turnsTotal > 0,
      order: Date.now(),
      global: !!isGlobal
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

  function resetTurns(id) {
    for (var i = 0; i < cache.length; i++) {
      if (cache[i].id === id) {
        var target = cache[i].originalTurns || cache[i].turnsTotal;
        cache[i].turnsRemaining = target;
        cache[i].turnsTotal = target;
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

  function getSorted(sortBy) {
    var list = cache.slice();
    if (sortBy === 'most-used') {
      list.sort(function(a, b) { return (b.usageCount || 0) - (a.usageCount || 0); });
    } else if (sortBy === 'recently-used') {
      list.sort(function(a, b) { return (b.lastUsed || 0) - (a.lastUsed || 0); });
    } else {
      list.sort(function(a, b) { return b.order - a.order; });
    }
    return list;
  }

  function setGlobal(id, isGlobal) {
    for (var i = 0; i < cache.length; i++) {
      if (cache[i].id === id) {
        cache[i].global = !!isGlobal;
        break;
      }
    }
    saveToStorage(cache);
  }

  function getGlobalOnly() {
    return cache.filter(function(a) { return a.global; });
  }

  function bulkToggle(ids) {
    for (var i = 0; i < cache.length; i++) {
      if (ids.indexOf(cache[i].id) !== -1) {
        cache[i].active = !cache[i].active;
      }
    }
    saveToStorage(cache);
  }

  function bulkDelete(ids) {
    cache = cache.filter(function(a) { return ids.indexOf(a.id) === -1; });
    saveToStorage(cache);
  }

  function bulkExtend(ids, additionalTurns) {
    additionalTurns = additionalTurns || 5;
    for (var i = 0; i < cache.length; i++) {
      if (ids.indexOf(cache[i].id) !== -1) {
        cache[i].turnsRemaining += additionalTurns;
        cache[i].turnsTotal += additionalTurns;
        if (cache[i].turnsRemaining > 0) {
          cache[i].active = true;
        }
      }
    }
    saveToStorage(cache);
  }

  function getSetting(key) {
    return settings[key];
  }

  function setSetting(key, value) {
    settings[key] = value;
    saveSettings();
  }

  function getInjectionMode() {
    return settings.injectionMode || 'prepend';
  }

  function setInjectionMode(mode) {
    settings.injectionMode = mode;
    saveSettings();
  }

  function init(callback) {
    loadFromStorage(function(anchors) {
      if (callback) callback();
    });
  }

  function resetForTesting() {
    cache = [];
    templateCache = [];
    settings = { injectionMode: 'prepend' };
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
    getSorted: getSorted,
    getGlobalOnly: getGlobalOnly,
    updateAnchor: updateAnchor,
    deleteAnchor: deleteAnchor,
    toggleAnchor: toggleAnchor,
    setGlobal: setGlobal,
    extendTurns: extendTurns,
    resetTurns: resetTurns,
    addTag: addTag,
    removeTag: removeTag,
    bulkToggle: bulkToggle,
    bulkDelete: bulkDelete,
    bulkExtend: bulkExtend,
    decrementTurnsForActive: decrementTurnsForActive,
    clearExpired: clearExpired,
    getSetting: getSetting,
    setSetting: setSetting,
    getInjectionMode: getInjectionMode,
    setInjectionMode: setInjectionMode,
    createTemplate: createTemplate,
    getTemplates: getTemplates,
    deleteTemplate: deleteTemplate,
    updateTemplate: updateTemplate,
    activateTemplate: activateTemplate,
    resetForTesting: resetForTesting,
    _setCache: function(c) { cache = c; },
    _getCache: function() { return cache; },
    _setTemplateCache: function(c) { templateCache = c; },
    _getTemplateCache: function() { return templateCache; },
    _getSettings: function() { return settings; },
    _setSettings: function(s) { settings = s; }
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