const { pool } = require('../config/postgres');
const logger = require('../utils/logger');

/**
 * Execute a single parameterized query against the PostgreSQL pool
 * @param {string} text - SQL statement with positional parameters ($1, $2, etc.)
 * @param {Array} params - Array of parameter values
 * @returns {Promise<import('pg').QueryResult>} Query result object
 */
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development') {
      logger.debug(`Executed query: ${text.slice(0, 100)}... [${duration}ms, rows: ${res.rowCount}]`);
    }
    return res;
  } catch (err) {
    logger.error(`PostgreSQL Query Error: ${err.message} | SQL: ${text.slice(0, 100)}`);
    throw err;
  }
};

/**
 * Acquire a dedicated client connection from the pool.
 * Note: Callers MUST call client.release() when finished.
 * @returns {Promise<import('pg').PoolClient>}
 */
const getClient = async () => {
  const client = await pool.connect();
  return client;
};

/**
 * Execute a sequence of database operations within an isolated transaction.
 * Automatically handles BEGIN, COMMIT, ROLLBACK, and client release.
 *
 * @param {Function} callback - Async function receiving (client) to execute queries
 * @returns {Promise<any>} Result returned by the callback function
 */
const withTransaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error(`PostgreSQL Transaction Aborted & Rolled Back: ${err.message}`);
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  query,
  getClient,
  withTransaction,
  pool,
};
