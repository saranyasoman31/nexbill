// MasterEntitiesView: Comprehensive Master Data Management for all core ERP business entities
import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { saveDatabase, logAuditEvent, logBacklog } from '../../services/storageService.js';
import { INITIAL_STATES } from '../../data/initialData.js';
import {
  Layers,
  FolderTree,
  Tag,
  Truck,
  Scale,
  Package,
  Users,
  CreditCard,
  Percent,
  Store,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  X,
  Save,
  ShieldCheck,
  ShieldAlert,
  Printer,
  User,
  Briefcase,
  KeyRound,
  UserX,
  Calendar,
  Mail,
  Phone,
  Eye,
  EyeOff,
  AlertOctagon,
  Camera,
  Upload,
  Image as ImageIcon,
  Lock,
  Landmark,
  MapPin,
  Globe,
  ChevronDown,
  Check,
  Building2,
} from 'lucide-react';
import ExportButtons from '../common/ExportButtons.jsx';

// Reusable Multi-Select Dropdown for Multiple Brand and Supplier Selection
function MultiSelectDropdown({ label, options, selectedValues = [], onChange, placeholder, emptyText }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filteredOptions = options.filter((opt) =>
    (opt.label || opt.name || opt.value || '').toLowerCase().includes(query.toLowerCase())
  );

  const toggleValue = (val) => {
    if (selectedValues.includes(val)) {
      onChange(selectedValues.filter((v) => v !== val));
    } else {
      onChange([...selectedValues, val]);
    }
  };

  const removeValue = (val, e) => {
    e.stopPropagation();
    onChange(selectedValues.filter((v) => v !== val));
  };

  return (
    <div className="space-y-1 relative">
      <div className="flex items-center justify-between">
        <label className="font-semibold text-slate-300 block">{label}</label>
        {selectedValues.length > 0 && (
          <span className="text-[10px] text-indigo-400 font-medium font-mono">
            {selectedValues.length} selected
          </span>
        )}
      </div>

      <div
        onClick={() => setIsOpen(!isOpen)}
        className="min-h-[40px] w-full bg-slate-950 border border-slate-700 hover:border-slate-600 rounded-lg px-2.5 py-1.5 cursor-pointer flex flex-wrap items-center gap-1.5 text-xs focus-within:border-indigo-500 transition"
      >
        {selectedValues.length === 0 ? (
          <span className="text-slate-500 py-0.5">{placeholder || 'Select...'}</span>
        ) : (
          selectedValues.map((val) => {
            const opt = options.find((o) => (o.value || o.id || o.name) === val) || { label: val };
            return (
              <span
                key={val}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-950/80 text-indigo-200 border border-indigo-800/80 text-[11px] font-medium"
              >
                <span>{opt.chipLabel || opt.label || opt.name || val}</span>
                <span
                  role="button"
                  onClick={(e) => removeValue(val, e)}
                  className="hover:text-white rounded-full p-0.5 hover:bg-indigo-900 transition"
                >
                  <X className="w-2.5 h-2.5" />
                </span>
              </span>
            );
          })
        )}
        <div className="ml-auto pl-1 text-slate-400">
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2.5 space-y-2 max-h-56 overflow-y-auto scrollbar-thin">
            {options.length > 4 && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter options..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:border-indigo-500"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}
            <div className="flex items-center justify-between px-1 text-[11px] text-slate-400 border-b border-slate-800 pb-1.5">
              <span>{selectedValues.length} of {options.length} selected</span>
              <div className="space-x-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(options.map((o) => o.value || o.id || o.name));
                  }}
                  className="text-indigo-400 hover:text-indigo-300 font-semibold"
                >
                  Select All
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange([]);
                  }}
                  className="text-rose-400 hover:text-rose-300 font-semibold"
                >
                  Clear All
                </button>
              </div>
            </div>
            <div className="space-y-1">
              {filteredOptions.length === 0 ? (
                <div className="text-center py-3 text-slate-500 text-xs italic">{emptyText || 'No options match filter'}</div>
              ) : (
                filteredOptions.map((opt) => {
                  const val = opt.value || opt.id || opt.name;
                  const isChecked = selectedValues.includes(val);
                  return (
                    <div
                      key={val}
                      onClick={() => toggleValue(val)}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer text-xs transition ${
                        isChecked
                          ? 'bg-indigo-950/70 text-indigo-200 font-medium'
                          : 'hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition ${
                            isChecked
                              ? 'bg-indigo-600 border-indigo-500 text-white'
                              : 'border-slate-600 bg-slate-950'
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3 stroke-[2.5]" />}
                        </div>
                        <span>{opt.label || opt.name}</span>
                      </div>
                      {opt.subtext && <span className="text-[10px] text-slate-400 font-mono ml-2">{opt.subtext}</span>}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function MasterEntitiesView({ defaultEntity = 'product' }) {
  const { db, currentUser, notify, triggerRefresh, hasPermission } = useApp();

  const [activeEntity, setActiveEntity] = useState(defaultEntity);
  const [search, setSearch] = useState('');
  const [supplierSupplyFilter, setSupplierSupplyFilter] = useState('ALL'); // ALL | LOCAL | INTERSTATE
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Staff Form Tab State (personal | employment | credentials | discontinue)
  const [staffFormTab, setStaffFormTab] = useState('personal');
  const [showStaffPassword, setShowStaffPassword] = useState(false);

  // Sync prop changes
  useEffect(() => {
    if (defaultEntity) {
      setActiveEntity(defaultEntity);
    }
  }, [defaultEntity]);

  // Master Entity Definitions
  const ENTITY_CONFIG = {
    main_category: {
      label: 'Main Category',
      title: 'Main Categories Master',
      icon: Layers,
      color: 'text-indigo-400',
      dataKey: 'mainCategories',
      idPrefix: 'MCAT',
      columns: ['Code', 'Name', 'Description', 'Status'],
    },
    category: {
      label: 'Category',
      title: 'Categories & Sub-Categories Master',
      icon: FolderTree,
      color: 'text-purple-400',
      dataKey: 'categories',
      idPrefix: 'CAT',
      columns: ['Code', 'Category Name', 'Main Category', 'HSN Code', 'Default GST %', 'Status'],
    },
    brand: {
      label: 'Brand',
      title: 'Brands & Manufacturers Master',
      icon: Tag,
      color: 'text-amber-400',
      dataKey: 'brands',
      idPrefix: 'BRD',
      columns: ['Code', 'Brand Name', 'Manufacturer', 'Country', 'Status'],
    },
    supplier: {
      label: 'Supplier',
      title: 'Suppliers & Vendors Master',
      icon: Truck,
      color: 'text-blue-400',
      dataKey: 'suppliers',
      idPrefix: 'SUPP',
      columns: [
        'Supplier Name',
        'Code',
        'Contact Person',
        'Mobile / Email',
        'GSTIN',
        'Local / Interstate',
        'State / District',
        'Bank Details',
        'Opening Balance',
        'Status',
      ],
    },
    unit: {
      label: 'Unit',
      title: 'Units of Measurement (UOM) Master',
      icon: Scale,
      color: 'text-emerald-400',
      dataKey: 'units',
      idPrefix: 'UNT',
      columns: ['UOM Code', 'Unit Name', 'Decimal Allowed', 'Description', 'Status'],
    },
    company: {
      label: 'Company',
      title: 'Company & Manufacturer Master',
      icon: Building2,
      color: 'text-sky-400',
      dataKey: 'companies',
      idPrefix: 'COMP',
      columns: ['Company Code', 'Company Name', 'MFG / Details', 'Contact', 'Address', 'Status'],
    },
    product: {
      label: 'Product',
      title: 'Products & Inventory Catalog Master',
      icon: Package,
      color: 'text-cyan-400',
      dataKey: 'products',
      idPrefix: 'PROD',
      columns: [
        'SKU / Barcode',
        'Product Name & Brand',
        'Main Category / Category',
        'HSN',
        'Tax & Type',
        'Stock Type & Saleable',
        'Reorder & Expiry',
        'Status',
      ],
    },
    staff: {
      label: 'Staff',
      title: 'Staff, Employees & System Users Master',
      icon: Users,
      color: 'text-violet-400',
      dataKey: 'users',
      idPrefix: 'USR',
      columns: ['Staff / Employee', 'Role & Designation', 'Store / Branch', 'Contact & Login', 'Tenure & Discontinue', 'Status'],
    },
    payment_mode: {
      label: 'Payment Mode',
      title: 'Payment Modes & Tender Types Master',
      icon: CreditCard,
      color: 'text-rose-400',
      dataKey: 'paymentModes',
      idPrefix: 'PAY',
      columns: ['Mode Code', 'Display Name', 'Tender Type', 'Status'],
    },
    tax: {
      label: 'Tax',
      title: 'Tax Slabs & International VAT/GST Master',
      icon: Percent,
      color: 'text-emerald-400',
      dataKey: 'taxes',
      idPrefix: 'TAX',
      columns: ['Tax Rate %', 'Tax Regime / Model', 'CGST %', 'SGST %', 'IGST / Total %', 'Status'],
    },
    branch: {
      label: 'Branch',
      title: 'Stores & Branches Master',
      icon: Store,
      color: 'text-yellow-400',
      dataKey: 'stores',
      idPrefix: 'STR',
      columns: ['Branch Code', 'Branch / Store Name', 'City', 'State', 'GSTIN', 'Day Status', 'Status'],
    },
  };

  const currentConfig = ENTITY_CONFIG[activeEntity] || ENTITY_CONFIG.product;
  const rawList = db[currentConfig.dataKey] || [];

  // Granular action authorization
  const canView = hasPermission(activeEntity, 'view');
  const canAdd = hasPermission(activeEntity, 'add');
  const canUpdate = hasPermission(activeEntity, 'update');
  const canDelete = hasPermission(activeEntity, 'delete');
  const canPrint = hasPermission(activeEntity, 'print');

  // Filter items
  const filteredList = rawList.filter((item) => {
    const q = search.toLowerCase();
    const matchesSearch = Object.values(item).some((val) => typeof val === 'string' && val.toLowerCase().includes(q));
    if (activeEntity === 'supplier' && supplierSupplyFilter !== 'ALL') {
      const sType = item.supplyType || (item.stateCode !== '27' ? 'INTERSTATE' : 'LOCAL');
      return matchesSearch && sType === supplierSupplyFilter;
    }
    return matchesSearch;
  });

  const getExportData = () => {
    return filteredList.map((item, idx) => {
      if (activeEntity === 'main_category') {
        return {
          '#': idx + 1,
          'Code': item.code,
          'Name': item.name,
          'Description': item.description || '',
          'Status': item.active !== false ? 'Active' : 'Inactive',
        };
      }
      if (activeEntity === 'category') {
        return {
          '#': idx + 1,
          'Code': item.code,
          'Category Name': item.name,
          'Main Category': db.mainCategories?.find((m) => m.id === item.mainCategoryId)?.name || 'General',
          'HSN Code': item.hsnCode || '',
          'Default GST %': `${item.defaultTaxRate || 5}%`,
          'Status': item.active !== false ? 'Active' : 'Inactive',
        };
      }
      if (activeEntity === 'brand') {
        return {
          '#': idx + 1,
          'Code': item.code || '',
          'Brand Name': item.name,
          'Manufacturer': item.manufacturer || '',
          'Country': item.country || 'India',
          'Status': item.active !== false ? 'Active' : 'Inactive',
        };
      }
      if (activeEntity === 'supplier') {
        return {
          '#': idx + 1,
          'Supplier Name': item.name,
          'Code': item.code || item.id,
          'Contact Person': item.contactPerson || '',
          'Mobile': item.phone || '',
          'Email': item.email || '',
          'GSTIN': item.gstin || '',
          'Local / Interstate': item.supplyType || (item.stateCode !== '27' ? 'INTERSTATE' : 'LOCAL'),
          'State': item.state || '',
          'State Code': item.stateCode || '',
          'District': item.district || '',
          'City': item.city || '',
          'Bank Name': item.bankName || '',
          'Account Number': item.accountNumber || '',
          'IFSC Code': item.ifscCode || '',
          'Branch': item.branchName || '',
          'Opening Balance (₹)': Number(item.openingBalance || 0).toFixed(2),
          'Status': item.active !== false ? 'Active' : 'Inactive',
        };
      }
      if (activeEntity === 'unit') {
        return {
          '#': idx + 1,
          'UOM Code': item.code,
          'Unit Name': item.name,
          'Decimal Allowed': item.allowDecimal ? 'Yes' : 'No',
          'Description': item.description || '',
          'Status': item.active !== false ? 'Active' : 'Inactive',
        };
      }
      if (activeEntity === 'company') {
        const linkedCount = (db.products || []).filter(
          (p) => p.companyId === item.id || p.company === item.name || (p.companyCode && p.companyCode === item.code)
        ).length;
        return {
          '#': idx + 1,
          'Company Code': item.code || item.id,
          'Company Name': item.name,
          'MFG / Details': item.mfg || '',
          'Contact': item.contact || item.phone || '',
          'Address': item.address || '',
          'Linked Products': linkedCount,
          'Status': item.active !== false ? 'Active' : 'Inactive',
        };
      }
      if (activeEntity === 'product') {
        const brandStr = Array.isArray(item.brands) && item.brands.length > 0 ? item.brands.join(', ') : (item.brand || 'Standard');
        const supplierStr = Array.isArray(item.suppliers) && item.suppliers.length > 0 ? item.suppliers.join(', ') : (item.supplier || '');
        const mainCatStr = item.mainCategory || db.mainCategories?.find((m) => m.id === item.mainCategoryId)?.name || 'General';
        const companyStr = item.company || (db.companies || []).find((c) => c.id === item.companyId)?.name || 'None';
        const hasStock = item.hasStock !== false && !item.isService;
        return {
          '#': idx + 1,
          'SKU': item.sku,
          'Barcode': item.barcode || '',
          'Product Name': item.name,
          'Company': companyStr,
          'Brand(s)': brandStr,
          'Supplier(s)': supplierStr,
          'Main Category': mainCatStr,
          'Category': item.category,
          'HSN / SAC': item.hsnCode || item.hsn || '',
          'Tax Type': item.taxType || 'inclusive',
          'Tax Rate': `${item.taxType === 'non-tax' ? 0 : (item.taxRate || 0)}%`,
          'Stock Type': hasStock ? 'Physical Stock' : 'Non-Stock / Service',
          'Saleable': item.isSaleable !== false ? 'Yes' : 'No',
          'Expiry Tracking': item.hasExpiryDate ? 'Yes' : 'No',
          'Reorder Level': hasStock ? (item.reorderLevel ?? item.minStockAlert ?? 10) : 'N/A',
          'UOM': item.uom || 'Pcs',
          'Status': item.active !== false ? 'Active' : 'Inactive',
        };
      }
      if (activeEntity === 'staff') {
        const roleName = db.roles?.find((r) => r.id === item.roleId)?.name || item.role;
        return {
          '#': idx + 1,
          'Employee ID': item.employeeId || item.id,
          'Full Name': item.name,
          'Designation': item.designation || 'Staff',
          'Role': roleName,
          'Assigned Store': db.stores?.find((s) => s.id === item.storeId)?.name || 'Default Store',
          'Phone': item.phone || '',
          'Email / Username': item.email || item.username,
          'Employment Status': item.employmentStatus || 'ACTIVE',
          'Join Date': item.joiningDate || '',
          'Status': item.active !== false ? 'Active' : 'Inactive',
        };
      }
      if (activeEntity === 'payment_mode') {
        const isCredit =
          item.tenderType === 'credit' ||
          item.isCredit ||
          (item.code || '').toUpperCase().includes('CREDIT') ||
          (item.name || '').toLowerCase().includes('credit');
        const tenderTypeLabel = isCredit
          ? 'Credit / On-Account'
          : item.isElectronic || item.tenderType === 'electronic'
          ? 'Electronic / Digital'
          : 'Cash / Physical';
        return {
          '#': idx + 1,
          'Mode Code': item.code,
          'Display Name': item.name,
          'Tender Type': tenderTypeLabel,
          'Status': item.active !== false ? 'Active' : 'Inactive',
        };
      }
      if (activeEntity === 'tax') {
        const isGst = item.taxType === 'GST' || (item.cgst > 0 || item.sgst > 0);
        return {
          '#': idx + 1,
          'Tax Rate %': `${item.rate}%`,
          'Tax Regime / Model': isGst ? 'Dual GST (India)' : 'Single VAT / Tax (Outside India)',
          'CGST %': isGst ? `${item.cgst ?? item.rate / 2}%` : 'N/A',
          'SGST %': isGst ? `${item.sgst ?? item.rate / 2}%` : 'N/A',
          'IGST / Total %': `${item.igst || item.rate}%`,
          'Status': item.active !== false ? 'Active' : 'Inactive',
        };
      }
      if (activeEntity === 'branch') {
        return {
          '#': idx + 1,
          'Branch Code': item.code,
          'Branch Name': item.name,
          'City': item.city || '',
          'State': item.state || '',
          'GSTIN': item.gstin || '',
          'Status': item.active !== false ? 'Active' : 'Inactive',
        };
      }
      return {
        '#': idx + 1,
        'Name': item.name || item.code || item.id,
        'Status': item.active !== false ? 'Active' : 'Inactive',
      };
    });
  };

  // Modal Form State
  const [formData, setFormData] = useState({});

  // Real-time duplicate checking for Main Category (case-insensitive, trimmed, self-exclusion on edit)
  const isMainCatCodeDuplicate =
    activeEntity === 'main_category' &&
    Boolean(
      (formData.code || '').trim() &&
        (db.mainCategories || []).some(
          (mc) =>
            mc.id !== editingItem?.id &&
            (mc.code || '').trim().toLowerCase() === (formData.code || '').trim().toLowerCase()
        )
    );

  const isMainCatNameDuplicate =
    activeEntity === 'main_category' &&
    Boolean(
      (formData.name || '').trim() &&
        (db.mainCategories || []).some(
          (mc) =>
            mc.id !== editingItem?.id &&
            (mc.name || '').trim().toLowerCase() === (formData.name || '').trim().toLowerCase()
        )
    );

  // Real-time duplicate checking for Category Code (case-insensitive, trimmed, self-exclusion on edit)
  const isCatCodeDuplicate =
    activeEntity === 'category' &&
    Boolean(
      (formData.code || '').trim() &&
        (db.categories || []).some(
          (c) =>
            c.id !== editingItem?.id &&
            (c.code || '').trim().toLowerCase() === (formData.code || '').trim().toLowerCase()
        )
    );

  // Real-time duplicate checking: Same category name under same main category not allowed
  const isCatNameInMainCatDuplicate =
    activeEntity === 'category' &&
    Boolean(
      (formData.name || '').trim() &&
        (formData.mainCategoryId || db.mainCategories?.[0]?.id) &&
        (db.categories || []).some(
          (c) =>
            c.id !== editingItem?.id &&
            c.mainCategoryId === (formData.mainCategoryId || db.mainCategories?.[0]?.id) &&
            (c.name || '').trim().toLowerCase() === (formData.name || '').trim().toLowerCase()
        )
    );

  // Helper to identify products linked to a Category (by id, code, or name)
  const getProductsLinkedToCategory = (catItem, productsList = db.products || []) => {
    if (!catItem) return [];
    const catName = (catItem.name || '').trim().toLowerCase();
    const catCode = (catItem.code || '').trim().toLowerCase();
    const catId = (catItem.id || '').trim().toLowerCase();

    return (productsList || []).filter((p) => {
      const prodCat = (p.category || '').trim().toLowerCase();
      const prodCatId = (p.categoryId || '').trim().toLowerCase();

      if (catId && (prodCatId === catId || prodCat === catId)) return true;
      if (catCode && prodCat === catCode) return true;
      if (catName && prodCat === catName) return true;
      if (catName && prodCat && (catName.includes(prodCat) || prodCat.includes(catName))) return true;
      return false;
    });
  };

  // Real-time duplicate checking for Brand Code (case-insensitive, trimmed, self-exclusion on edit)
  const isBrandCodeDuplicate =
    activeEntity === 'brand' &&
    Boolean(
      (formData.code || '').trim() &&
        (db.brands || []).some(
          (b) =>
            b.id !== editingItem?.id &&
            (b.code || '').trim().toLowerCase() === (formData.code || '').trim().toLowerCase()
        )
    );

  // Real-time duplicate checking for Brand Name (case-insensitive, trimmed, self-exclusion on edit)
  const isBrandNameDuplicate =
    activeEntity === 'brand' &&
    Boolean(
      (formData.name || '').trim() &&
        (db.brands || []).some(
          (b) =>
            b.id !== editingItem?.id &&
            (b.name || '').trim().toLowerCase() === (formData.name || '').trim().toLowerCase()
        )
    );

  // Helper to identify products linked to a Brand (by id, code, or name, including multiple brands array)
  const getProductsLinkedToBrand = (brandItem, productsList = db.products || []) => {
    if (!brandItem) return [];
    const bName = (brandItem.name || '').trim().toLowerCase();
    const bCode = (brandItem.code || '').trim().toLowerCase();
    const bId = (brandItem.id || '').trim().toLowerCase();

    return (productsList || []).filter((p) => {
      const pBrand = (p.brand || '').trim().toLowerCase();
      const pBrandId = (p.brandId || '').trim().toLowerCase();
      const pBrands = Array.isArray(p.brands) ? p.brands.map((b) => (b || '').trim().toLowerCase()) : [];

      if (bId && (pBrandId === bId || pBrand === bId || pBrands.includes(bId))) return true;
      if (bCode && (pBrand === bCode || pBrands.includes(bCode))) return true;
      if (bName && (pBrand === bName || pBrands.includes(bName))) return true;
      return false;
    });
  };

  // Real-time duplicate checking for Unit Code (case-insensitive, trimmed, self-exclusion on edit)
  const isUnitCodeDuplicate =
    activeEntity === 'unit' &&
    Boolean(
      (formData.code || '').trim() &&
        (db.units || []).some(
          (u) =>
            u.id !== editingItem?.id &&
            (u.code || '').trim().toLowerCase() === (formData.code || '').trim().toLowerCase()
        )
    );

  const duplicateUnitByCode =
    isUnitCodeDuplicate &&
    (db.units || []).find(
      (u) =>
        u.id !== editingItem?.id &&
        (u.code || '').trim().toLowerCase() === (formData.code || '').trim().toLowerCase()
    );

  // Real-time duplicate checking for Unit Name (case-insensitive, trimmed, self-exclusion on edit)
  const isUnitNameDuplicate =
    activeEntity === 'unit' &&
    Boolean(
      (formData.name || '').trim() &&
        (db.units || []).some(
          (u) =>
            u.id !== editingItem?.id &&
            (u.name || '').trim().toLowerCase() === (formData.name || '').trim().toLowerCase()
        )
    );

  const duplicateUnitByName =
    isUnitNameDuplicate &&
    (db.units || []).find(
      (u) =>
        u.id !== editingItem?.id &&
        (u.name || '').trim().toLowerCase() === (formData.name || '').trim().toLowerCase()
    );

  // Helper to identify products linked to a Unit (by id, code, or name)
  const getProductsLinkedToUnit = (unitItem, productsList = db.products || []) => {
    if (!unitItem) return [];
    const uName = (unitItem.name || '').trim().toLowerCase();
    const uCode = (unitItem.code || '').trim().toLowerCase();
    const uId = (unitItem.id || '').trim().toLowerCase();

    return (productsList || []).filter((p) => {
      const pUom = (p.uom || '').trim().toLowerCase();
      const pUnitId = (p.unitId || '').trim().toLowerCase();

      if (uId && (pUnitId === uId || pUom === uId)) return true;
      if (uCode && pUom === uCode) return true;
      if (uName && pUom === uName) return true;
      return false;
    });
  };

  // Real-time duplicate checking for Company Code (case-insensitive, trimmed, self-exclusion on edit)
  const isCompanyCodeDuplicate =
    activeEntity === 'company' &&
    Boolean(
      (formData.code || '').trim() &&
        (db.companies || []).some(
          (c) =>
            c.id !== editingItem?.id &&
            (c.code || '').trim().toLowerCase() === (formData.code || '').trim().toLowerCase()
        )
    );

  const duplicateCompanyByCode =
    isCompanyCodeDuplicate &&
    (db.companies || []).find(
      (c) =>
        c.id !== editingItem?.id &&
        (c.code || '').trim().toLowerCase() === (formData.code || '').trim().toLowerCase()
    );

  // Real-time duplicate checking for Company Name (case-insensitive, trimmed, self-exclusion on edit)
  const isCompanyNameDuplicate =
    activeEntity === 'company' &&
    Boolean(
      (formData.name || '').trim() &&
        (db.companies || []).some(
          (c) =>
            c.id !== editingItem?.id &&
            (c.name || '').trim().toLowerCase() === (formData.name || '').trim().toLowerCase()
        )
    );

  const duplicateCompanyByName =
    isCompanyNameDuplicate &&
    (db.companies || []).find(
      (c) =>
        c.id !== editingItem?.id &&
        (c.name || '').trim().toLowerCase() === (formData.name || '').trim().toLowerCase()
    );

  // Helper to identify products linked to a Company (by id, code, or name)
  const getProductsLinkedToCompany = (companyItem, productsList = db.products || []) => {
    if (!companyItem) return [];
    const cId = (companyItem.id || '').trim().toLowerCase();
    const cName = (companyItem.name || '').trim().toLowerCase();
    const cCode = (companyItem.code || '').trim().toLowerCase();

    return (productsList || []).filter((p) => {
      const pCompId = (p.companyId || '').trim().toLowerCase();
      const pCompName = (p.company || p.companyName || '').trim().toLowerCase();
      const pCompCode = (p.companyCode || '').trim().toLowerCase();

      if (cId && pCompId === cId) return true;
      if (cCode && (pCompCode === cCode || pCompId === cCode)) return true;
      if (cName && (pCompName === cName || pCompId === cName)) return true;
      return false;
    });
  };

  const statesList = db?.states && db.states.length > 0 ? db.states : INITIAL_STATES;

  // Real-time duplicate checking for Supplier Mobile Number (case-insensitive & trimmed digits, mandatory 10 digits, self-exclusion on edit)
  const supplierPhoneCleaned = (formData.phone || '').replace(/\D/g, '').slice(-10);
  const isSupplierPhoneDuplicate =
    activeEntity === 'supplier' &&
    Boolean(
      supplierPhoneCleaned.length === 10 &&
        (db.suppliers || []).some(
          (s) =>
            s.id !== editingItem?.id &&
            (s.phone || '').replace(/\D/g, '').slice(-10) === supplierPhoneCleaned
        )
    );

  const duplicateSupplier =
    isSupplierPhoneDuplicate
      ? (db.suppliers || []).find(
          (s) =>
            s.id !== editingItem?.id &&
            (s.phone || '').replace(/\D/g, '').slice(-10) === supplierPhoneCleaned
        )
      : null;

  const isSupplierPhoneIncomplete =
    activeEntity === 'supplier' &&
    Boolean((formData.phone || '').trim() && supplierPhoneCleaned.length > 0 && supplierPhoneCleaned.length < 10);

  const isSupplierEmailInvalid =
    activeEntity === 'supplier' &&
    Boolean(
      formData.email &&
        formData.email.trim() &&
        !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(formData.email.trim())
    );

  // Real-time duplicate checking for Payment Mode Code (case-insensitive, trimmed, self-exclusion on edit)
  const isPaymentModeCodeDuplicate =
    activeEntity === 'payment_mode' &&
    Boolean(
      (formData.code || '').trim() &&
        (db.paymentModes || []).some(
          (pm) =>
            pm.id !== editingItem?.id &&
            (pm.code || '').trim().toLowerCase() === (formData.code || '').trim().toLowerCase()
        )
    );

  const duplicatePaymentModeByCode =
    isPaymentModeCodeDuplicate &&
    (db.paymentModes || []).find(
      (pm) =>
        pm.id !== editingItem?.id &&
        (pm.code || '').trim().toLowerCase() === (formData.code || '').trim().toLowerCase()
    );

  // Real-time duplicate checking for Payment Mode Name (case-insensitive, trimmed, self-exclusion on edit)
  const isPaymentModeNameDuplicate =
    activeEntity === 'payment_mode' &&
    Boolean(
      (formData.name || '').trim() &&
        (db.paymentModes || []).some(
          (pm) =>
            pm.id !== editingItem?.id &&
            (pm.name || '').trim().toLowerCase() === (formData.name || '').trim().toLowerCase()
        )
    );

  const duplicatePaymentModeByName =
    isPaymentModeNameDuplicate &&
    (db.paymentModes || []).find(
      (pm) =>
        pm.id !== editingItem?.id &&
        (pm.name || '').trim().toLowerCase() === (formData.name || '').trim().toLowerCase()
    );

  // Helper to identify invoices linked to a Payment Mode
  const getInvoicesLinkedToPaymentMode = (pmItem, invoicesList = db.invoices || []) => {
    if (!pmItem) return [];
    const pmCode = (pmItem.code || '').trim().toUpperCase();
    const pmName = (pmItem.name || '').trim().toLowerCase();
    const pmId = (pmItem.id || '').trim();

    return (invoicesList || []).filter((inv) =>
      (inv.tenders || []).some(
        (t) =>
          (t.method && t.method.toUpperCase() === pmCode) ||
          (t.paymentModeId && t.paymentModeId === pmId) ||
          (t.method && t.method.toLowerCase() === pmName)
      )
    );
  };

  // Real-time duplicate checking for Tax Rate % under same Tax Regime
  const isTaxRateDuplicate =
    activeEntity === 'tax' &&
    Boolean(
      formData.rate !== undefined &&
        formData.rate !== '' &&
        !isNaN(Number(formData.rate)) &&
        (db.taxes || []).some(
          (t) =>
            t.id !== editingItem?.id &&
            Number(t.rate) === Number(formData.rate) &&
            (t.taxType || ((t.cgst > 0 || t.sgst > 0) ? 'GST' : 'VAT')) === (formData.taxType || 'VAT')
        )
    );

  const duplicateTaxByRate =
    isTaxRateDuplicate &&
    (db.taxes || []).find(
      (t) =>
        t.id !== editingItem?.id &&
        Number(t.rate) === Number(formData.rate) &&
        (t.taxType || ((t.cgst > 0 || t.sgst > 0) ? 'GST' : 'VAT')) === (formData.taxType || 'VAT')
    );

  // Real-time duplicate checking for Branch Code (case-insensitive, exclude self)
  const isBranchCodeDuplicate =
    activeEntity === 'branch' &&
    Boolean(
      formData.code &&
        formData.code.trim() &&
        (db.stores || []).some(
          (s) =>
            s.id !== editingItem?.id &&
            (s.code || '').trim().toLowerCase() === (formData.code || '').trim().toLowerCase()
        )
    );

  const duplicateBranchByCode =
    isBranchCodeDuplicate &&
    (db.stores || []).find(
      (s) =>
        s.id !== editingItem?.id &&
        (s.code || '').trim().toLowerCase() === (formData.code || '').trim().toLowerCase()
    );

  // Real-time duplicate checking for Branch Name (case-insensitive, exclude self)
  const isBranchNameDuplicate =
    activeEntity === 'branch' &&
    Boolean(
      formData.name &&
        formData.name.trim() &&
        (db.stores || []).some(
          (s) =>
            s.id !== editingItem?.id &&
            (s.name || '').trim().toLowerCase() === (formData.name || '').trim().toLowerCase()
        )
    );

  const duplicateBranchByName =
    isBranchNameDuplicate &&
    (db.stores || []).find(
      (s) =>
        s.id !== editingItem?.id &&
        (s.name || '').trim().toLowerCase() === (formData.name || '').trim().toLowerCase()
    );

  // Real-time duplicate checking for Product SKU (case-insensitive, trimmed, self-exclusion on edit)
  const isProductSkuDuplicate =
    activeEntity === 'product' &&
    Boolean(
      (formData.sku || '').trim() &&
        (db.products || []).some(
          (p) =>
            p.id !== editingItem?.id &&
            (p.sku || '').trim().toUpperCase() === (formData.sku || '').trim().toUpperCase()
        )
    );

  const duplicateProductBySku =
    isProductSkuDuplicate &&
    (db.products || []).find(
      (p) =>
        p.id !== editingItem?.id &&
        (p.sku || '').trim().toUpperCase() === (formData.sku || '').trim().toUpperCase()
    );

  // Real-time duplicate checking for Product Name (case-insensitive, trimmed, self-exclusion on edit)
  const isProductNameDuplicate =
    activeEntity === 'product' &&
    Boolean(
      (formData.name || '').trim() &&
        (db.products || []).some(
          (p) =>
            p.id !== editingItem?.id &&
            (p.name || '').trim().toLowerCase() === (formData.name || '').trim().toLowerCase()
        )
    );

  const duplicateProductByName =
    isProductNameDuplicate &&
    (db.products || []).find(
      (p) =>
        p.id !== editingItem?.id &&
        (p.name || '').trim().toLowerCase() === (formData.name || '').trim().toLowerCase()
    );

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 3 * 1024 * 1024) {
        notify('warning', 'Profile photo size exceeds 3MB. Please select a smaller image.', 'File Size Warning');
      }
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        setFormData((prev) => ({ ...prev, photo: uploadEvent.target.result }));
        notify('success', 'Profile photo uploaded successfully.', 'Photo Ready');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleOpenAdd = () => {
    setEditingItem(null);
    if (activeEntity === 'main_category') {
      setFormData({ name: '', code: '', description: '', active: true });
    } else if (activeEntity === 'category') {
      setFormData({
        mainCategoryId: db.mainCategories?.[0]?.id || 'MCAT-01',
        name: '',
        code: '',
        hsnCode: '',
        defaultTaxRate: 5,
        active: true,
      });
    } else if (activeEntity === 'brand') {
      setFormData({ name: '', code: '', manufacturer: '', country: 'India', active: true });
    } else if (activeEntity === 'supplier') {
      const defState = statesList.find((s) => s.code === '27') || { code: '27', name: 'Maharashtra' };
      setFormData({
        name: '',
        code: `SUPP-${String((db.suppliers || []).length + 1).padStart(2, '0')}`,
        contactPerson: '',
        phone: '',
        email: '',
        gstin: '',
        supplyType: 'LOCAL',
        state: defState.name,
        stateCode: defState.code,
        district: 'Mumbai City',
        city: 'Mumbai',
        address: '',
        openingBalance: 0,
        bankName: '',
        accountNumber: '',
        ifscCode: '',
        branchName: '',
        accountHolderName: '',
        active: true,
      });
    } else if (activeEntity === 'unit') {
      setFormData({ name: '', code: '', description: '', allowDecimal: false, active: true });
    } else if (activeEntity === 'company') {
      setFormData({
        name: '',
        code: `CMP-${String((db.companies || []).length + 1).padStart(3, '0')}`,
        mfg: '',
        contact: '',
        address: '',
        active: true,
      });
    } else if (activeEntity === 'product') {
      const firstMainCat = db.mainCategories?.[0] || { id: 'MCAT-01', name: 'Food & Grocery' };
      const subCats = (db.categories || []).filter(
        (c) => c.mainCategoryId === firstMainCat.id || (firstMainCat.name && c.mainCategory === firstMainCat.name)
      );
      const defaultCat = subCats[0] || db.categories?.[0] || { name: 'Rice & Grains', hsnCode: '1006', defaultTaxRate: 5 };
      const defaultBrand = db.brands?.[0]?.name || 'Royal Heritage';
      const defaultSupplier = db.suppliers?.[0] || { id: 'SUPP-01', name: 'Apex Wholesale Ltd' };

      setFormData({
        sku: `SKU-${String((db.products || []).length + 1).padStart(3, '0')}`,
        barcode: '',
        name: '',
        companyId: '',
        company: '',
        companyCode: '',
        mainCategoryId: firstMainCat.id,
        mainCategory: firstMainCat.name,
        category: defaultCat.name,
        categoryId: defaultCat.id,
        brands: defaultBrand ? [defaultBrand] : [],
        brand: defaultBrand || '',
        supplierIds: defaultSupplier ? [defaultSupplier.id] : [],
        suppliers: defaultSupplier ? [defaultSupplier.name] : [],
        supplier: defaultSupplier?.name || '',
        hsnCode: defaultCat.hsnCode || '1006',
        taxType: 'inclusive',
        taxRate: defaultCat.defaultTaxRate !== undefined ? defaultCat.defaultTaxRate : 5,
        uom: db.units?.[0]?.code || 'Pcs',
        hasStock: true,
        isSaleable: true,
        hasExpiryDate: false,
        reorderLevel: 10,
        minStockAlert: 10,
        // Background defaults (rates removed from form)
        costRate: 0,
        mrp: 0,
        sellingRate: 0,
        active: true,
      });
    } else if (activeEntity === 'staff') {
      setStaffFormTab('personal');
      setShowStaffPassword(false);
      setFormData({
        // Profile Photo
        photo: '',
        // Personal Details
        name: '',
        gender: 'Male',
        dob: '',
        phone: '',
        altPhone: '',
        personalEmail: '',
        address: '',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '',
        nationalId: '',
        // Employment Details
        employeeCode: `EMP-${String((db.users || []).length + 1).padStart(3, '0')}`,
        storeId: db.stores?.[0]?.id || 'STR-01',
        designation: 'Cashier / POS Operator',
        dateOfJoining: new Date().toISOString().split('T')[0],
        employmentType: 'Full-Time',
        basicPay: '',
        // Login Credentials
        username: '',
        email: '',
        password: 'password123',
        role: 'CASHIER',
        roleId: 'ROLE_CASHIER',
        terminalAccess: true,
        // Discontinue Details
        isDiscontinued: false,
        discontinueDate: '',
        discontinueReason: '',
        clearanceStatus: 'Pending',
        discontinueRemarks: '',
        blockLogin: false,
        active: true,
      });
    } else if (activeEntity === 'payment_mode') {
      setFormData({ name: '', code: '', tenderType: 'cash', isElectronic: false, isCredit: false, active: true });
    } else if (activeEntity === 'tax') {
      setFormData({ rate: 5, taxType: 'VAT', cgst: 0, sgst: 0, igst: 5, cess: 0, active: true });
    } else if (activeEntity === 'branch') {
      const defState = statesList.find((s) => s.code === '27') || { code: '27', name: 'Maharashtra' };
      setFormData({
        name: '',
        code: `STR-${String((db.stores || []).length + 1).padStart(2, '0')}`,
        city: 'Mumbai',
        state: defState.name,
        stateCode: defState.code,
        address: '',
        phone: '',
        isDayOpen: true,
        active: true,
      });
    }
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    if (activeEntity === 'staff') {
      setStaffFormTab('personal');
      setShowStaffPassword(false);
    }
    const baseData = {
      ...item,
      photo: item.photo || '',
      active: item.active !== false && !item.isDiscontinued,
      isDiscontinued: !!item.isDiscontinued,
    };
    if (activeEntity === 'tax') {
      const isGst = item.taxType === 'GST' || (item.cgst > 0 || item.sgst > 0);
      baseData.taxType = isGst ? 'GST' : 'VAT';
      baseData.rate = item.rate ?? 5;
      baseData.cgst = isGst ? (item.cgst ?? item.rate / 2) : 0;
      baseData.sgst = isGst ? (item.sgst ?? item.rate / 2) : 0;
      baseData.igst = item.igst ?? item.rate ?? 5;
      baseData.cess = item.cess ?? 0;
    }
    if (activeEntity === 'payment_mode') {
      const isCredit =
        item.tenderType === 'credit' ||
        item.isCredit ||
        (item.code || '').toUpperCase().includes('CREDIT') ||
        (item.name || '').toLowerCase().includes('credit');
      baseData.tenderType = isCredit ? 'credit' : (item.isElectronic ? 'electronic' : 'cash');
      baseData.isCredit = isCredit;
      baseData.isElectronic = baseData.tenderType === 'electronic';
      delete baseData.requiresReference;
    }
    if (activeEntity === 'supplier') {
      baseData.supplyType = item.supplyType || (item.stateCode !== '27' ? 'INTERSTATE' : 'LOCAL');
      baseData.state = item.state || 'Maharashtra';
      baseData.stateCode = item.stateCode || '27';
      baseData.district = item.district || '';
      baseData.city = item.city || '';
      baseData.openingBalance = item.openingBalance !== undefined ? item.openingBalance : 0;
      baseData.bankName = item.bankName || '';
      baseData.accountNumber = item.accountNumber || '';
      baseData.ifscCode = item.ifscCode || '';
      baseData.branchName = item.branchName || '';
      baseData.accountHolderName = item.accountHolderName || item.name || '';
    }
    if (activeEntity === 'branch') {
      baseData.state = item.state || 'Maharashtra';
      baseData.stateCode = item.stateCode || '27';
      baseData.code = item.code || '';
      baseData.name = item.name || '';
      baseData.city = item.city || '';
      baseData.address = item.address || '';
      baseData.phone = item.phone || '';
      baseData.isDayOpen = item.isDayOpen ?? true;
    }
    if (activeEntity === 'company') {
      baseData.code = item.code || item.id || '';
      baseData.name = item.name || '';
      baseData.mfg = item.mfg || '';
      baseData.contact = item.contact || item.phone || '';
      baseData.address = item.address || '';
      baseData.active = item.active !== false;
    }
    if (activeEntity === 'product') {
      const matchedCat = (db.categories || []).find(
        (c) => c.name === item.category || c.id === item.categoryId
      );
      const matchedMainCatId =
        item.mainCategoryId ||
        matchedCat?.mainCategoryId ||
        db.mainCategories?.[0]?.id ||
        'MCAT-01';
      const matchedMainCat = (db.mainCategories || []).find((m) => m.id === matchedMainCatId);

      let resolvedBrands = [];
      if (Array.isArray(item.brands) && item.brands.length > 0) {
        resolvedBrands = item.brands;
      } else if (item.brand) {
        resolvedBrands = item.brand.split(',').map((b) => b.trim()).filter(Boolean);
      } else if (db.brands?.[0]) {
        resolvedBrands = [db.brands[0].name];
      }

      let resolvedSupplierIds = [];
      let resolvedSuppliers = [];
      if (Array.isArray(item.supplierIds) && item.supplierIds.length > 0) {
        resolvedSupplierIds = item.supplierIds;
        resolvedSuppliers = (db.suppliers || [])
          .filter((s) => resolvedSupplierIds.includes(s.id))
          .map((s) => s.name);
      } else if (Array.isArray(item.suppliers) && item.suppliers.length > 0) {
        resolvedSuppliers = item.suppliers;
        resolvedSupplierIds = (db.suppliers || [])
          .filter((s) => resolvedSuppliers.includes(s.name))
          .map((s) => s.id);
      } else if (item.supplierId || item.supplier) {
        if (item.supplierId) resolvedSupplierIds = [item.supplierId];
        if (item.supplier) resolvedSuppliers = [item.supplier];
      }

      baseData.companyId = item.companyId || '';
      baseData.company = item.company || item.companyName || '';
      baseData.companyCode = item.companyCode || '';
      baseData.mainCategoryId = matchedMainCatId;
      baseData.mainCategory = matchedMainCat?.name || '';
      baseData.category = item.category || matchedCat?.name || '';
      baseData.categoryId = item.categoryId || matchedCat?.id || '';
      baseData.brands = resolvedBrands;
      baseData.brand = resolvedBrands.join(', ');
      baseData.supplierIds = resolvedSupplierIds;
      baseData.suppliers = resolvedSuppliers;
      baseData.supplier = resolvedSuppliers[0] || '';
      baseData.hsnCode = item.hsnCode || item.hsn || matchedCat?.hsnCode || '';
      baseData.taxType = item.taxType || (item.taxRate === 0 ? 'non-tax' : 'inclusive');
      baseData.taxRate = item.taxRate !== undefined ? Number(item.taxRate) : (matchedCat?.defaultTaxRate ?? 5);
      baseData.uom = item.uom || 'Pcs';
      baseData.hasStock = item.hasStock !== undefined ? Boolean(item.hasStock) : (item.isService ? false : true);
      baseData.isSaleable = item.isSaleable !== undefined ? Boolean(item.isSaleable) : true;
      baseData.hasExpiryDate = item.hasExpiryDate !== undefined ? Boolean(item.hasExpiryDate) : Boolean(item.trackExpiry);
      baseData.reorderLevel = item.reorderLevel !== undefined ? Number(item.reorderLevel) : Number(item.minStockAlert || 10);
      baseData.minStockAlert = baseData.reorderLevel;
      baseData.costRate = item.costRate || 0;
      baseData.mrp = item.mrp || 0;
      baseData.sellingRate = item.sellingRate || 0;
    }
    setFormData(baseData);
    setIsModalOpen(true);
  };

  const handleToggleActive = (item) => {
    const dataKey = currentConfig.dataKey;
    const list = db[dataKey] || [];
    const idx = list.findIndex((i) => i.id === item.id);
    if (idx !== -1) {
      const nextStatus = item.active === false ? true : false;
      list[idx] = { ...list[idx], active: nextStatus };
      db[dataKey] = list;
      saveDatabase(db);
      logAuditEvent(
        'MASTER_STATUS_CHANGED',
        currentUser.id,
        `Changed status of ${currentConfig.label} "${item.name || item.code || item.id}" to ${nextStatus ? 'ACTIVE' : 'INACTIVE'}`
      );
      notify(
        'info',
        `${currentConfig.label} "${item.name || item.code || item.id}" marked as ${nextStatus ? 'Active' : 'Inactive'}.`,
        'Status Updated'
      );
      triggerRefresh();
    }
  };

  const handleSave = (e) => {
    e.preventDefault();
    const dataKey = currentConfig.dataKey;
    const list = db[dataKey] || [];

    if (activeEntity === 'product') {
      if (Number(formData.sellingRate) > Number(formData.mrp)) {
        notify('error', 'Statutory Violation: Selling Rate cannot exceed MRP.', 'Validation Error');
        return;
      }
    }

    if (activeEntity === 'main_category') {
      const trimmedCode = (formData.code || '').trim();
      const trimmedName = (formData.name || '').trim();

      if (!trimmedName) {
        notify('error', 'Main Category Name is required.', 'Validation Error');
        return;
      }
      if (!trimmedCode) {
        notify('error', 'Main Category Code is required.', 'Validation Error');
        return;
      }

      // Check code duplication (case-insensitive, exclude self)
      const duplicateCode = (db.mainCategories || []).find(
        (c) => c.id !== editingItem?.id && (c.code || '').trim().toLowerCase() === trimmedCode.toLowerCase()
      );
      if (duplicateCode) {
        notify(
          'error',
          `Main Category Code "${trimmedCode}" is already in use by "${duplicateCode.name}" (${duplicateCode.id}). Please enter a unique code.`,
          'Duplicate Code Error'
        );
        return;
      }

      // Check name duplication (case-insensitive, exclude self)
      const duplicateName = (db.mainCategories || []).find(
        (c) => c.id !== editingItem?.id && (c.name || '').trim().toLowerCase() === trimmedName.toLowerCase()
      );
      if (duplicateName) {
        notify(
          'error',
          `Main Category Name "${trimmedName}" already exists (${duplicateName.id}). Please enter a unique name.`,
          'Duplicate Name Error'
        );
        return;
      }
    }

    if (activeEntity === 'category') {
      const trimmedCode = (formData.code || '').trim();
      const trimmedName = (formData.name || '').trim();
      const mainCatId = formData.mainCategoryId || db.mainCategories?.[0]?.id;

      if (!trimmedName) {
        notify('error', 'Category Name is required.', 'Validation Error');
        return;
      }
      if (!trimmedCode) {
        notify('error', 'Category Code is required.', 'Validation Error');
        return;
      }
      if (!mainCatId) {
        notify('error', 'Please select a Main Category.', 'Validation Error');
        return;
      }

      // Check code duplication across categories (case-insensitive, exclude self)
      const duplicateCode = (db.categories || []).find(
        (c) => c.id !== editingItem?.id && (c.code || '').trim().toLowerCase() === trimmedCode.toLowerCase()
      );
      if (duplicateCode) {
        notify(
          'error',
          `Category Code "${trimmedCode}" is already in use by category "${duplicateCode.name}" (${duplicateCode.id}). Please enter a unique code.`,
          'Duplicate Code Error'
        );
        return;
      }

      // Check same category under same main category (case-insensitive, exclude self)
      const duplicateNameInMainCat = (db.categories || []).find(
        (c) =>
          c.id !== editingItem?.id &&
          c.mainCategoryId === mainCatId &&
          (c.name || '').trim().toLowerCase() === trimmedName.toLowerCase()
      );
      if (duplicateNameInMainCat) {
        const mainCatObj = (db.mainCategories || []).find((m) => m.id === mainCatId);
        notify(
          'error',
          `Category "${trimmedName}" already exists under Main Category "${mainCatObj?.name || mainCatId}". Same category under the same main category is not allowed.`,
          'Duplicate Category Error'
        );
        return;
      }
    }

    if (activeEntity === 'brand') {
      const trimmedCode = (formData.code || '').trim();
      const trimmedName = (formData.name || '').trim();

      if (!trimmedName) {
        notify('error', 'Brand Name is required.', 'Validation Error');
        return;
      }
      if (!trimmedCode) {
        notify('error', 'Brand Code is required.', 'Validation Error');
        return;
      }

      // Check code duplication across brands (case-insensitive, exclude self)
      const duplicateCode = (db.brands || []).find(
        (b) => b.id !== editingItem?.id && (b.code || '').trim().toLowerCase() === trimmedCode.toLowerCase()
      );
      if (duplicateCode) {
        notify(
          'error',
          `Brand Code "${trimmedCode}" is already in use by brand "${duplicateCode.name}" (${duplicateCode.id}). Please enter a unique code.`,
          'Duplicate Code Error'
        );
        return;
      }

      // Check name duplication across brands (case-insensitive, exclude self)
      const duplicateName = (db.brands || []).find(
        (b) => b.id !== editingItem?.id && (b.name || '').trim().toLowerCase() === trimmedName.toLowerCase()
      );
      if (duplicateName) {
        notify(
          'error',
          `Brand Name "${trimmedName}" already exists (${duplicateName.id}). Please enter a unique name.`,
          'Duplicate Name Error'
        );
        return;
      }
    }

    if (activeEntity === 'unit') {
      const trimmedCode = (formData.code || '').trim();
      const trimmedName = (formData.name || '').trim();

      if (!trimmedName) {
        notify('error', 'Unit Name is required.', 'Validation Error');
        return;
      }
      if (!trimmedCode) {
        notify('error', 'Unit Code is required.', 'Validation Error');
        return;
      }

      // Check code duplication across units (case-insensitive, exclude self)
      const duplicateCode = (db.units || []).find(
        (u) => u.id !== editingItem?.id && (u.code || '').trim().toLowerCase() === trimmedCode.toLowerCase()
      );
      if (duplicateCode) {
        notify(
          'error',
          `Unit Code "${trimmedCode}" is already in use by unit "${duplicateCode.name}" (${duplicateCode.id}). Please enter a unique code.`,
          'Duplicate Code Error'
        );
        return;
      }

      // Check name duplication across units (case-insensitive, exclude self)
      const duplicateName = (db.units || []).find(
        (u) => u.id !== editingItem?.id && (u.name || '').trim().toLowerCase() === trimmedName.toLowerCase()
      );
      if (duplicateName) {
        notify(
          'error',
          `Unit Name "${trimmedName}" already exists (${duplicateName.id}). Please enter a unique name.`,
          'Duplicate Name Error'
        );
        return;
      }
    }

    if (activeEntity === 'supplier') {
      const trimmedName = (formData.name || '').trim();
      const trimmedPhone = (formData.phone || '').trim();
      const cleanedPhone = trimmedPhone.replace(/\D/g, '').slice(-10);

      if (!trimmedName) {
        notify('error', 'Supplier Name is required.', 'Validation Error');
        return;
      }

      if (!trimmedPhone) {
        notify('error', 'Supplier Mobile Number is mandatory.', 'Validation Error');
        return;
      }

      if (cleanedPhone.length !== 10) {
        notify('error', 'Supplier Mobile Number must be exactly 10 digits.', 'Validation Error');
        return;
      }

      // Check duplicate mobile across suppliers (excluding self on edit)
      const duplicatePhoneSupplier = (db.suppliers || []).find(
        (s) =>
          s.id !== editingItem?.id &&
          (s.phone || '').replace(/\D/g, '').slice(-10) === cleanedPhone
      );
      if (duplicatePhoneSupplier) {
        notify(
          'error',
          `Mobile Number "${cleanedPhone}" is already registered with supplier "${duplicatePhoneSupplier.name}" (${duplicatePhoneSupplier.id}). Mobile number must be unique.`,
          'Duplicate Mobile Error'
        );
        return;
      }

      if (formData.email && formData.email.trim()) {
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(formData.email.trim())) {
          notify('error', 'Please enter a valid email address (e.g. supplier@example.com).', 'Invalid Email');
          return;
        }
      }
    }

    if (activeEntity === 'staff') {
      if (!formData.name?.trim()) {
        notify('error', 'Staff Full Name is required.', 'Validation Error');
        return;
      }
      if (!formData.username?.trim()) {
        notify('error', 'Staff Login Username is required.', 'Validation Error');
        return;
      }
    }

    if (activeEntity === 'payment_mode') {
      const trimmedCode = (formData.code || '').trim();
      const trimmedName = (formData.name || '').trim();

      if (!trimmedName) {
        notify('error', 'Payment Mode Name is required.', 'Validation Error');
        return;
      }
      if (!trimmedCode) {
        notify('error', 'Payment Mode Code is required.', 'Validation Error');
        return;
      }

      // Check code duplication across payment modes (case-insensitive, exclude self)
      const duplicateCode = (db.paymentModes || []).find(
        (pm) => pm.id !== editingItem?.id && (pm.code || '').trim().toLowerCase() === trimmedCode.toLowerCase()
      );
      if (duplicateCode) {
        notify(
          'error',
          `Payment Mode Code "${trimmedCode}" is already in use by mode "${duplicateCode.name}" (${duplicateCode.id}). Please enter a unique code.`,
          'Duplicate Code Error'
        );
        return;
      }

      // Check name duplication across payment modes (case-insensitive, exclude self)
      const duplicateName = (db.paymentModes || []).find(
        (pm) => pm.id !== editingItem?.id && (pm.name || '').trim().toLowerCase() === trimmedName.toLowerCase()
      );
      if (duplicateName) {
        notify(
          'error',
          `Payment Mode Name "${trimmedName}" already exists (${duplicateName.id}). Please enter a unique name.`,
          'Duplicate Name Error'
        );
        return;
      }
    }

    if (activeEntity === 'tax') {
      const rateNum = Number(formData.rate);
      if (isNaN(rateNum) || rateNum < 0) {
        notify('error', 'Tax Rate must be a valid non-negative number.', 'Validation Error');
        return;
      }

      const taxType = formData.taxType || 'VAT';

      // Check tax rate duplication for the same tax regime
      const duplicateTax = (db.taxes || []).find(
        (t) =>
          t.id !== editingItem?.id &&
          Number(t.rate) === rateNum &&
          (t.taxType || ((t.cgst > 0 || t.sgst > 0) ? 'GST' : 'VAT')) === taxType
      );
      if (duplicateTax) {
        notify(
          'error',
          `A ${taxType === 'GST' ? 'Dual GST' : 'Single VAT/Tax'} rate of ${rateNum}% already exists (${duplicateTax.id}). Please specify a unique tax rate.`,
          'Duplicate Tax Rate Error'
        );
        return;
      }
    }

    if (activeEntity === 'company') {
      const trimmedName = (formData.name || '').trim();
      const trimmedCode = (formData.code || '').trim();

      if (!trimmedName) {
        notify('error', 'Company Name is required.', 'Validation Error');
        return;
      }
      if (!trimmedCode) {
        notify('error', 'Company Code is required.', 'Validation Error');
        return;
      }

      // Check code duplication across companies (case-insensitive, exclude self)
      const duplicateCode = (db.companies || []).find(
        (c) => c.id !== editingItem?.id && (c.code || '').trim().toLowerCase() === trimmedCode.toLowerCase()
      );
      if (duplicateCode) {
        notify(
          'error',
          `Company Code "${trimmedCode}" is already in use by company "${duplicateCode.name}" (${duplicateCode.id}). Please enter a unique code.`,
          'Duplicate Code Error'
        );
        return;
      }

      // Check name duplication across companies (case-insensitive, exclude self)
      const duplicateName = (db.companies || []).find(
        (c) => c.id !== editingItem?.id && (c.name || '').trim().toLowerCase() === trimmedName.toLowerCase()
      );
      if (duplicateName) {
        notify(
          'error',
          `Company Name "${trimmedName}" already exists (${duplicateName.id}). Please enter a unique company name.`,
          'Duplicate Name Error'
        );
        return;
      }
    }

    if (activeEntity === 'branch') {
      const trimmedName = (formData.name || '').trim();
      const trimmedCode = (formData.code || '').trim();

      if (!trimmedName) {
        notify('error', 'Branch / Store Name is required.', 'Validation Error');
        return;
      }
      if (!trimmedCode) {
        notify('error', 'Branch Code is required.', 'Validation Error');
        return;
      }

      // Check code duplication across stores (case-insensitive, exclude self)
      const duplicateCode = (db.stores || []).find(
        (s) => s.id !== editingItem?.id && (s.code || '').trim().toLowerCase() === trimmedCode.toLowerCase()
      );
      if (duplicateCode) {
        notify(
          'error',
          `Branch Code "${trimmedCode}" is already in use by branch "${duplicateCode.name}" (${duplicateCode.id}). Please enter a unique code.`,
          'Duplicate Code Error'
        );
        return;
      }

      // Check name duplication across stores (case-insensitive, exclude self)
      const duplicateName = (db.stores || []).find(
        (s) => s.id !== editingItem?.id && (s.name || '').trim().toLowerCase() === trimmedName.toLowerCase()
      );
      if (duplicateName) {
        notify(
          'error',
          `Branch Name "${trimmedName}" already exists (${duplicateName.id}). Please enter a unique name.`,
          'Duplicate Name Error'
        );
        return;
      }
    }

    if (activeEntity === 'product') {
      const trimmedName = (formData.name || '').trim();
      const trimmedSku = (formData.sku || '').trim().toUpperCase();

      if (!trimmedName) {
        notify('error', 'Product Name is required.', 'Validation Error');
        return;
      }
      if (!trimmedSku) {
        notify('error', 'SKU Code is required.', 'Validation Error');
        return;
      }

      // Check SKU duplication across products (case-insensitive, exclude self)
      const duplicateSku = (db.products || []).find(
        (p) => p.id !== editingItem?.id && (p.sku || '').trim().toUpperCase() === trimmedSku
      );
      if (duplicateSku) {
        notify(
          'error',
          `SKU "${trimmedSku}" is already in use by product "${duplicateSku.name}". SKU must be unique.`,
          'Duplicate SKU Error'
        );
        return;
      }

      // Check Name duplication across products (case-insensitive, exclude self)
      const duplicateName = (db.products || []).find(
        (p) => p.id !== editingItem?.id && (p.name || '').trim().toLowerCase() === trimmedName.toLowerCase()
      );
      if (duplicateName) {
        notify(
          'error',
          `Product Name "${trimmedName}" already exists (${duplicateName.sku || duplicateName.id}). Product names should be unique.`,
          'Duplicate Name Error'
        );
        return;
      }
    }

    const payload = {
      ...formData,
      active: formData.active !== false && !formData.isDiscontinued,
    };

    if (activeEntity === 'main_category') {
      payload.code = (formData.code || '').trim().toUpperCase();
      payload.name = (formData.name || '').trim();
      payload.description = (formData.description || '').trim();
    }

    if (activeEntity === 'category') {
      payload.code = (formData.code || '').trim().toUpperCase();
      payload.name = (formData.name || '').trim();
      payload.mainCategoryId = formData.mainCategoryId || db.mainCategories?.[0]?.id || 'MCAT-01';
      payload.hsnCode = (formData.hsnCode || '').toString().replace(/\D/g, '').slice(0, 8);
      payload.defaultTaxRate = Number(formData.defaultTaxRate ?? 5);
    }

    if (activeEntity === 'brand') {
      payload.code = (formData.code || '').trim().toUpperCase();
      payload.name = (formData.name || '').trim();
      payload.manufacturer = (formData.manufacturer || '').trim();
      payload.country = (formData.country || 'India').trim();
    }

    if (activeEntity === 'unit') {
      payload.code = (formData.code || '').trim().toUpperCase();
      payload.name = (formData.name || '').trim();
      payload.description = (formData.description || '').trim();
      payload.allowDecimal = Boolean(formData.allowDecimal);
    }

    if (activeEntity === 'payment_mode') {
      const trimmedCode = (formData.code || '').trim().toUpperCase();
      const trimmedName = (formData.name || '').trim();
      const isCredit =
        formData.tenderType === 'credit' ||
        formData.isCredit ||
        trimmedCode.includes('CREDIT') ||
        trimmedName.toLowerCase().includes('credit');
      const tenderType = isCredit
        ? 'credit'
        : formData.tenderType === 'electronic' || formData.isElectronic
        ? 'electronic'
        : 'cash';

      payload.code = trimmedCode;
      payload.name = trimmedName;
      payload.tenderType = tenderType;
      payload.isCredit = isCredit;
      payload.isElectronic = tenderType === 'electronic';
      delete payload.requiresReference;
    }

    if (activeEntity === 'tax') {
      const rateNum = Number(formData.rate || 0);
      const taxType = formData.taxType || 'VAT';
      payload.rate = rateNum;
      payload.taxType = taxType;
      payload.name = taxType === 'GST' ? `GST ${rateNum}%` : `VAT ${rateNum}%`;
      if (taxType === 'GST') {
        payload.cgst = Number(formData.cgst ?? rateNum / 2);
        payload.sgst = Number(formData.sgst ?? rateNum / 2);
        payload.igst = Number(formData.igst ?? rateNum);
        payload.cess = Number(formData.cess || 0);
      } else {
        payload.cgst = 0;
        payload.sgst = 0;
        payload.igst = rateNum;
        payload.cess = 0;
      }
    }

    if (activeEntity === 'supplier') {
      payload.name = (formData.name || '').trim();
      payload.code = (formData.code || editingItem?.id || '').trim();
      payload.contactPerson = (formData.contactPerson || '').trim();
      payload.phone = (formData.phone || '').replace(/\D/g, '').slice(-10);
      payload.email = (formData.email || '').trim();
      payload.gstin = (formData.gstin || '').trim().toUpperCase();
      payload.supplyType = formData.supplyType || (formData.stateCode !== '27' ? 'INTERSTATE' : 'LOCAL');
      payload.state = (formData.state || 'Maharashtra').trim();
      payload.stateCode = (formData.stateCode || '27').trim();
      payload.district = (formData.district || '').trim();
      payload.city = (formData.city || '').trim();
      payload.address = (formData.address || '').trim();
      payload.openingBalance = Number(formData.openingBalance || 0);
      payload.bankName = (formData.bankName || '').trim();
      payload.accountNumber = (formData.accountNumber || '').trim();
      payload.ifscCode = (formData.ifscCode || '').trim().toUpperCase();
      payload.branchName = (formData.branchName || '').trim();
      payload.accountHolderName = (formData.accountHolderName || formData.name || '').trim();
    }

    if (activeEntity === 'branch') {
      payload.name = (formData.name || '').trim();
      payload.code = (formData.code || '').trim().toUpperCase();
      payload.city = (formData.city || '').trim();
      payload.state = (formData.state || 'Maharashtra').trim();
      payload.stateCode = (formData.stateCode || '27').trim();
      payload.address = (formData.address || '').trim();
      payload.phone = (formData.phone || '').trim();
      payload.isDayOpen = editingItem ? (editingItem.isDayOpen ?? true) : true;
    }

    if (activeEntity === 'company') {
      payload.name = (formData.name || '').trim();
      payload.code = (formData.code || '').trim().toUpperCase();
      payload.mfg = (formData.mfg || '').trim();
      payload.contact = (formData.contact || '').trim();
      payload.address = (formData.address || '').trim();
    }

    if (activeEntity === 'product') {
      const trimmedName = (formData.name || '').trim();
      const trimmedSku = (formData.sku || '').trim().toUpperCase();
      const mainCatObj = db.mainCategories?.find((m) => m.id === formData.mainCategoryId);
      const catObj = db.categories?.find((c) => c.name === formData.category || c.id === formData.categoryId);

      payload.name = trimmedName;
      payload.sku = trimmedSku;
      payload.barcode = (formData.barcode || '').trim();

      // Company / Manufacturer (Optional / Not mandatory)
      const selectedCompanyId = formData.companyId || '';
      const matchedCompany = (db.companies || []).find((c) => c.id === selectedCompanyId);
      payload.companyId = selectedCompanyId;
      payload.company = matchedCompany ? matchedCompany.name : (formData.company || '');
      payload.companyCode = matchedCompany ? (matchedCompany.code || '') : (formData.companyCode || '');
      payload.mainCategoryId = formData.mainCategoryId || mainCatObj?.id || '';
      payload.mainCategory = mainCatObj?.name || formData.mainCategory || '';
      payload.category = formData.category || catObj?.name || '';
      payload.categoryId = catObj?.id || formData.categoryId || '';

      // Brands (multiple selection array & primary display string)
      const selectedBrands = Array.isArray(formData.brands) && formData.brands.length > 0
        ? formData.brands
        : (formData.brand ? [formData.brand] : []);
      payload.brands = selectedBrands;
      payload.brand = selectedBrands.join(', ') || 'Standard';

      // Suppliers (multiple selection array & primary supplier)
      const selectedSupplierIds = Array.isArray(formData.supplierIds) ? formData.supplierIds : [];
      const selectedSupplierNames = (db.suppliers || [])
        .filter((s) => selectedSupplierIds.includes(s.id))
        .map((s) => s.name);
      payload.supplierIds = selectedSupplierIds;
      payload.suppliers = selectedSupplierNames.length > 0 ? selectedSupplierNames : (formData.suppliers || []);
      payload.supplier = selectedSupplierNames[0] || (formData.suppliers?.[0] || '');
      payload.supplierId = selectedSupplierIds[0] || '';

      // HSN
      const hsnVal = (formData.hsnCode || '').toString().trim();
      payload.hsnCode = hsnVal;
      payload.hsn = hsnVal;

      // Tax Type & Tax Rate
      const taxTypeVal = formData.taxType || 'inclusive';
      payload.taxType = taxTypeVal;
      payload.isTaxInclusive = taxTypeVal === 'inclusive';
      payload.taxRate = taxTypeVal === 'non-tax' ? 0 : Number(formData.taxRate || 0);

      // UOM
      payload.uom = (formData.uom || 'Pcs').trim();

      // Have Stock (Physical inventory vs Non-stock charge/service like packing/labour)
      const hasStockVal = formData.hasStock !== false;
      payload.hasStock = hasStockVal;
      payload.isService = !hasStockVal;

      // Saleable
      payload.isSaleable = formData.isSaleable !== false;

      // Expiry Date Yes/No
      const hasExpiryVal = hasStockVal ? Boolean(formData.hasExpiryDate) : false;
      payload.hasExpiryDate = hasExpiryVal;
      payload.trackExpiry = hasExpiryVal;

      // Reorder Level
      const reorderVal = hasStockVal ? Number(formData.reorderLevel ?? formData.minStockAlert ?? 10) : 0;
      payload.reorderLevel = reorderVal;
      payload.minStockAlert = reorderVal;

      // Rate handling: rates removed from form; retain existing values on edit or fallback cleanly
      payload.costRate = editingItem ? Number(editingItem.costRate || 0) : Number(formData.costRate || 0);
      payload.mrp = editingItem ? Number(editingItem.mrp || 0) : Number(formData.mrp || 0);
      payload.sellingRate = editingItem ? Number(editingItem.sellingRate || 0) : Number(formData.sellingRate || 0);
    }

    if (activeEntity === 'staff') {
      const targetRoleId = formData.roleId || 'ROLE_CASHIER';
      const roleObj = db.roles?.find((r) => r.id === targetRoleId);
      payload.roleId = targetRoleId;
      payload.role = roleObj?.code || roleObj?.name || formData.role || 'CASHIER';

      if (!payload.permissions || payload.permissions.length === 0) {
        if (targetRoleId === 'ROLE_ADMIN') {
          payload.permissions = ['ALL_PERMISSIONS', 'SUPER_ADMIN'];
        } else if (targetRoleId === 'ROLE_CASHIER') {
          payload.permissions = ['SALES_CREATE', 'SALES_VIEW', 'RETURN_CREATE_LIMITED'];
        } else if (targetRoleId === 'ROLE_PURCHASE_USER') {
          payload.permissions = ['PURCHASE_CREATE', 'PURCHASE_VIEW', 'PURCHASE_RETURN'];
        } else if (targetRoleId === 'ROLE_STOREKEEPER') {
          payload.permissions = ['STOCK_VIEW', 'STOCK_TRANSFER', 'STOCK_COUNT_ENTRY'];
        } else {
          payload.permissions = [payload.role];
        }
      }

      if (payload.isDiscontinued) {
        payload.active = false;
        payload.blockLogin = true;
      }
    }

    if (editingItem) {
      const idx = list.findIndex((i) => i.id === editingItem.id);
      if (idx !== -1) {
        list[idx] = { ...editingItem, ...payload };
        if (activeEntity === 'payment_mode') {
          delete list[idx].requiresReference;
        }

        // If category was renamed, cascade update products using the old name
        if (activeEntity === 'category' && editingItem.name && payload.name && editingItem.name !== payload.name) {
          if (Array.isArray(db.products)) {
            db.products = db.products.map((p) =>
              (p.category || '').trim().toLowerCase() === editingItem.name.trim().toLowerCase()
                ? { ...p, category: payload.name }
                : p
            );
          }
        }

        // If brand was renamed, cascade update products using the old name
        if (activeEntity === 'brand' && editingItem.name && payload.name && editingItem.name !== payload.name) {
          if (Array.isArray(db.products)) {
            db.products = db.products.map((p) =>
              (p.brand || '').trim().toLowerCase() === editingItem.name.trim().toLowerCase()
                ? { ...p, brand: payload.name }
                : p
            );
          }
        }

        // If unit was renamed or code changed, cascade update products using old unit name or code
        if (
          activeEntity === 'unit' &&
          editingItem &&
          (editingItem.name !== payload.name || editingItem.code !== payload.code)
        ) {
          const oldName = (editingItem.name || '').trim().toLowerCase();
          const oldCode = (editingItem.code || '').trim().toLowerCase();
          if (Array.isArray(db.products)) {
            db.products = db.products.map((p) => {
              const pUom = (p.uom || '').trim().toLowerCase();
              if (pUom === oldCode || pUom === oldName) {
                return { ...p, uom: payload.code || payload.name };
              }
              return p;
            });
          }
        }

        // If company was renamed or code changed, cascade update products using old company
        if (
          activeEntity === 'company' &&
          editingItem &&
          (editingItem.name !== payload.name || editingItem.code !== payload.code)
        ) {
          if (Array.isArray(db.products)) {
            db.products = db.products.map((p) => {
              if (
                p.companyId === editingItem.id ||
                (p.company || '').trim().toLowerCase() === (editingItem.name || '').trim().toLowerCase()
              ) {
                return { ...p, company: payload.name, companyCode: payload.code };
              }
              return p;
            });
          }
        }

        logAuditEvent(
          'MASTER_UPDATED',
          currentUser.id,
          `Updated ${currentConfig.label}: ${payload.name || payload.code || editingItem.id} (Status: ${payload.active ? 'Active' : 'Inactive'})`
        );
        logBacklog({
          action: 'UPDATE',
          formName: `${currentConfig.label} Master`,
          recordRef: payload.code || payload.name || editingItem.id,
          userId: currentUser.id,
          userName: currentUser.name,
          userRole: currentUser.role,
          details: `Updated ${currentConfig.label} "${payload.name || payload.code || editingItem.id}" (Status: ${payload.active ? 'Active' : 'Inactive'})`,
        });
        notify('success', `${currentConfig.label} record updated successfully.`, 'Updated');
      }
    } else {
      const newId = `${currentConfig.idPrefix}-${String(list.length + 1).padStart(3, '0')}`;
      const record = { ...payload, id: newId };
      list.push(record);
      logAuditEvent(
        'MASTER_CREATED',
        currentUser.id,
        `Created ${currentConfig.label}: ${record.name || record.code || newId} (Status: ${record.active ? 'Active' : 'Inactive'})`
      );
      logBacklog({
        action: 'SAVE',
        formName: `${currentConfig.label} Master`,
        recordRef: record.code || record.name || newId,
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        details: `Saved new ${currentConfig.label} "${record.name || record.code || newId}" (ID: ${newId})`,
      });
      notify('success', `New ${currentConfig.label} created successfully.`, 'Created');
    }

    db[dataKey] = list;
    saveDatabase(db);
    triggerRefresh();
    setIsModalOpen(false);
  };

  const handleCloseModal = () => {
    if (editingItem) {
      logBacklog({
        action: 'CANCEL',
        formName: `${currentConfig.label} Master`,
        recordRef: editingItem.code || editingItem.name || editingItem.id,
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        details: `Cancelled / discarded changes for ${currentConfig.label} "${editingItem.name || editingItem.code || editingItem.id}"`,
      });
    }
    setIsModalOpen(false);
  };

  const handleDelete = (item) => {
    if (activeEntity === 'main_category') {
      const linkedCats = (db.categories || []).filter(
        (c) => c.mainCategoryId === item.id || (item.name && c.mainCategory === item.name)
      );
      if (linkedCats.length > 0) {
        notify(
          'error',
          `Cannot delete Main Category "${item.name}": It is currently linked to ${linkedCats.length} category (${linkedCats.slice(0, 3).map((c) => c.name).join(', ')}${linkedCats.length > 3 ? '...' : ''}). Delete or reassign those categories first.`,
          'Main Category Locked'
        );
        return;
      }
    }

    if (activeEntity === 'category') {
      const linkedProducts = getProductsLinkedToCategory(item, db.products);
      if (linkedProducts.length > 0) {
        notify(
          'error',
          `Cannot delete Category "${item.name}": It is currently used in ${linkedProducts.length} product(s) (${linkedProducts.slice(0, 3).map((p) => p.name).join(', ')}${linkedProducts.length > 3 ? '...' : ''}). Delete button is locked. Reassign or delete linked products first.`,
          'Category Deletion Locked'
        );
        return;
      }
    }

    if (activeEntity === 'brand') {
      const linkedProducts = getProductsLinkedToBrand(item, db.products);
      if (linkedProducts.length > 0) {
        notify(
          'error',
          `Cannot delete Brand "${item.name}": It is currently used in ${linkedProducts.length} product(s) (${linkedProducts.slice(0, 3).map((p) => p.name).join(', ')}${linkedProducts.length > 3 ? '...' : ''}). Delete button is locked. Reassign or delete linked products first.`,
          'Brand Deletion Locked'
        );
        return;
      }
    }

    if (activeEntity === 'unit') {
      const linkedProducts = getProductsLinkedToUnit(item, db.products);
      if (linkedProducts.length > 0) {
        notify(
          'error',
          `Cannot delete Unit "${item.name}" (${item.code}): It is currently used in ${linkedProducts.length} product(s) (${linkedProducts.slice(0, 3).map((p) => p.name).join(', ')}${linkedProducts.length > 3 ? '...' : ''}). Delete button is locked. Reassign or delete linked products first.`,
          'Unit Deletion Locked'
        );
        return;
      }
    }

    if (activeEntity === 'company') {
      const linkedProducts = getProductsLinkedToCompany(item, db.products);
      if (linkedProducts.length > 0) {
        notify(
          'error',
          `Cannot delete Company "${item.name}": It is currently assigned to ${linkedProducts.length} product(s) (${linkedProducts.slice(0, 3).map((p) => p.name).join(', ')}${linkedProducts.length > 3 ? '...' : ''}). Delete button is locked. Reassign or remove company from linked products first.`,
          'Company Deletion Locked'
        );
        return;
      }
    }

    if (activeEntity === 'payment_mode') {
      const linkedInvoices = getInvoicesLinkedToPaymentMode(item, db.invoices);
      if (linkedInvoices.length > 0) {
        notify(
          'error',
          `Cannot delete Payment Mode "${item.name}" (${item.code}): It is currently used in ${linkedInvoices.length} invoice(s) (${linkedInvoices.slice(0, 3).map((inv) => inv.docNumber || inv.id).join(', ')}${linkedInvoices.length > 3 ? '...' : ''}). Delete button is locked.`,
          'Payment Mode Locked'
        );
        return;
      }
    }

    if (activeEntity === 'tax') {
      const linkedProducts = (db.products || []).filter((p) => Number(p.taxRate) === Number(item.rate));
      if (linkedProducts.length > 0) {
        notify(
          'error',
          `Cannot delete Tax Slab ${item.rate}%: It is currently assigned to ${linkedProducts.length} product(s) (${linkedProducts.slice(0, 3).map((p) => p.name).join(', ')}${linkedProducts.length > 3 ? '...' : ''}). Delete button is locked. Reassign products first.`,
          'Tax Slab Locked'
        );
        return;
      }
    }

    if (window.confirm(`Delete ${currentConfig.label} "${item.name || item.code || item.id}"?`)) {
      const dataKey = currentConfig.dataKey;
      db[dataKey] = db[dataKey].filter((i) => i.id !== item.id);
      saveDatabase(db);
      logAuditEvent('MASTER_DELETED', currentUser.id, `Deleted ${currentConfig.label}: ${item.id}`);
      logBacklog({
        action: 'DELETE',
        formName: `${currentConfig.label} Master`,
        recordRef: item.code || item.name || item.id,
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        details: `Deleted ${currentConfig.label} "${item.name || item.code || item.id}" (ID: ${item.id})`,
      });
      notify('info', `${currentConfig.label} record deleted.`, 'Deleted');
      triggerRefresh();
    }
  };

  const Icon = currentConfig.icon;

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
              You do not have permission to view the <span className="text-slate-200 font-semibold">{currentConfig.label}</span> master module. Contact your administrator to adjust your role privileges.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 py-3 sm:py-4 space-y-4">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-3 sm:p-3.5 rounded-xl shadow-md">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 shrink-0">
            <Icon className={`w-5 h-5 ${currentConfig.color}`} />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-slate-100 text-sm truncate sm:overflow-visible sm:whitespace-normal">
              {currentConfig.title}
            </h3>
            <p className="text-[11px] text-slate-400 line-clamp-1 sm:line-clamp-none">
              Manage {currentConfig.label.toLowerCase()} definitions, attributes, codes & relationships
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <div className="relative flex-1 min-w-[160px] sm:w-56 sm:flex-none">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder={`Search ${currentConfig.label.toLowerCase()}s...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {activeEntity === 'supplier' && (
            <select
              value={supplierSupplyFilter}
              onChange={(e) => setSupplierSupplyFilter(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-medium shrink-0"
              title="Filter by Local or Interstate"
            >
              <option value="ALL">All Supply</option>
              <option value="LOCAL">Local</option>
              <option value="INTERSTATE">Interstate</option>
            </select>
          )}

          <div className="flex items-center gap-1.5 flex-wrap shrink-0">
            <ExportButtons
              data={getExportData()}
              filename={`${currentConfig.label.toUpperCase()}_MASTER`}
              title={currentConfig.title}
              pdfOrientation={activeEntity === 'staff' || activeEntity === 'product' || activeEntity === 'supplier' || activeEntity === 'tax' ? 'landscape' : 'portrait'}
            />

            {canPrint && (
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold shadow-sm transition shrink-0"
                title={`Print / Export ${currentConfig.label} Master List`}
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
            )}

            {canAdd && (
              <button
                onClick={handleOpenAdd}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-indigo-600/30 transition shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add {currentConfig.label}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Horizontal Entity Switcher Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
        {Object.entries(ENTITY_CONFIG).map(([key, cfg]) => {
          if (!hasPermission(key, 'view')) return null;
          const ItemIcon = cfg.icon;
          const isActive = activeEntity === key;
          const count = (db[cfg.dataKey] || []).length;
          return (
            <button
              key={key}
              onClick={() => {
                setActiveEntity(key);
                setSearch('');
                setSupplierSupplyFilter('ALL');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition ${
                isActive
                  ? 'bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-600/20'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <ItemIcon className="w-3.5 h-3.5" />
              <span>{cfg.label}</span>
              <span
                className={`px-1 rounded-full text-[10px] font-mono ${
                  isActive ? 'bg-indigo-700 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Master Data Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[720px]">
            <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">#</th>
                {currentConfig.columns.map((col, idx) => (
                  <th key={idx} className="py-2.5 px-3">
                    {col}
                  </th>
                ))}
                <th className="py-2.5 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={currentConfig.columns.length + 2} className="py-8 text-center text-slate-500 font-sans">
                    No {currentConfig.label.toLowerCase()} records found. Click "Add {currentConfig.label}" to create one.
                  </td>
                </tr>
              ) : (
                filteredList.map((item, index) => (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-2.5 px-3 text-slate-500 font-sans">{index + 1}</td>

                    {/* Specific rendering for each entity */}
                    {activeEntity === 'main_category' && (
                      <>
                        <td className="py-2.5 px-3 text-indigo-400 font-bold">{item.code}</td>
                        <td className="py-2.5 px-3 font-sans font-bold text-slate-100">
                          <div className="flex items-center gap-2">
                            <span>{item.name}</span>
                            {(() => {
                              const linkedCount = (db.categories || []).filter(
                                (c) => c.mainCategoryId === item.id || (item.name && c.mainCategory === item.name)
                              ).length;
                              if (linkedCount > 0) {
                                return (
                                  <span
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-950/80 text-indigo-300 border border-indigo-800"
                                    title={`In use by ${linkedCount} sub-categor${linkedCount === 1 ? 'y' : 'ies'}`}
                                  >
                                    <FolderTree className="w-2.5 h-2.5 text-indigo-400" />
                                    {linkedCount} {linkedCount === 1 ? 'category' : 'categories'}
                                  </span>
                                );
                              }
                              return (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400">
                                  Unlinked
                                </span>
                              );
                            })()}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-sans text-slate-400">{item.description || '—'}</td>
                      </>
                    )}

                    {activeEntity === 'category' && (
                      <>
                        <td className="py-2.5 px-3 text-indigo-400 font-bold">{item.code}</td>
                        <td className="py-2.5 px-3 font-sans font-bold text-slate-100">
                          <div className="flex items-center gap-2">
                            <span>{item.name}</span>
                            {(() => {
                              const linkedProducts = getProductsLinkedToCategory(item, db.products);
                              if (linkedProducts.length > 0) {
                                return (
                                  <span
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800"
                                    title={`In use by ${linkedProducts.length} product(s) (${linkedProducts.slice(0, 3).map((p) => p.name).join(', ')}${linkedProducts.length > 3 ? '...' : ''}). Deletion locked.`}
                                  >
                                    <Package className="w-2.5 h-2.5 text-emerald-400" />
                                    {linkedProducts.length} {linkedProducts.length === 1 ? 'product' : 'products'}
                                  </span>
                                );
                              }
                              return (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400">
                                  Unlinked
                                </span>
                              );
                            })()}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-sans text-slate-300">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-950/50 text-indigo-300 border border-indigo-900/60">
                            <Layers className="w-2.5 h-2.5 text-indigo-400" />
                            {db.mainCategories?.find((m) => m.id === item.mainCategoryId)?.name || 'General'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-300 font-mono">{item.hsnCode || '—'}</td>
                        <td className="py-2.5 px-3 font-bold text-emerald-400">{item.defaultTaxRate || 5}%</td>
                      </>
                    )}

                    {activeEntity === 'brand' && (
                      <>
                        <td className="py-2.5 px-3 text-indigo-400 font-bold">{item.code || '—'}</td>
                        <td className="py-2.5 px-3 font-sans font-bold text-slate-100">
                          <div className="flex items-center gap-2">
                            <span>{item.name}</span>
                            {(() => {
                              const linkedProducts = getProductsLinkedToBrand(item, db.products);
                              if (linkedProducts.length > 0) {
                                return (
                                  <span
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800"
                                    title={`In use by ${linkedProducts.length} product(s) (${linkedProducts.slice(0, 3).map((p) => p.name).join(', ')}${linkedProducts.length > 3 ? '...' : ''}). Deletion locked.`}
                                  >
                                    <Package className="w-2.5 h-2.5 text-emerald-400" />
                                    {linkedProducts.length} {linkedProducts.length === 1 ? 'product' : 'products'}
                                  </span>
                                );
                              }
                              return (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400">
                                  Unlinked
                                </span>
                              );
                            })()}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-sans text-slate-300">{item.manufacturer || '—'}</td>
                        <td className="py-2.5 px-3 font-sans text-slate-400">{item.country || 'India'}</td>
                      </>
                    )}

                    {activeEntity === 'supplier' && (
                      <>
                        <td className="py-2.5 px-3">
                          <div className="font-sans font-bold text-slate-100 flex items-center gap-1.5">
                            <span>{item.name}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            ID: {item.id}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-indigo-400 font-semibold">{item.code || item.id}</td>
                        <td className="py-2.5 px-3 font-sans text-slate-300">{item.contactPerson || '—'}</td>
                        <td className="py-2.5 px-3 font-sans">
                          <div className="text-slate-100 font-mono flex items-center gap-1">
                            <Phone className="w-3 h-3 text-indigo-400 shrink-0" />
                            <span>{item.phone || '—'}</span>
                          </div>
                          {item.email && (
                            <div className="text-[10px] text-slate-400 truncate max-w-[140px]" title={item.email}>
                              {item.email}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-300">{item.gstin || '—'}</td>
                        <td className="py-2.5 px-3 font-sans">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${
                              (item.supplyType || (item.stateCode !== '27' ? 'INTERSTATE' : 'LOCAL')) === 'INTERSTATE'
                                ? 'bg-purple-950/80 text-purple-300 border-purple-800'
                                : 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                            }`}
                          >
                            {(item.supplyType || (item.stateCode !== '27' ? 'INTERSTATE' : 'LOCAL')) === 'INTERSTATE'
                              ? 'Interstate'
                              : 'Local'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-sans">
                          <div className="text-slate-100 font-medium text-xs">
                            {item.state || 'Maharashtra'} <span className="text-[10px] text-slate-500 font-mono">({item.stateCode || '27'})</span>
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {[item.district, item.city].filter(Boolean).join(' • ') || '—'}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-sans">
                          {item.bankName || item.accountNumber ? (
                            <div>
                              <div className="font-semibold text-slate-200 text-xs flex items-center gap-1">
                                <Landmark className="w-3 h-3 text-amber-400 shrink-0" />
                                <span>{item.bankName || 'Bank'}</span>
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                {item.accountNumber ? `A/C: ••••${item.accountNumber.slice(-4)}` : ''}
                                {item.ifscCode ? ` • ${item.ifscCode}` : ''}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-500 text-[11px] italic">Not added</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-amber-400">
                          ₹{Number(item.openingBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </>
                    )}

                    {activeEntity === 'unit' && (
                      <>
                        <td className="py-2.5 px-3 text-indigo-400 font-bold">{item.code}</td>
                        <td className="py-2.5 px-3 font-sans font-bold text-slate-100">{item.name}</td>
                        <td className="py-2.5 px-3 font-sans">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              item.allowDecimal
                                ? 'bg-indigo-950 text-indigo-400 border border-indigo-800'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {item.allowDecimal ? 'Yes (0.00)' : 'No (Integers)'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-sans text-slate-400">{item.description || '—'}</td>
                      </>
                    )}

                    {activeEntity === 'company' && (
                      <>
                        <td className="py-2.5 px-3 text-indigo-400 font-bold">{item.code || item.id}</td>
                        <td className="py-2.5 px-3 font-sans font-bold text-slate-100">
                          <div className="flex items-center gap-2">
                            <span>{item.name}</span>
                            {(() => {
                              const linkedProducts = getProductsLinkedToCompany(item, db.products);
                              if (linkedProducts.length > 0) {
                                return (
                                  <span
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800"
                                    title={`In use by ${linkedProducts.length} product(s) (${linkedProducts.slice(0, 3).map((p) => p.name).join(', ')}${linkedProducts.length > 3 ? '...' : ''}). Deletion locked.`}
                                  >
                                    <Package className="w-2.5 h-2.5 text-emerald-400" />
                                    {linkedProducts.length} {linkedProducts.length === 1 ? 'product' : 'products'}
                                  </span>
                                );
                              }
                              return (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400">
                                  Unlinked
                                </span>
                              );
                            })()}
                          </div>
                          {item.tradeName && item.tradeName !== item.name && (
                            <div className="text-[10px] text-slate-400 font-sans mt-0.5">
                              Trade: {item.tradeName}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-sans text-slate-300">{item.mfg || '—'}</td>
                        <td className="py-2.5 px-3 font-sans text-slate-300">
                          <div className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-indigo-400 shrink-0" />
                            <span>{item.contact || item.phone || '—'}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-sans text-slate-400 max-w-xs truncate" title={item.address}>
                          {item.address || '—'}
                        </td>
                      </>
                    )}

                    {activeEntity === 'product' && (
                      <>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-indigo-300 font-mono">{item.sku}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{item.barcode || '—'}</div>
                        </td>
                        <td className="py-2.5 px-3 font-sans">
                          <div className="font-bold text-slate-100">{item.name}</div>
                          <div className="flex flex-wrap items-center gap-1 mt-0.5">
                            {item.company && (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] bg-sky-950/80 text-sky-300 border border-sky-800"
                                title={`Company: ${item.company}`}
                              >
                                <Building2 className="w-2.5 h-2.5 text-sky-400" />
                                {item.company}
                              </span>
                            )}
                            {(Array.isArray(item.brands) && item.brands.length > 0
                              ? item.brands
                              : [item.brand || 'Standard']
                            ).map((b, bi) => (
                              <span
                                key={bi}
                                className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] bg-slate-800 text-slate-300 border border-slate-700"
                              >
                                {b}
                              </span>
                            ))}
                            {Array.isArray(item.suppliers) && item.suppliers.length > 0 && (
                              <span
                                className="text-[9px] text-indigo-300 font-sans ml-1"
                                title={`Suppliers: ${item.suppliers.join(', ')}`}
                              >
                                • {item.suppliers.length} supp.
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-sans">
                          <div className="text-slate-200 font-medium">{item.category}</div>
                          <div className="text-[10px] text-slate-400">
                            {item.mainCategory ||
                              db.mainCategories?.find((m) => m.id === item.mainCategoryId)?.name ||
                              'General'}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-300">
                          {item.hsnCode || item.hsn || '—'}
                        </td>
                        <td className="py-2.5 px-3 font-sans">
                          <div className="font-bold text-emerald-400 font-mono">
                            {item.taxType === 'non-tax' ? '0%' : `${item.taxRate ?? 5}%`}
                          </div>
                          <span
                            className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-semibold uppercase ${
                              item.taxType === 'non-tax'
                                ? 'bg-slate-800 text-slate-400 border border-slate-700'
                                : item.taxType === 'exclusive'
                                ? 'bg-amber-950/80 text-amber-300 border border-amber-800'
                                : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                            }`}
                          >
                            {item.taxType || 'inclusive'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-sans">
                          <div className="flex flex-col gap-1 items-start">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                                item.hasStock !== false && !item.isService
                                  ? 'bg-cyan-950/80 text-cyan-300 border-cyan-800'
                                  : 'bg-amber-950/80 text-amber-300 border-amber-800'
                              }`}
                            >
                              {item.hasStock !== false && !item.isService ? 'Physical Stock' : 'Non-Stock / Service'}
                            </span>
                            <span
                              className={`text-[9px] font-bold ${
                                item.isSaleable !== false ? 'text-emerald-400' : 'text-slate-500'
                              }`}
                            >
                              {item.isSaleable !== false ? '✓ Saleable' : '✕ Non-Saleable'}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-sans">
                          {item.hasStock !== false && !item.isService ? (
                            <div>
                              <div className="text-amber-400 font-mono text-[11px]">
                                Alert: {item.reorderLevel ?? item.minStockAlert ?? 10} {item.uom || 'Pcs'}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                Expiry: {item.hasExpiryDate ? 'Yes (Tracked)' : 'No'}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-500 text-[11px] italic">N/A (Service)</span>
                          )}
                        </td>
                      </>
                    )}

                    {activeEntity === 'staff' && (
                      <>
                        <td className="py-2.5 px-3">
                          <div className="font-sans font-bold text-slate-100 flex items-center gap-2.5">
                            {item.photo ? (
                              <img
                                src={item.photo}
                                alt={item.name}
                                className="w-8 h-8 rounded-full object-cover border-2 border-indigo-500/50 shadow-sm shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700/60 flex items-center justify-center text-slate-400 shrink-0">
                                <User className="w-4 h-4" />
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span>{item.name}</span>
                                {item.isDiscontinued && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-950 text-rose-300 border border-rose-800">
                                    DISCONTINUED
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                {item.employeeCode || item.id}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-sans">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-950 text-indigo-300 border border-indigo-700 block w-fit mb-0.5">
                            {item.role?.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[10px] text-slate-400 block truncate max-w-[130px]">
                            {item.designation || 'Staff'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-sans text-slate-300">
                          {db.stores?.find((s) => s.id === item.storeId)?.name || 'All Branches'}
                        </td>
                        <td className="py-2.5 px-3 font-sans">
                          <div className="text-slate-300 font-mono text-[11px] font-semibold">
                            @{item.username || item.id}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate max-w-[140px]">
                            {item.phone || item.email || '—'}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-sans text-slate-400 text-[10px]">
                          {item.isDiscontinued ? (
                            <div>
                              <span className="text-rose-400 font-semibold block">Relieved: {item.discontinueDate || 'Yes'}</span>
                              <span className="text-slate-500 block truncate max-w-[120px]">{item.discontinueReason || 'Discontinued'}</span>
                            </div>
                          ) : (
                            <div>
                              <span className="text-slate-300 block">Joined: {item.dateOfJoining || 'Active'}</span>
                              <span className="text-emerald-400 font-medium block">In Service</span>
                            </div>
                          )}
                        </td>
                      </>
                    )}

                    {activeEntity === 'payment_mode' && (
                      <>
                        <td className="py-2.5 px-3 text-indigo-400 font-bold">{item.code}</td>
                        <td className="py-2.5 px-3 font-sans font-bold text-slate-100">{item.name}</td>
                        <td className="py-2.5 px-3 font-sans">
                          {item.tenderType === 'credit' || item.isCredit || (item.code || '').toUpperCase().includes('CREDIT') || (item.name || '').toLowerCase().includes('credit') ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-950 text-purple-300 border border-purple-800">
                              Credit / On-Account
                            </span>
                          ) : item.isElectronic || item.tenderType === 'electronic' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-950 text-blue-300 border border-blue-800">
                              Electronic / Digital
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
                              Cash / Physical
                            </span>
                          )}
                        </td>
                      </>
                    )}

                    {activeEntity === 'tax' && (
                      <>
                        <td className="py-2.5 px-3 font-mono font-bold text-emerald-400 text-sm">{item.rate}%</td>
                        <td className="py-2.5 px-3 font-sans">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                              item.taxType === 'GST' || (item.cgst > 0 || item.sgst > 0)
                                ? 'bg-indigo-950 text-indigo-300 border-indigo-800'
                                : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                            }`}
                          >
                            {item.taxType === 'GST' || (item.cgst > 0 || item.sgst > 0)
                              ? '🇮🇳 Dual GST (India)'
                              : '🌐 Single VAT / Tax (Outside India)'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-300 font-mono">
                          {item.taxType === 'GST' || (item.cgst > 0 || item.sgst > 0) ? `${item.cgst}%` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-300 font-mono">
                          {item.taxType === 'GST' || (item.cgst > 0 || item.sgst > 0) ? `${item.sgst}%` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-300 font-mono">{item.igst ?? item.rate}%</td>
                      </>
                    )}

                    {activeEntity === 'branch' && (
                      <>
                        <td className="py-2.5 px-3 text-indigo-400 font-bold">{item.code}</td>
                        <td className="py-2.5 px-3 font-sans font-bold text-slate-100">{item.name}</td>
                        <td className="py-2.5 px-3 font-sans text-slate-300">{item.city}</td>
                        <td className="py-2.5 px-3 font-sans text-slate-400">{item.state} ({item.stateCode})</td>
                        <td className="py-2.5 px-3 text-slate-300">
                          {item.gstin || '27AAACA1234F1Z9'}
                        </td>
                        <td className="py-2.5 px-3 font-sans">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              item.isDayOpen
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : 'bg-rose-950 text-rose-400 border border-rose-800'
                            }`}
                          >
                            {item.isDayOpen ? 'Day Open' : 'Day Closed'}
                          </span>
                        </td>
                      </>
                    )}

                    {/* Shared Status column for all entities */}
                    <td className="py-2.5 px-3 font-sans">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!canUpdate) {
                            notify('warning', `You do not have permission to update ${currentConfig.label}.`, 'Permission Denied');
                            return;
                          }
                          handleToggleActive(item);
                        }}
                        title={canUpdate ? 'Click to toggle Active / Inactive status' : 'Status (Update permission required to change)'}
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold border transition ${
                          canUpdate ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed opacity-90'
                        } ${
                          item.active !== false
                            ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                            : 'bg-rose-950 text-rose-400 border-rose-800'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            item.active !== false ? 'bg-emerald-400' : 'bg-rose-400'
                          }`}
                        />
                        {item.active !== false ? 'Active' : 'Inactive'}
                      </button>
                    </td>

                    {/* Action buttons */}
                    <td className="py-2.5 px-3 text-center font-sans">
                      <div className="flex items-center justify-center gap-1">
                        {canUpdate && (
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDelete && (() => {
                          const linkedCats =
                            activeEntity === 'main_category'
                              ? (db.categories || []).filter(
                                  (c) => c.mainCategoryId === item.id || (item.name && c.mainCategory === item.name)
                                )
                              : [];
                          const linkedProducts =
                            activeEntity === 'category'
                              ? getProductsLinkedToCategory(item, db.products)
                              : [];
                          const linkedProductsForBrand =
                            activeEntity === 'brand'
                              ? getProductsLinkedToBrand(item, db.products)
                              : [];
                          const linkedProductsForUnit =
                            activeEntity === 'unit'
                              ? getProductsLinkedToUnit(item, db.products)
                              : [];
                          const linkedProductsForCompany =
                            activeEntity === 'company'
                              ? getProductsLinkedToCompany(item, db.products)
                              : [];
                          const linkedInvoicesForPaymentMode =
                            activeEntity === 'payment_mode'
                              ? getInvoicesLinkedToPaymentMode(item, db.invoices)
                              : [];
                          const linkedProductsForTax =
                            activeEntity === 'tax'
                              ? (db.products || []).filter((p) => Number(p.taxRate) === Number(item.rate))
                              : [];
                          const isDeleteLocked =
                            (activeEntity === 'main_category' && linkedCats.length > 0) ||
                            (activeEntity === 'category' && linkedProducts.length > 0) ||
                            (activeEntity === 'brand' && linkedProductsForBrand.length > 0) ||
                            (activeEntity === 'unit' && linkedProductsForUnit.length > 0) ||
                            (activeEntity === 'company' && linkedProductsForCompany.length > 0) ||
                            (activeEntity === 'payment_mode' && linkedInvoicesForPaymentMode.length > 0) ||
                            (activeEntity === 'tax' && linkedProductsForTax.length > 0);

                          if (isDeleteLocked) {
                            const lockedMsg =
                              activeEntity === 'main_category'
                                ? `Delete Locked: Main Category is in use by ${linkedCats.length} category (${linkedCats.slice(0, 3).map((c) => c.name).join(', ')}${
                                    linkedCats.length > 3 ? '...' : ''
                                  }). Reassign or delete categories first.`
                                : activeEntity === 'category'
                                ? `Delete Locked: Category is in use by ${linkedProducts.length} product(s) (${linkedProducts.slice(0, 3).map((p) => p.name).join(', ')}${
                                    linkedProducts.length > 3 ? '...' : ''
                                  }). Reassign or delete products first.`
                                : activeEntity === 'brand'
                                ? `Delete Locked: Brand is in use by ${linkedProductsForBrand.length} product(s) (${linkedProductsForBrand.slice(0, 3).map((p) => p.name).join(', ')}${
                                    linkedProductsForBrand.length > 3 ? '...' : ''
                                  }). Reassign or delete products first.`
                                : activeEntity === 'unit'
                                ? `Delete Locked: Unit is in use by ${linkedProductsForUnit.length} product(s) (${linkedProductsForUnit.slice(0, 3).map((p) => p.name).join(', ')}${
                                    linkedProductsForUnit.length > 3 ? '...' : ''
                                  }). Reassign or delete products first.`
                                : activeEntity === 'company'
                                ? `Delete Locked: Company "${item.name}" is in use by ${linkedProductsForCompany.length} product(s) (${linkedProductsForCompany.slice(0, 3).map((p) => p.name).join(', ')}${
                                    linkedProductsForCompany.length > 3 ? '...' : ''
                                  }). Reassign or remove company from products first.`
                                : activeEntity === 'tax'
                                ? `Delete Locked: Tax Slab ${item.rate}% is in use by ${linkedProductsForTax.length} product(s) (${linkedProductsForTax.slice(0, 3).map((p) => p.name).join(', ')}${
                                    linkedProductsForTax.length > 3 ? '...' : ''
                                  }). Reassign or delete products first.`
                                : `Delete Locked: Payment Mode is in use by ${linkedInvoicesForPaymentMode.length} invoice(s) (${linkedInvoicesForPaymentMode.slice(0, 3).map((inv) => inv.docNumber || inv.id).join(', ')}${
                                    linkedInvoicesForPaymentMode.length > 3 ? '...' : ''
                                  }). Cannot delete active billing payment mode.`;

                            return (
                              <button
                                type="button"
                                disabled
                                className="p-1 rounded bg-slate-800/90 text-amber-400 border border-amber-800/50 cursor-not-allowed transition"
                                title={lockedMsg}
                              >
                                <Lock className="w-3.5 h-3.5" />
                              </button>
                            );
                          }

                          return (
                            <button
                              onClick={() => handleDelete(item)}
                              className="p-1 rounded bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 transition"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          );
                        })()}
                        {!canUpdate && !canDelete && (
                          <span className="text-[10px] text-slate-500 italic">Read-only</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4">
          <div
            className={`bg-slate-900 border border-slate-800 rounded-2xl w-full overflow-hidden shadow-2xl p-4 sm:p-5 space-y-4 max-h-[92vh] flex flex-col ${
              activeEntity === 'staff' || activeEntity === 'product' ? 'max-w-3xl' : 'max-w-lg'
            }`}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0 gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 shrink-0">
                  <Icon className={`w-4 h-4 ${currentConfig.color}`} />
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-slate-100 text-sm sm:text-base truncate">
                    {editingItem ? `Edit ${currentConfig.label}` : `Add New ${currentConfig.label}`}
                  </h4>
                  <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">
                    {editingItem ? `Update ${currentConfig.label.toLowerCase()} details` : `Configure master ${currentConfig.label.toLowerCase()} entity`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition shrink-0"
                title="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs overflow-y-auto pr-1 flex-1 scrollbar-thin">
              {/* Product Form */}
              {activeEntity === 'product' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Basic Identification */}
                  <div className="col-span-2 space-y-1">
                    <label className="font-semibold text-slate-300 block">Product Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Basmati Rice 5kg or Standard Delivery Fee"
                      className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-slate-100 ${
                        isProductNameDuplicate
                          ? 'border-rose-500 focus:border-rose-400 focus:ring-1 focus:ring-rose-500'
                          : 'border-slate-700 focus:border-indigo-500'
                      }`}
                    />
                    {isProductNameDuplicate && (
                      <div className="flex items-center gap-1.5 text-rose-400 text-[11px] font-medium mt-1">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          Product name "{formData.name}" already exists{duplicateProductByName ? ` (${duplicateProductByName.sku})` : ''}. Name must be unique.
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-300 block">SKU Code *</label>
                    <input
                      type="text"
                      required
                      value={formData.sku || ''}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                      placeholder="e.g. RIC-BAS-5K"
                      className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-slate-100 font-mono ${
                        isProductSkuDuplicate
                          ? 'border-rose-500 focus:border-rose-400 focus:ring-1 focus:ring-rose-500'
                          : 'border-slate-700 focus:border-indigo-500'
                      }`}
                    />
                    {isProductSkuDuplicate && (
                      <div className="flex items-center gap-1.5 text-rose-400 text-[11px] font-medium mt-1">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          SKU "{formData.sku}" already exists{duplicateProductBySku ? ` (${duplicateProductBySku.name})` : ''}. SKU must be unique.
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-300 block">Barcode / EAN</label>
                    <input
                      type="text"
                      value={formData.barcode || ''}
                      onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                      placeholder="e.g. 8901234001012"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:border-indigo-500"
                    />
                  </div>

                  {/* Main Category & Category under Main Category */}
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-300 block">Main Category *</label>
                    <select
                      value={formData.mainCategoryId || ''}
                      onChange={(e) => {
                        const newMainCatId = e.target.value;
                        const matchedMain = (db.mainCategories || []).find((m) => m.id === newMainCatId);
                        const subCats = (db.categories || []).filter(
                          (c) => c.mainCategoryId === newMainCatId || (matchedMain?.name && c.mainCategory === matchedMain.name)
                        );
                        const nextCat = subCats[0] || (db.categories || [])[0];
                        setFormData({
                          ...formData,
                          mainCategoryId: newMainCatId,
                          mainCategory: matchedMain?.name || '',
                          category: nextCat?.name || '',
                          categoryId: nextCat?.id || '',
                          hsnCode: nextCat?.hsnCode || formData.hsnCode || '',
                          taxRate: nextCat?.defaultTaxRate !== undefined ? nextCat.defaultTaxRate : formData.taxRate,
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-indigo-500 font-medium"
                    >
                      {(db.mainCategories || []).map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-300 block">Category (Under Main Category) *</label>
                    <select
                      value={formData.category || ''}
                      onChange={(e) => {
                        const catName = e.target.value;
                        const catObj = (db.categories || []).find((c) => c.name === catName);
                        setFormData({
                          ...formData,
                          category: catName,
                          categoryId: catObj?.id || '',
                          hsnCode: catObj?.hsnCode || formData.hsnCode || '',
                          taxRate: catObj?.defaultTaxRate !== undefined ? catObj.defaultTaxRate : formData.taxRate,
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-indigo-500 font-medium"
                    >
                      {(() => {
                        const subCats = (db.categories || []).filter(
                          (c) =>
                            c.mainCategoryId === formData.mainCategoryId ||
                            (formData.mainCategory && c.mainCategory === formData.mainCategory)
                        );
                        const listToRender = subCats.length > 0 ? subCats : (db.categories || []);
                        return listToRender.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name} {c.hsnCode ? `(HSN: ${c.hsnCode})` : ''}
                          </option>
                        ));
                      })()}
                    </select>
                    {(() => {
                      const subCats = (db.categories || []).filter(
                        (c) =>
                          c.mainCategoryId === formData.mainCategoryId ||
                          (formData.mainCategory && c.mainCategory === formData.mainCategory)
                      );
                      return (
                        <span className="text-[10px] text-slate-400">
                          {subCats.length > 0
                            ? `${subCats.length} category/categories listed under this Main Category`
                            : 'All categories shown'}
                        </span>
                      );
                    })()}
                  </div>

                  {/* Multiple Brand Selection */}
                  <div className="col-span-2">
                    <MultiSelectDropdown
                      label="Brands (Multiple Brand Selection) *"
                      placeholder="Select one or more brands..."
                      emptyText="No brands configured in master"
                      options={(db.brands || []).map((b) => ({
                        value: b.name,
                        label: b.name,
                        chipLabel: b.name,
                        subtext: b.code,
                      }))}
                      selectedValues={formData.brands || []}
                      onChange={(newBrands) =>
                        setFormData({
                          ...formData,
                          brands: newBrands,
                          brand: newBrands.join(', '),
                        })
                      }
                    />
                  </div>

                  {/* Multiple Supplier Selection */}
                  <div className="col-span-2">
                    <MultiSelectDropdown
                      label="Suppliers (Multiple Supplier Selection)"
                      placeholder="Select one or more suppliers..."
                      emptyText="No suppliers configured in master"
                      options={(db.suppliers || []).map((s) => ({
                        value: s.id,
                        label: `${s.name} (${s.code || s.id})`,
                        chipLabel: s.name,
                        subtext: s.supplyType || (s.stateCode !== '27' ? 'Interstate' : 'Local'),
                      }))}
                      selectedValues={formData.supplierIds || []}
                      onChange={(newIds) => {
                        const matched = (db.suppliers || []).filter((s) => newIds.includes(s.id));
                        setFormData({
                          ...formData,
                          supplierIds: newIds,
                          suppliers: matched.map((m) => m.name),
                          supplier: matched[0]?.name || '',
                        });
                      }}
                    />
                  </div>

                  {/* Company / Manufacturer (Optional) */}
                  <div className="col-span-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="font-semibold text-slate-300 block">Company / Manufacturer</label>
                      <span className="text-[10px] text-slate-400 font-mono">Optional</span>
                    </div>
                    <select
                      value={formData.companyId || ''}
                      onChange={(e) => {
                        const compId = e.target.value;
                        const matched = (db.companies || []).find((c) => c.id === compId);
                        setFormData({
                          ...formData,
                          companyId: compId,
                          company: matched ? matched.name : '',
                          companyCode: matched ? (matched.code || '') : '',
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-indigo-500 font-medium"
                    >
                      <option value="">-- None / No Company Selected --</option>
                      {(db.companies || []).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.code ? `(${c.code})` : ''} {c.mfg ? `• MFG: ${c.mfg}` : ''}
                        </option>
                      ))}
                    </select>
                    <span className="text-[10px] text-slate-400">
                      Optionally assign the parent manufacturing company to this product
                    </span>
                  </div>

                  {/* Statutory & Taxation: HSN, Tax Type, Tax Rate, UOM */}
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-300 block">HSN / SAC Code *</label>
                    <input
                      type="text"
                      required
                      value={formData.hsnCode || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          hsnCode: e.target.value.replace(/\D/g, '').slice(0, 8),
                        })
                      }
                      placeholder="e.g. 1006 or 9988"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:border-indigo-500"
                    />
                    <span className="text-[10px] text-slate-500">4-8 digit HSN (goods) or SAC (services)</span>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-300 block">Tax Type *</label>
                    <select
                      value={formData.taxType || 'inclusive'}
                      onChange={(e) => {
                        const newTaxType = e.target.value;
                        setFormData({
                          ...formData,
                          taxType: newTaxType,
                          taxRate: newTaxType === 'non-tax' ? 0 : (formData.taxRate || 5),
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-indigo-500 font-medium"
                    >
                      <option value="inclusive">Tax Inclusive (Price includes tax)</option>
                      <option value="exclusive">Tax Exclusive (Tax added at billing)</option>
                      <option value="non-tax">Non-Tax / Exempt (0% Tax / Exempt)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-300 block">
                      {formData.taxType === 'non-tax' ? 'Tax Rate (Exempt)' : 'GST / Tax Rate (%) *'}
                    </label>
                    <select
                      disabled={formData.taxType === 'non-tax'}
                      value={formData.taxType === 'non-tax' ? 0 : (formData.taxRate ?? 5)}
                      onChange={(e) => setFormData({ ...formData, taxRate: Number(e.target.value) })}
                      className={`w-full border rounded-lg px-3 py-2 font-medium ${
                        formData.taxType === 'non-tax'
                          ? 'bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed'
                          : 'bg-slate-950 border-slate-700 text-slate-100 focus:border-indigo-500'
                      }`}
                    >
                      <option value="0">0% (Nil / Exempt)</option>
                      <option value="5">5% (Essential)</option>
                      <option value="12">12% (Standard Low)</option>
                      <option value="18">18% (Standard General)</option>
                      <option value="28">28% (Luxury / Higher)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-300 block">Unit of Measurement (UOM) *</label>
                    <select
                      value={formData.uom || 'Pcs'}
                      onChange={(e) => setFormData({ ...formData, uom: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-indigo-500 font-medium"
                    >
                      {(db.units || []).map((u) => (
                        <option key={u.id} value={u.code}>
                          {u.code} - {u.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Stock & Operational Attributes */}
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-300 block">Have Stock (Inventory Tracking) *</label>
                    <select
                      value={formData.hasStock !== false ? 'yes' : 'no'}
                      onChange={(e) => {
                        const hasStockBool = e.target.value === 'yes';
                        setFormData({
                          ...formData,
                          hasStock: hasStockBool,
                          hasExpiryDate: hasStockBool ? formData.hasExpiryDate : false,
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-indigo-500 font-medium"
                    >
                      <option value="yes">Yes - Physical Stock (Track quantity & ledger)</option>
                      <option value="no">No - Non-Stock / Service (e.g. Packing, Labour charge)</option>
                    </select>
                    <span className="text-[10px] text-slate-400">
                      {formData.hasStock !== false
                        ? 'Warehouse inventory balance and ledger are tracked'
                        : 'For service charges like Packing charge, Labour charge, Delivery fee'}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-300 block">Saleable Status *</label>
                    <select
                      value={formData.isSaleable !== false ? 'saleable' : 'non_saleable'}
                      onChange={(e) => setFormData({ ...formData, isSaleable: e.target.value === 'saleable' })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-indigo-500 font-medium"
                    >
                      <option value="saleable">Saleable (Allowed on POS & Sales Invoices)</option>
                      <option value="non_saleable">Non-Saleable (Internal consumable / Raw material)</option>
                    </select>
                    <span className="text-[10px] text-slate-400">
                      {formData.isSaleable !== false
                        ? 'Product can be sold and billed to customers'
                        : 'Blocked from point of sale customer billing'}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-300 block">Expiry Date Tracking *</label>
                    <select
                      disabled={formData.hasStock === false}
                      value={formData.hasStock === false ? 'no' : (formData.hasExpiryDate ? 'yes' : 'no')}
                      onChange={(e) => setFormData({ ...formData, hasExpiryDate: e.target.value === 'yes' })}
                      className={`w-full border rounded-lg px-3 py-2 font-medium ${
                        formData.hasStock === false
                          ? 'bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed'
                          : 'bg-slate-950 border-slate-700 text-slate-100 focus:border-indigo-500'
                      }`}
                    >
                      <option value="no">No (Standard / Non-perishable)</option>
                      <option value="yes">Yes (Perishable / Track batch expiry date)</option>
                    </select>
                    <span className="text-[10px] text-slate-400">
                      {formData.hasStock === false
                        ? 'Not applicable for non-stock items'
                        : formData.hasExpiryDate
                        ? 'Batch expiry validation enabled'
                        : 'No batch expiry validation required'}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-300 block">Reorder Level (Min Stock Alert) *</label>
                    <input
                      type="number"
                      min="0"
                      disabled={formData.hasStock === false}
                      value={
                        formData.hasStock === false
                          ? 0
                          : (formData.reorderLevel !== undefined ? formData.reorderLevel : (formData.minStockAlert || 10))
                      }
                      onChange={(e) => {
                        const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                        setFormData({ ...formData, reorderLevel: val, minStockAlert: val });
                      }}
                      placeholder="e.g. 10"
                      className={`w-full border rounded-lg px-3 py-2 font-mono ${
                        formData.hasStock === false
                          ? 'bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed'
                          : 'bg-slate-950 border-slate-700 text-slate-100 focus:border-indigo-500'
                      }`}
                    />
                    <span className="text-[10px] text-slate-400">
                      {formData.hasStock === false
                        ? 'Not applicable for non-stock items'
                        : 'Triggers replenishment alert when warehouse stock drops below this number'}
                    </span>
                  </div>
                </div>
              )}

              {/* Branch / Store Form */}
              {activeEntity === 'branch' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1">
                    <label className="font-semibold text-slate-300 block">Branch / Store Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Apex Superstore - Andheri"
                      className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-slate-100 ${
                        isBranchNameDuplicate
                          ? 'border-rose-500 focus:border-rose-400 focus:ring-1 focus:ring-rose-500'
                          : 'border-slate-700 focus:border-indigo-500'
                      }`}
                    />
                    {isBranchNameDuplicate && (
                      <div className="flex items-center gap-1.5 text-rose-400 text-[11px] font-medium mt-1">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          Branch name "{formData.name}" already exists{duplicateBranchByName ? ` (${duplicateBranchByName.code})` : ''}. Name must be unique.
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-300 block">Branch Code *</label>
                    <input
                      type="text"
                      required
                      value={formData.code || ''}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      placeholder="e.g. STR-MUM-01"
                      className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-slate-100 font-mono ${
                        isBranchCodeDuplicate
                          ? 'border-rose-500 focus:border-rose-400 focus:ring-1 focus:ring-rose-500'
                          : 'border-slate-700 focus:border-indigo-500'
                      }`}
                    />
                    {isBranchCodeDuplicate && (
                      <div className="flex items-center gap-1.5 text-rose-400 text-[11px] font-medium mt-1">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          Branch code "{formData.code}" already exists{duplicateBranchByCode ? ` (${duplicateBranchByCode.name})` : ''}. Code must be unique.
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-300 block">City</label>
                    <input
                      type="text"
                      value={formData.city || ''}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="e.g. Mumbai"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-300 block">State *</label>
                    <select
                      value={formData.stateCode || '27'}
                      onChange={(e) => {
                        const newCode = e.target.value;
                        const matched = statesList.find((s) => s.code === newCode);
                        setFormData({
                          ...formData,
                          stateCode: newCode,
                          state: matched?.name || 'Maharashtra',
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-indigo-500 font-medium"
                    >
                      {statesList.map((st) => (
                        <option key={st.code} value={st.code}>
                          {st.code} - {st.name} {st.type === 'UT' ? '(UT)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-300 block">Phone / Helpline</label>
                    <input
                      type="text"
                      value={formData.phone || ''}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="e.g. +91 22 2490 1100"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-indigo-500"
                    />
                  </div>

                  <div className="col-span-2 space-y-1">
                    <label className="font-semibold text-slate-300 block">Store Address</label>
                    <input
                      type="text"
                      value={formData.address || ''}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Street / Mall / Complex address"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}

              {/* Company Form */}
              {activeEntity === 'company' && (
                <div className="grid grid-cols-2 gap-3">
                  {/* Referential Integrity / Locked notice when editing Company */}
                  {editingItem && (() => {
                    const linkedProducts = getProductsLinkedToCompany(editingItem, db.products);
                    if (linkedProducts.length > 0) {
                      return (
                        <div className="col-span-2 p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl flex items-start gap-2.5 text-amber-300 text-xs">
                          <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-semibold text-amber-200">
                              Referential Protection: Deletion Locked
                            </div>
                            <p className="text-[11px] text-amber-300/80 mt-0.5">
                              This Company is currently assigned to {linkedProducts.length} product(s) ({linkedProducts.map((p) => p.name).join(', ')}). Its delete button is locked to protect product references.
                            </p>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <div className="col-span-2 space-y-1">
                    <label className="font-semibold text-slate-300 block">Company Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Nestlé India Limited, Sun Pharma, etc."
                      className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-slate-100 ${
                        isCompanyNameDuplicate
                          ? 'border-rose-500 focus:border-rose-400 focus:ring-1 focus:ring-rose-500'
                          : 'border-slate-700 focus:border-indigo-500'
                      }`}
                    />
                    {isCompanyNameDuplicate && (
                      <div className="flex items-center gap-1.5 text-rose-400 text-[11px] font-medium mt-1">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          Company name "{formData.name}" already exists{duplicateCompanyByName ? ` (${duplicateCompanyByName.code})` : ''}. Name must be unique.
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-300 block">Company Code *</label>
                    <input
                      type="text"
                      required
                      value={formData.code || ''}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      placeholder="e.g. CMP-001 or NESTLE"
                      className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-slate-100 font-mono ${
                        isCompanyCodeDuplicate
                          ? 'border-rose-500 focus:border-rose-400 focus:ring-1 focus:ring-rose-500'
                          : 'border-slate-700 focus:border-indigo-500'
                      }`}
                    />
                    {isCompanyCodeDuplicate && (
                      <div className="flex items-center gap-1.5 text-rose-400 text-[11px] font-medium mt-1">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          Company code "{formData.code}" already exists{duplicateCompanyByCode ? ` (${duplicateCompanyByCode.name})` : ''}. Code must be unique.
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-300 block">MFG (Manufacturer / License No.)</label>
                    <input
                      type="text"
                      value={formData.mfg || ''}
                      onChange={(e) => setFormData({ ...formData, mfg: e.target.value })}
                      placeholder="e.g. MFG-LIC/2024/9918 or FSSAI-1001"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:border-indigo-500"
                    />
                  </div>

                  <div className="col-span-2 space-y-1">
                    <label className="font-semibold text-slate-300 block">Contact Information</label>
                    <input
                      type="text"
                      value={formData.contact || ''}
                      onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                      placeholder="e.g. +91 22 2490 1200 / contact@company.com"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-indigo-500"
                    />
                    <span className="text-[10px] text-slate-500">Contact person, phone number, or official email</span>
                  </div>

                  <div className="col-span-2 space-y-1">
                    <label className="font-semibold text-slate-300 block">Registered / Factory Address</label>
                    <textarea
                      rows={2}
                      value={formData.address || ''}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Corporate headquarters or factory address..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}

              {/* Generic Name & Code Form for categories, brands, units, payment modes */}
              {activeEntity !== 'product' &&
                activeEntity !== 'staff' &&
                activeEntity !== 'supplier' &&
                activeEntity !== 'branch' &&
                activeEntity !== 'tax' &&
                activeEntity !== 'company' && (
                  <div className="space-y-3">
                    {/* Referential Integrity / Locked notice when editing Main Category */}
                    {activeEntity === 'main_category' && editingItem && (() => {
                      const linkedCats = (db.categories || []).filter(
                        (c) => c.mainCategoryId === editingItem.id || (editingItem.name && c.mainCategory === editingItem.name)
                      );
                      if (linkedCats.length > 0) {
                        return (
                          <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl flex items-start gap-2.5 text-amber-300 text-xs">
                            <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                            <div>
                              <div className="font-semibold text-amber-200">
                                Referential Protection: Deletion Locked
                              </div>
                              <p className="text-[11px] text-amber-300/80 mt-0.5">
                                This Main Category is currently linked to {linkedCats.length} sub-categor{linkedCats.length === 1 ? 'y' : 'ies'} ({linkedCats.map((c) => c.name).join(', ')}). Deletion is locked to protect category relationships.
                              </p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* Referential Integrity / Locked notice when editing Category */}
                    {activeEntity === 'category' && editingItem && (() => {
                      const linkedProducts = getProductsLinkedToCategory(editingItem, db.products);
                      if (linkedProducts.length > 0) {
                        return (
                          <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl flex items-start gap-2.5 text-amber-300 text-xs">
                            <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                            <div>
                              <div className="font-semibold text-amber-200">
                                Referential Protection: Deletion Locked
                              </div>
                              <p className="text-[11px] text-amber-300/80 mt-0.5">
                                This Category is currently in use by {linkedProducts.length} product(s) ({linkedProducts.map((p) => p.name).join(', ')}). Its delete button is locked to prevent orphaned product inventory.
                              </p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* Referential Integrity / Locked notice when editing Brand */}
                    {activeEntity === 'brand' && editingItem && (() => {
                      const linkedProducts = getProductsLinkedToBrand(editingItem, db.products);
                      if (linkedProducts.length > 0) {
                        return (
                          <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl flex items-start gap-2.5 text-amber-300 text-xs">
                            <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                            <div>
                              <div className="font-semibold text-amber-200">
                                Referential Protection: Deletion Locked
                              </div>
                              <p className="text-[11px] text-amber-300/80 mt-0.5">
                                This Brand is currently in use by {linkedProducts.length} product(s) ({linkedProducts.map((p) => p.name).join(', ')}). Its delete button is locked to prevent broken product references.
                              </p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* Referential Integrity / Locked notice when editing Unit */}
                    {activeEntity === 'unit' && editingItem && (() => {
                      const linkedProducts = getProductsLinkedToUnit(editingItem, db.products);
                      if (linkedProducts.length > 0) {
                        return (
                          <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl flex items-start gap-2.5 text-amber-300 text-xs">
                            <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                            <div>
                              <div className="font-semibold text-amber-200">
                                Referential Protection: Deletion Locked
                              </div>
                              <p className="text-[11px] text-amber-300/80 mt-0.5">
                                This Unit is currently in use by {linkedProducts.length} product(s) ({linkedProducts.map((p) => p.name).join(', ')}). Its delete button is locked to prevent orphaned product inventory UOM references.
                              </p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    <div className="space-y-1">
                      <label className="font-semibold text-slate-300 block">{currentConfig.label} Name *</label>
                      <input
                        type="text"
                        required
                        value={formData.name || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          const updates = { name: val };
                          if (activeEntity === 'payment_mode') {
                            // if mode is credit then tender type choose according to that
                            if (val.trim().toLowerCase().includes('credit')) {
                              updates.tenderType = 'credit';
                              updates.isCredit = true;
                              updates.isElectronic = false;
                            }
                          }
                          setFormData({ ...formData, ...updates });
                        }}
                        placeholder={
                          activeEntity === 'main_category'
                            ? 'e.g. Groceries & Staples'
                            : activeEntity === 'category'
                            ? 'e.g. Rice & Grains'
                            : activeEntity === 'brand'
                            ? 'e.g. Tata Consumer'
                            : activeEntity === 'unit'
                            ? 'e.g. Kilograms'
                            : activeEntity === 'payment_mode'
                            ? 'e.g. UPI / Google Pay, Cash, or Customer Credit'
                            : ''
                        }
                        className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-slate-100 ${
                          (activeEntity === 'main_category' && isMainCatNameDuplicate) ||
                          (activeEntity === 'category' && isCatNameInMainCatDuplicate) ||
                          (activeEntity === 'brand' && isBrandNameDuplicate) ||
                          (activeEntity === 'unit' && isUnitNameDuplicate) ||
                          (activeEntity === 'payment_mode' && isPaymentModeNameDuplicate)
                            ? 'border-rose-500 focus:border-rose-400 focus:ring-1 focus:ring-rose-500'
                            : 'border-slate-700 focus:border-indigo-500'
                        }`}
                      />
                      {activeEntity === 'main_category' && isMainCatNameDuplicate && (
                        <div className="flex items-center gap-1.5 text-rose-400 text-[11px] font-medium mt-1">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>Main Category name "{formData.name}" already exists. Name must be unique.</span>
                        </div>
                      )}
                      {activeEntity === 'category' && isCatNameInMainCatDuplicate && (
                        <div className="flex items-center gap-1.5 text-rose-400 text-[11px] font-medium mt-1">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            Category "{formData.name}" already exists under Main Category "
                            {(db.mainCategories || []).find((m) => m.id === (formData.mainCategoryId || db.mainCategories?.[0]?.id))?.name || 'Selected Main Category'}
                            ". Same category with same main category is not allowed.
                          </span>
                        </div>
                      )}
                      {activeEntity === 'brand' && isBrandNameDuplicate && (
                        <div className="flex items-center gap-1.5 text-rose-400 text-[11px] font-medium mt-1">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>Brand name "{formData.name}" already exists. Name must be unique.</span>
                        </div>
                      )}
                      {activeEntity === 'unit' && isUnitNameDuplicate && (
                        <div className="flex items-center gap-1.5 text-rose-400 text-[11px] font-medium mt-1">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            Unit name "{formData.name}" already exists{duplicateUnitByName ? ` (${duplicateUnitByName.code})` : ''}. Name must be unique.
                          </span>
                        </div>
                      )}
                      {activeEntity === 'payment_mode' && isPaymentModeNameDuplicate && (
                        <div className="flex items-center gap-1.5 text-rose-400 text-[11px] font-medium mt-1">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            Payment Mode name "{formData.name}" already exists{duplicatePaymentModeByName ? ` (${duplicatePaymentModeByName.code})` : ''}. Name must be unique.
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-300 block">
                        Code / Identifier {activeEntity === 'main_category' || activeEntity === 'category' || activeEntity === 'brand' || activeEntity === 'unit' || activeEntity === 'payment_mode' ? '*' : ''}
                      </label>
                      <input
                        type="text"
                        required={activeEntity === 'main_category' || activeEntity === 'category' || activeEntity === 'brand' || activeEntity === 'unit' || activeEntity === 'payment_mode'}
                        value={formData.code || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          const updates = { code: val };
                          if (activeEntity === 'payment_mode') {
                            // if mode is credit then tender type choose according to that
                            if (val.trim().toLowerCase().includes('credit')) {
                              updates.tenderType = 'credit';
                              updates.isCredit = true;
                              updates.isElectronic = false;
                            }
                          }
                          setFormData({ ...formData, ...updates });
                        }}
                        placeholder={
                          activeEntity === 'main_category'
                            ? 'e.g. GROC'
                            : activeEntity === 'category'
                            ? 'e.g. RICE'
                            : activeEntity === 'brand'
                            ? 'e.g. TATA'
                            : activeEntity === 'unit'
                            ? 'e.g. KGS'
                            : activeEntity === 'payment_mode'
                            ? 'e.g. UPI, CASH, or CREDIT'
                            : ''
                        }
                        className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-slate-100 ${
                          (activeEntity === 'main_category' && isMainCatCodeDuplicate) ||
                          (activeEntity === 'category' && isCatCodeDuplicate) ||
                          (activeEntity === 'brand' && isBrandCodeDuplicate) ||
                          (activeEntity === 'unit' && isUnitCodeDuplicate) ||
                          (activeEntity === 'payment_mode' && isPaymentModeCodeDuplicate)
                            ? 'border-rose-500 focus:border-rose-400 focus:ring-1 focus:ring-rose-500'
                            : 'border-slate-700 focus:border-indigo-500'
                        }`}
                      />
                      {activeEntity === 'main_category' && isMainCatCodeDuplicate && (
                        <div className="flex items-center gap-1.5 text-rose-400 text-[11px] font-medium mt-1">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>Main Category code "{formData.code}" already exists. Code must be unique.</span>
                        </div>
                      )}
                      {activeEntity === 'category' && isCatCodeDuplicate && (
                        <div className="flex items-center gap-1.5 text-rose-400 text-[11px] font-medium mt-1">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>Category Code "{formData.code}" already exists. Code must be unique.</span>
                        </div>
                      )}
                      {activeEntity === 'brand' && isBrandCodeDuplicate && (
                        <div className="flex items-center gap-1.5 text-rose-400 text-[11px] font-medium mt-1">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>Brand code "{formData.code}" already exists. Code must be unique.</span>
                        </div>
                      )}
                      {activeEntity === 'unit' && isUnitCodeDuplicate && (
                        <div className="flex items-center gap-1.5 text-rose-400 text-[11px] font-medium mt-1">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            Unit code "{formData.code}" already exists{duplicateUnitByCode ? ` (${duplicateUnitByCode.name})` : ''}. Code must be unique.
                          </span>
                        </div>
                      )}
                      {activeEntity === 'payment_mode' && isPaymentModeCodeDuplicate && (
                        <div className="flex items-center gap-1.5 text-rose-400 text-[11px] font-medium mt-1">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            Payment Mode code "{formData.code}" already exists{duplicatePaymentModeByCode ? ` (${duplicatePaymentModeByCode.name})` : ''}. Code must be unique.
                          </span>
                        </div>
                      )}
                    </div>
                    {(activeEntity === 'main_category' || activeEntity === 'unit') && (
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-300 block">Description</label>
                        <textarea
                          rows={2}
                          value={formData.description || ''}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          placeholder={
                            activeEntity === 'unit'
                              ? 'e.g. Weight metric kilogram (UOM standard)'
                              : 'Brief description of merchandise and items grouped in this main category...'
                          }
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-indigo-500"
                        />
                      </div>
                    )}
                    {activeEntity === 'category' && (
                      <div className="space-y-3 pt-1 border-t border-slate-800">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="font-semibold text-slate-300 block">Main Category *</label>
                            <select
                              value={formData.mainCategoryId || db.mainCategories?.[0]?.id || ''}
                              onChange={(e) => setFormData({ ...formData, mainCategoryId: e.target.value })}
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-indigo-500"
                            >
                              {(db.mainCategories || []).map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name} ({m.code})
                                </option>
                              ))}
                            </select>
                            <span className="text-[10px] text-slate-400 block">
                              Parent Main Category classification
                            </span>
                          </div>
                          <div className="space-y-1">
                            <label className="font-semibold text-slate-300 block">HSN Code (Numbers Only)</label>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              maxLength={8}
                              value={formData.hsnCode || ''}
                              onChange={(e) => {
                                // Allow only numeric characters (0-9)
                                const numericDigits = e.target.value.replace(/\D/g, '').slice(0, 8);
                                setFormData({ ...formData, hsnCode: numericDigits });
                              }}
                              onKeyDown={(e) => {
                                // Allow navigation & control keys
                                if (
                                  ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) ||
                                  (e.ctrlKey || e.metaKey)
                                ) {
                                  return;
                                }
                                // Block any non-digit character
                                if (!/^[0-9]$/.test(e.key)) {
                                  e.preventDefault();
                                }
                              }}
                              placeholder="e.g. 1006 or 10063020"
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-indigo-500 font-mono tracking-wider"
                            />
                            <span className="text-[10px] text-slate-400 block">
                              2 to 8 digits GST HSN (Digits only)
                            </span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="font-semibold text-slate-300 block">Default GST Rate %</label>
                          <select
                            value={formData.defaultTaxRate ?? 5}
                            onChange={(e) => setFormData({ ...formData, defaultTaxRate: Number(e.target.value) })}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-indigo-500 font-bold text-emerald-400"
                          >
                            <option value={0}>GST 0% (Nil / Exempted)</option>
                            <option value={5}>GST 5% (Essential Goods)</option>
                            <option value={12}>GST 12% (Standard Low)</option>
                            <option value={18}>GST 18% (Standard General)</option>
                            <option value={28}>GST 28% (Luxury / Sin Goods)</option>
                          </select>
                          <span className="text-[10px] text-slate-400 block">
                            Default tax rate applied to products in this category
                          </span>
                        </div>
                      </div>
                    )}
                    {activeEntity === 'brand' && (
                      <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-800">
                        <div className="space-y-1">
                          <label className="font-semibold text-slate-300 block">Manufacturer</label>
                          <input
                            type="text"
                            value={formData.manufacturer || ''}
                            onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                            placeholder="e.g. Tata Consumer Products Ltd"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-indigo-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="font-semibold text-slate-300 block">Country of Origin</label>
                          <input
                            type="text"
                            value={formData.country || 'India'}
                            onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                            placeholder="e.g. India"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-indigo-500"
                          />
                        </div>
                      </div>
                    )}
                    {activeEntity === 'unit' && (
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-300 block">Allow Decimal Values</label>
                        <select
                          value={formData.allowDecimal ? 'true' : 'false'}
                          onChange={(e) => setFormData({ ...formData, allowDecimal: e.target.value === 'true' })}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-indigo-500"
                        >
                          <option value="false">No (Discrete Integer Units e.g. Pcs, Box)</option>
                          <option value="true">Yes (Fractional Units e.g. Kg, Litre, Mtr)</option>
                        </select>
                      </div>
                    )}
                    {activeEntity === 'payment_mode' && (
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-300 block">Tender Type *</label>
                        <select
                          value={
                            formData.tenderType ||
                            (formData.isCredit || (formData.code || '').trim().toLowerCase().includes('credit') || (formData.name || '').trim().toLowerCase().includes('credit')
                              ? 'credit'
                              : formData.isElectronic
                              ? 'electronic'
                              : 'cash')
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormData({
                              ...formData,
                              tenderType: val,
                              isCredit: val === 'credit',
                              isElectronic: val === 'electronic',
                            });
                          }}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-indigo-500 font-medium"
                        >
                          <option value="cash">Cash / Physical Currency (Cash Register)</option>
                          <option value="electronic">Electronic / Digital / Bank (Cards, UPI, Cheques)</option>
                          <option value="credit">Credit / Customer Credit (Ledger / On-Account)</option>
                        </select>
                        <span className="text-[10px] text-slate-400 block">
                          {(formData.tenderType === 'credit' || (formData.code || '').trim().toLowerCase().includes('credit') || (formData.name || '').trim().toLowerCase().includes('credit'))
                            ? '⚡ Mode configured as Credit: Bills settled to customer outstanding ledger balance.'
                            : formData.tenderType === 'electronic' || formData.isElectronic
                            ? '⚡ Mode configured as Electronic: Digital bank reconciliation and gateway tracking.'
                            : '⚡ Mode configured as Cash: Physical tender verified against cash drawer at day close.'}
                        </span>
                      </div>
                    )}
                  </div>
                )}

              {/* Dedicated Tax Slab Form (No Tax Name required; International Single VAT vs Dual Indian GST) */}
              {activeEntity === 'tax' && (
                <div className="space-y-4">
                  {/* Regime Switcher */}
                  <div className="space-y-1.5">
                    <label className="font-semibold text-slate-300 block">
                      Tax Regime / Model *
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const r = Number(formData.rate || 5);
                          setFormData({
                            ...formData,
                            taxType: 'VAT',
                            rate: r,
                            cgst: 0,
                            sgst: 0,
                            igst: r,
                            cess: 0,
                          });
                        }}
                        className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 ${
                          (formData.taxType || 'VAT') === 'VAT'
                            ? 'bg-indigo-950/70 border-indigo-500 text-indigo-200 shadow-md ring-1 ring-indigo-500/50'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 font-bold text-xs">
                          <Globe className="w-4 h-4 text-indigo-400 shrink-0" />
                          <span>Single Tax / VAT (Outside India)</span>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-relaxed">
                          For GCC (UAE, Saudi Arabia, Oman), UK, EU, Singapore, US sales tax. Flat single rate without CGST / SGST breakdown.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const r = Number(formData.rate || 5);
                          setFormData({
                            ...formData,
                            taxType: 'GST',
                            rate: r,
                            cgst: r / 2,
                            sgst: r / 2,
                            igst: r,
                            cess: Number(formData.cess || 0),
                          });
                        }}
                        className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 ${
                          formData.taxType === 'GST'
                            ? 'bg-indigo-950/70 border-indigo-500 text-indigo-200 shadow-md ring-1 ring-indigo-500/50'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 font-bold text-xs">
                          <span className="text-sm">🇮🇳</span>
                          <span>Dual GST (India)</span>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-relaxed">
                          For Indian GST regulations. Automatically splits into intra-state CGST (50%) + SGST (50%) and inter-state IGST (100%).
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Tax Rate % Input and Preset Buttons */}
                  <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="font-semibold text-slate-200 block text-xs">
                          Tax Rate Percentage (%) *
                        </label>
                        <span className="text-[11px] font-mono text-emerald-400 font-bold">
                          {formData.rate !== undefined && formData.rate !== '' ? `${formData.rate}%` : '0%'}
                        </span>
                      </div>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          required
                          value={formData.rate !== undefined ? formData.rate : ''}
                          onChange={(e) => {
                            const val = e.target.value === '' ? '' : Number(e.target.value);
                            const r = Number(val || 0);
                            if (formData.taxType === 'GST') {
                              setFormData({
                                ...formData,
                                rate: val,
                                cgst: r / 2,
                                sgst: r / 2,
                                igst: r,
                              });
                            } else {
                              setFormData({
                                ...formData,
                                rate: val,
                                cgst: 0,
                                sgst: 0,
                                igst: r,
                                cess: 0,
                              });
                            }
                          }}
                          placeholder="e.g. 5, 12, 15, 18, 20"
                          className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-slate-100 font-mono text-sm ${
                            isTaxRateDuplicate
                              ? 'border-rose-500 focus:border-rose-400 focus:ring-1 focus:ring-rose-500'
                              : 'border-slate-700 focus:border-indigo-500'
                          }`}
                        />
                        <span className="absolute right-3 top-2.5 text-slate-400 font-bold text-xs pointer-events-none">
                          %
                        </span>
                      </div>

                      {/* Duplicate Tax Rate Warning */}
                      {isTaxRateDuplicate && (
                        <div className="flex items-center gap-1.5 text-rose-400 text-[11px] font-medium mt-1 p-2 bg-rose-950/40 border border-rose-800/60 rounded-lg">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                          <span>
                            A {formData.taxType === 'GST' ? 'Dual GST' : 'Single VAT/Tax'} slab with rate {formData.rate}% already exists{duplicateTaxByRate ? ` (${duplicateTaxByRate.name})` : ''}. Tax rates under the same regime must be unique.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Dual GST Components (Only shown when regime is Indian Dual GST) */}
                  {formData.taxType === 'GST' && (
                    <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-200">GST Component Breakdown</span>
                        <span className="text-[10px] text-indigo-400 font-medium">Auto-calculated from Total Rate</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-slate-400 block">CGST (Intra-state)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={formData.cgst !== undefined ? formData.cgst : (Number(formData.rate || 0) / 2)}
                            onChange={(e) => setFormData({ ...formData, cgst: Number(e.target.value) })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 font-mono text-xs focus:border-indigo-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-slate-400 block">SGST (Intra-state)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={formData.sgst !== undefined ? formData.sgst : (Number(formData.rate || 0) / 2)}
                            onChange={(e) => setFormData({ ...formData, sgst: Number(e.target.value) })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 font-mono text-xs focus:border-indigo-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-slate-400 block">IGST (Inter-state)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={formData.igst !== undefined ? formData.igst : Number(formData.rate || 0)}
                            onChange={(e) => setFormData({ ...formData, igst: Number(e.target.value) })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 font-mono text-xs focus:border-indigo-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-slate-400 block">Cess % (Optional)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={formData.cess || 0}
                            onChange={(e) => setFormData({ ...formData, cess: Number(e.target.value) })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 font-mono text-xs focus:border-indigo-500"
                          />
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span>Intra-state bills split {Number(formData.cgst || 0)}% CGST + {Number(formData.sgst || 0)}% SGST; Inter-state bills charge {Number(formData.igst || formData.rate || 0)}% IGST.</span>
                      </div>
                    </div>
                  )}

                  {/* Single VAT Info Card (Shown when regime is Outside India) */}
                  {(formData.taxType || 'VAT') === 'VAT' && (
                    <div className="p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-xl space-y-1 text-xs">
                      <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>International Single Flat VAT / Tax Mode Active</span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        Tax is computed as a single flat percentage ({formData.rate || 0}%) applied directly on line subtotals. No CGST/SGST splitting or Indian state codes required. On POS receipts and invoices, tax will appear simply as <span className="font-bold text-white">VAT ({formData.rate || 0}%)</span>.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Staff Form: Personal, Employment, Credentials, and Discontinue Details */}
              {activeEntity === 'staff' && (
                <div className="space-y-4">
                  {/* Segmented Sub-Tab Switcher */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setStaffFormTab('personal')}
                      className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg transition ${
                        staffFormTab === 'personal'
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-white hover:bg-slate-900'
                      }`}
                    >
                      <User className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">Personal Details</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStaffFormTab('employment')}
                      className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg transition ${
                        staffFormTab === 'employment'
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-white hover:bg-slate-900'
                      }`}
                    >
                      <Briefcase className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">Employment</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStaffFormTab('credentials')}
                      className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg transition ${
                        staffFormTab === 'credentials'
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-white hover:bg-slate-900'
                      }`}
                    >
                      <KeyRound className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">Credentials</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStaffFormTab('discontinue')}
                      className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg transition ${
                        staffFormTab === 'discontinue'
                          ? 'bg-rose-600 text-white shadow-md'
                          : formData.isDiscontinued
                          ? 'text-rose-400 hover:bg-slate-900'
                          : 'text-slate-400 hover:text-white hover:bg-slate-900'
                      }`}
                    >
                      <UserX className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">Discontinue</span>
                      {formData.isDiscontinued && (
                        <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse shrink-0" />
                      )}
                    </button>
                  </div>

                  {/* 1. Personal Details Tab */}
                  {staffFormTab === 'personal' && (
                    <div className="space-y-4 pt-1">
                      {/* Profile Photo Uploader Card */}
                      <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl flex flex-wrap items-center gap-4">
                        <div className="relative group shrink-0">
                          {formData.photo ? (
                            <img
                              src={formData.photo}
                              alt="Staff Profile"
                              className="w-16 h-16 rounded-full object-cover border-2 border-indigo-500 shadow-md ring-4 ring-indigo-500/10"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-full bg-slate-900 border-2 border-dashed border-slate-700 flex flex-col items-center justify-center text-slate-400 group-hover:border-indigo-500 transition">
                              <Camera className="w-6 h-6 text-slate-500 group-hover:text-indigo-400 transition" />
                              <span className="text-[9px] mt-0.5">No Photo</span>
                            </div>
                          )}
                          {formData.photo && (
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, photo: '' })}
                              className="absolute -top-1 -right-1 bg-rose-600 hover:bg-rose-500 text-white rounded-full p-1 shadow-md transition"
                              title="Remove Photo"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        <div className="flex-1 min-w-[240px] space-y-2">
                          <div>
                            <div className="font-bold text-xs text-slate-100 flex items-center gap-1.5">
                              <Camera className="w-3.5 h-3.5 text-indigo-400" />
                              Staff Profile Photo
                            </div>
                            <p className="text-[10px] text-slate-400">
                              Upload employee photograph (PNG, JPG, WebP) or provide an image link.
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow transition">
                              <Upload className="w-3.5 h-3.5" />
                              <span>Upload Photo</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handlePhotoUpload}
                              />
                            </label>

                            <div className="flex-1 min-w-[180px]">
                              <input
                                type="url"
                                placeholder="Or enter image URL (https://...)"
                                value={formData.photo || ''}
                                onChange={(e) => setFormData({ ...formData, photo: e.target.value })}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 text-xs focus:border-indigo-500"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="md:col-span-2 space-y-1">
                          <label className="font-semibold text-slate-300 block text-xs">Staff Full Name *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Priya Sharma"
                            value={formData.name || ''}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:border-indigo-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="font-semibold text-slate-300 block text-xs">Gender</label>
                          <select
                            value={formData.gender || 'Female'}
                            onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:border-indigo-500"
                          >
                            <option value="Female">Female</option>
                            <option value="Male">Male</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="font-semibold text-slate-300 block text-xs">Date of Birth</label>
                          <input
                            type="date"
                            value={formData.dob || ''}
                            onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:border-indigo-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="font-semibold text-slate-300 block text-xs">Primary Mobile / Phone *</label>
                          <input
                            type="tel"
                            required
                            placeholder="e.g. +91 98200 12345"
                            value={formData.phone || ''}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:border-indigo-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="font-semibold text-slate-300 block text-xs">Emergency / Alt Phone</label>
                          <input
                            type="tel"
                            placeholder="e.g. +91 98200 54321"
                            value={formData.altPhone || ''}
                            onChange={(e) => setFormData({ ...formData, altPhone: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:border-indigo-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="font-semibold text-slate-300 block text-xs">Personal Email</label>
                          <input
                            type="email"
                            placeholder="e.g. priya.personal@gmail.com"
                            value={formData.personalEmail || ''}
                            onChange={(e) => setFormData({ ...formData, personalEmail: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:border-indigo-500"
                          />
                        </div>

                        <div className="md:col-span-2 space-y-1">
                          <label className="font-semibold text-slate-300 block text-xs">National ID / Aadhaar / PAN</label>
                          <input
                            type="text"
                            placeholder="e.g. ABCDE1234F or 1234 5678 9012"
                            value={formData.nationalId || ''}
                            onChange={(e) => setFormData({ ...formData, nationalId: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:border-indigo-500"
                          />
                        </div>

                        <div className="md:col-span-3 space-y-1">
                          <label className="font-semibold text-slate-300 block text-xs">Residential Address</label>
                          <input
                            type="text"
                            placeholder="Flat / Building, Street, Area"
                            value={formData.address || ''}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:border-indigo-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="font-semibold text-slate-300 block text-xs">City</label>
                          <input
                            type="text"
                            placeholder="Mumbai"
                            value={formData.city || ''}
                            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:border-indigo-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="font-semibold text-slate-300 block text-xs">State</label>
                          <input
                            type="text"
                            placeholder="Maharashtra"
                            value={formData.state || ''}
                            onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:border-indigo-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="font-semibold text-slate-300 block text-xs">Pincode</label>
                          <input
                            type="text"
                            placeholder="400001"
                            value={formData.pincode || ''}
                            onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:border-indigo-500"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 2. Employment Details Tab */}
                  {staffFormTab === 'employment' && (
                    <div className="space-y-3 pt-1">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="font-semibold text-slate-300 block text-xs">Employee / Staff Code *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. EMP-001"
                            value={formData.employeeCode || ''}
                            onChange={(e) => setFormData({ ...formData, employeeCode: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono text-xs focus:border-indigo-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="font-semibold text-slate-300 block text-xs">Branch / Store Assignment *</label>
                          <select
                            value={formData.storeId || ''}
                            onChange={(e) => setFormData({ ...formData, storeId: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:border-indigo-500"
                          >
                            {(db.stores || []).map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name} ({s.city})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="font-semibold text-slate-300 block text-xs">Designation / Job Title *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Senior POS Cashier"
                            value={formData.designation || ''}
                            onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:border-indigo-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="font-semibold text-slate-300 block text-xs">Date of Joining *</label>
                          <input
                            type="date"
                            required
                            value={formData.dateOfJoining || ''}
                            onChange={(e) => setFormData({ ...formData, dateOfJoining: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:border-indigo-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="font-semibold text-slate-300 block text-xs">Employment Type</label>
                          <select
                            value={formData.employmentType || 'Full-Time'}
                            onChange={(e) => setFormData({ ...formData, employmentType: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:border-indigo-500"
                          >
                            <option value="Full-Time">Full-Time (Permanent)</option>
                            <option value="Part-Time">Part-Time</option>
                            <option value="Contract">Contractual / Temporary</option>
                            <option value="Probation">Probation / Trainee</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="font-semibold text-slate-300 block text-xs">Monthly Basic Pay (₹)</label>
                          <input
                            type="number"
                            placeholder="e.g. 25000"
                            value={formData.basicPay || ''}
                            onChange={(e) => setFormData({ ...formData, basicPay: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:border-indigo-500"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 3. Login Credentials Tab */}
                  {staffFormTab === 'credentials' && (
                    <div className="space-y-3 pt-1">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="font-semibold text-slate-300 block text-xs">Login Username *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. priya.cashier"
                            value={formData.username || ''}
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono text-xs focus:border-indigo-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="font-semibold text-slate-300 block text-xs">Official Login Email *</label>
                          <input
                            type="email"
                            required
                            placeholder="e.g. priya.cashier@apex.in"
                            value={formData.email || ''}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:border-indigo-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="font-semibold text-slate-300 block text-xs">Terminal Password *</label>
                          <div className="relative">
                            <input
                              type={showStaffPassword ? 'text' : 'password'}
                              required
                              placeholder="Min 6 characters"
                              value={formData.password || ''}
                              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-3 pr-9 py-2 text-slate-100 font-mono text-xs focus:border-indigo-500"
                            />
                            <button
                              type="button"
                              onClick={() => setShowStaffPassword(!showStaffPassword)}
                              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                            >
                              {showStaffPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="font-semibold text-slate-300 block text-xs">Security Role & Privileges *</label>
                          <select
                            value={formData.roleId || 'ROLE_CASHIER'}
                            onChange={(e) => {
                              const rId = e.target.value;
                              const rObj = db.roles?.find((r) => r.id === rId);
                              setFormData({
                                ...formData,
                                roleId: rId,
                                role: rObj?.code || rObj?.name || rId,
                              });
                            }}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:border-indigo-500 font-semibold"
                          >
                            {(db.roles || []).map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name} ({r.category || 'System'})
                              </option>
                            ))}
                          </select>
                        </div>



                        <div className="md:col-span-2 flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800">
                          <div>
                            <div className="font-semibold text-slate-200 text-xs">Terminal Login Enabled</div>
                            <div className="text-[10px] text-slate-400">
                              Allow this employee to sign in to NexBill POS and Management terminals
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={formData.terminalAccess !== false}
                            onChange={(e) => setFormData({ ...formData, terminalAccess: e.target.checked })}
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-700"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 4. Discontinue Details Tab */}
                  {staffFormTab === 'discontinue' && (
                    <div className="space-y-3 pt-1">
                      <div
                        className={`p-3.5 rounded-xl border flex items-center justify-between transition ${
                          formData.isDiscontinued
                            ? 'bg-rose-950/50 border-rose-500/50 text-rose-200'
                            : 'bg-slate-950 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <UserX className={`w-5 h-5 ${formData.isDiscontinued ? 'text-rose-400' : 'text-slate-500'}`} />
                          <div>
                            <div className="font-bold text-xs">
                              {formData.isDiscontinued ? 'Staff Member Discontinued' : 'Active Staff Status'}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {formData.isDiscontinued
                                ? 'This staff member is relieved. Terminal login and postings will be permanently blocked.'
                                : 'Toggle to mark staff as resigned, terminated, or transferred.'}
                            </div>
                          </div>
                        </div>

                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.isDiscontinued || false}
                            onChange={(e) => {
                              const isDisc = e.target.checked;
                              setFormData({
                                ...formData,
                                isDiscontinued: isDisc,
                                active: !isDisc,
                                blockLogin: isDisc,
                                discontinueDate: isDisc ? (formData.discontinueDate || new Date().toISOString().split('T')[0]) : '',
                              });
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600" />
                        </label>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                        <div className="space-y-1">
                          <label className="font-semibold text-slate-300 block text-xs">Date of Leaving / Relieving</label>
                          <input
                            type="date"
                            value={formData.discontinueDate || ''}
                            onChange={(e) => setFormData({ ...formData, discontinueDate: e.target.value })}
                            disabled={!formData.isDiscontinued}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:border-indigo-500 disabled:opacity-40"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="font-semibold text-slate-300 block text-xs">Reason for Discontinuation</label>
                          <select
                            value={formData.discontinueReason || ''}
                            onChange={(e) => setFormData({ ...formData, discontinueReason: e.target.value })}
                            disabled={!formData.isDiscontinued}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:border-indigo-500 disabled:opacity-40"
                          >
                            <option value="">Select Reason...</option>
                            <option value="Resigned">Voluntary Resignation</option>
                            <option value="Terminated">Terminated / Dismissed</option>
                            <option value="Contract Expired">Contract Period Expired</option>
                            <option value="Transferred">Transferred to Another Branch / Entity</option>
                            <option value="Retirement">Retirement</option>
                            <option value="Health">Medical / Health Reasons</option>
                            <option value="Other">Other / Personal Reasons</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="font-semibold text-slate-300 block text-xs">Asset Clearance & Handover</label>
                          <select
                            value={formData.clearanceStatus || 'Pending'}
                            onChange={(e) => setFormData({ ...formData, clearanceStatus: e.target.value })}
                            disabled={!formData.isDiscontinued}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:border-indigo-500 disabled:opacity-40"
                          >
                            <option value="Pending">Pending Clearance</option>
                            <option value="Assets Handed Over">Organization Assets Handed Over</option>
                            <option value="Full & Final Settled">Full & Final Settlement Completed</option>
                          </select>
                        </div>

                        <div className="space-y-1 flex flex-col justify-end">
                          <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.blockLogin || false}
                              onChange={(e) => setFormData({ ...formData, blockLogin: e.target.checked })}
                              disabled={!formData.isDiscontinued}
                              className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-700"
                            />
                            <span className="text-xs text-slate-300 font-semibold">Block System Login Immediately</span>
                          </label>
                        </div>

                        <div className="md:col-span-2 space-y-1">
                          <label className="font-semibold text-slate-300 block text-xs">Handover Remarks & Settlement Notes</label>
                          <textarea
                            rows={3}
                            placeholder="Details on asset handover, cash register audit, final settlement remarks..."
                            value={formData.discontinueRemarks || ''}
                            onChange={(e) => setFormData({ ...formData, discontinueRemarks: e.target.value })}
                            disabled={!formData.isDiscontinued}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:border-indigo-500 disabled:opacity-40 resize-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Supplier Form */}
              {activeEntity === 'supplier' && (
                <div className="space-y-4">
                  {/* Section 1: Basic Information & Contact */}
                  <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-800 text-xs font-bold text-slate-200">
                      <Truck className="w-4 h-4 text-blue-400" />
                      <span>Supplier Details & Identification</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="md:col-span-2 space-y-1">
                        <label className="font-semibold text-slate-300 block text-xs">Supplier Name *</label>
                        <input
                          type="text"
                          required
                          value={formData.name || ''}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="e.g. AgroFresh Commodities LLP"
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:border-indigo-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-semibold text-slate-300 block text-xs">Supplier Code</label>
                        <input
                          type="text"
                          value={formData.code || ''}
                          onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                          placeholder="e.g. SUP-AGRO-01"
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:border-indigo-500 font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-semibold text-slate-300 block text-xs">Contact Person</label>
                        <input
                          type="text"
                          value={formData.contactPerson || ''}
                          onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                          placeholder="e.g. Suresh Patil"
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:border-indigo-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-semibold text-slate-300 block text-xs">Mobile Number *</label>
                        <div className="relative">
                          <input
                            type="tel"
                            required
                            maxLength={10}
                            value={formData.phone || ''}
                            onChange={(e) => {
                              const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                              setFormData({ ...formData, phone: digits });
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
                            placeholder="e.g. 9820112233"
                            className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-slate-100 text-xs font-mono tracking-wider ${
                              isSupplierPhoneDuplicate || isSupplierPhoneIncomplete
                                ? 'border-rose-500 focus:border-rose-400 focus:ring-1 focus:ring-rose-500'
                                : 'border-slate-700 focus:border-indigo-500'
                            }`}
                          />
                        </div>
                        {isSupplierPhoneDuplicate && duplicateSupplier && (
                          <div className="flex items-center gap-1.5 text-rose-400 text-[11px] font-medium mt-1">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              Mobile "{formData.phone}" is already in use by "{duplicateSupplier.name}" ({duplicateSupplier.id}).
                            </span>
                          </div>
                        )}
                        {isSupplierPhoneIncomplete && (
                          <div className="flex items-center gap-1.5 text-amber-400 text-[11px] font-medium mt-1">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>Mobile must be 10 digits ({supplierPhoneCleaned.length}/10 entered).</span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label className="font-semibold text-slate-300 block text-xs">Email Address</label>
                        <input
                          type="email"
                          value={formData.email || ''}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder="e.g. orders@agrofresh.in"
                          className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-slate-100 text-xs ${
                            isSupplierEmailInvalid
                              ? 'border-rose-500 focus:border-rose-400 focus:ring-1 focus:ring-rose-500'
                              : 'border-slate-700 focus:border-indigo-500'
                          }`}
                        />
                        {isSupplierEmailInvalid && (
                          <div className="flex items-center gap-1.5 text-rose-400 text-[11px] font-medium mt-1">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>Please enter a valid email format (e.g. name@domain.com).</span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label className="font-semibold text-slate-300 block text-xs">GSTIN (15 Digits)</label>
                        <input
                          type="text"
                          maxLength={15}
                          value={formData.gstin || ''}
                          onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                          placeholder="e.g. 27AAAFB1111C1Z0"
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:border-indigo-500 font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section 2: State, District & Address */}
                  <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-800 text-xs font-bold text-slate-200 gap-1">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>State & Geography</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-normal">
                        GST classification & regional address
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Local or Interstate Selector */}
                      <div className="md:col-span-2 space-y-1.5">
                        <label className="font-semibold text-slate-300 block text-xs">
                          Local / Interstate *
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, supplyType: 'LOCAL' })}
                            className={`p-2.5 rounded-lg border text-left flex items-start gap-2.5 transition ${
                              (formData.supplyType || (formData.stateCode !== '27' ? 'INTERSTATE' : 'LOCAL')) === 'LOCAL'
                                ? 'bg-emerald-950/70 border-emerald-500 text-emerald-100 shadow-sm'
                                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                            }`}
                          >
                            <div
                              className={`w-3.5 h-3.5 rounded-full mt-0.5 border flex items-center justify-center ${
                                (formData.supplyType || (formData.stateCode !== '27' ? 'INTERSTATE' : 'LOCAL')) === 'LOCAL'
                                  ? 'border-emerald-400 bg-emerald-400'
                                  : 'border-slate-600 bg-transparent'
                              }`}
                            >
                              {(formData.supplyType || (formData.stateCode !== '27' ? 'INTERSTATE' : 'LOCAL')) === 'LOCAL' && (
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />
                              )}
                            </div>
                            <div>
                              <div className="font-bold text-xs text-slate-100">Local</div>
                              <div className="text-[10px] text-slate-400">CGST + SGST applied within same state</div>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, supplyType: 'INTERSTATE' })}
                            className={`p-2.5 rounded-lg border text-left flex items-start gap-2.5 transition ${
                              (formData.supplyType || (formData.stateCode !== '27' ? 'INTERSTATE' : 'LOCAL')) === 'INTERSTATE'
                                ? 'bg-purple-950/70 border-purple-500 text-purple-100 shadow-sm'
                                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                            }`}
                          >
                            <div
                              className={`w-3.5 h-3.5 rounded-full mt-0.5 border flex items-center justify-center ${
                                (formData.supplyType || (formData.stateCode !== '27' ? 'INTERSTATE' : 'LOCAL')) === 'INTERSTATE'
                                  ? 'border-purple-400 bg-purple-400'
                                  : 'border-slate-600 bg-transparent'
                              }`}
                            >
                              {(formData.supplyType || (formData.stateCode !== '27' ? 'INTERSTATE' : 'LOCAL')) === 'INTERSTATE' && (
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />
                              )}
                            </div>
                            <div>
                              <div className="font-bold text-xs text-slate-100">Interstate</div>
                              <div className="text-[10px] text-slate-400">Integrated GST (IGST) across states</div>
                            </div>
                          </button>
                        </div>
                      </div>

                      {/* State Dropdown */}
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-300 block text-xs">State *</label>
                        <select
                          value={formData.stateCode || '27'}
                          onChange={(e) => {
                            const newCode = e.target.value;
                            const matched = statesList.find((s) => s.code === newCode);
                            // Auto-suggest supplyType based on whether state is Maharashtra (27)
                            const autoSupply = newCode !== '27' ? 'INTERSTATE' : 'LOCAL';
                            setFormData({
                              ...formData,
                              stateCode: newCode,
                              state: matched?.name || 'Maharashtra',
                              supplyType: autoSupply,
                            });
                          }}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:border-indigo-500 font-medium"
                        >
                          {statesList.map((st) => (
                            <option key={st.code} value={st.code}>
                              {st.code} - {st.name} {st.type === 'UT' ? '(UT)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* District Input */}
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-300 block text-xs">District</label>
                        <input
                          type="text"
                          value={formData.district || ''}
                          onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                          placeholder="e.g. Mumbai City, Pune, Nagpur"
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:border-indigo-500"
                        />
                      </div>

                      {/* City Input */}
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-300 block text-xs">City / Town</label>
                        <input
                          type="text"
                          value={formData.city || ''}
                          onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                          placeholder="e.g. Mumbai"
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:border-indigo-500"
                        />
                      </div>

                      {/* Registered Address */}
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-300 block text-xs">Registered Address</label>
                        <input
                          type="text"
                          value={formData.address || ''}
                          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                          placeholder="Premises, Street, Area"
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Financial & Bank Account Details */}
                  <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-800 text-xs font-bold text-slate-200 gap-1">
                      <div className="flex items-center gap-2">
                        <Landmark className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>Bank & Financial Details</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-normal">
                        Settlement & payment details
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-300 block text-xs">Opening Balance (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.openingBalance ?? 0}
                          onChange={(e) => setFormData({ ...formData, openingBalance: Number(e.target.value) })}
                          placeholder="0.00"
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:border-indigo-500 font-mono text-amber-400 font-bold"
                        />
                        <span className="text-[10px] text-slate-500 block">Initial credit/payable balance on cutover</span>
                      </div>

                      <div className="space-y-1">
                        <label className="font-semibold text-slate-300 block text-xs">Bank Name</label>
                        <input
                          type="text"
                          value={formData.bankName || ''}
                          onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                          placeholder="e.g. HDFC Bank Ltd"
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:border-indigo-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-semibold text-slate-300 block text-xs">Account Number</label>
                        <input
                          type="text"
                          value={formData.accountNumber || ''}
                          onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value.replace(/\D/g, '') })}
                          placeholder="e.g. 50200012345678"
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:border-indigo-500 font-mono tracking-wider"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-semibold text-slate-300 block text-xs">IFSC Code</label>
                        <input
                          type="text"
                          maxLength={11}
                          value={formData.ifscCode || ''}
                          onChange={(e) => setFormData({ ...formData, ifscCode: e.target.value.toUpperCase() })}
                          placeholder="e.g. HDFC0000123"
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:border-indigo-500 font-mono uppercase"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-semibold text-slate-300 block text-xs">Branch Name</label>
                        <input
                          type="text"
                          value={formData.branchName || ''}
                          onChange={(e) => setFormData({ ...formData, branchName: e.target.value })}
                          placeholder="e.g. Andheri East Branch"
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:border-indigo-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-semibold text-slate-300 block text-xs">Account Beneficiary Name</label>
                        <input
                          type="text"
                          value={formData.accountHolderName || ''}
                          onChange={(e) => setFormData({ ...formData, accountHolderName: e.target.value })}
                          placeholder={formData.name || 'Account Beneficiary Name'}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Active / Inactive Status Selector for ALL Master Forms */}
              <div className="pt-2 border-t border-slate-800 space-y-1">
                <label className="font-semibold text-slate-300 block">Status *</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, active: true })}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition border ${
                      formData.active !== false
                        ? 'bg-emerald-950/80 border-emerald-500 text-emerald-400 shadow-sm'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        formData.active !== false ? 'bg-emerald-400' : 'bg-slate-600'
                      }`}
                    ></span>
                    <span>Active (Enabled)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, active: false })}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition border ${
                      formData.active === false
                        ? 'bg-rose-950/80 border-rose-500 text-rose-400 shadow-sm'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${formData.active === false ? 'bg-rose-400' : 'bg-slate-600'}`}
                    ></span>
                    <span>Inactive (Disabled)</span>
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    isMainCatCodeDuplicate ||
                    isMainCatNameDuplicate ||
                    isCatCodeDuplicate ||
                    isCatNameInMainCatDuplicate ||
                    isBrandCodeDuplicate ||
                    isBrandNameDuplicate ||
                    isUnitCodeDuplicate ||
                    isUnitNameDuplicate ||
                    isCompanyCodeDuplicate ||
                    isCompanyNameDuplicate ||
                    isPaymentModeCodeDuplicate ||
                    isPaymentModeNameDuplicate ||
                    isSupplierPhoneDuplicate ||
                    isTaxRateDuplicate ||
                    isBranchCodeDuplicate ||
                    isBranchNameDuplicate ||
                    isProductSkuDuplicate ||
                    isProductNameDuplicate ||
                    (activeEntity === 'tax' && (formData.rate === undefined || formData.rate === '' || isNaN(Number(formData.rate)) || Number(formData.rate) < 0)) ||
                    (activeEntity === 'supplier' && (!formData.phone || (formData.phone || '').replace(/\D/g, '').length !== 10))
                  }
                  className={`px-4 py-1.5 rounded-lg font-bold shadow-md transition ${
                    isMainCatCodeDuplicate ||
                    isMainCatNameDuplicate ||
                    isCatCodeDuplicate ||
                    isCatNameInMainCatDuplicate ||
                    isBrandCodeDuplicate ||
                    isBrandNameDuplicate ||
                    isUnitCodeDuplicate ||
                    isUnitNameDuplicate ||
                    isCompanyCodeDuplicate ||
                    isCompanyNameDuplicate ||
                    isPaymentModeCodeDuplicate ||
                    isPaymentModeNameDuplicate ||
                    isSupplierPhoneDuplicate ||
                    isTaxRateDuplicate ||
                    isBranchCodeDuplicate ||
                    isBranchNameDuplicate ||
                    isProductSkuDuplicate ||
                    isProductNameDuplicate ||
                    (activeEntity === 'tax' && (formData.rate === undefined || formData.rate === '' || isNaN(Number(formData.rate)) || Number(formData.rate) < 0)) ||
                    (activeEntity === 'supplier' && (!formData.phone || (formData.phone || '').replace(/\D/g, '').length !== 10))
                      ? 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-60'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
                  }`}
                  title={
                    isMainCatCodeDuplicate
                      ? 'Cannot save: Main Category code already exists'
                      : isMainCatNameDuplicate
                      ? 'Cannot save: Main Category name already exists'
                      : isCatCodeDuplicate
                      ? 'Cannot save: Category code already exists'
                      : isCatNameInMainCatDuplicate
                      ? 'Cannot save: Category with this name already exists under the selected Main Category'
                      : isBrandCodeDuplicate
                      ? 'Cannot save: Brand code already exists'
                      : isBrandNameDuplicate
                      ? 'Cannot save: Brand name already exists'
                      : isUnitCodeDuplicate
                      ? 'Cannot save: Unit code already exists'
                      : isUnitNameDuplicate
                      ? 'Cannot save: Unit name already exists'
                      : isCompanyCodeDuplicate
                      ? 'Cannot save: Company code already exists'
                      : isCompanyNameDuplicate
                      ? 'Cannot save: Company name already exists'
                      : isPaymentModeCodeDuplicate
                      ? 'Cannot save: Payment mode code already exists'
                      : isPaymentModeNameDuplicate
                      ? 'Cannot save: Payment mode name already exists'
                      : isSupplierPhoneDuplicate
                      ? 'Cannot save: Supplier mobile number already registered'
                      : activeEntity === 'supplier' && (!formData.phone || (formData.phone || '').replace(/\D/g, '').length !== 10)
                      ? 'Cannot save: Supplier mobile number must be exactly 10 digits'
                      : isTaxRateDuplicate
                      ? `Cannot save: A ${formData.taxType === 'GST' ? 'Dual GST' : 'Single VAT / Tax'} rate of ${formData.rate}% already exists`
                      : activeEntity === 'tax' && (formData.rate === undefined || formData.rate === '' || isNaN(Number(formData.rate)) || Number(formData.rate) < 0)
                      ? 'Cannot save: Tax Rate must be a valid non-negative percentage'
                      : isBranchCodeDuplicate
                      ? 'Cannot save: Branch code already exists'
                      : isBranchNameDuplicate
                      ? 'Cannot save: Branch name already exists'
                      : isProductSkuDuplicate
                      ? 'Cannot save: Product SKU code already exists'
                      : isProductNameDuplicate
                      ? 'Cannot save: Product name already exists'
                      : `Save ${currentConfig.label}`
                  }
                >
                  Save {currentConfig.label}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
