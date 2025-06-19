// restaurant-admin-app/src/components/PopularItemsChart.js
import React, { useState, useEffect } from 'react'; // FIX: Corrected '=>' to 'from'
import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import './DashboardCharts.css';

ChartJS.register(ArcElement, Tooltip, Legend);

const PopularItemsChart = ({ restaurantID, timeRange }) => {
  const [chartData, setChartData] = useState({
    labels: [],
    datasets: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Define a set of consistent colors for the doughnut chart segments
  const chartColors = [
    '#007bff', // Blue (primary)
    '#28a745', // Green (success)
    '#ffc107', // Yellow (warning)
    '#dc3545', // Red (danger)
    '#6c757d', // Gray (secondary)
    '#17a2b8', // Cyan (info)
    '#6610f2', // Indigo
    '#e83e8c', // Pink
    '#6f42c1', // Purple
    '#20c997', // Teal
  ];


  useEffect(() => {
    // Helper to clone date to avoid mutation
    const cloneDate = (date) => new Date(date.getTime());

    const fetchPopularItems = async () => {
      if (!restaurantID) {
        setError("Restaurant ID is missing. Cannot load popular items data.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        let startDate, endDate;
        const now = new Date();

        // --- Determine Date Range ---
        if (timeRange === 'Today') {
          startDate = cloneDate(now);
          startDate.setHours(0, 0, 0, 0);
          endDate = cloneDate(now);
          endDate.setHours(23, 59, 59, 999);
        } else if (timeRange === 'Week') {
          startDate = cloneDate(now);
          startDate.setDate(now.getDate() - now.getDay()); // Start of the current week (Sunday)
          startDate.setHours(0, 0, 0, 0);

          endDate = cloneDate(startDate);
          endDate.setDate(startDate.getDate() + 6); // End of Saturday
          endDate.setHours(23, 59, 59, 999);
        } else if (timeRange === 'Month') {
          startDate = new Date(now.getFullYear(), now.getMonth(), 1); // Start of the current month
          startDate.setHours(0, 0, 0, 0);

          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0); // Last day of current month
          endDate.setHours(23, 59, 59, 999);
        } else if (timeRange === 'Year') {
          startDate = new Date(now.getFullYear(), 0, 1); // Start of the current year
          startDate.setHours(0, 0, 0, 0);

          endDate = new Date(now.getFullYear(), 11, 31); // End of current year
          endDate.setHours(23, 59, 59, 999);
        } else {
          // Default to 'Today' if timeRange is not recognized or invalid
          console.warn("Invalid timeRange, defaulting to 'Today'.");
          setLoading(false);
          return;
        }

        // --- Firestore Query ---
        // !!! FIX: Changed 'resturent' to 'restaurants' !!!
        const ordersRef = collection(db, 'resturent', restaurantID, 'orders');
        const q = query(
          ordersRef,
          where('createdAt', '>=', Timestamp.fromDate(startDate)),
          where('createdAt', '<=', Timestamp.fromDate(endDate)), // Added endDate for a defined range
          where('orderStatus', '==', 'completed') // Only count items from completed sales
        );

        const querySnapshot = await getDocs(q);
        const itemCounts = {}; // { 'Item Name': count }

        querySnapshot.forEach(doc => {
          const order = doc.data();
          if (order.orderItems && Array.isArray(order.orderItems)) {
            order.orderItems.forEach(item => {
              itemCounts[item.name] = (itemCounts[item.name] || 0) + (item.quantity || 0); // Ensure quantity is handled
            });
          }
        });

        // Sort items by count and take top N, group others
        const sortedItems = Object.entries(itemCounts).sort(([, a], [, b]) => b - a);
        const topItems = sortedItems.slice(0, 4); // Top 4 items
        let otherItemsCount = 0;
        sortedItems.slice(4).forEach(([, count]) => {
          otherItemsCount += count;
        });

        const labels = topItems.map(([name]) => name);
        const data = topItems.map(([, count]) => count);

        if (otherItemsCount > 0) {
          labels.push('Other Items');
          data.push(otherItemsCount);
        }

        // Assign colors dynamically based on the number of segments
        const assignedColors = labels.map((_, index) => chartColors[index % chartColors.length]);


        setChartData({
          labels: labels,
          datasets: [
            {
              data: data,
              backgroundColor: assignedColors, // Use the dynamically assigned colors
              borderColor: '#ffffff', // White border between segments
              borderWidth: 2,
            },
          ],
        });

      } catch (err) {
        console.error("Error fetching popular items data:", err);
        setError("Failed to load popular items data. Please check console for details.");
      } finally {
        setLoading(false);
      }
    };

    fetchPopularItems();
  }, [restaurantID, timeRange, chartColors]); // Added chartColors to dependency array

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right', // Legend on the right as per screenshot
        labels: {
          boxWidth: 20, // Small box width for legend
          padding: 10,
          font: {
            size: 12
          },
          color: 'var(--color-text-secondary)' // Legend label color
        }
      },
      tooltip: {
        backgroundColor: 'var(--color-background-secondary)',
        titleColor: 'var(--color-text-primary)',
        bodyColor: 'var(--color-text-secondary)',
        borderColor: 'var(--color-border-default)',
        borderWidth: 1,
        cornerRadius: 4,
        padding: 10,
        callbacks: {
          label: function(context) {
            let label = context.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed !== null) {
              label += context.parsed; // Display count directly
            }
            return label;
          }
        }
      }
    }
  };

  if (loading) return <div className="chart-loading">Loading popular items...</div>;
  if (error || chartData.labels.length === 0) {
    return (
      <div className="chart-error">
        {error || "No popular items data available for this period."}
      </div>
    );
  }

  return (
    <div className="chart-container-wrapper chart-doughnut">
      <Doughnut data={chartData} options={options} />
    </div>
  );
  
};

export default PopularItemsChart;