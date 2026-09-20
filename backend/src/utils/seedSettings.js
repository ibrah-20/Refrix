require('dotenv').config();
const { systemSettingsRepository } = require('../repositories');
const db = require('../db');

const seedSettings = async () => {
  const settings = await systemSettingsRepository.getSettings();
  console.log('SystemSettings initialized/verified:', settings);
  if (db.pool) await db.pool.end();
  process.exit(0);
};

seedSettings().catch(async (err) => {
  console.error(err);
  if (db.pool) await db.pool.end();
  process.exit(1);
});

