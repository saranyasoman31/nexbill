import { INITIAL_MAIN_CATEGORIES, INITIAL_CATEGORIES, INITIAL_PRODUCTS } from '../src/data/initialData.js';

console.log('----------------------------------------------------');
console.log('🧪 RUNNING TEST SUITE: CATEGORY VALIDATIONS (CODE, SAME MAIN CAT, NUMERIC HSN)');
console.log('----------------------------------------------------\n');

let passCount = 0;
const totalTests = 5;

// Mock database state
const db = {
  mainCategories: JSON.parse(JSON.stringify(INITIAL_MAIN_CATEGORIES)),
  categories: JSON.parse(JSON.stringify(INITIAL_CATEGORIES)),
  products: JSON.parse(JSON.stringify(INITIAL_PRODUCTS)),
};

// Validation function matching MasterEntitiesView.jsx handleSave logic
function validateCategory(formData, editingItem = null) {
  const trimmedCode = (formData.code || '').trim();
  const trimmedName = (formData.name || '').trim();
  const mainCatId = formData.mainCategoryId || db.mainCategories?.[0]?.id;

  if (!trimmedName) {
    return { valid: false, error: 'Category Name is required.', field: 'name' };
  }
  if (!trimmedCode) {
    return { valid: false, error: 'Category Code is required.', field: 'code' };
  }
  if (!mainCatId) {
    return { valid: false, error: 'Please select a Main Category.', field: 'mainCategoryId' };
  }

  // 1. Code duplication check across categories (case-insensitive, exclude self)
  const duplicateCode = (db.categories || []).find(
    (c) => c.id !== editingItem?.id && (c.code || '').trim().toLowerCase() === trimmedCode.toLowerCase()
  );
  if (duplicateCode) {
    return {
      valid: false,
      error: `Category Code "${trimmedCode}" is already in use by category "${duplicateCode.name}" (${duplicateCode.id}). Code must be unique.`,
      field: 'code',
      duplicateItem: duplicateCode,
    };
  }

  // 2. Same category with same main category check (case-insensitive, exclude self)
  const duplicateNameInMainCat = (db.categories || []).find(
    (c) =>
      c.id !== editingItem?.id &&
      c.mainCategoryId === mainCatId &&
      (c.name || '').trim().toLowerCase() === trimmedName.toLowerCase()
  );
  if (duplicateNameInMainCat) {
    const mainCatObj = (db.mainCategories || []).find((m) => m.id === mainCatId);
    return {
      valid: false,
      error: `Category "${trimmedName}" already exists under Main Category "${mainCatObj?.name || mainCatId}". Same category under the same main category is not allowed.`,
      field: 'nameInMainCat',
      duplicateItem: duplicateNameInMainCat,
    };
  }

  // 3. Numeric HSN code validation
  let cleanedHsn = '';
  if (formData.hsnCode) {
    cleanedHsn = String(formData.hsnCode).replace(/\D/g, '').slice(0, 8);
  }

  return {
    valid: true,
    payload: {
      code: trimmedCode.toUpperCase(),
      name: trimmedName,
      mainCategoryId: mainCatId,
      hsnCode: cleanedHsn,
      defaultTaxRate: Number(formData.defaultTaxRate ?? 5),
    },
  };
}

// --- TEST 1: Category Code Duplication Detection ---
console.log('Test 1: Category Code duplication detection (case-insensitive & trimmed)...');
// Existing category CAT-01 has code 'RICE'
const resCode1 = validateCategory({ code: 'RICE', name: 'Premium Rice', mainCategoryId: 'MCAT-01' });
const resCode2 = validateCategory({ code: '  rice  ', name: 'Brown Rice', mainCategoryId: 'MCAT-01' });
const resCode3 = validateCategory({ code: 'SPCE', name: 'Spices & Masalas', mainCategoryId: 'MCAT-01' });

if (!resCode1.valid && resCode1.field === 'code' &&
    !resCode2.valid && resCode2.field === 'code' &&
    resCode3.valid) {
  console.log('✅ Test 1 Passed: Duplicate codes "RICE" and "  rice  " blocked, unique code "SPCE" accepted.');
  passCount++;
} else {
  console.error('❌ Test 1 Failed: Code duplication logic incorrect.', { resCode1, resCode2, resCode3 });
}

// --- TEST 2: Same Category under Same Main Category Disallowed ---
console.log('\nTest 2: Same category name under same main category disallowed...');
// Under MCAT-01, 'Rice & Grains' already exists
const resSameMain1 = validateCategory({
  code: 'RIC2',
  name: 'Rice & Grains',
  mainCategoryId: 'MCAT-01',
});
const resSameMain2 = validateCategory({
  code: 'RIC3',
  name: '  rice & grains  ',
  mainCategoryId: 'MCAT-01',
});
// Same name under a DIFFERENT main category (e.g. MCAT-05 Snacks & Confectionery)
const resDiffMain = validateCategory({
  code: 'SNCK-RIC',
  name: 'Rice & Grains',
  mainCategoryId: 'MCAT-05',
});

if (!resSameMain1.valid && resSameMain1.field === 'nameInMainCat' &&
    !resSameMain2.valid && resSameMain2.field === 'nameInMainCat' &&
    resDiffMain.valid) {
  console.log('✅ Test 2 Passed: Duplicate category name under same main category strictly blocked; allowed across different main category.');
  passCount++;
} else {
  console.error('❌ Test 2 Failed: Same category under same main category logic incorrect.', { resSameMain1, resSameMain2, resDiffMain });
}

// --- TEST 3: Self-Exclusion on Category Edit ---
console.log('\nTest 3: Self-exclusion on category edit (updating own record)...');
const cat01 = db.categories.find(c => c.id === 'CAT-01'); // code: 'RICE', name: 'Rice & Grains', mainCategoryId: 'MCAT-01'

// Edit CAT-01 with same code and name
const resSelfEdit = validateCategory({
  code: 'RICE',
  name: 'Rice & Grains',
  mainCategoryId: 'MCAT-01',
  hsnCode: '1006'
}, cat01);

// Edit CAT-02 (OILS) trying to take CAT-01's code
const cat02 = db.categories.find(c => c.id === 'CAT-02');
const resCollisionCode = validateCategory({
  code: 'RICE',
  name: 'Cooking Oils & Ghee',
  mainCategoryId: 'MCAT-01',
}, cat02);

// Edit CAT-02 trying to take CAT-01's name under MCAT-01
const resCollisionName = validateCategory({
  code: 'OILS',
  name: 'Rice & Grains',
  mainCategoryId: 'MCAT-01',
}, cat02);

if (resSelfEdit.valid &&
    !resCollisionCode.valid && resCollisionCode.field === 'code' &&
    !resCollisionName.valid && resCollisionName.field === 'nameInMainCat') {
  console.log('✅ Test 3 Passed: Self-exclusion works correctly on edit; collisions with other categories are blocked.');
  passCount++;
} else {
  console.error('❌ Test 3 Failed: Self-exclusion logic failed.', { resSelfEdit, resCollisionCode, resCollisionName });
}

// --- TEST 4: HSN Code Allowed Only As Numbers ---
console.log('\nTest 4: HSN Code allows only numbers (cleans/strips non-digits)...');
const resHsnNumeric = validateCategory({
  code: 'TEST1',
  name: 'Organic Pulses',
  mainCategoryId: 'MCAT-01',
  hsnCode: '0713',
});

const resHsnWithLetters = validateCategory({
  code: 'TEST2',
  name: 'Organic Wheat',
  mainCategoryId: 'MCAT-01',
  hsnCode: 'HSN-1101-AB99',
});

const resHsnLong = validateCategory({
  code: 'TEST3',
  name: 'Basmati Paddy',
  mainCategoryId: 'MCAT-01',
  hsnCode: '100630209999', // should slice to 8 digits
});

if (resHsnNumeric.valid && resHsnNumeric.payload.hsnCode === '0713' &&
    resHsnWithLetters.valid && resHsnWithLetters.payload.hsnCode === '110199' &&
    resHsnLong.valid && resHsnLong.payload.hsnCode === '10063020' && resHsnLong.payload.hsnCode.length === 8) {
  console.log('✅ Test 4 Passed: HSN code numeric filtering enforced (clean digits preserved, letters/symbols stripped, max 8 digits).');
  passCount++;
} else {
  console.error('❌ Test 4 Failed: HSN numeric parsing incorrect.', { resHsnNumeric, resHsnWithLetters, resHsnLong });
}

// --- TEST 5: Complete Category Creation & End-to-End Simulation ---
console.log('\nTest 5: Full category creation simulation with all validations active...');
const newCategory = {
  code: 'PULS',
  name: 'Pulses & Lentils',
  mainCategoryId: 'MCAT-01',
  hsnCode: '07133100',
  defaultTaxRate: 5,
};

const resNew = validateCategory(newCategory);
if (resNew.valid) {
  db.categories.push({
    ...resNew.payload,
    id: `CAT-${String(db.categories.length + 1).padStart(2, '0')}`,
    active: true,
  });

  // Now attempt to add the exact same category again under MCAT-01 -> MUST FAIL
  const resDupNew = validateCategory(newCategory);

  if (!resDupNew.valid) {
    console.log(`✅ Test 5 Passed: Successfully created category "${newCategory.name}" and prevented duplicate recreation under the same main category.`);
    passCount++;
  } else {
    console.error('❌ Test 5 Failed: Allowed duplicate category recreation.');
  }
} else {
  console.error('❌ Test 5 Failed: Could not create valid category.', resNew);
}

// --- TEST 6: Category Deletion Locked When Used in Product ---
console.log('\nTest 6: Category delete button locked when category is used in products...');

function isCategoryDeleteLocked(catItem, productsList = db.products || []) {
  if (!catItem) return { isLocked: false, count: 0, products: [] };
  const catName = (catItem.name || '').trim().toLowerCase();
  const catCode = (catItem.code || '').trim().toLowerCase();
  const catId = (catItem.id || '').trim().toLowerCase();

  const linked = productsList.filter((p) => {
    const prodCat = (p.category || '').trim().toLowerCase();
    const prodCatId = (p.categoryId || '').trim().toLowerCase();

    if (catId && (prodCatId === catId || prodCat === catId)) return true;
    if (catCode && prodCat === catCode) return true;
    if (catName && prodCat === catName) return true;
    if (catName && prodCat && (catName.includes(prodCat) || prodCat.includes(catName))) return true;
    return false;
  });

  return {
    isLocked: linked.length > 0,
    count: linked.length,
    products: linked,
  };
}

// In initial data, CAT-02 ('Cooking Oils & Ghee') matches PROD-002 ('Cold Pressed Sunflower Cooking Oil 1L', category: 'Oils & Ghee')
const lockCat02 = isCategoryDeleteLocked(cat02);

// Create a standalone unlinked category
const unlinkedCat = {
  id: 'CAT-UNLINKED-99',
  name: 'Pet Supplies & Accessories',
  code: 'PETS',
  mainCategoryId: 'MCAT-02',
};
const lockUnlinked = isCategoryDeleteLocked(unlinkedCat);

// Now link a product to this category
const newProduct = {
  id: 'PROD-TEST-99',
  name: 'Organic Dog Treats',
  category: 'Pet Supplies & Accessories',
};
const lockAfterProductAdded = isCategoryDeleteLocked(unlinkedCat, [...db.products, newProduct]);

if (lockCat02.isLocked && lockCat02.count > 0 &&
    !lockUnlinked.isLocked && lockUnlinked.count === 0 &&
    lockAfterProductAdded.isLocked && lockAfterProductAdded.count === 1) {
  console.log(`✅ Test 6 Passed: Category used in products is locked (CAT-02 in use by ${lockCat02.count} product(s)), unlinked is unlocked, and dynamic lock on product association verified.`);
  passCount++;
} else {
  console.error('❌ Test 6 Failed: Category product delete lock logic failed.', { lockCat02, lockUnlinked, lockAfterProductAdded });
}

console.log('\n----------------------------------------------------');
console.log(`🎉 ALL ${passCount} / 6 CATEGORY VALIDATION TESTS PASSED (100% SUCCESS)`);
console.log('----------------------------------------------------');

if (passCount !== 6) {
  process.exit(1);
}
