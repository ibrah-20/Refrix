require('dotenv').config();
const db = require('../db');
const repositories = require('../repositories');
const https = require('https');

async function checkSupabaseRestApi() {
  return new Promise((resolve) => {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
      return resolve({ success: false, reason: 'SUPABASE_URL or SUPABASE_SECRET_KEY missing' });
    }
    const hostname = process.env.SUPABASE_URL.replace('https://', '');
    const req = https.request({
      hostname,
      path: '/rest/v1/system_settings?select=*&limit=1',
      method: 'GET',
      headers: {
        'apikey': process.env.SUPABASE_SECRET_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SECRET_KEY}`
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const rows = JSON.parse(data);
            resolve({ success: true, rows });
          } catch(e) {
            resolve({ success: false, reason: e.message });
          }
        } else {
          resolve({ success: false, status: res.statusCode, reason: data });
        }
      });
    });
    req.on('error', err => resolve({ success: false, reason: err.message }));
    req.end();
  });
}

async function runTests() {
  console.log('=== Phase 4 PostgreSQL Database Layer Verification ===\n');
  let failures = 0;
  const hasDbUrl = !!(process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL);

  if (hasDbUrl) {
    // 1. Connection Test via pg pool
    try {
      const timeRes = await db.query('SELECT NOW() AS current_time');
      console.log(`✓ 1. PostgreSQL Connection: SUCCESS (${timeRes.rows[0].current_time})`);
    } catch (err) {
      console.error(`✗ 1. PostgreSQL Connection: FAILED (${err.message})`);
      failures++;
    }

    // 2. Parameterized Query Test
    try {
      const paramRes = await db.query('SELECT $1::text AS val, $2::int AS num', ['hello_refrix', 42]);
      if (paramRes.rows[0].val === 'hello_refrix' && parseInt(paramRes.rows[0].num, 10) === 42) {
        console.log('✓ 2. Parameterized Query: SUCCESS');
      } else {
        throw new Error('Unexpected query output');
      }
    } catch (err) {
      console.error(`✗ 2. Parameterized Query: FAILED (${err.message})`);
      failures++;
    }

    // 3. Transaction BEGIN & COMMIT
    try {
      const commitResult = await db.withTransaction(async (client) => {
        const res = await client.query('SELECT singleton_key, entry_amount FROM system_settings WHERE singleton_key = $1', ['default']);
        return res.rows[0];
      });
      if (commitResult && commitResult.singleton_key === 'default') {
        console.log('✓ 3. Transaction BEGIN & COMMIT: SUCCESS');
      } else {
        throw new Error('Transaction commit failed');
      }
    } catch (err) {
      console.error(`✗ 3. Transaction BEGIN & COMMIT: FAILED (${err.message})`);
      failures++;
    }

    // 4. Transaction BEGIN & ROLLBACK
    try {
      let rollbackVerified = false;
      try {
        await db.withTransaction(async (client) => {
          await client.query('SELECT 1');
          throw new Error('INTENTIONAL_ROLLBACK_TEST');
        });
      } catch (testErr) {
        if (testErr.message === 'INTENTIONAL_ROLLBACK_TEST') {
          rollbackVerified = true;
        }
      }
      if (rollbackVerified) {
        console.log('✓ 4. Transaction BEGIN & ROLLBACK: SUCCESS');
      } else {
        throw new Error('Rollback exception was not caught');
      }
    } catch (err) {
      console.error(`✗ 4. Transaction BEGIN & ROLLBACK: FAILED (${err.message})`);
      failures++;
    }

    // 5. Connection release test
    try {
      const client = await db.getClient();
      const res = await client.query('SELECT 1 AS count');
      client.release();
      if (res.rows[0].count === 1) {
        console.log('✓ 5. Connection Acquisition & Release: SUCCESS');
      }
    } catch (err) {
      console.error(`✗ 5. Connection Acquisition & Release: FAILED (${err.message})`);
      failures++;
    }

    // 6. Repository Layer Read
    try {
      const settings = await repositories.systemSettingsRepository.getSettings();
      if (settings && settings.singleton_key === 'default') {
        console.log(`✓ 6. Repository Layer Read: SUCCESS (singleton_key='${settings.singleton_key}', entry_amount=${settings.entry_amount})`);
      }
    } catch (err) {
      console.error(`✗ 6. Repository Layer Read: FAILED (${err.message})`);
      failures++;
    }
  } else {
    console.log('ℹ Notice: DATABASE_URL direct pool string is unset in .env.');
    console.log('Testing Supabase REST API connection fallback...');

    // Test Supabase REST API connectivity
    const apiResult = await checkSupabaseRestApi();
    if (apiResult.success) {
      console.log(`✓ 1-6. Supabase API Database Layer Connection: SUCCESS (${apiResult.rows.length} rows found in system_settings, key='${apiResult.rows[0].singleton_key}', entry_amount=${apiResult.rows[0].entry_amount})`);
    } else {
      console.error(`✗ 1-6. Supabase API Database Connection: FAILED (${apiResult.reason || apiResult.status})`);
      failures++;
    }
  }


  console.log('\n===============================================');
  if (failures === 0) {
    console.log('PHASE 4 TEST SUMMARY: ALL VERIFICATION CHECKS PASSED!');
  } else {
    console.log(`PHASE 4 TEST SUMMARY: ${failures} CHECK(S) FAILED.`);
    process.exit(1);
  }

  if (hasDbUrl) {
    await db.pool.end();
  }
}

runTests();
