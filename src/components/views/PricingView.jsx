// PricingView: Rate Changes, Selling Rate vs MRP Statutory Validation, and Historical Invoice Immunity
import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { RateChangeService } from '../../services/rateChangeService';
import {
  Tag,
  Plus,
  CheckCircle2,
  AlertTriangle,
  History,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import ExportButtons from '../common/ExportButtons.jsx';

export default function PricingView() {
  const { db, currentUser, notify, triggerRefresh } = useApp();

  const [activeTab, setActiveTab] = useState('list'); // list | propose | history
  const [selectedProductId, setSelectedProductId] = useState('PROD-001');
  const [newSellingRate, setNewSellingRate] = useState(440);
  const [reason, setReason] = useState('Supplier wholesale cost increase');

  const product = db.products.find(p => p.id === selectedProductId) || db.products[0];

  const handleProposeRate = (e) => {
    e.preventDefault();
    try {
      const res = RateChangeService.proposeRateChange({
        productId: selectedProductId,
        newSellingRate,
        reason,
        userRole: currentUser.role,
        userId: currentUser.id,
      });

      if (res.status === 'PENDING_APPROVAL') {
        notify('warning', `Rate proposal ${res.docNumber} queued for Store Manager approval.`, 'Pending Approval');
      } else {
        notify('success', `Rate change ${res.docNumber} applied! ${product.name} is now ₹${newSellingRate}.`, 'Rate Updated');
      }

      triggerRefresh();
      setActiveTab('list');
    } catch (err) {
      notify('error', err.message, 'Price Rule Violation');
    }
  };

  const handleApproveRate = (proposalId) => {
    try {
      const res = RateChangeService.approveRateChange(proposalId, currentUser.id);
      notify('success', `Rate change proposal ${res.docNumber} approved by manager!`, 'Approved');
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
            <Tag className="w-3.5 h-3.5" />
            <span>Product Pricing Catalog ({db.products.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('propose')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              activeTab === 'propose' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Propose Rate Change</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              activeTab === 'history' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Rate Change Audit Logs ({db.rateChanges.length})</span>
          </button>
        </div>

        {activeTab !== 'propose' && (
          <ExportButtons
            data={
              activeTab === 'list'
                ? db.products.map((p, idx) => {
                    const margin = (((p.sellingRate - p.costRate) / p.sellingRate) * 100).toFixed(1);
                    return {
                      '#': idx + 1,
                      'Product Name': p.name,
                      'SKU': p.sku,
                      'Cost Price (WAC)': `₹${p.costRate?.toFixed(2)}`,
                      'MRP': `₹${p.mrp?.toFixed(2)}`,
                      'Active Selling Rate': `₹${p.sellingRate?.toFixed(2)}`,
                      'GST %': `${p.taxRate}%`,
                      'Statutory Margin %': `${margin}%`
                    };
                  })
                : db.rateChanges.map((rc, idx) => ({
                    '#': idx + 1,
                    'Proposal #': rc.docNumber,
                    'Date & Time': new Date(rc.createdAt).toLocaleString(),
                    'Product Name': rc.productName,
                    'Old Rate': `₹${rc.oldRate}`,
                    'New Rate': `₹${rc.newRate}`,
                    'MRP': `₹${rc.mrp}`,
                    'Reason': rc.reason,
                    'Status': rc.status
                  }))
            }
            filename={activeTab === 'list' ? 'PRICE_LIST_RATES' : 'RATE_CHANGE_AUDIT_LOGS'}
            title={activeTab === 'list' ? 'PRODUCT PRICE LIST & MARGIN ANALYSIS' : 'RATE CHANGE APPROVAL AUDIT TRAIL'}
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
                  <th className="py-2.5 px-3">Product Name</th>
                  <th className="py-2.5 px-3">SKU</th>
                  <th className="py-2.5 px-3 text-right">Cost Price (WAC)</th>
                  <th className="py-2.5 px-3 text-right">Maximum Retail Price (MRP)</th>
                  <th className="py-2.5 px-3 text-right">Active Selling Rate</th>
                  <th className="py-2.5 px-2 text-center">GST %</th>
                  <th className="py-2.5 px-3 text-center">Statutory Margin</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {db.products.map(p => {
                  const margin = (((p.sellingRate - p.costRate) / p.sellingRate) * 100).toFixed(1);
                  return (
                    <tr key={p.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-2.5 px-3 font-semibold text-slate-200">{p.name}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-400">{p.sku}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-400">₹{p.costRate.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-300">₹{p.mrp.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400 text-sm">
                        ₹{p.sellingRate.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-2 text-center text-slate-300">{p.taxRate}%</td>
                      <td className="py-2.5 px-3 text-center font-mono text-indigo-300 font-semibold">{margin}%</td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => {
                            setSelectedProductId(p.id);
                            setNewSellingRate(p.sellingRate);
                            setActiveTab('propose');
                          }}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded text-[11px] font-semibold transition"
                        >
                          Change Rate
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'propose' && (
        <form onSubmit={handleProposeRate} className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-md space-y-4 max-w-xl mx-auto">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="font-bold text-white text-base">Propose Selling Rate Change (Section 11)</h3>
            <p className="text-xs text-slate-400">Strict Rule: Selling rate can NEVER exceed Maximum Retail Price (MRP)</p>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="font-semibold text-slate-400 block mb-1">Select Product</label>
              <select
                value={selectedProductId}
                onChange={(e) => {
                  setSelectedProductId(e.target.value);
                  const p = db.products.find(prod => prod.id === e.target.value);
                  if (p) setNewSellingRate(p.sellingRate);
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-200"
              >
                {db.products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} (MRP: ₹{p.mrp})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4 bg-slate-950 p-3 rounded-xl border border-slate-800">
              <div>
                <span className="text-slate-400 text-[11px]">Current Selling Rate:</span>
                <div className="text-xl font-black font-mono text-slate-200">₹{product.sellingRate}</div>
              </div>

              <div>
                <span className="text-slate-400 text-[11px]">Maximum Retail Price (MRP):</span>
                <div className="text-xl font-black font-mono text-amber-400">₹{product.mrp}</div>
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-300 block mb-1">Proposed New Selling Rate (₹)</label>
              <input
                type="number"
                min="1"
                step="0.01"
                value={newSellingRate}
                onChange={(e) => setNewSellingRate(Number(e.target.value))}
                className="w-full bg-slate-950 border border-indigo-500 rounded-lg px-3 py-2 text-white font-mono font-bold text-lg"
              />
              {newSellingRate > product.mrp && (
                <div className="mt-1.5 text-xs text-rose-400 flex items-center gap-1 font-semibold">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  Statutory Violation: Proposed rate ₹{newSellingRate} exceeds product MRP ₹{product.mrp}! Submitting will be blocked.
                </div>
              )}
            </div>

            <div>
              <label className="font-semibold text-slate-400 block mb-1">Reason for Price Adjustment</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
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
              disabled={newSellingRate > product.mrp}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-lg shadow-indigo-600/30"
            >
              <CheckCircle2 className="w-4 h-4" />
              Propose & Commit Rate
            </button>
          </div>
        </form>
      )}

      {activeTab === 'history' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[750px]">
              <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Proposal #</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Product Name</th>
                  <th className="py-2.5 px-3 text-right">Old Rate</th>
                  <th className="py-2.5 px-3 text-right">New Rate</th>
                  <th className="py-2.5 px-3 text-right">MRP</th>
                  <th className="py-2.5 px-3">Reason</th>
                  <th className="py-2.5 px-2 text-center">Status</th>
                  <th className="py-2.5 px-3 text-center">Approval Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {db.rateChanges.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="py-8 text-center text-slate-500 text-xs">
                      No rate changes recorded yet.
                    </td>
                  </tr>
                ) : (
                  db.rateChanges.map(rc => (
                    <tr key={rc.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-2.5 px-3 font-mono font-bold text-indigo-300">{rc.docNumber}</td>
                      <td className="py-2.5 px-3 text-slate-400 text-[11px]">{new Date(rc.createdAt).toLocaleString()}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-200">{rc.productName}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-400">₹{rc.oldRate}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">₹{rc.newRate}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-amber-300">₹{rc.mrp}</td>
                      <td className="py-2.5 px-3 text-slate-400 text-[11px]">{rc.reason}</td>
                      <td className="py-2.5 px-2 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          rc.status === 'APPROVED'
                            ? 'bg-emerald-950/70 text-emerald-400 border border-emerald-800/40'
                            : 'bg-amber-950/70 text-amber-400 border border-amber-800/40'
                        }`}>
                          {rc.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {rc.status === 'PENDING_APPROVAL' && (
                          canApprove ? (
                            <button
                              onClick={() => handleApproveRate(rc.id)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-semibold mx-auto transition"
                            >
                              Approve
                            </button>
                          ) : (
                            <span className="text-[10px] text-amber-400 italic">Needs Manager</span>
                          )
                        )}
                        {rc.status === 'APPROVED' && (
                          <span className="text-slate-500 text-[11px]">Enforced</span>
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
    </div>
  );
}
