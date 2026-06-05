import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    plugins: [
        react(),
        visualizer({
            filename: 'dist/stats.html',
            open: false,
            gzipSize: true,
            brotliSize: true
        })
    ],
    server: {
        port: 5173,
        strictPort: true,
        proxy: {
            '/v1': { target: 'http://localhost:4000', changeOrigin: true },
            '/oauth': { target: 'http://localhost:4000', changeOrigin: true },
            '/webhooks': { target: 'http://localhost:4000', changeOrigin: true },
        },
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    vendor: ['react', 'react-dom', 'react-router-dom'],
                    query: ['@tanstack/react-query'],
                    icons: ['lucide-react']
                }
            }
        }
    }
})
