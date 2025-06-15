const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');

// Set up multer for file storage
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function(req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function(req, file, cb) {
    // Accept images only
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  }
});

// Yangi foydalanuvchi qo'shish - with file upload middleware
router.post('/', upload.single('profile_image'), async (req, res) => {
    const { username, email, password, gender } = req.body;
    const profile_image = req.file ? req.file.filename : null;

    if (!username || !email || !password) {
        return res.status(400).json({ error: 'Username, email va password majburiy' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const sql = 'INSERT INTO users (username, email, password, gender, profile_image) VALUES (?, ?, ?, ?, ?)';
        const values = [username, email, hashedPassword, gender || null, profile_image];

        db.query(sql, values, (err, result) => {
            if (err) {
                console.error('Foydalanuvchi qoshishda xatolik:', err.sqlMessage);
                return res.status(500).json({ error: 'Database error', details: err.sqlMessage });
            }

            res.status(201).json({
                message: 'Foydalanuvchi muvaffaqiyatli qoshildi',
                userId: result.insertId,
                profile_image: profile_image
            });
        });

    } catch (error) {
        console.error('Hashing xatosi:', error);
        res.status(500).json({ error: 'Server error' });
    }
});


// Barcha foydalanuvchilarni olish
router.get('/', (req, res) => {
    const sql = 'SELECT id, username, email, gender, profile_image, created_at FROM users';
    
    db.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching users:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        res.json(results);
    });
});

// ID bo'yicha foydalanuvchini olish
router.get('/:id', (req, res) => {
    const userId = req.params.id;
    const sql = 'SELECT id, username, email, gender, profile_image, created_at FROM users WHERE id = ?';

    db.query(sql, [userId], (err, results) => {
        if (err) {
            console.error(`Error fetching user ${userId}:`, err);
            return res.status(500).json({ error: 'Database error' });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(results[0]);
    });
});

// Foydalanuvchini o'chirish
router.delete('/:id', (req, res) => {
    const userId = req.params.id;
    const sql = 'DELETE FROM users WHERE id = ?';

    db.query(sql, [userId], (err, result) => {
        if (err) {
            console.error(`Error deleting user ${userId}:`, err);
            return res.status(500).json({ error: 'Database error' });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ message: 'Foydalanuvchi ochirildi' });
    });
});

module.exports = router;