import { Router } from "express";
import {
  createBill,
  getAllBills,
  getBillById,
  voidBill,
  settleDay,
  createReturn,
  createRefund,
  getBillsHistory,
  searchBill,
  getBillEvents,
  getBillDetailsForAdmin,
  editBill,
} from "../controllers/bills.controller.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { allowAdmin } from "../middlewares/allowAdmin.js";
import { allowCashierOrAdmin } from "../middlewares/allowCashierOrAdmin.js";

const router = Router();

router.post("/", requireAuth, createBill);
router.get("/", requireAuth, allowAdmin, getAllBills);
router.get("/bill-history", requireAuth, getBillsHistory);
router.get("/search", requireAuth, searchBill);
router.post("/settle", requireAuth, settleDay);
router.get("/:bill_id", requireAuth, getBillById);
router.patch("/:bill_id/void", requireAuth, allowCashierOrAdmin, voidBill);
router.post("/:bill_id/return", requireAuth, allowCashierOrAdmin, createReturn);
router.post("/:bill_id/refund", requireAuth, allowCashierOrAdmin, createRefund);
router.get("/:bill_id/events", requireAuth, allowAdmin, getBillEvents);
router.get(
  "/:bill_id/details",
  requireAuth,
  allowAdmin,
  getBillDetailsForAdmin,
);
router.patch("/:bill_id/edit", requireAuth, editBill);

export default router;
