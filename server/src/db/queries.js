export const PRODUCT_QUERIES = {
  GET_ALL: (isAdmin, search, limit, offset) => {
    const isAdminField = isAdmin
      ? ", s.cost_price, p.updated_at, p.updated_by, p.created_by, p.created_at"
      : "";
    return {
      text: `
        SELECT 
          p.id, p.name, p.barcode, p.selling_price, s.mrp,
          s.stock_qty, lb.batch_no as latest_batch, lb.mrp ${isAdminField}
        FROM products p
        LEFT JOIN (
          SELECT product_id, SUM(quantity) as stock_qty, MAX(cost_price) as cost_price, MAX(mrp) as mrp
          FROM product_batches 
          GROUP BY product_id
        ) s ON p.id = s.product_id
        LEFT JOIN LATERAL (
          SELECT batch_no, mrp
          FROM product_batches pb
          WHERE pb.product_id = p.id
          ORDER BY pb.created_at DESC
          LIMIT 1
        ) lb ON true
        ${search ? `WHERE (p.name ILIKE $1 OR p.barcode ILIKE $1)` : ""}
        ORDER BY p.created_at DESC
        LIMIT $${search ? 2 : 1} OFFSET $${search ? 3 : 2}
      `,
      values: search ? [`%${search}%`, limit, offset] : [limit, offset],
    };
  },
  COUNT: (search) => {
    return {
      text: `
        SELECT COUNT(*)
        FROM products
        ${search ? `WHERE (name ILIKE $1 OR barcode ILIKE $1)` : ""}
      `,
      values: search ? [`%${search}%`] : [],
    };
  },
  GET_BY_BARCODE: (isAdmin) => {
    const fields = isAdmin
      ? "p.*, s.stock_qty, s.cost_price, s.mrp, b.batch_no, b.expiry_date"
      : "p.id, p.name, p.barcode, p.selling_price, s.mrp, s.stock_qty, p.created_at, b.batch_no, b.expiry_date";
    return `
      SELECT ${fields} 
      FROM products p 
      LEFT JOIN (
        SELECT product_id, SUM(quantity) as stock_qty, MAX(cost_price) as cost_price, MAX(mrp) as mrp
        FROM product_batches 
        GROUP BY product_id
      ) s ON p.id = s.product_id
      LEFT JOIN product_batches b ON p.id = b.product_id AND b.batch_no = 'INITIAL'
      WHERE p.barcode = $1
    `;
  },
  GET_BY_ID: (isAdmin) => {
    const fields = isAdmin
      ? "p.*, s.stock_qty, s.cost_price, b.batch_no, b.expiry_date, s.mrp"
      : "p.id, p.name, p.barcode, p.selling_price, s.stock_qty, p.created_at, b.batch_no, b.expiry_date, s.mrp";
    return `
      SELECT ${fields} 
      FROM products p 
      LEFT JOIN (
        SELECT product_id, SUM(quantity) as stock_qty, MAX(cost_price) as cost_price, MAX(mrp) as mrp
        FROM product_batches 
        GROUP BY product_id
      ) s ON p.id = s.product_id
      LEFT JOIN product_batches b ON p.id = b.product_id AND b.batch_no = 'INITIAL'
      WHERE p.id = $1
    `;
  },
  CREATE: `
    INSERT INTO products (name, barcode, selling_price, created_by)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `,
  UPDATE: `
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
};

export const BATCH_QUERIES = {
  CREATE_INITIAL: `
    INSERT INTO product_batches (product_id, batch_no, quantity, cost_price, mrp, expiry_date, created_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id
  `,
  UPSERT: `
    INSERT INTO product_batches (product_id, batch_no, quantity, cost_price, mrp, expiry_date, created_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (product_id, batch_no) DO UPDATE 
    SET 
      quantity = product_batches.quantity + EXCLUDED.quantity,
      cost_price = EXCLUDED.cost_price,
      expiry_date = EXCLUDED.expiry_date,
      mrp = EXCLUDED.mrp
    RETURNING id, quantity
  `,
  UPDATE_QTY: `UPDATE product_batches SET quantity = quantity - $1 WHERE id = $2`,
  RESTORE_QTY: `UPDATE product_batches SET quantity = quantity + $1 WHERE id = $2`,
  RESTORE_QTY_INITIAL: `UPDATE product_batches SET quantity = quantity + $1 WHERE product_id = $2 AND batch_no = 'INITIAL'`,
  GET_FOR_DEDUCTION: `
    SELECT id, quantity, cost_price, mrp 
    FROM product_batches 
    WHERE product_id = $1 AND quantity > 0 
    ORDER BY expiry_date ASC NULLS LAST, created_at ASC 
    FOR UPDATE
  `,
  GET_FALLBACK: `
    SELECT id, quantity, cost_price, mrp 
    FROM product_batches 
    WHERE product_id = $1 
    ORDER BY CASE WHEN batch_no = 'INITIAL' THEN 0 ELSE 1 END, created_at ASC 
    LIMIT 1 
    FOR UPDATE
  `,
};

export const STOCK_QUERIES = {
  RECORD_MOVEMENT: `
    INSERT INTO stock_movements (product_id, quantity, movement_type, reference, created_by, batch_id)
    VALUES ($1, $2, $3, $4, $5, $6)
  `,
};

export const BILL_QUERIES = {
  CHECK_IDEMPOTENCY:
    "SELECT id, bill_number, total_amount FROM bills WHERE idempotency_key = $1",
  GET_NEXT_INVOICE_NUMBER: `
    SELECT last_number
    FROM invoice_counters
    WHERE business_date = $1
    FOR UPDATE
  `,
  INSERT_INVOICE_COUNTER: `
    INSERT INTO invoice_counters (business_date, last_number)
    VALUES ($1, 1)
  `,
  UPDATE_INVOICE_COUNTER: `
    UPDATE invoice_counters
    SET last_number = $1
    WHERE business_date = $2
  `,
  CREATE:
    "INSERT INTO bills (bill_number, total_amount, payment_method, idempotency_key, created_by, payment_status, invoice_number, business_date) VALUES ($1, $2, $3, $4, $5, 'PAID', $6, $7) RETURNING *",
  CREATE_ITEM:
    "INSERT INTO bill_items (bill_id, product_id, quantity, price, line_total, product_name, batch_id, cost_price, mrp) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
  GET_BY_ID: `SELECT
       b.id AS bill_id,
       b.bill_number,
       b.total_amount,
       b.payment_method,
       b.created_at,
       bi.id AS item_id,
       bi.quantity,
       bi.price,
       bi.line_total,
       bi.product_name AS snapshot_name,
       bi.mrp,
       p.id AS product_id,
       p.name AS current_name,
       p.barcode AS product_barcode
     FROM bills b
     JOIN bill_items bi ON bi.bill_id = b.id
     JOIN products p ON p.id = bi.product_id
     WHERE b.id = $1 ORDER BY bi.id ASC`,
};
