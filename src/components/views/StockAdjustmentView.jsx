// StockAdjustmentView: Physical Inventory Counting, Stock Add/Subtract, Barcode Search & Approval Workflows
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { StockAdjustmentService } from '../../services/stockAdjustmentService.js';
import { StockService } from '../../services/stockService.js';
import { logBacklog } from '../../services/storageService.js';
import {
  ClipboardCheck,
  Plus,
  Minus,
  Equal,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Warehouse,
  Search,
  ScanBarcode,
  ArrowUpDown,
  Tag,
  DollarSign,
  Package,
  Filter,
  X,
  RefreshCw,
  Boxes,
  TrendingUp,
  TrendingDown,
  Layers,
  ArrowRight,
} from 'lucide-react';
import ExportButtons from '../common/ExportButtons.jsx';

export default function StockAdjustmentView() {
  const { db, activeWarehouse, currentUser, notify, triggerRefresh } = useApp();

  const [activeTab, setActiveTab] = useState('new'); // 'new' | 'list'
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(
    activeWarehouse?.id || db.warehouses?.[0]?.id || 'WH-MUM-MAIN'
  );

  // Search & Barcode state
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState(null);

  // Adjustment Action state: 'ADD' | 'SUBTRACT' | 'SET'
  const [adjustmentMode, setAdjustmentMode] = useState('ADD');
  const [adjustQty, setAdjustQty] = useState(1);
  const [countedQty, setCountedQty] = useState(0);
  const [reason, setReason] = useState('PHYSICAL_COUNT');
  const [notes, setNotes] = useState('');

  // Log table search
  const [logSearch, setLogSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const searchInputRef = useRef(null);
  const qtyInputRef = useRef(null);

  // Synchronize active warehouse if context changes
  useEffect(() => {
    if (activeWarehouse?.id && !selectedWarehouseId) {
      setSelectedWarehouseId(activeWarehouse.id);
    }
  }, [activeWarehouse, selectedWarehouseId]);

  // Compute products list with current warehouse stock, stock ID, MRP, and Selling Price
  const productsWithStock = useMemo(() => {
    const whId = selectedWarehouseId || activeWarehouse?.id || 'WH-MUM-MAIN';
    return (db.products || []).map((p) => {
      const stockRow = (db.stockBalances || []).find(
        (b) => b.warehouseId === whId && b.productId === p.id
      );
      const currentStock = stockRow ? Number(stockRow.quantity || 0) : 0;
      const stockId = stockRow?.id || `STK-${whId}-${p.id}`;
      const mrp = Number(p.mrp || 0);
      const sellingPrice = Number(p.sellingRate || 0);
      const costPrice = Number(stockRow?.valuationRate || p.costRate || 0);

      return {
        ...p,
        stockRow,
        stockId,
        currentStock,
        mrp,
        sellingPrice,
        costPrice,
      };
    });
  }, [db.products, db.stockBalances, selectedWarehouseId, activeWarehouse]);

  // Set default selected product once products are available
  useEffect(() => {
    if (!selectedProductId && productsWithStock.length > 0) {
      setSelectedProductId(productsWithStock[0].id);
      setCountedQty(productsWithStock[0].currentStock);
    }
  }, [productsWithStock, selectedProductId]);

  // Filter products by Name, SKU, Barcode, or Stock ID
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return productsWithStock;
    const q = productSearch.toLowerCase().trim();
    return productsWithStock.filter((p) => {
      return (
        p.name?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q) ||
        p.stockId?.toLowerCase().includes(q) ||
        p.id?.toLowerCase().includes(q)
      );
    });
  }, [productsWithStock, productSearch]);

  // The currently active selected product
  const selectedProduct = useMemo(() => {
    return productsWithStock.find((p) => p.id === selectedProductId) || productsWithStock[0] || null;
  }, [productsWithStock, selectedProductId]);

  // Handle selecting a product from search/table
  const handleSelectProduct = (prod) => {
    if (!prod) return;
    setSelectedProductId(prod.id);
    setCountedQty(prod.currentStock);
    setAdjustQty(1);
    // Focus quantity input for fast adjustment
    setTimeout(() => {
      qtyInputRef.current?.focus();
      qtyInputRef.current?.select();
    }, 100);
  };

  // Barcode / Search Enter key handler (exact barcode/SKU scanner match)
  const handleBarcodeSearchSubmit = (e) => {
    if (e) e.preventDefault();
    const q = productSearch.trim();
    if (!q) return;

    // Check exact barcode or SKU or Stock ID match
    const exactMatch = productsWithStock.find(
      (p) =>
        p.barcode?.toLowerCase() === q.toLowerCase() ||
        p.sku?.toLowerCase() === q.toLowerCase() ||
        p.stockId?.toLowerCase() === q.toLowerCase()
    );

    if (exactMatch) {
      handleSelectProduct(exactMatch);
      notify('info', `Found: ${exactMatch.name} (Barcode: ${exactMatch.barcode || exactMatch.sku})`, 'Barcode Matched');
      setProductSearch('');
    } else if (filteredProducts.length === 1) {
      handleSelectProduct(filteredProducts[0]);
      setProductSearch('');
    } else if (filteredProducts.length === 0) {
      notify('warning', `No product found matching "${q}".`, 'Search Result');
    }
  };

  // Calculations for Add / Subtract / Count
  const currentStock = selectedProduct ? selectedProduct.currentStock : 0;
  let variance = 0;
  let resultingStock = currentStock;

  if (adjustmentMode === 'ADD') {
    const addQty = Math.max(0, Number(adjustQty) || 0);
    variance = addQty;
    resultingStock = currentStock + addQty;
  } else if (adjustmentMode === 'SUBTRACT') {
    const subQty = Math.max(0, Number(adjustQty) || 0);
    variance = -subQty;
    resultingStock = currentStock - subQty;
  } else {
    // Direct count (SET)
    const cQty = Math.max(0, Number(countedQty) || 0);
    variance = cQty - currentStock;
    resultingStock = cQty;
  }

  const costRate = Number(selectedProduct?.costPrice || selectedProduct?.costRate || 0);
  const valuationImpact = Math.abs(variance * costRate);

  const isMaterialThresholdExceeded =
    Math.abs(variance) > (db.settings?.managerApprovalThresholdQty || 10) ||
    valuationImpact > (db.settings?.managerApprovalThresholdAmount || 5000);

  // User role & permission check for Manager / Admin approval
  const canApprove =
    currentUser?.role === 'STORE_MANAGER' ||
    currentUser?.role === 'COMPANY_ADMIN' ||
    currentUser?.role === 'ADMINISTRATOR' ||
    currentUser?.roleId === 'ROLE_ADMIN' ||
    currentUser?.roleId === 'ROLE_STORE_MANAGER' ||
    currentUser?.permissions?.includes('ALL_PERMISSIONS') ||
    currentUser?.permissions?.includes('APPROVE_ADJUSTMENT');

  // Submit stock adjustment
  const handleSubmitAdjustment = (e) => {
    e.preventDefault();
    if (!selectedProduct) {
      notify('error', 'Please select a product to adjust stock.', 'Validation Error');
      return;
    }

    const qty = Number(adjustQty);
    if (adjustmentMode !== 'SET' && (isNaN(qty) || qty <= 0)) {
      notify('error', 'Please enter a valid quantity greater than zero.', 'Validation Error');
      return;
    }

    if (adjustmentMode === 'SUBTRACT' && db.settings?.blockNegativeStock && qty > currentStock) {
      notify(
        'error',
        `Cannot subtract ${qty} units. Current stock is ${currentStock} units. Negative stock is strictly blocked.`,
        'Negative Stock Blocked'
      );
      return;
    }

    try {
      const res = StockAdjustmentService.submitAdjustment({
        warehouseId: selectedWarehouseId,
        productId: selectedProduct.id,
        stockId: selectedProduct.stockId,
        adjustmentMode,
        deltaQty: adjustmentMode === 'SET' ? null : qty,
        countedQty: adjustmentMode === 'SET' ? countedQty : resultingStock,
        reason,
        notes,
        userRole: currentUser?.roleId || currentUser?.role,
        userId: currentUser?.id,
      });

      if (res.status === 'PENDING_APPROVAL') {
        notify(
          'warning',
          `Adjustment ${res.docNumber} (${variance > 0 ? '+' : ''}${variance} units) exceeds material threshold and requires Store Manager approval.`,
          'Pending Approval'
        );
      } else {
        notify(
          'success',
          `Stock ${adjustmentMode === 'ADD' ? 'increased (+)' : adjustmentMode === 'SUBTRACT' ? 'reduced (-)' : 'counted (=)'}! "${selectedProduct.name}" stock updated from ${currentStock} to ${resultingStock} units.`,
          'Stock Adjusted'
        );
      }

      logBacklog({
        action: 'SAVE',
        formName: 'Stock Adjustment',
        recordRef: res.docNumber,
        userId: currentUser?.id,
        userName: currentUser?.name,
        userRole: currentUser?.role,
        details: `Stock adjustment ${res.docNumber} [${adjustmentMode}] for ${selectedProduct.name} (Stock ID: ${selectedProduct.stockId}, Barcode: ${selectedProduct.barcode || '—'}, Current: ${currentStock}, Delta: ${variance > 0 ? '+' + variance : variance}, Resulting: ${resultingStock}, MRP: ₹${selectedProduct.mrp}, SP: ₹${selectedProduct.sellingPrice})`,
      });

      triggerRefresh();
      setAdjustQty(1);
      setActiveTab('list');
    } catch (err) {
      notify('error', err.message, 'Adjustment Failed');
    }
  };

  // Manager Approve pending adjustment
  const handleApprove = (adjId) => {
    try {
      const res = StockAdjustmentService.approveAdjustment(adjId, currentUser?.id || 'USR-ADMIN');
      logBacklog({
        action: 'UPDATE',
        formName: 'Stock Adjustment',
        recordRef: res.docNumber,
        userId: currentUser?.id,
        userName: currentUser?.name,
        userRole: currentUser?.role,
        details: `Approved stock adjustment ${res.docNumber} by manager`,
      });
      notify(
        'success',
        `Stock adjustment ${res.docNumber} approved! Warehouse stock balance has been updated.`,
        'Adjustment Approved'
      );
      triggerRefresh();
    } catch (err) {
      notify('error', err.message, 'Approval Failed');
    }
  };

  // Filtered adjustments log
  const filteredAdjustmentsLog = useMemo(() => {
    let list = db.stockAdjustments || [];
    if (statusFilter !== 'ALL') {
      list = list.filter((a) => a.status === statusFilter);
    }
    if (logSearch.trim()) {
      const q = logSearch.toLowerCase().trim();
      list = list.filter((a) => {
        return (
          a.docNumber?.toLowerCase().includes(q) ||
          a.productName?.toLowerCase().includes(q) ||
          a.productSku?.toLowerCase().includes(q) ||
          a.barcode?.toLowerCase().includes(q) ||
          a.stockId?.toLowerCase().includes(q) ||
          a.reason?.toLowerCase().includes(q) ||
          a.warehouseName?.toLowerCase().includes(q)
        );
      });
    }
    return list;
  }, [db.stockAdjustments, logSearch, statusFilter]);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 space-y-4">
      {/* Top Header & Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between bg-slate-900 border border-slate-800 p-3 sm:p-4 rounded-xl shadow-md gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('new')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'new'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
            }`}
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>Perform Stock Adjustment</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('list')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'list'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
            }`}
          >
            <ClipboardCheck className="w-4 h-4" />
            <span>Adjustments Register ({db.stockAdjustments?.length || 0})</span>
          </button>
        </div>

        {/* Warehouse Selector */}
        <div className="flex items-center gap-2 text-xs">
          <Warehouse className="w-4 h-4 text-slate-400" />
          <span className="text-slate-400 hidden sm:inline">Active Warehouse:</span>
          <select
            value={selectedWarehouseId}
            onChange={(e) => setSelectedWarehouseId(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-semibold focus:border-indigo-500 focus:outline-none cursor-pointer"
          >
            {(db.warehouses || []).map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.id})
              </option>
            ))}
          </select>
        </div>

        {activeTab === 'list' && (
          <ExportButtons
            data={filteredAdjustmentsLog.map((adj, idx) => ({
              '#': idx + 1,
              'Adjustment #': adj.docNumber,
              'Date & Time': new Date(adj.createdAt).toLocaleString(),
              'Warehouse': adj.warehouseName || adj.warehouseId,
              'Stock ID': adj.stockId || '—',
              'Barcode': adj.barcode || '—',
              'Product Name': adj.productName,
              'SKU': adj.productSku || '—',
              'Book Qty': adj.bookQty,
              'Action': adj.adjustmentMode || (adj.adjustmentQty >= 0 ? 'ADD' : 'SUBTRACT'),
              'Adjustment (Delta)': adj.adjustmentQty > 0 ? `+${adj.adjustmentQty}` : adj.adjustmentQty,
              'Resulting Qty': adj.countedQty,
              'MRP (₹)': adj.mrp ? `₹${Number(adj.mrp).toFixed(2)}` : 'null',
              'Selling Price (₹)': adj.sellingPrice ? `₹${Number(adj.sellingPrice).toFixed(2)}` : 'null',
              'Valuation Impact': `₹${adj.valuationImpact?.toFixed(2)}`,
              'Reason': adj.reason,
              'Status': adj.status,
            }))}
            filename="STOCK_ADJUSTMENTS_REGISTER"
            title="PHYSICAL STOCK ADJUSTMENTS & VARIANCE REGISTER"
            pdfOrientation="landscape"
          />
        )}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: PERFORM STOCK ADJUSTMENT (ADD / SUBTRACT / BARCODE SEARCH)          */}
      {/* ========================================================================= */}
      {activeTab === 'new' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Column: Product Search & Barcode Lookup (7 Cols) */}
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div>
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <Package className="w-4 h-4 text-indigo-400" />
                  <span>Select Product to Adjust</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Search by Product Name, SKU, Barcode, or Stock ID
                </p>
              </div>
              <span className="text-[11px] font-mono text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-800/40">
                {filteredProducts.length} Products Found
              </span>
            </div>

            {/* Barcode & Search Input Bar */}
            <form onSubmit={handleBarcodeSearchSubmit} className="relative">
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Type product name, SKU, or scan barcode..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-24 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
                <div className="absolute right-1.5 flex items-center gap-1">
                  {productSearch && (
                    <button
                      type="button"
                      onClick={() => setProductSearch('')}
                      className="p-1 text-slate-400 hover:text-white rounded"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="submit"
                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
                    title="Search or Scan Barcode"
                  >
                    <ScanBarcode className="w-3.5 h-3.5" />
                    <span>Scan / Find</span>
                  </button>
                </div>
              </div>
            </form>

            {/* Product Table with Stock ID, Barcode, Current Stock, MRP, Selling Price */}
            <div className="border border-slate-800 rounded-lg overflow-hidden max-h-[460px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] sticky top-0 border-b border-slate-800 z-10">
                  <tr>
                    <th className="py-2 px-2.5">Stock ID</th>
                    <th className="py-2 px-3">Product Name & SKU</th>
                    <th className="py-2 px-2">Barcode</th>
                    <th className="py-2 px-2 text-center">Current Stock</th>
                    <th className="py-2 px-2 text-right">MRP (₹)</th>
                    <th className="py-2 px-2 text-right">Selling (₹)</th>
                    <th className="py-2 px-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-10 text-center text-slate-500 font-sans">
                        No products match "{productSearch}".
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => {
                      const isSelected = selectedProduct?.id === p.id;
                      return (
                        <tr
                          key={p.id}
                          onClick={() => handleSelectProduct(p)}
                          className={`transition cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-950/40 border-l-4 border-indigo-500'
                              : 'hover:bg-slate-800/40'
                          }`}
                        >
                          <td className="py-2 px-2.5 font-bold text-indigo-300 whitespace-nowrap">
                            <span className="flex items-center gap-1">
                              <Tag className="w-3 h-3 text-indigo-400" />
                              <span>{p.stockId}</span>
                            </span>
                          </td>
                          <td className="py-2 px-3 font-sans">
                            <div className="font-bold text-white text-xs">{p.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{p.sku}</div>
                          </td>
                          <td className="py-2 px-2 text-slate-300">
                            {p.barcode ? (
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] border border-slate-700">
                                {p.barcode}
                              </span>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                p.currentStock > 10
                                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                                  : p.currentStock > 0
                                  ? 'bg-amber-950 text-amber-400 border border-amber-800/60'
                                  : 'bg-rose-950 text-rose-400 border border-rose-800/60'
                              }`}
                            >
                              {p.currentStock} {p.uom || 'PCS'}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-right text-amber-300">
                            {p.mrp > 0 ? `₹${p.mrp.toFixed(2)}` : <span className="text-slate-600">null</span>}
                          </td>
                          <td className="py-2 px-2 text-right font-bold text-emerald-400">
                            {p.sellingPrice > 0 ? `₹${p.sellingPrice.toFixed(2)}` : <span className="text-slate-600">null</span>}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectProduct(p);
                              }}
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold transition ${
                                isSelected
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                              }`}
                            >
                              {isSelected ? 'Active' : 'Select'}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Column: Add / Subtract / Count Form (5 Cols) */}
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md space-y-4">
            <div className="border-b border-slate-800 pb-2.5">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <ArrowUpDown className="w-4 h-4 text-emerald-400" />
                <span>Adjust Stock with Stock ID</span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Perform Add or Subtract to directly effect current stock balance
              </p>
            </div>

            {/* Selected Product KPI Card */}
            {selectedProduct ? (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">
                      Selected Item
                    </span>
                    <h4 className="text-sm font-bold text-white font-sans">{selectedProduct.name}</h4>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      SKU: {selectedProduct.sku} • Barcode: {selectedProduct.barcode || '—'}
                    </div>
                  </div>
                  <span className="px-2 py-1 rounded text-[10px] font-mono font-bold bg-indigo-950 text-indigo-300 border border-indigo-800 shrink-0">
                    {selectedProduct.stockId}
                  </span>
                </div>

                {/* 4 Details Grid: Stock ID, Current Stock, MRP, Selling Price */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800/80 text-center font-mono">
                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                    <span className="text-[9px] uppercase text-slate-400 block font-sans">Stock ID</span>
                    <span className="text-xs font-bold text-indigo-300 block truncate" title={selectedProduct.stockId}>
                      {selectedProduct.stockId}
                    </span>
                  </div>

                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                    <span className="text-[9px] uppercase text-slate-400 block font-sans">Current Stock</span>
                    <span className="text-sm font-bold text-emerald-400 block">
                      {currentStock} {selectedProduct.uom || 'PCS'}
                    </span>
                  </div>

                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                    <span className="text-[9px] uppercase text-slate-400 block font-sans">MRP (₹)</span>
                    <span className="text-xs font-bold text-amber-300 block">
                      {selectedProduct.mrp > 0 ? `₹${selectedProduct.mrp.toFixed(2)}` : 'null'}
                    </span>
                  </div>

                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                    <span className="text-[9px] uppercase text-slate-400 block font-sans">Selling Price</span>
                    <span className="text-xs font-bold text-emerald-400 block">
                      {selectedProduct.sellingPrice > 0 ? `₹${selectedProduct.sellingPrice.toFixed(2)}` : 'null'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-center text-slate-500 text-xs">
                No product selected. Please select a product from the list.
              </div>
            )}

            {/* Adjustment Form */}
            <form onSubmit={handleSubmitAdjustment} className="space-y-3.5 text-xs">
              {/* Mode Toggle: ADD (+) | SUBTRACT (-) | DIRECT COUNT (=) */}
              <div>
                <label className="font-semibold text-slate-300 block mb-1.5">
                  Select Adjustment Mode:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustmentMode('ADD')}
                    className={`py-2 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer border ${
                      adjustmentMode === 'ADD'
                        ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-600/30'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>ADD (+)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdjustmentMode('SUBTRACT')}
                    className={`py-2 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer border ${
                      adjustmentMode === 'SUBTRACT'
                        ? 'bg-rose-600 border-rose-500 text-white shadow-lg shadow-rose-600/30'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <Minus className="w-3.5 h-3.5" />
                    <span>SUBTRACT (-)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdjustmentMode('SET')}
                    className={`py-2 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer border ${
                      adjustmentMode === 'SET'
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <Equal className="w-3.5 h-3.5" />
                    <span>COUNT (=)</span>
                  </button>
                </div>
              </div>

              {/* Quantity Input Field */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-semibold text-xs">
                    {adjustmentMode === 'ADD'
                      ? 'Quantity to Add to Stock (+):'
                      : adjustmentMode === 'SUBTRACT'
                      ? 'Quantity to Subtract from Stock (-):'
                      : 'Physical Counted Total (=):'}
                  </label>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Current: {currentStock} units
                  </span>
                </div>

                {adjustmentMode === 'SET' ? (
                  <input
                    ref={qtyInputRef}
                    type="number"
                    min="0"
                    step="any"
                    value={countedQty}
                    onChange={(e) => setCountedQty(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-indigo-500 rounded-lg px-3 py-2 font-mono font-bold text-white text-base text-center focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                ) : (
                  <input
                    ref={qtyInputRef}
                    type="number"
                    min="0.01"
                    step="any"
                    value={adjustQty}
                    onChange={(e) => setAdjustQty(e.target.value)}
                    placeholder="Enter quantity..."
                    className={`w-full bg-slate-900 border rounded-lg px-3 py-2 font-mono font-bold text-white text-base text-center focus:outline-none focus:ring-1 ${
                      adjustmentMode === 'ADD'
                        ? 'border-emerald-500 focus:ring-emerald-500'
                        : 'border-rose-500 focus:ring-rose-500'
                    }`}
                  />
                )}

                {/* Live Stock Effect Banner */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
                  <div className="text-slate-400 font-sans">
                    <span>Resulting Stock Balance:</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">{currentStock}</span>
                    <span
                      className={`font-bold ${
                        variance >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {variance > 0 ? `+${variance}` : variance}
                    </span>
                    <ArrowRight className="w-3 h-3 text-slate-500" />
                    <span
                      className={`text-sm font-black px-2 py-0.5 rounded ${
                        resultingStock > 0
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : resultingStock === 0
                          ? 'bg-slate-800 text-slate-300 border border-slate-700'
                          : 'bg-rose-950 text-rose-300 border border-rose-800'
                      }`}
                    >
                      {resultingStock} units
                    </span>
                  </div>
                </div>

                {/* Subtraction exceeding current stock warning */}
                {adjustmentMode === 'SUBTRACT' && Number(adjustQty) > currentStock && (
                  <div className="text-[11px] text-rose-400 bg-rose-950/40 p-2 rounded border border-rose-900/60 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      Warning: Subtracting {adjustQty} will result in negative stock. If negative stock
                      blocking is enabled, this adjustment will be blocked.
                    </span>
                  </div>
                )}
              </div>

              {/* Valuation Impact Banner */}
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400">Valuation Impact:</span>
                <span className="font-mono font-bold text-slate-200">
                  ₹{valuationImpact.toFixed(2)}
                  <span className="text-[10px] text-slate-500 font-sans ml-1">
                    (@ ₹{costRate.toFixed(2)}/unit)
                  </span>
                </span>
              </div>

              {/* Approval Warning if threshold exceeded */}
              {isMaterialThresholdExceeded && (
                <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-2.5 text-amber-200 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Manager Approval Required:</span> Variance exceeds threshold
                    ({db.settings?.managerApprovalThresholdQty || 10} units or ₹
                    {db.settings?.managerApprovalThresholdAmount || 5000}). Entry will be queued as{' '}
                    <code className="text-amber-400">PENDING_APPROVAL</code>.
                  </div>
                </div>
              )}

              {/* Controlled Reason Code */}
              <div>
                <label className="font-semibold text-slate-300 block mb-1">
                  Controlled Reason Code:
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="PHYSICAL_COUNT">Routine Physical Count Variance</option>
                  <option value="FOUND_STOCK">Surplus / Found Stock (ADD)</option>
                  <option value="DAMAGE">Warehouse Damage / Breakage / Leakage (SUBTRACT)</option>
                  <option value="EXPIRY">Batch Expiry / Best-Before Passed (SUBTRACT)</option>
                  <option value="LOSS">Pilferage / Transit / Shrinkage Loss (SUBTRACT)</option>
                  <option value="DATA_CORRECTION">Data Entry / Inward Omission Correction</option>
                </select>
              </div>

              {/* Audit Notes */}
              <div>
                <label className="font-semibold text-slate-300 block mb-1">
                  Audit Notes / Sheet # (Optional):
                </label>
                <input
                  type="text"
                  placeholder="Count sheet reference / Auditor remarks..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setAdjustQty(1);
                    setNotes('');
                  }}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Reset
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-lg transition cursor-pointer ${
                    adjustmentMode === 'ADD'
                      ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                      : adjustmentMode === 'SUBTRACT'
                      ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30'
                      : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {adjustmentMode === 'ADD'
                      ? `Confirm ADD (+${adjustQty || 0}) to Stock`
                      : adjustmentMode === 'SUBTRACT'
                      ? `Confirm SUBTRACT (-${adjustQty || 0}) from Stock`
                      : `Apply Counted Stock (${countedQty})`}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ADJUSTMENTS AUDIT REGISTER / LOG TABLE                              */}
      {/* ========================================================================= */}
      {activeTab === 'list' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md space-y-3 p-4">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1 max-w-lg">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search adjustments by doc #, product, barcode, stock ID..."
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-8 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                {logSearch && (
                  <button
                    onClick={() => setLogSearch('')}
                    className="absolute right-2 top-2 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="POSTED">POSTED Only</option>
                <option value="PENDING_APPROVAL">Pending Approval Only</option>
              </select>
            </div>

            <span className="text-xs text-slate-400 font-mono">
              Showing {filteredAdjustmentsLog.length} of {db.stockAdjustments?.length || 0} adjustments
            </span>
          </div>

          {/* Adjustments Table */}
          <div className="overflow-x-auto border border-slate-800 rounded-lg">
            <table className="w-full text-left text-xs min-w-[950px]">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Adjustment #</th>
                  <th className="py-2.5 px-3">Date & Time</th>
                  <th className="py-2.5 px-3">Stock ID</th>
                  <th className="py-2.5 px-3">Product Name & Barcode</th>
                  <th className="py-2.5 px-2 text-center">Book Qty</th>
                  <th className="py-2.5 px-2 text-center">Adjustment</th>
                  <th className="py-2.5 px-2 text-center">Resulting Qty</th>
                  <th className="py-2.5 px-2 text-right">MRP (₹)</th>
                  <th className="py-2.5 px-2 text-right">Selling (₹)</th>
                  <th className="py-2.5 px-3 text-right">Valuation Impact</th>
                  <th className="py-2.5 px-3">Reason</th>
                  <th className="py-2.5 px-2 text-center">Status</th>
                  <th className="py-2.5 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {filteredAdjustmentsLog.length === 0 ? (
                  <tr>
                    <td colSpan="13" className="py-10 text-center text-slate-500 text-xs font-sans">
                      No stock count adjustments found matching filter.
                    </td>
                  </tr>
                ) : (
                  filteredAdjustmentsLog.map((adj) => {
                    const isPositive = adj.adjustmentQty > 0;
                    return (
                      <tr key={adj.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-2.5 px-3 font-mono font-bold text-indigo-300">
                          {adj.docNumber}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 text-[11px] whitespace-nowrap">
                          {new Date(adj.createdAt).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-indigo-300 font-bold whitespace-nowrap">
                          {adj.stockId || '—'}
                        </td>
                        <td className="py-2.5 px-3 font-sans">
                          <div className="font-semibold text-slate-200">{adj.productName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {adj.productSku && `SKU: ${adj.productSku} • `}
                            {adj.barcode ? `Barcode: ${adj.barcode}` : 'Barcode: —'}
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-center text-slate-400 font-bold">
                          {adj.bookQty}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isPositive
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : adj.adjustmentQty < 0
                                ? 'bg-rose-950 text-rose-400 border border-rose-800'
                                : 'bg-slate-800 text-slate-300 border border-slate-700'
                            }`}
                          >
                            {isPositive
                              ? `+${adj.adjustmentQty} (${adj.adjustmentMode || 'ADD'})`
                              : adj.adjustmentQty < 0
                              ? `${adj.adjustmentQty} (${adj.adjustmentMode || 'SUBTRACT'})`
                              : `0 (${adj.adjustmentMode || 'COUNT'})`}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-center font-bold text-white">
                          {adj.countedQty}
                        </td>
                        <td className="py-2.5 px-2 text-right text-amber-300">
                          {adj.mrp ? `₹${Number(adj.mrp).toFixed(2)}` : <span className="text-slate-600">null</span>}
                        </td>
                        <td className="py-2.5 px-2 text-right text-emerald-400 font-bold">
                          {adj.sellingPrice ? `₹${Number(adj.sellingPrice).toFixed(2)}` : <span className="text-slate-600">null</span>}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                          ₹{Number(adj.valuationImpact || 0).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 text-[11px] font-sans">
                          {adj.reason}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              adj.status === 'POSTED'
                                ? 'bg-emerald-950/70 text-emerald-400 border border-emerald-800/40'
                                : 'bg-amber-950/70 text-amber-400 border border-amber-800/40 animate-pulse'
                            }`}
                          >
                            {adj.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {adj.status === 'PENDING_APPROVAL' && (
                            canApprove ? (
                              <button
                                type="button"
                                onClick={() => handleApprove(adj.id)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-semibold flex items-center gap-1 mx-auto transition cursor-pointer"
                              >
                                <CheckCircle2 className="w-3 h-3" /> Approve Post
                              </button>
                            ) : (
                              <span className="text-[10px] text-amber-400 italic font-sans">
                                Needs Manager
                              </span>
                            )
                          )}
                          {adj.status === 'POSTED' && (
                            <span className="text-slate-500 text-[11px] font-sans">Completed</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
