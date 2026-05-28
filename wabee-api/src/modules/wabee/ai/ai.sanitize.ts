/**
 * Aggressive sanitizer to remove LLM internal reasoning, meta-preambles, 
 * and robotic phrases from the assistant response.
 */
export function sanitizeAssistantText(text: string, options: { allowShort?: boolean } = {}): string {
    if (!text) return '';

    let clean = text;

    // 1. Remove XML-like tags (case-insensitive)
    // <think>...</think>, <analysis>...</analysis>, <thought>...</thought>
    clean = clean.replace(/<(think|analysis|thought)>[\s\S]*?<\/\1>/gi, '');
    // Remove loose tags if any remain
    clean = clean.replace(/<\/?(think|analysis|thought)>/gi, '');

    // 2. Remove Markdown code blocks if they contain "think" or "analysis" 
    // (Commonly used by models to hide reasoning)
    clean = clean.replace(/```[\s\S]*?(think|analysis)[\s\S]*?```/gi, '');

    // 3. Remove lines/headers starting with keywords
    const roboticHeaders = [
        'pensamiento:',
        'análisis:',
        'razonamiento:',
        'thought:',
        'analysis:',
        'reasoning:'
    ];
    const lines = clean.split('\n');
    clean = lines.filter(line => {
        const trimmed = line.trim().toLowerCase();
        return !roboticHeaders.some(header => trimmed.startsWith(header));
    }).join('\n');

    // 4. Remove meta-preambles (Case Insensitive)
    // Only match if they appear at the very beginning of the response or a new line
    // Relaxed 'para confirmarte' to avoid cutting valid introductory phrases
    const roboticSentences = [
        /^para confirmarte qué[\s\S]*?(\.|\?|!)/gi, 
        /^necesito consultar[\s\S]*?(\.|\?|!)/gi,
        /^déjame revisar[\s\S]*?(\.|\?|!)/gi,
        /^analizando su solicitud[\s\S]*?(\.|\?|!)/gi,
        /^según el contexto[\s\S]*?(\.|\?|!)/gi,
        /^como (ia|asistente) virtual[\s\S]*?(\.|\?|!)/gi,
        /^en base a la información[\s\S]*?(\.|\?|!)/gi,
        /^revisando el contexto[\s\S]*?(\.|\?|!)/gi
    ];

    roboticSentences.forEach(regex => {
        clean = clean.replace(regex, '');
    });

    // 5. Normalizar saltos de línea (máximo 1 línea en blanco)
    clean = clean.replace(/\n{3,}/g, '\n\n');

    // 6. Final trim
    clean = clean.trim();

    // 7. Fallback amigable if empty or too short (unless allowed)
    if (!options.allowShort && clean.length < 5) {
        return '¡Listo! 😊 ¿Me dices qué necesitas exactamente para ayudarte mejor?';
    }

    return clean;
}
