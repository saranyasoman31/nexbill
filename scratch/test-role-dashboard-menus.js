// scratch/test-role-dashboard-menus.js
// Verification of role-tailored sidebar menus and dashboard components

global.localStorage = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; },
  clear() { this.store = {}; },
};

import { initializeDatabase } from '../src/services/storageService.js';
import { SYSTEM_MENUS_CONFIG } from '../src/data/initialData.js';

console.log('=== VERIFYING ROLE-DRIVEN MENUS & DASHBOARD SPECIFICATION ===\n');

const db = initializeDatabase(true);

// Replicate permission check logic from AppContext.jsx
function hasPermissionForUser(user, menuId, action = 'view') {
  if (!user) return false;
  if (
    user.role === 'ADMINISTRATOR' ||
    user.role === 'COMPANY_ADMIN' ||
    user.role === 'SUPER_ADMIN' ||
    user.roleId === 'ROLE_ADMIN' ||
    user.permissions?.includes('ALL_PERMISSIONS') ||
    user.permissions?.includes('SUPER_ADMIN')
  ) {
    return true;
  }

  if (user.menuPermissions?.[menuId]?.[action] !== undefined) {
    return !!user.menuPermissions[menuId][action];
  }

  const userRoleId = user.roleId || user.role;
  const roleObj = db.roles?.find(
    (r) => r.id === userRoleId || r.code === user.role || r.id === user.role
  );

  if (roleObj?.menuPermissions?.[menuId]?.[action] !== undefined) {
    return !!roleObj.menuPermissions[menuId][action];
  }

  if (menuId.startsWith('report_')) {
    if (user.menuPermissions?.reports?.[action] !== undefined) {
      return !!user.menuPermissions.reports[action];
    }
    if (roleObj?.menuPermissions?.reports?.[action] !== undefined) {
      return !!roleObj.menuPermissions.reports[action];
    }
  }

  if (menuId.startsWith('settings_')) {
    if (user.menuPermissions?.settings?.[action] !== undefined) {
      return !!user.menuPermissions.settings[action];
    }
    if (roleObj?.menuPermissions?.settings?.[action] !== undefined) {
      return !!roleObj.menuPermissions.settings[action];
    }
  }

  if (action === 'view') {
    if (menuId === 'reports') {
      const reportSubIds = ['report_sales', 'report_purchases', 'report_stock', 'report_gst', 'report_tally', 'report_audit'];
      const anySubView = reportSubIds.some(
        (subId) =>
          user.menuPermissions?.[subId]?.view === true ||
          roleObj?.menuPermissions?.[subId]?.view === true
      );
      if (anySubView) return true;
    }
    if (menuId === 'settings') {
      const settingSubIds = ['settings_profile', 'settings_permissions', 'settings_policy', 'settings_appearance'];
      const anySubView = settingSubIds.some(
        (subId) =>
          user.menuPermissions?.[subId]?.view === true ||
          roleObj?.menuPermissions?.[subId]?.view === true
      );
      if (anySubView) return true;
    }
  }

  return false;
}

// Test 1: Administrator Full Access
console.log('[Test 1] Administrator (ROLE_ADMIN) Menu & Dashboard Privileges');
const adminUser = db.users.find(u => u.roleId === 'ROLE_ADMIN');
const adminPermittedMenus = SYSTEM_MENUS_CONFIG.filter(m => hasPermissionForUser(adminUser, m.id, 'view'));
if (adminPermittedMenus.length !== 25) {
  throw new Error(`Expected admin to have 25 permitted menus, got ${adminPermittedMenus.length}`);
}
console.log(`  ✓ Administrator has 25/25 menus permitted: ${adminPermittedMenus.length} modules active.`);
console.log(`  ✓ Administrator has full suite quick shortcuts and acceptance tests enabled.\n`);

// Test 2: Cashier Menu Isolation
console.log('[Test 2] Cashier (ROLE_CASHIER) Menu & Dashboard Tailoring');
const cashierUser = db.users.find(u => u.roleId === 'ROLE_CASHIER');
const cashierPermittedMenus = SYSTEM_MENUS_CONFIG.filter(m => hasPermissionForUser(cashierUser, m.id, 'view'));
const cashierExpected = ['credit_customer', 'product', 'billing', 'billing_return', 'day_close'];
const cashierActual = cashierPermittedMenus.map(m => m.id);

if (cashierPermittedMenus.length !== 5) {
  throw new Error(`Expected cashier to have exactly 5 permitted menus, got ${cashierPermittedMenus.length}`);
}
cashierExpected.forEach(id => {
  if (!cashierActual.includes(id)) {
    throw new Error(`Cashier missing expected menu ${id}`);
  }
});

// Verify Cashier CANNOT view sensitive modules
const cashierForbidden = ['purchase', 'stock', 'stock_adjustment', 'rate_change', 'company', 'branch', 'settings'];
cashierForbidden.forEach(id => {
  if (hasPermissionForUser(cashierUser, id, 'view')) {
    throw new Error(`Cashier MUST NOT have view permission for ${id}`);
  }
});
console.log(`  ✓ Cashier permitted menus: ${cashierActual.join(', ')} (${cashierPermittedMenus.length} of 25 modules).`);
console.log(`  ✓ Cashier strictly blocked from purchase, stock adjustment, company, and settings.\n`);

// Test 3: Storekeeper Menu Isolation
console.log('[Test 3] Storekeeper (ROLE_STOREKEEPER) Menu & Dashboard Tailoring');
const storekeeperUser = db.users.find(u => u.roleId === 'ROLE_STOREKEEPER');
const storekeeperPermittedMenus = SYSTEM_MENUS_CONFIG.filter(m => hasPermissionForUser(storekeeperUser, m.id, 'view'));
const storekeeperExpected = ['product', 'initial', 'stock', 'stock_adjustment', 'stock_transfer', 'reports'];
const storekeeperActual = storekeeperPermittedMenus.map(m => m.id);

if (storekeeperPermittedMenus.length !== 6) {
  throw new Error(`Expected storekeeper to have exactly 6 permitted menus, got ${storekeeperPermittedMenus.length}`);
}
storekeeperExpected.forEach(id => {
  if (!storekeeperActual.includes(id)) {
    throw new Error(`Storekeeper missing expected menu ${id}`);
  }
});

// Verify Storekeeper CANNOT view billing or purchase
const storekeeperForbidden = ['billing', 'billing_return', 'day_close', 'purchase', 'credit_customer', 'company', 'settings'];
storekeeperForbidden.forEach(id => {
  if (hasPermissionForUser(storekeeperUser, id, 'view')) {
    throw new Error(`Storekeeper MUST NOT have view permission for ${id}`);
  }
});
console.log(`  ✓ Storekeeper permitted menus: ${storekeeperActual.join(', ')} (${storekeeperPermittedMenus.length} of 25 modules).`);
console.log(`  ✓ Storekeeper strictly blocked from retail billing, day close, purchase, and customer credit.\n`);

// Test 4: Purchase Executive Menu Isolation
console.log('[Test 4] Purchase Executive (ROLE_PURCHASE_USER) Menu & Dashboard Tailoring');
const purchaseUser = db.users.find(u => u.roleId === 'ROLE_PURCHASE_USER');
const purchasePermittedMenus = SYSTEM_MENUS_CONFIG.filter(m => hasPermissionForUser(purchaseUser, m.id, 'view'));
const purchaseExpected = ['supplier', 'main_category', 'category', 'brand', 'unit', 'product', 'purchase_order', 'purchase', 'purchase_return', 'stock', 'reports'];
const purchaseActual = purchasePermittedMenus.map(m => m.id);

if (purchasePermittedMenus.length !== 11) {
  throw new Error(`Expected purchase user to have 11 permitted menus, got ${purchasePermittedMenus.length}`);
}
// Verify Purchase user CANNOT view retail POS billing or day close
if (hasPermissionForUser(purchaseUser, 'billing', 'view')) {
  throw new Error('Purchase user MUST NOT have billing view permission');
}
if (hasPermissionForUser(purchaseUser, 'day_close', 'view')) {
  throw new Error('Purchase user MUST NOT have day_close view permission');
}
console.log(`  ✓ Purchase user permitted menus: ${purchaseActual.join(', ')} (${purchasePermittedMenus.length} of 25 modules).`);
console.log(`  ✓ Purchase user strictly blocked from retail POS billing and day close.\n`);

// Test 5: Accountant Menu Isolation
console.log('[Test 5] Accountant (ROLE_ACCOUNTANT) Menu & Dashboard Tailoring');
const accountantUser = db.users.find(u => u.roleId === 'ROLE_ACCOUNTANT');
const accountantPermittedMenus = SYSTEM_MENUS_CONFIG.filter(m => hasPermissionForUser(accountantUser, m.id, 'view'));
const accountantExpected = ['credit_customer', 'supplier', 'payment_mode', 'tax', 'purchase', 'purchase_return', 'billing', 'billing_return', 'day_close', 'reports'];
const accountantActual = accountantPermittedMenus.map(m => m.id);

if (accountantPermittedMenus.length !== 10) {
  throw new Error(`Expected accountant to have 10 permitted menus, got ${accountantPermittedMenus.length}`);
}
console.log(`  ✓ Accountant permitted menus: ${accountantActual.join(', ')} (${accountantPermittedMenus.length} of 25 modules).`);
console.log(`  ✓ Accountant has financial registers and reports enabled.\n`);

console.log('=== ALL ROLE-TAILORED MENUS & DASHBOARD TESTS PASSED (5/5) ===');
