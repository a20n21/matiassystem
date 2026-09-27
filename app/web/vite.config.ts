import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 8081,
    strictPort: true,
    // Pasta montada do Windows não gera eventos de arquivo no container: verifica por polling
    watch: { usePolling: true, interval: 300 },
    proxy: {
      // changeOrigin: false mantém o Host original, exigido pela checagem de origem da API
      '/api': { target: process.env.API_URL ?? 'http://localhost:3000', changeOrigin: false },
    },
  },
  build: { outDir: 'dist' },
});
