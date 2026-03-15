import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  CircularProgress,
  Box,
} from '@mui/material';
import { Print as PrintIcon } from '@mui/icons-material';

const PrintBarcodeModal = ({ open, onClose, product, onPrint }) => {
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setQuantity(1); // Reset to default when opened
      setLoading(false);
    }
  }, [open]);

  const handlePrint = async () => {
    if (!product || quantity < 1) return;
    
    setLoading(true);
    try {
      await onPrint(product, quantity);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  if (!product) return null;

  return (
    <Dialog open={open} onClose={!loading ? onClose : undefined} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Print Barcode Labels</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary">
            Product
          </Typography>
          <Typography variant="h6" fontWeight={700}>
            {product.name}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Barcode: {product.barcode || 'N/A'}
          </Typography>
        </Box>

        <TextField
          autoFocus
          fullWidth
          type="number"
          label="Number of Labels"
          value={quantity}
          onChange={(e) => setQuantity(parseInt(e.target.value) || '')}
          disabled={loading}
          inputProps={{ min: 1 }}
          helperText="1 = left side only, 2+ = print both sides/multiple sheets"
        />
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handlePrint}
          variant="contained"
          disabled={loading || !quantity || quantity < 1}
          startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <PrintIcon />}
        >
          {loading ? 'Printing...' : 'Print'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PrintBarcodeModal;
