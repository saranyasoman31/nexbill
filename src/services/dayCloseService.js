// DayCloseService: Register Shift Management, Cash Reconciliation, and Closed Period Protection
import { getDatabase, saveDatabase, logAuditEvent } from './storageService.js';

export const DayCloseService = {
  /**
   * Get Active Register Session for a store
   */
  getActiveSession(storeId) {
    const db = getDatabase();
    return db.registerSessions.find(s => s.storeId === storeId && s.status === 'OPEN') || null;
  },

  /**
   * Open Register Session
   */
  openSession({ storeId, warehouseId, openingCash, userId = 'USR-01' }) {
    const db = getDatabase();
    const existing = this.getActiveSession(storeId);
    if (existing) {
      throw new Error(`REGISTER_ERROR: A register session (${existing.id}) is already open for this store.`);
    }

    const count = db.registerSessions.length + 1;
    const sessionId = `REG-${storeId}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(count).padStart(2, '0')}`;
    const nowIso = new Date().toISOString();

    const session = {
      id: sessionId,
      storeId,
      warehouseId,
      openedByUserId: userId,
      openedAt: nowIso,
      openingCash: Number(openingCash || 0),
      closedAt: null,
      closedByUserId: null,
      status: 'OPEN',
      countedCash: 0,
      cashVariance: 0,
      notes: 'Shift opened',
    };

    // Update store state
    const store = db.stores.find(s => s.id === storeId);
    if (store) store.isDayOpen = true;

    db.registerSessions.unshift(session);
    saveDatabase(db);
    logAuditEvent('REGISTER_OPENED', userId, `Register session ${sessionId} opened with ₹${openingCash} opening cash.`);
    return session;
  },

  /**
   * Calculate live Day / Shift Totals for an open session
   */
  getSessionSummary(sessionId) {
    const db = getDatabase();
    const session = db.registerSessions.find(s => s.id === sessionId);
    if (!session) return null;

    const sessionStart = new Date(session.openedAt);
    const sessionEnd = session.closedAt ? new Date(session.closedAt) : new Date();

    // Invoices during this session
    const invoices = db.invoices.filter(inv => {
      if (inv.storeId !== session.storeId || inv.status !== 'POSTED') return false;
      const invDate = new Date(inv.date);
      return invDate >= sessionStart && invDate <= sessionEnd;
    });

    // Returns during this session
    const returns = db.salesReturns.filter(ret => {
      if (ret.storeId !== session.storeId || ret.status !== 'POSTED') return false;
      const retDate = new Date(ret.date);
      return retDate >= sessionStart && retDate <= sessionEnd;
    });

    let totalSalesGross = 0;
    let cashSales = 0;
    let cardSales = 0;
    let upiSales = 0;
    let creditSales = 0;
    let totalDiscount = 0;
    let totalTaxCollected = 0;

    for (const inv of invoices) {
      totalSalesGross += inv.netPayable;
      totalDiscount += (inv.lineDiscountTotal || 0) + (inv.couponDiscount || 0) + (inv.pointsDiscountAmount || 0);
      totalTaxCollected += inv.totalTax || 0;

      for (const t of inv.tenders || []) {
        const amt = Number(t.amount || 0);
        if (t.method === 'CASH') cashSales += amt;
        else if (t.method === 'CARD') cardSales += amt;
        else if (t.method === 'UPI') upiSales += amt;
        else if (t.method === 'CREDIT') creditSales += amt;
      }
    }

    let cashRefunds = 0;
    let totalRefunds = 0;
    for (const ret of returns) {
      totalRefunds += ret.totalRefundAmount;
      if (ret.refundMethod === 'CASH') cashRefunds += ret.totalRefundAmount;
    }

    const expectedCashInDrawer = session.openingCash + cashSales - cashRefunds;

    return {
      session,
      invoiceCount: invoices.length,
      returnCount: returns.length,
      totalSalesGross: Number(totalSalesGross.toFixed(2)),
      totalRefunds: Number(totalRefunds.toFixed(2)),
      totalTaxCollected: Number(totalTaxCollected.toFixed(2)),
      totalDiscount: Number(totalDiscount.toFixed(2)),
      openingCash: session.openingCash,
      cashSales: Number(cashSales.toFixed(2)),
      cardSales: Number(cardSales.toFixed(2)),
      upiSales: Number(upiSales.toFixed(2)),
      creditSales: Number(creditSales.toFixed(2)),
      cashRefunds: Number(cashRefunds.toFixed(2)),
      expectedCashInDrawer: Number(expectedCashInDrawer.toFixed(2)),
    };
  },

  /**
   * Close Register Session & Day Close
   */
  closeSession({ sessionId, countedCash, notes, userId = 'USR-04' }) {
    const db = getDatabase();
    const session = db.registerSessions.find(s => s.id === sessionId);
    if (!session) throw new Error('REGISTER_ERROR: Session not found.');
    if (session.status === 'CLOSED') throw new Error('REGISTER_ERROR: Session is already closed.');

    const summary = this.getSessionSummary(sessionId);
    const counted = Number(countedCash || 0);
    const variance = counted - summary.expectedCashInDrawer;

    const nowIso = new Date().toISOString();
    session.status = 'CLOSED';
    session.closedAt = nowIso;
    session.closedByUserId = userId;
    session.countedCash = counted;
    session.cashVariance = Number(variance.toFixed(2));
    session.expectedCash = summary.expectedCashInDrawer;
    session.notes = notes || `Z-Report finalized with variance ₹${session.cashVariance}`;

    // Mark store day as closed
    const store = db.stores.find(s => s.id === session.storeId);
    if (store) store.isDayOpen = false;

    saveDatabase(db);
    logAuditEvent('REGISTER_CLOSED', userId, `Register ${sessionId} closed. Expected: ₹${summary.expectedCashInDrawer}, Counted: ₹${counted}, Variance: ₹${session.cashVariance}`);

    return {
      session,
      summary,
      variance: session.cashVariance,
      message: `Day close finalized. ${variance === 0 ? 'Cash matched perfectly.' : 'Cash variance: ₹' + variance.toFixed(2)}`,
    };
  },

  /**
   * Reopen Closed Session (Requires Store Manager or Admin)
   */
  reopenSession({ sessionId, reason, userRole, userId = 'USR-04' }) {
    if (userRole !== 'STORE_MANAGER' && userRole !== 'COMPANY_ADMIN') {
      throw new Error('PERMISSION_DENIED: Only Store Managers or Company Admins can reopen a closed register period.');
    }
    if (!reason || !reason.trim()) {
      throw new Error('VALIDATION_ERROR: A valid statutory justification reason is required to reopen a closed period.');
    }

    const db = getDatabase();
    const session = db.registerSessions.find(s => s.id === sessionId);
    if (!session) throw new Error('REGISTER_ERROR: Session not found.');

    session.status = 'OPEN';
    session.reopenedAt = new Date().toISOString();
    session.reopenedByUserId = userId;
    session.reopenReason = reason;

    const store = db.stores.find(s => s.id === session.storeId);
    if (store) store.isDayOpen = true;

    saveDatabase(db);
    logAuditEvent('REGISTER_REOPENED', userId, `Period reopened for session ${sessionId}. Reason: ${reason}`);
    return session;
  }
};
