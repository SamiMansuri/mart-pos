import { asyncHandler } from "../utils/asynHandler.util.js";
import pool from "../config/db.config.js";
import { getSuccessResponse } from "../utils/response.util.js";

export const getAllProducts = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.max(parseInt(req.query.limit) || 10, 1);
  const offset = (page - 1) * limit;
  const search = req.query.search?.trim();

  let whereClause = ``;
  const values = [];
  let paramIndex = 1;

  // Search by name OR barcode
  if (search) {
    whereClause += `
      WHERE (
        name ILIKE $${paramIndex}
        OR barcode ILIKE $${paramIndex}
      )
    `;
    values.push(`%${search}%`);
    paramIndex++;
  }

  // Data query
  const productsQuery = `
    SELECT *
    FROM products
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  values.push(limit, offset);

  // Count query
  const countQuery = `
    SELECT COUNT(*)
    FROM products
    ${whereClause}
  `;

  const [productsRes, countRes] = await Promise.all([
    pool.query(productsQuery, values),
    pool.query(countQuery, values.slice(0, paramIndex - 1)),
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
    })
  );
});


export const getProductById = asyncHandler(async (req, res) => {
  const query = "SELECT * FROM products WHERE id = $1";
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
  const { product_name: name, barcode, cost_price, selling_price, stock_qty } = req.body;
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
      data: rows[0],
      message: "Product created successfully",
      status: 201,
    }),
  );
});

export const updateProduct = asyncHandler(async (req, res) => {
  const { product_name: name, barcode, cost_price, selling_price, stock_qty } = req.body;
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
      data: rows[0],
      message: "Product updated successfully",
      status: 200,
    }),
  );
});
