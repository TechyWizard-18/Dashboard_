const mysql = require('mysql2/promise');

let pool;

const createPool = () => {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'qr_system_db',
      port: process.env.DB_PORT || 3306,
      waitForConnections: true,
      connectionLimit: 100, // Increased for heavy load
      queueLimit: 0,
      dateStrings: false,
      timezone: '+00:00',
      // Performance optimizations
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      multipleStatements: false,
      // Query optimizations
      supportBigNumbers: true,
      bigNumberStrings: false,
      // Connection and query timeouts
      connectTimeout: 10000,
      acquireTimeout: 10000,
      timeout: 60000 // 60 second query timeout
    });
  }
  return pool;
};

const getConnection = async () => {
  const pool = createPool();
  return await pool.getConnection();
};

const query = async (sql, params = []) => {
  const pool = createPool();
  try {
    const [rows] = await pool.query(sql, params);
    return rows;
  } catch (error) {
    console.error('Database query error:', error.message);
    throw error;
  }
};

const testConnection = async () => {
  try {
    const pool = createPool();
    const connection = await pool.getConnection();
    console.log('✅ MySQL Database connected successfully');
    console.log(`📊 Database: ${process.env.DB_NAME || 'qr_system_db'}`);
    console.log(`🔌 Host: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}`);
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ MySQL Database connection failed:', error.message);
    throw error;
  }
};

module.exports = {
  createPool,
  getConnection,
  query,
  testConnection
};

