const express = require('express');
const router = express.Router();
const mysql = require('mysql2');


const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});




  router.post('/', (req, res) => {
    const { user_id, address, city, postal_code, phone, total_amount, items } = req.body;
    
    if (!user_id || !address || !city || !postal_code || !phone || !total_amount || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Majburiy maydonlar to\'ldirilmagan' });
    }
    

    db.beginTransaction(err => {
      if (err) {
        console.error('Tranzaksiya boshlashda xatolik:', err);
        return res.status(500).json({ message: 'Ichki server xatosi' });
      }
      
      
      const orderSql = `INSERT INTO orders (user_id, address, city, postal_code, phone, total_amount, status, created_at) 
                        VALUES (?, ?, ?, ?, ?, ?, 'yangi', NOW())`;
      
      const orderValues = [
        user_id, 
        address, 
        city, 
        postal_code, 
        phone, 
        total_amount
      ];
      
      db.query(orderSql, orderValues, (err, orderResult) => {
        if (err) {
          return db.rollback(() => {
            console.error('Buyurtma qo\'shishda xatolik:', err);
            res.status(500).json({ message: 'Ichki server xatosi' });
          });
        }
        
        const orderId = orderResult.insertId;
        
        
        const orderItemsPromises = items.map(item => {
          return new Promise((resolve, reject) => {
            const { product_id, quantity, price } = item;
            
            if (!product_id || !quantity || !price) {
              return reject(new Error('Item ma\'lumotlari to\'liq emas'));
            }
            
            const itemSql = `INSERT INTO order_items (order_id, product_id, quantity, price) 
                            VALUES (?, ?, ?, ?)`;
            
            const itemValues = [orderId, product_id, quantity, price];
            
            db.query(itemSql, itemValues, (err, itemResult) => {
              if (err) {
                return reject(err);
              }
              resolve(itemResult);
            });
          });
        });
        
      
        Promise.all(orderItemsPromises)
          .then(() => {
    
            db.commit(err => {
              if (err) {
                return db.rollback(() => {
                  console.error('Tranzaksiya commit qilishda xatolik:', err);
                  res.status(500).json({ message: 'Ichki server xatosi' });
                });
              }
              res.status(201).json({ 
                message: 'Buyurtma muvaffaqiyatli yaratildi', 
                orderId: orderId 
              });
            });
          })
          .catch(err => {
            
            db.rollback(() => {
              console.error('Order item qo\'shishda xatolik:', err);
              res.status(500).json({ message: 'Ichki server xatosi: ' + err.message });
            });
          });
      });
    });
  });


router.get('/', (req, res) => {
  db.query('SELECT * FROM orders ORDER BY created_at DESC', (err, results) => {
    if (err) {
      console.error('Buyurtmalarni olishda xatolik:', err);
      return res.status(500).json({ message: 'Server xatosi' });
    }
    res.json(results);
  });
});


router.get('/', (req, res) => {
  const sql = `
    SELECT * FROM orders 
    ORDER BY created_at DESC
  `;

  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});


router.get('/:id', (req, res) => {
  const orderId = req.params.id;
  const sql = `
    SELECT 
      orders.id AS order_id,
      orders.created_at,
      order_items.id AS item_id,
      order_items.quantity,
      order_items.price AS item_price,
      products.id AS product_id,
      products.name AS product_name,
      products.image AS product_image,
      products.price AS product_price
    FROM orders
    JOIN order_items ON orders.id = order_items.order_id
    JOIN products ON order_items.product_id = products.id
    WHERE orders.id = ?
  `;

  db.query(sql, [orderId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    
    if (results.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    const order = {
      order_id: results[0].order_id,
      created_at: results[0].created_at,
      items: results.map(row => ({
        item_id: row.item_id,
        quantity: row.quantity,
        item_price: row.item_price,
        product: {
          product_id: row.product_id,
          name: row.product_name,
          image: JSON.parse(row.product_image),
          price: row.product_price
        }
      }))
    };

    res.json(order);
  });
});



router.put('/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  db.query(
    'UPDATE orders SET status = ? WHERE id = ?',
    [status, id],
    (err, result) => {
      if (err) {
        console.error('Status yangilanishida xatolik:', err);
        return res.status(500).json({ message: 'Server xatosi' });
      }
      res.json({ message: 'Status yangilandi' });
    }
  );
});


router.delete('/:id', (req, res) => {
  const { id } = req.params;

  db.query('DELETE FROM orders WHERE id = ?', [id], (err, result) => {
    if (err) {
      console.error('Buyurtmani o\'chirishda xatolik:', err);
      return res.status(500).json({ message: 'Server xatosi' });
    }
    res.json({ message: 'Buyurtma o\'chirildi' });
  });
});




module.exports = router;