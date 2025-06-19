// restaurant-customer-app/src/components/CustomerMenu.js

import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useCart } from '../context/CartContext';
import './CustomerMenu.css'; // Make sure this CSS file exists and is linked

const CustomerMenu = ({ restaurantID, user }) => { // Added 'user' prop for welcome message
  const { addToCart } = useCart();
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addingToCart, setAddingToCart] = useState({}); // To track loading state for individual "Add to Cart" buttons

  // States for Filter and Search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All'); // State to track selected category

  useEffect(() => {
    if (!restaurantID) {
      setError("No Restaurant ID provided. Please contact support.");
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'resturent', restaurantID, 'products'),
      orderBy('category', 'asc'),
      orderBy('name', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMenuItems(items);
      setLoading(false);
      setError(null);
      console.log("Customer Menu Items Fetched:", items);
    }, (err) => {
      console.error("Error fetching customer menu items:", err);
      setError("Failed to load menu. Please try again later.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [restaurantID]);

  // Memoized list of available categories
  const availableCategories = useMemo(() => {
    const categories = new Set(menuItems.map(item => item.category).filter(Boolean));
    return ['All', ...Array.from(categories).sort()];
  }, [menuItems]);

  // Memoized filtered and searched items
  const filteredAndSearchedItems = useMemo(() => {
    let filtered = menuItems.filter(item => item.isAvailable); // Always filter by availability for customer view

    // Apply category filter FIRST
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }

    // Apply search term filter
    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(lowerCaseSearchTerm) ||
        (item.description && item.description.toLowerCase().includes(lowerCaseSearchTerm))
      );
    }
    return filtered;
  }, [menuItems, selectedCategory, searchTerm]); // Dependencies: menuItems, selectedCategory, searchTerm

  // Group items by category (if 'All' is selected, this will still group them, but we'll display differently)
  const groupedItems = useMemo(() => {
    // If 'All' is selected, we want to display all items grouped by their categories.
    // If a specific category is selected, we only want to display items from that category.
    const itemsToGroup = selectedCategory === 'All' ? filteredAndSearchedItems : filteredAndSearchedItems.filter(item => item.category === selectedCategory);

    return itemsToGroup.reduce((acc, item) => {
      const category = item.category || 'Uncategorized';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(item);
      return acc;
    }, {});
  }, [filteredAndSearchedItems, selectedCategory]);

  const categoriesToDisplay = Object.keys(groupedItems).sort();
  // --- End Filtering and Searching Logic ---

  // Function to handle adding item to cart with loading state
  const handleAddToCart = async (item) => {
    setAddingToCart(prev => ({ ...prev, [item.id]: true }));
    console.log(`Adding ${item.name} (ID: ${item.id}) to cart...`);
    addToCart(item); // Pass the item to the cart context
    await new Promise(resolve => setTimeout(resolve, 300)); // Simulate a quick add
    setAddingToCart(prev => ({ ...prev, [item.id]: false }));
  };

  // Function to handle category selection
  const handleCategoryClick = (category) => {
    setSelectedCategory(category);
    setSearchTerm(''); // Clear search term when changing category for cleaner UX
  };

  if (loading) {
    return <div className="customer-loading">Loading Our Delicious Menu...</div>;
  }

  if (error) {
    return <div className="customer-error">{error}</div>;
  }

  return (
    <div className="customer-menu-container">
      {/* Page Title and Welcome Messages */}
      <h2 className="menu-page-title">Our Delicious Menu</h2>
      {user && user.displayName && (
        <p className="menu-welcome-message">Welcome, {user.displayName}!</p>
      )}
      <p className="menu-restaurant-id">Viewing menu for Restaurant ID: {restaurantID}</p>
      
      {/* Category Selector Bar (Horizontal Scrollable) */}
      <div className="category-selector-bar">
        {availableCategories.map(cat => (
          <button
            key={cat}
            className={`category-button ${selectedCategory === cat ? 'active' : ''}`}
            onClick={() => handleCategoryClick(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Search Input - placed below categories */}
      <div className="menu-search-input-wrapper">
        <input
          type="text"
          placeholder="Search items by name or description..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>


      {/* Display filtered and grouped items */}
      {filteredAndSearchedItems.length === 0 ? (
        <p className="no-items-message">
          {searchTerm || selectedCategory !== 'All'
            ? "No items match your search/filter criteria for this category."
            : "No menu items available for this restaurant yet. Check back soon!"
          }
        </p>
      ) : (
        <div className="menu-categories-list">
          {/* If 'All' is selected, iterate through all categories.
              Otherwise, just show the selected category's items. */}
          {selectedCategory === 'All' ? (
            categoriesToDisplay.map(category => (
              <section key={category} className="menu-category-section">
                <h3>{category}</h3>
                <div className="menu-items-grid">
                  {groupedItems[category].map(item => (
                    <div key={item.id} className="menu-item-card">
                      <div className="item-image-container">
                        <img
                          src={item.imageUrl || 'https://placehold.co/150x150/f0f0f0/333333?text=No+Image'}
                          alt={item.name}
                          onError={(e) => {
                              if (e.target.src !== 'https://placehold.co/150x150/f0f0f0/333333?text=No+Image') {
                                  e.target.onerror = null;
                                  e.target.src = 'https://placehold.co/150x150/f0f0f0/333333?text=No+Image';
                                  console.warn(`Image for ${item.name} failed to load. Displaying placeholder.`);
                              }
                          }}
                        />
                      </div>
                      <div className="item-details">
                        <h4>{item.name}</h4>
                        <p className="item-description">{item.description || 'No description available.'}</p>
                        <p className="item-price">₹{item.price ? item.price.toFixed(2) : '0.00'}</p>
                      </div>
                      <button
                        className="add-to-cart-button"
                        onClick={() => handleAddToCart(item)}
                        disabled={addingToCart[item.id] || !item.isAvailable}
                      >
                        {addingToCart[item.id] ? 'Adding...' : 'Add to Cart'}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            ))
          ) : (
            // Display only the selected category's items (without a section header)
            <div className="menu-items-grid-single-category"> {/* New class for single category view */}
              {filteredAndSearchedItems.map(item => ( // Use filteredAndSearchedItems directly here for single category
                <div key={item.id} className="menu-item-card">
                  <div className="item-image-container">
                    <img
                      src={item.imageUrl || 'https://placehold.co/150x150/f0f0f0/333333?text=No+Image'}
                      alt={item.name}
                      onError={(e) => {
                          if (e.target.src !== 'https://placehold.co/150x150/f0f0f0/333333?text=No+Image') {
                              e.target.onerror = null;
                              e.target.src = 'https://placehold.co/150x150/f0f0f0/333333?text=No+Image';
                              console.warn(`Image for ${item.name} failed to load. Displaying placeholder.`);
                          }
                      }}
                    />
                  </div>
                  <div className="item-details">
                    <h4>{item.name}</h4>
                    <p className="item-description">{item.description || 'No description available.'}</p>
                    <p className="item-price">₹{item.price ? item.price.toFixed(2) : '0.00'}</p>
                  </div>
                  <button
                    className="add-to-cart-button"
                    onClick={() => handleAddToCart(item)}
                    disabled={addingToCart[item.id] || !item.isAvailable}
                  >
                    {addingToCart[item.id] ? 'Adding...' : 'Add to Cart'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CustomerMenu;
