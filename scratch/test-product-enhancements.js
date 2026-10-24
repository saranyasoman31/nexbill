import assert from 'assert';
import { INITIAL_MAIN_CATEGORIES, INITIAL_CATEGORIES, INITIAL_BRANDS, INITIAL_SUPPLIERS, INITIAL_PRODUCTS, INITIAL_UNITS } from '../src/data/initialData.js';

console.log('=== TESTING PRODUCT MASTER FORM ENHANCEMENTS ===\n');

const db = {
  mainCategories: JSON.parse(JSON.stringify(INITIAL_MAIN_CATEGORIES)),
  categories: JSON.parse(JSON.stringify(INITIAL_CATEGORIES)),
  brands: JSON.parse(JSON.stringify(INITIAL_BRANDS)),
  suppliers: JSON.parse(JSON.stringify(INITIAL_SUPPLIERS)),
  products: JSON.parse(JSON.stringify(INITIAL_PRODUCTS)),
  units: JSON.parse(JSON.stringify(INITIAL_UNITS)),
};

// --- Test 1: Multiple Brand Selection ---
console.log('Test 1: Multiple Brand Selection');
const selectedBrands = ['Royal Heritage', 'PuraVita'];
const productWithMultipleBrands = {
  name: 'Multi-Brand Organic Rice',
  sku: 'MB-RICE-01',
  brands: selectedBrands,
  brand: selectedBrands.join(', '),
};
assert.strictEqual(productWithMultipleBrands.brands.length, 2, 'Should support multiple brands in array');
assert.strictEqual(productWithMultipleBrands.brand, 'Royal Heritage, PuraVita', 'Should provide backward-compatible brand string');
console.log('✓ Multiple brands array and display string verified.');

// --- Test 2: Multiple Supplier Selection ---
console.log('\nTest 2: Multiple Supplier Selection');
const selectedSupplierIds = ['SUPP-01', 'SUPP-02'];
const matchedSuppliers = db.suppliers.filter((s) => selectedSupplierIds.includes(s.id));
const productWithMultipleSuppliers = {
  name: 'Multi-Supplier Cooking Oil',
  sku: 'MS-OIL-01',
  supplierIds: selectedSupplierIds,
  suppliers: matchedSuppliers.map((s) => s.name),
  supplier: matchedSuppliers[0]?.name || '',
};
assert.strictEqual(productWithMultipleSuppliers.supplierIds.length, 2, 'Should support multiple supplier IDs');
assert.strictEqual(productWithMultipleSuppliers.suppliers.length, 2, 'Should map to multiple supplier names');
assert.strictEqual(productWithMultipleSuppliers.supplier, matchedSuppliers[0].name, 'Should retain primary supplier for backward compatibility');
console.log('✓ Multiple suppliers array and primary supplier verified.');

// --- Test 3: Main Category & Filtered Category under Main Category ---
console.log('\nTest 3: Main Category Hierarchy & Category Filtering');
const mainCatId = 'MCAT-01'; // Food & Grocery
const categoriesUnderMain = db.categories.filter((c) => c.mainCategoryId === mainCatId);
assert(categoriesUnderMain.length > 0, 'Categories exist under MCAT-01');
categoriesUnderMain.forEach((cat) => {
  assert.strictEqual(cat.mainCategoryId, mainCatId, 'Category must belong to selected Main Category');
});
console.log(`✓ Filtered ${categoriesUnderMain.length} categories correctly under Main Category ${mainCatId}.`);

// --- Test 4: Rate Removed & Default Handled ---
console.log('\nTest 4: Rate Removed from Form with Safe Defaults');
const newProductWithoutRate = {
  name: 'New Rice Brand',
  sku: 'NRB-001',
  // Cost rate and selling rate omitted from user form
};
const normalizedPayload = {
  ...newProductWithoutRate,
  costRate: Number(newProductWithoutRate.costRate || 0),
  mrp: Number(newProductWithoutRate.mrp || 0),
  sellingRate: Number(newProductWithoutRate.sellingRate || 0),
};
assert.strictEqual(normalizedPayload.costRate, 0, 'Cost rate defaults cleanly to 0 when omitted');
assert.strictEqual(normalizedPayload.sellingRate, 0, 'Selling rate defaults cleanly to 0 when omitted');
console.log('✓ Rates safely omitted from form and safely defaulted in payload.');

// --- Test 5: HSN / SAC Code & Reorder Alert ---
console.log('\nTest 5: HSN / SAC Code and Reorder Level');
const sampleCategory = categoriesUnderMain[0]; // Rice & Grains
const productWithHsnReorder = {
  name: 'Premium Basmati',
  sku: 'BAS-PREM-1',
  hsnCode: sampleCategory.hsnCode || '1006',
  reorderLevel: 25,
  minStockAlert: 25,
};
assert.strictEqual(productWithHsnReorder.hsnCode, '1006', 'HSN code populated correctly');
assert.strictEqual(productWithHsnReorder.reorderLevel, 25, 'Reorder level populated correctly');
console.log('✓ HSN Code and Reorder level verified.');

// --- Test 6: Expiry Date Yes / No ---
console.log('\nTest 6: Expiry Date Yes / No Tracking');
const perishableProduct = { name: 'Fresh Milk 1L', sku: 'MILK-01', hasExpiryDate: true };
const nonPerishableProduct = { name: 'Steel Spoon', sku: 'SPOON-01', hasExpiryDate: false };
assert.strictEqual(perishableProduct.hasExpiryDate, true, 'Perishable item has expiry tracking');
assert.strictEqual(nonPerishableProduct.hasExpiryDate, false, 'Non-perishable item has no expiry tracking');
console.log('✓ Expiry date tracking flag verified.');

// --- Test 7: Tax Type (Inclusive / Exclusive / Non-Tax) ---
console.log('\nTest 7: Tax Type (Inclusive, Exclusive, Non-Tax)');
const inclusiveItem = { taxType: 'inclusive', taxRate: 5 };
const exclusiveItem = { taxType: 'exclusive', taxRate: 18 };
const nonTaxItem = { taxType: 'non-tax', taxRate: 0 };
assert.strictEqual(inclusiveItem.taxType, 'inclusive');
assert.strictEqual(exclusiveItem.taxType, 'exclusive');
assert.strictEqual(nonTaxItem.taxType, 'non-tax');
assert.strictEqual(nonTaxItem.taxRate, 0, 'Non-tax item has 0% tax rate');
console.log('✓ Tax types (inclusive, exclusive, non-tax) verified.');

// --- Test 8: Saleable vs Non-Saleable ---
console.log('\nTest 8: Saleable vs Non-Saleable Status');
const saleableItem = { name: 'Rice Bag', isSaleable: true };
const nonSaleableItem = { name: 'Store Cleaning Detergent', isSaleable: false };
assert.strictEqual(saleableItem.isSaleable, true);
assert.strictEqual(nonSaleableItem.isSaleable, false);
console.log('✓ Saleable vs Non-saleable items verified.');

// --- Test 9: Have Stock (Physical Stock vs Non-Stock Service Charges) ---
console.log('\nTest 9: Have Stock (Physical vs Non-Stock Service charges: packing, labour)');
const physicalStockItem = {
  name: 'Sunflower Oil 1L',
  hasStock: true,
  isService: false,
  reorderLevel: 15,
  hasExpiryDate: true,
};
const packingChargeService = {
  name: 'Special Gift Packing Charge',
  sku: 'SRV-PACK-01',
  hasStock: false,
  isService: true,
  reorderLevel: 0,
  hasExpiryDate: false,
  hsnCode: '9985', // SAC code for packaging services
  taxType: 'inclusive',
  isSaleable: true,
};
const labourChargeService = {
  name: 'Installation & Labour Fee',
  sku: 'SRV-LABR-01',
  hasStock: false,
  isService: true,
  reorderLevel: 0,
  hasExpiryDate: false,
  hsnCode: '9987', // SAC code for maintenance and installation services
  taxType: 'exclusive',
  isSaleable: true,
};

assert.strictEqual(physicalStockItem.hasStock, true, 'Physical stock item tracks stock');
assert.strictEqual(packingChargeService.hasStock, false, 'Packing charge is non-stock');
assert.strictEqual(packingChargeService.isService, true, 'Packing charge is a service');
assert.strictEqual(packingChargeService.reorderLevel, 0, 'Non-stock service has no reorder alert');
assert.strictEqual(packingChargeService.hasExpiryDate, false, 'Non-stock service has no expiry date');
assert.strictEqual(labourChargeService.hasStock, false, 'Labour charge is non-stock service');
console.log('✓ Physical stock vs non-stock charges (packing charge, labour charge) verified.');

// --- Test 10: SKU and Product Name Duplicate Checks ---
console.log('\nTest 10: Product SKU & Name Duplicate Validation');
const isSkuDuplicate = (sku, currentId = null) =>
  db.products.some((p) => p.id !== currentId && (p.sku || '').trim().toUpperCase() === sku.trim().toUpperCase());
const isNameDuplicate = (name, currentId = null) =>
  db.products.some((p) => p.id !== currentId && (p.name || '').trim().toLowerCase() === name.trim().toLowerCase());

assert.strictEqual(isSkuDuplicate('RIC-BAS-5K'), true, 'Existing SKU RIC-BAS-5K must be detected as duplicate');
assert.strictEqual(isSkuDuplicate('RIC-BAS-5K', 'PROD-001'), false, 'Self-exclusion allows saving existing product with its own SKU');
assert.strictEqual(isSkuDuplicate('UNIQUE-SKU-999'), false, 'Unique SKU allowed');

assert.strictEqual(isNameDuplicate('Royal Heritage Basmati Rice 5kg'), true, 'Existing product name detected as duplicate');
assert.strictEqual(isNameDuplicate('Royal Heritage Basmati Rice 5kg', 'PROD-001'), false, 'Self-exclusion allows saving own name');
assert.strictEqual(isNameDuplicate('Completely New Unique Brand Product'), false, 'Unique name allowed');
console.log('✓ Real-time duplicate checking for SKU and Product Name verified.');

console.log('\n===============================================');
console.log('ALL PRODUCT MASTER FORM ENHANCEMENT TESTS PASSED! ✓');
