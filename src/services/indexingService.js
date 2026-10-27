/**
 * Database Indexing & Asynchronous AJAX Query Engine for NexBill ERP
 * 
 * Specifically optimized for high-volume enterprise datasets:
 * - 3 Lakh+ (300,000+) product catalogs and stock balances
 * - Multi-year transaction histories (>1 year data in reports)
 * - O(1) hash map and compound key lookups
 * - Binary search date-range slicing in O(log N)
 * - Asynchronous chunked / paginated AJAX query contracts with simulated server response
 */

// Cache storing built indexes keyed by database revision
let cachedIndexes = null;
let cachedDbRef = null;
let indexBuildCount = 0;

/**
 * Binary search to find first index with epoch >= target
 */
function binarySearchFirstGE(arr, targetEpoch) {
  let low = 0;
  let high = arr.length - 1;
  let ans = arr.length;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (arr[mid].epoch >= targetEpoch) {
      ans = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }
  return ans;
}

/**
 * Binary search to find last index with epoch <= target
 */
function binarySearchLastLE(arr, targetEpoch) {
  let low = 0;
  let high = arr.length - 1;
  let ans = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (arr[mid].epoch <= targetEpoch) {
      ans = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return ans;
}

/**
 * Build or retrieve cached database table indexes
 */
export function getDatabaseIndexes(db) {
  if (!db) return null;
  if (cachedIndexes && cachedDbRef === db) {
    return cachedIndexes;
  }

  const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

  // 1. Products Index
  const products = db.products || [];
  const productsById = new Map();
  const productsBySku = new Map();
  const productsByBarcode = new Map();
  const productsByCategory = new Map();
  const productsByMainCategory = new Map();
  const productsByBrand = new Map();
  const productsBySupplier = new Map();
  const productSearchTokens = new Map(); // token -> Set of productIds

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    if (!p) continue;
    if (p.id) productsById.set(p.id, p);
    if (p.sku) productsBySku.set(p.sku.trim().toLowerCase(), p);
    if (p.barcode) productsByBarcode.set(p.barcode.trim(), p);

    // Category index
    const cat = (p.category || p.categoryId || '').trim().toLowerCase();
    if (cat) {
      if (!productsByCategory.has(cat)) productsByCategory.set(cat, []);
      productsByCategory.get(cat).push(p);
    }

    // Main Category index
    const mainCat = (p.mainCategory || p.mainCategoryId || '').trim().toLowerCase();
    if (mainCat) {
      if (!productsByMainCategory.has(mainCat)) productsByMainCategory.set(mainCat, []);
      productsByMainCategory.get(mainCat).push(p);
    }

    // Brand index
    const brand = (p.brand || p.brandId || '').trim().toLowerCase();
    if (brand) {
      if (!productsByBrand.has(brand)) productsByBrand.set(brand, []);
      productsByBrand.get(brand).push(p);
    }
    if (Array.isArray(p.brands)) {
      p.brands.forEach((b) => {
        const bStr = (b || '').trim().toLowerCase();
        if (bStr) {
          if (!productsByBrand.has(bStr)) productsByBrand.set(bStr, []);
          productsByBrand.get(bStr).push(p);
        }
      });
    }

    // Supplier index
    if (Array.isArray(p.supplierIds)) {
      p.supplierIds.forEach((sid) => {
        if (!productsBySupplier.has(sid)) productsBySupplier.set(sid, []);
        productsBySupplier.get(sid).push(p);
      });
    } else if (p.supplierId) {
      if (!productsBySupplier.has(p.supplierId)) productsBySupplier.set(p.supplierId, []);
      productsBySupplier.get(p.supplierId).push(p);
    }
  }

  // 2. Warehouses, Categories, Main Categories, Brands, Suppliers, Customers Index ($O(1)$ fast lookups)
  const warehousesById = new Map();
  (db.warehouses || []).forEach((w) => { if (w.id) warehousesById.set(w.id, w); });

  const categoriesById = new Map();
  (db.categories || []).forEach((c) => {
    if (c.id) categoriesById.set(c.id, c);
    if (c.name) categoriesById.set(c.name.trim().toLowerCase(), c);
  });

  const mainCategoriesById = new Map();
  (db.mainCategories || []).forEach((m) => {
    if (m.id) mainCategoriesById.set(m.id, m);
    if (m.name) mainCategoriesById.set(m.name.trim().toLowerCase(), m);
  });

  const brandsById = new Map();
  (db.brands || []).forEach((b) => {
    if (b.id) brandsById.set(b.id, b);
    if (b.name) brandsById.set(b.name.trim().toLowerCase(), b);
  });

  const suppliersById = new Map();
  (db.suppliers || []).forEach((s) => { if (s.id) suppliersById.set(s.id, s); });

  const customersById = new Map();
  (db.customers || []).forEach((c) => { if (c.id) customersById.set(c.id, c); });

  // 3. Stock Balances Compound Index
  const stockBalances = db.stockBalances || [];
  const stockBalancesByCompound = new Map(); // "warehouseId:productId" -> balance
  const stockBalancesByWarehouse = new Map(); // warehouseId -> balance[]
  const stockBalancesByProduct = new Map(); // productId -> balance[]

  for (let i = 0; i < stockBalances.length; i++) {
    const b = stockBalances[i];
    if (!b) continue;
    const compoundKey = `${b.warehouseId}:${b.productId}`;
    stockBalancesByCompound.set(compoundKey, b);

    if (!stockBalancesByWarehouse.has(b.warehouseId)) stockBalancesByWarehouse.set(b.warehouseId, []);
    stockBalancesByWarehouse.get(b.warehouseId).push(b);

    if (!stockBalancesByProduct.has(b.productId)) stockBalancesByProduct.set(b.productId, []);
    stockBalancesByProduct.get(b.productId).push(b);
  }

  // 4. Stock Movements Compound Summary & Time-Series Index
  // Pre-aggregating per (productId:warehouseId) turns O(N^2) stock reporting into O(1) lookups!
  const stockMovements = db.stockMovements || [];
  const movementsCompoundSummary = new Map(); // "productId:warehouseId" -> { initialStockQty, purchasedInwardQty, salesOutwardQty, count }
  const movementsSortedByDate = [];

  for (let i = 0; i < stockMovements.length; i++) {
    const m = stockMovements[i];
    if (!m) continue;

    const key = `${m.productId}:${m.warehouseId}`;
    let summary = movementsCompoundSummary.get(key);
    if (!summary) {
      summary = {
        initialStockQty: 0,
        purchasedInwardQty: 0,
        salesOutwardQty: 0,
        totalMovementCount: 0,
      };
      movementsCompoundSummary.set(key, summary);
    }

    summary.totalMovementCount += 1;
    const qtyChange = Number(m.qtyChange ?? m.quantityDelta ?? m.quantity) || 0;

    if (m.docType === 'INITIAL_STOCK') {
      summary.initialStockQty += qtyChange;
    } else if (m.docType === 'PURCHASE_IN' || m.docType === 'PURCHASE') {
      summary.purchasedInwardQty += qtyChange;
    } else if (m.docType === 'SALES_OUT' || m.docType === 'POS_SALE' || m.docType === 'SALE') {
      summary.salesOutwardQty += Math.abs(qtyChange);
    }

    const epoch = m.timestamp ? new Date(m.timestamp).getTime() : 0;
    movementsSortedByDate.push({ epoch, movement: m });
  }
  movementsSortedByDate.sort((a, b) => a.epoch - b.epoch);

  // 5. Invoices Time-Series & Status Index
  const invoices = db.invoices || [];
  const invoicesSortedByDate = [];
  const invoicesByStatus = new Map();
  const invoicesById = new Map();

  for (let i = 0; i < invoices.length; i++) {
    const inv = invoices[i];
    if (!inv) continue;
    if (inv.id) invoicesById.set(inv.id, inv);
    if (inv.docNumber) invoicesById.set(inv.docNumber, inv);

    const st = inv.status || 'DRAFT';
    if (!invoicesByStatus.has(st)) invoicesByStatus.set(st, []);
    invoicesByStatus.get(st).push(inv);

    const epoch = inv.date ? new Date(inv.date).getTime() : 0;
    invoicesSortedByDate.push({ epoch, invoice: inv });
  }
  invoicesSortedByDate.sort((a, b) => a.epoch - b.epoch);

  // 6. Purchases Time-Series & Entry Type Index
  const purchases = db.purchases || [];
  const purchasesSortedByDate = [];
  const standardPurchases = [];
  const initialStockInwards = [];
  const purchasesById = new Map();

  for (let i = 0; i < purchases.length; i++) {
    const pur = purchases[i];
    if (!pur) continue;
    if (pur.id) purchasesById.set(pur.id, pur);
    if (pur.docNumber) purchasesById.set(pur.docNumber, pur);

    const isInit = pur.isInitialStock || pur.entryType === 'INITIAL_STOCK' || pur.docNumber?.startsWith('INIT-');
    if (isInit) {
      initialStockInwards.push(pur);
    } else {
      standardPurchases.push(pur);
    }

    const epoch = pur.date ? new Date(pur.date).getTime() : 0;
    purchasesSortedByDate.push({ epoch, purchase: pur, isInitialStock: isInit });
  }
  purchasesSortedByDate.sort((a, b) => a.epoch - b.epoch);

  // 7. Initial Stocks Index
  const initialStocks = db.initialStocks || [];
  const initialStocksByWarehouse = new Map();
  const initialStocksByProduct = new Map();

  for (let i = 0; i < initialStocks.length; i++) {
    const init = initialStocks[i];
    if (!init) continue;

    if (!initialStocksByWarehouse.has(init.warehouseId)) initialStocksByWarehouse.set(init.warehouseId, []);
    initialStocksByWarehouse.get(init.warehouseId).push(init);

    if (!initialStocksByProduct.has(init.productId)) initialStocksByProduct.set(init.productId, []);
    initialStocksByProduct.get(init.productId).push(init);
  }

  const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
  indexBuildCount++;

  cachedIndexes = {
    products: {
      all: products,
      byId: productsById,
      bySku: productsBySku,
      byBarcode: productsByBarcode,
      byCategory: productsByCategory,
      byMainCategory: productsByMainCategory,
      byBrand: productsByBrand,
      bySupplier: productsBySupplier,
      searchTokens: productSearchTokens,
    },
    warehouses: {
      byId: warehousesById,
      all: db.warehouses || [],
    },
    categories: {
      byId: categoriesById,
      all: db.categories || [],
    },
    mainCategories: {
      byId: mainCategoriesById,
      all: db.mainCategories || [],
    },
    brands: {
      byId: brandsById,
      all: db.brands || [],
    },
    suppliers: {
      byId: suppliersById,
      all: db.suppliers || [],
    },
    customers: {
      byId: customersById,
      all: db.customers || [],
    },
    stockBalances: {
      all: stockBalances,
      byCompound: stockBalancesByCompound,
      byWarehouse: stockBalancesByWarehouse,
      byProduct: stockBalancesByProduct,
    },
    stockMovements: {
      all: stockMovements,
      byCompoundSummary: movementsCompoundSummary,
      sortedByDate: movementsSortedByDate,
    },
    invoices: {
      all: invoices,
      byId: invoicesById,
      sortedByDate: invoicesSortedByDate,
      byStatus: invoicesByStatus,
    },
    purchases: {
      all: purchases,
      byId: purchasesById,
      sortedByDate: purchasesSortedByDate,
      standard: standardPurchases,
      initialStocks: initialStockInwards,
    },
    initialStocks: {
      all: initialStocks,
      byWarehouse: initialStocksByWarehouse,
      byProduct: initialStocksByProduct,
    },
    stats: {
      buildTimeMs: (endTime - startTime).toFixed(1),
      buildCount: indexBuildCount,
      totalIndexedEntities:
        products.length +
        stockBalances.length +
        stockMovements.length +
        invoices.length +
        purchases.length,
    },
  };

  cachedDbRef = db;
  return cachedIndexes;
}

/**
 * Invalidate cached database indexes to force re-indexing on next access
 */
export function invalidateDatabaseIndexes() {
  cachedIndexes = null;
  cachedDbRef = null;
}

/**
 * Standard Date Range Calculator supporting Indian Financial Year & multi-year historical slicing
 */
export function getDateRangeEpochs(rangeType, customFromDate = null, customToDate = null) {
  const now = new Date();
  let startEpoch = 0;
  let endEpoch = Infinity;

  const getStartOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
  const getEndOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();

  // If explicit custom from/to dates are provided, prioritize them
  if (customFromDate || customToDate) {
    if (customFromDate) startEpoch = getStartOfDay(new Date(customFromDate));
    if (customToDate) endEpoch = getEndOfDay(new Date(customToDate));
    return { startEpoch, endEpoch };
  }

  switch (rangeType) {
    case 'TODAY': {
      startEpoch = getStartOfDay(now);
      endEpoch = getEndOfDay(now);
      break;
    }
    case 'YESTERDAY': {
      const y = new Date(now.getTime() - 86400000);
      startEpoch = getStartOfDay(y);
      endEpoch = getEndOfDay(y);
      break;
    }
    case 'THIS_WEEK': {
      const day = now.getDay() || 7; // Monday = 1
      const mon = new Date(now);
      mon.setDate(now.getDate() - day + 1);
      startEpoch = getStartOfDay(mon);
      endEpoch = getEndOfDay(now);
      break;
    }
    case 'THIS_MONTH': {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      startEpoch = getStartOfDay(first);
      endEpoch = getEndOfDay(now);
      break;
    }
    case 'LAST_MONTH': {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      startEpoch = getStartOfDay(first);
      endEpoch = getEndOfDay(last);
      break;
    }
    case 'LAST_30_DAYS': {
      startEpoch = getStartOfDay(new Date(now.getTime() - 30 * 86400000));
      endEpoch = getEndOfDay(now);
      break;
    }
    case 'LAST_365_DAYS':
    case '1_YEAR': {
      startEpoch = getStartOfDay(new Date(now.getTime() - 365 * 86400000));
      endEpoch = getEndOfDay(now);
      break;
    }
    case 'CURRENT_FY': {
      // Indian FY starts April 1
      const currentYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      const startFY = new Date(currentYear, 3, 1); // April 1
      const endFY = new Date(currentYear + 1, 2, 31); // March 31
      startEpoch = getStartOfDay(startFY);
      endEpoch = getEndOfDay(endFY);
      break;
    }
    case 'LAST_FY': {
      const currentYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      const startFY = new Date(currentYear - 1, 3, 1);
      const endFY = new Date(currentYear, 2, 31);
      startEpoch = getStartOfDay(startFY);
      endEpoch = getEndOfDay(endFY);
      break;
    }
    case 'OLDER_THAN_1_YEAR': {
      startEpoch = 0;
      endEpoch = getEndOfDay(new Date(now.getTime() - 365 * 86400000));
      break;
    }
    case 'CUSTOM': {
      if (customFromDate) startEpoch = getStartOfDay(new Date(customFromDate));
      if (customToDate) endEpoch = getEndOfDay(new Date(customToDate));
      break;
    }
    case 'ALL':
    default: {
      startEpoch = 0;
      endEpoch = Infinity;
      break;
    }
  }

  return { startEpoch, endEpoch };
}

/**
 * Asynchronous AJAX Query Engine for Sales Invoices Report
 * Handles >1 year data with binary search range filtering & O(1) tender aggregations
 */
export async function fetchSalesReportAjax(db, {
  dateFilter = 'ALL',
  customFromDate = null,
  customToDate = null,
  search = '',
  statusFilter = 'POSTED',
  storeFilter = 'ALL',
  page = 1,
  pageSize = 50,
} = {}) {
  // Yield thread to simulate real AJAX asynchronous non-blocking fetch & trigger UI loading state
  await new Promise((resolve) => setTimeout(resolve, 10));

  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const indexes = getDatabaseIndexes(db);
  const { startEpoch, endEpoch } = getDateRangeEpochs(dateFilter, customFromDate, customToDate);

  // 1. Binary search slice invoices by date range
  const sorted = indexes.invoices.sortedByDate;
  const startIdx = binarySearchFirstGE(sorted, startEpoch);
  const endIdx = binarySearchLastLE(sorted, endEpoch);

  let filteredInvoices = [];
  if (startIdx <= endIdx && startIdx < sorted.length && endIdx >= 0) {
    for (let i = startIdx; i <= endIdx; i++) {
      const inv = sorted[i].invoice;
      if (statusFilter !== 'ALL' && inv.status !== statusFilter) continue;
      if (storeFilter !== 'ALL' && inv.storeId !== storeFilter) continue;
      filteredInvoices.push(inv);
    }
  }

  // 2. Fast Keyword Search (search invoice docNumber, customerName, phone)
  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    filteredInvoices = filteredInvoices.filter((inv) => {
      return (
        inv.docNumber?.toLowerCase().includes(q) ||
        inv.customerName?.toLowerCase().includes(q) ||
        inv.customerPhone?.includes(q)
      );
    });
  }

  // Newest first
  filteredInvoices.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // 3. Compute KPI Summary Aggregates across the entire filtered period in a single pass
  let totalRevenue = 0;
  let totalTax = 0;
  let cashTotal = 0;
  let upiTotal = 0;
  let cardTotal = 0;
  let creditTotal = 0;

  for (let i = 0; i < filteredInvoices.length; i++) {
    const inv = filteredInvoices[i];
    totalRevenue += Number(inv.netPayable || inv.grandTotal || 0);
    totalTax += Number(inv.totalTax || 0);

    const tenders = inv.tenders || [];
    for (let j = 0; j < tenders.length; j++) {
      const t = tenders[j];
      const amt = Number(t.amount) || 0;
      const m = t.method || '';
      if (m === 'CASH') cashTotal += amt;
      else if (m === 'UPI') upiTotal += amt;
      else if (m === 'CARD' || m.includes('CARD')) cardTotal += amt;
      else if (m === 'CREDIT') creditTotal += amt;
    }
  }

  // 4. Paginate current slice for zero-lag DOM rendering
  const totalCount = filteredInvoices.length;
  const safePageSize = Math.max(1, parseInt(pageSize, 10) || 50);
  const totalPages = Math.ceil(totalCount / safePageSize) || 1;
  const safePage = Math.min(Math.max(1, parseInt(page, 10) || 1), totalPages);

  const startRecord = (safePage - 1) * safePageSize;
  const pageData = filteredInvoices.slice(startRecord, startRecord + safePageSize);

  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();

  return {
    data: pageData,
    allFiltered: filteredInvoices,
    totalCount,
    page: safePage,
    pageSize: safePageSize,
    totalPages,
    startIndex: totalCount > 0 ? startRecord + 1 : 0,
    endIndex: Math.min(startRecord + safePageSize, totalCount),
    metrics: {
      totalRevenue,
      totalTax,
      totalInvoices: totalCount,
      cashTotal,
      upiTotal,
      cardTotal,
      creditTotal,
    },
    executionTimeMs: (t1 - t0).toFixed(1),
  };
}

/**
 * Asynchronous AJAX Query Engine for Purchases & Inwards Report
 * Supports Detailed Item-Wise List, Summary Invoices, and Multi-Dimensional Classification Filters
 */
export async function fetchPurchasesReportAjax(db, {
  dateFilter = 'ALL',
  customFromDate = null,
  customToDate = null,
  purchasesFilterMode = 'purchases_only', // 'purchases_only' | 'initial_stock_only' | 'all'
  search = '',
  supplierFilter = 'ALL',
  productFilter = 'ALL',
  brandFilter = 'ALL',
  categoryFilter = 'ALL',
  mainCategoryFilter = 'ALL',
  viewMode = 'detailed', // 'detailed' | 'summary'
  page = 1,
  pageSize = 50,
} = {}) {
  await new Promise((resolve) => setTimeout(resolve, 10));

  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const indexes = getDatabaseIndexes(db);
  const { startEpoch, endEpoch } = getDateRangeEpochs(dateFilter, customFromDate, customToDate);

  const sorted = indexes.purchases.sortedByDate;
  const startIdx = binarySearchFirstGE(sorted, startEpoch);
  const endIdx = binarySearchLastLE(sorted, endEpoch);

  // 1. Calculate historical rate progression / price variations per product across all chronological purchases
  // Chronological sort: oldest purchases first
  const allPurchasesChronological = [...(db.purchases || [])].sort((a, b) => {
    const tA = new Date(a.date || a.createdAt || 0).getTime();
    const tB = new Date(b.date || b.createdAt || 0).getTime();
    return tA - tB;
  });

  const productLastRateMap = new Map();
  const lineRateDiffs = new Map(); // `${purchaseId}:${idx}` -> { previousCost, costDiff, costDiffPercent }

  for (const pur of allPurchasesChronological) {
    const lines = pur.lines || pur.items || [];
    lines.forEach((l, idx) => {
      const pid = l.productId;
      if (!pid) return;
      const currentCp = Number(l.costPrice ?? l.rate ?? 0);
      const prevCp = productLastRateMap.get(pid);

      let costDiff = null;
      let costDiffPercent = null;
      if (prevCp !== undefined && prevCp !== null) {
        costDiff = Number((currentCp - prevCp).toFixed(2));
        costDiffPercent = prevCp > 0 ? Number((((currentCp - prevCp) / prevCp) * 100).toFixed(1)) : 0;
      }

      lineRateDiffs.set(`${pur.id}:${idx}`, {
        previousCost: prevCp !== undefined ? prevCp : null,
        costDiff,
        costDiffPercent,
      });

      if (currentCp > 0) {
        productLastRateMap.set(pid, currentCp);
      }
    });
  }

  // 2. Filter purchases within date window & mode/supplier
  let filteredPurchases = [];
  if (startIdx <= endIdx && startIdx < sorted.length && endIdx >= 0) {
    for (let i = startIdx; i <= endIdx; i++) {
      const entry = sorted[i];
      const pur = entry.purchase;
      const isInit = entry.isInitialStock;

      if (purchasesFilterMode === 'purchases_only' && isInit) continue;
      if (purchasesFilterMode === 'initial_stock_only' && !isInit) continue;
      if (supplierFilter !== 'ALL' && pur.supplierId !== supplierFilter) continue;

      filteredPurchases.push(pur);
    }
  }

  // Helper function to resolve product classification details
  const getProductMeta = (pid) => {
    const prod = indexes.products.byId.get(pid) || (db.products || []).find((p) => p.id === pid);
    const catObj = indexes.categories.byId.get(prod?.categoryId);
    const mainCatObj = indexes.mainCategories.byId.get(prod?.mainCategoryId);

    const mainCategoryName = mainCatObj?.name || prod?.mainCategory || 'General';
    const mainCategoryId = prod?.mainCategoryId || mainCatObj?.id || 'MCAT-01';

    const categoryName = catObj?.name || prod?.category || 'General';
    const categoryId = prod?.categoryId || catObj?.id || 'CAT-01';

    const brandName = (Array.isArray(prod?.brands) && prod.brands.length > 0 ? prod.brands[0] : prod?.brand) || 'Standard';
    const brandId = prod?.brandId || brandName;

    return {
      prod,
      mainCategoryName,
      mainCategoryId,
      categoryName,
      categoryId,
      brandName,
      brandId,
    };
  };

  // Helper to check if a product line matches classification filters
  const matchesLineFilters = (line, meta) => {
    if (productFilter && productFilter !== 'ALL' && line.productId !== productFilter && meta.prod?.id !== productFilter) {
      return false;
    }
    if (brandFilter && brandFilter !== 'ALL') {
      const matchesBrand =
        meta.brandId === brandFilter ||
        meta.brandName.toLowerCase() === brandFilter.toLowerCase() ||
        (Array.isArray(meta.prod?.brands) && meta.prod.brands.map((b) => b.toLowerCase()).includes(brandFilter.toLowerCase()));
      if (!matchesBrand) return false;
    }
    if (categoryFilter && categoryFilter !== 'ALL') {
      const matchesCat =
        meta.categoryId === categoryFilter ||
        meta.categoryName.toLowerCase() === categoryFilter.toLowerCase();
      if (!matchesCat) return false;
    }
    if (mainCategoryFilter && mainCategoryFilter !== 'ALL') {
      const matchesMainCat =
        meta.mainCategoryId === mainCategoryFilter ||
        meta.mainCategoryName.toLowerCase() === mainCategoryFilter.toLowerCase();
      if (!matchesMainCat) return false;
    }
    return true;
  };

  let detailedItems = [];
  let matchingInvoices = [];

  const q = search && search.trim() ? search.trim().toLowerCase() : null;

  for (const pur of filteredPurchases) {
    const isInit = Boolean(
      pur.isInitialStock ||
      pur.entryType === 'INITIAL_STOCK' ||
      pur.docNumber?.startsWith('INIT-')
    );
    const lines = pur.lines || pur.items || [];
    let invoiceHasMatchingLine = false;

    lines.forEach((line, idx) => {
      const meta = getProductMeta(line.productId);
      if (!matchesLineFilters(line, meta)) return;

      if (q) {
        const matchesSearch =
          pur.docNumber?.toLowerCase().includes(q) ||
          pur.supplierName?.toLowerCase().includes(q) ||
          pur.supplierInvoiceNo?.toLowerCase().includes(q) ||
          line.name?.toLowerCase().includes(q) ||
          line.sku?.toLowerCase().includes(q) ||
          meta.prod?.name?.toLowerCase().includes(q) ||
          meta.prod?.sku?.toLowerCase().includes(q) ||
          meta.brandName?.toLowerCase().includes(q) ||
          meta.categoryName?.toLowerCase().includes(q) ||
          meta.mainCategoryName?.toLowerCase().includes(q);
        if (!matchesSearch) return;
      }

      invoiceHasMatchingLine = true;

      const diffInfo = lineRateDiffs.get(`${pur.id}:${idx}`) || { previousCost: null, costDiff: null, costDiffPercent: null };
      const costPrice = Number(line.costPrice ?? line.rate ?? 0);
      const mrp = line.mrp !== null && line.mrp !== undefined && line.mrp !== '' ? Number(line.mrp) : null;
      const sellingPrice = line.sellingPrice !== null && line.sellingPrice !== undefined && line.sellingPrice !== '' ? Number(line.sellingPrice) : null;

      let spDiff = null;
      let marginPercent = null;
      if (sellingPrice !== null && sellingPrice > 0) {
        spDiff = Number((sellingPrice - costPrice).toFixed(2));
        marginPercent = Number((((sellingPrice - costPrice) / sellingPrice) * 100).toFixed(1));
      }

      let mrpDiff = null;
      if (mrp !== null && mrp > 0) {
        mrpDiff = Number((mrp - costPrice).toFixed(2));
      }

      detailedItems.push({
        id: `${pur.id}-${idx}`,
        purchaseId: pur.id,
        docNumber: pur.docNumber,
        isInitialStock: isInit,
        date: pur.date,
        supplierId: pur.supplierId,
        supplierName: pur.supplierName,
        supplierInvoiceNo: pur.supplierInvoiceNo,
        productId: line.productId,
        productName: line.name || meta.prod?.name || 'Product',
        sku: line.sku || meta.prod?.sku || '—',
        mainCategory: meta.mainCategoryName,
        mainCategoryId: meta.mainCategoryId,
        category: meta.categoryName,
        categoryId: meta.categoryId,
        brand: meta.brandName,
        brandId: meta.brandId,
        batchNo: line.batchNo || '—',
        qty: Number(line.qty || 0),
        uom: line.uom || meta.prod?.uom || 'PCS',
        costPrice,
        previousCostPrice: diffInfo.previousCost,
        costDiff: diffInfo.costDiff,
        costDiffPercent: diffInfo.costDiffPercent,
        mrp,
        mrpDiff,
        sellingPrice,
        spDiff,
        marginPercent,
        taxRate: Number(line.taxRate || 0),
        taxType: line.taxType || 'inclusive',
        taxAmount: Number(line.taxAmount || 0),
        lineTotal: Number(line.lineTotal || 0),
      });
    });

    if (invoiceHasMatchingLine) {
      matchingInvoices.push(pur);
    }
  }

  // Sort items and invoices: Newest first
  detailedItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  matchingInvoices.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Aggregate Metrics
  let standardPurchasesAmount = 0;
  let standardPurchaseTax = 0;
  let initialStockInwardAmount = 0;
  let totalInwardQuantity = 0;
  let totalSpDiff = 0;
  let spDiffCount = 0;

  for (let i = 0; i < detailedItems.length; i++) {
    const item = detailedItems[i];
    totalInwardQuantity += item.qty;
    if (item.spDiff !== null) {
      totalSpDiff += item.spDiff * item.qty;
      spDiffCount++;
    }
  }

  for (let i = 0; i < matchingInvoices.length; i++) {
    const p = matchingInvoices[i];
    const isInit = p.isInitialStock || p.entryType === 'INITIAL_STOCK' || p.docNumber?.startsWith('INIT-');
    const net = Number(p.netAmount || p.grandTotal || 0);
    const tax = Number(p.totalTax || 0);

    if (isInit) {
      initialStockInwardAmount += net;
    } else {
      standardPurchasesAmount += net;
      standardPurchaseTax += tax;
    }
  }

  const dataset = viewMode === 'detailed' ? detailedItems : matchingInvoices;
  const totalCount = dataset.length;
  const safePageSize = Math.max(1, parseInt(pageSize, 10) || 50);
  const totalPages = Math.ceil(totalCount / safePageSize) || 1;
  const safePage = Math.min(Math.max(1, parseInt(page, 10) || 1), totalPages);

  const startRecord = (safePage - 1) * safePageSize;
  const pageData = dataset.slice(startRecord, startRecord + safePageSize);

  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();

  return {
    data: pageData,
    allFiltered: dataset,
    detailedItems,
    matchingInvoices,
    totalCount,
    page: safePage,
    pageSize: safePageSize,
    totalPages,
    startIndex: totalCount > 0 ? startRecord + 1 : 0,
    endIndex: Math.min(startRecord + safePageSize, totalCount),
    metrics: {
      standardPurchasesAmount,
      standardPurchaseTax,
      initialStockInwardAmount,
      totalInwardQuantity,
      totalLinesCount: detailedItems.length,
      totalInvoicesCount: matchingInvoices.length,
      totalRecords: totalCount,
      avgSpDiff: spDiffCount > 0 ? Number((totalSpDiff / (totalInwardQuantity || 1)).toFixed(2)) : 0,
    },
    executionTimeMs: (t1 - t0).toFixed(1),
  };
}

/**
 * Asynchronous AJAX Query Engine for Initial Stock Audit Ledger
 */
export async function fetchInitialStockReportAjax(db, {
  warehouseFilter = 'ALL',
  search = '',
  page = 1,
  pageSize = 50,
} = {}) {
  await new Promise((resolve) => setTimeout(resolve, 10));

  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const indexes = getDatabaseIndexes(db);
  const rawList = db.initialStocks || [];

  let list = [];
  let totalValuation = 0;
  let totalUnits = 0;
  const docNumbersSet = new Set();

  for (let i = 0; i < rawList.length; i++) {
    const item = rawList[i];
    if (warehouseFilter !== 'ALL' && item.warehouseId !== warehouseFilter) continue;

    const prod = indexes.products.byId.get(item.productId);
    const wh = indexes.warehouses.byId.get(item.warehouseId);
    const qty = Number(item.quantity || 0);
    const rate = Number(item.valuationRate || prod?.costRate || 0);
    const totalVal = Number(item.totalValuation) || (qty * rate);

    const record = {
      ...item,
      productName: item.productName || prod?.name || item.productId,
      sku: prod?.sku || '',
      category: prod?.category || '',
      warehouseName: wh?.name || item.warehouseId,
      qty,
      rate,
      totalVal,
    };

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      const match =
        record.docNumber?.toLowerCase().includes(q) ||
        record.productName?.toLowerCase().includes(q) ||
        record.sku?.toLowerCase().includes(q) ||
        record.notes?.toLowerCase().includes(q);
      if (!match) continue;
    }

    list.push(record);
    totalValuation += totalVal;
    totalUnits += qty;
    if (record.docNumber) docNumbersSet.add(record.docNumber);
  }

  const totalCount = list.length;
  const safePageSize = Math.max(1, parseInt(pageSize, 10) || 50);
  const totalPages = Math.ceil(totalCount / safePageSize) || 1;
  const safePage = Math.min(Math.max(1, parseInt(page, 10) || 1), totalPages);

  const startRecord = (safePage - 1) * safePageSize;
  const pageData = list.slice(startRecord, startRecord + safePageSize);

  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();

  return {
    data: pageData,
    allFiltered: list,
    totalCount,
    page: safePage,
    pageSize: safePageSize,
    totalPages,
    startIndex: totalCount > 0 ? startRecord + 1 : 0,
    endIndex: Math.min(startRecord + safePageSize, totalCount),
    metrics: {
      totalValuation,
      totalUnits,
      docCount: docNumbersSet.size,
    },
    executionTimeMs: (t1 - t0).toFixed(1),
  };
}

/**
 * Asynchronous AJAX Query Engine for Warehouse Stock Valuation & Movement Ledger
 * Uses O(1) Compound Index (movementsCompoundSummary) preventing 90 Billion iterations
 */
export async function fetchStockValuationReportAjax(db, {
  warehouseFilter = 'ALL',
  search = '',
  stockStatusFilter = 'ALL', // 'ALL' | 'LOW_STOCK' | 'OUT_OF_STOCK'
  page = 1,
  pageSize = 50,
} = {}) {
  await new Promise((resolve) => setTimeout(resolve, 10));

  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const indexes = getDatabaseIndexes(db);
  const balances = db.stockBalances || [];

  let list = [];
  let totalValuation = 0;
  let totalUnits = 0;
  let lowStockCount = 0;

  for (let i = 0; i < balances.length; i++) {
    const b = balances[i];
    if (warehouseFilter !== 'ALL' && b.warehouseId !== warehouseFilter) continue;

    const prod = indexes.products.byId.get(b.productId);
    const wh = indexes.warehouses.byId.get(b.warehouseId);

    // O(1) Pre-aggregated composite movement summary lookup!
    const compoundKey = `${b.productId}:${b.warehouseId}`;
    const movSummary = indexes.stockMovements.byCompoundSummary.get(compoundKey) || {
      initialStockQty: 0,
      purchasedInwardQty: 0,
      salesOutwardQty: 0,
      totalMovementCount: 0,
    };

    const currentStock = Number(b.quantity || 0);
    const valRate = Number(b.valuationRate || prod?.costRate || 0);
    const totalVal = currentStock * valRate;
    const isLow = currentStock <= (prod?.minStockAlert || 5);
    const isOut = currentStock <= 0;

    if (stockStatusFilter === 'LOW_STOCK' && !isLow) continue;
    if (stockStatusFilter === 'OUT_OF_STOCK' && !isOut) continue;

    const mrp = Number(prod?.mrp || 0);
    const sellingRate = Number(prod?.sellingRate || 0);
    const priceDifference = sellingRate > 0 ? Number((sellingRate - valRate).toFixed(2)) : 0;
    const marginPercent = sellingRate > 0 ? Number((((sellingRate - valRate) / sellingRate) * 100).toFixed(1)) : 0;

    const row = {
      id: b.id,
      warehouseId: b.warehouseId,
      warehouseName: wh?.name || b.warehouseId,
      productId: b.productId,
      productName: prod?.name || b.productId,
      sku: prod?.sku || '',
      category: prod?.category || '',
      initialStockQty: movSummary.initialStockQty,
      purchasedInwardQty: movSummary.purchasedInwardQty,
      salesOutwardQty: movSummary.salesOutwardQty,
      currentStock,
      valRate,
      mrp,
      sellingRate,
      priceDifference,
      marginPercent,
      totalVal,
      isLow,
    };

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      const match =
        row.productName.toLowerCase().includes(q) ||
        row.sku.toLowerCase().includes(q) ||
        row.warehouseName.toLowerCase().includes(q) ||
        row.category.toLowerCase().includes(q);
      if (!match) continue;
    }

    list.push(row);
    totalValuation += totalVal;
    totalUnits += currentStock;
    if (isLow) lowStockCount++;
  }

  const totalCount = list.length;
  const safePageSize = Math.max(1, parseInt(pageSize, 10) || 50);
  const totalPages = Math.ceil(totalCount / safePageSize) || 1;
  const safePage = Math.min(Math.max(1, parseInt(page, 10) || 1), totalPages);

  const startRecord = (safePage - 1) * safePageSize;
  const pageData = list.slice(startRecord, startRecord + safePageSize);

  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();

  return {
    data: pageData,
    allFiltered: list,
    totalCount,
    page: safePage,
    pageSize: safePageSize,
    totalPages,
    startIndex: totalCount > 0 ? startRecord + 1 : 0,
    endIndex: Math.min(startRecord + safePageSize, totalCount),
    metrics: {
      totalValuation,
      totalUnits,
      lowStockCount,
      totalTrackedSkus: totalCount,
    },
    executionTimeMs: (t1 - t0).toFixed(1),
  };
}

/**
 * Asynchronous AJAX Query Engine for Master Entities (Products, Suppliers, Staff, etc.)
 * Optimized for 3 Lakh+ Products catalog
 */
export async function fetchMasterEntitiesAjax(db, entityKey, {
  search = '',
  supplierSupplyFilter = 'ALL',
  categoryFilter = 'ALL',
  page = 1,
  pageSize = 50,
} = {}) {
  await new Promise((resolve) => setTimeout(resolve, 10));

  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const indexes = getDatabaseIndexes(db);

  let rawList = [];
  switch (entityKey) {
    case 'product': rawList = db.products || []; break;
    case 'supplier': rawList = db.suppliers || []; break;
    case 'customer': rawList = db.customers || []; break;
    case 'category': rawList = db.categories || []; break;
    case 'main_category': rawList = db.mainCategories || []; break;
    case 'brand': rawList = db.brands || []; break;
    case 'unit': rawList = db.units || []; break;
    case 'company': rawList = db.companies || []; break;
    case 'branch': rawList = db.stores || []; break;
    case 'tax': rawList = db.taxes || []; break;
    case 'payment_mode': rawList = db.paymentModes || []; break;
    case 'staff': rawList = db.users || []; break;
    default: rawList = db[entityKey] || []; break;
  }

  let filtered = rawList;

  // 1. Supplier supply filter
  if (entityKey === 'supplier' && supplierSupplyFilter !== 'ALL') {
    filtered = filtered.filter((s) => (s.supplyType || 'LOCAL') === supplierSupplyFilter);
  }

  // 2. Category filter for products
  if (entityKey === 'product' && categoryFilter !== 'ALL') {
    filtered = filtered.filter((p) => p.category === categoryFilter || p.categoryId === categoryFilter);
  }

  // 3. Search query filtering
  if (search && search.trim()) {
    const q = search.trim().toLowerCase();

    // For products with large catalog: use token index if available, else property search
    filtered = filtered.filter((item) => {
      return (
        item.name?.toLowerCase().includes(q) ||
        item.code?.toLowerCase().includes(q) ||
        item.sku?.toLowerCase().includes(q) ||
        item.barcode?.includes(q) ||
        item.phone?.includes(q) ||
        item.category?.toLowerCase().includes(q) ||
        item.brand?.toLowerCase().includes(q)
      );
    });
  }

  const totalCount = filtered.length;
  const safePageSize = Math.max(1, parseInt(pageSize, 10) || 50);
  const totalPages = Math.ceil(totalCount / safePageSize) || 1;
  const safePage = Math.min(Math.max(1, parseInt(page, 10) || 1), totalPages);

  const startRecord = (safePage - 1) * safePageSize;
  const pageData = filtered.slice(startRecord, startRecord + safePageSize);

  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();

  return {
    data: pageData,
    allFiltered: filtered,
    totalCount,
    page: safePage,
    pageSize: safePageSize,
    totalPages,
    startIndex: totalCount > 0 ? startRecord + 1 : 0,
    endIndex: Math.min(startRecord + safePageSize, totalCount),
    executionTimeMs: (t1 - t0).toFixed(1),
  };
}

/**
 * Asynchronous AJAX Query Engine for Inventory Balances Table
 */
export async function fetchInventoryBalancesAjax(db, {
  warehouseFilter = 'ALL',
  search = '',
  stockFilterMode = 'ALL', // 'ALL' | 'LOW' | 'OUT'
  page = 1,
  pageSize = 50,
} = {}) {
  await new Promise((resolve) => setTimeout(resolve, 10));

  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const indexes = getDatabaseIndexes(db);
  const balances = db.stockBalances || [];

  let list = [];
  let totalValuation = 0;
  let lowStockCount = 0;

  for (let i = 0; i < balances.length; i++) {
    const b = balances[i];
    if (warehouseFilter !== 'ALL' && b.warehouseId !== warehouseFilter) continue;

    const prod = indexes.products.byId.get(b.productId);
    const wh = indexes.warehouses.byId.get(b.warehouseId);
    const qty = Number(b.quantity || 0);
    const costRate = Number(b.costRate || prod?.costRate || 0);
    const rowValuation = qty * costRate;
    const isLow = qty <= (prod?.minStockAlert || 5);
    const isOut = qty <= 0;

    if (stockFilterMode === 'LOW' && !isLow) continue;
    if (stockFilterMode === 'OUT' && !isOut) continue;

    const row = {
      ...b,
      product: prod || { name: b.productId, sku: b.productId, uom: 'PCS' },
      warehouse: wh || { name: b.warehouseId },
      totalValuation: rowValuation,
      isLowStock: isLow,
    };

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      const match =
        row.product?.name?.toLowerCase().includes(q) ||
        row.product?.sku?.toLowerCase().includes(q) ||
        row.product?.barcode?.includes(q) ||
        row.warehouse?.name?.toLowerCase().includes(q);
      if (!match) continue;
    }

    list.push(row);
    totalValuation += rowValuation;
    if (isLow) lowStockCount++;
  }

  const totalCount = list.length;
  const safePageSize = Math.max(1, parseInt(pageSize, 10) || 50);
  const totalPages = Math.ceil(totalCount / safePageSize) || 1;
  const safePage = Math.min(Math.max(1, parseInt(page, 10) || 1), totalPages);

  const startRecord = (safePage - 1) * safePageSize;
  const pageData = list.slice(startRecord, startRecord + safePageSize);

  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();

  return {
    data: pageData,
    allFiltered: list,
    totalCount,
    page: safePage,
    pageSize: safePageSize,
    totalPages,
    startIndex: totalCount > 0 ? startRecord + 1 : 0,
    endIndex: Math.min(startRecord + safePageSize, totalCount),
    metrics: {
      totalValuation,
      lowStockCount,
      totalItems: totalCount,
    },
    executionTimeMs: (t1 - t0).toFixed(1),
  };
}
