import { AlertCircle, Check, CheckCheck, Clock } from 'lucide-react';

export type DeliveryStatusValue =
    | 'PENDING'
    | 'SENT'
    | 'DELIVERED'
    | 'READ'
    | 'FAILED'
    | null
    | undefined;

interface MessageDeliveryStatusProps {
    deliveryStatus?: DeliveryStatusValue;
    direction?: 'INBOUND' | 'OUTBOUND';
    /** Tamaño del ícono en px (default: 14) */
    size?: number;
}

/**
 * Renderiza el indicador de estado de entrega estilo WhatsApp.
 * Solo visible para mensajes OUTBOUND.
 *
 * PENDING / null / undefined  → ⏱ reloj gris sutil
 * SENT                        → ✓  check gris
 * DELIVERED                   → ✓✓ doble check gris
 * READ                        → ✓✓ doble check amarillo (#ead018)
 * FAILED                      → ⚠  warning rojo sutil
 */
export function MessageDeliveryStatus({
    deliveryStatus,
    direction,
    size = 14,
}: MessageDeliveryStatusProps) {
    // Solo aplica a mensajes OUTBOUND
    if (direction !== 'OUTBOUND') return null;

    const cls = `flex-shrink-0`;
    const px = `${size}px`;

    // FAILED
    if (deliveryStatus === 'FAILED') {
        return (
            <AlertCircle
                className={cls}
                style={{ width: px, height: px, color: '#f87171' /* red-400 */ }}
            />
        );
    }

    // READ — doble check amarillo tema WABEE
    if (deliveryStatus === 'READ') {
        return (
            <CheckCheck
                className={cls}
                style={{ width: px, height: px, color: '#ead018' }}
            />
        );
    }

    // DELIVERED — doble check gris
    if (deliveryStatus === 'DELIVERED') {
        return (
            <CheckCheck
                className={cls}
                style={{ width: px, height: px, color: '#9ca3af' /* gray-400 */ }}
            />
        );
    }

    // SENT — una palomita gris
    if (deliveryStatus === 'SENT') {
        return (
            <Check
                className={cls}
                style={{ width: px, height: px, color: '#9ca3af' }}
            />
        );
    }

    // PENDING (o null / undefined) — reloj gris sutil
    return (
        <Clock
            className={cls}
            style={{ width: px, height: px, color: '#6b7280' /* gray-500 */ }}
        />
    );
}
