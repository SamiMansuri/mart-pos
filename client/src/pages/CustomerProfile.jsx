import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Alert,
  IconButton,
  InputAdornment,
  Avatar,
  Card,
  CardContent,
  Divider,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Payment as PaymentIcon,
  Phone as PhoneIcon,
  CreditCard as CreditCardIcon,
  Description as DescriptionIcon,
  AccountBalanceWallet as WalletIcon,
} from '@mui/icons-material';
import { customersApi, paymentsApi, billsApi } from '../api/api';

const CustomerProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [customer, setCustomer] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentData, setPaymentData] = useState({
    amount: '',
    note: '',
  });

  useEffect(() => {
    fetchCustomerData();
  }, [id]);

  const fetchCustomerData = async () => {
    setLoading(true);
    setError('');
    try {
      // Fetch only last 10 entries for profile view
      const [ledgerRes, billsRes] = await Promise.all([
        customersApi.getLedger(id, 1, 10),
        billsApi.getByCustomer(id, 1, 10),
      ]);

      setCustomer(ledgerRes.customer);
      setLedger(ledgerRes.ledger || []);
      setBills(billsRes.bills || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch customer profile');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPayment = () => {
    setPaymentData({
      amount: customer ? customer.total_due : '',
      note: '',
    });
    setPaymentModalOpen(true);
  };

  const handleClosePayment = () => {
    setPaymentModalOpen(false);
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    if (!paymentData.amount || Number(paymentData.amount) <= 0) return;

    setPaymentLoading(true);
    try {
      await paymentsApi.create(id, {
        amount: parseFloat(paymentData.amount),
        note: paymentData.note,
      });
      setPaymentModalOpen(false);
      // Refresh user and ledger
      fetchCustomerData();
    } catch (err) {
      setError(err.message || 'Failed to record payment');
    } finally {
      setPaymentLoading(false);
    }
  };

  if (loading && !customer) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!customer && !loading) {
    return (
      <Box>
        <Alert severity="error">Customer not found.</Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/customers')}
          sx={{ mt: 2 }}
        >
          Back to Customers
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2 }}>
        <IconButton onClick={() => navigate('/customers')}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" fontWeight={800} color="text.primary">
          Customer Profile
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={8}>
          <Card
            sx={{
              borderRadius: 3,
              height: '100%',
              boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
            }}
          >
            <CardContent sx={{ p: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
                <Avatar
                  sx={{
                    bgcolor: 'primary.main',
                    width: 72,
                    height: 72,
                    fontSize: '2rem',
                    fontWeight: 800,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    mr: 3,
                  }}
                >
                  {customer.name ? customer.name.charAt(0).toUpperCase() : 'C'}
                </Avatar>
                <Box>
                  <Typography
                    variant="h4"
                    fontWeight={800}
                    gutterBottom
                    sx={{ mb: 0.5 }}
                  >
                    {customer.name}
                  </Typography>
                  <Typography
                    variant="subtitle1"
                    color="text.secondary"
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      fontWeight: 500,
                    }}
                  >
                    Customer ID: #{customer.id}
                  </Typography>
                </Box>
              </Box>

              <Divider sx={{ mb: 3 }} />

              <Grid container spacing={4}>
                <Grid item xs={12} sm={6}>
                  <Box
                    sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}
                  >
                    <Box
                      sx={{
                        p: 1,
                        borderRadius: 2,
                        bgcolor: 'primary.50',
                        color: 'primary.main',
                        display: 'flex',
                      }}
                    >
                      <PhoneIcon />
                    </Box>
                    <Box>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        fontWeight={600}
                        sx={{ mb: 0.5 }}
                      >
                        Phone Number
                      </Typography>
                      <Typography
                        variant="body1"
                        fontWeight={700}
                        color="text.primary"
                      >
                        {customer.phone || 'Not Provided'}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box
                    sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}
                  >
                    <Box
                      sx={{
                        p: 1,
                        borderRadius: 2,
                        bgcolor: 'secondary.50',
                        color: 'secondary.main',
                        display: 'flex',
                      }}
                    >
                      <CreditCardIcon />
                    </Box>
                    <Box>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        fontWeight={600}
                        sx={{ mb: 0.5 }}
                      >
                        Credit Limit
                      </Typography>
                      <Typography
                        variant="body1"
                        fontWeight={700}
                        color="text.primary"
                      >
                        {parseFloat(customer.credit_limit) === 0
                          ? 'No Limit'
                          : `₹${parseFloat(customer.credit_limit).toFixed(2)}`}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <Box
                    sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}
                  >
                    <Box
                      sx={{
                        p: 1,
                        borderRadius: 2,
                        bgcolor: 'info.50',
                        color: 'info.main',
                        display: 'flex',
                      }}
                    >
                      <DescriptionIcon />
                    </Box>
                    <Box>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        fontWeight={600}
                        sx={{ mb: 0.5 }}
                      >
                        Notes & Details
                      </Typography>
                      <Typography
                        variant="body1"
                        color="text.primary"
                        sx={{ lineHeight: 1.6 }}
                      >
                        {customer.notes ||
                          'No operational notes attached to this profile.'}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card
            sx={{
              borderRadius: 3,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              bgcolor:
                parseFloat(customer.total_due) > 0
                  ? 'error.light'
                  : 'success.light',
              color: 'white',
              boxShadow:
                parseFloat(customer.total_due) > 0
                  ? '0 8px 24px rgba(211,47,47,0.3)'
                  : '0 8px 24px rgba(46,125,50,0.3)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Background design element */}
            <Box
              sx={{
                position: 'absolute',
                top: -40,
                right: -40,
                width: 150,
                height: 150,
                bgcolor: 'rgba(255,255,255,0.1)',
                borderRadius: '50%',
              }}
            />

            <CardContent
              sx={{
                zIndex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                p: 4,
                width: '100%',
              }}
            >
              <Typography
                variant="h6"
                fontWeight={700}
                sx={{
                  opacity: 0.9,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                }}
              >
                Total Due
              </Typography>
              <Typography
                variant="h2"
                fontWeight={900}
                sx={{ my: 2, textShadow: '0 2px 10px rgba(0,0,0,0.1)' }}
              >
                ₹{parseFloat(customer.total_due).toFixed(2)}
              </Typography>

              <Button
                variant="contained"
                size="large"
                color={parseFloat(customer.total_due) > 0 ? 'error' : 'success'}
                startIcon={<PaymentIcon />}
                onClick={handleOpenPayment}
                disabled={parseFloat(customer.total_due) <= 0}
                sx={{
                  mt: 2,
                  py: 1.5,
                  width: '100%',
                  fontWeight: 800,
                  bgcolor: 'rgba(255,255,255,0.2)',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.35)' },
                  backdropFilter: 'blur(10px)',
                }}
                disableElevation
              >
                RECORD PAYMENT
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
        }}
      >
        <Typography variant="h5" fontWeight={800}>
          Recent Ledger Details
        </Typography>
        <Button
          variant="outlined"
          size="small"
          onClick={() => navigate(`/customers/${id}/ledger`)}
          sx={{ fontWeight: 700, borderRadius: 2 }}
        >
          View Full Ledger
        </Button>
      </Box>

      <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Note / Ref</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>
                Amount
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>
                Balance After
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {ledger.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    No ledger entries found.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              ledger.map((entry) => (
                <TableRow key={entry.id} hover>
                  <TableCell>
                    {new Intl.DateTimeFormat('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                      timeZone: 'Asia/Kolkata',
                    }).format(new Date(entry.created_at))}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={entry.type}
                      color={entry.type === 'CREDIT' ? 'error' : 'success'}
                      size="small"
                      sx={{ fontWeight: 700, fontSize: '0.7rem' }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{entry.note || '-'}</Typography>
                    {entry.reference_id && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        display="block"
                      >
                        Ref: {entry.reference_id}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      fontWeight: 600,
                      color:
                        entry.type === 'CREDIT' ? 'error.main' : 'success.main',
                    }}
                  >
                    {entry.type === 'CREDIT' ? '+' : '-'}₹
                    {parseFloat(entry.amount).toFixed(2)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800 }}>
                    ₹{parseFloat(entry.balance_after).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Box
        sx={{
          mt: 5,
          mb: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography variant="h5" fontWeight={800}>
          Recent Bill History
        </Typography>
        <Button
          variant="outlined"
          size="small"
          onClick={() => navigate(`/customers/${id}/bills`)}
          sx={{ fontWeight: 700, borderRadius: 2 }}
        >
          View All Bills
        </Button>
      </Box>

      <TableContainer component={Paper} sx={{ borderRadius: 3, mb: 4 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Bill #</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Payment</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>
                Paid
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>
                Total
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {bills.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    No bills found for this customer.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              bills.map((bill) => (
                <TableRow key={bill.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>
                    {bill.bill_number}
                  </TableCell>
                  <TableCell>
                    {new Intl.DateTimeFormat('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                      timeZone: 'Asia/Kolkata',
                    }).format(new Date(bill.created_at))}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={bill.payment_method}
                      size="small"
                      sx={{ fontWeight: 700, fontSize: '0.7rem' }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    ₹{parseFloat(bill.paid_amount || 0).toFixed(2)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800 }}>
                    ₹{parseFloat(bill.total_amount).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Record Payment Modal */}
      <Dialog
        open={paymentModalOpen}
        onClose={handleClosePayment}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3, boxShadow: '0 12px 40px rgba(0,0,0,0.15)' },
        }}
      >
        <DialogTitle
          sx={{
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            pb: 1,
          }}
        >
          <WalletIcon color="success" />
          Record Payment
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box
            component="form"
            id="record-payment-form"
            onSubmit={handlePaymentSubmit}
            sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}
          >
            {/* Balance Summary Card */}
            <Box
              sx={{
                p: 2.5,
                borderRadius: 2,
                bgcolor: 'rgba(0,0,0,0.03)',
                border: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5,
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Typography
                  variant="body2"
                  color="text.secondary"
                  fontWeight={600}
                >
                  Current Balance
                </Typography>
                <Typography variant="h6" fontWeight={800} color="error.main">
                  ₹
                  {customer
                    ? parseFloat(customer.total_due).toFixed(2)
                    : '0.00'}
                </Typography>
              </Box>

              <Divider sx={{ borderStyle: 'dashed' }} />

              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Typography
                  variant="body2"
                  color="text.secondary"
                  fontWeight={600}
                >
                  Payment Amount
                </Typography>
                <Typography variant="h6" fontWeight={800} color="success.main">
                  - ₹{parseFloat(paymentData.amount || 0).toFixed(2)}
                </Typography>
              </Box>

              <Divider />

              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Typography variant="subtitle2" fontWeight={700}>
                  New Balance
                </Typography>
                <Typography variant="h6" fontWeight={900} color="primary.main">
                  ₹
                  {customer
                    ? Math.max(
                        0,
                        parseFloat(customer.total_due) -
                          parseFloat(paymentData.amount || 0),
                      ).toFixed(2)
                    : '0.00'}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                autoFocus
                required
                fullWidth
                type="number"
                label="Amount to Pay"
                variant="outlined"
                value={paymentData.amount}
                onChange={(e) =>
                  setPaymentData({ ...paymentData, amount: e.target.value })
                }
                inputProps={{
                  max: customer ? parseFloat(customer.total_due) : undefined,
                  step: '0.01',
                  min: '0.01',
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Typography fontWeight={700} color="text.secondary">
                        ₹
                      </Typography>
                    </InputAdornment>
                  ),
                  sx: { fontWeight: 700, fontSize: '1.2rem', borderRadius: 2 },
                }}
              />

              <TextField
                fullWidth
                multiline
                rows={3}
                label="Transaction Note"
                placeholder="e.g. Cash payment, Check #1234, etc."
                value={paymentData.note}
                onChange={(e) =>
                  setPaymentData({ ...paymentData, note: e.target.value })
                }
                InputProps={{
                  sx: { borderRadius: 2 },
                }}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button
            onClick={handleClosePayment}
            variant="text"
            color="inherit"
            disabled={paymentLoading}
            sx={{ fontWeight: 700 }}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="record-payment-form"
            variant="contained"
            color="success"
            size="large"
            disabled={
              paymentLoading ||
              !paymentData.amount ||
              Number(paymentData.amount) <= 0
            }
            sx={{
              fontWeight: 800,
              px: 4,
              borderRadius: 2,
              boxShadow: '0 4px 12px rgba(46,125,50,0.2)',
            }}
          >
            {paymentLoading ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              'Confirm Payment'
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CustomerProfile;
