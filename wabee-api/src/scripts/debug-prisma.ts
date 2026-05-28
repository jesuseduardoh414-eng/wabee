import { execSync } from 'child_process';
try {
    const output = execSync('npx prisma db push --schema prisma/schema.prisma --accept-data-loss', { encoding: 'utf8' });
    console.log(output);
} catch (error: any) {
    console.error('ERROR:', error.stdout || error.message);
}
