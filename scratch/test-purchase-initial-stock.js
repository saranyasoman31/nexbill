global.localStorage = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; },
  clear() { this.store = {}; }
};

import assert from 'assert';
import { initializeDatabase, getDatabase, saveDatabase } from '../src/services/storageService.js';
import { PurchasePostingService } from '../src/services/PurchasePostingService.js';
import { StockService } from '../src/services/stockService.js';

console.log('--- RUNNING PURCHASE INITIAL STOCK INWARD VERIFICATION ---');

// Setup clean DB
initializeDatabase();
const db = getDatabase();

// Ensure test product, supplier, warehouse, and store exist
const testProd = {
  id: 'PROD-TEST-INIT-01',
  name: 'Organic Wheat Flour 10kg',
  sku: 'WHEAT-10KG',
  costRate: 400,
  taxRate: 5,
  isTaxInclusive: true,
  active: true,
};
if (!db.products.some((p) => p.id === testProd.id)) {
  db.products.push(testProd);
}

const testSupplier = {
  id: 'SUPP-TEST-01',
  name: 'Apex Agro Suppliers Ltd',
  gstin: '27AAACA9999F1Z1',
  active: true,
};
if (!db.suppliers.some((s) => s.id === testSupplier.id)) {
  db.suppliers.push(testSupplier);
}

const testWarehouseId = db.warehouses?.[0]?.id || 'WH-01';
const testStoreId = db.stores?.[0]?.id || 'STR-01';
saveDatabase(db);

// TEST 1: Initial Stock Document Number Generation
console.log('\n--- TEST 1: Initial Stock Doc Number Generation ---');
{
  const initDocNo = PurchasePostingService.generateNextInitialStockDocNumber(db);
  console.log('Generated Initial Stock Doc No:', initDocNo);
  assert.ok(initDocNo.startsWith('INIT-'), 'Doc number must have INIT- prefix');
  const year = new Date().getFullYear();
  assert.ok(initDocNo.includes(String(year)), 'Doc number must contain current year');
  console.log('✓ Test 1 Passed: Generated INIT doc number correctly format.');
}

// TEST 2: Post Inward with isInitialStock = true (No Vendor Bill required)
console.log('\n--- TEST 2: Post Inward as Initial Stock ---');
let initialStockDocNo = '';
let initialStockPurchaseId = '';
{
  const initialQty = 50;
  const initialCost = 380;

  const payload = {
    isInitialStock: true,
    entryType: 'INITIAL_STOCK',
    date: '2026-10-26',
    storeId: testStoreId,
    warehouseId: testWarehouseId,
    lines: [
      {
        productId: testProd.id,
        name: testProd.name,
        qty: initialQty,
        costPrice: initialCost,
        rate: initialCost,
        taxRate: 0,
        taxType: 'inclusive',
        isTaxInclusive: true,
        mrp: 450,
        sellingPrice: 430,
      },
    ],
    userId: 'USR-TEST-ADMIN',
  };

  const res = PurchasePostingService.postPurchase(payload);
  console.log('Post Initial Stock result:', res.message, 'Doc:', res.docNumber);

  assert.strictEqual(res.success, true);
  assert.ok(res.docNumber.startsWith('INIT-'), 'Posted initial stock doc number must start with INIT-');
  initialStockDocNo = res.docNumber;
  initialStockPurchaseId = res.purchaseId;

  // Verify in db.purchases
  const refreshedDb = getDatabase();
  const posted = refreshedDb.purchases.find((p) => p.id === res.purchaseId);
  assert.ok(posted, 'Record must exist in db.purchases');
  assert.strictEqual(posted.isInitialStock, true, 'isInitialStock flag must be true');
  assert.strictEqual(posted.entryType, 'INITIAL_STOCK');
  assert.strictEqual(posted.docType, 'INITIAL_STOCK');
  assert.strictEqual(posted.supplierInvoiceNo, 'OPENING-STOCK', 'Supplier invoice should default to OPENING-STOCK');
  assert.strictEqual(posted.paymentMode, 'NOT_APPLICABLE');

  // Verify stock movement
  const movement = (refreshedDb.stockMovements || []).find((m) => m.docId === res.purchaseId);
  assert.ok(movement, 'Stock movement must be recorded');
  assert.strictEqual(movement.docType, 'INITIAL_STOCK', 'Stock movement must have docType INITIAL_STOCK');
  assert.strictEqual(movement.qtyChange ?? movement.quantityDelta, initialQty, 'Stock movement quantity must match');

  // Verify stock balance
  const balance = (refreshedDb.stockBalances || []).find(
    (b) => b.productId === testProd.id && b.warehouseId === testWarehouseId
  );
  assert.ok(balance, 'Stock balance must exist');
  assert.ok(balance.quantity >= initialQty, 'Stock balance must be updated with initial stock');

  // Verify synchronized into db.initialStocks
  const initStockEntry = (refreshedDb.initialStocks || []).find((i) => i.docNumber === res.docNumber);
  assert.ok(initStockEntry, 'Entry must be synchronized into db.initialStocks');
  assert.strictEqual(initStockEntry.quantity, initialQty);
  assert.strictEqual(initStockEntry.valuationRate, initialCost);
  console.log('✓ Test 2 Passed: Initial stock inward posted without vendor invoice, updated balances, and synced to initialStocks.');
}

// TEST 3: Post Standard Purchase Bill (Vendor Invoice Required)
console.log('\n--- TEST 3: Post Standard Purchase Bill ---');
let purchaseDocNo = '';
let standardPurchaseId = '';
{
  const supplier = testSupplier;
  const purchaseQty = 30;
  const purchaseCost = 390;

  const payload = {
    isInitialStock: false,
    entryType: 'PURCHASE',
    date: '2026-10-26',
    storeId: testStoreId,
    warehouseId: testWarehouseId,
    supplierId: supplier.id,
    supplierInvoiceNo: `INV-TEST-${Date.now()}`,
    supplierInvoiceDate: '2026-10-26',
    lines: [
      {
        productId: testProd.id,
        name: testProd.name,
        qty: purchaseQty,
        costPrice: purchaseCost,
        rate: purchaseCost,
        taxRate: 5,
        taxType: 'inclusive',
        isTaxInclusive: true,
        mrp: 450,
        sellingPrice: 430,
      },
    ],
    userId: 'USR-TEST-ADMIN',
  };

  const res = PurchasePostingService.postPurchase(payload);
  console.log('Post Purchase result:', res.message, 'Doc:', res.docNumber);

  assert.strictEqual(res.success, true);
  assert.ok(res.docNumber.startsWith('PUR-'), 'Standard purchase doc number must start with PUR-');
  purchaseDocNo = res.docNumber;
  standardPurchaseId = res.purchaseId;

  const refreshedDb = getDatabase();
  const posted = refreshedDb.purchases.find((p) => p.id === res.purchaseId);
  assert.ok(posted);
  assert.strictEqual(posted.isInitialStock, false);
  assert.strictEqual(posted.entryType, 'PURCHASE');

  // Verify stock movement
  const movement = (refreshedDb.stockMovements || []).find((m) => m.docId === res.purchaseId);
  assert.ok(movement);
  assert.strictEqual(movement.docType, 'PURCHASE_IN', 'Standard purchase movement must be PURCHASE_IN');

  console.log('✓ Test 3 Passed: Standard purchase posted with PUR prefix and docType PURCHASE_IN.');
}

// TEST 4: Reports Separation & Calculations
console.log('\n--- TEST 4: Reports Separation Logic ---');
{
  const currentDb = getDatabase();
  const allPurchases = currentDb.purchases || [];

  const standardPurchases = allPurchases.filter(
    (p) => !p.isInitialStock && p.entryType !== 'INITIAL_STOCK' && !p.docNumber?.startsWith('INIT-')
  );
  const initialStockPurchases = allPurchases.filter(
    (p) => p.isInitialStock || p.entryType === 'INITIAL_STOCK' || p.docNumber?.startsWith('INIT-')
  );

  console.log(`All Inward: ${allPurchases.length}, Standard Purchases: ${standardPurchases.length}, Initial Stock: ${initialStockPurchases.length}`);
  assert.ok(standardPurchases.length >= 1, 'Standard purchases must contain at least 1 record');
  assert.ok(initialStockPurchases.length >= 1, 'Initial stocks must contain at least 1 record');

  // Verify Purchases Report excludes initial stock
  const standardTurnover = standardPurchases.reduce((sum, p) => sum + (Number(p.netAmount) || 0), 0);
  const initialStockTurnover = initialStockPurchases.reduce((sum, p) => sum + (Number(p.netAmount) || 0), 0);
  console.log(`Standard Purchase Turnover: ₹${standardTurnover.toFixed(2)}, Initial Stock Cutover: ₹${initialStockTurnover.toFixed(2)}`);

  assert.ok(
    !standardPurchases.some((p) => p.isInitialStock || p.docNumber.startsWith('INIT-')),
    'Standard purchases list must not contain initial stock entries'
  );

  // Verify Stock Ledger breakdown
  const movements = (currentDb.stockMovements || []).filter(
    (m) => m.productId === testProd.id && m.warehouseId === testWarehouseId
  );
  const initQty = movements
    .filter((m) => m.docType === 'INITIAL_STOCK')
    .reduce((sum, m) => sum + (Number(m.qtyChange ?? m.quantityDelta) || 0), 0);
  const purQty = movements
    .filter((m) => m.docType === 'PURCHASE_IN' || m.docType === 'PURCHASE')
    .reduce((sum, m) => sum + (Number(m.qtyChange ?? m.quantityDelta) || 0), 0);

  console.log(`Product "${testProd.name}" -> Initial Stock Qty: ${initQty}, Purchased Qty: ${purQty}`);
  assert.strictEqual(initQty, 50, 'Initial stock movement delta should be 50');
  assert.strictEqual(purQty, 30, 'Purchased inward movement delta should be 30');

  const balance = (currentDb.stockBalances || []).find(
    (b) => b.productId === testProd.id && b.warehouseId === testWarehouseId
  );
  assert.strictEqual(balance.quantity, 80, 'Total current balance must be 50 + 30 = 80');

  console.log('✓ Test 4 Passed: Clean separation in Purchase Report, Initial Stock Report, and Stock Movement Ledger.');
}

// TEST 5: Update Initial Stock Record
console.log('\n--- TEST 5: Update Initial Stock Record ---');
{
  const currentDb = getDatabase();
  const initRec = currentDb.purchases.find((p) => p.id === initialStockPurchaseId);

  const updatedPayload = {
    ...initRec,
    isInitialStock: true,
    entryType: 'INITIAL_STOCK',
    date: '2026-10-26',
    storeId: testStoreId,
    warehouseId: testWarehouseId,
    lines: [
      {
        productId: testProd.id,
        name: testProd.name,
        qty: 60, // Changed from 50 to 60 (+10)
        costPrice: 380,
        rate: 380,
        taxRate: 0,
        taxType: 'inclusive',
        isTaxInclusive: true,
      },
    ],
    userId: 'USR-TEST-ADMIN',
  };

  const updateRes = PurchasePostingService.updatePurchase(initialStockPurchaseId, updatedPayload);
  console.log('Update Initial Stock result:', updateRes.message);

  const afterUpdateDb = getDatabase();
  const updatedBalance = (afterUpdateDb.stockBalances || []).find(
    (b) => b.productId === testProd.id && b.warehouseId === testWarehouseId
  );
  assert.strictEqual(updatedBalance.quantity, 90, 'Stock balance should be 60 + 30 = 90');

  const syncedInit = (afterUpdateDb.initialStocks || []).find((i) => i.docNumber === initialStockDocNo);
  assert.ok(syncedInit);
  assert.strictEqual(syncedInit.quantity, 60, 'Synced initial stock quantity should be 60');

  console.log('✓ Test 5 Passed: Initial stock update adjusted balances and re-synced initialStocks.');
}

// TEST 6: Delete Initial Stock Record & Stock Reversal
console.log('\n--- TEST 6: Delete Initial Stock Record ---');
{
  const deleteRes = PurchasePostingService.deletePurchase(initialStockPurchaseId, 'USR-TEST-ADMIN');
  console.log('Delete Initial Stock result:', deleteRes.message);

  const afterDeleteDb = getDatabase();
  assert.ok(!afterDeleteDb.purchases.some((p) => p.id === initialStockPurchaseId), 'Record must be removed from db.purchases');
  assert.ok(!afterDeleteDb.initialStocks.some((i) => i.docNumber === initialStockDocNo), 'Record must be removed from db.initialStocks');

  const finalBalance = (afterDeleteDb.stockBalances || []).find(
    (b) => b.productId === testProd.id && b.warehouseId === testWarehouseId
  );
  assert.strictEqual(finalBalance.quantity, 30, 'Stock balance should revert to 30 (only standard purchase remaining)');

  console.log('✓ Test 6 Passed: Deleting initial stock inward reversed inventory and cleaned up initialStocks.');
}

console.log('\n======================================================');
console.log('✅ ALL PURCHASE INITIAL STOCK ENHANCEMENTS PASSED! ✅');
console.log('======================================================\n');
