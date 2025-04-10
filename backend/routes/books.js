// routes/books.js
const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/', async (req, res) => {
    console.log('GET /books request received');
    try {
        const [books] = await pool.query(`
            SELECT 
                id,
                title, 
                author,
                available_quantity,
                quantity
            FROM books
            LIMIT 50
        `);

        if (!books.length) {
            console.warn('No books found in database');
            return res.status(200).json([]);
        }

        res.json(books);
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch books',
            error: err.message
        });
    }
});

module.exports = router;