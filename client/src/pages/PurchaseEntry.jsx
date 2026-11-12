import { useState, useEffect, useRef, useMemo } from "react";
import {
  Box, Typography, TextField, Button, Grid, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Alert, CircularProgress, Divider, InputAdornment, Select,
  MenuItem, FormControl, InputLabel, Dialog, DialogTitle,
  DialogContent, DialogActions, Paper, Chip, Autocomplete,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import SearchIcon from "@mui/icons-material/Search";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import CloseIcon from "@mui/icons-material/Close";
import { useNavigate } from "react-router-dom";
import { productsApi, purchasesApi, suppliersApi, invoiceExtractorApi } from "../api/api";
import InvoiceReconciliationModal from "../components/InvoiceReconciliationModal.jsx";

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
const formatFileSize = (bytes) => {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// ─── styles ───────────────────────────────────────────────────────────────────
const sectionStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  mb: 1.5,
  bgcolor: "#ffffff",
  overflow: "visible",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.025)",
};
const sectionHeaderStyle = {
  px: 1.75,
  py: 1.25,
  bgcolor: "#ffffff",
  borderBottom: "1px solid #eef2f6",
};
const cellStyle = { fontSize: "12px", py: 1, px: 1.25, whiteSpace: "nowrap", borderColor: "#edf1f5" };
const headCellStyle = { ...cellStyle, fontWeight: 700, bgcolor: "#f8fafc", color: "#64748b", fontSize: "11px", letterSpacing: "0.025em" };

// ─── Add Supplier Modal ───────────────────────────────────────────────────────
const AddSupplierModal = ({ open, onClose, onAdded, initialName = "" }) => {
  const [form, setForm] = useState({ name: "", phone: "", gstin: "", address: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm({ name: initialName || "", phone: "", gstin: "", address: "" });
      setError("");
    }
  }, [open, initialName]);

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
const AddProductModal = ({ open, onClose, onAdded, initialName, initialData }) => {
  const [form, setForm] = useState({ product_name: "", selling_price: "", gst_rate: "", hsn_code: "", sale_type: "UNIT" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      if (initialData) {
        setForm({
          product_name: initialData.product_name || "",
          selling_price: initialData.selling_price || "",
          gst_rate: initialData.gst_rate !== undefined ? String(initialData.gst_rate) : "",
          hsn_code: initialData.hsn_code || "",
          sale_type: initialData.sale_type || "UNIT",
        });
      } else {
        setForm({ product_name: initialName || "", selling_price: "", gst_rate: "", hsn_code: "", sale_type: "UNIT" });
      }
      setError("");
    }
  }, [open, initialName, initialData]);

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
                <MenuItem value="40">40%</MenuItem>
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
          border: "1px solid #e2e8f0",
          borderRadius: 2,
          boxShadow: "0 12px 30px rgba(15, 23, 42, 0.12)",
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
                  "&:hover": { bgcolor: "#f8fafc" },
                  "&:last-child": { borderBottom: "none" },
                }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography sx={{ fontSize: "13px", fontWeight: 500 }}>{p.name}</Typography>
                    <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                      <Chip label={`GST ${p.gst_rate ?? 0}%`} size="small" sx={{ fontSize: "10px", height: 18 }} />
                      {p.cost_price !== undefined && p.cost_price !== null && parseFloat(p.cost_price) > 0 && (
                        <Chip
                          label={`Cost: ${fmt(p.cost_price)}`}
                          size="small"
                          variant="outlined"
                          color="info"
                          sx={{ fontSize: "10px", height: 18, fontWeight: 600 }}
                        />
                      )}
                      <Typography sx={{ fontSize: "13px", fontWeight: 600, color: "primary.main" }}>{fmt(p.selling_price)}</Typography>
                    </Box>
                  </Box>
                  <Typography sx={{ fontSize: "11px", color: "text.secondary", mt: 0.2 }}>
                    {p.barcode ? `Barcode: ${p.barcode} · ` : ""}{p.hsn_code ? `HSN: ${p.hsn_code} · ` : ""}{p.cost_price && parseFloat(p.cost_price) > 0 ? `Cost: ${fmt(p.cost_price)} · ` : ""}Stock: {p.stock_qty ?? 0}
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
  const [invoicePdf, setInvoicePdf] = useState(null);
  const [extractingPdf, setExtractingPdf] = useState(false);
  const [extractedInvoiceData, setExtractedInvoiceData] = useState(null);
  const [openReconciliationModal, setOpenReconciliationModal] = useState(false);
  const [quickCreateCallback, setQuickCreateCallback] = useState(null);
  const [productModalInitialData, setProductModalInitialData] = useState(null);
  const [isPdfDragOver, setIsPdfDragOver] = useState(false);
  const pdfInputRef = useRef(null);

  useEffect(() => {
    return () => {
      if (invoicePdf?.url) {
        URL.revokeObjectURL(invoicePdf.url);
      }
    };
  }, [invoicePdf]);

  const handlePdfSelect = (file) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name?.toLowerCase().endsWith(".pdf")) {
      setStatus({ type: "error", message: "Only PDF files are allowed for invoice upload" });
      return;
    }
    const MAX_SIZE = 15 * 1024 * 1024; // 15MB
    if (file.size > MAX_SIZE) {
      setStatus({ type: "error", message: "Invoice PDF must be less than 15MB" });
      return;
    }

    if (invoicePdf?.url) {
      URL.revokeObjectURL(invoicePdf.url);
    }

    const url = URL.createObjectURL(file);
    setInvoicePdf({
      file,
      name: file.name,
      size: file.size,
      formattedSize: formatFileSize(file.size),
      url,
    });
    setStatus({ type: "", message: "" });

    // Send to backend invoice extractor endpoint
    setExtractingPdf(true);
    invoiceExtractorApi.extract(file, supplier?.id)
      .then((extractedData) => {
        console.log("Extracted invoice JSON from backend:", extractedData);
        if (extractedData?.success && extractedData?.data?.items?.length > 0) {
          setExtractedInvoiceData(extractedData);
          setOpenReconciliationModal(true);
        } else {
          setStatus({
            type: "warning",
            message: "No line items could be parsed from this PDF invoice.",
          });
        }
      })
      .catch((err) => {
        console.error("Invoice extraction error:", err);
        setStatus({
          type: "error",
          message: err.message || "Failed to extract invoice from PDF",
        });
      })
      .finally(() => {
        setExtractingPdf(false);
      });
  };

  const handlePdfInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handlePdfSelect(file);
  };

  const handleRemovePdf = (e) => {
    e?.stopPropagation();
    if (invoicePdf?.url) {
      URL.revokeObjectURL(invoicePdf.url);
    }
    setInvoicePdf(null);
    setExtractedInvoiceData(null);
    setOpenReconciliationModal(false);
    if (pdfInputRef.current) {
      pdfInputRef.current.value = "";
    }
  };

  const handleViewPdf = (e) => {
    e?.stopPropagation();
    if (invoicePdf?.url) {
      window.open(invoicePdf.url, "_blank", "noopener,noreferrer");
    }
  };

  const handleReconciliationConfirm = async ({ items: newItems, invoiceNo: newInvNo, invoiceDate: newInvDate, mappingsToSave }) => {
    if (newItems?.length > 0) {
      setItems((prev) => [...prev, ...newItems]);
    }
    if (newInvNo && !invoiceNo) {
      setInvoiceNo(newInvNo);
    }
    if (newInvDate) {
      setInvoiceDate(newInvDate);
    }

    if (supplier?.id && mappingsToSave?.length > 0) {
      try {
        await invoiceExtractorApi.saveMappings(supplier.id, mappingsToSave);
      } catch (err) {
        console.error("Failed to save supplier mappings:", err);
      }
    }

    setStatus({
      type: "success",
      message: `Successfully imported ${newItems.length} item(s) from invoice!`,
    });
  };

  const handleQuickCreateFromReconciliation = (initialData, callback) => {
    setProductModalInitialData(initialData);
    setQuickCreateCallback(() => callback);
    setOpenProductModal(true);
  };

  // Items state
  const [items, setItems] = useState([]);
  const [supplierSearchTerm, setSupplierSearchTerm] = useState("");
  const [supplierOptions, setSupplierOptions] = useState([]);
  const [supplierLoading, setSupplierLoading] = useState(false);
  const [addSupplierName, setAddSupplierName] = useState("");

  // Item form state (always visible, reset after add)
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [itemForm, setItemForm] = useState({
    qty: "1", cost_price: "", mrp: "", expiry_date: "", gst_rate: "0", hsn_code: "",
  });

  // Modals
  const [addProductName, setAddProductName] = useState("");
  const [openSupplierModal, setOpenSupplierModal] = useState(false);
  const [openProductModal, setOpenProductModal] = useState(false);

  useEffect(() => {
    const trimmed = supplierSearchTerm.trim();
    if (!trimmed) {
      setSupplierOptions([]);
      return;
    }

    const t = setTimeout(async () => {
      setSupplierLoading(true);
      try {
        const res = await suppliersApi.getAll(trimmed);
        setSupplierOptions(res || []);
      } catch (err) {
        console.error("Failed to fetch suppliers:", err);
        setSupplierOptions([]);
      } finally {
        setSupplierLoading(false);
      }
    }, 300);

    return () => clearTimeout(t);
  }, [supplierSearchTerm]);

  const handleProductSelect = (product) => {
    setSelectedProduct(product);
    const parsedCost = parseFloat(product.cost_price);
    const parsedMrp = parseFloat(product.mrp);
    setItemForm({
      qty: "1",
      cost_price: !isNaN(parsedCost) && parsedCost > 0 ? String(parsedCost) : "",
      mrp: !isNaN(parsedMrp) && parsedMrp > 0 ? String(parsedMrp) : "",
      expiry_date: "",
      gst_rate: String(parseFloat(product.gst_rate) || 0),
      hsn_code: product.hsn_code || "",
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
      hsn_code: itemForm.hsn_code ? itemForm.hsn_code.trim() : "",
      ...gst,
    }]);

    // Reset item form but keep product selected for fast entry of same product
    setSelectedProduct(null);
    setItemForm({ qty: "1", cost_price: "", mrp: "", expiry_date: "", gst_rate: "0", hsn_code: "" });
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
          hsn_code: i.hsn_code || null,
        })),
      });
      setStatus({ type: "success", message: "Purchase saved successfully!" });
      setSupplier(null); setSupplierSearchTerm(""); setSupplierOptions([]); setInvoiceNo(""); setNotes(""); setItems([]);
      setInvoiceDate(new Date().toISOString().split("T")[0]);
      if (invoicePdf?.url) URL.revokeObjectURL(invoicePdf.url);
      setInvoicePdf(null);
      if (pdfInputRef.current) pdfInputRef.current.value = "";
    } catch (err) {
      setStatus({ type: "error", message: err.message || "Failed to save purchase" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{
      width: "100%", maxWidth: 1600, minWidth: 0, mx: "auto", pb: 4,
      color: "#172033",
      "& .MuiOutlinedInput-root": { borderRadius: "8px", bgcolor: "#fff" },
      "& .MuiInputLabel-root": { fontSize: 13 },
      "& .MuiButton-root": { borderRadius: "8px", textTransform: "none", fontWeight: 650 },
    }}>

      {/* ── Page Header ── */}
      <Box sx={{
        mb: 2, display: "flex", alignItems: "center", gap: 1.25,
        flexWrap: "wrap",
      }}>
        <IconButton
          onClick={() => navigate(-1)} size="small"
          sx={{ border: "1px solid #e2e8f0", borderRadius: "8px", color: "#475569", bgcolor: "#fff" }}
        >
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box>
          <Typography sx={{ fontSize: 23, fontWeight: 750, lineHeight: 1.2, letterSpacing: "-0.035em", color: "#172033" }}>
            Purchase Entry
          </Typography>
          <Typography sx={{ mt: 0.35, fontSize: 12.5, color: "#64748b" }}>
            Record a supplier invoice and update inventory
          </Typography>
        </Box>
        <Box sx={{ ml: "auto", display: "flex", gap: 1, width: { xs: "100%", sm: "auto" }, justifyContent: "flex-end" }}>
          <Button size="small" variant="contained" onClick={handleSave}
            disabled={loading || items.length === 0}
            startIcon={loading && <CircularProgress size={14} color="inherit" />}
            sx={{ px: 2, boxShadow: "none", bgcolor: "#2c3e50", "&:hover": { bgcolor: "#2c3e50", boxShadow: "none" } }}>
            Save Purchase
          </Button>
        </Box>
      </Box>

      {status.message && (
        <Alert severity={status.type} sx={{ mb: 1.5, py: 0.25, borderRadius: 2 }} onClose={() => setStatus({ type: "", message: "" })}>
          {status.message}
        </Alert>
      )}

      <Box sx={{
        display: "grid",
        gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(0, 1fr) 300px" },
        alignItems: "start",
        gap: 1.5,
      }}>
        {/* Main purchase workflow */}
        <Box sx={{ minWidth: 0, display: "flex", flexDirection: "column" }}>

          {/* ── Invoice Details ── */}
          <Box sx={sectionStyle}>
        <Box sx={sectionHeaderStyle}>
          <Typography sx={{ fontSize: 13, fontWeight: 750, color: "#1e293b" }}>Invoice Details</Typography>
        </Box>
        <Box sx={{ p: 1.5 }}>
          <Grid container spacing={1.25} alignItems="center">
            <Grid item xs={12} sm={6} md={5}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0, width: "100%" }}>
                <Autocomplete
                  fullWidth
                  size="small"
                  sx={{ minWidth: 200, "& .MuiOutlinedInput-root": { bgcolor: "#fff" } }}
                  slotProps={{ popper:  { placement: "bottom-start", sx: { minWidth: 340, maxWidth: "calc(100vw - 32px)" } } }}
                  value={supplier}
                  options={supplierSearchTerm.trim() ? supplierOptions : (supplier ? [supplier] : [])}
                  getOptionLabel={(option) => (typeof option === "string" ? option : option?.name || "")}
                  isOptionEqualToValue={(option, val) => option?.id === val?.id}
                  filterOptions={(options, state) => {
                    const input = state.inputValue.trim();
                    if (!input) return [];
                    const filtered = [...options];
                    const hasExact = options.some(
                      (o) => o.name?.toLowerCase() === input.toLowerCase()
                    );
                    if (!hasExact && input) {
                      filtered.push({
                        id: "__ADD_NEW__",
                        name: `+ Add "${input}" as new supplier`,
                        isAddNew: true,
                      });
                    }
                    return filtered;
                  }}
                  onInputChange={(_e, newInputValue, reason) => {
                    if (reason === "input") {
                      setSupplierSearchTerm(newInputValue);
                    } else if (reason === "clear") {
                      setSupplier(null);
                      setSupplierSearchTerm("");
                      setSupplierOptions([]);
                    }
                  }}
                  onChange={(_e, newValue) => {
                    if (newValue?.isAddNew) {
                      setAddSupplierName(supplierSearchTerm.trim());
                      setOpenSupplierModal(true);
                      return;
                    }
                    setSupplier(newValue);
                    setSupplierSearchTerm("");
                  }}
                  loading={supplierLoading}
                  noOptionsText={supplierSearchTerm.trim() ? "No supplier found" : null}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      required
                      label="Supplier"
                      placeholder="Type supplier name..."
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {supplierLoading ? <CircularProgress color="inherit" size={16} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                  renderOption={(props, option) => {
                    const { key, ...restProps } = props;
                    if (option.isAddNew) {
                      return (
                        <Box
                          component="li"
                          key={key}
                          {...restProps}
                          sx={{
                            color: "primary.main",
                            fontWeight: 600,
                            fontSize: "13px",
                            display: "flex",
                            alignItems: "center",
                            gap: 0.5,
                            borderTop: supplierOptions.length > 0 ? "1px solid #eef2f6" : "none",
                            py: 1.1,
                            px: 1.5,
                          }}
                        >
                          <AddIcon sx={{ fontSize: 16 }} />
                          {option.name}
                        </Box>
                      );
                    }
                    return (
                      <Box
                        component="li"
                        key={key}
                        {...restProps}
                        sx={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-start !important",
                          justifyContent: "flex-start",
                          textAlign: "left",
                          py: 1,
                          px: 1.5,
                          width: "100%",
                        }}
                      >
                        <Typography sx={{ fontSize: "13px", fontWeight: 650, color: "#1e293b", lineHeight: 1.35 }}>
                          {option.name}
                        </Typography>
                        {(option.phone || option.gstin) && (
                          <Typography sx={{ fontSize: "11px", color: "#64748b", mt: 0.25, lineHeight: 1.4 }}>
                            {option.phone ? `Phone: ${option.phone}` : ""}
                            {option.phone && option.gstin ? " · " : ""}
                            {option.gstin ? `GSTIN: ${option.gstin}` : ""}
                          </Typography>
                        )}
                      </Box>
                    );
                  }}
                />
                <IconButton
                  size="small"
                  color="primary"
                  title="Add New Supplier"
                  onClick={() => {
                    setAddSupplierName(supplierSearchTerm.trim());
                    setOpenSupplierModal(true);
                  }}
                  sx={{ border: "1px solid #dbe3ec", borderRadius: "8px", p: 0.8, flexShrink: 0, color: "#2563eb", "&:hover": { bgcolor: "#eff6ff", borderColor: "#bfdbfe" } }}
                >
                  <AddIcon fontSize="small" />
                </IconButton>
              </Box>
            </Grid>
            <Grid item xs={12} sm={3} md={3.5}>
              <TextField fullWidth size="small" label="Invoice No" placeholder="Optional"
                value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={3} md={3.5}>
              <TextField fullWidth size="small" required label="Invoice Date" type="date"
                value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)}
                InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={6}>
              <TextField fullWidth size="small" label="Notes" placeholder="Optional"
                value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6} md={6}>
              {!invoicePdf ? (
                <Box
                  onClick={() => pdfInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsPdfDragOver(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setIsPdfDragOver(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsPdfDragOver(false);
                    const file = e.dataTransfer?.files?.[0];
                    if (file) handlePdfSelect(file);
                  }}
                  sx={{
                    height: "40px",
                    border: isPdfDragOver ? "2px dashed #2563eb" : "1px dashed #cbd5e1",
                    borderRadius: "8px",
                    bgcolor: isPdfDragOver ? "#eff6ff" : "#f8fafc",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    px: 1.5,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    "&:hover": {
                      borderColor: "#2563eb",
                      bgcolor: "#f0f7ff",
                    },
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
                    <PictureAsPdfIcon sx={{ fontSize: 18, color: "#dc2626", flexShrink: 0 }} />
                    <Typography
                      sx={{
                        fontSize: "12.5px",
                        fontWeight: 500,
                        color: "#475569",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      Upload Invoice PDF
                    </Typography>
                    <Typography sx={{ fontSize: "11px", color: "#94a3b8", display: { xs: "none", sm: "inline" } }}>
                      (Optional)
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    variant="text"
                    component="span"
                    sx={{
                      fontSize: "11.5px",
                      fontWeight: 650,
                      color: "#2563eb",
                      p: 0,
                      minWidth: "auto",
                      "&:hover": { bgcolor: "transparent", textDecoration: "underline" },
                    }}
                  >
                    Browse
                  </Button>
                  <input
                    ref={pdfInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    style={{ display: "none" }}
                    onChange={handlePdfInputChange}
                  />
                </Box>
              ) : (
                <Box
                  sx={{
                    height: "40px",
                    border: "1px solid #bfdbfe",
                    borderRadius: "8px",
                    bgcolor: "#f0f7ff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    px: 1.25,
                    boxShadow: "0 1px 2px rgba(37, 99, 235, 0.05)",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0, overflow: "hidden" }}>
                    <PictureAsPdfIcon sx={{ fontSize: 18, color: "#dc2626", flexShrink: 0 }} />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography
                        sx={{
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "#1e3a8a",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          maxWidth: { xs: 130, sm: 160, md: 220 },
                        }}
                        title={invoicePdf.name}
                      >
                        {invoicePdf.name}
                      </Typography>
                      <Typography sx={{ fontSize: "10.5px", color: "#64748b", lineHeight: 1 }}>
                        {invoicePdf.formattedSize}
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
                    {extractingPdf && (
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mr: 0.5 }}>
                        <CircularProgress size={13} sx={{ color: "#2563eb" }} />
                        <Typography sx={{ fontSize: "11px", color: "#2563eb", fontWeight: 600 }}>
                          Extracting...
                        </Typography>
                      </Box>
                    )}
                    {extractedInvoiceData?.data?.items?.length > 0 && (
                      <Button
                        size="small"
                        onClick={() => setOpenReconciliationModal(true)}
                        sx={{
                          fontSize: "11.5px",
                          fontWeight: 700,
                          color: "#059669",
                          bgcolor: "#ecfdf5",
                          border: "1px solid #a7f3d0",
                          p: "2px 8px",
                          minWidth: "auto",
                          borderRadius: "4px",
                          "&:hover": { bgcolor: "#d1fae5" },
                        }}
                      >
                        Reconcile ({extractedInvoiceData.data.items.length})
                      </Button>
                    )}
                    <Button
                      size="small"
                      onClick={handleViewPdf}
                      sx={{
                        fontSize: "11.5px",
                        fontWeight: 650,
                        color: "#2563eb",
                        p: "2px 6px",
                        minWidth: "auto",
                        borderRadius: "4px",
                        "&:hover": { bgcolor: "#dbeafe" },
                      }}
                    >
                      View
                    </Button>
                    <IconButton
                      size="small"
                      onClick={handleRemovePdf}
                      title="Remove PDF"
                      sx={{
                        p: "3px",
                        color: "#64748b",
                        "&:hover": { color: "#dc2626", bgcolor: "#fee2e2" },
                      }}
                    >
                      <CloseIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Box>
                </Box>
              )}
            </Grid>
          </Grid>
        </Box>
      </Box>

      {/* ── Add Item Section ── */}
      <Box sx={sectionStyle}>
        <Box sx={sectionHeaderStyle}>
          <Typography sx={{ fontSize: 13, fontWeight: 750, color: "#1e293b" }}>Add Products</Typography>
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
                label={`${selectedProduct.name}${selectedProduct.cost_price && parseFloat(selectedProduct.cost_price) > 0 ? ` (Cost: ${fmt(selectedProduct.cost_price)})` : ""}`}
                onDelete={() => setSelectedProduct(null)}
                color="primary"
                size="small"
              />
            )}
          </Box>

          {/* Item entry row — shown when product is selected */}
          <Box sx={{ minHeight: 70 }}>
            {selectedProduct && (
              <Box sx={{ bgcolor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", p: 1.5 }}>
                <Grid container spacing={1.5} alignItems="flex-end">
                  <Grid item xs={4} sm={2} md={1.5}>
                    <TextField sx={{ width: "80px" }} size="small" label="Qty *" type="number" value={itemForm.qty}
                      onChange={handleFormChange("qty")} inputProps={{ min: "0", step: "1" }} />
                  </Grid>
                  <Grid item xs={6} sm={3} md={2}>
                    <TextField sx={{ width: "150px" }} size="small" label="Cost Price *" type="number" value={itemForm.cost_price}
                      onChange={handleFormChange("cost_price")}
                      InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                      inputProps={{ min: "0", step: "0.01" }} />
                  </Grid>
                  <Grid item xs={6} sm={3} md={1.8}>
                    <TextField sx={{ width: "150px" }} size="small" label="MRP" type="number" value={itemForm.mrp}
                      onChange={handleFormChange("mrp")}
                      InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                      inputProps={{ min: "0", step: "1" }} />
                  </Grid>
                  <Grid item xs={6} sm={2} md={1.8}>
                    <FormControl fullWidth size="small">
                      <InputLabel>GST Rate</InputLabel>
                      <Select value={itemForm.gst_rate} sx={{ minWidth: '100px' }} label="GST Rate" onChange={handleFormChange("gst_rate")}>
                        <MenuItem value="0">0%</MenuItem>
                        <MenuItem value="5">5%</MenuItem>
                        <MenuItem value="12">12%</MenuItem>
                        <MenuItem value="18">18%</MenuItem>
                        <MenuItem value="40">40%</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={6} sm={2} md={1.8}>
                    <TextField sx={{ width: "103px" }} size="small" label="HSN Code" placeholder="HSN" value={itemForm.hsn_code}
                      onChange={handleFormChange("hsn_code")} inputProps={{ maxLength: 8 }} />
                  </Grid>
                  <Grid item xs={6} sm={3} md={2}>
                    <TextField fullWidth size="small" label="Expiry Date" type="date" value={itemForm.expiry_date}
                      onChange={handleFormChange("expiry_date")} InputLabelProps={{ shrink: true }} />
                  </Grid>
                  <Grid item xs={6} sm={2} md={1.1}>
                    <Button fullWidth variant="contained" size="small" onClick={handleAddItem}
                      startIcon={<AddIcon />} sx={{ whiteSpace: "nowrap", height: "40px" }}>
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
        <Box sx={{ ...sectionHeaderStyle, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 750, color: "#1e293b" }}>
            Purchase Items <span style={{ color: "#64748b", fontWeight: 600 }}>({items.length})</span>
          </Typography>
          {items.length > 0 && (
            <Typography variant="caption" color="text.secondary">
              Grand Total: <b style={{ color: "#1976d2" }}>{fmt(grandTotal)}</b>
            </Typography>
          )}
        </Box>
        <TableContainer sx={{ overflowX: "auto", borderRadius: "0 0 10px 10px" }}>
          <Table size="small" sx={{ minWidth: 900 }}>
            <TableHead>
              <TableRow>
                {["#", "Product", "HSN", "Qty", "Cost/Unit", "MRP", "GST%", "Taxable", "CGST", "SGST", "Total", ""].map((h) => (
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
                    <TableCell sx={cellStyle}>{item.hsn_code || "—"}</TableCell>
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
                <Typography sx={{ fontSize: 13, fontWeight: 750, color: "#1e293b" }}>GST Breakdown</Typography>
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
                    <TableRow sx={{ bgcolor: "#f8fafc" }}>
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

        {/* Purchase summary */}
        <Box sx={{ minWidth: 0, width: "100%", position: { lg: "sticky" }, top: { lg: 16 } }}>
          <Box sx={{ ...sectionStyle, mb: 1.5 }}>
            <Box sx={sectionHeaderStyle}>
              <Typography sx={{ fontSize: 13, fontWeight: 750, color: "#1e293b" }}>Purchase Summary</Typography>
            </Box>
            <Box sx={{ p: 1.75 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", mb: 1.5 }}>
                <Typography sx={{ fontSize: 12, color: "#64748b" }}>Items added</Typography>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#172033" }}>{items.length}</Typography>
              </Box>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", mb: 1.1 }}>
                <Typography sx={{ fontSize: 12, color: "#64748b" }}>Total units</Typography>
                <Typography sx={{ fontSize: 13, fontWeight: 650 }}>{items.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0)}</Typography>
              </Box>
              <Divider sx={{ my: 1.5, borderColor: "#edf1f5" }} />
              {[
                ["Taxable amount", fmt(gstBreakup.reduce((s, r) => s + r.taxable, 0))],
                ["CGST", fmt(gstBreakup.reduce((s, r) => s + r.cgst, 0))],
                ["SGST", fmt(gstBreakup.reduce((s, r) => s + r.sgst, 0))],
              ].map(([label, value]) => (
                <Box key={label} sx={{ display: "flex", justifyContent: "space-between", gap: 1, mb: 1.1 }}>
                  <Typography sx={{ fontSize: 12, color: "#64748b" }}>{label}</Typography>
                  <Typography sx={{ fontSize: 12, fontWeight: 600, color: "#334155", fontVariantNumeric: "tabular-nums" }}>{value}</Typography>
                </Box>
              ))}
              <Divider sx={{ my: 1.5, borderColor: "#edf1f5" }} />
              <Box sx={{ bgcolor: "#f8fafc", border: "1px solid #e8eef5", borderRadius: "9px", p: 1.5, mb: 1.5 }}>
                <Typography sx={{ fontSize: 11, color: "#64748b", mb: 0.5 }}>Grand total</Typography>
                <Typography sx={{ fontSize: 24, lineHeight: 1.15, fontWeight: 800, letterSpacing: "-0.035em", color: "#172033", fontVariantNumeric: "tabular-nums" }}>
                  {fmt(grandTotal)}
                </Typography>
                <Typography sx={{ fontSize: 11, color: "#64748b", mt: 0.5 }}>Including GST</Typography>
              </Box>
              <Button fullWidth variant="contained" onClick={handleSave}
                disabled={loading || items.length === 0}
                startIcon={loading && <CircularProgress size={16} color="inherit" />}
                sx={{ py: 1.1, bgcolor: "#2c3e50", boxShadow: "none", "&:hover": { bgcolor: "#2c3e50", boxShadow: "none" } }}>
                Save Purchase
              </Button>
              {items.length === 0 && (
                <Typography sx={{ mt: 1, fontSize: 11, textAlign: "center", color: "#94a3b8" }}>
                  Add products to calculate totals
                </Typography>
              )}
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Modals */}
      <AddSupplierModal
        open={openSupplierModal}
        initialName={addSupplierName}
        onClose={() => setOpenSupplierModal(false)}
        onAdded={(s) => {
          setSupplier(s);
          setSupplierSearchTerm("");
        }}
      />

      <AddProductModal
        open={openProductModal}
        initialName={addProductName}
        initialData={productModalInitialData}
        onClose={() => {
          setOpenProductModal(false);
          setProductModalInitialData(null);
          setQuickCreateCallback(null);
        }}
        onAdded={(p) => {
          if (quickCreateCallback) {
            quickCreateCallback(p);
          } else {
            handleProductSelect(p);
          }
          setOpenProductModal(false);
          setProductModalInitialData(null);
          setQuickCreateCallback(null);
        }}
      />

      {openReconciliationModal && extractedInvoiceData && (
        <InvoiceReconciliationModal
          key={extractedInvoiceData?.data?.metadata?.invoiceNumber || invoicePdf?.name || "reconcile-modal"}
          open={openReconciliationModal}
          onClose={() => setOpenReconciliationModal(false)}
          extractedData={extractedInvoiceData}
          currentSupplier={supplier}
          onConfirm={handleReconciliationConfirm}
          onQuickCreateProduct={handleQuickCreateFromReconciliation}
        />
      )}
    </Box>
  );
};

export default PurchaseEntry;
