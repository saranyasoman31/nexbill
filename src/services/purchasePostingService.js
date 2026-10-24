// PurchasePostingService: Supplier Validation, Duplicate Invoice Check, PURCHASE_IN Posting, and Valuation
import { getDatabase, saveDatabase, logAuditEvent } from './storageService.js';
import { StockService } from './stockService.js';


export const PurchasePostingService = {
  /**
   * Post Purchase Bill
   * @param {Object} purchasePayload
   */
  postPurchase(purchasePayload) {
    const {
      companyId,
      storeId,
      warehouseId,
      supplierId,
      supplierInvoiceNo,
      items,
      notes = '',
      userId = 'USR-02',
    } = purchasePayload;

    const db = getDatabase();

    // 1. Supplier Validation
    const supplier = db.suppliers.find(s => s.id === supplierId);
    if (!supplier) throw new Error('PURCHASE_ERROR: Supplier is required.');
    if (!supplier.active) throw new Error(`PURCHASE_ERROR: Supplier "${supplier.name}" is deactivated.`);

    // 2. Duplicate Supplier Invoice Check (Section 4)
    if (supplierInvoiceNo && supplierInvoiceNo.trim()) {
      const isDuplicate = db.purchases.some(
        p => p.supplierId === supplierId &&
             p.supplierInvoiceNo?.trim().toLowerCase() === supplierInvoiceNo.trim().toLowerCase() &&
             p.status === 'POSTED'
      );
      if (isDuplicate) {
        throw new Error(`DUPLICATE_INVOICE_ERROR: Supplier invoice number "${supplierInvoiceNo}" has already been posted for supplier "${supplier.name}". Duplicate blocked.`);
      }
    }

    // 3. Warehouse Validation
    const warehouse = db.warehouses.find(w => w.id === warehouseId);
    if (!warehouse) throw new Error('PURCHASE_ERROR: Receiving warehouse is required.');

    // 4. Lines Validation
    if (!items || items.length === 0) {
      throw new Error('PURCHASE_ERROR: At least one item is required in the purchase entry.');
    }

    let subtotal = 0;
    let totalTax = 0;

    const calculatedLines = items.map((item, idx) => {
      const qty = Number(item.qty);
      const rate = Number(item.rate || item.costRate || 0);
      const taxRate = Number(item.taxRate || 0);

      if (qty <= 0) throw new Error(`PURCHASE_ERROR: Line #${idx + 1} quantity must be greater than zero.`);
      if (rate < 0) throw new Error(`PURCHASE_ERROR: Line #${idx + 1} cost rate cannot be negative.`);

      const lineGross = qty * rate;
      const lineTax = (lineGross * taxRate) / 100;
      const lineTotal = lineGross + lineTax;

      subtotal += lineGross;
      totalTax += lineTax;

      return {
        lineId: `PLINE-${idx + 1}-${Date.now()}`,
        productId: item.productId || item.id,
        name: item.name,
        qty,
        returnedQty: 0,
        rate,
        taxRate,
        taxAmount: Number(lineTax.toFixed(2)),
        lineTotal: Number(lineTotal.toFixed(2)),
      };
    });

    const netAmount = Number((subtotal + totalTax).toFixed(2));
    const count = db.purchases.length + 1;
    const docNumber = `PUR-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;
    const purchaseId = `PUR-${Date.now()}`;
    const nowIso = new Date().toISOString();

    const purchaseRecord = {
      id: purchaseId,
      docNumber,
      supplierId,
      supplierName: supplier.name,
      supplierInvoiceNo: supplierInvoiceNo || `REF-${Date.now()}`,
      companyId,
      storeId,
      warehouseId,
      date: nowIso,
      status: 'POSTED',
      lines: calculatedLines,
      subtotal: Number(subtotal.toFixed(2)),
      totalTax: Number(totalTax.toFixed(2)),
      netAmount,
      paymentStatus: 'PAID',
      notes,
      createdBy: userId,
      postedAt: nowIso,
    };

    // Commit purchase and write PURCHASE_IN movements
    db.purchases.push(purchaseRecord);

    for (const line of calculatedLines) {
      StockService.postMovement({
        docType: 'PURCHASE_IN',
        docId: purchaseRecord.id,
        docNumber: purchaseRecord.docNumber,
        warehouseId,
        productId: line.productId,
        quantityDelta: line.qty,
        costRate: line.rate,
        reason: `Purchase stock receipt (${purchaseRecord.supplierInvoiceNo})`,
        userId,
      }, db);
    }

    saveDatabase(db);
    logAuditEvent('PURCHASE_POSTED', userId, `Purchase ${docNumber} posted from ${supplier.name}. Net: ₹${netAmount}`);

    return {
      success: true,
      purchase: purchaseRecord,
      message: `Purchase invoice ${docNumber} posted successfully. Inventory valuation updated.`,
    };
  },

  /**
   * Post Purchase Return (Debit Note)
   */
  postPurchaseReturn({ originalPurchaseDocNumber, items, reason, userId = 'USR-02' }) {
    const db = getDatabase();
    const purchase = db.purchases.find(p => p.docNumber === originalPurchaseDocNumber);
    if (!purchase) throw new Error(`PURCHASE_RETURN_ERROR: Original purchase "${originalPurchaseDocNumber}" not found.`);

    let totalDebit = 0;
    const returnLines = [];

    for (const item of items) {
      const origLine = purchase.lines.find(l => l.productId === item.productId);
      if (!origLine) throw new Error(`PURCHASE_RETURN_ERROR: Product ${item.productId} was not in purchase ${originalPurchaseDocNumber}.`);

      const returnQty = Number(item.returnQty);
      if (returnQty <= 0) continue;

      const remaining = origLine.qty - (origLine.returnedQty || 0);
      if (returnQty > remaining) {
        throw new Error(`EXCESS_RETURN_ERROR: Cannot return ${returnQty} units. Maximum returnable on this purchase is ${remaining}.`);
      }

      // Check current stock availability
      const currentStock = StockService.getStockBalance(purchase.warehouseId, origLine.productId);
      if (returnQty > currentStock) {
        throw new Error(`INSUFFICIENT_STOCK: Warehouse has only ${currentStock} units in stock. Cannot return ${returnQty} units to supplier.`);
      }

      const lineTotal = returnQty * origLine.rate;
      totalDebit += lineTotal;

      returnLines.push({
        productId: origLine.productId,
        name: origLine.name,
        returnQty,
        rate: origLine.rate,
        lineTotal,
      });
    }

    if (returnLines.length === 0) throw new Error('PURCHASE_RETURN_ERROR: No valid return items provided.');

    const count = db.purchaseReturns.length + 1;
    const docNumber = `DN-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;
    const nowIso = new Date().toISOString();

    const debitNote = {
      id: `DN-${Date.now()}`,
      docNumber,
      originalPurchaseId: purchase.id,
      originalPurchaseDocNumber: purchase.docNumber,
      supplierId: purchase.supplierId,
      supplierName: purchase.supplierName,
      companyId: purchase.companyId,
      storeId: purchase.storeId,
      warehouseId: purchase.warehouseId,
      date: nowIso,
      lines: returnLines,
      totalDebitAmount: Number(totalDebit.toFixed(2)),
      reason: reason || 'Supplier return',
      createdBy: userId,
      postedAt: nowIso,
    };

    // Update original purchase returned qtys
    for (const rLine of returnLines) {
      const origLine = purchase.lines.find(l => l.productId === rLine.productId);
      if (origLine) {
        origLine.returnedQty = (origLine.returnedQty || 0) + rLine.returnQty;
      }

      // Post RETURN_OUT movement
      StockService.postMovement({
        docType: 'RETURN_OUT',
        docId: debitNote.id,
        docNumber: debitNote.docNumber,
        warehouseId: purchase.warehouseId,
        productId: rLine.productId,
        quantityDelta: -rLine.returnQty,
        costRate: rLine.rate,
        reason: `Debit note to supplier (${purchase.supplierName})`,
        userId,
      }, db);
    }

    db.purchaseReturns.push(debitNote);
    saveDatabase(db);
    logAuditEvent('PURCHASE_RETURN_POSTED', userId, `Purchase Debit Note ${docNumber} posted. Debit: ₹${totalDebit.toFixed(2)}`);

    return {
      success: true,
      debitNote,
      message: `Debit Note ${docNumber} posted. Stock deducted from warehouse.`,
    };
  }
};
