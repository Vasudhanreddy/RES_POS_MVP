// restaurant-admin-app/src/components/Dashboard.js
import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, getDocs, Timestamp, orderBy } from 'firebase/firestore';
import './Dashboard.css';
import './DashboardCharts.css';
import OrdersManagement from './OrdersManagement';
import SalesOverviewChart from './SalesOverviewChart';
import { FaEllipsisV } from 'react-icons/fa';

// --- Helper functions for date calculations (MOVED OUTSIDE COMPONENT) ---
const getStartOfDay = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
};
const getEndOfDay = (date) => {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
};
const getStartOfPreviousDay = (date) => {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    d.setHours(0, 0, 0, 0);
    return d;
};
const getEndOfPreviousDay = (date) => {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    d.setHours(23, 59, 59, 999);
    return d;
};
const getStartOfWeek = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday being 0 (start of week Mon)
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
};
const getStartOfLastWeek = (date) => {
    const d = getStartOfWeek(date);
    d.setDate(d.getDate() - 7);
    return d;
};
const getStartOfMonth = (date) => {
    const d = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
    return d;
};
const getStartOfLastMonth = (date) => {
    const d = new Date(date.getFullYear(), date.getMonth() - 1, 1, 0, 0, 0, 0);
    return d;
};
const getStartOfYear = (date) => {
    const d = new Date(date.getFullYear(), 0, 1, 0, 0, 0, 0);
    return d;
};
const getStartOfLastYear = (date) => {
    const d = new Date(date.getFullYear() - 1, 0, 1, 0, 0, 0, 0);
    return d;
};
const getStartTime = (date, hoursAgo) => {
    const d = new Date(date);
    d.setHours(d.getHours() - hoursAgo);
    d.setMinutes(0, 0, 0);
    return d;
};

const Dashboard = ({ restaurantID, db, userRole, userUID }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [dashboardMetrics, setDashboardMetrics] = useState({
        currentPeriodOrders: 0,
        currentPeriodOrdersChange: 0,
        currentPeriodRevenue: 0,
        currentPeriodRevenueChange: 0,
        currentPeriodAverageOrder: 0,
        currentPeriodAverageOrderChange: 0,
        activeCustomers: 0, // This metric will remain fixed to "last hour"
        activeCustomersChange: 0, // This metric will remain fixed to "last hour"
    });
    const [analyticsTimeRange, setAnalyticsTimeRange] = useState('Today'); // Default to 'Today'

    // --- Data Fetching and Metrics Calculation ---
    useEffect(() => {
        if (!db) {
            setError("Firebase Firestore is not initialized.");
            setLoading(false);
            return;
        }

        if (!restaurantID) {
            setError("No Restaurant ID provided. Cannot load dashboard data.");
            setLoading(false);
            return;
        }

        const fetchDashboardData = async () => {
            setLoading(true);
            setError(null);
            try {
                const today = new Date(); // Use a consistent 'today' for all relative calculations

                let currentPeriodStart, currentPeriodEnd;
                let previousPeriodStart, previousPeriodEnd; // For comparison

                // Determine dynamic periods based on analyticsTimeRange
                switch (analyticsTimeRange) {
                    case 'Today':
                        currentPeriodStart = getStartOfDay(today);
                        currentPeriodEnd = getEndOfDay(today);
                        previousPeriodStart = getStartOfPreviousDay(today);
                        previousPeriodEnd = getEndOfPreviousDay(today);
                        break;
                    case 'Week':
                        currentPeriodStart = getStartOfWeek(today);
                        currentPeriodEnd = getEndOfDay(today); // Up to current moment of today
                        previousPeriodStart = getStartOfLastWeek(today);
                        previousPeriodEnd = getStartOfWeek(today); // End of last week is start of this week
                        break;
                    case 'Month':
                        currentPeriodStart = getStartOfMonth(today);
                        currentPeriodEnd = getEndOfDay(today); // Up to current moment of today
                        previousPeriodStart = getStartOfLastMonth(today);
                        previousPeriodEnd = getStartOfMonth(today); // End of last month is start of this month
                        break;
                    case 'Year':
                        currentPeriodStart = getStartOfYear(today);
                        currentPeriodEnd = getEndOfDay(today); // Up to current moment of today
                        previousPeriodStart = getStartOfLastYear(today);
                        previousPeriodEnd = getStartOfYear(today); // End of last year is start of this year
                        break;
                    default: // Fallback to 'Today' if an unknown range is somehow set
                        currentPeriodStart = getStartOfDay(today);
                        currentPeriodEnd = getEndOfDay(today);
                        previousPeriodStart = getStartOfPreviousDay(today);
                        previousPeriodEnd = getEndOfPreviousDay(today);
                        break;
                }

                // For 'Active Customers', we still need data from the last two hours regardless of `analyticsTimeRange`.
                const oneHourAgo = getStartTime(today, 1);
                const twoHoursAgo = getStartTime(today, 2);

                // Determine the earliest date we need to fetch from Firestore
                // This will be the earliest of (previousPeriodStart, twoHoursAgo)
                const earliestDateNeeded = new Date(
                    Math.min(
                        currentPeriodStart.getTime(),
                        previousPeriodStart.getTime(),
                        twoHoursAgo.getTime() // Ensure we fetch enough for active customers
                    )
                );

                const ordersQuery = query(
                    collection(db, 'resturent', restaurantID, 'orders'),
                    where('createdAt', '>=', Timestamp.fromDate(earliestDateNeeded)),
                    orderBy('createdAt', 'desc')
                );

                const snapshot = await getDocs(ordersQuery);
                const allFetchedOrders = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    createdAt: doc.data().createdAt?.toDate(),
                }));

                // --- Filter orders into relevant periods ---
                const currentPeriodOrders = allFetchedOrders.filter(order =>
                    order.createdAt && order.createdAt >= currentPeriodStart && order.createdAt <= currentPeriodEnd
                );

                const previousPeriodOrders = allFetchedOrders.filter(order =>
                    order.createdAt && order.createdAt >= previousPeriodStart && order.createdAt < previousPeriodEnd
                );

                // --- Calculate Metrics for Current Period ---
                const currentOrdersCount = currentPeriodOrders.length;
                const currentRevenue = currentPeriodOrders
                    .filter(o => o.orderStatus === 'completed' && typeof o.totalAmount === 'number')
                    .reduce((sum, o) => sum + o.totalAmount, 0);
                const currentOrderCountForAvg = currentPeriodOrders
                    .filter(o => o.orderStatus === 'completed' && typeof o.totalAmount === 'number').length;
                const currentAverageOrder = currentOrderCountForAvg > 0 ? currentRevenue / currentOrderCountForAvg : 0;

                // --- Calculate Metrics for Previous Period (for comparison) ---
                const prevOrdersCount = previousPeriodOrders.length;
                const prevRevenue = previousPeriodOrders
                    .filter(o => o.orderStatus === 'completed' && typeof o.totalAmount === 'number')
                    .reduce((sum, o) => sum + o.totalAmount, 0);
                const prevOrderCountForAvg = previousPeriodOrders
                    .filter(o => o.orderStatus === 'completed' && typeof o.totalAmount === 'number').length;
                const prevAverageOrder = prevOrderCountForAvg > 0 ? prevRevenue / prevOrderCountForAvg : 0;

                // --- Calculate Changes ---
                const ordersChange = prevOrdersCount > 0
                    ? ((currentOrdersCount - prevOrdersCount) / prevOrdersCount) * 100
                    : (currentOrdersCount > 0 ? 100 : 0);

                const revenueChange = prevRevenue > 0
                    ? ((currentRevenue - prevRevenue) / prevRevenue) * 100
                    : (currentRevenue > 0 ? 100 : 0);

                const averageOrderChange = prevAverageOrder > 0
                    ? ((currentAverageOrder - prevAverageOrder) / prevAverageOrder) * 100
                    : (currentAverageOrder > 0 ? 100 : 0);

                // --- Active Customers (remains based on last hour) ---
                const activeCustomersThisHour = new Set();
                const activeCustomersLastHour = new Set();
                allFetchedOrders.forEach(order => {
                    if (order.createdAt) {
                        if (order.createdAt >= oneHourAgo && order.customerEmail) {
                            activeCustomersThisHour.add(order.customerEmail);
                        }
                        if (order.createdAt >= twoHoursAgo && order.createdAt < oneHourAgo && order.customerEmail) {
                            activeCustomersLastHour.add(order.customerEmail);
                        }
                    }
                });
                const activeCustomersCurrentHourCount = activeCustomersThisHour.size;
                const activeCustomersLastHourCount = activeCustomersLastHour.size;
                const activeCustomersChange = activeCustomersLastHourCount > 0
                    ? ((activeCustomersCurrentHourCount - activeCustomersLastHourCount) / activeCustomersLastHourCount) * 100
                    : (activeCustomersCurrentHourCount > 0 ? 100 : 0);

                setDashboardMetrics({
                    currentPeriodOrders: currentOrdersCount,
                    currentPeriodOrdersChange: parseFloat(ordersChange.toFixed(1)),
                    currentPeriodRevenue: currentRevenue,
                    currentPeriodRevenueChange: parseFloat(revenueChange.toFixed(1)),
                    currentPeriodAverageOrder: currentAverageOrder,
                    currentPeriodAverageOrderChange: parseFloat(averageOrderChange.toFixed(1)),
                    activeCustomers: activeCustomersCurrentHourCount,
                    activeCustomersChange: parseFloat(activeCustomersChange.toFixed(1)),
                });

            } catch (err) {
                console.error("Error fetching dashboard data:", err);
                setError("Failed to load dashboard data. Please check console for details.");
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();

    }, [restaurantID, db, analyticsTimeRange]); // <--- CRUCIAL: ADD analyticsTimeRange here

    const renderTrend = (value, unit = '%') => {
        if (isNaN(value) || value === 0) return <span className="trend-neutral">0{unit}</span>;
        const isPositive = value > 0;
        const trendClass = isPositive ? 'trend-positive' : 'trend-negative';
        const arrow = isPositive ? '▲' : '▼';
        return (
            <span className={`trend ${trendClass}`}>
                {arrow} {Math.abs(value)}{unit}
            </span>
        );
    };

    const getPeriodLabel = (metricName) => {
        const baseLabels = {
            'orders': 'Orders',
            'revenue': 'Revenue',
            'averageOrder': 'Average Order',
        };

        const periodMap = {
            'Today': 'Today\'s',
            'Week': 'This Week\'s',
            'Month': 'This Month\'s',
            'Year': 'This Year\'s',
        };

        const comparisonMap = {
            'Today': 'from yesterday',
            'Week': 'from last week',
            'Month': 'from last month',
            'Year': 'from last year',
        };

        if (metricName === 'activeCustomers') {
            return { title: 'Active Customers', comparison: 'from last hour' };
        }

        const baseMetric = metricName.replace('currentPeriod', '').toLowerCase(); // 'orders', 'revenue', etc.
        const title = `${periodMap[analyticsTimeRange] || periodMap['Today']} ${baseLabels[baseMetric]}`;
        const comparison = comparisonMap[analyticsTimeRange] || comparisonMap['Today'];

        return { title, comparison };
    };


    if (loading) {
        return <div className="dashboard-loading">Loading Dashboard...</div>;
    }

    if (error) {
        return <div className="dashboard-error">{error}</div>;
    }

    const ordersLabels = getPeriodLabel('currentPeriodOrders');
    const revenueLabels = getPeriodLabel('currentPeriodRevenue');
    const averageOrderLabels = getPeriodLabel('currentPeriodAverageOrder');
    const activeCustomersLabels = getPeriodLabel('activeCustomers');


    return (
        <div className="dashboard-container">
            <div className="analytics-overview-header">
                <h2>Analytics Overview</h2>
                <div className="time-range-filters">
                    {['Today', 'Week', 'Month', 'Year'].map(range => (
                        <button
                            key={range}
                            className={analyticsTimeRange === range ? 'active' : ''}
                            onClick={() => setAnalyticsTimeRange(range)}
                        >
                            {range}
                        </button>
                    ))}
                </div>
            </div>

            <div className="dashboard-metrics-grid">
                <div className="metric-card">
                    <div className="metric-header">
                        <h3>{ordersLabels.title}</h3> {/* Dynamic Title */}
                        <span className="metric-icon">🍔</span>
                    </div>
                    <p className="metric-value">{dashboardMetrics.currentPeriodOrders}</p>
                    <p className="metric-trend">{renderTrend(dashboardMetrics.currentPeriodOrdersChange)} {ordersLabels.comparison}</p> {/* Dynamic Comparison */}
                </div>

                <div className="metric-card">
                    <div className="metric-header">
                        <h3>{revenueLabels.title}</h3> {/* Dynamic Title */}
                        <span className="metric-icon">💰</span>
                    </div>
                    <p className="metric-value">₹{dashboardMetrics.currentPeriodRevenue.toFixed(2)}</p>
                    <p className="metric-trend">{renderTrend(dashboardMetrics.currentPeriodRevenueChange)} {revenueLabels.comparison}</p> {/* Dynamic Comparison */}
                </div>

                <div className="metric-card">
                    <div className="metric-header">
                        <h3>{averageOrderLabels.title}</h3> {/* Dynamic Title */}
                        <span className="metric-icon">🛒</span>
                    </div>
                    <p className="metric-value">₹{dashboardMetrics.currentPeriodAverageOrder.toFixed(2)}</p>
                    <p className="metric-trend">{renderTrend(dashboardMetrics.currentPeriodAverageOrderChange)} {averageOrderLabels.comparison}</p> {/* Dynamic Comparison */}
                </div>

                <div className="metric-card">
                    <div className="metric-header">
                        <h3>{activeCustomersLabels.title}</h3>
                        <span className="metric-icon">🧑‍🤝‍🧑</span>
                    </div>
                    <p className="metric-value">{dashboardMetrics.activeCustomers}</p>
                    <p className="metric-trend">{renderTrend(dashboardMetrics.activeCustomersChange)} {activeCustomersLabels.comparison}</p>
                </div>
            </div>

            <div className="dashboard-charts-grid">
                <div className="chart-card">
                    <div className="chart-card-header">
                        <h3>Sales Overview</h3>
                        <button className="chart-card-menu-icon"><FaEllipsisV /></button>
                    </div>
                    {restaurantID && <SalesOverviewChart restaurantID={restaurantID} timeRange={analyticsTimeRange} db={db} />}
                </div>
            </div>

            <div className="dashboard-order-management-section">
                <h2 style={{marginTop: '40px', textAlign: 'center'}}>Order Management</h2>
                <OrdersManagement restaurantID={restaurantID} db={db} userRole={userRole} userUID={userUID} />
            </div>
        </div>
    );
};

export default Dashboard;