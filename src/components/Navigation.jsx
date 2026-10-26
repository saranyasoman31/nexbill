// Navigation: Collapsible Left Sidebar & Menu Suite conforming strictly to user-specified menu sequence
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  CreditCard,
  Layers,
  FolderTree,
  Tag,
  Truck,
  Scale,
  Building2,
  Package,
  Users,
  WalletCards,
  Percent,
  Store,
  ClipboardList,
  ShoppingBag,
  RotateCcw,
  Boxes,
  Archive,
  ClipboardCheck,
  BadgePercent,
  ShoppingCart,
  Undo2,
  Calculator,
  ArrowLeftRight,
  BarChart3,
  Settings,
  LayoutDashboard,
  FlaskConical,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  User,
  ShieldCheck,
  Sparkles,
  Sun,
  Moon,
  PackageCheck,
  Palette,
  DownloadCloud,
  ShieldAlert,
  Activity,
  X,
} from 'lucide-react';

export default function Navigation() {
  const {
    activeTab,
    setActiveTab,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    isMobileSidebarOpen,
    setIsMobileSidebarOpen,
    setActiveMasterSubEntity,
    settingsSubTab,
    setSettingsSubTab,
    reportsSubTab,
    setReportsSubTab,
    db,
    currentUser,
    theme,
    toggleTheme,
    hasPermission,
  } = useApp();

  const [search, setSearch] = useState('');
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(true);
  const [isReportsExpanded, setIsReportsExpanded] = useState(true);

  const pendingAdjustmentsCount = db.stockAdjustments?.filter((a) => a.status === 'PENDING_APPROVAL').length || 0;
  const pendingRateChangesCount = db.rateChanges?.filter((rc) => rc.status === 'PENDING_APPROVAL').length || 0;

  // Exact menu structure in user-specified order:
  // 1. Credit customer, 2. Main category, 3. Category, 4. Brand, 5. Supplier, 6. Unit, 7. Product,
  // 8. Staff, 9. Payment mode, 10. Tax, 11. Branch, 12. Purchase order, 13. Purchase,
  // 14. Purchase return, 15. Initial, 16. Stock, 17. Stock adjustment, 18. Rate change, 19. Billing,
  // 20. Billing return, 21. Day close, 22. Stock transfer, 23. Reports, 24. Settings (Profile, User Permission)
  const menuGroups = [
    {
      group: 'Masters & Setup',
      items: [
        { id: 'credit_customer', label: 'Credit Customer', icon: CreditCard, count: db.customers?.length },
        { id: 'main_category', label: 'Main Category', icon: Layers, isMaster: true, entityKey: 'main_category' },
        { id: 'category', label: 'Category', icon: FolderTree, isMaster: true, entityKey: 'category' },
        { id: 'brand', label: 'Brand', icon: Tag, isMaster: true, entityKey: 'brand' },
        { id: 'supplier', label: 'Supplier', icon: Truck, isMaster: true, entityKey: 'supplier', count: db.suppliers?.length },
        { id: 'unit', label: 'Unit', icon: Scale, isMaster: true, entityKey: 'unit' },
        { id: 'company', label: 'Company', icon: Building2, isMaster: true, entityKey: 'company', count: db.companies?.length },
        { id: 'product', label: 'Product', icon: Package, isMaster: true, entityKey: 'product', count: db.products?.length },
        { id: 'staff', label: 'Staff', icon: Users, isMaster: true, entityKey: 'staff', count: db.users?.length },
        { id: 'payment_mode', label: 'Payment Mode', icon: WalletCards, isMaster: true, entityKey: 'payment_mode' },
        { id: 'tax', label: 'Tax', icon: Percent, isMaster: true, entityKey: 'tax' },
        { id: 'branch', label: 'Branch', icon: Store, isMaster: true, entityKey: 'branch', count: db.stores?.length },
      ],
    },
    {
      group: 'Purchasing',
      items: [
        { id: 'purchase_order', label: 'Purchase Order', icon: ClipboardList, count: db.purchaseOrders?.length },
        { id: 'purchase', label: 'Purchase', icon: ShoppingBag, count: db.purchases?.length },
        { id: 'purchase_return', label: 'Purchase Return', icon: RotateCcw, count: db.purchaseReturns?.length },
      ],
    },
    {
      group: 'Inventory & Stock',
      items: [
        { id: 'initial', label: 'Initial', icon: Boxes, count: db.initialStocks?.length },
        { id: 'stock', label: 'Stock', icon: Archive },
        {
          id: 'stock_adjustment',
          label: 'Stock Adjustment',
          icon: ClipboardCheck,
          badge: pendingAdjustmentsCount > 0 ? pendingAdjustmentsCount : null,
          badgeColor: 'bg-amber-500',
        },
        {
          id: 'rate_change',
          label: 'Rate Change',
          icon: BadgePercent,
          badge: pendingRateChangesCount > 0 ? pendingRateChangesCount : null,
          badgeColor: 'bg-indigo-500',
        },
      ],
    },
    {
      group: 'Billing & Registers',
      items: [
        { id: 'billing', label: 'Billing', icon: ShoppingCart, hotkey: 'F2', highlight: true },
        { id: 'billing_return', label: 'Billing Return', icon: Undo2 },
        { id: 'day_close', label: 'Day Close', icon: Calculator },
      ],
    },
    {
      group: 'Transfers',
      items: [
        { id: 'stock_transfer', label: 'Stock Transfer', icon: ArrowLeftRight, count: db.stockTransfers?.length },
      ],
    },
    {
      group: 'Analytics & Reports',
      items: [
        {
          id: 'reports',
          label: 'Reports',
          icon: BarChart3,
          hasSubItems: true,
          subItems: [
            { id: 'sales', permId: 'report_sales', label: 'Sales & Revenue', icon: ShoppingCart },
            { id: 'purchases', permId: 'report_purchases', label: 'Purchases Register', icon: Truck },
            { id: 'initial_stock', permId: 'report_initial_stock', label: 'Initial Stock Report', icon: PackageCheck },
            { id: 'stock', permId: 'report_stock', label: 'Stock Valuation & Ledger', icon: Boxes },
            { id: 'gst', permId: 'report_gst', label: 'GST Statutory (GSTR-1)', icon: Percent },
            { id: 'tally', permId: 'report_tally', label: 'Tally Prime Export', icon: DownloadCloud },
            { id: 'backlog', permId: 'report_backlog', label: 'Backlog Activity Report', icon: Activity },
            { id: 'audit', permId: 'report_audit', label: 'Audit Trail & Log', icon: ShieldAlert },
          ],
        },
      ],
    },
    {
      group: 'System Configuration',
      items: [
        {
          id: 'settings',
          label: 'Settings',
          icon: Settings,
          hasSubItems: true,
          subItems: [
            { id: 'profile', permId: 'settings_profile', label: 'Profile', icon: User },
            { id: 'permissions', permId: 'settings_permissions', label: 'User Permission', icon: ShieldCheck },
            { id: 'policy', permId: 'settings_policy', label: 'System Policy', icon: Sparkles },
            { id: 'appearance', permId: 'settings_appearance', label: 'Theme & Appearance', icon: Palette },
          ],
        },
      ],
    },
    {
      group: 'Overview & Verification',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, hotkey: 'F1' },
        { id: 'tests', label: 'Acceptance Tests (Sec 20)', icon: FlaskConical, isTest: true },
      ],
    },
  ];

  const handleMenuClick = (item) => {
    setIsMobileSidebarOpen(false);
    if (item.isMaster) {
      setActiveMasterSubEntity(item.entityKey);
      setActiveTab(item.id);
    } else {
      setActiveTab(item.id);
      if (item.id === 'reports' && !isReportsExpanded) {
        setIsReportsExpanded(true);
      }
      if (item.id === 'settings' && !isSettingsExpanded) {
        setIsSettingsExpanded(true);
      }
    }
  };

  const handleSubItemClick = (parentItem, sub) => {
    setIsMobileSidebarOpen(false);
    if (parentItem.id === 'reports') {
      setActiveTab('reports');
      setReportsSubTab(sub.id);
    } else if (parentItem.id === 'settings') {
      setActiveTab('settings');
      setSettingsSubTab(sub.id);
    }
  };

  // Filter items if searching
  const q = search.trim().toLowerCase();
  const showLabels = !isSidebarCollapsed || isMobileSidebarOpen;

  return (
    <>
      {/* Mobile Drawer Backdrop Overlay */}
      {isMobileSidebarOpen && (
        <div
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs lg:hidden transition-opacity cursor-pointer"
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50 bg-slate-900 border-r border-slate-800 flex flex-col transition-all duration-200 select-none
          lg:static lg:z-30 lg:translate-x-0
          ${isMobileSidebarOpen ? 'translate-x-0 shadow-2xl w-72 max-w-[85vw]' : '-translate-x-full lg:translate-x-0'}
          ${isSidebarCollapsed ? 'lg:w-16' : 'lg:w-64'}
        `}
      >
        {/* Sidebar Header & Toggle */}
        <div className="p-3 border-b border-slate-800 flex items-center justify-between">
          {showLabels && (
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-black text-xs shadow-md shrink-0">
                N
              </div>
              <div className="overflow-hidden">
                <span className="font-bold text-white text-xs tracking-tight block truncate">NexBill ERP</span>
                <span className="text-[10px] text-slate-400 block truncate">Transactions & Masters</span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-1">
            {/* Desktop Collapse Toggle */}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="hidden lg:flex p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
              title={isSidebarCollapsed ? 'Expand Navigation Sidebar' : 'Collapse Sidebar'}
            >
              {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>

            {/* Mobile Drawer Close Button */}
            <button
              onClick={() => setIsMobileSidebarOpen(false)}
              className="lg:hidden p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
              title="Close Menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Search (only when expanded or on mobile drawer) */}
        {showLabels && (
          <div className="p-2.5 border-b border-slate-800/80">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search menu..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-8 pr-2 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        )}

      {/* Menu Items Scroll Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-3 scrollbar-thin">
        {menuGroups.map((grp, grpIdx) => {
          const visibleItems = grp.items.filter((item) => {
            // Dashboard is universally accessible to all authenticated users
            if (item.id === 'dashboard') {
              if (!q) return true;
              return item.label.toLowerCase().includes(q);
            }

            // Acceptance tests suite is restricted to Administrator or users with settings permissions
            if (item.id === 'tests') {
              const isAdmin =
                currentUser?.roleId === 'ROLE_ADMIN' ||
                currentUser?.role === 'ADMINISTRATOR' ||
                currentUser?.role === 'COMPANY_ADMIN' ||
                currentUser?.permissions?.includes('ALL_PERMISSIONS') ||
                currentUser?.permissions?.includes('SUPER_ADMIN') ||
                hasPermission('settings', 'view');
              if (!isAdmin) return false;
            } else if (!hasPermission(item.id, 'view')) {
              return false;
            }

            if (!q) return true;
            return (
              item.label.toLowerCase().includes(q) ||
              item.subItems?.some((s) => s.label.toLowerCase().includes(q))
            );
          });

          if (visibleItems.length === 0) return null;

          return (
            <div key={grpIdx} className="space-y-1">
              {showLabels && (
                <div className="text-[10px] uppercase font-bold text-slate-500 px-2 tracking-wider py-0.5">
                  {grp.group}
                </div>
              )}

              {visibleItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  activeTab === item.id ||
                  (item.isMaster && activeTab === item.id);

                return (
                  <div key={item.id} className="space-y-0.5">
                    <button
                      onClick={() => handleMenuClick(item)}
                      title={!showLabels ? item.label : undefined}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition-all duration-150 relative text-left group ${
                        isActive
                          ? item.highlight
                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                            : item.isTest
                            ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                            : 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`} />

                      {showLabels && (
                        <>
                          <span className="flex-1 truncate">{item.label}</span>

                          {item.hotkey && (
                            <span
                              className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                                isActive ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {item.hotkey}
                            </span>
                          )}

                          {item.badge && (
                            <span className={`px-1.5 py-0.2 rounded-full text-[10px] text-white font-bold ${item.badgeColor}`}>
                              {item.badge}
                            </span>
                          )}

                          {item.count !== undefined && !item.badge && (
                            <span className="text-[10px] text-slate-500 font-mono">
                              {item.count}
                            </span>
                          )}

                          {item.hasSubItems && (
                            <ChevronDown
                              className={`w-3.5 h-3.5 transition-transform ${
                                (item.id === 'reports' ? isReportsExpanded : isSettingsExpanded)
                                  ? 'rotate-180 text-slate-300'
                                  : 'text-slate-500'
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (item.id === 'reports') {
                                  setIsReportsExpanded(!isReportsExpanded);
                                } else {
                                  setIsSettingsExpanded(!isSettingsExpanded);
                                }
                              }}
                            />
                          )}
                        </>
                      )}
                    </button>

                    {/* Sub-items for Reports or Settings */}
                    {item.hasSubItems &&
                      showLabels &&
                      (item.id === 'reports' ? isReportsExpanded : isSettingsExpanded) && (
                        <div className="pl-6 pr-1 space-y-0.5 pt-0.5">
                          {item.subItems.map((sub) => {
                            if (sub.permId && !hasPermission(sub.permId, 'view')) {
                              return null;
                            }
                            const SubIcon = sub.icon;
                            const isSubActive =
                              item.id === 'reports'
                                ? activeTab === 'reports' && reportsSubTab === sub.id
                                : activeTab === 'settings' && settingsSubTab === sub.id;
                            return (
                              <button
                                key={sub.id}
                                onClick={() => handleSubItemClick(item, sub)}
                                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] transition ${
                                  isSubActive
                                    ? 'bg-indigo-950/80 border border-indigo-700/50 text-indigo-300 font-semibold'
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                                }`}
                              >
                                <SubIcon className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">{sub.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Sidebar Footer & Theme Toggle */}
      <div className="p-2.5 border-t border-slate-800 space-y-2">
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode for high daytime contrast' : 'Switch to Dark Mode'}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition ${
            theme === 'light'
              ? 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
              : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700/80'
          }`}
        >
          <div className="flex items-center gap-2">
            {theme === 'dark' ? (
              <Moon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            ) : (
              <Sun className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            )}
            {showLabels && (
              <span>{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
            )}
          </div>
          {showLabels && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700/70 text-slate-400 font-mono">
              {theme === 'dark' ? 'Light' : 'Dark'}
            </span>
          )}
        </button>

        {showLabels && (
          <div className="text-[10px] text-slate-500 text-center">
            NexBill ERP • Multi-Store Retail
          </div>
        )}
      </div>
    </aside>
  </>
  );
}
