// InvoicesAndReturnsView: Sales Invoices, Itemized Return Processing with Dispositions, and Credit Notes
import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { SalesReturnService } from '../../services/salesReturnService';
import {
  FileText,
  RotateCcw,
  Printer,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Search,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import ExportButtons from '../common/ExportButtons.jsx';

export default function InvoicesAndReturnsView() {
  const { db, currentUser, notify, triggerRefresh, setReceiptModalInvoice } = useApp();

  const [activeSubTab, setActiveSubTab] = useState('invoices'); // invoices | returns
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Invoice for Details Modal
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  // Return Processing State
  const [returnInvoice, setReturnInvoice] = useState(null);
  const [returnItems, setReturnItems] = useState({});
  const [refundMethod, setRefundMethod] = useState('CASH');
  const [returnReason, setReturnReason] = useState('Customer Return');
  const [isProcessingReturn, setIsProcessingReturn] = useState(false);

  // Filter invoices
  const filteredInvoices = db.invoices.filter((inv) => {
    const q = searchQuery.toLowerCase();
    return (
      inv.docNumber.toLowerCase().includes(q) ||
      inv.customerName?.toLowerCase().includes(q) ||
      inv.status.toLowerCase().includes(q)
    );
  });

  const filteredReturns = db.salesReturns.filter((ret) => {
    const q = searchQuery.toLowerCase();
    return (
      ret.docNumber.toLowerCase().includes(q) ||
      ret.originalInvoiceNumber.toLowerCase().includes(q) ||
      ret.customerName?.toLowerCase().includes(q)
    );
  });

  const handleStartReturn = (invoice) => {
    try {
      const returnable = SalesReturnService.getInvoiceForReturn(invoice.docNumber);
      if (!returnable) {
        notify('error', 'Invoice not eligible for return.', 'Return Error');
        return;
      }

      // Initialize return items map
      const initialItems = {};
      returnable.lines.forEach((l) => {
        initialItems[l.lineId] = {
          lineId: l.lineId,
          productId: l.productId,
          name: l.name,
          maxReturnable: l.maxReturnableQty,
          returnQty: 0,
          disposition: 'RESTOCK', // RESTOCK | DAMAGED_QUARANTINE | SUPPLIER_RETURN | NON_STOCKABLE
          unitNetRate: l.lineTotal / l.qty,
        };
      });

      setReturnItems(initialItems);
      setReturnInvoice(returnable);
    } catch (err) {
      notify('error', err.message, 'Return Validation Failed');
    }
  };

  const handleReturnItemChange = (lineId, field, value) => {
    setReturnItems((prev) => ({
      ...prev,
      [lineId]: {
        ...prev[lineId],
        [field]: value,
      },
    }));
  };

  // Submit Sales Return
  const handleSubmitReturn = () => {
    setIsProcessingReturn(true);
    try {
      const itemsToReturn = Object.values(returnItems)
        .filter((it) => Number(it.returnQty) > 0)
        .map((it) => ({
          lineId: it.lineId,
          productId: it.productId,
          returnQty: Number(it.returnQty),
          disposition: it.disposition,
          reason: returnReason,
        }));

      if (itemsToReturn.length === 0) {
        notify('error', 'Please enter a return quantity for at least one item.', 'No Items Selected');
        setIsProcessingReturn(false);
        return;
      }

      const res = SalesReturnService.postSalesReturn({
        originalInvoiceNumber: returnInvoice.docNumber,
        items: itemsToReturn,
        refundMethod,
        notes: returnReason,
        userId: currentUser.id,
      });

      notify('success', res.message, 'Return Posted');
      triggerRefresh();
      setReturnInvoice(null);
      setActiveSubTab('returns');
    } catch (err) {
      notify('error', err.message, 'Return Failed');
    } finally {
      setIsProcessingReturn(false);
    }
  };

  // Live return total calculation
  const totalReturnRefund = Object.values(returnItems).reduce(
    (sum, it) => sum + Number(it.returnQty || 0) * Number(it.unitNetRate || 0),
    0
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
      {/* Sub navigation & Search bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-3 rounded-xl shadow-md">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('invoices')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              activeSubTab === 'invoices'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Sales Invoices ({db.invoices.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('returns')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              activeSubTab === 'returns'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Sales Returns & Credit Notes ({db.salesReturns.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <ExportButtons
            data={
              activeSubTab === 'invoices'
                ? filteredInvoices.map((inv, idx) => ({
                    '#': idx + 1,
                    'Invoice #': inv.docNumber,
                    'Date & Time': new Date(inv.date).toLocaleString(),
                    'Customer': inv.customerName || 'Walk-in Customer',
                    'Warehouse': db.warehouses.find(w => w.id === inv.warehouseId)?.name || inv.warehouseId,
                    'Items Count': inv.lines?.length || 0,
                    'Taxable Amount': `₹${inv.taxableAmount?.toFixed(2)}`,
                    'Tax Amount': `₹${inv.totalTax?.toFixed(2)}`,
                    'Net Payable': `₹${inv.netPayable?.toFixed(2)}`,
                    'Tender Modes': (inv.tenders || []).map(t => `${t.method}: ₹${t.amount}`).join(', '),
                    'Status': inv.status
                  }))
                : filteredReturns.map((ret, idx) => ({
                    '#': idx + 1,
                    'Credit Note #': ret.docNumber,
                    'Original Invoice #': ret.originalInvoiceNumber,
                    'Date & Time': new Date(ret.date).toLocaleString(),
                    'Customer': ret.customerName || 'Walk-in Customer',
                    'Items Count': ret.lines?.length || 0,
                    'Refund Method': ret.refundMethod || 'CASH',
                    'Total Refund': `₹${ret.totalRefundAmount?.toFixed(2)}`,
                    'Return Reason': ret.reason || '',
                    'Status': ret.status
                  }))
            }
            filename={activeSubTab === 'invoices' ? 'SALES_INVOICES_REGISTER' : 'SALES_RETURNS_CREDIT_NOTES'}
            title={activeSubTab === 'invoices' ? 'SALES INVOICES REGISTER' : 'SALES RETURNS & CREDIT NOTES REGISTER'}
            pdfOrientation="landscape"
          />

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search by doc #, customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-64"
            />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {activeSubTab === 'invoices' ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Invoice #</th>
                  <th className="py-2.5 px-3">Date & Time</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">Warehouse</th>
                  <th className="py-2.5 px-2 text-center">Items</th>
                  <th className="py-2.5 px-3 text-right">Net Payable</th>
                  <th className="py-2.5 px-3">Payment Tender</th>
                  <th className="py-2.5 px-2 text-center">Status</th>
                  <th className="py-2.5 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="py-8 text-center text-slate-500 text-xs">
                      No invoices found matching query.
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-2.5 px-3 font-mono font-bold text-indigo-300">
                        {inv.docNumber}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                        {new Date(inv.date).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-200">{inv.customerName}</div>
                        {inv.customerGstin && (
                          <div className="text-[10px] text-slate-500">GSTIN: {inv.customerGstin}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 text-[11px]">
                        {db.warehouses.find((w) => w.id === inv.warehouseId)?.name || inv.warehouseId}
                      </td>
                      <td className="py-2.5 px-2 text-center text-slate-300 font-bold">
                        {inv.lines.length}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-white text-xs">
                        ₹{Number(inv.netPayable).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap gap-1">
                          {inv.tenders?.map((t, idx) => (
                            <span
                              key={idx}
                              className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700"
                            >
                              {t.method}: ₹{t.amount}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            inv.status === 'POSTED'
                              ? 'bg-emerald-950/70 text-emerald-400 border border-emerald-800/40'
                              : 'bg-amber-950/70 text-amber-400 border border-amber-800/40'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* View details */}
                          <button
                            onClick={() => setSelectedInvoice(inv)}
                            title="View Invoice Details"
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Print Receipt */}
                          <button
                            onClick={() => setReceiptModalInvoice(inv)}
                            title="Print Tax Slip / Receipt"
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {/* Sales Return */}
                          {inv.status === 'POSTED' && (
                            <button
                              onClick={() => handleStartReturn(inv)}
                              title="Process Sales Return"
                              className="px-2 py-1 rounded bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/50 text-[11px] font-semibold flex items-center gap-1 transition"
                            >
                              <RotateCcw className="w-3 h-3" /> Return
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Sales Returns Tab */
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Credit Note #</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Original Invoice #</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-2 text-center">Items</th>
                  <th className="py-2.5 px-3 text-right">Refund Amount</th>
                  <th className="py-2.5 px-3">Refund Method</th>
                  <th className="py-2.5 px-3">Reason / Disposition</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredReturns.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-8 text-center text-slate-500 text-xs">
                      No sales returns recorded yet.
                    </td>
                  </tr>
                ) : (
                  filteredReturns.map((ret) => (
                    <tr key={ret.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-2.5 px-3 font-mono font-bold text-amber-300">
                        {ret.docNumber}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                        {new Date(ret.date).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-indigo-400">
                        {ret.originalInvoiceNumber}
                      </td>
                      <td className="py-2.5 px-3 text-slate-200 font-medium">
                        {ret.customerName}
                      </td>
                      <td className="py-2.5 px-2 text-center font-bold text-slate-300">
                        {ret.lines?.length || 0}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-400">
                        ₹{Number(ret.totalRefundAmount).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                          {ret.refundMethod}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                        {ret.notes || 'Customer Return'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invoice Details Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl space-y-4">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <span>Invoice: {selectedInvoice.docNumber}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                    {selectedInvoice.status}
                  </span>
                </h3>
                <p className="text-xs text-slate-400">{new Date(selectedInvoice.date).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <ExportButtons
                  data={selectedInvoice.lines.map((l, idx) => ({
                    '#': idx + 1,
                    'Item Name': l.name,
                    'HSN Code': l.hsnCode || '',
                    'Quantity': l.qty,
                    'Unit Rate': `₹${l.sellingRate?.toFixed(2)}`,
                    'Tax Rate': `${l.taxRate}%`,
                    'Total Amount': `₹${(l.qty * l.sellingRate * (1 - (l.discountPercent || 0) / 100)).toFixed(2)}`
                  }))}
                  filename={`INVOICE_ITEMS_${selectedInvoice.docNumber}`}
                  title={`INVOICE: ${selectedInvoice.docNumber}`}
                  subtitle={`Customer: ${selectedInvoice.customerName || 'Walk-in'} | Net Payable: ₹${selectedInvoice.netPayable?.toFixed(2)}`}
                  size="small"
                />
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="text-slate-400 hover:text-white text-lg px-2 py-1 rounded-lg hover:bg-slate-800 transition"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="px-5 space-y-3 text-xs max-h-[70vh] overflow-y-auto">
              {/* Customer & Location Details */}
              <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div>
                  <div className="text-slate-400 text-[10px] uppercase">Customer</div>
                  <div className="font-bold text-slate-200">{selectedInvoice.customerName}</div>
                  {selectedInvoice.customerGstin && (
                    <div className="text-slate-400 text-[11px]">GSTIN: {selectedInvoice.customerGstin}</div>
                  )}
                </div>
                <div>
                  <div className="text-slate-400 text-[10px] uppercase">Store & Warehouse</div>
                  <div className="font-bold text-slate-200">
                    {db.stores.find((s) => s.id === selectedInvoice.storeId)?.name}
                  </div>
                  <div className="text-slate-400 text-[11px]">
                    Warehouse: {db.warehouses.find((w) => w.id === selectedInvoice.warehouseId)?.name}
                  </div>
                </div>
              </div>

              {/* Items List */}
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[10px] uppercase">
                  <tr>
                    <th className="py-2 px-2">Item</th>
                    <th className="py-2 px-2 text-center">Qty</th>
                    <th className="py-2 px-2 text-right">Rate</th>
                    <th className="py-2 px-2 text-center">GST %</th>
                    <th className="py-2 px-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {selectedInvoice.lines.map((l, i) => (
                    <tr key={i}>
                      <td className="py-2 px-2">
                        <div className="font-semibold text-slate-200">{l.name}</div>
                        <div className="text-[10px] text-slate-500">HSN: {l.hsnCode}</div>
                      </td>
                      <td className="py-2 px-2 text-center text-slate-200 font-bold">{l.qty}</td>
                      <td className="py-2 px-2 text-right font-mono">₹{l.rate}</td>
                      <td className="py-2 px-2 text-center">{l.taxRate}%</td>
                      <td className="py-2 px-2 text-right font-mono font-bold text-indigo-300">
                        ₹{Number(l.lineTotal).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Financial Totals */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5 font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal:</span>
                  <span>₹{selectedInvoice.subtotal.toFixed(2)}</span>
                </div>
                {selectedInvoice.couponDiscount > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Coupon ({selectedInvoice.couponCode}):</span>
                    <span>-₹{selectedInvoice.couponDiscount.toFixed(2)}</span>
                  </div>
                )}
                {selectedInvoice.pointsDiscountAmount > 0 && (
                  <div className="flex justify-between text-amber-400">
                    <span>Loyalty Points:</span>
                    <span>-₹{selectedInvoice.pointsDiscountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-400">
                  <span>Tax (CGST + SGST + IGST):</span>
                  <span>₹{selectedInvoice.totalTax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-white font-bold text-sm border-t border-slate-800 pt-1">
                  <span>Net Amount Paid:</span>
                  <span className="text-indigo-400">₹{selectedInvoice.netPayable.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sales Return Processing Modal */}
      {returnInvoice && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl space-y-4">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-amber-400" />
                  Process Sales Return for {returnInvoice.docNumber}
                </h3>
                <p className="text-xs text-slate-400">Section 7: Itemized Return, Disposition Routing & Point Reversal</p>
              </div>
              <button
                onClick={() => setReturnInvoice(null)}
                className="text-slate-400 hover:text-white text-lg"
              >
                ✕
              </button>
            </div>

            <div className="px-5 space-y-4 text-xs max-h-[70vh] overflow-y-auto">
              <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-3 text-amber-200 text-xs">
                <span>Return Policy Check:</span> Returnable quantities are capped at sold qty minus previous returns.
                Items marked <strong>RESTOCK</strong> will automatically replenish sellable stock. Items marked <strong>DAMAGED</strong> will route to quarantine.
              </div>

              {/* Items Table */}
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase text-[10px]">
                  <tr>
                    <th className="py-2 px-3">Product</th>
                    <th className="py-2 px-2 text-center">Remaining Returnable</th>
                    <th className="py-2 px-2 text-center">Return Qty</th>
                    <th className="py-2 px-3">Disposition</th>
                    <th className="py-2 px-3 text-right">Refund Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {returnInvoice.lines.map((l) => {
                    const it = returnItems[l.lineId] || {};
                    return (
                      <tr key={l.lineId}>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-200">{l.name}</div>
                          <div className="text-[10px] text-slate-400">Sold: {l.qty} | Prev Returned: {l.returnedQty || 0}</div>
                        </td>
                        <td className="py-2.5 px-2 text-center font-bold text-amber-400">
                          {l.maxReturnableQty}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <input
                            type="number"
                            min="0"
                            max={l.maxReturnableQty}
                            value={it.returnQty || 0}
                            onChange={(e) => {
                              const val = Math.min(l.maxReturnableQty, Math.max(0, Number(e.target.value)));
                              handleReturnItemChange(l.lineId, 'returnQty', val);
                            }}
                            className="w-16 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-center font-mono font-bold text-slate-100"
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <select
                            value={it.disposition || 'RESTOCK'}
                            onChange={(e) => handleReturnItemChange(l.lineId, 'disposition', e.target.value)}
                            className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
                          >
                            <option value="RESTOCK">Restock (Add to Sellable)</option>
                            <option value="DAMAGED_QUARANTINE">Damaged / Quarantine</option>
                            <option value="SUPPLIER_RETURN">Supplier Return</option>
                            <option value="NON_STOCKABLE">Non-Stockable / Scrap</option>
                          </select>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-300">
                          ₹{((it.returnQty || 0) * (it.unitNetRate || 0)).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Refund Method & Notes */}
              <div className="grid grid-cols-2 gap-4 bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">Refund Method</label>
                  <select
                    value={refundMethod}
                    onChange={(e) => setRefundMethod(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                  >
                    <option value="CASH">Cash Refund</option>
                    <option value="STORE_CREDIT">Store Credit / On Account Adjustment</option>
                    <option value="UPI">UPI Refund</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">Reason for Return</label>
                  <input
                    type="text"
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    placeholder="Customer dissatisfaction / Defective / Wrong item"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                  />
                </div>
              </div>

              {/* Total Refund Summary */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
                <div>
                  <span className="text-slate-400">Total Calculated Refund Value:</span>
                  <div className="text-[11px] text-amber-400">Proportional privilege points will be automatically reversed.</div>
                </div>
                <div className="text-xl font-black font-mono text-emerald-400">
                  ₹{totalReturnRefund.toFixed(2)}
                </div>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-800 flex justify-end gap-2.5">
              <button
                onClick={() => setReturnInvoice(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReturn}
                disabled={totalReturnRefund <= 0 || isProcessingReturn}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-lg shadow-indigo-600/30"
              >
                <CheckCircle2 className="w-4 h-4" />
                {isProcessingReturn ? 'Processing...' : 'Confirm Return & Issue Credit Note'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
