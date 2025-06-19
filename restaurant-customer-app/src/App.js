// restaurant-customer-app/src/App.js

import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from './firebaseConfig';
import { CartProvider, useCart } from './context/CartContext';
import CustomerMenu from './components/CustomerMenu';
import Cart from './components/Cart';
import Orders from './components/Orders';
import OrderDetails from './components/OrderDetails';
import './App.css';

// Component for Cart Icon in Navbar
const CartIcon = () => {
  const { cartTotalItems } = useCart();
  
  return (
    <Link to="/cart" className="cart-icon-link">
      🛒 <span className="cart-item-count">{cartTotalItems}</span>
    </Link>
  );
};

const App = () => {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const [isLoadingRole, setIsLoadingRole] = useState(false);

  // Define the customer-specific restaurant ID. This ID must match
  // the 'restaurantId' field in your Firestore orders and products,
  // and the ID used in your Firebase Security Rules for 'resturent' collection.
  const CUSTOMER_RESTAURANT_ID = "6rMFucaeuCOpaLbs0wwyijMvDln2";

  useEffect(() => {
    // Set up Firebase Authentication state listener
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // User is logged in
        setUser(currentUser);
        setIsLoadingRole(true); // Start loading user role

        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          // If user document exists, get their role
          const userData = userDocSnap.data();
          setUserRole(userData.role);
        } else {
          // If user document does not exist, create it with 'customer' role
          // This ensures all authenticated users get a 'customer' role by default
          await setDoc(userDocRef, {
            email: currentUser.email,
            uid: currentUser.uid,
            role: 'customer', // Default role for customer app users
            createdAt: new Date(),
            displayName: currentUser.displayName || '',
            photoURL: currentUser.photoURL || '',
          });
          setUserRole('customer');
        }
        setIsLoadingRole(false); // Finished loading user role

      } else {
        // User is logged out
        setUser(null);
        setUserRole(null);
        setIsLoadingRole(false);
      }
      setLoadingAuth(false); // Finished initial authentication check
    });

    // Cleanup function to unsubscribe from the listener when the component unmounts
    return () => unsubscribe();
  }, []); // Empty dependency array means this effect runs once on mount

  // Handles Google Sign-In using Firebase Authentication
  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      // User is automatically set by the onAuthStateChanged listener
    } catch (error) {
      console.error("Google Sign-In Error:", error.message);
      // You might want to display a user-friendly message here (e.g., a toast notification)
    }
  };

  // Handles user logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      // User is automatically set to null by the onAuthStateChanged listener
    } catch (error) {
      console.error("Logout Error:", error.message);
      // You might want to display a user-friendly message here
    }
  };

  // Display a loading screen while authentication status is being checked
  if (loadingAuth) {
    return (
      <div className="App">
        <div className="loading-screen">
          <h1>Loading Customer App...</h1>
          <p>Please wait while we initialize your session.</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <CartProvider> {/* Provides cart context to all child components */}
        <div className="App">
          <header className="App-header">
            {/* Restaurant Logo and Name on the left */}
            <div className="header-left">
              {/* Using a placeholder image URL for the logo. You can replace this with your actual logo. */}
              <img src="https://placehold.co/40x40/edce7a/c98c9a?text=R" alt="Restaurant Logo" className="restaurant-logo" />
              <span className="restaurant-name">Taste Trail</span> {/* Example Restaurant Name */}
            </div>

            {/* User Info, Logout, and Cart Icon on the right */}
            <div className="header-right">
              {user && ( // Only show user info and logout if a user is logged in
                <div className="user-info">
                  <span>Welcome, {user.displayName || user.email}!</span>
                  <button onClick={handleLogout} className="btn logout-btn">Logout</button>
                </div>
              )}
              {/* Cart icon is always visible, but cart functionality might be limited when not logged in */}
              <CartIcon />
            </div>
          </header>

          <main className="App-main">
            <Routes>
              {/* Route for the main menu page - NOW PUBLICLY ACCESSIBLE */}
              <Route
                path="/"
                element={
                  // Menu is now visible to everyone, regardless of login status
                  <CustomerMenu restaurantID={CUSTOMER_RESTAURANT_ID} user={user} />
                }
              />

              {/* Route for the shopping cart page - Requires customer role */}
              <Route
                path="/cart"
                element={
                  user && !isLoadingRole && userRole === 'customer' ? (
                    <Cart restaurantID={CUSTOMER_RESTAURANT_ID} user={user} />
                  ) : (
                    <div className="auth-prompt">
                      <h2>Access Denied</h2>
                      <p>Please sign in as a customer to view your cart.</p>
                      {!user && <button onClick={handleGoogleSignIn} className="btn google-signin-btn large-btn">Sign In with Google</button>}
                    </div>
                  )
                }
              />

              {/* Route for the customer's order history page - Requires customer role */}
              <Route
                path="/orders"
                element={
                  user && !isLoadingRole && userRole === 'customer' ? (
                    <Orders user={user} restaurantID={CUSTOMER_RESTAURANT_ID} />
                  ) : (
                    <div className="auth-prompt">
                      <h2>Access Denied</h2>
                      <p>Please sign in as a customer to view your orders.</p>
                      {!user && <button onClick={handleGoogleSignIn} className="btn google-signin-btn large-btn">Sign In with Google</button>}
                    </div>
                  )
                }
              />
              
              {/* Route for individual Order Details page - Requires customer role */}
              <Route
                path="/orders/:orderId" 
                element={
                  user && !isLoadingRole && userRole === 'customer' ? (
                    <OrderDetails restaurantID={CUSTOMER_RESTAURANT_ID} />
                  ) : (
                    <div className="auth-prompt">
                      <h2>Access Denied</h2>
                      <p>Please sign in as a customer to view order details.</p>
                      {!user && <button onClick={handleGoogleSignIn} className="btn google-signin-btn large-btn">Sign In with Google</button>}
                    </div>
                  )
                }
              />

              {/* Fallback route for any undefined paths */}
              <Route path="*" element={<h2>404: Page Not Found</h2>} />
            </Routes>
          </main>

          {/* Bottom Navigation Bar */}
          <nav className="bottom-nav">
            <Link to="/">Menu</Link>
            <Link to="/cart">Cart🛒</Link>
            <Link to="/orders">Orders</Link>
          </nav>
        </div>
      </CartProvider>
    </Router>
  );
};

export default App;
