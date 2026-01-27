export const getRefundedAmount = async (client, billId) => {
  const { rows } = await client.query(
    `
    SELECT COALESCE(SUM(amount), 0) AS refunded
    FROM refunds
    WHERE bill_id = $1
    `,
    [billId]
  );

  return Number(rows[0].refunded);
};

export const getReturnedQtyMap = async (client, billId) => {
  const { rows } = await client.query(
    `
    SELECT product_id, SUM(quantity) as returned_qty
    FROM return_items ri
    JOIN returns r ON r.id = ri.return_id
    WHERE r.bill_id = $1
    GROUP BY product_id
    `,
    [billId]
  );

  const map = new Map();
  rows.forEach(r => map.set(r.product_id, Number(r.returned_qty)));
  return map;
};

export const hasRefunds = async (client, billId) => {
  const { rows } = await client.query(
    "SELECT 1 FROM refunds WHERE bill_id = $1 LIMIT 1",
    [billId]
  );
  return rows.length > 0;
};
