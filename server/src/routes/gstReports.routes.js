import express from "express";
import {
  validateDateRange,
  getGstSummary,
  getSalesRegister,
  getPurchaseRegister,
} from "../controllers/gstReports.controller.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const router = express.Router();

router.use(requireAuth);
router.use(validateDateRange);

router.get("/gst-summary", getGstSummary);
router.get("/summary", getGstSummary);
router.get("/sales-register", getSalesRegister);
router.get("/purchase-register", getPurchaseRegister);

export default router;
