const express = require('express');
const router = express.Router();
const pool = require('../db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const auth = require('../middleware/auth');
require('dotenv').config();

/**
 * @route POST /users/register
 * @desc Регистрация нового пользователя
 * @access Public
 */
router.post('/register', async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({
            success: false,
            error: 'Все поля (name, email, password) обязательны'
        });
    }

    try {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                error: 'Некорректный формат email'
            });
        }

        const [existingUser] = await pool.query(
            'SELECT id FROM users WHERE email = ? LIMIT 1',
            [email]
        );

        if (existingUser.length > 0) {
            return res.status(409).json({
                success: false,
                error: 'Пользователь с таким email уже существует'
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const [result] = await pool.query(
            'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
            [name, email, hashedPassword]
        );

        const token = jwt.sign(
            { userId: result.insertId },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        const [newUser] = await pool.query(
            'SELECT id, name, email, role FROM users WHERE id = ?',
            [result.insertId]
        );

        return res.status(201).json({
            success: true,
            token,
            user: newUser[0]
        });

    } catch (err) {
        console.error('Ошибка регистрации:', err);
        return res.status(500).json({
            success: false,
            error: 'Ошибка сервера при регистрации'
        });
    }
});

/**
 * @route POST /users/login
 * @desc Авторизация пользователя
 * @access Public
 */
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            success: false,
            error: 'Email и password обязательны'
        });
    }

    try {
        const [users] = await pool.query(
            'SELECT * FROM users WHERE email = ? LIMIT 1',
            [email]
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'Неверные учетные данные'
            });
        }

        const user = users[0];
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                error: 'Неверные учетные данные'
            });
        }

        const token = jwt.sign(
            { userId: user.id },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        const userData = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
        };

        return res.json({
            success: true,
            token,
            user: userData
        });

    } catch (err) {
        console.error('Ошибка авторизации:', err);
        return res.status(500).json({
            success: false,
            error: 'Ошибка сервера при авторизации'
        });
    }
});

/**
 * @route GET /users/me
 * @desc Получение данных текущего пользователя
 * @access Private
 */
router.get('/me', auth, async (req, res) => {
    try {
        return res.json({
            success: true,
            user: req.user
        });
    } catch (err) {
        console.error('Ошибка получения данных:', err);
        return res.status(500).json({
            success: false,
            error: 'Ошибка при получении данных пользователя'
        });
    }
});

/**
 * @route GET /users/:id/loans
 * @desc Получение списка взятых книг пользователя
 * @access Private
 */
router.get('/:id/loans', auth, async (req, res) => {
    try {
        if (parseInt(req.params.id) !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Доступ запрещен'
            });
        }

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
                    WHEN l.is_returned THEN 'Returned'
                    WHEN l.due_date < NOW() THEN 'Overdue'
                    ELSE 'Active'
                    END as status,
                DATEDIFF(l.due_date, CURDATE()) as days_remaining
            FROM loans l
                     JOIN books b ON l.book_id = b.id
            WHERE l.user_id = ?
            ORDER BY
                CASE
                    WHEN l.is_returned = 0 AND l.due_date < NOW() THEN 1
                    WHEN l.is_returned = 0 THEN 2
                    ELSE 3
                    END,
                l.due_date ASC
        `, [req.params.id]);

        return res.json({
            success: true,
            loans: loans || []
        });

    } catch (err) {
        console.error('Ошибка получения списка книг:', err);
        return res.status(500).json({
            success: false,
            error: 'Ошибка сервера при загрузке взятых книг'
        });
    }
});

/**
 * @route PUT /users/:id
 * @desc Обновление данных пользователя
 * @access Private
 */
router.put('/:id', auth, async (req, res) => {
    try {
        if (parseInt(req.params.id) !== req.user.id) {
            return res.status(403).json({
                success: false,
                error: 'Доступ запрещен'
            });
        }

        const { name, email, currentPassword, newPassword } = req.body;

        if (!name || !email) {
            return res.status(400).json({
                success: false,
                error: 'Имя и email обязательны'
            });
        }

        const [existing] = await pool.query(
            'SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1',
            [email, req.params.id]
        );

        if (existing.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Email уже используется другим пользователем'
            });
        }

        if (newPassword) {
            if (!currentPassword) {
                return res.status(400).json({
                    success: false,
                    error: 'Текущий пароль обязателен для смены пароля'
                });
            }

            const [user] = await pool.query(
                'SELECT password FROM users WHERE id = ? LIMIT 1',
                [req.params.id]
            );

            const isMatch = await bcrypt.compare(currentPassword, user[0].password);
            if (!isMatch) {
                return res.status(400).json({
                    success: false,
                    error: 'Текущий пароль неверен'
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

        const [updatedUser] = await pool.query(
            'SELECT id, name, email, role FROM users WHERE id = ? LIMIT 1',
            [req.params.id]
        );

        return res.json({
            success: true,
            user: updatedUser[0]
        });

    } catch (err) {
        console.error('Ошибка обновления:', err);
        return res.status(500).json({
            success: false,
            error: 'Ошибка сервера при обновлении профиля'
        });
    }
});

/**
 * @route POST /users/logout
 * @desc Выход из системы
 * @access Private
 */
router.post('/logout', auth, (req, res) => {
    return res.json({
        success: true,
        message: 'Выход выполнен успешно'
    });
});

module.exports = router;