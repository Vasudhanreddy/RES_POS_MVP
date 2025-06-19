// restaurant-admin-app/src/components/DriverDashboard.js

import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { FaSpinner, FaMapMarkerAlt, FaCheckCircle, FaTimesCircle, FaTruck, FaCashRegister, FaThumbsUp, FaThumbsDown, FaArrowRight, FaExclamationCircle } from 'react-icons/fa'; // FaExclamationCircle added here
import './DriverDashboard.css';

const DriverDashboard = ({ db, restaurantID, driverId }) => {
  const [availableOrders, setAvailableOrders] = useState([]); // Orders 'preparing' and unassigned
  const [myAssignedOrders, setMyAssignedOrders] = useState([]); // Orders assigned to this driver
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingOrderStatus, setUpdatingOrderStatus] = useState({}); // To track loading for specific order actions

  useEffect(() => {
    if (!db || !restaurantID || !driverId) {
      setError("Database, Restaurant ID, or Driver ID not provided.");
      setLoading(false);
      return;
    }

    setError(null);
    setLoading(true);

    const ordersCollectionRef = collection(db, 'resturent', restaurantID, 'orders');

    // --- Listener for Available Orders (Preparing & Unassigned) ---
    // These are orders that the restaurant has accepted/prepared and are now awaiting a driver.
    const availableOrdersQuery = query(
      ordersCollectionRef,
      where('orderStatus', '==', 'preparing'), // Restaurant has prepared it
      where('assignedDriverId', '==', null) // Not yet assigned to any driver
      // orderBy('createdAt', 'asc') // Could add ordering, but might require index
    );

    const unsubscribeAvailable = onSnapshot(availableOrdersQuery, (snapshot) => {
      const orders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
      }));
      setAvailableOrders(orders);
    }, (err) => {
      console.error("Error fetching available orders:", err);
      setError(`Failed to load available orders: ${err.message}`);
    });


    // --- Listener for My Assigned Orders ---
    // These are orders explicitly assigned to the current driver, regardless of their current delivery status.
    const myAssignedOrdersQuery = query(
      ordersCollectionRef,
      where('assignedDriverId', '==', driverId) // Assigned to current driver
      // orderBy('createdAt', 'desc') // Could add ordering, but might require index
    );

    const unsubscribeAssigned = onSnapshot(myAssignedOrdersQuery, (snapshot) => {
      const orders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
      }));
      setMyAssignedOrders(orders);
      setLoading(false); // Set loading to false once both listeners have fetched initial data
    }, (err) => {
      console.error("Error fetching my assigned orders:", err);
      setError(`Failed to load your assigned orders: ${err.message}`);
      setLoading(false);
    });

    // Cleanup function
    return () => {
      unsubscribeAvailable();
      unsubscribeAssigned();
    };
  }, [db, restaurantID, driverId]);


  // Helper function to update any field on an order
  const updateOrderField = async (orderId, updates) => {
    setUpdatingOrderStatus(prev => ({ ...prev, [orderId]: true }));
    try {
      const orderDocRef = doc(db, 'resturent', restaurantID, 'orders', orderId);
      await updateDoc(orderDocRef, {
        ...updates,
        updatedAt: Timestamp.now(), // Always update timestamp on change
      });
      console.log(`Order ${orderId} updated with:`, updates);
    } catch (err) {
      console.error(`Error updating order ${orderId}:`, err);
      setError(`Failed to update order status: ${err.message}`); // Generic error
    } finally {
      setUpdatingOrderStatus(prev => ({ ...prev, [orderId]: false }));
    }
  };

  // --- Driver Actions ---

  const handleAcceptAssignment = async (order) => {
    await updateOrderField(order.id, {
      driverAssignmentStatus: 'accepted_by_driver',
      orderStatus: 'assigned for delivery', // Confirm overall status
    });
  };

  const handleRejectAssignment = async (order) => {
    // When rejected, reset driver assignment and set order status back to preparing
    await updateOrderField(order.id, {
      driverAssignmentStatus: 'rejected_by_driver',
      assignedDriverId: null, // Clear assignment
      orderStatus: 'preparing', // Make it available for other drivers
    });
  };

  const handlePickup = async (order) => {
    await updateOrderField(order.id, {
      deliveryStatus: 'picked_up',
      orderStatus: 'picked up'
    });
  };

  const handleOnTheWay = async (order) => {
    await updateOrderField(order.id, {
      deliveryStatus: 'on_the_way',
      orderStatus: 'on the way'
    });
  };

  const handleDelivered = async (order) => {
    await updateOrderField(order.id, {
      deliveryStatus: 'delivered',
      orderStatus: 'delivered'
    });
  };

  const handlePaymentReceived = async (order) => {
    await updateOrderField(order.id, {
      paymentReceivedByDriver: true,
      // You might also want to change paymentStatus here if it's not done automatically by backend
    });
  };

  const handleCompleteDelivery = async (order) => {
    // Check if COD payment is received before completing
    if (order.paymentMethod === 'cash on delivery' && !order.paymentReceivedByDriver) {
      alert("Please confirm payment has been received before completing the order.");
      return;
    }
    await updateOrderField(order.id, {
      orderStatus: 'completed',
      deliveryStatus: 'completed', // Final delivery status
    });
  };

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

  // Helper to generate map link
  const getMapLink = (address) => {
    if (!address || (!address.street && !address.latitude)) return '#';
    if (address.latitude && address.longitude) {
      // Use Google Maps URL for latitude/longitude
      return `https://www.google.com/maps/search/?api=1&query=${address.latitude},${address.longitude}`;
    }
    // Fallback to text search if lat/lon not available
    const fullAddress = `${address.street || ''}, ${address.city || ''}, ${address.zipCode || ''}, India`; // Assuming India
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
  };

  if (loading) {
    return (
      <div className="driver-dashboard-container loading-state">
        <FaSpinner className="spinner-icon" />
        <p>Loading your assignments...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="driver-dashboard-container error-state">
        <FaExclamationCircle className="error-icon" />
        <p>Error: {error}</p>
        <p>Please ensure you have appropriate Firestore security rules and network connectivity.</p>
      </div>
    );
  }

  return (
    <div className="driver-dashboard-container">
      <h2 className="page-title"><FaTruck /> My Delivery Dashboard</h2>
      <p className="page-description">View available orders and manage your assigned deliveries.</p>

      {/* Available Orders Section */}
      <section className="dashboard-section available-orders">
        <h3>Available Orders ({availableOrders.length})</h3>
        {availableOrders.length === 0 ? (
          <p className="no-orders-message">No new orders available for assignment at this time.</p>
        ) : (
          <div className="order-list-grid">
            {availableOrders.map(order => (
              <div key={order.id} className="order-card available">
                <div className="order-header">
                  <h4>Order #{order.id.substring(0, 8)}...</h4>
                  <span className="status-badge status-preparing">Preparing</span>
                </div>
                <div className="order-info">
                  <p><strong>Customer:</strong> {order.customerName}</p>
                  <p><strong>Total:</strong> ₹{order.totalAmount ? order.totalAmount.toFixed(2) : '0.00'}</p>
                  <p><strong>Placed:</strong> {formatDate(order.createdAt)}</p>
                  {order.deliveryAddress && (
                    <p className="address-link">
                      <FaMapMarkerAlt /> <a href={getMapLink(order.deliveryAddress)} target="_blank" rel="noopener noreferrer">
                        {order.deliveryAddress.street}, {order.deliveryAddress.city}
                      </a>
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* My Assigned Orders Section */}
      <section className="dashboard-section my-assignments">
        <h3>My Assigned Deliveries ({myAssignedOrders.length})</h3>
        {myAssignedOrders.length === 0 ? (
          <p className="no-orders-message">You currently have no assigned deliveries.</p>
        ) : (
          <div className="order-list-grid">
            {myAssignedOrders.map(order => (
              <div key={order.id} className={`order-card assigned status-${order.driverAssignmentStatus || 'unknown'}`}>
                <div className="order-header">
                  <h4>Order #{order.id.substring(0, 8)}...</h4>
                  <div className="order-tags-group">
                    {order.paymentStatus === 'cash on delivery' && !order.paymentReceivedByDriver && (
                        <span className="payment-tag tag-cod"><FaCashRegister /> COD</span>
                    )}
                    {order.paymentStatus === 'cash on delivery' && order.paymentReceivedByDriver && (
                        <span className="payment-tag tag-cod-paid"><FaCashRegister /> COD Paid</span>
                    )}
                    <span className={`assignment-status-badge status-${order.driverAssignmentStatus || 'unknown'}`}>
                      Assignment: {order.driverAssignmentStatus || 'N/A'}
                    </span>
                    {order.deliveryStatus && (
                      <span className={`delivery-status-badge status-${order.deliveryStatus.replace(/\s+/g, '-')}`}>
                        Delivery: {order.deliveryStatus.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="order-info">
                  <p><strong>Customer:</strong> {order.customerName}</p>
                  <p><strong>Total:</strong> ₹{order.totalAmount ? order.totalAmount.toFixed(2) : '0.00'}</p>
                  <p><strong>Payment:</strong> {order.paymentMethod || 'N/A'} ({order.paymentStatus || 'N/A'})</p>
                  {order.deliveryAddress && (
                    <p className="address-link">
                      <FaMapMarkerAlt /> <a href={getMapLink(order.deliveryAddress)} target="_blank" rel="noopener noreferrer">
                        {order.deliveryAddress.street}, {order.deliveryAddress.city}, {order.deliveryAddress.zipCode}
                      </a>
                      {order.deliveryAddress.notes && <span> ({order.deliveryAddress.notes})</span>}
                    </p>
                  )}
                  <p><strong>Placed:</strong> {formatDate(order.createdAt)}</p>
                </div>

                <div className="order-actions-driver">
                  {order.driverAssignmentStatus === 'pending' && (
                    <>
                      <button
                        className="action-button accept-button"
                        onClick={() => handleAcceptAssignment(order)}
                        disabled={updatingOrderStatus[order.id]}
                      >
                        {updatingOrderStatus[order.id] ? <FaSpinner className="spinner" /> : <><FaThumbsUp /> Accept</>}
                      </button>
                      <button
                        className="action-button reject-button"
                        onClick={() => handleRejectAssignment(order)}
                        disabled={updatingOrderStatus[order.id]}
                      >
                        {updatingOrderStatus[order.id] ? <FaSpinner className="spinner" /> : <><FaThumbsDown /> Reject</>}
                      </button>
                    </>
                  )}

                  {order.driverAssignmentStatus === 'accepted_by_driver' && order.orderStatus !== 'completed' && (
                    <>
                      {/* Delivery Status Progression */}
                      {order.deliveryStatus === null && ( // Starting point: no status yet, means it's accepted but not picked up
                        <button
                          className="action-button primary-action"
                          onClick={() => handlePickup(order)}
                          disabled={updatingOrderStatus[order.id]}
                        >
                          {updatingOrderStatus[order.id] ? <FaSpinner className="spinner" /> : <><FaTruck /> Picked Up</>}
                        </button>
                      )}
                      {order.deliveryStatus === 'picked_up' && (
                        <button
                          className="action-button primary-action"
                          onClick={() => handleOnTheWay(order)}
                          disabled={updatingOrderStatus[order.id]}
                        >
                          {updatingOrderStatus[order.id] ? <FaSpinner className="spinner" /> : <><FaArrowRight /> On The Way</>}
                        </button>
                      )}
                      {order.deliveryStatus === 'on_the_way' && (
                        <button
                          className="action-button primary-action"
                          onClick={() => handleDelivered(order)}
                          disabled={updatingOrderStatus[order.id]}
                        >
                          {updatingOrderStatus[order.id] ? <FaSpinner className="spinner" /> : <><FaCheckCircle /> Delivered</>}
                        </button>
                      )}

                      {/* COD Payment Button */}
                      {order.paymentMethod === 'cash on delivery' && !order.paymentReceivedByDriver && (
                        <button
                          className="action-button cod-button"
                          onClick={() => handlePaymentReceived(order)}
                          disabled={updatingOrderStatus[order.id]}
                        >
                          {updatingOrderStatus[order.id] ? <FaSpinner className="spinner" /> : <><FaCashRegister /> Confirm Payment</>}
                        </button>
                      )}

                      {/* Complete Delivery Button (only after delivered, and payment if COD) */}
                      {order.deliveryStatus === 'delivered' &&
                        (order.paymentMethod !== 'cash on delivery' || order.paymentReceivedByDriver) && (
                        <button
                          className="action-button complete-button"
                          onClick={() => handleCompleteDelivery(order)}
                          disabled={updatingOrderStatus[order.id]}
                        >
                          {updatingOrderStatus[order.id] ? <FaSpinner className="spinner" /> : <><FaCheckCircle /> Complete Order</>}
                        </button>
                      )}
                    </>
                  )}

                  {order.orderStatus === 'completed' && <p className="completed-message"><FaCheckCircle /> Delivery Completed!</p>}
                  {order.orderStatus === 'cancelled' && <p className="cancelled-message"><FaTimesCircle /> Order Cancelled.</p>}
                  {order.driverAssignmentStatus === 'rejected_by_driver' && <p className="rejected-message"><FaTimesCircle /> Assignment Rejected.</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default DriverDashboard;