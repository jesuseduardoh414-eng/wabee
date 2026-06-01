// ── Node definitions ──────────────────────────────────────────────────────────

export type NodeType = 'message' | 'question' | 'condition' | 'assign' | 'webhook' | 'end';

export interface BaseNode {
    id: string;
    type: NodeType;
    next?: string;       // id of the next node on the default/true path
    nextFalse?: string;  // id of the next node when condition is false
}

export interface MessageNode extends BaseNode {
    type: 'message';
    text: string;
}

export interface QuestionNode extends BaseNode {
    type: 'question';
    text: string;
    field: string;       // key stored in automationState.answers
}

export interface ConditionNode extends BaseNode {
    type: 'condition';
    field: string;       // key from automationState.answers
    operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'exists';
    value?: string | number;
}

export interface AssignNode extends BaseNode {
    type: 'assign';
    userId?: string;     // specific user UUID, or omit to unassign
}

export interface WebhookNode extends BaseNode {
    type: 'webhook';
    url: string;
    method: 'GET' | 'POST' | 'PUT' | 'PATCH';
    headers?: Record<string, string>;
    body?: string;           // template string — {{answers.field}} interpolation
    responseField?: string;  // store response body under this key in answers
}

export interface EndNode extends BaseNode {
    type: 'end';
}

export type FlowNode =
    | MessageNode
    | QuestionNode
    | ConditionNode
    | AssignNode
    | WebhookNode
    | EndNode;

// ── Flow definition (stepsJson shape) ────────────────────────────────────────

export interface FlowDefinition {
    startNodeId: string;
    nodes: Record<string, FlowNode>;  // nodeId → node
}

// ── Runtime state (stored in WhatsappThread.automationState) ─────────────────

export type AutomationRunStatus = 'RUNNING' | 'WAITING_ANSWER' | 'COMPLETED' | 'ERROR';

export interface AutomationState {
    flowVersionId: string;
    currentNodeId: string;
    status: AutomationRunStatus;
    answers: Record<string, string>;
    startedAt: string;
    lastStepAt: string;
    errorMessage?: string;
}

// ── Engine output per turn ────────────────────────────────────────────────────

export interface AutomationStepResult {
    handled: boolean;        // true = automation handled this message, skip AI
    outboundText?: string;   // message to send to the user (if any)
    assign?: string;         // userId to assign, undefined = no change
    webhookUrl?: string;     // fired webhook URL (for audit)
    completed: boolean;      // flow reached an end node
    newState: AutomationState | null;
}
