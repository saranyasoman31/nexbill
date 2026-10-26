// MastersView: Centralized Master Data Management for Products, Customers, Suppliers, and Warehouses
import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { saveDatabase, logAuditEvent } from '../../services/storageService.js';
import { INITIAL_STATES } from '../../data/initialData.js';
import {
  Database,
  Package,
  Users,
  Building,
  Warehouse,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Search,
  ShieldCheck,
  MapPin,
} from 'lucide-react';
import ExportButtons from '../common/ExportButtons.jsx';

export default function MastersView() {
  const { db, currentUser, notify, triggerRefresh, activeStore } = useApp();

  const statesList = (db?.states && db.states.length > 0) ? db.states : INITIAL_STATES;
  const defaultStoreStateCode = activeStore?.stateCode || '27';
  const defaultStateName = statesList.find(s => s.code === defaultStoreStateCode)?.name || 'Maharashtra';

  // Ensure db.states is populated in database
  useEffect(() => {
    if (!db.states || db.states.length === 0) {
      db.states = INITIAL_STATES;
      saveDatabase(db);
      triggerRefresh();
    }
  }, [db.states]);

  const [activeSubTab, setActiveSubTab] = useState('products'); // products | customers | suppliers | warehouses
  const [searchQuery, setSearchQuery] = useState('');

  // Modal / Form state for Add/Edit
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newProduct, setNewProduct] = useState({
    sku: '',
    barcode: '',
    name: '',
    category: 'Groceries & Staples',
    hsnCode: '1006',
    uom: 'Pcs',
    taxRate: 5,
    taxType: 'inclusive',
    isTaxInclusive: true,
    costRate: 0,
    mrp: 0,
    sellingRate: 0,
    minStockAlert: 10,
    active: true,
  });

  const [newCustomer, setNewCustomer] = useState({
    name: '',
    phone: '',
    email: '',
    gstin: '',
    businessType: 'B2B',
    supplyType: 'LOCAL',
    stateCode: defaultStoreStateCode,
    state: defaultStateName,
    creditLimit: 10000,
    active: true,
  });

  const [newSupplier, setNewSupplier] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    gstin: '',
    supplyType: 'LOCAL',
    stateCode: '27',
    city: 'Mumbai',
    active: true,
  });

  const handleToggleStatus = (collectionName, item) => {
    const list = db[collectionName];
    if (!list) return;
    const idx = list.findIndex((i) => i.id === item.id);
    if (idx !== -1) {
      const nextStatus = item.active === false ? true : false;
      list[idx] = { ...list[idx], active: nextStatus };
      saveDatabase(db);
      logAuditEvent(
        'MASTER_STATUS_CHANGED',
        currentUser.id,
        `Changed status of ${collectionName} "${item.name || item.sku || item.id}" to ${nextStatus ? 'ACTIVE' : 'INACTIVE'}`
      );
      notify(
        'info',
        `"${item.name || item.sku || item.id}" status set to ${nextStatus ? 'Active' : 'Inactive'}.`,
        'Status Updated'
      );
      triggerRefresh();
    }
  };

  // Handle Add Product
  const handleSaveProduct = (e) => {
    e.preventDefault();
    if (Number(newProduct.sellingRate) > Number(newProduct.mrp)) {
      notify('error', 'Statutory Violation: Selling rate cannot exceed MRP.', 'Master Error');
      return;
    }

    const prodId = `PROD-${String(db.products.length + 1).padStart(3, '0')}`;
    const taxTypeVal = newProduct.taxType || (newProduct.isTaxInclusive === false ? 'exclusive' : 'inclusive');
    const productRecord = {
      ...newProduct,
      id: prodId,
      taxType: taxTypeVal,
      isTaxInclusive: taxTypeVal === 'inclusive',
      costRate: Number(newProduct.costRate),
      mrp: Number(newProduct.mrp),
      sellingRate: Number(newProduct.sellingRate),
      taxRate: Number(newProduct.taxRate),
      minStockAlert: Number(newProduct.minStockAlert),
      active: newProduct.active !== false,
    };

    db.products.push(productRecord);
    saveDatabase(db);
    logAuditEvent('MASTER_PRODUCT_ADDED', currentUser.id, `Product added: ${productRecord.name} (${productRecord.sku})`);
    notify('success', `Product "${productRecord.name}" added to master catalog.`, 'Product Master Saved');
    triggerRefresh();
    setIsAddModalOpen(false);
    setNewProduct({
      sku: '',
      barcode: '',
      name: '',
      category: 'Groceries & Staples',
      hsnCode: '1006',
      uom: 'Pcs',
      taxRate: 5,
      taxType: 'inclusive',
      isTaxInclusive: true,
      costRate: 0,
      mrp: 0,
      sellingRate: 0,
      minStockAlert: 10,
      active: true,
    });
  };

  // Real-time Customer Form Validation Helpers
  const customerPhoneCleaned = (newCustomer.phone || '').replace(/\D/g, '');
  const customerPhoneDuplicate = customerPhoneCleaned.length === 10
    ? db.customers.find(c => c.phone && c.phone.replace(/\D/g, '') === customerPhoneCleaned)
    : null;
  const isCustomerPhoneComplete = customerPhoneCleaned.length === 10;
  const isCustomerEmailInvalid = Boolean(
    newCustomer.email &&
    newCustomer.email.trim() &&
    !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(newCustomer.email.trim())
  );

  // Handle Add Customer
  const handleSaveCustomer = (e) => {
    e.preventDefault();

    if (!newCustomer.name.trim()) {
      notify('error', 'Customer / Entity name is required.', 'Validation Error');
      return;
    }

    const cleanedPhone = (newCustomer.phone || '').replace(/\D/g, '');
    if (!cleanedPhone) {
      notify('error', 'Mobile number is required.', 'Validation Error');
      return;
    }
    if (cleanedPhone.length !== 10) {
      notify('error', 'Mobile number must be exactly 10 digits.', 'Invalid Mobile Number');
      return;
    }

    const duplicateCustomer = db.customers.find(
      c => c.phone && c.phone.replace(/\D/g, '') === cleanedPhone
    );
    if (duplicateCustomer) {
      notify(
        'error',
        `Mobile number ${cleanedPhone} is already registered to "${duplicateCustomer.name}" (${duplicateCustomer.id}). Duplicate mobile numbers are not allowed.`,
        'Duplicate Mobile Number'
      );
      return;
    }

    const emailVal = (newCustomer.email || '').trim();
    if (emailVal) {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(emailVal)) {
        notify('error', 'Please enter a valid email address (e.g. name@domain.com).', 'Invalid Email Format');
        return;
      }
    }

    const custId = `CUST-${String(db.customers.length + 1).padStart(3, '0')}`;
    const stateObj = statesList.find(s => s.code === newCustomer.stateCode);
    const customerRecord = {
      ...newCustomer,
      id: custId,
      name: newCustomer.name.trim(),
      phone: cleanedPhone,
      email: emailVal,
      gstin: (newCustomer.gstin || '').trim(),
      businessType: newCustomer.businessType || 'B2B',
      supplyType: newCustomer.supplyType || 'LOCAL',
      stateCode: newCustomer.stateCode || defaultStoreStateCode,
      state: stateObj?.name || newCustomer.state || defaultStateName,
      creditLimit: Number(newCustomer.creditLimit) || 0,
      creditOutstanding: 0,
      loyaltyPoints: 0,
      isWalkIn: false,
      active: newCustomer.active !== false,
    };

    db.customers.push(customerRecord);
    saveDatabase(db);
    logAuditEvent(
      'MASTER_CUSTOMER_ADDED',
      currentUser.id,
      `Customer added: ${customerRecord.name} (Mobile: ${customerRecord.phone}, ${customerRecord.businessType} • ${customerRecord.supplyType} • ${customerRecord.state})`
    );
    notify('success', `Customer "${customerRecord.name}" saved to customer master.`, 'Customer Master Saved');
    triggerRefresh();
    setIsAddModalOpen(false);
    setNewCustomer({
      name: '',
      phone: '',
      email: '',
      gstin: '',
      businessType: 'B2B',
      supplyType: 'LOCAL',
      stateCode: defaultStoreStateCode,
      state: defaultStateName,
      creditLimit: 10000,
      active: true,
    });
  };

  // Handle Add Supplier
  const handleSaveSupplier = (e) => {
    e.preventDefault();
    const suppId = `SUPP-${String(db.suppliers.length + 1).padStart(2, '0')}`;
    const supplierRecord = {
      ...newSupplier,
      id: suppId,
      code: `SUP-${newSupplier.name.slice(0, 3).toUpperCase()}-${suppId}`,
      supplyType: newSupplier.supplyType || (newSupplier.stateCode !== '27' ? 'INTERSTATE' : 'LOCAL'),
      active: newSupplier.active !== false,
    };

    db.suppliers.push(supplierRecord);
    saveDatabase(db);
    logAuditEvent('MASTER_SUPPLIER_ADDED', currentUser.id, `Supplier added: ${supplierRecord.name}`);
    notify('success', `Supplier "${supplierRecord.name}" saved to supplier master.`, 'Supplier Master Saved');
    triggerRefresh();
    setIsAddModalOpen(false);
    setNewSupplier({
      name: '',
      contactPerson: '',
      phone: '',
      email: '',
      gstin: '',
      supplyType: 'LOCAL',
      stateCode: '27',
      city: 'Mumbai',
      active: true,
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-3 rounded-xl shadow-md">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-indigo-400" />
          <div>
            <h3 className="font-bold text-slate-100 text-sm">NexBill Master Data Hub</h3>
            <p className="text-[11px] text-slate-400">Administrator management for Products, Customers, Suppliers & Warehouses</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ExportButtons
            data={
              activeSubTab === 'products'
                ? db.products.map(p => ({
                    'Product Name': p.name,
                    'Category': p.category,
                    'Brand': p.brand || '',
                    'SKU': p.sku,
                    'Barcode': p.barcode || '',
                    'HSN Code': p.hsnCode || '',
                    'GST %': `${p.taxRate}%`,
                    'Cost Price': `₹${p.costRate?.toFixed(2)}`,
                    'MRP': `₹${p.mrp?.toFixed(2)}`,
                    'Selling Rate': `₹${p.sellingRate?.toFixed(2)}`,
                    'Status': p.active !== false ? 'Active' : 'Inactive'
                  }))
                : activeSubTab === 'customers'
                ? db.customers.map(c => ({
                    'Customer ID': c.id,
                    'Name': c.name,
                    'Business Type': c.businessType || 'B2C',
                    'Local / Interstate': c.supplyType || 'LOCAL',
                    'State': c.state || 'Maharashtra',
                    'State Code': c.stateCode || '27',
                    'Phone': c.phone,
                    'Email': c.email || '',
                    'GSTIN': c.gstin || '',
                    'Credit Limit': `₹${Number(c.creditLimit || 0).toLocaleString('en-IN')}`,
                    'Outstanding': `₹${Number(c.creditOutstanding || 0).toLocaleString('en-IN')}`,
                    'Status': c.active !== false ? 'Active' : 'Inactive'
                  }))
                : activeSubTab === 'suppliers'
                ? db.suppliers.map(s => ({
                    'Supplier ID': s.id,
                    'Supplier Name': s.name,
                    'Contact Person': s.contactPerson || '',
                    'Phone': s.phone,
                    'Email': s.email || '',
                    'GSTIN': s.gstin || '',
                    'Local / Interstate': s.supplyType || (s.stateCode !== '27' ? 'INTERSTATE' : 'LOCAL'),
                    'City': s.city || '',
                    'State Code': s.stateCode || '',
                    'Status': s.active !== false ? 'Active' : 'Inactive'
                  }))
                : activeSubTab === 'warehouses'
                ? db.warehouses.map(w => ({
                    'Warehouse ID': w.id,
                    'Warehouse Name': w.name,
                    'Type': w.type,
                    'Address': w.address || '',
                    'Status': w.active !== false ? 'Active' : 'Inactive'
                  }))
                : statesList.map(s => ({
                    'GST Code': s.code,
                    'State / UT Name': s.name,
                    'Type': s.type,
                    'Tax Jurisdiction': s.code === defaultStoreStateCode ? 'Intrastate (CGST+SGST)' : 'Interstate (IGST)',
                    'Status': 'Active (Statutory)'
                  }))
            }
            filename={`${activeSubTab.toUpperCase()}_MASTER`}
            title={`${activeSubTab.toUpperCase()} MASTER DIRECTORY`}
            pdfOrientation={activeSubTab === 'products' || activeSubTab === 'customers' ? 'landscape' : 'portrait'}
          />

          {activeSubTab !== 'states' && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add New {activeSubTab.slice(0, -1).toUpperCase()}</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex items-center gap-1 bg-slate-900/60 p-1 rounded-xl border border-slate-800">
        <button
          onClick={() => setActiveSubTab('products')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
            activeSubTab === 'products' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>Products Master ({db.products.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('customers')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
            activeSubTab === 'customers' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Customers Master ({db.customers.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('suppliers')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
            activeSubTab === 'suppliers' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Building className="w-3.5 h-3.5" />
          <span>Suppliers Master ({db.suppliers.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('warehouses')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
            activeSubTab === 'warehouses' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Warehouse className="w-3.5 h-3.5" />
          <span>Warehouses & Locations ({db.warehouses.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('states')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
            activeSubTab === 'states' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
          }`}
        >
          <MapPin className="w-3.5 h-3.5" />
          <span>States & Territories ({db.states?.length || statesList.length})</span>
        </button>
      </div>

      {/* Products Master Table */}
      {activeSubTab === 'products' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Product Name & Category</th>
                <th className="py-2.5 px-3">SKU</th>
                <th className="py-2.5 px-3">Barcode</th>
                <th className="py-2.5 px-3">HSN Code</th>
                <th className="py-2.5 px-2 text-center">GST %</th>
                <th className="py-2.5 px-3 text-right">Cost Price</th>
                <th className="py-2.5 px-3 text-right">MRP</th>
                <th className="py-2.5 px-3 text-right">Selling Rate</th>
                <th className="py-2.5 px-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {db.products.map(p => (
                <tr key={p.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-2.5 px-3">
                    <div className="font-semibold text-slate-200">{p.name}</div>
                    <div className="text-[10px] text-slate-500">{p.category} • {p.brand}</div>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-300">{p.sku}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-400">{p.barcode}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-400">{p.hsnCode}</td>
                  <td className="py-2.5 px-2 text-center text-slate-300 font-bold">{p.taxRate}%</td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-400">₹{p.costRate.toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-amber-300 font-bold">₹{p.mrp.toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-emerald-400 font-bold">₹{p.sellingRate.toFixed(2)}</td>
                  <td className="py-2.5 px-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus('products', p)}
                      title="Click to toggle status"
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border transition ${
                        p.active !== false
                          ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                          : 'bg-rose-950 text-rose-400 border-rose-800'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${p.active !== false ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                      {p.active !== false ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Customers Master Table */}
      {activeSubTab === 'customers' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Customer Name</th>
                <th className="py-2.5 px-3">Business & Local / Interstate</th>
                <th className="py-2.5 px-3">Phone & Email</th>
                <th className="py-2.5 px-3">GSTIN (B2B)</th>
                <th className="py-2.5 px-3 text-right">Credit Limit</th>
                <th className="py-2.5 px-3 text-right">Credit Outstanding</th>
                <th className="py-2.5 px-3 text-right">Loyalty Points</th>
                <th className="py-2.5 px-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {db.customers.map(c => {
                const bType = c.businessType || (c.gstin ? 'B2B' : 'B2C');
                const sType = c.supplyType || (c.stateCode && c.stateCode !== defaultStoreStateCode ? 'INTERSTATE' : 'LOCAL');
                const stateName = c.state || (statesList.find(s => s.code === (c.stateCode || defaultStoreStateCode))?.name) || 'Maharashtra';

                return (
                  <tr key={c.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-2.5 px-3 font-semibold text-slate-200">
                      <div>{c.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{c.id}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          bType === 'B2B'
                            ? 'bg-indigo-950/90 text-indigo-300 border-indigo-700/60'
                            : 'bg-sky-950/90 text-sky-300 border-sky-700/60'
                        }`}>
                          {bType}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          sType === 'LOCAL'
                            ? 'bg-emerald-950/90 text-emerald-300 border-emerald-700/60'
                            : 'bg-amber-950/90 text-amber-300 border-amber-700/60'
                        }`}>
                          {sType}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-sans flex items-center gap-1">
                        <span className="font-mono text-indigo-400 font-semibold">{c.stateCode || defaultStoreStateCode}</span>
                        <span>•</span>
                        <span className="truncate max-w-[130px]" title={stateName}>{stateName}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">
                      <div>{c.phone || '—'}</div>
                      <div className="text-[10px] text-slate-500">{c.email || '—'}</div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-indigo-400">{c.gstin || '— (Retail)'}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-300">₹{Number(c.creditLimit || 0).toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-400">₹{Number(c.creditOutstanding || 0).toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-purple-400">{c.loyaltyPoints || 0} pts</td>
                    <td className="py-2.5 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus('customers', c)}
                        title="Click to toggle status"
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border transition ${
                          c.active !== false
                            ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                            : 'bg-rose-950 text-rose-400 border-rose-800'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${c.active !== false ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                        {c.active !== false ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Suppliers Master Table */}
      {activeSubTab === 'suppliers' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Supplier Name & Code</th>
                <th className="py-2.5 px-3">Contact Person</th>
                <th className="py-2.5 px-3">Phone</th>
                <th className="py-2.5 px-3">Email</th>
                <th className="py-2.5 px-3">GSTIN</th>
                <th className="py-2.5 px-3">Local / Interstate</th>
                <th className="py-2.5 px-3">City / State</th>
                <th className="py-2.5 px-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {db.suppliers.map(s => {
                const isInterstate = (s.supplyType || (s.stateCode !== '27' ? 'INTERSTATE' : 'LOCAL')) === 'INTERSTATE';
                return (
                <tr key={s.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-2.5 px-3">
                    <div className="font-semibold text-slate-200">{s.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{s.code}</div>
                  </td>
                  <td className="py-2.5 px-3 text-slate-300">{s.contactPerson}</td>
                  <td className="py-2.5 px-3 text-slate-300">{s.phone}</td>
                  <td className="py-2.5 px-3 text-slate-400">{s.email}</td>
                  <td className="py-2.5 px-3 font-mono text-indigo-400">{s.gstin}</td>
                  <td className="py-2.5 px-3 font-sans">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${
                        isInterstate
                          ? 'bg-purple-950/80 text-purple-300 border-purple-800'
                          : 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                      }`}
                    >
                      {isInterstate ? 'Interstate' : 'Local'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-300">{s.city} ({s.stateCode})</td>
                  <td className="py-2.5 px-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus('suppliers', s)}
                      title="Click to toggle status"
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border transition ${
                        s.active !== false
                          ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                          : 'bg-rose-950 text-rose-400 border-rose-800'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${s.active !== false ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                      {s.active !== false ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                </tr>
              );
            })}
            </tbody>
          </table>
        </div>
      )}

      {/* Warehouses Master Table */}
      {activeSubTab === 'warehouses' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Warehouse Name & Code</th>
                <th className="py-2.5 px-3">Store Location</th>
                <th className="py-2.5 px-3">Company</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-2 text-center">Sellable Inventory</th>
                <th className="py-2.5 px-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {db.warehouses.map(w => {
                const store = db.stores.find(s => s.id === w.storeId);
                const company = db.companies.find(c => c.id === w.companyId);
                return (
                  <tr key={w.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-200">{w.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{w.code}</div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 font-medium">{store?.name}</td>
                    <td className="py-2.5 px-3 text-slate-400">{company?.tradeName}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-mono">
                        {w.type}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        w.isSellable
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : 'bg-rose-950 text-rose-400 border border-rose-800'
                      }`}>
                        {w.isSellable ? 'YES (Sellable)' : 'NO (Quarantine / Damaged)'}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus('warehouses', w)}
                        title="Click to toggle status"
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border transition ${
                          w.active !== false
                            ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                            : 'bg-rose-950 text-rose-400 border-rose-800'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${w.active !== false ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                        {w.active !== false ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* States & Territories Master Table */}
      {activeSubTab === 'states' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md">
          <div className="p-3 border-b border-slate-800 bg-slate-950/40 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-300 font-semibold flex items-center gap-2">
              <MapPin className="w-4 h-4 text-indigo-400" />
              <span>Statutory GST Indian States & Union Territories Table ({statesList.length} Jurisdictions)</span>
            </div>
            <div className="flex items-center gap-2">
              <ExportButtons
                data={statesList
                  .filter((s) => {
                    const q = searchQuery.toLowerCase();
                    return (
                      s.name.toLowerCase().includes(q) ||
                      s.code.includes(q) ||
                      (s.type && s.type.toLowerCase().includes(q))
                    );
                  })
                  .map((s) => ({
                    'GST State Code': s.code,
                    'State / UT Name': s.name,
                    'Territory Classification': s.type,
                    'Tax Jurisdiction': s.code === defaultStoreStateCode ? 'LOCAL (CGST+SGST)' : 'INTERSTATE (IGST)',
                    'Statutory Status': 'Active'
                  }))}
                filename="GST_STATES_TERRITORIES"
                title="STATUTORY GST STATES & TERRITORIES DIRECTORY"
                pdfOrientation="portrait"
              />
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search state name or code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-64"
                />
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">GST State Code</th>
                  <th className="py-2.5 px-3">State / Union Territory Name</th>
                  <th className="py-2.5 px-3">Territory Classification</th>
                  <th className="py-2.5 px-3">Default Tax Rule (From Branch)</th>
                  <th className="py-2.5 px-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {statesList
                  .filter((s) => {
                    const q = searchQuery.toLowerCase();
                    return (
                      s.name.toLowerCase().includes(q) ||
                      s.code.includes(q) ||
                      (s.type && s.type.toLowerCase().includes(q))
                    );
                  })
                  .map((s) => {
                    const isLocal = s.code === defaultStoreStateCode;
                    return (
                      <tr key={s.id || s.code} className="hover:bg-slate-800/40 transition">
                        <td className="py-2.5 px-3 font-bold">
                          <span className="px-2 py-0.5 rounded bg-indigo-950/80 border border-indigo-700/60 text-indigo-400 font-mono text-xs">
                            {s.code}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-sans font-bold text-slate-200">
                          <span>{s.name}</span>
                          {isLocal && (
                            <span className="ml-2 px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-700/60 text-[9px] font-bold">
                              ACTIVE STORE LOCATION
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-sans">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              s.type === 'STATE'
                                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                                : s.type === 'UT'
                                ? 'bg-purple-950/80 text-purple-300 border-purple-700/60'
                                : 'bg-amber-950/80 text-amber-300 border-amber-700/60'
                            }`}
                          >
                            {s.type === 'STATE'
                              ? 'State'
                              : s.type === 'UT'
                              ? 'Union Territory (UT)'
                              : 'Special Jurisdiction'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-sans">
                          {isLocal ? (
                            <span className="text-emerald-400 font-semibold">Local (CGST + SGST)</span>
                          ) : (
                            <span className="text-amber-400 font-semibold">Interstate (IGST)</span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-center font-sans">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border bg-emerald-950 text-emerald-400 border-emerald-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Active
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-5 shadow-2xl space-y-4">
            <div className="border-b border-slate-800 pb-2 flex justify-between items-center">
              <h3 className="font-bold text-slate-100 text-base">Add New {activeSubTab.slice(0, -1).toUpperCase()}</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {activeSubTab === 'products' && (
              <form onSubmit={handleSaveProduct} className="space-y-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">Product Name *</label>
                  <input
                    type="text"
                    required
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200"
                    placeholder="e.g. Pure Ghee 1L"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-300 block mb-1">SKU *</label>
                    <input
                      type="text"
                      required
                      value={newProduct.sku}
                      onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 font-mono text-slate-200"
                      placeholder="GHE-PUR-1L"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-300 block mb-1">Barcode *</label>
                    <input
                      type="text"
                      required
                      value={newProduct.barcode}
                      onChange={(e) => setNewProduct({ ...newProduct, barcode: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 font-mono text-slate-200"
                      placeholder="8901234001999"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="font-semibold text-slate-300 block mb-1">Cost Price (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={newProduct.costRate !== undefined ? newProduct.costRate : ''}
                      onChange={(e) => setNewProduct({ ...newProduct, costRate: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 font-mono text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-300 block mb-1">MRP (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={newProduct.mrp !== undefined ? newProduct.mrp : ''}
                      onChange={(e) => setNewProduct({ ...newProduct, mrp: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 font-mono text-amber-300 font-bold"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-300 block mb-1">Selling Rate (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={newProduct.sellingRate !== undefined ? newProduct.sellingRate : ''}
                      onChange={(e) => setNewProduct({ ...newProduct, sellingRate: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 font-mono text-emerald-400 font-bold"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-300 block mb-1">Tax Type *</label>
                    <select
                      value={newProduct.taxType || 'inclusive'}
                      onChange={(e) => {
                        const tt = e.target.value;
                        setNewProduct({
                          ...newProduct,
                          taxType: tt,
                          isTaxInclusive: tt === 'inclusive',
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200"
                    >
                      <option value="inclusive">Tax Inclusive (Price includes GST)</option>
                      <option value="exclusive">Tax Exclusive (GST added at billing)</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-semibold text-slate-300 block mb-1">GST Rate (%) *</label>
                    <select
                      value={newProduct.taxRate}
                      onChange={(e) => setNewProduct({ ...newProduct, taxRate: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200 font-mono"
                    >
                      <option value="0">0%</option>
                      <option value="5">5%</option>
                      <option value="12">12%</option>
                      <option value="18">18%</option>
                      <option value="28">28%</option>
                    </select>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-800 space-y-1">
                  <label className="font-semibold text-slate-300 block">Status *</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setNewProduct({ ...newProduct, active: true })}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition border ${
                        newProduct.active !== false
                          ? 'bg-emerald-950/80 border-emerald-500 text-emerald-400 shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${newProduct.active !== false ? 'bg-emerald-400' : 'bg-slate-600'}`}></span>
                      <span>Active (Enabled)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewProduct({ ...newProduct, active: false })}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition border ${
                        newProduct.active === false
                          ? 'bg-rose-950/80 border-rose-500 text-rose-400 shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${newProduct.active === false ? 'bg-rose-400' : 'bg-slate-600'}`}></span>
                      <span>Inactive (Disabled)</span>
                    </button>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                  <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg">Cancel</button>
                  <button type="submit" className="px-5 py-2 bg-indigo-600 text-white font-bold rounded-lg">Save Product</button>
                </div>
              </form>
            )}

            {activeSubTab === 'customers' && (
              <form onSubmit={handleSaveCustomer} className="space-y-3 text-xs">
                {/* Business Type Selector */}
                <div className="space-y-1">
                  <label className="font-semibold text-slate-300 block">Business Type *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewCustomer({ ...newCustomer, businessType: 'B2B' })}
                      className={`py-2 px-3 rounded-lg text-xs font-bold border flex items-center justify-center gap-2 transition ${
                        newCustomer.businessType === 'B2B'
                          ? 'bg-indigo-950/90 border-indigo-500 text-indigo-300 shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${newCustomer.businessType === 'B2B' ? 'bg-indigo-400' : 'bg-slate-600'}`} />
                      <span>B2B (Registered Business)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewCustomer({ ...newCustomer, businessType: 'B2C' })}
                      className={`py-2 px-3 rounded-lg text-xs font-bold border flex items-center justify-center gap-2 transition ${
                        newCustomer.businessType === 'B2C'
                          ? 'bg-sky-950/90 border-sky-500 text-sky-300 shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${newCustomer.businessType === 'B2C' ? 'bg-sky-400' : 'bg-slate-600'}`} />
                      <span>B2C (Retail Consumer)</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-slate-300 block mb-1">Customer / Entity Name *</label>
                  <input
                    type="text"
                    required
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                    placeholder={newCustomer.businessType === 'B2B' ? 'e.g. Apex Bulk Supplies LLP' : 'e.g. Rajesh Kumar'}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-semibold text-slate-300 block">Mobile Number *</label>
                      <span className="text-[10px] text-slate-400 font-mono">10 Digits</span>
                    </div>
                    <input
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={10}
                      required
                      value={newCustomer.phone}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setNewCustomer({ ...newCustomer, phone: val });
                      }}
                      onKeyDown={(e) => {
                        if (
                          ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) ||
                          (e.ctrlKey || e.metaKey)
                        ) {
                          return;
                        }
                        if (!/^[0-9]$/.test(e.key)) {
                          e.preventDefault();
                        }
                      }}
                      placeholder="e.g. 9820011223"
                      className={`w-full bg-slate-950 border rounded-lg p-2 font-mono text-slate-200 focus:outline-none ${
                        customerPhoneDuplicate
                          ? 'border-rose-500 focus:border-rose-500 ring-1 ring-rose-500/30'
                          : isCustomerPhoneComplete
                          ? 'border-emerald-500 focus:border-emerald-500 ring-1 ring-emerald-500/30'
                          : 'border-slate-700 focus:border-indigo-500'
                      }`}
                    />
                    {customerPhoneDuplicate && (
                      <p className="text-[10px] text-rose-400 mt-1 flex items-center gap-1 font-medium">
                        <AlertTriangle className="w-3 h-3 shrink-0 text-rose-400" />
                        <span>Duplicate: registered to {customerPhoneDuplicate.name} ({customerPhoneDuplicate.id})</span>
                      </p>
                    )}
                    {isCustomerPhoneComplete && !customerPhoneDuplicate && (
                      <p className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1 font-medium">
                        <CheckCircle2 className="w-3 h-3 shrink-0 text-emerald-400" />
                        <span>Valid 10-digit mobile number</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-semibold text-slate-300 block">Email Address</label>
                      <span className="text-[10px] text-slate-400">Optional</span>
                    </div>
                    <input
                      type="email"
                      value={newCustomer.email || ''}
                      onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                      placeholder="e.g. accounts@example.com"
                      className={`w-full bg-slate-950 border rounded-lg p-2 text-slate-200 focus:outline-none ${
                        isCustomerEmailInvalid
                          ? 'border-rose-500 focus:border-rose-500 ring-1 ring-rose-500/30'
                          : 'border-slate-700 focus:border-indigo-500'
                      }`}
                    />
                    {isCustomerEmailInvalid && (
                      <p className="text-[10px] text-rose-400 mt-1 flex items-center gap-1 font-medium">
                        <AlertTriangle className="w-3 h-3 shrink-0 text-rose-400" />
                        <span>Invalid email format (e.g. user@domain.com)</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-300 block mb-1">
                      {newCustomer.businessType === 'B2B' ? 'GSTIN (Tax ID) *' : 'GSTIN (Optional)'}
                    </label>
                    <input
                      type="text"
                      value={newCustomer.gstin}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        let autoState = newCustomer.stateCode;
                        let autoSupply = newCustomer.supplyType;
                        if (val.length >= 2) {
                          const codePrefix = val.slice(0, 2);
                          if (statesList.some(s => s.code === codePrefix)) {
                            autoState = codePrefix;
                            autoSupply = codePrefix === defaultStoreStateCode ? 'LOCAL' : 'INTERSTATE';
                          }
                        }
                        setNewCustomer({
                          ...newCustomer,
                          gstin: val,
                          stateCode: autoState,
                          supplyType: autoSupply,
                          state: statesList.find(s => s.code === autoState)?.name || newCustomer.state,
                        });
                      }}
                      placeholder="27AAACA1234F1Z9"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 font-mono text-slate-200 uppercase"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-300 block mb-1">Credit Limit (₹)</label>
                    <input
                      type="number"
                      value={newCustomer.creditLimit}
                      onChange={(e) => setNewCustomer({ ...newCustomer, creditLimit: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 font-mono text-slate-200"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-300 block mb-1">State (Place of Supply) *</label>
                    <select
                      value={newCustomer.stateCode}
                      onChange={(e) => {
                        const code = e.target.value;
                        const st = statesList.find(s => s.code === code);
                        const isLocal = code === defaultStoreStateCode;
                        setNewCustomer({
                          ...newCustomer,
                          stateCode: code,
                          state: st?.name || '',
                          supplyType: isLocal ? 'LOCAL' : 'INTERSTATE',
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200 font-medium"
                    >
                      {statesList.map(s => (
                        <option key={s.id || s.code} value={s.code}>
                          {s.code} - {s.name} ({s.type})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Local / Interstate */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-semibold text-slate-300 block">Local / Interstate *</label>
                      <span className="text-[10px] text-slate-400">
                        Store: <span className="text-indigo-400 font-mono font-bold">{defaultStoreStateCode}</span>
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setNewCustomer({ ...newCustomer, supplyType: 'LOCAL' })}
                        className={`py-1.5 px-3 rounded-lg text-xs font-bold border flex items-center justify-center gap-1.5 transition ${
                          newCustomer.supplyType === 'LOCAL'
                            ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300 shadow-sm'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${newCustomer.supplyType === 'LOCAL' ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                        <span>Local (Intra)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewCustomer({ ...newCustomer, supplyType: 'INTERSTATE' })}
                        className={`py-1.5 px-3 rounded-lg text-xs font-bold border flex items-center justify-center gap-1.5 transition ${
                          newCustomer.supplyType === 'INTERSTATE'
                            ? 'bg-amber-950/80 border-amber-500 text-amber-300 shadow-sm'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${newCustomer.supplyType === 'INTERSTATE' ? 'bg-amber-400' : 'bg-slate-600'}`} />
                        <span>Interstate</span>
                      </button>
                    </div>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-800 space-y-1">
                  <label className="font-semibold text-slate-300 block">Status *</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setNewCustomer({ ...newCustomer, active: true })}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition border ${
                        newCustomer.active !== false
                          ? 'bg-emerald-950/80 border-emerald-500 text-emerald-400 shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${newCustomer.active !== false ? 'bg-emerald-400' : 'bg-slate-600'}`}></span>
                      <span>Active (Enabled)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewCustomer({ ...newCustomer, active: false })}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition border ${
                        newCustomer.active === false
                          ? 'bg-rose-950/80 border-rose-500 text-rose-400 shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${newCustomer.active === false ? 'bg-rose-400' : 'bg-slate-600'}`}></span>
                      <span>Inactive (Disabled)</span>
                    </button>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                  <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg">Cancel</button>
                  <button type="submit" className="px-5 py-2 bg-indigo-600 text-white font-bold rounded-lg">Save Customer</button>
                </div>
              </form>
            )}

            {activeSubTab === 'suppliers' && (
              <form onSubmit={handleSaveSupplier} className="space-y-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">Supplier Company Name *</label>
                  <input
                    type="text"
                    required
                    value={newSupplier.name}
                    onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-300 block mb-1">Contact Person</label>
                    <input
                      type="text"
                      value={newSupplier.contactPerson}
                      onChange={(e) => setNewSupplier({ ...newSupplier, contactPerson: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-300 block mb-1">Supplier GSTIN *</label>
                    <input
                      type="text"
                      required
                      value={newSupplier.gstin}
                      onChange={(e) => setNewSupplier({ ...newSupplier, gstin: e.target.value.toUpperCase() })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 font-mono text-slate-200 uppercase"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-300 block mb-1">Local / Interstate *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewSupplier({ ...newSupplier, supplyType: 'LOCAL' })}
                      className={`py-1.5 px-3 rounded-lg text-xs font-bold border flex items-center justify-center gap-1.5 transition ${
                        (newSupplier.supplyType || 'LOCAL') === 'LOCAL'
                          ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300 shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${(newSupplier.supplyType || 'LOCAL') === 'LOCAL' ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                      <span>Local (Intrastate)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewSupplier({ ...newSupplier, supplyType: 'INTERSTATE' })}
                      className={`py-1.5 px-3 rounded-lg text-xs font-bold border flex items-center justify-center gap-1.5 transition ${
                        newSupplier.supplyType === 'INTERSTATE'
                          ? 'bg-purple-950/80 border-purple-500 text-purple-300 shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${newSupplier.supplyType === 'INTERSTATE' ? 'bg-purple-400' : 'bg-slate-600'}`} />
                      <span>Interstate</span>
                    </button>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-800 space-y-1">
                  <label className="font-semibold text-slate-300 block">Status *</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setNewSupplier({ ...newSupplier, active: true })}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition border ${
                        newSupplier.active !== false
                          ? 'bg-emerald-950/80 border-emerald-500 text-emerald-400 shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${newSupplier.active !== false ? 'bg-emerald-400' : 'bg-slate-600'}`}></span>
                      <span>Active (Enabled)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewSupplier({ ...newSupplier, active: false })}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition border ${
                        newSupplier.active === false
                          ? 'bg-rose-950/80 border-rose-500 text-rose-400 shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${newSupplier.active === false ? 'bg-rose-400' : 'bg-slate-600'}`}></span>
                      <span>Inactive (Disabled)</span>
                    </button>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                  <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg">Cancel</button>
                  <button type="submit" className="px-5 py-2 bg-indigo-600 text-white font-bold rounded-lg">Save Supplier</button>
                </div>
              </form>
            )}

            {activeSubTab === 'warehouses' && (
              <div className="text-slate-400 text-xs py-4 text-center">
                New store and warehouse creation is configured under System Settings.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
