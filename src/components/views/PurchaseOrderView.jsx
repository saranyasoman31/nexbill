// PurchaseOrderView: Purchase Orders Management, Supplier PO Generation, Stock Rate Selection, Email Dispatch & A4 Printing
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { saveDatabase, logAuditEvent, logBacklog } from '../../services/storageService.js';
import { PurchasePostingService } from '../../services/purchasePostingService.js';
import { numberToWords } from '../../utils/numberToWords.js';
import { DEFAULT_PO_TERMS, PO_TERMS_PRESETS } from '../../data/initialData.js';
import {
  ClipboardList,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Printer,
  FileCheck,
  ArrowRight,
  Truck,
  Trash2,
  X,
  AlertTriangle,
  ShieldAlert,
  Edit,
  Eye,
  Lock,
  Mail,
  Send,
  Paperclip,
  Barcode,
  ChevronDown,
  Check,
  RefreshCw,
  FileText,
  DollarSign,
  Building,
  Calendar,
  Ban,
} from 'lucide-react';
import ExportButtons from '../common/ExportButtons.jsx';
import { getProductStockRates, getLatestHistoricalPurchaseRate } from '../../services/purchaseRateHelper.js';

/**
 * Generate next unique sequential PO Number
 */
function generateNextPONumber(db) {
  const existingPOs = db.purchaseOrders || [];
  const year = new Date().getFullYear();
  let maxSeq = 100;
  for (const po of existingPOs) {
    if (po.poNumber) {
      const match = po.poNumber.match(/PO[\/-]\d{4}[\/-](\d+)/i);
      if (match) {
        const seq = parseInt(match[1], 10);
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
      }
    }
  }
  return `PO/${year}/${String(maxSeq + 1).padStart(4, '0')}`;
}

/**
 * Check if a PO Number is already used by another record
 */
function isPONumberDuplicate(poNumber, excludeId, db) {
  if (!poNumber || !poNumber.trim()) return false;
  const num = poNumber.trim().toLowerCase();
  return (db.purchaseOrders || []).some(
    (p) => p.id !== excludeId && p.poNumber?.trim().toLowerCase() === num
  );
}

/**
 * Calculate line item tax and totals
 */
function calculateLineDetails(line, supplyType) {
  const qty = Number(line.qty) || 0;
  const rate = Number(line.rate) || 0;
  const taxRate = Number(line.taxRate) || 0;
  const taxable = qty * rate;

  let cgstRate = 0;
  let cgstAmount = 0;
  let sgstRate = 0;
  let sgstAmount = 0;
  let igstRate = 0;
  let igstAmount = 0;

  if (supplyType === 'INTERSTATE') {
    igstRate = taxRate;
    igstAmount = (taxable * igstRate) / 100;
  } else {
    // Local / Intra-state
    cgstRate = taxRate / 2;
    cgstAmount = (taxable * cgstRate) / 100;
    sgstRate = taxRate / 2;
    sgstAmount = (taxable * sgstRate) / 100;
  }

  const taxAmount = cgstAmount + sgstAmount + igstAmount;
  const lineTotal = taxable + taxAmount;

  return {
    taxable,
    cgstRate,
    cgstAmount,
    sgstRate,
    sgstAmount,
    igstRate,
    igstAmount,
    taxAmount,
    lineTotal,
  };
}

export default function PurchaseOrderView() {
  const { db, currentUser, notify, triggerRefresh, activeStore, activeWarehouse, hasPermission } = useApp();

  const canView = hasPermission('purchase_order', 'view');
  const canAdd = hasPermission('purchase_order', 'add');
  const canUpdate = hasPermission('purchase_order', 'update');
  const canDelete = hasPermission('purchase_order', 'delete');
  const canPrint = hasPermission('purchase_order', 'print');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingPO, setEditingPO] = useState(null); // null = Create, object = Edit
  const [viewingPO, setViewingPO] = useState(null);
  const [printingPO, setPrintingPO] = useState(null);
  const [emailingPO, setEmailingPO] = useState(null);

  // Rate Selection Modal for items with multiple stock rates
  const [rateModal, setRateModal] = useState({
    isOpen: false,
    product: null,
    rates: [],
    targetLineIdx: null,
    customRate: '',
  });

  // Product Search / Barcode Scan state
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [highlightedSuggestionIndex, setHighlightedSuggestionIndex] = useState(-1);
  const searchInputRef = useRef(null);
  const searchContainerRef = useRef(null);
  const suggestionItemRefs = useRef([]);

  // Form State
  const [formData, setFormData] = useState({
    poNumber: '',
    supplierId: '',
    warehouseId: '',
    orderDate: new Date().toISOString().split('T')[0],
    expectedDate: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0],
    notes: '',
    termsAndConditions: db.settings?.defaultPOTerms || DEFAULT_PO_TERMS,
    sendMail: false,
    mailTo: '',
    mailSubject: '',
    mailNotes: '',
    lines: [],
  });

  // Apply a preset or append a clause to terms and conditions
  const handleApplyTermPreset = (preset) => {
    if (preset.mode === 'replace') {
      setFormData((prev) => ({ ...prev, termsAndConditions: preset.text }));
    } else {
      setFormData((prev) => {
        const current = (prev.termsAndConditions || '').trim();
        if (!current) {
          return { ...prev, termsAndConditions: `1. ${preset.text}` };
        }
        const lines = current.split('\n').filter(Boolean);
        const lastLine = lines[lines.length - 1] || '';
        const match = lastLine.match(/^(\d+)[\.\)]/);
        let nextNumPrefix = '';
        if (match) {
          const nextNum = parseInt(match[1], 10) + 1;
          nextNumPrefix = `${nextNum}. `;
        } else {
          nextNumPrefix = `${lines.length + 1}. `;
        }
        return {
          ...prev,
          termsAndConditions: `${current}\n${nextNumPrefix}${preset.text}`,
        };
      });
    }
  };

  // Click outside listener to exit / close suggestions dropdown
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

  // Initialize or reset form
  const initNewPO = () => {
    const firstSupplier = db.suppliers?.[0];
    const generatedNo = generateNextPONumber(db);
    const firstWh = activeWarehouse?.id || db.warehouses?.[0]?.id || 'WH-MUM-MAIN';

    setFormData({
      poNumber: generatedNo,
      supplierId: firstSupplier?.id || '',
      warehouseId: firstWh,
      orderDate: new Date().toISOString().split('T')[0],
      expectedDate: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0],
      notes: 'Urgent stock replenishment',
      termsAndConditions: db.settings?.defaultPOTerms || DEFAULT_PO_TERMS,
      sendMail: false,
      mailTo: firstSupplier?.email || '',
      mailSubject: `Purchase Order ${generatedNo} - ${activeStore?.name || 'NexBill Retail'}`,
      mailNotes: `Dear ${firstSupplier?.contactPerson || firstSupplier?.name || 'Supplier'},\n\nPlease find attached our Purchase Order ${generatedNo}. Kindly acknowledge receipt and confirm delivery schedule.\n\nThank you.`,
      lines: [],
    });
    setEditingPO(null);
    setProductSearchQuery('');
    setHighlightedSuggestionIndex(-1);
    setIsSearchDropdownOpen(false);
  };

  // Selected Supplier helper
  const selectedSupplier = useMemo(() => {
    return (db.suppliers || []).find((s) => s.id === formData.supplierId) || null;
  }, [db.suppliers, formData.supplierId]);

  // Determine supply type: INTERSTATE vs LOCAL
  const currentSupplyType = useMemo(() => {
    if (!selectedSupplier) return 'LOCAL';
    if (selectedSupplier.supplyType) return selectedSupplier.supplyType;
    if (selectedSupplier.stateCode && activeStore?.stateCode) {
      return selectedSupplier.stateCode === activeStore.stateCode ? 'LOCAL' : 'INTERSTATE';
    }
    return 'LOCAL';
  }, [selectedSupplier, activeStore]);

  // Real-time duplicate PO number validation
  const poNumberError = useMemo(() => {
    if (!formData.poNumber || !formData.poNumber.trim()) {
      return 'Purchase Order number is required.';
    }
    if (isPONumberDuplicate(formData.poNumber, editingPO?.id, db)) {
      return `PO Number "${formData.poNumber}" is already in use. Please enter a unique number.`;
    }
    return null;
  }, [formData.poNumber, editingPO, db]);

  // Recalculate totals for active form
  const orderCalculations = useMemo(() => {
    let subtotal = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;
    let totalQty = 0;

    const detailedLines = formData.lines.map((l) => {
      const calc = calculateLineDetails(l, currentSupplyType);
      subtotal += calc.taxable;
      cgstTotal += calc.cgstAmount;
      sgstTotal += calc.sgstAmount;
      igstTotal += calc.igstAmount;
      totalQty += Number(l.qty) || 0;
      return {
        ...l,
        ...calc,
      };
    });

    const totalTax = cgstTotal + sgstTotal + igstTotal;
    const unroundedTotal = subtotal + totalTax;
    const grandTotal = Math.round(unroundedTotal);
    const roundOff = Number((grandTotal - unroundedTotal).toFixed(2));
    const amountInWords = numberToWords(grandTotal);

    return {
      lines: detailedLines,
      subtotal,
      cgstTotal,
      sgstTotal,
      igstTotal,
      totalTax,
      roundOff,
      grandTotal,
      totalQty,
      amountInWords,
    };
  }, [formData.lines, currentSupplyType]);

  // Filtered product suggestions for search
  const productSearchResults = useMemo(() => {
    const q = productSearchQuery.trim().toLowerCase();
    if (!q) return [];
    return (db.products || [])
      .filter((p) => p.active !== false)
      .filter((p) => {
        return (
          p.name?.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.barcode?.includes(q) ||
          p.hsnCode?.includes(q)
        );
      })
      .slice(0, 10);
  }, [db.products, productSearchQuery]);

  // Reset or initialize highlighted suggestion index on results update
  useEffect(() => {
    if (productSearchResults.length > 0) {
      setHighlightedSuggestionIndex(0);
    } else {
      setHighlightedSuggestionIndex(-1);
    }
  }, [productSearchResults]);

  // Scroll highlighted suggestion item into view
  useEffect(() => {
    if (
      highlightedSuggestionIndex >= 0 &&
      suggestionItemRefs.current[highlightedSuggestionIndex]
    ) {
      suggestionItemRefs.current[highlightedSuggestionIndex].scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [highlightedSuggestionIndex]);

  // Handlers for adding products
  const handleSelectProduct = (product, targetLineIdx = null) => {
    const rates = getProductStockRates(product.id, db);

    if (rates.length > 1) {
      // Multiple valuation rates found in stock table: open chooser modal!
      setRateModal({
        isOpen: true,
        product,
        rates,
        targetLineIdx,
        customRate: String(product.costRate || rates[0].rate || ''),
      });
      setIsSearchDropdownOpen(false);
      setHighlightedSuggestionIndex(-1);
      return;
    }

    // Only 1 rate exists or standard cost rate: immediately load product!
    const singleRate = rates.length === 1 ? rates[0].rate : (product.costRate || 0);
    const rateSource = rates.length === 1 ? rates[0].sources[0] : (product.costRate ? 'Default Master Cost' : 'Unset');

    applyProductToLine(product, singleRate, rateSource, targetLineIdx);
    setIsSearchDropdownOpen(false);
    setHighlightedSuggestionIndex(-1);
    setProductSearchQuery('');
  };

  const applyProductToLine = (product, chosenRate, rateSource, targetLineIdx = null) => {
    const newLine = {
      productId: product.id,
      productName: product.name,
      sku: product.sku || '',
      barcode: product.barcode || '',
      hsnCode: product.hsnCode || '1006',
      uom: product.uom || 'Pcs',
      qty: 10,
      rate: Number(chosenRate),
      taxRate: Number(product.taxRate || 5),
      rateSource: rateSource || 'Standard Rate',
    };

    if (targetLineIdx !== null && targetLineIdx >= 0) {
      // Update existing line
      const updated = [...formData.lines];
      updated[targetLineIdx] = {
        ...updated[targetLineIdx],
        rate: Number(chosenRate),
        rateSource,
      };
      setFormData({ ...formData, lines: updated });
    } else {
      // Append new line (no stock checking on PO!)
      setFormData({ ...formData, lines: [...formData.lines, newLine] });
    }
  };

  const handleApplyChosenRate = (chosenRate, sourceName) => {
    if (rateModal.product) {
      applyProductToLine(
        rateModal.product,
        chosenRate,
        sourceName,
        rateModal.targetLineIdx
      );
    }
    setRateModal({ isOpen: false, product: null, rates: [], targetLineIdx: null, customRate: '' });
    setProductSearchQuery('');
    setHighlightedSuggestionIndex(-1);
    setIsSearchDropdownOpen(false);
  };

  // Keyboard navigation for suggestions dropdown (ArrowDown, ArrowUp, Enter, Escape)
  const handleSearchKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isSearchDropdownOpen) {
        setIsSearchDropdownOpen(true);
      }
      if (productSearchResults.length > 0) {
        setHighlightedSuggestionIndex((prev) =>
          prev < productSearchResults.length - 1 ? prev + 1 : 0
        );
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isSearchDropdownOpen) {
        setIsSearchDropdownOpen(true);
      }
      if (productSearchResults.length > 0) {
        setHighlightedSuggestionIndex((prev) =>
          prev > 0 ? prev - 1 : productSearchResults.length - 1
        );
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (
        isSearchDropdownOpen &&
        highlightedSuggestionIndex >= 0 &&
        highlightedSuggestionIndex < productSearchResults.length
      ) {
        handleSelectProduct(productSearchResults[highlightedSuggestionIndex]);
      } else {
        handleBarcodeOrSearchSubmit(e);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsSearchDropdownOpen(false);
      setHighlightedSuggestionIndex(-1);
    }
  };

  // Barcode scanner Enter key handler
  const handleBarcodeOrSearchSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const query = productSearchQuery.trim();
    if (!query) return;

    // Check exact barcode match
    const exactBarcodeMatch = (db.products || []).find(
      (p) => p.barcode && p.barcode.trim() === query
    );
    if (exactBarcodeMatch) {
      handleSelectProduct(exactBarcodeMatch);
      return;
    }

    // Check exact SKU match
    const exactSkuMatch = (db.products || []).find(
      (p) => p.sku && p.sku.trim().toLowerCase() === query.toLowerCase()
    );
    if (exactSkuMatch) {
      handleSelectProduct(exactSkuMatch);
      return;
    }

    // If suggestions exist and one is highlighted
    if (
      isSearchDropdownOpen &&
      highlightedSuggestionIndex >= 0 &&
      highlightedSuggestionIndex < productSearchResults.length
    ) {
      handleSelectProduct(productSearchResults[highlightedSuggestionIndex]);
      return;
    }

    // If suggestions exist, pick the first
    if (productSearchResults.length > 0) {
      handleSelectProduct(productSearchResults[0]);
    } else {
      notify('error', `No product found matching "${query}".`, 'Product Not Found');
    }
  };

  // Line item field change
  const handleLineFieldChange = (idx, field, val) => {
    const updated = [...formData.lines];
    updated[idx] = {
      ...updated[idx],
      [field]: val,
    };
    setFormData({ ...formData, lines: updated });
  };

  const handleRemoveLine = (idx) => {
    setFormData({
      ...formData,
      lines: formData.lines.filter((_, i) => i !== idx),
    });
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    initNewPO();
    setIsFormModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (po) => {
    if (!canUpdate) {
      notify('error', 'You do not have permission to edit purchase orders.', 'Permission Denied');
      return;
    }
    // Lock check: Converted POs CANNOT be edited!
    if (po.status === 'CONVERTED' || po.convertedPurchaseId) {
      notify('error', 'This Purchase Order has already been converted to a Purchase Inward. Editing is permanently locked.', 'Order Locked');
      return;
    }

    setEditingPO(po);
    setFormData({
      poNumber: po.poNumber,
      supplierId: po.supplierId,
      warehouseId: po.warehouseId || activeWarehouse?.id || 'WH-MUM-MAIN',
      orderDate: po.orderDate ? po.orderDate.split('T')[0] : new Date().toISOString().split('T')[0],
      expectedDate: po.expectedDate ? po.expectedDate.split('T')[0] : new Date().toISOString().split('T')[0],
      notes: po.notes || '',
      termsAndConditions: po.termsAndConditions !== undefined ? po.termsAndConditions : (db.settings?.defaultPOTerms || DEFAULT_PO_TERMS),
      sendMail: Boolean(po.emailSent),
      mailTo: po.emailSentTo || db.suppliers.find((s) => s.id === po.supplierId)?.email || '',
      mailSubject: po.emailSubject || `Purchase Order ${po.poNumber}`,
      mailNotes: po.emailBody || '',
      lines: (po.lines || []).map((l) => ({
        productId: l.productId,
        productName: l.productName || l.name,
        sku: l.sku || '',
        barcode: l.barcode || '',
        hsnCode: l.hsnCode || '1006',
        uom: l.uom || 'Pcs',
        qty: l.orderedQty || l.qty || 1,
        rate: l.rate || 0,
        taxRate: l.taxRate || 5,
        rateSource: l.rateSource || 'Existing PO Rate',
      })),
    });
    setProductSearchQuery('');
    setHighlightedSuggestionIndex(-1);
    setIsSearchDropdownOpen(false);
    setIsFormModalOpen(true);
  };

  // Save Purchase Order (Create or Update)
  const handleSubmitPO = (e) => {
    e.preventDefault();

    if (poNumberError) {
      notify('error', poNumberError, 'Validation Error');
      return;
    }
    if (!formData.supplierId) {
      notify('error', 'Please select a supplier.', 'Validation Error');
      return;
    }
    if (formData.lines.length === 0) {
      notify('error', 'Please add at least one product item to the purchase order.', 'Empty Order');
      return;
    }

    // Default receiving warehouse in background
    const targetWarehouseId = formData.warehouseId || activeWarehouse?.id || db.warehouses?.[0]?.id || 'WH-MUM-MAIN';

    // Validate quantities & rates (No stock checking on PO!)
    for (let i = 0; i < formData.lines.length; i++) {
      const l = formData.lines[i];
      if (Number(l.qty) <= 0) {
        notify('error', `Line #${i + 1} (${l.productName}): Quantity must be greater than zero.`, 'Invalid Quantity');
        return;
      }
      if (Number(l.rate) < 0) {
        notify('error', `Line #${i + 1} (${l.productName}): Unit rate cannot be negative.`, 'Invalid Rate');
        return;
      }
    }

    const supp = selectedSupplier;
    const { lines: detailedLines, subtotal, totalTax, grandTotal, cgstTotal, sgstTotal, igstTotal, roundOff, amountInWords } = orderCalculations;

    const emailSent = Boolean(formData.sendMail);
    const emailData = emailSent
      ? {
          emailSent: true,
          emailSentTo: formData.mailTo,
          emailSentAt: new Date().toISOString(),
          emailSubject: formData.mailSubject,
          emailBody: formData.mailNotes,
          hasPdfAttachment: true,
        }
      : {
          emailSent: editingPO ? editingPO.emailSent : false,
          emailSentTo: editingPO ? editingPO.emailSentTo : null,
          emailSentAt: editingPO ? editingPO.emailSentAt : null,
          emailSubject: editingPO ? editingPO.emailSubject : null,
          emailBody: editingPO ? editingPO.emailBody : null,
          hasPdfAttachment: editingPO ? editingPO.hasPdfAttachment : false,
        };

    const formattedLines = detailedLines.map((l) => ({
      productId: l.productId,
      name: l.productName,
      productName: l.productName,
      sku: l.sku,
      barcode: l.barcode,
      hsnCode: l.hsnCode,
      uom: l.uom,
      orderedQty: Number(l.qty),
      qty: Number(l.qty),
      rate: Number(l.rate),
      taxRate: Number(l.taxRate),
      taxableAmount: Number(l.taxable.toFixed(2)),
      cgstRate: l.cgstRate,
      cgstAmount: Number(l.cgstAmount.toFixed(2)),
      sgstRate: l.sgstRate,
      sgstAmount: Number(l.sgstAmount.toFixed(2)),
      igstRate: l.igstRate,
      igstAmount: Number(l.igstAmount.toFixed(2)),
      taxAmount: Number(l.taxAmount.toFixed(2)),
      lineTotal: Number(l.lineTotal.toFixed(2)),
      rateSource: l.rateSource || 'Selected Rate',
    }));

    if (!db.purchaseOrders) db.purchaseOrders = [];

    if (editingPO) {
      // Update existing PO
      const idx = db.purchaseOrders.findIndex((p) => p.id === editingPO.id);
      if (idx === -1) {
        notify('error', 'Purchase order record not found.', 'Error');
        return;
      }

      db.purchaseOrders[idx] = {
        ...db.purchaseOrders[idx],
        poNumber: formData.poNumber.trim(),
        supplierId: formData.supplierId,
        supplierName: supp?.name || 'Supplier',
        supplierGstin: supp?.gstin || '',
        supplierState: supp?.state || '',
        supplierStateCode: supp?.stateCode || '',
        supplyType: currentSupplyType,
        storeId: activeStore?.id || 'STR-01',
        warehouseId: targetWarehouseId,
        orderDate: new Date(formData.orderDate).toISOString(),
        expectedDate: new Date(formData.expectedDate).toISOString(),
        notes: formData.notes,
        termsAndConditions: formData.termsAndConditions,
        lines: formattedLines,
        subtotal: Number(subtotal.toFixed(2)),
        cgstTotal: Number(cgstTotal.toFixed(2)),
        sgstTotal: Number(sgstTotal.toFixed(2)),
        igstTotal: Number(igstTotal.toFixed(2)),
        totalTax: Number(totalTax.toFixed(2)),
        roundOff,
        totalAmount: grandTotal,
        amountInWords,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.id,
        ...emailData,
      };

      saveDatabase(db);
      logAuditEvent('PO_UPDATED', currentUser.id, `Updated Purchase Order ${formData.poNumber}`);
      logBacklog({
        action: 'UPDATE',
        formName: 'Purchase Order',
        recordRef: formData.poNumber.trim(),
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        details: `Updated Purchase Order ${formData.poNumber} for ${supp?.name || 'Supplier'} (${formattedLines.length} items, Total: ₹${grandTotal.toFixed(2)})`,
      });
      notify('success', `Purchase Order ${formData.poNumber} successfully updated!`, 'PO Updated');
      if (emailSent) {
        notify('info', `Simulated dispatch: PO ${formData.poNumber} emailed to ${formData.mailTo} with attached PDF.`, 'Email Sent');
      }
    } else {
      // Create new PO
      const newId = `PO-2026-${String((db.purchaseOrders || []).length + 1).padStart(4, '0')}`;
      const newPO = {
        id: newId,
        poNumber: formData.poNumber.trim(),
        supplierId: formData.supplierId,
        supplierName: supp?.name || 'Supplier',
        supplierGstin: supp?.gstin || '',
        supplierState: supp?.state || '',
        supplierStateCode: supp?.stateCode || '',
        supplyType: currentSupplyType,
        storeId: activeStore?.id || 'STR-01',
        warehouseId: targetWarehouseId,
        orderDate: new Date(formData.orderDate).toISOString(),
        expectedDate: new Date(formData.expectedDate).toISOString(),
        status: 'DRAFT',
        lines: formattedLines,
        subtotal: Number(subtotal.toFixed(2)),
        cgstTotal: Number(cgstTotal.toFixed(2)),
        sgstTotal: Number(sgstTotal.toFixed(2)),
        igstTotal: Number(igstTotal.toFixed(2)),
        totalTax: Number(totalTax.toFixed(2)),
        roundOff,
        totalAmount: grandTotal,
        amountInWords,
        notes: formData.notes,
        termsAndConditions: formData.termsAndConditions,
        createdAt: new Date().toISOString(),
        createdBy: currentUser.id,
        ...emailData,
      };

      db.purchaseOrders.unshift(newPO);
      saveDatabase(db);
      logAuditEvent('PO_CREATED', currentUser.id, `Created Purchase Order ${newPO.poNumber} for ${newPO.supplierName}`);
      logBacklog({
        action: 'SAVE',
        formName: 'Purchase Order',
        recordRef: newPO.poNumber,
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        details: `Saved new Purchase Order ${newPO.poNumber} for ${newPO.supplierName} with ${newPO.lines.length} items. Total: ₹${newPO.totalAmount.toFixed(2)}`,
      });
      notify('success', `Purchase Order ${newPO.poNumber} generated successfully!`, 'PO Created');
      if (emailSent) {
        notify('info', `Simulated dispatch: PO ${newPO.poNumber} emailed to ${formData.mailTo} with attached PDF.`, 'Email Sent');
      }
    }

    triggerRefresh();
    setIsFormModalOpen(false);
  };

  // Approve PO
  const handleApprovePO = (po) => {
    po.status = 'APPROVED';
    saveDatabase(db);
    logAuditEvent('PO_APPROVED', currentUser.id, `Approved Purchase Order ${po.poNumber}`);
    logBacklog({
      action: 'UPDATE',
      formName: 'Purchase Order',
      recordRef: po.poNumber,
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      details: `Approved Purchase Order ${po.poNumber} for supplier dispatch`,
    });
    notify('success', `Purchase Order ${po.poNumber} approved for supplier dispatch.`, 'PO Approved');
    triggerRefresh();
  };

  // Cancel PO
  const handleCancelPO = (po) => {
    if (po.status === 'CONVERTED') {
      notify('error', 'Cannot cancel order that has already been converted to a purchase inward.', 'Order Locked');
      return;
    }
    if (window.confirm(`Are you sure you want to cancel Purchase Order "${po.poNumber}"?`)) {
      po.status = 'CANCELLED';
      saveDatabase(db);
      logAuditEvent('PO_CANCELLED', currentUser.id, `Cancelled PO ${po.poNumber}`);
      logBacklog({
        action: 'CANCEL',
        formName: 'Purchase Order',
        recordRef: po.poNumber,
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        details: `Cancelled Purchase Order ${po.poNumber} for ${po.supplierName}`,
      });
      notify('info', `Purchase order ${po.poNumber} cancelled.`, 'PO Cancelled');
      triggerRefresh();
    }
  };

  // Convert to Inward Purchase Invoice
  const handleConvertToPurchase = (po) => {
    try {
      const vendorInvNo = `VINV-${po.poNumber.replace(/[\/\s]/g, '-')}`;
      const purchaseLines = (po.lines || []).map((l) => ({
        productId: l.productId,
        name: l.productName || l.name,
        qty: l.orderedQty || l.qty,
        rate: l.rate,
        taxRate: l.taxRate,
      }));

      const res = PurchasePostingService.postPurchase({
        supplierId: po.supplierId,
        supplierInvoiceNo: vendorInvNo,
        companyId: activeStore?.companyId || 'COMP-01',
        storeId: po.storeId || activeStore?.id || 'STR-01',
        warehouseId: po.warehouseId || activeWarehouse?.id || 'WH-MUM-MAIN',
        items: purchaseLines,
        lines: purchaseLines,
        userId: currentUser.id,
      });

      po.status = 'CONVERTED';
      po.convertedPurchaseId = res.purchase?.id || res.id;
      po.convertedPurchaseDoc = res.purchase?.docNumber || res.docNumber;

      saveDatabase(db);
      logAuditEvent(
        'PO_CONVERTED_TO_PURCHASE',
        currentUser.id,
        `PO ${po.poNumber} converted to Purchase Inward ${res.purchase?.docNumber || ''}. Stock updated.`
      );
      logBacklog({
        action: 'UPDATE',
        formName: 'Purchase Order',
        recordRef: po.poNumber,
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        details: `Converted Purchase Order ${po.poNumber} to Purchase Inward ${res.purchase?.docNumber || ''}. Status set to CONVERTED.`,
      });
      notify('success', `PO ${po.poNumber} converted to Purchase Inward ${res.purchase?.docNumber || ''} with stock updated!`, 'Stock Inward Completed');
      triggerRefresh();
    } catch (e) {
      notify('error', e.message, 'Conversion Failed');
    }
  };

  // Delete PO
  const handleDeletePO = (po) => {
    if (!canDelete) {
      notify('error', 'You do not have permission to delete purchase orders.', 'Permission Denied');
      return;
    }
    // Lock check: Converted POs CANNOT be deleted!
    if (po.status === 'CONVERTED' || po.convertedPurchaseId) {
      notify('error', `Cannot delete Purchase Order ${po.poNumber}. It is locked because it was already converted to Purchase Inward.`, 'Action Blocked');
      return;
    }
    if (po.status !== 'DRAFT') {
      notify('error', `Cannot delete PO ${po.poNumber} in ${po.status} status. Only DRAFT orders can be removed.`, 'Action Blocked');
      return;
    }
    if (window.confirm(`Delete Purchase Order "${po.poNumber}"?`)) {
      db.purchaseOrders = db.purchaseOrders.filter((p) => p.id !== po.id);
      saveDatabase(db);
      logAuditEvent('PO_DELETED', currentUser.id, `Deleted PO ${po.poNumber}`);
      logBacklog({
        action: 'DELETE',
        formName: 'Purchase Order',
        recordRef: po.poNumber,
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        details: `Deleted draft Purchase Order ${po.poNumber} (Supplier: ${po.supplierName})`,
      });
      notify('info', `Purchase order ${po.poNumber} deleted.`, 'PO Deleted');
      triggerRefresh();
    }
  };

  // Standalone Email Dispatch for saved POs
  const handleSendStandaloneEmail = (e) => {
    e.preventDefault();
    if (!emailingPO) return;
    const recipient = emailingPO.mailTo?.trim();
    if (!recipient) {
      notify('error', 'Please specify a valid recipient email address.', 'Missing Recipient');
      return;
    }

    const po = (db.purchaseOrders || []).find((p) => p.id === emailingPO.id);
    if (po) {
      po.emailSent = true;
      po.emailSentTo = recipient;
      po.emailSentAt = new Date().toISOString();
      po.emailSubject = emailingPO.mailSubject;
      po.emailBody = emailingPO.mailNotes;
      po.hasPdfAttachment = true;
      saveDatabase(db);
      logAuditEvent('PO_EMAILED', currentUser.id, `Dispatched PO ${po.poNumber} to ${recipient}`);
      notify('success', `Purchase order ${po.poNumber} emailed to ${recipient} with PDF attached!`, 'Email Sent');
      triggerRefresh();
    }
    setEmailingPO(null);
  };

  // Filtered PO list
  const purchaseOrders = (db.purchaseOrders || []).filter((po) => {
    const q = search.toLowerCase();
    const matchSearch =
      po.poNumber?.toLowerCase().includes(q) ||
      po.supplierName?.toLowerCase().includes(q) ||
      po.status?.toLowerCase().includes(q) ||
      po.id?.toLowerCase().includes(q);

    const matchStatus = statusFilter === 'ALL' || po.status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (!canView) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-lg mx-auto shadow-2xl space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-950/80 border border-rose-500/50 flex items-center justify-center mx-auto text-rose-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Access Restricted</h3>
            <p className="text-xs text-slate-400 mt-1">
              You do not have permission to view the <span className="text-slate-200 font-semibold">Purchase Order</span> module.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
      {/* Top Header & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-3 rounded-xl shadow-md">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-indigo-400" />
          <div>
            <h3 className="font-bold text-white text-sm">Purchase Orders (PO) Management</h3>
            <p className="text-[11px] text-slate-400">
              Procure goods, verify stock valuation rates, email suppliers with PDF attachments, and convert approved POs to purchase inwards
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {/* Status Filter Tabs */}
          <div className="flex bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs">
            {['ALL', 'DRAFT', 'APPROVED', 'CONVERTED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
                  statusFilter === st ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search PO #, supplier..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-52"
            />
          </div>

          <ExportButtons
            data={purchaseOrders.map((po, idx) => ({
              '#': idx + 1,
              'PO Number': po.poNumber,
              'Order Date': new Date(po.orderDate || po.createdAt || Date.now()).toLocaleDateString(),
              'Supplier Name': po.supplierName,
              'Expected Date': po.expectedDate ? new Date(po.expectedDate).toLocaleDateString() : '',
              'Items Count': po.lines?.length || 0,
              'Subtotal': `₹${Number(po.subtotal || 0).toFixed(2)}`,
              'Total Tax': `₹${Number(po.totalTax || 0).toFixed(2)}`,
              'Total Amount': `₹${Number(po.totalAmount || 0).toFixed(2)}`,
              'Status': po.status,
              'Email Dispatched': po.emailSent ? `Yes (${po.emailSentTo})` : 'No',
              'Converted Purchase': po.convertedPurchaseDoc || (po.convertedPurchaseId ? 'Inwarded' : 'N/A'),
            }))}
            filename="PURCHASE_ORDERS_DIRECTORY"
            title="PURCHASE ORDERS DIRECTORY"
            pdfOrientation="landscape"
          />

          {canAdd && (
            <button
              onClick={handleOpenCreateModal}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-indigo-600/30 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Purchase Order</span>
            </button>
          )}
        </div>
      </div>

      {/* Purchase Orders List Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">PO Number</th>
                <th className="py-2.5 px-3">Order Date</th>
                <th className="py-2.5 px-3">Supplier Name</th>
                <th className="py-2.5 px-3">Expected Date</th>
                <th className="py-2.5 px-3 text-center">Items</th>
                <th className="py-2.5 px-3 text-right">PO Total Amount</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-center">Email Dispatch</th>
                <th className="py-2.5 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {purchaseOrders.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-8 text-center text-slate-500 font-sans">
                    No purchase orders found. Click "Create Purchase Order" to generate one.
                  </td>
                </tr>
              ) : (
                purchaseOrders.map((po) => {
                  const isConverted = po.status === 'CONVERTED' || Boolean(po.convertedPurchaseId);
                  return (
                    <tr key={po.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-2.5 px-3 font-bold text-indigo-300">
                        {po.poNumber}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 font-sans">
                        {new Date(po.orderDate || po.createdAt || Date.now()).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-3 font-sans font-bold text-white">
                        <div>{po.supplierName}</div>
                        {po.supplierGstin && (
                          <div className="text-[10px] text-slate-500 font-mono">{po.supplierGstin}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 font-sans">
                        {po.expectedDate ? new Date(po.expectedDate).toLocaleDateString() : '—'}
                      </td>
                      {/* Items Column: number only (Lines removed) */}
                      <td className="py-2.5 px-3 text-center font-bold text-slate-300">
                        {po.lines?.length || 0}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-white">
                        ₹{Number(po.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3 text-center font-sans">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 ${
                            isConverted
                              ? 'bg-blue-950 text-blue-300 border border-blue-800'
                              : po.status === 'APPROVED'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : po.status === 'CANCELLED'
                              ? 'bg-rose-950 text-rose-300 border border-rose-800'
                              : 'bg-amber-950 text-amber-300 border border-amber-800'
                          }`}
                        >
                          {isConverted && <Lock className="w-2.5 h-2.5 text-blue-400" />}
                          {po.status === 'CANCELLED' && <Ban className="w-2.5 h-2.5 text-rose-400" />}
                          {po.status}
                        </span>
                        {isConverted && po.convertedPurchaseDoc && (
                          <div className="text-[9px] text-indigo-400 mt-0.5 font-mono">
                            {po.convertedPurchaseDoc}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center font-sans">
                        {po.emailSent ? (
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-950 text-emerald-300 border border-emerald-800/80 inline-flex items-center gap-1"
                            title={`Sent to: ${po.emailSentTo} at ${new Date(po.emailSentAt || Date.now()).toLocaleString()}`}
                          >
                            <Mail className="w-3 h-3 text-emerald-400" />
                            Sent
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 italic">Not Sent</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center font-sans">
                        <div className="flex items-center justify-center gap-1">
                          {/* 1. View Option */}
                          <button
                            onClick={() => setViewingPO(po)}
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                            title="View Full PO Details"
                          >
                            <Eye className="w-3.5 h-3.5 text-indigo-400" />
                          </button>

                          {/* 2. A4 Print Option */}
                          {canPrint && (
                            <button
                              onClick={() => setPrintingPO(po)}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                              title="Print A4 Purchase Order"
                            >
                              <Printer className="w-3.5 h-3.5 text-emerald-400" />
                            </button>
                          )}

                          {/* 3. Send / Resend Email Option */}
                          <button
                            onClick={() => {
                              const supp = db.suppliers.find((s) => s.id === po.supplierId);
                              setEmailingPO({
                                ...po,
                                mailTo: po.emailSentTo || supp?.email || '',
                                mailSubject: po.emailSubject || `Purchase Order ${po.poNumber} - ${activeStore?.name || 'NexBill'}`,
                                mailNotes: po.emailBody || `Dear ${supp?.contactPerson || po.supplierName},\n\nPlease find attached Purchase Order ${po.poNumber}. Kindly confirm delivery schedule.\n\nThank you.`,
                              });
                            }}
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                            title="Send / Resend PO Email with PDF"
                          >
                            <Mail className="w-3.5 h-3.5 text-blue-400" />
                          </button>

                          {/* 4. Edit Option (Locked if converted to purchase or cancelled) */}
                          {canUpdate && (
                            isConverted ? (
                              <button
                                disabled
                                className="p-1 rounded bg-slate-800/40 text-slate-600 cursor-not-allowed border border-slate-800"
                                title="Locked: Order converted to Purchase Inward. Editing is disabled."
                              >
                                <Lock className="w-3.5 h-3.5 text-slate-500" />
                              </button>
                            ) : po.status === 'CANCELLED' ? (
                              <button
                                disabled
                                className="p-1 rounded bg-slate-800/40 text-slate-600 cursor-not-allowed border border-slate-800"
                                title="Order is Cancelled. Editing is disabled."
                              >
                                <Ban className="w-3.5 h-3.5 text-slate-500" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleOpenEditModal(po)}
                                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-indigo-300 transition"
                                title="Edit Purchase Order"
                              >
                                <Edit className="w-3.5 h-3.5 text-amber-400" />
                              </button>
                            )
                          )}

                          {/* 5. Workflow: Approve */}
                          {canUpdate && po.status === 'DRAFT' && (
                            <button
                              onClick={() => handleApprovePO(po)}
                              className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold flex items-center gap-1 transition"
                              title="Approve Purchase Order"
                            >
                              <CheckCircle2 className="w-3 h-3" /> Approve
                            </button>
                          )}

                          {/* 6. Workflow: Convert to Purchase */}
                          {canUpdate && po.status === 'APPROVED' && (
                            <button
                              onClick={() => handleConvertToPurchase(po)}
                              className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[10px] font-bold flex items-center gap-1 shadow transition"
                              title="Convert to Inward Purchase Bill & Add Stock"
                            >
                              <Truck className="w-3 h-3" /> Inward
                            </button>
                          )}

                          {/* 7. Workflow: Cancel PO (For DRAFT or APPROVED) */}
                          {canUpdate && (po.status === 'DRAFT' || po.status === 'APPROVED') && (
                            <button
                              onClick={() => handleCancelPO(po)}
                              className="p-1 rounded bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 transition"
                              title="Cancel Purchase Order"
                            >
                              <Ban className="w-3.5 h-3.5 text-rose-400" />
                            </button>
                          )}

                          {/* 8. Delete Option (Locked if converted to purchase or not DRAFT) */}
                          {canDelete && (
                            isConverted ? (
                              <button
                                disabled
                                className="p-1 rounded bg-slate-800/40 text-slate-600 cursor-not-allowed border border-slate-800"
                                title="Locked: Order converted to Purchase Inward. Deletion is disabled."
                              >
                                <Lock className="w-3.5 h-3.5 text-slate-500" />
                              </button>
                            ) : po.status === 'DRAFT' ? (
                              <button
                                onClick={() => handleDeletePO(po)}
                                className="p-1 rounded bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 transition"
                                title="Delete PO"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            ) : null
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

      {/* ========================================================================= */}
      {/* 1. CREATE / EDIT PURCHASE ORDER MODAL                                      */}
      {/* ========================================================================= */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl overflow-hidden shadow-2xl space-y-4 my-auto">
            {/* Modal Header */}
            <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-indigo-400" />
                <div>
                  <h4 className="font-bold text-white text-sm">
                    {editingPO ? `Edit Purchase Order (${editingPO.poNumber})` : 'Create New Purchase Order'}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Select supplier, search products, choose stock valuation rates, and prepare PO voucher
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsFormModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitPO} className="p-5 space-y-4 text-xs">
              {/* Top Row: PO Number, Supplier, Dates (Receiving Warehouse removed) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                {/* PO Number with Uniqueness Validation */}
                <div className="space-y-1">
                  <label className="font-semibold text-slate-300 flex items-center justify-between">
                    <span>PO Number *</span>
                    {poNumberError && (
                      <span className="text-[10px] text-rose-400 font-normal">Duplicate / Invalid</span>
                    )}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.poNumber}
                    onChange={(e) => setFormData({ ...formData, poNumber: e.target.value })}
                    className={`w-full bg-slate-900 border rounded-lg px-2.5 py-1.5 font-mono text-slate-100 focus:outline-none ${
                      poNumberError ? 'border-rose-500 focus:border-rose-400' : 'border-slate-700 focus:border-indigo-500'
                    }`}
                  />
                  {poNumberError && (
                    <p className="text-[10px] text-rose-400 leading-tight">{poNumberError}</p>
                  )}
                </div>

                {/* Supplier Selection */}
                <div className="space-y-1">
                  <label className="font-semibold text-slate-300 block">Select Supplier *</label>
                  <select
                    value={formData.supplierId}
                    onChange={(e) => {
                      const supp = db.suppliers.find((s) => s.id === e.target.value);
                      setFormData({
                        ...formData,
                        supplierId: e.target.value,
                        mailTo: supp?.email || formData.mailTo,
                      });
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:border-indigo-500"
                  >
                    <option value="">-- Choose Supplier --</option>
                    {(db.suppliers || []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.city || s.state || 'Local'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Expected Delivery Date */}
                <div className="space-y-1">
                  <label className="font-semibold text-slate-300 block">Expected Delivery Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.expectedDate}
                    onChange={(e) => setFormData({ ...formData, expectedDate: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Supplier Info Card (Contact, GSTIN, Supply Type) */}
              {selectedSupplier && (
                <div className="p-3 bg-indigo-950/20 border border-indigo-900/40 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="space-y-0.5">
                    <div className="font-bold text-indigo-300 flex items-center gap-2">
                      <Building className="w-3.5 h-3.5" />
                      <span>{selectedSupplier.name}</span>
                      <span className="font-mono text-[10px] text-indigo-400 bg-indigo-950 px-1.5 py-0.5 rounded border border-indigo-800">
                        {selectedSupplier.code || selectedSupplier.id}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Contact: {selectedSupplier.contactPerson || 'N/A'} • Phone: {selectedSupplier.phone || 'N/A'} • Email: {selectedSupplier.email || 'N/A'}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <div className="text-[10px] text-slate-400">GSTIN / Tax ID:</div>
                      <div className="font-mono font-bold text-slate-200">{selectedSupplier.gstin || 'Unregistered'}</div>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${
                        currentSupplyType === 'INTERSTATE'
                          ? 'bg-purple-950 text-purple-300 border-purple-800'
                          : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                      }`}
                    >
                      {currentSupplyType === 'INTERSTATE' ? 'IGST (Inter-State)' : 'CGST + SGST (Local Intra-State)'}
                    </span>
                  </div>
                </div>
              )}

              {/* Product Name Search & Barcode Scan Bar with Up/Down Arrow & Exit Support */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <Search className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Search Product or Scan Barcode to Add</span>
                    <span className="text-[10px] text-slate-400 font-normal ml-2">
                      (No stock checking on PO — order any required inward quantity)
                    </span>
                  </label>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {formData.lines.length} Item{formData.lines.length === 1 ? '' : 's'} added
                  </span>
                </div>

                <div ref={searchContainerRef} className="relative">
                  <div className="relative">
                    <Barcode className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Type product name, SKU, or scan barcode... (Use ↑ / ↓ arrows, Enter to select, Esc to exit)"
                      value={productSearchQuery}
                      onChange={(e) => {
                        setProductSearchQuery(e.target.value);
                        setIsSearchDropdownOpen(true);
                      }}
                      onFocus={() => {
                        if (productSearchResults.length > 0) setIsSearchDropdownOpen(true);
                      }}
                      onKeyDown={handleSearchKeyDown}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-9 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />

                    {/* Clear / Exit Button inside input */}
                    {(productSearchQuery || isSearchDropdownOpen) && (
                      <button
                        type="button"
                        onClick={() => {
                          setProductSearchQuery('');
                          setIsSearchDropdownOpen(false);
                          setHighlightedSuggestionIndex(-1);
                          searchInputRef.current?.focus();
                        }}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-white transition"
                        title="Clear & exit suggestion list (Esc)"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Autocomplete Suggestions Dropdown with Keyboard Navigation & Clear Exit */}
                  {isSearchDropdownOpen && productSearchResults.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-64 overflow-y-auto divide-y divide-slate-800">
                      {/* Dropdown helper & exit bar */}
                      <div className="p-2 bg-slate-950/95 border-b border-slate-800 flex items-center justify-between text-[10px] text-slate-400 sticky top-0 z-10 backdrop-blur-sm">
                        <div className="flex items-center gap-1">
                          <span>Navigate with <kbd className="px-1 py-0.2 bg-slate-800 rounded border border-slate-700 text-slate-200">↑</kbd> <kbd className="px-1 py-0.2 bg-slate-800 rounded border border-slate-700 text-slate-200">↓</kbd> • <kbd className="px-1 py-0.2 bg-slate-800 rounded border border-slate-700 text-slate-200">Enter</kbd> to pick</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setIsSearchDropdownOpen(false);
                            setHighlightedSuggestionIndex(-1);
                          }}
                          className="text-slate-400 hover:text-white flex items-center gap-1 font-semibold px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 transition"
                          title="Exit suggestion list"
                        >
                          <span>Exit List (Esc)</span>
                          <X className="w-3 h-3" />
                        </button>
                      </div>

                      {productSearchResults.map((prod, idx) => {
                        const rates = getProductStockRates(prod.id, db);
                        const isHighlighted = idx === highlightedSuggestionIndex;
                        return (
                          <div
                            key={prod.id}
                            ref={(el) => (suggestionItemRefs.current[idx] = el)}
                            onClick={() => handleSelectProduct(prod)}
                            onMouseEnter={() => setHighlightedSuggestionIndex(idx)}
                            className={`p-2.5 cursor-pointer flex items-center justify-between transition ${
                              isHighlighted
                                ? 'bg-indigo-600/30 border-l-4 border-indigo-500 pl-2'
                                : 'hover:bg-slate-800/80 border-l-4 border-transparent'
                            }`}
                          >
                            <div>
                              <div className="font-bold text-white flex items-center gap-2">
                                <span>{prod.name}</span>
                                {isHighlighted && (
                                  <span className="text-[10px] text-indigo-300 font-mono bg-indigo-950/90 px-1.5 py-0.2 rounded border border-indigo-700">
                                    ↵ Press Enter to select
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                                <span>SKU: {prod.sku || 'N/A'}</span>
                                {prod.barcode && <span>Barcode: {prod.barcode}</span>}
                                <span>HSN: {prod.hsnCode || 'N/A'}</span>
                                <span>GST: {prod.taxRate || 5}%</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-mono font-bold text-emerald-400">
                                ₹{Number(prod.costRate || 0).toFixed(2)}
                              </div>
                              <div className="text-[10px] text-indigo-400">
                                {rates.length > 1 ? (
                                  <span className="bg-amber-950 text-amber-300 px-1.5 py-0.5 rounded border border-amber-800">
                                    ★ {rates.length} Rates in Stock
                                  </span>
                                ) : (
                                  <span>1 Standard Rate</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Line Items Grid with Full Tax Details */}
              <div className="border border-slate-800 rounded-xl overflow-hidden shadow-inner bg-slate-950/40">
                <div className="overflow-x-auto max-h-64 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] sticky top-0 z-10 border-b border-slate-800">
                      <tr>
                        <th className="py-2 px-2.5 text-center w-8">#</th>
                        <th className="py-2 px-3">Product Description</th>
                        <th className="py-2 px-2.5 text-center">HSN</th>
                        <th className="py-2 px-2.5 text-center w-20">Qty</th>
                        <th className="py-2 px-2 text-center w-16">UOM</th>
                        <th className="py-2 px-2.5 text-right w-24">Unit Rate (₹)</th>
                        <th className="py-2 px-2.5 text-right">Taxable (₹)</th>
                        <th className="py-2 px-2 text-center">Tax %</th>
                        {currentSupplyType === 'LOCAL' ? (
                          <>
                            <th className="py-2 px-2 text-right">CGST</th>
                            <th className="py-2 px-2 text-right">SGST</th>
                          </>
                        ) : (
                          <th className="py-2 px-2 text-right">IGST</th>
                        )}
                        <th className="py-2 px-3 text-right">Line Total (₹)</th>
                        <th className="py-2 px-2 text-center w-10">Del</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70 font-mono text-[11px]">
                      {formData.lines.length === 0 ? (
                        <tr>
                          <td
                            colSpan={currentSupplyType === 'LOCAL' ? 11 : 10}
                            className="py-8 text-center text-slate-500 font-sans italic"
                          >
                            No products added to this purchase order yet. Use the search bar above to add products.
                          </td>
                        </tr>
                      ) : (
                        orderCalculations.lines.map((line, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/30 transition">
                            <td className="py-2 px-2.5 text-center text-slate-500">{idx + 1}</td>
                            <td className="py-2 px-3">
                              <div className="font-sans font-bold text-white">{line.productName}</div>
                              <div className="text-[10px] text-slate-500 flex items-center gap-1.5 font-sans">
                                <span>{line.rateSource || 'Selected Rate'}</span>
                                {line.barcode && <span>• Barcode: {line.barcode}</span>}
                              </div>
                            </td>
                            <td className="py-2 px-2.5 text-center text-slate-400">{line.hsnCode}</td>
                            <td className="py-2 px-2.5 text-center">
                              <input
                                type="number"
                                min="1"
                                value={line.qty}
                                onChange={(e) => handleLineFieldChange(idx, 'qty', e.target.value)}
                                className="w-16 bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-center text-slate-100 font-mono font-bold focus:border-indigo-500"
                              />
                            </td>
                            <td className="py-2 px-2 text-center text-slate-400 font-sans">{line.uom}</td>
                            <td className="py-2 px-2.5 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={line.rate}
                                  onChange={(e) => handleLineFieldChange(idx, 'rate', e.target.value)}
                                  className="w-20 bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-right text-slate-100 font-mono focus:border-indigo-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const prod = db.products.find((p) => p.id === line.productId);
                                    if (prod) handleSelectProduct(prod, idx);
                                  }}
                                  className="text-[9px] bg-slate-800 hover:bg-slate-700 text-indigo-300 px-1 py-0.5 rounded border border-slate-700 font-sans"
                                  title="Check other stock rates for this item"
                                >
                                  Rates
                                </button>
                              </div>
                            </td>
                            <td className="py-2 px-2.5 text-right font-bold text-slate-200">
                              ₹{line.taxable.toFixed(2)}
                            </td>
                            <td className="py-2 px-2 text-center text-slate-400">{line.taxRate}%</td>
                            {currentSupplyType === 'LOCAL' ? (
                              <>
                                <td className="py-2 px-2 text-right text-slate-400">
                                  ₹{line.cgstAmount.toFixed(2)}
                                </td>
                                <td className="py-2 px-2 text-right text-slate-400">
                                  ₹{line.sgstAmount.toFixed(2)}
                                </td>
                              </>
                            ) : (
                              <td className="py-2 px-2 text-right text-purple-300">
                                ₹{line.igstAmount.toFixed(2)}
                              </td>
                            )}
                            <td className="py-2 px-3 text-right font-bold text-emerald-400">
                              ₹{line.lineTotal.toFixed(2)}
                            </td>
                            <td className="py-2 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveLine(idx)}
                                className="text-slate-500 hover:text-rose-400 p-1"
                                title="Remove Line"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bottom Totals & Calculations Card */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
                {/* Notes & Send Mail Section */}
                <div className="space-y-3">
                  {/* Special Instructions / Internal Delivery Notes */}
                  <div>
                    <label className="font-semibold text-slate-300 block mb-1 text-xs">
                      Special Instructions / Delivery Notes
                    </label>
                    <textarea
                      rows={2}
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Special instructions, gate delivery details, contact on arrival..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100 placeholder-slate-500 focus:border-indigo-500 text-xs"
                    />
                  </div>

                  {/* Terms & Conditions Entry Option */}
                  <div className="space-y-2 p-3 bg-slate-900/90 border border-slate-800 rounded-xl">
                    <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-800 pb-2">
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-indigo-400" />
                        <label className="font-bold text-white text-xs">Terms & Conditions</label>
                        <span className="text-[10px] text-slate-400 font-medium">(Printed on Official PO)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, termsAndConditions: '' })}
                        className="text-[10px] text-rose-400 hover:text-rose-300 flex items-center gap-1 transition cursor-pointer"
                        title="Clear all terms & conditions"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Clear</span>
                      </button>
                    </div>

                    {/* Quick Preset Buttons */}
                    <div className="flex flex-wrap items-center gap-1 pt-0.5">
                      <span className="text-[10px] text-slate-400 font-semibold mr-0.5">Quick Presets:</span>
                      {PO_TERMS_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handleApplyTermPreset(preset)}
                          className="text-[10px] px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded transition cursor-pointer hover:border-indigo-500 hover:text-white"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    <textarea
                      rows={4}
                      value={formData.termsAndConditions}
                      onChange={(e) => setFormData({ ...formData, termsAndConditions: e.target.value })}
                      placeholder="Enter purchase order terms and conditions line by line..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 placeholder-slate-500 focus:border-indigo-500 font-mono text-xs leading-relaxed"
                    />
                    <div className="text-[10px] text-slate-500 flex justify-between items-center">
                      <span>Each line prints as a separate contractual clause on the A4 PO voucher.</span>
                      <span className="font-mono text-indigo-400 font-bold">
                        {formData.termsAndConditions ? formData.termsAndConditions.split('\n').filter(Boolean).length : 0} clauses
                      </span>
                    </div>
                  </div>

                  {/* Send Mail Toggle (Yes / No) */}
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-indigo-400" />
                        <span className="font-bold text-white">Send Mail to Supplier?</span>
                      </div>
                      <div className="flex bg-slate-950 border border-slate-800 rounded-lg p-0.5">
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, sendMail: true })}
                          className={`px-3 py-1 rounded text-xs font-bold transition ${
                            formData.sendMail ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, sendMail: false })}
                          className={`px-3 py-1 rounded text-xs font-bold transition ${
                            !formData.sendMail ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          No
                        </button>
                      </div>
                    </div>

                    {formData.sendMail && (
                      <div className="space-y-2 pt-2 border-t border-slate-800">
                        <div className="space-y-1">
                          <label className="text-[11px] text-slate-400 block">Recipient Email *</label>
                          <input
                            type="email"
                            required={formData.sendMail}
                            value={formData.mailTo}
                            onChange={(e) => setFormData({ ...formData, mailTo: e.target.value })}
                            placeholder="supplier@example.com"
                            className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] text-slate-400 block">Email Subject</label>
                          <input
                            type="text"
                            value={formData.mailSubject}
                            onChange={(e) => setFormData({ ...formData, mailSubject: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100"
                          />
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-950/40 p-2 rounded border border-emerald-800/60 font-mono">
                          <Paperclip className="w-3.5 h-3.5" />
                          <span>Auto-attached: {formData.poNumber || 'PO'}.pdf (Official A4 Purchase Order)</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="space-y-2 font-mono text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span className="font-sans">Total Ordered Qty:</span>
                    <span className="font-bold text-slate-200">{orderCalculations.totalQty} Units</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span className="font-sans">Gross Taxable Subtotal:</span>
                    <span>₹{orderCalculations.subtotal.toFixed(2)}</span>
                  </div>

                  {currentSupplyType === 'LOCAL' ? (
                    <>
                      <div className="flex justify-between text-slate-400">
                        <span className="font-sans">CGST Total:</span>
                        <span>₹{orderCalculations.cgstTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span className="font-sans">SGST Total:</span>
                        <span>₹{orderCalculations.sgstTotal.toFixed(2)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between text-purple-300">
                      <span className="font-sans">IGST Total:</span>
                      <span>₹{orderCalculations.igstTotal.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-slate-400">
                    <span className="font-sans">Total GST / Taxes:</span>
                    <span>₹{orderCalculations.totalTax.toFixed(2)}</span>
                  </div>

                  {orderCalculations.roundOff !== 0 && (
                    <div className="flex justify-between text-slate-400">
                      <span className="font-sans">Round Off:</span>
                      <span>{orderCalculations.roundOff > 0 ? `+₹${orderCalculations.roundOff.toFixed(2)}` : `-₹${Math.abs(orderCalculations.roundOff).toFixed(2)}`}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-2 border-t border-slate-800 text-sm font-bold">
                    <span className="font-sans text-white text-base">Net Grand Total:</span>
                    <span className="text-xl font-bold text-emerald-400">
                      ₹{orderCalculations.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-400 font-sans italic pt-1 border-t border-slate-800/60">
                    <span className="font-semibold text-slate-300">In Words: </span>
                    {orderCalculations.amountInWords}
                  </div>
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={Boolean(poNumberError)}
                  className={`px-5 py-2 rounded-lg font-bold shadow-md transition flex items-center gap-1.5 ${
                    poNumberError
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
                  }`}
                >
                  <FileCheck className="w-4 h-4" />
                  <span>{editingPO ? 'Update Purchase Order' : 'Save Purchase Order'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. MULTIPLE STOCK RATES SELECTION MODAL                                    */}
      {/* ========================================================================= */}
      {rateModal.isOpen && rateModal.product && (
        <div className="fixed inset-0 z-60 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-amber-400" />
                <div>
                  <h4 className="font-bold text-white text-sm">Choose Stock Valuation Rate</h4>
                  <p className="text-[11px] text-slate-400">
                    Product: <span className="text-white font-semibold">{rateModal.product.name}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRateModal({ isOpen: false, product: null, rates: [], targetLineIdx: null, customRate: '' })}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Multiple purchase / valuation rates were found in the stock records for this item. Please select which unit rate to use for this purchase order:
            </p>

            {/* List of distinct rates */}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {rateModal.rates.map((opt, idx) => (
                <div
                  key={idx}
                  onClick={() => handleApplyChosenRate(opt.rate, opt.sources[0])}
                  className="p-3 bg-slate-950 border border-slate-800 hover:border-indigo-500 hover:bg-slate-800/60 rounded-xl cursor-pointer transition flex items-center justify-between"
                >
                  <div className="space-y-0.5">
                    <div className="font-mono text-base font-bold text-emerald-400">
                      ₹{opt.rate.toFixed(2)}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Sources: {opt.sources.join(' • ')}
                    </div>
                    {opt.stockQty > 0 && (
                      <div className="text-[10px] text-slate-500 font-mono">
                        Available Stock at Rate: {opt.stockQty} Units
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow-sm"
                  >
                    Select Rate
                  </button>
                </div>
              ))}
            </div>

            {/* Custom Rate input */}
            <div className="pt-2 border-t border-slate-800 flex items-center gap-2">
              <input
                type="number"
                step="0.01"
                placeholder="Or enter custom rate ₹"
                value={rateModal.customRate}
                onChange={(e) => setRateModal({ ...rateModal, customRate: e.target.value })}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 font-mono"
              />
              <button
                type="button"
                onClick={() => {
                  const val = parseFloat(rateModal.customRate);
                  if (isNaN(val) || val < 0) {
                    notify('error', 'Please enter a valid rate amount.', 'Invalid Rate');
                    return;
                  }
                  handleApplyChosenRate(val, 'Custom Rate');
                }}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold"
              >
                Use Custom
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. VIEW DETAILS MODAL                                                      */}
      {/* ========================================================================= */}
      {viewingPO && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl p-5 space-y-4 my-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-indigo-400" />
                <div>
                  <h4 className="font-bold text-white text-base">Purchase Order: {viewingPO.poNumber}</h4>
                  <p className="text-xs text-slate-400">
                    Status:{' '}
                    <span
                      className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                        viewingPO.status === 'CONVERTED'
                          ? 'bg-blue-950 text-blue-300'
                          : viewingPO.status === 'APPROVED'
                          ? 'bg-emerald-950 text-emerald-300'
                          : 'bg-amber-950 text-amber-300'
                      }`}
                    >
                      {viewingPO.status}
                    </span>
                    {viewingPO.convertedPurchaseDoc && ` • Inward Voucher: ${viewingPO.convertedPurchaseDoc}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setPrintingPO(viewingPO);
                  }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5 text-emerald-400" />
                  <span>A4 Print</span>
                </button>
                <button
                  onClick={() => setViewingPO(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Supplier & Delivery Metadata Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 text-xs">
              <div>
                <div className="text-[10px] text-slate-500 uppercase font-bold">Supplier Details</div>
                <div className="font-bold text-white mt-1">{viewingPO.supplierName}</div>
                <div className="text-slate-400 font-mono text-[11px]">GSTIN: {viewingPO.supplierGstin || 'Unregistered'}</div>
                <div className="text-slate-400 text-[11px]">Supply: {viewingPO.supplyType || 'LOCAL'}</div>
              </div>

              <div>
                <div className="text-[10px] text-slate-500 uppercase font-bold">Dates & Order Info</div>
                <div className="text-slate-300 mt-1">
                  Ordered: {new Date(viewingPO.orderDate || viewingPO.createdAt).toLocaleDateString()}
                </div>
                <div className="text-slate-300">
                  Expected: {viewingPO.expectedDate ? new Date(viewingPO.expectedDate).toLocaleDateString() : 'N/A'}
                </div>
                <div className="text-slate-400 text-[11px]">Store: {activeStore?.name || 'NexBill Store'}</div>
              </div>

              <div>
                <div className="text-[10px] text-slate-500 uppercase font-bold">Email Dispatch Status</div>
                {viewingPO.emailSent ? (
                  <div className="mt-1 space-y-0.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 inline-flex items-center gap-1">
                      <Check className="w-3 h-3" /> Dispatched with PDF
                    </span>
                    <div className="text-[11px] text-slate-400 font-mono truncate">To: {viewingPO.emailSentTo}</div>
                    <div className="text-[10px] text-slate-500">
                      Date: {new Date(viewingPO.emailSentAt || Date.now()).toLocaleString()}
                    </div>
                  </div>
                ) : (
                  <div className="mt-1 text-slate-500 italic">No email dispatched to supplier yet.</div>
                )}
              </div>
            </div>

            {/* Line Items Table */}
            <div className="border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px]">
                  <tr>
                    <th className="py-2 px-3">#</th>
                    <th className="py-2 px-3">Product Name</th>
                    <th className="py-2 px-2 text-center">HSN</th>
                    <th className="py-2 px-2 text-center">Qty</th>
                    <th className="py-2 px-2 text-center">UOM</th>
                    <th className="py-2 px-3 text-right">Rate (₹)</th>
                    <th className="py-2 px-3 text-right">Taxable (₹)</th>
                    <th className="py-2 px-2 text-center">GST %</th>
                    <th className="py-2 px-3 text-right">Tax (₹)</th>
                    <th className="py-2 px-3 text-right">Total (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
                  {viewingPO.lines?.map((line, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30">
                      <td className="py-2 px-3 text-slate-500">{idx + 1}</td>
                      <td className="py-2 px-3 font-sans font-bold text-white">
                        {line.productName || line.name || line.productId}
                      </td>
                      <td className="py-2 px-2 text-center text-slate-400">{line.hsnCode || '—'}</td>
                      <td className="py-2 px-2 text-center text-emerald-400 font-bold">
                        {line.orderedQty || line.qty}
                      </td>
                      <td className="py-2 px-2 text-center text-slate-400 font-sans">{line.uom || 'Pcs'}</td>
                      <td className="py-2 px-3 text-right text-slate-300">₹{Number(line.rate || 0).toFixed(2)}</td>
                      <td className="py-2 px-3 text-right text-slate-300">
                        ₹{(Number(line.orderedQty || line.qty) * Number(line.rate || 0)).toFixed(2)}
                      </td>
                      <td className="py-2 px-2 text-center text-slate-400">{line.taxRate}%</td>
                      <td className="py-2 px-3 text-right text-slate-400">
                        ₹{Number(line.taxAmount || ((Number(line.orderedQty || line.qty) * Number(line.rate || 0) * line.taxRate) / 100)).toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-white">
                        ₹{Number(line.lineTotal || (Number(line.orderedQty || line.qty) * Number(line.rate || 0) * (1 + line.taxRate / 100))).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bottom Total Amount Details */}
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="space-y-0.5">
                <div className="text-slate-400">
                  <span className="font-semibold text-slate-300">Amount in Words: </span>
                  <span className="italic">{viewingPO.amountInWords || numberToWords(viewingPO.totalAmount)}</span>
                </div>
                {viewingPO.notes && (
                  <div className="text-[11px] text-slate-500">
                    <span className="font-semibold text-slate-400">Notes: </span>
                    {viewingPO.notes}
                  </div>
                )}
              </div>

              <div className="text-right font-mono">
                <div className="text-xs text-slate-400">
                  Subtotal: ₹{Number(viewingPO.subtotal || 0).toFixed(2)} • Tax: ₹{Number(viewingPO.totalTax || 0).toFixed(2)}
                </div>
                <div className="text-base font-bold text-emerald-400 mt-0.5">
                  Grand Total: ₹{Number(viewingPO.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* Terms & Conditions in View Modal */}
            {((viewingPO.termsAndConditions !== undefined ? viewingPO.termsAndConditions : DEFAULT_PO_TERMS) || '').trim() && (
              <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 space-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-slate-300 text-[11px] uppercase tracking-wider">
                  <FileText className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Terms & Conditions:</span>
                </div>
                <div className="space-y-0.5 text-slate-400 text-[11px] pl-5">
                  {((viewingPO.termsAndConditions !== undefined ? viewingPO.termsAndConditions : DEFAULT_PO_TERMS) || '')
                    .split('\n')
                    .map((t) => t.trim())
                    .filter(Boolean)
                    .map((term, tIdx) => (
                      <div key={tIdx} className="leading-tight">
                        {/^\d+[\.\)]/.test(term) || term.startsWith('•') || term.startsWith('-')
                          ? term
                          : `${tIdx + 1}. ${term}`}
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <div className="flex items-center gap-2">
                {viewingPO.status === 'CONVERTED' ? (
                  <span className="text-[11px] text-slate-500 flex items-center gap-1 font-semibold">
                    <Lock className="w-3.5 h-3.5 text-blue-400" />
                    Locked: Order inwarded as purchase invoice.
                  </span>
                ) : (
                  canUpdate && (
                    <button
                      onClick={() => {
                        const target = viewingPO;
                        setViewingPO(null);
                        handleOpenEditModal(target);
                      }}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Edit className="w-3.5 h-3.5 text-amber-400" />
                      <span>Edit PO Details</span>
                    </button>
                  )
                )}
              </div>

              <button
                onClick={() => setViewingPO(null)}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. STANDALONE SEND / RESEND EMAIL MODAL                                    */}
      {/* ========================================================================= */}
      {emailingPO && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-indigo-400" />
                <div>
                  <h4 className="font-bold text-white text-sm">Send PO Email to Supplier</h4>
                  <p className="text-[11px] text-slate-400">Order #{emailingPO.poNumber}</p>
                </div>
              </div>
              <button onClick={() => setEmailingPO(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendStandaloneEmail} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Supplier Email Address *</label>
                <input
                  type="email"
                  required
                  value={emailingPO.mailTo}
                  onChange={(e) => setEmailingPO({ ...emailingPO, mailTo: e.target.value })}
                  placeholder="orders@supplier.com"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Subject</label>
                <input
                  type="text"
                  required
                  value={emailingPO.mailSubject}
                  onChange={(e) => setEmailingPO({ ...emailingPO, mailSubject: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300 block">Cover Message / Body</label>
                <textarea
                  rows={4}
                  value={emailingPO.mailNotes}
                  onChange={(e) => setEmailingPO({ ...emailingPO, mailNotes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100 focus:border-indigo-500 font-sans"
                />
              </div>

              <div className="flex items-center gap-2 p-2.5 bg-indigo-950/40 rounded-xl border border-indigo-800 text-[11px] text-indigo-300 font-mono">
                <Paperclip className="w-4 h-4 text-indigo-400" />
                <span>PDF Attached: {emailingPO.poNumber}.pdf (Official Printable A4 Voucher)</span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEmailingPO(null)}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/30"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Email Dispatch</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. A4 PURCHASE ORDER PRINT PREVIEW MODAL                                    */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* 5. A4 PURCHASE ORDER PRINT PREVIEW MODAL                                    */}
      {/* ========================================================================= */}
      {printingPO && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 overflow-y-auto print:p-0 print:bg-white print:static print-modal-overlay">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl space-y-4 my-auto print:border-none print:shadow-none print:max-w-none print:w-full print-modal-card">
            {/* Modal Controls (Hidden in Print) */}
            <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950 print:hidden text-xs">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-white">A4 Purchase Order Print Preview: {printingPO.poNumber}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Document (A4)</span>
                </button>
                <button
                  onClick={() => setPrintingPO(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Standard A4 Printable Purchase Order Sheet */}
            <div className="p-4 max-h-[80vh] overflow-y-auto flex justify-center print:p-0 print:max-h-none print:overflow-visible">
              <div
                data-printable-sheet="true"
                className="printable-po-document bg-white text-[#0f172a] p-8 rounded-lg shadow-lg font-sans text-xs w-[750px] space-y-5 print:shadow-none print:w-full print:p-6 print:rounded-none"
              >
                {/* Company & Document Header */}
                <div className="flex justify-between items-start border-b-2 border-[#0f172a] pb-4">
                  <div>
                    <h2 className="text-2xl font-black text-[#0f172a] tracking-tight uppercase">
                      {activeStore?.name || 'NEXBILL RETAIL'}
                    </h2>
                    <p className="text-[#475569] text-[11px] max-w-sm mt-0.5">{activeStore?.address || 'Mumbai, Maharashtra'}</p>
                    <p className="text-[#1e293b] font-bold text-[11px] mt-1">GSTIN: {activeStore?.gstin || '27AAAAA0000A1Z5'}</p>
                    <p className="text-[#475569] text-[11px]">Phone: {activeStore?.phone || '+91 98200 12345'} • Email: procurement@nexbill.in</p>
                  </div>

                  <div className="text-right space-y-1">
                    <span className="px-3 py-1 bg-[#0f172a] text-white font-black text-sm tracking-wider uppercase rounded inline-block shadow-sm">
                      PURCHASE ORDER
                    </span>
                    <div className="text-sm font-black font-mono text-[#0f172a]">{printingPO.poNumber}</div>
                    <div className="text-[11px] text-[#475569]">
                      Date: {new Date(printingPO.orderDate || printingPO.createdAt || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                    <div className="text-[11px] text-[#475569]">
                      Expected By: {printingPO.expectedDate ? new Date(printingPO.expectedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Immediate'}
                    </div>
                    <div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold border border-[#94a3b8] bg-[#f1f5f9] text-[#1e293b] uppercase">
                        Status: {printingPO.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Vendor & Delivery Information */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 border border-[#cbd5e1] rounded bg-[#f8fafc] space-y-1">
                    <div className="font-bold text-[11px] uppercase tracking-wider text-[#334155] border-b border-[#e2e8f0] pb-1">
                      Vendor / Supplier Information:
                    </div>
                    <div className="font-bold text-sm text-[#0f172a]">{printingPO.supplierName}</div>
                    <div className="text-[#334155] text-[11px]">GSTIN: {printingPO.supplierGstin || 'Unregistered'}</div>
                    <div className="text-[#334155] text-[11px]">State: {printingPO.supplierState || 'Maharashtra'} ({printingPO.supplierStateCode || '27'})</div>
                    <div className="text-[#334155] text-[11px]">Place of Supply: {printingPO.supplyType === 'INTERSTATE' ? 'Inter-State (IGST)' : 'Intra-State (CGST + SGST)'}</div>
                  </div>

                  <div className="p-3 border border-[#cbd5e1] rounded bg-[#f8fafc] space-y-1">
                    <div className="font-bold text-[11px] uppercase tracking-wider text-[#334155] border-b border-[#e2e8f0] pb-1">
                      Deliver Goods To:
                    </div>
                    <div className="font-bold text-sm text-[#0f172a]">{activeStore?.name || 'NexBill Central'}</div>
                    <div className="text-[#334155] text-[11px]">{activeStore?.address || 'Mumbai City'}</div>
                    <div className="text-[#334155] text-[11px]">GSTIN: {activeStore?.gstin || '27AAAAA0000A1Z5'}</div>
                    <div className="text-[#334155] text-[11px]">Attention: Inward / Receiving Department</div>
                  </div>
                </div>

                {/* Items Table with Full Tax Details */}
                <div className="border border-[#cbd5e1] rounded overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#f1f5f9] border-b border-[#cbd5e1] text-[10px] font-bold uppercase text-[#334155]">
                      <tr>
                        <th className="p-2 border-r border-[#cbd5e1] text-center w-8">#</th>
                        <th className="p-2 border-r border-[#cbd5e1]">Item Description</th>
                        <th className="p-2 border-r border-[#cbd5e1] text-center">HSN</th>
                        <th className="p-2 border-r border-[#cbd5e1] text-center">Qty</th>
                        <th className="p-2 border-r border-[#cbd5e1] text-center">UOM</th>
                        <th className="p-2 border-r border-[#cbd5e1] text-right">Rate (₹)</th>
                        <th className="p-2 border-r border-[#cbd5e1] text-right">Taxable (₹)</th>
                        <th className="p-2 border-r border-[#cbd5e1] text-center">GST %</th>
                        <th className="p-2 border-r border-[#cbd5e1] text-right">Tax Amt (₹)</th>
                        <th className="p-2 text-right">Line Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e2e8f0] font-mono text-[11px]">
                      {printingPO.lines?.map((line, idx) => {
                        const qty = Number(line.orderedQty || line.qty || 0);
                        const rate = Number(line.rate || 0);
                        const taxRate = Number(line.taxRate || 0);
                        const taxable = Number(line.taxableAmount || qty * rate);
                        const taxAmt = Number(line.taxAmount || (taxable * taxRate) / 100);
                        const total = Number(line.lineTotal || taxable + taxAmt);
                        return (
                          <tr key={idx} className="bg-white hover:bg-[#f8fafc]">
                            <td className="p-2 border-r border-[#e2e8f0] text-center text-[#64748b] font-sans">{idx + 1}</td>
                            <td className="p-2 border-r border-[#e2e8f0] font-sans font-bold text-[#0f172a]">
                              {line.productName || line.name || line.productId}
                            </td>
                            <td className="p-2 border-r border-[#e2e8f0] text-center text-[#475569]">{line.hsnCode || '—'}</td>
                            <td className="p-2 border-r border-[#e2e8f0] text-center font-bold text-[#0f172a]">{qty}</td>
                            <td className="p-2 border-r border-[#e2e8f0] text-center font-sans text-[#475569]">{line.uom || 'Pcs'}</td>
                            <td className="p-2 border-r border-[#e2e8f0] text-right text-[#0f172a]">₹{rate.toFixed(2)}</td>
                            <td className="p-2 border-r border-[#e2e8f0] text-right font-medium text-[#0f172a]">₹{taxable.toFixed(2)}</td>
                            <td className="p-2 border-r border-[#e2e8f0] text-center text-[#0f172a]">{taxRate}%</td>
                            <td className="p-2 border-r border-[#e2e8f0] text-right text-[#334155]">₹{taxAmt.toFixed(2)}</td>
                            <td className="p-2 text-right font-bold text-[#0f172a]">₹{total.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Bottom Total Amount Details Grid */}
                <div className="grid grid-cols-2 gap-4 items-start pt-2">
                  <div className="space-y-2">
                    <div className="p-3 border border-[#e2e8f0] rounded bg-[#f8fafc] space-y-1">
                      <div className="font-bold text-[11px] uppercase tracking-wider text-[#334155]">
                        Amount in Words:
                      </div>
                      <div className="font-bold text-[#0f172a] text-xs italic">
                        {printingPO.amountInWords || numberToWords(printingPO.totalAmount)}
                      </div>
                    </div>

                    {printingPO.notes && (
                      <div className="text-[11px] text-[#475569]">
                        <span className="font-bold text-[#1e293b]">Special Instructions: </span>
                        {printingPO.notes}
                      </div>
                    )}

                    {((printingPO.termsAndConditions !== undefined ? printingPO.termsAndConditions : DEFAULT_PO_TERMS) || '').trim() && (
                      <div className="text-[10px] text-[#64748b] space-y-0.5 pt-2">
                        <div className="font-bold uppercase text-[#334155]">Terms & Conditions:</div>
                        {((printingPO.termsAndConditions !== undefined ? printingPO.termsAndConditions : DEFAULT_PO_TERMS) || '')
                          .split('\n')
                          .map((t) => t.trim())
                          .filter(Boolean)
                          .map((term, tIdx) => (
                            <div key={tIdx} className="leading-tight">
                              {/^\d+[\.\)]/.test(term) || term.startsWith('•') || term.startsWith('-')
                                ? term
                                : `${tIdx + 1}. ${term}`}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* Summary Box */}
                  <div className="border border-[#cbd5e1] rounded p-3 bg-[#f8fafc] space-y-1.5 font-mono text-xs">
                    <div className="flex justify-between text-[#334155]">
                      <span className="font-sans">Gross Taxable Subtotal:</span>
                      <span>₹{Number(printingPO.subtotal || 0).toFixed(2)}</span>
                    </div>

                    {printingPO.supplyType === 'INTERSTATE' ? (
                      <div className="flex justify-between text-[#334155]">
                        <span className="font-sans">IGST Total:</span>
                        <span>₹{Number(printingPO.igstTotal || printingPO.totalTax || 0).toFixed(2)}</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between text-[#334155]">
                          <span className="font-sans">CGST Total:</span>
                          <span>₹{Number(printingPO.cgstTotal || (printingPO.totalTax || 0) / 2).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-[#334155]">
                          <span className="font-sans">SGST Total:</span>
                          <span>₹{Number(printingPO.sgstTotal || (printingPO.totalTax || 0) / 2).toFixed(2)}</span>
                        </div>
                      </>
                    )}

                    <div className="flex justify-between text-[#334155]">
                      <span className="font-sans">Total Tax Amount:</span>
                      <span>₹{Number(printingPO.totalTax || 0).toFixed(2)}</span>
                    </div>

                    {Number(printingPO.roundOff || 0) !== 0 && (
                      <div className="flex justify-between text-[#334155]">
                        <span className="font-sans">Round Off:</span>
                        <span>₹{Number(printingPO.roundOff).toFixed(2)}</span>
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-2 border-t-2 border-[#0f172a] text-sm font-black">
                      <span className="font-sans text-[#0f172a] uppercase">Grand Total (INR):</span>
                      <span className="text-base text-[#0f172a] font-bold">
                        ₹{Number(printingPO.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Signatory Footer */}
                <div className="pt-8 flex justify-between items-end border-t border-[#cbd5e1]">
                  <div className="text-[10px] text-[#64748b]">
                    <div>Generated automatically by NexBill ERP Platform.</div>
                    <div>Prepared by: User ID #{printingPO.createdBy || currentUser.id}</div>
                  </div>

                  <div className="text-center space-y-10">
                    <div className="font-bold text-[#0f172a] text-xs">For {activeStore?.name || 'NexBill Retail'}</div>
                    <div className="border-t border-[#94a3b8] pt-1 text-[11px] text-[#475569] font-semibold px-4">
                      Authorized Signatory & Seal
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
