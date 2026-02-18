import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { productsApi } from '../api/api';

const UpdateProduct = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [formData, setFormData] = useState({
    product_name: '',
    barcode: '',
    selling_price: '',
    mrp: '',
    sale_type: 'UNIT',
  });

  // Capture the return page from location state
  const returnPage = location.state?.fromPage || 1;

  useEffect(() => {
    fetchProductDetails();
  }, [id]);

  const fetchProductDetails = async () => {
    try {
      const product = await productsApi.getById(id);
      setFormData({
        product_name: product.name || '',
        barcode: product.barcode || '',
        selling_price: product.selling_price || '',
        mrp: product.mrp || '',
        sale_type: product.sale_type || 'UNIT',
      });
    } catch (err) {
      console.error('Failed to fetch product details:', err);
      setStatus({
        type: 'error',
        message: err.message || 'Failed to load product details',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleBack = () => {
    navigate('/admin/products', { state: { page: returnPage } });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.product_name || !formData.selling_price) {
      setStatus({
        type: 'error',
        message: 'Please fill in all required fields',
      });
      return;
    }

    setSubmitting(true);
    setStatus({ type: '', message: '' });

    try {
      await productsApi.update(id, {
        ...formData,
        selling_price: parseFloat(formData.selling_price),
        mrp: formData.mrp ? parseFloat(formData.mrp) : 0,
      });

      setStatus({
        type: 'success',
        message: 'Product updated successfully! Redirecting...',
      });

      setTimeout(() => {
        handleBack();
      }, 1000);
    } catch (err) {
      console.error('Failed to update product:', err);
      setStatus({
        type: 'error',
        message: err.message || 'Failed to update product. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto' }}>
      <Box
        sx={{
          mb: 4,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <IconButton onClick={handleBack} color="primary">
          <ArrowBackIcon />
        </IconButton>
        <Box>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            Update Product
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Edit product details below
          </Typography>
        </Box>
      </Box>

      <Paper sx={{ p: 4 }}>
        {status.message && (
          <Alert severity={status.type} sx={{ mb: 4 }}>
            {status.message}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={12}>
              <TextField
                fullWidth
                label="Product Name"
                name="product_name"
                value={formData.product_name}
                onChange={handleChange}
                required
                placeholder="Enter product name"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Barcode (Optional)"
                name="barcode"
                value={formData.barcode}
                onChange={handleChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.preventDefault();
                }}
                placeholder="barcode"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Selling Price"
                name="selling_price"
                type="number"
                value={formData.selling_price}
                onChange={handleChange}
                required
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">₹</InputAdornment>
                  ),
                }}
                inputProps={{ step: '0.01', min: '0' }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="M.R.P (Optional)"
                name="mrp"
                type="number"
                value={formData.mrp}
                onChange={handleChange}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">₹</InputAdornment>
                  ),
                }}
                inputProps={{ step: '0.01', min: '0' }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Sale Type</InputLabel>
                <Select
                  name="sale_type"
                  value={formData.sale_type}
                  label="Sale Type"
                  onChange={handleChange}
                >
                  <MenuItem value="UNIT">UNIT (by piece)</MenuItem>
                  <MenuItem value="WEIGHT">WEIGHT (by quantity)</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sx={{ mt: 2 }}>
              <Box
                sx={{
                  display: 'flex',
                  gap: 2,
                  justifyContent: 'flex-end',
                  flexWrap: 'wrap',
                }}
              >
                <Button
                  variant="outlined"
                  onClick={handleBack}
                  disabled={submitting}
                  sx={{ minWidth: { xs: '100%', sm: 120 } }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={submitting}
                  sx={{ minWidth: { xs: '100%', sm: 150 } }}
                >
                  {submitting ? (
                    <CircularProgress size={24} color="inherit" />
                  ) : (
                    'Update Product'
                  )}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Paper>
    </Box>
  );
};

export default UpdateProduct;
