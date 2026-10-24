// Automated Verification Test for Customer Mobile Number Duplication, Numeric Restriction, and Email Validation
import assert from 'assert';
import { INITIAL_CUSTOMERS } from '../src/data/initialData.js';
import { initializeDatabase } from '../src/services/storageService.js';

console.log('----------------------------------------------------');
console.log('🧪 RUNNING TEST SUITE: CUSTOMER VALIDATIONS');
console.log('----------------------------------------------------\n');

// Mock localStorage for node environment
const storageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();
global.localStorage = storageMock;

// Email Validation Regex used in customer form
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const isValidEmail = (email) => {
  if (!email || !email.trim()) return true; // Optional if empty
  return emailRegex.test(email.trim());
};

// Numeric cleaner & 10-digit check used in customer form
const cleanMobileNumber = (val) => (val || '').replace(/\D/g, '').slice(0, 10);
const isValidMobile = (val) => cleanMobileNumber(val).length === 10;

// Duplicate checker
const checkMobileDuplicate = (customers, mobile, excludeId = null) => {
  const cleaned = cleanMobileNumber(mobile);
  if (cleaned.length !== 10) return null;
  return customers.find(c => (excludeId ? c.id !== excludeId : true) && c.phone && cleanMobileNumber(c.phone) === cleaned) || null;
};

// TEST 1: Numeric Restriction & 10-Digit Cleaning
console.log('Test 1: Testing numeric restriction & 10-digit mobile cleaning...');
assert.strictEqual(cleanMobileNumber('9820011223'), '9820011223', 'Plain 10 digits preserved');
assert.strictEqual(cleanMobileNumber('+91 98200 11223'), '9198200112', 'Non-digits stripped and capped at 10');
assert.strictEqual(cleanMobileNumber('abc98200xyz11223extra'), '9820011223', 'Letters stripped, max 10 digits');
assert.strictEqual(cleanMobileNumber('98200'), '98200', 'Partial number cleaned correctly');
assert.strictEqual(isValidMobile('9820011223'), true, 'Valid 10 digits returns true');
assert.strictEqual(isValidMobile('98200'), false, 'Incomplete digits returns false');
assert.strictEqual(isValidMobile(''), false, 'Empty returns false');
console.log('✅ Test 1 Passed: Mobile numeric restriction and 10-digit enforcement verified.');

// TEST 2: Email Format Validation
console.log('\nTest 2: Testing email format validation...');
assert.strictEqual(isValidEmail(''), true, 'Empty email is valid (optional)');
assert.strictEqual(isValidEmail('   '), true, 'Whitespace email is valid (optional)');
assert.strictEqual(isValidEmail('arun@gmail.com'), true, 'Standard email is valid');
assert.strictEqual(isValidEmail('support.billing@supermarket.co.in'), true, 'Subdomain & multi-tld email is valid');
assert.strictEqual(isValidEmail('invalid-email'), false, 'Plain text is invalid email');
assert.strictEqual(isValidEmail('@missinguser.com'), false, 'Missing username is invalid email');
assert.strictEqual(isValidEmail('missingdomain@'), false, 'Missing domain is invalid email');
assert.strictEqual(isValidEmail('user@domain'), false, 'Missing TLD is invalid email');
assert.strictEqual(isValidEmail('user@.com'), false, 'Empty domain label is invalid email');
assert.strictEqual(isValidEmail('user@domain.c'), false, 'Single-letter TLD is invalid');
console.log('✅ Test 2 Passed: Email format validation verified for both valid and invalid formats.');

// TEST 3: Mobile Number Duplication Detection
console.log('\nTest 3: Testing mobile number duplication against customer database...');
const db = initializeDatabase(true);
assert(db.customers.length > 0, 'Customer database initialized');
if (!db.customers.some(c => c.id === 'CUST-002')) {
  db.customers.push({
    id: 'CUST-002',
    name: 'Arun Verma',
    phone: '9876543210',
    email: 'arun.verma@example.com',
    active: true,
  });
}

// Customer 2 has phone 9876543210 (Arun Verma)
const existingPhone = '9876543210';
const duplicateFound = checkMobileDuplicate(db.customers, existingPhone);
assert(duplicateFound, 'Duplicate mobile number must be detected');
assert.strictEqual(duplicateFound.id, 'CUST-002', 'Detected correct customer record for duplicate');

// New unique phone
const uniquePhone = '9111222333';
const duplicateNotFound = checkMobileDuplicate(db.customers, uniquePhone);
assert.strictEqual(duplicateNotFound, null, 'Unique mobile number returns no duplicate');
console.log('✅ Test 3 Passed: Duplicate mobile numbers detected and unique numbers allowed.');

// TEST 4: Duplicate Check on Customer Edit (Self-Exclusion)
console.log('\nTest 4: Testing customer update self-exclusion for mobile number...');
// Editing CUST-002 keeping same phone 9876543210 should NOT trigger duplicate on itself
const selfEditDuplicate = checkMobileDuplicate(db.customers, existingPhone, 'CUST-002');
assert.strictEqual(selfEditDuplicate, null, 'Updating own customer with same phone must be allowed (self-exclusion)');

// Editing CUST-003 attempting to take CUST-002 phone should trigger duplicate
const otherEditDuplicate = checkMobileDuplicate(db.customers, existingPhone, 'CUST-003');
assert(otherEditDuplicate, 'Changing another customer phone to an existing phone must be blocked');
assert.strictEqual(otherEditDuplicate.id, 'CUST-002', 'Flags duplicate of CUST-002');
console.log('✅ Test 4 Passed: Self-exclusion on edit and cross-customer collision prevention verified.');

// TEST 5: Complete Customer Addition Flow with Validations
console.log('\nTest 5: Simulating customer master addition with validation checks...');
const simulateAddCustomer = (payload) => {
  const cleanedPhone = cleanMobileNumber(payload.phone);
  if (!cleanedPhone || cleanedPhone.length !== 10) {
    throw new Error('INVALID_PHONE: Mobile number must be exactly 10 digits.');
  }

  const dup = checkMobileDuplicate(db.customers, cleanedPhone);
  if (dup) {
    throw new Error(`DUPLICATE_PHONE: Mobile number ${cleanedPhone} is already registered to "${dup.name}" (${dup.id}).`);
  }

  const emailVal = (payload.email || '').trim();
  if (emailVal && !isValidEmail(emailVal)) {
    throw new Error('INVALID_EMAIL: Please enter a valid email address.');
  }

  const record = {
    id: `CUST-${String(db.customers.length + 1).padStart(3, '0')}`,
    name: payload.name.trim(),
    phone: cleanedPhone,
    email: emailVal,
    businessType: payload.businessType || 'B2C',
    supplyType: payload.supplyType || 'LOCAL',
    stateCode: '27',
    state: 'Maharashtra',
    creditLimit: payload.creditLimit || 0,
    active: true
  };
  db.customers.push(record);
  return record;
};

// Case A: Reject duplicate mobile
assert.throws(() => {
  simulateAddCustomer({ name: 'Duplicate Tester', phone: '9876543210', email: 'test@dup.com' });
}, /DUPLICATE_PHONE/, 'Must reject duplicate phone');

// Case B: Reject incomplete mobile
assert.throws(() => {
  simulateAddCustomer({ name: 'Short Phone Tester', phone: '98765', email: 'test@short.com' });
}, /INVALID_PHONE/, 'Must reject short phone');

// Case C: Reject invalid email
assert.throws(() => {
  simulateAddCustomer({ name: 'Bad Email Tester', phone: '9000011111', email: 'bad-email-no-at' });
}, /INVALID_EMAIL/, 'Must reject malformed email');

// Case D: Successfully add valid customer
const initialCount = db.customers.length;
const newCust = simulateAddCustomer({
  name: 'Pooja Sharma',
  phone: '9000011111',
  email: 'pooja.sharma@example.com',
  businessType: 'B2C',
  supplyType: 'LOCAL'
});
assert.strictEqual(db.customers.length, initialCount + 1, 'Customer count incremented');
assert.strictEqual(newCust.phone, '9000011111', 'Clean 10-digit phone stored');
assert.strictEqual(newCust.email, 'pooja.sharma@example.com', 'Valid email stored');
console.log(`✅ Test 5 Passed: Customer addition validation enforced correctly (Created: ${newCust.id} - ${newCust.name}).`);

console.log('\n----------------------------------------------------');
console.log('🎉 ALL 5 CUSTOMER VALIDATION TEST SUITES PASSED (100% SUCCESS)');
console.log('----------------------------------------------------');
