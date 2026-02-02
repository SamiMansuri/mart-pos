import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { billsApi } from "../api/api";
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
  IconButton,
  Button,
  CircularProgress,
  Alert,
  Menu,
  MenuItem,
  Pagination,
} from "@mui/material";
import {
  MoreVert as MoreIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
} from "@mui/icons-material";

const BillsList = () => {
  const navigate = useNavigate();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedBill, setSelectedBill] = useState(null);
  const limit = 10;

  useEffect(() => {
    fetchBills();
  }, [page]);

  const fetchBills = async () => {
    try {
      setLoading(true);
      const response = await billsApi.getAll(page, limit);

      // Handle both legacy (array) and new (paginated object) responses
      if (Array.isArray(response)) {
        setBills(response);
        setTotalPages(1);
        setTotalItems(response.length);
      } else {
        setBills(response.bills || []);
        setTotalPages(response.meta?.totalPages || 1);
        setTotalItems(response.meta?.total || 0);
      }

      setError(null);
    } catch (err) {
      setError(err.message || "Failed to load bills");
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (event, value) => {
    setPage(value);
  };

  const handleMenuOpen = (event, bill) => {
    setAnchorEl(event.currentTarget);
    setSelectedBill(bill);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedBill(null);
  };

  const handleVoid = async () => {
    if (!selectedBill) return;
    if (!window.confirm(`Void transaction #${selectedBill.id}?`)) {
      handleMenuClose();
      return;
    }

    try {
      await billsApi.void(selectedBill.id);
      fetchBills();
    } catch (err) {
      alert(err.message || "Failed to void transaction");
    } finally {
      handleMenuClose();
    }
  };

  const getStatusColor = (bill) => {
    if (bill.is_void) return "error";
    switch (bill.payment_status) {
      case "PAID":
        return "success";
      case "REFUNDED":
      case "PARTIALLY_REFUNDED":
        return "warning";
      default:
        return "default";
    }
  };

  if (error) {
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={fetchBills}>
            Retry
          </Button>
        }
      >
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Bills
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {totalItems} total transactions
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <IconButton onClick={fetchBills} disabled={loading}>
            <RefreshIcon />
          </IconButton>
          <Button
            variant="contained"
            startIcon={
              <AddIcon sx={{ display: { xs: "none", sm: "inline-flex" } }} />
            }
            component={Link}
            to="/bills/create"
            sx={{ whiteSpace: "nowrap" }}
          >
            <Box
              component="span"
              sx={{ display: { xs: "none", sm: "inline" } }}
            >
              New Bill
            </Box>
            <Box
              component="span"
              sx={{ display: { xs: "inline", sm: "none" } }}
            >
              New
            </Box>
          </Button>
        </Box>
      </Box>

      <TableContainer
        component={Paper}
        sx={{ position: "relative", overflowX: "auto" }}
      >
        {loading && (
          <Box
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: "rgba(255, 255, 255, 0.7)",
              zIndex: 1,
            }}
          >
            <CircularProgress />
          </Box>
        )}
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Date</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell align="center">Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {bills.length === 0 && !loading ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 8 }}>
                  <Typography variant="body2" color="text.secondary">
                    No bills found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              bills.map((bill) => (
                <TableRow key={bill.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>
                      #{bill.id}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {new Date(
                        bill.created_at || bill.date,
                      ).toLocaleDateString()}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(
                        bill.created_at || bill.date,
                      ).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={600}>
                      ₹{parseFloat(bill.total_amount).toFixed(2)}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={bill.is_void ? "VOID" : bill.payment_status}
                      color={getStatusColor(bill)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuOpen(e, bill)}
                    >
                      <MoreIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {totalPages > 1 && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={handlePageChange}
            color="primary"
            disabled={loading}
          />
        </Box>
      )}

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => {
          navigate(`/admin/bills/${selectedBill.id}`);
          handleMenuClose();
        }}>View Details</MenuItem>
        <MenuItem onClick={handleMenuClose}>Print</MenuItem>
        {selectedBill && !selectedBill.is_void && (
          <MenuItem onClick={handleVoid} sx={{ color: "error.main" }}>
            Void Transaction
          </MenuItem>
        )}
      </Menu>
    </Box>
  );
};

export default BillsList;
