// StockTransferService: Inter-warehouse / store transfers with In-Transit tracking and variance handling
import { getDatabase, saveDatabase, logAuditEvent } from './storageService.js';
import { StockService } from './stockService.js';


export const StockTransferService = {
  /**
   * Create Transfer Request (Draft / Approved)
   */
  createTransfer({ sourceWarehouseId, destinationWarehouseId, companyId, storeId, items, notes, userId = 'USR-03' }) {
    const db = getDatabase();

    if (sourceWarehouseId === destinationWarehouseId) {
      throw new Error('TRANSFER_ERROR: Source and destination warehouses must be different.');
    }

    const srcWh = db.warehouses.find(w => w.id === sourceWarehouseId);
    const dstWh = db.warehouses.find(w => w.id === destinationWarehouseId);
    if (!srcWh || !dstWh) throw new Error('TRANSFER_ERROR: Invalid warehouse references.');

    const count = db.stockTransfers.length + 1;
    const docNumber = `TRF-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;
    const nowIso = new Date().toISOString();

    const transfer = {
      id: `TRF-${Date.now()}`,
      docNumber,
      sourceWarehouseId,
      destinationWarehouseId,
      sourceWarehouseName: srcWh.name,
      destinationWarehouseName: dstWh.name,
      sourceStoreId: srcWh.storeId,
      destinationStoreId: dstWh.storeId,
      companyId: companyId || srcWh.companyId,
      status: 'APPROVED', // DRAFT -> APPROVED -> DISPATCHED -> RECEIVED -> CLOSED
      lines: items.map(it => {
        const prod = db.products.find(p => p.id === it.productId);
        return {
          productId: it.productId,
          productName: prod ? prod.name : it.productId,
          requestedQty: Number(it.qty),
          dispatchedQty: 0,
          receivedQty: 0,
          damagedQty: 0,
          variance: 0,
        };
      }),
      createdAt: nowIso,
      dispatchedAt: null,
      receivedAt: null,
      createdBy: userId,
      notes: notes || '',
    };

    db.stockTransfers.push(transfer);
    saveDatabase(db);
    logAuditEvent('TRANSFER_CREATED', userId, `Stock transfer ${docNumber} approved from ${srcWh.name} to ${dstWh.name}`);
    return transfer;
  },

  /**
   * Dispatch Transfer: deducts source stock and places into in-transit
   */
  dispatchTransfer(transferId, userId = 'USR-03') {
    const db = getDatabase();
    const transfer = db.stockTransfers.find(t => t.id === transferId);
    if (!transfer) throw new Error('TRANSFER_ERROR: Transfer not found.');
    if (transfer.status !== 'APPROVED') {
      throw new Error(`TRANSFER_ERROR: Cannot dispatch transfer in "${transfer.status}" status.`);
    }

    // Verify and deduct stock from source warehouse
    for (const line of transfer.lines) {
      const available = StockService.getStockBalance(transfer.sourceWarehouseId, line.productId);
      if (line.requestedQty > available) {
        throw new Error(`INSUFFICIENT_STOCK: Source warehouse has only ${available} units of "${line.productName}". Requested ${line.requestedQty}.`);
      }

      line.dispatchedQty = line.requestedQty;

      // Post TRANSFER_OUT
      StockService.postMovement({
        docType: 'TRANSFER_OUT',
        docId: transfer.id,
        docNumber: transfer.docNumber,
        warehouseId: transfer.sourceWarehouseId,
        productId: line.productId,
        quantityDelta: -line.dispatchedQty,
        reason: `Transfer dispatched to ${transfer.destinationWarehouseName}`,
        userId,
      }, db);
    }

    transfer.status = 'DISPATCHED';
    transfer.dispatchedAt = new Date().toISOString();
    transfer.dispatchedBy = userId;

    saveDatabase(db);
    logAuditEvent('TRANSFER_DISPATCHED', userId, `Stock transfer ${transfer.docNumber} dispatched. In-transit recorded.`);
    return transfer;
  },

  /**
   * Receive Transfer: receives into destination warehouse and calculates variance
   */
  receiveTransfer(transferId, receiptLines, userId = 'USR-01') {
    const db = getDatabase();
    const transfer = db.stockTransfers.find(t => t.id === transferId);
    if (!transfer) throw new Error('TRANSFER_ERROR: Transfer not found.');
    if (transfer.status !== 'DISPATCHED') {
      throw new Error(`TRANSFER_ERROR: Transfer must be in DISPATCHED status to receive. Current: ${transfer.status}`);
    }

    const nowIso = new Date().toISOString();

    for (const line of transfer.lines) {
      const receipt = receiptLines.find(r => r.productId === line.productId) || {
        receivedQty: line.dispatchedQty,
        damagedQty: 0,
      };

      const acceptedQty = Number(receipt.receivedQty || 0);
      const damagedQty = Number(receipt.damagedQty || 0);

      // Section 8: Destination receipt cannot silently exceed dispatched quantity
      if (acceptedQty + damagedQty > line.dispatchedQty) {
        throw new Error(`VARIANCE_ERROR: Received qty (${acceptedQty}) + damaged qty (${damagedQty}) exceeds dispatched qty (${line.dispatchedQty}) for "${line.productName}".`);
      }

      line.receivedQty = acceptedQty;
      line.damagedQty = damagedQty;
      line.variance = line.dispatchedQty - (acceptedQty + damagedQty); // Positive means shortage in transit

      // Post accepted goods into destination warehouse
      if (acceptedQty > 0) {
        StockService.postMovement({
          docType: 'TRANSFER_IN',
          docId: transfer.id,
          docNumber: transfer.docNumber,
          warehouseId: transfer.destinationWarehouseId,
          productId: line.productId,
          quantityDelta: acceptedQty,
          reason: `Transfer stock receipt from ${transfer.sourceWarehouseName}`,
          userId,
        }, db);
      }

      // If damaged goods, route to quarantine if available
      if (damagedQty > 0) {
        const quarantineWh = db.warehouses.find(w => w.type === 'QUARANTINE' && w.companyId === transfer.companyId);
        if (quarantineWh) {
          StockService.postMovement({
            docType: 'TRANSFER_IN',
            docId: transfer.id,
            docNumber: transfer.docNumber,
            warehouseId: quarantineWh.id,
            productId: line.productId,
            quantityDelta: damagedQty,
            reason: `Damaged transfer units moved to quarantine (${transfer.docNumber})`,
            userId,
          }, db);
        }
      }
    }

    transfer.status = 'CLOSED';
    transfer.receivedAt = nowIso;
    transfer.receivedBy = userId;

    saveDatabase(db);
    logAuditEvent('TRANSFER_RECEIVED', userId, `Transfer ${transfer.docNumber} received at ${transfer.destinationWarehouseName}. Status CLOSED.`);
    return transfer;
  }
};
