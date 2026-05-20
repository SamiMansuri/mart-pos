export const PRODUCT_QUERIES = {
  GET_ALL: (isAdmin, search, limit, offset) => {
    const isAdminField = isAdmin
      ? ", s.cost_price, p.updated_at, p.updated_by, p.created_by"
      : "";
    return {
      text: `
        SELECT 
          p.id, p.name, p.barcode, p.selling_price, p.sale_type, s.mrp, p.is_active, p.created_at,
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
        WHERE p.is_active = true
        ${search ? `AND (p.name ILIKE $1 OR p.barcode ILIKE $1)` : ""}
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
        WHERE is_active = true
        ${search ? `AND (name ILIKE $1 OR barcode ILIKE $1)` : ""}
      `,
      values: search ? [`%${search}%`] : [],
    };
  },
  GET_BY_BARCODE: (isAdmin) => {
    const fields = isAdmin
      ? "p.*, s.stock_qty, s.cost_price, s.mrp, b.batch_no, b.expiry_date"
      : "p.id, p.name, p.barcode, p.selling_price, p.sale_type, s.mrp, s.stock_qty, p.created_at, b.batch_no, b.expiry_date";
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
      ? "p.*, s.stock_qty, s.cost_price, b.batch_no, b.expiry_date, s.mrp, p.gst_rate, p.hsn_code, p.sale_type"
      : "p.id, p.name, p.barcode, p.selling_price, p.sale_type, s.stock_qty, p.created_at, b.batch_no, b.expiry_date, s.mrp, p.gst_rate, p.hsn_code, p.sale_type";
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
    INSERT INTO products (name, barcode, selling_price, created_by, sale_type, gst_rate, hsn_code)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `,
  UPDATE: `
    UPDATE products
    SET
      name = COALESCE($1, name),
      barcode = COALESCE($2, barcode),
      selling_price = COALESCE($3, selling_price),
      updated_by = $4,
      updated_at = NOW(),
      sale_type = COALESCE($6, sale_type),
      gst_rate = COALESCE($7, gst_rate),
      hsn_code = COALESCE($8, hsn_code)
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
  CREATE: `
    INSERT INTO bills (
      bill_number, total_amount, payment_method, idempotency_key,
      created_by, payment_status, invoice_number, business_date,
      sub_total, round_adjustment,
      is_credit, customer_id, paid_amount
    )
    VALUES ($1, $2, $3, $4, $5, 'PAID', $6, $7, $8, $9, false, NULL, $2)
    RETURNING *
  `,
  CREATE_ITEM: `
    INSERT INTO bill_items (
      bill_id, 
      product_id, 
      quantity, price, line_total, 
      product_name, batch_id, cost_price, mrp, 
      taxable_amount, gst_rate, cgst_amount, sgst_amount
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
    )
  `,
  GET_BY_ID: `SELECT
       b.id AS bill_id,
       b.bill_number,
       b.total_amount,
       b.payment_method,
       b.created_at,
       b.invoice_number,
       bi.id AS item_id,
       bi.quantity,
       bi.price,
       bi.line_total,
       bi.product_name AS snapshot_name,
       bi.mrp,
       p.id AS product_id,
       p.name AS current_name,
       p.barcode AS product_barcode,
       p.sale_type,
       c.name AS customer_name,
       c.phone AS customer_phone,
       c.total_due as customer_total_due,
       b.customer_id as customer_id,
       bi.gst_rate,
       bi.cgst_amount,
       bi.sgst_amount,
       bi.taxable_amount
     FROM bills b
     JOIN bill_items bi ON bi.bill_id = b.id
     JOIN products p ON p.id = bi.product_id
     LEFT JOIN customers c on c.id = b.customer_id
     WHERE b.id = $1 ORDER BY bi.id ASC`,
  CREATE_CREDIT: `
    INSERT INTO bills (
      bill_number, total_amount, payment_method, idempotency_key,
      created_by, payment_status, invoice_number, business_date,
      sub_total, round_adjustment,
      is_credit, customer_id, paid_amount
    )
    VALUES ($1, $2, $3, $4, $5, 'UNPAID', $6, $7, $8, $9, true, $10, $11)
    RETURNING *
  `,
  GET_BY_CUSTOMER_PAGINATED: `
    SELECT * FROM (
      SELECT 
        'BILL' as entry_type,
        id, bill_number, total_amount, payment_status, created_at, created_by, 
        is_void, payment_method, round_adjustment, sub_total, customer_id, returned_amount,
        NULL::int as original_bill_id,
        NULL::text as original_bill_number
      FROM bills 
      WHERE customer_id = $1
      UNION ALL
      SELECT 
        'RETURN' as entry_type,
        r.id, r.return_number as bill_number, -r.total_return_amount as total_amount, 
        CASE WHEN r.is_store_credit THEN 'STORE_CREDIT' ELSE 'REFUNDED' END as payment_status,
        r.created_at, r.return_by as created_by,
        false as is_void, r.payment_method, 0 as round_adjustment, 
        -r.total_return_amount as sub_total, r.customer_id, 0 as returned_amount,
        r.bill_id as original_bill_id,
        b.bill_number as original_bill_number
      FROM returns r
      JOIN bills b ON b.id = r.bill_id
      WHERE r.customer_id = $1
    ) combined
    ORDER BY created_at DESC 
    LIMIT $2 OFFSET $3
  `,
  COUNT_BY_CUSTOMER: `
    SELECT (
      SELECT COUNT(*) FROM bills WHERE customer_id = $1
    ) + (
      SELECT COUNT(*) FROM returns WHERE customer_id = $1
    ) as count
  `,
};

export const CUSTOMER_QUERIES = {
  // --- CRUD ---
  INSERT_CUSTOMER: `
    INSERT INTO customers (name, phone, credit_limit, notes, created_by)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `,

  GET_ALL_CUSTOMERS: `
    SELECT c.id, c.name, c.phone, c.credit_limit, c.total_due, c.notes, c.created_at,
    u.name AS created_by_name
    FROM customers c
    JOIN users u ON u.id = c.created_by
    ORDER BY c.name ASC
  `,
  SEARCH_CUSTOMERS: `
    SELECT id, name, phone, credit_limit, total_due, notes, created_at
    FROM customers
    WHERE name ILIKE $1 OR phone ILIKE $1
    ORDER BY name ASC
    LIMIT 20
  `,

  GET_CUSTOMER_BY_ID: `
    SELECT c.id, c.name, c.phone, c.credit_limit, c.total_due, c.notes, c.created_at,
    u.name AS created_by_name
    FROM customers c
    JOIN users u ON u.id = c.created_by
    WHERE c.id = $1
  `,

  GET_CUSTOMER_BY_PHONE: `
    SELECT id, name, phone, credit_limit, total_due, notes, created_at
    FROM customers
    WHERE phone = $1
  `,

  UPDATE_CUSTOMER: `
    UPDATE customers
    SET name = $1, phone = $2, credit_limit = $3, notes = $4, updated_at = now()
    WHERE id = $5
    RETURNING id, name, phone, credit_limit, total_due, notes, created_at
  `,

  // --- Ledger ---
  GET_CUSTOMER_LEDGER: `
    SELECT id, type, amount, balance_after, reference_id, note, created_at
    FROM customer_ledger
    WHERE customer_id = $1
    ORDER BY created_at DESC
  `,

  GET_CUSTOMER_LEDGER_PAGINATED: `
    SELECT id, type, amount, balance_after, reference_id, note, created_at
    FROM customer_ledger
    WHERE customer_id = $1
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3
  `,

  COUNT_LEDGER: `
    SELECT COUNT(*) FROM customer_ledger WHERE customer_id = $1
  `,

  INSERT_LEDGER_ENTRY: `
    INSERT INTO customer_ledger (customer_id, type, amount, balance_after, reference_id, note, created_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `,

  // --- Payments ---
  INSERT_CREDIT_PAYMENT: `
    INSERT INTO credit_payments (customer_id, amount, note, created_by)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `,

  GET_CREDIT_PAYMENTS: `
    SELECT cp.id, cp.amount, cp.note, cp.created_at,
    u.name AS collected_by
    FROM credit_payments cp
    JOIN users u ON u.id = cp.created_by
    WHERE cp.customer_id = $1
    ORDER BY cp.created_at DESC
  `,
  // --- Balance ---
  UPDATE_TOTAL_DUE: `
    UPDATE customers
    SET total_due = total_due + $1, updated_at = now()
    WHERE id = $2
    RETURNING total_due
  `,

  // Used to compute balance_after before inserting ledger entry
  GET_CURRENT_BALANCE: `
    SELECT total_due FROM customers WHERE id = $1
  `,
};

export const SUPPLIER_QUERIES = {
  GET_ALL: `
    SELECT * FROM suppliers
    ORDER BY name ASC
  `,
  GET_BY_ID: `
    SELECT * FROM suppliers WHERE id = $1
  `,
  CREATE: `
    INSERT INTO suppliers (name, phone, gstin, address, created_by)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `,
};

export const PURCHASE_QUERIES = {
  GET_ALL: `
    SELECT 
      p.*,
      s.name AS supplier_name
    FROM purchases p
    LEFT JOIN suppliers s ON s.id = p.supplier_id
    ORDER BY p.created_at DESC
  `,
  GET_BY_ID: `
    SELECT 
      p.*,
      s.name AS supplier_name,
      s.gstin AS supplier_gstin
    FROM purchases p
    LEFT JOIN suppliers s ON s.id = p.supplier_id
    WHERE p.id = $1
  `,
  GET_ITEMS: `
    SELECT 
      pi.*,
      pr.name AS product_name
    FROM purchase_items pi
    JOIN products pr ON pr.id = pi.product_id
    WHERE pi.purchase_id = $1
  `,
  CREATE: `
    INSERT INTO purchases (supplier_id, invoice_no, invoice_date, total_amount, total_taxable, total_cgst, total_sgst, notes, created_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
  `,
  CREATE_ITEM: `
    INSERT INTO purchase_items (purchase_id, product_id, batch_no, expiry_date, qty, cost_price, mrp, taxable_amount, gst_rate, cgst_amount, sgst_amount, total_amount)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *
  `,
};