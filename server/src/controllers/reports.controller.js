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
