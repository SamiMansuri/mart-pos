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
  Divider,
  Alert,
  CircularProgress,
  IconButton,
  Chip,
  Card,
  CardContent,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Receipt as BillIcon,
  History as HistoryIcon,
  ShoppingBag as ItemIcon,
  AttachMoney as RefundIcon,
  Assignment as EventIcon,
} from '@mui/icons-material';
import { billsApi } from '../api/api';

const AdminBillDetails = () => {
  const { billId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    const fetchDetails = async () => {
      setLoading(true);
      try {
        const details = await billsApi.getDetails(billId);
        setData(details);
      } catch (err) {
        setError(err.message || 'Failed to fetch bill details');
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [billId]);

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '60vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error || !data) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">{error || 'Bill not found'}</Alert>
        <Button
          startIcon={<BackIcon />}
          onClick={() => navigate('/bills')}
          sx={{ mt: 2 }}
        >
          Back to Bills
        </Button>
      </Box>
    );
  }

  const { bill, items, returns, refunds, events, summary } = data;

  const getStatusColor = (status) => {
    if (status === 'PAID') return 'success';
    if (status === 'VOIDED') return 'error';
    if (status === 'RETURNED') return 'warning';
    if (status === 'PARTIALLY_REFUNDED') return 'info';
    if (status === 'REFUNDED') return 'secondary';
    return 'default';
  };

  return (
    <Box>
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
        <IconButton onClick={() => navigate('/bills')}>
          <BackIcon />
        </IconButton>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Bill Details
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Trans ID: {bill.id}
          </Typography>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Header Summary */}
        <Grid item xs={12}>
          <Card
            elevation={0}
            sx={{ border: '1px solid', borderColor: 'divider' }}
          >
            <CardContent>
              <Grid container spacing={4}>
                <Grid item xs={6} md={3}>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    fontWeight={700}
                  >
                    BILL NUMBER
                  </Typography>
                  <Typography variant="h6" fontWeight={700}>
                    {bill.bill_number}
                  </Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    fontWeight={700}
                  >
                    DATE & TIME
                  </Typography>
                  <Typography variant="body1">
                    {new Date(bill.created_at).toLocaleString()}
                  </Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    fontWeight={700}
                  >
                    CASHIER
                  </Typography>
                  <Typography variant="body1">
                    {bill.cashier_name} (ID: {bill.created_by})
                  </Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    fontWeight={700}
                  >
                    STATUS
                  </Typography>
                  <Box sx={{ mt: 0.5 }}>
                    <Chip
                      label={bill.is_void ? 'VOIDED' : bill.payment_status}
                      color={getStatusColor(
                        bill.is_void ? 'VOIDED' : bill.payment_status,
                      )}
                      size="small"
                      sx={{ fontWeight: 700 }}
                    />
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Items Table */}
        <Grid item xs={12} lg={8}>
          <Paper
            elevation={0}
            sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}
          >
            <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
              <ItemIcon color="primary" />
              <Typography variant="h6" fontWeight={700}>
                Bill Items
              </Typography>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Product Name</TableCell>
                    <TableCell align="right">Qty</TableCell>
                    <TableCell align="right">Price</TableCell>
                    <TableCell align="right">Total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {item.product_name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Barcode: {item.barcode}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{item.quantity}</TableCell>
                      <TableCell align="right">
                        ₹{Number(item.price).toFixed(2)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        ₹{Number(item.line_total).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          {/* Returns & Refunds Section */}
          <Paper
            elevation={0}
            sx={{ p: 3, mt: 3, border: '1px solid', borderColor: 'divider' }}
          >
            <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
              <HistoryIcon color="secondary" />
              <Typography variant="h6" fontWeight={700}>
                Returns & Refunds
              </Typography>
            </Box>

            {returns.length === 0 && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ py: 2, textAlign: 'center' }}
              >
                No return transactions found for this bill.
              </Typography>
            )}

            {returns.map((ret, idx) => (
              <Box key={ret.id} sx={{ mb: idx === returns.length - 1 ? 0 : 4 }}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    bgcolor: 'action.hover',
                    p: 1.5,
                    borderRadius: 1,
                  }}
                >
                  <Box>
                    <Typography variant="subtitle2" fontWeight={700}>
                      Return #{ret.return_number || ret.id}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(ret.created_at).toLocaleString()} by{' '}
                      {ret.return_by_name}
                    </Typography>
                  </Box>
                  <Typography
                    variant="subtitle1"
                    fontWeight={800}
                    color="error.main"
                  >
                    -₹{Number(ret.total_return_amount).toFixed(2)}
                  </Typography>
                </Box>
                <Table size="small" sx={{ mt: 1 }}>
                  <TableBody>
                    {ret.items.map((ri) => (
                      <TableRow key={ri.id}>
                        <TableCell sx={{ border: 'none', py: 0.5 }}>
                          {ri.product_name}
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{ border: 'none', py: 0.5 }}
                        >
                          x{ri.quantity}
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{ border: 'none', py: 0.5 }}
                        >
                          ₹{Number(ri.line_total).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            ))}

            {refunds.length > 0 && <Divider sx={{ my: 3 }} />}

            {refunds.map((ref) => (
              <Box
                key={ref.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  p: 2,
                  mb: 1,
                  border: '1px dashed',
                  borderColor: 'divider',
                  borderRadius: 1,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <RefundIcon fontSize="small" color="primary" />
                  <Box>
                    <Typography variant="subtitle2" fontWeight={700}>
                      Refund via {ref.payment_method}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(ref.created_at).toLocaleString()} | {ref.reason}
                    </Typography>
                  </Box>
                </Box>
                <Typography
                  variant="subtitle1"
                  fontWeight={800}
                  color="primary.main"
                >
                  ₹{Number(ref.amount).toFixed(2)}
                </Typography>
              </Box>
            ))}
          </Paper>
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} lg={4}>
          <Paper
            elevation={0}
            sx={{ p: 4, mb: 4, border: '1px solid', borderColor: 'divider' }}
          >
            <Typography variant="h6" gutterBottom fontWeight={700}>
              Account Summary
            </Typography>
            <Divider sx={{ mb: 3 }} />

            <Box sx={{ display: 'flex', alignItems: 'baseline', mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Gross Amount
              </Typography>
              <Box
                sx={{
                  flex: 1,
                  borderBottom: '1px dotted',
                  borderColor: 'divider',
                  mx: 1.5,
                }}
              />
              <Typography variant="body2" fontWeight={600}>
                ₹{summary.gross_amount.toFixed(2)}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'baseline', mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Total Returned
              </Typography>
              <Box
                sx={{
                  flex: 1,
                  borderBottom: '1px dotted',
                  borderColor: 'divider',
                  mx: 1.5,
                }}
              />
              <Typography variant="body2" color="error.main" fontWeight={600}>
                -₹{summary.total_returned.toFixed(2)}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'baseline', mb: 3 }}>
              <Typography variant="body2" color="text.secondary">
                Total Refunded
              </Typography>
              <Box
                sx={{
                  flex: 1,
                  borderBottom: '1px dotted',
                  borderColor: 'divider',
                  mx: 1.5,
                }}
              />
              <Typography variant="body2" color="primary.main" fontWeight={600}>
                ₹{summary.total_refunded.toFixed(2)}
              </Typography>
            </Box>

            <Divider sx={{ mb: 3 }} />

            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Typography variant="h6" fontWeight={700}>
                Net Value
              </Typography>
              <Typography variant="h6" fontWeight={800} color="primary">
                ₹{summary.net_value.toFixed(2)}
              </Typography>
            </Box>
          </Paper>

          <Paper
            elevation={0}
            sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}
          >
            <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <EventIcon color="action" />
              <Typography variant="h6" fontWeight={700}>
                Audit Trail
              </Typography>
            </Box>
            <Box sx={{ mt: 2 }}>
              {events.map((event, idx) => (
                <Box
                  key={event.id}
                  sx={{
                    position: 'relative',
                    pb: idx === events.length - 1 ? 0 : 3,
                    pl: 3,
                    '&:before': {
                      content: '""',
                      position: 'absolute',
                      left: 10,
                      top: 0,
                      bottom: 0,
                      width: '1px',
                      bgcolor:
                        idx === events.length - 1 ? 'transparent' : 'divider',
                    },
                    '&:after': {
                      content: '""',
                      position: 'absolute',
                      left: 6,
                      top: 6,
                      width: 9,
                      height: 9,
                      borderRadius: '50%',
                      bgcolor: 'primary.main',
                    },
                  }}
                >
                  <Typography
                    variant="body2"
                    fontWeight={700}
                    sx={{ lineHeight: 1.2 }}
                  >
                    {event.event_type.replace('_', ' ')}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    display="block"
                  >
                    {new Date(event.created_at).toLocaleString()}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ mt: 0.5, display: 'block' }}
                  >
                    By {event.performer_name} ({event.performer_role})
                  </Typography>
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AdminBillDetails;
