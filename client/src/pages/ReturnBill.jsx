import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
  Alert,
  CircularProgress,
  IconButton,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Search as SearchIcon,
  ArrowBack as BackIcon,
  RemoveCircleOutline as RemoveIcon,
  AddCircleOutline as AddIcon,
} from '@mui/icons-material';
import { billsApi } from '../api/api';

const ReturnBill = () => {
  const navigate = useNavigate();
  const [searchType, setSearchType] = useState('bill_number'); // bill_number or date_invoice
  const [searchValue, setSearchValue] = useState('');
  const [businessDate, setBusinessDate] = useState(
    new Date().toISOString().split('T')[0],
  );
  const [invoiceNumber, setInvoiceNumber] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [bill, setBill] = useState(null);
  const [returnItems, setReturnItems] = useState({}); // productId -> quantity
  const [refundRequired, setRefundRequired] = useState('WITH_REFUND');
  const [refundMethod, setRefundMethod] = useState('CASH');
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const location = useLocation();

  const fetchBill = useCallback(async (forcedParams = null) => {
    setLoading(true);
    setError(null);
    setBill(null);
    setReturnItems({});
    try {
      let params = {};
      // If forcedParams is provided and is NOT a React/DOM event object
      if (forcedParams && typeof forcedParams === 'object' && !forcedParams.target) {
        params = forcedParams;
      } else if (searchType === 'bill_number') {
        params.bill_number = searchValue.trim();
      } else {
        params.business_date = businessDate;
        params.invoice_number = invoiceNumber;
      }

      const searchRes = await billsApi.search(params);
      const billDetails = await billsApi.getById(searchRes.bill_id);

      // Group items by product_id for display
      const groupedItems = [];
      const itemMap = new Map();

      billDetails.items.forEach((item) => {
        if (itemMap.has(item.product_id)) {
          const existing = itemMap.get(item.product_id);
          existing.quantity = Number(existing.quantity) + Number(item.quantity);
          existing.line_total =
            Number(existing.line_total) + Number(item.line_total);
        } else {
          const itemCopy = { ...item };
          itemMap.set(item.product_id, itemCopy);
          groupedItems.push(itemCopy);
        }
      });

      setBill({ ...billDetails, items: groupedItems });
    } catch (err) {
      setError(err.message || 'Bill not found');
    } finally {
      setLoading(false);
    }
  }, [searchType, searchValue, businessDate, invoiceNumber]);

  useEffect(() => {
    if (location.state?.bill_number) {
      setSearchType('bill_number');
      setSearchValue(location.state.bill_number);
      fetchBill({ bill_number: location.state.bill_number });
    }
  }, [location.state, fetchBill]);

  const handleQtyChange = (productId, delta, max) => {
    setReturnItems((prev) => {
      const current = parseFloat(prev[productId]) || 0;
      let next = current + delta;

      // Handle floating point precision
      next = Math.round(next * 1000) / 1000;

      if (next < 0 || next > max) return prev;
      return { ...prev, [productId]: next };
    });
  };

  const handleManualQtyChange = (productId, value, max, saleType) => {
    const numericMax = parseFloat(max) || 0;

    setReturnItems((prev) => {
      if (saleType === 'WEIGHT') {
        const normalized = value.replace(',', '.');
        if (normalized === '') return { ...prev, [productId]: '' };
        if (!/^\d*\.?\d*$/.test(normalized)) return prev;
        const numValue = parseFloat(normalized);
        if (numValue > numericMax) return { ...prev, [productId]: max };
        return { ...prev, [productId]: normalized };
      } else {
        if (value === '') return { ...prev, [productId]: '' };
        const numValue = parseInt(value, 10);
        if (isNaN(numValue) || numValue < 0) return prev;
        if (numValue > numericMax) return { ...prev, [productId]: max };
        return { ...prev, [productId]: numValue };
      }
    });
  };

  const totalReturnAmount = bill
    ? bill.items.reduce((sum, item) => {
      const qty = returnItems[item.product_id] || 0;
      return sum + Number(item.price) * qty;
    }, 0)
    : 0;

  const handleConfirmReturn = async () => {
    setConfirmDialogOpen(false);
    setLoading(true);
    try {
      const items = Object.entries(returnItems)
        .filter(([_, qty]) => qty > 0)
        .map(([productId, qty]) => ({
          product_id: Number(productId),
          quantity: parseFloat(qty),
        }));

      if (items.length === 0) throw new Error('No items selected for return');

      await billsApi.createReturn(bill.bill_id, {
        items,
        reason: 'Customer Return',
        payment_method: refundMethod,
        idempotency_key: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        refund_required: refundRequired === 'WITH_REFUND',
      });

      // Navigate back or show success
      alert('Return processed successfully');
      navigate('/cashier');
    } catch (err) {
      console.log(err);
      setError(err.error.message || 'Failed to process return');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
        <IconButton onClick={() => navigate('/cashier')}>
          <BackIcon />
        </IconButton>
        <Typography variant="h4" fontWeight={700}>
          Process Return
        </Typography>
      </Box>

      <Paper sx={{ p: 4, mb: 4 }}>
        <Typography variant="h6" gutterBottom fontWeight={600}>
          Search Bill
        </Typography>
        <Grid container spacing={3} alignItems="flex-end">
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <FormLabel>Search By</FormLabel>
              <RadioGroup
                row
                value={searchType}
                onChange={(e) => setSearchType(e.target.value)}
              >
                <FormControlLabel
                  value="bill_number"
                  control={<Radio />}
                  label="Bill #"
                />
                <FormControlLabel
                  value="date_invoice"
                  control={<Radio />}
                  label="Date + Inv #"
                />
              </RadioGroup>
            </FormControl>
          </Grid>
          {searchType === 'bill_number' ? (
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Bill Number"
                placeholder="e.g. BILL-12345"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                size="small"
              />
            </Grid>
          ) : (
            <>
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  type="date"
                  label="Business Date"
                  value={businessDate}
                  onChange={(e) => setBusinessDate(e.target.value)}
                  size="small"
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  label="Invoice Number"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  size="small"
                />
              </Grid>
            </>
          )}
          <Grid item xs={12} md={3}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<SearchIcon />}
              onClick={() => fetchBill()}
              disabled={loading}
            >
              Find Bill
            </Button>
          </Grid>
        </Grid>

        {error && (
          <Alert severity="error" sx={{ mt: 3 }}>
            {error}
          </Alert>
        )}
      </Paper>

      {loading && !bill && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {bill && (
        <Grid container spacing={4}>
          <Grid item xs={12} lg={8}>
            <Paper sx={{ p: 4 }}>
              <Box
                sx={{ mb: 3, display: 'flex', justifyContent: 'space-between' }}
              >
                <Typography variant="h6" fontWeight={700}>
                  Bill Items
                </Typography>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="body2" color="text.secondary">
                    Bill #: <strong>{bill.bill_number}</strong>
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Inv #: <strong>#{bill.invoice_number}</strong>
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Date: {new Date(bill.created_at).toLocaleString()}
                  </Typography>
                </Box>
              </Box>

              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Item Name</TableCell>
                      <TableCell align="right">Price</TableCell>
                      <TableCell align="center">Bought</TableCell>
                      <TableCell align="center">Return Qty</TableCell>
                      <TableCell align="right">Amount</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {bill.items.map((item) => (
                      <TableRow key={item.product_id}>
                        <TableCell>{item.product_name}</TableCell>
                        <TableCell align="right">₹{item.price}</TableCell>
                        <TableCell align="center">{item.quantity}</TableCell>
                        <TableCell align="center">
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 1,
                            }}
                          >
                            <IconButton
                              size="small"
                              onClick={() =>
                                handleQtyChange(
                                  item.product_id,
                                  item.sale_type === 'WEIGHT' ? -0.5 : -1,
                                  item.quantity,
                                )
                              }
                              disabled={!(returnItems[item.product_id] > 0)}
                            >
                              <RemoveIcon fontSize="small" />
                            </IconButton>
                            <TextField
                              size="small"
                              value={returnItems[item.product_id] !== undefined ? returnItems[item.product_id] : 0}
                              onChange={(e) => handleManualQtyChange(item.product_id, e.target.value, item.quantity, item.sale_type)}
                              onBlur={(e) => {
                                const val = parseFloat(e.target.value);
                                if (isNaN(val) || val < 0) {
                                  setReturnItems(prev => ({ ...prev, [item.product_id]: 0 }));
                                } else if (val > item.quantity) {
                                  setReturnItems(prev => ({ ...prev, [item.product_id]: item.quantity }));
                                } else {
                                  // Commit the parsed number (removes trailing dots)
                                  setReturnItems(prev => ({ ...prev, [item.product_id]: val }));
                                }
                              }}
                              inputProps={{
                                style: {
                                  textAlign: 'center',
                                  width: '50px',
                                  fontWeight: 600,
                                  padding: '4px 0',
                                },
                                inputMode: item.sale_type === 'WEIGHT' ? 'decimal' : 'numeric',
                              }}
                              sx={{
                                '& .MuiOutlinedInput-input': {
                                  textAlign: 'center',
                                },
                              }}
                            />
                            <IconButton
                              size="small"
                              onClick={() =>
                                handleQtyChange(
                                  item.product_id,
                                  item.sale_type === 'WEIGHT' ? 0.5 : 1,
                                  item.quantity,
                                )
                              }
                              disabled={
                                returnItems[item.product_id] >= item.quantity
                              }
                            >
                              <AddIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          ₹
                          {(
                            Number(item.price) *
                            (returnItems[item.product_id] || 0)
                          ).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>

          <Grid item xs={12} lg={4}>
            <Paper sx={{ p: 4, position: 'sticky', top: 20 }}>
              <Typography variant="h6" gutterBottom fontWeight={700}>
                Return Summary
              </Typography>
              <Divider sx={{ my: 2 }} />

              <Box
                sx={{ mb: 3, display: 'flex', justifyContent: 'space-between' }}
              >
                <Typography variant="body1">Total Return Amount</Typography>
                <Typography variant="h6" color="primary" fontWeight={700}>
                  ₹{totalReturnAmount.toFixed(2)}
                </Typography>
              </Box>

              <Box sx={{ mb: 4 }}>
                <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                  Return Type
                </Typography>
                <RadioGroup
                  value={refundRequired}
                  onChange={(e) => setRefundRequired(e.target.value)}
                >
                  <FormControlLabel
                    value="WITH_REFUND"
                    control={<Radio size="small" />}
                    label="Return with Refund"
                  />
                  <FormControlLabel
                    value="NO_REFUND"
                    control={<Radio size="small" />}
                    label="Return Only (No Refund)"
                  />
                </RadioGroup>
              </Box>

              {refundRequired === 'WITH_REFUND' && (
                <Box sx={{ mb: 4 }}>
                  <Typography variant="subtitle2" gutterBottom fontWeight={600}>
                    Refund Mode
                  </Typography>
                  <RadioGroup
                    row
                    value={refundMethod}
                    onChange={(e) => setRefundMethod(e.target.value)}
                  >
                    <FormControlLabel
                      value="CASH"
                      control={<Radio size="small" />}
                      label="Cash"
                    />
                    <FormControlLabel
                      value="UPI"
                      control={<Radio size="small" />}
                      label="UPI"
                    />
                  </RadioGroup>
                </Box>
              )}

              <Button
                fullWidth
                variant="contained"
                size="large"
                disabled={totalReturnAmount === 0 || loading}
                onClick={() => setConfirmDialogOpen(true)}
              >
                Confirm Return
              </Button>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
      >
        <DialogTitle>Confirm Return</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to process this return for{' '}
            <strong>₹{totalReturnAmount.toFixed(2)}</strong>?
          </Typography>
          {refundRequired === 'WITH_REFUND' ? (
            <Typography
              variant="body2"
              sx={{ mt: 1, color: 'primary.main', fontWeight: 600 }}
            >
              A refund will be issued via {refundMethod}.
            </Typography>
          ) : (
            <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
              No refund will be issued for this return.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmDialogOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button onClick={handleConfirmReturn} variant="contained" autoFocus>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ReturnBill;
