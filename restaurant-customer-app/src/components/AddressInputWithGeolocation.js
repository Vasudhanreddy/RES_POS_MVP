// src/components/AddressInputWithGeolocation.js

import React, { useState } from 'react';
import './AddressInputWithGeolocation.css'; // Create this CSS file for styling
import { FaMapMarkerAlt, FaSpinner, FaExclamationCircle } from 'react-icons/fa';

/**
 * A React component for address input with a 'Use Current Location' feature.
 *
 * This component demonstrates how to use the browser's Geolocation API
 * and OpenStreetMap's Nominatim API for reverse geocoding to pre-fill
 * address fields.
 *
 * Props:
 * - onAddressChange: Function to call when address fields change,
 * receives an object like { street, city, zipCode, country, lat, lng }
 * - initialAddress: Object with initial address values (optional)
 */
const AddressInputWithGeolocation = ({ onAddressChange, initialAddress }) => {
  const [address, setAddress] = useState({
    street: initialAddress?.street || '',
    city: initialAddress?.city || '',
    state: initialAddress?.state || '', // Added state field
    zipCode: initialAddress?.zipCode || '',
    country: initialAddress?.country || '',
    lat: initialAddress?.lat || null, // Storing latitude
    lng: initialAddress?.lng || null, // Storing longitude
    notes: initialAddress?.notes || '' // Additional notes field
  });
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [error, setError] = useState(null);

  // Function to update local state and notify parent component
  const handleChange = (e) => {
    const { name, value } = e.target;
    const newAddress = { ...address, [name]: value };
    setAddress(newAddress);
    if (onAddressChange) {
      onAddressChange(newAddress);
    }
  };

  const handleUseCurrentLocation = () => {
    setError(null);
    setLoadingLocation(true);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          console.log("Geolocation obtained:", latitude, longitude);
          try {
            // OpenStreetMap Nominatim API for reverse geocoding
            // Usage policy: https://nominatim.org/release-docs/latest/api/Reverse/
            // CRITICAL FIX: Added a User-Agent header as required by Nominatim's usage policy.
            // Ensure 'your-real-contact-email@example.com' is replaced with a genuine contact.
            // Added Referer header as well for better compliance.
            const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`; // Added addressdetails=1 for more granular info
            const response = await fetch(nominatimUrl, {
              headers: {
                // IMPORTANT: Replace with your actual app name and a genuine contact email/URL
                'User-Agent': 'RestaurantCustomerApp/1.0 (your-real-contact-email@example.com)',
                'Referer': window.location.origin // Sends the origin of your app
              }
            });

            if (!response.ok) {
              // Check for specific HTTP error codes
              if (response.status === 403) {
                 throw new Error("Geolocation service denied access (403 Forbidden). This might be due to a missing/generic User-Agent header, rate limiting, or other usage policy violation. Please check console and Nominatim's usage policy.");
              }
              throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log("Nominatim API response:", data);

            // Extract address components from Nominatim response
            const addressDetails = data.address || {}; // Use data.address for more structured details
            const newStreet = addressDetails.road || addressDetails.building || data.display_name.split(',')[0].trim() || '';
            const newCity = addressDetails.city || addressDetails.town || addressDetails.village || '';
            const newState = addressDetails.state || '';
            const newZipCode = addressDetails.postcode || '';
            const newCountry = addressDetails.country || '';

            const updatedAddress = {
              street: newStreet,
              city: newCity,
              state: newState,
              zipCode: newZipCode,
              country: newCountry,
              lat: latitude,
              lng: longitude,
              notes: address.notes // Keep existing notes
            };

            setAddress(updatedAddress);
            if (onAddressChange) {
              onAddressChange(updatedAddress);
            }
          } catch (err) {
            console.error("Error during reverse geocoding:", err);
            setError(`Could not get a readable address. ${err.message || 'Please enter manually.'}`);
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
          setError(errorMessage);
        },
        {
          enableHighAccuracy: true, // Request more accurate results
          timeout: 10000,           // 10 seconds timeout
          maximumAge: 0             // Don't use cached position
        }
      );
    } else {
      setLoadingLocation(false);
      setError("Geolocation is not supported by your browser.");
    }
  };

  return (
    <div className="address-input-container">
      <h3 className="address-section-title"><FaMapMarkerAlt /> Delivery Address</h3>

      <div className="form-group">
        <label htmlFor="street">Street Address</label>
        <input
          type="text"
          id="street"
          name="street"
          value={address.street}
          onChange={handleChange}
          placeholder="e.g., 123 Main Street"
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="city">City</label>
        <input
          type="text"
          id="city"
          name="city"
          value={address.city}
          onChange={handleChange}
          placeholder="e.g., Bengaluru"
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="state">State/Province</label>
        <input
          type="text"
          id="state"
          name="state"
          value={address.state}
          onChange={handleChange}
          placeholder="e.g., Karnataka"
        />
      </div>

      <div className="form-group">
        <label htmlFor="zipCode">Zip Code</label>
        <input
          type="text"
          id="zipCode"
          name="zipCode"
          value={address.zipCode}
          onChange={handleChange}
          placeholder="e.g., 560001"
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="country">Country</label>
        <input
          type="text"
          id="country"
          name="country"
          value={address.country}
          onChange={handleChange}
          placeholder="e.g., India"
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="notes">Delivery Notes (Optional)</label>
        <textarea
          id="notes"
          name="notes"
          value={address.notes}
          onChange={handleChange}
          placeholder="e.g., Apartment 4B, call upon arrival."
          rows="3"
        ></textarea>
      </div>

      <button
        type="button"
        onClick={handleUseCurrentLocation}
        className="use-location-btn"
        disabled={loadingLocation}
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

      {error && (
        <p className="location-error">
          <FaExclamationCircle /> {error}
        </p>
      )}
    </div>
  );
};

export default AddressInputWithGeolocation;
