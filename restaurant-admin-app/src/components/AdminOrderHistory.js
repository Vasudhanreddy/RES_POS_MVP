// restaurant-admin-app/src/components/AdminOrderHistory.js

import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, orderBy, Timestamp } from 'firebase/firestore';
// Removed direct import of db. It will now come from props.
// import { db } from '../firebaseConfig';
import { useNavigate } from 'react-router-dom';
import './AdminOrderHistory.css'; // Link to the new CSS file
import { FaSpinner, FaFileInvoiceDollar, FaCalendarAlt, FaFilter } from 'react-icons/fa'; // Icons

// AdminOrderHistory now accepts 'db' as a prop
const AdminOrderHistory = ({ restaurantID, db }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter states
  const [dateRange, setDateRange] = useState('Today'); // 'Today', 'Week', 'Month', 'Year', 'Custom'
  const [startDate, setStartDate] = useState(''); // For custom date range
  const [endDate, setEndDate] = useState('');     // For custom date range
  const [selectedStatus, setSelectedStatus] = useState('All');

  const navigate = useNavigate();

  const ALL_ORDER_STATUSES = useMemo(() => [
    'All',
    'pending',
    'preparing',
    'ready for pickup',
    'out for delivery',
    'completed',
    'cancelled',
    'refunded'
  ], []);

  useEffect(() => {
    // Ensure db is available before proceeding
    if (!db) {
        setError("Firebase Firestore is not initialized.");
        setLoading(false);
        return;
    }

    if (!restaurantID) {
      setError("No Restaurant ID provided. Cannot load order history.");
      setLoading(false);
      return;
    }

    let startTimestamp, endTimestamp;
    const now = new Date();

    // Helper to clone date to avoid mutation
    const cloneDate = (date) => new Date(date.getTime());

    // Determine date range based on filter selection
    if (dateRange === 'Today') {
      const todayStart = cloneDate(now);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = cloneDate(now);
      todayEnd.setHours(23, 59, 59, 999);
      startTimestamp = Timestamp.fromDate(todayStart);
      endTimestamp = Timestamp.fromDate(todayEnd);
    } else if (dateRange === 'Week') {
      const weekStart = cloneDate(now);
      weekStart.setDate(now.getDate() - now.getDay()); // Sunday start (0)
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = cloneDate(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6); // End of Saturday
      weekEnd.setHours(23, 59, 59, 999);

      startTimestamp = Timestamp.fromDate(weekStart);
      endTimestamp = Timestamp.fromDate(weekEnd);
    } else if (dateRange === 'Month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      monthStart.setHours(0, 0, 0, 0);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0); // Last day of month
      monthEnd.setHours(23, 59, 59, 999);
      startTimestamp = Timestamp.fromDate(monthStart);
      endTimestamp = Timestamp.fromDate(monthEnd);
    } else if (dateRange === 'Year') {
      const yearStart = new Date(now.getFullYear(), 0, 1);
      yearStart.setHours(0, 0, 0, 0);
      const yearEnd = new Date(now.getFullYear(), 11, 31);
      yearEnd.setHours(23, 59, 59, 999);
      startTimestamp = Timestamp.fromDate(yearStart);
      endTimestamp = Timestamp.fromDate(yearEnd);
    } else if (dateRange === 'Custom' && startDate && endDate) {
      const customStart = new Date(startDate);
      customStart.setHours(0, 0, 0, 0);
      const customEnd = new Date(endDate);
      customEnd.setHours(23, 59, 59, 999);
      if (customStart > customEnd) {
        setError("Custom date range: Start date cannot be after end date.");
        setLoading(false);
        return;
      }
      startTimestamp = Timestamp.fromDate(customStart);
      endTimestamp = Timestamp.fromDate(customEnd);
    } else if (dateRange === 'Custom' && (!startDate || !endDate)) {
        // If custom range is selected but dates are not set, don't query yet
        setOrders([]);
        setLoading(false);
        return;
    }


    const ordersRef = collection(db, 'resturent', restaurantID, 'orders');
    let q = query(
      ordersRef,
      orderBy('createdAt', 'desc') // Always order by creation time, newest first
    );

    if (startTimestamp && endTimestamp) {
        q = query(q,
            where('createdAt', '>=', startTimestamp),
            where('createdAt', '<=', endTimestamp)
        );
    } else {
        // If no date range is effectively selected (e.g., custom without dates),
        // we should either show no data or a default. For now, we return early.
        // Or fetch all orders (if no date filter is applied)
        // For 'All' transactions without date filters, remove date where clauses.
    }


    if (selectedStatus !== 'All') {
      q = query(q, where('orderStatus', '==', selectedStatus));
      // NOTE: If you combine `where` clauses on `createdAt` (range) and `orderStatus` (equality)
      // you will very likely need a composite index in Firestore for (orderStatus Asc, createdAt Desc).
      // If you also add `orderBy('createdAt', 'desc')`, this index becomes even more specific.
      // Firestore will suggest this in the console if it's missing.
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedOrders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      }));
      setOrders(fetchedOrders);
      setLoading(false);
      setError(null);
    }, (err) => {
      console.error("Error fetching admin order history:", err);
      setError("Failed to load orders. Please check console for details.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [restaurantID, dateRange, startDate, endDate, selectedStatus, db]); // Added db to dependency array

  const handleViewInvoice = (orderId) => {
    navigate(`/admin-order-history/${orderId}`); // Navigate to a detailed invoice page
  };

  const formatDateForDisplay = (date) => {
    if (!date) return 'N/A';
    return date.toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // Render Logic
  if (loading) {
    return (
      <div className="admin-order-history-container loading">
        <FaSpinner className="spinner-icon" />
        <p>Loading Order History...</p>
      </div>
    );
  }

  if (error) {
    return <div className="admin-order-history-container error">{error}</div>;
  }

  return (
    <div className="admin-order-history-container">
      <h2 className="order-history-title">Admin Order History</h2>

      <div className="filter-controls">
        <div className="date-range-filters">
          <FaCalendarAlt className="filter-icon" />
          {['Today', 'Week', 'Month', 'Year'].map(range => (
            <button
              key={range}
              className={`filter-button ${dateRange === range ? 'active' : ''}`}
              onClick={() => { setDateRange(range); setStartDate(''); setEndDate(''); }}
            >
              {range}
            </button>
          ))}
          <button
            className={`filter-button ${dateRange === 'Custom' ? 'active' : ''}`}
            onClick={() => setDateRange('Custom')}
          >
            Custom Date
          </button>
        </div>

        {dateRange === 'Custom' && (
          <div className="custom-date-inputs">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="date-input"
            />
            <span>to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="date-input"
            />
          </div>
        )}

        <div className="status-filter">
          <FaFilter className="filter-icon" />
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="status-filter-dropdown"
          >
            {ALL_ORDER_STATUSES.map(status => (
              <option key={status} value={status}>
                {status === 'All' ? 'All Statuses' : status.charAt(0).toUpperCase() + status.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {orders.length === 0 ? (
        <p className="no-orders-message">No orders found for the selected filters.</p>
      ) : (
        <div className="order-list-table-container">
          <table className="order-history-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Total</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => (
                <tr key={order.id} className="order-row">
                  <td data-label="Order ID">{order.id.substring(0, 8)}</td>
                  <td data-label="Customer">{order.customerName || 'N/A'}</td>
                  <td data-label="Date">{formatDateForDisplay(order.createdAt)}</td>
                  <td data-label="Total">₹{order.totalAmount ? order.totalAmount.toFixed(2) : '0.00'}</td>
                  <td data-label="Status">
                    <span className={`status-badge status-${order.orderStatus.replace(/\s+/g, '-').toLowerCase()}`}>
                      {order.orderStatus.charAt(0).toUpperCase() + order.orderStatus.slice(1)}
                    </span>
                  </td>
                  <td data-label="Actions">
                    <button
                      className="view-invoice-button"
                      onClick={() => handleViewInvoice(order.id)}
                    >
                      <FaFileInvoiceDollar /> View Invoice
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminOrderHistory;
