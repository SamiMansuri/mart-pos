import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { billsApi } from '../api/api';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import {
  MoreVert as MoreIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
} from '@mui/icons-material';

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
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editValue, setEditValue] = useState(0);
  const [saving, setSaving] = useState(false);
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
      setError(err.message || 'Failed to load bills');
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

  const handleEditOpen = () => {
    if (selectedBill) {
      setEditValue(selectedBill.round_adjustment || 0);
      setEditDialogOpen(true);
      handleMenuClose();
    }
  };

  const handleEditClose = () => {
    setEditDialogOpen(false);
    setEditValue(0);
  };

  const handleEditSave = async () => {
    try {
      setSaving(true);
      await billsApi.editBill(selectedBill.id, {
        round_adjustment: parseFloat(editValue),
      });
      setEditDialogOpen(false);
      fetchBills();
    } catch (err) {
      alert(err.message || 'Failed to update bill');
    } finally {
      setSaving(false);
    }
  };

  const handleVoid = async () => {
    if (!selectedBill) return;
    if (!window.confirm(`Void transaction ${selectedBill.bill_number}?`)) {
      handleMenuClose();
      return;
    }

    try {
      await billsApi.void(selectedBill.id);
      fetchBills();
    } catch (err) {
      alert(err.message || 'Failed to void transaction');
    } finally {
      handleMenuClose();
    }
  };

  const getStatusColor = (bill) => {
    if (bill.is_void) return 'error';
    switch (bill.payment_status) {
      case 'PAID':
        return 'success';
      case 'REFUNDED':
      case 'PARTIALLY_REFUNDED':
        return 'warning';
      default:
        return 'default';
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
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
          flexWrap: 'wrap',
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
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton onClick={fetchBills} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      <TableContainer
        component={Paper}
        sx={{ position: 'relative', overflowX: 'auto' }}
      >
        {loading && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'rgba(255, 255, 255, 0.7)',
              zIndex: 1,
            }}
          >
            <CircularProgress />
          </Box>
        )}
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Bill Number</TableCell>
              <TableCell>Date</TableCell>
              <TableCell align="right">Subtotal</TableCell>
              <TableCell align="right">Round Adjust</TableCell>
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
                      {bill.bill_number}
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
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">
                      ₹{parseFloat(bill.sub_total || 0).toFixed(2)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      variant="body2"
                      color={
                        bill.round_adjustment < 0 ? 'error' : 'text.primary'
                      }
                    >
                      ₹{parseFloat(bill.round_adjustment || 0).toFixed(2)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={600}>
                      ₹{parseFloat(bill.total_amount).toFixed(2)}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={bill.is_void ? 'VOID' : bill.payment_status}
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
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
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
        <MenuItem
          onClick={() => {
            navigate('/cashier/return', {
              state: { bill_number: selectedBill.bill_number },
            });
            handleMenuClose();
          }}
        >
          Return Sale
        </MenuItem>
        <MenuItem
          onClick={() => {
            navigate(`/admin/bills/${selectedBill.id}`);
            handleMenuClose();
          }}
        >
          View Full Details
        </MenuItem>
        <MenuItem
          onClick={() => {
            navigate(`/bill-view/${selectedBill.id}`);
            handleMenuClose();
          }}
        >
          View Receipt
        </MenuItem>
        <MenuItem onClick={handleEditOpen}>Edit Bill</MenuItem>
        <MenuItem onClick={handleMenuClose}>Print</MenuItem>
        {selectedBill && !selectedBill.is_void && (
          <MenuItem onClick={handleVoid} sx={{ color: 'error.main' }}>
            Void Transaction
          </MenuItem>
        )}
      </Menu>

      <Dialog
        open={editDialogOpen}
        onClose={handleEditClose}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Edit Bill - {selectedBill?.bill_number}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Subtotal: ₹{parseFloat(selectedBill?.sub_total || 0).toFixed(2)}
            </Typography>
            <TextField
              fullWidth
              autoFocus
              label="Round Adjustment"
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onFocus={(e) => e.target.select()}
              sx={{ mt: 2 }}
            />
            <Typography variant="h6" sx={{ mt: 2, fontWeight: 700 }}>
              New Total: ₹
              {(
                Number(selectedBill?.sub_total || 0) - Number(editValue || 0)
              ).toFixed(2)}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleEditClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleEditSave}
            variant="contained"
            disabled={saving}
          >
            {saving ? <CircularProgress size={24} /> : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BillsList;
