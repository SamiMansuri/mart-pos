import { Router } from "express";
import {
  createBill,
  getAllBills,
  getBillById,
  voidBill,
} from "../controllers/bills.controller.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const router = Router();

router.post("/", requireAuth, createBill);
router.get("/:bill_id", requireAuth, getBillById);
router.get("/", requireAuth, getAllBills);
router.patch("/:bill_id/void", requireAuth, voidBill);

export default router;
