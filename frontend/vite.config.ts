import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
        // OAuth start endpoints return 302 to Google/Riot/etc. Following those
        // from Node produces "socket hang up" in the Vite console.
        followRedirects: false,
      },
    },
  },
});
