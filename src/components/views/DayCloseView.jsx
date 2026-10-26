// DayCloseView: Cash Drawer Shift Management, Reconciliation, Counted Variance Audit, and Closed-Period Security
import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { DayCloseService } from '../../services/dayCloseService';
import {
  Calculator,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  Banknote,
  Receipt,
  FileCheck,
  RotateCcw,
} from 'lucide-react';
import ExportButtons from '../common/ExportButtons.jsx';

export default function DayCloseView() {
  const { db, activeStore, activeWarehouse, currentUser, notify, triggerRefresh } = useApp();

  const activeSession = DayCloseService.getActiveSession(activeStore.id);
  const summary = activeSession ? DayCloseService.getSessionSummary(activeSession.id) : null;

  // New shift / Open day state
  const [openingCash, setOpeningCash] = useState(5000);

  // Close shift state
  const [countedCash, setCountedCash] = useState(0);
  const [closeNotes, setCloseNotes] = useState('');

  // Reopen shift state
  const [reopenReason, setReopenReason] = useState('');
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);

  const handleOpenRegister = (e) => {
    e.preventDefault();
    try {
      const sess = DayCloseService.openSession({
        storeId: activeStore.id,
        warehouseId: activeWarehouse.id,
        openingCash,
        userId: currentUser.id,
      });

      notify('success', `Register session opened with ₹${openingCash} opening float.`, 'Shift Started');
      triggerRefresh();
    } catch (err) {
      notify('error', err.message, 'Register Error');
    }
  };

  const handleCloseDay = (e) => {
    e.preventDefault();
    try {
      const res = DayCloseService.closeSession({
        sessionId: activeSession.id,
        countedCash,
        notes: closeNotes,
        userId: currentUser.id,
      });

      notify('success', res.message, 'Z-Report Finalized');
      triggerRefresh();
    } catch (err) {
      notify('error', err.message, 'Day Close Failed');
    }
  };

  const handleReopenDay = () => {
    try {
      // Find latest closed session
      const lastSession = db.registerSessions.find(s => s.storeId === activeStore.id && s.status === 'CLOSED');
      if (!lastSession) {
        notify('error', 'No closed session found to reopen.', 'Reopen Error');
        return;
      }

      DayCloseService.reopenSession({
        sessionId: lastSession.id,
        reason: reopenReason,
        userRole: currentUser.role,
        userId: currentUser.id,
      });

      notify('success', `Period reopened for ${activeStore.name}. Reason logged in statutory audit.`, 'Register Reopened');
      setIsReopenModalOpen(false);
      setReopenReason('');
      triggerRefresh();
    } catch (err) {
      notify('error', err.message, 'Permission Denied');
    }
  };

  const isDayOpen = activeStore.isDayOpen && activeSession;
  const cashVariance = summary ? Number(countedCash) - summary.expectedCashInDrawer : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
      {/* Status Card */}
      <div className={`border rounded-2xl p-5 shadow-lg flex flex-wrap items-center justify-between gap-4 ${
        isDayOpen
          ? 'bg-gradient-to-r from-slate-900 to-indigo-950/40 border-indigo-500/30'
          : 'bg-gradient-to-r from-slate-900 to-rose-950/40 border-rose-500/30'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-xl border ${
            isDayOpen
              ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800'
              : 'bg-rose-950/80 text-rose-400 border-rose-800'
          }`}>
            {isDayOpen ? <Unlock className="w-6 h-6 animate-pulse" /> : <Lock className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-white tracking-tight">{activeStore.name}</h2>
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                isDayOpen
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  : 'bg-rose-950 text-rose-300 border border-rose-800'
              }`}>
                {isDayOpen ? 'REGISTER OPEN' : 'DAY CLOSED (POSTINGS BLOCKED)'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {isDayOpen
                ? `Session: ${activeSession.id} | Opened: ${new Date(activeSession.openedAt).toLocaleTimeString()}`
                : 'All billing and transactions are strictly blocked until an authorized opening float is committed.'}
            </p>
          </div>
        </div>

        <div>
          {!isDayOpen && (
            <button
              onClick={() => setIsReopenModalOpen(true)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 flex items-center gap-1.5 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reopen Closed Period
            </button>
          )}
        </div>
      </div>

      {!isDayOpen ? (
        /* Open Register Form */
        <form onSubmit={handleOpenRegister} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md max-w-lg mx-auto space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Banknote className="w-5 h-5 text-indigo-400" />
              Open Daily Register & Shift
            </h3>
            <p className="text-xs text-slate-400">Section 14: Set verified opening cash float for drawer tracking</p>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="font-semibold text-slate-300 block mb-1">Opening Cash in Till (₹)</label>
              <input
                type="number"
                min="0"
                step="10"
                value={openingCash}
                onChange={(e) => setOpeningCash(Number(e.target.value))}
                className="w-full bg-slate-950 border border-indigo-500 rounded-xl px-3 py-2 text-white font-mono font-bold text-xl"
              />
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <div>Store Location: <strong className="text-slate-200">{activeStore.name}</strong></div>
              <div>Authorized Cashier / Manager: <strong className="text-slate-200">{currentUser.name} [{currentUser.role}]</strong></div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/30 transition"
          >
            <CheckCircle2 className="w-4 h-4" />
            Commit Opening Float & Enable Billing
          </button>
        </form>
      ) : (
        /* Live Session Reconciliation & Close Shift View */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Live Summary Cards (7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                <span className="font-bold text-white text-sm">Live Shift Tender Breakdown</span>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-slate-400">Invoices: {summary?.invoiceCount} | Returns: {summary?.returnCount}</span>
                  {summary && (
                    <ExportButtons
                      data={[
                        { item: 'Opening Cash in Till', amount: `₹${summary.openingCash.toFixed(2)}`, type: 'Float' },
                        { item: 'Cash Sales Collected', amount: `₹${summary.cashSales.toFixed(2)}`, type: 'Tender' },
                        { item: 'UPI Receipts', amount: `₹${summary.upiSales.toFixed(2)}`, type: 'Tender' },
                        { item: 'Card Swipes', amount: `₹${summary.cardSales.toFixed(2)}`, type: 'Tender' },
                        { item: 'On-Account Customer Credit', amount: `₹${summary.creditSales.toFixed(2)}`, type: 'Tender' },
                        { item: 'Cash Refunds Issued', amount: `₹${summary.cashRefunds.toFixed(2)}`, type: 'Refund' },
                        { item: 'Expected Cash in Drawer', amount: `₹${summary.expectedCashInDrawer.toFixed(2)}`, type: 'Reconciliation' },
                      ]}
                      columns={[
                        { header: 'Tender Item / Metric', key: 'item' },
                        { header: 'Classification', key: 'type' },
                        { header: 'Amount', key: 'amount' }
                      ]}
                      filename={`Shift_Reconciliation_${activeStore.name}_${activeSession?.id}`}
                      title={`Shift Tender Breakdown & Drawer Reconciliation`}
                      subtitle={`Branch: ${activeStore.name} | Session: ${activeSession?.id}`}
                      size="small"
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase">Cash Sales</div>
                  <div className="font-mono font-bold text-emerald-400 text-sm">₹{summary?.cashSales.toFixed(2)}</div>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase">UPI Receipts</div>
                  <div className="font-mono font-bold text-blue-400 text-sm">₹{summary?.upiSales.toFixed(2)}</div>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase">Card Swipes</div>
                  <div className="font-mono font-bold text-purple-400 text-sm">₹{summary?.cardSales.toFixed(2)}</div>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase">On-Account Credit</div>
                  <div className="font-mono font-bold text-amber-400 text-sm">₹{summary?.creditSales.toFixed(2)}</div>
                </div>
              </div>

              {/* Cash Reconciliation Formula Box */}
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs space-y-1.5 font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>Opening Cash in Drawer:</span>
                  <span>₹{summary?.openingCash.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-400">
                  <span>(+) Cash Receipts from Sales:</span>
                  <span>+₹{summary?.cashSales.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-rose-400">
                  <span>(-) Cash Refunds Issued:</span>
                  <span>-₹{summary?.cashRefunds.toFixed(2)}</span>
                </div>
                <div className="border-t border-slate-800 pt-1.5 flex justify-between font-bold text-white text-sm">
                  <span>(=) Expected Cash in Drawer:</span>
                  <span className="text-indigo-400">₹{summary?.expectedCashInDrawer.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Close Shift / Z-Report Form (5 Cols) */}
          <div className="lg:col-span-5">
            <form onSubmit={handleCloseDay} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md space-y-3">
              <div className="border-b border-slate-800 pb-2">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-indigo-400" />
                  Finalize Day Close & Print Z-Report
                </h3>
                <p className="text-[11px] text-slate-400">Section 14: Count actual physical cash and record variance</p>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">
                    Counted Physical Cash in Drawer (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={countedCash}
                    onChange={(e) => setCountedCash(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-indigo-500 rounded-xl px-3 py-2 text-white font-mono font-bold text-xl"
                  />
                </div>

                {/* Variance Display */}
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center font-mono">
                  <span className="text-slate-400 text-xs">Counted Cash Variance:</span>
                  <span className={`text-base font-black ${
                    cashVariance === 0 ? 'text-emerald-400' : cashVariance > 0 ? 'text-blue-400' : 'text-rose-400'
                  }`}>
                    {cashVariance === 0 ? '₹0.00 (Balanced)' : `₹${cashVariance.toFixed(2)} (${cashVariance > 0 ? 'Surplus' : 'Shortage'})`}
                  </span>
                </div>

                <div>
                  <label className="font-semibold text-slate-400 block mb-1">Day Close Notes</label>
                  <input
                    type="text"
                    placeholder="e.g. Evening shift close, cash counted by Priya & Manager"
                    value={closeNotes}
                    onChange={(e) => setCloseNotes(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-rose-600/30 transition"
              >
                <Lock className="w-4 h-4" />
                Commit Day Close & Lock Period
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Register Sessions & Z-Report History Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h4 className="font-bold text-white text-sm flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-indigo-400" />
              Register Sessions & Shift History (Z-Reports)
            </h4>
            <p className="text-[11px] text-slate-400">
              Audit log of register openings, closures, counted cash, and reconciliation variances
            </p>
          </div>
          <ExportButtons
            data={db.registerSessions || []}
            columns={[
              { header: 'Session ID', key: 'id' },
              { header: 'Store', key: 'storeId', format: (id) => db.stores?.find(s => s.id === id)?.name || id },
              { header: 'Status', key: 'status' },
              { header: 'Opened At', key: 'openedAt', format: (d) => d ? new Date(d).toLocaleString() : '' },
              { header: 'Opening Float (₹)', key: 'openingCash', format: (v) => `₹${Number(v || 0).toFixed(2)}` },
              { header: 'Closed At', key: 'closedAt', format: (d) => d ? new Date(d).toLocaleString() : 'Active' },
              { header: 'Counted Cash (₹)', key: 'countedCash', format: (v) => `₹${Number(v || 0).toFixed(2)}` },
              { header: 'Cash Variance (₹)', key: 'cashVariance', format: (v) => `₹${Number(v || 0).toFixed(2)}` },
              { header: 'Notes', key: 'notes' }
            ]}
            filename={`Register_Sessions_Archive_${activeStore.name}`}
            title="Register Shift & Z-Report Archive"
            subtitle={`Store: ${activeStore.name} | Total Sessions: ${db.registerSessions?.length || 0}`}
            size="small"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[750px]">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Session ID</th>
                <th className="py-2.5 px-3">Opened</th>
                <th className="py-2.5 px-3">Opening Float</th>
                <th className="py-2.5 px-3">Closed</th>
                <th className="py-2.5 px-3">Counted Cash</th>
                <th className="py-2.5 px-3">Variance</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {(db.registerSessions || []).length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-6 text-center text-slate-500">
                    No register sessions recorded yet.
                  </td>
                </tr>
              ) : (
                db.registerSessions.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-850/50 transition">
                    <td className="py-2.5 px-3 font-mono font-bold text-indigo-300">{s.id}</td>
                    <td className="py-2.5 px-3 text-slate-400 text-[11px]">{new Date(s.openedAt).toLocaleString()}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-200">₹{Number(s.openingCash || 0).toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-slate-400 text-[11px]">{s.closedAt ? new Date(s.closedAt).toLocaleString() : 'In Progress'}</td>
                    <td className="py-2.5 px-3 font-mono text-emerald-400 font-semibold">₹{Number(s.countedCash || 0).toFixed(2)}</td>
                    <td className="py-2.5 px-3 font-mono font-bold">
                      <span className={s.cashVariance === 0 ? 'text-emerald-400' : s.cashVariance > 0 ? 'text-blue-400' : 'text-rose-400'}>
                        ₹{Number(s.cashVariance || 0).toFixed(2)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        s.status === 'OPEN'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 text-[11px] max-w-xs truncate">{s.notes}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reopen Session Modal */}
      {isReopenModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div>
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-amber-400" />
                Reopen Closed Register Period
              </h3>
              <p className="text-xs text-slate-400">Requires Store Manager or Company Admin authorization</p>
            </div>

            <div className="space-y-2 text-xs">
              <label className="font-semibold text-slate-300 block">Statutory Justification Reason *</label>
              <textarea
                rows="3"
                required
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="e.g. Audit correction authorized by Store Manager Anil Kapoor..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsReopenModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReopenDay}
                disabled={!reopenReason.trim()}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs flex items-center gap-1.5"
              >
                <Unlock className="w-4 h-4" />
                Authorize & Reopen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
