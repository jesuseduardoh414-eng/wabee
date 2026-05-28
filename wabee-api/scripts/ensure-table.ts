import { prisma } from '../src/config/core/core.prisma';

async function check() {
  try {
    const result = await (prisma as any).dataDeletionRequest.findMany({ take: 1 });
    console.log('Tabla data_deletion_requests existe.');
  } catch (e: any) {
    console.error('Error al acceder a la tabla:', e.message);
    if (e.message.includes('does not exist')) {
       console.log('La tabla NO existe. Intentando crearla manualmente...');
       // Intento de creación manual si falla la migración automática
       await (prisma as any).$executeRawUnsafe(`
          CREATE SCHEMA IF NOT EXISTS core;
          CREATE TABLE IF NOT EXISTS core.data_deletion_requests (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            full_name TEXT NOT NULL,
            email TEXT NOT NULL,
            phone TEXT,
            description TEXT,
            status TEXT NOT NULL DEFAULT 'PENDING',
            requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            reviewed_at TIMESTAMPTZ,
            reviewed_by UUID,
            completed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
       `);
       console.log('Tabla creada exitosamente.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

check();
