import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
    },
    test: {
        globals: true,
        environment: 'node',
        include: ['src/**/*.{spec,test}.ts'],
        // Excluir scripts y artefactos. Los dos archivos legacy usan un runner
        // casero de console.log (no son suites vitest), se ejecutan aparte.
        exclude: [
            'node_modules',
            'dist',
            'src/scripts/**',
            'src/modules/wabee/ai/ai.base.prompt.spec.ts',
            'src/modules/wabee/contacts/contacts.import.test.ts',
        ],
    },
});
