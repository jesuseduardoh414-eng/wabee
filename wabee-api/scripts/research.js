const { Client } = require('pg');

const connectionString = "postgresql://postgres:redfordesign4@db.usxtsysnpyqklfgsjmai.supabase.co:5432/postgres";

async function main() {
    console.log('--- REPORTE TÉCNICO DE OBJETOS DB ---');
    
    const client = new Client({ connectionString });

    try {
        await client.connect();
        
        console.log('\n--- 1. BUSCANDO VISTAS ---');
        const viewsRes = await client.query(`
            SELECT schemaname, viewname 
            FROM pg_views 
            WHERE (definition LIKE '%r4d_app_v1.%' 
               OR definition LIKE '%public.auth_challenges%'
               OR schemaname = 'r4d_app_v1')
            AND schemaname NOT IN ('pg_catalog', 'information_schema');
        `);
        if (viewsRes.rows.length === 0) {
            console.log('No se detectaron vistas afectadas.');
        } else {
            console.log('Vistas detectadas:', viewsRes.rows);
        }

        console.log('\n--- 2. BUSCANDO FUNCIONES/PROCEDIMIENTOS ---');
        const funcRes = await client.query(`
            SELECT n.nspname as schema, p.proname as name
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE (prosrc LIKE '%r4d_app_v1.%' 
               OR prosrc LIKE '%public.auth_challenges%'
               OR n.nspname = 'r4d_app_v1')
            AND n.nspname NOT IN ('pg_catalog', 'information_schema');
        `);
        if (funcRes.rows.length === 0) {
            console.log('No se detectaron funciones afectadas.');
        } else {
            console.log('Funciones detectadas:', funcRes.rows);
        }

        console.log('\n--- 3. BUSCANDO TRIGGERS ---');
        const triggerRes = await client.query(`
            SELECT tgname as name, n.nspname as table_schema, relname as table_name
            FROM pg_trigger t
            JOIN pg_class c ON c.oid = t.tgrelid
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE (n.nspname = 'r4d_app_v1' OR n.nspname = 'public') 
            AND tgisinternal = false;
        `);
        if (triggerRes.rows.length === 0) {
            console.log('No se detectaron triggers personalizados afectados.');
        } else {
            console.log('Triggers detectados:', triggerRes.rows);
        }

        console.log('\n--- 4. PERMISOS (GRANTS) ---');
        const schemaPrivRes = await client.query(`
            SELECT grantee, privilege_type 
            FROM information_schema.usage_privileges 
            WHERE object_name = 'r4d_app_v1' AND object_type = 'SCHEMA';
        `);
        console.log('Privilegios de SCHEMA en r4d_app_v1:', schemaPrivRes.rows);

    } catch (err) {
        console.error('ERROR EN INVESTIGACIÓN:', err.message);
    } finally {
        await client.end();
    }
}

main();
