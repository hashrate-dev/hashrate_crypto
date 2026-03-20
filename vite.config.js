import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
var __dirname = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
    plugins: [
        nodePolyfills({ globals: { Buffer: true, global: true, process: true } }),
        react(),
    ],
    resolve: {
        alias: { '@': path.resolve(__dirname, './src') },
    },
    server: {
        proxy: {
            '/api': {
                target: 'http://127.0.0.1:3001',
                changeOrigin: true,
            },
        },
    },
});
