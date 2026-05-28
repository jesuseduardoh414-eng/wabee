import 'dotenv/config';
import axios from 'axios';
import { performance } from 'perf_hooks';
import jwt from 'jsonwebtoken';
import { corePrisma as prisma } from '../config/core/core.prisma';
import { coreEnv } from '../config/core/core.env';

const API_URL = 'http://localhost:3000/v1';

async function measure() {
    console.log('--- Midiendo Endpoints Before ---');
    try {
        // Obtener un usuario activo
        const profile = await prisma.profile.findFirst({
            include: { globalRole: true }
        });

        if (!profile) {
            console.log('No user found in DB');
            return;
        }

        const token = jwt.sign(
            { id: profile.id, email: profile.email, systemRole: profile.globalRole?.slug || 'admin' },
            coreEnv.JWT_SECRET as string,
            { expiresIn: '1h' }
        );

        const headers = { Authorization: `Bearer ${token}` };

        // Warmup para Prisma Connection
        await axios.get(`${API_URL}/auth/profile`, { headers }).catch(e => e);

        // 1. Measure Profile Fetching
        let start = performance.now();
        const profileRes = await axios.get(`${API_URL}/auth/profile`, { headers }).catch(e => e.response);
        let end = performance.now();
        console.log(`[GET /auth/profile] ${Math.round(end - start)} ms (Status: ${profileRes?.status})`);

        // 2. Measure Dashboard
        // Asumiendo que /dashboard o similar exista, u otro endpoint pesado

    } catch (err: any) {
        console.error('Error during measurement:', err.message);
    }
}

measure();
