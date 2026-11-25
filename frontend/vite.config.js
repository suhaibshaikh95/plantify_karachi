import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// In development, /api (endpoints) and /static (plant photos) go to the Node.js backend
// (VITE_DEV_API_TARGET). In production, set VITE_API_BASE_URL instead.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backend = { target: env.VITE_DEV_API_TARGET || 'http://localhost:8000', changeOrigin: true };
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': backend,
        '/static': backend,
      },
    },
  };
});
