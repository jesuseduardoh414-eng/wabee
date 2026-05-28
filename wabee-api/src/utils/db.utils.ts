/**
 * Utility for DB Resilience (Staff Engineer Implementation)
 */

export async function withDbRetry<T>(
    operation: () => Promise<T>,
    options: {
        maxAttempts?: number;
        baseDelayMs?: number;
        label?: string;
    } = {}
): Promise<T> {
    const {
        maxAttempts = 3,
        baseDelayMs = 1000,
        label = 'DB_OPERATION'
    } = options;

    let lastError: any;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await operation();
        } catch (error: any) {
            lastError = error;

            const errorMessage = error.message || String(error);
            const isTransient =
                errorMessage.includes('ETIMEDOUT') ||
                errorMessage.includes('ECONNRESET') ||
                errorMessage.includes('connection terminated unexpectedly') ||
                errorMessage.includes('Connection terminated due to connection timeout') ||
                errorMessage.includes('timeout') ||
                error.code === 'P2024' || // Prisma connection timeout
                error.code === 'P2025';   // Record not found (safe to retry if it's a fetch)

            if (!isTransient || attempt === maxAttempts) {
                if (attempt === maxAttempts) {
                    console.error(`🔥 [${label}] Final failure after ${attempt} attempts:`, errorMessage);
                }
                throw error;
            }

            const delay = baseDelayMs * Math.pow(2, attempt - 1); // Exponential Backoff: 1s, 2s, 4s...
            console.warn(`⏳ [${label}] Transient error (Attempt ${attempt}/${maxAttempts}). Retrying in ${delay}ms... Details: ${errorMessage}`);

            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError; // Should never reach here due to the return/throw inside the loop
}
