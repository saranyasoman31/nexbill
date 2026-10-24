// PurchasingView: Inward Purchasing, Supplier Invoice Duplicate Prevention, and Purchase Debit Notes
import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { PurchasePostingService } from '../../services/purchasePostingService';
import { StockService } from '../../services/stockService';
import { logBacklog } from '../../services/storageService.js';
import {
  Truck,
  Plus,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Building2,
  Trash2,
  Search,
} from 'lucide-react';
import ExportButtons from '../common/ExportButtons.jsx';

export default function PurchasingView() {
  const { db, activeCompany, activeStore, activeWarehouse, currentUser, notify, triggerRefresh } = useApp();

  const [activeTab, setActiveTab] = useState('list'); // list | new | debit_notes
  const [selectedSupplierId, setSelectedSupplierId] = useState('SUPP-01');
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState('');
  const [receivingWarehouseId, setReceivingWarehouseId] = useState(activeWarehouse.id);
  const [purchaseLines, setPurchaseLines] = useState([
    { productId: 'PROD-001', qty: 20, rate: 340, taxRate: 5 }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Purchase Return state
  const [returnPurchase, setReturnPurchase] = useState(null);
  const [returnItems, setReturnItems] = useState({});
  const [returnReason, setReturnReason] = useState('Vendor defective batch');

  const addLine = () => {
    setPurchaseLines([...purchaseLines, { productId: db.products[0].id, qty: 10, rate: db.products[0].costRate, taxRate: db.products[0].taxRate }]);
  };

  const removeLine = (idx) => {
    setPurchaseLines(purchaseLines.filter((_, i) => i !== idx));
  };

  const updateLine = (idx, field, val) => {
    const next = [...purchaseLines];
    next[idx][field] = val;
    if (field === 'productId') {
      const prod = db.products.find(p => p.id === val);
      if (prod) {
        next[idx].rate = prod.costRate;
        next[idx].taxRate = prod.taxRate;
      }
    }
    setPurchaseLines(next);
  };

  const handlePostPurchase = (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = PurchasePostingService.postPurchase({
        companyId: activeCompany.id,
        storeId: activeStore.id,
        warehouseId: receivingWarehouseId,
        supplierId: selectedSupplierId,
        supplierInvoiceNo,
        items: purchaseLines.map(l => {
          const prod = db.products.find(p => p.id === l.productId);
          return {
            productId: l.productId,
            name: prod?.name || l.productId,
            qty: Number(l.qty),
            rate: Number(l.rate),
            taxRate: Number(l.taxRate),
          };
        }),
        userId: currentUser.id,
      });

      logBacklog({
        action: 'SAVE',
        formName: 'Purchase Inward',
        recordRef: res.purchase.docNumber,
        userId: currentUser?.id,
        userName: currentUser?.name,
        userRole: currentUser?.role,
        details: `Saved Inward Purchase Receipt ${res.purchase.docNumber} (Supplier: ${res.purchase.supplierName}, Inv: ${supplierInvoiceNo}, Total: ₹${res.purchase.grandTotal.toFixed(2)})`,
      });

      notify('success', res.message, 'Purchase Receipt Posted');
      triggerRefresh();
      setSupplierInvoiceNo('');
      setActiveTab('list');
    } catch (err) {
      notify('error', err.message, 'Purchase Blocked');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartDebitNote = (purchase) => {
    const itemsMap = {};
    purchase.lines.forEach(l => {
      itemsMap[l.productId] = {
        productId: l.productId,
        name: l.name,
        purchasedQty: l.qty,
        prevReturned: l.returnedQty || 0,
        maxReturnable: l.qty - (l.returnedQty || 0),
        returnQty: 0,
        rate: l.rate,
      };
    });
    setReturnItems(itemsMap);
    setReturnPurchase(purchase);
  };

  const handleSubmitDebitNote = () => {
    try {
      const itemsToReturn = Object.values(returnItems)
        .filter(it => Number(it.returnQty) > 0)
        .map(it => ({
          productId: it.productId,
          returnQty: Number(it.returnQty),
        }));

      if (itemsToReturn.length === 0) {
        notify('error', 'Select at least one product with return quantity.', 'Invalid Return');
        return;
      }

      const res = PurchasePostingService.postPurchaseReturn({
        originalPurchaseDocNumber: returnPurchase.docNumber,
        items: itemsToReturn,
        reason: returnReason,
        userId: currentUser.id,
      });

      logBacklog({
        action: 'CANCEL',
        formName: 'Purchase Debit Note',
        recordRef: res.debitNote.docNumber,
        userId: currentUser?.id,
        userName: currentUser?.name,
        userRole: currentUser?.role,
        details: `Issued Purchase Return Debit Note ${res.debitNote.docNumber} against ${returnPurchase.docNumber} (${itemsToReturn.length} items returned, Reason: ${returnReason})`,
      });

      notify('success', res.message, 'Debit Note Issued');
      triggerRefresh();
      setReturnPurchase(null);
      setActiveTab('debit_notes');
    } catch (err) {
      notify('error', err.message, 'Debit Note Failed');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
      {/* Top Tab Bar */}
      <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-3 rounded-xl shadow-md">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              activeTab === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Purchases ({db.purchases.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('new')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              activeTab === 'new' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Purchase Receipt</span>
          </button>

          <button
            onClick={() => setActiveTab('debit_notes')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              activeTab === 'debit_notes' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Supplier Debit Notes ({db.purchaseReturns.length})</span>
          </button>
        </div>

        {activeTab !== 'new' && (
          <ExportButtons
            data={
              activeTab === 'list'
                ? db.purchases.map((p, idx) => ({
                    '#': idx + 1,
                    'Purchase #': p.docNumber,
                    'Date': new Date(p.date).toLocaleString(),
                    'Supplier Name': p.supplierName,
                    'Vendor Invoice #': p.supplierInvoiceNo,
                    'Warehouse': db.warehouses.find(w => w.id === p.warehouseId)?.name || p.warehouseId,
                    'Lines Count': p.lines.length,
                    'Net Value': `₹${p.netAmount?.toFixed(2)}`
                  }))
                : db.purchaseReturns.map((pr, idx) => ({
                    '#': idx + 1,
                    'Debit Note #': pr.docNumber,
                    'Date': new Date(pr.date).toLocaleString(),
                    'Original Purchase #': pr.originalPurchaseDocNumber,
                    'Supplier Name': pr.supplierName,
                    'Items Count': pr.items?.length || 1,
                    'Debit Value': `₹${pr.totalDebitAmount?.toFixed(2)}`,
                    'Reason': pr.reason
                  }))
            }
            filename={activeTab === 'list' ? 'PURCHASE_RECEIPTS' : 'SUPPLIER_DEBIT_NOTES'}
            title={activeTab === 'list' ? 'PURCHASE GOODS RECEIPTS INWARD' : 'SUPPLIER DEBIT NOTES & RETURNS'}
            pdfOrientation="landscape"
          />
        )}
      </div>

      {activeTab === 'list' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Purchase #</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Supplier Name</th>
                  <th className="py-2.5 px-3">Vendor Invoice #</th>
                  <th className="py-2.5 px-3">Warehouse</th>
                  <th className="py-2.5 px-2 text-center">Lines</th>
                  <th className="py-2.5 px-3 text-right">Net Value</th>
                  <th className="py-2.5 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {db.purchases.map(p => (
                  <tr key={p.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-2.5 px-3 font-mono font-bold text-indigo-300">{p.docNumber}</td>
                    <td className="py-2.5 px-3 text-slate-400 text-[11px]">{new Date(p.date).toLocaleString()}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-200">{p.supplierName}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-300">{p.supplierInvoiceNo}</td>
                    <td className="py-2.5 px-3 text-slate-300">
                      {db.warehouses.find(w => w.id === p.warehouseId)?.name || p.warehouseId}
                    </td>
                    <td className="py-2.5 px-2 text-center font-bold text-slate-300">{p.lines.length}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                      ₹{Number(p.netAmount).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        onClick={() => handleStartDebitNote(p)}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded text-[11px] font-semibold flex items-center gap-1 mx-auto transition"
                      >
                        <RotateCcw className="w-3 h-3" /> Debit Note
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'new' && (
        <form onSubmit={handlePostPurchase} className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="font-bold text-white text-base">New Inward Purchase Entry</h3>
              <p className="text-xs text-slate-400">Section 4: Atomic PURCHASE_IN stock receipt with duplicate vendor bill check</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="font-semibold text-slate-400 block mb-1">Supplier</label>
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-200"
              >
                {db.suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.gstin})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-400 block mb-1">
                Supplier Bill / Invoice # <span className="text-indigo-400">(Duplicate Protected)</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. AGRO/2026/902"
                value={supplierInvoiceNo}
                onChange={(e) => setSupplierInvoiceNo(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-200 font-mono"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-400 block mb-1">Receiving Warehouse</label>
              <select
                value={receivingWarehouseId}
                onChange={(e) => setReceivingWarehouseId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-200"
              >
                {db.warehouses.filter(w => w.companyId === activeCompany.id).map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Line items */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-300">Purchase Line Items</span>
              <button
                type="button"
                onClick={addLine}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded text-xs flex items-center gap-1 font-semibold"
              >
                <Plus className="w-3.5 h-3.5" /> Add Line
              </button>
            </div>

            <div className="space-y-2">
              {purchaseLines.map((line, idx) => (
                <div key={idx} className="flex flex-wrap items-center gap-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-xs">
                  <div className="flex-1 min-w-[200px]">
                    <select
                      value={line.productId}
                      onChange={(e) => updateLine(idx, 'productId', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200"
                    >
                      {db.products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                      ))}
                    </select>
                  </div>

                  <div className="w-24">
                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={line.qty}
                      onChange={(e) => updateLine(idx, 'qty', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center font-bold text-slate-100"
                    />
                  </div>

                  <div className="w-28">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Rate ₹"
                      value={line.rate}
                      onChange={(e) => updateLine(idx, 'rate', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-right font-mono text-slate-100"
                    />
                  </div>

                  <div className="w-20 text-center text-slate-400 font-semibold">
                    GST {line.taxRate}%
                  </div>

                  <div className="w-28 text-right font-mono font-bold text-indigo-300">
                    ₹{(line.qty * line.rate * (1 + line.taxRate / 100)).toFixed(2)}
                  </div>

                  {purchaseLines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLine(idx)}
                      className="text-slate-500 hover:text-rose-400 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
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
              disabled={isSubmitting}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-lg shadow-indigo-600/30"
            >
              <CheckCircle2 className="w-4 h-4" />
              {isSubmitting ? 'Posting...' : 'Post Purchase Receipt'}
            </button>
          </div>
        </form>
      )}

      {activeTab === 'debit_notes' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Debit Note #</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Original Purchase #</th>
                  <th className="py-2.5 px-3">Supplier Name</th>
                  <th className="py-2.5 px-2 text-center">Items</th>
                  <th className="py-2.5 px-3 text-right">Debit Value</th>
                  <th className="py-2.5 px-3">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {db.purchaseReturns.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-slate-500 text-xs">
                      No purchase debit notes posted yet.
                    </td>
                  </tr>
                ) : (
                  db.purchaseReturns.map(dn => (
                    <tr key={dn.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-2.5 px-3 font-mono font-bold text-amber-300">{dn.docNumber}</td>
                      <td className="py-2.5 px-3 text-slate-400 text-[11px]">{new Date(dn.date).toLocaleString()}</td>
                      <td className="py-2.5 px-3 font-mono text-indigo-400">{dn.originalPurchaseDocNumber}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-200">{dn.supplierName}</td>
                      <td className="py-2.5 px-2 text-center font-bold text-slate-300">{dn.lines.length}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-400">
                        ₹{Number(dn.totalDebitAmount).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 text-[11px]">{dn.reason}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Purchase Return Modal */}
      {returnPurchase && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl space-y-4">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-amber-400" />
                  Issue Debit Note for {returnPurchase.docNumber}
                </h3>
                <p className="text-xs text-slate-400">Section 6: Stock-returnable goods create RETURN_OUT movement from warehouse</p>
              </div>
              <button onClick={() => setReturnPurchase(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="px-5 space-y-3 text-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase text-[10px]">
                  <tr>
                    <th className="py-2 px-2">Item</th>
                    <th className="py-2 px-2 text-center">Remaining Returnable</th>
                    <th className="py-2 px-2 text-center">Warehouse Stock</th>
                    <th className="py-2 px-2 text-center">Return Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {Object.values(returnItems).map(it => {
                    const currentWhStock = StockService.getStockBalance(returnPurchase.warehouseId, it.productId);
                    return (
                      <tr key={it.productId}>
                        <td className="py-2 px-2 font-semibold text-slate-200">{it.name}</td>
                        <td className="py-2 px-2 text-center text-amber-400 font-bold">{it.maxReturnable}</td>
                        <td className="py-2 px-2 text-center text-slate-300">{currentWhStock}</td>
                        <td className="py-2 px-2 text-center">
                          <input
                            type="number"
                            min="0"
                            max={Math.min(it.maxReturnable, currentWhStock)}
                            value={it.returnQty}
                            onChange={(e) => {
                              const val = Math.max(0, Number(e.target.value));
                              setReturnItems(prev => ({
                                ...prev,
                                [it.productId]: { ...prev[it.productId], returnQty: val }
                              }));
                            }}
                            className="w-16 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-center font-bold text-slate-100"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Reason for Return</label>
                <input
                  type="text"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                />
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-800 flex justify-end gap-2.5">
              <button
                onClick={() => setReturnPurchase(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitDebitNote}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-lg shadow-indigo-600/30"
              >
                <CheckCircle2 className="w-4 h-4" />
                Confirm & Issue Debit Note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
