const { execSync } = require('child_process');
const fs = require('fs');

const envContent = fs.readFileSync('.env', 'utf8');
let dbUrl = '';
for (const line of envContent.split('\n')) {
    if (line.startsWith('DATABASE_URL=')) {
        dbUrl = line.split('=')[1].replace(/"/g, '').trim();
        break;
    }
}

if (!dbUrl) {
    console.error('No DATABASE_URL found in .env');
    process.exit(1);
}

try {
    execSync('npx prisma db push', {
        env: { ...process.env, DATABASE_URL: dbUrl },
        stdio: 'inherit'
    });
    console.log('✅ Prisma push completado.');
} catch (e) {
    console.error('Error:', e.message);
}
