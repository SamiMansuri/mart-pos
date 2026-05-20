import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  CircularProgress,
  Alert,
  Autocomplete,
  TextField,
  Divider,
} from '@mui/material';
import { PersonAdd as PersonAddIcon } from '@mui/icons-material';
import { luckyDrawApi, customersApi } from '../api/api';
import AddCustomerModal from './AddCustomerModal';

const LuckyDrawModal = ({ open, onClose, bill }) => {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [existingEntries, setExistingEntries] = useState([]);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState(null);
  
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerOptions, setCustomerOptions] = useState([]);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [customersLoading, setCustomersLoading] = useState(false);
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);

  useEffect(() => {
    if (open && bill) {
      checkExistingEntries();
      if (bill.customer_id) {
        fetchCustomerById(bill.customer_id);
      }
    } else {
      // Reset state when closing
      setExistingEntries([]);
      setError('');
      setSuccessData(null);
      setSelectedCustomer(null);
      setChecking(true);
    }
  }, [open, bill]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (customerSearchTerm) {
        fetchCustomers();
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [customerSearchTerm]);

  const checkExistingEntries = async () => {
    setChecking(true);
    try {
      const entries = await luckyDrawApi.getEntriesByBill(bill.bill_number);
      setExistingEntries(entries || []);
    } catch (err) {
      console.error('Failed to check entries', err);
    } finally {
      setChecking(false);
    }
  };

  const fetchCustomerById = async (id) => {
    try {
      const customer = await customersApi.getById(id);
      setSelectedCustomer(customer);
    } catch (err) {
      console.error('Failed to fetch customer', err);
    }
  };

  const fetchCustomers = async () => {
    setCustomersLoading(true);
    try {
      const data = await customersApi.getAll(customerSearchTerm);
      setCustomerOptions(data || []);
    } catch (err) {
      console.error('Failed to fetch customers', err);
    } finally {
      setCustomersLoading(false);
    }
  };

  const handleCreateEntry = async () => {
    if (!selectedCustomer) {
      setError('Please select or create a customer first.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await luckyDrawApi.createManualEntry({
        bill_id: bill.id,
        customer_id: selectedCustomer.id,
      });
      setSuccessData(response.lucky_draw);
      
      // WhatsApp logic (simplified)
      if (selectedCustomer.phone) {
         const { campaign_name, ticket_numbers, draw_date } = response.lucky_draw;
         const message = `Hello ${selectedCustomer.name},\n\nThank you for shopping at Family Super Mart!\n\nYou have successfully entered our Mega Lucky Draw 2026.\nYour Ticket Number(s): ${ticket_numbers.join(', ')}\nDraw Date: ${draw_date}\n\nBest of luck!`;

         let phone = selectedCustomer.phone.replace(/\D/g, '');
         if (phone.length === 10) phone = '91' + phone;
         
         window.open(`whatsapp://send?phone=${phone}&text=${encodeURIComponent(message)}`);
      }
    } catch (err) {
      setError(err.error?.message || 'Failed to create lucky draw entry');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>
          Lucky Draw Entry - {bill?.bill_number}
        </DialogTitle>
        <DialogContent dividers>
          {checking ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={24} sx={{ mr: 2 }} />
              <Typography>Checking existing entries...</Typography>
            </Box>
          ) : existingEntries.length > 0 ? (
            <Box>
              <Alert severity="info" sx={{ mb: 2 }}>
                This bill already has lucky draw entries.
              </Alert>
              <Typography variant="subtitle2" gutterBottom>
                Ticket Numbers:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {existingEntries.map((entry) => (
                  <Box
                    key={entry.id}
                    sx={{
                      bgcolor: 'primary.main',
                      color: 'white',
                      px: 2,
                      py: 0.5,
                      borderRadius: 1,
                      fontWeight: 700,
                    }}
                  >
                    {entry.ticket_number}
                  </Box>
                ))}
              </Box>
            </Box>
          ) : successData ? (
            <Box>
              <Alert severity="success" sx={{ mb: 2 }}>
                Lucky draw entries generated successfully!
              </Alert>
              <Typography variant="body1" gutterBottom>
                <strong>Campaign:</strong> {successData.campaign_name}
              </Typography>
              <Typography variant="body1" gutterBottom>
                <strong>Eligible Amount:</strong> ₹{successData.eligible_amount.toFixed(2)}
              </Typography>
              <Typography variant="body1" gutterBottom>
                <strong>Ticket Numbers:</strong>
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                {successData.ticket_numbers.map((ticket) => (
                  <Box
                    key={ticket}
                    sx={{
                      bgcolor: 'success.main',
                      color: 'white',
                      px: 2,
                      py: 0.5,
                      borderRadius: 1,
                      fontWeight: 700,
                    }}
                  >
                    {ticket}
                  </Box>
                ))}
              </Box>
            </Box>
          ) : (
            <Box sx={{ mt: 1 }}>
              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
              
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Bill Amount: <strong>₹{bill?.total_amount}</strong>
              </Typography>
              
              <Box sx={{ mt: 3, mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Select Customer:
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Autocomplete
                    fullWidth
                    size="small"
                    options={customerOptions}
                    getOptionLabel={(option) => `${option.name} (${option.phone})`}
                    loading={customersLoading}
                    value={selectedCustomer}
                    onChange={(e, newValue) => setSelectedCustomer(newValue)}
                    onInputChange={(e, newInputValue) => setCustomerSearchTerm(newInputValue)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Search Name or Phone"
                        placeholder="Type to search..."
                      />
                    )}
                  />
                  <Button
                    variant="outlined"
                    startIcon={<PersonAddIcon />}
                    onClick={() => setIsAddingCustomer(true)}
                  >
                    New
                  </Button>
                </Box>
              </Box>
              
              {selectedCustomer && (
                <Box sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                  <Typography variant="body2">
                    <strong>Selected:</strong> {selectedCustomer.name} ({selectedCustomer.phone})
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={onClose} color="inherit">
            {successData ? 'Close' : 'Cancel'}
          </Button>
          {!existingEntries.length && !successData && !checking && (
            <Button
              variant="contained"
              onClick={handleCreateEntry}
              disabled={loading || !selectedCustomer}
            >
              {loading ? <CircularProgress size={24} /> : 'Generate Entry'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <AddCustomerModal
        open={isAddingCustomer}
        onClose={() => setIsAddingCustomer(false)}
        onSuccess={(customer) => setSelectedCustomer(customer)}
      />
    </>
  );
};

export default LuckyDrawModal;
