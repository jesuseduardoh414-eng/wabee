/**
 * Normalizes a list of domains or a comma-separated string of domains.
 * Rules:
 * - Trim + lowercase
 * - Remove protocol (http/https)
 * - Remove paths (/path), query params, and hashes
 * - Remove ports (:3000)
 * - Filter out empty strings and duplicates
 */
export const normalizeDomains = (input: string | string[]): string[] => {
    const list = typeof input === 'string' ? input.split(',') : input;

    const normalized = list.map(domain => {
        let d = domain.trim().toLowerCase();
        // Remove protocol
        d = d.replace(/^https?:\/\//, '');
        // Split by / to remove path, query, hash
        d = d.split('/')[0];
        // Split by : to remove port
        d = d.split(':')[0];
        return d;
    }).filter(d => d.length > 0);

    // Return unique values
    return [...new Set(normalized)];
};

/**
 * Basic deep equal implementation to detect changes in configuration objects.
 */
export const deepEqual = (a: any, b: any): boolean => {
    if (a === b) return true;

    if (a && b && typeof a === 'object' && typeof b === 'object') {
        if (a.constructor !== b.constructor) return false;

        let length, i, keys;
        if (Array.isArray(a)) {
            length = a.length;
            if (length !== b.length) return false;
            for (i = length; i-- !== 0;) {
                if (!deepEqual(a[i], b[i])) return false;
            }
            return true;
        }

        keys = Object.keys(a);
        length = keys.length;
        if (length !== Object.keys(b).length) return false;

        for (i = length; i-- !== 0;) {
            if (!Object.prototype.hasOwnProperty.call(b, keys[i])) return false;
        }

        for (i = length; i-- !== 0;) {
            const key = keys[i];
            if (!deepEqual(a[key], b[key])) return false;
        }

        return true;
    }

    // true if both NaN, otherwise false
    return a !== a && b !== b;
};
