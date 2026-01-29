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
} from "../controllers/bills.controller.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { allowAdmin } from "../middlewares/allowAdmin.js";

const router = Router();

router.post("/", requireAuth, createBill);
router.get("/", requireAuth, allowAdmin, getAllBills);
router.get("/bill-history", requireAuth, getBillsHistory);
router.post("/settle", requireAuth, settleDay);
router.get("/:bill_id", requireAuth, getBillById);
router.patch("/:bill_id/void", requireAuth, allowAdmin, voidBill);
router.post("/:bill_id/return", requireAuth, allowAdmin, createReturn);
router.post("/:bill_id/refund", requireAuth, allowAdmin, createRefund);

export default router;
