
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

export interface SendTemplateParams {
    channel: any;
    to: string;
    template: any;
    tenantId: string;
    threadId: string;
}

export interface ChannelSender {
    sendText(params: SendTextParams): Promise<SendResult>;
    sendTemplate(params: SendTemplateParams): Promise<SendResult>;
}
