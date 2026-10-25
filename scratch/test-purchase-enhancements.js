// scratch/test-purchase-enhancements.js
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
  console.log('=== VERIFYING PURCHASE ENHANCEMENTS & WORKFLOWS ===\n');

  // Initialize DB with standard fixtures
  initializeDatabase(true);
  const db = getDatabase();

  // 1. Verify default settings for purchase product filter mode
  console.log('1. Verifying Settings: purchaseProductFilterMode');
  assert(db.settings.purchaseProductFilterMode === 'all', 'Default purchaseProductFilterMode is "all"');
  
  // Can be set to "supplier"
  db.settings.purchaseProductFilterMode = 'supplier';
  saveDatabase(db);
  const reloadedDb = getDatabase();
  assert(reloadedDb.settings.purchaseProductFilterMode === 'supplier', 'Can update purchaseProductFilterMode to "supplier"');

  // 2. Setup branch, warehouse, supplier, products and a purchase order
  console.log('\n2. Setting up test fixtures for Branch, Supplier, Products, and PO');
  const testBranch = db.stores[0] || { id: 'STR-TEST', name: 'Downtown Branch', code: 'BR-01' };
  if (!db.stores.find(s => s.id === testBranch.id)) db.stores.push(testBranch);

  let testWarehouse = db.warehouses.find(w => w.storeId === testBranch.id);
  if (!testWarehouse) {
    testWarehouse = { id: 'WH-TEST', name: 'Downtown Warehouse', storeId: testBranch.id, isDefault: true };
    db.warehouses.push(testWarehouse);
  }

  const supplier = {
    id: 'SUP-TEST-001',
    name: 'Apex Global Suppliers',
    gstin: '27AABCT3518Q1ZV',
    state: 'Maharashtra',
    stateCode: '27'
  };
  db.suppliers.push(supplier);

  const product1 = {
    id: 'PROD-PUR-01',
    sku: 'SKU-PUR-01',
    name: 'Wireless Bluetooth Headset',
    hsnCode: '85183000',
    supplierId: supplier.id,
    costRate: 1000,
    sellingRate: 1500,
    mrp: 1800,
    gstRate: 18,
    unit: 'PCS'
  };
  const product2 = {
    id: 'PROD-PUR-02',
    sku: 'SKU-PUR-02',
    name: 'USB-C Fast Charging Cable',
    hsnCode: '85444299',
    supplierId: 'OTHER-SUP-999',
    costRate: 200,
    sellingRate: 350,
    mrp: 400,
    gstRate: 18,
    unit: 'PCS'
  };
  db.products.push(product1, product2);
  saveDatabase(db);

  // Test product filtering based on supplier setting
  const supplierProducts = db.products.filter(p => !supplier.id || p.supplierId === supplier.id);
  assert(supplierProducts.some(p => p.id === product1.id), 'Supplier products includes product1 mapped to supplier');
  assert(!supplierProducts.some(p => p.id === product2.id), 'Supplier products excludes product2 mapped to different supplier');

  // Create an Approved Purchase Order
  const poDocNo = 'PO-2026-TEST-01';
  const testPO = {
    id: 'po-test-101',
    poNumber: poDocNo,
    orderDate: '2026-10-25',
    expectedDate: '2026-10-30',
    supplierId: supplier.id,
    supplierName: supplier.name,
    storeId: testBranch.id,
    branchName: testBranch.name,
    items: [
      {
        productId: product1.id,
        productName: product1.name,
        sku: product1.sku,
        hsnCode: product1.hsnCode,
        orderedQty: 20,
        rate: 1000,
        mrp: 1800,
        sellingPrice: 1500,
        gstRate: 18,
        discountPercent: 5
      }
    ],
    status: 'APPROVED',
    notes: 'Urgent order for upcoming festive season'
  };
  db.purchaseOrders = db.purchaseOrders || [];
  db.purchaseOrders.push(testPO);
  saveDatabase(db);
  assert(db.purchaseOrders.find(po => po.id === testPO.id).status === 'APPROVED', 'PO created with APPROVED status');

  // 3. Post a Purchase converted from PO with added/modified lines
  console.log('\n3. Converting PO to Purchase & Posting with Margins, Discounts, Taxes, and Other Charges');
  
  // Initial stock before purchase
  const initialStockP1 = StockService.getStockBalance(testWarehouse.id, product1.id);
  const initialStockP2 = StockService.getStockBalance(testWarehouse.id, product2.id);

  const purchaseDocNo = PurchasePostingService.generateNextPurchaseDocNumber(getDatabase());
  assert(purchaseDocNo.startsWith('PUR-'), `Generated valid Purchase Doc Number: ${purchaseDocNo}`);

  const purchasePayload = {
    docNumber: purchaseDocNo,
    purchaseDate: '2026-10-25',
    storeId: testBranch.id,
    branchName: testBranch.name,
    supplierId: supplier.id,
    supplierName: supplier.name,
    supplierInvoiceNo: 'INV-APEX-9921',
    supplierInvoiceDate: '2026-10-24',
    supplierInvoiceAmount: 26000,
    purchaseOrderId: testPO.id,
    purchaseOrderNo: testPO.poNumber,
    discountAmount: 200, // Flat Bill Discount
    otherCharges: 150,   // Freight / Transport
    paymentMode: 'CREDIT',
    notes: 'Converted from PO-2026-TEST-01 with additional test cable',
    items: [
      {
        productId: product1.id,
        productName: product1.name,
        sku: product1.sku,
        hsnCode: product1.hsnCode,
        unit: 'PCS',
        quantity: 20,
        rate: 1000, // Cost Price
        discountPercent: 5, // 5% discount = ₹50/unit => ₹950 taxable
        mrp: 1800,
        sellingPrice: 1500,
        gstRate: 18,
        batchNo: 'BAT-2026-01',
        expiryDate: '2028-12-31'
      },
      {
        // Added extra line not in PO to verify line addition
        productId: product2.id,
        productName: product2.name,
        sku: product2.sku,
        hsnCode: product2.hsnCode,
        unit: 'PCS',
        quantity: 10,
        rate: 200,
        discountPercent: 0,
        mrp: 400,
        sellingPrice: 350,
        gstRate: 18,
        batchNo: 'BAT-CABLE-01',
        expiryDate: '2030-01-01'
      }
    ]
  };

  const postResult = PurchasePostingService.postPurchase(purchasePayload);
  assert(postResult.success, 'Purchase posted successfully');
  
  const createdPurchase = postResult.purchase;
  assert(createdPurchase.branchName === testBranch.name, 'Purchase record stores branchName');
  assert(createdPurchase.supplierInvoiceNo === 'INV-APEX-9921', 'Purchase record stores supplierInvoiceNo');
  assert(createdPurchase.supplierInvoiceAmount === 26000, 'Purchase record stores supplierInvoiceAmount');
  assert(createdPurchase.supplierInvoiceDate === '2026-10-24', 'Purchase record stores supplierInvoiceDate');

  // Verify line item calculations (Single unit price landed, Margin amount and margin %)
  const line1 = createdPurchase.items[0];
  assert(line1.rate === 1000, 'Line 1 cost price is 1000');
  // discount 5% = 50, taxable = 950, GST 18% = 171 => unit landed price = 950 + 171 = 1121
  assert(Math.abs(line1.unitPriceLanded - 1121) < 0.01, `Line 1 single unit landed price is correct: ₹${line1.unitPriceLanded}`);
  // Margin amount = sellingPrice (1500) - costPrice (1000) = 500
  assert(Math.abs(line1.marginAmount - 500) < 0.01, `Line 1 margin amount is correct: ₹${line1.marginAmount}`);
  assert(line1.marginPercent > 0, `Line 1 margin percent is calculated: ${line1.marginPercent}%`);
  assert(line1.totalAmount > 0, `Line 1 total amount is calculated: ₹${line1.totalAmount}`);

  // Verify tax split-ups and totals
  assert(createdPurchase.cgstAmount > 0 || createdPurchase.igstAmount > 0, 'Tax split-up calculated');
  assert(createdPurchase.otherCharges === 150, 'Other charges included in purchase');
  assert(createdPurchase.discountAmount === 200, 'Bill discount included in purchase');
  assert(createdPurchase.grandTotal > 0, `Grand total calculated: ₹${createdPurchase.grandTotal}`);
  assert(typeof createdPurchase.amountInWords === 'string' && createdPurchase.amountInWords.length > 5, `Amount in words generated: "${createdPurchase.amountInWords}"`);

  // Verify PO status was updated to CONVERTED
  const updatedDb = getDatabase();
  const convertedPO = updatedDb.purchaseOrders.find(po => po.id === testPO.id);
  assert(convertedPO.status === 'CONVERTED', 'Original PO status was marked as CONVERTED');
  assert(convertedPO.convertedPurchaseId === createdPurchase.id, 'PO references converted purchase ID');

  // 4. Verify Stock updated in common table (db.stockBalances)
  console.log('\n4. Verifying Stock Updates in Common Table (db.stockBalances)');
  const newStockP1 = StockService.getStockBalance(testWarehouse.id, product1.id);
  const newStockP2 = StockService.getStockBalance(testWarehouse.id, product2.id);
  assert(newStockP1 === initialStockP1 + 20, `Stock for Product 1 increased by exactly 20 (from ${initialStockP1} to ${newStockP1})`);
  assert(newStockP2 === initialStockP2 + 10, `Stock for Product 2 increased by exactly 10 (from ${initialStockP2} to ${newStockP2})`);

  // 5. Verify Edit Purchase (Updating quantity and verifying stock adjustment)
  console.log('\n5. Verifying Edit Purchase & Stock Rebalancing');
  const editPayload = {
    ...createdPurchase,
    items: [
      {
        ...createdPurchase.items[0],
        quantity: 25 // Increased from 20 to 25 (+5 units)
      },
      createdPurchase.items[1] // Keep product 2 at 10
    ]
  };

  const updateResult = PurchasePostingService.updatePurchase(createdPurchase.id, editPayload);
  assert(updateResult.success, 'Purchase updated successfully');
  const updatedStockP1 = StockService.getStockBalance(testWarehouse.id, product1.id);
  assert(updatedStockP1 === initialStockP1 + 25, `Stock balance after edit accurately reflects new quantity 25 (current: ${updatedStockP1})`);

  // 6. Verify Delete Purchase (Rollback stock to initial and un-convert PO)
  console.log('\n6. Verifying Delete Purchase, Inventory Rollback & PO Reversion');
  const deleteResult = PurchasePostingService.deletePurchase(createdPurchase.id, 'USR-ADMIN');
  assert(deleteResult.success, 'Purchase deleted successfully');

  // Verify stock rolled back
  const rolledBackStockP1 = StockService.getStockBalance(testWarehouse.id, product1.id);
  const rolledBackStockP2 = StockService.getStockBalance(testWarehouse.id, product2.id);
  assert(rolledBackStockP1 === initialStockP1, `Stock for Product 1 rolled back completely to ${initialStockP1}`);
  assert(rolledBackStockP2 === initialStockP2, `Stock for Product 2 rolled back completely to ${initialStockP2}`);

  // Verify PO status reverted back to APPROVED
  const postDeleteDb = getDatabase();
  const revertedPO = postDeleteDb.purchaseOrders.find(po => po.id === testPO.id);
  assert(revertedPO.status === 'APPROVED', 'PO status was reverted back to APPROVED after purchase deletion');
  assert(!revertedPO.convertedPurchaseId, 'PO unlinked from deleted purchase');

  // Verify purchase record removed from db.purchases
  assert(!postDeleteDb.purchases.find(p => p.id === createdPurchase.id), 'Purchase record removed from db.purchases');

  console.log(`\n===============================================`);
  console.log(`ALL PURCHASE ENHANCEMENT TESTS PASSED: ${passedTests} / ${totalTests}`);
  console.log(`===============================================\n`);
}

runTests().catch(err => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
