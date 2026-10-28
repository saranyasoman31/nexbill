// StockAdjustmentService: Physical Counts, Variance Calculation, and Approval Workflows
import { getDatabase, saveDatabase, logAuditEvent } from './storageService.js';
import { StockService } from './stockService.js';

export const StockAdjustmentService = {
  /**
   * Submit physical inventory count / stock adjustment (Add, Subtract, or Direct Count)
   */
  submitAdjustment({
    warehouseId,
    productId,
    stockId = null,
    adjustmentMode = null, // 'ADD' | 'SUBTRACT' | 'SET'
    deltaQty = null,
    countedQty = null,
    reason = 'PHYSICAL_COUNT',
    notes = '',
    userRole,
    userId = 'USR-03',
  }) {
    const db = getDatabase();
    const warehouse = db.warehouses.find(w => w.id === warehouseId);
    const product = db.products.find(p => p.id === productId);

    if (!warehouse || !product) throw new Error('ADJUSTMENT_ERROR: Warehouse or product not found.');

    const bookQty = StockService.getStockBalance(warehouseId, productId);
    const stockRecord = StockService.getStockRecord(warehouseId, productId);
    const resolvedStockId = stockId || stockRecord?.id || `STK-${warehouseId}-${productId}`;

    let resolvedMode = adjustmentMode || 'SET';
    let adjustmentQty = 0;
    let finalCountedQty = bookQty;

    if (resolvedMode === 'ADD') {
      const addQty = Math.abs(Number(deltaQty ?? 0));
      if (addQty === 0) throw new Error('ADJUSTMENT_ERROR: Quantity to add must be greater than zero.');
      adjustmentQty = addQty;
      finalCountedQty = bookQty + addQty;
    } else if (resolvedMode === 'SUBTRACT') {
      const subQty = Math.abs(Number(deltaQty ?? 0));
      if (subQty === 0) throw new Error('ADJUSTMENT_ERROR: Quantity to subtract must be greater than zero.');
      if (db.settings.blockNegativeStock && subQty > bookQty) {
        throw new Error(`INSUFFICIENT_STOCK: Cannot subtract ${subQty} units. Available stock is ${bookQty}. Negative stock is blocked.`);
      }
      adjustmentQty = -subQty;
      finalCountedQty = bookQty - subQty;
    } else {
      // Direct count (SET)
      finalCountedQty = Number(countedQty !== null && countedQty !== undefined ? countedQty : (deltaQty !== null ? deltaQty : bookQty));
      adjustmentQty = finalCountedQty - bookQty;
      resolvedMode = adjustmentQty >= 0 ? 'ADD' : 'SUBTRACT';
    }

    const valuationImpact = Math.abs(adjustmentQty * (Number(product.costRate) || 0));

    const needsApproval =
      Math.abs(adjustmentQty) > db.settings.managerApprovalThresholdQty ||
      valuationImpact > db.settings.managerApprovalThresholdAmount;

    const count = db.stockAdjustments.length + 1;
    const docNumber = `ADJ-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;
    const nowIso = new Date().toISOString();

    const isManagerOrAdmin =
      userRole === 'STORE_MANAGER' ||
      userRole === 'COMPANY_ADMIN' ||
      userRole === 'ADMINISTRATOR' ||
      userRole === 'ROLE_ADMIN' ||
      userRole === 'ROLE_STORE_MANAGER';

    const adjustmentRecord = {
      id: `ADJ-${Date.now()}`,
      docNumber,
      warehouseId,
      warehouseName: warehouse.name,
      productId,
      productName: product.name,
      productSku: product.sku || '',
      barcode: product.barcode || '',
      stockId: resolvedStockId,
      bookQty,
      adjustmentMode: resolvedMode, // 'ADD' | 'SUBTRACT' | 'SET'
      deltaQty: Math.abs(adjustmentQty),
      countedQty: finalCountedQty,
      adjustmentQty,
      mrp: Number(product.mrp || 0),
      sellingPrice: Number(product.sellingRate || 0),
      costRate: Number(product.costRate || 0),
      valuationImpact: Number(valuationImpact.toFixed(2)),
      reason: reason || 'PHYSICAL_COUNT', // PHYSICAL_COUNT | DAMAGE | EXPIRY | LOSS | FOUND_STOCK | DATA_CORRECTION
      notes: notes || '',
      status: (needsApproval && !isManagerOrAdmin) ? 'PENDING_APPROVAL' : 'POSTED',
      createdBy: userId,
      createdAt: nowIso,
      approvedBy: null,
      approvedAt: null,
    };

    if (!needsApproval || isManagerOrAdmin) {
      // Auto-post if within threshold or submitted by Manager/Admin
      adjustmentRecord.status = 'POSTED';
      adjustmentRecord.approvedBy = userId;
      adjustmentRecord.approvedAt = nowIso;

      this.executeStockAdjustment(adjustmentRecord, db);
    }

    db.stockAdjustments.unshift(adjustmentRecord);
    saveDatabase(db);

    logAuditEvent(
      adjustmentRecord.status === 'POSTED' ? 'STOCK_ADJUSTED' : 'ADJUSTMENT_PENDING_APPROVAL',
      userId,
      `Stock adjustment ${docNumber} [${resolvedMode}] for ${product.name} (Stock ID: ${resolvedStockId}): Current ${bookQty} -> ${adjustmentQty >= 0 ? '+' : ''}${adjustmentQty} -> Resulting ${finalCountedQty}. Status: ${adjustmentRecord.status}`
    );

    return adjustmentRecord;
  },

  /**
   * Approve and post pending adjustment
   */
  approveAdjustment(adjustmentId, approverUserId = 'USR-04') {
    const db = getDatabase();
    const adj = db.stockAdjustments.find(a => a.id === adjustmentId);
    if (!adj) throw new Error('ADJUSTMENT_ERROR: Adjustment record not found.');
    if (adj.status !== 'PENDING_APPROVAL') {
      throw new Error(`ADJUSTMENT_ERROR: Adjustment is already ${adj.status}.`);
    }

    adj.status = 'POSTED';
    adj.approvedBy = approverUserId;
    adj.approvedAt = new Date().toISOString();

    this.executeStockAdjustment(adj, db);
    saveDatabase(db);

    logAuditEvent('ADJUSTMENT_APPROVED', approverUserId, `Adjustment ${adj.docNumber} approved by manager.`);
    return adj;
  },

  /**
   * Internal execution of movement
   */
  executeStockAdjustment(adj, db) {
    if (adj.adjustmentQty === 0) return;

    const docType = adj.adjustmentQty > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';
    StockService.postMovement({
      docType,
      docId: adj.id,
      docNumber: adj.docNumber,
      warehouseId: adj.warehouseId,
      productId: adj.productId,
      stockId: adj.stockId,
      quantityDelta: adj.adjustmentQty,
      costRate: adj.costRate,
      reason: `Stock adjustment [${adj.adjustmentMode || (adj.adjustmentQty > 0 ? 'ADD' : 'SUBTRACT')}]: (${adj.reason}): ${adj.notes || 'Physical audit'}`,
      userId: adj.approvedBy || adj.createdBy,
    }, db);
  }
};
