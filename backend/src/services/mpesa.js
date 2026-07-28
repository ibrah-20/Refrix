const axios = require('axios');
const logger = require('../utils/logger');

// Validate required environment variables
const requiredEnvVars = [
  'MPESA_CONSUMER_KEY',
  'MPESA_CONSUMER_SECRET',
  'MPESA_SHORTCODE',
  'MPESA_PASSKEY',
  'MPESA_CALLBACK_URL',
];

requiredEnvVars.forEach((envVar) => {
  if (!process.env[envVar]) {
    logger.error(`Missing required environment variable: ${envVar}`);
  }
});

const MPESA_BASE_URL =
  process.env.MPESA_ENV === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';

// In-memory token cache to prevent requesting a new token for every API call.
// Safaricom tokens are typically valid for 3599 seconds (~1 hour).
let cachedToken = null;
let tokenExpiry = null;

// Get OAuth token
const getAccessToken = async () => {
  // Return cached token if valid and not expiring within the next 2 minutes
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry - 120000) {
    return cachedToken;
  }

  try {
    const auth = Buffer.from(
      `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
    ).toString('base64');

    const response = await axios.get(
      `${MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
      { headers: { Authorization: `Basic ${auth}` } }
    );

    cachedToken = response.data.access_token;
    // Set expiry based on response (usually 3599 seconds), defaulting to 50 minutes to be safe
    const expiresIn = response.data.expires_in ? response.data.expires_in * 1000 : 3000000;
    tokenExpiry = Date.now() + expiresIn;

    return cachedToken;
  } catch (error) {
    logger.error('M-Pesa auth error:', error.response?.data || error.message);
    throw new Error('Failed to authenticate with M-Pesa');
  }
};

// Get current timestamp in Africa/Nairobi (EAT) as YYYYMMDDHHmmss.
// Safaricom validates this against its own East Africa clock, so using
// UTC (or any other server-local timezone) here causes STK requests to
// be rejected or silently fail once the offset drifts far enough.
const getNairobiTimestamp = () => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date());

  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get('year')}${get('month')}${get('day')}${get('hour')}${get('minute')}${get('second')}`;
};

// Generate password
const generatePassword = () => {
  const timestamp = getNairobiTimestamp();
  const rawPassword = `${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`;
  const password = Buffer.from(rawPassword).toString('base64');
  return { password, timestamp };
};

// Normalize phone to 2547XXXXXXXX or 2541XXXXXXXX format
const normalizePhone = (phone) => {
  if (!phone) throw new Error('Phone number is required');
  // Remove any non-digit characters except leading plus
  let p = phone.toString().replace(/[^\d+]/g, '');
  if (p.startsWith('+')) p = p.slice(1);
  if (p.startsWith('0')) p = '254' + p.slice(1);
  if (p.startsWith('7') || p.startsWith('1')) p = '254' + p;
  
  if (p.length !== 12 || !p.startsWith('254')) {
    throw new Error('Invalid phone number format. Expected format: 2547XXXXXXXX or 07XXXXXXXX');
  }
  return p;
};

// Initiate STK Push
const initiateSTKPush = async ({ phone, amount, accountReference, transactionDesc }) => {
  if (!amount || isNaN(amount) || amount <= 0) {
    throw new Error('Invalid amount');
  }

  try {
    const token = await getAccessToken();
    const { password, timestamp } = generatePassword();
    const normalizedPhone = normalizePhone(phone);

    const payload = {
      BusinessShortCode: process.env.MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.ceil(amount),
      PartyA: normalizedPhone,
      PartyB: process.env.MPESA_SHORTCODE,
      PhoneNumber: normalizedPhone,
      CallBackURL: process.env.MPESA_CALLBACK_URL,
      AccountReference: accountReference || 'Refrix',
      TransactionDesc: transactionDesc || 'Refrix Registration',
    };

    const response = await axios.post(
      `${MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      success: true,
      checkoutRequestId: response.data.CheckoutRequestID,
      merchantRequestId: response.data.MerchantRequestID,
      responseCode: response.data.ResponseCode,
      customerMessage: response.data.CustomerMessage,
    };
  } catch (error) {
    logger.error('STK Push error:', error.response?.data || error.message);
    const errorMessage = error.response?.data?.errorMessage || error.message || 'M-Pesa STK Push failed';
    throw new Error(errorMessage);
  }
};

// Query STK Push status
const querySTKPush = async (checkoutRequestId) => {
  if (!checkoutRequestId) {
    throw new Error('checkoutRequestId is required');
  }

  try {
    const token = await getAccessToken();
    const { password, timestamp } = generatePassword();

    const response = await axios.post(
      `${MPESA_BASE_URL}/mpesa/stkpushquery/v1/query`,
      {
        BusinessShortCode: process.env.MPESA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error) {
    logger.error('STK Query error:', error.response?.data || error.message);
    const errorMessage = error.response?.data?.errorMessage || error.message || 'Failed to query M-Pesa transaction';
    throw new Error(errorMessage);
  }
};

module.exports = { initiateSTKPush, querySTKPush, normalizePhone, getAccessToken };
