import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { purchasesApi } from '../api/api';
import {
  Box,
  Typography,
  Button,
  Grid,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Divider,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PaymentIcon from '@mui/icons-material/Payment';

// ─── styles ───────────────────────────────────────────────────────────────────
const sectionStyle = {
  border: '1px solid #e0e0e0',
  borderRadius: 1,
  mb: 2,
  bgcolor: 'white',
};
const sectionHeaderStyle = {
  px: 2,
  py: 1,
  bgcolor: '#f5f5f5',
  borderBottom: '1px solid #e0e0e0',
  borderRadius: '4px 4px 0 0',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};
const cellStyle = { fontSize: '13px', py: 1, px: 1.5, whiteSpace: 'nowrap' };
const headCellStyle = { ...cellStyle, fontWeight: 700, bgcolor: '#f5f5f5', color: '#333' };

const fmt = (n) => `₹${parseFloat(n || 0).toFixed(2)}`;

const renderStatusChip = (status) => {
  switch (status) {
    case 'paid':
      return <Chip label="Paid" color="success" size="small" sx={{ fontWeight: 600 }} />;
    case 'partial':
      return <Chip label="Partial" color="warning" size="small" sx={{ fontWeight: 600 }} />;
    case 'unpaid':
    default:
      return <Chip label="Unpaid" color="error" size="small" sx={{ fontWeight: 600 }} />;
  }
};

const PurchaseDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [purchase, setPurchase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal State
  const [openModal, setOpenModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [payerName, setPayerName] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState(null);

  useEffect(() => {
    fetchDetails();
  }, [id]);

  const fetchDetails = async () => {
    try {
      setLoading(true);
      const data = await purchasesApi.getById(id);
      setPurchase(data);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load purchase details');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = () => {
    const remaining = parseFloat(purchase?.amount_due ?? ((purchase?.total_amount || 0) - (purchase?.total_paid || 0)));
    setPaymentAmount(remaining > 0 ? remaining.toFixed(2) : '');
    setPayerName('');
    setPaymentNote('');
    setModalError(null);
    setOpenModal(true);
  };

  const handleCloseModal = () => {
    if (!submitting) {
      setOpenModal(false);
      setModalError(null);
    }
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    setModalError(null);

    const amountNum = parseFloat(paymentAmount);
    const amountDue = parseFloat(purchase?.amount_due ?? ((purchase?.total_amount || 0) - (purchase?.total_paid || 0)));

    if (isNaN(amountNum) || amountNum <= 0) {
      setModalError('Please enter a valid payment amount greater than 0');
      return;
    }

    if (amountNum > amountDue + 0.001) {
      setModalError(`Payment amount cannot exceed remaining amount due (${fmt(amountDue)})`);
      return;
    }

    try {
      setSubmitting(true);
      await purchasesApi.recordPayment(id, {
        amount: amountNum,
        payer_name: payerName.trim() || undefined,
        note: paymentNote.trim() || undefined,
      });
      setOpenModal(false);
      fetchDetails();
    } catch (err) {
      setModalError(err.message || 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !purchase) {
    return (
      <Box sx={{ maxWidth: 1200, mx: 'auto', pb: 4 }}>
        <Alert severity="error" action={<Button color="inherit" onClick={() => navigate(-1)}>Go Back</Button>}>
          {error || 'Purchase not found'}
        </Alert>
      </Box>
    );
  }

  const totalAmount = parseFloat(purchase.total_amount || 0);
  const totalPaid = parseFloat(purchase.total_paid || 0);
  const amountDue = Math.max(0, parseFloat(purchase.amount_due ?? (totalAmount - totalPaid)));
  const isPaid = purchase.payment_status === 'paid' || amountDue <= 0;

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', pb: 4, minWidth: 1200 }}>
      {/* ── Page Header ── */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <IconButton onClick={() => navigate(-1)} size="small">
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography variant="h5" fontWeight={700} lineHeight={1.2}>
                Purchase Details (PUR-{purchase.id})
              </Typography>
              {renderStatusChip(purchase.payment_status)}
            </Box>
            <Typography variant="caption" color="text.secondary">
              View detailed information about this purchase entry
            </Typography>
          </Box>
        </Box>
        {!isPaid && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<PaymentIcon />}
            onClick={handleOpenModal}
          >
            Record Payment
          </Button>
        )}
      </Box>

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
        {/* Left Column 70% */}
        <Box sx={{ width: { xs: '100%', md: '70%' }, display: 'flex', flexDirection: 'column' }}>
          
          {/* ── Invoice Details ── */}
          <Box sx={sectionStyle}>
            <Box sx={sectionHeaderStyle}>
              <Typography variant="subtitle2" fontWeight={700}>Invoice & Supplier Details</Typography>
            </Box>
            <Box sx={{ p: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block">Supplier Name</Typography>
                  <Typography variant="body2" fontWeight={600}>{purchase.supplier_name || '—'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block">Supplier GSTIN</Typography>
                  <Typography variant="body2" fontWeight={600}>{purchase.supplier_gstin || '—'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block">Invoice Number</Typography>
                  <Typography variant="body2" fontWeight={600}>{purchase.invoice_no || '—'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block">Invoice Date</Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {new Date(purchase.invoice_date).toLocaleDateString()}
                  </Typography>
                </Grid>
                {purchase.notes && (
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary" display="block">Notes</Typography>
                    <Typography variant="body2">{purchase.notes}</Typography>
                  </Grid>
                )}
              </Grid>
            </Box>
          </Box>

          {/* ── Items Table ── */}
          <Box sx={sectionStyle}>
            <Box sx={sectionHeaderStyle}>
              <Typography variant="subtitle2" fontWeight={700}>
                Items ({purchase.items?.length || 0})
              </Typography>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {["#", "Product", "Batch", "Qty", "Cost/Unit", "MRP", "GST%", "Taxable", "GST Amt", "Total"].map((h) => (
                      <TableCell key={h} sx={headCellStyle} align={["Qty", "Cost/Unit", "MRP", "GST%", "Taxable", "GST Amt", "Total"].includes(h) ? "right" : "left"}>
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {purchase.items?.map((item, idx) => (
                    <TableRow key={idx} sx={{ "&:hover": { bgcolor: "#fafafa" } }}>
                      <TableCell sx={cellStyle}>{idx + 1}</TableCell>
                      <TableCell sx={{ ...cellStyle, fontWeight: 500 }}>{item.product_name}</TableCell>
                      <TableCell sx={{ ...cellStyle, color: "text.secondary" }}>{item.batch_no}</TableCell>
                      <TableCell sx={cellStyle} align="right">{item.qty}</TableCell>
                      <TableCell sx={cellStyle} align="right">{fmt(item.cost_price)}</TableCell>
                      <TableCell sx={cellStyle} align="right">{item.mrp ? fmt(item.mrp) : "—"}</TableCell>
                      <TableCell sx={cellStyle} align="right">{item.gst_rate}%</TableCell>
                      <TableCell sx={cellStyle} align="right">{fmt(item.taxable_amount)}</TableCell>
                      <TableCell sx={cellStyle} align="right">{fmt(parseFloat(item.cgst_amount || 0) + parseFloat(item.sgst_amount || 0))}</TableCell>
                      <TableCell sx={{ ...cellStyle, fontWeight: 700 }} align="right">{fmt(item.total_amount)}</TableCell>
                    </TableRow>
                  ))}
                  {(!purchase.items || purchase.items.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={10} align="center" sx={{ py: 3, color: 'text.secondary' }}>No items found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>

          {/* ── Payment History Table ── */}
          <Box sx={sectionStyle}>
            <Box sx={sectionHeaderStyle}>
              <Typography variant="subtitle2" fontWeight={700}>
                Payment History ({purchase.payments?.length || 0})
              </Typography>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {["#", "Date & Time", "Amount", "Payer Name", "Recorded By", "Note"].map((h) => (
                      <TableCell key={h} sx={headCellStyle} align={h === "Amount" ? "right" : "left"}>
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {purchase.payments?.map((pmt, idx) => (
                    <TableRow key={pmt.id || idx} sx={{ "&:hover": { bgcolor: "#fafafa" } }}>
                      <TableCell sx={cellStyle}>{idx + 1}</TableCell>
                      <TableCell sx={cellStyle}>
                        {new Date(pmt.created_at || pmt.paid_at).toLocaleDateString()}{' '}
                        <Typography component="span" variant="caption" color="text.secondary">
                          {new Date(pmt.created_at || pmt.paid_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ ...cellStyle, fontWeight: 600, color: 'success.main' }} align="right">
                        {fmt(pmt.amount)}
                      </TableCell>
                      <TableCell sx={cellStyle}>{pmt.payer_name || '—'}</TableCell>
                      <TableCell sx={cellStyle}>{pmt.recorded_by_name || '—'}</TableCell>
                      <TableCell sx={{ ...cellStyle, color: 'text.secondary' }}>{pmt.note || '—'}</TableCell>
                    </TableRow>
                  ))}
                  {(!purchase.payments || purchase.payments.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                        No payments recorded yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>

        </Box>

        {/* Right Column 30% */}
        <Box sx={{ width: { xs: '100%', md: '30%' } }}>
          {/* ── Summary ── */}
          <Box sx={{ ...sectionStyle, mb: 0 }}>
            <Box sx={sectionHeaderStyle}>
              <Typography variant="subtitle2" fontWeight={700}>Purchase Summary</Typography>
            </Box>
            <Box sx={{ p: 2 }}>
              {[
                ["Total Items", purchase.items?.length || 0],
                ["Total Taxable", fmt(purchase.total_taxable)],
                ["Total CGST", fmt(purchase.total_cgst)],
                ["Total SGST", fmt(purchase.total_sgst)],
              ].map(([label, value]) => (
                <Box key={label} sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                  <Typography variant="body2" color="text.secondary" fontSize="13px">{label}</Typography>
                  <Typography variant="body2" fontWeight={600} fontSize="13px">{value}</Typography>
                </Box>
              ))}
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                <Typography fontWeight={700}>Grand Total</Typography>
                <Typography fontWeight={700} color="primary.main" fontSize="18px">{fmt(totalAmount)}</Typography>
              </Box>
              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                <Typography variant="body2" color="text.secondary">Total Paid</Typography>
                <Typography variant="body2" fontWeight={600} color="success.main">{fmt(totalPaid)}</Typography>
              </Box>
              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
                <Typography variant="body2" color="text.secondary">Amount Due</Typography>
                <Typography variant="body2" fontWeight={700} color={amountDue > 0 ? "error.main" : "text.primary"}>
                  {fmt(amountDue)}
                </Typography>
              </Box>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Typography variant="body2" color="text.secondary">Payment Status</Typography>
                {renderStatusChip(purchase.payment_status)}
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* ── Record Payment Modal ── */}
      <Dialog open={openModal} onClose={handleCloseModal} maxWidth="xs" fullWidth>
        <form onSubmit={handleRecordPayment}>
          <DialogTitle fontWeight={700}>Record Purchase Payment</DialogTitle>
          <DialogContent dividers>
            {modalError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {modalError}
              </Alert>
            )}
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary" display="block">
                Purchase Total: {fmt(totalAmount)} | Remaining Due: <strong>{fmt(amountDue)}</strong>
              </Typography>
            </Box>
            <TextField
              label="Payment Amount"
              type="number"
              fullWidth
              required
              margin="dense"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              inputProps={{ min: 0.01, step: 0.01, max: amountDue }}
              helperText={`Maximum payment allowed: ${fmt(amountDue)}`}
            />
            <TextField
              label="Payer Name (Optional)"
              type="text"
              fullWidth
              margin="dense"
              value={payerName}
              onChange={(e) => setPayerName(e.target.value)}
              placeholder="e.g. John Doe / Vendor Representative"
            />
            <TextField
              label="Note (Optional)"
              type="text"
              fullWidth
              multiline
              rows={2}
              margin="dense"
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.target.value)}
              placeholder="e.g. Bank Transfer / Cheque No. #12345"
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={handleCloseModal} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={submitting}
            >
              {submitting ? <CircularProgress size={24} color="inherit" /> : 'Submit Payment'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default PurchaseDetails;
