// TallyExportView: Statutory GST Tax Split, Tally XML Voucher Generation, and Export Idempotency
import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { TallyExportService } from '../../services/tallyExportService';
import {
  DownloadCloud,
  FileCode,
  CheckCircle2,
  AlertCircle,
  Copy,
  Receipt,
  Building2,
  Calendar,
} from 'lucide-react';
import ExportButtons from '../common/ExportButtons.jsx';

export default function TallyExportView() {
  const { db, activeCompany, currentUser, notify, triggerRefresh } = useApp();

  const [activeTab, setActiveTab] = useState('summary'); // summary | batches | xml
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  // Compute live tax totals across all posted invoices for the company
  const companyInvoices = db.invoices.filter(i => i.companyId === activeCompany.id && i.status === 'POSTED');
  const companyReturns = db.salesReturns.filter(r => r.companyId === activeCompany.id && r.status === 'POSTED');

  const totalGrossSales = companyInvoices.reduce((sum, i) => sum + i.netPayable, 0);
  const totalTaxable = companyInvoices.reduce((sum, i) => sum + i.taxableAmount, 0);
  const totalCGST = companyInvoices.reduce((sum, i) => sum + i.cgstAmount, 0);
  const totalSGST = companyInvoices.reduce((sum, i) => sum + i.sgstAmount, 0);
  const totalIGST = companyInvoices.reduce((sum, i) => sum + i.igstAmount, 0);
  const totalGST = totalCGST + totalSGST + totalIGST;

  const handleRunExport = () => {
    setIsExporting(true);
    try {
      const idempotencyToken = `TALLY-EXP-${activeCompany.id}-${new Date().toISOString().slice(0, 10)}`;
      const res = TallyExportService.generateExportBatch({
        companyId: activeCompany.id,
        exportType: 'SALES_VOUCHERS',
        userId: currentUser.id,
        idempotencyToken,
      });

      if (res.isDuplicateSuppressed) {
        notify('warning', res.message, 'Idempotent Retry');
      } else {
        notify('success', res.message, 'Export Completed');
      }

      setSelectedBatch(res.batch);
      triggerRefresh();
      setActiveTab('batches');
    } catch (err) {
      notify('error', err.message, 'Export Error');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
      {/* Top Bar */}
      <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-3 rounded-xl shadow-md">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('summary')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              activeTab === 'summary' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>GSTR-1 Tax Analysis</span>
          </button>

          <button
            onClick={() => setActiveTab('batches')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              activeTab === 'batches' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <DownloadCloud className="w-3.5 h-3.5" />
            <span>Export Batches ({db.tallyExportBatches.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'batches' ? (
            <ExportButtons
              data={db.tallyExportBatches}
              columns={[
                { header: 'Batch Number', key: 'batchNumber' },
                { header: 'Generated At', key: 'generatedAt', format: (v) => new Date(v).toLocaleString() },
                { header: 'Company', key: 'companyName' },
                { header: 'Voucher Count', key: 'voucherCount' },
                { header: 'Idempotency Key', key: 'idempotencyToken' },
                { header: 'Status', key: 'status' }
              ]}
              filename={`Tally_Export_Batches_${activeCompany.name}`}
              title="Tally Prime / ERP Export Batches Register"
              subtitle={`Company: ${activeCompany.name} | GSTIN: ${activeCompany.gstin}`}
              size="small"
            />
          ) : (
            <ExportButtons
              data={[
                { metric: 'Taxable Value', amount: `₹${totalTaxable.toFixed(2)}`, type: 'Base Value' },
                { metric: 'Output CGST (Central Tax 50%)', amount: `₹${totalCGST.toFixed(2)}`, type: 'Intra-State Tax' },
                { metric: 'Output SGST (State Tax 50%)', amount: `₹${totalSGST.toFixed(2)}`, type: 'Intra-State Tax' },
                { metric: 'Output IGST (Integrated Tax 100%)', amount: `₹${totalIGST.toFixed(2)}`, type: 'Inter-State Tax' },
                { metric: 'Total GST Collected', amount: `₹${totalGST.toFixed(2)}`, type: 'Total Tax' },
                { metric: 'Total Gross Sales Turnover', amount: `₹${totalGrossSales.toFixed(2)}`, type: 'Revenue' }
              ]}
              columns={[
                { header: 'Tax Metric / Classification', key: 'metric' },
                { header: 'Category', key: 'type' },
                { header: 'Amount', key: 'amount' }
              ]}
              filename={`GSTR1_Tax_Analysis_${activeCompany.name}`}
              title="GSTR-1 Statutory Tax Split & Turnover Analysis"
              subtitle={`Company: ${activeCompany.name} | GSTIN: ${activeCompany.gstin} | State: ${activeCompany.state}`}
              size="small"
            />
          )}

          <button
            onClick={handleRunExport}
            disabled={isExporting}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 transition"
          >
            <FileCode className="w-3.5 h-3.5" />
            {isExporting ? 'Generating Vouchers...' : 'Generate Tally XML Batch'}
          </button>
        </div>
      </div>

      {activeTab === 'summary' && (
        <div className="space-y-4">
          {/* Tax Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-md">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Taxable Value</div>
              <div className="text-xl font-black font-mono text-white mt-1">₹{totalTaxable.toFixed(2)}</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-md">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Output CGST (Central Tax)</div>
              <div className="text-xl font-black font-mono text-emerald-400 mt-1">₹{totalCGST.toFixed(2)}</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-md">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Output SGST (State Tax)</div>
              <div className="text-xl font-black font-mono text-emerald-400 mt-1">₹{totalSGST.toFixed(2)}</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-md">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Output IGST (Integrated Tax)</div>
              <div className="text-xl font-black font-mono text-indigo-400 mt-1">₹{totalIGST.toFixed(2)}</div>
            </div>
          </div>

          {/* Section 15 Accounting & Tax Details Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-md space-y-4">
            <div className="border-b border-slate-800 pb-3 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-white text-base">GSTR-1 & Financial Accounting Baseline</h3>
                <p className="text-xs text-slate-400">Company: {activeCompany.name} | GSTIN: {activeCompany.gstin} ({activeCompany.state})</p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                Total GST Collected: ₹{totalGST.toFixed(2)}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="font-bold text-slate-200">Intra-State Supply (Local Sales)</span>
                <p className="text-slate-400">
                  Transactions where Customer State matches Store State ({activeCompany.stateCode}). Tax split equally into 50% CGST and 50% SGST.
                </p>
                <div className="font-mono text-slate-300">
                  CGST + SGST Total: <strong className="text-emerald-400">₹{(totalCGST + totalSGST).toFixed(2)}</strong>
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="font-bold text-slate-200">Inter-State Supply (Out-of-State)</span>
                <p className="text-slate-400">
                  Transactions where Customer State differs from Store State. Governed by 100% Integrated Goods and Services Tax (IGST).
                </p>
                <div className="font-mono text-slate-300">
                  IGST Total: <strong className="text-indigo-400">₹{totalIGST.toFixed(2)}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'batches' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Batch Number</th>
                  <th className="py-2.5 px-3">Generated At</th>
                  <th className="py-2.5 px-3">Company</th>
                  <th className="py-2.5 px-2 text-center">Vouchers Count</th>
                  <th className="py-2.5 px-3">Idempotency Key</th>
                  <th className="py-2.5 px-2 text-center">Status</th>
                  <th className="py-2.5 px-3 text-center">Tally XML Payload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {db.tallyExportBatches.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-slate-500 text-xs">
                      No export batches created yet. Click "Generate Tally XML Batch" above.
                    </td>
                  </tr>
                ) : (
                  db.tallyExportBatches.map(b => (
                    <tr key={b.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-2.5 px-3 font-mono font-bold text-indigo-300">{b.batchNumber}</td>
                      <td className="py-2.5 px-3 text-slate-400 text-[11px]">{new Date(b.generatedAt).toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-slate-200 font-medium">{b.companyName}</td>
                      <td className="py-2.5 px-2 text-center font-bold text-emerald-400">{b.voucherCount}</td>
                      <td className="py-2.5 px-3 font-mono text-[10px] text-slate-400">{b.idempotencyToken}</td>
                      <td className="py-2.5 px-2 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                          {b.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => setSelectedBatch(b)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded text-[11px] font-semibold flex items-center gap-1 mx-auto transition"
                        >
                          <FileCode className="w-3.5 h-3.5" /> View XML
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tally XML Payload Viewer Modal */}
      {selectedBatch && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl space-y-4">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-base">Tally XML Payload: {selectedBatch.batchNumber}</h3>
                <p className="text-xs text-slate-400">Compliant Tally Prime / ERP 9 Import Envelope ({selectedBatch.voucherCount} Vouchers)</p>
              </div>
              <button onClick={() => setSelectedBatch(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="px-5">
              <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-[11px] text-emerald-300 max-h-[60vh] overflow-y-auto whitespace-pre-wrap select-all">
                {selectedBatch.xmlPayloadPreview}
              </pre>
            </div>

            <div className="px-5 py-3 border-t border-slate-800 flex justify-end gap-2.5">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(selectedBatch.xmlPayloadPreview);
                  notify('success', 'Tally XML payload copied to clipboard!', 'Copied');
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" /> Copy XML
              </button>
              <button
                onClick={() => setSelectedBatch(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg text-xs"
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
