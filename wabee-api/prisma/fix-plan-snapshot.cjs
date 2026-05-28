const pg = require('pg');

const DATABASE_URL = 'postgresql://postgres.inyblrlxueigslayvduf:3UyvrJQsULboFD2N@aws-1-us-west-2.pooler.supabase.com:5432/postgres';
const SUBSCRIPTION_ID = '44f4ae2b-23a5-4e24-bfb2-e178e6510adb';

const pool = new pg.Pool({ connectionString: DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    // Read current plan_snapshot
    const cur = await client.query(
      `SELECT plan_snapshot, modules_snapshot FROM core.subscriptions WHERE id = $1`,
      [SUBSCRIPTION_ID]
    );
    const row = cur.rows[0];
    console.log('Current plan_snapshot:', JSON.stringify(row.plan_snapshot));
    console.log('Current modules_snapshot:', JSON.stringify(row.modules_snapshot));

    // Build full modules (all enabled for dev/testing)
    const fullModules = {
      dashboard: true,
      inbox: true,
      contacts: true,
      segments: true,
      groups: true,
      templatesHub: true,
      aiProfiles: true,
      webWidgets: true,
      integrationsTools: true,
      channels: true,
      campaigns: true,
      audit: true,
      team: true,
    };

    // Update plan_snapshot to include modules
    let planSnapshot = row.plan_snapshot || {};
    planSnapshot = { ...planSnapshot, modules: fullModules };

    await client.query(
      `UPDATE core.subscriptions
       SET plan_snapshot = $1,
           modules_snapshot = $2,
           snapshot_json = $3
       WHERE id = $4`,
      [
        JSON.stringify(planSnapshot),
        JSON.stringify(fullModules),
        JSON.stringify({ ...planSnapshot, modules: fullModules }),
        SUBSCRIPTION_ID
      ]
    );

    console.log('\n✅ Updated plan_snapshot, modules_snapshot, and snapshot_json');
    console.log('New modules:', JSON.stringify(fullModules));
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => { console.error(e.message); process.exit(1); });
