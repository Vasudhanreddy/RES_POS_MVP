// restaurant-customer-app/src/components/Cart.js

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useCart } from '../context/CartContext';
import AddressInputWithGeolocation from './AddressInputWithGeolocation';
import './Cart.css';

const Cart = ({ user, restaurantID }) => {
  const {
    cartItems,
    addToCart,
    removeFromCart,
    removeItemCompletely,
    clearCart,
    cartTotalAmount
  } = useCart();

  const [showThankYouMessage, setShowThankYouMessage] = useState(false);
  const [orderError, setOrderError] = useState(null); // General order error
  const [inputErrors, setInputErrors] = useState({}); // Specific input field errors
  const [isProcessingOrder, setIsProcessingOrder] = useState(false);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');

  const [deliveryAddress, setDeliveryAddress] = useState({
    street: '',
    city: '',
    state: '',
    zipCode: '',
    country: '',
    lat: null,
    lng: null,
    notes: ''
  });

  const [adminTaxRate, setAdminTaxRate] = useState(0);
  const [adminDeliveryFee, setAdminDeliveryFee] = useState(0);
  // NEW: State for restaurant's location and delivery radius
  const [restaurantLocation, setRestaurantLocation] = useState({ lat: null, lng: null });
  const [deliveryRadiusKm, setDeliveryRadiusKm] = useState(0);
  // NEW: State to store whether admin allows out-of-range orders
  const [allowOutOfRangeOrders, setAllowOutOfRangeOrders] = useState(false);
  const [fetchingSettings, setFetchingSettings] = useState(true);

  // Calculate fees and totals
  const subtotal = parseFloat(cartTotalAmount.toFixed(2));
  const taxAmount = parseFloat(((subtotal * adminTaxRate) / 100).toFixed(2)); // Tax rate is a percentage, so divide by 100
  const totalAmount = parseFloat((subtotal + taxAmount + adminDeliveryFee).toFixed(2));

  // Haversine formula to calculate distance between two lat/lng points
  const calculateDistance = useCallback((lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of Earth in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in km
    return distance;
  }, []);

  // Check if delivery is within range or if out-of-range is allowed
  const isDeliveryWithinRange = useMemo(() => {
    // If admin explicitly allows out-of-range orders, bypass distance check
    if (allowOutOfRangeOrders) {
      return true;
    }

    // If settings are still fetching, or critical location data is missing, assume not within range
    if (fetchingSettings || !restaurantLocation.lat || !restaurantLocation.lng || !deliveryAddress.lat || !deliveryAddress.lng || deliveryRadiusKm <= 0) {
      // If deliveryRadiusKm is 0 or less, effectively means no delivery range, so always out of range
      return false;
    }

    const distance = calculateDistance(
      restaurantLocation.lat,
      restaurantLocation.lng,
      deliveryAddress.lat,
      deliveryAddress.lng
    );

    console.log(`Calculated distance: ${distance.toFixed(2)} km. Allowed: ${deliveryRadiusKm} km.`);
    return distance <= deliveryRadiusKm;
  }, [fetchingSettings, restaurantLocation, deliveryRadiusKm, deliveryAddress, calculateDistance, allowOutOfRangeOrders]);

  // Effect to fetch admin settings (tax rate, delivery fee, restaurant location, delivery radius, allowOutOfRangeOrders)
  useEffect(() => {
    const fetchSettings = async () => {
      if (!restaurantID) {
        setOrderError("Restaurant ID is missing, cannot fetch settings.");
        setFetchingSettings(false);
        return;
      }
      try {
        const settingsDocRef = doc(db, 'resturent', restaurantID, 'settings', 'invoice_settings');
        const settingsSnap = await getDoc(settingsDocRef);

        if (settingsSnap.exists()) {
          const data = settingsSnap.data();
          setAdminTaxRate(data.defaultTaxRate !== undefined ? parseFloat(data.defaultTaxRate) : 0);
          setAdminDeliveryFee(data.defaultDeliveryFee !== undefined ? parseFloat(data.defaultDeliveryFee) : 0);
          setDeliveryRadiusKm(data.deliveryRadiusKm !== undefined ? parseFloat(data.deliveryRadiusKm) : 0);
          setRestaurantLocation({
            lat: data.restaurantAddress?.lat || null,
            lng: data.restaurantAddress?.lng || null
          });
          // NEW: Fetch allowOutOfRangeOrders setting
          setAllowOutOfRangeOrders(data.allowOutOfRangeOrders || false);
          console.log("Fetched Admin Settings:", data);
        } else {
          console.warn("Invoice settings document not found for this restaurant. Using default values.");
          setAdminTaxRate(0);
          setAdminDeliveryFee(0);
          setDeliveryRadiusKm(0); // If no settings, default to 0 radius (no delivery)
          setRestaurantLocation({ lat: null, lng: null });
          setAllowOutOfRangeOrders(false); // Default to false if settings not found
        }
      } catch (err) {
        console.error("Error fetching admin settings:", err);
        setOrderError("Failed to fetch restaurant settings. Please try again.");
      } finally {
        setFetchingSettings(false);
      }
    };

    fetchSettings();
  }, [restaurantID]);

  // Pre-fill name and email from user profile
  useEffect(() => {
    if (user) {
      setCustomerName(user.displayName || '');
      setCustomerEmail(user.email || '');
    } else {
      setCustomerName('');
      setCustomerEmail('');
    }
  }, [user]);

  // Handler for address changes from AddressInputWithGeolocation component
  const handleDeliveryAddressChange = (newAddress) => {
    setDeliveryAddress(newAddress);
    // Clear delivery range error if address changes
    setOrderError(prevError => {
      if (prevError && prevError.includes("outside our delivery range")) {
        return null;
      }
      return prevError;
    });
    // Clear address-related input errors on change
    setInputErrors(prev => ({
      ...prev,
      street: '', city: '', zipCode: '', country: '', location: ''
    }));
  };

  // Generic input change handler to clear specific errors
  const handleInputChange = (e) => {
    const { id, value } = e.target;
    if (id === 'customerName') {
      setCustomerName(value);
      setInputErrors(prev => ({ ...prev, customerName: '' }));
    } else if (id === 'customerPhone') {
      setCustomerPhone(value);
      setInputErrors(prev => ({ ...prev, customerPhone: '' }));
    }
  };


  const handleCheckout = async () => {
    setOrderError(null); // Clear general error at start
    setInputErrors({}); // Clear all specific input errors at start
    setIsProcessingOrder(true);
    setShowThankYouMessage(false);

    if (cartItems.length === 0) {
      setOrderError("Your cart is empty. Please add items before checking out.");
      setIsProcessingOrder(false);
      return;
    }

    if (!user) {
      setOrderError("You must be logged in to place an order.");
      setIsProcessingOrder(false);
      return;
    }
    
    if (fetchingSettings) {
      setOrderError("Still loading restaurant settings. Please wait a moment.");
      setIsProcessingOrder(false);
      return;
    }

    // Detailed Validation for all required delivery fields
    let errors = {};
    if (!customerName.trim()) {
      errors.customerName = "Please enter your name.";
    }
    if (!customerPhone.trim() || !/^\d{10}$/.test(customerPhone.trim())) {
      errors.customerPhone = "Please enter a valid 10-digit phone number.";
    }
    if (!deliveryAddress.street.trim()) {
      errors.street = "Please enter your Street Address.";
    }
    if (!deliveryAddress.city.trim()) {
      errors.city = "Please enter your City.";
    }
    if (!deliveryAddress.zipCode.trim()) {
      errors.zipCode = "Please enter your Zip Code.";
    }
    if (!deliveryAddress.country.trim()) {
      errors.country = "Please enter your Country.";
    }

    // Validate restaurant location settings completeness unless out-of-range orders are allowed
    if (!allowOutOfRangeOrders && (!restaurantLocation.lat || !restaurantLocation.lng || deliveryRadiusKm <= 0)) {
        errors.location = "Restaurant delivery settings are incomplete. Cannot determine delivery range. Please contact support.";
    }

    // Validate customer location if out-of-range orders are NOT allowed
    if (!allowOutOfRangeOrders && (!deliveryAddress.lat || !deliveryAddress.lng)) {
        errors.location = "Please use the 'Use My Current Location' button or ensure a valid address with coordinates is provided.";
    }

    // Final check for delivery range *if* out-of-range orders are NOT allowed
    if (!allowOutOfRangeOrders && (deliveryAddress.lat && deliveryAddress.lng) && !isDeliveryWithinRange) {
        // Updated error message as requested
        errors.location = `Sorry, we don't serve your location.`;
    }

    if (Object.keys(errors).length > 0) {
      setInputErrors(errors);
      setOrderError("Please Fill all the fields correctly"); // General summary error
      setIsProcessingOrder(false);
      return;
    }

    try {
      const itemsForFirestore = cartItems.map(item => ({
        menuItemId: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        subtotal: parseFloat((item.price * item.quantity).toFixed(2)),
      }));

      const orderData = {
        restaurantId: restaurantID,
        userId: user.uid,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail,

        orderItems: itemsForFirestore,

        subtotal: subtotal,
        taxRate: adminTaxRate,
        taxAmount: taxAmount,
        deliveryFee: adminDeliveryFee,
        totalAmount: totalAmount,

        orderStatus: 'pending',
        orderType: 'delivery',
        paymentStatus: 'unpaid',
        paymentMethod: 'cash_on_delivery',

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),

        deliveryAddress: {
          street: deliveryAddress.street.trim(),
          line2: deliveryAddress.state.trim(),
          city: deliveryAddress.city.trim(),
          zipCode: deliveryAddress.zipCode.trim(),
          country: deliveryAddress.country.trim(),
          lat: deliveryAddress.lat,
          lng: deliveryAddress.lng,
          notes: deliveryAddress.notes.trim(),
        },
      };

      await addDoc(collection(db, 'resturent', restaurantID, 'orders'), orderData);
      
      clearCart();

      // Reset contact and delivery address states for next order
      setCustomerName(user.displayName || '');
      setCustomerPhone('');
      setDeliveryAddress({
        street: '', city: '', state: '', zipCode: '', country: '', lat: null, lng: null, notes: ''
      });

      setShowThankYouMessage(true);
      setTimeout(() => setShowThankYouMessage(false), 5000);

    } catch (error) {
      console.error("Error placing order:", error);
      setOrderError("Failed to place order. Please try again. " + error.message);
    } finally {
      setIsProcessingOrder(false);
    }
  };

  if (showThankYouMessage) {
    return (
      <div className="cart-container thank-you-message-container">
        <h2>Thank You for Your Order!</h2>
        <p>Your order has been placed successfully and is now pending restaurant confirmation.</p>
        <button onClick={() => setShowThankYouMessage(false)} className="btn primary-btn">
          Back to Cart / Continue Shopping
        </button>
      </div>
    );
  }

  // Determine if the "Place Order" button should be disabled
  // Button is disabled if processing, cart empty, or settings fetching.
  // The delivery range check now provides a message but doesn't disable the button.
  const isPlaceOrderDisabled = isProcessingOrder || cartItems.length === 0 || fetchingSettings;

  return (
    <div className="cart-container">
      <h3>Your Cart</h3>
      {restaurantID && <p className="restaurant-id-display">Ordering from Restaurant ID: {restaurantID}</p>}
      {orderError && <p className="error-message">{orderError}</p>}
      {fetchingSettings && <p className="info-message">Loading restaurant settings...</p>}


      {cartItems.length === 0 ? (
        <p className="empty-cart-message">Your cart is empty.</p>
      ) : (
        <>
          <ul className="cart-items-list">
            {cartItems.map((item) => (
              <li key={item.id} className="cart-item">
                <span className="item-name">{item.name}</span>
                <div className="quantity-controls">
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="btn quantity-btn"
                    disabled={item.quantity <= 1}
                  >
                    -
                  </button>
                  <span className="item-quantity">{item.quantity}</span>
                  <button
                    onClick={() => addToCart(item)}
                    className="btn quantity-btn"
                  >
                    +
                  </button>
                </div>
                <span className="item-price">₹{(item.price * item.quantity).toFixed(2)}</span>
                <button
                  onClick={() => removeItemCompletely(item.id)}
                  className="btn danger-btn remove-item-btn"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <div className="cart-summary">
            <div className="summary-line">
              <span>Subtotal:</span>
              <span>₹{subtotal.toFixed(2)}</span>
            </div>
            {adminTaxRate > 0 && (
              <div className="summary-line">
                <span>Tax ({adminTaxRate * 100}%):</span> {/* Display as percentage */}
                <span>₹{taxAmount.toFixed(2)}</span>
              </div>
            )}
            {adminDeliveryFee > 0 && (
              <div className="summary-line">
                <span>Delivery Fee:</span>
                <span>₹{adminDeliveryFee.toFixed(2)}</span>
              </div>
            )}
            <h4 className="final-total">Total: ₹{totalAmount.toFixed(2)}</h4>

            <div className="delivery-details-section">
              <h4>Contact Information</h4>
              <div className="form-group">
                <label htmlFor="customerName">Name:</label>
                <input
                  type="text"
                  id="customerName"
                  value={customerName}
                  onChange={handleInputChange} // Use generic handler
                  placeholder="Enter your name"
                  required
                  className={inputErrors.customerName ? 'input-error-field' : ''} // Add error class
                />
                {inputErrors.customerName && <p className="input-error-message">{inputErrors.customerName}</p>}
              </div>
              <div className="form-group">
                <label htmlFor="customerPhone">Phone Number:</label>
                <input
                  type="tel"
                  id="customerPhone"
                  value={customerPhone}
                  onChange={handleInputChange} // Use generic handler
                  placeholder="e.g., 9876543210"
                  required
                  className={inputErrors.customerPhone ? 'input-error-field' : ''}
                />
                {inputErrors.customerPhone && <p className="input-error-message">{inputErrors.customerPhone}</p>}
              </div>
              <div className="form-group">
                <label>Email:</label>
                <p className="read-only-field">{customerEmail}</p>
              </div>
            </div>

            <AddressInputWithGeolocation
              onAddressChange={handleDeliveryAddressChange}
              initialAddress={deliveryAddress}
              // Pass inputErrors related to address components
              inputErrors={inputErrors}
            />
            {/* Display specific delivery range/location error or success message */}
            {deliveryAddress.lat && deliveryAddress.lng && !fetchingSettings && (
                !allowOutOfRangeOrders ? ( // Only show messages if out-of-range orders are NOT allowed
                    isDeliveryWithinRange ? (
                        <p className="success-message">
                            Yayyy! Expect your order soon! We deliver to your location.
                        </p>
                    ) : (
                        // Updated error message as requested
                        <p className="error-message">
                            Sorry, we don't serve your location.
                        </p>
                    )
                ) : (
                    <p className="info-message">
                        Delivery range restrictions are currently disabled.
                    </p>
                )
            )}
            {/* Display other location errors (e.g., if lat/lng are missing for validation) */}
            {inputErrors.location && !inputErrors.location.includes("Sorry, we don't serve your location.") && (
                <p className="error-message">
                    {inputErrors.location}
                </p>
            )}


            <button
              onClick={handleCheckout}
              className="btn success-btn checkout-btn"
              disabled={isPlaceOrderDisabled}
            >
              {isProcessingOrder ? 'Processing...' : 'Place Order'}
            </button>
            <button
              onClick={clearCart}
              className="btn secondary-btn clear-cart-btn"
            >
              Clear Cart
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default Cart;
