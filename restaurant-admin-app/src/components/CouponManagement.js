// restaurant-admin-app/src/components/CouponManagement.js

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc, Timestamp, getDoc, setDoc } from 'firebase/firestore'; // ADDED setDoc, REMOVED addDoc
import './CouponManagement.css';
import { FaTag, FaPlus, FaEdit, FaTrash, FaToggleOn, FaToggleOff, FaSpinner, FaCalendarAlt, FaMoneyBillWave, FaPercentage, FaExclamationCircle, FaCheckCircle, FaLock } from 'react-icons/fa';

const CouponManagement = ({ restaurantID, db, userRole }) => {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isAdmin = userRole === 'admin';

  const [formData, setFormData] = useState({
    code: '',
    discountType: 'fixed',
    discountValue: '',
    minOrderAmount: '',
    validFrom: '',
    validTo: '',
    maxUses: '',
    maxUsesPerUser: '',
    isActive: true,
  });
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentCouponId, setCurrentCouponId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState('');

  useEffect(() => {
    if (!db) {
      setError("Firebase Firestore is not initialized.");
      setLoading(false);
      return;
    }
    if (!restaurantID) {
      setError("Restaurant ID is missing. Cannot load coupons.");
      setLoading(false);
      return;
    }

    const couponsCollectionRef = collection(db, 'resturent', restaurantID, 'coupons');

    const q = query(
      couponsCollectionRef,
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedCoupons = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        validFrom: doc.data().validFrom?.toDate().toISOString().split('T')[0] || '',
        validTo: doc.data().validTo?.toDate().toISOString().split('T')[0] || '',
      }));
      setCoupons(fetchedCoupons);
      setLoading(false);
      setError(null);
      console.log("Fetched coupons:", fetchedCoupons);
    }, (err) => {
      console.error("Error fetching coupons:", err);
      let errorMessage = `Failed to load coupons: ${err.message}.`;
      if (err.code === 'permission-denied') {
          errorMessage += ' You do not have permission to view coupons. Please check your role and Firebase Security Rules.';
      } else if (err.code === 'failed-precondition') {
          errorMessage += ' Please create the required Firestore index.';
      }
      setError(errorMessage);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [restaurantID, db]);


  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.code.trim()) newErrors.code = 'Coupon code is required.';
    if (!formData.discountValue || isNaN(parseFloat(formData.discountValue)) || parseFloat(formData.discountValue) <= 0) {
      newErrors.discountValue = 'Discount value must be a positive number.';
    }
    if (formData.minOrderAmount && (isNaN(parseFloat(formData.minOrderAmount)) || parseFloat(formData.minOrderAmount) < 0)) {
      newErrors.minOrderAmount = 'Minimum order amount must be a non-negative number.';
    }
    if (formData.discountType === 'percentage' && parseFloat(formData.discountValue) > 100) {
      newErrors.discountValue = 'Percentage discount cannot exceed 100%.';
    }
    if (formData.validFrom && formData.validTo && new Date(formData.validFrom) > new Date(formData.validTo)) {
      newErrors.validTo = 'Valid To date cannot be before Valid From date.';
    }

    if (Object.keys(newErrors).length > 0) {
      setFormMessage(<span className="error-message">Please fix the following: {Object.values(newErrors).join(', ')}</span>);
      return false;
    }
    setFormMessage('');
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin) {
      setFormMessage(<span className="error-message"><FaLock /> You do not have permission to perform this action.</span>);
      return;
    }
    if (!validateForm()) return;

    if (!db) { setError("Firestore not initialized."); return; }
    setIsSubmitting(true);
    setFormMessage('');

    const couponDocRef = doc(db, 'resturent', restaurantID, 'coupons', formData.code.trim());

    const payload = {
      restaurantId: restaurantID,
      ...formData,
      discountValue: parseFloat(formData.discountValue),
      minOrderAmount: formData.minOrderAmount ? parseFloat(formData.minOrderAmount) : null,
      validFrom: formData.validFrom ? Timestamp.fromDate(new Date(formData.validFrom)) : null,
      validTo: formData.validTo ? Timestamp.fromDate(new Date(formData.validTo)) : null,
      maxUses: formData.maxUses ? parseInt(formData.maxUses, 10) : null,
      maxUsesPerUser: formData.maxUsesPerUser ? parseInt(formData.maxUsesPerUser, 10) : null,
    };

    try {
      if (isEditMode) {
        const updateRef = doc(db, 'resturent', restaurantID, 'coupons', currentCouponId);
        await updateDoc(updateRef, { ...payload, updatedAt: Timestamp.now() });
        setFormMessage(<span className="success-message"><FaCheckCircle /> Coupon updated successfully!</span>);
      } else {
        const existingCouponSnap = await getDoc(couponDocRef);
        if (existingCouponSnap.exists()) {
          setFormMessage(<span className="error-message"><FaExclamationCircle /> Coupon code already exists. Please choose a different one.</span>);
          setIsSubmitting(false);
          return;
        }
        await setDoc(couponDocRef, { ...payload, createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
        setFormMessage(<span className="success-message"><FaCheckCircle /> Coupon created successfully!</span>);
      }
      resetForm();
    } catch (err) {
      console.error("Error saving coupon:", err);
      let errorMessage = `Failed to save coupon: ${err.message}`;
      if (err.code === 'permission-denied') {
          errorMessage = 'You do not have permission to create/edit coupons. Check your role and Firebase Security Rules.';
      }
      setFormMessage(<span className="error-message"><FaExclamationCircle /> {errorMessage}</span>);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (coupon) => {
    if (!isAdmin) {
      setFormMessage(<span className="error-message"><FaLock /> You do not have permission to edit coupons.</span>);
      return;
    }
    setFormData({
      code: coupon.id,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue.toString(),
      minOrderAmount: coupon.minOrderAmount?.toString() || '',
      validFrom: coupon.validFrom || '',
      validTo: coupon.validTo || '',
      maxUses: coupon.maxUses?.toString() || '',
      maxUsesPerUser: coupon.maxUsesPerUser?.toString() || '',
      isActive: coupon.isActive,
    });
    setIsEditMode(true);
    setCurrentCouponId(coupon.id);
    setFormMessage('');
  };

  const handleDelete = async (couponId) => {
    if (!isAdmin) {
      setFormMessage(<span className="error-message"><FaLock /> You do not have permission to delete coupons.</span>);
      return;
    }
    if (!db) { setError("Firestore not initialized."); return; }
    if (window.confirm(`Are you sure you want to delete coupon "${couponId}"? This cannot be undone.`)) {
      try {
        await deleteDoc(doc(db, 'resturent', restaurantID, 'coupons', couponId));
        setFormMessage(<span className="success-message"><FaCheckCircle /> Coupon deleted successfully!</span>);
      } catch (err) {
        console.error("Error deleting coupon:", err);
        let errorMessage = `Failed to delete coupon: ${err.message}`;
        if (err.code === 'permission-denied') {
            errorMessage = 'You do not have permission to delete coupons. Check your role and Firebase Security Rules.';
        }
        setFormMessage(<span className="error-message"><FaExclamationCircle /> {errorMessage}</span>);
      }
    }
  };

  const handleToggleActive = async (coupon) => {
    if (!isAdmin) {
      setFormMessage(<span className="error-message"><FaLock /> You do not have permission to change coupon status.</span>);
      return;
    }
    if (!db) { setError("Firestore not initialized."); return; }
    try {
      await updateDoc(doc(db, 'resturent', restaurantID, 'coupons', coupon.id), { isActive: !coupon.isActive, updatedAt: Timestamp.now() });
      setFormMessage(<span className="success-message"><FaCheckCircle /> Coupon status updated!</span>);
    } catch (err) {
      console.error("Error toggling coupon status:", err);
      let errorMessage = `Failed to toggle status: ${err.message}`;
      if (err.code === 'permission-denied') {
          errorMessage = 'You do not have permission to change coupon status. Check your role and Firebase Security Rules.';
      }
      setFormMessage(<span className="error-message"><FaExclamationCircle /> {errorMessage}</span>);
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      discountType: 'fixed',
      discountValue: '',
      minOrderAmount: '',
      validFrom: '',
      validTo: '',
      maxUses: '',
      maxUsesPerUser: '',
      isActive: true,
    });
    setIsEditMode(false);
    setCurrentCouponId(null);
  };

  if (loading) {
    return (
      <div className="coupon-management-container loading">
        <FaSpinner className="spinner-icon" />
        <p>Loading Coupons...</p>
      </div>
    );
  }

  if (error) {
    return <div className="coupon-management-container error">{error}</div>;
  }

  return (
    <div className="coupon-management-container">
      <h2 className="page-title"><FaTag /> Coupon Management</h2>
      <p className="page-description">Create and manage discount coupons for your restaurant. These coupons can be applied by customers at checkout.</p>

      {!isAdmin && (
        <div className="permission-denied-message">
          <FaLock /> You need 'admin' role to manage coupons.
        </div>
      )}

      <div className="coupon-form-section">
        <h3>{isEditMode ? 'Edit Coupon' : 'Create New Coupon'}</h3>
        <form onSubmit={handleSubmit} className="coupon-form">
          <div className="form-group">
            <label htmlFor="code">Coupon Code:</label>
            <input
              type="text"
              id="code"
              name="code"
              value={formData.code}
              onChange={handleChange}
              placeholder="E.g., FREEDELIVERY, SAVE10"
              required
              disabled={isEditMode || isSubmitting || !isAdmin}
            />
          </div>

          <div className="form-group inline-group">
            <div className="sub-group">
              <label htmlFor="discountType">Discount Type:</label>
              <select
                id="discountType"
                name="discountType"
                value={formData.discountType}
                onChange={handleChange}
                required
                disabled={isSubmitting || !isAdmin}
              >
                <option value="fixed">Fixed Amount (₹)</option>
                <option value="percentage">Percentage (%)</option>
              </select>
            </div>
            <div className="sub-group">
              <label htmlFor="discountValue">Discount Value:</label>
              <input
                type="number"
                id="discountValue"
                name="discountValue"
                value={formData.discountValue}
                onChange={handleChange}
                min="0.01"
                step="0.01"
                placeholder={formData.discountType === 'percentage' ? 'E.g., 15 (for 15%)' : 'E.g., 50 (for ₹50)'}
                required
                disabled={isSubmitting || !isAdmin}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="minOrderAmount">Minimum Order Amount (₹, optional):</label>
            <input
              type="number"
              id="minOrderAmount"
              name="minOrderAmount"
              value={formData.minOrderAmount}
              onChange={handleChange}
              min="0"
              step="0.01"
              placeholder="E.g., 500"
              disabled={isSubmitting || !isAdmin}
            />
          </div>

          <div className="form-group inline-group">
            <div className="sub-group">
              <label htmlFor="validFrom"><FaCalendarAlt /> Valid From (optional):</label>
              <input
                type="date"
                id="validFrom"
                name="validFrom"
                value={formData.validFrom}
                onChange={handleChange}
                disabled={isSubmitting || !isAdmin}
              />
            </div>
            <div className="sub-group">
              <label htmlFor="validTo"><FaCalendarAlt /> Valid To (optional):</label>
              <input
                type="date"
                id="validTo"
                name="validTo"
                value={formData.validTo}
                onChange={handleChange}
                disabled={isSubmitting || !isAdmin}
              />
            </div>
          </div>

          <div className="form-group inline-group">
            <div className="sub-group">
              <label htmlFor="maxUses">Max Total Uses (optional):</label>
              <input
                type="number"
                id="maxUses"
                name="maxUses"
                value={formData.maxUses}
                onChange={handleChange}
                min="1"
                step="1"
                placeholder="E.g., 100"
                disabled={isSubmitting || !isAdmin}
              />
            </div>
            <div className="sub-group">
              <label htmlFor="maxUsesPerUser">Max Uses Per User (optional):</label>
              <input
                type="number"
                id="maxUsesPerUser"
                name="maxUsesPerUser"
                value={formData.maxUsesPerUser}
                onChange={handleChange}
                min="1"
                step="1"
                placeholder="E.g., 1"
                disabled={isSubmitting || !isAdmin}
              />
            </div>
          </div>

          <div className="form-group checkbox-group">
            <input
              type="checkbox"
              id="isActive"
              name="isActive"
              checked={formData.isActive}
              onChange={handleChange}
              disabled={isSubmitting || !isAdmin}
            />
            <label htmlFor="isActive">Coupon is Active</label>
          </div>

          {formMessage && <p className="form-message">{formMessage}</p>}

          <div className="form-actions">
            <button type="submit" className="submit-button" disabled={isSubmitting || !isAdmin}>
              {isSubmitting ? <FaSpinner className="spinner" /> : (isEditMode ? <FaEdit /> : <FaPlus />)}
              {isSubmitting ? (isEditMode ? 'Updating...' : 'Creating...') : (isEditMode ? 'Update Coupon' : 'Create Coupon')}
            </button>
            {isEditMode && (
              <button type="button" onClick={resetForm} className="cancel-button" disabled={isSubmitting || !isAdmin}>
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="coupon-list-section">
        <h3>Existing Coupons ({coupons.length})</h3>
        {coupons.length === 0 ? (
          <p className="no-coupons-message">No coupons created yet. Use the form above to add one!</p>
        ) : (
          <div className="coupon-grid">
            {coupons.map(coupon => (
              <div key={coupon.id} className={`coupon-card ${coupon.isActive ? 'active-coupon' : 'inactive-coupon'}`}>
                <div className="coupon-card-header">
                  <span className="coupon-code">{coupon.id}</span>
                  <span className={`status-badge ${coupon.isActive ? 'active' : 'inactive'}`}>
                    {coupon.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="coupon-details">
                  <p><strong>Discount:</strong> {coupon.discountType === 'percentage' ? `${coupon.discountValue}%` : `₹${coupon.discountValue.toFixed(2)}`}</p>
                  {coupon.minOrderAmount && <p><strong>Min Order:</strong> ₹{coupon.minOrderAmount.toFixed(2)}</p>}
                  {coupon.validFrom && <p><strong>Valid From:</strong> {new Date(coupon.validFrom).toLocaleDateString()}</p>}
                  {coupon.validTo && <p><strong>Valid To:</strong> {new Date(coupon.validTo).toLocaleDateString()}</p>}
                  {coupon.maxUses && <p><strong>Max Uses:</strong> {coupon.maxUses}</p>}
                  {coupon.maxUsesPerUser && <p><strong>Max Uses/User:</strong> {coupon.maxUsesPerUser}</p>}
                </div>
                <div className="coupon-actions">
                  <button onClick={() => handleEdit(coupon)} className="action-button edit-button" disabled={!isAdmin}>
                    <FaEdit /> Edit
                  </button>
                  <button onClick={() => handleDelete(coupon.id)} className="action-button delete-button" disabled={!isAdmin}>
                    <FaTrash /> Delete
                  </button>
                  <button
                    onClick={() => handleToggleActive(coupon)}
                    className={`action-button toggle-button ${coupon.isActive ? 'deactivate' : 'activate'}`}
                    disabled={!isAdmin}
                  >
                    {coupon.isActive ? (
                        <>
                            <FaToggleOff /> Deactivate
                        </>
                    ) : (
                        <>
                            <FaToggleOn /> Activate
                        </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CouponManagement;