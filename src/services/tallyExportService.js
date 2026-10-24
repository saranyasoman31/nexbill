// TallyExportService: GSTR-1 Tax Classification, Tally XML/JSON Voucher Generation, and Export Idempotency
import { getDatabase, saveDatabase, logAuditEvent } from './storageService.js';

export const TallyExportService = {
  /**
   * Generate or retrieve idempotent Tally Accounting Export Batch
   */
  generateExportBatch({ companyId, fromDate, toDate, exportType = 'SALES_VOUCHERS', userId = 'USR-05', idempotencyToken }) {
    const db = getDatabase();

    // Check for duplicate export if idempotencyToken provided
    if (idempotencyToken) {
      const existing = db.tallyExportBatches.find(b => b.idempotencyToken === idempotencyToken);
      if (existing) {
        return {
          batch: existing,
          isDuplicateSuppressed: true,
          message: `Idempotent retry: Existing export batch ${existing.batchNumber} returned without creating duplicate vouchers.`,
        };
      }
    }

    const company = db.companies.find(c => c.id === companyId) || db.companies[0];
    const fromTime = fromDate ? new Date(fromDate).getTime() : 0;
    const toTime = toDate ? new Date(toDate).getTime() : Date.now();

    // Collect posted sales
    const invoices = db.invoices.filter(inv => {
      if (inv.companyId !== company.id || inv.status !== 'POSTED') return false;
      const d = new Date(inv.date).getTime();
      return d >= fromTime && d <= toTime;
    });

    // Collect sales returns
    const returns = db.salesReturns.filter(ret => {
      if (ret.companyId !== company.id || ret.status !== 'POSTED') return false;
      const d = new Date(ret.date).getTime();
      return d >= fromTime && d <= toTime;
    });

    const vouchers = [];

    // Format Sales Invoices into Tally Sales Vouchers
    for (const inv of invoices) {
      vouchers.push({
        guid: `VOUCH-SALE-${inv.id}`,
        voucherType: 'Sales',
        voucherNumber: inv.docNumber,
        date: inv.date.slice(0, 10),
        partyLedgerName: inv.customerName || 'Cash Customer',
        gstin: inv.customerGstin || 'URP',
        placeOfSupply: inv.cgstAmount > 0 ? `${company.stateCode}-${company.state}` : 'Inter-State',
        taxableAmount: inv.taxableAmount,
        cgstAmount: inv.cgstAmount,
        sgstAmount: inv.sgstAmount,
        igstAmount: inv.igstAmount,
        roundOff: inv.roundOff,
        totalAmount: inv.netPayable,
        ledgerEntries: [
          { ledgerName: 'Sales Account - Retail', amount: -inv.taxableAmount },
          ...(inv.cgstAmount > 0 ? [{ ledgerName: 'Output CGST Account', amount: -inv.cgstAmount }] : []),
          ...(inv.sgstAmount > 0 ? [{ ledgerName: 'Output SGST Account', amount: -inv.sgstAmount }] : []),
          ...(inv.igstAmount > 0 ? [{ ledgerName: 'Output IGST Account', amount: -inv.igstAmount }] : []),
          ...(inv.roundOff !== 0 ? [{ ledgerName: 'Round Off Account', amount: -inv.roundOff }] : []),
          { ledgerName: inv.customerName || 'Cash In Hand', amount: inv.netPayable },
        ]
      });
    }

    // Format Sales Returns into Tally Credit Note Vouchers
    for (const ret of returns) {
      vouchers.push({
        guid: `VOUCH-CN-${ret.id}`,
        voucherType: 'Credit Note',
        voucherNumber: ret.docNumber,
        date: ret.date.slice(0, 10),
        partyLedgerName: ret.customerName || 'Cash Customer',
        originalInvoiceNumber: ret.originalInvoiceNumber,
        totalRefundAmount: ret.totalRefundAmount,
        ledgerEntries: [
          { ledgerName: 'Sales Return Account', amount: ret.totalRefundAmount - ret.totalTaxRefund },
          { ledgerName: 'GST Input/Output Tax Reversal', amount: ret.totalTaxRefund },
          { ledgerName: ret.customerName || 'Cash In Hand', amount: -ret.totalRefundAmount },
        ]
      });
    }

    const count = db.tallyExportBatches.length + 1;
    const batchNumber = `TALLY-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;
    const nowIso = new Date().toISOString();

    const batch = {
      id: `BATCH-${Date.now()}`,
      batchNumber,
      idempotencyToken: idempotencyToken || `TOKEN-${Date.now()}`,
      companyId: company.id,
      companyName: company.name,
      exportType,
      voucherCount: vouchers.length,
      fromDate: fromDate || new Date(0).toISOString().slice(0, 10),
      toDate: toDate || new Date().toISOString().slice(0, 10),
      generatedAt: nowIso,
      generatedBy: userId,
      status: 'EXPORTED',
      vouchers,
      xmlPayloadPreview: this.generateTallyXml(vouchers, company),
    };

    db.tallyExportBatches.unshift(batch);
    saveDatabase(db);
    logAuditEvent('TALLY_EXPORT', userId, `Tally export batch ${batchNumber} created with ${vouchers.length} vouchers.`);

    return {
      batch,
      isDuplicateSuppressed: false,
      message: `Export batch ${batchNumber} generated with ${vouchers.length} accounting vouchers.`,
    };
  },

  /**
   * Generate standard Tally XML format
   */
  generateTallyXml(vouchers, company) {
    const xmlHeader = `<?xml version="1.0" encoding="UTF-8"?>\n<ENVELOPE>\n  <HEADER>\n    <TALLYREQUEST>Import Data</TALLYREQUEST>\n  </HEADER>\n  <BODY>\n    <IMPORTDATA>\n      <REQUESTDESC>\n        <REPORTNAME>Vouchers</REPORTNAME>\n        <STATICVARIABLES>\n          <SVCURRENTCOMPANY>${company.name}</SVCURRENTCOMPANY>\n        </STATICVARIABLES>\n      </REQUESTDESC>\n      <REQUESTDATA>\n`;

    const vouchersXml = vouchers.map(v => `        <TALLYMESSAGE xmlns:UDF="TallyUDF">\n          <VOUCHER VCHTYPE="${v.voucherType}" ACTION="Create">\n            <DATE>${v.date.replace(/-/g, '')}</DATE>\n            <VOUCHERNUMBER>${v.voucherNumber}</VOUCHERNUMBER>\n            <PARTYLEDGERNAME>${v.partyLedgerName}</PARTYLEDGERNAME>\n            <AMOUNT>${v.totalAmount || v.totalRefundAmount}</AMOUNT>\n${(v.ledgerEntries || []).map(le => `            <ALLLEDGERENTRIES.LIST>\n              <LEDGERNAME>${le.ledgerName}</LEDGERNAME>\n              <AMOUNT>${le.amount}</AMOUNT>\n            </ALLLEDGERENTRIES.LIST>`).join('\n')}\n          </VOUCHER>\n        </TALLYMESSAGE>`).join('\n');

    const xmlFooter = `\n      </REQUESTDATA>\n    </IMPORTDATA>\n  </BODY>\n</ENVELOPE>`;
    return xmlHeader + vouchersXml + xmlFooter;
  }
};
