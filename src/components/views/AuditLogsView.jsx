// AuditLogsView: Immutable Ledger of ERP Actions, Validations, and Security Events
import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  ShieldAlert,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  User,
  Activity,
} from 'lucide-react';
import ExportButtons from '../common/ExportButtons.jsx';

export default function AuditLogsView() {
  const { db, setReportsSubTab } = useApp();
  const [search, setSearch] = useState('');

  const filteredLogs = db.auditLogs.filter(log => {
    const q = search.toLowerCase();
    return (
      log.action.toLowerCase().includes(q) ||
      log.details.toLowerCase().includes(q) ||
      log.userId.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
      {/* Top Bar */}
      <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-3 rounded-xl shadow-md">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-indigo-400" />
          <div>
            <h3 className="font-bold text-white text-sm">ERP Statutory Audit & Transaction Logs</h3>
            <p className="text-[11px] text-slate-400">Section 3.3 & 18: Immutable audit trail with user, timestamp, and transaction context</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ExportButtons
            data={filteredLogs.map((log, idx) => {
              const user = db.users.find(u => u.id === log.userId);
              return {
                '#': idx + 1,
                'Timestamp': new Date(log.timestamp).toLocaleString(),
                'Action Event': log.action,
                'Authorized User': user ? `${user.name} [${user.role}]` : log.userId,
                'Audit Details & Context': log.details
              };
            })}
            filename="ERP_AUDIT_LOGS"
            title="ERP STATUTORY AUDIT & SECURITY LOGS"
            pdfOrientation="landscape"
          />

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search action, details, user..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-64"
            />
          </div>

          {setReportsSubTab && (
            <button
              onClick={() => setReportsSubTab('backlog')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 rounded-lg text-xs font-semibold border border-indigo-500/40 transition"
              title="Open full Backlog Activity Report"
            >
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>Backlog Report</span>
            </button>
          )}
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Action Event</th>
                <th className="py-2.5 px-3">Authorized User</th>
                <th className="py-2.5 px-3">Audit Details & Context</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="4" className="py-8 text-center text-slate-500">
                    No audit records matching query.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  const user = db.users.find(u => u.id === log.userId);
                  return (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap">
                        {user ? `${user.name} [${user.role}]` : log.userId}
                      </td>
                      <td className="py-2.5 px-3 text-slate-200 font-sans text-xs">
                        {log.details}
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
  );
}
