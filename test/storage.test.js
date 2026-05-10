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

console.log('\n=== Results ===');
console.log('Passed: ' + passed);
console.log('Failed: ' + failed);
console.log('Total: ' + (passed + failed));

if (failed > 0) {
  process.exit(1);
} else {
  console.log('\nAll tests passed!\n');
}
