import express from "express";
import {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  getProductByBarcode,
} from "../controllers/products.controller.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { allowCashierOrAdmin } from "../middlewares/allowCashierOrAdmin.js";

const router = express.Router();

router.get("/", requireAuth, getAllProducts);
router.get("/by-barcode/:barcode", requireAuth, getProductByBarcode);
router.get("/:product_id", requireAuth, getProductById);
router.post("/", requireAuth, allowCashierOrAdmin, createProduct);
router.put("/:product_id", requireAuth, allowCashierOrAdmin, updateProduct);

export default router;
