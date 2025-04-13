require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const booksRouter = require('./routes/books');
const usersRouter = require('./routes/users');

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
app.use('/books', booksRouter); // Важно: перед обработчиками ошибок
app.use('/users', usersRouter);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK' });
});

// Error handling (должен быть последним!)
app.use((err, req, res, next) => {
    console.error('⚠️ Server error:', err.stack);
    res.status(500).json({ error: 'Internal server error' });
});

// 404 Handler (должен быть перед error handling)
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});