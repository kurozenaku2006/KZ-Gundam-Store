require("dotenv").config();

const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");

const app = express();

app.use(cors());
app.use(express.json());

/* =========================
   FIREBASE ADMIN
========================= */

const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

/* =========================
   ADMIN PASSCODE
========================= */

const ADMIN_PASSCODE = "kurozenakuadmin";

/* =========================
   HEALTH CHECK
========================= */

app.get("/", (req, res) => {

  res.json({
    success: true,
    message: "KUROZENAKU SERVER RUNNING"
  });

});

/* =========================
   ADMIN LOGIN
========================= */

app.post("/admin/login", async (req, res) => {

  try {

    const { passcode } = req.body;

    if (passcode !== ADMIN_PASSCODE) {

      return res.status(401).json({
        success: false,
        message: "Invalid passcode"
      });

    }

    res.json({
      success: true
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message
    });

  }

});

/* =========================
   GET PRODUCTS
========================= */

app.get("/products", async (req, res) => {

  try {

    const snapshot = await db
      .collection("products")
      .orderBy("createdAt", "desc")
      .get();

    const products = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json({
      success: true,
      products
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message
    });

  }

});

/* =========================
   ADD PRODUCT
========================= */

app.post("/products", async (req, res) => {

  try {

    const {
      name,
      price,
      stock,
      image,
      category
    } = req.body;

    const docRef = await db
      .collection("products")
      .add({

        name,
        price: Number(price),
        stock: Number(stock || 0),
        image,
        category,

        createdAt:
          admin.firestore.FieldValue.serverTimestamp(),

        updatedAt:
          admin.firestore.FieldValue.serverTimestamp()

      });

    res.json({
      success: true,
      id: docRef.id
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message
    });

  }

});

/* =========================
   UPDATE PRODUCT
========================= */

app.put("/products/:id", async (req, res) => {

  try {

    const productId = req.params.id;

    await db
      .collection("products")
      .doc(productId)
      .update({

        ...req.body,

        updatedAt:
          admin.firestore.FieldValue.serverTimestamp()

      });

    res.json({
      success: true
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message
    });

  }

});

/* =========================
   DELETE PRODUCT
========================= */

app.delete("/products/:id", async (req, res) => {

  try {

    const productId = req.params.id;

    await db
      .collection("products")
      .doc(productId)
      .delete();

    res.json({
      success: true
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message
    });

  }

});

/* =========================
   CREATE CLAIM
========================= */

app.post("/claim", async (req, res) => {

  try {

    const {
      productId,
      customerName,
      contact,
      address,
      note
    } = req.body;

    await db.runTransaction(async transaction => {

      const productRef =
        db.collection("products").doc(productId);

      const productDoc =
        await transaction.get(productRef);

      if (!productDoc.exists) {
        throw new Error("Product not found");
      }

      const productData = productDoc.data();

      const stock =
        Number(productData.stock || 0);

      if (stock <= 0) {
        throw new Error("Out of stock");
      }

      const claimRef =
        db.collection("claims").doc();

      transaction.set(claimRef, {

        productId,

        productName:
          productData.name,

        price:
          productData.price,

        customerName,
        contact,
        address,
        note: note || "",

        status: "pending",

        createdAt:
          admin.firestore.FieldValue.serverTimestamp(),

        updatedAt:
          admin.firestore.FieldValue.serverTimestamp()

      });

    });

    res.json({
      success: true,
      message: "Claim created"
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message
    });

  }

});

/* =========================
   GET CLAIMS
========================= */

app.get("/claims", async (req, res) => {

  try {

    const snapshot = await db
      .collection("claims")
      .orderBy("createdAt", "desc")
      .get();

    const claims = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json({
      success: true,
      claims
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message
    });

  }

});

/* =========================
   UPDATE CLAIM STATUS
========================= */

app.put("/claims/:id/status", async (req, res) => {

  try {

    const claimId = req.params.id;

    const { status } = req.body;

    await db.runTransaction(async transaction => {

      const claimRef =
        db.collection("claims").doc(claimId);

      const claimDoc =
        await transaction.get(claimRef);

      if (!claimDoc.exists) {
        throw new Error("Claim not found");
      }

      const claimData =
        claimDoc.data();

      const oldStatus =
        claimData.status || "pending";

      if (oldStatus === status) {
        return;
      }

      const productRef =
        db.collection("products")
          .doc(claimData.productId);

      const productDoc =
        await transaction.get(productRef);

      const productData =
        productDoc.data();

      let stock =
        Number(productData.stock || 0);

      if (
        oldStatus !== "approved" &&
        status === "approved"
      ) {

        if (stock <= 0) {
          throw new Error("Out of stock");
        }

        stock -= 1;

      }

      if (
        oldStatus === "approved" &&
        status !== "approved"
      ) {

        stock += 1;

      }

      transaction.update(productRef, {

        stock,

        updatedAt:
          admin.firestore.FieldValue.serverTimestamp()

      });

      transaction.update(claimRef, {

        status,

        updatedAt:
          admin.firestore.FieldValue.serverTimestamp()

      });

    });

    res.json({
      success: true
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message
    });

  }

});

/* =========================
   MOVE CLAIM TO BIN
========================= */

app.delete("/claims/:id", async (req, res) => {

  try {

    const claimId = req.params.id;

    await db.runTransaction(async transaction => {

      const claimRef =
        db.collection("claims").doc(claimId);

      const claimDoc =
        await transaction.get(claimRef);

      if (!claimDoc.exists) {
        throw new Error("Claim not found");
      }

      const claimData =
        claimDoc.data();

      if (claimData.status === "approved") {

        const productRef =
          db.collection("products")
            .doc(claimData.productId);

        const productDoc =
          await transaction.get(productRef);

        if (productDoc.exists) {

          const stock =
            Number(productDoc.data().stock || 0);

          transaction.update(productRef, {
            stock: stock + 1
          });

        }

      }

      const binRef =
        db.collection("claimBin").doc();

      transaction.set(binRef, {

        ...claimData,

        originalClaimId: claimId,

        deletedAt:
          admin.firestore.FieldValue.serverTimestamp()

      });

      transaction.delete(claimRef);

    });

    res.json({
      success: true
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message
    });

  }

});

/* =========================
   GET CLAIM BIN
========================= */

app.get("/claim-bin", async (req, res) => {

  try {

    const snapshot = await db
      .collection("claimBin")
      .orderBy("deletedAt", "desc")
      .get();

    const claims = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json({
      success: true,
      claims
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message
    });

  }

});

/* =========================
   SERVER START
========================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

  console.log(`
==================================
KUROZENAKU SERVER RUNNING
PORT: ${PORT}
==================================
  `);

});
