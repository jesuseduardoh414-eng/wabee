import { prisma } from '@/lib/prisma';
import { AutomationFlowStatus, AutomationTrigger } from '@prisma/client';
import { FlowDefinition } from './automation.types';

export interface CreateFlowDto {
    name: string;
    description?: string;
    trigger: AutomationTrigger;
}

export interface UpdateFlowDto {
    name?: string;
    description?: string;
    trigger?: AutomationTrigger;
}

export interface PublishVersionDto {
    stepsJson: FlowDefinition;
}

export class AutomationsService {

    async listFlows(tenantId: string) {
        return prisma.automationFlow.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' },
            include: {
                _count: { select: { versions: true } },
                versions: {
                    where: { isActive: true },
                    select: { id: true, version: true, publishedAt: true },
                    take: 1,
                },
            },
        });
    }

    async getFlow(tenantId: string, flowId: string) {
        const flow = await prisma.automationFlow.findFirst({
            where: { id: flowId, tenantId },
            include: {
                versions: { orderBy: { version: 'desc' } },
            },
        });
        if (!flow) throw { status: 404, message: 'Automation flow not found' };
        return flow;
    }

    async createFlow(tenantId: string, dto: CreateFlowDto) {
        return prisma.automationFlow.create({
            data: {
                tenantId,
                name: dto.name.trim(),
                description: dto.description?.trim() ?? null,
                trigger: dto.trigger,
                status: 'DRAFT',
            },
        });
    }

    async updateFlow(tenantId: string, flowId: string, dto: UpdateFlowDto) {
        const existing = await prisma.automationFlow.findFirst({
            where: { id: flowId, tenantId },
        });
        if (!existing) throw { status: 404, message: 'Automation flow not found' };

        return prisma.automationFlow.update({
            where: { id: flowId },
            data: {
                ...(dto.name        && { name:        dto.name.trim() }),
                ...(dto.description !== undefined && { description: dto.description?.trim() ?? null }),
                ...(dto.trigger     && { trigger:     dto.trigger }),
            },
        });
    }

    async deleteFlow(tenantId: string, flowId: string) {
        const existing = await prisma.automationFlow.findFirst({
            where: { id: flowId, tenantId },
        });
        if (!existing) throw { status: 404, message: 'Automation flow not found' };

        await prisma.automationFlow.delete({ where: { id: flowId } });
        return { message: 'Flow deleted successfully' };
    }

    async publishVersion(tenantId: string, flowId: string, dto: PublishVersionDto) {
        const flow = await prisma.automationFlow.findFirst({
            where: { id: flowId, tenantId },
            include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
        });
        if (!flow) throw { status: 404, message: 'Automation flow not found' };

        this.validateFlowDefinition(dto.stepsJson);

        const nextVersion = (flow.versions[0]?.version ?? 0) + 1;

        // Deactivate previous active version
        await prisma.automationFlowVersion.updateMany({
            where: { flowId, isActive: true },
            data: { isActive: false },
        });

        const newVersion = await prisma.automationFlowVersion.create({
            data: {
                flowId,
                tenantId,
                version: nextVersion,
                stepsJson: dto.stepsJson as any,
                isActive: true,
                publishedAt: new Date(),
            },
        });

        // Mark flow as ACTIVE when it has a published version
        await prisma.automationFlow.update({
            where: { id: flowId },
            data: { status: 'ACTIVE' },
        });

        return newVersion;
    }

    async setFlowStatus(tenantId: string, flowId: string, status: AutomationFlowStatus) {
        const flow = await prisma.automationFlow.findFirst({
            where: { id: flowId, tenantId },
        });
        if (!flow) throw { status: 404, message: 'Automation flow not found' };

        return prisma.automationFlow.update({
            where: { id: flowId },
            data: { status },
        });
    }

    async getActiveVersionForTrigger(tenantId: string, trigger: AutomationTrigger) {
        return prisma.automationFlowVersion.findFirst({
            where: {
                tenantId,
                isActive: true,
                flow: { tenantId, trigger, status: 'ACTIVE' },
            },
            include: { flow: true },
            orderBy: { publishedAt: 'desc' },
        });
    }

    // ── Validation ────────────────────────────────────────────────────────────

    private validateFlowDefinition(def: FlowDefinition) {
        if (!def?.startNodeId) {
            throw { status: 400, message: 'stepsJson must have a startNodeId' };
        }
        if (!def?.nodes || typeof def.nodes !== 'object') {
            throw { status: 400, message: 'stepsJson must have a nodes object' };
        }
        if (!def.nodes[def.startNodeId]) {
            throw { status: 400, message: `startNodeId "${def.startNodeId}" does not exist in nodes` };
        }

        const validTypes = new Set(['message', 'question', 'condition', 'assign', 'webhook', 'end']);
        for (const [id, node] of Object.entries(def.nodes)) {
            if (!validTypes.has((node as any).type)) {
                throw { status: 400, message: `Node "${id}" has unknown type "${(node as any).type}"` };
            }
        }
    }
}

export const automationsService = new AutomationsService();
