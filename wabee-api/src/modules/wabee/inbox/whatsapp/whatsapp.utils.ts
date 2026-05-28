export class WhatsAppUtils {
    /**
     * Strictly normalizes phone numbers to E.164 format for WhatsApp Cloud API (MX focus).
     * 
     * Rules:
     * 1. Strip all non-digit characters.
     * 2. If 10 digits: Prepend '52' -> Return 12 digits.
     * 3. If 12 digits and starts with '52': Return as is.
     * 4. ALL OTHER FORMATS (including 13 digits 521...): THROW ERROR.
     * 
     * Rationale:
     * - We want a single canonical format for database storage (12 digits for MX).
     * - We expressly forbid ambiguous 13-digit numbers to prevent threading duplication.
     * - We do NOT strip '1' automatically to avoid accidental data loss if the number wasn't actually MX mobile.
     */
    static normalizeToE164Digits(phone: string): string {
        if (!phone) throw new Error('Phone number is empty');
        const digits = phone.replace(/[^\d]/g, ''); // Strip non-digits

        // --- Caso Especial: México (Estandarización a 12 dígitos) ---

        // Regla 1: 10 dígitos (local MX) -> Agregar 52
        if (digits.length === 10) {
            return '52' + digits;
        }

        // Regla 2: 13 dígitos que empiezan con 521 (Móvil MX legado) -> Quitar el '1'
        if (digits.length === 13 && digits.startsWith('521')) {
            return '52' + digits.substring(3);
        }

        // --- Caso General: Formatos Internacionales ---

        // Si tiene entre 11 y 15 dígitos (rango estándar E.164), lo aceptamos tal cual.
        // Esto cubre números de US (11 dígitos, ej. 1555...), otros países, y números de prueba.
        if (digits.length >= 11 && digits.length <= 15) {
            return digits;
        }

        throw {
            status: 400,
            message: `Invalid phone format. Must be between 10 and 15 digits: ${phone}`
        };
    }
}
