import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Format a filename with date timestamp
 */
export function formatFilename(baseName) {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  const cleanBase = (baseName || 'Report')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_');
  return `${cleanBase}_${dateStr}_${timeStr}`;
}

/**
 * Prepare data and column definitions for export
 */
export function prepareDataForExport(data, columns) {
  if (!Array.isArray(data) || data.length === 0) {
    return { headers: [], rows: [], excelData: [], colDefs: [] };
  }

  let colDefs = [];
  if (columns && Array.isArray(columns) && columns.length > 0) {
    colDefs = columns.map(col => {
      if (typeof col === 'string') {
        return {
          header: col.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim(),
          key: col,
          transform: null
        };
      }
      return {
        header: col.header || col.title || col.label || col.key,
        key: col.key || col.dataKey || col.field,
        transform: col.transform || col.render || null
      };
    });
  } else {
    // Derive columns from keys of the first row
    const firstRow = data[0];
    colDefs = Object.keys(firstRow)
      .filter(k => !k.startsWith('_') && typeof firstRow[k] !== 'function')
      .map(k => ({
        header: k.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim(),
        key: k,
        transform: null
      }));
  }

  const headers = colDefs.map(c => c.header);

  const rows = data.map((item, index) => {
    return colDefs.map(col => {
      let val = item[col.key];
      if (col.key === '#' || col.key === 'index' || col.key === 'slNo') {
        val = index + 1;
      }
      if (col.transform && typeof col.transform === 'function') {
        try {
          val = col.transform(val, item, index);
        } catch {
          val = String(val ?? '');
        }
      } else if (val === null || val === undefined) {
        val = '';
      } else if (typeof val === 'boolean') {
        val = val ? 'Yes' : 'No';
      } else if (typeof val === 'object') {
        val = JSON.stringify(val);
      }
      return val !== null && val !== undefined ? String(val) : '';
    });
  });

  const excelData = data.map((item, index) => {
    const rowObj = {};
    colDefs.forEach(col => {
      let val = item[col.key];
      if (col.key === '#' || col.key === 'index' || col.key === 'slNo') {
        val = index + 1;
      }
      if (col.transform && typeof col.transform === 'function') {
        try {
          val = col.transform(val, item, index);
        } catch {
          val = String(val ?? '');
        }
      } else if (val === null || val === undefined) {
        val = '';
      } else if (typeof val === 'boolean') {
        val = val ? 'Yes' : 'No';
      } else if (typeof val === 'object') {
        val = JSON.stringify(val);
      }
      rowObj[col.header] = val;
    });
    return rowObj;
  });

  return { headers, rows, excelData, colDefs };
}

/**
 * Export tabular array data to Excel (.xlsx)
 */
export function exportToExcel({
  data = [],
  columns = null,
  filename = 'Export_Data',
  sheetName = 'Sheet1',
  title = ''
}) {
  if (!data || data.length === 0) {
    if (typeof window !== 'undefined' && window.alert) {
      alert('No data available to export to Excel.');
    }
    return false;
  }

  const { excelData } = prepareDataForExport(data, columns);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(excelData);

  // Auto-fit column widths
  if (excelData.length > 0) {
    const keys = Object.keys(excelData[0]);
    const colWidths = keys.map(key => {
      let maxLen = key.length;
      excelData.forEach(row => {
        const val = row[key];
        const strVal = val !== undefined && val !== null ? String(val) : '';
        if (strVal.length > maxLen) {
          maxLen = Math.min(strVal.length, 50);
        }
      });
      return { wch: Math.max(maxLen + 3, 10) };
    });
    ws['!cols'] = colWidths;
  }

  const cleanSheetName = (sheetName || 'Data').substring(0, 31).replace(/[\\/?*[\]]/g, '_');
  XLSX.utils.book_append_sheet(wb, ws, cleanSheetName);

  const cleanFilename = `${formatFilename(filename)}.xlsx`;
  XLSX.writeFile(wb, cleanFilename);
  return true;
}

/**
 * Export HTML Table Element directly to Excel
 */
export function exportTableElementToExcel(tableElementOrId, filename = 'Table_Export', sheetName = 'Sheet1') {
  const el = typeof tableElementOrId === 'string'
    ? document.getElementById(tableElementOrId)
    : tableElementOrId;

  if (!el) {
    console.error('Table element not found for Excel export.');
    return false;
  }

  const wb = XLSX.utils.table_to_book(el, { sheet: sheetName || 'Data' });
  const cleanFilename = `${formatFilename(filename)}.xlsx`;
  XLSX.writeFile(wb, cleanFilename);
  return true;
}

/**
 * Export tabular data to PDF (.pdf)
 */
export function exportToPdf({
  data = [],
  columns = null,
  filename = 'Export_Report',
  title = 'Data Report',
  subtitle = '',
  orientation = 'auto',
  storeName = 'NexBill Retail',
  user = null,
  summaryCards = null,
}) {
  if (!data || data.length === 0) {
    if (typeof window !== 'undefined' && window.alert) {
      alert('No data available to export to PDF.');
    }
    return false;
  }

  const { headers, rows } = prepareDataForExport(data, columns);

  // Auto-detect orientation: landscape if > 5 columns
  const isLandscape = orientation === 'landscape' || (orientation === 'auto' && headers.length > 5);
  const pdfOrientation = isLandscape ? 'landscape' : 'portrait';

  const doc = new jsPDF({
    orientation: pdfOrientation,
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  // Header Banner
  doc.setFillColor(30, 41, 59); // Slate-800
  doc.rect(0, 0, pageWidth, 22, 'F');

  // Company Brand Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(storeName || 'NexBill Retail ERP', 12, 9);

  // Document Title
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(226, 232, 240); // Slate-200
  doc.text(String(title).toUpperCase(), 12, 16);

  // Generation details (right-aligned)
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  const printTimestamp = `${dateStr} ${timeStr}`;

  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225);
  doc.text(`Generated: ${printTimestamp}`, pageWidth - 12, 9, { align: 'right' });
  if (user) {
    const userText = typeof user === 'string'
      ? user
      : `${user.name || user.username || 'Admin'} (${user.role || 'User'})`;
    doc.text(`User: ${userText}`, pageWidth - 12, 15, { align: 'right' });
  }

  let startY = 27;

  // Subtitle / Summary Cards if provided
  if (subtitle || (summaryCards && summaryCards.length > 0)) {
    if (subtitle) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text(subtitle, 12, startY);
      startY += 5;
    }

    if (summaryCards && Array.isArray(summaryCards) && summaryCards.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      const summaryText = summaryCards.map(s => `${s.label}: ${s.value}`).join('   |   ');
      doc.text(summaryText, 12, startY);
      startY += 5;
    }
    startY += 2;
  }

  // Draw AutoTable
  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: startY,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59], // Slate 800
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'left',
      cellPadding: 2,
    },
    bodyStyles: {
      textColor: [30, 41, 59],
      fontSize: 7,
      cellPadding: 2,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // Slate 50
    },
    styles: {
      overflow: 'linebreak',
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
    },
    margin: { top: 26, left: 10, right: 10, bottom: 12 },
    didDrawPage: (data) => {
      // Footer with Page Numbers
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184); // Slate 400
      doc.text(
        'NexBill ERP • Confidential & Proprietary Report',
        10,
        pageHeight - 5
      );
      doc.text(
        `Page ${data.pageNumber} of ${doc.internal.getNumberOfPages()}`,
        pageWidth - 10,
        pageHeight - 5,
        { align: 'right' }
      );
    },
  });

  const cleanFilename = `${formatFilename(filename)}.pdf`;
  doc.save(cleanFilename);
  return true;
}

/**
 * Export HTML Table Element directly to PDF
 */
export function exportTableElementToPdf(tableElementOrId, {
  filename = 'Table_Report',
  title = 'Data Report',
  subtitle = '',
  orientation = 'auto',
  storeName = 'NexBill Retail',
  user = null
} = {}) {
  const el = typeof tableElementOrId === 'string'
    ? document.getElementById(tableElementOrId)
    : tableElementOrId;

  if (!el) {
    console.error('Table element not found for PDF export.');
    return false;
  }

  const doc = new jsPDF({
    orientation: orientation === 'landscape' ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  // Header Banner
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageWidth, 22, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(storeName || 'NexBill Retail ERP', 12, 9);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(226, 232, 240);
  doc.text(String(title).toUpperCase(), 12, 16);

  autoTable(doc, {
    html: el,
    startY: 28,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
    },
    bodyStyles: {
      textColor: [30, 41, 59],
      fontSize: 7.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { top: 26, left: 10, right: 10, bottom: 12 },
    didDrawPage: (data) => {
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text('NexBill ERP • Confidential & Proprietary Report', 10, pageHeight - 5);
      doc.text(`Page ${data.pageNumber} of ${doc.internal.getNumberOfPages()}`, pageWidth - 10, pageHeight - 5, { align: 'right' });
    }
  });

  const cleanFilename = `${formatFilename(filename)}.pdf`;
  doc.save(cleanFilename);
  return true;
}
