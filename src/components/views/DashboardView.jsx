// DashboardView: Role-Tailored Executive Operations, POS & Inventory Dashboard for NexBill ERP
import React from 'react';
import { useApp } from '../../context/AppContext';
import { StockAdjustmentService } from '../../services/stockAdjustmentService';
import { RateChangeService } from '../../services/rateChangeService';
import { SYSTEM_MENUS_CONFIG } from '../../data/initialData';
import {
  ShoppingCart,
  Boxes,
  Banknote,
  Receipt,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Printer,
  Sparkles,
  ShieldCheck,
  Truck,
  RotateCcw,
  Tag,
  ClipboardCheck,
  FlaskConical,
  Database,
  Settings,
  CreditCard,
  Package,
  Layers,
  FolderTree,
  Scale,
  Users,
  WalletCards,
  Percent,
  Store,
  ClipboardList,
  ShoppingBag,
  Undo2,
  Archive,
  BadgePercent,
  Calculator,
  ArrowLeftRight,
  BarChart3,
  Check,
  AlertOctagon,
  FileText,
  Activity,
  UserCheck,
  User,
} from 'lucide-react';
import ExportButtons from '../common/ExportButtons.jsx';

export default function DashboardView() {
  const {
    db,
    activeCompany,
    activeStore,
    activeWarehouse,
    currentUser,
    setActiveTab,
    setActiveMasterSubEntity,
    setReceiptModalInvoice,
    setReportsSubTab,
    notify,
    triggerRefresh,
    hasPermission,
  } = useApp();

  // Root Administrator and Executive Privileges
  const isAdmin =
    currentUser.roleId === 'ROLE_ADMIN' ||
    currentUser.role === 'ADMINISTRATOR' ||
    currentUser.role === 'COMPANY_ADMIN' ||
    currentUser.role === 'SUPER_ADMIN' ||
    currentUser.permissions?.includes('ALL_PERMISSIONS') ||
    currentUser.permissions?.includes('SUPER_ADMIN');

  // Module Capability Flags
  const canBilling = hasPermission('billing', 'view');
  const canBillingReturn = hasPermission('billing_return', 'view');
  const canDayClose = hasPermission('day_close', 'view');
  const canCreditCustomer = hasPermission('credit_customer', 'view');
  const canStock = hasPermission('stock', 'view');
  const canInitialStock = hasPermission('initial', 'view');
  const canStockAdjustment = hasPermission('stock_adjustment', 'view');
  const canRateChange = hasPermission('rate_change', 'view');
  const canStockTransfer = hasPermission('stock_transfer', 'view');
  const canPurchaseOrder = hasPermission('purchase_order', 'view');
  const canPurchase = hasPermission('purchase', 'view');
  const canPurchaseReturn = hasPermission('purchase_return', 'view');
  const canSupplier = hasPermission('supplier', 'view');
  const canProduct = hasPermission('product', 'view');
  const canReports = hasPermission('reports', 'view');
  const canSettings = hasPermission('settings', 'view');

  // Approval Rights (Store Manager & Admin)
  const canApprove =
    isAdmin ||
    currentUser.roleId === 'ROLE_STORE_MANAGER' ||
    currentUser.permissions?.includes('APPROVE_ADJUSTMENT') ||
    currentUser.permissions?.includes('APPROVE_RATE_CHANGE') ||
    hasPermission('stock_adjustment', 'update');

  // Permitted menus count out of 25
  const permittedMenusCount = isAdmin
    ? 25
    : SYSTEM_MENUS_CONFIG.filter((m) => hasPermission(m.id, 'view')).length;

  // Resolve Human-Readable Role Title
  const userRoleObj = db.roles?.find(
    (r) => r.id === (currentUser.roleId || currentUser.role) || r.code === currentUser.role
  );
  const roleDisplayName = userRoleObj?.name || currentUser.role.replace(/_/g, ' ');

  // Metrics Calculations
  const companyInvoices = (db.invoices || []).filter(
    (i) => i.companyId === activeCompany.id && i.status === 'POSTED'
  );
  const totalSalesRevenue = companyInvoices.reduce((sum, i) => sum + (Number(i.netPayable) || 0), 0);
  const totalGST = companyInvoices.reduce((sum, i) => sum + (Number(i.totalTax) || 0), 0);
  const totalInvoicesCount = companyInvoices.length;
  const avgBasketSize = totalInvoicesCount > 0 ? (totalSalesRevenue / totalInvoicesCount).toFixed(2) : '0.00';

  // Inventory Valuation
  const storeWarehouses = (db.warehouses || []).filter((w) => w.storeId === activeStore.id);
  const storeWarehouseIds = new Set(storeWarehouses.map((w) => w.id));
  const storeBalances = (db.stockBalances || []).filter((b) => storeWarehouseIds.has(b.warehouseId));
  const totalInventoryValuation = storeBalances.reduce((sum, b) => {
    const prod = (db.products || []).find((p) => p.id === b.productId);
    return sum + Number(b.quantity) * Number(b.valuationRate || prod?.costRate || 0);
  }, 0);

  const lowStockItems = storeBalances.filter((b) => {
    const prod = (db.products || []).find((p) => p.id === b.productId);
    return Number(b.quantity) <= (prod?.minStockAlert || 5);
  });

  // Purchasing & Procurement Metrics
  const companyPurchases = (db.purchases || []).filter(
    (p) => p.companyId === activeCompany.id && p.status === 'POSTED'
  );
  const totalPurchasesVolume = companyPurchases.reduce(
    (sum, p) => sum + Number(p.grandTotal || p.totalAmount || 0),
    0
  );
  const openPurchaseOrders = (db.purchaseOrders || []).filter(
    (po) => po.status === 'APPROVED' || po.status === 'DRAFT'
  );

  // Customer Credit Outstanding
  const totalCustomerCredit = (db.customers || []).reduce(
    (sum, c) => sum + Number(c.currentBalance || c.outstandingBalance || 0),
    0
  );

  // Tender Breakdown
  let cashTotal = 0;
  let upiTotal = 0;
  let cardTotal = 0;
  let creditTotal = 0;
  companyInvoices.forEach((inv) => {
    (inv.tenders || []).forEach((t) => {
      const amt = Number(t.amount || 0);
      if (t.method === 'CASH') cashTotal += amt;
      else if (t.method === 'UPI') upiTotal += amt;
      else if (t.method === 'CARD') cardTotal += amt;
      else if (t.method === 'CREDIT') creditTotal += amt;
    });
  });
  const allTendersTotal = cashTotal + upiTotal + cardTotal + creditTotal || 0;

  // Pending Approvals
  const pendingAdjustments = (db.stockAdjustments || []).filter((a) => a.status === 'PENDING_APPROVAL');
  const pendingRateChanges = (db.rateChanges || []).filter((rc) => rc.status === 'PENDING_APPROVAL');
  const totalPendingApprovals = pendingAdjustments.length + pendingRateChanges.length;

  const handleQuickApproveAdjustment = (adjId) => {
    try {
      StockAdjustmentService.approveAdjustment(adjId, currentUser.id);
      notify('success', 'Stock adjustment approved and posted.', 'Approved');
      triggerRefresh();
    } catch (e) {
      notify('error', e.message, 'Approval Failed');
    }
  };

  const handleQuickApproveRate = (rateId) => {
    try {
      RateChangeService.approveRateChange(rateId, currentUser.id);
      notify('success', 'Selling rate change approved and updated.', 'Approved');
      triggerRefresh();
    } catch (e) {
      notify('error', e.message, 'Approval Failed');
    }
  };

  // Determine Primary Action Button for Logged-In Role
  const getPrimaryAction = () => {
    if (canBilling) {
      return {
        label: 'Open POS Terminal (F2)',
        icon: ShoppingCart,
        tab: 'billing',
        className: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30 text-white',
      };
    }
    if (canPurchaseOrder) {
      return {
        label: 'New Purchase Order',
        icon: ClipboardList,
        tab: 'purchase_order',
        className: 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30 text-white',
      };
    }
    if (canPurchase) {
      return {
        label: 'Vendor Inward (Purchase)',
        icon: ShoppingBag,
        tab: 'purchase',
        className: 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/30 text-white',
      };
    }
    if (canStockTransfer) {
      return {
        label: 'Stock Transfer',
        icon: ArrowLeftRight,
        tab: 'stock_transfer',
        className: 'bg-violet-600 hover:bg-violet-500 shadow-violet-600/30 text-white',
      };
    }
    if (canStockAdjustment) {
      return {
        label: 'Stock Adjustment',
        icon: ClipboardCheck,
        tab: 'stock_adjustment',
        className: 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30 text-white',
      };
    }
    if (canStock) {
      return {
        label: 'Stock Ledger',
        icon: Archive,
        tab: 'stock',
        className: 'bg-teal-600 hover:bg-teal-500 shadow-teal-600/30 text-white',
      };
    }
    if (canCreditCustomer) {
      return {
        label: 'Credit Customers',
        icon: CreditCard,
        tab: 'credit_customer',
        className: 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30 text-white',
      };
    }
    if (canReports) {
      return {
        label: 'View Reports & Analytics',
        icon: BarChart3,
        tab: 'reports',
        className: 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30 text-white',
      };
    }
    if (canSettings) {
      return {
        label: 'System Settings',
        icon: Settings,
        tab: 'settings',
        className: 'bg-slate-700 hover:bg-slate-600 shadow-slate-700/30 text-white',
      };
    }
    return {
      label: 'Product Catalog',
      icon: Package,
      tab: 'product',
      className: 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30 text-white',
      isMaster: true,
      entityKey: 'product',
    };
  };

  const primaryAction = getPrimaryAction();
  const PrimaryActionIcon = primaryAction.icon;

  // Dynamic KPI Metric Cards (Gated to User's Permitted Menus)
  const candidateKpis = [
    // 1. Sales Revenue
    {
      id: 'sales_revenue',
      visible: canBilling || canReports,
      title: `Total Revenue (${activeCompany.stateCode})`,
      value: `₹${totalSalesRevenue.toFixed(2)}`,
      sub: `${totalInvoicesCount} Invoices • Avg: ₹${avgBasketSize}`,
      icon: TrendingUp,
      color: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40',
      valColor: 'text-white',
    },
    // 2. Collected Tenders
    {
      id: 'tenders_collected',
      visible: canBilling || canDayClose,
      title: 'Tenders Collected Today',
      value: `₹${allTendersTotal.toFixed(2)}`,
      sub: `Cash ₹${cashTotal.toFixed(2)} • Digital ₹${(upiTotal + cardTotal).toFixed(2)}`,
      icon: Banknote,
      color: 'bg-purple-950/60 text-purple-400 border-purple-800/40',
      valColor: 'text-purple-300',
    },
    // 3. Store Stock Valuation
    {
      id: 'stock_valuation',
      visible: canStock || canInitialStock || canReports,
      title: 'Store Stock Valuation',
      value: `₹${totalInventoryValuation.toFixed(2)}`,
      sub: `${storeBalances.length} SKUs in ${storeWarehouses.length} Warehouses`,
      icon: Boxes,
      color: 'bg-indigo-950/60 text-indigo-400 border-indigo-800/40',
      valColor: 'text-indigo-400',
    },
    // 4. Low Stock Alerts
    {
      id: 'low_stock',
      visible: canStock || canPurchase || canPurchaseOrder,
      title: 'Stock Reorder Alerts',
      value: `${lowStockItems.length} Products`,
      sub: 'Below configured min stock threshold',
      icon: AlertTriangle,
      color: 'bg-amber-950/60 text-amber-400 border-amber-800/40',
      valColor: lowStockItems.length > 0 ? 'text-amber-400' : 'text-slate-300',
    },
    // 5. Procurement Inward Volume
    {
      id: 'procurement',
      visible: canPurchase || canPurchaseOrder,
      title: 'Procurement Inward',
      value: `₹${totalPurchasesVolume.toFixed(2)}`,
      sub: `${companyPurchases.length} Bills • ${openPurchaseOrders.length} Open POs`,
      icon: Truck,
      color: 'bg-sky-950/60 text-sky-400 border-sky-800/40',
      valColor: 'text-sky-300',
    },
    // 6. Customer Credit Ledger
    {
      id: 'customer_credit',
      visible: canCreditCustomer,
      title: 'Customer Credit Book',
      value: `₹${totalCustomerCredit.toFixed(2)}`,
      sub: `${(db.customers || []).length} Registered Accounts`,
      icon: CreditCard,
      color: 'bg-cyan-950/60 text-cyan-400 border-cyan-800/40',
      valColor: 'text-cyan-300',
    },
    // 7. Statutory GST Collected
    {
      id: 'gst_statutory',
      visible: (canReports && !canDayClose) || isAdmin,
      title: 'Statutory GST Collected',
      value: `₹${totalGST.toFixed(2)}`,
      sub: 'GSTR-1 Compliant Intra & Inter-state',
      icon: Receipt,
      color: 'bg-teal-950/60 text-teal-400 border-teal-800/40',
      valColor: 'text-teal-400',
    },
    // 8. Pending Approvals
    {
      id: 'pending_approvals',
      visible: canApprove && totalPendingApprovals > 0,
      title: 'Pending Approvals',
      value: `${totalPendingApprovals} Requests`,
      sub: 'Section 10 & 11 Threshold Overrides',
      icon: ClipboardCheck,
      color: 'bg-amber-950/60 text-amber-400 border-amber-800/40',
      valColor: 'text-amber-400',
    },
  ];

  const visibleKpis = candidateKpis.filter((c) => c.visible).slice(0, 4);

  // Complete Catalog of Quick Module Actions mapped strictly to Menu IDs
  const ALL_QUICK_ACTIONS = [
    { id: 'billing', menuId: 'billing', label: 'POS Billing', desc: 'Scan & Multi-Tender', icon: ShoppingCart, color: 'text-emerald-400', tab: 'billing', hotkey: 'F2' },
    { id: 'billing_return', menuId: 'billing_return', label: 'Billing Return', desc: 'Restock & Refunds', icon: RotateCcw, color: 'text-amber-400', tab: 'billing_return' },
    { id: 'day_close', menuId: 'day_close', label: 'Day Close', desc: 'Till Reconciliation', icon: Calculator, color: 'text-purple-400', tab: 'day_close' },
    { id: 'credit_customer', menuId: 'credit_customer', label: 'Credit Customers', desc: 'Ledgers & Balances', icon: CreditCard, color: 'text-cyan-400', tab: 'credit_customer' },
    { id: 'product', menuId: 'product', label: 'Product Master', desc: 'SKUs, HSN & Rates', icon: Package, color: 'text-blue-400', tab: 'product', isMaster: true, entityKey: 'product' },
    { id: 'purchase_order', menuId: 'purchase_order', label: 'Purchase Order', desc: 'Vendor Purchase POs', icon: ClipboardList, color: 'text-sky-400', tab: 'purchase_order' },
    { id: 'purchase', menuId: 'purchase', label: 'Purchase Inward', desc: 'GRN & Stock Receipts', icon: ShoppingBag, color: 'text-blue-400', tab: 'purchase' },
    { id: 'purchase_return', menuId: 'purchase_return', label: 'Purchase Return', desc: 'Vendor Debit Notes', icon: Undo2, color: 'text-rose-400', tab: 'purchase_return' },
    { id: 'supplier', menuId: 'supplier', label: 'Suppliers', desc: 'Vendor Registry & GST', icon: Truck, color: 'text-indigo-400', tab: 'supplier', isMaster: true, entityKey: 'supplier' },
    { id: 'stock', menuId: 'stock', label: 'Stock Ledger', desc: 'Balances & Bin Cards', icon: Archive, color: 'text-emerald-400', tab: 'stock' },
    { id: 'initial', menuId: 'initial', label: 'Opening Stock', desc: 'Inventory Migration', icon: Boxes, color: 'text-teal-400', tab: 'initial' },
    { id: 'stock_adjustment', menuId: 'stock_adjustment', label: 'Stock Adjustment', desc: 'Cycle Counts & Waste', icon: ClipboardCheck, color: 'text-amber-400', tab: 'stock_adjustment' },
    { id: 'rate_change', menuId: 'rate_change', label: 'Rate Change', desc: 'Selling Price Updates', icon: BadgePercent, color: 'text-indigo-400', tab: 'rate_change' },
    { id: 'stock_transfer', menuId: 'stock_transfer', label: 'Stock Transfer', desc: 'Inter-Branch Movements', icon: ArrowLeftRight, color: 'text-violet-400', tab: 'stock_transfer' },
    { id: 'reports', menuId: 'reports', label: 'Reports Hub', desc: 'Sales, GST & Tally', icon: BarChart3, color: 'text-teal-400', tab: 'reports' },
    { id: 'branch', menuId: 'branch', label: 'Branch / Store', desc: 'Multi-Store Outlets', icon: Store, color: 'text-emerald-400', tab: 'branch', isMaster: true, entityKey: 'branch' },
    { id: 'staff', menuId: 'staff', label: 'Staff & Logins', desc: 'Employee Accounts', icon: Users, color: 'text-indigo-400', tab: 'staff', isMaster: true, entityKey: 'staff' },
    { id: 'payment_mode', menuId: 'payment_mode', label: 'Payment Modes', desc: 'UPI, Card & Credit', icon: WalletCards, color: 'text-purple-400', tab: 'payment_mode', isMaster: true, entityKey: 'payment_mode' },
    { id: 'tax', menuId: 'tax', label: 'Tax Slabs', desc: 'GST Rates & HSN', icon: Percent, color: 'text-pink-400', tab: 'tax', isMaster: true, entityKey: 'tax' },
    { id: 'unit', menuId: 'unit', label: 'Units (UOM)', desc: 'Kg, Pcs, Litres', icon: Scale, color: 'text-amber-400', tab: 'unit', isMaster: true, entityKey: 'unit' },
    { id: 'category', menuId: 'category', label: 'Categories', desc: 'Product Classification', icon: FolderTree, color: 'text-yellow-400', tab: 'category', isMaster: true, entityKey: 'category' },
    { id: 'main_category', menuId: 'main_category', label: 'Main Category', desc: 'Top-Level Catalog', icon: Layers, color: 'text-orange-400', tab: 'main_category', isMaster: true, entityKey: 'main_category' },
    { id: 'brand', menuId: 'brand', label: 'Brands', desc: 'Brand Directory', icon: Tag, color: 'text-lime-400', tab: 'brand', isMaster: true, entityKey: 'brand' },
    { id: 'settings', menuId: 'settings', label: 'User Permission', desc: 'Roles & Policies', icon: Settings, color: 'text-slate-300', tab: 'settings' },
  ];

  // Strictly filter Quick Actions by View Permission
  const visibleQuickActions = ALL_QUICK_ACTIONS.filter((item) => hasPermission(item.menuId, 'view'));

  // Append developer acceptance tests only for administrators
  if (isAdmin) {
    visibleQuickActions.push({
      id: 'tests',
      menuId: 'tests',
      label: 'Acceptance Tests',
      desc: 'Sec 20 Suite (14 Tests)',
      icon: FlaskConical,
      color: 'text-purple-400',
      tab: 'tests',
      isTest: true,
    });
  }

  const handleQuickJump = (item) => {
    if (item.isMaster) {
      setActiveMasterSubEntity(item.entityKey || item.id);
      setActiveTab(item.tab || item.id);
    } else {
      setActiveTab(item.tab || item.id);
    }
  };

  // Recent Stock Movements for Inventory Roles
  const recentStockMovements = (db.stockMovements || []).slice(-5).reverse();

  // Recent Purchase Invoices & Orders for Procurement Roles
  const recentPurchases = (db.purchases || []).slice(-5).reverse();

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
      {/* Role-Aware Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/70 to-slate-900 border border-indigo-500/30 rounded-2xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center overflow-hidden shrink-0">
            {currentUser?.photo ? (
              <img src={currentUser.photo} alt={currentUser.name} className="w-full h-full object-cover" />
            ) : (
              <User className="w-6 h-6 text-indigo-400" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-white tracking-tight">
                Welcome to NexBill, {currentUser.name}
              </h2>
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 uppercase">
                {roleDisplayName}
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                <span>{permittedMenusCount} of 25 Modules Active</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Terminal: {activeStore.name} ({activeStore.city}) • Company: {activeCompany.tradeName} ({activeCompany.state})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Contextual Status Badge */}
          {canBilling || canDayClose || isAdmin ? (
            <div className="text-right">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Store Register Status</div>
              <div
                className={`text-xs font-bold flex items-center justify-end gap-1.5 ${
                  activeStore.isDayOpen ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    activeStore.isDayOpen ? 'bg-emerald-400 animate-ping' : 'bg-rose-400'
                  }`}
                />
                {activeStore.isDayOpen ? 'REGISTER OPEN (READY)' : 'DAY CLOSED (LOCKED)'}
              </div>
            </div>
          ) : canStock || canStockTransfer ? (
            <div className="text-right">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Active Warehouse</div>
              <div className="text-xs font-bold text-indigo-300 flex items-center justify-end gap-1.5">
                <Boxes className="w-3 h-3 text-indigo-400" />
                <span>{activeWarehouse.name} ({storeBalances.length} SKUs)</span>
              </div>
            </div>
          ) : canPurchase || canPurchaseOrder ? (
            <div className="text-right">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Procurement Desk</div>
              <div className="text-xs font-bold text-sky-300 flex items-center justify-end gap-1.5">
                <Truck className="w-3 h-3 text-sky-400" />
                <span>{openPurchaseOrders.length} Open POs • {(db.suppliers || []).length} Vendors</span>
              </div>
            </div>
          ) : (
            <div className="text-right">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">System Terminal</div>
              <div className="text-xs font-bold text-slate-300 flex items-center justify-end gap-1.5">
                <Activity className="w-3 h-3 text-indigo-400" />
                <span>NexBill Standard Edition</span>
              </div>
            </div>
          )}

          {/* Primary Action Button */}
          <button
            onClick={() => handleQuickJump(primaryAction)}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg transition ${primaryAction.className}`}
          >
            <PrimaryActionIcon className="w-3.5 h-3.5" />
            <span>{primaryAction.label}</span>
          </button>
        </div>
      </div>

      {/* Role-Gated KPI Metrics Grid */}
      {visibleKpis.length > 0 && (
        <div
          className={`grid gap-3 text-xs ${
            visibleKpis.length === 1
              ? 'grid-cols-1'
              : visibleKpis.length === 2
              ? 'grid-cols-1 sm:grid-cols-2'
              : visibleKpis.length === 3
              ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
              : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
          }`}
        >
          {visibleKpis.map((kpi) => {
            const KpiIcon = kpi.icon;
            return (
              <div
                key={kpi.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-md flex items-center justify-between"
              >
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">{kpi.title}</div>
                  <div className={`text-2xl font-black font-mono mt-0.5 ${kpi.valColor}`}>{kpi.value}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[200px]">{kpi.sub}</div>
                </div>
                <div className={`p-2.5 rounded-lg border shrink-0 ${kpi.color}`}>
                  <KpiIcon className="w-5 h-5" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Role-Filtered Quick Module Jump Grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Quick Module Jump</span>
            <span className="text-[10px] text-slate-500 font-normal">
              ({visibleQuickActions.length} enabled shortcuts for {roleDisplayName})
            </span>
          </div>
          {isAdmin && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/50 font-mono">
              Admin Full Suite
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
          {visibleQuickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => handleQuickJump(action)}
                className={`p-2.5 rounded-xl border text-left transition space-y-1 group ${
                  action.isTest
                    ? 'bg-purple-950/30 hover:bg-purple-950/60 border-purple-800/40 hover:border-purple-500'
                    : 'bg-slate-950/70 hover:bg-indigo-950/50 border-slate-800 hover:border-indigo-500/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Icon className={`w-4 h-4 ${action.color} group-hover:scale-110 transition`} />
                  {action.hotkey && (
                    <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-800 text-slate-400">
                      {action.hotkey}
                    </span>
                  )}
                </div>
                <div className="font-semibold text-slate-200 text-xs truncate">{action.label}</div>
                <div className="text-[10px] text-slate-500 truncate">{action.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Operational Workspace (Left 7 Cols / Right 5 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Approvals Queue + Role-Specific Primary Table (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Pending Approvals Queue (Manager / Admin Only) */}
          {canApprove && totalPendingApprovals > 0 && (
            <div className="bg-amber-950/30 border border-amber-500/40 rounded-2xl p-4 shadow-md space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-amber-300">
                  <Clock className="w-4 h-4" />
                  <span>Pending Supervisor Approvals ({totalPendingApprovals})</span>
                </div>
                <span className="text-[10px] text-amber-400/80">Section 10 & 11 Thresholds</span>
              </div>

              <div className="space-y-2">
                {pendingAdjustments.map((adj) => (
                  <div
                    key={adj.id}
                    className="bg-slate-950/80 border border-amber-900/60 rounded-xl p-2.5 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="font-semibold text-slate-200">
                        Stock Count Adjustment: {adj.productName}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Doc: {adj.docNumber} • Variance:{' '}
                        {adj.adjustmentQty > 0 ? `+${adj.adjustmentQty}` : adj.adjustmentQty} units (₹
                        {adj.valuationImpact})
                      </div>
                    </div>
                    <button
                      onClick={() => handleQuickApproveAdjustment(adj.id)}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-bold flex items-center gap-1 transition shrink-0"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                    </button>
                  </div>
                ))}

                {pendingRateChanges.map((rc) => (
                  <div
                    key={rc.id}
                    className="bg-slate-950/80 border border-amber-900/60 rounded-xl p-2.5 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="font-semibold text-slate-200">
                        Selling Rate Proposal: {rc.productName}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Doc: {rc.docNumber} • ₹{rc.oldRate} →{' '}
                        <strong className="text-emerald-400">₹{rc.newRate}</strong> (MRP: ₹{rc.mrp})
                      </div>
                    </div>
                    <button
                      onClick={() => handleQuickApproveRate(rc.id)}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-bold flex items-center gap-1 transition shrink-0"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Table A: Recent Invoices (For Billing / Sales Permitted Roles) */}
          {canBilling || canBillingReturn ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-md">
              <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <span className="font-bold text-white text-xs">Recent Posted Invoices</span>
                <div className="flex items-center gap-2">
                  <ExportButtons
                    data={companyInvoices.slice(0, 20).map((inv, idx) => ({
                      '#': idx + 1,
                      'Invoice #': inv.docNumber,
                      'Date': new Date(inv.date).toLocaleDateString(),
                      'Customer': inv.customerName || 'Walk-in',
                      'Items': inv.lines?.length || 0,
                      'Net Payable': `₹${Number(inv.netPayable).toFixed(2)}`
                    }))}
                    filename="DASHBOARD_RECENT_INVOICES"
                    title="RECENT POSTED INVOICES"
                    size="small"
                  />
                  <button
                    onClick={() => setActiveTab('billing_return')}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
                  >
                    <span>View All ({companyInvoices.length})</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Invoice #</th>
                      <th className="py-2.5 px-3">Customer</th>
                      <th className="py-2.5 px-2 text-center">Items</th>
                      <th className="py-2.5 px-3 text-right">Net Payable</th>
                      <th className="py-2.5 px-3 text-center">Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {companyInvoices.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="py-6 text-center text-slate-500 text-xs">
                          No posted sales invoices in this store terminal yet.
                        </td>
                      </tr>
                    ) : (
                      companyInvoices.slice(0, 5).map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-800/30">
                          <td className="py-2 px-3 font-mono font-bold text-indigo-300">{inv.docNumber}</td>
                          <td className="py-2 px-3 text-slate-200">{inv.customerName}</td>
                          <td className="py-2 px-2 text-center font-bold text-slate-400">{inv.lines.length}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-white">
                            ₹{Number(inv.netPayable).toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              onClick={() => setReceiptModalInvoice(inv)}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                              title="Print Thermal / A4 Receipt"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : canStock || canStockAdjustment || canStockTransfer ? (
            /* Table B: Recent Stock Movements (For Inventory / Warehouse Roles) */
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-md">
              <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <span className="font-bold text-white text-xs">Recent Stock Ledger Movements</span>
                <div className="flex items-center gap-2">
                  <ExportButtons
                    data={recentStockMovements.map((m, idx) => ({
                      '#': idx + 1,
                      'Doc #': m.docNumber,
                      'Type': m.type || m.documentType,
                      'Product': m.productName,
                      'Quantity': m.quantityDelta > 0 ? `+${m.quantityDelta}` : m.quantityDelta,
                      'Date': new Date(m.timestamp).toLocaleDateString()
                    }))}
                    filename="DASHBOARD_RECENT_STOCK_MOVEMENTS"
                    title="RECENT STOCK MOVEMENTS"
                    size="small"
                  />
                  <button
                    onClick={() => setActiveTab('stock')}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
                  >
                    <span>Open Stock Ledger</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Doc #</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Product</th>
                      <th className="py-2.5 px-3 text-right">Quantity</th>
                      <th className="py-2.5 px-3 text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {recentStockMovements.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="py-6 text-center text-slate-500 text-xs">
                          No stock movements recorded yet.
                        </td>
                      </tr>
                    ) : (
                      recentStockMovements.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-800/30">
                          <td className="py-2 px-3 font-mono font-bold text-indigo-300">{m.docNumber}</td>
                          <td className="py-2 px-3">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 font-mono">
                              {m.movementType}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-200">{m.productName}</td>
                          <td
                            className={`py-2 px-3 text-right font-mono font-bold ${
                              m.quantity > 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-400 text-[11px]">
                            {new Date(m.timestamp).toLocaleDateString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : canPurchase || canPurchaseOrder ? (
            /* Table C: Recent Purchases & Inward Bills (For Procurement Roles) */
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-md">
              <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <span className="font-bold text-white text-xs">Recent Purchase Invoices & Orders</span>
                <div className="flex items-center gap-2">
                  <ExportButtons
                    data={recentPurchases.map((p, idx) => ({
                      '#': idx + 1,
                      'Bill / PO #': p.invoiceNumber || p.docNumber,
                      'Supplier': p.supplierName,
                      'Items': (p.lines || []).length,
                      'Total Amount': `₹${Number(p.grandTotal || p.totalAmount || 0).toFixed(2)}`,
                      'Status': p.status
                    }))}
                    filename="DASHBOARD_RECENT_PURCHASES"
                    title="RECENT PURCHASES & ORDERS"
                    size="small"
                  />
                  <button
                    onClick={() => setActiveTab('purchase')}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
                  >
                    <span>View All Purchases</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Bill / PO #</th>
                      <th className="py-2.5 px-3">Supplier</th>
                      <th className="py-2.5 px-2 text-center">Items</th>
                      <th className="py-2.5 px-3 text-right">Total (₹)</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {recentPurchases.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="py-6 text-center text-slate-500 text-xs">
                          No purchase invoices recorded yet.
                        </td>
                      </tr>
                    ) : (
                      recentPurchases.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-800/30">
                          <td className="py-2 px-3 font-mono font-bold text-sky-300">{p.invoiceNumber || p.docNumber}</td>
                          <td className="py-2 px-3 text-slate-200">{p.supplierName}</td>
                          <td className="py-2 px-2 text-center font-bold text-slate-400">
                            {(p.lines || []).length}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-white">
                            ₹{Number(p.grandTotal || p.totalAmount || 0).toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-800/50">
                              {p.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : canCreditCustomer ? (
            /* Table D: Customer Credit Accounts */
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-md">
              <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <span className="font-bold text-white text-xs">Credit Customers Directory</span>
                <div className="flex items-center gap-2">
                  <ExportButtons
                    data={(db.customers || []).map((cust, idx) => ({
                      '#': idx + 1,
                      'Customer Name': cust.name,
                      'Phone': cust.phone || '',
                      'Credit Limit': `₹${Number(cust.creditLimit || 0).toLocaleString('en-IN')}`,
                      'Current Balance': `₹${Number(cust.creditOutstanding || 0).toLocaleString('en-IN')}`
                    }))}
                    filename="DASHBOARD_CREDIT_CUSTOMERS"
                    title="CUSTOMER CREDIT ACCOUNTS"
                    size="small"
                  />
                  <button
                    onClick={() => setActiveTab('credit_customer')}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
                  >
                    <span>Manage Customers</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Customer Name</th>
                      <th className="py-2.5 px-3">Phone</th>
                      <th className="py-2.5 px-3 text-right">Credit Limit</th>
                      <th className="py-2.5 px-3 text-right">Current Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {(db.customers || []).slice(0, 5).map((cust) => (
                      <tr key={cust.id} className="hover:bg-slate-800/30">
                        <td className="py-2 px-3 font-semibold text-slate-200">{cust.name}</td>
                        <td className="py-2 px-3 text-slate-400">{cust.phone || '—'}</td>
                        <td className="py-2 px-3 text-right font-mono text-slate-300">
                          ₹{Number(cust.creditLimit || 0).toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-amber-400">
                          ₹{Number(cust.currentBalance || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Table E: System Information Overview */
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-md space-y-3">
              <div className="flex items-center gap-2 font-bold text-white text-sm">
                <Activity className="w-4 h-4 text-indigo-400" />
                <span>Active Terminal Privileges</span>
              </div>
              <p className="text-xs text-slate-400">
                You are currently authenticated as <strong>{currentUser.name}</strong> under role{' '}
                <span className="text-indigo-300 font-semibold">{roleDisplayName}</span>. Your workspace displays
                the modules explicitly authorized for your security profile.
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-500 uppercase font-bold">Authorized Menus</div>
                  <div className="text-lg font-bold text-white mt-0.5">{permittedMenusCount} Modules</div>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-500 uppercase font-bold">Company Isolation</div>
                  <div className="text-lg font-bold text-emerald-400 mt-0.5">Enforced</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Tender Split / Warehouse Distribution / Suppliers (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Top Right Widget: Payment Tender Split (Sales / Finance Roles) */}
          {canBilling || canDayClose ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md space-y-3 text-xs">
              <span className="font-bold text-white text-xs">Payment Tender Split</span>

              <div className="space-y-2.5">
                <div>
                  <div className="flex justify-between text-slate-400 mb-1">
                    <span>Cash Payment</span>
                    <span className="font-mono text-emerald-400">
                      ₹{cashTotal.toFixed(2)} (
                      {allTendersTotal > 0 ? ((cashTotal / allTendersTotal) * 100).toFixed(1) : 0}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-1.5 rounded-full"
                      style={{ width: `${allTendersTotal > 0 ? (cashTotal / allTendersTotal) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-slate-400 mb-1">
                    <span>UPI / Instant QR</span>
                    <span className="font-mono text-blue-400">
                      ₹{upiTotal.toFixed(2)} (
                      {allTendersTotal > 0 ? ((upiTotal / allTendersTotal) * 100).toFixed(1) : 0}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full"
                      style={{ width: `${allTendersTotal > 0 ? (upiTotal / allTendersTotal) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-slate-400 mb-1">
                    <span>Credit / Debit Card</span>
                    <span className="font-mono text-purple-400">
                      ₹{cardTotal.toFixed(2)} (
                      {allTendersTotal > 0 ? ((cardTotal / allTendersTotal) * 100).toFixed(1) : 0}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-purple-500 h-1.5 rounded-full"
                      style={{ width: `${allTendersTotal > 0 ? (cardTotal / allTendersTotal) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-slate-400 mb-1">
                    <span>On-Account Customer Credit</span>
                    <span className="font-mono text-amber-400">
                      ₹{creditTotal.toFixed(2)} (
                      {allTendersTotal > 0 ? ((creditTotal / allTendersTotal) * 100).toFixed(1) : 0}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-amber-500 h-1.5 rounded-full"
                      style={{ width: `${allTendersTotal > 0 ? (creditTotal / allTendersTotal) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : canStock ? (
            /* Top Right Widget: Warehouse Stock Distribution (For Inventory Roles) */
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md space-y-2.5 text-xs">
              <span className="font-bold text-white text-xs">Branch Warehouse Distribution</span>

              <div className="space-y-2">
                {storeWarehouses.map((wh) => {
                  const whBal = (db.stockBalances || []).filter((b) => b.warehouseId === wh.id);
                  const totalUnits = whBal.reduce((s, b) => s + Number(b.quantity), 0);
                  return (
                    <div
                      key={wh.id}
                      className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-semibold text-slate-200">{wh.name}</div>
                        <div className="text-[10px] text-slate-500">
                          {wh.type} • {wh.isSellable ? 'Sellable' : 'Quarantine'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-bold text-indigo-300">{totalUnits} Units</div>
                        <div className="text-[10px] text-slate-400">{whBal.length} SKUs</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : canPurchase ? (
            /* Top Right Widget: Suppliers Directory (For Procurement Roles) */
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md space-y-2.5 text-xs">
              <span className="font-bold text-white text-xs">Supplier Directory</span>

              <div className="space-y-2">
                {(db.suppliers || []).slice(0, 4).map((supp) => (
                  <div
                    key={supp.id}
                    className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold text-slate-200">{supp.name}</div>
                      <div className="text-[10px] text-slate-500">
                        GSTIN: {supp.gstin || 'Unregistered'} • {supp.city || 'India'}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800/50">
                        {supp.active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Top Right Widget: Default Session Details */
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md space-y-2.5 text-xs">
              <span className="font-bold text-white text-xs">Security & Audit Session</span>
              <p className="text-[11px] text-slate-400">
                Operating under standard ERP row-level locking and isolation rules. All actions in this session are
                permanently attributed to your user ID.
              </p>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 font-mono text-[10px] text-slate-400">
                User: {currentUser.id} • Store: {activeStore.id}
              </div>
            </div>
          )}

          {/* Bottom Right Widget: Low Stock Alerts or Warehouse Breakdown */}
          {canStock || canPurchase || canPurchaseOrder ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-xs flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Stock Reorder Warning</span>
                </span>
                <span className="text-[10px] text-amber-400 font-semibold">{lowStockItems.length} Alerts</span>
              </div>

              <div className="space-y-2">
                {lowStockItems.length === 0 ? (
                  <div className="text-center py-4 text-slate-500 text-xs">
                    All SKUs are above safe replenishment thresholds.
                  </div>
                ) : (
                  lowStockItems.slice(0, 4).map((b) => {
                    const prod = (db.products || []).find((p) => p.id === b.productId);
                    return (
                      <div
                        key={b.id}
                        className="bg-slate-950 p-2 rounded-xl border border-amber-900/40 flex items-center justify-between"
                      >
                        <div>
                          <div className="font-semibold text-slate-200 text-[11px]">{prod?.name || b.productId}</div>
                          <div className="text-[10px] text-slate-500">
                            Min Threshold: {prod?.minStockAlert || 5} units
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-amber-400 text-xs">{b.quantity} In Stock</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : canBilling ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md space-y-2.5 text-xs">
              <span className="font-bold text-white text-xs">Branch Warehouse Distribution</span>

              <div className="space-y-2">
                {storeWarehouses.slice(0, 3).map((wh) => {
                  const whBal = (db.stockBalances || []).filter((b) => b.warehouseId === wh.id);
                  const totalUnits = whBal.reduce((s, b) => s + Number(b.quantity), 0);
                  return (
                    <div
                      key={wh.id}
                      className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-semibold text-slate-200">{wh.name}</div>
                        <div className="text-[10px] text-slate-500">
                          {wh.type} • {wh.isSellable ? 'Sellable' : 'Quarantine'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-bold text-indigo-300">{totalUnits} Units</div>
                        <div className="text-[10px] text-slate-400">{whBal.length} SKUs</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
