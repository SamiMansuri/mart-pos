import { useNavigate, useLocation } from 'react-router-dom';
import React, { useState, useEffect } from 'react';

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
  Button,
  CircularProgress,
  Pagination,
  Alert,
  IconButton,
  InputAdornment,
  TextField,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Search as SearchIcon,
  Print as PrintIcon,
  Block as BlockIcon,
} from '@mui/icons-material';
import { Snackbar } from '@mui/material';
import { productsApi } from '../api/api';
import { isAdmin as checkAdmin } from '../utils/auth.utils';
import PrintBarcodeModal from '../components/PrintBarcodeModal';
import UpdateProductModal from '../components/UpdateProductModal';
import { printBarcodeLabel } from '../services/print.service';

const ProductsList = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isAdminUser = checkAdmin();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize page from location state if returning from edit
  const [page, setPage] = useState(location.state?.page || 1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const limit = 100;

  // Print Barcode State
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [selectedProductForPrint, setSelectedProductForPrint] = useState(null);

  // Update Product State
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [selectedProductIdToUpdate, setSelectedProductIdToUpdate] = useState(null);

  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Handle search debouncing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1); // Reset to first page on search
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    fetchProducts();
  }, [page, debouncedSearch]);

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await productsApi.getAll(page, limit, debouncedSearch);
      setProducts(response.products || []);
      setTotalPages(response.meta?.totalPages || 1);
    } catch (err) {
      console.error('Failed to fetch products:', err);
      setError(err.message || 'Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (event, value) => {
    setPage(value);
  };

  const formatCurrency = (amount) => {
    return `₹${parseFloat(amount).toFixed(2)}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleOpenPrintModal = (product) => {
    setSelectedProductForPrint(product);
    setPrintModalOpen(true);
  };

  const handleOpenUpdateModal = (productId) => {
    setSelectedProductIdToUpdate(productId);
    setUpdateModalOpen(true);
  };

  const handleCloseUpdateModal = () => {
    setUpdateModalOpen(false);
    setSelectedProductIdToUpdate(null);
  };

  const handleProductUpdated = () => {
    fetchProducts();
    setSnackbar({ open: true, message: 'Product updated successfully!', severity: 'success' });
  };

  const handleDisableProduct = async (product) => {
    if (window.confirm(`Are you sure you want to disable ${product.name}?`)) {
      try {
        await productsApi.disable(product.id);
        setSnackbar({ open: true, message: 'Product disabled successfully!', severity: 'success' });
        fetchProducts();
      } catch (err) {
        setSnackbar({ open: true, message: err.message || 'Error disabling product', severity: 'error' });
      }
    }
  };

  const handlePrintBarcode = async (product, quantity) => {
    try {
      await printBarcodeLabel(product, quantity);
      setSnackbar({ open: true, message: 'Barcode label printed successfully!', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: err.message || 'Error printing barcode label', severity: 'error' });
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  return (
    <Box>
      <Box
        sx={{
          mb: 4,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Box>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            Products
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your store's product inventory
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'flex',
            gap: 2,
            alignItems: 'center',
            flexWrap: 'wrap',
            width: { xs: '100%', md: 'auto' },
          }}
        >
          <TextField
            size="small"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{
              flexGrow: { xs: 1, md: 0 },
              maxWidth: { xs: '100%', md: 350 },
              bgcolor: 'background.paper',
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            }}
          />
          <Button
            variant="outlined"
            color="secondary"
            onClick={() => navigate('/admin/stock')}
            sx={{ whiteSpace: 'nowrap', width: { xs: '100%', md: 'auto' } }}
          >
            Stock Entry
          </Button>
          <Button
            variant="contained"
            startIcon={
              <AddIcon sx={{ display: { xs: 'none', sm: 'inline-flex' } }} />
            }
            onClick={() => navigate('/admin/products/add')}
            sx={{ whiteSpace: 'nowrap', width: { xs: '100%', md: 'auto' } }}
          >
            <Box
              component="span"
              sx={{ display: { xs: 'none', sm: 'inline' } }}
            >
              Add Product
            </Box>
            <Box
              component="span"
              sx={{ display: { xs: 'inline', sm: 'none' } }}
            >
              Add
            </Box>
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading && products.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : products.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary">
            No products found
          </Typography>
          <Button
            variant="outlined"
            sx={{ mt: 2 }}
            onClick={() => navigate('/admin/products/add')}
          >
            Add your first product
          </Button>
        </Paper>
      ) : (
        <>
          <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
            <Table sx={{ minWidth: 800 }}>
              <TableHead>
                <TableRow>
                  <TableCell>
                    <Typography variant="subtitle2" fontWeight={700}>
                      Product Name
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="subtitle2" fontWeight={700}>
                      Barcode
                    </Typography>
                  </TableCell>
                  {isAdminUser && (
                    <TableCell align="right">
                      <Typography variant="subtitle2" fontWeight={700}>
                        Cost Price
                      </Typography>
                    </TableCell>
                  )}
                  <TableCell align="right">
                    <Typography variant="subtitle2" fontWeight={700}>
                      M.R.P
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="subtitle2" fontWeight={700}>
                      Selling Price
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="subtitle2" fontWeight={700}>
                      Stock
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="subtitle2" fontWeight={700}>
                      Created Date
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="subtitle2" fontWeight={700}>
                      Actions
                    </Typography>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {product.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {product.barcode || '-'}
                      </Typography>
                    </TableCell>
                    {isAdminUser && (
                      <TableCell align="right">
                        <Typography variant="body2">
                          {+product.cost_price
                            ? formatCurrency(+product.cost_price)
                            : '-'}
                        </Typography>
                      </TableCell>
                    )}
                    <TableCell align="right">
                      <Typography variant="body2">
                        {+product.mrp ? formatCurrency(+product.mrp) : '-'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        fontWeight={700}
                        color="primary"
                      >
                        {formatCurrency(+product.selling_price)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        fontWeight={600}
                        color={
                          product.stock_qty < 10 ? 'error.main' : 'text.primary'
                        }
                      >
                        {product.stock_qty || 0}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" color="text.secondary">
                        {formatDate(product.created_at)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        color="secondary"
                        onClick={() => handleOpenPrintModal(product)}
                        sx={{ mr: 1 }}
                        title="Print Barcode Labels"
                      >
                        <PrintIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleOpenUpdateModal(product.id)}
                        sx={{ mr: 1 }}
                        title="Edit Product"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      {isAdminUser && (
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDisableProduct(product)}
                          title="Disable Product"
                        >
                          <BlockIcon fontSize="small" />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={handlePageChange}
                color="primary"
                disabled={loading}
              />
            </Box>
          )}
        </>
      )}

      {/* Print Barcode Modal */}
      <PrintBarcodeModal
        open={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        product={selectedProductForPrint}
        onPrint={handlePrintBarcode}
      />

      {/* Update Product Modal */}
      <UpdateProductModal
        open={updateModalOpen}
        onClose={handleCloseUpdateModal}
        productId={selectedProductIdToUpdate}
        onProductUpdated={handleProductUpdated}
      />

      {/* Feedback Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          sx={{ width: '100%', fontWeight: 700, borderRadius: 2 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ProductsList;
