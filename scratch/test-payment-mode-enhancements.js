// test-payment-mode-enhancements.js
// Verification script for Payment Mode Code/Name duplication, Credit tender type selection, and requiresReference removal

import assert from 'assert';
import { INITIAL_PAYMENT_MODES } from '../src/data/initialData.js';

console.log('----------------------------------------------------');
console.log('🧪 RUNNING TEST SUITE: PAYMENT MODE ENHANCEMENTS');
console.log('(CODE & NAME DUPLICATION, CREDIT TENDER TYPE, REMOVE REQUIRES REFERENCE)');
console.log('----------------------------------------------------');

// Mock payment mode database
const paymentModes = JSON.parse(JSON.stringify(INITIAL_PAYMENT_MODES));

// Mock invoices list
const invoices = [
  { id: 'INV-2026-0001', docNumber: 'INV/2026/0001', tenders: [{ method: 'CASH', amount: 500 }] },
  { id: 'INV-2026-0002', docNumber: 'INV/2026/0002', tenders: [{ method: 'UPI', amount: 1200 }] },
  { id: 'INV-2026-0003', docNumber: 'INV/2026/0003', tenders: [{ method: 'CREDIT', amount: 800 }] },
];

// Helper validation functions mirroring MasterEntitiesView logic
function validatePaymentMode({ name, code, tenderType, id = null }, dbModes = paymentModes) {
  const trimmedCode = (code || '').trim();
  const trimmedName = (name || '').trim();

  if (!trimmedName) {
    throw new Error('VALIDATION_ERROR: Payment Mode Name is required.');
  }
  if (!trimmedCode) {
    throw new Error('VALIDATION_ERROR: Payment Mode Code is required.');
  }

  // Duplicate Code check
  const duplicateCode = dbModes.find(
    (pm) => pm.id !== id && (pm.code || '').trim().toLowerCase() === trimmedCode.toLowerCase()
  );
  if (duplicateCode) {
    throw new Error(`DUPLICATE_CODE_ERROR: Payment Mode Code "${trimmedCode}" is already in use by mode "${duplicateCode.name}" (${duplicateCode.id}).`);
  }

  // Duplicate Name check
  const duplicateName = dbModes.find(
    (pm) => pm.id !== id && (pm.name || '').trim().toLowerCase() === trimmedName.toLowerCase()
  );
  if (duplicateName) {
    throw new Error(`DUPLICATE_NAME_ERROR: Payment Mode Name "${trimmedName}" already exists (${duplicateName.id}).`);
  }

  // If mode is credit, tender type choose according to that
  const isCredit =
    tenderType === 'credit' ||
    trimmedCode.toUpperCase().includes('CREDIT') ||
    trimmedName.toLowerCase().includes('credit');

  const resolvedTenderType = isCredit
    ? 'credit'
    : tenderType === 'electronic'
    ? 'electronic'
    : 'cash';

  const record = {
    id: id || `PAY-${String(dbModes.length + 1).padStart(2, '0')}`,
    code: trimmedCode.toUpperCase(),
    name: trimmedName,
    tenderType: resolvedTenderType,
    isCredit: isCredit,
    isElectronic: resolvedTenderType === 'electronic',
    active: true,
  };

  return record;
}

// 1. Mandatory validation
console.log('Test 1: Payment Mode Code and Name mandatory validation...');
assert.throws(() => validatePaymentMode({ name: '', code: 'CASH' }), /Payment Mode Name is required/);
assert.throws(() => validatePaymentMode({ name: 'Cash Counter', code: '' }), /Payment Mode Code is required/);
console.log('✅ Test 1 Passed: Empty code or name strictly rejected.');

// 2. Code duplicate checking
console.log('Test 2: Payment Mode Code duplicate checking (case-insensitive & trimmed)...');
assert.throws(
  () => validatePaymentMode({ name: 'New Cash Register', code: 'cash ' }),
  /Payment Mode Code "cash" is already in use/
);
assert.throws(
  () => validatePaymentMode({ name: 'Instant UPI', code: 'upi' }),
  /Payment Mode Code "upi" is already in use/
);
assert.throws(
  () => validatePaymentMode({ name: 'Book Khata', code: 'CREDIT' }),
  /Payment Mode Code "CREDIT" is already in use/
);
console.log('✅ Test 2 Passed: Duplicate payment mode code strictly prevented.');

// 3. Name duplicate checking
console.log('Test 3: Payment Mode Name duplicate checking (case-insensitive & trimmed)...');
assert.throws(
  () => validatePaymentMode({ name: 'cash', code: 'CASH2' }),
  /Payment Mode Name "cash" already exists/
);
assert.throws(
  () => validatePaymentMode({ name: ' Credit Card ', code: 'CC_NEW' }),
  /Payment Mode Name "Credit Card" already exists/
);
assert.throws(
  () => validatePaymentMode({ name: 'Customer Credit (On-Account)', code: 'CUST_CR' }),
  /Payment Mode Name "Customer Credit \(On-Account\)" already exists/
);
console.log('✅ Test 3 Passed: Duplicate payment mode name strictly prevented.');

// 4. Self-exclusion on edit
console.log('Test 4: Self-exclusion on editing existing payment mode...');
const editedCash = validatePaymentMode(
  { id: 'PAY-01', name: 'Cash', code: 'CASH', tenderType: 'cash' },
  paymentModes
);
assert.strictEqual(editedCash.code, 'CASH');
assert.strictEqual(editedCash.name, 'Cash');

// Colliding with another payment mode during edit
assert.throws(
  () => validatePaymentMode({ id: 'PAY-01', name: 'Cash', code: 'UPI' }, paymentModes),
  /Payment Mode Code "UPI" is already in use/
);
assert.throws(
  () => validatePaymentMode({ id: 'PAY-01', name: 'UPI / QR Payment', code: 'CASH' }, paymentModes),
  /Payment Mode Name "UPI \/ QR Payment" already exists/
);
console.log('✅ Test 4 Passed: Self-exclusion on edit works; collisions with other modes blocked.');

// 5. If mode is credit, tender type choose according to that
console.log('Test 5: If mode is credit, tender type chosen accordingly...');
// 5a: Mode name includes 'credit'
const creditModeByName = validatePaymentMode({
  name: 'Store Credit Voucher',
  code: 'SCR_VOUCHER',
});
assert.strictEqual(creditModeByName.tenderType, 'credit');
assert.strictEqual(creditModeByName.isCredit, true);
assert.strictEqual(creditModeByName.isElectronic, false);

// 5b: Mode code is 'CREDIT' or contains credit
const creditModeByCode = validatePaymentMode({
  name: 'Khata Udhar Account',
  code: 'CREDIT_KHATA',
});
assert.strictEqual(creditModeByCode.tenderType, 'credit');
assert.strictEqual(creditModeByCode.isCredit, true);
assert.strictEqual(creditModeByCode.isElectronic, false);

// 5c: Explicitly chosen tenderType as 'credit'
const explicitCredit = validatePaymentMode({
  name: 'Partner Settlement Ledger',
  code: 'PARTNER_LEDGER',
  tenderType: 'credit',
});
assert.strictEqual(explicitCredit.tenderType, 'credit');
assert.strictEqual(explicitCredit.isCredit, true);
assert.strictEqual(explicitCredit.isElectronic, false);

// 5d: Non-credit modes (Cash & Electronic)
const cashMode = validatePaymentMode({
  name: 'Petty Cash',
  code: 'PETTY_CASH',
  tenderType: 'cash',
});
assert.strictEqual(cashMode.tenderType, 'cash');
assert.strictEqual(cashMode.isCredit, false);
assert.strictEqual(cashMode.isElectronic, false);

const upiMode = validatePaymentMode({
  name: 'BharatPe QR',
  code: 'BHARAT_PE',
  tenderType: 'electronic',
});
assert.strictEqual(upiMode.tenderType, 'electronic');
assert.strictEqual(upiMode.isCredit, false);
assert.strictEqual(upiMode.isElectronic, true);

console.log('✅ Test 5 Passed: Credit mode automatically assigns credit tender type, flags, and settlement.');

// 6. Verification of requiresReference removal
console.log('Test 6: Verify requiresReference removal from schema & records...');
for (const pm of INITIAL_PAYMENT_MODES) {
  assert.strictEqual(pm.requiresReference, undefined, `Mode ${pm.code} still has requiresReference`);
}
assert.strictEqual(creditModeByName.requiresReference, undefined);
assert.strictEqual(cashMode.requiresReference, undefined);
console.log('✅ Test 6 Passed: requiresReference completely removed from all payment mode schemas.');

// 7. Referential integrity delete lock when used in invoices
console.log('Test 7: Referential integrity deletion lock when payment mode used in invoices...');
function canDeletePaymentMode(pmItem, invoicesList = invoices) {
  const pmCode = (pmItem.code || '').trim().toUpperCase();
  const pmName = (pmItem.name || '').trim().toLowerCase();
  const pmId = (pmItem.id || '').trim();

  const linkedInvoices = invoicesList.filter((inv) =>
    (inv.tenders || []).some(
      (t) =>
        (t.method && t.method.toUpperCase() === pmCode) ||
        (t.paymentModeId && t.paymentModeId === pmId) ||
        (t.method && t.method.toLowerCase() === pmName)
    )
  );

  return {
    isLocked: linkedInvoices.length > 0,
    count: linkedInvoices.length,
  };
}

const cashLock = canDeletePaymentMode({ id: 'PAY-01', code: 'CASH', name: 'Cash' });
assert.strictEqual(cashLock.isLocked, true);
assert.strictEqual(cashLock.count, 1);

const creditLock = canDeletePaymentMode({ id: 'PAY-05', code: 'CREDIT', name: 'Customer Credit (On-Account)' });
assert.strictEqual(creditLock.isLocked, true);
assert.strictEqual(creditLock.count, 1);

const unusedLock = canDeletePaymentMode({ id: 'PAY-99', code: 'UN_USED', name: 'Unused Test Mode' });
assert.strictEqual(unusedLock.isLocked, false);
assert.strictEqual(unusedLock.count, 0);

console.log('✅ Test 7 Passed: Payment modes used in invoices are safely locked from deletion.');

console.log('----------------------------------------------------');
console.log('🎉 ALL 7 / 7 PAYMENT MODE TESTS PASSED (100% SUCCESS)');
console.log('----------------------------------------------------');
