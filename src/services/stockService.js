// Stock Service: Centralized Stock Management with Atomic Locking, Movement Ledger, and Balance Protection
import { getDatabase, saveDatabase, logAuditEvent } from './storageService.js';

// In-memory mutex for concurrency control simulation
const activeStockLocks = new Set();

export const StockService = {
  /**
   * Acquire simulated row lock for stock balance
   */
  acquireLock(warehouseId, productId) {
    const key = `${warehouseId}:${productId}`;
    if (activeStockLocks.has(key)) {
      throw new Error(`CONCURRENCY_CONFLICT: Stock row for warehouse ${warehouseId} and product ${productId} is currently locked by another transaction.`);
    }
    activeStockLocks.add(key);
    return () => activeStockLocks.delete(key);
  },

  /**
   * Release all locks (fail-safe cleanup)
   */
  releaseAllLocks() {
    activeStockLocks.clear();
  },

  /**
   * Get current stock balance for a product in a warehouse
   */
  getStockBalance(warehouseId, productId) {
    const db = getDatabase();
    const row = db.stockBalances.find(b => b.warehouseId === warehouseId && b.productId === productId);
    return row ? Number(row.quantity) : 0;
  },

  /**
   * Get detailed stock row
   */
  getStockRecord(warehouseId, productId) {
    const db = getDatabase();
    return db.stockBalances.find(b => b.warehouseId === warehouseId && b.productId === productId) || null;
  },

  /**
   * Get all stock balances with product details, filtered by store or warehouse
   */
  getAllStockBalances({ companyId, storeId, warehouseId } = {}) {
    const db = getDatabase();
    let warehouses = db.warehouses;
    if (companyId) warehouses = warehouses.filter(w => w.companyId === companyId);
    if (storeId) warehouses = warehouses.filter(w => w.storeId === storeId);
    if (warehouseId) warehouses = warehouses.filter(w => w.id === warehouseId);

    const warehouseIds = new Set(warehouses.map(w => w.id));

    return db.stockBalances
      .filter(b => warehouseIds.has(b.warehouseId))
      .map(b => {
        const prod = db.products.find(p => p.id === b.productId) || {};
        const wh = db.warehouses.find(w => w.id === b.warehouseId) || {};
        const store = db.stores.find(s => s.id === wh.storeId) || {};
        return {
          ...b,
          product: prod,
          warehouse: wh,
          store: store,
          isLowStock: Number(b.quantity) <= (prod.minStockAlert || 5),
          totalValuation: Number(b.quantity) * Number(b.valuationRate || prod.costRate || 0),
        };
      });
  },

  /**
   * Get stock movement ledger with full drill-down capability
   */
  getStockMovements({ productId, warehouseId, docType } = {}) {
    const db = getDatabase();
    let movements = [...db.stockMovements];
    if (productId) movements = movements.filter(m => m.productId === productId);
    if (warehouseId) movements = movements.filter(m => m.warehouseId === warehouseId);
    if (docType) movements = movements.filter(m => m.docType === docType);

    // Sort descending by timestamp
    return movements.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).map(m => {
      const prod = db.products.find(p => p.id === m.productId) || {};
      const wh = db.warehouses.find(w => w.id === m.warehouseId) || {};
      const user = db.users.find(u => u.id === m.userId) || {};
      return {
        ...m,
        productName: prod.name || m.productId,
        productSku: prod.sku || '',
        warehouseName: wh.name || m.warehouseId,
        userName: user.name || m.userId,
      };
    });
  },

  /**
   * Post Stock Movement atomically
   * @param {Object} movementData
   * {
   *   docType: 'SALE_OUT' | 'PURCHASE_IN' | 'RETURN_IN' | 'RETURN_OUT' | 'TRANSFER_OUT' | 'TRANSFER_IN' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT',
   *   docId: string,
   *   docNumber: string,
   *   warehouseId: string,
   *   productId: string,
   *   quantityDelta: number, (negative for reduction, positive for addition)
   *   costRate: number,
   *   reason: string,
   *   userId: string,
   *   dbInstance: Object (optional for active transaction)
   * }
   */
  postMovement(movementData, dbInstance = null) {
    const db = dbInstance || getDatabase();
    const {
      docType,
      docId,
      docNumber,
      warehouseId,
      productId,
      quantityDelta,
      costRate,
      reason,
      userId
    } = movementData;

    const qty = Number(quantityDelta);
    if (qty === 0) {
      throw new Error('STOCK_POST_ERROR: Movement quantity cannot be zero.');
    }

    // Find or initialize balance row
    let stockRow = db.stockBalances.find(b => b.warehouseId === warehouseId && b.productId === productId);
    const currentQty = stockRow ? Number(stockRow.quantity) : 0;
    const newQty = currentQty + qty;

    // Check negative stock policy
    if (db.settings.blockNegativeStock && newQty < 0) {
      const prod = db.products.find(p => p.id === productId);
      const prodName = prod ? prod.name : productId;
      throw new Error(`INSUFFICIENT_STOCK: Insufficient stock for "${prodName}". Available: ${currentQty}, Requested reduction: ${Math.abs(qty)}. Negative stock is strictly blocked.`);
    }

    // Calculate new valuation rate (Weighted Average Cost) for incoming stock
    let newValuationRate = stockRow ? Number(stockRow.valuationRate || 0) : Number(costRate || 0);
    if (qty > 0 && costRate && costRate > 0) {
      if (currentQty <= 0) {
        newValuationRate = Number(costRate);
      } else {
        const oldValuation = currentQty * newValuationRate;
        const incomingValuation = qty * Number(costRate);
        newValuationRate = Number(((oldValuation + incomingValuation) / newQty).toFixed(2));
      }
    }

    if (!stockRow) {
      stockRow = {
        id: 'STK-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        warehouseId,
        productId,
        quantity: newQty,
        valuationRate: newValuationRate,
      };
      db.stockBalances.push(stockRow);
    } else {
      stockRow.quantity = newQty;
      stockRow.valuationRate = newValuationRate;
    }

    // Append to immutable Stock Movement Ledger
    const movementRecord = {
      id: 'SMOV-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
      timestamp: new Date().toISOString(),
      docType,
      docId,
      docNumber,
      warehouseId,
      productId,
      qtyChange: qty,
      balanceAfter: newQty,
      costRate: costRate || newValuationRate,
      reason: reason || `Automated posting from ${docType}`,
      userId: userId || 'SYSTEM',
    };

    db.stockMovements.push(movementRecord);

    if (!dbInstance) {
      saveDatabase(db);
      logAuditEvent('STOCK_MOVEMENT', userId, `Stock ${qty > 0 ? '+' + qty : qty} in ${warehouseId} for ${productId} (${docType} ${docNumber})`);
    }

    return { stockRow, movementRecord };
  }
};
