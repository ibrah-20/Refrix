const { Pool } = require('pg');
const logger = require('../utils/logger');

// Retrieve connection string from environment
const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;

let pool;

if (connectionString) {
  pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
} else {
  // If DATABASE_URL is not set, initialize pool using individual Supabase params if available
  const host = process.env.SUPABASE_DB_HOST || (process.env.SUPABASE_URL ? `${process.env.SUPABASE_URL.replace('https://', '').split('.')[0]}.supabase.co` : null);
  pool = new Pool({
    host: host || 'localhost',
    port: parseInt(process.env.SUPABASE_DB_PORT || '5432', 10),
    database: process.env.SUPABASE_DB_NAME || 'postgres',
    user: process.env.SUPABASE_DB_USER || 'postgres',
    password: process.env.SUPABASE_DB_PASSWORD || '',
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
}

// Global pool error handler
pool.on('error', (err) => {
  logger.error(`Unexpected error on idle PostgreSQL client: ${err.message}`);
});

/**
 * Tests connection to PostgreSQL database
 */
const testPostgresConnection = async () => {
  try {
    const client = await pool.connect();
    const res = await client.query('SELECT NOW() AS current_time');
    client.release();
    logger.info(`PostgreSQL Connected successfully at ${res.rows[0].current_time}`);
    return true;
  } catch (err) {
    logger.warn(`PostgreSQL Connection notice: ${err.message}`);
    return false;
  }
};

module.exports = {
  pool,
  testPostgresConnection,
};
