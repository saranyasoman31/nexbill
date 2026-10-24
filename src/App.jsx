// NexBill ERP Enterprise Suite - Main Application Component
import React, { useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import Header from './components/Header';
import Navigation from './components/Navigation';
import LoginPage from './components/views/LoginPage';
import DashboardView from './components/views/DashboardView';
import POSBillingView from './components/views/POSBillingView';
import InvoicesAndReturnsView from './components/views/InvoicesAndReturnsView';
import InventoryView from './components/views/InventoryView';
import PurchasingView from './components/views/PurchasingView';
import TransfersView from './components/views/TransfersView';
import StockAdjustmentView from './components/views/StockAdjustmentView';
import PricingView from './components/views/PricingView';
import DayCloseView from './components/views/DayCloseView';
import TallyExportView from './components/views/TallyExportView';
import AuditLogsView from './components/views/AuditLogsView';
import AcceptanceTestsView from './components/views/AcceptanceTestsView';
import MastersView from './components/views/MastersView';
import SettingsView from './components/views/SettingsView';
import CreditCustomerView from './components/views/CreditCustomerView';
import MasterEntitiesView from './components/views/MasterEntitiesView';
import PurchaseOrderView from './components/views/PurchaseOrderView';
import PurchaseReturnView from './components/views/PurchaseReturnView';
import InitialStockView from './components/views/InitialStockView';
import ReportsView from './components/views/ReportsView';
import InvoiceReceiptModal from './components/modals/InvoiceReceiptModal';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X, ShieldAlert } from 'lucide-react';

function ERPAppContent() {
  const {
    isAuthenticated,
    activeTab,
    setActiveTab,
    toast,
    setToast,
    activeMasterSubEntity,
    settingsSubTab,
    reportsSubTab,
    hasPermission,
  } = useApp();

  // Global Keyboard Shortcuts (F1 for Dashboard, F2 for Billing)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F1') {
        e.preventDefault();
        setActiveTab('dashboard');
      } else if (e.key === 'F2') {
        e.preventDefault();
        setActiveTab('billing');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveTab]);

  // If not authenticated, display login page with Captcha
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
        {/* Toast Notification Banner on Login */}
        {toast && (
          <div className="fixed top-3 right-4 z-50 animate-bounce duration-300">
            <div
              className={`flex items-start gap-3 p-3.5 rounded-xl border shadow-2xl backdrop-blur-md max-w-md ${
                toast.type === 'success'
                  ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-100'
                  : 'bg-rose-950/90 border-rose-500/50 text-rose-100'
              }`}
            >
              {toast.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 text-xs">
                {toast.title && <div className="font-bold text-white text-sm mb-0.5">{toast.title}</div>}
                <div>{toast.message}</div>
              </div>
              <button onClick={() => setToast(null)} className="text-slate-400 hover:text-white p-0.5">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        <LoginPage />
      </div>
    );
  }

  // Map activeTab aliases to canonical system menu ID
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
      case 'audit':
      case 'backlog': return 'reports';
      case 'masters': return activeMasterSubEntity || 'product';
      default: return tab;
    }
  };

  const targetMenuId = getMenuIdForTab(activeTab);
  const isSpecialTab = activeTab === 'dashboard' || activeTab === 'tests';
  const hasViewAccess = isSpecialTab || hasPermission(targetMenuId, 'view');

  return (
    <div className="h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-600 selection:text-white overflow-hidden">
      {/* Toast Notification Banner */}
      {toast && (
        <div className="fixed top-3 right-4 z-50 animate-bounce duration-300">
          <div
            className={`flex items-start gap-3 p-3.5 rounded-xl border shadow-2xl backdrop-blur-md max-w-md ${
              toast.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-100'
                : toast.type === 'warning'
                ? 'bg-amber-950/90 border-amber-500/50 text-amber-100'
                : toast.type === 'error'
                ? 'bg-rose-950/90 border-rose-500/50 text-rose-100'
                : 'bg-indigo-950/90 border-indigo-500/50 text-indigo-100'
            }`}
          >
            {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />}
            {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />}
            {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />}
            {toast.type === 'info' && <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />}

            <div className="flex-1 text-xs">
              {toast.title && <div className="font-bold text-white text-sm mb-0.5">{toast.title}</div>}
              <div>{toast.message}</div>
            </div>

            <button
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-white transition p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header with Multi-Company, Store, Warehouse, Role Switcher, Sidebar Toggle & Sign Out */}
      <Header />

      {/* Main Container: Sidebar + Content Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar */}
        <Navigation />

        {/* Main Content Workspace */}
        <main className="flex-1 overflow-y-auto min-w-0 bg-slate-950 scrollbar-thin">
          {!hasViewAccess ? (
            <div className="max-w-xl mx-auto px-4 py-20 text-center">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-4">
                <div className="w-14 h-14 rounded-full bg-rose-950/80 border border-rose-500/50 flex items-center justify-center mx-auto text-rose-400">
                  <ShieldAlert className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Access Restricted</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Your assigned role does not grant view permissions for the <span className="text-slate-200 font-semibold">{targetMenuId.replace(/_/g, ' ')}</span> module.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-xs shadow-md transition"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Exact Menus requested by user */}
              {activeTab === 'credit_customer' && <CreditCustomerView />}
              {activeTab === 'main_category' && <MasterEntitiesView defaultEntity="main_category" />}
              {activeTab === 'category' && <MasterEntitiesView defaultEntity="category" />}
              {activeTab === 'brand' && <MasterEntitiesView defaultEntity="brand" />}
              {activeTab === 'supplier' && <MasterEntitiesView defaultEntity="supplier" />}
              {activeTab === 'unit' && <MasterEntitiesView defaultEntity="unit" />}
              {activeTab === 'company' && <MasterEntitiesView defaultEntity="company" />}
              {activeTab === 'product' && <MasterEntitiesView defaultEntity="product" />}
              {activeTab === 'staff' && <MasterEntitiesView defaultEntity="staff" />}
              {activeTab === 'payment_mode' && <MasterEntitiesView defaultEntity="payment_mode" />}
              {activeTab === 'tax' && <MasterEntitiesView defaultEntity="tax" />}
              {activeTab === 'branch' && <MasterEntitiesView defaultEntity="branch" />}
              {activeTab === 'purchase_order' && <PurchaseOrderView />}
              {(activeTab === 'purchase' || activeTab === 'purchases') && <PurchasingView />}
              {activeTab === 'purchase_return' && <PurchaseReturnView />}
              {activeTab === 'initial' && <InitialStockView />}
              {(activeTab === 'stock' || activeTab === 'inventory') && <InventoryView />}
              {(activeTab === 'stock_adjustment' || activeTab === 'adjustments') && <StockAdjustmentView />}
              {(activeTab === 'rate_change' || activeTab === 'pricing') && <PricingView />}
              {(activeTab === 'billing' || activeTab === 'pos') && <POSBillingView />}
              {(activeTab === 'billing_return' || activeTab === 'invoices') && <InvoicesAndReturnsView />}
              {(activeTab === 'day_close' || activeTab === 'dayclose') && <DayCloseView />}
              {(activeTab === 'stock_transfer' || activeTab === 'transfers') && <TransfersView />}
              {(activeTab === 'reports' || activeTab === 'tally' || activeTab === 'audit' || activeTab === 'backlog') && (
                <ReportsView initialReportTab={reportsSubTab || (activeTab === 'backlog' ? 'backlog' : null)} />
              )}
              {activeTab === 'settings' && <SettingsView initialSubTab={settingsSubTab} />}

              {/* Quick Tools & Acceptance Tests */}
              {activeTab === 'dashboard' && <DashboardView />}
              {activeTab === 'tests' && <AcceptanceTestsView />}
              {activeTab === 'masters' && <MasterEntitiesView defaultEntity={activeMasterSubEntity} />}
            </>
          )}
        </main>
      </div>

      {/* Printable Invoice Modal */}
      <InvoiceReceiptModal />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <ERPAppContent />
    </AppProvider>
  );
}
