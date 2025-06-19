// restaurant-customer-app/src/components/OrderDetails.js

import React, { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useParams, useNavigate } from 'react-router-dom'; // Import useParams and useNavigate
import './OrderDetails.css'; // Create this CSS file for styling

const OrderDetails = ({ restaurantID }) => {
  const { orderId } = useParams(); // Get orderId from the URL parameters
  const navigate = useNavigate(); // Initialize navigate hook
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!orderId || !restaurantID) {
      setError("Order ID or Restaurant ID is missing. Cannot load order details.");
      setLoading(false);
      return;
    }

    const orderDocRef = doc(db, 'resturent', restaurantID, 'orders', orderId);

    // Set up real-time listener for this specific order document
    const unsubscribe = onSnapshot(orderDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const orderData = {
          id: docSnap.id,
          ...docSnap.data(),
          createdAt: docSnap.data().createdAt?.toDate(), // Convert Firestore Timestamp to Date object
          updatedAt: docSnap.data().updatedAt?.toDate(), // Convert Firestore Timestamp to Date object
        };
        setOrder(orderData);
        setLoading(false);
        setError(null);
        console.log("Fetched single order details:", orderData);
      } else {
        setError("Order not found or you don't have permission to view it.");
        setLoading(false);
        setOrder(null); // Clear order if not found
        console.error("Order not found with ID:", orderId);
      }
    }, (err) => {
      console.error("Error fetching order details:", err);
      setError("Failed to load order details. Please try again.");
      setLoading(false);
    });

    // Cleanup listener on component unmount
    return () => unsubscribe();
  }, [orderId, restaurantID]); // Re-run effect if orderId or restaurantID changes

  // Helper to format dates for display
  const formatDate = (date) => {
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

  if (loading) {
    return <div className="order-details-loading">Loading Order Details...</div>;
  }

  if (error) {
    return <div className="order-details-error">{error}</div>;
  }

  if (!order) {
    return <div className="order-details-error">Order not found.</div>;
  }

  return (
    <div className="order-details-container">
      <button onClick={() => navigate(-1)} className="back-button">&larr; Back to Orders</button>
      <h2>Order Details: #{order.id.substring(0, 8)}...</h2>

      <div className="detail-section">
        <h3>Order Summary</h3>
        <p><strong>Status:</strong> <span className={`order-status-badge status-${order.orderStatus.replace(/\s+/g, '-').toLowerCase()}`}>{order.orderStatus.charAt(0).toUpperCase() + order.orderStatus.slice(1)}</span></p>
        <p><strong>Total Amount:</strong> ₹{order.totalAmount ? order.totalAmount.toFixed(2) : '0.00'}</p>
        <p><strong>Order Type:</strong> {order.orderType || 'N/A'}</p>
        <p><strong>Payment Status:</strong> {order.paymentStatus || 'N/A'}</p>
        <p><strong>Payment Method:</strong> {order.paymentMethod || 'N/A'}</p>
        <p><strong>Placed On:</strong> {formatDate(order.createdAt)}</p>
        {order.updatedAt && <p><strong>Last Updated:</strong> {formatDate(order.updatedAt)}</p>}
      </div>

      <div className="detail-section">
        <h3>Customer Information</h3>
        <p><strong>Name:</strong> {order.customerName || 'N/A'}</p>
        <p><strong>Email:</strong> {order.customerEmail || 'N/A'}</p>
        <p><strong>Phone:</strong> {order.customerPhone || 'N/A'}</p>
      </div>

      {order.orderType === 'delivery' && order.deliveryAddress && (
        <div className="detail-section">
          <h3>Delivery Address</h3>
          <p><strong>Street:</strong> {order.deliveryAddress.street || 'N/A'}</p>
          {order.deliveryAddress.line2 && <p><strong>Apt/Suite:</strong> {order.deliveryAddress.line2}</p>}
          <p><strong>City:</strong> {order.deliveryAddress.city || 'N/A'}</p>
          <p><strong>Pincode:</strong> {order.deliveryAddress.zipCode || 'N/A'}</p>
          {order.deliveryAddress.notes && <p><strong>Notes:</strong> {order.deliveryAddress.notes}</p>}
        </div>
      )}

      <div className="detail-section">
        <h3>Items Ordered</h3>
        {order.orderItems && order.orderItems.length > 0 ? (
          <ul className="ordered-items-list">
            {order.orderItems.map((item, index) => (
              <li key={index} className="ordered-item">
                <span>{item.quantity}x {item.name}</span>
                <span>₹{(item.price * item.quantity).toFixed(2)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>No items found for this order.</p>
        )}
      </div>
    </div>
  );
};

export default OrderDetails;
