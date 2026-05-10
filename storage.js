(function(root) {
  'use strict';

  var CACHE_KEY = '__ca_anchors_cache';
  var WRITE_DELAY = 500;
  var DEBOUNCE_TIMER = null;

  var cache = [];

  function generateId() {
    return 'anchor_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  function getStorageKey() {
    return CACHE_KEY;
  }

  function loadFromStorage(callback) {
    chrome.storage.local.get(getStorageKey(), function(data) {
      var anchors = data[getStorageKey()] || [];
      cache = anchors;
      callback(anchors);
    });
  }

  function saveToStorage(anchors, callback) {
    clearTimeout(DEBOUNCE_TIMER);
    DEBOUNCE_TIMER = setTimeout(function() {
      var obj = {};
      obj[getStorageKey()] = anchors;
      chrome.storage.local.set(obj, function() {
        if (callback) callback();
      });
    }, WRITE_DELAY);
  }

  function createAnchor(text, sourceUrl, turnsTotal) {
    turnsTotal = turnsTotal || 10;
    var anchor = {
      id: generateId(),
      text: text,
      sourceUrl: sourceUrl || (typeof window !== 'undefined' ? window.location.href : ''),
      createdAt: Date.now(),
      turnsTotal: turnsTotal,
      turnsRemaining: turnsTotal,
      active: true,
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

  function decrementTurnsForActive() {
    var changed = false;
    for (var i = 0; i < cache.length; i++) {
      if (cache[i].active && cache[i].turnsRemaining > 0) {
        cache[i].turnsRemaining--;
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
    clearTimeout(DEBOUNCE_TIMER);
    DEBOUNCE_TIMER = null;
  }

  var Storage = {
    init: init,
    createAnchor: createAnchor,
    getAll: getAll,
    getActive: getActive,
    updateAnchor: updateAnchor,
    deleteAnchor: deleteAnchor,
    toggleAnchor: toggleAnchor,
    decrementTurnsForActive: decrementTurnsForActive,
    clearExpired: clearExpired,
    resetForTesting: resetForTesting,
    _setCache: function(c) { cache = c; },
    _getCache: function() { return cache; }
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