require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const bcrypt = require('bcryptjs'); // Added for password hashing
const auth = require('./middleware/auth'); // Assuming this is your authentication middleware
const pool = require('./db'); // This is assumed to be your database connection
const booksRouter = require('./routes/books');
const usersRouter = require('./routes/users');
const app = express();
const PORT = process.env.PORT || 5000;

// Advanced CORS settings
const corsOptions = {
    origin: [
        'http://localhost:3000', // React dev server
        'http://127.0.0.1:3000', // Alternate address
        'http://localhost:5173', // Vite
        'http://127.0.0.1:5173'  // Vite alternate.
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept'
    ],
    credentials: true,
    optionsSuccessStatus: 200 // For older browsers
};

// Middleware
app.use(cors(corsOptions)); // Must be FIRST middleware!
app.use(morgan('dev'));
app.use(express.json());
app.use('/users', usersRouter);

// Explicit processing of preflight OPTIONS requests
app.options('*', cors(corsOptions));

// Main routes
app.use('/books', booksRouter);
app.use('/users', usersRouter);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK' });
});

// Secure admin routes
const adminRoutes = express.Router();
adminRoutes.use(auth);
adminRoutes.use((req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden' });
    }
    next();
});

// Get all users
adminRoutes.get('/users', async (req, res) => {
    try {
        const [users] = await pool.query(
            'SELECT id, name, email, role FROM users'
        );
        res.json({ users });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Create user (admin)
adminRoutes.post('/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        const [existing] = await pool.query(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );

        if (existing.length > 0) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        await pool.query(
            'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
            [name, email, hashedPassword, role]
        );

        res.status(201).json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Delete user
adminRoutes.delete('/users/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Deletion failed' });
    }
});

// Connect admin routes
app.use('/admin', adminRoutes);

// Error handling
app.use((err, req, res, next) => {
    console.error('⚠️ Server error:', err.stack);
    res.status(500).json({ error: 'Internal server error' });
});

// 404 Handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});