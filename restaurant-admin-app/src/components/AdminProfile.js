// restaurant-admin-app/src/components/AdminProfile.js

import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { updateProfile, updatePassword } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import './AdminProfile.css';
import {
  FaUserCircle, FaEnvelope, FaTag, FaTools, FaBuilding, FaMapMarkerAlt,
  FaPercent, FaTruck, FaPhone, FaSave, FaEdit, FaTimes, FaSpinner, FaCheckCircle, FaTimesCircle, FaExclamationCircle, FaGlobe, FaInfoCircle
} from 'react-icons/fa';


// AdminProfile component now accepts `user`, `auth`, and `db` as props
const AdminProfile = ({ user, restaurantID, auth, db }) => {
  const navigate = useNavigate();

  const [profileData, setProfileData] = useState({
    displayName: '',
    email: '',
    role: '',
    managedRestaurantId: ''
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [errorProfile, setErrorProfile] = useState(null); // Initialized with null
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [profileMessage, setProfileMessage] = useState('');
  const [isProfileSuccess, setIsProfileSuccess] = useState(false);

  // Invoice Settings States (primarily for general restaurant info and invoice defaults)
  const [invoiceSettings, setInvoiceSettings] = useState({
    restaurantName: '',
    restaurantAddress: { street: '', line2: '', city: '', state: '', zipCode: '', country: '', lat: null, lng: null, notes: '' },
    taxRate: 0.05,
    deliveryFee: 50, // This delivery fee is the DEFAULT base fee
    restaurantEmail: '',
    restaurantPhone: ''
  });
  const [isEditingInvoiceSettings, setIsEditingInvoiceSettings] = useState(false);
  const [loadingInvoiceSettings, setLoadingInvoiceSettings] = useState(true);
  const [errorInvoiceSettings, setErrorInvoiceSettings] = useState(null); // Initialized with null
  const [isSavingInvoiceSettings, setIsSavingInvoiceSettings] = useState(false);
  const [invoiceSettingsSaveError, setInvoiceSettingsSaveError] = useState('');

  // Delivery Settings States (specifically for radius, in/out zone, and out-of-zone fee)
  const [deliverySettings, setDeliverySettings] = useState({
    deliveryRadiusKm: 5, // Default 5 km - for free delivery range
    inZoneDeliveryEnabled: true,
    outZoneDeliveryEnabled: false,
    outZoneDeliveryFee: 100, // Default fee if out-of-zone is enabled
    allowOutOfRangeOrders: false, // NEW FIELD: Allow customers outside set deliveryRadiusKm to order
  });
  const [isEditingDeliverySettings, setIsEditingDeliverySettings] = useState(false);
  const [loadingDeliverySettings, setLoadingDeliverySettings] = useState(true);
  const [errorDeliverySettings, setErrorDeliverySettings] = useState(null); // Initialized with null
  const [isSavingDeliverySettings, setIsSavingDeliverySettings] = useState(false);
  const [deliverySettingsSaveError, setDeliverySettingsSaveError] = useState('');


  // Geolocation specific states
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [geolocationError, setGeolocationError] = useState(null); // Initialized with null


  // --- Fetch User Profile Data ---
  useEffect(() => {
    if (!user || !user.uid || !db) {
      setErrorProfile("User not authenticated or Firestore not initialized.");
      setLoadingProfile(false);
      return;
    }

    const userDocRef = doc(db, 'users', user.uid);
    const fetchProfile = async () => {
      setLoadingProfile(true);
      setErrorProfile(null);
      try {
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setProfileData({
            displayName: data.displayName || user.displayName || '',
            email: data.email || user.email || '',
            role: data.role || 'N/A',
            managedRestaurantId: data.managedRestaurantId || 'N/A'
          });
        } else {
          setProfileData({
            displayName: user.displayName || '',
            email: user.email || '',
            role: 'customer', // Default role if user doc doesn't exist
            managedRestaurantId: restaurantID // Or 'N/A' if not managing a restaurant
          });
          console.warn("User document not found for current user. Using Firebase Auth data and default role.");
        }
      } catch (err) {
        console.error("Error fetching profile data:", err);
        setErrorProfile("Failed to load profile. Please try again.");
      } finally {
        setLoadingProfile(false);
      }
    };

    fetchProfile();
  }, [user, db, restaurantID]);

  // --- Fetch Invoice Settings ---
  useEffect(() => {
    if (!restaurantID || !db) {
      setErrorInvoiceSettings("Restaurant ID or Firestore is missing. Cannot load invoice settings.");
      setLoadingInvoiceSettings(false);
      return;
    }

    // Invoice settings are stored in 'invoice_settings' document
    const settingsDocRef = doc(db, 'resturent', restaurantID, 'settings', 'invoice_settings');
    const fetchInvoiceSettings = async () => {
      setLoadingInvoiceSettings(true);
      setErrorInvoiceSettings(null);
      try {
        const docSnap = await getDoc(settingsDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setInvoiceSettings({
            restaurantName: data.restaurantName || '',
            restaurantAddress: data.restaurantAddress || { street: '', line2: '', city: '', state: '', zipCode: '', country: '', lat: null, lng: null, notes: '' },
            taxRate: data.defaultTaxRate !== undefined ? parseFloat(data.defaultTaxRate) : 0.05,
            deliveryFee: data.defaultDeliveryFee !== undefined ? parseFloat(data.defaultDeliveryFee) : 50,
            restaurantEmail: data.restaurantEmail || '',
            restaurantPhone: data.restaurantPhone || ''
          });
          console.log("Fetched invoice settings:", data);
        } else {
          console.log("No invoice settings found for this restaurant. Using defaults.");
          setInvoiceSettings({
            restaurantName: 'Your Restaurant',
            restaurantAddress: { street: '', line2: '', city: '', state: '', zipCode: '', country: '', lat: null, lng: null, notes: '' },
            taxRate: 0.05,
            deliveryFee: 50,
            restaurantEmail: '',
            restaurantPhone: ''
          });
        }
      } catch (err) {
        console.error("Error fetching invoice settings:", err);
        setErrorInvoiceSettings("Failed to load invoice settings. Please try again.");
      } finally {
        setLoadingInvoiceSettings(false);
      }
    };

    fetchInvoiceSettings();
  }, [restaurantID, db]);


  // --- Fetch Delivery Settings ---
  useEffect(() => {
    if (!restaurantID || !db) {
      setErrorDeliverySettings("Restaurant ID or Firestore is missing. Cannot load delivery settings.");
      setLoadingDeliverySettings(false);
      return;
    }

    // Delivery specific settings are stored in 'delivery_settings' document
    const deliverySettingsDocRef = doc(db, 'resturent', restaurantID, 'settings', 'delivery_settings');
    const fetchDeliverySettings = async () => {
      setLoadingDeliverySettings(true);
      setErrorDeliverySettings(null);
      try {
        const docSnap = await getDoc(deliverySettingsDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setDeliverySettings({
            deliveryRadiusKm: data.deliveryRadiusKm !== undefined ? parseFloat(data.deliveryRadiusKm) : 5,
            inZoneDeliveryEnabled: data.inZoneDeliveryEnabled !== undefined ? data.inZoneDeliveryEnabled : true,
            outZoneDeliveryEnabled: data.outZoneDeliveryEnabled !== undefined ? data.outZoneDeliveryEnabled : false,
            outZoneDeliveryFee: data.outZoneDeliveryFee !== undefined ? parseFloat(data.outZoneDeliveryFee) : 100,
            allowOutOfRangeOrders: data.allowOutOfRangeOrders !== undefined ? data.allowOutOfRangeOrders : false, // FETCH NEW FIELD
          });
          console.log("Fetched delivery settings:", data);
        } else {
          console.log("No delivery settings found for this restaurant. Using defaults.");
          setDeliverySettings({
            deliveryRadiusKm: 5,
            inZoneDeliveryEnabled: true,
            outZoneDeliveryEnabled: false,
            outZoneDeliveryFee: 100,
            allowOutOfRangeOrders: false, // Default for NEW FIELD
          });
        }
      } catch (err) {
        console.error("Error fetching delivery settings:", err);
        setErrorDeliverySettings("Failed to load delivery settings. Please try again.");
      } finally {
        setLoadingDeliverySettings(false);
      }
    };

    fetchDeliverySettings();
  }, [restaurantID, db]);


  // --- Handlers for User Profile ---
  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileData(prev => ({ ...prev, [name]: value }));
  };

  const handlePasswordChange = (e) => {
    setNewPassword(e.target.value);
  };

  const handleSaveProfile = async () => {
    if (!user || !user.uid || !db || !auth) return;
    setIsSavingProfile(true);
    setProfileMessage('');
    setIsProfileSuccess(false);

    try {
      // 1. Update Firebase Auth display name
      if (user.displayName !== profileData.displayName) {
        await updateProfile(user, { displayName: profileData.displayName });
        console.log("Firebase Auth profile display name updated.");
      }

      // 2. Update password if provided
      if (newPassword) {
        if (newPassword.length < 6) {
          throw new Error("Password must be at least 6 characters long.");
        }
        await updatePassword(auth.currentUser, newPassword);
        console.log("Firebase Auth password updated.");
        setNewPassword(''); // Clear password field after successful update
      }

      // 3. Update Firestore user document for audit and consistency
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, {
        displayName: profileData.displayName,
        updatedAt: Timestamp.now(),
        lastUpdatedBy: { uid: user.uid, email: user.email }
      }, { merge: true });

      setIsEditingProfile(false);
      setProfileMessage("Profile updated successfully!");
      setIsProfileSuccess(true);
      console.log("Profile data saved to Firestore.");
    } catch (err) {
      console.error("Error saving profile:", err);
      setProfileMessage(`Failed to save profile: ${err.message}. Please re-authenticate if changing password.`);
      setIsProfileSuccess(false);
    } finally {
      setIsSavingProfile(false);
    }
  };

  // --- Handlers for Invoice Settings ---
  const handleInvoiceSettingsChange = (e) => {
    const { name, value } = e.target;
    setInvoiceSettings(prev => ({ ...prev, [name]: value }));
    setInvoiceSettingsSaveError('');
  };

  // Handler for changes in restaurant address fields
  const handleRestaurantAddressChange = (e) => {
    const { name, value } = e.target;
    setInvoiceSettings(prev => ({
      ...prev,
      restaurantAddress: {
        ...prev.restaurantAddress,
        [name]: value
      }
    }));
    setInvoiceSettingsSaveError('');
  };

  const handleTaxRateChange = (e) => {
    const value = e.target.value;
    if (value === '' || (!isNaN(value) && parseFloat(value) >= 0 && parseFloat(value) <= 1)) {
        setInvoiceSettings(prev => ({ ...prev, taxRate: value === '' ? '' : parseFloat(value) }));
    }
    setInvoiceSettingsSaveError('');
  };

  const handleDeliveryFeeChange = (e) => {
    const value = e.target.value;
    if (value === '' || (!isNaN(value) && parseFloat(value) >= 0)) {
        setInvoiceSettings(prev => ({ ...prev, deliveryFee: value === '' ? '' : parseFloat(value) }));
    }
    setInvoiceSettingsSaveError('');
  };

  const handleUseCurrentLocation = () => {
    setGeolocationError(null);
    setLoadingLocation(true);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          console.log("Geolocation obtained:", latitude, longitude);
          try {
            const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`;
            const response = await fetch(nominatimUrl, {
              headers: {
                'User-Agent': 'RestaurantAdminApp/1.0 (your-contact-email@example.com)',
                'Referer': window.location.origin
              }
            });

            if (!response.ok) {
              if (response.status === 403) {
                 throw new Error("Geolocation service denied access (403 Forbidden). Check Nominatim usage policy.");
              }
              throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log("Nominatim API response:", data);

            const addressDetails = data.address || {};
            const newAddress = {
              street: addressDetails.road || addressDetails.building || data.display_name.split(',')[0].trim() || '',
              line2: addressDetails.suburb || addressDetails.county || '',
              city: addressDetails.city || addressDetails.town || addressDetails.village || '',
              state: addressDetails.state || '',
              zipCode: addressDetails.postcode || '',
              country: addressDetails.country || '',
              lat: latitude,
              lng: longitude,
              notes: invoiceSettings.restaurantAddress.notes
            };

            setInvoiceSettings(prev => ({ ...prev, restaurantAddress: newAddress }));
            setInvoiceSettingsSaveError('');
          } catch (err) {
            console.error("Error during reverse geocoding:", err);
            setGeolocationError(`Could not get a readable address. ${err.message || 'Please enter manually.'}`);
          } finally {
            setLoadingLocation(false);
          }
        },
        (geoError) => {
          setLoadingLocation(false);
          console.error("Geolocation failed:", geoError);
          let errorMessage = "Could not get your location.";
          switch (geoError.code) {
            case geoError.PERMISSION_DENIED:
              errorMessage += " Please allow location access in your browser settings.";
              break;
            case geoError.POSITION_UNAVAILABLE:
              errorMessage += " Location information is unavailable.";
              break;
            case geoError.TIMEOUT:
              errorMessage += " The request to get user location timed out.";
              break;
            default:
              errorMessage += " An unknown error occurred.";
          }
          setGeolocationError(errorMessage);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    } else {
      setLoadingLocation(false);
      setGeolocationError("Geolocation is not supported by your browser.");
    }
  };


  const handleSaveInvoiceSettings = async () => {
    if (!restaurantID || !db || !user) return;
    setIsSavingInvoiceSettings(true);
    setInvoiceSettingsSaveError('');
    try {
      const settingsDocRef = doc(db, 'resturent', restaurantID, 'settings', 'invoice_settings');

      const finalTaxRate = parseFloat(invoiceSettings.taxRate);
      const finalDeliveryFee = parseFloat(invoiceSettings.deliveryFee);

      if (isNaN(finalTaxRate) || finalTaxRate < 0 || finalTaxRate > 1) {
        setInvoiceSettingsSaveError("Tax rate must be a number between 0 and 1 (e.g., 0.05 for 5%).");
        setIsSavingInvoiceSettings(false);
        return;
      }
      if (isNaN(finalDeliveryFee) || finalDeliveryFee < 0) {
        setInvoiceSettingsSaveError("Default delivery fee must be a non-negative number.");
        setIsSavingInvoiceSettings(false);
        return;
      }
      if (!invoiceSettings.restaurantName.trim()) {
        setInvoiceSettingsSaveError("Restaurant Name cannot be empty.");
        setIsSavingInvoiceSettings(false);
        return;
      }
      if (!invoiceSettings.restaurantEmail.trim() || !invoiceSettings.restaurantEmail.includes('@')) {
        setInvoiceSettingsSaveError("Valid Restaurant Email is required.");
        setIsSavingInvoiceSettings(false);
        return;
      }
      if (!invoiceSettings.restaurantPhone.trim()) {
        setInvoiceSettingsSaveError("Restaurant Phone number is required.");
        setIsSavingInvoiceSettings(false);
        return;
      }
      if (!invoiceSettings.restaurantAddress.street.trim() || !invoiceSettings.restaurantAddress.city.trim() || !invoiceSettings.restaurantAddress.zipCode.trim()) {
        setInvoiceSettingsSaveError("Street, City, and Zip Code are required for the restaurant address.");
        setIsSavingInvoiceSettings(false);
        return;
      }


      await setDoc(settingsDocRef, {
        restaurantName: invoiceSettings.restaurantName,
        restaurantAddress: invoiceSettings.restaurantAddress,
        defaultTaxRate: finalTaxRate,
        defaultDeliveryFee: finalDeliveryFee, // This is the base delivery fee for calculation
        restaurantEmail: invoiceSettings.restaurantEmail,
        restaurantPhone: invoiceSettings.restaurantPhone,
        restaurantID: restaurantID, // Store restaurantID for easy lookup
        lastUpdated: Timestamp.now(),
        lastUpdatedBy: { uid: user.uid, email: user.email }
      }, { merge: true });
      setIsEditingInvoiceSettings(false);
      console.log("Invoice settings saved.");
    } catch (err) {
      console.error("Error saving invoice settings:", err);
      setInvoiceSettingsSaveError("Failed to save settings. " + err.message);
    } finally {
      setIsSavingInvoiceSettings(false);
    }
  };

  // --- Handlers for Delivery Settings ---
  const handleDeliverySettingsChange = (e) => {
    const { name, value, type, checked } = e.target;
    setDeliverySettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    setDeliverySettingsSaveError('');
  };

  const handleSaveDeliverySettings = async () => {
    if (!restaurantID || !db || !user) return;
    setIsSavingDeliverySettings(true);
    setDeliverySettingsSaveError('');

    try {
      const deliverySettingsDocRef = doc(db, 'resturent', restaurantID, 'settings', 'delivery_settings');

      const finalDeliveryRadiusKm = parseFloat(deliverySettings.deliveryRadiusKm);
      const finalOutZoneDeliveryFee = parseFloat(deliverySettings.outZoneDeliveryFee);

      if (isNaN(finalDeliveryRadiusKm) || finalDeliveryRadiusKm < 0) { // Radius can be 0 (no free delivery)
        setDeliverySettingsSaveError("Delivery radius must be a non-negative number.");
        setIsSavingDeliverySettings(false);
        return;
      }
      if (deliverySettings.outZoneDeliveryEnabled && (isNaN(finalOutZoneDeliveryFee) || finalOutZoneDeliveryFee < 0)) {
        setDeliverySettingsSaveError("Out-of-zone delivery fee must be a non-negative number if enabled.");
        setIsSavingDeliverySettings(false);
        return;
      }
      if (!deliverySettings.inZoneDeliveryEnabled && !deliverySettings.outZoneDeliveryEnabled && !deliverySettings.allowOutOfRangeOrders) {
          setDeliverySettingsSaveError("At least 'In-zone Delivery', 'Out-of-zone Delivery', or 'Allow Out-of-Range Orders' must be enabled.");
          setIsSavingDeliverySettings(false);
          return;
      }


      await setDoc(deliverySettingsDocRef, {
        deliveryRadiusKm: finalDeliveryRadiusKm,
        inZoneDeliveryEnabled: deliverySettings.inZoneDeliveryEnabled,
        outZoneDeliveryEnabled: deliverySettings.outZoneDeliveryEnabled,
        outZoneDeliveryFee: deliverySettings.outZoneDeliveryEnabled ? finalOutZoneDeliveryFee : 0, // Save 0 if disabled
        allowOutOfRangeOrders: deliverySettings.allowOutOfRangeOrders, // SAVE NEW FIELD
        restaurantID: restaurantID, // Store restaurantID for easy lookup
        lastUpdated: Timestamp.now(),
        lastUpdatedBy: { uid: user.uid, email: user.email }
      }, { merge: true });

      setIsEditingDeliverySettings(false);
      console.log("Delivery settings saved.");
    } catch (err) {
      console.error("Error saving delivery settings:", err);
      setDeliverySettingsSaveError("Failed to save delivery settings: " + err.message);
    } finally {
      setIsSavingDeliverySettings(false);
    }
  };


  // --- Handle Navigation to Admin Management Page ---
  const handleGoToAdminManagement = () => {
    navigate('/admin-management');
  };


  if (loadingProfile || loadingInvoiceSettings || loadingDeliverySettings) {
    return (
      <div className="admin-profile-container loading">
        <FaSpinner className="spinner-icon" />
        <p>Loading Profile and Settings...</p>
      </div>
    );
  }

  // Combined error rendering
  if (errorProfile || errorInvoiceSettings || errorDeliverySettings) {
    return (
      <div className="admin-profile-container error">
        {errorProfile && <p>{errorProfile}</p>}
        {errorInvoiceSettings && <p>{errorInvoiceSettings}</p>}
        {errorDeliverySettings && <p>{errorDeliverySettings}</p>}
      </div>
    );
  }

  return (
    <div className="admin-profile-container">
      <h2 className="admin-profile-title">Admin Profile & Settings</h2>

      {/* User Profile Card */}
      <div className="profile-card">
        <h3 className="card-title">Your Admin Profile</h3>
        <div className="profile-detail">
          <FaUserCircle className="profile-icon" />
          <div className="detail-content">
            <span className="detail-label">Display Name:</span>
            {isEditingProfile ? (
              <input
                type="text"
                name="displayName"
                value={profileData.displayName}
                onChange={handleProfileChange}
                className="edit-input"
                disabled={isSavingProfile}
              />
            ) : (
              <span className="detail-value">{profileData.displayName || 'N/A'}</span>
            )}
          </div>
        </div>

        <div className="profile-detail">
          <FaEnvelope className="profile-icon" />
          <div className="detail-content">
            <span className="detail-label">Email:</span>
            <span className="detail-value">{profileData.email || 'N/A'}</span>
          </div>
        </div>

        <div className="profile-detail">
          <FaTag className="profile-icon" />
          <div className="detail-content">
            <span className="detail-label">Role:</span>
            <span className="detail-value role-badge">{profileData.role || 'N/A'}</span>
          </div>
        </div>

        {profileData.managedRestaurantId && (
          <div className="profile-detail">
            <FaBuilding className="profile-icon" />
            <div className="detail-content">
              <span className="detail-label">Managed Restaurant ID:</span>
              <span className="detail-value">{profileData.managedRestaurantId}</span>
            </div>
          </div>
        )}

        {/* Password Edit Field */}
        <div className="profile-detail">
          <FaUserCircle className="profile-icon" />
          <div className="detail-content">
            <span className="detail-label">New Password (for your account):</span>
            {isEditingProfile ? (
              <input
                type="password"
                name="newPassword"
                value={newPassword}
                onChange={handlePasswordChange}
                className="edit-input"
                disabled={isSavingProfile}
                placeholder="Leave blank for no change"
              />
            ) : (
              <span className="detail-value">***********</span>
            )}
            {isEditingProfile && newPassword && newPassword.length < 6 && (
                <p className="form-help-text password-warning">Password must be at least 6 characters.</p>
            )}
             {isEditingProfile && (
                <p className="form-help-text">
                    You may need to re-authenticate after changing password.
                </p>
            )}
          </div>
        </div>


        <div className="settings-actions" style={{ justifyContent: 'flex-end', borderTop: 'none', paddingTop: 0 }}>
          {isEditingProfile ? (
            <>
              <button onClick={handleSaveProfile} className="action-button primary-action" disabled={isSavingProfile}>
                {isSavingProfile ? <FaSpinner className="small-spinner" /> : <FaSave />} Save Profile
              </button>
              <button onClick={() => { setIsEditingProfile(false); setNewPassword(''); setProfileMessage(''); setIsProfileSuccess(false); }} className="action-button cancel-button" disabled={isSavingProfile}>
                <FaTimes /> Cancel
              </button>
            </>
          ) : (
            <button onClick={() => setIsEditingProfile(true)} className="action-button edit-button">
              <FaEdit /> Edit Profile
            </button>
          )}
        </div>
        {profileMessage && (
            <p className={`message ${isProfileSuccess ? 'success' : 'error'}`}>
              {isProfileSuccess ? <FaCheckCircle /> : <FaTimesCircle />} {profileMessage}
            </p>
          )}
      </div>

      {/* Restaurant Invoice Settings Card */}
      <div className="profile-card restaurant-settings-card">
        <h3 className="card-title">Restaurant Invoice Settings</h3>
        <div className="profile-detail">
          <FaBuilding className="profile-icon" />
          <div className="detail-content">
            <span className="detail-label">Restaurant Name:</span>
            {isEditingInvoiceSettings ? (
              <input
                type="text"
                name="restaurantName"
                value={invoiceSettings.restaurantName}
                onChange={handleInvoiceSettingsChange}
                className="edit-input"
                disabled={isSavingInvoiceSettings}
              />
            ) : (
              <span className="detail-value">{invoiceSettings.restaurantName || 'N/A'}</span>
            )}
          </div>
        </div>

        {/* Integrated Address Fields */}
        <div className="restaurant-address-section">
            <h4 className="address-section-title"><FaMapMarkerAlt /> Restaurant Address</h4>
            {isEditingInvoiceSettings ? (
                <>
                    <div className="form-group">
                        <label htmlFor="street">Street Address</label>
                        <input
                            type="text"
                            id="street"
                            name="street"
                            value={invoiceSettings.restaurantAddress.street}
                            onChange={handleRestaurantAddressChange}
                            placeholder="e.g., 123 Main Street"
                            required
                            className="edit-input"
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="line2">Apartment/Suite (Optional)</label>
                        <input
                            type="text"
                            id="line2"
                            name="line2"
                            value={invoiceSettings.restaurantAddress.line2}
                            onChange={handleRestaurantAddressChange}
                            placeholder="e.g., Suite 101"
                            className="edit-input"
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="city">City</label>
                        <input
                            type="text"
                            id="city"
                            name="city"
                            value={invoiceSettings.restaurantAddress.city}
                            onChange={handleRestaurantAddressChange}
                            placeholder="e.g., Food City"
                            required
                            className="edit-input"
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="state">State/Province</label>
                        <input
                            type="text"
                            id="state"
                            name="state"
                            value={invoiceSettings.restaurantAddress.state}
                            onChange={handleRestaurantAddressChange}
                            placeholder="e.g., Karnataka"
                            className="edit-input"
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="zipCode">Zip Code</label>
                        <input
                            type="text"
                            id="zipCode"
                            name="zipCode"
                            value={invoiceSettings.restaurantAddress.zipCode}
                            onChange={handleRestaurantAddressChange}
                            placeholder="e.g., 12345"
                            required
                            className="edit-input"
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="country">Country</label>
                        <input
                            type="text"
                            id="country"
                            name="country"
                            value={invoiceSettings.restaurantAddress.country}
                            onChange={handleRestaurantAddressChange}
                            placeholder="e.g., India"
                            className="edit-input"
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="address-notes">Address Notes (Optional)</label>
                        <textarea
                            id="address-notes"
                            name="notes"
                            value={invoiceSettings.restaurantAddress.notes}
                            onChange={handleRestaurantAddressChange}
                            placeholder="e.g., Near ABC landmark"
                            rows="2"
                            className="edit-input"
                        ></textarea>
                    </div>

                    <button
                        type="button"
                        onClick={handleUseCurrentLocation}
                        className="use-location-btn"
                        disabled={loadingLocation || isSavingInvoiceSettings}
                    >
                        {loadingLocation ? (
                            <>
                                <FaSpinner className="spinner-icon" /> Getting Location...
                            </>
                        ) : (
                            <>
                                <FaMapMarkerAlt /> Use Current Location
                            </>
                        )}
                    </button>
                    {geolocationError && (
                        <p className="location-error">
                            <FaExclamationCircle /> {geolocationError}
                        </p>
                    )}
                </>
            ) : (
                <span className="detail-value">
                  {invoiceSettings.restaurantAddress.street || 'N/A'}{invoiceSettings.restaurantAddress.line2 && `, ${invoiceSettings.restaurantAddress.line2}`}<br/>
                  {invoiceSettings.restaurantAddress.city || 'N/A'}
                  {invoiceSettings.restaurantAddress.state && `, ${invoiceSettings.restaurantAddress.state}`}
                  {invoiceSettings.restaurantAddress.zipCode && `, ${invoiceSettings.restaurantAddress.zipCode}`}<br/>
                  {invoiceSettings.restaurantAddress.country && `(${invoiceSettings.restaurantAddress.country})`}<br/>
                  {invoiceSettings.restaurantAddress.notes && `Notes: ${invoiceSettings.restaurantAddress.notes}`}
                </span>
            )}
        </div>


        <div className="profile-detail">
          <FaPercent className="profile-icon" />
          <div className="detail-content">
            <span className="detail-label">Default Tax Rate:</span>
            {isEditingInvoiceSettings ? (
              <input
                type="number"
                step="0.01"
                name="taxRate"
                value={invoiceSettings.taxRate}
                onChange={handleTaxRateChange}
                className="edit-input"
                disabled={isSavingInvoiceSettings}
                placeholder="e.g., 0.05 for 5%"
              />
            ) : (
              <span className="detail-value">{(invoiceSettings.taxRate * 100).toFixed(2)}%</span>
            )}
          </div>
        </div>

        <div className="profile-detail">
          <FaTruck className="profile-icon" />
          <div className="detail-content">
            <span className="detail-label">Default Delivery Fee:</span>
            {isEditingInvoiceSettings ? (
              <input
                type="number"
                step="0.01"
                name="deliveryFee"
                value={invoiceSettings.deliveryFee}
                onChange={handleDeliveryFeeChange}
                className="edit-input"
                disabled={isSavingInvoiceSettings}
                placeholder="e.g., 50.00"
              />
            ) : (
              <span className="detail-value">₹{invoiceSettings.deliveryFee ? invoiceSettings.deliveryFee.toFixed(2) : '0.00'}</span>
            )}
          </div>
        </div>

        <div className="profile-detail">
          <FaEnvelope className="profile-icon" />
          <div className="detail-content">
            <span className="detail-label">Restaurant Email:</span>
            {isEditingInvoiceSettings ? (
              <input
                type="email"
                name="restaurantEmail"
                value={invoiceSettings.restaurantEmail}
                onChange={handleInvoiceSettingsChange}
                className="edit-input"
                disabled={isSavingInvoiceSettings}
                placeholder="info@restaurant.com"
              />
            ) : (
              <span className="detail-value">{invoiceSettings.restaurantEmail || 'N/A'}</span>
            )}
          </div>
        </div>

        <div className="profile-detail">
          <FaPhone className="profile-icon" />
          <div className="detail-content">
            <span className="detail-label">Restaurant Phone:</span>
            {isEditingInvoiceSettings ? (
              <input
                type="tel"
                name="restaurantPhone"
                value={invoiceSettings.restaurantPhone}
                onChange={handleInvoiceSettingsChange}
                className="edit-input"
                disabled={isSavingInvoiceSettings}
                placeholder="(123) 456-7890"
              />
            ) : (
              <span className="detail-value">{invoiceSettings.restaurantPhone || 'N/A'}</span>
            )}
          </div>
        </div>

        <div className="settings-actions">
          {isEditingInvoiceSettings ? (
            <>
              <button onClick={handleSaveInvoiceSettings} className="action-button primary-action" disabled={isSavingInvoiceSettings}>
                {isSavingInvoiceSettings ? <FaSpinner className="small-spinner" /> : <FaSave />} Save Settings
              </button>
              <button onClick={() => { setIsEditingInvoiceSettings(false); setInvoiceSettingsSaveError(''); }} className="action-button cancel-button" disabled={isSavingInvoiceSettings}>
                <FaTimes /> Cancel
              </button>
            </>
          ) : (
            <button onClick={() => setIsEditingInvoiceSettings(true)} className="action-button edit-button">
              <FaEdit /> Edit Settings
            </button>
          )}
        </div>
        {invoiceSettingsSaveError && <p className="error-message-inline">{invoiceSettingsSaveError}</p>}
      </div>

      {/* Restaurant Delivery Settings Card */}
      <div className="profile-card restaurant-settings-card">
        <h3 className="card-title"><FaGlobe /> Restaurant Delivery Settings</h3>
        <div className="profile-detail">
          <FaMapMarkerAlt className="profile-icon" />
          <div className="detail-content">
            <span className="detail-label">Free Delivery Radius (KM):</span>
            {isEditingDeliverySettings ? (
              <input
                type="number"
                step="0.1"
                name="deliveryRadiusKm"
                value={deliverySettings.deliveryRadiusKm}
                onChange={handleDeliverySettingsChange}
                className="edit-input"
                disabled={isSavingDeliverySettings}
                placeholder="e.g., 5.0"
              />
            ) : (
              <span className="detail-value">{deliverySettings.deliveryRadiusKm} KM</span>
            )}
            <p className="form-help-text"><FaInfoCircle /> Orders within this radius are eligible for free delivery.</p>
          </div>
        </div>

        <div className="profile-detail checkbox-detail">
          <div className="detail-content">
            <span className="detail-label">Enable In-Zone Delivery:</span>
            {isEditingDeliverySettings ? (
              <label className="switch">
                <input
                  type="checkbox"
                  name="inZoneDeliveryEnabled"
                  checked={deliverySettings.inZoneDeliveryEnabled}
                  onChange={handleDeliverySettingsChange}
                  disabled={isSavingDeliverySettings}
                />
                <span className="slider round"></span>
              </label>
            ) : (
              <span className="detail-value">
                {deliverySettings.inZoneDeliveryEnabled ? <FaCheckCircle className="success-icon" /> : <FaTimesCircle className="danger-icon" />}
                {deliverySettings.inZoneDeliveryEnabled ? ' Enabled' : ' Disabled'}
              </span>
            )}
             <p className="form-help-text"><FaInfoCircle /> Controls if orders within the free delivery radius are accepted.</p>
          </div>
        </div>

        <div className="profile-detail checkbox-detail">
          <div className="detail-content">
            <span className="detail-label">Enable Out-of-Zone Delivery:</span>
            {isEditingDeliverySettings ? (
              <label className="switch">
                <input
                  type="checkbox"
                  name="outZoneDeliveryEnabled"
                  checked={deliverySettings.outZoneDeliveryEnabled}
                  onChange={handleDeliverySettingsChange}
                  disabled={isSavingDeliverySettings}
                />
                <span className="slider round"></span>
              </label>
            ) : (
              <span className="detail-value">
                {deliverySettings.outZoneDeliveryEnabled ? <FaCheckCircle className="success-icon" /> : <FaTimesCircle className="danger-icon" />}
                {deliverySettings.outZoneDeliveryEnabled ? ' Enabled' : ' Disabled'}
              </span>
            )}
             <p className="form-help-text"><FaInfoCircle /> Controls if orders outside the free delivery radius are accepted (with additional fee).</p>
          </div>
        </div>

        {deliverySettings.outZoneDeliveryEnabled && (
          <div className="profile-detail">
            <FaTruck className="profile-icon" />
            <div className="detail-content">
              <span className="detail-label">Out-of-Zone Delivery Fee:</span>
              {isEditingDeliverySettings ? (
                <input
                  type="number"
                  step="0.01"
                  name="outZoneDeliveryFee"
                  value={deliverySettings.outZoneDeliveryFee}
                  onChange={handleDeliverySettingsChange}
                  className="edit-input"
                  disabled={isSavingDeliverySettings}
                  placeholder="e.g., 100.00"
                />
              ) : (
                <span className="detail-value">₹{deliverySettings.outZoneDeliveryFee ? deliverySettings.outZoneDeliveryFee.toFixed(2) : '0.00'}</span>
              )}
               <p className="form-help-text"><FaInfoCircle /> This fee applies to orders delivered outside the free delivery radius.</p>
            </div>
          </div>
        )}

        {/* NEW FIELD: Allow Out-of-Range Orders Checkbox */}
        <div className="profile-detail checkbox-detail">
          <div className="detail-content">
            <span className="detail-label">Allow Out-of-Range Orders (No Range Check):</span>
            {isEditingDeliverySettings ? (
              <label className="switch">
                <input
                  type="checkbox"
                  name="allowOutOfRangeOrders"
                  checked={deliverySettings.allowOutOfRangeOrders}
                  onChange={handleDeliverySettingsChange}
                  disabled={isSavingDeliverySettings}
                />
                <span className="slider round"></span>
              </label>
            ) : (
              <span className="detail-value">
                {deliverySettings.allowOutOfRangeOrders ? <FaCheckCircle className="success-icon" /> : <FaTimesCircle className="danger-icon" />}
                {deliverySettings.allowOutOfRangeOrders ? ' Enabled' : ' Disabled'}
              </span>
            )}
             <p className="form-help-text">
                 <FaInfoCircle /> If enabled, delivery range will not be checked. All orders will be accepted, applying the default delivery fee.
                 This overrides 'In-Zone' and 'Out-of-Zone' settings for range validation.
             </p>
          </div>
        </div>


        <div className="settings-actions">
          {isEditingDeliverySettings ? (
            <>
              <button onClick={handleSaveDeliverySettings} className="action-button primary-action" disabled={isSavingDeliverySettings}>
                {isSavingDeliverySettings ? <FaSpinner className="small-spinner" /> : <FaSave />} Save Delivery Settings
              </button>
              <button onClick={() => { setIsEditingDeliverySettings(false); setDeliverySettingsSaveError(''); }} className="action-button cancel-button" disabled={isSavingDeliverySettings}>
                <FaTimes /> Cancel
              </button>
            </>
          ) : (
            <button onClick={() => setIsEditingDeliverySettings(true)} className="action-button edit-button">
              <FaEdit /> Edit Delivery Settings
            </button>
          )}
        </div>
        {deliverySettingsSaveError && <p className="error-message-inline">{deliverySettingsSaveError}</p>}
      </div>

      {/* Admin Options Section - Now with Navigation Button */}
      {profileData.role === 'admin' || profileData.role === 'super_admin' ? ( // Condition to show this section
        <div className="admin-options-card">
          <h3 className="options-title"><FaTools /> Admin Management</h3>
          <p className="form-help-text">
              Manage other admin accounts (create, edit, delete) from a dedicated Admin Management page.
          </p>
          <div className="settings-actions" style={{ justifyContent: 'center', borderTop: 'none', paddingTop: 0 }}>
              <button onClick={handleGoToAdminManagement} className="action-button primary-action">
                  <FaTools /> Go to Admin Management
              </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminProfile;
