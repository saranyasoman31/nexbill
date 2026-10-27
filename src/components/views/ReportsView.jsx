// ReportsView: Comprehensive Enterprise Intelligence, Sales, Purchases, Stock Valuation, GST & Tally Exports
// Powered by Database Table Indexing & Asynchronous AJAX Query Engine for 3 Lakh+ Products & Multi-Year Datasets
import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { TallyExportService } from '../../services/tallyExportService.js';
import {
  BarChart3,
  TrendingUp,
  Boxes,
  Truck,
  ShoppingCart,
  Percent,
  Search,
  Calendar,
  CheckCircle2,
  Printer,
  FileCode,
  PackageCheck,
  RotateCw,
  ShieldAlert,
  Zap,
  ListOrdered,
  FileText,
  Filter,
  Layers,
  Tag,
  ChevronRight,
  ChevronDown,
  ShoppingBag,
  X,
} from 'lucide-react';
import ExportButtons from '../common/ExportButtons.jsx';
import BacklogReportView from './BacklogReportView.jsx';
import AjaxTablePagination from '../common/AjaxTablePagination.jsx';
import DateRangeFilter from '../common/DateRangeFilter.jsx';
import {
  fetchSalesReportAjax,
  fetchPurchasesReportAjax,
  fetchInitialStockReportAjax,
  fetchStockValuationReportAjax,
} from '../../services/indexingService.js';

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

  // --- 1. SALES REPORT STATE (AJAX & INDEXED) ---
  const [salesDateFilter, setSalesDateFilter] = useState('ALL');
  const [salesCustomFrom, setSalesCustomFrom] = useState('');
  const [salesCustomTo, setSalesCustomTo] = useState('');
  const [salesSearch, setSalesSearch] = useState('');
  const [salesPage, setSalesPage] = useState(1);
  const [salesPageSize, setSalesPageSize] = useState(50);
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesResult, setSalesResult] = useState({
    data: [],
    allFiltered: [],
    totalCount: 0,
    page: 1,
    pageSize: 50,
    totalPages: 1,
    startIndex: 0,
    endIndex: 0,
    metrics: {
      totalRevenue: 0,
      totalTax: 0,
      totalInvoices: 0,
      cashTotal: 0,
      upiTotal: 0,
      cardTotal: 0,
      creditTotal: 0,
    },
    executionTimeMs: 0,
  });

  const loadSalesReport = useCallback(async () => {
    setSalesLoading(true);
    try {
      const res = await fetchSalesReportAjax(db, {
        dateFilter: salesDateFilter,
        customFromDate: salesCustomFrom,
        customToDate: salesCustomTo,
        search: salesSearch,
        statusFilter: 'POSTED',
        storeFilter: 'ALL',
        page: salesPage,
        pageSize: salesPageSize,
      });
      setSalesResult(res);
    } catch (e) {
      console.error('Failed to load sales report via AJAX:', e);
    } finally {
      setSalesLoading(false);
    }
  }, [db, salesDateFilter, salesCustomFrom, salesCustomTo, salesSearch, salesPage, salesPageSize]);

  useEffect(() => {
    if (activeReportTab === 'sales' || activeReportTab === 'gst') {
      loadSalesReport();
    }
  }, [activeReportTab, loadSalesReport]);

  // Reset sales page on filter change
  useEffect(() => {
    setSalesPage(1);
  }, [salesDateFilter, salesCustomFrom, salesCustomTo, salesSearch]);

  // --- 2. PURCHASES REPORT STATE (AJAX & INDEXED) ---
  const [purchasesViewMode, setPurchasesViewMode] = useState('detailed'); // 'detailed' (Item-Wise) | 'summary' (Invoice-Wise)
  const [purchasesDateFilter, setPurchasesDateFilter] = useState('ALL');
  const [purchasesCustomFrom, setPurchasesCustomFrom] = useState('');
  const [purchasesCustomTo, setPurchasesCustomTo] = useState('');
  const [purchasesFilterMode, setPurchasesFilterMode] = useState('purchases_only'); // 'purchases_only' | 'initial_stock_only' | 'all'
  const [purchasesSearch, setPurchasesSearch] = useState('');
  const [purchasesSupplierFilter, setPurchasesSupplierFilter] = useState('ALL');
  const [purchasesProductFilter, setPurchasesProductFilter] = useState('ALL');
  const [purchasesBrandFilter, setPurchasesBrandFilter] = useState('ALL');
  const [purchasesCategoryFilter, setPurchasesCategoryFilter] = useState('ALL');
  const [purchasesMainCategoryFilter, setPurchasesMainCategoryFilter] = useState('ALL');
  const [expandedPurchaseIds, setExpandedPurchaseIds] = useState(new Set());
  const [purchasesPage, setPurchasesPage] = useState(1);
  const [purchasesPageSize, setPurchasesPageSize] = useState(50);
  const [purchasesLoading, setPurchasesLoading] = useState(false);
  const [purchasesResult, setPurchasesResult] = useState({
    data: [],
    allFiltered: [],
    detailedItems: [],
    matchingInvoices: [],
    totalCount: 0,
    page: 1,
    pageSize: 50,
    totalPages: 1,
    startIndex: 0,
    endIndex: 0,
    metrics: {
      standardPurchasesAmount: 0,
      standardPurchaseTax: 0,
      initialStockInwardAmount: 0,
      totalInwardQuantity: 0,
      totalLinesCount: 0,
      totalInvoicesCount: 0,
      totalRecords: 0,
      avgSpDiff: 0,
    },
    executionTimeMs: 0,
  });

  const toggleExpandPurchase = (id) => {
    setExpandedPurchaseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const loadPurchasesReport = useCallback(async () => {
    setPurchasesLoading(true);
    try {
      const res = await fetchPurchasesReportAjax(db, {
        dateFilter: purchasesDateFilter,
        customFromDate: purchasesCustomFrom,
        customToDate: purchasesCustomTo,
        purchasesFilterMode,
        search: purchasesSearch,
        supplierFilter: purchasesSupplierFilter,
        productFilter: purchasesProductFilter,
        brandFilter: purchasesBrandFilter,
        categoryFilter: purchasesCategoryFilter,
        mainCategoryFilter: purchasesMainCategoryFilter,
        viewMode: purchasesViewMode,
        page: purchasesPage,
        pageSize: purchasesPageSize,
      });
      setPurchasesResult(res);
    } catch (e) {
      console.error('Failed to load purchases report via AJAX:', e);
    } finally {
      setPurchasesLoading(false);
    }
  }, [
    db,
    purchasesDateFilter,
    purchasesCustomFrom,
    purchasesCustomTo,
    purchasesFilterMode,
    purchasesSearch,
    purchasesSupplierFilter,
    purchasesProductFilter,
    purchasesBrandFilter,
    purchasesCategoryFilter,
    purchasesMainCategoryFilter,
    purchasesViewMode,
    purchasesPage,
    purchasesPageSize,
  ]);

  useEffect(() => {
    if (activeReportTab === 'purchases') {
      loadPurchasesReport();
    }
  }, [activeReportTab, loadPurchasesReport]);

  useEffect(() => {
    setPurchasesPage(1);
  }, [
    purchasesDateFilter,
    purchasesCustomFrom,
    purchasesCustomTo,
    purchasesFilterMode,
    purchasesSearch,
    purchasesSupplierFilter,
    purchasesProductFilter,
    purchasesBrandFilter,
    purchasesCategoryFilter,
    purchasesMainCategoryFilter,
    purchasesViewMode,
  ]);

  // --- 3. INITIAL STOCK REPORT STATE (AJAX & INDEXED) ---
  const [initialStockWarehouseFilter, setInitialStockWarehouseFilter] = useState('ALL');
  const [initialStockSearch, setInitialStockSearch] = useState('');
  const [initialStockPage, setInitialStockPage] = useState(1);
  const [initialStockPageSize, setInitialStockPageSize] = useState(50);
  const [initialStockLoading, setInitialStockLoading] = useState(false);
  const [initialStockResult, setInitialStockResult] = useState({
    data: [],
    allFiltered: [],
    totalCount: 0,
    page: 1,
    pageSize: 50,
    totalPages: 1,
    startIndex: 0,
    endIndex: 0,
    metrics: {
      totalValuation: 0,
      totalUnits: 0,
      docCount: 0,
    },
    executionTimeMs: 0,
  });

  const loadInitialStockReport = useCallback(async () => {
    setInitialStockLoading(true);
    try {
      const res = await fetchInitialStockReportAjax(db, {
        warehouseFilter: initialStockWarehouseFilter,
        search: initialStockSearch,
        page: initialStockPage,
        pageSize: initialStockPageSize,
      });
      setInitialStockResult(res);
    } catch (e) {
      console.error('Failed to load initial stock report via AJAX:', e);
    } finally {
      setInitialStockLoading(false);
    }
  }, [db, initialStockWarehouseFilter, initialStockSearch, initialStockPage, initialStockPageSize]);

  useEffect(() => {
    if (activeReportTab === 'initial_stock') {
      loadInitialStockReport();
    }
  }, [activeReportTab, loadInitialStockReport]);

  useEffect(() => {
    setInitialStockPage(1);
  }, [initialStockWarehouseFilter, initialStockSearch]);

  // --- 4. STOCK VALUATION & LEDGER STATE (AJAX & COMPOUND INDEXED) ---
  const [stockWarehouseFilter, setStockWarehouseFilter] = useState('ALL');
  const [stockSearch, setStockSearch] = useState('');
  const [stockStatusFilter, setStockStatusFilter] = useState('ALL');
  const [stockPage, setStockPage] = useState(1);
  const [stockPageSize, setStockPageSize] = useState(50);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockResult, setStockResult] = useState({
    data: [],
    allFiltered: [],
    totalCount: 0,
    page: 1,
    pageSize: 50,
    totalPages: 1,
    startIndex: 0,
    endIndex: 0,
    metrics: {
      totalValuation: 0,
      totalUnits: 0,
      lowStockCount: 0,
      totalTrackedSkus: 0,
    },
    executionTimeMs: 0,
  });

  const loadStockReport = useCallback(async () => {
    setStockLoading(true);
    try {
      const res = await fetchStockValuationReportAjax(db, {
        warehouseFilter: stockWarehouseFilter,
        search: stockSearch,
        stockStatusFilter,
        page: stockPage,
        pageSize: stockPageSize,
      });
      setStockResult(res);
    } catch (e) {
      console.error('Failed to load stock valuation report via AJAX:', e);
    } finally {
      setStockLoading(false);
    }
  }, [db, stockWarehouseFilter, stockSearch, stockStatusFilter, stockPage, stockPageSize]);

  useEffect(() => {
    if (activeReportTab === 'stock') {
      loadStockReport();
    }
  }, [activeReportTab, loadStockReport]);

  useEffect(() => {
    setStockPage(1);
  }, [stockWarehouseFilter, stockSearch, stockStatusFilter]);

  // --- 5. GST RETURN CALCULATIONS ---
  const postedInvoices = salesResult.allFiltered || [];
  const totalCGST = postedInvoices.reduce((sum, i) => sum + (Number(i.cgstAmount) || 0), 0);
  const totalSGST = postedInvoices.reduce((sum, i) => sum + (Number(i.sgstAmount) || 0), 0);
  const totalIGST = postedInvoices.reduce((sum, i) => sum + (Number(i.igstAmount) || 0), 0);

  // --- 6. TALLY EXPORT HANDLER ---
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

  // Full Export Data Generator (exports entire filtered dataset)
  const getReportExportData = () => {
    if (activeReportTab === 'sales') {
      return (salesResult.allFiltered || []).map((inv, idx) => ({
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
      if (purchasesViewMode === 'detailed') {
        return (purchasesResult.allFiltered || []).map((item, idx) => ({
          '#': idx + 1,
          'Date': new Date(item.date).toLocaleDateString(),
          'Inward Doc #': item.docNumber,
          'Type': item.isInitialStock ? 'INITIAL_STOCK' : 'PURCHASE',
          'Supplier Invoice #': item.isInitialStock ? 'OPENING_STOCK' : (item.supplierInvoiceNo || '—'),
          'Supplier Name': item.supplierName,
          'Product Name': item.productName,
          'SKU': item.sku || '—',
          'Main Category': item.mainCategory,
          'Category': item.category,
          'Brand': item.brand,
          'Batch': item.batchNo || '—',
          'Qty': item.qty,
          'UOM': item.uom,
          'Cost Price (₹)': Number(item.costPrice || 0).toFixed(2),
          'Previous Cost (₹)': item.previousCostPrice !== null ? Number(item.previousCostPrice).toFixed(2) : '— (Base)',
          'Cost Diff vs Prev (₹)': item.costDiff !== null ? `${item.costDiff >= 0 ? '+' : ''}${item.costDiff.toFixed(2)} (${item.costDiffPercent >= 0 ? '+' : ''}${item.costDiffPercent}%)` : '—',
          'MRP (₹)': item.mrp !== null ? Number(item.mrp).toFixed(2) : '—',
          'Selling Price (₹)': item.sellingPrice !== null ? Number(item.sellingPrice).toFixed(2) : '—',
          'SP Diff / Margin (₹)': item.spDiff !== null ? `${item.spDiff >= 0 ? '+' : ''}${item.spDiff.toFixed(2)} (${item.marginPercent}%)` : '—',
          'MRP Diff (₹)': item.mrpDiff !== null ? `${item.mrpDiff >= 0 ? '+' : ''}${item.mrpDiff.toFixed(2)}` : '—',
          'GST %': `${item.taxRate}%`,
          'Tax (₹)': Number(item.taxAmount || 0).toFixed(2),
          'Line Total (₹)': Number(item.lineTotal || 0).toFixed(2),
        }));
      }
      return (purchasesResult.allFiltered || []).map((p, idx) => {
        const isInit = Boolean(p.isInitialStock || p.entryType === 'INITIAL_STOCK' || p.docNumber?.startsWith('INIT-'));
        return {
          '#': idx + 1,
          'Inward #': p.docNumber,
          'Type': isInit ? 'INITIAL_STOCK' : 'PURCHASE',
          'Date': new Date(p.date).toLocaleDateString(),
          'Supplier': p.supplierName,
          'Vendor Invoice #': isInit ? 'OPENING_STOCK' : p.supplierInvoiceNo,
          'Taxable (₹)': Number(p.subtotal || 0).toFixed(2),
          'Tax (₹)': Number(p.totalTax || 0).toFixed(2),
          'Net Amount (₹)': Number(p.netAmount || p.grandTotal || 0).toFixed(2),
        };
      });
    }
    if (activeReportTab === 'initial_stock') {
      return (initialStockResult.allFiltered || []).map((item, idx) => ({
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
      }));
    }
    if (activeReportTab === 'stock') {
      return (stockResult.allFiltered || []).map((s, idx) => ({
        '#': idx + 1,
        'Warehouse': s.warehouseName,
        'Product Name': s.productName,
        'SKU': s.sku,
        'Initial Stock Qty': s.initialStockQty,
        'Purchased Inward Qty': s.purchasedInwardQty,
        'Sales Outward Qty': s.salesOutwardQty,
        'Available Current Stock': s.currentStock,
        'Valuation Rate (₹)': Number(s.valRate).toFixed(2),
        'MRP (₹)': s.mrp > 0 ? Number(s.mrp).toFixed(2) : '—',
        'Selling Rate (₹)': s.sellingRate > 0 ? Number(s.sellingRate).toFixed(2) : '—',
        'Margin / Diff (₹)': s.sellingRate > 0 ? `${Number(s.priceDifference).toFixed(2)} (${s.marginPercent}%)` : '—',
        'Total Asset Value (₹)': Number(s.totalVal).toFixed(2),
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
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white text-sm truncate sm:overflow-visible">
                NexBill Financial & Operations Reports Hub
              </h3>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-indigo-950 text-indigo-300 border border-indigo-800">
                <Zap className="w-3 h-3 text-indigo-400" />
                Indexed & AJAX Enabled
              </span>
            </div>
            <p className="text-[11px] text-slate-400 line-clamp-1 sm:line-clamp-none">
              High-speed queries for 3 Lakh+ catalogs, multi-year date range slices, vendor payables & GST tax registers
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
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold border border-slate-700 transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Report Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto text-xs font-medium scrollbar-none">
        <button
          onClick={() => handleTabChange('sales')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition whitespace-nowrap cursor-pointer ${
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
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition whitespace-nowrap cursor-pointer ${
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
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition whitespace-nowrap cursor-pointer ${
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
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition whitespace-nowrap cursor-pointer ${
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
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition whitespace-nowrap cursor-pointer ${
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
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition whitespace-nowrap cursor-pointer ${
            activeReportTab === 'tally'
              ? 'bg-indigo-600 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <FileCode className="w-4 h-4" />
          <span>Tally Prime Export</span>
        </button>

        <button
          onClick={() => handleTabChange('backlog')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition whitespace-nowrap cursor-pointer ${
            activeReportTab === 'backlog'
              ? 'bg-indigo-600 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Backlog Activity Report</span>
        </button>

        <button
          onClick={() => handleTabChange('audit')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition whitespace-nowrap cursor-pointer ${
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
          {/* Filter Bar with Date Range Preset (> 1 Year Support) & Search */}
          <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-md">
            <DateRangeFilter
              selectedFilter={salesDateFilter}
              onFilterChange={setSalesDateFilter}
              customFromDate={salesCustomFrom}
              customToDate={salesCustomTo}
              onCustomFromChange={setSalesCustomFrom}
              onCustomToChange={setSalesCustomTo}
              disabled={salesLoading}
            />

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Search invoice #, customer..."
                  value={salesSearch}
                  onChange={(e) => setSalesSearch(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-56 sm:w-64"
                />
              </div>

              <button
                type="button"
                onClick={loadSalesReport}
                disabled={salesLoading}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition cursor-pointer"
                title="Refresh AJAX Query"
              >
                <RotateCw className={`w-3.5 h-3.5 ${salesLoading ? 'animate-spin text-indigo-400' : ''}`} />
              </button>
            </div>
          </div>

          {/* Metrics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <span className="text-[11px] text-slate-400">Total Net Revenue</span>
              <div className="text-xl font-bold font-mono text-emerald-400">
                ₹{Number(salesResult.metrics.totalRevenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                {salesResult.totalCount.toLocaleString('en-IN')} Invoices Posted
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <span className="text-[11px] text-slate-400">Total Tax Collected</span>
              <div className="text-xl font-bold font-mono text-cyan-400">
                ₹{Number(salesResult.metrics.totalTax || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-slate-500">CGST + SGST + IGST</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <span className="text-[11px] text-slate-400">Cash Collections</span>
              <div className="text-xl font-bold font-mono text-indigo-400">
                ₹{Number(salesResult.metrics.cashTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-indigo-300 font-semibold">Till Cash In</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <span className="text-[11px] text-slate-400">Digital (UPI + Card)</span>
              <div className="text-xl font-bold font-mono text-purple-400">
                ₹{Number((salesResult.metrics.upiTotal || 0) + (salesResult.metrics.cardTotal || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-purple-300 font-semibold">Bank Settlements</span>
            </div>
          </div>

          {/* Sales Register Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md">
            <div className="p-3 border-b border-slate-800 flex justify-between items-center text-xs">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-indigo-400" />
                <span className="font-bold text-white">Posted Sales Invoices Register</span>
              </div>
              <div className="flex items-center gap-2">
                {salesLoading && (
                  <span className="text-[11px] text-amber-400 flex items-center gap-1 font-mono">
                    <RotateCw className="w-3 h-3 animate-spin" /> Fetching slice...
                  </span>
                )}
                <span className="text-slate-400 font-mono">
                  {salesResult.totalCount.toLocaleString('en-IN')} Total Records
                </span>
              </div>
            </div>

            <div className="overflow-x-auto relative">
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
                  {salesResult.data.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-12 text-center text-slate-500 font-sans">
                        {salesLoading ? 'Loading records via indexed search...' : 'No sales records found for selected period.'}
                      </td>
                    </tr>
                  ) : (
                    salesResult.data.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-2 px-3 text-indigo-300 font-bold">{inv.docNumber}</td>
                        <td className="py-2 px-3 text-slate-400 font-sans">{new Date(inv.date).toLocaleDateString()}</td>
                        <td className="py-2 px-3 font-sans text-white">{inv.customerName || 'Walk-in'}</td>
                        <td className="py-2 px-3 text-right text-slate-300">₹{Number(inv.taxableAmount || 0).toFixed(2)}</td>
                        <td className="py-2 px-3 text-right text-cyan-400">₹{Number(inv.totalTax || 0).toFixed(2)}</td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-400">₹{Number(inv.netPayable || 0).toFixed(2)}</td>
                        <td className="py-2 px-3 font-sans text-slate-400">
                          {inv.tenders?.map((t) => t.method).join(', ') || 'CASH'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Asynchronous AJAX Table Pagination Bar */}
            <AjaxTablePagination
              totalCount={salesResult.totalCount}
              page={salesResult.page}
              pageSize={salesResult.pageSize}
              totalPages={salesResult.totalPages}
              startIndex={salesResult.startIndex}
              endIndex={salesResult.endIndex}
              isLoading={salesLoading}
              executionTimeMs={salesResult.executionTimeMs}
              onPageChange={(p) => setSalesPage(p)}
              onPageSizeChange={(ps) => {
                setSalesPageSize(ps);
                setSalesPage(1);
              }}
            />
          </div>
        </div>
      )}

      {/* 2. PURCHASES REPORT TAB (PURCHASE REGISTER WITH DETAILED ITEM LIST & SUMMARY) */}
      {activeReportTab === 'purchases' && (
        <div className="space-y-4">
          {/* Top Control Bar: View Mode Switcher & Inward Type Filter */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-2.5 rounded-xl shadow-md">
            {/* View Mode Toggle (Detailed Purchase List vs Summary Register) */}
            <div className="inline-flex rounded-lg p-1 bg-slate-950 border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setPurchasesViewMode('detailed')}
                className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  purchasesViewMode === 'detailed'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ListOrdered className="w-3.5 h-3.5" />
                <span>Detailed Purchase List (Item-Wise)</span>
              </button>
              <button
                type="button"
                onClick={() => setPurchasesViewMode('summary')}
                className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  purchasesViewMode === 'summary'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Summary Register (Invoice-Wise)</span>
              </button>
            </div>

            {/* Inward Mode Toggle (Purchases / Initial Stock / All) */}
            <div className="inline-flex rounded-lg p-1 bg-slate-950 border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setPurchasesFilterMode('purchases_only')}
                className={`px-2.5 py-1 rounded font-semibold transition cursor-pointer ${
                  purchasesFilterMode === 'purchases_only'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Purchases Only
              </button>
              <button
                type="button"
                onClick={() => setPurchasesFilterMode('initial_stock_only')}
                className={`px-2.5 py-1 rounded font-semibold transition cursor-pointer ${
                  purchasesFilterMode === 'initial_stock_only'
                    ? 'bg-amber-600 text-white shadow'
                    : 'text-amber-400/80 hover:text-amber-300'
                }`}
              >
                Initial Stock Only
              </button>
              <button
                type="button"
                onClick={() => setPurchasesFilterMode('all')}
                className={`px-2.5 py-1 rounded font-semibold transition cursor-pointer ${
                  purchasesFilterMode === 'all'
                    ? 'bg-slate-700 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All Inwards
              </button>
            </div>
          </div>

          {/* Date Range Bar with Explicit From & To Date Filtration */}
          <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-md">
            <div className="flex flex-wrap items-center gap-2">
              <DateRangeFilter
                selectedFilter={purchasesDateFilter}
                onFilterChange={(val) => {
                  setPurchasesDateFilter(val);
                  if (val !== 'CUSTOM') {
                    setPurchasesCustomFrom('');
                    setPurchasesCustomTo('');
                  }
                }}
                customFromDate={purchasesCustomFrom}
                customToDate={purchasesCustomTo}
                onCustomFromChange={(val) => {
                  setPurchasesCustomFrom(val);
                  setPurchasesDateFilter('CUSTOM');
                }}
                onCustomToChange={(val) => {
                  setPurchasesCustomTo(val);
                  setPurchasesDateFilter('CUSTOM');
                }}
                disabled={purchasesLoading}
              />

              {/* Explicit From & To Date Inputs Always Accessible */}
              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-lg text-xs">
                <span className="text-[10px] font-bold uppercase text-slate-400">From:</span>
                <input
                  type="date"
                  value={purchasesCustomFrom || ''}
                  onChange={(e) => {
                    setPurchasesCustomFrom(e.target.value);
                    setPurchasesDateFilter('CUSTOM');
                  }}
                  className="bg-transparent text-slate-200 border-none outline-none text-xs cursor-pointer font-mono"
                />
                <span className="text-[10px] font-bold uppercase text-slate-400 ml-1">To:</span>
                <input
                  type="date"
                  value={purchasesCustomTo || ''}
                  onChange={(e) => {
                    setPurchasesCustomTo(e.target.value);
                    setPurchasesDateFilter('CUSTOM');
                  }}
                  className="bg-transparent text-slate-200 border-none outline-none text-xs cursor-pointer font-mono"
                />
                {(purchasesCustomFrom || purchasesCustomTo || purchasesDateFilter !== 'ALL') && (
                  <button
                    type="button"
                    onClick={() => {
                      setPurchasesCustomFrom('');
                      setPurchasesCustomTo('');
                      setPurchasesDateFilter('ALL');
                    }}
                    className="ml-1 p-0.5 text-slate-400 hover:text-rose-400 rounded"
                    title="Clear Date Filter"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={purchasesSupplierFilter}
                onChange={(e) => setPurchasesSupplierFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 cursor-pointer"
              >
                <option value="ALL">All Suppliers</option>
                {(db.suppliers || []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Search invoice, product, SKU, brand..."
                  value={purchasesSearch}
                  onChange={(e) => setPurchasesSearch(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-52 sm:w-60"
                />
              </div>

              <button
                type="button"
                onClick={loadPurchasesReport}
                disabled={purchasesLoading}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition cursor-pointer"
                title="Refresh AJAX Query"
              >
                <RotateCw className={`w-3.5 h-3.5 ${purchasesLoading ? 'animate-spin text-indigo-400' : ''}`} />
              </button>
            </div>
          </div>

          {/* Multi-Dimensional Classification Filters: Main Category, Category, Brand, Product */}
          <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 shadow-md text-xs">
            {/* Main Category Filter */}
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase mb-1">
                <Layers className="w-3 h-3 text-indigo-400" />
                <span>Main Category</span>
              </div>
              <select
                value={purchasesMainCategoryFilter}
                onChange={(e) => {
                  setPurchasesMainCategoryFilter(e.target.value);
                  setPurchasesCategoryFilter('ALL');
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 cursor-pointer"
              >
                <option value="ALL">All Main Categories</option>
                {(db.mainCategories || [{ id: 'MCAT-01', name: 'General' }]).map((mc) => (
                  <option key={mc.id || mc.name} value={mc.id || mc.name}>
                    {mc.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Sub-Category Filter */}
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase mb-1">
                <Tag className="w-3 h-3 text-cyan-400" />
                <span>Sub-Category</span>
              </div>
              <select
                value={purchasesCategoryFilter}
                onChange={(e) => setPurchasesCategoryFilter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 cursor-pointer"
              >
                <option value="ALL">All Categories</option>
                {(db.categories || [])
                  .filter((c) => {
                    if (purchasesMainCategoryFilter === 'ALL') return true;
                    return (
                      c.mainCategoryId === purchasesMainCategoryFilter ||
                      c.mainCategory === purchasesMainCategoryFilter
                    );
                  })
                  .map((c) => (
                    <option key={c.id || c.name} value={c.id || c.name}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>

            {/* Brand Filter */}
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase mb-1">
                <ShoppingBag className="w-3 h-3 text-amber-400" />
                <span>Brand</span>
              </div>
              <select
                value={purchasesBrandFilter}
                onChange={(e) => setPurchasesBrandFilter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 cursor-pointer"
              >
                <option value="ALL">All Brands</option>
                {(db.brands || []).map((b) => (
                  <option key={b.id || b.name} value={b.id || b.name}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Product Filter */}
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase mb-1">
                <Boxes className="w-3 h-3 text-emerald-400" />
                <span>Product</span>
              </div>
              <select
                value={purchasesProductFilter}
                onChange={(e) => setPurchasesProductFilter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 cursor-pointer"
              >
                <option value="ALL">All Products ({(db.products || []).length})</option>
                {(db.products || []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.sku ? `(${p.sku})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Active Filter Badges Reset Bar (Visible when any filter is active) */}
          {(purchasesProductFilter !== 'ALL' ||
            purchasesBrandFilter !== 'ALL' ||
            purchasesCategoryFilter !== 'ALL' ||
            purchasesMainCategoryFilter !== 'ALL' ||
            purchasesSupplierFilter !== 'ALL' ||
            purchasesCustomFrom ||
            purchasesCustomTo ||
            purchasesSearch) && (
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/60 border border-slate-800 p-2 rounded-lg text-xs">
              <span className="text-[11px] text-slate-400 font-semibold flex items-center gap-1">
                <Filter className="w-3 h-3 text-indigo-400" />
                Active Filters:
              </span>
              {purchasesMainCategoryFilter !== 'ALL' && (
                <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 text-[10px]">
                  Main Cat: {db.mainCategories?.find((m) => m.id === purchasesMainCategoryFilter || m.name === purchasesMainCategoryFilter)?.name || purchasesMainCategoryFilter}
                </span>
              )}
              {purchasesCategoryFilter !== 'ALL' && (
                <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 text-[10px]">
                  Category: {db.categories?.find((c) => c.id === purchasesCategoryFilter || c.name === purchasesCategoryFilter)?.name || purchasesCategoryFilter}
                </span>
              )}
              {purchasesBrandFilter !== 'ALL' && (
                <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 text-[10px]">
                  Brand: {db.brands?.find((b) => b.id === purchasesBrandFilter || b.name === purchasesBrandFilter)?.name || purchasesBrandFilter}
                </span>
              )}
              {purchasesProductFilter !== 'ALL' && (
                <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px]">
                  Product: {db.products?.find((p) => p.id === purchasesProductFilter)?.name || purchasesProductFilter}
                </span>
              )}
              {purchasesSupplierFilter !== 'ALL' && (
                <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 text-[10px]">
                  Supplier: {db.suppliers?.find((s) => s.id === purchasesSupplierFilter)?.name || purchasesSupplierFilter}
                </span>
              )}
              {(purchasesCustomFrom || purchasesCustomTo) && (
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-mono">
                  Dates: {purchasesCustomFrom || 'Start'} to {purchasesCustomTo || 'Present'}
                </span>
              )}
              {purchasesSearch && (
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10px]">
                  "{purchasesSearch}"
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  setPurchasesProductFilter('ALL');
                  setPurchasesBrandFilter('ALL');
                  setPurchasesCategoryFilter('ALL');
                  setPurchasesMainCategoryFilter('ALL');
                  setPurchasesSupplierFilter('ALL');
                  setPurchasesCustomFrom('');
                  setPurchasesCustomTo('');
                  setPurchasesDateFilter('ALL');
                  setPurchasesSearch('');
                }}
                className="ml-auto text-[10px] text-rose-400 hover:text-rose-300 font-bold underline cursor-pointer"
              >
                Clear All Filters
              </button>
            </div>
          )}

          {/* KPI Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <span className="text-[11px] text-slate-400">
                {purchasesFilterMode === 'initial_stock_only' ? 'Initial Stock Valuation' : 'Total Inward Purchase Value'}
              </span>
              <div className="text-xl font-bold font-mono text-white">
                ₹{Number(
                  purchasesFilterMode === 'initial_stock_only'
                    ? purchasesResult.metrics.initialStockInwardAmount
                    : purchasesResult.metrics.standardPurchasesAmount + (purchasesFilterMode === 'all' ? purchasesResult.metrics.initialStockInwardAmount : 0)
                ).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-indigo-400 font-semibold font-mono">
                {purchasesViewMode === 'detailed'
                  ? `${purchasesResult.totalCount.toLocaleString('en-IN')} Purchased Items`
                  : `${purchasesResult.totalCount.toLocaleString('en-IN')} Inward Invoices`}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <span className="text-[11px] text-slate-400">Total Quantity Received</span>
              <div className="text-xl font-bold font-mono text-cyan-400">
                {Number(purchasesResult.metrics.totalInwardQuantity || 0).toLocaleString('en-IN')} Units
              </div>
              <span className="text-[10px] text-cyan-300/80 font-semibold">
                Across {purchasesResult.metrics.totalLinesCount || purchasesResult.totalCount} Product Lines
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <span className="text-[11px] text-slate-400">Input Tax Credit (ITC) Available</span>
              <div className="text-xl font-bold font-mono text-emerald-400">
                ₹{Number(purchasesResult.metrics.standardPurchaseTax || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
                ₹{Number(purchasesResult.metrics.initialStockInwardAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-amber-300/80 font-semibold">
                Opening Inward Batches Separated
              </span>
            </div>
          </div>

          {/* Main Register Table (Item-Wise Detailed List vs Invoice Summary) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md">
            <div className="p-3 border-b border-slate-800 font-bold text-white text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-indigo-400" />
                <span>
                  {purchasesViewMode === 'detailed'
                    ? 'Purchase Register: Detailed Item-Wise List with Price Differences & Margins'
                    : 'Purchase Register: Inward Invoices Summary'}
                </span>
              </div>
              <span className="text-slate-400 font-mono">
                {purchasesResult.totalCount.toLocaleString('en-IN')} {purchasesViewMode === 'detailed' ? 'Items' : 'Invoices'}
              </span>
            </div>

            <div className="overflow-x-auto">
              {purchasesViewMode === 'detailed' ? (
                /* ========================================================================= */
                /* VIEW 1: DETAILED PURCHASE LIST (ITEM-WISE WITH ALL DIFFERENCES)            */
                /* ========================================================================= */
                <table className="w-full text-left text-xs min-w-[1250px]">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-2.5 text-center w-8">#</th>
                      <th className="py-2.5 px-3">Date & Inward #</th>
                      <th className="py-2.5 px-3">Supplier & Invoice</th>
                      <th className="py-2.5 px-3">Product Name & SKU</th>
                      <th className="py-2.5 px-3">Classification</th>
                      <th className="py-2.5 px-2 text-center">Qty</th>
                      <th className="py-2.5 px-3 text-right">Cost Price (CP)</th>
                      <th className="py-2.5 px-3 text-right">MRP</th>
                      <th className="py-2.5 px-3 text-right">Selling Price (SP)</th>
                      <th className="py-2.5 px-3 text-center">Cost Diff (vs Prev)</th>
                      <th className="py-2.5 px-3 text-center">Margin / SP Diff</th>
                      <th className="py-2.5 px-2 text-center">GST %</th>
                      <th className="py-2.5 px-3 text-right">Line Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
                    {purchasesResult.data.length === 0 ? (
                      <tr>
                        <td colSpan="13" className="py-12 text-center text-slate-500 font-sans">
                          {purchasesLoading
                            ? 'Loading detailed purchase records via indexed engine...'
                            : 'No purchased items found matching the selected filter criteria.'}
                        </td>
                      </tr>
                    ) : (
                      purchasesResult.data.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-800/40 transition">
                          <td className="py-2.5 px-2.5 text-slate-500 font-mono text-center">
                            {purchasesResult.startIndex + idx}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-indigo-300 font-mono">{item.docNumber}</div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {new Date(item.date).toLocaleDateString()}
                            </div>
                            {item.isInitialStock ? (
                              <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                                Initial Stock
                              </span>
                            ) : (
                              <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800">
                                Purchase
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-white font-sans">{item.supplierName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {item.isInitialStock ? 'Opening Inventory' : `Inv: ${item.supplierInvoiceNo || '—'}`}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-white text-xs font-sans">{item.productName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              SKU: {item.sku} {item.batchNo && item.batchNo !== '—' ? `• Batch: ${item.batchNo}` : ''}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-sans">
                            <div className="flex flex-wrap gap-1">
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                                {item.mainCategory}
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                                {item.category}
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-950/80 text-indigo-300 border border-indigo-800">
                                {item.brand}
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-2 text-center font-bold text-white">
                            {item.qty} <span className="text-[10px] text-slate-400 font-normal">{item.uom}</span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-white font-mono">
                            ₹{Number(item.costPrice || 0).toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">
                            {item.mrp !== null && item.mrp > 0 ? (
                              <div>
                                <span className="text-amber-300 font-bold">₹{Number(item.mrp).toFixed(2)}</span>
                                {item.mrpDiff !== null && item.mrpDiff !== 0 && (
                                  <div className="text-[9px] text-amber-400/80 font-mono">
                                    Diff: {item.mrpDiff > 0 ? '+' : ''}₹{Number(item.mrpDiff).toFixed(2)}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-500 italic">null</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">
                            {item.sellingPrice !== null && item.sellingPrice > 0 ? (
                              <span className="text-emerald-400 font-bold">₹{Number(item.sellingPrice).toFixed(2)}</span>
                            ) : (
                              <span className="text-slate-500 italic">null</span>
                            )}
                          </td>
                          {/* Cost Difference vs Previous Purchase Rate */}
                          <td className="py-2.5 px-3 text-center font-mono">
                            {item.previousCostPrice === null ? (
                              <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 border border-slate-700">
                                Base Rate
                              </span>
                            ) : item.costDiff === 0 ? (
                              <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                                ₹0.00 (Same)
                              </span>
                            ) : item.costDiff > 0 ? (
                              <div className="inline-block px-2 py-0.5 rounded text-[10px] bg-rose-950/80 text-rose-300 border border-rose-800 font-bold">
                                <div className="flex items-center gap-0.5 justify-center">
                                  <TrendingUp className="w-3 h-3 text-rose-400" />
                                  <span>+₹{Number(item.costDiff).toFixed(2)}</span>
                                </div>
                                <div className="text-[9px] text-rose-400/80 font-normal">
                                  +{item.costDiffPercent}% (was ₹{Number(item.previousCostPrice).toFixed(2)})
                                </div>
                              </div>
                            ) : (
                              <div className="inline-block px-2 py-0.5 rounded text-[10px] bg-emerald-950/80 text-emerald-300 border border-emerald-800 font-bold">
                                <div>-₹{Math.abs(Number(item.costDiff)).toFixed(2)}</div>
                                <div className="text-[9px] text-emerald-400/80 font-normal">
                                  {item.costDiffPercent}% (was ₹{Number(item.previousCostPrice).toFixed(2)})
                                </div>
                              </div>
                            )}
                          </td>
                          {/* Margin / Selling Difference (SP - CP) */}
                          <td className="py-2.5 px-3 text-center font-mono">
                            {item.spDiff !== null ? (
                              <div className="inline-block px-2 py-0.5 rounded text-[10px] bg-emerald-950/80 text-emerald-300 border border-emerald-800 font-bold">
                                <div>+₹{Number(item.spDiff).toFixed(2)}</div>
                                <div className="text-[9px] text-emerald-400 font-normal">{item.marginPercent}% Margin</div>
                              </div>
                            ) : (
                              <span className="text-slate-500 italic text-[11px]">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-center text-slate-300 font-mono">
                            <div>{item.taxRate}%</div>
                            <div className="text-[10px] text-slate-500">₹{Number(item.taxAmount || 0).toFixed(2)}</div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-white font-mono">
                            ₹{Number(item.lineTotal || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              ) : (
                /* ========================================================================= */
                /* VIEW 2: SUMMARY REGISTER (INVOICE-WISE WITH INLINE ACCORDION EXPANSION)    */
                /* ========================================================================= */
                <table className="w-full text-left text-xs min-w-[850px]">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-2 text-center w-8"></th>
                      <th className="py-2.5 px-3">Inward Doc #</th>
                      <th className="py-2.5 px-2 text-center">Type</th>
                      <th className="py-2.5 px-3">Supplier Invoice #</th>
                      <th className="py-2.5 px-3">Supplier Name</th>
                      <th className="py-2.5 px-2 text-center">Items</th>
                      <th className="py-2.5 px-3 text-right">Subtotal (₹)</th>
                      <th className="py-2.5 px-3 text-right">Tax (₹)</th>
                      <th className="py-2.5 px-3 text-right">Net Value (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
                    {purchasesResult.data.length === 0 ? (
                      <tr>
                        <td colSpan="9" className="py-12 text-center text-slate-500 font-sans">
                          {purchasesLoading
                            ? 'Loading purchases via indexed engine...'
                            : 'No inward goods records found for selected filter.'}
                        </td>
                      </tr>
                    ) : (
                      purchasesResult.data.map((p) => {
                        const isInit = Boolean(
                          p.isInitialStock ||
                          p.entryType === 'INITIAL_STOCK' ||
                          p.docNumber?.startsWith('INIT-')
                        );
                        const isExpanded = expandedPurchaseIds.has(p.id);
                        const lineItems = p.lines || p.items || [];

                        return (
                          <React.Fragment key={p.id}>
                            <tr className="hover:bg-slate-800/40 transition">
                              <td className="py-2 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => toggleExpandPurchase(p.id)}
                                  className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition cursor-pointer"
                                  title={isExpanded ? 'Collapse Items' : 'Expand Items'}
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="w-3.5 h-3.5 text-indigo-400" />
                                  ) : (
                                    <ChevronRight className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </td>
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
                                  <span className="font-bold">{p.supplierInvoiceNo || '—'}</span>
                                )}
                              </td>
                              <td className="py-2 px-3 font-sans text-white">{p.supplierName}</td>
                              <td className="py-2 px-2 text-center font-bold text-slate-300">
                                {lineItems.length}
                              </td>
                              <td className="py-2 px-3 text-right text-slate-300">₹{Number(p.subtotal || 0).toFixed(2)}</td>
                              <td className="py-2 px-3 text-right text-emerald-400">₹{Number(p.totalTax || 0).toFixed(2)}</td>
                              <td className="py-2 px-3 text-right font-bold text-white">
                                ₹{Number(p.netAmount || p.grandTotal || 0).toFixed(2)}
                              </td>
                            </tr>

                            {/* Inline Expandable Item Lines for Summary View */}
                            {isExpanded && (
                              <tr className="bg-slate-950/80 border-b border-indigo-900/30">
                                <td colSpan="9" className="p-3 pl-8">
                                  <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/60 p-2 space-y-2">
                                    <div className="font-bold text-[11px] text-indigo-300 flex items-center gap-1.5 font-sans">
                                      <Boxes className="w-3.5 h-3.5" />
                                      <span>Line Items in {p.docNumber}:</span>
                                    </div>
                                    <table className="w-full text-left text-xs border border-slate-800">
                                      <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase">
                                        <tr>
                                          <th className="py-1.5 px-2">#</th>
                                          <th className="py-1.5 px-3">Product Name</th>
                                          <th className="py-1.5 px-2 text-center">Qty</th>
                                          <th className="py-1.5 px-2 text-right">Cost Price (₹)</th>
                                          <th className="py-1.5 px-2 text-right">MRP (₹)</th>
                                          <th className="py-1.5 px-2 text-right">Selling (₹)</th>
                                          <th className="py-1.5 px-2 text-center">Margin / Diff</th>
                                          <th className="py-1.5 px-2 text-center">GST %</th>
                                          <th className="py-1.5 px-3 text-right">Total (₹)</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
                                        {lineItems.map((line, lIdx) => {
                                          const cp = Number(line.costPrice ?? line.rate ?? 0);
                                          const sp = Number(line.sellingPrice || 0);
                                          const mrp = Number(line.mrp || 0);
                                          const diff = sp > 0 ? Number((sp - cp).toFixed(2)) : null;
                                          const marginPct = sp > 0 ? Number((((sp - cp) / sp) * 100).toFixed(1)) : null;
                                          return (
                                            <tr key={lIdx} className="hover:bg-slate-800/40">
                                              <td className="py-1.5 px-2 text-slate-500 text-center">{lIdx + 1}</td>
                                              <td className="py-1.5 px-3 font-sans font-bold text-white">
                                                {line.name}
                                                {line.sku && <span className="block text-[10px] text-slate-500 font-mono">SKU: {line.sku}</span>}
                                              </td>
                                              <td className="py-1.5 px-2 text-center font-bold text-white">
                                                {line.qty} {line.uom || 'PCS'}
                                              </td>
                                              <td className="py-1.5 px-2 text-right text-slate-200">₹{cp.toFixed(2)}</td>
                                              <td className="py-1.5 px-2 text-right text-amber-300">
                                                {mrp > 0 ? `₹${mrp.toFixed(2)}` : 'null'}
                                              </td>
                                              <td className="py-1.5 px-2 text-right text-emerald-400">
                                                {sp > 0 ? `₹${sp.toFixed(2)}` : 'null'}
                                              </td>
                                              <td className="py-1.5 px-2 text-center">
                                                {diff !== null ? (
                                                  <span className="text-[10px] font-bold text-emerald-400">
                                                    +₹{diff.toFixed(2)} ({marginPct}%)
                                                  </span>
                                                ) : (
                                                  <span className="text-slate-500 italic">—</span>
                                                )}
                                              </td>
                                              <td className="py-1.5 px-2 text-center text-slate-300">{line.taxRate || 0}%</td>
                                              <td className="py-1.5 px-3 text-right font-bold text-white">
                                                ₹{Number(line.lineTotal || 0).toFixed(2)}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {/* AJAX Table Pagination */}
            <AjaxTablePagination
              totalCount={purchasesResult.totalCount}
              page={purchasesResult.page}
              pageSize={purchasesResult.pageSize}
              totalPages={purchasesResult.totalPages}
              startIndex={purchasesResult.startIndex}
              endIndex={purchasesResult.endIndex}
              isLoading={purchasesLoading}
              executionTimeMs={purchasesResult.executionTimeMs}
              onPageChange={(p) => setPurchasesPage(p)}
              onPageSizeChange={(ps) => {
                setPurchasesPageSize(ps);
                setPurchasesPage(1);
              }}
            />
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
                ₹{Number(initialStockResult.metrics.totalValuation || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-amber-300/80 font-semibold">Total Cost Value</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <span className="text-[11px] text-slate-400">Total Opening Units</span>
              <div className="text-xl font-bold font-mono text-white">
                {Number(initialStockResult.metrics.totalUnits || 0).toLocaleString('en-IN')}
              </div>
              <span className="text-[10px] text-slate-500">Across All Products</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <span className="text-[11px] text-slate-400">Cutover Documents / Batches</span>
              <div className="text-xl font-bold font-mono text-indigo-400">
                {initialStockResult.metrics.docCount || 0}
              </div>
              <span className="text-[10px] text-indigo-300 font-semibold">Inward Cutover Batches</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <span className="text-[11px] text-slate-400">Total Initialized Records</span>
              <div className="text-xl font-bold font-mono text-emerald-400">
                {initialStockResult.totalCount.toLocaleString('en-IN')}
              </div>
              <span className="text-[10px] text-emerald-300 font-semibold">Audited Line Items</span>
            </div>
          </div>

          {/* Search, Filter & Actions Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-3 rounded-xl text-xs shadow-md">
            <div className="flex flex-wrap items-center gap-2">
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
                className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 cursor-pointer"
              >
                <option value="ALL">All Warehouses</option>
                {(db.warehouses || []).map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={loadInitialStockReport}
                disabled={initialStockLoading}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition cursor-pointer"
                title="Refresh AJAX Query"
              >
                <RotateCw className={`w-3.5 h-3.5 ${initialStockLoading ? 'animate-spin text-amber-400' : ''}`} />
              </button>
            </div>
          </div>

          {/* Initial Stock Records Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md">
            <div className="p-3 border-b border-slate-800 font-bold text-white text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PackageCheck className="w-4 h-4 text-amber-400" />
                <span>Initial Stock Cutover Audit Ledger</span>
              </div>
              <span className="text-slate-400 font-mono">{initialStockResult.totalCount.toLocaleString('en-IN')} Items</span>
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
                  {initialStockResult.data.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="py-12 text-center text-slate-500 font-sans">
                        {initialStockLoading ? 'Loading opening stock records...' : 'No initial stock cutover records found matching current criteria.'}
                      </td>
                    </tr>
                  ) : (
                    initialStockResult.data.map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-slate-800/40 transition">
                        <td className="py-2.5 px-3 text-amber-300 font-bold">{item.docNumber}</td>
                        <td className="py-2.5 px-3 text-slate-400 font-sans">{item.effectiveDate || item.date || '—'}</td>
                        <td className="py-2.5 px-3 font-sans text-slate-200">{item.warehouseName}</td>
                        <td className="py-2.5 px-3 font-sans text-white font-bold">
                          {item.productName}
                          {item.sku && <span className="block text-[10px] text-slate-500 font-mono">SKU: {item.sku}</span>}
                        </td>
                        <td className="py-2.5 px-2 text-center font-bold text-white">{item.qty}</td>
                        <td className="py-2.5 px-3 text-right text-slate-300">₹{Number(item.rate || 0).toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-amber-400">₹{Number(item.totalVal || 0).toFixed(2)}</td>
                        <td className="py-2.5 px-3 font-sans text-slate-400 text-xs truncate max-w-[200px]">
                          {item.notes || 'Opening Stock Inward'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* AJAX Pagination */}
            <AjaxTablePagination
              totalCount={initialStockResult.totalCount}
              page={initialStockResult.page}
              pageSize={initialStockResult.pageSize}
              totalPages={initialStockResult.totalPages}
              startIndex={initialStockResult.startIndex}
              endIndex={initialStockResult.endIndex}
              isLoading={initialStockLoading}
              executionTimeMs={initialStockResult.executionTimeMs}
              onPageChange={(p) => setInitialStockPage(p)}
              onPageSizeChange={(ps) => {
                setInitialStockPageSize(ps);
                setInitialStockPage(1);
              }}
            />
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
                ₹{Number(stockResult.metrics.totalValuation || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                {stockResult.totalCount.toLocaleString('en-IN')} Tracked Balances
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <span className="text-[11px] text-slate-400">Total Current Stock Units</span>
              <div className="text-xl font-bold font-mono text-emerald-400">
                {Number(stockResult.metrics.totalUnits || 0).toLocaleString('en-IN')} Units
              </div>
              <span className="text-[10px] text-emerald-300 font-semibold">Physical On-Hand Inventory</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <span className="text-[11px] text-slate-400">Low Stock Reorder Alerts</span>
              <div
                className={`text-xl font-bold font-mono ${
                  stockResult.metrics.lowStockCount > 0 ? 'text-amber-400' : 'text-slate-400'
                }`}
              >
                {stockResult.metrics.lowStockCount || 0} Items Below Threshold
              </div>
              <span className="text-[10px] text-amber-300 font-semibold">Immediate Purchase Indent Required</span>
            </div>
          </div>

          {/* Search, Filter & Refresh Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-3 rounded-xl text-xs shadow-md">
            <div className="flex flex-wrap items-center gap-2">
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
                className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 cursor-pointer"
              >
                <option value="ALL">All Warehouses</option>
                {(db.warehouses || []).map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>

              <select
                value={stockStatusFilter}
                onChange={(e) => setStockStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 cursor-pointer"
              >
                <option value="ALL">All Stock Levels</option>
                <option value="LOW_STOCK">Low Stock Only</option>
                <option value="OUT_OF_STOCK">Out of Stock Only</option>
              </select>

              <button
                type="button"
                onClick={loadStockReport}
                disabled={stockLoading}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition cursor-pointer"
                title="Refresh AJAX Query"
              >
                <RotateCw className={`w-3.5 h-3.5 ${stockLoading ? 'animate-spin text-cyan-400' : ''}`} />
              </button>
            </div>
          </div>

          {/* Stock Table with Condition Breakdown */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md">
            <div className="p-3 border-b border-slate-800 font-bold text-white text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Boxes className="w-4 h-4 text-cyan-400" />
                <span>Warehouse Stock Balance Ledger (Initial Stock vs Purchased vs Outward Sales)</span>
              </div>
              <span className="text-slate-400 font-mono">{stockResult.totalCount.toLocaleString('en-IN')} Records</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[950px]">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Warehouse</th>
                    <th className="py-2.5 px-3">Product Name</th>
                    <th className="py-2.5 px-2 text-center text-amber-400">Initial Stock</th>
                    <th className="py-2.5 px-2 text-center text-indigo-400">Purchased In</th>
                    <th className="py-2.5 px-2 text-center text-rose-400">Sales Out</th>
                    <th className="py-2.5 px-3 text-center text-emerald-400">Current Stock</th>
                    <th className="py-2.5 px-3 text-right">Cost Rate (₹)</th>
                    <th className="py-2.5 px-3 text-right">MRP (₹)</th>
                    <th className="py-2.5 px-3 text-right">Selling Rate (₹)</th>
                    <th className="py-2.5 px-3 text-center">Margin / Diff</th>
                    <th className="py-2.5 px-3 text-right">Total Asset Value</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
                  {stockResult.data.length === 0 ? (
                    <tr>
                      <td colSpan="12" className="py-12 text-center text-slate-500 font-sans">
                        {stockLoading ? 'Loading stock balances via compound index...' : 'No stock records found matching current criteria.'}
                      </td>
                    </tr>
                  ) : (
                    stockResult.data.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-2 px-3 text-slate-400 font-sans">{s.warehouseName}</td>
                        <td className="py-2 px-3 font-sans font-bold text-white">
                          {s.productName}
                          {s.sku && <span className="block text-[10px] text-slate-500 font-mono">SKU: {s.sku}</span>}
                        </td>
                        <td className="py-2 px-2 text-center font-bold text-amber-400">{s.initialStockQty}</td>
                        <td className="py-2 px-2 text-center font-bold text-indigo-300">{s.purchasedInwardQty}</td>
                        <td className="py-2 px-2 text-center font-bold text-rose-400">{s.salesOutwardQty}</td>
                        <td className="py-2 px-3 text-center font-bold text-emerald-400 bg-emerald-950/20">{s.currentStock}</td>
                        <td className="py-2 px-3 text-right text-slate-300 font-mono">₹{Number(s.valRate || 0).toFixed(2)}</td>
                        <td className="py-2 px-3 text-right text-amber-300 font-mono">
                          {s.mrp > 0 ? `₹${Number(s.mrp).toFixed(2)}` : <span className="text-slate-500 italic">null</span>}
                        </td>
                        <td className="py-2 px-3 text-right text-emerald-400 font-mono">
                          {s.sellingRate > 0 ? `₹${Number(s.sellingRate).toFixed(2)}` : <span className="text-slate-500 italic">null</span>}
                        </td>
                        <td className="py-2 px-3 text-center font-mono">
                          {s.sellingRate > 0 ? (
                            <span className="text-[10px] font-bold text-emerald-400">
                              +₹{Number(s.priceDifference || 0).toFixed(2)} ({s.marginPercent}%)
                            </span>
                          ) : (
                            <span className="text-slate-500 italic text-[11px]">—</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-cyan-400 font-mono">₹{Number(s.totalVal || 0).toFixed(2)}</td>
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

            {/* AJAX Pagination */}
            <AjaxTablePagination
              totalCount={stockResult.totalCount}
              page={stockResult.page}
              pageSize={stockResult.pageSize}
              totalPages={stockResult.totalPages}
              startIndex={stockResult.startIndex}
              endIndex={stockResult.endIndex}
              isLoading={stockLoading}
              executionTimeMs={stockResult.executionTimeMs}
              onPageChange={(p) => setStockPage(p)}
              onPageSizeChange={(ps) => {
                setStockPageSize(ps);
                setStockPage(1);
              }}
            />
          </div>
        </div>
      )}

      {/* 4. GST STATUTORY (GSTR-1) TAB */}
      {activeReportTab === 'gst' && (
        <div className="space-y-4">
          {/* Date Filter Bar */}
          <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-md">
            <DateRangeFilter
              selectedFilter={salesDateFilter}
              onFilterChange={setSalesDateFilter}
              customFromDate={salesCustomFrom}
              customToDate={salesCustomTo}
              onCustomFromChange={setSalesCustomFrom}
              onCustomToChange={setSalesCustomTo}
              disabled={salesLoading}
            />

            <span className="text-xs text-slate-400 font-mono">
              {postedInvoices.length.toLocaleString('en-IN')} Taxable Outward Invoices
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <span className="text-[11px] text-slate-400">Total CGST (Central GST)</span>
              <div className="text-xl font-bold font-mono text-emerald-400">
                ₹{totalCGST.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-slate-500">50% Intra-State Share</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <span className="text-[11px] text-slate-400">Total SGST (State GST)</span>
              <div className="text-xl font-bold font-mono text-emerald-400">
                ₹{totalSGST.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-slate-500">50% Intra-State Share</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <span className="text-[11px] text-slate-400">Total IGST (Integrated GST)</span>
              <div className="text-xl font-bold font-mono text-purple-400">
                ₹{totalIGST.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-slate-500">100% Inter-State Consignments</span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md">
            <div className="p-3 border-b border-slate-800 font-bold text-white text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Percent className="w-4 h-4 text-indigo-400" />
                <span>GSTR-1 Outward Supplies Matrix</span>
              </div>
              <span className="text-slate-400 font-mono">{salesResult.totalCount.toLocaleString('en-IN')} Records</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[850px]">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Invoice #</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Customer / GSTIN</th>
                    <th className="py-2.5 px-3 text-right">Taxable (₹)</th>
                    <th className="py-2.5 px-3 text-right">CGST (₹)</th>
                    <th className="py-2.5 px-3 text-right">SGST (₹)</th>
                    <th className="py-2.5 px-3 text-right">IGST (₹)</th>
                    <th className="py-2.5 px-3 text-right">Total GST (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
                  {salesResult.data.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="py-12 text-center text-slate-500 font-sans">
                        No statutory records found for selected period.
                      </td>
                    </tr>
                  ) : (
                    salesResult.data.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-2 px-3 text-indigo-300 font-bold">{inv.docNumber}</td>
                        <td className="py-2 px-3 text-slate-400 font-sans">{new Date(inv.date).toLocaleDateString()}</td>
                        <td className="py-2 px-3 font-sans text-white">
                          <div>{inv.customerName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{inv.customerGstin || 'URP (Consumer)'}</div>
                        </td>
                        <td className="py-2 px-3 text-right text-slate-300">₹{Number(inv.taxableAmount || 0).toFixed(2)}</td>
                        <td className="py-2 px-3 text-right text-emerald-400">₹{Number(inv.cgstAmount || 0).toFixed(2)}</td>
                        <td className="py-2 px-3 text-right text-emerald-400">₹{Number(inv.sgstAmount || 0).toFixed(2)}</td>
                        <td className="py-2 px-3 text-right text-purple-400">₹{Number(inv.igstAmount || 0).toFixed(2)}</td>
                        <td className="py-2 px-3 text-right font-bold text-cyan-400">₹{Number(inv.totalTax || 0).toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <AjaxTablePagination
              totalCount={salesResult.totalCount}
              page={salesResult.page}
              pageSize={salesResult.pageSize}
              totalPages={salesResult.totalPages}
              startIndex={salesResult.startIndex}
              endIndex={salesResult.endIndex}
              isLoading={salesLoading}
              executionTimeMs={salesResult.executionTimeMs}
              onPageChange={(p) => setSalesPage(p)}
              onPageSizeChange={(ps) => {
                setSalesPageSize(ps);
                setSalesPage(1);
              }}
            />
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
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow transition cursor-pointer"
                >
                  Generate XML Batch
                </button>
                {tallyXmlOutput && (
                  <button
                    onClick={handleDownloadXml}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow flex items-center gap-1.5 transition cursor-pointer"
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
