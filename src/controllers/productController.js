import mongoose from "mongoose";
import cloudinary from "../lib/cloudinary.js";
import Product from "../models/Product.js";

export const getAllProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 4000;
    const skip = (page - 1) * limit;

    const products = await Product.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    const totalProducts = await Product.countDocuments();
    const totalPages = Math.ceil(totalProducts / limit);

    if (!products.length && page > 1) {
      return res
        .status(404)
        .json({ message: "No products found on this page" });
    }

    return res.status(200).json({
      products,
      totalPages,
      currentPage: page,
      totalProducts,
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getHomepageCollections = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 200;
    const skip = (page - 1) * limit;

    const searchRegex =
      /fashion|clothing|home|living|health|sports|electronics|mobile/i;

    const query = {
      $or: [
        { product_name: searchRegex },
        { description: searchRegex },
        { product_category_tree: searchRegex },
        { product_specifications: searchRegex },
        { image: searchRegex },
      ],
    };
    const [products, totalProducts] = await Promise.all([
      Product.find(query)
        .sort({ avgRating: -1, salesCount: -1 })
        .limit(limit)
        .skip(skip)
        .lean(),
      Product.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalProducts / limit);

    res.status(200).json({ products, totalPages, currentPage: page });
  } catch (error) {
    console.error("Error fetching homepage collections:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getProductByTitle = async (req, res) => {
  try {
    const { searchTerm } = req.query;
    if (!searchTerm) {
      return res.status(400).json({ message: "Search term is required" });
    }

    const products = await Product.find(
      { $text: { $search: searchTerm } },
      { score: { $meta: "textScore" } }
    )
      .sort({ score: { $meta: "textScore" } })
      .limit(100);

    if (!products.length) {
      return res.status(200).json([]);
    }

    res.status(404).json(products);
  } catch (error) {
    console.error("Error searching products:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getProductById = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid product ID format" });
  }

  try {
    const product = await Product.findById(id).lean();
    if (!product) {
      return res
        .status(404)
        .json({ message: `No product found with ID: ${id}` });
    }
    res.status(200).json(product);
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const createProduct = async (req, res) => {
  try {
    const newProduct = new Product({
      ...req.body,
      seller: req.body.creator,
    });

    const savedProduct = await newProduct.save();
    res.status(201).json({ message: "Product created", product: savedProduct });
  } catch (error) {
    console.error("Error creating product:", error);
    if (error.name === "ValidationError") {
      return res
        .status(400)
        .json({ message: "Validation Error", error: error.message });
    }
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const editProduct = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid product ID format" });
    }

    const {
      product_name,
      description,
      discounted_price,
      retail_price,
      image,
      category,
      brand,
    } = req.body;
    const updates = {
      product_name,
      description,
      discounted_price,
      retail_price,
      image,
      category,
      brand,
    };

    const updatedProduct = await Product.findByIdAndUpdate(id, updates, {
      new: true,
    });
    if (!updatedProduct) {
      return res.status(404).json({ message: "Product not found" });
    }
    res
      .status(200)
      .json({ message: "Product updated", product: updatedProduct });
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid product ID format" });
    }

    const deletedProduct = await Product.findByIdAndDelete(id);
    if (!deletedProduct) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const uploadProductImagesToCloudinary = async (req, res) => {
  try {
    const products = await Product.find();

    if (!products.length) {
      return res.status(404).json({ message: "No products found" });
    }

    for (const product of products) {
      let uploadedImages = [];

      for (const imageUrl of product.image) {
        const uploaded = await cloudinary.v2.uploader.upload(imageUrl, {
          folder: "ecommerce_products",
        });
        uploadedImages.push(uploaded.secure_url);
      }

      product.image = uploadedImages;
      await product.save();
    }

    return res.status(200).json({ message: "Images uploaded successfully" });
  } catch (error) {
    console.error("Error uploading images:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getSellerProducts = async (req, res) => {
  try {
    const { id: userId } = req.params;

    const products = await Product.find({ creator: userId })
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      products,
      totalProducts: products.length,
    });
  } catch (error) {
    console.error("Error fetching seller products:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

export const getAllSellerProducts = async (req, res) => {
  try {
    const products = await Product.find({
      createdBy: { $in: ["seller", "admin"] },
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.status(200).json(products || []);
  } catch (error) {
    console.error("Error fetching seller products:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getProductBySlug = async (req, res) => {
  try {
    const product = await Product.findOne({ uniq_id: req.params.slug }).lean();
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getSimilarProducts = async (req, res) => {
  try {
    const product = await Product.findById(req.params.productId).lean();
    if (!product) return res.status(200).json([]);

    const similarProducts = await Product.find(
      {
        $text: { $search: product.product_name },
        _id: { $ne: product._id },
      },
      {
        score: { $meta: "textScore" },
      }
    )
      .sort({ score: { $meta: "textScore" } })
      .limit(20)
      .lean();

    res.status(200).json(similarProducts);
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
  }
};
