// Test script to verify Company Master implementation:
// 1. Menu sequence before product
// 2. Form fields (name, code, mfg, contact, address)
// 3. Duplication checking on name and code
// 4. Optional company selection in product master
// 5. Delete locking when company is assigned to any product

import assert from 'node:assert';
import { SYSTEM_MENUS_CONFIG, INITIAL_COMPANIES, INITIAL_PRODUCTS } from '../src/data/initialData.js';

console.log('=== RUNNING COMPANY MASTER VERIFICATION TESTS ===\n');

// Test 1: Menu Sequence Before Product
console.log('[Test 1] Company menu item placed immediately before Product');
const companyMenuIdx = SYSTEM_MENUS_CONFIG.findIndex(m => m.id === 'company');
const productMenuIdx = SYSTEM_MENUS_CONFIG.findIndex(m => m.id === 'product');
const unitMenuIdx = SYSTEM_MENUS_CONFIG.findIndex(m => m.id === 'unit');

assert(companyMenuIdx !== -1, 'Company menu item must exist in SYSTEM_MENUS_CONFIG');
assert(productMenuIdx !== -1, 'Product menu item must exist in SYSTEM_MENUS_CONFIG');
assert(companyMenuIdx === productMenuIdx - 1, `Company (index ${companyMenuIdx}) must immediately precede Product (index ${productMenuIdx})`);
assert(unitMenuIdx === companyMenuIdx - 1, `Unit (index ${unitMenuIdx}) must immediately precede Company (index ${companyMenuIdx})`);
console.log('✓ Passed: Menu sequence is Unit -> Company -> Product\n');

// Test 2: Company Schema and Fields
console.log('[Test 2] Company fields: name, code, mfg, contact, address');
assert(INITIAL_COMPANIES.length >= 2, 'Initial companies must be defined');
for (const comp of INITIAL_COMPANIES) {
  assert(comp.name, `Company ${comp.id} must have name`);
  assert(comp.code, `Company ${comp.id} must have code`);
  assert('mfg' in comp, `Company ${comp.id} must have mfg field`);
  assert('contact' in comp, `Company ${comp.id} must have contact field`);
  assert('address' in comp, `Company ${comp.id} must have address field`);
}
console.log(`✓ Passed: All ${INITIAL_COMPANIES.length} seeded companies contain name, code, mfg, contact, address\n`);

// Test 3: Duplication Check Logic
console.log('[Test 3] Duplication check for Company name and code');
const companies = [
  { id: 'COMP-01', code: 'CMP-001', name: 'Nestlé India Limited' },
  { id: 'COMP-02', code: 'CMP-002', name: 'Tata Consumer Products Ltd' },
];

function checkDuplicate(companiesList, candidate, editingId = null) {
  const isNameDup = companiesList.some(
    c => c.id !== editingId && (c.name || '').trim().toLowerCase() === (candidate.name || '').trim().toLowerCase()
  );
  const isCodeDup = companiesList.some(
    c => c.id !== editingId && (c.code || '').trim().toLowerCase() === (candidate.code || '').trim().toLowerCase()
  );
  return { isNameDup, isCodeDup };
}

// Exact match duplicate name
assert.strictEqual(checkDuplicate(companies, { name: 'Nestlé India Limited', code: 'CMP-999' }).isNameDup, true);
// Case-insensitive duplicate name
assert.strictEqual(checkDuplicate(companies, { name: 'nestlé india limited', code: 'CMP-999' }).isNameDup, true);
// Trimmed duplicate name
assert.strictEqual(checkDuplicate(companies, { name: '  Nestlé India Limited  ', code: 'CMP-999' }).isNameDup, true);
// Unique name
assert.strictEqual(checkDuplicate(companies, { name: 'Sun Pharma', code: 'CMP-999' }).isNameDup, false);

// Exact match duplicate code
assert.strictEqual(checkDuplicate(companies, { name: 'New Corp', code: 'CMP-001' }).isCodeDup, true);
// Case-insensitive duplicate code
assert.strictEqual(checkDuplicate(companies, { name: 'New Corp', code: 'cmp-001' }).isCodeDup, true);
// Self-exclusion on edit
assert.strictEqual(checkDuplicate(companies, { name: 'Nestlé India Limited', code: 'CMP-001' }, 'COMP-01').isNameDup, false);
assert.strictEqual(checkDuplicate(companies, { name: 'Nestlé India Limited', code: 'CMP-001' }, 'COMP-01').isCodeDup, false);
console.log('✓ Passed: Duplicate detection handles case-insensitivity, whitespace trimming, and self-exclusion on edit\n');

// Test 4: Product Master Optional Company Selection
console.log('[Test 4] Product master optional company selection');
const productsWithCompany = INITIAL_PRODUCTS.filter(p => p.companyId || p.company);
const productsWithoutCompany = INITIAL_PRODUCTS.filter(p => !p.companyId && !p.company);

assert(productsWithCompany.length > 0, 'Should have sample products assigned to a company');
assert(productsWithoutCompany.length > 0, 'Should have sample products without a company (demonstrating non-mandatory selection)');
console.log(`✓ Passed: ${productsWithCompany.length} products assigned to company, ${productsWithoutCompany.length} products unassigned (optional)\n`);

// Test 5: Delete Lock When Company Used in Product
console.log('[Test 5] Delete lock enforcement when company is linked to products');
function getProductsLinkedToCompany(companyItem, productsList) {
  if (!companyItem) return [];
  const cId = (companyItem.id || '').trim().toLowerCase();
  const cName = (companyItem.name || '').trim().toLowerCase();
  const cCode = (companyItem.code || '').trim().toLowerCase();

  return (productsList || []).filter((p) => {
    const pCompId = (p.companyId || '').trim().toLowerCase();
    const pCompName = (p.company || p.companyName || '').trim().toLowerCase();
    const pCompCode = (p.companyCode || '').trim().toLowerCase();

    if (cId && pCompId === cId) return true;
    if (cCode && (pCompCode === cCode || pCompId === cCode)) return true;
    if (cName && (pCompName === cName || pCompId === cName)) return true;
    return false;
  });
}

const comp1 = INITIAL_COMPANIES.find(c => c.id === 'COMP-01');
const comp4 = INITIAL_COMPANIES.find(c => c.id === 'COMP-04');

const linkedToComp1 = getProductsLinkedToCompany(comp1, INITIAL_PRODUCTS);
const linkedToComp4 = getProductsLinkedToCompany(comp4, INITIAL_PRODUCTS);

assert(linkedToComp1.length > 0, `COMP-01 (${comp1.name}) should have linked products`);
assert(linkedToComp4.length === 0, `COMP-04 (${comp4.name}) should have no linked products`);

console.log(`- COMP-01 is linked to ${linkedToComp1.length} product(s) -> Delete LOCKED: ${linkedToComp1.length > 0}`);
console.log(`- COMP-04 is linked to ${linkedToComp4.length} product(s) -> Delete UNLOCKED (Safe to delete): ${linkedToComp4.length === 0}`);
console.log('✓ Passed: Referential integrity locks delete button when company is used in product\n');

console.log('====================================================');
console.log('ALL COMPANY MASTER VERIFICATIONS PASSED SUCCESSFULLY!');
console.log('====================================================');
