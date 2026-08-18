import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Production preview uses the SAME proxy contract as dev, so the built
  // artifact is verified against the path the browser will really use.
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      '/ingest': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/ingest/, '')
      }
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    cors: true,
    hmr: { clientPort: 443 },
    // The browser is not the sandbox, so client code must never call
    // localhost:8787 directly. It calls /ingest and Vite proxies it.
    proxy: {
      '/ingest': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/ingest/, '')
      }
    }
  }
});
