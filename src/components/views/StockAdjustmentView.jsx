// StockAdjustmentView: Physical Inventory Counting, Variance Audit, and Manager Approval Thresholds
import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { StockAdjustmentService } from '../../services/stockAdjustmentService';
import { StockService } from '../../services/stockService';
import { logBacklog } from '../../services/storageService.js';
import {
  ClipboardCheck,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Warehouse,
} from 'lucide-react';
import ExportButtons from '../common/ExportButtons.jsx';

export default function StockAdjustmentView() {
  const { db, activeWarehouse, currentUser, notify, triggerRefresh } = useApp();

  const [activeTab, setActiveTab] = useState('list'); // list | new
  const [selectedProductId, setSelectedProductId] = useState('PROD-001');
  const [countedQty, setCountedQty] = useState(45);
  const [reason, setReason] = useState('PHYSICAL_COUNT');
  const [notes, setNotes] = useState('');

  const currentBookQty = StockService.getStockBalance(activeWarehouse.id, selectedProductId);
  const variance = Number(countedQty) - currentBookQty;
  const product = db.products.find(p => p.id === selectedProductId);
  const valuationImpact = Math.abs(variance * (product?.costRate || 0));

  const isMaterialThresholdExceeded =
    Math.abs(variance) > db.settings.managerApprovalThresholdQty ||
    valuationImpact > db.settings.managerApprovalThresholdAmount;

  const handleSubmit = (e) => {
    e.preventDefault();
    try {
      const res = StockAdjustmentService.submitAdjustment({
        warehouseId: activeWarehouse.id,
        productId: selectedProductId,
        countedQty,
        reason,
        notes,
        userRole: currentUser.role,
        userId: currentUser.id,
      });

      if (res.status === 'PENDING_APPROVAL') {
        notify('warning', `Adjustment ${res.docNumber} exceeds material threshold and requires Store Manager approval.`, 'Pending Approval');
      } else {
        notify('success', `Stock count adjustment ${res.docNumber} posted! Stock updated to ${countedQty}.`, 'Adjustment Posted');
      }

      logBacklog({
        action: 'SAVE',
        formName: 'Stock Adjustment',
        recordRef: res.docNumber,
        userId: currentUser?.id,
        userName: currentUser?.name,
        userRole: currentUser?.role,
        details: `Saved stock count adjustment ${res.docNumber} (Product: ${product?.name}, Counted: ${countedQty}, Variance: ${variance > 0 ? '+' + variance : variance})`,
      });

      triggerRefresh();
      setActiveTab('list');
    } catch (err) {
      notify('error', err.message, 'Adjustment Failed');
    }
  };

  const handleApprove = (adjId) => {
    try {
      const res = StockAdjustmentService.approveAdjustment(adjId, currentUser.id);
      logBacklog({
        action: 'UPDATE',
        formName: 'Stock Adjustment',
        recordRef: res.docNumber,
        userId: currentUser?.id,
        userName: currentUser?.name,
        userRole: currentUser?.role,
        details: `Approved stock adjustment ${res.docNumber} by manager`,
      });
      notify('success', `Stock adjustment ${res.docNumber} approved by manager! Stock balance updated.`, 'Approved');
      triggerRefresh();
    } catch (err) {
      notify('error', err.message, 'Approval Failed');
    }
  };

  const canApprove = currentUser.role === 'STORE_MANAGER' || currentUser.role === 'COMPANY_ADMIN';

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between bg-slate-900 border border-slate-800 p-3 rounded-xl shadow-md gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              activeTab === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            <span>Adjustments Log ({db.stockAdjustments.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('new')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              activeTab === 'new' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Perform Physical Stock Count</span>
          </button>
        </div>

        {activeTab === 'list' && (
          <ExportButtons
            data={db.stockAdjustments.map((adj, idx) => ({
              '#': idx + 1,
              'Adjustment #': adj.docNumber,
              'Date & Time': new Date(adj.createdAt).toLocaleString(),
              'Warehouse': adj.warehouseName || adj.warehouseId,
              'Product Name': adj.productName,
              'Book Qty': adj.bookQty,
              'Counted Qty': adj.countedQty,
              'Variance': adj.adjustmentQty > 0 ? `+${adj.adjustmentQty}` : adj.adjustmentQty,
              'Valuation Impact': `₹${adj.valuationImpact?.toFixed(2)}`,
              'Reason': adj.reason,
              'Status': adj.status
            }))}
            filename="STOCK_ADJUSTMENTS_REGISTER"
            title="PHYSICAL STOCK ADJUSTMENTS & VARIANCE LOG"
            pdfOrientation="landscape"
          />
        )}
      </div>

      {activeTab === 'list' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[750px]">
              <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Adjustment #</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Warehouse</th>
                  <th className="py-2.5 px-3">Product Name</th>
                  <th className="py-2.5 px-2 text-center">Book Qty</th>
                  <th className="py-2.5 px-2 text-center">Counted Qty</th>
                  <th className="py-2.5 px-2 text-center">Variance</th>
                  <th className="py-2.5 px-3 text-right">Valuation Impact</th>
                  <th className="py-2.5 px-3">Reason</th>
                  <th className="py-2.5 px-2 text-center">Status</th>
                  <th className="py-2.5 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {db.stockAdjustments.length === 0 ? (
                  <tr>
                    <td colSpan="11" className="py-8 text-center text-slate-500 text-xs">
                      No stock count adjustments recorded.
                    </td>
                  </tr>
                ) : (
                  db.stockAdjustments.map(adj => {
                    const isPositive = adj.adjustmentQty > 0;
                    return (
                      <tr key={adj.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-2.5 px-3 font-mono font-bold text-indigo-300">{adj.docNumber}</td>
                        <td className="py-2.5 px-3 text-slate-400 text-[11px]">{new Date(adj.createdAt).toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-slate-300">{adj.warehouseName}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-200">{adj.productName}</td>
                        <td className="py-2.5 px-2 text-center text-slate-400">{adj.bookQty}</td>
                        <td className="py-2.5 px-2 text-center font-bold text-white">{adj.countedQty}</td>
                        <td className="py-2.5 px-2 text-center font-mono font-bold">
                          <span className={isPositive ? 'text-emerald-400' : 'text-rose-400'}>
                            {isPositive ? `+${adj.adjustmentQty}` : adj.adjustmentQty}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                          ₹{adj.valuationImpact?.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 text-[11px]">{adj.reason}</td>
                        <td className="py-2.5 px-2 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            adj.status === 'POSTED'
                              ? 'bg-emerald-950/70 text-emerald-400 border border-emerald-800/40'
                              : 'bg-amber-950/70 text-amber-400 border border-amber-800/40 animate-pulse'
                          }`}>
                            {adj.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {adj.status === 'PENDING_APPROVAL' && (
                            canApprove ? (
                              <button
                                onClick={() => handleApprove(adj.id)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-semibold flex items-center gap-1 mx-auto transition"
                              >
                                <CheckCircle2 className="w-3 h-3" /> Approve Post
                              </button>
                            ) : (
                              <span className="text-[10px] text-amber-400 italic">Needs Manager</span>
                            )
                          )}
                          {adj.status === 'POSTED' && (
                            <span className="text-slate-500 text-[11px]">Completed</span>
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

      {activeTab === 'new' && (
        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-md space-y-4 max-w-2xl mx-auto">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="font-bold text-white text-base">Physical Stock Audit Entry (Section 10)</h3>
            <p className="text-xs text-slate-400">Record counted inventory vs book quantity with controlled reason codes</p>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="font-semibold text-slate-400 block mb-1">Select Product</label>
              <select
                value={selectedProductId}
                onChange={(e) => {
                  setSelectedProductId(e.target.value);
                  const b = StockService.getStockBalance(activeWarehouse.id, e.target.value);
                  setCountedQty(b);
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-200"
              >
                {db.products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4 bg-slate-950 p-3 rounded-xl border border-slate-800">
              <div>
                <span className="text-slate-400 text-[11px]">System Book Quantity:</span>
                <div className="text-xl font-black font-mono text-slate-200">{currentBookQty} units</div>
              </div>

              <div>
                <label className="text-slate-400 text-[11px] font-semibold block mb-1">Physical Counted Quantity</label>
                <input
                  type="number"
                  min="0"
                  value={countedQty}
                  onChange={(e) => setCountedQty(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-indigo-500 rounded-lg px-2.5 py-1.5 font-mono font-bold text-white text-base text-center"
                />
              </div>
            </div>

            {/* Calculated Variance */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-slate-400">Calculated Variance:</span>
                <div className="text-[11px] text-slate-500">Valuation Impact: ₹{valuationImpact.toFixed(2)}</div>
              </div>
              <div className={`text-xl font-black font-mono ${variance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {variance > 0 ? `+${variance}` : variance} units
              </div>
            </div>

            {isMaterialThresholdExceeded && (
              <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-3 text-amber-200 text-xs flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                <span>
                  <strong>Supervisor Approval Required:</strong> Variance exceeds threshold ({db.settings.managerApprovalThresholdQty} units or ₹{db.settings.managerApprovalThresholdAmount}). Entry will be queued as <code>PENDING_APPROVAL</code>.
                </span>
              </div>
            )}

            <div>
              <label className="font-semibold text-slate-400 block mb-1">Controlled Reason Code</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-200"
              >
                <option value="PHYSICAL_COUNT">Routine Physical Count Variance</option>
                <option value="DAMAGE">Warehouse Damage / Leakage</option>
                <option value="EXPIRY">Batch Expiry / Best Before Reached</option>
                <option value="LOSS">Pilferage / Transit Loss</option>
                <option value="FOUND_STOCK">Surplus Found Stock</option>
                <option value="DATA_CORRECTION">Data Entry Migration Correction</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-400 block mb-1">Audit Notes / Explanation</label>
              <input
                type="text"
                placeholder="Physical count sheet # / Auditor notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('list')}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-lg shadow-indigo-600/30"
            >
              <CheckCircle2 className="w-4 h-4" />
              Submit Stock Count
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
