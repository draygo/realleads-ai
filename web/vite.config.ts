import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite configuration for RealLeads.ai frontend
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  server: {
    // Listen on all network interfaces (0.0.0.0)
    // This allows Replit to access the dev server from outside
    host: true,

    // Explicitly set port to 5173
    port: 5173,

    // Allow Replit hostnames
    // Replit generates dynamic hostnames like: xyz.replit.dev
    // This wildcard pattern allows all *.replit.dev hostnames
    allowedHosts: [".replit.dev"],

    // Proxy configuration
    // All requests to /api/* will be forwarded to the backend server
    proxy: {
      "/api": {
        // Backend server running on port 3001
        target: "http://localhost:3001",

        // Change the origin header to match the target
        // This is needed for CORS to work properly
        changeOrigin: true,
      },
    },
  },
});
