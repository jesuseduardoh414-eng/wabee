import 'dotenv/config';
import { prisma } from '../config/core/core.prisma';

async function main() {
    try {
        console.log("Running manual DB migration for PlatformRole...");
        await prisma.$executeRawUnsafe(`
            DO $$ BEGIN
                CREATE TYPE "core"."PlatformRole" AS ENUM ('USER', 'SUPER_ADMIN');
            EXCEPTION WHEN duplicate_object THEN null; END $$;
        `);
        console.log("Enum PlatformRole verified/created.");

        await prisma.$executeRawUnsafe(`
            ALTER TABLE "core"."profiles" 
            ADD COLUMN IF NOT EXISTS "platform_role" "core"."PlatformRole" NOT NULL DEFAULT 'USER';
        `);
        console.log("Column platform_role verified/added.");
        console.log("Migration successful.");
    } catch (e) {
        console.error("Error updating DB:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
