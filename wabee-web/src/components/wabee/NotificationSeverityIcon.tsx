import React from 'react';
import { CheckCircle, AlertTriangle, ShieldAlert, Info } from 'lucide-react';

export function NotificationSeverityIcon({ severity, type, size = 18 }: { severity?: string | null, type?: string, size?: number }) {
    if (type === 'SECURITY_ALERT') {
        return <ShieldAlert size={size} className="text-red-500 shrink-0" />;
    }
    if (type === 'AI_ALERT') {
        return <AlertTriangle size={size} className="text-[#ead018] shrink-0" />;
    }
    if (type !== 'CAMPAIGN_ALERT' && type) {
        return <Info size={size} className="text-blue-500 shrink-0" />;
    }

    // Default or CAMPAIGN_ALERT
    if (severity === "success" || severity === "info") {
        return <CheckCircle size={size} className="text-green-400 shrink-0" />;
    }

    if (severity === "warning") {
        return <AlertTriangle size={size} className="text-yellow-400 shrink-0" />;
    }

    if (severity === "critical" || severity === "error") {
        return <AlertTriangle size={size} className="text-red-500 shrink-0" />;
    }

    return <AlertTriangle size={size} className="text-orange-500 shrink-0" />;
}
