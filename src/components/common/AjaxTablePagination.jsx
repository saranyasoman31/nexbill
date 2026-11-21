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
 * - Page size selector: "Show [25, 50, 100, 250, 500] entries"
 * - Record counter: "Showing X to Y of Z entries"
 * - Non-blocking asynchronous navigation with loading state
 * - Intelligent pagination window with jump-to-page
 * - High-contrast theme styling for both Light & Dark modes
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
  pageSizeOptions = [10, 25, 50, 100, 250, 500],
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
      <div className={`p-4 text-center text-xs font-medium pagination-label bg-slate-900/60 rounded-lg border border-slate-800 ${className}`}>
        No entries match the active filter criteria.
      </div>
    );
  }

  return (
    <div
      className={`pagination-container flex flex-col lg:flex-row items-center justify-between gap-4 px-4 py-3 bg-slate-900 border-t border-slate-800 text-xs text-slate-300 select-none ${className}`}
    >
      {/* Left: Record summary & performance execution badge */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="pagination-label font-medium text-slate-400">
          Showing <span className="pagination-number font-bold text-indigo-400 font-mono text-xs">{formatNumber(startIndex)}</span> to{' '}
          <span className="pagination-number font-bold text-indigo-400 font-mono text-xs">{formatNumber(endIndex)}</span> of{' '}
          <span className="pagination-total font-extrabold text-emerald-400 font-mono text-xs">{formatNumber(totalCount)}</span> entries
        </div>

        {isLoading ? (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse">
            <RotateCw className="w-3 h-3 animate-spin" />
            Loading AJAX...
          </span>
        ) : executionTimeMs !== null ? (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
            title="Indexed Database Query Execution Latency"
          >
            <Zap className="w-3 h-3 text-emerald-400" />
            {executionTimeMs}ms
          </span>
        ) : null}

        {/* Show entries selector */}
        <div className="flex items-center gap-1.5 ml-1 sm:ml-3">
          <span className="pagination-label font-semibold text-slate-300">Show</span>
          <select
            value={pageSize}
            disabled={isLoading}
            onChange={(e) => onPageSizeChange && onPageSizeChange(Number(e.target.value))}
            className="pagination-select px-2.5 py-1 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 font-bold font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none cursor-pointer shadow-xs"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt} className="bg-slate-900 text-slate-100 font-semibold font-mono">
                {opt}
              </option>
            ))}
          </select>
          <span className="pagination-label font-semibold text-slate-300">entries</span>
        </div>
      </div>

      {/* Right: Pagination buttons & jump to page */}
      <div className="flex flex-wrap items-center gap-2.5 justify-center lg:justify-end">
        {/* Navigation buttons */}
        <div className="inline-flex items-center rounded-lg shadow-sm -space-x-px border border-slate-700 bg-slate-950 overflow-hidden">
          {/* First Page */}
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={page <= 1 || isLoading}
            className="pagination-btn px-2.5 py-1.5 border-r border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-25 disabled:cursor-not-allowed transition cursor-pointer"
            title="First Page"
            aria-label="First Page"
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
          </button>

          {/* Prev Page */}
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1 || isLoading}
            className="pagination-btn px-2.5 py-1.5 border-r border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-25 disabled:cursor-not-allowed transition cursor-pointer"
            title="Previous Page"
            aria-label="Previous Page"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          {/* Page Number Pills */}
          {getPageNumbers().map((pNum, idx) => {
            if (pNum === 'ellipsis-start' || pNum === 'ellipsis-end') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-2.5 py-1.5 text-slate-500 font-bold border-r border-slate-800 select-none text-xs"
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
                className={`px-3 py-1.5 text-xs font-bold border-r border-slate-800 transition cursor-pointer ${
                  isCurrent
                    ? 'bg-indigo-600 text-white font-black shadow-inner shadow-black/20 z-10'
                    : 'pagination-btn text-slate-300 hover:text-white hover:bg-slate-800'
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
            className="pagination-btn px-2.5 py-1.5 border-r border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-25 disabled:cursor-not-allowed transition cursor-pointer"
            title="Next Page"
            aria-label="Next Page"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {/* Last Page */}
          <button
            type="button"
            onClick={() => onPageChange(totalPages)}
            disabled={page >= totalPages || isLoading}
            className="pagination-btn px-2.5 py-1.5 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-25 disabled:cursor-not-allowed transition cursor-pointer"
            title="Last Page"
            aria-label="Last Page"
          >
            <ChevronsRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Jump to page form */}
        {totalPages > 3 && (
          <form onSubmit={handleJumpSubmit} className="flex items-center gap-1.5 ml-1 sm:ml-2">
            <span className="pagination-label font-semibold text-slate-300">Go to:</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={jumpPageInput}
              onChange={(e) => setJumpPageInput(e.target.value)}
              placeholder={String(page)}
              className="pagination-select w-14 px-2 py-1 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100 font-mono font-bold text-center focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={isLoading || !jumpPageInput}
              className="pagination-btn px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-200 hover:text-white text-xs font-bold disabled:opacity-40 transition cursor-pointer shadow-xs"
            >
              Go
            </button>
          </form>
        )}
      </div>
    </div>
  );
}