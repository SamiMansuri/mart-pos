import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  Alert,
  CircularProgress,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
} from '@mui/material';
import { productsApi } from '../api/api';

const UpdateProductModal = ({ open, onClose, productId, onProductUpdated }) => {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [formData, setFormData] = useState({
    product_name: '',
    barcode: '',
    selling_price: '',
    mrp: '',
    sale_type: 'UNIT',
    gst_rate: '',
    hsn_code: '',
  });

  useEffect(() => {
    if (open && productId) {
      fetchProductDetails(productId);
    } else {
      // Reset form on close or if no ID
      setFormData({
        product_name: '',
        barcode: '',
        selling_price: '',
        mrp: '',
        sale_type: 'UNIT',
        gst_rate: '',
        hsn_code: '',
      });
      setStatus({ type: '', message: '' });
      setLoading(false);
      setSubmitting(false);
    }
  }, [open, productId]);

  const fetchProductDetails = async (id) => {
    setLoading(true);
    setStatus({ type: '', message: '' });
    try {
      const product = await productsApi.getById(id);
      setFormData({
        product_name: product.name || '',
        barcode: product.barcode || '',
        selling_price:
          product.selling_price !== undefined ? product.selling_price : '',
        mrp: product.mrp !== undefined ? product.mrp : '',
        sale_type: product.sale_type || 'UNIT',
        gst_rate:
          product.gst_rate !== null && product.gst_rate !== undefined
            ? String(parseFloat(product.gst_rate))
            : '',
        hsn_code: product.hsn_code ?? '',
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.gst_rate === '') {
      setStatus({
        type: 'error',
        message: 'Please select a GST rate',
      });
      return;
    }

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
      await productsApi.update(productId, {
        ...formData,
        selling_price: parseFloat(formData.selling_price),
        mrp: formData.mrp ? parseFloat(formData.mrp) : 0,
        gst_rate: parseFloat(formData.gst_rate) || 0,
        hsn_code: formData.hsn_code || '',
      });

      setStatus({
        type: 'success',
        message: 'Product updated successfully!',
      });

      // Call the success callback to refetch list
      if (onProductUpdated) {
        onProductUpdated();
      }
      setTimeout(() => {
        onClose();
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

  return (
    <Dialog
      open={open}
      onClose={!submitting ? onClose : undefined}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle sx={{ fontWeight: 800 }}>Update Product</DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box
            component="form"
            id="update-product-form"
            onSubmit={handleSubmit}
          >
            {status.message && (
              <Alert severity={status.type} sx={{ mb: 3 }}>
                {status.message}
              </Alert>
            )}

            <Grid container spacing={3} sx={{ mt: 0.5 }}>
              <Grid item xs={12} sm={6}>
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
              <Grid item xs={12} sm={6}>
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
              <Grid item xs={12} sm={4}>
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
              <Grid item xs={12} sm={4}>
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

              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="HSN Code (Optional)"
                  name="hsn_code"
                  value={formData.hsn_code ?? ''}
                  onChange={handleChange}
                  placeholder="e.g. 0902"
                  inputProps={{ maxLength: 8 }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth required>
                  <InputLabel shrink={true}>GST Rate</InputLabel>
                  <Select
                    name="gst_rate"
                    value={formData.gst_rate}
                    label="GST Rate"
                    onChange={handleChange}
                    displayEmpty
                    sx={{ minWidth: '100px' }}
                  >
                    <MenuItem value="">Select GST Rate</MenuItem>
                    <MenuItem value="0">0%</MenuItem>
                    <MenuItem value="5">5%</MenuItem>
                    <MenuItem value="12">12%</MenuItem>
                    <MenuItem value="18">18%</MenuItem>
                    <MenuItem value="40">40%</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
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
            </Grid>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button
          onClick={onClose}
          color="inherit"
          disabled={submitting || loading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          form="update-product-form"
          variant="contained"
          disabled={submitting || loading}
          startIcon={
            submitting && <CircularProgress size={20} color="inherit" />
          }
        >
          {submitting ? 'Updating...' : 'Update Product'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default UpdateProductModal;
