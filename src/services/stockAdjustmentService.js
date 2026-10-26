// StockAdjustmentService: Physical Counts, Variance Calculation, and Approval Workflows
import { getDatabase, saveDatabase, logAuditEvent } from './storageService.js';
import { StockService } from './stockService.js';


export const StockAdjustmentService = {
  /**
   * Submit physical inventory count / stock adjustment
   */
  submitAdjustment({ warehouseId, productId, countedQty, reason, notes, userRole, userId = 'USR-03' }) {
    const db = getDatabase();
    const warehouse = db.warehouses.find(w => w.id === warehouseId);
    const product = db.products.find(p => p.id === productId);

    if (!warehouse || !product) throw new Error('ADJUSTMENT_ERROR: Warehouse or product not found.');

    const bookQty = StockService.getStockBalance(warehouseId, productId);
    const adjustmentQty = Number(countedQty) - bookQty;
    const valuationImpact = Math.abs(adjustmentQty * (product.costRate || 0));

    const needsApproval =
      Math.abs(adjustmentQty) > db.settings.managerApprovalThresholdQty ||
      valuationImpact > db.settings.managerApprovalThresholdAmount;

    const count = db.stockAdjustments.length + 1;
    const docNumber = `ADJ-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;
    const nowIso = new Date().toISOString();

    const adjustmentRecord = {
      id: `ADJ-${Date.now()}`,
      docNumber,
      warehouseId,
      warehouseName: warehouse.name,
      productId,
      productName: product.name,
      bookQty,
      countedQty: Number(countedQty),
      adjustmentQty,
      valuationImpact: Number(valuationImpact.toFixed(2)),
      reason: reason || 'PHYSICAL_COUNT', // PHYSICAL_COUNT | DAMAGE | EXPIRY | LOSS | FOUND_STOCK | DATA_CORRECTION
      notes: notes || '',
      status: needsApproval ? 'PENDING_APPROVAL' : 'POSTED',
      createdBy: userId,
      createdAt: nowIso,
      approvedBy: null,
      approvedAt: null,
    };

    if (!needsApproval || userRole === 'STORE_MANAGER' || userRole === 'COMPANY_ADMIN') {
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
      `Stock adjustment ${docNumber} for ${product.name}: Book ${bookQty} -> Counted ${countedQty} (${adjustmentQty > 0 ? '+' + adjustmentQty : adjustmentQty}). Status: ${adjustmentRecord.status}`
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
      quantityDelta: adj.adjustmentQty,
      reason: `Stock count adjustment (${adj.reason}): ${adj.notes || 'Physical audit'}`,
      userId: adj.approvedBy || adj.createdBy,
    }, db);
  }
};
