import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { billsApi } from '../api/api';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Pagination,
  Alert,
  Button,
  Grid,
  TextField,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Search as SearchIcon,
  MoreVert as MoreIcon,
} from '@mui/icons-material';
import { getUserInfo } from '../utils/auth.utils';
import LuckyDrawModal from '../components/LuckyDrawModal';

const BillHistory = () => {
  const navigate = useNavigate();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState(
    new Date().toISOString().split('T')[0],
  );
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedBill, setSelectedBill] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editValue, setEditValue] = useState(0);
  const [saving, setSaving] = useState(false);
  const [luckyDrawOpen, setLuckyDrawOpen] = useState(false);

  const user = getUserInfo();
  const limit = 100;

  useEffect(() => {
    fetchBillsHistory();
  }, [page, filterDate]); // Re-fetch on date change or page change

  // Handle search with a slight delay or on enter
  const handleSearch = (e) => {
    if (e.key === 'Enter') {
      setPage(1);
      fetchBillsHistory();
    }
  };

  const fetchBillsHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await billsApi.getBillsHistory(
        page,
        limit,
        searchTerm,
        filterDate,
      );
      setBills(response.bills || []);
      setTotalPages(response.meta?.totalPages || 1);
    } catch (err) {
      setError(err.message || 'Failed to fetch bill history');
      setBills([]);
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
      fetchBillsHistory();
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
      setSaving(true);
      await billsApi.void(selectedBill.id);
      fetchBillsHistory();
    } catch (err) {
      alert(err.message || 'Failed to void transaction');
    } finally {
      setSaving(false);
      handleMenuClose();
    }
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'medium',
    }).format(date);
  };

  const formatCurrency = (amount) => {
    return `₹${parseFloat(amount).toFixed(2)}`;
  };

  const getPaymentStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'success';
      case 'pending':
        return 'warning';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  if (loading && bills.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h4"
          fontWeight={700}
          gutterBottom
          sx={{ fontSize: { xs: '1.75rem', sm: '2.125rem' } }}
        >
          Bill History
        </Typography>
        <Typography variant="body2" color="text.secondary">
          View all bills you've created
        </Typography>
      </Box>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              fullWidth
              size="small"
              label="Search Bill Number"
              placeholder="e.g. BILL-123"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleSearch}
              InputProps={{
                endAdornment: (
                  <Button
                    size="small"
                    onClick={() => {
                      setPage(1);
                      fetchBillsHistory();
                    }}
                  >
                    <SearchIcon />
                  </Button>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              size="small"
              label="Filter by Date"
              type="date"
              value={filterDate}
              onChange={(e) => {
                setFilterDate(e.target.value);
                setPage(1);
              }}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={12} md={2}>
            <Button
              variant="outlined"
              fullWidth
              onClick={() => {
                setSearchTerm('');
                setFilterDate(new Date().toISOString().split('T')[0]);
                setPage(1);
              }}
            >
              Reset
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {bills.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary">
            No bills found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Bills you create will appear here
          </Typography>
        </Paper>
      ) : (
        <>
          <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
            <Table sx={{ minWidth: 650 }}>
              <TableHead>
                <TableRow>
                  <TableCell>
                    <Typography variant="subtitle2" fontWeight={700}>
                      Bill Number
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="subtitle2" fontWeight={700}>
                      Subtotal
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="subtitle2" fontWeight={700}>
                      Round Adjust
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="subtitle2" fontWeight={700}>
                      Total Amount
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="subtitle2" fontWeight={700}>
                      Payment Status
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="subtitle2" fontWeight={700}>
                      Status
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="subtitle2" fontWeight={700}>
                      Time
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="subtitle2" fontWeight={700}>
                      Actions
                    </Typography>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {bills.map((bill) => (
                  <TableRow key={bill.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {bill.bill_number}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatCurrency(bill.sub_total || 0)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        color={
                          bill.round_adjustment < 0 ? 'error' : 'text.primary'
                        }
                      >
                        {formatCurrency(bill.round_adjustment || 0)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        fontWeight={700}
                        color="primary"
                      >
                        {formatCurrency(bill.total_amount)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={bill.payment_status || 'CASH'}
                        color={getPaymentStatusColor(bill.payment_status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {bill.is_void ? (
                        <Chip label="VOID" color="error" size="small" />
                      ) : (
                        <Chip label="ACTIVE" color="success" size="small" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {formatDateTime(bill.created_at)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={(e) => handleMenuOpen(e, bill)}
                      >
                        <MoreIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
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
                setLuckyDrawOpen(true);
                setAnchorEl(null);
              }}
            >
              Create Lucky Draw
            </MenuItem>
            <MenuItem
              onClick={() => {
                handleEditOpen();
                setAnchorEl(null);
              }}
            >
              Edit Bill
            </MenuItem>
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
            {user?.role === 'admin' && (
              <MenuItem
                onClick={() => {
                  navigate(`/admin/bills/${selectedBill.id}`);
                  handleMenuClose();
                }}
              >
                View Full Details
              </MenuItem>
            )}
            <MenuItem
              onClick={() => {
                navigate(`/bill-view/${selectedBill.id}`);
                handleMenuClose();
              }}
            >
              View Receipt
            </MenuItem>
            {selectedBill && !selectedBill.is_void && (
              <MenuItem
                onClick={handleVoid}
                sx={{ color: 'error.main' }}
              >
                Void Transaction
              </MenuItem>
            )}
          </Menu>

          <Dialog
            open={editDialogOpen}
            onClose={() => {
              handleEditClose();
              handleMenuClose();
            }}
            fullWidth
            maxWidth="xs"
          >
            <DialogTitle>Edit Bill - {selectedBill?.bill_number}</DialogTitle>
            <DialogContent>
              <Box sx={{ pt: 1 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Subtotal: {formatCurrency(selectedBill?.sub_total || 0)}
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
                    Number(selectedBill?.sub_total || 0) -
                    Number(editValue || 0)
                  ).toFixed(2)}
                </Typography>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button
                onClick={() => {
                  handleEditClose();
                  handleMenuClose();
                }}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  handleEditSave();
                  handleMenuClose();
                }}
                variant="contained"
                disabled={saving}
              >
                {saving ? <CircularProgress size={24} /> : 'Save Changes'}
              </Button>
            </DialogActions>
          </Dialog>

          <LuckyDrawModal
            open={luckyDrawOpen}
            onClose={() => {
              setLuckyDrawOpen(false);
              setSelectedBill(null);
            }}
            bill={selectedBill}
          />
        </>
      )}
    </Box>
  );
};

export default BillHistory;
