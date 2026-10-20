import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // xterm.js makes up most of the bundle; ~175 KB gzipped is fine.
  build: { chunkSizeWarningLimit: 800 },
  server: {
    port: 5173,
    // Keep the browser's Host header (like Apache's ProxyPreserveHost) so the
    // server's same-origin check passes in dev.
    proxy: { '/api': { target: 'http://127.0.0.1:3001', changeOrigin: false } },
  },
});
