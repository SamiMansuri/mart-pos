import { Router } from "express";
import {
  createBill,
  getAllBills,
  getBillById,
  voidBill,
} from "../controllers/bills.controller.js";

const router = Router();

router.post("/", createBill);
router.get("/:bill_id", getBillById);
router.get("/", getAllBills);
router.patch("/:bill_id/void", voidBill);

export default router;
