// PurchaseReturnView: Supplier Purchase Returns & Debit Notes
// Supports:
// 1. Return against an inward purchase to that supplier (with option to choose different supplier)
// 2. Return against a product to any chosen supplier (ad-hoc / direct product return)
// 3. Automatic stock reduction in common table (db.stockBalances) and movement ledger
// 4. View, Edit, Delete (with stock restoration), and Print (A4 Debit Note Voucher)

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { PurchasePostingService } from '../../services/purchasePostingService.js';
import { StockService } from '../../services/stockService.js';
import { numberToWords } from '../../utils/numberToWords.js';
import {
  RotateCcw,
  Plus,
  Search,
  Eye,
  Edit,
  Printer,
  Trash2,
  X,
  CheckCircle2,
  AlertTriangle,
  Truck,
  FileText,
  Building2,
  Calendar,
  DollarSign,
  Barcode,
  Store,
  ShoppingBag,
  ArrowLeft,
  Check,
  Package,
} from 'lucide-react';
import ExportButtons from '../common/ExportButtons.jsx';

export default function PurchaseReturnView() {
  const { db, activeCompany, activeStore, activeWarehouse, currentUser, notify, triggerRefresh } = useApp();

  // Navigation tab: 'list' | 'new'
  const [activeTab, setActiveTab] = useState('list');
  const [editingReturnId, setEditingReturnId] = useState(null);

  // Search & Filters for List View
  const [searchQuery, setSearchQuery] = useState('');
  const [modeFilter, setModeFilter] = useState('ALL');
  const [supplierFilter, setSupplierFilter] = useState('ALL');

  // Modals: View, Print, Delete
  const [viewingReturn, setViewingReturn] = useState(null);
  const [printingReturn, setPrintingReturn] = useState(null);
  const [deletingReturn, setDeletingReturn] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    docNumber: '',
    date: new Date().toISOString().split('T')[0],
    returnMode: 'AGAINST_PURCHASE', // 'AGAINST_PURCHASE' | 'DIRECT_PRODUCT'
    storeId: activeStore?.id || db.stores?.[0]?.id || 'STR-01',
    selectedPurchaseId: '',
    supplierId: '',
    supplierOverride: false, // Flag to choose different supplier when returning against purchase
    reason: 'DAMAGED_IN_TRANSIT',
    notes: '',
    lines: [], // Return lines
  });

  // Autocomplete / Search state for Direct Product Mode
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [showProductSuggestions, setShowProductSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const searchInputRef = useRef(null);
  const suggestionsBoxRef = useRef(null);

  // Initialize new return form
  const initNewReturn = (mode = 'AGAINST_PURCHASE') => {
    setEditingReturnId(null);
    const nextDoc = PurchasePostingService.generateNextPurchaseReturnDocNumber(db);
    const defaultStoreId = activeStore?.id || db.stores?.[0]?.id || 'STR-01';
    const firstPurchase = (db.purchases || [])[0];

    const initialFormData = {
      docNumber: nextDoc,
      date: new Date().toISOString().split('T')[0],
      returnMode: mode,
      storeId: defaultStoreId,
      selectedPurchaseId: mode === 'AGAINST_PURCHASE' && firstPurchase ? firstPurchase.id : '',
      supplierId: mode === 'AGAINST_PURCHASE' && firstPurchase ? firstPurchase.supplierId : ((db.suppliers || [])[0]?.id || ''),
      supplierOverride: false,
      reason: 'DAMAGED_IN_TRANSIT',
      notes: '',
      lines: [],
    };

    if (mode === 'AGAINST_PURCHASE' && firstPurchase) {
      // Auto-load items from first purchase
      initialFormData.lines = (firstPurchase.lines || []).map((l, idx) => {
        const whId = firstPurchase.warehouseId || activeWarehouse?.id;
        const currentWhStock = StockService.getStockBalance(whId, l.productId);
        const alreadyReturned = Number(l.returnedQty || 0);
        const maxReturnable = Math.max(0, Number(l.qty || 0) - alreadyReturned);

        return {
          lineId: `RLINE-${idx + 1}-${Date.now()}`,
          productId: l.productId,
          name: l.name,
          sku: l.sku || '',
          uom: l.uom || 'PCS',
          batchNo: l.batchNo || '',
          expiryDate: l.expiryDate || '',
          purchasedQty: l.qty,
          alreadyReturned,
          maxReturnable,
          currentStock: currentWhStock,
          returnQty: 0,
          costPrice: Number(l.costPrice || l.rate || 0),
          taxRate: Number(l.taxRate || l.gstRate || 0),
          mrp: Number(l.mrp || 0),
          lineTotal: 0,
        };
      });
    }

    setFormData(initialFormData);
    setProductSearchQuery('');
    setActiveTab('new');
  };

  // Populate form for Editing
  const handleEditReturn = (ret) => {
    setEditingReturnId(ret.id);
    const storeId = ret.storeId || activeStore?.id || db.stores?.[0]?.id || 'STR-01';

    const mappedLines = (ret.lines || []).map((l, idx) => {
      const whId = ret.warehouseId || activeWarehouse?.id;
      const currentWhStock = StockService.getStockBalance(whId, l.productId);
      return {
        lineId: l.lineId || `RLINE-EDIT-${idx + 1}-${Date.now()}`,
        productId: l.productId,
        name: l.name || l.productName,
        sku: l.sku || '',
        uom: l.uom || 'PCS',
        batchNo: l.batchNo || '',
        expiryDate: l.expiryDate || '',
        purchasedQty: l.purchasedQty || l.returnQty,
        alreadyReturned: 0,
        maxReturnable: 9999, // In edit mode, old stock was already accounted for
        currentStock: currentWhStock,
        returnQty: Number(l.returnQty || l.qty || 0),
        costPrice: Number(l.costPrice || l.rate || 0),
        taxRate: Number(l.taxRate || l.gstRate || 0),
        mrp: Number(l.mrp || 0),
        lineTotal: Number(l.lineTotal || l.totalAmount || 0),
      };
    });

    setFormData({
      docNumber: ret.docNumber,
      date: (ret.date || new Date().toISOString()).split('T')[0],
      returnMode: ret.returnMode || (ret.originalPurchaseDocNumber ? 'AGAINST_PURCHASE' : 'DIRECT_PRODUCT'),
      storeId,
      selectedPurchaseId: ret.originalPurchaseId || ret.purchaseId || '',
      supplierId: ret.supplierId,
      supplierOverride: false,
      reason: ret.reason || 'DAMAGED_IN_TRANSIT',
      notes: ret.notes || '',
      lines: mappedLines,
    });

    setActiveTab('new');
  };

  // Switch Return Mode
  const handleModeChange = (newMode) => {
    if (newMode === formData.returnMode) return;
    initNewReturn(newMode);
  };

  // When selected purchase changes in AGAINST_PURCHASE mode
  const handlePurchaseSelect = (purchaseId) => {
    const pur = (db.purchases || []).find((p) => p.id === purchaseId);
    if (!pur) return;

    const purWhId = pur.warehouseId || activeWarehouse?.id;
    const mappedLines = (pur.lines || []).map((l, idx) => {
      const currentWhStock = StockService.getStockBalance(purWhId, l.productId);
      const alreadyReturned = Number(l.returnedQty || 0);
      const maxReturnable = Math.max(0, Number(l.qty || 0) - alreadyReturned);

      return {
        lineId: `RLINE-${idx + 1}-${Date.now()}`,
        productId: l.productId,
        name: l.name,
        sku: l.sku || '',
        uom: l.uom || 'PCS',
        batchNo: l.batchNo || '',
        expiryDate: l.expiryDate || '',
        purchasedQty: l.qty,
        alreadyReturned,
        maxReturnable,
        currentStock: currentWhStock,
        returnQty: 0,
        costPrice: Number(l.costPrice || l.rate || 0),
        taxRate: Number(l.taxRate || l.gstRate || 0),
        mrp: Number(l.mrp || 0),
        lineTotal: 0,
      };
    });

    setFormData((prev) => ({
      ...prev,
      selectedPurchaseId: pur.id,
      supplierId: prev.supplierOverride ? prev.supplierId : pur.supplierId,
      storeId: pur.storeId || prev.storeId,
      lines: mappedLines,
    }));
  };

  // Direct Product Mode: Autocomplete Search Suggestions
  const productSuggestions = useMemo(() => {
    const q = productSearchQuery.trim().toLowerCase();
    if (!q || formData.returnMode !== 'DIRECT_PRODUCT') return [];

    return (db.products || [])
      .filter((p) => {
        const nameMatch = (p.name || '').toLowerCase().includes(q);
        const skuMatch = (p.sku || '').toLowerCase().includes(q);
        const barcodeMatch = (p.barcode || '').toLowerCase().includes(q);
        return nameMatch || skuMatch || barcodeMatch;
      })
      .slice(0, 10);
  }, [productSearchQuery, formData.returnMode, db.products]);

  // Direct Product Mode: Add Product Line
  const addProductToDirectLines = (product) => {
    const currentWh = (db.warehouses || []).find((w) => w.storeId === formData.storeId) || db.warehouses?.[0];
    const currentWhStock = StockService.getStockBalance(currentWh?.id, product.id);
    let costRate = Number(product.costRate || 0);
    if (costRate <= 0) {
      const purchases = [...(db.purchases || [])].reverse();
      for (const p of purchases) {
        const line = (p.lines || p.items || []).find((l) => (l.productId === product.id || l.id === product.id) && Number(l.costPrice || l.rate) > 0);
        if (line) {
          costRate = Number(line.costPrice || line.rate);
          break;
        }
      }
      if (costRate <= 0) {
        const stock = (db.stockBalances || []).find((b) => b.productId === product.id && Number(b.valuationRate) > 0);
        if (stock) costRate = Number(stock.valuationRate);
      }
    }
    const taxRate = Number(product.taxRate || product.gstRate || 0);
    const lineTotal = Number((costRate * (1 + taxRate / 100)).toFixed(2));

    const newLine = {
      lineId: `DRLINE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      productId: product.id,
      name: product.name,
      sku: product.sku || '',
      uom: product.uom || product.unit || 'PCS',
      batchNo: '',
      expiryDate: '',
      purchasedQty: currentWhStock,
      alreadyReturned: 0,
      maxReturnable: currentWhStock,
      currentStock: currentWhStock,
      returnQty: 1,
      costPrice: costRate,
      taxRate,
      mrp: Number(product.mrp || 0),
      lineTotal,
    };

    setFormData((prev) => ({
      ...prev,
      lines: [...prev.lines, newLine],
    }));

    setProductSearchQuery('');
    setShowProductSuggestions(false);
  };

  // Update line field
  const updateLine = (index, field, value) => {
    setFormData((prev) => {
      const nextLines = [...prev.lines];
      const target = { ...nextLines[index], [field]: value };

      const qty = Number(target.returnQty || 0);
      const cost = Number(target.costPrice || 0);
      const taxRate = Number(target.taxRate || 0);
      const taxable = qty * cost;
      const taxAmt = (taxable * taxRate) / 100;
      target.lineTotal = Number((taxable + taxAmt).toFixed(2));

      nextLines[index] = target;
      return { ...prev, lines: nextLines };
    });
  };

  // Remove a line (direct product mode)
  const removeLine = (index) => {
    setFormData((prev) => ({
      ...prev,
      lines: prev.lines.filter((_, idx) => idx !== index),
    }));
  };

  // Resolve current active store & supplier
  const currentStore = useMemo(() => {
    return (db.stores || []).find((s) => s.id === formData.storeId) || db.stores?.[0] || {};
  }, [formData.storeId, db.stores]);

  const currentSupplier = useMemo(() => {
    return (db.suppliers || []).find((s) => s.id === formData.supplierId) || {};
  }, [formData.supplierId, db.suppliers]);

  // Determine interstate tax
  const isInterstate = useMemo(() => {
    return (
      (currentSupplier.stateCode && currentStore.stateCode && currentSupplier.stateCode !== currentStore.stateCode) ||
      currentSupplier.supplyType === 'INTERSTATE'
    );
  }, [currentSupplier, currentStore]);

  // Calculated totals
  const returnTotals = useMemo(() => {
    let subtotal = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;
    let totalQty = 0;

    (formData.lines || []).forEach((l) => {
      const qty = Number(l.returnQty || 0);
      if (qty <= 0) return;
      const cost = Number(l.costPrice || 0);
      const taxRate = Number(l.taxRate || 0);
      const taxable = qty * cost;

      let cgst = 0, sgst = 0, igst = 0;
      if (isInterstate) {
        igst = (taxable * taxRate) / 100;
      } else {
        cgst = (taxable * (taxRate / 2)) / 100;
        sgst = (taxable * (taxRate / 2)) / 100;
      }

      subtotal += taxable;
      cgstTotal += cgst;
      sgstTotal += sgst;
      igstTotal += igst;
      totalQty += qty;
    });

    const totalTax = Number((cgstTotal + sgstTotal + igstTotal).toFixed(2));
    const unrounded = subtotal + totalTax;
    const grandTotal = Math.round(unrounded);
    const roundOff = Number((grandTotal - unrounded).toFixed(2));

    return {
      subtotal: Number(subtotal.toFixed(2)),
      cgstTotal: Number(cgstTotal.toFixed(2)),
      sgstTotal: Number(sgstTotal.toFixed(2)),
      igstTotal: Number(igstTotal.toFixed(2)),
      totalTax,
      roundOff,
      grandTotal,
      totalQty,
      amountInWords: numberToWords(grandTotal),
    };
  }, [formData.lines, isInterstate]);

  // Save / Post Purchase Return
  const handleSubmitReturn = (e) => {
    e.preventDefault();

    if (!formData.supplierId) {
      notify('error', 'Please choose a Supplier for this return.', 'Missing Supplier');
      return;
    }

    const activeLines = (formData.lines || []).filter((l) => Number(l.returnQty) > 0);
    if (activeLines.length === 0) {
      notify('error', 'Please enter a return quantity greater than zero for at least one item.', 'No Items to Return');
      return;
    }

    // Validate quantities against warehouse stock
    const wh = (db.warehouses || []).find((w) => w.storeId === formData.storeId) || db.warehouses?.[0];
    for (const l of activeLines) {
      const whStock = StockService.getStockBalance(wh?.id, l.productId);
      if (editingReturnId) {
        // In edit mode, check is handled by service after reverting old return
      } else if (Number(l.returnQty) > whStock) {
        notify(
          'error',
          `Insufficient stock in warehouse for "${l.name}". Available: ${whStock}, Return requested: ${l.returnQty}.`,
          'Insufficient Stock'
        );
        return;
      }

      if (formData.returnMode === 'AGAINST_PURCHASE' && !editingReturnId) {
        if (Number(l.returnQty) > Number(l.maxReturnable)) {
          notify(
            'error',
            `Return quantity for "${l.name}" exceeds remaining returnable quantity (${l.maxReturnable}).`,
            'Excess Return Blocked'
          );
          return;
        }
      }
    }

    try {
      const payload = {
        returnMode: formData.returnMode,
        purchaseId: formData.returnMode === 'AGAINST_PURCHASE' ? formData.selectedPurchaseId : null,
        supplierId: formData.supplierId,
        storeId: formData.storeId,
        warehouseId: wh?.id,
        items: activeLines.map((l) => ({
          productId: l.productId,
          name: l.name,
          sku: l.sku,
          uom: l.uom,
          batchNo: l.batchNo,
          expiryDate: l.expiryDate,
          returnQty: Number(l.returnQty),
          costPrice: Number(l.costPrice),
          taxRate: Number(l.taxRate),
          mrp: Number(l.mrp),
        })),
        reason: formData.reason,
        notes: formData.notes,
        date: formData.date,
        docNumber: formData.docNumber,
        userId: currentUser?.id || 'USR-ADMIN',
      };

      let res;
      if (editingReturnId) {
        res = PurchasePostingService.updatePurchaseReturn(editingReturnId, payload);
        notify('success', res.message, 'Purchase Return Updated');
      } else {
        res = PurchasePostingService.postPurchaseReturn(payload);
        notify('success', res.message, 'Purchase Return Posted');
      }

      triggerRefresh();
      setActiveTab('list');
      setEditingReturnId(null);
    } catch (err) {
      notify('error', err.message, 'Return Posting Failed');
    }
  };

  // Delete Purchase Return Handler
  const handleConfirmDelete = () => {
    if (!deletingReturn) return;
    try {
      const res = PurchasePostingService.deletePurchaseReturn(deletingReturn.id, currentUser?.id || 'USR-ADMIN');
      notify('success', res.message, 'Return Deleted & Stock Restored');
      triggerRefresh();
      setDeletingReturn(null);
    } catch (err) {
      notify('error', err.message, 'Delete Failed');
    }
  };

  // Filtered list of purchase returns
  const filteredReturns = useMemo(() => {
    let list = [...(db.purchaseReturns || [])];
    const q = searchQuery.toLowerCase().trim();

    if (q) {
      list = list.filter((r) => {
        const docMatch = (r.docNumber || '').toLowerCase().includes(q);
        const suppMatch = (r.supplierName || '').toLowerCase().includes(q);
        const purMatch = (r.originalPurchaseDocNumber || r.purchaseDocNumber || '').toLowerCase().includes(q);
        const prodMatch = (r.lines || []).some((l) => (l.name || l.productName || '').toLowerCase().includes(q));
        return docMatch || suppMatch || purMatch || prodMatch;
      });
    }

    if (modeFilter !== 'ALL') {
      list = list.filter((r) => r.returnMode === modeFilter);
    }

    if (supplierFilter !== 'ALL') {
      list = list.filter((r) => r.supplierId === supplierFilter);
    }

    return list;
  }, [db.purchaseReturns, searchQuery, modeFilter, supplierFilter]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
      {/* ========================================================================= */}
      {/* TOP HEADER & NAVIGATION TABS                                              */}
      {/* ========================================================================= */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-3 rounded-xl shadow-md">
        <div className="flex items-center gap-2">
          <RotateCcw className="w-5 h-5 text-amber-400" />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white text-sm">Purchase Returns & Supplier Debit Notes</h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                Common Stock Sync
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Return items against original purchase receipts or direct product returns to any supplier with instant inventory reduction.
            </p>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => {
                setActiveTab('list');
                setEditingReturnId(null);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'list' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>All Returns ({db.purchaseReturns?.length || 0})</span>
            </button>

            <button
              onClick={() => initNewReturn('AGAINST_PURCHASE')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'new' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>{editingReturnId ? 'Edit Return Voucher' : 'New Purchase Return'}</span>
            </button>
          </div>

          {activeTab === 'list' && (
            <ExportButtons
              data={filteredReturns.map((pr, idx) => ({
                '#': idx + 1,
                'Return Doc #': pr.docNumber,
                'Date': new Date(pr.date || pr.postedAt).toLocaleDateString(),
                'Return Type': pr.returnMode === 'DIRECT_PRODUCT' ? 'Direct Product Return' : 'Against Inward Purchase',
                'Original Purchase #': pr.originalPurchaseDocNumber || pr.purchaseDocNumber || '—',
                'Supplier Name': pr.supplierName,
                'Branch': pr.branchName || pr.storeName || 'Main Store',
                'Items Count': pr.lines?.length || 1,
                'Debit Amount': `₹${Number(pr.totalDebitAmount || pr.totalCreditAmount || pr.grandTotal || 0).toFixed(2)}`,
                'Reason': pr.reason,
              }))}
              filename="PURCHASE_RETURNS_REGISTER"
              title="PURCHASE RETURNS & SUPPLIER DEBIT NOTES REGISTER"
              pdfOrientation="landscape"
            />
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. RETURNS LIST REGISTER VIEW                                             */}
      {/* ========================================================================= */}
      {activeTab === 'list' && (
        <div className="space-y-3">
          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-900 border border-slate-800 p-3 rounded-xl text-xs">
            <div className="sm:col-span-2 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search return #, original purchase #, supplier, or product..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <select
                value={modeFilter}
                onChange={(e) => setModeFilter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-indigo-500"
              >
                <option value="ALL">All Return Types</option>
                <option value="AGAINST_PURCHASE">Against Inward Purchase</option>
                <option value="DIRECT_PRODUCT">Direct Product Return</option>
              </select>
            </div>

            <div>
              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-indigo-500"
              >
                <option value="ALL">All Suppliers</option>
                {(db.suppliers || []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Return Doc #</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Mode & Ref</th>
                    <th className="py-2.5 px-3">Supplier Name</th>
                    <th className="py-2.5 px-3">Branch</th>
                    <th className="py-2.5 px-2 text-center">Items</th>
                    <th className="py-2.5 px-3 text-right">Debit Total (₹)</th>
                    <th className="py-2.5 px-3">Reason</th>
                    <th className="py-2.5 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {filteredReturns.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="py-10 text-center text-slate-500 text-xs">
                        No purchase return vouchers found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredReturns.map((r) => {
                      const isAgainstPurchase = Boolean(r.originalPurchaseDocNumber || r.purchaseDocNumber || r.returnMode === 'AGAINST_PURCHASE');
                      const purchaseRef = r.originalPurchaseDocNumber || r.purchaseDocNumber;
                      const debitAmount = Number(r.totalDebitAmount ?? r.grandTotal ?? r.totalCreditAmount ?? 0);

                      return (
                        <tr key={r.id} className="hover:bg-slate-800/40 transition">
                          <td className="py-2.5 px-3 font-mono font-bold text-amber-300 whitespace-nowrap">
                            {r.docNumber}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 text-[11px] whitespace-nowrap">
                            {new Date(r.date || r.postedAt).toLocaleDateString()}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {isAgainstPurchase ? (
                              <div className="flex items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-700">
                                  Invoice Return
                                </span>
                                {purchaseRef && (
                                  <span className="font-mono text-xs text-indigo-400 font-semibold">{purchaseRef}</span>
                                )}
                              </div>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700">
                                Direct Product Return
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-200">
                            {r.supplierName}
                          </td>
                          <td className="py-2.5 px-3 text-slate-300 text-[11px] whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-medium">
                              {r.branchName || r.storeName || 'Main Store'}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-center font-bold text-slate-200">
                            {r.lines?.length || 1}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-400 whitespace-nowrap">
                            ₹{debitAmount.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 text-[11px] max-w-[160px] truncate" title={r.reason}>
                            {r.reason || 'Supplier return'}
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              {/* VIEW */}
                              <button
                                onClick={() => setViewingReturn(r)}
                                title="View Return Details"
                                className="p-1 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded transition cursor-pointer"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              {/* EDIT */}
                              <button
                                onClick={() => handleEditReturn(r)}
                                title="Edit Purchase Return"
                                className="p-1 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded transition cursor-pointer"
                              >
                                <Edit className="w-4 h-4" />
                              </button>

                              {/* PRINT */}
                              <button
                                onClick={() => setPrintingReturn(r)}
                                title="Print A4 Debit Note / Purchase Return"
                                className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded transition cursor-pointer"
                              >
                                <Printer className="w-4 h-4" />
                              </button>

                              {/* DELETE */}
                              <button
                                onClick={() => setDeletingReturn(r)}
                                title="Delete Return & Restore Stock"
                                className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
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

      {/* ========================================================================= */}
      {/* 2. NEW / EDIT PURCHASE RETURN FORM VIEW                                   */}
      {/* ========================================================================= */}
      {activeTab === 'new' && (
        <form onSubmit={handleSubmitReturn} className="space-y-4">
          {/* Top Form Banner */}
          <div className="flex flex-wrap items-center justify-between bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-md gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-700 font-mono">
                  {editingReturnId ? 'UPDATE DEBIT NOTE' : 'NEW PURCHASE RETURN'}
                </span>
                <h3 className="font-bold text-white text-base">
                  {editingReturnId ? `Editing Return: ${formData.docNumber}` : 'Issue Supplier Purchase Return / Debit Note'}
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Returned quantities automatically reduce stock from the selected branch in the central inventory balance table.
              </p>
            </div>

            {/* Mode Toggle Switch */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => handleModeChange('AGAINST_PURCHASE')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  formData.returnMode === 'AGAINST_PURCHASE'
                    ? 'bg-amber-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Against Inward Purchase</span>
              </button>

              <button
                type="button"
                onClick={() => handleModeChange('DIRECT_PRODUCT')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  formData.returnMode === 'DIRECT_PRODUCT'
                    ? 'bg-amber-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>Direct Product Return (Any Supplier)</span>
              </button>
            </div>
          </div>

          {/* Header Cards (2 Columns) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card 1: Return Voucher Details */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <FileText className="w-4 h-4 text-amber-400" />
                <h4 className="font-bold text-white text-xs uppercase tracking-wider">Return Voucher Details</h4>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">Return Doc #</label>
                  <input
                    type="text"
                    readOnly
                    value={formData.docNumber}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 font-mono font-bold text-amber-300 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">Return Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Source Branch (Warehouse) *</label>
                <div className="relative">
                  <Store className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <select
                    value={formData.storeId}
                    onChange={(e) => setFormData({ ...formData, storeId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-slate-100 font-semibold focus:border-amber-500 text-xs"
                  >
                    {(db.stores || []).map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name} ({st.code || st.id}) — {st.city || st.state || 'Main Branch'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Card 2: Supplier & Purchase Reference */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-amber-400" />
                  <h4 className="font-bold text-white text-xs uppercase tracking-wider">
                    {formData.returnMode === 'AGAINST_PURCHASE' ? 'Inward Invoice & Supplier' : 'Supplier Selection'}
                  </h4>
                </div>

                {formData.returnMode === 'AGAINST_PURCHASE' && (
                  <label className="flex items-center gap-1.5 text-[11px] text-amber-300 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.supplierOverride}
                      onChange={(e) => setFormData({ ...formData, supplierOverride: e.target.checked })}
                      className="rounded border-slate-700 text-amber-500 focus:ring-amber-400"
                    />
                    <span>Return to Different Supplier</span>
                  </label>
                )}
              </div>

              {formData.returnMode === 'AGAINST_PURCHASE' && (
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">Select Inward Purchase Invoice *</label>
                  <select
                    value={formData.selectedPurchaseId}
                    onChange={(e) => handlePurchaseSelect(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono text-xs focus:border-amber-500"
                  >
                    <option value="">-- Choose Inward Purchase Receipt --</option>
                    {(db.purchases || []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.docNumber} — {p.supplierName} (₹{Number(p.netAmount || p.grandTotal || 0).toFixed(2)}) [{new Date(p.date).toLocaleDateString()}]
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                  Supplier (Party to Debit) *
                </label>
                <select
                  disabled={formData.returnMode === 'AGAINST_PURCHASE' && !formData.supplierOverride}
                  value={formData.supplierId}
                  onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                  className={`w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-semibold text-xs focus:border-amber-500 ${
                    formData.returnMode === 'AGAINST_PURCHASE' && !formData.supplierOverride ? 'opacity-80 cursor-not-allowed' : ''
                  }`}
                >
                  <option value="">-- Select Supplier --</option>
                  {(db.suppliers || []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.gstin ? `(${s.gstin})` : ''} - {s.state || 'Local'}
                    </option>
                  ))}
                </select>
                {currentSupplier.gstin && (
                  <p className="text-[10px] text-slate-400 mt-1">
                    GSTIN: <span className="font-mono text-indigo-400 font-bold">{currentSupplier.gstin}</span> • State: {currentSupplier.state} ({isInterstate ? 'Interstate IGST' : 'Local CGST+SGST'})
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* PRODUCT SEARCH & QUICK-ADD (For Direct Product Return Mode)               */}
          {/* ========================================================================= */}
          {formData.returnMode === 'DIRECT_PRODUCT' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-md space-y-2 relative">
              <div className="flex items-center gap-2">
                <Barcode className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Product Inventory Search & Add
                </span>
                <span className="text-[10px] text-slate-400">
                  (Search by name, SKU, or barcode to add items to debit note)
                </span>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Type product name, barcode, or SKU..."
                  value={productSearchQuery}
                  onChange={(e) => {
                    setProductSearchQuery(e.target.value);
                    setShowProductSuggestions(true);
                  }}
                  onFocus={() => setShowProductSuggestions(true)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />

                {/* Suggestions Dropdown */}
                {showProductSuggestions && productSuggestions.length > 0 && (
                  <div
                    ref={suggestionsBoxRef}
                    className="absolute left-0 right-0 top-full mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto divide-y divide-slate-800 text-xs"
                  >
                    {productSuggestions.map((prod, idx) => {
                      const wh = (db.warehouses || []).find((w) => w.storeId === formData.storeId) || db.warehouses?.[0];
                      const stockBal = StockService.getStockBalance(wh?.id, prod.id);

                      return (
                        <div
                          key={prod.id}
                          onClick={() => addProductToDirectLines(prod)}
                          className="p-2.5 hover:bg-slate-800 cursor-pointer flex items-center justify-between transition"
                        >
                          <div>
                            <div className="font-semibold text-slate-100">{prod.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              SKU: {prod.sku || '—'} • HSN: {prod.hsnCode || '—'} • Rate: ₹{prod.costRate}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              stockBal > 0 ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'
                            }`}>
                              Stock: {stockBal} {prod.uom || 'PCS'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* RETURN ITEMS GRID                                                         */}
          {/* ========================================================================= */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md">
            <div className="px-4 py-3 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-amber-400" />
                <h4 className="font-bold text-white text-xs uppercase tracking-wider">
                  {formData.returnMode === 'AGAINST_PURCHASE' ? 'Inward Items Eligible for Return' : 'Return Line Items'}
                </h4>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {formData.lines.filter((l) => Number(l.returnQty) > 0).length} of {formData.lines.length} items marked for return
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3 text-center">#</th>
                    <th className="py-2.5 px-3">Product Description</th>
                    {formData.returnMode === 'AGAINST_PURCHASE' && (
                      <>
                        <th className="py-2.5 px-2 text-center">Inward Qty</th>
                        <th className="py-2.5 px-2 text-center">Prev Returned</th>
                        <th className="py-2.5 px-2 text-center text-amber-400">Max Returnable</th>
                      </>
                    )}
                    <th className="py-2.5 px-2 text-center text-slate-300">Warehouse Stock</th>
                    <th className="py-2.5 px-3 text-center text-rose-400 font-bold w-28">Return Qty *</th>
                    <th className="py-2.5 px-3 text-right w-24">Rate (₹)</th>
                    <th className="py-2.5 px-2 text-center w-20">GST %</th>
                    <th className="py-2.5 px-3 text-right">Line Total (₹)</th>
                    {formData.returnMode === 'DIRECT_PRODUCT' && (
                      <th className="py-2.5 px-2 text-center w-12">Action</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {formData.lines.length === 0 ? (
                    <tr>
                      <td
                        colSpan={formData.returnMode === 'AGAINST_PURCHASE' ? 9 : 7}
                        className="py-10 text-center text-slate-500 text-xs"
                      >
                        {formData.returnMode === 'AGAINST_PURCHASE'
                          ? 'Please select an inward purchase above to load eligible items.'
                          : 'No products added yet. Use the search bar above to add products to return.'}
                      </td>
                    </tr>
                  ) : (
                    formData.lines.map((l, idx) => {
                      const isReturning = Number(l.returnQty) > 0;
                      return (
                        <tr
                          key={l.lineId || idx}
                          className={`transition ${isReturning ? 'bg-amber-950/20' : 'hover:bg-slate-800/40'}`}
                        >
                          <td className="py-2.5 px-3 text-center text-slate-500 font-mono text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-100">{l.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              SKU: {l.sku || '—'} {l.batchNo ? `• Batch: ${l.batchNo}` : ''}
                            </div>
                          </td>
                          {formData.returnMode === 'AGAINST_PURCHASE' && (
                            <>
                              <td className="py-2.5 px-2 text-center font-mono text-slate-300">
                                {l.purchasedQty}
                              </td>
                              <td className="py-2.5 px-2 text-center font-mono text-slate-400">
                                {l.alreadyReturned || 0}
                              </td>
                              <td className="py-2.5 px-2 text-center font-mono font-bold text-amber-400">
                                {l.maxReturnable}
                              </td>
                            </>
                          )}
                          <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-300">
                            {l.currentStock}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="number"
                              min="0"
                              max={formData.returnMode === 'AGAINST_PURCHASE' ? l.maxReturnable : l.currentStock}
                              value={l.returnQty}
                              onChange={(e) => updateLine(idx, 'returnQty', Math.max(0, Number(e.target.value)))}
                              className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-center font-bold text-rose-400 focus:border-amber-500 font-mono"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={l.costPrice}
                              onChange={(e) => updateLine(idx, 'costPrice', Math.max(0, Number(e.target.value)))}
                              className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-right font-mono text-slate-200"
                            />
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono text-slate-300">
                            {l.taxRate}%
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-100">
                            ₹{l.lineTotal.toFixed(2)}
                          </td>
                          {formData.returnMode === 'DIRECT_PRODUCT' && (
                            <td className="py-2.5 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => removeLine(idx)}
                                title="Remove line"
                                className="p-1 text-slate-500 hover:text-rose-400 rounded transition"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* REASON, NOTES & FINANCIAL TOTALS BREAKDOWN                                 */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Reason & Notes (2 Cols) */}
            <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <h4 className="font-bold text-white text-xs uppercase tracking-wider border-b border-slate-800 pb-2">
                Return Reason & Authorization
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">Return Reason *</label>
                  <select
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-amber-500 text-xs"
                  >
                    <option value="DAMAGED_IN_TRANSIT">Damaged In Transit / Broken</option>
                    <option value="EXPIRED_STOCK">Near Expiry / Expired Batch</option>
                    <option value="QUALITY_DEFECT">Substandard / Defective Quality</option>
                    <option value="OVER_SHIPMENT">Excess Shipment / Wrong Item Sent</option>
                    <option value="VENDOR_RECALL">Supplier Batch Recall</option>
                    <option value="COMMERCIAL_RETURN">Commercial Negotiation / Unsold Return</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">Debit Note Remark / Reference</label>
                  <input
                    type="text"
                    placeholder="e.g. RMA #, Transporter LR #, Quality memo..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* Financial Totals Card (1 Col) */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2 text-xs">
              <h4 className="font-bold text-white text-xs uppercase tracking-wider border-b border-slate-800 pb-2">
                Debit Note Valuation
              </h4>

              <div className="space-y-1.5 text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Returned Qty:</span>
                  <span className="font-bold text-amber-300 font-mono">{returnTotals.totalQty}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Taxable Subtotal:</span>
                  <span className="font-mono">₹{returnTotals.subtotal.toFixed(2)}</span>
                </div>
                {isInterstate ? (
                  <div className="flex justify-between">
                    <span className="text-slate-400">IGST:</span>
                    <span className="font-mono">₹{returnTotals.igstTotal.toFixed(2)}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-400">CGST:</span>
                      <span className="font-mono">₹{returnTotals.cgstTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">SGST:</span>
                      <span className="font-mono">₹{returnTotals.sgstTotal.toFixed(2)}</span>
                    </div>
                  </>
                )}
                {returnTotals.roundOff !== 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Round Off:</span>
                    <span className="font-mono">{returnTotals.roundOff > 0 ? `+₹${returnTotals.roundOff.toFixed(2)}` : `-₹${Math.abs(returnTotals.roundOff).toFixed(2)}`}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold text-rose-400 pt-2 border-t border-slate-800">
                  <span>Grand Total Debit:</span>
                  <span className="font-mono">₹{returnTotals.grandTotal.toFixed(2)}</span>
                </div>
                <p className="text-[10px] text-slate-400 italic pt-1 border-t border-slate-800/60">
                  {returnTotals.amountInWords}
                </p>
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('list');
                    setEditingReturnId(null);
                  }}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg text-xs cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg text-xs shadow-md shadow-amber-600/30 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{editingReturnId ? 'Update Return' : 'Post Return'}</span>
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: VIEW RETURN DETAILS MODAL                                        */}
      {/* ========================================================================= */}
      {viewingReturn && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-700 font-mono">
                  SUPPLIER DEBIT NOTE
                </span>
                <h3 className="font-bold text-white text-base">{viewingReturn.docNumber}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setPrintingReturn(viewingReturn);
                    setViewingReturn(null);
                  }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Print Voucher</span>
                </button>
                <button onClick={() => setViewingReturn(null)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
              <div>
                <span className="text-slate-500 text-[10px] uppercase font-bold block">Supplier</span>
                <span className="font-semibold text-slate-100">{viewingReturn.supplierName}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] uppercase font-bold block">Return Date</span>
                <span className="text-slate-200">{new Date(viewingReturn.date || viewingReturn.postedAt).toLocaleDateString()}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] uppercase font-bold block">Branch</span>
                <span className="text-slate-200">{viewingReturn.branchName || viewingReturn.storeName || 'Main Store'}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] uppercase font-bold block">Original Invoice</span>
                <span className="font-mono text-indigo-400 font-bold">{viewingReturn.originalPurchaseDocNumber || viewingReturn.purchaseDocNumber || 'Direct Product'}</span>
              </div>
            </div>

            {/* Lines Table */}
            <div className="border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase border-b border-slate-800">
                  <tr>
                    <th className="py-2 px-3">Item</th>
                    <th className="py-2 px-2 text-center">Qty</th>
                    <th className="py-2 px-3 text-right">Rate (₹)</th>
                    <th className="py-2 px-2 text-center">GST %</th>
                    <th className="py-2 px-3 text-right">Total (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {(viewingReturn.lines || []).map((l, idx) => (
                    <tr key={idx}>
                      <td className="py-2 px-3">
                        <span className="font-semibold text-slate-200 block">{l.name || l.productName}</span>
                        <span className="text-[10px] text-slate-500 font-mono">SKU: {l.sku || '—'}</span>
                      </td>
                      <td className="py-2 px-2 text-center font-bold text-rose-400 font-mono">{l.returnQty || l.qty}</td>
                      <td className="py-2 px-3 text-right font-mono">₹{Number(l.costPrice || l.rate || 0).toFixed(2)}</td>
                      <td className="py-2 px-2 text-center font-mono">{l.taxRate || 0}%</td>
                      <td className="py-2 px-3 text-right font-bold text-slate-100 font-mono">₹{Number(l.lineTotal || l.totalAmount || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
              <div className="text-slate-400">
                <span className="font-bold text-slate-300">Reason:</span> {viewingReturn.reason || 'Supplier Return'}
                {viewingReturn.notes && <span className="block text-[11px] text-slate-500 mt-0.5">Note: {viewingReturn.notes}</span>}
              </div>
              <div className="text-right">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Total Debit Value</span>
                <span className="text-base font-bold text-rose-400 font-mono">
                  ₹{Number(viewingReturn.totalDebitAmount ?? viewingReturn.grandTotal ?? viewingReturn.totalCreditAmount ?? 0).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: A4 PRINTABLE DEBIT NOTE VOUCHER                                  */}
      {/* ========================================================================= */}
      {printingReturn && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 print:hidden">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Printer className="w-4 h-4 text-emerald-400" />
                <span>Printable A4 Debit Note / Purchase Return Voucher</span>
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Document</span>
                </button>
                <button onClick={() => setPrintingReturn(null)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* A4 Printable Sheet */}
            <div className="bg-white text-slate-900 p-8 rounded-xl shadow-lg font-sans text-xs space-y-4 print:p-0 print:shadow-none">
              {/* Header */}
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
                <div>
                  <h1 className="text-xl font-black text-slate-900 tracking-tight">
                    {activeCompany?.name || 'NEXBILL ENTERPRISES'}
                  </h1>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    {activeStore?.address || 'Main Commercial Boulevard'}, {activeStore?.city || 'Mumbai'}, {activeStore?.state || 'Maharashtra'}
                  </p>
                  <p className="text-[11px] text-slate-600">
                    GSTIN: <span className="font-mono font-bold">{activeCompany?.gstin || activeStore?.gstin || '27AABCN8891P1ZV'}</span> • Phone: {activeStore?.phone || '+91 98765 43210'}
                  </p>
                </div>

                <div className="text-right">
                  <span className="inline-block px-3 py-1 bg-slate-900 text-white font-bold text-xs uppercase tracking-wider rounded">
                    DEBIT NOTE / PURCHASE RETURN
                  </span>
                  <div className="mt-2 text-[11px] space-y-0.5">
                    <div><span className="text-slate-500 font-semibold">Debit Note #: </span><span className="font-mono font-bold">{printingReturn.docNumber}</span></div>
                    <div><span className="text-slate-500 font-semibold">Date: </span><span>{new Date(printingReturn.date || printingReturn.postedAt).toLocaleDateString()}</span></div>
                    {printingReturn.originalPurchaseDocNumber && (
                      <div><span className="text-slate-500 font-semibold">Against Invoice: </span><span className="font-mono font-bold text-indigo-700">{printingReturn.originalPurchaseDocNumber}</span></div>
                    )}
                  </div>
                </div>
              </div>

              {/* Parties Block */}
              <div className="grid grid-cols-2 gap-4 border border-slate-300 p-3 rounded-lg bg-slate-50 text-[11px]">
                <div>
                  <span className="font-bold text-slate-800 uppercase block mb-1">Debited Supplier (Party)</span>
                  <div className="font-bold text-sm text-slate-900">{printingReturn.supplierName}</div>
                  <div className="text-slate-600 mt-0.5">
                    GSTIN: <span className="font-mono font-bold">{printingReturn.supplierGstin || 'Unregistered / Not Provided'}</span>
                  </div>
                </div>

                <div>
                  <span className="font-bold text-slate-800 uppercase block mb-1">Dispatching Branch</span>
                  <div className="font-bold text-slate-900">{printingReturn.branchName || printingReturn.storeName || 'Main Store'}</div>
                  <div className="text-slate-600">Return Reason: <span className="font-semibold text-slate-900">{printingReturn.reason}</span></div>
                  {printingReturn.notes && <div className="text-slate-500 italic mt-0.5">Remarks: {printingReturn.notes}</div>}
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full text-left text-xs border border-slate-300 border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b border-slate-300">
                  <tr>
                    <th className="p-2 border-r border-slate-300 text-center w-8">#</th>
                    <th className="p-2 border-r border-slate-300">Item Description</th>
                    <th className="p-2 border-r border-slate-300 text-center w-16">UOM</th>
                    <th className="p-2 border-r border-slate-300 text-center w-16">Qty</th>
                    <th className="p-2 border-r border-slate-300 text-right w-24">Unit Rate (₹)</th>
                    <th className="p-2 border-r border-slate-300 text-center w-16">GST %</th>
                    <th className="p-2 text-right w-28">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {(printingReturn.lines || []).map((l, idx) => (
                    <tr key={idx}>
                      <td className="p-2 border-r border-slate-300 text-center font-mono text-[11px]">{idx + 1}</td>
                      <td className="p-2 border-r border-slate-300">
                        <span className="font-semibold text-slate-900 block">{l.name || l.productName}</span>
                        <span className="text-[10px] text-slate-500 font-mono">SKU: {l.sku || '—'} {l.batchNo ? `| Batch: ${l.batchNo}` : ''}</span>
                      </td>
                      <td className="p-2 border-r border-slate-300 text-center">{l.uom || 'PCS'}</td>
                      <td className="p-2 border-r border-slate-300 text-center font-bold font-mono text-rose-700">-{l.returnQty || l.qty}</td>
                      <td className="p-2 border-r border-slate-300 text-right font-mono">₹{Number(l.costPrice || l.rate || 0).toFixed(2)}</td>
                      <td className="p-2 border-r border-slate-300 text-center font-mono">{l.taxRate || 0}%</td>
                      <td className="p-2 text-right font-bold font-mono">₹{Number(l.lineTotal || l.totalAmount || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals & Signatures */}
              <div className="grid grid-cols-2 gap-6 pt-2">
                <div className="text-[11px] space-y-2">
                  <div>
                    <span className="font-bold text-slate-700 block">Amount in Words:</span>
                    <span className="italic font-semibold text-slate-900">
                      {printingReturn.amountInWords || numberToWords(printingReturn.totalDebitAmount || printingReturn.grandTotal || 0)}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 pt-2">
                    * This is a computer-generated debit note voucher. Returned merchandise has been debited against the vendor ledger account and adjusted from inventory.
                  </p>
                </div>

                <div className="space-y-1 text-xs text-slate-800">
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span>Taxable Subtotal:</span>
                    <span className="font-mono font-semibold">₹{Number(printingReturn.subtotal || 0).toFixed(2)}</span>
                  </div>
                  {printingReturn.igstTotal > 0 ? (
                    <div className="flex justify-between py-1 border-b border-slate-200">
                      <span>Integrated GST (IGST):</span>
                      <span className="font-mono font-semibold">₹{Number(printingReturn.igstTotal).toFixed(2)}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between py-1 border-b border-slate-200">
                        <span>Central GST (CGST):</span>
                        <span className="font-mono font-semibold">₹{Number(printingReturn.cgstTotal || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-200">
                        <span>State GST (SGST):</span>
                        <span className="font-mono font-semibold">₹{Number(printingReturn.sgstTotal || 0).toFixed(2)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between py-1.5 text-sm font-bold text-slate-900 border-t-2 border-slate-900">
                    <span>Net Debit Value:</span>
                    <span className="font-mono">
                      ₹{Number(printingReturn.totalDebitAmount ?? printingReturn.grandTotal ?? printingReturn.totalCreditAmount ?? 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-8 pt-10 text-[11px] text-center">
                <div className="border-t border-slate-400 pt-1">
                  <span className="font-semibold text-slate-700">Vendor / Transporter Acknowledgment</span>
                </div>
                <div className="border-t border-slate-400 pt-1">
                  <span className="font-semibold text-slate-700">For {activeCompany?.name || 'NexBill ERP'} (Authorized Signatory)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: DELETE CONFIRMATION MODAL                                        */}
      {/* ========================================================================= */}
      {deletingReturn && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2.5 bg-rose-950/60 border border-rose-800 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-white text-base">Delete Purchase Return?</h4>
                <p className="text-xs text-slate-400">Voucher: {deletingReturn.docNumber}</p>
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1.5">
              <p className="text-amber-300 font-semibold flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Automatic Inventory Rollback</span>
              </p>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                Deleting this return voucher will restore all returned quantities back into the central warehouse inventory balance table, and unmark returned balances on linked purchase invoices.
              </p>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeletingReturn(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-md shadow-rose-600/30 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete & Restore Stock</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
