// POSBillingView: Point of Sale, Barcode Scanning, Real-time Stock Check, Loyalty, Coupon, Multi-Tender Payment
import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { SalesPostingService } from '../../services/salesPostingService';
import { StockService } from '../../services/stockService';
import { logBacklog } from '../../services/storageService.js';
import {
  Scan,
  Plus,
  Trash2,
  Tag,
  Gift,
  CreditCard,
  Banknote,
  Smartphone,
  User,
  ShoppingBag,
  AlertCircle,
  CheckCircle2,
  FileCheck,
  Search,
  Sparkles,
  ShieldAlert,
  Printer,
} from 'lucide-react';
import ExportButtons from '../common/ExportButtons.jsx';

export default function POSBillingView() {
  const {
    db,
    activeCompany,
    activeStore,
    activeWarehouse,
    currentUser,
    notify,
    triggerRefresh,
    setReceiptModalInvoice,
    hasPermission,
  } = useApp();

  const canView = hasPermission('billing', 'view');
  const canAdd = hasPermission('billing', 'add');
  const canPrint = hasPermission('billing', 'print');

  // Cart state
  const [cart, setCart] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('CUST-001'); // Default walk-in
  const [barcodeInput, setBarcodeInput] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);

  // Multi-tender Payment State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [tenders, setTenders] = useState({
    CASH: 0,
    UPI: 0,
    CARD: 0,
    CREDIT: 0,
  });
  const [tenderRefs, setTenderRefs] = useState({
    UPI: '',
    CARD: '',
  });

  const [isPosting, setIsPosting] = useState(false);
  const barcodeRef = useRef(null);

  const customer = db.customers.find((c) => c.id === selectedCustomerId) || db.customers[0];

  // Calculate live totals using SalesPostingService
  const calculation = SalesPostingService.calculateInvoice(
    cart,
    activeStore.stateCode,
    customer.stateCode,
    appliedCoupon,
    pointsToRedeem
  );

  // Barcode quick add handler
  const handleBarcodeSubmit = (e) => {
    e.preventDefault();
    const query = barcodeInput.trim();
    if (!query) return;

    // Search by barcode or SKU
    const product = db.products.find(
      (p) => (p.barcode === query || p.sku.toLowerCase() === query.toLowerCase()) && p.active
    );

    if (product) {
      addProductToCart(product);
      setBarcodeInput('');
    } else {
      notify('error', `No active product found for barcode or SKU: "${query}"`, 'Scan Failed');
    }
  };

  const addProductToCart = (product) => {
    // Check available stock in current warehouse
    const currentStock = StockService.getStockBalance(activeWarehouse.id, product.id);

    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      const existingQty = existing ? existing.qty : 0;
      const targetQty = existingQty + 1;

      if (db.settings.blockNegativeStock && targetQty > currentStock) {
        notify(
          'error',
          `Cannot add "${product.name}". Available stock in ${activeWarehouse.name} is ${currentStock} units.`,
          'Stock Insufficient'
        );
        return prev;
      }

      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, qty: targetQty } : item
        );
      } else {
        return [
          ...prev,
          {
            ...product,
            qty: 1,
            discountPercent: 0,
          },
        ];
      }
    });
  };

  const updateCartItemQty = (productId, newQty) => {
    const qty = Number(newQty);
    if (qty <= 0) {
      removeFromCart(productId);
      return;
    }

    const currentStock = StockService.getStockBalance(activeWarehouse.id, productId);
    if (db.settings.blockNegativeStock && qty > currentStock) {
      notify(
        'error',
        `Stock limit reached. Only ${currentStock} units available in ${activeWarehouse.name}.`,
        'Stock Unavailable'
      );
      return;
    }

    setCart((prev) =>
      prev.map((item) => (item.id === productId ? { ...item, qty } : item))
    );
  };

  const updateCartItemDiscount = (productId, discountPercent) => {
    const disc = Math.min(100, Math.max(0, Number(discountPercent) || 0));
    setCart((prev) =>
      prev.map((item) => (item.id === productId ? { ...item, discountPercent: disc } : item))
    );
  };

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((item) => item.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setAppliedCoupon(null);
    setPointsToRedeem(0);
    setTenders({ CASH: 0, UPI: 0, CARD: 0, CREDIT: 0 });
  };

  const handleVoidCart = () => {
    if (cart.length > 0) {
      logBacklog({
        action: 'CANCEL',
        formName: 'Billing (POS)',
        recordRef: 'CART-VOID',
        userId: currentUser?.id,
        userName: currentUser?.name,
        userRole: currentUser?.role,
        details: `Cancelled / voided active POS billing cart with ${cart.length} items (Total: ₹${calculation.netPayable.toFixed(2)})`,
      });
      notify('info', 'Active POS cart cleared and cancelled.', 'Cart Cleared');
    }
    clearCart();
  };

  const applyCouponCode = () => {
    const code = couponCodeInput.trim().toUpperCase();
    if (!code) return;

    const coupon = db.coupons.find((c) => c.code.toUpperCase() === code);
    if (!coupon || !coupon.active) {
      notify('error', `Coupon code "${code}" is invalid or expired.`, 'Coupon Error');
      return;
    }

    if (coupon.singleUsePerCustomer && !customer.isWalkIn) {
      const alreadyUsed = db.invoices.some(
        (inv) => inv.customerId === customer.id && inv.couponCode === coupon.code && inv.status === 'POSTED'
      );
      if (alreadyUsed) {
        notify('error', `Coupon "${coupon.code}" has already been used by ${customer.name}.`, 'Single-Use Coupon');
        return;
      }
    }

    if (calculation.subtotal < coupon.minSpend) {
      notify('error', `Minimum invoice spend for coupon ${code} is ₹${coupon.minSpend}.`, 'Condition Not Met');
      return;
    }

    setAppliedCoupon(coupon);
    notify('success', `Coupon "${coupon.code}" applied! Discount: ₹${coupon.discountValue}${coupon.discountType === 'PERCENT' ? '%' : ''}`, 'Coupon Applied');
  };

  // Open Payment Modal and preset cash tender to net payable
  const handleOpenPayment = () => {
    if (cart.length === 0) {
      notify('error', 'Cart is empty. Add products before proceeding to payment.', 'Empty Cart');
      return;
    }

    if (!activeStore.isDayOpen) {
      notify('error', 'Register is closed for this store. Open register in Day Close module first.', 'Day Closed');
      return;
    }

    setTenders({
      CASH: calculation.netPayable,
      UPI: 0,
      CARD: 0,
      CREDIT: 0,
    });
    setIsPaymentModalOpen(true);
  };

  // Execute Final Posting with Idempotency Token
  const handleConfirmSale = (isDraft = false) => {
    if (!canAdd) {
      notify('error', 'You do not have permission to post or draft sales transactions.', 'Permission Denied');
      return;
    }

    setIsPosting(true);
    try {
      const tenderList = [];
      if (Number(tenders.CASH) > 0) tenderList.push({ method: 'CASH', amount: Number(tenders.CASH) });
      if (Number(tenders.UPI) > 0) tenderList.push({ method: 'UPI', amount: Number(tenders.UPI), reference: tenderRefs.UPI });
      if (Number(tenders.CARD) > 0) tenderList.push({ method: 'CARD', amount: Number(tenders.CARD), reference: tenderRefs.CARD });
      if (Number(tenders.CREDIT) > 0) tenderList.push({ method: 'CREDIT', amount: Number(tenders.CREDIT) });

      // Generate unique posting token (Duplicate submission protection)
      const idempotencyToken = `POST-POS-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

      const result = SalesPostingService.postSale({
        companyId: activeCompany.id,
        storeId: activeStore.id,
        warehouseId: activeWarehouse.id,
        customerId: customer.id,
        items: cart,
        couponCode: appliedCoupon ? appliedCoupon.code : null,
        pointsToRedeem,
        tenders: tenderList,
        idempotencyToken,
        userId: currentUser.id,
        isDraft,
      });

      triggerRefresh();
      setIsPaymentModalOpen(false);
      clearCart();

      logBacklog({
        action: 'SAVE',
        formName: 'Billing (POS)',
        recordRef: result.invoice.docNumber,
        userId: currentUser?.id,
        userName: currentUser?.name,
        userRole: currentUser?.role,
        details: `Saved & posted POS Invoice ${result.invoice.docNumber} (${cart.length} items, Total: ₹${result.invoice.grandTotal.toFixed(2)})`,
      });

      notify('success', `Invoice ${result.invoice.docNumber} posted successfully! Stock updated.`, 'Sale Posted');
      if (canPrint) {
        setReceiptModalInvoice(result.invoice);
      }
    } catch (err) {
      notify('error', err.message, 'Transaction Rejected');
    } finally {
      setIsPosting(false);
    }
  };

  // Filter products for quick search catalog
  const filteredProducts = db.products.filter(
    (p) =>
      p.active &&
      (p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.sku.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.barcode.includes(productSearch))
  );

  const totalTendered =
    Number(tenders.CASH || 0) +
    Number(tenders.UPI || 0) +
    Number(tenders.CARD || 0) +
    Number(tenders.CREDIT || 0);

  const changeDue = Math.max(0, totalTendered - calculation.netPayable);

  if (!canView) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-lg mx-auto shadow-2xl space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-950/80 border border-rose-500/50 flex items-center justify-center mx-auto text-rose-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Access Restricted</h3>
            <p className="text-xs text-slate-400 mt-1">
              You do not have permission to access the <span className="text-slate-200 font-semibold">POS Billing</span> terminal. Contact your administrator to adjust your role privileges.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
      {/* Top Banner Alert if Day Closed */}
      {!activeStore.isDayOpen && (
        <div className="bg-rose-950/60 border border-rose-500/50 rounded-xl p-3.5 flex items-center justify-between text-rose-200 text-xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <span className="font-bold text-white">Register is CLOSED for {activeStore.name}.</span>
              <p className="text-rose-300/80">In accordance with Section 14 & 20.11, new sales transactions are blocked until the day is opened in Day Close.</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Barcode Scanner + Cart Lines (7 Cols) */}
        <div className="lg:col-span-7 space-y-3">
          {/* Barcode & Customer Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-md space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              {/* Customer Selector */}
              <div className="flex-1 min-w-[220px]">
                <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 mb-1">
                  <User className="w-3 h-3 text-indigo-400" />
                  Customer / B2B Entity
                </label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => {
                    setSelectedCustomerId(e.target.value);
                    setPointsToRedeem(0);
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  {db.customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} • {c.businessType || (c.gstin ? 'B2B' : 'B2C')} ({c.supplyType || 'LOCAL'} - {c.state || c.stateCode}) {c.gstin ? `[GSTIN: ${c.gstin}]` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Customer Type & Place of Supply Pill */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-lg px-3 py-1.5 text-[11px] flex flex-col justify-center">
                <div className="text-slate-400 text-[10px] mb-0.5">Jurisdiction & Type:</div>
                <div className="flex items-center gap-1.5">
                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${
                    (customer.businessType || 'B2C') === 'B2B'
                      ? 'bg-indigo-950 text-indigo-300 border-indigo-700'
                      : 'bg-sky-950 text-sky-300 border-sky-700'
                  }`}>
                    {customer.businessType || (customer.gstin ? 'B2B' : 'B2C')}
                  </span>
                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${
                    (customer.supplyType || 'LOCAL') === 'LOCAL'
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                      : 'bg-amber-950 text-amber-300 border-amber-700'
                  }`}>
                    {customer.supplyType || 'LOCAL'}
                  </span>
                  <span className="text-[10px] text-slate-300 font-medium">
                    {customer.state || customer.stateCode}
                  </span>
                </div>
              </div>

              {/* Customer Privilege Points */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-lg px-3 py-1.5 text-[11px] min-w-[150px]">
                <div className="text-slate-400">Privilege Points:</div>
                <div className="font-bold text-amber-400 text-xs">
                  {customer.loyaltyPoints || 0} pts (≈ ₹{(customer.loyaltyPoints || 0) * db.settings.loyaltyRedemptionRate})
                </div>
              </div>

              {customer.creditLimit > 0 && (
                <div className="bg-slate-950/70 border border-slate-800 rounded-lg px-3 py-1.5 text-[11px]">
                  <div className="text-slate-400">Available Credit:</div>
                  <div className="font-bold text-emerald-400 text-xs">
                    ₹{(customer.creditLimit - customer.creditOutstanding).toFixed(2)}
                  </div>
                </div>
              )}
            </div>

            {/* Fast Barcode Input */}
            <form onSubmit={handleBarcodeSubmit} className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Scan className="w-4 h-4 text-indigo-400 animate-pulse" />
              </div>
              <input
                ref={barcodeRef}
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="Scan product barcode (e.g. 8901234001012) or type SKU..."
                className="w-full pl-9 pr-24 py-2.5 bg-slate-950 border border-indigo-500/40 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
              <button
                type="submit"
                className="absolute right-1.5 top-1.5 bottom-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-md transition"
              >
                Scan Add
              </button>
            </form>
          </div>

          {/* Cart Items Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md">
            <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-indigo-400" />
                <span className="font-bold text-sm text-slate-200">Invoice Items ({cart.length})</span>
                <span className="text-[11px] text-slate-400">| Warehouse: {activeWarehouse.name}</span>
              </div>
              <div className="flex items-center gap-2">
                {cart.length > 0 && (
                  <ExportButtons
                    data={cart.map((item, idx) => ({
                      '#': idx + 1,
                      'Product Name': item.name,
                      'SKU': item.sku,
                      'Qty': item.qty,
                      'Selling Rate': `₹${item.sellingRate?.toFixed(2)}`,
                      'Disc %': `${item.discountPercent || 0}%`,
                      'GST %': `${item.taxRate}%`,
                      'Line Total': `₹${(item.qty * item.sellingRate * (1 - (item.discountPercent || 0) / 100)).toFixed(2)}`
                    }))}
                    filename="POS_ESTIMATE_BILL_ITEMS"
                    title="POS ESTIMATE & CART ITEMS"
                    subtitle={`Store: ${activeStore.name} | Customer: ${selectedCustomer?.name || 'Walk-in'}`}
                    size="small"
                  />
                )}
                {cart.length > 0 && (
                  <button
                    onClick={handleVoidCart}
                    className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 font-medium px-2 py-1 rounded hover:bg-slate-800 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Clear All
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-[380px] overflow-y-auto">
              {cart.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs space-y-2">
                  <Scan className="w-8 h-8 mx-auto text-slate-600 opacity-60" />
                  <p>Cart is currently empty.</p>
                  <p className="text-[11px] text-slate-600">Scan a barcode, select from the quick catalog, or search products.</p>
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-2 px-3">Item Details</th>
                      <th className="py-2 px-2 text-center">Qty</th>
                      <th className="py-2 px-2 text-right">Rate</th>
                      <th className="py-2 px-2 text-center">Disc %</th>
                      <th className="py-2 px-2 text-center">GST</th>
                      <th className="py-2 px-3 text-right">Total</th>
                      <th className="py-2 px-2 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {cart.map((item) => {
                      const avail = StockService.getStockBalance(activeWarehouse.id, item.id);
                      return (
                        <tr key={item.id} className="hover:bg-slate-800/40 transition">
                          <td className="py-2 px-3">
                            <div className="font-semibold text-slate-200">{item.name}</div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-2">
                              <span>SKU: {item.sku}</span>
                              <span>•</span>
                              <span className={avail <= 5 ? 'text-amber-400 font-bold' : 'text-emerald-400'}>
                                Avail: {avail} {item.uom}
                              </span>
                            </div>
                          </td>
                          <td className="py-2 px-2 text-center">
                            <div className="inline-flex items-center border border-slate-700 rounded-lg bg-slate-950">
                              <button
                                onClick={() => updateCartItemQty(item.id, item.qty - 1)}
                                className="px-2 py-0.5 text-slate-400 hover:text-white"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="1"
                                value={item.qty}
                                onChange={(e) => updateCartItemQty(item.id, e.target.value)}
                                className="w-10 text-center bg-transparent text-slate-100 font-bold text-xs focus:outline-none"
                              />
                              <button
                                onClick={() => updateCartItemQty(item.id, item.qty + 1)}
                                className="px-2 py-0.5 text-slate-400 hover:text-white"
                              >
                                +
                              </button>
                            </div>
                          </td>
                          <td className="py-2 px-2 text-right">
                            <div className="font-mono text-slate-200 font-semibold">₹{item.sellingRate}</div>
                            <div className="text-[10px] text-slate-500 line-through">₹{item.mrp}</div>
                          </td>
                          <td className="py-2 px-2 text-center">
                            <input
                              type="number"
                              min="0"
                              max="50"
                              value={item.discountPercent}
                              onChange={(e) => updateCartItemDiscount(item.id, e.target.value)}
                              className="w-12 bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-center text-slate-200 text-xs"
                            />
                          </td>
                          <td className="py-2 px-2 text-center">
                            <span className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px]">
                              {item.taxRate}%
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-indigo-300">
                            ₹{(item.qty * item.sellingRate * (1 - (item.discountPercent || 0) / 100)).toFixed(2)}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <button
                              onClick={() => removeFromCart(item.id)}
                              className="text-slate-500 hover:text-rose-400 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Calculations, Loyalty, Coupon, and Tender (5 Cols) */}
        <div className="lg:col-span-5 space-y-3">
          {/* Quick Product Search / Catalog Picker */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-md space-y-2">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search catalog by name, brand, or SKU..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
            {/* Quick Chips */}
            <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
              {filteredProducts.slice(0, 5).map((prod) => {
                const stock = StockService.getStockBalance(activeWarehouse.id, prod.id);
                return (
                  <div
                    key={prod.id}
                    onClick={() => addProductToCart(prod)}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-950/70 hover:bg-indigo-950/40 border border-slate-800 hover:border-indigo-500/40 cursor-pointer transition text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-200">{prod.name}</div>
                      <div className="text-[10px] text-slate-400">
                        {prod.sku} • ₹{prod.sellingRate} <span className="line-through text-slate-600">₹{prod.mrp}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${stock > 0 ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40' : 'bg-rose-950/60 text-rose-400 border border-rose-800/40'}`}>
                        {stock} in stock
                      </span>
                      <Plus className="w-3.5 h-3.5 text-indigo-400" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Coupon & Privilege Points Drawer */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-md space-y-3">
            {/* Coupon Code Input */}
            <div>
              <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 mb-1">
                <Tag className="w-3 h-3 text-indigo-400" />
                Apply Coupon (Single-Use & Stacking Protection)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="WELCOME50 / FESTIVE100"
                  value={couponCodeInput}
                  onChange={(e) => setCouponCodeInput(e.target.value.toUpperCase())}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs uppercase font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={applyCouponCode}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition"
                >
                  Apply
                </button>
              </div>
              {appliedCoupon && (
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-emerald-400 bg-emerald-950/30 border border-emerald-800/40 px-2.5 py-1 rounded-md">
                  <span>Coupon {appliedCoupon.code} applied: -₹{calculation.couponDiscount}</span>
                  <button onClick={() => setAppliedCoupon(null)} className="text-slate-400 hover:text-white ml-2">×</button>
                </div>
              )}
            </div>

            {/* Privilege Points Redemption */}
            {!customer.isWalkIn && customer.loyaltyPoints > 0 && (
              <div className="border-t border-slate-800/80 pt-2.5">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                    <Gift className="w-3 h-3 text-amber-400" />
                    Redeem Privilege Points (Max 20% invoice)
                  </label>
                  <span className="text-[10px] text-amber-400 font-bold">
                    Max: {Math.min(customer.loyaltyPoints, Math.floor(calculation.subtotal * 0.20))} pts
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max={Math.min(customer.loyaltyPoints, Math.floor(calculation.subtotal * 0.20))}
                    value={pointsToRedeem}
                    onChange={(e) => setPointsToRedeem(Number(e.target.value))}
                    className="flex-1 accent-indigo-500 cursor-pointer"
                  />
                  <span className="text-xs font-mono font-bold text-amber-300 w-16 text-right">
                    {pointsToRedeem} pts (₹{pointsToRedeem})
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Real-time Calculation Summary Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-lg space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Gross Items Subtotal</span>
              <span className="font-mono text-slate-200">₹{calculation.subtotal.toFixed(2)}</span>
            </div>

            {calculation.lineDiscountTotal > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>Line Discounts</span>
                <span className="font-mono">-₹{calculation.lineDiscountTotal.toFixed(2)}</span>
              </div>
            )}

            {calculation.couponDiscount > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>Coupon Discount ({appliedCoupon?.code})</span>
                <span className="font-mono">-₹{calculation.couponDiscount.toFixed(2)}</span>
              </div>
            )}

            {calculation.pointsDiscountAmount > 0 && (
              <div className="flex justify-between text-amber-400">
                <span>Privilege Points Redeemed</span>
                <span className="font-mono">-₹{calculation.pointsDiscountAmount.toFixed(2)}</span>
              </div>
            )}

            <div className="border-t border-slate-800/80 pt-2 flex justify-between text-slate-400">
              <span>Taxable Value</span>
              <span className="font-mono">₹{calculation.taxableAmount.toFixed(2)}</span>
            </div>

            {/* GST Split (CGST/SGST vs IGST) */}
            <div className="bg-slate-950/60 rounded-lg p-2 text-[11px] space-y-1 border border-slate-800/50">
              <div className="flex justify-between text-slate-400">
                <span>Place of Supply:</span>
                <span className="font-medium text-slate-300">
                  {customer.stateCode === activeStore.stateCode
                    ? `Intra-State (${activeStore.stateCode} - CGST + SGST)`
                    : `Inter-State (${customer.stateCode || 'Out-of-State'} - IGST)`}
                </span>
              </div>
              {calculation.cgstAmount > 0 && (
                <div className="flex justify-between text-slate-400 font-mono">
                  <span>Output CGST</span>
                  <span>₹{calculation.cgstAmount.toFixed(2)}</span>
                </div>
              )}
              {calculation.sgstAmount > 0 && (
                <div className="flex justify-between text-slate-400 font-mono">
                  <span>Output SGST</span>
                  <span>₹{calculation.sgstAmount.toFixed(2)}</span>
                </div>
              )}
              {calculation.igstAmount > 0 && (
                <div className="flex justify-between text-indigo-400 font-mono font-semibold">
                  <span>Output IGST</span>
                  <span>₹{calculation.igstAmount.toFixed(2)}</span>
                </div>
              )}
            </div>

            {calculation.roundOff !== 0 && (
              <div className="flex justify-between text-slate-500 text-[11px]">
                <span>Rounding Adjustment</span>
                <span className="font-mono">₹{calculation.roundOff.toFixed(2)}</span>
              </div>
            )}

            <div className="border-t border-slate-700 pt-2 flex justify-between items-baseline">
              <span className="text-sm font-bold text-white">Net Payable Amount</span>
              <span className="text-2xl font-black font-mono text-indigo-400">
                ₹{calculation.netPayable.toFixed(2)}
              </span>
            </div>

            {/* Loyalty Points Earning Projection */}
            {!customer.isWalkIn && (
              <div className="text-[11px] text-amber-400 flex items-center justify-end gap-1 pt-1">
                <Sparkles className="w-3 h-3" />
                <span>Customer will earn +{Math.floor(calculation.netPayable / db.settings.loyaltyEarningRatio)} points</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-3">
              <button
                type="button"
                onClick={() => handleConfirmSale(true)}
                disabled={cart.length === 0 || isPosting || !canAdd}
                className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 font-semibold rounded-lg text-xs border border-slate-700 transition"
              >
                Hold / Save Draft
              </button>

              <button
                type="button"
                onClick={handleOpenPayment}
                disabled={cart.length === 0 || !activeStore.isDayOpen || isPosting || !canAdd}
                className="py-2.5 px-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-1.5 transition"
              >
                <Banknote className="w-4 h-4" />
                Pay & Post (F4)
              </button>
            </div>
            {!canAdd && (
              <div className="text-[11px] text-amber-400/90 text-center pt-1 font-sans">
                Notice: View-only mode. Sales posting permission is required to checkout.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Multi-Tender Split Payment Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl space-y-4">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-base">Payment & Tender Breakdown</h3>
                <p className="text-xs text-slate-400">Split payment across multiple tenders</p>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">Net Amount</div>
                <div className="text-xl font-black font-mono text-indigo-400">₹{calculation.netPayable}</div>
              </div>
            </div>

            <div className="px-5 space-y-3 text-xs">
              {/* Cash Tender */}
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-emerald-400" />
                  <span className="font-semibold text-slate-200">Cash Payment</span>
                </div>
                <input
                  type="number"
                  min="0"
                  value={tenders.CASH}
                  onChange={(e) => setTenders({ ...tenders, CASH: Number(e.target.value) })}
                  className="w-32 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-right font-mono font-bold text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* UPI Tender */}
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-blue-400" />
                    <span className="font-semibold text-slate-200">UPI / QR Code</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={tenders.UPI}
                    onChange={(e) => setTenders({ ...tenders, UPI: Number(e.target.value) })}
                    className="w-32 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-right font-mono font-bold text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                {Number(tenders.UPI) > 0 && (
                  <input
                    type="text"
                    placeholder="Enter UPI Ref / Transaction UTR..."
                    value={tenderRefs.UPI}
                    onChange={(e) => setTenderRefs({ ...tenderRefs, UPI: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 placeholder-slate-600"
                  />
                )}
              </div>

              {/* Card Tender */}
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-purple-400" />
                    <span className="font-semibold text-slate-200">Credit / Debit Card</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={tenders.CARD}
                    onChange={(e) => setTenders({ ...tenders, CARD: Number(e.target.value) })}
                    className="w-32 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-right font-mono font-bold text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                {Number(tenders.CARD) > 0 && (
                  <input
                    type="text"
                    placeholder="Card last 4 digits / Auth code..."
                    value={tenderRefs.CARD}
                    onChange={(e) => setTenderRefs({ ...tenderRefs, CARD: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 placeholder-slate-600"
                  />
                )}
              </div>

              {/* On-Account Credit Tender */}
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-amber-400" />
                  <div>
                    <span className="font-semibold text-slate-200">On Account (Customer Credit)</span>
                    <div className="text-[10px] text-slate-400">
                      Limit available: ₹{((customer.creditLimit || 0) - (customer.creditOutstanding || 0)).toFixed(2)}
                    </div>
                  </div>
                </div>
                <input
                  type="number"
                  min="0"
                  value={tenders.CREDIT}
                  onChange={(e) => setTenders({ ...tenders, CREDIT: Number(e.target.value) })}
                  className="w-32 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-right font-mono font-bold text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Tender Summary Balance & Change Due */}
              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-1.5 font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>Total Tendered:</span>
                  <span className="font-bold text-white">₹{totalTendered.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Net Payable:</span>
                  <span>₹{calculation.netPayable.toFixed(2)}</span>
                </div>
                {changeDue > 0 && (
                  <div className="flex justify-between text-emerald-400 font-bold border-t border-slate-800 pt-1">
                    <span>Change Due to Customer:</span>
                    <span>₹{changeDue.toFixed(2)}</span>
                  </div>
                )}
                {totalTendered < calculation.netPayable && (
                  <div className="flex justify-between text-rose-400 font-bold border-t border-slate-800 pt-1">
                    <span>Remaining Due:</span>
                    <span>₹{(calculation.netPayable - totalTendered).toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-800 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg text-xs transition"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => handleConfirmSale(false)}
                disabled={totalTendered < calculation.netPayable || isPosting}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 transition"
              >
                <CheckCircle2 className="w-4 h-4" />
                {isPosting ? 'Posting Transaction...' : 'Confirm & Commit Sale'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
