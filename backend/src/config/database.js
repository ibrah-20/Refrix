const mongoose = require('mongoose');
const logger = require('../utils/logger');

let mongoServer;

const connectDB = async () => {
  try {
    let uri = process.env.MONGODB_URI;

    if (process.env.NODE_ENV === 'development' || !uri) {
      try {
        const { MongoMemoryServer } = require('mongodb-memory-server');
        mongoServer = await MongoMemoryServer.create();
        uri = mongoServer.getUri();
        logger.info(`MongoDB Memory Server started at: ${uri}`);
      } catch (err) {
        logger.error(`Failed to start MongoDB Memory Server: ${err.message}`);
      }
    }

    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    logger.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected. Attempting to reconnect...');
});

module.exports = connectDB;
