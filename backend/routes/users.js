const express = require('express');
const router = express.Router();
const pool = require('../db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const auth = require('../middleware/auth');

// Register new user
router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Validate input
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Check if user exists
        const [existing] = await pool.query(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );

        if (existing.length > 0) {
            return res.status(400).json({ error: 'Email already in use' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const [result] = await pool.query(
            'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
            [name, email, hashedPassword]
        );

        // Generate token
        const token = jwt.sign(
            { userId: result.insertId },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        res.status(201).json({
            token,
            user: {
                id: result.insertId,
                name,
                email,
                role: 'user'
            }
        });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login user
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user
        const [users] = await pool.query(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );

        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = users[0];

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate token
        const token = jwt.sign(
            { userId: user.id },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        res.json({
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
        res.status(500).json({ error: 'Login failed' });
    }
});

// Get user profile
router.get('/:id', auth, async (req, res) => {
    try {
        // Only allow users to access their own profile
        if (parseInt(req.params.id) !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const [users] = await pool.query(
            'SELECT id, name, email, role, created_at FROM users WHERE id = ?',
            [req.params.id]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ user: users[0] });
    } catch (err) {
        console.error('Profile error:', err);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// Update user profile
router.put('/:id', auth, async (req, res) => {
    try {
        // Only allow users to update their own profile
        if (parseInt(req.params.id) !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const { name, email } = req.body;

        // Validate input
        if (!name || !email) {
            return res.status(400).json({ error: 'Name and email are required' });
        }

        await pool.query(
            'UPDATE users SET name = ?, email = ? WHERE id = ?',
            [name, email, req.params.id]
        );

        const [updatedUser] = await pool.query(
            'SELECT id, name, email, role, created_at FROM users WHERE id = ?',
            [req.params.id]
        );

        res.json({ user: updatedUser[0] });
    } catch (err) {
        console.error('Update error:', err);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

module.exports = router;