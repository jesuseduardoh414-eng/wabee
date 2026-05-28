import { env } from '../../../config/env';

interface GeminiResponse {
    candidates?: Array<{
        content?: {
            parts?: Array<{
                text?: string;
                [key: string]: any;
            }>;
            [key: string]: any;
        };
        finishReason?: string;
        [key: string]: any;
    }>;
    usageMetadata?: any;
    [key: string]: any;
}

export interface FunctionDeclaration {
    name: string;
    description: string;
    parameters: any;
}

export interface GeminiFunctionCall {
    name: string;
    args: any;
}

/**
 * Gemini REST Client Implementation
 */
export async function chatGemini(opts: {
    model: string;
    system: string;
    messages: Array<{
        role: 'user' | 'assistant' | 'function';
        content?: string;
        functionCall?: GeminiFunctionCall;
        functionResponse?: { name: string; response: any }
    }>;
    tools?: FunctionDeclaration[];
    maxTokens?: number;
    temperature?: number;
    timeoutMs?: number;
    responseMimeType?: string;
    responseSchema?: any;
}): Promise<{ text: string; tokens?: number; functionCall?: GeminiFunctionCall; }> {
    const apiKey = env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error('[GeminiClient] MISSING_API_KEY: Please set GEMINI_API_KEY in .env');
        return { text: 'Configuración de IA incompleta (Gemini API Key faltante).' };
    }

    const { model, system, messages, tools, maxTokens, temperature, timeoutMs, responseMimeType, responseSchema } = opts;

    // Auto-resolve model name based on discovery: gemini-1.5-flash -> gemini-flash-latest
    let targetModel = model;
    if (model === 'gemini-1.5-flash' || model === 'gemini-1.5-flash-latest') {
        targetModel = 'gemini-flash-latest';
    }

    const modelPath = targetModel.startsWith('models/') ? targetModel : `models/${targetModel}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/${modelPath}:generateContent?key=${apiKey}`;

    // Map conversation history to Gemini format
    const contents = messages.map(m => {
        const parts: any[] = [];
        if (m.content) parts.push({ text: m.content });
        if (m.functionCall) parts.push({ functionCall: m.functionCall });
        if (m.functionResponse) parts.push({ functionResponse: m.functionResponse });

        let targetRole = 'user';
        if (m.role === 'assistant') targetRole = 'model';
        if (m.role === 'function') targetRole = 'function'; // o 'user' con type functionResponse

        return { role: targetRole, parts };
    });

    const payload: any = {
        contents,
        generationConfig: {
            maxOutputTokens: maxTokens || 1024,
            temperature: temperature ?? 0.7,
            ...(responseMimeType ? { responseMimeType } : {}),
            ...(responseSchema ? { responseSchema } : {})
        }
    };

    if (tools && tools.length > 0) {
        payload.tools = [{
            functionDeclarations: tools
        }];
    }

    // Use systemInstruction for v1beta (v1 sometimes rejects it)
    if (system) {
        payload.systemInstruction = {
            parts: [{ text: system }]
        };
    }

    const startTime = Date.now();
    console.log(`[GeminiClient] CHAT_START model=${targetModel} url=${url.split('?')[0]} chars=${messages.reduce((acc, m) => acc + (m.content ? m.content.length : 0), 0)}`);

    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
        const iterationStart = Date.now();
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), timeoutMs || 30000);

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            clearTimeout(timeout);
            const duration = Date.now() - startTime;

            if (!response.ok) {
                const errorBody = await response.text();
                // Si es un error 503 o 429 y no hemos agotado reintentos, esperamos y seguimos
                if ((response.status === 503 || response.status === 429) && retryCount < maxRetries - 1) {
                    retryCount++;
                    const waitTime = Math.pow(2, retryCount) * 1000;
                    console.warn(`[GeminiClient] CHAT_RETRY ${retryCount}/${maxRetries} status=${response.status} waiting=${waitTime}ms`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue;
                }
                
                console.error(`[GeminiClient] CHAT_ERR ms=${duration} status=${response.status} body=${errorBody}`);
                throw new Error(`Gemini API error: ${response.status}`);
            }

            const data = (await response.json()) as GeminiResponse;
            const candidate = data.candidates?.[0];
            const functionCallPart = candidate?.content?.parts?.find(p => p.functionCall);
            const resolvedFunctionCall = functionCallPart?.functionCall as GeminiFunctionCall | undefined;
            const text = candidate?.content?.parts?.find(p => p.text)?.text || '';
            const tokens = data.usageMetadata?.totalTokenCount;

            if (resolvedFunctionCall) {
                console.log(`[GeminiClient] 🔧 FUNCTION_CALL: ${resolvedFunctionCall.name}`);
            }

            console.log(`[GeminiClient] CHAT_OK ms=${duration} len=${text.length} tokens=${tokens || 'N/A'}`);
            return { text, tokens, functionCall: resolvedFunctionCall };

        } catch (error: any) {
            const duration = Date.now() - startTime;
            if (error.name === 'AbortError') {
                console.error(`[GeminiClient] CHAT_ERR ms=${duration} msg=Timeout`);
                return { text: 'La respuesta de la IA tardó demasiado.' };
            }

            // Si es otro error y hay reintentos
            if (retryCount < maxRetries - 1) {
                retryCount++;
                console.warn(`[GeminiClient] CHAT_RETRY ${retryCount}/${maxRetries} err=${error.message}`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
            }

            console.error(`[GeminiClient] CHAT_ERR ms=${duration} msg=${error.message}`);
            return { text: 'Tuve un problema al conectar con Gemini.' };
        }
    }

    return { text: 'Tuve un problema al conectar con Gemini.' };
}
