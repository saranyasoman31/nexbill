global.localStorage = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; },
  clear() { this.store = {}; }
};

import assert from 'assert';
import { initializeDatabase, getDatabase, saveDatabase } from '../src/services/storageService.js';
import { calculatePurchaseLine, getLatestHistoricalPurchaseRate } from '../src/services/purchaseRateHelper.js';
import { PurchasePostingService } from '../src/services/PurchasePostingService.js';

console.log('--- RUNNING PURCHASE TAX TYPES & CALCULATIONS VERIFICATION ---');

// TEST 1: Inclusive Tax calculation
{
  const lineInclusive = {
    qty: 1,
    costPrice: 100,
    rate: 100,
    discountPercent: 0,
    discountAmount: 0,
    taxRate: 18,
    taxType: 'inclusive',
    isTaxInclusive: true,
  };

  const calculated = calculatePurchaseLine(lineInclusive, 'LOCAL');
  console.log('Test 1 (Inclusive Tax Line):', calculated);

  assert.strictEqual(calculated.taxType, 'inclusive');
  assert.strictEqual(calculated.isTaxInclusive, true);
  assert.strictEqual(calculated.grossAmount, 100);
  assert.strictEqual(calculated.lineTotal, 100, 'Line total should be 100 for 100 incl. tax');
  assert.strictEqual(calculated.taxableAmount, 84.75, 'Taxable base should be 84.75');
  assert.strictEqual(calculated.taxAmount, 15.25, 'Total tax should be 15.25');
  assert.strictEqual(calculated.cgstAmount + calculated.sgstAmount, 15.25, 'CGST + SGST must equal total tax');
  assert.strictEqual(calculated.singleUnitPrice, 100, 'Single unit landed price should be 100');
  console.log('✓ Test 1 Passed: 1 unit @ 100 incl 18% GST -> Total: 100, Taxable: 84.75, Tax: 15.25, Landed: 100');
}

// TEST 2: Exclusive Tax calculation
{
  const lineExclusive = {
    qty: 1,
    costPrice: 100,
    rate: 100,
    discountPercent: 0,
    discountAmount: 0,
    taxRate: 18,
    taxType: 'exclusive',
    isTaxInclusive: false,
  };

  const calculated = calculatePurchaseLine(lineExclusive, 'LOCAL');
  console.log('Test 2 (Exclusive Tax Line):', calculated);

  assert.strictEqual(calculated.taxType, 'exclusive');
  assert.strictEqual(calculated.isTaxInclusive, false);
  assert.strictEqual(calculated.grossAmount, 100);
  assert.strictEqual(calculated.taxableAmount, 100, 'Taxable base should be 100');
  assert.strictEqual(calculated.taxAmount, 18, 'Total tax should be 18');
  assert.strictEqual(calculated.cgstAmount, 9);
  assert.strictEqual(calculated.sgstAmount, 9);
  assert.strictEqual(calculated.lineTotal, 118, 'Line total should be 118');
  assert.strictEqual(calculated.singleUnitPrice, 118, 'Single unit landed price should be 118');
  console.log('✓ Test 2 Passed: 1 unit @ 100 excl 18% GST -> Total: 118, Taxable: 100, Tax: 18, Landed: 118');
}

// TEST 3: Inclusive Tax with 10% line discount
{
  const lineInclusiveDiscount = {
    qty: 2,
    costPrice: 100,
    rate: 100,
    discountPercent: 10,
    discountAmount: 0,
    taxRate: 18,
    taxType: 'inclusive',
    isTaxInclusive: true,
  };

  const calculated = calculatePurchaseLine(lineInclusiveDiscount, 'LOCAL');
  assert.strictEqual(calculated.grossAmount, 200);
  assert.strictEqual(calculated.discountAmount, 20);
  // Net gross = 180. Taxable = 180 / 1.18 = 152.54, Tax = 27.46, Total = 180
  assert.strictEqual(calculated.lineTotal, 180);
  assert.strictEqual(calculated.taxableAmount, 152.54);
  assert.strictEqual(calculated.taxAmount, 27.46);
  assert.strictEqual(calculated.singleUnitPrice, 90);
  console.log('✓ Test 3 Passed: 2 units @ 100 with 10% disc incl 18% GST -> Net Total: 180, Landed: 90/unit');
}

// TEST 4: Interstate Supply with Inclusive Tax (IGST)
{
  const lineInterstate = {
    qty: 1,
    costPrice: 100,
    rate: 100,
    discountPercent: 0,
    discountAmount: 0,
    taxRate: 18,
    taxType: 'inclusive',
    isTaxInclusive: true,
  };

  const calculated = calculatePurchaseLine(lineInterstate, 'INTERSTATE');
  assert.strictEqual(calculated.cgstAmount, 0);
  assert.strictEqual(calculated.sgstAmount, 0);
  assert.strictEqual(calculated.igstAmount, 15.25);
  assert.strictEqual(calculated.taxAmount, 15.25);
  console.log('✓ Test 4 Passed: Interstate supply calculates IGST 15.25 and 0 CGST/SGST');
}

// TEST 5: PurchasePostingService Integration with Inclusive & Exclusive lines
{
  initializeDatabase(true);
  const db = getDatabase();

  const mockSupplier = { id: 'SUP-01', name: 'Apex Foods', stateCode: '27', supplyType: 'LOCAL', active: true };
  if (!db.suppliers.find((s) => s.id === mockSupplier.id)) db.suppliers.push(mockSupplier);

  const mockProd1 = {
    id: 'PROD-001',
    name: 'Inclusive Product',
    sku: 'INCL-01',
    taxType: 'inclusive',
    isTaxInclusive: true,
    taxRate: 18,
    costRate: 0,
    mrp: 150,
    sellingRate: 120,
    active: true,
  };
  const mockProd2 = {
    id: 'PROD-002',
    name: 'Exclusive Product',
    sku: 'EXCL-01',
    taxType: 'exclusive',
    isTaxInclusive: false,
    taxRate: 18,
    costRate: 0,
    mrp: 200,
    sellingRate: 160,
    active: true,
  };

  db.products = db.products.filter((p) => p.id !== mockProd1.id && p.id !== mockProd2.id);
  db.products.push(mockProd1, mockProd2);

  const testStore = db.stores[0] || { id: 'STR-01', name: 'Main Branch', stateCode: '27', active: true };
  if (!db.stores.find((s) => s.id === testStore.id)) db.stores.push(testStore);

  const testWarehouse = db.warehouses.find((w) => w.storeId === testStore.id) || {
    id: 'WH-01',
    name: 'Main Warehouse',
    storeId: testStore.id,
    isDefault: true,
    active: true,
  };
  if (!db.warehouses.find((w) => w.id === testWarehouse.id)) db.warehouses.push(testWarehouse);

  saveDatabase(db);

  const purchasePayload = {
    docNumber: 'PUR-2026-TEST01',
    date: '2026-10-26',
    storeId: testStore.id,
    supplierId: mockSupplier.id,
    supplierInvoiceNo: 'INV-999',
    purchaseTaxType: 'inclusive',
    items: [
      {
        productId: 'PROD-001',
        name: 'Inclusive Product',
        qty: 1,
        costPrice: 100,
        taxRate: 18,
        taxType: 'inclusive',
        isTaxInclusive: true,
        discountPercent: 0,
      },
      {
        productId: 'PROD-002',
        name: 'Exclusive Product',
        qty: 1,
        costPrice: 100,
        taxRate: 18,
        taxType: 'exclusive',
        isTaxInclusive: false,
        discountPercent: 0,
      },
    ],
  };

  const result = PurchasePostingService.postPurchase(purchasePayload, db, { id: 'admin', name: 'Admin' });
  assert.strictEqual(result.success, true);

  const updatedDb = getDatabase();
  const savedPur = updatedDb.purchases.find((p) => p.docNumber === 'PUR-2026-TEST01');
  assert.ok(savedPur, 'Saved purchase should exist');
  assert.strictEqual(savedPur.purchaseTaxType, 'inclusive');
  assert.strictEqual(savedPur.items.length, 2);

  // Line 1: 100 incl 18% -> taxable 84.75, tax 15.25, total 100
  const l1 = savedPur.items[0];
  assert.strictEqual(l1.taxType, 'inclusive');
  assert.strictEqual(l1.lineTotal, 100);
  assert.strictEqual(l1.taxableAmount, 84.75);
  assert.strictEqual(l1.taxAmount, 15.25);

  // Line 2: 100 excl 18% -> taxable 100, tax 18, total 118
  const l2 = savedPur.items[1];
  assert.strictEqual(l2.taxType, 'exclusive');
  assert.strictEqual(l2.lineTotal, 118);
  assert.strictEqual(l2.taxableAmount, 100);
  assert.strictEqual(l2.taxAmount, 18);

  // Grand Total = 100 + 118 = 218
  // Subtotal = 84.75 + 100 = 184.75
  // Total Tax = 15.25 + 18 = 33.25
  assert.strictEqual(savedPur.netAmount, 218);
  assert.strictEqual(savedPur.subtotal, 184.75);
  assert.strictEqual(savedPur.totalTax, 33.25);

  console.log('✓ Test 5 Passed: PurchasePostingService correctly posts mixed inclusive/exclusive bill: Grand Total ₹218.00 (₹100 + ₹118)');
}

console.log('\nALL PURCHASE TAX TYPE & CALCULATION TESTS PASSED SUCCESSFULLY!');
