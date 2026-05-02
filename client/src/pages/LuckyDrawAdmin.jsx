import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  TextField,
  MenuItem,
  Button,
  Divider,
  IconButton,
  Autocomplete,
  CircularProgress,
  Snackbar,
  Alert,
  Paper,
} from '@mui/material';
import { Delete as DeleteIcon, Save as SaveIcon } from '@mui/icons-material';
import { luckyDrawApi, productsApi } from '../api/api';

const LuckyDrawAdmin = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [campaignId, setCampaignId] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    prefix: '',
    min_bill_amount: 2500,
    start_date: '',
    draw_date: '',
    status: 'inactive', // default
  });

  // Excluded Products State
  const [excludedProducts, setExcludedProducts] = useState([]);
  const [productOptions, setProductOptions] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [searchKey, setSearchKey] = useState('');

  // Toast state
  const [toast, setToast] = useState({
    open: false,
    message: '',
    severity: 'success',
  });

  const showToast = (message, severity = 'success') => {
    setToast({ open: true, message, severity });
  };

  const handleCloseToast = () => {
    setToast((prev) => ({ ...prev, open: false }));
  };

  useEffect(() => {
    fetchActiveCampaign();
  }, []);

  const fetchActiveCampaign = async () => {
    try {
      setLoading(true);
      const data = await luckyDrawApi.getActiveCampaign();
      if (data?.campaign) {
        setCampaignId(data.campaign.id);
        setFormData({
          name: data.campaign.name || '',
          prefix: data.campaign.prefix || '',
          min_bill_amount: data.campaign.min_bill_amount || 2500,
          start_date: data.campaign.start_date
            ? data.campaign.start_date.split('T')[0]
            : '',
          draw_date: data.campaign.draw_date
            ? data.campaign.draw_date.split('T')[0]
            : '',
          status: data.campaign.status || 'inactive',
        });
        fetchExcludedProducts(data.campaign.id);
      }
    } catch (err) {
      if (err?.status !== 404 && err?.message !== 'No active campaign found.') {
        showToast('Failed to fetch active campaign', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchExcludedProducts = async (id) => {
    try {
      const data = await luckyDrawApi.getExcludedProducts(id);
      setExcludedProducts(data?.excluded_products || []);
    } catch (err) {
      showToast('Failed to fetch excluded products', 'error');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveCampaign = async () => {
    if (new Date(formData.draw_date) <= new Date(formData.start_date)) {
      showToast('Draw date must be after start date.', 'error');
      return;
    }

    setSaving(true);
    try {
      if (campaignId) {
        await luckyDrawApi.updateCampaign(campaignId, formData);
        showToast('Campaign updated successfully.');
      } else {
        const data = await luckyDrawApi.createCampaign(formData);
        if (data?.campaign?.id) {
          setCampaignId(data.campaign.id);
          fetchExcludedProducts(data.campaign.id);
          showToast('Campaign created successfully.');
        }
      }
    } catch (err) {
      showToast(err?.message || 'Failed to save campaign', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Search Products for AutoComplete
  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      // Allow searching even with empty string if user opens dropdown
      try {
        setProductsLoading(true);
        const res = await productsApi.getAll(1, 20, searchKey);
        setProductOptions(res.products || []);
      } catch (err) {
        console.error('Product search failed', err);
      } finally {
        setProductsLoading(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounce);
  }, [searchKey]);

  const handleAddExcludedProduct = async (product) => {
    if (!campaignId || !product) return;
    try {
      await luckyDrawApi.addExcludedProduct(campaignId, product.id);
      showToast('Product excluded successfully.');
      fetchExcludedProducts(campaignId);
    } catch (err) {
      showToast(err?.message || 'Failed to exclude product.', 'error');
    }
  };

  const handleRemoveExcludedProduct = async (productId) => {
    if (!campaignId) return;
    try {
      await luckyDrawApi.removeExcludedProduct(campaignId, productId);
      showToast('Excluded product removed.');
      fetchExcludedProducts(campaignId);
    } catch (err) {
      showToast(err?.message || 'Failed to remove excluded product.', 'error');
    }
  };

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height="50vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1600, mx: 'auto' }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Lucky Draw Campaign Setup
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Section 1: Campaign Form */}
        <Grid item xs={12} md={campaignId ? 7 : 12} lg={campaignId ? 8 : 12}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2, md: 4 },
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
            }}
          >
            <Typography
              variant="subtitle1"
              fontWeight={700}
              sx={{ textTransform: 'uppercase', mb: 2, letterSpacing: 0.5 }}
            >
              {campaignId ? 'Edit Campaign' : 'Create Campaign'}
            </Typography>
            <Divider sx={{ mb: 4 }} />

            <Grid container spacing={3} sx={{ mb: 3 }}>
              {/* Row 1 */}
              <Grid item xs={12} xl={5}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  fontWeight="bold"
                  sx={{ display: 'block', mb: 1, textTransform: 'uppercase' }}
                >
                  Campaign Name *
                </Typography>
                <TextField
                  fullWidth
                  name="name"
                  placeholder="e.g. Big Lucky Draw 2026"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6} xl={3}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  fontWeight="bold"
                  sx={{ display: 'block', mb: 1, textTransform: 'uppercase' }}
                >
                  Ticket Prefix *
                </Typography>
                <TextField
                  fullWidth
                  name="prefix"
                  placeholder="LD-2026"
                  value={formData.prefix}
                  onChange={handleInputChange}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6} xl={4}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  fontWeight="bold"
                  sx={{ display: 'block', mb: 1, textTransform: 'uppercase' }}
                >
                  Min. Bill Amount (₹) *
                </Typography>
                <TextField
                  fullWidth
                  type="number"
                  name="min_bill_amount"
                  placeholder="2500"
                  value={formData.min_bill_amount}
                  onChange={handleInputChange}
                  required
                />
              </Grid>
            </Grid>

            <Grid container spacing={3}>
              {/* Row 2 */}
              <Grid item xs={12} sm={4} md={4}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  fontWeight="bold"
                  sx={{ display: 'block', mb: 1, textTransform: 'uppercase' }}
                >
                  Start Date *
                </Typography>
                <TextField
                  fullWidth
                  type="date"
                  name="start_date"
                  value={formData.start_date}
                  onChange={handleInputChange}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={4} md={4}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  fontWeight="bold"
                  sx={{ display: 'block', mb: 1, textTransform: 'uppercase' }}
                >
                  Draw Date *
                </Typography>
                <TextField
                  fullWidth
                  type="date"
                  name="draw_date"
                  value={formData.draw_date}
                  onChange={handleInputChange}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={4} md={4}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  fontWeight="bold"
                  sx={{ display: 'block', mb: 1, textTransform: 'uppercase' }}
                >
                  Status
                </Typography>
                <TextField
                  fullWidth
                  select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                >
                  <MenuItem value="inactive">Inactive</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                </TextField>
              </Grid>
            </Grid>

            <Box sx={{ mt: 5, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                size="large"
                startIcon={<SaveIcon />}
                onClick={handleSaveCampaign}
                disabled={saving}
                sx={{ minWidth: 150 }}
              >
                {saving
                  ? 'Saving...'
                  : campaignId
                    ? 'Update Campaign'
                    : 'Save Campaign'}
              </Button>
            </Box>
          </Paper>
        </Grid>

        {/* Section 2: Excluded Products */}
        {campaignId && (
          <Grid
            item
            xs={12}
            md={5}
            lg={4}
            sx={{ minWidth: 0, overflow: 'hidden' }}
          >
            <Paper
              elevation={0}
              sx={{
                p: { xs: 2, md: 4 },
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                height: '100%',
                overflow: 'hidden',
              }}
            >
              <Typography
                variant="subtitle1"
                fontWeight={700}
                sx={{ textTransform: 'uppercase', mb: 2, letterSpacing: 0.5 }}
              >
                Excluded Products
              </Typography>
              <Divider sx={{ mb: 4 }} />

              <Box sx={{ mb: 4 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  fontWeight="bold"
                  sx={{ display: 'block', mb: 1, textTransform: 'uppercase' }}
                >
                  Search Product
                </Typography>
                <Autocomplete
                  options={productOptions}
                  getOptionLabel={(option) =>
                    `${option.name} ${option.barcode ? `(${option.barcode})` : ''}`
                  }
                  loading={productsLoading}
                  onInputChange={(e, newInputValue) =>
                    setSearchKey(newInputValue)
                  }
                  onChange={(e, newValue) => {
                    if (newValue) {
                      handleAddExcludedProduct(newValue);
                    }
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="Search by name or scan barcode to exclude..."
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <React.Fragment>
                            {productsLoading ? (
                              <CircularProgress color="inherit" size={20} />
                            ) : null}
                            {params.InputProps.endAdornment}
                          </React.Fragment>
                        ),
                      }}
                    />
                  )}
                />
              </Box>

              <Typography
                variant="caption"
                color="text.secondary"
                fontWeight="bold"
                sx={{ display: 'block', mb: 1, textTransform: 'uppercase' }}
              >
                Currently Excluded ({excludedProducts.length})
              </Typography>

              {excludedProducts.length > 0 ? (
                <Box
                  sx={{
                    maxHeight: 300,
                    minWidth: 350,
                    overflow: 'auto',
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  {excludedProducts.map((exp) => (
                    <Box
                      key={exp.id}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        px: 2,
                        py: 1,
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        '&:last-child': { borderBottom: 'none' },
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{
                          flex: 1,
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {exp.product_name}
                      </Typography>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() =>
                          handleRemoveExcludedProduct(exp.product_id)
                        }
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              ) : (
                <Box
                  p={3}
                  textAlign="center"
                  sx={{
                    bgcolor: 'action.hover',
                    borderRadius: 1,
                    border: '1px dashed',
                    borderColor: 'divider',
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    No products are currently excluded from this campaign.
                  </Typography>
                </Box>
              )}
            </Paper>
          </Grid>
        )}
      </Grid>

      {/* Snackbar for Toasts */}
      <Snackbar
        open={toast.open}
        autoHideDuration={6000}
        onClose={handleCloseToast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleCloseToast}
          severity={toast.severity}
          sx={{ width: '100%' }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default LuckyDrawAdmin;
