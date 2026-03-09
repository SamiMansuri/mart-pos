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
  Lock as LockIcon,
  MoreVert as MoreIcon,
} from '@mui/icons-material';
import { isAdmin, isCashier, getUserInfo } from '../utils/auth.utils';
import { authApi } from '../api/api';
import { useEffect } from 'react';

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
    if (location.pathname.startsWith('/admin/reports')) return '/admin/reports';
    if (location.pathname.startsWith('/admin/users')) return '/admin/users';
    if (location.pathname.startsWith('/admin/products'))
      return '/admin/products';
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
        { text: 'Reports', icon: <ReportsIcon />, path: '/admin/reports' },
        { text: 'Employees', icon: <PeopleIcon />, path: '/admin/users' },
      ]
      : []),
    ...(isCashierUser
      ? [
        {
          text: 'Inventory',
          icon: <InventoryIcon />,
          path: '/admin/products',
        },
      ]
      : []),
    { text: 'Cashier', icon: <CashierIcon />, path: '/cashier' },
    { text: 'Cashier Report', icon: <ReportsIcon />, path: '/cashier/report' },
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
    <Box onClick={handleDrawerToggle} sx={{ textAlign: 'center' }}>
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
        <ListItem disablePadding>
          <ListItemButton
            component={Link}
            to="/change-password"
            selected={getCurrentTab() === '/change-password'}
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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="sticky" color="default" elevation={0}>
        <Toolbar sx={{ borderBottom: 1, borderColor: 'divider' }}>
          {/* Hamburger Menu - Show on mobile and tablet */}
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { lg: 'none' } }}
          >
            <MenuIcon />
          </IconButton>

          {/* Logo and Title */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              flexGrow: 1,
            }}
          >
            <StoreIcon
              sx={{ fontSize: { xs: 24, sm: 28 }, color: 'primary.main' }}
            />
            <Typography
              variant="h6"
              fontWeight={700}
              color="primary"
              sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}
            >
              <Box
                component="span"
                sx={{ display: { xs: 'none', sm: 'inline' } }}
              >
                Family Mart POS
              </Box>
              <Box
                component="span"
                sx={{ display: { xs: 'inline', sm: 'none' } }}
              >
                Family Mart
              </Box>
            </Typography>
          </Box>

          {/* Desktop Navigation - Hidden on mobile/tablet */}
          <Box sx={{ display: { xs: 'none', lg: 'flex' }, gap: 1, mr: 2 }}>
            {menuItems.map((item) => (
              <Button
                key={item.path}
                component={Link}
                to={item.path}
                startIcon={item.icon}
                variant={getCurrentTab() === item.path ? 'contained' : 'text'}
                sx={{ whiteSpace: 'nowrap' }}
              >
                {item.text}
              </Button>
            ))}
          </Box>

          {/* Account Menu - Desktop only */}
          <Box sx={{ display: { xs: 'none', lg: 'flex' } }}>
            <IconButton onClick={handleMenuOpen} size="small" sx={{ ml: 2 }}>
              <MoreIcon />
            </IconButton>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
              transitionDuration={150}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              PaperProps={{
                elevation: 3,
                sx: { mt: 1, minWidth: 200 },
              }}
            >
              <Box sx={{ px: 2, py: 1.5 }}>
                <Typography variant="subtitle2" fontWeight={700}>
                  {user?.userName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {user?.role?.toUpperCase()}
                </Typography>
              </Box>
              <Divider />
              <MenuItem
                onClick={() => {
                  handleMenuClose();
                  navigate('/change-password');
                }}
                sx={{ py: 1.5 }}
              >
                <ListItemIcon>
                  <LockIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Change Password" />
              </MenuItem>
              <Divider />
              <MenuItem
                onClick={() => {
                  handleMenuClose();
                  handleLogout();
                }}
                sx={{ py: 1.5, color: 'error.main' }}
              >
                <ListItemIcon>
                  <LogoutIcon fontSize="small" color="error" />
                </ListItemIcon>
                <ListItemText primary="Logout" />
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Mobile Drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{
          keepMounted: true, // Better open performance on mobile.
        }}
        sx={{
          display: { xs: 'block', lg: 'none' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: 280 },
        }}
      >
        {drawer}
      </Drawer>

      <Container
        component="main"
        maxWidth="xl"
        sx={{
          flexGrow: 1,
          py: { xs: 2, sm: 4 },
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Outlet />
      </Container>

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
    </Box>
  );
};

export default Layout;
