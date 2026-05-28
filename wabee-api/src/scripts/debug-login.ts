import dotenv from 'dotenv';
dotenv.config();
import { core } from '../config/core/core.infra';

async function debugLogin() {
    const email = 'reelsprueba1@gmail.com';
    const password = 'WABEE123!';

    console.log(`--- Depurando Login para: ${email} ---`);
    try {
        // Probamos el login directamente con el core
        const result = await core.auth.login.execute({ email, password });
        console.log('✅ Login Exitoso:', result?.user?.email);
        console.log('Token generado:', result.token ? 'SÍ' : 'NO');
    } catch (error: any) {
        console.error('❌ Error de Login Detallado:');
        console.error('Nombre del error:', error.constructor.name);
        console.error('Mensaje interno:', error.message);
        console.error('Stack:', error.stack);

        // Si el error es una instancia de InvalidCredentialsError,
        // intentamos ver qué error lanzó el authService internamente
        // (aunque el usecase lo oculta, aquí el script falló en .execute)
    } finally {
        // En este entorno de script, el proceso puede quedar colgado por Prisma
        process.exit(0);
    }
}

debugLogin();
