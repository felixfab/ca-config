var Storage = require('../storage.js');

var mockStorage = {};

global.chrome = {
  storage: {
    local: {
      get: function(keys, callback) {
        var result = {};
        if (typeof keys === 'string') {
          result[keys] = mockStorage[keys];
        } else if (Array.isArray(keys)) {
          for (var i = 0; i < keys.length; i++) {
            result[keys[i]] = mockStorage[keys[i]];
          }
        } else {
          for (var key in keys) {
            result[key] = mockStorage[key] !== undefined ? mockStorage[key] : keys[key];
          }
        }
        if (callback) callback(result);
      },
      set: function(obj, callback) {
        for (var key in obj) {
          mockStorage[key] = obj[key];
        }
        if (callback) callback();
      }
    }
  }
};

var passed = 0;
var failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log('  PASS: ' + message);
  } else {
    failed++;
    console.error('  FAIL: ' + message);
  }
}

function resetStorage() {
  Storage.resetForTesting();
  Storage._setCache([]);
  Storage._setTemplateCache([]);
  Storage._setSettings({ injectionMode: 'prepend' });
  mockStorage = {};
}

console.log('\n=== Storage Tests ===\n');

console.log('--- Init ---');
Storage.init();
assert(typeof Storage.getAll === 'function', 'getAll is a function');
assert(Array.isArray(Storage.getAll()), 'getAll returns array');
assert(Storage.getAll().length === 0, 'getAll returns empty array initially');

console.log('\n--- Create Anchor ---');
resetStorage();
var anchor = Storage.createAnchor('Test anchor text', 'https://example.com', 10);
assert(anchor.id.indexOf('anchor_') === 0, 'ID starts with anchor_');
assert(anchor.text === 'Test anchor text', 'Text matches');
assert(anchor.sourceUrl === 'https://example.com', 'Source URL matches');
assert(anchor.turnsTotal === 10, 'Turns total is 10');
assert(anchor.turnsRemaining === 10, 'Turns remaining is 10');
assert(anchor.active === true, 'Anchor is active');
assert(typeof anchor.createdAt === 'number', 'CreatedAt is a number');
assert(Storage.getAll().length === 1, 'One anchor in storage');

console.log('\n--- Default Turns ---');
resetStorage();
var anchorDefault = Storage.createAnchor('Default turns');
assert(anchorDefault.turnsTotal === 10, 'Default turns total is 10');
assert(anchorDefault.turnsRemaining === 10, 'Default turns remaining is 10');

console.log('\n--- Get Active ---');
resetStorage();
Storage.createAnchor('Active 1', '', 10);
Storage.createAnchor('Active 2', '', 5);
var active = Storage.getActive();
assert(active.length === 2, 'Two active anchors');

Storage.createAnchor('Inactive', '', 0);
var activeAfter = Storage.getActive();
assert(activeAfter.length === 2, 'Inactive anchor not in active list');

console.log('\n--- Update Anchor ---');
resetStorage();
var a = Storage.createAnchor('Original', '', 10);
Storage.updateAnchor(a.id, { text: 'Updated text' });
var updated = Storage.getAll()[0];
assert(updated.text === 'Updated text', 'Text updated');

console.log('\n--- Delete Anchor ---');
resetStorage();
var d = Storage.createAnchor('To delete', '', 10);
assert(Storage.getAll().length === 1, 'One anchor before delete');
Storage.deleteAnchor(d.id);
assert(Storage.getAll().length === 0, 'Zero anchors after delete');

console.log('\n--- Toggle Anchor ---');
resetStorage();
var t = Storage.createAnchor('Toggle test', '', 10);
assert(t.active === true, 'Initially active');
Storage.toggleAnchor(t.id);
assert(Storage.getAll()[0].active === false, 'Now inactive');
Storage.toggleAnchor(t.id);
assert(Storage.getAll()[0].active === true, 'Active again');

console.log('\n--- Decrement Turns ---');
resetStorage();
Storage.createAnchor('Turns test', '', 3);
Storage.decrementTurnsForActive();
assert(Storage.getActive()[0].turnsRemaining === 2, 'Turns decremented to 2');
Storage.decrementTurnsForActive();
assert(Storage.getActive()[0].turnsRemaining === 1, 'Turns decremented to 1');
Storage.decrementTurnsForActive();
assert(Storage.getActive().length === 0, 'Anchor deactivated at 0 turns');

console.log('\n--- Clear Expired ---');
resetStorage();
Storage.createAnchor('Will expire', '', 1);
Storage.decrementTurnsForActive();
assert(Storage.getAll().length === 1, 'Expired anchor still in storage');
Storage.clearExpired();
assert(Storage.getAll().length === 0, 'Expired anchor cleared');

console.log('\n--- Extend Turns ---');
resetStorage();
var e = Storage.createAnchor('Extend test', '', 5);
assert(e.turnsRemaining === 5, 'Initial turns 5');
Storage.extendTurns(e.id, 5);
var extended = Storage.getAll()[0];
assert(extended.turnsRemaining === 10, 'Turns extended to 10');
assert(extended.turnsTotal === 10, 'Total turns also updated');

console.log('\n--- Extend Turns (Inactive) ---');
resetStorage();
var ei = Storage.createAnchor('Inactive extend', '', 1);
Storage.decrementTurnsForActive();
assert(Storage.getAll()[0].active === false, 'Anchor is inactive');
Storage.extendTurns(ei.id, 5);
assert(Storage.getAll()[0].active === true, 'Anchor reactivated');
assert(Storage.getAll()[0].turnsRemaining === 5, 'Turns restored');

console.log('\n--- Reset Turns ---');
resetStorage();
var rt = Storage.createAnchor('Reset test', '', 10);
for (var ri = 0; ri < 7; ri++) { Storage.decrementTurnsForActive(); }
assert(Storage.getAll()[0].turnsRemaining === 3, 'Down to 3 turns');
assert(Storage.getAll()[0].turnsTotal === 10, 'Total still 10');
Storage.resetTurns(rt.id);
assert(Storage.getAll()[0].turnsRemaining === 10, 'Turns reset to 10');
assert(Storage.getAll()[0].turnsTotal === 10, 'Total unchanged');
assert(Storage.getAll()[0].active === true, 'Still active');

console.log('\n--- Reset After Extend ---');
Storage.extendTurns(rt.id, 25);
assert(Storage.getAll()[0].turnsTotal === 35, 'Total inflated to 35');
assert(Storage.getAll()[0].turnsRemaining === 35, 'Remaining also 35');
for (ri = 0; ri < 20; ri++) { Storage.decrementTurnsForActive(); }
assert(Storage.getAll()[0].turnsRemaining === 15, 'Down to 15 after use');
Storage.resetTurns(rt.id);
assert(Storage.getAll()[0].turnsRemaining === 10, 'Reset to original 10, not 35');
assert(Storage.getAll()[0].turnsTotal === 10, 'Total reset to original 10');
assert(Storage.getAll()[0].originalTurns === 10, 'originalTurns never changes');

console.log('\n--- Add Tag ---');
resetStorage();
var tagA = Storage.createAnchor('Tag test', '', 10);
Storage.addTag(tagA.id, 'research');
assert(Storage.getAll()[0].tags && Storage.getAll()[0].tags.length === 1, 'Tag added');
assert(Storage.getAll()[0].tags[0] === 'research', 'Tag value is research');

console.log('\n--- Add Duplicate Tag ---');
Storage.addTag(tagA.id, 'research');
assert(Storage.getAll()[0].tags.length === 1, 'Duplicate tag not added');

console.log('\n--- Remove Tag ---');
Storage.addTag(tagA.id, 'code');
assert(Storage.getAll()[0].tags.length === 2, 'Second tag added');
Storage.removeTag(tagA.id, 'research');
assert(Storage.getAll()[0].tags.length === 1, 'Tag removed');
assert(Storage.getAll()[0].tags[0] === 'code', 'Remaining tag is code');

console.log('\n--- Reset For Testing ---');
Storage.resetForTesting();
assert(Storage._getCache().length === 0, 'Cache cleared');
assert(Storage._getTemplateCache().length === 0, 'Template cache cleared');

console.log('\n--- Usage Analytics ---');
resetStorage();
var analyticsA = Storage.createAnchor('Analytics test', '', 5);
assert(analyticsA.usageCount === undefined, 'No usage count initially');
Storage.decrementTurnsForActive();
assert(Storage.getAll()[0].usageCount === 1, 'Usage count incremented to 1');
assert(typeof Storage.getAll()[0].lastUsed === 'number', 'lastUsed timestamp set');
assert(Storage.getAll()[0].totalTurnsConsumed === 1, 'totalTurnsConsumed is 1');
Storage.decrementTurnsForActive();
assert(Storage.getAll()[0].usageCount === 2, 'Usage count incremented to 2');
assert(Storage.getAll()[0].totalTurnsConsumed === 2, 'totalTurnsConsumed is 2');

console.log('\n--- Create Template ---');
resetStorage();
var tpl = Storage.createTemplate('Code Style Guide', 'Always use semicolons and const.', ['coding', 'style']);
assert(tpl.id.indexOf('tpl_') === 0, 'Template ID starts with tpl_');
assert(tpl.name === 'Code Style Guide', 'Template name matches');
assert(tpl.text === 'Always use semicolons and const.', 'Template text matches');
assert(tpl.tags.length === 2, 'Template has 2 tags');
assert(Storage.getTemplates().length === 1, 'One template in storage');

console.log('\n--- Get Templates ---');
Storage.createTemplate('Research Notes', 'Focus on peer-reviewed sources.', ['research']);
assert(Storage.getTemplates().length === 2, 'Two templates in storage');
assert(Storage.getTemplates()[0].createdAt >= Storage.getTemplates()[1].createdAt, 'Templates sorted by createdAt desc');

console.log('\n--- Update Template ---');
var tplId = Storage.getTemplates()[0].id;
Storage.updateTemplate(tplId, { name: 'Updated Name' });
var updatedTpl = Storage.getTemplates().filter(function(t) { return t.id === tplId; })[0];
assert(updatedTpl.name === 'Updated Name', 'Template name updated');

console.log('\n--- Delete Template ---');
assert(Storage.getTemplates().length === 2, 'Two templates before delete');
Storage.deleteTemplate(tplId);
assert(Storage.getTemplates().length === 1, 'One template after delete');

console.log('\n--- Activate Template ---');
resetStorage();
Storage.createTemplate('Test Template', 'This is test context.', []);
var tplToActivate = Storage.getTemplates()[0];
var activatedAnchor = Storage.activateTemplate(tplToActivate.id);
assert(activatedAnchor !== null, 'Activation returns anchor');
assert(activatedAnchor.text === 'This is test context.', 'Anchor text matches template');
assert(Storage.getTemplates()[0].usageCount === 1, 'Template usage count incremented');

console.log('\n--- Global Anchors ---');
resetStorage();
var g1 = Storage.createAnchor('Global anchor', '', 10, true);
var g2 = Storage.createAnchor('Local anchor', '', 10, false);
assert(g1.global === true, 'Global flag set on creation');
assert(g2.global === false, 'Local flag set on creation');
assert(Storage.getGlobalOnly().length === 1, 'One global anchor');
Storage.setGlobal(g2.id, true);
assert(Storage.getGlobalOnly().length === 2, 'Now two global anchors');
Storage.setGlobal(g2.id, false);
assert(Storage.getGlobalOnly().length === 1, 'Back to one global anchor');

console.log('\n--- Sort Anchors ---');
resetStorage();
var s1 = Storage.createAnchor('A', '', 10);
Storage.updateAnchor(s1.id, { order: 100 });
var s2 = Storage.createAnchor('B', '', 10);
Storage.updateAnchor(s2.id, { order: 200 });
var s3 = Storage.createAnchor('C', '', 10);
Storage.updateAnchor(s3.id, { order: 300 });
var newest = Storage.getSorted('newest');
assert(newest[0].text === 'C', 'Newest sort: C is first (highest order)');
assert(newest[2].text === 'A', 'Newest sort: A is last (lowest order)');

console.log('\n--- Sort by Usage ---');
resetStorage();
var u1 = Storage.createAnchor('Low use', '', 50);
var u2 = Storage.createAnchor('High use', '', 50);
Storage.toggleAnchor(u1.id);
for (var u = 0; u < 5; u++) { Storage.decrementTurnsForActive(); }
Storage.toggleAnchor(u1.id);
var byUsage = Storage.getSorted('most-used');
assert(byUsage[0].text === 'High use', 'Sort by usage: highest first');
assert(byUsage[0].usageCount === 5, 'Highest has 5 uses');

console.log('\n--- Bulk Toggle ---');
resetStorage();
var b1 = Storage.createAnchor('Bulk 1', '', 10);
var b2 = Storage.createAnchor('Bulk 2', '', 10);
var b3 = Storage.createAnchor('Bulk 3', '', 10);
Storage.bulkToggle([b1.id, b2.id]);
assert(Storage.getAll()[0].active === false, 'Bulk toggle: first inactive');
assert(Storage.getAll()[1].active === false, 'Bulk toggle: second inactive');
assert(Storage.getAll()[2].active === true, 'Bulk toggle: third unchanged');

console.log('\n--- Bulk Delete ---');
resetStorage();
var d1 = Storage.createAnchor('Del 1', '', 10);
var d2 = Storage.createAnchor('Del 2', '', 10);
var d3 = Storage.createAnchor('Del 3', '', 10);
Storage.bulkDelete([d1.id, d2.id]);
assert(Storage.getAll().length === 1, 'Bulk delete: one remaining');
assert(Storage.getAll()[0].text === 'Del 3', 'Bulk delete: correct anchor remains');

console.log('\n--- Bulk Extend ---');
resetStorage();
var e1 = Storage.createAnchor('Ext 1', '', 3);
var e2 = Storage.createAnchor('Ext 2', '', 3);
Storage.decrementTurnsForActive();
Storage.decrementTurnsForActive();
Storage.decrementTurnsForActive();
assert(Storage.getAll()[0].active === false, 'Ext 1 expired');
Storage.bulkExtend([e1.id, e2.id], 10);
assert(Storage.getAll()[0].turnsRemaining === 10, 'Bulk extend: turns restored');
assert(Storage.getAll()[0].active === true, 'Bulk extend: reactivated');

console.log('\n--- Injection Mode ---');
resetStorage();
assert(Storage.getInjectionMode() === 'prepend', 'Default mode is prepend');
Storage.setInjectionMode('append');
assert(Storage.getInjectionMode() === 'append', 'Mode set to append');
Storage.setInjectionMode('prepend');
assert(Storage.getInjectionMode() === 'prepend', 'Mode set back to prepend');

console.log('\n--- Settings Persistence ---');
resetStorage();
Storage.setSetting('injectionMode', 'append');
assert(Storage._getSettings().injectionMode === 'append', 'Settings stored');

console.log('\n--- Usage Heatmap Fresh Anchor ---');
resetStorage();
var fa = Storage.createAnchor('Fresh anchor', '', 10);
var freshMap = Storage.getUsageHeatmap();
var todayKeyNoon = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime();
var freshTotal = 0;
for (var fk in freshMap) { freshTotal += freshMap[fk]; }
assert(freshTotal === 1, 'Fresh unused anchor appears in heatmap');

console.log('\n--- Per-Turn History ---');
resetStorage();
var pt = Storage.createAnchor('History test', '', 10);
assert(Array.isArray(pt.usageHistory), 'usageHistory is array');
assert(pt.usageHistory.length === 0, 'usageHistory starts empty');
for (var pti = 0; pti < 4; pti++) { Storage.decrementTurnsForActive(); }
assert(Storage.getAll()[0].usageHistory.length === 4, '4 timestamps recorded');
assert(Storage.getAll()[0].usageHistory[0] <= Storage.getAll()[0].usageHistory[3], 'Timestamps chronological');

console.log('\n--- Usage Heatmap ---');
resetStorage();
var hm1 = Storage.createAnchor('Heatmap 1', '', 100);
var hm2 = Storage.createAnchor('Heatmap 2', '', 100);
for (var hmi = 0; hmi < 3; hmi++) { Storage.decrementTurnsForActive(); }
Storage.toggleAnchor(hm1.id);
for (hmi = 0; hmi < 2; hmi++) { Storage.decrementTurnsForActive(); }
Storage.toggleAnchor(hm1.id);
for (hmi = 0; hmi < 3; hmi++) { Storage.decrementTurnsForActive(); }
var map = Storage.getUsageHeatmap();
var totalTurns = 0;
for (var key in map) { totalTurns += map[key]; }
assert(totalTurns === 16, 'Total turns in heatmap equals 16 (14 usage + 2 created)');
assert(Object.keys(map).length >= 1, 'At least one date entry');

console.log('\n--- Set TTL ---');
resetStorage();
var ttl1 = Storage.createAnchor('TTL anchor', '', 10);
assert(ttl1.ttlHours === null, 'TTL hours start null');
assert(ttl1.ttlExpiresAt === null, 'TTL expires at starts null');
Storage.setTTL(ttl1.id, 24);
var ttl1Updated = Storage.getAll()[0];
assert(ttl1Updated.ttlHours === 24, 'TTL hours set to 24');
assert(typeof ttl1Updated.ttlExpiresAt === 'number', 'TTL expires at is a number');

console.log('\n--- Extend TTL ---');
var ttlBeforeExtend = Storage.getAll()[0].ttlExpiresAt;
Storage.extendTTL(ttl1.id, 6);
var ttlAfterExtend = Storage.getAll()[0].ttlExpiresAt;
assert(ttlAfterExtend > ttlBeforeExtend, 'TTL extended forward');

console.log('\n--- Reset TTL ---');
var nowBefore = Date.now();
Storage.resetTTL(ttl1.id);
var ttlAfterReset = Storage.getAll()[0].ttlExpiresAt;
assert(ttlAfterReset >= nowBefore + 24 * 3600000, 'TTL reset to now + 24h');

console.log('\n--- Remove TTL ---');
Storage.setTTL(ttl1.id, null);
assert(Storage.getAll()[0].ttlHours === null, 'TTL removed');
assert(Storage.getAll()[0].ttlExpiresAt === null, 'TTL expires cleared');

console.log('\n--- Check Expired TTLs ---');
resetStorage();
var exp = Storage.createAnchor('Will expire', '', 10);
Storage.setTTL(exp.id, 0);
Storage.getAll()[0].ttlExpiresAt = Date.now() - 1000;
assert(Storage.getAll()[0].active === true, 'Still active before check');
Storage.checkExpiredTTLs();
assert(Storage.getAll()[0].active === false, 'Deactivated after TTL expiry check');

console.log('\n--- TTL Reset on Usage ---');
resetStorage();
var use = Storage.createAnchor('TTL usage reset', '', 10);
Storage.setTTL(use.id, 24);
var nowBeforeUse = Date.now();
Storage.decrementTurnsForActive();
var newExpiry = Storage.getAll()[0].ttlExpiresAt;
assert(newExpiry > nowBeforeUse + 23 * 3600000, 'TTL expires at reset on turn consumed');

console.log('\n=== Results ===');
console.log('Passed: ' + passed);
console.log('Failed: ' + failed);
console.log('Total: ' + (passed + failed));

if (failed > 0) {
  process.exit(1);
} else {
  console.log('\nAll tests passed!\n');
}
