// restaurant-admin-app/src/components/SalesOverviewChart.js
import React, { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler // For area fill
} from 'chart.js';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import './DashboardCharts.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const SalesOverviewChart = ({ restaurantID, timeRange }) => {
  const [chartData, setChartData] = useState({
    labels: [],
    datasets: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const cloneDate = (date) => new Date(date.getTime());

    const fetchSalesData = async () => {
      if (!restaurantID) {
        setError("Restaurant ID is missing. Cannot load sales data.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        let startDate, endDate;
        const now = new Date();
        let labels = [];
        const salesByPeriod = {}; // Holds aggregated sales data
        const orderCountByPeriod = {}; // NEW: Holds aggregated order counts

        // --- Determine Date Range and Initialize Labels ---
        if (timeRange === 'Today') {
          startDate = cloneDate(now);
          startDate.setHours(0, 0, 0, 0);
          endDate = cloneDate(now);
          endDate.setHours(23, 59, 59, 999);

          for (let i = 6; i <= 22; i += 2) { // 6 AM to 10 PM, every 2 hours
            const periodLabel = i < 10 ? `0${i} AM` : (i === 12 ? '12 PM' : (i > 12 ? `${i - 12} PM` : `${i} PM`));
            labels.push(periodLabel);
            salesByPeriod[periodLabel] = 0;
            orderCountByPeriod[periodLabel] = 0; // NEW: Initialize order count
          }
        } else if (timeRange === 'Week') {
          startDate = cloneDate(now);
          startDate.setDate(now.getDate() - now.getDay());
          startDate.setHours(0, 0, 0, 0);

          endDate = cloneDate(startDate);
          endDate.setDate(startDate.getDate() + 6);
          endDate.setHours(23, 59, 59, 999);

          for (let i = 0; i < 7; i++) {
            const date = cloneDate(startDate);
            date.setDate(startDate.getDate() + i);
            const label = dayNames[date.getDay()];
            labels.push(label);
            salesByPeriod[label] = 0;
            orderCountByPeriod[label] = 0; // NEW: Initialize order count
          }

        } else if (timeRange === 'Month') {
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          startDate.setHours(0, 0, 0, 0);

          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          endDate.setHours(23, 59, 59, 999);

          for (let i = 1; i <= endDate.getDate(); i++) {
            const label = i.toString();
            labels.push(label);
            salesByPeriod[label] = 0;
            orderCountByPeriod[label] = 0; // NEW: Initialize order count
          }
        } else if (timeRange === 'Year') {
          startDate = new Date(now.getFullYear(), 0, 1);
          startDate.setHours(0, 0, 0, 0);

          endDate = new Date(now.getFullYear(), 11, 31);
          endDate.setHours(23, 59, 59, 999);

          for (let i = 0; i < 12; i++) {
            const label = monthNames[i];
            labels.push(label);
            salesByPeriod[label] = 0;
            orderCountByPeriod[label] = 0; // NEW: Initialize order count
          }
        } else {
          console.warn("Invalid timeRange, defaulting to 'Today'.");
          setLoading(false);
          return;
        }

        // --- Firestore Query ---
        const ordersRef = collection(db, 'resturent', restaurantID, 'orders');
        const q = query(
          ordersRef,
          where('createdAt', '>=', Timestamp.fromDate(startDate)),
          where('createdAt', '<=', Timestamp.fromDate(endDate)),
          where('orderStatus', '==', 'completed')
        );

        const querySnapshot = await getDocs(q);

        // --- Aggregate Sales Data ---
        querySnapshot.forEach(doc => {
          const order = doc.data();
          const orderDate = order.createdAt.toDate();
          const totalAmount = order.totalAmount || 0;

          let periodLabel;
          if (timeRange === 'Today') {
            const hour = orderDate.getHours();
            const roundedHour = Math.floor(hour / 2) * 2;
            periodLabel = roundedHour < 10 ? `0${roundedHour} AM` : (roundedHour === 12 ? '12 PM' : (roundedHour > 12 ? `${roundedHour - 12} PM` : `${roundedHour} AM`));
          } else if (timeRange === 'Week') {
            periodLabel = dayNames[orderDate.getDay()];
          } else if (timeRange === 'Month') {
            periodLabel = orderDate.getDate().toString();
          } else if (timeRange === 'Year') {
            periodLabel = monthNames[orderDate.getMonth()];
          }

          if (periodLabel && salesByPeriod.hasOwnProperty(periodLabel)) {
            salesByPeriod[periodLabel] += totalAmount;
            orderCountByPeriod[periodLabel] += 1; // NEW: Increment actual order count
          }
        });

        const salesDataArray = labels.map(label => salesByPeriod[label]);
        const orderCountDataArray = labels.map(label => orderCountByPeriod[label]); // NEW: Get actual order counts

        setChartData({
          labels: labels,
          datasets: [
            {
              label: 'Sales (₹)',
              data: salesDataArray,
              borderColor: 'var(--color-success)',
              backgroundColor: 'var(--color-success-light)',
              fill: true,
              tension: 0.4,
              pointBackgroundColor: 'var(--color-success)',
              pointBorderColor: 'var(--color-background-primary)',
              pointRadius: 3,
              pointHoverRadius: 5,
            },
            {
                label: 'Orders Count',
                data: orderCountDataArray, // CORRECTED: Use the actual order count data
                borderColor: 'var(--color-info)',
                backgroundColor: 'var(--color-info-light)',
                fill: false,
                tension: 0.4,
                pointBackgroundColor: 'var(--color-info)',
                pointBorderColor: 'var(--color-background-primary)',
                pointRadius: 2,
                pointHoverRadius: 4,
            }
          ],
        });
      } catch (err) {
        console.error("Error fetching sales data:", err);
        setError("Failed to load sales data. Please check console for details.");
      } finally {
        setLoading(false);
      }
    };
  // ... (rest of the options and return statement remain the same)

    fetchSalesData();
  }, [restaurantID, timeRange]); // Re-fetch when timeRange or restaurantID changes

  const options = {
    responsive: true,
    maintainAspectRatio: false, // Allows flexible sizing
    plugins: {
      legend: {
        display: true, // FIX: Set to true to show legend as per screenshot
        position: 'top',
        labels: {
            color: 'var(--color-text-secondary)', // Label color
            font: {
                size: 12,
                weight: '600'
            }
        }
      },
      title: {
        display: false, // Title is handled by parent component (Dashboard.js)
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: 'var(--color-background-secondary)',
        titleColor: 'var(--color-text-primary)',
        bodyColor: 'var(--color-text-secondary)',
        borderColor: 'var(--color-border-default)',
        borderWidth: 1,
        cornerRadius: 4,
        padding: 10,
        callbacks: {
            label: function(context) {
                let label = context.dataset.label || '';
                if (label) {
                    label += ': ';
                }
                if (context.parsed.y !== null) {
                    label += `₹${context.parsed.y.toFixed(2)}`; // Format as currency
                }
                return label;
            }
        }
      },
    },
    scales: {
      x: {
        grid: {
          display: false // No vertical grid lines
        },
        ticks: {
            color: 'var(--color-text-secondary)' // X-axis label color
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'var(--color-border-default)' // Light grey horizontal grid lines
        },
        ticks: {
            color: 'var(--color-text-secondary)', // Y-axis label color
            callback: function(value) { // Format Y-axis labels as currency
                return '₹' + value.toLocaleString();
            }
        }
      }
    }
  };

  if (loading) return <div className="chart-loading">Loading sales data...</div>;
  if (error || chartData.labels.length === 0) {
    return (
      <div className="chart-error">
        {error || "No sales data available for this period or invalid time range selected."}
      </div>
    );
  }

  return (
    <div className="chart-container-wrapper">
      <Line data={chartData} options={options} />
    </div>
  );
};

export default SalesOverviewChart;