require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function applySchema() {
  const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;
  if (!connectionString) {
    console.error('ERROR: DATABASE_URL is not set in backend/.env');
    console.log('Please add DATABASE_URL=postgresql://postgres:<password>@<host>:5432/postgres to backend/.env');
    console.log('OR copy the SQL contents from backend/src/config/schema.sql into your Supabase Dashboard SQL Editor at:');
    console.log('https://supabase.com/dashboard/project/hycnzzwaqsbpqvcksjdm/sql/new');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to PostgreSQL database...');
    await client.connect();
    console.log('Connected successfully!');

    const sqlPath = path.join(__dirname, '../config/schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Executing Phase 2 approved SQL DDL schema...');
    await client.query(sql);
    console.log('Schema DDL executed successfully!');

  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await client.end();
  }
}

applySchema();
