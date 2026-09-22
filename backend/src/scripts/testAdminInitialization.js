require('dotenv').config();
const { ensureAdminExists } = require('../utils/seedAdmin');
const repositories = require('../repositories');
const db = require('../db');
const bcrypt = require('bcryptjs');

async function runAdminInitTests() {
  console.log('=== Refrix Admin Account Startup Initialization Verification ===\n');
  let failures = 0;
  const hasDbUrl = !!(process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL);

  if (!hasDbUrl) {
    console.log('ℹ Notice: Direct DATABASE_URL is unset. Skipping direct pool execution checks.');
  }

  try {
    // ------------------------------------------------------------------------
    // Case E: Missing ADMIN_EMAIL or ADMIN_PASSWORD
    // ------------------------------------------------------------------------
    const originalEmail = process.env.ADMIN_EMAIL;
    const originalPassword = process.env.ADMIN_PASSWORD;

    delete process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_PASSWORD;

    const resE = await ensureAdminExists();
    if (resE.status === 'skipped' && resE.reason === 'missing_credentials') {
      console.log('✓ Case E: Missing credentials handled safely (Skipped): SUCCESS');
    } else {
      throw new Error(`Case E failed: expected skipped, got ${JSON.stringify(resE)}`);
    }

    // Restore env vars
    process.env.ADMIN_EMAIL = originalEmail || 'testadmin_init@refrix.test';
    process.env.ADMIN_PASSWORD = originalPassword || 'TestAdminPass123!';

    if (hasDbUrl) {
      const timestamp = Date.now();

      // ------------------------------------------------------------------------
      // Case A: Admin does not exist -> Creation
      // ------------------------------------------------------------------------
      const testAdminEmail = `admin_init_${timestamp}@refrix.test`;
      const testAdminPassword = `SecretPass_${timestamp}!`;

      process.env.ADMIN_EMAIL = testAdminEmail;
      process.env.ADMIN_PASSWORD = testAdminPassword;

      const resA = await ensureAdminExists();
      if (resA.status === 'created' && resA.email === testAdminEmail) {
        console.log('✓ Case A: New admin created successfully: SUCCESS');
      } else {
        throw new Error(`Case A failed: expected created, got ${JSON.stringify(resA)}`);
      }

      // Verify created account in database
      const adminInDb = await repositories.userRepository.findByEmail(testAdminEmail);
      if (!adminInDb) throw new Error('Created admin not found in DB');
      if (adminInDb.role !== 'admin') throw new Error(`Role mismatch: expected admin, got ${adminInDb.role}`);
      if (!adminInDb.is_paid) throw new Error('is_paid should be true for admin');

      const passwordValid = await bcrypt.compare(testAdminPassword, adminInDb.password_hash);
      if (!passwordValid) throw new Error('Password hash verification failed');
      console.log('✓ Case A (Validation): Role, is_paid=true, and bcrypt hash verified: SUCCESS');

      // ------------------------------------------------------------------------
      // Case B, C, D: Admin already exists -> Idempotency on restart/redeploy
      // ------------------------------------------------------------------------
      const resB = await ensureAdminExists();
      if (resB.status === 'exists' && resB.role === 'admin') {
        console.log('✓ Case B/C/D: Idempotent initialization (Already exists, no-op): SUCCESS');
      } else {
        throw new Error(`Case B failed: expected exists, got ${JSON.stringify(resB)}`);
      }

      // Verify no duplicates created
      const adminCheckInDb = await repositories.userRepository.findByEmail(testAdminEmail);
      if (adminCheckInDb && adminCheckInDb.role === 'admin') {
        console.log('✓ Case B (No Duplicates): Verified existing admin record retrieved safely: SUCCESS');
      } else {
        throw new Error('Existing admin check failed');
      }

      // ------------------------------------------------------------------------
      // Case F: Existing account has same email but role is NOT admin
      // ------------------------------------------------------------------------
      const nonAdminEmail = `user_init_${timestamp}@refrix.test`;
      const nonAdminPasswordHash = await bcrypt.hash('UserPass123!', 10);

      // Create regular user account
      const regularUser = await repositories.userRepository.create({
        fullName: 'Regular Non-Admin User',
        email: nonAdminEmail,
        phone: `254799${timestamp.toString().slice(-6)}`,
        passwordHash: nonAdminPasswordHash,
        referralCode: `REG${timestamp.toString().slice(-5)}`,
        role: 'user',
        isPaid: false,
      });

      // Try setting ADMIN_EMAIL to the regular user's email
      process.env.ADMIN_EMAIL = nonAdminEmail;
      process.env.ADMIN_PASSWORD = 'SomePassword123!';

      const resF = await ensureAdminExists();
      if (resF.status === 'conflict' && resF.role === 'user') {
        console.log('✓ Case F: Non-admin email conflict detected (No auto-escalation): SUCCESS');
      } else {
        throw new Error(`Case F failed: expected conflict, got ${JSON.stringify(resF)}`);
      }

      // Verify user in DB was NOT modified or escalated
      const userInDbAfter = await repositories.userRepository.findByEmail(nonAdminEmail);
      if (userInDbAfter.role !== 'user') throw new Error(`User role was improperly modified to ${userInDbAfter.role}`);
      if (userInDbAfter.is_paid !== false) throw new Error('User is_paid status was improperly modified');
      console.log('✓ Case F (Validation): Regular user account preserved without mutation: SUCCESS');
    }
  } catch (err) {
    console.error(`✗ Admin Initialization Test FAILED: ${err.message}`);
    failures++;
  }

  console.log('\n===============================================');
  if (failures === 0) {
    console.log('ADMIN INITIALIZATION TEST SUMMARY: ALL CHECKS PASSED!');
  } else {
    console.log(`ADMIN INITIALIZATION TEST SUMMARY: ${failures} CHECK(S) FAILED.`);
    process.exit(1);
  }

  if (hasDbUrl && db.pool) {
    await db.pool.end();
  }
}

runAdminInitTests();
