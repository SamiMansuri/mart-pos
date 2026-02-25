import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Grid,
    Paper,
    Card,
    CardContent,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    LinearProgress,
    Chip,
    Divider,
    Alert,
    TextField,
    IconButton,
} from '@mui/material';
import { reportsApi } from '../api/api';
import { useNavigate } from 'react-router-dom';

const CashierReport = () => {
    const navigate = useNavigate();
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [data, setData] = useState({
        summary: {
            grossSales: 0,
            totalReturns: 0,
            netSales: 0,
            roundAdjustment: 0,
            finalCollected: 0,
        },
        paymentBreakdown: {
            CASH: 0,
            UPI: 0,
        },
        bills: [],
    });

    const fetchReport = async (reportDate) => {
        setLoading(true);
        setError(null);
        try {
            const res = await reportsApi.getCashierReport(reportDate);
            setData(res);
        } catch (err) {
            console.error('Failed to fetch cashier report:', err);
            setError('Failed to load cashier report data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport(date);
    }, [date]);

    const formatCurrency = (val) =>
        `₹${parseFloat(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

    const summaryStats = [
        {
            title: 'Gross Sales',
            value: formatCurrency(data.summary.grossSales),
            color: 'primary.main',
        },
        {
            title: 'Returns',
            value: formatCurrency(data.summary.totalReturns),
            color: 'error.main',
        },
        {
            title: 'Net Sales',
            value: formatCurrency(data.summary.netSales),
            color: 'success.main',
        },
        {
            title: 'Round Adjust',
            value: formatCurrency(data.summary.roundAdjustment),
            color: 'warning.main',
        },
        {
            title: 'Final Collected',
            value: formatCurrency(data.summary.finalCollected),
            color: 'info.main',
        },
    ];

    const paymentStats = [
        {
            title: 'Cash Collection',
            value: formatCurrency(data.paymentBreakdown.CASH),
            color: 'success.main',
        },
        {
            title: 'UPI Collection',
            value: formatCurrency(data.paymentBreakdown.UPI),
            color: 'primary.main',
        },
    ];

    return (
        <Box>
            <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                <Box>
                    <Typography variant="h4" fontWeight={800} gutterBottom>
                        Cashier Report
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Daily sales and payment summary for the counter
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <TextField
                        type="date"
                        size="small"
                        label="Report Date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        sx={{ width: 200 }}
                    />
                </Box>
            </Box>

            {loading && <LinearProgress sx={{ mb: 4, borderRadius: 1 }} />}
            {error && (
                <Alert severity="error" sx={{ mb: 4 }}>
                    {error}
                </Alert>
            )}

            <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
                Sales Summary
            </Typography>
            <Grid container spacing={2} sx={{ mb: 4 }}>
                {summaryStats.map((stat, idx) => (
                    <Grid item xs={12} sm={6} md={2.4} key={idx}>
                        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
                            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', mb: 1, display: 'block' }}>
                                    {stat.title}
                                </Typography>
                                <Typography variant="h6" fontWeight={800}>
                                    {stat.value}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
                Payment Breakdown
            </Typography>
            <Grid container spacing={2} sx={{ mb: 4 }}>
                {paymentStats.map((stat, idx) => (
                    <Grid item xs={12} sm={6} key={idx}>
                        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
                            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', mb: 1, display: 'block' }}>
                                    {stat.title}
                                </Typography>
                                <Typography variant="h5" fontWeight={800}>
                                    {stat.value}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="h6" fontWeight={700}>
                        Bills Listing
                    </Typography>
                </Box>
                <TableContainer>
                    <Table>
                        <TableHead sx={{ bgcolor: 'action.hover' }}>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 700 }}>BILL #</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>INV #</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>TIME</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>CASHIER</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700 }}>AMOUNT</TableCell>
                                <TableCell align="center" sx={{ fontWeight: 700 }}>PAYMENT</TableCell>
                                <TableCell align="center" sx={{ fontWeight: 700 }}>STATUS</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {data.bills.length > 0 ? (
                                data.bills.map((bill) => (
                                    <TableRow
                                        key={bill.id}
                                        hover
                                        onClick={() => navigate(`/bill-view/${bill.id}`)}
                                        sx={{ cursor: 'pointer' }}
                                    >
                                        <TableCell sx={{ fontWeight: 600 }}>{bill.bill_number}</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>#{bill.invoice_number}</TableCell>
                                        <TableCell>
                                            {new Date(bill.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </TableCell>
                                        <TableCell>{bill.cashier_name}</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>{formatCurrency(bill.total_amount)}</TableCell>
                                        <TableCell align="center">
                                            <Chip
                                                label={bill.payment_method}
                                                size="small"
                                                color={bill.payment_method === 'CASH' ? 'success' : 'primary'}
                                                variant="outlined"
                                                sx={{ fontWeight: 700 }}
                                            />
                                        </TableCell>
                                        <TableCell align="center">
                                            {bill.is_void ? (
                                                <Chip label="Void" size="small" color="error" sx={{ fontWeight: 700 }} />
                                            ) : Number(bill.returned_amount) > 0 ? (
                                                <Chip label="Returned" size="small" color="warning" sx={{ fontWeight: 700 }} />
                                            ) : (
                                                <Chip label="Active" size="small" color="success" variant="outlined" sx={{ fontWeight: 700 }} />
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                                        <Typography color="text.secondary">No bills found for this date</Typography>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        </Box>
    );
};

export default CashierReport;
