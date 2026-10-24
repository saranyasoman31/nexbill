// SalesPostingService: Server-side validation, Idempotency, Multi-tender, Tax Split, Stock Locking, and Atomic Posting
import { getDatabase, saveDatabase, logAuditEvent } from './storageService.js';
import { StockService } from './stockService.js';


export const SalesPostingService = {
  /**
   * Calculate invoice totals and tax breakdowns
   */
  calculateInvoice(items, storeStateCode, customerStateCode, couponData = null, pointsToRedeem = 0) {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTaxable = 0;
    let totalCGST = 0;
    let totalSGST = 0;
    let totalIGST = 0;

    const isInterState = customerStateCode && storeStateCode && customerStateCode !== storeStateCode;

    const calculatedLines = items.map((item, index) => {
      const qty = Number(item.qty || 1);
      const rate = Number(item.rate || item.sellingRate || 0);
      const mrp = Number(item.mrp || rate);
      const discountPercent = Number(item.discountPercent || 0);

      // Server enforces: Selling rate cannot exceed MRP
      const effectiveRate = Math.min(rate, mrp);

      const gross = qty * effectiveRate;
      const discountAmount = Number(((gross * discountPercent) / 100).toFixed(2));
      const lineSubtotal = gross - discountAmount;

      const taxRate = Number(item.taxRate || 0);
      // Back-calculate taxable value and GST from inclusive selling price (or exclusive depending on standard)
      // Indian Retail GST is typically inclusive of MRP/Selling Rate:
      // Taxable = LineSubtotal / (1 + taxRate / 100)
      const taxableAmount = Number((lineSubtotal / (1 + taxRate / 100)).toFixed(2));
      const taxAmount = Number((lineSubtotal - taxableAmount).toFixed(2));

      let cgst = 0;
      let sgst = 0;
      let igst = 0;

      if (isInterState) {
        igst = taxAmount;
      } else {
        cgst = Number((taxAmount / 2).toFixed(2));
        sgst = Number((taxAmount - cgst).toFixed(2));
      }

      subtotal += gross;
      totalDiscount += discountAmount;
      totalTaxable += taxableAmount;
      totalCGST += cgst;
      totalSGST += sgst;
      totalIGST += igst;

      return {
        lineId: `LINE-${index + 1}-${Date.now()}`,
        productId: item.id || item.productId,
        sku: item.sku,
        name: item.name,
        barcode: item.barcode,
        hsnCode: item.hsnCode,
        uom: item.uom || 'Pcs',
        qty,
        returnedQty: 0,
        remainingReturnableQty: qty,
        rate: effectiveRate,
        mrp,
        discountPercent,
        discountAmount,
        taxRate,
        taxableAmount,
        cgstAmount: cgst,
        sgstAmount: sgst,
        igstAmount: igst,
        taxAmount,
        lineTotal: lineSubtotal,
      };
    });

    const netBeforeDiscounts = calculatedLines.reduce((sum, l) => sum + l.lineTotal, 0);

    // Apply Coupon
    let couponDiscount = 0;
    if (couponData && couponData.active) {
      if (netBeforeDiscounts >= couponData.minSpend) {
        if (couponData.discountType === 'PERCENT') {
          const rawDiscount = (netBeforeDiscounts * couponData.discountValue) / 100;
          couponDiscount = Math.min(rawDiscount, couponData.maxDiscountCap);
        } else {
          couponDiscount = Math.min(couponData.discountValue, couponData.maxDiscountCap);
        }
      }
    }
    couponDiscount = Number(couponDiscount.toFixed(2));

    // Apply Loyalty Points (1 point = ₹1, maximum 20% of net invoice)
    const maxAllowedPointsDiscount = Number(((netBeforeDiscounts - couponDiscount) * 0.20).toFixed(2));
    const pointsDiscountAmount = Math.min(Number(pointsToRedeem), maxAllowedPointsDiscount);

    const netPayableRaw = Math.max(0, netBeforeDiscounts - couponDiscount - pointsDiscountAmount);
    const netPayable = Math.round(netPayableRaw);
    const roundOff = Number((netPayable - netPayableRaw).toFixed(2));

    return {
      lines: calculatedLines,
      subtotal: Number(subtotal.toFixed(2)),
      lineDiscountTotal: Number(totalDiscount.toFixed(2)),
      couponDiscount,
      pointsRedeemed: pointsDiscountAmount,
      pointsDiscountAmount,
      taxableAmount: Number(totalTaxable.toFixed(2)),
      cgstAmount: Number(totalCGST.toFixed(2)),
      sgstAmount: Number(totalSGST.toFixed(2)),
      igstAmount: Number(totalIGST.toFixed(2)),
      totalTax: Number((totalCGST + totalSGST + totalIGST).toFixed(2)),
      roundOff,
      netPayable,
    };
  },

  /**
   * Post Sales Invoice atomically with complete validation
   */
  postSale(salePayload) {
    const {
      companyId,
      storeId,
      warehouseId,
      customerId,
      items,
      couponCode,
      pointsToRedeem,
      tenders,
      idempotencyToken,
      userId,
      isDraft = false,
    } = salePayload;

    const db = getDatabase();

    // 1. Idempotency Check (Duplicate prevention)
    if (idempotencyToken) {
      const existing = db.invoices.find(inv => inv.idempotencyToken === idempotencyToken);
      if (existing) {
        // Return existing invoice rather than creating duplicate
        return {
          success: true,
          isDuplicateSuppressed: true,
          invoice: existing,
          message: 'Idempotent request: duplicate submission safely suppressed.',
        };
      }
    }

    // 2. Validate Store & Warehouse
    const store = db.stores.find(s => s.id === storeId);
    if (!store) throw new Error('VALIDATION_ERROR: Invalid store reference.');
    if (!store.isDayOpen) {
      throw new Error('DAY_CLOSED_ERROR: Store day is currently closed. Postings are blocked until register opens.');
    }

    const warehouse = db.warehouses.find(w => w.id === warehouseId && w.storeId === storeId);
    if (!warehouse) throw new Error('VALIDATION_ERROR: Invalid warehouse reference for this store.');
    if (!warehouse.isSellable) throw new Error('VALIDATION_ERROR: Selected warehouse is marked non-sellable (quarantine/damaged).');

    // 3. Validate Customer
    const customer = db.customers.find(c => c.id === customerId);
    if (!customer) throw new Error('VALIDATION_ERROR: Customer is required.');

    // 4. Validate Items
    if (!items || items.length === 0) {
      throw new Error('VALIDATION_ERROR: At least one product line is required for sale.');
    }

    // 5. Coupon validation
    let coupon = null;
    if (couponCode) {
      coupon = db.coupons.find(c => c.code.toUpperCase() === couponCode.toUpperCase());
      if (!coupon || !coupon.active) {
        throw new Error(`COUPON_ERROR: Coupon code "${couponCode}" is invalid or expired.`);
      }
      if (coupon.singleUsePerCustomer && !customer.isWalkIn) {
        const alreadyUsed = db.invoices.some(inv => inv.customerId === customerId && inv.couponCode === coupon.code && inv.status === 'POSTED');
        if (alreadyUsed) {
          throw new Error(`COUPON_ERROR: Single-use coupon "${coupon.code}" has already been redeemed by customer ${customer.name}.`);
        }
      }
    }

    // 6. Privilege Points validation
    const pointsNum = Number(pointsToRedeem || 0);
    if (pointsNum > 0) {
      if (customer.isWalkIn) {
        throw new Error('LOYALTY_ERROR: Walk-in customers cannot redeem privilege points. Customer registration required.');
      }
      if (customer.loyaltyPoints < pointsNum) {
        throw new Error(`LOYALTY_ERROR: Customer has only ${customer.loyaltyPoints} points available. Cannot redeem ${pointsNum} points.`);
      }
    }

    // 7. Server-side Recalculation
    const calculation = this.calculateInvoice(
      items,
      store.stateCode,
      customer.stateCode,
      coupon,
      pointsNum
    );

    // 8. Tenders & Credit Limit Validation
    const totalTendered = (tenders || []).reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const creditTender = (tenders || []).find(t => t.method === 'CREDIT');
    if (creditTender && Number(creditTender.amount) > 0) {
      const creditAmt = Number(creditTender.amount);
      if (customer.isWalkIn) {
        throw new Error('CREDIT_ERROR: Credit sales (On Account) are not permitted for walk-in retail customers.');
      }
      const availableCredit = customer.creditLimit - customer.creditOutstanding;
      if (creditAmt > availableCredit) {
        throw new Error(`CREDIT_LIMIT_EXCEEDED: Customer available credit limit is ₹${availableCredit.toFixed(2)}, requested credit is ₹${creditAmt.toFixed(2)}.`);
      }
    }

    if (totalTendered < calculation.netPayable) {
      throw new Error(`PAYMENT_ERROR: Tendered amount (₹${totalTendered.toFixed(2)}) is less than net payable (₹${calculation.netPayable.toFixed(2)}).`);
    }

    // Generate Document Number
    const count = db.invoices.length + 1;
    const docNumber = `INV-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;
    const invoiceId = `INV-${Date.now()}`;
    const nowIso = new Date().toISOString();

    // 9. Stock Row Locking and Availability Verification
    const releaseCallbacks = [];
    try {
      if (!isDraft) {
        // Acquire lock for each product line
        for (const line of calculation.lines) {
          const release = StockService.acquireLock(warehouseId, line.productId);
          releaseCallbacks.push(release);

          // Verify stock balance
          const availableStock = StockService.getStockBalance(warehouseId, line.productId);
          if (db.settings.blockNegativeStock && line.qty > availableStock) {
            throw new Error(`INSUFFICIENT_STOCK: Stock check failed for "${line.name}". Available: ${availableStock}, Requested: ${line.qty}. Transaction rolled back.`);
          }
        }
      }

      // Calculate loyalty points earned (1 point per ₹100 spent, excluding walk-ins)
      let pointsEarned = 0;
      if (!customer.isWalkIn) {
        pointsEarned = Math.floor(calculation.netPayable / db.settings.loyaltyEarningRatio);
      }

      // 10. Construct Invoice Entity
      const invoice = {
        id: invoiceId,
        docNumber,
        companyId,
        storeId,
        warehouseId,
        customerId,
        customerName: customer.name,
        customerPhone: customer.phone,
        customerGstin: customer.gstin,
        date: nowIso,
        status: isDraft ? 'DRAFT' : 'POSTED',
        idempotencyToken: idempotencyToken || `IDEMP-${Date.now()}`,
        lines: calculation.lines,
        subtotal: calculation.subtotal,
        lineDiscountTotal: calculation.lineDiscountTotal,
        couponCode: coupon ? coupon.code : null,
        couponDiscount: calculation.couponDiscount,
        pointsRedeemed: calculation.pointsRedeemed,
        pointsDiscountAmount: calculation.pointsDiscountAmount,
        pointsEarned,
        taxableAmount: calculation.taxableAmount,
        cgstAmount: calculation.cgstAmount,
        sgstAmount: calculation.sgstAmount,
        igstAmount: calculation.igstAmount,
        totalTax: calculation.totalTax,
        roundOff: calculation.roundOff,
        netPayable: calculation.netPayable,
        paidAmount: totalTendered,
        balanceDue: Math.max(0, calculation.netPayable - totalTendered),
        changeDue: Math.max(0, totalTendered - calculation.netPayable),
        tenders: tenders || [{ method: 'CASH', amount: calculation.netPayable }],
        createdBy: userId || 'USR-01',
        postedAt: isDraft ? null : nowIso,
        reversedAt: null,
        reversalReason: null,
      };

      // 11. Atomic State Commit
      db.invoices.push(invoice);

      if (!isDraft) {
        // Post Stock Movements
        for (const line of calculation.lines) {
          StockService.postMovement({
            docType: 'SALE_OUT',
            docId: invoice.id,
            docNumber: invoice.docNumber,
            warehouseId,
            productId: line.productId,
            quantityDelta: -line.qty,
            costRate: line.rate,
            reason: `Retail customer billing (${invoice.docNumber})`,
            userId,
          }, db);
        }

        // Update Coupon Usage
        if (coupon) {
          coupon.usedCount = (coupon.usedCount || 0) + 1;
        }

        // Update Customer Loyalty and Credit
        if (!customer.isWalkIn) {
          const pointsDelta = pointsEarned - calculation.pointsRedeemed;
          customer.loyaltyPoints = Math.max(0, customer.loyaltyPoints + pointsDelta);

          // Append to immutable loyalty ledger
          if (calculation.pointsRedeemed > 0) {
            db.loyaltyLedger.push({
              id: 'LOY-' + Date.now() + '-1',
              customerId,
              docType: 'SALE_REDEEM',
              docNumber: invoice.docNumber,
              pointsDelta: -calculation.pointsRedeemed,
              balanceAfter: customer.loyaltyPoints,
              remarks: `Points redeemed on ${invoice.docNumber}`,
              timestamp: nowIso,
            });
          }

          if (pointsEarned > 0) {
            db.loyaltyLedger.push({
              id: 'LOY-' + Date.now() + '-2',
              customerId,
              docType: 'SALE_EARN',
              docNumber: invoice.docNumber,
              pointsDelta: pointsEarned,
              balanceAfter: customer.loyaltyPoints,
              remarks: `Points earned on ${invoice.docNumber}`,
              timestamp: nowIso,
            });
          }

          if (creditTender && Number(creditTender.amount) > 0) {
            customer.creditOutstanding += Number(creditTender.amount);
          }
        }

        logAuditEvent('SALE_POSTED', userId, `Invoice ${invoice.docNumber} posted. Net: ₹${invoice.netPayable}, Items: ${calculation.lines.length}`);
      }

      saveDatabase(db);

      return {
        success: true,
        invoice,
        message: isDraft ? 'Draft sale saved successfully.' : 'Sales invoice posted successfully.',
      };
    } finally {
      // Release all acquired row locks
      releaseCallbacks.forEach(release => release());
    }
  }
};
