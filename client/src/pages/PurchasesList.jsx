import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { purchasesApi } from '../api/api';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  IconButton,
  Button,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';

const PurchasesList = () => {
  const navigate = useNavigate();
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPurchases();
  }, []);

  const fetchPurchases = async () => {
    try {
      setLoading(true);
      const response = await purchasesApi.getAll();
      
      if (Array.isArray(response)) {
        setPurchases(response);
      } else {
        setPurchases(response.purchases || []);
      }
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load purchases');
    } finally {
      setLoading(false);
    }
  };

  const handleView = (purchase) => {
    navigate(`/admin/purchases/${purchase.id}`);
  };

  if (error) {
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={fetchPurchases}>
            Retry
          </Button>
        }
      >
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Purchase History
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {purchases.length} total purchase records
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton onClick={fetchPurchases} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      <TableContainer
        component={Paper}
        sx={{ position: 'relative', overflowX: 'auto' }}
      >
        {loading && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'rgba(255, 255, 255, 0.7)',
              zIndex: 1,
            }}
          >
            <CircularProgress />
          </Box>
        )}
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Ref ID</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Supplier</TableCell>
              <TableCell>Invoice No</TableCell>
              <TableCell align="right">Taxable</TableCell>
              <TableCell align="right">GST</TableCell>
              <TableCell align="right">Total Amount</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {purchases.length === 0 && !loading ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                  <Typography variant="body2" color="text.secondary">
                    No purchases found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              purchases.map((purchase) => (
                <TableRow key={purchase.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>
                      PUR-{purchase.id}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {new Date(purchase.created_at || purchase.invoice_date).toLocaleDateString()}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(purchase.created_at || purchase.invoice_date).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {purchase.supplier_name || 'Unknown Supplier'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {purchase.invoice_no || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">
                      ₹{parseFloat(purchase.total_taxable || 0).toFixed(2)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">
                      ₹{(parseFloat(purchase.total_cgst || 0) + parseFloat(purchase.total_sgst || 0)).toFixed(2)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={600} color="primary.main">
                      ₹{parseFloat(purchase.total_amount || 0).toFixed(2)}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => handleView(purchase)}
                      title="View Details"
                    >
                      <VisibilityIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default PurchasesList;
