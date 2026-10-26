// ReportsView: Comprehensive ERP Intelligence, Sales, Purchases, Stock Valuation, GST & Tally Exports
import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { TallyExportService } from '../../services/tallyExportService.js';
import {
  BarChart3,
  TrendingUp,
  FileSpreadsheet,
  DownloadCloud,
  ShieldAlert,
  Boxes,
  Truck,
  ShoppingCart,
  DollarSign,
  Percent,
  Search,
  Calendar,
  Filter,
  CheckCircle2,
  Printer,
  FileCode,
  Activity,
  PackageCheck,
  Store,
  Layers,
} from 'lucide-react';
import ExportButtons from '../common/ExportButtons.jsx';
import BacklogReportView from './BacklogReportView.jsx';

export default function ReportsView({ initialReportTab = null }) {
  const {
    db,
    activeCompany,
    activeStore,
    currentUser,
    notify,
    triggerRefresh,
    reportsSubTab,
    setReportsSubTab,
    hasPermission,
  } = useApp();

  const [activeReportTab, setActiveReportTab] = useState(
    initialReportTab || reportsSubTab || 'sales'
  );

  useEffect(() => {
    if (reportsSubTab) {
      setActiveReportTab(reportsSubTab);
    }
  }, [reportsSubTab]);

  const handleTabChange = (tab) => {
    setActiveReportTab(tab);
    if (setReportsSubTab) setReportsSubTab(tab);
  };

  const [dateFilter, setDateFilter] = useState('ALL'); // ALL | TODAY | MONTH
  const [search, setSearch] = useState('');

  // 1. Sales Data
  const postedInvoices = (db.invoices || []).filter((i) => i.status === 'POSTED');
  const totalRevenue = postedInvoices.reduce((sum, i) => sum + i.netPayable, 0);
  const totalTax = postedInvoices.reduce((sum, i) => sum + (i.totalTax || 0), 0);
  const totalInvoices = postedInvoices.length;

  // Tender Split
  let cashTotal = 0;
  let upiTotal = 0;
  let cardTotal = 0;
  let creditTotal = 0;
  postedInvoices.forEach((inv) => {
    (inv.tenders || []).forEach((t) => {
      const amt = Number(t.amount) || 0;
      if (t.method === 'CASH') cashTotal += amt;
      else if (t.method === 'UPI') upiTotal += amt;
      else if (t.method === 'CARD' || t.method?.includes('CARD')) cardTotal += amt;
      else if (t.method === 'CREDIT') creditTotal += amt;
    });
  });

  // 2. Purchase & Inward Data (Clean Separation of Purchases vs Initial Stock)
  const [purchasesFilterMode, setPurchasesFilterMode] = useState('purchases_only'); // 'purchases_only' | 'initial_stock_only' | 'all'
  const allInwardPurchases = db.purchases || [];
  const standardPurchases = allInwardPurchases.filter(
    (p) => !p.isInitialStock && p.entryType !== 'INITIAL_STOCK' && !p.docNumber?.startsWith('INIT-')
  );
  const initialStockInwardPurchases = allInwardPurchases.filter(
    (p) => p.isInitialStock || p.entryType === 'INITIAL_STOCK' || p.docNumber?.startsWith('INIT-')
  );

  // Standard Purchases KPI totals (Does NOT count Initial Stock into purchase expenses or ITC)
  const standardPurchasesAmount = standardPurchases.reduce((sum, p) => sum + (Number(p.netAmount || p.grandTotal) || 0), 0);
  const standardPurchaseTax = standardPurchases.reduce((sum, p) => sum + (Number(p.totalTax) || 0), 0);
  const initialStockInwardAmount = initialStockInwardPurchases.reduce((sum, p) => sum + (Number(p.netAmount || p.grandTotal) || 0), 0);

  const displayPurchases = purchasesFilterMode === 'purchases_only'
    ? standardPurchases
    : purchasesFilterMode === 'initial_stock_only'
    ? initialStockInwardPurchases
    : allInwardPurchases;

  // 2.5 Dedicated Initial Stock Report Data
  const [initialStockWarehouseFilter, setInitialStockWarehouseFilter] = useState('ALL');
  const [initialStockSearch, setInitialStockSearch] = useState('');

  const initialStockRecords = useMemo(() => {
    const list = (db.initialStocks || []).map((item) => {
      const prod = (db.products || []).find((p) => p.id === item.productId);
      const wh = (db.warehouses || []).find((w) => w.id === item.warehouseId);
      const qty = Number(item.quantity || 0);
      const rate = Number(item.valuationRate || prod?.costRate || 0);
      const totalVal = Number(item.totalValuation) || (qty * rate);
      return {
        ...item,
        productName: item.productName || prod?.name || item.productId,
        sku: prod?.sku || '',
        category: prod?.category || '',
        warehouseName: wh?.name || item.warehouseId,
        qty,
        rate,
        totalVal,
      };
    });
    return list;
  }, [db.initialStocks, db.products, db.warehouses]);

  const filteredInitialStockRecords = useMemo(() => {
    return initialStockRecords.filter((item) => {
      if (initialStockWarehouseFilter !== 'ALL' && item.warehouseId !== initialStockWarehouseFilter) {
        return false;
      }
      if (initialStockSearch.trim()) {
        const q = initialStockSearch.trim().toLowerCase();
        return (
          item.docNumber?.toLowerCase().includes(q) ||
          item.productName?.toLowerCase().includes(q) ||
          item.sku?.toLowerCase().includes(q) ||
          item.notes?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [initialStockRecords, initialStockWarehouseFilter, initialStockSearch]);

  const totalInitialStockValuation = initialStockRecords.reduce((sum, i) => sum + i.totalVal, 0);
  const totalInitialStockUnits = initialStockRecords.reduce((sum, i) => sum + i.qty, 0);
  const initialStockDocCount = new Set(initialStockRecords.map((i) => i.docNumber)).size;

  // 3. Stock Report Data (with Condition Breakdown: Initial Stock, Purchased, Sales, Current Balance)
  const [stockWarehouseFilter, setStockWarehouseFilter] = useState('ALL');
  const [stockSearch, setStockSearch] = useState('');

  const stockReportLedger = useMemo(() => {
    return (db.stockBalances || []).map((b) => {
      const prod = (db.products || []).find((p) => p.id === b.productId);
      const wh = (db.warehouses || []).find((w) => w.id === b.warehouseId);

      const movements = (db.stockMovements || []).filter(
        (m) => m.productId === b.productId && m.warehouseId === b.warehouseId
      );

      const initialStockQty = movements
        .filter((m) => m.docType === 'INITIAL_STOCK')
        .reduce((sum, m) => sum + (Number(m.qtyChange ?? m.quantityDelta ?? m.quantity) || 0), 0);

      const purchasedInwardQty = movements
        .filter((m) => m.docType === 'PURCHASE_IN' || m.docType === 'PURCHASE')
        .reduce((sum, m) => sum + (Number(m.qtyChange ?? m.quantityDelta ?? m.quantity) || 0), 0);

      const salesOutwardQty = Math.abs(
        movements
          .filter((m) => m.docType === 'SALES_OUT' || m.docType === 'POS_SALE' || m.docType === 'SALE')
          .reduce((sum, m) => sum + (Number(m.qtyChange ?? m.quantityDelta ?? m.quantity) || 0), 0)
      );

      const currentStock = Number(b.quantity || 0);
      const valRate = Number(b.valuationRate || prod?.costRate || 0);
      const totalVal = currentStock * valRate;
      const isLow = currentStock <= (prod?.minStockAlert || 5);

      return {
        id: b.id,
        warehouseId: b.warehouseId,
        warehouseName: wh?.name || b.warehouseId,
        productId: b.productId,
        productName: prod?.name || b.productId,
        sku: prod?.sku || '',
        category: prod?.category || '',
        initialStockQty,
        purchasedInwardQty,
        salesOutwardQty,
        currentStock,
        valRate,
        totalVal,
        isLow,
      };
    });
  }, [db.stockBalances, db.products, db.warehouses, db.stockMovements]);

  const filteredStockLedger = useMemo(() => {
    return stockReportLedger.filter((s) => {
      if (stockWarehouseFilter !== 'ALL' && s.warehouseId !== stockWarehouseFilter) return false;
      if (stockSearch.trim()) {
        const q = stockSearch.trim().toLowerCase();
        return (
          s.productName.toLowerCase().includes(q) ||
          s.sku.toLowerCase().includes(q) ||
          s.warehouseName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [stockReportLedger, stockWarehouseFilter, stockSearch]);

  const stockValuationTotal = stockReportLedger.reduce((sum, b) => sum + b.totalVal, 0);
  const lowStockProducts = stockReportLedger.filter((b) => b.isLow);

  // 4. GST Breakdown
  const totalCGST = postedInvoices.reduce((sum, i) => sum + (Number(i.cgstAmount) || 0), 0);
  const totalSGST = postedInvoices.reduce((sum, i) => sum + (Number(i.sgstAmount) || 0), 0);
  const totalIGST = postedInvoices.reduce((sum, i) => sum + (Number(i.igstAmount) || 0), 0);

  // Tally Export Handler
  const [tallyXmlOutput, setTallyXmlOutput] = useState('');
  const handleGenerateTally = () => {
    try {
      const batch = TallyExportService.generateExportBatch({
        fromDate: '2026-01-01',
        toDate: '2026-12-31',
        userId: currentUser.id,
      });
      setTallyXmlOutput(batch.xmlContent);
      notify('success', `Generated ${batch.vouchersCount} Tally Prime XML vouchers!`, 'Tally Export Ready');
      triggerRefresh();
    } catch (e) {
      notify('error', e.message, 'Tally Export Failed');
    }
  };

  const handleDownloadXml = () => {
    if (!tallyXmlOutput) return;
    const blob = new Blob([tallyXmlOutput], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NexBill_Tally_Vouchers_${new Date().toISOString().slice(0, 10)}.xml`;
    a.click();
    URL.revokeObjectURL(url);
    notify('success', 'Tally Prime XML file downloaded successfully.', 'Download Complete');
  };

  const getReportExportData = () => {
    if (activeReportTab === 'sales') {
      return postedInvoices.map((inv, idx) => ({
        '#': idx + 1,
        'Invoice #': inv.docNumber,
        'Date': new Date(inv.date).toLocaleDateString(),
        'Customer': inv.customerName || 'Walk-in',
        'Taxable (₹)': inv.taxableAmount?.toFixed(2),
        'GST (₹)': inv.totalTax?.toFixed(2),
        'Net Payable (₹)': inv.netPayable?.toFixed(2),
        'Tender Method': (inv.tenders || []).map((t) => t.method).join(', ') || 'CASH',
      }));
    }
    if (activeReportTab === 'purchases') {
      return displayPurchases.map((p, idx) => ({
        '#': idx + 1,
        'Inward #': p.docNumber,
        'Type': p.isInitialStock || p.entryType === 'INITIAL_STOCK' || p.docNumber?.startsWith('INIT-') ? 'INITIAL_STOCK' : 'PURCHASE',
        'Date': new Date(p.date).toLocaleDateString(),
        'Supplier': p.supplierName,
        'Vendor Invoice #': p.isInitialStock || p.entryType === 'INITIAL_STOCK' || p.docNumber?.startsWith('INIT-') ? 'OPENING_STOCK' : p.supplierInvoiceNo,
        'Taxable (₹)': p.subtotal?.toFixed(2) || '0.00',
        'Tax (₹)': p.totalTax?.toFixed(2) || '0.00',
        'Net Amount (₹)': p.netAmount?.toFixed(2) || '0.00',
      }));
    }
    if (activeReportTab === 'initial_stock') {
      return filteredInitialStockRecords.map((item, idx) => ({
        '#': idx + 1,
        'Cutover Doc #': item.docNumber,
        'Effective Date': item.effectiveDate || item.date || '—',
        'Warehouse': item.warehouseName,
        'Product Name': item.productName,
        'SKU': item.sku || '—',
        'Opening Qty': item.qty,
        'Valuation Rate (₹)': item.rate.toFixed(2),
        'Total Valuation (₹)': item.totalVal.toFixed(2),
        'Source / Notes': item.notes || 'Initial Stock Cutover',
      }));
    }
    if (activeReportTab === 'stock') {
      return filteredStockLedger.map((s, idx) => ({
        '#': idx + 1,
        'Warehouse': s.warehouseName,
        'Product Name': s.productName,
        'SKU': s.sku,
        'Initial Stock Qty': s.initialStockQty,
        'Purchased Inward Qty': s.purchasedInwardQty,
        'Sales Outward Qty': s.salesOutwardQty,
        'Available Current Stock': s.currentStock,
        'Valuation Rate (₹)': s.valRate.toFixed(2),
        'Total Asset Value (₹)': s.totalVal.toFixed(2),
        'Status': s.isLow ? 'LOW STOCK' : 'ADEQUATE',
      }));
    }
    if (activeReportTab === 'gst') {
      return postedInvoices.map((inv, idx) => ({
        '#': idx + 1,
        'Invoice #': inv.docNumber,
        'Date': new Date(inv.date).toLocaleDateString(),
        'Customer Name': inv.customerName,
        'GSTIN': inv.customerGstin || 'URP (Unregistered)',
        'Taxable Value': `₹${inv.taxableAmount?.toFixed(2)}`,
        'CGST': `₹${inv.cgstAmount?.toFixed(2)}`,
        'SGST': `₹${inv.sgstAmount?.toFixed(2)}`,
        'IGST': `₹${inv.igstAmount?.toFixed(2)}`,
        'Total GST': `₹${inv.totalTax?.toFixed(2)}`,
        'Invoice Total': `₹${inv.netPayable?.toFixed(2)}`,
      }));
    }
    if (activeReportTab === 'backlog') {
      return (db.backlog || []).map((b, idx) => ({
        '#': idx + 1,
        'Timestamp': new Date(b.timestamp).toLocaleString(),
        'Authorized User': `${b.userName || b.userId} [${b.userRole || 'USER'}]`,
        'Workstation IP': b.ipAddress || '127.0.0.1',
        'Form / Module': b.formName,
        'Action': b.action,
        'Record Reference': b.recordRef || '—',
        'Audit Details & Context': b.details || '—',
      }));
    }
    if (activeReportTab === 'audit') {
      return (db.auditLogs || []).map((log, idx) => ({
        '#': idx + 1,
        'Timestamp': new Date(log.timestamp).toLocaleString(),
        'Event Action': log.action,
        'User ID': log.userId,
        'Audit Details': log.details,
      }));
    }
    return [];
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-3 sm:p-3.5 rounded-xl shadow-md">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 shrink-0">
            <BarChart3 className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-white text-sm truncate sm:overflow-visible">NexBill Financial & Operations Reports Hub</h3>
            <p className="text-[11px] text-slate-400 line-clamp-1 sm:line-clamp-none">
              Executive business analytics, sales registers, vendor payables, GST tax liability & Tally export
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {activeReportTab !== 'tally' && activeReportTab !== 'backlog' && (
            <ExportButtons
              data={getReportExportData()}
              filename={`REPORT_${activeReportTab.toUpperCase()}`}
              title={`${activeReportTab.toUpperCase()} REPORT`}
              pdfOrientation="landscape"
            />
          )}

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold border border-slate-700 transition"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Report Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto text-xs font-medium">
        <button
          onClick={() => handleTabChange('sales')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
            activeReportTab === 'sales'
              ? 'bg-indigo-600 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Sales & Revenue Report</span>
        </button>

        <button
          onClick={() => handleTabChange('purchases')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
            activeReportTab === 'purchases'
              ? 'bg-indigo-600 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Purchases & Vendor Register</span>
        </button>

        <button
          onClick={() => handleTabChange('initial_stock')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
            activeReportTab === 'initial_stock'
              ? 'bg-amber-600 text-white font-semibold shadow-md shadow-amber-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <PackageCheck className="w-4 h-4 text-amber-400" />
          <span>Initial Stock Report</span>
        </button>

        <button
          onClick={() => handleTabChange('stock')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
            activeReportTab === 'stock'
              ? 'bg-indigo-600 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Stock Valuation & Ledger</span>
        </button>

        <button
          onClick={() => handleTabChange('gst')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
            activeReportTab === 'gst'
              ? 'bg-indigo-600 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Percent className="w-4 h-4" />
          <span>GST Statutory (GSTR-1)</span>
        </button>

        <button
          onClick={() => handleTabChange('tally')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
            activeReportTab === 'tally'
              ? 'bg-indigo-600 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <DownloadCloud className="w-4 h-4" />
          <span>Tally Prime XML Export</span>
        </button>

        <button
          onClick={() => handleTabChange('backlog')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
            activeReportTab === 'backlog'
              ? 'bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Activity className="w-4 h-4 text-emerald-400" />
          <span>Backlog Activity Report</span>
        </button>

        <button
          onClick={() => handleTabChange('audit')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
            activeReportTab === 'audit'
              ? 'bg-indigo-600 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Audit Trail & Activity Log</span>
        </button>
      </div>

      {/* 1. SALES REPORT TAB */}
      {activeReportTab === 'sales' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <span className="text-[11px] text-slate-400">Total Net Revenue</span>
              <div className="text-xl font-bold font-mono text-emerald-400">
                ₹{totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-slate-500">{totalInvoices} Invoices Posted</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <span className="text-[11px] text-slate-400">Total Tax Collected</span>
              <div className="text-xl font-bold font-mono text-cyan-400">
                ₹{totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-slate-500">CGST + SGST + IGST</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <span className="text-[11px] text-slate-400">Cash Collections</span>
              <div className="text-xl font-bold font-mono text-indigo-400">
                ₹{cashTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-indigo-300 font-semibold">Till Cash In</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <span className="text-[11px] text-slate-400">Digital (UPI + Card)</span>
              <div className="text-xl font-bold font-mono text-purple-400">
                ₹{(upiTotal + cardTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-purple-300 font-semibold">Bank Settlements</span>
            </div>
          </div>

          {/* Sales Register Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md">
            <div className="p-3 border-b border-slate-800 flex justify-between items-center text-xs">
              <span className="font-bold text-white">Posted Sales Invoices Register</span>
              <span className="text-slate-400">{postedInvoices.length} Records</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[850px]">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Invoice #</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3 text-right">Taxable (₹)</th>
                    <th className="py-2.5 px-3 text-right">GST (₹)</th>
                    <th className="py-2.5 px-3 text-right">Net Payable (₹)</th>
                    <th className="py-2.5 px-3">Tender Method</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
                  {postedInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-800/40">
                      <td className="py-2 px-3 text-indigo-300 font-bold">{inv.docNumber}</td>
                      <td className="py-2 px-3 text-slate-400 font-sans">{new Date(inv.date).toLocaleDateString()}</td>
                      <td className="py-2 px-3 font-sans text-white">{inv.customerName}</td>
                      <td className="py-2 px-3 text-right text-slate-300">₹{inv.taxableAmount?.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right text-cyan-400">₹{inv.totalTax?.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right font-bold text-emerald-400">₹{inv.netPayable?.toFixed(2)}</td>
                      <td className="py-2 px-3 font-sans text-slate-400">
                        {inv.tenders?.map((t) => t.method).join(', ') || 'CASH'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. PURCHASES REPORT TAB */}
      {activeReportTab === 'purchases' && (
        <div className="space-y-4">
          {/* Purchases vs Initial Stock Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900 border border-slate-800 p-2.5 rounded-xl">
            <div className="inline-flex rounded-lg p-1 bg-slate-950 border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setPurchasesFilterMode('purchases_only')}
                className={`px-3 py-1 rounded-md font-semibold transition cursor-pointer ${
                  purchasesFilterMode === 'purchases_only'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Standard Purchases Only ({standardPurchases.length})
              </button>
              <button
                type="button"
                onClick={() => setPurchasesFilterMode('initial_stock_only')}
                className={`px-3 py-1 rounded-md font-semibold transition cursor-pointer ${
                  purchasesFilterMode === 'initial_stock_only'
                    ? 'bg-amber-600 text-white shadow'
                    : 'text-amber-400/80 hover:text-amber-300'
                }`}
              >
                Initial Stock Only ({initialStockInwardPurchases.length})
              </button>
              <button
                type="button"
                onClick={() => setPurchasesFilterMode('all')}
                className={`px-3 py-1 rounded-md font-semibold transition cursor-pointer ${
                  purchasesFilterMode === 'all'
                    ? 'bg-slate-700 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All Inward Records ({allInwardPurchases.length})
              </button>
            </div>

            <div className="text-xs text-slate-400">
              {purchasesFilterMode === 'purchases_only' && (
                <span className="text-emerald-400 font-medium">
                  ✓ Initial stock cutovers excluded from purchase turnover & ITC
                </span>
              )}
              {purchasesFilterMode === 'initial_stock_only' && (
                <span className="text-amber-400 font-medium">
                  Showing opening stock inward cutovers only
                </span>
              )}
              {purchasesFilterMode === 'all' && (
                <span className="text-slate-300 font-medium">
                  Showing combined purchases and opening cutovers
                </span>
              )}
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <span className="text-[11px] text-slate-400">
                {purchasesFilterMode === 'initial_stock_only' ? 'Initial Stock Valuation' : 'Total Inward Purchase Value'}
              </span>
              <div className="text-xl font-bold font-mono text-white">
                ₹{displayPurchases
                  .reduce((sum, p) => sum + (Number(p.netAmount || p.grandTotal) || 0), 0)
                  .toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-indigo-400 font-semibold">{displayPurchases.length} Inward Records</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <span className="text-[11px] text-slate-400">Input Tax Credit (ITC) Available</span>
              <div className="text-xl font-bold font-mono text-emerald-400">
                ₹{displayPurchases
                  .filter((p) => !p.isInitialStock && p.entryType !== 'INITIAL_STOCK' && !p.docNumber?.startsWith('INIT-'))
                  .reduce((sum, p) => sum + (Number(p.totalTax) || 0), 0)
                  .toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-emerald-300 font-semibold">
                {purchasesFilterMode === 'initial_stock_only'
                  ? 'No ITC on Initial Stock'
                  : 'Claimable against Output GST'}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <span className="text-[11px] text-slate-400">Opening Stock Inward Cutover</span>
              <div className="text-xl font-bold font-mono text-amber-400">
                ₹{initialStockInwardAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-amber-300/80 font-semibold">
                {initialStockInwardPurchases.length} Opening Batches Separated
              </span>
            </div>
          </div>

          {/* Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md">
            <div className="p-3 border-b border-slate-800 font-bold text-white text-xs flex items-center justify-between">
              <span>Vendor Inward & Purchase Invoices Register</span>
              <span className="text-slate-400">{displayPurchases.length} Records</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[850px]">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Inward Doc #</th>
                    <th className="py-2.5 px-2 text-center">Type</th>
                    <th className="py-2.5 px-3">Supplier Invoice #</th>
                    <th className="py-2.5 px-3">Supplier Name</th>
                    <th className="py-2.5 px-3 text-right">Subtotal (₹)</th>
                    <th className="py-2.5 px-3 text-right">Tax (₹)</th>
                    <th className="py-2.5 px-3 text-right">Net Value (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
                  {displayPurchases.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-8 text-center text-slate-500 font-sans">
                        No inward goods records found for selected filter.
                      </td>
                    </tr>
                  ) : (
                    displayPurchases.map((p) => {
                      const isInit = Boolean(
                        p.isInitialStock ||
                        p.entryType === 'INITIAL_STOCK' ||
                        p.docNumber?.startsWith('INIT-')
                      );
                      return (
                        <tr key={p.id} className="hover:bg-slate-800/40">
                          <td className="py-2 px-3 text-indigo-300 font-bold">{p.docNumber}</td>
                          <td className="py-2 px-2 text-center">
                            {isInit ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                                Initial Stock
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800">
                                Purchase
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-slate-300">
                            {isInit ? (
                              <span className="text-slate-500 italic text-[11px]">Opening Stock</span>
                            ) : (
                              <span className="font-bold">{p.supplierInvoiceNo}</span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-sans text-white">{p.supplierName}</td>
                          <td className="py-2 px-3 text-right text-slate-300">₹{Number(p.subtotal || 0).toFixed(2)}</td>
                          <td className="py-2 px-3 text-right text-emerald-400">₹{Number(p.totalTax || 0).toFixed(2)}</td>
                          <td className="py-2 px-3 text-right font-bold text-white">
                            ₹{Number(p.netAmount || p.grandTotal || 0).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2.5 INITIAL STOCK REPORT TAB */}
      {activeReportTab === 'initial_stock' && (
        <div className="space-y-4">
          {/* Metrics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <span className="text-[11px] text-slate-400">Total Opening Stock Valuation</span>
              <div className="text-xl font-bold font-mono text-amber-400">
                ₹{totalInitialStockValuation.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-amber-300/80 font-semibold">Total Cost Value</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <span className="text-[11px] text-slate-400">Total Opening Units</span>
              <div className="text-xl font-bold font-mono text-white">
                {totalInitialStockUnits.toLocaleString()}
              </div>
              <span className="text-[10px] text-slate-500">Across All Products</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <span className="text-[11px] text-slate-400">Cutover Documents / Batches</span>
              <div className="text-xl font-bold font-mono text-indigo-400">
                {initialStockDocCount}
              </div>
              <span className="text-[10px] text-indigo-300 font-semibold">Inward Cutover Batches</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <span className="text-[11px] text-slate-400">Initialized Locations</span>
              <div className="text-xl font-bold font-mono text-emerald-400">
                {new Set(initialStockRecords.map((i) => i.warehouseId)).size}
              </div>
              <span className="text-[10px] text-emerald-300 font-semibold">Active Warehouses</span>
            </div>
          </div>

          {/* Search, Filter & Export Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-3 rounded-xl text-xs">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Search by Doc #, Product, SKU..."
                  value={initialStockSearch}
                  onChange={(e) => setInitialStockSearch(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-64"
                />
              </div>

              <select
                value={initialStockWarehouseFilter}
                onChange={(e) => setInitialStockWarehouseFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
              >
                <option value="ALL">All Warehouses</option>
                {(db.warehouses || []).map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            <ExportButtons
              data={filteredInitialStockRecords.map((item, idx) => ({
                '#': idx + 1,
                'Cutover Doc #': item.docNumber,
                'Effective Date': item.effectiveDate || item.date || '—',
                'Warehouse': item.warehouseName,
                'Product Name': item.productName,
                'SKU': item.sku || '—',
                'Opening Qty': item.qty,
                'Valuation Rate (₹)': Number(item.rate).toFixed(2),
                'Total Valuation (₹)': Number(item.totalVal).toFixed(2),
                'Source / Notes': item.notes || 'Initial Stock Cutover',
              }))}
              filename="INITIAL_STOCK_REPORT"
              title="INITIAL STOCK OPENING INVENTORY CUTOVER REPORT"
              pdfOrientation="landscape"
            />
          </div>

          {/* Initial Stock Records Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md">
            <div className="p-3 border-b border-slate-800 font-bold text-white text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PackageCheck className="w-4 h-4 text-amber-400" />
                <span>Initial Stock Cutover Audit Ledger</span>
              </div>
              <span className="text-slate-400">{filteredInitialStockRecords.length} Items</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[850px]">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Cutover Doc #</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Warehouse / Branch</th>
                    <th className="py-2.5 px-3">Product Name</th>
                    <th className="py-2.5 px-2 text-center">Opening Qty</th>
                    <th className="py-2.5 px-3 text-right">Valuation Rate</th>
                    <th className="py-2.5 px-3 text-right">Total Asset Value</th>
                    <th className="py-2.5 px-3">Source & Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
                  {filteredInitialStockRecords.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="py-12 text-center text-slate-500 font-sans">
                        No initial stock cutover records found matching current criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredInitialStockRecords.map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 text-amber-300 font-bold">{item.docNumber}</td>
                        <td className="py-2.5 px-3 text-slate-400 font-sans">{item.effectiveDate || item.date || '—'}</td>
                        <td className="py-2.5 px-3 font-sans text-slate-200">{item.warehouseName}</td>
                        <td className="py-2.5 px-3 font-sans text-white font-bold">
                          {item.productName}
                          {item.sku && <span className="block text-[10px] text-slate-500 font-mono">SKU: {item.sku}</span>}
                        </td>
                        <td className="py-2.5 px-2 text-center font-bold text-white">{item.qty}</td>
                        <td className="py-2.5 px-3 text-right text-slate-300">₹{item.rate.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-amber-400">₹{item.totalVal.toFixed(2)}</td>
                        <td className="py-2.5 px-3 font-sans text-slate-400 text-xs truncate max-w-[200px]">
                          {item.notes || 'Opening Stock Inward'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. STOCK VALUATION & LEDGER TAB (BREAKDOWN: INITIAL STOCK, PURCHASED, SALES, BALANCE) */}
      {activeReportTab === 'stock' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <span className="text-[11px] text-slate-400">Total Stock Valuation (Cost Basis)</span>
              <div className="text-xl font-bold font-mono text-cyan-400">
                ₹{stockValuationTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-slate-400">{filteredStockLedger.length} Tracked Balances</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <span className="text-[11px] text-slate-400">Total Initial Stock Inflow</span>
              <div className="text-xl font-bold font-mono text-amber-400">
                {stockReportLedger.reduce((sum, s) => sum + s.initialStockQty, 0).toLocaleString()} Units
              </div>
              <span className="text-[10px] text-amber-300 font-semibold">Opening Inventory Inflow</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <span className="text-[11px] text-slate-400">Low Stock Reorder Alerts</span>
              <div
                className={`text-xl font-bold font-mono ${
                  lowStockProducts.length > 0 ? 'text-amber-400' : 'text-slate-400'
                }`}
              >
                {lowStockProducts.length} Items Below Threshold
              </div>
              <span className="text-[10px] text-amber-300 font-semibold">Immediate Purchase Indent Required</span>
            </div>
          </div>

          {/* Search, Filter & Export Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-3 rounded-xl text-xs">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Search products by SKU, name..."
                  value={stockSearch}
                  onChange={(e) => setStockSearch(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-64"
                />
              </div>

              <select
                value={stockWarehouseFilter}
                onChange={(e) => setStockWarehouseFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
              >
                <option value="ALL">All Warehouses</option>
                {(db.warehouses || []).map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            <ExportButtons
              data={filteredStockLedger.map((s, idx) => ({
                '#': idx + 1,
                'Warehouse': s.warehouseName,
                'Product Name': s.productName,
                'SKU': s.sku,
                'Initial Stock Qty': s.initialStockQty,
                'Purchased Inward Qty': s.purchasedInwardQty,
                'Sales Outward Qty': s.salesOutwardQty,
                'Available Current Stock': s.currentStock,
                'Valuation Rate': `₹${s.valRate.toFixed(2)}`,
                'Total Asset Value': `₹${s.totalVal.toFixed(2)}`,
                'Status': s.isLow ? 'LOW STOCK' : 'ADEQUATE',
              }))}
              filename="STOCK_LEDGER_VALUATION_REPORT"
              title="STOCK VALUATION & MOVEMENT LEDGER (INITIAL vs PURCHASED vs SALES)"
              pdfOrientation="landscape"
            />
          </div>

          {/* Stock Table with Condition Breakdown */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md">
            <div className="p-3 border-b border-slate-800 font-bold text-white text-xs flex items-center justify-between">
              <span>Warehouse Stock Balance Ledger (Initial Stock vs Purchased vs Outward Sales)</span>
              <span className="text-slate-400">{filteredStockLedger.length} Records</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[850px]">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Warehouse</th>
                    <th className="py-2.5 px-3">Product Name</th>
                    <th className="py-2.5 px-2 text-center text-amber-400">Initial Stock</th>
                    <th className="py-2.5 px-2 text-center text-indigo-400">Purchased In</th>
                    <th className="py-2.5 px-2 text-center text-rose-400">Sales Out</th>
                    <th className="py-2.5 px-3 text-center text-emerald-400">Current Stock</th>
                    <th className="py-2.5 px-3 text-right">Valuation Rate</th>
                    <th className="py-2.5 px-3 text-right">Total Asset Value</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
                  {filteredStockLedger.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="py-8 text-center text-slate-500 font-sans">
                        No stock records found matching current criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredStockLedger.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-800/40">
                        <td className="py-2 px-3 text-slate-400 font-sans">{s.warehouseName}</td>
                        <td className="py-2 px-3 font-sans font-bold text-white">
                          {s.productName}
                          {s.sku && <span className="block text-[10px] text-slate-500 font-mono">SKU: {s.sku}</span>}
                        </td>
                        <td className="py-2 px-2 text-center font-bold text-amber-400">{s.initialStockQty}</td>
                        <td className="py-2 px-2 text-center font-bold text-indigo-300">{s.purchasedInwardQty}</td>
                        <td className="py-2 px-2 text-center font-bold text-rose-400">{s.salesOutwardQty}</td>
                        <td className="py-2 px-3 text-center font-bold text-emerald-400 bg-emerald-950/20">{s.currentStock}</td>
                        <td className="py-2 px-3 text-right text-slate-300">₹{s.valRate.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right font-bold text-cyan-400">₹{s.totalVal.toFixed(2)}</td>
                        <td className="py-2 px-3 text-center font-sans">
                          {s.isLow ? (
                            <span className="px-1.5 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800 text-[10px] font-bold">
                              Low Stock
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px]">
                              Adequate
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. GST STATUTORY (GSTR-1) TAB */}
      {activeReportTab === 'gst' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <span className="text-[11px] text-slate-400">Total CGST (Central GST)</span>
              <div className="text-xl font-bold font-mono text-emerald-400">₹{totalCGST.toFixed(2)}</div>
              <span className="text-[10px] text-slate-500">50% Intra-State Share</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <span className="text-[11px] text-slate-400">Total SGST (State GST)</span>
              <div className="text-xl font-bold font-mono text-emerald-400">₹{totalSGST.toFixed(2)}</div>
              <span className="text-[10px] text-slate-500">50% Intra-State Share</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <span className="text-[11px] text-slate-400">Total IGST (Integrated GST)</span>
              <div className="text-xl font-bold font-mono text-purple-400">₹{totalIGST.toFixed(2)}</div>
              <span className="text-[10px] text-slate-500">100% Inter-State Consignments</span>
            </div>
          </div>

          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2 text-xs">
            <h4 className="font-bold text-white flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              GSTR-1 Monthly Return Summary Matrix
            </h4>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              Taxes calculated dynamically based on store origin state code ({activeCompany?.stateCode}) vs customer
              destination state. B2B registered supplies with GSTIN are segregated from B2C consumer supplies for portal
              filing.
            </p>
          </div>
        </div>
      )}

      {/* 5. TALLY PRIME XML EXPORT TAB */}
      {activeReportTab === 'tally' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                  <FileCode className="w-5 h-5 text-indigo-400" />
                  Generate Tally Prime / ERP 9 XML Vouchers
                </h4>
                <p className="text-[11px] text-slate-400">
                  Section 17: Export clean, double-entry balanced Sales, Purchase & Receipt accounting vouchers
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleGenerateTally}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow transition"
                >
                  Generate XML Batch
                </button>
                {tallyXmlOutput && (
                  <button
                    onClick={handleDownloadXml}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow flex items-center gap-1.5 transition"
                  >
                    <DownloadCloud className="w-4 h-4" /> Download XML
                  </button>
                )}
              </div>
            </div>

            {tallyXmlOutput && (
              <div className="space-y-2">
                <span className="text-[11px] text-slate-400 font-mono">Tally Prime XML Payload Preview:</span>
                <pre className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-[10px] font-mono text-emerald-400 overflow-x-auto max-h-64 scrollbar-thin">
                  {tallyXmlOutput}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. BACKLOG ACTIVITY REPORT TAB */}
      {activeReportTab === 'backlog' && (
        <BacklogReportView />
      )}

      {/* 7. AUDIT TRAIL TAB */}
      {activeReportTab === 'audit' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md">
          <div className="p-3 border-b border-slate-800 font-bold text-white text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-indigo-400" />
            Statutory Transaction & Security Audit Trail (Section 18)
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[700px]">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Event Action</th>
                  <th className="py-2.5 px-3">User ID</th>
                  <th className="py-2.5 px-3">Audit Details & Context</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
                {db.auditLogs.slice(0, 50).map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40">
                    <td className="py-2 px-3 text-slate-400 font-sans">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="py-2 px-3 text-indigo-400 font-bold">{log.action}</td>
                    <td className="py-2 px-3 text-slate-300 font-sans">{log.userId}</td>
                    <td className="py-2 px-3 font-sans text-slate-300">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
