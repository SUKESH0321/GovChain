import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy API calls to the Express backend during development.
      // Keep this in sync with the PORT in server/.env.
      '/api': 'http://localhost:5000',
    },
  },
});