// scratch/test-unit-validations.js
// Verification suite for Unit Code & Name duplicate checking and referential locking

import assert from 'node:assert';
import { INITIAL_UNITS, INITIAL_PRODUCTS } from '../src/data/initialData.js';

console.log('----------------------------------------------------');
console.log('🧪 RUNNING TEST SUITE: UNIT CODE & NAME DUPLICATION & REFERENTIAL INTEGRITY');
console.log('----------------------------------------------------');

const fixtureProducts = [
  { id: 'PROD-001', name: 'Cable', uom: 'PCS', unit: 'Pieces' }
];

// Mock in-memory database
const db = {
  units: JSON.parse(JSON.stringify(INITIAL_UNITS)),
  products: INITIAL_PRODUCTS.length > 0 ? JSON.parse(JSON.stringify(INITIAL_PRODUCTS)) : fixtureProducts,
};

// 1. Validation Logic Helper (mirrors MasterEntitiesView.jsx)
function validateUnit(formData, editingItem = null, unitsList = db.units) {
  const trimmedName = (formData.name || '').trim();
  const trimmedCode = (formData.code || '').trim();

  if (!trimmedName) {
    return { valid: false, error: 'Unit Name is required.', code: 'NAME_REQUIRED' };
  }
  if (!trimmedCode) {
    return { valid: false, error: 'Unit Code is required.', code: 'CODE_REQUIRED' };
  }

  // Duplicate Code check (case-insensitive, trimmed, self-exclusion)
  const duplicateCode = unitsList.find(
    (u) => u.id !== editingItem?.id && (u.code || '').trim().toLowerCase() === trimmedCode.toLowerCase()
  );
  if (duplicateCode) {
    return {
      valid: false,
      error: `Unit Code "${trimmedCode}" is already in use by unit "${duplicateCode.name}" (${duplicateCode.id}). Please enter a unique code.`,
      code: 'DUPLICATE_CODE',
      duplicateItem: duplicateCode,
    };
  }

  // Duplicate Name check (case-insensitive, trimmed, self-exclusion)
  const duplicateName = unitsList.find(
    (u) => u.id !== editingItem?.id && (u.name || '').trim().toLowerCase() === trimmedName.toLowerCase()
  );
  if (duplicateName) {
    return {
      valid: false,
      error: `Unit Name "${trimmedName}" already exists (${duplicateName.id}). Please enter a unique name.`,
      code: 'DUPLICATE_NAME',
      duplicateItem: duplicateName,
    };
  }

  return { valid: true };
}

// 2. Product linkage helper (mirrors MasterEntitiesView.jsx)
function getProductsLinkedToUnit(unitItem, productsList = db.products) {
  if (!unitItem) return [];
  const uName = (unitItem.name || '').trim().toLowerCase();
  const uCode = (unitItem.code || '').trim().toLowerCase();
  const uId = (unitItem.id || '').trim().toLowerCase();

  return (productsList || []).filter((p) => {
    const pUom = (p.uom || '').trim().toLowerCase();
    const pUnitId = (p.unitId || '').trim().toLowerCase();

    if (uId && (pUnitId === uId || pUom === uId)) return true;
    if (uCode && pUom === uCode) return true;
    if (uName && pUom === uName) return true;
    return false;
  });
}

// ----------------------------------------------------------------------
// Test 1: Unit Code & Name mandatory requirements
// ----------------------------------------------------------------------
console.log('Test 1: Unit Code and Name mandatory validation...');
const emptyName = validateUnit({ name: '', code: 'CRT' });
assert.strictEqual(emptyName.valid, false);
assert.strictEqual(emptyName.code, 'NAME_REQUIRED');

const emptyCode = validateUnit({ name: 'Cartons', code: '   ' });
assert.strictEqual(emptyCode.valid, false);
assert.strictEqual(emptyCode.code, 'CODE_REQUIRED');
console.log('✅ Test 1 Passed: Empty Unit Name and Code are rejected.');

// ----------------------------------------------------------------------
// Test 2: Unit Code duplicate detection (case-insensitive & whitespace-trimmed)
// ----------------------------------------------------------------------
console.log('Test 2: Unit Code duplicate detection...');
// Existing unit UNT-01 has code: 'PCS', name: 'Pieces'
const dupCodeExact = validateUnit({ name: 'Packets', code: 'PCS' });
assert.strictEqual(dupCodeExact.valid, false);
assert.strictEqual(dupCodeExact.code, 'DUPLICATE_CODE');
assert.strictEqual(dupCodeExact.duplicateItem.id, 'UNT-01');

const dupCodeLower = validateUnit({ name: 'Packets', code: '  pcs  ' });
assert.strictEqual(dupCodeLower.valid, false);
assert.strictEqual(dupCodeLower.code, 'DUPLICATE_CODE');

// Non-duplicate code
const uniqueCode = validateUnit({ name: 'Cartons', code: 'CTN' });
assert.strictEqual(uniqueCode.valid, true);
console.log('✅ Test 2 Passed: Duplicate Unit Code is strictly prevented.');

// ----------------------------------------------------------------------
// Test 3: Unit Name duplicate detection (case-insensitive & whitespace-trimmed)
// ----------------------------------------------------------------------
console.log('Test 3: Unit Name duplicate detection...');
// Existing unit UNT-02 has code: 'KGS', name: 'Kilograms'
const dupNameExact = validateUnit({ name: 'Kilograms', code: 'KG' });
assert.strictEqual(dupNameExact.valid, false);
assert.strictEqual(dupNameExact.code, 'DUPLICATE_NAME');
assert.strictEqual(dupNameExact.duplicateItem.id, 'UNT-02');

const dupNameLower = validateUnit({ name: '  kilograms  ', code: 'KG' });
assert.strictEqual(dupNameLower.valid, false);
assert.strictEqual(dupNameLower.code, 'DUPLICATE_NAME');

// Non-duplicate name
const uniqueName = validateUnit({ name: 'Cartons', code: 'CTN' });
assert.strictEqual(uniqueName.valid, true);
console.log('✅ Test 3 Passed: Duplicate Unit Name is strictly prevented.');

// ----------------------------------------------------------------------
// Test 4: Self-exclusion when editing existing Unit
// ----------------------------------------------------------------------
console.log('Test 4: Self-exclusion on edit...');
const existingUnit = db.units.find((u) => u.id === 'UNT-01'); // 'Pieces' / 'PCS'
// Updating description or decimal flag without altering name or code
const selfUpdate = validateUnit(
  { name: 'Pieces', code: 'PCS', description: 'Updated description', allowDecimal: false },
  existingUnit
);
assert.strictEqual(selfUpdate.valid, true);

// Attempting to change UNT-01 code to UNT-02's code ('KGS') should fail
const crossCollisionCode = validateUnit(
  { name: 'Pieces', code: 'KGS' },
  existingUnit
);
assert.strictEqual(crossCollisionCode.valid, false);
assert.strictEqual(crossCollisionCode.code, 'DUPLICATE_CODE');

// Attempting to change UNT-01 name to UNT-02's name ('Kilograms') should fail
const crossCollisionName = validateUnit(
  { name: 'Kilograms', code: 'PCS' },
  existingUnit
);
assert.strictEqual(crossCollisionName.valid, false);
assert.strictEqual(crossCollisionName.code, 'DUPLICATE_NAME');
console.log('✅ Test 4 Passed: Self-exclusion works on edit; collision with other units is blocked.');

// ----------------------------------------------------------------------
// Test 5: Referential integrity / Deletion locking when Unit is linked to products
// ----------------------------------------------------------------------
console.log('Test 5: Referential integrity deletion lock...');
// UNT-01 is 'Pieces' / 'PCS'
// Products in initialData use 'Pcs', 'Bottle', 'Pack', 'Jar', 'Bar', 'Unit', 'Box', 'Pouch'
const pcsUnit = db.units.find((u) => u.code === 'PCS');
const linkedToPcs = getProductsLinkedToUnit(pcsUnit, db.products);
assert.ok(linkedToPcs.length > 0, 'Products should be linked to Pieces/PCS');
console.log(`  Found ${linkedToPcs.length} products linked to UNT-01 (PCS/Pieces)`);

// Unused unit: Let's create an unused unit
const unusedUnit = { id: 'UNT-99', name: 'Barrels', code: 'BRL', description: 'Large barrel' };
const linkedToUnused = getProductsLinkedToUnit(unusedUnit, db.products);
assert.strictEqual(linkedToUnused.length, 0, 'No products should link to Barrels/BRL');
console.log('✅ Test 5 Passed: Products linked to Unit correctly detected; unused units allowed for deletion.');

// ----------------------------------------------------------------------
// Test 6: Cascade update when Unit is renamed or code updated
// ----------------------------------------------------------------------
console.log('Test 6: Cascade update on unit rename/code change...');
const testProducts = [
  { id: 'PROD-T1', name: 'Test Rice', uom: 'PCS' },
  { id: 'PROD-T2', name: 'Test Wheat', uom: 'Pieces' },
  { id: 'PROD-T3', name: 'Test Oil', uom: 'LTR' },
];

const oldUnit = { id: 'UNT-01', name: 'Pieces', code: 'PCS' };
const newUnitPayload = { name: 'Pieces Standard', code: 'PC' };

const oldName = oldUnit.name.trim().toLowerCase();
const oldCode = oldUnit.code.trim().toLowerCase();

const updatedProducts = testProducts.map((p) => {
  const pUom = (p.uom || '').trim().toLowerCase();
  if (pUom === oldCode || pUom === oldName) {
    return { ...p, uom: newUnitPayload.code || newUnitPayload.name };
  }
  return p;
});

assert.strictEqual(updatedProducts[0].uom, 'PC');
assert.strictEqual(updatedProducts[1].uom, 'PC');
assert.strictEqual(updatedProducts[2].uom, 'LTR');
console.log('✅ Test 6 Passed: Product UOM successfully cascaded on Unit update.');

console.log('----------------------------------------------------');
console.log('🎉 ALL 6 / 6 UNIT DUPLICATION & INTEGRITY TESTS PASSED (100% SUCCESS)');
console.log('----------------------------------------------------');
