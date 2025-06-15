const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
require('dotenv').config();
const upload = require('./upload'); 

const SECRET = process.env.JWT_SECRET;

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email va parolni kiritish kerak' });
  }

  try {
    const query = 'SELECT * FROM admins WHERE email = ?';
    db.query(query, [email], async (err, result) => {
      if (err) return res.status(500).json({ error: 'Serverda xatolik' });

      const user = result[0];
      if (!user) return res.status(400).json({ error: 'Foydalanuvchi topilmadi' });

      const match = await bcrypt.compare(password, user.password);
      if (!match) return res.status(400).json({ error: 'Parol noto‘g‘ri' });

      const token = jwt.sign({ userId: user.id }, SECRET, { expiresIn: '1h' });

      res.json({ message: 'Tizimga kirish muvaffaqiyatli', token });
    });
  } catch (err) {
    res.status(500).json({ error: 'Tizimga kirishda xatolik' });
  }
});

// Token verification middleware
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Token yo‘q' });

  const token = authHeader.split(' ')[1];

  jwt.verify(token, SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token noto‘g‘ri' });

    req.user = user;
    next();
  });
};

router.get('/account/admin', verifyToken, (req, res) => {
  console.log("Inside /account/admin route");
  const userId = req.user.userId;
  console.log("User ID:", userId);  
  
  const query = "SELECT id, username, email, profile_picture, role, created_at FROM admins WHERE id = ?";
  db.query(query, [userId], (err, result) => {
    if (err) {
      console.log("Database error:", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (result.length === 0) {
      console.log("Admin not found");
      return res.status(404).json({ error: "Admin not found" });
    }
    
    res.json(result[0]);
  });
});


// Update admin settings
// 'admin/settings' uchun to'g'ri yo'lni belgilang
router.put('/settings', verifyToken, upload.single('profilePic'), (req, res) => {
  const { name, email, password } = req.body;
  const userId = req.user.userId;
  
  let updateFields = [];
  let values = [];

  if (name) {
    updateFields.push("username = ?");
    values.push(name);
  }
  if (email) {
    updateFields.push("email = ?");
    values.push(email);
  }
  if (password) {
    const hashedPassword = bcrypt.hashSync(password, 10);
    updateFields.push("password = ?");
    values.push(hashedPassword);
  }
  
  // Agar rasm yuklangan bo'lsa
  if (req.file) {
    const profilePicPath = `uploads/${req.file.filename}`; // Rasmning yo'li
    updateFields.push("profile_picture = ?");
    values.push(profilePicPath);
  }

  if (updateFields.length === 0) {
    return res.status(400).json({ error: "Yangilash uchun hech narsa yuborilmadi" });
  }

  const query = `UPDATE admins SET ${updateFields.join(', ')} WHERE id = ?`;
  values.push(userId);

  db.query(query, values, (err) => {
    if (err) return res.status(500).json({ error: "Yangilashda xatolik" });

    res.json({ message: "Ma'lumotlar yangilandi" });
  });
});


module.exports = router;
