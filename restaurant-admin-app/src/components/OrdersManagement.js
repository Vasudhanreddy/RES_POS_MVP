// restaurant-admin-app/src/components/OrdersManagement.js

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, where, Timestamp } from 'firebase/firestore'; // Added 'Timestamp'
import './OrdersManagement.css';
import { FaSpinner, FaUserTie, FaCheckCircle, FaTimesCircle, FaTruck } from 'react-icons/fa';

const OrdersManagement = ({ restaurantID, db, userRole, userUID }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState({}); // Tracks which order is being updated
  const [assigningDriver, setAssigningDriver] = useState({}); // Tracks which order is having driver assigned

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [availableDrivers, setAvailableDrivers] = useState([]); // State to store available drivers
  const [selectedDriverForAssignment, setSelectedDriverForAssignment] = useState(''); // State for driver dropdown

  const isAdmin = ['admin', 'super_admin'].includes(userRole);

  // Define the main order flow statuses for columns
  const ORDER_FLOW_STATUSES = [
    "pending",
    "accepted",
    "preparing",
    "ready for pickup",
    "assigned for delivery",
    "picked up",
    "on the way",
    "delivered",
    "completed",
    "cancelled",
    "refunded"
  ];

  // Map display names to internal status for columns
  const COLUMN_MAPPING = {
    "New Orders": ["pending"],
    "Accepted / Preparing": ["accepted", "preparing"],
    "Ready for Delivery/Pickup": ["ready for pickup", "assigned for delivery"],
    "In Transit": ["picked up", "on the way"],
    "Completed / Closed": ["delivered", "completed", "cancelled", "refunded"]
  };

  useEffect(() => {
    if (!restaurantID) {
      setError("No Restaurant ID provided. Cannot load orders.");
      setLoading(false);
      return;
    }
    if (!db) {
        setError("Firestore database instance not provided.");
        setLoading(false);
        return;
    }

    // --- ORDERS LISTENER ---
    const ordersCollectionRef = collection(db, 'resturent', restaurantID, 'orders');
    const ordersQuery = query(
      ordersCollectionRef,
      orderBy('createdAt', 'desc')
    );

    const unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
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
      console.error("Error fetching orders:", err);
      let errorMessage = `Failed to load orders: ${err.message}.`;
      if (err.code === 'permission-denied') {
          errorMessage += ' Check your Firebase Security Rules for orders collection.';
      }
      setError(errorMessage);
      setLoading(false);
    });

    // --- DRIVERS LISTENER ---
    const usersCollectionRef = collection(db, 'users');
    const driversQuery = query(
        usersCollectionRef,
        where('role', '==', 'driver'),
        where('managedRestaurantId', '==', restaurantID),
        orderBy('displayName', 'asc')
    );

    const unsubscribeDrivers = onSnapshot(driversQuery, (snapshot) => {
        const fetchedDrivers = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        setAvailableDrivers(fetchedDrivers);
    }, (err) => {
        console.error("Error fetching drivers:", err);
    });

    return () => {
      unsubscribeOrders();
      unsubscribeDrivers();
    };
  }, [restaurantID, db]);


  // Function to update order status in Firestore (Admin's main control)
  const handleStatusChange = async (orderId, newStatus) => {
    if (!isAdmin) { // Ensure only admin can use this core status change
        alert("You do not have permission to change order status.");
        return;
    }
    if (!restaurantID) {
      alert("Restaurant ID not available.");
      return;
    }
    setUpdatingStatus(prev => ({ ...prev, [orderId]: true }));
    try {
      const orderDocRef = doc(db, 'resturent', restaurantID, 'orders', orderId);
      const updates = {
        orderStatus: newStatus,
        updatedAt: Timestamp.now(),
      };

      // Special handling for terminal states or re-opening for assignment
      if (['completed', 'cancelled', 'refunded'].includes(newStatus)) {
        // Clear driver assignment and delivery status if order is closed/cancelled
        updates.assignedDriverId = null;
        updates.driverAssignmentStatus = null;
        updates.deliveryStatus = null;
        updates.paymentReceivedByDriver = null; // Clear this too if order is cancelled/refunded
      } else if (newStatus === 'preparing' && selectedOrder && selectedOrder.assignedDriverId) {
        // If an admin manually moves an assigned order back to 'preparing', unassign the driver
        updates.assignedDriverId = null;
        updates.driverAssignmentStatus = null;
        updates.deliveryStatus = null;
      }

      await updateDoc(orderDocRef, updates);
      console.log(`Order ${orderId} status updated to: ${newStatus}`);

      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(prev => ({ ...prev, ...updates })); // Update modal state immediately
      }
    } catch (err) {
      console.error(`Error updating order ${orderId} status:`, err);
      alert(`Failed to update status for order ${orderId}: ${err.message}`);
    } finally {
      setUpdatingStatus(prev => ({ ...prev, [orderId]: false }));
    }
  };

  // Function to assign a driver to an order
  const handleAssignDriver = async (orderId, driverId) => {
    if (!isAdmin) { // Ensure only admin can assign drivers
        alert("You do not have permission to assign drivers.");
        return;
    }
    if (!restaurantID || !driverId) {
        alert("Restaurant ID or Driver not selected.");
        return;
    }
    setAssigningDriver(prev => ({ ...prev, [orderId]: true }));
    try {
        const orderDocRef = doc(db, 'resturent', restaurantID, 'orders', orderId);
        await updateDoc(orderDocRef, {
            assignedDriverId: driverId,
            driverAssignmentStatus: 'pending',
            orderStatus: 'assigned for delivery', // Admin sets main status
            deliveryStatus: null, // Reset delivery status for new assignment
            updatedAt: Timestamp.now(),
            assignedBy: userUID
        });
        console.log(`Order ${orderId} assigned to driver ${driverId}`);
        // Optionally update selectedOrder if modal is open
        if (selectedOrder && selectedOrder.id === orderId) {
          setSelectedOrder(prev => ({
            ...prev,
            assignedDriverId: driverId,
            driverAssignmentStatus: 'pending',
            orderStatus: 'assigned for delivery',
            deliveryStatus: null,
            updatedAt: Timestamp.now()
          }));
        }
    } catch (err) {
        console.error(`Error assigning driver to order ${orderId}:`, err);
        alert(`Failed to assign driver: ${err.message}`);
    } finally {
        setAssigningDriver(prev => ({ ...prev, [orderId]: false }));
        setSelectedDriverForAssignment('');
    }
  };

  // Modal handlers
  const handleOpenDetails = (order) => {
    setSelectedOrder(order);
    setSelectedDriverForAssignment(order.assignedDriverId || '');
    setIsDetailsModalOpen(true);
  };

  const handleCloseDetails = () => {
    setSelectedOrder(null);
    setIsDetailsModalOpen(false);
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
      return `https://www.google.com/maps/search/?api=1&query=${address.latitude},${address.longitude}`;
    }
    const fullAddress = `${address.street || ''}, ${address.city || ''}, ${address.zipCode || ''}, India`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
  };

  // Group orders by their display column
  const groupedOrders = {};
  Object.keys(COLUMN_MAPPING).forEach(columnName => {
    groupedOrders[columnName] = [];
  });

  orders.forEach(order => {
    for (const columnName in COLUMN_MAPPING) {
      if (COLUMN_MAPPING[columnName].includes(order.orderStatus)) {
        groupedOrders[columnName].push(order);
        break;
      }
    }
  });


  if (loading) {
    return <div className="orders-loading">Loading Orders...</div>;
  }

  if (error) {
    return <div className="orders-error">{error}</div>;
  }

  return (
    <div className="orders-management-container">
      {Object.values(groupedOrders).flat().length === 0 ? (
        <p className="no-orders-message">No active orders found for this restaurant yet.</p>
      ) : (
        <div className="orders-columns-container">
          {Object.keys(COLUMN_MAPPING).map(columnName => (
            <div key={columnName} className="order-column">
              <h3 className="column-title">{columnName} ({groupedOrders[columnName].length})</h3>
              <div className="column-content">
                {groupedOrders[columnName].length === 0 ? (
                  <p className="column-empty-message">No orders in this column.</p>
                ) : (
                  groupedOrders[columnName].map(order => (
                    <div
                      key={order.id}
                      className={`order-card status-${order.orderStatus.replace(/\s+/g, '-').toLowerCase()}`}
                    >
                      <div className="order-card-content-wrapper" onClick={() => handleOpenDetails(order)}>
                        <div className="order-header">
                          <h3>Order #{order.id.substring(0, 8)}</h3>
                          <div className="order-tags-group">
                            {order.orderType && <span className="order-type">{order.orderType}</span>}
                            {order.paymentStatus && <span className="payment-status">{order.paymentStatus}</span>}
                            <span className={`status-badge status-${order.orderStatus.replace(/\s+/g, '-').toLowerCase()}`}>
                              {order.orderStatus.charAt(0).toUpperCase() + order.orderStatus.slice(1)}
                            </span>
                          </div>
                        </div>

                        <div className="order-compact-info">
                          <p><strong>Customer:</strong> {order.customerName || 'N/A'}</p>
                          <p className="order-timestamp">Placed: {formatDate(order.createdAt)}</p>
                          {order.orderType === 'delivery' && order.assignedDriverId && (
                              <p className="assigned-driver-info">
                                  <FaTruck /> Assigned To: {availableDrivers.find(d => d.id === order.assignedDriverId)?.displayName || 'Unknown Driver'}
                                  ({order.driverAssignmentStatus || 'N/A'})
                                  {order.deliveryStatus && <span className="delivery-status-badge"> - {order.deliveryStatus.replace(/_/g, ' ')}</span>}
                              </p>
                          )}
                        </div>

                        <p className="order-total-compact">
                          Total: ₹{order.totalAmount ? order.totalAmount.toFixed(2) : '0.00'}
                        </p>
                      </div>

                      {/* Admin Actions based on order status */}
                      {isAdmin && (
                        <div className="order-actions-row">
                            {/* Actions for Pending Orders */}
                            {order.orderStatus === 'pending' && (
                                <>
                                    <button
                                        className="action-button primary-action"
                                        onClick={(e) => { e.stopPropagation(); handleStatusChange(order.id, 'accepted'); }}
                                        disabled={updatingStatus[order.id]}
                                    >
                                        {updatingStatus[order.id] ? <FaSpinner className="spinner" /> : 'Accept Order'}
                                    </button>
                                    <button
                                        className="action-button cancel-button"
                                        onClick={(e) => { e.stopPropagation(); handleStatusChange(order.id, 'cancelled'); }}
                                        disabled={updatingStatus[order.id]}
                                    >
                                        {updatingStatus[order.id] ? <FaSpinner className="spinner" /> : 'Reject Order'} {/* Changed to Reject */}
                                    </button>
                                </>
                            )}

                            {/* Actions for Accepted Orders */}
                            {order.orderStatus === 'accepted' && (
                                <button
                                    className="action-button primary-action"
                                    onClick={(e) => { e.stopPropagation(); handleStatusChange(order.id, 'preparing'); }}
                                    disabled={updatingStatus[order.id]}
                                >
                                    {updatingStatus[order.id] ? <FaSpinner className="spinner" /> : 'Mark Preparing'}
                                </button>
                            )}

                            {/* Actions for Preparing Delivery Orders (Assign Driver) */}
                            {order.orderStatus === 'preparing' && order.orderType === 'delivery' && !order.assignedDriverId && (
                                <div className="driver-assign-section">
                                    <select
                                        value={selectedDriverForAssignment}
                                        onChange={(e) => setSelectedDriverForAssignment(e.target.value)}
                                        className="driver-select"
                                        disabled={assigningDriver[order.id] || availableDrivers.length === 0}
                                    >
                                        <option value="">Select Driver</option>
                                        {availableDrivers.length === 0 ? (
                                            <option value="" disabled>No drivers available</option>
                                        ) : (
                                            availableDrivers.map(driver => (
                                                <option key={driver.id} value={driver.id}>{driver.displayName || driver.email}</option>
                                            ))
                                        )}
                                    </select>
                                    <button
                                        className="action-button secondary-action"
                                        onClick={(e) => { e.stopPropagation(); handleAssignDriver(order.id, selectedDriverForAssignment); }}
                                        disabled={assigningDriver[order.id] || !selectedDriverForAssignment}
                                    >
                                        {assigningDriver[order.id] ? <FaSpinner className="spinner" /> : 'Assign'}
                                    </button>
                                </div>
                            )}

                            {/* Actions for Preparing Pickup Orders */}
                            {order.orderStatus === 'preparing' && order.orderType === 'pickup' && (
                                <button
                                    className="action-button primary-action"
                                    onClick={(e) => { e.stopPropagation(); handleStatusChange(order.id, 'ready for pickup'); }}
                                    disabled={updatingStatus[order.id]}
                                >
                                    {updatingStatus[order.id] ? <FaSpinner className="spinner" /> : 'Mark Ready for Pickup'}
                                </button>
                            )}

                            {/* Admin Re-assign driver option for assigned orders */}
                            {(order.orderStatus === 'assigned for delivery' || order.orderStatus === 'picked up' || order.orderStatus === 'on the way') && order.assignedDriverId && (
                                <div className="driver-assign-section reassign">
                                    <select
                                        value={selectedDriverForAssignment || order.assignedDriverId}
                                        onChange={(e) => setSelectedDriverForAssignment(e.target.value)}
                                        className="driver-select"
                                        disabled={assigningDriver[order.id] || availableDrivers.length === 0}
                                    >
                                        <option value="">Select Driver (Re-assign)</option>
                                        {availableDrivers.length === 0 ? (
                                            <option value="" disabled>No drivers available</option>
                                        ) : (
                                            availableDrivers.map(driver => (
                                                <option key={driver.id} value={driver.id}>{driver.displayName || driver.email}</option>
                                            ))
                                        )}
                                    </select>
                                    <button
                                        className="action-button secondary-action"
                                        onClick={(e) => { e.stopPropagation(); handleAssignDriver(order.id, selectedDriverForAssignment); }}
                                        disabled={assigningDriver[order.id] || !selectedDriverForAssignment || selectedDriverForAssignment === order.assignedDriverId}
                                    >
                                        {assigningDriver[order.id] ? <FaSpinner className="spinner" /> : 'Re-assign'}
                                    </button>
                                </div>
                            )}

                            {/* Admin Mark Complete for Delivery or Pickup */}
                            {(order.orderStatus === 'ready for pickup' || order.orderStatus === 'delivered') && (
                                <button
                                    className="action-button complete-button"
                                    onClick={(e) => { e.stopPropagation(); handleStatusChange(order.id, 'completed'); }}
                                    disabled={updatingStatus[order.id]}
                                >
                                    {updatingStatus[order.id] ? <FaSpinner className="spinner" /> : 'Mark Complete'}
                                </button>
                            )}

                            {/* Admin can always cancel any non-closed order */}
                            {!['completed', 'cancelled', 'refunded'].includes(order.orderStatus) && (
                                <button
                                    className="action-button cancel-button"
                                    onClick={(e) => { e.stopPropagation(); handleStatusChange(order.id, 'cancelled'); }}
                                    disabled={updatingStatus[order.id]}
                                >
                                    {updatingStatus[order.id] ? <FaSpinner className="spinner" /> : 'Cancel Order'}
                                </button>
                            )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Full Order Details Modal (Conditionally Rendered) */}
      {isDetailsModalOpen && selectedOrder && (
        <div className="order-details-modal-overlay">
          <div className="order-details-modal-content">
            <button className="modal-close-button" onClick={handleCloseDetails}>&times;</button>
            <h3>Order Details: #{selectedOrder.id.substring(0, 8)}...</h3>

            <div className="order-details-section">
              <h4>Customer Information</h4>
              <p><strong>Name:</strong> {selectedOrder.customerName || 'N/A'}</p>
              <p><strong>Email:</strong> {selectedOrder.customerEmail || 'N/A'}</p>
              <p><strong>Phone:</strong> {selectedOrder.customerPhone || 'N/A'}</p>
            </div>

            <div className="order-details-section">
              <h4>Order Type: {selectedOrder.orderType || 'N/A'}</h4>
              {selectedOrder.orderType === 'delivery' && selectedOrder.deliveryAddress ? (
                <>
                  <p>
                    <strong>Address:</strong> {selectedOrder.deliveryAddress.street}, {selectedOrder.deliveryAddress.city}, {selectedOrder.deliveryAddress.zipCode}
                    {selectedOrder.deliveryAddress.latitude && selectedOrder.deliveryAddress.longitude && (
                        <a
                            href={getMapLink(selectedOrder.deliveryAddress)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="map-link"
                        >
                            (View on Map)
                        </a>
                    )}
                  </p>
                  {selectedOrder.deliveryAddress.notes && <p><strong>Notes:</strong> {selectedOrder.deliveryAddress.notes}</p>}
                </>
              ) : (
                selectedOrder.orderType === 'pickup' && <p>Customer will pick up the order.</p>
              )}
            </div>

            {/* Display Assigned Driver in Modal */}
            {selectedOrder.orderType === 'delivery' && (
                <div className="order-details-section">
                    <h4>Delivery Assignment</h4>
                    {selectedOrder.assignedDriverId ? (
                        <>
                            <p><strong>Assigned To:</strong> {availableDrivers.find(d => d.id === selectedOrder.assignedDriverId)?.displayName || 'Unknown Driver'}</p>
                            <p><strong>Assignment Status:</strong> {selectedOrder.driverAssignmentStatus || 'N/A'}</p>
                            <p><strong>Delivery Status:</strong> {selectedOrder.deliveryStatus ? selectedOrder.deliveryStatus.replace(/_/g, ' ') : 'Pending Pickup'}</p>
                            {/* Admin can re-assign from modal too */}
                            {isAdmin && (
                                <div className="driver-assign-section modal-reassign">
                                    <select
                                        value={selectedDriverForAssignment || selectedOrder.assignedDriverId}
                                        onChange={(e) => setSelectedDriverForAssignment(e.target.value)}
                                        className="driver-select"
                                        disabled={assigningDriver[selectedOrder.id] || availableDrivers.length === 0}
                                    >
                                        <option value="">Select Driver (Re-assign)</option>
                                        {availableDrivers.length === 0 ? (
                                            <option value="" disabled>No drivers available</option>
                                        ) : (
                                            availableDrivers.map(driver => (
                                                <option key={driver.id} value={driver.id}>{driver.displayName || driver.email}</option>
                                            ))
                                        )}
                                    </select>
                                    <button
                                        className="action-button secondary-action"
                                        onClick={() => handleAssignDriver(selectedOrder.id, selectedDriverForAssignment)}
                                        disabled={assigningDriver[selectedOrder.id] || !selectedDriverForAssignment || selectedDriverForAssignment === selectedOrder.assignedDriverId}
                                    >
                                        {assigningDriver[selectedOrder.id] ? <FaSpinner className="spinner" /> : 'Re-assign'}
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        isAdmin ? ( // Only show assign dropdown if no driver and admin
                            <div className="driver-assign-section">
                                <select
                                    value={selectedDriverForAssignment}
                                    onChange={(e) => setSelectedDriverForAssignment(e.target.value)}
                                    className="driver-select"
                                    disabled={assigningDriver[selectedOrder.id] || availableDrivers.length === 0}
                                >
                                    <option value="">Select Driver</option>
                                    {availableDrivers.length === 0 ? (
                                        <option value="" disabled>No drivers available</option>
                                    ) : (
                                        availableDrivers.map(driver => (
                                            <option key={driver.id} value={driver.id}>{driver.displayName || driver.email}</option>
                                        ))
                                    )}
                                </select>
                                <button
                                    className="action-button secondary-action"
                                    onClick={() => handleAssignDriver(selectedOrder.id, selectedDriverForAssignment)}
                                    disabled={assigningDriver[selectedOrder.id] || !selectedDriverForAssignment}
                                >
                                    {assigningDriver[selectedOrder.id] ? <FaSpinner className="spinner" /> : 'Assign'}
                                </button>
                            </div>
                        ) : (
                            <p>No driver assigned yet.</p>
                        )
                    )}
                </div>
            )}


            <div className="order-details-section">
              <h4>Order Items</h4>
              <ul>
                {selectedOrder.orderItems && selectedOrder.orderItems.length > 0 ? (
                  selectedOrder.orderItems.map((item, index) => (
                    <li key={index}>
                      <span>{item.quantity}x {item.name}</span>
                      <span>₹{(item.price * item.quantity).toFixed(2)}</span>
                    </li>
                  ))
                ) : (
                  <li>No items listed.</li>
                )}
              </ul>
            </div>

            <div className="order-details-section">
              <h4>Summary & Payment</h4>
              <p><strong>Subtotal:</strong> ₹{selectedOrder.subtotal ? selectedOrder.subtotal.toFixed(2) : '0.00'}</p>
              <p><strong>Delivery Fee:</strong> ₹{selectedOrder.deliveryFee ? selectedOrder.deliveryFee.toFixed(2) : '0.00'}</p>
              <p><strong>Total Amount:</strong> ₹{selectedOrder.totalAmount ? selectedOrder.totalAmount.toFixed(2) : '0.00'}</p>
              <p><strong>Payment Status:</strong> {selectedOrder.paymentStatus || 'N/A'}</p>
              <p><strong>Payment Method:</strong> {selectedOrder.paymentMethod || 'N/A'}</p>
              <p><strong>Placed On:</strong> {formatDate(selectedOrder.createdAt)}</p>
              {selectedOrder.updatedAt && <p><strong>Last Updated:</strong> {formatDate(selectedOrder.updatedAt)}</p>}
            </div>

            {isAdmin && ( // Only Admins can change status via this dropdown
                <div className="order-status-management">
                <label htmlFor={`modal-status-${selectedOrder.id}`}>Update Status:</label>
                <select
                    id={`modal-status-${selectedOrder.id}`}
                    value={selectedOrder.orderStatus}
                    onChange={(e) => handleStatusChange(selectedOrder.id, e.target.value)}
                    disabled={updatingStatus[selectedOrder.id]}
                    className={`status-select status-${selectedOrder.orderStatus.replace(/\s+/g, '-').toLowerCase()}`}
                >
                    {ORDER_FLOW_STATUSES.map(status => ( // Use ORDER_FLOW_STATUSES for modal dropdown
                    <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</option>
                    ))}
                </select>
                {updatingStatus[selectedOrder.id] && <FaSpinner className="spinner updating-spinner-icon" />}
                </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdersManagement;
