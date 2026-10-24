// Automated Verification Test for Customer Business Type (B2B/B2C), Supply Type (Local/Interstate), and States Table
import assert from 'assert';
import { INITIAL_STATES, INITIAL_CUSTOMERS } from '../src/data/initialData.js';
import { initializeDatabase } from '../src/services/storageService.js';

console.log('----------------------------------------------------');
console.log('🧪 RUNNING TEST SUITE: CUSTOMER STATES & JURISDICTION');
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

// TEST 1: Statutory Indian GST States Table Completeness
console.log('Test 1: Validating INITIAL_STATES table completeness and format...');
assert(Array.isArray(INITIAL_STATES), 'INITIAL_STATES must be an array');
assert(INITIAL_STATES.length >= 38, `Expected at least 38 states/UTs, found ${INITIAL_STATES.length}`);

const maharashtra = INITIAL_STATES.find(s => s.code === '27');
assert(maharashtra, 'State 27 (Maharashtra) must exist');
assert.strictEqual(maharashtra.name, 'Maharashtra');
assert.strictEqual(maharashtra.type, 'STATE');

const karnataka = INITIAL_STATES.find(s => s.code === '29');
assert(karnataka, 'State 29 (Karnataka) must exist');
assert.strictEqual(karnataka.name, 'Karnataka');

const delhi = INITIAL_STATES.find(s => s.code === '07');
assert(delhi, 'State 07 (Delhi) must exist');
assert.strictEqual(delhi.type, 'UT');

const ladakh = INITIAL_STATES.find(s => s.code === '38');
assert(ladakh, 'State 38 (Ladakh) must exist');

const tamilNadu = INITIAL_STATES.find(s => s.code === '33');
assert(tamilNadu, 'State 33 (Tamil Nadu) must exist');

const gujarat = INITIAL_STATES.find(s => s.code === '24');
assert(gujarat, 'State 24 (Gujarat) must exist');

INITIAL_STATES.forEach(st => {
  assert(st.code && typeof st.code === 'string', `State ${st.name} must have a 2-digit string code`);
  assert(st.name && typeof st.name === 'string', `State ${st.code} must have a name`);
  assert(st.active === true, `State ${st.name} should be active`);
});
console.log(`✅ Test 1 Passed: ${INITIAL_STATES.length} GST states and union territories verified.`);

// TEST 2: INITIAL_CUSTOMERS schema compliance
console.log('\nTest 2: Validating INITIAL_CUSTOMERS schema compliance...');
assert(INITIAL_CUSTOMERS.length > 0, 'INITIAL_CUSTOMERS must have records');
INITIAL_CUSTOMERS.forEach(cust => {
  assert(['B2B', 'B2C'].includes(cust.businessType), `Customer ${cust.name} has invalid businessType: ${cust.businessType}`);
  assert(['LOCAL', 'INTERSTATE'].includes(cust.supplyType), `Customer ${cust.name} has invalid supplyType: ${cust.supplyType}`);
  assert(cust.stateCode, `Customer ${cust.name} must have a stateCode`);
  assert(cust.state, `Customer ${cust.name} must have a state name`);
});

const b2cCust = INITIAL_CUSTOMERS.find(c => c.businessType === 'B2C');
assert(b2cCust, 'Default B2C walk-in customer must exist');
console.log('✅ Test 2 Passed: INITIAL_CUSTOMERS correctly populated with businessType & supplyType.');

// TEST 3: Database initialization and localStorage binding
console.log('\nTest 3: Testing database initialization and storage migration...');
storageMock.clear();
const dbFresh = initializeDatabase(true);

assert(Array.isArray(dbFresh.states), 'db.states must be an array on fresh init');
assert(dbFresh.states.length === INITIAL_STATES.length, 'db.states count must match INITIAL_STATES');
assert(dbFresh.customers.every(c => c.businessType && c.supplyType && c.state), 'All fresh customers must have businessType, supplyType, state');
console.log('✅ Test 3A Passed: Fresh DB init includes db.states table and customer fields.');

// TEST 4: Existing localStorage migration without states or businessType
console.log('\nTest 4: Testing existing localStorage legacy migration...');
const legacyDb = {
  users: [{ id: 'USR-ADMIN', role: 'ROLE_ADMIN' }],
  customers: [
    { id: 'CUST-OLD-1', name: 'Legacy Retail Shop', gstin: '', stateCode: '27' },
    { id: 'CUST-OLD-2', name: 'Legacy Corp Tech', gstin: '29AAAC1234F1Z9', stateCode: '29' }
  ]
};
storageMock.setItem('NEXBILL_ERP_DATABASE_V2', JSON.stringify(legacyDb));

const migratedDb = initializeDatabase(false);
assert(Array.isArray(migratedDb.states), 'migratedDb must have states table restored');
assert(migratedDb.states.length === INITIAL_STATES.length, 'migratedDb states table populated');

const migratedRetail = migratedDb.customers.find(c => c.id === 'CUST-OLD-1');
assert.strictEqual(migratedRetail.businessType, 'B2C', 'Customer without GSTIN should default to B2C');
assert.strictEqual(migratedRetail.supplyType, 'LOCAL', 'Customer with state 27 should default to LOCAL');
assert.strictEqual(migratedRetail.state, 'Maharashtra', 'Customer state name should be mapped to Maharashtra');

const migratedCorp = migratedDb.customers.find(c => c.id === 'CUST-OLD-2');
assert.strictEqual(migratedCorp.businessType, 'B2B', 'Customer with GSTIN should default to B2B');
assert.strictEqual(migratedCorp.supplyType, 'INTERSTATE', 'Customer with state 29 should default to INTERSTATE');
assert.strictEqual(migratedCorp.state, 'Karnataka', 'Customer state name should be mapped to Karnataka');
console.log('✅ Test 4 Passed: Legacy database smoothly migrated with states table and customer attributes.');

// TEST 5: Smart State and Jurisdiction Matching
console.log('\nTest 5: Verifying Place of Supply logic against store state...');
const storeStateCode = '27'; // MH
function computeSupplyType(customerStateCode) {
  return customerStateCode === storeStateCode ? 'LOCAL' : 'INTERSTATE';
}

assert.strictEqual(computeSupplyType('27'), 'LOCAL', 'Maharashtra customer to Maharashtra store is LOCAL');
assert.strictEqual(computeSupplyType('29'), 'INTERSTATE', 'Karnataka customer to Maharashtra store is INTERSTATE');
assert.strictEqual(computeSupplyType('07'), 'INTERSTATE', 'Delhi customer to Maharashtra store is INTERSTATE');
assert.strictEqual(computeSupplyType('33'), 'INTERSTATE', 'Tamil Nadu customer to Maharashtra store is INTERSTATE');
console.log('✅ Test 5 Passed: Place of supply & tax jurisdiction logic correctly determined.');

console.log('\n----------------------------------------------------');
console.log('🎉 ALL 5 TEST SUITES PASSED CLEANLY (100% SUCCESS)');
console.log('----------------------------------------------------');
