import createHttpError from "http-errors";
import pool from "../config/db.config.js";
import { CUSTOMER_QUERIES as Q } from "../db/queries.js";
import { asyncHandler } from "../utils/asynHandler.util.js";
import { getSuccessResponse } from "../utils/response.util.js";
import { withTransaction } from "../utils/transaction.util.js";

// ─── CREATE CUSTOMER ────────────────────────────────────────────
export const createCustomer = asyncHandler(async (req, res) => {
  const { name, phone, credit_limit = 0, notes = null } = req.body;
  const { user_id } = req.user;

  if (!name) throw createHttpError(400, "name is required");
  try {
    const { rows } = await pool.query(Q.INSERT_CUSTOMER, [
      name,
      phone,
      credit_limit,
      notes,
      user_id,
    ]);
    res.status(201).json(
      getSuccessResponse({
        data: rows[0],
        message: "Customer created successfully",
        status: 201,
      }),
    );
  } catch (err) {
    if (err.code === "23505") {
      // unique violation on phone
      throw createHttpError(409, "Phone number already registered");
    }
    throw err;
  }
});

// ─── GET ALL / SEARCH ────────────────────────────────────────────
export const getCustomers = asyncHandler(async (req, res) => {
  const { q } = req.query;

  const { rows } = q
    ? await pool.query(Q.SEARCH_CUSTOMERS, [`%${q}%`])
    : await pool.query(Q.GET_ALL_CUSTOMERS);

  res.json(
    getSuccessResponse({
      data: rows,
      message: "Customers fetched successfully",
      status: 200,
    }),
  );
});

// ─── GET SINGLE CUSTOMER ─────────────────────────────────────────
export const getCustomerById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { rows } = await pool.query(Q.GET_CUSTOMER_BY_ID, [id]);
  if (!rows.length) throw createHttpError(404, "Customer not found");
  res.json(
    getSuccessResponse({
      data: rows[0],
      message: "Customer fetched successfully",
      status: 200,
    }),
  );
});

// ─── UPDATE CUSTOMER ─────────────────────────────────────────────
export const updateCustomer = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, phone, credit_limit, notes } = req.body;

  try {
    const { rows } = await pool.query(Q.UPDATE_CUSTOMER, [
      name,
      phone,
      credit_limit,
      notes,
      id,
    ]);
    if (!rows.length) throw createHttpError(404, "Customer not found");
    res.json(
      getSuccessResponse({
        data: rows[0],
        message: "Customer updated successfully",
        status: 200,
      }),
    );
  } catch (err) {
    if (err.code === "23505") {
      throw createHttpError(409, "Phone number already registered");
    }
    throw err;
  }
});

// ─── RECORD CREDIT PAYMENT ───────────────────────────────────────
// Called when customer pays back their due (not at billing time)
export const recordPayment = asyncHandler(async (req, res) => {
  const { id: customer_id } = req.params;
  const { amount, note } = req.body;
  const { user_id } = req.user;
  const created_by = user_id;

  if (!amount || amount <= 0) {
    throw createHttpError(400, "Amount must be greater than 0");
  }

  const result = await withTransaction(async (client) => {
    // 1. Get current balance
    const { rows: balRows } = await client.query(Q.GET_CURRENT_BALANCE, [
      customer_id,
    ]);
    if (!balRows.length) throw createHttpError(404, "Customer not found");

    const currentDue = parseFloat(balRows[0].total_due);
    if (amount > currentDue) {
      throw createHttpError(400, `Amount exceeds total due (${currentDue})`);
    }

    // 2. Insert credit_payment record
    const { rows: pmtRows } = await client.query(Q.INSERT_CREDIT_PAYMENT, [
      customer_id,
      amount,
      note || null,
      created_by,
    ]);
    const payment = pmtRows[0];

    // 3. Reduce total_due (negative delta for a payment)
    const { rows: updRows } = await client.query(Q.UPDATE_TOTAL_DUE, [
      -amount,
      customer_id,
    ]);
    const balanceAfter = parseFloat(updRows[0].total_due);

    // 4. Write ledger entry
    await client.query(Q.INSERT_LEDGER_ENTRY, [
      customer_id,
      "PAYMENT",
      amount,
      balanceAfter,
      payment.id,
      note || null,
    ]);

    return { payment, balance_after: balanceAfter };
  });

  res.status(201).json(
    getSuccessResponse({
      data: result,
      message: "Payment recorded successfully",
      status: 201,
    }),
  );
});

// ─── GET LEDGER ──────────────────────────────────────────────────
export const getCustomerLedger = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { limit, page } = req.query;

  const customerRes = await pool.query(Q.GET_CUSTOMER_BY_ID, [id]);
  if (!customerRes.rows.length) {
    throw createHttpError(404, "Customer not found");
  }

  let ledgerRows;
  let totalCount = 0;

  if (limit && page) {
    const limitInt = parseInt(limit);
    const offset = (parseInt(page) - 1) * limitInt;
    const [ledgerRes, countRes] = await Promise.all([
      pool.query(Q.GET_CUSTOMER_LEDGER_PAGINATED, [id, limitInt, offset]),
      pool.query(Q.COUNT_LEDGER, [id]),
    ]);
    ledgerRows = ledgerRes.rows;
    totalCount = parseInt(countRes.rows[0].count);
  } else {
    const ledgerRes = await pool.query(Q.GET_CUSTOMER_LEDGER, [id]);
    ledgerRows = ledgerRes.rows;
    totalCount = ledgerRows.length;
  }

  res.json(
    getSuccessResponse({
      data: {
        customer: customerRes.rows[0],
        ledger: ledgerRows,
        pagination: {
          total: totalCount,
          limit: limit ? parseInt(limit) : totalCount,
          page: page ? parseInt(page) : 1,
          pages: limit ? Math.ceil(totalCount / parseInt(limit)) : 1,
        },
      },
      message: "Customer ledger fetched successfully",
      status: 200,
    }),
  );
});
