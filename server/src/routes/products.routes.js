import express from "express";
import {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
} from "../controllers/products.controller.js";

const router = express.Router();

router.get("/", getAllProducts);
router.get("/:product_id", getProductById);
router.post("/", createProduct);
router.put("/:product_id", updateProduct);

export default router;
