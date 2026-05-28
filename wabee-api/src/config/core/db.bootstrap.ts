import { prisma } from './core.prisma';
import { env } from '../env';

/**
 * DB Bootstrap Resiliente
 * Módulo encargado de realizar el handshake inicial con Supabase/PostgreSQL.
 * Retrasará el flujo de ejecución principal en caso de caídas de DNS (EAI_AGAIN)
 * o de conexión hasta que se recupere.
 */
export class DatabaseBootstrap {
    
    /**
     * Valida la URL y lanza Advertencias Tempranas de Configuración.
     */
    static checkEnvironment() {
        if (!env.DATABASE_URL) {
            console.error('[DB_BOOTSTRAP] ❌ CRÍTICO: DATABASE_URL no está definida.');
            return false;
        }

        const dbUrl = env.DATABASE_URL.toLowerCase();
        
        // Supabase Alert: Direct Host vs Pooler en entornos Serverless/Workers
        if (dbUrl.includes('.supabase.co') && dbUrl.includes(':5432')) {
            console.warn('');
            console.warn('┌─────────────────────────────────────────────────────────────┐');
            console.warn('│  ⚠️  ADVERTENCIA: CONEXIÓN DIRECTA A SUPABASE (PUERTO 5432) │');
            console.warn('│  Estás usando el host directo. En entornos con Workers o    │');
            console.warn('│  Edge, esto puede agotar rápidamente el límite de conexio-  │');
            console.warn('│  nes de Postgres o causar demoras (EAI_AGAIN).              │');
            console.warn('│  💡 SUGERENCIA: Usa la URL del Pooler (puerto 6543)         │');
            console.warn('└─────────────────────────────────────────────────────────────┘');
            console.warn('');
        }

        return true;
    }

    /**
     * Ejecuta el Healthcheck con Exponential Backoff
     */
    static async connectWithRetry(maxRetries: number = 20): Promise<boolean> {
        let attempt = 1;
        let baseDelayMs = 2000; // Arranca en 2s

        this.checkEnvironment();

        const dbUrl = env.DATABASE_URL || '';
        const isPooler = dbUrl.includes(':6543');

        console.log(`[DB_BOOTSTRAP] ⏳ Iniciando pre-conexión a la Base de Datos...`);
        if (isPooler) {
            console.log(`[DB_BOOTSTRAP] 💡 Modo SUPABASE POOLER detectado (Puerto 6543).`);
        }

        while (attempt <= maxRetries) {
            try {
                // El query más simple y seguro para despertar el DB Pooler
                await prisma.$queryRawUnsafe(`SELECT 1;`);
                console.log(`[DB_BOOTSTRAP] ✅ Conexión a DB establecida con éxito! (Intento ${attempt})`);
                return true;
            } catch (err: any) {
                const errorMessage = err.message || '';
                const isDnsError = errorMessage.includes('EAI_AGAIN') || errorMessage.includes('ENOTFOUND');
                const isAuthError = errorMessage.includes('28P01') || errorMessage.includes('password authentication failed');
                const isTimeoutError = errorMessage.includes('ETIMEOUT') || errorMessage.includes('query_timeout');
                const isRefusedError = errorMessage.includes('ECONNREFUSED');

                if (isDnsError) {
                    console.error(`[DB_BOOTSTRAP] ❌ [DNS_ERROR] Fallo de Resolución (Supabase/Host Inalcanzable) [Intento ${attempt}/${maxRetries}]`);
                    console.error(`[DB_BOOTSTRAP] 👉 Sugerencia: Revisa tu conexión a internet o intenta usar el Pooler (6543) si estás en una red restringida.`);
                } else if (isAuthError) {
                    console.error(`[DB_BOOTSTRAP] ❌ [AUTH_ERROR] Error de credenciales [Intento ${attempt}/${maxRetries}]`);
                    console.error(`[DB_BOOTSTRAP] 👉 Sugerencia: Verifica el usuario y password en tu DATABASE_URL.`);
                } else if (isTimeoutError) {
                    console.error(`[DB_BOOTSTRAP] ❌ [TIMEOUT_ERROR] La conexión excedió el tiempo de espera [Intento ${attempt}/${maxRetries}]`);
                } else if (isRefusedError) {
                    console.error(`[DB_BOOTSTRAP] ❌ [UNREACHABLE_ERROR] El servidor rechazó la conexión en el puerto configurado [Intento ${attempt}/${maxRetries}]`);
                } else {
                    console.error(`[DB_BOOTSTRAP] ❌ Error de Conexión Desconocido [Intento ${attempt}/${maxRetries}]:`, errorMessage.split('\n')[0]);
                }

                if (attempt === maxRetries) {
                    console.error(`[DB_BOOTSTRAP] 💥 Número máximo de reintentos alcanzado. El API no podrá operar correctamente.`);
                    return false;
                }

                console.log(`[DB_BOOTSTRAP] 🔄 Reintentando en ${baseDelayMs / 1000}s...`);
                await new Promise(res => setTimeout(res, baseDelayMs));
                
                attempt++;
                baseDelayMs = Math.min(baseDelayMs * 1.5, 15000); // Exponencial capado a 15s
            }
        }

        return false;
    }
}
