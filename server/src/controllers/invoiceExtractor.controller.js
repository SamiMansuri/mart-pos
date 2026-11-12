import createHttpError from "http-errors";
import { asyncHandler } from "../utils/asynHandler.util.js";
import { getSuccessResponse } from "../utils/response.util.js";
import { extractInvoice } from "../services/invoiceExtractor.service.js";
import { matchExtractedItems } from "../services/productMatcher.service.js";
import { withTransaction } from "../utils/transaction.util.js";
import { SUPPLIER_PRODUCT_MAPPING_QUERIES } from "../db/queries.js";

/**
 * Extract invoice data from PDF and run product matching against catalog
 */
export const extractInvoiceFromPdf = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw createHttpError(400, "Please upload a PDF invoice file");
  }

  const method = req.query.method || req.body.method || "auto";
  const rawSupplierId =
    req.query.supplierId ||
    req.query.supplier_id ||
    req.body.supplier_id ||
    req.body.supplierId;
  const supplierId = rawSupplierId ? parseInt(rawSupplierId, 10) : null;

  try {
    const result = await extractInvoice(req.file.buffer, { method });

    // If line items were successfully extracted, run product matching engine
    if (result?.success && Array.isArray(result?.data?.items) && result.data.items.length > 0) {
      result.data.items = await matchExtractedItems(result.data.items, supplierId);

      const summary = {
        total: result.data.items.length,
        matched: 0,
        suggested: 0,
        unmatched: 0,
      };

      for (const item of result.data.items) {
        if (item.matchType === "exact_supplier_mapping" || item.matchType === "exact_barcode") {
          summary.matched++;
        } else if (item.matchType === "hsn_mrp" || item.matchType === "suggested_name") {
          summary.suggested++;
        } else {
          summary.unmatched++;
        }
      }

      result.data.matchSummary = summary;
    }

    res.status(200).json(
      getSuccessResponse({
        message: "Invoice extracted and products matched successfully",
        data: result,
        status: 200,
      })
    );
  } catch (error) {
    throw createHttpError(500, error.message || "Failed to extract invoice data from PDF");
  }
});

/**
 * Bulk save or update supplier vendor-to-system product mappings (memory)
 */
export const saveSupplierMappings = asyncHandler(async (req, res) => {
  const { supplier_id, mappings } = req.body;

  if (!supplier_id) {
    throw createHttpError(400, "supplier_id is required");
  }
  if (!Array.isArray(mappings) || mappings.length === 0) {
    throw createHttpError(400, "mappings must be a non-empty array");
  }

  const savedRecords = await withTransaction(async (client) => {
    const results = [];
    for (const mapping of mappings) {
      const vendorName = mapping.vendor_product_name || mapping.vendorProductName;
      const systemProductId = mapping.system_product_id || mapping.systemProductId;

      if (!vendorName || !systemProductId) continue;

      const { rows } = await client.query(SUPPLIER_PRODUCT_MAPPING_QUERIES.UPSERT, [
        supplier_id,
        String(vendorName).trim(),
        systemProductId,
      ]);
      if (rows[0]) results.push(rows[0]);
    }
    return results;
  });

  res.status(200).json(
    getSuccessResponse({
      message: `Successfully saved ${savedRecords.length} supplier mapping(s)`,
      data: savedRecords,
      status: 200,
    })
  );
});

/**
 * Fetch all stored product mappings for a given supplier
 */
export const getSupplierMappings = asyncHandler(async (req, res) => {
  const { supplier_id } = req.params;

  if (!supplier_id) {
    throw createHttpError(400, "supplier_id parameter is required");
  }

  const { rows } = await withTransaction(async (client) => {
    return client.query(SUPPLIER_PRODUCT_MAPPING_QUERIES.GET_BY_SUPPLIER, [supplier_id]);
  });

  res.status(200).json(
    getSuccessResponse({
      data: rows,
      status: 200,
    })
  );
});
