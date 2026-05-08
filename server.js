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

const ADMIN_PASSCODE = "KZ2026";

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

    if(passcode !== ADMIN_PASSCODE){

      return res.status(401).json({
        success:false,
        message:"Invalid passcode"
      });

    }

    res.json({
      success:true
    });

  } catch(error){

    console.error(error);

    res.status(500).json({
      success:false,
      message:error.message
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
    .get();

    const products = snapshot.docs.map(doc => ({

      id:doc.id,
      ...doc.data()

    }));

    res.json({
      success:true,
      products
    });

  } catch(error){

    console.error(error);

    res.status(500).json({
      success:false,
      message:error.message
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
      productName,
      price

    } = req.body;

    const productRef =
    db.collection("products").doc(productId);

    const productDoc =
    await productRef.get();

    if(!productDoc.exists){

      return res.status(404).json({
        success:false,
        message:"Product not found"
      });

    }

    const productData = productDoc.data();

    if(productData.stock <= 0){

      return res.status(400).json({
        success:false,
        message:"Out of stock"
      });

    }

    /* =========================
       SAFE STOCK UPDATE
    ========================= */

    await db.runTransaction(async (transaction)=>{

      const latestProduct =
      await transaction.get(productRef);

      const latestStock =
      latestProduct.data().stock;

      if(latestStock <= 0){

        throw new Error("Out of stock");

      }

      transaction.update(productRef,{

        stock:latestStock - 1

      });

      const claimRef =
      db.collection("claims").doc();

      transaction.set(claimRef,{

        productId,
        productName,
        price,

        status:"pending",

        createdAt:
        admin.firestore.FieldValue.serverTimestamp()

      });

    });

    res.json({
      success:true,
      message:"Claim successful"
    });

  } catch(error){

    console.error(error);

    res.status(500).json({
      success:false,
      message:error.message
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
    .orderBy("createdAt","desc")
    .get();

    const claims = snapshot.docs.map(doc => ({

      id:doc.id,
      ...doc.data()

    }));

    res.json({
      success:true,
      claims
    });

  } catch(error){

    console.error(error);

    res.status(500).json({
      success:false,
      message:error.message
    });

  }

});

/* =========================
   APPROVE CLAIM
========================= */

app.put("/claims/:id/approve", async (req, res) => {

  try {

    const claimId = req.params.id;

    await db
    .collection("claims")
    .doc(claimId)
    .update({

      status:"approved"

    });

    res.json({
      success:true
    });

  } catch(error){

    console.error(error);

    res.status(500).json({
      success:false,
      message:error.message
    });

  }

});

/* =========================
   REJECT CLAIM
========================= */

app.put("/claims/:id/reject", async (req, res) => {

  try {

    const claimId = req.params.id;

    await db
    .collection("claims")
    .doc(claimId)
    .update({

      status:"rejected"

    });

    res.json({
      success:true
    });

  } catch(error){

    console.error(error);

    res.status(500).json({
      success:false,
      message:error.message
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

    const docRef =
    await db.collection("products").add({

      name,
      price,
      stock,
      image,
      category,

      createdAt:
      admin.firestore.FieldValue.serverTimestamp()

    });

    res.json({
      success:true,
      id:docRef.id
    });

  } catch(error){

    console.error(error);

    res.status(500).json({
      success:false,
      message:error.message
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
    .update(req.body);

    res.json({
      success:true
    });

  } catch(error){

    console.error(error);

    res.status(500).json({
      success:false,
      message:error.message
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
      success:true
    });

  } catch(error){

    console.error(error);

    res.status(500).json({
      success:false,
      message:error.message
    });

  }

});

/* =========================
   SERVER START
========================= */

const PORT = 3000;

app.listen(PORT, ()=>{

  console.log(`
==================================
KUROZENAKU SERVER RUNNING
PORT: ${PORT}
==================================
  `);

});
