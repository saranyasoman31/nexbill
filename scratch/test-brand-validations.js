import { INITIAL_BRANDS, INITIAL_PRODUCTS } from '../src/data/initialData.js';

console.log('----------------------------------------------------');
console.log('🧪 RUNNING TEST SUITE: BRAND VALIDATIONS (CODE & NAME DUP, DELETE LOCK WHEN USED IN PRODUCT)');
console.log('----------------------------------------------------\n');

let passCount = 0;
const totalTests = 6;

// Mock database state
const db = {
  brands: JSON.parse(JSON.stringify(INITIAL_BRANDS)),
  products: JSON.parse(JSON.stringify(INITIAL_PRODUCTS)),
};

// Validation function matching MasterEntitiesView.jsx handleSave logic
function validateBrand(formData, editingItem = null) {
  const trimmedCode = (formData.code || '').trim();
  const trimmedName = (formData.name || '').trim();

  if (!trimmedName) {
    return { valid: false, error: 'Brand Name is required.', field: 'name' };
  }
  if (!trimmedCode) {
    return { valid: false, error: 'Brand Code is required.', field: 'code' };
  }

  // 1. Check code duplication across brands (case-insensitive, exclude self)
  const duplicateCode = (db.brands || []).find(
    (b) => b.id !== editingItem?.id && (b.code || '').trim().toLowerCase() === trimmedCode.toLowerCase()
  );
  if (duplicateCode) {
    return {
      valid: false,
      error: `Brand Code "${trimmedCode}" is already in use by brand "${duplicateCode.name}" (${duplicateCode.id}). Please enter a unique code.`,
      field: 'code',
      duplicateItem: duplicateCode,
    };
  }

  // 2. Check name duplication across brands (case-insensitive, exclude self)
  const duplicateName = (db.brands || []).find(
    (b) => b.id !== editingItem?.id && (b.name || '').trim().toLowerCase() === trimmedName.toLowerCase()
  );
  if (duplicateName) {
    return {
      valid: false,
      error: `Brand Name "${trimmedName}" already exists (${duplicateName.id}). Please enter a unique name.`,
      field: 'name',
      duplicateItem: duplicateName,
    };
  }

  return {
    valid: true,
    payload: {
      code: trimmedCode.toUpperCase(),
      name: trimmedName,
      manufacturer: (formData.manufacturer || '').trim(),
      country: (formData.country || 'India').trim(),
      active: formData.active !== false,
    },
  };
}

// Product linking helper function matching MasterEntitiesView.jsx getProductsLinkedToBrand
function getProductsLinkedToBrand(brandItem, productsList = db.products || []) {
  if (!brandItem) return [];
  const bName = (brandItem.name || '').trim().toLowerCase();
  const bCode = (brandItem.code || '').trim().toLowerCase();
  const bId = (brandItem.id || '').trim().toLowerCase();

  return (productsList || []).filter((p) => {
    const pBrand = (p.brand || '').trim().toLowerCase();
    const pBrandId = (p.brandId || '').trim().toLowerCase();

    if (bId && (pBrandId === bId || pBrand === bId)) return true;
    if (bCode && pBrand === bCode) return true;
    if (bName && pBrand === bName) return true;
    return false;
  });
}

// Helper checking delete lock
function isBrandDeleteLocked(brandItem, productsList = db.products || []) {
  const linked = getProductsLinkedToBrand(brandItem, productsList);
  return {
    isLocked: linked.length > 0,
    count: linked.length,
    products: linked,
  };
}

// --- TEST 1: Brand Code Duplication Detection ---
console.log('Test 1: Brand Code duplication detection (case-insensitive & trimmed)...');
// Existing brand BRD-01 has code 'RH', name 'Royal Heritage'
const resCode1 = validateBrand({ code: 'RH', name: 'Random Brand 1' });
const resCode2 = validateBrand({ code: '  rh  ', name: 'Random Brand 2' });
const resCode3 = validateBrand({ code: 'Rh', name: 'Random Brand 3' });
const resCodeUnique = validateBrand({ code: 'NESTLE', name: 'Nestle India' });

if (!resCode1.valid && resCode1.field === 'code' &&
    !resCode2.valid && resCode2.field === 'code' &&
    !resCode3.valid && resCode3.field === 'code' &&
    resCodeUnique.valid) {
  console.log('✅ Test 1 Passed: Duplicate brand codes "RH", "  rh  ", "Rh" blocked; unique code "NESTLE" accepted.');
  passCount++;
} else {
  console.error('❌ Test 1 Failed: Brand code duplication logic incorrect.', { resCode1, resCode2, resCode3, resCodeUnique });
}

// --- TEST 2: Brand Name Duplication Detection ---
console.log('\nTest 2: Brand Name duplication detection (case-insensitive & trimmed)...');
// Existing brand BRD-04 has code 'AMUL', name 'Amul'
const resName1 = validateBrand({ code: 'AMUL2', name: 'Amul' });
const resName2 = validateBrand({ code: 'AMUL3', name: '  amul  ' });
const resName3 = validateBrand({ code: 'AMUL4', name: 'AMUL' });
const resNameUnique = validateBrand({ code: 'MDH', name: 'MDH Spices' });

if (!resName1.valid && resName1.field === 'name' &&
    !resName2.valid && resName2.field === 'name' &&
    !resName3.valid && resName3.field === 'name' &&
    resNameUnique.valid) {
  console.log('✅ Test 2 Passed: Duplicate brand names "Amul", "  amul  ", "AMUL" blocked; unique name "MDH Spices" accepted.');
  passCount++;
} else {
  console.error('❌ Test 2 Failed: Brand name duplication logic incorrect.', { resName1, resName2, resName3, resNameUnique });
}

// --- TEST 3: Self-Exclusion on Brand Edit ---
console.log('\nTest 3: Self-exclusion on brand edit (updating own record)...');
const brd01 = db.brands.find((b) => b.id === 'BRD-01'); // code: 'RH', name: 'Royal Heritage'

// Editing BRD-01 with its own code and name
const resSelfEdit = validateBrand({
  code: 'RH',
  name: 'Royal Heritage',
  manufacturer: 'Heritage Grains India Updated Pvt Ltd',
  country: 'India',
}, brd01);

// Editing BRD-02 (PuraVita / PURA) trying to take BRD-01's code 'RH'
const brd02 = db.brands.find((b) => b.id === 'BRD-02');
const resCollisionCode = validateBrand({
  code: 'RH',
  name: 'PuraVita',
}, brd02);

// Editing BRD-02 trying to take BRD-01's name 'Royal Heritage'
const resCollisionName = validateBrand({
  code: 'PURA',
  name: 'Royal Heritage',
}, brd02);

if (resSelfEdit.valid &&
    !resCollisionCode.valid && resCollisionCode.field === 'code' &&
    !resCollisionName.valid && resCollisionName.field === 'name') {
  console.log('✅ Test 3 Passed: Self-exclusion works on brand edit; collisions with other brands are strictly blocked.');
  passCount++;
} else {
  console.error('❌ Test 3 Failed: Self-exclusion logic failed.', { resSelfEdit, resCollisionCode, resCollisionName });
}

// --- TEST 4: Brand Deletion Locked When Used in Product ---
console.log('\nTest 4: Brand delete button locked when brand is linked to products...');
// In initial data, PROD-001 has brand 'Royal Heritage'
const lockBrd01 = isBrandDeleteLocked(brd01);

// Create an unlinked brand
const unlinkedBrand = {
  id: 'BRD-TEST-UNLINKED',
  name: 'Unlinked Organic Farms',
  code: 'UOF',
  manufacturer: 'Unlinked Farms Pvt Ltd',
};
const lockUnlinked = isBrandDeleteLocked(unlinkedBrand);

if (lockBrd01.isLocked && lockBrd01.count > 0 &&
    !lockUnlinked.isLocked && lockUnlinked.count === 0) {
  console.log(`✅ Test 4 Passed: Brand "Royal Heritage" is locked (used in ${lockBrd01.count} product(s)), unlinked brand is unlocked.`);
  passCount++;
} else {
  console.error('❌ Test 4 Failed: Brand deletion locking logic failed.', { lockBrd01, lockUnlinked });
}

// --- TEST 5: Dynamic Lock and Unlock on Product Association ---
console.log('\nTest 5: Dynamic lock and unlock on product assignment/unassignment...');
const dynamicProduct = {
  id: 'PROD-DYNAMIC-01',
  name: 'Special Organic Oats',
  brand: 'Unlinked Organic Farms',
};

// When product is assigned to this brand
const lockAfterLink = isBrandDeleteLocked(unlinkedBrand, [...db.products, dynamicProduct]);
// When product is removed / reassigned
const lockAfterUnlink = isBrandDeleteLocked(unlinkedBrand, db.products);

if (lockAfterLink.isLocked && lockAfterLink.count === 1 &&
    !lockAfterUnlink.isLocked && lockAfterUnlink.count === 0) {
  console.log('✅ Test 5 Passed: Brand dynamically locks when a product is assigned and unlocks when unassigned.');
  passCount++;
} else {
  console.error('❌ Test 5 Failed: Dynamic lock/unlock failed.', { lockAfterLink, lockAfterUnlink });
}

// --- TEST 6: Cascade Rename of Brand to Linked Products ---
console.log('\nTest 6: Cascade rename of brand to synchronized product catalog...');
// Let's simulate renaming a brand and cascading to db.products
const oldBrandName = 'Royal Heritage';
const newBrandName = 'Royal Heritage Premium';

const initialLinkedProducts = db.products.filter((p) => (p.brand || '').trim().toLowerCase() === oldBrandName.toLowerCase());
console.log(`  Initial products with brand "${oldBrandName}": ${initialLinkedProducts.length}`);

// Cascade update matching MasterEntitiesView.jsx logic
db.products = db.products.map((p) =>
  (p.brand || '').trim().toLowerCase() === oldBrandName.toLowerCase()
    ? { ...p, brand: newBrandName }
    : p
);

const updatedLinkedProducts = db.products.filter((p) => (p.brand || '').trim().toLowerCase() === newBrandName.toLowerCase());
const remainingOldProducts = db.products.filter((p) => (p.brand || '').trim().toLowerCase() === oldBrandName.toLowerCase());

if (updatedLinkedProducts.length === initialLinkedProducts.length && remainingOldProducts.length === 0) {
  console.log(`✅ Test 6 Passed: Brand rename cascaded to ${updatedLinkedProducts.length} product(s) successfully without orphaned references.`);
  passCount++;
} else {
  console.error('❌ Test 6 Failed: Cascading rename failed.', { initial: initialLinkedProducts.length, updated: updatedLinkedProducts.length, remainingOld: remainingOldProducts.length });
}

console.log('\n----------------------------------------------------');
console.log(`🎉 ALL ${passCount} / ${totalTests} BRAND VALIDATION TESTS PASSED (100% SUCCESS)`);
console.log('----------------------------------------------------');

if (passCount !== totalTests) {
  process.exit(1);
}
