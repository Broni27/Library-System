require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const usersRouter = require('./routes/users');
const booksRouter = require('./routes/books');
const auth = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(morgan('dev'));
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());

// Routes
app.use('/users', usersRouter);
app.use('/books', booksRouter);

// Protected test route
app.get('/protected', auth, (req, res) => {
    res.json({ message: 'Protected data', user: req.user });
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        database: 'connected'
    });
});

// Error handling
app.use((err, req, res, next) => {
    console.error('⚠️ Server error:', err.stack);
    res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'development'
            ? err.message
            : 'Internal server error'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`
  🚀 Server running on http://localhost:${PORT}
  ➡️ Health check: http://localhost:${PORT}/health
  `);
});