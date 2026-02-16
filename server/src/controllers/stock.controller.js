import { asyncHandler } from "../utils/asynHandler.util.js";
import { getSuccessResponse } from "../utils/response.util.js";
import { withTransaction } from "../utils/transaction.util.js";
import createHttpError from "http-errors";
import { logEvent } from "../services/logs.service.js";
import { BATCH_QUERIES, STOCK_QUERIES } from "../db/queries.js";

/**
 * Admin action to add stock to a product (Manual Batch Handling)
 * @route POST /api/stock/add
 */
export const addStock = asyncHandler(async (req, res) => {
  const { product_id, batch_no, expiry_date, cost_price, quantity, mrp } =
    req.body;

  const { user_id } = req.user;

  if (!product_id || !batch_no || quantity === undefined) {
    throw createHttpError(
      400,
      "Product ID, Batch No, and Quantity are required",
    );
  }

  const result = await withTransaction(async (client) => {
    // 1. Verify product exists
    const productCheck = await client.query(
      "SELECT id, name FROM products WHERE id = $1",
      [product_id],
    );
    if (productCheck.rows.length === 0) {
      throw createHttpError(404, "Product not found");
    }

    // 2. UPSERT the batch
    const batchRes = await client.query(BATCH_QUERIES.UPSERT, [
      product_id,
      batch_no,
      quantity,
      cost_price || 0,
      mrp || 0,
      expiry_date || null,
      user_id,
    ]);

    const batch = batchRes.rows[0];

    // 3. Record stock movement
    await client.query(STOCK_QUERIES.RECORD_MOVEMENT, [
      product_id,
      Math.abs(quantity),
      quantity >= 0 ? "IN" : "OUT",
      "STOCK_ENTRY",
      user_id,
      batch.id,
    ]);

    await logEvent(
      client,
      "STOCK_ENTRY",
      user_id,
      "PRODUCT",
      product_id,
      batch.id,
      {
        batch_no,
        added_qty: quantity,
        final_qty: batch.quantity,
      },
    );

    return {
      product_id,
      batch_id: batch.id,
      batch_no,
      current_quantity: batch.quantity,
    };
  });

  res.json(
    getSuccessResponse({
      data: result,
      message: "Stock added successfully",
    }),
  );
});
