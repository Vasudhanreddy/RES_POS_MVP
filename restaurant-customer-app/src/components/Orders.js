// restaurant-customer-app/src/components/Orders.js

import React, { useState, useEffect, useMemo } from 'react'; // Added useMemo
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore'; // Added orderBy
import { db } from '../firebaseConfig';
import { useNavigate } from 'react-router-dom';
import './Orders.css'; // Ensure this CSS file exists and is linked

const Orders = ({ user, restaurantID }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user?.uid || !restaurantID) {
      setError("User ID or Restaurant ID is missing. Cannot load orders.");
      setLoading(false);
      return;
    }

    const ordersCollection = collection(db, 'resturent', restaurantID, 'orders');
    // Query for orders belonging to the current user, ordered by creation time (newest first)
    // Ordering by 'createdAt' is crucial for reliably distinguishing 'current' from 'previous' and for the 'last week' filter.
    const q = query(
      ordersCollection,
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc') // Order by creation time, newest first
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(), // Convert Firestore Timestamp to Date object
        updatedAt: doc.data().updatedAt?.toDate(), // Convert Firestore Timestamp to Date object
      }));
      setOrders(ordersData);
      setLoading(false);
      setError(null);
      console.log("Fetched Orders:", ordersData);
    }, (err) => {
      console.error("Error fetching customer orders:", err);
      setError("Failed to load orders. Please try again.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, restaurantID]);

  // Use useMemo to filter orders into current and previous to prevent re-filtering on every render
  const { currentOrders, previousOrders } = useMemo(() => {
    const now = new Date();
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(now.getDate() - 7); // Date 7 days ago

    const currentStatuses = ['pending', 'preparing', 'ready for pickup', 'out for delivery'];
    const previousStatuses = ['completed', 'cancelled', 'refunded'];

    const filteredCurrent = orders.filter(order =>
      currentStatuses.includes(order.orderStatus)
    );

    const filteredPrevious = orders.filter(order =>
      previousStatuses.includes(order.orderStatus) &&
      order.createdAt && order.createdAt >= oneWeekAgo // Only include previous orders from the last week
    );

    return {
      currentOrders: filteredCurrent,
      previousOrders: filteredPrevious
    };
  }, [orders]); // Recalculate if the 'orders' array changes

  // Helper function to get the status class/icon for the dot/tick mark
  const getStatusIndicator = (status) => {
    switch (status) {
      case 'pending':
        // Yellow/Orange pulsing dot for new orders
        return <span className="status-dot status-dot-pending"></span>;
      case 'preparing':
        // Blue/Cyan pulsing dot for orders in preparation
        return <span className="status-dot status-dot-preparing"></span>;
      case 'ready for pickup':
      case 'out for delivery':
        // Purple pulsing dot for orders ready or out for delivery
        return <span className="status-dot status-dot-delivery"></span>;
      case 'completed':
        // Green tick mark for completed orders (no animation)
        return (
          <svg className="status-icon status-icon-completed" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
          </svg>
        );
      case 'cancelled':
      case 'refunded':
        // Red static dot for closed/unsuccessful orders
        return <span className="status-dot status-dot-closed"></span>;
      default:
        // Default grey dot for unknown statuses
        return <span className="status-dot status-dot-default"></span>;
    }
  };

  // Handler for clicking an order card to view details
  const handleOrderClick = (orderId) => {
    navigate(`/orders/${orderId}`); // Navigate to the new order details page
  };

  if (loading) {
    return <div className="orders-loading">Loading Your Orders...</div>;
  }

  if (error) {
    return <div className="orders-error">{error}</div>;
  }

  return (
    <div className="orders-container">
      <h3>Your Orders</h3>

      {/* Current Orders Section */}
      <section className="order-section current-orders-section">
        <h4 className="section-title">Current Orders ({currentOrders.length})</h4>
        {currentOrders.length === 0 ? (
          <p className="no-orders-message">No active orders at the moment. Check back soon!</p>
        ) : (
          <div className="orders-list">
            {currentOrders.map(order => (
              <div key={order.id} className="order-card" onClick={() => handleOrderClick(order.id)}>
                <div className="order-header">
                  <p className="order-id">Order ID: #{order.id.substring(0, 8)}</p>
                  <p className="order-total">Total: ₹{order.totalAmount ? order.totalAmount.toFixed(2) : '0.00'}</p>
                </div>
                <div className="order-status-info">
                  <p>Status: <span className="status-text">{order.orderStatus.charAt(0).toUpperCase() + order.orderStatus.slice(1)}</span></p>
                  <span className="status-indicator-wrapper">
                    {getStatusIndicator(order.orderStatus)}
                  </span>
                </div>
                <p className="order-date">Placed On: {order.createdAt?.toLocaleString() || 'N/A'}</p>
                {order.orderItems && order.orderItems.length > 0 && (
                  <div className="order-items-summary">
                    <p>Items: {order.orderItems.map(item => `${item.quantity}x ${item.name}`).join(', ')}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Previous Orders Section */}
      <section className="order-section previous-orders-section">
        <h4 className="section-title">Previous Orders (Last Week) ({previousOrders.length})</h4>
        {previousOrders.length === 0 ? (
          <p className="no-orders-message">No completed or cancelled orders in the last week.</p>
        ) : (
          <div className="orders-list">
            {previousOrders.map(order => (
              <div key={order.id} className="order-card" onClick={() => handleOrderClick(order.id)}>
                <div className="order-header">
                  <p className="order-id">Order ID: #{order.id.substring(0, 8)}</p>
                  <p className="order-total">Total: ₹{order.totalAmount ? order.totalAmount.toFixed(2) : '0.00'}</p>
                </div>
                <div className="order-status-info">
                  <p>Status: <span className="status-text">{order.orderStatus.charAt(0).toUpperCase() + order.orderStatus.slice(1)}</span></p>
                  <span className="status-indicator-wrapper">
                    {getStatusIndicator(order.orderStatus)}
                  </span>
                </div>
                <p className="order-date">Placed On: {order.createdAt?.toLocaleString() || 'N/A'}</p>
                {order.orderItems && order.orderItems.length > 0 && (
                  <div className="order-items-summary">
                    <p>Items: {order.orderItems.map(item => `${item.quantity}x ${item.name}`).join(', ')}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default Orders;
