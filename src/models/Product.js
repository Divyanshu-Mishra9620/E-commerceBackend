import mongoose from "mongoose";
const reviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    rating: { type: Number, min: 1, max: 5 },
    comment: { type: String },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    createdBy: {
      type: String,
      enum: ["admin", "seller"],
      required: true,
    },
    uniq_id: { type: String, required: true },
    crawl_timestamp: { type: String },
    product_url: { type: String },
    product_name: { type: String, required: true },
    product_category_tree: { type: String },
    pid: { type: String, required: true },
    retail_price: { type: String },
    discounted_price: { type: String },
    image: { type: String },
    is_FK_Advantage_product: { type: String },
    description: { type: String },
    product_rating: { type: String },
    overall_rating: { type: String },
    brand: { type: String },
    product_specifications: { type: String },
    reviews: [reviewSchema],
    avgRating: { type: Number, default: 0 },
  },
  { timestamps: true }
);

productSchema.index({ seller: 1, isActive: 1 });
productSchema.index({ creator: 1, creatorModel: 1 });
productSchema.index({ "adminInfo.verificationStatus": 1 });

productSchema.virtual("inStock").get(function () {
  return this.stockStatus.available > 0;
});

const Product = mongoose.model("Product", productSchema);
export default Product;
