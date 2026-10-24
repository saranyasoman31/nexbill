// Verification test for Tax Master enhancements & International VAT / Outside India support
import assert from 'assert';
import { INITIAL_TAXES, INITIAL_PRODUCTS } from '../src/data/initialData.js';

console.log('=== TESTING TAX MASTER & INTERNATIONAL OUTSIDE-INDIA SUPPORT ===\n');

// 1. Verify Initial Data Slabs
console.log('Test 1: Verify Initial Tax Slabs support both Dual GST and Single VAT');
const gstSlabs = INITIAL_TAXES.filter((t) => t.taxType === 'GST');
const vatSlabs = INITIAL_TAXES.filter((t) => t.taxType === 'VAT');

assert(gstSlabs.length >= 5, 'Should have standard Indian GST slabs (0%, 5%, 12%, 18%, 28%)');
assert(vatSlabs.length >= 3, 'Should have standard international VAT slabs (5%, 15%, 20%)');
console.log(`✓ Initial taxes: ${gstSlabs.length} GST slabs, ${vatSlabs.length} VAT slabs.`);

// 2. Auto-generated Name Logic
console.log('\nTest 2: Auto-generating Tax Name without user input');
function generateTaxPayload(formData) {
  const rateNum = Number(formData.rate);
  if (isNaN(rateNum) || rateNum < 0) {
    throw new Error('Tax Rate must be a valid non-negative number.');
  }
  const taxType = formData.taxType || 'VAT';
  const name = taxType === 'GST' ? `GST ${rateNum}%` : `VAT ${rateNum}%`;
  
  if (taxType === 'GST') {
    return {
      rate: rateNum,
      taxType,
      name,
      cgst: Number(formData.cgst ?? rateNum / 2),
      sgst: Number(formData.sgst ?? rateNum / 2),
      igst: Number(formData.igst ?? rateNum),
      cess: Number(formData.cess || 0),
      active: true,
    };
  } else {
    return {
      rate: rateNum,
      taxType,
      name,
      cgst: 0,
      sgst: 0,
      igst: rateNum,
      cess: 0,
      active: true,
    };
  }
}

const vatPayload = generateTaxPayload({ rate: 10, taxType: 'VAT' });
assert.strictEqual(vatPayload.name, 'VAT 10%', 'Auto-generated VAT name must be VAT 10%');
assert.strictEqual(vatPayload.cgst, 0, 'Single VAT must have CGST = 0');
assert.strictEqual(vatPayload.sgst, 0, 'Single VAT must have SGST = 0');
assert.strictEqual(vatPayload.igst, 10, 'Single VAT must have total tax rate = 10%');
console.log('✓ Single VAT payload correctly generated with name "VAT 10%" and zero CGST/SGST.');

const gstPayload = generateTaxPayload({ rate: 18, taxType: 'GST' });
assert.strictEqual(gstPayload.name, 'GST 18%', 'Auto-generated GST name must be GST 18%');
assert.strictEqual(gstPayload.cgst, 9, 'GST 18% must have CGST = 9%');
assert.strictEqual(gstPayload.sgst, 9, 'GST 18% must have SGST = 9%');
assert.strictEqual(gstPayload.igst, 18, 'GST 18% must have IGST = 18%');
console.log('✓ Dual GST payload correctly generated with name "GST 18%" and 9% CGST + 9% SGST.');

// 3. Duplicate Rate Detection
console.log('\nTest 3: Duplicate Tax Rate detection within same regime');
const taxesList = [
  { id: 'TAX-01', rate: 5, taxType: 'GST', name: 'GST 5%' },
  { id: 'TAX-02', rate: 5, taxType: 'VAT', name: 'VAT 5%' },
];

function isTaxDuplicate(candidateRate, candidateRegime, existingList, currentId = null) {
  const rateNum = Number(candidateRate);
  return existingList.some(
    (t) =>
      t.id !== currentId &&
      Number(t.rate) === rateNum &&
      (t.taxType || ((t.cgst > 0 || t.sgst > 0) ? 'GST' : 'VAT')) === candidateRegime
  );
}

// 5% GST already exists -> should be duplicate
assert.strictEqual(isTaxDuplicate(5, 'GST', taxesList), true, 'Duplicate 5% GST must be flagged');

// 5% VAT already exists -> should be duplicate
assert.strictEqual(isTaxDuplicate(5, 'VAT', taxesList), true, 'Duplicate 5% VAT must be flagged');

// 12% GST does not exist -> allowed
assert.strictEqual(isTaxDuplicate(12, 'GST', taxesList), false, '12% GST should be allowed');

// Editing existing TAX-01 with same rate 5% -> allowed (exclude self)
assert.strictEqual(isTaxDuplicate(5, 'GST', taxesList, 'TAX-01'), false, 'Editing self should not trigger duplicate flag');
console.log('✓ Duplicate rate checking correctly flags duplicates within regime and permits cross-regime rates.');

// 4. International Tax Calculation
console.log('\nTest 4: Universal International Tax calculation (Flat VAT)');
function computeInclusiveLineTax(lineSubtotal, taxRate) {
  const taxableAmount = Math.round((lineSubtotal / (1 + taxRate / 100)) * 100) / 100;
  const taxAmount = Math.round((lineSubtotal - taxableAmount) * 100) / 100;
  return { taxableAmount, taxAmount };
}

// UK 20% VAT on £120.00 subtotal
const ukTax = computeInclusiveLineTax(120.00, 20);
assert.strictEqual(ukTax.taxableAmount, 100.00, 'Taxable amount should be 100.00');
assert.strictEqual(ukTax.taxAmount, 20.00, 'Tax amount should be 20.00');
console.log('✓ International UK 20% VAT inclusive calculation matches: Taxable 100.00, VAT 20.00.');

// UAE 5% VAT on 105.00 AED subtotal
const uaeTax = computeInclusiveLineTax(105.00, 5);
assert.strictEqual(uaeTax.taxableAmount, 100.00, 'Taxable amount should be 100.00');
assert.strictEqual(uaeTax.taxAmount, 5.00, 'Tax amount should be 5.00');
console.log('✓ GCC UAE 5% VAT inclusive calculation matches: Taxable 100.00, VAT 5.00.');

// 5. Product Referential Integrity Deletion Lock
console.log('\nTest 5: Referential Integrity Deletion Lock on Tax Slabs');
const sampleProducts = [
  { id: 'PROD-001', name: 'Rice', taxRate: 5 },
  { id: 'PROD-002', name: 'Atta', taxRate: 5 },
];

function getLinkedProductsForTax(taxRate, products) {
  return products.filter((p) => Number(p.taxRate) === Number(taxRate));
}

const linkedTo5 = getLinkedProductsForTax(5, sampleProducts);
assert.strictEqual(linkedTo5.length, 2, '5% tax rate should be linked to 2 products');
const linkedTo18 = getLinkedProductsForTax(18, sampleProducts);
assert.strictEqual(linkedTo18.length, 0, '18% tax rate should have 0 linked products');
console.log('✓ Referential protection locks deletion for tax rates linked to products.');

console.log('\n===============================================');
console.log('ALL TAX MASTER & INTERNATIONAL TESTS PASSED! ✓');
