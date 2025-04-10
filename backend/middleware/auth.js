const jwt = require('jsonwebtoken');
const pool = require('../db');
require('dotenv').config();

/**
 * Middleware аутентификации через JWT
 */
module.exports = async (req, res, next) => {
    try {
        // 1. Получаем токен из заголовка
        const authHeader = req.header('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            throw new Error('Authorization header missing or invalid');
        }

        const token = authHeader.replace('Bearer ', '');

        // 2. Верифицируем токен
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key');

        // 3. Проверяем существование пользователя
        const [users] = await pool.query(
            'SELECT id, name, email, role FROM users WHERE id = ?',
            [decoded.userId]
        );

        if (users.length === 0) {
            throw new Error('User not found');
        }

        // 4. Добавляем пользователя в запрос
        req.user = users[0];
        next();
    } catch (err) {
        console.error('Authentication error:', err.message);

        // Специальная обработка для истекшего токена
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'Session expired',
                code: 'TOKEN_EXPIRED'
            });
        }

        res.status(401).json({
            error: 'Please authenticate',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};