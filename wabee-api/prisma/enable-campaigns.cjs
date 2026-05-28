const pg = require('pg');

const DATABASE_URL = 'postgresql://postgres.inyblrlxueigslayvduf:3UyvrJQsULboFD2N@aws-1-us-west-2.pooler.supabase.com:5432/postgres';
const SUBSCRIPTION_ID = '44f4ae2b-23a5-4e24-bfb2-e178e6510adb';

const pool = new pg.Pool({ connectionString: DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    // Read current state
    const cur = await client.query(
      `SELECT modules_snapshot, snapshot_json FROM core.subscriptions WHERE id = $1`,
      [SUBSCRIPTION_ID]
    );
    const row = cur.rows[0];
    console.log('Current modules_snapshot:', JSON.stringify(row.modules_snapshot));

    // Enable campaigns in modules_snapshot
    const newModules = { ...row.modules_snapshot, campaigns: true };

    // Enable campaigns in snapshot_json.modules too
    let newSnapshot = row.snapshot_json || {};
    if (newSnapshot.modules) {
      newSnapshot = { ...newSnapshot, modules: { ...newSnapshot.modules, campaigns: true } };
    }

    await client.query(
      `UPDATE core.subscriptions SET modules_snapshot = $1, snapshot_json = $2 WHERE id = $3`,
      [JSON.stringify(newModules), JSON.stringify(newSnapshot), SUBSCRIPTION_ID]
    );

    console.log('✅ campaigns enabled');
    console.log('New modules_snapshot:', JSON.stringify(newModules));
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => { console.error(e.message); process.exit(1); });
