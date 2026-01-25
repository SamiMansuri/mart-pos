import { asyncHandler } from "../utils/asynHandler.util.js";
import pool from "../config/db.config.js";
import { getSuccessResponse } from "../utils/response.util.js";

export const getAllProducts = asyncHandler(async (req, res) => {
  const query = "SELECT * FROM products ORDER BY created_at DESC";
  const { rows } = await pool.query(query);
  res.json(
    getSuccessResponse({
      data: rows,
      message: "Products fetched successfully",
      status: 200,
    }),
  );
});

export const getProductById = asyncHandler(async (req, res) => {
  const query = "SELECT * FROM products WHERE id = $1";
  const { rows } = await pool.query(query, [req.params.product_id]);
  res.json(
    getSuccessResponse({
      data: rows,
      message: "Product fetched successfully",
      status: 200,
    }),
  );
});

export const createProduct = asyncHandler(async (req, res) => {
  const { name, barcode, cost_price, selling_price, stock_qty } = req.body;
  const query =
    "INSERT INTO products (name, barcode, cost_price, selling_price, stock_qty) VALUES ($1, $2, $3, $4, $5) RETURNING *";
  const { rows } = await pool.query(query, [
    name,
    barcode || null,
    cost_price,
    selling_price,
    stock_qty ?? 0,
  ]);
  res.json(
    getSuccessResponse({
      data: rows,
      message: "Product created successfully",
      status: 201,
    }),
  );
});

export const updateProduct = asyncHandler(async (req, res) => {
  const { name, barcode, cost_price, selling_price, stock_qty } = req.body;
  const query =
    "UPDATE products SET name = $1, barcode = $2, cost_price = $3, selling_price = $4, stock_qty = $5 WHERE id = $6 RETURNING *";
  const { rows } = await pool.query(query, [
    name,
    barcode || null,
    cost_price,
    selling_price,
    stock_qty ?? 0,
    req.params.product_id,
  ]);
  res.json(
    getSuccessResponse({
      data: rows,
      message: "Product updated successfully",
      status: 200,
    }),
  );
});
