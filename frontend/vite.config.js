import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
const root = fileURLToPath(new URL('../', import.meta.url));
export default defineConfig(({ mode }) => {
  const { PORT = '8000' } = loadEnv(mode, root, 'PORT');
  const proxy = { '/api': `http://127.0.0.1:${PORT}` };
  return {
    plugins: [react(), tailwindcss()],
    server: { port: 5173, strictPort: true, proxy },
    preview: { port: 4173, proxy },
  };
});
