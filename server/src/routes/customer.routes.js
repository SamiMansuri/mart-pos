import { Router } from "express";
import {
  createCustomer,
  getCustomers,
  getCustomerById,
  updateCustomer,
  recordPayment,
  getCustomerLedger,
} from "../controllers/customer.controller.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const router = Router();

router.use(requireAuth); // all customer routes require auth

router.post("/", createCustomer);
router.get("/", getCustomers); // ?q=search term
router.get("/:id", getCustomerById);
router.put("/:id", updateCustomer);
router.patch("/:id", updateCustomer);
router.post("/:id/payments", recordPayment);
router.get("/:id/ledger", getCustomerLedger);

export default router;
