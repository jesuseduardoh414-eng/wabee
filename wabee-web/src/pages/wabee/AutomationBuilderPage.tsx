import React, { useCallback, useEffect, useState } from 'react';
import {
    ReactFlow,
    ReactFlowProvider,
    addEdge,
    useNodesState,
    useEdgesState,
    Controls,
    Background,
    BackgroundVariant,
    Connection,
    Edge,
    Node,
    NodeProps,
    Handle,
    Position,
    MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useParams, useNavigate } from 'react-router-dom';
import { automationsApi, AutomationFlow } from '@/api/wabee/automations.api';
import { useToast } from '@/context/ToastContext';
import { textTokens as T } from '@/lib/text-tokens';

type FlowNodeData = Record<string, unknown>;
type AppNode = Node<FlowNodeData>;
type AppEdge = Edge;

const NODE_COLORS: Record<string, string> = {
    message: 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/10',
    question: 'border-blue-400 bg-blue-400/10',
    condition: 'border-yellow-400 bg-yellow-400/10',
    assign: 'border-purple-400 bg-purple-400/10',
    webhook: 'border-orange-400 bg-orange-400/10',
    end: 'border-red-400 bg-red-400/10',
};

const NODE_LABELS: Record<string, string> = {
    message: 'Mensaje',
    question: 'Pregunta',
    condition: 'Condición',
    assign: 'Asignar',
    webhook: 'Webhook',
    end: 'Fin',
};

function FlowNode({ data, selected }: NodeProps) {
    const type = (data as any).nodeType as string;
    const colorClass = NODE_COLORS[type] ?? 'border-[var(--border-strong)] bg-[var(--bg-hover)]';

    return (
        <div className={`min-w-[140px] max-w-[200px] cursor-pointer rounded-xl border-2 px-3 py-2 shadow-md transition-all ${colorClass} ${selected ? 'ring-2 ring-white/40' : ''}`}>
            <Handle type="target" position={Position.Top} className="!h-3 !w-3 !border-2 !border-[var(--bg-surface)] !bg-[var(--brand-primary)]" />
            <p className="mb-0.5 text-[9px] font-bold uppercase tracking-widest opacity-60">{NODE_LABELS[type] ?? type}</p>
            <p className="line-clamp-2 text-xs font-medium leading-tight text-white">{(data as any).label || '...'}</p>
            {type === 'condition' ? (
                <>
                    <Handle type="source" position={Position.Bottom} id="true" style={{ left: '30%' }} className="!h-3 !w-3 !border-2 !border-[var(--bg-surface)] !bg-green-400" />
                    <Handle type="source" position={Position.Bottom} id="false" style={{ left: '70%' }} className="!h-3 !w-3 !border-2 !border-[var(--bg-surface)] !bg-red-400" />
                </>
            ) : (
                <Handle type="source" position={Position.Bottom} className="!h-3 !w-3 !border-2 !border-[var(--bg-surface)] !bg-[var(--brand-primary)]" />
            )}
        </div>
    );
}

const nodeTypes = { flowNode: FlowNode };

function nodesToStepsJson(nodes: Node[], edges: Edge[]) {
    const nodesMap: Record<string, any> = {};

    for (const node of nodes) {
        const data = node.data as any;
        const type = data.nodeType;
        const base: any = { id: node.id, type };

        const outgoing = edges.filter((edge) => edge.source === node.id);
        const trueEdge = outgoing.find((edge) => edge.sourceHandle === 'true' || (!edge.sourceHandle && type !== 'condition'));
        const falseEdge = outgoing.find((edge) => edge.sourceHandle === 'false');
        const defaultEdge = outgoing.find((edge) => !edge.sourceHandle);

        if (trueEdge) base.next = trueEdge.target;
        if (falseEdge) base.nextFalse = falseEdge.target;
        if (defaultEdge && type !== 'condition') base.next = defaultEdge.target;

        if (type === 'message') base.text = data.text ?? '';
        if (type === 'question') {
            base.text = data.text ?? '';
            base.field = data.field ?? 'answer';
        }
        if (type === 'condition') {
            base.field = data.field ?? '';
            base.operator = data.operator ?? 'eq';
            base.value = data.value ?? '';
        }
        if (type === 'assign') base.userId = data.userId ?? undefined;
        if (type === 'webhook') {
            base.url = data.url ?? '';
            base.method = data.method ?? 'POST';
            base.body = data.body ?? undefined;
        }

        nodesMap[node.id] = base;
    }

    const startNode = nodes.find((node) => (node.data as any).nodeType !== 'end');
    return { startNodeId: startNode?.id ?? nodes[0]?.id ?? 'start', nodes: nodesMap };
}

function stepsJsonToFlow(stepsJson: any): { nodes: Node[]; edges: Edge[] } {
    if (!stepsJson?.nodes) return { nodes: [], edges: [] };

    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const entries = Object.values(stepsJson.nodes) as any[];

    entries.forEach((node, index) => {
        const col = index % 3;
        const row = Math.floor(index / 3);

        nodes.push({
            id: node.id,
            type: 'flowNode',
            position: { x: col * 220 + 40, y: row * 140 + 40 },
            data: {
                nodeType: node.type,
                label: node.text || node.url || node.field || NODE_LABELS[node.type] || node.type,
                text: node.text,
                field: node.field,
                operator: node.operator,
                value: node.value,
                url: node.url,
                method: node.method,
                body: node.body,
                userId: node.userId,
            },
        });

        if (node.next) {
            edges.push({
                id: `e-${node.id}-true`,
                source: node.id,
                target: node.next,
                sourceHandle: node.type === 'condition' ? 'true' : null,
                label: node.type === 'condition' ? 'Sí' : undefined,
                markerEnd: { type: MarkerType.ArrowClosed },
                style: { stroke: '#6366f1' },
            } as any);
        }

        if (node.nextFalse) {
            edges.push({
                id: `e-${node.id}-false`,
                source: node.id,
                target: node.nextFalse,
                sourceHandle: 'false',
                label: 'No',
                markerEnd: { type: MarkerType.ArrowClosed },
                style: { stroke: '#f87171' },
            } as any);
        }
    });

    return { nodes, edges };
}

function PropertiesPanel({ node, onChange }: { node: Node | null; onChange: (id: string, data: any) => void }) {
    if (!node) {
        return (
            <div className="flex h-full items-center justify-center p-4">
                <p className="text-center text-xs text-[var(--tx-helperText-color,#999)]">Selecciona un nodo para editar sus propiedades.</p>
            </div>
        );
    }

    const data = node.data as any;
    const type = data.nodeType;
    const updateField = (key: string, value: string) => onChange(node.id, { ...data, [key]: value });

    return (
        <div className="h-full space-y-3 overflow-y-auto p-4">
            <p className={`${T.cardTitle} text-xs`}>{NODE_LABELS[type] ?? type}</p>

            {(type === 'message' || type === 'question') && (
                <div>
                    <label className={`${T.labelText} mb-1 block text-[9px]`}>Texto</label>
                    <textarea
                        value={data.text ?? ''}
                        onChange={(e) => updateField('text', e.target.value)}
                        rows={4}
                        className={`w-full resize-none rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1.5 text-xs ${T.inputText} focus:border-[var(--brand-primary)] focus:outline-none`}
                    />
                </div>
            )}

            {type === 'question' && (
                <div>
                    <label className={`${T.labelText} mb-1 block text-[9px]`}>Campo (variable)</label>
                    <input
                        value={data.field ?? ''}
                        onChange={(e) => updateField('field', e.target.value)}
                        placeholder="ej: budget"
                        className={`w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1.5 text-xs ${T.inputText} focus:border-[var(--brand-primary)] focus:outline-none`}
                    />
                </div>
            )}

            {type === 'condition' && (
                <>
                    <div>
                        <label className={`${T.labelText} mb-1 block text-[9px]`}>Campo</label>
                        <input
                            value={data.field ?? ''}
                            onChange={(e) => updateField('field', e.target.value)}
                            placeholder="ej: budget"
                            className={`w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1.5 text-xs ${T.inputText} focus:border-[var(--brand-primary)] focus:outline-none`}
                        />
                    </div>
                    <div>
                        <label className={`${T.labelText} mb-1 block text-[9px]`}>Operador</label>
                        <select
                            value={data.operator ?? 'eq'}
                            onChange={(e) => updateField('operator', e.target.value)}
                            className={`w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1.5 text-xs ${T.inputText} focus:border-[var(--brand-primary)] focus:outline-none`}
                        >
                            {['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'contains', 'exists'].map((operator) => (
                                <option key={operator} value={operator}>
                                    {operator}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className={`${T.labelText} mb-1 block text-[9px]`}>Valor</label>
                        <input
                            value={data.value ?? ''}
                            onChange={(e) => updateField('value', e.target.value)}
                            placeholder="ej: 500"
                            className={`w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1.5 text-xs ${T.inputText} focus:border-[var(--brand-primary)] focus:outline-none`}
                        />
                    </div>
                </>
            )}

            {type === 'webhook' && (
                <>
                    <div>
                        <label className={`${T.labelText} mb-1 block text-[9px]`}>URL</label>
                        <input
                            value={data.url ?? ''}
                            onChange={(e) => updateField('url', e.target.value)}
                            placeholder="https://..."
                            className={`w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1.5 text-xs ${T.inputText} focus:border-[var(--brand-primary)] focus:outline-none`}
                        />
                    </div>
                    <div>
                        <label className={`${T.labelText} mb-1 block text-[9px]`}>Método</label>
                        <select
                            value={data.method ?? 'POST'}
                            onChange={(e) => updateField('method', e.target.value)}
                            className={`w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1.5 text-xs ${T.inputText} focus:border-[var(--brand-primary)] focus:outline-none`}
                        >
                            {['GET', 'POST', 'PUT', 'PATCH'].map((method) => (
                                <option key={method} value={method}>
                                    {method}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className={`${T.labelText} mb-1 block text-[9px]`}>Body (JSON / template)</label>
                        <textarea
                            value={data.body ?? ''}
                            onChange={(e) => updateField('body', e.target.value)}
                            rows={3}
                            className={`w-full resize-none rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1.5 font-mono text-xs ${T.inputText} focus:border-[var(--brand-primary)] focus:outline-none`}
                        />
                    </div>
                </>
            )}

            {type === 'assign' && (
                <div>
                    <label className={`${T.labelText} mb-1 block text-[9px]`}>ID de usuario (opcional)</label>
                    <input
                        value={data.userId ?? ''}
                        onChange={(e) => updateField('userId', e.target.value)}
                        placeholder="UUID del agente"
                        className={`w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-2 py-1.5 text-xs ${T.inputText} focus:border-[var(--brand-primary)] focus:outline-none`}
                    />
                </div>
            )}
        </div>
    );
}

function FlowBuilder() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { success: ok, error: err } = useToast();

    const [flow, setFlow] = useState<AutomationFlow | null>(null);
    const [nodes, setNodes, onNodesChange] = useNodesState<AppNode>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<AppEdge>([]);
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);
    const [publishing, setPublishing] = useState(false);
    const [showProperties, setShowProperties] = useState(false);

    useEffect(() => {
        if (!id) return;

        automationsApi
            .get(id)
            .then((data) => {
                setFlow(data);
                const active = data.versions?.find((version) => version.isActive);

                if (active?.stepsJson) {
                    const parsed = stepsJsonToFlow(active.stepsJson);
                    setNodes(parsed.nodes);
                    setEdges(parsed.edges);
                } else {
                    setNodes([
                        { id: 'start', type: 'flowNode', position: { x: 200, y: 60 }, data: { nodeType: 'message', label: 'Escribe tu primer mensaje', text: '' } },
                        { id: 'end', type: 'flowNode', position: { x: 200, y: 220 }, data: { nodeType: 'end', label: 'Fin' } },
                    ]);
                    setEdges([
                        {
                            id: 'e-start-end',
                            source: 'start',
                            target: 'end',
                            markerEnd: { type: MarkerType.ArrowClosed },
                            style: { stroke: '#6366f1' },
                        } as any,
                    ]);
                }
            })
            .catch(() => err('No se pudo cargar el flujo'));
    }, [id]);

    useEffect(() => {
        if (selectedNode) {
            setShowProperties(true);
        }
    }, [selectedNode]);

    const onConnect = useCallback((params: Connection) => {
        setEdges((currentEdges) => addEdge({ ...params, markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: '#6366f1' } }, currentEdges));
    }, []);

    const addNode = (type: string) => {
        const nodeId = `${type}_${Date.now()}`;
        const newNode: Node = {
            id: nodeId,
            type: 'flowNode',
            position: { x: Math.random() * 300 + 60, y: Math.random() * 200 + 100 },
            data: { nodeType: type, label: NODE_LABELS[type], text: '', field: '', operator: 'eq', value: '', url: '', method: 'POST' },
        };
        setNodes((currentNodes) => [...currentNodes, newNode]);
    };

    const updateNodeData = (nodeId: string, data: any) => {
        setNodes((currentNodes) =>
            currentNodes.map((node) =>
                node.id === nodeId
                    ? { ...node, data: { ...data, label: data.text || data.url || data.field || NODE_LABELS[data.nodeType] || data.nodeType } }
                    : node
            )
        );
        setSelectedNode((current) => (current?.id === nodeId ? { ...current, data } : current));
    };

    const handlePublish = async () => {
        if (!id) return;

        setPublishing(true);
        try {
            const stepsJson = nodesToStepsJson(nodes, edges);
            await automationsApi.publish(id, stepsJson);
            ok('Versión publicada');
        } catch (e: any) {
            err(e.message);
        }
        setPublishing(false);
    };

    return (
        <div className="flex h-screen flex-col overflow-hidden bg-[var(--bg-surface)]">
            <div className="shrink-0 border-b border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-3 sm:px-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate(-1)} className={`${T.helperText} text-xs transition hover:text-white`}>
                            ← Volver
                        </button>
                        <span className={`${T.cardTitle} truncate text-xs`}>{flow?.name ?? 'Builder'}</span>
                    </div>

                    <div className="flex flex-1 flex-wrap gap-1.5">
                        {Object.entries(NODE_LABELS).map(([type, label]) => (
                            <button
                                key={type}
                                onClick={() => addNode(type)}
                                className="rounded-lg border border-[var(--border-default)] px-2 py-1.5 text-[9px] font-bold uppercase tracking-widest text-[var(--tx-cardTitle-color)] transition hover:bg-[var(--bg-input)]"
                            >
                                + {label}
                            </button>
                        ))}
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowProperties((current) => !current)}
                            className="rounded-lg border border-[var(--border-default)] px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition hover:bg-[var(--bg-input)] lg:hidden"
                        >
                            {showProperties ? 'Ocultar panel' : 'Propiedades'}
                        </button>
                        <button
                            onClick={handlePublish}
                            disabled={publishing}
                            className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-xs font-bold uppercase tracking-widest text-white transition hover:opacity-90 disabled:opacity-40"
                        >
                            {publishing ? '...' : 'Publicar'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
                <div className="min-h-0 flex-1">
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        nodeTypes={nodeTypes}
                        onNodeClick={(_, node) => setSelectedNode(node)}
                        onPaneClick={() => setSelectedNode(null)}
                        fitView
                    >
                        <Controls />
                        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="var(--border-default)" />
                    </ReactFlow>
                </div>

                <div className={`${showProperties ? 'block' : 'hidden'} max-h-[42vh] shrink-0 border-t border-[var(--border-default)] bg-[var(--bg-card)] lg:block lg:max-h-none lg:w-72 lg:border-l lg:border-t-0`}>
                    <div className="flex items-center justify-between border-b border-[var(--border-default)] px-4 py-2">
                        <p className={`${T.cardTitle} text-xs`}>Propiedades</p>
                        <button
                            onClick={() => setShowProperties(false)}
                            className="text-[10px] font-bold uppercase tracking-widest text-[var(--tx-helperText-color,#999)] lg:hidden"
                        >
                            Cerrar
                        </button>
                    </div>
                    <PropertiesPanel node={selectedNode} onChange={updateNodeData} />
                </div>
            </div>
        </div>
    );
}

export default function AutomationBuilderPage() {
    return (
        <ReactFlowProvider>
            <FlowBuilder />
        </ReactFlowProvider>
    );
}
