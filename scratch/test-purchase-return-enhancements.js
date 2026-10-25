// scratch/test-purchase-return-enhancements.js
global.localStorage = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; },
  clear() { this.store = {}; }
};

import { initializeDatabase, getDatabase, saveDatabase } from '../src/services/storageService.js';
import { PurchasePostingService } from '../src/services/purchasePostingService.js';
import { StockService } from '../src/services/stockService.js';

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ ${message}`);
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log('=== VERIFYING PURCHASE RETURN ENHANCEMENTS ===\n');

  // Initialize DB with standard fixtures
  initializeDatabase(true);
  const db = getDatabase();

  // 1. Setup Suppliers, Stores, Warehouses, Products, and an Inward Purchase
  console.log('1. Setting up test fixtures');
  const store = db.stores[0] || { id: 'STR-TEST', name: 'Main Branch', code: 'BR-01' };
  let warehouse = db.warehouses.find((w) => w.storeId === store.id);
  if (!warehouse) {
    warehouse = { id: 'WH-TEST', name: 'Main Warehouse', storeId: store.id, isDefault: true };
    db.warehouses.push(warehouse);
  }

  const supplierA = {
    id: 'SUP-A',
    name: 'Supplier Alpha Ltd',
    gstin: '27AAAAA0000A1Z5',
    state: 'Maharashtra',
    stateCode: '27',
    active: true,
  };
  const supplierB = {
    id: 'SUP-B',
    name: 'Supplier Beta Corp',
    gstin: '29BBBBB0000B1Z6',
    state: 'Karnataka',
    stateCode: '29',
    supplyType: 'INTERSTATE',
    active: true,
  };
  db.suppliers.push(supplierA, supplierB);

  const product1 = {
    id: 'PROD-RET-1',
    sku: 'SKU-RET-1',
    name: 'Smart Fitness Band',
    hsnCode: '85176290',
    costRate: 1500,
    sellingRate: 2500,
    mrp: 2999,
    taxRate: 18,
    unit: 'PCS',
  };
  const product2 = {
    id: 'PROD-RET-2',
    sku: 'SKU-RET-2',
    name: 'Wireless Earbuds',
    hsnCode: '85183000',
    costRate: 800,
    sellingRate: 1400,
    mrp: 1799,
    taxRate: 18,
    unit: 'PCS',
  };
  db.products.push(product1, product2);
  saveDatabase(db);

  // Post an inward purchase for Product 1 from Supplier A
  console.log('\n2. Posting inward purchase receipt');
  const purchasePayload = {
    supplierId: supplierA.id,
    supplierInvoiceNo: 'INV-ALPHA-1001',
    storeId: store.id,
    warehouseId: warehouse.id,
    paymentMode: 'CREDIT',
    items: [
      {
        productId: product1.id,
        name: product1.name,
        qty: 50,
        costPrice: 1500,
        taxRate: 18,
        mrp: 2999,
        sellingPrice: 2500,
      },
    ],
  };
  const purchaseRes = PurchasePostingService.postPurchase(purchasePayload);
  assert(purchaseRes.success, 'Inward purchase posted successfully');
  const postedPurchase = purchaseRes.purchase;

  const stockP1AfterPurchase = StockService.getStockBalance(warehouse.id, product1.id);
  assert(stockP1AfterPurchase >= 50, `Stock balance in common table after purchase is ${stockP1AfterPurchase}`);

  // Also seed some initial stock for Product 2 directly in warehouse for ad-hoc return
  StockService.postMovement(
    {
      docType: 'ADJUSTMENT_IN',
      docId: 'SEED-01',
      docNumber: 'SEED-01',
      warehouseId: warehouse.id,
      productId: product2.id,
      quantityDelta: 30,
      costRate: 800,
      reason: 'Initial test stock',
      userId: 'USR-ADMIN',
    }
  );
  const stockP2Initial = StockService.getStockBalance(warehouse.id, product2.id);
  assert(stockP2Initial === 30, `Product 2 warehouse stock initialized to ${stockP2Initial}`);

  // 3. Purchase Return against a Purchase to that Supplier (AGAINST_PURCHASE)
  console.log('\n3. Testing Purchase Return against Inward Purchase to Supplier A');
  const returnDocNo1 = PurchasePostingService.generateNextPurchaseReturnDocNumber(getDatabase());
  assert(returnDocNo1.startsWith('PRTN-'), `Generated valid return document number: ${returnDocNo1}`);

  const returnPayload1 = {
    returnMode: 'AGAINST_PURCHASE',
    originalPurchaseDocNumber: postedPurchase.docNumber,
    docNumber: returnDocNo1,
    storeId: store.id,
    warehouseId: warehouse.id,
    reason: 'DAMAGED_IN_TRANSIT',
    notes: 'Damaged packaging during shipment',
    items: [
      {
        productId: product1.id,
        returnQty: 10, // Return 10 units out of 50
        costPrice: 1500,
        taxRate: 18,
      },
    ],
  };

  const returnRes1 = PurchasePostingService.postPurchaseReturn(returnPayload1);
  assert(returnRes1.success, 'Purchase return against purchase posted successfully');
  const createdReturn1 = returnRes1.returnRecord;
  assert(createdReturn1.supplierId === supplierA.id, 'Return correctly debits Supplier Alpha');
  assert(createdReturn1.originalPurchaseDocNumber === postedPurchase.docNumber, 'Return references original purchase document number');

  // Verify warehouse stock reduced in common table (db.stockBalances)
  const stockP1AfterReturn = StockService.getStockBalance(warehouse.id, product1.id);
  assert(
    stockP1AfterReturn === stockP1AfterPurchase - 10,
    `Stock reduced by exactly 10 in common table (from ${stockP1AfterPurchase} to ${stockP1AfterReturn})`
  );

  // Verify returnedQty on purchase line was updated
  const reloadedDb1 = getDatabase();
  const reloadedPur1 = reloadedDb1.purchases.find((p) => p.id === postedPurchase.id);
  const p1Line = reloadedPur1.lines.find((l) => l.productId === product1.id);
  assert(p1Line.returnedQty === 10, `Original purchase line returnedQty incremented to ${p1Line.returnedQty}`);

  // Verify excess return is blocked
  console.log('\n4. Verifying Excess Return Prevention');
  let excessBlocked = false;
  try {
    PurchasePostingService.postPurchaseReturn({
      returnMode: 'AGAINST_PURCHASE',
      originalPurchaseDocNumber: postedPurchase.docNumber,
      storeId: store.id,
      warehouseId: warehouse.id,
      items: [
        {
          productId: product1.id,
          returnQty: 45, // Remaining is 40 (50 - 10), so 45 should throw EXCESS_RETURN_ERROR
        },
      ],
    });
  } catch (err) {
    if (err.message.includes('EXCESS_RETURN_ERROR')) {
      excessBlocked = true;
    }
  }
  assert(excessBlocked, 'Attempt to return more than remaining returnable quantity was blocked');

  // 5. Purchase Return against a product to a DIFFERENT supplier (DIRECT_PRODUCT)
  console.log('\n5. Testing Direct Product Return to different Supplier B');
  const returnDocNo2 = PurchasePostingService.generateNextPurchaseReturnDocNumber(getDatabase());
  const returnPayload2 = {
    returnMode: 'DIRECT_PRODUCT',
    docNumber: returnDocNo2,
    supplierId: supplierB.id, // Returning to Supplier Beta (different supplier!)
    storeId: store.id,
    warehouseId: warehouse.id,
    reason: 'QUALITY_DEFECT',
    notes: 'Direct return to vendor recall center',
    items: [
      {
        productId: product2.id,
        returnQty: 5,
        costPrice: 800,
        taxRate: 18,
      },
    ],
  };

  const returnRes2 = PurchasePostingService.postPurchaseReturn(returnPayload2);
  assert(returnRes2.success, 'Direct product return to different supplier posted successfully');
  const createdReturn2 = returnRes2.returnRecord;
  assert(createdReturn2.supplierId === supplierB.id, 'Debit Note debited Supplier Beta');
  assert(createdReturn2.igstTotal > 0, `Interstate tax calculated correctly: ₹${createdReturn2.igstTotal}`);

  // Verify warehouse stock for Product 2 reduced in common table
  const stockP2AfterReturn = StockService.getStockBalance(warehouse.id, product2.id);
  assert(
    stockP2AfterReturn === stockP2Initial - 5,
    `Stock for Product 2 reduced by 5 in common table (from ${stockP2Initial} to ${stockP2AfterReturn})`
  );

  // 6. Test Edit Purchase Return (Rebalance inventory)
  console.log('\n6. Testing Edit Purchase Return & Inventory Rebalancing');
  const editPayload = {
    ...createdReturn2,
    items: [
      {
        ...createdReturn2.lines[0],
        returnQty: 8, // Changed return quantity from 5 to 8 (+3 units)
      },
    ],
  };

  const updateRes = PurchasePostingService.updatePurchaseReturn(createdReturn2.id, editPayload);
  assert(updateRes.success, 'Purchase return updated successfully');

  const stockP2AfterEdit = StockService.getStockBalance(warehouse.id, product2.id);
  assert(
    stockP2AfterEdit === stockP2Initial - 8,
    `Stock for Product 2 accurately rebalanced to reflect return qty 8 (current: ${stockP2AfterEdit})`
  );

  // 7. Test Delete Purchase Return (Rollback stock to common table)
  console.log('\n7. Testing Delete Purchase Return & Stock Restoration');
  // Delete return 1 (which was against purchase)
  const deleteRes1 = PurchasePostingService.deletePurchaseReturn(createdReturn1.id, 'USR-ADMIN');
  assert(deleteRes1.success, 'Purchase return 1 deleted successfully');

  // Verify stock restored to common table
  const stockP1AfterDelete = StockService.getStockBalance(warehouse.id, product1.id);
  assert(
    stockP1AfterDelete === stockP1AfterPurchase,
    `Stock for Product 1 fully restored to common table (from ${stockP1AfterReturn} to ${stockP1AfterDelete})`
  );

  // Verify purchase line returnedQty was decremented back
  const postDeleteDb = getDatabase();
  const postDeletePur = postDeleteDb.purchases.find((p) => p.id === postedPurchase.id);
  const p1LineAfterDelete = postDeletePur.lines.find((l) => l.productId === product1.id);
  assert(p1LineAfterDelete.returnedQty === 0, 'Original purchase returnedQty successfully reset to 0');

  // Delete return 2 (which was direct product return)
  const deleteRes2 = PurchasePostingService.deletePurchaseReturn(createdReturn2.id, 'USR-ADMIN');
  assert(deleteRes2.success, 'Purchase return 2 deleted successfully');

  const stockP2AfterDelete = StockService.getStockBalance(warehouse.id, product2.id);
  assert(
    stockP2AfterDelete === stockP2Initial,
    `Stock for Product 2 fully restored to common table (from ${stockP2AfterEdit} to ${stockP2AfterDelete})`
  );

  console.log(`\n===============================================`);
  console.log(`ALL PURCHASE RETURN TESTS PASSED: ${passedTests} / ${totalTests}`);
  console.log(`===============================================\n`);
}

runTests().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
