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
    type NodeChange,
    type EdgeChange,
} from '@xyflow/react';

type FlowNodeData = Record<string, unknown>;
type AppNode = Node<FlowNodeData>;
type AppEdge = Edge;
import '@xyflow/react/dist/style.css';
import { useParams, useNavigate } from 'react-router-dom';
import { automationsApi, AutomationFlow } from '@/api/wabee/automations.api';
import { useToast } from '@/context/ToastContext';
import { textTokens as T } from '@/lib/text-tokens';

// ── Node type colors ──────────────────────────────────────────────────────────
const NODE_COLORS: Record<string, string> = {
    message:   'border-[var(--brand-primary)] bg-[var(--brand-primary)]/10',
    question:  'border-blue-400 bg-blue-400/10',
    condition: 'border-yellow-400 bg-yellow-400/10',
    assign:    'border-purple-400 bg-purple-400/10',
    webhook:   'border-orange-400 bg-orange-400/10',
    end:       'border-red-400 bg-red-400/10',
};

const NODE_LABELS: Record<string, string> = {
    message:   'Mensaje',
    question:  'Pregunta',
    condition: 'Condición',
    assign:    'Asignar',
    webhook:   'Webhook',
    end:       'Fin',
};

// ── Custom node component ─────────────────────────────────────────────────────
function FlowNode({ data, selected }: NodeProps) {
    const type = (data as any).nodeType as string;
    const colorCls = NODE_COLORS[type] ?? 'border-gray-400 bg-gray-400/10';
    return (
        <div className={`min-w-[140px] max-w-[200px] border-2 rounded-xl px-3 py-2 shadow-md cursor-pointer transition-all ${colorCls} ${selected ? 'ring-2 ring-white/40' : ''}`}>
            <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-[var(--brand-primary)] !border-2 !border-[var(--bg-surface)]" />
            <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-0.5">{NODE_LABELS[type] ?? type}</p>
            <p className="text-xs font-medium text-white leading-tight line-clamp-2">{(data as any).label || '...'}</p>
            {/* Two source handles for condition nodes (true/false) */}
            {type === 'condition' ? (
                <>
                    <Handle type="source" position={Position.Bottom} id="true" style={{ left: '30%' }} className="!w-3 !h-3 !bg-green-400 !border-2 !border-[var(--bg-surface)]" />
                    <Handle type="source" position={Position.Bottom} id="false" style={{ left: '70%' }} className="!w-3 !h-3 !bg-red-400 !border-2 !border-[var(--bg-surface)]" />
                </>
            ) : (
                <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-[var(--brand-primary)] !border-2 !border-[var(--bg-surface)]" />
            )}
        </div>
    );
}

const nodeTypes = { flowNode: FlowNode };

// ── Serialization helpers ─────────────────────────────────────────────────────
function nodesToStepsJson(nodes: Node[], edges: Edge[]) {
    const nodesMap: Record<string, any> = {};

    for (const node of nodes) {
        const d = node.data as any;
        const type = d.nodeType;
        const base: any = { id: node.id, type };

        // Add next / nextFalse from edges
        const outgoing = edges.filter(e => e.source === node.id);
        const trueEdge  = outgoing.find(e => e.sourceHandle === 'true' || (!e.sourceHandle && type !== 'condition'));
        const falseEdge = outgoing.find(e => e.sourceHandle === 'false');
        const defaultEdge = outgoing.find(e => !e.sourceHandle);

        if (trueEdge)   base.next      = trueEdge.target;
        if (falseEdge)  base.nextFalse = falseEdge.target;
        if (defaultEdge && type !== 'condition') base.next = defaultEdge.target;

        // Copy type-specific fields
        if (type === 'message')   base.text = d.text ?? '';
        if (type === 'question')  { base.text = d.text ?? ''; base.field = d.field ?? 'answer'; }
        if (type === 'condition') { base.field = d.field ?? ''; base.operator = d.operator ?? 'eq'; base.value = d.value ?? ''; }
        if (type === 'assign')    base.userId = d.userId ?? undefined;
        if (type === 'webhook')   { base.url = d.url ?? ''; base.method = d.method ?? 'POST'; base.body = d.body ?? undefined; }

        nodesMap[node.id] = base;
    }

    const startNode = nodes.find(n => (n.data as any).nodeType !== 'end');
    return { startNodeId: startNode?.id ?? nodes[0]?.id ?? 'start', nodes: nodesMap };
}

function stepsJsonToFlow(stepsJson: any): { nodes: Node[]; edges: Edge[] } {
    if (!stepsJson?.nodes) return { nodes: [], edges: [] };

    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const entries = Object.values(stepsJson.nodes) as any[];

    entries.forEach((n, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        nodes.push({
            id: n.id,
            type: 'flowNode',
            position: { x: col * 220 + 40, y: row * 140 + 40 },
            data: {
                nodeType: n.type,
                label: n.text || n.url || n.field || NODE_LABELS[n.type] || n.type,
                text: n.text, field: n.field, operator: n.operator, value: n.value,
                url: n.url, method: n.method, body: n.body, userId: n.userId,
            },
        });

        if (n.next) {
            edges.push({ id: `e-${n.id}-true`, source: n.id, target: n.next, sourceHandle: n.type === 'condition' ? 'true' : null, label: n.type === 'condition' ? '✓' : undefined, markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: '#6366f1' } } as any);
        }
        if (n.nextFalse) {
            edges.push({ id: `e-${n.id}-false`, source: n.id, target: n.nextFalse, sourceHandle: 'false', label: '✗', markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: '#f87171' } } as any);
        }
    });

    return { nodes, edges };
}

// ── Property panel ────────────────────────────────────────────────────────────
function PropertiesPanel({ node, onChange }: { node: Node | null; onChange: (id: string, data: any) => void }) {
    if (!node) return (
        <div className="h-full flex items-center justify-center p-4">
            <p className="text-xs text-[var(--tx-helperText-color,#999)] text-center">Selecciona un nodo para editar sus propiedades</p>
        </div>
    );

    const d = node.data as any;
    const type = d.nodeType;
    const field = (key: string, value: string) => onChange(node.id, { ...d, [key]: value });

    return (
        <div className="p-4 space-y-3 overflow-y-auto h-full">
            <p className={`${T.cardTitle} text-xs`}>{NODE_LABELS[type] ?? type}</p>

            {(type === 'message' || type === 'question') && (
                <div>
                    <label className={`${T.labelText} text-[9px] block mb-1`}>Texto</label>
                    <textarea value={d.text ?? ''} onChange={e => field('text', e.target.value)} rows={4}
                        className={`w-full px-2 py-1.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border-default)] text-xs ${T.inputText} focus:outline-none focus:border-[var(--brand-primary)] resize-none`} />
                </div>
            )}

            {type === 'question' && (
                <div>
                    <label className={`${T.labelText} text-[9px] block mb-1`}>Campo (variable)</label>
                    <input value={d.field ?? ''} onChange={e => field('field', e.target.value)} placeholder="ej: budget"
                        className={`w-full px-2 py-1.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border-default)] text-xs ${T.inputText} focus:outline-none focus:border-[var(--brand-primary)]`} />
                </div>
            )}

            {type === 'condition' && (
                <>
                    <div>
                        <label className={`${T.labelText} text-[9px] block mb-1`}>Campo</label>
                        <input value={d.field ?? ''} onChange={e => field('field', e.target.value)} placeholder="ej: budget"
                            className={`w-full px-2 py-1.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border-default)] text-xs ${T.inputText} focus:outline-none focus:border-[var(--brand-primary)]`} />
                    </div>
                    <div>
                        <label className={`${T.labelText} text-[9px] block mb-1`}>Operador</label>
                        <select value={d.operator ?? 'eq'} onChange={e => field('operator', e.target.value)}
                            className={`w-full px-2 py-1.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border-default)] text-xs ${T.inputText} focus:outline-none focus:border-[var(--brand-primary)]`}>
                            {['eq','neq','gt','lt','gte','lte','contains','exists'].map(op => <option key={op} value={op}>{op}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={`${T.labelText} text-[9px] block mb-1`}>Valor</label>
                        <input value={d.value ?? ''} onChange={e => field('value', e.target.value)} placeholder="ej: 500"
                            className={`w-full px-2 py-1.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border-default)] text-xs ${T.inputText} focus:outline-none focus:border-[var(--brand-primary)]`} />
                    </div>
                </>
            )}

            {type === 'webhook' && (
                <>
                    <div>
                        <label className={`${T.labelText} text-[9px] block mb-1`}>URL</label>
                        <input value={d.url ?? ''} onChange={e => field('url', e.target.value)} placeholder="https://..."
                            className={`w-full px-2 py-1.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border-default)] text-xs ${T.inputText} focus:outline-none focus:border-[var(--brand-primary)]`} />
                    </div>
                    <div>
                        <label className={`${T.labelText} text-[9px] block mb-1`}>Método</label>
                        <select value={d.method ?? 'POST'} onChange={e => field('method', e.target.value)}
                            className={`w-full px-2 py-1.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border-default)] text-xs ${T.inputText} focus:outline-none focus:border-[var(--brand-primary)]`}>
                            {['GET','POST','PUT','PATCH'].map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={`${T.labelText} text-[9px] block mb-1`}>Body (JSON / template)</label>
                        <textarea value={d.body ?? ''} onChange={e => field('body', e.target.value)} rows={3}
                            className={`w-full px-2 py-1.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border-default)] text-xs font-mono ${T.inputText} focus:outline-none focus:border-[var(--brand-primary)] resize-none`} />
                    </div>
                </>
            )}

            {type === 'assign' && (
                <div>
                    <label className={`${T.labelText} text-[9px] block mb-1`}>ID de usuario (opcional)</label>
                    <input value={d.userId ?? ''} onChange={e => field('userId', e.target.value)} placeholder="UUID del agente"
                        className={`w-full px-2 py-1.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border-default)] text-xs ${T.inputText} focus:outline-none focus:border-[var(--brand-primary)]`} />
                </div>
            )}
        </div>
    );
}

// ── Main builder ──────────────────────────────────────────────────────────────
function FlowBuilder() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { success: ok, error: err } = useToast();

    const [flow, setFlow] = useState<AutomationFlow | null>(null);
    const [nodes, setNodes, onNodesChange] = useNodesState<AppNode>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<AppEdge>([]);
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);
    const [publishing, setPublishing] = useState(false);

    useEffect(() => {
        if (!id) return;
        automationsApi.get(id).then(data => {
            setFlow(data);
            const active = data.versions?.find(v => v.isActive);
            if (active?.stepsJson) {
                const { nodes: n, edges: e } = stepsJsonToFlow(active.stepsJson);
                setNodes(n);
                setEdges(e);
            } else {
                // Default empty flow
                setNodes([
                    { id: 'start', type: 'flowNode', position: { x: 200, y: 60 }, data: { nodeType: 'message', label: 'Escribe tu primer mensaje', text: '' } },
                    { id: 'end',   type: 'flowNode', position: { x: 200, y: 220 }, data: { nodeType: 'end', label: 'Fin' } },
                ]);
                setEdges([{ id: 'e-start-end', source: 'start', target: 'end', markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: '#6366f1' } } as any]);
            }
        }).catch(() => err('No se pudo cargar el flujo'));
    }, [id]);

    const onConnect = useCallback((params: Connection) => {
        setEdges(eds => addEdge({ ...params, markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: '#6366f1' } }, eds));
    }, []);

    const addNode = (type: string) => {
        const id = `${type}_${Date.now()}`;
        const newNode: Node = {
            id,
            type: 'flowNode',
            position: { x: Math.random() * 300 + 60, y: Math.random() * 200 + 100 },
            data: { nodeType: type, label: NODE_LABELS[type], text: '', field: '', operator: 'eq', value: '', url: '', method: 'POST' },
        };
        setNodes(nds => [...nds, newNode]);
    };

    const updateNodeData = (nodeId: string, data: any) => {
        setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...data, label: data.text || data.url || data.field || NODE_LABELS[data.nodeType] || data.nodeType } } : n));
        setSelectedNode(prev => prev?.id === nodeId ? { ...prev, data } : prev);
    };

    const handlePublish = async () => {
        if (!id) return;
        setPublishing(true);
        try {
            const stepsJson = nodesToStepsJson(nodes, edges);
            await automationsApi.publish(id, stepsJson);
            ok('Versión publicada');
        } catch (e: any) { err(e.message); }
        setPublishing(false);
    };

    return (
        <div className="h-screen flex flex-col bg-[var(--bg-surface)] overflow-hidden">

            {/* Toolbar */}
            <div className="shrink-0 h-12 flex items-center gap-3 px-4 border-b border-[var(--border-default)] bg-[var(--bg-card)]">
                <button onClick={() => navigate(-1)} className={`${T.helperText} text-xs hover:text-white transition`}>← Volver</button>
                <span className={`${T.cardTitle} text-xs`}>{flow?.name ?? 'Builder'}</span>
                <div className="flex-1" />

                {/* Add node buttons */}
                <div className="flex gap-1">
                    {Object.entries(NODE_LABELS).map(([type, label]) => (
                        <button key={type} onClick={() => addNode(type)}
                            className="px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest border border-[var(--border-default)] hover:bg-[var(--bg-input)] transition text-[var(--tx-cardTitle-color)]">
                            + {label}
                        </button>
                    ))}
                </div>

                <button onClick={handlePublish} disabled={publishing}
                    className="px-4 py-1.5 rounded-lg bg-[var(--brand-primary)] text-white text-xs font-bold uppercase tracking-widest disabled:opacity-40 hover:opacity-90 transition">
                    {publishing ? '...' : 'Publicar'}
                </button>
            </div>

            {/* Canvas + properties panel */}
            <div className="flex-1 flex overflow-hidden">
                <div className="flex-1">
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

                {/* Properties panel */}
                <div className="w-64 shrink-0 border-l border-[var(--border-default)] bg-[var(--bg-card)] overflow-hidden">
                    <div className="px-4 py-2 border-b border-[var(--border-default)]">
                        <p className={`${T.cardTitle} text-xs`}>Propiedades</p>
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
