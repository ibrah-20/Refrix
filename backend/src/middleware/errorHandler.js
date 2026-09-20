const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  logger.error(err);

  // PostgreSQL duplicate key (unique constraint violation)
  if (err.code === '23505') {
    const detail = err.detail || 'Duplicate key constraint violation.';
    return res.status(400).json({ success: false, message: 'Resource already exists.', detail });
  }

  // PostgreSQL foreign key violation
  if (err.code === '23503') {
    return res.status(400).json({ success: false, message: 'Referenced record not found.' });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: 'Token expired.' });
  }

  res.status(err.statusCode || 500).json({
    success: false,
    message: error.message || 'Internal server error',
  });
};

module.exports = errorHandler;
