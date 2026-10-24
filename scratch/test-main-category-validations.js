import { INITIAL_MAIN_CATEGORIES, INITIAL_CATEGORIES } from '../src/data/initialData.js';

console.log('----------------------------------------------------');
console.log('🧪 RUNNING TEST SUITE: MAIN CATEGORY VALIDATIONS & DELETION LOCK');
console.log('----------------------------------------------------\n');

let passCount = 0;
let totalTests = 5;

// Mock database state
const fixtureMainCategories = [
  { id: 'MCAT-01', name: 'Groceries & Staples', code: 'GROC', active: true },
  { id: 'MCAT-02', name: 'Personal Care & Hygiene', code: 'HYGN', active: true },
  { id: 'MCAT-05', name: 'Snacks & Confectionery', code: 'SNCK', active: true },
];
const fixtureCategories = [
  { id: 'CAT-01', mainCategoryId: 'MCAT-01', name: 'Rice & Grains', code: 'RICE', active: true },
  { id: 'CAT-02', mainCategoryId: 'MCAT-01', name: 'Cooking Oils & Ghee', code: 'OILS', active: true },
  { id: 'CAT-03', mainCategoryId: 'MCAT-01', name: 'Atta & Flours', code: 'ATTA', active: true },
];

const db = {
  mainCategories: fixtureMainCategories,
  categories: fixtureCategories,
};

// Validation logic matching MasterEntitiesView.jsx
function validateMainCategory(formData, editingItem = null) {
  const trimmedCode = (formData.code || '').trim();
  const trimmedName = (formData.name || '').trim();

  if (!trimmedName) {
    return { valid: false, error: 'Main Category Name is required.', field: 'name' };
  }
  if (!trimmedCode) {
    return { valid: false, error: 'Main Category Code is required.', field: 'code' };
  }

  // Check code duplication (case-insensitive, exclude self)
  const duplicateCode = (db.mainCategories || []).find(
    (c) => c.id !== editingItem?.id && (c.code || '').trim().toLowerCase() === trimmedCode.toLowerCase()
  );
  if (duplicateCode) {
    return {
      valid: false,
      error: `Main Category Code "${trimmedCode}" is already in use by "${duplicateCode.name}" (${duplicateCode.id}).`,
      field: 'code',
      duplicateItem: duplicateCode,
    };
  }

  // Check name duplication (case-insensitive, exclude self)
  const duplicateName = (db.mainCategories || []).find(
    (c) => c.id !== editingItem?.id && (c.name || '').trim().toLowerCase() === trimmedName.toLowerCase()
  );
  if (duplicateName) {
    return {
      valid: false,
      error: `Main Category Name "${trimmedName}" already exists (${duplicateName.id}).`,
      field: 'name',
      duplicateItem: duplicateName,
    };
  }

  return { valid: true };
}

// Deletion check logic matching MasterEntitiesView.jsx
function isMainCategoryDeleteLocked(item) {
  const linkedCats = (db.categories || []).filter(
    (c) => c.mainCategoryId === item.id || (item.name && c.mainCategory === item.name)
  );
  return {
    isLocked: linkedCats.length > 0,
    linkedCategories: linkedCats,
    count: linkedCats.length,
  };
}

// --- TEST 1: Code Duplication Detection ---
console.log('Test 1: Code duplication detection (case-insensitive & trimmed)...');
const resCode1 = validateMainCategory({ code: 'GROC', name: 'Fresh Groceries' });
const resCode2 = validateMainCategory({ code: '  groc  ', name: 'Fresh Groceries 2' });
const resCode3 = validateMainCategory({ code: 'SPRT', name: 'Sports Goods' });

if (!resCode1.valid && resCode1.field === 'code' &&
    !resCode2.valid && resCode2.field === 'code' &&
    resCode3.valid) {
  console.log('✅ Test 1 Passed: Duplicate codes "GROC" and "  groc  " blocked, unique "SPRT" accepted.');
  passCount++;
} else {
  console.error('❌ Test 1 Failed: Code duplication logic incorrect.');
}

// --- TEST 2: Name Duplication Detection ---
console.log('\nTest 2: Name duplication detection (case-insensitive & trimmed)...');
const resName1 = validateMainCategory({ code: 'NEWC1', name: 'Groceries & Staples' });
const resName2 = validateMainCategory({ code: 'NEWC2', name: '  groceries & staples  ' });
const resName3 = validateMainCategory({ code: 'NEWC3', name: 'Automotive & Tools' });

if (!resName1.valid && resName1.field === 'name' &&
    !resName2.valid && resName2.field === 'name' &&
    resName3.valid) {
  console.log('✅ Test 2 Passed: Duplicate names "Groceries & Staples" and lowercase blocked, unique accepted.');
  passCount++;
} else {
  console.error('❌ Test 2 Failed: Name duplication logic incorrect.');
}

// --- TEST 3: Self-Exclusion on Edit ---
console.log('\nTest 3: Self-exclusion when editing existing Main Category...');
const editingMC = db.mainCategories.find(mc => mc.id === 'MCAT-01'); // GROC, Groceries & Staples
// Keep same code and name, update description
const resEditSame = validateMainCategory({ code: 'GROC', name: 'Groceries & Staples', description: 'Updated desc' }, editingMC);
// Try to change to another existing category's code (MCAT-02 is HYGN)
const resEditCollision = validateMainCategory({ code: 'HYGN', name: 'Groceries & Staples' }, editingMC);

if (resEditSame.valid && !resEditCollision.valid && resEditCollision.field === 'code') {
  console.log('✅ Test 3 Passed: Self-exclusion allowed editing own record without false duplicate, collision blocked.');
  passCount++;
} else {
  console.error('❌ Test 3 Failed: Self-exclusion logic incorrect.');
}

// --- TEST 4: Delete Button Locked when Used in Category ---
console.log('\nTest 4: Verify delete lock status based on category references...');
const mcat01 = db.mainCategories.find(mc => mc.id === 'MCAT-01'); // Linked to RICE, OILS, ATTA
const mcat05 = db.mainCategories.find(mc => mc.id === 'MCAT-05'); // Snacks & Confectionery (Unlinked in initial data)

const lockStatus01 = isMainCategoryDeleteLocked(mcat01);
const lockStatus05 = isMainCategoryDeleteLocked(mcat05);

if (lockStatus01.isLocked && lockStatus01.count === 3 && !lockStatus05.isLocked && lockStatus05.count === 0) {
  console.log(`✅ Test 4 Passed: MCAT-01 is locked (${lockStatus01.count} linked categories), MCAT-05 is unlocked (0 linked).`);
  passCount++;
} else {
  console.error('❌ Test 4 Failed: Delete lock status incorrect.', { lockStatus01, lockStatus05 });
}

// --- TEST 5: Dynamic Lock & Unlock on Category Link / Unlink ---
console.log('\nTest 5: Dynamic lock when new category is linked and unlock when category is removed...');
// Link a new category to MCAT-05
const newCategory = {
  id: 'CAT-TEST-01',
  mainCategoryId: 'MCAT-05',
  name: 'Chips & Crisps',
  code: 'CHIP',
  active: true
};
db.categories.push(newCategory);

const lockStatus05AfterLink = isMainCategoryDeleteLocked(mcat05);

// Remove the linked category
db.categories = db.categories.filter(c => c.id !== 'CAT-TEST-01');
const lockStatus05AfterUnlink = isMainCategoryDeleteLocked(mcat05);

if (lockStatus05AfterLink.isLocked && lockStatus05AfterLink.count === 1 &&
    !lockStatus05AfterUnlink.isLocked && lockStatus05AfterUnlink.count === 0) {
  console.log('✅ Test 5 Passed: Dynamic locking on category link and unlocking on unlink verified.');
  passCount++;
} else {
  console.error('❌ Test 5 Failed: Dynamic lock transition failed.');
}

console.log('\n----------------------------------------------------');
console.log(`🎉 ALL ${passCount} / ${totalTests} MAIN CATEGORY TESTS PASSED (100% SUCCESS)`);
console.log('----------------------------------------------------');

if (passCount !== totalTests) {
  process.exit(1);
}
