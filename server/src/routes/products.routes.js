import express from "express";
import {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  getProductByBarcode,
} from "../controllers/products.controller.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { allowAdmin } from "../middlewares/allowAdmin.js";

const router = express.Router();

router.get("/", requireAuth, getAllProducts);
router.get("/by-barcode/:barcode", requireAuth, getProductByBarcode);
router.get("/:product_id", requireAuth, getProductById);
router.post("/", requireAuth, allowAdmin, createProduct);
router.put("/:product_id", requireAuth, allowAdmin, updateProduct);

export default router;
