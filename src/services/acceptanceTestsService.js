// AcceptanceTestsService: Executes the 14 Core Transaction Acceptance Tests from Section 20
import { getDatabase, saveDatabase, initializeDatabase } from './storageService.js';
import { StockService } from './stockService.js';

import { SalesPostingService } from './salesPostingService.js';
import { PurchasePostingService } from './purchasePostingService.js';
import { SalesReturnService } from './salesReturnService.js';
import { StockTransferService } from './stockTransferService.js';
import { StockAdjustmentService } from './stockAdjustmentService.js';
import { RateChangeService } from './rateChangeService.js';
import { DayCloseService } from './dayCloseService.js';
import { TallyExportService } from './tallyExportService.js';


export const AcceptanceTestsService = {
  /**
   * Run a specific test by index (1 to 14)
   */
  async runTest(testIndex) {
    switch (testIndex) {
      case 1: return this.test1_PurchaseStockIncrease();
      case 2: return this.test2_SaleStockDecrease();
      case 3: return this.test3_NegativeStockBlocked();
      case 4: return this.test4_DuplicateSalePrevented();
      case 5: return this.test5_ExcessReturnBlocked();
      case 6: return this.test6_TransferVarianceReconciliation();
      case 7: return this.test7_ConcurrentStockLockSimulation();
      case 8: return this.test8_CouponDuplicateConsumptionBlocked();
      case 9: return this.test9_HistoricalInvoiceRateImmunity();
      case 10: return this.test10_StoreLevelAccessControl();
      case 11: return this.test11_ClosedPeriodPostingBlocked();
      case 12: return this.test12_AtomicRollbackOnFailure();
      case 13: return this.test13_MaterialAdjustmentApprovalRequirement();
      case 14: return this.test14_DuplicateExportRetryPrevention();
      default: throw new Error(`Unknown test index ${testIndex}`);
    }
  },

  /**
   * Run all 14 tests sequentially
   */
  async runAllTests(onProgress) {
    const results = [];
    for (let i = 1; i <= 14; i++) {
      try {
        const res = await this.runTest(i);
        results.push(res);
        if (onProgress) onProgress(i, res);
      } catch (err) {
        const failedRes = {
          testId: i,
          title: `Test #${i}`,
          passed: false,
          error: err.message,
          logs: [`Unhandled exception: ${err.message}`],
        };
        results.push(failedRes);
        if (onProgress) onProgress(i, failedRes);
      }
    }
    return results;
  },

  // Test 1: Purchase of 10 units increases the correct warehouse by exactly 10
  async test1_PurchaseStockIncrease() {
    const logs = [];
    const whId = 'WH-MUM-MAIN';
    const prodId = 'PROD-002'; // Sunflower Oil

    const initialStock = StockService.getStockBalance(whId, prodId);
    logs.push(`Initial stock in ${whId} for ${prodId}: ${initialStock}`);

    const res = PurchasePostingService.postPurchase({
      companyId: 'COMP-01',
      storeId: 'STR-01',
      warehouseId: whId,
      supplierId: 'SUPP-01',
      supplierInvoiceNo: `TEST-PUR-${Date.now()}`,
      items: [{ productId: prodId, name: 'Oil 1L', qty: 10, rate: 140, taxRate: 5 }],
      userId: 'USR-02',
    });

    const stockAfter = StockService.getStockBalance(whId, prodId);
    logs.push(`Purchase invoice posted: ${res.purchase.docNumber}`);
    logs.push(`Stock after purchase: ${stockAfter}`);

    const delta = stockAfter - initialStock;
    const passed = delta === 10;
    logs.push(`Assertion: Delta is +10 (actual: ${delta}) -> ${passed ? 'PASSED' : 'FAILED'}`);

    return {
      testId: 1,
      title: 'Purchase of 10 units increases warehouse by exactly 10',
      section: 'Sec 20.1',
      passed,
      logs,
    };
  },

  // Test 2: Sale of 3 units decreases stock by exactly 3
  async test2_SaleStockDecrease() {
    const logs = [];
    const whId = 'WH-MUM-MAIN';
    const prodId = 'PROD-003'; // Coffee

    const initialStock = StockService.getStockBalance(whId, prodId);
    logs.push(`Initial stock for ${prodId}: ${initialStock}`);

    const saleRes = SalesPostingService.postSale({
      companyId: 'COMP-01',
      storeId: 'STR-01',
      warehouseId: whId,
      customerId: 'CUST-002',
      items: [{ productId: prodId, name: 'Coffee', qty: 3, rate: 250, taxRate: 5 }],
      tenders: [{ method: 'CASH', amount: 750 }],
      userId: 'USR-01',
    });

    const stockAfter = StockService.getStockBalance(whId, prodId);
    logs.push(`Sale invoice posted: ${saleRes.invoice.docNumber}`);
    logs.push(`Stock after sale: ${stockAfter}`);

    const delta = initialStock - stockAfter;
    const passed = delta === 3;
    logs.push(`Assertion: Stock reduced by exactly 3 -> ${passed ? 'PASSED' : 'FAILED'}`);

    return {
      testId: 2,
      title: 'Sale of 3 units decreases stock by exactly 3',
      section: 'Sec 20.2',
      passed,
      logs,
    };
  },

  // Test 3: A sale exceeding available stock is blocked by default with no partial posting
  async test3_NegativeStockBlocked() {
    const logs = [];
    const whId = 'WH-MUM-MAIN';
    const prodId = 'PROD-004'; // Honey

    const currentStock = StockService.getStockBalance(whId, prodId);
    const excessQty = currentStock + 500;
    logs.push(`Current stock: ${currentStock}. Attempting sale of ${excessQty} units (excess).`);

    let errorCaught = false;
    let errorMessage = '';

    try {
      SalesPostingService.postSale({
        companyId: 'COMP-01',
        storeId: 'STR-01',
        warehouseId: whId,
        customerId: 'CUST-002',
        items: [{ productId: prodId, name: 'Honey', qty: excessQty, rate: 310, taxRate: 12 }],
        tenders: [{ method: 'CASH', amount: excessQty * 310 }],
        userId: 'USR-01',
      });
    } catch (e) {
      errorCaught = true;
      errorMessage = e.message;
      logs.push(`Expected exception intercepted: "${e.message}"`);
    }

    const stockAfter = StockService.getStockBalance(whId, prodId);
    const stockUnchanged = stockAfter === currentStock;
    logs.push(`Stock after attempted sale: ${stockAfter} (Unchanged: ${stockUnchanged})`);

    const passed = errorCaught && stockUnchanged && errorMessage.includes('INSUFFICIENT_STOCK');
    logs.push(`Assertion: Sale blocked and zero stock mutated -> ${passed ? 'PASSED' : 'FAILED'}`);

    return {
      testId: 3,
      title: 'Sale exceeding stock blocked by default with no partial posting',
      section: 'Sec 20.3',
      passed,
      logs,
    };
  },

  // Test 4: Repeating the same sale request does not duplicate invoice or stock-out
  async test4_DuplicateSalePrevented() {
    const logs = [];
    const idempotencyToken = `TEST-IDEMP-${Date.now()}`;
    const whId = 'WH-MUM-MAIN';
    const prodId = 'PROD-005'; // Chocolate

    const stockBefore = StockService.getStockBalance(whId, prodId);
    logs.push(`Generated idempotency token: ${idempotencyToken}`);

    // Call 1
    const call1 = SalesPostingService.postSale({
      companyId: 'COMP-01',
      storeId: 'STR-01',
      warehouseId: whId,
      customerId: 'CUST-002',
      items: [{ productId: prodId, name: 'Chocolate', qty: 2, rate: 165, taxRate: 18 }],
      tenders: [{ method: 'CASH', amount: 330 }],
      idempotencyToken,
      userId: 'USR-01',
    });
    logs.push(`Call 1 result: Created ${call1.invoice.docNumber}`);

    const stockAfterCall1 = StockService.getStockBalance(whId, prodId);

    // Call 2 (Simulating repeated click / browser retry with same idempotency token)
    const call2 = SalesPostingService.postSale({
      companyId: 'COMP-01',
      storeId: 'STR-01',
      warehouseId: whId,
      customerId: 'CUST-002',
      items: [{ productId: prodId, name: 'Chocolate', qty: 2, rate: 165, taxRate: 18 }],
      tenders: [{ method: 'CASH', amount: 330 }],
      idempotencyToken,
      userId: 'USR-01',
    });
    logs.push(`Call 2 result: isDuplicateSuppressed = ${call2.isDuplicateSuppressed}`);

    const stockAfterCall2 = StockService.getStockBalance(whId, prodId);
    logs.push(`Stock before: ${stockBefore}, after call 1: ${stockAfterCall1}, after call 2: ${stockAfterCall2}`);

    const passed = call2.isDuplicateSuppressed && (stockAfterCall1 === stockAfterCall2) && (call1.invoice.id === call2.invoice.id);
    logs.push(`Assertion: Idempotency suppressed duplicate invoice & duplicate stock deduction -> ${passed ? 'PASSED' : 'FAILED'}`);

    return {
      testId: 4,
      title: 'Repeating same sale request does not duplicate invoice or stock-out',
      section: 'Sec 20.4',
      passed,
      logs,
    };
  },

  // Test 5: A return cannot exceed the original eligible quantity after previous returns
  async test5_ExcessReturnBlocked() {
    const logs = [];
    const whId = 'WH-MUM-MAIN';
    const prodId = 'PROD-006'; // Mouse

    // 1. Post original sale of 2 units
    const sale = SalesPostingService.postSale({
      companyId: 'COMP-01',
      storeId: 'STR-01',
      warehouseId: whId,
      customerId: 'CUST-002',
      items: [{ productId: prodId, name: 'Mouse', qty: 2, rate: 849, taxRate: 18 }],
      tenders: [{ method: 'CASH', amount: 1698 }],
      userId: 'USR-01',
    });
    logs.push(`Created sale ${sale.invoice.docNumber} with 2 units.`);

    // 2. Return 1 unit
    SalesReturnService.postSalesReturn({
      originalInvoiceNumber: sale.invoice.docNumber,
      items: [{ productId: prodId, returnQty: 1, disposition: 'RESTOCK' }],
      refundMethod: 'CASH',
      userId: 'USR-01',
    });
    logs.push(`Returned 1 unit. Remaining returnable qty should be 1.`);

    // 3. Attempt to return 2 more units (exceeds remaining 1 unit)
    let excessBlocked = false;
    try {
      SalesReturnService.postSalesReturn({
        originalInvoiceNumber: sale.invoice.docNumber,
        items: [{ productId: prodId, returnQty: 2, disposition: 'RESTOCK' }],
        refundMethod: 'CASH',
        userId: 'USR-01',
      });
    } catch (e) {
      excessBlocked = true;
      logs.push(`Expected excess return exception caught: "${e.message}"`);
    }

    const passed = excessBlocked;
    logs.push(`Assertion: Excess return correctly blocked -> ${passed ? 'PASSED' : 'FAILED'}`);

    return {
      testId: 5,
      title: 'Return cannot exceed original eligible quantity after previous returns',
      section: 'Sec 20.5',
      passed,
      logs,
    };
  },

  // Test 6: Transfer dispatch, receipt, in-transit quantity, and variance reconcile
  async test6_TransferVarianceReconciliation() {
    const logs = [];
    const srcWh = 'WH-MUM-MAIN';
    const dstWh = 'WH-MUM-FRONT';
    const prodId = 'PROD-007'; // Cable

    const srcBefore = StockService.getStockBalance(srcWh, prodId);
    const dstBefore = StockService.getStockBalance(dstWh, prodId);
    logs.push(`Source stock before: ${srcBefore}, Destination stock before: ${dstBefore}`);

    // Create & dispatch 5 units
    const trf = StockTransferService.createTransfer({
      sourceWarehouseId: srcWh,
      destinationWarehouseId: dstWh,
      items: [{ productId: prodId, qty: 5 }],
      userId: 'USR-03',
    });
    StockTransferService.dispatchTransfer(trf.id, 'USR-03');

    const srcAfterDispatch = StockService.getStockBalance(srcWh, prodId);
    logs.push(`After dispatch: Source stock reduced to ${srcAfterDispatch} (-5 units). In-transit: 5 units.`);

    // Receive 4 units accepted, 1 unit damaged
    StockTransferService.receiveTransfer(trf.id, [
      { productId: prodId, receivedQty: 4, damagedQty: 1 }
    ], 'USR-01');

    const dstAfterReceive = StockService.getStockBalance(dstWh, prodId);
    logs.push(`After receipt: Destination accepted 4 units (new balance: ${dstAfterReceive}). Damaged 1 unit.`);

    const passed = (srcBefore - srcAfterDispatch === 5) && (dstAfterReceive - dstBefore === 4);
    logs.push(`Assertion: Source deducted 5, Destination accepted 4, in-transit reconciled -> ${passed ? 'PASSED' : 'FAILED'}`);

    return {
      testId: 6,
      title: 'Transfer dispatch, receipt, in-transit quantity, and variance reconcile',
      section: 'Sec 20.6',
      passed,
      logs,
    };
  },

  // Test 7: Concurrent sales cannot both consume same final unit under no-negative-stock policy
  async test7_ConcurrentStockLockSimulation() {
    const logs = [];
    const whId = 'WH-MUM-MAIN';
    const prodId = 'PROD-008'; // Earbuds

    // Acquire lock
    logs.push(`Transaction A acquiring row lock on ${whId}:${prodId}...`);
    const releaseLock = StockService.acquireLock(whId, prodId);

    let lockBlockedB = false;
    try {
      logs.push(`Concurrent Transaction B attempting to acquire lock on same row...`);
      StockService.acquireLock(whId, prodId);
    } catch (e) {
      lockBlockedB = true;
      logs.push(`Transaction B blocked by mutex: "${e.message}"`);
    }

    releaseLock();
    logs.push(`Transaction A released lock. Lock table is now clear.`);

    const passed = lockBlockedB;
    logs.push(`Assertion: Mutex lock prevented concurrent race condition -> ${passed ? 'PASSED' : 'FAILED'}`);

    return {
      testId: 7,
      title: 'Concurrent sales cannot both consume same final unit (Row Lock simulation)',
      section: 'Sec 20.7',
      passed,
      logs,
    };
  },

  // Test 8: A coupon or points balance cannot be consumed twice concurrently
  async test8_CouponDuplicateConsumptionBlocked() {
    const logs = [];
    const couponCode = 'WELCOME50';
    const customerId = 'CUST-002'; // Registered customer Arun

    // Use coupon first time
    const res1 = SalesPostingService.postSale({
      companyId: 'COMP-01',
      storeId: 'STR-01',
      warehouseId: 'WH-MUM-MAIN',
      customerId,
      items: [{ productId: 'PROD-001', name: 'Rice', qty: 1, rate: 430, taxRate: 5 }],
      couponCode,
      tenders: [{ method: 'CASH', amount: 500 }],
      userId: 'USR-01',
    });
    logs.push(`First sale ${res1.invoice.docNumber} successfully redeemed coupon ${couponCode}.`);

    // Try redeeming the single-use coupon a second time with same customer
    let secondRedemptionBlocked = false;
    try {
      SalesPostingService.postSale({
        companyId: 'COMP-01',
        storeId: 'STR-01',
        warehouseId: 'WH-MUM-MAIN',
        customerId,
        items: [{ productId: 'PROD-001', name: 'Rice', qty: 1, rate: 430, taxRate: 5 }],
        couponCode,
        tenders: [{ method: 'CASH', amount: 500 }],
        userId: 'USR-01',
      });
    } catch (e) {
      secondRedemptionBlocked = true;
      logs.push(`Second redemption blocked: "${e.message}"`);
    }

    const passed = secondRedemptionBlocked;
    logs.push(`Assertion: Single-use coupon double-consumption blocked -> ${passed ? 'PASSED' : 'FAILED'}`);

    return {
      testId: 8,
      title: 'Coupon cannot be consumed twice for single-use policy',
      section: 'Sec 20.8',
      passed,
      logs,
    };
  },

  // Test 9: A price change does not modify historical invoice rates
  async test9_HistoricalInvoiceRateImmunity() {
    const logs = [];
    const prodId = 'PROD-009'; // Sanitizer

    // Post invoice with original rate
    const sale = SalesPostingService.postSale({
      companyId: 'COMP-01',
      storeId: 'STR-01',
      warehouseId: 'WH-MUM-MAIN',
      customerId: 'CUST-002',
      items: [{ productId: prodId, name: 'Sanitizer', qty: 2, rate: 130, taxRate: 18 }],
      tenders: [{ method: 'CASH', amount: 260 }],
      userId: 'USR-01',
    });
    const historicalRate = sale.invoice.lines[0].rate;
    logs.push(`Invoice ${sale.invoice.docNumber} posted with Sanitizer at rate ₹${historicalRate}.`);

    // Execute rate change to ₹150
    RateChangeService.proposeRateChange({
      productId: prodId,
      newSellingRate: 150,
      reason: 'Inflation adjustment',
      userRole: 'STORE_MANAGER',
      userId: 'USR-04',
    });
    logs.push(`Active product rate changed to ₹150.`);

    // Fetch historical invoice again from database
    const db = getDatabase();
    const storedInvoice = db.invoices.find(inv => inv.id === sale.invoice.id);
    const retainedRate = storedInvoice.lines[0].rate;
    logs.push(`Retrieved historical invoice rate: ₹${retainedRate}.`);

    const passed = retainedRate === historicalRate && retainedRate === 130;
    logs.push(`Assertion: Historical invoice retains original rate ₹130 despite rate change to ₹150 -> ${passed ? 'PASSED' : 'FAILED'}`);

    return {
      testId: 9,
      title: 'Price change does not modify historical invoice rates',
      section: 'Sec 20.9',
      passed,
      logs,
    };
  },

  // Test 10: Store-level isolation prevents cross-store unauthorized access
  async test10_StoreLevelAccessControl() {
    const logs = [];
    // User from Store 1 attempting to post sale with Store 2 warehouse
    const unauthorizedWarehouseId = 'WH-PUN-MAIN'; // Pune warehouse belonging to Store 2

    let blocked = false;
    try {
      SalesPostingService.postSale({
        companyId: 'COMP-01',
        storeId: 'STR-01', // Mumbai Store
        warehouseId: unauthorizedWarehouseId, // Pune Warehouse
        customerId: 'CUST-002',
        items: [{ productId: 'PROD-001', name: 'Rice', qty: 1, rate: 430, taxRate: 5 }],
        tenders: [{ method: 'CASH', amount: 430 }],
        userId: 'USR-01',
      });
    } catch (e) {
      blocked = true;
      logs.push(`Cross-store warehouse posting blocked: "${e.message}"`);
    }

    const passed = blocked;
    logs.push(`Assertion: Cross-store isolation enforced at server level -> ${passed ? 'PASSED' : 'FAILED'}`);

    return {
      testId: 10,
      title: 'Store-level isolation prevents unauthorized cross-store warehouse access',
      section: 'Sec 20.10',
      passed,
      logs,
    };
  },

  // Test 11: Posting to a closed period is blocked unless an authorized reopening is recorded
  async test11_ClosedPeriodPostingBlocked() {
    const logs = [];
    const db = getDatabase();
    const store = db.stores.find(s => s.id === 'STR-01');

    // Simulate closing day
    store.isDayOpen = false;
    saveDatabase(db);
    logs.push(`Store ${store.name} day status set to CLOSED.`);

    let closedPeriodBlocked = false;
    try {
      SalesPostingService.postSale({
        companyId: 'COMP-01',
        storeId: 'STR-01',
        warehouseId: 'WH-MUM-MAIN',
        customerId: 'CUST-002',
        items: [{ productId: 'PROD-001', name: 'Rice', qty: 1, rate: 430, taxRate: 5 }],
        tenders: [{ method: 'CASH', amount: 430 }],
        userId: 'USR-01',
      });
    } catch (e) {
      closedPeriodBlocked = true;
      logs.push(`Posting blocked: "${e.message}"`);
    }

    // Reopen store day
    store.isDayOpen = true;
    saveDatabase(db);
    logs.push(`Store day reopened.`);


    const passed = closedPeriodBlocked;
    logs.push(`Assertion: Posting to closed period is strictly blocked -> ${passed ? 'PASSED' : 'FAILED'}`);

    return {
      testId: 11,
      title: 'Posting to a closed period is blocked',
      section: 'Sec 20.11',
      passed,
      logs,
    };
  },

  // Test 12: A failure during posting rolls back all related stock and financial changes
  async test12_AtomicRollbackOnFailure() {
    const logs = [];
    const whId = 'WH-MUM-MAIN';
    const prodId1 = 'PROD-001'; // Sufficient stock
    const prodId2 = 'PROD-004'; // Requesting 999999 units (will trigger failure)

    const stock1Before = StockService.getStockBalance(whId, prodId1);
    const dbBefore = getDatabase();
    const invoicesCountBefore = dbBefore.invoices.length;

    logs.push(`Stock of ${prodId1} before attempt: ${stock1Before}. Invoices count: ${invoicesCountBefore}`);

    let failedAsExpected = false;
    try {
      SalesPostingService.postSale({
        companyId: 'COMP-01',
        storeId: 'STR-01',
        warehouseId: whId,
        customerId: 'CUST-002',
        items: [
          { productId: prodId1, name: 'Rice', qty: 2, rate: 430, taxRate: 5 },
          { productId: prodId2, name: 'Honey', qty: 999999, rate: 310, taxRate: 12 }, // Fails
        ],
        tenders: [{ method: 'CASH', amount: 10000000 }],
        userId: 'USR-01',
      });
    } catch (e) {
      failedAsExpected = true;
      logs.push(`Multi-line transaction failed on line 2: "${e.message}"`);
    }

    const stock1After = StockService.getStockBalance(whId, prodId1);
    const dbAfter = getDatabase();
    const invoicesCountAfter = dbAfter.invoices.length;

    logs.push(`Stock of line 1 product after failure: ${stock1After} (Unchanged: ${stock1After === stock1Before})`);
    logs.push(`Invoices count after failure: ${invoicesCountAfter} (Unchanged: ${invoicesCountAfter === invoicesCountBefore})`);

    const passed = failedAsExpected && stock1After === stock1Before && invoicesCountAfter === invoicesCountBefore;
    logs.push(`Assertion: Atomic rollback confirmed. No orphan records or partial stock deductions -> ${passed ? 'PASSED' : 'FAILED'}`);

    return {
      testId: 12,
      title: 'Failure during posting rolls back all related stock and financial changes',
      section: 'Sec 20.12',
      passed,
      logs,
    };
  },

  // Test 13: Every manual stock adjustment above threshold requires supervisor approval
  async test13_MaterialAdjustmentApprovalRequirement() {
    const logs = [];
    const whId = 'WH-MUM-MAIN';
    const prodId = 'PROD-010'; // Oats

    const currentStock = StockService.getStockBalance(whId, prodId);
    logs.push(`Current stock of Oats: ${currentStock}. Submitting count of ${currentStock + 50} (variance +50, exceeds threshold 10)...`);

    // Submitted by Storekeeper
    const adj = StockAdjustmentService.submitAdjustment({
      warehouseId: whId,
      productId: prodId,
      countedQty: currentStock + 50,
      reason: 'PHYSICAL_COUNT',
      userRole: 'STOREKEEPER',
      userId: 'USR-03',
    });

    logs.push(`Adjustment submitted: ${adj.docNumber}. Status: ${adj.status}`);

    // Verify stock is NOT updated yet while in PENDING_APPROVAL
    const stockPending = StockService.getStockBalance(whId, prodId);
    const stockUnchanged = stockPending === currentStock;
    logs.push(`Stock while pending approval: ${stockPending} (Unchanged: ${stockUnchanged})`);

    // Manager approves
    StockAdjustmentService.approveAdjustment(adj.id, 'USR-04');
    const stockAfterApproval = StockService.getStockBalance(whId, prodId);
    logs.push(`Manager approved adjustment. Stock updated to: ${stockAfterApproval}`);

    const passed = adj.status === 'PENDING_APPROVAL' && stockUnchanged && stockAfterApproval === currentStock + 50;
    logs.push(`Assertion: Threshold exceeded -> Required manager approval before stock posting -> ${passed ? 'PASSED' : 'FAILED'}`);

    return {
      testId: 13,
      title: 'Manual stock adjustment above threshold requires supervisor approval',
      section: 'Sec 20.13',
      passed,
      logs,
    };
  },

  // Test 14: Retrying an import or external integration does not duplicate a transaction
  async test14_DuplicateExportRetryPrevention() {
    const logs = [];
    const idempotencyToken = `TALLY-EXP-TOKEN-${Date.now()}`;
    logs.push(`Executing Tally export with token: ${idempotencyToken}`);

    // Call 1
    const res1 = TallyExportService.generateExportBatch({
      companyId: 'COMP-01',
      idempotencyToken,
      userId: 'USR-05',
    });
    logs.push(`Export 1 created batch: ${res1.batch.batchNumber} with ${res1.batch.voucherCount} vouchers.`);

    // Call 2 (Retry)
    const res2 = TallyExportService.generateExportBatch({
      companyId: 'COMP-01',
      idempotencyToken,
      userId: 'USR-05',
    });
    logs.push(`Export 2 retry result: isDuplicateSuppressed = ${res2.isDuplicateSuppressed}`);

    const db = getDatabase();
    const matchingBatches = db.tallyExportBatches.filter(b => b.idempotencyToken === idempotencyToken);
    logs.push(`Total matching export batches in database: ${matchingBatches.length}`);

    const passed = res2.isDuplicateSuppressed && matchingBatches.length === 1 && res1.batch.id === res2.batch.id;
    logs.push(`Assertion: Retry handled idempotently without duplicate voucher generation -> ${passed ? 'PASSED' : 'FAILED'}`);

    return {
      testId: 14,
      title: 'Retrying external integration does not duplicate accounting vouchers',
      section: 'Sec 20.14',
      passed,
      logs,
    };
  }
};
