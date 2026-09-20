require('dotenv').config();
const bcrypt = require('bcryptjs');
const { nanoid } = require('nanoid');
const { userRepository } = require('../repositories');
const db = require('../db');

const seedAdmin = async () => {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@refrix.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'AdminPass123!';

  const existing = await userRepository.findByEmail(adminEmail);
  if (existing) {
    console.log('Admin already exists:', existing.email);
    if (db.pool) await db.pool.end();
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await userRepository.create({
    fullName: 'Refrix Admin',
    email: adminEmail,
    phone: '254700000000',
    passwordHash,
    referralCode: nanoid(8).toUpperCase(),
    role: 'admin',
    isPaid: true,
  });

  console.log('Admin created:', adminEmail);
  if (db.pool) await db.pool.end();
  process.exit(0);
};

seedAdmin().catch(async (err) => {
  console.error(err);
  if (db.pool) await db.pool.end();
  process.exit(1);
});

