import createHttpError from "http-errors";
import pool from "../config/db.config.js";
import { asyncHandler } from "../utils/asynHandler.util.js";
import { getSuccessResponse } from "../utils/response.util.js";
import { withTransaction } from "../utils/transaction.util.js";
import normalizeItems from "../helper/normalizeItems.js";

export const createBill = asyncHandler(async (req, res) => {
  const { items, payment_method } = req.body;

  if (!items?.length) throw createHttpError(400, "Cart is empty");

  const normalizedItems = normalizeItems(items);

  const result = await withTransaction(async (client) => {
    let totalAmount = 0;

    const productMap = new Map();

    for (const item of normalizedItems) {
      if (item.quantity <= 0) {
        throw createHttpError(400, "Invalid quantity");
      }

      const { rows } = await client.query(
        "SELECT selling_price, stock_qty FROM products WHERE id = $1 FOR UPDATE",
        [item.product_id],
      );

      if (!rows.length) throw createHttpError(404, "Product not found");

      const product = rows[0];
      productMap.set(item.product_id, product);

      if (product.stock_qty < item.quantity)
        throw createHttpError(409, "Not enough stock");

      totalAmount += product.selling_price * item.quantity;
    }

    const billNumber = `BILL-${Date.now()}`;

    const billRes = await client.query(
      "INSERT INTO bills (bill_number, total_amount, payment_method) VALUES ($1, $2, $3) RETURNING *",
      [billNumber, totalAmount, payment_method],
    );

    const billId = billRes.rows[0].id;

    for (const item of normalizedItems) {
      const product = productMap.get(item.product_id);
      const price = +product.selling_price;
      const lineTotal = price * item.quantity;

      await client.query(
        "INSERT INTO bill_items (bill_id, product_id, quantity, price, line_total) VALUES ($1, $2, $3, $4, $5)",
        [billId, item.product_id, item.quantity, price, lineTotal],
      );

      await client.query(
        "UPDATE products SET stock_qty = stock_qty - $1 where id = $2",
        [item.quantity, item.product_id],
      );

      await client.query(
        "INSERT INTO stock_movements (product_id, quantity, movement_type, reference) VALUES ($1, $2, 'OUT', $3)",
        [item.product_id, item.quantity, billNumber],
      );
    }

    return billRes.rows[0];
  });
  res.status(201).json(
    getSuccessResponse({
      data: result,
      message: "Bill created successfully",
      status: 201,
    }),
  );
});

export const getBillById = asyncHandler(async (req, res) => {
  const { bill_id } = req.params;
  const { limit = 10, page = 1 } = req.query;

  const { rows } = await pool.query(
    `SELECT
       b.id AS bill_id,
       b.bill_number,
       b.total_amount,
       b.payment_method,
       b.created_at,
       bi.id AS item_id,
       bi.quantity,
       bi.price,
       bi.line_total,
       p.id AS product_id,
       p.name AS product_name,
       p.barcode AS product_barcode
     FROM bills b
     JOIN bill_items bi ON bi.bill_id = b.id
     JOIN products p ON p.id = bi.product_id
     WHERE b.id = $1 ORDER BY bi.id DESC LIMIT $2 OFFSET $3`,
    [bill_id, limit, (page - 1) * limit],
  );
  if (!rows.length) throw new Error("Bill not found");

  const bill = {
    bill_id: rows[0].bill_id,
    bill_number: rows[0].bill_number,
    total_amount: rows[0].total_amount,
    payment_method: rows[0].payment_method,
    created_at: rows[0].created_at,
    items: rows.map((row) => ({
      item_id: row.item_id,
      product_id: row.product_id,
      product_name: row.product_name,
      product_barcode: row.product_barcode,
      quantity: row.quantity,
      price: row.price,
      line_total: row.line_total,
    })),
  };

  res.json(
    getSuccessResponse({
      data: bill,
      message: "Bill fetched successfully",
      status: 200,
    }),
  );
});

export const getAllBills = asyncHandler(async (req, res) => {
  const {
    limit = 10,
    page = 1,
    sort_by = "created_at",
    sort_order = "DESC",
  } = req.query;

  // const allowedSortColumns = ["bill_number", "total_amount", "payment_method", "created_at", "id"];
  // const allowedSortOrders = ["ASC", "DESC"];

  // const validSortBy = allowedSortColumns.includes(sort_by) ? sort_by : "created_at";
  // const validSortOrder = allowedSortOrders.includes(sort_order.toUpperCase()) ? sort_order.toUpperCase() : "DESC";

  const { rows } = await pool.query(
    `SELECT * FROM bills ORDER BY ${sort_by} ${sort_order} LIMIT $1 OFFSET $2`,
    [limit, (page - 1) * limit],
  );

  res.json(
    getSuccessResponse({
      data: rows,
      message: "Bills fetched successfully",
      status: 200,
    }),
  );
});

export const voidBill = asyncHandler(async (req, res) => {
  const { billId } = req.params;

  const result = await withTransaction(async (client) => {
    const bill = await client.query(
      "SELECT * FROM bills WHERE id = $1 FOR UPDATE",
      [billId],
    );

    if (!bill.rows.length) throw createHttpError(404, "Bill not found");

    if (bill.rows[0].is_void) throw createHttpError(409, "Bill already voided");

    const reference = `VOID-BILL-${bill.rows[0].bill_number}`;

    const billItems = await client.query(
      "SELECT product_id, quantity FROM bill_items WHERE bill_id = $1",
      [billId],
    );

    for (const item of billItems.rows) {
      await client.query(
        "UPDATE products SET stock_qty = stock_qty + $1 WHERE id = $2",
        [item.quantity, item.product_id],
      );

      await client.query(
        "INSERT INTO stock_movements(product_id, quantity, movement_type, reference) VALUES ($1, $2, 'IN', $3)",
        [item.product_id, item.quantity, reference],
      );
    }

    await client.query("UPDATE bills SET is_void = TRUE WHERE id = $1", [
      billId,
    ]);
  });

  res.json(
    getSuccessResponse({
      data: result,
      message: "Bill voided successfully",
      status: 200,
    }),
  );
});
