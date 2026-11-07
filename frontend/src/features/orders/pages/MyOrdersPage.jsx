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
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [orderDetails, setOrderDetails] = useState({});
  const [loadingDetailId, setLoadingDetailId] = useState(null);
  const [confirmCancelId, setConfirmCancelId] = useState(null);

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

  async function handleToggleOrder(orderId) {
    if (expandedOrderId === orderId) {
      setExpandedOrderId(null);
      return;
    }
    setExpandedOrderId(orderId);
    if (!orderDetails[orderId]) {
      setLoadingDetailId(orderId);
      try {
        const detail = await ordersApi.getOrderById(orderId);
        setOrderDetails((prev) => ({ ...prev, [orderId]: detail?.data ?? detail }));
      } catch (err) {
        setError(err.message || 'Failed to fetch order details.');
      } finally {
        setLoadingDetailId(null);
      }
    }
  }

  async function handleOpenDetail(orderId) {
    setDetailLoading(true);
    setActionMessage('');
    try {
      const detail = await ordersApi.getOrderById(orderId);
      const data = detail?.data ?? detail;
      setSelectedOrder(data);
      setOrderDetails((prev) => ({ ...prev, [orderId]: data }));
    } catch (err) {
      setError(err.message || 'Failed to fetch order details.');
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleCancelOrder(orderId) {
    setCancelling(true);
    setActionMessage('');
    try {
      await ordersApi.cancelOrder(orderId, 'Buyer requested cancellation');
      setActionMessage('Order was successfully cancelled.');
      setConfirmCancelId(null);
      await loadOrders();
      const updated = await ordersApi.getOrderById(orderId);
      const data = updated?.data ?? updated;
      setSelectedOrder(data);
      setOrderDetails((prev) => ({ ...prev, [orderId]: data }));
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
          {orders.map((order) => {
            const isExpanded = expandedOrderId === order.id;
            const details = orderDetails[order.id];
            const isLoadingThis = loadingDetailId === order.id;

            return (
              <div
                key={order.id}
                className={`${styles.orderCard} ${isExpanded ? styles.orderCardExpanded : ''}`}
                onClick={() => {
                  if (typeof window !== 'undefined' && window.innerWidth < 768) {
                    handleToggleOrder(order.id);
                  } else {
                    handleOpenDetail(order.id);
                  }
                }}
              >
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

                <button
                  type="button"
                  className={styles.viewDetailsBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (typeof window !== 'undefined' && window.innerWidth < 768) {
                      handleToggleOrder(order.id);
                    } else {
                      handleOpenDetail(order.id);
                    }
                  }}
                  aria-expanded={isExpanded}
                >
                  {isExpanded ? 'Hide Order Details ▲' : 'View Order Details ▼'}
                </button>

                {/* Inline Accordion Details on Mobile */}
                {isExpanded && (
                  <div className={styles.inlineAccordion} onClick={(e) => e.stopPropagation()}>
                    {isLoadingThis ? (
                      <p className="muted" style={{ padding: '1rem', textAlign: 'center' }}>Loading items…</p>
                    ) : details ? (
                      <div className={styles.accordionContent}>
                        <div className={styles.accordionHeaderMeta}>
                          <span>Status: <strong className={`${styles.badge} ${getBadgeClass(details.status)}`}>{details.status}</strong></span>
                          <span>Total: <strong>{formatPaiseToRupees(details.totalAmountPaise)}</strong></span>
                        </div>

                        <h4 className={styles.itemsHeading}>
                          Purchased Items ({details.items?.length ?? 1})
                        </h4>

                        <div className={styles.itemList}>
                          {(details.items || []).map((item) => (
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
                                {formatPaiseToRupees(item.salePricePaise || details.totalAmountPaise)}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className={styles.accordionActions}>
                          <Link to={`/disputes?orderId=${order.id}`} className={styles.disputeLink}>
                            Raise Dispute / Claim
                          </Link>
                          {details.status === 'pending' && (
                            confirmCancelId === order.id ? (
                              <div className={styles.cancelConfirmBox}>
                                <span>Cancel order?</span>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                  <button
                                    type="button"
                                    className={styles.cancelBtn}
                                    onClick={() => handleCancelOrder(order.id)}
                                    disabled={cancelling}
                                  >
                                    {cancelling ? 'Cancelling…' : 'Yes, Cancel'}
                                  </button>
                                  <button
                                    type="button"
                                    className={styles.viewDetailsBtn}
                                    onClick={() => setConfirmCancelId(null)}
                                  >
                                    Keep
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className={styles.cancelBtn}
                                onClick={() => setConfirmCancelId(order.id)}
                                disabled={cancelling}
                              >
                                Cancel Order
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
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
                    confirmCancelId === selectedOrder.id ? (
                      <div className={styles.cancelConfirmBox}>
                        <span>Cancel order?</span>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            type="button"
                            className={styles.cancelBtn}
                            onClick={() => handleCancelOrder(selectedOrder.id)}
                            disabled={cancelling}
                          >
                            {cancelling ? 'Cancelling…' : 'Yes, Cancel'}
                          </button>
                          <button
                            type="button"
                            className={styles.viewDetailsBtn}
                            onClick={() => setConfirmCancelId(null)}
                          >
                            Keep
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className={styles.cancelBtn}
                        onClick={() => setConfirmCancelId(selectedOrder.id)}
                        disabled={cancelling}
                      >
                        Cancel Order
                      </button>
                    )
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
