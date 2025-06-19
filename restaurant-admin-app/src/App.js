// restaurant-admin-app/src/App.js

import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import {
  signInWithPopup,
  onAuthStateChanged,
  signOut,
  signInWithCustomToken,
  signInWithEmailAndPassword
} from 'firebase/auth';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from './firebaseConfig';

// Import the AppContent component
import AppContent from './components/AppContent';

// --- CRUCIAL CSS IMPORTS ---
import './Styles/variables.css';
import './App.css';


const App = () => {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const [managedRestaurantID, setManagedRestaurantID] = useState(null); // This will be the definitive restaurant ID for admins
  const [isLoadingRole, setIsLoadingRole] = useState(false);
  const [appError, setAppError] = useState(null); // Corrected: removed extra ')' here

  // State for login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');


  // NOTE: DEFAULT_RESTAURANT_ID_PLACEHOLDER is purely for initial setup guidance in the UI.
  // For admin users, the actual restaurantID for app operations MUST come from managedRestaurantID.
  const DEFAULT_RESTAURANT_ID_PLACEHOLDER = "6rMFucaeuCOpaLbs0wwyijMvDln2";


  useEffect(() => {
    // Load external JavaScript libraries for PDF generation (html2canvas and jspdf)
    const loadScript = (src, id) => {
      if (document.getElementById(id)) {
        console.log(`${id} already loaded.`);
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.id = id;
      script.onload = () => console.log(`${id} loaded successfully.`);
      script.onerror = () => console.error(`Failed to load script: ${src}`);
      document.head.appendChild(script);
    };

    loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', 'html2canvas-script');
    loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', 'jspdf-script');


    // Set up Firebase Authentication state listener
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        console.log("Auth State Changed: User logged in:", currentUser.email, currentUser.uid);
        setUser(currentUser);
        setIsLoadingRole(true);
        setAppError(null);

        if (!currentUser.isAnonymous) {
          const userDocRef = doc(db, 'users', currentUser.uid);
          try {
            const userDocSnap = await getDoc(userDocRef);

            if (userDocSnap.exists()) {
              const userData = userDocSnap.data();
              setUserRole(userData.role);
              setManagedRestaurantID(userData.managedRestaurantId || null); // Fetch managedRestaurantId from user's document
              console.log("User role from Firestore:", userData.role);
              console.log("Managed Restaurant ID (from user doc):", userData.managedRestaurantId || "Not assigned");
            } else {
              // User logged in, but no Firestore user document. Create it.
              console.warn("User document not found for non-anonymous user. Creating with default 'customer' role.");
              await setDoc(userDocRef, {
                  email: currentUser.email,
                  uid: currentUser.uid,
                  displayName: currentUser.displayName || currentUser.email.split('@')[0],
                  photoURL: currentUser.photoURL || '',
                  role: 'customer', // Default to customer if no role is found.
                  createdAt: Timestamp.now(),
                  // managedRestaurantId will be null for new customers
              }, { merge: true });
              setUserRole('customer');
              setManagedRestaurantID(null);
            }
          } catch (error) {
            console.error("Error fetching user role or creating default user document:", error);
            setAppError("Failed to fetch user role or create profile. Check database permissions.");
            setUserRole(null);
            setManagedRestaurantID(null);
          } finally {
            setIsLoadingRole(false);
          }
        } else {
          console.log("Anonymous user detected. Access denied for admin panel.");
          setUser(null);
          setUserRole(null);
          setManagedRestaurantID(null);
          setIsLoadingRole(false);
          setAppError("Anonymous access is not allowed for the admin panel. Please sign in.");
          signOut(auth); // Sign out anonymous user immediately for admin panel
        }

      } else {
        console.log("Auth State Changed: User logged out or no user.");
        setUser(null);
        setUserRole(null);
        setManagedRestaurantID(null);
        setAppError(null);
        setIsLoadingRole(false);
      }
      setLoadingAuth(false);
    });

    // Handle Canvas environment specific authentication (using initial token)
    const handleCanvasAuth = async () => {
      if (typeof window.__initial_auth_token !== 'undefined' && window.__initial_auth_token) {
        try {
          await signInWithCustomToken(auth, window.__initial_auth_token);
        } catch (error) {
          console.error("Firebase custom token sign-in failed:", error);
          setLoginError("Custom authentication token failed. Please sign in with email/password or Google.");
        }
      }
    };
    handleCanvasAuth();

    return () => unsubscribe();
  }, []);

  const handleEmailPasswordSignIn = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      setLoginEmail('');
      setLoginPassword('');
    } catch (error) {
      let errorMessage = "Login failed. Please check your credentials.";
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMessage = "Invalid email or password.";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "Please enter a valid email address.";
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = "Network error. Please check your internet connection.";
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = "Too many login attempts. Please try again later.";
      }
      console.error("Email/Password Sign-In Error:", error.message);
      setLoginError(errorMessage);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoginError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      let errorMessage = "Google Sign-In failed. Please try again.";
      if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = "Sign-in popup closed. Please try again.";
      } else if (error.code === 'auth/cancelled-popup-request') {
        errorMessage = "Sign-in already in progress. Please wait a moment.";
      } else if (error.code === 'auth/account-exists-with-different-credential') {
        errorMessage = "An account with this email already exists using a different sign-in method. Try logging in with email/password or another method.";
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = "Network error. Please check your internet connection.";
      }
      console.error("Google Sign-In Error:", error.message);
      setLoginError(errorMessage);
    }
  };

  const handleLogout = async () => {
    try {
      setAppError(null);
      await signOut(auth);
    } catch (error) {
      console.error("Logout Error:", error.message);
      setAppError(`Logout Failed: ${error.message}. Please try again.`);
    }
  };

  if (loadingAuth) {
    return (
      <div className="App">
        <div className="loading-screen">
          <h1>Loading Admin App...</h1>
          <p>Authenticating your session...</p>
        </div>
      </div>
    );
  }

  // Determine the restaurantID to pass. For admins, it MUST come from their managedRestaurantID.
  // If an admin doesn't have one, they are not "authorized" for a specific restaurant yet.
  const currentRestaurantIdForApp = (userRole === 'admin' && managedRestaurantID)
                                    ? managedRestaurantID
                                    : null; // Explicitly null if not a managing admin

  // A user is considered authenticated and authorized if they are logged in,
  // their role has been loaded, and that role is 'admin', AND they have a managedRestaurantID.
  // If they are admin but no managedRestaurantID, they'll see a specific message on the login screen.
  const isAuthenticatedAndAuthorizedAdmin = user && !isLoadingRole && userRole === 'admin' && currentRestaurantIdForApp;


  return (
    <Router>
      <div className="App">
        {isAuthenticatedAndAuthorizedAdmin ? (
          // Pass both db and auth as props to AppContent
          <AppContent
            user={user}
            isLoadingRole={isLoadingRole}
            userRole={userRole}
            restaurantID={currentRestaurantIdForApp} // Pass the explicitly managed ID
            auth={auth}
            handleGoogleSignIn={handleGoogleSignIn}
            handleLogout={handleLogout}
            appError={appError}
            db={db}
          />
        ) : (
          <div className="auth-prompt login-page">
            <h2 className="login-title">Admin Panel Login</h2>
            {appError && <p className="error-message">{appError}</p>}
            {loginError && <p className="error-message">{loginError}</p>}

            {/* Display specific message for admins without a managedRestaurantID */}
            {user && userRole === 'admin' && !managedRestaurantID && !isLoadingRole && (
                <p className="error-message">
                    Your admin account is not yet assigned to a restaurant. Please contact support or the super admin to set your 'managedRestaurantId' in your user profile in Firestore.
                </p>
            )}

            <form onSubmit={handleEmailPasswordSignIn} className="login-form">
              <input
                type="email"
                placeholder="Email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
                className="login-input"
              />
              <input
                type="password"
                placeholder="Password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                className="login-input"
              />
              <button type="submit" className="btn login-btn">Login with Email</button>
            </form>
            <div className="login-divider">OR</div>
            <button onClick={handleGoogleSignIn} className="btn google-signin-btn">
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google icon" className="google-icon" />
              Login with Google
            </button>
            <p className="access-info">Only authorized administrators can access this panel.</p>
            {!user && <p className="access-info initial-setup">
                <br/>
                For initial setup: If you are the first admin, please sign in. Then, manually set your role to 'admin' AND 'managedRestaurantId' (e.g., 'your-restaurant-id') in Firebase Firestore's 'users' collection for your user ID. You also need to create a document in 'resturent/your-restaurant-id' yourself.
            </p>}
          </div>
        )}
      </div>
    </Router>
  );
};

export default App;
