// PurchasingView: Inward Purchases, Branch Selection, Product Search & Enhanced Grid, PO Conversion, Margins, Tax Split-ups & Actions (View/Edit/Print/Delete)
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { PurchasePostingService } from '../../services/purchasePostingService.js';
import { StockService } from '../../services/stockService.js';
import { saveDatabase, logAuditEvent, logBacklog } from '../../services/storageService.js';
import { numberToWords } from '../../utils/numberToWords.js';
import {
  Truck,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Trash2,
  Search,
  Eye,
  Edit,
  Printer,
  X,
  Building2,
  Calendar,
  DollarSign,
  Filter,
  Check,
  FileText,
  Barcode,
  ChevronDown,
  ShoppingBag,
  Store,
  Tag,
  Percent,
  Layers,
  Link as LinkIcon,
  Unlink,
  Lock,
  ArrowRight,
  TrendingUp,
  RefreshCw,
  PackageCheck,
  AlertCircle,
} from 'lucide-react';
import ExportButtons from '../common/ExportButtons.jsx';
import { getProductStockRates, getLatestHistoricalPurchaseRate, calculatePurchaseLine } from '../../services/purchaseRateHelper.js';

export { getProductStockRates, getLatestHistoricalPurchaseRate, calculatePurchaseLine };

export default function PurchasingView() {
  const { db, activeCompany, activeStore, activeWarehouse, currentUser, notify, triggerRefresh } = useApp();

  // Navigation tab: list | new
  const [activeTab, setActiveTab] = useState('list');

  // Search & Filter state for List View
  const [listTypeFilter, setListTypeFilter] = useState('ALL'); // 'ALL' | 'PURCHASE' | 'INITIAL_STOCK'
  const [listSearchQuery, setListSearchQuery] = useState('');
  const [listBranchFilter, setListBranchFilter] = useState('ALL');
  const [listSupplierFilter, setListSupplierFilter] = useState('ALL');

  // Purchase Form State
  const [editingPurchaseId, setEditingPurchaseId] = useState(null);
  const [formData, setFormData] = useState({
    docNumber: '',
    date: new Date().toISOString().split('T')[0],
    storeId: activeStore?.id || db.stores?.[0]?.id || 'STR-01',
    supplierId: db.suppliers?.[0]?.id || '',
    supplierInvoiceNo: '',
    supplierInvoiceDate: new Date().toISOString().split('T')[0],
    supplierInvoiceAmount: '',
    purchaseTaxType: 'inclusive', // 'inclusive' | 'exclusive'
    isInitialStock: false,
    entryType: 'PURCHASE', // 'PURCHASE' | 'INITIAL_STOCK'
    poId: null,
    poNumber: null,
    lines: [],
    discountType: 'FLAT', // FLAT | PERCENT
    discountValue: 0,
    otherCharges: 0,
    otherChargesRemark: '',
    paymentMode: 'CASH',
    paymentStatus: 'PAID',
    paidAmount: '',
    notes: '',
  });

  // Product Catalog Filter Mode: 'all' | 'supplier'
  const [productFilterMode, setProductFilterMode] = useState(
    db.settings?.purchaseProductFilterMode || 'all'
  );

  // Search & Autocomplete in Purchase Entry Grid
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [highlightedSuggestionIndex, setHighlightedSuggestionIndex] = useState(-1);
  const searchContainerRef = useRef(null);
  const suggestionItemRefs = useRef([]);

  // Rate Chooser Modal
  const [rateModal, setRateModal] = useState({
    isOpen: false,
    product: null,
    rates: [],
    targetLineIdx: null,
    customRate: '',
  });

  // PO Selector Modal State
  const [isPOModalOpen, setIsPOModalOpen] = useState(false);
  const [poSearchQuery, setPOSearchQuery] = useState('');

  // View, Print, Delete Modals
  const [viewingPurchase, setViewingPurchase] = useState(null);
  const [printingPurchase, setPrintingPurchase] = useState(null);
  const [deletingPurchase, setDeletingPurchase] = useState(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync productFilterMode with settings if changed elsewhere
  useEffect(() => {
    if (db.settings?.purchaseProductFilterMode) {
      setProductFilterMode(db.settings.purchaseProductFilterMode);
    }
  }, [db.settings?.purchaseProductFilterMode]);

  // Click outside listener for product search dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setIsSearchDropdownOpen(false);
        setHighlightedSuggestionIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initialize fresh purchase / initial stock form
  const initNewPurchase = (asInitialStock = false) => {
    const isInit = Boolean(asInitialStock);
    const nextDocNo = isInit
      ? PurchasePostingService.generateNextInitialStockDocNumber(db)
      : PurchasePostingService.generateNextPurchaseDocNumber(db);
    const firstSupplier = db.suppliers?.[0];
    const defaultBranch = activeStore?.id || db.stores?.[0]?.id || 'STR-01';

    setEditingPurchaseId(null);
    setFormData({
      docNumber: nextDocNo,
      date: new Date().toISOString().split('T')[0],
      storeId: defaultBranch,
      supplierId: isInit ? (firstSupplier?.id || 'SUP-INIT') : (firstSupplier?.id || ''),
      supplierInvoiceNo: isInit ? 'OPENING-STOCK' : '',
      supplierInvoiceDate: new Date().toISOString().split('T')[0],
      supplierInvoiceAmount: '',
      purchaseTaxType: 'inclusive',
      isInitialStock: isInit,
      entryType: isInit ? 'INITIAL_STOCK' : 'PURCHASE',
      poId: null,
      poNumber: null,
      lines: [],
      discountType: 'FLAT',
      discountValue: 0,
      otherCharges: 0,
      otherChargesRemark: '',
      paymentMode: isInit ? 'NOT_APPLICABLE' : 'CASH',
      paymentStatus: 'PAID',
      paidAmount: '',
      notes: isInit ? 'Initial Stock Cutover Inward' : '',
    });
    setProductSearchQuery('');
    setActiveTab('new');
  };

  // Toggle between Standard Purchase and Initial Stock Cutover
  const handleToggleInitialStock = (asInitial) => {
    setFormData((prev) => {
      const isInit = Boolean(asInitial);
      if (prev.isInitialStock === isInit) return prev;

      let newDocNumber = prev.docNumber;
      if (isInit) {
        if (!newDocNumber || newDocNumber.startsWith('PUR-')) {
          newDocNumber = PurchasePostingService.generateNextInitialStockDocNumber(db);
        }
      } else {
        if (!newDocNumber || newDocNumber.startsWith('INIT-')) {
          newDocNumber = PurchasePostingService.generateNextPurchaseDocNumber(db);
        }
      }

      return {
        ...prev,
        isInitialStock: isInit,
        entryType: isInit ? 'INITIAL_STOCK' : 'PURCHASE',
        docNumber: newDocNumber,
        supplierInvoiceNo: isInit
          ? (prev.supplierInvoiceNo || 'OPENING-STOCK')
          : (prev.supplierInvoiceNo === 'OPENING-STOCK' ? '' : prev.supplierInvoiceNo),
        supplierInvoiceAmount: isInit ? '' : prev.supplierInvoiceAmount,
        poId: isInit ? null : prev.poId,
        poNumber: isInit ? null : prev.poNumber,
        paymentMode: isInit ? 'NOT_APPLICABLE' : (prev.paymentMode === 'NOT_APPLICABLE' ? 'CASH' : prev.paymentMode),
      };
    });
  };

  // Populate purchase form for EDITING
  const handleEditPurchase = (purchase) => {
    // Check if returns exist
    const hasReturns = (db.purchaseReturns || []).some(
      (pr) => pr.originalPurchaseId === purchase.id || pr.originalPurchaseDocNumber === purchase.docNumber
    );
    if (hasReturns) {
      notify('error', `Cannot edit Purchase "${purchase.docNumber}" because Debit Notes have already been issued against it.`, 'Edit Locked');
      return;
    }

    const isInit = Boolean(
      purchase.isInitialStock ||
      purchase.entryType === 'INITIAL_STOCK' ||
      purchase.docNumber?.startsWith('INIT-')
    );

    setEditingPurchaseId(purchase.id);
    setFormData({
      docNumber: purchase.docNumber,
      date: (purchase.date || new Date().toISOString()).split('T')[0],
      storeId: purchase.storeId || activeStore?.id || db.stores?.[0]?.id || 'STR-01',
      supplierId: purchase.supplierId,
      supplierInvoiceNo: purchase.supplierInvoiceNo || (isInit ? 'OPENING-STOCK' : ''),
      supplierInvoiceDate: (purchase.supplierInvoiceDate || purchase.date || '').split('T')[0],
      supplierInvoiceAmount: purchase.supplierInvoiceAmount ?? purchase.netAmount ?? '',
      purchaseTaxType: purchase.purchaseTaxType || 'inclusive',
      isInitialStock: isInit,
      entryType: isInit ? 'INITIAL_STOCK' : 'PURCHASE',
      poId: purchase.poId || null,
      poNumber: purchase.poNumber || purchase.purchaseOrderRef || null,
      lines: (purchase.lines || purchase.items || []).map((l) => ({
        ...l,
        taxType: l.taxType || (l.isTaxInclusive ? 'inclusive' : 'exclusive'),
      })),
      discountType: purchase.discountType || 'FLAT',
      discountValue: purchase.discountValue || 0,
      otherCharges: purchase.otherCharges || 0,
      otherChargesRemark: purchase.otherChargesRemark || '',
      paymentMode: purchase.paymentMode || (isInit ? 'NOT_APPLICABLE' : 'CASH'),
      paymentStatus: purchase.paymentStatus || 'PAID',
      paidAmount: purchase.paidAmount ?? '',
      notes: purchase.notes || '',
    });
    setActiveTab('new');
  };

  // Selected Supplier & Selected Branch objects
  const selectedSupplier = useMemo(() => {
    return (db.suppliers || []).find((s) => s.id === formData.supplierId) || null;
  }, [db.suppliers, formData.supplierId]);

  const selectedStore = useMemo(() => {
    return (db.stores || []).find((s) => s.id === formData.storeId) || db.stores?.[0] || null;
  }, [db.stores, formData.storeId]);

  // Determine supply type: INTERSTATE vs LOCAL
  const currentSupplyType = useMemo(() => {
    if (!selectedSupplier) return 'LOCAL';
    if (selectedSupplier.supplyType) return selectedSupplier.supplyType;
    if (selectedSupplier.stateCode && selectedStore?.stateCode) {
      return selectedSupplier.stateCode === selectedStore.stateCode ? 'LOCAL' : 'INTERSTATE';
    }
    return 'LOCAL';
  }, [selectedSupplier, selectedStore]);

  // Filtered product suggestions for quick search in purchase entry
  const productSearchResults = useMemo(() => {
    const q = productSearchQuery.trim().toLowerCase();
    if (!q) return [];

    let pool = (db.products || []).filter((p) => p.active !== false);

    // Apply setting / user toggle: filter by supplier if selected
    if (productFilterMode === 'supplier' && formData.supplierId) {
      pool = pool.filter((p) => {
        const suppId = formData.supplierId.toLowerCase();
        const suppName = (selectedSupplier?.name || '').toLowerCase();
        const pSuppIds = (p.supplierIds || []).map((s) => String(s).toLowerCase());
        const pSuppId = (p.supplierId || '').toLowerCase();
        const pSuppName = (p.supplier || '').toLowerCase();
        const pSuppList = (p.suppliers || []).map((s) => String(s).toLowerCase());

        return (
          pSuppIds.includes(suppId) ||
          pSuppId === suppId ||
          (suppName && pSuppName === suppName) ||
          (suppName && pSuppList.includes(suppName))
        );
      });
    }

    return pool
      .filter((p) => {
        return (
          p.name?.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.barcode?.includes(q) ||
          p.hsnCode?.includes(q)
        );
      })
      .slice(0, 10);
  }, [db.products, productSearchQuery, productFilterMode, formData.supplierId, selectedSupplier]);

  useEffect(() => {
    if (productSearchResults.length > 0) {
      setHighlightedSuggestionIndex(0);
    } else {
      setHighlightedSuggestionIndex(-1);
    }
  }, [productSearchResults]);

  // Scroll suggestion item into view
  useEffect(() => {
    if (highlightedSuggestionIndex >= 0 && suggestionItemRefs.current[highlightedSuggestionIndex]) {
      suggestionItemRefs.current[highlightedSuggestionIndex].scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [highlightedSuggestionIndex]);

  // Toggle and save product filter mode
  const handleToggleFilterMode = (mode) => {
    setProductFilterMode(mode);
    if (db.settings) {
      db.settings.purchaseProductFilterMode = mode;
      saveDatabase(db);
    }
  };

  // Toggle Whole Purchase Tax Type (Inclusive / Exclusive)
  const handleChangeWholePurchaseTaxType = (newTaxType) => {
    setFormData((prev) => {
      const updatedLines = (prev.lines || []).map((line) => {
        return calculatePurchaseLine(
          {
            ...line,
            taxType: newTaxType,
            isTaxInclusive: newTaxType === 'inclusive',
          },
          currentSupplyType
        );
      });
      return {
        ...prev,
        purchaseTaxType: newTaxType,
        lines: updatedLines,
      };
    });
    notify(
      'info',
      `Whole purchase tax mode set to ${newTaxType === 'inclusive' ? 'Inclusive (Tax In)' : 'Exclusive (+Tax)'}. All line rates recalculated.`,
      'Tax Mode Changed'
    );
  };

  // Apply selected product to lines
  const applyProductToLine = (product, chosenRate, targetLineIdx = null) => {
    let costRate = 0;
    if (chosenRate !== undefined && chosenRate !== null && chosenRate !== '') {
      costRate = Number(chosenRate);
    } else {
      costRate = getLatestHistoricalPurchaseRate(product.id, db, formData.supplierId);
    }
    if (isNaN(costRate) || costRate < 0) costRate = 0;

    const prodTaxType = (product.taxType || (product.isTaxInclusive ? 'inclusive' : (formData.purchaseTaxType || 'inclusive'))).toLowerCase();
    const isInclusive = prodTaxType === 'inclusive';
    const taxRate = Number(product.taxRate ?? 0);

    const rawLine = {
      lineId: `PLINE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      productId: product.id,
      name: product.name,
      sku: product.sku || '',
      uom: product.uom || product.unit || 'PCS',
      batchNo: '',
      expiryDate: '',
      qty: 1,
      costPrice: costRate > 0 ? costRate : '',
      rate: costRate > 0 ? costRate : 0,
      discountPercent: 0,
      discountAmount: 0,
      mrp: product.mrp ? Number(product.mrp) : '',
      sellingPrice: product.sellingRate ? Number(product.sellingRate) : '',
      taxRate,
      taxType: isInclusive ? 'inclusive' : 'exclusive',
      isTaxInclusive: isInclusive,
    };

    const newLine = calculatePurchaseLine(rawLine, currentSupplyType);

    setFormData((prev) => {
      if (targetLineIdx !== null && targetLineIdx >= 0 && targetLineIdx < prev.lines.length) {
        const updated = [...prev.lines];
        updated[targetLineIdx] = newLine;
        return { ...prev, lines: updated };
      }
      return { ...prev, lines: [...prev.lines, newLine] };
    });

    setProductSearchQuery('');
    setIsSearchDropdownOpen(false);
  };

  // Product selection handler
  const handleSelectProduct = (product, targetLineIdx = null) => {
    const rates = getProductStockRates(product.id, db, formData.supplierId);
    if (rates.length > 1) {
      const preferredRate = rates.find((r) => r.isSupplierMatch)?.rate || rates[0].rate;
      setRateModal({
        isOpen: true,
        product,
        rates,
        targetLineIdx,
        customRate: String(preferredRate || ''),
      });
      setIsSearchDropdownOpen(false);
      setHighlightedSuggestionIndex(-1);
      return;
    }
    const singleRate = rates.length === 1 ? rates[0].rate : getLatestHistoricalPurchaseRate(product.id, db, formData.supplierId);
    applyProductToLine(product, singleRate, targetLineIdx);
  };

  // Add blank row
  const handleAddBlankLine = () => {
    const firstProd = db.products?.[0];
    if (firstProd) {
      const rate = getLatestHistoricalPurchaseRate(firstProd.id, db, formData.supplierId);
      applyProductToLine(firstProd, rate);
    } else {
      const isInclusive = (formData.purchaseTaxType || 'inclusive') === 'inclusive';
      const rawLine = {
        lineId: `PLINE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        productId: '',
        name: '',
        sku: '',
        uom: 'PCS',
        batchNo: '',
        expiryDate: '',
        qty: 1,
        costPrice: '',
        rate: 0,
        discountPercent: 0,
        discountAmount: 0,
        mrp: '',
        sellingPrice: '',
        taxRate: 0,
        taxType: isInclusive ? 'inclusive' : 'exclusive',
        isTaxInclusive: isInclusive,
      };
      setFormData((prev) => ({
        ...prev,
        lines: [...prev.lines, calculatePurchaseLine(rawLine, currentSupplyType)],
      }));
    }
  };

  // Remove line from grid
  const handleRemoveLine = (idx) => {
    setFormData((prev) => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== idx),
    }));
  };

  // Update line field
  const handleUpdateLine = (idx, field, value) => {
    setFormData((prev) => {
      const nextLines = [...prev.lines];
      const line = { ...nextLines[idx], [field]: value };

      if (field === 'productId') {
        const prod = (db.products || []).find((p) => p.id === value);
        if (prod) {
          const rate = getLatestHistoricalPurchaseRate(prod.id, db, formData.supplierId);
          const pTaxType = (prod.taxType || (prod.isTaxInclusive ? 'inclusive' : (formData.purchaseTaxType || 'inclusive'))).toLowerCase();
          line.name = prod.name;
          line.sku = prod.sku || '';
          line.uom = prod.uom || 'PCS';
          line.costPrice = rate > 0 ? rate : '';
          line.rate = rate > 0 ? rate : 0;
          line.mrp = prod.mrp ? Number(prod.mrp) : '';
          line.sellingPrice = prod.sellingRate ? Number(prod.sellingRate) : '';
          line.taxRate = Number(prod.taxRate ?? line.taxRate ?? 0);
          line.taxType = pTaxType;
          line.isTaxInclusive = pTaxType === 'inclusive';
        }
      }

      if (field === 'taxType') {
        line.taxType = value;
        line.isTaxInclusive = value === 'inclusive';
      }

      nextLines[idx] = calculatePurchaseLine(line, currentSupplyType);
      return { ...prev, lines: nextLines };
    });
  };

  // Recalculate summary totals
  const purchaseCalculations = useMemo(() => {
    let subtotal = 0;
    let lineDiscountsTotal = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;
    let totalQty = 0;
    const taxSummaryMap = new Map();

    (formData.lines || []).forEach((line) => {
      const taxable = Number(line.taxableAmount || 0);
      const cgstAmt = Number(line.cgstAmount || 0);
      const sgstAmt = Number(line.sgstAmount || 0);
      const igstAmt = Number(line.igstAmount || 0);
      const lineTax = Number(line.taxAmount || 0);
      const discAmt = Number(line.discountAmount || 0);
      const qty = Number(line.qty || 0);
      const taxRate = Number(line.taxRate || 0);

      subtotal += taxable;
      lineDiscountsTotal += discAmt;
      cgstTotal += cgstAmt;
      sgstTotal += sgstAmt;
      igstTotal += igstAmt;
      totalQty += qty;

      const rateKey = taxRate;
      const prevGroup = taxSummaryMap.get(rateKey) || { rate: rateKey, taxable: 0, tax: 0 };
      prevGroup.taxable += taxable;
      prevGroup.tax += lineTax;
      taxSummaryMap.set(rateKey, prevGroup);
    });

    let billDiscountAmt = 0;
    if (formData.discountType === 'PERCENT') {
      billDiscountAmt = Number(((subtotal * Number(formData.discountValue || 0)) / 100).toFixed(2));
    } else {
      billDiscountAmt = Number(formData.discountValue || 0);
    }

    const totalTax = Number((cgstTotal + sgstTotal + igstTotal).toFixed(2));
    const otherCharges = Number(Number(formData.otherCharges || 0).toFixed(2));
    const unroundedTotal = subtotal - billDiscountAmt + otherCharges + totalTax;
    const grandTotal = Math.round(unroundedTotal);
    const roundOff = Number((grandTotal - unroundedTotal).toFixed(2));
    const netAmount = grandTotal;
    const amountInWords = numberToWords(grandTotal);

    const paidAmt = formData.paymentStatus === 'PAID' ? grandTotal : Number(formData.paidAmount || 0);
    const balanceDue = Number((grandTotal - paidAmt).toFixed(2));

    return {
      subtotal: Number(subtotal.toFixed(2)),
      lineDiscountsTotal: Number(lineDiscountsTotal.toFixed(2)),
      billDiscountAmount: Number(billDiscountAmt.toFixed(2)),
      otherCharges,
      cgstTotal: Number(cgstTotal.toFixed(2)),
      sgstTotal: Number(sgstTotal.toFixed(2)),
      igstTotal: Number(igstTotal.toFixed(2)),
      totalTax,
      roundOff,
      grandTotal,
      netAmount,
      totalQty,
      amountInWords,
      taxSummary: Array.from(taxSummaryMap.values()).sort((a, b) => a.rate - b.rate),
      paidAmount: paidAmt,
      balanceDue: balanceDue < 0 ? 0 : balanceDue,
    };
  }, [formData.lines, formData.discountType, formData.discountValue, formData.otherCharges, formData.paymentStatus, formData.paidAmount, currentSupplyType]);

  // Load details from a Purchase Order into Purchase Entry
  const handleLoadFromPO = (po) => {
    // Populate supplier, branch, PO reference
    const poSupplier = (db.suppliers || []).find((s) => s.id === po.supplierId);
    const poStoreId = po.storeId || activeStore?.id || db.stores?.[0]?.id || 'STR-01';

    // Map lines from PO
    const mappedLines = (po.lines || []).map((l, idx) => {
      const prod = (db.products || []).find((p) => p.id === (l.productId || l.id)) || {};
      const qty = Number(l.orderedQty || l.qty || 1);
      const costPrice = Number(l.rate || prod.costRate || getLatestHistoricalPurchaseRate(prod.id, db, po.supplierId) || 0);
      const taxRate = Number(l.taxRate ?? prod.taxRate ?? 0);
      const initialTaxType = (l.taxType || prod.taxType || (prod.isTaxInclusive ? 'inclusive' : (formData.purchaseTaxType || 'inclusive'))).toLowerCase();

      const rawLine = {
        lineId: `PLINE-PO-${idx + 1}-${Date.now()}`,
        productId: l.productId || l.id,
        name: l.productName || l.name || prod.name || 'Product',
        sku: l.sku || prod.sku || '',
        uom: l.uom || prod.uom || 'PCS',
        batchNo: '',
        expiryDate: '',
        qty,
        costPrice: costPrice > 0 ? costPrice : '',
        rate: costPrice,
        discountPercent: Number(l.discountPercent || 0),
        discountAmount: 0,
        mrp: prod.mrp ? Number(prod.mrp) : '',
        sellingPrice: prod.sellingRate ? Number(prod.sellingRate) : '',
        taxRate,
        taxType: initialTaxType,
        isTaxInclusive: initialTaxType === 'inclusive',
      };

      return calculatePurchaseLine(rawLine, currentSupplyType);
    });

    setFormData((prev) => ({
      ...prev,
      supplierId: po.supplierId || prev.supplierId,
      storeId: poStoreId,
      poId: po.id,
      poNumber: po.poNumber,
      notes: `Converted from Purchase Order ${po.poNumber}`,
      lines: mappedLines,
    }));

    setIsPOModalOpen(false);
    notify('success', `Loaded ${mappedLines.length} items from Purchase Order ${po.poNumber}. You can adjust quantities or add/remove products before saving.`, 'Purchase Order Loaded');
  };

  // Unlink PO
  const handleUnlinkPO = () => {
    setFormData((prev) => ({
      ...prev,
      poId: null,
      poNumber: null,
    }));
    notify('info', 'Purchase Order unlinked. Entry is now an independent purchase.', 'PO Unlinked');
  };

  // Submit / Save Purchase / Initial Stock Entry
  const handleSubmitPurchase = (e) => {
    e.preventDefault();

    const isInit = Boolean(
      formData.isInitialStock ||
      formData.entryType === 'INITIAL_STOCK' ||
      formData.docNumber?.startsWith('INIT-')
    );

    if (!isInit && !formData.supplierId) {
      notify('error', 'Please choose a Supplier.', 'Missing Supplier');
      return;
    }
    if (!isInit && (!formData.supplierInvoiceNo || !formData.supplierInvoiceNo.trim())) {
      notify('error', 'Please enter Vendor Bill / Invoice Number.', 'Missing Invoice Number');
      return;
    }
    if (!formData.lines || formData.lines.length === 0) {
      notify('error', 'Please add at least one product to the inward grid.', 'Empty Grid');
      return;
    }
    const hasInvalidLine = formData.lines.some((l) => !l.productId || Number(l.qty) <= 0);
    if (hasInvalidLine) {
      notify('error', 'Each line item must have a valid product and quantity greater than zero.', 'Invalid Lines');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        isInitialStock: isInit,
        entryType: isInit ? 'INITIAL_STOCK' : 'PURCHASE',
        docType: isInit ? 'INITIAL_STOCK' : 'PURCHASE',
        companyId: activeCompany?.id || 'COMP-01',
        storeId: formData.storeId,
        supplierId: formData.supplierId || (isInit ? 'SUP-INIT' : ''),
        supplierInvoiceNo: isInit
          ? (formData.supplierInvoiceNo || 'OPENING-STOCK').trim()
          : formData.supplierInvoiceNo.trim(),
        supplierInvoiceDate: isInit
          ? (formData.date || new Date().toISOString().split('T')[0])
          : formData.supplierInvoiceDate,
        supplierInvoiceAmount: isInit ? purchaseCalculations.netAmount : formData.supplierInvoiceAmount,
        date: formData.date,
        items: formData.lines,
        discountType: formData.discountType,
        discountValue: Number(formData.discountValue || 0),
        discountAmount: purchaseCalculations.billDiscountAmount,
        otherCharges: Number(formData.otherCharges || 0),
        otherChargesRemark: formData.otherChargesRemark,
        subtotal: purchaseCalculations.subtotal,
        cgstTotal: purchaseCalculations.cgstTotal,
        sgstTotal: purchaseCalculations.sgstTotal,
        igstTotal: purchaseCalculations.igstTotal,
        totalTax: purchaseCalculations.totalTax,
        roundOff: purchaseCalculations.roundOff,
        netAmount: purchaseCalculations.netAmount,
        grandTotal: purchaseCalculations.grandTotal,
        amountInWords: purchaseCalculations.amountInWords,
        paymentMode: isInit ? 'NOT_APPLICABLE' : formData.paymentMode,
        paymentStatus: isInit ? 'PAID' : formData.paymentStatus,
        paidAmount: isInit ? purchaseCalculations.grandTotal : purchaseCalculations.paidAmount,
        balanceDue: isInit ? 0 : purchaseCalculations.balanceDue,
        userId: currentUser?.id || 'USR-ADMIN',
      };

      let res;
      if (editingPurchaseId) {
        res = PurchasePostingService.updatePurchase(editingPurchaseId, payload);
        notify('success', res.message, isInit ? 'Initial Stock Updated' : 'Purchase Receipt Updated');
      } else {
        res = PurchasePostingService.postPurchase(payload);
        notify('success', res.message, isInit ? 'Initial Stock Recorded' : 'Purchase Receipt Posted');
      }

      triggerRefresh();
      setActiveTab('list');
      setEditingPurchaseId(null);
    } catch (err) {
      notify('error', err.message, isInit ? 'Initial Stock Failed' : 'Purchase Failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Purchase Handler
  const handleConfirmDeletePurchase = () => {
    if (!deletingPurchase) return;
    try {
      const res = PurchasePostingService.deletePurchase(deletingPurchase.id, currentUser?.id || 'USR-ADMIN');
      notify('success', res.message, 'Inward Record Deleted');
      triggerRefresh();
      setDeletingPurchase(null);
    } catch (err) {
      notify('error', err.message, 'Delete Blocked');
    }
  };

  // Counts for tabs & filters
  const totalInwardCount = (db.purchases || []).length;
  const standardPurchaseCount = (db.purchases || []).filter(
    (p) => !p.isInitialStock && p.entryType !== 'INITIAL_STOCK' && !p.docNumber?.startsWith('INIT-')
  ).length;
  const initialStockInwardCount = (db.purchases || []).filter(
    (p) => p.isInitialStock || p.entryType === 'INITIAL_STOCK' || p.docNumber?.startsWith('INIT-')
  ).length;

  // Filtered Purchases for List View
  const filteredPurchases = useMemo(() => {
    let list = [...(db.purchases || [])];

    if (listTypeFilter === 'PURCHASE') {
      list = list.filter(
        (p) => !p.isInitialStock && p.entryType !== 'INITIAL_STOCK' && !p.docNumber?.startsWith('INIT-')
      );
    } else if (listTypeFilter === 'INITIAL_STOCK') {
      list = list.filter(
        (p) => p.isInitialStock || p.entryType === 'INITIAL_STOCK' || p.docNumber?.startsWith('INIT-')
      );
    }

    if (listBranchFilter !== 'ALL') {
      list = list.filter((p) => p.storeId === listBranchFilter);
    }
    if (listSupplierFilter !== 'ALL') {
      list = list.filter((p) => p.supplierId === listSupplierFilter);
    }
    if (listSearchQuery.trim()) {
      const q = listSearchQuery.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.docNumber?.toLowerCase().includes(q) ||
          p.supplierName?.toLowerCase().includes(q) ||
          p.supplierInvoiceNo?.toLowerCase().includes(q) ||
          p.poNumber?.toLowerCase().includes(q) ||
          p.purchaseOrderRef?.toLowerCase().includes(q)
      );
    }

    return list.sort((a, b) => new Date(b.date || b.postedAt) - new Date(a.date || a.postedAt));
  }, [db.purchases, listTypeFilter, listBranchFilter, listSupplierFilter, listSearchQuery]);

  // Available Purchase Orders for the PO Selector Modal
  const availablePOs = useMemo(() => {
    return (db.purchaseOrders || []).filter((po) => po.status !== 'CANCELLED');
  }, [db.purchaseOrders]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
      {/* Top Header & Tab Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between bg-slate-900 border border-slate-800 p-3 rounded-xl shadow-md gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'list' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Inward Register ({totalInwardCount})</span>
          </button>

          <button
            onClick={() => initNewPurchase(false)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'new' && !formData.isInitialStock
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>{editingPurchaseId && !formData.isInitialStock ? 'Edit Purchase' : 'New Purchase'}</span>
          </button>

          <button
            onClick={() => initNewPurchase(true)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'new' && formData.isInitialStock
                ? 'bg-amber-600 text-white shadow'
                : 'text-amber-400/90 hover:text-amber-300 hover:bg-slate-800'
            }`}
          >
            <PackageCheck className="w-4 h-4 text-amber-400" />
            <span>{editingPurchaseId && formData.isInitialStock ? 'Edit Initial Stock' : 'Initial Stock Inward'}</span>
          </button>
        </div>

        {activeTab === 'list' && (
          <div className="flex items-center gap-2">
            <ExportButtons
              data={filteredPurchases.map((p, idx) => ({
                '#': idx + 1,
                'Inward #': p.docNumber,
                'Type': p.isInitialStock || p.entryType === 'INITIAL_STOCK' || p.docNumber?.startsWith('INIT-') ? 'INITIAL_STOCK' : 'PURCHASE',
                'Date': new Date(p.date).toLocaleDateString(),
                'Branch': p.branchName || p.storeName || (db.stores?.find((s) => s.id === p.storeId)?.name || 'Main Store'),
                'Supplier Name': p.supplierName,
                'Vendor Invoice #': p.isInitialStock || p.entryType === 'INITIAL_STOCK' || p.docNumber?.startsWith('INIT-') ? 'OPENING_STOCK' : p.supplierInvoiceNo,
                'Vendor Invoice Date': p.supplierInvoiceDate || '—',
                'PO Reference': p.poNumber || p.purchaseOrderRef || '—',
                'Items Count': p.lines?.length || 0,
                'Net Amount': `₹${Number(p.netAmount || p.grandTotal || 0).toFixed(2)}`,
                'Status': p.paymentStatus || 'PAID',
              }))}
              filename="INWARD_GOODS_REGISTER"
              title="PURCHASE & INITIAL STOCK INWARD REGISTER"
              pdfOrientation="landscape"
            />
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 1. INWARD REGISTER LIST VIEW (PURCHASES & INITIAL STOCK)                 */}
      {/* ========================================================================= */}
      {activeTab === 'list' && (
        <div className="space-y-3">
          {/* Inward Type Filter Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900 border border-slate-800 p-2.5 rounded-xl">
            <div className="inline-flex rounded-lg p-1 bg-slate-950 border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setListTypeFilter('ALL')}
                className={`px-3 py-1 rounded-md font-semibold transition cursor-pointer ${
                  listTypeFilter === 'ALL'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All Inward ({totalInwardCount})
              </button>
              <button
                type="button"
                onClick={() => setListTypeFilter('PURCHASE')}
                className={`px-3 py-1 rounded-md font-semibold transition cursor-pointer ${
                  listTypeFilter === 'PURCHASE'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Purchases Only ({standardPurchaseCount})
              </button>
              <button
                type="button"
                onClick={() => setListTypeFilter('INITIAL_STOCK')}
                className={`px-3 py-1 rounded-md font-semibold transition cursor-pointer ${
                  listTypeFilter === 'INITIAL_STOCK'
                    ? 'bg-amber-600 text-white shadow'
                    : 'text-amber-400/80 hover:text-amber-300'
                }`}
              >
                Initial Stock Only ({initialStockInwardCount})
              </button>
            </div>

            <div className="text-xs text-slate-400">
              Showing <span className="font-bold text-white">{filteredPurchases.length}</span> record{filteredPurchases.length === 1 ? '' : 's'}
            </div>
          </div>

          {/* Search & Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-900 border border-slate-800 p-3 rounded-xl text-xs">
            <div className="sm:col-span-2 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search by Inward #, Supplier, Vendor Bill #, PO #..."
                value={listSearchQuery}
                onChange={(e) => setListSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-slate-400 text-[11px] mb-1 font-semibold">
                <Store className="w-3.5 h-3.5 text-indigo-400" />
                <span>Filter by Branch</span>
              </div>
              <select
                value={listBranchFilter}
                onChange={(e) => setListBranchFilter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200"
              >
                <option value="ALL">All Branches</option>
                {(db.stores || []).map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name} ({st.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-slate-400 text-[11px] mb-1 font-semibold">
                <Truck className="w-3.5 h-3.5 text-indigo-400" />
                <span>Filter by Supplier</span>
              </div>
              <select
                value={listSupplierFilter}
                onChange={(e) => setListSupplierFilter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200"
              >
                <option value="ALL">All Suppliers</option>
                {(db.suppliers || []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Inward Purchases Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Inward #</th>
                    <th className="py-2.5 px-2 text-center">Type</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Branch</th>
                    <th className="py-2.5 px-3">Supplier Name</th>
                    <th className="py-2.5 px-3">Vendor Invoice #</th>
                    <th className="py-2.5 px-3">PO Reference</th>
                    <th className="py-2.5 px-2 text-center">Items</th>
                    <th className="py-2.5 px-3 text-right">Grand Total (₹)</th>
                    <th className="py-2.5 px-2 text-center">Payment</th>
                    <th className="py-2.5 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {filteredPurchases.length === 0 ? (
                    <tr>
                      <td colSpan="11" className="py-12 text-center text-slate-500 text-xs">
                        <ShoppingBag className="w-8 h-8 mx-auto text-slate-600 mb-2 opacity-50" />
                        No inward goods records found matching current criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredPurchases.map((p) => {
                      const branchName =
                        p.branchName ||
                        p.storeName ||
                        db.stores?.find((s) => s.id === p.storeId)?.name ||
                        'Main Store';
                      const isInit = Boolean(
                        p.isInitialStock ||
                        p.entryType === 'INITIAL_STOCK' ||
                        p.docNumber?.startsWith('INIT-')
                      );

                      return (
                        <tr key={p.id} className="hover:bg-slate-800/40 transition">
                          <td className="py-2.5 px-3 font-mono font-bold text-indigo-300">
                            {p.docNumber}
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            {isInit ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800 whitespace-nowrap">
                                Initial Stock
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800 whitespace-nowrap">
                                Purchase
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 text-[11px] whitespace-nowrap">
                            {new Date(p.date).toLocaleDateString()}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="inline-flex items-center gap-1 font-semibold text-slate-200">
                              <Store className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                              <span>{branchName}</span>
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-200 max-w-[180px] truncate">
                            {p.supplierName}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-300">
                            {isInit ? (
                              <span className="text-slate-500 italic text-[11px]">Opening Stock</span>
                            ) : (
                              <div>
                                <div>{p.supplierInvoiceNo}</div>
                                {p.supplierInvoiceDate && (
                                  <div className="text-[10px] text-slate-500 font-sans">
                                    {new Date(p.supplierInvoiceDate).toLocaleDateString()}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-xs">
                            {isInit ? (
                              <span className="text-slate-500 text-[11px]">—</span>
                            ) : p.poNumber || p.purchaseOrderRef ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800 flex items-center gap-1 w-max">
                                <LinkIcon className="w-3 h-3 text-indigo-400" />
                                {p.poNumber || p.purchaseOrderRef}
                              </span>
                            ) : (
                              <span className="text-slate-500 text-[11px]">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-center font-bold text-slate-300">
                            {p.lines?.length || 0}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                            ₹{Number(p.netAmount || p.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            {isInit ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                                OPENING
                              </span>
                            ) : (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  p.paymentStatus === 'PAID'
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                    : p.paymentStatus === 'PARTIAL'
                                    ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                    : 'bg-rose-950 text-rose-300 border border-rose-800'
                                }`}
                              >
                                {p.paymentStatus || 'PAID'}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* VIEW */}
                              <button
                                onClick={() => setViewingPurchase(p)}
                                title={isInit ? 'View Initial Stock Details' : 'View Purchase Details'}
                                className="p-1 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded transition cursor-pointer"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              {/* EDIT */}
                              <button
                                onClick={() => handleEditPurchase(p)}
                                title={isInit ? 'Edit Initial Stock Entry' : 'Edit Purchase'}
                                className="p-1 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded transition cursor-pointer"
                              >
                                <Edit className="w-4 h-4" />
                              </button>

                              {/* PRINT */}
                              <button
                                onClick={() => setPrintingPurchase(p)}
                                title={isInit ? 'Print Initial Stock Voucher' : 'Print A4 Purchase Voucher'}
                                className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded transition cursor-pointer"
                              >
                                <Printer className="w-4 h-4" />
                              </button>

                              {/* DELETE */}
                              <button
                                onClick={() => setDeletingPurchase(p)}
                                title={isInit ? 'Delete Initial Stock & Reverse Stock' : 'Delete Purchase Receipt & Reverse Stock'}
                                className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. NEW / EDIT PURCHASE / INITIAL STOCK ENTRY VIEW                         */}
      {/* ========================================================================= */}
      {activeTab === 'new' && (
        <form onSubmit={handleSubmitPurchase} className="space-y-4">
          {/* Top Form Header */}
          <div className="flex flex-wrap items-center justify-between bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-md gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-0.5 rounded text-[10px] font-bold font-mono border ${
                    formData.isInitialStock
                      ? 'bg-amber-950 text-amber-300 border-amber-700'
                      : 'bg-indigo-950 text-indigo-300 border-indigo-700'
                  }`}
                >
                  {editingPurchaseId
                    ? formData.isInitialStock
                      ? 'UPDATE INITIAL STOCK'
                      : 'UPDATE PURCHASE VOUCHER'
                    : formData.isInitialStock
                    ? 'NEW INITIAL STOCK CUTOVER'
                    : 'NEW PURCHASE INWARD'}
                </span>
                <h3 className="font-bold text-white text-base">
                  {editingPurchaseId
                    ? `${formData.isInitialStock ? 'Editing Initial Stock' : 'Editing Purchase'}: ${formData.docNumber}`
                    : formData.isInitialStock
                    ? 'Initial Stock Inward Cutover Entry'
                    : 'Inward Purchase Receipt Entry'}
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {formData.isInitialStock
                  ? 'Initial stock creates opening inventory balances and is cleanly separated from purchase expense reports.'
                  : 'Inward stock is directly saved to the common inventory balance table, immediately reflecting across POS billing and reports.'}
              </p>
            </div>

            {/* Inward Mode Switcher & PO conversion */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Option to make as Initial Stock / Standard Purchase */}
              <div className="inline-flex rounded-lg p-1 bg-slate-950 border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => handleToggleInitialStock(false)}
                  className={`px-3 py-1.5 rounded-md font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    !formData.isInitialStock
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Standard Purchase</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleInitialStock(true)}
                  className={`px-3 py-1.5 rounded-md font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    formData.isInitialStock
                      ? 'bg-amber-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <PackageCheck className="w-3.5 h-3.5" />
                  <span>Initial Stock</span>
                </button>
              </div>

              {!formData.isInitialStock && !editingPurchaseId && (
                <button
                  type="button"
                  onClick={() => setIsPOModalOpen(true)}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-700/50 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow"
                >
                  <ShoppingBag className="w-4 h-4 text-indigo-400" />
                  <span>Choose PO ({availablePOs.length})</span>
                </button>
              )}

              {!formData.isInitialStock && formData.poNumber && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-950/80 border border-indigo-600 text-xs">
                  <span className="text-indigo-300 font-mono font-bold">PO: {formData.poNumber}</span>
                  <button
                    type="button"
                    onClick={handleUnlinkPO}
                    title="Unlink Purchase Order"
                    className="text-slate-400 hover:text-rose-400 p-0.5 cursor-pointer"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Top Portion: Purchase & Invoice Details (or Initial Stock Details) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* CARD 1: INWARD / PURCHASE DETAILS */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-xs">
                <div className="flex items-center gap-2 font-bold text-indigo-300 uppercase tracking-wider">
                  <Receipt className="w-4 h-4" />
                  <span>{formData.isInitialStock ? 'Initial Stock Reference & Branch' : 'Purchase Details'}</span>
                </div>
                {formData.isInitialStock && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                    OPENING INVENTORY
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                {/* Document Number */}
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">
                    {formData.isInitialStock ? 'Initial Stock Ref #' : 'Purchase No'}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.docNumber}
                    onChange={(e) => setFormData({ ...formData, docNumber: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-100 font-mono font-bold focus:border-indigo-500 focus:outline-none"
                  />
                  {formData.isInitialStock && (
                    <span className="text-[10px] text-amber-400 mt-0.5 block font-mono">
                      Direct Opening Stock Ref
                    </span>
                  )}
                </div>

                {/* Date */}
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">
                    {formData.isInitialStock ? 'Opening Cutover Date' : 'Purchase Date'}
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-100 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                {/* Branch Selection */}
                <div>
                  <label className="font-semibold text-slate-300 block mb-1 flex items-center gap-1">
                    <Store className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Branch (Store)</span>
                  </label>
                  <select
                    value={formData.storeId}
                    onChange={(e) => setFormData({ ...formData, storeId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-100 font-semibold focus:border-indigo-500 focus:outline-none"
                  >
                    {(db.stores || []).map((store) => (
                      <option key={store.id} value={store.id}>
                        {store.name} ({store.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* CARD 2: VENDOR INVOICE DETAILS (or INITIAL STOCK CUTOVER DETAILS) */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-xs">
                <div className="flex items-center gap-2 font-bold text-indigo-300 uppercase tracking-wider">
                  <Truck className="w-4 h-4" />
                  <span>{formData.isInitialStock ? 'Initial Stock Cutover Info' : 'Supplier & Invoice Details'}</span>
                </div>
                {formData.isInitialStock && (
                  <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> No Vendor Invoice Needed
                  </span>
                )}
              </div>

              {formData.isInitialStock ? (
                <div className="space-y-2 text-xs">
                  <div className="bg-amber-950/40 border border-amber-800/60 rounded-lg p-2.5 text-amber-200 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Opening Stock Cutover Mode</p>
                      <p className="text-[11px] text-amber-300/80 mt-0.5">
                        No vendor invoice details are required. Stock entered in the grid below will be initialized into branch inventory and tracked in the Initial Stock Cutover report without inflating purchase expense or GST ITC claims.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="font-semibold text-slate-300 block mb-1">Supplier / Sourcing (Optional)</label>
                      <select
                        value={formData.supplierId}
                        onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 font-semibold focus:border-indigo-500 focus:outline-none"
                      >
                        <option value="">Opening Stock / Initial Inventory (Default)</option>
                        {(db.suppliers || []).map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} {s.gstin ? `(${s.gstin})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="font-semibold text-slate-300 block mb-1">Invoice Status</label>
                      <div className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-400 font-mono text-xs">
                        Not Applicable (Opening Cutover)
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                    {/* Supplier Selection */}
                    <div className="sm:col-span-2">
                      <label className="font-semibold text-slate-300 block mb-1">Supplier / Vendor</label>
                      <select
                        value={formData.supplierId}
                        onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-100 font-semibold focus:border-indigo-500 focus:outline-none"
                      >
                        {(db.suppliers || []).map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} {s.gstin ? `(${s.gstin})` : ''}
                          </option>
                        ))}
                      </select>
                      {selectedSupplier && (
                        <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-2">
                          <span>Supply: <strong className="text-indigo-400">{currentSupplyType}</strong></span>
                          {selectedSupplier.phone && <span>• Tel: {selectedSupplier.phone}</span>}
                        </div>
                      )}
                    </div>

                    {/* Vendor Invoice No */}
                    <div>
                      <label className="font-semibold text-slate-300 block mb-1">Invoice No</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. AGRO/9021"
                        value={formData.supplierInvoiceNo}
                        onChange={(e) => setFormData({ ...formData, supplierInvoiceNo: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-100 font-mono focus:border-indigo-500 focus:outline-none"
                      />
                    </div>

                    {/* Vendor Invoice Date */}
                    <div>
                      <label className="font-semibold text-slate-300 block mb-1">Invoice Date</label>
                      <input
                        type="date"
                        value={formData.supplierInvoiceDate}
                        onChange={(e) => setFormData({ ...formData, supplierInvoiceDate: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-100 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Vendor Invoice Amount */}
                  <div className="pt-1 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 font-semibold">Vendor Invoice Amount: ₹</span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Bill Amount (₹)"
                        value={formData.supplierInvoiceAmount}
                        onChange={(e) => setFormData({ ...formData, supplierInvoiceAmount: e.target.value })}
                        className="w-36 bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-slate-100 font-mono font-bold focus:border-indigo-500"
                      />
                    </div>
                    <span className="text-[11px] text-slate-500 italic">
                      Used for reconciliation with inward total
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Product Search & Grid Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-indigo-400" />
                <h4 className="font-bold text-white text-sm">Product Search & Inward Grid</h4>
                <span className="text-xs text-slate-400">({formData.lines.length} items in bill)</span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Whole Purchase Tax Mode Toggle */}
                <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                  <span className="text-slate-400 text-[11px] px-2 font-semibold">Purchase Tax Mode:</span>
                  <button
                    type="button"
                    onClick={() => handleChangeWholePurchaseTaxType('inclusive')}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold transition cursor-pointer ${
                      (formData.purchaseTaxType || 'inclusive') === 'inclusive'
                        ? 'bg-emerald-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title="Calculate all products in purchase as Tax Inclusive"
                  >
                    Inclusive (All)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChangeWholePurchaseTaxType('exclusive')}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold transition cursor-pointer ${
                      formData.purchaseTaxType === 'exclusive'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title="Calculate all products in purchase as Tax Exclusive"
                  >
                    Exclusive (All)
                  </button>
                </div>

                {/* Setting Toggle: All Products vs Supplier's Products */}
                <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                  <span className="text-slate-400 text-[11px] px-2 font-semibold">Filter:</span>
                  <button
                    type="button"
                    onClick={() => handleToggleFilterMode('all')}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold transition cursor-pointer ${
                      productFilterMode === 'all'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All Products
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleFilterMode('supplier')}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold transition cursor-pointer ${
                      productFilterMode === 'supplier'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Supplier's Products Only
                  </button>
                </div>
              </div>
            </div>

            {/* Smart Search Bar */}
            <div className="flex flex-wrap items-center gap-3">
              <div ref={searchContainerRef} className="flex-1 min-w-[280px] relative">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder={`Scan Barcode or Search by Name, SKU, HSN... (${
                      productFilterMode === 'supplier' ? 'Filtered by Supplier' : 'Global Catalog'
                    })`}
                    value={productSearchQuery}
                    onChange={(e) => {
                      setProductSearchQuery(e.target.value);
                      setIsSearchDropdownOpen(true);
                    }}
                    onFocus={() => {
                      if (productSearchQuery.trim()) setIsSearchDropdownOpen(true);
                    }}
                    onKeyDown={(e) => {
                      if (!isSearchDropdownOpen || productSearchResults.length === 0) return;
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setHighlightedSuggestionIndex((prev) =>
                          prev < productSearchResults.length - 1 ? prev + 1 : 0
                        );
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setHighlightedSuggestionIndex((prev) =>
                          prev > 0 ? prev - 1 : productSearchResults.length - 1
                        );
                      } else if (e.key === 'Enter') {
                        e.preventDefault();
                        if (highlightedSuggestionIndex >= 0 && highlightedSuggestionIndex < productSearchResults.length) {
                          handleSelectProduct(productSearchResults[highlightedSuggestionIndex]);
                        }
                      } else if (e.key === 'Escape') {
                        setIsSearchDropdownOpen(false);
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-slate-100 placeholder-slate-500 text-xs focus:border-indigo-500 focus:outline-none"
                  />
                  {productSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setProductSearchQuery('')}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Suggestions Dropdown */}
                {isSearchDropdownOpen && productSearchResults.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto divide-y divide-slate-800">
                    {productSearchResults.map((prod, idx) => (
                      <div
                        key={prod.id}
                        ref={(el) => (suggestionItemRefs.current[idx] = el)}
                        onClick={() => handleSelectProduct(prod)}
                        className={`p-2.5 flex items-center justify-between text-xs cursor-pointer transition ${
                          idx === highlightedSuggestionIndex ? 'bg-indigo-950/80 text-white' : 'hover:bg-slate-800/60 text-slate-200'
                        }`}
                      >
                        <div>
                          <div className="font-bold flex items-center gap-1.5">
                            <span>{prod.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                              {prod.sku}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span>UOM: {prod.uom || 'PCS'}</span>
                            <span>• MRP: ₹{prod.mrp || 0}</span>
                            <span>• GST: {prod.taxRate || 0}%</span>
                          </div>
                        </div>

                        <div className="text-right">
                          {(() => {
                            const histRate = getLatestHistoricalPurchaseRate(prod.id, db, formData.supplierId);
                            return (
                              <>
                                <div className="font-mono font-bold text-indigo-400">
                                  {histRate > 0 ? `Rate: ₹${histRate.toFixed(2)}` : 'New / No Rate'}
                                </div>
                                <div className="text-[10px] text-emerald-400">
                                  Sell: ₹{prod.sellingRate || 0}
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleAddBlankLine}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Line Item</span>
              </button>
            </div>

            {/* Individual Product List Grid */}
            <div className="border border-slate-800 rounded-xl overflow-hidden shadow-inner">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[980px]">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-2 text-center w-8">#</th>
                      <th className="py-2.5 px-3 min-w-[180px]">Product Name & SKU</th>
                      <th className="py-2.5 px-2 min-w-[140px]">Batch / Expiry</th>
                      <th className="py-2.5 px-2 text-center w-20">Qty</th>
                      <th className="py-2.5 px-2 text-right w-24">Cost Price (₹)</th>
                      <th className="py-2.5 px-2 text-center min-w-[105px]">Tax Type</th>
                      <th className="py-2.5 px-1 text-center w-14">Disc%</th>
                      <th className="py-2.5 px-2 text-right w-24">Unit Landed</th>
                      <th className="py-2.5 px-2 text-right w-24">MRP (₹)</th>
                      <th className="py-2.5 px-2 text-right w-24">Selling (₹)</th>
                      <th className="py-2.5 px-2 text-center min-w-[100px]">Margin</th>
                      <th className="py-2.5 px-2 text-center w-20">GST %</th>
                      <th className="py-2.5 px-3 text-right min-w-[100px]">Total (₹)</th>
                      <th className="py-2.5 px-2 text-center w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70 font-sans">
                    {formData.lines.length === 0 ? (
                      <tr>
                        <td colSpan="14" className="py-12 text-center text-slate-500 text-xs">
                          <ShoppingBag className="w-8 h-8 mx-auto text-slate-600 mb-2 opacity-40" />
                          No items added yet. Use the product search above or click "Add Line Item".
                        </td>
                      </tr>
                    ) : (
                      formData.lines.map((line, idx) => (
                        <tr key={line.lineId || idx} className="hover:bg-slate-800/40 transition">
                          {/* S.No */}
                          <td className="py-2 px-2 text-center font-mono text-slate-500 font-bold">
                            {idx + 1}
                          </td>

                          {/* Product Details */}
                          <td className="py-2 px-3">
                            <div className="font-bold text-white leading-snug">{line.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                              <span>SKU: {line.sku || '—'}</span>
                              <span>• UOM: {line.uom || 'PCS'}</span>
                            </div>
                          </td>

                          {/* Batch & Expiry */}
                          <td className="py-2 px-2">
                            <div className="space-y-1">
                              <input
                                type="text"
                                placeholder="Batch #"
                                value={line.batchNo || ''}
                                onChange={(e) => handleUpdateLine(idx, 'batchNo', e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-[11px] text-slate-200 font-mono"
                              />
                              <input
                                type="date"
                                value={line.expiryDate || ''}
                                onChange={(e) => handleUpdateLine(idx, 'expiryDate', e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-[10px] text-slate-400"
                              />
                            </div>
                          </td>

                          {/* Quantity */}
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              min="1"
                              step="any"
                              required
                              value={line.qty}
                              onChange={(e) => handleUpdateLine(idx, 'qty', e.target.value)}
                              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-center font-bold text-emerald-400 font-mono focus:border-indigo-500"
                            />
                          </td>

                          {/* Cost Price */}
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              required
                              value={line.costPrice}
                              onChange={(e) => handleUpdateLine(idx, 'costPrice', e.target.value)}
                              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-right font-mono font-bold text-slate-100 focus:border-indigo-500"
                            />
                          </td>

                          {/* Tax Type Selector */}
                          <td className="py-2 px-1 text-center">
                            <select
                              value={line.taxType || (line.isTaxInclusive ? 'inclusive' : 'exclusive')}
                              onChange={(e) => handleUpdateLine(idx, 'taxType', e.target.value)}
                              className={`w-full text-[11px] font-semibold py-1 px-1 rounded border focus:outline-none cursor-pointer ${
                                (line.taxType || (line.isTaxInclusive ? 'inclusive' : 'exclusive')) === 'inclusive'
                                  ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300'
                                  : 'bg-indigo-950/80 border-indigo-700 text-indigo-300'
                              }`}
                            >
                              <option value="inclusive" className="bg-slate-900 text-emerald-300">Inclusive</option>
                              <option value="exclusive" className="bg-slate-900 text-indigo-300">Exclusive</option>
                            </select>
                          </td>

                          {/* Line Discount % */}
                          <td className="py-2 px-1">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              placeholder="0"
                              value={line.discountPercent || ''}
                              onChange={(e) => handleUpdateLine(idx, 'discountPercent', e.target.value)}
                              className="w-full bg-slate-950 border border-slate-700 rounded px-1 py-1 text-center font-mono text-slate-300 text-xs"
                            />
                          </td>

                          {/* Single Unit Price (Landed) */}
                          <td className="py-2 px-2 text-right font-mono font-semibold text-slate-300">
                            ₹{Number(line.singleUnitPrice || line.costPrice || 0).toFixed(2)}
                          </td>

                          {/* MRP */}
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="MRP"
                              value={line.mrp || ''}
                              onChange={(e) => handleUpdateLine(idx, 'mrp', e.target.value)}
                              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-right font-mono text-slate-300 focus:border-indigo-500"
                            />
                          </td>

                          {/* Selling Price */}
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="Selling"
                              value={line.sellingPrice || ''}
                              onChange={(e) => handleUpdateLine(idx, 'sellingPrice', e.target.value)}
                              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-right font-mono font-bold text-indigo-300 focus:border-indigo-500"
                            />
                          </td>

                          {/* Margin */}
                          <td className="py-2 px-2 text-center">
                            <div
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono inline-block ${
                                line.margin > 0
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                  : line.margin < 0
                                  ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              ₹{Number(line.margin || 0).toFixed(2)} ({line.marginPercent}%)
                            </div>
                          </td>

                          {/* GST % */}
                          <td className="py-2 px-2 text-center">
                            <select
                              value={line.taxRate}
                              onChange={(e) => handleUpdateLine(idx, 'taxRate', e.target.value)}
                              className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-center font-mono font-semibold text-slate-300"
                            >
                              <option value="0">0%</option>
                              <option value="5">5%</option>
                              <option value="12">12%</option>
                              <option value="18">18%</option>
                              <option value="28">28%</option>
                            </select>
                            <div className="text-[10px] font-mono mt-0.5 whitespace-nowrap">
                              {line.taxType === 'inclusive' ? (
                                <span className="text-emerald-400 font-semibold" title="Inclusive Tax: Included in gross amount">Incl: ₹{Number(line.taxAmount || 0).toFixed(2)}</span>
                              ) : (
                                <span className="text-indigo-400 font-semibold" title="Exclusive Tax: Added on top of taxable amount">+₹{Number(line.taxAmount || 0).toFixed(2)}</span>
                              )}
                            </div>
                          </td>

                          {/* Total */}
                          <td className="py-2 px-3 text-right font-mono font-bold text-white">
                            ₹{Number(line.lineTotal || 0).toFixed(2)}
                          </td>

                          {/* Delete Line */}
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveLine(idx)}
                              className="text-slate-500 hover:text-rose-400 p-1 rounded transition cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Footer Totals, Discount, Other Charges, Tax Split-ups & Payment */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left Box: Payment Details & Notes */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md space-y-3 text-xs">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2 font-bold text-indigo-300 uppercase tracking-wider">
                <DollarSign className="w-4 h-4" />
                <span>Payment & Inward Remarks</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-300 block mb-1">Payment Mode</label>
                  <select
                    value={formData.paymentMode}
                    onChange={(e) => setFormData({ ...formData, paymentMode: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-200 font-semibold"
                  >
                    <option value="CASH">Cash</option>
                    <option value="BANK">Bank Transfer (NEFT/RTGS)</option>
                    <option value="UPI">UPI / QR</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="CREDIT">Vendor Credit / On Account</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-300 block mb-1">Payment Status</label>
                  <select
                    value={formData.paymentStatus}
                    onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-200 font-semibold"
                  >
                    <option value="PAID">Fully Paid</option>
                    <option value="PARTIAL">Partially Paid</option>
                    <option value="PENDING">Credit / Unpaid</option>
                  </select>
                </div>

                {formData.paymentStatus === 'PARTIAL' && (
                  <div>
                    <label className="font-semibold text-slate-300 block mb-1">Paid Amount (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.paidAmount}
                      onChange={(e) => setFormData({ ...formData, paidAmount: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-100 font-mono font-bold"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="font-semibold text-slate-400 block mb-1">Inward Notes / Vendor Remarks</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Received in good condition at Main Store. Transport via VRL Logistics."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Amount in words */}
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Amount in Words:</span>
                <span className="text-slate-300 italic font-medium leading-relaxed">
                  {purchaseCalculations.amountInWords || 'Rupees Zero Only'}
                </span>
              </div>
            </div>

            {/* Right Box: Bill Discount, Other Charges, Tax Split-ups & Total */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 font-bold text-indigo-300 uppercase tracking-wider">
                <div className="flex items-center gap-2">
                  <Percent className="w-4 h-4" />
                  <span>Amount Breakdown & Tax Split-ups</span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  {currentSupplyType} Supply ({currentSupplyType === 'INTERSTATE' ? 'IGST' : 'CGST + SGST'})
                </span>
              </div>

              <div className="space-y-2">
                {/* Gross Subtotal */}
                <div className="flex justify-between items-center text-slate-300">
                  <span>Gross Subtotal (Taxable Value):</span>
                  <span className="font-mono font-bold">₹{purchaseCalculations.subtotal.toFixed(2)}</span>
                </div>

                {/* Line Discounts Total */}
                {purchaseCalculations.lineDiscountsTotal > 0 && (
                  <div className="flex justify-between items-center text-emerald-400">
                    <span>Total Line Discounts:</span>
                    <span className="font-mono font-bold">-₹{purchaseCalculations.lineDiscountsTotal.toFixed(2)}</span>
                  </div>
                )}

                {/* Bill Discount Input */}
                <div className="flex flex-wrap items-center justify-between gap-2 py-1 border-t border-slate-800/60">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-300">Bill Discount:</span>
                    <select
                      value={formData.discountType}
                      onChange={(e) => setFormData({ ...formData, discountType: e.target.value })}
                      className="bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-xs text-slate-200"
                    >
                      <option value="FLAT">Flat ₹</option>
                      <option value="PERCENT">Percent %</option>
                    </select>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0"
                      value={formData.discountValue || ''}
                      onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                      className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-right font-mono text-slate-100"
                    />
                  </div>
                  <span className="font-mono font-bold text-emerald-400">
                    -₹{purchaseCalculations.billDiscountAmount.toFixed(2)}
                  </span>
                </div>

                {/* Other Charges Input */}
                <div className="flex flex-wrap items-center justify-between gap-2 py-1 border-t border-slate-800/60">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-300">Other Charges:</span>
                    <input
                      type="text"
                      placeholder="Remark (Freight/Transport)"
                      value={formData.otherChargesRemark || ''}
                      onChange={(e) => setFormData({ ...formData, otherChargesRemark: e.target.value })}
                      className="w-36 bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-[11px] text-slate-200"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.otherCharges || ''}
                      onChange={(e) => setFormData({ ...formData, otherCharges: e.target.value })}
                      className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-right font-mono text-slate-100"
                    />
                  </div>
                  <span className="font-mono font-bold text-slate-300">
                    +₹{purchaseCalculations.otherCharges.toFixed(2)}
                  </span>
                </div>

                {/* Tax Split-ups Breakdown */}
                <div className="py-2 border-t border-slate-800/60 space-y-1">
                  {currentSupplyType === 'INTERSTATE' ? (
                    <div className="flex justify-between items-center text-slate-300">
                      <span>Total IGST (Interstate):</span>
                      <span className="font-mono font-bold text-indigo-400">₹{purchaseCalculations.igstTotal.toFixed(2)}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-center text-slate-300">
                        <span>Central GST (CGST):</span>
                        <span className="font-mono font-bold text-indigo-400">₹{purchaseCalculations.cgstTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-300">
                        <span>State GST (SGST):</span>
                        <span className="font-mono font-bold text-indigo-400">₹{purchaseCalculations.sgstTotal.toFixed(2)}</span>
                      </div>
                    </>
                  )}

                  {/* GST Slab Pills */}
                  {purchaseCalculations.taxSummary.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {purchaseCalculations.taxSummary.map((item) => (
                        <span
                          key={item.rate}
                          className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-950 border border-slate-800 text-slate-300"
                        >
                          GST {item.rate}%: ₹{item.tax.toFixed(2)} (Taxable: ₹{item.taxable.toFixed(2)})
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Round Off */}
                <div className="flex justify-between items-center text-slate-400 pt-1 border-t border-slate-800/60">
                  <span>Round Off:</span>
                  <span className="font-mono">{purchaseCalculations.roundOff >= 0 ? `+₹${purchaseCalculations.roundOff.toFixed(2)}` : `-₹${Math.abs(purchaseCalculations.roundOff).toFixed(2)}`}</span>
                </div>

                {/* Grand Total */}
                <div className="p-3 bg-slate-950 rounded-xl border border-indigo-600/40 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Grand Total (Net Inward Amount)</span>
                    <div className="text-xs text-slate-500">Includes all taxes, discounts & freight</div>
                  </div>
                  <span className="font-mono text-xl font-extrabold text-emerald-400">
                    ₹{purchaseCalculations.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Balance Due if Partial */}
                {formData.paymentStatus === 'PARTIAL' && (
                  <div className="flex justify-between items-center text-rose-400 font-bold px-1">
                    <span>Balance Due to Supplier:</span>
                    <span className="font-mono">₹{purchaseCalculations.balanceDue.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Form Submit / Cancel Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => {
                setActiveTab('list');
                setEditingPurchaseId(null);
              }}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Posting...' : editingPurchaseId ? 'Update Purchase Receipt' : 'Save & Post Purchase Receipt'}</span>
            </button>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: VIEW PURCHASE DETAILS MODAL                                      */}
      {/* ========================================================================= */}
      {viewingPurchase && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl p-5 space-y-4">
            {(() => {
              const isInit = Boolean(
                viewingPurchase.isInitialStock ||
                viewingPurchase.entryType === 'INITIAL_STOCK' ||
                viewingPurchase.docNumber?.startsWith('INIT-')
              );
              return (
                <>
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded text-[10px] font-bold border font-mono ${
                            isInit
                              ? 'bg-amber-950 text-amber-300 border-amber-700'
                              : 'bg-indigo-950 text-indigo-300 border-indigo-700'
                          }`}
                        >
                          {isInit ? 'INITIAL STOCK INWARD VOUCHER' : 'PURCHASE INWARD VOUCHER'}
                        </span>
                        <h3 className="font-bold text-white text-base">{viewingPurchase.docNumber}</h3>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {isInit
                          ? `Initial Stock Cutover • Branch: ${viewingPurchase.branchName || viewingPurchase.storeName || 'Main Store'}`
                          : `Supplier: ${viewingPurchase.supplierName} • Vendor Bill: ${viewingPurchase.supplierInvoiceNo}`}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setPrintingPurchase(viewingPurchase);
                          setViewingPurchase(null);
                        }}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5 text-emerald-400" />
                        <span>A4 Print</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewingPurchase(null)}
                        className="text-slate-400 hover:text-white p-1 rounded-lg"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Top Details Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold">Branch & Company</span>
                      <div className="font-bold text-white mt-1">
                        {viewingPurchase.branchName || viewingPurchase.storeName || 'Main Store'}
                      </div>
                      <div className="text-slate-400 text-[11px]">{activeCompany?.name || 'NexBill Enterprise'}</div>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold">
                        {isInit ? 'Cutover Reference' : 'Vendor Invoice Info'}
                      </span>
                      <div className="font-mono font-bold text-indigo-300 mt-1">
                        {isInit ? `Ref: ${viewingPurchase.docNumber}` : `Invoice #: ${viewingPurchase.supplierInvoiceNo}`}
                      </div>
                      <div className="text-slate-400 text-[11px]">
                        Date: {viewingPurchase.supplierInvoiceDate || new Date(viewingPurchase.date).toLocaleDateString()}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold">
                        {isInit ? 'Inventory Status' : 'PO & Payment Info'}
                      </span>
                      <div className="text-slate-300 mt-1">
                        {isInit
                          ? 'Stock initialized into active inventory'
                          : `PO Reference: ${viewingPurchase.poNumber || viewingPurchase.purchaseOrderRef || 'None (Direct)'}`}
                      </div>
                      <div className="text-emerald-400 font-bold">
                        {isInit
                          ? 'Status: RECORDED (Opening Balance)'
                          : `Status: ${viewingPurchase.paymentStatus || 'PAID'} (${viewingPurchase.paymentMode || 'CASH'})`}
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}

            {/* Line Items Table */}
            <div className="border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px]">
                  <tr>
                    <th className="py-2 px-3">#</th>
                    <th className="py-2 px-3">Product Name</th>
                    <th className="py-2 px-2 text-center">Qty</th>
                    <th className="py-2 px-2 text-right">Cost Price (₹)</th>
                    <th className="py-2 px-2 text-right">Unit Landed</th>
                    <th className="py-2 px-2 text-right">MRP (₹)</th>
                    <th className="py-2 px-2 text-right">Selling (₹)</th>
                    <th className="py-2 px-2 text-center">Margin</th>
                    <th className="py-2 px-2 text-center">GST %</th>
                    <th className="py-2 px-3 text-right">Line Total (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
                  {viewingPurchase.lines?.map((line, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30">
                      <td className="py-2 px-3 text-slate-500">{idx + 1}</td>
                      <td className="py-2 px-3 font-sans font-bold text-white">{line.name}</td>
                      <td className="py-2 px-2 text-center font-bold text-emerald-400">{line.qty} {line.uom || 'PCS'}</td>
                      <td className="py-2 px-2 text-right text-slate-300">₹{Number(line.costPrice || line.rate || 0).toFixed(2)}</td>
                      <td className="py-2 px-2 text-right text-slate-400">₹{Number(line.singleUnitPrice || line.costPrice || 0).toFixed(2)}</td>
                      <td className="py-2 px-2 text-right text-slate-400">₹{Number(line.mrp || 0).toFixed(2)}</td>
                      <td className="py-2 px-2 text-right text-indigo-300 font-bold">₹{Number(line.sellingPrice || 0).toFixed(2)}</td>
                      <td className="py-2 px-2 text-center">
                        <span className="text-[10px] font-bold text-emerald-400">
                          {line.marginPercent || 0}%
                        </span>
                      </td>
                      <td className="py-2 px-2 text-center text-slate-400">
                        {line.taxRate}%{' '}
                        <span className="text-[10px] text-slate-500 font-sans">
                          ({(line.taxType || (line.isTaxInclusive ? 'inclusive' : 'exclusive')) === 'inclusive' ? 'Incl' : 'Excl'})
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-white">
                        ₹{Number(line.lineTotal || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals Summary */}
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="space-y-0.5">
                <div className="text-slate-400">
                  <span className="font-semibold text-slate-300">Amount in Words: </span>
                  <span className="italic">{viewingPurchase.amountInWords || numberToWords(viewingPurchase.netAmount || viewingPurchase.grandTotal)}</span>
                </div>
                {viewingPurchase.notes && (
                  <div className="text-[11px] text-slate-500">Notes: {viewingPurchase.notes}</div>
                )}
              </div>

              <div className="text-right font-mono">
                <div className="text-xs text-slate-400">
                  Subtotal: ₹{Number(viewingPurchase.subtotal || 0).toFixed(2)} • Tax: ₹{Number(viewingPurchase.totalTax || 0).toFixed(2)}
                </div>
                <div className="text-base font-bold text-emerald-400 mt-0.5">
                  Grand Total: ₹{Number(viewingPurchase.netAmount || viewingPurchase.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setViewingPurchase(null)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: A4 PRINT PURCHASE VOUCHER MODAL                                  */}
      {/* ========================================================================= */}
      {printingPurchase && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 print:hidden">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white text-base">A4 Purchase Inward Receipt Preview</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Document</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrintingPurchase(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable A4 Voucher Sheet */}
            <div className="bg-white text-slate-900 p-8 rounded-xl shadow-lg font-sans text-xs space-y-5 print:p-0 print:m-0 print:border-none">
              {/* Header */}
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
                <div>
                  <h1 className="text-xl font-extrabold uppercase tracking-wide text-slate-900">
                    {activeCompany?.name || 'NexBill Enterprise'}
                  </h1>
                  <p className="text-xs text-slate-600 mt-1 max-w-sm">
                    {printingPurchase.branchName || printingPurchase.storeName || 'Main Store'}
                  </p>
                  <p className="text-xs text-slate-600">
                    GSTIN: {activeCompany?.gstin || '27AAACA1234F1Z9'} • State Code: 27
                  </p>
                </div>

                <div className="text-right">
                  <div className="inline-block bg-slate-900 text-white font-bold px-3 py-1 text-xs rounded uppercase tracking-wider">
                    {printingPurchase.isInitialStock || printingPurchase.entryType === 'INITIAL_STOCK' || printingPurchase.docNumber?.startsWith('INIT-')
                      ? 'INITIAL STOCK INWARD VOUCHER'
                      : 'GOODS INWARD RECEIPT'}
                  </div>
                  <div className="font-mono font-bold text-sm text-slate-900 mt-2">
                    {printingPurchase.docNumber}
                  </div>
                  <div className="text-xs text-slate-600">
                    Date: {new Date(printingPurchase.date).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* Vendor & Invoice Meta */}
              <div className="grid grid-cols-2 gap-4 border border-slate-300 rounded p-3 text-xs">
                {printingPurchase.isInitialStock || printingPurchase.entryType === 'INITIAL_STOCK' || printingPurchase.docNumber?.startsWith('INIT-') ? (
                  <>
                    <div>
                      <span className="font-bold text-slate-700 uppercase text-[10px] block">Opening Inventory Cutover</span>
                      <div className="font-bold text-sm text-slate-900 mt-0.5">
                        {printingPurchase.supplierName || 'Opening Stock / Initial Inventory'}
                      </div>
                      <div className="text-slate-600 text-[11px] mt-0.5">
                        Direct Stock Inward without Vendor Bill
                      </div>
                      <div className="text-slate-600 text-[11px]">
                        Branch / Store: {printingPurchase.branchName || printingPurchase.storeName || 'Main Store'}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-slate-700 uppercase text-[10px] block">Cutover Reference:</span>
                      <div className="font-mono font-bold text-sm text-slate-900 mt-0.5">
                        Ref #: {printingPurchase.docNumber}
                      </div>
                      <div className="text-slate-600 text-[11px]">
                        Cutover Date: {new Date(printingPurchase.date).toLocaleDateString()}
                      </div>
                      <div className="text-emerald-700 font-bold text-[11px] mt-0.5">
                        Status: Stock Initialized
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <span className="font-bold text-slate-700 uppercase text-[10px] block">Supplier / Vendor:</span>
                      <div className="font-bold text-sm text-slate-900 mt-0.5">{printingPurchase.supplierName}</div>
                      <div className="text-slate-600 font-mono text-[11px]">
                        GSTIN: {printingPurchase.supplierGstin || 'Unregistered'}
                      </div>
                      <div className="text-slate-600 text-[11px]">
                        Supply Jurisdiction: {printingPurchase.supplyType || 'LOCAL'}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-bold text-slate-700 uppercase text-[10px] block">Vendor Invoice References:</span>
                      <div className="font-mono font-bold text-sm text-slate-900 mt-0.5">
                        Invoice #: {printingPurchase.supplierInvoiceNo}
                      </div>
                      <div className="text-slate-600 text-[11px]">
                        Invoice Date: {printingPurchase.supplierInvoiceDate || new Date(printingPurchase.date).toLocaleDateString()}
                      </div>
                      {printingPurchase.poNumber && (
                        <div className="text-indigo-700 font-mono font-bold text-[11px]">
                          PO Ref: {printingPurchase.poNumber}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Product Lines Grid */}
              <table className="w-full text-left text-xs border border-slate-300">
                <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] border-b border-slate-300">
                  <tr>
                    <th className="py-2 px-2 border-r border-slate-300 w-8 text-center">#</th>
                    <th className="py-2 px-3 border-r border-slate-300">Item Description</th>
                    <th className="py-2 px-2 border-r border-slate-300 text-center">Qty</th>
                    <th className="py-2 px-2 border-r border-slate-300 text-right">Cost (₹)</th>
                    <th className="py-2 px-2 border-r border-slate-300 text-right">Unit Landed</th>
                    <th className="py-2 px-2 border-r border-slate-300 text-right">MRP (₹)</th>
                    <th className="py-2 px-2 border-r border-slate-300 text-right">Selling (₹)</th>
                    <th className="py-2 px-2 border-r border-slate-300 text-center">Margin</th>
                    <th className="py-2 px-2 border-r border-slate-300 text-center">GST</th>
                    <th className="py-2 px-3 text-right">Total (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300 font-mono text-[11px]">
                  {printingPurchase.lines?.map((line, idx) => (
                    <tr key={idx}>
                      <td className="py-2 px-2 text-center border-r border-slate-300 text-slate-500">{idx + 1}</td>
                      <td className="py-2 px-3 border-r border-slate-300 font-sans font-semibold text-slate-900">
                        {line.name}
                        {line.batchNo && <span className="block text-[10px] text-slate-500 font-mono">Batch: {line.batchNo}</span>}
                      </td>
                      <td className="py-2 px-2 border-r border-slate-300 text-center font-bold">{line.qty} {line.uom || 'PCS'}</td>
                      <td className="py-2 px-2 border-r border-slate-300 text-right">₹{Number(line.costPrice || line.rate || 0).toFixed(2)}</td>
                      <td className="py-2 px-2 border-r border-slate-300 text-right">₹{Number(line.singleUnitPrice || line.costPrice || 0).toFixed(2)}</td>
                      <td className="py-2 px-2 border-r border-slate-300 text-right">₹{Number(line.mrp || 0).toFixed(2)}</td>
                      <td className="py-2 px-2 border-r border-slate-300 text-right">₹{Number(line.sellingPrice || 0).toFixed(2)}</td>
                      <td className="py-2 px-2 border-r border-slate-300 text-center font-sans">{line.marginPercent || 0}%</td>
                      <td className="py-2 px-2 border-r border-slate-300 text-center">
                        {line.taxRate}%
                        <span className="block text-[9px] text-slate-500 font-sans">
                          ({(line.taxType || (line.isTaxInclusive ? 'inclusive' : 'exclusive')) === 'inclusive' ? 'Incl' : 'Excl'})
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">₹{Number(line.lineTotal || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals & Tax Split-ups */}
              <div className="flex justify-between items-start pt-2 border-t border-slate-300 text-xs">
                <div className="space-y-1 max-w-sm">
                  <div className="font-bold text-slate-700">Amount in Words:</div>
                  <div className="italic text-slate-800 leading-snug">
                    {printingPurchase.amountInWords || numberToWords(printingPurchase.netAmount || printingPurchase.grandTotal)}
                  </div>
                  {printingPurchase.notes && (
                    <div className="text-[11px] text-slate-600 pt-2">
                      <span className="font-bold">Remarks: </span>
                      {printingPurchase.notes}
                    </div>
                  )}
                </div>

                <div className="w-64 space-y-1 font-mono text-xs text-right">
                  <div className="flex justify-between">
                    <span className="font-sans text-slate-600">Taxable Value:</span>
                    <span>₹{Number(printingPurchase.subtotal || 0).toFixed(2)}</span>
                  </div>
                  {printingPurchase.discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span className="font-sans">Discount:</span>
                      <span>-₹{Number(printingPurchase.discountAmount).toFixed(2)}</span>
                    </div>
                  )}
                  {printingPurchase.otherCharges > 0 && (
                    <div className="flex justify-between text-slate-700">
                      <span className="font-sans">Other Charges:</span>
                      <span>+₹{Number(printingPurchase.otherCharges).toFixed(2)}</span>
                    </div>
                  )}
                  {printingPurchase.cgstTotal > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span className="font-sans">CGST:</span>
                      <span>₹{Number(printingPurchase.cgstTotal).toFixed(2)}</span>
                    </div>
                  )}
                  {printingPurchase.sgstTotal > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span className="font-sans">SGST:</span>
                      <span>₹{Number(printingPurchase.sgstTotal).toFixed(2)}</span>
                    </div>
                  )}
                  {printingPurchase.igstTotal > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span className="font-sans">IGST:</span>
                      <span>₹{Number(printingPurchase.igstTotal).toFixed(2)}</span>
                    </div>
                  )}
                  {printingPurchase.roundOff !== 0 && (
                    <div className="flex justify-between text-slate-500">
                      <span className="font-sans">Round Off:</span>
                      <span>{Number(printingPurchase.roundOff) >= 0 ? `+₹${Number(printingPurchase.roundOff).toFixed(2)}` : `-₹${Math.abs(Number(printingPurchase.roundOff)).toFixed(2)}`}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-sm border-t-2 border-slate-900 pt-1 text-slate-900">
                    <span className="font-sans">Grand Total:</span>
                    <span>₹{Number(printingPurchase.netAmount || printingPurchase.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-8 pt-10 text-center text-xs">
                <div>
                  <div className="border-t border-slate-400 pt-1 font-semibold text-slate-700">Received By (Storekeeper / Branch)</div>
                </div>
                <div>
                  <div className="border-t border-slate-400 pt-1 font-semibold text-slate-700">Authorized Signature & Seal</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: PURCHASE ORDER SELECTOR MODAL (CONVERT PO)                       */}
      {/* ========================================================================= */}
      {isPOModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-indigo-400" />
                  <span>Choose Purchase Order to Convert</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Select an approved purchase order to auto-load vendor, branch, and line items into this purchase.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPOModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative text-xs">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search by PO Number or Supplier Name..."
                value={poSearchQuery}
                onChange={(e) => setPOSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="border border-slate-800 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">PO #</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Supplier Name</th>
                    <th className="py-2.5 px-2 text-center">Items</th>
                    <th className="py-2.5 px-3 text-right">PO Total (₹)</th>
                    <th className="py-2.5 px-2 text-center">Status</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {availablePOs
                    .filter((po) => {
                      if (!poSearchQuery.trim()) return true;
                      const q = poSearchQuery.toLowerCase();
                      return (
                        po.poNumber?.toLowerCase().includes(q) ||
                        po.supplierName?.toLowerCase().includes(q)
                      );
                    })
                    .map((po) => (
                      <tr key={po.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-2.5 px-3 font-mono font-bold text-indigo-300">{po.poNumber}</td>
                        <td className="py-2.5 px-3 text-slate-400 text-[11px] whitespace-nowrap">
                          {new Date(po.orderDate || po.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-200">{po.supplierName}</td>
                        <td className="py-2.5 px-2 text-center font-bold text-slate-300">{po.lines?.length || 0}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                          ₹{Number(po.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              po.status === 'CONVERTED'
                                ? 'bg-blue-950 text-blue-300 border border-blue-800'
                                : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            }`}
                          >
                            {po.status || 'APPROVED'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleLoadFromPO(po)}
                            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold flex items-center gap-1 mx-auto transition cursor-pointer"
                          >
                            <span>Load this PO</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  {availablePOs.length === 0 && (
                    <tr>
                      <td colSpan="7" className="py-8 text-center text-slate-500 text-xs">
                        No purchase orders available in the database.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsPOModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: DELETE CONFIRMATION MODAL                                        */}
      {/* ========================================================================= */}
      {deletingPurchase && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-900/60 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-950/80 border border-rose-800 text-rose-400 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">
                  {deletingPurchase.isInitialStock || deletingPurchase.entryType === 'INITIAL_STOCK' || deletingPurchase.docNumber?.startsWith('INIT-')
                    ? 'Delete Initial Stock Cutover'
                    : 'Delete Purchase Receipt'}
                </h3>
                <p className="text-xs text-slate-400">Reverses inventory stock balances from the warehouse</p>
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-1.5">
              <div>
                <span className="text-slate-400">Document #: </span>
                <strong className="text-white font-mono">{deletingPurchase.docNumber}</strong>
              </div>
              <div>
                <span className="text-slate-400">
                  {deletingPurchase.isInitialStock || deletingPurchase.entryType === 'INITIAL_STOCK' || deletingPurchase.docNumber?.startsWith('INIT-')
                    ? 'Cutover Type: '
                    : 'Supplier: '}
                </span>
                <strong className="text-slate-200">
                  {deletingPurchase.isInitialStock || deletingPurchase.entryType === 'INITIAL_STOCK' || deletingPurchase.docNumber?.startsWith('INIT-')
                    ? 'Initial Opening Stock'
                    : deletingPurchase.supplierName}
                </strong>
              </div>
              {!(deletingPurchase.isInitialStock || deletingPurchase.entryType === 'INITIAL_STOCK' || deletingPurchase.docNumber?.startsWith('INIT-')) && (
                <div>
                  <span className="text-slate-400">Vendor Bill #: </span>
                  <strong className="text-slate-200 font-mono">{deletingPurchase.supplierInvoiceNo}</strong>
                </div>
              )}
              <div>
                <span className="text-slate-400">Total Value: </span>
                <strong className="text-emerald-400 font-mono">
                  ₹{Number(deletingPurchase.netAmount || deletingPurchase.grandTotal || 0).toFixed(2)}
                </strong>
              </div>
            </div>

            <p className="text-xs text-rose-300">
              ⚠️ Warning: Deleting this record will immediately deduct the items from stock balances. This action is permanently logged to the audit and backlog ledger.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingPurchase(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeletePurchase}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-rose-600/30 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Confirm Deletion</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: MULTIPLE RATE CHOOSER MODAL                                      */}
      {/* ========================================================================= */}
      {rateModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-base">Select Purchase Rate</h3>
                <p className="text-xs text-slate-400">{rateModal.product?.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setRateModal({ isOpen: false, product: null, rates: [], targetLineIdx: null, customRate: '' })}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <p className="text-slate-400">
                Multiple valuation rates were found across warehouse stock balances and purchase history. Choose one or enter a custom rate:
              </p>

              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {rateModal.rates.map((r, rIdx) => (
                  <div
                    key={rIdx}
                    onClick={() => {
                      applyProductToLine(rateModal.product, r.rate, rateModal.targetLineIdx);
                      setRateModal({ isOpen: false, product: null, rates: [], targetLineIdx: null, customRate: '' });
                    }}
                    className="p-2.5 bg-slate-950 hover:bg-indigo-950/60 border border-slate-800 rounded-lg flex items-center justify-between cursor-pointer transition"
                  >
                    <div>
                      <div className="font-mono font-bold text-indigo-300">₹{r.rate.toFixed(2)}</div>
                      <div className="text-[10px] text-slate-400">{r.sources.join(' • ')}</div>
                    </div>
                    <span className="text-[11px] text-indigo-400 font-semibold flex items-center gap-1">
                      <span>Select</span>
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center gap-2">
                <span className="text-slate-400">Custom Rate: ₹</span>
                <input
                  type="number"
                  step="0.01"
                  value={rateModal.customRate}
                  onChange={(e) => setRateModal({ ...rateModal, customRate: e.target.value })}
                  placeholder="0.00"
                  className="flex-1 bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-slate-100 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => {
                    const parsed = parseFloat(rateModal.customRate);
                    applyProductToLine(rateModal.product, isNaN(parsed) ? 0 : parsed, rateModal.targetLineIdx);
                    setRateModal({ isOpen: false, product: null, rates: [], targetLineIdx: null, customRate: '' });
                  }}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold cursor-pointer"
                >
                  Apply Custom
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
