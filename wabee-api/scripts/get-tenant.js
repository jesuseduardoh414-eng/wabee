const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:redfordesign4@db.usxtsysnpyqklfgsjmai.supabase.co:5432/postgres?schema=r4d_app_v1'
});

async function run() {
    await client.connect();
    const res = await client.query('SELECT table_schema, table_name FROM information_schema.tables WHERE table_name = \'organizations\'');
    console.log("TABLES===>", res.rows);

    // If found, query it
    if (res.rows.length > 0) {
        const sch = res.rows[0].table_schema;
        const orgRes = await client.query(`SELECT id FROM ${sch}.organizations LIMIT 1`);
        console.log("TENANT===>", orgRes.rows[0].id);
    }

    await client.end();
}

run().catch(console.error);
