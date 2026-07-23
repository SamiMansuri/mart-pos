import express from "express";
import {
  getAllPurchases,
  getPurchaseById,
  createPurchase,
  recordPurchasePayment,
} from "../controllers/purchases.controller.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { allowCashierOrAdmin } from "../middlewares/allowCashierOrAdmin.js";

const router = express.Router();

router.get("/", requireAuth, getAllPurchases);
router.get("/:purchase_id", requireAuth, getPurchaseById);
router.post("/", requireAuth, allowCashierOrAdmin, createPurchase);
router.post("/:purchase_id/payments", requireAuth, allowCashierOrAdmin, recordPurchasePayment);

export default router;
