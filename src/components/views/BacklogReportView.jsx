// BacklogReportView: Enterprise Audit Backlog & Operation Tracking Report
// Records and displays: Which User, Which Time, Which IP Address, Which Form, for SAVE, UPDATE, DELETE, and CANCEL operations.
import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { getClientIp, setClientIp } from '../../services/storageService.js';
import {
  ShieldAlert,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  User,
  Monitor,
  Calendar,
  Layers,
  FileSpreadsheet,
  DownloadCloud,
  Printer,
  X,
  Eye,
  RefreshCw,
  PlusCircle,
  Edit,
  Trash2,
  Ban,
  Activity,
  Network,
} from 'lucide-react';
import ExportButtons from '../common/ExportButtons.jsx';

export default function BacklogReportView() {
  const { db, notify, currentUser } = useApp();

  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL'); // ALL | SAVE | UPDATE | DELETE | CANCEL
  const [formFilter, setFormFilter] = useState('ALL');
  const [userFilter, setUserFilter] = useState('ALL');
  const [periodFilter, setPeriodFilter] = useState('ALL'); // ALL | TODAY | 7DAYS | MONTH
  const [selectedLog, setSelectedLog] = useState(null);

  const [currentStationIp, setCurrentStationIp] = useState(getClientIp());
  const [isEditingIp, setIsEditingIp] = useState(false);
  const [tempIp, setTempIp] = useState(currentStationIp);

  const handleUpdateIp = (e) => {
    e.preventDefault();
    if (!tempIp.trim()) return;
    setClientIp(tempIp.trim());
    setCurrentStationIp(tempIp.trim());
    setIsEditingIp(false);
    notify('success', `Terminal station IP updated to ${tempIp.trim()}`, 'IP Updated');
  };

  const backlogList = db.backlog || [];

  // Extract distinct form names for dropdown
  const distinctForms = useMemo(() => {
    const set = new Set();
    backlogList.forEach((b) => {
      if (b.formName) set.add(b.formName);
    });
    return Array.from(set).sort();
  }, [backlogList]);

  // Extract distinct users for dropdown
  const distinctUsers = useMemo(() => {
    const map = new Map();
    backlogList.forEach((b) => {
      if (b.userId && !map.has(b.userId)) {
        map.set(b.userId, b.userName || b.userId);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [backlogList]);

  // Filtered backlog logs
  const filteredBacklog = useMemo(() => {
    return backlogList.filter((item) => {
      // 1. Text Search (user, IP, form, recordRef, details)
      const q = search.trim().toLowerCase();
      if (q) {
        const matchUser = (item.userName || '').toLowerCase().includes(q) || (item.userId || '').toLowerCase().includes(q);
        const matchIp = (item.ipAddress || '').toLowerCase().includes(q);
        const matchForm = (item.formName || '').toLowerCase().includes(q);
        const matchRef = (item.recordRef || '').toLowerCase().includes(q);
        const matchDetails = (item.details || '').toLowerCase().includes(q);
        const matchAction = (item.action || '').toLowerCase().includes(q);
        if (!matchUser && !matchIp && !matchForm && !matchRef && !matchDetails && !matchAction) {
          return false;
        }
      }

      // 2. Action Filter (SAVE | UPDATE | DELETE | CANCEL)
      if (actionFilter !== 'ALL' && item.action !== actionFilter) {
        return false;
      }

      // 3. Form Filter
      if (formFilter !== 'ALL' && item.formName !== formFilter) {
        return false;
      }

      // 4. User Filter
      if (userFilter !== 'ALL' && item.userId !== userFilter) {
        return false;
      }

      // 5. Period Filter
      if (periodFilter !== 'ALL') {
        const itemDate = new Date(item.timestamp);
        const now = new Date();
        if (periodFilter === 'TODAY') {
          const isToday = itemDate.toDateString() === now.toDateString();
          if (!isToday) return false;
        } else if (periodFilter === '7DAYS') {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
          if (itemDate < sevenDaysAgo) return false;
        } else if (periodFilter === 'MONTH') {
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
          if (itemDate < thirtyDaysAgo) return false;
        }
      }

      return true;
    });
  }, [backlogList, search, actionFilter, formFilter, userFilter, periodFilter]);

  // KPI Calculations
  const stats = useMemo(() => {
    let saves = 0;
    let updates = 0;
    let deletes = 0;
    let cancels = 0;

    backlogList.forEach((b) => {
      if (b.action === 'SAVE') saves++;
      else if (b.action === 'UPDATE') updates++;
      else if (b.action === 'DELETE') deletes++;
      else if (b.action === 'CANCEL') cancels++;
    });

    return {
      total: backlogList.length,
      saves,
      updates,
      deletes,
      cancels,
    };
  }, [backlogList]);

  // Action badge renderer
  const renderActionBadge = (action) => {
    switch (action) {
      case 'SAVE':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800/80 inline-flex items-center gap-1">
            <PlusCircle className="w-3 h-3 text-emerald-400" />
            SAVE
          </span>
        );
      case 'UPDATE':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800/80 inline-flex items-center gap-1">
            <Edit className="w-3 h-3 text-amber-400" />
            UPDATE
          </span>
        );
      case 'DELETE':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800/80 inline-flex items-center gap-1">
            <Trash2 className="w-3 h-3 text-rose-400" />
            DELETE
          </span>
        );
      case 'CANCEL':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-800/80 inline-flex items-center gap-1">
            <Ban className="w-3 h-3 text-purple-400" />
            CANCEL
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
            {action}
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
      {/* Top Header Card */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-3 sm:p-3.5 rounded-xl shadow-md">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 shrink-0">
            <Activity className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-white text-sm truncate sm:overflow-visible">Operation Backlog & Audit Trail Report</h3>
            <p className="text-[11px] text-slate-400 line-clamp-1 sm:line-clamp-none">
              Complete transaction audit: records User, Timestamp, Client IP Address, Form, and Action (SAVE, UPDATE, DELETE, CANCEL)
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2 text-xs">
          {/* Station IP Badge & Editor */}
          <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 font-mono text-[11px]">
            <Network className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-slate-400 font-sans">Station IP:</span>
            {isEditingIp ? (
              <form onSubmit={handleUpdateIp} className="flex items-center gap-1">
                <input
                  type="text"
                  value={tempIp}
                  onChange={(e) => setTempIp(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-slate-100 text-xs w-28 focus:outline-none focus:border-indigo-500"
                />
                <button type="submit" className="text-emerald-400 hover:text-emerald-300 text-xs font-bold px-1">
                  ✓
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingIp(false)}
                  className="text-slate-500 hover:text-white text-xs px-1"
                >
                  ✕
                </button>
              </form>
            ) : (
              <span
                onClick={() => setIsEditingIp(true)}
                className="font-bold text-emerald-400 cursor-pointer hover:underline"
                title="Click to customize terminal IP"
              >
                {currentStationIp}
              </span>
            )}
          </div>

          <ExportButtons
            data={filteredBacklog.map((item, idx) => ({
              '#': idx + 1,
              'Timestamp': new Date(item.timestamp).toLocaleString(),
              'User Name': item.userName,
              'User ID': item.userId,
              'User Role': item.userRole,
              'Client IP Address': item.ipAddress,
              'Form Name': item.formName,
              'Action': item.action,
              'Record Reference': item.recordRef,
              'Audit Description': item.details,
            }))}
            filename="OPERATION_BACKLOG_AUDIT_REPORT"
            title="OPERATION BACKLOG & AUDIT REPORT (SAVE / UPDATE / DELETE / CANCEL)"
            pdfOrientation="landscape"
          />
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-sm">
          <div className="text-[10px] text-slate-400 uppercase font-bold flex items-center justify-between">
            <span>Total Actions</span>
            <Activity className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white mt-1">{stats.total}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Tracked operations</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-sm">
          <div className="text-[10px] text-emerald-400 uppercase font-bold flex items-center justify-between">
            <span>Saves / Creates</span>
            <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-300 mt-1">{stats.saves}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">New records added</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-sm">
          <div className="text-[10px] text-amber-400 uppercase font-bold flex items-center justify-between">
            <span>Updates / Edits</span>
            <Edit className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl font-bold font-mono text-amber-300 mt-1">{stats.updates}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Record modifications</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-sm">
          <div className="text-[10px] text-rose-400 uppercase font-bold flex items-center justify-between">
            <span>Deletions</span>
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-xl font-bold font-mono text-rose-300 mt-1">{stats.deletes}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Records removed</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-sm col-span-2 md:col-span-1">
          <div className="text-[10px] text-purple-400 uppercase font-bold flex items-center justify-between">
            <span>Cancellations</span>
            <Ban className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-xl font-bold font-mono text-purple-300 mt-1">{stats.cancels}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Orders & items cancelled</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2.5 shadow-sm text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Action Tabs */}
          <div className="flex bg-slate-950 border border-slate-800 rounded-lg p-0.5">
            {['ALL', 'SAVE', 'UPDATE', 'DELETE', 'CANCEL'].map((act) => (
              <button
                key={act}
                onClick={() => setActionFilter(act)}
                className={`px-3 py-1 rounded text-[11px] font-bold transition ${
                  actionFilter === act
                    ? act === 'SAVE'
                      ? 'bg-emerald-600 text-white'
                      : act === 'UPDATE'
                      ? 'bg-amber-600 text-white'
                      : act === 'DELETE'
                      ? 'bg-rose-600 text-white'
                      : act === 'CANCEL'
                      ? 'bg-purple-600 text-white'
                      : 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {act}
              </button>
            ))}
          </div>

          {/* Period Filter */}
          <div className="flex bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-[11px]">
            {[
              { id: 'ALL', label: 'All Time' },
              { id: 'TODAY', label: 'Today' },
              { id: '7DAYS', label: 'Last 7 Days' },
              { id: 'MONTH', label: 'This Month' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriodFilter(p.id)}
                className={`px-2.5 py-1 rounded font-semibold transition ${
                  periodFilter === p.id ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dropdowns & Search Input */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 pt-2 border-t border-slate-800/70">
          {/* Search Input */}
          <div className="relative md:col-span-2">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search user, IP address, form name, record reference, or keywords..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Form Dropdown */}
          <div>
            <select
              value={formFilter}
              onChange={(e) => setFormFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Forms / Modules</option>
              {distinctForms.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          {/* User Dropdown */}
          <div>
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Authorized Users</option>
              {distinctUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.id})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Backlog Records Data Grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[750px]">
            <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3 text-center w-8">#</th>
                <th className="py-2.5 px-3">Date & Time</th>
                <th className="py-2.5 px-3">Authorized User</th>
                <th className="py-2.5 px-3 font-mono">Client IP Address</th>
                <th className="py-2.5 px-3">Form / Module</th>
                <th className="py-2.5 px-3 text-center">Action</th>
                <th className="py-2.5 px-3 font-mono">Record Ref</th>
                <th className="py-2.5 px-3">Audit Details & Context</th>
                <th className="py-2.5 px-2 text-center w-12">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {filteredBacklog.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-10 text-center text-slate-500 font-sans italic">
                    No backlog operations matching the specified filters.
                  </td>
                </tr>
              ) : (
                filteredBacklog.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-2.5 px-3 text-center text-slate-500">{idx + 1}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-300 font-sans">
                      <div>{new Date(item.timestamp).toLocaleDateString()}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{new Date(item.timestamp).toLocaleTimeString()}</div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap font-sans">
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{item.userName || item.userId}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {item.userId} • <span className="text-indigo-300">{item.userRole}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-emerald-400 font-mono">
                      <div className="flex items-center gap-1.5">
                        <Monitor className="w-3 h-3 text-slate-500" />
                        <span>{item.ipAddress || '127.0.0.1'}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap font-sans font-bold text-slate-200">
                      <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px]">
                        {item.formName}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-sans">
                      {renderActionBadge(item.action)}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-indigo-300 whitespace-nowrap">
                      {item.recordRef || '—'}
                    </td>
                    <td className="py-2.5 px-3 font-sans text-slate-300 text-xs">
                      {item.details}
                    </td>
                    <td className="py-2.5 px-2 text-center font-sans">
                      <button
                        onClick={() => setSelectedLog(item)}
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                        title="View Full Audit Snapshot"
                      >
                        <Eye className="w-3.5 h-3.5 text-indigo-400" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Snapshot Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-indigo-400" />
                <div>
                  <h4 className="font-bold text-white text-sm">Backlog Entry: {selectedLog.id}</h4>
                  <p className="text-[11px] text-slate-400">Captured at {new Date(selectedLog.timestamp).toLocaleString()}</p>
                </div>
              </div>
              <button onClick={() => setSelectedLog(null)} className="text-slate-400 hover:text-white p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block">User Information</span>
                <div className="font-bold text-white mt-0.5">{selectedLog.userName} ({selectedLog.userId})</div>
                <div className="text-indigo-400 text-[11px]">Role: {selectedLog.userRole}</div>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Client Station IP</span>
                <div className="font-mono font-bold text-emerald-400 mt-0.5">{selectedLog.ipAddress}</div>
                <div className="text-slate-400 text-[11px]">Timestamp: {new Date(selectedLog.timestamp).toLocaleTimeString()}</div>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Form / Module</span>
                <div className="font-bold text-slate-200 mt-0.5">{selectedLog.formName}</div>
                <div className="text-slate-400 text-[11px]">Ref: {selectedLog.recordRef}</div>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Action Type</span>
                <div className="mt-1">{renderActionBadge(selectedLog.action)}</div>
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Description</span>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-sans leading-relaxed">
                {selectedLog.details}
              </div>
            </div>

            {selectedLog.changes && (
              <div className="space-y-1 text-xs">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Data Snapshot / Changes</span>
                <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-[10px] font-mono text-emerald-400 overflow-x-auto max-h-40 scrollbar-thin">
                  {JSON.stringify(selectedLog.changes, null, 2)}
                </pre>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
