import { useState, useEffect, useRef, useMemo } from "react";
import {
  Box, Typography, TextField, Button, Grid, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Alert, CircularProgress, Divider, InputAdornment, Select,
  MenuItem, FormControl, InputLabel, Dialog, DialogTitle,
  DialogContent, DialogActions, Paper, Chip,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import SearchIcon from "@mui/icons-material/Search";
import { useNavigate } from "react-router-dom";
import { productsApi, purchasesApi, suppliersApi } from "../api/api";

// ─── helpers ─────────────────────────────────────────────────────────────────
const calcGST = (costPrice, qty, gstRate) => {
  const rate = parseFloat(gstRate) || 0;
  const total = parseFloat(costPrice) * parseFloat(qty);
  if (rate === 0) return { taxable: total, cgst: 0, sgst: 0, total };
  const taxable = total / (1 + rate / 100);
  const gstAmt = total - taxable;
  return {
    taxable: parseFloat(taxable.toFixed(2)),
    cgst: parseFloat((gstAmt / 2).toFixed(2)),
    sgst: parseFloat((gstAmt / 2).toFixed(2)),
    total: parseFloat(total.toFixed(2)),
  };
};
const fmt = (n) => `₹${parseFloat(n || 0).toFixed(2)}`;

// ─── styles ───────────────────────────────────────────────────────────────────
const sectionStyle = {
  border: "1px solid #e0e0e0",
  borderRadius: 1,
  mb: 1.5,
  bgcolor: "white",
};
const sectionHeaderStyle = {
  px: 2, py: 1,
  bgcolor: "#e0dfdfff",
  borderBottom: "1px solid #e0e0e0",
  borderRadius: "4px 4px 0 0",
};
const cellStyle = { fontSize: "12px", py: 0.8, px: 1.5, whiteSpace: "nowrap" };
const headCellStyle = { ...cellStyle, fontWeight: 700, bgcolor: "#f5f5f5", color: "#333" };

// ─── Add Supplier Modal ───────────────────────────────────────────────────────
const AddSupplierModal = ({ open, onClose, onAdded }) => {
  const [form, setForm] = useState({ name: "", phone: "", gstin: "", address: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!form.name.trim()) return setError("Supplier name is required");
    setLoading(true);
    setError("");
    try {
      const result = await suppliersApi.create(form);
      onAdded(result);
      setForm({ name: "", phone: "", gstin: "", address: "" });
      onClose();
    } catch (err) {
      setError(err.message || "Failed to add supplier");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, fontSize: "16px", py: 1.5 }}>Add New Supplier</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Grid container spacing={2} sx={{ mt: 0.2 }}>
          <Grid item xs={12}>
            <TextField fullWidth size="small" label="Supplier Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Grid>
          <Grid item xs={6}>
            <TextField fullWidth size="small" label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Grid>
          <Grid item xs={6}>
            <TextField fullWidth size="small" label="GSTIN" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} inputProps={{ maxLength: 15 }} />
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth size="small" label="Address" multiline rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 2, py: 1.5 }}>
        <Button size="small" onClick={onClose} color="inherit" disabled={loading}>Cancel</Button>
        <Button size="small" variant="contained" onClick={handleSave} disabled={loading}>
          {loading ? <CircularProgress size={16} color="inherit" /> : "Add Supplier"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── Add Product Modal ────────────────────────────────────────────────────────
const AddProductModal = ({ open, onClose, onAdded, initialName }) => {
  const [form, setForm] = useState({ product_name: "", selling_price: "", gst_rate: "", hsn_code: "", sale_type: "UNIT" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) setForm((f) => ({ ...f, product_name: initialName || "" }));
  }, [open, initialName]);

  const handleSave = async () => {
    if (!form.product_name.trim() || !form.selling_price || form.gst_rate === "") {
      return setError("Name, Selling Price and GST Rate are required");
    }
    setLoading(true);
    setError("");
    try {
      const result = await productsApi.create({
        ...form,
        selling_price: parseFloat(form.selling_price),
        gst_rate: parseFloat(form.gst_rate),
      });
      onAdded(result);
      setForm({ product_name: "", selling_price: "", gst_rate: "", hsn_code: "", sale_type: "UNIT" });
      onClose();
    } catch (err) {
      setError(err.message || "Failed to add product");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, fontSize: "16px", py: 1.5 }}>Add New Product</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Grid container spacing={2} sx={{ mt: 0.2 }}>
          <Grid item xs={12}>
            <TextField fullWidth size="small" label="Product Name *" value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} />
          </Grid>
          <Grid item xs={6}>
            <TextField fullWidth size="small" label="Selling Price *" type="number" value={form.selling_price}
              onChange={(e) => setForm({ ...form, selling_price: e.target.value })}
              InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
              inputProps={{ min: 0, step: "0.01" }} />
          </Grid>
          <Grid item xs={6}>
            <FormControl fullWidth size="small">
              <InputLabel>GST Rate *</InputLabel>
              <Select value={form.gst_rate} sx={{ minWidth: '100px' }} label="GST Rate *" onChange={(e) => setForm({ ...form, gst_rate: e.target.value })}>
                <MenuItem value="" disabled>Select</MenuItem>
                <MenuItem value="0">0%</MenuItem>
                <MenuItem value="5">5%</MenuItem>
                <MenuItem value="12">12%</MenuItem>
                <MenuItem value="18">18%</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6}>
            <TextField fullWidth size="small" label="HSN Code" value={form.hsn_code} onChange={(e) => setForm({ ...form, hsn_code: e.target.value })} inputProps={{ maxLength: 8 }} />
          </Grid>
          <Grid item xs={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Sale Type</InputLabel>
              <Select value={form.sale_type} label="Sale Type" onChange={(e) => setForm({ ...form, sale_type: e.target.value })}>
                <MenuItem value="UNIT">UNIT</MenuItem>
                <MenuItem value="WEIGHT">WEIGHT</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 2, py: 1.5 }}>
        <Button size="small" onClick={onClose} color="inherit" disabled={loading}>Cancel</Button>
        <Button size="small" variant="contained" onClick={handleSave} disabled={loading}>
          {loading ? <CircularProgress size={16} color="inherit" /> : "Add Product"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── Product Search Dropdown ──────────────────────────────────────────────────
const ProductSearch = ({ onSelect, onAddNew }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!query.trim()) { setResults([]); setOpen(false); return; }
      setLoading(true);
      try {
        const res = await productsApi.getAll(1, 20, query);
        setResults(res.products || []);
        setOpen(true);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const handleSelect = (product) => {
    onSelect(product);
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  return (
    <Box ref={wrapperRef} sx={{ position: "relative", flex: 1 }}>
      <TextField
        inputRef={inputRef}
        fullWidth
        size="small"
        placeholder="Search product by name to add..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              {loading ? <CircularProgress size={14} /> : <SearchIcon sx={{ fontSize: 18, color: "text.secondary" }} />}
            </InputAdornment>
          ),
        }}
      />
      {open && (
        <Paper elevation={4} sx={{
          position: "absolute", top: "100%", left: 0, right: 0,
          zIndex: 1300, maxHeight: 280, overflowY: "auto", mt: 0.5,
          border: "1px solid #ddd",
        }}>
          {results.length === 0 ? (
            <Box sx={{ p: 1.5 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontSize: "13px" }}>
                No products found for "{query}"
              </Typography>
              <Button size="small" variant="outlined" startIcon={<AddIcon />}
                onClick={() => { onAddNew(query); setOpen(false); setQuery(""); }}>
                Add "{query}" as new product
              </Button>
            </Box>
          ) : (
            <>
              {results.map((p) => (
                <Box key={p.id} onClick={() => handleSelect(p)} sx={{
                  px: 2, py: 1, cursor: "pointer",
                  borderBottom: "1px solid #f0f0f0",
                  "&:hover": { bgcolor: "#f5f5f5" },
                  "&:last-child": { borderBottom: "none" },
                }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography sx={{ fontSize: "13px", fontWeight: 500 }}>{p.name}</Typography>
                    <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                      <Chip label={`GST ${p.gst_rate ?? 0}%`} size="small" sx={{ fontSize: "10px", height: 18 }} />
                      <Typography sx={{ fontSize: "13px", fontWeight: 600, color: "primary.main" }}>{fmt(p.selling_price)}</Typography>
                    </Box>
                  </Box>
                  <Typography sx={{ fontSize: "11px", color: "text.secondary", mt: 0.2 }}>
                    {p.barcode ? `Barcode: ${p.barcode} · ` : ""}Stock: {p.stock_qty ?? 0}
                  </Typography>
                </Box>
              ))}
              <Box onClick={() => { onAddNew(query); setOpen(false); setQuery(""); }}
                sx={{ px: 2, py: 1, cursor: "pointer", color: "primary.main", fontSize: "13px",
                  fontWeight: 600, display: "flex", alignItems: "center", gap: 0.5,
                  borderTop: "1px solid #eee", "&:hover": { bgcolor: "#f0f7ff" } }}>
                <AddIcon fontSize="small" /> Add New Product
              </Box>
            </>
          )}
        </Paper>
      )}
    </Box>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const PurchaseEntry = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });

  // Header state
  const [supplier, setSupplier] = useState(null);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  // Items state
  const [items, setItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  // Item form state (always visible, reset after add)
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [itemForm, setItemForm] = useState({
    qty: "1", cost_price: "", mrp: "", expiry_date: "", gst_rate: "0",
  });

  // Modals
  const [addProductName, setAddProductName] = useState("");
  const [openSupplierModal, setOpenSupplierModal] = useState(false);
  const [openProductModal, setOpenProductModal] = useState(false);

  useEffect(() => {
    suppliersApi.getAll()
      .then((res) => setSuppliers(res || []))
      .catch(console.error);
  }, []);

  const handleProductSelect = (product) => {
    setSelectedProduct(product);
    setItemForm({
      qty: "1",
      cost_price: "",
      mrp: "",
      expiry_date: "",
      gst_rate: String(parseFloat(product.gst_rate) || 0),
    });
  };

  const handleFormChange = (field) => (e) => setItemForm((f) => ({ ...f, [field]: e.target.value }));

  // live preview
  const gstPreview = useMemo(() => {
    if (!selectedProduct || !itemForm.cost_price || !itemForm.qty) return null;
    return calcGST(itemForm.cost_price, itemForm.qty, itemForm.gst_rate);
  }, [selectedProduct, itemForm.cost_price, itemForm.qty, itemForm.gst_rate]);

  const handleAddItem = () => {
    if (!selectedProduct) return setStatus({ type: "error", message: "Please select a product first" });
    if (!itemForm.qty || !itemForm.cost_price) return setStatus({ type: "error", message: "Qty and Cost Price are required" });

    const gst = calcGST(itemForm.cost_price, itemForm.qty, itemForm.gst_rate);
    setItems((prev) => [...prev, {
      id: Date.now().toString(),
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      expiry_date: itemForm.expiry_date || null,
      qty: parseFloat(itemForm.qty),
      cost_price: parseFloat(itemForm.cost_price),
      mrp: parseFloat(itemForm.mrp) || 0,
      gst_rate: parseFloat(itemForm.gst_rate),
      ...gst,
    }]);

    // Reset item form but keep product selected for fast entry of same product
    setSelectedProduct(null);
    setItemForm({ qty: "1", cost_price: "", mrp: "", expiry_date: "", gst_rate: "0" });
    setStatus({ type: "", message: "" });
  };

  const handleDeleteItem = (id) => setItems((prev) => prev.filter((i) => i.id !== id));

  const grandTotal = useMemo(() => items.reduce((s, i) => s + i.total, 0), [items]);

  const gstBreakup = useMemo(() => {
    const map = {};
    items.forEach((item) => {
      const r = item.gst_rate;
      if (!map[r]) map[r] = { rate: r, taxable: 0, cgst: 0, sgst: 0, total: 0 };
      map[r].taxable += item.taxable;
      map[r].cgst += item.cgst;
      map[r].sgst += item.sgst;
      map[r].total += item.total;
    });
    return Object.values(map).sort((a, b) => a.rate - b.rate);
  }, [items]);

  const handleSave = async () => {
    if (!supplier) return setStatus({ type: "error", message: "Please select a supplier" });
    if (!invoiceDate) return setStatus({ type: "error", message: "Invoice date is required" });
    if (items.length === 0) return setStatus({ type: "error", message: "Add at least one item" });

    setLoading(true);
    setStatus({ type: "", message: "" });
    try {
      await purchasesApi.create({
        supplier_id: supplier.id,
        invoice_no: invoiceNo || null,
        invoice_date: invoiceDate,
        notes: notes || null,
        items: items.map((i) => ({
          product_id: i.product_id,
          expiry_date: i.expiry_date,
          qty: i.qty,
          cost_price: i.cost_price,
          mrp: i.mrp,
          gst_rate: i.gst_rate,
        })),
      });
      setStatus({ type: "success", message: "Purchase saved successfully!" });
      setSupplier(null); setInvoiceNo(""); setNotes(""); setItems([]);
      setInvoiceDate(new Date().toISOString().split("T")[0]);
    } catch (err) {
      setStatus({ type: "error", message: err.message || "Failed to save purchase" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", pb: 4, minWidth: 1200 }}>

      {/* ── Page Header ── */}
      <Box sx={{ mb: 2, display: "flex", alignItems: "center", gap: 1.5 }}>
        <IconButton onClick={() => navigate(-1)} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box>
          <Typography variant="h5" fontWeight={700} lineHeight={1.2}>Purchase Entry</Typography>
          <Typography variant="caption" color="text.secondary">Record a new purchase from a supplier</Typography>
        </Box>
        <Box sx={{ ml: "auto", display: "flex", gap: 1 }}>
          <Button size="small" variant="outlined" onClick={() => navigate(-1)}>Cancel</Button>
          <Button
            size="small" variant="contained"
            onClick={handleSave} disabled={loading || items.length === 0}
            startIcon={loading && <CircularProgress size={14} color="inherit" />}
          >
            Save Purchase
          </Button>
        </Box>
      </Box>

      {status.message && (
        <Alert severity={status.type} sx={{ mb: 1.5, py: 0.5 }} onClose={() => setStatus({ type: "", message: "" })}>
          {status.message}
        </Alert>
      )}

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
        {/* Left Column 70% */}
        <Box sx={{ width: { xs: '100%', md: '70%' }, display: 'flex', flexDirection: 'column' }}>

          {/* ── Invoice Details ── */}
          <Box sx={sectionStyle}>
        <Box sx={sectionHeaderStyle}>
          <Typography variant="subtitle2" fontWeight={700}>Invoice Details</Typography>
        </Box>
        <Box sx={{ p: 1.5 }}>
          <Grid container spacing={1.5} alignItems="center">
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small" required>
                <InputLabel>Supplier</InputLabel>
                <Select
                  value={supplier?.id ?? ""}
                  label="Supplier"
                  sx={{ minWidth: '200px' }}
                  onChange={(e) => {
                    if (e.target.value === "ADD_NEW") { setOpenSupplierModal(true); return; }
                    setSupplier(suppliers.find((s) => s.id === e.target.value) || null);
                  }}
                >
                  <MenuItem value="" disabled>Select Supplier</MenuItem>
                  {suppliers.map((s) => (
                    <MenuItem key={s.id} value={s.id} sx={{ fontSize: "13px" }}>
                      {s.name}{s.phone ? ` (${s.phone})` : ""}
                    </MenuItem>
                  ))}
                  <MenuItem value="ADD_NEW" sx={{ color: "primary.main", fontWeight: 600, fontSize: "13px" }}>
                    <AddIcon sx={{ fontSize: 14, mr: 0.5 }} /> Add New Supplier
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField fullWidth size="small" label="Invoice No" placeholder="Optional"
                value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField fullWidth size="small" required label="Invoice Date" type="date"
                value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)}
                InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={2}>
              <TextField fullWidth size="small" label="Notes" placeholder="Optional"
                value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Grid>
          </Grid>
        </Box>
      </Box>

      {/* ── Add Item Section ── */}
      <Box sx={sectionStyle}>
        <Box sx={sectionHeaderStyle}>
          <Typography variant="subtitle2" fontWeight={700}>Add Item</Typography>
        </Box>
        <Box sx={{ p: 1.5 }}>
          {/* Product search row */}
          <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", mb: selectedProduct ? 1.5 : 0 }}>
            <ProductSearch
              onSelect={handleProductSelect}
              onAddNew={(name) => { setAddProductName(name); setOpenProductModal(true); }}
            />
            {selectedProduct && (
              <Chip
                label={selectedProduct.name}
                onDelete={() => setSelectedProduct(null)}
                color="primary"
                size="small"
              />
            )}
          </Box>

          {/* Item entry row — shown when product is selected */}
          <Box sx={{ minHeight: 70 }}>
            {selectedProduct && (
              <Box sx={{ bgcolor: "#fafafa", border: "1px solid #e8e8e8", borderRadius: 1, p: 1.5 }}>
                <Grid container spacing={1.5} alignItems="flex-end">
                  <Grid item xs={4} sm={3} md={2}>
                    <TextField sx={{ width: '80px' }} size="small" label="Qty *" type="number" value={itemForm.qty}
                      onChange={handleFormChange("qty")} inputProps={{ min: "0.01", step: "0.01" }} />
                  </Grid>
                  <Grid item xs={6} sm={4} md={2}>
                    <TextField sx={{ width: '120px' }} size="small" label="Cost Price *" type="number" value={itemForm.cost_price}
                      onChange={handleFormChange("cost_price")}
                      InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                      inputProps={{ min: "0", step: "0.01" }} />
                  </Grid>
                  <Grid item xs={6} sm={4} md={2}>
                    <TextField sx={{ width: '120px' }} size="small" label="MRP" type="number" value={itemForm.mrp}
                      onChange={handleFormChange("mrp")}
                      InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                      inputProps={{ min: "0", step: "0.01" }} />
                  </Grid>
                  <Grid item xs={6} sm={4} md={2}>
                    <FormControl fullWidth size="small">
                      <InputLabel>GST Rate</InputLabel>
                      <Select value={itemForm.gst_rate} sx={{ minWidth: '100px' }} label="GST Rate" onChange={handleFormChange("gst_rate")}>
                        <MenuItem value="0">0%</MenuItem>
                        <MenuItem value="5">5%</MenuItem>
                        <MenuItem value="12">12%</MenuItem>
                        <MenuItem value="18">18%</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={6} sm={4} md={2}>
                    <TextField fullWidth size="small" label="Expiry Date" type="date" value={itemForm.expiry_date}
                      onChange={handleFormChange("expiry_date")} InputLabelProps={{ shrink: true }} />
                  </Grid>
                  <Grid item xs={12} md={1}>
                    <Button fullWidth variant="contained" size="small" onClick={handleAddItem}
                      startIcon={<AddIcon />} sx={{ whiteSpace: "nowrap" }}>
                      Add
                    </Button>
                  </Grid>
                </Grid>

                {/* Live GST Preview */}
                {gstPreview && (
                  <Box sx={{ mt: 1, display: "flex", gap: 2, flexWrap: "wrap" }}>
                    <Typography variant="caption" color="text.secondary">
                      Taxable: <b>{fmt(gstPreview.taxable)}</b>
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      CGST: <b>{fmt(gstPreview.cgst)}</b>
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      SGST: <b>{fmt(gstPreview.sgst)}</b>
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Total: <b style={{ color: "#1976d2" }}>{fmt(gstPreview.total)}</b>
                    </Typography>
                  </Box>
                )}
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      {/* ── Items Table ── */}
      <Box sx={sectionStyle}>
        <Box sx={{ ...sectionHeaderStyle, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="subtitle2" fontWeight={700}>
            Items {items.length > 0 && <span style={{ color: "#1976d2" }}>({items.length})</span>}
          </Typography>
          {items.length > 0 && (
            <Typography variant="caption" color="text.secondary">
              Grand Total: <b style={{ color: "#1976d2" }}>{fmt(grandTotal)}</b>
            </Typography>
          )}
        </Box>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                {["#", "Product", "Qty", "Cost/Unit", "MRP", "GST%", "Taxable", "CGST", "SGST", "Total", ""].map((h) => (
                  <TableCell key={h} sx={headCellStyle}
                    align={["Qty", "Cost/Unit", "MRP", "GST%", "Taxable", "CGST", "SGST", "Total"].includes(h) ? "right" : "left"}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} align="center" sx={{ py: 3, color: "text.secondary", fontSize: "13px" }}>
                    No items added yet. Search for a product above to add items.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item, idx) => (
                  <TableRow key={item.id} sx={{ "&:hover": { bgcolor: "#fafafa" } }}>
                    <TableCell sx={cellStyle}>{idx + 1}</TableCell>
                    <TableCell sx={{ ...cellStyle, fontWeight: 500 }}>{item.product_name}</TableCell>
                    <TableCell sx={cellStyle} align="right">{item.qty}</TableCell>
                    <TableCell sx={cellStyle} align="right">{fmt(item.cost_price)}</TableCell>
                    <TableCell sx={cellStyle} align="right">{item.mrp ? fmt(item.mrp) : "—"}</TableCell>
                    <TableCell sx={cellStyle} align="right">{item.gst_rate}%</TableCell>
                    <TableCell sx={cellStyle} align="right">{fmt(item.taxable)}</TableCell>
                    <TableCell sx={cellStyle} align="right">{fmt(item.cgst)}</TableCell>
                    <TableCell sx={cellStyle} align="right">{fmt(item.sgst)}</TableCell>
                    <TableCell sx={{ ...cellStyle, fontWeight: 700 }} align="right">{fmt(item.total)}</TableCell>
                    <TableCell sx={cellStyle} align="center">
                      <IconButton size="small" color="error" onClick={() => handleDeleteItem(item.id)}>
                        <DeleteIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* ── Bottom: GST Breakup ── */}
      {items.length > 0 && (
            <Box sx={sectionStyle}>
              <Box sx={sectionHeaderStyle}>
                <Typography variant="subtitle2" fontWeight={700}>GST Breakup</Typography>
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {["Rate", "Taxable Amt", "CGST", "SGST", "Total"].map((h) => (
                        <TableCell key={h} sx={headCellStyle} align={h === "Rate" ? "left" : "right"}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {gstBreakup.map((s) => (
                      <TableRow key={s.rate}>
                        <TableCell sx={cellStyle}>{s.rate}%</TableCell>
                        <TableCell sx={cellStyle} align="right">{fmt(s.taxable)}</TableCell>
                        <TableCell sx={cellStyle} align="right">{fmt(s.cgst)}</TableCell>
                        <TableCell sx={cellStyle} align="right">{fmt(s.sgst)}</TableCell>
                        <TableCell sx={{ ...cellStyle, fontWeight: 600 }} align="right">{fmt(s.total)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow sx={{ bgcolor: "#f5f5f5" }}>
                      <TableCell sx={{ ...cellStyle, fontWeight: 700 }}>Total</TableCell>
                      <TableCell sx={{ ...cellStyle, fontWeight: 700 }} align="right">{fmt(gstBreakup.reduce((s, r) => s + r.taxable, 0))}</TableCell>
                      <TableCell sx={{ ...cellStyle, fontWeight: 700 }} align="right">{fmt(gstBreakup.reduce((s, r) => s + r.cgst, 0))}</TableCell>
                      <TableCell sx={{ ...cellStyle, fontWeight: 700 }} align="right">{fmt(gstBreakup.reduce((s, r) => s + r.sgst, 0))}</TableCell>
                      <TableCell sx={{ ...cellStyle, fontWeight: 700 }} align="right">{fmt(grandTotal)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
      )}
        </Box>

        {/* Right Column 30% */}
        <Box sx={{ width: { xs: '100%', md: '30%' } }}>
          {items.length > 0 && (
            <Box sx={{ ...sectionStyle, mb: 0 }}>
              <Box sx={sectionHeaderStyle}>
                <Typography variant="subtitle2" fontWeight={700}>Summary</Typography>
              </Box>
              <Box sx={{ p: 2 }}>
                {[
                  ["Total Items", items.length],
                  ["Total Taxable", fmt(gstBreakup.reduce((s, r) => s + r.taxable, 0))],
                  ["Total CGST", fmt(gstBreakup.reduce((s, r) => s + r.cgst, 0))],
                  ["Total SGST", fmt(gstBreakup.reduce((s, r) => s + r.sgst, 0))],
                ].map(([label, value]) => (
                  <Box key={label} sx={{ display: "flex", justifyContent: "space-between", mb: 0.8 }}>
                    <Typography variant="body2" color="text.secondary" fontSize="13px">{label}</Typography>
                    <Typography variant="body2" fontWeight={600} fontSize="13px">{value}</Typography>
                  </Box>
                ))}
                <Divider sx={{ my: 1.5 }} />
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
                  <Typography fontWeight={700}>Grand Total</Typography>
                  <Typography fontWeight={700} color="primary.main" fontSize="18px">{fmt(grandTotal)}</Typography>
                </Box>
                <Button fullWidth variant="contained" size="medium" onClick={handleSave}
                  disabled={loading || items.length === 0}
                  startIcon={loading && <CircularProgress size={16} color="inherit" />}>
                  Save Purchase
                </Button>
              </Box>
            </Box>
          )}
        </Box>
      </Box>

      {/* Modals */}
      <AddSupplierModal open={openSupplierModal} onClose={() => setOpenSupplierModal(false)}
        onAdded={(s) => { setSuppliers((prev) => [s, ...prev]); setSupplier(s); }} />
      <AddProductModal open={openProductModal} initialName={addProductName}
        onClose={() => setOpenProductModal(false)}
        onAdded={(p) => { handleProductSelect(p); setOpenProductModal(false); }} />
    </Box>
  );
};

export default PurchaseEntry;
