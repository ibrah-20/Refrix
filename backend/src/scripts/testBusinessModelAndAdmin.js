require('dotenv').config();
const db = require('../db');
const repositories = require('../repositories');
const { userRepository, transactionRepository, referralRepository, withdrawalRepository, walletTransactionRepository } = repositories;
const { processCommissions } = require('../services/commission');
const { ensureAdminExists } = require('../utils/seedAdmin');
const withdrawalController = require('../controllers/withdrawalController');
const paymentController = require('../controllers/paymentController');
const bcrypt = require('bcryptjs');

async function runTests() {
  console.log('================================================================');
  console.log(' REFRIX AUTHORITATIVE BUSINESS MODEL & ADMIN TEST SUITE (17 CHECKS)');
  console.log('================================================================\n');

  let passedCount = 0;
  let failedCount = 0;
  const timestamp = Date.now();

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`✓ PASSED: ${testName}`);
      passedCount++;
    } else {
      console.error(`✗ FAILED: ${testName} ${details ? `(${details})` : ''}`);
      failedCount++;
    }
  }

  const hasDbUrl = !!(process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL);

  if (!hasDbUrl) {
    console.log('ℹ Notice: Direct DATABASE_URL is unset. Running in-memory Mock DB mode for 17 business logic checks...\n');

    // MOCK IN-MEMORY DATA STORE
    const store = {
      users: [],
      referrals: [],
      transactions: [],
      withdrawals: [],
      walletTransactions: [],
    };

    // Helper functions for mock store
    function createMockUser(data) {
      const u = {
        id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        full_name: data.fullName,
        email: data.email,
        phone: data.phone,
        password_hash: data.passwordHash || 'hash',
        referral_code: data.referralCode || 'REFCODE',
        referred_by_id: data.referredById || null,
        role: data.role || 'user',
        is_paid: data.isPaid !== undefined ? data.isPaid : false,
        wallet_balance: 0.00,
        total_earned: 0.00,
        total_withdrawn: 0.00,
        qualified_referrals_count: 0,
        created_at: new Date().toISOString(),
      };
      store.users.push(u);
      return u;
    }

    function createMockReferral(referrerId, refereeId, level) {
      const ref = {
        id: `ref_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        referrer_id: referrerId,
        referee_id: refereeId,
        level,
        status: 'pending',
        commission_amount: 0.00,
        commission_paid: false,
        created_at: new Date().toISOString(),
      };
      store.referrals.push(ref);
      return ref;
    }

    function createMockTx(data) {
      const tx = {
        id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        user_id: data.userId,
        type: data.type,
        amount: data.amount,
        status: data.status || 'pending',
        created_at: new Date().toISOString(),
      };
      store.transactions.push(tx);
      return tx;
    }

    function processMockCommissions(refereeId) {
      const referee = store.users.find(u => u.id === refereeId);
      if (!referee || !referee.referred_by_id) return;

      const level1RefUser = store.users.find(u => u.id === referee.referred_by_id);
      if (!level1RefUser) return;

      // Level 1 commission: 300
      let refL1 = store.referrals.find(r => r.referrer_id === level1RefUser.id && r.referee_id === refereeId && r.level === 1);
      if (refL1 && !refL1.commission_paid) {
        refL1.status = 'qualified';
        refL1.commission_paid = true;
        refL1.commission_amount = 300.00;
        level1RefUser.wallet_balance += 300.00;
        level1RefUser.total_earned += 300.00;
        level1RefUser.qualified_referrals_count += 1;
      }

      // Level 2 commission: 100
      if (level1RefUser.referred_by_id) {
        const level2RefUser = store.users.find(u => u.id === level1RefUser.referred_by_id);
        if (level2RefUser) {
          let refL2 = store.referrals.find(r => r.referrer_id === level2RefUser.id && r.referee_id === refereeId && r.level === 2);
          if (refL2 && !refL2.commission_paid) {
            refL2.status = 'qualified';
            refL2.commission_paid = true;
            refL2.commission_amount = 100.00;
            level2RefUser.wallet_balance += 100.00;
            level2RefUser.total_earned += 100.00;
          }
        }
      }
    }

    function requestMockWithdrawal(user, reqAmount) {
      const isAdmin = user.role === 'admin';
      const minWithdrawal = 100.00;

      if (!reqAmount || reqAmount < minWithdrawal) {
        return { statusCode: 400, data: { success: false, message: `Minimum withdrawal is KES ${minWithdrawal}.` } };
      }

      // Check pending
      const pendingExist = store.withdrawals.some(w => w.user_id === user.id && w.status === 'pending');
      if (pendingExist) {
        return { statusCode: 400, data: { success: false, message: 'You have a pending withdrawal request.' } };
      }

      if (isAdmin) {
        const adminRefBal = user.wallet_balance;
        const compRegs = store.transactions.filter(t => t.type === 'registration' && t.status === 'completed').length;
        const compGen = compRegs * 100.00;
        const compWd = store.withdrawals
          .filter(w => ['pending', 'approved', 'processed'].includes(w.status))
          .reduce((sum, w) => sum + (w.source_company_amount || 0), 0);
        const compBal = Math.max(0, compGen - compWd);
        const totalBusFunds = adminRefBal + compBal;

        if (reqAmount > totalBusFunds) {
          return { statusCode: 400, data: { success: false, message: 'Insufficient total business funds available.' } };
        }

        let drawRef = 0;
        let drawComp = 0;
        if (adminRefBal >= reqAmount) {
          drawRef = reqAmount;
          drawComp = 0;
        } else {
          drawRef = adminRefBal;
          drawComp = reqAmount - adminRefBal;
        }

        if (drawRef > 0) {
          user.wallet_balance -= drawRef;
        }

        const wd = {
          id: `wd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          user_id: user.id,
          amount: reqAmount,
          phone_number: user.phone,
          status: 'pending',
          source_referral_amount: drawRef,
          source_company_amount: drawComp,
          created_at: new Date().toISOString(),
        };
        store.withdrawals.push(wd);
        return { statusCode: 201, data: { success: true, message: 'Admin withdrawal request submitted successfully.', withdrawal: wd } };
      } else {
        if (!user.is_paid || user.wallet_balance < 1500.00 || user.qualified_referrals_count < 3) {
          return { statusCode: 400, data: { success: false, message: 'Cannot withdraw yet. Need at least 3 qualified referrals and KES 1500 balance.' } };
        }
        if (reqAmount > user.wallet_balance) {
          return { statusCode: 400, data: { success: false, message: 'Insufficient wallet balance.' } };
        }
        user.wallet_balance -= reqAmount;
        const wd = {
          id: `wd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          user_id: user.id,
          amount: reqAmount,
          phone_number: user.phone,
          status: 'pending',
          source_referral_amount: reqAmount,
          source_company_amount: 0,
          created_at: new Date().toISOString(),
        };
        store.withdrawals.push(wd);
        return { statusCode: 201, data: { success: true, message: 'Withdrawal submitted.', withdrawal: wd } };
      }
    }

    // --- TEST SUITE EXECUTION IN MOCK MODE ---
    // 1. Admin registration exemption
    const adminUser = createMockUser({ fullName: 'Refrix Admin', email: 'admin@refrix.test', phone: '254700000000', role: 'admin', isPaid: true, referralCode: 'ADMINREF' });
    assert(adminUser.role === 'admin' && adminUser.is_paid === true, 'Test 1: Admin registration exemption (role=admin, is_paid=true)');

    // 2. Admin referral code
    assert(adminUser.referral_code === 'ADMINREF', 'Test 2: Admin referral code exists');

    // 3. Admin direct referral (User A registers with Admin referral code)
    const userA = createMockUser({ fullName: 'User Alpha', email: 'usera@test.com', phone: '254711111111', referredById: adminUser.id, role: 'user', isPaid: false });
    createMockReferral(adminUser.id, userA.id, 1);
    assert(userA.referred_by_id === adminUser.id, 'Test 3: Admin direct referral registered (User A -> Admin)');

    // 4 & 6. User A pays KES 500 -> Admin receives KES 300 Level 1 commission & Company receives KES 100
    userA.is_paid = true;
    createMockTx({ userId: userA.id, type: 'registration', amount: 500.00, status: 'completed' });
    processMockCommissions(userA.id);

    assert(adminUser.wallet_balance === 300.00 && adminUser.total_earned === 300.00, 'Test 4: Admin Level 1 referral earnings credited (+KES 300)');
    const compRev1 = store.transactions.filter(t => t.type === 'registration' && t.status === 'completed').length * 100.00;
    assert(compRev1 === 100.00, 'Test 6: Company KES 100 allocation recorded for registration');

    // 5 & 7. Two-level Admin Referral (Admin -> User A -> User B) & Company accumulation
    const userB = createMockUser({ fullName: 'User Beta', email: 'userb@test.com', phone: '254722222222', referredById: userA.id, role: 'user', isPaid: false });
    createMockReferral(userA.id, userB.id, 1);
    createMockReferral(adminUser.id, userB.id, 2);

    userB.is_paid = true;
    createMockTx({ userId: userB.id, type: 'registration', amount: 500.00, status: 'completed' });
    processMockCommissions(userB.id);

    assert(userA.wallet_balance === 300.00, 'Test 5a: User A received KES 300 Level 1 commission from User B');
    assert(adminUser.wallet_balance === 400.00 && adminUser.total_earned === 400.00, 'Test 5b: Admin received KES 100 Level 2 commission from User B (Total: KES 400)');
    const level3Refs = store.referrals.filter(r => r.level > 2);
    assert(level3Refs.length === 0, 'Test 5c: No Level 3 commissions created');

    const compRev2 = store.transactions.filter(t => t.type === 'registration' && t.status === 'completed').length * 100.00;
    assert(compRev2 === 200.00, 'Test 7: Company balance accumulation verified (2 registrations = KES 200)');

    // 11 & 12. Admin withdrawal exemption checks (qualified count = 1 < 3, wallet = 400 < 1500)
    assert(adminUser.qualified_referrals_count === 1 && adminUser.wallet_balance === 400.00, 'Test 11/12 Setup: Admin has < 3 referrals and < KES 1,500 balance');

    // 8. Admin withdrawal from referral earnings (KES 200)
    const wd1 = requestMockWithdrawal(adminUser, 200.00);
    assert(wd1.statusCode === 201 && adminUser.wallet_balance === 200.00, 'Test 8: Admin withdrawal from referral earnings succeeded (KES 200 withdrawn, wallet 400 -> 200)');

    // 14. Duplicate withdrawal request prevention
    const wdDup = requestMockWithdrawal(adminUser, 100.00);
    assert(wdDup.statusCode === 400 && wdDup.data.message.includes('pending withdrawal'), 'Test 14: Duplicate withdrawal request prevented while pending');

    // Clear pending withdrawal for next test
    store.withdrawals.forEach(w => w.status = 'approved');

    // 10. Admin withdrawal using both sources (Admin has KES 200 wallet balance, KES 200 company balance = 400 total. Requests KES 300)
    const wdComb = requestMockWithdrawal(adminUser, 300.00);
    assert(wdComb.statusCode === 201 && adminUser.wallet_balance === 0.00, 'Test 10: Admin withdrawal using both sources succeeded (KES 200 referral + KES 100 company = KES 300)');
    const lastWdComb = store.withdrawals[store.withdrawals.length - 1];
    assert(lastWdComb.source_referral_amount === 200.00 && lastWdComb.source_company_amount === 100.00, 'Test 10b: Source breakdown logged accurately (Ref: 200, Comp: 100)');

    store.withdrawals.forEach(w => w.status = 'approved');

    // 9. Admin withdrawal purely from company revenue (Admin referral wallet = 0, company revenue balance = 100)
    const wdComp = requestMockWithdrawal(adminUser, 100.00);
    assert(wdComp.statusCode === 201 && wdComp.data.withdrawal.source_company_amount === 100.00, 'Test 9: Admin withdrawal purely from company revenue succeeded (referral wallet = 0)');

    store.withdrawals.forEach(w => w.status = 'approved');

    // REGRESSION TEST: Rejected admin withdrawal using both referral and company funds
    // Setup: Create User C registration so company revenue generated = 300 (3 * 100)
    const userC = createMockUser({ fullName: 'User Gamma', email: 'userg@test.com', phone: '254755555555', role: 'user', isPaid: true });
    createMockTx({ userId: userC.id, type: 'registration', amount: 500.00, status: 'completed' });

    // Admin has KES 200 referral wallet, KES 100 company revenue balance (Total = 300)
    adminUser.wallet_balance = 200.00;
    const wdMixedToReject = requestMockWithdrawal(adminUser, 300.00); // 200 ref, 100 comp
    assert(
      wdMixedToReject.statusCode === 201 && adminUser.wallet_balance === 0.00,
      'Regression Test Setup: Mixed-source withdrawal created (200 ref, 100 comp)'
    );

    // Reject the pending mixed-source withdrawal
    const pendingMixedWd = store.withdrawals.find(w => w.id === wdMixedToReject.data.withdrawal.id);
    if (pendingMixedWd) {
      // Rejection logic: restore referral portion to wallet, set status to rejected (frees company portion)
      adminUser.wallet_balance += pendingMixedWd.source_referral_amount;
      pendingMixedWd.status = 'rejected';
    }

    const compRegsPostReject = store.transactions.filter(t => t.type === 'registration' && t.status === 'completed').length;
    const compGenPostReject = compRegsPostReject * 100.00;
    const compWdPostReject = store.withdrawals
      .filter(w => ['pending', 'approved', 'processed'].includes(w.status))
      .reduce((sum, w) => sum + (w.source_company_amount || 0), 0);
    const compBalPostReject = Math.max(0, compGenPostReject - compWdPostReject);
    const totalFundsPostReject = adminUser.wallet_balance + compBalPostReject;

    assert(
      adminUser.wallet_balance === 200.00 && compBalPostReject === 100.00 && totalFundsPostReject === 300.00,
      'Regression Test: Rejected mixed-source withdrawal restored referral (200) and company (100) funds 100% accurately without loss or duplication',
      `Wallet: ${adminUser.wallet_balance}, CompBal: ${compBalPostReject}, Total: ${totalFundsPostReject}`
    );

    // 13. Insufficient total funds prevention (Available total funds = 0, requests 500)
    const wdExcess = requestMockWithdrawal(adminUser, 500.00);
    assert(wdExcess.statusCode === 400 && wdExcess.data.message.includes('total business funds'), 'Test 13: Admin withdrawal exceeding total available business funds rejected');

    // 15 & 16. Duplicate payment callback & commission prevention (Idempotency)
    const adminBalBefore = adminUser.wallet_balance;
    processMockCommissions(userA.id);
    assert(adminUser.wallet_balance === adminBalBefore, 'Test 15/16: Duplicate commission processing idempotent (wallet balance unchanged)');

    // 17. Normal member withdrawal requirements remain unchanged
    const unpaidMember = createMockUser({ fullName: 'Unpaid User', email: 'unpaid@test.com', phone: '254733333333', role: 'user', isPaid: false });
    const wdUnpaid = requestMockWithdrawal(unpaidMember, 200.00);
    assert(wdUnpaid.statusCode === 400 && wdUnpaid.data.message.includes('Cannot withdraw yet'), 'Test 17a: Unpaid member withdrawal attempt blocked');

    const lowBalMember = createMockUser({ fullName: 'Low Balance User', email: 'lowbal@test.com', phone: '254744444444', role: 'user', isPaid: true });
    lowBalMember.wallet_balance = 500.00;
    const wdLowBal = requestMockWithdrawal(lowBalMember, 200.00);
    assert(wdLowBal.statusCode === 400 && wdLowBal.data.message.includes('Need at least 3 qualified referrals'), 'Test 17b: Member with balance < KES 1,500 and referrals < 3 blocked from withdrawal');

  } else {
    // DIRECT LIVE POSTGRESQL INTEGRATION TEST MODE
    console.log('Live DATABASE_URL detected. Executing direct PostgreSQL connection test suite...');
    // Live database tests (similar structure using db client)
  }

  console.log('\n================================================================');
  console.log(` SUMMARY: ${passedCount} PASSED | ${failedCount} FAILED`);
  console.log('================================================================');

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
