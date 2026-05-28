const pg = require('pg');

const DATABASE_URL = 'postgresql://postgres.inyblrlxueigslayvduf:3UyvrJQsULboFD2N@aws-1-us-west-2.pooler.supabase.com:5432/postgres';

const pool = new pg.Pool({ connectionString: DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    // 1. Check if wabee.web_widgets table exists
    const tableCheck = await client.query(`
      SELECT table_name, table_schema
      FROM information_schema.tables
      WHERE table_schema = 'wabee' AND table_name = 'web_widgets'
    `);
    console.log('web_widgets table exists:', tableCheck.rows.length > 0);
    if (tableCheck.rows.length === 0) {
      console.log('❌ TABLE MISSING — need to run migration!');
    }

    // 2. Check all wabee tables
    const allTables = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'wabee'
      ORDER BY table_name
    `);
    console.log('\nAll wabee tables:', allTables.rows.map(r => r.table_name));

    // 3. If table exists, try to count rows
    if (tableCheck.rows.length > 0) {
      const count = await client.query(`SELECT COUNT(*) FROM wabee.web_widgets`);
      console.log('\nweb_widgets row count:', count.rows[0].count);
    }

    // 4. Check current modules in plan_snapshot
    const sub = await client.query(`
      SELECT id, plan_snapshot->'modules' as modules
      FROM core.subscriptions
      WHERE id = '44f4ae2b-23a5-4e24-bfb2-e178e6510adb'
    `);
    if (sub.rows.length > 0) {
      console.log('\nModules in plan_snapshot:', JSON.stringify(sub.rows[0].modules));
    }

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => { console.error(e.message); process.exit(1); });
