import createHttpError from "http-errors";
import pool from "../config/db.config.js";
import { asyncHandler } from "../utils/asynHandler.util.js";
import { getSuccessResponse } from "../utils/response.util.js";
import { withTransaction } from "../utils/transaction.util.js";
import normalizeItems from "../helper/normalizeItems.js";
import {
  getRefundedAmount,
  getReturnedQtyMap,
  hasRefunds,
} from "../services/bill.service.js";

export const createBill = asyncHandler(async (req, res) => {
  const { items, payment_method, idempotency_key } = req.body;
  const { user_id } = req.user;

  if (!idempotency_key) {
    throw createHttpError(400, "Idempotency key is required");
  }

  if (!items?.length) throw createHttpError(400, "Cart is empty");

  const normalizedItems = normalizeItems(items);

  const result = await withTransaction(async (client) => {
    const existingBill = await client.query(
      "SELECT id, bill_number, total_amount FROM bills WHERE idempotency_key = $1",
      [idempotency_key],
    );

    if (existingBill.rows.length) {
      return { isNew: false, bill: existingBill.rows[0] };
    }

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
      "INSERT INTO bills (bill_number, total_amount, payment_method, idempotency_key, created_by, payment_status) VALUES ($1, $2, $3, $4, $5, 'PAID') RETURNING *",
      [billNumber, totalAmount, payment_method, idempotency_key, user_id],
    );

    const billId = billRes.rows[0].id;

    for (const item of normalizedItems) {
      const product = productMap.get(item.product_id);
      const price = Number(product.selling_price);
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
        "INSERT INTO stock_movements (product_id, quantity, movement_type, reference, created_by) VALUES ($1, $2, 'OUT', $3, $4)",
        [item.product_id, item.quantity, billNumber, user_id],
      );
    }

    return { isNew: true, bill: billRes.rows[0] };
  });

  const { isNew, bill } = result;

  const response = {
    data: bill,
    message: isNew ? "Bill created successfully" : "Bill already exists",
    status: isNew ? 201 : 200,
  };

  res.status(response.status).json(
    getSuccessResponse({
      data: response.data,
      message: response.message,
      status: response.status,
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
  const { user_id } = req.user;

  const result = await withTransaction(async (client) => {
    const billRes = await client.query(
      "SELECT * FROM bills WHERE id = $1 FOR UPDATE",
      [billId],
    );

    if (!billRes.rows.length) throw createHttpError(404, "Bill not found");

    const bill = billRes.rows[0];

    if (bill.is_void) {
      throw createHttpError(409, "Bill already voided");
    }

    if (bill.settled) throw createHttpError(409, "Bill already settled");

    if (Number(bill.returned_amount) > 0)
      throw createHttpError(409, "Cannot void bill with returns");

    if (await hasRefunds(client, billId))
      throw createHttpError(409, "Cannot void bill with refunds");

    const reference = `VOID-BILL-${bill.bill_number}`;

    const billItems = await client.query(
      "SELECT product_id, quantity FROM bill_items WHERE bill_id = $1 FOR UPDATE",
      [billId],
    );

    for (const item of billItems.rows) {
      await client.query(
        "UPDATE products SET stock_qty = stock_qty + $1 WHERE id = $2",
        [item.quantity, item.product_id],
      );

      await client.query(
        "INSERT INTO stock_movements(product_id, quantity, movement_type, reference, created_by) VALUES ($1, $2, 'IN', $3, $4)",
        [item.product_id, item.quantity, reference, user_id],
      );
    }

    await client.query(
      "UPDATE bills SET is_void = TRUE, voided_at = NOW(), void_by = $1 WHERE id = $2",
      [user_id, billId],
    );

    return {
      bill_id: billId,
      voided: true,
    };
  });

  res.json(
    getSuccessResponse({
      data: result,
      message: "Bill voided successfully",
      status: 200,
    }),
  );
});

export const createReturn = asyncHandler(async (req, res) => {
  const { billId } = req.params;
  const { items, reason } = req.body;
  const { user_id } = req.user;

  if (!items?.length) {
    throw createHttpError(400, "No return items provided");
  }

  const result = await withTransaction(async (client) => {
    const billRes = await client.query(
      "SELECT * FROM bills WHERE id = $1 FOR UPDATE",
      [billId],
    );

    if (!billRes.rows.length) throw createHttpError(404, "Bill not found");

    const bill = billRes.rows[0];

    if (bill.is_void)
      throw createHttpError(409, "Cannot return items from void bill");

    const billItemsRes = await client.query(
      "SELECT product_id, quantity, price FROM bill_items WHERE bill_id = $1",
      [billId],
    );

    const billItemMap = new Map();
    billItemsRes.rows.forEach((item) => {
      billItemMap.set(item.product_id, item);
    });

    const returnedQtyMap = await getReturnedQtyMap(client, billId);

    let totalReturnAmount = 0;

    for (const item of items) {
      const billItem = billItemMap.get(item.product_id);

      if (!billItem) throw createHttpError(400, "Product not part of bill");

      const alreadyReturned = returnedQtyMap.get(item.product_id) || 0;
      const remainingQty = billItem.quantity - alreadyReturned;

      if (item.quantity <= 0 || item.quantity > remainingQty)
        throw createHttpError(409, "Invalid return quantity");

      totalReturnAmount += billItem.price * item.quantity;
    }

    /** Create return */
    const returnRes = await client.query(
      `
      INSERT INTO returns (bill_id, total_return_amount, reason, return_by)
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [billId, totalReturnAmount, reason, user_id],
    );

    const returnId = returnRes.rows[0].id;
    const reference = `RETURN-BILL-${bill.bill_number}`;

    /** Insert return items + restore stock */
    for (const item of items) {
      const billItem = billItemMap.get(item.product_id);
      const lineTotal = billItem.price * item.quantity;

      await client.query(
        `
        INSERT INTO return_items
        (return_id, product_id, quantity, price, line_total)
        VALUES ($1, $2, $3, $4, $5)
        `,
        [returnId, item.product_id, item.quantity, billItem.price, lineTotal],
      );

      await client.query(
        "UPDATE products SET stock_qty = stock_qty + $1 WHERE id = $2",
        [item.quantity, item.product_id],
      );

      await client.query(
        `
        INSERT INTO stock_movements
        (product_id, quantity, movement_type, reference, created_by)
        VALUES ($1, $2, 'IN', $3, $4)
        `,
        [item.product_id, item.quantity, reference, user_id],
      );
    }

    /** Update bill returned_amount */
    await client.query(
      `
      UPDATE bills
      SET returned_amount = returned_amount + $1
      WHERE id = $2
      `,
      [totalReturnAmount, billId],
    );

    return returnRes.rows[0];
  });

  res.status(201).json(
    getSuccessResponse({
      data: result,
      message: "Return processed successfully",
      status: 201,
    }),
  );
});

export const createRefund = asyncHandler(async (req, res) => {
  const { billId } = req.params;
  const { amount, payment_method, reason } = req.body;
  const { user_id } = req.user;

  if (!amount || amount <= 0)
    throw createHttpError(400, "Invalid refund amount");

  const result = await withTransaction(async (client) => {
    const billRes = await client.query(
      "SELECT * FROM bills WHERE id = $1 FOR UPDATE",
      [billId],
    );

    if (!billRes.rows.length) throw createHttpError(404, "Bill not found");

    const bill = billRes.rows[0];

    if (bill.is_void) throw createHttpError(409, "Cannot refund a void bill");

    if (bill.settled) throw createHttpError(409, "Bill already settled");

    /** Calculate remaining refundable amount */
    const refundedSoFar = await getRefundedAmount(client, billId);

    const maxRefundable =
      Number(bill.total_amount) - Number(bill.returned_amount) - refundedSoFar;

    if (amount > maxRefundable)
      throw createHttpError(409, "Refund amount exceeds refundable balance");

    /** Create refund */
    const refundRes = await client.query(
      `
      INSERT INTO refunds (bill_id, amount, payment_method, reason, refund_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [billId, amount, payment_method, reason, user_id],
    );

    /** Update bill payment status */
    const newStatus =
      amount === maxRefundable ? "REFUNDED" : "PARTIALLY_REFUNDED";

    await client.query(
      `
      UPDATE bills
      SET payment_status = $1
      WHERE id = $2
      `,
      [newStatus, billId],
    );

    return refundRes.rows[0];
  });

  res.status(201).json(
    getSuccessResponse({
      data: result,
      message: "Refund processed successfully",
      status: 201,
    }),
  );
});

export const settleDay = asyncHandler(async (req, res) => {
  const { date } = req.params;
});
