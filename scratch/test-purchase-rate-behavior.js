// scratch/test-purchase-rate-behavior.js
global.localStorage = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; },
  clear() { this.store = {}; }
};

import { initializeDatabase, getDatabase, saveDatabase } from '../src/services/storageService.js';
import { PurchasePostingService } from '../src/services/purchasePostingService.js';
import { getProductStockRates, getLatestHistoricalPurchaseRate } from '../src/services/purchaseRateHelper.js';

let failed = 0;
function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    failed++;
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

console.log('=== RUNNING PURCHASE RATE AUTOMATION SUITE ===\n');

initializeDatabase(true);
const db = getDatabase();

const testStoreId = db.stores?.[0]?.id || 'STR-01';
let testSupp = db.suppliers?.[0];
if (!testSupp) {
  testSupp = { id: 'SUPP-TEST', name: 'Test Supplier', stateCode: '27' };
  db.suppliers = [testSupp];
}

// 1. Create 3 new products with costRate: 0 (simulating user creating products in master catalog)
const p1Id = `TEST-P1-${Date.now()}`;
const p2Id = `TEST-P2-${Date.now()}`;
const p3Id = `TEST-P3-${Date.now()}`;

const p1 = {
  id: p1Id,
  name: 'Organic Green Tea 250g',
  sku: 'TEA-250G',
  barcode: '8901234567891',
  costRate: 0,
  mrp: 0,
  sellingRate: 0,
  taxRate: 5,
  uom: 'PCS',
  active: true,
};

const p2 = {
  id: p2Id,
  name: 'Organic Honey 500g',
  sku: 'HNY-500G',
  barcode: '8901234567892',
  costRate: 0,
  mrp: 0,
  sellingRate: 0,
  taxRate: 12,
  uom: 'BTL',
  active: true,
};

const p3 = {
  id: p3Id,
  name: 'Cold Pressed Coconut Oil 1L',
  sku: 'OIL-1L',
  barcode: '8901234567893',
  costRate: 0,
  mrp: 0,
  sellingRate: 0,
  taxRate: 5,
  uom: 'BTL',
  active: true,
};

db.products.push(p1, p2, p3);
saveDatabase(db);

console.log('Step 1: Check initial rates for 3 newly created products');
// 2. Verify historical rate is 0 for newly created products, NOT 100
const p1Rates = getProductStockRates(p1Id, db, testSupp.id);
const p1HistRate = getLatestHistoricalPurchaseRate(p1Id, db, testSupp.id);
assert(p1Rates.length === 0, `p1 should have 0 historical rates, got: ${p1Rates.length}`);
assert(p1HistRate === 0, `p1 historical rate must be 0, got: ${p1HistRate} (must NOT be 100)`);

const p2HistRate = getLatestHistoricalPurchaseRate(p2Id, db, testSupp.id);
assert(p2HistRate === 0, `p2 historical rate must be 0, got: ${p2HistRate} (must NOT be 100)`);

const p3HistRate = getLatestHistoricalPurchaseRate(p3Id, db, testSupp.id);
assert(p3HistRate === 0, `p3 historical rate must be 0, got: ${p3HistRate} (must NOT be 100)`);

console.log('\nStep 2: Check purchase entry line rate behavior before any purchase');
// 3. User takes p1 in purchase entry: purchase rate should be empty or 0, NOT 100
const initialLineRate = p1HistRate > 0 ? p1HistRate : '';
assert(initialLineRate === '', `Purchase line initial rate for newly created product must be empty string, got: "${initialLineRate}"`);

console.log('\nStep 3: User purchases product p1 at ₹275.50');
// 4. User enters purchase cost price: 275.50 for p1, and saves purchase
const purchasePayload = {
  docNumber: `PUR-TEST-${Date.now()}`,
  date: new Date().toISOString().split('T')[0],
  companyId: 'COMP-01',
  storeId: testStoreId,
  supplierId: testSupp.id,
  supplierInvoiceNo: `INV-${Date.now()}`,
  supplierInvoiceDate: new Date().toISOString().split('T')[0],
  supplierInvoiceAmount: '289.28',
  discountType: 'percentage',
  discountValue: 0,
  otherCharges: 0,
  lines: [
    {
      lineId: `PLINE-1-${Date.now()}`,
      productId: p1Id,
      name: p1.name,
      sku: p1.sku,
      uom: p1.uom,
      qty: 1,
      costPrice: 275.50,
      rate: 275.50,
      taxRate: 5,
      mrp: 350.00,
      sellingPrice: 320.00,
    }
  ],
  paymentMode: 'BANK_TRANSFER',
  paymentStatus: 'PAID',
};

const postResult = PurchasePostingService.postPurchase(purchasePayload);
assert(postResult && (postResult.purchase?.id || postResult.id), `Purchase posted successfully with ID: ${postResult.purchase?.id || postResult.id}`);

// Reload db to check persistence
const reloadedDb = getDatabase();
const updatedP1 = reloadedDb.products.find(p => p.id === p1Id);
assert(updatedP1.costRate === 275.50, `Product master costRate should be updated to 275.50, got: ${updatedP1?.costRate}`);

console.log('\nStep 4: User takes product p1 in a second purchase');
// 5. User takes p1 in a second purchase: NOW it should automatically show 275.50!
const p1SecondHistRate = getLatestHistoricalPurchaseRate(p1Id, reloadedDb, testSupp.id);
const p1SecondRates = getProductStockRates(p1Id, reloadedDb, testSupp.id);

assert(p1SecondHistRate === 275.50, `Second purchase of p1 must automatically show 275.50, got: ${p1SecondHistRate}`);
assert(p1SecondRates.length >= 1, `Second purchase should find at least 1 rate entry, got: ${p1SecondRates.length}`);
assert(p1SecondRates[0].rate === 275.50, `Found rate must match 275.50, got: ${p1SecondRates[0].rate}`);

console.log('\nStep 5: Check product p2 (which has still never been purchased)');
// 6. User takes p2 (still never purchased) in purchase entry: must STILL NOT show 100!
const p2CheckRate = getLatestHistoricalPurchaseRate(p2Id, reloadedDb, testSupp.id);
assert(p2CheckRate === 0, `p2 (never purchased) must still have rate 0, got: ${p2CheckRate} (must NOT be 100)`);

console.log(`\n========================================`);
if (failed === 0) {
  console.log('🎉 ALL PURCHASE RATE AUTOMATION TESTS PASSED!');
} else {
  console.error(`💥 ${failed} TESTS FAILED!`);
  process.exit(1);
}
