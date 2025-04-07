require("dotenv").config();

const mysql = require('mysql2/promise');

const config = {
  host: process.env.DB_CONTAINER || process.env.MYSQL_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.MYSQL_ROOT_USER || process.env.MYSQL_USER,
  password: process.env.MYSQL_ROOT_PASSWORD || process.env.MYSQL_PASS,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const pool = mysql.createPool(config);

// Utility function to query the database
async function query(sql, params) {
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.execute(sql, params);
    return rows;
  } catch (err) {
    console.error('Database query error:', err);
    throw err;
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  query: async (sql, params) => {
    const [rows] = await pool.execute(sql, params);
    return rows;
  },
  pool
};

module.exports = {
  query,
  pool
};