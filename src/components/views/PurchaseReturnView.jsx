// PurchaseReturnView: Supplier Purchase Returns & Debit Notes against Inward Purchases
import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { saveDatabase, logAuditEvent } from '../../services/storageService.js';
import { StockService } from '../../services/stockService.js';
import {
  RotateCcw,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Truck,
  FileText,
  DollarSign,
  X,
} from 'lucide-react';
import ExportButtons from '../common/ExportButtons.jsx';

export default function PurchaseReturnView() {
  const { db, currentUser, notify, triggerRefresh, activeWarehouse } = useApp();

  const [search, setSearch] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New Purchase Return State
  const [returnData, setReturnData] = useState({
    purchaseId: db.purchases?.[0]?.id || '',
    reason: 'DAMAGED_IN_TRANSIT',
    returnQty: 1,
    notes: 'Damaged packaging rejected at receipt',
  });

  const purchaseReturns = (db.purchaseReturns || []).filter((pr) => {
    const q = search.toLowerCase();
    return (
      pr.docNumber.toLowerCase().includes(q) ||
      pr.supplierName.toLowerCase().includes(q) ||
      pr.productName.toLowerCase().includes(q)
    );
  });

  const selectedPurchase = db.purchases?.find((p) => p.id === returnData.purchaseId);
  const purchaseLine = selectedPurchase?.lines?.[0];

  const handlePostReturn = (e) => {
    e.preventDefault();
    if (!selectedPurchase || !purchaseLine) {
      notify('error', 'Please select a valid purchase invoice', 'Validation Error');
      return;
    }

    const qtyToReturn = Number(returnData.returnQty);
    if (!qtyToReturn || qtyToReturn <= 0) {
      notify('error', 'Return quantity must be greater than zero', 'Invalid Qty');
      return;
    }

    // Section 6 Check: Cannot exceed remaining eligible quantity
    const alreadyReturned = purchaseLine.returnedQty || 0;
    const remainingReturnable = (purchaseLine.qty || 0) - alreadyReturned;
    if (qtyToReturn > remainingReturnable) {
      notify(
        'error',
        `Return quantity (${qtyToReturn}) exceeds remaining returnable quantity (${remainingReturnable}).`,
        'Excess Return Blocked'
      );
      return;
    }

    // Check available warehouse stock to prevent negative inventory
    const warehouseId = selectedPurchase.warehouseId || activeWarehouse?.id;
    const stockRow = db.stockBalances.find(
      (b) => b.warehouseId === warehouseId && b.productId === purchaseLine.productId
    );
    if (!stockRow || stockRow.quantity < qtyToReturn) {
      notify(
        'error',
        `Insufficient warehouse stock to return to supplier. Available: ${stockRow?.quantity || 0}, Return requested: ${qtyToReturn}`,
        'Stock Check Failed'
      );
      return;
    }

    const returnDocNumber = `PRTN-2026-${String(purchaseReturns.length + 1).padStart(4, '0')}`;
    const returnValuation = qtyToReturn * Number(purchaseLine.rate || 0);

    // 1. Deduct Stock from Warehouse via Stock Movement
    StockService.recordMovement({
      docType: 'PURCHASE_RETURN',
      docId: returnDocNumber,
      docNumber: returnDocNumber,
      warehouseId,
      productId: purchaseLine.productId,
      qtyChange: -qtyToReturn,
      costRate: purchaseLine.rate,
      reason: `Supplier return: ${returnData.reason} (${returnData.notes})`,
      userId: currentUser.id,
    });

    // 2. Update Purchase Record
    purchaseLine.returnedQty = alreadyReturned + qtyToReturn;

    // 3. Create Purchase Return Record
    const returnRecord = {
      id: `PRTN-${Date.now()}`,
      docNumber: returnDocNumber,
      purchaseId: selectedPurchase.id,
      purchaseDocNumber: selectedPurchase.docNumber,
      supplierId: selectedPurchase.supplierId,
      supplierName: selectedPurchase.supplierName,
      warehouseId,
      productId: purchaseLine.productId,
      productName: purchaseLine.name,
      returnQty: qtyToReturn,
      unitRate: purchaseLine.rate,
      totalCreditAmount: returnValuation,
      reason: returnData.reason,
      notes: returnData.notes,
      postedAt: new Date().toISOString(),
      postedBy: currentUser.id,
    };

    if (!db.purchaseReturns) db.purchaseReturns = [];
    db.purchaseReturns.unshift(returnRecord);
    saveDatabase(db);

    logAuditEvent(
      'PURCHASE_RETURN_POSTED',
      currentUser.id,
      `Posted Purchase Return ${returnDocNumber} for ${qtyToReturn} units of ${purchaseLine.name} to ${selectedPurchase.supplierName}. Credit: ₹${returnValuation}`
    );

    notify(
      'success',
      `Purchase Return ${returnDocNumber} posted. Stock deducted by ${qtyToReturn} units and debit note generated.`,
      'Return Posted'
    );
    triggerRefresh();
    setIsAddModalOpen(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-3 rounded-xl shadow-md">
        <div className="flex items-center gap-2">
          <RotateCcw className="w-5 h-5 text-amber-400" />
          <div>
            <h3 className="font-bold text-white text-sm">Purchase Returns & Supplier Debit Notes</h3>
            <p className="text-[11px] text-slate-400">
              Section 6: Return goods to suppliers with traceable batch/invoice linking and automatic stock deduction
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search return #, supplier..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-56"
            />
          </div>

          <ExportButtons
            data={purchaseReturns.map((pr, idx) => ({
              '#': idx + 1,
              'Return Doc #': pr.docNumber,
              'Original Purchase': pr.purchaseDocNumber,
              'Supplier Name': pr.supplierName,
              'Product Name': pr.productName,
              'Returned Qty': pr.returnQty,
              'Debit Note Value': `₹${pr.totalCreditAmount?.toFixed(2)}`,
              'Return Reason': pr.reason,
              'Posted Date': new Date(pr.postedAt).toLocaleDateString()
            }))}
            filename="PURCHASE_RETURNS_DEBIT_NOTES"
            title="PURCHASE RETURNS & SUPPLIER DEBIT NOTES"
            pdfOrientation="landscape"
          />

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-amber-600/30 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Purchase Return</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Return Doc #</th>
                <th className="py-2.5 px-3">Original Purchase</th>
                <th className="py-2.5 px-3">Supplier Name</th>
                <th className="py-2.5 px-3">Product Name</th>
                <th className="py-2.5 px-3 text-center">Returned Qty</th>
                <th className="py-2.5 px-3 text-right">Debit Note Value</th>
                <th className="py-2.5 px-3">Return Reason</th>
                <th className="py-2.5 px-3">Posted Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {purchaseReturns.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-slate-500 font-sans">
                    No purchase returns recorded. Click "Create Purchase Return" to post a debit note.
                  </td>
                </tr>
              ) : (
                purchaseReturns.map((pr) => (
                  <tr key={pr.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-2.5 px-3 font-bold text-amber-300">{pr.docNumber}</td>
                    <td className="py-2.5 px-3 text-indigo-400 font-bold">{pr.purchaseDocNumber}</td>
                    <td className="py-2.5 px-3 font-sans font-bold text-white">{pr.supplierName}</td>
                    <td className="py-2.5 px-3 font-sans text-slate-200">{pr.productName}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-rose-400">-{pr.returnQty}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-white">
                      ₹{pr.totalCreditAmount?.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 font-sans text-slate-400">{pr.reason}</td>
                    <td className="py-2.5 px-3 font-sans text-slate-400">
                      {new Date(pr.postedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Return Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="font-bold text-white text-sm flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-amber-400" />
                Issue Supplier Purchase Return
              </h4>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePostReturn} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Select Original Purchase Invoice *</label>
                <select
                  value={returnData.purchaseId}
                  onChange={(e) => setReturnData({ ...returnData, purchaseId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-amber-500 font-mono"
                >
                  {(db.purchases || []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.docNumber} — {p.supplierName} (Total: ₹{p.netAmount})
                    </option>
                  ))}
                </select>
              </div>

              {selectedPurchase && purchaseLine && (
                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1 text-slate-300">
                  <div className="font-bold text-white">{purchaseLine.name}</div>
                  <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                    <span>Inward Qty: {purchaseLine.qty}</span>
                    <span>Already Returned: {purchaseLine.returnedQty || 0}</span>
                    <span className="text-emerald-400 font-bold">
                      Available to Return: {(purchaseLine.qty || 0) - (purchaseLine.returnedQty || 0)}
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-300 block">Quantity to Return *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={returnData.returnQty}
                    onChange={(e) => setReturnData({ ...returnData, returnQty: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-bold text-rose-400 focus:border-amber-500 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-300 block">Return Reason</label>
                  <select
                    value={returnData.reason}
                    onChange={(e) => setReturnData({ ...returnData, reason: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-amber-500"
                  >
                    <option value="DAMAGED_IN_TRANSIT">Damaged In Transit</option>
                    <option value="EXPIRED_STOCK">Near Expiry / Expired</option>
                    <option value="QUALITY_DEFECT">Substandard Quality</option>
                    <option value="OVER_SHIPMENT">Excess Shipment</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Notes & Justification</label>
                <textarea
                  rows="2"
                  value={returnData.notes}
                  onChange={(e) => setReturnData({ ...returnData, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold shadow-md shadow-amber-600/30"
                >
                  Post Purchase Return
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
