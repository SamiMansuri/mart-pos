import express from "express";
import {
  getAllSuppliers,
  createSupplier,
} from "../controllers/suppliers.controller.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { allowCashierOrAdmin } from "../middlewares/allowCashierOrAdmin.js";

const router = express.Router();

router.get("/", requireAuth, getAllSuppliers);
router.post("/", requireAuth, allowCashierOrAdmin, createSupplier);

export default router;
