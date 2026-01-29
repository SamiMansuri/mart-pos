import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { billsApi } from '../api/api';
import {
    Box,
    Paper,
    Grid,
    TextField,
    Button,
    Typography,
    IconButton,
    Alert,
    CircularProgress,
    Divider,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
} from '@mui/material';
import {
    Add as AddIcon,
    Delete as DeleteIcon,
} from '@mui/icons-material';

const CreateBill = () => {
    const navigate = useNavigate();
    const [items, setItems] = useState([{ product_id: '', quantity: 1 }]);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState({ type: '', message: '' });

    const handleItemChange = (index, field, value) => {
        const newItems = [...items];
        newItems[index][field] = value;
        setItems(newItems);
    };

    const addItem = () => {
        setItems([...items, { product_id: '', quantity: 1 }]);
    };

    const removeItem = (index) => {
        if (items.length === 1) return;
        setItems(items.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setStatus({ type: '', message: '' });

        const invalid = items.some(item => !item.product_id || item.quantity <= 0);
        if (invalid) {
            setStatus({ type: 'error', message: 'All fields are required with valid values' });
            setLoading(false);
            return;
        }

        try {
            await billsApi.create({ items });
            setStatus({ type: 'success', message: 'Bill created successfully' });
            setTimeout(() => navigate('/bills'), 1500);
        } catch (err) {
            setStatus({ type: 'error', message: err.message || 'Failed to create bill' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box>
            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" fontWeight={700} gutterBottom>
                    Create New Bill
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Add items to create a new transaction
                </Typography>
            </Box>

            <Grid container spacing={3}>
                <Grid item xs={12} md={8}>
                    <Paper sx={{ p: 3 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                            <Typography variant="h6" fontWeight={600}>
                                Items
                            </Typography>
                            <Button
                                variant="outlined"
                                startIcon={<AddIcon />}
                                onClick={addItem}
                                disabled={loading}
                            >
                                Add Item
                            </Button>
                        </Box>

                        <TableContainer>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Product ID</TableCell>
                                        <TableCell width={150}>Quantity</TableCell>
                                        <TableCell width={80} align="right">Action</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {items.map((item, index) => (
                                        <TableRow key={index}>
                                            <TableCell>
                                                <TextField
                                                    fullWidth
                                                    type="number"
                                                    placeholder="Enter product ID"
                                                    value={item.product_id}
                                                    onChange={(e) => handleItemChange(index, 'product_id', e.target.value)}
                                                    required
                                                    disabled={loading}
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <TextField
                                                    fullWidth
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 0)}
                                                    required
                                                    disabled={loading}
                                                    inputProps={{ min: 1 }}
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell align="right">
                                                <IconButton
                                                    color="error"
                                                    onClick={() => removeItem(index)}
                                                    disabled={items.length === 1 || loading}
                                                    size="small"
                                                >
                                                    <DeleteIcon />
                                                </IconButton>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Paper>
                </Grid>

                <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 3, position: 'sticky', top: 80 }}>
                        <Typography variant="h6" fontWeight={600} gutterBottom>
                            Summary
                        </Typography>

                        <Divider sx={{ my: 2 }} />

                        {status.message && (
                            <Alert severity={status.type} sx={{ mb: 3 }}>
                                {status.message}
                            </Alert>
                        )}

                        <Box sx={{ mb: 3 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Typography variant="body2" color="text.secondary">
                                    Total Items
                                </Typography>
                                <Typography variant="body2" fontWeight={600}>
                                    {items.length}
                                </Typography>
                            </Box>
                        </Box>

                        <Divider sx={{ my: 2 }} />

                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                            <Button
                                fullWidth
                                variant="contained"
                                size="large"
                                onClick={handleSubmit}
                                disabled={loading}
                                sx={{ py: 1.5 }}
                            >
                                {loading ? <CircularProgress size={24} /> : 'Create Bill'}
                            </Button>
                            <Button
                                fullWidth
                                variant="outlined"
                                onClick={() => navigate('/bills')}
                                disabled={loading}
                            >
                                Cancel
                            </Button>
                        </Box>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
};

export default CreateBill;
