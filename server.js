require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const mysql = require("mysql2");

const app = express();
const PORT = process.env.PORT || 5000;


app.use(cors());
app.use(express.json());


app.use("/auth/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const authRoutes = require("./routes/auth");
app.use("/api/auth", authRoutes);
app.use("/account", authRoutes);


const adminRoutes = require('./routes/admins');
app.use('/api/admin/auth', adminRoutes);
app.use('/admin', adminRoutes);


const ordersRouter = require('./routes/orders');
app.use('/api/orders', ordersRouter);
app.use('/api/admin/orders', ordersRouter);


const usersRouter = require('./routes/users');
app.use('/api/users', usersRouter);



const userOrdersRouter = require('./routes/userorders');
app.use('/api/userorders', userOrdersRouter);









const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, fileName);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [".jpg", ".jpeg", ".png", ".gif", ".glb", ".gltf"];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error("Ruxsat etilmagan fayl turi!"));
  }
};

const upload = multer({ storage, fileFilter });




// get
app.get("/api/products", (req, res) => {
  const query = "SELECT * FROM products";
  db.query(query, (err, results) => {
    if (err) {
      console.error("Select xatoligi:", err);
      return res.status(500).json({ error: "Ma'lumotlarni olishda xato" });
    }
    res.json(results);
  });
});

// get by id
app.get("/api/products/:id", (req, res) => {
  const productId = req.params.id;
  const query = "SELECT * FROM products WHERE id = ?";
  db.query(query, [productId], (err, results) => {
    if (err) {
      
      console.error("Xato:", err);
      return res.status(500).json({ error: "Ma'lumotlarni olishda xato" });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: "Mahsulot topilmadi" });
    }
    res.json(results[0]); 
  });
});

// post
app.post(
  "/api/products",
  upload.fields([
    { name: "images", maxCount: 5 },
    { name: "model", maxCount: 1 },
  ]),
  (req, res) => {
    const {
      name,
      description,
      price,
      quantity,
      sizes,
      fabric,
      gender,
      color,
      category,
    } = req.body;
    const imageFiles = req.files["images"];
    const modelFile = req.files["model"]?.[0];

    if (!imageFiles || !modelFile) {
      return res
        .status(400)
        .json({ error: "Rasmlar yoki 3D model yetishmayapti" });
    }

    const imagePaths = imageFiles.map((file) => file.filename);
    const modelPath = modelFile.filename;

    const query = `
      INSERT INTO products 
      (name, description, price, quantity, image, model, sizes, fabric, gender, color, category) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      name,
      description,
      price,
      quantity,
      JSON.stringify(imagePaths), // JSON format
      modelPath,
      sizes, // Frontenddan JSON string qilib yuboriladi: '["S","M","L"]'
      fabric,
      gender,
      color,
      category,
    ];

    db.query(query, values, (err, result) => {
      if (err) {
        console.error("Insert xatoligi:", err);
        return res.status(500).json({ error: "Mahsulot qo‘shishda xato" });
      }

      res.status(201).json({ message: "Mahsulot muvaffaqiyatli saqlandi!" });
    });
  }
);

// delete
app.delete("/api/products/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const query = "SELECT * FROM products WHERE id = ?";
    db.query(query, [id], (err, result) => {
      if (err) {
        console.error("Mahsulotni qidirishda xato:", err);
        return res.status(500).send("Serverda xato");
      }

      const product = result[0];
      if (!product) {
        return res.status(404).send("Mahsulot topilmadi");
      }

      const imagePath = path.join(__dirname, "uploads", product.image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }

      const modelPath = path.join(__dirname, "uploads", product.model);
      if (fs.existsSync(modelPath)) {
        fs.unlinkSync(modelPath);
      }

      const deleteQuery = "DELETE FROM products WHERE id = ?";
      db.query(deleteQuery, [id], (err) => {
        if (err) {
          console.error("Mahsulotni o'chirishda xato:", err);
          return res.status(500).send("Mahsulotni o'chirishda xato");
        }

        res
          .status(200)
          .send(
            "Mahsulot va uning rasm va model fayllari muvaffaqiyatli o'chirildi"
          );
      });
    });
  } catch (err) {
    console.error("Xato:", err);
    res.status(500).send("Serverda xato");
  }
});

// edit
app.put(
  "/api/products/:id",
  upload.fields([
    { name: "images", maxCount: 5 },
    { name: "model", maxCount: 1 },
  ]),
  (req, res) => {
    const productId = req.params.id;
    const {
      name,
      description,
      price,
      quantity,
      sizes,
      fabric,
      gender,
      color,
      category,
    } = req.body;

    const imageFiles = req.files["images"];
    const modelFile = req.files["model"]?.[0];

    let imagePaths = [];
    let modelPath = null;

    if (imageFiles) {
      imagePaths = imageFiles.map((file) => file.filename);
    }
    if (modelFile) {
      modelPath = modelFile.filename;
    }

    console.log("Updated product data:", {
      name,
      description,
      price,
      quantity,
      sizes,
      fabric,
      gender,
      color,
      category,
      imagePaths,
      modelPath,
    });

    // SQL query for updating the product
    const query = `
      UPDATE products 
      SET 
        name = ?, description = ?, price = ?, quantity = ?, 
        image = ?, model = ?, sizes = ?, fabric = ?, 
        gender = ?, color = ?, category = ?
      WHERE id = ?
    `;

    const values = [
      name,
      description,
      price,
      quantity,
      JSON.stringify(imagePaths),
      modelPath,
      sizes,
      fabric,
      gender,
      color,
      category,
      productId,
    ];

    db.query(query, values, (err, result) => {
      if (err) {
        console.error("SQL xatoligi:", err);
        return res.status(500).json({ error: "Mahsulotni yangilashda xato" });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Mahsulot topilmadi" });
      }

      res.status(200).json({ message: "Mahsulot muvaffaqiyatli yangilandi" });
    });
  }
);

app.get("/admin/dashboard/stats", async (req, res) => {
  try {
    const [products] = await db.promise().query("SELECT COUNT(*) AS count FROM products");
    const [orders] = await db.promise().query("SELECT COUNT(*) AS count FROM orders");
    const [users] = await db.promise().query("SELECT COUNT(*) AS count FROM users");

    res.json({
      products: products[0].count,
      orders: orders[0].count,
      users: users[0].count,
    });
  } catch (error) {
    console.error("Dashboard statistikasi xatosi:", error);
    res.status(500).json({ error: "Serverda xatolik" });
  }
});


// Connect to MySQL database
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

db.connect((err) => {
  if (err) {
    console.error("Not connected:", err);
    return;
  }
  console.log("Successfully connected to MySQL database");
});

app.listen(PORT, () => {
  console.log(`🚀 Running: http://localhost:${PORT}`);
});
