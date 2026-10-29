import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ordersApi } from '../../../api/ordersApi.js';
import { formatPaiseToRupees, formatDate } from '../../../utils/formatters.js';
import styles from './MyOrdersPage.module.css';

export function MyOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [actionMessage, setActionMessage] = useState('');

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await ordersApi.getMyOrders();
      const list = Array.isArray(res) ? res : (res?.rows ?? res?.data ?? []);
      setOrders(list);
    } catch (err) {
      setError(err.message || 'Failed to load your orders.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  async function handleOpenDetail(orderId) {
    setDetailLoading(true);
    setActionMessage('');
    try {
      const detail = await ordersApi.getOrderById(orderId);
      setSelectedOrder(detail?.data ?? detail);
    } catch (err) {
      setError(err.message || 'Failed to fetch order details.');
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleCancelOrder(orderId) {
    if (!window.confirm('Are you sure you want to cancel this pending order?')) return;
    setCancelling(true);
    setActionMessage('');
    try {
      await ordersApi.cancelOrder(orderId, 'Buyer requested cancellation');
      setActionMessage('Order was successfully cancelled.');
      await loadOrders();
      // Update modal view
      const updated = await ordersApi.getOrderById(orderId);
      setSelectedOrder(updated?.data ?? updated);
    } catch (err) {
      setError(err.message || 'Failed to cancel order.');
    } finally {
      setCancelling(false);
    }
  }

  function getBadgeClass(status) {
    switch (status) {
      case 'pending': return styles.badgePending;
      case 'confirmed': return styles.badgeConfirmed;
      case 'completed':
      case 'shipped':
      case 'delivered': return styles.badgeCompleted;
      case 'cancelled': return styles.badgeCancelled;
      default: return '';
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.eyebrow}>PURCHASE HISTORY</span>
        <h1 className={styles.title}>My Resale Orders</h1>
      </header>

      {error && <p className="error" role="alert" style={{ marginBottom: '1.5rem' }}>{error}</p>}
      {actionMessage && <p style={{ color: '#2E7D32', fontWeight: 600, marginBottom: '1.5rem' }}>{actionMessage}</p>}

      {loading ? (
        <p className="muted">Loading your purchase history…</p>
      ) : orders.length === 0 ? (
        <div className={styles.emptyState}>
          <h2 className={styles.emptyTitle}>No Orders Placed Yet</h2>
          <p style={{ color: '#666', fontSize: '0.9rem' }}>
            Discover authenticated designer archive and pre-owned pieces available for direct purchase.
          </p>
          <Link to="/listings" className={styles.browseLink}>Explore Collection</Link>
        </div>
      ) : (
        <div className={styles.ordersGrid}>
          {orders.map((order) => (
            <div key={order.id} className={styles.orderCard} onClick={() => handleOpenDetail(order.id)}>
              <div className={styles.orderTop}>
                <div>
                  <span className={styles.orderId}>Order #{order.id.slice(0, 8).toUpperCase()}</span>
                  <div className={styles.orderDate}>{formatDate(order.createdAt)}</div>
                </div>
                <span className={`${styles.badge} ${getBadgeClass(order.status)}`}>
                  {order.status}
                </span>
              </div>

              <div className={styles.orderSummary}>
                <div>Total Items: {order.itemCount ?? 1}</div>
                <div className={styles.orderAmount}>{formatPaiseToRupees(order.totalAmountPaise)}</div>
              </div>

              <button type="button" className={styles.viewDetailsBtn}>
                View Order Details
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Order Detail Modal */}
      {(selectedOrder || detailLoading) && (
        <div className={styles.modalBackdrop} onClick={() => setSelectedOrder(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            {detailLoading ? (
              <p className="muted">Loading order details…</p>
            ) : selectedOrder ? (
              <>
                <div className={styles.modalHeader}>
                  <div>
                    <h2 className={styles.modalTitle}>Order #{selectedOrder.id.slice(0, 8).toUpperCase()}</h2>
                    <span style={{ fontSize: '0.8rem', color: '#666' }}>Placed on {formatDate(selectedOrder.createdAt)}</span>
                  </div>
                  <button type="button" className={styles.closeButton} onClick={() => setSelectedOrder(null)}>✕</button>
                </div>

                <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Status: <strong className={`${styles.badge} ${getBadgeClass(selectedOrder.status)}`}>{selectedOrder.status}</strong></span>
                  <span>Total Paid: <strong>{formatPaiseToRupees(selectedOrder.totalAmountPaise)}</strong></span>
                </div>

                <h3 style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#555', marginBottom: '0.75rem' }}>
                  Purchased Items ({selectedOrder.items?.length ?? 1})
                </h3>

                <div className={styles.itemList}>
                  {(selectedOrder.items || []).map((item) => (
                    <div key={item.id} className={styles.itemRow}>
                      {item.media && item.media[0] ? (
                        <img src={item.media[0].url || item.media[0]} alt={item.title} className={styles.itemImage} />
                      ) : (
                        <div className={styles.itemImage} />
                      )}
                      <div className={styles.itemInfo}>
                        <div className={styles.itemBrand}>{item.brand || 'DESIGNER PIECE'}</div>
                        <div className={styles.itemTitle}>{item.title}</div>
                        <div className={styles.itemSize}>Size: {item.size || 'Standard'}</div>
                      </div>
                      <div className={styles.itemPrice}>
                        {formatPaiseToRupees(item.salePricePaise || selectedOrder.totalAmountPaise)}
                      </div>
                    </div>
                  ))}
                </div>

                <div className={styles.modalActions}>
                  <Link to={`/disputes?orderId=${selectedOrder.id}`} className={styles.disputeLink}>
                    Raise Dispute / Resolution
                  </Link>
                  {selectedOrder.status === 'pending' && (
                    <button
                      type="button"
                      className={styles.cancelBtn}
                      onClick={() => handleCancelOrder(selectedOrder.id)}
                      disabled={cancelling}
                    >
                      {cancelling ? 'Cancelling…' : 'Cancel Order'}
                    </button>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
