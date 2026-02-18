import { asyncHandler } from "../utils/asynHandler.util.js";
import pool from "../config/db.config.js";
import { getSuccessResponse } from "../utils/response.util.js";
import { logEvent } from "../services/logs.service.js";
import { withTransaction } from "../utils/transaction.util.js";
import createHttpError from "http-errors";
import {
  PRODUCT_QUERIES,
  BATCH_QUERIES,
  STOCK_QUERIES,
} from "../db/queries.js";

export const getAllProducts = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.max(parseInt(req.query.limit) || 10, 1);
  const offset = (page - 1) * limit;
  const search = req.query.search?.trim();

  // Projection based on role
  const isAdmin = req.user.role === "ADMIN";

  const query = PRODUCT_QUERIES.GET_ALL(isAdmin, search, limit, offset);
  const countQuery = PRODUCT_QUERIES.COUNT(search);

  const [productsRes, countRes] = await Promise.all([
    pool.query(query.text, query.values),
    pool.query(countQuery.text, countQuery.values),
  ]);

  const total = Number(countRes.rows[0].count);
  const totalPages = Math.ceil(total / limit);
  res.json(
    getSuccessResponse({
      data: {
        products: productsRes.rows,
        meta: {
          page,
          limit,
          total,
          totalPages,
        },
      },
      message: "Products fetched successfully",
      status: 200,
    }),
  );
});

export const getProductByBarcode = asyncHandler(async (req, res) => {
  const { barcode } = req.params;
  const isAdmin = req.user.role === "ADMIN";

  const query = PRODUCT_QUERIES.GET_BY_BARCODE(isAdmin);
  const { rows } = await pool.query(query, [barcode]);

  if (rows.length === 0) {
    return res.status(404).json({ message: "Product not found" });
  }

  res.json(
    getSuccessResponse({
      data: rows[0],
      message: "Product fetched successfully",
      status: 200,
    }),
  );
});

export const getProductById = asyncHandler(async (req, res) => {
  const isAdmin = req.user.role === "ADMIN";

  const query = PRODUCT_QUERIES.GET_BY_ID(isAdmin);
  const { rows } = await pool.query(query, [req.params.product_id]);

  if (rows.length === 0) {
    return res.status(404).json({ message: "Product not found" });
  }

  res.json(
    getSuccessResponse({
      data: rows[0],
      message: "Product fetched successfully",
      status: 200,
    }),
  );
});

export const createProduct = asyncHandler(async (req, res) => {
  const {
    product_name: name,
    barcode,
    selling_price,
    batch_no,
    quantity,
    cost_price,
    expiry_date,
    mrp,
    sale_type,
  } = req.body;
  const { user_id } = req.user;

  const result = await withTransaction(async (client) => {
    let product;

    try {
      // 1. Create Product
      const productRes = await client.query(PRODUCT_QUERIES.CREATE, [
        name,
        barcode || null,
        selling_price,
        user_id,
        sale_type || 'UNIT',
      ]);

      product = productRes.rows[0];

      // 2. Create Initial Batch
      const initialBatchNo = batch_no || "INITIAL";
      const initialQty = quantity || 0;
      const initialCost = cost_price || 0;

      const batchRes = await client.query(BATCH_QUERIES.CREATE_INITIAL, [
        product.id,
        initialBatchNo,
        initialQty,
        initialCost,
        mrp || 0,
        expiry_date || null,
        user_id,
      ]);

      const batch = batchRes.rows[0];

      // 3. Record Stock Movement if quantity is provided
      if (initialQty > 0) {
        await client.query(STOCK_QUERIES.RECORD_MOVEMENT, [
          product.id,
          initialQty,
          "IN",
          "INITIAL_STOCK",
          user_id,
          batch.id,
        ]);
      }
    } catch (err) {
      if (err.code === "23505") {
        throw createHttpError(
          409,
          "Product with same name or barcode already exists",
        );
      }
      throw err;
    }

    await logEvent(client, "PRODUCT_CREATED", user_id, "PRODUCT", product.id);

    return product;
  });

  res.status(201).json(
    getSuccessResponse({
      data: result,
      message: "Product created successfully",
    }),
  );
});

export const updateProduct = asyncHandler(async (req, res) => {
  const { product_name: name, barcode, selling_price, mrp, sale_type } = req.body;

  const { user_id } = req.user;
  const productId = req.params.product_id;

  const result = await withTransaction(async (client) => {
    /* Fetch existing product to verify existence */
    const { rows } = await client.query(
      "SELECT * FROM products WHERE id = $1",
      [productId],
    );

    if (!rows.length) {
      throw createHttpError(404, "Product not found");
    }

    const oldProduct = rows[0];

    /* Update product (only provided fields) */
    const updateRes = await client.query(PRODUCT_QUERIES.UPDATE, [
      name,
      barcode ?? null,
      selling_price,
      user_id,
      productId,
      sale_type ?? null,
    ]);

    const updatedProduct = updateRes.rows[0];

    /* Update MRP in the INITIAL batch if provided */
    if (mrp !== undefined) {
      await client.query(
        `UPDATE product_batches SET mrp = $1 WHERE product_id = $2 AND batch_no = 'INITIAL'`,
        [mrp || 0, productId],
      );
    }

    /* Log product update with old vs new metadata */
    await logEvent(
      client,
      "PRODUCT_UPDATED",
      user_id,
      "PRODUCT",
      productId,
      null,
      {
        old: {
          name: oldProduct.name,
          barcode: oldProduct.barcode,
          selling_price: oldProduct.selling_price,
          mrp: oldProduct.mrp,
        },
        new: {
          name: updatedProduct.name,
          barcode: updatedProduct.barcode,
          selling_price: updatedProduct.selling_price,
          mrp: mrp !== undefined ? mrp : oldProduct.mrp,
        },
      },
    );

    return updatedProduct;
  });

  res.status(200).json(
    getSuccessResponse({
      data: result,
      message: "Product updated successfully",
    }),
  );
});
