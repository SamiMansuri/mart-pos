import createHttpError from "http-errors";
import { BATCH_QUERIES, PURCHASE_QUERIES, PURCHASE_PAYMENT_QUERIES, STOCK_QUERIES } from "../db/queries.js";
import { asyncHandler } from "../utils/asynHandler.util.js";
import { getSuccessResponse } from "../utils/response.util.js";
import { withTransaction } from "../utils/transaction.util.js";
import { calculateGST } from "../helper/calculateGST.js";

export const getAllPurchases = asyncHandler(async (req, res) => {
  const result = await withTransaction(async (client) => {
    return client.query(PURCHASE_QUERIES.GET_ALL);
  });

  res.status(200).json(getSuccessResponse({ data: result.rows, status: 200 }));
});

export const getPurchaseById = asyncHandler(async (req, res) => {
  const { purchase_id } = req.params;

  const result = await withTransaction(async (client) => {
    const { rows: purchaseRows } = await client.query(
      PURCHASE_QUERIES.GET_BY_ID,
      [purchase_id],
    );
    if (!purchaseRows.length) throw createHttpError(404, "Purchase not found");

    const { rows: items } = await client.query(PURCHASE_QUERIES.GET_ITEMS, [
      purchase_id,
    ]);

    const { rows: payments } = await client.query(
      PURCHASE_PAYMENT_QUERIES.GET_BY_PURCHASE,
      [purchase_id],
    );

    return { ...purchaseRows[0], items, payments };
  });

  res.status(200).json(getSuccessResponse({ data: result, status: 200 }));
});

export const recordPurchasePayment = asyncHandler(async (req, res) => {
  const { purchase_id } = req.params;
  const { amount, payer_name, note } = req.body;
  const { user_id } = req.user;

  const numericAmount = parseFloat(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) {
    throw createHttpError(400, "Payment amount must be greater than 0");
  }

  const result = await withTransaction(async (client) => {
    const { rows: purchaseRows } = await client.query(
      PURCHASE_QUERIES.GET_FOR_UPDATE,
      [purchase_id],
    );

    if (!purchaseRows.length) {
      throw createHttpError(404, "Purchase not found");
    }

    const purchase = purchaseRows[0];
    const totalAmount = parseFloat(purchase.total_amount || 0);

    const { rows: sumRows } = await client.query(
      PURCHASE_PAYMENT_QUERIES.GET_TOTAL_PAID,
      [purchase_id],
    );

    const existingTotalPaid = parseFloat(sumRows[0]?.total_paid || 0);
    const amountDue = totalAmount - existingTotalPaid;

    if (Number(numericAmount.toFixed(2)) > Number(amountDue.toFixed(2))) {
      throw createHttpError(
        400,
        `Payment amount (${numericAmount.toFixed(2)}) exceeds remaining amount due (${amountDue.toFixed(2)})`,
      );
    }

    const { rows: paymentRows } = await client.query(
      PURCHASE_PAYMENT_QUERIES.CREATE,
      [
        purchase_id,
        parseFloat(numericAmount.toFixed(2)),
        user_id,
        payer_name || null,
        note || null,
      ],
    );

    return paymentRows[0];
  });

  res.status(201).json(
    getSuccessResponse({
      data: result,
      message: "Payment recorded successfully",
      status: 201,
    }),
  );
});

export const createPurchase = asyncHandler(async (req, res) => {
  const { supplier_id, invoice_no, invoice_date, notes, items } = req.body;
  const { user_id } = req.user;

  if (!invoice_date) throw createHttpError(400, "Invoice date is required");
  if (!items?.length)
    throw createHttpError(400, "At least one item is required");

  const result = await withTransaction(async (client) => {
    let total_amount = 0;
    let total_taxable = 0;
    let total_cgst = 0;
    let total_sgst = 0;

    // Calculate totals
    const processedItems = items.map((item) => {
      const itemTotal = parseFloat(item.cost_price) * parseFloat(item.qty);
      const gst = calculateGST(itemTotal, item.gst_rate);

      total_amount += itemTotal;
      total_taxable += gst.taxable_amount;
      total_cgst += gst.cgst_amount;
      total_sgst += gst.sgst_amount;

      return { ...item, ...gst, total_amount: itemTotal };
    });

    // Create purchase record
    const { rows: purchaseRows } = await client.query(PURCHASE_QUERIES.CREATE, [
      supplier_id || null,
      invoice_no || null,
      invoice_date,
      parseFloat(total_amount.toFixed(2)),
      parseFloat(total_taxable.toFixed(2)),
      parseFloat(total_cgst.toFixed(2)),
      parseFloat(total_sgst.toFixed(2)),
      notes || null,
      user_id,
    ]);

    const purchase = purchaseRows[0];

    // Create items + update stock batches
    for (const item of processedItems) {
      const seqResult = await client.query(`SELECT nextval('batch_seq')`);
      const seq = String(seqResult.rows[0].nextval).padStart(4, '0'); // "0001", "0042"
      const d = new Date(invoice_date);
      const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
      const batch_no = `BAT-${dateStr}-${item.product_id}-${seq}`;

      await client.query(PURCHASE_QUERIES.CREATE_ITEM, [
        purchase.id,
        item.product_id,
        batch_no,
        item.expiry_date || null,
        parseFloat(item.qty),
        parseFloat(item.cost_price),
        parseFloat(item.mrp) || 0,
        item.taxable_amount,
        parseFloat(item.gst_rate) || 0,
        item.cgst_amount,
        item.sgst_amount,
        item.total_amount,
      ]);

      // Upsert batch — same as stock entry
      const { rows: batchRows } = await client.query(BATCH_QUERIES.UPSERT, [
        item.product_id,
        batch_no,
        parseFloat(item.qty),
        parseFloat(item.cost_price),
        parseFloat(item.mrp) || 0,
        item.expiry_date || null,
        user_id,
      ]);
      
      const batch_id = batchRows[0].id;

      await client.query(
        "UPDATE products SET gst_rate = $1 WHERE id = $2 AND (gst_rate = 0 OR gst_rate IS NULL)",
        [parseFloat(item.gst_rate) || 0, item.product_id]
      );

      // Record stock movement
      await client.query(STOCK_QUERIES.RECORD_MOVEMENT, [
        item.product_id,
        parseFloat(item.qty),
        "IN",
        `PURCHASE-${purchase.id}`,
        user_id,
        batch_id,
      ]);
    }

    return purchase;
  });

  res
    .status(201)
    .json(
      getSuccessResponse({
        data: result,
        message: "Purchase created successfully",
      }),
    );
});
