import { asyncHandler } from "../utils/asynHandler.util.js";
import pool from "../config/db.config.js";
import { getSuccessResponse } from "../utils/response.util.js";
import { logEvent } from "../services/logs.service.js";
import { withTransaction } from "../utils/transaction.util.js";
import createHttpError from "http-errors";

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

  // Projection based on role
  const isAdmin = req.user.role === "ADMIN";
  // Data query
  const productsQuery = `
    SELECT 
      p.id, p.name, p.barcode, p.selling_price,
      s.stock_qty ${isAdmin ? ', s.cost_price, p.updated_at, p.updated_by, p.created_by, p.created_at' : ''}
    FROM products p
    LEFT JOIN (
      SELECT product_id, SUM(quantity) as stock_qty, MAX(cost_price) as cost_price
      FROM product_batches 
      GROUP BY product_id
    ) s ON p.id = s.product_id
    ${search ? `WHERE (p.name ILIKE $1 OR p.barcode ILIKE $1)` : ""}
    ORDER BY p.created_at DESC
    LIMIT $${search ? 2 : 1} OFFSET $${search ? 3 : 2}
  `;

  console.log(productsQuery);

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
    }),
  );
});

export const getProductById = asyncHandler(async (req, res) => {
  const isAdmin = req.user.role === "ADMIN";
  const fields = isAdmin
    ? "p.*, s.stock_qty, s.cost_price, b.batch_no, b.expiry_date"
    : "p.id, p.name, p.barcode, p.selling_price, s.stock_qty, p.created_at, b.batch_no, b.expiry_date";

  const query = `
    SELECT ${fields} 
    FROM products p 
    LEFT JOIN (
      SELECT product_id, SUM(quantity) as stock_qty, MAX(cost_price) as cost_price
      FROM product_batches 
      GROUP BY product_id
    ) s ON p.id = s.product_id
    LEFT JOIN product_batches b ON p.id = b.product_id AND b.batch_no = 'INITIAL'
    WHERE p.id = $1
  `;
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
  } = req.body;
  const { user_id } = req.user;

  const result = await withTransaction(async (client) => {
    let product;

    try {
      const productRes = await client.query(
        `
        INSERT INTO products (name, barcode, selling_price, created_by)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
        [name, barcode || null, selling_price, user_id]
      );

      product = productRes.rows[0];
    } catch (err) {
      if (err.code === "23505") {
        throw createHttpError(
          409,
          "Product with same name or barcode already exists"
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
    })
  );
});


export const updateProduct = asyncHandler(async (req, res) => {
  const {
    product_name: name,
    barcode,
    selling_price,
  } = req.body;

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
    const updateRes = await client.query(
      `
      UPDATE products
      SET
        name = COALESCE($1, name),
        barcode = COALESCE($2, barcode),
        selling_price = COALESCE($3, selling_price),
        updated_by = $4,
        updated_at = NOW()
      WHERE id = $5
      RETURNING *
      `,
      [name, barcode ?? null, selling_price, user_id, productId],
    );

    const updatedProduct = updateRes.rows[0];

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
        },
        new: {
          name: updatedProduct.name,
          barcode: updatedProduct.barcode,
          selling_price: updatedProduct.selling_price,
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
