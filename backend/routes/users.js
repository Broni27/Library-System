const express = require('express');
const router = express.Router();
const pool = require('../db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const auth = require('../middleware/auth');
require('dotenv').config();

/**
 * New user registration
 */
router.post('/register', async (req, res) => {
    const { name, email, password } = req.body;

    try {
        // Validation
        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                error: 'All fields are required'
            });
        }

        // Email verification
        const [existingUser] = await pool.query(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );

        if (existingUser.length > 0) {
            return res.status(409).json({
                success: false,
                error: 'Email is already in use'
            });
        }

        // Password hashing
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // User creation
        const [result] = await pool.query(
            'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
            [name, email, hashedPassword]
        );

        // Token generation
        const token = jwt.sign(
            { userId: result.insertId },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Response with user data
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
        console.error('Registration error:', err);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});

/**
 * User authentication
 */
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // User search
        const [users] = await pool.query(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'Incorrect credentials'
            });
        }

        const user = users[0];

        // Password verification
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                error: 'Incorrect credentials'
            });
        }

        // Token generation
        const token = jwt.sign(
            { userId: user.id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Forming response
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
        console.error('Login error:', err);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});

/**
 * Retrieving current user data
 */
router.get('/me', auth, async (req, res) => {
    try {
        res.json({
            success: true,
            user: req.user
        });
    } catch (err) {
        console.error('Data retrieval error:', err);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});

/**
 * Getting the list of user's books
 */
router.get('/:id/loans', auth, async (req, res) => {
    try {
        // Checking access rights
        if (parseInt(req.params.id) !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        // Requesting user's books
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
        console.error('Book retrieval error:', err);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});

/**
 * Updating a user profile
 */
router.put('/:id', auth, async (req, res) => {
    try {
        // Rights check
        if (parseInt(req.params.id) !== req.user.id) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        const { name, email, currentPassword, newPassword } = req.body;

        // Data update
        if (newPassword) {
            const [user] = await pool.query(
                'SELECT password FROM users WHERE id = ?',
                [req.params.id]
            );

            const isMatch = await bcrypt.compare(currentPassword, user[0].password);
            if (!isMatch) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid current password'
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

        // Receive updated data
        const [updatedUser] = await pool.query(
            'SELECT id, name, email, role FROM users WHERE id = ?',
            [req.params.id]
        );

        res.json({
            success: true,
            user: updatedUser[0]
        });

    } catch (err) {
        console.error('Update error:', err);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});

/**
 * Delete user account and return all borrowed books
 */
router.delete('/:id', auth, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const { password } = req.body;
        const userId = parseInt(req.params.id);

        // Verify user can only delete their own account
        if (userId !== req.user.id) {
            return res.status(403).json({
                success: false,
                error: 'You can only delete your own account'
            });
        }

        // 1. Verify password
        const [users] = await connection.query(
            'SELECT password FROM users WHERE id = ?',
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        const isMatch = await bcrypt.compare(password, users[0].password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                error: 'Incorrect password'
            });
        }

        // 2. Return all borrowed books
        const [activeLoans] = await connection.query(
            `SELECT l.id as loan_id, l.book_id 
             FROM loans l 
             WHERE l.user_id = ? AND l.is_returned = 0`,
            [userId]
        );

        for (const loan of activeLoans) {
            // Mark loan as returned
            await connection.query(
                `UPDATE loans 
                 SET returned_date = NOW(), is_returned = 1 
                 WHERE id = ?`,
                [loan.loan_id]
            );

            // Increment book availability
            await connection.query(
                `UPDATE books 
                 SET available_quantity = available_quantity + 1 
                 WHERE id = ?`,
                [loan.book_id]
            );
        }

        // 3. Delete user account
        await connection.query('DELETE FROM users WHERE id = ?', [userId]);

        await connection.commit();

        res.json({
            success: true,
            message: 'Account deleted and all books returned successfully',
            booksReturned: activeLoans.length
        });

    } catch (err) {
        await connection.rollback();
        console.error('Delete account error:', err);
        res.status(500).json({
            success: false,
            error: 'Error deleting account'
        });
    } finally {
        connection.release();
    }
});

module.exports = router;