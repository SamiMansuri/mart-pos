export const getRefundedAmount = async (client, bill_id) => {
  const { rows } = await client.query(
    `
    SELECT COALESCE(SUM(amount), 0) AS refunded
    FROM refunds
    WHERE bill_id = $1
    `,
    [bill_id]
  );

  return Number(rows[0].refunded);
};

export const getReturnedQtyMap = async (client, bill_id) => {
  const { rows } = await client.query(
    `
    SELECT product_id, SUM(quantity) as returned_qty
    FROM return_items ri
    JOIN returns r ON r.id = ri.return_id
    WHERE r.bill_id = $1
    GROUP BY product_id
    `,
    [bill_id]
  );

  const map = new Map();
  rows.forEach(r => map.set(r.product_id, Number(r.returned_qty)));
  return map;
};

export const hasRefunds = async (client, bill_id) => {
  const { rows } = await client.query(
    "SELECT 1 FROM refunds WHERE bill_id = $1 LIMIT 1",
    [bill_id]
  );
  return rows.length > 0;
};

export const logBillEvent = async ({
  client,
  bill_id,
  eventType,
  performedBy,
  reason = null,
  metadata = null,
}) => {
  console.log(bill_id);
  await client.query(
    `
    INSERT INTO bill_events
    (bill_id, event_type, performed_by, reason, metadata)
    VALUES ($1, $2, $3, $4, $5)
    `,
    [bill_id, eventType, performedBy, reason, metadata]
  );
};
