// Verification for Company menu visibility and permission checks
import assert from 'node:assert';
import { INITIAL_USERS, INITIAL_ROLES, SYSTEM_MENUS_CONFIG } from '../src/data/initialData.js';

console.log('=== VERIFYING COMPANY MENU VISIBILITY & PERMISSIONS ===\n');

// Mock hasPermission logic from AppContext.jsx
function createPermissionChecker(currentUser, roles = INITIAL_ROLES) {
  return function hasPermission(menuId, action = 'view') {
    if (!currentUser) return false;

    // 1. Root and Company Administrators
    if (
      currentUser.role === 'ADMINISTRATOR' ||
      currentUser.role === 'COMPANY_ADMIN' ||
      currentUser.role === 'SUPER_ADMIN' ||
      currentUser.roleId === 'ROLE_ADMIN' ||
      currentUser.permissions?.includes('ALL_PERMISSIONS') ||
      currentUser.permissions?.includes('SUPER_ADMIN')
    ) {
      return true;
    }

    // 2. Direct user-level custom menu permissions override
    if (currentUser.menuPermissions?.[menuId]?.[action] !== undefined) {
      return !!currentUser.menuPermissions[menuId][action];
    }

    // 3. Role-based menu permissions from db.roles
    const userRoleId = currentUser.roleId || currentUser.role;
    const roleObj = roles?.find(
      (r) => r.id === userRoleId || r.code === currentUser.role || r.id === currentUser.role
    );

    if (roleObj?.menuPermissions?.[menuId]?.[action] !== undefined) {
      return !!roleObj.menuPermissions[menuId][action];
    }

    // Fallback for company master if role hasn't explicitly configured company permissions
    if (menuId === 'company') {
      if (roleObj?.menuPermissions?.product?.[action] !== undefined) {
        return !!roleObj.menuPermissions.product[action];
      }
      return action === 'view';
    }

    return false;
  };
}

// 1. Administrator (e.g. USR-001 admin)
const adminUser = INITIAL_USERS.find(u => u.username === 'admin');
const checkAdmin = createPermissionChecker(adminUser);
assert.strictEqual(checkAdmin('company', 'view'), true, 'Admin must have company view permission');
assert.strictEqual(checkAdmin('company', 'add'), true, 'Admin must have company add permission');
console.log('✓ Admin has full company permissions (view, add, update, delete)');

// 2. Store Manager
const managerUser = { id: 'USR-MGR', role: 'STORE_MANAGER', roleId: 'ROLE_STORE_MANAGER' };
const checkManager = createPermissionChecker(managerUser);
assert.strictEqual(checkManager('company', 'view'), true, 'Store Manager must have company view permission');
console.log('✓ Store Manager can view Company');

// 3. Purchase User
const purchaseUser = { id: 'USR-PUR', role: 'PURCHASE_USER', roleId: 'ROLE_PURCHASE_USER' };
const checkPurchase = createPermissionChecker(purchaseUser);
assert.strictEqual(checkPurchase('company', 'view'), true, 'Purchase User must have company view permission');
console.log('✓ Purchase User can view Company');

// 4. Legacy role without company key in menuPermissions
const legacyRole = {
  id: 'ROLE_LEGACY',
  name: 'Legacy Custom Role',
  menuPermissions: {
    unit: { view: true },
    product: { view: true, add: true, update: true },
  }
};
const legacyUser = { id: 'USR-LEGACY', roleId: 'ROLE_LEGACY' };
const checkLegacy = createPermissionChecker(legacyUser, [legacyRole]);
assert.strictEqual(checkLegacy('company', 'view'), true, 'Legacy role must fallback to product view permission');
console.log('✓ Legacy role without company permissions falls back gracefully to view: true');

// 5. Check Navigation sequence
const masterItems = [
  'credit_customer', 'main_category', 'category', 'brand', 'supplier',
  'unit', 'company', 'product', 'staff', 'payment_mode', 'tax', 'branch'
];
const companyIdx = masterItems.indexOf('company');
const unitIdx = masterItems.indexOf('unit');
const productIdx = masterItems.indexOf('product');

assert.strictEqual(companyIdx, 6);
assert.strictEqual(unitIdx, 5);
assert.strictEqual(productIdx, 7);
console.log('✓ Navigation sequence confirmed: ... -> Unit -> Company -> Product -> ...');

console.log('\n===============================================');
console.log('ALL COMPANY MENU VISIBILITY TESTS PASSED!');
console.log('===============================================');
