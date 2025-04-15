const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const { logDatabaseError } = require('../utils/logger'); // Убедитесь что путь правильный

// Получение списка доступных книг
router.get('/', async (req, res) => {
    try {
        const { search = '' } = req.query;

        // Основной запрос без LIMIT
        let query = `
            SELECT
                id, title, author, isbn, genre,
                publication_year, quantity,
                available_quantity, cover_initials
            FROM books
            WHERE available_quantity > 0
        `;

        const params = [];

        if (search) {
            query += ` AND (title LIKE ? OR author LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
        }

        query += ` ORDER BY title`; // Сортировка по названию

        // Выполняем запрос
        const [books] = await pool.query(query, params);

        res.json({
            success: true,
            data: books // Все найденные книги
        });

    } catch (err) {
        console.error('Ошибка при загрузке книг:', err);
        res.status(500).json({
            success: false,
            error: 'Не удалось загрузить книги'
        });
    }
});

// Получение детальной информации о книге
router.get('/:id', async (req, res) => {
    try {
        const bookId = parseInt(req.params.id);
        if (isNaN(bookId)) {
            return res.status(400).json({
                success: false,
                error: 'Некорректный ID книги'
            });
        }

        const [books] = await pool.query(
            `SELECT
                 b.*,
                 (SELECT COUNT(*) FROM loans
                  WHERE book_id = b.id AND is_returned = 0) as borrowed_count
             FROM books b
             WHERE b.id = ?`,
            [bookId]
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
        logDatabaseError(`GET /books/${req.params.id}`, err);
        res.status(500).json({
            success: false,
            error: 'Ошибка при получении информации о книге'
        });
    }
});

// Взятие книги в займ
router.post('/:id/borrow', auth, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const bookId = parseInt(req.params.id);
        const userId = req.user.id;

        if (isNaN(bookId)) {
            throw new Error('Некорректный ID книги');
        }

        await connection.beginTransaction();

        // 1. Проверяем доступность книги с блокировкой строки
        const [[book]] = await connection.query(
            `SELECT available_quantity FROM books
             WHERE id = ? FOR UPDATE`,
            [bookId]
        );

        if (!book || book.available_quantity <= 0) {
            throw new Error('Книга недоступна для взятия');
        }

        // 2. Проверяем лимит пользователя
        const [[activeLoans]] = await connection.query(
            `SELECT COUNT(*) as count FROM loans
             WHERE user_id = ? AND is_returned = 0`,
            [userId]
        );

        if (activeLoans.count >= 5) {
            throw new Error('Достигнут лимит взятых книг (максимум 5)');
        }

        // 3. Создаем запись о займе
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 14); // Срок - 14 дней

        const [loanResult] = await connection.query(
            `INSERT INTO loans (
                user_id, book_id, borrowed_date, due_date
            ) VALUES (?, ?, NOW(), ?)`,
            [userId, bookId, dueDate]
        );

        // 4. Уменьшаем количество доступных книг
        await connection.query(
            `UPDATE books SET
                available_quantity = available_quantity - 1
             WHERE id = ?`,
            [bookId]
        );

        await connection.commit();

        // 5. Формируем ответ
        const [[updatedBook]] = await pool.query(
            `SELECT b.*,
                    (SELECT COUNT(*) FROM loans
                     WHERE book_id = b.id AND is_returned = 0) as borrowed_count
             FROM books b
             WHERE b.id = ?`,
            [bookId]
        );

        res.json({
            success: true,
            book: updatedBook,
            loan: {
                id: loanResult.insertId,
                due_date: dueDate.toISOString()
            }
        });

    } catch (err) {
        await connection.rollback();
        console.error('[BORROW ERROR]', {
            bookId: req.params.id,
            userId: req.user?.id,
            error: err.message
        });
        res.status(400).json({
            success: false,
            error: err.message || 'Ошибка при взятии книги'
        });
    } finally {
        connection.release();
    }
});

// Возврат книги (исправленная и надежная версия)
router.post('/loans/:id/return', auth, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const loanId = parseInt(req.params.id);
        const userId = req.user.id;

        if (isNaN(loanId)) {
            throw new Error('Некорректный ID займа');
        }

        console.log(`[RETURN] User ${userId} returning loan ${loanId}`);

        await connection.beginTransaction();

        // 1. Находим активный займ с блокировкой
        const [[loan]] = await connection.query(
            `SELECT id, book_id FROM loans
             WHERE id = ? AND user_id = ? AND is_returned = 0
                 LIMIT 1 FOR UPDATE`,
            [loanId, userId]
        );

        if (!loan) {
            // Диагностический запрос
            const [[existingLoan]] = await connection.query(
                `SELECT id, user_id, is_returned FROM loans WHERE id = ?`,
                [loanId]
            );

            console.log('[RETURN DIAGNOSTIC]', {
                requestedLoanId: loanId,
                existingLoan: existingLoan,
                userId: userId
            });

            throw new Error('Активный займ не найден. Возможные причины: уже возвращен, не принадлежит вам или неверный ID');
        }

        // 2. Помечаем займ как возвращенный
        await connection.query(
            `UPDATE loans SET
                              returned_date = NOW(),
                              is_returned = 1
             WHERE id = ?`,
            [loan.id]
        );

        // 3. Увеличиваем количество доступных книг
        await connection.query(
            `UPDATE books SET
                available_quantity = available_quantity + 1
             WHERE id = ?`,
            [loan.book_id]
        );

        await connection.commit();

        res.json({
            success: true,
            message: 'Книга успешно возвращена',
            returnedLoanId: loan.id,
            bookId: loan.book_id
        });

    } catch (err) {
        await connection.rollback();
        console.error('[RETURN ERROR]', {
            params: req.params,
            user: req.user,
            error: err.message,
            stack: err.stack
        });

        res.status(400).json({
            success: false,
            error: err.message,
            details: process.env.NODE_ENV === 'development' ? {
                loanId: req.params.id,
                userId: req.user?.id
            } : undefined
        });
    } finally {
        connection.release();
    }
});

// Добавление новой книги (только для администраторов)
router.post('/', auth, async (req, res) => {
    try {
        // Проверка прав администратора
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Доступ запрещен. Требуются права администратора'
            });
        }

        // Валидация данных
        const { title, author, isbn, genre, publication_year, quantity } = req.body;
        const requiredFields = ['title', 'author', 'quantity'];
        const missingFields = requiredFields.filter(field => !req.body[field]);

        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                error: `Не заполнены обязательные поля: ${missingFields.join(', ')}`
            });
        }

        if (isNaN(quantity) || quantity <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Количество должно быть положительным числом'
            });
        }

        // Создание записи о книге
        const coverInitials = `${title.charAt(0)}${author.charAt(0)}`.toUpperCase();

        const [result] = await pool.query(
            `INSERT INTO books (
                title, author, isbn, genre,
                publication_year, quantity,
                available_quantity, cover_initials
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                title,
                author,
                isbn || null,
                genre || null,
                publication_year || null,
                parseInt(quantity),
                parseInt(quantity),
                coverInitials
            ]
        );

        // Получаем созданную книгу
        const [[newBook]] = await pool.query(
            `SELECT * FROM books WHERE id = ?`,
            [result.insertId]
        );

        res.status(201).json({
            success: true,
            book: newBook
        });

    } catch (err) {
        console.error('[ADD BOOK ERROR]', err);

        // Обработка ошибки дублирования ISBN
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({
                success: false,
                error: 'Книга с таким ISBN уже существует'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Ошибка при добавлении книги'
        });
    }
});

// Обновление книги (PUT /books/:id)
router.put('/:id', auth, async (req, res) => {
    try {
        // Проверка прав администратора
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Требуются права администратора'
            });
        }
        const bookId = parseInt(req.params.id);
        if (isNaN(bookId)) {
            return res.status(400).json({
                success: false,
                error: 'Некорректный ID книги'
            });
        }
        const { title, author, isbn, genre, quantity } = req.body;
        // Валидация
        if (!title || !author || !quantity) {
            return res.status(400).json({
                success: false,
                error: 'Название, автор и количество обязательны'
            });
        }
        // Обновление книги
        await pool.query(
            `UPDATE books SET 
                title = ?, 
                author = ?, 
                isbn = ?, 
                genre = ?, 
                quantity = ?,
                available_quantity = quantity - (SELECT COUNT(*) FROM loans WHERE book_id = ? AND is_returned = 0)
             WHERE id = ?`,
            [title, author, isbn || null, genre || null, quantity, bookId, bookId]
        );
        // Получаем обновленную книгу
        const [[book]] = await pool.query(
            `SELECT * FROM books WHERE id = ?`,
            [bookId]
        );
        res.json({
            success: true,
            book
        });
    } catch (err) {
        console.error('[UPDATE BOOK ERROR]', err);
        res.status(500).json({
            success: false,
            error: 'Ошибка при обновлении книги'
        });
    }
});

// Удаление книги (DELETE /books/:id)
router.delete('/:id', auth, async (req, res) => {
    try {
        // Проверка прав администратора
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Требуются права администратора'
            });
        }
        const bookId = parseInt(req.params.id);
        if (isNaN(bookId)) {
            return res.status(400).json({
                success: false,
                error: 'Некорректный ID книги'
            });
        }
        // Проверяем, есть ли активные займы этой книги
        const [[activeLoans]] = await pool.query(
            `SELECT COUNT(*) as count FROM loans 
             WHERE book_id = ? AND is_returned = 0`,
            [bookId]
        );
        if (activeLoans.count > 0) {
            return res.status(400).json({
                success: false,
                error: 'Нельзя удалить книгу, так как она находится на руках у читателей'
            });
        }
        // Удаляем книгу
        await pool.query(
            `DELETE FROM books WHERE id = ?`,
            [bookId]
        );
        res.json({
            success: true,
            message: 'Книга успешно удалена'
        });
    } catch (err) {
        console.error('[DELETE BOOK ERROR]', err);
        res.status(500).json({
            success: false,
            error: 'Ошибка при удалении книги'
        });
    }
});

module.exports = router;