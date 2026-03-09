import express from "express";
import { addStock } from "../controllers/stock.controller.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { allowCashierOrAdmin } from "../middlewares/allowCashierOrAdmin.js";

const router = express.Router();

// Stock routes are accessible by admin and cashier
router.use(requireAuth, allowCashierOrAdmin);

router.post("/add", addStock);

export default router;
