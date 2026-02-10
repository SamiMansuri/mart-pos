import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './layouts/Layout';
import BillsList from './pages/BillsList';
import CreateBill from './pages/CreateBill';
import LoginPage from './pages/LoginPage';
import CashierDashboard from './pages/CashierDashboard';
import AdminDashboard from './pages/AdminDashboard';
import BillHistory from './pages/BillHistory';
import AddProduct from './pages/AddProduct';
import ProductsList from './pages/ProductsList';
import UpdateProduct from './pages/UpdateProduct';
import CreateEmployee from './pages/CreateEmployee';
import EmployeeList from './pages/EmployeeList';
import ReturnBill from './pages/ReturnBill';
import AdminBillDetails from './pages/AdminBillDetails';
import Reports from './pages/Reports';
import StockEntry from './pages/StockEntry';
import { getUserInfo, isTokenExpired } from './utils/auth.utils';

// Guard for authenticated sessions
const AuthGuard = ({ children }) => {
  const user = getUserInfo();
  if (!user || isTokenExpired()) {
    // Clear potentially invalid/expired token
    localStorage.removeItem('token');
    return <Navigate to="/login" replace />;
  }
  return children;
};

// Guard for role-based access
const RoleGuard = ({ children, allowedRoles }) => {
  const user = getUserInfo();
  if (!user || isTokenExpired()) {
    localStorage.removeItem('token');
    return <Navigate to="/login" replace />;
  }
  if (!allowedRoles.includes(user.role)) {
    return (
      <Navigate to={user.role === 'admin' ? '/admin' : '/cashier'} replace />
    );
  }
  return children;
};

// Component to handle root redirect based on role
const RootRedirect = () => {
  const user = getUserInfo();
  if (!user || isTokenExpired()) {
    localStorage.removeItem('token');
    return <Navigate to="/login" replace />;
  }
  return (
    <Navigate to={user.role === 'admin' ? '/admin' : '/cashier'} replace />
  );
};

const NotFound = () => (
  <div className="text-center mt-5 py-5">
    <h1 className="display-1 fw-800 text-primary opacity-50">404</h1>
    <h4 className="fw-bold">TERMINAL NOT FOUND</h4>
    <p className="text-muted">The requested system node does not exist.</p>
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/"
          element={
            <AuthGuard>
              <Layout />
            </AuthGuard>
          }
        >
          <Route index element={<RootRedirect />} />

          {/* Cashier Routes - Accessible by both cashier and admin */}
          <Route
            path="cashier"
            element={
              <RoleGuard allowedRoles={['cashier', 'admin']}>
                <CashierDashboard />
              </RoleGuard>
            }
          />
          <Route
            path="cashier/return"
            element={
              <RoleGuard allowedRoles={['cashier', 'admin']}>
                <ReturnBill />
              </RoleGuard>
            }
          />
          <Route
            path="bills/create"
            element={
              <RoleGuard allowedRoles={['cashier']}>
                <CreateBill />
              </RoleGuard>
            }
          />
          <Route
            path="history"
            element={
              <RoleGuard allowedRoles={['cashier', 'admin']}>
                <BillHistory />
              </RoleGuard>
            }
          />

          {/* Admin Routes - Only accessible by admin */}
          <Route
            path="admin"
            element={
              <RoleGuard allowedRoles={['admin']}>
                <AdminDashboard />
              </RoleGuard>
            }
          />
          <Route
            path="admin/products/add"
            element={
              <RoleGuard allowedRoles={['admin']}>
                <AddProduct />
              </RoleGuard>
            }
          />
          <Route
            path="admin/products"
            element={
              <RoleGuard allowedRoles={['admin']}>
                <ProductsList />
              </RoleGuard>
            }
          />
          <Route
            path="admin/products/edit/:id"
            element={
              <RoleGuard allowedRoles={['admin']}>
                <UpdateProduct />
              </RoleGuard>
            }
          />
          <Route
            path="admin/stock"
            element={
              <RoleGuard allowedRoles={['admin']}>
                <StockEntry />
              </RoleGuard>
            }
          />
          <Route
            path="admin/users/create"
            element={
              <RoleGuard allowedRoles={['admin']}>
                <CreateEmployee />
              </RoleGuard>
            }
          />
          <Route
            path="admin/users"
            element={
              <RoleGuard allowedRoles={['admin']}>
                <EmployeeList />
              </RoleGuard>
            }
          />
          <Route
            path="bills"
            element={
              <RoleGuard allowedRoles={['admin']}>
                <BillsList />
              </RoleGuard>
            }
          />
          <Route
            path="admin/bills/:billId"
            element={
              <RoleGuard allowedRoles={['admin']}>
                <AdminBillDetails />
              </RoleGuard>
            }
          />
          <Route
            path="admin/reports"
            element={
              <RoleGuard allowedRoles={['admin']}>
                <Reports />
              </RoleGuard>
            }
          />

          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
