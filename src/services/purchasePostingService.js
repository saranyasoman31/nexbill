// PurchasePostingService: Comprehensive Procurement Engine, Branch Support, Stock Valuation, PO Conversion, Edit & Delete
import { getDatabase, saveDatabase, logAuditEvent, logBacklog } from './storageService.js';
import { StockService } from './stockService.js';
import { numberToWords } from '../utils/numberToWords.js';

export const PurchasePostingService = {
  /**
   * Generate next sequential Purchase Document Number (e.g. PUR-2026-0001)
   */
  generateNextPurchaseDocNumber(db) {
    const existingPurchases = db.purchases || [];
    const year = new Date().getFullYear();
    let maxSeq = 0;
    for (const p of existingPurchases) {
      if (p.docNumber) {
        const match = p.docNumber.match(/PUR[\/-]\d{4}[\/-](\d+)/i);
        if (match) {
          const seq = parseInt(match[1], 10);
          if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
        }
      }
    }
    return `PUR-${year}-${String(maxSeq + 1).padStart(4, '0')}`;
  },

  /**
   * Post Purchase Bill / Inward Goods Receipt
   * @param {Object} purchasePayload
   */
  postPurchase(purchasePayload) {
    const {
      companyId,
      storeId,
      warehouseId,
      supplierId,
      supplierInvoiceNo,
      supplierInvoiceDate,
      supplierInvoiceAmount,
      date: customDate,
      docNumber: customDocNumber,
      poId: rawPoId,
      purchaseOrderId,
      poNumber: rawPoNumber,
      purchaseOrderNo,
      purchaseOrderRef,
      items,
      discountType = 'FLAT',
      discountValue = 0,
      discountAmount: customDiscountAmount,
      otherCharges = 0,
      otherChargesRemark = '',
      paymentMode = 'CASH',
      paymentStatus = 'PAID',
      paidAmount = 0,
      notes = '',
      userId = 'USR-ADMIN',
    } = purchasePayload;

    const poId = rawPoId || purchaseOrderId;
    const poNumber = rawPoNumber || purchaseOrderNo || purchaseOrderRef;

    const db = getDatabase();

    // 1. Supplier Validation
    const supplier = db.suppliers.find((s) => s.id === supplierId);
    if (!supplier) throw new Error('PURCHASE_ERROR: Supplier is required.');
    if (supplier.active === false || supplier.isActive === false) throw new Error(`PURCHASE_ERROR: Supplier "${supplier.name}" is deactivated.`);

    // 2. Duplicate Supplier Invoice Check
    if (supplierInvoiceNo && supplierInvoiceNo.trim()) {
      const isDuplicate = (db.purchases || []).some(
        (p) =>
          p.supplierId === supplierId &&
          p.supplierInvoiceNo?.trim().toLowerCase() === supplierInvoiceNo.trim().toLowerCase() &&
          p.status !== 'CANCELLED'
      );
      if (isDuplicate) {
        throw new Error(
          `DUPLICATE_INVOICE_ERROR: Supplier invoice number "${supplierInvoiceNo}" has already been posted for supplier "${supplier.name}". Duplicate blocked.`
        );
      }
    }

    // 3. Branch & Warehouse Resolution
    let finalStoreId = storeId;
    let finalWarehouseId = warehouseId;
    if (!finalWarehouseId && finalStoreId) {
      const wh = (db.warehouses || []).find((w) => w.storeId === finalStoreId);
      finalWarehouseId = wh ? wh.id : (db.warehouses?.[0]?.id || 'WH-MUM-MAIN');
    }
    if (!finalStoreId && finalWarehouseId) {
      const wh = (db.warehouses || []).find((w) => w.id === finalWarehouseId);
      finalStoreId = wh ? wh.storeId : (db.stores?.[0]?.id || 'STR-01');
    }
    if (!finalStoreId) finalStoreId = db.stores?.[0]?.id || 'STR-01';
    if (!finalWarehouseId) finalWarehouseId = db.warehouses?.[0]?.id || 'WH-MUM-MAIN';

    const store = (db.stores || []).find((s) => s.id === finalStoreId) || {};
    const warehouse = (db.warehouses || []).find((w) => w.id === finalWarehouseId) || {};

    // 4. Lines Validation
    if (!items || items.length === 0) {
      throw new Error('PURCHASE_ERROR: At least one product is required in the purchase entry.');
    }

    // Determine supply type (Local vs Interstate)
    const isInterstate =
      purchasePayload.supplyType === 'INTERSTATE' ||
      (supplier.stateCode && store.stateCode && supplier.stateCode !== store.stateCode) ||
      supplier.supplyType === 'INTERSTATE';

    let grossSubtotal = 0;
    let lineDiscountsTotal = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;
    let totalQty = 0;

    const calculatedLines = items.map((item, idx) => {
      const prod = (db.products || []).find((p) => p.id === (item.productId || item.id)) || {};
      const rawQty = (item.quantity !== undefined && item.qty !== undefined && item.quantity !== item.qty)
        ? item.quantity
        : (item.qty ?? item.quantity ?? 1);
      const qty = Number(rawQty);
      const costPrice = Number(item.costPrice ?? item.rate ?? item.costRate ?? prod.costRate ?? 0);
      const taxRate = Number(item.taxRate ?? item.gstRate ?? prod.taxRate ?? prod.gstRate ?? 0);
      const mrp = Number(item.mrp ?? prod.mrp ?? 0);
      const sellingPrice = Number(item.sellingPrice ?? prod.sellingRate ?? 0);
      const lineDiscPercent = Number(item.discountPercent || 0);

      if (qty <= 0) throw new Error(`PURCHASE_ERROR: Line #${idx + 1} (${item.name || 'Item'}) quantity must be greater than zero.`);
      if (costPrice < 0) throw new Error(`PURCHASE_ERROR: Line #${idx + 1} (${item.name || 'Item'}) cost price cannot be negative.`);

      const lineGross = qty * costPrice;
      const lineDiscVal = Number(((lineGross * lineDiscPercent) / 100).toFixed(2));
      const taxable = lineGross - lineDiscVal;

      let cgstRate = 0;
      let cgstAmount = 0;
      let sgstRate = 0;
      let sgstAmount = 0;
      let igstRate = 0;
      let igstAmount = 0;

      if (isInterstate) {
        igstRate = taxRate;
        igstAmount = Number(((taxable * igstRate) / 100).toFixed(2));
      } else {
        cgstRate = taxRate / 2;
        cgstAmount = Number(((taxable * cgstRate) / 100).toFixed(2));
        sgstRate = taxRate / 2;
        sgstAmount = Number(((taxable * sgstRate) / 100).toFixed(2));
      }

      const lineTax = cgstAmount + sgstAmount + igstAmount;
      const lineTotal = Number((taxable + lineTax).toFixed(2));
      const singleUnitPrice = Number((qty > 0 ? lineTotal / qty : costPrice).toFixed(2));
      const margin = Number((sellingPrice - costPrice).toFixed(2));
      const marginPercent = costPrice > 0 ? Number((((sellingPrice - costPrice) / costPrice) * 100).toFixed(1)) : 0;

      grossSubtotal += taxable;
      lineDiscountsTotal += lineDiscVal;
      cgstTotal += cgstAmount;
      sgstTotal += sgstAmount;
      igstTotal += igstAmount;
      totalQty += qty;

      return {
        lineId: item.lineId || `PLINE-${idx + 1}-${Date.now()}`,
        productId: item.productId || item.id,
        name: item.name || prod.name || item.productId,
        sku: item.sku || prod.sku || '',
        uom: item.uom || item.unit || prod.uom || 'PCS',
        batchNo: (item.batchNo || '').trim(),
        expiryDate: item.expiryDate || '',
        qty,
        returnedQty: 0,
        costPrice,
        rate: costPrice, // backward compatibility
        discountPercent: lineDiscPercent,
        discountAmount: lineDiscVal,
        taxableAmount: Number(taxable.toFixed(2)),
        taxRate,
        cgstRate,
        cgstAmount,
        sgstRate,
        sgstAmount,
        igstRate,
        igstAmount,
        taxAmount: Number(lineTax.toFixed(2)),
        singleUnitPrice,
        unitPriceLanded: singleUnitPrice,
        mrp,
        sellingPrice,
        margin,
        marginAmount: margin,
        marginPercent,
        lineTotal,
        totalAmount: lineTotal,
        total: lineTotal,
      };
    });

    // Bill Discount computation
    let billDiscountAmt = 0;
    if (customDiscountAmount !== undefined && customDiscountAmount !== null) {
      billDiscountAmt = Number(customDiscountAmount) || 0;
    } else if (discountType === 'PERCENT') {
      billDiscountAmt = Number(((grossSubtotal * Number(discountValue || 0)) / 100).toFixed(2));
    } else {
      billDiscountAmt = Number(discountValue || 0);
    }

    const totalTax = Number((cgstTotal + sgstTotal + igstTotal).toFixed(2));
    const extraCharges = Number(Number(otherCharges || 0).toFixed(2));
    const unroundedTotal = grossSubtotal - billDiscountAmt + extraCharges + totalTax;
    const grandTotal = Math.round(unroundedTotal);
    const roundOff = Number((grandTotal - unroundedTotal).toFixed(2));
    const netAmount = grandTotal;

    const docNumber = customDocNumber || this.generateNextPurchaseDocNumber(db);
    const purchaseId = `PUR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const nowIso = new Date().toISOString();
    const purchaseDate = customDate || nowIso;

    const purchaseRecord = {
      id: purchaseId,
      docNumber,
      supplierId,
      supplierName: supplier.name,
      supplierInvoiceNo: (supplierInvoiceNo || `REF-${Date.now()}`).trim(),
      supplierInvoiceDate: supplierInvoiceDate || purchaseDate.split('T')[0],
      supplierInvoiceAmount: supplierInvoiceAmount ? Number(supplierInvoiceAmount) : netAmount,
      companyId: companyId || store.companyId || 'COMP-01',
      storeId: finalStoreId,
      storeName: store.name || 'Main Store',
      branchName: store.name || 'Main Store',
      warehouseId: finalWarehouseId,
      warehouseName: warehouse.name || 'Main Warehouse',
      date: purchaseDate,
      status: 'POSTED',
      supplyType: isInterstate ? 'INTERSTATE' : 'LOCAL',
      lines: calculatedLines,
      items: calculatedLines,
      subtotal: Number(grossSubtotal.toFixed(2)),
      lineDiscountsTotal: Number(lineDiscountsTotal.toFixed(2)),
      discountType,
      discountValue: Number(discountValue || 0),
      discountAmount: Number(billDiscountAmt.toFixed(2)),
      otherCharges: extraCharges,
      otherChargesRemark: otherChargesRemark || '',
      cgstTotal: Number(cgstTotal.toFixed(2)),
      cgstAmount: Number(cgstTotal.toFixed(2)),
      sgstTotal: Number(sgstTotal.toFixed(2)),
      sgstAmount: Number(sgstTotal.toFixed(2)),
      igstTotal: Number(igstTotal.toFixed(2)),
      igstAmount: Number(igstTotal.toFixed(2)),
      totalTax,
      taxAmount: totalTax,
      roundOff,
      netAmount,
      grandTotal,
      amountInWords: numberToWords(grandTotal),
      paymentMode,
      paymentStatus,
      paidAmount: paymentStatus === 'PAID' ? grandTotal : Number(paidAmount || 0),
      balanceDue: paymentStatus === 'PAID' ? 0 : Number((grandTotal - Number(paidAmount || 0)).toFixed(2)),
      poId: poId || null,
      poNumber: poNumber || null,
      purchaseOrderRef: poNumber || null,
      notes,
      totalQty,
      createdBy: userId,
      postedAt: nowIso,
    };

    // 5. Commit purchase to db.purchases
    db.purchases = db.purchases || [];
    db.purchases.push(purchaseRecord);

    // 6. Write PURCHASE_IN movements and update product master prices
    for (const line of calculatedLines) {
      StockService.postMovement(
        {
          docType: 'PURCHASE_IN',
          docId: purchaseRecord.id,
          docNumber: purchaseRecord.docNumber,
          warehouseId: finalWarehouseId,
          productId: line.productId,
          quantityDelta: line.qty,
          costRate: line.costPrice,
          reason: `Purchase stock receipt (${purchaseRecord.supplierInvoiceNo})`,
          userId,
        },
        db
      );

      // Sync latest purchasing prices into product master
      const prod = (db.products || []).find((p) => p.id === line.productId);
      if (prod) {
        if (line.costPrice > 0) prod.costRate = line.costPrice;
        if (line.sellingPrice > 0) prod.sellingRate = line.sellingPrice;
        if (line.mrp > 0) prod.mrp = line.mrp;
      }
    }

    // 7. Update linked Purchase Order status to CONVERTED
    if (poId || poNumber) {
      const po = (db.purchaseOrders || []).find((p) => (poId && p.id === poId) || (poNumber && p.poNumber === poNumber));
      if (po) {
        po.status = 'CONVERTED';
        po.convertedPurchaseId = purchaseRecord.id;
        po.convertedPurchaseDocNumber = purchaseRecord.docNumber;
        po.convertedAt = nowIso;
      }
    }

    saveDatabase(db);
    logAuditEvent('PURCHASE_POSTED', userId, `Purchase ${docNumber} posted from ${supplier.name}. Net: ₹${netAmount}`);
    logBacklog({
      action: 'SAVE',
      formName: 'Purchase Inward',
      recordRef: purchaseRecord.docNumber,
      userId,
      details: `Saved Inward Purchase Receipt ${purchaseRecord.docNumber} (Supplier: ${supplier.name}, Inv: ${purchaseRecord.supplierInvoiceNo}, Branch: ${purchaseRecord.branchName}, Total: ₹${netAmount})`,
    });

    return {
      success: true,
      purchase: purchaseRecord,
      message: `Purchase invoice ${docNumber} posted successfully. Stock added to ${purchaseRecord.branchName}.`,
    };
  },

  /**
   * Update an existing Purchase Bill
   * @param {string} purchaseId
   * @param {Object} purchasePayload
   */
  updatePurchase(purchaseId, purchasePayload) {
    const db = getDatabase();
    const existingIndex = (db.purchases || []).findIndex((p) => p.id === purchaseId);
    if (existingIndex === -1) {
      throw new Error(`PURCHASE_ERROR: Purchase record "${purchaseId}" not found for updating.`);
    }
    const oldPurchase = db.purchases[existingIndex];

    // Check if any returns exist against this purchase
    const hasReturns = (db.purchaseReturns || []).some(
      (pr) => pr.originalPurchaseId === purchaseId || pr.originalPurchaseDocNumber === oldPurchase.docNumber
    );
    if (hasReturns) {
      throw new Error(
        `PURCHASE_ERROR: Cannot edit Purchase "${oldPurchase.docNumber}" because Debit Notes / Returns have already been issued against it.`
      );
    }

    const {
      companyId = oldPurchase.companyId,
      storeId = oldPurchase.storeId,
      warehouseId = oldPurchase.warehouseId,
      supplierId = oldPurchase.supplierId,
      supplierInvoiceNo = oldPurchase.supplierInvoiceNo,
      supplierInvoiceDate = oldPurchase.supplierInvoiceDate,
      supplierInvoiceAmount = oldPurchase.supplierInvoiceAmount,
      date = oldPurchase.date,
      items,
      discountType = oldPurchase.discountType || 'FLAT',
      discountValue = oldPurchase.discountValue || 0,
      otherCharges = oldPurchase.otherCharges || 0,
      otherChargesRemark = oldPurchase.otherChargesRemark || '',
      paymentMode = oldPurchase.paymentMode || 'CASH',
      paymentStatus = oldPurchase.paymentStatus || 'PAID',
      paidAmount = oldPurchase.paidAmount || 0,
      notes = oldPurchase.notes || '',
      userId = 'USR-ADMIN',
    } = purchasePayload;

    // Supplier validation
    const supplier = db.suppliers.find((s) => s.id === supplierId);
    if (!supplier) throw new Error('PURCHASE_ERROR: Supplier is required.');

    // Duplicate invoice check excluding current purchase
    if (supplierInvoiceNo && supplierInvoiceNo.trim()) {
      const isDuplicate = db.purchases.some(
        (p) =>
          p.id !== purchaseId &&
          p.supplierId === supplierId &&
          p.supplierInvoiceNo?.trim().toLowerCase() === supplierInvoiceNo.trim().toLowerCase() &&
          p.status !== 'CANCELLED'
      );
      if (isDuplicate) {
        throw new Error(
          `DUPLICATE_INVOICE_ERROR: Supplier invoice number "${supplierInvoiceNo}" is already used by another purchase for "${supplier.name}".`
        );
      }
    }

    // Branch & Warehouse resolution
    let finalStoreId = storeId;
    let finalWarehouseId = warehouseId;
    if (!finalWarehouseId && finalStoreId) {
      const wh = (db.warehouses || []).find((w) => w.storeId === finalStoreId);
      finalWarehouseId = wh ? wh.id : (db.warehouses?.[0]?.id || 'WH-MUM-MAIN');
    }
    const store = (db.stores || []).find((s) => s.id === finalStoreId) || {};
    const warehouse = (db.warehouses || []).find((w) => w.id === finalWarehouseId) || {};

    // 1. REVERSE old purchase stock from warehouse
    for (const oldLine of oldPurchase.lines || []) {
      StockService.postMovement(
        {
          docType: 'PURCHASE_ADJ_REVERT',
          docId: oldPurchase.id,
          docNumber: oldPurchase.docNumber,
          warehouseId: oldPurchase.warehouseId || finalWarehouseId,
          productId: oldLine.productId,
          quantityDelta: -Number(oldLine.qty),
          costRate: Number(oldLine.costPrice || oldLine.rate || 0),
          reason: `Reverting previous purchase receipt for update (${oldPurchase.docNumber})`,
          userId,
        },
        db
      );
    }

    // 2. Calculate new lines & totals
    const isInterstate =
      purchasePayload.supplyType === 'INTERSTATE' ||
      (supplier.stateCode && store.stateCode && supplier.stateCode !== store.stateCode) ||
      supplier.supplyType === 'INTERSTATE';

    let grossSubtotal = 0;
    let lineDiscountsTotal = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;
    let totalQty = 0;

    const calculatedLines = (items || []).map((item, idx) => {
      const prod = (db.products || []).find((p) => p.id === (item.productId || item.id)) || {};
      const rawQty = (item.quantity !== undefined && item.qty !== undefined && item.quantity !== item.qty)
        ? item.quantity
        : (item.qty ?? item.quantity ?? 1);
      const qty = Number(rawQty);
      const costPrice = Number(item.costPrice ?? item.rate ?? item.costRate ?? prod.costRate ?? 0);
      const taxRate = Number(item.taxRate ?? item.gstRate ?? prod.taxRate ?? prod.gstRate ?? 0);
      const mrp = Number(item.mrp ?? prod.mrp ?? 0);
      const sellingPrice = Number(item.sellingPrice ?? prod.sellingRate ?? 0);
      const lineDiscPercent = Number(item.discountPercent || 0);

      if (qty <= 0) throw new Error(`PURCHASE_ERROR: Line #${idx + 1} quantity must be greater than zero.`);
      if (costPrice < 0) throw new Error(`PURCHASE_ERROR: Line #${idx + 1} cost price cannot be negative.`);

      const lineGross = qty * costPrice;
      const lineDiscVal = Number(((lineGross * lineDiscPercent) / 100).toFixed(2));
      const taxable = lineGross - lineDiscVal;

      let cgstRate = 0;
      let cgstAmount = 0;
      let sgstRate = 0;
      let sgstAmount = 0;
      let igstRate = 0;
      let igstAmount = 0;

      if (isInterstate) {
        igstRate = taxRate;
        igstAmount = Number(((taxable * igstRate) / 100).toFixed(2));
      } else {
        cgstRate = taxRate / 2;
        cgstAmount = Number(((taxable * cgstRate) / 100).toFixed(2));
        sgstRate = taxRate / 2;
        sgstAmount = Number(((taxable * sgstRate) / 100).toFixed(2));
      }

      const lineTax = cgstAmount + sgstAmount + igstAmount;
      const lineTotal = Number((taxable + lineTax).toFixed(2));
      const singleUnitPrice = Number((qty > 0 ? lineTotal / qty : costPrice).toFixed(2));
      const margin = Number((sellingPrice - costPrice).toFixed(2));
      const marginPercent = costPrice > 0 ? Number((((sellingPrice - costPrice) / costPrice) * 100).toFixed(1)) : 0;

      grossSubtotal += taxable;
      lineDiscountsTotal += lineDiscVal;
      cgstTotal += cgstAmount;
      sgstTotal += sgstAmount;
      igstTotal += igstAmount;
      totalQty += qty;

      return {
        lineId: item.lineId || `PLINE-${idx + 1}-${Date.now()}`,
        productId: item.productId || item.id,
        name: item.name || prod.name || item.productId,
        sku: item.sku || prod.sku || '',
        uom: item.uom || item.unit || prod.uom || 'PCS',
        batchNo: (item.batchNo || '').trim(),
        expiryDate: item.expiryDate || '',
        qty,
        returnedQty: oldPurchase.lines?.find((ol) => ol.productId === (item.productId || item.id))?.returnedQty || 0,
        costPrice,
        rate: costPrice,
        discountPercent: lineDiscPercent,
        discountAmount: lineDiscVal,
        taxableAmount: Number(taxable.toFixed(2)),
        taxRate,
        cgstRate,
        cgstAmount,
        sgstRate,
        sgstAmount,
        igstRate,
        igstAmount,
        taxAmount: Number(lineTax.toFixed(2)),
        singleUnitPrice,
        unitPriceLanded: singleUnitPrice,
        mrp,
        sellingPrice,
        margin,
        marginAmount: margin,
        marginPercent,
        lineTotal,
        totalAmount: lineTotal,
        total: lineTotal,
      };
    });

    let billDiscountAmt = 0;
    if (discountType === 'PERCENT') {
      billDiscountAmt = Number(((grossSubtotal * Number(discountValue || 0)) / 100).toFixed(2));
    } else {
      billDiscountAmt = Number(discountValue || 0);
    }

    const totalTax = Number((cgstTotal + sgstTotal + igstTotal).toFixed(2));
    const extraCharges = Number(Number(otherCharges || 0).toFixed(2));
    const unroundedTotal = grossSubtotal - billDiscountAmt + extraCharges + totalTax;
    const grandTotal = Math.round(unroundedTotal);
    const roundOff = Number((grandTotal - unroundedTotal).toFixed(2));
    const netAmount = grandTotal;

    // 3. POST new purchase stock into warehouse
    for (const newLine of calculatedLines) {
      StockService.postMovement(
        {
          docType: 'PURCHASE_IN',
          docId: oldPurchase.id,
          docNumber: oldPurchase.docNumber,
          warehouseId: finalWarehouseId,
          productId: newLine.productId,
          quantityDelta: newLine.qty,
          costRate: newLine.costPrice,
          reason: `Updated purchase stock receipt (${supplierInvoiceNo})`,
          userId,
        },
        db
      );

      const prod = (db.products || []).find((p) => p.id === newLine.productId);
      if (prod) {
        if (newLine.costPrice > 0) prod.costRate = newLine.costPrice;
        if (newLine.sellingPrice > 0) prod.sellingRate = newLine.sellingPrice;
        if (newLine.mrp > 0) prod.mrp = newLine.mrp;
      }
    }

    // 4. Update purchase record
    const updatedRecord = {
      ...oldPurchase,
      supplierId,
      supplierName: supplier.name,
      supplierInvoiceNo: supplierInvoiceNo.trim(),
      supplierInvoiceDate: supplierInvoiceDate || date.split('T')[0],
      supplierInvoiceAmount: supplierInvoiceAmount ? Number(supplierInvoiceAmount) : netAmount,
      companyId,
      storeId: finalStoreId,
      storeName: store.name || 'Main Store',
      branchName: store.name || 'Main Store',
      warehouseId: finalWarehouseId,
      warehouseName: warehouse.name || 'Main Warehouse',
      date,
      supplyType: isInterstate ? 'INTERSTATE' : 'LOCAL',
      lines: calculatedLines,
      items: calculatedLines,
      subtotal: Number(grossSubtotal.toFixed(2)),
      lineDiscountsTotal: Number(lineDiscountsTotal.toFixed(2)),
      discountType,
      discountValue: Number(discountValue || 0),
      discountAmount: Number(billDiscountAmt.toFixed(2)),
      otherCharges: extraCharges,
      otherChargesRemark,
      cgstTotal: Number(cgstTotal.toFixed(2)),
      cgstAmount: Number(cgstTotal.toFixed(2)),
      sgstTotal: Number(sgstTotal.toFixed(2)),
      sgstAmount: Number(sgstTotal.toFixed(2)),
      igstTotal: Number(igstTotal.toFixed(2)),
      igstAmount: Number(igstTotal.toFixed(2)),
      totalTax,
      taxAmount: totalTax,
      roundOff,
      netAmount,
      grandTotal,
      amountInWords: numberToWords(grandTotal),
      paymentMode,
      paymentStatus,
      paidAmount: paymentStatus === 'PAID' ? grandTotal : Number(paidAmount || 0),
      balanceDue: paymentStatus === 'PAID' ? 0 : Number((grandTotal - Number(paidAmount || 0)).toFixed(2)),
      notes,
      totalQty,
      updatedAt: new Date().toISOString(),
      updatedBy: userId,
    };

    db.purchases[existingIndex] = updatedRecord;

    saveDatabase(db);
    logAuditEvent('PURCHASE_UPDATED', userId, `Purchase ${oldPurchase.docNumber} updated. Net: ₹${netAmount}`);
    logBacklog({
      action: 'UPDATE',
      formName: 'Purchase Inward',
      recordRef: updatedRecord.docNumber,
      userId,
      details: `Updated Inward Purchase Receipt ${updatedRecord.docNumber} (Supplier: ${supplier.name}, Inv: ${updatedRecord.supplierInvoiceNo}, Branch: ${updatedRecord.branchName}, Total: ₹${netAmount})`,
    });

    return {
      success: true,
      purchase: updatedRecord,
      message: `Purchase ${updatedRecord.docNumber} updated successfully. Inventory balances refreshed.`,
    };
  },

  /**
   * Delete an existing Purchase Bill and reverse stock
   * @param {string} purchaseId
   * @param {string} userId
   */
  deletePurchase(purchaseId, userId = 'USR-ADMIN') {
    const db = getDatabase();
    const purchase = (db.purchases || []).find((p) => p.id === purchaseId);
    if (!purchase) {
      throw new Error(`PURCHASE_ERROR: Purchase record "${purchaseId}" not found.`);
    }

    // Check if any returns exist against this purchase
    const hasReturns = (db.purchaseReturns || []).some(
      (pr) => pr.originalPurchaseId === purchaseId || pr.originalPurchaseDocNumber === purchase.docNumber
    );
    if (hasReturns) {
      throw new Error(
        `PURCHASE_ERROR: Cannot delete Purchase "${purchase.docNumber}" because Debit Notes / Returns have already been issued against it.`
      );
    }

    // Reverse stock for all lines
    for (const line of purchase.lines || []) {
      StockService.postMovement(
        {
          docType: 'PURCHASE_DELETED',
          docId: purchase.id,
          docNumber: purchase.docNumber,
          warehouseId: purchase.warehouseId,
          productId: line.productId,
          quantityDelta: -Number(line.qty),
          costRate: Number(line.costPrice || line.rate || 0),
          reason: `Reversing stock due to purchase deletion (${purchase.docNumber})`,
          userId,
        },
        db
      );
    }

    // If converted from a PO, reset the PO status back to 'APPROVED'
    if (purchase.poId || purchase.purchaseOrderRef || purchase.poNumber) {
      const poRef = purchase.poId || purchase.purchaseOrderRef || purchase.poNumber;
      const po = (db.purchaseOrders || []).find((p) => p.id === poRef || p.poNumber === poRef);
      if (po && po.status === 'CONVERTED') {
        po.status = 'APPROVED';
        delete po.convertedPurchaseId;
        delete po.convertedPurchaseDocNumber;
        delete po.convertedAt;
      }
    }

    // Remove from db.purchases
    db.purchases = db.purchases.filter((p) => p.id !== purchaseId);

    saveDatabase(db);
    logAuditEvent('PURCHASE_DELETED', userId, `Purchase ${purchase.docNumber} deleted and stock reversed.`);
    logBacklog({
      action: 'DELETE',
      formName: 'Purchase Inward',
      recordRef: purchase.docNumber,
      userId,
      details: `Deleted Purchase Receipt ${purchase.docNumber} (${purchase.supplierName}, Inv: ${purchase.supplierInvoiceNo}, Amount: ₹${Number(purchase.netAmount).toFixed(2)}) and reversed inventory.`,
    });

    return {
      success: true,
      message: `Purchase ${purchase.docNumber} deleted and inventory stock successfully reversed.`,
    };
  },

  /**
   * Post Purchase Return (Debit Note)
   */
  postPurchaseReturn({ originalPurchaseDocNumber, items, reason, userId = 'USR-02' }) {
    const db = getDatabase();
    const purchase = db.purchases.find((p) => p.docNumber === originalPurchaseDocNumber);
    if (!purchase) throw new Error(`PURCHASE_RETURN_ERROR: Original purchase "${originalPurchaseDocNumber}" not found.`);

    let totalDebit = 0;
    const returnLines = [];

    for (const item of items) {
      const origLine = purchase.lines.find((l) => l.productId === item.productId);
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

      const lineTotal = returnQty * (origLine.costPrice || origLine.rate);
      totalDebit += lineTotal;

      returnLines.push({
        productId: origLine.productId,
        name: origLine.name,
        returnQty,
        rate: origLine.costPrice || origLine.rate,
        costPrice: origLine.costPrice || origLine.rate,
        lineTotal,
      });
    }

    if (returnLines.length === 0) throw new Error('PURCHASE_RETURN_ERROR: No valid return items provided.');

    const count = (db.purchaseReturns || []).length + 1;
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
      const origLine = purchase.lines.find((l) => l.productId === rLine.productId);
      if (origLine) {
        origLine.returnedQty = (origLine.returnedQty || 0) + rLine.returnQty;
      }

      // Post RETURN_OUT movement
      StockService.postMovement(
        {
          docType: 'RETURN_OUT',
          docId: debitNote.id,
          docNumber: debitNote.docNumber,
          warehouseId: purchase.warehouseId,
          productId: rLine.productId,
          quantityDelta: -rLine.returnQty,
          costRate: rLine.costPrice || rLine.rate,
          reason: `Debit note to supplier (${purchase.supplierName})`,
          userId,
        },
        db
      );
    }

    db.purchaseReturns = db.purchaseReturns || [];
    db.purchaseReturns.push(debitNote);
    saveDatabase(db);
    logAuditEvent('PURCHASE_RETURN_POSTED', userId, `Purchase Debit Note ${docNumber} posted. Debit: ₹${totalDebit.toFixed(2)}`);

    return {
      success: true,
      debitNote,
      message: `Debit Note ${docNumber} posted. Stock deducted from warehouse.`,
    };
  },
};
