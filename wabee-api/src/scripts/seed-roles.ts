import { core } from '../config/core/core.infra';

async function seed() {
    console.log('🌱 Registrando roles del sistema...');
    try {
        const result = await (core.admin.product as any).seedRoles.execute();
        console.log('✅ Roles registrados con éxito:', result);
        process.exit(0);
    } catch (error: any) {
        console.error('❌ Error al registrar roles:', error.message);
        process.exit(1);
    }
}

seed();
