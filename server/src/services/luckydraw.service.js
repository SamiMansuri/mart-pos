import pool from "../config/db.config.js";

// ─────────────────────────────────────────────────────────────────────────────
// Campaign
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches the currently active campaign if within date range.
 * Returns null if none found.
 */
export const getActiveCampaign = async (client) => {
  const { rows } = await client.query(
    `SELECT * FROM lucky_draw_campaigns
     WHERE status = 'active'
       AND start_date <= CURRENT_DATE
       AND draw_date >= CURRENT_DATE
     LIMIT 1`,
  );
  return rows[0] ?? null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Excluded Products
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a Set of excluded product IDs for a campaign.
 */
export const getExcludedProductIds = async (client, campaignId) => {
  const { rows } = await client.query(
    `SELECT product_id FROM lucky_draw_excluded_products
     WHERE campaign_id = $1`,
    [campaignId],
  );
  return new Set(rows.map((r) => r.product_id));
};

// ─────────────────────────────────────────────────────────────────────────────
// Eligible Amount
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculates eligible bill amount for lucky draw.
 * Uses already-built productMap from billing transaction — no extra DB calls.
 *
 * @param {object[]} items          - Array of { product_id, quantity }
 * @param {Map}      productMap     - product_id -> { selling_price (string), name }
 * @param {Set}      excludedIds    - Set of excluded product IDs
 * @param {number}   roundAdjust    - Round adjustment on the bill
 * @returns {number}
 */
export const calculateEligibleAmount = (
  items,
  productMap,
  excludedIds,
  roundAdjust = 0,
) => {
  let total = 0;

  for (const item of items) {
    if (excludedIds.has(item.product_id)) continue;
    const product = productMap.get(item.product_id);
    if (!product) continue;
    total += parseFloat(product.selling_price) * parseFloat(item.quantity);
  }

  return Math.max(0, total - roundAdjust);
};

// ─────────────────────────────────────────────────────────────────────────────
// Sequence Management
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a random start offset between 1000–9999.
 * Ensures ticket numbers never start from 0001.
 */
export const generateStartOffset = () =>
  Math.floor(Math.random() * (9999 - 1000 + 1)) + 1000;

/**
 * Creates a dedicated Postgres sequence for a campaign.
 * Called once when campaign is created.
 */
export const createCampaignSequence = async (
  client,
  campaignId,
  startOffset,
) => {
  await client.query(
    `CREATE SEQUENCE IF NOT EXISTS lucky_draw_seq_${campaignId}
     START WITH ${startOffset}`,
  );
};

/**
 * Drops the sequence for a campaign.
 * Called when campaign is permanently deleted.
 */
export const dropCampaignSequence = async (client, campaignId) => {
  await client.query(`DROP SEQUENCE IF EXISTS lucky_draw_seq_${campaignId}`);
};

// ─────────────────────────────────────────────────────────────────────────────
// Ticket Number
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gets next unique ticket number from campaign sequence.
 * Atomic — safe for concurrent bills.
 * Format: {PREFIX}-{XXXXX} e.g. LD-2025-04521
 */
const getNextTicketNumber = async (client, campaign) => {
  const { rows } = await client.query(
    `SELECT nextval('lucky_draw_seq_${campaign.id}') AS val`,
  );
  return `${campaign.prefix}-${String(rows[0].val).padStart(5, "0")}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// Entry Insertion
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inserts one lucky draw entry row per ticket number.
 */
const insertEntries = async (
  client,
  { billId, campaignId, customerPhone, eligibleAmount, ticketNumbers },
) => {
  for (const ticketNumber of ticketNumbers) {
    await client.query(
      `INSERT INTO lucky_draw_entries
         (ticket_number, campaign_id, bill_number, customer_phone, eligible_amount)
       VALUES ($1, $2, $3, $4, $5)`,
      [ticketNumber, campaignId, billId, customerPhone, eligibleAmount],
    );
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Main — called from bills controller
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates lucky draw entries for a qualifying bill.
 *
 * @param {object}      params
 * @param {number}      params.billId          - Saved bill ID
 * @param {object[]}    params.items           - Array of { product_id, quantity }
 * @param {Map}         params.productMap      - Already built in createBill
 * @param {number|null} params.customerId      - Customer ID (null = skip)
 * @param {number}      params.roundAdjustment - Round adjustment on bill
 *
 * @returns {{ generated: false, reason: string }
 *          |{ generated: true, ticketNumbers, entryCount,
 *             eligibleAmount, campaignName, drawDate, customerPhone }}
 */
export const generateLuckyDrawEntries = async ({
  billId,
  items,
  productMap,
  customerId,
  roundAdjustment = 0,
}) => {
  if (!customerId) {
    return { generated: false, reason: "No customer linked" };
  }

  const client = await pool.connect();

  try {
    // 1. Active campaign check
    const campaign = await getActiveCampaign(client);
    if (!campaign) {
      return { generated: false, reason: "No active campaign" };
    }

    // 2. Excluded products
    const excludedIds = await getExcludedProductIds(client, campaign.id);

    // 3. Eligible amount — reuses productMap, zero extra DB calls
    const eligibleAmount = calculateEligibleAmount(
      items,
      productMap,
      excludedIds,
      roundAdjustment,
    );

    // 4. Minimum check
    const minAmount = parseFloat(campaign.min_bill_amount);
    if (eligibleAmount < minAmount) {
      console.log(`Eligible ₹${eligibleAmount.toFixed(2)} is below minimum ₹${minAmount}`)
      return {
        generated: false,
        // reason: `Eligible ₹${eligibleAmount.toFixed(2)} is below minimum ₹${minAmount}`,
        reason: `Bill is not eligible for lucky draw`,
      };
    }

    // 5. Entry count
    const entryCount = Math.floor(eligibleAmount / minAmount);

    // 6. Customer phone
    const { rows } = await client.query(
      `SELECT phone, name FROM customers WHERE id = $1`,
      [customerId],
    );

    if (!rows.length || !rows[0].phone) {
      return { generated: false, reason: "Customer has no phone number" };
    }

    const customerPhone = rows[0].phone;

    // 7. Generate tickets + insert atomically
    await client.query("BEGIN");

    const ticketNumbers = [];
    for (let i = 0; i < entryCount; i++) {
      ticketNumbers.push(await getNextTicketNumber(client, campaign));
    }

    await insertEntries(client, {
      billId,
      campaignId: campaign.id,
      customerPhone,
      eligibleAmount,
      ticketNumbers,
    });

    await client.query("COMMIT");
    console.log("Lucky Draw Entries:", rows[0]);

    return {
      generated: true,
      ticketNumbers,
      entryCount,
      eligibleAmount,
      campaignName: campaign.name,
      drawDate: campaign.draw_date,
      customerPhone,
      customerName: rows[0].name,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => { });
    console.error("generateLuckyDrawEntries error:", error);
    return {
      generated: false,
      reason: "Entry generation failed",
      error: error.message,
    };
  } finally {
    client.release();
  }
};
