import { describe, it, expect } from 'vitest';

/**
 * Helper logic extracted from AiWidgetResponderService for testing
 */
function normalizeThreshold(value: unknown, fallback = 0.6): number {
    if (value === null || value === undefined) return fallback;
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) return fallback;
    const norm = n > 1 ? n / 100 : n;
    return Math.max(0, Math.min(1, norm));
}

describe('Confidence Threshold Normalization', () => {
    it('should handle percentage values (> 1)', () => {
        expect(normalizeThreshold(70)).toBe(0.7);
        expect(normalizeThreshold(100)).toBe(1.0);
        expect(normalizeThreshold(85.5)).toBe(0.855);
    });

    it('should handle decimal values (0..1)', () => {
        expect(normalizeThreshold(0.7)).toBe(0.7);
        expect(normalizeThreshold(0.95)).toBe(0.95);
        expect(normalizeThreshold(0)).toBe(0.0);
        expect(normalizeThreshold(1.0)).toBe(1.0);
    });

    it('should handle edge cases and clamping', () => {
        expect(normalizeThreshold(101)).toBe(1.0);
        expect(normalizeThreshold(-5)).toBe(0.0);
    });

    it('should handle invalid inputs with fallback', () => {
        expect(normalizeThreshold(null)).toBe(0.6);
        expect(normalizeThreshold(undefined)).toBe(0.6);
        expect(normalizeThreshold('abc')).toBe(0.6);
    });

    it('should handle mixed types', () => {
        expect(normalizeThreshold('80')).toBe(0.8);
        expect(normalizeThreshold('0.5')).toBe(0.5);
    });

    it('should correctly compare confidence >= threshold', () => {
        const confidence = 0.70;
        const rawPercentage = 70;
        const normalized = normalizeThreshold(rawPercentage);

        expect(normalized).toBe(0.70);
        expect(confidence >= normalized).toBe(true);
    });
});
