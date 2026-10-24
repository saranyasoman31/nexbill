// ReportsView: Comprehensive ERP Intelligence, Sales, Purchases, Stock Valuation, GST & Tally Exports
import React, { useState, useEffect } from 'react';
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
  const postedInvoices = db.invoices.filter((i) => i.status === 'POSTED');
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

  // 2. Purchase Data
  const postedPurchases = db.purchases || [];
  const totalPurchasesAmount = postedPurchases.reduce((sum, p) => sum + (Number(p.netAmount) || 0), 0);
  const totalPurchaseTax = postedPurchases.reduce((sum, p) => sum + (Number(p.totalTax) || 0), 0);

  // 3. Stock Valuation Data
  const stockValuationTotal = db.stockBalances.reduce((sum, b) => {
    const prod = db.products.find((p) => p.id === b.productId);
    return sum + (Number(b.quantity) || 0) * (Number(b.valuationRate || prod?.costRate) || 0);
  }, 0);

  const lowStockProducts = db.stockBalances.filter((b) => {
    const prod = db.products.find((p) => p.id === b.productId);
    return Number(b.quantity) <= (prod?.minStockAlert || 5);
  });

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
      return postedPurchases.map((p, idx) => ({
        '#': idx + 1,
        'Purchase #': p.docNumber,
        'Date': new Date(p.date).toLocaleDateString(),
        'Supplier': p.supplierName,
        'Vendor Invoice #': p.supplierInvoiceNo,
        'Taxable (₹)': p.taxableAmount?.toFixed(2),
        'Tax (₹)': p.totalTax?.toFixed(2),
        'Net Amount (₹)': p.netAmount?.toFixed(2),
      }));
    }
    if (activeReportTab === 'stock') {
      return (db.products || []).map((p, idx) => {
        const stock = (db.warehouses || []).reduce((acc, w) => {
          return (
            acc +
            (db.stockMovements || [])
              .filter((m) => m.productId === p.id && m.warehouseId === w.id)
              .reduce((s, m) => s + m.quantityDelta, 0)
          );
        }, 0);
        return {
          '#': idx + 1,
          'Product Name': p.name,
          'SKU': p.sku,
          'Category': p.category,
          'Current Stock': stock,
          'Cost Rate': `₹${p.costRate?.toFixed(2)}`,
          'Valuation': `₹${(stock * p.costRate).toFixed(2)}`,
          'Status': stock <= (p.minStockAlert || 5) ? 'LOW STOCK ALERT' : 'HEALTHY',
        };
      });
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
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-3 rounded-xl shadow-md">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-indigo-400" />
          <div>
            <h3 className="font-bold text-white text-sm">NexBill Financial & Operations Reports Hub</h3>
            <p className="text-[11px] text-slate-400">
              Executive business analytics, sales registers, vendor payables, GST tax liability & Tally export
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
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
          onClick={() => handleTabChange('stock')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
            activeReportTab === 'stock'
              ? 'bg-indigo-600 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Stock Valuation & Low Stock</span>
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
              <table className="w-full text-left text-xs">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <span className="text-[11px] text-slate-400">Total Inward Purchase Value</span>
              <div className="text-xl font-bold font-mono text-white">
                ₹{totalPurchasesAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-indigo-400 font-semibold">{postedPurchases.length} Vendor Bills</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <span className="text-[11px] text-slate-400">Input Tax Credit (ITC) Available</span>
              <div className="text-xl font-bold font-mono text-emerald-400">
                ₹{totalPurchaseTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-emerald-300 font-semibold">Claimable against Output GST</span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md">
            <div className="p-3 border-b border-slate-800 font-bold text-white text-xs">
              Vendor Inward Invoices Register
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Purchase Doc #</th>
                    <th className="py-2.5 px-3">Supplier Invoice #</th>
                    <th className="py-2.5 px-3">Supplier Name</th>
                    <th className="py-2.5 px-3 text-right">Subtotal (₹)</th>
                    <th className="py-2.5 px-3 text-right">Tax (₹)</th>
                    <th className="py-2.5 px-3 text-right">Net Value (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
                  {postedPurchases.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/40">
                      <td className="py-2 px-3 text-indigo-300 font-bold">{p.docNumber}</td>
                      <td className="py-2 px-3 text-slate-300 font-bold">{p.supplierInvoiceNo}</td>
                      <td className="py-2 px-3 font-sans text-white">{p.supplierName}</td>
                      <td className="py-2 px-3 text-right text-slate-300">₹{p.subtotal?.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right text-emerald-400">₹{p.totalTax?.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right font-bold text-white">₹{p.netAmount?.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. STOCK VALUATION & LOW STOCK TAB */}
      {activeReportTab === 'stock' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <span className="text-[11px] text-slate-400">Total Stock Valuation (WAC Basis)</span>
              <div className="text-xl font-bold font-mono text-cyan-400">
                ₹{stockValuationTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-slate-400">{db.stockBalances.length} Warehouse Balances</span>
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

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md">
            <div className="p-3 border-b border-slate-800 font-bold text-white text-xs">
              Warehouse Physical Stock Valuation Ledger
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Warehouse</th>
                    <th className="py-2.5 px-3">Product Name</th>
                    <th className="py-2.5 px-3 text-center">Available Stock</th>
                    <th className="py-2.5 px-3 text-right">Valuation Rate</th>
                    <th className="py-2.5 px-3 text-right">Total Asset Value</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
                  {db.stockBalances.map((b) => {
                    const prod = db.products.find((p) => p.id === b.productId);
                    const valRate = Number(b.valuationRate || prod?.costRate) || 0;
                    const totalVal = Number(b.quantity || 0) * valRate;
                    const isLow = Number(b.quantity || 0) <= (prod?.minStockAlert || 5);

                    return (
                      <tr key={b.id} className="hover:bg-slate-800/40">
                        <td className="py-2 px-3 text-slate-400 font-sans">
                          {db.warehouses.find((w) => w.id === b.warehouseId)?.name || b.warehouseId}
                        </td>
                        <td className="py-2 px-3 font-sans font-bold text-white">{prod?.name || b.productId}</td>
                        <td className="py-2 px-3 text-center font-bold text-white">{b.quantity}</td>
                        <td className="py-2 px-3 text-right text-slate-300">₹{valRate.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right font-bold text-cyan-400">₹{totalVal.toFixed(2)}</td>
                        <td className="py-2 px-3 text-center font-sans">
                          {isLow ? (
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
                    );
                  })}
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
            <table className="w-full text-left text-xs">
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
