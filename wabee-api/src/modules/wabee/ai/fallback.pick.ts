/**
 * Picks a template variant based on a seed.
 * Variations should be stable per day but different across threads.
 */
export function pickVariant(threadId: string, count: number): number {
    if (count <= 0) return 0;

    // Seed: threadId + current date (YYYY-MM-DD)
    const today = new Date().toISOString().split('T')[0];
    const seed = `${threadId}:${today}`;

    const hash = djb2(seed);
    return Math.abs(hash) % count;
}

/**
 * Standard djb2 hash algorithm
 */
function djb2(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = (hash * 33) ^ str.charCodeAt(i);
    }
    return hash >>> 0;
}
