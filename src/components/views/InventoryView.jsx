// InventoryView: Warehouse Stock Balances, Low Stock Alerts, and Immutable Movement Ledger Drilldown
// Powered by Database Table Indexing & Asynchronous AJAX Query Engine for 3 Lakh+ Products
import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { StockService } from '../../services/stockService';
import {
  Boxes,
  History,
  AlertTriangle,
  TrendingUp,
  Warehouse,
  Search,
  RotateCw,
  Zap,
} from 'lucide-react';
import ExportButtons from '../common/ExportButtons.jsx';
import AjaxTablePagination from '../common/AjaxTablePagination.jsx';
import { fetchInventoryBalancesAjax } from '../../services/indexingService.js';

export default function InventoryView() {
  const { db, activeCompany } = useApp();

  const [filterWarehouseId, setFilterWarehouseId] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilterMode, setStockFilterMode] = useState('ALL'); // ALL | LOW | OUT
  const [selectedProductForLedger, setSelectedProductForLedger] = useState(null);

  // AJAX and Database Table Indexing State for High-Scale Inventory
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [isLoading, setIsLoading] = useState(false);
  const [invResult, setInvResult] = useState({
    data: [],
    allFiltered: [],
    totalCount: 0,
    page: 1,
    pageSize: 50,
    totalPages: 1,
    startIndex: 0,
    endIndex: 0,
    metrics: {
      totalValuation: 0,
      lowStockCount: 0,
      totalItems: 0,
    },
    executionTimeMs: 0,
  });

  const loadBalances = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetchInventoryBalancesAjax(db, {
        warehouseFilter: filterWarehouseId,
        search: searchQuery,
        stockFilterMode,
        page,
        pageSize,
      });
      setInvResult(res);
    } catch (e) {
      console.error('Failed to load inventory balances via AJAX:', e);
    } finally {
      setIsLoading(false);
    }
  }, [db, filterWarehouseId, searchQuery, stockFilterMode, page, pageSize]);

  useEffect(() => {
    loadBalances();
  }, [loadBalances]);

  useEffect(() => {
    setPage(1);
  }, [filterWarehouseId, searchQuery, stockFilterMode]);

  // Ledger movements for selected drill-down product
  const movements = selectedProductForLedger
    ? StockService.getStockMovements({ productId: selectedProductForLedger.productId })
    : [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-md flex items-center justify-between">
          <div>
            <div className="text-[11px] text-slate-400 font-semibold uppercase">Total Tracked SKUs</div>
            <div className="text-2xl font-black text-white font-mono">
              {invResult.totalCount.toLocaleString('en-IN')}
            </div>
            <span className="text-[10px] text-slate-500 font-mono">Indexed Real-time Balances</span>
          </div>
          <div className="p-2.5 rounded-lg bg-indigo-950/60 text-indigo-400 border border-indigo-800/40">
            <Boxes className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-md flex items-center justify-between">
          <div>
            <div className="text-[11px] text-slate-400 font-semibold uppercase">Inventory Valuation (Cost)</div>
            <div className="text-2xl font-black font-mono text-emerald-400">
              ₹{Number(invResult.metrics.totalValuation || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-emerald-300 font-semibold">Total Asset Value</span>
          </div>
          <div className="p-2.5 rounded-lg bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-md flex items-center justify-between">
          <div>
            <div className="text-[11px] text-slate-400 font-semibold uppercase">Low Stock Alerts</div>
            <div className="text-2xl font-black text-amber-400 font-mono">
              {invResult.metrics.lowStockCount || 0} Items
            </div>
            <span className="text-[10px] text-amber-300 font-semibold">Below Reorder Threshold</span>
          </div>
          <div className="p-2.5 rounded-lg bg-amber-950/60 text-amber-400 border border-amber-800/40">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="flex flex-wrap items-center gap-2">
          <Warehouse className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-semibold text-slate-300">Warehouse:</span>
          <select
            value={filterWarehouseId}
            onChange={(e) => setFilterWarehouseId(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 cursor-pointer"
          >
            <option value="ALL">All Warehouses ({activeCompany?.tradeName || 'All'})</option>
            {db.warehouses
              .filter((w) => !activeCompany?.id || w.companyId === activeCompany.id)
              .map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.type || 'Storage'})
                </option>
              ))}
          </select>

          <select
            value={stockFilterMode}
            onChange={(e) => setStockFilterMode(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 cursor-pointer"
          >
            <option value="ALL">All Stock Levels</option>
            <option value="LOW">Low Stock Alerts Only</option>
            <option value="OUT">Out of Stock Only</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ExportButtons
            data={(invResult.allFiltered || []).map((b, idx) => ({
              '#': idx + 1,
              'Product Name': b.product?.name || b.productId,
              'Category': b.product?.category || '',
              'SKU': b.product?.sku || '',
              'Barcode': b.product?.barcode || '',
              'Warehouse Location': b.warehouse?.name || b.warehouseId,
              'Unit': b.product?.uom || 'PCS',
              'Available Qty': b.quantity,
              'Cost Rate': `₹${Number(b.valuationRate || b.costRate || b.product?.costRate || 0).toFixed(2)}`,
              'Valuation': `₹${Number(b.totalValuation || 0).toFixed(2)}`,
              'Stock Status': b.isLowStock ? 'LOW STOCK ALERT' : 'HEALTHY'
            }))}
            filename="WAREHOUSE_STOCK_BALANCES"
            title="WAREHOUSE INVENTORY & STOCK VALUATION"
            pdfOrientation="landscape"
          />

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search products by SKU, name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-56 sm:w-64"
            />
          </div>

          <button
            type="button"
            onClick={loadBalances}
            disabled={isLoading}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition cursor-pointer"
            title="Refresh AJAX Query"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stock Balances Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[750px]">
            <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Product Name & Category</th>
                <th className="py-2.5 px-3">SKU / Barcode</th>
                <th className="py-2.5 px-3">Warehouse Location</th>
                <th className="py-2.5 px-2 text-center">Unit</th>
                <th className="py-2.5 px-3 text-right">Available Qty</th>
                <th className="py-2.5 px-3 text-right">Cost Rate</th>
                <th className="py-2.5 px-3 text-right">Valuation</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-center">Drilldown</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {invResult.data.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-slate-500 font-sans">
                    {isLoading ? 'Loading stock balances via indexed engine...' : 'No stock records found matching current criteria.'}
                  </td>
                </tr>
              ) : (
                invResult.data.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-2.5 px-3 font-sans">
                      <div className="font-semibold text-slate-200">{b.product?.name}</div>
                      <div className="text-[10px] text-slate-400">{b.product?.category}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-mono text-slate-300 font-medium">{b.product?.sku}</div>
                      <div className="text-[10px] text-slate-500">{b.product?.barcode || '—'}</div>
                    </td>
                    <td className="py-2.5 px-3 font-sans text-slate-300">
                      <div className="font-medium">{b.warehouse?.name}</div>
                      <div className="text-[10px] text-slate-500">{b.store?.name}</div>
                    </td>
                    <td className="py-2.5 px-2 text-center font-sans text-slate-400">
                      {b.product?.uom || 'PCS'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-sm">
                      <span className={b.isLowStock ? 'text-amber-400' : 'text-emerald-400'}>
                        {b.quantity}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                      ₹{Number(b.valuationRate || b.costRate || b.product?.costRate || 0).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-300">
                      ₹{Number(b.totalValuation).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-center font-sans">
                      {b.isLowStock ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/70 text-amber-400 border border-amber-800/40">
                          Low Stock (&lt;{b.product?.minStockAlert || 5})
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/70 text-emerald-400 border border-emerald-800/40">
                          Optimal
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center font-sans">
                      <button
                        onClick={() => setSelectedProductForLedger(b)}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold rounded-lg flex items-center gap-1 mx-auto transition cursor-pointer"
                      >
                        <History className="w-3.5 h-3.5 text-indigo-400" />
                        Movement Ledger
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* AJAX Table Pagination */}
        <AjaxTablePagination
          totalCount={invResult.totalCount}
          page={invResult.page}
          pageSize={invResult.pageSize}
          totalPages={invResult.totalPages}
          startIndex={invResult.startIndex}
          endIndex={invResult.endIndex}
          isLoading={isLoading}
          executionTimeMs={invResult.executionTimeMs}
          onPageChange={(p) => setPage(p)}
          onPageSizeChange={(ps) => {
            setPageSize(ps);
            setPage(1);
          }}
        />
      </div>

      {/* Movement Ledger Drill-down Modal */}
      {selectedProductForLedger && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl space-y-4">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-indigo-400" />
                  Stock Movement Audit Ledger: {selectedProductForLedger.product?.name}
                </h3>
                <p className="text-xs text-slate-400">
                  SKU: {selectedProductForLedger.product?.sku} | Current Balance: {selectedProductForLedger.quantity} {selectedProductForLedger.product?.uom}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <ExportButtons
                  data={movements.map((m, idx) => ({
                    '#': idx + 1,
                    'Timestamp': new Date(m.timestamp).toLocaleString(),
                    'Doc Type': m.documentType,
                    'Document #': m.documentNumber,
                    'Warehouse': m.warehouseId,
                    'Quantity Delta': m.quantityDelta > 0 ? `+${m.quantityDelta}` : m.quantityDelta,
                    'Balance After': m.balanceAfter,
                    'Reason / Remarks': m.reason || '',
                    'User ID': m.userId
                  }))}
                  filename={`LEDGER_${selectedProductForLedger.product?.sku || 'PRODUCT'}`}
                  title={`STOCK LEDGER: ${selectedProductForLedger.product?.name}`}
                  subtitle={`SKU: ${selectedProductForLedger.product?.sku} | Current Balance: ${selectedProductForLedger.quantity} ${selectedProductForLedger.product?.uom}`}
                  size="small"
                />
                <button
                  onClick={() => setSelectedProductForLedger(null)}
                  className="text-slate-400 hover:text-white text-lg px-2 py-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="px-5 max-h-[65vh] overflow-y-auto overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[650px]">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-2 px-3">Timestamp</th>
                    <th className="py-2 px-3">Doc Type</th>
                    <th className="py-2 px-3">Document #</th>
                    <th className="py-2 px-3">Warehouse</th>
                    <th className="py-2 px-2 text-right">Delta</th>
                    <th className="py-2 px-2 text-right">Balance After</th>
                    <th className="py-2 px-3">Reason / Remarks</th>
                    <th className="py-2 px-2">User</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {movements.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="py-6 text-center text-slate-500">
                        No movement records found for this product.
                      </td>
                    </tr>
                  ) : (
                    movements.map((m) => {
                      const isPositive = m.qtyChange > 0;
                      return (
                        <tr key={m.id} className="hover:bg-slate-800/30">
                          <td className="py-2 px-3 text-slate-400 text-[11px]">
                            {new Date(m.timestamp).toLocaleString()}
                          </td>
                          <td className="py-2 px-3 font-semibold text-slate-200">
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">
                              {m.docType}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono text-indigo-400">{m.docNumber}</td>
                          <td className="py-2 px-3 text-slate-300">{m.warehouseName}</td>
                          <td className="py-2 px-2 text-right font-mono font-bold">
                            <span className={isPositive ? 'text-emerald-400' : 'text-rose-400'}>
                              {isPositive ? `+${m.qtyChange}` : m.qtyChange}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-right font-mono font-bold text-white">
                            {m.balanceAfter}
                          </td>
                          <td className="py-2 px-3 text-slate-400 text-[11px]">{m.reason}</td>
                          <td className="py-2 px-2 text-slate-400 text-[11px]">{m.userName}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-5 py-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedProductForLedger(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg text-xs cursor-pointer"
              >
                Close Ledger
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
