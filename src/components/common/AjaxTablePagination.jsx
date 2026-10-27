import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RotateCw,
  Zap,
} from 'lucide-react';

/**
 * Reusable AJAX Table Pagination & Query Bar
 * 
 * Specifically designed for high-scale enterprise datasets (3 Lakh+ products/rows):
 * - Indian number locale formatting (e.g., 3,00,000 entries)
 * - Page size selector (25, 50, 100, 250, 500)
 * - Non-blocking asynchronous navigation with loading state
 * - Intelligent pagination window with jump-to-page
 * - Indexed execution metrics badge
 */
export default function AjaxTablePagination({
  totalCount = 0,
  page = 1,
  pageSize = 50,
  totalPages = 1,
  startIndex = 0,
  endIndex = 0,
  onPageChange,
  onPageSizeChange,
  isLoading = false,
  executionTimeMs = null,
  pageSizeOptions = [25, 50, 100, 250, 500],
  className = '',
}) {
  const [jumpPageInput, setJumpPageInput] = useState('');

  const formatNumber = (num) => {
    if (num === null || num === undefined) return '0';
    return Number(num).toLocaleString('en-IN');
  };

  const handleJumpSubmit = (e) => {
    e.preventDefault();
    const target = parseInt(jumpPageInput, 10);
    if (!isNaN(target) && target >= 1 && target <= totalPages) {
      onPageChange(target);
      setJumpPageInput('');
    }
  };

  // Generate intelligent page pills window
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages = [];
    pages.push(1);

    if (page > 3) {
      pages.push('ellipsis-start');
    }

    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (page < totalPages - 2) {
      pages.push('ellipsis-end');
    }

    pages.push(totalPages);
    return pages;
  };

  if (totalCount === 0 && !isLoading) {
    return (
      <div className={`p-4 text-center text-sm text-slate-500 bg-slate-50/70 rounded-lg border border-slate-200/80 ${className}`}>
        No records match the active filter criteria.
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col lg:flex-row items-center justify-between gap-4 px-4 py-3 bg-white border-t border-slate-200 text-xs text-slate-600 select-none ${className}`}
    >
      {/* Left: Record summary & performance execution badge */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="font-medium text-slate-700">
          Showing <span className="font-semibold text-slate-900">{formatNumber(startIndex)}</span> to{' '}
          <span className="font-semibold text-slate-900">{formatNumber(endIndex)}</span> of{' '}
          <span className="font-bold text-indigo-700">{formatNumber(totalCount)}</span> records
        </div>

        {isLoading ? (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
            <RotateCw className="w-3 h-3 animate-spin" />
            Loading AJAX...
          </span>
        ) : executionTimeMs !== null ? (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200"
            title="Indexed Database Query Execution Latency"
          >
            <Zap className="w-3 h-3 text-emerald-600" />
            {executionTimeMs}ms
          </span>
        ) : null}

        {/* Rows per page selector */}
        <div className="flex items-center gap-1.5 ml-1 sm:ml-3">
          <span className="text-slate-500">Rows:</span>
          <select
            value={pageSize}
            disabled={isLoading}
            onChange={(e) => onPageSizeChange && onPageSizeChange(Number(e.target.value))}
            className="px-2 py-1 bg-slate-50 border border-slate-300 rounded text-slate-700 text-xs font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-none cursor-pointer"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt} / page
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Right: Pagination buttons & jump to page */}
      <div className="flex flex-wrap items-center gap-2 justify-center lg:justify-end">
        {/* Navigation buttons */}
        <div className="inline-flex items-center rounded-md shadow-sm -space-x-px border border-slate-300 bg-white">
          {/* First Page */}
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={page <= 1 || isLoading}
            className="px-2 py-1.5 rounded-l-md border-r border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
            title="First Page"
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
          </button>

          {/* Prev Page */}
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1 || isLoading}
            className="px-2 py-1.5 border-r border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
            title="Previous Page"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          {/* Page Number Pills */}
          {getPageNumbers().map((pNum, idx) => {
            if (pNum === 'ellipsis-start' || pNum === 'ellipsis-end') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-2.5 py-1.5 text-slate-400 font-bold border-r border-slate-200 select-none text-xs"
                >
                  ...
                </span>
              );
            }

            const isCurrent = pNum === page;
            return (
              <button
                key={`page-${pNum}`}
                type="button"
                onClick={() => onPageChange(pNum)}
                disabled={isLoading}
                className={`px-3 py-1.5 text-xs font-semibold border-r border-slate-200 transition ${
                  isCurrent
                    ? 'bg-indigo-600 text-white font-bold border-indigo-600 z-10'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {pNum}
              </button>
            );
          })}

          {/* Next Page */}
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages || isLoading}
            className="px-2 py-1.5 border-r border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
            title="Next Page"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {/* Last Page */}
          <button
            type="button"
            onClick={() => onPageChange(totalPages)}
            disabled={page >= totalPages || isLoading}
            className="px-2 py-1.5 rounded-r-md text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
            title="Last Page"
          >
            <ChevronsRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Jump to page form */}
        {totalPages > 3 && (
          <form onSubmit={handleJumpSubmit} className="flex items-center gap-1 ml-1 sm:ml-2">
            <span className="text-slate-500">Go to:</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={jumpPageInput}
              onChange={(e) => setJumpPageInput(e.target.value)}
              placeholder={String(page)}
              className="w-14 px-1.5 py-1 text-xs border border-slate-300 rounded text-center focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={isLoading || !jumpPageInput}
              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-slate-700 text-xs font-medium disabled:opacity-40 transition"
            >
              Go
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
