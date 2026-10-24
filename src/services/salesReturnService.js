// SalesReturnService: Itemized Returns, Disposition Routing, Point Reversals, and Audit Links
import { getDatabase, saveDatabase, logAuditEvent } from './storageService.js';
import { StockService } from './stockService.js';


export const SalesReturnService = {
  /**
   * Get return eligibility details for an invoice
   */
  getInvoiceForReturn(invoiceNumber) {
    const db = getDatabase();
    const invoice = db.invoices.find(inv => inv.docNumber === invoiceNumber);
    if (!invoice) return null;
    if (invoice.status !== 'POSTED') {
      throw new Error(`RETURN_VALIDATION_ERROR: Invoice ${invoiceNumber} status is ${invoice.status}. Only POSTED invoices can be returned.`);
    }

    return {
      ...invoice,
      lines: invoice.lines.map(l => ({
        ...l,
        maxReturnableQty: Math.max(0, l.qty - (l.returnedQty || 0)),
      }))
    };
  },

  /**
   * Process and post Sales Return
   * @param {Object} returnPayload
   * {
   *   originalInvoiceNumber: string,
   *   items: [{ lineId, productId, returnQty, disposition: 'RESTOCK'|'DAMAGED_QUARANTINE'|'SUPPLIER_RETURN'|'NON_STOCKABLE', reason }],
   *   refundMethod: 'CASH' | 'STORE_CREDIT' | 'UPI',
   *   notes: string,
   *   userId: string,
   * }
   */
  postSalesReturn(returnPayload) {
    const {
      originalInvoiceNumber,
      items,
      refundMethod = 'CASH',
      notes = '',
      userId = 'USR-01',
    } = returnPayload;

    const db = getDatabase();

    const invoice = db.invoices.find(inv => inv.docNumber === originalInvoiceNumber);
    if (!invoice) throw new Error(`RETURN_ERROR: Original invoice "${originalInvoiceNumber}" not found.`);
    if (invoice.status !== 'POSTED') {
      throw new Error(`RETURN_ERROR: Invoice ${originalInvoiceNumber} is ${invoice.status}. Only POSTED invoices can be returned.`);
    }

    if (!items || items.length === 0) {
      throw new Error('RETURN_ERROR: At least one item must be selected for return.');
    }

    // Verify quantities against remaining returnable amounts
    let totalRefundAmount = 0;
    let totalTaxRefund = 0;
    const processedLines = [];

    for (const retItem of items) {
      const originalLine = invoice.lines.find(l => l.lineId === retItem.lineId || l.productId === retItem.productId);
      if (!originalLine) {
        throw new Error(`RETURN_ERROR: Product ${retItem.productId} does not belong to original invoice.`);
      }

      const returnQty = Number(retItem.returnQty);
      if (returnQty <= 0) continue;

      const remaining = originalLine.qty - (originalLine.returnedQty || 0);
      if (returnQty > remaining) {
        throw new Error(`EXCESS_RETURN_ERROR: Cannot return ${returnQty} of "${originalLine.name}". Maximum returnable is ${remaining}.`);
      }

      // Unit refund value based on original rate and line discount
      const unitNetRate = originalLine.lineTotal / originalLine.qty;
      const lineRefund = Number((unitNetRate * returnQty).toFixed(2));
      const lineTaxRefund = Number(((originalLine.taxAmount / originalLine.qty) * returnQty).toFixed(2));

      totalRefundAmount += lineRefund;
      totalTaxRefund += lineTaxRefund;

      processedLines.push({
        lineId: originalLine.lineId,
        productId: originalLine.productId,
        name: originalLine.name,
        returnQty,
        unitRate: originalLine.rate,
        unitNetRate,
        lineRefund,
        taxRefund: lineTaxRefund,
        disposition: retItem.disposition || 'RESTOCK', // RESTOCK | DAMAGED_QUARANTINE | SUPPLIER_RETURN | NON_STOCKABLE
        reason: retItem.reason || 'Customer return',
      });
    }

    if (processedLines.length === 0) {
      throw new Error('RETURN_ERROR: No valid return quantities specified.');
    }

    const count = db.salesReturns.length + 1;
    const docNumber = `RTN-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;
    const returnId = `RTN-${Date.now()}`;
    const nowIso = new Date().toISOString();

    const salesReturnRecord = {
      id: returnId,
      docNumber,
      originalInvoiceId: invoice.id,
      originalInvoiceNumber: invoice.docNumber,
      companyId: invoice.companyId,
      storeId: invoice.storeId,
      warehouseId: invoice.warehouseId,
      customerId: invoice.customerId,
      customerName: invoice.customerName,
      date: nowIso,
      status: 'POSTED',
      lines: processedLines,
      totalRefundAmount: Number(totalRefundAmount.toFixed(2)),
      totalTaxRefund: Number(totalTaxRefund.toFixed(2)),
      refundMethod,
      notes,
      createdBy: userId,
      postedAt: nowIso,
    };

    // 1. Update returned quantities on original invoice lines
    for (const retLine of processedLines) {
      const origLine = invoice.lines.find(l => l.lineId === retLine.lineId);
      if (origLine) {
        origLine.returnedQty = (origLine.returnedQty || 0) + retLine.returnQty;
        origLine.remainingReturnableQty = Math.max(0, origLine.qty - origLine.returnedQty);
      }
    }

    // 2. Route Stock based on item disposition
    for (const retLine of processedLines) {
      if (retLine.disposition === 'RESTOCK') {
        // Increases sellable stock in original selling warehouse
        StockService.postMovement({
          docType: 'RETURN_IN',
          docId: salesReturnRecord.id,
          docNumber: salesReturnRecord.docNumber,
          warehouseId: invoice.warehouseId,
          productId: retLine.productId,
          quantityDelta: retLine.returnQty,
          costRate: retLine.unitNetRate,
          reason: `Restocked return from invoice ${invoice.docNumber}`,
          userId,
        }, db);
      } else if (retLine.disposition === 'DAMAGED_QUARANTINE') {
        // Route to quarantine warehouse if present, else log as quarantine movement
        const quarantineWh = db.warehouses.find(w => w.type === 'QUARANTINE' && w.companyId === invoice.companyId) || { id: invoice.warehouseId };
        StockService.postMovement({
          docType: 'RETURN_IN',
          docId: salesReturnRecord.id,
          docNumber: salesReturnRecord.docNumber,
          warehouseId: quarantineWh.id,
          productId: retLine.productId,
          quantityDelta: retLine.returnQty,
          costRate: retLine.unitNetRate,
          reason: `Damaged item quarantined from invoice ${invoice.docNumber}`,
          userId,
        }, db);
      }
      // NON_STOCKABLE does not increase sellable inventory
    }

    // 3. Reverse Loyalty Points
    const customer = db.customers.find(c => c.id === invoice.customerId);
    if (customer && !customer.isWalkIn) {
      // Reverse proportional points earned on original sale
      const returnRatio = totalRefundAmount / invoice.netPayable;
      const pointsToReverse = Math.round((invoice.pointsEarned || 0) * returnRatio);

      if (pointsToReverse > 0) {
        customer.loyaltyPoints = Math.max(0, customer.loyaltyPoints - pointsToReverse);
        db.loyaltyLedger.push({
          id: 'LOY-' + Date.now() + '-RTN',
          customerId: customer.id,
          docType: 'RETURN_REVERSE',
          docNumber: salesReturnRecord.docNumber,
          pointsDelta: -pointsToReverse,
          balanceAfter: customer.loyaltyPoints,
          remarks: `Earned points reversed due to return on ${invoice.docNumber}`,
          timestamp: nowIso,
        });
      }

      // If refundMethod is STORE_CREDIT, credit to customer account
      if (refundMethod === 'STORE_CREDIT') {
        customer.creditOutstanding = Math.max(0, customer.creditOutstanding - totalRefundAmount);
      }
    }

    db.salesReturns.push(salesReturnRecord);
    saveDatabase(db);
    logAuditEvent('SALES_RETURN_POSTED', userId, `Sales return ${docNumber} processed for invoice ${invoice.docNumber}. Refund: ₹${totalRefundAmount.toFixed(2)}`);

    return {
      success: true,
      salesReturn: salesReturnRecord,
      message: `Return voucher ${docNumber} processed successfully. Refund ₹${totalRefundAmount.toFixed(2)} approved.`,
    };
  }
};
