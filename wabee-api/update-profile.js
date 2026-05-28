const { PrismaClient } = require('./src/modules/core/generated/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const profile = await prisma.profile.findUnique({
      where: { email: 'antigravityp5@gmail.com' }
    });
    console.log('Profile found:', profile);
    if (profile) {
      const updated = await prisma.profile.update({
        where: { id: profile.id },
        data: { status: 'active', emailVerifiedAt: new Date() }
      });
      console.log('Profile updated successfully:', updated.status);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
