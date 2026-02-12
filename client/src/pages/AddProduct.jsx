import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { productsApi } from '../api/api';

const AddProduct = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [formData, setFormData] = useState({
    product_name: '',
    barcode: '',
    selling_price: '',
    batch_no: '',
    quantity: '',
    cost_price: '',
    expiry_date: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Basic validation
    if (!formData.product_name || !formData.selling_price) {
      setStatus({
        type: 'error',
        message: 'Please fill in all required fields',
      });
      return;
    }

    setLoading(true);
    setStatus({ type: '', message: '' });

    try {
      await productsApi.create({
        ...formData,
        selling_price: parseFloat(formData.selling_price),
        quantity: formData.quantity ? parseInt(formData.quantity, 10) : 0,
        cost_price: formData.cost_price ? parseFloat(formData.cost_price) : 0,
      });

      setStatus({
        type: 'success',
        message: 'Product added successfully!',
      });

      // Reset form data and focus back to product name
      setFormData({
        product_name: '',
        barcode: '',
        selling_price: '',
        batch_no: '',
        quantity: '',
        cost_price: '',
        expiry_date: '',
      });

      // Focus on product name field (optional but helpful)
      const productNameField = document.querySelector('[name="product_name"]');
      if (productNameField) productNameField.focus();
    } catch (err) {
      // Better error message extraction from API response
      const errorMessage =
        typeof err === 'string'
          ? err
          : err.error.message || 'Failed to add product. Please try again.';

      setStatus({
        type: 'error',
        message: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle global barcode scanning
  React.useEffect(() => {
    let buffer = '';
    let lastKeyTime = 0;

    const handleGlobalKeyDown = (e) => {
      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTime;
      lastKeyTime = currentTime;

      // If focus is already on barcode input, let it handle the input naturally
      if (document.activeElement?.name === 'barcode') return;

      if (e.key === 'Enter') {
        // If buffer looks like a barcode (length > 2 and fast input)
        // 100ms threshold effectively filters out manual typing of 'Enter' unless they are super fast
        if (buffer.length >= 3 && timeDiff <= 100) {
          e.preventDefault();
          setFormData((prev) => ({
            ...prev,
            barcode: buffer,
          }));
        }
        buffer = '';
        return;
      }

      // Reset buffer if typing is too slow (manual entry)
      if (timeDiff > 100) {
        buffer = '';
      }

      // Only add printable characters
      if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

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
        <IconButton onClick={() => navigate(-1)} color="primary">
          <ArrowBackIcon />
        </IconButton>
        <Box>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            Add New Product
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Fill in the details below to add a product to the inventory
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
            <Grid item xs={12} md={8}>
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
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Barcode (Optional)"
                name="barcode"
                value={formData.barcode}
                onChange={handleChange}
                placeholder="Scan or enter barcode"
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

            {/* Batch and Stock Info */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Batch Number (Optional)"
                name="batch_no"
                value={formData.batch_no}
                onChange={handleChange}
                placeholder='Defaults to "INITIAL"'
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Quantity (Optional)"
                name="quantity"
                type="number"
                value={formData.quantity}
                onChange={handleChange}
                placeholder="Initial stock"
                inputProps={{ min: '0' }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Cost Price (Optional)"
                name="cost_price"
                type="number"
                value={formData.cost_price}
                onChange={handleChange}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">₹</InputAdornment>
                  ),
                }}
                inputProps={{ step: '0.01', min: '0' }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Expiry Date (Optional)"
                name="expiry_date"
                type="date"
                value={formData.expiry_date}
                onChange={handleChange}
                InputLabelProps={{ shrink: true }}
              />
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
                  onClick={() => navigate(-1)}
                  disabled={loading}
                  sx={{ minWidth: { xs: '100%', sm: 120 } }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={loading}
                  sx={{ minWidth: { xs: '100%', sm: 150 } }}
                >
                  {loading ? (
                    <CircularProgress size={24} color="inherit" />
                  ) : (
                    'Add Product'
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

export default AddProduct;
