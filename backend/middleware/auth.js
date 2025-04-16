const jwt = require('jsonwebtoken');
const pool = require('../db');
require('dotenv').config();

module.exports = async (req, res, next) => {
    try {
        // 1. Get the token from the header
        const authHeader = req.header('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'Authorization header missing or invalid'
            });
        }

        const token = authHeader.replace('Bearer ', '');

        // 2. Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key');

        // 3. Verify the user's existence
        const [users] = await pool.query(
            'SELECT id, name, email, role FROM users WHERE id = ?',
            [decoded.userId]
        );

        if (users.length === 0) {
            return res.status(401).json({
                error: 'User not found'
            });
        }

        // 4. Add user to the request
        req.user = users[0];
        next();
    } catch (err) {
        console.error('Authentication error:', err.message);

        // Special handling for expired token
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'Session expired',
                code: 'TOKEN_EXPIRED'
            });
        }

        // Generic error response
        res.status(401).json({
            error: 'Please authenticate',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};