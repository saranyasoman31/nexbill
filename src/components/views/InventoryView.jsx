// InventoryView: Warehouse Stock Balances, Low Stock Alerts, and Immutable Movement Ledger Drilldown
import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { StockService } from '../../services/stockService';
import {
  Boxes,
  History,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Warehouse,
  Search,
  Filter,
} from 'lucide-react';
import ExportButtons from '../common/ExportButtons.jsx';

export default function InventoryView() {
  const { db, activeCompany, activeStore, activeWarehouse } = useApp();

  const [filterWarehouseId, setFilterWarehouseId] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProductForLedger, setSelectedProductForLedger] = useState(null);

  // Fetch balances
  const allBalances = StockService.getAllStockBalances({
    companyId: activeCompany.id,
    warehouseId: filterWarehouseId === 'ALL' ? null : filterWarehouseId,
  });

  const filteredBalances = allBalances.filter((b) => {
    const q = searchQuery.toLowerCase();
    return (
      b.product?.name?.toLowerCase().includes(q) ||
      b.product?.sku?.toLowerCase().includes(q) ||
      b.product?.barcode?.includes(q) ||
      b.warehouse?.name?.toLowerCase().includes(q)
    );
  });

  const totalValuation = filteredBalances.reduce((sum, b) => sum + (b.totalValuation || 0), 0);
  const lowStockCount = filteredBalances.filter((b) => b.isLowStock).length;

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
            <div className="text-2xl font-black text-white">{filteredBalances.length}</div>
          </div>
          <div className="p-2.5 rounded-lg bg-indigo-950/60 text-indigo-400 border border-indigo-800/40">
            <Boxes className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-md flex items-center justify-between">
          <div>
            <div className="text-[11px] text-slate-400 font-semibold uppercase">Inventory Valuation (Cost)</div>
            <div className="text-2xl font-black font-mono text-emerald-400">₹{totalValuation.toLocaleString()}</div>
          </div>
          <div className="p-2.5 rounded-lg bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-md flex items-center justify-between">
          <div>
            <div className="text-[11px] text-slate-400 font-semibold uppercase">Low Stock Alerts</div>
            <div className="text-2xl font-black text-amber-400">{lowStockCount} Items</div>
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
            className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
          >
            <option value="ALL">All Warehouses ({activeCompany.tradeName})</option>
            {db.warehouses
              .filter((w) => w.companyId === activeCompany.id)
              .map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.type})
                </option>
              ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ExportButtons
            data={filteredBalances.map((b, idx) => ({
              '#': idx + 1,
              'Product Name': b.product?.name || 'Unknown',
              'Category': b.product?.category || '',
              'SKU': b.product?.sku || '',
              'Barcode': b.product?.barcode || '',
              'Warehouse Location': b.warehouse?.name || b.warehouseId,
              'Unit': b.product?.uom || 'PCS',
              'Available Qty': b.quantity,
              'Cost Rate': `₹${b.costRate?.toFixed(2)}`,
              'Valuation': `₹${b.totalValuation?.toFixed(2)}`,
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
              className="bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-64"
            />
          </div>
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
            <tbody className="divide-y divide-slate-800/60">
              {filteredBalances.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-8 text-center text-slate-500 text-xs">
                    No stock records found.
                  </td>
                </tr>
              ) : (
                filteredBalances.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-200">{b.product?.name}</div>
                      <div className="text-[10px] text-slate-400">{b.product?.category}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-mono text-slate-300 font-medium">{b.product?.sku}</div>
                      <div className="text-[10px] text-slate-500">{b.product?.barcode}</div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">
                      <div className="font-medium">{b.warehouse?.name}</div>
                      <div className="text-[10px] text-slate-500">{b.store?.name}</div>
                    </td>
                    <td className="py-2.5 px-2 text-center text-slate-400">
                      {b.product?.uom || 'Pcs'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-sm">
                      <span className={b.isLowStock ? 'text-amber-400' : 'text-emerald-400'}>
                        {b.quantity}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                      ₹{Number(b.valuationRate || b.product?.costRate || 0).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-300">
                      ₹{Number(b.totalValuation).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {b.isLowStock ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/70 text-amber-400 border border-amber-800/40">
                          Low Stock (&lt;{b.product?.minStockAlert})
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/70 text-emerald-400 border border-emerald-800/40">
                          Optimal
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        onClick={() => setSelectedProductForLedger(b)}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold rounded-lg flex items-center gap-1 mx-auto transition"
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
                  className="text-slate-400 hover:text-white text-lg px-2 py-1 rounded-lg hover:bg-slate-800 transition"
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
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg text-xs"
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
