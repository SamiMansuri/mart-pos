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
import { billsApi, customersApi } from '../api/api';

const CustomerBillsAll = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [customer, setCustomer] = useState(null);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 100;

  useEffect(() => {
    fetchCustomer();
    fetchBills();
  }, [id, page]);

  const fetchCustomer = async () => {
    try {
      const data = await customersApi.getById(id);
      setCustomer(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchBills = async () => {
    setLoading(true);
    try {
      const response = await billsApi.getByCustomer(id, page, limit);
      setBills(response.bills || []);
      setTotalPages(response.pagination.totalPages);
    } catch (err) {
      setError(err.message || 'Failed to fetch bill history');
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
            All Bills History
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
              <TableCell sx={{ fontWeight: 700 }}>Bill Number</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Payment Method</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Paid Amount</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Total Amount</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {bills.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                  No bills found for this customer.
                </TableCell>
              </TableRow>
            ) : (
              bills.map((bill) => (
                <TableRow key={bill.id} hover onClick={() => navigate(`/bills/${bill.id}`)} sx={{ cursor: 'pointer' }}>
                  <TableCell sx={{ fontWeight: 600 }}>{bill.bill_number}</TableCell>
                  <TableCell>
                    {new Intl.DateTimeFormat('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                      timeZone: 'Asia/Kolkata',
                    }).format(new Date(bill.created_at))}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={bill.payment_method}
                      size="small"
                      sx={{ fontWeight: 700, fontSize: '0.7rem' }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    ₹{parseFloat(bill.paid_amount || 0).toFixed(2)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800 }}>
                    ₹{parseFloat(bill.total_amount).toFixed(2)}
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

export default CustomerBillsAll;
