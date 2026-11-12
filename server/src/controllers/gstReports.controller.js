import ExcelJS from "exceljs";
import pool from "../config/db.config.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// returns.created_at is "timestamp without time zone". If your server stores it
// in UTC (Neon default), this converts to the Indian date. If you store it in
// local time already, replace with:  r.created_at::date
const RETURN_DATE = `((r.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata')::date`;

const NOT_VOID = `COALESCE(b.is_void, false) = false`;

const OUTPUT_SQL = `
  SELECT bi.gst_rate::numeric AS rate,
         ROUND(SUM(CASE WHEN bi.gst_rate = 0 THEN bi.line_total ELSE bi.taxable_amount END), 2) AS taxable,
         ROUND(SUM(bi.cgst_amount), 2)    AS cgst,
         ROUND(SUM(bi.sgst_amount), 2)    AS sgst
  FROM bill_items bi
  JOIN bills b ON b.id = bi.bill_id
  WHERE b.business_date BETWEEN $1 AND $2 AND ${NOT_VOID}
  GROUP BY bi.gst_rate
  ORDER BY bi.gst_rate`;

// return_items has no tax columns, so take the rate from the original bill line
// and split the tax-inclusive line_total the same way billing does.
const RETURNS_SQL = `
  WITH line_rate AS (
    SELECT DISTINCT ON (bill_id, product_id) bill_id, product_id, gst_rate
    FROM bill_items
    ORDER BY bill_id, product_id, id
  )
  SELECT COALESCE(lr.gst_rate, 0)::numeric AS rate,
         ROUND(SUM(ri.line_total / (1 + COALESCE(lr.gst_rate, 0) / 100)), 2) AS taxable,
         ROUND(SUM(ri.line_total - ri.line_total / (1 + COALESCE(lr.gst_rate, 0) / 100)) / 2, 2) AS cgst,
         ROUND(SUM(ri.line_total - ri.line_total / (1 + COALESCE(lr.gst_rate, 0) / 100)) / 2, 2) AS sgst
  FROM return_items ri
  JOIN returns r ON r.id = ri.return_id
  LEFT JOIN line_rate lr ON lr.bill_id = r.bill_id AND lr.product_id = ri.product_id
  WHERE ${RETURN_DATE} BETWEEN $1 AND $2
  GROUP BY 1
  ORDER BY 1`;

const INPUT_SQL = `
  SELECT pi.gst_rate::numeric AS rate,
         ROUND(SUM(pi.taxable_amount), 2) AS taxable,
         ROUND(SUM(pi.cgst_amount), 2)    AS cgst,
         ROUND(SUM(pi.sgst_amount), 2)    AS sgst
  FROM purchase_items pi
  JOIN purchases p ON p.id = pi.purchase_id
  WHERE p.invoice_date BETWEEN $1 AND $2
  GROUP BY pi.gst_rate
  ORDER BY pi.gst_rate`;

// Sales billed at 0%: shown as a warning so nobody files with unrated items unnoticed.
const ZERO_RATED_SQL = `
  SELECT ROUND(COALESCE(SUM(bi.line_total), 0), 2) AS sales,
         COUNT(DISTINCT bi.product_id) AS products
  FROM bill_items bi
  JOIN bills b ON b.id = bi.bill_id
  WHERE b.business_date BETWEEN $1 AND $2 AND ${NOT_VOID}
    AND bi.gst_rate = 0`;

const SALES_REGISTER_SQL = `
  SELECT b.business_date AS date,
         COALESCE(b.invoice_number, b.bill_number) AS invoice_no,
         bi.gst_rate::numeric AS rate,
         ROUND(SUM(CASE WHEN bi.gst_rate = 0 THEN bi.line_total ELSE bi.taxable_amount END), 2) AS taxable,
         ROUND(SUM(bi.cgst_amount), 2)    AS cgst,
         ROUND(SUM(bi.sgst_amount), 2)    AS sgst,
         ROUND(SUM(bi.line_total), 2)     AS total
  FROM bill_items bi
  JOIN bills b ON b.id = bi.bill_id
  WHERE b.business_date BETWEEN $1 AND $2 AND ${NOT_VOID}
  GROUP BY b.id, b.business_date, b.invoice_number, b.bill_number, bi.gst_rate
  ORDER BY b.business_date, b.id, bi.gst_rate`;

const PURCHASE_REGISTER_SQL = `
  SELECT p.invoice_date AS date,
         p.invoice_no,
         s.name  AS supplier,
         s.gstin AS supplier_gstin,
         pi.gst_rate::numeric AS rate,
         ROUND(SUM(pi.taxable_amount), 2) AS taxable,
         ROUND(SUM(pi.cgst_amount), 2)    AS cgst,
         ROUND(SUM(pi.sgst_amount), 2)    AS sgst,
         ROUND(SUM(pi.total_amount), 2)   AS total
  FROM purchase_items pi
  JOIN purchases p ON p.id = pi.purchase_id
  LEFT JOIN suppliers s ON s.id = p.supplier_id
  WHERE p.invoice_date BETWEEN $1 AND $2
  GROUP BY p.id, p.invoice_date, p.invoice_no, s.name, s.gstin, pi.gst_rate
  ORDER BY p.invoice_date, p.id, pi.gst_rate`;

const num = (v) => Number(v || 0);
const r2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

function totals(rows) {
  const t = { taxable: 0, cgst: 0, sgst: 0 };
  for (const r of rows) {
    t.taxable += num(r.taxable);
    t.cgst += num(r.cgst);
    t.sgst += num(r.sgst);
  }
  return { taxable: r2(t.taxable), cgst: r2(t.cgst), sgst: r2(t.sgst), tax: r2(t.cgst + t.sgst) };
}

async function sendXlsx(res, filename, sheets) {
  const wb = new ExcelJS.Workbook();
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name);
    ws.columns = s.columns;
    ws.addRows(s.rows);
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: "frozen", ySplit: 1 }];
  }
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
}

export const validateDateRange = (req, res, next) => {
  const { from, to } = req.query;
  if (!DATE_RE.test(from || "") || !DATE_RE.test(to || "") || from > to) {
    return res.status(400).json({ error: "from and to are required as YYYY-MM-DD, from <= to" });
  }
  req.range = [from, to];
  next();
};

// ---------- GST summary ----------
export const getGstSummary = async (req, res) => {
  try {
    const [from, to] = req.range;
    const [out, ret, inp, zero] = await Promise.all([
      pool.query(OUTPUT_SQL, [from, to]),
      pool.query(RETURNS_SQL, [from, to]),
      pool.query(INPUT_SQL, [from, to]),
      pool.query(ZERO_RATED_SQL, [from, to]),
    ]);

    const output = totals(out.rows);
    const returns = totals(ret.rows);
    const input = totals(inp.rows);

    const netCgst = r2(output.cgst - returns.cgst - input.cgst);
    const netSgst = r2(output.sgst - returns.sgst - input.sgst);

    const body = {
      from,
      to,
      output: { rows: out.rows, ...output },
      returns: { rows: ret.rows, ...returns },
      input: { rows: inp.rows, ...input },
      payable: { cgst: netCgst, sgst: netSgst, total: r2(netCgst + netSgst) },
      warnings: {
        zeroRatedSales: num(zero.rows[0].sales),
        zeroRatedProducts: num(zero.rows[0].products),
      },
    };

    if (req.query.format !== "xlsx") return res.json(body);

    const rows = [];
    const add = (section, list, sign = 1) =>
      list.forEach((r) =>
        rows.push({
          section,
          rate: num(r.rate),
          taxable: sign * num(r.taxable),
          cgst: sign * num(r.cgst),
          sgst: sign * num(r.sgst),
          tax: sign * (num(r.cgst) + num(r.sgst)),
        })
      );
    add("Output GST (sales)", out.rows);
    add("Credit notes (returns)", ret.rows, -1);
    add("Input GST (purchases)", inp.rows);
    rows.push({ section: "GST PAYABLE", rate: "", taxable: "", cgst: netCgst, sgst: netSgst, tax: body.payable.total });

    await sendXlsx(res, `gst-summary_${from}_to_${to}`, [
      {
        name: "GST Summary",
        columns: [
          { header: "Section", key: "section", width: 26 },
          { header: "Rate %", key: "rate", width: 9 },
          { header: "Taxable", key: "taxable", width: 14 },
          { header: "CGST", key: "cgst", width: 12 },
          { header: "SGST", key: "sgst", width: 12 },
          { header: "Total tax", key: "tax", width: 12 },
        ],
        rows,
      },
    ]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Report failed" });
  }
};

// ---------- Sales register ----------
export const getSalesRegister = async (req, res) => {
  try {
    const [from, to] = req.range;
    const { rows } = await pool.query(SALES_REGISTER_SQL, [from, to]);
    if (req.query.format !== "xlsx") return res.json({ from, to, rows, ...totals(rows) });

    await sendXlsx(res, `sales-register_${from}_to_${to}`, [
      {
        name: "Sales",
        columns: [
          { header: "Date", key: "date", width: 12 },
          { header: "Invoice no", key: "invoice_no", width: 16 },
          { header: "Rate %", key: "rate", width: 9 },
          { header: "Taxable", key: "taxable", width: 13 },
          { header: "CGST", key: "cgst", width: 11 },
          { header: "SGST", key: "sgst", width: 11 },
          { header: "Total", key: "total", width: 13 },
        ],
        rows,
      },
    ]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Report failed" });
  }
};

// ---------- Purchase register ----------
export const getPurchaseRegister = async (req, res) => {
  try {
    const [from, to] = req.range;
    const { rows } = await pool.query(PURCHASE_REGISTER_SQL, [from, to]);
    if (req.query.format !== "xlsx") return res.json({ from, to, rows, ...totals(rows) });

    await sendXlsx(res, `purchase-register_${from}_to_${to}`, [
      {
        name: "Purchases",
        columns: [
          { header: "Date", key: "date", width: 12 },
          { header: "Invoice no", key: "invoice_no", width: 16 },
          { header: "Supplier", key: "supplier", width: 28 },
          { header: "Supplier GSTIN", key: "supplier_gstin", width: 18 },
          { header: "Rate %", key: "rate", width: 9 },
          { header: "Taxable", key: "taxable", width: 13 },
          { header: "CGST", key: "cgst", width: 11 },
          { header: "SGST", key: "sgst", width: 11 },
          { header: "Total", key: "total", width: 13 },
        ],
        rows,
      },
    ]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Report failed" });
  }
};
