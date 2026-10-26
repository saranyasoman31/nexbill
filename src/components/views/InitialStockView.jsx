// InitialStockView: Opening Inventory Cutover, Initial Stock Balances & Valuation Baseline
import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { saveDatabase, logAuditEvent, logBacklog } from '../../services/storageService.js';
import { StockService } from '../../services/stockService.js';
import {
  Boxes,
  Plus,
  Search,
  CheckCircle2,
  Calendar,
  Warehouse,
  Package,
  DollarSign,
  AlertTriangle,
  X,
  FileCheck2,
} from 'lucide-react';
import ExportButtons from '../common/ExportButtons.jsx';

export default function InitialStockView() {
  const { db, currentUser, notify, triggerRefresh, activeWarehouse } = useApp();

  const [search, setSearch] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New Initial Stock Entry Form
  const [entryData, setEntryData] = useState({
    warehouseId: activeWarehouse?.id || 'WH-MUM-MAIN',
    productId: db.products?.[0]?.id || 'PROD-001',
    quantity: 50,
    valuationRate: db.products?.[0]?.costRate || 0,
    effectiveDate: new Date().toISOString().split('T')[0],
    notes: 'Fiscal Year Opening Stock Balance Cutover',
  });

  const initialStocks = (db.initialStocks || []).filter((item) => {
    const q = search.toLowerCase();
    return (
      item.docNumber.toLowerCase().includes(q) ||
      item.productName.toLowerCase().includes(q) ||
      item.warehouseId.toLowerCase().includes(q)
    );
  });

  const totalOpeningUnits = (db.initialStocks || []).reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
  const totalOpeningValuation = (db.initialStocks || []).reduce((sum, i) => sum + (Number(i.totalValuation) || 0), 0);

  const handleProductChange = (prodId) => {
    const p = db.products.find((prod) => prod.id === prodId);
    setEntryData({
      ...entryData,
      productId: prodId,
      valuationRate: p?.costRate || 0,
    });
  };

  const handleSaveInitialStock = (e) => {
    e.preventDefault();
    const qty = Number(entryData.quantity);
    const rate = Number(entryData.valuationRate);

    if (qty <= 0) {
      notify('error', 'Opening stock quantity must be greater than zero.', 'Validation Error');
      return;
    }

    const prod = db.products.find((p) => p.id === entryData.productId);
    const docNumber = `INIT-2026-${String(initialStocks.length + 1).padStart(3, '0')}`;
    const totalValuation = qty * rate;

    // Check duplicate opening entry for same product and warehouse (Section 9 rule)
    const existingInit = (db.initialStocks || []).find(
      (i) => i.warehouseId === entryData.warehouseId && i.productId === entryData.productId
    );
    if (existingInit) {
      if (
        !window.confirm(
          `Opening stock already exists for ${prod?.name} in warehouse ${entryData.warehouseId}. Do you want to post an additional opening migration batch?`
        )
      ) {
        return;
      }
    }

    // Record Stock Movement with INITIAL_STOCK docType
    StockService.recordMovement({
      docType: 'INITIAL_STOCK',
      docId: docNumber,
      docNumber: docNumber,
      warehouseId: entryData.warehouseId,
      productId: entryData.productId,
      qtyChange: qty,
      costRate: rate,
      reason: entryData.notes,
      userId: currentUser.id,
    });

    const record = {
      id: `INIT-${Date.now()}`,
      docNumber,
      warehouseId: entryData.warehouseId,
      productId: entryData.productId,
      productName: prod?.name || 'Product',
      quantity: qty,
      valuationRate: rate,
      totalValuation,
      effectiveDate: entryData.effectiveDate,
      notes: entryData.notes,
      createdBy: currentUser.id,
      createdAt: new Date().toISOString(),
    };

    if (!db.initialStocks) db.initialStocks = [];
    db.initialStocks.unshift(record);
    saveDatabase(db);

    logAuditEvent(
      'INITIAL_STOCK_CUTOVER',
      currentUser.id,
      `Opening stock cutover posted: ${qty} units of ${prod?.name} in ${entryData.warehouseId} at ₹${rate}/unit (Total: ₹${totalValuation})`
    );
    logBacklog({
      action: 'SAVE',
      formName: 'Initial Stock',
      recordRef: docNumber,
      userId: currentUser?.id,
      userName: currentUser?.name,
      userRole: currentUser?.role,
      details: `Saved opening stock cutover: ${qty} units of ${prod?.name} in ${entryData.warehouseId} at ₹${rate}/unit (Total: ₹${totalValuation})`,
    });

    notify(
      'success',
      `Opening stock of ${qty} units added for ${prod?.name} to warehouse ${entryData.warehouseId}.`,
      'Opening Stock Committed'
    );
    triggerRefresh();
    setIsAddModalOpen(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-3 rounded-xl shadow-md">
        <div className="flex items-center gap-2">
          <Boxes className="w-5 h-5 text-indigo-400" />
          <div>
            <h3 className="font-bold text-white text-sm">Initial / Opening Stock Inventory Cutover</h3>
            <p className="text-[11px] text-slate-400">
              Section 9: Approved opening balances cutover with warehouse valuation baseline and duplicate protection
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search product, doc #..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-56"
            />
          </div>

          <ExportButtons
            data={initialStocks.map((item, idx) => ({
              '#': idx + 1,
              'Cutover Doc #': item.docNumber,
              'Effective Date': item.effectiveDate,
              'Warehouse Location': db.warehouses.find(w => w.id === item.warehouseId)?.name || item.warehouseId,
              'Product Name': item.productName,
              'Opening Units': item.quantity,
              'Valuation Rate': `₹${Number(item.valuationRate || 0).toFixed(2)}`,
              'Total Valuation': `₹${Number(item.totalValuation || 0).toFixed(2)}`,
              'Cutover Notes': item.notes || ''
            }))}
            filename="INITIAL_STOCK_CUTOVER"
            title="OPENING STOCK INVENTORY CUTOVER"
            pdfOrientation="landscape"
          />

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-indigo-600/30 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Post Opening Stock</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-sm space-y-1">
          <span className="text-[11px] text-slate-400">Total Cutover Batches</span>
          <div className="text-xl font-bold font-mono text-white">{(db.initialStocks || []).length} Batches</div>
          <span className="text-[10px] text-indigo-400 font-semibold">Audited Migrations</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-sm space-y-1">
          <span className="text-[11px] text-slate-400">Total Opening Units Migrated</span>
          <div className="text-xl font-bold font-mono text-emerald-400">{totalOpeningUnits.toLocaleString('en-IN')} Units</div>
          <span className="text-[10px] text-emerald-300 font-semibold">Committed to Warehouse Ledger</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-sm space-y-1">
          <span className="text-[11px] text-slate-400">Total Opening Inventory Valuation</span>
          <div className="text-xl font-bold font-mono text-cyan-400">
            ₹{totalOpeningValuation.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-cyan-300 font-semibold">Opening Asset Balance</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Cutover Doc #</th>
                <th className="py-2.5 px-3">Effective Date</th>
                <th className="py-2.5 px-3">Warehouse</th>
                <th className="py-2.5 px-3">Product Name</th>
                <th className="py-2.5 px-3 text-center">Opening Qty</th>
                <th className="py-2.5 px-3 text-right">Valuation Rate</th>
                <th className="py-2.5 px-3 text-right">Total Valuation</th>
                <th className="py-2.5 px-3">Notes & Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {initialStocks.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-slate-500 font-sans">
                    No opening stock records found. Click "Post Opening Stock" to record cutover inventory.
                  </td>
                </tr>
              ) : (
                initialStocks.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-2.5 px-3 font-bold text-indigo-300">{item.docNumber}</td>
                    <td className="py-2.5 px-3 text-slate-400 font-sans">{item.effectiveDate}</td>
                    <td className="py-2.5 px-3 font-sans text-slate-300">
                      {db.warehouses?.find((w) => w.id === item.warehouseId)?.name || item.warehouseId}
                    </td>
                    <td className="py-2.5 px-3 font-sans font-bold text-white">{item.productName}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-emerald-400">+{item.quantity}</td>
                    <td className="py-2.5 px-3 text-right text-slate-300">₹{item.valuationRate?.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-white">
                      ₹{item.totalValuation?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-3 font-sans text-slate-400">{item.notes}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="font-bold text-white text-sm flex items-center gap-2">
                <Boxes className="w-4 h-4 text-indigo-400" />
                Post Initial / Opening Stock Cutover
              </h4>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveInitialStock} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Receiving Warehouse *</label>
                <select
                  value={entryData.warehouseId}
                  onChange={(e) => setEntryData({ ...entryData, warehouseId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-indigo-500"
                >
                  {(db.warehouses || []).map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Product *</label>
                <select
                  value={entryData.productId}
                  onChange={(e) => handleProductChange(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-indigo-500"
                >
                  {(db.products || []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku}) — Standard Cost: ₹{p.costRate}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-300 block">Opening Quantity *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={entryData.quantity}
                    onChange={(e) => setEntryData({ ...entryData, quantity: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-bold text-emerald-400 focus:border-indigo-500 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-300 block">Valuation Cost Rate (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={entryData.valuationRate}
                    onChange={(e) => setEntryData({ ...entryData, valuationRate: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-bold focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Cutover Effective Date</label>
                <input
                  type="date"
                  required
                  value={entryData.effectiveDate}
                  onChange={(e) => setEntryData({ ...entryData, effectiveDate: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Cutover Reason / Reference</label>
                <input
                  type="text"
                  value={entryData.notes}
                  onChange={(e) => setEntryData({ ...entryData, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-indigo-500"
                />
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between font-mono">
                <span className="text-slate-400 font-sans">Total Asset Value:</span>
                <span className="font-bold text-emerald-400 text-sm">
                  ₹{(entryData.quantity * entryData.valuationRate).toFixed(2)}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold shadow-md shadow-indigo-600/30"
                >
                  Post & Update Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
