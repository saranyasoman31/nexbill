// AppContext: Multi-company, store, warehouse, user roles, authentication, notifications, and reactive state
import React, { createContext, useContext, useState, useEffect } from 'react';
import { getDatabase, saveDatabase, initializeDatabase, logAuditEvent } from '../services/storageService.js';
import { INITIAL_STATES } from '../data/initialData.js';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [db, setDb] = useState(() => getDatabase());
  const [refreshKey, setRefreshKey] = useState(0);

  // Self-heal db.states if missing or empty
  useEffect(() => {
    if (db && (!db.states || db.states.length === 0)) {
      db.states = INITIAL_STATES;
      saveDatabase(db);
      setDb({ ...db });
    }
  }, [db]);

  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('NEXBILL_AUTH_LOGGED_IN') === 'true';
  });

  // Active Context Selections
  const [currentUserId, setCurrentUserId] = useState(() => {
    return localStorage.getItem('NEXBILL_AUTH_USER_ID') || 'USR-ADMIN';
  });
  const [activeCompanyId, setActiveCompanyId] = useState('COMP-01');
  const [activeStoreId, setActiveStoreId] = useState('STR-01');
  const [activeWarehouseId, setActiveWarehouseId] = useState('WH-MUM-MAIN');

  // Active navigation tab (Default to 'dashboard')
  const [activeTab, setActiveTab] = useState('dashboard');

  // Sidebar toggle state (Desktop collapsed rail & Mobile overlay drawer)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setIsMobileSidebarOpen((prev) => !prev);
    } else {
      setIsSidebarCollapsed((prev) => !prev);
    }
  };

  // Active Master Sub-Entity, Settings Sub-Tab and Reports Sub-Tab
  const [activeMasterSubEntity, setActiveMasterSubEntity] = useState('product');
  const [settingsSubTab, setSettingsSubTab] = useState('profile');
  const [reportsSubTab, setReportsSubTab] = useState('sales');

  // Toast notifications
  const [toast, setToast] = useState(null);

  // Active modals
  const [receiptModalInvoice, setReceiptModalInvoice] = useState(null);

  // Theme Management (dark | light)
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('NEXBILL_THEME') || 'dark';
  });

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
      root.setAttribute('data-theme', 'light');
      localStorage.setItem('NEXBILL_THEME', 'light');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
      localStorage.setItem('NEXBILL_THEME', 'dark');
    }
  }, [theme]);

  const triggerRefresh = () => {
    setDb(getDatabase());
    setRefreshKey(k => k + 1);
  };

  const loginUser = (user) => {
    setCurrentUserId(user.id);
    if (user.storeId) setActiveStoreId(user.storeId);
    if (user.companyId) setActiveCompanyId(user.companyId);
    setIsAuthenticated(true);
    localStorage.setItem('NEXBILL_AUTH_LOGGED_IN', 'true');
    localStorage.setItem('NEXBILL_AUTH_USER_ID', user.id);
    setActiveTab('dashboard'); // Default landing page is dashboard
  };

  const logoutUser = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('NEXBILL_AUTH_LOGGED_IN');
    localStorage.removeItem('NEXBILL_AUTH_USER_ID');
    setActiveTab('dashboard');
  };


  const notify = (type, message, title = '') => {
    setToast({ type, message, title, id: Date.now() });
    setTimeout(() => {
      setToast(curr => (curr && curr.id === Date.now() ? null : curr));
    }, 4500);
  };

  const resetAllData = () => {
    const freshDb = initializeDatabase(true);
    setDb(freshDb);
    triggerRefresh();
    notify('success', 'Database reset to initial demo seeds successfully.', 'Reset Completed');
  };

  // Keep active warehouse aligned with selected store
  useEffect(() => {
    const storeWarehouses = db.warehouses.filter(w => w.storeId === activeStoreId && w.isSellable);
    if (storeWarehouses.length > 0 && !storeWarehouses.some(w => w.id === activeWarehouseId)) {
      setActiveWarehouseId(storeWarehouses[0].id);
    }
  }, [activeStoreId, db.warehouses]);

  // Derived objects
  const activeCompany = (db.companies && db.companies.find(c => c.id === activeCompanyId)) || db.companies?.[0] || { id: 'COMP-01', name: 'NexBill Retail', gstin: '27AAACA1234F1Z9', state: 'Maharashtra', stateCode: '27' };
  const activeStore = db.stores.find(s => s.id === activeStoreId) || db.stores[0];
  const activeWarehouse = db.warehouses.find(w => w.id === activeWarehouseId) || db.warehouses[0];
  const currentUser = db.users.find(u => u.id === currentUserId) || db.users[0];

  const availableStores = db.stores || [];
  const availableWarehouses = db.warehouses.filter(w => w.storeId === activeStoreId);

  // Role & Menu permissions checker
  const hasPermission = (menuId, action = 'view') => {
    if (!currentUser) return false;

    // 1. Root and Company Administrators have unrestricted root access
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
    const roleObj = db.roles?.find(
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

    // 4. Submenu fallback to parent menu permission
    if (menuId.startsWith('report_')) {
      if (currentUser.menuPermissions?.reports?.[action] !== undefined) {
        return !!currentUser.menuPermissions.reports[action];
      }
      if (roleObj?.menuPermissions?.reports?.[action] !== undefined) {
        return !!roleObj.menuPermissions.reports[action];
      }
    }

    if (menuId.startsWith('settings_')) {
      if (currentUser.menuPermissions?.settings?.[action] !== undefined) {
        return !!currentUser.menuPermissions.settings[action];
      }
      if (roleObj?.menuPermissions?.settings?.[action] !== undefined) {
        return !!roleObj.menuPermissions.settings[action];
      }
    }

    // 5. Parent menu view access if any of its submenus are permitted
    if (action === 'view') {
      if (menuId === 'reports') {
        const reportSubIds = ['report_sales', 'report_purchases', 'report_initial_stock', 'report_stock', 'report_gst', 'report_tally', 'report_backlog', 'report_audit'];
        const anySubView = reportSubIds.some(subId => 
          currentUser.menuPermissions?.[subId]?.view === true ||
          roleObj?.menuPermissions?.[subId]?.view === true
        );
        if (anySubView) return true;
      }
      if (menuId === 'settings') {
        const settingSubIds = ['settings_profile', 'settings_permissions', 'settings_policy', 'settings_appearance'];
        const anySubView = settingSubIds.some(subId => 
          currentUser.menuPermissions?.[subId]?.view === true ||
          roleObj?.menuPermissions?.[subId]?.view === true
        );
        if (anySubView) return true;
      }
    }

    // 6. Backward-compatible fallback for legacy permission string codes
    if (currentUser.permissions?.includes(menuId)) return true;
    if (currentUser.permissions?.includes(`${menuId}:${action}`)) return true;
    if (currentUser.permissions?.includes('ALL_STORE_OPS')) return true;

    return false;
  };

  // When active user or role permissions change, ensure current tab is accessible, else fallback to 'dashboard'
  useEffect(() => {
    if (activeTab !== 'dashboard' && activeTab !== 'tests') {
      const getMenuIdForTab = (tab) => {
        switch (tab) {
          case 'purchases': return 'purchase';
          case 'inventory': return 'stock';
          case 'adjustments': return 'stock_adjustment';
          case 'pricing': return 'rate_change';
          case 'pos': return 'billing';
          case 'invoices': return 'billing_return';
          case 'dayclose': return 'day_close';
          case 'transfers': return 'stock_transfer';
          case 'tally':
          case 'audit': return 'reports';
          case 'masters': return activeMasterSubEntity || 'product';
          default: return tab;
        }
      };
      const menuId = getMenuIdForTab(activeTab);
      if (!hasPermission(menuId, 'view')) {
        setActiveTab('dashboard');
      }
    }
  }, [currentUserId, db.roles, activeTab]);

  // Role Management API
  const saveRole = (roleData) => {
    const existingIndex = db.roles?.findIndex((r) => r.id === roleData.id);
    let updatedRoles = [...(db.roles || [])];

    if (existingIndex >= 0) {
      updatedRoles[existingIndex] = { ...updatedRoles[existingIndex], ...roleData };
      logAuditEvent('ROLE_UPDATED', currentUser?.id, `Updated role permissions for ${roleData.name} (${roleData.id})`);
      notify('success', `Role "${roleData.name}" permissions updated successfully.`, 'Role Saved');
    } else {
      updatedRoles.push(roleData);
      logAuditEvent('ROLE_CREATED', currentUser?.id, `Created new role ${roleData.name} (${roleData.id})`);
      notify('success', `Role "${roleData.name}" created successfully.`, 'Role Created');
    }

    db.roles = updatedRoles;
    saveDatabase(db);
    triggerRefresh();
    return true;
  };

  const deleteRole = (roleId) => {
    const roleToDelete = db.roles?.find((r) => r.id === roleId);
    if (!roleToDelete) return false;
    if (roleToDelete.isSystem) {
      notify('error', 'System protected roles cannot be deleted.', 'Action Forbidden');
      return false;
    }

    // Reassign any users with this role to ROLE_STORE_MANAGER or default
    db.users?.forEach((u) => {
      if (u.roleId === roleId || u.role === roleToDelete.code) {
        u.roleId = 'ROLE_STORE_MANAGER';
        u.role = 'STORE_MANAGER';
      }
    });

    db.roles = db.roles.filter((r) => r.id !== roleId);
    saveDatabase(db);
    logAuditEvent('ROLE_DELETED', currentUser?.id, `Deleted role ${roleToDelete.name} (${roleId})`);
    notify('warning', `Role "${roleToDelete.name}" deleted.`, 'Role Removed');
    triggerRefresh();
    return true;
  };

  const assignUserRole = (userId, newRoleId, customPermissions = null) => {
    const targetUser = db.users?.find((u) => u.id === userId);
    const targetRole = db.roles?.find((r) => r.id === newRoleId);
    if (!targetUser || !targetRole) return false;

    targetUser.roleId = newRoleId;
    targetUser.role = targetRole.code || targetRole.name;
    if (customPermissions !== null) {
      targetUser.menuPermissions = customPermissions;
    }

    saveDatabase(db);
    logAuditEvent(
      'USER_ROLE_ASSIGNED',
      currentUser?.id,
      `Assigned role ${targetRole.name} to user ${targetUser.name} (${userId})`
    );
    notify('success', `Role "${targetRole.name}" assigned to ${targetUser.name}.`, 'Role Assigned');
    triggerRefresh();
    return true;
  };


  return (
    <AppContext.Provider
      value={{
        db,
        refreshKey,
        triggerRefresh,
        isAuthenticated,
        loginUser,
        logoutUser,
        activeCompanyId,
        setActiveCompanyId,
        activeStoreId,
        setActiveStoreId,
        activeWarehouseId,
        setActiveWarehouseId,
        currentUserId,
        setCurrentUserId,
        activeCompany,
        activeStore,
        activeWarehouse,
        currentUser,
        availableStores,
        availableWarehouses,
        activeTab,
        setActiveTab,
        isSidebarCollapsed,
        setIsSidebarCollapsed,
        isMobileSidebarOpen,
        setIsMobileSidebarOpen,
        toggleSidebar,
        activeMasterSubEntity,
        setActiveMasterSubEntity,
        settingsSubTab,
        setSettingsSubTab,
        reportsSubTab,
        setReportsSubTab,
        toast,
        setToast,
        notify,
        receiptModalInvoice,
        setReceiptModalInvoice,
        resetAllData,
        hasPermission,
        saveRole,
        deleteRole,
        assignUserRole,
        theme,
        setTheme,
        toggleTheme,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
}
