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
  const projection = isAdmin
    ? "*"
    : "id, name, barcode, selling_price, stock_qty, created_at";

  // Data query
  const productsQuery = `
    SELECT ${projection}
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
    }),
  );
});

export const getProductById = asyncHandler(async (req, res) => {
  const isAdmin = req.user.role === "ADMIN";
  const projection = isAdmin
    ? "*"
    : "id, name, barcode, selling_price, stock_qty, created_at";

  const query = `SELECT ${projection} FROM products WHERE id = $1`;
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
  } = req.body;
  const { user_id } = req.user;

  console.log(req.user);

  const result = await withTransaction(async (client) => {
    const query =
      "INSERT INTO products (name, barcode, cost_price, selling_price, stock_qty, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *";
    const { rows } = await client.query(query, [
      name,
      barcode || null,
      cost_price,
      selling_price,
      stock_qty ?? 0,
      user_id,
    ]);

    await client.query(
      `
      INSERT INTO stock_movements
        (product_id, quantity, movement_type, reference, created_by)
      VALUES
        ($1, $2, $3, $4, $5)
      `,
      [rows[0].id, stock_qty ?? 0, "IN", "INITIAL_STOCK", user_id],
    );

    await logEvent(client, "PRODUCT_CREATED", user_id, "PRODUCT", rows[0].id);

    return rows[0];
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
  } = req.body;

  const { user_id } = req.user;
  const productId = req.params.product_id;

  const result = await withTransaction(async (client) => {
    /* Lock & fetch existing product */
    const { rows } = await client.query(
      `
      SELECT name, barcode, cost_price, selling_price, stock_qty
      FROM products
      WHERE id = $1
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

    const updatedProduct = updateRes.rows[0];

    /* Handle stock movement (ONLY if stock_qty provided) */
    if (typeof stock_qty === "number" && stock_qty !== oldProduct.stock_qty) {
      const diff = stock_qty - oldProduct.stock_qty;

      await client.query(
        `
        UPDATE products
        SET stock_qty = $1
        WHERE id = $2
        `,
        [stock_qty, productId],
      );

      await client.query(
        `
        INSERT INTO stock_movements
          (product_id, quantity, movement_type, reference, created_by)
        VALUES
          ($1, $2, $3, $4, $5)
        `,
        [
          productId,
          Math.abs(diff),
          diff > 0 ? "IN" : "OUT",
          "ADMIN_STOCK_UPDATE",
          user_id,
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
