import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  Chip,
  TextField,
  Alert,
  CircularProgress,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Card,
  CardContent,
  Divider,
  Stack,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  FileDownload as DownloadIcon,
  Refresh as RefreshIcon,
  Print as PrintIcon,
  WarningAmber as WarningIcon,
  InfoOutlined as InfoIcon,
  Receipt as ReceiptIcon,
  TrendingDown as ReturnIcon,
  ShoppingCart as PurchaseIcon,
  AccountBalanceWallet as WalletIcon,
} from '@mui/icons-material';
import { reportsApi } from '../api/api';
import {
  formatINR,
  formatRate,
  getPeriodPresets,
  countDistinctPurchaseInvoices,
} from '../utils/gstReport.utils';
import './GstSummaryReport.css';

const GstSummaryReport = () => {
  // Preset definitions
  const presets = useMemo(() => getPeriodPresets(), []);

  // Default to "Last month"
  const defaultDates = useMemo(
    () => presets['Last month'] || { from: '', to: '' },
    [presets]
  );

  const [from, setFrom] = useState(defaultDates.from);
  const [to, setTo] = useState(defaultDates.to);
  const [activePreset, setActivePreset] = useState('Last month');
  const [validationError, setValidationError] = useState('');

  // Report data state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [purchaseInvoiceCount, setPurchaseInvoiceCount] = useState(0);

  // Download state
  const [downloading, setDownloading] = useState({
    gstSummary: false,
    salesRegister: false,
    purchaseRegister: false,
  });
  const [downloadError, setDownloadError] = useState(null);

  // Fetch report
  const fetchReport = useCallback(async (fromDate, toDate) => {
    if (!fromDate || !toDate) {
      setValidationError('Please select both From and To dates.');
      return;
    }
    if (fromDate > toDate) {
      setValidationError('From date cannot be greater than To date.');
      return;
    }

    setValidationError('');
    setError(null);
    setLoading(true);

    try {
      // Fetch GST summary & Purchase register concurrently
      const [gstRes, purchaseRes] = await Promise.all([
        reportsApi.getGstSummary(fromDate, toDate),
        reportsApi.getPurchaseRegister(fromDate, toDate),
      ]);

      setReportData(gstRes);

      const uniquePurchases = countDistinctPurchaseInvoices(
        purchaseRes?.rows || []
      );
      setPurchaseInvoiceCount(uniquePurchases);
    } catch (err) {
      console.error('Failed to load GST Summary:', err);
      setError(err?.message || err?.error || 'Failed to load report data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load on mount
  useEffect(() => {
    fetchReport(defaultDates.from, defaultDates.to);
  }, [fetchReport, defaultDates]);

  // Handle Preset click
  const handlePresetSelect = (presetName) => {
    const range = presets[presetName];
    if (range) {
      setFrom(range.from);
      setTo(range.to);
      setActivePreset(presetName);
      setValidationError('');
      fetchReport(range.from, range.to);
    }
  };

  // Handle manual date input changes
  const handleFromChange = (e) => {
    setFrom(e.target.value);
    setActivePreset('Custom');
  };

  const handleToChange = (e) => {
    setTo(e.target.value);
    setActivePreset('Custom');
  };

  const handleShowReport = () => {
    fetchReport(from, to);
  };

  // Downloads handler
  const handleDownload = async (type) => {
    setDownloadError(null);
    setDownloading((prev) => ({ ...prev, [type]: true }));

    try {
      if (type === 'gstSummary') {
        await reportsApi.downloadGstSummary(from, to);
      } else if (type === 'salesRegister') {
        await reportsApi.downloadSalesRegister(from, to);
      } else if (type === 'purchaseRegister') {
        await reportsApi.downloadPurchaseRegister(from, to);
      }
    } catch (err) {
      console.error(`Failed to download ${type}:`, err);
      setDownloadError(err?.message || 'Download failed. Please try again.');
    } finally {
      setDownloading((prev) => ({ ...prev, [type]: false }));
    }
  };

  // Reusable Section Table Component
  const renderGstTable = (title, icon, sectionData, isReturn = false) => {
    const rows = sectionData?.rows || [];
    const totals = {
      taxable: Number(sectionData?.taxable) || 0,
      cgst: Number(sectionData?.cgst) || 0,
      sgst: Number(sectionData?.sgst) || 0,
      tax: Number(sectionData?.tax) || 0,
    };

    return (
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, sm: 2.5 },
          mb: 3,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          {icon}
          <Typography variant="h6" fontWeight={700}>
            {title}
          </Typography>
        </Box>

        <div className="gst-table-wrapper">
          <Table size="small" aria-label={title}>
            <TableHead sx={{ bgcolor: 'action.hover' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, minWidth: 100 }}>Rate</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, minWidth: 140 }}>
                  Taxable Value
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, minWidth: 120 }}>
                  CGST
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, minWidth: 120 }}>
                  SGST
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, minWidth: 130 }}>
                  Total Tax
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    align="center"
                    sx={{ py: 3, color: 'text.secondary', fontStyle: 'italic' }}
                  >
                    No data for this period
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row, index) => {
                  const taxable = Number(row.taxable) || 0;
                  const cgst = Number(row.cgst) || 0;
                  const sgst = Number(row.sgst) || 0;
                  const lineTax = cgst + sgst;

                  return (
                    <TableRow key={index} hover>
                      <TableCell sx={{ fontWeight: 600 }}>
                        {formatRate(row.rate)}
                      </TableCell>
                      <TableCell className={`gst-num-cell ${isReturn ? 'gst-negative-amt' : ''}`}>
                        {formatINR(taxable, isReturn)}
                      </TableCell>
                      <TableCell className={`gst-num-cell ${isReturn ? 'gst-negative-amt' : ''}`}>
                        {formatINR(cgst, isReturn)}
                      </TableCell>
                      <TableCell className={`gst-num-cell ${isReturn ? 'gst-negative-amt' : ''}`}>
                        {formatINR(sgst, isReturn)}
                      </TableCell>
                      <TableCell
                        className={`gst-num-cell ${isReturn ? 'gst-negative-amt' : ''}`}
                        sx={{ fontWeight: 600 }}
                      >
                        {formatINR(lineTax, isReturn)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}

              {/* Bold Totals Row */}
              {rows.length > 0 && (
                <TableRow className="gst-totals-row">
                  <TableCell sx={{ fontWeight: 700 }}>Total</TableCell>
                  <TableCell className={`gst-num-cell ${isReturn ? 'gst-negative-amt' : ''}`}>
                    {formatINR(totals.taxable, isReturn)}
                  </TableCell>
                  <TableCell className={`gst-num-cell ${isReturn ? 'gst-negative-amt' : ''}`}>
                    {formatINR(totals.cgst, isReturn)}
                  </TableCell>
                  <TableCell className={`gst-num-cell ${isReturn ? 'gst-negative-amt' : ''}`}>
                    {formatINR(totals.sgst, isReturn)}
                  </TableCell>
                  <TableCell className={`gst-num-cell ${isReturn ? 'gst-negative-amt' : ''}`}>
                    {formatINR(totals.tax, isReturn)}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Paper>
    );
  };

  const isAnyDownloading = Object.values(downloading).some(Boolean);

  return (
    <Box className="gst-report-container">
      {/* Printable Header */}
      <Box className="gst-print-header">
        <Typography variant="h5" className="gst-print-title">
          Family Mart POS — GST Summary Report
        </Typography>
        <Typography variant="body2" className="gst-print-period">
          Period: <b>{from}</b> to <b>{to}</b> | Generated: {new Date().toLocaleString('en-IN')}
        </Typography>
      </Box>

      {/* Screen Page Header */}
      <Box sx={{ mb: 3 }} className="no-print">
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h4" fontWeight={800} color="primary" gutterBottom>
              GST Summary Report
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Tax liabilities, credit notes, and input tax credit overview for GST filing
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Print Clean Report (A4)">
              <span>
                <Button
                  variant="outlined"
                  startIcon={<PrintIcon />}
                  onClick={() => window.print()}
                  disabled={loading || isAnyDownloading}
                  sx={{ fontWeight: 700 }}
                >
                  Print
                </Button>
              </span>
            </Tooltip>
          </Box>
        </Box>
      </Box>

      {/* 1. Period Selector & Controls Card */}
      <Paper
        elevation={0}
        className="gst-controls-card no-print"
        sx={{
          p: { xs: 2, sm: 3 },
          mb: 3,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
        }}
      >
        <Grid container spacing={2.5} alignItems="center">
          {/* Quick Presets */}
          <Grid item xs={12} lg={6}>
            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 1, textTransform: 'uppercase' }}>
              Quick Presets
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {Object.keys(presets).map((preset) => (
                <Chip
                  key={preset}
                  label={preset}
                  onClick={() => handlePresetSelect(preset)}
                  color={activePreset === preset ? 'primary' : 'default'}
                  variant={activePreset === preset ? 'filled' : 'outlined'}
                  clickable
                  disabled={loading || isAnyDownloading}
                  sx={{
                    fontWeight: 600,
                    borderRadius: 1.5,
                  }}
                />
              ))}
            </Box>
          </Grid>

          {/* Date Range Inputs */}
          <Grid item xs={12} sm={8} lg={4}>
            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 1, textTransform: 'uppercase' }}>
              Period (YYYY-MM-DD)
            </Typography>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <TextField
                fullWidth
                size="small"
                label="From"
                type="date"
                value={from}
                onChange={handleFromChange}
                disabled={loading || isAnyDownloading}
                InputLabelProps={{ shrink: true }}
              />
              <Typography color="text.secondary" fontWeight={600}>
                to
              </Typography>
              <TextField
                fullWidth
                size="small"
                label="To"
                type="date"
                value={to}
                onChange={handleToChange}
                disabled={loading || isAnyDownloading}
                InputLabelProps={{ shrink: true }}
              />
            </Stack>
          </Grid>

          {/* Action Button */}
          <Grid item xs={12} sm={4} lg={2}>
            <Box sx={{ height: { sm: 22 }, display: { xs: 'none', sm: 'block' } }} />
            <Button
              fullWidth
              variant="contained"
              onClick={handleShowReport}
              disabled={loading || isAnyDownloading}
              startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <RefreshIcon />}
              sx={{ height: 40, fontWeight: 700 }}
            >
              {loading ? 'Loading...' : 'Show Report'}
            </Button>
          </Grid>

          {/* Validation Error */}
          {validationError && (
            <Grid item xs={12}>
              <Alert severity="error" sx={{ py: 0.5 }}>
                {validationError}
              </Alert>
            </Grid>
          )}
        </Grid>
      </Paper>

      {/* Download Alert Error */}
      {downloadError && (
        <Alert
          severity="error"
          onClose={() => setDownloadError(null)}
          sx={{ mb: 3 }}
          className="no-print"
        >
          {downloadError}
        </Alert>
      )}

      {/* Main Error with Retry */}
      {error && !loading && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => fetchReport(from, to)}>
              Retry
            </Button>
          }
          sx={{ mb: 3 }}
        >
          {error}
        </Alert>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <Box sx={{ my: 2 }}>
          <Skeleton variant="rectangular" height={50} sx={{ mb: 2, borderRadius: 2 }} />
          <Skeleton variant="rectangular" height={180} sx={{ mb: 3, borderRadius: 2 }} />
          <Skeleton variant="rectangular" height={180} sx={{ mb: 3, borderRadius: 2 }} />
          <Skeleton variant="rectangular" height={180} sx={{ mb: 3, borderRadius: 2 }} />
          <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 2 }} />
        </Box>
      )}

      {/* Loaded Content */}
      {!loading && reportData && (
        <>
          {/* 2. Warning Banner (Amber style when zeroRatedSales > 0) */}
          {Number(reportData.warnings?.zeroRatedSales) > 0 && (
            <Alert
              severity="warning"
              icon={<WarningIcon fontSize="inherit" />}
              className="gst-warning-banner"
              sx={{
                mb: 2,
                borderRadius: 2,
                bgcolor: '#fff8e1',
                color: '#8c5000',
                border: '1px solid #ffe082',
                '& .MuiAlert-icon': { color: '#f57c00' },
              }}
            >
              <b>{formatINR(reportData.warnings.zeroRatedSales)}</b> of sales across{' '}
              <b>{reportData.warnings.zeroRatedProducts}</b> products were billed at 0% GST.{' '}
              Confirm item rates before filing.
            </Alert>
          )}

          {/* 3. Info line under banner */}
          <Box
            className="gst-info-line"
            sx={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 1.5,
              mb: 3,
              p: 1.5,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <InfoIcon fontSize="small" color="primary" />
              <Typography variant="body2" fontWeight={600}>
                Purchase invoices entered for this period:{' '}
                <Box component="span" sx={{ color: 'primary.main', fontWeight: 800 }}>
                  {purchaseInvoiceCount}
                </Box>
              </Typography>
            </Box>

            {purchaseInvoiceCount <= 1 && (
              <Chip
                size="small"
                icon={<WarningIcon />}
                label="Input credit may be incomplete"
                color="warning"
                variant="outlined"
                sx={{ fontWeight: 600 }}
              />
            )}
          </Box>

          {/* 5. Export Action Buttons */}
          <Box
            className="gst-export-actions no-print"
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1.5,
              mb: 3,
            }}
          >
            <Button
              variant="outlined"
              color="primary"
              startIcon={
                downloading.gstSummary ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <DownloadIcon />
                )
              }
              disabled={isAnyDownloading}
              onClick={() => handleDownload('gstSummary')}
              sx={{ fontWeight: 600, flexGrow: { xs: 1, sm: 0 } }}
            >
              {downloading.gstSummary ? 'Downloading...' : 'Download GST Summary (Excel)'}
            </Button>

            <Button
              variant="outlined"
              color="primary"
              startIcon={
                downloading.salesRegister ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <DownloadIcon />
                )
              }
              disabled={isAnyDownloading}
              onClick={() => handleDownload('salesRegister')}
              sx={{ fontWeight: 600, flexGrow: { xs: 1, sm: 0 } }}
            >
              {downloading.salesRegister ? 'Downloading...' : 'Download Sales Register (Excel)'}
            </Button>

            <Button
              variant="outlined"
              color="primary"
              startIcon={
                downloading.purchaseRegister ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <DownloadIcon />
                )
              }
              disabled={isAnyDownloading}
              onClick={() => handleDownload('purchaseRegister')}
              sx={{ fontWeight: 600, flexGrow: { xs: 1, sm: 0 } }}
            >
              {downloading.purchaseRegister
                ? 'Downloading...'
                : 'Download Purchase Register (Excel)'}
            </Button>
          </Box>

          {/* 4. Four Sections */}
          {/* Section A: Output GST (Sales) */}
          {renderGstTable(
            'Output GST (Sales)',
            <ReceiptIcon color="primary" />,
            reportData.output,
            false
          )}

          {/* Section B: Credit notes (Returns) */}
          {renderGstTable(
            'Credit Notes (Returns)',
            <ReturnIcon color="error" />,
            reportData.returns,
            true
          )}

          {/* Section C: Input GST (Purchases) */}
          {renderGstTable(
            'Input GST (Purchases)',
            <PurchaseIcon color="success" />,
            reportData.input,
            false
          )}

          {/* Section D: Net GST Card */}
          <Card
            elevation={0}
            className="gst-net-card"
            sx={{
              p: { xs: 2, sm: 2.5 },
              mb: 3,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              bgcolor: 'background.paper',
            }}
          >
            <CardContent sx={{ p: '0 !important' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                <WalletIcon color="primary" />
                <Typography variant="h6" fontWeight={800}>
                  Net GST Summary
                </Typography>
              </Box>

              <Typography variant="body2" color="text.secondary" fontWeight={500} sx={{ mb: 2 }}>
                Net GST = Output - Returns - Input credit entered
              </Typography>

              <Divider sx={{ mb: 2.5 }} />

              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <Box
                    sx={{
                      p: 2,
                      bgcolor: 'action.hover',
                      borderRadius: 1.5,
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Typography variant="caption" color="text.secondary" fontWeight={700}>
                      NET CGST
                    </Typography>
                    <Typography variant="h5" fontWeight={800} color="text.primary">
                      {formatINR(reportData.payable?.cgst)}
                    </Typography>
                  </Box>
                </Grid>

                <Grid item xs={12} sm={4}>
                  <Box
                    sx={{
                      p: 2,
                      bgcolor: 'action.hover',
                      borderRadius: 1.5,
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Typography variant="caption" color="text.secondary" fontWeight={700}>
                      NET SGST
                    </Typography>
                    <Typography variant="h5" fontWeight={800} color="text.primary">
                      {formatINR(reportData.payable?.sgst)}
                    </Typography>
                  </Box>
                </Grid>

                <Grid item xs={12} sm={4}>
                  <Box
                    sx={{
                      p: 2,
                      bgcolor:
                        (Number(reportData.payable?.total) || 0) >= 0
                          ? 'primary.main'
                          : 'success.main',
                      color: 'primary.contrastText',
                      borderRadius: 1.5,
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{ opacity: 0.9, fontWeight: 700 }}
                    >
                      {(Number(reportData.payable?.total) || 0) >= 0
                        ? 'TOTAL GST PAYABLE'
                        : 'NET INPUT CREDIT (C/F)'}
                    </Typography>
                    <Typography variant="h5" fontWeight={900}>
                      {formatINR(reportData.payable?.total)}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </>
      )}
    </Box>
  );
};

export default GstSummaryReport;
