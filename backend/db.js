// backend/db.js
const mysql = require('mysql2/promise');
require('dotenv').config();

const config = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'library_db',
    waitForConnections: true,
    connectionLimit: 10
};

console.log('Конфиг БД:', {
    ...config,
    password: config.password ? '***' : 'empty' // Не логируем реальный пароль
});

const pool = mysql.createPool(config);

// Тест подключения
pool.getConnection()
    .then(conn => {
        console.log('✅ Успешное подключение к MySQL!');
        conn.release();
    })
    .catch(err => {
        console.error('❌ Ошибка подключения к MySQL:', err.message);
        console.error('Проверьте:');
        console.error('1. Запущен ли MySQL сервер');
        console.error('2. Правильные ли credentials в .env');
        console.error('3. Существует ли БД', config.database);
        process.exit(1);
    });

module.exports = pool;