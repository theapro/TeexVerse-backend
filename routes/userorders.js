const express = require('express');
const router = express.Router();
const mysql = require('mysql2');

// MySQL bog'lanish
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

// GET /orders - Foydalanuvchi buyurtmalarini olish
router.get('/orders', (req, res) => {
  const userId = req.query.user_id;
  if (!userId) return res.status(400).json({ message: 'user_id kerak' });

  const sql = `
    SELECT 
      o.id AS order_id,
      o.address,
      o.city,
      o.postal_code,
      o.phone,
      o.total_amount,
      o.status,
      o.created_at,
      oi.id AS item_id,
      oi.product_id,
      oi.quantity,
      oi.price AS item_price,
      p.name AS product_name,
      p.image AS product_image
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    JOIN products p ON oi.product_id = p.id
    WHERE o.user_id = ?
    ORDER BY o.created_at DESC, o.id DESC
  `;

  db.query(sql, [userId], (err, results) => {
    if (err) return res.status(500).json({ message: 'Xatolik', error: err });
    
    // Buyurtmalarni guruhlash
    const orders = [];
    const orderMap = new Map();

    results.forEach(row => {
      // Agar bu buyurtma ID birinchi marta paydo bo'lsa
      if (!orderMap.has(row.order_id)) {
        // Yangi buyurtma obyekti yaratish
        const order = {
          order_id: row.order_id,
          address: row.address,
          city: row.city,
          postal_code: row.postal_code,
          phone: row.phone,
          total_amount: row.total_amount,
          status: row.status,
          created_at: row.created_at,
          items: []
        };
        
        // Buyurtma elementini map va ro'yxatga qo'shish
        orderMap.set(row.order_id, order);
        orders.push(order);
      }
      
      // Buyurtma mahsulotini qo'shish
      orderMap.get(row.order_id).items.push({
        item_id: row.item_id,
        product_id: row.product_id,
        product_name: row.product_name,
         product_image: JSON.parse(row.product_image),
        quantity: row.quantity,
        item_price: row.item_price
      });
    });
    
    res.json(orders);
  });
});

module.exports = router;