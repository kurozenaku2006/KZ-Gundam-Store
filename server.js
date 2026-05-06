require("dotenv").config();
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");

const app = express();
app.use(express.json());

app.use(cors({
  origin: "*",
  methods: ["GET","POST"],
  allowedHeaders: ["Content-Type"]
}));

// 🔥 FIREBASE ADMIN
const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// ==============================
// 🛒 CREATE CLAIM (SAFE)
// ==============================
app.post("/claim", async (req, res) => {
  try {
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).send("Missing productId");
    }

    const productRef = db.collection("products").doc(productId);
    const productSnap = await productRef.get();

    if (!productSnap.exists) {
      return res.status(404).send("Product not found");
    }

    const product = productSnap.data();

    // ❌ No stock
    if (product.stock <= 0) {
      return res.status(400).send("Out of stock");
    }

    // 🔥 TRANSACTION (VERY IMPORTANT)
    const claimId = await db.runTransaction(async (t) => {

      const freshSnap = await t.get(productRef);
      const freshData = freshSnap.data();

      if (freshData.stock <= 0) {
        throw new Error("Out of stock");
      }

      // reduce stock
      t.update(productRef, {
        stock: freshData.stock - 1
      });

      // create claim
      const claimRef = db.collection("claims").doc();

      t.set(claimRef, {
        productId,
        productName: freshData.name,
        price: freshData.price,
        status: "PENDING",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return claimRef.id;
    });

    res.json({
      success: true,
      claimId,
      productName: product.name,
      price: product.price
    });

  } catch (e) {
    console.error(e);
    res.status(500).send("Claim failed");
  }
});

// ==============================
// 🔥 HEALTH CHECK
// ==============================
app.get("/", (req, res) => {
  res.send("Server running");
});

// ==============================
app.listen(process.env.PORT || 5000, () => {
  console.log("Server started");
});
