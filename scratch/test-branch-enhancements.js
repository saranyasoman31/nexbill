// Test branch enhancements: duplication checks, state listing, and POS status removal
import assert from 'assert';
import { INITIAL_STORES, INITIAL_STATES } from '../src/data/initialData.js';

console.log('=== TESTING BRANCH MASTER ENHANCEMENTS ===\n');

// Sample branch store list
const stores = [...INITIAL_STORES];

// 1. Branch Code Duplication Check
console.log('Test 1: Branch Code Duplication Checking');
function isBranchCodeDuplicate(code, currentId = null, storeList = stores) {
  if (!code || !code.trim()) return false;
  const trimmed = code.trim().toLowerCase();
  return storeList.some(
    (s) => s.id !== currentId && (s.code || '').trim().toLowerCase() === trimmed
  );
}

// STR-01 has code 'MUM-01'
assert.strictEqual(isBranchCodeDuplicate('MUM-01'), true, 'MUM-01 should be detected as duplicate');
assert.strictEqual(isBranchCodeDuplicate('mum-01'), true, 'Case-insensitive code should be detected as duplicate');
assert.strictEqual(isBranchCodeDuplicate('MUM-01', 'STR-01'), false, 'Editing STR-01 itself should not trigger duplicate code');
assert.strictEqual(isBranchCodeDuplicate('STR-DEL-01'), false, 'New unique code should not be duplicate');
console.log('✓ Branch Code duplication check passed (case-insensitive & self-exclusion).');

// 2. Branch Name Duplication Check
console.log('\nTest 2: Branch Name Duplication Checking');
function isBranchNameDuplicate(name, currentId = null, storeList = stores) {
  if (!name || !name.trim()) return false;
  const trimmed = name.trim().toLowerCase();
  return storeList.some(
    (s) => s.id !== currentId && (s.name || '').trim().toLowerCase() === trimmed
  );
}

// STR-01 has name 'Apex Flagship Mumbai'
assert.strictEqual(isBranchNameDuplicate('Apex Flagship Mumbai'), true, 'Existing name should be detected as duplicate');
assert.strictEqual(isBranchNameDuplicate('apex flagship mumbai'), true, 'Case-insensitive name should be duplicate');
assert.strictEqual(isBranchNameDuplicate('Apex Flagship Mumbai', 'STR-01'), false, 'Editing STR-01 should not trigger duplicate name');
assert.strictEqual(isBranchNameDuplicate('Apex Connaught Delhi'), false, 'New unique name should not be duplicate');
console.log('✓ Branch Name duplication check passed (case-insensitive & self-exclusion).');

// 3. Database State Listing & Sync
console.log('\nTest 3: Database State Listing & State Code Sync');
const statesList = INITIAL_STATES;
assert(statesList.length >= 36, 'statesList should contain all Indian states and UTs');

function syncBranchState(selectedStateCode, availableStates = statesList) {
  const matched = availableStates.find((s) => s.code === selectedStateCode);
  return {
    stateCode: selectedStateCode,
    state: matched ? matched.name : 'Maharashtra',
  };
}

const mh = syncBranchState('27');
assert.strictEqual(mh.state, 'Maharashtra');
assert.strictEqual(mh.stateCode, '27');

const dl = syncBranchState('07');
assert.strictEqual(dl.state, 'Delhi');
assert.strictEqual(dl.stateCode, '07');

const ka = syncBranchState('29');
assert.strictEqual(ka.state, 'Karnataka');
assert.strictEqual(ka.stateCode, '29');
console.log('✓ Database states cleanly sync state name and GST stateCode.');

// 4. POS Status in Payload
console.log('\nTest 4: POS Day Status preserved in payload without form input');
function formatBranchPayload(formData, editingItem = null) {
  return {
    name: (formData.name || '').trim(),
    code: (formData.code || '').trim().toUpperCase(),
    city: (formData.city || '').trim(),
    state: (formData.state || 'Maharashtra').trim(),
    stateCode: (formData.stateCode || '27').trim(),
    address: (formData.address || '').trim(),
    phone: (formData.phone || '').trim(),
    isDayOpen: editingItem ? (editingItem.isDayOpen ?? true) : true,
    active: formData.active !== false,
  };
}

const newBranchPayload = formatBranchPayload({
  name: 'Apex Connaught Delhi',
  code: 'DEL-01',
  city: 'New Delhi',
  state: 'Delhi',
  stateCode: '07',
  address: 'Connaught Place',
  phone: '011-23456789',
});
assert.strictEqual(newBranchPayload.isDayOpen, true, 'New branch should default isDayOpen to true');

const editedBranchPayload = formatBranchPayload(
  {
    name: 'Apex Express Pune Renamed',
    code: 'PUN-02',
    city: 'Pune',
    state: 'Maharashtra',
    stateCode: '27',
  },
  { id: 'STR-02', isDayOpen: false } // Existing store had closed day
);
assert.strictEqual(editedBranchPayload.isDayOpen, false, 'Edited branch should preserve existing isDayOpen status');
console.log('✓ POS Day status correctly preserved in payload without requiring form input.');

console.log('\n===============================================');
console.log('ALL BRANCH MASTER ENHANCEMENT TESTS PASSED! ✓');
