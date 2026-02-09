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
  logBillEvent,
} from "../services/bill.service.js";

export const createBill = asyncHandler(async (req, res) => {
  const { items, payment_method, idempotency_key, business_date } = req.body;
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
        "SELECT selling_price, name FROM products WHERE id = $1;",
        [item.product_id],
      );

      if (!rows.length) throw createHttpError(404, "Product not found");

      const product = rows[0];
      productMap.set(item.product_id, product);

      // Check total available quantity across all batches
      const { rows: totalQtyRows } = await client.query(
        "SELECT SUM(quantity) as total_qty FROM product_batches WHERE product_id = $1",
        [item.product_id],
      );

      const totalQty = parseInt(totalQtyRows[0].total_qty || 0);

      if (totalQty < item.quantity)
        throw createHttpError(409, `Not enough stock for ${product.name}`);

      totalAmount += product.selling_price * item.quantity;
    }

    const counterRes = await client.query(
      `
      SELECT last_number
      FROM invoice_counters
      WHERE business_date = $1
      FOR UPDATE
      `,
      [business_date],
    );

    let nextNumber = 1;

    if (counterRes.rowCount === 0) {
      await client.query(
        `
        INSERT INTO invoice_counters (business_date, last_number)
        VALUES ($1, 1)
        `,
        [business_date],
      );
    } else {
      nextNumber = counterRes.rows[0].last_number + 1;

      await client.query(
        `
        UPDATE invoice_counters
        SET last_number = $1
        WHERE business_date = $2
        `,
        [nextNumber, business_date],
      );
    }

    const billNumber = `BILL-${Date.now()}`;

    const billRes = await client.query(
      "INSERT INTO bills (bill_number, total_amount, payment_method, idempotency_key, created_by, payment_status, invoice_number, business_date) VALUES ($1, $2, $3, $4, $5, 'PAID', $6, $7) RETURNING *",
      [
        billNumber,
        totalAmount,
        payment_method,
        idempotency_key,
        user_id,
        nextNumber,
        business_date,
      ],
    );

    await logBillEvent({
      client,
      bill_id: billRes.rows[0].id,
      eventType: "CREATED",
      performedBy: user_id,
    });

    const billId = billRes.rows[0].id;

    for (const item of normalizedItems) {
      const product = productMap.get(item.product_id);
      const price = Number(product.selling_price);
      let remainingToDeduct = item.quantity;

      // Fetch batches ordered by FEFO
      const { rows: batches } = await client.query(
        "SELECT id, quantity, cost_price FROM product_batches WHERE product_id = $1 AND quantity > 0 ORDER BY expiry_date ASC NULLS LAST, created_at ASC FOR UPDATE",
        [item.product_id],
      );

      for (const batch of batches) {
        if (remainingToDeduct <= 0) break;

        const deductionFromBatch = Math.min(batch.quantity, remainingToDeduct);
        const lineTotal = price * deductionFromBatch;

        await client.query(
          "INSERT INTO bill_items (bill_id, product_id, quantity, price, line_total, product_name, batch_id, cost_price) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
          [
            billId,
            item.product_id,
            deductionFromBatch,
            price,
            lineTotal,
            product.name,
            batch.id,
            batch.cost_price,
          ],
        );

        await client.query(
          "UPDATE product_batches SET quantity = quantity - $1 WHERE id = $2",
          [deductionFromBatch, batch.id],
        );

        await client.query(
          "INSERT INTO stock_movements (product_id, quantity, movement_type, reference, created_by, batch_id) VALUES ($1, $2, 'SALE', $3, $4, $5)",
          [item.product_id, deductionFromBatch, billNumber, user_id, batch.id],
        );

        remainingToDeduct -= deductionFromBatch;
      }

      if (remainingToDeduct > 0) {
        throw createHttpError(
          409,
          `Stock inconsistency detected for ${product.name}`,
        );
      }
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
       bi.product_name AS snapshot_name,
       p.id AS product_id,
       p.name AS current_name,
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
      product_name: row.snapshot_name || row.current_name,
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

  const parsedLimit = parseInt(limit);
  const parsedPage = parseInt(page);
  const offset = (parsedPage - 1) * parsedLimit;

  // Get total count
  const countRes = await pool.query("SELECT COUNT(*) FROM bills");
  const total = parseInt(countRes.rows[0].count);
  const totalPages = Math.ceil(total / parsedLimit);

  const { rows } = await pool.query(
    `SELECT * FROM bills ORDER BY ${sort_by} ${sort_order} LIMIT $1 OFFSET $2`,
    [parsedLimit, offset],
  );

  res.json(
    getSuccessResponse({
      data: {
        bills: rows,
        meta: {
          total,
          totalPages,
          page: parsedPage,
          limit: parsedLimit,
        },
      },
      message: "Bills fetched successfully",
      status: 200,
    }),
  );
});

export const voidBill = asyncHandler(async (req, res) => {
  const { bill_id } = req.params;
  const { user_id } = req.user;

  const result = await withTransaction(async (client) => {
    const billRes = await client.query(
      "SELECT * FROM bills WHERE id = $1 FOR UPDATE",
      [bill_id],
    );

    if (!billRes.rows.length) throw createHttpError(404, "Bill not found");

    const bill = billRes.rows[0];

    if (bill.is_void) {
      throw createHttpError(409, "Bill already voided");
    }

    if (bill.settled) throw createHttpError(409, "Cannot void a settled bill");

    if (Number(bill.returned_amount) > 0)
      throw createHttpError(409, "Cannot void bill with returns");

    if (await hasRefunds(client, bill_id))
      throw createHttpError(409, "Cannot void bill with refunds");

    const reference = `VOID-BILL-${bill.bill_number}`;

    const billItems = await client.query(
      "SELECT product_id, quantity, batch_id FROM bill_items WHERE bill_id = $1 FOR UPDATE",
      [bill_id],
    );

    for (const item of billItems.rows) {
      if (item.batch_id) {
        await client.query(
          "UPDATE product_batches SET quantity = quantity + $1 WHERE id = $2",
          [item.quantity, item.batch_id],
        );
      } else {
        await client.query(
          "UPDATE product_batches SET quantity = quantity + $1 WHERE product_id = $2 AND batch_no = 'INITIAL'",
          [item.quantity, item.product_id],
        );
      }

      await client.query(
        "INSERT INTO stock_movements(product_id, quantity, movement_type, reference, created_by, batch_id) VALUES ($1, $2, 'IN', $3, $4, $5)",
        [item.product_id, item.quantity, reference, user_id, item.batch_id],
      );
    }

    await client.query(
      "UPDATE bills SET is_void = TRUE, voided_at = NOW(), void_by = $1 WHERE id = $2",
      [user_id, bill_id],
    );

    await logBillEvent({
      client,
      bill_id: bill_id,
      eventType: "VOIDED",
      performedBy: user_id,
    });

    return {
      bill_id: bill_id,
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
  const { bill_id } = req.params;
  const { items, reason, payment_method, idempotency_key } = req.body;
  const { user_id } = req.user;

  if (!items?.length) {
    throw createHttpError(400, "No return items provided");
  }

  const result = await withTransaction(async (client) => {
    const billRes = await client.query(
      "SELECT * FROM bills WHERE id = $1 FOR UPDATE",
      [bill_id],
    );

    if (!billRes.rows.length) throw createHttpError(404, "Bill not found");

    const bill = billRes.rows[0];

    if (bill.is_void)
      throw createHttpError(409, "Cannot return items from void bill");

    const billItemsRes = await client.query(
      "SELECT id, product_id, quantity, price, batch_id FROM bill_items WHERE bill_id = $1",
      [bill_id],
    );

    // Group bill items by product_id
    const billItemGroups = new Map();
    billItemsRes.rows.forEach((item) => {
      if (!billItemGroups.has(item.product_id)) {
        billItemGroups.set(item.product_id, []);
      }
      billItemGroups.get(item.product_id).push(item);
    });

    const returnedQtyMap = await getReturnedQtyMap(client, bill_id);
    // returnedQtyMap currently returns Map<product_id, total_returned_qty>
    // We might need Map<bill_item_id, returned_qty> for precision,
    // but let's check getReturnedQtyMap implementation.

    let totalReturnAmount = 0;

    for (const item of items) {
      const billItems = billItemGroups.get(item.product_id);

      if (!billItems?.length)
        throw createHttpError(
          400,
          `Product ${item.product_id} not part of bill`,
        );

      const totalSold = billItems.reduce((sum, bi) => sum + bi.quantity, 0);
      const alreadyReturned = returnedQtyMap.get(item.product_id) || 0;
      const remainingQty = totalSold - alreadyReturned;

      if (item.quantity <= 0 || item.quantity > remainingQty)
        throw createHttpError(409, "Invalid return quantity");

      totalReturnAmount += billItems[0].price * item.quantity;
    }

    const { refund_required } = req.body;
    const returnNumber = `RET-${Date.now()}`;

    /** Create return */
    const returnRes = await client.query(
      `
      INSERT INTO returns (bill_id, total_return_amount, reason, return_by, payment_method, idempotency_key, return_number)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
      `,
      [
        bill_id,
        totalReturnAmount,
        reason,
        user_id,
        payment_method,
        idempotency_key,
        returnNumber,
      ],
    );

    const returnId = returnRes.rows[0].id;
    const reference = `RETURN-BILL-${bill.bill_number}`;

    /** Insert return items + restore stock */
    for (const item of items) {
      const billItems = billItemGroups.get(item.product_id);
      const price = billItems[0].price;
      const lineTotal = price * item.quantity;

      await client.query(
        `
        INSERT INTO return_items
        (return_id, product_id, quantity, price, line_total)
        VALUES ($1, $2, $3, $4, $5)
        `,
        [returnId, item.product_id, item.quantity, price, lineTotal],
      );

      let qtyToRestore = item.quantity;

      // We need to figure out which batches to restore to.
      // We'll use LIFO for returns (restore to later batches first)
      // or just any available returnable quantity in bill_items.

      // First, find how much was already returned for this product to skip those units
      let skipQty = returnedQtyMap.get(item.product_id) || 0;

      // Sort billItems by id DESC to do LIFO-like restoration
      const sortedBillItems = [...billItems].sort((a, b) => b.id - a.id);

      for (const bi of sortedBillItems) {
        if (qtyToRestore <= 0) break;

        const biReturnable = bi.quantity;

        // Calculate how much of this specific bill_item is already "returned" (conceptually)
        const biAlreadyReturned = Math.min(biReturnable, skipQty);
        skipQty -= biAlreadyReturned;

        const biAvailableToReturn = biReturnable - biAlreadyReturned;
        if (biAvailableToReturn <= 0) continue;

        const restoreToThisBI = Math.min(biAvailableToReturn, qtyToRestore);

        if (bi.batch_id) {
          await client.query(
            "UPDATE product_batches SET quantity = quantity + $1 WHERE id = $2",
            [restoreToThisBI, bi.batch_id],
          );
        } else {
          await client.query(
            "UPDATE product_batches SET quantity = quantity + $1 WHERE product_id = $2 AND batch_no = 'INITIAL'",
            [restoreToThisBI, item.product_id],
          );
        }

        await client.query(
          `
          INSERT INTO stock_movements
          (product_id, quantity, movement_type, reference, created_by, batch_id)
          VALUES ($1, $2, 'IN', $3, $4, $5)
          `,
          [item.product_id, restoreToThisBI, reference, user_id, bi.batch_id],
        );

        qtyToRestore -= restoreToThisBI;
      }
    }

    /** Update bill returned_amount */
    await client.query(
      `
      UPDATE bills
      SET returned_amount = returned_amount + $1
      WHERE id = $2
      `,
      [totalReturnAmount, bill_id],
    );

    /** Create refund if requested */
    if (refund_required) {
      await client.query(
        `
        INSERT INTO refunds (bill_id, amount, payment_method, reason, refund_by)
        VALUES ($1, $2, $3, $4, $5)
        `,
        [
          bill_id,
          totalReturnAmount,
          payment_method,
          `Refund for return ${returnNumber}`,
          user_id,
        ],
      );
    }

    await logBillEvent({
      client,
      bill_id,
      eventType: "RETURNED",
      performedBy: user_id,
      metadata: {
        items: items,
        refunded: refund_required,
      },
    });

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
  const { bill_id } = req.params;
  const { amount, payment_method, reason } = req.body;
  const { user_id } = req.user;

  if (!amount || amount <= 0)
    throw createHttpError(400, "Invalid refund amount");

  const result = await withTransaction(async (client) => {
    const billRes = await client.query(
      "SELECT * FROM bills WHERE id = $1 FOR UPDATE",
      [bill_id],
    );

    if (!billRes.rows.length) throw createHttpError(404, "Bill not found");

    const bill = billRes.rows[0];

    if (bill.is_void) throw createHttpError(409, "Cannot refund a void bill");

    if (bill.settled) throw createHttpError(409, "Bill already settled");

    /** Calculate remaining refundable amount */
    const refundedSoFar = await getRefundedAmount(client, bill_id);

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
      [bill_id, amount, payment_method, reason, user_id],
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
      [newStatus, bill_id],
    );

    await logBillEvent({
      client,
      bill_id,
      eventType: "REFUNDED",
      performedBy: user_id,
      metadata: {
        amount: amount,
        method: payment_method,
        reason,
      },
    });

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
  const { user_id } = req.user;
  const settlementDate = req.body.date;

  if (!settlementDate) {
    throw createHttpError(400, "settlement date is required");
  }

  const settlement = await withTransaction(async (client) => {
    /* Prevent double settlement */
    const exists = await client.query(
      `SELECT 1 FROM settlements WHERE settlement_date = $1`,
      [settlementDate],
    );

    if (exists.rowCount > 0) {
      throw createHttpError(409, "Day already settled");
    }

    /* Fetch bills */
    const billsRes = await client.query(
      `
      SELECT id, total_amount
      FROM bills
      WHERE settled = false
        AND is_void = false
        AND created_at::date = $1
      FOR UPDATE
      `,
      [settlementDate],
    );

    if (billsRes.rowCount === 0) {
      throw createHttpError(409, "No bills to settle");
    }

    const billIds = billsRes.rows.map((b) => b.id);

    /* Net amount (SOURCE OF TRUTH) */
    const netAmount = billsRes.rows.reduce(
      (sum, b) => sum + Number(b.total_amount),
      0,
    );

    /* Create settlement */
    const settlementRes = await client.query(
      `
      INSERT INTO settlements (
        settlement_date,
        net_amount,
        bills_count,
        settled_by
      )
      VALUES ($1,$2,$3,$4)
      RETURNING *
      `,
      [settlementDate, netAmount, billIds.length, user_id],
    );

    /* Mark bills settled */
    await client.query(
      `
      UPDATE bills
      SET settled = true
      WHERE id = ANY($1)
      `,
      [billIds],
    );

    return settlementRes.rows[0];
  });

  res.status(200).json(
    getSuccessResponse({
      data: settlement,
      message: "Day settled successfully",
      status: 200,
    }),
  );
});

export const getBillsHistory = asyncHandler(async (req, res) => {
  const { user_id } = req.user;

  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  const result = await withTransaction(async (client) => {
    // Get total count for the user
    const countRes = await client.query(
      "SELECT COUNT(*) FROM bills WHERE created_by = $1",
      [user_id],
    );
    const total = parseInt(countRes.rows[0].count);
    const totalPages = Math.ceil(total / limit);

    const billsRes = await client.query(
      `
      SELECT *
      FROM bills
      WHERE created_by = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
      `,
      [user_id, limit, offset],
    );

    return {
      bills: billsRes.rows,
      meta: {
        total,
        totalPages,
        page,
        limit,
      },
    };
  });

  res.status(200).json(
    getSuccessResponse({
      data: result,
      message: "Bills history fetched successfully",
      status: 200,
    }),
  );
});

export const searchBill = asyncHandler(async (req, res) => {
  const { bill_number, business_date, invoice_number } = req.query;

  let query = "";
  let params = [];

  if (bill_number) {
    query = "SELECT id FROM bills WHERE bill_number = $1";
    params = [bill_number];
  } else if (business_date && invoice_number) {
    query =
      "SELECT id FROM bills WHERE business_date = $1 AND invoice_number = $2";
    params = [business_date, invoice_number];
  } else {
    throw createHttpError(
      400,
      "Provide either bill_number or business_date and invoice_number",
    );
  }

  const { rows } = await pool.query(query, params);

  if (!rows.length) {
    throw createHttpError(404, "Bill not found");
  }

  res.json(
    getSuccessResponse({
      data: { bill_id: rows[0].id },
      message: "Bill found",
      status: 200,
    }),
  );
});

export const getBillEvents = asyncHandler(async (req, res) => {
  const { bill_id } = req.params;

  const events = await withTransaction(async (client) => {
    const eventsRes = await client.query(
      `
      SELECT *
      FROM bill_events
      WHERE bill_id = $1
      ORDER BY created_at DESC
      `,
      [bill_id],
    );

    return eventsRes.rows;
  });

  res.status(200).json(
    getSuccessResponse({
      data: events,
      message: "Bill events fetched successfully",
    }),
  );
});

export const getBillDetailsForAdmin = asyncHandler(async (req, res) => {
  const { bill_id } = req.params;

  const result = await withTransaction(async (client) => {
    // 1. Fetch Bill and Items
    const billRes = await client.query(
      `SELECT b.*, u.name as cashier_name 
       FROM bills b 
       JOIN users u ON b.created_by = u.id 
       WHERE b.id = $1`,
      [bill_id],
    );

    if (!billRes.rows.length) throw createHttpError(404, "Bill not found");
    const bill = billRes.rows[0];

    const itemsRes = await client.query(
      `SELECT bi.*, p.barcode 
       FROM bill_items bi 
       JOIN products p ON bi.product_id = p.id 
       WHERE bi.bill_id = $1`,
      [bill_id],
    );

    // 2. Fetch Returns and Return Items
    const returnsRes = await client.query(
      `SELECT r.*, u.name as return_by_name
       FROM returns r
       JOIN users u ON r.return_by = u.id
       WHERE r.bill_id = $1
       ORDER BY r.created_at DESC`,
      [bill_id],
    );

    const returns = [];
    for (const ret of returnsRes.rows) {
      const retItemsRes = await client.query(
        `SELECT DISTINCT ON (ri.id) ri.*, bi.product_name
         FROM return_items ri
         JOIN bill_items bi ON ri.product_id = bi.product_id AND bi.bill_id = $1
         WHERE ri.return_id = $2`,
        [bill_id, ret.id],
      );
      returns.push({ ...ret, items: retItemsRes.rows });
    }

    // 3. Fetch Refunds
    const refundsRes = await client.query(
      `SELECT r.*, u.name as refund_by_name
       FROM refunds r
       JOIN users u ON r.refund_by = u.id
       WHERE r.bill_id = $1
       ORDER BY r.created_at DESC`,
      [bill_id],
    );

    // 4. Fetch Events
    const eventsRes = await client.query(
      `SELECT e.*, u.name as performer_name, u.role as performer_role
       FROM bill_events e
       JOIN users u ON e.performed_by = u.id
       WHERE e.bill_id = $1
       ORDER BY e.created_at ASC`,
      [bill_id],
    );

    // 5. Calculate accounting summary
    const totalRefunded = refundsRes.rows.reduce(
      (sum, r) => sum + Number(r.amount),
      0,
    );
    const totalReturned = returnsRes.rows.reduce(
      (sum, r) => sum + Number(r.total_return_amount),
      0,
    );

    return {
      bill,
      items: itemsRes.rows,
      returns,
      refunds: refundsRes.rows,
      events: eventsRes.rows,
      summary: {
        gross_amount: Number(bill.total_amount),
        total_returned: totalReturned,
        total_refunded: totalRefunded,
        net_value: Number(bill.total_amount) - totalReturned,
      },
    };
  });

  res.json(
    getSuccessResponse({
      data: result,
      message: "Detailed bill info fetched successfully",
      status: 200,
    }),
  );
});
