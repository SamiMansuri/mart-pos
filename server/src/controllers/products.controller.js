import { asyncHandler } from "../utils/asynHandler.util.js";
import pool from "../config/db.config.js";
import { getSuccessResponse } from "../utils/response.util.js";
import { logEvent } from "../services/logs.service.js";
import { withTransaction } from "../utils/transaction.util.js";

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
      s.stock_qty ${isAdmin ? ", s.cost_price, p.updated_at, p.updated_by, p.created_by, p.created_at" : ""}
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
    cost_price,
    selling_price,
    stock_qty,
    batch_no,
    expiry_date,
  } = req.body;
  const { user_id } = req.user;

  const result = await withTransaction(async (client) => {
    const query =
      "INSERT INTO products (name, barcode, cost_price, selling_price, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *";
    const { rows } = await client.query(query, [
      name,
      barcode || null,
      cost_price,
      selling_price,
      user_id,
    ]);

    const product = rows[0];

    // Initialize stock row (Legacy)
    await client.query(
      "INSERT INTO stock (product_id, quantity) VALUES ($1, $2)",
      [product.id, stock_qty ?? 0],
    );

    // Create INITIAL batch
    const batchRes = await client.query(
      "INSERT INTO product_batches (product_id, batch_no, quantity, cost_price, expiry_date, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
      [
        product.id,
        batch_no || "INITIAL",
        stock_qty ?? 0,
        cost_price || 0,
        expiry_date || null,
        user_id,
      ],
    );

    await client.query(
      `
      INSERT INTO stock_movements
        (product_id, quantity, movement_type, reference, created_by, batch_id)
      VALUES
        ($1, $2, $3, $4, $5, $6)
      `,
      [
        product.id,
        stock_qty ?? 0,
        "IN",
        "INITIAL_STOCK",
        user_id,
        batchRes.rows[0].id,
      ],
    );

    await logEvent(client, "PRODUCT_CREATED", user_id, "PRODUCT", product.id);

    return { ...product, stock_qty: stock_qty ?? 0 };
  });

  res.json(
    getSuccessResponse({
      data: result,
      message: "Product created successfully",
      status: 201,
    }),
  );
});

export const updateProduct = asyncHandler(async (req, res) => {
  const {
    product_name: name,
    barcode,
    cost_price,
    selling_price,
    stock_qty,
    batch_no,
    expiry_date,
  } = req.body;

  const { user_id } = req.user;
  const productId = req.params.product_id;

  const result = await withTransaction(async (client) => {
    /* Lock & fetch existing product and stock */
    const { rows } = await client.query(
      `
      SELECT p.name, p.barcode, s.cost_price, p.selling_price, s.stock_qty, b.batch_no, b.expiry_date
      FROM products p
      JOIN (
        SELECT product_id, SUM(quantity) as stock_qty, MAX(cost_price) as cost_price
        FROM product_batches 
        GROUP BY product_id
      ) s ON p.id = s.product_id
      LEFT JOIN product_batches b ON p.id = b.product_id AND b.batch_no = 'INITIAL'
      WHERE p.id = $1
      FOR UPDATE
      `,
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
        cost_price = COALESCE($3, cost_price),
        selling_price = COALESCE($4, selling_price),
        updated_by = $5,
        updated_at = NOW()
      WHERE id = $6
      RETURNING *
      `,
      [name, barcode ?? null, cost_price, selling_price, user_id, productId],
    );

    // Also update batch details in INITIAL batch if provided
    if (batch_no || expiry_date || typeof cost_price === "number") {
      await client.query(
        `
        UPDATE product_batches
        SET 
          batch_no = COALESCE($1, batch_no),
          expiry_date = COALESCE($2, expiry_date),
          cost_price = COALESCE($3, cost_price)
        WHERE product_id = $4 AND batch_no = 'INITIAL'
        `,
        [batch_no, expiry_date || null, cost_price, productId],
      );
    }

    const updatedProduct = updateRes.rows[0];

    /* Handle stock movement (ONLY if stock_qty provided) */
    if (typeof stock_qty === "number" && stock_qty !== oldProduct.stock_qty) {
      const diff = stock_qty - oldProduct.stock_qty;

      await client.query(
        `
        UPDATE stock
        SET quantity = $1
        WHERE product_id = $2
        `,
        [stock_qty, productId],
      );

      // Adjust INITIAL batch to maintain total consistency
      // In a real system, we might create an 'ADJUSTMENT' batch instead,
      // but for gradual migration, updating INITIAL is safest.
      const batchRes = await client.query(
        `
        UPDATE product_batches
        SET quantity = quantity + $1
        WHERE product_id = $2 AND batch_no = 'INITIAL'
        RETURNING id
        `,
        [diff, productId],
      );

      const batchId = batchRes.rows[0]?.id;

      await client.query(
        `
        INSERT INTO stock_movements
          (product_id, quantity, movement_type, reference, created_by, batch_id)
        VALUES
          ($1, $2, $3, $4, $5, $6)
        `,
        [
          productId,
          Math.abs(diff),
          diff > 0 ? "IN" : "OUT",
          "ADMIN_STOCK_UPDATE",
          user_id,
          batchId,
        ],
      );
    }

    /* Log product update with old vs new */
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
          cost_price: oldProduct.cost_price,
          selling_price: oldProduct.selling_price,
          stock_qty: oldProduct.stock_qty,
        },
        new: {
          name: updatedProduct.name,
          barcode: updatedProduct.barcode,
          cost_price: updatedProduct.cost_price,
          selling_price: updatedProduct.selling_price,
          stock_qty:
            typeof stock_qty === "number" ? stock_qty : oldProduct.stock_qty,
        },
      },
    );

    return updatedProduct;
  });

  res.status(200).json(
    getSuccessResponse({
      data: result,
      message: "Product updated successfully",
      status: 200,
    }),
  );
});
