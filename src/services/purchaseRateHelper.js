/**
 * purchaseRateHelper.js
 * Helpers for resolving purchase rates and historical valuation for products.
 *
 * Rules:
 * - If a product was never purchased and has 0 standard cost, rate is 0 (never default to 100).
 * - If a product was purchased once or more, auto-load that previous purchase rate.
 */

export function getProductStockRates(productId, db, supplierId = null) {
  if (!db || !productId) return [];
  const prod = (db.products || []).find((p) => p.id === productId);
  const entries = [];

  // 1. Previous purchase receipts (sorted newest first)
  const purchases = [...(db.purchases || [])].sort((a, b) => {
    const tA = new Date(a.date || a.createdAt || 0).getTime();
    const tB = new Date(b.date || b.createdAt || 0).getTime();
    return tB - tA;
  });

  purchases.forEach((p) => {
    const isSupplierMatch = Boolean(supplierId && p.supplierId === supplierId);
    (p.lines || p.items || [])
      .filter((l) => (l.productId === productId || l.id === productId) && Number(l.costPrice || l.rate) > 0)
      .forEach((l) => {
        entries.push({
          rate: Number(l.costPrice || l.rate),
          qty: Number(l.qty || 0),
          source: isSupplierMatch
            ? `Purchase Bill (${p.docNumber || 'Inward'} - Same Supplier)`
            : `Purchase Bill (${p.docNumber || 'Inward'})`,
          warehouseName: p.branchName || p.storeName || '',
          isSupplierMatch,
        });
      });
  });

  // 2. Stock balances
  (db.stockBalances || [])
    .filter((b) => b.productId === productId && Number(b.valuationRate) > 0)
    .forEach((b) => {
      const wh = (db.warehouses || []).find((w) => w.id === b.warehouseId);
      entries.push({
        rate: Number(b.valuationRate),
        qty: Number(b.quantity || 0),
        source: `Stock Balance (${wh?.name || b.warehouseId})`,
        warehouseName: wh?.name || b.warehouseId,
        isSupplierMatch: false,
      });
    });

  // 3. Opening stocks
  (db.initialStocks || [])
    .filter((i) => i.productId === productId && Number(i.valuationRate) > 0)
    .forEach((i) => {
      const wh = (db.warehouses || []).find((w) => w.id === i.warehouseId);
      entries.push({
        rate: Number(i.valuationRate),
        qty: Number(i.quantity || 0),
        source: `Opening Stock (${i.docNumber || wh?.name || 'Initial'})`,
        warehouseName: wh?.name || i.warehouseId,
        isSupplierMatch: false,
      });
    });

  // 4. Product master standard cost ONLY IF explicitly configured > 0
  if (prod && Number(prod.costRate) > 0) {
    entries.push({
      rate: Number(prod.costRate),
      qty: null,
      source: 'Product Master Standard Cost',
      warehouseName: 'Catalog Master',
      isSupplierMatch: false,
    });
  }

  const map = new Map();
  for (const entry of entries) {
    const key = entry.rate.toFixed(2);
    if (!map.has(key)) {
      map.set(key, {
        rate: entry.rate,
        sources: [entry.source],
        stockQty: entry.qty || 0,
        isSupplierMatch: entry.isSupplierMatch,
      });
    } else {
      const existing = map.get(key);
      if (!existing.sources.includes(entry.source)) existing.sources.push(entry.source);
      if (entry.qty) existing.stockQty += entry.qty;
      if (entry.isSupplierMatch) existing.isSupplierMatch = true;
    }
  }
  return Array.from(map.values());
}

export function getLatestHistoricalPurchaseRate(productId, db, supplierId = null) {
  if (!db || !productId) return 0;

  const purchases = [...(db.purchases || [])].sort((a, b) => {
    const tA = new Date(a.date || a.createdAt || 0).getTime();
    const tB = new Date(b.date || b.createdAt || 0).getTime();
    return tB - tA;
  });

  // 1. Try to find the latest purchase from the same supplier
  if (supplierId) {
    for (const p of purchases) {
      if (p.supplierId === supplierId) {
        const line = (p.lines || p.items || []).find(
          (l) => (l.productId === productId || l.id === productId) && Number(l.costPrice || l.rate) > 0
        );
        if (line) return Number(line.costPrice || line.rate);
      }
    }
  }

  // 2. Try to find the latest purchase from any supplier
  for (const p of purchases) {
    const line = (p.lines || p.items || []).find(
      (l) => (l.productId === productId || l.id === productId) && Number(l.costPrice || l.rate) > 0
    );
    if (line) return Number(line.costPrice || line.rate);
  }

  // 3. Stock balance valuation rate
  const stock = (db.stockBalances || []).find(
    (b) => b.productId === productId && Number(b.valuationRate) > 0
  );
  if (stock) return Number(stock.valuationRate);

  // 4. Initial opening stock
  const initial = (db.initialStocks || []).find(
    (i) => i.productId === productId && Number(i.valuationRate) > 0
  );
  if (initial) return Number(initial.valuationRate);

  // 5. Product standard cost rate (only if explicitly set > 0)
  const prod = (db.products || []).find((p) => p.id === productId);
  if (prod && Number(prod.costRate) > 0) return Number(prod.costRate);

  return 0;
}
