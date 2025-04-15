require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const bcrypt = require('bcryptjs'); // Добавлен для хеширования паролей
const auth = require('./middleware/auth'); // Предполагается, что это ваш middleware аутентификации
const pool = require('./db'); // Предполагается, что это ваше подключение к БД
const booksRouter = require('./routes/books');
const usersRouter = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 5000;

// Расширенные настройки CORS
const corsOptions = {
    origin: [
        'http://localhost:3000', // React dev server
        'http://127.0.0.1:3000', // Альтернативный адрес
        'http://localhost:5173', // Vite
        'http://127.0.0.1:5173'  // Vite альтернативный
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept'
    ],
    credentials: true,
    optionsSuccessStatus: 200 // Для старых браузеров
};

// Middleware
app.use(cors(corsOptions)); // Должно быть ПЕРВЫМ middleware!
app.use(morgan('dev'));
app.use(express.json());

// Явная обработка preflight OPTIONS запросов
app.options('*', cors(corsOptions));

// Основные маршруты
app.use('/books', booksRouter);
app.use('/users', usersRouter);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK' });
});

// Защищенные админ-маршруты
const adminRoutes = express.Router();
adminRoutes.use(auth);
adminRoutes.use((req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden' });
    }
    next();
});

// Получить всех пользователей
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

// Создать пользователя (админ)
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

// Удалить пользователя
adminRoutes.delete('/users/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Deletion failed' });
    }
});

// Подключаем админ-маршруты
app.use('/admin', adminRoutes);

// Обработка ошибок
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