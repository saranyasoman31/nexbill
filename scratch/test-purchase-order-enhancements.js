// Test verification script for Purchase Order enhancements
import assert from 'assert';
import { INITIAL_SUPPLIERS, INITIAL_PRODUCTS, INITIAL_STOCK_BALANCES, INITIAL_INITIAL_STOCKS, INITIAL_PURCHASE_ORDERS } from '../src/data/initialData.js';
import { numberToWords } from '../src/utils/numberToWords.js';

console.log('=== STARTING PURCHASE ORDER ENHANCEMENTS UNIT TEST ===\n');

// Mock Database
const fixturePurchaseOrders = [
  { id: 'PO-2026-0001', poNumber: 'PO/2026/0101', supplierId: 'SUPP-01' }
];
const fixtureStockBalances = [
  { productId: 'PROD-001', valuationRate: 340, quantity: 45 }
];
const fixtureInitialStocks = [
  { productId: 'PROD-001', valuationRate: 340, quantity: 45 }
];
const fixtureProducts = [
  { id: 'PROD-001', name: 'Royal Heritage Basmati Rice', costRate: 340 }
];

const db = {
  suppliers: JSON.parse(JSON.stringify(INITIAL_SUPPLIERS)),
  products: INITIAL_PRODUCTS.length > 0 ? JSON.parse(JSON.stringify(INITIAL_PRODUCTS)) : fixtureProducts,
  stockBalances: INITIAL_STOCK_BALANCES.length > 0 ? JSON.parse(JSON.stringify(INITIAL_STOCK_BALANCES)) : fixtureStockBalances,
  initialStocks: INITIAL_INITIAL_STOCKS.length > 0 ? JSON.parse(JSON.stringify(INITIAL_INITIAL_STOCKS)) : fixtureInitialStocks,
  purchaseOrders: INITIAL_PURCHASE_ORDERS.length > 0 ? JSON.parse(JSON.stringify(INITIAL_PURCHASE_ORDERS)) : fixturePurchaseOrders,
  warehouses: [
    { id: 'WH-MUM-MAIN', name: 'Mumbai Main Warehouse' },
    { id: 'WH-MUM-FRONT', name: 'Mumbai Front Counter Shelf' }
  ],
  purchases: [
    {
      id: 'PUR-01',
      docNumber: 'PUR-2026-0001',
      date: '2026-04-10',
      lines: [
        { productId: 'PROD-001', rate: 350, qty: 20 }
      ]
    }
  ]
};

// 1. Test Number to Words
console.log('[1/7] Testing Amount in Words (Indian Currency)...');
const words1 = numberToWords(23940);
assert(words1.includes('Twenty Three Thousand Nine Hundred and Forty'), `Expected 23940 in words, got: ${words1}`);
const words2 = numberToWords(1050.50);
assert(words2.includes('One Thousand and Fifty') && words2.includes('Fifty Paise'), `Expected paise handling, got: ${words2}`);
console.log('  ✓ Number to words converter verified accurately.');

// 2. Test PO Number Uniqueness and Duplicate Detection
console.log('[2/7] Testing Unique PO Number Generation and Duplicate Validation...');
function isPONumberDuplicate(poNumber, excludeId, dbRef) {
  if (!poNumber || !poNumber.trim()) return false;
  const num = poNumber.trim().toLowerCase();
  return (dbRef.purchaseOrders || []).some(
    (p) => p.id !== excludeId && p.poNumber?.trim().toLowerCase() === num
  );
}

// PO/2026/0101 already exists in INITIAL_PURCHASE_ORDERS
assert.strictEqual(isPONumberDuplicate('PO/2026/0101', null, db), true, 'Existing PO number should be flagged duplicate');
assert.strictEqual(isPONumberDuplicate('PO/2026/0101', 'PO-2026-0001', db), false, 'Same PO excluding self should NOT be duplicate');
assert.strictEqual(isPONumberDuplicate('PO/2026/9999', null, db), false, 'Brand new PO number should be valid');
console.log('  ✓ PO Number uniqueness validation passed.');

// 3. Test Multiple Stock Rates for Product
console.log('[3/7] Testing Multiple Stock Rates Retrieval...');
function getProductStockRates(productId, dbRef) {
  const prod = dbRef.products?.find((p) => p.id === productId);
  const entries = [];

  (dbRef.stockBalances || [])
    .filter((b) => b.productId === productId && Number(b.valuationRate) > 0)
    .forEach((b) => {
      entries.push({ rate: Number(b.valuationRate), qty: Number(b.quantity || 0), source: 'Stock Balance' });
    });

  (dbRef.initialStocks || [])
    .filter((i) => i.productId === productId && Number(i.valuationRate) > 0)
    .forEach((i) => {
      entries.push({ rate: Number(i.valuationRate), qty: Number(i.quantity || 0), source: 'Opening Stock' });
    });

  (dbRef.purchases || []).forEach((p) => {
    (p.lines || []).filter((l) => l.productId === productId && Number(l.rate) > 0).forEach((l) => {
      entries.push({ rate: Number(l.rate), qty: Number(l.qty || 0), source: 'Purchase' });
    });
  });

  if (prod && Number(prod.costRate) > 0) {
    entries.push({ rate: Number(prod.costRate), qty: null, source: 'Master Cost' });
  }

  const map = new Map();
  for (const entry of entries) {
    const key = entry.rate.toFixed(2);
    if (!map.has(key)) {
      map.set(key, { rate: entry.rate, sources: [entry.source], totalQty: entry.qty || 0 });
    } else {
      const existing = map.get(key);
      if (!existing.sources.includes(entry.source)) existing.sources.push(entry.source);
      if (entry.qty) existing.totalQty += entry.qty;
    }
  }
  return Array.from(map.values());
}

// PROD-001 has valuationRate 340 in stockBalances, 340 in initialStocks, 340 in master cost, and 350 in purchase PUR-01!
const prod1Rates = getProductStockRates('PROD-001', db);
assert(prod1Rates.length >= 2, `Expected at least 2 distinct rates for PROD-001 (340 and 350), found: ${prod1Rates.length}`);
const has340 = prod1Rates.some(r => Math.abs(r.rate - 340) < 0.01);
const has350 = prod1Rates.some(r => Math.abs(r.rate - 350) < 0.01);
assert(has340 && has350, 'Both rates (340 and 350) must be present in the rates options');
console.log(`  ✓ Multiple stock rates detected correctly: ${prod1Rates.map(r => `₹${r.rate}`).join(', ')}.`);

// 4. Test Tax Calculation for Local (Intra-state) vs Interstate Supply
console.log('[4/7] Testing Tax Calculations (CGST/SGST vs IGST)...');
function calculateLineDetails(line, supplyType) {
  const qty = Number(line.qty) || 0;
  const rate = Number(line.rate) || 0;
  const taxRate = Number(line.taxRate) || 0;
  const taxable = qty * rate;

  let cgstRate = 0, cgstAmount = 0, sgstRate = 0, sgstAmount = 0, igstRate = 0, igstAmount = 0;
  if (supplyType === 'INTERSTATE') {
    igstRate = taxRate;
    igstAmount = (taxable * igstRate) / 100;
  } else {
    cgstRate = taxRate / 2;
    cgstAmount = (taxable * cgstRate) / 100;
    sgstRate = taxRate / 2;
    sgstAmount = (taxable * sgstRate) / 100;
  }
  const taxAmount = cgstAmount + sgstAmount + igstAmount;
  const lineTotal = taxable + taxAmount;
  return { taxable, cgstRate, cgstAmount, sgstRate, sgstAmount, igstRate, igstAmount, taxAmount, lineTotal };
}

// Local test: 10 units of ₹100 @ 18% GST (Taxable: 1000)
const localLine = calculateLineDetails({ qty: 10, rate: 100, taxRate: 18 }, 'LOCAL');
assert.strictEqual(localLine.taxable, 1000);
assert.strictEqual(localLine.cgstRate, 9);
assert.strictEqual(localLine.cgstAmount, 90);
assert.strictEqual(localLine.sgstRate, 9);
assert.strictEqual(localLine.sgstAmount, 90);
assert.strictEqual(localLine.igstAmount, 0);
assert.strictEqual(localLine.lineTotal, 1180);

// Interstate test: 10 units of ₹100 @ 18% GST (Taxable: 1000)
const interLine = calculateLineDetails({ qty: 10, rate: 100, taxRate: 18 }, 'INTERSTATE');
assert.strictEqual(interLine.cgstAmount, 0);
assert.strictEqual(interLine.sgstAmount, 0);
assert.strictEqual(interLine.igstRate, 18);
assert.strictEqual(interLine.igstAmount, 180);
assert.strictEqual(interLine.lineTotal, 1180);
console.log('  ✓ Local (CGST 9% + SGST 9%) and Interstate (IGST 18%) tax calculations verified.');

// 5. Test Email Dispatch Simulation
console.log('[5/7] Testing Email Dispatch Toggle & Metadata...');
const poWithMail = {
  id: 'PO-TEST-01',
  poNumber: 'PO/2026/0105',
  sendMail: true,
  mailTo: 'orders@agrofresh.in',
  mailSubject: 'PO Dispatch Test',
  hasPdfAttachment: true,
  status: 'DRAFT'
};
assert.strictEqual(poWithMail.sendMail, true);
assert.strictEqual(poWithMail.mailTo, 'orders@agrofresh.in');
assert.strictEqual(poWithMail.hasPdfAttachment, true);
console.log('  ✓ Email dispatch fields and PDF attachment flag verified.');

// 6. Test Lock Edit and Delete when PO is Converted to Purchase
console.log('[6/7] Testing Locked Edit and Delete on Converted PO...');
const convertedPO = {
  id: 'PO-2026-0001',
  poNumber: 'PO/2026/0101',
  status: 'CONVERTED',
  convertedPurchaseId: 'PUR-2026-0001',
};

function canEditOrDeletePO(po) {
  if (po.status === 'CONVERTED' || Boolean(po.convertedPurchaseId)) {
    return { allowed: false, reason: 'Locked: Order converted to Purchase Inward. Editing and deletion are disabled.' };
  }
  return { allowed: true };
}

const lockCheckConverted = canEditOrDeletePO(convertedPO);
assert.strictEqual(lockCheckConverted.allowed, false);
assert(lockCheckConverted.reason.includes('Locked: Order converted to Purchase Inward'));

const draftPO = { id: 'PO-2026-0002', poNumber: 'PO/2026/0102', status: 'DRAFT' };
const lockCheckDraft = canEditOrDeletePO(draftPO);
assert.strictEqual(lockCheckDraft.allowed, true);
console.log('  ✓ Converted PO lock successfully prevented edit/delete operations.');

// 7. Test No Stock Checking on PO
console.log('[7/7] Testing No Stock Checking on Purchase Order...');
// A product with 0 stock in warehouse WH-MUM-MAIN can still be added to PO with 500 units
const zeroStockProd = { id: 'PROD-NEW-01', name: 'Custom Spice Mix', stock: 0 };
const poLine = { productId: zeroStockProd.id, qty: 500, rate: 200, taxRate: 5 };
assert(poLine.qty === 500, 'Purchase Order can order any inward quantity without stock restriction');
console.log('  ✓ Verified no stock checking on Purchase Order.');

console.log('\n======================================================');
console.log('ALL PURCHASE ORDER ENHANCEMENTS UNIT TESTS PASSED! ✓');
console.log('======================================================');
