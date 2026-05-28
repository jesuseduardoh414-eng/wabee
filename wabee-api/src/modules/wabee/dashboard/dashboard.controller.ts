import { Response } from 'express';
import { AuthRequest } from '@/middleware/auth.middleware';
import { DashboardService } from './dashboard.service';

export const getSummary = async (req: AuthRequest, res: Response) => {
    try {
        const { from, to } = req.query;
        const stats = await DashboardService.getSummary(req.tenantId!, from as string, to as string);
        res.json(stats);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getOperationalHealth = async (req: AuthRequest, res: Response) => {
    try {
        const stats = await DashboardService.getOperationalHealth(req.tenantId!);
        res.json(stats);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getAiVsHuman = async (req: AuthRequest, res: Response) => {
    try {
        const { from, to } = req.query;
        const stats = await DashboardService.getAiVsHuman(req.tenantId!, from as string, to as string);
        res.json(stats);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getTopCampaigns = async (req: AuthRequest, res: Response) => {
    try {
        const { from, to } = req.query;
        const stats = await DashboardService.getTopCampaigns(req.tenantId!, from as string, to as string);
        res.json(stats);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getAgentsPerformance = async (req: AuthRequest, res: Response) => {
    try {
        const { from, to } = req.query;
        const stats = await DashboardService.getAgentsPerformance(req.tenantId!, from as string, to as string);
        res.json(stats);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getInboxStatus = async (req: AuthRequest, res: Response) => {
    try {
        const stats = await DashboardService.getInboxStatus(req.tenantId!);
        res.json(stats);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getTimeSeries = async (req: AuthRequest, res: Response) => {
    try {
        const { from, to } = req.query;
        const stats = await DashboardService.getTimeSeries(req.tenantId!, from as string, to as string);
        res.json(stats);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};
