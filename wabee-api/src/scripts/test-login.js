require('dotenv').config();
const { AuthFactory } = require('@r4d-26/core');
const { PrismaClient } = require('@prisma/client');

async function test() {
    const prisma = new PrismaClient();
    const core = AuthFactory.withConfig({
        supabase: {
            url: process.env.SUPABASE_URL,
            serviceKey: process.env.SUPABASE_SERVICE_KEY,
        },
        jwt: {
            secret: process.env.JWT_SECRET,
            expiresIn: process.env.JWT_EXPIRES_IN,
        }
    }).initialize(prisma);

    try {
        console.log('--- Test Login ---');
        const res = await core.auth.login.execute({
            email: 'reelsprueba1@gmail.com',
            password: 'WABEE123!'
        });
        console.log('Success:', res.success);
    } catch (e) {
        console.error('FAILED with error:', e.message);
        if (e.stack) console.error(e.stack);
    } finally {
        await prisma.$disconnect();
        process.exit(0);
    }
}

test();
