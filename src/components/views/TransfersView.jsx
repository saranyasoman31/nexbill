// TransfersView: Inter-Warehouse & Inter-Store Stock Transfers with In-Transit & Variance Reconciliation
import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { StockTransferService } from '../../services/stockTransferService';
import { StockService } from '../../services/stockService';
import {
  ArrowLeftRight,
  Plus,
  Send,
  CheckCircle,
  AlertTriangle,
  Clock,
  Warehouse,
  CheckCircle2,
} from 'lucide-react';
import ExportButtons from '../common/ExportButtons.jsx';

export default function TransfersView() {
  const { db, activeCompany, activeStore, activeWarehouse, currentUser, notify, triggerRefresh } = useApp();

  const [activeTab, setActiveTab] = useState('list'); // list | new
  const [sourceWarehouseId, setSourceWarehouseId] = useState(activeWarehouse.id);
  const [destinationWarehouseId, setDestinationWarehouseId] = useState('WH-MUM-FRONT');
  const [transferLines, setTransferLines] = useState([
    { productId: 'PROD-001', qty: 5 }
  ]);
  const [notes, setNotes] = useState('');

  // Receive transfer state
  const [receivingTransfer, setReceivingTransfer] = useState(null);
  const [receiptQuantities, setReceiptQuantities] = useState({});

  const handleCreateTransfer = (e) => {
    e.preventDefault();
    try {
      const res = StockTransferService.createTransfer({
        sourceWarehouseId,
        destinationWarehouseId,
        companyId: activeCompany.id,
        items: transferLines.map(l => ({ productId: l.productId, qty: Number(l.qty) })),
        notes,
        userId: currentUser.id,
      });

      notify('success', `Transfer ${res.docNumber} created and approved for dispatch.`, 'Transfer Created');
      triggerRefresh();
      setActiveTab('list');
    } catch (err) {
      notify('error', err.message, 'Transfer Error');
    }
  };

  const handleDispatch = (transferId) => {
    try {
      const trf = StockTransferService.dispatchTransfer(transferId, currentUser.id);
      notify('success', `Transfer ${trf.docNumber} dispatched! Source stock deducted, in-transit active.`, 'Dispatched');
      triggerRefresh();
    } catch (err) {
      notify('error', err.message, 'Dispatch Blocked');
    }
  };

  const handleStartReceive = (trf) => {
    const initReceipt = {};
    trf.lines.forEach(l => {
      initReceipt[l.productId] = {
        productId: l.productId,
        productName: l.productName,
        dispatchedQty: l.dispatchedQty,
        receivedQty: l.dispatchedQty,
        damagedQty: 0,
      };
    });
    setReceiptQuantities(initReceipt);
    setReceivingTransfer(trf);
  };

  const handleConfirmReceive = () => {
    try {
      const receiptLines = Object.values(receiptQuantities).map(r => ({
        productId: r.productId,
        receivedQty: Number(r.receivedQty || 0),
        damagedQty: Number(r.damagedQty || 0),
      }));

      const res = StockTransferService.receiveTransfer(receivingTransfer.id, receiptLines, currentUser.id);
      notify('success', `Transfer ${res.docNumber} received at destination warehouse. Closed with verified variance.`, 'Transfer Received');
      triggerRefresh();
      setReceivingTransfer(null);
    } catch (err) {
      notify('error', err.message, 'Receipt Failed');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
      {/* Top Bar */}
      <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-3 rounded-xl shadow-md">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              activeTab === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>Transfers History ({db.stockTransfers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('new')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              activeTab === 'new' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Stock Transfer Order</span>
          </button>
        </div>

        {activeTab === 'list' && (
          <ExportButtons
            data={db.stockTransfers.map((trf, idx) => ({
              '#': idx + 1,
              'Transfer #': trf.docNumber,
              'Date & Time': new Date(trf.createdAt).toLocaleString(),
              'Source Warehouse': db.warehouses.find(w => w.id === trf.sourceWarehouseId)?.name || trf.sourceWarehouseId,
              'Destination Warehouse': db.warehouses.find(w => w.id === trf.destinationWarehouseId)?.name || trf.destinationWarehouseId,
              'Items Count': trf.items?.length || 0,
              'Status': trf.status,
              'Notes': trf.notes || ''
            }))}
            filename="STOCK_TRANSFERS_LOG"
            title="INTER-WAREHOUSE STOCK TRANSFERS REGISTER"
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
                  <th className="py-2.5 px-3">Transfer #</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Source Warehouse</th>
                  <th className="py-2.5 px-3">Destination Warehouse</th>
                  <th className="py-2.5 px-2 text-center">Items</th>
                  <th className="py-2.5 px-2 text-center">Status</th>
                  <th className="py-2.5 px-3">Variance / Details</th>
                  <th className="py-2.5 px-3 text-center">Workflow Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {db.stockTransfers.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-8 text-center text-slate-500 text-xs">
                      No stock transfers recorded yet.
                    </td>
                  </tr>
                ) : (
                  db.stockTransfers.map(trf => (
                    <tr key={trf.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-2.5 px-3 font-mono font-bold text-indigo-300">{trf.docNumber}</td>
                      <td className="py-2.5 px-3 text-slate-400 text-[11px]">{new Date(trf.createdAt || trf.dispatchedAt).toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-slate-200 font-medium">
                        {db.warehouses.find(w => w.id === trf.sourceWarehouseId)?.name || trf.sourceWarehouseId}
                      </td>
                      <td className="py-2.5 px-3 text-slate-200 font-medium">
                        {db.warehouses.find(w => w.id === trf.destinationWarehouseId)?.name || trf.destinationWarehouseId}
                      </td>
                      <td className="py-2.5 px-2 text-center font-bold text-slate-300">{trf.lines.length}</td>
                      <td className="py-2.5 px-2 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          trf.status === 'CLOSED' || trf.status === 'RECEIVED'
                            ? 'bg-emerald-950/70 text-emerald-400 border border-emerald-800/40'
                            : trf.status === 'DISPATCHED'
                            ? 'bg-blue-950/70 text-blue-400 border border-blue-800/40'
                            : 'bg-amber-950/70 text-amber-400 border border-amber-800/40'
                        }`}>
                          {trf.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                        {trf.lines.map(l => (
                          <div key={l.productId}>
                            {l.productName}: Disp {l.dispatchedQty || l.requestedQty}, Recv {l.receivedQty || 0}
                            {l.damagedQty > 0 && <span className="text-amber-400 ml-1">({l.damagedQty} damaged)</span>}
                            {l.variance > 0 && <span className="text-rose-400 ml-1">({l.variance} shortage)</span>}
                          </div>
                        ))}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {trf.status === 'APPROVED' && (
                          <button
                            onClick={() => handleDispatch(trf.id)}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-semibold flex items-center gap-1 mx-auto transition"
                          >
                            <Send className="w-3 h-3" /> Dispatch Stock
                          </button>
                        )}
                        {trf.status === 'DISPATCHED' && (
                          <button
                            onClick={() => handleStartReceive(trf)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-semibold flex items-center gap-1 mx-auto transition"
                          >
                            <CheckCircle className="w-3 h-3" /> Receive & Check
                          </button>
                        )}
                        {(trf.status === 'RECEIVED' || trf.status === 'CLOSED') && (
                          <span className="text-emerald-400 text-[11px] flex items-center justify-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Finalized
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
      )}

      {activeTab === 'new' && (
        <form onSubmit={handleCreateTransfer} className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-md space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="font-bold text-white text-base">Create Stock Transfer (Section 8)</h3>
            <p className="text-xs text-slate-400">Strict multi-stage workflow: Draft → Approved → Dispatched (in-transit) → Received with variance handling</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-semibold text-slate-400 block mb-1">Source Warehouse (Dispatch From)</label>
              <select
                value={sourceWarehouseId}
                onChange={(e) => setSourceWarehouseId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-200"
              >
                {db.warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name} ({w.storeId})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-400 block mb-1">Destination Warehouse (Deliver To)</label>
              <select
                value={destinationWarehouseId}
                onChange={(e) => setDestinationWarehouseId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-200"
              >
                {db.warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name} ({w.storeId})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Transfer items */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-300">Transfer Quantities</span>
            {transferLines.map((line, idx) => {
              const currentSrcStock = StockService.getStockBalance(sourceWarehouseId, line.productId);
              return (
                <div key={idx} className="flex items-center gap-3 bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-xs">
                  <div className="flex-1">
                    <select
                      value={line.productId}
                      onChange={(e) => {
                        const next = [...transferLines];
                        next[idx].productId = e.target.value;
                        setTransferLines(next);
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-200"
                    >
                      {db.products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                      ))}
                    </select>
                  </div>

                  <div className="text-slate-400 w-36 text-[11px]">
                    Available in source: <span className="text-emerald-400 font-bold">{currentSrcStock}</span>
                  </div>

                  <div className="w-24">
                    <input
                      type="number"
                      min="1"
                      max={currentSrcStock}
                      value={line.qty}
                      onChange={(e) => {
                        const next = [...transferLines];
                        next[idx].qty = e.target.value;
                        setTransferLines(next);
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center font-bold text-slate-100"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">Transfer Reason / Notes</label>
            <input
              type="text"
              placeholder="e.g. Weekly counter stock replenishment"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
            />
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
              Approve & Create Transfer
            </button>
          </div>
        </form>
      )}

      {/* Destination Receive & Variance Verification Modal */}
      {receivingTransfer && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl space-y-4">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-base">Receive Transfer {receivingTransfer.docNumber}</h3>
                <p className="text-xs text-slate-400">Verify accepted units vs damaged in-transit goods</p>
              </div>
              <button onClick={() => setReceivingTransfer(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="px-5 space-y-3 text-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase text-[10px]">
                  <tr>
                    <th className="py-2 px-2">Item</th>
                    <th className="py-2 px-2 text-center">Dispatched</th>
                    <th className="py-2 px-2 text-center">Accepted</th>
                    <th className="py-2 px-2 text-center">Damaged / Quarantine</th>
                    <th className="py-2 px-2 text-center">Shortage Variance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {Object.values(receiptQuantities).map(r => {
                    const disp = Number(r.dispatchedQty || 0);
                    const acc = Number(r.receivedQty || 0);
                    const dmg = Number(r.damagedQty || 0);
                    const shortage = disp - (acc + dmg);
                    return (
                      <tr key={r.productId}>
                        <td className="py-2 px-2 font-semibold text-slate-200">{r.productName}</td>
                        <td className="py-2 px-2 text-center font-bold text-slate-300">{disp}</td>
                        <td className="py-2 px-2 text-center">
                          <input
                            type="number"
                            min="0"
                            max={disp}
                            value={r.receivedQty}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setReceiptQuantities(prev => ({
                                ...prev,
                                [r.productId]: { ...prev[r.productId], receivedQty: val }
                              }));
                            }}
                            className="w-16 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-center font-bold text-emerald-400"
                          />
                        </td>
                        <td className="py-2 px-2 text-center">
                          <input
                            type="number"
                            min="0"
                            max={disp - acc}
                            value={r.damagedQty}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setReceiptQuantities(prev => ({
                                ...prev,
                                [r.productId]: { ...prev[r.productId], damagedQty: val }
                              }));
                            }}
                            className="w-16 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-center font-bold text-amber-400"
                          />
                        </td>
                        <td className="py-2 px-2 text-center font-mono font-bold text-rose-400">
                          {shortage > 0 ? `${shortage} units` : '0'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-5 py-3 border-t border-slate-800 flex justify-end gap-2.5">
              <button
                onClick={() => setReceivingTransfer(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReceive}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-lg shadow-indigo-600/30"
              >
                <CheckCircle2 className="w-4 h-4" />
                Confirm Receipt & Close Transfer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
