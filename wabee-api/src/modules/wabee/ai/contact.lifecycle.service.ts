/**
 * ContactLifecycleService
 * ─────────────────────────────────────────────────────────────────────
 * Lógica conservadora de transición de estados para contactos.
 *
 * Reglas:
 *   - No se degrada un estado más avanzado sin señal explícita.
 *   - BLOCKED / ARCHIVED se respetan siempre.
 *   - CUSTOMER solo se asigna con señal fuerte (no se auto-asigna por IA).
 *   - Cada transición se loguea con tenantId, motivo y timestamp.
 */

import { prisma } from '@/lib/prisma';
import { ContactLifecycleStatus } from '@prisma/client';

/** Orden numérico de cada estado para comparar avance sin degradar. */
const LIFECYCLE_ORDER: Record<ContactLifecycleStatus, number> = {
    NEW: 0,
    LEAD: 1,
    ACTIVE: 2,
    CUSTOMER: 3,
    INACTIVE: -1, // neutral / no posicional
    BLOCKED: 99,
    ARCHIVED: 99,
};

/** Indica si el contacto puede ser atendido normalmente por la IA. */
export function isContactOperative(status: ContactLifecycleStatus): boolean {
    return status !== 'BLOCKED' && status !== 'ARCHIVED';
}

/**
 * Detecta si el mensaje del usuario denota intención comercial / de soporte.
 * Usada para la transición NEW -> LEAD.
 */
const LEAD_INTENT_PATTERNS = [
    /informes?/i,
    /cotizaci[oó]n/i,
    /precio/i,
    /cu[aá]nto cuesta/i,
    /me interesa/i,
    /quiero saber/i,
    /quiero info/i,
    /disponibilidad/i,
    /horario/i,
    /servicio/i,
    /producto/i,
    /tengo una duda/i,
    /necesito ayuda/i,
    /soporte/i,
    /ayuda/i,
    /consulta/i,
];

export function detectsLeadIntent(text: string): boolean {
    return LEAD_INTENT_PATTERNS.some(p => p.test(text));
}

/**
 * Aplica la transición de lifecycle de forma conservadora.
 *
 * @param contactId  UUID del Contact en BD
 * @param tenantId   UUID del tenant
 * @param newStatus  Estado propuesto
 * @param reason     Motivo legible para traza
 * @returns          Estado aplicado (puede ser el mismo si ya era más avanzado)
 */
export async function advanceLifecycle(
    contactId: string,
    tenantId: string,
    newStatus: ContactLifecycleStatus,
    reason: string
): Promise<ContactLifecycleStatus> {
    const contact = await prisma.contact.findUnique({
        where: { id: contactId },
        select: { lifecycleStatus: true }
    });

    if (!contact) {
        console.warn(`[Lifecycle] Contacto ${contactId} no encontrado.`);
        return newStatus;
    }

    const current = contact.lifecycleStatus;

    // BLOCKED o ARCHIVED se mantienen siempre — no cambia la IA.
    if (current === 'BLOCKED' || current === 'ARCHIVED') {
        console.log(`[Lifecycle] ⛔ Contacto ${contactId} en estado ${current} — sin cambio.`);
        return current;
    }

    // CUSTOMER solo se asigna manualmente — la IA no asigna.
    if (newStatus === 'CUSTOMER') {
        console.log(`[Lifecycle] 🔒 CUSTOMER solo se asigna manualmente — sin cambio automático.`);
        return current;
    }

    const currentOrder = LIFECYCLE_ORDER[current] ?? 0;
    const newOrder = LIFECYCLE_ORDER[newStatus] ?? 0;

    // No degradar si el estado nuevo es menor que el actual.
    if (newOrder <= currentOrder && current !== 'INACTIVE') {
        console.log(`[Lifecycle] ✅ ${current} es igual o más avanzado que ${newStatus} — sin cambio.`);
        return current;
    }

    // Aplicar el cambio
    await prisma.contact.update({
        where: { id: contactId },
        data: {
            lifecycleStatus: newStatus,
            lastInteractionAt: new Date()
        }
    });

    console.log(`[Lifecycle] 🔄 ${contactId}: ${current} → ${newStatus} | motivo: "${reason}"`);
    return newStatus;
}
