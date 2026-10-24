# NexBill ERP — Transaction Rules & Conditions Engine
### Complete Enterprise ERP Billing & Inventory Software Rebuilt in React

Built strictly adhering to the **NexBill ERP Specification (Baseline Review Draft 1.0)**, covering multi-company, multi-store, inventory row-level locks, purchasing, sales, itemized returns with disposition routing, statutory pricing, coupons, privilege points, shift drawer settlements, GSTR-1 & Tally exports, and automated validation tests.

---

## 🚀 Key Architectural Modules & Features

### 1. Multi-Company, Multi-Store, and Multi-Warehouse Context (Sec 3.1 & 18)
- Context switchers for **Company** (e.g. *Apex Retail Group Ltd* - MH vs *Apex South Logistics* - KA), **Store/Branch** (*Flagship Mumbai*, *Express Pune*, *Bengaluru Central*), and **Warehouse** (*Main Storage*, *Front Display Counter*, *Quarantine/Damaged Hub*).
- **Role-Based Access Control (RBAC)**: Supports `CASHIER`, `PURCHASE_USER`, `STOREKEEPER`, `STORE_MANAGER`, `FINANCE_ACCOUNTANT`, `COMPANY_ADMIN`, and `AUDITOR`.

### 2. Centralized Stock Integrity & Row Locking (Sec 3.3, 19, & 20.7)
- **Centralized `StockService`**: The single component authorized to mutate stock balances.
- **Simulated Row Mutex**: Prevents concurrent race conditions when two sales attempt to deplete the same last stock unit.
- **Non-Negative Stock Policy**: Transactions attempting to drive stock below zero are immediately rejected with rollback.
- **Weighted Average Cost (WAC)** valuation tracking.
- **Immutable Stock Movement Ledger**: Logs every movement (`SALE_OUT`, `PURCHASE_IN`, `RETURN_IN`, `RETURN_OUT`, `TRANSFER_OUT`, `TRANSFER_IN`, `ADJUSTMENT_IN`, `ADJUSTMENT_OUT`) with document numbers, delta, balance after, and user IDs.

### 3. POS & Sales Invoicing (Sec 5)
- **Fast Barcode Scanner**: Scan barcode (`8901234001012`) or SKU for instant cart population with visual and sound feedback.
- **Server-Side Recalculation**: Subtotals, line discounts, GST, and net payable amounts are recalculated on the server; client-submitted totals are not trusted.
- **GST Split Engine**: Automatically classifies Place of Supply into **Intra-state (50% CGST + 50% SGST)** or **Inter-state (100% IGST)** based on customer state vs store state.
- **Idempotency Token Protection**: Submissions carry an idempotency token; rapid double clicks or network retries return the original invoice without creating duplicate transactions or inventory stock-outs.
- **Coupon Stacking & Single-Use Rules**: Validates minimum spend, expiry date, maximum discount cap, and prevents single-use coupons from being redeemed twice.
- **Privilege Points (Loyalty)**: Computes points earned (1 pt per ₹100 spent) and validates redemptions (capped at 20% of net invoice) with an append-only points ledger.
- **Multi-Tender Split Payments**: Accepts Cash (with change due calculation), UPI (with UTR reference), Card (with auth code), and Customer Credit (On-Account with credit limit checks).

### 4. Sales Returns & Itemized Dispositions (Sec 7)
- Capped at original sold quantity minus previous returns.
- **Item Disposition Selection**:
  * `RESTOCK`: Automatically increases sellable inventory in the store warehouse.
  * `DAMAGED_QUARANTINE`: Quarantines defective goods into the quarantine hub.
  * `SUPPLIER_RETURN`: Staged for vendor return.
  * `NON_STOCKABLE`: Scrapped/disposed without inflating sellable stock.
- Automatically computes refund value from original tax/rate snapshot and reverses earned loyalty points.

### 5. Purchasing & Vendor Returns (Sec 4 & 6)
- Inward stock receipts with duplicate vendor invoice number blocking.
- `PURCHASE_IN` movements updating stock balances and inventory valuation.
- Debit Notes linked to original purchase with warehouse stock sufficiency checks.

### 6. Inter-Store & Inter-Warehouse Transfers (Sec 8)
- 4-stage transfer lifecycle: `DRAFT` → `APPROVED` → `DISPATCHED` (places goods into in-transit) → `RECEIVED` → `CLOSED`.
- Tracks accepted goods, transit damage, and variance shortages.
- Prevents artificial sales revenue creation during inter-location transfers.

### 7. Physical Stock Count & Adjustments (Sec 10)
- Records book quantity, physical count, and calculated variance with controlled reason codes (`PHYSICAL_COUNT`, `DAMAGE`, `EXPIRY`, `LOSS`, `FOUND_STOCK`, `DATA_CORRECTION`).
- **Manager Approval Threshold**: Variances > 10 units or > ₹1,000 are automatically held in `PENDING_APPROVAL` status until authorized by a Store Manager.

### 8. Statutory Pricing & Rate Changes (Sec 11)
- Propose new selling rates with strict validation: **Selling rate cannot exceed Maximum Retail Price (MRP)**.
- **Historical Invoice Rate Immunity**: Prior posted invoices retain their exact historical rates regardless of future price changes.

### 9. Day Close & Cash Drawer Register (Sec 14)
- Live register drawer tracking: `Opening Cash + Cash Sales - Cash Refunds = Expected Cash`.
- Physical cash counting and cash variance audit.
- Finalizes Z-Report and locks the store period.
- **Closed Period Security**: Strictly blocks new transactions when the register is closed. Reopening requires a Store Manager with statutory justification.

### 10. GSTR-1 Tax & Tally Prime Accounting Export (Sec 15)
- Tax breakdown across GST slabs (5%, 12%, 18%).
- Generates standard Tally XML vouchers for Sales & Credit Notes.
- **Export Idempotency**: Prevents duplicate accounting voucher creation when an export batch is retried.

### 11. Visual Interactive Acceptance Test Runner (Sec 20)
- Executes all **14 Core Acceptance Tests** directly in the browser or via headless Node CLI:
  1. Purchase of 10 units increases warehouse by exactly 10.
  2. Sale of 3 units decreases stock by exactly 3.
  3. Sale exceeding available stock blocked by default with no partial posting.
  4. Repeating same sale request does not duplicate invoice or stock-out.
  5. Return cannot exceed original eligible quantity after previous returns.
  6. Transfer dispatch, receipt, in-transit quantity, and variance reconcile.
  7. Concurrent sales cannot both consume same final unit (Row lock mutex).
  8. Coupon single-use policy prevents double consumption.
  9. Price change does not modify historical invoice rates.
  10. Store-level isolation prevents unauthorized cross-store warehouse access.
  11. Posting to a closed register period is strictly blocked.
  12. Failure during posting rolls back all related stock and financial records atomically.
  13. Manual stock adjustment above material threshold requires supervisor approval.
  14. Retrying an external Tally export does not duplicate accounting vouchers.

---

## 💻 Running the Application

### Development Server
```bash
npm run dev
```

### Production Build
```bash
npm run build
```

### Run Headless Acceptance Tests (14/14 Automated Verification)
```bash
node scratch/test-runner.js
```
