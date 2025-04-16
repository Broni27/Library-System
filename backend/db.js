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

console.log('// 4. Add the user to the request', {
    ...config,
    password: config.password ? '***' : 'empty' // Not logging in the real password
});

const pool = mysql.createPool(config);

// Connection test
pool.getConnection()
    .then(conn => {
        console.log('Successful connection to MySQL!');
        conn.release();
    })
    .catch(err => {
        console.error('Error connecting to MySQL:', err.message);
        console.error('Check it out:');
        console.error('1. Whether MySQL server is running');
        console.error('2. Whether the credentials in .env are correct');
        console.error('3. Does the database exist', config.database);
        process.exit(1);
    });

module.exports = pool;