import 'dotenv/config';
import pg from 'pg';

async function runMigration() {
    const connectionString = process.env.DATABASE_URL!;
    const client = new pg.Client({ connectionString });
    await client.connect();

    console.log('[MigrateCoreOrganizations] Conectado a la base de datos.');

    try {
        // Step 1: Create core.products table
        await client.query(`
            CREATE TABLE IF NOT EXISTS core.products (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name TEXT NOT NULL,
                slug TEXT NOT NULL UNIQUE,
                description TEXT,
                base_url TEXT,
                status TEXT NOT NULL DEFAULT 'active',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                deleted_at TIMESTAMPTZ
            );
        `);
        console.log('[MigrateCoreOrganizations] ✅ core.products OK');

        // Step 2: Add missing columns to core.organizations
        const alterColumns = [
            `ALTER TABLE core.organizations ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT ''`,
            `ALTER TABLE core.organizations ADD COLUMN IF NOT EXISTS logo_url TEXT`,
            `ALTER TABLE core.organizations ADD COLUMN IF NOT EXISTS plan_template_id UUID`,
            `ALTER TABLE core.organizations ADD COLUMN IF NOT EXISTS product_id UUID`,
            `ALTER TABLE core.organizations ADD COLUMN IF NOT EXISTS external_customer_id TEXT`,
            `ALTER TABLE core.organizations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`,
            `ALTER TABLE core.organizations ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'`,
        ];

        for (const sql of alterColumns) {
            await client.query(sql);
            const col = sql.match(/ADD COLUMN IF NOT EXISTS (\w+)/)?.[1];
            console.log(`[MigrateCoreOrganizations] ✅ core.organizations.${col} OK`);
        }

        // Step 3: Add FK constraint (ignore if exists)
        try {
            await client.query(`
                ALTER TABLE core.organizations
                    ADD CONSTRAINT fk_organizations_product
                    FOREIGN KEY (product_id)
                    REFERENCES core.products(id);
            `);
            console.log('[MigrateCoreOrganizations] ✅ FK product_id OK');
        } catch (e: any) {
            if (e.code !== '42710') { // duplicate_object
                console.warn('[MigrateCoreOrganizations] FK ya existe o error menor:', e.message);
            }
        }

        console.log('[MigrateCoreOrganizations] 🎉 Migración completada exitosamente.');
    } catch (err) {
        console.error('[MigrateCoreOrganizations] ❌ Error en migración:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

runMigration();
