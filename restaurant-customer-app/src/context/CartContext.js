// restaurant-customer-app/src/context/CartContext.js

import React, { createContext, useState, useContext, useEffect } from 'react';

// Define the localStorage key for the cart
const LOCAL_STORAGE_CART_KEY = 'restaurant_customer_cart_items';

// Create the context
const CartContext = createContext();

// Create a custom hook to use the cart context
export const useCart = () => {
  return useContext(CartContext);
};

// Create the Cart Provider component
export const CartProvider = ({ children }) => {
  // Initialize cartItems state by trying to load from localStorage
  const [cartItems, setCartItems] = useState(() => {
    try {
      const storedCartItems = localStorage.getItem(LOCAL_STORAGE_CART_KEY);
      return storedCartItems ? JSON.parse(storedCartItems) : [];
    } catch (error) {
      // Handle potential errors (e.g., localStorage not available, malformed JSON)
      console.error("Failed to load cart from localStorage:", error);
      return []; // Return empty array if there's an error loading
    }
  });

  // Use useEffect to save cartItems to localStorage whenever cartItems changes
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_CART_KEY, JSON.stringify(cartItems));
    } catch (error) {
      console.error("Failed to save cart to localStorage:", error);
    }
  }, [cartItems]); // Dependency array: run effect whenever cartItems changes


  // Function to add an item to the cart or increase its quantity
  const addToCart = (item) => {
    setCartItems(prevItems => {
      const existingItemIndex = prevItems.findIndex(cartItem => cartItem.id === item.id);

      if (existingItemIndex > -1) {
        // Item already in cart, increase quantity
        const updatedItems = [...prevItems];
        updatedItems[existingItemIndex] = {
          ...updatedItems[existingItemIndex],
          quantity: updatedItems[existingItemIndex].quantity + 1,
        };
        return updatedItems;
      } else {
        // Item not in cart, add it with quantity 1
        return [...prevItems, { ...item, quantity: 1 }];
      }
    });
  };

  // Function to decrease item quantity or remove if quantity becomes 0
  const removeFromCart = (itemId) => {
    setCartItems(prevItems => {
      const existingItemIndex = prevItems.findIndex(cartItem => cartItem.id === itemId);

      if (existingItemIndex > -1) {
        const updatedItems = [...prevItems];
        if (updatedItems[existingItemIndex].quantity > 1) {
          updatedItems[existingItemIndex] = {
            ...updatedItems[existingItemIndex],
            quantity: updatedItems[existingItemIndex].quantity - 1,
          };
        } else {
          // Remove item if quantity is 1 or less
          updatedItems.splice(existingItemIndex, 1);
        }
        return updatedItems;
      }
      return prevItems; // No change if item not found
    });
  };

  // Function to completely remove an item from the cart
  const removeItemCompletely = (itemId) => {
    setCartItems(prevItems => prevItems.filter(item => item.id !== itemId));
  };

  // Function to clear the entire cart
  const clearCart = () => {
    setCartItems([]);
  };

  // Calculate total items and total amount
  const cartTotalItems = cartItems.reduce((total, item) => total + item.quantity, 0);
  const cartTotalAmount = cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);

  const contextValue = {
    cartItems,
    addToCart,
    removeFromCart,
    removeItemCompletely,
    clearCart,
    cartTotalItems,
    cartTotalAmount,
  };

  return (
    <CartContext.Provider value={contextValue}>
      {children}
    </CartContext.Provider>
  );
};
