// src/firebaseConfig.js

// Import the core Firebase App initialization function
import { initializeApp } from "firebase/app";

// Import the specific Firebase services you need
// 'getAuth' for Firebase Authentication
// 'GoogleAuthProvider' for Google Sign-in
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// 'getFirestore' for Firestore Database
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
// This is the object you provided, correctly pasted here:
const firebaseConfig = {
  apiKey: "AIzaSyD6bKaU3IbjiJt31t5edAJKtUc9iZyJlyo",
  authDomain: "posrsm-da1de.firebaseapp.com",
  projectId: "posrsm-da1de",
  storageBucket: "posrsm-da1de.firebasestorage.app",
  messagingSenderId: "916918199712",
  appId: "1:916918199712:web:816de69988416288b070c5"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize and EXPORT Firebase services so they can be used in other files (like App.js)
export const auth = getAuth(app);              // For Authentication
export const db = getFirestore(app);            // For Firestore Database
export const googleProvider = new GoogleAuthProvider(); // For Google Sign-in functionality