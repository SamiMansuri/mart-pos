import createHttpError from "http-errors";
import pool from "../config/db.config.js";
import { asyncHandler } from "../utils/asynHandler.util.js";
import { getSuccessResponse } from "../utils/response.util.js";
import {
  createCampaignSequence,
  generateStartOffset,
  generateLuckyDrawEntries,
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
  const { bill_id, customer_id } = req.body;

  if (!bill_id) {
    throw createHttpError(400, "bill_id is required.");
  }

  // 1. Fetch bill details
  const billRes = await pool.query(
    `SELECT b.id, b.bill_number, b.customer_id, b.round_adjustment, b.total_amount, b.business_date
     FROM bills b 
     WHERE b.id = $1`,
    [bill_id],
  );

  if (!billRes.rows.length) {
    throw createHttpError(404, "Bill not found.");
  }

  const bill = billRes.rows[0];

  // 2. Fetch active campaign
  const campaignRes = await pool.query(
    `SELECT * FROM lucky_draw_campaigns WHERE status = 'active' LIMIT 1`,
  );
  if (campaignRes.rows.length === 0) {
    throw createHttpError(404, "No active lucky draw campaign found.");
  }
  const campaign = campaignRes.rows[0];

  // 3. Date Validation: Bill date must be between campaign start and draw date
  // business_date usually comes in 'YYYY-MM-DD' format
  const billDate = new Date(bill.business_date);
  const startDate = new Date(campaign.start_date);
  const drawDate = new Date(campaign.draw_date);

  // Simple string comparison or date comparison
  if (billDate < startDate || billDate > drawDate) {
    throw createHttpError(
      400,
      `Bill is not eligible for lucky draw`,
    );
  }

  // 4. Determine customer
  const finalCustomerId = customer_id || bill.customer_id;
  if (!finalCustomerId) {
    throw createHttpError(
      400,
      "Bill is not linked to a customer and no customer_id was provided.",
    );
  }

  // 5. Check for existing lucky draw entries
  const existingEntry = await pool.query(
    `SELECT * FROM lucky_draw_entries WHERE bill_number = $1`,
    [bill.bill_number],
  );

  if (existingEntry.rows.length > 0) {
    throw createHttpError(400, "Bill already has a lucky draw entry.");
  }

  // 4. Fetch bill items for eligible amount calculation
  const itemsRes = await pool.query(
    `SELECT bi.product_id, bi.quantity, p.selling_price, p.name
     FROM bill_items bi
     JOIN products p ON p.id = bi.product_id
     WHERE bi.bill_id = $1`,
    [bill.id],
  );

  if (itemsRes.rows.length === 0) {
    throw createHttpError(400, "Bill has no items.");
  }

  const normalizedItems = itemsRes.rows.map((item) => ({
    product_id: item.product_id,
    quantity: parseFloat(item.quantity),
  }));

  const productMap = new Map();
  itemsRes.rows.forEach((item) => {
    productMap.set(item.product_id, {
      selling_price: item.selling_price,
      name: item.name,
    });
  });

  // 5. Generate lucky draw entries
  const luckyDrawResult = await generateLuckyDrawEntries({
    billId: bill.bill_number,
    items: normalizedItems,
    productMap,
    customerId: finalCustomerId,
    roundAdjustment: Number(bill.round_adjustment || 0),
  });

  if (!luckyDrawResult.generated) {
    throw createHttpError(400, luckyDrawResult.reason || "Failed to generate lucky draw entries.");
  }

  return res.status(201).json(
    getSuccessResponse({
      message: "Lucky draw entries generated successfully.",
      data: {
        lucky_draw: {
          ticket_numbers: luckyDrawResult.ticketNumbers,
          entry_count: luckyDrawResult.entryCount,
          eligible_amount: luckyDrawResult.eligibleAmount,
          campaign_name: luckyDrawResult.campaignName,
          draw_date: luckyDrawResult.drawDate,
        },
      },
    }),
  );
});

export const getLuckyDrawByBill = asyncHandler(async (req, res) => {
  const { bill_number } = req.params;

  const result = await pool.query(
    `SELECT * FROM lucky_draw_entries WHERE bill_number = $1`,
    [bill_number],
  );

  return res.status(200).json(
    getSuccessResponse({
      message: "Lucky draw entries fetched successfully.",
      data: result.rows,
    }),
  );
});
