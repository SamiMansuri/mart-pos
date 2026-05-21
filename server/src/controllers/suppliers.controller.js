import createHttpError from "http-errors";
import { SUPPLIER_QUERIES } from "../db/queries.js";
import { asyncHandler } from "../utils/asynHandler.util.js";
import { getSuccessResponse } from "../utils/response.util.js";
import { withTransaction } from "../utils/transaction.util.js";

export const getAllSuppliers = asyncHandler(async (_req, res) => {
  const { rows } = await withTransaction(async (client) => {
    return client.query(SUPPLIER_QUERIES.GET_ALL);
  });

  res.status(200).json(getSuccessResponse({ data: rows, status: 200 }));
});

export const createSupplier = asyncHandler(async (req, res) => {
  const { name, phone, gstin, address } = req.body;
  const { user_id } = req.user;

  if (!name) throw createHttpError(400, "Supplier name is required");

  const result = await withTransaction(async (client) => {
    const { rows } = await client.query(SUPPLIER_QUERIES.CREATE, [
      name,
      phone || null,
      gstin || null,
      address || null,
      user_id,
    ]);
    return rows[0];
  });

  res.status(201).json(getSuccessResponse({ data: result, message: "Supplier created successfully", status: 201 }));
});
