import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { productsApi, billsApi } from '../api/api';
import {
  Box,
  Grid,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Paper,
  IconButton,
  Divider,
  Alert,
  CircularProgress,
  TextField,
  InputAdornment,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  ToggleButtonGroup,
  ToggleButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Autocomplete,
  Popper,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  ShoppingCart as CartIcon,
  Money as CashIcon,
  QrCode2 as UpiIcon,
} from '@mui/icons-material';

// ProductCard component removed as it's no longer used in the new layout

const CashierDashboard = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');

  // Barcode Scanning State
  // Migrated to global listener for better reliability

  // Audio effects
  const playBeep = useCallback(() => {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.1);
  }, []);

  const playErrorSound = useCallback(() => {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(200, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.3);
  }, []);

  const addToCart = useCallback((product) => {
    setCart((prevCart) => {
      const existingItemIndex = prevCart.findIndex(
        (item) => item.id === product.id,
      );
      if (existingItemIndex > -1) {
        const newCart = [...prevCart];
        newCart[existingItemIndex] = {
          ...newCart[existingItemIndex],
          quantity: newCart[existingItemIndex].quantity + 1,
        };
        return newCart;
      } else {
        return [...prevCart, { ...product, quantity: 1 }];
      }
    });
  }, []);

  const fetchProducts = useCallback(async (term) => {
    if (!term.trim()) {
      setProducts([]);
      return;
    }
    setLoading(true);
    try {
      const response = await productsApi.getAll(1, 100, term);
      setProducts(response.products || []);
    } catch (err) {
      console.error('Failed to fetch products', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleBarcodeSubmit = useCallback(
    async (barcode) => {
      if (!barcode.trim()) return;
      try {
        const product = await productsApi.getByBarcode(barcode.trim());
        if (product) {
          playBeep();
          addToCart(product);
        }
      } catch (err) {
        playErrorSound();
        setStatus({ type: 'error', message: 'Product not found' });
        setTimeout(() => setStatus({ type: '', message: '' }), 3000);
      } finally {
        setBarcodeValue('');
        setSearchTerm(''); // Clear search term to remove any leaked characters
      }
    },
    [playBeep, playErrorSound, addToCart],
  );

  // Handle global barcode scanning
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = 0;

    const handleGlobalKeyDown = (e) => {
      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTime;
      lastKeyTime = currentTime;

      // If focus is on a text field, block input if it's fast enough to be a scanner
      const isInput =
        document.activeElement &&
        (document.activeElement.tagName === 'INPUT' ||
          document.activeElement.tagName === 'TEXTAREA');

      if (e.key === 'Enter') {
        // Barcode scanners usually trigger Enter. If buffer has content and was fast...
        if (buffer.length >= 3 && timeDiff <= 100) {
          e.preventDefault();
          if (isInput) document.activeElement.blur(); // Remove focus on scan
          handleBarcodeSubmit(buffer);
        }
        buffer = '';
        return;
      }

      // Reset buffer if typing is too slow (manual entry)
      if (timeDiff > 100) {
        buffer = '';
      }

      // Only add printable characters to buffer
      if (e.key.length === 1) {
        // If it's very fast, prevent default to avoid writing to focused input
        if (isInput && timeDiff <= 50) {
          e.preventDefault();
        }
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleBarcodeSubmit]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl + Backspace to clear cart
      if (e.ctrlKey && e.key === 'Backspace') {
        e.preventDefault();
        if (cart.length > 0) {
          setCart([]);
          setStatus({ type: 'info', message: 'Cart cleared' });
          setTimeout(() => setStatus({ type: '', message: '' }), 2000);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart]);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setProducts([]);
      return;
    }

    const delayDebounceFn = setTimeout(() => {
      fetchProducts(searchTerm);
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, fetchProducts]);

  const updateQuantity = useCallback(
    (productId, deltaOrQty, isManual = false) => {
      setCart((prevCart) =>
        prevCart.map((item) => {
          if (item.id === productId) {
            let newQty;
            if (isManual) {
              newQty = deltaOrQty === '' ? '' : parseInt(deltaOrQty, 10);
              if (deltaOrQty !== '' && (isNaN(newQty) || newQty < 1))
                return item;
            } else {
              newQty = Math.max(1, item.quantity + deltaOrQty);
            }
            return { ...item, quantity: newQty };
          }
          return item;
        }),
      );
    },
    [],
  );

  const removeFromCart = useCallback((productId) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== productId));
  }, []);

  const total = cart.reduce(
    (sum, item) => sum + item.selling_price * item.quantity,
    0,
  );

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  const printBill = async (
    cartItems,
    totalAmount,
    billNumber,
    paymentMethod,
    date,
  ) => {
    try {
      const billData = {
        bill: {
          bill_number: billNumber,
          date: date,
          payment_method: paymentMethod,
          items: cartItems.map((item) => ({
            name: item.name,
            barcode: item.barcode,
            qty: item.quantity,
            price: parseFloat(item.selling_price).toFixed(2),
            total: (item.selling_price * item.quantity).toFixed(2),
          })),
          total: totalAmount.toFixed(2),
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
      // We don't set status error here as the bill was created successfully
      // and print failure is secondary to transaction completion
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setProcessing(true);
    setStatus({ type: '', message: '' });

    try {
      const items = cart.map((item) => ({
        product_id: item.id,
        quantity: item.quantity,
      }));
      const currentCart = [...cart];
      const currentTotal = total;

      const response = await billsApi.create({
        items,
        payment_method: paymentMethod,
        idempotency_key: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        business_date: new Date().toISOString().split('T')[0],
      });

      setStatus({
        type: 'success',
        message: 'Transaction completed successfully',
      });

      // Trigger print after successful bill creation
      printBill(
        currentCart,
        currentTotal,
        response.bill_number,
        paymentMethod,
        new Intl.DateTimeFormat('en-IN', {
          timeZone: 'Asia/Kolkata',
          dateStyle: 'medium',
          timeStyle: 'medium',
        }).format(new Date()),
      );

      setCart([]);
      setPaymentMethod('CASH'); // Reset payment method after checkout
      setTimeout(() => setStatus({ type: '', message: '' }), 3000);
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Checkout failed' });
    } finally {
      setProcessing(false);
    }
  };

  // Removal of client-side filtering logic

  return (
    <Box
      sx={{
        height: { xs: 'auto', lg: '100%' },
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden', // Prevent outer scroll on desktop
      }}
    >
      {/* Header */}
      <Box
        sx={{
          mb: 2,
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', sm: 'center' },
          gap: 2,
          flexShrink: 0,
        }}
      >
        <Typography
          variant="h4"
          fontWeight={900}
          sx={{
            color: 'text.primary',
            fontSize: { xs: '1.5rem', sm: '1.8rem', lg: '2rem' },
          }}
        >
          Cashier Terminal
        </Typography>
        <Button
          variant="outlined"
          color="secondary"
          startIcon={<RemoveIcon />}
          onClick={() => navigate('/cashier/return')}
          sx={{ fontWeight: 700, borderRadius: 2, whiteSpace: 'nowrap' }}
        >
          Manage Returns
        </Button>
      </Box>

      {/* Main Content Area */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', lg: 'row' },
          gap: 3,
          flexGrow: 1,
          minHeight: 0, // CRITICAL for nested flex scrolling
          overflow: { xs: 'visible', lg: 'hidden' },
        }}
      >
        {/* Left Section (Cart) */}
        <Box
          sx={{
            flex: { xs: '1 1 auto', lg: 1 }, // Use flex: 1 to fill available space
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            minWidth: 0,
            height: '100%',
          }}
        >
          {/* Search Section */}
          <Paper
            elevation={0}
            sx={{
              p: 0,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              flexShrink: 0,
            }}
          >
            <Autocomplete
              openOnFocus
              clearOnBlur
              handleHomeEndKeys
              options={products}
              inputValue={searchTerm}
              value={null}
              getOptionLabel={(option) => option.name}
              filterOptions={(x) => x} // Filtering handled by API
              onInputChange={(event, newInputValue) => {
                setSearchTerm(newInputValue);
              }}
              onChange={(event, newValue) => {
                if (newValue) {
                  addToCart(newValue);
                  setSearchTerm('');
                }
              }}
              renderOption={(props, option) => {
                const { key, ...optionProps } = props;
                return (
                  <ListItem key={option.id} {...optionProps} divider>
                    <ListItemText
                      primary={
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <Typography variant="body1" fontWeight={600}>
                            {option.name}
                          </Typography>
                          <Typography
                            variant="body1"
                            color="primary.main"
                            fontWeight={700}
                          >
                            ₹{parseFloat(option.selling_price).toFixed(2)}
                          </Typography>
                        </Box>
                      }
                      secondary={
                        <Box sx={{ display: 'flex', gap: 2 }}>
                          <Typography variant="caption" color="text.secondary">
                            Barcode: {option.barcode}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Stock: {option.stock_qty}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                );
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  fullWidth
                  placeholder="Search product by name or scan barcode"
                  variant="outlined"
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon color="action" />
                      </InputAdornment>
                    ),
                    sx: {
                      borderRadius: 2,
                      '& fieldset': { border: 'none' },
                      py: 0.5,
                    },
                    endAdornment: (
                      <React.Fragment>
                        {loading ? (
                          <CircularProgress color="inherit" size={20} />
                        ) : null}
                        {params.InputProps.endAdornment}
                      </React.Fragment>
                    ),
                  }}
                />
              )}
              noOptionsText={
                searchTerm ? 'No products found' : 'Search to see results'
              }
            />
          </Paper>

          {/* Hidden Barcode Input removed: using global listener instead */}

          {/* Cart Table Section */}
          <TableContainer
            component={Paper}
            elevation={0}
            sx={{
              flexGrow: 1,
              minHeight: 0,
              overflow: 'auto',
              bgcolor: 'background.paper',
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell
                    sx={{
                      fontWeight: 700,
                      minWidth: 200,
                      bgcolor: 'background.paper',
                    }}
                  >
                    Item Name
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{ fontWeight: 700, bgcolor: 'background.paper' }}
                  >
                    Price
                  </TableCell>
                  <TableCell
                    align="center"
                    sx={{ fontWeight: 700, bgcolor: 'background.paper' }}
                  >
                    Quantity
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{ fontWeight: 700, bgcolor: 'background.paper' }}
                  >
                    Line Total
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{ bgcolor: 'background.paper' }}
                  ></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {cart.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      align="center"
                      sx={{ py: 10, borderBottom: 'none' }}
                    >
                      <Box sx={{ opacity: 0.5 }}>
                        <CartIcon sx={{ fontSize: 48, mb: 1 }} />
                        <Typography>Cart is empty</Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : (
                  cart.map((item) => (
                    <TableRow key={item.id} hover>
                      <TableCell sx={{ minWidth: 200 }}>
                        <Typography variant="body2" fontWeight={600}>
                          {item.name}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block', mt: -0.5 }}
                        >
                          {item.barcode}
                        </Typography>
                        {item.quantity > item.stock_qty && (
                          <Typography
                            variant="caption"
                            color="error"
                            sx={{ display: 'block' }}
                          >
                            Low stock: only {item.stock_qty} available
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        ₹{parseFloat(item.selling_price).toFixed(2)}
                      </TableCell>
                      <TableCell align="center">
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 1,
                          }}
                        >
                          <IconButton
                            size="small"
                            onClick={() => updateQuantity(item.id, -1)}
                            sx={{ border: '1px solid', borderColor: 'divider' }}
                          >
                            <RemoveIcon fontSize="small" />
                          </IconButton>
                          <TextField
                            size="small"
                            value={item.quantity}
                            onChange={(e) =>
                              updateQuantity(item.id, e.target.value, true)
                            }
                            onFocus={(e) => e.target.select()}
                            onBlur={(e) => {
                              if (
                                e.target.value === '' ||
                                parseInt(e.target.value, 10) < 1
                              ) {
                                updateQuantity(item.id, 1, true);
                              }
                            }}
                            inputProps={{
                              style: {
                                textAlign: 'center',
                                padding: '4px 0',
                                width: '40px',
                                fontWeight: 700,
                                fontSize: '0.875rem',
                              },
                              inputMode: 'numeric',
                              pattern: '[0-9]*',
                            }}
                            variant="outlined"
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                borderRadius: 1.5,
                                backgroundColor: 'rgba(0,0,0,0.02)',
                                '&:hover fieldset': {
                                  borderColor: 'primary.light',
                                },
                              },
                              '& .MuiOutlinedInput-notchedOutline': {
                                border: '1px solid',
                                borderColor: 'divider',
                              },
                            }}
                          />
                          <IconButton
                            size="small"
                            onClick={() => updateQuantity(item.id, 1)}
                            sx={{ border: '1px solid', borderColor: 'divider' }}
                          >
                            <AddIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        ₹{(item.selling_price * item.quantity).toFixed(2)}
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => removeFromCart(item.id)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>

        {/* Right Section (30%) - Payment Summary & Actions */}
        <Box
          sx={{
            flex: { xs: '1 1 auto', lg: '0 0 30%' },
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
            height: '100%',
          }}
        >
          <Paper
            elevation={1}
            sx={{
              p: 3,
              borderRadius: 3,
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography variant="h6" fontWeight={800} gutterBottom>
              Bill Summary
            </Typography>

            <Box
              sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography color="text.secondary">Total Items</Typography>
                <Typography fontWeight={600}>{cart.length}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography color="text.secondary">Total Quantity</Typography>
                <Typography fontWeight={600}>{totalItems}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography color="text.secondary">Subtotal</Typography>
                <Typography fontWeight={600}>₹{total.toFixed(2)}</Typography>
              </Box>

              <Divider sx={{ my: 1 }} />

              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  mb: 1,
                }}
              >
                <Typography variant="h6" fontWeight={800}>
                  Total Payable
                </Typography>
                <Typography variant="h4" fontWeight={900} color="primary.main">
                  ₹{total.toFixed(2)}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
                Payment Method
              </Typography>
              <ToggleButtonGroup
                value={paymentMethod}
                exclusive
                onChange={(e, newMethod) => {
                  if (newMethod !== null) setPaymentMethod(newMethod);
                }}
                fullWidth
                color="primary"
                size="small"
              >
                <ToggleButton
                  value="CASH"
                  sx={{
                    py: 1,
                    borderRadius: 2,
                    border: '1px solid !important',
                    borderColor: 'divider',
                    '&.Mui-selected': {
                      borderColor: 'primary.main !important',
                      bgcolor: 'primary.action.selected',
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CashIcon sx={{ fontSize: 18 }} />
                    <Typography
                      variant="button"
                      fontWeight={700}
                      sx={{ fontSize: '0.75rem' }}
                    >
                      CASH
                    </Typography>
                  </Box>
                </ToggleButton>
                <ToggleButton
                  value="UPI"
                  sx={{
                    py: 1,
                    borderRadius: 2,
                    border: '1px solid !important',
                    borderColor: 'divider',
                    '&.Mui-selected': {
                      borderColor: 'primary.main !important',
                      bgcolor: 'primary.action.selected',
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <UpiIcon sx={{ fontSize: 18 }} />
                    <Typography
                      variant="button"
                      fontWeight={700}
                      sx={{ fontSize: '0.75rem' }}
                    >
                      UPI
                    </Typography>
                  </Box>
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>

            <Box sx={{ mt: 'auto', pt: 3 }}>
              <Button
                fullWidth
                variant="contained"
                size="large"
                disabled={processing || cart.length === 0}
                onClick={handleCheckout}
                sx={{
                  py: 1.5,
                  borderRadius: 2,
                  fontSize: '1.1rem',
                  fontWeight: 800,
                  textTransform: 'none',
                }}
              >
                {processing ? (
                  <CircularProgress size={28} color="inherit" />
                ) : (
                  `Checkout ₹${total.toFixed(2)}`
                )}
              </Button>
            </Box>
          </Paper>
        </Box>
      </Box>

      {/* Global Status Alert */}
      {status.message && (
        <Alert
          severity={status.type}
          onClose={() => setStatus({ type: '', message: '' })}
          sx={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            zIndex: 2000,
            boxShadow: 3,
          }}
        >
          {status.message}
        </Alert>
      )}
    </Box>
  );
};

export default CashierDashboard;
