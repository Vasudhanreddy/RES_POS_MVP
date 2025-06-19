// restaurant-admin-app/src/components/Dashboard.js
import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, getDocs, Timestamp, orderBy } from 'firebase/firestore';
import './Dashboard.css';
import './DashboardCharts.css';
import OrdersManagement from './OrdersManagement';
import SalesOverviewChart from './SalesOverviewChart';
import { FaEllipsisV } from 'react-icons/fa';

// Dashboard now accepts 'db', 'userRole', and 'userUID' as props
const Dashboard = ({ restaurantID, db, userRole, userUID }) => { // <--- ADDED userRole, userUID HERE
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [dashboardMetrics, setDashboardMetrics] = useState({
        todaysOrders: 0,
        todaysOrdersChange: 0,
        totalRevenue: 0,
        totalRevenueChange: 0,
        averageOrder: 0,
        averageOrderChange: 0,
        activeCustomers: 0,
        activeCustomersChange: 0,
    });
    const [analyticsTimeRange, setAnalyticsTimeRange] = useState('Today');

    // --- Helper functions for date calculations ---
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
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        d.setDate(diff);
        d.setHours(0, 0, 0, 0);
        return d;
    };
    const getStartOfLastWeek = (date) => {
        const d = getStartOfWeek(date);
        d.setDate(d.getDate() - 7);
        return d;
    };
    const getStartTime = (date, hoursAgo) => {
        const d = new Date(date);
        d.setHours(d.getHours() - hoursAgo);
        d.setMinutes(0, 0, 0);
        return d;
    };

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
                const today = new Date();
                const startOfToday = getStartOfDay(today);
                const endOfToday = getEndOfDay(today);
                const startOfYesterday = getStartOfPreviousDay(today);
                const endOfYesterday = getEndOfPreviousDay(today);
                const startOfThisWeek = getStartOfWeek(today);
                const startOfLastWeekCompare = getStartOfLastWeek(today);
                const oneHourAgo = getStartTime(today, 1);
                const twoHoursAgo = getStartTime(today, 2);

                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

                const ordersQuery = query(
                    collection(db, 'resturent', restaurantID, 'orders'),
                    where('createdAt', '>=', Timestamp.fromDate(thirtyDaysAgo)),
                    orderBy('createdAt', 'desc')
                );

                const snapshot = await getDocs(ordersQuery);
                const allFetchedOrders = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    createdAt: doc.data().createdAt?.toDate(),
                }));

                let todaysOrdersCount = 0;
                let yesterdayOrdersCount = 0;
                let thisWeekRevenue = 0;
                let lastWeekRevenue = 0;
                let thisWeekOrderCount = 0;
                let lastWeekOrderCount = 0;
                const activeCustomersThisHour = new Set();
                const activeCustomersLastHour = new Set();

                allFetchedOrders.forEach(order => {
                    if (order.createdAt) {
                        if (order.createdAt >= startOfToday && order.createdAt <= endOfToday) {
                            todaysOrdersCount++;
                        }
                        if (order.createdAt >= startOfYesterday && order.createdAt <= endOfYesterday) {
                            yesterdayOrdersCount++;
                        }

                        if (order.orderStatus === 'completed' && order.totalAmount) {
                            if (order.createdAt >= startOfThisWeek) {
                                thisWeekRevenue += order.totalAmount;
                                thisWeekOrderCount++;
                            } else if (order.createdAt >= startOfLastWeekCompare && order.createdAt < startOfThisWeek) {
                                lastWeekRevenue += order.totalAmount;
                                lastWeekOrderCount++;
                            }
                        }

                        if (order.createdAt >= oneHourAgo && order.customerEmail) {
                            activeCustomersThisHour.add(order.customerEmail);
                        }
                        if (order.createdAt >= twoHoursAgo && order.createdAt < oneHourAgo && order.customerEmail) {
                            activeCustomersLastHour.add(order.customerEmail);
                        }
                    }
                });

                const todaysOrdersChange = yesterdayOrdersCount > 0
                    ? ((todaysOrdersCount - yesterdayOrdersCount) / yesterdayOrdersCount) * 100
                    : (todaysOrdersCount > 0 ? 100 : 0);

                const totalRevenueChange = lastWeekRevenue > 0
                    ? ((thisWeekRevenue - lastWeekRevenue) / lastWeekRevenue) * 100
                    : (thisWeekRevenue > 0 ? 100 : 0);

                const averageOrderThisWeek = thisWeekOrderCount > 0 ? thisWeekRevenue / thisWeekOrderCount : 0;
                const averageOrderLastWeek = lastWeekOrderCount > 0 ? lastWeekRevenue / lastWeekOrderCount : 0;
                const averageOrderChange = averageOrderLastWeek > 0
                    ? ((averageOrderThisWeek - averageOrderLastWeek) / averageOrderLastWeek) * 100
                    : (averageOrderThisWeek > 0 ? 100 : 0);

                const activeCustomersCurrentHourCount = activeCustomersThisHour.size;
                const activeCustomersLastHourCount = activeCustomersLastHour.size;
                const activeCustomersChange = activeCustomersLastHourCount > 0
                    ? ((activeCustomersCurrentHourCount - activeCustomersLastHourCount) / activeCustomersLastHourCount) * 100
                    : (activeCustomersCurrentHourCount > 0 ? 100 : 0);

                setDashboardMetrics({
                    todaysOrders: todaysOrdersCount,
                    todaysOrdersChange: parseFloat(todaysOrdersChange.toFixed(1)),
                    totalRevenue: thisWeekRevenue,
                    totalRevenueChange: parseFloat(totalRevenueChange.toFixed(1)),
                    averageOrder: averageOrderThisWeek,
                    averageOrderChange: parseFloat(averageOrderChange.toFixed(1)),
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

    }, [
        restaurantID,
        db,
        getStartOfDay,
        getEndOfDay,
        getStartOfPreviousDay,
        getEndOfPreviousDay,
        getStartOfWeek,
        getStartOfLastWeek,
        getStartTime
    ]);

    const renderTrend = (value, unit = '%') => {
        if (value === 0) return <span className="trend-neutral">0{unit}</span>;
        const isPositive = value > 0;
        const trendClass = isPositive ? 'trend-positive' : 'trend-negative';
        const arrow = isPositive ? '▲' : '▼';
        return (
            <span className={`trend ${trendClass}`}>
                {arrow} {Math.abs(value)}{unit}
            </span>
        );
    };

    if (loading) {
        return <div className="dashboard-loading">Loading Dashboard...</div>;
    }

    if (error) {
        return <div className="dashboard-error">{error}</div>;
    }

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
                        <h3>Today's Orders</h3>
                        <span className="metric-icon">🍔</span>
                    </div>
                    <p className="metric-value">{dashboardMetrics.todaysOrders}</p>
                    <p className="metric-trend">{renderTrend(dashboardMetrics.todaysOrdersChange)} from yesterday</p>
                </div>

                <div className="metric-card">
                    <div className="metric-header">
                        <h3>Total Revenue</h3>
                        <span className="metric-icon">💰</span>
                    </div>
                    <p className="metric-value">₹{dashboardMetrics.totalRevenue.toFixed(2)}</p>
                    <p className="metric-trend">{renderTrend(dashboardMetrics.totalRevenueChange)} from last week</p>
                </div>

                <div className="metric-card">
                    <div className="metric-header">
                        <h3>Average Order</h3>
                        <span className="metric-icon">🛒</span>
                    </div>
                    <p className="metric-value">₹{dashboardMetrics.averageOrder.toFixed(2)}</p>
                    <p className="metric-trend">{renderTrend(dashboardMetrics.averageOrderChange)} from last week</p>
                </div>

                <div className="metric-card">
                    <div className="metric-header">
                        <h3>Active Customers</h3>
                        <span className="metric-icon">🧑‍🤝‍🧑</span>
                    </div>
                    <p className="metric-value">{dashboardMetrics.activeCustomers}</p>
                    <p className="metric-trend">{renderTrend(dashboardMetrics.activeCustomersChange)} from last hour</p>
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
                <OrdersManagement restaurantID={restaurantID} db={db} userRole={userRole} userUID={userUID} /> {/* <--- PASSED userRole, userUID HERE */}
            </div>
        </div>
    );
};

export default Dashboard;
