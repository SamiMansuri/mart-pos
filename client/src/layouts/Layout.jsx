import { useState } from "react";
import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
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
} from "@mui/material";
import {
  Store as StoreIcon,
  Logout as LogoutIcon,
  AdminPanelSettings as AdminIcon,
  PointOfSale as CashierIcon,
  History as HistoryIcon,
  Inventory as InventoryIcon,
  People as PeopleIcon,
  Menu as MenuIcon,
} from "@mui/icons-material";
import { isAdmin } from "../utils/auth.utils";

const Layout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  const getCurrentTab = () => {
    if (location.pathname.startsWith("/admin/users")) return "/admin/users";
    if (location.pathname.startsWith("/admin/products"))
      return "/admin/products";
    if (location.pathname.startsWith("/admin")) return "/admin";
    if (location.pathname.startsWith("/cashier")) return "/cashier";
    if (location.pathname.startsWith("/history")) return "/history";
    return false;
  };

  const showAdminTab = isAdmin();

  const menuItems = [
    ...(showAdminTab
      ? [
          { text: "Dashboard", icon: <AdminIcon />, path: "/admin" },
          {
            text: "Inventory",
            icon: <InventoryIcon />,
            path: "/admin/products",
          },
          { text: "Employees", icon: <PeopleIcon />, path: "/admin/users" },
        ]
      : []),
    { text: "Cashier", icon: <CashierIcon />, path: "/cashier" },
    { text: "History", icon: <HistoryIcon />, path: "/history" },
  ];

  const drawer = (
    <Box onClick={handleDrawerToggle} sx={{ textAlign: "center" }}>
      <Box
        sx={{
          py: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 1,
        }}
      >
        <StoreIcon sx={{ fontSize: 28, color: "primary.main" }} />
        <Typography variant="h6" fontWeight={700} color="primary">
          MiniMart POS
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
                "&.Mui-selected": {
                  bgcolor: "primary.main",
                  color: "white",
                  "&:hover": {
                    bgcolor: "primary.dark",
                  },
                  "& .MuiListItemIcon-root": {
                    color: "white",
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
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <AppBar position="sticky" color="default" elevation={0}>
        <Toolbar sx={{ borderBottom: 1, borderColor: "divider" }}>
          {/* Hamburger Menu - Show on mobile and tablet */}
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { lg: "none" } }}
          >
            <MenuIcon />
          </IconButton>

          {/* Logo and Title */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              flexGrow: 1,
            }}
          >
            <StoreIcon
              sx={{ fontSize: { xs: 24, sm: 28 }, color: "primary.main" }}
            />
            <Typography
              variant="h6"
              fontWeight={700}
              color="primary"
              sx={{ fontSize: { xs: "1rem", sm: "1.25rem" } }}
            >
              <Box
                component="span"
                sx={{ display: { xs: "none", sm: "inline" } }}
              >
                MiniMart POS
              </Box>
              <Box
                component="span"
                sx={{ display: { xs: "inline", sm: "none" } }}
              >
                MiniMart
              </Box>
            </Typography>
          </Box>

          {/* Desktop Navigation - Hidden on mobile/tablet */}
          <Box sx={{ display: { xs: "none", lg: "flex" }, gap: 1, mr: 2 }}>
            {menuItems.map((item) => (
              <Button
                key={item.path}
                component={Link}
                to={item.path}
                startIcon={item.icon}
                variant={getCurrentTab() === item.path ? "contained" : "text"}
                sx={{ whiteSpace: "nowrap" }}
              >
                {item.text}
              </Button>
            ))}
          </Box>

          {/* Logout Button - Desktop only */}
          <Button
            variant="outlined"
            onClick={handleLogout}
            size="small"
            sx={{
              display: { xs: "none", lg: "flex" },
              minWidth: "auto",
              gap: 1,
            }}
          >
            <LogoutIcon />
            Logout
          </Button>
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
          display: { xs: "block", lg: "none" },
          "& .MuiDrawer-paper": { boxSizing: "border-box", width: 280 },
        }}
      >
        {drawer}
      </Drawer>

      <Container
        component="main"
        maxWidth="xl"
        sx={{
          flexGrow: 1,
          py: 4,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Outlet />
      </Container>

      <Box
        component="footer"
        sx={{
          py: 2,
          px: 2,
          mt: "auto",
          bgcolor: "background.paper",
          borderTop: 1,
          borderColor: "divider",
        }}
      >
        <Container maxWidth="xl">
          <Typography variant="body2" color="text.secondary" align="center">
            © {new Date().getFullYear()} MiniMart. All rights reserved.
          </Typography>
        </Container>
      </Box>
    </Box>
  );
};

export default Layout;
