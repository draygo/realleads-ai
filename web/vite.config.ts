// Vite configuration for RealLeads.ai frontend
// This config is adapted for local development on your machine
// and still keeps support for Replit if you ever need it again.

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  server: {
    // Allow Vite to listen on localhost (and 0.0.0.0 if needed)
    host: "localhost",

    // Use the standard Vite dev port
    port: 5173,

    // Allow localhost + 127.0.0.1 and keep Replit support as a fallback
    // This prevents dev server from rejecting your browser's Host header.
    allowedHosts: ["localhost", "127.0.0.1", ".replit.dev"],

    // Proxy /api requests to your backend (running on port 3001)
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
