const pg = require('pg');

const DATABASE_URL = 'postgresql://postgres.inyblrlxueigslayvduf:3UyvrJQsULboFD2N@aws-1-us-west-2.pooler.supabase.com:5432/postgres';
const TENANT_ID = 'b3d4e321-ae17-4e57-a6f4-fe0eef09482d';
const PLAN_TEMPLATE_ID = '3ed5aa21-d08c-42aa-87e8-5b25f1ef265f';

const pool = new pg.Pool({ connectionString: DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    // Check active subscriptions (no status filter)
    console.log('\n=== SUBSCRIPTIONS ===');
    const subs = await client.query(
      `SELECT id, status, plan_code_snapshot, modules_snapshot, snapshot_json
       FROM core.subscriptions WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 3`,
      [TENANT_ID]
    );
    subs.rows.forEach(row => {
      console.log('id:', row.id, '| status:', row.status, '| plan_code:', row.plan_code_snapshot);
      console.log('modules_snapshot:', JSON.stringify(row.modules_snapshot));
      if (row.snapshot_json?.modules) console.log('snapshot.modules:', JSON.stringify(row.snapshot_json.modules));
    });
    if (subs.rows.length === 0) console.log('NO SUBSCRIPTIONS');

    // Check plan template
    console.log('\n=== PLAN TEMPLATE ===');
    const plan = await client.query(
      `SELECT id, name, modules, metadata FROM core.plan_templates WHERE id = $1`,
      [PLAN_TEMPLATE_ID]
    );
    console.log('name:', plan.rows[0]?.name);
    console.log('modules:', JSON.stringify(plan.rows[0]?.modules));
    console.log('metadata:', JSON.stringify(plan.rows[0]?.metadata));

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => { console.error(e.message); process.exit(1); });
