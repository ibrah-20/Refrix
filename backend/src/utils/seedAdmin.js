require('dotenv').config();
const mongoose = require('mongoose');
const { nanoid } = require('nanoid');
const User = require('../models/User');
const connectDB = require('../config/database');

const seedAdmin = async () => {
  await connectDB();

  const existing = await User.findOne({ email: process.env.ADMIN_EMAIL });
  if (existing) {
    console.log('Admin already exists:', existing.email);
    process.exit(0);
  }

  await User.create({
    fullName: 'Refrix Admin',
    email: process.env.ADMIN_EMAIL,
    phone: '254700000000',
    password: process.env.ADMIN_PASSWORD,
    referralCode: nanoid(8).toUpperCase(),
    role: 'admin',
    isPaid: true,
  });

  console.log('Admin created:', process.env.ADMIN_EMAIL);
  process.exit(0);
};

seedAdmin().catch((err) => {
  console.error(err);
  process.exit(1);
});
