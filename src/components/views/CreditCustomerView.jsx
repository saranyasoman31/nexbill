// CreditCustomerView: Dedicated Credit Customer Management, Credit Limits, Receivables & Receipts
import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { saveDatabase, logAuditEvent, logBacklog } from '../../services/storageService.js';
import { INITIAL_STATES } from '../../data/initialData.js';
import {
  Users,
  CreditCard,
  Plus,
  Search,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  FileText,
  ArrowDownRight,
  TrendingDown,
  Building,
  Phone,
  Receipt,
  X,
  Edit2,
  Trash2,
  Printer,
  ShieldAlert,
} from 'lucide-react';
import ExportButtons from '../common/ExportButtons.jsx';

export default function CreditCustomerView() {
  const { db, currentUser, notify, triggerRefresh, hasPermission, activeStore } = useApp();

  const canView = hasPermission('credit_customer', 'view');
  const canAdd = hasPermission('credit_customer', 'add');
  const canUpdate = hasPermission('credit_customer', 'update');
  const canDelete = hasPermission('credit_customer', 'delete');
  const canPrint = hasPermission('credit_customer', 'print');

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

  const [search, setSearch] = useState('');
  const [filterBusinessType, setFilterBusinessType] = useState('ALL'); // ALL | B2B | B2C
  const [filterSupplyType, setFilterSupplyType] = useState('ALL'); // ALL | LOCAL | INTERSTATE
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentCustomer, setPaymentCustomer] = useState(null);

  // New Credit Customer Form State
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    phone: '',
    email: '',
    gstin: '',
    businessType: 'B2B', // B2B | B2C
    supplyType: 'LOCAL',  // LOCAL | INTERSTATE
    stateCode: defaultStoreStateCode,
    state: defaultStateName,
    creditLimit: 25000,
    creditDays: 30,
    address: '',
    active: true,
  });

  // Receive Payment Form State
  const [paymentData, setPaymentData] = useState({
    amount: '',
    paymentMethod: 'UPI',
    reference: '',
    notes: '',
  });

  // Filter credit customers
  const creditCustomers = db.customers.filter((c) => {
    const q = search.toLowerCase();
    const matchesSearch =
      c.name.toLowerCase().includes(q) ||
      (c.phone && c.phone.includes(q)) ||
      (c.gstin && c.gstin.toLowerCase().includes(q)) ||
      (c.state && c.state.toLowerCase().includes(q)) ||
      (c.stateCode && c.stateCode.includes(q));

    const bType = c.businessType || (c.gstin ? 'B2B' : 'B2C');
    const matchesBType = filterBusinessType === 'ALL' || bType === filterBusinessType;

    const sType = c.supplyType || (c.stateCode && c.stateCode !== defaultStoreStateCode ? 'INTERSTATE' : 'LOCAL');
    const matchesSType = filterSupplyType === 'ALL' || sType === filterSupplyType;

    return matchesSearch && matchesBType && matchesSType;
  });

  // KPI calculations
  const totalCreditLimit = db.customers.reduce((sum, c) => sum + (Number(c.creditLimit) || 0), 0);
  const totalOutstanding = db.customers.reduce((sum, c) => sum + (Number(c.creditOutstanding) || 0), 0);
  const availableCreditTotal = Math.max(0, totalCreditLimit - totalOutstanding);
  const customersOverLimit = db.customers.filter(
    (c) => (Number(c.creditOutstanding) || 0) > (Number(c.creditLimit) || 0)
  ).length;

  const handleToggleActive = (cust) => {
    const list = db.customers;
    const idx = list.findIndex((c) => c.id === cust.id);
    if (idx !== -1) {
      const nextStatus = cust.active === false ? true : false;
      list[idx] = { ...list[idx], active: nextStatus };
      saveDatabase(db);
      logAuditEvent(
        'CUSTOMER_STATUS_CHANGED',
        currentUser.id,
        `Changed status of customer "${cust.name}" to ${nextStatus ? 'ACTIVE' : 'INACTIVE'}`
      );
      notify(
        'info',
        `Customer "${cust.name}" marked as ${nextStatus ? 'Active' : 'Inactive'}.`,
        'Status Updated'
      );
      triggerRefresh();
    }
  };

  const handleOpenEdit = (cust) => {
    const bType = cust.businessType || (cust.gstin ? 'B2B' : 'B2C');
    const sType = cust.supplyType || (cust.stateCode && cust.stateCode !== defaultStoreStateCode ? 'INTERSTATE' : 'LOCAL');
    const stObj = statesList.find(s => s.code === (cust.stateCode || defaultStoreStateCode));
    setEditingCustomer({
      ...cust,
      businessType: bType,
      supplyType: sType,
      stateCode: cust.stateCode || defaultStoreStateCode,
      state: cust.state || stObj?.name || defaultStateName,
      active: cust.active !== false,
    });
    setIsEditModalOpen(true);
  };

  // Real-time Credit Customer Form Validation Helpers
  const newPhoneCleaned = (newCustomer.phone || '').replace(/\D/g, '');
  const newPhoneDuplicate = newPhoneCleaned.length === 10
    ? db.customers.find(c => c.phone && c.phone.replace(/\D/g, '') === newPhoneCleaned)
    : null;
  const isNewPhoneComplete = newPhoneCleaned.length === 10;
  const isNewEmailInvalid = Boolean(
    newCustomer.email &&
    newCustomer.email.trim() &&
    !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(newCustomer.email.trim())
  );

  const editPhoneCleaned = (editingCustomer?.phone || '').replace(/\D/g, '');
  const editPhoneDuplicate = (editingCustomer && editPhoneCleaned.length === 10)
    ? db.customers.find(c => c.id !== editingCustomer.id && c.phone && c.phone.replace(/\D/g, '') === editPhoneCleaned)
    : null;
  const isEditPhoneComplete = editPhoneCleaned.length === 10;
  const isEditEmailInvalid = Boolean(
    editingCustomer?.email &&
    editingCustomer.email.trim() &&
    !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(editingCustomer.email.trim())
  );

  const handleUpdateCustomer = (e) => {
    e.preventDefault();
    if (!editingCustomer.name.trim()) {
      notify('error', 'Customer name is required', 'Validation Error');
      return;
    }

    const cleanedPhone = (editingCustomer.phone || '').replace(/\D/g, '');
    if (!cleanedPhone) {
      notify('error', 'Mobile number is required.', 'Validation Error');
      return;
    }
    if (cleanedPhone.length !== 10) {
      notify('error', 'Mobile number must be exactly 10 digits.', 'Invalid Mobile Number');
      return;
    }

    const duplicateCustomer = db.customers.find(
      c => c.id !== editingCustomer.id && c.phone && c.phone.replace(/\D/g, '') === cleanedPhone
    );
    if (duplicateCustomer) {
      notify(
        'error',
        `Mobile number ${cleanedPhone} is already registered to "${duplicateCustomer.name}" (${duplicateCustomer.id}). Duplicate mobile numbers are not allowed.`,
        'Duplicate Mobile Number'
      );
      return;
    }

    const emailVal = (editingCustomer.email || '').trim();
    if (emailVal) {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(emailVal)) {
        notify('error', 'Please enter a valid email address (e.g. name@domain.com).', 'Invalid Email Format');
        return;
      }
    }

    const list = db.customers;
    const idx = list.findIndex((c) => c.id === editingCustomer.id);
    if (idx !== -1) {
      const stateObj = statesList.find(s => s.code === editingCustomer.stateCode);
      list[idx] = {
        ...editingCustomer,
        name: editingCustomer.name.trim(),
        phone: cleanedPhone,
        email: emailVal,
        gstin: (editingCustomer.gstin || '').trim(),
        businessType: editingCustomer.businessType || 'B2B',
        supplyType: editingCustomer.supplyType || 'LOCAL',
        stateCode: editingCustomer.stateCode || defaultStoreStateCode,
        state: stateObj?.name || editingCustomer.state || defaultStateName,
        creditLimit: Number(editingCustomer.creditLimit) || 0,
        creditDays: Number(editingCustomer.creditDays) || 30,
        address: (editingCustomer.address || '').trim(),
        active: editingCustomer.active !== false,
      };
      saveDatabase(db);
      logAuditEvent(
        'CUSTOMER_UPDATED',
        currentUser.id,
        `Updated customer: ${list[idx].name} (Mobile: ${list[idx].phone}, ${list[idx].businessType} • ${list[idx].supplyType} • ${list[idx].state || list[idx].stateCode}, Status: ${list[idx].active ? 'Active' : 'Inactive'}, Limit: ₹${list[idx].creditLimit})`
      );
      logBacklog({
        action: 'UPDATE',
        formName: 'Credit Customer',
        recordRef: list[idx].id,
        userId: currentUser?.id,
        userName: currentUser?.name,
        userRole: currentUser?.role,
        details: `Updated credit customer "${list[idx].name}" (${list[idx].phone}, Limit: ₹${list[idx].creditLimit})`,
      });
      notify('success', `Customer ${list[idx].name} updated successfully.`, 'Customer Updated');
      triggerRefresh();
      setIsEditModalOpen(false);
    }
  };

  const handleSaveCustomer = (e) => {
    e.preventDefault();
    if (!newCustomer.name.trim()) {
      notify('error', 'Customer name is required', 'Validation Error');
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

    const stateObj = statesList.find(s => s.code === newCustomer.stateCode);
    const custId = `CUST-${String(db.customers.length + 1).padStart(3, '0')}`;
    const record = {
      id: custId,
      name: newCustomer.name.trim(),
      phone: cleanedPhone,
      email: emailVal,
      gstin: newCustomer.gstin.trim(),
      businessType: newCustomer.businessType || 'B2B',
      supplyType: newCustomer.supplyType || 'LOCAL',
      stateCode: newCustomer.stateCode || defaultStoreStateCode,
      state: stateObj?.name || newCustomer.state || defaultStateName,
      creditLimit: Number(newCustomer.creditLimit) || 0,
      creditDays: Number(newCustomer.creditDays) || 30,
      creditOutstanding: 0,
      loyaltyPoints: 0,
      isWalkIn: false,
      address: newCustomer.address.trim(),
      active: newCustomer.active !== false,
    };

    db.customers.push(record);
    saveDatabase(db);
    logAuditEvent(
      'CREDIT_CUSTOMER_CREATED',
      currentUser.id,
      `Created credit customer: ${record.name} (Mobile: ${record.phone}, ${record.businessType} • ${record.supplyType} • ${record.state || record.stateCode}, Limit: ₹${record.creditLimit})`
    );
    logBacklog({
      action: 'SAVE',
      formName: 'Credit Customer',
      recordRef: custId,
      userId: currentUser?.id,
      userName: currentUser?.name,
      userRole: currentUser?.role,
      details: `Saved new credit customer "${record.name}" (${record.phone}, Limit: ₹${record.creditLimit})`,
    });
    notify(
      'success',
      `Credit customer ${record.name} (${record.businessType} - ${record.supplyType}) added with ₹${record.creditLimit} limit.`,
      'Customer Created'
    );
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
      creditLimit: 25000,
      creditDays: 30,
      address: '',
      active: true,
    });
  };

  const handleOpenPayment = (cust) => {
    setPaymentCustomer(cust);
    setPaymentData({
      amount: cust.creditOutstanding > 0 ? String(cust.creditOutstanding) : '',
      paymentMethod: 'UPI',
      reference: '',
      notes: 'Customer on-account outstanding clearance',
    });
    setIsPaymentModalOpen(true);
  };

  const handleRecordPayment = (e) => {
    e.preventDefault();
    const amt = Number(paymentData.amount);
    if (!amt || amt <= 0) {
      notify('error', 'Please enter a valid payment amount', 'Invalid Amount');
      return;
    }

    const cust = db.customers.find((c) => c.id === paymentCustomer.id);
    if (!cust) return;

    const previousOutstanding = Number(cust.creditOutstanding) || 0;
    cust.creditOutstanding = Math.max(0, previousOutstanding - amt);

    // Record receipt log
    logAuditEvent(
      'CREDIT_PAYMENT_RECEIVED',
      currentUser.id,
      `Received ₹${amt} from ${cust.name} via ${paymentData.paymentMethod} (Ref: ${paymentData.reference || 'N/A'}). Outstanding reduced from ₹${previousOutstanding} to ₹${cust.creditOutstanding}`
    );
    logBacklog({
      action: 'SAVE',
      formName: 'Credit Customer Receipt',
      recordRef: cust.id,
      userId: currentUser?.id,
      userName: currentUser?.name,
      userRole: currentUser?.role,
      details: `Received credit clearance payment of ₹${amt.toFixed(2)} from ${cust.name} via ${paymentData.paymentMethod} (Ref: ${paymentData.reference || 'N/A'}). Outstanding now ₹${cust.creditOutstanding.toFixed(2)}`,
    });

    saveDatabase(db);
    notify(
      'success',
      `Payment of ₹${amt.toFixed(2)} recorded for ${cust.name}. Remaining outstanding: ₹${cust.creditOutstanding.toFixed(2)}`,
      'Receipt Recorded'
    );
    triggerRefresh();
    setIsPaymentModalOpen(false);
  };

  const handleDeleteCustomer = (cust) => {
    if (!canDelete) {
      notify('error', 'You do not have permission to delete customer records.', 'Permission Denied');
      return;
    }
    if (Number(cust.creditOutstanding) > 0) {
      notify('error', `Cannot delete customer ${cust.name} with active outstanding balance ₹${cust.creditOutstanding}. Settle all balances first.`, 'Action Blocked');
      return;
    }
    if (window.confirm(`Are you sure you want to delete customer "${cust.name}"?`)) {
      db.customers = db.customers.filter((c) => c.id !== cust.id);
      saveDatabase(db);
      logAuditEvent('CUSTOMER_DELETED', currentUser?.id, `Deleted customer ${cust.name} (${cust.id})`);
      logBacklog({
        action: 'DELETE',
        formName: 'Credit Customer',
        recordRef: cust.id,
        userId: currentUser?.id,
        userName: currentUser?.name,
        userRole: currentUser?.role,
        details: `Deleted credit customer "${cust.name}" (${cust.id})`,
      });
      notify('info', `Customer ${cust.name} deleted successfully.`, 'Customer Deleted');
      triggerRefresh();
    }
  };

  // Customer credit sales invoices
  const customerInvoices = selectedCustomer
    ? db.invoices.filter((i) => i.customerId === selectedCustomer.id && i.status === 'POSTED')
    : [];

  if (!canView) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-lg mx-auto shadow-2xl space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-950/80 border border-rose-500/50 flex items-center justify-center mx-auto text-rose-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">Access Restricted</h3>
            <p className="text-xs text-slate-400 mt-1">
              You do not have permission to view the <span className="text-slate-200 font-semibold">Credit Customer</span> ledger. Contact your administrator to adjust your role privileges.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-3 sm:p-3.5 rounded-xl shadow-md">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 shrink-0">
            <CreditCard className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-slate-100 text-sm truncate sm:overflow-visible">Credit Customer Ledger & Receivables</h3>
            <p className="text-[11px] text-slate-400 line-clamp-1 sm:line-clamp-none">
              Manage on-account credit limits, current outstanding balances, customer receivables & settlement receipts
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search name, GSTIN, state..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-52"
            />
          </div>

          {/* Business Type Filter */}
          <select
            value={filterBusinessType}
            onChange={(e) => setFilterBusinessType(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
            title="Filter by Business Type"
          >
            <option value="ALL">All Types</option>
            <option value="B2B">B2B Only</option>
            <option value="B2C">B2C Only</option>
          </select>

          {/* Supply Type Filter */}
          <select
            value={filterSupplyType}
            onChange={(e) => setFilterSupplyType(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
            title="Filter by Local or Interstate"
          >
            <option value="ALL">All Supply</option>
            <option value="LOCAL">Local</option>
            <option value="INTERSTATE">Interstate</option>
          </select>

          <ExportButtons
            data={creditCustomers.map((cust, idx) => ({
              '#': idx + 1,
              'Customer ID': cust.id,
              'Name': cust.name,
              'Business Type': cust.businessType || (cust.gstin ? 'B2B' : 'B2C'),
              'Local / Interstate': cust.supplyType || 'LOCAL',
              'State': cust.state || 'Maharashtra',
              'Phone': cust.phone,
              'Email': cust.email || '',
              'GSTIN': cust.gstin || '',
              'Credit Limit': `₹${Number(cust.creditLimit || 0).toLocaleString('en-IN')}`,
              'Outstanding': `₹${Number(cust.creditOutstanding || 0).toLocaleString('en-IN')}`,
              'Available Credit': `₹${Math.max(0, (Number(cust.creditLimit) || 0) - (Number(cust.creditOutstanding) || 0)).toLocaleString('en-IN')}`,
              'Status': cust.active !== false ? 'Active' : 'Inactive'
            }))}
            filename="CREDIT_CUSTOMERS_DIRECTORY"
            title="CREDIT CUSTOMERS & RECEIVABLES LEDGER"
            pdfOrientation="landscape"
          />

          {canPrint && (
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold shadow-sm transition"
              title="Print Credit Customers Report"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
          )}

          {canAdd && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-indigo-600/30 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Credit Customer</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-sm space-y-1">
          <span className="text-[11px] text-slate-400">Total Credit Extended</span>
          <div className="text-xl font-bold font-mono text-slate-100">₹{totalCreditLimit.toLocaleString('en-IN')}</div>
          <span className="text-[10px] text-indigo-400 font-semibold">{db.customers.length} On-Account Customers</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-sm space-y-1">
          <span className="text-[11px] text-slate-400">Total Outstanding Receivables</span>
          <div className="text-xl font-bold font-mono text-rose-400">₹{totalOutstanding.toLocaleString('en-IN')}</div>
          <span className="text-[10px] text-rose-300 font-semibold">
            {((totalOutstanding / (totalCreditLimit || 1)) * 100).toFixed(1)}% Credit Utilized
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-sm space-y-1">
          <span className="text-[11px] text-slate-400">Available Headroom</span>
          <div className="text-xl font-bold font-mono text-emerald-400">₹{availableCreditTotal.toLocaleString('en-IN')}</div>
          <span className="text-[10px] text-emerald-300 font-semibold">Safe Operating Margin</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-sm space-y-1">
          <span className="text-[11px] text-slate-400">Over-Limit Alerts</span>
          <div className={`text-xl font-bold font-mono ${customersOverLimit > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
            {customersOverLimit} Accounts
          </div>
          <span className="text-[10px] text-slate-500">Requires Manager Clearance</span>
        </div>
      </div>

      {/* Credit Customers Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[750px]">
            <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Customer Name</th>
                <th className="py-2.5 px-3">Business & Supply</th>
                <th className="py-2.5 px-3">Contact / GSTIN</th>
                <th className="py-2.5 px-3 text-right">Credit Limit</th>
                <th className="py-2.5 px-3 text-right">Current Outstanding</th>
                <th className="py-2.5 px-3 text-right">Available Credit</th>
                <th className="py-2.5 px-3 text-center">Utilization</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {creditCustomers.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-8 text-center text-slate-500 font-sans">
                    No credit customer records match your filter criteria.
                  </td>
                </tr>
              ) : (
                creditCustomers.map((cust) => {
                  const limit = Number(cust.creditLimit) || 0;
                  const outstanding = Number(cust.creditOutstanding) || 0;
                  const available = Math.max(0, limit - outstanding);
                  const utilPct = limit > 0 ? Math.min(100, Math.round((outstanding / limit) * 100)) : 0;
                  const isOver = outstanding > limit;
                  const custBusinessType = cust.businessType || (cust.gstin ? 'B2B' : 'B2C');
                  const custSupplyType = cust.supplyType || (cust.stateCode && cust.stateCode !== defaultStoreStateCode ? 'INTERSTATE' : 'LOCAL');
                  const stateName = cust.state || (statesList.find(s => s.code === (cust.stateCode || defaultStoreStateCode))?.name) || 'Maharashtra';

                  return (
                    <tr key={cust.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-2.5 px-3 font-sans">
                        <div className="font-bold text-slate-100 flex items-center gap-1.5">
                          {cust.name}
                          {isOver && (
                            <span className="px-1.5 py-0.2 rounded bg-rose-950 text-rose-400 border border-rose-800 text-[9px] font-bold">
                              EXCEEDED
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">{cust.id} • {cust.creditDays || 30} Days Terms</div>
                      </td>

                      <td className="py-2.5 px-3 font-sans">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            custBusinessType === 'B2B'
                              ? 'bg-indigo-950/90 text-indigo-300 border-indigo-700/60'
                              : 'bg-sky-950/90 text-sky-300 border-sky-700/60'
                          }`}>
                            {custBusinessType}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            custSupplyType === 'LOCAL'
                              ? 'bg-emerald-950/90 text-emerald-300 border-emerald-700/60'
                              : 'bg-amber-950/90 text-amber-300 border-amber-700/60'
                          }`}>
                            {custSupplyType}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-sans flex items-center gap-1">
                          <span className="font-mono text-indigo-400 font-semibold">{cust.stateCode || defaultStoreStateCode}</span>
                          <span>•</span>
                          <span className="truncate max-w-[130px]" title={stateName}>{stateName}</span>
                        </div>
                      </td>

                      <td className="py-2.5 px-3 font-sans">
                        <div className="text-slate-300">{cust.phone || 'No phone'}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{cust.gstin || 'Unregistered B2C'}</div>
                      </td>

                      <td className="py-2.5 px-3 text-right font-bold text-slate-200">
                        ₹{limit.toLocaleString('en-IN')}
                      </td>

                      <td className="py-2.5 px-3 text-right font-bold">
                        <span className={outstanding > 0 ? (isOver ? 'text-rose-400 font-black' : 'text-amber-400') : 'text-slate-400'}>
                          ₹{outstanding.toLocaleString('en-IN')}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-right font-bold text-emerald-400">
                        ₹{available.toLocaleString('en-IN')}
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        <div className="w-24 mx-auto space-y-1">
                          <div className="flex justify-between text-[9px] text-slate-400">
                            <span>{utilPct}%</span>
                          </div>
                          <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-1.5 rounded-full ${
                                utilPct > 80 ? 'bg-rose-500' : utilPct > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${utilPct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-2.5 px-3 text-center font-sans">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!canUpdate) {
                              notify('warning', 'You do not have permission to update customer status.', 'Permission Denied');
                              return;
                            }
                            handleToggleActive(cust);
                          }}
                          title={canUpdate ? 'Click to toggle Active / Inactive status' : 'Status (Update permission required)'}
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold border transition ${
                            canUpdate ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed opacity-90'
                          } ${
                            cust.active !== false
                              ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                              : 'bg-rose-950 text-rose-400 border-rose-800'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              cust.active !== false ? 'bg-emerald-400' : 'bg-rose-400'
                            }`}
                          />
                          {cust.active !== false ? 'Active' : 'Inactive'}
                        </button>
                      </td>

                      <td className="py-2.5 px-3 text-center font-sans">
                        <div className="flex items-center justify-center gap-1.5">
                          {canUpdate && (
                            <button
                              onClick={() => handleOpenPayment(cust)}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold flex items-center gap-1 shadow transition"
                              title="Record Customer Payment Receipt"
                            >
                              <DollarSign className="w-3 h-3" />
                              <span>Receive</span>
                            </button>
                          )}

                          {canUpdate && (
                            <button
                              onClick={() => handleOpenEdit(cust)}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                              title="Edit Customer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {canDelete && (
                            <button
                              onClick={() => handleDeleteCustomer(cust)}
                              className="p-1 rounded bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 transition"
                              title="Delete Customer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {canView && (
                            <button
                              onClick={() => setSelectedCustomer(cust)}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                              title="View Invoices & Statement"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {!canUpdate && !canDelete && (
                            <span className="text-[10px] text-slate-500 italic">Read-only</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Invoices / Statement Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl space-y-4 p-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h4 className="font-bold text-slate-100 text-sm">Account Statement: {selectedCustomer.name}</h4>
                <p className="text-xs text-slate-400">
                  Credit Limit: ₹{selectedCustomer.creditLimit?.toLocaleString('en-IN')} • Outstanding: ₹
                  {selectedCustomer.creditOutstanding?.toLocaleString('en-IN')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <ExportButtons
                  data={customerInvoices.map((inv, idx) => ({
                    '#': idx + 1,
                    'Invoice #': inv.docNumber,
                    'Date': new Date(inv.date).toLocaleDateString(),
                    'Gross Amount': `₹${inv.netPayable?.toFixed(2)}`,
                    'Paid Amount': `₹${inv.paidAmount?.toFixed(2)}`,
                    'Payment Status': inv.status,
                  }))}
                  filename={`STATEMENT_${selectedCustomer.name.replace(/\s+/g, '_')}`}
                  title={`ACCOUNT STATEMENT: ${selectedCustomer.name}`}
                  subtitle={`Credit Limit: ₹${selectedCustomer.creditLimit?.toLocaleString('en-IN')} | Current Outstanding: ₹${selectedCustomer.creditOutstanding?.toLocaleString('en-IN')}`}
                  size="small"
                />
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {customerInvoices.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs">
                  No posted invoices found for this customer.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[500px]">
                    <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase border-b border-slate-800">
                      <tr>
                        <th className="py-2 px-3">Invoice #</th>
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3 text-right">Amount</th>
                        <th className="py-2 px-3 text-right">Tender Paid</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
                      {customerInvoices.map((inv) => (
                        <tr key={inv.id}>
                          <td className="py-2 px-3 text-indigo-300 font-bold">{inv.docNumber}</td>
                          <td className="py-2 px-3 text-slate-400">{new Date(inv.date).toLocaleDateString()}</td>
                          <td className="py-2 px-3 text-right font-bold text-slate-100">₹{inv.netPayable.toFixed(2)}</td>
                          <td className="py-2 px-3 text-right text-emerald-400">₹{inv.paidAmount.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              {canPrint && (
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Statement</span>
                </button>
              )}
              <button
                onClick={() => setSelectedCustomer(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold ml-auto"
              >
                Close Statement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Credit Customer Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-indigo-400" />
                Add On-Account Credit Customer
              </h4>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                {/* Business Type Selector */}
                <div className="col-span-2 space-y-1">
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

                <div className="col-span-2 space-y-1">
                  <label className="font-semibold text-slate-300 block">Customer Full Name *</label>
                  <input
                    type="text"
                    required
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                    placeholder={newCustomer.businessType === 'B2B' ? 'e.g. Apex Bulk Supplies LLP' : 'e.g. Rajesh Kumar'}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
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
                    className={`w-full bg-slate-950 border rounded-lg px-3 py-2 font-mono text-slate-100 focus:outline-none ${
                      newPhoneDuplicate
                        ? 'border-rose-500 focus:border-rose-500 ring-1 ring-rose-500/30'
                        : isNewPhoneComplete
                        ? 'border-emerald-500 focus:border-emerald-500 ring-1 ring-emerald-500/30'
                        : 'border-slate-700 focus:border-indigo-500'
                    }`}
                  />
                  {newPhoneDuplicate && (
                    <p className="text-[10px] text-rose-400 mt-1 flex items-center gap-1 font-medium">
                      <AlertTriangle className="w-3 h-3 shrink-0 text-rose-400" />
                      <span>Duplicate: registered to {newPhoneDuplicate.name} ({newPhoneDuplicate.id})</span>
                    </p>
                  )}
                  {isNewPhoneComplete && !newPhoneDuplicate && (
                    <p className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1 font-medium">
                      <CheckCircle2 className="w-3 h-3 shrink-0 text-emerald-400" />
                      <span>Valid 10-digit mobile number</span>
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-slate-300 block">Email Address</label>
                    <span className="text-[10px] text-slate-400">Optional</span>
                  </div>
                  <input
                    type="email"
                    value={newCustomer.email}
                    onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                    placeholder="accounts@apexbulk.in"
                    className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-slate-100 focus:outline-none ${
                      isNewEmailInvalid
                        ? 'border-rose-500 focus:border-rose-500 ring-1 ring-rose-500/30'
                        : 'border-slate-700 focus:border-indigo-500'
                    }`}
                  />
                  {isNewEmailInvalid && (
                    <p className="text-[10px] text-rose-400 mt-1 flex items-center gap-1 font-medium">
                      <AlertTriangle className="w-3 h-3 shrink-0 text-rose-400" />
                      <span>Invalid email format (e.g. user@domain.com)</span>
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-300 block">
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
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 uppercase font-mono focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-300 block">Customer State (Place of Supply) *</label>
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
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-indigo-500 font-medium"
                  >
                    {statesList.map((s) => (
                      <option key={s.id || s.code} value={s.code}>
                        {s.code} - {s.name} ({s.type})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Local / Interstate */}
                <div className="col-span-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-slate-300 block">Local / Interstate *</label>
                    <span className="text-[10px] text-slate-400">
                      Store State: <span className="text-indigo-400 font-mono font-bold">{defaultStoreStateCode}</span>
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewCustomer({ ...newCustomer, supplyType: 'LOCAL' })}
                      className={`py-2 px-3 rounded-lg text-xs font-bold border flex items-center justify-center gap-2 transition ${
                        newCustomer.supplyType === 'LOCAL'
                          ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300 shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${newCustomer.supplyType === 'LOCAL' ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                      <span>Local</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewCustomer({ ...newCustomer, supplyType: 'INTERSTATE' })}
                      className={`py-2 px-3 rounded-lg text-xs font-bold border flex items-center justify-center gap-2 transition ${
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

                <div className="space-y-1">
                  <label className="font-semibold text-slate-300 block">Approved Credit Limit (₹) *</label>
                  <input
                    type="number"
                    min="1000"
                    required
                    value={newCustomer.creditLimit}
                    onChange={(e) => setNewCustomer({ ...newCustomer, creditLimit: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-indigo-500 font-bold text-indigo-300"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-300 block">Payment Credit Days</label>
                  <input
                    type="number"
                    min="0"
                    value={newCustomer.creditDays}
                    onChange={(e) => setNewCustomer({ ...newCustomer, creditDays: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-indigo-500"
                  />
                </div>

                <div className="col-span-2 space-y-1">
                  <label className="font-semibold text-slate-300 block">Billing Address</label>
                  <textarea
                    rows="2"
                    value={newCustomer.address}
                    onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                    placeholder="Office / Street address"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Active / Inactive Status Selector */}
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
                    <span
                      className={`w-2 h-2 rounded-full ${
                        newCustomer.active !== false ? 'bg-emerald-400' : 'bg-slate-600'
                      }`}
                    ></span>
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
                    <span
                      className={`w-2 h-2 rounded-full ${newCustomer.active === false ? 'bg-rose-400' : 'bg-slate-600'}`}
                    ></span>
                    <span>Inactive (Disabled)</span>
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold shadow-md shadow-indigo-600/30"
                >
                  Save Credit Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Credit Customer Modal */}
      {isEditModalOpen && editingCustomer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-indigo-400" />
                Edit Credit Customer: {editingCustomer.name}
              </h4>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateCustomer} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                {/* Business Type Selector */}
                <div className="col-span-2 space-y-1">
                  <label className="font-semibold text-slate-300 block">Business Type *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingCustomer({ ...editingCustomer, businessType: 'B2B' })}
                      className={`py-2 px-3 rounded-lg text-xs font-bold border flex items-center justify-center gap-2 transition ${
                        (editingCustomer.businessType || 'B2B') === 'B2B'
                          ? 'bg-indigo-950/90 border-indigo-500 text-indigo-300 shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${(editingCustomer.businessType || 'B2B') === 'B2B' ? 'bg-indigo-400' : 'bg-slate-600'}`} />
                      <span>B2B (Registered Business)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingCustomer({ ...editingCustomer, businessType: 'B2C' })}
                      className={`py-2 px-3 rounded-lg text-xs font-bold border flex items-center justify-center gap-2 transition ${
                        editingCustomer.businessType === 'B2C'
                          ? 'bg-sky-950/90 border-sky-500 text-sky-300 shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${editingCustomer.businessType === 'B2C' ? 'bg-sky-400' : 'bg-slate-600'}`} />
                      <span>B2C (Retail Consumer)</span>
                    </button>
                  </div>
                </div>

                <div className="col-span-2 space-y-1">
                  <label className="font-semibold text-slate-300 block">Customer Full Name *</label>
                  <input
                    type="text"
                    required
                    value={editingCustomer.name || ''}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-slate-300 block">Mobile Number *</label>
                    <span className="text-[10px] text-slate-400 font-mono">10 Digits</span>
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={10}
                    required
                    value={editingCustomer.phone || ''}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setEditingCustomer({ ...editingCustomer, phone: val });
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
                    className={`w-full bg-slate-950 border rounded-lg px-3 py-2 font-mono text-slate-100 focus:outline-none ${
                      editPhoneDuplicate
                        ? 'border-rose-500 focus:border-rose-500 ring-1 ring-rose-500/30'
                        : isEditPhoneComplete
                        ? 'border-emerald-500 focus:border-emerald-500 ring-1 ring-emerald-500/30'
                        : 'border-slate-700 focus:border-indigo-500'
                    }`}
                  />
                  {editPhoneDuplicate && (
                    <p className="text-[10px] text-rose-400 mt-1 flex items-center gap-1 font-medium">
                      <AlertTriangle className="w-3 h-3 shrink-0 text-rose-400" />
                      <span>Duplicate: registered to {editPhoneDuplicate.name} ({editPhoneDuplicate.id})</span>
                    </p>
                  )}
                  {isEditPhoneComplete && !editPhoneDuplicate && (
                    <p className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1 font-medium">
                      <CheckCircle2 className="w-3 h-3 shrink-0 text-emerald-400" />
                      <span>Valid 10-digit mobile number</span>
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-slate-300 block">Email Address</label>
                    <span className="text-[10px] text-slate-400">Optional</span>
                  </div>
                  <input
                    type="email"
                    value={editingCustomer.email || ''}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, email: e.target.value })}
                    placeholder="accounts@apexbulk.in"
                    className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-slate-100 focus:outline-none ${
                      isEditEmailInvalid
                        ? 'border-rose-500 focus:border-rose-500 ring-1 ring-rose-500/30'
                        : 'border-slate-700 focus:border-indigo-500'
                    }`}
                  />
                  {isEditEmailInvalid && (
                    <p className="text-[10px] text-rose-400 mt-1 flex items-center gap-1 font-medium">
                      <AlertTriangle className="w-3 h-3 shrink-0 text-rose-400" />
                      <span>Invalid email format (e.g. user@domain.com)</span>
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-300 block">
                    {editingCustomer.businessType === 'B2B' ? 'GSTIN (Tax ID) *' : 'GSTIN (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={editingCustomer.gstin || ''}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      let autoState = editingCustomer.stateCode;
                      let autoSupply = editingCustomer.supplyType;
                      if (val.length >= 2) {
                        const codePrefix = val.slice(0, 2);
                        if (statesList.some(s => s.code === codePrefix)) {
                          autoState = codePrefix;
                          autoSupply = codePrefix === defaultStoreStateCode ? 'LOCAL' : 'INTERSTATE';
                        }
                      }
                      setEditingCustomer({
                        ...editingCustomer,
                        gstin: val,
                        stateCode: autoState,
                        supplyType: autoSupply,
                        state: statesList.find(s => s.code === autoState)?.name || editingCustomer.state,
                      });
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 uppercase font-mono focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-300 block">Customer State (Place of Supply) *</label>
                  <select
                    value={editingCustomer.stateCode || defaultStoreStateCode}
                    onChange={(e) => {
                      const code = e.target.value;
                      const st = statesList.find(s => s.code === code);
                      const isLocal = code === defaultStoreStateCode;
                      setEditingCustomer({
                        ...editingCustomer,
                        stateCode: code,
                        state: st?.name || '',
                        supplyType: isLocal ? 'LOCAL' : 'INTERSTATE',
                      });
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-indigo-500 font-medium"
                  >
                    {statesList.map((s) => (
                      <option key={s.id || s.code} value={s.code}>
                        {s.code} - {s.name} ({s.type})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Local / Interstate */}
                <div className="col-span-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-slate-300 block">Local / Interstate *</label>
                    <span className="text-[10px] text-slate-400">
                      Store State: <span className="text-indigo-400 font-mono font-bold">{defaultStoreStateCode}</span>
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingCustomer({ ...editingCustomer, supplyType: 'LOCAL' })}
                      className={`py-2 px-3 rounded-lg text-xs font-bold border flex items-center justify-center gap-2 transition ${
                        (editingCustomer.supplyType || 'LOCAL') === 'LOCAL'
                          ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300 shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${(editingCustomer.supplyType || 'LOCAL') === 'LOCAL' ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                      <span>Local</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingCustomer({ ...editingCustomer, supplyType: 'INTERSTATE' })}
                      className={`py-2 px-3 rounded-lg text-xs font-bold border flex items-center justify-center gap-2 transition ${
                        editingCustomer.supplyType === 'INTERSTATE'
                          ? 'bg-amber-950/80 border-amber-500 text-amber-300 shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${editingCustomer.supplyType === 'INTERSTATE' ? 'bg-amber-400' : 'bg-slate-600'}`} />
                      <span>Interstate</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-300 block">Approved Credit Limit (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editingCustomer.creditLimit || ''}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, creditLimit: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-indigo-500 font-bold text-indigo-300"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-300 block">Payment Credit Days</label>
                  <input
                    type="number"
                    min="0"
                    value={editingCustomer.creditDays || 30}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, creditDays: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-indigo-500"
                  />
                </div>

                <div className="col-span-2 space-y-1">
                  <label className="font-semibold text-slate-300 block">Billing Address</label>
                  <textarea
                    rows="2"
                    value={editingCustomer.address || ''}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, address: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Active / Inactive Status Selector */}
              <div className="pt-2 border-t border-slate-800 space-y-1">
                <label className="font-semibold text-slate-300 block">Status *</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingCustomer({ ...editingCustomer, active: true })}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition border ${
                      editingCustomer.active !== false
                        ? 'bg-emerald-950/80 border-emerald-500 text-emerald-400 shadow-sm'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        editingCustomer.active !== false ? 'bg-emerald-400' : 'bg-slate-600'
                      }`}
                    ></span>
                    <span>Active (Enabled)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingCustomer({ ...editingCustomer, active: false })}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition border ${
                      editingCustomer.active === false
                        ? 'bg-rose-950/80 border-rose-500 text-rose-400 shadow-sm'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${editingCustomer.active === false ? 'bg-rose-400' : 'bg-slate-600'}`}
                    ></span>
                    <span>Inactive (Disabled)</span>
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold shadow-md shadow-indigo-600/30"
                >
                  Update Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Receipt Modal */}
      {isPaymentModalOpen && paymentCustomer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h4 className="font-bold text-slate-100 text-sm flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  Receive Credit Payment
                </h4>
                <p className="text-xs text-slate-400">
                  Customer: <span className="text-slate-200 font-semibold">{paymentCustomer.name}</span>
                </p>
              </div>
              <button onClick={() => setIsPaymentModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>Current Outstanding Balance:</span>
                  <span className="font-mono font-bold text-rose-400">
                    ₹{paymentCustomer.creditOutstanding?.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Approved Limit:</span>
                  <span className="font-mono text-slate-300">
                    ₹{paymentCustomer.creditLimit?.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Payment Amount Received (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={paymentData.amount}
                  onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono font-bold text-emerald-400 text-sm focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Payment Mode</label>
                <select
                  value={paymentData.paymentMethod}
                  onChange={(e) => setPaymentData({ ...paymentData, paymentMethod: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-indigo-500"
                >
                  <option value="UPI">UPI / Instant QR</option>
                  <option value="CASH">Cash Drawer</option>
                  <option value="CHEQUE">Cheque / Demand Draft</option>
                  <option value="BANK_TRANSFER">Direct Bank NEFT / RTGS</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Reference / Transaction Number</label>
                <input
                  type="text"
                  value={paymentData.reference}
                  onChange={(e) => setPaymentData({ ...paymentData, reference: e.target.value })}
                  placeholder="e.g. UTR / Cheque #982100"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Remarks / Notes</label>
                <input
                  type="text"
                  value={paymentData.notes}
                  onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold shadow-md shadow-emerald-600/30"
                >
                  Post Payment & Clear Credit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
