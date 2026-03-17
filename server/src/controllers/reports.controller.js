import pool from "../config/db.config.js";
import { asyncHandler } from "../utils/asynHandler.util.js";

export const getReports = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const queryParams = [startDate || "1970-01-01", endDate || "9999-12-31"];

  // 1. Overall stats
  const statsQuery = `
        SELECT 
            SUM(bi.line_total) as total_revenue,
            SUM(bi.quantity * bi.cost_price) as total_cost,
            SUM(bi.line_total - (bi.quantity * bi.cost_price)) as total_profit,
            COUNT(DISTINCT b.id) as total_bills
        FROM bill_items bi
        JOIN bills b ON bi.bill_id = b.id
        WHERE b.is_void = FALSE 
        AND b.created_at::date >= $1::date 
        AND b.created_at::date <= $2::date
    `;

  // 2. Top products by velocity
  const topProductsQuery = `
        SELECT 
            bi.product_name as name,
            SUM(bi.quantity) as sales,
            SUM(bi.line_total) as revenue,
            SUM(bi.line_total - (bi.quantity * bi.cost_price)) as profit
        FROM bill_items bi
        JOIN bills b ON bi.bill_id = b.id
        WHERE b.is_void = FALSE
        AND b.created_at::date >= $1::date 
        AND b.created_at::date <= $2::date
        GROUP BY bi.product_name
        ORDER BY sales DESC
        LIMIT 10
    `;

  const statsRes = await pool.query(statsQuery, queryParams);
  const productsRes = await pool.query(topProductsQuery, queryParams);

  res.json({
    success: true,
    data: {
      summary: statsRes.rows[0],
      topProducts: productsRes.rows,
    },
  });
});

export const getCashierReport = asyncHandler(async (req, res) => {
  const { date } = req.query;
  const reportDate = date || new Date().toISOString().split("T")[0];

  const summaryQuery = `
    SELECT 
      COALESCE(SUM(sub_total), 0) as gross_sales,
      COALESCE(SUM(round_adjustment), 0) as total_round_adjustment,
      COALESCE(SUM(total_amount), 0) as total_sales,
      COALESCE(SUM(credit_amount), 0) as credit_sales
    FROM bills 
    WHERE business_date = $1 AND is_void = false
  `;

  const returnsQuery = `
    SELECT 
      COALESCE(SUM(total_return_amount), 0) as total_returns
    FROM returns 
    WHERE created_at::date = $1
  `;

  const paymentSalesQuery = `
    SELECT 
      payment_method,
      payment_status,
      COALESCE(SUM(total_amount), 0) as amount
    FROM bills 
    WHERE business_date = $1 AND is_void = false
    GROUP BY payment_method, payment_status
  `;

  const paymentReturnsQuery = `
    SELECT 
      payment_method,
      COALESCE(SUM(total_return_amount), 0) as amount
    FROM returns 
    WHERE created_at::date = $1
    GROUP BY payment_method
  `;

  const billsQuery = `
    SELECT b.*, u.user_name as cashier_name
    FROM bills b
    LEFT JOIN users u ON b.created_by = u.id
    WHERE b.business_date = $1
    ORDER BY b.created_at DESC
  `;

  const [summaryRes, returnsRes, pSalesRes, pReturnsRes, billsRes] =
    await Promise.all([
      pool.query(summaryQuery, [reportDate]),
      pool.query(returnsQuery, [reportDate]),
      pool.query(paymentSalesQuery, [reportDate]),
      pool.query(paymentReturnsQuery, [reportDate]),
      pool.query(billsQuery, [reportDate]),
    ]);

  const grossSales = parseFloat(summaryRes.rows[0].gross_sales);
  const totalReturns = parseFloat(returnsRes.rows[0].total_returns);
  const roundAdjustment = parseFloat(summaryRes.rows[0].total_round_adjustment);
  const netSales = grossSales - totalReturns - roundAdjustment;
  const creditSales = parseFloat(summaryRes.rows[0].credit_sales);
  const finalCollected = netSales - creditSales;

  // Process payment breakdown
  const payments = {
    CASH: 0,
    UPI: 0,
  };

  pSalesRes.rows.forEach((row) => {
    if (
      payments.hasOwnProperty(row.payment_method) &&
      row.payment_status === "PAID"
    ) {
      payments[row.payment_method] += parseFloat(row.amount);
    }
  });

  pReturnsRes.rows.forEach((row) => {
    if (payments.hasOwnProperty(row.payment_method)) {
      payments[row.payment_method] -= parseFloat(row.amount);
    }
  });

  res.json({
    success: true,
    data: {
      date: reportDate,
      summary: {
        grossSales,
        totalReturns,
        netSales,
        roundAdjustment,
        creditSales,
        finalCollected,
      },
      paymentBreakdown: payments,
      bills: billsRes.rows,
    },
  });
});
