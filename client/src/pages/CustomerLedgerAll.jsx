import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  CircularProgress,
  Alert,
  Pagination,
  Button,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { customersApi } from '../api/api';

const CustomerLedgerAll = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [customer, setCustomer] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 100;

  useEffect(() => {
    fetchLedger();
  }, [id, page]);

  const fetchLedger = async () => {
    setLoading(true);
    try {
      const response = await customersApi.getLedger(id, page, limit);
      setCustomer(response.customer);
      setLedger(response.ledger || []);
      setTotalPages(response.pagination.pages);
    } catch (err) {
      setError(err.message || 'Failed to fetch ledger');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (event, value) => {
    setPage(value);
    window.scrollTo(0, 0);
  };

  if (loading && !customer) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2 }}>
        <IconButton onClick={() => navigate(`/customers/${id}`)}>
          <ArrowBackIcon />
        </IconButton>
        <Box>
          <Typography variant="h4" fontWeight={800}>
            Full Ledger History
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            {customer?.name}
          </Typography>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <TableContainer component={Paper} sx={{ borderRadius: 3, mb: 3 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Note / Ref</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Amount</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Balance After</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {ledger.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                  No entries found.
                </TableCell>
              </TableRow>
            ) : (
              ledger.map((entry) => (
                <TableRow key={entry.id} hover>
                  <TableCell>
                    {new Intl.DateTimeFormat('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                      timeZone: 'Asia/Kolkata',
                    }).format(new Date(entry.created_at))}
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={entry.type} 
                      color={entry.type === 'CREDIT' ? 'error' : 'success'} 
                      size="small" 
                      sx={{ fontWeight: 700 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{entry.note || '-'}</Typography>
                    {entry.reference_id && (
                      <Typography variant="caption" color="text.secondary">
                        Ref: {entry.reference_id}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600, color: entry.type === 'CREDIT' ? 'error.main' : 'success.main' }}>
                    {entry.type === 'CREDIT' ? '+' : '-'}₹{parseFloat(entry.amount).toFixed(2)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800 }}>
                    ₹{parseFloat(entry.balance_after).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 4 }}>
          <Pagination 
            count={totalPages} 
            page={page} 
            onChange={handlePageChange} 
            color="primary" 
            size="large"
          />
        </Box>
      )}
    </Box>
  );
};

export default CustomerLedgerAll;
