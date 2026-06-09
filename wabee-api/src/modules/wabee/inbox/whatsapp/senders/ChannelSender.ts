
export interface SendTextParams {
    channel: any;
    to: string;
    text: string;
    tenantId: string;
    threadId: string;
}

export interface SendResult {
    externalId: string;
    raw: any;
}

export interface SendMediaParams {
    channel: any;
    to: string;
    mediaType: 'image' | 'video' | 'document';
    mediaLink: string;
    caption?: string;
    filename?: string;
    tenantId: string;
    threadId: string;
}

export interface SendTemplateParams {
    channel: any;
    to: string;
    template: any;
    tenantId: string;
    threadId: string;
}

export interface ChannelSender {
    sendText(params: SendTextParams): Promise<SendResult>;
    sendMedia(params: SendMediaParams): Promise<SendResult>;
    sendTemplate(params: SendTemplateParams): Promise<SendResult>;
}
