const userRepository = require('./userRepository');
const systemSettingsRepository = require('./systemSettingsRepository');
const referralRepository = require('./referralRepository');
const transactionRepository = require('./transactionRepository');
const withdrawalRepository = require('./withdrawalRepository');
const walletTransactionRepository = require('./walletTransactionRepository');
const fraudFlagRepository = require('./fraudFlagRepository');
const notificationRepository = require('./notificationRepository');
const otpVerificationRepository = require('./otpVerificationRepository');
const adminLogRepository = require('./adminLogRepository');

module.exports = {
  userRepository,
  systemSettingsRepository,
  referralRepository,
  transactionRepository,
  withdrawalRepository,
  walletTransactionRepository,
  fraudFlagRepository,
  notificationRepository,
  otpVerificationRepository,
  adminLogRepository,
};
