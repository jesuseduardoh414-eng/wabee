import axios from 'axios';
import { env } from '@/config/env';

const BASE_URL = `https://graph.facebook.com/${env.META_GRAPH_VERSION}`;

export async function graphGet(path: string, token: string, params: any = {}) {
    const url = `${BASE_URL}${path}`;
    const response = await axios.get(url, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
        params,
    });
    return response.data;
}

export async function graphPost(path: string, token: string, data: any = {}) {
    const url = `${BASE_URL}${path}`;
    const response = await axios.post(url, data, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    return response.data;
}

export async function graphDelete(path: string, token: string, params: any = {}) {
    const url = `${BASE_URL}${path}`;
    const response = await axios.delete(url, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
        params,
    });
    return response.data;
}
