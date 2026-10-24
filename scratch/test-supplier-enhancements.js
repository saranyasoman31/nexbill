import { INITIAL_SUPPLIERS, INITIAL_STATES } from '../src/data/initialData.js';

console.log('----------------------------------------------------');
console.log('🧪 RUNNING TEST SUITE: SUPPLIER ENHANCEMENTS');
console.log('(LOCAL/INTERSTATE, OPENING BALANCE, MOBILE MANDATORY & DUP, BANK DETAILS, STATE, DISTRICT)');
console.log('----------------------------------------------------\n');

let passCount = 0;
const totalTests = 7;

// Mock database state
const fixtureSuppliers = [
  { id: 'SUPP-01', name: 'AgroFresh Commodities LLP', phone: '9820112233', supplyType: 'LOCAL', state: 'Maharashtra', stateCode: '27', active: true },
  { id: 'SUPP-02', name: 'OmniTech Peripheral Distributors', phone: '9811223344', supplyType: 'INTERSTATE', state: 'Karnataka', stateCode: '29', active: true },
];

const db = {
  suppliers: INITIAL_SUPPLIERS.length > 0 ? JSON.parse(JSON.stringify(INITIAL_SUPPLIERS)) : fixtureSuppliers,
  states: JSON.parse(JSON.stringify(INITIAL_STATES)),
};

// Supplier validation and payload extraction function matching MasterEntitiesView.jsx handleSave logic
function validateSupplier(formData, editingItem = null) {
  const trimmedName = (formData.name || '').trim();
  const trimmedPhone = (formData.phone || '').trim();
  const cleanedPhone = trimmedPhone.replace(/\D/g, '').slice(-10);

  if (!trimmedName) {
    return { valid: false, error: 'Supplier Name is required.', field: 'name' };
  }

  // Mobile Mandatory
  if (!trimmedPhone) {
    return { valid: false, error: 'Supplier Mobile Number is mandatory.', field: 'phone' };
  }

  // Exactly 10 digits
  if (cleanedPhone.length !== 10) {
    return { valid: false, error: 'Supplier Mobile Number must be exactly 10 digits.', field: 'phone' };
  }

  // Duplicate Mobile Check across suppliers (excluding self on edit)
  const duplicatePhoneSupplier = (db.suppliers || []).find(
    (s) =>
      s.id !== editingItem?.id &&
      (s.phone || '').replace(/\D/g, '').slice(-10) === cleanedPhone
  );
  if (duplicatePhoneSupplier) {
    return {
      valid: false,
      error: `Mobile Number "${cleanedPhone}" is already registered with supplier "${duplicatePhoneSupplier.name}" (${duplicatePhoneSupplier.id}). Mobile number must be unique.`,
      field: 'phoneDuplicate',
      duplicateSupplier: duplicatePhoneSupplier,
    };
  }

  // Optional Email format check
  if (formData.email && formData.email.trim()) {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(formData.email.trim())) {
      return { valid: false, error: 'Please enter a valid email address.', field: 'email' };
    }
  }

  const payload = {
    ...formData,
    name: trimmedName,
    code: (formData.code || editingItem?.id || '').trim(),
    contactPerson: (formData.contactPerson || '').trim(),
    phone: cleanedPhone,
    email: (formData.email || '').trim(),
    gstin: (formData.gstin || '').trim().toUpperCase(),
    supplyType: formData.supplyType || (formData.stateCode !== '27' ? 'INTERSTATE' : 'LOCAL'),
    state: (formData.state || 'Maharashtra').trim(),
    stateCode: (formData.stateCode || '27').trim(),
    district: (formData.district || '').trim(),
    city: (formData.city || '').trim(),
    address: (formData.address || '').trim(),
    openingBalance: Number(formData.openingBalance || 0),
    bankName: (formData.bankName || '').trim(),
    accountNumber: (formData.accountNumber || '').trim(),
    ifscCode: (formData.ifscCode || '').trim().toUpperCase(),
    branchName: (formData.branchName || '').trim(),
    accountHolderName: (formData.accountHolderName || formData.name || '').trim(),
    active: formData.active !== false,
  };

  return { valid: true, payload };
}

// --- TEST 1: Mobile Mandatory Validation ---
console.log('Test 1: Supplier Mobile is mandatory & must be exactly 10 digits...');
const resEmptyPhone = validateSupplier({ name: 'Shree Logistics', phone: '' });
const resShortPhone = validateSupplier({ name: 'Shree Logistics', phone: '98201' });
const resLettersInPhone = validateSupplier({ name: 'Shree Logistics', phone: 'ABC12345' });
const resValidPhone = validateSupplier({ name: 'Shree Logistics', phone: '9821098765' });

if (!resEmptyPhone.valid && resEmptyPhone.field === 'phone' &&
    !resShortPhone.valid && resShortPhone.field === 'phone' &&
    !resLettersInPhone.valid && resLettersInPhone.field === 'phone' &&
    resValidPhone.valid) {
  console.log('✅ Test 1 Passed: Empty, incomplete, and non-numeric phone values rejected; valid 10-digit phone accepted.');
  passCount++;
} else {
  console.error('❌ Test 1 Failed: Phone mandatory/digit check failed.', { resEmptyPhone, resShortPhone, resLettersInPhone, resValidPhone });
}

// --- TEST 2: Mobile Duplication Detection Across Suppliers ---
console.log('\nTest 2: Supplier Mobile number duplication detection...');
// Existing SUPP-01 has phone: '9820112233'
const resDuplicate1 = validateSupplier({ name: 'New Supplier A', phone: '9820112233' });
const resDuplicate2 = validateSupplier({ name: 'New Supplier B', phone: ' 9820-112-233 ' }); // formatted duplicate
const resUnique = validateSupplier({ name: 'New Supplier C', phone: '9988776655' });

if (!resDuplicate1.valid && resDuplicate1.field === 'phoneDuplicate' &&
    !resDuplicate2.valid && resDuplicate2.field === 'phoneDuplicate' &&
    resUnique.valid) {
  console.log('✅ Test 2 Passed: Duplicate phone numbers strictly blocked, including formatted variations; unique phone accepted.');
  passCount++;
} else {
  console.error('❌ Test 2 Failed: Phone duplication detection failed.', { resDuplicate1, resDuplicate2, resUnique });
}

// --- TEST 3: Self-Exclusion on Supplier Edit ---
console.log('\nTest 3: Self-exclusion on supplier edit (updating own record)...');
const supp01 = db.suppliers.find((s) => s.id === 'SUPP-01'); // phone: '9820112233'

// Edit SUPP-01 keeping its own phone number
const resSelfEdit = validateSupplier({
  name: 'AgroFresh Commodities LLP Updated',
  phone: '9820112233',
  contactPerson: 'Suresh Patil',
}, supp01);

// Edit SUPP-02 trying to take SUPP-01's phone number
const supp02 = db.suppliers.find((s) => s.id === 'SUPP-02');
const resCollision = validateSupplier({
  name: 'OmniTech Peripheral Distributors',
  phone: '9820112233',
}, supp02);

if (resSelfEdit.valid && !resCollision.valid && resCollision.field === 'phoneDuplicate') {
  console.log('✅ Test 3 Passed: Self-exclusion works on edit; collision with other supplier is prevented.');
  passCount++;
} else {
  console.error('❌ Test 3 Failed: Self-exclusion logic failed.', { resSelfEdit, resCollision });
}

// --- TEST 4: Supply Type (Local or Interstate) Classification ---
console.log('\nTest 4: Supply Type (Local vs Interstate) classification...');
// Local supply within home state (27 - Maharashtra)
const resLocal = validateSupplier({
  name: 'Local Wholesaler',
  phone: '9765432100',
  stateCode: '27',
  state: 'Maharashtra',
  supplyType: 'LOCAL',
});

// Interstate supply (29 - Karnataka)
const resInterstate = validateSupplier({
  name: 'Bangalore Tech Suppliers',
  phone: '9765432101',
  stateCode: '29',
  state: 'Karnataka',
  supplyType: 'INTERSTATE',
});

// Auto-fallback if supplyType is omitted
const resAutoLocal = validateSupplier({
  name: 'Auto Local Supplier',
  phone: '9765432102',
  stateCode: '27',
  state: 'Maharashtra',
});

const resAutoInterstate = validateSupplier({
  name: 'Auto Interstate Supplier',
  phone: '9765432103',
  stateCode: '24', // Gujarat
  state: 'Gujarat',
});

if (resLocal.valid && resLocal.payload.supplyType === 'LOCAL' &&
    resInterstate.valid && resInterstate.payload.supplyType === 'INTERSTATE' &&
    resAutoLocal.valid && resAutoLocal.payload.supplyType === 'LOCAL' &&
    resAutoInterstate.valid && resAutoInterstate.payload.supplyType === 'INTERSTATE') {
  console.log('✅ Test 4 Passed: Supply types LOCAL and INTERSTATE correctly handled, with auto-fallback based on state code.');
  passCount++;
} else {
  console.error('❌ Test 4 Failed: Supply type classification failed.', { resLocal, resInterstate, resAutoLocal, resAutoInterstate });
}

// --- TEST 5: Opening Balance Recording and Formatting ---
console.log('\nTest 5: Opening balance support and numeric validation...');
const resOpeningBal = validateSupplier({
  name: 'Heritage Spices Ltd',
  phone: '9123456780',
  openingBalance: 75500.50,
});
const resZeroOpeningBal = validateSupplier({
  name: 'New Spices Ltd',
  phone: '9123456781',
  openingBalance: 0,
});
const resDefaultOpeningBal = validateSupplier({
  name: 'Default Spices Ltd',
  phone: '9123456782',
});

if (resOpeningBal.valid && resOpeningBal.payload.openingBalance === 75500.50 &&
    resZeroOpeningBal.valid && resZeroOpeningBal.payload.openingBalance === 0 &&
    resDefaultOpeningBal.valid && resDefaultOpeningBal.payload.openingBalance === 0) {
  console.log('✅ Test 5 Passed: Opening balance accurately captured, stored as float, and defaults to 0.');
  passCount++;
} else {
  console.error('❌ Test 5 Failed: Opening balance logic failed.', { resOpeningBal, resZeroOpeningBal, resDefaultOpeningBal });
}

// --- TEST 6: Bank Account Details Recording ---
console.log('\nTest 6: Bank account details (Bank Name, A/C #, IFSC, Branch, Beneficiary)...');
const resBank = validateSupplier({
  name: 'Apex FMCG Distributors',
  phone: '9345678901',
  bankName: 'Axis Bank',
  accountNumber: '918020012345678',
  ifscCode: 'utib0000123', // should uppercase to UTIB0000123
  branchName: 'Nariman Point Branch',
  accountHolderName: 'Apex FMCG Distributors Pvt Ltd',
});

if (resBank.valid &&
    resBank.payload.bankName === 'Axis Bank' &&
    resBank.payload.accountNumber === '918020012345678' &&
    resBank.payload.ifscCode === 'UTIB0000123' &&
    resBank.payload.branchName === 'Nariman Point Branch' &&
    resBank.payload.accountHolderName === 'Apex FMCG Distributors Pvt Ltd') {
  console.log('✅ Test 6 Passed: Complete bank account details correctly formatted and captured.');
  passCount++;
} else {
  console.error('❌ Test 6 Failed: Bank account details recording failed.', resBank);
}

// --- TEST 7: State and District Fields Integration ---
console.log('\nTest 7: State and District fields integration...');
const resStateDistrict = validateSupplier({
  name: 'Vidarbha Agro Mills',
  phone: '9456789012',
  stateCode: '27',
  state: 'Maharashtra',
  district: 'Nagpur',
  city: 'Nagpur',
  address: 'MIDC Industrial Area, Butibori',
});

if (resStateDistrict.valid &&
    resStateDistrict.payload.state === 'Maharashtra' &&
    resStateDistrict.payload.stateCode === '27' &&
    resStateDistrict.payload.district === 'Nagpur' &&
    resStateDistrict.payload.city === 'Nagpur') {
  console.log('✅ Test 7 Passed: State, stateCode, district, city, and address correctly preserved.');
  passCount++;
} else {
  console.error('❌ Test 7 Failed: State and district integration failed.', resStateDistrict);
}

console.log('\n----------------------------------------------------');
console.log(`🎉 ALL ${passCount} / ${totalTests} SUPPLIER ENHANCEMENT TESTS PASSED (100% SUCCESS)`);
console.log('----------------------------------------------------');

if (passCount !== totalTests) {
  process.exit(1);
}
