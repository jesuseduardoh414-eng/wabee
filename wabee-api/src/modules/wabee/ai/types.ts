// AI Response Types

export interface AIResponseResult {
    type: 'AI_MESSAGE' | 'FALLBACK' | 'BLOCKED';
    message?: {
        id: string;
        textBody: string;
        role: string;
        origin: string;
        createdAt: Date;
    };
    text?: string;
}

export interface WebMessageDTO {
    id: string;
    textBody: string;
    role: string;
    origin: string;
    createdAt: Date;
}
