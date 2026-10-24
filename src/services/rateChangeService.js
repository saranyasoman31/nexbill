// RateChangeService: Rate Change Proposals, MRP Validation, Historical Invoice Immunity, and Approval
import { getDatabase, saveDatabase, logAuditEvent } from './storageService.js';

export const RateChangeService = {
  /**
   * Propose Rate Change
   */
  proposeRateChange({ productId, newSellingRate, reason, effectiveDate, userRole, userId = 'USR-02' }) {
    const db = getDatabase();
    const product = db.products.find(p => p.id === productId);
    if (!product) throw new Error('RATE_CHANGE_ERROR: Product not found.');

    const newRate = Number(newSellingRate);
    if (newRate <= 0) throw new Error('RATE_CHANGE_ERROR: Rate must be greater than zero.');

    // Business Policy: Selling rate cannot exceed MRP!
    if (newRate > product.mrp) {
      throw new Error(`MRP_VIOLATION_ERROR: Proposed selling rate (₹${newRate}) exceeds product MRP (₹${product.mrp}). Statutory policy prohibits selling above MRP.`);
    }

    const count = db.rateChanges.length + 1;
    const docNumber = `RC-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;
    const nowIso = new Date().toISOString();

    const isAutoApproved = userRole === 'STORE_MANAGER' || userRole === 'COMPANY_ADMIN';

    const proposal = {
      id: `RC-${Date.now()}`,
      docNumber,
      productId,
      productName: product.name,
      sku: product.sku,
      oldRate: product.sellingRate,
      newRate,
      mrp: product.mrp,
      reason: reason || 'Market price update',
      effectiveDate: effectiveDate || nowIso,
      status: isAutoApproved ? 'APPROVED' : 'PENDING_APPROVAL',
      createdBy: userId,
      createdAt: nowIso,
      approvedBy: isAutoApproved ? userId : null,
      approvedAt: isAutoApproved ? nowIso : null,
    };

    if (isAutoApproved) {
      product.sellingRate = newRate;
    }

    db.rateChanges.unshift(proposal);
    saveDatabase(db);

    logAuditEvent(
      isAutoApproved ? 'RATE_CHANGED' : 'RATE_CHANGE_PENDING',
      userId,
      `Rate change ${docNumber} for ${product.name}: ₹${proposal.oldRate} -> ₹${newRate}. Status: ${proposal.status}`
    );

    return proposal;
  },

  /**
   * Approve Rate Change
   */
  approveRateChange(changeId, approverUserId = 'USR-04') {
    const db = getDatabase();
    const proposal = db.rateChanges.find(rc => rc.id === changeId);
    if (!proposal) throw new Error('RATE_CHANGE_ERROR: Proposal not found.');
    if (proposal.status !== 'PENDING_APPROVAL') {
      throw new Error(`RATE_CHANGE_ERROR: Proposal is already ${proposal.status}.`);
    }

    const product = db.products.find(p => p.id === proposal.productId);
    if (!product) throw new Error('RATE_CHANGE_ERROR: Product no longer exists.');

    proposal.status = 'APPROVED';
    proposal.approvedBy = approverUserId;
    proposal.approvedAt = new Date().toISOString();

    // Update active selling rate
    product.sellingRate = proposal.newRate;

    saveDatabase(db);
    logAuditEvent('RATE_CHANGE_APPROVED', approverUserId, `Rate change ${proposal.docNumber} approved: ${product.name} is now ₹${proposal.newRate}`);
    return proposal;
  }
};
