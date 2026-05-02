import createHttpError from "http-errors";
import pool from "../config/db.config.js";
import { asyncHandler } from "../utils/asynHandler.util.js";
import { getSuccessResponse } from "../utils/response.util.js";
import {
  createCampaignSequence,
  generateStartOffset,
} from "../services/luckydraw.service.js";

export const createCampaign = asyncHandler(async (req, res) => {
  const { name, prefix, min_bill_amount, start_date, draw_date, status } =
    req.body;

  if (!name || !prefix || !min_bill_amount || !start_date || !draw_date) {
    throw createHttpError(400, "All fields are required.");
  }

  if (new Date(draw_date) <= new Date(start_date)) {
    throw createHttpError(400, "Draw date must be after start date.");
  }

  const existing = await pool.query(
    `SELECT * FROM lucky_draw_campaigns WHERE name = $1`,
    [name],
  );

  console.log("existing==>", existing.rows);

  if (existing.rows.length) {
    throw createHttpError(400, "Campaign already exists.");
  }

  const startOffset = generateStartOffset();

  const result = await pool.query(
    `INSERT INTO lucky_draw_campaigns (name, prefix, min_bill_amount, start_date, draw_date, status, start_offset) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [name, prefix, min_bill_amount, start_date, draw_date, status, startOffset],
  );

  const campaign = result.rows[0];

  await createCampaignSequence(pool, campaign.id, startOffset);

  return res.status(201).json(
    getSuccessResponse({
      message: "Campaign created successfully.",
      data: {
        campaign,
      },
    }),
  );
});

export const getActiveCampaign = asyncHandler(async (req, res) => {
  const result = await pool.query(`SELECT * FROM lucky_draw_campaigns LIMIT 1`);

  if (result.rows.length === 0) {
    throw createHttpError(404, "No active campaign found.");
  }

  return res.status(200).json(
    getSuccessResponse({
      message: "Active campaign fetched successfully.",
      data: result.rows[0],
    }),
  );
});

export const getCampaignById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    `SELECT * FROM lucky_draw_campaigns WHERE id = $1`,
    [id],
  );

  if (result.rows.length === 0) {
    throw createHttpError(404, "Campaign not found.");
  }

  return res.status(200).json(
    getSuccessResponse({
      message: "Campaign fetched successfully.",
      data: {
        campaign: result.rows[0],
      },
    }),
  );
});

export const updateCampaign = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, prefix, min_bill_amount, start_date, draw_date, status } =
    req.body;

  if (status && !["active", "inactive", "completed"].includes(status)) {
    throw createHttpError(400, "Invalid status value.");
  }

  if (new Date(draw_date) <= new Date(start_date)) {
    throw createHttpError(400, "Draw date must be after start date.");
  }

  const existing = await pool.query(
    `SELECT id FROM lucky_draw_campaigns WHERE id = $1`,
    [id],
  );

  if (existing.rows.length === 0) {
    throw createHttpError(404, "Campaign not found.");
  }

  const result = await pool.query(
    `UPDATE lucky_draw_campaigns 
     SET 
       name = COALESCE($1, name), 
       prefix = COALESCE($2, prefix), 
       min_bill_amount = COALESCE($3, min_bill_amount), 
       start_date = COALESCE($4, start_date), 
       draw_date = COALESCE($5, draw_date), 
       status = COALESCE($6, status),
       updated_at = NOW()
     WHERE id = $7
     RETURNING *`,
    [name, prefix, min_bill_amount, start_date, draw_date, status, id],
  );

  if (!result.rows.length) {
    throw createHttpError(404, "Campaign not found.");
  }

  return res.status(200).json(
    getSuccessResponse({
      message: "Campaign updated successfully.",
      data: {
        campaign: result.rows[0],
      },
    }),
  );
});

// ─── Excluded Products ───────────────────────────────────────────────────────

export const getExcludedProducts = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    `
    SELECT
      exp.id,
      exp.product_id,
      exp.created_at,
      p.name AS product_name
    FROM lucky_draw_excluded_products exp
    JOIN products p ON p.id = exp.product_id
    JOIN lucky_draw_campaigns c ON c.id = exp.campaign_id
    WHERE exp.campaign_id = $1
    ORDER BY p.name ASC`,
    [id],
  );

  return res.status(200).json(
    getSuccessResponse({
      message: "Excluded products fetched successfully.",
      data: {
        excluded_products: result.rows,
      },
    }),
  );
});

export const addExcludedProduct = asyncHandler(async (req, res) => {
  const { id, product_id } = req.params;

  if (!product_id) {
    throw createHttpError(400, "product_id is required.");
  }

  const campaign = await pool.query(
    `SELECT id FROM lucky_draw_campaigns WHERE id = $1`,
    [id],
  );

  if (campaign.rows.length === 0) {
    throw createHttpError(404, "Campaign not found.");
  }

  const product = await pool.query(
    `SELECT id, name FROM products WHERE id = $1`,
    [product_id],
  );
  if (product.rows.length === 0) {
    throw createHttpError(404, "Product not found.");
  }

  const result = await pool.query(
    `INSERT INTO lucky_draw_excluded_products (campaign_id, product_id)
       VALUES ($1, $2)
       RETURNING *`,
    [id, product_id],
  );

  return res.status(201).json(
    getSuccessResponse({
      message: "Excluded product added successfully.",
      data: {
        excluded_product: result.rows[0],
      },
    }),
  );
});

export const removeExcludedProduct = asyncHandler(async (req, res) => {
  const { id, product_id } = req.params;

  const result = await pool.query(
    `DELETE FROM lucky_draw_excluded_products
       WHERE campaign_id = $1 AND product_id = $2
       RETURNING *`,
    [id, product_id],
  );

  if (result.rows.length === 0) {
    throw createHttpError(404, "Excluded product not found.");
  }

  return res.status(200).json(
    getSuccessResponse({
      message: "Excluded product removed successfully.",
      data: {
        excluded_product: result.rows[0],
      },
    }),
  );
});

export const manualLuckyDrawEntry = asyncHandler(async (req, res) => {
  const { bill_id } = req.query;

  if (!bill_id) {
    throw createHttpError(400, "bill_id is required.");
  }

  const bill = await pool.query(
    `SELECT p.name, p.selling_price, p.id as product_id, bi.quantity, bi.line_total FROM 
    bills b
    JOIN bill_items bi ON bi.bill_id = b.id
    JOIN products p ON p.id = bi.product_id
    WHERE bill_number = $1`,
    [bill_id],
  );
  if (bill.rows.length === 0) {
    throw createHttpError(404, "Bill not found.");
  }

  console.log("bill==>", bill.rows[0]);

  const items = bill.rows.map((item) => {
    return {
      product_id: item.product_id,
      quantity: item.quantity,
    };
  });

  const productMap = new Map();
  items.forEach((item) => {
    productMap.set(item.product_id, {
      selling_price: item.selling_price,
      name: item.name,
    });
  });

  const campaign = await pool.query(
    `SELECT id FROM lucky_draw_campaigns WHERE status = 'active' LIMIT 1`,
  );
  if (campaign.rows.length === 0) {
    throw createHttpError(404, "No active campaign found.");
  }

  const existingEntry = await pool.query(
    `SELECT * FROM lucky_draw_entries WHERE bill_id = $1`,
    [bill_id],
  );

  if (existingEntry.rows.length > 0) {
    throw createHttpError(400, "Bill already has a lucky draw entry.");
  }

  return res.status(201).json(
    getSuccessResponse({
      message: "Manual lucky draw entry added successfully.",
      data: {
        lucky_draw_entry: result.rows[0],
      },
    }),
  );
});
