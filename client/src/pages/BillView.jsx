import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { billsApi } from '../api/api';
import {
  Box,
  Typography,
  Divider,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Paper,
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Barcode from 'react-barcode';

const BillView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBill = async () => {
      try {
        const data = await billsApi.getById(id);
        setBill(data);
      } catch (err) {
        setError(err.message || 'Failed to fetch bill details');
      } finally {
        setLoading(false);
      }
    };

    fetchBill();
  }, [id]);

  const handlePrint = async () => {
    if (!bill) return;

    try {
      const billData = {
        bill: {
          bill_number: bill.bill_number,
          invoice_number: bill.invoice_number,
          date: new Intl.DateTimeFormat('en-IN', {
            timeZone: 'Asia/Kolkata',
            dateStyle: 'medium',
            timeStyle: 'medium',
          }).format(new Date(bill.created_at)),
          payment_method: bill.payment_method || 'CASH',
          items: bill.items.map((item) => ({
            name: item.product_name,
            barcode: item.product_barcode || '',
            qty: item.quantity,
            price: parseFloat(item.price).toFixed(2),
            total: parseFloat(item.line_total).toFixed(2),
          })),
          total: parseFloat(bill.total_amount).toFixed(2),
        },
      };

      await fetch('http://localhost:3005/print', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(billData),
      });
      console.log('Print request sent successfully');
    } catch (err) {
      console.error('Failed to print bill:', err);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography color="error">{error}</Typography>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
          sx={{ mt: 2 }}
        >
          Go Back
        </Button>
      </Box>
    );
  }

  if (!bill) return null;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'grey.100',
        py: 4,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        '@media print': {
          bgcolor: 'white',
          py: 0,
          height: 'auto',
        },
      }}
    >
      {/* Action Buttons - Hidden on Print */}
      <Box
        sx={{
          mb: 3,
          display: 'flex',
          gap: 2,
          '@media print': { display: 'none' },
        }}
      >
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
        >
          Back
        </Button>
        <Button
          variant="contained"
          startIcon={<PrintIcon />}
          onClick={handlePrint}
        >
          Reprint Receipt
        </Button>
      </Box>

      {/* Receipt Container */}
      <Paper
        elevation={0}
        sx={{
          width: '100mm', // Receipt width
          p: 4,
          bgcolor: 'white',
          fontFamily: '"Courier New", Courier, monospace',
          fontSize: '14px',
          color: 'black',
          '@media print': {
            boxShadow: 'none',
            width: '100%',
            maxWidth: '100mm',
            margin: '0 auto',
            p: 0,
          },
        }}
      >
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 2 }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 'bold',
              textTransform: 'uppercase',
              fontSize: '20px',
            }}
          >
            Family Mart
          </Typography>
        </Box>

        <Divider sx={{ borderStyle: 'dashed', borderColor: 'black', my: 1 }} />

        {/* Bill Info */}
        <Box sx={{ mb: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" sx={{ fontSize: '12px' }}>
              Invoice No:
            </Typography>
            <Typography
              variant="body2"
              sx={{ fontSize: '12px', fontWeight: 'bold' }}
            >
              #{bill.invoice_number}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" sx={{ fontSize: '12px' }}>
              Bill No:
            </Typography>
            <Typography
              variant="body2"
              sx={{ fontSize: '12px' }}
            >
              {bill.bill_number}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" sx={{ fontSize: '12px' }}>
              Date:
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '12px' }}>
              {new Intl.DateTimeFormat('en-IN', {
                timeZone: 'Asia/Kolkata',
                dateStyle: 'medium',
                timeStyle: 'medium',
              }).format(new Date(bill.created_at))}
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ borderStyle: 'dashed', borderColor: 'black', my: 1 }} />

        {/* Items Table */}
        <TableContainer sx={{ mb: 1 }}>
          <Table size="small" padding="none">
            <TableHead>
              <TableRow>
                <TableCell
                  sx={{
                    borderBottom: '1px dashed black',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    py: 0.5,
                  }}
                >
                  Item
                </TableCell>
                <TableCell
                  align="center"
                  sx={{
                    borderBottom: '1px dashed black',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    py: 0.5,
                  }}
                >
                  Qty
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    borderBottom: '1px dashed black',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    py: 0.5,
                  }}
                >
                  Rate
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    borderBottom: '1px dashed black',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    py: 0.5,
                  }}
                >
                  Amt
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {bill.items.map((item, index) => (
                <TableRow key={index}>
                  <TableCell
                    sx={{
                      border: 'none',
                      fontSize: '12px',
                      py: 0.5,
                      verticalAlign: 'top',
                    }}
                  >
                    {item.product_name}
                  </TableCell>
                  <TableCell
                    align="center"
                    sx={{
                      border: 'none',
                      fontSize: '10px',
                      py: 0.5,
                      verticalAlign: 'top',
                    }}
                  >
                    {item.quantity}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      border: 'none',
                      fontSize: '10px',
                      py: 0.5,
                      verticalAlign: 'top',
                    }}
                  >
                    {parseFloat(item.price).toFixed(2)}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      border: 'none',
                      fontSize: '10px',
                      py: 0.5,
                      verticalAlign: 'top',
                    }}
                  >
                    {parseFloat(item.line_total).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Divider sx={{ borderStyle: 'dashed', borderColor: 'black', my: 1 }} />

        {/* Totals */}
        <Box sx={{ mb: 1 }}>
          <Box
            sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}
          >
            <Typography variant="body2" sx={{ fontSize: '12px' }}>
              Subtotal:
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '12px' }}>
              {parseFloat(bill.total_amount).toFixed(2)}
            </Typography>
          </Box>
          <Divider
            sx={{ borderStyle: 'dashed', borderColor: 'black', my: 0.5 }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography
              variant="body2"
              sx={{ fontSize: '16px', fontWeight: 'bold' }}
            >
              Grand Total:
            </Typography>
            <Typography
              variant="body2"
              sx={{ fontSize: '16px', fontWeight: 'bold' }}
            >
              ₹{parseFloat(bill.total_amount).toFixed(2)}
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ borderStyle: 'dashed', borderColor: 'black', my: 1 }} />

        {/* Payment Details */}
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" sx={{ fontSize: '12px' }}>
              Payment Mode:
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '12px' }}>
              {bill.payment_method || 'CASH'}
            </Typography>
          </Box>
          {/* Add Transaction ID if available in bill object */}
        </Box>

        <Box
          sx={{
            mt: 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <Barcode
            value={bill.bill_number}
            width={1.2}
            height={35}
            fontSize={10}
            margin={0}
          />
        </Box>

        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Typography variant="body2" sx={{ fontSize: '12px' }}>
            *** Thank You! ***
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};

export default BillView;
