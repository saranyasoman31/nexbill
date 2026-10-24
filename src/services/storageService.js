// Storage service managing local persistence and relational mock database for NexBill ERP
import {
  INITIAL_COMPANIES,
  INITIAL_STORES,
  INITIAL_WAREHOUSES,
  INITIAL_USERS,
  INITIAL_PRODUCTS,
  INITIAL_CUSTOMERS,
  INITIAL_SUPPLIERS,
  INITIAL_COUPONS,
  INITIAL_STOCK_BALANCES,
  INITIAL_REGISTER_SESSION,
  INITIAL_MAIN_CATEGORIES,
  INITIAL_CATEGORIES,
  INITIAL_BRANDS,
  INITIAL_UNITS,
  INITIAL_PAYMENT_MODES,
  INITIAL_TAXES,
  INITIAL_PURCHASE_ORDERS,
  INITIAL_INITIAL_STOCKS,
  INITIAL_ROLES,
  INITIAL_STATES,
  DEFAULT_PO_TERMS,
} from '../data/initialData.js';

const STORAGE_KEY = 'NEXBILL_ERP_DATABASE_V1';

export function initializeDatabase(forceReset = false) {
  if (!forceReset) {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) {
      try {
        const parsed = JSON.parse(existing);
        let mutated = false;
        // Ensure USR-ADMIN exists in existing database
        if (!parsed.users || !parsed.users.some(u => u.id === 'USR-ADMIN')) {
          parsed.users = parsed.users || [];
          parsed.users.unshift(INITIAL_USERS[0]);
          mutated = true;
        }
        if (!parsed.mainCategories) { parsed.mainCategories = INITIAL_MAIN_CATEGORIES; mutated = true; }
        if (!parsed.categories) { parsed.categories = INITIAL_CATEGORIES; mutated = true; }
        if (!parsed.brands) { parsed.brands = INITIAL_BRANDS; mutated = true; }
        if (!parsed.units) { parsed.units = INITIAL_UNITS; mutated = true; }
        if (!parsed.paymentModes) { parsed.paymentModes = INITIAL_PAYMENT_MODES; mutated = true; }
        if (!parsed.taxes) { parsed.taxes = INITIAL_TAXES; mutated = true; }
        if (!parsed.purchaseOrders) { parsed.purchaseOrders = INITIAL_PURCHASE_ORDERS; mutated = true; }
        if (!parsed.initialStocks) { parsed.initialStocks = INITIAL_INITIAL_STOCKS; mutated = true; }
        if (!parsed.purchaseReturns) { parsed.purchaseReturns = []; mutated = true; }
        if (!parsed.roles || parsed.roles.length === 0) {
          parsed.roles = INITIAL_ROLES;
          mutated = true;
        } else {
          parsed.roles.forEach((r) => {
            if (r.menuPermissions && !r.menuPermissions.company) {
              const initRole = INITIAL_ROLES.find((ir) => ir.id === r.id || ir.code === r.code);
              r.menuPermissions.company = initRole?.menuPermissions?.company || {
                view: true,
                add: r.menuPermissions.product?.add ?? false,
                update: r.menuPermissions.product?.update ?? false,
                delete: false,
                print: true,
              };
              mutated = true;
            }
          });
        }
        if (!parsed.states || parsed.states.length === 0) { parsed.states = INITIAL_STATES; mutated = true; }

        // Ensure all companies have code, mfg, contact, address
        if (parsed.companies) {
          const compCodeMap = {
            'COMP-01': 'CMP-001',
            'COMP-02': 'CMP-002',
            'COMP-03': 'CMP-003',
            'COMP-04': 'CMP-004',
          };
          parsed.companies.forEach((comp, idx) => {
            if (!comp.code) {
              comp.code = compCodeMap[comp.id] || `CMP-${String(idx + 1).padStart(3, '0')}`;
              mutated = true;
            }
            if (!comp.mfg) {
              comp.mfg = comp.tradeName ? `${comp.tradeName} Manufacturing Division` : 'Standard Manufacturing';
              mutated = true;
            }
            if (!comp.contact) {
              comp.contact = comp.phone || '';
              mutated = true;
            }
            if (!comp.address) {
              comp.address = '';
              mutated = true;
            }
          });
          INITIAL_COMPANIES.forEach((initComp) => {
            if (!parsed.companies.some((c) => c.id === initComp.id || c.name === initComp.name)) {
              parsed.companies.push(initComp);
              mutated = true;
            }
          });
        } else {
          parsed.companies = INITIAL_COMPANIES;
          mutated = true;
        }

        // Ensure sample products have company assigned if not set
        if (parsed.products) {
          parsed.products.forEach((p) => {
            if (p.id === 'PROD-001' && !p.companyId) {
              p.companyId = 'COMP-01';
              p.company = 'Apex Retail Enterprises Ltd';
              p.companyCode = 'CMP-001';
              mutated = true;
            }
            if (p.id === 'PROD-002' && !p.companyId) {
              p.companyId = 'COMP-01';
              p.company = 'Apex Retail Enterprises Ltd';
              p.companyCode = 'CMP-001';
              mutated = true;
            }
            if (p.id === 'PROD-004' && !p.companyId) {
              p.companyId = 'COMP-03';
              p.company = 'Sun Pharma & FMCG Industries';
              p.companyCode = 'CMP-003';
              mutated = true;
            }
          });
        }

        // Ensure all brands have a valid code
        if (parsed.brands) {
          const brandCodeMap = {
            'BRD-01': 'RH',
            'BRD-02': 'PURA',
            'BRD-03': 'GOLD',
            'BRD-04': 'AMUL',
            'BRD-05': 'TATA',
            'BRD-06': 'BRIT',
            'BRD-07': 'CLMX',
          };
          parsed.brands.forEach((b) => {
            if (!b.code) {
              b.code =
                brandCodeMap[b.id] ||
                (b.name ? b.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() : b.id.replace('BRD-', 'BR-'));
              mutated = true;
            }
          });
        }

        // Ensure all users have a valid roleId
        if (parsed.users) {
          parsed.users.forEach((u) => {
            if (!u.roleId) {
              const matchedRole = (parsed.roles || INITIAL_ROLES).find(
                (r) => r.code === u.role || r.id === u.role
              );
              u.roleId = matchedRole ? matchedRole.id : 'ROLE_ADMIN';
              mutated = true;
            }
          });
        }

        // Ensure all customers have businessType, supplyType, and state
        if (parsed.customers) {
          parsed.customers.forEach((c) => {
            if (!c.businessType) {
              c.businessType = (c.gstin && c.gstin.trim().length > 0) ? 'B2B' : 'B2C';
              mutated = true;
            }
            if (!c.supplyType) {
              c.supplyType = (c.stateCode && c.stateCode !== '27') ? 'INTERSTATE' : 'LOCAL';
              mutated = true;
            }
            if (!c.state) {
              const st = INITIAL_STATES.find(s => s.code === (c.stateCode || '27'));
              c.state = st ? st.name : 'Maharashtra';
              mutated = true;
            }
          });
        }

        // Ensure all suppliers have supplyType, openingBalance, state, district, and bank details
        if (parsed.suppliers) {
          parsed.suppliers.forEach((s) => {
            if (!s.stateCode) {
              s.stateCode = '27';
              mutated = true;
            }
            if (!s.state) {
              const st = INITIAL_STATES.find(item => item.code === s.stateCode);
              s.state = st ? st.name : 'Maharashtra';
              mutated = true;
            }
            if (!s.supplyType) {
              s.supplyType = s.stateCode !== '27' ? 'INTERSTATE' : 'LOCAL';
              mutated = true;
            }
            if (s.openingBalance === undefined || s.openingBalance === null) {
              s.openingBalance = 0;
              mutated = true;
            }
            if (!s.district) {
              s.district = s.city || 'Mumbai';
              mutated = true;
            }
            if (!s.bankName) {
              s.bankName = '';
            }
            if (!s.accountNumber) {
              s.accountNumber = '';
            }
            if (!s.ifscCode) {
              s.ifscCode = '';
            }
            if (!s.branchName) {
              s.branchName = '';
            }
            if (!s.accountHolderName) {
              s.accountHolderName = s.name || '';
            }
            if (s.phone && (s.phone.includes('+91') || s.phone.includes(' '))) {
              s.phone = s.phone.replace(/\D/g, '').slice(-10);
              mutated = true;
            }
          });
        }

        // Ensure all payment modes have tenderType and remove obsolete requiresReference
        if (parsed.paymentModes) {
          parsed.paymentModes.forEach((pm) => {
            if (!pm.tenderType) {
              const isCredit = pm.code === 'CREDIT' || (pm.name || '').toLowerCase().includes('credit') || pm.isCredit;
              pm.tenderType = isCredit ? 'credit' : (pm.isElectronic ? 'electronic' : 'cash');
              pm.isCredit = isCredit;
              pm.isElectronic = pm.tenderType === 'electronic';
              mutated = true;
            }
            if (pm.requiresReference !== undefined) {
              delete pm.requiresReference;
              mutated = true;
            }
          });
        }

        // Ensure all taxes have taxType ('GST' vs 'VAT')
        if (parsed.taxes) {
          parsed.taxes.forEach((t) => {
            if (!t.taxType) {
              t.taxType = (t.cgst > 0 || t.sgst > 0) ? 'GST' : 'VAT';
              mutated = true;
            }
          });
        }

        if (mutated) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        }
        return parsed;
      } catch (e) {
        console.error('Failed to parse stored ERP database, resetting...', e);
      }
    }
  }

  // Generate initial state with sample posted invoices & movements
  const sampleInvoiceNumber = 'INV-2026-0001';
  const sampleInvoiceDate = new Date(Date.now() - 3600000 * 2).toISOString();

  const initialDb = {
    companies: INITIAL_COMPANIES,
    stores: INITIAL_STORES,
    warehouses: INITIAL_WAREHOUSES,
    users: INITIAL_USERS,
    products: INITIAL_PRODUCTS,
    customers: INITIAL_CUSTOMERS,
    suppliers: INITIAL_SUPPLIERS,
    coupons: INITIAL_COUPONS,
    stockBalances: INITIAL_STOCK_BALANCES,
    mainCategories: INITIAL_MAIN_CATEGORIES,
    categories: INITIAL_CATEGORIES,
    brands: INITIAL_BRANDS,
    units: INITIAL_UNITS,
    paymentModes: INITIAL_PAYMENT_MODES,
    taxes: INITIAL_TAXES,
    purchaseOrders: INITIAL_PURCHASE_ORDERS,
    initialStocks: INITIAL_INITIAL_STOCKS,
    stockMovements: [
      {
        id: 'SMOV-0001',
        timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
        docType: 'INITIAL_STOCK',
        docId: 'INIT-2026-MUM',
        docNumber: 'INIT-2026-MUM',
        warehouseId: 'WH-MUM-MAIN',
        productId: 'PROD-001',
        qtyChange: 48,
        balanceAfter: 48,
        costRate: 340.0,
        reason: 'Fiscal year opening stock cutover',
        userId: 'USR-04',
      },
      {
        id: 'SMOV-0002',
        timestamp: sampleInvoiceDate,
        docType: 'SALE_OUT',
        docId: 'INV-SAMPLE-1',
        docNumber: sampleInvoiceNumber,
        warehouseId: 'WH-MUM-MAIN',
        productId: 'PROD-001',
        qtyChange: -3,
        balanceAfter: 45,
        costRate: 340.0,
        reason: 'Customer retail sale',
        userId: 'USR-01',
      }
    ],
    invoices: [
      {
        id: 'INV-SAMPLE-1',
        docNumber: sampleInvoiceNumber,
        companyId: 'COMP-01',
        storeId: 'STR-01',
        warehouseId: 'WH-MUM-MAIN',
        customerId: 'CUST-002',
        customerName: 'Arun Verma',
        date: sampleInvoiceDate,
        status: 'POSTED',
        idempotencyToken: 'IDEMP-SAMPLE-0001',
        lines: [
          {
            lineId: 'LINE-1',
            productId: 'PROD-001',
            sku: 'RIC-BAS-5K',
            name: 'Royal Heritage Basmati Rice 5kg',
            barcode: '8901234001012',
            hsnCode: '10063020',
            uom: 'Pcs',
            qty: 3,
            returnedQty: 0,
            remainingReturnableQty: 3,
            rate: 430.0,
            mrp: 499.0,
            discountPercent: 0,
            discountAmount: 0,
            taxRate: 5,
            taxAmount: 61.43,
            taxableAmount: 1228.57,
            lineTotal: 1290.0,
          }
        ],
        subtotal: 1290.0,
        lineDiscountTotal: 0,
        couponCode: null,
        couponDiscount: 0,
        pointsRedeemed: 0,
        pointsDiscountAmount: 0,
        pointsEarned: 12,
        taxableAmount: 1228.57,
        cgstAmount: 30.71,
        sgstAmount: 30.72,
        igstAmount: 0,
        totalTax: 61.43,
        roundOff: 0.0,
        netPayable: 1290.0,
        paidAmount: 1290.0,
        balanceDue: 0.0,
        tenders: [
          { method: 'UPI', amount: 1290.0, reference: 'UPI-9821008819' }
        ],
        createdBy: 'USR-01',
        createdByName: 'Priya Sharma',
        postedAt: sampleInvoiceDate,
        reversedAt: null,
        reversalReason: null,
      }
    ],
    salesReturns: [],
    purchases: [
      {
        id: 'PUR-SAMPLE-1',
        docNumber: 'PUR-2026-0001',
        supplierId: 'SUPP-01',
        supplierName: 'AgroFresh Commodities LLP',
        supplierInvoiceNo: 'AGRO/2026/771',
        companyId: 'COMP-01',
        storeId: 'STR-01',
        warehouseId: 'WH-MUM-MAIN',
        date: new Date(Date.now() - 86400000).toISOString(),
        status: 'POSTED',
        lines: [
          {
            lineId: 'PLINE-1',
            productId: 'PROD-001',
            name: 'Royal Heritage Basmati Rice 5kg',
            qty: 50,
            returnedQty: 0,
            rate: 340.0,
            taxRate: 5,
            taxAmount: 850.0,
            lineTotal: 17850.0,
          }
        ],
        subtotal: 17000.0,
        totalTax: 850.0,
        netAmount: 17850.0,
        paymentStatus: 'PAID',
        createdBy: 'USR-02',
        postedAt: new Date(Date.now() - 86400000).toISOString(),
      }
    ],
    purchaseReturns: [],
    stockTransfers: [
      {
        id: 'TRF-0001',
        docNumber: 'TRF-2026-0001',
        sourceWarehouseId: 'WH-MUM-MAIN',
        destinationWarehouseId: 'WH-MUM-FRONT',
        sourceStoreId: 'STR-01',
        destinationStoreId: 'STR-01',
        companyId: 'COMP-01',
        status: 'RECEIVED', // DRAFT -> DISPATCHED -> RECEIVED -> CLOSED
        lines: [
          {
            productId: 'PROD-001',
            productName: 'Royal Heritage Basmati Rice 5kg',
            dispatchedQty: 5,
            receivedQty: 5,
            damagedQty: 0,
            variance: 0,
          }
        ],
        dispatchedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
        receivedAt: new Date(Date.now() - 3600000 * 3).toISOString(),
        dispatchedBy: 'USR-03',
        receivedBy: 'USR-01',
        notes: 'Replenishing front counter shelf',
      }
    ],
    stockAdjustments: [],
    rateChanges: [],
    loyaltyLedger: [
      {
        id: 'LOY-001',
        customerId: 'CUST-002',
        docType: 'SALE_EARN',
        docNumber: sampleInvoiceNumber,
        pointsDelta: 12,
        balanceAfter: 340,
        remarks: 'Points earned for invoice INV-2026-0001',
        timestamp: sampleInvoiceDate,
      }
    ],
    registerSessions: [INITIAL_REGISTER_SESSION],
    tallyExportBatches: [],
    auditLogs: [
      {
        id: 'AUD-0001',
        timestamp: new Date().toISOString(),
        action: 'SYSTEM_INIT',
        userId: 'USR-ADMIN',
        details: 'NexBill ERP database initialized with enterprise compliance baseline',
        ip: '127.0.0.1',

      }
    ],
    backlog: [
      {
        id: 'BKL-0001',
        timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
        userId: 'USR-ADMIN',
        userName: 'System Administrator',
        userRole: 'ADMINISTRATOR',
        ipAddress: '192.168.1.100',
        formName: 'Product Master',
        action: 'SAVE',
        recordRef: 'PROD-001',
        details: 'Saved Product: Royal Heritage Basmati Rice 5kg (MRP: ₹499.00, Cost: ₹340.00)',
      },
      {
        id: 'BKL-0002',
        timestamp: new Date(Date.now() - 3600000 * 20).toISOString(),
        userId: 'USR-ADMIN',
        userName: 'System Administrator',
        userRole: 'ADMINISTRATOR',
        ipAddress: '192.168.1.100',
        formName: 'Supplier Master',
        action: 'SAVE',
        recordRef: 'SUPP-01',
        details: 'Saved Supplier: AgroFresh Commodities LLP (GSTIN: 27AAAFB1111C1Z0)',
      },
      {
        id: 'BKL-0003',
        timestamp: new Date(Date.now() - 3600000 * 16).toISOString(),
        userId: 'USR-04',
        userName: 'Anil Kapoor',
        userRole: 'STORE_MANAGER',
        ipAddress: '192.168.1.105',
        formName: 'Branch Master',
        action: 'UPDATE',
        recordRef: 'STR-01',
        details: 'Updated Branch: Apex Flagship Mumbai address & contact details',
      },
      {
        id: 'BKL-0004',
        timestamp: new Date(Date.now() - 3600000 * 8).toISOString(),
        userId: 'USR-02',
        userName: 'Rajesh Patel',
        userRole: 'PURCHASE_USER',
        ipAddress: '192.168.1.112',
        formName: 'Purchase Order',
        action: 'SAVE',
        recordRef: 'PO/2026/0101',
        details: 'Saved Purchase Order PO/2026/0101 for AgroFresh Commodities LLP with 2 items',
      },
      {
        id: 'BKL-0005',
        timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
        userId: 'USR-01',
        userName: 'Rahul Sharma',
        userRole: 'CASHIER',
        ipAddress: '192.168.1.120',
        formName: 'Billing (POS)',
        action: 'SAVE',
        recordRef: 'INV-2026-0001',
        details: 'Saved Sales Invoice INV-2026-0001 for customer Arun Verma (Net: ₹1,050.50)',
      },
      {
        id: 'BKL-0006',
        timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
        userId: 'USR-ADMIN',
        userName: 'System Administrator',
        userRole: 'ADMINISTRATOR',
        ipAddress: '192.168.1.100',
        formName: 'Unit Master',
        action: 'DELETE',
        recordRef: 'DOZ',
        details: 'Deleted Unit: Dozen (DOZ)',
      },
      {
        id: 'BKL-0007',
        timestamp: new Date(Date.now() - 3600000 * 1).toISOString(),
        userId: 'USR-02',
        userName: 'Rajesh Patel',
        userRole: 'PURCHASE_USER',
        ipAddress: '192.168.1.112',
        formName: 'Purchase Order',
        action: 'CANCEL',
        recordRef: 'PO/2026/0099',
        details: 'Cancelled Purchase Order PO/2026/0099: Supplier notified out of stock',
      },
    ],
    settings: {
      blockNegativeStock: true,
      costingMethod: 'WEIGHTED_AVERAGE', // FIFO | WEIGHTED_AVERAGE
      allowBackdatedSales: false,
      loyaltyEarningRatio: 100, // 1 point per 100 rupees
      loyaltyRedemptionRate: 1, // 1 point = 1 rupee
      maxLoyaltyRedemptionPercent: 20, // Max 20% of invoice total
      managerApprovalThresholdQty: 10,
      managerApprovalThresholdAmount: 1000,
      defaultPOTerms: DEFAULT_PO_TERMS,
    },
    roles: INITIAL_ROLES,
    states: INITIAL_STATES,
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(initialDb));
  return initialDb;
}

export function getDatabase() {
  const db = initializeDatabase(false);
  if (!db.backlog) {
    db.backlog = [
      {
        id: 'BKL-0001',
        timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
        userId: 'USR-ADMIN',
        userName: 'System Administrator',
        userRole: 'ADMINISTRATOR',
        ipAddress: '192.168.1.100',
        formName: 'Product Master',
        action: 'SAVE',
        recordRef: 'PROD-001',
        details: 'Saved Product: Royal Heritage Basmati Rice 5kg (MRP: ₹499.00, Cost: ₹340.00)',
      },
      {
        id: 'BKL-0002',
        timestamp: new Date(Date.now() - 3600000 * 20).toISOString(),
        userId: 'USR-ADMIN',
        userName: 'System Administrator',
        userRole: 'ADMINISTRATOR',
        ipAddress: '192.168.1.100',
        formName: 'Supplier Master',
        action: 'SAVE',
        recordRef: 'SUPP-01',
        details: 'Saved Supplier: AgroFresh Commodities LLP (GSTIN: 27AAAFB1111C1Z0)',
      },
      {
        id: 'BKL-0003',
        timestamp: new Date(Date.now() - 3600000 * 16).toISOString(),
        userId: 'USR-04',
        userName: 'Anil Kapoor',
        userRole: 'STORE_MANAGER',
        ipAddress: '192.168.1.105',
        formName: 'Branch Master',
        action: 'UPDATE',
        recordRef: 'STR-01',
        details: 'Updated Branch: Apex Flagship Mumbai address & contact details',
      },
      {
        id: 'BKL-0004',
        timestamp: new Date(Date.now() - 3600000 * 8).toISOString(),
        userId: 'USR-02',
        userName: 'Rajesh Patel',
        userRole: 'PURCHASE_USER',
        ipAddress: '192.168.1.112',
        formName: 'Purchase Order',
        action: 'SAVE',
        recordRef: 'PO/2026/0101',
        details: 'Saved Purchase Order PO/2026/0101 for AgroFresh Commodities LLP with 2 items',
      },
      {
        id: 'BKL-0005',
        timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
        userId: 'USR-01',
        userName: 'Rahul Sharma',
        userRole: 'CASHIER',
        ipAddress: '192.168.1.120',
        formName: 'Billing (POS)',
        action: 'SAVE',
        recordRef: 'INV-2026-0001',
        details: 'Saved Sales Invoice INV-2026-0001 for customer Arun Verma (Net: ₹1,050.50)',
      },
      {
        id: 'BKL-0006',
        timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
        userId: 'USR-ADMIN',
        userName: 'System Administrator',
        userRole: 'ADMINISTRATOR',
        ipAddress: '192.168.1.100',
        formName: 'Unit Master',
        action: 'DELETE',
        recordRef: 'DOZ',
        details: 'Deleted Unit: Dozen (DOZ)',
      },
      {
        id: 'BKL-0007',
        timestamp: new Date(Date.now() - 3600000 * 1).toISOString(),
        userId: 'USR-02',
        userName: 'Rajesh Patel',
        userRole: 'PURCHASE_USER',
        ipAddress: '192.168.1.112',
        formName: 'Purchase Order',
        action: 'CANCEL',
        recordRef: 'PO/2026/0099',
        details: 'Cancelled Purchase Order PO/2026/0099: Supplier notified out of stock',
      },
    ];
    saveDatabase(db);
  }
  if (db.settings && !db.settings.defaultPOTerms) {
    db.settings.defaultPOTerms = DEFAULT_PO_TERMS;
    saveDatabase(db);
  }
  return db;
}

export function saveDatabase(db) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    return true;
  } catch (e) {
    console.error('Storage quota or serialization error:', e);
    return false;
  }
}

/**
 * Get or initialize client IP address for this terminal/workstation
 */
export function getClientIp() {
  let ip = null;
  try {
    ip = localStorage.getItem('nexbill_client_ip');
  } catch (e) {}

  if (!ip) {
    // Generate realistic LAN station IP for this terminal workstation
    const octet = 100 + (Math.floor(Date.now() % 50));
    ip = `192.168.1.${octet}`;
    try {
      localStorage.setItem('nexbill_client_ip', ip);
    } catch (e) {}
  }
  return ip;
}

/**
 * Configure or override terminal client IP address
 */
export function setClientIp(ip) {
  if (ip) {
    try {
      localStorage.setItem('nexbill_client_ip', ip.trim());
    } catch (e) {}
  }
}

/**
 * Record action in the Backlog table (SAVE, UPDATE, DELETE, CANCEL)
 * Captures: Which User, Which Time, Which IP, Which Form, Record Reference, and Details
 */
export function logBacklog({
  action = 'SAVE',
  formName = 'General Form',
  recordRef = '—',
  userId = null,
  userName = null,
  userRole = null,
  ipAddress = null,
  details = '',
  changes = null,
}) {
  const db = getDatabase();
  if (!db.backlog) db.backlog = [];

  const user = userId && db.users ? db.users.find((u) => u.id === userId) : null;
  const finalUserId = userId || user?.id || 'USR-ADMIN';
  const finalUserName = userName || user?.name || (finalUserId === 'USR-ADMIN' ? 'System Administrator' : 'Authorized User');
  const finalUserRole = userRole || user?.role || 'ADMINISTRATOR';
  const finalIp = ipAddress || getClientIp();

  let act = String(action || 'SAVE').toUpperCase().trim();
  if (act === 'CREATE' || act === 'INSERT' || act === 'POST') act = 'SAVE';
  if (act === 'EDIT' || act === 'MODIFY') act = 'UPDATE';
  if (act === 'REMOVE' || act === 'DROP') act = 'DELETE';
  if (act === 'VOID' || act === 'REVERSE' || act === 'REJECT') act = 'CANCEL';

  const entry = {
    id: 'BKL-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    timestamp: new Date().toISOString(),
    userId: finalUserId,
    userName: finalUserName,
    userRole: finalUserRole,
    ipAddress: finalIp,
    formName: formName || 'System Form',
    action: act, // SAVE | UPDATE | DELETE | CANCEL
    recordRef: recordRef || '—',
    details: details || `${act} operation completed on ${formName} (${recordRef})`,
    changes: changes || null,
  };

  db.backlog.unshift(entry);
  if (db.backlog.length > 2000) {
    db.backlog = db.backlog.slice(0, 2000);
  }
  saveDatabase(db);
  return entry;
}

export function logAuditEvent(action, userId, details) {
  const db = getDatabase();
  const entry = {
    id: 'AUD-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    timestamp: new Date().toISOString(),
    action,
    userId: userId || 'SYSTEM',
    details,
  };
  db.auditLogs.unshift(entry);
  if (db.auditLogs.length > 500) {
    db.auditLogs = db.auditLogs.slice(0, 500);
  }
  saveDatabase(db);
  return entry;
}
