import 'dotenv/config';
import axios from 'axios';
import { performance } from 'perf_hooks';

const API_URL = 'http://localhost:3000/v1';

async function measureLogin() {
    console.log('--- Midiendo Endpoint de Login (After) ---');
    try {
        // Hacemos una petición falsa para levantar la conexión de base de datos
        await axios.post(`${API_URL}/auth/login`, { email: 'fake@example.com', password: '123' }).catch(e => e);

        const start = performance.now();
        const loginRes = await axios.post(`${API_URL}/auth/login`, { email: 'antigravityp5@gmail.com', password: 'password123' }).catch(e => e.response);
        const end = performance.now();

        console.log(`[POST /auth/login] ${Math.round(end - start)} ms (Status: ${loginRes?.status})`);

    } catch (err: any) {
        console.error('Error during measurement:', err.message);
    }
}

measureLogin();
