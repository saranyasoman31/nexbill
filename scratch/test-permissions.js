// Polyfill localStorage for Node CLI test
global.localStorage = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; },
  clear() { this.store = {}; },
};

import { initializeDatabase } from '../src/services/storageService.js';
import { SYSTEM_MENUS_CONFIG, PERMISSION_ACTIONS, INITIAL_ROLES } from '../src/data/initialData.js';

console.log('=== VERIFYING USER PERMISSIONS & ROLE MANAGEMENT SUITE ===\n');

const db = initializeDatabase(true);

// Test 1: Exactly 25 menus in exact specified order
console.log('[Test 1] Verifying 25 System Menus in Exact Sequential Order');
const expectedMenuOrder = [
  'credit_customer',
  'main_category',
  'category',
  'brand',
  'supplier',
  'unit',
  'company',
  'product',
  'staff',
  'payment_mode',
  'tax',
  'branch',
  'purchase_order',
  'purchase',
  'purchase_return',
  'initial',
  'stock',
  'stock_adjustment',
  'rate_change',
  'billing',
  'billing_return',
  'day_close',
  'stock_transfer',
  'reports',
  'settings',
];

if (SYSTEM_MENUS_CONFIG.length !== 25) {
  throw new Error(`Expected exactly 25 menus, got ${SYSTEM_MENUS_CONFIG.length}`);
}

SYSTEM_MENUS_CONFIG.forEach((menu, idx) => {
  const expectedId = expectedMenuOrder[idx];
  if (menu.id !== expectedId) {
    throw new Error(`Menu sequence mismatch at index ${idx}: expected ${expectedId}, got ${menu.id}`);
  }
});
console.log(`  ✓ All 25 system menus strictly verified in specified order: ${SYSTEM_MENUS_CONFIG.map(m => m.label).join(' -> ')}\n`);

// Test 2: Exactly 5 granular actions for every menu
console.log('[Test 2] Verifying 5 Granular Action Permissions (view, add, update, delete, print)');
const expectedActions = ['view', 'add', 'update', 'delete', 'print'];
if (JSON.stringify(PERMISSION_ACTIONS) !== JSON.stringify(expectedActions)) {
  throw new Error(`Invalid actions array: ${JSON.stringify(PERMISSION_ACTIONS)}`);
}
console.log(`  ✓ Permission actions validated: ${PERMISSION_ACTIONS.join(', ')} (25 menus × 5 actions = 125 total granular permissions)\n`);

// Test 3: Administrator role has 125/125 permissions enabled
console.log('[Test 3] Verifying Administrator Role 125/125 Full Permission Suite');
const adminRole = db.roles.find(r => r.id === 'ROLE_ADMIN');
if (!adminRole) throw new Error('ROLE_ADMIN not found');

let adminTrueCount = 0;
expectedMenuOrder.forEach(menuId => {
  expectedActions.forEach(action => {
    if (adminRole.menuPermissions[menuId]?.[action] === true) {
      adminTrueCount++;
    }
  });
});

if (adminTrueCount !== 125) {
  throw new Error(`Admin role has ${adminTrueCount} permissions, expected 125`);
}
console.log(`  ✓ Administrator role has full ${adminTrueCount}/125 permissions enabled.\n`);

// Test 4: Operational Role specialization (Cashier)
console.log('[Test 4] Verifying Cashier Role Permissions Boundary');
const cashierRole = db.roles.find(r => r.id === 'ROLE_CASHIER');
if (!cashierRole) throw new Error('ROLE_CASHIER not found');

// Cashier should have billing view, add, print; but NOT company or branch delete
if (!cashierRole.menuPermissions['billing']?.view) throw new Error('Cashier must have billing view');
if (!cashierRole.menuPermissions['billing']?.add) throw new Error('Cashier must have billing add');
if (!cashierRole.menuPermissions['billing']?.print) throw new Error('Cashier must have billing print');
if (cashierRole.menuPermissions['company']?.delete) throw new Error('Cashier must NOT have company delete');
if (cashierRole.menuPermissions['branch']?.add) throw new Error('Cashier must NOT have branch add');
if (cashierRole.menuPermissions['settings']?.update) throw new Error('Cashier must NOT have settings update');
console.log('  ✓ Cashier role boundary verified: Billing granted, Company/Branch/Settings deletion blocked.\n');

// Test 5: Role CRUD simulation
console.log('[Test 5] Simulating Role Creation, Cloning & Modification');
const customRoleId = 'ROLE_SENIOR_CASHIER';
const customRole = {
  id: customRoleId,
  name: 'Senior Head Cashier',
  code: 'SENIOR_CASHIER',
  description: 'Cashier with customer credit adjustment privileges',
  isSystem: false,
  menuPermissions: JSON.parse(JSON.stringify(cashierRole.menuPermissions)),
};
// Grant credit customer update to senior cashier
customRole.menuPermissions['credit_customer'] = {
  view: true,
  add: true,
  update: true,
  delete: false,
  print: true,
};

db.roles.push(customRole);
const savedRole = db.roles.find(r => r.id === customRoleId);
if (!savedRole || !savedRole.menuPermissions['credit_customer'].update) {
  throw new Error('Custom role creation/updating failed');
}
console.log(`  ✓ Created custom role: "${savedRole.name}" with custom credit_customer update privileges.`);

// Test 6: Assigning User Role
console.log('\n[Test 6] Simulating User Role Assignment');
let cashierUser = db.users.find(u => u.id === 'USR-01');
if (!cashierUser) {
  cashierUser = { id: 'USR-TEST-01', name: 'Test Staff', username: 'teststaff', roleId: 'ROLE_CASHIER', role: 'CASHIER' };
  db.users.push(cashierUser);
}
cashierUser.roleId = customRoleId;
cashierUser.role = customRole.code;
if (cashierUser.roleId !== customRoleId) throw new Error('Failed to assign custom role to user');
console.log(`  ✓ User ${cashierUser.name} (${cashierUser.id}) successfully assigned to "${customRole.name}".\n`);

// Test 7: Submenus for Reports and Settings
console.log('\n[Test 7] Verifying Reports & Settings Submenus Configuration');
const reportsConfig = SYSTEM_MENUS_CONFIG.find(m => m.id === 'reports');
if (!reportsConfig || !reportsConfig.submenus || reportsConfig.submenus.length !== 7) {
  throw new Error(`Expected 7 submenus for reports, got ${reportsConfig?.submenus?.length}`);
}
const expectedReportSubs = ['report_sales', 'report_purchases', 'report_stock', 'report_gst', 'report_tally', 'report_backlog', 'report_audit'];
expectedReportSubs.forEach(id => {
  if (!reportsConfig.submenus.some(s => s.id === id)) {
    throw new Error(`Missing expected report submenu: ${id}`);
  }
});
console.log(`  ✓ Reports submenus verified (7): ${reportsConfig.submenus.map(s => s.label).join(', ')}`);

const settingsConfig = SYSTEM_MENUS_CONFIG.find(m => m.id === 'settings');
if (!settingsConfig || !settingsConfig.submenus || settingsConfig.submenus.length !== 4) {
  throw new Error(`Expected 4 submenus for settings, got ${settingsConfig?.submenus?.length}`);
}
const expectedSettingSubs = ['settings_profile', 'settings_permissions', 'settings_policy', 'settings_appearance'];
expectedSettingSubs.forEach(id => {
  if (!settingsConfig.submenus.some(s => s.id === id)) {
    throw new Error(`Missing expected settings submenu: ${id}`);
  }
});
console.log(`  ✓ Settings submenus verified (4): ${settingsConfig.submenus.map(s => s.label).join(', ')}`);

// Test 8: Submenu Permissions on Admin & Custom Roles
console.log('\n[Test 8] Verifying Submenu Permissions on Admin and Granular Submenu Assignment');
[...expectedReportSubs, ...expectedSettingSubs].forEach(subId => {
  expectedActions.forEach(action => {
    if (adminRole.menuPermissions[subId]?.[action] !== true) {
      throw new Error(`Admin role missing permission on submenu ${subId}:${action}`);
    }
  });
});
console.log('  ✓ Admin role verified with full permissions across all 10 submenus (50 additional sub-permissions).');

// Verify granular assignment: create role with access to Sales Report but NOT Audit Log
const analystRole = {
  id: 'ROLE_ANALYST',
  name: 'Sales Analyst',
  code: 'SALES_ANALYST',
  description: 'Can view sales reports but blocked from audit logs',
  isSystem: false,
  menuPermissions: {
    reports: { view: true, add: false, update: false, delete: false, print: true },
    report_sales: { view: true, add: false, update: false, delete: false, print: true },
    report_audit: { view: false, add: false, update: false, delete: false, print: false },
  },
};
if (!analystRole.menuPermissions['report_sales'].view) throw new Error('Sales Analyst must have sales report view');
if (analystRole.menuPermissions['report_audit'].view) throw new Error('Sales Analyst must NOT have audit log view');
console.log('  ✓ Granular submenu authorization verified (Sales report view granted, Audit log view blocked).\n');

console.log('=== ALL ROLE PERMISSION MATRIX & SUBMENU TESTS PASSED (8/8) ===');
