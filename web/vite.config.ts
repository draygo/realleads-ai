// web/vite.config.ts
// Vite config for RealLeads Admin UI (Replit + Supabase)
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',    // required so Replit can proxy the dev server
    port: 8787,         // dev port for the frontend (Replit may remap this)
    allowedHosts: true, // allow the *.replit.dev host
    proxy: {
      // Forward any /api/* call from the browser to the backend dev server
      '/api': {
        target: 'http://localhost:3000', // <-- IMPORTANT: backend dev port
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
