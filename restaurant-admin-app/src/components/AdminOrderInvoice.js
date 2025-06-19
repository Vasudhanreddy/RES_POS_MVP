// restaurant-admin-app/src/components/AdminOrderInvoice.js

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
// Removed direct import of db. It will now come from props.
// import { db } from '../firebaseConfig';
import './AdminOrderInvoice.css';
import { FaSpinner, FaPrint, FaDownload, FaArrowLeft } from 'react-icons/fa';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// AdminOrderInvoice now accepts 'db' as a prop
const AdminOrderInvoice = ({ restaurantID, db }) => {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [loadingOrder, setLoadingOrder] = useState(true);
  const [errorOrder, setErrorOrder] = useState(null);

  // States for invoice settings (now read-only here)
  const [restaurantName, setRestaurantName] = useState('Your Restaurant Name');
  const [restaurantAddress, setRestaurantAddress] = useState({
    street: '123 Restaurant Blvd',
    line2: '',
    city: 'Food City',
    zipCode: 'FC 12345',
    notes: ''
  });
  const [taxRate, setTaxRate] = useState(0.05); // Default 5%
  const [deliveryFee, setDeliveryFee] = useState(50); // Default 50
  const [restaurantEmail, setRestaurantEmail] = useState('info@restaurant.com');
  const [restaurantPhone, setRestaurantPhone] = useState('(123) 456-7890');


  const [loadingSettings, setLoadingSettings] = useState(true);
  const [errorSettings, setErrorSettings] = useState(null);

  const invoiceRef = useRef();

  // Effect to fetch order details
  useEffect(() => {
    // Ensure db is available before proceeding
    if (!db) {
        setErrorOrder("Firebase Firestore is not initialized.");
        setLoadingOrder(false);
        return;
    }

    if (!restaurantID || !orderId) {
      setErrorOrder("Missing Restaurant ID or Order ID.");
      setLoadingOrder(false);
      return;
    }

    const fetchOrderDetails = async () => {
      setLoadingOrder(true);
      setErrorOrder(null);
      try {
        const orderDocRef = doc(db, 'resturent', restaurantID, 'orders', orderId);
        const docSnap = await getDoc(orderDocRef);

        if (docSnap.exists()) {
          setOrder({ id: docSnap.id, ...docSnap.data() });
        } else {
          setErrorOrder("Order not found.");
        }
      } catch (err) {
        console.error("Error fetching order details for invoice:", err);
        setErrorOrder("Failed to load invoice details. Please try again.");
      } finally {
        setLoadingOrder(false);
      }
    };

    fetchOrderDetails();
  }, [restaurantID, orderId, db]); // Added db to dependency array

  // Effect to fetch global invoice settings
  useEffect(() => {
    // Ensure db is available before proceeding
    if (!db) {
        setErrorSettings("Firebase Firestore is not initialized.");
        setLoadingSettings(false);
        return;
    }

    if (!restaurantID) {
      setErrorSettings("Restaurant ID not provided for invoice settings.");
      setLoadingSettings(false);
      return;
    }

    const settingsDocRef = doc(db, 'resturent', restaurantID, 'settings', 'invoice_settings');

    const fetchSettings = async () => {
      setLoadingSettings(true);
      setErrorSettings(null);
      try {
        const docSnap = await getDoc(settingsDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setRestaurantName(data.restaurantName || 'Your Restaurant Name');
          setRestaurantAddress(data.restaurantAddress || {
            street: '', line2: '', city: '', zipCode: '', notes: ''
          });
          // Changed to 'defaultTaxRate' and 'defaultDeliveryFee' to match AdminProfile.js save logic
          setTaxRate(data.defaultTaxRate !== undefined ? parseFloat(data.defaultTaxRate) : 0.05);
          setDeliveryFee(data.defaultDeliveryFee !== undefined ? parseFloat(data.defaultDeliveryFee) : 50);
          setRestaurantEmail(data.restaurantEmail || 'info@restaurant.com');
          setRestaurantPhone(data.restaurantPhone || '(123) 456-7890');
        } else {
          console.log("No invoice settings found, using defaults. Admin needs to set them in profile.");
        }
      } catch (err) {
        console.error("Error fetching invoice settings:", err);
        setErrorSettings("Failed to load invoice settings. Please try again.");
      } finally {
        setLoadingSettings(false);
      }
    };

    fetchSettings();
  }, [restaurantID, db]); // Added db to dependency array


  const formatCurrency = (amount) => {
    return `₹${(amount || 0).toFixed(2)}`;
  };

  const formatDateForDisplay = (date) => {
    if (!date || !date.toDate) return 'N/A';
    const d = date instanceof Date ? date : date.toDate();
    return d.toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  const handlePrint = () => {
    const printContent = invoiceRef.current;
    if (printContent) {
      const printWindow = window.open('', '', 'height=800,width=800');
      printWindow.document.write('<html><head><title>Invoice</title>');
      const linkElements = document.querySelectorAll('link[rel="stylesheet"]');
      linkElements.forEach(link => {
        printWindow.document.write(`<link rel="stylesheet" href="${link.href}">`);
      });
      printWindow.document.write('<style>');
      printWindow.document.write(`
        @media print {
          body {
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .invoice-actions-bar, .navbar, .admin-app-header, .main-content > div:not(.invoice-wrapper) {
            display: none !important;
          }
          .invoice-wrapper {
            width: 100%;
            margin: 0;
            box-shadow: none;
            border-radius: 0;
            padding: 20mm;
          }
          .invoice-header, .invoice-details, .invoice-items, .invoice-summary, .invoice-footer {
            margin-bottom: 10mm;
          }
          body, .invoice-wrapper, .invoice-details p, .invoice-details span, .invoice-items table, .invoice-summary table {
            color: black !important;
          }
          .invoice-items th, .invoice-items td {
            border-color: #ccc !important;
          }
        }
      `);
      printWindow.document.write('</style></head><body>');
      printWindow.document.write('<div class="invoice-wrapper">' + printContent.innerHTML + '</div>');
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    } else {
      console.error("Invoice content reference not found for printing.");
    }
  };


  const handleDownloadPdf = async () => {
    const input = invoiceRef.current;
    if (input) {
      setLoadingOrder(true);
      try {
        const canvas = await html2canvas(input, {
          scale: 2,
          useCORS: true,
          windowWidth: input.scrollWidth,
          windowHeight: input.scrollHeight,
          logging: false
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgWidth = 210;
        const pageHeight = 297;
        const imgHeight = canvas.height * imgWidth / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft >= 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
        }

        pdf.save(`invoice_${orderId}.pdf`);
      } catch (err) {
        console.error("Error generating PDF:", err);
        setErrorOrder("Failed to generate PDF. Please try again.");
      } finally {
        setLoadingOrder(false);
      }
    } else {
      console.error("Invoice content reference not found for PDF generation.");
    }
  };


  if (loadingOrder || loadingSettings) {
    return (
      <div className="invoice-wrapper loading">
        <FaSpinner className="spinner-icon" />
        <p>Loading Invoice Details and Settings...</p>
      </div>
    );
  }

  if (errorOrder || errorSettings) {
    return <div className="invoice-wrapper error">{errorOrder || errorSettings}</div>;
  }

  if (!order) {
    return <div className="invoice-wrapper error">Invoice data not available.</div>;
  }

  // Calculate totals using fetched tax rate and delivery fee
  const subtotal = order.orderItems?.reduce((sum, item) => sum + (item.price * item.quantity), 0) || 0;
  const taxAmount = subtotal * taxRate; // Use fetched taxRate
  const actualDeliveryFee = order.orderType === 'delivery' ? deliveryFee : 0; // Use fetched deliveryFee
  const grandTotal = subtotal + taxAmount + actualDeliveryFee;

  return (
    <div className="invoice-page-container">
      <div className="invoice-actions-bar">
        <button className="invoice-back-button" onClick={() => window.history.back()}>
          <FaArrowLeft /> Back to Order History
        </button>
        <div className="invoice-actions">
          <button onClick={handlePrint} className="action-button print-button" disabled={loadingOrder}>
            {loadingOrder ? <FaSpinner className="spinner small-spinner" /> : <FaPrint />} Print Invoice
          </button>
          <button onClick={handleDownloadPdf} className="action-button download-button" disabled={loadingOrder}>
            {loadingOrder ? <FaSpinner className="spinner small-spinner" /> : <FaDownload />} Download PDF
          </button>
        </div>
      </div>

      <div className="invoice-wrapper" ref={invoiceRef}>
        <div className="invoice-header">
          <h1>Invoice</h1>
          <div className="restaurant-info">
            {/* Display fetched restaurant settings (read-only) */}
            <h2>{restaurantName || 'N/A'}</h2>
            <p>{restaurantAddress.street || ''}</p>
            {restaurantAddress.line2 && <p>{restaurantAddress.line2}</p>}
            <p>{restaurantAddress.city || ''}, {restaurantAddress.zipCode || ''}</p>
            {restaurantAddress.notes && <p>Notes: {restaurantAddress.notes}</p>}
            {/* Use fetched email and phone number */}
            <p>Email: {restaurantEmail || 'N/A'}</p>
            <p>Phone: {restaurantPhone || 'N/A'}</p>
          </div>
          <div className="invoice-meta">
            <p><strong>Invoice ID:</strong> {order.id.substring(0, 8)}</p>
            <p><strong>Order ID:</strong> {order.id}</p>
            <p><strong>Date:</strong> {formatDateForDisplay(order.createdAt)}</p>
          </div>
        </div>

        <div className="invoice-details">
          <div className="customer-info">
            <h3>Bill To:</h3>
            <p><strong>Name:</strong> {order.customerName || 'N/A'}</p>
            <p><strong>Email:</strong> {order.customerEmail || 'N/A'}</p>
            {order.deliveryAddress && (
              <>
                <p><strong>Address:</strong> {order.deliveryAddress.street || 'N/A'}</p>
                {order.deliveryAddress.line2 && <p><strong>Apt/Suite:</strong> {order.deliveryAddress.line2}</p>}
                <p>{order.deliveryAddress.city || 'N/A'}, {order.deliveryAddress.zipCode || 'N/A'}</p>
                {order.deliveryAddress.notes && <p><strong>Notes:</strong> {order.deliveryAddress.notes}</p>}
              </>
            )}
            <p><strong>Phone:</strong> {order.customerPhone || 'N/A'}</p>
          </div>
          <div className="order-summary-details">
            <h3>Order Type:</h3>
            <p className="order-type-badge">{order.orderType || 'N/A'}</p>
            <h3>Payment Status:</h3>
            <p className="payment-status-badge">{order.paymentStatus || 'N/A'}</p>
            <h3>Order Status:</h3>
            <p className={`order-status-invoice status-${order.orderStatus.replace(/\s+/g, '-').toLowerCase()}`}>{order.orderStatus || 'N/A'}</p>
          </div>
        </div>

        <div className="invoice-items">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Quantity</th>
                <th>Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {/* Ensure no extra whitespace between tr and td, and td and its content */}
              {order.orderItems?.map((item, index) => (
                <tr key={index}><td>{item.name}</td><td>{item.quantity}</td><td>{formatCurrency(item.price)}</td><td>{formatCurrency(item.price * item.quantity)}</td></tr>
              ))}
            </tbody>

          </table>
        </div>

        <div className="invoice-summary">
          <table>
            <tbody>
              {/* Ensure no extra whitespace between tr and td, and td and its content */}
              <tr><td>Subtotal:</td><td>{formatCurrency(subtotal)}</td></tr>
              <tr><td>Tax ({taxRate * 100}%):</td><td>{formatCurrency(taxAmount)}</td></tr>
              {order.orderType === 'delivery' && (
                <tr><td>Delivery Fee:</td><td>{formatCurrency(actualDeliveryFee)}</td></tr>
              )}
              <tr><td>Grand Total:</td><td>{formatCurrency(grandTotal)}</td></tr>
            </tbody>
          </table>
        </div>

        <div className="invoice-footer">
          <p>Thank you for your order!</p>
          <p>This is a computer generated invoice and does not require a signature.</p>
        </div>
      </div>
    </div>
  );
};

export default AdminOrderInvoice;
