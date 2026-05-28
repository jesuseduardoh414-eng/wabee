import { env } from '../../../config/env';
import { chatGemini, FunctionDeclaration, GeminiFunctionCall } from './gemini.client';

export interface ChatLLMOptions {
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
}

/**
 * Unified LLM Client - Now strictly using Gemini
 */
export async function chatLLM(opts: ChatLLMOptions): Promise<{ text: string; tokens?: number; functionCall?: GeminiFunctionCall; }> {
    const timeout = opts.timeoutMs || parseInt(env.AI_REQUEST_TIMEOUT_MS, 10) || 120000;
    const model = env.GEMINI_MODEL || 'gemini-1.5-flash';

    return chatGemini({
        ...opts,
        model,
        timeoutMs: timeout,
        responseMimeType: opts.responseMimeType,
        responseSchema: opts.responseSchema
    });
}
