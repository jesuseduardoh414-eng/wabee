/**
 * Compute confidence score for AI response (heuristic MVP v1)
 * 
 * This is a simple heuristic-based confidence scorer.
 * In future versions, this should be replaced with a proper ML classifier.
 * 
 * Algorithm:
 * - Base score: 0.70
 * - Penalties:
 *   - Contains uncertainty phrases ("no sé", "no tengo información", etc.): -0.25
 *   - Very short response (< 15 chars): -0.20
 * - Bonuses:
 *   - Ends with relevant clarifying question: +0.05
 * - Clamp to [0, 1]
 */

const UNCERTAINTY_PHRASES = [
    'no sé',
    'no lo sé',
    'no tengo información',
    'no puedo',
    'lo siento',
    'disculpa',
    'no estoy seguro',
    'desconozco',
];

const CLARIFYING_QUESTION_INDICATORS = [
    '¿podrías',
    '¿puedes',
    '¿me puedes',
    '¿qué tipo',
    '¿cuál',
    '¿necesitas',
];

export function computeConfidence(responseText: string, userText?: string): number {
    let confidence = 0.70; // base score

    const responseLower = responseText.toLowerCase().trim();

    // Penalty: Contains uncertainty phrases
    const hasUncertainty = UNCERTAINTY_PHRASES.some(phrase =>
        responseLower.includes(phrase)
    );

    if (hasUncertainty) {
        confidence -= 0.25;
    }

    // Penalty: Very short response
    if (responseText.trim().length < 15) {
        confidence -= 0.20;
    }

    // Bonus: Ends with clarifying question
    const hasQuestion = responseLower.endsWith('?');
    const hasRelevantQuestion = hasQuestion && CLARIFYING_QUESTION_INDICATORS.some(indicator =>
        responseLower.includes(indicator)
    );

    if (hasRelevantQuestion) {
        confidence += 0.05;
    }

    // Clamp to [0, 1]
    return Math.max(0, Math.min(1, confidence));
}

/**
 * TODO: Replace with ML-based confidence classifier
 * 
 * Future implementation should:
 * - Use a fine-tuned BERT/RoBERTa model
 * - Consider semantic similarity between question and answer
 * - Analyze answer completeness
 * - Detect factual consistency
 * - Use embeddings for context relevance
 */
