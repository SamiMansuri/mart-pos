import React, { useState } from 'react';
import {
  Box,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  CircularProgress,
  InputAdornment,
  Alert,
} from '@mui/material';
import { customersApi } from '../api/api';

const AddCustomerModal = ({ open, onClose, onSuccess }) => {
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    credit_limit: 0,
    notes: '',
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setSubmitLoading(true);
    setError('');
    try {
      const newCustomer = await customersApi.create({
        ...formData,
        credit_limit: parseFloat(formData.credit_limit) || 0,
      });
      onSuccess(newCustomer);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create customer');
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Add New Customer</DialogTitle>
      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Box
          component="form"
          id="create-customer-form"
          onSubmit={handleSubmit}
          sx={{ mt: 1 }}
        >
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                required
                fullWidth
                label="Customer Name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                autoFocus
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Phone Number"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label="Credit Limit (0 = no limit)"
                name="credit_limit"
                value={formData.credit_limit}
                onChange={handleInputChange}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">₹</InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Notes"
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
              />
            </Grid>
          </Grid>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={submitLoading}>
          Cancel
        </Button>
        <Button
          type="submit"
          form="create-customer-form"
          variant="contained"
          disabled={submitLoading || !formData.name.trim()}
        >
          {submitLoading ? <CircularProgress size={24} /> : 'Save Customer'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddCustomerModal;
