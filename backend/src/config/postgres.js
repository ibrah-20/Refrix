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

// Safe connection diagnostic logger (never exposes passwords or secret URIs)
try {
  const rawUrl = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;
  if (rawUrl) {
    const parsed = new URL(rawUrl);
    logger.info(`[DB CONFIG] Source: ${process.env.DATABASE_URL ? 'DATABASE_URL' : 'SUPABASE_DATABASE_URL'} | Host: ${parsed.hostname} | Port: ${parsed.port || 5432} | DB: ${parsed.pathname.replace('/', '')} | User: ${parsed.username ? parsed.username.split('.')[0] : 'none'}`);
  } else {
    const fallbackHost = process.env.SUPABASE_DB_HOST || (process.env.SUPABASE_URL ? `${process.env.SUPABASE_URL.replace('https://', '').split('.')[0]}.supabase.co` : 'localhost');
    logger.info(`[DB CONFIG] Source: FALLBACK (DATABASE_URL unset) | Host: ${fallbackHost} | Port: ${process.env.SUPABASE_DB_PORT || 5432} | DB: ${process.env.SUPABASE_DB_NAME || 'postgres'}`);
  }
} catch (e) {
  logger.warn(`[DB CONFIG] Diagnostic parse error: ${e.message}`);
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
