import React, { useState, useEffect } from 'react';
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
  Autocomplete,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { productsApi, stockApi } from '../api/api';

const StockEntry = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const [formData, setFormData] = useState({
    batch_no: '',
    expiry_date: '',
    cost_price: '',
    quantity: '',
    mrp: '',
  });

  const [searchTerm, setSearchTerm] = useState('');

  // Search products for the autocomplete
  useEffect(() => {
    if (searchTerm.length < 2) {
      setProducts([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await productsApi.getAll(1, 20, searchTerm);
        setProducts(response.products || []);
      } catch (err) {
        console.error('Failed to search products:', err);
      } finally {
        setSearching(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedProduct) {
      setStatus({ type: 'error', message: 'Please select a product' });
      return;
    }

    if (!formData.batch_no || !formData.quantity) {
      setStatus({
        type: 'error',
        message: 'Batch number and quantity are required',
      });
      return;
    }

    setLoading(true);
    setStatus({ type: '', message: '' });

    try {
      await stockApi.addStock({
        product_id: selectedProduct.id,
        ...formData,
        cost_price: parseFloat(formData.cost_price) || 0,
        mrp: parseFloat(formData.mrp) || 0,
        quantity: selectedProduct.sale_type === 'WEIGHT' ? parseFloat(formData.quantity) : parseInt(formData.quantity, 10),
      });

      setStatus({
        type: 'success',
        message: `Stock added successfully for ${selectedProduct.name}!`,
      });

      // Clear form
      setFormData({
        batch_no: '',
        expiry_date: '',
        cost_price: '',
        mrp: '',
        quantity: '',
      });
      setSelectedProduct(null);
      setSearchTerm('');
    } catch (err) {
      console.error('Failed to add stock:', err);
      setStatus({
        type: 'error',
        message: err.message || 'Failed to add stock. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto' }}>
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
        <IconButton onClick={() => navigate(-1)} color="primary">
          <ArrowBackIcon />
        </IconButton>
        <Box>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            Stock Entry
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Add or update stock batches for existing products
          </Typography>
        </Box>
      </Box>

      <Paper sx={{ p: 4 }}>
        {status.message && (
          <Alert
            severity={status.type}
            sx={{ mb: 4 }}
            onClose={() => setStatus({ type: '', message: '' })}
          >
            {status.message}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Autocomplete
                fullWidth
                options={products}
                getOptionLabel={(option) =>
                  `${option.name} (${option.barcode || 'No Barcode'})`
                }
                selected={selectedProduct}
                onChange={(event, newValue) => setSelectedProduct(newValue)}
                onInputChange={(event, newInputValue) =>
                  setSearchTerm(newInputValue)
                }
                loading={searching}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Search Product"
                    required
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.preventDefault();
                    }}
                    placeholder="Enter product name or barcode"
                    sx={{
                      minWidth: '260px',
                      '& .MuiInputBase-root': {
                        fontSize: '1.1rem',
                        py: 0.5,
                      },
                      '& .MuiInputLabel-root': {
                        fontSize: '1.1rem',
                      },
                    }}
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <>
                          {searching ? (
                            <CircularProgress color="inherit" size={20} />
                          ) : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />
            </Grid>

            {selectedProduct && (
              <Grid item xs={12}>
                <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                  <Typography
                    variant="subtitle2"
                    color="primary"
                    sx={{ display: 'flex', justifyContent: 'space-between' }}
                  >
                    {/* <span>Selected: {selectedProduct.name}</span> */}
                    <Box>
                      <Typography component="span" sx={{ mr: 2 }}>
                        Current Stock: {selectedProduct.stock_qty || 0}
                      </Typography>
                      {selectedProduct.latest_batch && (
                        <Typography
                          component="span"
                          color="secondary"
                          fontWeight={600}
                        >
                          Latest Batch: {selectedProduct.latest_batch}
                        </Typography>
                      )}
                    </Box>
                  </Typography>
                </Box>
              </Grid>
            )}

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Batch Number"
                name="batch_no"
                value={formData.batch_no}
                onChange={handleChange}
                required
                placeholder="e.g. B001, JAN24"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Quantity to Add"
                name="quantity"
                type="number"
                value={formData.quantity}
                onChange={handleChange}
                required
                inputProps={{
                  min: selectedProduct?.sale_type === 'WEIGHT' ? '0.001' : '1',
                  step: selectedProduct?.sale_type === 'WEIGHT' ? '0.001' : '1'
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
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
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="MRP"
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
            <Grid item xs={12} sm={6}>
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
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button
                  variant="outlined"
                  onClick={() => navigate(-1)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={loading || !selectedProduct}
                >
                  {loading ? (
                    <CircularProgress size={24} color="inherit" />
                  ) : (
                    'Add Stock'
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

export default StockEntry;
