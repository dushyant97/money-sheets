import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Static, offline-first SPA. Set VITE_BASE if deploying under a sub-path
// (e.g. GitHub Pages project sites: VITE_BASE=/money-sheets/).
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  server: {
    port: 5173
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2020'
  }
});
