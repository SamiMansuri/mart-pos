import express from "express";
import multer from "multer";
import createHttpError from "http-errors";
import {
  extractInvoiceFromPdf,
  saveSupplierMappings,
  getSupplierMappings,
} from "../controllers/invoiceExtractor.controller.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { allowCashierOrAdmin } from "../middlewares/allowCashierOrAdmin.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf")) {
      cb(null, true);
    } else {
      cb(createHttpError(400, "Only PDF files are allowed"));
    }
  },
});

const router = express.Router();

router.post(
  "/extract",
  requireAuth,
  allowCashierOrAdmin,
  upload.single("file"),
  extractInvoiceFromPdf
);

router.post(
  "/mappings",
  requireAuth,
  allowCashierOrAdmin,
  saveSupplierMappings
);

router.get(
  "/mappings/:supplier_id",
  requireAuth,
  allowCashierOrAdmin,
  getSupplierMappings
);

export default router;
