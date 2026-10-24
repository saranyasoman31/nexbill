// Initial seed data for NexBill ERP
export const INITIAL_COMPANIES = [
  {
    id: 'COMP-01',
    code: 'CMP-001',
    name: 'NexBill Enterprise',
    tradeName: 'NexBill Enterprise',
    gstin: '27AAACA1234F1Z9',
    state: 'Maharashtra',
    stateCode: '27',
    currency: 'INR',
    currencySymbol: '₹',
    address: 'Corporate Headquarters, Bandra Kurla Complex, Mumbai, MH - 400051',
    phone: '+91 22 4000 8800',
    contact: '+91 22 4000 8800',
    mfg: 'Standard Manufacturing & Packaging Division',
    email: 'admin@nexbill.com',
    active: true,
  }
];

export const INITIAL_STORES = [
  {
    id: 'STR-01',
    companyId: 'COMP-01',
    name: 'Main Store',
    code: 'STR-01',
    city: 'Mumbai',
    state: 'Maharashtra',
    stateCode: '27',
    address: 'Plot 14, Commercial Hub, Mumbai',
    phone: '+91 22 4000 8800',
    isDayOpen: true,
    active: true,
  }
];

export const INITIAL_WAREHOUSES = [
  {
    id: 'WH-MUM-MAIN',
    storeId: 'STR-01',
    companyId: 'COMP-01',
    name: 'Main Warehouse',
    code: 'WH-01',
    type: 'STORAGE',
    isSellable: true,
  }
];

export const INITIAL_USERS = [
  {
    id: 'USR-ADMIN',
    name: 'System Administrator',
    role: 'ADMINISTRATOR',
    roleId: 'ROLE_ADMIN',
    storeId: 'STR-01',
    companyId: 'COMP-01',
    email: 'admin@nexbill.com',
    username: 'admin',
    avatar: '👑',
    permissions: [
      'ALL_PERMISSIONS',
      'SUPER_ADMIN',
      'MASTERS_MANAGE',
      'TRANSACTIONS_MANAGE',
      'REPORTS_VIEW',
      'SETTINGS_MANAGE',
      'ALL_STORE_OPS',
      'APPROVE_ADJUSTMENT',
      'APPROVE_RATE_CHANGE',
      'APPROVE_REVERSAL',
      'DAY_CLOSE',
      'FINANCE_VIEW',
      'TALLY_EXPORT',
      'PERIOD_CLOSE',
      'COMPANY_SETTINGS',
      'USER_MANAGEMENT',
      'POLICY_CONFIG',
    ],
    active: true,
  }
];

export const INITIAL_PRODUCTS = [];

export const INITIAL_STATES = [
  { id: 'ST-01', code: '01', name: 'Jammu and Kashmir', type: 'UT', active: true },
  { id: 'ST-02', code: '02', name: 'Himachal Pradesh', type: 'STATE', active: true },
  { id: 'ST-03', code: '03', name: 'Punjab', type: 'STATE', active: true },
  { id: 'ST-04', code: '04', name: 'Chandigarh', type: 'UT', active: true },
  { id: 'ST-05', code: '05', name: 'Uttarakhand', type: 'STATE', active: true },
  { id: 'ST-06', code: '06', name: 'Haryana', type: 'STATE', active: true },
  { id: 'ST-07', code: '07', name: 'Delhi', type: 'UT', active: true },
  { id: 'ST-08', code: '08', name: 'Rajasthan', type: 'STATE', active: true },
  { id: 'ST-09', code: '09', name: 'Uttar Pradesh', type: 'STATE', active: true },
  { id: 'ST-10', code: '10', name: 'Bihar', type: 'STATE', active: true },
  { id: 'ST-11', code: '11', name: 'Sikkim', type: 'STATE', active: true },
  { id: 'ST-12', code: '12', name: 'Arunachal Pradesh', type: 'STATE', active: true },
  { id: 'ST-13', code: '13', name: 'Nagaland', type: 'STATE', active: true },
  { id: 'ST-14', code: '14', name: 'Manipur', type: 'STATE', active: true },
  { id: 'ST-15', code: '15', name: 'Mizoram', type: 'STATE', active: true },
  { id: 'ST-16', code: '16', name: 'Tripura', type: 'STATE', active: true },
  { id: 'ST-17', code: '17', name: 'Meghalaya', type: 'STATE', active: true },
  { id: 'ST-18', code: '18', name: 'Assam', type: 'STATE', active: true },
  { id: 'ST-19', code: '19', name: 'West Bengal', type: 'STATE', active: true },
  { id: 'ST-20', code: '20', name: 'Jharkhand', type: 'STATE', active: true },
  { id: 'ST-21', code: '21', name: 'Odisha', type: 'STATE', active: true },
  { id: 'ST-22', code: '22', name: 'Chhattisgarh', type: 'STATE', active: true },
  { id: 'ST-23', code: '23', name: 'Madhya Pradesh', type: 'STATE', active: true },
  { id: 'ST-24', code: '24', name: 'Gujarat', type: 'STATE', active: true },
  { id: 'ST-25', code: '25', name: 'Daman and Diu', type: 'UT', active: true },
  { id: 'ST-26', code: '26', name: 'Dadra and Nagar Haveli and Daman and Diu', type: 'UT', active: true },
  { id: 'ST-27', code: '27', name: 'Maharashtra', type: 'STATE', active: true },
  { id: 'ST-28', code: '28', name: 'Andhra Pradesh (Old)', type: 'STATE', active: true },
  { id: 'ST-29', code: '29', name: 'Karnataka', type: 'STATE', active: true },
  { id: 'ST-30', code: '30', name: 'Goa', type: 'STATE', active: true },
  { id: 'ST-31', code: '31', name: 'Lakshadweep', type: 'UT', active: true },
  { id: 'ST-32', code: '32', name: 'Kerala', type: 'STATE', active: true },
  { id: 'ST-33', code: '33', name: 'Tamil Nadu', type: 'STATE', active: true },
  { id: 'ST-34', code: '34', name: 'Puducherry', type: 'UT', active: true },
  { id: 'ST-35', code: '35', name: 'Andaman and Nicobar Islands', type: 'UT', active: true },
  { id: 'ST-36', code: '36', name: 'Telangana', type: 'STATE', active: true },
  { id: 'ST-37', code: '37', name: 'Andhra Pradesh', type: 'STATE', active: true },
  { id: 'ST-38', code: '38', name: 'Ladakh', type: 'UT', active: true },
  { id: 'ST-97', code: '97', name: 'Other Territory', type: 'SPECIAL', active: true },
  { id: 'ST-99', code: '99', name: 'Centre Jurisdiction', type: 'SPECIAL', active: true },
];

export const INITIAL_CUSTOMERS = [
  {
    id: 'CUST-001',
    name: 'Walk-in Retail Customer',
    phone: '9999999999',
    email: 'walkin@nexbill.com',
    gstin: '',
    state: 'Maharashtra',
    stateCode: '27',
    businessType: 'B2C',
    supplyType: 'LOCAL',
    creditLimit: 0,
    creditOutstanding: 0,
    loyaltyPoints: 0,
    isWalkIn: true,
    active: true,
  }
];

export const INITIAL_SUPPLIERS = [];

export const INITIAL_COUPONS = [];

// Initial stock balances across warehouses
export const INITIAL_STOCK_BALANCES = [];

export const INITIAL_REGISTER_SESSION = {
  id: 'REG-INIT-01',
  storeId: 'STR-01',
  warehouseId: 'WH-MUM-MAIN',
  openedByUserId: 'USR-ADMIN',
  openedAt: '2026-10-13T08:00:00.000Z',
  openingCash: 0.00,
  closedAt: null,
  closedByUserId: null,
  status: 'OPEN',
  countedCash: 0,
  cashVariance: 0,
  notes: 'Opening register session',
};

// Main Categories Master
export const INITIAL_MAIN_CATEGORIES = [
  { id: 'MCAT-01', name: 'General', code: 'GEN', description: 'General merchandise & products', active: true },
];

// Sub-Categories Master
export const INITIAL_CATEGORIES = [
  { id: 'CAT-01', mainCategoryId: 'MCAT-01', name: 'General Goods', code: 'GEN-G', hsnCode: '9999', defaultTaxRate: 5, active: true },
];

// Brands Master
export const INITIAL_BRANDS = [];

// Units of Measure (UOM)
export const INITIAL_UNITS = [
  { id: 'UNT-01', name: 'Pieces', code: 'PCS', description: 'Single count unit', allowDecimal: false, active: true },
  { id: 'UNT-02', name: 'Kilograms', code: 'KGS', description: 'Weight metric kilogram', allowDecimal: true, active: true },
  { id: 'UNT-03', name: 'Grams', code: 'GMS', description: 'Weight metric gram', allowDecimal: true, active: true },
  { id: 'UNT-04', name: 'Litres', code: 'LTR', description: 'Liquid volume metric', allowDecimal: true, active: true },
  { id: 'UNT-05', name: 'Bottles', code: 'BTL', description: 'Container bottle package', allowDecimal: false, active: true },
  { id: 'UNT-06', name: 'Boxes / Packets', code: 'BOX', description: 'Carton or pack', allowDecimal: false, active: true },
  { id: 'UNT-07', name: 'Meters', code: 'MTR', description: 'Length metric', allowDecimal: true, active: true },
];

// Payment Modes
export const INITIAL_PAYMENT_MODES = [
  { id: 'PAY-01', name: 'Cash', code: 'CASH', tenderType: 'cash', isElectronic: false, isCredit: false, active: true },
  { id: 'PAY-02', name: 'UPI / QR Payment', code: 'UPI', tenderType: 'electronic', isElectronic: true, isCredit: false, active: true },
  { id: 'PAY-03', name: 'Credit Card', code: 'CARD_CREDIT', tenderType: 'electronic', isElectronic: true, isCredit: false, active: true },
  { id: 'PAY-04', name: 'Debit Card', code: 'CARD_DEBIT', tenderType: 'electronic', isElectronic: true, isCredit: false, active: true },
  { id: 'PAY-05', name: 'Customer Credit (On-Account)', code: 'CREDIT', tenderType: 'credit', isCredit: true, isElectronic: false, active: true },
  { id: 'PAY-06', name: 'Cheque / Bank Draft', code: 'CHEQUE', tenderType: 'electronic', isElectronic: true, isCredit: false, active: true },
];

// Tax Slabs (Domestic Dual GST & International Single VAT)
export const INITIAL_TAXES = [
  { id: 'TAX-01', name: 'GST 0% (Nil / Exempted)', rate: 0, taxType: 'GST', cgst: 0, sgst: 0, igst: 0, cess: 0, active: true },
  { id: 'TAX-02', name: 'GST 5% (Essential Goods)', rate: 5, taxType: 'GST', cgst: 2.5, sgst: 2.5, igst: 5, cess: 0, active: true },
  { id: 'TAX-03', name: 'GST 12% (Standard Low)', rate: 12, taxType: 'GST', cgst: 6, sgst: 6, igst: 12, cess: 0, active: true },
  { id: 'TAX-04', name: 'GST 18% (Standard General)', rate: 18, taxType: 'GST', cgst: 9, sgst: 9, igst: 18, cess: 0, active: true },
  { id: 'TAX-05', name: 'GST 28% (Luxury / Sin Goods)', rate: 28, taxType: 'GST', cgst: 14, sgst: 14, igst: 28, cess: 0, active: true },
  { id: 'TAX-06', name: 'VAT 5% (GCC / UAE / Oman)', rate: 5, taxType: 'VAT', cgst: 0, sgst: 0, igst: 5, cess: 0, active: true },
  { id: 'TAX-07', name: 'VAT 15% (Saudi Arabia VAT)', rate: 15, taxType: 'VAT', cgst: 0, sgst: 0, igst: 15, cess: 0, active: true },
  { id: 'TAX-08', name: 'VAT 20% (UK / Europe Standard)', rate: 20, taxType: 'VAT', cgst: 0, sgst: 0, igst: 20, cess: 0, active: true },
];

// Sample Purchase Orders
export const INITIAL_PURCHASE_ORDERS = [];

// Initial / Opening Stock Entries
export const INITIAL_INITIAL_STOCKS = [];

// Master Menus Configuration (25 menus in user-specified sequence)
export const SYSTEM_MENUS_CONFIG = [
  { id: 'credit_customer', label: 'Credit Customer', group: 'Customer & Accounts', path: 'credit_customer' },
  { id: 'main_category', label: 'Main Category', group: 'Masters & Catalogs', path: 'main_category' },
  { id: 'category', label: 'Category', group: 'Masters & Catalogs', path: 'category' },
  { id: 'brand', label: 'Brand', group: 'Masters & Catalogs', path: 'brand' },
  { id: 'supplier', label: 'Supplier', group: 'Masters & Catalogs', path: 'supplier' },
  { id: 'unit', label: 'Unit', group: 'Masters & Catalogs', path: 'unit' },
  { id: 'company', label: 'Company', group: 'Masters & Catalogs', path: 'company' },
  { id: 'product', label: 'Product', group: 'Masters & Catalogs', path: 'product' },
  { id: 'staff', label: 'Staff', group: 'Masters & Catalogs', path: 'staff' },
  { id: 'payment_mode', label: 'Payment Mode', group: 'Masters & Catalogs', path: 'payment_mode' },
  { id: 'tax', label: 'Tax', group: 'Masters & Catalogs', path: 'tax' },
  { id: 'branch', label: 'Branch', group: 'Masters & Catalogs', path: 'branch' },
  { id: 'purchase_order', label: 'Purchase Order', group: 'Purchasing & Inward', path: 'purchase_order' },
  { id: 'purchase', label: 'Purchase', group: 'Purchasing & Inward', path: 'purchase' },
  { id: 'purchase_return', label: 'Purchase Return', group: 'Purchasing & Inward', path: 'purchase_return' },
  { id: 'initial', label: 'Initial (Opening Stock)', group: 'Inventory & Stock', path: 'initial' },
  { id: 'stock', label: 'Stock', group: 'Inventory & Stock', path: 'stock' },
  { id: 'stock_adjustment', label: 'Stock Adjustment', group: 'Inventory & Stock', path: 'stock_adjustment' },
  { id: 'rate_change', label: 'Rate Change', group: 'Inventory & Stock', path: 'rate_change' },
  { id: 'billing', label: 'Billing (POS)', group: 'Billing & Registers', path: 'billing' },
  { id: 'billing_return', label: 'Billing Return', group: 'Billing & Registers', path: 'billing_return' },
  { id: 'day_close', label: 'Day Close', group: 'Billing & Registers', path: 'day_close' },
  { id: 'stock_transfer', label: 'Stock Transfer', group: 'Transfers', path: 'stock_transfer' },
  {
    id: 'reports',
    label: 'Reports',
    group: 'Analytics & Reports',
    path: 'reports',
    submenus: [
      { id: 'report_sales', label: 'Sales & Revenue Report', group: 'Analytics & Reports', tab: 'sales', icon: 'ShoppingCart' },
      { id: 'report_purchases', label: 'Purchases & Vendor Register', group: 'Analytics & Reports', tab: 'purchases', icon: 'Truck' },
      { id: 'report_stock', label: 'Stock Valuation & Low Stock', group: 'Analytics & Reports', tab: 'stock', icon: 'Boxes' },
      { id: 'report_gst', label: 'GST Statutory (GSTR-1)', group: 'Analytics & Reports', tab: 'gst', icon: 'Percent' },
      { id: 'report_tally', label: 'Tally Prime XML Export', group: 'Analytics & Reports', tab: 'tally', icon: 'DownloadCloud' },
      { id: 'report_backlog', label: 'Backlog Activity Report', group: 'Analytics & Reports', tab: 'backlog', icon: 'Activity' },
      { id: 'report_audit', label: 'Audit Trail & Activity Log', group: 'Analytics & Reports', tab: 'audit', icon: 'ShieldAlert' },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    group: 'System Configuration',
    path: 'settings',
    submenus: [
      { id: 'settings_profile', label: 'Profile', group: 'System Configuration', tab: 'profile', icon: 'User' },
      { id: 'settings_permissions', label: 'User Permission', group: 'System Configuration', tab: 'permissions', icon: 'ShieldCheck' },
      { id: 'settings_policy', label: 'System Policy', group: 'System Configuration', tab: 'policy', icon: 'Sparkles' },
      { id: 'settings_appearance', label: 'Theme & Appearance', group: 'System Configuration', tab: 'appearance', icon: 'Palette' },
    ],
  },
];

export const PERMISSION_ACTIONS = ['view', 'add', 'update', 'delete', 'print'];

export function createRolePermissions(defaultVal = false, overrides = {}) {
  const perms = {};
  SYSTEM_MENUS_CONFIG.forEach((m) => {
    perms[m.id] = {
      view: defaultVal,
      add: defaultVal,
      update: defaultVal,
      delete: defaultVal,
      print: defaultVal,
      ...(overrides[m.id] || {}),
    };
    if (m.submenus && Array.isArray(m.submenus)) {
      m.submenus.forEach((sub) => {
        perms[sub.id] = {
          view: defaultVal,
          add: defaultVal,
          update: defaultVal,
          delete: defaultVal,
          print: defaultVal,
          ...(overrides[sub.id] || overrides[m.id] || {}),
        };
      });
    }
  });
  return perms;
}

export const INITIAL_ROLES = [
  {
    id: 'ROLE_ADMIN',
    code: 'ADMINISTRATOR',
    name: 'Administrator',
    category: 'System',
    description: 'Root system administrator with unrestricted access to all menus, transactions, masters, reports, and system settings',
    isSystem: true,
    menuPermissions: createRolePermissions(true),
  },
  {
    id: 'ROLE_STORE_MANAGER',
    code: 'STORE_MANAGER',
    name: 'Store Manager',
    category: 'Operations',
    description: 'Supervises branch operations, stock adjustments, purchase invoices, POS cashier voids, pricing changes, and shift closure',
    isSystem: false,
    menuPermissions: createRolePermissions(false, {
      credit_customer: { view: true, add: true, update: true, delete: false, print: true },
      main_category: { view: true, add: true, update: true, delete: false, print: false },
      category: { view: true, add: true, update: true, delete: false, print: false },
      brand: { view: true, add: true, update: true, delete: false, print: false },
      supplier: { view: true, add: true, update: true, delete: false, print: true },
      unit: { view: true, add: true, update: true, delete: false, print: false },
      company: { view: true, add: false, update: true, delete: false, print: false },
      product: { view: true, add: true, update: true, delete: false, print: true },
      staff: { view: true, add: true, update: true, delete: false, print: false },
      payment_mode: { view: true, add: false, update: false, delete: false, print: false },
      tax: { view: true, add: false, update: false, delete: false, print: false },
      branch: { view: true, add: false, update: true, delete: false, print: false },
      purchase_order: { view: true, add: true, update: true, delete: false, print: true },
      purchase: { view: true, add: true, update: true, delete: false, print: true },
      purchase_return: { view: true, add: true, update: true, delete: false, print: true },
      initial: { view: true, add: false, update: false, delete: false, print: true },
      stock: { view: true, add: false, update: false, delete: false, print: true },
      stock_adjustment: { view: true, add: true, update: true, delete: false, print: true },
      rate_change: { view: true, add: true, update: true, delete: false, print: true },
      billing: { view: true, add: true, update: true, delete: true, print: true },
      billing_return: { view: true, add: true, update: true, delete: false, print: true },
      day_close: { view: true, add: true, update: true, delete: false, print: true },
      stock_transfer: { view: true, add: true, update: true, delete: false, print: true },
      reports: { view: true, add: false, update: false, delete: false, print: true },
      settings: { view: true, add: false, update: false, delete: false, print: false },
    }),
  },
  {
    id: 'ROLE_CASHIER',
    code: 'CASHIER',
    name: 'Cashier / POS Operator',
    category: 'Billing',
    description: 'Front-desk point of sale cashier for customer retail billing, receipts, customer lookups, and shift day close',
    isSystem: false,
    menuPermissions: createRolePermissions(false, {
      credit_customer: { view: true, add: true, update: false, delete: false, print: true },
      product: { view: true, add: false, update: false, delete: false, print: false },
      billing: { view: true, add: true, update: true, delete: false, print: true },
      billing_return: { view: true, add: true, update: false, delete: false, print: true },
      day_close: { view: true, add: true, update: false, delete: false, print: true },
    }),
  },
  {
    id: 'ROLE_PURCHASE_USER',
    code: 'PURCHASE_USER',
    name: 'Purchase Executive',
    category: 'Procurement',
    description: 'Procurement specialist managing vendor master catalogs, purchase orders, purchase invoices, and vendor returns',
    isSystem: false,
    menuPermissions: createRolePermissions(false, {
      supplier: { view: true, add: true, update: true, delete: false, print: true },
      main_category: { view: true, add: false, update: false, delete: false, print: false },
      category: { view: true, add: false, update: false, delete: false, print: false },
      brand: { view: true, add: false, update: false, delete: false, print: false },
      unit: { view: true, add: false, update: false, delete: false, print: false },
      company: { view: true, add: true, update: true, delete: false, print: true },
      product: { view: true, add: true, update: true, delete: false, print: true },
      purchase_order: { view: true, add: true, update: true, delete: false, print: true },
      purchase: { view: true, add: true, update: true, delete: false, print: true },
      purchase_return: { view: true, add: true, update: true, delete: false, print: true },
      stock: { view: true, add: false, update: false, delete: false, print: true },
      reports: { view: true, add: false, update: false, delete: false, print: true },
    }),
  },
  {
    id: 'ROLE_STOREKEEPER',
    code: 'STOREKEEPER',
    name: 'Storekeeper / Warehouse Clerk',
    category: 'Inventory',
    description: 'Warehouse supervisor managing physical inventory bins, stock movements, cycle counts, adjustments, and inter-store transfers',
    isSystem: false,
    menuPermissions: createRolePermissions(false, {
      product: { view: true, add: false, update: false, delete: false, print: false },
      initial: { view: true, add: false, update: false, delete: false, print: true },
      stock: { view: true, add: false, update: false, delete: false, print: true },
      stock_adjustment: { view: true, add: true, update: true, delete: false, print: true },
      stock_transfer: { view: true, add: true, update: true, delete: false, print: true },
      reports: { view: true, add: false, update: false, delete: false, print: true },
    }),
  },
  {
    id: 'ROLE_ACCOUNTANT',
    code: 'FINANCE_ACCOUNTANT',
    name: 'Accountant / Financial Officer',
    category: 'Finance',
    description: 'Financial auditor overseeing customer accounts, GST tax ledgers, Tally Prime exports, day close reconciliations, and balance audits',
    isSystem: false,
    menuPermissions: createRolePermissions(false, {
      credit_customer: { view: true, add: false, update: true, delete: false, print: true },
      supplier: { view: true, add: false, update: false, delete: false, print: true },
      payment_mode: { view: true, add: false, update: false, delete: false, print: false },
      tax: { view: true, add: false, update: false, delete: false, print: false },
      purchase: { view: true, add: false, update: false, delete: false, print: true },
      purchase_return: { view: true, add: false, update: false, delete: false, print: true },
      billing: { view: true, add: false, update: false, delete: false, print: true },
      billing_return: { view: true, add: false, update: false, delete: false, print: true },
      day_close: { view: true, add: false, update: false, delete: false, print: true },
      reports: { view: true, add: false, update: false, delete: false, print: true },
    }),
  },
  {
    id: 'ROLE_AUDITOR',
    code: 'AUDITOR',
    name: 'External Auditor',
    category: 'Audit',
    description: 'Read-only financial and inventory audit role with full report export and print permissions',
    isSystem: false,
    menuPermissions: createRolePermissions(false, {
      credit_customer: { view: true, add: false, update: false, delete: false, print: true },
      main_category: { view: true, add: false, update: false, delete: false, print: false },
      category: { view: true, add: false, update: false, delete: false, print: false },
      brand: { view: true, add: false, update: false, delete: false, print: false },
      supplier: { view: true, add: false, update: false, delete: false, print: true },
      unit: { view: true, add: false, update: false, delete: false, print: false },
      company: { view: true, add: false, update: false, delete: false, print: true },
      product: { view: true, add: false, update: false, delete: false, print: true },
      purchase_order: { view: true, add: false, update: false, delete: false, print: true },
      purchase: { view: true, add: false, update: false, delete: false, print: true },
      purchase_return: { view: true, add: false, update: false, delete: false, print: true },
      initial: { view: true, add: false, update: false, delete: false, print: true },
      stock: { view: true, add: false, update: false, delete: false, print: true },
      stock_adjustment: { view: true, add: false, update: false, delete: false, print: true },
      rate_change: { view: true, add: false, update: false, delete: false, print: true },
      billing: { view: true, add: false, update: false, delete: false, print: true },
      billing_return: { view: true, add: false, update: false, delete: false, print: true },
      day_close: { view: true, add: false, update: false, delete: false, print: true },
      stock_transfer: { view: true, add: false, update: false, delete: false, print: true },
      reports: { view: true, add: false, update: false, delete: false, print: true },
    }),
  },
];

/**
 * Standard Default Terms & Conditions for Purchase Orders
 */
export const DEFAULT_PO_TERMS = [
  '1. Delivery must strictly match the ordered quantities, specifications, and approved rates.',
  '2. All dispatch shipments must carry duplicate delivery challans and valid Tax Invoices.',
  '3. Damaged, expired, or non-conforming goods will be rejected at the vendor\'s cost.',
].join('\n');

/**
 * Quick Clauses & Presets for PO Terms & Conditions Entry
 */
export const PO_TERMS_PRESETS = [
  {
    id: 'standard',
    label: 'Standard Clauses',
    text: DEFAULT_PO_TERMS,
    mode: 'replace',
  },
  {
    id: 'net30',
    label: '+ Net 30 Days Payment',
    text: 'Payment will be released within 30 days after physical receipt, inspection, and verification of invoice.',
    mode: 'append',
  },
  {
    id: 'urgent',
    label: '+ Immediate Delivery (3 Days)',
    text: 'Urgent requirement: Material must be dispatched immediately and delivered within 3 working days.',
    mode: 'append',
  },
  {
    id: 'freight',
    label: '+ Freight Paid by Supplier',
    text: 'All freight, transport insurance, toll, and unloading expenses at delivery destination to be borne by vendor.',
    mode: 'append',
  },
  {
    id: 'quality',
    label: '+ Quality & 80% Shelf Life',
    text: 'Material must have minimum 80% shelf life remaining at time of inward and conform strictly to approved quality specs.',
    mode: 'append',
  },
];


