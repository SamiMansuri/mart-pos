import { useState, useEffect, useMemo, useRef } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Select,
  MenuItem,
  FormControl,
  Checkbox,
  Chip,
  Autocomplete,
  CircularProgress,
  Tooltip,
  Paper,
  Divider,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import { productsApi } from "../api/api";

const fmt = (n) => `₹${parseFloat(n || 0).toFixed(2)}`;

const calcLineGST = (costPrice, qty, gstRate) => {
  const rate = parseFloat(gstRate) || 0;
  const total = (parseFloat(costPrice) || 0) * (parseFloat(qty) || 0);
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

function parseInvoiceDate(dateStr) {
  if (!dateStr) return "";
  // Check DD/MM/YYYY or DD-MM-YYYY format
  const dmyMatch = dateStr.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, "0");
    const month = dmyMatch[2].padStart(2, "0");
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }
  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  return "";
}

/**
 * Product selector for a reconciliation row with remote search capability
 */
function RowProductSearch({ value, onChange, placeholder = "Search product name or barcode..." }) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!query.trim()) {
      setOptions([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await productsApi.getAll(1, 20, query.trim());
        setOptions(res.products || []);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  return (
    <Autocomplete
      size="small"
      fullWidth
      value={value || null}
      options={options}
      getOptionLabel={(option) => option?.name || ""}
      isOptionEqualToValue={(option, val) => option?.id === val?.id}
      filterOptions={(x) => x} // backend filtering
      onInputChange={(_e, newInputValue, reason) => {
        if (reason === "input") setQuery(newInputValue);
      }}
      onChange={(_e, newValue) => {
        onChange(newValue);
      }}
      loading={loading}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder={placeholder}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={14} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
          sx={{
            "& .MuiOutlinedInput-root": {
              fontSize: "12px",
              py: "2px",
              bgcolor: "#fff",
            },
          }}
        />
      )}
      renderOption={(props, option) => {
        const { key, ...rest } = props;
        return (
          <Box component="li" key={key} {...rest} sx={{ py: 0.75, px: 1.5, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
              <Typography sx={{ fontSize: "12.5px", fontWeight: 600, color: "#1e293b" }}>
                {option.name}
              </Typography>
              <Typography sx={{ fontSize: "12px", fontWeight: 700, color: "primary.main" }}>
                {fmt(option.selling_price)}
              </Typography>
            </Box>
            <Typography sx={{ fontSize: "11px", color: "#64748b" }}>
              {option.barcode ? `Barcode: ${option.barcode} · ` : ""}
              {option.hsn_code ? `HSN: ${option.hsn_code} · ` : ""}
              GST: {option.gst_rate ?? 0}%
            </Typography>
          </Box>
        );
      }}
    />
  );
}

function formatExtractedRows(extractedData) {
  if (!extractedData?.data?.items) return [];

  const items = extractedData.data.items || [];
  return items.map((item, idx) => {
    const initialProduct = item.matchedProduct || null;
    const initialMatchType = item.matchType || (initialProduct ? "exact_supplier_mapping" : "unmatched");

    // Determine extracted rate (prefer netRate, then grossRate, then costPrice)
    const cost = item.netRate || item.grossRate || item.costPrice || item.cost_price || 0;
    const mrp = item.mrp || (initialProduct ? initialProduct.selling_price : 0) || 0;
    const qty = item.quantity !== undefined && item.quantity !== null && item.quantity > 0 ? item.quantity : 1;

    // Calculate extracted GST rate
    let extractedGst = "0";
    if (item.cgstRate !== undefined && item.sgstRate !== undefined) {
      extractedGst = String((parseFloat(item.cgstRate) || 0) + (parseFloat(item.sgstRate) || 0) + (parseFloat(item.igstRate) || 0));
    } else if (item.gst_rate !== undefined) {
      extractedGst = String(parseFloat(item.gst_rate) || 0);
    } else if (initialProduct?.gst_rate !== undefined) {
      extractedGst = String(parseFloat(initialProduct.gst_rate) || 0);
    }

    return {
      id: `row-${idx}`,
      rawIndex: idx,
      included: item.quantity !== 0, // Exclude 0-qty promotional samples by default
      vendorDescription: item.description || item.product_name || `Item ${idx + 1}`,
      vendorHsn: item.hsnCode || item.hsn_code || "",
      vendorMrp: item.mrp || 0,
      vendorQty: item.quantity || 0,
      vendorCost: cost,
      selectedProduct: initialProduct,
      matchType: initialMatchType,
      confidence: item.confidence || (initialProduct ? 1.0 : 0),
      suggestions: item.suggestions || [],
      isEditingProduct: !initialProduct && (!item.suggestions || item.suggestions.length === 0),
      qty: String(qty),
      costPrice: String(cost ? parseFloat(cost).toFixed(2) : ""),
      mrp: String(mrp ? parseFloat(mrp).toFixed(2) : ""),
      gstRate: extractedGst,
      hsnCode: item.hsnCode || (initialProduct?.hsn_code) || "",
      rememberMapping: true,
    };
  });
}

export default function InvoiceReconciliationModal({
  open,
  onClose,
  extractedData,
  currentSupplier,
  onConfirm,
  onQuickCreateProduct,
}) {
  const [rows, setRows] = useState(() => formatExtractedRows(extractedData));
  const [useExtractedInvoiceInfo, setUseExtractedInvoiceInfo] = useState(true);

  // Summary counts
  const stats = useMemo(() => {
    let matched = 0;
    let suggested = 0;
    let unmatched = 0;
    let totalTaxable = 0;
    let totalGst = 0;
    let grandTotal = 0;
    let includedCount = 0;

    for (const r of rows) {
      if (!r.included) continue;
      includedCount++;

      if (r.selectedProduct) {
        if (r.matchType === "suggested_name" || r.matchType === "hsn_mrp") {
          suggested++;
        } else {
          matched++;
        }
      } else {
        unmatched++;
      }

      const calc = calcLineGST(r.costPrice, r.qty, r.gstRate);
      totalTaxable += calc.taxable;
      totalGst += calc.cgst + calc.sgst;
      grandTotal += calc.total;
    }

    return {
      matched,
      suggested,
      unmatched,
      totalTaxable,
      totalGst,
      grandTotal,
      includedCount,
      allMatched: unmatched === 0 && includedCount > 0,
    };
  }, [rows]);

  const handleRowChange = (id, field, value) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        return { ...r, [field]: value };
      })
    );
  };

  const handleSelectProductForRow = (id, product) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        if (!product) {
          return {
            ...r,
            selectedProduct: null,
            matchType: "unmatched",
            confidence: 0,
            isEditingProduct: true,
          };
        }
        return {
          ...r,
          selectedProduct: product,
          matchType: "exact_supplier_mapping",
          confidence: 1.0,
          isEditingProduct: false,
          mrp: r.mrp || (product.selling_price ? String(product.selling_price) : ""),
          gstRate: product.gst_rate !== undefined && product.gst_rate !== null ? String(product.gst_rate) : r.gstRate,
          hsnCode: product.hsn_code || r.hsnCode,
          rememberMapping: true,
        };
      })
    );
  };

  // 1-click action: accept top suggestions for all suggested items
  const handleAcceptAllSuggestions = () => {
    setRows((prev) =>
      prev.map((r) => {
        if (!r.selectedProduct && r.suggestions && r.suggestions.length > 0) {
          const top = r.suggestions[0];
          return {
            ...r,
            selectedProduct: top,
            matchType: "suggested_name",
            confidence: 0.85,
            isEditingProduct: false,
            mrp: r.mrp || (top.selling_price ? String(top.selling_price) : ""),
            gstRate: top.gst_rate !== undefined && top.gst_rate !== null ? String(top.gst_rate) : r.gstRate,
            hsnCode: top.hsn_code || r.hsnCode,
          };
        }
        return r;
      })
    );
  };

  const handleToggleSelectAll = () => {
    const anyUnselected = rows.some((r) => !r.included);
    setRows((prev) => prev.map((r) => ({ ...r, included: anyUnselected })));
  };

  const handleQuickCreateClick = (row) => {
    if (!onQuickCreateProduct) return;
    const initialData = {
      product_name: row.vendorDescription || "",
      selling_price: row.mrp || "",
      cost_price: row.costPrice || "",
      gst_rate: row.gstRate || "0",
      hsn_code: row.hsnCode || row.vendorHsn || "",
      sale_type: "UNIT",
    };

    onQuickCreateProduct(initialData, (newlyCreatedProduct) => {
      if (newlyCreatedProduct) {
        handleSelectProductForRow(row.id, newlyCreatedProduct);
      }
    });
  };

  const handleConfirmImport = () => {
    const includedRows = rows.filter((r) => r.included);
    if (includedRows.length === 0) return;

    // Check if any included item is not linked to a system product
    const unlinked = includedRows.filter((r) => !r.selectedProduct);
    if (unlinked.length > 0) {
      alert(`Please link or create a product for "${unlinked[0].vendorDescription}" before importing.`);
      return;
    }

    const importedItems = includedRows.map((r) => {
      const gst = calcLineGST(r.costPrice, r.qty, r.gstRate);
      return {
        id: `import-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        product_id: r.selectedProduct.id,
        product_name: r.selectedProduct.name,
        expiry_date: null,
        qty: parseFloat(r.qty) || 1,
        cost_price: parseFloat(r.costPrice) || 0,
        mrp: parseFloat(r.mrp) || 0,
        gst_rate: parseFloat(r.gstRate) || 0,
        hsn_code: r.hsnCode ? r.hsnCode.trim() : "",
        ...gst,
      };
    });

    const mappingsToSave = includedRows
      .filter((r) => r.rememberMapping && r.selectedProduct && r.vendorDescription)
      .map((r) => ({
        vendor_product_name: r.vendorDescription.trim(),
        system_product_id: r.selectedProduct.id,
      }));

    const metadata = extractedData?.data?.metadata || {};
    const parsedDate = parseInvoiceDate(metadata.invoiceDate);

    onConfirm({
      items: importedItems,
      invoiceNo: useExtractedInvoiceInfo ? metadata.invoiceNumber || "" : "",
      invoiceDate: useExtractedInvoiceInfo && parsedDate ? parsedDate : "",
      mappingsToSave,
    });

    onClose();
  };

  const metadata = extractedData?.data?.metadata || {};
  const seller = extractedData?.data?.seller || {};

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth sx={{ "& .MuiDialog-paper": { borderRadius: "12px" } }}>
      {/* ── Dialog Title ── */}
      <DialogTitle sx={{ px: 2.5, py: 1.5, display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <AutoFixHighIcon sx={{ color: "primary.main", fontSize: 22 }} />
          <Box>
            <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#1e293b", lineHeight: 1.2 }}>
              Invoice Reconciliation & Product Mapping
            </Typography>
            <Typography sx={{ fontSize: 12, color: "#64748b" }}>
              Verify extracted invoice line items and match them with your store catalog
            </Typography>
          </Box>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: "#64748b" }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 2.5, bgcolor: "#f8fafc" }}>
        {/* ── Invoice Overview Card ── */}
        <Paper elevation={0} sx={{ p: 1.75, mb: 2, border: "1px solid #e2e8f0", borderRadius: "10px", bgcolor: "#fff" }}>
          <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 2 }}>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 3, alignItems: "center" }}>
              {seller.name && (
                <Box>
                  <Typography sx={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>
                    Vendor / Seller
                  </Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>
                    {seller.name}
                  </Typography>
                  {seller.gstin && (
                    <Typography sx={{ fontSize: 11, color: "#64748b" }}>
                      GSTIN: {seller.gstin}
                    </Typography>
                  )}
                </Box>
              )}
              {metadata.invoiceNumber && (
                <Box>
                  <Typography sx={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>
                    Invoice No
                  </Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: "primary.main" }}>
                    {metadata.invoiceNumber}
                  </Typography>
                </Box>
              )}
              {metadata.invoiceDate && (
                <Box>
                  <Typography sx={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>
                    Invoice Date
                  </Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>
                    {metadata.invoiceDate}
                  </Typography>
                </Box>
              )}
              {currentSupplier && (
                <Box sx={{ pl: 1, borderLeft: "2px solid #e2e8f0" }}>
                  <Typography sx={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>
                    Selected Supplier
                  </Typography>
                  <Chip
                    label={currentSupplier.name}
                    size="small"
                    color="primary"
                    variant="outlined"
                    sx={{ height: 22, fontSize: 11, fontWeight: 600 }}
                  />
                </Box>
              )}
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Checkbox
                size="small"
                checked={useExtractedInvoiceInfo}
                onChange={(e) => setUseExtractedInvoiceInfo(e.target.checked)}
                sx={{ p: 0.5 }}
              />
              <Typography sx={{ fontSize: 12, color: "#475569", fontWeight: 500 }}>
                Prefill Invoice No & Date
              </Typography>
            </Box>
          </Box>
        </Paper>

        {/* ── Status Bar & Quick Actions ── */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5, flexWrap: "wrap", gap: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Chip
              icon={<CheckCircleIcon sx={{ fontSize: "14px !important" }} />}
              label={`${stats.matched} Matched`}
              size="small"
              sx={{ bgcolor: "#ecfdf5", color: "#047857", fontWeight: 600, fontSize: 12 }}
            />
            {stats.suggested > 0 && (
              <Chip
                icon={<WarningAmberIcon sx={{ fontSize: "14px !important" }} />}
                label={`${stats.suggested} Suggested`}
                size="small"
                sx={{ bgcolor: "#fffbeb", color: "#b45309", fontWeight: 600, fontSize: 12 }}
              />
            )}
            {stats.unmatched > 0 && (
              <Chip
                icon={<HelpOutlineIcon sx={{ fontSize: "14px !important" }} />}
                label={`${stats.unmatched} Unmatched`}
                size="small"
                sx={{ bgcolor: "#fef2f2", color: "#b91c1c", fontWeight: 600, fontSize: 12 }}
              />
            )}
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {stats.suggested > 0 && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<AutoFixHighIcon />}
                onClick={handleAcceptAllSuggestions}
                sx={{ fontSize: 12, height: 28, textTransform: "none", fontWeight: 600 }}
              >
                Accept Top Suggestions
              </Button>
            )}
            <Button
              size="small"
              onClick={handleToggleSelectAll}
              sx={{ fontSize: 12, height: 28, textTransform: "none", color: "#475569" }}
            >
              {rows.some((r) => !r.included) ? "Select All" : "Deselect All"}
            </Button>
          </Box>
        </Box>

        {/* ── Items Table ── */}
        <TableContainer component={Paper} elevation={0} sx={{ border: "1px solid #e2e8f0", borderRadius: "10px", maxHeight: "55vh" }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, fontSize: 11, bgcolor: "#f8fafc", width: 40 }} align="center">
                  Inc
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 11, bgcolor: "#f8fafc", minWidth: 200 }}>
                  Invoice Product (Vendor Name)
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 11, bgcolor: "#f8fafc", minWidth: 260 }}>
                  System Product Match
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 11, bgcolor: "#f8fafc", width: 85 }} align="right">
                  Qty
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 11, bgcolor: "#f8fafc", width: 105 }} align="right">
                  Cost (₹)
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 11, bgcolor: "#f8fafc", width: 100 }} align="right">
                  MRP (₹)
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 11, bgcolor: "#f8fafc", width: 90 }} align="center">
                  GST %
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 11, bgcolor: "#f8fafc", width: 110 }} align="right">
                  Total
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 11, bgcolor: "#f8fafc", width: 75 }} align="center">
                  Memory
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => {
                const lineCalc = calcLineGST(row.costPrice, row.qty, row.gstRate);
                const isMatched = Boolean(row.selectedProduct);

                return (
                  <TableRow
                    key={row.id}
                    sx={{
                      bgcolor: !row.included ? "#f1f5f9" : isMatched ? "#ffffff" : "#fff8f8",
                      opacity: !row.included ? 0.6 : 1,
                      "&:hover": { bgcolor: !row.included ? "#f1f5f9" : "#f8fafc" },
                    }}
                  >
                    {/* Include Checkbox */}
                    <TableCell align="center" sx={{ py: 1, px: 0.5 }}>
                      <Checkbox
                        size="small"
                        checked={row.included}
                        onChange={(e) => handleRowChange(row.id, "included", e.target.checked)}
                      />
                    </TableCell>

                    {/* Vendor Item Info */}
                    <TableCell sx={{ py: 1 }}>
                      <Typography sx={{ fontSize: 12.5, fontWeight: 650, color: "#1e293b", lineHeight: 1.3 }}>
                        {row.vendorDescription}
                      </Typography>
                      <Box sx={{ display: "flex", gap: 1, mt: 0.25, alignItems: "center" }}>
                        {row.vendorHsn && (
                          <Typography sx={{ fontSize: 11, color: "#64748b" }}>
                            HSN: <b>{row.vendorHsn}</b>
                          </Typography>
                        )}
                        {row.vendorMrp > 0 && (
                          <Typography sx={{ fontSize: 11, color: "#64748b" }}>
                            MRP: <b>{fmt(row.vendorMrp)}</b>
                          </Typography>
                        )}
                      </Box>
                    </TableCell>

                    {/* System Product Match Column */}
                    <TableCell sx={{ py: 1 }}>
                      {row.isEditingProduct || !row.selectedProduct ? (
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                          {/* Search box for selecting any product */}
                          <RowProductSearch
                            value={row.selectedProduct}
                            onChange={(prod) => handleSelectProductForRow(row.id, prod)}
                            placeholder="Search & link product..."
                          />

                          {/* Top suggestions quick-buttons (if available) */}
                          {row.suggestions && row.suggestions.length > 0 && (
                            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, alignItems: "center" }}>
                              <Typography sx={{ fontSize: 10.5, color: "#64748b", fontWeight: 600 }}>
                                Suggestions:
                              </Typography>
                              {row.suggestions.slice(0, 3).map((s) => (
                                <Chip
                                  key={s.id}
                                  label={`${s.name} (${fmt(s.selling_price)})`}
                                  size="small"
                                  onClick={() => handleSelectProductForRow(row.id, s)}
                                  sx={{
                                    height: 20,
                                    fontSize: 10.5,
                                    cursor: "pointer",
                                    bgcolor: "#f0fdf4",
                                    color: "#166534",
                                    border: "1px solid #bbf7d0",
                                    "&:hover": { bgcolor: "#dcfce7" },
                                  }}
                                />
                              ))}
                            </Box>
                          )}

                          {/* Quick Create Action */}
                          <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                            <Button
                              size="small"
                              startIcon={<AddIcon sx={{ fontSize: "14px !important" }} />}
                              onClick={() => handleQuickCreateClick(row)}
                              sx={{
                                fontSize: 11,
                                height: 22,
                                py: 0,
                                px: 1,
                                textTransform: "none",
                                color: "primary.main",
                                fontWeight: 600,
                              }}
                            >
                              + Create New Product
                            </Button>
                          </Box>
                        </Box>
                      ) : (
                        /* Matched Display */
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
                            <Tooltip
                              title={
                                row.matchType === "exact_supplier_mapping"
                                  ? "Learned from previous invoice"
                                  : row.matchType === "exact_barcode"
                                  ? "Exact barcode match"
                                  : "Matched by product attributes"
                              }
                              arrow
                            >
                              <CheckCircleIcon sx={{ fontSize: 16, color: "#10b981", flexShrink: 0 }} />
                            </Tooltip>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {row.selectedProduct.name}
                              </Typography>
                              <Typography sx={{ fontSize: 10.5, color: "#64748b" }}>
                                Selling: {fmt(row.selectedProduct.selling_price)}
                                {row.selectedProduct.barcode ? ` · Barcode: ${row.selectedProduct.barcode}` : ""}
                              </Typography>
                            </Box>
                          </Box>

                          <IconButton
                            size="small"
                            title="Change linked product"
                            onClick={() => handleRowChange(row.id, "isEditingProduct", true)}
                            sx={{ p: 0.5, color: "#64748b" }}
                          >
                            <EditIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Box>
                      )}
                    </TableCell>

                    {/* Qty Input */}
                    <TableCell align="right" sx={{ py: 1 }}>
                      <TextField
                        size="small"
                        type="number"
                        value={row.qty}
                        onChange={(e) => handleRowChange(row.id, "qty", e.target.value)}
                        inputProps={{ min: "0.01", step: "1", style: { textAlign: "right", fontSize: "12px", padding: "4px 8px" } }}
                        sx={{ width: 75 }}
                      />
                    </TableCell>

                    {/* Cost Price Input */}
                    <TableCell align="right" sx={{ py: 1 }}>
                      <TextField
                        size="small"
                        type="number"
                        value={row.costPrice}
                        onChange={(e) => handleRowChange(row.id, "costPrice", e.target.value)}
                        inputProps={{ min: "0", step: "0.01", style: { textAlign: "right", fontSize: "12px", padding: "4px 8px" } }}
                        sx={{ width: 95 }}
                      />
                    </TableCell>

                    {/* MRP Input */}
                    <TableCell align="right" sx={{ py: 1 }}>
                      <TextField
                        size="small"
                        type="number"
                        value={row.mrp}
                        onChange={(e) => handleRowChange(row.id, "mrp", e.target.value)}
                        inputProps={{ min: "0", step: "1", style: { textAlign: "right", fontSize: "12px", padding: "4px 8px" } }}
                        sx={{ width: 90 }}
                      />
                    </TableCell>

                    {/* GST % Select */}
                    <TableCell align="center" sx={{ py: 1 }}>
                      <FormControl size="small" sx={{ width: 80 }}>
                        <Select
                          value={row.gstRate}
                          onChange={(e) => handleRowChange(row.id, "gstRate", e.target.value)}
                          sx={{ fontSize: "12px", "& .MuiSelect-select": { py: "4px", px: "8px" } }}
                        >
                          <MenuItem value="0" sx={{ fontSize: 12 }}>0%</MenuItem>
                          <MenuItem value="5" sx={{ fontSize: 12 }}>5%</MenuItem>
                          <MenuItem value="12" sx={{ fontSize: 12 }}>12%</MenuItem>
                          <MenuItem value="18" sx={{ fontSize: 12 }}>18%</MenuItem>
                          <MenuItem value="28" sx={{ fontSize: 12 }}>28%</MenuItem>
                          <MenuItem value="40" sx={{ fontSize: 12 }}>40%</MenuItem>
                        </Select>
                      </FormControl>
                    </TableCell>

                    {/* Total */}
                    <TableCell align="right" sx={{ py: 1, fontWeight: 700, fontSize: 12.5, color: "#1e293b" }}>
                      {fmt(lineCalc.total)}
                    </TableCell>

                    {/* Save Mapping to Memory Checkbox */}
                    <TableCell align="center" sx={{ py: 1, px: 0.5 }}>
                      <Tooltip title="Remember mapping for future invoices" arrow>
                        <Checkbox
                          size="small"
                          checked={row.rememberMapping}
                          disabled={!row.selectedProduct}
                          onChange={(e) => handleRowChange(row.id, "rememberMapping", e.target.checked)}
                          sx={{ p: 0.5, color: "#10b981", "&.Mui-checked": { color: "#10b981" } }}
                        />
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>

      {/* ── Dialog Actions / Footer ── */}
      <DialogActions sx={{ px: 2.5, py: 1.75, borderTop: "1px solid #e2e8f0", justifyContent: "space-between", bgcolor: "#fff" }}>
        {/* Total Summary */}
        <Box sx={{ display: "flex", gap: 3, alignItems: "center" }}>
          <Typography sx={{ fontSize: 12.5, color: "#64748b" }}>
            Included Items: <b>{stats.includedCount}</b>
          </Typography>
          <Typography sx={{ fontSize: 12.5, color: "#64748b" }}>
            Taxable: <b>{fmt(stats.totalTaxable)}</b>
          </Typography>
          <Typography sx={{ fontSize: 12.5, color: "#64748b" }}>
            GST: <b>{fmt(stats.totalGst)}</b>
          </Typography>
          <Divider orientation="vertical" flexItem />
          <Typography sx={{ fontSize: 15, fontWeight: 750, color: "primary.main" }}>
            Grand Total: {fmt(stats.grandTotal)}
          </Typography>
        </Box>

        {/* Buttons */}
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button size="medium" onClick={onClose} color="inherit" sx={{ textTransform: "none", fontWeight: 600 }}>
            Cancel
          </Button>
          <Button
            size="medium"
            variant="contained"
            onClick={handleConfirmImport}
            disabled={stats.includedCount === 0 || !stats.allMatched}
            sx={{
              textTransform: "none",
              fontWeight: 700,
              px: 2.5,
              boxShadow: "none",
              "&:hover": { boxShadow: "none" },
            }}
          >
            Import {stats.includedCount} Items to Purchase
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
