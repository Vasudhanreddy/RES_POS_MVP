// restaurant-admin-app/src/components/MenuList.js

import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
// Removed direct import of db. It will now come from props.
// import { db } from '../firebaseConfig'; 
import './MenuList.css'; // Your enhanced CSS file

// MenuList now accepts 'db' as a prop
const MenuList = ({ restaurantID, db }) => {
    // --- State for Data and Loading ---
    const [menuItems, setMenuItems] = useState([]);
    const [isLoading, setIsLoading] = useState(true); // Renamed from 'loading' for consistency
    const [error, setError] = useState(null); // For handling fetch errors

    // --- State for "Add New Menu Item" Form ---
    const [newItem, setNewItem] = useState({
        name: '',
        description: '',
        price: '',
        category: '',
        imageUrl: '', // Added imageUrl field
        isAvailable: true,
    });
    const [addingItem, setAddingItem] = useState(false); // Renamed from 'addingItem' for clarity

    // --- State for "Edit" Modal ---
    const [isEditModalOpen, setIsEditModalOpen] = useState(false); // Controls modal visibility
    const [itemToEdit, setItemToEdit] = useState(null); // Stores the item currently being edited (entire object)
    const [editFormData, setEditFormData] = useState({}); // Form data for the edit modal
    const [savingEdit, setSavingEdit] = useState(false);

    // --- State for Filtering and Searching ---
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');

    // --- EFFECT HOOK: Fetch Menu Items from Firebase ---
    useEffect(() => {
        if (!db) { // Ensure db is available
            setError("Firebase Firestore is not initialized.");
            setIsLoading(false);
            return;
        }

        if (!restaurantID) {
            setIsLoading(false);
            setError('No Restaurant ID provided. Cannot load menu.');
            return;
        }

        const menuItemsRef = collection(db, 'resturent', restaurantID, 'products'); // Updated path
        const q = query(menuItemsRef, orderBy('name', 'asc')); // Order by name

        const unsubscribe = onSnapshot(q,
            (snapshot) => {
                const items = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setMenuItems(items);
                setIsLoading(false);
                setError(null); // Clear any previous errors
                console.log("Fetched menu items:", items);
            },
            (err) => {
                console.error("Error fetching menu items:", err);
                setError("Failed to load menu items. Please try again.");
                setIsLoading(false);
            }
        );

        return () => unsubscribe(); // Clean up the listener on component unmount
    }, [restaurantID, db]); // Added db to dependency array

    // --- DYNAMIC CATEGORIES FOR FILTER ---
    const categories = Array.from(new Set(menuItems.map(item => item.category))).filter(Boolean); // Filter out empty strings

    // --- FILTERED MENU ITEMS LOGIC ---
    const filteredMenuItems = menuItems.filter(item => {
        const matchesSearchTerm = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesCategory = selectedCategory === '' || item.category === selectedCategory;
        return matchesSearchTerm && matchesCategory;
    });

    // --- HANDLERS FOR "ADD NEW ITEM" FORM ---
    const handleNewItemChange = (e) => {
        const { name, value, type, checked } = e.target;
        setNewItem(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));
    };

    const handleAddItem = async (e) => {
        e.preventDefault();
        // Basic client-side validation
        if (!newItem.name.trim() || !newItem.price || !newItem.category.trim()) {
            alert('Please fill in Name, Price, and Category.');
            return;
        }
        if (isNaN(parseFloat(newItem.price)) || parseFloat(newItem.price) < 0) {
            alert('Please enter a valid positive price.');
            return;
        }

        if (!db) { // Ensure db is available before adding
            setError("Firebase Firestore is not initialized.");
            return;
        }

        setAddingItem(true);
        try {
            await addDoc(collection(db, 'resturent', restaurantID, 'products'), {
                name: newItem.name.trim(),
                description: newItem.description.trim(),
                price: parseFloat(newItem.price),
                category: newItem.category.trim(),
                isAvailable: newItem.isAvailable,
                imageUrl: newItem.imageUrl.trim(), // Save image URL
                createdAt: new Date(), // Add timestamp
            });
            console.log("Menu item added successfully!");
            // Reset form fields
            setNewItem({
                name: '',
                description: '',
                price: '',
                category: '',
                imageUrl: '',
                isAvailable: true,
            });
            // Optional: Show a success message
            // alert('Item added successfully!');
        } catch (error) {
            console.error("Error adding menu item:", error);
            alert("Failed to add item: " + error.message);
        } finally {
            setAddingItem(false);
        }
    };

    // --- HANDLERS FOR "EDIT ITEM" MODAL ---
    const handleStartEditing = (item) => {
        setItemToEdit(item); // Store the original item
        setEditFormData({ ...item }); // Populate form with current item data
        setIsEditModalOpen(true); // Open the modal
    };

    const handleEditFormChange = (e) => {
        const { name, value, type, checked } = e.target;
        setEditFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));
    };

    const handleUpdateItem = async (e) => {
        e.preventDefault();
        // Basic client-side validation for edit form
        if (!editFormData.name.trim() || !editFormData.price || !editFormData.category.trim()) {
            alert('Please fill in Name, Price, and Category for editing.');
            return;
        }
        if (isNaN(parseFloat(editFormData.price)) || parseFloat(editFormData.price) < 0) {
            alert('Please enter a valid positive price for editing.');
            return;
        }
        if (!itemToEdit) return; // Should not happen if modal is open

        if (!db) { // Ensure db is available before updating
            setError("Firebase Firestore is not initialized.");
            return;
        }

        setSavingEdit(true);
        try {
            const itemDocRef = doc(db, 'resturent', restaurantID, 'products', itemToEdit.id);
            await updateDoc(itemDocRef, {
                name: editFormData.name.trim(),
                description: editFormData.description.trim(),
                price: parseFloat(editFormData.price),
                category: editFormData.category.trim(),
                isAvailable: editFormData.isAvailable,
                imageUrl: editFormData.imageUrl.trim(), // Update image URL
                updatedAt: new Date(), // Add updated timestamp
            });
            console.log("Menu item updated successfully!");
            handleCloseEditModal(); // Close modal
            // Optional: Show a success message
            // alert('Item updated successfully!');
        } catch (error) {
            console.error("Error updating menu item:", error);
            alert("Failed to update item: " + error.message);
        } finally {
            setSavingEdit(false);
        }
    };

    const handleCloseEditModal = () => {
        setIsEditModalOpen(false);
        setItemToEdit(null); // Clear the item being edited
        setEditFormData({}); // Clear form data
    };

    // --- HANDLER FOR DELETING ITEM ---
    const handleDeleteItem = async (item) => {
        if (window.confirm(`Are you sure you want to delete "${item.name}"? This action cannot be undone.`)) {
            if (!db) { // Ensure db is available before deleting
                setError("Firebase Firestore is not initialized.");
                return;
            }
            try {
                const itemDocRef = doc(db, 'resturent', restaurantID, 'products', item.id);
                await deleteDoc(itemDocRef);
                console.log("Menu item deleted successfully!");
                // Optional: Show a success message
                // alert('Item deleted successfully!');
            } catch (error) {
                console.error("Error deleting menu item:", error);
                alert("Failed to delete item: " + error.message);
            }
        }
    };

    // --- HANDLER FOR TOGGLING AVAILABILITY ---
    const handleToggleAvailability = async (item) => {
        if (!db) { // Ensure db is available before toggling
            setError("Firebase Firestore is not initialized.");
            return;
        }
        try {
            const itemDocRef = doc(db, 'resturent', restaurantID, 'products', item.id);
            await updateDoc(itemDocRef, {
                isAvailable: !item.isAvailable, // Toggle the current status
                updatedAt: new Date(),
            });
            console.log(`Item "${item.name}" availability toggled.`);
            // Optional: Show a success message
            // alert(`Item marked as ${!item.isAvailable ? 'Available' : 'Unavailable'}.`);
        } catch (error) {
            console.error("Error toggling availability:", error);
            alert("Failed to toggle item availability: " + error.message);
        }
    };

    // --- Conditional Renderings ---
    if (isLoading) {
        return <div className="menu-loading">Loading Menu Items...</div>;
    }

    if (!restaurantID) {
        return <div className="menu-error">Error: No Restaurant ID provided. Please select a restaurant.</div>;
    }

    if (error) {
        return <div className="menu-error">{error}</div>;
    }

    return (
        <>
            {/* The main page title, placed outside the grid container */}
            <h2 className="menu-page-title">Menu Management for Restaurant ID: {restaurantID}</h2>

            {/* The main grid container for the two columns */}
            <div className="menu-list-container">
                {/* Left Section: Current Menu Items Display */}
                <div className="menu-items-display">
                    <h3>Current Menu Items</h3>

                    {/* Filter and Search Section */}
                    <div className="menu-filters">
                        <input
                            type="text"
                            placeholder="Search by name or description..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                        >
                            <option value="">All Categories</option>
                            {categories.map(category => (
                                <option key={category} value={category}>{category}</option>
                            ))}
                            {/* Add some common fixed categories too if preferred */}
                            <option value="Pizza">Pizza</option>
                            <option value="Pasta">Pasta</option>
                            <option value="Salad">Salad</option>
                            <option value="Main Course">Main Course</option>
                            <option value="Dessert">Dessert</option>
                            <option value="Beverage">Beverage</option>
                        </select>
                    </div>

                    {/* Display Menu Items Grid or Empty Message */}
                    {filteredMenuItems.length === 0 ? (
                        <p className="menu-loading">No menu items found matching your criteria. Add some or adjust filters!</p>
                    ) : (
                        <div className="menu-items-grid">
                            {filteredMenuItems.map(item => (
                                <div key={item.id} className="menu-item-card">
                                    <div className="item-image-container">
                                        <img
                                            src={item.imageUrl || 'https://placehold.co/150x150?text=No+Image'}
                                            alt={item.name}
                                            onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/150x150?text=Image+Error'; }} // Fallback on error
                                        />
                                    </div>
                                    <div className="item-details">
                                        <h4>{item.name}</h4>
                                        <p className="item-description">{item.description}</p>
                                        <p className="item-price">₹{item.price ? item.price.toFixed(2) : 'N/A'}</p>
                                        <p className="item-category">Category: {item.category}</p>
                                        <span className={`item-availability ${item.isAvailable ? 'available' : 'unavailable'}`}>
                                            {item.isAvailable ? 'Available' : 'Unavailable'}
                                        </span>
                                    </div>
                                    <div className="item-actions">
                                        <button className="btn-edit" onClick={() => handleStartEditing(item)}>
                                            {/* SVG for Edit */}
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M14.06 9.06L9.06 14.06L14.06 19.06L19.06 14.06V9.06H14.06ZM17 12V6h-6l5 5zM7 16l-5 5V24h6v-2h-4zM24 0h-6V2h4v4h2zM0 0v6h2V2h4V0z"></path></svg>
                                            Edit
                                        </button>
                                        <button className="btn-delete" onClick={() => handleDeleteItem(item)}>
                                            {/* SVG for Delete */}
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"></path></svg>
                                            Delete
                                        </button>
                                        <button
                                            className={item.isAvailable ? 'btn-danger' : 'btn-success'}
                                            onClick={() => handleToggleAvailability(item)}
                                            style={{ backgroundColor: item.isAvailable ? 'var(--color-danger)' : 'var(--color-lime)', color: 'white' }}
                                        >
                                            {item.isAvailable ? 'Mark Unavailable' : 'Mark Available'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Right Section: Add New Menu Item Form */}
                <div className="add-item-section">
                    <h3>Add New Menu Item</h3>
                    <form className="add-item-form" onSubmit={handleAddItem}>
                        <div className="form-group">
                            <label htmlFor="newItemName">Item Name:</label>
                            <input
                                type="text"
                                id="newItemName"
                                name="name" // Matches newItem state key
                                value={newItem.name}
                                onChange={handleNewItemChange}
                                placeholder="e.g., Spicy Chicken Burger"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="newItemDescription">Description:</label>
                            <textarea
                                id="newItemDescription"
                                name="description" // Matches newItem state key
                                value={newItem.description}
                                onChange={handleNewItemChange}
                                placeholder="A brief description of the item."
                            ></textarea>
                        </div>
                        <div className="form-group">
                            <label htmlFor="newItemPrice">Price (₹):</label>
                            <input
                                type="number"
                                id="newItemPrice"
                                name="price" // Matches newItem state key
                                value={newItem.price}
                                onChange={handleNewItemChange}
                                step="0.01"
                                min="0"
                                placeholder="e.g., 14.99"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="newItemCategory">Category:</label>
                            <select
                                id="newItemCategory"
                                name="category" // Matches newItem state key
                                value={newItem.category}
                                onChange={handleNewItemChange}
                                required
                            >
                                <option value="">Select Category</option>
                                {/* Populate with existing categories or common ones */}
                                {categories.map(category => (
                                    <option key={category} value={category}>{category}</option>
                                ))}
                                {/* Add some common fixed categories too if preferred */}
                                <option value="Pizza">Pizza</option>
                                <option value="Pasta">Pasta</option>
                                <option value="Salad">Salad</option>
                                <option value="Main Course">Main Course</option>
                                <option value="Dessert">Dessert</option>
                                <option value="Beverage">Beverage</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="newItemImageUrl">Image URL:</label>
                            <input
                                type="text"
                                id="newItemImageUrl"
                                name="imageUrl" // Matches newItem state key
                                value={newItem.imageUrl}
                                onChange={handleNewItemChange}
                                placeholder="e.g., https://example.com/burger.jpg"
                            />
                        </div>
                        <div className="checkbox-group">
                            <input
                                type="checkbox"
                                id="newItemIsAvailable"
                                name="isAvailable" // Matches newItem state key
                                checked={newItem.isAvailable}
                                onChange={handleNewItemChange}
                            />
                            <label htmlFor="newItemIsAvailable">Available for Order</label>
                        </div>
                        <button type="submit" disabled={addingItem} className="submit">
                            {addingItem ? 'Adding...' : 'Add Item'}
                        </button>
                    </form>
                </div>
            </div>

            {/* Edit Item Modal (Conditionally rendered) */}
            {isEditModalOpen && itemToEdit && (
                <div className="edit-modal-overlay">
                    <div className="edit-modal-content">
                        <h3>Edit Menu Item: {itemToEdit.name}</h3>
                        <form className="edit-item-form" onSubmit={handleUpdateItem}>
                            <div className="form-group">
                                <label htmlFor="editName">Item Name:</label>
                                <input
                                    type="text"
                                    id="editName"
                                    name="name" // Matches editFormData state key
                                    value={editFormData.name || ''}
                                    onChange={handleEditFormChange}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="editDescription">Description:</label>
                                <textarea
                                    id="editDescription"
                                    name="description" // Matches editFormData state key
                                    value={editFormData.description || ''}
                                    onChange={handleEditFormChange}
                                ></textarea>
                            </div>
                            <div className="form-group">
                                <label htmlFor="editPrice">Price (₹):</label>
                                <input
                                    type="number"
                                    id="editPrice"
                                    name="price" // Matches editFormData state key
                                    value={editFormData.price || ''}
                                    onChange={handleEditFormChange}
                                    step="0.01"
                                    min="0"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="editCategory">Category:</label>
                                <select
                                    id="editCategory"
                                    name="category" // Matches editFormData state key
                                    value={editFormData.category || ''}
                                    onChange={handleEditFormChange}
                                    required
                                >
                                    <option value="">Select Category</option>
                                    {categories.map(category => (
                                        <option key={category} value={category}>{category}</option>
                                    ))}
                                    {/* Add some common fixed categories too if preferred */}
                                    <option value="Pizza">Pizza</option>
                                    <option value="Pasta">Pasta</option>
                                    <option value="Salad">Salad</option>
                                    <option value="Main Course">Main Course</option>
                                    <option value="Dessert">Dessert</option>
                                    <option value="Beverage">Beverage</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label htmlFor="editImageUrl">Image URL:</label>
                                <input
                                    type="text"
                                    id="editImageUrl"
                                    name="imageUrl" // Matches editFormData state key
                                    value={editFormData.imageUrl || ''}
                                    onChange={handleEditFormChange}
                                />
                            </div>
                            <div className="checkbox-group">
                                <input
                                    type="checkbox"
                                    id="editIsAvailable"
                                    name="isAvailable" // Matches editFormData state key
                                    checked={editFormData.isAvailable || false}
                                    onChange={handleEditFormChange}
                                />
                                <label htmlFor="editIsAvailable">Available for Order</label>
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn-cancel" onClick={handleCloseEditModal}>
                                    Cancel
                                </button>
                                <button type="submit" className="submit" disabled={savingEdit}>
                                    {savingEdit ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
};

export default MenuList;
