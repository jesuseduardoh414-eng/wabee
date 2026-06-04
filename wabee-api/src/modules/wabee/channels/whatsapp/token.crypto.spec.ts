import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from './token.crypto';

describe('token.crypto (AES-256-GCM)', () => {

    it('descifra correctamente lo que cifra (roundtrip)', () => {
        const plain = 'pat-na1-1234567890-abcdef-token-secreto';
        const enc = encrypt(plain);
        expect(decrypt(enc)).toBe(plain);
    });

    it('produce ciphertext distinto al texto plano', () => {
        const plain = 'access_token_value';
        const enc = encrypt(plain);
        expect(enc.ciphertext).not.toBe(plain);
        expect(enc.ciphertext.length).toBeGreaterThan(0);
    });

    it('usa un IV distinto en cada cifrado (no determinista)', () => {
        const plain = 'mismo-texto';
        const a = encrypt(plain);
        const b = encrypt(plain);
        expect(a.iv).not.toBe(b.iv);
        expect(a.ciphertext).not.toBe(b.ciphertext);
        // pero ambos descifran al mismo valor
        expect(decrypt(a)).toBe(plain);
        expect(decrypt(b)).toBe(plain);
    });

    it('falla al descifrar si el tag de autenticación fue alterado', () => {
        const enc = encrypt('dato-sensible');
        const tampered = { ...enc, tag: '00'.repeat(16) };
        expect(() => decrypt(tampered)).toThrow();
    });

    it('falla al descifrar si el ciphertext fue alterado', () => {
        const enc = encrypt('dato-sensible');
        const flipped = enc.ciphertext.slice(0, -2) + (enc.ciphertext.endsWith('00') ? 'ff' : '00');
        expect(() => decrypt({ ...enc, ciphertext: flipped })).toThrow();
    });

    it('maneja cadenas vacías', () => {
        const enc = encrypt('');
        expect(decrypt(enc)).toBe('');
    });

    it('maneja caracteres unicode', () => {
        const plain = 'áéíóú ñ 你好 🎉 token';
        expect(decrypt(encrypt(plain))).toBe(plain);
    });
});
