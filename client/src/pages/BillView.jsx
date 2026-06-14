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
            gst_rate: parseFloat(item.gst_rate) || 0,
            taxable_amount: parseFloat(item.taxable_amount).toFixed(2),
            cgst_amount: parseFloat(item.cgst_amount).toFixed(2),
            sgst_amount: parseFloat(item.sgst_amount).toFixed(2),
            line_total: parseFloat(item.line_total).toFixed(2),
          })),
          total: parseFloat(bill.total_amount).toFixed(2),
        },
      };

      await fetch('http://localhost:5000/print', {
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
          <Typography variant="body2" sx={{ fontSize: '11px' }}>
            01 Plalinum Complex, Motipura Road, Himatnagar, Gujarat - 383001
          </Typography>
          <Typography
            variant="body2"
            sx={{ fontSize: '11px', fontWeight: 'bold' }}
          >
            GSTIN: 3561514833369510
          </Typography>
          <Typography
            variant="body2"
            sx={{ fontSize: '11px', fontWeight: 'bold' }}
          >
            TAX INVOICE
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
            <Typography variant="body2" sx={{ fontSize: '12px' }}>
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

        <Divider sx={{ borderStyle: 'solid', borderColor: 'black', my: 1 }} />

        {/* Totals */}
        <Box sx={{ mb: 1, mt: 1 }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Typography
              variant="body2"
              sx={{ fontSize: '12px', fontWeight: 'bold' }}
            >
              Items: {bill.items?.length || 0}
            </Typography>
            <Typography
              variant="body2"
              sx={{ fontSize: '12px', fontWeight: 'bold' }}
            >
              Qty:{' '}
              {bill.items?.reduce(
                (sum, item) => sum + Number(item.quantity),
                0,
              )}
            </Typography>
            <Typography
              variant="body2"
              sx={{ fontSize: '12px', fontWeight: 'bold' }}
            >
              {parseFloat(bill.total_amount).toFixed(2)}
            </Typography>
          </Box>
        </Box>

        {/* <Divider sx={{ borderStyle: 'dashed', borderColor: 'black', my: 1 }} /> */}
        {/* GST Breakup */}
        {(() => {
          // Group items by gst_rate
          const gstGroups = {};
          bill.items.forEach((item) => {
            const rate = parseFloat(item.gst_rate) || 0;
            if (!gstGroups[rate]) {
              gstGroups[rate] = { taxable: 0, cgst: 0, sgst: 0, total: 0 };
            }
            gstGroups[rate].taxable += parseFloat(item.taxable_amount) || 0;
            gstGroups[rate].cgst += parseFloat(item.cgst_amount) || 0;
            gstGroups[rate].sgst += parseFloat(item.sgst_amount) || 0;
            gstGroups[rate].total += parseFloat(item.line_total) || 0;
          });

          const hasGST = Object.keys(gstGroups).some((r) => parseFloat(r) > 0);
          if (!hasGST) return null;

          const totalTaxable = Object.values(gstGroups).reduce(
            (s, g) => s + g.taxable,
            0,
          );
          const totalCGST = Object.values(gstGroups).reduce(
            (s, g) => s + g.cgst,
            0,
          );
          const totalSGST = Object.values(gstGroups).reduce(
            (s, g) => s + g.sgst,
            0,
          );

          return (
            <>
              <Divider
                sx={{ borderStyle: 'dashed', borderColor: 'black', my: 1 }}
              />
              <Typography
                variant="body2"
                sx={{ fontSize: '11px', fontWeight: 'bold', mb: 0.5 }}
              >
                GST Breakup
              </Typography>
              <TableContainer>
                <Table size="small" padding="none">
                  <TableHead>
                    <TableRow>
                      <TableCell
                        sx={{
                          border: 'none',
                          fontSize: '10px',
                          fontWeight: 'bold',
                          py: 0.3,
                        }}
                      >
                        GST%
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          border: 'none',
                          fontSize: '10px',
                          fontWeight: 'bold',
                          py: 0.3,
                        }}
                      >
                        Taxable
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          border: 'none',
                          fontSize: '10px',
                          fontWeight: 'bold',
                          py: 0.3,
                        }}
                      >
                        CGST
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          border: 'none',
                          fontSize: '10px',
                          fontWeight: 'bold',
                          py: 0.3,
                        }}
                      >
                        SGST
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          border: 'none',
                          fontSize: '10px',
                          fontWeight: 'bold',
                          py: 0.3,
                        }}
                      >
                        Total
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.entries(gstGroups)
                      .sort(([a], [b]) => parseFloat(a) - parseFloat(b))
                      .map(([rate, values]) => (
                        <TableRow key={rate}>
                          <TableCell
                            sx={{ border: 'none', fontSize: '10px', py: 0.3 }}
                          >
                            {rate}%
                          </TableCell>
                          <TableCell
                            align="right"
                            sx={{ border: 'none', fontSize: '10px', py: 0.3 }}
                          >
                            {values.taxable.toFixed(2)}
                          </TableCell>
                          <TableCell
                            align="right"
                            sx={{ border: 'none', fontSize: '10px', py: 0.3 }}
                          >
                            {values.cgst.toFixed(2)}
                          </TableCell>
                          <TableCell
                            align="right"
                            sx={{ border: 'none', fontSize: '10px', py: 0.3 }}
                          >
                            {values.sgst.toFixed(2)}
                          </TableCell>
                          <TableCell
                            align="right"
                            sx={{ border: 'none', fontSize: '10px', py: 0.3 }}
                          >
                            {values.total.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    {/* Total Row */}
                    <TableRow>
                      <TableCell
                        sx={{
                          borderTop: '1px dashed black',
                          fontSize: '10px',
                          fontWeight: 'bold',
                          py: 0.3,
                        }}
                      >
                        Total
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          borderTop: '1px dashed black',
                          fontSize: '10px',
                          fontWeight: 'bold',
                          py: 0.3,
                        }}
                      >
                        {totalTaxable.toFixed(2)}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          borderTop: '1px dashed black',
                          fontSize: '10px',
                          fontWeight: 'bold',
                          py: 0.3,
                        }}
                      >
                        {totalCGST.toFixed(2)}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          borderTop: '1px dashed black',
                          fontSize: '10px',
                          fontWeight: 'bold',
                          py: 0.3,
                        }}
                      >
                        {totalSGST.toFixed(2)}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          borderTop: '1px dashed black',
                          fontSize: '10px',
                          fontWeight: 'bold',
                          py: 0.3,
                        }}
                      >
                        {(totalTaxable + totalCGST + totalSGST).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          );
        })()}

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
