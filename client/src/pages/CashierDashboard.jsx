import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { productsApi, billsApi } from "../api/api";
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
} from "@mui/material";
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  ShoppingCart as CartIcon,
  Money as CashIcon,
  QrCode2 as UpiIcon,
} from "@mui/icons-material";

const ProductCard = React.memo(({ product, onAdd }) => {
  const isOutOfStock = product.stock_qty <= 0;
  const isLowStock = product.stock_qty < 10 && !isOutOfStock;

  return (
    <Grid item xs={6} sm={6} md={4} lg={3} sx={{ display: "flex" }}>
      <Card
        elevation={1}
        sx={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          borderRadius: 2,
          overflow: "hidden",
          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          border: "1px solid",
          borderColor: "divider",
          "&:hover": {
            transform: "translateY(-4px)",
            boxShadow: "0 12px 20px -10px rgba(0,0,0,0.1)",
            borderColor: "primary.light",
          },
        }}
      >
        <CardContent
          sx={{
            flex: "1 0 auto",
            p: 2,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 700,
              fontSize: "0.95rem",
              lineHeight: 1.3,
              height: "2.6rem", // Exactly 2 lines of text
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              mb: 1,
            }}
          >
            {product.name}
          </Typography>

          <Box sx={{ mt: "auto" }}>
            <Typography
              variant="h6"
              color="primary.main"
              fontWeight={800}
              sx={{ mb: 0.5 }}
            >
              ${parseFloat(product.selling_price).toFixed(2)}
            </Typography>

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                minHeight: "1.5rem",
              }}
            >
              {isOutOfStock ? (
                <Typography
                  variant="caption"
                  color="error.main"
                  fontWeight={800}
                  sx={{ letterSpacing: "0.5px" }}
                >
                  OUT OF STOCK
                </Typography>
              ) : (
                <Typography
                  variant="caption"
                  color={isLowStock ? "error.main" : "text.secondary"}
                  fontWeight={isLowStock ? 700 : 500}
                >
                  Stock: {product.stock_qty}
                </Typography>
              )}
            </Box>
          </Box>
        </CardContent>
        <CardActions sx={{ p: 2, pt: 0 }}>
          <Button
            fullWidth
            variant={isOutOfStock ? "outlined" : "contained"}
            onClick={() => onAdd(product)}
            disabled={isOutOfStock}
            color={isOutOfStock ? "inherit" : "primary"}
            disableElevation
            sx={{
              py: 1,
              fontWeight: 700,
              borderRadius: 1.5,
              textTransform: "none",
              fontSize: "0.875rem",
            }}
          >
            {isOutOfStock ? "Unavailable" : "Add to Cart"}
          </Button>
        </CardActions>
      </Card>
    </Grid>
  );
});

const CashierDashboard = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [searchTerm, setSearchTerm] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");

  // Quantity Dialog State
  const [quantityDialogOpen, setQuantityDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantityInput, setQuantityInput] = useState("");
  const quantityInputRef = useRef(null);

  const addToCart = useCallback((product) => {
    setSelectedProduct(product);
    setQuantityInput("");
    setQuantityDialogOpen(true);
  }, []);

  const fetchProducts = useCallback(
    async (term) => {
      if (!term.trim()) {
        setProducts([]);
        return;
      }
      setLoading(true);
      try {
        const response = await productsApi.getAll(1, 100, term);
        const fetchedProducts = response.products || [];
        setProducts(fetchedProducts);

        // Check if the search term matches any product's barcode exactly
        const exactBarcodeMatch = fetchedProducts.find(
          (p) => p.barcode && p.barcode.trim() === term.trim(),
        );

        if (exactBarcodeMatch) {
          // Auto-open quantity modal for exact barcode match
          addToCart(exactBarcodeMatch);
          // Clear search to prepare for next scan
          setSearchTerm("");
          setProducts([]);
        }
      } catch (err) {
        console.error("Failed to fetch products", err);
      } finally {
        setLoading(false);
      }
    },
    [addToCart],
  );

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl + Backspace to clear cart
      if (e.ctrlKey && e.key === "Backspace") {
        e.preventDefault();
        if (cart.length > 0) {
          setCart([]);
          setStatus({ type: "info", message: "Cart cleared" });
          setTimeout(() => setStatus({ type: "", message: "" }), 2000);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
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

  const handleQuantityDialogClose = useCallback(() => {
    setQuantityDialogOpen(false);
    setQuantityInput("");
    setSelectedProduct(null);
  }, []);

  const handleQuantityConfirm = useCallback(() => {
    const qty = quantityInput === "" ? 1 : parseInt(quantityInput, 10);

    if (isNaN(qty) || qty <= 0) return;

    const existingItem = cart.find((item) => item.id === selectedProduct.id);

    if (existingItem) {
      setCart((prevCart) =>
        prevCart.map((item) =>
          item.id === selectedProduct.id
            ? { ...item, quantity: item.quantity + qty }
            : item,
        ),
      );
    } else {
      setCart((prevCart) => [
        ...prevCart,
        { ...selectedProduct, quantity: qty },
      ]);
    }

    handleQuantityDialogClose();
  }, [cart, quantityInput, selectedProduct, handleQuantityDialogClose]);

  const updateQuantity = useCallback((productId, delta) => {
    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.id === productId) {
          const newQty = Math.max(1, item.quantity + delta);
          return { ...item, quantity: newQty };
        }
        return item;
      }),
    );
  }, []);

  const removeFromCart = useCallback((productId) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== productId));
  }, []);

  const total = cart.reduce(
    (sum, item) => sum + item.selling_price * item.quantity,
    0,
  );

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setProcessing(true);
    setStatus({ type: "", message: "" });

    try {
      const items = cart.map((item) => ({
        product_id: item.id,
        quantity: item.quantity,
      }));
      await billsApi.create({
        items,
        payment_method: paymentMethod,
        idempotency_key: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        business_date: new Date().toISOString().split("T")[0],
      });
      setStatus({
        type: "success",
        message: "Transaction completed successfully",
      });
      setCart([]);
      setPaymentMethod("CASH"); // Reset payment method after checkout
      setTimeout(() => setStatus({ type: "", message: "" }), 3000);
    } catch (err) {
      setStatus({ type: "error", message: err.message || "Checkout failed" });
    } finally {
      setProcessing(false);
    }
  };

  // Removal of client-side filtering logic

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h4"
          fontWeight={700}
          gutterBottom
          sx={{ fontSize: { xs: "1.75rem", sm: "2.125rem" } }}
        >
          Cashier Terminal
        </Typography>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Typography variant="body2" color="text.secondary">
            Select products to add to cart
          </Typography>
          <Button
            variant="outlined"
            color="secondary"
            startIcon={<RemoveIcon />}
            onClick={() => navigate("/cashier/return")}
            sx={{ fontWeight: 700, borderRadius: 2 }}
          >
            Manage Returns
          </Button>
        </Box>
      </Box>

      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", lg: "row" },
          gap: 3,
          alignItems: "flex-start",
        }}
      >
        {/* Product Section */}
        <Box sx={{ flex: 1, minWidth: { xs: "100%", lg: 600 }, width: "100%" }}>
          <Paper
            sx={{
              p: { xs: 2, sm: 3 },
              mb: 3,
              position: { xs: "sticky", sm: "static" },
              top: { xs: 70, sm: "auto" },
              zIndex: 10,
              boxShadow: { xs: 3, sm: 1 },
            }}
          >
            <TextField
              fullWidth
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={(e) => e.target.select()}
              onKeyDown={(e) => {
                if (e.key === "Enter" && searchTerm.trim()) {
                  // Trigger immediate search on Enter (useful for barcode scanners)
                  fetchProducts(searchTerm);
                }
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Paper>

          <Grid container spacing={2}>
            {!searchTerm.trim() ? (
              <Grid item xs={12}>
                <Box sx={{ py: 8, textAlign: "center", opacity: 0.5 }}>
                  <SearchIcon sx={{ fontSize: 48, mb: 2 }} />
                  <Typography variant="body1">
                    Scan barcode or type name to search
                  </Typography>
                </Box>
              </Grid>
            ) : loading ? (
              <Grid item xs={12}>
                <Box sx={{ py: 8, textAlign: "center" }}>
                  <CircularProgress size={32} />
                </Box>
              </Grid>
            ) : products.length === 0 ? (
              <Grid item xs={12}>
                <Box sx={{ py: 8, textAlign: "center", opacity: 0.5 }}>
                  <Typography variant="body1">
                    No products found for "{searchTerm}"
                  </Typography>
                </Box>
              </Grid>
            ) : (
              products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAdd={addToCart}
                />
              ))
            )}
          </Grid>
        </Box>

        {/* Cart Section */}
        <Box
          sx={{
            width: { xs: "100%", lg: 360 },
            position: { xs: "relative", lg: "sticky" },
            top: { lg: 80 },
          }}
        >
          <Paper sx={{ p: { xs: 2, sm: 3 } }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                mb: 3,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <CartIcon color="primary" />
                <Typography variant="h6" fontWeight={700}>
                  Cart ({cart.length})
                </Typography>
              </Box>
              {cart.length > 0 && (
                <Button
                  size="small"
                  color="error"
                  onClick={() => setCart([])}
                  sx={{ minWidth: "auto", textTransform: "none" }}
                >
                  Clear
                </Button>
              )}
            </Box>

            <Divider sx={{ mb: 2 }} />

            {status.message && (
              <Alert severity={status.type} sx={{ mb: 2 }}>
                {status.message}
              </Alert>
            )}

            {cart.length === 0 ? (
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  height: 480,
                  color: "text.secondary",
                }}
              >
                <CartIcon sx={{ fontSize: 64, mb: 2, opacity: 0.1 }} />
                <Typography variant="body1" fontWeight={500}>
                  Cart is empty
                </Typography>
                <Typography variant="caption">
                  Select products to start building a bill
                </Typography>
              </Box>
            ) : (
              <>
                <Box sx={{ maxHeight: 400, overflow: "auto", mb: 3 }}>
                  {cart.map((item) => (
                    <Box
                      key={item.id}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        mb: 2,
                        pb: 2,
                        borderBottom: 1,
                        borderColor: "divider",
                      }}
                    >
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" fontWeight={600}>
                          {item.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          ₹{item.selling_price} each
                        </Typography>
                      </Box>
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        <IconButton
                          size="small"
                          onClick={() => updateQuantity(item.id, -1)}
                        >
                          <RemoveIcon fontSize="small" />
                        </IconButton>
                        <Typography
                          variant="body2"
                          fontWeight={600}
                          sx={{ minWidth: 20, textAlign: "center" }}
                        >
                          {item.quantity}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => updateQuantity(item.id, 1)}
                        >
                          <AddIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => removeFromCart(item.id)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>
                  ))}
                </Box>

                <Divider sx={{ mb: 2 }} />

                <Box sx={{ mb: 3 }}>
                  <Typography
                    variant="subtitle2"
                    fontWeight={600}
                    sx={{ mb: 1.5 }}
                  >
                    Payment Method
                  </Typography>
                  <ToggleButtonGroup
                    value={paymentMethod}
                    exclusive
                    onChange={(e, newMethod) => {
                      if (newMethod !== null) {
                        setPaymentMethod(newMethod);
                      }
                    }}
                    fullWidth
                    size="small"
                  >
                    <ToggleButton value="CASH">
                      <CashIcon sx={{ mr: 1, fontSize: 18 }} />
                      Cash
                    </ToggleButton>
                    <ToggleButton value="UPI">
                      <UpiIcon sx={{ mr: 1, fontSize: 18 }} />
                      UPI
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Box>

                <Divider sx={{ mb: 2 }} />

                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    mb: 3,
                  }}
                >
                  <Typography variant="h6" fontWeight={700}>
                    Total
                  </Typography>
                  <Typography variant="h6" fontWeight={700} color="primary">
                    ₹{total.toFixed(2)}
                  </Typography>
                </Box>

                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  disabled={processing}
                  onClick={handleCheckout}
                  sx={{ py: 1.5 }}
                >
                  {processing ? (
                    <CircularProgress size={24} />
                  ) : (
                    "Complete Checkout"
                  )}
                </Button>
              </>
            )}
          </Paper>
        </Box>
      </Box>

      {/* Quantity Dialog */}
      <Dialog
        open={quantityDialogOpen}
        onClose={handleQuantityDialogClose}
        maxWidth="xs"
        fullWidth
        TransitionProps={{
          onEntered: () => {
            quantityInputRef.current?.focus();
          },
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>{selectedProduct?.name}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Enter quantity to add to cart
          </Typography>
          <TextField
            autoFocus
            fullWidth
            inputRef={quantityInputRef}
            label="Quantity"
            type="text"
            value={quantityInput}
            onChange={(e) => setQuantityInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleQuantityConfirm();
              }
            }}
            inputProps={{
              inputMode: "numeric",
              pattern: "[0-9]*",
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleQuantityDialogClose} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleQuantityConfirm}
            variant="contained"
            disabled={
              quantityInput &&
              (isNaN(parseInt(quantityInput, 10)) ||
                parseInt(quantityInput, 10) <= 0)
            }
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CashierDashboard;
