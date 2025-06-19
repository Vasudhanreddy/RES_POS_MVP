// restaurant-admin-app/src/components/AdminManagement.js

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { updatePassword, updateProfile, deleteUser } from 'firebase/auth'; // signInWithEmailAndPassword also removed if not directly used
import { FaUserPlus, FaEdit, FaTrash, FaSave, FaTimes, FaSpinner, FaCheck, FaBan, FaUserCircle, FaEnvelope, FaTag } from 'react-icons/fa';
import './AdminManagement.css'; // Assuming you will create this CSS file

const AdminManagement = ({ db, auth, user: currentUser }) => {
  const [adminUsers, setAdminUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null); // User being edited (or null for new)

  // Form states for adding/editing user
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState('admin'); // Default new user role
  const [managedRestaurantId, setManagedRestaurantId] = useState(''); // For admin/driver users

  const [formMessage, setFormMessage] = useState('');
  const [isFormSuccess, setIsFormSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Determine if the current logged-in user is a super_admin
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    console.log("AdminManagement useEffect: Mounting or dependencies changed.");
    console.log("Current db instance:", db);
    console.log("Current currentUser (prop):", currentUser);

    if (!db) {
      console.log("AdminManagement useEffect: Firestore not available, setting error.");
      setError("Firestore not available.");
      setLoading(false);
      return;
    }

    if (!currentUser || !currentUser.uid || !currentUser.role) {
      console.log("AdminManagement useEffect: Current user data (UID or role) not fully loaded yet.");
      setLoading(true); // Keep loading until currentUser.role is defined
      return;
    }

    const hasAccess = ['admin', 'super_admin'].includes(currentUser.role);
    if (!hasAccess) {
      console.log("AdminManagement useEffect: Current user does not have admin or super_admin role, denying access.");
      setLoading(false);
      setError("Access Denied: You do not have the required permissions to view this page.");
      return;
    }

    setIsSuperAdmin(currentUser.role === 'super_admin');

    console.log("AdminManagement useEffect: Attaching onSnapshot listener.");
    setLoading(true);
    setError(null);

    const usersQuery = collection(db, 'users');
    const unsubscribe = onSnapshot(usersQuery, (snapshot) => {
      console.log("onSnapshot: Data received.");
      const usersList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAdminUsers(usersList);
      setLoading(false);
      setError(null);
    }, (err) => {
      console.error("onSnapshot Error:", err);
      setError(`Failed to load user data: ${err.message}. Please check your Firebase Security Rules for the 'users' collection.`);
      setLoading(false);
    });

    return () => {
      console.log("AdminManagement useEffect: Detaching onSnapshot listener.");
      unsubscribe();
    };
  }, [db, currentUser]);

  const openCreateModal = () => {
    setEditingUser(null);
    setEmail('');
    setPassword('');
    setDisplayName('');
    setRole('admin');
    setManagedRestaurantId(currentUser.role === 'admin' ? (currentUser.managedRestaurantId || '') : '');
    setFormMessage('');
    setIsFormSuccess(false);
    setIsModalOpen(true);
  };

  const openEditModal = (userToEdit) => {
    setEditingUser(userToEdit);
    setEmail(userToEdit.email || '');
    setDisplayName(userToEdit.displayName || '');
    setRole(userToEdit.role || 'admin');
    setManagedRestaurantId(userToEdit.managedRestaurantId || '');
    setPassword('');
    setFormMessage('');
    setIsFormSuccess(false);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    setFormMessage('');
    setIsFormSuccess(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormMessage('');
    setIsFormSuccess(false);

    try {
      if (editingUser) {
        const userDocRef = doc(db, 'users', editingUser.id);
        const firestoreUpdates = {
          displayName: displayName,
          updatedAt: Timestamp.now(),
          lastUpdatedBy: { uid: currentUser.uid, email: currentUser.email }
        };

        if (isSuperAdmin) {
            firestoreUpdates.role = role;
            firestoreUpdates.managedRestaurantId = (role === 'admin' || role === 'driver') ? managedRestaurantId.trim() : null;
        } else if (editingUser.id !== currentUser.uid) { // If not super admin and trying to edit another user
            throw new Error("You do not have permission to edit this user's role or restaurant ID.");
        }

        await updateDoc(userDocRef, firestoreUpdates);

        if (password && editingUser.id === currentUser.uid) {
            if (password.length < 6) {
                throw new Error("Password must be at least 6 characters long.");
            }
            await updatePassword(auth.currentUser, password);
            setFormMessage("Profile and password updated successfully!");
        } else if (password && editingUser.id !== currentUser.uid) {
             setFormMessage("Profile updated. Note: Password changes for other users require Firebase Cloud Functions for security.");
        } else {
            setFormMessage("User profile updated successfully!");
        }

        setIsFormSuccess(true);

      } else {
        if (password.length < 6) {
          throw new Error("Password must be at least 6 characters long.");
        }
        if ((role === 'admin' || role === 'driver') && !managedRestaurantId.trim()) {
            throw new Error("Restaurant ID is required for admin and driver users.");
        }

        if (role === 'super_admin' && !isSuperAdmin) {
            throw new Error("Only Super Admins can create new Super Admin users.");
        }
        if (role === 'admin' && !['admin', 'super_admin'].includes(currentUser.role)) {
            throw new Error("Only Admins or Super Admins can create new Admin users.");
        }
        if (role === 'driver') {
            if (currentUser.role === 'admin' && managedRestaurantId.trim() !== currentUser.managedRestaurantId) {
                throw new Error("Admins can only create drivers for their own managed restaurant.");
            }
        }

        const { createUserWithEmailAndPassword } = await import('firebase/auth');

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const newUser = userCredential.user;

        const userDocRef = doc(db, 'users', newUser.uid);
        const newUserFirestoreData = {
            email: newUser.email,
            uid: newUser.uid,
            displayName: displayName,
            role: role,
            managedRestaurantId: (role === 'admin' || role === 'driver') ? managedRestaurantId.trim() : null,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        };

        if (role === 'driver') {
            newUserFirestoreData.driverStatus = 'offline';
        }

        await setDoc(userDocRef, newUserFirestoreData);

        setFormMessage(`User ${email} (${role}) created successfully!`);
        setIsFormSuccess(true);
        setEmail('');
        setPassword('');
        setDisplayName('');
        setManagedRestaurantId('');
        setRole('admin');
      }
    } catch (err) {
      let msg = `Operation failed: ${err.message}`;
      if (err.code === 'auth/email-already-in-use') {
        msg = 'The provided email is already in use by an existing user.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Password is too weak. Please choose a stronger one.';
      } else if (err.code === 'auth/requires-recent-login') {
        msg = "Authentication required: Please log out and log back in to perform this security-sensitive action.";
      } else if (err.code === 'permission-denied') {
        msg = "Permission Denied: You do not have the necessary rights to perform this operation. Check Firebase Security Rules and your role.";
      }
      console.error("Error in handleSubmit:", err);
      setFormMessage(msg);
      setIsFormSuccess(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId, userEmail, userRoleToDelete) => {
    if (!window.confirm(`Are you sure you want to delete user: ${userEmail} (${userRoleToDelete})? This cannot be undone.`)) {
      return;
    }

    setIsSubmitting(true);
    setFormMessage('');
    setIsFormSuccess(false);

    try {
      if (userId !== currentUser.uid && !isSuperAdmin) {
          throw new Error("You do not have permission to delete this user.");
      }
      if (userId === currentUser.uid && currentUser.role === 'super_admin') {
          throw new Error("Super Admin cannot delete their own account from this panel. Use Firebase Console.");
      }

      await deleteDoc(doc(db, 'users', userId));
      console.log(`User document ${userId} deleted from Firestore.`);

      if (currentUser.uid === userId) {
        await deleteUser(auth.currentUser);
        setFormMessage("Your account has been successfully deleted.");
        setIsFormSuccess(true);
      } else {
        setFormMessage(`User ${userEmail} Firestore profile deleted. To remove from Firebase Authentication, a Super Admin must use the Firebase Console or a Cloud Function.`);
        setIsFormSuccess(true);
      }

    } catch (err) {
      console.error(`Error deleting user ${userId}:`, err);
      let msg = `Failed to delete user: ${err.message}.`;
      if (err.code === 'auth/requires-recent-login') {
          msg = "To delete this user, your current session requires recent re-authentication. Please log out, log back in, and try again.";
      } else if (err.code === 'permission-denied') {
        msg = "Permission Denied: You do not have the necessary rights to delete this user. Check Firebase Security Rules.";
      }
      setFormMessage(msg);
      setIsFormSuccess(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredUsers = adminUsers.filter(u => ['admin', 'super_admin', 'driver'].includes(u.role));
  const otherUsersCount = adminUsers.filter(u => !['admin', 'super_admin', 'driver'].includes(u.role)).length;


  // Initial loading state while currentUser data (including role) is being fetched
  if (!currentUser || !currentUser.role || loading) {
    return (
      <div className="admin-management-container loading-state">
        <FaSpinner className="spinner-icon" />
        <p>Loading User Data and Permissions...</p>
      </div>
    );
  }

  // Client-side access check after currentUser and its role are loaded
  const hasPageAccess = ['admin', 'super_admin'].includes(currentUser.role);
  if (!hasPageAccess) {
    return (
        <div className="admin-management-container error-state">
            <p>Access Denied: You must be an Admin or Super Admin to view this page's content.</p>
            <p>Your current role: {currentUser.role || 'Not available'}</p>
            <p>Please ensure your user profile in Firestore has a 'role' field defined (e.g., 'admin' or 'super_admin').</p>
        </div>
    );
  }

  // Display general error messages (e.g., from Firestore data fetching)
  if (error) {
    return (
      <div className="admin-management-container error-state">
        <p>Error: {error}</p>
        <p>Please ensure you have appropriate Firestore security rules (read access for 'users' collection for admins) and network connectivity.</p>
      </div>
    );
  }

  // Define new boolean flags for button/input disabling logic
  const disableRoleSelect = isSubmitting || (!isSuperAdmin && editingUser && editingUser.id !== currentUser.uid);
  const disableManagedRestaurantIdInput = isSubmitting || (!isSuperAdmin && editingUser && editingUser.id !== currentUser.uid && editingUser.role !== 'customer');

  const isCreateSubmitDisabled = isSubmitting ||
                                 (role === 'super_admin' && !isSuperAdmin) || // Non-super-admin trying to create super_admin
                                 (role === 'admin' && !['admin', 'super_admin'].includes(currentUser.role)) || // Non-admin/super-admin trying to create admin
                                 ((role === 'admin' || role === 'driver') && !managedRestaurantId.trim()); // Managed ID required for admin/driver

  const isEditSubmitDisabled = isSubmitting; // Add other conditions as needed for editing.

  return (
    <div className="admin-management-container">
      <h2 className="page-title">Admin & User Management</h2>
      <p className="page-description">Manage administrator, driver, and other user accounts. Super Admins can create and manage other admins and drivers.</p>

      <button onClick={openCreateModal} className="add-user-button">
        <FaUserPlus /> Add New User
      </button>

      {otherUsersCount > 0 && (
          <p className="customer-info-message">
              Note: There are {otherUsersCount} customer/unassigned users not shown here. This panel focuses on Admin, Super Admin, and Driver roles.
          </p>
      )}

      <div className="user-list">
        {filteredUsers.length === 0 ? (
          <p className="no-users-message">No admin, super admin, or driver users found.</p>
        ) : (
          filteredUsers.map(user => (
            <div key={user.id} className="user-card">
              <div className="user-info">
                <FaUserCircle className="user-icon" />
                <div className="user-details">
                  <h3 className="user-name">{user.displayName || user.email}</h3>
                  <p className="user-email"><FaEnvelope /> {user.email}</p>
                  <p className="user-role"><FaTag /> Role: <span className={`role-badge role-${user.role || 'customer'}`}>{user.role || 'Customer'}</span></p>
                  {user.managedRestaurantId && (
                      <p className="user-restaurant-id"><FaTag /> Restaurant ID: {user.managedRestaurantId}</p>
                  )}
                  <p className="user-uid">UID: {user.id}</p>
                </div>
              </div>
              <div className="user-actions">
                <button
                  className="action-button edit-button"
                  onClick={() => openEditModal(user)}
                  disabled={isSubmitting || (!isSuperAdmin && user.id !== currentUser.uid)}
                >
                  <FaEdit /> Edit
                </button>
                <button
                  className="action-button delete-button"
                  onClick={() => handleDeleteUser(user.id, user.email, user.role)}
                  disabled={isSubmitting || (user.id === currentUser.uid && currentUser.role === 'super_admin') || (!isSuperAdmin && user.id !== currentUser.uid)}
                >
                  <FaTrash /> Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add/Edit User Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="modal-close-button" onClick={closeModal}>&times;</button>
            <h3>{editingUser ? 'Edit User' : 'Add New User'}</h3>
            <form onSubmit={handleSubmit} className="user-form">
              <div className="form-group">
                <label htmlFor="email">Email:</label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  required
                  disabled={editingUser || isSubmitting}
                />
              </div>
              {!editingUser && (
                <div className="form-group">
                  <label htmlFor="password">Password:</label>
                  <input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="min. 6 characters"
                    required={!editingUser}
                    disabled={isSubmitting}
                  />
                  {password.length > 0 && password.length < 6 && (
                      <p className="form-help-text error">Password must be at least 6 characters.</p>
                  )}
                </div>
              )}
              <div className="form-group">
                <label htmlFor="displayName">Display Name:</label>
                <input
                  type="text"
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="User Name"
                  required
                  disabled={isSubmitting}
                />
              </div>
              <div className="form-group">
                <label htmlFor="role">Role:</label>
                <select
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  disabled={disableRoleSelect} // Use the new variable
                >
                  <option value="admin">Admin</option>
                  <option value="driver">Driver</option>
                  <option value="customer">Customer</option>
                  {isSuperAdmin && <option value="super_admin">Super Admin</option>}
                </select>
                {disableRoleSelect && !isSuperAdmin && <p className="form-help-text">Only Super Admins can change user roles.</p>}
                {!isSuperAdmin && !editingUser && role === 'super_admin' &&
                  <p className="form-help-text error">Only Super Admins can create Super Admin users.</p>
                }
                 {!isSuperAdmin && !editingUser && role === 'admin' &&
                  <p className="form-help-text error">Only Admins or Super Admins can create Admin users.</p>
                }
              </div>

              {(role === 'admin' || role === 'driver') && (
                <div className="form-group">
                  <label htmlFor="managedRestaurantId">Managed Restaurant ID:</label>
                  <input
                    type="text"
                    id="managedRestaurantId"
                    value={managedRestaurantId}
                    onChange={(e) => setManagedRestaurantId(e.target.value)}
                    placeholder="e.g., yourRestaurantID123"
                    required
                    disabled={disableManagedRestaurantIdInput} // Use the new variable
                  />
                  {disableManagedRestaurantIdInput && !isSuperAdmin && <p className="form-help-text">Only Super Admins can set/change Managed Restaurant ID.</p>}
                  {currentUser.role === 'admin' && !editingUser && role === 'driver' &&
                    <p className="form-help-text">As an Admin, you can only assign drivers to your restaurant: **{currentUser.managedRestaurantId}**</p>
                  }
                </div>
              )}

              <div className="form-actions">
                <button
                    type="submit"
                    className="submit-button"
                    disabled={editingUser ? isEditSubmitDisabled : isCreateSubmitDisabled} // Conditional disabled based on mode
                >
                  {isSubmitting ? <FaSpinner className="spinner" /> : (editingUser ? <FaSave /> : <FaUserPlus />)}
                  {isSubmitting ? 'Saving...' : (editingUser ? 'Save Changes' : 'Create User')}
                </button>
                <button type="button" className="cancel-button" onClick={closeModal} disabled={isSubmitting}>
                  <FaTimes /> Cancel
                </button>
              </div>

              {formMessage && (
                <p className={`form-message ${isFormSuccess ? 'success' : 'error'}`}>
                  {isFormSuccess ? <FaCheck /> : <FaTimes />} {formMessage}
                </p>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminManagement;
