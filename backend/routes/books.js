const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');

router.get('/', async (req, res) => {
    try {
        const { search = '' } = req.query;

        let query = `
            SELECT
                id,
                title,
                author,
                isbn,
                genre,
                publication_year,
                quantity,
                available_quantity,
                created_at,
                updated_at,
                cover_initials
            FROM books
            WHERE available_quantity > 0
        `;

        let params = [];

        if (search) {
            query += ` AND (title LIKE ? OR author LIKE ? OR isbn = ?)`;
            params.push(`%${search}%`, `%${search}%`, search);
        }

        query += ` ORDER BY title`;

        const [books] = await pool.query(query, params);
        console.log(`Loaded ${books.length} books from database`);

        res.json({
            success: true,
            data: books.map(book => ({
                ...book,
                borrowed_count: book.quantity - book.available_quantity
            }))
        });

    } catch (err) {
        console.error('Error loading books:', err);
        res.status(500).json({
            success: false,
            error: 'Server error loading books'
        });
    }
});


/**
 * @route GET /books/:id
 * @desc Получение детальной информации о книге
 * @access Public
 */
router.get('/:id', async (req, res) => {
    try {
        const [books] = await pool.query(
            `SELECT
                 b.*,
                 (SELECT COUNT(*) FROM loans WHERE book_id = b.id AND is_returned = false) borrowed_count
             FROM books b
             WHERE b.id = ?`,
            [req.params.id]
        );

        if (books.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Книга не найдена'
            });
        }

        res.json({
            success: true,
            book: books[0]
        });

    } catch (err) {
        console.error('Ошибка при получении книги:', err);
        res.status(500).json({
            success: false,
            error: 'Ошибка сервера при получении книги'
        });
    }
});

/**
 * @route POST /books/:id/borrow
 * @desc Взятие книги пользователем
 * @access Private
 */
router.post('/:id/borrow', auth, async (req, res) => {
    try {
        const bookId = req.params.id;
        const userId = req.user.id;

        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            const [[book]] = await connection.query(
                'SELECT available_quantity FROM books WHERE id = ? FOR UPDATE',
                [bookId]
            );

            if (!book || book.available_quantity <= 0) {
                throw new Error('Книга недоступна для взятия');
            }

            const [[loans]] = await connection.query(
                `SELECT COUNT(*) count FROM loans
                 WHERE user_id = ? AND is_returned = false`,
                [userId]
            );

            if (loans.count >= 5) {
                throw new Error('Превышен лимит взятых книг (максимум 5)');
            }

            await connection.query(
                `INSERT INTO loans (
                    user_id,
                    book_id,
                    borrowed_date,
                    due_date
                ) VALUES (?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 14 DAY))`,
                [userId, bookId]
            );

            await connection.query(
                'UPDATE books SET available_quantity = available_quantity - 1 WHERE id = ?',
                [bookId]
            );

            await connection.commit();

            const [[updatedBook]] = await pool.query(
                'SELECT * FROM books WHERE id = ?',
                [bookId]
            );

            res.json({
                success: true,
                book: updatedBook,
                due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
            });

        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }

    } catch (err) {
        console.error('Ошибка при взятии книги:', err);
        res.status(400).json({
            success: false,
            error: err.message || 'Ошибка при взятии книги'
        });
    }
});

/**
 * @route POST /books/:id/return
 * @desc Возврат книги
 * @access Private
 */
router.post('/:id/return', auth, async (req, res) => {
    try {
        const bookId = req.params.id;
        const userId = req.user.id;

        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            const [[loan]] = await connection.query(
                `SELECT id FROM loans
                 WHERE book_id = ? AND user_id = ? AND is_returned = false
                     LIMIT 1 FOR UPDATE`,
                [bookId, userId]
            );

            if (!loan) {
                throw new Error('Активный займ не найден');
            }

            await connection.query(
                `UPDATE loans SET
                                  returned_date = NOW(),
                                  is_returned = true
                 WHERE id = ?`,
                [loan.id]
            );

            await connection.query(
                'UPDATE books SET available_quantity = available_quantity + 1 WHERE id = ?',
                [bookId]
            );

            await connection.commit();

            res.json({
                success: true,
                message: 'Книга успешно возвращена'
            });

        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }

    } catch (err) {
        console.error('Ошибка при возврате книги:', err);
        res.status(400).json({
            success: false,
            error: err.message || 'Ошибка при возврате книги'
        });
    }
});

/**
 * @route POST /books
 * @desc Добавление новой книги (только для администраторов)
 * @access Private (Admin)
 */
router.post('/', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Доступ запрещен'
            });
        }

        const {
            title,
            author,
            isbn,
            genre,
            publication_year,
            quantity
        } = req.body;

        if (!title || !author || !quantity) {
            return res.status(400).json({
                success: false,
                error: 'Обязательные поля: title, author, quantity'
            });
        }

        const coverInitials = `${title.charAt(0)}${author.charAt(0)}`;

        const [result] = await pool.query(
            `INSERT INTO books (
                title,
                author,
                isbn,
                genre,
                publication_year,
                quantity,
                available_quantity,
                cover_initials
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                title,
                author,
                isbn || null,
                genre || null,
                publication_year || null,
                quantity,
                quantity,
                coverInitials
            ]
        );

        const [[book]] = await pool.query(
            'SELECT * FROM books WHERE id = ?',
            [result.insertId]
        );

        res.status(201).json({
            success: true,
            book
        });

    } catch (err) {
        console.error('Ошибка при добавлении книги:', err);
        res.status(500).json({
            success: false,
            error: 'Ошибка сервера при добавлении книги'
        });
    }
});

module.exports = router;