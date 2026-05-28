const pg = require('pg');

const DATABASE_URL = 'postgresql://postgres.inyblrlxueigslayvduf:3UyvrJQsULboFD2N@aws-1-us-west-2.pooler.supabase.com:5432/postgres';
const pool = new pg.Pool({ connectionString: DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    // 1. Verificar si kb_files existe
    const kbFiles = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'wabee' AND table_name = 'kb_files'
    `);
    console.log('kb_files table exists:', kbFiles.rows.length > 0 ? '✅ YES' : '❌ NO — NEED MIGRATION');

    // 2. Verificar si kb_chunks existe
    const kbChunks = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'wabee' AND table_name = 'kb_chunks'
    `);
    console.log('kb_chunks table exists:', kbChunks.rows.length > 0 ? '✅ YES' : '❌ NO — NEED MIGRATION');

    // 3. Si existen, mostrar columnas de kb_files
    if (kbFiles.rows.length > 0) {
      const cols = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'wabee' AND table_name = 'kb_files'
        ORDER BY ordinal_position
      `);
      console.log('\nColumnas de kb_files:');
      cols.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type}) ${r.is_nullable === 'NO' ? 'NOT NULL' : ''}`));

      const count = await client.query(`SELECT COUNT(*) FROM wabee.kb_files`);
      console.log(`\nTotal filas en kb_files: ${count.rows[0].count}`);
    }

    // 4. Verificar ai_profiles
    const profiles = await client.query(`
      SELECT id, name FROM wabee.ai_profiles LIMIT 5
    `);
    console.log('\nAI Profiles en DB:', profiles.rows);

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => { console.error('Error:', e.message); process.exit(1); });
