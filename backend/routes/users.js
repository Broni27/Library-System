const express = require('express');
const router = express.Router();
const pool = require('../db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const auth = require('../middleware/auth');
require('dotenv').config();

/**
 * Регистрация нового пользователя
 */
router.post('/register', async (req, res) => {
    const { name, email, password } = req.body;

    try {
        // Валидация
        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Все поля обязательны'
            });
        }

        // Проверка email
        const [existingUser] = await pool.query(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );

        if (existingUser.length > 0) {
            return res.status(409).json({
                success: false,
                error: 'Email уже используется'
            });
        }

        // Хеширование пароля
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Создание пользователя
        const [result] = await pool.query(
            'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
            [name, email, hashedPassword]
        );

        // Генерация токена
        const token = jwt.sign(
            { userId: result.insertId },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Ответ с данными пользователя
        const [user] = await pool.query(
            'SELECT id, name, email, role FROM users WHERE id = ?',
            [result.insertId]
        );

        res.status(201).json({
            success: true,
            token,
            user: user[0]
        });

    } catch (err) {
        console.error('Ошибка регистрации:', err);
        res.status(500).json({
            success: false,
            error: 'Ошибка сервера'
        });
    }
});

/**
 * Аутентификация пользователя
 */
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Поиск пользователя
        const [users] = await pool.query(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'Неверные учетные данные'
            });
        }

        const user = users[0];

        // Проверка пароля
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                error: 'Неверные учетные данные'
            });
        }

        // Генерация токена
        const token = jwt.sign(
            { userId: user.id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Формирование ответа
        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (err) {
        console.error('Ошибка входа:', err);
        res.status(500).json({
            success: false,
            error: 'Ошибка сервера'
        });
    }
});

/**
 * Получение данных текущего пользователя
 */
router.get('/me', auth, async (req, res) => {
    try {
        res.json({
            success: true,
            user: req.user
        });
    } catch (err) {
        console.error('Ошибка получения данных:', err);
        res.status(500).json({
            success: false,
            error: 'Ошибка сервера'
        });
    }
});

/**
 * Получение списка книг пользователя
 */
router.get('/:id/loans', auth, async (req, res) => {
    try {
        // Проверка прав доступа
        if (parseInt(req.params.id) !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Доступ запрещен'
            });
        }

        // Запрос книг пользователя
        const [loans] = await pool.query(`
            SELECT 
                l.id as loan_id,
                b.id as book_id,
                b.title,
                b.author,
                b.cover_initials,
                l.borrowed_date,
                l.due_date,
                l.returned_date,
                l.is_returned,
                CASE
                    WHEN l.is_returned = 1 THEN 'returned'
                    WHEN l.due_date < NOW() THEN 'overdue'
                    ELSE 'active'
                END as status
            FROM loans l
            JOIN books b ON l.book_id = b.id
            WHERE l.user_id = ?
            ORDER BY l.is_returned, l.due_date
        `, [req.params.id]);

        res.json({
            success: true,
            loans: loans || []
        });

    } catch (err) {
        console.error('Ошибка получения книг:', err);
        res.status(500).json({
            success: false,
            error: 'Ошибка сервера'
        });
    }
});

/**
 * Обновление профиля пользователя
 */
router.put('/:id', auth, async (req, res) => {
    try {
        // Проверка прав
        if (parseInt(req.params.id) !== req.user.id) {
            return res.status(403).json({
                success: false,
                error: 'Доступ запрещен'
            });
        }

        const { name, email, currentPassword, newPassword } = req.body;

        // Обновление данных
        if (newPassword) {
            const [user] = await pool.query(
                'SELECT password FROM users WHERE id = ?',
                [req.params.id]
            );

            const isMatch = await bcrypt.compare(currentPassword, user[0].password);
            if (!isMatch) {
                return res.status(400).json({
                    success: false,
                    error: 'Неверный текущий пароль'
                });
            }

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(newPassword, salt);

            await pool.query(
                'UPDATE users SET name = ?, email = ?, password = ? WHERE id = ?',
                [name, email, hashedPassword, req.params.id]
            );
        } else {
            await pool.query(
                'UPDATE users SET name = ?, email = ? WHERE id = ?',
                [name, email, req.params.id]
            );
        }

        // Получение обновленных данных
        const [updatedUser] = await pool.query(
            'SELECT id, name, email, role FROM users WHERE id = ?',
            [req.params.id]
        );

        res.json({
            success: true,
            user: updatedUser[0]
        });

    } catch (err) {
        console.error('Ошибка обновления:', err);
        res.status(500).json({
            success: false,
            error: 'Ошибка сервера'
        });
    }
});

module.exports = router;