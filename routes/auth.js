const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db'); 
require('dotenv').config(); 


const SECRET = process.env.SECRET;

//Register
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  
  const checkQuery = "SELECT * FROM users WHERE email = ?";
  db.query(checkQuery, [email], async (err, result) => {
    if (err) return res.status(500).json({ error: "Bazada tekshirishda xatolik" });

    if (result.length > 0) {
      return res.status(400).json({ error: "Ushbu email allaqachon ro'yxatdan o'tgan" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const query = "INSERT INTO users (username, email, password) VALUES (?, ?, ?)";
    db.query(query, [username, email, hashedPassword], (err, result) => {
      if (err) return res.status(500).json({ error: "Bazaga qo‘shishda xatolik" });
      res.status(201).json({ message: "Foydalanuvchi ro'yxatdan o'tdi" });
    });
  });
});

//Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email va parolni kiritish kerak' });
  }

  try {
    const query = 'SELECT * FROM users WHERE email = ?';
    db.query(query, [email], async (err, result) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Serverda xatolik' });
      }

      const user = result[0];
      if (!user) {
        return res.status(400).json({ error: 'Foydalanuvchi topilmadi' });
      }

      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        return res.status(400).json({ error: 'Parol noto‘g‘ri' });
      }

      // JWT yaratish
      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });

      res.json({ message: 'Tizimga kirish muvaffaqiyatli', token });
    });
  } catch (err) {
    console.error('Xatolik:', err);
    res.status(500).json({ error: 'Tizimga kirishda xatolik' });
  }
});

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Token yo‘q' });

  const token = authHeader.split(' ')[1];

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token noto‘g‘ri' });

    req.user = user;
    next();
  });
};

router.get('/account', verifyToken, (req, res) => {
  const userId = req.user.userId;

  const query = "SELECT id, username, email, gender, profile_image FROM users WHERE id = ?";
  db.query(query, [userId], (err, result) => {
    if (err) return res.status(500).json({ error: "Bazada xatolik" });
    if (result.length === 0) return res.status(404).json({ error: "Foydalanuvchi topilmadi" });

    res.json(result[0]);
  });
});

const upload = require('./upload');

router.put('/account', verifyToken, upload.single('profile_image'), (req, res) => {
  const userId = req.user.userId;
  const { username, gender, email, password } = req.body;
  const profileImage = req.file ? req.file.filename : null;

  let updateFields = [];
  let values = [];

  if (username) {
    updateFields.push("username = ?");
    values.push(username);
  }
  if (gender) {
    updateFields.push("gender = ?");
    values.push(gender);
  }
  if (email) {
    updateFields.push("email = ?");
    values.push(email);
  }
  if (password) {
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(password, salt);
    updateFields.push("password = ?");
    values.push(hashedPassword);
  }
  
  if (profileImage) {
    updateFields.push("profile_image = ?");
    values.push(profileImage);
  }

  if (updateFields.length === 0) {
    return res.status(400).json({ error: "Hech qanday ma'lumot berilmadi" });
  }

  const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
  values.push(userId);

  db.query(query, values, (err) => {
    if (err) return res.status(500).json({ error: "Yangilashda xatolik" });

    res.json({ message: "Ma'lumotlar muvaffaqiyatli yangilandi" });
  });
});



module.exports = router;
