// PurchasePostingService: Comprehensive Procurement Engine, Branch Support, Stock Valuation, PO Conversion, Edit & Delete
import { getDatabase, saveDatabase, logAuditEvent, logBacklog } from './storageService.js';
import { StockService } from './stockService.js';
import { numberToWords } from '../utils/numberToWords.js';
import { calculatePurchaseLine } from './purchaseRateHelper.js';

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
      items: rawItems,
      lines: rawLines,
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

    const items = rawItems || rawLines;

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
      const taxType = (item.taxType || (prod.isTaxInclusive ? 'inclusive' : (prod.taxType || purchasePayload.purchaseTaxType || 'exclusive'))).toLowerCase();

      if (qty <= 0) throw new Error(`PURCHASE_ERROR: Line #${idx + 1} (${item.name || 'Item'}) quantity must be greater than zero.`);
      if (costPrice < 0) throw new Error(`PURCHASE_ERROR: Line #${idx + 1} (${item.name || 'Item'}) cost price cannot be negative.`);

      const calc = calculatePurchaseLine(
        {
          qty,
          costPrice,
          rate: costPrice,
          taxRate,
          mrp,
          sellingPrice,
          discountPercent: lineDiscPercent,
          taxType,
        },
        isInterstate ? 'INTERSTATE' : 'LOCAL'
      );

      grossSubtotal += calc.taxableAmount;
      lineDiscountsTotal += calc.discountAmount;
      cgstTotal += calc.cgstAmount;
      sgstTotal += calc.sgstAmount;
      igstTotal += calc.igstAmount;
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
        taxType: calc.taxType,
        isTaxInclusive: calc.isTaxInclusive,
        discountPercent: lineDiscPercent,
        discountAmount: calc.discountAmount,
        taxableAmount: calc.taxableAmount,
        taxRate: calc.taxRate,
        cgstRate: calc.cgstRate,
        cgstAmount: calc.cgstAmount,
        sgstRate: calc.sgstRate,
        sgstAmount: calc.sgstAmount,
        igstRate: calc.igstRate,
        igstAmount: calc.igstAmount,
        taxAmount: calc.taxAmount,
        singleUnitPrice: calc.singleUnitPrice,
        unitPriceLanded: calc.singleUnitPrice,
        mrp: calc.mrp,
        sellingPrice: calc.sellingPrice,
        margin: calc.margin,
        marginAmount: calc.margin,
        marginPercent: calc.marginPercent,
        lineTotal: calc.lineTotal,
        totalAmount: calc.lineTotal,
        total: calc.lineTotal,
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
      purchaseTaxType: purchasePayload.purchaseTaxType || 'inclusive',
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
      items: rawItems,
      lines: rawLines,
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

    const items = rawItems || rawLines;

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
      const taxType = (item.taxType || (prod.isTaxInclusive ? 'inclusive' : (prod.taxType || purchasePayload.purchaseTaxType || 'exclusive'))).toLowerCase();

      if (qty <= 0) throw new Error(`PURCHASE_ERROR: Line #${idx + 1} quantity must be greater than zero.`);
      if (costPrice < 0) throw new Error(`PURCHASE_ERROR: Line #${idx + 1} cost price cannot be negative.`);

      const calc = calculatePurchaseLine(
        {
          qty,
          costPrice,
          rate: costPrice,
          taxRate,
          mrp,
          sellingPrice,
          discountPercent: lineDiscPercent,
          taxType,
        },
        isInterstate ? 'INTERSTATE' : 'LOCAL'
      );

      grossSubtotal += calc.taxableAmount;
      lineDiscountsTotal += calc.discountAmount;
      cgstTotal += calc.cgstAmount;
      sgstTotal += calc.sgstAmount;
      igstTotal += calc.igstAmount;
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
        taxType: calc.taxType,
        isTaxInclusive: calc.isTaxInclusive,
        discountPercent: lineDiscPercent,
        discountAmount: calc.discountAmount,
        taxableAmount: calc.taxableAmount,
        taxRate: calc.taxRate,
        cgstRate: calc.cgstRate,
        cgstAmount: calc.cgstAmount,
        sgstRate: calc.sgstRate,
        sgstAmount: calc.sgstAmount,
        igstRate: calc.igstRate,
        igstAmount: calc.igstAmount,
        taxAmount: calc.taxAmount,
        singleUnitPrice: calc.singleUnitPrice,
        unitPriceLanded: calc.singleUnitPrice,
        mrp: calc.mrp,
        sellingPrice: calc.sellingPrice,
        margin: calc.margin,
        marginAmount: calc.margin,
        marginPercent: calc.marginPercent,
        lineTotal: calc.lineTotal,
        totalAmount: calc.lineTotal,
        total: calc.lineTotal,
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
      purchaseTaxType: purchasePayload.purchaseTaxType || oldPurchase.purchaseTaxType || 'inclusive',
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
   * Generate Next Purchase Return / Debit Note Document Number
   */
  generateNextPurchaseReturnDocNumber(dbInstance = null) {
    const db = dbInstance || getDatabase();
    const year = new Date().getFullYear();
    const prefix = `PRTN-${year}-`;
    const returns = db.purchaseReturns || [];
    let maxNum = 0;
    returns.forEach((r) => {
      const doc = r.docNumber || '';
      if (doc.startsWith(prefix) || doc.startsWith(`DN-${year}-`)) {
        const parts = doc.split('-');
        const n = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(n) && n > maxNum) maxNum = n;
      }
    });
    return `${prefix}${String(maxNum + 1).padStart(4, '0')}`;
  },

  /**
   * Post Purchase Return (Debit Note)
   * Supports:
   * 1. AGAINST_PURCHASE: Return goods against an inward purchase to that supplier (or to a different supplier)
   * 2. DIRECT_PRODUCT: Return products from inventory directly to any chosen supplier
   */
  postPurchaseReturn(payload) {
    const {
      returnMode = 'AGAINST_PURCHASE',
      originalPurchaseDocNumber,
      purchaseId,
      supplierId: customSupplierId,
      supplierName: customSupplierName,
      storeId: customStoreId,
      warehouseId: customWarehouseId,
      items = [],
      reason = 'Supplier return',
      notes = '',
      docNumber: customDocNumber,
      date: customDate,
      userId = 'USR-ADMIN',
    } = payload;

    const db = getDatabase();
    let purchase = null;
    if (originalPurchaseDocNumber || purchaseId || returnMode === 'AGAINST_PURCHASE') {
      purchase = (db.purchases || []).find(
        (p) =>
          (originalPurchaseDocNumber && p.docNumber === originalPurchaseDocNumber) ||
          (purchaseId && p.id === purchaseId)
      );
      if (!purchase && returnMode === 'AGAINST_PURCHASE' && (originalPurchaseDocNumber || purchaseId)) {
        throw new Error(`PURCHASE_RETURN_ERROR: Original purchase "${originalPurchaseDocNumber || purchaseId}" not found.`);
      }
    }

    const effectiveMode = purchase ? 'AGAINST_PURCHASE' : 'DIRECT_PRODUCT';

    // Resolve Supplier
    let finalSupplierId = customSupplierId || purchase?.supplierId;
    let supplier = (db.suppliers || []).find((s) => s.id === finalSupplierId);
    if (!supplier && purchase) {
      supplier = { id: purchase.supplierId, name: purchase.supplierName };
    }
    if (!supplier) {
      throw new Error('PURCHASE_RETURN_ERROR: A valid supplier must be selected for purchase return.');
    }

    // Resolve Store & Warehouse
    let finalStoreId = customStoreId || purchase?.storeId || db.stores?.[0]?.id || 'STR-01';
    let finalWarehouseId = customWarehouseId || purchase?.warehouseId;
    if (!finalWarehouseId && finalStoreId) {
      const wh = (db.warehouses || []).find((w) => w.storeId === finalStoreId);
      finalWarehouseId = wh ? wh.id : (db.warehouses?.[0]?.id || 'WH-MUM-MAIN');
    }
    if (!finalWarehouseId) finalWarehouseId = db.warehouses?.[0]?.id || 'WH-MUM-MAIN';

    const store = (db.stores || []).find((s) => s.id === finalStoreId) || {};
    const warehouse = (db.warehouses || []).find((w) => w.id === finalWarehouseId) || {};

    if (!items || items.length === 0) {
      throw new Error('PURCHASE_RETURN_ERROR: Please specify at least one item to return.');
    }

    const isInterstate =
      (supplier.stateCode && store.stateCode && supplier.stateCode !== store.stateCode) ||
      supplier.supplyType === 'INTERSTATE';

    let grossSubtotal = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;
    let totalQty = 0;
    const returnLines = [];

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      const prodId = item.productId || item.id;
      const prod = (db.products || []).find((p) => p.id === prodId) || {};
      const returnQty = Number(item.returnQty ?? item.qty ?? 0);
      if (returnQty <= 0) continue;

      let origLine = null;
      if (purchase && purchase.lines) {
        origLine = purchase.lines.find((l) => l.productId === prodId);
        if (effectiveMode === 'AGAINST_PURCHASE' && origLine) {
          const remaining = origLine.qty - (origLine.returnedQty || 0);
          if (returnQty > remaining) {
            throw new Error(
              `EXCESS_RETURN_ERROR: Cannot return ${returnQty} units of "${origLine.name || prod.name}". Maximum returnable on purchase ${purchase.docNumber} is ${remaining}.`
            );
          }
        }
      }

      // Check current stock in warehouse (common table db.stockBalances)
      const currentStock = StockService.getStockBalance(finalWarehouseId, prodId);
      if (returnQty > currentStock) {
        throw new Error(
          `INSUFFICIENT_STOCK: Warehouse "${warehouse.name || finalWarehouseId}" has only ${currentStock} units of "${prod.name || origLine?.name || prodId}". Cannot return ${returnQty} units.`
        );
      }

      const costPrice = Number(item.costPrice ?? item.rate ?? origLine?.costPrice ?? origLine?.rate ?? prod.costRate ?? 0);
      const taxRate = Number(item.taxRate ?? item.gstRate ?? origLine?.taxRate ?? prod.taxRate ?? prod.gstRate ?? 0);
      const mrp = Number(item.mrp ?? origLine?.mrp ?? prod.mrp ?? 0);

      const lineGross = Number((returnQty * costPrice).toFixed(2));
      let cgstRate = 0, cgstAmount = 0, sgstRate = 0, sgstAmount = 0, igstRate = 0, igstAmount = 0;
      if (isInterstate) {
        igstRate = taxRate;
        igstAmount = Number(((lineGross * igstRate) / 100).toFixed(2));
      } else {
        cgstRate = taxRate / 2;
        cgstAmount = Number(((lineGross * cgstRate) / 100).toFixed(2));
        sgstRate = taxRate / 2;
        sgstAmount = Number(((lineGross * sgstRate) / 100).toFixed(2));
      }

      const lineTax = cgstAmount + sgstAmount + igstAmount;
      const lineTotal = Number((lineGross + lineTax).toFixed(2));

      grossSubtotal += lineGross;
      cgstTotal += cgstAmount;
      sgstTotal += sgstAmount;
      igstTotal += igstAmount;
      totalQty += returnQty;

      returnLines.push({
        lineId: item.lineId || `PRLINE-${idx + 1}-${Date.now()}`,
        productId: prodId,
        name: item.name || origLine?.name || prod.name || prodId,
        productName: item.name || origLine?.name || prod.name || prodId,
        sku: item.sku || origLine?.sku || prod.sku || '',
        uom: item.uom || origLine?.uom || prod.uom || 'PCS',
        batchNo: item.batchNo || origLine?.batchNo || '',
        expiryDate: item.expiryDate || origLine?.expiryDate || '',
        returnQty,
        qty: returnQty,
        rate: costPrice,
        costPrice,
        taxRate,
        taxableAmount: lineGross,
        cgstRate,
        cgstAmount,
        sgstRate,
        sgstAmount,
        igstRate,
        igstAmount,
        taxAmount: lineTax,
        mrp,
        lineTotal,
        totalAmount: lineTotal,
      });
    }

    if (returnLines.length === 0) {
      throw new Error('PURCHASE_RETURN_ERROR: No valid return items provided with quantity greater than zero.');
    }

    const docNumber = customDocNumber || PurchasePostingService.generateNextPurchaseReturnDocNumber(db);
    const totalTax = Number((cgstTotal + sgstTotal + igstTotal).toFixed(2));
    const unroundedTotal = grossSubtotal + totalTax;
    const grandTotal = Math.round(unroundedTotal);
    const roundOff = Number((grandTotal - unroundedTotal).toFixed(2));
    const nowIso = new Date().toISOString();
    const returnDate = customDate ? (customDate.includes('T') ? customDate : `${customDate}T12:00:00.000Z`) : nowIso;

    const returnRecord = {
      id: `PRTN-${Date.now()}`,
      docNumber,
      returnMode: effectiveMode,
      originalPurchaseId: purchase?.id || null,
      originalPurchaseDocNumber: purchase?.docNumber || null,
      purchaseId: purchase?.id || null,
      purchaseDocNumber: purchase?.docNumber || null,
      supplierId: supplier.id,
      supplierName: supplier.name,
      supplierGstin: supplier.gstin || '',
      companyId: store.companyId || 'COMP-01',
      storeId: finalStoreId,
      storeName: store.name || 'Main Store',
      branchName: store.name || 'Main Store',
      warehouseId: finalWarehouseId,
      warehouseName: warehouse.name || 'Main Warehouse',
      date: returnDate,
      postedAt: nowIso,
      lines: returnLines,
      items: returnLines,
      productId: returnLines[0].productId,
      productName: returnLines[0].name,
      returnQty: totalQty,
      unitRate: returnLines[0].costPrice,
      totalCreditAmount: grandTotal,
      subtotal: Number(grossSubtotal.toFixed(2)),
      cgstTotal: Number(cgstTotal.toFixed(2)),
      cgstAmount: Number(cgstTotal.toFixed(2)),
      sgstTotal: Number(sgstTotal.toFixed(2)),
      sgstAmount: Number(sgstTotal.toFixed(2)),
      igstTotal: Number(igstTotal.toFixed(2)),
      igstAmount: Number(igstTotal.toFixed(2)),
      totalTax,
      roundOff,
      totalDebitAmount: grandTotal,
      grandTotal,
      netAmount: grandTotal,
      amountInWords: numberToWords(grandTotal),
      reason,
      notes,
      totalQty,
      createdBy: userId,
      postedBy: userId,
    };

    // 1. Deduct Stock from Warehouse in common table db.stockBalances
    for (const rLine of returnLines) {
      StockService.postMovement(
        {
          docType: 'RETURN_OUT',
          docId: returnRecord.id,
          docNumber: returnRecord.docNumber,
          warehouseId: finalWarehouseId,
          productId: rLine.productId,
          quantityDelta: -Number(rLine.returnQty),
          costRate: rLine.costPrice,
          reason: `Supplier Return (${supplier.name}, ${returnRecord.docNumber}): ${reason}`,
          userId,
        },
        db
      );

      // If linked to an original purchase, update returnedQty on the purchase line
      if (purchase && purchase.lines) {
        const origLine = purchase.lines.find((l) => l.productId === rLine.productId);
        if (origLine) {
          origLine.returnedQty = (origLine.returnedQty || 0) + Number(rLine.returnQty);
        }
      }
    }

    db.purchaseReturns = db.purchaseReturns || [];
    db.purchaseReturns.unshift(returnRecord);
    saveDatabase(db);

    logAuditEvent(
      'PURCHASE_RETURN_POSTED',
      userId,
      `Purchase Return ${docNumber} posted to ${supplier.name} for ₹${grandTotal}. Stock deducted from ${warehouse.name || finalWarehouseId}.`
    );
    logBacklog({
      action: 'SAVE',
      formName: 'Purchase Return',
      recordRef: docNumber,
      userId,
      details: `Posted Purchase Return ${docNumber} (${supplier.name}, Branch: ${returnRecord.branchName}, Total: ₹${grandTotal}, Mode: ${effectiveMode})`,
    });

    return {
      success: true,
      returnRecord,
      debitNote: returnRecord,
      message: `Purchase Return ${docNumber} posted successfully. Stock reduced from ${warehouse.name || finalWarehouseId}.`,
    };
  },

  /**
   * Update an existing Purchase Return with inventory rebalancing
   */
  updatePurchaseReturn(returnId, payload) {
    const db = getDatabase();
    const oldReturn = (db.purchaseReturns || []).find((r) => r.id === returnId || r.docNumber === returnId);
    if (!oldReturn) {
      throw new Error(`PURCHASE_RETURN_ERROR: Return record "${returnId}" not found.`);
    }

    const userId = payload.userId || 'USR-ADMIN';

    // 1. REVERSE old return stock back to warehouse
    for (const oldLine of oldReturn.lines || [{ productId: oldReturn.productId, returnQty: oldReturn.returnQty, costPrice: oldReturn.unitRate }]) {
      const rQty = Number(oldLine.returnQty ?? oldLine.qty ?? 0);
      if (rQty > 0) {
        StockService.postMovement(
          {
            docType: 'PURCHASE_RETURN_REVERT',
            docId: oldReturn.id,
            docNumber: oldReturn.docNumber,
            warehouseId: oldReturn.warehouseId,
            productId: oldLine.productId,
            quantityDelta: rQty,
            costRate: Number(oldLine.costPrice || oldLine.rate || 0),
            reason: `Reverting previous return stock deduction for update (${oldReturn.docNumber})`,
            userId,
          },
          db
        );

        // Revert returnedQty on old purchase if linked
        if (oldReturn.originalPurchaseId || oldReturn.originalPurchaseDocNumber || oldReturn.purchaseId || oldReturn.purchaseDocNumber) {
          const oldPur = (db.purchases || []).find(
            (p) =>
              p.id === oldReturn.originalPurchaseId ||
              p.docNumber === oldReturn.originalPurchaseDocNumber ||
              p.id === oldReturn.purchaseId ||
              p.docNumber === oldReturn.purchaseDocNumber
          );
          if (oldPur && oldPur.lines) {
            const origLine = oldPur.lines.find((l) => l.productId === oldLine.productId);
            if (origLine) {
              origLine.returnedQty = Math.max(0, (origLine.returnedQty || 0) - rQty);
            }
          }
        }
      }
    }

    // 2. Compute new lines and check stock
    const {
      returnMode = oldReturn.returnMode || 'AGAINST_PURCHASE',
      originalPurchaseDocNumber = payload.originalPurchaseDocNumber || oldReturn.originalPurchaseDocNumber,
      purchaseId = payload.purchaseId || oldReturn.originalPurchaseId,
      supplierId = payload.supplierId || oldReturn.supplierId,
      storeId = payload.storeId || oldReturn.storeId,
      warehouseId = payload.warehouseId || oldReturn.warehouseId,
      items = payload.items || payload.lines || oldReturn.lines,
      reason = payload.reason || oldReturn.reason,
      notes = payload.notes || oldReturn.notes,
      date = payload.date || oldReturn.date,
    } = payload;

    let purchase = null;
    if (originalPurchaseDocNumber || purchaseId) {
      purchase = (db.purchases || []).find(
        (p) =>
          (originalPurchaseDocNumber && p.docNumber === originalPurchaseDocNumber) ||
          (purchaseId && p.id === purchaseId)
      );
    }

    let supplier = (db.suppliers || []).find((s) => s.id === supplierId);
    if (!supplier && purchase) supplier = { id: purchase.supplierId, name: purchase.supplierName };
    if (!supplier) throw new Error('PURCHASE_RETURN_ERROR: Valid supplier is required.');

    let finalStoreId = storeId || db.stores?.[0]?.id || 'STR-01';
    let finalWarehouseId = warehouseId;
    if (!finalWarehouseId && finalStoreId) {
      const wh = (db.warehouses || []).find((w) => w.storeId === finalStoreId);
      finalWarehouseId = wh ? wh.id : (db.warehouses?.[0]?.id || 'WH-MUM-MAIN');
    }
    const store = (db.stores || []).find((s) => s.id === finalStoreId) || {};
    const warehouse = (db.warehouses || []).find((w) => w.id === finalWarehouseId) || {};

    const isInterstate =
      (supplier.stateCode && store.stateCode && supplier.stateCode !== store.stateCode) ||
      supplier.supplyType === 'INTERSTATE';

    let grossSubtotal = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;
    let totalQty = 0;
    const returnLines = [];

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      const prodId = item.productId || item.id;
      const prod = (db.products || []).find((p) => p.id === prodId) || {};
      const returnQty = Number(item.returnQty ?? item.qty ?? 0);
      if (returnQty <= 0) continue;

      let origLine = null;
      if (purchase && purchase.lines) {
        origLine = purchase.lines.find((l) => l.productId === prodId);
        if (origLine) {
          const remaining = origLine.qty - (origLine.returnedQty || 0);
          if (returnQty > remaining) {
            throw new Error(
              `EXCESS_RETURN_ERROR: Cannot return ${returnQty} units of "${origLine.name || prod.name}". Maximum returnable is ${remaining}.`
            );
          }
        }
      }

      // Check current stock (which now includes reverted stock)
      const currentStock = StockService.getStockBalance(finalWarehouseId, prodId);
      if (returnQty > currentStock) {
        throw new Error(
          `INSUFFICIENT_STOCK: Warehouse has only ${currentStock} units of "${prod.name || prodId}". Cannot return ${returnQty} units.`
        );
      }

      const costPrice = Number(item.costPrice ?? item.rate ?? origLine?.costPrice ?? origLine?.rate ?? prod.costRate ?? 0);
      const taxRate = Number(item.taxRate ?? item.gstRate ?? origLine?.taxRate ?? prod.taxRate ?? prod.gstRate ?? 0);
      const mrp = Number(item.mrp ?? origLine?.mrp ?? prod.mrp ?? 0);

      const lineGross = Number((returnQty * costPrice).toFixed(2));
      let cgstRate = 0, cgstAmount = 0, sgstRate = 0, sgstAmount = 0, igstRate = 0, igstAmount = 0;
      if (isInterstate) {
        igstRate = taxRate;
        igstAmount = Number(((lineGross * igstRate) / 100).toFixed(2));
      } else {
        cgstRate = taxRate / 2;
        cgstAmount = Number(((lineGross * cgstRate) / 100).toFixed(2));
        sgstRate = taxRate / 2;
        sgstAmount = Number(((lineGross * sgstRate) / 100).toFixed(2));
      }

      const lineTax = cgstAmount + sgstAmount + igstAmount;
      const lineTotal = Number((lineGross + lineTax).toFixed(2));

      grossSubtotal += lineGross;
      cgstTotal += cgstAmount;
      sgstTotal += sgstAmount;
      igstTotal += igstAmount;
      totalQty += returnQty;

      returnLines.push({
        lineId: item.lineId || `PRLINE-${idx + 1}-${Date.now()}`,
        productId: prodId,
        name: item.name || origLine?.name || prod.name || prodId,
        productName: item.name || origLine?.name || prod.name || prodId,
        sku: item.sku || origLine?.sku || prod.sku || '',
        uom: item.uom || origLine?.uom || prod.uom || 'PCS',
        batchNo: item.batchNo || origLine?.batchNo || '',
        expiryDate: item.expiryDate || origLine?.expiryDate || '',
        returnQty,
        qty: returnQty,
        rate: costPrice,
        costPrice,
        taxRate,
        taxableAmount: lineGross,
        cgstRate,
        cgstAmount,
        sgstRate,
        sgstAmount,
        igstRate,
        igstAmount,
        taxAmount: lineTax,
        mrp,
        lineTotal,
        totalAmount: lineTotal,
      });
    }

    if (returnLines.length === 0) {
      throw new Error('PURCHASE_RETURN_ERROR: At least one item with return quantity greater than zero is required.');
    }

    const totalTax = Number((cgstTotal + sgstTotal + igstTotal).toFixed(2));
    const unroundedTotal = grossSubtotal + totalTax;
    const grandTotal = Math.round(unroundedTotal);
    const roundOff = Number((grandTotal - unroundedTotal).toFixed(2));

    // 3. APPLY new return stock deductions
    for (const rLine of returnLines) {
      StockService.postMovement(
        {
          docType: 'RETURN_OUT',
          docId: oldReturn.id,
          docNumber: oldReturn.docNumber,
          warehouseId: finalWarehouseId,
          productId: rLine.productId,
          quantityDelta: -Number(rLine.returnQty),
          costRate: rLine.costPrice,
          reason: `Updated Supplier Return (${supplier.name}, ${oldReturn.docNumber}): ${reason}`,
          userId,
        },
        db
      );

      if (purchase && purchase.lines) {
        const origLine = purchase.lines.find((l) => l.productId === rLine.productId);
        if (origLine) {
          origLine.returnedQty = (origLine.returnedQty || 0) + Number(rLine.returnQty);
        }
      }
    }

    // Update return record
    const updatedRecord = {
      ...oldReturn,
      returnMode,
      originalPurchaseId: purchase?.id || null,
      originalPurchaseDocNumber: purchase?.docNumber || null,
      purchaseId: purchase?.id || null,
      purchaseDocNumber: purchase?.docNumber || null,
      supplierId: supplier.id,
      supplierName: supplier.name,
      supplierGstin: supplier.gstin || '',
      companyId: store.companyId || 'COMP-01',
      storeId: finalStoreId,
      storeName: store.name || 'Main Store',
      branchName: store.name || 'Main Store',
      warehouseId: finalWarehouseId,
      warehouseName: warehouse.name || 'Main Warehouse',
      date: date || oldReturn.date,
      lines: returnLines,
      items: returnLines,
      productId: returnLines[0].productId,
      productName: returnLines[0].name,
      returnQty: totalQty,
      unitRate: returnLines[0].costPrice,
      totalCreditAmount: grandTotal,
      subtotal: Number(grossSubtotal.toFixed(2)),
      cgstTotal: Number(cgstTotal.toFixed(2)),
      cgstAmount: Number(cgstTotal.toFixed(2)),
      sgstTotal: Number(sgstTotal.toFixed(2)),
      sgstAmount: Number(sgstTotal.toFixed(2)),
      igstTotal: Number(igstTotal.toFixed(2)),
      igstAmount: Number(igstTotal.toFixed(2)),
      totalTax,
      roundOff,
      totalDebitAmount: grandTotal,
      grandTotal,
      netAmount: grandTotal,
      amountInWords: numberToWords(grandTotal),
      reason,
      notes,
      totalQty,
      updatedAt: new Date().toISOString(),
      updatedBy: userId,
    };

    const returnIdx = db.purchaseReturns.findIndex((r) => r.id === oldReturn.id);
    if (returnIdx !== -1) {
      db.purchaseReturns[returnIdx] = updatedRecord;
    }

    saveDatabase(db);
    logAuditEvent('PURCHASE_RETURN_UPDATED', userId, `Purchase Return ${oldReturn.docNumber} updated. Total: ₹${grandTotal}`);
    logBacklog({
      action: 'UPDATE',
      formName: 'Purchase Return',
      recordRef: oldReturn.docNumber,
      userId,
      details: `Updated Purchase Return ${oldReturn.docNumber} (${supplier.name}, Total: ₹${grandTotal})`,
    });

    return {
      success: true,
      returnRecord: updatedRecord,
      debitNote: updatedRecord,
      message: `Purchase Return ${oldReturn.docNumber} updated successfully. Inventory rebalanced.`,
    };
  },

  /**
   * Delete a Purchase Return and restore inventory stock to warehouse
   */
  deletePurchaseReturn(returnId, userId = 'USR-ADMIN') {
    const db = getDatabase();
    const ret = (db.purchaseReturns || []).find((r) => r.id === returnId || r.docNumber === returnId);
    if (!ret) {
      throw new Error(`PURCHASE_RETURN_ERROR: Return record "${returnId}" not found.`);
    }

    // 1. Restore stock to warehouse in db.stockBalances
    for (const line of ret.lines || [{ productId: ret.productId, returnQty: ret.returnQty, costPrice: ret.unitRate }]) {
      const rQty = Number(line.returnQty ?? line.qty ?? 0);
      if (rQty > 0) {
        StockService.postMovement(
          {
            docType: 'PURCHASE_RETURN_DELETED',
            docId: ret.id,
            docNumber: ret.docNumber,
            warehouseId: ret.warehouseId,
            productId: line.productId,
            quantityDelta: rQty,
            costRate: Number(line.costPrice || line.rate || 0),
            reason: `Restoring stock due to return cancellation/deletion (${ret.docNumber})`,
            userId,
          },
          db
        );

        // 2. If return was linked to an original purchase, decrement returnedQty
        if (ret.originalPurchaseId || ret.originalPurchaseDocNumber || ret.purchaseId || ret.purchaseDocNumber) {
          const pur = (db.purchases || []).find(
            (p) =>
              p.id === ret.originalPurchaseId ||
              p.docNumber === ret.originalPurchaseDocNumber ||
              p.id === ret.purchaseId ||
              p.docNumber === ret.purchaseDocNumber
          );
          if (pur && pur.lines) {
            const origLine = pur.lines.find((l) => l.productId === line.productId);
            if (origLine) {
              origLine.returnedQty = Math.max(0, (origLine.returnedQty || 0) - rQty);
            }
          }
        }
      }
    }

    // Remove from db.purchaseReturns
    db.purchaseReturns = db.purchaseReturns.filter((r) => r.id !== ret.id);
    saveDatabase(db);

    logAuditEvent('PURCHASE_RETURN_DELETED', userId, `Purchase Return ${ret.docNumber} deleted and stock restored.`);
    logBacklog({
      action: 'DELETE',
      formName: 'Purchase Return',
      recordRef: ret.docNumber,
      userId,
      details: `Deleted Purchase Return ${ret.docNumber} (${ret.supplierName}, Amount: ₹${Number(ret.totalDebitAmount || ret.totalCreditAmount || 0).toFixed(2)}) and restored inventory.`,
    });

    return {
      success: true,
      message: `Purchase Return ${ret.docNumber} deleted and stock successfully restored to warehouse.`,
    };
  },
};
