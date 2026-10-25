// SettingsView: System Settings including User Profile, User Permissions, System Policy & Theme
import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { saveDatabase, logAuditEvent } from '../../services/storageService.js';
import {
  SYSTEM_MENUS_CONFIG,
  PERMISSION_ACTIONS,
  createRolePermissions,
  INITIAL_ROLES,
  DEFAULT_PO_TERMS,
} from '../../data/initialData.js';
import {
  Settings,
  User,
  ShieldCheck,
  Sliders,
  DollarSign,
  Gift,
  Key,
  Users,
  RotateCcw,
  Save,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Store,
  Warehouse,
  Check,
  X,
  Mail,
  Phone,
  Sun,
  Moon,
  Palette,
  Eye,
  Plus,
  Trash2,
  Printer,
  Edit2,
  Search,
  PlusCircle,
  Copy,
  CreditCard,
  Layers,
  FolderTree,
  Tag,
  Truck,
  Scale,
  Building2,
  Package,
  WalletCards,
  Percent,
  ClipboardList,
  ShoppingBag,
  Boxes,
  Archive,
  ClipboardCheck,
  BadgePercent,
  ShoppingCart,
  Undo2,
  Calculator,
  FileText,
  ArrowLeftRight,
  BarChart3,
  ShieldAlert,
  DownloadCloud,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Camera,
  Upload,
} from 'lucide-react';
import ExportButtons from '../common/ExportButtons.jsx';

const MENU_ICONS = {
  credit_customer: CreditCard,
  main_category: Layers,
  category: FolderTree,
  brand: Tag,
  supplier: Truck,
  unit: Scale,
  company: Building2,
  product: Package,
  staff: Users,
  payment_mode: WalletCards,
  tax: Percent,
  branch: Store,
  purchase_order: ClipboardList,
  purchase: ShoppingBag,
  purchase_return: RotateCcw,
  initial: Boxes,
  stock: Archive,
  stock_adjustment: ClipboardCheck,
  rate_change: BadgePercent,
  billing: ShoppingCart,
  billing_return: Undo2,
  day_close: Calculator,
  stock_transfer: ArrowLeftRight,
  reports: BarChart3,
  settings: Settings,

  // Report Submenus
  report_sales: ShoppingCart,
  report_purchases: Truck,
  report_stock: Boxes,
  report_gst: Percent,
  report_tally: DownloadCloud,
  report_audit: ShieldAlert,

  // Settings Submenus
  settings_profile: User,
  settings_permissions: ShieldCheck,
  settings_policy: Sparkles,
  settings_appearance: Palette,
};

export default function SettingsView({ initialSubTab = 'profile' }) {
  const {
    db,
    currentUser,
    activeStore,
    activeWarehouse,
    notify,
    triggerRefresh,
    theme,
    setTheme,
    toggleTheme,
    saveRole,
    deleteRole,
    assignUserRole,
  } = useApp();

  const [activeTab, setActiveTab] = useState(initialSubTab); // profile | permissions | policy | appearance

  useEffect(() => {
    if (initialSubTab) {
      setActiveTab(initialSubTab);
    }
  }, [initialSubTab]);

  // Profile Form State
  const [profileData, setProfileData] = useState({
    name: currentUser?.name || 'System Administrator',
    email: currentUser?.email || 'admin@nexbill.com',
    username: currentUser?.username || 'admin',
    avatar: currentUser?.avatar || '👑',
    photo: currentUser?.photo || '',
    phone: currentUser?.phone || '+91 98200 44556',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 3 * 1024 * 1024) {
        notify('warning', 'Profile photo size exceeds 3MB.', 'File Size Warning');
      }
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        setProfileData((prev) => ({ ...prev, photo: uploadEvent.target.result }));
        notify('success', 'Profile photo loaded.', 'Photo Ready');
      };
      reader.readAsDataURL(file);
    }
  };

  // User Permissions Management State
  const [selectedUserId, setSelectedUserId] = useState(currentUser?.id || 'USR-ADMIN');

  // Policy Settings State
  const [settings, setSettings] = useState({
    blockNegativeStock: db.settings?.blockNegativeStock ?? true,
    costingMethod: db.settings?.costingMethod || 'WEIGHTED_AVERAGE',
    allowBackdatedSales: db.settings?.allowBackdatedSales ?? false,
    requireReceiptForReturn: db.settings?.requireReceiptForReturn ?? true,
    managerApprovalThresholdQty: db.settings?.managerApprovalThresholdQty ?? 10,
    managerApprovalThresholdAmount: db.settings?.managerApprovalThresholdAmount ?? 1000,
    maxDiscountPercentWithoutApproval: db.settings?.maxDiscountPercentWithoutApproval ?? 10,
    maxCashVarianceAllowed: db.settings?.maxCashVarianceAllowed ?? 100,
    loyaltyEarningRatio: db.settings?.loyaltyEarningRatio ?? 100,
    loyaltyRedemptionRate: db.settings?.loyaltyRedemptionRate ?? 1,
    maxLoyaltyRedemptionPercent: db.settings?.maxLoyaltyRedemptionPercent ?? 20,
    pointsExpiryDays: db.settings?.pointsExpiryDays ?? 365,
    ewayBillThreshold: db.settings?.ewayBillThreshold ?? 50000,
    roundOffPolicy: db.settings?.roundOffPolicy || 'NEAREST_RUPEE',
    defaultPOTerms: db.settings?.defaultPOTerms || DEFAULT_PO_TERMS,
    purchaseProductFilterMode: db.settings?.purchaseProductFilterMode || 'all',
  });

  // Handle Profile Update
  const handleSaveProfile = (e) => {
    e.preventDefault();
    if (profileData.newPassword && profileData.newPassword !== profileData.confirmPassword) {
      notify('error', 'New passwords do not match.', 'Password Mismatch');
      return;
    }

    const user = db.users.find((u) => u.id === currentUser.id);
    if (user) {
      user.name = profileData.name;
      user.email = profileData.email;
      user.username = profileData.username;
      user.avatar = profileData.avatar;
      user.photo = profileData.photo;
      user.phone = profileData.phone;
      saveDatabase(db);
      logAuditEvent('PROFILE_UPDATED', currentUser.id, `User profile updated for ${user.name}`);
      notify('success', 'Profile and security credentials updated.', 'Profile Saved');
      triggerRefresh();
    }
  };

  // Permissions & Roles Management State
  const [permissionSubView, setPermissionSubView] = useState('roles'); // 'roles' | 'users'
  const [selectedRoleId, setSelectedRoleId] = useState(() => db.roles?.[0]?.id || 'ROLE_ADMIN');
  const [rolePermissionsDraft, setRolePermissionsDraft] = useState({});
  const [isDirty, setIsDirty] = useState(false);
  const [menuSearch, setMenuSearch] = useState('');
  const [menuGroupFilter, setMenuGroupFilter] = useState('ALL');
  const [isCreateRoleModalOpen, setIsCreateRoleModalOpen] = useState(false);
  const [newRoleForm, setNewRoleForm] = useState({
    name: '',
    code: '',
    description: '',
  });

  const rolesList = useMemo(() => {
    return db.roles && db.roles.length > 0 ? db.roles : INITIAL_ROLES;
  }, [db.roles]);

  const selectedRole = useMemo(() => {
    return rolesList.find((r) => r.id === selectedRoleId) || rolesList[0];
  }, [rolesList, selectedRoleId]);

  // Sync draft when selected role changes
  useEffect(() => {
    if (selectedRole?.menuPermissions) {
      setRolePermissionsDraft(JSON.parse(JSON.stringify(selectedRole.menuPermissions)));
      setIsDirty(false);
    }
  }, [selectedRole]);

  // Expand/collapse state for menus with submenus
  const [expandedSubmenus, setExpandedSubmenus] = useState({
    reports: true,
    settings: true,
  });

  const toggleSubmenuExpand = (menuId) => {
    setExpandedSubmenus((prev) => ({
      ...prev,
      [menuId]: !prev[menuId],
    }));
  };

  // Handle cell toggle (View, Add, Update, Delete, Print)
  const handleToggleCell = (menuId, action) => {
    if (selectedRole?.isSystem && selectedRole.id === 'ROLE_ADMIN') {
      notify('info', 'Administrator role maintains unrestricted access across all menus.', 'Root Access');
      return;
    }
    setRolePermissionsDraft((prev) => {
      const currentVal = prev[menuId]?.[action] ?? false;
      const targetVal = !currentVal;
      const next = {
        ...prev,
        [menuId]: {
          ...(prev[menuId] || {}),
          [action]: targetVal,
        },
      };

      // If toggling on a submenu action, ensure parent view is enabled so the menu is accessible
      if (targetVal && (menuId.startsWith('report_') || menuId.startsWith('settings_'))) {
        const parentId = menuId.startsWith('report_') ? 'reports' : 'settings';
        if (!next[parentId]?.view) {
          next[parentId] = {
            ...(next[parentId] || {}),
            view: true,
          };
        }
      }

      return next;
    });
    setIsDirty(true);
  };

  // Common Checkbox: Toggle all 5 actions for a menu (and its submenus if applicable)
  const handleToggleCommon = (menuId, submenus = null) => {
    if (selectedRole?.isSystem && selectedRole.id === 'ROLE_ADMIN') {
      notify('info', 'Administrator role maintains unrestricted access across all menus.', 'Root Access');
      return;
    }

    const currentPerm = rolePermissionsDraft[menuId] || {};
    const isCurrentlyFull = PERMISSION_ACTIONS.every((a) => !!currentPerm[a]);
    const targetVal = !isCurrentlyFull;

    setRolePermissionsDraft((prev) => {
      const next = { ...prev };
      next[menuId] = {
        view: targetVal,
        add: targetVal,
        update: targetVal,
        delete: targetVal,
        print: targetVal,
      };

      if (submenus && Array.isArray(submenus)) {
        submenus.forEach((sub) => {
          next[sub.id] = {
            view: targetVal,
            add: targetVal,
            update: targetVal,
            delete: targetVal,
            print: targetVal,
          };
        });
      }

      // If toggling on a submenu common checkbox, ensure parent view is enabled
      if (targetVal && (menuId.startsWith('report_') || menuId.startsWith('settings_'))) {
        const parentId = menuId.startsWith('report_') ? 'reports' : 'settings';
        if (!next[parentId]?.view) {
          next[parentId] = {
            ...(next[parentId] || {}),
            view: true,
          };
        }
      }

      return next;
    });
    setIsDirty(true);
  };

  // Helper checks for checkbox visual states
  const isItemFullyChecked = (id) => {
    const perms = rolePermissionsDraft[id] || {};
    return PERMISSION_ACTIONS.every((a) => !!perms[a]);
  };

  const isItemPartiallyChecked = (id) => {
    const perms = rolePermissionsDraft[id] || {};
    const trueCount = PERMISSION_ACTIONS.filter((a) => !!perms[a]).length;
    return trueCount > 0 && trueCount < PERMISSION_ACTIONS.length;
  };

  const isParentFullyChecked = (menu) => {
    if (!isItemFullyChecked(menu.id)) return false;
    if (menu.submenus && menu.submenus.length > 0) {
      return menu.submenus.every((sub) => isItemFullyChecked(sub.id));
    }
    return true;
  };

  const isParentPartiallyChecked = (menu) => {
    if (isParentFullyChecked(menu)) return false;
    if (isItemPartiallyChecked(menu.id) || isItemFullyChecked(menu.id)) return true;
    if (menu.submenus && menu.submenus.length > 0) {
      return menu.submenus.some(
        (sub) => isItemFullyChecked(sub.id) || isItemPartiallyChecked(sub.id)
      );
    }
    return false;
  };

  // Handle column toggle (All View, All Add, etc.)
  const handleColumnToggle = (action) => {
    if (selectedRole?.isSystem && selectedRole.id === 'ROLE_ADMIN') {
      notify('info', 'Administrator role maintains unrestricted access across all menus.', 'Root Access');
      return;
    }
    let allActive = true;
    filteredMenus.forEach((m) => {
      if (!rolePermissionsDraft[m.id]?.[action]) allActive = false;
      if (m.submenus) {
        m.submenus.forEach((sub) => {
          if (!rolePermissionsDraft[sub.id]?.[action]) allActive = false;
        });
      }
    });
    const targetVal = !allActive;

    setRolePermissionsDraft((prev) => {
      const next = { ...prev };
      filteredMenus.forEach((m) => {
        next[m.id] = {
          ...(next[m.id] || {}),
          [action]: targetVal,
        };
        if (m.submenus) {
          m.submenus.forEach((sub) => {
            next[sub.id] = {
              ...(next[sub.id] || {}),
              [action]: targetVal,
            };
          });
        }
      });
      return next;
    });
    setIsDirty(true);
  };

  // Handle global toggle (Grant All / Clear All)
  const handleGlobalToggle = (val) => {
    if (selectedRole?.isSystem && selectedRole.id === 'ROLE_ADMIN') {
      notify('info', 'Administrator role retains unrestricted access across all menus.', 'Root Access');
      return;
    }
    setRolePermissionsDraft((prev) => {
      const next = {};
      SYSTEM_MENUS_CONFIG.forEach((m) => {
        next[m.id] = {
          view: val,
          add: val,
          update: val,
          delete: val,
          print: val,
        };
        if (m.submenus) {
          m.submenus.forEach((sub) => {
            next[sub.id] = {
              view: val,
              add: val,
              update: val,
              delete: val,
              print: val,
            };
          });
        }
      });
      return next;
    });
    setIsDirty(true);
  };

  // Save current role permissions
  const handleSaveRolePermissions = () => {
    if (selectedRole?.isSystem && selectedRole.id === 'ROLE_ADMIN') {
      notify('info', 'Administrator role retains full permissions.', 'Root Access');
      return;
    }
    const updated = {
      ...selectedRole,
      menuPermissions: rolePermissionsDraft,
    };
    saveRole(updated);
    setIsDirty(false);
  };

  // Create new role
  const handleCreateNewRole = (e) => {
    e.preventDefault();
    if (!newRoleForm.name.trim()) {
      notify('error', 'Please enter a role name.', 'Validation Error');
      return;
    }

    const roleCode =
      newRoleForm.code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_') ||
      newRoleForm.name.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');

    // Fresh empty role permissions ready for configuration in the matrix
    const initialPermissions = createRolePermissions(false);

    const newRole = {
      id: 'ROLE_' + Date.now(),
      code: roleCode,
      name: newRoleForm.name.trim(),
      description: newRoleForm.description.trim() || 'Custom operational role',
      isSystem: false,
      menuPermissions: initialPermissions,
    };

    saveRole(newRole);
    setSelectedRoleId(newRole.id);
    setRolePermissionsDraft(initialPermissions);
    setIsCreateRoleModalOpen(false);
    setNewRoleForm({
      name: '',
      code: '',
      description: '',
    });
    notify('success', `Role "${newRole.name}" created. You can now select menu permissions below.`, 'Role Created');
  };

  // Delete custom role
  const handleDeleteRole = (roleId) => {
    const role = rolesList.find((r) => r.id === roleId);
    if (!role) return;
    if (role.isSystem) {
      notify('error', 'System protected roles cannot be deleted.', 'Action Forbidden');
      return;
    }
    if (window.confirm(`Are you sure you want to delete role "${role.name}"? Users assigned to this role will be reassigned.`)) {
      deleteRole(roleId);
      setSelectedRoleId('ROLE_ADMIN');
    }
  };

  // Filtered menus for matrix
  const filteredMenus = useMemo(() => {
    return SYSTEM_MENUS_CONFIG.filter((m) => {
      if (menuGroupFilter !== 'ALL' && m.group !== menuGroupFilter) {
        return false;
      }
      if (menuSearch.trim()) {
        const query = menuSearch.trim().toLowerCase();
        const matchesParent =
          m.label.toLowerCase().includes(query) ||
          m.group.toLowerCase().includes(query) ||
          m.id.toLowerCase().includes(query);
        const matchesSubmenu = m.submenus?.some(
          (s) =>
            s.label.toLowerCase().includes(query) ||
            s.id.toLowerCase().includes(query)
        );
        return matchesParent || matchesSubmenu;
      }
      return true;
    });
  }, [menuSearch, menuGroupFilter]);

  // Distinct menu groups for category filter tabs
  const menuGroupsList = useMemo(() => {
    const set = new Set();
    SYSTEM_MENUS_CONFIG.forEach((m) => set.add(m.group));
    return ['ALL', ...Array.from(set)];
  }, []);

  // Total possible permissions count (including all submenus)
  const totalItemsCount = useMemo(() => {
    let count = 0;
    SYSTEM_MENUS_CONFIG.forEach((m) => {
      count++;
      if (m.submenus) count += m.submenus.length;
    });
    return count * 5;
  }, []);

  // Granted count for selected role
  const grantedCount = useMemo(() => {
    if (!rolePermissionsDraft) return 0;
    let count = 0;
    Object.values(rolePermissionsDraft).forEach((m) => {
      if (m.view) count++;
      if (m.add) count++;
      if (m.update) count++;
      if (m.delete) count++;
      if (m.print) count++;
    });
    return count;
  }, [rolePermissionsDraft]);

  // Master header common checkbox status
  const isMasterFullyChecked = useMemo(() => {
    if (filteredMenus.length === 0) return false;
    return filteredMenus.every((m) => isParentFullyChecked(m));
  }, [filteredMenus, rolePermissionsDraft]);

  const isMasterPartiallyChecked = useMemo(() => {
    if (isMasterFullyChecked) return false;
    return filteredMenus.some((m) => isParentPartiallyChecked(m) || isParentFullyChecked(m));
  }, [filteredMenus, rolePermissionsDraft, isMasterFullyChecked]);

  // Toggle master common checkbox in header
  const handleToggleMasterCommon = () => {
    if (selectedRole?.isSystem && selectedRole.id === 'ROLE_ADMIN') {
      notify('info', 'Administrator role maintains unrestricted access across all menus.', 'Root Access');
      return;
    }
    const targetVal = !isMasterFullyChecked;
    setRolePermissionsDraft((prev) => {
      const next = { ...prev };
      filteredMenus.forEach((m) => {
        next[m.id] = {
          view: targetVal,
          add: targetVal,
          update: targetVal,
          delete: targetVal,
          print: targetVal,
        };
        if (m.submenus) {
          m.submenus.forEach((sub) => {
            next[sub.id] = {
              view: targetVal,
              add: targetVal,
              update: targetVal,
              delete: targetVal,
              print: targetVal,
            };
          });
        }
      });
      return next;
    });
    setIsDirty(true);
  };

  const handleSavePolicySettings = (e) => {
    e.preventDefault();
    db.settings = { ...settings };
    saveDatabase(db);
    logAuditEvent('SETTINGS_UPDATED', currentUser.id, 'System policies updated');
    notify('success', 'Transaction rules and system settings saved.', 'Settings Updated');
    triggerRefresh();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-3 rounded-xl shadow-md">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-indigo-400" />
          <div>
            <h3 className="font-bold text-white text-sm">NexBill System Settings</h3>
            <p className="text-[11px] text-slate-400">
              User Profile, Granular User Permissions (RBAC) & ERP Transaction Policies
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-lg bg-indigo-950/70 border border-indigo-700/60 text-indigo-300 text-xs font-semibold flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Administrator Authorized</span>
          </span>
        </div>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto text-xs font-medium">
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
            activeTab === 'profile'
              ? 'bg-indigo-600 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <User className="w-4 h-4" />
          <span>Profile & Security</span>
        </button>

        <button
          onClick={() => setActiveTab('permissions')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
            activeTab === 'permissions'
              ? 'bg-indigo-600 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>User Permissions & Roles</span>
        </button>

        <button
          onClick={() => setActiveTab('policy')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
            activeTab === 'policy'
              ? 'bg-indigo-600 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>System Policies & Rules</span>
        </button>

        <button
          onClick={() => setActiveTab('appearance')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
            activeTab === 'appearance'
              ? 'bg-indigo-600 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Palette className="w-4 h-4" />
          <span>Theme & Appearance</span>
        </button>
      </div>

      {/* 1. PROFILE & SECURITY TAB */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* User Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 text-center">
            <div className="inline-flex h-20 w-20 rounded-2xl bg-indigo-950/80 border border-indigo-500/40 items-center justify-center text-4xl shadow-xl overflow-hidden mx-auto">
              {profileData.photo ? (
                <img src={profileData.photo} alt={currentUser?.name} className="w-full h-full object-cover" />
              ) : (
                <User className="w-10 h-10 text-indigo-400" />
              )}
            </div>
            <div>
              <h4 className="font-bold text-white text-base">{currentUser?.name}</h4>
              <p className="text-xs text-indigo-400 font-mono font-semibold">{currentUser?.role.replace(/_/g, ' ')}</p>
              <p className="text-[11px] text-slate-400 mt-1">{currentUser?.email}</p>
            </div>

            <div className="pt-3 border-t border-slate-800 text-left space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Active Branch:</span>
                <span className="font-semibold text-slate-200">{activeStore?.name}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Active Warehouse:</span>
                <span className="font-semibold text-slate-200">{activeWarehouse?.name}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Terminal Status:</span>
                <span className="font-semibold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Online / Secure
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-400 pt-1.5 border-t border-slate-800/80">
                <span>Visual Theme:</span>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 border border-slate-700 text-slate-200 hover:text-white flex items-center gap-1 transition"
                  title="Toggle Light / Dark mode"
                >
                  {theme === 'dark' ? <Moon className="w-3 h-3 text-indigo-400" /> : <Sun className="w-3 h-3 text-amber-500" />}
                  <span>{theme === 'dark' ? 'Dark' : 'Light'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Edit Profile Form */}
          <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="border-b border-slate-800 pb-2">
              <h4 className="font-bold text-white text-sm flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-400" />
                Edit User Profile & Credentials
              </h4>
              <p className="text-[11px] text-slate-400">Update operator display name, contact phone & password</p>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-300 block">Full Name</label>
                  <input
                    type="text"
                    required
                    value={profileData.name}
                    onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-300 block">Username</label>
                  <input
                    type="text"
                    required
                    value={profileData.username}
                    onChange={(e) => setProfileData({ ...profileData, username: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-indigo-500 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-300 block">Email Address</label>
                  <input
                    type="email"
                    required
                    value={profileData.email}
                    onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-indigo-500"
                  />
                </div>

                <div className="col-span-2 space-y-1">
                  <label className="font-semibold text-slate-300 block">Phone Number</label>
                  <input
                    type="text"
                    value={profileData.phone}
                    onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Profile Photo Upload Section */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <span className="font-bold text-white text-xs flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-indigo-400" />
                  Profile Photo
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow transition">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoUpload}
                    />
                  </label>
                  <div className="flex-1 min-w-[200px]">
                    <input
                      type="url"
                      placeholder="Or enter image URL (https://...)"
                      value={profileData.photo || ''}
                      onChange={(e) => setProfileData({ ...profileData, photo: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 text-xs focus:border-indigo-500"
                    />
                  </div>
                  {profileData.photo && (
                    <button
                      type="button"
                      onClick={() => setProfileData({ ...profileData, photo: '' })}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 hover:text-rose-300 text-slate-400 text-xs transition"
                    >
                      Clear Photo
                    </button>
                  )}
                </div>
              </div>

              {/* Password Change */}
              <div className="pt-3 border-t border-slate-800 space-y-2">
                <span className="font-bold text-white text-xs flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-indigo-400" />
                  Change Terminal Sign-In Password
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-300 block">New Password</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={profileData.newPassword}
                      onChange={(e) => setProfileData({ ...profileData, newPassword: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-300 block">Confirm New Password</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={profileData.confirmPassword}
                      onChange={(e) => setProfileData({ ...profileData, confirmPassword: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold shadow-md shadow-indigo-600/30 transition flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" /> Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. USER PERMISSIONS & ROLES TAB */}
      {activeTab === 'permissions' && (
        <div className="space-y-4">
          {/* Top Actions & Segmented Navigation */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-400" />
                  Role-Based Access Control (RBAC) & Menu Permissions
                </h4>
                <p className="text-[11px] text-slate-400">
                  Manage roles and choose permissions for every menu (View, Add, Update, Delete, Print)
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateRoleModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-indigo-600/30 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add New Role</span>
                </button>
              </div>
            </div>

            {/* Sub-View Switcher: [Role Permission Matrix] | [User Role Assignment] */}
            <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
              <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setPermissionSubView('roles')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                    permissionSubView === 'roles'
                      ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Configure Role Permissions</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPermissionSubView('users')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                    permissionSubView === 'users'
                      ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Assign Roles to Staff / Users ({db.users?.length || 0})</span>
                </button>
              </div>

              {permissionSubView === 'roles' && (
                <div className="flex items-center gap-2">
                  {isDirty && (
                    <span className="text-[11px] text-amber-400 font-medium animate-pulse flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Unsaved changes in draft
                    </span>
                  )}
                  <ExportButtons
                    data={(() => {
                      const list = [];
                      filteredMenus.forEach((m, i) => {
                        const p = rolePermissionsDraft[m.id] || {};
                        list.push({
                          index: `${i + 1}`,
                          menu: m.label,
                          view: p.view ? 'YES' : 'NO',
                          add: p.add ? 'YES' : 'NO',
                          update: p.update ? 'YES' : 'NO',
                          delete: p.delete ? 'YES' : 'NO',
                          print: p.print ? 'YES' : 'NO',
                        });
                        if (m.submenus) {
                          m.submenus.forEach((s, si) => {
                            const sp = rolePermissionsDraft[s.id] || {};
                            list.push({
                              index: `${i + 1}.${si + 1}`,
                              menu: `  ↳ ${s.label}`,
                              view: sp.view ? 'YES' : 'NO',
                              add: sp.add ? 'YES' : 'NO',
                              update: sp.update ? 'YES' : 'NO',
                              delete: sp.delete ? 'YES' : 'NO',
                              print: sp.print ? 'YES' : 'NO',
                            });
                          });
                        }
                      });
                      return list;
                    })()}
                    columns={[
                      { header: '#', key: 'index' },
                      { header: 'Menu / Module', key: 'menu' },
                      { header: 'View', key: 'view' },
                      { header: 'Add', key: 'add' },
                      { header: 'Update', key: 'update' },
                      { header: 'Delete', key: 'delete' },
                      { header: 'Print', key: 'print' },
                    ]}
                    filename={`Role_Permissions_${selectedRole?.code || selectedRoleId}`}
                    title={`Role Permissions Matrix - ${selectedRole?.name} (${selectedRole?.code})`}
                    subtitle={`NexBill ERP RBAC Configuration | Exported: ${new Date().toLocaleDateString()}`}
                    size="small"
                  />
                  <button
                    type="button"
                    onClick={handleSaveRolePermissions}
                    disabled={selectedRole?.isSystem && selectedRole.id === 'ROLE_ADMIN'}
                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold shadow-md transition ${
                      selectedRole?.isSystem && selectedRole.id === 'ROLE_ADMIN'
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                        : isDirty
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
                    }`}
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Role Permissions</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* VIEW A: CONFIGURE ROLE PERMISSIONS (MATRIX TABLE) */}
          {permissionSubView === 'roles' && (
            <div className="space-y-3">
              {/* Role Selection Carousel / Pills */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-2">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
                  Select Role to Configure:
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin text-xs">
                  {rolesList.map((role) => {
                    const isSelected = selectedRoleId === role.id;
                    return (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => setSelectedRoleId(role.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left whitespace-nowrap transition ${
                          isSelected
                            ? 'bg-indigo-950/80 border-indigo-500 text-white shadow-md shadow-indigo-500/10'
                            : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/40'
                        }`}
                      >
                        <ShieldCheck
                          className={`w-4 h-4 shrink-0 ${
                            isSelected ? 'text-indigo-400' : 'text-slate-500'
                          }`}
                        />
                        <div>
                          <div className="font-bold text-xs flex items-center gap-1.5">
                            <span>{role.name}</span>
                            {role.isSystem && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-900/60 text-indigo-300 border border-indigo-700/60">
                                System
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {role.code}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active Role Meta Banner */}
              <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-white">{selectedRole.name}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-950 text-indigo-300 border border-indigo-700/60">
                      {selectedRole.code}
                    </span>
                    <span
                      className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold border ${
                        selectedRole.isSystem
                          ? 'bg-slate-800 text-slate-300 border-slate-700'
                          : 'bg-indigo-950/60 text-indigo-300 border-indigo-700/50'
                      }`}
                    >
                      {selectedRole.isSystem ? 'System Default' : 'Custom Role'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">{selectedRole.description}</p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Permissions Granted</div>
                    <div className="font-bold text-sm text-indigo-300 font-mono">
                      {grantedCount} <span className="text-xs text-slate-500">/ {totalItemsCount} ({Math.round((grantedCount / (totalItemsCount || 1)) * 100)}%)</span>
                    </div>
                  </div>

                  {!selectedRole.isSystem && (
                    <button
                      type="button"
                      onClick={() => handleDeleteRole(selectedRole.id)}
                      className="p-2 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 transition"
                      title="Delete this custom role"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Root Administrator Notice */}
              {selectedRole?.isSystem && selectedRole.id === 'ROLE_ADMIN' && (
                <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-xs text-emerald-200 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      <strong>Root Administrator Access:</strong> All 25 primary menus and their submenus are permanently authorized for the Administrator role to protect full system access.
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-900/80 text-emerald-300 font-bold text-[10px] border border-emerald-600/50">
                    {totalItemsCount} / {totalItemsCount} Active
                  </span>
                </div>
              )}

              {/* Matrix Filter & Column Batch Controls */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  {/* Category Filter Pills */}
                  <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-full scrollbar-none">
                    {menuGroupsList.map((grp) => (
                      <button
                        key={grp}
                        type="button"
                        onClick={() => setMenuGroupFilter(grp)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] whitespace-nowrap transition font-medium ${
                          menuGroupFilter === grp
                            ? 'bg-indigo-600 text-white font-bold'
                            : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {grp}
                      </button>
                    ))}
                  </div>

                  {/* Search input */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Filter menu name..."
                      value={menuSearch}
                      onChange={(e) => setMenuSearch(e.target.value)}
                      className="bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-48"
                    />
                  </div>
                </div>

                {/* Batch Actions Bar */}
                <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mr-1">
                      Column Toggles:
                    </span>
                    <button
                      type="button"
                      onClick={() => handleColumnToggle('view')}
                      className="px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-semibold flex items-center gap-1 transition"
                    >
                      <Eye className="w-3 h-3 text-emerald-400" /> Toggle View
                    </button>
                    <button
                      type="button"
                      onClick={() => handleColumnToggle('add')}
                      className="px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-semibold flex items-center gap-1 transition"
                    >
                      <PlusCircle className="w-3 h-3 text-indigo-400" /> Toggle Add
                    </button>
                    <button
                      type="button"
                      onClick={() => handleColumnToggle('update')}
                      className="px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-semibold flex items-center gap-1 transition"
                    >
                      <Edit2 className="w-3 h-3 text-blue-400" /> Toggle Update
                    </button>
                    <button
                      type="button"
                      onClick={() => handleColumnToggle('delete')}
                      className="px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-semibold flex items-center gap-1 transition"
                    >
                      <Trash2 className="w-3 h-3 text-rose-400" /> Toggle Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => handleColumnToggle('print')}
                      className="px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-semibold flex items-center gap-1 transition"
                    >
                      <Printer className="w-3 h-3 text-amber-400" /> Toggle Print
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleGlobalToggle(true)}
                      className="px-2.5 py-0.5 rounded bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-300 text-[11px] font-bold transition"
                    >
                      Grant All ({totalItemsCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => handleGlobalToggle(false)}
                      className="px-2.5 py-0.5 rounded bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-white text-[11px] font-semibold transition"
                    >
                      Clear All
                    </button>
                  </div>
                </div>
              </div>

              {/* Permission Matrix Table */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-950 text-slate-300 text-[11px] font-bold border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3 w-10 text-center text-slate-500">#</th>
                        <th className="py-2.5 px-3 min-w-[200px]">Menu / Module</th>

                        {/* Common Master Checkbox Header */}
                        <th className="py-2.5 px-3 text-center w-24">
                          <div className="flex flex-col items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={handleToggleMasterCommon}
                              title={
                                isMasterFullyChecked
                                  ? 'Clear all permissions across all menus and submenus'
                                  : 'Grant all permissions across all menus and submenus'
                              }
                              className={`w-7 h-7 rounded-lg flex items-center justify-center border transition ${
                                isMasterFullyChecked
                                  ? 'bg-indigo-600 border-indigo-400 text-white shadow-sm ring-1 ring-indigo-400'
                                  : isMasterPartiallyChecked
                                  ? 'bg-indigo-950/80 border-indigo-500 text-indigo-400'
                                  : 'bg-slate-950 border-slate-800 text-slate-600 hover:border-slate-700 hover:text-slate-300'
                              }`}
                            >
                              {isMasterFullyChecked ? (
                                <Check className="w-4 h-4 stroke-[3]" />
                              ) : isMasterPartiallyChecked ? (
                                <div className="w-2.5 h-0.5 bg-indigo-400 rounded-full" />
                              ) : (
                                <X className="w-3.5 h-3.5 opacity-30" />
                              )}
                            </button>
                            <span className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider">
                              All Access
                            </span>
                          </div>
                        </th>

                        <th className="py-2.5 px-3 text-center w-28">
                          <div className="flex items-center justify-center gap-1.5 text-emerald-400">
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                          </div>
                        </th>
                        <th className="py-2.5 px-3 text-center w-28">
                          <div className="flex items-center justify-center gap-1.5 text-indigo-400">
                            <PlusCircle className="w-3.5 h-3.5" />
                            <span>Add</span>
                          </div>
                        </th>
                        <th className="py-2.5 px-3 text-center w-28">
                          <div className="flex items-center justify-center gap-1.5 text-blue-400">
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Update</span>
                          </div>
                        </th>
                        <th className="py-2.5 px-3 text-center w-28">
                          <div className="flex items-center justify-center gap-1.5 text-rose-400">
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </div>
                        </th>
                        <th className="py-2.5 px-3 text-center w-28">
                          <div className="flex items-center justify-center gap-1.5 text-amber-400">
                            <Printer className="w-3.5 h-3.5" />
                            <span>Print</span>
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70 font-sans">
                      {filteredMenus.map((menu, idx) => {
                        const MenuIcon = MENU_ICONS[menu.id] || Package;
                        const perms = rolePermissionsDraft[menu.id] || {
                          view: false,
                          add: false,
                          update: false,
                          delete: false,
                          print: false,
                        };

                        const isFull = isParentFullyChecked(menu);
                        const isPartial = isParentPartiallyChecked(menu);

                        return (
                          <React.Fragment key={menu.id}>
                            {/* Primary Menu Row */}
                            <tr
                              className={`hover:bg-slate-850/60 transition ${
                                isFull ? 'bg-indigo-950/10' : ''
                              }`}
                            >
                              <td className="py-2.5 px-3 text-center text-slate-500 font-mono text-[10px]">
                                {idx + 1}
                              </td>

                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-2.5">
                                  <div className="h-7 w-7 rounded-lg bg-slate-800/80 border border-slate-700 flex items-center justify-center text-indigo-400 shrink-0">
                                    <MenuIcon className="w-3.5 h-3.5" />
                                  </div>
                                  <div>
                                    <div className="font-semibold text-white text-xs">{menu.label}</div>
                                    <div className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                                      <span>{menu.id}</span>
                                      <span>•</span>
                                      <span className="text-slate-500">{menu.group}</span>
                                    </div>
                                    {menu.submenus && menu.submenus.length > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => toggleSubmenuExpand(menu.id)}
                                        className="mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-300 transition"
                                      >
                                        <span>{menu.submenus.length} Submenus</span>
                                        <ChevronDown
                                          className={`w-3 h-3 transition-transform ${
                                            expandedSubmenus[menu.id] ? 'rotate-180 text-indigo-200' : 'text-indigo-400'
                                          }`}
                                        />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </td>

                              {/* Common Checkbox (All Access) */}
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleToggleCommon(menu.id, menu.submenus)}
                                  title={
                                    isFull
                                      ? `All permissions enabled for ${menu.label}. Click to uncheck all.`
                                      : `Toggle all permissions for ${menu.label}${menu.submenus ? ' and submenus' : ''}`
                                  }
                                  className={`w-9 h-9 rounded-xl mx-auto flex items-center justify-center border transition ${
                                    isFull
                                      ? 'bg-indigo-600 border-indigo-400 text-white shadow-md shadow-indigo-600/40 ring-1 ring-indigo-400'
                                      : isPartial
                                      ? 'bg-indigo-950 border-indigo-500/80 text-indigo-400'
                                      : 'bg-slate-950/70 border-slate-800 text-slate-600 hover:border-slate-700 hover:text-slate-400'
                                  }`}
                                >
                                  {isFull ? (
                                    <Check className="w-4 h-4 stroke-[3]" />
                                  ) : isPartial ? (
                                    <div className="w-3 h-0.5 bg-indigo-400 rounded-full" />
                                  ) : (
                                    <X className="w-3.5 h-3.5 opacity-25" />
                                  )}
                                </button>
                              </td>

                              {/* View Checkbox */}
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleToggleCell(menu.id, 'view')}
                                  title={`Toggle View for ${menu.label}`}
                                  className={`w-9 h-9 rounded-xl mx-auto flex items-center justify-center border transition ${
                                    perms.view
                                      ? 'bg-emerald-950 border-emerald-500 text-emerald-400 shadow-sm shadow-emerald-950/50'
                                      : 'bg-slate-950/70 border-slate-800 text-slate-600 hover:border-slate-700'
                                  }`}
                                >
                                  {perms.view ? <Check className="w-4 h-4 stroke-[3]" /> : <X className="w-3.5 h-3.5 opacity-30" />}
                                </button>
                              </td>

                              {/* Add Checkbox */}
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleToggleCell(menu.id, 'add')}
                                  title={`Toggle Add for ${menu.label}`}
                                  className={`w-9 h-9 rounded-xl mx-auto flex items-center justify-center border transition ${
                                    perms.add
                                      ? 'bg-indigo-950 border-indigo-500 text-indigo-300 shadow-sm shadow-indigo-950/50'
                                      : 'bg-slate-950/70 border-slate-800 text-slate-600 hover:border-slate-700'
                                  }`}
                                >
                                  {perms.add ? <Check className="w-4 h-4 stroke-[3]" /> : <X className="w-3.5 h-3.5 opacity-30" />}
                                </button>
                              </td>

                              {/* Update Checkbox */}
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleToggleCell(menu.id, 'update')}
                                  title={`Toggle Update for ${menu.label}`}
                                  className={`w-9 h-9 rounded-xl mx-auto flex items-center justify-center border transition ${
                                    perms.update
                                      ? 'bg-blue-950 border-blue-500 text-blue-300 shadow-sm shadow-blue-950/50'
                                      : 'bg-slate-950/70 border-slate-800 text-slate-600 hover:border-slate-700'
                                  }`}
                                >
                                  {perms.update ? <Check className="w-4 h-4 stroke-[3]" /> : <X className="w-3.5 h-3.5 opacity-30" />}
                                </button>
                              </td>

                              {/* Delete Checkbox */}
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleToggleCell(menu.id, 'delete')}
                                  title={`Toggle Delete for ${menu.label}`}
                                  className={`w-9 h-9 rounded-xl mx-auto flex items-center justify-center border transition ${
                                    perms.delete
                                      ? 'bg-rose-950 border-rose-500 text-rose-300 shadow-sm shadow-rose-950/50'
                                      : 'bg-slate-950/70 border-slate-800 text-slate-600 hover:border-slate-700'
                                  }`}
                                >
                                  {perms.delete ? <Check className="w-4 h-4 stroke-[3]" /> : <X className="w-3.5 h-3.5 opacity-30" />}
                                </button>
                              </td>

                              {/* Print Checkbox */}
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleToggleCell(menu.id, 'print')}
                                  title={`Toggle Print for ${menu.label}`}
                                  className={`w-9 h-9 rounded-xl mx-auto flex items-center justify-center border transition ${
                                    perms.print
                                      ? 'bg-amber-950 border-amber-500 text-amber-300 shadow-sm shadow-amber-950/50'
                                      : 'bg-slate-950/70 border-slate-800 text-slate-600 hover:border-slate-700'
                                  }`}
                                >
                                  {perms.print ? <Check className="w-4 h-4 stroke-[3]" /> : <X className="w-3.5 h-3.5 opacity-30" />}
                                </button>
                              </td>
                            </tr>

                            {/* Submenus Rows (e.g. Reports, Settings) */}
                            {menu.submenus &&
                              menu.submenus.length > 0 &&
                              expandedSubmenus[menu.id] &&
                              menu.submenus.map((sub, subIdx) => {
                                const SubIcon = MENU_ICONS[sub.id] || MenuIcon;
                                const subPerms = rolePermissionsDraft[sub.id] || {
                                  view: false,
                                  add: false,
                                  update: false,
                                  delete: false,
                                  print: false,
                                };
                                const isSubFull = isItemFullyChecked(sub.id);
                                const isSubPartial = isItemPartiallyChecked(sub.id);

                                return (
                                  <tr
                                    key={sub.id}
                                    className={`bg-slate-950/50 hover:bg-slate-800/40 transition border-l-4 border-l-indigo-500/60 ${
                                      isSubFull ? 'bg-indigo-950/20' : ''
                                    }`}
                                  >
                                    <td className="py-2 px-3 text-center text-slate-500 font-mono text-[10px]">
                                      {idx + 1}.{subIdx + 1}
                                    </td>

                                    <td className="py-2 px-3 pl-8">
                                      <div className="flex items-center gap-2">
                                        <span className="text-indigo-400/80 font-mono text-sm leading-none">↳</span>
                                        <div className="h-6 w-6 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center text-indigo-300 shrink-0">
                                          <SubIcon className="w-3 h-3" />
                                        </div>
                                        <div>
                                          <div className="font-medium text-slate-200 text-xs flex items-center gap-1.5">
                                            <span>{sub.label}</span>
                                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/60 font-mono">
                                              Submenu
                                            </span>
                                          </div>
                                          <div className="text-[10px] text-slate-500 font-mono">
                                            {sub.id}
                                          </div>
                                        </div>
                                      </div>
                                    </td>

                                    {/* Submenu Common Checkbox */}
                                    <td className="py-2 px-3 text-center">
                                      <button
                                        type="button"
                                        onClick={() => handleToggleCommon(sub.id)}
                                        title={
                                          isSubFull
                                            ? `All permissions active for ${sub.label}. Click to uncheck all.`
                                            : `Toggle all permissions for ${sub.label}`
                                        }
                                        className={`w-8 h-8 rounded-lg mx-auto flex items-center justify-center border transition ${
                                          isSubFull
                                            ? 'bg-indigo-600 border-indigo-400 text-white shadow-sm ring-1 ring-indigo-400'
                                            : isSubPartial
                                            ? 'bg-indigo-950 border-indigo-500 text-indigo-400'
                                            : 'bg-slate-950/70 border-slate-800 text-slate-600 hover:border-slate-700 hover:text-slate-400'
                                        }`}
                                      >
                                        {isSubFull ? (
                                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                                        ) : isSubPartial ? (
                                          <div className="w-2.5 h-0.5 bg-indigo-400 rounded-full" />
                                        ) : (
                                          <X className="w-3 h-3 opacity-25" />
                                        )}
                                      </button>
                                    </td>

                                    {/* View Submenu */}
                                    <td className="py-2 px-3 text-center">
                                      <button
                                        type="button"
                                        onClick={() => handleToggleCell(sub.id, 'view')}
                                        title={`Toggle View for ${sub.label}`}
                                        className={`w-8 h-8 rounded-lg mx-auto flex items-center justify-center border transition ${
                                          subPerms.view
                                            ? 'bg-emerald-950 border-emerald-500 text-emerald-400 shadow-sm shadow-emerald-950/50'
                                            : 'bg-slate-950/70 border-slate-800 text-slate-600 hover:border-slate-700'
                                        }`}
                                      >
                                        {subPerms.view ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <X className="w-3 h-3 opacity-30" />}
                                      </button>
                                    </td>

                                    {/* Add Submenu */}
                                    <td className="py-2 px-3 text-center">
                                      <button
                                        type="button"
                                        onClick={() => handleToggleCell(sub.id, 'add')}
                                        title={`Toggle Add for ${sub.label}`}
                                        className={`w-8 h-8 rounded-lg mx-auto flex items-center justify-center border transition ${
                                          subPerms.add
                                            ? 'bg-indigo-950 border-indigo-500 text-indigo-300 shadow-sm shadow-indigo-950/50'
                                            : 'bg-slate-950/70 border-slate-800 text-slate-600 hover:border-slate-700'
                                        }`}
                                      >
                                        {subPerms.add ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <X className="w-3.5 h-3.5 opacity-30" />}
                                      </button>
                                    </td>

                                    {/* Update Submenu */}
                                    <td className="py-2 px-3 text-center">
                                      <button
                                        type="button"
                                        onClick={() => handleToggleCell(sub.id, 'update')}
                                        title={`Toggle Update for ${sub.label}`}
                                        className={`w-8 h-8 rounded-lg mx-auto flex items-center justify-center border transition ${
                                          subPerms.update
                                            ? 'bg-blue-950 border-blue-500 text-blue-300 shadow-sm shadow-blue-950/50'
                                            : 'bg-slate-950/70 border-slate-800 text-slate-600 hover:border-slate-700'
                                        }`}
                                      >
                                        {subPerms.update ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <X className="w-3.5 h-3.5 opacity-30" />}
                                      </button>
                                    </td>

                                    {/* Delete Submenu */}
                                    <td className="py-2 px-3 text-center">
                                      <button
                                        type="button"
                                        onClick={() => handleToggleCell(sub.id, 'delete')}
                                        title={`Toggle Delete for ${sub.label}`}
                                        className={`w-8 h-8 rounded-lg mx-auto flex items-center justify-center border transition ${
                                          subPerms.delete
                                            ? 'bg-rose-950 border-rose-500 text-rose-300 shadow-sm shadow-rose-950/50'
                                            : 'bg-slate-950/70 border-slate-800 text-slate-600 hover:border-slate-700'
                                        }`}
                                      >
                                        {subPerms.delete ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <X className="w-3.5 h-3.5 opacity-30" />}
                                      </button>
                                    </td>

                                    {/* Print Submenu */}
                                    <td className="py-2 px-3 text-center">
                                      <button
                                        type="button"
                                        onClick={() => handleToggleCell(sub.id, 'print')}
                                        title={`Toggle Print for ${sub.label}`}
                                        className={`w-8 h-8 rounded-lg mx-auto flex items-center justify-center border transition ${
                                          subPerms.print
                                            ? 'bg-amber-950 border-amber-500 text-amber-300 shadow-sm shadow-amber-950/50'
                                            : 'bg-slate-950/70 border-slate-800 text-slate-600 hover:border-slate-700'
                                        }`}
                                      >
                                        {subPerms.print ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <X className="w-3.5 h-3.5 opacity-30" />}
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VIEW B: ASSIGN ROLES TO USERS */}
          {permissionSubView === 'users' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4 shadow-xl">
              <div className="border-b border-slate-800 pb-2 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-white text-sm flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-400" />
                    Operator Role Assignment & Directory
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Assign configured enterprise roles to system users and terminal cashiers
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <ExportButtons
                    data={(db.users || []).map(u => {
                      const userStore = db.stores?.find((s) => s.id === u.storeId);
                      const currentRole = rolesList.find(
                        (r) => r.id === u.roleId || r.code === u.role
                      ) || rolesList[0];
                      return {
                        id: u.id,
                        name: u.name,
                        username: u.username || '',
                        email: u.email,
                        phone: u.phone || '',
                        branch: userStore?.name || 'All Branches (HQ)',
                        role: `${currentRole.name} [${currentRole.code}]`,
                        status: 'Active'
                      };
                    })}
                    columns={[
                      { header: 'User ID', key: 'id' },
                      { header: 'Operator Name', key: 'name' },
                      { header: 'Username', key: 'username' },
                      { header: 'Email', key: 'email' },
                      { header: 'Phone', key: 'phone' },
                      { header: 'Branch / Location', key: 'branch' },
                      { header: 'Role Assigned', key: 'role' },
                      { header: 'Status', key: 'status' }
                    ]}
                    filename="System_Users_Role_Assignments"
                    title="Operator Role Assignment & Directory"
                    subtitle={`Total Operators: ${db.users?.length || 0} | Exported: ${new Date().toLocaleDateString()}`}
                    size="small"
                  />
                  <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                    Total Users: {db.users?.length || 0}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Operator</th>
                      <th className="py-2.5 px-3">Branch / Location</th>
                      <th className="py-2.5 px-3">Current Assigned Role</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans">
                    {db.users?.map((user) => {
                      const userStore = db.stores?.find((s) => s.id === user.storeId);
                      const currentRole = rolesList.find(
                        (r) => r.id === user.roleId || r.code === user.role
                      ) || rolesList[0];

                      return (
                        <tr key={user.id} className="hover:bg-slate-850/50 transition">
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-3">
                              {user.photo ? (
                                <img
                                  src={user.photo}
                                  alt={user.name}
                                  className="w-7 h-7 rounded-full object-cover border border-slate-700 shadow-sm shrink-0"
                                />
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 shrink-0">
                                  <User className="w-3.5 h-3.5" />
                                </div>
                              )}
                              <div>
                                <div className="font-bold text-white text-xs">{user.name}</div>
                                <div className="text-[11px] text-slate-400 font-mono">
                                  {user.id} • {user.email}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-2.5 px-3 text-slate-300">
                            {userStore?.name || 'All Branches (HQ)'}
                          </td>

                          <td className="py-2.5 px-3">
                            <select
                              value={user.roleId || currentRole.id}
                              onChange={(e) => assignUserRole(user.id, e.target.value)}
                              className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-100 font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
                            >
                              {rolesList.map((r) => (
                                <option key={r.id} value={r.id} className="bg-slate-900 text-slate-100">
                                  {r.name} [{r.code}]
                                </option>
                              ))}
                            </select>
                          </td>

                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1 w-max">
                              <CheckCircle2 className="w-3 h-3" /> Active
                            </span>
                          </td>

                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedRoleId(user.roleId || currentRole.id);
                                setPermissionSubView('roles');
                              }}
                              className="px-2.5 py-1 bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-300 rounded-lg text-xs font-semibold transition"
                            >
                              Configure Role Matrix
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* CREATE NEW ROLE MODAL */}
          {isCreateRoleModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h4 className="font-bold text-white text-sm flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-indigo-400" />
                      Add New Role
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Define a role and customize its menu permissions in the matrix
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCreateRoleModalOpen(false)}
                    className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleCreateNewRole} className="space-y-3.5 text-xs">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-200 block text-xs">
                      Role Name <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      autoFocus
                      placeholder="e.g. Senior Cashier, Floor Manager, Inventory Auditor"
                      value={newRoleForm.name}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewRoleForm({
                          ...newRoleForm,
                          name: val,
                          code: val.toUpperCase().replace(/[^A-Z0-9]/g, '_'),
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="font-semibold text-slate-200 block text-xs">
                        Role Code <span className="text-rose-400">*</span>
                      </label>
                      <span className="text-[10px] text-slate-500 font-mono">Auto-generated</span>
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="e.g. SENIOR_CASHIER"
                      value={newRoleForm.code}
                      onChange={(e) => setNewRoleForm({ ...newRoleForm, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_') })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-mono text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-200 block text-xs">
                      Role Description <span className="text-slate-500 text-[10px] font-normal">(Optional)</span>
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Brief note on duties and access requirements..."
                      value={newRoleForm.description}
                      onChange={(e) => setNewRoleForm({ ...newRoleForm, description: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
                    />
                  </div>

                  <div className="p-3 bg-indigo-950/30 border border-indigo-500/20 rounded-xl text-[11px] text-indigo-300/90 space-y-1">
                    <div className="font-semibold text-indigo-200 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      Configure Permissions Next
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      After clicking Create Role, you can grant or revoke View, Add, Update, Delete, and Print privileges for each of the 25 menus in the matrix.
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setIsCreateRoleModalOpen(false)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold transition text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-md shadow-indigo-600/30 transition flex items-center gap-1.5 text-xs"
                    >
                      <Plus className="w-3.5 h-3.5" /> Create Role
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. SYSTEM POLICIES TAB */}
      {activeTab === 'policy' && (
        <form onSubmit={handleSavePolicySettings} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Inventory Rules */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
              <div className="border-b border-slate-800 pb-2">
                <span className="font-bold text-white text-xs flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Stock Integrity Rules (Baseline Sec 3.3 & 5)
                </span>
              </div>

              <div className="flex items-start justify-between gap-3 p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg">
                <div className="space-y-1">
                  <label className="font-semibold text-white text-xs block">Block Negative Stock</label>
                  <p className="text-[11px] text-slate-400">
                    Prohibit sales, returns or transfers that would cause physical stock to fall below zero.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.blockNegativeStock}
                  onChange={(e) => setSettings({ ...settings, blockNegativeStock: e.target.checked })}
                  className="mt-1 w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600 cursor-pointer"
                />
              </div>

              <div className="space-y-1.5 p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg">
                <label className="font-semibold text-white text-xs block">Inventory Costing Engine</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, costingMethod: 'WEIGHTED_AVERAGE' })}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold ${
                      settings.costingMethod === 'WEIGHTED_AVERAGE'
                        ? 'border-indigo-500 bg-indigo-950/60 text-indigo-300'
                        : 'border-slate-800 bg-slate-900 text-slate-400'
                    }`}
                  >
                    Weighted Average Cost
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, costingMethod: 'FIFO' })}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold ${
                      settings.costingMethod === 'FIFO'
                        ? 'border-indigo-500 bg-indigo-950/60 text-indigo-300'
                        : 'border-slate-800 bg-slate-900 text-slate-400'
                    }`}
                  >
                    FIFO (First-In, First-Out)
                  </button>
                </div>
              </div>
            </div>

            {/* Approval Limits */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
              <div className="border-b border-slate-800 pb-2">
                <span className="font-bold text-white text-xs flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-indigo-400" />
                  Supervisor Approval Limits (Sec 10 & 11)
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-300 block">Stock Adjustment Qty Threshold</label>
                  <input
                    type="number"
                    value={settings.managerApprovalThresholdQty}
                    onChange={(e) => setSettings({ ...settings, managerApprovalThresholdQty: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-300 block">Max Cashier Discount (%)</label>
                  <input
                    type="number"
                    value={settings.maxDiscountPercentWithoutApproval}
                    onChange={(e) =>
                      setSettings({ ...settings, maxDiscountPercentWithoutApproval: Number(e.target.value) })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100"
                  />
                </div>
              </div>
            </div>

            {/* Purchase Order Default Terms & Conditions Configuration */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 md:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                <span className="font-bold text-white text-xs flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-400" />
                  Default Purchase Order Terms & Conditions
                </span>
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, defaultPOTerms: DEFAULT_PO_TERMS })}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer transition"
                >
                  Reset to Standard PO Clauses
                </button>
              </div>

              <div className="space-y-1.5 text-xs">
                <p className="text-[11px] text-slate-400">
                  Standard contractual clauses automatically populated when generating any new Purchase Order. Purchasing officers can further append or edit clauses per order.
                </p>
                <textarea
                  rows={4}
                  value={settings.defaultPOTerms}
                  onChange={(e) => setSettings({ ...settings, defaultPOTerms: e.target.value })}
                  placeholder="Enter default purchase order clauses line by line..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100 font-mono text-xs leading-relaxed focus:border-indigo-500"
                />
                <div className="text-[10px] text-slate-500 flex justify-between">
                  <span>Each line prints as a distinct numbered clause on A4 Purchase Order vouchers.</span>
                  <span className="font-mono text-indigo-400 font-bold">
                    {settings.defaultPOTerms ? settings.defaultPOTerms.split('\n').filter(Boolean).length : 0} clauses
                  </span>
                </div>
              </div>
            </div>

            {/* Purchase Catalog Filter Policy */}
            <div className="p-4 bg-slate-900/40 border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="font-semibold text-white text-xs">Purchase Product Catalog Filter</h5>
                  <p className="text-[11px] text-slate-400">
                    Choose whether the product search & selection in Purchase Entry displays all products or filters based on the selected supplier.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, purchaseProductFilterMode: 'all' })}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border transition text-center cursor-pointer ${
                    settings.purchaseProductFilterMode === 'all'
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  Show All Products
                </button>
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, purchaseProductFilterMode: 'supplier' })}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border transition text-center cursor-pointer ${
                    settings.purchaseProductFilterMode === 'supplier'
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  List Products Based on Supplier
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30 transition flex items-center gap-2"
            >
              <Save className="w-4 h-4" /> Save System Policies
            </button>
          </div>
        </form>
      )}

      {/* 4. THEME & APPEARANCE TAB */}
      {activeTab === 'appearance' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="border-b border-slate-800 pb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                  <Palette className="w-4 h-4 text-indigo-400" />
                  Visual Theme & Readability Configuration
                </h4>
                <p className="text-[11px] text-slate-400">
                  Switch between Dark and Light mode themes for optimal contrast in different lighting conditions
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-700/50 font-semibold font-mono">
                Active: {theme === 'dark' ? 'Dark Theme' : 'Light Theme'}
              </span>
            </div>

            {/* Theme Selector Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Dark Mode Card */}
              <div
                onClick={() => {
                  setTheme('dark');
                  notify('success', 'Dark theme enabled.', 'Theme Applied');
                }}
                className={`p-4 rounded-xl border-2 cursor-pointer transition space-y-3 relative ${
                  theme === 'dark'
                    ? 'border-indigo-500 bg-indigo-950/20 shadow-lg shadow-indigo-500/10'
                    : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center">
                      <Moon className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div>
                      <div className="font-bold text-xs text-white">Dark Theme (Default)</div>
                      <div className="text-[11px] text-slate-400">Low-glare deep slate canvas</div>
                    </div>
                  </div>
                  {theme === 'dark' && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-600 text-white flex items-center gap-1">
                      <Check className="w-3 h-3" /> Active
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  Engineered for cashiers, billing counters, and warehouse shifts. Reduces eye strain during prolonged screen exposure with deep slate canvas (#020617) and vivid status badges.
                </p>

                {/* Dark Mini Preview */}
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Preview:</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800">
                      Active
                    </span>
                  </div>
                  <div className="h-2 rounded bg-slate-800 w-3/4"></div>
                  <div className="h-2 rounded bg-slate-700 w-1/2"></div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTheme('dark');
                    notify('success', 'Dark theme enabled.', 'Theme Changed');
                  }}
                  className={`w-full py-1.5 rounded-lg text-xs font-semibold border transition ${
                    theme === 'dark'
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                  }`}
                >
                  {theme === 'dark' ? '✓ Currently Applied' : 'Activate Dark Mode'}
                </button>
              </div>

              {/* Light Mode Card */}
              <div
                onClick={() => {
                  setTheme('light');
                  notify('success', 'Light theme enabled.', 'Theme Applied');
                }}
                className={`p-4 rounded-xl border-2 cursor-pointer transition space-y-3 relative ${
                  theme === 'light'
                    ? 'border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/10'
                    : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-amber-100 border border-amber-300 flex items-center justify-center">
                      <Sun className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <div className="font-bold text-xs text-white">Light Theme</div>
                      <div className="text-[11px] text-slate-400">High-contrast daytime visibility</div>
                    </div>
                  </div>
                  {theme === 'light' && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-600 text-white flex items-center gap-1">
                      <Check className="w-3 h-3" /> Active
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  Optimized for bright daytime offices, sunlit shopfronts, and audit reports. Renders crisp white cards (#ffffff), slate-100 sub-surfaces, and deep charcoal high-contrast typography.
                </p>

                {/* Light Mini Preview */}
                <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-2 text-[11px] text-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Preview:</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-300">
                      Active
                    </span>
                  </div>
                  <div className="h-2 rounded bg-slate-200 w-3/4"></div>
                  <div className="h-2 rounded bg-slate-300 w-1/2"></div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTheme('light');
                    notify('success', 'Light theme enabled.', 'Theme Changed');
                  }}
                  className={`w-full py-1.5 rounded-lg text-xs font-semibold border transition ${
                    theme === 'light'
                      ? 'bg-amber-600 border-amber-500 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                  }`}
                >
                  {theme === 'light' ? '✓ Currently Applied' : 'Activate Light Mode'}
                </button>
              </div>
            </div>

            {/* Live Contrast & Visibility Inspector */}
            <div className="mt-4 pt-4 border-t border-slate-800 space-y-3">
              <h5 className="font-bold text-xs text-white flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-indigo-400" />
                Live UI Component Visibility Check ({theme === 'dark' ? 'Dark Mode' : 'Light Mode'})
              </h5>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                {/* Status Badges Preview */}
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <div className="text-[11px] font-semibold text-slate-400">Master Status Badges:</div>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800">
                      Active
                    </span>
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-950/80 text-rose-400 border border-rose-800">
                      Inactive
                    </span>
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950/80 text-amber-400 border border-amber-800">
                      Pending
                    </span>
                  </div>
                </div>

                {/* Form Controls Preview */}
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <div className="text-[11px] font-semibold text-slate-400">Form Input Visibility:</div>
                  <input
                    type="text"
                    readOnly
                    value="NexBill Crisp Input Text"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 text-xs focus:outline-none"
                  />
                </div>

                {/* Primary Action Button Preview */}
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <div className="text-[11px] font-semibold text-slate-400">Action Button Contrast:</div>
                  <button
                    type="button"
                    className="w-full py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition"
                  >
                    Primary Action Button
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
