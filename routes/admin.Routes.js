const express = require("express");
const router = express.Router();
const {
  getVendors,
  approveVendor,
  createCategory,
  getCategories,
  getOffers,
  getOffer,
  blockUser,
  unblockUser,
} = require("../controllers/admin.Controller");
const { protect, authorize } = require("../middleware/authMiddleware");
const { uploadSingleImage } = require("../middleware/uploadMiddleware");

router.get("/vendors", protect, authorize("admin"), getVendors);
router.put("/vendors/:id/approve", protect, authorize("admin"), approveVendor);

// Category routes with image upload
router.post(
  "/categories",
  protect,
  authorize("admin"),
  uploadSingleImage,
  createCategory
);
router.get("/categories", getCategories);
router.put(
  "/categories/:id",
  protect,
  authorize("admin"),
  uploadSingleImage,
  updateCategory
);

router.delete("/categories/:id", protect, authorize("admin"), deleteCategory);

// Offer routes
router.get("/offers", getOffers);
router.get("/offers/:id", getOffer);

//block routes
router.put("/users/:id/block", protect, authorize("admin"), blockUser);
router.put("/users/:id/unblock", protect, authorize("admin"), unblockUser);

module.exports = router;
