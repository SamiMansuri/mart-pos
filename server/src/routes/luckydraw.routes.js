import express from "express";
import {
  createCampaign,
  getActiveCampaign,
  getCampaignById,
  updateCampaign,
  getExcludedProducts,
  addExcludedProduct,
  removeExcludedProduct,
  manualLuckyDrawEntry,
} from "../controllers/luckydraw.controller.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { allowAdmin } from "../middlewares/allowAdmin.js";

const router = express.Router();

router.use(requireAuth);

// Campaign
router.post("/campaigns", createCampaign);
router.get("/campaigns/active", getActiveCampaign);
router.route("/campaigns/:id").get(getCampaignById).put(updateCampaign);

// Excluded products
router.get("/campaigns/:id/excluded-products", getExcludedProducts);
router
  .route("/campaigns/:id/excluded-products/:product_id")
  .post(addExcludedProduct)
  .delete(removeExcludedProduct);

router.post("/campaigns/manual-entry", allowAdmin, manualLuckyDrawEntry);

export default router;
