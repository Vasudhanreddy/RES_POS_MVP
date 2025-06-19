// src/components/MenuManagement.js
import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore'; // Removed getDocs as it's unused
import { db } from '../firebaseConfig'; // Import your Firestore instance

const MenuManagement = ({ restaurantID }) => {
  // State for adding new menu items
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [itemIsAvailable, setItemIsAvailable] = useState(true);

  // State for displaying existing menu items
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // State for editing menu items
  const [editingItem, setEditingItem] = useState(null); // null if not editing, otherwise the item object
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editIsAvailable, setEditIsAvailable] = useState(true);

  // Placeholder for the restaurant ID.
  // In a real app, this would come from the logged-in admin's profile or selected restaurant.
  // For MVP, we'll use a constant or pass it down as a prop.
  const ADMIN_RESTAURANT_ID = restaurantID || "6rMFucaeuCOpaLbs0wwyijMvDln2"; 
                                                                       // Ensure this ID matches what you want to query/save.
                                                                       // If restaurantId prop is your user.uid, that's best.

  // --- R (Read) - Fetch and Listen to Menu Items ---
  useEffect(() => {
    if (!ADMIN_RESTAURANT_ID) {
      setError("No restaurant ID provided for menu management.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Create a query to get menu items for the specific restaurant
    // and order them by creation time (newest first)
    const q = query(
      collection(db, 'menuItems'),
      where('restaurantID', '==', ADMIN_RESTAURANT_ID), // <-- FIXED: Changed to 'restaurantID' (capital ID)
      orderBy('createdAt', 'desc')
    );

    // Set up a real-time listener
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const itemsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMenuItems(itemsData);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching menu items:", err);
      setError("Failed to load menu items. Please try again.");
      setLoading(false);
    });

    // Cleanup the listener when the component unmounts
    return () => unsubscribe();
  }, [ADMIN_RESTAURANT_ID]); // Re-run effect if restaurantId changes

  // --- C (Create) - Add New Menu Item ---
  const handleAddMenuItem = async (e) => {
    e.preventDefault(); // Prevent page reload
    if (!itemName || !itemPrice) {
      setError("Item name and price are required.");
      return;
    }
    if (isNaN(parseFloat(itemPrice)) || parseFloat(itemPrice) <= 0) {
        setError("Price must be a positive number.");
        return;
    }

    setError(null);
    try {
      await addDoc(collection(db, 'menuItems'), {
        restaurantID: ADMIN_RESTAURANT_ID, // <-- FIXED: Changed to 'restaurantID' (capital ID)
        name: itemName,
        price: parseFloat(itemPrice), // Store as number
        description: itemDescription,
        isAvailable: itemIsAvailable,
        createdAt: serverTimestamp(), // Firestore's server timestamp
        updatedAt: serverTimestamp(),
      });
      // Clear form fields after successful add
      setItemName('');
      setItemPrice('');
      setItemDescription('');
      setItemIsAvailable(true);
    } catch (err) {
      console.error("Error adding document:", err);
      setError("Failed to add menu item. Please try again.");
    }
  };

  // --- U (Update) - Start Editing ---
  const startEditing = (item) => {
    setEditingItem(item);
    setEditName(item.name);
    setEditPrice(item.price.toString()); // Convert number to string for input
    setEditDescription(item.description);
    setEditIsAvailable(item.isAvailable);
  };

  // --- U (Update) - Save Changes ---
  const handleUpdateMenuItem = async (e) => {
    e.preventDefault();
    if (!editingItem) return;
    if (!editName || !editPrice) {
      setError("Item name and price are required.");
      return;
    }
    if (isNaN(parseFloat(editPrice)) || parseFloat(editPrice) <= 0) {
        setError("Price must be a positive number.");
        return;
    }

    setError(null);
    try {
      const itemRef = doc(db, 'menuItems', editingItem.id);
      await updateDoc(itemRef, {
        name: editName,
        price: parseFloat(editPrice),
        description: editDescription,
        isAvailable: editIsAvailable,
        updatedAt: serverTimestamp(),
      });
      setEditingItem(null); // Exit editing mode
    } catch (err) {
      console.error("Error updating document:", err);
      setError("Failed to update menu item. Please try again.");
    }
  };

  // --- D (Delete) - Delete Menu Item ---
  const handleDeleteMenuItem = async (itemId) => {
    if (window.confirm("Are you sure you want to delete this menu item?")) {
      setError(null);
      try {
        await deleteDoc(doc(db, 'menuItems', itemId));
      } catch (err) {
        console.error("Error deleting document:", err);
        setError("Failed to delete menu item. Please try again.");
      }
    }
  };

  return (
    <div className="container">
      <h2>Menu Management</h2>

      {error && <p className="error-message">{error}</p>}

      {/* Form to Add New Menu Item */}
      <h3>Add New Menu Item</h3>
      <form onSubmit={handleAddMenuItem} className="menu-form">
        <input
          type="text"
          placeholder="Item Name"
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
          required
        />
        <input
          type="number"
          step="0.01"
          placeholder="Price"
          value={itemPrice}
          onChange={(e) => setItemPrice(e.target.value)}
          required
        />
        <textarea
          placeholder="Description (optional)"
          value={itemDescription}
          onChange={(e) => setItemDescription(e.target.value)}
        ></textarea>
        <label>
          <input
            type="checkbox"
            checked={itemIsAvailable}
            onChange={(e) => setItemIsAvailable(e.target.checked)}
          />
          Available
        </label>
        <button type="submit" className="btn primary-btn">Add Item</button>
      </form>

      {/* List of Existing Menu Items */}
      <h3>Your Menu Items</h3>
      {loading ? (
        <p>Loading menu items...</p>
      ) : menuItems.length === 0 ? (
        <p>No menu items found. Add one above!</p>
      ) : (
        <ul className="menu-list">
          {menuItems.map((item) => (
            <li key={item.id} className="menu-item-card">
              {editingItem && editingItem.id === item.id ? (
                // Edit Form
                <form onSubmit={handleUpdateMenuItem} className="edit-form">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    required
                  />
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                  ></textarea>
                  <label>
                    <input
                      type="checkbox"
                      checked={editIsAvailable}
                      onChange={(e) => setEditIsAvailable(e.target.checked)}
                    />
                    Available
                  </label>
                  <div className="button-group">
                    <button type="submit" className="btn success-btn">Save</button>
                    <button type="button" onClick={() => setEditingItem(null)} className="btn secondary-btn">Cancel</button>
                  </div>
                </form>
              ) : (
                // Display Mode
                <>
                  <h4>{item.name}</h4>
                  <p>Price: ₹{item.price ? item.price.toFixed(2) : 'N/A'}</p>
                  <p>{item.description}</p>
                  <p className={item.isAvailable ? 'status-available' : 'status-unavailable'}>
                    {item.isAvailable ? 'Available' : 'Not Available'}
                  </p>
                  <div className="button-group">
                    <button onClick={() => startEditing(item)} className="btn primary-btn">Edit</button>
                    <button onClick={() => handleDeleteMenuItem(item.id)} className="btn danger-btn">Delete</button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default MenuManagement;