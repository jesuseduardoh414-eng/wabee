import crypto from 'crypto';
import { env } from '@/config/env';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(env.TOKEN_ENC_KEY, 'hex');

export function encrypt(text: string) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

    let ciphertext = cipher.update(text, 'utf8', 'hex');
    ciphertext += cipher.final('hex');

    const tag = cipher.getAuthTag();

    return {
        ciphertext,
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
    };
}

export function decrypt(data: { ciphertext: string; iv: string; tag: string }) {
    const decipher = crypto.createDecipheriv(
        ALGORITHM,
        KEY,
        Buffer.from(data.iv, 'hex')
    );

    decipher.setAuthTag(Buffer.from(data.tag, 'hex'));

    let text = decipher.update(data.ciphertext, 'hex', 'utf8');
    text += decipher.final('utf8');

    return text;
}
