import React from 'react';
import { FileSpreadsheet, FileText } from 'lucide-react';
import { exportToExcel, exportToPdf, exportTableElementToExcel, exportTableElementToPdf } from '../../utils/exportService';
import { useApp } from '../../context/AppContext';

/**
 * Reusable Excel and PDF export buttons component
 */
export default function ExportButtons({
  data = null,
  columns = null,
  filename = 'Report',
  title = 'Data Report',
  subtitle = '',
  sheetName = 'Data',
  pdfOrientation = 'auto',
  summaryCards = null,
  tableId = null,
  tableRef = null,
  disabled = false,
  className = '',
  size = 'normal', // 'small' | 'normal'
  showLabels = true,
  onExportExcel = null,
  onExportPdf = null,
}) {
  const { currentUser, activeStore, notify } = useApp();

  const hasData = (Array.isArray(data) && data.length > 0) || tableId || tableRef;
  const isDisabled = disabled || !hasData;

  const handleExcel = (e) => {
    e?.preventDefault();
    e?.stopPropagation();

    if (onExportExcel && typeof onExportExcel === 'function') {
      onExportExcel();
      return;
    }

    if (tableId || tableRef) {
      const el = tableRef?.current || tableId;
      const success = exportTableElementToExcel(el, filename, sheetName);
      if (success && notify) notify(`Exported ${title} to Excel successfully!`, 'success');
      return;
    }

    if (!data || data.length === 0) {
      if (notify) notify('No data to export.', 'warning');
      return;
    }

    const success = exportToExcel({
      data,
      columns,
      filename,
      sheetName,
      title,
    });
    if (success && notify) {
      notify(`Exported ${title} to Excel (.xlsx)`, 'success');
    }
  };

  const handlePdf = (e) => {
    e?.preventDefault();
    e?.stopPropagation();

    if (onExportPdf && typeof onExportPdf === 'function') {
      onExportPdf();
      return;
    }

    if (tableId || tableRef) {
      const el = tableRef?.current || tableId;
      const success = exportTableElementToPdf(el, {
        filename,
        title,
        subtitle,
        orientation: pdfOrientation,
        storeName: activeStore?.name || 'NexBill Retail',
        user: currentUser,
      });
      if (success && notify) notify(`Exported ${title} to PDF successfully!`, 'success');
      return;
    }

    if (!data || data.length === 0) {
      if (notify) notify('No data to export.', 'warning');
      return;
    }

    const success = exportToPdf({
      data,
      columns,
      filename,
      title,
      subtitle,
      orientation: pdfOrientation,
      storeName: activeStore?.name || 'NexBill Retail',
      user: currentUser,
      summaryCards,
    });
    if (success && notify) {
      notify(`Exported ${title} to PDF (.pdf)`, 'success');
    }
  };

  const btnBaseClass = size === 'small'
    ? 'px-2 py-1 text-xs font-semibold rounded'
    : 'px-2.5 py-1.5 text-xs font-semibold rounded-md shadow-xs';

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      {/* Excel Button */}
      <button
        type="button"
        onClick={handleExcel}
        disabled={isDisabled}
        title={isDisabled ? 'No data to export' : `Export ${title} to Excel (.xlsx)`}
        className={`${btnBaseClass} inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 border border-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer select-none`}
      >
        <FileSpreadsheet className={size === 'small' ? 'w-3.5 h-3.5 text-emerald-600' : 'w-4 h-4 text-emerald-600'} />
        {showLabels && <span>Excel</span>}
      </button>

      {/* PDF Button */}
      <button
        type="button"
        onClick={handlePdf}
        disabled={isDisabled}
        title={isDisabled ? 'No data to export' : `Export ${title} to PDF (.pdf)`}
        className={`${btnBaseClass} inline-flex items-center gap-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:text-rose-800 border border-rose-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer select-none`}
      >
        <FileText className={size === 'small' ? 'w-3.5 h-3.5 text-rose-600' : 'w-4 h-4 text-rose-600'} />
        {showLabels && <span>PDF</span>}
      </button>
    </div>
  );
}
