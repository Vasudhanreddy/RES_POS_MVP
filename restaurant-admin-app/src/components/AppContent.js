// restaurant-admin-app/src/components/AppContent.js

import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'firebase/auth'; // Removed getAuth as it's not directly used here
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore'; // Removed getFirestore as it's not directly used here

// Import Font Awesome icons used in this component
import { FaSpinner } from 'react-icons/fa';

// Import your page components
import Dashboard from './Dashboard';
import MenuList from './MenuList';
import OrdersManagement from './OrdersManagement';
import AdminProfile from './AdminProfile';
import AdminOrderHistory from './AdminOrderHistory';
import AdminOrderInvoice from './AdminOrderInvoice';
import AdminManagement from './AdminManagement';
import CouponManagement from './CouponManagement';
import DriverDashboard from './DriverDashboard'; // NEW: Import DriverDashboard

// IMPORTANT: Replace this with your actual restaurant ID or fetch it dynamically
// For this example, we'll hardcode it as per previous discussions for the admin app's scope.
const DEFAULT_RESTAURANT_ID = "6rMFucaeuCOpaLbs0wwyijMvDln2";

const AppContent = ({ db, auth }) => {
  const navigate = useNavigate();

  // State to hold the Firebase Auth user object, enriched with Firestore profile data
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true); // For initial Firebase Auth loading
  const [userRole, setUserRole] = useState(null);
  const [restaurantID, setRestaurantID] = useState(DEFAULT_RESTAURANT_ID); // Default, will be updated by user data
  const [appError, setAppError] = useState(null); // For general app-level errors

  // Effect to listen for Firebase Auth state changes and fetch user profile from Firestore
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      setIsLoadingAuth(true);
      setAppError(null);
      if (authUser) {
        // User is signed in, now fetch their custom profile data from Firestore
        const userDocRef = doc(db, 'users', authUser.uid);
        try {
          const userDocSnap = await getDoc(userDocRef);
          let userProfileData = {};

          if (userDocSnap.exists()) {
            userProfileData = userDocSnap.data();
            console.log("AppContent: User profile data from Firestore:", userProfileData);
          } else {
            console.warn("AppContent: User document not found in Firestore for UID:", authUser.uid, ". Creating default profile.");
            // If user document doesn't exist (e.g., first login, or created via Auth only)
            // Create a basic user document with a default role.
            userProfileData = {
              email: authUser.email,
              displayName: authUser.displayName || authUser.email.split('@')[0],
              role: 'customer', // Default role for new users
              createdAt: Timestamp.now(), // Firestore Timestamp
              updatedAt: Timestamp.now()
            };
            await setDoc(userDocRef, userProfileData, { merge: true });
          }

          // Combine Auth user data with Firestore profile data
          const combinedUser = {
            uid: authUser.uid,
            email: authUser.email,
            displayName: authUser.displayName || userProfileData.displayName,
            photoURL: authUser.photoURL,
            // Spread Firestore custom data including 'role' and 'managedRestaurantId'
            ...userProfileData
          };

          setUser(combinedUser);
          setUserRole(combinedUser.role);
          // Crucial: Set restaurantID from user profile, if not default.
          // For drivers, this 'managedRestaurantId' will link them to a specific restaurant's orders.
          setRestaurantID(combinedUser.managedRestaurantId || DEFAULT_RESTAURANT_ID);

        } catch (error) {
          console.error("AppContent: Error fetching user Firestore profile or creating default:", error);
          setAppError(`Failed to load user profile: ${error.message}. Please check Firestore. ` +
                      `If this is a new user, ensure security rules allow document creation.`);
          setUser(null); // Clear user if profile load fails
          setUserRole(null);
          setRestaurantID(DEFAULT_RESTAURANT_ID);
        }
      } else {
        // User is signed out
        setUser(null);
        setUserRole(null);
        setRestaurantID(DEFAULT_RESTAURANT_ID);
        console.log("AppContent: User signed out.");
      }
      setIsLoadingAuth(false);
    });

    // Clean up the auth state listener when the component unmounts
    return () => unsubscribe();
  }, [auth, db]);


  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      // onAuthStateChanged listener will handle setting user state
    } catch (error) {
      console.error("Error during Google Sign-In:", error);
      setAppError(`Google Sign-In failed: ${error.message}`);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // onAuthStateChanged listener will handle clearing user state
      navigate('/'); // Redirect to home or login after logout
    } catch (error) {
      console.error("Error during logout:", error);
      setAppError(`Logout failed: ${error.message}`);
    }
  };


  // Show loading screen while Firebase Auth and Firestore profile are loading
  if (isLoadingAuth) {
    return (
      <div className="loading-screen">
        <h1>Loading Application...</h1>
        <p>Initializing authentication and user profile...</p>
        <FaSpinner className="spinner-icon" />
      </div>
    );
  }

  // Determine if the user is authorized for the admin panel or driver panel
  const isAuthorizedAdmin = ['admin', 'super_admin'].includes(userRole) && restaurantID;
  const isAuthorizedDriver = userRole === 'driver' && user && user.uid && restaurantID; // Ensure driver has UID and associated restaurant

  // If user is not logged in or not authorized for any specific role
  if (!user || (!isAuthorizedAdmin && !isAuthorizedDriver)) {
    return (
      <div className="unauthorized-screen">
        <h1>Access Denied</h1>
        <p>You must be logged in as an authorized user to access this application.</p>
        {appError && <p className="error-message">{appError}</p>}
        {user && (
            <p>Your role ({userRole || 'not assigned / loading'}) does not have sufficient privileges for this application, or your restaurant ID is missing.</p>
        )}
        {user && !restaurantID && (userRole === 'admin' || userRole === 'super_admin' || userRole === 'driver') && <p>Restaurant ID not assigned or loaded for your account. Please contact support or set it in your profile.</p>}
        {user && <button onClick={handleLogout} className="btn logout-btn">Logout</button>}
        {!user && auth && <button onClick={handleGoogleSignIn} className="btn">Login</button>} {/* Generic login button */}
      </div>
    );
  }

  // If authenticated and is an admin or super_admin, show the admin application content
  if (isAuthorizedAdmin) {
    return (
      <>
        <header className="admin-app-header">
          <nav className="navbar">
            <Link to="/" className="nav-brand">
              Admin Panel
            </Link>
            <div className="nav-links">
              <Link to="/" className="nav-item">Dashboard</Link>
              <Link to="/menu-management" className="nav-item">Menu</Link>
              <Link to="/orders-management" className="nav-item">Orders</Link>
              { ['admin', 'super_admin'].includes(userRole) && restaurantID && (
                  <Link to="/admin-management" className="nav-item">Admin Management</Link>
              )}
              { ['admin', 'super_admin'].includes(userRole) && restaurantID && (
                  <Link to="/coupons" className="nav-item">Coupons</Link>
              )}
              <Link to="/profile" className="nav-item">Profile</Link>
            </div>
            <div className="auth-section">
              <span className="user-info">Welcome, {user.displayName || user.email}! ({userRole})</span>
              <button onClick={handleLogout} className="btn logout-btn">Logout</button>
            </div>
          </nav>
        </header>

        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard restaurantID={restaurantID} db={db} />} />
            <Route path="/menu-management" element={<MenuList restaurantID={restaurantID} db={db} />} />
            <Route path="/orders-management" element={<OrdersManagement restaurantID={restaurantID} db={db} userRole={userRole} userUID={user.uid} />} /> {/* Pass userRole & userUID for admin actions */}
            <Route path="/profile" element={<AdminProfile user={user} restaurantID={restaurantID} auth={auth} db={db}/>} />
            <Route path="/admin-order-history" element={<AdminOrderHistory restaurantID={restaurantID} db={db} />} />
            <Route path="/admin-order-history/:orderId" element={<AdminOrderInvoice restaurantID={restaurantID} db={db} />} />
            <Route path="/admin-management" element={<AdminManagement db={db} auth={auth} user={user} />} />
            <Route
              path="/coupons"
              element={<CouponManagement db={db} restaurantID={restaurantID} userRole={userRole} />}
            />
            {/* Fallback route for unmatched paths */}
            <Route path="*" element={<Dashboard restaurantID={restaurantID} db={db} />} />
          </Routes>
        </main>
      </>
    );
  }

  // If authenticated and is a driver, show the driver application content
  if (isAuthorizedDriver) {
    return (
      <>
        <header className="driver-app-header"> {/* Use a different header class for styling */}
          <nav className="navbar">
            <Link to="/driver-dashboard" className="nav-brand">
              Driver Panel
            </Link>
            <div className="nav-links">
              <Link to="/driver-dashboard" className="nav-item">My Deliveries</Link>
              <Link to="/profile" className="nav-item">Profile</Link> {/* Drivers can also access their profile */}
            </div>
            <div className="auth-section">
              <span className="user-info">Welcome, {user.displayName || user.email}! ({userRole})</span>
              <button onClick={handleLogout} className="btn logout-btn">Logout</button>
            </div>
          </nav>
        </header>

        <main className="main-content">
          <Routes>
            {/* Driver Dashboard is the default route for drivers */}
            <Route
              path="/driver-dashboard"
              element={<DriverDashboard db={db} restaurantID={restaurantID} driverId={user.uid} />}
            />
            {/* Drivers can also view their profile to update details if needed */}
            <Route path="/profile" element={<AdminProfile user={user} restaurantID={restaurantID} auth={auth} db={db}/>} />
            {/* Fallback route for unmatched paths for drivers */}
            <Route path="*" element={<DriverDashboard db={db} restaurantID={restaurantID} driverId={user.uid} />} />
          </Routes>
        </main>
      </>
    );
  }

  // This part should ideally not be reached if previous checks are thorough
  return (
    <div className="unauthorized-screen">
      <h1>Unexpected State</h1>
      <p>An unexpected state occurred. Please try logging in again or contact support.</p>
      {user && <button onClick={handleLogout} className="btn logout-btn">Logout</button>}
      {!user && auth && <button onClick={handleGoogleSignIn} className="btn">Login</button>}
    </div>
  );
};

export default AppContent;
