const mysql = require('mysql2/promise');
require('dotenv').config({ path: __dirname + '/../.env' });

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'railway_management',
  port: parseInt(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test connection on startup
pool.getConnection()
  .then(conn => {
    console.log('[DB] MySQL connected successfully');
    conn.release();
  })
  .catch(err => {
    console.error('[DB ERROR] MySQL connection failed:', err.message);
  });

module.exports = pool;
