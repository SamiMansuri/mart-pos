import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { productsApi, billsApi, customersApi, luckyDrawApi } from '../api/api';
import {
  Box,
  Typography,
  Button,
  Paper,
  IconButton,
  Divider,
  Alert,
  CircularProgress,
  TextField,
  InputAdornment,
  ToggleButtonGroup,
  ToggleButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Autocomplete,
  ListItem,
  ListItemText,
  FormControlLabel,
  Switch,
} from '@mui/material';
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  ShoppingCart as CartIcon,
  Money as CashIcon,
  QrCode2 as UpiIcon,
  PersonAdd as PersonAddIcon,
} from '@mui/icons-material';
import AddCustomerModal from '../components/AddCustomerModal';

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
  const searchRef = useRef(null);
  const [activeSection, setActiveSection] = useState('SEARCH'); // 'SEARCH', 'CART', 'BILL_SUMMARY'
  const [selectedCartIndex, setSelectedCartIndex] = useState(-1);
  const [roundAdjust, setRoundAdjust] = useState(0);
  const qtyRefs = useRef([]);

  // Customer State (General)
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [customerOptions, setCustomerOptions] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [addCustomerModalOpen, setAddCustomerModalOpen] = useState(false);

  // Credit Bill State
  const [isCredit, setIsCredit] = useState(false);
  const [paidAmount, setPaidAmount] = useState('');

  // Lucky Draw State
  const [activeCampaign, setActiveCampaign] = useState(null);
  const [excludedProductIds, setExcludedProductIds] = useState(new Set());
  const [skipLuckyDraw, setSkipLuckyDraw] = useState(false);
  const [isAddingPhone, setIsAddingPhone] = useState(false);
  const [newPhoneInput, setNewPhoneInput] = useState('');
  const [barcodeValue, setBarcodeValue] = useState('');

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

  const removeFromCart = useCallback((productId) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== productId));
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
        setSelectedCartIndex(existingItemIndex);
        return newCart;
      } else {
        const newCart = [...prevCart, { ...product, quantity: 1 }];
        setSelectedCartIndex(newCart.length - 1);
        return newCart;
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
        setActiveSection('CART'); // Move to cart after scanning
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
      // Check if ANY input field is currently active (excluding the ones we manage manually)
      const isInputFocused =
        document.activeElement &&
        (document.activeElement.tagName === 'INPUT' ||
          document.activeElement.tagName === 'TEXTAREA' ||
          document.activeElement.isContentEditable);

      // F2 to focus Search (Always works unless typing in another field)
      if (e.key === 'F2') {
        e.preventDefault();
        setActiveSection('SEARCH');
        searchRef.current?.focus();
        return;
      }

      if (e.key === 'F8') {
        e.preventDefault();
        handleCheckout();
      }

      // Esc to blur or return to search section
      if (e.key === 'Escape') {
        if (isInputFocused) {
          document.activeElement.blur();
        }
        // setActiveSection('SEARCH');
        return;
      }

      // Only allow section switching and cart navigation if NOT typing in an input
      if (!isInputFocused) {
        // Global Navigation (Left/Right Arrow)
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setActiveSection('CART');
          if (cart.length > 0 && selectedCartIndex === -1) {
            setSelectedCartIndex(0);
          }
          return;
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          setActiveSection('BILL_SUMMARY');
          return;
        }

        // Cart Section Logic
        if (activeSection === 'CART' && cart.length > 0) {
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedCartIndex((prev) =>
              prev <= 0 ? cart.length - 1 : prev - 1,
            );
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedCartIndex((prev) =>
              prev >= cart.length - 1 ? 0 : prev + 1,
            );
          } else if (e.key === 'Delete') {
            e.preventDefault();
            if (selectedCartIndex > -1) {
              const itemToRemove = cart[selectedCartIndex];
              removeFromCart(itemToRemove.id);
            }
          } else if (e.key.toLowerCase() === 'q') {
            e.preventDefault();
            if (selectedCartIndex > -1) {
              qtyRefs.current[selectedCartIndex]?.focus();
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSection, cart, selectedCartIndex, removeFromCart]);

  // Sync selection index when cart changes
  useEffect(() => {
    if (cart.length === 0) {
      setSelectedCartIndex(-1);
    } else if (selectedCartIndex >= cart.length) {
      setSelectedCartIndex(cart.length - 1);
    }
  }, [cart.length, selectedCartIndex]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedCartIndex >= 0 && qtyRefs.current[selectedCartIndex]) {
      qtyRefs.current[selectedCartIndex].scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedCartIndex]);

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

  useEffect(() => {
    const fetchCust = async () => {
      setCustomersLoading(true);
      try {
        const data = await customersApi.getAll(customerSearchTerm);
        setCustomerOptions(data || []);
      } catch (err) {
        console.error('Failed to fetch customers', err);
      } finally {
        setCustomersLoading(false);
      }
    };
    const delay = setTimeout(fetchCust, 500);
    return () => clearTimeout(delay);
  }, [customerSearchTerm]);

  // Fetch active Lucky Draw campaign on mount
  useEffect(() => {
    const fetchActiveCampaign = async () => {
      try {
        const campaign = await luckyDrawApi.getActiveCampaign();
        if (campaign) {
          setActiveCampaign(campaign);
          // Fetch excluded product IDs for fast lookup
          try {
            const excluded = await luckyDrawApi.getExcludedProducts(
              campaign.id,
            );
            setExcludedProductIds(
              new Set((excluded || []).map((p) => p.product_id)),
            );
          } catch {
            // Non-fatal: proceed with empty exclusion set
          }
        }
      } catch {
        // Silent — no campaign is a normal state for the cashier
      }
    };
    fetchActiveCampaign();
  }, []);

  const updateQuantity = useCallback(
    (productId, deltaOrQty, isManual = false) => {
      setCart((prevCart) =>
        prevCart.map((item) => {
          if (item.id === productId) {
            const isWeight = item.sale_type === 'WEIGHT';
            let newQty;
            if (isManual) {
              if (isWeight) {
                // For WEIGHT: store the raw string while typing so "1." doesn't snap back
                // Only reject if it's clearly invalid (non-numeric characters)
                if (deltaOrQty === '') return { ...item, quantity: '' };
                if (!/^\d*\.?\d*$/.test(deltaOrQty)) return item;
                return { ...item, quantity: deltaOrQty };
              } else {
                // For UNIT: integers only
                newQty = deltaOrQty === '' ? '' : parseInt(deltaOrQty, 10);
                if (deltaOrQty !== '' && (isNaN(newQty) || newQty < 1))
                  return item;
              }
            } else {
              // +/- buttons: always numeric
              const current =
                parseFloat(item.quantity) || (isWeight ? 0.001 : 1);
              newQty = Math.max(isWeight ? 0.001 : 1, current + deltaOrQty);
              if (isWeight) {
                // Round to 3 decimal places to avoid floating point drift
                newQty = Math.round(newQty * 1000) / 1000;
              }
            }
            return { ...item, quantity: newQty };
          }
          return item;
        }),
      );
    },
    [],
  );

  const subTotal = cart.reduce(
    (sum, item) => sum + item.selling_price * (parseFloat(item.quantity) || 0),
    0,
  );

  const total = subTotal - Number(roundAdjust || 0);

  const totalItems = cart.reduce(
    (sum, item) => sum + (parseFloat(item.quantity) || 0),
    0,
  );

  // Lucky Draw — eligible amount excludes excluded products and round adjustment
  const eligibleAmount =
    cart.reduce((sum, item) => {
      if (excludedProductIds.has(item.id)) return sum;
      return sum + item.selling_price * (parseFloat(item.quantity) || 0);
    }, 0) - Number(roundAdjust || 0);

  const printBill = async (
    cartItems,
    totalAmount,
    billNumber,
    invoiceNumber,
    paymentMethod,
    date,
    luckyDraw = null,
  ) => {
    try {
      const billData = {
        bill: {
          bill_number: billNumber,
          invoice_number: invoiceNumber,
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
          lucky_draw: luckyDraw
            ? {
                ticket_numbers: luckyDraw.ticket_numbers,
                draw_date: luckyDraw.draw_date,
                campaign_name: luckyDraw.campaign_name,
              }
            : null,
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
      // We don't set status error here as the bill was created successfully
      // and print failure is secondary to transaction completion
    }
  };
  const handleCheckout = async (shouldPrint = true) => {
    if (cart.length === 0) return;
    if (isCredit && !selectedCustomer) {
      setStatus({
        type: 'error',
        message: 'Please select a customer for credit bill',
      });
      return;
    }

    setProcessing(true);
    setStatus({ type: '', message: '' });

    try {
      const items = cart.map((item) => ({
        product_id: item.id,
        quantity: parseFloat(item.quantity) || 0,
      }));
      const currentCart = [...cart];
      const currentTotal = total;

      const response = await billsApi.create({
        items,
        payment_method: paymentMethod,
        idempotency_key: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        business_date: new Date().toISOString().split('T')[0],
        round_adjustment: Number(roundAdjust || 0),
        ...(isCredit && {
          is_credit: true,
          customer_id: selectedCustomer.id,
          paid_amount: Number(paidAmount || 0),
        }),
        ...(!isCredit &&
          selectedCustomer && { customer_id: selectedCustomer.id }),
        participate_in_lucky_draw: !!(
          activeCampaign &&
          eligibleAmount >= parseFloat(activeCampaign.min_bill_amount) &&
          selectedCustomer &&
          selectedCustomer.phone &&
          !skipLuckyDraw
        ),
      });

      setStatus({
        type: 'success',
        message: 'Transaction completed successfully',
      });

      // Trigger print after successful bill creation only if shouldPrint is true
      if (shouldPrint) {
        printBill(
          currentCart,
          currentTotal,
          response.bill_number,
          response.invoice_number,
          paymentMethod,
          new Intl.DateTimeFormat('en-IN', {
            timeZone: 'Asia/Kolkata',
            dateStyle: 'medium',
            timeStyle: 'medium',
          }).format(new Date()),
          response.lucky_draw ?? null,
        );
      }

      if (response.lucky_draw && selectedCustomer && selectedCustomer.phone) {
        const { campaign_name, ticket_numbers, draw_date } =
          response.lucky_draw;
        const message = `Hello ${selectedCustomer.name},

Thank you for shopping at Family Super Mart!

You have successfully entered our ${campaign_name}.
Your Ticket Number(s): ${ticket_numbers.join(', ')}
Draw Date: After 15th August 2026

Best of luck!`;

        console.log('message===>', message);

        let phone = selectedCustomer.phone.replace(/\\D/g, '');
        if (phone.length === 10) {
          phone = '91' + phone;
        }

        window.open(
          `whatsapp://send?phone=${phone}&text=${encodeURIComponent(message)}`,
        );
      }

      setCart([]);
      setPaymentMethod('CASH'); // Reset payment method after checkout
      setRoundAdjust(0); // Reset round adjust after checkout
      setIsCredit(false);
      setSelectedCustomer(null);
      setSkipLuckyDraw(false);
      setIsAddingPhone(false);
      setNewPhoneInput('');
      setPaidAmount('');
      setTimeout(() => setStatus({ type: '', message: '' }), 3000);
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Checkout failed' });
    } finally {
      setProcessing(false);
    }
  };

  useEffect(() => {
    setSkipLuckyDraw(false);
    setIsAddingPhone(false);
    setNewPhoneInput('');
  }, [selectedCustomer?.id]);

  const handleSavePhone = async () => {
    if (!/^\d{10}$/.test(newPhoneInput)) {
      setStatus({ type: 'error', message: 'Phone number must be 10 digits' });
      return;
    }
    setProcessing(true);
    try {
      const updatedCustomer = await customersApi.updatePartial(
        selectedCustomer.id,
        {
          phone: newPhoneInput,
          name: selectedCustomer.name,
        },
      );
      setSelectedCustomer(updatedCustomer);
      setIsAddingPhone(false);
      setStatus({
        type: 'success',
        message: 'Phone number updated successfully',
      });
    } catch (err) {
      console.error('Failed to save phone number', err);
      setStatus({
        type: 'error',
        message: 'Failed to save phone number. Please try again.',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleCustomerCreated = (newCustomer) => {
    setCustomerOptions((prev) => [newCustomer, ...prev]);
    setSelectedCustomer(newCustomer);
    setAddCustomerModalOpen(false);
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
            elevation={activeSection === 'SEARCH' ? 4 : 0}
            sx={{
              p: 0,
              border: '2px solid',
              borderColor:
                activeSection === 'SEARCH' ? 'primary.main' : 'divider',
              borderRadius: 2,
              flexShrink: 0,
              // transition: 'all 0.2s ease-in-out',
            }}
          >
            {' '}
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
                  searchRef.current?.blur();
                  setActiveSection('CART');
                }
              }}
              renderOption={(props, option) => {
                const { key, ...optionProps } = props;
                return (
                  <ListItem key={option.id} {...optionProps} divider>
                    <ListItemText
                      primaryTypographyProps={{ component: 'div' }}
                      secondaryTypographyProps={{ component: 'div' }}
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
                  inputRef={searchRef}
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
            elevation={activeSection === 'CART' ? 4 : 0}
            sx={{
              flexGrow: 1,
              minHeight: 0,
              overflow: 'auto',
              bgcolor: 'background.paper',
              borderRadius: 2,
              border: '2px solid',
              borderColor:
                activeSection === 'CART' ? 'primary.main' : 'divider',
              // transition: 'all 0.2s ease-in-out',
            }}
          >
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell
                    sx={{
                      fontWeight: 700,
                      width: 50,
                      bgcolor: 'background.paper',
                    }}
                  >
                    S.No
                  </TableCell>
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
                    align="center"
                    sx={{ fontWeight: 700, bgcolor: 'background.paper' }}
                  >
                    Quantity
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{ fontWeight: 700, bgcolor: 'background.paper' }}
                  >
                    Price
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
                      colSpan={6}
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
                  cart.map((item, index) => (
                    <TableRow
                      key={item.id}
                      hover
                      selected={index === selectedCartIndex}
                      sx={{
                        '&.Mui-selected': {
                          bgcolor: 'primary.action.selected',
                          '&:hover': {
                            bgcolor: 'primary.action.selected',
                          },
                        },
                      }}
                    >
                      <TableCell>{index + 1}</TableCell>
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
                            onClick={() =>
                              updateQuantity(
                                item.id,
                                item.sale_type === 'WEIGHT' ? -0.5 : -1,
                              )
                            }
                            sx={{ border: '1px solid', borderColor: 'divider' }}
                          >
                            <RemoveIcon fontSize="small" />
                          </IconButton>
                          <TextField
                            size="small"
                            inputRef={(el) => (qtyRefs.current[index] = el)}
                            value={item.quantity}
                            onChange={(e) =>
                              updateQuantity(item.id, e.target.value, true)
                            }
                            onFocus={(e) => {
                              e.target.select();
                              setActiveSection('CART');
                              setSelectedCartIndex(index);
                            }}
                            onBlur={(e) => {
                              const isWeight = item.sale_type === 'WEIGHT';
                              const minQty = isWeight ? 0.001 : 1;
                              const parsed = parseFloat(e.target.value);
                              if (
                                e.target.value === '' ||
                                isNaN(parsed) ||
                                parsed < minQty
                              ) {
                                // Snap to minimum
                                setCart((prev) =>
                                  prev.map((ci) =>
                                    ci.id === item.id
                                      ? { ...ci, quantity: minQty }
                                      : ci,
                                  ),
                                );
                              } else {
                                // Commit the parsed number (removes trailing dots)
                                setCart((prev) =>
                                  prev.map((ci) =>
                                    ci.id === item.id
                                      ? { ...ci, quantity: parsed }
                                      : ci,
                                  ),
                                );
                              }
                            }}
                            inputProps={{
                              style: {
                                textAlign: 'center',
                                padding: '4px 0',
                                width: '50px',
                                fontWeight: 700,
                                fontSize: '0.875rem',
                              },
                              inputMode:
                                item.sale_type === 'WEIGHT'
                                  ? 'decimal'
                                  : 'numeric',
                              pattern:
                                item.sale_type === 'WEIGHT'
                                  ? '[0-9]*\\.?[0-9]*'
                                  : '[0-9]*',
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
                            onClick={() =>
                              updateQuantity(
                                item.id,
                                item.sale_type === 'WEIGHT' ? 0.5 : 1,
                              )
                            }
                            sx={{ border: '1px solid', borderColor: 'divider' }}
                          >
                            <AddIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        ₹{parseFloat(item.selling_price).toFixed(2)}
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
            elevation={activeSection === 'BILL_SUMMARY' ? 4 : 1}
            sx={{
              p: 3,
              borderRadius: 3,
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              border: '2px solid',
              borderColor:
                activeSection === 'BILL_SUMMARY' ? 'primary.main' : 'divider',
              // transition: 'all 0.2s ease-in-out',
            }}
          >
            <Typography variant="h6" fontWeight={800} gutterBottom>
              Bill Summary
            </Typography>

            {/* Lucky Draw Section */}
            {activeCampaign &&
              !isCredit &&
              !skipLuckyDraw &&
              eligibleAmount >= parseFloat(activeCampaign.min_bill_amount) && (
                <Box
                  sx={{
                    mb: 2,
                    p: 1.5,
                    bgcolor: 'rgba(255, 193, 7, 0.08)',
                    border: '1px solid',
                    borderColor: 'warning.light',
                    borderRadius: 2,
                  }}
                >
                  <Typography
                    variant="subtitle2"
                    fontWeight={800}
                    color="warning.dark"
                    sx={{ mb: 0.5 }}
                  >
                    🎟 Lucky Draw Eligible!
                  </Typography>
                  {selectedCustomer ? (
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      {selectedCustomer.phone ? (
                        <Box>
                          <Typography variant="body2" fontWeight={700}>
                            {selectedCustomer.name} ✓
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {Math.floor(
                              eligibleAmount /
                                parseFloat(activeCampaign.min_bill_amount),
                            )}{' '}
                            {Math.floor(
                              eligibleAmount /
                                parseFloat(activeCampaign.min_bill_amount),
                            ) === 1
                              ? 'entry'
                              : 'entries'}{' '}
                            will be generated
                          </Typography>
                        </Box>
                      ) : (
                        <Box sx={{ width: '100%' }}>
                          <Typography
                            variant="body2"
                            color="error.main"
                            fontWeight={700}
                          >
                            ⚠️ No phone number on file.
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: 'block', mb: 1 }}
                          >
                            A phone number is required to generate a lucky draw
                            entry.
                          </Typography>

                          {isAddingPhone ? (
                            <Box
                              sx={{
                                mt: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 1,
                              }}
                            >
                              <Typography variant="caption" fontWeight={700}>
                                Enter phone number:
                              </Typography>
                              <TextField
                                size="small"
                                placeholder="10-digit phone"
                                value={newPhoneInput}
                                onChange={(e) =>
                                  setNewPhoneInput(
                                    e.target.value
                                      .replace(/\D/g, '')
                                      .slice(0, 10),
                                  )
                                }
                                autoFocus
                                fullWidth
                              />
                              <Box sx={{ display: 'flex', gap: 1 }}>
                                <Button
                                  size="small"
                                  variant="contained"
                                  onClick={handleSavePhone}
                                  disabled={processing}
                                >
                                  Save & Participate
                                </Button>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => setIsAddingPhone(false)}
                                >
                                  Cancel
                                </Button>
                              </Box>
                            </Box>
                          ) : (
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => setIsAddingPhone(true)}
                              >
                                Add Phone Number
                              </Button>
                              <Button
                                size="small"
                                variant="text"
                                color="inherit"
                                onClick={() => setSkipLuckyDraw(true)}
                              >
                                Skip Lucky Draw
                              </Button>
                            </Box>
                          )}
                        </Box>
                      )}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Eligible ₹{eligibleAmount.toFixed(2)} →{' '}
                      {Math.floor(
                        eligibleAmount /
                          parseFloat(activeCampaign.min_bill_amount),
                      )}{' '}
                      entries · Select a customer above to participate
                    </Typography>
                  )}
                </Box>
              )}

            <Box sx={{ display: 'flex', gap: 1 }}>
              <Autocomplete
                fullWidth
                options={customerOptions}
                getOptionLabel={(option) =>
                  `${option.name} (${option.phone || 'N/A'})`
                }
                value={selectedCustomer}
                onChange={(_, newValue) => setSelectedCustomer(newValue)}
                onInputChange={(_, newInputValue) =>
                  setCustomerSearchTerm(newInputValue)
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Search Customer"
                    size="small"
                    placeholder="Name or Phone"
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <React.Fragment>
                          {customersLoading ? (
                            <CircularProgress color="inherit" size={20} />
                          ) : null}
                          {params.InputProps.endAdornment}
                        </React.Fragment>
                      ),
                    }}
                  />
                )}
              />
              <IconButton
                color="primary"
                onClick={() => setAddCustomerModalOpen(true)}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  bgcolor: 'rgba(0,0,0,0.02)',
                }}
              >
                <PersonAddIcon />
              </IconButton>
            </Box>

            {/* {selectedCustomer && (
              <Box
                sx={{
                  mb: 2,
                  p: 1.5,
                  bgcolor: 'primary.action.hover',
                  borderRadius: 2,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  border: '1px solid',
                  borderColor: 'primary.light',
                }}
              >
                <Box>
                  <Typography
                    variant="body2"
                    fontWeight={700}
                    color="primary.dark"
                  >
                    {selectedCustomer.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {selectedCustomer.phone || 'No Phone'}
                  </Typography>
                </Box>
                <IconButton
                  size="small"
                  onClick={() => setSelectedCustomer(null)}
                  sx={{ color: 'text.secondary' }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            )} */}

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
                <Typography fontWeight={600}>₹{subTotal.toFixed(2)}</Typography>
              </Box>

              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Typography color="text.secondary">Round Adjust</Typography>
                <TextField
                  size="small"
                  type="number"
                  value={roundAdjust}
                  onChange={(e) => setRoundAdjust(e.target.value)}
                  onFocus={(e) => {
                    e.target.select();
                    setActiveSection('BILL_SUMMARY');
                  }}
                  onBlur={() => {
                    if (roundAdjust === '' || isNaN(parseFloat(roundAdjust))) {
                      setRoundAdjust(0);
                    }
                  }}
                  inputProps={{
                    style: {
                      textAlign: 'right',
                      padding: '4px 8px',
                      width: '80px',
                      fontWeight: 600,
                    },
                  }}
                  variant="outlined"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 1.5,
                      backgroundColor: 'rgba(0,0,0,0.02)',
                    },
                  }}
                />
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

            <Box sx={{ mt: 0 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={isCredit}
                    onChange={(e) => setIsCredit(e.target.checked)}
                    color="primary"
                  />
                }
                label={<Typography fontWeight={700}>Credit Bill</Typography>}
              />

              {isCredit && (
                <Box
                  sx={{
                    mt: 2,
                    mb: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    p: 2,
                    bgcolor: 'rgba(0,0,0,0.02)',
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  {!selectedCustomer && (
                    <Typography
                      variant="body2"
                      color="error"
                      sx={{ textAlign: 'center', mb: 1 }}
                    >
                      Please select a customer at the top
                    </Typography>
                  )}
                  {selectedCustomer && (
                    <>
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                        }}
                      >
                        <Typography variant="body2" color="text.secondary">
                          Current Due:
                        </Typography>
                        <Typography
                          variant="body2"
                          fontWeight={700}
                          color="error.main"
                        >
                          ₹{parseFloat(selectedCustomer.total_due).toFixed(2)}
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                        }}
                      >
                        <Typography variant="body2" color="text.secondary">
                          Credit Limit:
                        </Typography>
                        <Typography variant="body2" fontWeight={700}>
                          {parseFloat(selectedCustomer.credit_limit) === 0
                            ? 'No Limit'
                            : `₹${parseFloat(selectedCustomer.credit_limit).toFixed(2)}`}
                        </Typography>
                      </Box>
                    </>
                  )}
                  <TextField
                    label="Paid at Counter"
                    type="number"
                    size="small"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">₹</InputAdornment>
                      ),
                    }}
                  />
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      mt: 1,
                    }}
                  >
                    <Typography fontWeight={700} color="primary.main">
                      Credit Amount:
                    </Typography>
                    <Typography fontWeight={800} color="primary.main">
                      ₹{Math.max(0, total - Number(paidAmount || 0)).toFixed(2)}
                    </Typography>
                  </Box>
                </Box>
              )}

              <Typography
                variant="subtitle2"
                fontWeight={700}
                sx={{ mt: 1, mb: 1.5 }}
              >
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

            <Box
              sx={{
                mt: 'auto',
                pt: 3,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <Button
                fullWidth
                variant="outlined"
                size="large"
                disabled={processing || cart.length === 0}
                onClick={() => handleCheckout(false)}
                sx={{
                  py: 1,
                  borderRadius: 2,
                  fontSize: '1rem',
                  fontWeight: 700,
                  textTransform: 'none',
                }}
              >
                Checkout
              </Button>

              <Button
                fullWidth
                variant="contained"
                size="large"
                disabled={processing || cart.length === 0}
                onClick={() => handleCheckout(true)}
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
                  `Checkout & Print ₹${total.toFixed(2)}`
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

      {/* Add Customer Modal */}
      <AddCustomerModal
        open={addCustomerModalOpen}
        onClose={() => setAddCustomerModalOpen(false)}
        onSuccess={handleCustomerCreated}
      />
    </Box>
  );
};

export default CashierDashboard;
