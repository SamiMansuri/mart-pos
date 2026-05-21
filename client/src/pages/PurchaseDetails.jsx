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
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

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
};
const cellStyle = { fontSize: '13px', py: 1, px: 1.5, whiteSpace: 'nowrap' };
const headCellStyle = { ...cellStyle, fontWeight: 700, bgcolor: '#f5f5f5', color: '#333' };

const fmt = (n) => `₹${parseFloat(n || 0).toFixed(2)}`;

const PurchaseDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [purchase, setPurchase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', pb: 4, minWidth: 1200 }}>
      {/* ── Page Header ── */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <IconButton onClick={() => navigate(-1)} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box>
          <Typography variant="h5" fontWeight={700} lineHeight={1.2}>
            Purchase Details (PUR-{purchase.id})
          </Typography>
          <Typography variant="caption" color="text.secondary">
            View detailed information about this purchase entry
          </Typography>
        </Box>
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
                  <Typography variant="body2" fontWeight={600}>{purchase.supplier_name}</Typography>
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
                <Typography fontWeight={700} color="primary.main" fontSize="18px">{fmt(purchase.total_amount)}</Typography>
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default PurchaseDetails;
