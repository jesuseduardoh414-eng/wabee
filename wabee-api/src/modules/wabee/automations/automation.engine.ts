import {
    FlowDefinition,
    FlowNode,
    AutomationState,
    AutomationStepResult,
    ConditionNode,
    WebhookNode,
} from './automation.types';

const WEBHOOK_TIMEOUT_MS = 10_000;
const MAX_STEPS_PER_TURN = 10; // prevents infinite loops on chains of non-waiting nodes

// ── Template interpolation  ───────────────────────────────────────────────────

function interpolate(template: string, answers: Record<string, string>): string {
    return template.replace(/\{\{answers\.(\w+)\}\}/g, (_, key) => answers[key] ?? '');
}

// ── Condition evaluation ──────────────────────────────────────────────────────

function evalCondition(node: ConditionNode, answers: Record<string, string>): boolean {
    const raw = answers[node.field];

    if (node.operator === 'exists') return raw !== undefined && raw !== '';

    const strVal = raw ?? '';
    const nodeVal = String(node.value ?? '');

    const numRaw = parseFloat(raw ?? '');
    const numNode = parseFloat(nodeVal);
    const numbersValid = !isNaN(numRaw) && !isNaN(numNode);

    switch (node.operator) {
        case 'eq':       return strVal === nodeVal;
        case 'neq':      return strVal !== nodeVal;
        case 'contains': return strVal.includes(nodeVal);
        case 'gt':       return numbersValid && numRaw > numNode;
        case 'lt':       return numbersValid && numRaw < numNode;
        case 'gte':      return numbersValid && numRaw >= numNode;
        case 'lte':      return numbersValid && numRaw <= numNode;
        default:         return false;
    }
}

// ── Webhook execution ─────────────────────────────────────────────────────────

async function fireWebhook(
    node: WebhookNode,
    answers: Record<string, string>,
): Promise<string | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

    try {
        const body = node.body ? interpolate(node.body, answers) : undefined;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(node.headers ?? {}),
        };

        const res = await fetch(node.url, {
            method: node.method,
            headers,
            body: ['POST', 'PUT', 'PATCH'].includes(node.method) ? body : undefined,
            signal: controller.signal,
        });

        const text = await res.text();
        return text;
    } finally {
        clearTimeout(timer);
    }
}

// ── Main engine ───────────────────────────────────────────────────────────────

export class AutomationEngine {

    /**
     * Processes a single inbound message against an active automation flow.
     *
     * Call this BEFORE the AI orchestrator. If handled=true, skip AI entirely.
     *
     * @param flow       - The parsed FlowDefinition (stepsJson)
     * @param state      - Current AutomationState from WhatsappThread.automationState
     * @param userMessage - The raw inbound message text
     */
    async processTurn(
        flow: FlowDefinition,
        state: AutomationState,
        userMessage: string,
    ): Promise<AutomationStepResult> {

        const answers = { ...state.answers };
        let currentNodeId = state.currentNodeId;
        let outboundParts: string[] = [];
        let assign: string | undefined;
        let webhookUrl: string | undefined;
        let steps = 0;

        // If we were waiting for an answer, store it first
        if (state.status === 'WAITING_ANSWER') {
            const waitingNode = flow.nodes[currentNodeId];
            if (waitingNode?.type === 'question') {
                answers[waitingNode.field] = userMessage.trim();
                currentNodeId = waitingNode.next ?? '__end__';
            }
        }

        // Walk the graph until we need to wait for user input, reach end, or hit the step limit
        while (steps < MAX_STEPS_PER_TURN) {
            steps++;
            const node: FlowNode | undefined = flow.nodes[currentNodeId];

            if (!node || node.type === 'end' || currentNodeId === '__end__') {
                const now = new Date().toISOString();
                return {
                    handled: true,
                    outboundText: outboundParts.join('\n\n') || undefined,
                    assign,
                    webhookUrl,
                    completed: true,
                    newState: {
                        ...state,
                        answers,
                        currentNodeId,
                        status: 'COMPLETED',
                        lastStepAt: now,
                    },
                };
            }

            if (node.type === 'message') {
                outboundParts.push(node.text);
                currentNodeId = node.next ?? '__end__';

            } else if (node.type === 'question') {
                outboundParts.push(node.text);
                const now = new Date().toISOString();
                return {
                    handled: true,
                    outboundText: outboundParts.join('\n\n'),
                    assign,
                    webhookUrl,
                    completed: false,
                    newState: {
                        ...state,
                        answers,
                        currentNodeId: node.id,
                        status: 'WAITING_ANSWER',
                        lastStepAt: now,
                    },
                };

            } else if (node.type === 'condition') {
                const result = evalCondition(node, answers);
                currentNodeId = result ? (node.next ?? '__end__') : (node.nextFalse ?? '__end__');

            } else if (node.type === 'assign') {
                assign = node.userId;
                currentNodeId = node.next ?? '__end__';

            } else if (node.type === 'webhook') {
                webhookUrl = node.url;
                try {
                    const responseBody = await fireWebhook(node, answers);
                    if (node.responseField && responseBody !== null) {
                        answers[node.responseField] = responseBody;
                    }
                } catch (err: any) {
                    // Webhook failure: log but continue to next node
                    console.error(`[AutomationEngine] Webhook failed for node ${node.id}: ${err.message}`);
                    answers[`${node.id}_error`] = err.message;
                }
                currentNodeId = node.next ?? '__end__';
            }
        }

        // Step limit reached — treat as error to avoid infinite loop
        const now = new Date().toISOString();
        return {
            handled: true,
            outboundText: outboundParts.join('\n\n') || undefined,
            assign,
            webhookUrl,
            completed: false,
            newState: {
                ...state,
                answers,
                currentNodeId,
                status: 'ERROR',
                lastStepAt: now,
                errorMessage: `Max steps (${MAX_STEPS_PER_TURN}) exceeded — possible cycle in flow`,
            },
        };
    }

    /**
     * Creates the initial AutomationState when a flow is first triggered.
     */
    initState(flowVersionId: string, flow: FlowDefinition): AutomationState {
        const now = new Date().toISOString();
        return {
            flowVersionId,
            currentNodeId: flow.startNodeId,
            status: 'RUNNING',
            answers: {},
            startedAt: now,
            lastStepAt: now,
        };
    }
}

export const automationEngine = new AutomationEngine();
