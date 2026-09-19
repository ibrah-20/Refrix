require('dotenv').config();
const https = require('https');

const expectedTables = [
  'users',
  'system_settings',
  'referrals',
  'transactions',
  'withdrawals',
  'wallet_transactions',
  'fraud_flags',
  'notifications',
  'otp_verifications',
  'admin_logs'
];

async function checkTable(tableName) {
  return new Promise((resolve) => {
    const options = {
      hostname: process.env.SUPABASE_URL.replace('https://', ''),
      path: `/rest/v1/${tableName}?select=*&limit=1`,
      method: 'GET',
      headers: {
        'apikey': process.env.SUPABASE_SECRET_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SECRET_KEY}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const rows = JSON.parse(data);
            resolve({ table: tableName, exists: true, rows: rows });
          } catch (e) {
            resolve({ table: tableName, exists: false, error: e.message });
          }
        } else {
          resolve({ table: tableName, exists: false, status: res.statusCode, error: data });
        }
      });
    });

    req.on('error', err => resolve({ table: tableName, exists: false, error: err.message }));
    req.end();
  });
}

async function verifyAll() {
  console.log('=== Supabase PostgreSQL Database Verification ===');
  console.log('Supabase URL:', process.env.SUPABASE_URL);

  let allExist = true;
  for (const table of expectedTables) {
    const res = await checkTable(table);
    if (res.exists) {
      console.log(`✓ Table '${table}': EXISTS (${res.rows.length} rows found)`);
      if (table === 'system_settings' && res.rows.length > 0) {
        console.log(`  -> Seed singleton settings row: singleton_key = '${res.rows[0].singleton_key}', entry_amount = ${res.rows[0].entry_amount}`);
      }
    } else {
      allExist = false;
      console.log(`✗ Table '${table}': MISSING (Status ${res.status || 'ERR'})`);
    }
  }

  console.log('\n===============================================');
  if (allExist) {
    console.log('SUCCESS: All 10 PostgreSQL tables exist and are verified!');
  } else {
    console.log('NOTICE: One or more tables do not exist yet. Please run backend/src/config/schema.sql in the Supabase SQL Editor or set DATABASE_URL.');
  }
}

verifyAll();
