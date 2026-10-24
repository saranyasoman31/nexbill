// Headless test runner to verify Backlog table & activity tracking
global.localStorage = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; },
  clear() { this.store = {}; }
};

const { initializeDatabase, getDatabase, logBacklog, getClientIp, setClientIp } = await import('../src/services/storageService.js');

console.log('=== TEST: BACKLOG AUDIT TABLE & ACTIVITY TRACKING ===\n');

// Initialize database
initializeDatabase(true);

// 1. Verify getClientIp and setClientIp
const initialIp = getClientIp();
console.log(`1. Initial Client IP: ${initialIp}`);
if (!initialIp || typeof initialIp !== 'string') {
  throw new Error('Client IP should be non-empty string');
}

setClientIp('192.168.1.155');
const updatedIp = getClientIp();
console.log(`2. Updated Client IP: ${updatedIp}`);
if (updatedIp !== '192.168.1.155') {
  throw new Error(`Expected updated IP 192.168.1.155, got ${updatedIp}`);
}

// 2. Test logBacklog for SAVE
const saveEntry = logBacklog({
  action: 'SAVE',
  formName: 'Product Master',
  recordRef: 'PROD-TEST-001',
  userId: 'USR-01',
  userName: 'Admin User',
  userRole: 'COMPANY_ADMIN',
  details: 'Created new test product "Organic Brown Rice 1kg" (SKU: ORG-BR-1K)',
});

console.log('3. Logged SAVE action:', {
  id: saveEntry.id,
  action: saveEntry.action,
  form: saveEntry.formName,
  user: saveEntry.userName,
  ip: saveEntry.ipAddress,
  time: saveEntry.timestamp
});

if (saveEntry.action !== 'SAVE' || saveEntry.formName !== 'Product Master' || saveEntry.ipAddress !== '192.168.1.155') {
  throw new Error('SAVE backlog entry fields did not match expected values');
}

// 3. Test logBacklog for UPDATE
const updateEntry = logBacklog({
  action: 'UPDATE',
  formName: 'Purchase Order',
  recordRef: 'PO/2026/0101',
  userId: 'USR-02',
  userName: 'Priya Sharma',
  userRole: 'PURCHASE_MANAGER',
  details: 'Approved Purchase Order PO/2026/0101 for supplier dispatch',
});

console.log('4. Logged UPDATE action:', {
  id: updateEntry.id,
  action: updateEntry.action,
  form: updateEntry.formName,
  recordRef: updateEntry.recordRef,
  user: updateEntry.userName
});

if (updateEntry.action !== 'UPDATE' || updateEntry.formName !== 'Purchase Order') {
  throw new Error('UPDATE backlog entry fields did not match');
}

// 4. Test logBacklog for DELETE
const deleteEntry = logBacklog({
  action: 'DELETE',
  formName: 'Supplier Master',
  recordRef: 'SUPP-TEMP-99',
  userId: 'USR-01',
  userName: 'Admin User',
  userRole: 'COMPANY_ADMIN',
  details: 'Deleted temporary supplier "Test Vendor Pvt Ltd" (ID: SUPP-TEMP-99)',
});

console.log('5. Logged DELETE action:', {
  id: deleteEntry.id,
  action: deleteEntry.action,
  form: deleteEntry.formName,
  recordRef: deleteEntry.recordRef
});

if (deleteEntry.action !== 'DELETE' || deleteEntry.formName !== 'Supplier Master') {
  throw new Error('DELETE backlog entry fields did not match');
}

// 5. Test logBacklog for CANCEL
const cancelEntry = logBacklog({
  action: 'CANCEL',
  formName: 'Purchase Order',
  recordRef: 'PO/2026/0105',
  userId: 'USR-02',
  userName: 'Priya Sharma',
  userRole: 'PURCHASE_MANAGER',
  details: 'Cancelled Purchase Order PO/2026/0105 due to supplier stock unavailability',
});

console.log('6. Logged CANCEL action:', {
  id: cancelEntry.id,
  action: cancelEntry.action,
  form: cancelEntry.formName,
  recordRef: cancelEntry.recordRef
});

if (cancelEntry.action !== 'CANCEL' || cancelEntry.formName !== 'Purchase Order') {
  throw new Error('CANCEL backlog entry fields did not match');
}

// 6. Test retrieval from database
const db = getDatabase();
console.log(`\n7. Total Backlog records in database: ${db.backlog.length}`);
if (!Array.isArray(db.backlog) || db.backlog.length < 4) {
  throw new Error('db.backlog should have at least 4 test entries');
}

// 7. Verify all required fields exist on every backlog record: Which User, Which Time, Which IP, Which Form
const requiredFields = ['id', 'timestamp', 'action', 'formName', 'recordRef', 'userId', 'userName', 'userRole', 'ipAddress', 'details'];
for (const entry of db.backlog.slice(0, 10)) {
  for (const field of requiredFields) {
    if (entry[field] === undefined || entry[field] === null) {
      throw new Error(`Backlog entry missing field: ${field}`);
    }
  }
}

// 8. Verify action filtering
const saveLogs = db.backlog.filter((b) => b.action === 'SAVE');
const updateLogs = db.backlog.filter((b) => b.action === 'UPDATE');
const deleteLogs = db.backlog.filter((b) => b.action === 'DELETE');
const cancelLogs = db.backlog.filter((b) => b.action === 'CANCEL');

console.log(`8. Filtered counts -> Saves: ${saveLogs.length}, Updates: ${updateLogs.length}, Deletes: ${deleteLogs.length}, Cancels: ${cancelLogs.length}`);

if (saveLogs.length === 0 || updateLogs.length === 0 || deleteLogs.length === 0 || cancelLogs.length === 0) {
  throw new Error('All 4 action types (SAVE, UPDATE, DELETE, CANCEL) must be present in the backlog');
}

console.log('\n===============================================');
console.log('FINAL RESULT: ALL BACKLOG AUDIT TESTS PASSED!');
console.log('Backlog table accurately logs which user, which time, in which IP, which form for SAVE, UPDATE, DELETE, and CANCEL.');
console.log('===============================================\n');
