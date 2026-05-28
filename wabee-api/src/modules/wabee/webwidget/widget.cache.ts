import { WebWidget } from '@prisma/client';

interface CacheEntry {
    data: any;
    expiresAt: number;
}

class WidgetCache {
    private cache = new Map<string, CacheEntry>();
    private TTL_MS = 60 * 1000; // 1 minute (reduced from 10m for reactivity)

    get(widgetId: string): any | null {
        const entry = this.cache.get(widgetId);
        if (!entry) return null;

        if (Date.now() > entry.expiresAt) {
            this.cache.delete(widgetId);
            console.log(`[WidgetCache] EXPIRED: ${widgetId}`);
            return null;
        }

        console.log(`[WidgetCache] HIT: ${widgetId}`);
        return entry.data;
    }

    set(widgetId: string, data: any): void {
        console.log(`[WidgetCache] MISS/SET: ${widgetId}`);
        this.cache.set(widgetId, {
            data,
            expiresAt: Date.now() + this.TTL_MS,
        });
    }

    delete(widgetId: string): void {
        if (this.cache.has(widgetId)) {
            console.log(`[WidgetCache] INVALIDATED: ${widgetId}`);
            this.cache.delete(widgetId);
        }
    }

    clear(): void {
        this.cache.clear();
    }
}

export const widgetCache = new WidgetCache();
