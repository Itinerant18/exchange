import { useEffect, useState, useCallback } from 'react';
import { apiRequest } from '../../../services/apiClient.js';
import { formatPaiseToRupees, formatDate } from '../../../utils/formatters.js';
import styles from './AdminPage.module.css';

export function AdminPage() {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'users' | 'bookings' | 'payments' | 'deposits' | 'extensions' | 'disputes' | 'kyc' | 'categories' | 'settings' | 'audit'

  // Data states
  const [reconciliation, setReconciliation] = useState(null);
  const [users, setUsers] = useState([]);
  const [userTotal, setUserTotal] = useState(0);
  const [bookings, setBookings] = useState([]);
  const [bookingTotal, setBookingTotal] = useState(0);
  const [payments, setPayments] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [extensions, setExtensions] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [kycQueue, setKycQueue] = useState([]);
  const [categories, setCategories] = useState([]);
  const [settings, setSettings] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  // Filters & Search
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('');
  const [bookingStatusFilter, setBookingStatusFilter] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('');
  const [depositStatusFilter, setDepositStatusFilter] = useState('');

  // Status & feedback
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  // Modals & Action States
  const [roleModalUser, setRoleModalUser] = useState(null); // user object
  const [selectedRoles, setSelectedRoles] = useState([]);

  const [resolvingDispute, setResolvingDispute] = useState(null);
  const [resolutionText, setResolutionText] = useState('');
  const [resolutionStatus, setResolutionStatus] = useState('resolved');

  const [deductModalDeposit, setDeductModalDeposit] = useState(null);
  const [deductAmountRupees, setDeductAmountRupees] = useState('');
  const [deductReason, setDeductReason] = useState('');

  const [extensionModal, setExtensionModal] = useState(null);
  const [extensionDecision, setExtensionDecision] = useState('approve');
  const [extensionReason, setExtensionReason] = useState('');

  const [createCategoryModal, setCreateCategoryModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatSlug, setNewCatSlug] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');

  // ---------------------------------------------------------------------------
  // Data Loaders
  // ---------------------------------------------------------------------------
  const loadReconciliation = useCallback(async () => {
    try {
      const res = await apiRequest('/admin/reports/reconciliation');
      setReconciliation(res?.data ?? res);
    } catch {
      // Non-fatal
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (userSearch.trim()) params.set('q', userSearch.trim());
      if (userRoleFilter) params.set('role', userRoleFilter);
      if (userStatusFilter) params.set('status', userStatusFilter);
      const res = await apiRequest(`/admin/users?${params.toString()}`);
      setUsers(Array.isArray(res) ? res : (res?.data ?? []));
      setUserTotal(res?.meta?.total ?? (Array.isArray(res) ? res.length : (res?.data?.length ?? 0)));
    } catch (e) {
      setErr(e.message);
    }
  }, [userSearch, userRoleFilter, userStatusFilter]);

  const loadBookings = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (bookingStatusFilter) params.set('status', bookingStatusFilter);
      const res = await apiRequest(`/admin/bookings?${params.toString()}`);
      setBookings(Array.isArray(res) ? res : (res?.data ?? []));
      setBookingTotal(res?.meta?.total ?? (Array.isArray(res) ? res.length : (res?.data?.length ?? 0)));
    } catch (e) {
      setErr(e.message);
    }
  }, [bookingStatusFilter]);

  const loadPayments = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (paymentStatusFilter) params.set('status', paymentStatusFilter);
      const res = await apiRequest(`/admin/payments?${params.toString()}`);
      setPayments(Array.isArray(res) ? res : (res?.data ?? []));
    } catch (e) {
      setErr(e.message);
    }
  }, [paymentStatusFilter]);

  const loadDeposits = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (depositStatusFilter) params.set('status', depositStatusFilter);
      const res = await apiRequest(`/admin/deposits?${params.toString()}`);
      setDeposits(Array.isArray(res) ? res : (res?.data ?? []));
    } catch (e) {
      setErr(e.message);
    }
  }, [depositStatusFilter]);

  const loadExtensions = useCallback(async () => {
    try {
      const res = await apiRequest('/admin/extensions');
      setExtensions(Array.isArray(res) ? res : (res?.data ?? []));
    } catch (e) {
      setErr(e.message);
    }
  }, []);

  const loadDisputes = useCallback(async () => {
    try {
      const res = await apiRequest('/admin/disputes');
      setDisputes(Array.isArray(res) ? res : (res?.data ?? []));
    } catch (e) {
      setErr(e.message);
    }
  }, []);

  const loadKycQueue = useCallback(async () => {
    try {
      const res = await apiRequest('/admin/kyc');
      setKycQueue(Array.isArray(res) ? res : (res?.data ?? []));
    } catch (e) {
      setErr(e.message);
    }
  }, []);

  const loadCategories = useCallback(async () => {
    try {
      const res = await apiRequest('/admin/categories');
      setCategories(Array.isArray(res) ? res : (res?.data ?? []));
    } catch (e) {
      setErr(e.message);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const res = await apiRequest('/admin/settings');
      setSettings(Array.isArray(res) ? res : (res?.data ?? []));
    } catch (e) {
      setErr(e.message);
    }
  }, []);

  const loadAuditLogs = useCallback(async () => {
    try {
      const res = await apiRequest('/admin/audit-logs');
      setAuditLogs(Array.isArray(res) ? res : (res?.data ?? []));
    } catch (e) {
      setErr(e.message);
    }
  }, []);

  // Initial load
  useEffect(() => {
    setLoading(true);
    setErr('');
    Promise.all([
      loadReconciliation(),
      loadUsers(),
      loadDisputes(),
      loadKycQueue(),
      loadSettings(),
      loadAuditLogs(),
    ]).finally(() => setLoading(false));
  }, []);

  // Tab switch trigger
  useEffect(() => {
    if (activeTab === 'bookings') loadBookings();
    if (activeTab === 'payments') loadPayments();
    if (activeTab === 'deposits') loadDeposits();
    if (activeTab === 'extensions') loadExtensions();
    if (activeTab === 'categories') loadCategories();
    if (activeTab === 'users') loadUsers();
    if (activeTab === 'overview') loadReconciliation();
  }, [activeTab]);

  // ---------------------------------------------------------------------------
  // Action Handlers
  // ---------------------------------------------------------------------------
  async function handleOpenRoleModal(u) {
    setRoleModalUser(u);
    setSelectedRoles([...(u.roles || [])]);
  }

  function handleToggleRole(role) {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  }

  async function handleSaveRoles() {
    if (!roleModalUser) return;
    setErr('');
    setMsg('');
    try {
      await apiRequest(`/admin/users/${roleModalUser.id}/roles`, {
        method: 'PATCH',
        body: { roles: selectedRoles },
      });
      setMsg(`Roles updated for ${roleModalUser.email}: [${selectedRoles.join(', ')}]`);
      setRoleModalUser(null);
      loadUsers();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function handleToggleUserStatus(u) {
    const nextStatus = u.status === 'active' ? 'suspended' : 'active';
    const confirmText = nextStatus === 'suspended'
      ? `Suspend account for ${u.email}? They will be immediately signed out.`
      : `Re-activate account for ${u.email}?`;
    if (!window.confirm(confirmText)) return;
    setErr('');
    setMsg('');
    try {
      await apiRequest(`/admin/users/${u.id}/status`, {
        method: 'PATCH',
        body: { status: nextStatus },
      });
      setMsg(`User ${u.email} is now ${nextStatus}.`);
      loadUsers();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function handleSettlePayment(paymentId) {
    const txnId = window.prompt('Enter provider settlement transaction reference / ID:', `TXN-OFFLINE-${Date.now().toString(36).toUpperCase()}`);
    if (!txnId) return;
    setErr('');
    setMsg('');
    try {
      await apiRequest(`/admin/payments/${paymentId}/settle`, {
        method: 'POST',
        body: { providerTransactionId: txnId.trim() },
      });
      setMsg(`Payment #${paymentId.slice(0, 8)} settled successfully.`);
      loadPayments();
      loadReconciliation();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function handleFailPayment(paymentId) {
    if (!window.confirm('Mark this payment attempt as failed?')) return;
    setErr('');
    setMsg('');
    try {
      await apiRequest(`/admin/payments/${paymentId}/fail`, { method: 'POST' });
      setMsg(`Payment #${paymentId.slice(0, 8)} marked as failed.`);
      loadPayments();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function handleReleaseDeposit(depositId) {
    if (!window.confirm('Release this full security deposit back to the renter?')) return;
    setErr('');
    setMsg('');
    try {
      await apiRequest(`/admin/deposits/${depositId}/release`, { method: 'POST' });
      setMsg(`Security deposit #${depositId.slice(0, 8)} released.`);
      loadDeposits();
      loadReconciliation();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function handleConfirmDeductDeposit(e) {
    e.preventDefault();
    if (!deductModalDeposit) return;
    const rupees = parseFloat(deductAmountRupees);
    if (isNaN(rupees) || rupees <= 0) {
      setErr('Enter a valid deduction amount greater than ₹0.');
      return;
    }
    const paise = Math.round(rupees * 100);
    if (paise > deductModalDeposit.collectedAmountPaise) {
      setErr(`Deduction cannot exceed collected deposit of ${formatPaiseToRupees(deductModalDeposit.collectedAmountPaise)}.`);
      return;
    }
    if (!deductReason.trim()) {
      setErr('Please specify a reason for deducting the security deposit.');
      return;
    }

    setErr('');
    setMsg('');
    try {
      await apiRequest(`/admin/deposits/${deductModalDeposit.id}/deduct`, {
        method: 'POST',
        body: { amountPaise: paise, reason: deductReason.trim() },
      });
      setMsg(`Deducted ${formatPaiseToRupees(paise)} from deposit #${deductModalDeposit.id.slice(0, 8)}.`);
      setDeductModalDeposit(null);
      setDeductAmountRupees('');
      setDeductReason('');
      loadDeposits();
      loadReconciliation();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function handleConfirmExtensionDecision(e) {
    e.preventDefault();
    if (!extensionModal) return;
    setErr('');
    setMsg('');
    try {
      await apiRequest(`/admin/extensions/${extensionModal.id}/decision`, {
        method: 'PATCH',
        body: {
          decision: extensionDecision,
          rejectionReason: extensionDecision === 'reject' ? (extensionReason.trim() || 'Extension declined by concierge') : undefined,
        },
      });
      setMsg(`Extension #${extensionModal.id.slice(0, 8)} ${extensionDecision === 'approve' ? 'approved' : 'rejected'}.`);
      setExtensionModal(null);
      setExtensionReason('');
      loadExtensions();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function handleResolveDispute(e) {
    e.preventDefault();
    if (!resolvingDispute) return;
    const trimmed = resolutionText.trim();
    if (trimmed.length < 5) {
      setErr('Arbitration finding/notes must be at least 5 characters long.');
      return;
    }
    const outcome = resolutionStatus === 'reject' || resolutionStatus === 'rejected' ? 'reject' : 'resolve';
    try {
      await apiRequest(`/admin/disputes/${resolvingDispute.id}`, {
        method: 'PATCH',
        body: {
          outcome,
          resolution: trimmed,
          status: outcome === 'resolve' ? 'resolved' : 'rejected',
        },
      });
      setMsg(`Dispute #${resolvingDispute.id.slice(0, 8)} ${outcome === 'resolve' ? 'resolved' : 'rejected'}.`);
      setResolvingDispute(null);
      setResolutionText('');
      setResolutionStatus('resolved');
      loadDisputes();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function handleReviewKyc(kycItem, decision, reason = '') {
    if (!kycItem?.id) return;
    const status = decision === 'approved' || decision === 'verified' ? 'verified' : 'rejected';
    const trimmedReason = reason?.trim();
    if (status === 'rejected' && (!trimmedReason || trimmedReason.length < 4)) {
      setErr('Rejection reason must be at least 4 characters long.');
      return;
    }
    try {
      await apiRequest(`/admin/kyc/${kycItem.id}`, {
        method: 'PATCH',
        body: {
          status,
          rejectionReason: status === 'rejected' ? (trimmedReason || 'Document unreadable or invalid') : undefined,
        },
      });
      setMsg(`KYC attempt #${kycItem.id.slice(0, 8)} marked as ${status}.`);
      loadKycQueue();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function handleCreateCategory(e) {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setErr('');
    setMsg('');
    try {
      await apiRequest('/categories', {
        method: 'POST',
        body: {
          name: newCatName.trim(),
          slug: newCatSlug.trim() || undefined,
          description: newCatDesc.trim() || undefined,
        },
      });
      setMsg(`Category "${newCatName}" created successfully.`);
      setCreateCategoryModal(false);
      setNewCatName('');
      setNewCatSlug('');
      setNewCatDesc('');
      loadCategories();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function handleToggleCategoryActive(cat) {
    setErr('');
    setMsg('');
    try {
      if (cat.isActive) {
        await apiRequest(`/categories/${cat.id}`, { method: 'DELETE' });
        setMsg(`Category "${cat.name}" deactivated.`);
      } else {
        await apiRequest(`/categories/${cat.id}`, {
          method: 'PATCH',
          body: { isActive: true },
        });
        setMsg(`Category "${cat.name}" activated.`);
      }
      loadCategories();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function toggleSetting(key, current) {
    try {
      await apiRequest(`/admin/settings/${key}`, { method: 'PATCH', body: { isApproved: !current } });
      setMsg(`Setting "${key}" approval updated.`);
      loadSettings();
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <div className={styles.adminContainer}>
      <header className={styles.header}>
        <span className={styles.eyebrow}>CONCIERGE & OPERATIONS CONTROL</span>
        <h1 className={styles.title}>Exchange24 Admin Dashboard</h1>
        <p className={styles.subtitle}>
          Full platform oversight: user roles, rental reservations, settlements, dispute arbitration, and audit logs.
        </p>
      </header>

      {err && <div className="alert alert-error" style={{ marginBottom: '1.25rem' }}>{err}</div>}
      {msg && <div className="alert alert-success" style={{ marginBottom: '1.25rem' }}>{msg}</div>}

      {/* ── Tabs Navigation ── */}
      <nav className={styles.tabsBar}>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'overview' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview & Metrics
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'users' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('users')}
        >
          Users & Roles <span className={styles.badgePill}>{userTotal}</span>
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'bookings' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('bookings')}
        >
          Rental Bookings <span className={styles.badgePill}>{bookingTotal}</span>
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'payments' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('payments')}
        >
          Payments Desk
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'deposits' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('deposits')}
        >
          Security Deposits
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'extensions' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('extensions')}
        >
          Extensions
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'disputes' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('disputes')}
        >
          Dispute Queue <span className={styles.badgePill}>{disputes.filter((d) => d.status === 'open').length}</span>
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'kyc' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('kyc')}
        >
          KYC Verifications <span className={styles.badgePill}>{kycQueue.filter((k) => k.status === 'pending').length}</span>
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'categories' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('categories')}
        >
          Categories
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'settings' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          Platform Policies
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'audit' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          Audit Logs
        </button>
      </nav>

      {/* ── TAB 1: Overview & Metrics ── */}
      {activeTab === 'overview' && (
        <section>
          <div className={styles.metricsGrid}>
            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>Total Bookings</div>
              <div className={styles.metricValue}>{reconciliation?.bookings?.total ?? 0}</div>
              <div className={styles.metricSub}>{reconciliation?.bookings?.completed ?? 0} completed rentals</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>Gross Collected</div>
              <div className={styles.metricValue}>
                {reconciliation?.financials?.totalCollectedPaise ? formatPaiseToRupees(reconciliation.financials.totalCollectedPaise) : '₹0'}
              </div>
              <div className={styles.metricSub}>Gross customer rental & sale payments</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>Deposits Held</div>
              <div className={styles.metricValue} style={{ color: '#D97706' }}>
                {reconciliation?.financials?.totalDepositsHeldPaise ? formatPaiseToRupees(reconciliation.financials.totalDepositsHeldPaise) : '₹0'}
              </div>
              <div className={styles.metricSub}>Active security liability reserve</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>Total Refunded</div>
              <div className={styles.metricValue} style={{ color: '#DC2626' }}>
                {reconciliation?.financials?.totalRefundedPaise ? formatPaiseToRupees(reconciliation.financials.totalRefundedPaise) : '₹0'}
              </div>
              <div className={styles.metricSub}>Settled claims & returned deposits</div>
            </div>
          </div>

          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Recent Ledger Entries</h2>
            <p className={styles.cardSubtitle}>Real-time financial credit/debit movements across accounts.</p>
            <div className={styles.tableWrapper} style={{ marginTop: '1rem' }}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Type</th>
                    <th>Direction</th>
                    <th>Amount</th>
                    <th>Memo</th>
                  </tr>
                </thead>
                <tbody>
                  {(reconciliation?.recentLedger || []).map((entry) => (
                    <tr key={entry.id}>
                      <td>{formatDate(entry.createdAt)}</td>
                      <td><code>{entry.type}</code></td>
                      <td>
                        <span className={`${styles.badge} ${entry.direction === 'credit' ? styles.badgeSuccess : styles.badgeNeutral}`}>
                          {entry.direction}
                        </span>
                      </td>
                      <td><strong>{formatPaiseToRupees(entry.amountPaise)}</strong></td>
                      <td>{entry.memo || '—'}</td>
                    </tr>
                  ))}
                  {(!reconciliation?.recentLedger || reconciliation.recentLedger.length === 0) && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>
                        No ledger movements recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ── TAB 2: Users & Role Access Control ── */}
      {activeTab === 'users' && (
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>User Directory & Role Access</h2>
              <p className={styles.cardSubtitle}>Manage member identities, roles (admin, seller, customer), and access states.</p>
            </div>
          </div>

          <div className={styles.filterBar}>
            <input
              type="text"
              placeholder="Search by email or name…"
              className={styles.searchInput}
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadUsers()}
            />
            <select
              className={styles.selectInput}
              value={userRoleFilter}
              onChange={(e) => { setUserRoleFilter(e.target.value); }}
            >
              <option value="">All Roles</option>
              <option value="admin">Administrator (admin)</option>
              <option value="seller">Designer Seller (seller)</option>
              <option value="customer">Shopper / Renter (customer)</option>
            </select>
            <select
              className={styles.selectInput}
              value={userStatusFilter}
              onChange={(e) => { setUserStatusFilter(e.target.value); }}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
            <button type="button" className={`${styles.actionBtn} ${styles.actionBtnPrimary}`} onClick={loadUsers}>
              Apply Filters
            </button>
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>User / Email</th>
                  <th>Display Name</th>
                  <th>Roles</th>
                  <th>Status</th>
                  <th>Registered</th>
                  <th>Last Login</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.email}</strong>
                      <div style={{ fontSize: '0.75rem', color: '#888' }}>ID: {u.id.slice(0, 8)}</div>
                    </td>
                    <td>{u.displayName || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                        {(u.roles || []).map((r) => (
                          <span
                            key={r}
                            className={`${styles.badge} ${
                              r === 'admin' ? styles.badgeAdmin : r === 'seller' ? styles.badgePrimary : styles.badgeNeutral
                            }`}
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span className={`${styles.badge} ${u.status === 'active' ? styles.badgeSuccess : styles.badgeDanger}`}>
                        {u.status}
                      </span>
                    </td>
                    <td>{formatDate(u.createdAt)}</td>
                    <td>{u.lastLoginAt ? formatDate(u.lastLoginAt) : 'Never'}</td>
                    <td>
                      <button
                        type="button"
                        className={styles.actionBtn}
                        onClick={() => handleOpenRoleModal(u)}
                      >
                        Edit Roles
                      </button>
                      <button
                        type="button"
                        className={`${styles.actionBtn} ${u.status === 'active' ? styles.actionBtnDanger : styles.actionBtnPrimary}`}
                        onClick={() => handleToggleUserStatus(u)}
                      >
                        {u.status === 'active' ? 'Suspend' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>
                      No matching user accounts found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── TAB 3: Rental Bookings ── */}
      {activeTab === 'bookings' && (
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>All Platform Rental Bookings</h2>
              <p className={styles.cardSubtitle}>Inspect garment bookings across renters and listing providers.</p>
            </div>
            <select
              className={styles.selectInput}
              value={bookingStatusFilter}
              onChange={(e) => setBookingStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Booking ID</th>
                  <th>Garment Title</th>
                  <th>Renter Email</th>
                  <th>Dates</th>
                  <th>Rental Subtotal</th>
                  <th>Deposit</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id}>
                    <td><code>{b.id.slice(0, 8)}</code></td>
                    <td><strong>{b.listingTitle}</strong></td>
                    <td>{b.renterEmail}</td>
                    <td>{formatDate(b.startDate)} — {formatDate(b.endDate)}</td>
                    <td>{formatPaiseToRupees(b.subtotalAmountPaise)}</td>
                    <td>{formatPaiseToRupees(b.depositAmountPaise)}</td>
                    <td><strong>{formatPaiseToRupees(b.totalAmountPaise)}</strong></td>
                    <td>
                      <span className={`${styles.badge} ${
                        b.status === 'confirmed' || b.status === 'active' || b.status === 'completed'
                          ? styles.badgeSuccess
                          : b.status === 'pending'
                          ? styles.badgeWarning
                          : styles.badgeDanger
                      }`}>
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {bookings.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>
                      No rental bookings match the filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── TAB 4: Payments & Settlements ── */}
      {activeTab === 'payments' && (
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>Payments Desk & Settlements</h2>
              <p className={styles.cardSubtitle}>Inspect incoming intents, settle offline transactions, and manage reconciliation.</p>
            </div>
            <select
              className={styles.selectInput}
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="succeeded">Succeeded</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Payment ID</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Provider Ref</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <code>{p.id.slice(0, 8)}</code>
                      <div style={{ fontSize: '0.75rem', color: '#888' }}>
                        Ref: {(p.rentalBookingId || p.orderId || '').slice(0, 8)}
                      </div>
                    </td>
                    <td><span className={`${styles.badge} ${styles.badgeNeutral}`}>{p.paymentType}</span></td>
                    <td><strong>{formatPaiseToRupees(p.amountPaise)}</strong></td>
                    <td>
                      <span className={`${styles.badge} ${
                        p.status === 'succeeded' ? styles.badgeSuccess : p.status === 'pending' ? styles.badgeWarning : styles.badgeDanger
                      }`}>
                        {p.status}
                      </span>
                    </td>
                    <td>{p.providerTransactionId || '—'}</td>
                    <td>{formatDate(p.createdAt)}</td>
                    <td>
                      {p.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                            onClick={() => handleSettlePayment(p.id)}
                          >
                            Settle (200)
                          </button>
                          <button
                            type="button"
                            className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                            onClick={() => handleFailPayment(p.id)}
                          >
                            Mark Failed
                          </button>
                        </>
                      )}
                      {p.status !== 'pending' && <span style={{ color: '#888', fontSize: '0.8rem' }}>Closed</span>}
                    </td>
                  </tr>
                ))}
                {payments.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>
                      No payment transactions recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── TAB 5: Security Deposits ── */}
      {activeTab === 'deposits' && (
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>Security Deposits Management</h2>
              <p className={styles.cardSubtitle}>Inspect liability reserves, release funds upon return, or deduct damage fees.</p>
            </div>
            <select
              className={styles.selectInput}
              value={depositStatusFilter}
              onChange={(e) => setDepositStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="held">Held (Active)</option>
              <option value="released">Released</option>
              <option value="withheld">Withheld / Deducted</option>
            </select>
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Deposit ID</th>
                  <th>Booking</th>
                  <th>Renter</th>
                  <th>Garment</th>
                  <th>Collected</th>
                  <th>Deducted</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {deposits.map((d) => (
                  <tr key={d.id}>
                    <td><code>{d.id.slice(0, 8)}</code></td>
                    <td><code>{d.rentalBookingId.slice(0, 8)}</code></td>
                    <td>{d.renterEmail}</td>
                    <td>{d.listingTitle}</td>
                    <td><strong>{formatPaiseToRupees(d.collectedAmountPaise)}</strong></td>
                    <td>{d.deductionAmountPaise > 0 ? formatPaiseToRupees(d.deductionAmountPaise) : '₹0'}</td>
                    <td>
                      <span className={`${styles.badge} ${
                        d.status === 'released' ? styles.badgeSuccess : d.status === 'held' ? styles.badgeWarning : styles.badgeDanger
                      }`}>
                        {d.status}
                      </span>
                    </td>
                    <td>
                      {d.status === 'held' && (
                        <>
                          <button
                            type="button"
                            className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                            onClick={() => handleReleaseDeposit(d.id)}
                          >
                            Release Deposit
                          </button>
                          <button
                            type="button"
                            className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                            onClick={() => {
                              setDeductModalDeposit(d);
                              setDeductAmountRupees('');
                              setDeductReason('');
                            }}
                          >
                            Deduct Fees
                          </button>
                        </>
                      )}
                      {d.status !== 'held' && <span style={{ color: '#888', fontSize: '0.8rem' }}>Resolved</span>}
                    </td>
                  </tr>
                ))}
                {deposits.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>
                      No security deposits recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── TAB 6: Rental Extensions ── */}
      {activeTab === 'extensions' && (
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>Rental Extensions Desk</h2>
              <p className={styles.cardSubtitle}>Review extension requests submitted by renters and garment owners.</p>
            </div>
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Extension ID</th>
                  <th>Garment</th>
                  <th>Renter</th>
                  <th>Original End</th>
                  <th>Requested End</th>
                  <th>Extra Days</th>
                  <th>Extra Amount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {extensions.map((ext) => (
                  <tr key={ext.id}>
                    <td><code>{ext.id.slice(0, 8)}</code></td>
                    <td>{ext.listingTitle}</td>
                    <td>{ext.renterEmail}</td>
                    <td>{formatDate(ext.originalEndDate)}</td>
                    <td><strong>{formatDate(ext.newEndDate)}</strong></td>
                    <td>+{ext.additionalDays} days</td>
                    <td>{formatPaiseToRupees(ext.additionalAmountPaise)}</td>
                    <td>
                      <span className={`${styles.badge} ${
                        ext.status === 'approved' ? styles.badgeSuccess : ext.status === 'pending' ? styles.badgeWarning : styles.badgeDanger
                      }`}>
                        {ext.status}
                      </span>
                    </td>
                    <td>
                      {ext.status === 'pending' && (
                        <button
                          type="button"
                          className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                          onClick={() => {
                            setExtensionModal(ext);
                            setExtensionDecision('approve');
                            setExtensionReason('');
                          }}
                        >
                          Decide Request
                        </button>
                      )}
                      {ext.status !== 'pending' && (
                        <span style={{ color: '#888', fontSize: '0.8rem' }}>
                          {ext.status === 'rejected' ? ext.rejectionReason || 'Declined' : 'Approved'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {extensions.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>
                      No pending extension requests.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── TAB 7: Dispute Arbitration Queue ── */}
      {activeTab === 'disputes' && (
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>Dispute Arbitration Desk</h2>
              <p className={styles.cardSubtitle}>Inspect opened damage claims, non-delivery issues, and customer disputes.</p>
            </div>
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Dispute ID</th>
                  <th>Ref ID</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Opened</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {disputes.map((d) => (
                  <tr key={d.id}>
                    <td><code>{d.id.slice(0, 8)}</code></td>
                    <td>
                      <code>{(d.rentalBookingId || d.orderId || d.rental_booking_id || d.order_id || '').slice(0, 8)}</code>
                    </td>
                    <td><span className={`${styles.badge} ${styles.badgeNeutral}`}>{d.disputeType || d.dispute_type}</span></td>
                    <td style={{ maxWidth: '300px' }}>{d.description}</td>
                    <td>
                      <span className={`${styles.badge} ${
                        d.status === 'resolved' ? styles.badgeSuccess : d.status === 'open' ? styles.badgeWarning : styles.badgeDanger
                      }`}>
                        {d.status}
                      </span>
                    </td>
                    <td>{formatDate(d.createdAt || d.created_at)}</td>
                    <td>
                      {d.status === 'open' ? (
                        <button
                          type="button"
                          className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                          onClick={() => {
                            setResolvingDispute(d);
                            setResolutionText('');
                            setResolutionStatus('resolved');
                          }}
                        >
                          Arbitrate
                        </button>
                      ) : (
                        <span style={{ color: '#888', fontSize: '0.8rem' }}>{d.resolution || 'Closed'}</span>
                      )}
                    </td>
                  </tr>
                ))}
                {disputes.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>
                      No active member disputes.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── TAB 8: KYC Verifications ── */}
      {activeTab === 'kyc' && (
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>KYC Verification Queue</h2>
              <p className={styles.cardSubtitle}>Verify identity credentials to unlock high-value couture rental privileges.</p>
            </div>
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Verification ID</th>
                  <th>User ID</th>
                  <th>Document Type</th>
                  <th>Document Number</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {kycQueue.map((k) => (
                  <tr key={k.id}>
                    <td><code>{k.id.slice(0, 8)}</code></td>
                    <td><code>{k.userId || k.user_id}</code></td>
                    <td>{k.documentType || k.document_type}</td>
                    <td><code>{k.documentNumber || k.document_number}</code></td>
                    <td>
                      <span className={`${styles.badge} ${
                        k.status === 'verified' ? styles.badgeSuccess : k.status === 'pending' ? styles.badgeWarning : styles.badgeDanger
                      }`}>
                        {k.status}
                      </span>
                    </td>
                    <td>{formatDate(k.createdAt || k.created_at)}</td>
                    <td>
                      {k.status === 'pending' ? (
                        <>
                          <button
                            type="button"
                            className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                            onClick={() => handleReviewKyc(k, 'verified')}
                          >
                            Verify Identity
                          </button>
                          <button
                            type="button"
                            className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                            onClick={() => {
                              const reason = window.prompt('Specify rejection reason (min 4 chars):', 'Document unreadable or invalid');
                              if (reason) handleReviewKyc(k, 'rejected', reason);
                            }}
                          >
                            Reject
                          </button>
                        </>
                      ) : (
                        <span style={{ color: '#888', fontSize: '0.8rem' }}>{k.rejectionReason || 'Completed'}</span>
                      )}
                    </td>
                  </tr>
                ))}
                {kycQueue.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>
                      No KYC identity documents pending review.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── TAB 9: Categories & Taxonomy ── */}
      {activeTab === 'categories' && (
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>Categories & Taxonomy</h2>
              <p className={styles.cardSubtitle}>Curate designer garment categories, taxonomy hierarchies, and slugs.</p>
            </div>
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
              onClick={() => setCreateCategoryModal(true)}
            >
              + Create Category
            </button>
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Category ID</th>
                  <th>Name</th>
                  <th>Slug</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => (
                  <tr key={cat.id}>
                    <td><code>{cat.id.slice(0, 8)}</code></td>
                    <td><strong>{cat.name}</strong></td>
                    <td><code>{cat.slug}</code></td>
                    <td>
                      <span className={`${styles.badge} ${cat.isActive ? styles.badgeSuccess : styles.badgeDanger}`}>
                        {cat.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`${styles.actionBtn} ${cat.isActive ? styles.actionBtnDanger : styles.actionBtnPrimary}`}
                        onClick={() => handleToggleCategoryActive(cat)}
                      >
                        {cat.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── TAB 10: Policies & Settings ── */}
      {activeTab === 'settings' && (
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>Platform Policies & Settings</h2>
              <p className={styles.cardSubtitle}>
                Unapproved policies default to zero-rate safety fallbacks until explicitly approved by an administrator.
              </p>
            </div>
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Configuration Parameter</th>
                  <th>Value</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {settings.map((s) => (
                  <tr key={s.key}>
                    <td><code>{s.key}</code></td>
                    <td><strong>{s.description || s.key}</strong></td>
                    <td><code>{JSON.stringify(s.value)}</code></td>
                    <td>
                      <span className={`${styles.badge} ${s.isApproved ? styles.badgeSuccess : styles.badgeWarning}`}>
                        {s.isApproved ? 'Approved' : 'Unapproved (Fallback)'}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`${styles.actionBtn} ${s.isApproved ? styles.actionBtnDanger : styles.actionBtnPrimary}`}
                        onClick={() => toggleSetting(s.key, s.isApproved)}
                      >
                        {s.isApproved ? 'Revoke Approval' : 'Approve Policy'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── TAB 11: Security Audit Logs ── */}
      {activeTab === 'audit' && (
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>Platform Security Audit Trail</h2>
              <p className={styles.cardSubtitle}>Append-only cryptographic security audit trail across sensitive platform operations.</p>
            </div>
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Entity Type</th>
                  <th>Entity ID</th>
                  <th>Actor (User ID)</th>
                  <th>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td>{formatDate(log.createdAt)}</td>
                    <td><code>{log.action}</code></td>
                    <td>{log.entityType}</td>
                    <td><code>{log.entityId ? log.entityId.slice(0, 8) : '—'}</code></td>
                    <td><code>{log.userId ? log.userId.slice(0, 8) : 'System / Ops'}</code></td>
                    <td>{log.ipAddress || '—'}</td>
                  </tr>
                ))}
                {auditLogs.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>
                      No audit logs found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── MODAL 1: Role Access Management ── */}
      {roleModalUser && (
        <div className={styles.modalBackdrop} onClick={() => setRoleModalUser(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Manage Roles & Access</h2>
            <p className={styles.cardSubtitle} style={{ marginBottom: '1.25rem' }}>
              Target user: <strong>{roleModalUser.email}</strong>
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={selectedRoles.includes('admin')}
                  onChange={() => handleToggleRole('admin')}
                />
                <div>
                  <strong>admin</strong>
                  <div style={{ fontSize: '0.8rem', color: '#666' }}>Full administrative concierge, backoffice, and dispute authority.</div>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={selectedRoles.includes('seller')}
                  onChange={() => handleToggleRole('seller')}
                />
                <div>
                  <strong>seller</strong>
                  <div style={{ fontSize: '0.8rem', color: '#666' }}>Can list luxury garments, manage physical units, and accept rentals.</div>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={selectedRoles.includes('customer')}
                  onChange={() => handleToggleRole('customer')}
                />
                <div>
                  <strong>customer</strong>
                  <div style={{ fontSize: '0.8rem', color: '#666' }}>Can discover styles, reserve rental looks, buy pre-loved, and write reviews.</div>
                </div>
              </label>
            </div>

            <div className={styles.modalActions}>
              <button type="button" className={styles.actionBtn} onClick={() => setRoleModalUser(null)}>
                Cancel
              </button>
              <button type="button" className={`${styles.actionBtn} ${styles.actionBtnPrimary}`} onClick={handleSaveRoles}>
                Save Permissions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 2: Dispute Arbitration ── */}
      {resolvingDispute && (
        <div className={styles.modalBackdrop} onClick={() => setResolvingDispute(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Arbitrate Dispute #{resolvingDispute.id.slice(0, 8)}</h2>
            <form onSubmit={handleResolveDispute}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Arbitration Decision
                </label>
                <select
                  className={styles.selectInput}
                  style={{ width: '100%' }}
                  value={resolutionStatus}
                  onChange={(e) => setResolutionStatus(e.target.value)}
                >
                  <option value="resolved">Resolve in favor of claimant (Uphold Claim)</option>
                  <option value="rejected">Reject claim as unsubstantiated (Dismiss)</option>
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Arbitration Finding & Justification (min 5 characters)
                </label>
                <textarea
                  className={styles.searchInput}
                  rows={4}
                  style={{ width: '100%' }}
                  value={resolutionText}
                  onChange={(e) => setResolutionText(e.target.value)}
                  placeholder="State the arbitration findings, inspection notes, or settlement outcome…"
                  required
                />
              </div>

              <div className={styles.modalActions}>
                <button type="button" className={styles.actionBtn} onClick={() => setResolvingDispute(null)}>
                  Cancel
                </button>
                <button type="submit" className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}>
                  Commit Arbitration Decision
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 3: Deduct Deposit ── */}
      {deductModalDeposit && (
        <div className={styles.modalBackdrop} onClick={() => setDeductModalDeposit(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Deduct from Security Deposit</h2>
            <p className={styles.cardSubtitle} style={{ marginBottom: '1rem' }}>
              Collected Reserve: <strong>{formatPaiseToRupees(deductModalDeposit.collectedAmountPaise)}</strong>
            </p>
            <form onSubmit={handleConfirmDeductDeposit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Deduction Amount (in ₹ Rupees)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  className={styles.searchInput}
                  style={{ width: '100%' }}
                  value={deductAmountRupees}
                  onChange={(e) => setDeductAmountRupees(e.target.value)}
                  placeholder="e.g. 1500"
                  required
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Deduction Reason (Damage Assessment / Stain Removal)
                </label>
                <textarea
                  className={styles.searchInput}
                  rows={3}
                  style={{ width: '100%' }}
                  value={deductReason}
                  onChange={(e) => setDeductReason(e.target.value)}
                  placeholder="Fabric tear on hem requiring specialist restoration…"
                  required
                />
              </div>

              <div className={styles.modalActions}>
                <button type="button" className={styles.actionBtn} onClick={() => setDeductModalDeposit(null)}>
                  Cancel
                </button>
                <button type="submit" className={`${styles.actionBtn} ${styles.actionBtnDanger}`}>
                  Confirm Deduction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 4: Rental Extension Decision ── */}
      {extensionModal && (
        <div className={styles.modalBackdrop} onClick={() => setExtensionModal(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Extension Request #{extensionModal.id.slice(0, 8)}</h2>
            <p className={styles.cardSubtitle} style={{ marginBottom: '1rem' }}>
              Garment: <strong>{extensionModal.listingTitle}</strong> · New Return Date: <strong>{formatDate(extensionModal.newEndDate)}</strong>
            </p>
            <form onSubmit={handleConfirmExtensionDecision}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Decision
                </label>
                <select
                  className={styles.selectInput}
                  style={{ width: '100%' }}
                  value={extensionDecision}
                  onChange={(e) => setExtensionDecision(e.target.value)}
                >
                  <option value="approve">Approve Extension</option>
                  <option value="reject">Reject Extension</option>
                </select>
              </div>

              {extensionDecision === 'reject' && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                    Rejection Reason
                  </label>
                  <input
                    type="text"
                    className={styles.searchInput}
                    style={{ width: '100%' }}
                    value={extensionReason}
                    onChange={(e) => setExtensionReason(e.target.value)}
                    placeholder="Subsequent reservation already confirmed…"
                  />
                </div>
              )}

              <div className={styles.modalActions}>
                <button type="button" className={styles.actionBtn} onClick={() => setExtensionModal(null)}>
                  Cancel
                </button>
                <button type="submit" className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}>
                  Commit Decision
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 5: Create Category ── */}
      {createCategoryModal && (
        <div className={styles.modalBackdrop} onClick={() => setCreateCategoryModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Create New Taxonomy Category</h2>
            <form onSubmit={handleCreateCategory}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Category Name
                </label>
                <input
                  type="text"
                  className={styles.searchInput}
                  style={{ width: '100%' }}
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="e.g. Cocktail & Gala Gowns"
                  required
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Slug (Optional)
                </label>
                <input
                  type="text"
                  className={styles.searchInput}
                  style={{ width: '100%' }}
                  value={newCatSlug}
                  onChange={(e) => setNewCatSlug(e.target.value)}
                  placeholder="e.g. cocktail-gala-gowns"
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Description
                </label>
                <textarea
                  className={styles.searchInput}
                  rows={3}
                  style={{ width: '100%' }}
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                  placeholder="Curated selection of designer evening pieces…"
                />
              </div>

              <div className={styles.modalActions}>
                <button type="button" className={styles.actionBtn} onClick={() => setCreateCategoryModal(false)}>
                  Cancel
                </button>
                <button type="submit" className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}>
                  Create Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
