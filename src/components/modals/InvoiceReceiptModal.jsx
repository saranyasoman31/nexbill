// InvoiceReceiptModal: Thermal POS Receipt (80mm) & GST Tax Invoice View with Printing
import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Printer, X, FileText, CheckCircle2 } from 'lucide-react';

export default function InvoiceReceiptModal() {
  const { receiptModalInvoice, setReceiptModalInvoice, db } = useApp();
  const [printFormat, setPrintFormat] = useState('thermal'); // thermal | a4

  if (!receiptModalInvoice) return null;

  const inv = receiptModalInvoice;
  const company = db.companies.find(c => c.id === inv.companyId) || db.companies[0];
  const store = db.stores.find(s => s.id === inv.storeId) || db.stores[0];
  const customer = db.customers.find(c => c.id === inv.customerId) || {};

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl space-y-3">
        {/* Modal Controls */}
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">Invoice Receipt: {inv.docNumber}</span>
            <div className="flex bg-slate-950 border border-slate-800 rounded-lg p-0.5 ml-2">
              <button
                onClick={() => setPrintFormat('thermal')}
                className={`px-2 py-1 rounded text-[11px] font-semibold ${
                  printFormat === 'thermal' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                }`}
              >
                POS Slip (80mm)
              </button>
              <button
                onClick={() => setPrintFormat('a4')}
                className={`px-2 py-1 rounded text-[11px] font-semibold ${
                  printFormat === 'a4' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                }`}
              >
                A4 Tax Invoice
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold flex items-center gap-1.5 shadow-md"
            >
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
            <button
              onClick={() => setReceiptModalInvoice(null)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Invoice Container */}
        <div className="p-4 max-h-[75vh] overflow-y-auto flex justify-center">
          {printFormat === 'thermal' ? (
            /* 80mm POS Thermal Slip Style */
            <div className="bg-white text-black p-4 rounded-lg shadow font-mono text-[11px] w-[340px] leading-tight space-y-2 select-all">
              <div className="text-center space-y-0.5 border-b border-dashed border-gray-400 pb-2">
                <div className="text-base font-black uppercase tracking-wider">{company.tradeName}</div>
                <div className="text-[10px] text-gray-700">{store.address}</div>
                <div className="text-[10px]">GSTIN: {company.gstin}</div>
                <div className="text-[10px]">Ph: {store.phone}</div>
              </div>

              <div className="border-b border-dashed border-gray-400 pb-1.5 space-y-0.5 text-[10px]">
                <div className="flex justify-between font-bold">
                  <span>INVOICE: {inv.docNumber}</span>
                  <span>{new Date(inv.date).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Time: {new Date(inv.date).toLocaleTimeString()}</span>
                  <span>Cashier: {inv.createdBy}</span>
                </div>
                <div>Customer: {inv.customerName} {inv.customerPhone ? `(${inv.customerPhone})` : ''}</div>
                {inv.customerGstin && <div>Cust GSTIN: {inv.customerGstin}</div>}
              </div>

              {/* Items Table */}
              <table className="w-full text-left text-[10px] border-b border-dashed border-gray-400 pb-1">
                <thead>
                  <tr className="border-b border-gray-300">
                    <th className="py-1">Item</th>
                    <th className="py-1 text-center">Qty</th>
                    <th className="py-1 text-right">Rate</th>
                    <th className="py-1 text-right">Amt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {inv.lines.map((l, i) => (
                    <tr key={i}>
                      <td className="py-1 pr-1">
                        <div className="font-bold">{l.name}</div>
                        <div className="text-[9px] text-gray-600">HSN:{l.hsnCode} GST:{l.taxRate}%</div>
                      </td>
                      <td className="py-1 text-center font-bold">{l.qty}</td>
                      <td className="py-1 text-right">₹{l.rate}</td>
                      <td className="py-1 text-right font-bold">₹{Number(l.lineTotal).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div className="space-y-0.5 text-[10px] border-b border-dashed border-gray-400 pb-1.5">
                <div className="flex justify-between">
                  <span>Total Items:</span>
                  <span>{inv.lines.reduce((s, l) => s + l.qty, 0)} pcs</span>
                </div>
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>₹{inv.subtotal.toFixed(2)}</span>
                </div>
                {inv.couponDiscount > 0 && (
                  <div className="flex justify-between text-green-700 font-bold">
                    <span>Coupon ({inv.couponCode}):</span>
                    <span>-₹{inv.couponDiscount.toFixed(2)}</span>
                  </div>
                )}
                {inv.pointsDiscountAmount > 0 && (
                  <div className="flex justify-between text-amber-700 font-bold">
                    <span>Privilege Pts Redeemed:</span>
                    <span>-₹{inv.pointsDiscountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Taxable Value:</span>
                  <span>₹{inv.taxableAmount.toFixed(2)}</span>
                </div>
                {inv.cgstAmount > 0 && (
                  <div className="flex justify-between text-gray-700">
                    <span>CGST:</span>
                    <span>₹{inv.cgstAmount.toFixed(2)}</span>
                  </div>
                )}
                {inv.sgstAmount > 0 && (
                  <div className="flex justify-between text-gray-700">
                    <span>SGST:</span>
                    <span>₹{inv.sgstAmount.toFixed(2)}</span>
                  </div>
                )}
                {inv.igstAmount > 0 && inv.cgstAmount > 0 && (
                  <div className="flex justify-between text-gray-700">
                    <span>IGST:</span>
                    <span>₹{inv.igstAmount.toFixed(2)}</span>
                  </div>
                )}
                {((inv.taxAmount > 0) || (inv.igstAmount > 0)) && (!inv.cgstAmount || inv.cgstAmount === 0) && (!inv.sgstAmount || inv.sgstAmount === 0) && (
                  <div className="flex justify-between text-gray-700">
                    <span>VAT / Single Tax:</span>
                    <span>₹{(inv.taxAmount || inv.igstAmount || 0).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs font-black pt-1 border-t border-gray-400">
                  <span>NET PAYABLE:</span>
                  <span>₹{inv.netPayable.toFixed(2)}</span>
                </div>
              </div>

              {/* Tenders */}
              <div className="text-[10px] space-y-0.5 border-b border-dashed border-gray-400 pb-1.5">
                <div className="font-bold">Payment Breakdown:</div>
                {inv.tenders?.map((t, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>{t.method} {t.reference ? `(${t.reference})` : ''}:</span>
                    <span>₹{Number(t.amount).toFixed(2)}</span>
                  </div>
                ))}
                {inv.changeDue > 0 && (
                  <div className="flex justify-between font-bold">
                    <span>Change Returned:</span>
                    <span>₹{inv.changeDue.toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Loyalty Reward */}
              {inv.pointsEarned > 0 && (
                <div className="text-center font-bold text-[10px] py-1 bg-amber-50 border border-amber-200 rounded">
                  ★ Points Earned Today: +{inv.pointsEarned} Points ★
                </div>
              )}

              {/* Footer */}
              <div className="text-center text-[9px] text-gray-600 pt-1 space-y-0.5">
                <div>Thank you for shopping with us!</div>
                <div>Goods returnable within 7 days with original receipt.</div>
                <div className="font-mono text-[8px] text-gray-500 pt-1">
                  Auth Token: {inv.idempotencyToken}
                </div>
              </div>
            </div>
          ) : (
            /* A4 GST Tax Invoice Style */
            <div className="bg-white text-black p-6 rounded-lg shadow font-sans text-xs w-[600px] space-y-4">
              <div className="flex justify-between items-start border-b pb-3">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{company.name}</h2>
                  <p className="text-gray-600">{company.address}</p>
                  <p className="font-bold text-gray-800">GSTIN: {company.gstin}</p>
                  <p className="text-gray-600">Email: {company.email}</p>
                </div>
                <div className="text-right">
                  <span className="px-2 py-1 bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 rounded">
                    TAX INVOICE
                  </span>
                  <div className="mt-2 text-sm font-bold">{inv.docNumber}</div>
                  <div className="text-gray-600">Date: {new Date(inv.date).toLocaleDateString()}</div>
                </div>
              </div>

              {/* Bill To */}
              <div className="bg-gray-50 p-3 rounded border text-xs">
                <div className="font-bold text-gray-800">Billed To (Customer):</div>
                <div className="font-bold">{inv.customerName}</div>
                {inv.customerGstin && <div>GSTIN / UIN: {inv.customerGstin}</div>}
                <div>Place of Supply: {inv.cgstAmount > 0 ? `${company.stateCode}-${company.state}` : (inv.cgstAmount === 0 && inv.sgstAmount === 0 && !inv.customerGstin) ? 'Standard / Domestic' : 'Inter-State'}</div>
              </div>

              {/* Table */}
              <table className="w-full text-left text-xs border">
                <thead className="bg-gray-100 border-b text-[10px] uppercase">
                  <tr>
                    <th className="p-2">Item Description</th>
                    <th className="p-2">HSN</th>
                    <th className="p-2 text-center">Qty</th>
                    <th className="p-2 text-right">Rate</th>
                    <th className="p-2 text-center">GST %</th>
                    <th className="p-2 text-right">Taxable</th>
                    <th className="p-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-xs">
                  {inv.lines.map((l, i) => (
                    <tr key={i}>
                      <td className="p-2 font-medium">{l.name}</td>
                      <td className="p-2 text-gray-600">{l.hsnCode}</td>
                      <td className="p-2 text-center font-bold">{l.qty}</td>
                      <td className="p-2 text-right">₹{l.rate}</td>
                      <td className="p-2 text-center">{l.taxRate}%</td>
                      <td className="p-2 text-right">₹{Number(l.taxableAmount).toFixed(2)}</td>
                      <td className="p-2 text-right font-bold">₹{Number(l.lineTotal).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-end">
                <div className="w-64 space-y-1 text-xs border-t pt-2">
                  <div className="flex justify-between">
                    <span>Taxable Amount:</span>
                    <span>₹{inv.taxableAmount.toFixed(2)}</span>
                  </div>
                  {inv.cgstAmount > 0 && (
                    <div className="flex justify-between text-gray-600">
                      <span>Central Tax (CGST):</span>
                      <span>₹{inv.cgstAmount.toFixed(2)}</span>
                    </div>
                  )}
                  {inv.sgstAmount > 0 && (
                    <div className="flex justify-between text-gray-600">
                      <span>State Tax (SGST):</span>
                      <span>₹{inv.sgstAmount.toFixed(2)}</span>
                    </div>
                  )}
                  {inv.igstAmount > 0 && inv.cgstAmount > 0 && (
                    <div className="flex justify-between text-gray-600">
                      <span>Integrated Tax (IGST):</span>
                      <span>₹{inv.igstAmount.toFixed(2)}</span>
                    </div>
                  )}
                  {((inv.taxAmount > 0) || (inv.igstAmount > 0)) && (!inv.cgstAmount || inv.cgstAmount === 0) && (!inv.sgstAmount || inv.sgstAmount === 0) && (
                    <div className="flex justify-between text-gray-600">
                      <span>VAT / Single Tax:</span>
                      <span>₹{(inv.taxAmount || inv.igstAmount || 0).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-sm border-t pt-1">
                    <span>Total Invoice Amount:</span>
                    <span>₹{inv.netPayable.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
