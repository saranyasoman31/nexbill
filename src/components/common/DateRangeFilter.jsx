import React from 'react';
import { Calendar, Clock, ChevronDown } from 'lucide-react';

/**
 * Enterprise Date Range Filter Bar for high-volume (>1 year) reports
 */
export default function DateRangeFilter({
  selectedFilter = 'ALL',
  onFilterChange,
  customFromDate = '',
  customToDate = '',
  onCustomFromChange,
  onCustomToChange,
  className = '',
  disabled = false,
}) {
  const PRESET_OPTIONS = [
    { id: 'ALL', label: 'All History' },
    { id: 'TODAY', label: 'Today' },
    { id: 'THIS_MONTH', label: 'This Month' },
    { id: 'CURRENT_FY', label: 'Current FY (Apr-Mar)' },
    { id: 'LAST_FY', label: 'Last FY' },
    { id: 'LAST_365_DAYS', label: 'Last 1 Year (365d)' },
    { id: 'OLDER_THAN_1_YEAR', label: '> 1 Year Ago' },
    { id: 'CUSTOM', label: 'Custom Range' },
  ];

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {/* Date Preset Selector */}
      <div className="relative inline-flex items-center">
        <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
        <select
          value={selectedFilter}
          disabled={disabled}
          onChange={(e) => onFilterChange(e.target.value)}
          className="pl-8 pr-7 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg text-slate-700 hover:border-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm cursor-pointer appearance-none"
        >
          {PRESET_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 pointer-events-none" />
      </div>

      {/* Custom Date Pickers when CUSTOM is selected */}
      {selectedFilter === 'CUSTOM' && (
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 px-2 py-1 rounded-lg">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">From:</span>
          <input
            type="date"
            value={customFromDate || ''}
            disabled={disabled}
            onChange={(e) => onCustomFromChange && onCustomFromChange(e.target.value)}
            className="px-1.5 py-0.5 text-xs border border-slate-200 rounded bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <span className="text-[11px] font-semibold text-slate-500 uppercase ml-1">To:</span>
          <input
            type="date"
            value={customToDate || ''}
            disabled={disabled}
            onChange={(e) => onCustomToChange && onCustomToChange(e.target.value)}
            className="px-1.5 py-0.5 text-xs border border-slate-200 rounded bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      )}

      {selectedFilter === 'OLDER_THAN_1_YEAR' && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
          <Clock className="w-3 h-3 text-amber-600" />
          Showing historical archives older than 365 days
        </span>
      )}
    </div>
  );
}
