import { useState } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Box,
  Toolbar,
  Typography,
  Button,
  Container,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Menu,
  MenuItem,
  Avatar,
} from '@mui/material';
import {
  Store as StoreIcon,
  Logout as LogoutIcon,
  AdminPanelSettings as AdminIcon,
  PointOfSale as CashierIcon,
  History as HistoryIcon,
  Inventory as InventoryIcon,
  People as PeopleIcon,
  Menu as MenuIcon,
  BarChart as ReportsIcon,
  ReceiptLong as GstIcon,
  Lock as LockIcon,
  MoreVert as MoreIcon,
  Contacts as ContactsIcon,
  CardGiftcard as GiftIcon,
  ShoppingCart as PurchaseIcon,
} from '@mui/icons-material';
import { isAdmin, isCashier, getUserInfo } from '../utils/auth.utils';
import { authApi } from '../api/api';
import { useEffect } from 'react';
import StatusBar from '../components/StatusBar';

const Layout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const user = getUserInfo();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch (err) {
      console.error('Server-side logout failed:', err);
    } finally {
      localStorage.removeItem('token');
      navigate('/login');
    }
  };

  const getCurrentTab = () => {
    if (location.pathname.startsWith('/admin/reports/gst') || location.pathname.startsWith('/admin/gst-summary')) return '/admin/reports/gst';
    if (location.pathname.startsWith('/admin/reports')) return '/admin/reports';
    if (location.pathname.startsWith('/admin/users')) return '/admin/users';
    if (location.pathname.startsWith('/admin/products'))
      return '/admin/products';
    if (location.pathname.startsWith('/admin/purchases/new'))
      return '/admin/purchases/new';
    if (location.pathname.startsWith('/admin/purchases'))
      return '/admin/purchases';
    if (location.pathname.startsWith('/admin/lucky-draw'))
      return '/admin/lucky-draw';
    if (location.pathname.startsWith('/admin')) return '/admin';
    if (location.pathname === '/cashier/report') return '/cashier/report';
    if (location.pathname.startsWith('/cashier')) return '/cashier';
    if (location.pathname.startsWith('/history')) return '/history';
    return false;
  };

  const showAdminTab = isAdmin();
  const isCashierUser = isCashier();

  const menuItems = [
    ...(showAdminTab
      ? [
          { text: 'Dashboard', icon: <AdminIcon />, path: '/admin' },
          {
            text: 'Inventory',
            icon: <InventoryIcon />,
            path: '/admin/products',
          },
          { text: 'Purchase Entry', icon: <PurchaseIcon />, path: '/admin/purchases/new' },
          { text: 'Purchase History', icon: <HistoryIcon />, path: '/admin/purchases' },
          { text: 'Lucky Draw', icon: <GiftIcon />, path: '/admin/lucky-draw' },
          { text: 'Reports', icon: <ReportsIcon />, path: '/admin/reports' },
          { text: 'GST Summary', icon: <GstIcon />, path: '/admin/reports/gst' },
        ]
      : []),
    ...(isCashierUser
      ? [
          {
            text: 'Inventory',
            icon: <InventoryIcon />,
            path: '/admin/products',
          },
          { text: 'Purchase Entry', icon: <PurchaseIcon />, path: '/admin/purchases/new' },
          { text: 'Purchase History', icon: <HistoryIcon />, path: '/admin/purchases' },
        ]
      : []),
    { text: 'Cashier', icon: <CashierIcon />, path: '/cashier' },
    { text: 'Cashier Report', icon: <ReportsIcon />, path: '/cashier/report' },
    { text: 'Customers', icon: <ContactsIcon />, path: '/customers' },
    { text: 'History', icon: <HistoryIcon />, path: '/history' },
  ];

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F5') {
        e.preventDefault();
      }

      if (e.key === 'F1') {
        e.preventDefault();
      }

      if (e.key === 'F3') {
        e.preventDefault();
        navigate('/admin/products/add');
      }

      if (e.key === 'F4') {
        e.preventDefault();
        navigate('/cashier');
      }

      if (e.key === 'F6') {
        e.preventDefault();
        navigate('/cashier/return');
      }

      if (e.key === 'F7') {
        e.preventDefault();
        navigate('/admin/products');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [navigate]);

  const drawer = (
    <Box sx={{ textAlign: 'center' }}>
      <Box
        sx={{
          py: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
        }}
      >
        <StoreIcon sx={{ fontSize: 28, color: 'primary.main' }} />
        <Typography variant="h6" fontWeight={700} color="primary">
          Family Mart POS
        </Typography>
      </Box>
      <Divider />
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.path} disablePadding>
            <ListItemButton
              component={Link}
              to={item.path}
              selected={getCurrentTab() === item.path}
              onClick={() => setMobileOpen(false)}
              sx={{
                '&.Mui-selected': {
                  bgcolor: 'primary.main',
                  color: 'white',
                  '&:hover': {
                    bgcolor: 'primary.dark',
                  },
                  '& .MuiListItemIcon-root': {
                    color: 'white',
                  },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Divider />
      <List>
        {showAdminTab && (
          <ListItem disablePadding>
            <ListItemButton
              component={Link}
              to="/admin/users"
              selected={getCurrentTab() === '/admin/users'}
              onClick={() => setMobileOpen(false)}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                <PeopleIcon />
              </ListItemIcon>
              <ListItemText primary="Employees" />
            </ListItemButton>
          </ListItem>
        )}
        <ListItem disablePadding>
          <ListItemButton
            component={Link}
            to="/change-password"
            selected={getCurrentTab() === '/change-password'}
            onClick={() => setMobileOpen(false)}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              <LockIcon />
            </ListItemIcon>
            <ListItemText primary="Password" />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton onClick={handleLogout}>
            <ListItemIcon sx={{ minWidth: 40 }}>
              <LogoutIcon />
            </ListItemIcon>
            <ListItemText primary="Logout" />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );

  const isCashierPage = location.pathname === '/cashier';

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: isCashierPage ? { xs: 'auto', lg: '100dvh' } : 'auto',
        minHeight: '100vh',
        overflow: isCashierPage ? { xs: 'visible', lg: 'hidden' } : 'visible',
      }}
    >
      <StatusBar
        onMenuClick={() => setMobileOpen(true)}
      />

      {/* Drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{
          keepMounted: true, // Better open performance on mobile.
          slotProps: { backdrop: { invisible: true } },
        }}
        PaperProps={{
          onMouseLeave: (e) => {
            if (e.clientY >= 0) {
              setMobileOpen(false);
            }
          },
          sx: { boxSizing: 'border-box', width: 280 },
        }}
      >
        {drawer}
      </Drawer>

      <Container
        component="main"
        maxWidth="xl"
        sx={{
          flex: 1,
          flexGrow: 1,
          py: isCashierPage ? { xs: 2, lg: 1.5 } : { xs: 2, sm: 2 },
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflow: isCashierPage ? { xs: 'visible', lg: 'hidden' } : 'visible',
        }}
      >
        <Outlet />
      </Container>

      {!isCashierPage && (
        <Box
          component="footer"
          sx={{
            py: 2,
            px: 2,
            mt: 'auto',
            bgcolor: 'background.paper',
            borderTop: 1,
            borderColor: 'divider',
          }}
        >
          <Container maxWidth="xl">
            <Typography variant="body2" color="text.secondary" align="center">
              © {new Date().getFullYear()} Family Mart. All rights reserved.
            </Typography>
          </Container>
        </Box>
      )}
    </Box>
  );
};

export default Layout;
