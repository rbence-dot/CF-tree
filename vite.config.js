import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.[jt]sx?$/,
  },
  optimizeDeps: {
    esbuildOptions: { loader: { '.js': 'jsx' } },
  },
  server: { port: 3003 },
  publicDir: 'public',
  build: { outDir: 'dist', emptyOutDir: true },
});
